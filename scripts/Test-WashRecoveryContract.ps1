#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '..\src\mining-auto.ahk')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedSource = [System.IO.Path]::GetFullPath($SourcePath)
if (-not (Test-Path -LiteralPath $resolvedSource -PathType Leaf)) {
    throw "Washing recovery source was not found: $resolvedSource"
}
$source = Get-Content -LiteralPath $resolvedSource -Raw

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
$dispatcher = Get-AhkFunctionBody 'AutomationCycle'
$start = Get-AhkFunctionBody 'StartMining'
$maintain = Get-AhkFunctionBody 'MaintainBackgroundWorkView'
$scheduleNext = Get-AhkFunctionBody 'ScheduleNext'

Assert-Contract ($source -match
    'washPostCompletionSettleMs:\s*ReadIntegerSetting\(settingsPath,\s*"Washing",\s*"PostCompletionSettleMs",\s*1200,\s*900,\s*4000\)') `
    'The post-wash no-input window is not loaded with the safe 1.2 second default.'
Assert-Contract (([regex]::Matches($source,
    'IniWrite\s+Config\.washPostCompletionSettleMs,\s*temporarySettingsPath,\s*"Washing",\s*"PostCompletionSettleMs"')).Count -ge 2) `
    'The post-wash settle setting is not preserved by both settings save paths.'

Assert-Contract ($complete -match
    'startWashRecovery\s*:=\s*actionMode\s*=\s*"washing"[\s\S]{0,900}if\s+startWashRecovery\s*\r?\n\s*return\s+BeginWashCompletionRecovery\(expectedGeneration,\s*attemptId\)') `
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
    'The 1.2 second WASH_SETTLING window can dispatch movement or camera input.'
Assert-Contract ($settleDone -ge 0 -and $correctionCall -gt $settleDone) `
    'Forward correction can run before the settle deadline completes.'
Assert-Contract ($probeCall -gt $correctionCall -and $resumeCall -gt $probeCall -and
    $cameraCall -gt $resumeCall) `
    'WASH_VERIFYING must probe first, resume a visible target without camera input, and only then contain the missing-target camera path.'
$targetReadyBranch = $cycle.IndexOf('if targetReady {', $probeCall,
    [StringComparison]::Ordinal)
$visibleBranchReturn = $cycle.IndexOf('return', $resumeCall,
    [StringComparison]::Ordinal)
Assert-Contract ($targetReadyBranch -gt $probeCall -and
    $visibleBranchReturn -gt $resumeCall -and $visibleBranchReturn -lt $cameraCall) `
    'A target already visible after washing can still fall through to camera input.'
Assert-Contract ($cycle.Substring($probeCall, $cameraCall - $probeCall) -match
    'if\s+!State\.targetLostSince\s*\r?\n\s*State\.targetLostSince\s*:=\s*MonotonicMs\(\)') `
    'The missing-target observation is not committed before forced view recovery.'

$sentLatch = $correct.IndexOf('State.washCorrectionSent := true',
    [StringComparison]::Ordinal)
$movement = $correct.IndexOf('"play-route-health"',
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
    'nudgeResult := RunBackgroundBridgeCancelable(expectedGeneration,',
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
$installNextTimer = $scheduleNext.IndexOf('SetTimer(nextFn, -Max(1, delayMs))',
    [StringComparison]::Ordinal)
Assert-Contract ($cancelOldTimer -ge 0 -and
    $installNextTimer -gt $cancelOldTimer) `
    'A previous Farm timer can overlap the dedicated washing settle/recovery timer.'

$beginSession = $start.IndexOf('if !BeginFarmMetagameSession(runGeneration)',
    [StringComparison]::Ordinal)
$schedule = $start.IndexOf('ScheduleNext(runGeneration,',
    [StringComparison]::Ordinal)
Assert-Contract ($beginSession -ge 0 -and $schedule -gt $beginSession -and
    $start.Substring($beginSession, $schedule - $beginSession) -match 'StopMining\(\)') `
    'A failed durable STONE session can still reach the first Farm timer.'

Write-Output 'Washing completion recovery source contract tests passed.'
