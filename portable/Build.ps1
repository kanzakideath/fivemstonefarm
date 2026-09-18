#Requires -Version 5.1
param([switch]$Test)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$out=Join-Path $root 'dist'
New-Item -ItemType Directory -Force $out | Out-Null
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(!(Test-Path $csc)){throw 'Windows .NET Framework 4.8 compiler is required.'}
$sources=@('Program.cs','Engine.cs','Native.cs','FishCore.cs','BridgeRead.cs','CdpBridge.cs','FishingScene.cs','RecastPolicy.cs','Tests.cs') | ForEach-Object {Join-Path $root $_}
$refs=@('System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll') | ForEach-Object {"/reference:$_"}
& $csc /nologo /target:winexe /platform:x64 /optimize+ /main:FishingPilot.Program "/out:$out\FishingPilot.exe" @refs @sources
if($LASTEXITCODE -ne 0){throw 'Compile failed.'}
Copy-Item (Join-Path $root 'digit-templates.json'),(Join-Path $root 'README.txt'),(Join-Path $root 'LICENSE'),(Join-Path $root 'SceneProbe.js') $out -Force
Copy-Item (Join-Path $root 'fixtures') $out -Recurse -Force
@'
<?xml version="1.0" encoding="utf-8"?>
<configuration><startup useLegacyV2RuntimeActivationPolicy="true"><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8" /></startup><runtime><loadFromRemoteSources enabled="false" /></runtime></configuration>
'@ | Set-Content (Join-Path $out 'FishingPilot.exe.config') -Encoding utf8
if($Test){
 $evidence=Join-Path $out 'test-evidence';New-Item -ItemType Directory -Force $evidence | Out-Null
 $p=Start-Process "$out\FishingPilot.exe" -ArgumentList @('--self-test',('"'+$evidence+'"')) -PassThru
 if(!$p.WaitForExit(60000)){$p.Kill();throw 'Self-test exceeded 60s.'}
 $p.Refresh()
 if(!(Test-Path "$evidence\RESULT.txt")){throw 'No test result was written.'}
 Get-Content "$evidence\RESULT.txt"
 if($p.ExitCode -ne 0 -or (Get-Content "$evidence\RESULT.txt" -Raw) -notmatch '^PASS'){throw 'Self-tests did not pass.'}
 $p=Start-Process "$out\FishingPilot.exe" -ArgumentList @('--ui-smoke',('"'+$evidence+'\ui.png"')) -PassThru
 if(!$p.WaitForExit(12000)){$p.Kill();throw 'UI smoke timed out.'}
 $p.Refresh();if($p.ExitCode -ne 0 -or !(Test-Path "$evidence\ui.png")){throw 'UI did not render.'}
}
$files=Get-ChildItem $out -File | Where-Object Name -ne 'SHA256SUMS.txt'
$files | ForEach-Object {('{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(),$_.Name)} | Set-Content (Join-Path $out 'SHA256SUMS.txt') -Encoding utf8
Write-Host 'FishingPilot build ready.'
