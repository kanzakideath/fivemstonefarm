$ErrorActionPreference='Stop'
Start-Transcript artifacts/fishing040/build.txt
try { ./portable/Build.ps1 -Test } finally { Stop-Transcript }
$output=Join-Path $PWD 'artifacts/fishing040/storage-expressions.json'
$p=Start-Process portable/dist/FishingPilot.exe -ArgumentList @('--storage-expressions',('"'+$output+'"')) -PassThru
if(!$p.WaitForExit(12000)){$p.Kill();throw 'Production expression export timed out'}
$p.Refresh()
if($p.ExitCode -ne 0 -or !(Test-Path $output)){throw 'Production expression export failed'}
python -m pip install playwright==1.57.0
if($LASTEXITCODE -ne 0){throw 'Browser test installation failed'}
$edge='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if(!(Test-Path $edge)){$edge='C:\Program Files\Microsoft\Edge\Application\msedge.exe'}
$browser=@()
if(Test-Path $edge){$browser=@('--browser',$edge)}else{
 python -m playwright install chromium
 if($LASTEXITCODE -ne 0){throw 'Browser installation failed'}
}
python portable/TestScene.py @browser --output artifacts/fishing040/scene
if($LASTEXITCODE -ne 0){throw 'Rendered circle regression failed'}
python portable/TestUi.py @browser --output artifacts/fishing040/ui
if($LASTEXITCODE -ne 0){throw 'Responsive storage UI regression failed'}
python portable/TestStorage.py @browser --expressions artifacts/fishing040/storage-expressions.json --output artifacts/fishing040/storage
if($LASTEXITCODE -ne 0){throw 'Production storage fault injection failed'}
