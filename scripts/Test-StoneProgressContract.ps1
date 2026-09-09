#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '..\src\mining-auto.ahk')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$source = Get-Content -LiteralPath $SourcePath -Raw

function Assert-SourcePattern {
    param(
        [Parameter(Mandatory)] [string]$Pattern,
        [Parameter(Mandatory)] [string]$Failure
    )
    if (-not [regex]::IsMatch($source, $Pattern,
            [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
        throw $Failure
    }
}

Assert-SourcePattern `
    'BuildFarmRewardEventId\(farmSessionId, actionMode,[\s\S]{0,500}eventId := "mine_" farmSessionId "_" actionMode' `
    'STONE event IDs must include the verified Farm mode.'
Assert-SourcePattern `
    'EmitVerifiedFarmReward\(expectedGeneration, actionMode,[\s\S]{0,650}!IsSupportedStoneActivityMode\(actionMode\)[\s\S]{0,250}State\.runMode != actionMode' `
    'The trusted STONE emitter must reject unsupported or stale Farm modes.'
Assert-SourcePattern `
    'EmitVerifiedFarmReward\(expectedGeneration, actionMode,[\s\S]{0,2400}if !BeginFarmMetagameSession\(expectedGeneration\)\s+return false[\s\S]{0,500}DurablyEnqueueMetagameEvent\("MINING_SUCCESS"' `
    'A verified reward must never enqueue before its durable SESSION_BEGIN.'
Assert-SourcePattern `
    'WaitForVerifiedFarmRewardDurability\(expectedGeneration, actionMode,[\s\S]{0,1800}EmitVerifiedFarmReward\(expectedGeneration, actionMode, attemptId,[\s\S]{0,180}completedAtUnixMs, stableEventId' `
    'All verified Farm rewards must retry one stable ID and immutable timestamp.'
Assert-SourcePattern `
    'TryConfirmPendingFarmRewardSnapshot\(expectedGeneration, actionMode,[\s\S]{0,1300}EnterMetagameOutboxCritical\(\)[\s\S]{0,1500}InventorySnapshotHasReward\(afterInfo, attempt\.before\)[\s\S]{0,1500}attempt\.rewardSessionId := frozenSessionId[\s\S]{0,1700}PersistVerifiedRewardIntent\(attempt\.rewardEventId[\s\S]{0,500}attempt\.completed := true' `
    'Reward proof, immutable session freeze, and first WAL E must be one Critical transaction before completed is exposed.'
Assert-SourcePattern `
    'EmitVerifiedFarmReward\(expectedGeneration, actionMode,[\s\S]{0,850}eventSessionId := rewardSessionId \? rewardSessionId : State\.farmSessionId[\s\S]{0,180}BuildFarmRewardEventId\(eventSessionId' `
    'Stable reward IDs must be validated against the frozen attempt session rather than mutable global session state.'
Assert-SourcePattern `
    'WaitForVerifiedFarmRewardDurability\(expectedGeneration, actionMode,[\s\S]{0,900}attempt\.rewardSessionId != rewardSessionId[\s\S]{0,550}EmitVerifiedFarmReward\(expectedGeneration, actionMode, attemptId,[\s\S]{0,240}rewardSessionId' `
    'Durability retry must retain and revalidate the immutable reward session.'
Assert-SourcePattern `
    'PersistVerifiedRewardIntent\(eventId, actionMode, snapshotRevision,[\s\S]{0,500}BeginFarmMetagameSession\(expectedGeneration\)[\s\S]{0,700}DurablyEnqueueMetagameEvent\("MINING_SUCCESS"[\s\S]{0,500}CommitVerifiedRewardIntent\(eventId\)' `
    'The independent reward WAL must bracket outbox persistence before Host delivery.'
Assert-SourcePattern `
    'FlushMetagameOutboxHead\(expectedGeneration\)[\s\S]{0,1500}entry\.command = "MINING_SUCCESS"[\s\S]{0,300}verifiedRewardWalPending\.Has\(entry\.id\)[\s\S]{0,250}return false' `
    'An unresolved reward WAL intent must block delivery to the Host.'
Assert-SourcePattern `
    'RecoverVerifiedRewardWal\([^)]*\)[\s\S]{0,2200}SESSION_BEGIN[\s\S]{0,1200}MINING_SUCCESS[\s\S]{0,1200}SESSION_END[\s\S]{0,1800}CommitVerifiedRewardIntent' `
    'WAL recovery must atomically create a closed session before resolving intents.'
Assert-SourcePattern `
    'RecoverVerifiedRewardWal\([^)]*\) \{[\s\S]{0,180}EnterMetagameOutboxCritical\(\)[\s\S]{0,4200}finally LeaveMetagameOutboxCritical\(criticalWasOn\)' `
    'WAL recovery must serialize its disk/memory replacement against ACK callbacks.'
Assert-SourcePattern `
    'AppendVerifiedRewardWalRecord\(recordLine\)[\s\S]{0,2200}walFile\.Write\("`n" recordLine\)' `
    'WAL appends must isolate a torn row from the following retry.'
Assert-SourcePattern `
    'PrepareMetagameForNewFarmStart\(\)[\s\S]{0,850}verifiedRewardWalPending\.Count[\s\S]{0,160}RecoverVerifiedRewardWal\(\)' `
    'A same-process F9 then F8 must recover verified reward intents before a new run.'
Assert-SourcePattern `
    'AcknowledgeMetagameEvent\(command, eventId\)[\s\S]{0,1900}nextAt := MonotonicMs\(\) \+ 1' `
    'ACKed history must advance on the next timer tick instead of the old 100 ms gap.'
Assert-SourcePattern `
    'ParseVerifiedFarmRewardDiagnosticLine\(line, &record,[\s\S]{0,2200}FARM_REWARD_CONFIRMED[\s\S]{0,900}reason=\(weight_increase\|item_increase\)' `
    'History migration must accept only verified inventory-reward diagnostics.'
Assert-SourcePattern `
    'RunLegacyFarmHistoryBackfill\(\)[\s\S]{0,4200}PersistMetagameOutbox\(candidate,[\s\S]{0,1800}WriteLegacyFarmHistoryBackfillMarker' `
    'History migration must persist its durable FIFO before its completion marker.'
Assert-SourcePattern `
    'RunLegacyFarmHistoryBackfill\(\)[\s\S]{0,3500}if !selectedRecords\.Length && !supportPending\s+return true[\s\S]{0,2600}if normalPending && hasNormalRecords[\s\S]{0,800}WriteLegacyFarmHistoryBackfillMarker' `
    'An empty normal install must not consume its future history-import marker.'
Assert-SourcePattern `
    'BuildLegacyFarmHistoryBatch\(baseOutbox,[\s\S]{0,1700}replayAt := Min\(record\.at, batchAtUnixMs\)[\s\S]{0,250}TryParseMetagameOutboxFields\("MINING_SUCCESS", eventId,\s*replayAt' `
    'Future legacy timestamps must be clamped before they can block Host replay.'
Assert-SourcePattern `
    'NormalizeStoppedMetagameOutboxAtStartup\(recoveryAtUnixMs := 0\)[\s\S]{0,1100}BuildClampedMetagameReplayOutbox[\s\S]{0,600}PersistMetagameOutboxArrayWithRetry\(startupCandidate\)[\s\S]{0,180}State\.metagameOutbox := startupCandidate' `
    'Future live outbox timestamps must be durably clamped during restart recovery.'
Assert-SourcePattern `
    'PersistRuntimeMetagameFutureClamp\(recoveryAtUnixMs\)[\s\S]{0,900}BuildClampedMetagameReplayOutbox[\s\S]{0,650}PersistMetagameOutboxArrayWithRetry\(candidate\)[\s\S]{0,180}State\.metagameOutbox := candidate' `
    'Runtime clock rollback must persist a copy-on-write clamp before memory commit.'
Assert-SourcePattern `
    'FlushMetagameOutboxHead\(expectedGeneration\)[\s\S]{0,900}wallClockNow := UnixTimeMilliseconds\(\)[\s\S]{0,240}PersistRuntimeMetagameFutureClamp\(wallClockNow\)[\s\S]{0,240}entry := State\.metagameOutbox\[1\][\s\S]{0,1800}SendMetagameCommand\(entry\.command, entry\.id, entry\.at\)' `
    'Every runtime FIFO send must clamp future timestamps before reading/sending its head.'
Assert-SourcePattern `
    'FarmAttemptRequiresDurabilityHold\(attempt\)[\s\S]{0,500}return FarmAttemptHasFrozenReward\(attempt\)' `
    'A proven reward must retain an unbounded durability hold.'
Assert-SourcePattern `
    'HandlePendingFarmRewardReconciliation\(expectedGeneration, expectedTaskId\)[\s\S]{0,1600}decision = "DURABILITY_HOLD"[\s\S]{0,650}ScheduleNext\(expectedGeneration, retryDelay\)[\s\S]{0,550}decision = "TIMEOUT"[\s\S]{0,180}DiscardPendingFarmAttempt\("reward_reconciliation_timeout"\)' `
    'Durability-pending rewards must retry indefinitely before any normal reconciliation timeout/discard path.'
Assert-SourcePattern `
    'if !isUiTestRun && \(!State\.verifiedRewardWalReady[\s\S]{0,140}RunLegacyFarmHistoryBackfill\(\)\)[\s\S]{0,500}BuildWebGui\(\)' `
    'History migration must finish before the UI Host can receive progression events.'
Assert-SourcePattern `
    'ParseLegacyFarmHistoryContents\(contents, &records, maximumRecords := 16384\)' `
    'Retained diagnostic logs must not be rejected at the old 2,048-event boundary.'
Assert-SourcePattern `
    'metagameBackfillMarkerPath:[\s\S]{0,220}: A_ScriptDir "\\AI採掘機_STONE履歴移行\.v1\.done"' `
    'The legacy-history marker must be scoped to the installation that owns the diagnostic log.'
Assert-SourcePattern `
    'paths := \[A_ScriptDir "\\AI採掘機_STONE履歴復元\.log",[\s\S]{0,180}State\.diagnosticPath "\.2", State\.diagnosticPath "\.1",[\s\S]{0,80}State\.diagnosticPath\]' `
    'The support recovery log must be imported through the strict history parser before diagnostic rotations.'
Assert-SourcePattern `
    'ParseDiagnosticSessionStartLine\(line, &versionCode\)[\s\S]{0,900}AI採掘機 v\(\[0-9\]\{1,4\}\)' `
    'Diagnostic history does not parse and retain the session source version.'
Assert-SourcePattern `
    'segmentAllowsLegacy := contentIsSupport[\s\S]{0,120}sessionVersionCode < 900000002' `
    'v9.0.2+ history must reject a reward line torn before its eventId/eventAt suffix.'
Assert-SourcePattern `
    'ConsolidateLegacyFarmHistoryRecords\(inputRecords, &records\)[\s\S]{0,600}FarmHistoryRecordFingerprint\(record\)[\s\S]{0,1200}existing\.exactEventId := record\.exactEventId[\s\S]{0,500}existing\.acknowledged := existing\.acknowledged \|\| record\.acknowledged' `
    'Duplicate support/rotation confirmations must merge by path-independent fingerprint and propagate exact ACK identity.'
Assert-SourcePattern `
    'supportPending := !LegacyFarmHistorySupportReceiptComplete\([\s\S]{0,2200}PersistMetagameOutbox\(candidate,[\s\S]{0,1700}WriteLegacyFarmHistorySupportReceipt\(' `
    'A support export added after the normal marker must have its own content receipt written only after queue persistence.'
Assert-SourcePattern `
    'diagnosticPath: isUiTestRun \|\| HasCommandLineArgument\("--validate"\)\s+\? A_Temp "\\ai-miner-diagnostic-test-" processId "\.log"\s+: A_ScriptDir "\\AI採掘機_診断\.log"' `
    'Updater validation, smoke, and visual tests must never modify the install diagnostic log.'
Assert-SourcePattern `
    'TryClaimStartOperation\(&startToken\)[\s\S]{0,500}EnterMetagameOutboxCritical\(\)[\s\S]{0,500}AutomationStartAllowed\(State\.running, State\.registrationActive,[\s\S]{0,120}State\.startInProgress\)[\s\S]{0,500}State\.startInProgress := true' `
    'A Start request does not atomically claim ownership before blocking preflight.'
Assert-SourcePattern `
    'StartMining\(\*\)[\s\S]{0,700}TryClaimStartOperation\(&startToken\)[\s\S]{0,600}PrepareMetagameForNewFarmStart\(\)[\s\S]{0,180}IsStartOperationCurrent\(startToken\)[\s\S]{0,5000}RunBackgroundBridge\("health"\)[\s\S]{0,180}IsStartOperationCurrent\(startToken\)' `
    'Start preflight does not revalidate ownership after its blocking boundaries.'
Assert-SourcePattern `
    'StartMining\(\*\)[\s\S]{0,9500}criticalWasOn := EnterMetagameOutboxCritical\(\)[\s\S]{0,180}IsStartOperationCurrent\(startToken\)[\s\S]{0,180}State\.running := true[\s\S]{0,20000}finally FinishStartPreparation\(startToken\)' `
    'Start does not atomically revalidate its owner at commit and clear it on every exit.'
Assert-SourcePattern `
    'StopMining\(\*\)[\s\S]{0,300}startCancelled := CancelStartOperation\(\)[\s\S]{0,500}if startCancelled && !State\.running[\s\S]{0,900}return' `
    'Stop cannot cancel a Start request while preflight still has running=false.'
Assert-SourcePattern `
    'IsMiningActive\(\*\)[\s\S]{0,160}State\.running \|\| State\.registrationActive \|\| State\.startInProgress' `
    'The stop hotkey is unavailable during Start preflight.'
Assert-SourcePattern `
    'TestStartOperationOwnership\(\)[\s\S]{0,1800}duplicateBlocked[\s\S]{0,500}stopCancelled[\s\S]{0,500}staleReleaseBlocked' `
    'The deterministic validation fixture does not cover duplicate Start and Stop-during-preflight ownership.'

$finalize = [regex]::Match($source,
    'CompleteVerifiedFarmReward\(expectedGeneration, actionMode,[\s\S]{0,7500}?ScheduleNext\(expectedGeneration, 1\)')
if (-not $finalize.Success) {
    throw 'Unable to isolate the verified Farm reward finalizer.'
}
if ($finalize.Value -match 'if\s+actionMode\s*=\s*"mining"') {
    throw 'The verified Farm reward finalizer still limits STONE to mining.'
}
$durableCommit = $finalize.Value.IndexOf('WaitForVerifiedFarmRewardDurability',
    [StringComparison]::Ordinal)
$visibleCommit = $finalize.Value.IndexOf('State.successes += 1',
    [StringComparison]::Ordinal)
$discardCommit = $finalize.Value.IndexOf('DiscardPendingFarmAttempt("reward_confirmed")',
    [StringComparison]::Ordinal)
$atomicRecheck = $finalize.Value.IndexOf('criticalWasOn := EnterMetagameOutboxCritical()',
    $durableCommit, [StringComparison]::Ordinal)
$generationRecheck = $finalize.Value.IndexOf('if !IsCurrentRun(expectedGeneration)',
    $atomicRecheck, [StringComparison]::Ordinal)
$durableRecheck = $finalize.Value.IndexOf('VerifiedFarmRewardIsDurable(stableEventId)',
    $atomicRecheck, [StringComparison]::Ordinal)
if ($durableCommit -lt 0 -or $atomicRecheck -lt 0 -or $generationRecheck -lt 0 -or
    $durableRecheck -lt 0 -or $visibleCommit -lt 0 -or $discardCommit -lt 0 -or
    $durableCommit -gt $visibleCommit -or $durableCommit -gt $discardCommit) {
    throw 'STONE durability and post-wait generation/attempt recheck must precede atomic visible success/discard.'
}

Write-Output 'STONE progression source contract tests passed.'
