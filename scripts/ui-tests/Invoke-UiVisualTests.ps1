#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$ExecutablePath,

    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\artifacts\ui-tests'),

    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$ManifestPath = (Join-Path $PSScriptRoot 'scenarios.json'),

    [AllowEmptyCollection()]
    [string[]]$BaseArguments,

    [string]$WindowTitlePattern,

    [double[]]$WebViewScaleFactors = @(1.0),

    [string]$WorkingDirectory,

    [ValidateRange(1, 300)]
    [int]$WindowTimeoutSeconds = 30,

    [ValidateRange(0, 10000)]
    [int]$ReadyDelayMilliseconds = 800,

    [ValidateRange(1, 120)]
    [int]$CaptureTimeoutSeconds = 20,

    [ValidateRange(1, 30)]
    [int]$CloseTimeoutSeconds = 5,

    [ValidateRange(320, 8192)]
    [int]$MaximumScaledWindowWidth = 2560,

    [ValidateRange(360, 8192)]
    [int]$MaximumScaledWindowHeight = 1600,

    [switch]$AllowHardwareAcceleration,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'WindowCapture.psm1') -Force

function ConvertTo-NativeCommandLineArgument {
    param([AllowEmptyString()] [string]$Value)

    if ($null -eq $Value -or $Value.Length -eq 0) { return '""' }
    if ($Value -notmatch '[\s"]') { return $Value }

    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') {
            $backslashes++
            continue
        }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (($backslashes * 2) + 1)))
            [void]$builder.Append('"')
            $backslashes = 0
            continue
        }
        if ($backslashes -gt 0) {
            [void]$builder.Append(('\' * $backslashes))
            $backslashes = 0
        }
        [void]$builder.Append($character)
    }
    if ($backslashes -gt 0) {
        [void]$builder.Append(('\' * ($backslashes * 2)))
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Join-NativeArguments {
    param([string[]]$Arguments)
    return (@($Arguments | ForEach-Object { ConvertTo-NativeCommandLineArgument ([string]$_) }) -join ' ')
}

function Get-SingleArgumentValue {
    param(
        [Parameter(Mandatory)] [string[]]$Arguments,
        [Parameter(Mandatory)] [string]$Name
    )

    $values = [Collections.Generic.List[string]]::new()
    for ($index = 0; $index -lt $Arguments.Count; $index++) {
        if ($Arguments[$index] -ne $Name) { continue }
        if ($index + 1 -ge $Arguments.Count -or [string]::IsNullOrWhiteSpace($Arguments[$index + 1])) {
            throw "$Name requires a non-empty value."
        }
        $values.Add([string]$Arguments[$index + 1])
        $index++
    }
    if ($values.Count -ne 1) {
        throw "Exactly one $Name argument is required in BaseArguments."
    }
    return $values[0]
}

function ConvertTo-ScaledWindowArguments {
    param(
        [Parameter(Mandatory)] [string[]]$Arguments,
        [Parameter(Mandatory)] [double]$ScaleFactor,
        [Parameter(Mandatory)] [int]$MaximumWidth,
        [Parameter(Mandatory)] [int]$MaximumHeight
    )

    $scaledArguments = @($Arguments | ForEach-Object { [string]$_ })
    $dimensions = [ordered]@{}
    foreach ($specification in @(
            [pscustomobject]@{ Name = '--window-width'; Key = 'width'; Maximum = $MaximumWidth },
            [pscustomobject]@{ Name = '--window-height'; Key = 'height'; Maximum = $MaximumHeight }
        )) {
        $indexes = [Collections.Generic.List[int]]::new()
        for ($index = 0; $index -lt $scaledArguments.Count; $index++) {
            if ($scaledArguments[$index] -ne $specification.Name) { continue }
            if ($index + 1 -ge $scaledArguments.Count) {
                throw "$($specification.Name) requires a value."
            }
            $indexes.Add($index)
            $index++
        }
        if ($indexes.Count -ne 1) {
            throw "Exactly one $($specification.Name) argument is required after combining BaseArguments and the scenario."
        }

        $argumentIndex = $indexes[0] + 1
        $logicalValue = 0
        if (-not [int]::TryParse($scaledArguments[$argumentIndex],
                [Globalization.NumberStyles]::None, [Globalization.CultureInfo]::InvariantCulture,
                [ref]$logicalValue) -or $logicalValue -le 0) {
            throw "$($specification.Name) must be a positive integer."
        }
        $requestedValue = [int][Math]::Round(
            $logicalValue * $ScaleFactor, [MidpointRounding]::AwayFromZero)
        $launchValue = [Math]::Min($requestedValue, [int]$specification.Maximum)
        $scaledArguments[$argumentIndex] = $launchValue.ToString([Globalization.CultureInfo]::InvariantCulture)
        $dimensions[$specification.Key] = [pscustomobject][ordered]@{
            logical = $logicalValue
            requested = $requestedValue
            launch = $launchValue
            capped = $launchValue -ne $requestedValue
        }
    }

    return [pscustomobject][ordered]@{
        arguments = @($scaledArguments)
        width = $dimensions.width
        height = $dimensions.height
    }
}

function Get-StringSha256 {
    param([AllowEmptyString()] [string]$Value)

    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
    }
}

function Get-WebAssetManifest {
    param([Parameter(Mandatory)] [string]$Root)

    $resolvedRoot = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path.TrimEnd('\', '/')
    if (-not (Test-Path -LiteralPath $resolvedRoot -PathType Container)) {
        throw "Web asset directory does not exist: $resolvedRoot"
    }

    $rootPrefix = $resolvedRoot + [IO.Path]::DirectorySeparatorChar
    $relativePaths = @(
        Get-ChildItem -LiteralPath $resolvedRoot -Recurse -Force -File | ForEach-Object {
            $fullPath = [IO.Path]::GetFullPath($_.FullName)
            if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw "Web asset escaped its root: $fullPath"
            }
            $fullPath.Substring($rootPrefix.Length).Replace('\', '/')
        }
    )
    [Array]::Sort($relativePaths, [StringComparer]::Ordinal)

    $files = [Collections.Generic.List[object]]::new()
    foreach ($relativePath in $relativePaths) {
        $nativeRelativePath = $relativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)
        $assetPath = Join-Path $resolvedRoot $nativeRelativePath
        $files.Add([ordered]@{
            relativePath = $relativePath
            sha256 = (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
        })
    }

    $canonical = (@($files | ForEach-Object { "$($_.relativePath)`t$($_.sha256)" }) -join "`n")
    if ($files.Count -gt 0) { $canonical += "`n" }
    return [pscustomobject][ordered]@{
        root = $resolvedRoot
        manifestSha256 = Get-StringSha256 $canonical
        files = @($files)
    }
}

function Start-OwnedProcess {
    param(
        [Parameter(Mandatory)] [string]$FilePath,
        [Parameter(Mandatory)] [string[]]$Arguments,
        [Parameter(Mandatory)] [string]$ProcessWorkingDirectory,
        [Parameter(Mandatory)] [double]$ScaleFactor,
        [Parameter(Mandatory)] [string]$UserDataFolder
    )

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = Join-NativeArguments $Arguments
    $startInfo.WorkingDirectory = $ProcessWorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $false

    $browserArguments = [Collections.Generic.List[string]]::new()
    $existingBrowserArguments = ''
    if ($startInfo.EnvironmentVariables.ContainsKey('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS')) {
        $existingBrowserArguments = [string]$startInfo.EnvironmentVariables['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']
    }
    if ($existingBrowserArguments) { $browserArguments.Add($existingBrowserArguments) }
    if (-not $AllowHardwareAcceleration) { $browserArguments.Add('--disable-gpu') }
    $scaleText = $ScaleFactor.ToString('0.##', [Globalization.CultureInfo]::InvariantCulture)
    $browserArguments.Add("--force-device-scale-factor=$scaleText")
    $startInfo.EnvironmentVariables['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = ($browserArguments -join ' ')
    $startInfo.EnvironmentVariables['AI_MINER_VISUAL_TEST'] = '1'
    $startInfo.EnvironmentVariables['AI_MINER_VISUAL_TEST_SCALE'] = $scaleText
    $startInfo.EnvironmentVariables['WEBVIEW2_USER_DATA_FOLDER'] = $UserDataFolder
    $startInfo.EnvironmentVariables['AI_MINER_VISUAL_TEST_USER_DATA_FOLDER'] = $UserDataFolder

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        $process.Dispose()
        throw "Failed to launch $FilePath."
    }
    return $process
}

function Remove-OwnedUserDataFolder {
    param([Parameter(Mandatory)] [string]$Path)

    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
    $resolved = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $directory = [IO.DirectoryInfo]::new($resolved)
    if ($directory.Name -notmatch '^ai-miner-webview-test-[a-f0-9]{32}$' -or
        -not $directory.Parent -or $directory.Parent.FullName.TrimEnd('\') -ne $tempRoot) {
        throw "Refusing to remove an unexpected visual-test data directory: $resolved"
    }
    if (-not $directory.Exists) { return 'not-created' }
    if (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing to recursively remove a reparse-point visual-test directory: $resolved"
    }
    [IO.Directory]::Delete($resolved, $true)
    return 'deleted'
}

function Close-OwnedProcess {
    param([Parameter(Mandatory)] [Diagnostics.Process]$Process)

    $result = 'already-exited'
    try {
        try {
            if (-not $Process.HasExited) {
                $result = 'close-main-window'
                [void]$Process.CloseMainWindow()
                if (-not $Process.WaitForExit($CloseTimeoutSeconds * 1000)) {
                    # This Process object is the exact process created above. Never
                    # search by name, title, or executable when cleaning up.
                    $result = 'killed-launched-process'
                    try { $Process.Kill() }
                    catch [InvalidOperationException] { $result = 'exited-during-cleanup' }
                    [void]$Process.WaitForExit($CloseTimeoutSeconds * 1000)
                }
            }
        }
        catch [InvalidOperationException] {
            $result = 'exited-during-cleanup'
        }
    }
    finally {
        $Process.Dispose()
    }
    return $result
}

function Invoke-CaptureHelper {
    param(
        [Parameter(Mandatory)] [int]$TargetProcessId,
        [Parameter(Mandatory)] [long]$TargetProcessStartTimeUtcTicks,
        [Parameter(Mandatory)] [string]$TitlePattern,
        [Parameter(Mandatory)] [string]$PngPath,
        [Parameter(Mandatory)] [string]$MetadataPath
    )

    $captureScript = Join-Path $PSScriptRoot 'Capture-Window.ps1'
    $powerShellPath = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $arguments = @(
        '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', $captureScript,
        '-ProcessId', [string]$TargetProcessId,
        '-ExpectedProcessStartTimeUtcTicks', [string]$TargetProcessStartTimeUtcTicks,
        '-WindowTitlePattern', $TitlePattern,
        '-WaitTimeoutSeconds', [string]$WindowTimeoutSeconds,
        '-OutputPath', $PngPath,
        '-MetadataPath', $MetadataPath
    )
    if ($Force) { $arguments += '-Force' }

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $powerShellPath
    $startInfo.Arguments = Join-NativeArguments $arguments
    $startInfo.WorkingDirectory = $PSScriptRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $helper = [Diagnostics.Process]::new()
    $helper.StartInfo = $startInfo
    if (-not $helper.Start()) {
        $helper.Dispose()
        throw 'Failed to launch the isolated capture helper.'
    }
    try {
        if (-not $helper.WaitForExit($CaptureTimeoutSeconds * 1000)) {
            # Kill only the capture helper created by this function. The UI host
            # and all pre-existing applications remain untouched.
            $helper.Kill()
            [void]$helper.WaitForExit(3000)
            throw "PrintWindow capture exceeded $CaptureTimeoutSeconds seconds."
        }
        $standardOutput = $helper.StandardOutput.ReadToEnd()
        $standardError = $helper.StandardError.ReadToEnd()
        if ($helper.ExitCode -ne 0) {
            throw "Capture helper failed with exit code $($helper.ExitCode): $standardError $standardOutput"
        }
    }
    finally {
        $helper.Dispose()
    }

    if (-not (Test-Path -LiteralPath $PngPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $MetadataPath -PathType Leaf)) {
        throw 'The capture helper succeeded without producing both PNG and metadata.'
    }
    return (Get-Content -LiteralPath $MetadataPath -Raw | ConvertFrom-Json)
}

$resolvedExecutable = (Resolve-Path -LiteralPath $ExecutablePath).Path
$resolvedManifest = (Resolve-Path -LiteralPath $ManifestPath).Path
if (-not $WorkingDirectory) { $WorkingDirectory = Split-Path -Parent $resolvedExecutable }
$resolvedWorkingDirectory = [IO.Path]::GetFullPath($WorkingDirectory)
if (-not (Test-Path -LiteralPath $resolvedWorkingDirectory -PathType Container)) {
    throw "WorkingDirectory does not exist: $resolvedWorkingDirectory"
}

$manifest = Get-Content -LiteralPath $resolvedManifest -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1) { throw 'Only UI scenario manifest schemaVersion 1 is supported.' }
if (-not $manifest.scenarios -or @($manifest.scenarios).Count -eq 0) { throw 'The UI scenario manifest is empty.' }

if (-not $PSBoundParameters.ContainsKey('BaseArguments')) {
    $BaseArguments = @($manifest.baseArguments | ForEach-Object { [string]$_ })
}
if (-not $PSBoundParameters.ContainsKey('WindowTitlePattern')) {
    $WindowTitlePattern = [string]$manifest.windowTitlePattern
}
if (-not $WindowTitlePattern) { throw 'A non-empty WindowTitlePattern is required.' }

$webAssetsArgument = Get-SingleArgumentValue -Arguments @($BaseArguments) -Name '--assets'
$webAssetsAtStart = Get-WebAssetManifest -Root $webAssetsArgument
foreach ($scenario in @($manifest.scenarios)) {
    if (@($scenario.arguments | Where-Object { [string]$_ -eq '--assets' }).Count -gt 0) {
        throw "Scenario '$($scenario.name)' must not override the suite --assets directory."
    }
}

foreach ($scale in $WebViewScaleFactors) {
    if ($scale -notin @(1.0, 1.5, 2.0)) {
        throw "Unsupported WebViewScaleFactor '$scale'. Supported test values are 1.0, 1.5, and 2.0."
    }
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
[void](New-Item -ItemType Directory -Path $resolvedOutput -Force)
$suitePath = Join-Path $resolvedOutput 'suite.json'
if ((Test-Path -LiteralPath $suitePath) -and -not $Force) {
    throw "Refusing to overwrite an existing suite: $suitePath (use -Force or a new output directory)."
}

$suite = [ordered]@{
    schemaVersion = 1
    startedAtUtc = [DateTime]::UtcNow.ToString('o')
    executable = $resolvedExecutable
    executableSha256 = (Get-FileHash -LiteralPath $resolvedExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
    scenarioManifest = $resolvedManifest
    webAssets = [ordered]@{
        root = $webAssetsAtStart.root
        manifestSha256AtStart = $webAssetsAtStart.manifestSha256
        manifestSha256AtEnd = $null
        unchangedAtEnd = $false
        files = @($webAssetsAtStart.files)
    }
    windowTitlePattern = $WindowTitlePattern
    note = 'Forced WebView scale is Chromium emulation. Host client dimensions are scaled to preserve the manifest logical viewport, subject to the recorded safety caps; capture metadata records the real window DPI.'
    scaledWindowLimits = [ordered]@{
        width = $MaximumScaledWindowWidth
        height = $MaximumScaledWindowHeight
    }
    monitors = @(Get-UiMonitorInventory | ForEach-Object {
        [ordered]@{
            deviceName = $_.DeviceName
            primary = $_.Primary
            left = $_.Left
            top = $_.Top
            width = $_.Width
            height = $_.Height
            effectiveDpiX = $_.EffectiveDpiX
            effectiveDpiY = $_.EffectiveDpiY
            scalePercent = $_.ScalePercent
        }
    })
    captures = [Collections.Generic.List[object]]::new()
    errors = [Collections.Generic.List[object]]::new()
}

foreach ($scale in $WebViewScaleFactors) {
    $scalePercent = [int][Math]::Round($scale * 100)
    $scaleDirectory = Join-Path $resolvedOutput ("scale-$scalePercent")
    [void](New-Item -ItemType Directory -Path $scaleDirectory -Force)

    foreach ($scenario in @($manifest.scenarios)) {
        $name = [string]$scenario.name
        if ($name -notmatch '^[a-z0-9][a-z0-9_-]{0,63}$') {
            throw "Unsafe scenario name '$name'. Use lowercase ASCII letters, digits, dash, or underscore."
        }
        $scenarioArguments = @($scenario.arguments | ForEach-Object { [string]$_ })
        $logicalArguments = @($BaseArguments) + $scenarioArguments
        $scaledWindow = ConvertTo-ScaledWindowArguments -Arguments $logicalArguments `
            -ScaleFactor $scale -MaximumWidth $MaximumScaledWindowWidth `
            -MaximumHeight $MaximumScaledWindowHeight
        $arguments = @($scaledWindow.arguments)
        $pngPath = Join-Path $scaleDirectory "$name.png"
        $metadataPath = Join-Path $scaleDirectory "$name.json"
        $process = $null
        $cleanup = 'not-started'
        $userDataCleanup = 'not-started'
        $testUserDataFolder = Join-Path ([IO.Path]::GetTempPath()) `
            ('ai-miner-webview-test-' + [Guid]::NewGuid().ToString('N'))
        [void][IO.Directory]::CreateDirectory($testUserDataFolder)
        try {
            $process = Start-OwnedProcess -FilePath $resolvedExecutable -Arguments $arguments `
                -ProcessWorkingDirectory $resolvedWorkingDirectory -ScaleFactor $scale `
                -UserDataFolder $testUserDataFolder
            $launchedPid = $process.Id
            $launchedStartTimeUtcTicks = $process.StartTime.ToUniversalTime().Ticks
            if ($ReadyDelayMilliseconds -gt 0) { Start-Sleep -Milliseconds $ReadyDelayMilliseconds }
            $capture = Invoke-CaptureHelper -TargetProcessId $launchedPid `
                -TargetProcessStartTimeUtcTicks $launchedStartTimeUtcTicks -TitlePattern $WindowTitlePattern `
                -PngPath $pngPath -MetadataPath $metadataPath
            if ($capture.processId -ne $launchedPid) {
                throw "Capture PID $($capture.processId) does not match launched PID $launchedPid."
            }
            if ($capture.className -eq '#32770') {
                throw "Scenario '$name' opened a native error dialog instead of the application window. Check the visual-test arguments and asset path."
            }
            $suite.captures.Add([ordered]@{
                scenario = $name
                webViewScaleFactor = $scale
                launchedProcessId = $launchedPid
                arguments = $arguments
                logicalArguments = $logicalArguments
                logicalWindow = [ordered]@{
                    width = $scaledWindow.width.logical
                    height = $scaledWindow.height.logical
                }
                launchWindow = [ordered]@{
                    width = $scaledWindow.width.launch
                    height = $scaledWindow.height.launch
                    requestedWidth = $scaledWindow.width.requested
                    requestedHeight = $scaledWindow.height.requested
                    widthCapped = $scaledWindow.width.capped
                    heightCapped = $scaledWindow.height.capped
                }
                png = $pngPath
                metadata = $metadataPath
                dpi = $capture.dpi
                imageWidth = $capture.image.width
                imageHeight = $capture.image.height
            })
        }
        catch {
            $suite.errors.Add([ordered]@{
                scenario = $name
                webViewScaleFactor = $scale
                launchedProcessId = if ($process) { $process.Id } else { 0 }
                message = $_.Exception.Message
            })
        }
        finally {
            if ($process) {
                $cleanup = Close-OwnedProcess -Process $process
            }
            try { $userDataCleanup = Remove-OwnedUserDataFolder -Path $testUserDataFolder }
            catch {
                $userDataCleanup = 'failed: ' + $_.Exception.Message
                $suite.errors.Add([ordered]@{
                    scenario = $name
                    webViewScaleFactor = $scale
                    launchedProcessId = 0
                    message = 'Visual-test WebView2 data cleanup failed: ' + $_.Exception.Message
                })
            }
            if ($suite.captures.Count -gt 0) {
                $lastCapture = $suite.captures[$suite.captures.Count - 1]
                if ($lastCapture.scenario -eq $name -and $lastCapture.webViewScaleFactor -eq $scale) {
                    $lastCapture.cleanup = $cleanup
                    $lastCapture.userDataCleanup = $userDataCleanup
                }
            }
            if ($suite.errors.Count -gt 0) {
                $lastError = $suite.errors[$suite.errors.Count - 1]
                if ($lastError.scenario -eq $name -and $lastError.webViewScaleFactor -eq $scale) {
                    $lastError.cleanup = $cleanup
                    $lastError.userDataCleanup = $userDataCleanup
                }
            }
        }
    }
}

try {
    $webAssetsAtEnd = Get-WebAssetManifest -Root $webAssetsAtStart.root
    $suite.webAssets.manifestSha256AtEnd = $webAssetsAtEnd.manifestSha256
    $suite.webAssets.unchangedAtEnd = $webAssetsAtEnd.manifestSha256 -eq $webAssetsAtStart.manifestSha256
    if (-not $suite.webAssets.unchangedAtEnd) {
        $suite.errors.Add([ordered]@{
            scenario = 'web-assets'
            webViewScaleFactor = 0
            launchedProcessId = 0
            message = 'Web assets changed while the visual suite was running.'
        })
    }
}
catch {
    $suite.errors.Add([ordered]@{
        scenario = 'web-assets'
        webViewScaleFactor = 0
        launchedProcessId = 0
        message = 'Unable to re-verify Web assets: ' + $_.Exception.Message
    })
}

$suite.completedAtUtc = [DateTime]::UtcNow.ToString('o')
$suite.passed = $suite.errors.Count -eq 0
$suite | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $suitePath -Encoding UTF8

if (-not $suite.passed) {
    $messages = @($suite.errors | ForEach-Object { "$($_.scenario)@$($_.webViewScaleFactor): $($_.message)" }) -join [Environment]::NewLine
    throw "One or more UI visual captures failed. See $suitePath.$([Environment]::NewLine)$messages"
}

[pscustomobject]$suite
