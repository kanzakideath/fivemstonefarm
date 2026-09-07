#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [switch]$SkipToolBootstrap
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = Join-Path $repoRoot 'src'
$buildRoot = Join-Path $repoRoot 'build'
$stageRoot = Join-Path $buildRoot 'staging'
$distRoot = Join-Path $repoRoot 'dist'
$mainSource = Join-Path $sourceRoot 'mining-auto.ahk'
$bridgeSource = Join-Path $sourceRoot 'background-bridge\CdpBridge.cs'
$updaterSource = Join-Path $sourceRoot 'updater\Updater.cs'
$toolRoot = Join-Path $repoRoot 'tools\AutoHotkey'
$autoHotkey = Join-Path $toolRoot 'AutoHotkey64.exe'
$ahk2Exe = Join-Path $toolRoot 'Compiler\Ahk2Exe.exe'
$outputExe = Join-Path $distRoot 'ai-miner-win-x64.exe'

if (-not $SkipToolBootstrap) {
    & (Join-Path $PSScriptRoot 'Bootstrap-Tools.ps1')
}

foreach ($requiredFile in @($mainSource, $bridgeSource, $updaterSource, $autoHotkey, $ahk2Exe)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required build input is missing: $requiredFile"
    }
}

$mainText = Get-Content -LiteralPath $mainSource -Raw
$versionMatch = [regex]::Match(
    $mainText,
    '(?m)^\s*(?:global\s+)?AppVersion\s*:?=\s*["''](?<version>\d+\.\d+\.\d+)["'']'
)
if (-not $versionMatch.Success) {
    throw 'AppVersion was not found in src/mining-auto.ahk.'
}
if ($versionMatch.Groups['version'].Value -ne $Version) {
    throw "Source AppVersion '$($versionMatch.Groups['version'].Value)' does not match requested version '$Version'."
}

if (Test-Path -LiteralPath $stageRoot) {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
if (Test-Path -LiteralPath $distRoot) {
    Remove-Item -LiteralPath $distRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null

Copy-Item -Path (Join-Path $sourceRoot '*') -Destination $stageRoot -Recurse -Force
$assetRoot = Join-Path $sourceRoot 'assets'
if (Test-Path -LiteralPath $assetRoot -PathType Container) {
    Get-ChildItem -LiteralPath $assetRoot -File | Copy-Item -Destination $stageRoot -Force
}

$frameworkCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$csc = $frameworkCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $csc) {
    throw '.NET Framework C# compiler v4 was not found.'
}

function Invoke-CSharpBuild {
    param(
        [Parameter(Mandatory)] [string]$Source,
        [Parameter(Mandatory)] [string]$Output
    )

    $arguments = @(
        '/nologo',
        '/target:winexe',
        '/platform:anycpu',
        '/optimize+',
        '/debug-',
        "/out:$Output",
        '/reference:System.dll',
        '/reference:System.Core.dll',
        '/reference:System.Web.Extensions.dll',
        $Source
    )
    & $csc @arguments
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Output -PathType Leaf)) {
        throw "C# compilation failed: $Source"
    }
}

function Invoke-CapabilitySmokeTest {
    param(
        [Parameter(Mandatory)] [string]$Executable,
        [Parameter(Mandatory)] [string]$Expected,
        [ValidateSet('capabilities', 'self-test')] [string]$Mode = 'capabilities'
    )

    $resultPath = Join-Path $stageRoot ([System.IO.Path]::GetFileNameWithoutExtension($Executable) + '-' + $Mode + '.txt')
    if (Test-Path -LiteralPath $resultPath) { Remove-Item -LiteralPath $resultPath -Force }

    $argumentLine = $Mode + ' "' + $resultPath.Replace('"', '""') + '"'
    $process = Start-Process -FilePath $Executable -ArgumentList $argumentLine -PassThru -WindowStyle Hidden
    if (-not $process.WaitForExit(15000)) {
        try { $process.Kill() } catch { }
        throw "Capability smoke test timed out: $Executable"
    }
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
        throw "Capability smoke test failed: $Executable (exit $($process.ExitCode))"
    }

    $actual = (Get-Content -LiteralPath $resultPath -Raw).Trim()
    if ($actual -ne $Expected) {
        throw "Unexpected capability response from $Executable. Expected '$Expected', got '$actual'."
    }
}

$bridgeOutput = Join-Path $stageRoot 'AI採掘機_Background.exe'
$updaterOutput = Join-Path $stageRoot 'AI採掘機_Updater.exe'
Invoke-CSharpBuild -Source $bridgeSource -Output $bridgeOutput
Invoke-CSharpBuild -Source $updaterSource -Output $updaterOutput
Invoke-CapabilitySmokeTest -Executable $bridgeOutput -Expected 'CAPS 4 MINE WASH GOLD NUDGE STORAGE INVENTORY ROUTE TRY'
Invoke-CapabilitySmokeTest -Executable $bridgeOutput -Expected 'SELFTEST OK' -Mode 'self-test'
Invoke-CapabilitySmokeTest -Executable $updaterOutput -Expected 'UPDATE_CAPS 1 CHECK DOWNLOAD APPLY'

$stagedMain = Join-Path $stageRoot 'mining-auto.ahk'
Push-Location $stageRoot
try {
    $quotedMain = '"' + $stagedMain + '"'
    $quotedOutput = '"' + $outputExe + '"'
    $quotedBase = '"' + $autoHotkey + '"'
    $compilerProcess = Start-Process -FilePath $ahk2Exe `
        -ArgumentList @('/in', $quotedMain, '/out', $quotedOutput, '/base', $quotedBase, '/compress', '0') `
        -PassThru -Wait -WindowStyle Hidden
    if ($compilerProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $outputExe -PathType Leaf)) {
        throw 'Ahk2Exe compilation failed.'
    }
}
finally {
    Pop-Location
}

foreach ($testMode in @('--validate', '--smoke-test')) {
    $testProcess = Start-Process -FilePath $outputExe -ArgumentList $testMode -PassThru -WindowStyle Hidden
    if (-not $testProcess.WaitForExit(30000)) {
        try { $testProcess.Kill() } catch { }
        throw "Compiled application $testMode timed out."
    }
    if ($testProcess.ExitCode -ne 0) {
        throw "Compiled application $testMode failed with exit code $($testProcess.ExitCode)."
    }
}

$builtFile = Get-Item -LiteralPath $outputExe
if ($builtFile.Length -lt 100KB -or $builtFile.Length -gt 30MB) {
    throw "Compiled executable size is outside the release policy: $($builtFile.Length) bytes."
}

Write-Host "Build and smoke tests passed: $outputExe"
[pscustomobject]@{
    Version = $Version
    Executable = $outputExe
    Size = $builtFile.Length
    Sha256 = (Get-FileHash -LiteralPath $outputExe -Algorithm SHA256).Hash.ToLowerInvariant()
}
