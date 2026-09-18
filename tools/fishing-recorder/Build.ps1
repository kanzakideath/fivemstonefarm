#Requires -Version 5.1
[CmdletBinding()]
param([string]$OutDirectory = 'dist', [switch]$Test)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$out=[IO.Path]::GetFullPath((Join-Path $root $OutDirectory))
New-Item -ItemType Directory -Force $out | Out-Null
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not(Test-Path $csc)){throw 'Windows .NET Framework compiler not found. Requires Windows 10/11 with .NET Framework 4.8.'}
$exe=Join-Path $out 'FishingRecorder.exe'
& $csc /nologo /target:winexe /platform:x64 /optimize+ /langversion:5 /codepage:65001 "/out:$exe" "/win32manifest:$root\app.manifest" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll "$root\FishingRecorder.cs"
if($LASTEXITCODE -ne 0){throw 'C# compilation failed.'}
Copy-Item "$root\README.txt" $out -Force
Copy-Item "$root\FishingRecorder.exe.config" $out -Force
if($Test){
    $evidence=Join-Path $out 'test-evidence'
    $p=Start-Process -FilePath $exe -ArgumentList @('--self-test',('"'+$evidence+'"')) -PassThru
    if(-not $p.WaitForExit(45000)){$p.Kill();throw 'Recorder self-test timed out.'}
    $p.Refresh()
    if($p.ExitCode -ne 0 -or -not(Test-Path "$evidence\test-result.json")){
        Get-Content "$evidence\test-failure.txt" -ErrorAction SilentlyContinue
        throw "Recorder self-test failed ($($p.ExitCode))."
    }
    $result=Get-Content "$evidence\test-result.json" -Raw | ConvertFrom-Json
    if(-not $result.passed){throw 'Self-test did not pass.'}
    $result | ConvertTo-Json
}
$hash=(Get-FileHash -Algorithm SHA256 -LiteralPath $exe).Hash.ToLowerInvariant()
"$hash  FishingRecorder.exe" | Set-Content -Encoding ascii (Join-Path $out 'SHA256SUMS.txt')
Write-Host "Built: $exe"
