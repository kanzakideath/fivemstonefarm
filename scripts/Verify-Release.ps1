#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ArtifactDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$expectedProduct = 'kanzakideath/fivemstonefarm'
$expectedPublicKeyCngBlob = 'RUNTMSAAAADNPm0f29gN5/Z64LDW7PPhoHTASFEmisabIQLTSUGQB7/esquq63IysJ3zsy57FPrv/wDF6vFVUtjw6epa1nMz'
$artifactRoot = [System.IO.Path]::GetFullPath($ArtifactDirectory)
$manifestPath = Join-Path $artifactRoot 'update-manifest.json'
$signaturePath = Join-Path $artifactRoot 'update-manifest.sig'
$executablePath = Join-Path $artifactRoot 'ai-miner-win-x64.exe'
$sumsPath = Join-Path $artifactRoot 'SHA256SUMS.txt'

foreach ($requiredFile in @($manifestPath, $signaturePath, $executablePath, $sumsPath)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Release asset is missing: $requiredFile"
    }
}

[byte[]]$manifestBytes = [System.IO.File]::ReadAllBytes($manifestPath)
$manifestText = [System.Text.UTF8Encoding]::new($false, $true).GetString($manifestBytes)
if ($manifestText.Contains("`r") -or $manifestText.Contains("`n") -or $manifestText.StartsWith([char]0xFEFF)) {
    throw 'Manifest must be compact UTF-8 without BOM or trailing newline.'
}
$manifest = $manifestText | ConvertFrom-Json

if ([int]$manifest.schema -ne 1 -or $manifest.product -ne $expectedProduct -or $manifest.channel -ne 'stable') {
    throw 'Manifest identity or schema is invalid.'
}
if ($manifest.version -notmatch '^\d+\.\d+\.\d+$' -or $manifest.minimumUpdaterVersion -notmatch '^\d+\.\d+\.\d+$') {
    throw 'Manifest version is not strict semantic version x.y.z.'
}

$expectedTag = 'v' + $manifest.version
$expectedArtifactUrl = "https://github.com/$expectedProduct/releases/download/$expectedTag/ai-miner-win-x64.exe"
$expectedNotesUrl = "https://github.com/$expectedProduct/releases/tag/$expectedTag"
if ($manifest.artifact.name -ne 'ai-miner-win-x64.exe' -or
    $manifest.artifact.url -ne $expectedArtifactUrl -or
    $manifest.releaseNotesUrl -ne $expectedNotesUrl) {
    throw 'Manifest URL allowlist validation failed.'
}

$exe = Get-Item -LiteralPath $executablePath
$exeHash = (Get-FileHash -LiteralPath $executablePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ([long]$manifest.artifact.size -ne $exe.Length -or $manifest.artifact.sha256 -cne $exeHash) {
    throw 'Manifest executable size or SHA-256 does not match.'
}

[byte[]]$signature = [Convert]::FromBase64String((Get-Content -LiteralPath $signaturePath -Raw).Trim())
if ($signature.Length -ne 64) {
    throw 'Manifest signature must be a 64-byte IEEE-P1363 ECDSA signature.'
}

[byte[]]$publicBlob = [Convert]::FromBase64String($expectedPublicKeyCngBlob)
$cngKey = [System.Security.Cryptography.CngKey]::Import(
    $publicBlob,
    [System.Security.Cryptography.CngKeyBlobFormat]::EccPublicBlob
)
$ecdsa = [System.Security.Cryptography.ECDsaCng]::new($cngKey)
try {
    $verified = $ecdsa.VerifyData(
        $manifestBytes,
        $signature,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.DSASignatureFormat]::IeeeP1363FixedFieldConcatenation
    )
    if (-not $verified) { throw 'Manifest signature verification failed.' }
}
finally {
    $ecdsa.Dispose()
    $cngKey.Dispose()
}

$zipPath = Join-Path $artifactRoot ("AI-Miner-v$($manifest.version).zip")
if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
    throw "Release ZIP is missing: $zipPath"
}
Add-Type -AssemblyName System.IO.Compression
$requiredDesktopEntries = @(
    'AI採掘機.exe',
    'AI採掘機.ini',
    'AI採掘機_使い方.txt',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'licenses/AutoHotkey-license.txt',
    'licenses/Dom7-LICENSE.txt',
    'licenses/Framework7-LICENSE.txt',
    'licenses/HTM-LICENSE.txt',
    'licenses/Path-to-RegExp-LICENSE.txt',
    'licenses/Skeleton-Elements-LICENSE.txt',
    'licenses/SSR-Window-4-LICENSE.txt',
    'licenses/SSR-Window-5-LICENSE.txt',
    'licenses/Swiper-LICENSE.txt',
    'licenses/WebView2-LICENSE.txt',
    'licenses/WebView2-NOTICE.txt'
)
$stream = [System.IO.File]::OpenRead($zipPath)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Read, $false)
try {
    $expectedEntrySet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($requiredEntry in $requiredDesktopEntries) {
        if (-not $expectedEntrySet.Add($requiredEntry)) {
            throw "Duplicate entry in the release allowlist: $requiredEntry"
        }
    }
    $actualEntrySet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($entry in $archive.Entries) {
        if (-not $actualEntrySet.Add($entry.FullName)) {
            throw "Duplicate ZIP entry is not allowed: $($entry.FullName)"
        }
        if (-not $expectedEntrySet.Contains($entry.FullName)) {
            throw "Unexpected desktop ZIP entry: $($entry.FullName)"
        }
    }
    if ($actualEntrySet.Count -ne $expectedEntrySet.Count) {
        throw 'Desktop ZIP entries do not match the release allowlist.'
    }

    foreach ($requiredEntry in $requiredDesktopEntries) {
        $matches = @($archive.Entries | Where-Object { $_.FullName -ceq $requiredEntry })
        if ($matches.Count -ne 1) {
            throw "Required desktop entry must occur exactly once: $requiredEntry"
        }
        if ($matches[0].Length -le 0) {
            throw "Required desktop entry is empty: $requiredEntry"
        }
    }

    $packagedExecutable = $archive.GetEntry('AI採掘機.exe')
    if ($packagedExecutable.Length -ne $exe.Length) {
        throw 'The executable in the desktop ZIP has an unexpected size.'
    }
    $packagedExecutableStream = $packagedExecutable.Open()
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $packagedExecutableHash = [BitConverter]::ToString(
            $sha256.ComputeHash($packagedExecutableStream)
        ).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
        $packagedExecutableStream.Dispose()
    }
    if ($packagedExecutableHash -cne $exeHash) {
        throw 'The executable in the desktop ZIP does not match the signed release executable.'
    }
}
finally {
    $archive.Dispose()
    $stream.Dispose()
}

$sumAssets = @($executablePath, $zipPath, $manifestPath, $signaturePath)
$expectedSums = foreach ($path in $sumAssets) {
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([System.IO.Path]::GetFileName($path))"
}
$actualSums = (Get-Content -LiteralPath $sumsPath -Raw).Replace("`r`n", "`n").TrimEnd("`n")
if ($actualSums -cne ($expectedSums -join "`n")) {
    throw 'SHA256SUMS.txt does not match the release assets.'
}

Write-Host "Release verification passed: $artifactRoot"
