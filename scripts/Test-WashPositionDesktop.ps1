#Requires -Version 5.1
[CmdletBinding()]
param([string]$OutputDirectory = 'artifacts/observed-wash')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$output = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Force $output | Out-Null
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$probe = Join-Path $output 'WashPositionDesktopProbe.exe'
$source = Join-Path $PSScriptRoot 'ui-tests\WashPositionDesktopProbe.cs'
& $csc /nologo /target:winexe /optimize+ /warnaserror+ /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /out:$probe $source
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $probe)) { throw 'Desktop probe did not compile.' }
$helper = Join-Path $root 'build\staging\WashPosition.exe'
if (-not (Test-Path $helper)) { throw 'Production wash helper is missing.' }
$report = Join-Path $output 'desktop-input-report.txt'
$process = Start-Process -FilePath $probe -ArgumentList @("`"$helper`"", "`"$report`"") -PassThru
if (-not $process.WaitForExit(90000)) {
    # Kill only the test's own child tree, never a game or another app.
    & taskkill.exe /PID $process.Id /T /F | Out-Null
    throw 'Synthetic desktop input check timed out.'
}
$text = if (Test-Path $report) { Get-Content $report -Raw } else { 'NO_REPORT' }
Write-Host $text
if ($process.ExitCode -ne 0 -or $text -notmatch 'DESKTOP_PROBE OK') { throw 'Synthetic desktop input check failed.' }
Write-Host 'Verified production screenshot/input path against a synthetic target. This is NOT live FiveM validation.'
