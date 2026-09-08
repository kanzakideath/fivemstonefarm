#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'WindowCapture.psm1') -Force

$result = [ordered]@{
    schemaVersion = 1
    capturedAtUtc = [DateTime]::UtcNow.ToString('o')
    note = 'Monitor DPI is observed only; this script never changes Windows display settings.'
    monitors = @(Get-UiMonitorInventory | ForEach-Object {
        [ordered]@{
            deviceName = $_.DeviceName
            primary = $_.Primary
            bounds = [ordered]@{ left = $_.Left; top = $_.Top; width = $_.Width; height = $_.Height }
            workArea = [ordered]@{ left = $_.WorkLeft; top = $_.WorkTop; width = $_.WorkWidth; height = $_.WorkHeight }
            effectiveDpiX = $_.EffectiveDpiX
            effectiveDpiY = $_.EffectiveDpiY
            scalePercent = $_.ScalePercent
        }
    })
}

$json = $result | ConvertTo-Json -Depth 6
if ($OutputPath) {
    $resolved = [IO.Path]::GetFullPath($OutputPath)
    $parent = Split-Path -Parent $resolved
    if ($parent) { [void](New-Item -ItemType Directory -Path $parent -Force) }
    $json | Set-Content -LiteralPath $resolved -Encoding UTF8
}
$json
