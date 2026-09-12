; Stationary-only execution policy. Read-only waits keep the current generation,
; task, ledger and transfer receipts. F9 remains authoritative.
StationaryOnlyEnabled() {
    return true
}

StationaryBridgeMotionBlocked(mode) {
    return InStr("|nudge-forward|play-route|play-route-health|set-view|companion-command|", "|" mode "|") > 0
}

StationaryMotionDenied(operation) {
    WriteDiagnostic("STATIONARY_MOTION_REJECTED op=" DiagnosticToken(operation))
    return "ERROR STATIONARY_MOTION_DISABLED"
}

StationaryWaitDecision(result, allowStorageOnly := false) {
    if RegExMatch(result, "^READY WORK_STORAGE (29200|29300) [0-9]+$")
        return "READY"
    if allowStorageOnly && RegExMatch(result, "^READY STORAGE_ONLY (29200|29300) [0-9]+$")
        return "READY"
    ; Only a documented observation timeout/missing target is recoverable.
    ; Unknown failures and uncertain transfers are never swallowed by this policy.
    if result = "ERROR TASK_NOT_READY"
        || RegExMatch(result, "^READY STORAGE_ONLY (29200|29300) [0-9]+$")
        return "WAIT"
    return "FAULT"
}

StationaryWaitDelay(attempt) {
    return Min(5000, 500 * (2 ** Min(Max(0, attempt - 1), 4)))
}

StationaryPause(generation, taskId, reason, attempt := 1) {
    global State, LocalNav
    if !IsCurrentFarmTask(generation, taskId)
        return false
    State.stationaryWaiting := true
    State.statusLabel.Text := "●  自動再開待ち：" reason "（F8の押し直し不要・F9で中止）"
    LocalNav.feedback := State.statusLabel.Text
    if attempt = 1 || Mod(attempt, 6) = 0 {
        SupportWriteEvent("STATIONARY_WAIT", "attempt=" attempt " reason=" reason " input=0")
        QueueWebUiFlush(true)
    }
    waitDeadline := MonotonicMs() + StationaryWaitDelay(attempt)
    criticalWasOn := A_IsCritical
    if criticalWasOn
        Critical "Off"
    try {
        while IsCurrentFarmTask(generation, taskId) && MonotonicMs() < waitDeadline
            Sleep Min(40, Max(1, waitDeadline - MonotonicMs()))
        return IsCurrentFarmTask(generation, taskId)
    } finally {
        if IsCurrentFarmTask(generation, taskId)
            State.stationaryWaiting := false
        if criticalWasOn
            Critical criticalWasOn
    }
}

WaitStationaryTaskReady(generation, allowStorageOnly := false, purpose := "作業ボタンの再表示") {
    global State, LocalNav
    if !IsCurrentRun(generation)
        return false
    task := State.farmStateTaskId
    waited := false
    try {
        Loop {
            if !IsCurrentFarmTask(generation, task)
                return false
            mode := State.runMode = "washing" ? "wash" : State.runMode = "gold" ? "gold" : "mine"
            port := State.lastDevConPort = 29200 || State.lastDevConPort = 29300 ? State.lastDevConPort : 0
            result := RunBackgroundBridgeCancelable(generation, "stationary-task-ready", State.serverEpoch, mode, port)
            if !IsCurrentFarmTask(generation, task)
                return false
            decision := StationaryWaitDecision(result, allowStorageOnly)
            if decision = "READY" {
                criticalWasOn := A_IsCritical
                if !criticalWasOn
                    Critical "On"
                try {
                    if !IsCurrentFarmTask(generation, task)
                        return false
                    RegExMatch(result, " (29200|29300) [0-9]+$", &portMatch)
                    State.lastDevConPort := portMatch[1] + 0
                    State.targetLostSince := 0
                    State.targetRecoveryAttempts := 0
                    if waited {
                        State.farmWatchdogAt := MonotonicMs()
                        State.watchdogRecoveryCount := 0
                        SupportWriteEvent("STATIONARY_AUTO_RESUME", "purpose=" purpose " input=0 proof=task_ready")
                    }
                    State.statusLabel.Text := "●  荷台前の操作範囲を確認。移動せず続行します"
                    LocalNav.washFeedback := InStr(result, "READY STORAGE_ONLY ") = 1
                        ? "移動・視点入力0。荷台操作の利用可能性を確認しました"
                        : "移動・視点入力0。両操作の利用可能性を確認しました"
                    return true
                } finally {
                    if !criticalWasOn
                        Critical "Off"
                }
            }
            if decision = "FAULT" {
                StopAutomationWithFault("待機中の接続・入力解除を安全に確認できません：" result,
                    "routes", "STATIONARY_OBSERVATION_FAULT")
                return false
            }
            waited := true
            if !StationaryPause(generation, task, purpose, A_Index)
                return false
        }
    } finally {
        if IsCurrentRun(generation)
            State.stationaryWaiting := false
    }
}

; This verifies an actual registered inventory, not just a storage-looking label.
; It does not move, turn the camera, or transfer any item.
WaitStationaryCargo(generation, &storageId, &storageType) {
    global State, Config
    storageId := ""
    storageType := ""
    if !IsCurrentRun(generation)
        return false
    task := State.farmStateTaskId
    try {
        Loop {
            if !WaitStationaryTaskReady(generation, true, "荷台が再び操作可能になるまで監視中")
                return false
            opened := OpenStorageAndCapture(&id, &kind, generation, &fatal)
            if !IsCurrentFarmTask(generation, task)
                return false
            if opened && id == Config.vehicleStorageId && kind == Config.vehicleStorageType {
                storageId := id
                storageType := kind
                return true
            }
            if opened {
                CloseLocalStorageUi()
                StopAutomationWithFault("開いた荷台が登録先と異なります。別の車両へ転送しません", "routes", "REGISTERED_CARGO_MISMATCH")
                return false
            }
            if fatal {
                StopAutomationWithFault("荷台確認の結果を安全に取得できません：" State.lastStorageProbeResult,
                    "routes", "STATIONARY_CARGO_OBSERVATION_FAULT")
                return false
            }
            if !StationaryPause(generation, task, "荷台ボタンの再表示待ち", A_Index)
                return false
        }
    } finally {
        if IsCurrentRun(generation)
            State.stationaryWaiting := false
    }
}

VerifyStationaryRunSite(generation) {
    global Config, State, LocalNav
    if !IsCurrentRun(generation)
        return false
    if !IsValidVehicleProfile(Config) || Config.vehicleCompanionProtocol != 0 {
        StopAutomationWithFault("開始前に、同じ場所から開く自分の荷台を登録してください", "routes", "STATIONARY_REGISTRATION_REQUIRED")
        return false
    }
    ; Raw-stone exhaustion is determined later from the protected live snapshot.
    ; A known raw item can start refill-only; no wash button is required here.
    if !WaitStationaryCargo(generation, &id, &kind)
        return false
    if !CloseLocalStorageUi() {
        StopAutomationWithFault("荷台画面の閉鎖を確認できません", "routes", "STATIONARY_UI_CLOSE_FAILED")
        return false
    }
    if !IsCurrentRun(generation)
        return false
    root := ExeRouteModeRoot(State.runMode)
    temp := root "\stationary-wait.tmp.ini"
    try {
        IniWrite "2", temp, "Route", "Schema"
        IniWrite "stationary", temp, "Route", "Method"
        IniWrite Config.vehicleStorageId, temp, "Route", "StorageId"
        IniWrite Config.vehicleStorageType, temp, "Route", "StorageType"
        IniWrite State.serverEpoch, temp, "Route", "Epoch"
        IniWrite "1", temp, "Route", "Verified"
        if !IsCurrentRun(generation)
            return false
        FileMove temp, root "\route.ini", true
        LocalNav.feedback := "荷台前専用。作業の一時的な不在は自動再開待ちにします。移動入力は送りません"
        return true
    } finally {
        try FileDelete temp
    }
}

StationaryRecoveryCanWait(pending, storagePending, actionPending) {
    return !storagePending && !actionPending && !IsObject(pending)
}

StationaryRecover(generation, task) {
    global State
    if !IsCurrentFarmTask(generation, task, "RECOVERY")
        return false
    if !StationaryRecoveryCanWait(State.pendingFarmAttempt, State.storagePending, State.actionCompletionPending)
        return false
    if !WaitStationaryTaskReady(generation)
        return true
    if !IsCurrentFarmTask(generation, task, "RECOVERY")
        return true
    State.farmWatchdogAt := MonotonicMs()
    State.watchdogRecoveryCount := 0
    State.targetRecoveryAttempts := 0
    TransitionFarmState(State.resumeVerificationPending ? "RESUMING_FARM" : "FARMING", "操作復帰を確認。自動再開", generation, task)
    ScheduleNext(generation, 1)
    return true
}

ValidateStationaryOnlyPolicy() {
    if !StationaryOnlyEnabled()
        return false
    for mode in ["nudge-forward", "play-route", "play-route-health", "set-view", "companion-command"]
        if !StationaryBridgeMotionBlocked(mode)
            return false
    for mode in ["health", "deactivate", "inventory-snapshot", "stationary-task-ready", "deposit-delta", "withdraw-item", "try-washing"]
        if StationaryBridgeMotionBlocked(mode)
            return false
    for mode in [false, true] {
        if StationaryWaitDecision("READY WORK_STORAGE 29200 130", mode) != "READY"
            return false
        if StationaryWaitDecision("READY STORAGE_ONLY 29300 130", mode) != (mode ? "READY" : "WAIT")
            return false
        if StationaryWaitDecision("ERROR TASK_NOT_READY", mode) != "WAIT"
            return false
        for hard in ["ERROR CANCELLED", "ERROR SERVER_SESSION_CHANGED", "ERROR INPUT_RELEASE_UNAVAILABLE", "ERROR INVALID_ARGUMENTS", "READY WORK_STORAGE 999 1", "TIMEOUT_AFTER_SEND", "garbage"]
            if StationaryWaitDecision(hard, mode) != "FAULT"
                return false
    }
    Loop 1000 {
        if StationaryWaitDecision("ERROR TASK_NOT_READY") != "WAIT"
            || StationaryWaitDelay(A_Index) < 500 || StationaryWaitDelay(A_Index) > 5000
            return false
    }
    return StationaryRecoveryCanWait(0, false, false)
        && !StationaryRecoveryCanWait({}, false, false)
        && !StationaryRecoveryCanWait(0, true, false)
        && !StationaryRecoveryCanWait(0, false, true)
}
