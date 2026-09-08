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

try {
    [void](New-Item -ItemType Directory -Path $testRoot)

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
        '--window-title', $appTitle, '--visual-test'
    )
    $suite = & $suiteScript -ExecutablePath $powerShellPath -OutputDirectory (Join-Path $testRoot 'captures') `
        -BaseArguments $suiteArguments -ReadyDelayMilliseconds 250
    if (-not $suite.passed -or $suite.captures.Count -ne 4) {
        throw 'The fixture suite did not produce all four expected captures.'
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
    if ($wideCapture.imageWidth -lt 780 -or $wideCapture.imageWidth -gt 900 -or
        $narrowCapture.imageWidth -lt 480 -or $narrowCapture.imageWidth -gt 600) {
        throw 'DPI coordinate conversion produced an unexpected fixture width.'
    }

    [pscustomobject]@{
        passed = $true
        captures = $suite.captures.Count
        sequenceFrames = $sequence.frames.Count
        preExistingProcessSurvived = -not $baseline.HasExited
        temporaryArtifacts = $testRoot
    }
}
finally {
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
