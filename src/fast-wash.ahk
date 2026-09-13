; Fast washing has one authoritative pre-click snapshot, not a separate polling
; inventory workflow. Reward proof and all transfer checks remain mandatory.
FastWashStartAvailable() {
    global State, LocalNav
    return AutomationStartAllowed(State.running, State.registrationActive,
        State.startInProgress, State.stopInProgress, State.activeFarmCallbacks)
        && !State.updateOperation && !LocalNav.busy && !LocalNav.requestActive
}

; Both low-latency washing launchers take their capacity decision from the
; authoritative pre-click inventory snapshot.  Keeping this policy in one
; predicate prevents the generic three-second inventory poll from interrupting
; either wash loop while still routing an actual full/empty observation through
; the existing verified storage ledger.
LiveWashCapacityModeEnabled() {
    return FastWashModeEnabled() || EndlessWashModeEnabled()
}

ConfigureFastWashStart(startToken) {
    global State, Config, LocalNav
    if !IsStartOperationCurrent(startToken) || State.updateOperation
        || LocalNav.busy || LocalNav.requestActive
        return false
    wasCritical := A_IsCritical
    if !wasCritical
        Critical "On"
    oldMode := Config.actionMode
    try {
        if !IsStartOperationCurrent(startToken)
            return false
        Config.actionMode := "washing"
        try SaveAllSettingsAtomically()
        catch as err {
            Config.actionMode := oldMode
            State.statusLabel.Text := "高速石洗いの設定を保存できませんでした"
            WriteDiagnostic("FAST_WASH_START_SAVE_FAILED " err.Message)
            return false
        }
        State.actionControl.Choose(2)
        UpdateActionUi()
        RefreshVehicleUi()
        SupportWriteEvent("FAST_WASH_QUICK_START", "mode=washing fast=1 storage_setting_preserved=1")
        return IsStartOperationCurrent(startToken)
    } finally {
        if !wasCritical
            Critical "Off"
    }
}

FastWashCapacityObservationCurrent(generation, snapshot) {
    global State
    if !IsCurrentRun(generation) || !LiveWashCapacityModeEnabled() || !IsObject(snapshot)
        || snapshot != State.confirmedInventory
        return false
    if !snapshot.HasOwnProp("confirmedAt") || !snapshot.HasOwnProp("revision")
        || snapshot.revision != State.inventorySnapshotRevision
        return false
    age := MonotonicMs() - snapshot.confirmedAt
    return age >= 0 && age <= 1500
}

MaybeHandleFastWashCapacity(generation) {
    global State, Config
    if !LiveWashCapacityModeEnabled() || !Config.vehicleStorageEnabled
        return false
    if !IsCurrentRun(generation)
        return true
    attempt := State.pendingFarmAttempt
    if !IsObject(attempt) || attempt.generation != generation
        || attempt.actionMode != "washing" || attempt.clicked
        || State.actionCompletionPending
        return true
    snapshot := attempt.before
    if !FastWashCapacityObservationCurrent(generation, snapshot) {
        DiscardPendingFarmAttempt("fast_capacity_observation_expired")
        SupportWriteEvent("FAST_WASH_BASELINE_RETRY", "reason=expired_or_replaced cargo=0")
        ScheduleNext(generation, 1)
        return true
    }
    needsStorage := FarmModeNeedsStorage("washing", snapshot,
        Config.rawStoneItemName, State.inventoryBaselineWeight,
        &reason, &freeWeight, &rawCount)
    if rawCount >= 0
        State.lastRawStoneCount := rawCount
    if !needsStorage {
        SupportWriteEvent("FAST_WASH_READY", "proof=live_baseline periodic_snapshot=0 cargo_probe=0")
        return false
    }
    ; No click has occurred. Keep only this exact fresh observation and let the
    ; existing ledger/identity/receipt workflow authorize any transfer.
    DiscardPendingFarmAttempt("fast_wash_needs_storage")
    SupportWriteEvent("FAST_WASH_STORAGE_REQUIRED", "reason=" reason " proof=live_baseline")
    State.nextCapacityCheckAt := 0
    if !TransitionFarmState("CHECKING_INVENTORY", "高速石洗い：収納・補充が必要（" reason "）", generation)
        return true
    MaybeHandleVehicleCapacity(generation, snapshot)
    return true
}

FastWashStartupObservationCurrent(generation, snapshot) {
    global State
    if !IsCurrentRun(generation) || !LiveWashCapacityModeEnabled() || !IsObject(snapshot)
        return false
    if !snapshot.HasOwnProp("startupGeneration") || !snapshot.HasOwnProp("startupEpoch")
        || !snapshot.HasOwnProp("startupObservedAt")
        return false
    age := MonotonicMs() - snapshot.startupObservedAt
    return snapshot.startupGeneration = generation && snapshot.startupEpoch == State.serverEpoch
        && age >= 0 && age <= 1500
}
