#Requires -Version 5.1
[CmdletBinding()]
param([string]$OutputDirectory = 'artifacts/support-export')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$helper = Join-Path $repo 'build/staging/Diagnostics.exe'
if (-not (Test-Path -LiteralPath $helper)) { throw 'Build the real diagnostics helper first.' }
$out = [IO.Path]::GetFullPath((Join-Path $repo $OutputDirectory))
New-Item -ItemType Directory -Force $out | Out-Null
$root = Join-Path ([IO.Path]::GetTempPath()) ('support-export-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force (Join-Path $root 'diagnostics'), (Join-Path $root 'exe-routes') | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false)
try {
    $private = 'PRIVATE_CANARY_987654321'
    $journal = Join-Path $root 'diagnostics/events.jsonl'
    $record = [ordered]@{schema=1;utc='2026-09-12T00:00:00Z';monotonicMs=6000;version='9.1.13';session='synthetic-support-session';seq=1;event='USER_MARK';message='Fault after washing';context=@{running=$false;fsm='WASH_CORRECTING';mode='washing';rawStoneCount=3;task=42;storageId=$private}}
    [IO.File]::WriteAllText($journal, ($record | ConvertTo-Json -Compress) + "`n{incomplete", $utf8)
    [IO.File]::WriteAllText((Join-Path $root 'settings.ini'), $private, $utf8)
    $report = @{schema=1;result='ERROR FORWARD_NO_OBSERVED_EFFECT';pulses=2;inputMs=80;beforeError=0.6;afterError=0.3;inputsReleased=$true;reference=$private;events=@('1ms W_DOWN actual_ms=1','41ms W_UP actual_ms=41',('token='+$private))} | ConvertTo-Json -Compress
    [IO.File]::WriteAllText((Join-Path $root 'exe-routes/wash-position-last.json'), $report, $utf8)
    $before = (Get-FileHash -LiteralPath $journal).Hash
    $zip = Join-Path $out 'synthetic-diagnostic-example.zip'
    if (Test-Path -LiteralPath $zip) { throw 'Evidence path already exists.' }
    $result = Join-Path $root 'result.txt'
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $p = Start-Process -FilePath $helper -ArgumentList @('export',"`"$result`"","`"$root`"","`"$zip`"","`"$helper`"",'9.1.13') -PassThru
    if (-not $p.WaitForExit(15000)) { $p.Kill(); throw 'Export timed out.' }
    if ($p.ExitCode -ne 0 -or (Get-Content -LiteralPath $result -Raw).Trim() -ne 'EXPORTED') { throw 'Actual exporter CLI failed.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        $names = @($archive.Entries | ForEach-Object {$_.FullName})
        foreach ($required in @('manifest.json','READ-ME.txt','last-events.txt','SHA256SUMS.txt','logs/events.jsonl','reports/wash-position-last.json')) {
            if ($names -notcontains $required) { throw "Missing $required" }
        }
        foreach ($entry in $archive.Entries) {
            $reader = [IO.StreamReader]::new($entry.Open(),[Text.Encoding]::UTF8)
            try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
            if ($text.Contains($private)) { throw 'Private canary escaped the allowlist.' }
            if ($entry.FullName -eq 'manifest.json') {
                $manifest = $text | ConvertFrom-Json
                if ($manifest.skippedJournalLines -ne 1 -or $manifest.automaticUpload -or $manifest.screenshotsIncluded) { throw 'Incomplete input/privacy metadata wrong.' }
            }
        }
    } finally { $archive.Dispose() }
    if ((Get-FileHash -LiteralPath $journal).Hash -ne $before -or [IO.File]::ReadAllText((Join-Path $root 'settings.ini')) -ne $private) { throw 'Export modified original files.' }
    [ordered]@{result='PASS';testTarget='synthetic local log files, actual production exporter';elapsedMs=$watch.ElapsedMilliseconds;privateCanaryExcluded=$true;tornLinesReported=1;originalFilesUnchanged=$true;zipBytes=(Get-Item $zip).Length;automaticUpload=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $out 'export-result.json') -Encoding utf8
    Get-Content -LiteralPath (Join-Path $out 'export-result.json')
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
