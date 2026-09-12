#Requires -Version 7.2
[CmdletBinding()]
param([Parameter(Mandatory)][string]$ArtifactDirectory,
      [string]$OutputDirectory='artifacts/update-apply')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'This test is restricted to disposable GitHub Actions runners.' }
$art=(Resolve-Path -LiteralPath $ArtifactDirectory).Path
$out=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $out | Out-Null
$root=Join-Path $env:RUNNER_TEMP ('update-apply-'+[Guid]::NewGuid().ToString('N'))
$stage=Join-Path $env:LOCALAPPDATA ('AI採掘機/updates/test-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $root,$stage | Out-Null
$old=Join-Path $root 'old.exe'
$target=Join-Path $root 'AI採掘機.exe'
$hostExe=Join-Path $root 'DetachedApply.exe'
$updater=Join-Path $root 'old-updater.exe'
$report=Join-Path $out 'apply.txt'
$log=Join-Path $env:LOCALAPPDATA 'AI採掘機/updater.log'
$logOffset=if(Test-Path $log){[IO.File]::ReadAllText($log).Length}else{0}
$launcher=$null
try {
    Invoke-WebRequest 'https://github.com/kanzakideath/fivemstonefarm/releases/download/v9.1.9/ai-miner-win-x64.exe' -OutFile $old
    if ((Get-FileHash $old).Hash.ToLowerInvariant() -ne 'b1e9c8b9f109316af5b9a6766337e51abf68fe14ccded0452e3118cf8c63c087') { throw 'Old release hash mismatch.' }
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public static class ReadOldUpdaterResource {
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr LoadLibraryEx(string path,IntPtr reserved,uint flags);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr FindResource(IntPtr module,string name,IntPtr type);
    [DllImport("kernel32.dll")] static extern IntPtr LoadResource(IntPtr module,IntPtr resource);
    [DllImport("kernel32.dll")] static extern IntPtr LockResource(IntPtr resource);
    [DllImport("kernel32.dll")] static extern uint SizeofResource(IntPtr module,IntPtr resource);
    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
    public static void Extract(string path,string output) {
        IntPtr module=LoadLibraryEx(path,IntPtr.Zero,2);
        if(module==IntPtr.Zero) throw new IOException("Could not inspect old executable resources.");
        try {
            IntPtr r=FindResource(module,"AI採掘機_UPDATER.EXE",new IntPtr(10));
            if(r==IntPtr.Zero) throw new IOException("Old updater resource missing.");
            int count=checked((int)SizeofResource(module,r));
            if(count<1024 || count>1048576) throw new IOException("Invalid updater resource size.");
            IntPtr data=LockResource(LoadResource(module,r));
            if(data==IntPtr.Zero) throw new IOException("Invalid updater resource data.");
            byte[] bytes=new byte[count];Marshal.Copy(data,bytes,0,count);File.WriteAllBytes(output,bytes);
        } finally {FreeLibrary(module);}
    }
}
'@
    [ReadOldUpdaterResource]::Extract($old,$updater)
    if ((Get-FileHash $updater).Hash.ToLowerInvariant() -ne '953fea3cedbbc3d9020caac915c3922898d79ec05a11e1cc72693e5dd55c19ec') { throw 'Extracted old updater differs from published resource.' }
    Copy-Item $old $target
    foreach($name in @('ai-miner-win-x64.exe','update-manifest.json','update-manifest.sig')) {Copy-Item (Join-Path $art $name) $stage}
    $manifest=Get-Content (Join-Path $stage 'update-manifest.json') -Raw | ConvertFrom-Json
    $ini=Join-Path $root 'AI採掘機.ini'
    [IO.File]::WriteAllText($ini,"[General]`nActionMode=washing`n[Updates]`nSchema=1`nAutoCheck=0`n[VehicleStorage]`nMinimumFreeWeight=1234`nStorageTriggerPercent=55`nMinimumFreeSlots=3`n",[Text.UTF8Encoding]::new($false))
    $iniHash=(Get-FileHash $ini).Hash
    $cs=Join-Path $root 'DetachedApply.cs'
    [IO.File]::WriteAllText($cs,@'
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
class DetachedApply {
    [DllImport("kernel32.dll")] static extern bool FreeConsole();
    [DllImport("kernel32.dll")] static extern bool SetStdHandle(int n,IntPtr h);
    static string Q(string s){if(s.IndexOf('"')>=0)throw new ArgumentException("Quote in test path");return "\""+s+"\"";}
    [STAThread] static int Main(string[] a) {
        if(a.Length==1 && a[0]=="parent"){Thread.Sleep(1200);return 0;}
        if(a.Length!=6)return 64;
        FreeConsole();SetStdHandle(-10,IntPtr.Zero);SetStdHandle(-11,IntPtr.Zero);SetStdHandle(-12,IntPtr.Zero);
        try {
            var parentStart=new ProcessStartInfo(Process.GetCurrentProcess().MainModule.FileName,"parent");
            parentStart.UseShellExecute=false;parentStart.CreateNoWindow=true;
            using(var parent=Process.Start(parentStart)){
                var start=new ProcessStartInfo(a[0],"apply "+parent.Id+" "+Q(a[1])+" "+Q(a[2])+" "+Q(a[3])+" "+Q(a[4]));
                start.UseShellExecute=false;start.CreateNoWindow=true;start.WindowStyle=ProcessWindowStyle.Hidden;
                start.WorkingDirectory=Path.GetDirectoryName(a[4]);
                var clock=Stopwatch.StartNew();
                using(var p=Process.Start(start)){
                    if(!p.WaitForExit(135000)){try{p.Kill();}catch{}File.WriteAllText(a[5],"TIMEOUT");return 2;}
                    File.WriteAllText(a[5],"EXIT="+p.ExitCode+";MS="+clock.ElapsedMilliseconds);return p.ExitCode;
                }
            }
        }catch(Exception e){File.WriteAllText(a[5],"ERROR="+e.Message);return 3;}
    }
}
'@,[Text.UTF8Encoding]::new($false))
    $csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    & $csc /nologo /target:winexe /platform:x64 /warnaserror+ "/out:$hostExe" $cs
    if($LASTEXITCODE -ne 0){throw 'Apply test parent compilation failed.'}
    $argsList=@($updater,(Join-Path $stage 'update-manifest.json'),(Join-Path $stage 'update-manifest.sig'),(Join-Path $stage 'ai-miner-win-x64.exe'),$target,$report)|ForEach-Object{'"'+$_+'"'}
    $launcher=Start-Process $hostExe -ArgumentList $argsList -PassThru
    if(-not $launcher.WaitForExit(145000)){throw 'Detached updater did not complete.'}
    $result=[IO.File]::ReadAllText($report)
    if($result -notmatch '^EXIT=0;'){throw "Actual old updater failed: $result"}
    if((Get-FileHash $target).Hash.ToLowerInvariant() -ne $manifest.artifact.sha256){throw 'Installed executable does not match signed update.'}
    if((Get-FileHash $ini).Hash -ne $iniHash){throw 'Updater altered custom settings.'}
    $until=[DateTime]::UtcNow.AddSeconds(15)
    do {
        $restarted=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $target -and $_.CommandLine -match '--updated' })
        if($restarted.Count -gt 0){break}
        Start-Sleep -Milliseconds 300
    }while([DateTime]::UtcNow -lt $until)
    if($restarted.Count -eq 0){throw 'Updated application was not restarted.'}
    $newLog=[IO.File]::ReadAllText($log).Substring($logOffset)
    if(-not $newLog.Contains('validation passed: --validate') -or -not $newLog.Contains('validation passed: --smoke-test') -or -not $newLog.Contains('Update applied successfully: '+$manifest.version+'.')){throw 'Old updater did not confirm both validations and installation.'}
    [ordered]@{version=$manifest.version;oldUpdater='v9.1.9 embedded binary';result=$result;sha256=$manifest.artifact.sha256;settingsUnchanged=$true;restartObserved=$true;pass=$true}|ConvertTo-Json|Set-Content (Join-Path $out 'apply-result.json') -Encoding utf8
    Write-Host ('PASS: actual v9.1.9 updater installed signed v'+$manifest.version+', validated without console, preserved custom INI and restarted --updated.')
} finally {
    if(Test-Path $log){[IO.File]::ReadAllText($log)|Set-Content (Join-Path $out 'updater.log') -Encoding utf8}
    $owned=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) })
    foreach($process in $owned){ & taskkill.exe /PID $process.ProcessId /T /F 2>$null | Out-Null }
    Start-Sleep -Milliseconds 500
    Remove-Item $stage,$root -Recurse -Force -ErrorAction SilentlyContinue
}
