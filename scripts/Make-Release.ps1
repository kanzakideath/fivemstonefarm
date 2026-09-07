#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [ValidatePattern('^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')]
    [string]$PublishedAt
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tag = "v$Version"
$artifactRoot = Join-Path $repoRoot ("artifacts\$tag")
$packageRoot = Join-Path $repoRoot ("build\package-$tag")
$directExecutable = Join-Path $artifactRoot 'ai-miner-win-x64.exe'
$zipPath = Join-Path $artifactRoot ("AI採掘機-$tag.zip")
$manifestPath = Join-Path $artifactRoot 'update-manifest.json'
$signaturePath = Join-Path $artifactRoot 'update-manifest.sig'
$sumsPath = Join-Path $artifactRoot 'SHA256SUMS.txt'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$expectedPublicKeyCngBlob = 'RUNTMSAAAADNPm0f29gN5/Z64LDW7PPhoHTASFEmisabIQLTSUGQB7/esquq63IysJ3zsy57FPrv/wDF6vFVUtjw6epa1nMz'

if ([string]::IsNullOrWhiteSpace($PublishedAt)) {
    $commitSecondsText = (& git -C $repoRoot show -s --format=%ct HEAD).Trim()
    [long]$commitSeconds = 0
    if ($LASTEXITCODE -ne 0 -or -not [long]::TryParse($commitSecondsText, [ref]$commitSeconds)) {
        throw 'PublishedAt was omitted and the Git commit timestamp could not be read.'
    }
    $PublishedAt = [DateTimeOffset]::FromUnixTimeSeconds($commitSeconds).UtcDateTime.ToString('yyyy-MM-ddTHH:mm:ssZ')
}
$publishedDate = [DateTimeOffset]::ParseExact(
    $PublishedAt,
    'yyyy-MM-ddTHH:mm:ssZ',
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::AssumeUniversal
)

& (Join-Path $PSScriptRoot 'Build.ps1') -Version $Version

if (Test-Path -LiteralPath $artifactRoot) {
    Remove-Item -LiteralPath $artifactRoot -Recurse -Force
}
if (Test-Path -LiteralPath $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null

$builtExecutable = Join-Path $repoRoot 'dist\ai-miner-win-x64.exe'
Copy-Item -LiteralPath $builtExecutable -Destination $directExecutable -Force
Copy-Item -LiteralPath $builtExecutable -Destination (Join-Path $packageRoot 'AI採掘機.exe') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'config\AI採掘機.ini') -Destination $packageRoot -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\AI採掘機_使い方.txt') -Destination $packageRoot -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'LICENSE') -Destination $packageRoot -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'THIRD_PARTY_NOTICES.md') -Destination $packageRoot -Force

$autoHotkeyLicense = Join-Path $repoRoot 'tools\AutoHotkey\license.txt'
if (-not (Test-Path -LiteralPath $autoHotkeyLicense -PathType Leaf)) {
    throw 'AutoHotkey license.txt was not found in the verified toolchain.'
}
$licenseDirectory = Join-Path $packageRoot 'licenses'
New-Item -ItemType Directory -Path $licenseDirectory -Force | Out-Null
Copy-Item -LiteralPath $autoHotkeyLicense -Destination (Join-Path $licenseDirectory 'AutoHotkey-license.txt') -Force

Add-Type -AssemblyName System.IO.Compression
$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite)
$zip = [System.IO.Compression.ZipArchive]::new(
    $zipStream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $false,
    [System.Text.Encoding]::UTF8
)
try {
    $fixedTimestamp = $publishedDate.ToUniversalTime()
    if ($fixedTimestamp.Year -lt 1980) { $fixedTimestamp = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero) }

    $packageFiles = Get-ChildItem -LiteralPath $packageRoot -Recurse -File | Sort-Object FullName
    foreach ($file in $packageFiles) {
        $relative = [System.IO.Path]::GetRelativePath($packageRoot, $file.FullName).Replace('\', '/')
        $entry = $zip.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = $fixedTimestamp
        $entryStream = $entry.Open()
        $inputStream = $file.OpenRead()
        try { $inputStream.CopyTo($entryStream) }
        finally {
            $inputStream.Dispose()
            $entryStream.Dispose()
        }
    }
}
finally {
    $zip.Dispose()
    $zipStream.Dispose()
}

$exeItem = Get-Item -LiteralPath $directExecutable
$exeSha256 = (Get-FileHash -LiteralPath $directExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
    schema = 1
    product = 'kanzakideath/fivemstonefarm'
    channel = 'stable'
    version = $Version
    publishedAt = $PublishedAt
    minimumUpdaterVersion = '5.2.0'
    artifact = [ordered]@{
        name = 'ai-miner-win-x64.exe'
        url = "https://github.com/kanzakideath/fivemstonefarm/releases/download/$tag/ai-miner-win-x64.exe"
        size = $exeItem.Length
        sha256 = $exeSha256
    }
    releaseNotesUrl = "https://github.com/kanzakideath/fivemstonefarm/releases/tag/$tag"
}
$manifestJson = $manifest | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8NoBom)
[byte[]]$manifestBytes = [System.IO.File]::ReadAllBytes($manifestPath)

$signingKeyText = [Environment]::GetEnvironmentVariable('UPDATE_SIGNING_KEY_PKCS8_B64')
if ([string]::IsNullOrWhiteSpace($signingKeyText)) {
    throw 'UPDATE_SIGNING_KEY_PKCS8_B64 is required to create a release.'
}

[byte[]]$privateKeyBytes = [Convert]::FromBase64String($signingKeyText.Trim())

# PowerShell cannot bind byte[] to the ReadOnlySpan<byte> parameter of
# ImportPkcs8PrivateKey. Keep the secret in memory and cross that API boundary
# in a small in-process C# helper; the helper clears the caller's byte array.
Add-Type -TypeDefinition @'
using System;
using System.Security.Cryptography;

public sealed class AiMinerReleaseSigningResult
{
    public byte[] Signature { get; set; }
    public byte[] PublicCngBlob { get; set; }
}

public static class AiMinerReleaseSigner
{
    public static AiMinerReleaseSigningResult Sign(byte[] privateKeyPkcs8, byte[] data)
    {
        if (privateKeyPkcs8 == null || privateKeyPkcs8.Length == 0)
            throw new ArgumentException("PKCS#8 key is empty.", "privateKeyPkcs8");
        if (data == null)
            throw new ArgumentNullException("data");

        using (ECDsa ecdsa = ECDsa.Create())
        {
            try
            {
                int bytesRead;
                ecdsa.ImportPkcs8PrivateKey(privateKeyPkcs8, out bytesRead);
                if (bytesRead != privateKeyPkcs8.Length || ecdsa.KeySize != 256)
                    throw new CryptographicException("The key must be exactly one ECDSA P-256 PKCS#8 key.");

                ECParameters parameters = ecdsa.ExportParameters(false);
                if (parameters.Q.X == null || parameters.Q.Y == null ||
                    parameters.Q.X.Length != 32 || parameters.Q.Y.Length != 32)
                    throw new CryptographicException("The signing public point is not P-256.");

                byte[] publicBlob = new byte[72];
                Buffer.BlockCopy(BitConverter.GetBytes(0x31534345U), 0, publicBlob, 0, 4);
                Buffer.BlockCopy(BitConverter.GetBytes(32U), 0, publicBlob, 4, 4);
                Buffer.BlockCopy(parameters.Q.X, 0, publicBlob, 8, 32);
                Buffer.BlockCopy(parameters.Q.Y, 0, publicBlob, 40, 32);

                byte[] signature = ecdsa.SignData(
                    data,
                    HashAlgorithmName.SHA256,
                    DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
                if (signature.Length != 64 || !ecdsa.VerifyData(
                    data,
                    signature,
                    HashAlgorithmName.SHA256,
                    DSASignatureFormat.IeeeP1363FixedFieldConcatenation))
                    throw new CryptographicException("The generated IEEE-P1363 signature did not verify.");

                return new AiMinerReleaseSigningResult
                {
                    Signature = signature,
                    PublicCngBlob = publicBlob
                };
            }
            finally
            {
                CryptographicOperations.ZeroMemory(privateKeyPkcs8);
            }
        }
    }
}
'@

try {
    $signingResult = [AiMinerReleaseSigner]::Sign($privateKeyBytes, $manifestBytes)
    if ([Convert]::ToBase64String($signingResult.PublicCngBlob) -cne $expectedPublicKeyCngBlob) {
        throw 'Signing secret does not match the public key embedded in AI採掘機.'
    }
    [System.IO.File]::WriteAllText(
        $signaturePath,
        [Convert]::ToBase64String($signingResult.Signature) + "`n",
        $utf8NoBom
    )
}
finally {
    # AiMinerReleaseSigner clears this array even when signing fails. Array.Clear
    # also covers failures that occur before the helper is entered.
    [Array]::Clear($privateKeyBytes, 0, $privateKeyBytes.Length)
    $signingKeyText = $null
}

$sumAssets = @($directExecutable, $zipPath, $manifestPath, $signaturePath)
$sumLines = foreach ($path in $sumAssets) {
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([System.IO.Path]::GetFileName($path))"
}
[System.IO.File]::WriteAllText($sumsPath, ($sumLines -join "`n") + "`n", $utf8NoBom)

& (Join-Path $PSScriptRoot 'Verify-Release.ps1') -ArtifactDirectory $artifactRoot
Write-Host "Release assets are ready: $artifactRoot"
