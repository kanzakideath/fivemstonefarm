#Requires AutoHotkey v2.0
#SingleInstance Off
#Warn All, Off
#Include %A_ScriptDir%/../../src/fast-wash.ahk
; Production fast-wash functions; game/UI/storage I/O boundaries are scripted.
; This does not execute FiveM or claim that an item transfer occurred.
global State := 0, Config := 0, LocalNav := 0, Clock := 10000
    , SaveCalls := 0, ThrowSave := false, StorageCalls := 0, Scheduled := 0
    , Events := [], StorageReason := "", Cases := 0
out := A_Args[1]
OnError(TestError)
try {
    Reset()
    State.running := false
    Require(FastWashStartAvailable(), "stopped user may quick-start")
    State.updateOperation := "download"
    Require(!FastWashStartAvailable(), "update blocks quick-start")
    State.updateOperation := "", State.startInProgress := true
    Require(!FastWashStartAvailable(), "double start blocked")
    Config.actionMode := "mining", State.runFastWash := true
    Require(ConfigureFastWashStart(7), "configure claimed start")
    Require(Config.actionMode = "washing" && State.runFastWash
        && !Config.HasOwnProp("fastWashMode")
        && SaveCalls = 1 && Config.vehicleStorageEnabled = 1
        && Config.autoEat = 1 && State.actionControl.Value = 2, "per-run quick selection preserves storage and eating")
    Reset()
    State.running := false, State.startInProgress := true
    Config.actionMode := "gold", State.runFastWash := true, ThrowSave := true
    Require(!ConfigureFastWashStart(7), "disk failure blocks start")
    Require(Config.actionMode = "gold" && State.runFastWash, "failed save rolls only the persisted action selection back")
    Require(!ConfigureFastWashStart(8), "stale start token rejected")

    Reset()
    snapshot := State.confirmedInventory
    Require(FastWashCapacityObservationCurrent(1, snapshot), "fresh authoritative snapshot accepted")
    snapshot.confirmedAt := Clock - 1501
    Require(!FastWashCapacityObservationCurrent(1, snapshot), "expired snapshot rejected")
    snapshot.confirmedAt := Clock + 1
    Require(!FastWashCapacityObservationCurrent(1, snapshot), "future snapshot rejected")
    snapshot.confirmedAt := Clock
    Require(!FastWashCapacityObservationCurrent(2, snapshot), "old generation rejected")
    Require(!FastWashCapacityObservationCurrent(1, snapshot.Clone()), "copied/unowned snapshot rejected")
    snapshot.revision := 2
    Require(!FastWashCapacityObservationCurrent(1, snapshot), "revision mismatch rejected")

    Reset()
    Loop 100 {
        Require(!MaybeHandleFastWashCapacity(1), "ample capacity continues to work")
        Require(StorageCalls = 0 && Scheduled = 0 && IsObject(State.pendingFarmAttempt), "no periodic snapshot or cargo adapter requested")
    }
    Reset()
    StorageReason := "raw_stone_empty"
    Require(MaybeHandleFastWashCapacity(1) && StorageCalls = 1
        && State.lastRawStoneCount = 0 && State.farmState = "CHECKING_INVENTORY", "raw depletion uses original storage boundary")
    Reset()
    StorageReason := "weight_percent"
    Require(MaybeHandleFastWashCapacity(1) && StorageCalls = 1, "capacity protection still dispatches storage")
    Reset()
    State.confirmedInventory.confirmedAt := Clock - 1501
    Require(MaybeHandleFastWashCapacity(1) && StorageCalls = 0 && Scheduled = 1
        && !IsObject(State.pendingFarmAttempt), "expired baseline re-observed without cargo or click")
    Reset()
    State.pendingFarmAttempt.clicked := true
    Require(MaybeHandleFastWashCapacity(1) && StorageCalls = 0, "never move a clicked attempt into storage")
    Reset()
    State.actionCompletionPending := true
    Require(MaybeHandleFastWashCapacity(1) && StorageCalls = 0, "in-flight completion preserved")
    Reset()
    State.running := false
    Require(!MaybeHandleFastWashCapacity(1) && StorageCalls = 0, "F9 clears eligibility and never resumes old run")
    Reset()
    Config.vehicleStorageEnabled := 0
    Require(!MaybeHandleFastWashCapacity(1), "storage opt-out remains opt-out")
    Reset()
    State.runFastWash := false
    Require(!MaybeHandleFastWashCapacity(1), "ordinary mode unchanged")

    Reset()
    snapshot := {startupGeneration: 1, startupEpoch: "fixture", startupObservedAt: Clock}
    Require(FastWashStartupObservationCurrent(1, snapshot), "same startup observation reusable")
    snapshot.startupEpoch := "other"
    Require(!FastWashStartupObservationCurrent(1, snapshot), "startup epoch mismatch rejected")
    snapshot.startupEpoch := "fixture", snapshot.startupObservedAt := Clock - 1501
    Require(!FastWashStartupObservationCurrent(1, snapshot), "stale startup falls back to live read")
    FileAppend "FAST_WASH_RUNTIME_PASS`nassertions=" Cases "`nProduction quick-start and capacity gating; scripted I/O. Not a FiveM test.`n", out, "UTF-8-RAW"
    ExitApp 0
} catch as err {
    FileAppend "FAIL " err.Message "`n" err.Stack, out, "UTF-8-RAW"
    ExitApp 1
}
class FixtureControl {
    Value := 0
    Choose(value) {
        this.Value := value
    }
}
Reset() {
    global State, Config, LocalNav, Clock, SaveCalls, ThrowSave, StorageCalls, Scheduled, Events, StorageReason
    snapshot := {confirmedAt: Clock, revision: 1, weight: 100, items: "fixture"}
    State := {running: true, generation: 1, registrationActive: false, startInProgress: false
        , stopInProgress: false, activeFarmCallbacks: 0, updateOperation: "", runMode: "washing"
        , runFastWash: true
        , confirmedInventory: snapshot, inventorySnapshotRevision: 1, inventoryBaselineWeight: 100
        , pendingFarmAttempt: {generation: 1, actionMode: "washing", clicked: false, before: snapshot}
        , actionCompletionPending: false, farmState: "FARMING", nextCapacityCheckAt: Clock + 3000
        , serverEpoch: "fixture", lastRawStoneCount: -1, statusLabel: {Text: ""}
        , actionControl: FixtureControl()}
    Config := {actionMode: "washing", vehicleStorageEnabled: 1, autoEat: 1, rawStoneItemName: "raw"}
    LocalNav := {busy: false, requestActive: false}
    SaveCalls := 0, ThrowSave := false, StorageCalls := 0, Scheduled := 0, Events := [], StorageReason := ""
}
Require(condition, message) {
    global Cases
    Cases += 1
    if !condition
        throw Error(message)
}
TestError(err, *) {
    global out
    FileAppend "UNHANDLED " err.Message "`n" err.Stack, out, "UTF-8-RAW"
    ExitApp 2
}
IsCurrentRun(g) {
    global State
    return State.running && g = State.generation
}
FastWashModeEnabled() {
    global State
    return State.running && State.runFastWash && State.runMode = "washing"
}
AutomationStartAllowed(r, reg, starting, stopping, callbacks) {
    return !r && !reg && !starting && !stopping && callbacks = 0
}
IsStartOperationCurrent(token) {
    global State
    return token = 7 && State.startInProgress && !State.running
}
MonotonicMs() {
    global Clock
    return Clock
}
SaveAllSettingsAtomically() {
    global SaveCalls, ThrowSave
    SaveCalls += 1
    if ThrowSave
        throw Error("fixture disk failure")
}
UpdateActionUi() {
}
RefreshVehicleUi() {
}
WriteDiagnostic(*) {
}
SupportWriteEvent(event, *) {
    global Events
    Events.Push(event)
}
DiscardPendingFarmAttempt(*) {
    global State
    State.pendingFarmAttempt := 0
}
ScheduleNext(generation, delay) {
    global Scheduled
    Scheduled += 1
}
TransitionFarmState(stateName, reason, generation) {
    global State
    if !IsCurrentRun(generation)
        return false
    State.farmState := stateName
    return true
}
FarmModeNeedsStorage(mode, snapshot, rawName, baselineWeight, &reason, &free, &rawCount) {
    global StorageReason
    reason := StorageReason, free := 5000, rawCount := reason = "raw_stone_empty" ? 0 : 100
    return reason != ""
}
MaybeHandleVehicleCapacity(generation, observedInfo) {
    global StorageCalls, State
    Require(FastWashCapacityObservationCurrent(generation, observedInfo), "passes exact fresh observation")
    Require(!IsObject(State.pendingFarmAttempt), "unclicked baseline detached before storage")
    StorageCalls += 1
    return true
}
