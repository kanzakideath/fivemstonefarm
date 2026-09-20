$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'artifacts/fishing074'
New-Item -ItemType Directory -Force $out | Out-Null

python (Join-Path $PSScriptRoot 'Validate.py') source
if ($LASTEXITCODE -ne 0) { throw '0.7.4 source/version validation failed' }

foreach ($name in @('Manager', 'View')) {
    dotnet build (Join-Path $root ('staging071/' + $name + '.csproj')) -c Release --output (Join-Path $root ('staging071/bin/' + $name))
    if ($LASTEXITCODE -ne 0) { throw "$name build failed" }
}

function Run-Test([string]$Exe, [string]$Mode, [string]$Result) {
    $path = Join-Path $out $Result
    $process = Start-Process $Exe -ArgumentList @($Mode, ('"' + $path + '"')) -PassThru
    if (!$process.WaitForExit(60000)) {
        $process.Kill()
        throw "$Mode timed out"
    }
    $process.Refresh()
    if ($process.ExitCode -ne 0 -or !(Test-Path $path)) {
        if (Test-Path $path) { Get-Content $path }
        throw "$Mode failed"
    }
    if ($Result.EndsWith('.json')) {
        $value = Get-Content $path -Raw | ConvertFrom-Json
        if (!$value.pass) {
            Get-Content $path
            throw "$Mode reported failure"
        }
    }
}

Run-Test (Join-Path $root 'staging071/bin/Manager/FishingPilot.Manager.exe') '--self-test' 'updater-tests.json'
Run-Test (Join-Path $root 'staging071/bin/Manager/FishingPilot.Manager.exe') '--ui-smoke' 'update-manager.png'
Run-Test (Join-Path $root 'staging071/bin/View/FishingPilot.View.exe') '--test-all' 'owner-tests.json'
Run-Test (Join-Path $root 'portable/dist/FishingPilot.exe') '--admin-tests' 'account-tests.json'
Copy-Item (Join-Path $root 'staging071/bin/View/FishingPilot.View.exe') (Join-Path $root 'portable/dist/') -Force
'0.7.4' | Set-Content (Join-Path $root 'portable/dist/owner-monitor.txt') -Encoding ascii

Run-Test (Join-Path $root 'portable/dist/FishingPilot.exe') '--experience-tests' 'experience-tests.json'
