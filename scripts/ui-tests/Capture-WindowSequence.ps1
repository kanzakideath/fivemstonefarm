#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$ProcessId,

    [string]$WindowTitlePattern = '.+',

    [Parameter(Mandatory)]
    [string]$OutputDirectory,

    [ValidateRange(1, 15)]
    [double]$DurationSeconds = 3,

    [ValidateRange(1, 20)]
    [int]$FramesPerSecond = 8,

    [ValidateRange(1, 300)]
    [int]$WaitTimeoutSeconds = 20,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'WindowCapture.psm1') -Force

$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
$manifestPath = Join-Path $resolvedOutput 'frames.json'
if ((Test-Path -LiteralPath $manifestPath) -and -not $Force) {
    throw "Refusing to overwrite an existing frame sequence: $manifestPath"
}
[void](New-Item -ItemType Directory -Path $resolvedOutput -Force)

$window = Get-UiWindowByProcess -ProcessId $ProcessId -WindowTitlePattern $WindowTitlePattern `
    -TimeoutSeconds $WaitTimeoutSeconds -StableMilliseconds 400
$frameCount = [int][Math]::Ceiling($DurationSeconds * $FramesPerSecond)
$intervalMilliseconds = 1000.0 / $FramesPerSecond
$stopwatch = [Diagnostics.Stopwatch]::StartNew()
$frames = [Collections.Generic.List[object]]::new()

for ($index = 0; $index -lt $frameCount; $index++) {
    $targetMilliseconds = $index * $intervalMilliseconds
    $remaining = $targetMilliseconds - $stopwatch.Elapsed.TotalMilliseconds
    if ($remaining -gt 1) { Start-Sleep -Milliseconds ([int][Math]::Floor($remaining)) }

    $name = 'frame-{0:D5}' -f $index
    $pngPath = Join-Path $resolvedOutput "$name.png"
    $metadataPath = Join-Path $resolvedOutput "$name.json"
    $metadata = Save-UiWindowCapture -Hwnd $window.Hwnd -ExpectedProcessId $ProcessId `
        -OutputPath $pngPath -MetadataPath $metadataPath -Force:$Force
    $frames.Add([ordered]@{
        index = $index
        elapsedMilliseconds = [int][Math]::Round($stopwatch.Elapsed.TotalMilliseconds)
        png = $pngPath
        metadata = $metadataPath
        width = $metadata.image.width
        height = $metadata.image.height
    })
}
$stopwatch.Stop()

$manifest = [ordered]@{
    schemaVersion = 1
    captureBackend = 'PrintWindow(PW_RENDERFULLCONTENT)'
    desktopFallbackUsed = $false
    processId = $ProcessId
    hwnd = ('0x{0:X}' -f $window.Hwnd)
    requestedFramesPerSecond = $FramesPerSecond
    requestedDurationSeconds = $DurationSeconds
    actualDurationMilliseconds = [int][Math]::Round($stopwatch.Elapsed.TotalMilliseconds)
    frames = $frames
    encodingHint = 'PNG frame sequence only; no encoder dependency is installed or invoked.'
}
$manifest | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
[pscustomobject]$manifest
