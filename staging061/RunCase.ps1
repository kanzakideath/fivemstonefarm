param([Parameter(Mandatory=$true)][string]$Name,[string]$Mode='right-null',[switch]$Blocked)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$dist=Join-Path $root 'portable/dist'
$case=Join-Path $root ('artifacts/fishing061/integration/'+$Name)
New-Item -ItemType Directory -Force $case | Out-Null
Remove-Item (Join-Path $case 'ready'),(Join-Path $case 'rod.sent'),(Join-Path $case 'digit.sent'),(Join-Path $case 'RESULT.json') -Force -ErrorAction SilentlyContinue
[IO.File]::WriteAllText((Join-Path $case 'mode.txt'),$Mode)
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$exe=Join-Path $dist 'FiveM-FishingPilot-Integration.exe'
& $csc /nologo /target:winexe /platform:x64 ("/out:"+$exe) ("/r:"+(Join-Path $dist 'FishingPilot.exe')) /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll (Join-Path $PSScriptRoot 'Integration.cs')
if($LASTEXITCODE -ne 0){throw 'Engine integration harness compilation failed'}
$peer=$null
try {
 $peer=Start-Process python -ArgumentList @(('"'+(Join-Path $PSScriptRoot 'Fixture.py')+'"'),'--root',('"'+$case+'"')) -PassThru -RedirectStandardError (Join-Path $case 'peer-stderr.txt') -RedirectStandardOutput (Join-Path $case 'peer-stdout.txt')
 $watch=[Diagnostics.Stopwatch]::StartNew()
 while(!(Test-Path (Join-Path $case 'ready'))){Start-Sleep -Milliseconds 100;$peer.Refresh();if($peer.HasExited -or $watch.Elapsed.TotalSeconds -gt 10){Get-Content (Join-Path $case 'peer-stderr.txt');throw 'Local CDP test peer did not start'}}
 $argsList=@(('"'+$case+'"'));if($Blocked){$argsList+='blocked'}
 $p=Start-Process $exe -ArgumentList $argsList -WorkingDirectory $dist -PassThru
 if(!$p.WaitForExit(35000)){$p.Kill();throw ('Engine integration timed out: '+$Name)}
 $p.Refresh()
 $result=Join-Path $case 'RESULT.json'
 if(!(Test-Path $result)){throw ('Missing integration result: '+$Name)}
 Get-Content $result
 if($p.ExitCode -ne 0){throw ('Engine integration failed: '+$Name)}
} finally {
 if($null -ne $peer){$peer.Refresh();if(!$peer.HasExited){$peer.Kill();$peer.WaitForExit()}}
}
