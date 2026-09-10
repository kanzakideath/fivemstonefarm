#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('ai-miner-ui-tests-' + [Guid]::NewGuid().ToString('N'))
$fixtureHost = Join-Path $PSScriptRoot 'fixtures\FixtureHost.ps1'
$suiteScript = Join-Path $PSScriptRoot 'Invoke-UiVisualTests.ps1'
$sequenceScript = Join-Path $PSScriptRoot 'Capture-WindowSequence.ps1'
$powerShellPath = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
$appTitle = ('"AI\u63a1\u6398\u6a5f"' | ConvertFrom-Json)
$appTitlePattern = '^' + [regex]::Escape($appTitle) + '$'
$baseline = $null
$mutator = $null

try {
    [void](New-Item -ItemType Directory -Path $testRoot)
    $assetRoot = Join-Path $testRoot 'web-assets'
    [void](New-Item -ItemType Directory -Path $assetRoot)
    $assetFile = Join-Path $assetRoot 'index.html'
    [IO.File]::WriteAllText($assetFile, '<!doctype html><title>fixture</title>', [Text.Encoding]::UTF8)

    # A pre-existing, same-title process proves the suite filters by the PID it
    # launches and never closes another same-title application window.
    $baseline = Start-Process -FilePath $powerShellPath -ArgumentList @(
        '-NoLogo', '-NoProfile', '-STA', '-File', ('"' + $fixtureHost + '"'),
        '--window-title', $appTitle, '--fixture', 'overview',
        '--window-width', '420', '--window-height', '420'
    ) -PassThru
    Start-Sleep -Milliseconds 600
    if ($baseline.HasExited) { throw 'The baseline fixture exited before the test began.' }

    $suiteArguments = @(
        '-NoLogo', '-NoProfile', '-STA', '-File', $fixtureHost,
        '--window-title', ($appTitle + ' READY'), '--visual-test', '--assets', $assetRoot
    )
    $suite = & $suiteScript -ExecutablePath $powerShellPath -OutputDirectory (Join-Path $testRoot 'captures') `
        -BaseArguments $suiteArguments -ReadyDelayMilliseconds 250
    if (-not $suite.passed -or $suite.captures.Count -ne 13) {
        throw 'The fixture suite did not produce all thirteen expected captures.'
    }
    if (-not $suite.webAssets.unchangedAtEnd -or
        $suite.webAssets.manifestSha256AtStart -ne $suite.webAssets.manifestSha256AtEnd -or
        @($suite.webAssets.files).Count -ne 1 -or
        $suite.webAssets.files[0].relativePath -ne 'index.html') {
        throw 'The fixture suite did not record and re-verify its Web asset manifest.'
    }
    if ($baseline.HasExited) {
        throw 'The suite incorrectly closed the pre-existing same-title process.'
    }

    $sequence = & $sequenceScript -ProcessId $baseline.Id -WindowTitlePattern $appTitlePattern `
        -OutputDirectory (Join-Path $testRoot 'sequence') -DurationSeconds 1 -FramesPerSecond 3
    if ($sequence.frames.Count -ne 3 -or $sequence.desktopFallbackUsed) {
        throw 'The window-only frame sequence did not produce its expected three frames.'
    }

    Add-Type -AssemblyName System.Drawing
    foreach ($capture in $suite.captures) {
        if (-not (Test-Path -LiteralPath $capture.png -PathType Leaf)) {
            throw "Missing capture: $($capture.png)"
        }
        $bitmap = [Drawing.Bitmap]::FromFile($capture.png)
        try {
            if ($bitmap.Width -lt 300 -or $bitmap.Height -lt 300) {
                throw "Capture is unexpectedly small: $($capture.png)"
            }
        }
        finally {
            $bitmap.Dispose()
        }
    }
    $wideCapture = @($suite.captures | Where-Object { $_.scenario -eq 'overview' })[0]
    $narrowCapture = @($suite.captures | Where-Object { $_.scenario -eq 'narrow' })[0]
    $stoneNarrowCapture = @($suite.captures | Where-Object { $_.scenario -eq 'stone-narrow' })[0]
    $stoneCollectionCapture = @($suite.captures | Where-Object { $_.scenario -eq 'stone-collection' })[0]
    $stoneAchievementsCapture = @($suite.captures | Where-Object { $_.scenario -eq 'stone-achievements' })[0]
    $vehicleCapture = @($suite.captures | Where-Object { $_.scenario -eq 'vehicle' })[0]
    $updateCapture = @($suite.captures | Where-Object { $_.scenario -eq 'update' })[0]
    if ($wideCapture.imageWidth -lt 780 -or $wideCapture.imageWidth -gt 900 -or
        $narrowCapture.imageWidth -lt 480 -or $narrowCapture.imageWidth -gt 600 -or
        $stoneNarrowCapture.imageWidth -lt 560 -or $stoneNarrowCapture.imageWidth -gt 680 -or
        -not $stoneCollectionCapture -or -not $stoneAchievementsCapture -or
        -not $vehicleCapture -or -not $updateCapture) {
        throw 'DPI coordinate conversion produced an unexpected fixture width.'
    }

    # Chromium's forced device scale shrinks the CSS viewport unless the host
    # client surface grows by the same factor. Verify that the harness preserves
    # the manifest's logical dimensions instead of capturing only its top-left.
    $scaleManifestPath = Join-Path $testRoot 'scale-scenario.json'
    [ordered]@{
        schemaVersion = 1
        baseArguments = @('--visual-test')
        windowTitlePattern = '^' + [regex]::Escape($appTitle + ' READY') + '$'
        scenarios = @([ordered]@{
            name = 'scaled'
            arguments = @('--fixture', 'overview', '--window-width', '420', '--window-height', '420')
        })
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $scaleManifestPath -Encoding UTF8
    $scaleSuite = & $suiteScript -ExecutablePath $powerShellPath `
        -OutputDirectory (Join-Path $testRoot 'scale-captures') `
        -ManifestPath $scaleManifestPath -BaseArguments $suiteArguments `
        -WebViewScaleFactors 1,1.5,2 -ReadyDelayMilliseconds 250
    if (-not $scaleSuite.passed -or $scaleSuite.captures.Count -ne 3) {
        throw 'The scaled fixture suite did not produce all three captures.'
    }
    $expectedLaunchWidths = @{ '1' = 420; '1.5' = 630; '2' = 840 }
    foreach ($capture in $scaleSuite.captures) {
        $scaleKey = ([double]$capture.webViewScaleFactor).ToString('0.0#',
            [Globalization.CultureInfo]::InvariantCulture).TrimEnd('0').TrimEnd('.')
        $expectedWidth = $expectedLaunchWidths[$scaleKey]
        if (-not $expectedWidth -or $capture.logicalWindow.width -ne 420 -or
            $capture.logicalWindow.height -ne 420 -or
            $capture.launchWindow.width -ne $expectedWidth -or
            $capture.launchWindow.height -ne $expectedWidth -or
            $capture.launchWindow.widthCapped -or $capture.launchWindow.heightCapped -or
            [Math]::Abs($capture.imageWidth - $expectedWidth) -gt 100) {
            throw "The visual suite did not preserve the 420px logical viewport at scale $scaleKey."
        }
    }

    # Prove that an asset mutation after the initial snapshot makes the suite fail
    # closed and leaves both hashes in suite.json for diagnosis.
    $mutationManifestPath = Join-Path $testRoot 'mutation-scenario.json'
    [ordered]@{
        schemaVersion = 1
        baseArguments = @('--visual-test')
        windowTitlePattern = '^' + [regex]::Escape($appTitle + ' READY') + '$'
        scenarios = @([ordered]@{
            name = 'overview'
            arguments = @('--fixture', 'overview', '--window-width', '420', '--window-height', '420')
        })
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $mutationManifestPath -Encoding UTF8
    [IO.File]::WriteAllText($assetFile, 'before', [Text.Encoding]::UTF8)
    $escapedAssetFile = $assetFile.Replace("'", "''")
    $mutationCommand = "Start-Sleep -Milliseconds 800; [IO.File]::WriteAllText('$escapedAssetFile', 'after', [Text.Encoding]::UTF8)"
    $encodedMutationCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($mutationCommand))
    $mutator = Start-Process -FilePath $powerShellPath -ArgumentList @(
        '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', $encodedMutationCommand
    ) -PassThru -WindowStyle Hidden
    $mutationFailedClosed = $false
    try {
        & $suiteScript -ExecutablePath $powerShellPath `
            -OutputDirectory (Join-Path $testRoot 'mutation-captures') `
            -ManifestPath $mutationManifestPath -BaseArguments $suiteArguments `
            -ReadyDelayMilliseconds 1400 | Out-Null
    }
    catch {
        $mutationFailedClosed = $_.Exception.Message -like '*Web assets changed*'
    }
    if (-not $mutator.WaitForExit(5000) -or $mutator.ExitCode -ne 0) {
        throw 'The Web asset mutator fixture did not finish successfully.'
    }
    $mutator.Dispose()
    $mutator = $null
    $mutationSuite = Get-Content -LiteralPath (Join-Path $testRoot 'mutation-captures\suite.json') -Raw |
        ConvertFrom-Json
    if (-not $mutationFailedClosed -or $mutationSuite.passed -or $mutationSuite.webAssets.unchangedAtEnd -or
        $mutationSuite.webAssets.manifestSha256AtStart -eq $mutationSuite.webAssets.manifestSha256AtEnd -or
        -not @($mutationSuite.errors | Where-Object { $_.scenario -eq 'web-assets' })) {
        throw 'The visual suite did not fail closed after a mid-run Web asset mutation.'
    }

    [pscustomobject]@{
        passed = $true
        captures = $suite.captures.Count
        scaledCaptures = $scaleSuite.captures.Count
        assetManifestFiles = @($suite.webAssets.files).Count
        assetMutationRejected = $mutationFailedClosed
        sequenceFrames = $sequence.frames.Count
        preExistingProcessSurvived = -not $baseline.HasExited
        temporaryArtifacts = $testRoot
    }
}
finally {
    if ($mutator) {
        try {
            if (-not $mutator.HasExited) { $mutator.Kill(); [void]$mutator.WaitForExit(3000) }
        }
        finally { $mutator.Dispose() }
    }
    if ($baseline) {
        try {
            if (-not $baseline.HasExited) {
                [void]$baseline.CloseMainWindow()
                if (-not $baseline.WaitForExit(3000)) {
                    # This is the exact fixture process launched above.
                    $baseline.Kill()
                    [void]$baseline.WaitForExit(3000)
                }
            }
        }
        finally {
            $baseline.Dispose()
        }
    }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
