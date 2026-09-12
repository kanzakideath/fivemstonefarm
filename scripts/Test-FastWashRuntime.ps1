#Requires -Version 5.1
[CmdletBinding()]
param([string]$OutputDirectory = 'artifacts/fast-wash-runtime')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$ahk = Join-Path $root 'tools/AutoHotkey/AutoHotkey64.exe'
if (-not (Test-Path -LiteralPath $ahk)) { throw 'Bootstrap the pinned AutoHotkey toolchain first.' }
$out = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Force $out | Out-Null
$result = Join-Path $out 'fast-result.txt'
if (Test-Path -LiteralPath $result) { Remove-Item -LiteralPath $result }
$fixture = Join-Path $root 'scripts/ui-tests/FastWashHarness.ahk'
$p = Start-Process -FilePath $ahk -ArgumentList @('/ErrorStdOut',('"'+$fixture+'"'),('"'+$result+'"')) -PassThru -RedirectStandardError (Join-Path $out 'stderr.txt') -RedirectStandardOutput (Join-Path $out 'stdout.txt')
[void]$p.Handle
if (-not $p.WaitForExit(15000)) { $p.Kill(); throw 'Production fast wash helper did not cancel or finish within the test budget.' }
$p.WaitForExit()
$p.Refresh()
if (-not (Test-Path -LiteralPath $result)) {
    Get-Content (Join-Path $out 'stderr.txt'), (Join-Path $out 'stdout.txt') -ErrorAction SilentlyContinue
    throw 'No fast-wash-test evidence; script may not parse.'
}
$text = Get-Content -LiteralPath $result -Raw -Encoding UTF8
Write-Output $text
if ($p.ExitCode -ne 0 -or $text -notmatch '^FAST_WASH_RUNTIME_PASS') {
    throw "Fast-wash runtime regression failed (exit=$($p.ExitCode), evidenceMatch=$($text -match '^FAST_WASH_RUNTIME_PASS'))."
}
