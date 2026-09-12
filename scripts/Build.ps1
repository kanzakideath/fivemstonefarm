#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$')]
    [string]$Version,

    [switch]$SkipToolBootstrap
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = Join-Path $repoRoot 'src'
$buildRoot = Join-Path $repoRoot 'build'
$stageRoot = Join-Path $buildRoot 'staging'
$distRoot = Join-Path $repoRoot 'dist'
$mainSource = Join-Path $sourceRoot 'mining-auto.ahk'
$bridgeSource = Join-Path $sourceRoot 'background-bridge\CdpBridge.cs'
$updaterSource = Join-Path $sourceRoot 'updater\Updater.cs'
$uiWebRoot = Join-Path $sourceRoot 'ui-web'
$uiWebPackage = Join-Path $uiWebRoot 'package.json'
$uiWebLock = Join-Path $uiWebRoot 'package-lock.json'
$uiWebOutput = Join-Path $uiWebRoot 'www'
$uiHostProject = Join-Path $sourceRoot 'ui-host\AI.Miner.UiHost.csproj'
$uiHostLock = Join-Path $sourceRoot 'ui-host\packages.lock.json'
$uiHostOutput = Join-Path $buildRoot 'ui-host'
$nugetPackageRoot = Join-Path $buildRoot 'nuget-packages'
$stoneSidecarRoot = Join-Path $repoRoot 'sidecar\stone-metagame'
$stoneSidecarPackage = Join-Path $stoneSidecarRoot 'package.json'
$stoneSidecarBackendProject = Join-Path $stoneSidecarRoot 'backend\StoneMetaGame.csproj'
$stoneSidecarTestsProject = Join-Path $stoneSidecarRoot 'backend.tests\StoneMetaGame.Tests.csproj'
$stoneSidecarUiRoot = Join-Path $stoneSidecarRoot 'ui'
$stoneSidecarDataRoot = Join-Path $stoneSidecarRoot 'data'
$stoneverseRoot = Join-Path $repoRoot 'sidecar\stoneverse'
$integratedMetaRoot = Join-Path $uiWebRoot 'src\metagame'
$rootReadme = Join-Path $repoRoot 'README.md'
$sourceReadme = Join-Path $sourceRoot 'README.md'
$usageGuide = Join-Path $repoRoot 'docs\AI採掘機_使い方.txt'
$configTemplate = Join-Path $repoRoot 'config\AI採掘機.ini'
$toolRoot = Join-Path $repoRoot 'tools\AutoHotkey'
$autoHotkey = Join-Path $toolRoot 'AutoHotkey64.exe'
$ahk2Exe = Join-Path $toolRoot 'Compiler\Ahk2Exe.exe'
$outputExe = Join-Path $distRoot 'ai-miner-win-x64.exe'
$appIcon = Join-Path $buildRoot 'AI採掘機.ico'

if (-not $SkipToolBootstrap) {
    & (Join-Path $PSScriptRoot 'Bootstrap-Tools.ps1')
}

foreach ($requiredFile in @($mainSource, $bridgeSource, $updaterSource, $rootReadme,
        $sourceReadme, $usageGuide, $configTemplate, $autoHotkey,
        $ahk2Exe, $uiWebPackage, $uiWebLock, $uiHostProject, $uiHostLock,
        $stoneSidecarPackage, $stoneSidecarBackendProject, $stoneSidecarTestsProject,
        (Join-Path $stoneSidecarUiRoot 'meta-game.js'),
        (Join-Path $stoneSidecarUiRoot 'meta-game.css'),
        (Join-Path $stoneSidecarUiRoot 'meta-game-template.html'),
        (Join-Path $stoneSidecarRoot 'demo\demo-adapter.js'),
        (Join-Path $integratedMetaRoot 'meta-game-adapter.js'),
        (Join-Path $integratedMetaRoot 'meta-game-entry.js'))) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required build input is missing: $requiredFile"
    }
}

$stoneCatalogNames = @(
    'achievements.json',
    'affinity.json',
    'assets.json',
    'banners.json',
    'gacha.json',
    'items.json',
    'level-rewards.json',
    'messages.json',
    'titles.json'
)
foreach ($catalogName in $stoneCatalogNames) {
    foreach ($catalogPath in @(
            (Join-Path $stoneSidecarDataRoot $catalogName),
            (Join-Path $integratedMetaRoot (Join-Path 'data' $catalogName)))) {
        if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) {
            throw "Required Stone Metagame catalog is missing: $catalogPath"
        }
    }
}

function Assert-SameFileHash {
    param(
        [Parameter(Mandatory)] [string]$ReferencePath,
        [Parameter(Mandatory)] [string]$IntegratedPath
    )

    $referenceHash = (Get-FileHash -LiteralPath $ReferencePath -Algorithm SHA256).Hash
    $integratedHash = (Get-FileHash -LiteralPath $IntegratedPath -Algorithm SHA256).Hash
    if ($referenceHash -cne $integratedHash) {
        throw "Integrated Stone Metagame asset differs from its validated sidecar source: $IntegratedPath"
    }
}

foreach ($uiName in @('meta-game.js', 'meta-game.css', 'meta-game-template.html')) {
    Assert-SameFileHash -ReferencePath (Join-Path $stoneSidecarUiRoot $uiName) `
        -IntegratedPath (Join-Path $integratedMetaRoot $uiName)
}
Assert-SameFileHash -ReferencePath (Join-Path $stoneSidecarRoot 'demo\demo-adapter.js') `
    -IntegratedPath (Join-Path $integratedMetaRoot 'demo-adapter.js')
foreach ($catalogName in $stoneCatalogNames) {
    Assert-SameFileHash -ReferencePath (Join-Path $stoneSidecarDataRoot $catalogName) `
        -IntegratedPath (Join-Path $integratedMetaRoot (Join-Path 'data' $catalogName))
}

$mainText = Get-Content -LiteralPath $mainSource -Raw -Encoding UTF8
$versionMatch = [regex]::Match(
    $mainText,
        '(?m)^\s*(?:global\s+)?AppVersion\s*:?=\s*["''](?<version>(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))["'']'
)
if (-not $versionMatch.Success) {
    throw 'AppVersion was not found in src/mining-auto.ahk.'
}
if ($versionMatch.Groups['version'].Value -ne $Version) {
    throw "Source AppVersion '$($versionMatch.Groups['version'].Value)' does not match requested version '$Version'."
}

function Assert-EmbeddedReleaseVersion {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$ExpectedVersion,
        [hashtable]$AllowedHistoricalContextPatterns = @{}
    )

    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    $matches = [regex]::Matches(
        $text,
        '(?<![0-9])(?<version>[0-9]+\.[0-9]+\.[0-9]+)(?![0-9])'
    )
    if ($matches.Count -eq 0) {
        throw "Release version marker was not found: $Path"
    }

    $approvedHistoricalIndexes = [Collections.Generic.HashSet[int]]::new()
    foreach ($historicalVersion in $AllowedHistoricalContextPatterns.Keys) {
        foreach ($contextPattern in @($AllowedHistoricalContextPatterns[$historicalVersion])) {
            $contextMatches = [regex]::Matches($text, [string]$contextPattern)
            if ($contextMatches.Count -ne 1) {
                throw "Expected one approved '$historicalVersion' history context in '$Path', found $($contextMatches.Count): $contextPattern"
            }
            $context = $contextMatches[0]
            foreach ($candidate in $matches) {
                if ($candidate.Groups['version'].Value -eq $historicalVersion -and
                    $candidate.Index -ge $context.Index -and
                    $candidate.Index -lt ($context.Index + $context.Length)) {
                    [void]$approvedHistoricalIndexes.Add($candidate.Index)
                }
            }
        }
    }

    $mismatches = @(
        $matches |
            Where-Object {
                $_.Groups['version'].Value -ne $ExpectedVersion -and
                -not $approvedHistoricalIndexes.Contains($_.Index)
            } |
            ForEach-Object { $_.Groups['version'].Value } |
            Sort-Object -Unique
    )
    if ($mismatches.Count -ne 0) {
        throw "Embedded version in '$Path' does not match '$ExpectedVersion': $($mismatches -join ', ')"
    }
}

# v9.0.2 introduced the one-time verified-reward history migration. Its version
# is part of the durable compatibility contract and must remain documented even
# after later releases. Keep the exception narrow: every other embedded version
# still has to match this build exactly.
Assert-EmbeddedReleaseVersion -Path $rootReadme -ExpectedVersion $Version `
    -AllowedHistoricalContextPatterns @{
        '9.0.2' = @('v9\.0\.2への初回更新時')
    }
Assert-EmbeddedReleaseVersion -Path $sourceReadme -ExpectedVersion $Version `
    -AllowedHistoricalContextPatterns @{
        '9.0.2' = @('v9\.0\.2以降の意味', 'v9\.0\.2への初回更新時')
    }
Assert-EmbeddedReleaseVersion -Path $usageGuide -ExpectedVersion $Version `
    -AllowedHistoricalContextPatterns @{
        '9.0.2' = @('v9\.0\.2への初回更新時')
    }
Assert-EmbeddedReleaseVersion -Path $configTemplate -ExpectedVersion $Version

$node = Get-Command node.exe -ErrorAction Stop
$nodeVersionText = (& $node.Source --version).Trim().TrimStart('v')
$nodeVersion = $null
if ($LASTEXITCODE -ne 0 -or -not [Version]::TryParse($nodeVersionText, [ref]$nodeVersion) -or
    $nodeVersion.Major -lt 20) {
    throw "Node.js 20 or newer is required; found '$nodeVersionText'."
}

$uiPackage = Get-Content -LiteralPath $uiWebPackage -Raw -Encoding UTF8 | ConvertFrom-Json
if ($uiPackage.version -ne $Version) {
    throw "Web UI version '$($uiPackage.version)' does not match requested version '$Version'."
}
if ($uiPackage.dependencies.framework7 -cne '9.1.3') {
    throw 'package.json must pin Framework7 exactly to 9.1.3.'
}

$lockValidator = @'
const fs = require('node:fs');
const lock = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const root = lock.packages && lock.packages[''];
const framework = lock.packages && lock.packages['node_modules/framework7'];
const valid = lock.lockfileVersion === 3 && root && framework
  && root.version === process.argv[2]
  && root.dependencies && root.dependencies.framework7 === '9.1.3'
  && framework.version === '9.1.3'
  && framework.integrity === 'sha512-1HCK58FbplWdKpHpSiF38H0UaAiCHpGA421ArxMopd5cvKbFg9TD22htYfNZw217QNgSKcw2FDcodUjXfGgOFg==';
if (!valid) process.exit(9);
'@
& $node.Source -e $lockValidator -- $uiWebLock $Version
if ($LASTEXITCODE -ne 0) {
    throw 'package-lock.json does not contain the expected locked Framework7 9.1.3 dependency.'
}

[xml]$uiHostProjectXml = Get-Content -LiteralPath $uiHostProject -Raw -Encoding UTF8
$uiHostProperties = $uiHostProjectXml.Project.PropertyGroup |
    Where-Object { $_.TargetFramework } | Select-Object -First 1
$webViewReference = $uiHostProjectXml.SelectNodes('/Project/ItemGroup/PackageReference') |
    Where-Object { $_.Include -eq 'Microsoft.Web.WebView2' } | Select-Object -First 1
if ($uiHostProperties.TargetFramework -cne 'net48' -or
    $uiHostProperties.PlatformTarget -cne 'x64' -or
    $uiHostProperties.RuntimeIdentifier -cne 'win-x64' -or
    $webViewReference.Version -cne '[1.0.4191.47]') {
    throw 'The UI host must remain a win-x64 net48 application locked to WebView2 SDK 1.0.4191.47.'
}

$uiHostLockData = Get-Content -LiteralPath $uiHostLock -Raw -Encoding UTF8 | ConvertFrom-Json
$uiHostNet48 = $uiHostLockData.dependencies.PSObject.Properties['.NETFramework,Version=v4.8'].Value
$lockedWebView = $uiHostNet48.PSObject.Properties['Microsoft.Web.WebView2'].Value
$uiHostX64 = $uiHostLockData.dependencies.PSObject.Properties['.NETFramework,Version=v4.8/win-x64'].Value
$lockedWebViewX64 = $uiHostX64.PSObject.Properties['Microsoft.Web.WebView2'].Value
if ($lockedWebView.requested -cne '[1.0.4191.47, 1.0.4191.47]' -or
    $lockedWebView.resolved -cne '1.0.4191.47' -or
    $lockedWebView.contentHash -cne 'Snb6mlTpuz6ZFjWMwIdg28Xp6kAUMy3zaLUyGbFSaw+/AJKlwoX8EiaWJ1eUMfKyJHksPkFjJHl1LIB7kX+0AQ==' -or
    $lockedWebViewX64.requested -cne '[1.0.4191.47, 1.0.4191.47]' -or
    $lockedWebViewX64.resolved -cne '1.0.4191.47' -or
    $lockedWebViewX64.contentHash -cne $lockedWebView.contentHash) {
    throw 'packages.lock.json does not lock WebView2 SDK exactly to 1.0.4191.47.'
}

if (Test-Path -LiteralPath $stageRoot) {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
if (Test-Path -LiteralPath $distRoot) {
    Remove-Item -LiteralPath $distRoot -Recurse -Force
}
if (Test-Path -LiteralPath $uiHostOutput) {
    Remove-Item -LiteralPath $uiHostOutput -Recurse -Force
}
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
New-Item -ItemType Directory -Path $uiHostOutput -Force | Out-Null
& (Join-Path $PSScriptRoot 'Build-AppIcon.ps1') -Output $appIcon | Out-Null
if (-not (Test-Path -LiteralPath $appIcon -PathType Leaf)) {
    throw 'Application icon generation failed.'
}

$stagedMain = Join-Path $stageRoot 'mining-auto.ahk'
Copy-Item -LiteralPath $mainSource -Destination $stagedMain -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'exe-route-navigation.ahk') -Destination $stageRoot -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'wash-position.ahk') -Destination $stageRoot -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'stationary-only.ahk') -Destination $stageRoot -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'fast-wash.ahk') -Destination $stageRoot -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'nearby-wash.ahk') -Destination $stageRoot -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'diagnostics.ahk') -Destination $stageRoot -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'audio') -Destination $stageRoot -Recurse -Force
$assetRoot = Join-Path $sourceRoot 'assets'
if (Test-Path -LiteralPath $assetRoot -PathType Container) {
    Get-ChildItem -LiteralPath $assetRoot -File | Copy-Item -Destination $stageRoot -Force
}

$frameworkCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$csc = $frameworkCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $csc) {
    throw '.NET Framework C# compiler v4 was not found.'
}

function Invoke-CSharpBuild {
    param(
        [Parameter(Mandatory)] [string]$Source,
        [Parameter(Mandatory)] [string]$Output
    )

    $arguments = @(
        '/nologo',
        '/target:winexe',
        '/platform:anycpu',
        '/optimize+',
        '/debug-',
        '/warnaserror+',
        "/out:$Output",
        '/reference:System.dll',
        '/reference:System.Core.dll',
        '/reference:System.Web.Extensions.dll',
        '/reference:System.Drawing.dll',
        '/reference:System.Windows.Forms.dll',
        '/reference:System.IO.Compression.dll',
        '/reference:System.IO.Compression.FileSystem.dll',
        $Source
    )
    & $csc @arguments
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Output -PathType Leaf)) {
        throw "C# compilation failed: $Source"
    }
}

function Invoke-CapabilitySmokeTest {
    param(
        [Parameter(Mandatory)] [string]$Executable,
        [Parameter(Mandatory)] [string]$Expected,
        [ValidateSet('capabilities', 'self-test')] [string]$Mode = 'capabilities'
    )

    $resultPath = Join-Path $stageRoot ([System.IO.Path]::GetFileNameWithoutExtension($Executable) + '-' + $Mode + '.txt')
    if (Test-Path -LiteralPath $resultPath) { Remove-Item -LiteralPath $resultPath -Force }

    $argumentLine = $Mode + ' "' + $resultPath.Replace('"', '""') + '"'
    $process = Start-Process -FilePath $Executable -ArgumentList $argumentLine -PassThru -WindowStyle Hidden
    if (-not $process.WaitForExit(15000)) {
        try { $process.Kill() } catch { }
        throw "Capability smoke test timed out: $Executable"
    }
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
        throw "Capability smoke test failed: $Executable (exit $($process.ExitCode))"
    }

    $actual = (Get-Content -LiteralPath $resultPath -Raw -Encoding UTF8).Trim()
    if ($actual -ne $Expected) {
        throw "Unexpected capability response from $Executable. Expected '$Expected', got '$actual'."
    }
}

$bridgeOutput = Join-Path $stageRoot 'AI採掘機_Background.exe'
$updaterOutput = Join-Path $stageRoot 'AI採掘機_Updater.exe'
Invoke-CSharpBuild -Source $bridgeSource -Output $bridgeOutput
Invoke-CSharpBuild -Source $updaterSource -Output $updaterOutput
$diagnosticsOutput = Join-Path $stageRoot 'Diagnostics.exe'
Invoke-CSharpBuild -Source (Join-Path $sourceRoot 'diagnostics\Diagnostics.cs') -Output $diagnosticsOutput
Invoke-CapabilitySmokeTest -Executable $diagnosticsOutput -Expected 'SELFTEST OK' -Mode 'self-test'
$washPositionOutput = Join-Path $stageRoot 'WashPosition.exe'
Invoke-CSharpBuild -Source (Join-Path $sourceRoot 'wash-position\WashPosition.cs') -Output $washPositionOutput
Invoke-CapabilitySmokeTest -Executable $washPositionOutput -Expected 'SELFTEST OK' -Mode 'self-test'
$localNavOutput = Join-Path $stageRoot 'LocalNavigation.exe'
Invoke-CSharpBuild -Source (Join-Path $sourceRoot 'local-navigation\LocalNavigation.cs') -Output $localNavOutput
Invoke-CapabilitySmokeTest -Executable $localNavOutput -Expected 'SELFTEST OK' -Mode 'self-test'
& (Join-Path $PSScriptRoot 'Test-ExeRoutes.ps1') -SourcePath $mainSource
& (Join-Path $PSScriptRoot 'Test-CameraRecoveryContract.ps1') -SourcePath $mainSource
& (Join-Path $PSScriptRoot 'Test-WashRecoveryContract.ps1') -SourcePath $mainSource
& (Join-Path $PSScriptRoot 'Test-StationaryWait.ps1')
& (Join-Path $PSScriptRoot 'Test-FastWashRuntime.ps1')
& (Join-Path $PSScriptRoot 'Test-FastWashContract.ps1')
& (Join-Path $PSScriptRoot 'Test-FarmRecoverySafetyContract.ps1') -SourcePath $mainSource
& (Join-Path $PSScriptRoot 'Test-StorageClosedLoopContract.ps1') `
    -SourcePath $mainSource -BridgeSourcePath $bridgeSource
& (Join-Path $PSScriptRoot 'Test-StoneProgressContract.ps1') -SourcePath $mainSource
& (Join-Path $PSScriptRoot 'Test-WashDomExpressions.ps1') -Bridge $bridgeOutput
Invoke-CapabilitySmokeTest -Executable $bridgeOutput -Expected 'CAPS 12 MINE WASH GOLD NUDGE STORAGE INVENTORY ROUTE TRY VIEW HOTBAR INVENTORYKEY HEALTH COMPANION ACTIONWAIT REFILL'
Invoke-CapabilitySmokeTest -Executable $bridgeOutput -Expected 'SELFTEST OK' -Mode 'self-test'
& (Join-Path $PSScriptRoot 'Test-BackgroundBridge.ps1') -Bridge $bridgeOutput
Invoke-CapabilitySmokeTest -Executable $updaterOutput -Expected 'UPDATE_CAPS 1 CHECK CATALOG SELECT DOWNLOAD APPLY'
& (Join-Path $PSScriptRoot 'Test-UpdateCatalog.ps1')

$npm = Get-Command npm.cmd -ErrorAction Stop
Push-Location $stoneSidecarRoot
try {
    & $npm.Source test
    if ($LASTEXITCODE -ne 0) { throw 'Validated Stone Metagame Node tests failed.' }
    foreach ($scriptPath in @(
            (Join-Path $stoneSidecarUiRoot 'meta-game.js'),
            (Join-Path $stoneSidecarRoot 'demo\demo-adapter.js'),
            (Join-Path $stoneSidecarRoot 'scripts\serve.mjs'))) {
        & $node.Source --check $scriptPath
        if ($LASTEXITCODE -ne 0) { throw "Stone Metagame JavaScript check failed: $scriptPath" }
    }
}
finally {
    Pop-Location
}

Push-Location $stoneverseRoot
try {
    & $npm.Source ci --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed for STONEVERSE.' }
    & $npm.Source run build:host
    if ($LASTEXITCODE -ne 0) { throw 'STONEVERSE Farm host bridge build failed.' }
    & $npm.Source run build
    if ($LASTEXITCODE -ne 0) { throw 'STONEVERSE application build failed.' }
}
finally {
    Pop-Location
}

Push-Location $uiWebRoot
try {
    & $npm.Source ci --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed for the offline UI.' }
    & $npm.Source run build
    if ($LASTEXITCODE -ne 0) { throw 'Web UI build failed.' }
    & $npm.Source run check
    if ($LASTEXITCODE -ne 0) { throw 'Web UI checks failed.' }
}
finally {
    Pop-Location
}

$dotnet = Get-Command dotnet.exe -ErrorAction Stop
New-Item -ItemType Directory -Path $nugetPackageRoot -Force | Out-Null
& $dotnet.Source restore $stoneSidecarTestsProject --packages $nugetPackageRoot
if ($LASTEXITCODE -ne 0) { throw 'Stone Metagame backend test restore failed.' }
& $dotnet.Source run --project $stoneSidecarTestsProject --configuration Release --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Validated Stone Metagame backend tests failed.' }
& $dotnet.Source restore $uiHostProject --locked-mode --packages $nugetPackageRoot
if ($LASTEXITCODE -ne 0) { throw 'Locked UI host restore failed.' }
& $dotnet.Source build $uiHostProject --configuration Release --no-restore `
    --output $uiHostOutput -p:TreatWarningsAsErrors=true -p:ApplicationIcon=$appIcon
if ($LASTEXITCODE -ne 0) { throw 'UI host build failed.' }

$uiHostExecutable = Join-Path $uiHostOutput 'AiMiner.UiHost.exe'
$uiHostConfig = $uiHostExecutable + '.config'
$uiCore = Join-Path $uiHostOutput 'Microsoft.Web.WebView2.Core.dll'
$uiWinForms = Join-Path $uiHostOutput 'Microsoft.Web.WebView2.WinForms.dll'
$uiLoader = Join-Path $uiHostOutput 'WebView2Loader.dll'
if (-not (Test-Path -LiteralPath $uiLoader -PathType Leaf)) {
    $uiLoader = Join-Path $uiHostOutput 'runtimes\win-x64\native\WebView2Loader.dll'
}
foreach ($uiFile in @($uiHostExecutable, $uiHostConfig, $uiCore, $uiWinForms, $uiLoader,
        (Join-Path $uiWebOutput 'index.html'), (Join-Path $uiWebOutput 'app.css'),
        (Join-Path $uiWebOutput 'app.js'), (Join-Path $uiWebOutput 'build-info.json'),
        (Join-Path $uiWebOutput 'stoneverse-host.js'),
        (Join-Path $uiWebOutput 'stoneverse\index.html'),
        (Join-Path $uiWebOutput 'vendor\framework7-bundle.min.css'),
        (Join-Path $uiWebOutput 'vendor\framework7-bundle.min.js'),
        (Join-Path $uiWebOutput 'metagame\meta-game.js'),
        (Join-Path $uiWebOutput 'metagame\meta-game.css'),
        (Join-Path $uiWebOutput 'metagame\meta-game-template.html'),
        (Join-Path $uiWebOutput 'metagame\meta-game-adapter.js'),
        (Join-Path $uiWebOutput 'metagame\meta-game-entry.js'))) {
    if (-not (Test-Path -LiteralPath $uiFile -PathType Leaf)) {
        throw "Required UI build output is missing: $uiFile"
    }
}

$expectedUiFiles = @(
    'app.css',
    'app.js',
    'build-info.json',
    'index.html',
    'stoneverse-host.js',
    'metagame/data/achievements.json',
    'metagame/data/affinity.json',
    'metagame/data/assets.json',
    'metagame/data/banners.json',
    'metagame/data/gacha.json',
    'metagame/data/items.json',
    'metagame/data/level-rewards.json',
    'metagame/data/messages.json',
    'metagame/data/titles.json',
    'metagame/demo-adapter.js',
    'metagame/meta-game-adapter.js',
    'metagame/meta-game-entry.js',
    'metagame/meta-game-template.html',
    'metagame/meta-game.css',
    'metagame/meta-game.js',
    'vendor/framework7-bundle.min.css',
    'vendor/framework7-bundle.min.js'
)
$stoneverseOutputPrefix = (Join-Path $stoneverseRoot 'dist').TrimEnd('\', '/') `
    + [IO.Path]::DirectorySeparatorChar
$expectedUiFiles += @(
    Get-ChildItem -LiteralPath (Join-Path $stoneverseRoot 'dist') -Recurse -File |
        ForEach-Object {
            'stoneverse/' + $_.FullName.Substring($stoneverseOutputPrefix.Length).Replace('\', '/')
        }
)
$expectedUiFiles = @($expectedUiFiles | Sort-Object)
$uiOutputPrefix = $uiWebOutput.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
$actualUiFiles = @(
    Get-ChildItem -LiteralPath $uiWebOutput -Recurse -File |
        ForEach-Object { $_.FullName.Substring($uiOutputPrefix.Length).Replace('\', '/') } |
        Sort-Object
)
if ($actualUiFiles.Count -ne $expectedUiFiles.Count -or
    (Compare-Object -ReferenceObject $expectedUiFiles -DifferenceObject $actualUiFiles -CaseSensitive)) {
    throw 'Offline UI output contains missing or unexpected files.'
}

$uiBuildInfo = Get-Content -LiteralPath (Join-Path $uiWebOutput 'build-info.json') -Raw -Encoding UTF8 |
    ConvertFrom-Json
if ([int]$uiBuildInfo.schema -ne 1 -or $uiBuildInfo.version -ne $Version -or
    $uiBuildInfo.framework -cne 'Framework7' -or
    $uiBuildInfo.frameworkVersion -cne '9.1.3' -or $uiBuildInfo.offline -ne $true -or
    [int]$uiBuildInfo.metagame.schemaVersion -ne 2 -or
    [int]$uiBuildInfo.metagame.catalogFiles -ne 9 -or
    [int]$uiBuildInfo.stoneverse.schemaVersion -ne 5 -or
    [int]$uiBuildInfo.stoneverse.hostProtocol -ne 1) {
    throw 'Offline UI build metadata is inconsistent with this release.'
}

function Assert-X64PortableExecutable {
    param([Parameter(Mandatory)] [string]$Path)

    [byte[]]$bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 256 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a) {
        throw "Not a valid Windows executable: $Path"
    }
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    if ($peOffset -lt 0 -or $peOffset + 6 -gt $bytes.Length -or
        [BitConverter]::ToUInt32($bytes, $peOffset) -ne 0x00004550 -or
        [BitConverter]::ToUInt16($bytes, $peOffset + 4) -ne 0x8664) {
        throw "Executable is not x64 PE32+: $Path"
    }
}

Assert-X64PortableExecutable -Path $uiHostExecutable
Assert-X64PortableExecutable -Path $uiLoader

$uiTestResult = Join-Path $stageRoot 'ui-host-test.txt'
$uiArgumentLine = '--self-test "' + $uiTestResult.Replace('"', '""') `
    + '" --assets "' + $uiWebOutput.Replace('"', '""') + '"'
$uiTestProcess = Start-Process -FilePath $uiHostExecutable -ArgumentList $uiArgumentLine `
    -PassThru -WindowStyle Hidden
if (-not $uiTestProcess.WaitForExit(60000)) {
    try { $uiTestProcess.Kill() } catch { }
    throw 'UI host self-test timed out.'
}
$uiTestFailed = $uiTestProcess.ExitCode -ne 0 `
    -or -not (Test-Path -LiteralPath $uiTestResult -PathType Leaf) `
    -or (Get-Content -LiteralPath $uiTestResult -Raw -Encoding UTF8).Trim() -ne 'SELFTEST OK'
if ($uiTestFailed) {
    $uiTestDetail = if (Test-Path -LiteralPath $uiTestResult -PathType Leaf) {
        (Get-Content -LiteralPath $uiTestResult -Raw -Encoding UTF8).Trim()
    } else {
        'result file was not created'
    }
    throw "UI host self-test failed: $uiTestDetail"
}

$uiRuntimeHost = Join-Path $stageRoot 'ui-runtime\host'
$uiRuntimeWeb = Join-Path $stageRoot 'ui-runtime\web'
New-Item -ItemType Directory -Path $uiRuntimeHost -Force | Out-Null
New-Item -ItemType Directory -Path $uiRuntimeWeb -Force | Out-Null
Copy-Item -LiteralPath $uiHostExecutable -Destination $uiRuntimeHost -Force
Copy-Item -LiteralPath $uiHostConfig -Destination $uiRuntimeHost -Force
Copy-Item -LiteralPath $uiCore -Destination $uiRuntimeHost -Force
Copy-Item -LiteralPath $uiWinForms -Destination $uiRuntimeHost -Force
Copy-Item -LiteralPath $uiLoader -Destination (Join-Path $uiRuntimeHost 'WebView2Loader.dll') -Force
Copy-Item -Path (Join-Path $uiWebOutput '*') -Destination $uiRuntimeWeb -Recurse -Force

# Ahk2Exe only embeds literal FileInstall sources. Generate those declarations in
# the staged script from the complete, strictly validated STONEVERSE output so
# hashed Vite filenames cannot be omitted from a future release executable.
$stoneverseEmbeddedFiles = @(Get-ChildItem -LiteralPath $uiWebOutput -Recurse -File |
    Where-Object {
        $relative = [System.IO.Path]::GetRelativePath($uiWebOutput, $_.FullName)
        $relative -ceq 'stoneverse-host.js' -or
            $relative.StartsWith('stoneverse' + [System.IO.Path]::DirectorySeparatorChar,
                [StringComparison]::Ordinal)
    } | Sort-Object FullName)
if ($stoneverseEmbeddedFiles.Count -lt 2) {
    throw 'STONEVERSE offline files were not available for executable embedding.'
}
$stoneverseInstallLines = [Collections.Generic.List[string]]::new()
$stoneverseDirectories = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($file in $stoneverseEmbeddedFiles) {
    $relative = [System.IO.Path]::GetRelativePath($uiWebOutput, $file.FullName).Replace('/', '\')
    $directory = [System.IO.Path]::GetDirectoryName($relative)
    if (-not [String]::IsNullOrEmpty($directory) -and $stoneverseDirectories.Add($directory)) {
        $stoneverseInstallLines.Add(('        DirCreate State.uiAssetsPath "\{0}"' -f $directory))
    }
    $stoneverseInstallLines.Add(('        FileInstall "ui-runtime\web\{0}", State.uiAssetsPath "\{0}", true' -f $relative))
}
$stagedMainText = [System.IO.File]::ReadAllText($stagedMain)
$stoneverseMarker = '        ;@BUILD_STONEVERSE_FILEINSTALLS'
if ($stagedMainText.IndexOf($stoneverseMarker, [StringComparison]::Ordinal) -lt 0) {
    throw 'The staged controller is missing its STONEVERSE embedding marker.'
}
$stagedMainText = $stagedMainText.Replace($stoneverseMarker,
    ($stoneverseInstallLines -join [Environment]::NewLine))
[System.IO.File]::WriteAllText($stagedMain, $stagedMainText,
    [System.Text.UTF8Encoding]::new($true))

Push-Location $stageRoot
try {
    $quotedMain = '"' + $stagedMain + '"'
    $quotedOutput = '"' + $outputExe + '"'
    $quotedBase = '"' + $autoHotkey + '"'
    $quotedIcon = '"' + $appIcon + '"'
    $compilerSucceeded = $false
    foreach ($compilerAttempt in 1..2) {
        $compilerStdout = Join-Path $stageRoot "ahk2exe-attempt-$compilerAttempt.stdout.log"
        $compilerStderr = Join-Path $stageRoot "ahk2exe-attempt-$compilerAttempt.stderr.log"
        if (Test-Path -LiteralPath $outputExe -PathType Leaf) {
            Remove-Item -LiteralPath $outputExe -Force
        }
        Write-Host "Compiling the self-contained AutoHotkey application (attempt $compilerAttempt/2)..."
        $compilerProcess = Start-Process -FilePath $ahk2Exe `
            -ArgumentList @('/in', $quotedMain, '/out', $quotedOutput, '/base', $quotedBase,
                '/icon', $quotedIcon, '/compress', '0', '/silent', 'verbose') `
            -PassThru -WindowStyle Hidden -RedirectStandardOutput $compilerStdout `
            -RedirectStandardError $compilerStderr
        if ($null -eq $compilerProcess) {
            throw 'Ahk2Exe did not return a process handle.'
        }
        # Windows PowerShell 5.1 can lose the native process handle when a very
        # short-lived Start-Process child exits before ExitCode is queried. Force
        # handle materialisation while the compiler is alive so ExitCode remains
        # available after WaitForExit, including when stdout/stderr are redirected.
        $compilerHandle = $compilerProcess.Handle
        if ($compilerHandle -eq [IntPtr]::Zero) {
            throw 'Ahk2Exe returned an invalid native process handle.'
        }
        Write-Host "Ahk2Exe started (PID $($compilerProcess.Id))."
        $compilerTimedOut = -not $compilerProcess.WaitForExit(120000)
        $compilerExitCode = $null
        if ($compilerTimedOut) {
            $compilerPid = $compilerProcess.Id
            try { $compilerProcess.Kill($true) }
            catch {
                # Process.Kill(Boolean) is unavailable on Windows PowerShell 5.1.
                # taskkill is scoped to the exact compiler PID and its child validator.
                try {
                    $taskKill = Join-Path $env:SystemRoot 'System32\taskkill.exe'
                    & $taskKill /PID $compilerPid /T /F | Out-Null
                }
                catch { try { $compilerProcess.Kill() } catch { } }
            }
            try { [void]$compilerProcess.WaitForExit(5000) } catch { }
        } else {
            # On Windows PowerShell 5.1, Start-Process with redirected streams can
            # leave ExitCode unpopulated after only WaitForExit(Int32). The second
            # parameterless wait drains the async stream handlers, and Refresh
            # makes the native process result available deterministically.
            $compilerProcess.WaitForExit()
            $compilerProcess.Refresh()
            $compilerExitCode = $compilerProcess.ExitCode
            Write-Host "Ahk2Exe exited with code $compilerExitCode."
        }

        $compilerStdoutText = ''
        $compilerStderrText = ''
        if (Test-Path -LiteralPath $compilerStdout -PathType Leaf) {
            $compilerStdoutText = [Convert]::ToString(
        (Get-Content -LiteralPath $compilerStdout -Raw -Encoding UTF8))
        }
        if (Test-Path -LiteralPath $compilerStderr -PathType Leaf) {
            $compilerStderrText = [Convert]::ToString(
        (Get-Content -LiteralPath $compilerStderr -Raw -Encoding UTF8))
        }
        $compilerOutput = @($compilerStdoutText, $compilerStderrText) |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object { $_.Trim() }
        if ($compilerOutput) {
            Write-Host ($compilerOutput -join [Environment]::NewLine)
        }

        if ($compilerTimedOut) {
            if ($compilerAttempt -lt 2) {
                Write-Warning 'Ahk2Exe timed out after 120 seconds; retrying once with a fresh process.'
                Start-Sleep -Milliseconds 500
                continue
            }
            throw 'Ahk2Exe compilation timed out twice after 120 seconds per attempt.'
        }
        if ($null -eq $compilerExitCode -or $compilerExitCode -ne 0 -or
            -not (Test-Path -LiteralPath $outputExe -PathType Leaf)) {
            throw "Ahk2Exe compilation failed with exit code $compilerExitCode."
        }
        $compilerSucceeded = $true
        break
    }
    if (-not $compilerSucceeded) {
        throw 'Ahk2Exe compilation did not produce an executable.'
    }
    Write-Host 'AutoHotkey compilation completed.'
}
finally {
    Pop-Location
}

& (Join-Path $PSScriptRoot 'Test-StoneBackfillExecutable.ps1') `
    -ExecutablePath $outputExe

$smokeDiagnosticPath = Join-Path (Split-Path -Parent $outputExe) 'AI採掘機_診断.log'
$smokeDiagnosticSentinel = 'AIMINER_UPDATER_TEST_MUST_PRESERVE_THIS_DIAGNOSTIC'
if (Test-Path -LiteralPath $smokeDiagnosticPath) {
    throw "Unexpected diagnostic test target already exists: $smokeDiagnosticPath"
}
[System.IO.File]::WriteAllText($smokeDiagnosticPath, $smokeDiagnosticSentinel,
    [System.Text.UTF8Encoding]::new($false))
try {
    foreach ($testMode in @('--validate', '--smoke-test')) {
        $testStdout = Join-Path $stageRoot ($testMode.TrimStart('-') + '.stdout.log')
        $testStderr = Join-Path $stageRoot ($testMode.TrimStart('-') + '.stderr.log')
        $testProcess = Start-Process -FilePath $outputExe -ArgumentList $testMode -PassThru -WindowStyle Hidden -RedirectStandardOutput $testStdout -RedirectStandardError $testStderr
        # A cold WebView2 profile may consume most of the app's own 27-second
        # handshake + smoke window on slower PCs. Keep validation strict but give
        # the full UI round-trip enough wall-clock headroom.
        $testTimeoutMs = if ($testMode -eq '--smoke-test') { 60000 } else { 30000 }
        if (-not $testProcess.WaitForExit($testTimeoutMs)) {
            try { $testProcess.Kill() } catch { }
            throw "Compiled application $testMode timed out."
        }
        if ($testProcess.ExitCode -ne 0) {
            $detail = if (Test-Path $testStderr) { Get-Content $testStderr -Raw } else { '' }
            throw "Compiled application $testMode failed with exit code $($testProcess.ExitCode): $detail"

        }
        if (-not (Test-Path -LiteralPath $smokeDiagnosticPath -PathType Leaf) -or
            [System.IO.File]::ReadAllText($smokeDiagnosticPath) -cne
                $smokeDiagnosticSentinel) {
            throw "Compiled application $testMode modified the install diagnostic log."
        }
    }
}
finally {
    Remove-Item -LiteralPath $smokeDiagnosticPath -Force -ErrorAction SilentlyContinue
}

# Match the installed GUI updater, not only CI with redirected streams.
& (Join-Path $PSScriptRoot 'Test-UpdateStartup.ps1') -ExecutablePath $outputExe

Assert-X64PortableExecutable -Path $outputExe
$expectedPeVersion = [Version]::Parse($Version)
$peVersionInfo = [Diagnostics.FileVersionInfo]::GetVersionInfo($outputExe)
foreach ($versionField in @('FileVersion', 'ProductVersion')) {
    $rawVersion = [string]$peVersionInfo.$versionField
    $parsedVersion = $null
    if (-not [Version]::TryParse($rawVersion, [ref]$parsedVersion) -or
        $parsedVersion.Major -ne $expectedPeVersion.Major -or
        $parsedVersion.Minor -ne $expectedPeVersion.Minor -or
        $parsedVersion.Build -ne $expectedPeVersion.Build) {
        throw "Compiled executable $versionField '$rawVersion' does not match '$Version'."
    }
}
$distFiles = @(Get-ChildItem -LiteralPath $distRoot -Recurse -File)
if ($distFiles.Count -ne 1 -or $distFiles[0].FullName -cne $outputExe) {
    throw 'The build output must contain one self-contained application executable only.'
}

$builtFile = Get-Item -LiteralPath $outputExe
if ($builtFile.Length -lt 100KB -or $builtFile.Length -gt 30MB) {
    throw "Compiled executable size is outside the release policy: $($builtFile.Length) bytes."
}

Write-Host "Build and smoke tests passed: $outputExe"
[pscustomobject]@{
    Version = $Version
    Executable = $outputExe
    Size = $builtFile.Length
    Sha256 = (Get-FileHash -LiteralPath $outputExe -Algorithm SHA256).Hash.ToLowerInvariant()
}
