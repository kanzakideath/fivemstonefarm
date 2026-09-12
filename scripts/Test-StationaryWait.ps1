#Requires -Version 5.1
[CmdletBinding()]
param([string]$OutputDirectory = 'artifacts/stationary-wait')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$ahk = Join-Path $root 'tools/AutoHotkey/AutoHotkey64.exe'
if (-not (Test-Path -LiteralPath $ahk)) { throw 'Bootstrap the pinned AutoHotkey toolchain first.' }
$out = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Force $out | Out-Null
$result = Join-Path $out 'wait-result.txt'
if (Test-Path -LiteralPath $result) { Remove-Item -LiteralPath $result }
$fixture = Join-Path $root 'scripts/ui-tests/StationaryWaitHarness.ahk'
$p = Start-Process -FilePath $ahk -ArgumentList @('/ErrorStdOut',('"'+$fixture+'"'),('"'+$result+'"')) -PassThru -RedirectStandardError (Join-Path $out 'stderr.txt') -RedirectStandardOutput (Join-Path $out 'stdout.txt')
if (-not $p.WaitForExit(15000)) { $p.Kill(); throw 'Production wait loop did not cancel or finish within the test budget.' }
$p.Refresh()
if (-not (Test-Path -LiteralPath $result)) {
    Get-Content (Join-Path $out 'stderr.txt'), (Join-Path $out 'stdout.txt') -ErrorAction SilentlyContinue
    throw 'No wait-test evidence; script may not parse.'
}
$text = Get-Content -LiteralPath $result -Raw -Encoding UTF8
Write-Output $text
if ($p.ExitCode -ne 0 -or $text -notmatch '^STATIONARY_WAIT_PASS') { throw 'Stationary production-loop regression failed.' }
