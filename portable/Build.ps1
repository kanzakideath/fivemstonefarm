#Requires -Version 5.1
param([switch]$Test)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$out=Join-Path $root 'dist'
New-Item -ItemType Directory -Force $out | Out-Null
Push-Location $root
try {
 & dotnet restore FishingPilot.csproj --locked-mode
 if($LASTEXITCODE -ne 0){throw 'Locked WebView2 restore failed.'}
 & dotnet build FishingPilot.csproj -c Release --no-restore --output $out
 if($LASTEXITCODE -ne 0){throw 'FishingPilot build failed.'}
 & npm ci --ignore-scripts --no-audit --no-fund
 if($LASTEXITCODE -ne 0){throw 'Locked Framework7 installation failed.'}
 $framework=Get-Content node_modules/framework7/package.json -Raw|ConvertFrom-Json
 if($framework.version -cne '9.1.3'){throw 'Unexpected Framework7 version.'}
 New-Item -ItemType Directory -Force ui/vendor | Out-Null
 Copy-Item node_modules/framework7/framework7-bundle.min.css,node_modules/framework7/framework7-bundle.min.js ui/vendor -Force
 $license=Get-ChildItem node_modules/framework7 -File | Where-Object Name -Match '^LICENSE' | Select-Object -First 1
 if($license){Copy-Item $license.FullName ui/vendor/Framework7-LICENSE.txt -Force}
 Copy-Item digit-templates.json,README.txt,LICENSE,SceneProbe.js,InventoryProbe.js,fish-prices.json $out -Force
 Copy-Item ui (Join-Path $out 'ui') -Recurse -Force
 Copy-Item fixtures (Join-Path $out 'fixtures') -Recurse -Force
 $loader=Join-Path $out 'WebView2Loader.dll'
 if(!(Test-Path $loader)){$candidate=Get-ChildItem $out -Filter WebView2Loader.dll -Recurse|Where-Object FullName -match 'win-x64'|Select-Object -First 1;if(!$candidate){throw 'x64 WebView2 loader missing.'};Copy-Item $candidate.FullName $loader}
 foreach($f in @('FishingPilot.exe','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll','ui/index.html','ui/vendor/framework7-bundle.min.js','SceneProbe.js')){if(!(Test-Path (Join-Path $out $f))){throw "Missing runtime asset: $f"}}
 if($Test){
  $evidence=Join-Path $out 'test-evidence';New-Item -ItemType Directory -Force $evidence | Out-Null
  foreach($f in @('RESULT.txt','ui.png','ui.json')){Remove-Item (Join-Path $evidence $f) -Force -ErrorAction SilentlyContinue}
  $p=Start-Process "$out/FishingPilot.exe" -ArgumentList @('--self-test',('"'+$evidence+'"')) -PassThru
  if(!$p.WaitForExit(60000)){$p.Kill();throw 'Self-tests timed out.'};$p.Refresh()
  if(!(Test-Path "$evidence/RESULT.txt")){throw 'No self-test result.'};Get-Content "$evidence/RESULT.txt"
  if($p.ExitCode -ne 0 -or (Get-Content "$evidence/RESULT.txt" -Raw) -notmatch '^PASS'){throw 'Self-tests failed.'}
  $p=Start-Process "$out/FishingPilot.exe" -ArgumentList @('--ui-smoke',('"'+$evidence+'/ui.png"')) -PassThru
  if(!$p.WaitForExit(35000)){$p.Kill();throw 'WebView2 smoke test timed out.'};$p.Refresh()
  if($p.ExitCode -ne 0 -or !(Test-Path "$evidence/ui.png")){Get-Content "$evidence/ui.png.error.txt" -ErrorAction SilentlyContinue;throw 'WebView2 did not render or exchange native state.'}
 }
 $files=Get-ChildItem $out -File -Recurse|Where-Object {$_.Name -ne 'SHA256SUMS.txt' -and $_.FullName -notmatch '[\\/]test-evidence[\\/]'}
 $files|ForEach-Object {('{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(),$_.FullName.Substring($out.Length+1).Replace('\','/'))}|Set-Content (Join-Path $out SHA256SUMS.txt) -Encoding utf8
 Write-Host 'FishingPilot 0.6.2 build ready.'
} finally {Pop-Location}
