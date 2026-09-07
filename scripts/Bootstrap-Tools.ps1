#Requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolsRoot = Join-Path $repoRoot 'tools'
$cacheRoot = Join-Path $repoRoot '.cache\build-tools'
$autoHotkeyRoot = Join-Path $toolsRoot 'AutoHotkey'
$markerPath = Join-Path $toolsRoot '.toolchain.json'

$autoHotkey = [ordered]@{
    Version = '2.0.26'
    Url = 'https://github.com/AutoHotkey/AutoHotkey/releases/download/v2.0.26/AutoHotkey_2.0.26.zip'
    Sha256 = '43522aa3122a57784ac5db30abf85c2244475c36acd7796e2c993355f9e926ae'
    Archive = 'AutoHotkey_2.0.26.zip'
}
$ahk2Exe = [ordered]@{
    Version = '1.1.37.02a2'
    Url = 'https://github.com/AutoHotkey/Ahk2Exe/releases/download/Ahk2Exe1.1.37.02a2/Ahk2Exe1.1.37.02a2.zip'
    Sha256 = 'c29b8c3a5124850d79fc9e66e2ca79677c377d7f31631ad3022ba159c5d9e3be'
    Archive = 'Ahk2Exe1.1.37.02a2.zip'
}

function Get-VerifiedArchive {
    param(
        [Parameter(Mandatory)] [string]$Uri,
        [Parameter(Mandatory)] [string]$Destination,
        [Parameter(Mandatory)] [string]$ExpectedSha256
    )

    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        $cachedHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($cachedHash -ne $ExpectedSha256) {
            Remove-Item -LiteralPath $Destination -Force
        }
    }

    if (-not (Test-Path -LiteralPath $Destination -PathType Leaf)) {
        Write-Host "Downloading $Uri"
        Invoke-WebRequest -Uri $Uri -OutFile $Destination -MaximumRedirection 10
    }

    $actualHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $ExpectedSha256) {
        Remove-Item -LiteralPath $Destination -Force
        throw "Build tool hash mismatch: $Destination"
    }
}

function Test-InstalledToolchain {
    if ($Force) { return $false }

    $runtime = Join-Path $autoHotkeyRoot 'AutoHotkey64.exe'
    $compiler = Join-Path $autoHotkeyRoot 'Compiler\Ahk2Exe.exe'
    if (-not (Test-Path -LiteralPath $runtime -PathType Leaf) -or
        -not (Test-Path -LiteralPath $compiler -PathType Leaf) -or
        -not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        return $false
    }

    try {
        $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
        return $marker.autoHotkeyVersion -eq $autoHotkey.Version -and
            $marker.ahk2ExeVersion -eq $ahk2Exe.Version
    }
    catch {
        return $false
    }
}

if (Test-InstalledToolchain) {
    Write-Host "Pinned AutoHotkey toolchain is ready: $autoHotkeyRoot"
    return
}

New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null

$autoHotkeyArchive = Join-Path $cacheRoot $autoHotkey.Archive
$ahk2ExeArchive = Join-Path $cacheRoot $ahk2Exe.Archive
Get-VerifiedArchive -Uri $autoHotkey.Url -Destination $autoHotkeyArchive -ExpectedSha256 $autoHotkey.Sha256
Get-VerifiedArchive -Uri $ahk2Exe.Url -Destination $ahk2ExeArchive -ExpectedSha256 $ahk2Exe.Sha256

$extractRoot = Join-Path $toolsRoot ('.extract-' + $PID + '-' + [Guid]::NewGuid().ToString('N'))
$autoHotkeyExtract = Join-Path $extractRoot 'autohotkey'
$ahk2ExeExtract = Join-Path $extractRoot 'ahk2exe'

try {
    New-Item -ItemType Directory -Path $autoHotkeyExtract -Force | Out-Null
    New-Item -ItemType Directory -Path $ahk2ExeExtract -Force | Out-Null
    Expand-Archive -LiteralPath $autoHotkeyArchive -DestinationPath $autoHotkeyExtract -Force
    Expand-Archive -LiteralPath $ahk2ExeArchive -DestinationPath $ahk2ExeExtract -Force

    $runtime = Get-ChildItem -LiteralPath $autoHotkeyExtract -Recurse -File -Filter 'AutoHotkey64.exe' |
        Sort-Object { $_.FullName.Length } | Select-Object -First 1
    if (-not $runtime) { throw 'AutoHotkey64.exe was not found in the verified archive.' }

    $compiler = Get-ChildItem -LiteralPath $ahk2ExeExtract -Recurse -File -Filter 'Ahk2Exe.exe' |
        Sort-Object { $_.FullName.Length } | Select-Object -First 1
    if (-not $compiler) { throw 'Ahk2Exe.exe was not found in the verified archive.' }

    if (Test-Path -LiteralPath $autoHotkeyRoot) {
        Remove-Item -LiteralPath $autoHotkeyRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $autoHotkeyRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $runtime.Directory.FullName '*') -Destination $autoHotkeyRoot -Recurse -Force

    $compilerDestination = Join-Path $autoHotkeyRoot 'Compiler'
    New-Item -ItemType Directory -Path $compilerDestination -Force | Out-Null
    Copy-Item -Path (Join-Path $compiler.Directory.FullName '*') -Destination $compilerDestination -Recurse -Force

    $installedRuntime = Join-Path $autoHotkeyRoot 'AutoHotkey64.exe'
    $installedCompiler = Join-Path $compilerDestination 'Ahk2Exe.exe'
    if (-not (Test-Path -LiteralPath $installedRuntime -PathType Leaf) -or
        -not (Test-Path -LiteralPath $installedCompiler -PathType Leaf)) {
        throw 'Pinned toolchain installation did not produce the expected files.'
    }

    $marker = [ordered]@{
        autoHotkeyVersion = $autoHotkey.Version
        autoHotkeyArchiveSha256 = $autoHotkey.Sha256
        ahk2ExeVersion = $ahk2Exe.Version
        ahk2ExeArchiveSha256 = $ahk2Exe.Sha256
    } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($markerPath, $marker, [System.Text.UTF8Encoding]::new($false))
}
finally {
    if (Test-Path -LiteralPath $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
}

Write-Host "Installed pinned AutoHotkey toolchain: $autoHotkeyRoot"
