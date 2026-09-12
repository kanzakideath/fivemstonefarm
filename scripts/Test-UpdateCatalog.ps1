#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$UpdaterPath,
    [switch]$Live
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = Join-Path $repoRoot 'src\updater\Updater.cs'
$source = Get-Content -LiteralPath $sourcePath -Raw
$mainSource = Get-Content -LiteralPath (Join-Path $repoRoot 'src\mining-auto.ahk') -Raw
$webSource = Get-Content -LiteralPath (Join-Path $repoRoot 'src\ui-web\src\app.js') -Raw

function Assert([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

foreach ($requiredSourceFragment in @(
        'UPDATE_CAPS 1 CHECK CATALOG SELECT DOWNLOAD APPLY',
        'private static int RunCatalog(string[] args)',
        'private static int RunSelect(string[] args)',
        'SemanticVersion.ParseStable(args[2])',
        'DownloadAndVerifyVersion(candidate',
        'DownloadAndVerifyVersion(requestedVersion',
        'private const string MinimumSelectableVersion = "9.1.15";',
        'Versions older than " + MinimumSelectableVersion + " are not supported for safety.',
        'baa6f49a8dfad11fc1de401f9d0bef7cf309378e4e1c02c8f67598c277ee5b54',
        '3f0ceace85d2c74af8dfbf5ebb8038714e5c3a5be245b31926558f051152a6d0',
        '51cee7fd9caea79e7755a4cd7e7bda8631d81693638f3ad274aecc72a18a1ac0',
        'The signed manifest does not match the selected release version.',
        'Status", status',
        'LatestVersion", latestVersion',
        'Version" + suffix',
        'PublishedAt" + suffix')) {
    Assert ($source.Contains($requiredSourceFragment)) "Updater catalog contract is missing: $requiredSourceFragment"
}
Assert ($source.Contains('https://api.github.com/repos/kanzakideath/fivemstonefarm/releases?per_page=20&page=1')) `
    'The catalog must use the fixed, bounded GitHub releases endpoint.'
Assert ($source.Contains('releases/download/v" + version.Original + "/update-manifest.json')) `
    'Version selection must construct an immutable per-tag manifest URL internally.'
Assert ($source.Contains('releases/download/v" + version.Original + "/update-manifest.sig')) `
    'Version selection must construct an immutable per-tag signature URL internally.'
foreach ($requiredMainFragment in @(
        'BeginUpdateCatalog(silent := false)',
        'BeginSelectedVersionInstall(version)',
        'UpdateCatalogHasVersion(version)',
        'HandleUpdateSelectResult(result)',
        'selectedVersion != State.updateVersion',
        'downloadedVersion != State.updateVersion',
        'FinishUpdateProcessKeepLock()',
        'BeginUpdateDownload(true)')) {
    Assert ($mainSource.Contains($requiredMainFragment)) "AHK update pipeline contract is missing: $requiredMainFragment"
}
Assert ($mainSource.Contains('if operation = "select" || operation = "download"')) `
    'The selected-version transaction lock is released between verified stages.'
Assert ($webSource.Contains("sendAction('update.install', { version: selected.version })")) `
    'The version radio selection is not connected to the strict install action.'

$temporaryRoot = Join-Path $env:TEMP ('ai-miner-update-catalog-test-' + [Guid]::NewGuid().ToString('N'))
$updateStage = Join-Path $env:LOCALAPPDATA ('AI採掘機\updates\catalog-contract-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporaryRoot | Out-Null

try {
    if ([String]::IsNullOrWhiteSpace($UpdaterPath)) {
        $frameworkCandidates = @(
            (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
            (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'))
        $csc = $frameworkCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
        if (-not $csc) { throw '.NET Framework C# compiler v4 was not found.' }
        $UpdaterPath = Join-Path $temporaryRoot 'AI採掘機_Updater.exe'
        & $csc /nologo /target:winexe /platform:anycpu /optimize+ /debug- /warnaserror+ `
            "/out:$UpdaterPath" /reference:System.dll /reference:System.Core.dll `
            /reference:System.Web.Extensions.dll $sourcePath
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $UpdaterPath -PathType Leaf)) {
            throw 'Updater compilation failed.'
        }
    }
    else {
        $UpdaterPath = (Resolve-Path -LiteralPath $UpdaterPath).Path
    }

    function Invoke-Updater([string[]]$Arguments, [string]$ResultPath, [int]$TimeoutMilliseconds = 15000) {
        $quoted = foreach ($argument in $Arguments) { '"' + $argument.Replace('"', '""') + '"' }
        $process = Start-Process -FilePath $UpdaterPath -ArgumentList ($quoted -join ' ') -PassThru -WindowStyle Hidden
        [void]$process.Handle
        if (-not $process.WaitForExit($TimeoutMilliseconds)) {
            try { $process.Kill() } catch { }
            throw "Updater command timed out: $($Arguments[0])"
        }
        for ($attempt = 0; $attempt -lt 20 -and -not (Test-Path -LiteralPath $ResultPath -PathType Leaf); $attempt++) {
            Start-Sleep -Milliseconds 50
        }
        Assert (Test-Path -LiteralPath $ResultPath -PathType Leaf) "Updater did not write a result: $($Arguments[0])"
        return @{
            ExitCode = $process.ExitCode
            Text = Get-Content -LiteralPath $ResultPath -Raw -Encoding UTF8
        }
    }

    $capabilitiesPath = Join-Path $temporaryRoot 'capabilities.txt'
    $capabilities = Invoke-Updater @('capabilities', $capabilitiesPath) $capabilitiesPath
    Assert ($capabilities.ExitCode -eq 0) 'Updater capabilities command failed.'
    Assert ($capabilities.Text.Trim() -eq 'UPDATE_CAPS 1 CHECK CATALOG SELECT DOWNLOAD APPLY') `
        'Updater did not advertise the catalog/select capabilities.'

    $invalidVersions = @(
        '9.1.17-beta',
        '9.1.17+local',
        'v9.1.17',
        '9.01.17',
        '9.1.14',
        '9.1.17/../../evil',
        'https://example.invalid/update-manifest.json')
    for ($index = 0; $index -lt $invalidVersions.Count; $index++) {
        $resultPath = Join-Path $temporaryRoot ("invalid-select-$index.txt")
        $result = Invoke-Updater @('select', $resultPath, $invalidVersions[$index], $updateStage) $resultPath
        Assert ($result.ExitCode -ne 0) "Unsafe version input was accepted: $($invalidVersions[$index])"
        Assert ($result.Text -match '(?m)^Status=ERROR\r?$') "Unsafe version did not fail closed: $($invalidVersions[$index])"
        Assert ($result.Text -notmatch '(?m)^ManifestPath=[^\r\n]+') "Unsafe version staged a manifest: $($invalidVersions[$index])"
    }

    $invalidCatalogPath = Join-Path $temporaryRoot 'invalid-catalog.txt'
    $invalidCatalog = Invoke-Updater @('catalog', $invalidCatalogPath, '9.1.17-beta', $updateStage) $invalidCatalogPath
    Assert ($invalidCatalog.ExitCode -ne 0) 'Catalog accepted a non-stable current version.'
    Assert ($invalidCatalog.Text -match '(?m)^Status=ERROR\r?$') 'Invalid catalog input did not fail closed.'
    Assert ($invalidCatalog.Text -match '(?m)^Count=0\r?$') 'Invalid catalog result did not return an empty deterministic catalog.'

    if ($Live) {
        $catalogPath = Join-Path $temporaryRoot 'catalog.txt'
        $catalog = Invoke-Updater @('catalog', $catalogPath, '9.1.17', $updateStage) $catalogPath 120000
        Assert ($catalog.ExitCode -eq 0) 'Live signed catalog query failed.'
        Assert ($catalog.Text -match '(?m)^Status=CATALOG_READY\r?$') 'Live catalog status is not CATALOG_READY.'
        $countMatch = [Regex]::Match($catalog.Text, '(?m)^Count=([0-9]+)\r?$')
        Assert $countMatch.Success 'Live catalog did not report Count.'
        $count = [int]$countMatch.Groups[1].Value
        Assert ($count -ge 1 -and $count -le 20) 'Live catalog Count is outside the bounded range.'
        $versions = @()
        for ($index = 0; $index -lt $count; $index++) {
            $versionMatch = [Regex]::Match($catalog.Text, "(?m)^Version$index=((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))\r?$")
            $publishedMatch = [Regex]::Match($catalog.Text, "(?m)^PublishedAt$index=([0-9]{4}-[0-9]{2}-[0-9]{2}T[^\r\n]+Z)\r?$")
            Assert $versionMatch.Success "Live catalog entry $index has an invalid stable version."
            Assert $publishedMatch.Success "Live catalog entry $index is missing its signed publication time."
            $versions += $versionMatch.Groups[1].Value
        }
        Assert (($versions | Select-Object -Unique).Count -eq $versions.Count) 'Live catalog contains duplicate versions.'

        $selectPath = Join-Path $temporaryRoot 'selected.txt'
        $selected = Invoke-Updater @('select', $selectPath, $versions[0], $updateStage) $selectPath 30000
        Assert ($selected.ExitCode -eq 0) 'Live exact-version selection failed.'
        Assert ($selected.Text -match '(?m)^Status=VERSION_SELECTED\r?$') 'Live selection status is not VERSION_SELECTED.'
        Assert ($selected.Text -match "(?m)^Version=$([Regex]::Escape($versions[0]))\r?$") 'Live selection returned the wrong signed version.'
        $manifestPath = [Regex]::Match($selected.Text, '(?m)^ManifestPath=([^\r\n]+)\r?$').Groups[1].Value
        $signaturePath = [Regex]::Match($selected.Text, '(?m)^SignaturePath=([^\r\n]+)\r?$').Groups[1].Value
        Assert (Test-Path -LiteralPath $manifestPath -PathType Leaf) 'Live selection did not stage its verified manifest.'
        Assert (Test-Path -LiteralPath $signaturePath -PathType Leaf) 'Live selection did not stage its verified signature.'
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert ($manifest.version -eq $versions[0]) 'The staged signed manifest version does not match the selection.'

        $downloadResultPath = Join-Path $temporaryRoot 'downloaded.txt'
        $stagedExecutable = Join-Path $updateStage 'ai-miner-win-x64.exe'
        $downloaded = Invoke-Updater @(
            'download', $downloadResultPath, $manifestPath, $signaturePath, $stagedExecutable
        ) $downloadResultPath 180000
        Assert ($downloaded.ExitCode -eq 0) 'Live selected-version download failed.'
        Assert ($downloaded.Text -match '(?m)^Status=DOWNLOADED\r?$') 'Live download status is not DOWNLOADED.'
        Assert ($downloaded.Text -match "(?m)^Version=$([Regex]::Escape($versions[0]))\r?$") `
            'Live download returned the wrong signed version.'
        Assert (Test-Path -LiteralPath $stagedExecutable -PathType Leaf) `
            'Live download did not create the selected executable.'
        Assert ((Get-Item -LiteralPath $stagedExecutable).Length -eq [int64]$manifest.artifact.size) `
            'Live downloaded executable size differs from the signed manifest.'
        Assert ((Get-FileHash -LiteralPath $stagedExecutable -Algorithm SHA256).Hash.ToLowerInvariant() -ceq
            ([string]$manifest.artifact.sha256).ToLowerInvariant()) `
            'Live downloaded executable hash differs from the signed manifest.'
    }

    Write-Host 'UPDATE_CATALOG_CONTRACT_PASS'
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force }
    if (Test-Path -LiteralPath $updateStage) { Remove-Item -LiteralPath $updateStage -Recurse -Force }
}
