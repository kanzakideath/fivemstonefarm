; A usable interaction zone is a separate proof from exact image convergence.
; Never turn a visual failure into a storage receipt or a verified Farm reward.
NearbyWashVisualUncertain(result) {
    return result = "ERROR FORWARD_NO_OBSERVED_EFFECT"
        || result = "ERROR POSITION_CORRECTION_BUDGET"
        || result = "ERROR FINAL_POSITION_NOT_VERIFIED"
        || result = "ERROR ANCHOR_CHANGED_BEFORE_WASH"
}

NearbyWashObjective(rawKnown, rawCount, storageEnabled) {
    return !rawKnown || rawCount < 0 ? ""
        : rawCount = 0 ? (storageEnabled ? "refill" : "") : "wash"
}

; Shared production/test decision. The probe performs no clicks or transfers.
EvaluateNearbyWashRecovery(visualResult, objective, guard, probe) {
    if !NearbyWashVisualUncertain(visualResult)
        || (objective != "wash" && objective != "refill")
        return "NOT_ELIGIBLE"
    if !guard.Call()
        return "CANCELLED"
    controls := probe.Call()
    if !guard.Call()
        return "CANCELLED"
    if controls = "PRESENT WASH_STORAGE"
        return objective = "refill" ? "NEARBY_REFILL_READY" : "NEARBY_WASH_READY"
    if objective = "refill" && controls = "PRESENT STORAGE_ONLY"
        return "NEARBY_REFILL_READY"
    return "CONTROLS_UNCONFIRMED"
}

NearbyWashRunGuard(generation, task, phase, epoch, storageId, storageType) {
    global State, Config, LocalNav
    return IsCurrentFarmTask(generation, task, phase)
        && State.runMode = "washing" && State.serverEpoch = epoch
        && IsTargetForeground(generation)
        && !State.actionCompletionPending && !IsObject(State.pendingFarmAttempt)
        && !State.registrationActive && !LocalNav.pid
        && IsValidVehicleProfile(Config) && Config.vehicleCompanionProtocol = 0
        && Config.vehicleStorageId == storageId && Config.vehicleStorageType == storageType
        && CurrentPhysicalMovementMask() = 0 && CurrentUnsupportedRegistrationKey() = ""
        && !GetKeyState("LButton", "P") && !GetKeyState("RButton", "P")
}

; All three samples are synchronous pairs in one epoch-bound NUI session.
; Opening the interaction list is not movement and does not select either item.
ProbeNearbyWashControls(generation, guard) {
    global State
    result := "ERROR NEARBY_PROBE_NOT_RUN"
    released := false
    if !guard.Call()
        return "ERROR CANCELLED"
    try {
        if !ReleaseBackgroundTarget(true) || !guard.Call()
            return "ERROR INPUT_RELEASE"
        activation := RunBackgroundBridgeCancelable(generation, "activate")
        if !guard.Call()
            return "ERROR CANCELLED"
        if !RegExMatch(activation, "^ACTIVATED (29200|29300)$", &port)
            return "ERROR TARGET_ACTIVATION"
        State.backgroundTargetActive := true
        State.backgroundDevConPort := port[1] + 0
        State.lastDevConPort := port[1] + 0
        Sleep 350
        if !guard.Call()
            return "ERROR CANCELLED"
        result := RunBackgroundBridgeCancelable(generation, "probe-wash-storage", State.serverEpoch)
    } finally {
        ; F9 owns cleanup for a stopped generation; do not release a newer run.
        if IsCurrentRun(generation)
            released := ReleaseBackgroundTarget(true)
    }
    if !released || !guard.Call()
        return "ERROR NEARBY_CONTEXT_OR_RELEASE"
    return result
}

TryAcceptNearbyWashRecovery(generation, visualResult) {
    global State, Config, LocalNav
    if !IsCurrentRun(generation) || !NearbyWashVisualUncertain(visualResult)
        return false
    phase := State.farmState
    if phase != "WASH_CORRECTING" && phase != "RESUMING_FARM"
        return false
    if phase = "WASH_CORRECTING" && (State.washRecoveryGeneration != generation
        || State.washRecoveryAttemptId < 1 || State.washCorrectionInFlight)
        return false
    objective := NearbyWashObjective(Config.rawStoneItemName != "",
        State.lastRawStoneCount, Config.vehicleStorageEnabled)
    if !objective || ExeStorageMethod("washing") != "stationary"
        || !ExeRouteBindingValid("washing", State.serverEpoch)
        return false
    task := State.farmStateTaskId
    guard := NearbyWashRunGuard.Bind(generation, task, phase, State.serverEpoch,
        Config.vehicleStorageId, Config.vehicleStorageType)
    decision := EvaluateNearbyWashRecovery(visualResult, objective, guard,
        ProbeNearbyWashControls.Bind(generation, guard))
    if !IsCurrentRun(generation)
        return false
    WriteDiagnostic("WASH_NEARBY_DECISION visual=" visualResult " objective=" objective
        " decision=" decision " image_verified=0 extra_w_input=0")
    if decision != "NEARBY_WASH_READY" && decision != "NEARBY_REFILL_READY"
        return false
    Critical "On"
    try {
        if !guard.Call()
            return false
        LocalNav.washRecoveryOutcome := decision
        LocalNav.washFeedback := decision = "NEARBY_WASH_READY"
            ? "荷台前：洗浄・ストレージの両ボタンを連続確認。画像の完全一致は未確認ですが、追加前進せず洗浄を続けます"
            : "荷台前：手持ち石0・ストレージ操作可を確認。洗浄ボタンを待たず、登録荷台の収納・補充へ進みます"
        LocalNav.feedback := LocalNav.washFeedback
        ; This decision is not a receipt. Preserve the helper's original report.
        try {
            payload := '{"schema":1,"generation":' generation ',"task":' task
                . ',"decision":' JsonQuote(decision) ',"visualResult":' JsonQuote(visualResult)
                . ',"imageVerified":false,"extraForwardInput":false,"rawStoneCount":'
                . State.lastRawStoneCount ',"updatedAt":' JsonQuote(A_NowUTC) '}'
            path := LocalNav.root "\wash-nearby-last.json"
            file := FileOpen(path ".tmp", "w", "UTF-8-RAW")
            try file.Write(payload)
            finally file.Close()
            FileMove path ".tmp", path, true
        }
        QueueWebUiFlush(true)
        return true
    } finally Critical "Off"
}

; A missing route need not block a registered washing spot beside the cargo.
; Never replace a user's recorded walking route; never enable storage here.
TryConfirmNearbyWashingForRun(generation) {
    global State, Config, LocalNav
    if !IsCurrentRun(generation) || State.runMode != "washing"
        || !Config.vehicleStorageEnabled || !IsValidVehicleProfile(Config)
        || Config.vehicleCompanionProtocol != 0 || !IsTargetForeground(generation)
        return false
    root := ExeRouteModeRoot("washing")
    if ExeStorageMethod("washing") != "stationary"
        && (FileExist(root "\outbound.json") || FileExist(root "\return.json"))
        return false
    task := State.farmStateTaskId
    epoch := State.serverEpoch
    id := Config.vehicleStorageId
    type := Config.vehicleStorageType
    guard := NearbyWashRunGuard.Bind(generation, task, State.farmState, epoch, id, type)
    if !guard.Call()
        return false
    State.statusLabel.Text := "●  荷台前の石洗い：歩かずに作業と登録荷台を確認しています"
    ; Existing identity capture opens only the currently visible cargo and checks
    ; the exact registered id/type. This shared workflow has no transfer callback.
    result := EvaluateStationarySpot(guard, ProbeExeRouteWork.Bind(generation, "washing"),
        StationaryCargoProbe.Bind(generation), CloseNearbyWashInventory.Bind(generation))
    if result != "STATIONARY_VERIFIED" || !guard.Call()
        return false
    if !ValidateServerEpochCheckpoint(generation, "auto_nearby_wash_setup") || !guard.Call()
        return false
    temp := root "\auto-nearby-" generation ".ini"
    try {
        IniWrite "2", temp, "Route", "Schema"
        IniWrite "stationary", temp, "Route", "Method"
        IniWrite id, temp, "Route", "StorageId"
        IniWrite type, temp, "Route", "StorageType"
        IniWrite epoch, temp, "Route", "Epoch"
        IniWrite "1", temp, "Route", "Verified"
        Critical "On"
        try {
            if !guard.Call()
                return false
            FileMove temp, root "\route.ini", true
        } finally Critical "Off"
        LocalNav.feedback := "荷台前の作業と登録荷台IDを実確認しました。徒歩ルートを作らず近接収納で開始します"
        WriteDiagnostic("AUTO_NEARBY_WASH_VERIFIED movement=0 transfer=0")
        return true
    } catch as err {
        if IsCurrentRun(generation)
            WriteDiagnostic("AUTO_NEARBY_WASH_SAVE_FAILED " err.Message)
        return false
    } finally {
        try FileDelete temp
    }
}

CloseNearbyWashInventory(generation) {
    return IsCurrentRun(generation)
        && RunBackgroundBridgeCancelable(generation, "close-inventory") = "CLOSED"
        && IsCurrentRun(generation)
}

NearbyWashTestProbe(trace, value, *) {
    trace.Push("probe")
    return value
}
NearbyWashTestGuard(trace, failOn, *) {
    trace.Push("guard")
    return trace.Length != failOn
}
ValidateNearbyWashRecovery() {
    if NearbyWashObjective(true, 0, true) != "refill"
        || NearbyWashObjective(true, 0, false) != ""
        || NearbyWashObjective(false, 3, true) != ""
        || NearbyWashObjective(true, -1, true) != ""
        || NearbyWashObjective(true, 3, true) != "wash"
        return false
    for result in ["ERROR FORWARD_NO_OBSERVED_EFFECT", "ERROR POSITION_CORRECTION_BUDGET",
        "ERROR FINAL_POSITION_NOT_VERIFIED", "ERROR ANCHOR_CHANGED_BEFORE_WASH"] {
        for objective in ["wash", "refill"] {
            for controls in ["PRESENT WASH_STORAGE", "PRESENT STORAGE_ONLY", "MISSING WASH_STORAGE",
                "AMBIGUOUS WASH_STORAGE", "ERROR SERVER_SESSION_CHANGED", "PRESENT WASH"] {
                trace := []
                expected := controls = "PRESENT WASH_STORAGE"
                    || (objective = "refill" && controls = "PRESENT STORAGE_ONLY")
                decision := EvaluateNearbyWashRecovery(result, objective,
                    NearbyWashTestGuard.Bind(trace, 0), NearbyWashTestProbe.Bind(trace, controls))
                if (InStr(decision, "NEARBY_") = 1) != expected || trace.Length != 3
                    return false
            }
        }
    }
    for result in ["ERROR CANCELLED", "ERROR MANUAL_OVERRIDE", "ERROR GAME_NOT_FOREGROUND",
        "ERROR KEY_RELEASE_FAILED", "ERROR SERVER_SESSION_CHANGED", "ERROR WRONG_DIRECTION_OR_CAMERA_MOVED",
        "ERROR VISION_LOST_AFTER_INPUT", "ERROR NO_NAVIGATION_RESULT", "WASH_STABLE 0 0 0 100"] {
        trace := []
        decision := EvaluateNearbyWashRecovery(result, "wash", NearbyWashTestGuard.Bind(trace, 0),
            NearbyWashTestProbe.Bind(trace, "PRESENT WASH_STORAGE"))
        if decision != "NOT_ELIGIBLE" || trace.Length != 0
            return false
    }
    for failOn in [1, 3] {
        trace := []
        decision := EvaluateNearbyWashRecovery("ERROR FORWARD_NO_OBSERVED_EFFECT", "wash",
            NearbyWashTestGuard.Bind(trace, failOn), NearbyWashTestProbe.Bind(trace, "PRESENT WASH_STORAGE"))
        if decision != "CANCELLED" || trace.Length != failOn
            return false
    }
    return true
}
