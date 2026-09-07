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

$zipPath = Join-Path $artifactRoot ("AI採掘機-v$($manifest.version).zip")
if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
    throw "Release ZIP is missing: $zipPath"
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
