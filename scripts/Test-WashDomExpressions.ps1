#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Bridge
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedBridge = [IO.Path]::GetFullPath($Bridge)
if (-not (Test-Path -LiteralPath $resolvedBridge -PathType Leaf)) {
    throw "Background bridge not found: $resolvedBridge"
}

$bindingFlags = [Reflection.BindingFlags]'NonPublic,Static'
$assembly = [Reflection.Assembly]::LoadFile($resolvedBridge)
$bridgeType = $assembly.GetType('CdpBridge', $true)
$mainMethod = $bridgeType.GetMethod('Main', [Reflection.BindingFlags]'Public,Static')
$targetMethod = $bridgeType.GetMethod('WashTargetExpression', $bindingFlags)
$progressMethod = $bridgeType.GetMethod('WorkProgressExpression', $bindingFlags)
$nearbyMethod = $bridgeType.GetMethod('NearbyWashControlsExpression', $bindingFlags)
$actionType = $assembly.GetType('CdpBridge+WorkAction', $true)
if (-not $mainMethod -or -not $targetMethod -or -not $progressMethod -or -not $nearbyMethod) {
    throw 'The work DOM expression methods were not found in the bridge.'
}

# Every mutating work operation and completion monitor must be tied to the
# captured target/inventory/progress three-frame epoch.
foreach ($invalidCall in @(
    [string[]]@('stationary-task-ready', 'unused-result.txt', 'invalid-epoch', 'wash', '29200'),
    [string[]]@('wash-task-ready', 'unused-result.txt', 'invalid-epoch', '29200'),
    [string[]]@('wash-task-ready', 'unused-result.txt', 'invalid-epoch', '42'),
    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '29200'),
    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '29200', 'work-only'),
    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '42', 'work-only'),
    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '29200', 'unrecognized'),
    [string[]]@('try-mining', 'unused-result.txt', 'invalid-epoch', '29200', 'work-only'),
    [string[]]@('probe-wash-storage', 'unused-result.txt'),
    [string[]]@('probe-wash-storage', 'unused-result.txt', 'invalid-epoch'),
    [string[]]@('try-mining', 'unused-result.txt'),
    [string[]]@('try-washing', 'unused-result.txt'),
    [string[]]@('try-gold', 'unused-result.txt'),
    [string[]]@('click-mining', 'unused-result.txt'),
    [string[]]@('wait-wash-completion', 'unused-result.txt'),
    [string[]]@('click-washing', 'unused-result.txt'),
    [string[]]@('click-gold', 'unused-result.txt'),
    [string[]]@('wait-action-completion', 'unused-result.txt'),
    [string[]]@('wait-action-completion', 'unused-result.txt', 'ore', 'invalid-epoch'),
    [string[]]@('wait-action-completion', 'unused-result.txt', 'mine', 'invalid-epoch'),
    [string[]]@('try-mining', 'unused-result.txt', 'invalid-epoch'),
    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch'),
    [string[]]@('try-gold', 'unused-result.txt', 'invalid-epoch')
)) {
    $exitCode = [int]$mainMethod.Invoke($null, [object[]]@(,$invalidCall))
    if ($exitCode -ne 64) {
        throw "An unbound wash command was accepted: $($invalidCall[0])"
    }
}

$payloadPath = Join-Path ([IO.Path]::GetTempPath()) `
    ('ai-miner-wash-dom-' + [Guid]::NewGuid().ToString('N') + '.json')
try {
    $payload = [ordered]@{
        fastWashClick = [string]$bridgeType.GetMethod('WorkClickExpressionForMode', $bindingFlags).Invoke($null, [object[]]@('try-washing', $true))
        ordinaryWashClick = [string]$bridgeType.GetMethod('WorkClickExpressionForMode', $bindingFlags).Invoke($null, [object[]]@('try-washing', $false))
        fastFlagOnMineClick = [string]$bridgeType.GetMethod('WorkClickExpressionForMode', $bindingFlags).Invoke($null, [object[]]@('try-mining', $true))
        stationaryMine = [string]$bridgeType.GetMethod('StationaryControlsExpression', $bindingFlags).Invoke($null, [object[]]@([Enum]::Parse($actionType, 'Mine')))
        stationaryGold = [string]$bridgeType.GetMethod('StationaryControlsExpression', $bindingFlags).Invoke($null, [object[]]@([Enum]::Parse($actionType, 'Gold')))
        stationaryClick = [string]$bridgeType.GetMethod('StationaryWorkClickExpression', $bindingFlags).Invoke($null, [object[]]@([string]$targetMethod.Invoke($null,[object[]]@($true))))
        idle = [string]$bridgeType.GetMethod('WashIdleStateExpression', $bindingFlags).Invoke($null, [object[]]@())
        nearby = [string]$nearbyMethod.Invoke($null, [object[]]@())
        probe = [string]$targetMethod.Invoke($null, [object[]]@($false))
        click = [string]$targetMethod.Invoke($null, [object[]]@($true))
        progressMine = [string]$progressMethod.Invoke($null, [object[]]@(
            [Enum]::Parse($actionType, 'Mine')))
        progressWash = [string]$progressMethod.Invoke($null, [object[]]@(
            [Enum]::Parse($actionType, 'Wash')))
        progressGold = [string]$progressMethod.Invoke($null, [object[]]@(
            [Enum]::Parse($actionType, 'Gold')))
    } | ConvertTo-Json -Compress
    [IO.File]::WriteAllText($payloadPath, $payload, [Text.UTF8Encoding]::new($false))

    $node = Get-Command node.exe -ErrorAction Stop
    & $node.Source (Join-Path $PSScriptRoot 'Test-WashDomExpressions.mjs') $payloadPath
    if ($LASTEXITCODE -ne 0) {
        throw "Wash DOM expression tests failed with exit code $LASTEXITCODE."
    }
}
finally {
    if (Test-Path -LiteralPath $payloadPath -PathType Leaf) {
        Remove-Item -LiteralPath $payloadPath -Force
    }
}
