#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$SourcePath = '',
    [string]$BridgeSourcePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedSource = [System.IO.Path]::GetFullPath($(if (
    [string]::IsNullOrWhiteSpace($SourcePath)) {
        Join-Path $PSScriptRoot '..\src\mining-auto.ahk'
    } else { $SourcePath }))
$resolvedBridgeSource = [System.IO.Path]::GetFullPath($(if (
    [string]::IsNullOrWhiteSpace($BridgeSourcePath)) {
        Join-Path $PSScriptRoot '..\src\background-bridge\CdpBridge.cs'
    } else { $BridgeSourcePath }))
foreach ($requiredPath in @($resolvedSource, $resolvedBridgeSource)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Storage closed-loop source was not found: $requiredPath"
    }
}

$source = Get-Content -LiteralPath $resolvedSource -Raw -Encoding UTF8
$bridgeSource = Get-Content -LiteralPath $resolvedBridgeSource -Raw -Encoding UTF8

function Assert-Contract {
    param(
        [Parameter(Mandatory)] [bool]$Condition,
        [Parameter(Mandatory)] [string]$Message
    )
    if (-not $Condition) { throw $Message }
}

function Assert-ContainsExact {
    param(
        [Parameter(Mandatory)] [string]$Text,
        [Parameter(Mandatory)] [string]$Needle,
        [Parameter(Mandatory)] [string]$Message
    )
    Assert-Contract ($Text.IndexOf($Needle, [StringComparison]::Ordinal) -ge 0) $Message
}

function Get-AhkFunctionBody {
    param([Parameter(Mandatory)] [string]$Name)

    $match = [regex]::Match($source,
        '(?m)^' + [regex]::Escape($Name) + '\s*\([^)]*\)\s*\{')
    if (-not $match.Success) { throw "AHK function was not found: $Name" }

    $open = $source.IndexOf('{', $match.Index)
    $depth = 0
    for ($index = $open; $index -lt $source.Length; $index++) {
        if ($source[$index] -eq '{') { $depth++ }
        elseif ($source[$index] -eq '}') {
            $depth--
            if ($depth -eq 0) {
                return $source.Substring($open + 1, $index - $open - 1)
            }
        }
    }
    throw "AHK function has no closing brace: $Name"
}

function Get-CSharpMethodSection {
    param(
        [Parameter(Mandatory)] [string]$StartPattern,
        [Parameter(Mandatory)] [string]$NextPattern,
        [Parameter(Mandatory)] [string]$Name
    )

    $start = [regex]::Match($bridgeSource, $StartPattern)
    if (-not $start.Success) { throw "C# method was not found: $Name" }
    $next = [regex]::Match($bridgeSource, $NextPattern,
        [System.Text.RegularExpressions.RegexOptions]::None,
        [TimeSpan]::FromSeconds(2))
    if (-not $next.Success -or $next.Index -le $start.Index) {
        throw "C# method boundary was not found: $Name"
    }
    return $bridgeSource.Substring($start.Index, $next.Index - $start.Index)
}

$capacity = Get-AhkFunctionBody 'MaybeHandleVehicleCapacity'
$safeDelta = Get-AhkFunctionBody 'StorageDeltaBaselineIsSafe'
$ledgerAccumulator = Get-AhkFunctionBody 'AccumulateVerifiedFarmOutputLedger'
$ledgerBaseline = Get-AhkFunctionBody 'BuildFarmOutputProtectedBaseline'
$ledgerAuthorization = Get-AhkFunctionBody 'BuildFarmOutputAuthorizationSpec'
$depositCheckpoint = Get-AhkFunctionBody 'CreateStorageDepositCheckpoint'
$ledgerReconcile = Get-AhkFunctionBody 'ReconcileStorageDepositCheckpoint'
$ledgerVerify = Get-AhkFunctionBody 'VerifyStorageLedgerProgress'
$receiptParser = Get-AhkFunctionBody 'ParseVerifiedStorageDepositReceipt'
$receiptBind = Get-AhkFunctionBody 'BindStorageDepositReceipt'
$receiptActiveBind = Get-AhkFunctionBody 'BindActiveStorageDepositReceipt'
$transferAmbiguous = Get-AhkFunctionBody 'StorageTransferResultIsAmbiguous'
$transferReceiptAction = Get-AhkFunctionBody 'StorageTransferReceiptAction'
$receiptRetire = Get-AhkFunctionBody 'RetireCompletedStorageDepositCheckpoint'
$rewardFinalize = Get-AhkFunctionBody 'CompleteVerifiedFarmReward'
$refillOnlyDeparture = Get-AhkFunctionBody 'IsVerifiedWashingRefillOnlyDeparture'
$washRecovery = Get-AhkFunctionBody 'RunWashCompletionRecoveryCycle'
$farmRecovery = Get-AhkFunctionBody 'RunFarmRecoveryCycle'
$initializeLocal = Get-AhkFunctionBody 'InitializeLocalVehicleRun'
$startMining = Get-AhkFunctionBody 'StartMining'
$stopMining = Get-AhkFunctionBody 'StopMining'
$localStorage = Get-AhkFunctionBody 'RunLocalVehicleStorageCycle'
$playLocalRoute = Get-AhkFunctionBody 'PlayLocalRoute'
$foregroundViewRoute = Get-AhkFunctionBody 'PlayForegroundViewRoute'
$refill = Get-AhkFunctionBody 'RefillWashingInputAtStorage'
$verifyRefill = Get-AhkFunctionBody 'VerifyRawStoneReceiptDelta'
$refillReceiptParser = Get-AhkFunctionBody 'ParseVerifiedWashingRefillReceipt'
$refillReceiptBinding = Get-AhkFunctionBody 'WashingRefillReceiptOperationMatches'
$refillFailureAction = Get-AhkFunctionBody 'WashingRefillFailureAction'
$refillDeltaStatus = Get-AhkFunctionBody 'WashingRefillReceiptDeltaStatus'
$refillAccountedTotal = Get-AhkFunctionBody 'WashingRefillAccountedTotalMatches'
$commitRefill = Get-AhkFunctionBody 'CommitVerifiedWashingRefill'
$bridgeCancelable = Get-AhkFunctionBody 'RunBackgroundBridgeCancelable'
$transitionPolicy = Get-AhkFunctionBody 'FarmStateTransitionAllowed'
$knownStates = Get-AhkFunctionBody 'FarmStateNameKnown'
$ambiguousTransferMock = Get-AhkFunctionBody 'RunAmbiguousTransferNoRetryMockTest'

# Foreground storage aiming must use the same real relative-mouse adapter as
# work-view recovery. A successful DevCon command string alone is not camera proof.
Assert-Contract ($playLocalRoute -match
    'RouteViewSegmentCount\(route\)\s*>\s*0[\s\S]{0,180}WinActive\([\s\S]{0,120}PlayForegroundViewRoute\(') `
    'Foreground storage view routes do not select the physical camera adapter.'
Assert-Contract ($foregroundViewRoute -match 'SendRelativeMouseDelta\(' -and
    $foregroundViewRoute -match 'IsTargetForeground\(expectedGeneration\)' -and
    $foregroundViewRoute -match 'ReleaseBackgroundTarget\(false\)' -and
    $foregroundViewRoute -notmatch 'SendEvent[^\r\n]*(Up|Down|Left|Right)') `
    'Storage aiming is not guarded relative-mouse input or regressed to arrow keys.'

# A positive exact Farm-output ledger is the departure authority. The broad
# elapsed-run baseline must not authorize a transfer because an unrelated item
# may have been acquired after start. Once the ledger is proven, a hidden Farm
# target must not gate movement toward storage.
$safeGate = $capacity.IndexOf('PositiveInventoryCountTotal(State.farmOutputLedger)',
    [StringComparison]::Ordinal)
$storageRun = $capacity.IndexOf('RunVehicleStorageCycle(expectedGeneration)',
    [StringComparison]::Ordinal)
Assert-Contract ($safeGate -ge 0 -and $storageRun -gt $safeGate) `
    'Capacity handling can start storage before validating its verified-output ledger.'
Assert-Contract ($capacity -match
    'refillOnly\s*:=\s*IsVerifiedWashingRefillOnlyDeparture\([\s\S]{0,420}ledgerUnits\s*:=\s*PositiveInventoryCountTotal\(State\.farmOutputLedger\)[\s\S]{0,420}BuildFarmOutputProtectedBaseline\(inventoryInfo\.items' -and
    $refillOnlyDeparture -match
    'mode\s*=\s*"washing"\s*&&\s*storagePending\s*&&\s*storageOutputsVerified[\s\S]{0,100}storageReason\s*=\s*"raw_stone_empty"\s*&&\s*rawStoneCount\s*=\s*0') `
    'The only empty-ledger departure bypass is not the verified raw-zero refill objective.'
$departurePath = $capacity.Substring($safeGate, $storageRun - $safeGate)
Assert-Contract ($departurePath -notmatch
    'ProbeWorkTarget\s*\(|MaintainBackgroundWorkView\s*\(') `
    'A visual Farm-target/camera probe still blocks trusted direct storage departure.'
Assert-Contract ($departurePath -match
    'StopAutomationWithFault\([\s\S]{0,260}"UNTRUSTED_STORAGE_BASELINE"\)' -and
    $departurePath -match 'ReleaseAllInputs\(\)' -and
    $departurePath -match 'ReleaseBackgroundTarget\(true\)' -and
    $departurePath -match 'TransitionFarmState\("LOCATING_TRUCK"') `
    'Direct storage departure no longer fails closed before releasing inputs and entering LOCATING_TRUCK.'
Assert-Contract (([regex]::Matches($capacity,
    'RunVehicleStorageCycle\(expectedGeneration\)')).Count -eq 1) `
    'One capacity decision can dispatch more than one vehicle storage cycle.'

# Ledger creation is downstream of the real finalized-reward guard. Per-name net
# growth caps exact metadata growth so a durability-only mutation cannot become
# output. The synthetic baseline protects every current unit except exact ledger
# quantities. A separate exact authorization freezes the only name+metadata
# quantities the bridge may move before it makes any physical request.
Assert-Contract ($rewardFinalize -match
    'FarmAttemptCanFinalize\([\s\S]{0,1800}WaitForVerifiedFarmRewardDurability\([\s\S]{0,1800}AccumulateVerifiedFarmOutputLedger\(State\.farmOutputLedger,\s*\r?\n\s*attempt\.before\.items,\s*confirmedInfo\.items' -and
    $rewardFinalize -match
    'outputLedgerCommitted[\s\S]{0,1800}DiscardPendingFarmAttempt\("reward_confirmed"\)') `
    'Finalized verified rewards are not the sole idempotent ledger accumulation point.'
Assert-Contract ($ledgerAccumulator -match
    'remainingNameGrowth[\s\S]{0,500}Min\(Max\(0,\s*afterCount\s*-\s*beforeCount\),\s*\r?\n\s*remainingNameGrowth\[name\]\)' -and
    $ledgerAccumulator -match
    'ledger\[key\].*\+\s*increase') `
    'Ledger accumulation no longer caps exact metadata deltas by item-name net growth.'
Assert-Contract ($ledgerBaseline -match
    'protectedCount\s*:=\s*row\.count\s*-\s*row\.ledgerEligible' -and
    $ledgerBaseline -match
    'InventorySpecDeltaUnitCount\(currentSpec,\s*baselineSpec\)\s*!=\s*eligibleUnits') `
    'The synthetic baseline no longer protects all non-ledger live quantities.'
Assert-Contract ($localStorage -match
    'BuildFarmOutputProtectedBaseline\(beforeAttempt\.items,[\s\S]{0,1800}"deposit-delta",[\s\S]{0,220}protectedBaseline,\s*\r?\n\s*State\.storageDepositCheckpoint\.authorizedSpec\)') `
    'The production deposit command lacks its protected baseline or exact checkpoint authorization.'
Assert-Contract ($ledgerAuthorization.IndexOf(
        '^[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{2,10923}$',
        [StringComparison]::Ordinal) -ge 0 -and
    $ledgerAuthorization -match 'count\s*>\s*2147483647\s*-\s*totalUnits' -and
    $depositCheckpoint -match
    'BuildFarmOutputAuthorizationSpec\(ledger,[\s\S]{0,500}authorizedSpec:[\s\S]{0,120}authorizedUnits:') `
    'The exact Farm-output authorization is not frozen into each checkpoint.'
Assert-Contract ($ledgerReconcile -match
    'observedReduction\s*:=\s*Max\(0,\s*beforeCount\s*-\s*afterCount\)' -and
    $ledgerReconcile -match
    'allowance\s*:=\s*checkpoint\.receiptRemainingByKey\.Has\(key\)[\s\S]{0,180}observedReduction\s*>\s*allowance[\s\S]{0,80}return\s+false' -and
    $ledgerReconcile -match 'receiptVerified' -and
    $ledgerReconcile -match 'receiptRemainingByKey' -and
    $ledgerReconcile -match 'checkpoint\.observedItems\s*:=\s*liveSpec' -and
    $ledgerReconcile -match 'ledger\.Delete\(key\)') `
    'Partial/late storage reductions are not decremented idempotently by exact key.'
Assert-Contract ($ledgerVerify -match
    'ReconcileActiveStorageDepositCheckpoint\(' -and
    $ledgerVerify -match 'StorageDepositCheckpointReceiptRemaining\(' -and
    $ledgerVerify -match 'if\s+receiptRemaining\s*=\s*0') `
    'Storage verification can succeed before the entire trusted receipt is observed.'

# Player reduction alone is never storage proof. CdpBridge emits an exact receipt
# only after paired player/trunk deltas, AHK binds it to the generated operation
# token and registered storage identity. Only a definitive MOVE_REJECTED partial
# may retire its proven subset and retry; every ambiguous/unknown partial stops.
Assert-Contract ($receiptParser -match 'expectedStorageId' -and
    $receiptParser -match 'expectedStorageType' -and
    $receiptParser -match 'operationToken' -and
    $receiptParser -match 'exactCounts' -and
    $receiptParser -match 'PARTIAL_') `
    'AHK does not strictly parse an identity-bound exact deposit receipt.'
Assert-Contract ($receiptBind -match 'receipt\.planned\s*!=\s*expectedUnits' -and
    $receiptBind -match 'checkpoint\.authorizedByKey\[key\]\s*<\s*receiptCount' -and
    $receiptBind -match 'receiptRemainingByKey' -and
    $receiptBind -match
        'receiptAction\s*!=\s*"COMPLETE"\s*&&\s*receiptAction\s*!=\s*"RETRY_EXACT"') `
    'A deposit receipt is not bounded to the exact authorized ledger checkpoint.'
Assert-Contract ($receiptActiveBind -match
    'StorageTransferResultIsAmbiguous\(result\)[\s\S]{0,100}"ambiguous_transfer"' -and
    $receiptActiveBind -match
        'StorageTransferReceiptAction\(receipt\.status\)[\s\S]{0,220}terminal_receipt_status_') `
    'Ambiguous plain/partial deposit results are not rejected before ledger binding.'
Assert-Contract ($transferReceiptAction -match
    'status\s*=\s*"PARTIAL_MOVE_REJECTED"[\s\S]{0,80}"RETRY_EXACT"' -and
    $transferReceiptAction -match
    'allowCapacityCommit\s*&&\s*status\s*=\s*"PARTIAL_INVENTORY_CAPACITY"[\s\S]{0,80}"COMMIT_EXACT"' -and
    $transferReceiptAction -match
        'InStr\(status,\s*"PARTIAL_"\)\s*=\s*1\s*\?\s*"STOP"\s*:\s*"INVALID"') `
    'Partial transfer retry is no longer an explicit fail-closed whitelist.'
Assert-Contract ($bridgeCancelable -match
    'ParseVerifiedStorageDepositReceipt\(result,\s*expectedStorageId,[\s\S]{0,260}StorageDepositReceiptOperationMatches\(depositReceipt,[\s\S]{0,100}operationToken\)') `
    'The per-call deposit operation token is not bound before the receipt reaches storage logic.'
$depositCommandIndex = $localStorage.IndexOf(
    'depositResult := RunBackgroundBridgeCancelable(', [StringComparison]::Ordinal)
$receiptBindIndex = $localStorage.IndexOf(
    'BindActiveStorageDepositReceipt(expectedGeneration,', $depositCommandIndex,
    [StringComparison]::Ordinal)
$receiptVerifyIndex = $localStorage.IndexOf(
    'VerifyStorageLedgerProgress(', $receiptBindIndex,
    [StringComparison]::Ordinal)
$receiptRejectPath = if ($receiptBindIndex -ge 0 -and
    $receiptVerifyIndex -gt $receiptBindIndex) {
    $localStorage.Substring($receiptBindIndex,
        $receiptVerifyIndex - $receiptBindIndex)
} else { '' }
Assert-Contract ($depositCommandIndex -ge 0 -and
    $receiptBindIndex -gt $depositCommandIndex -and
    $receiptVerifyIndex -gt $receiptBindIndex -and
    $receiptRejectPath -match 'fatalDeposit\s*:=\s*true' -and
    $receiptRejectPath -match 'break') `
    'ERROR/timeout/unbound deposit results can reach player-side ledger reconciliation.'
Assert-Contract ($localStorage -match
    'receiptRemaining\s*>\s*0[\s\S]{0,800}VerifyStorageLedgerProgress\(' -and
    $localStorage -match 'RetireCompletedStorageDepositCheckpoint\(' -and
    $receiptRetire -match 'StorageDepositCheckpointReceiptRemaining\(checkpoint\)\s*!=\s*0') `
    'Verified partial/late receipts are not completed before retrying the ledger remainder.'
Assert-Contract ($farmRecovery -match
    'storageDepositCheckpoint\.receiptVerified[\s\S]{0,420}UNVERIFIED_STORAGE_RECEIPT[\s\S]{0,260}ReconcileActiveStorageDepositCheckpoint\(') `
    'RECOVERY can finalize a player-only reduction from an unbound checkpoint.'

$depositMethod = Get-CSharpMethodSection `
    '(?m)^\s*private static async Task<string> DepositDeltaAsync\(' `
    '(?m)^\s*private static string FormatDepositReceipt\(' `
    'DepositDeltaAsync'
$authorizationIndex = $depositMethod.IndexOf(
    "return 'ERROR UNAUTHORIZED_DELTA'", [StringComparison]::Ordinal)
$fetchIndex = $depositMethod.IndexOf("fetch('https://'",
    [StringComparison]::Ordinal)
Assert-Contract ($depositMethod -match 'authorizedRaw=JSON\.parse\(' -and
    $depositMethod -match 'const planned=Object\.create\(null\)' -and
    $depositMethod -match 'totalUnits!==authorizedUnits' -and
    $depositMethod -match 'plannedKeys\.some\(key=>planned\[key\]!==authorized\[key\]\)' -and
    $authorizationIndex -ge 0 -and $fetchIndex -gt $authorizationIndex) `
    'CdpBridge can move a live delta before it exactly matches the checkpoint authorization.'
Assert-Contract ($depositMethod -match
    'afterRight-beforeRight===source\.count[\s\S]{0,240}movedItems\.push\(' -and
    $depositMethod -match "const stop=reason=>moved>0\?finish\(reason\):\('ERROR '\+reason\)" -and
    $depositMethod -match "status:reason\?\('PARTIAL_'\+reason\):'COMPLETE'") `
    'CdpBridge no longer creates complete/partial receipts only from paired exact inventory deltas.'
$depositPostDispatch = $depositMethod.Substring($fetchIndex)
Assert-Contract (([regex]::Matches($depositPostDispatch,
        "return 'ERROR AMBIGUOUS_TRANSFER'")).Count -eq 5 -and
    $depositPostDispatch -notmatch "stop\('(NO_PROGRESS|CANCELLED|WRONG_STORAGE)'\)" -and
    $depositPostDispatch -match
        "response===false\)return stop\('MOVE_REJECTED'\)") `
    'A post-dispatch deposit ambiguity can still become a retryable zero/partial receipt.'
$depositFormatter = Get-CSharpMethodSection `
    '(?m)^\s*private static string FormatDepositReceipt\(' `
    '(?m)^\s*private static async Task<string> WithdrawItemAsync\(' `
    'FormatDepositReceipt'
Assert-Contract ($depositFormatter -match 'expectedStorageId' -and
    $depositFormatter -match 'expectedStorageType' -and
    $depositFormatter -match 'expectedOperationToken' -and
    $depositFormatter -match 'exactCounts' -and
    $depositFormatter -match '"DEPOSITED "') `
    'CdpBridge deposit receipt formatting lost identity/token/exact-key validation.'

Assert-ContainsExact $bridgeSource `
    'bool depositMode = args.Length == 7 && mode == "deposit-delta";' `
    'The bridge no longer validates deposit-delta as the seven-argument authorized API.'
$depositDispatch = [regex]::Match($bridgeSource,
    '(?s)else if \(depositMode\).*?else if \(withdrawMode\)')
Assert-Contract ($depositDispatch.Success -and
    $depositDispatch.Value -match 'ParseBaseline\(args\[4\]\)' -and
    $depositDispatch.Value -match 'ParseExactCounts\(args\[5\]\)' -and
    $depositDispatch.Value -match 'string operationToken = args\[6\];' -and
    $depositDispatch.Value -match 'baseline,\s*\r?\n\s*authorized, operationToken') `
    'The exact authorization is not validated and forwarded by deposit dispatch.'

# The final raw stone removes the wash target by design. Inventory truth must
# branch into storage/refill before any visual probe can misclassify it as a
# camera failure.
$rawEmpty = $washRecovery.IndexOf(
    'if Config.rawStoneItemName && State.lastRawStoneCount = 0 {',
    [StringComparison]::Ordinal)
$checkingInventory = $washRecovery.IndexOf(
    'TransitionFarmState("CHECKING_INVENTORY"', $rawEmpty,
    [StringComparison]::Ordinal)
$capacityDispatch = $washRecovery.IndexOf(
    'MaybeHandleVehicleCapacity(expectedGeneration)', $checkingInventory,
    [StringComparison]::Ordinal)
$rawBranchReturn = $washRecovery.IndexOf('return', $capacityDispatch,
    [StringComparison]::Ordinal)
$washProbe = $washRecovery.IndexOf(
    'ProbeWorkTarget("washing", expectedGeneration)', $rawEmpty,
    [StringComparison]::Ordinal)
Assert-Contract ($rawEmpty -ge 0 -and $checkingInventory -gt $rawEmpty -and
    $capacityDispatch -gt $checkingInventory -and
    $rawBranchReturn -gt $capacityDispatch -and
    $washProbe -gt $rawBranchReturn) `
    'WASH_VERIFYING does not route raw-stone count zero through CHECKING_INVENTORY before visual probing.'
Assert-Contract ($washRecovery.Substring($rawEmpty,
    $checkingInventory - $rawEmpty) -notmatch 'ProbeWorkTarget|MaintainBackgroundWorkView') `
    'Raw-stone depletion can still emit target/camera input before entering inventory handling.'

# A local cold start with zero raw stone has no Farm output to deposit. It must
# explicitly mark output storage verified, schedule the normal storage FSM, and
# let that FSM execute only the refill half.
$coldStart = $initializeLocal.IndexOf('if !startCapacityBlocked && startRawStoneCount = 0 {',
    [StringComparison]::Ordinal)
$initialProbe = $initializeLocal.IndexOf(
    'ProbeWorkTarget(State.runMode, expectedGeneration)', $coldStart,
    [StringComparison]::Ordinal)
Assert-Contract ($coldStart -ge 0 -and $initialProbe -gt $coldStart) `
    'The local washing cold-start refill branch is missing or occurs after target probing.'
$coldStartBranch = $initializeLocal.Substring($coldStart,
    $initialProbe - $coldStart)
foreach ($coldStartClause in @(
        'State.storagePending := true',
        'State.storageReason := "raw_stone_empty"',
        'State.storagePreSnapshot := inventoryInfo',
        'State.storageOutputsVerified := true',
        'State.storageRefillVerified := false',
        'LOCAL_WASH_START_REFILL_ONLY',
        'return true')) {
    Assert-ContainsExact $coldStartBranch $coldStartClause `
        "Local raw-zero cold start lost its refill-only clause: $coldStartClause"
}
$initializeCall = $startMining.IndexOf(
    'InitializeLocalVehicleRun(runGeneration)', [StringComparison]::Ordinal)
$pendingBranch = $startMining.IndexOf('if State.storagePending {',
    $initializeCall, [StringComparison]::Ordinal)
$initialStorageSchedule = $startMining.IndexOf(
    'ScheduleNext(runGeneration, State.storagePending ? 100 : 900)',
    $pendingBranch, [StringComparison]::Ordinal)
Assert-Contract ($initializeCall -ge 0 -and $pendingBranch -gt $initializeCall -and
    $initialStorageSchedule -gt $pendingBranch -and
    $startMining.Substring($pendingBranch,
        $initialStorageSchedule - $pendingBranch) -match
        'TransitionFarmState\("NEED_STORAGE"[\s\S]{0,220}TransitionFarmState\("STOPPING_FARM"') `
    'Cold-start storagePending does not enter the production storage FSM.'
$depositFlag = $localStorage.IndexOf(
    'depositOk := State.storageOutputsVerified', [StringComparison]::Ordinal)
$depositLoop = $localStorage.IndexOf('if !depositOk {', $depositFlag,
    [StringComparison]::Ordinal)
$refillCall = $localStorage.IndexOf(
    'RefillWashingInputAtStorage(expectedGeneration,', $depositLoop,
    [StringComparison]::Ordinal)
Assert-Contract ($depositFlag -ge 0 -and $depositLoop -gt $depositFlag -and
    $refillCall -gt $depositLoop -and
    $localStorage.Substring($depositLoop,
        $refillCall - $depositLoop) -match
        'if\s+depositOk\s*&&\s*State\.runMode\s*=\s*"washing"') `
    'The storage cycle cannot skip deposit for verified-empty output and continue into washing refill.'

# The AHK side sends an absolute desired total with explicit capacity reserves.
# Every positive bridge result is an identity/operation-bound receipt.  A retry
# is legal only after the exact receipt delta has appeared and the cumulative
# live count still equals the sum of all receipts from this refill transaction.
$retryReobserve = $refill.IndexOf('if refillAttempt > 1 {',
    [StringComparison]::Ordinal)
$retrySnapshot = $refill.IndexOf('"inventory-snapshot"', $retryReobserve,
    [StringComparison]::Ordinal)
$retryLiveCount = $refill.IndexOf('liveCount := InventorySpecNameCount(',
    $retrySnapshot, [StringComparison]::Ordinal)
$retryAccounted = $refill.IndexOf('WashingRefillAccountedTotalMatches(originalCount,',
    $retryLiveCount, [StringComparison]::Ordinal)
$retryCurrentInfo = $refill.IndexOf('currentInfo := liveInfo', $retrySnapshot,
    [StringComparison]::Ordinal)
$retryCurrentCount = $refill.IndexOf('currentCount := liveCount',
    $retryCurrentInfo, [StringComparison]::Ordinal)
$targetTotal = $refill.IndexOf(
    'targetTotalCount := Min(1000000, Max(1, Config.washRefillMaximum))',
    [StringComparison]::Ordinal)
$withdrawCall = $refill.IndexOf(
    '"withdraw-item", Config.vehicleStorageId,',
    [StringComparison]::Ordinal)
Assert-Contract ($retryReobserve -ge 0 -and $retrySnapshot -gt $retryReobserve -and
    $retryLiveCount -gt $retrySnapshot -and $retryAccounted -gt $retryLiveCount -and
    $retryCurrentInfo -gt $retryAccounted -and
    $retryCurrentCount -gt $retryCurrentInfo -and
    $targetTotal -gt $retryCurrentCount -and $withdrawCall -gt $targetTotal) `
    'A refill retry can repeat a stale request without first re-observing live inventory.'
Assert-Contract ($refill -match
    'reserveWeight\s*:=\s*WashingRefillReserveWeight\(currentInfo\.maxWeight\)[\s\S]{0,180}reserveSlots\s*:=\s*WashingRefillReserveSlots\(currentInfo\.slots\)' -and
    $refill -match
    '"withdraw-item",\s*Config\.vehicleStorageId,\s*\r?\n\s*Config\.vehicleStorageType,\s*Config\.rawStoneItemName,\s*targetTotalCount,\s*\r?\n\s*reserveWeight,\s*reserveSlots\)') `
    'AHK no longer sends the absolute target total together with live weight/slot reserves.'
$verifyCall = $refill.IndexOf(
    'VerifyRawStoneReceiptDelta(expectedGeneration,', $withdrawCall,
    [StringComparison]::Ordinal)
Assert-Contract ($verifyCall -gt $withdrawCall -and
    $verifyRefill -match
        'WashingRefillReceiptDeltaStatus\(beforeCount,[\s\S]{0,100}candidateCount,\s*expectedMoved\)' -and
    $verifyRefill -match 'deltaStatus\s*=\s*"MATCH"[\s\S]{0,100}afterInfo\s*:=\s*candidateInfo' -and
    $verifyRefill -match 'deltaStatus\s*=\s*"UNPAIRED"[\s\S]{0,160}failureReason\s*:=\s*"UNPAIRED_DELTA"') `
    'Refill success is not gated by an exact re-observed receipt delta.'
Assert-Contract ($refillDeltaStatus -match
    'observedCount\s*=\s*expectedCount\s*\?\s*"MATCH"' -and
    $refillDeltaStatus -match 'observedCount\s*>?=\s*beforeCount[\s\S]{0,100}\?\s*"PENDING"\s*:\s*"UNPAIRED"' -and
    $refillAccountedTotal -match
        'currentCount\s*-\s*originalCount\s*=\s*verifiedUnits') `
    'Washing refill receipt accounting no longer rejects extra/unpaired growth.'
Assert-Contract ($refillReceiptParser -match
    '\^\(WITHDRAWN\|WITHDRAWN_PARTIAL\)' -and
    $refillReceiptParser -match 'parts\[4\]\s*!=\s*expectedStorageId' -and
    $refillReceiptParser -match 'parts\[5\]\s*!=\s*expectedStorageType' -and
    $refillReceiptParser -match 'operationToken:\s*parts\[6\]' -and
    $refillReceiptParser -match 'WITHDRAWN_PARTIAL[\s\S]{0,120}PARTIAL_') `
    'Washing refill no longer strictly parses bound complete/partial receipts.'
Assert-Contract ($refillReceiptBinding -match
    'receipt\.operationToken\s*=\s*expectedOperationToken' -and
    $bridgeCancelable -match
        'mode\s*=\s*"withdraw-item"[\s\S]{0,500}ParseVerifiedWashingRefillReceipt\(result,\s*expectedStorageId,[\s\S]{0,180}WashingRefillReceiptOperationMatches\(withdrawReceipt,[\s\S]{0,80}operationToken\)') `
    'The generated withdraw operation token is not validated before refill logic.'
$partialBranch = $refill.IndexOf('if receiptAction = "COMPLETE"',
    [StringComparison]::Ordinal)
$terminalReceipt = $refill.IndexOf('WASH_REFILL_TERMINAL_RECEIPT',
    [StringComparison]::Ordinal)
$partialDiagnostic = $refill.IndexOf('WASH_REFILL_PARTIAL_ACCOUNTED',
    [Math]::Max(0, $partialBranch), [StringComparison]::Ordinal)
$completeCommit = $refill.IndexOf(
    'return CommitVerifiedWashingRefill(expectedGeneration,',
    [Math]::Max(0, $partialBranch), [StringComparison]::Ordinal)
Assert-Contract ($refill -match
    'verifiedRefillUnits\s*\+=\s*withdrawReceipt\.moved' -and
    $refill -match
        'WashingRefillAccountedTotalMatches\(originalCount,[\s\S]{0,100}newCount,\s*verifiedRefillUnits\)' -and
    $terminalReceipt -ge 0 -and $terminalReceipt -lt $partialBranch -and
    $partialBranch -ge 0 -and $completeCommit -gt $partialBranch -and
    $partialDiagnostic -gt $completeCommit -and
    $refill.Substring($partialDiagnostic,
        [Math]::Min(700, $refill.Length - $partialDiagnostic)) -match 'continue' -and
    $refill.Substring($partialDiagnostic,
        [Math]::Min(700, $refill.Length - $partialDiagnostic)) -notmatch
        'storageRefillVerified\s*:=\s*true') `
    'A partial washing-refill receipt can still be committed as a completed refill.'
Assert-Contract ($refill -match
    'receiptAction\s*:=\s*StorageTransferReceiptAction\([\s\S]{0,100}withdrawReceipt\.status,\s*true\)' -and
    $refill -match
    'receiptAction\s*=\s*"STOP"\s*\|\|\s*receiptAction\s*=\s*"INVALID"[\s\S]{0,500}fatalFailure\s*:=\s*true[\s\S]{0,220}return\s+false' -and
    $refill -match
    'failureAction\s*:=\s*WashingRefillFailureAction\(withdrawResult\)[\s\S]{0,100}failureAction\s*!=\s*"RETRY_ZERO"[\s\S]{0,500}return\s+false') `
    'Ambiguous/unknown refill results can still reach another withdraw dispatch.'
Assert-Contract ($transferAmbiguous -match 'ERROR AMBIGUOUS_TRANSFER' -and
    $transferAmbiguous -match 'ERROR NO_PROGRESS' -and
    $transferAmbiguous -match 'ERROR BRIDGE_TIMEOUT' -and
    $refillFailureAction -match
        'StorageTransferResultIsAmbiguous\(result\)[\s\S]{0,80}"STOP_AMBIGUOUS"' -and
    $refillFailureAction -match
        'result\s*=\s*"ERROR MOVE_REJECTED"[\s\S]{0,500}\?\s*"RETRY_ZERO"\s*:\s*"STOP_FATAL"') `
    'Refill failure policy is not default-stop with explicit definite-zero retries.'
Assert-Contract ($commitRefill -match
    'Critical\s+"On"' -and
    $commitRefill -match 'IsCurrentRun\(expectedGeneration\)[\s\S]{0,180}State\.storagePending[\s\S]{0,120}State\.storageOutputsVerified' -and
    $commitRefill -match 'observedUnits\s*:=\s*verifiedCount\s*-\s*originalCount[\s\S]{0,160}observedUnits\s*!=\s*verifiedUnits' -and
    $commitRefill -match
        'CapacityNeedsStorage\(info,[\s\S]{0,300}fatalFailure\s*:=\s*true' -and
    $commitRefill -match
    'State\.inventoryBaseline\s*:=\s*info\.items[\s\S]{0,100}State\.inventoryBaselineWeight\s*:=\s*info\.weight' -and
    $commitRefill -match 'State\.storageRefillVerified\s*:=\s*true') `
    'Completed refill is not generation-owned, exact-counted, reserve-checked, and atomically rebased.'
Assert-Contract ($source -match
    'ParseVerifiedWashingRefillReceipt\(\s*\r?\n?\s*"WITHDRAWN 8 2 dHJ1bmsxMjM= dHJ1bms= 123-9 COMPLETE"' -and
    $source -match
    'WITHDRAWN_PARTIAL 1 1 dHJ1bmsxMjM= dHJ1bms= 123-10 PARTIAL_NO_PROGRESS' -and
    $source -match
    'WashingRefillReceiptDeltaStatus\(5,\s*6,\s*1\)\s*=\s*"MATCH"' -and
    $source -match
    'WashingRefillReceiptDeltaStatus\(5,\s*7,\s*1\)\s*=\s*"UNPAIRED"' -and
    $source -match 'RunAmbiguousTransferNoRetryMockTest\(100\)') `
    'Compiled --validate no longer covers bound complete/partial receipts and exact deltas.'
Assert-Contract ($refill -match
    'errorKind\s*=\s*"SOURCE_EMPTY"[\s\S]{0,220}accountedExactly[\s\S]{0,260}CommitVerifiedWashingRefill\(expectedGeneration,[\s\S]{0,260}"source_empty_after_partial"' -and
    $refill -match
    'if\s+errorKind\s*=\s*"SOURCE_EMPTY"\s*\{[\s\S]{0,1400}failureMessage\s*:=\s*"[^"\r\n]+"[\s\S]{0,180}fatalFailure\s*:=\s*true[\s\S]{0,180}WriteDiagnostic\(\s*\r?\n?\s*"Stone Washing paused: no raw stone available in truck storage"\)') `
    'RAW_STONE_NOT_FOUND no longer fail-closes with the required exact diagnostic.'

# The bridge API has nine process arguments (including result path and operation
# token). Its transaction re-reads live left/right state, reserves capacity,
# moves right-to-left, and verifies matching count deltas on both inventories.
Assert-ContainsExact $bridgeSource `
    'bool withdrawMode = args.Length == 9 && mode == "withdraw-item";' `
    'The bridge no longer validates withdraw-item as the nine-argument API.'
$withdrawDispatch = [regex]::Match($bridgeSource,
    '(?s)else if \(withdrawMode\).*?else if \(cancelOperationMode\)')
Assert-Contract $withdrawDispatch.Success `
    'The validated withdraw-item dispatch block could not be isolated.'
foreach ($dispatchClause in @(
        'string itemName = args[4];',
        'Int32.TryParse(args[5]',
        'Int32.TryParse(args[6]',
        'Int32.TryParse(args[7]',
        'string operationToken = args[8];',
        'maximumCount, reserveWeight, reserveSlots,')) {
    Assert-ContainsExact $withdrawDispatch.Value $dispatchClause `
        "The nine-argument withdraw API lost validation/forwarding for: $dispatchClause"
}
$withdrawMethod = Get-CSharpMethodSection `
    '(?m)^\s*private static async Task<string> WithdrawItemAsync\(' `
    '(?m)^\s*private static async Task<string> CancelOperationAsync\(' `
    'WithdrawItemAsync'
foreach ($liveClause in @(
        'for(const sourceRef of sourceSlots){if(cancelled())return fail(',
        'inv=validState();if(!inv)return fail(',
        'const left=inv.leftInventory,right=inv.rightInventory',
        'const leftSlotLimit=whole(left.slots),rightSlotLimit=whole(right.slots)',
        'const maxWeight=Math.max(0,num(left.maxWeight)),usedWeight=weight(leftItems)',
        'freeWeight=Math.max(0,maxWeight-usedWeight-reserveWeight)',
        'if(currentFreeSlots<reserveSlots)return fail(',
        'if(!target&&currentFreeSlots>reserveSlots)',
        'fromType:right.type,toType:left.type',
        'afterLeft-beforeLeft===take&&beforeRight-afterRight===take',
        'expectedStorageToken=',
        'expectedTypeToken=',
        "const receipt=(prefix,status)=>prefix+' '+moved+' '+stacks+' '+expectedStorageToken+' '+expectedTypeToken+' '+operationToken+' '+status;",
        "const fail=code=>moved>0?receipt('WITHDRAWN_PARTIAL','PARTIAL_'+code):'ERROR '+code;",
        "return moved>0?receipt('WITHDRAWN','COMPLETE'):'ERROR INVENTORY_CAPACITY';",
        'remainingTarget=Math.max(0,maximumCount-nameTotal(leftItems,expectedName))',
        'Math.min(available,remainingTarget')) {
    Assert-ContainsExact $withdrawMethod $liveClause `
        "WithdrawItemAsync lost a live/reserved/verified transfer guarantee: $liveClause"
}
$withdrawFetchIndex = $withdrawMethod.IndexOf("fetch('https://'",
    [StringComparison]::Ordinal)
Assert-Contract ($withdrawFetchIndex -ge 0) `
    'WithdrawItemAsync no longer dispatches through the expected swapItems path.'
$withdrawPostDispatch = $withdrawMethod.Substring($withdrawFetchIndex)
Assert-Contract (([regex]::Matches($withdrawPostDispatch,
        "return 'ERROR AMBIGUOUS_TRANSFER'")).Count -eq 5 -and
    $withdrawPostDispatch -notmatch
        "fail\('(NO_PROGRESS|CANCELLED|WRONG_STORAGE)'\)" -and
    $withdrawPostDispatch -match
        "response===false\)return fail\('MOVE_REJECTED'\)") `
    'A post-dispatch withdrawal ambiguity can still become a retryable zero/partial receipt.'
Assert-Contract ($ambiguousTransferMock -match
    'delayedFirstWithdrawDispatches\s*:=\s*1' -and
    $ambiguousTransferMock -match
        'delayedDepositStackDispatches\s*:=\s*2' -and
    $ambiguousTransferMock -match
        'delayedWithdrawStackDispatches\s*:=\s*2' -and
    $ambiguousTransferMock -match
        'PARTIAL_AMBIGUOUS_TRANSFER' -and
    $ambiguousTransferMock -match 'PARTIAL_NO_PROGRESS') `
    'The deterministic delayed-first/partial-last no-retry regression model is missing.'

# Keep the storage lifecycle visible as named production FSM stages. Each stage
# must be recognized, present in transition policy, and entered by runtime code.
$storageStates = @(
    'CHECKING_INVENTORY', 'NEED_STORAGE', 'STOPPING_FARM',
    'LOCATING_TRUCK', 'MOVING_TO_TRUCK', 'VERIFY_TRUCK_REACHED',
    'OPENING_STORAGE', 'STORING_OUTPUTS', 'VERIFY_STORAGE',
    'REFILLING_INPUT', 'VERIFY_REFILL', 'LOCATING_FARM',
    'RETURNING_TO_FARM', 'VERIFY_FARM_REACHED', 'RESUMING_FARM',
    'VERIFY_FARM_RESUMED'
)
$knownStateCatalog = (([regex]::Matches($knownStates, '"(?<value>[^"]*)"') |
        ForEach-Object { $_.Groups['value'].Value }) -join '')
foreach ($state in $storageStates) {
    Assert-ContainsExact $knownStateCatalog ('|' + $state + '|') `
        "Storage FSM state is no longer recognized: $state"
    Assert-ContainsExact $transitionPolicy ('"' + $state + '"') `
        "Storage FSM state is absent from transition policy: $state"
    Assert-Contract ($source -match
        ('TransitionFarmState\("' + [regex]::Escape($state) + '"')) `
        "Storage FSM state has no production entry point: $state"
}

# A full inventory at startup has no post-start delta to identify safely. Both
# local and companion preflights must stop before any storagePending dispatch.
$startCapacity = $initializeLocal.IndexOf(
    'startCapacityBlocked := CapacityNeedsStorage(inventoryInfo, &startReason,',
    [StringComparison]::Ordinal)
$capacityBlock = $initializeLocal.IndexOf(
    'if startCapacityBlocked {', $coldStart, [StringComparison]::Ordinal)
$rawZeroReturn = $initializeLocal.IndexOf(
    'if startRawStoneCount = 0 {', $capacityBlock, [StringComparison]::Ordinal)
Assert-Contract ($startCapacity -ge 0 -and $coldStart -gt $startCapacity -and
    $capacityBlock -gt $coldStart -and $rawZeroReturn -gt $capacityBlock) `
    'Local startup capacity validation does not precede the refill-only raw-zero exception.'
$localStartFull = $initializeLocal.Substring($capacityBlock,
    $rawZeroReturn - $capacityBlock)
Assert-Contract ($localStartFull -match
    'StopAutomationWithFault\([\s\S]{0,420}"UNTRUSTED_STORAGE_BASELINE"\)[\s\S]{0,80}return\s+false' -and
    $localStartFull -notmatch 'storagePending\s*:=\s*true|RunVehicleStorageCycle\(') `
    'A full local cold start can move pre-existing items instead of failing closed.'
$companionCapacity = $startMining.IndexOf(
    'startCapacityBlocked := CapacityNeedsStorage(inventoryInfo,',
    [StringComparison]::Ordinal)
$companionBaseline = $startMining.IndexOf(
    'RecordConfirmedInventory(inventoryInfo, "start_companion",',
    $companionCapacity, [StringComparison]::Ordinal)
$companionCapacityBlock = $startMining.IndexOf(
    'if startCapacityBlocked {', $companionBaseline,
    [StringComparison]::Ordinal)
$companionStorageDispatch = $startMining.IndexOf(
    'if State.storagePending {', $companionCapacityBlock,
    [StringComparison]::Ordinal)
Assert-Contract ($companionCapacity -ge 0 -and
    $companionBaseline -gt $companionCapacity -and
    $companionCapacityBlock -gt $companionBaseline -and
    $companionStorageDispatch -gt $companionCapacityBlock -and
    $startMining.Substring($companionCapacityBlock,
        $companionStorageDispatch - $companionCapacityBlock) -match
        'StopAutomationWithFault\([\s\S]{0,500}"UNTRUSTED_STORAGE_BASELINE"\)[\s\S]{0,100}return' -and
    $startMining.Substring($companionCapacityBlock,
        $companionStorageDispatch - $companionCapacityBlock) -notmatch
        'RunVehicleStorageCycle\(') `
    'A full companion cold start can move pre-existing items instead of failing closed.'

# A timeout may complete after the ordinary storage path entered RECOVERY. The
# same checkpoint must consume exact live reductions before deciding whether to
# retry, refill, or return. Starting/stopping a run always drops the in-memory
# per-run ledger, while successful storage clears it only after remaining=0.
Assert-Contract ($farmRecovery -match
    'ReconcileActiveStorageDepositCheckpoint\(expectedGeneration,[\s\S]{0,220}inventoryInfo\.items[\s\S]{0,500}remainingLedgerUnits\s*=\s*0[\s\S]{0,220}FinalizeVerifiedFarmOutputDeposit\(' -and
    $farmRecovery -match
    'remainingDelta\s*:=\s*remainingLedgerUnits\s*>\s*0') `
    'RECOVERY no longer reconciles a late exact reduction from the active checkpoint.'
Assert-Contract ($startMining -match 'ResetFarmOutputLedger\(\)' -and
    $stopMining -match 'ResetFarmOutputLedger\(\)' -and
    $source -match
    'FinalizeVerifiedFarmOutputDeposit\([^)]*\)\s*\{[\s\S]{0,700}FarmOutputLedgerHasPending\(State\.farmOutputLedger\)[\s\S]{0,700}State\.farmOutputLedger\s*:=\s*NewExactInventoryCountMap\(\)') `
    'The per-run output ledger is not reset at both lifecycle boundaries and verified-empty deposit.'

# An old synchronous storage stack may unwind after F9 and a new F8 run. Cleanup
# must be guarded before any key release/NUI close so it cannot mutate the new run.
$cleanupFinally = [regex]::Match($localStorage,
    '(?s)finally\s*\{\s*;[^}]*if\s+StorageCycleStillOwnsCleanup\(expectedGeneration\)\s*\{(?<owned>.*?)\}\s*else\s*\{')
Assert-Contract ($cleanupFinally.Success -and
    $cleanupFinally.Groups['owned'].Value -match 'ReleaseAllInputs\(\)' -and
    $cleanupFinally.Groups['owned'].Value -match 'ReleaseBackgroundTarget\(true\)' -and
    $cleanupFinally.Groups['owned'].Value -match 'RunBackgroundBridge\("close-inventory"\)') `
    'Stale storage cleanup is not generation-owned before releasing input and closing NUI.'
Assert-Contract ($source -match
    'StorageCycleCleanupAllowed\(expectedGeneration,\s*currentGeneration,\s*running\)\s*\{[\s\S]{0,180}running\s*&&\s*expectedGeneration\s*>\s*0[\s\S]{0,120}expectedGeneration\s*=\s*currentGeneration') `
    'The storage cleanup ownership predicate no longer rejects stopped/stale generations.'

Write-Host 'Storage closed-loop source contract tests passed.'
