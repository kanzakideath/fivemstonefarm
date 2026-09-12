#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ArtifactDirectory,
    [string]$OutputDirectory='artifacts/update-apply',
    [switch]$UsePublicLatest,
    [ValidatePattern('^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$')]
    [string]$ExpectedVersion
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'This test is restricted to disposable GitHub Actions runners.' }
$art=(Resolve-Path -LiteralPath $ArtifactDirectory).Path
$out=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $out | Out-Null
$expectedManifestPath=Join-Path $art 'update-manifest.json'
$expectedSignaturePath=Join-Path $art 'update-manifest.sig'
$expectedExecutablePath=Join-Path $art 'ai-miner-win-x64.exe'
foreach($required in @($expectedManifestPath,$expectedSignaturePath,$expectedExecutablePath)) {
    if(-not(Test-Path -LiteralPath $required -PathType Leaf)){throw "Expected release asset is missing: $required"}
}
$expectedManifest=Get-Content -LiteralPath $expectedManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if($UsePublicLatest -and [String]::IsNullOrWhiteSpace($ExpectedVersion)){throw 'ExpectedVersion is required for a public Latest test.'}
if([String]::IsNullOrWhiteSpace($ExpectedVersion)){$ExpectedVersion=[string]$expectedManifest.version}
if([string]$expectedManifest.version -cne $ExpectedVersion){throw 'Expected release manifest version mismatch.'}
$expectedSha256=([string]$expectedManifest.artifact.sha256).ToLowerInvariant()
if($expectedSha256 -cnotmatch '^[0-9a-f]{64}$' -or
   (Get-FileHash -LiteralPath $expectedExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedSha256) {
    throw 'Expected release executable does not match its manifest SHA-256.'
}

function ConvertFrom-UpdaterResult([string]$Text) {
    $values=@{}
    foreach($line in @($Text -split '\r?\n' | Where-Object { $_.Length -gt 0 })) {
        if($line -cnotmatch '^(?<key>[A-Za-z][A-Za-z0-9]*)=(?<value>.*)$'){throw "Malformed updater result line: $line"}
        $key=$Matches.key
        if($values.ContainsKey($key)){throw "Duplicate updater result key: $key"}
        $values[$key]=$Matches.value
    }
    return ,$values
}

function Invoke-UpdaterCommand {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$ResultPath,
        [int]$TimeoutMilliseconds=30000
    )
    if(Test-Path -LiteralPath $ResultPath){Remove-Item -LiteralPath $ResultPath -Force}
    $quotedArguments=foreach($argument in $Arguments) {
        if($argument.Contains('"')){throw 'A test argument contains an unsupported quote.'}
        '"'+$argument+'"'
    }
    $process=Start-Process -FilePath $Executable -ArgumentList ($quotedArguments -join ' ') -PassThru -WindowStyle Hidden
    [void]$process.Handle
    try {
        if(-not $process.WaitForExit($TimeoutMilliseconds)) {
            try{$process.Kill($true)}catch{try{$process.Kill()}catch{}}
            try{[void]$process.WaitForExit(5000)}catch{}
            throw "Updater command timed out: $($Arguments[0])"
        }
        $process.WaitForExit()
        $process.Refresh()
        $exitCode=$process.ExitCode
    } finally {
        $process.Dispose()
    }
    $text=if(Test-Path -LiteralPath $ResultPath -PathType Leaf){[IO.File]::ReadAllText($ResultPath)}else{''}
    $values=if($text.Length -gt 0){ConvertFrom-UpdaterResult $text}else{@{}}
    return [pscustomobject]@{ExitCode=$exitCode;Text=$text;Values=$values}
}

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
    Invoke-WebRequest 'https://github.com/kanzakideath/fivemstonefarm/releases/download/v9.1.17/ai-miner-win-x64.exe' -OutFile $old
    if ((Get-FileHash $old).Hash.ToLowerInvariant() -ne '101978b9cf15b16f9a10b226afadf02089d69eef04b6f7980e7e16edcff29047') { throw 'Old release hash mismatch.' }
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
    if ((Get-FileHash $updater).Hash.ToLowerInvariant() -ne 'a95fd856136fcfcc8cf4f9ac20247df0ad067b8cd74f7710e712b15c704f772f') { throw 'Extracted old updater differs from published resource.' }
    Copy-Item $old $target
    $manifestPath=Join-Path $stage 'update-manifest.json'
    $signaturePath=Join-Path $stage 'update-manifest.sig'
    $stagedExecutablePath=Join-Path $stage 'ai-miner-win-x64.exe'
    $checkAttempts=0
    $downloadAttempts=0
    if($UsePublicLatest) {
        $check=$null
        foreach($attempt in 1..12) {
            $checkAttempts=$attempt
            $checkResultPath=Join-Path $out "latest-check-$attempt.txt"
            $invocation=Invoke-UpdaterCommand -Executable $updater `
                -Arguments @('check',$checkResultPath,'9.1.17',$stage) `
                -ResultPath $checkResultPath -TimeoutMilliseconds 30000
            if($invocation.ExitCode -eq 0 -and
               $invocation.Values['Status'] -ceq 'UPDATE_AVAILABLE' -and
               $invocation.Values['Version'] -ceq $ExpectedVersion) {
                $check=$invocation
                break
            }
            if($invocation.ExitCode -eq 0 -and
               $invocation.Values['Status'] -ceq 'UPDATE_AVAILABLE' -and
               -not [String]::IsNullOrWhiteSpace([string]$invocation.Values['Version'])) {
                throw "Public Latest unexpectedly advanced to v$($invocation.Values['Version'])."
            }
            if($attempt -lt 12){Start-Sleep -Seconds 5}
        }
        if($null -eq $check) {
            throw "Published Latest did not resolve to v$ExpectedVersion through the actual v9.1.17 updater after $checkAttempts attempts. Last result: $($invocation.Text)"
        }
        if(-not [IO.Path]::GetFullPath($check.Values['ManifestPath']).Equals(
                [IO.Path]::GetFullPath($manifestPath),[StringComparison]::OrdinalIgnoreCase) -or
           -not [IO.Path]::GetFullPath($check.Values['SignaturePath']).Equals(
                [IO.Path]::GetFullPath($signaturePath),[StringComparison]::OrdinalIgnoreCase)) {
            throw 'Latest check returned unexpected metadata paths.'
        }
        foreach($comparison in @(
                @{Actual=$manifestPath;Expected=$expectedManifestPath;Name='manifest'},
                @{Actual=$signaturePath;Expected=$expectedSignaturePath;Name='signature'})) {
            if(-not(Test-Path -LiteralPath $comparison.Actual -PathType Leaf) -or
               (Get-FileHash -LiteralPath $comparison.Actual -Algorithm SHA256).Hash -cne
                   (Get-FileHash -LiteralPath $comparison.Expected -Algorithm SHA256).Hash) {
                throw "Public Latest $($comparison.Name) differs from the verified release asset."
            }
        }

        $download=$null
        foreach($attempt in 1..4) {
            $downloadAttempts=$attempt
            $downloadResultPath=Join-Path $out "public-download-$attempt.txt"
            $invocation=Invoke-UpdaterCommand -Executable $updater `
                -Arguments @('download',$downloadResultPath,$manifestPath,$signaturePath,$stagedExecutablePath) `
                -ResultPath $downloadResultPath -TimeoutMilliseconds 60000
            if($invocation.ExitCode -eq 0 -and
               $invocation.Values['Status'] -ceq 'DOWNLOADED' -and
               $invocation.Values['Version'] -ceq $ExpectedVersion) {
                $download=$invocation
                break
            }
            if($attempt -lt 4){Start-Sleep -Seconds 5}
        }
        if($null -eq $download) {
            throw "Actual v9.1.17 updater did not download public v$ExpectedVersion after $downloadAttempts attempts. Last result: $($invocation.Text)"
        }
        if(-not [IO.Path]::GetFullPath($download.Values['StagedPath']).Equals(
                [IO.Path]::GetFullPath($stagedExecutablePath),[StringComparison]::OrdinalIgnoreCase)) {
            throw 'Public download returned an unexpected staged executable path.'
        }
        if(-not(Test-Path -LiteralPath $stagedExecutablePath -PathType Leaf) -or
           (Get-FileHash -LiteralPath $stagedExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedSha256) {
            throw 'The executable downloaded through public Latest differs from the verified release.'
        }
    } else {
        foreach($name in @('ai-miner-win-x64.exe','update-manifest.json','update-manifest.sig')) {
            Copy-Item -LiteralPath (Join-Path $art $name) -Destination $stage
        }
    }
    $manifest=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if([string]$manifest.version -cne $ExpectedVersion -or
       ([string]$manifest.artifact.sha256).ToLowerInvariant() -cne $expectedSha256) {
        throw 'Staged update identity differs from the expected release.'
    }
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
    $argsList=@($updater,$manifestPath,$signaturePath,$stagedExecutablePath,$target,$report)|ForEach-Object{'"'+$_+'"'}
    $launcher=Start-Process -FilePath $hostExe -ArgumentList ($argsList -join ' ') -PassThru
    [void]$launcher.Handle
    try {
        if(-not $launcher.WaitForExit(145000)) {
            try{$launcher.Kill($true)}catch{try{$launcher.Kill()}catch{}}
            try{[void]$launcher.WaitForExit(5000)}catch{}
            throw 'Detached updater did not complete.'
        }
        $launcher.WaitForExit()
        $launcher.Refresh()
        $launcherExitCode=$launcher.ExitCode
    } finally {
        $launcher.Dispose()
        $launcher=$null
    }
    if(-not(Test-Path -LiteralPath $report -PathType Leaf)){throw "Detached updater result is missing (host exit=$launcherExitCode)."}
    $result=[IO.File]::ReadAllText($report)
    if($launcherExitCode -ne 0 -or $result -notmatch '^EXIT=0;'){throw "Actual old updater failed (host exit=$launcherExitCode): $result"}
    $installedSha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if($installedSha256 -cne $expectedSha256 -or $installedSha256 -cne ([string]$manifest.artifact.sha256).ToLowerInvariant()) {
        throw 'Installed executable does not match the expected signed update.'
    }
    $expectedPeVersion=[Version]::Parse($ExpectedVersion)
    $installedVersionInfo=[Diagnostics.FileVersionInfo]::GetVersionInfo($target)
    $installedVersions=[ordered]@{}
    foreach($field in @('FileVersion','ProductVersion')) {
        $rawVersion=[string]$installedVersionInfo.$field
        $parsedVersion=$null
        if(-not [Version]::TryParse($rawVersion,[ref]$parsedVersion) -or
           $parsedVersion.Major -ne $expectedPeVersion.Major -or
           $parsedVersion.Minor -ne $expectedPeVersion.Minor -or
           $parsedVersion.Build -ne $expectedPeVersion.Build) {
            throw "Installed executable $field '$rawVersion' does not match v$ExpectedVersion."
        }
        $installedVersions[$field]=$rawVersion
    }
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
    if($UsePublicLatest -and
       (-not $newLog.Contains('UPDATE_AVAILABLE: '+$ExpectedVersion+'.') -or
        -not $newLog.Contains('Update download completed: '+$ExpectedVersion+'.'))) {
        throw 'Actual v9.1.17 updater log does not prove public Latest check and download.'
    }
    $sourceMode=if($UsePublicLatest){'public Latest check/download/apply'}else{'verified local artifact apply'}
    [ordered]@{
        version=$manifest.version
        oldUpdater='v9.1.17 embedded binary'
        source=$sourceMode
        checkAttempts=$checkAttempts
        downloadAttempts=$downloadAttempts
        result=$result
        sha256=$installedSha256
        fileVersion=$installedVersions.FileVersion
        productVersion=$installedVersions.ProductVersion
        settingsUnchanged=$true
        restartObserved=$true
        pass=$true
    }|ConvertTo-Json|Set-Content (Join-Path $out 'apply-result.json') -Encoding utf8
    Write-Host ('PASS: actual v9.1.17 updater used '+$sourceMode+' for signed v'+$manifest.version+', validated without console, preserved custom INI and restarted --updated.')
} finally {
    if(Test-Path $log){[IO.File]::ReadAllText($log)|Set-Content (Join-Path $out 'updater.log') -Encoding utf8}
    $owned=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) })
    foreach($process in $owned){ & taskkill.exe /PID $process.ProcessId /T /F 2>$null | Out-Null }
    Start-Sleep -Milliseconds 500
    Remove-Item $stage,$root -Recurse -Force -ErrorAction SilentlyContinue
}
