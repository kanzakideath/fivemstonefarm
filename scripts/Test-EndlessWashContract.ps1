#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$main = Get-Content -LiteralPath (Join-Path $root 'src/mining-auto.ahk') -Raw
$mode = Get-Content -LiteralPath (Join-Path $root 'src/endless-wash.ahk') -Raw
$stationary = Get-Content -LiteralPath (Join-Path $root 'src/stationary-only.ahk') -Raw
$bridge = Get-Content -LiteralPath (Join-Path $root 'src/background-bridge/CdpBridge.cs') -Raw
$html = Get-Content -LiteralPath (Join-Path $root 'src/ui-web/src/index.html') -Raw
$js = Get-Content -LiteralPath (Join-Path $root 'src/ui-web/src/app.js') -Raw
$protocol = Get-Content -LiteralPath (Join-Path $root 'src/ui-host/Protocol.cs') -Raw

function Assert([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

Assert ($main.Contains('#Include endless-wash.ahk')) 'Dedicated mode is not included.'
Assert ($main.Contains('runEndlessWash: false') -and
    $main.Contains('State.runEndlessWash := startMode = "endless-washing"') -and
    $main.Contains('State.runEndlessWash := false')) 'Per-run mode ownership is incomplete.'
Assert ($main.Contains('StartMining("endless-washing")') -and
    $main.Contains('ConfigureEndlessWashStart(startToken)')) 'Dedicated start action is not connected.'
Assert ([regex]::IsMatch($main,
    'InitializeLocalVehicleRun\([^)]*\)[\s\S]{0,900}RequireExeRouteForRun\(expectedGeneration\)[\s\S]{0,1400}ENDLESS_WASH_START_SITE_NOT_VERIFIED')) `
    'A recoverable startup-site miss can leave a running generation without a timer.'
Assert ($mode.Contains('EndlessWashRegistrationReady()') -and
    $mode.Contains('Config.vehicleCompanionProtocol = 0') -and
    $mode.Contains('IsValidVehicleProfile(Config)')) 'Start does not require the exact local registered cargo.'
Assert ($stationary.Contains('mode = "recover-wash-zone"') -and
    $stationary.Contains('!EndlessWashBridgeMotionAuthorized()')) 'Stationary motion exception is not narrowly authorized.'
Assert ($mode.Contains('maxPulses < 1 || maxPulses > 12') -and
    $mode.Contains('deadlineMs < 500 || deadlineMs > 8000')) 'AHK recovery has no fixed pulse/deadline bounds.'
Assert ($main.Contains('controllerDeadline + 7000') -and
    $main.Contains('timeoutMs := Min(16000')) 'Helper lifetime is not bounded around the controller deadline.'
Assert ($main.Contains('mode = "recover-wash-zone"') -and
    $main.Contains('CurrentPhysicalRouteMask()')) 'Manual input does not cancel recovery.'

Assert ($mode.Contains('EndlessWashPostMotionSettleMs()') -and
    $mode.Contains('return 1150')) 'Post-animation correction starts before root motion stops.'
Assert ($main.Contains('"post-wash-storage" : "post-wash"') -and
    $main.Contains('RunEndlessWashZoneRecovery(expectedGeneration')) 'Verified wash completion is not connected to the closed loop.'
Assert ($main.Contains('endless_wash_target_missing') -and
    $main.Contains('EnterFarmRecovery(expectedGeneration')) 'MISSING WASH can still poll forever.'
Assert ($mode.Contains('RestartFarmAfterRecoveryExhausted(generation') -and
    $mode.Contains('ENDLESS_WASH_RECOVERY_EXHAUSTED')) 'Recovery lacks one restart followed by terminal stop.'
Assert ($mode.Contains('ParseEndlessWashRecoveryReceipt') -and
    $mode.Contains('receipt.stableSamples < 3') -and
    $mode.Contains('receipt.movementPulses > receipt.pulses')) 'Native recovery receipt is not strictly validated.'
Assert ($mode.Contains('receipt.state = "BOTH"') -and
    $mode.Contains('receipt.reason = "STABLE_BOTH"')) 'Farm resume does not require structural dual-target proof.'

Assert ($stationary.Contains('OpenStorageAndCapture(&id, &kind, generation, &fatal)') -and
    $stationary.Contains('id == Config.vehicleStorageId') -and
    $stationary.Contains('kind == Config.vehicleStorageType')) 'Storage may open an unregistered cargo target.'
Assert ($main.Contains('LiveWashCapacityModeEnabled()') -and
    $main.Contains('MaybeHandleFastWashCapacity(expectedGeneration)')) 'Capacity/full handling is not driven by the live pre-click snapshot.'
Assert ($main.Contains('endless_wash_storage_return_not_verified')) 'Storage return can still claim success without re-observing the work zone.'

Assert ($bridge.Contains('mode == "recover-wash-zone"')) 'Native CLI mode is missing.'
Assert ($bridge.Contains('RecoverWashZoneAsync(') -and
    $bridge.Contains('WashRecoveryStableSamples')) 'Native closed-loop controller is missing.'
Assert ($bridge.Contains('new WashRecoveryPulse("move_up_only", 80, true, false, true)')) 'Post-wash compulsory W pulse is missing or unbounded.'
Assert ($bridge.Contains('new WashRecoveryPulse("look_down", 450, false, true, false)')) 'Observed camera-loss recovery is missing.'
Assert ([regex]::IsMatch($bridge,
    'state == "STORAGE_ONLY"[\s\S]{0,160}new WashRecoveryPulse\("move_up_only", 50') -and
    [regex]::IsMatch($bridge,
    'state == "WASH_ONLY"[\s\S]{0,160}new WashRecoveryPulse\("move_down_only", 50')) `
    'Recovery direction is not adapted from the observed truck/wash-side label.'
Assert ($bridge.Contains('pulse.IsMovement && pulse.DurationMilliseconds > 80')) 'Native movement pulse exceeds the safety bound.'
Assert ($bridge.Contains('if (state == "AMBIGUOUS")') -and
    $bridge.Contains('return null;')) 'Ambiguous cargo does not suppress movement.'
Assert ($bridge.Contains('SendRelease(port)') -and
    $bridge.Contains('SendInputRelease(port)') -and
    $bridge.Contains('"+ox_target"')) 'Pulse transaction does not release/reactivate target safely.'
Assert ($bridge.Contains('WashZoneStructureExpression()') -and
    $bridge.Contains('storageLabels=[') -and
    $bridge.Contains("const washLabel=")) 'Independent wash and storage label sets are missing.'
Assert ($bridge.Contains('Never click, refill, or start another wash here.')) 'Recovery/click responsibility boundary is missing.'

Assert ($html.Contains('id="endless-wash-start"') -and
    $html.Contains('id="endless-wash-description"')) 'Dedicated UI entry is missing.'
Assert ($js.Contains("sendAction('washing.endless.start')") -and
    $js.Contains('endlessWashStartAvailable === true')) 'UI does not use backend availability.'
Assert ($protocol.Contains('case "washing.endless.start":')) 'Native protocol rejects the dedicated action.'

Write-Output 'Endless wash closed-loop contract tests passed.'
