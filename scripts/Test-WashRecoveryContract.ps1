#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$SourcePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceCandidate = if ([string]::IsNullOrWhiteSpace($SourcePath)) {
    Join-Path $PSScriptRoot '..\src\mining-auto.ahk'
} else {
    $SourcePath
}
$resolvedSource = [System.IO.Path]::GetFullPath($sourceCandidate)
if (-not (Test-Path -LiteralPath $resolvedSource -PathType Leaf)) {
    throw "Washing recovery source was not found: $resolvedSource"
}
$source = Get-Content -LiteralPath $resolvedSource -Raw -Encoding UTF8

function Assert-Contract {
    param(
        [Parameter(Mandatory)] [bool]$Condition,
        [Parameter(Mandatory)] [string]$Message
    )
    if (-not $Condition) { throw $Message }
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

$complete = Get-AhkFunctionBody 'CompleteVerifiedFarmReward'
$begin = Get-AhkFunctionBody 'BeginWashCompletionRecovery'
$correct = Get-AhkFunctionBody 'PerformWashCompletionCorrection'
$cycle = Get-AhkFunctionBody 'RunWashCompletionRecoveryCycle'
$resumeAfterWash = Get-AhkFunctionBody 'ResumeAfterWashCompletionRecovery'
$dispatcher = Get-AhkFunctionBody 'AutomationCycleOwned'
$start = Get-AhkFunctionBody 'StartMining'
$maintain = Get-AhkFunctionBody 'MaintainBackgroundWorkView'
$scheduleNext = Get-AhkFunctionBody 'ScheduleNext'
$armTimer = Get-AhkFunctionBody 'ArmFarmTimerOwned'
$armPendingTimer = Get-AhkFunctionBody 'ArmPendingFarmTimerAfterOwnerRelease'
$claimCallback = Get-AhkFunctionBody 'TryClaimFarmCallback'
$releaseCallback = Get-AhkFunctionBody 'ReleaseFarmCallback'
$automationCycle = Get-AhkFunctionBody 'AutomationCycle'
$stop = Get-AhkFunctionBody 'StopMining'
$timerHandoffMock = Get-AhkFunctionBody 'RunFarmTimerHandoffMockTest'
$washingReward = Get-AhkFunctionBody 'WashingSnapshotHasExchangeReward'
$confirmReward = Get-AhkFunctionBody 'TryConfirmPendingFarmRewardSnapshot'

Assert-Contract ($source -match
    'washPostCompletionSettleMs:\s*ReadIntegerSetting\(settingsPath,\s*"Washing",\s*"PostCompletionSettleMs",\s*2000,\s*2000,\s*4000\)') `
    'The fallback without visual observation must preserve the 2.0 second minimum.'
Assert-Contract (([regex]::Matches($source,
    'IniWrite\s+Config\.washPostCompletionSettleMs,\s*temporarySettingsPath,\s*"Washing",\s*"PostCompletionSettleMs"')).Count -ge 2) `
    'The post-wash settle setting is not preserved by both settings save paths.'

Assert-Contract ($complete -match
    'startWashRecovery\s*:=\s*actionMode\s*=\s*"washing"[\s\S]{0,1400}if\s+startWashRecovery\s*\{[\s\S]{0,220}BeginWashCompletionRecovery\(expectedGeneration,\s*\r?\n?\s*attemptId\)') `
    'A verified washing reward does not enter the dedicated settle state.'
Assert-Contract ($complete -notmatch 'PerformWashCompletionCorrection\(') `
    'Forward correction is still dispatched synchronously at reward completion.'
Assert-Contract ($begin -match
    'TransitionFarmState\("WASH_SETTLING"') `
    'The washing recovery flow does not begin in WASH_SETTLING.'
Assert-Contract ($begin -match
    'washSettleDeadline\s*:=\s*settleDeadline') `
    'The no-input window has no monotonic deadline.'
Assert-Contract ($begin -notmatch 'play-route-health|PerformWashCompletionCorrection|MaintainBackgroundWorkView') `
    'The settle entry path can dispatch movement or camera input too early.'
Assert-Contract (([regex]::Matches($source,
    'TransitionFarmState\("WASH_SETTLING"')).Count -eq 1 -and
    ([regex]::Matches($source,
    'BeginWashCompletionRecovery\(')).Count -eq 2) `
    'WASH_SETTLING has an unowned entry path outside one verified washing reward.'

$settleDone = $cycle.IndexOf('WASH_SETTLE_DONE', [StringComparison]::Ordinal)
$correctionCall = $cycle.IndexOf('PerformWashCompletionCorrection(',
    [StringComparison]::Ordinal)
$cameraCall = $cycle.IndexOf('MaintainBackgroundWorkView(expectedGeneration, true)',
    [StringComparison]::Ordinal)
$probeCall = $cycle.IndexOf('ProbeWorkTarget("washing", expectedGeneration)',
    [StringComparison]::Ordinal)
$resumeCall = $cycle.IndexOf('TransitionFarmState("FARMING"',
    [StringComparison]::Ordinal)
Assert-Contract ($cycle -match
    'remaining\s*:=\s*State\.washSettleDeadline\s*-\s*MonotonicMs\(\)') `
    'WASH_SETTLING does not enforce its monotonic deadline.'
$settleBranchStart = $cycle.IndexOf('if currentState = "WASH_SETTLING" {',
    [StringComparison]::Ordinal)
$correctingBranchStart = $cycle.IndexOf('if currentState = "WASH_CORRECTING" {',
    [StringComparison]::Ordinal)
Assert-Contract ($settleBranchStart -ge 0 -and
    $correctingBranchStart -gt $settleBranchStart) `
    'The dedicated settle branch cannot be isolated.'
$settleBranch = $cycle.Substring($settleBranchStart,
    $correctingBranchStart - $settleBranchStart)
Assert-Contract ($settleBranch -notmatch
    'PerformWashCompletionCorrection|MaintainBackgroundWorkView|play-route|SendForegroundCameraDown|SendRelativeMouseDelta') `
    'The 2.0 second WASH_SETTLING window can dispatch movement or camera input.'
Assert-Contract ($settleDone -ge 0 -and $correctionCall -gt $settleDone) `
    'Forward correction can run before the settle deadline completes.'
Assert-Contract ($cycle -notmatch 'ProbeWorkTarget|WASH_VERIFYING|MaintainBackgroundWorkView' -and
    $cycle -match 'PerformWashCompletionCorrection\([\s\S]{0,300}ResumeAfterWashCompletionRecovery\(') `
    'Post-wash correction still enters a redundant visual probe/recovery loop.'
Assert-Contract ($resumeAfterWash -match 'TransitionFarmState\("FARMING"' -and
    $resumeAfterWash -match 'ScheduleNext\(expectedGeneration,\s*1\)' -and
    $resumeAfterWash -notmatch 'ProbeWorkTarget|MaintainBackgroundWorkView') `
    'The corrected wash does not resume the bundled target wait immediately.'

$sentLatch = $correct.IndexOf('State.washCorrectionSent := true',
    [StringComparison]::Ordinal)
$movement = $correct.IndexOf('RunObservedWashHelper(',
    [StringComparison]::Ordinal)
Assert-Contract ($correct -match
    'IsCurrentFarmTask\(expectedGeneration,\s*expectedTaskId,\s*\r?\n\s*"WASH_CORRECTING"\)') `
    'The correction helper lacks strict generation/task/state ownership.'
Assert-Contract ($correct -match 'if\s+State\.washCorrectionSent' -and
    $correct -match 'if\s+State\.washCorrectionInFlight') `
    'The correction helper lacks duplicate and in-flight guards.'
Assert-Contract ($sentLatch -ge 0 -and $movement -gt $sentLatch) `
    'At-most-once must be committed before external forward input is dispatched.'
Assert-Contract (([regex]::Matches($source,
    'PerformWashCompletionCorrection\(')).Count -eq 2) `
    'Forward correction has more than one runtime call site.'
$bridgeResponse = $correct.IndexOf(
    'nudgeResult := RunObservedWashHelper(',
    [StringComparison]::Ordinal)
$responseCritical = $correct.IndexOf(
    'criticalWasOn := EnterMetagameOutboxCritical()', $bridgeResponse,
    [StringComparison]::Ordinal)
$responseOwnerCheck = $correct.IndexOf(
    'if !IsCurrentFarmTask(expectedGeneration, expectedTaskId,',
    $responseCritical, [StringComparison]::Ordinal)
$responseCounter = $correct.IndexOf('State.nudges += 1', $responseCritical,
    [StringComparison]::Ordinal)
$responseCriticalEnd = $correct.IndexOf(
    'finally LeaveMetagameOutboxCritical(criticalWasOn)', $responseCritical,
    [StringComparison]::Ordinal)
Assert-Contract ($bridgeResponse -ge 0 -and
    $responseCritical -gt $bridgeResponse -and
    $responseOwnerCheck -gt $responseCritical -and
    $responseCounter -gt $responseOwnerCheck -and
    $responseCriticalEnd -gt $responseCounter) `
    'A stale route response can still update the new run correction counter/UI.'
Assert-Contract ($correct.Substring($responseCritical,
    $responseCriticalEnd - $responseCritical) -match
    'washRecoveryGeneration\s*!=\s*expectedGeneration[\s\S]*washRecoveryAttemptId\s*!=\s*expectedAttemptId') `
    'Post-route correction commit does not revalidate exact generation and reward ownership.'

$targetOkGuard = $maintain.IndexOf(
    'if State.workViewStatus = "TARGET_OK" && !State.targetLostSince',
    [StringComparison]::Ordinal)
$cameraDispatch = $maintain.IndexOf('SendForegroundCameraDown(',
    [StringComparison]::Ordinal)
Assert-Contract ($targetOkGuard -ge 0 -and $cameraDispatch -gt $targetOkGuard) `
    'A currently observed TARGET_OK view is not protected from periodic/forced camera drift.'
Assert-Contract ($maintain.Substring($targetOkGuard,
    $cameraDispatch - $targetOkGuard) -match 'return true') `
    'TARGET_OK without an observed MISSING does not return before camera input.'

$washDispatch = $dispatcher.IndexOf(
    'RunWashCompletionRecoveryCycle(expectedGeneration, expectedTaskId)',
    [StringComparison]::Ordinal)
$unhandled = $dispatcher.IndexOf('dispatcher_unhandled_',
    [StringComparison]::Ordinal)
Assert-Contract ($washDispatch -ge 0 -and $washDispatch -lt $unhandled) `
    'Dedicated washing states are not dispatched before generic unknown-state recovery.'
$cancelOldTimer = $scheduleNext.IndexOf('SetTimer(State.timerFn, 0)',
    [StringComparison]::Ordinal)
$installNextTimer = $scheduleNext.IndexOf('ArmFarmTimerOwned(expectedGeneration, expectedTaskId, delayMs)',
    [StringComparison]::Ordinal)
Assert-Contract ($cancelOldTimer -ge 0 -and
    $installNextTimer -gt $cancelOldTimer -and
    $armTimer -match 'SetTimer\(nextFn,\s*-Max\(1,\s*Round\(delayMs\)\)\)') `
    'A previous Farm timer can overlap the dedicated washing settle/recovery timer.'
Assert-Contract ($automationCycle -match
    'TryClaimFarmCallback\(expectedGeneration,\s*expectedTaskId\)[\s\S]{0,180}try\s+AutomationCycleOwned\(expectedGeneration,\s*expectedTaskId\)[\s\S]{0,100}finally\s+ReleaseFarmCallback\(\)' -and
    $claimCallback -match
    'State\.stopInProgress\s*\|\|\s*State\.activeFarmCallbacks\s*!=\s*0[\s\S]{0,300}State\.activeFarmCallbacks\s*\+=\s*1' -and
    $releaseCallback -match
    'State\.activeFarmCallbacks\s*-=?\s*1[\s\S]{0,180}if\s+State\.activeFarmCallbacks\s*=\s*0[\s\S]{0,100}ArmPendingFarmTimerAfterOwnerRelease\(\)') `
    'Farm callbacks are not serialized through one claim/release owner.'
Assert-Contract ($scheduleNext -match
    'action\s*:=\s*FarmTimerScheduleAction\([\s\S]{0,300}if\s+action\s*=\s*"DEFER"[\s\S]{0,500}pendingFarmTimerGeneration\s*:=\s*expectedGeneration[\s\S]{0,180}pendingFarmTimerTaskId\s*:=\s*expectedTaskId[\s\S]{0,180}pendingFarmTimerDueAt\s*:=' -and
    $armPendingTimer -match
    'pendingFarmTimerGeneration\s*:=\s*0[\s\S]{0,120}pendingFarmTimerTaskId\s*:=\s*0[\s\S]{0,120}pendingFarmTimerDueAt\s*:=\s*0[\s\S]{0,600}ArmFarmTimerOwned\(expectedGeneration,\s*expectedTaskId' -and
    $start -match
    'pendingFarmTimerGeneration\s*:=\s*0[\s\S]{0,120}pendingFarmTimerTaskId\s*:=\s*0[\s\S]{0,120}pendingFarmTimerDueAt\s*:=\s*0' -and
    $stop -match
    'pendingFarmTimerGeneration\s*:=\s*0[\s\S]{0,120}pendingFarmTimerTaskId\s*:=\s*0[\s\S]{0,120}pendingFarmTimerDueAt\s*:=\s*0') `
    'Deferred one-shot handoff is not last-wins, owner-released, and start/stop cleared.'
Assert-Contract ($timerHandoffMock -match
    'Loop\s+iterations[\s\S]{0,700}pendingTaskId\s*!=\s*13[\s\S]{0,500}armedCount\s*\+=\s*1[\s\S]{0,350}armedCount\s*!=\s*1[\s\S]{0,350}stopInProgress\s*:=\s*true[\s\S]{0,250}"DROP"' -and
    $source -match 'RunFarmTimerHandoffMockTest\(100\)') `
    'The compiled validation path no longer proves exactly one last-wins timer handoff.'
Assert-Contract ($washingReward -match
    'beforeRaw\s*:=\s*InventorySpecNameCount[\s\S]{0,260}if\s+beforeRaw\s*<=\s*afterRaw[\s\S]{0,100}return\s+false' -and
    $washingReward -match
    'DetectConsumedInventoryItem\(beforeInfo\.items,\s*afterInfo\.items' -and
    $washingReward -match
    'StrCompare\(name,\s*consumedRawName,\s*true\)\s*=\s*0[\s\S]{0,300}outputUnits\s*\+=' -and
    $washingReward -match
    'return\s+consumedUnits\s*>\s*0\s*&&\s*outputUnits\s*>\s*0' -and
    $confirmReward -match
    'actionMode\s*=\s*"washing"[\s\S]{0,350}WashingSnapshotHasExchangeReward\(' -and
    $source -match 'testWashingRewardEvidenceOk\s*:=\s*WashingSnapshotHasExchangeReward\(') `
    'Washing success can be counted without both raw consumption and a different output gain.'

$beginSession = $start.IndexOf('if !BeginFarmMetagameSession(runGeneration)',
    [StringComparison]::Ordinal)
$schedule = $start.IndexOf('ScheduleNext(runGeneration,',
    [StringComparison]::Ordinal)
Assert-Contract ($beginSession -ge 0 -and $schedule -gt $beginSession -and
    $start.Substring($beginSession, $schedule - $beginSession) -match 'StopMining\(\)') `
    'A failed durable STONE session can still reach the first Farm timer.'

Write-Output 'Washing completion recovery source contract tests passed.'

Assert-Contract ($correct -notmatch 'play-route-health|washForwardPulseMs') 'Washing must not use unobserved transport nudges.'
Assert-Contract ($correct -match 'WASH_STABLE' -and $correct -match 'if visualOk') 'Movement success must require visual evidence.'
Assert-Contract ($begin -match 'settleDelay := EndlessWashModeEnabled\(\)[\s\S]{0,100}EndlessWashPostMotionSettleMs\(\)[\s\S]{0,120}StationaryOnlyEnabled\(\) \? 1') 'Dedicated endless wash must wait for root motion while ordinary stationary mode remains immediate.'
$attempt = Get-AhkFunctionBody 'WashAttemptBackground'
Assert-Contract ($attempt -match 'EnsureObservedWashAnchor' -and $attempt -match '!Config.washForwardCorrection && !EnsureWorkViewDown') 'Observed camera must not be pitch-clamped every wash.'
$vision = [IO.File]::ReadAllText((Join-Path (Split-Path $resolvedSource) 'wash-position\WashPosition.cs'))
Assert-Contract ($vision.Contains('FORWARD_NO_OBSERVED_EFFECT') -and $vision.Contains('WRONG_DIRECTION_OR_CAMERA_MOVED')) 'Observed correction must reject no-effect and worsening pulses.'
Assert-Contract ($vision.Contains('finally {ReleaseKey();') -and $vision.Contains('GetForegroundWindow()!=target')) 'Physical input must be released and foreground guarded.'
Assert-Contract ($vision -notmatch 'move_up_only|ReadProcessMemory|MoveCamera') 'Washing helper may not use guessed game commands or camera injection.'

$washModule = [IO.File]::ReadAllText((Join-Path (Split-Path $resolvedSource) 'wash-position.ahk'))
Assert-Contract ($washModule.Contains('ObservedWashCorrectionOperation(generation)') -and
    $washModule.Contains('ExeRouteBindingValid("washing", State.serverEpoch)') -and
    $correct.Contains('RunObservedWashHelper(correctionOperation, expectedGeneration)')) 'Nearby precise correction is not bound to the registered active route.'
Assert-Contract ($vision.Contains('CUMULATIVE_MICRO_DRIFT_TEST') -and $vision.Contains('RefineSubpixel') -and
    $vision.Contains('NO_INPUT_WITHIN_TOLERANCE') -and $vision.Contains('noEffect>=2')) 'Micro drift, zero-input and consecutive-no-effect regressions are missing.'
Assert-Contract ($source.Contains('WASH_RECOVERY_TICK') -and
    $source.Contains('meta .= EndlessWashModeEnabled()')) 'Input policy and pending-dispatch states are not observable.'

# Stationary service is not a visual-success bypass: require before+after task
# proof, single native proposal, exact reward ownership and unchanged transfers.
$nearby = [IO.File]::ReadAllText((Join-Path (Split-Path $resolvedSource) 'nearby-wash.ahk'))
Assert-Contract ($nearby.Contains('EvaluateNearbyWashService') -and
    $nearby.Contains('TASK_NOT_READY_BEFORE_INPUT') -and $nearby.Contains('TASK_NOT_READY_AFTER_INPUT') -and
    $nearby.Contains('INVALID_SERVICE_RECEIPT') -and $source.Contains('ValidateNearbyWashService()')) 'Task proof and compiled service tests required.'
Assert-Contract ($vision.Contains('ServicePulseSelfTest') -and $vision.Contains('INPUT_ENDED_NEEDS_TASK_PROOF') -and
    $vision.Contains('SERVICE_CAMERA_RESIDUAL_TEST')) 'Service movement cannot pretend image convergence.'
