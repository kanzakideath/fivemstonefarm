#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ExecutablePath,
    [string]$OutputDirectory = 'artifacts/update-startup',
    [switch]$ObserveOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$exe = (Resolve-Path -LiteralPath $ExecutablePath).Path
$out = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $out | Out-Null
$root = Join-Path $env:TEMP ('ai-miner-startup-probe-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $root | Out-Null
# This GUI parent deliberately has no console or standard handles. The installed
# updater launches its validation child the same way (no stream redirection).
$source = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
class DetachedValidationParent {
    [DllImport("kernel32.dll")] static extern bool FreeConsole();
    [DllImport("kernel32.dll")] static extern bool SetStdHandle(int which, IntPtr value);
    [STAThread] static int Main(string[] args) {
        if (args.Length != 3) return 64;
        FreeConsole();
        SetStdHandle(-10, IntPtr.Zero); SetStdHandle(-11, IntPtr.Zero); SetStdHandle(-12, IntPtr.Zero);
        try {
            var start = new ProcessStartInfo(args[0], args[1]);
            start.WorkingDirectory = Path.GetDirectoryName(args[0]);
            start.UseShellExecute = false; start.CreateNoWindow = true;
            start.WindowStyle = ProcessWindowStyle.Hidden;
            var watch = Stopwatch.StartNew();
            using (var p = Process.Start(start)) {
                if (p == null) throw new Exception("No validation process");
                if (!p.WaitForExit(60000)) {
                    try { p.Kill(); p.WaitForExit(5000); } catch { }
                    File.WriteAllText(args[2], "TIMEOUT"); return 2;
                }
                File.WriteAllText(args[2], "EXIT=" + p.ExitCode + ";MS=" + watch.ElapsedMilliseconds);
                return 0;
            }
        } catch (Exception e) { File.WriteAllText(args[2], "ERROR=" + e.Message); return 3; }
    }
}
'@
$cs = Join-Path $root 'DetachedValidationParent.cs'
$hostExe = Join-Path $root 'DetachedValidationParent.exe'
[IO.File]::WriteAllText($cs, $source, [Text.UTF8Encoding]::new($false))
$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $csc /nologo /target:winexe /platform:x64 /warnaserror+ "/out:$hostExe" $cs
if ($LASTEXITCODE -ne 0) { throw 'Detached test parent compilation failed.' }
$cases = @(
    @{ Name='default-no-console'; Custom=$false; Redirect=$false; Mode='--validate' },
    @{ Name='custom-settings-no-console'; Custom=$true; Redirect=$false; Mode='--validate' },
    @{ Name='custom-settings-redirected'; Custom=$true; Redirect=$true; Mode='--validate' },
    @{ Name='smoke-no-console'; Custom=$true; Redirect=$false; Mode='--smoke-test' }
)
$results = @()
try {
    foreach ($case in $cases) {
        $dir = Join-Path $root $case.Name
        New-Item -ItemType Directory $dir | Out-Null
        $target = Join-Path $dir 'AI採掘機.exe'
        Copy-Item -LiteralPath $exe -Destination $target
        $config = Join-Path $dir 'AI採掘機.ini'
        $legacy = Join-Path $dir '自動採掘マクロ.ini'
        $diagnostic = Join-Path $dir 'AI採掘機_診断.log'
        [IO.File]::WriteAllText($legacy, "[General]`nActionMode=washing`n[Storage]`nMinimumFreeWeight=1234`nTriggerPercent=55`n", [Text.UTF8Encoding]::new($false))
        if ($case.Custom) { Copy-Item -LiteralPath $legacy -Destination $config }
        [IO.File]::WriteAllText($diagnostic, 'USER_DIAGNOSTIC_MUST_SURVIVE', [Text.UTF8Encoding]::new($false))
        $before = @{}
        foreach ($file in @($config,$legacy,$diagnostic)) {
            $before[$file] = if (Test-Path -LiteralPath $file) { (Get-FileHash -LiteralPath $file).Hash } else { 'ABSENT' }
        }
        $report = Join-Path $out ($case.Name + '.txt')
        if ($case.Redirect) {
            $p = Start-Process -FilePath $target -ArgumentList $case.Mode -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $out ($case.Name+'.stdout.txt')) -RedirectStandardError (Join-Path $out ($case.Name+'.stderr.txt'))
            if (-not $p.WaitForExit(60000)) { try { $p.Kill() } catch {}; throw 'Redirected validation timeout.' }
            $text = 'EXIT=' + $p.ExitCode
            [IO.File]::WriteAllText($report,$text)
        } else {
            $argsList = @(('"'+$target+'"'),$case.Mode,('"'+$report+'"'))
            $p = Start-Process -FilePath $hostExe -ArgumentList $argsList -PassThru -WindowStyle Hidden
            if (-not $p.WaitForExit(70000)) { try { $p.Kill() } catch {}; throw 'Detached test parent timeout.' }
            if (-not (Test-Path -LiteralPath $report)) { throw 'Detached validation result missing.' }
            $text = [IO.File]::ReadAllText($report)
        }
        $preserved = $true
        foreach ($file in $before.Keys) {
            $after = if (Test-Path -LiteralPath $file) { (Get-FileHash -LiteralPath $file).Hash } else { 'ABSENT' }
            if ($after -cne $before[$file]) { $preserved = $false }
        }
        $ok = $text -match '^EXIT=0(?:;|$)' -and $preserved
        $results += [ordered]@{case=$case.Name; result=$text; installFilesUnchanged=$preserved; pass=$ok}
        Write-Host "$($case.Name): $text; install files unchanged=$preserved"
    }
} finally {
    $results | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $out 'results.json') -Encoding utf8
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
if (-not $ObserveOnly -and @($results | Where-Object { -not $_.pass }).Count -gt 0) { throw 'Detached updater validation or configuration-preservation regression failed.' }
