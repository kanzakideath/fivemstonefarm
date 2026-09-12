#Requires AutoHotkey v2.0
#SingleInstance Off
#Warn All, Off
#Include %A_ScriptDir%/../../src/stationary-only.ahk

; Execute the actual production wait loop; only I/O adapters are scripted.
; No FiveM, screen capture, game input or item transfer is performed by this test.
global State := 0, LocalNav := 0, Config := 0, Scenario := "", Responses := [], Calls := [], Events := [], Fault := "", CargoCalls := 0, CloseCalls := 0, EpochChanges := 0
out := A_Args.Length ? A_Args[1] : A_Temp "\stationary-wait-result.txt"
OnError(TestError)
try {
    Require(ValidateStationaryOnlyPolicy(), "policy")
    Reset("auto-resume", ["ERROR TASK_NOT_READY", "ERROR TASK_NOT_READY", "READY WORK_STORAGE 29200 180"])
    ledger := State.farmOutputLedger
    checkpoint := State.storageDepositCheckpoint
    started := A_TickCount
    Require(WaitStationaryTaskReady(1), "missing observations should resume")
    Require(A_TickCount - started >= 1400, "real backoff executed")
    Require(Calls.Length = 3 && !State.stationaryWaiting && Fault = "", "three read-only probes")
    Require(State.farmOutputLedger == ledger && State.storageDepositCheckpoint == checkpoint, "ledger and receipt identities preserved")
    Require(HasEvent("STATIONARY_WAIT") && HasEvent("STATIONARY_AUTO_RESUME"), "wait and resume evidence")

    Reset("refill-ready", ["READY STORAGE_ONLY 29300 160"])
    Require(WaitStationaryTaskReady(1, true), "raw-empty may proceed to cargo")
    Require(State.lastDevConPort = 29300 && Calls.Length = 1, "known port retained")

    Reset("manual-stop", ["ERROR TASK_NOT_READY"])
    SetTimer CancelTestRun, -100
    started := A_TickCount
    Require(!WaitStationaryTaskReady(1), "cancel must never resume")
    Require(A_TickCount - started < 1000 && Calls.Length = 1 && !HasEvent("STATIONARY_AUTO_RESUME"), "stop promptly, no next probe")

    Reset("stale-generation", ["READY WORK_STORAGE 29200 160"])
    Require(!WaitStationaryTaskReady(1), "stale result discarded")
    Require(State.lastDevConPort = 0 && State.statusLabel.Text = "new owner", "old callback cannot alter new run")

    Reset("session-change", ["ERROR SERVER_SESSION_CHANGED"])
    Require(!WaitStationaryTaskReady(1) && Calls.Length = 1 && Fault = "STATIONARY_OBSERVATION_FAULT", "session change never retried")

    Reset("cargo-disappeared", ["READY WORK_STORAGE 29200 180"])
    Require(WaitStationaryCargo(1, &cargoId, &cargoType), "vanished cargo rechecked")
    Require(CargoCalls = 2 && cargoId = "fixture-truck" && cargoType = "trunk", "actual cargo identity checked")

    Reset("wrong-cargo", ["READY WORK_STORAGE 29200 180"])
    Require(!WaitStationaryCargo(1, &cargoId, &cargoType), "wrong cargo rejected")
    Require(Fault = "REGISTERED_CARGO_MISMATCH" && CargoCalls = 1 && CloseCalls = 1, "no retry or transfer to wrong cargo")

    Reset("unknown-cargo", ["READY WORK_STORAGE 29200 180"])
    Require(!WaitStationaryCargo(1, &cargoId, &cargoType), "unknown cargo result rejected")
    Require(Fault = "STATIONARY_CARGO_OBSERVATION_FAULT" && CargoCalls = 1, "uncertainty is not target absence")

    Reset("safe-recovery", ["READY WORK_STORAGE 29200 180"])
    State.farmState := "RECOVERY"
    Require(StationaryRecover(1, 7) && State.farmState = "FARMING", "recovery returns to work")

    Reset("uncertain-transfer", ["READY WORK_STORAGE 29200 180"])
    State.farmState := "RECOVERY"
    State.storagePending := true
    Require(!StationaryRecover(1, 7) && Calls.Length = 0, "pending transfer must use original reconciliation")
    State.storagePending := false
    State.pendingFarmAttempt := {}
    Require(!StationaryRecover(1, 7) && Calls.Length = 0, "pending reward never discarded by resume")

    FileAppend "STATIONARY_WAIT_PASS`nActual production AHK wait/cargo/recovery functions; scripted read-only adapters.`n11 cases, no game input or item-transfer adapter. F9-equivalent timer cancellation, generations, ledger preservation, errors, and auto-resume checked.`n", out, "UTF-8-RAW"
    ExitApp 0
} catch as e {
    FileAppend "FAIL " e.Message "`n" e.Stack, out, "UTF-8-RAW"
    ExitApp 1
}
TestError(e, *) {
    global out
    try FileAppend "UNHANDLED " e.Message " line=" e.Line "`n" e.Stack, out, "UTF-8-RAW"
    ExitApp 2
}
Require(condition, message) {
    if !condition
        throw Error(message)
}
Reset(name, scriptedResponses) {
    global State, LocalNav, Config, Scenario, Responses, Calls, Events, Fault, CargoCalls, CloseCalls
    Scenario := name, Responses := scriptedResponses, Calls := [], Events := [], Fault := "", CargoCalls := 0, CloseCalls := 0
    State := {running: true, generation: 1, farmStateTaskId: 7, farmState: "FARMING", runMode: "washing", runFastWash: false, lastDevConPort: 0, serverEpoch: "fixture-epoch", stationaryWaiting: false, statusLabel: {Text: "initial"}, targetLostSince: 10, targetRecoveryAttempts: 2, farmWatchdogAt: 1, watchdogRecoveryCount: 2, farmOutputLedger: {fixture: 7}, storageDepositCheckpoint: {moved: 7, receiptVerified: true}, storagePending: false, actionCompletionPending: false, pendingFarmAttempt: 0, resumeVerificationPending: false, lastStorageProbeResult: ""}
    LocalNav := {feedback: "", washFeedback: ""}
    Config := {vehicleStorageId: "fixture-truck", vehicleStorageType: "trunk", vehicleCompanionProtocol: 0, fastWashMode: false}
}
IsCurrentRun(generation) {
    global State
    return State.running && State.generation = generation
}
IsCurrentFarmTask(generation, task, expected := "") {
    global State
    return IsCurrentRun(generation) && State.farmStateTaskId = task && (expected = "" || State.farmState = expected)
}
MonotonicMs() {
    return A_TickCount
}
DiagnosticToken(value) {
    return value
}
WriteDiagnostic(message) {

}
QueueWebUiFlush(*) {

}
SupportWriteEvent(name, message) {
    global Events
    Events.Push(name)
}
HasEvent(name) {
    global Events
    for e in Events
        if e = name
            return true
    return false
}
RunBackgroundBridgeCancelable(generation, mode, args*) {
    global State, Responses, Calls, Scenario
    Require(mode = "stationary-task-ready", "unexpected mutation/bridge command " mode)
    Require(args.Length = 3 && args[2] = "wash", "real CLI protocol shape")
    Calls.Push(mode)
    if Scenario = "stale-generation" {
        State.generation := 2
        State.statusLabel.Text := "new owner"
    }
    return Responses[Min(Calls.Length, Responses.Length)]
}
CancelTestRun(*) {
    global State
    State.running := false
}
StopAutomationWithFault(message, page := "", code := "") {
    global Fault, State
    Fault := code
    State.running := false
}
OpenStorageAndCapture(&id, &kind, generation, &fatal) {
    global Scenario, CargoCalls, State
    CargoCalls += 1
    id := "fixture-truck", kind := "trunk", fatal := false
    if Scenario = "cargo-disappeared" && CargoCalls = 1
        return false
    if Scenario = "wrong-cargo"
        id := "different-truck"
    if Scenario = "unknown-cargo" {
        fatal := true
        State.lastStorageProbeResult := "UNKNOWN"
        return false
    }
    return true
}
CloseLocalStorageUi() {
    global CloseCalls
    CloseCalls += 1
    return true
}
TransitionFarmState(nextState, message, generation, task) {
    global State
    if !IsCurrentFarmTask(generation, task)
        return false
    State.farmState := nextState
    return true
}
ScheduleNext(*) {

}
IsValidVehicleProfile(config) {
    return config.vehicleStorageId != "" && config.vehicleStorageType != ""
}
ExeRouteModeRoot(*) {
    return A_Temp "\stationary-harness"
}
