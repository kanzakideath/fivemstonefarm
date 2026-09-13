; Registered-cargo endless washing is a dedicated, bounded closed loop.  It is
; the only stationary policy allowed to send movement/camera input, and only
; through recover-wash-zone: every pulse is followed by a structural ox_target
; observation.  No click or inventory transfer is performed by this controller.

EndlessWashRegistrationReady() {
    global Config
    return Config.vehicleStorageEnabled
        && Config.vehicleCompanionProtocol = 0
        && IsValidVehicleProfile(Config)
}

EndlessWashStartAvailable() {
    global State, LocalNav
    return EndlessWashRegistrationReady()
        && AutomationStartAllowed(State.running, State.registrationActive,
            State.startInProgress, State.stopInProgress,
            State.activeFarmCallbacks)
        && !State.updateOperation && !LocalNav.busy && !LocalNav.requestActive
}

EndlessWashUnavailableReason() {
    global State, Config, LocalNav
    if State.running
        return "停止してから開始してください"
    if State.registrationActive
        return "荷台登録が終わるまでお待ちください"
    if State.startInProgress || State.stopInProgress
        return "開始・停止処理が終わるまでお待ちください"
    if State.updateOperation || LocalNav.busy || LocalNav.requestActive
        return "現在の処理が終わるまでお待ちください"
    if !IsValidVehicleProfile(Config) || Config.vehicleCompanionProtocol != 0
        return "先に車両画面で、この場所から開ける自分の荷台を登録してください"
    if !Config.vehicleStorageEnabled
        return "車両画面で「容量不足時に自動収納」をオンにしてください"
    return "「石を洗う」と登録荷台が両方出る位置で開始してください"
}

EndlessWashModeEnabled() {
    global State
    return StationaryOnlyEnabled() && State.running && State.runEndlessWash
        && State.runMode = "washing"
}

EndlessWashBridgeMotionAuthorized() {
    global State, Config, LocalNav
    return EndlessWashModeEnabled() && EndlessWashRegistrationReady()
        && Config.backgroundMode && State.serverEpoch != ""
        && State.targetHwnd && WinExist("ahk_id " State.targetHwnd)
        && !State.registrationActive && !State.updateOperation
        && !LocalNav.busy && !LocalNav.requestActive
}

ConfigureEndlessWashStart(startToken) {
    global State, Config, LocalNav
    if !IsStartOperationCurrent(startToken) || State.updateOperation
        || LocalNav.busy || LocalNav.requestActive
        return false
    if !EndlessWashRegistrationReady() {
        State.statusLabel.Text := "●  " EndlessWashUnavailableReason()
        ShowPage("vehicle")
        return false
    }
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
            State.statusLabel.Text := "荷台前エンドレス石洗いの設定を保存できませんでした"
            WriteDiagnostic("ENDLESS_WASH_START_SAVE_FAILED " err.Message)
            return false
        }
        State.actionControl.Choose(2)
        UpdateActionUi()
        RefreshVehicleUi()
        SupportWriteEvent("ENDLESS_WASH_QUICK_START",
            "mode=washing controller=closed_loop cargo=registered background=1")
        return IsStartOperationCurrent(startToken)
    } finally {
        if !wasCritical
            Critical "Off"
    }
}

EndlessWashPostMotionSettleMs() {
    ; The server animation applies its final backward root-motion for about one
    ; second after reward confirmation.  Starting earlier reproduces the drift;
    ; waiting much longer needlessly slows every batch.
    return 1150
}

EndlessWashRecoveryPhaseValid(phase) {
    return phase = "verify" || phase = "storage"
        || phase = "post-wash" || phase = "post-wash-storage"
}

EndlessWashReceiptObservationsValid(observations) {
    if observations = ""
        return true
    statePattern := "(?:BOTH|STORAGE_ONLY|WASH_ONLY|NEITHER|AMBIGUOUS|UNKNOWN)"
    pulsePattern := "(?:NONE|W|S|LOOK_DOWN)"
    tokenPattern := "[A-Z_]{1,40}"
    numberPattern := "[0-9]{1,9}"
    entry := '\{"elapsedMs":' numberPattern
        . ',"afterPulse":"' pulsePattern '","pulseMs":' numberPattern
        . ',"beforeState":"' statePattern '","state":"' statePattern
        . '","washCount":' numberPattern ',"storageCount":' numberPattern
        . ',"progressBefore":"' tokenPattern '","progressAfter":"' tokenPattern
        . '","inventoryBefore":"' tokenPattern '","inventoryAfter":"' tokenPattern
        . '","epoch":(?:true|false)\}'
    return RegExMatch(observations, '^(?:' entry ')(?:,' entry ')*$')
}

ParseEndlessWashRecoveryReceipt(result, expectedPhase, maxPulses,
    deadlineMs, &receipt) {
    receipt := 0
    result := String(result)
    if StrLen(result) < 40 || StrLen(result) > 24000
        || InStr(result, "`r") || InStr(result, "`n")
        || !EndlessWashRecoveryPhaseValid(expectedPhase)
        return false
    pattern := '^(WASH_RECOVERY |ERROR WASH_RECOVERY )'
        . '\{"version":1,"status":"(RECOVERED|FAILED)",'
        . '"reason":"([A-Z_]{2,48})","state":"'
        . '(BOTH|STORAGE_ONLY|WASH_ONLY|NEITHER|AMBIGUOUS|UNKNOWN)",'
        . '"phase":"(verify|storage|post-wash|post-wash-storage)",'
        . '"compulsoryCorrectionApplied":(true|false),'
        . '"port":(0|29200|29300),"elapsedMs":([0-9]{1,9}),'
        . '"pulses":([0-9]{1,3}),"movementPulses":([0-9]{1,3}),'
        . '"lookPulses":([0-9]{1,3}),"stableSamples":([0-9]{1,3}),'
        . '"observations":\[(.*)\]\}$'
    if !RegExMatch(result, pattern, &parts)
        return false
    if parts[5] != expectedPhase || !EndlessWashReceiptObservationsValid(parts[13])
        return false
    receipt := {
        okPrefix: parts[1] = "WASH_RECOVERY ",
        status: parts[2], reason: parts[3], state: parts[4],
        phase: parts[5], compulsory: parts[6] = "true",
        port: parts[7] + 0, elapsedMs: parts[8] + 0,
        pulses: parts[9] + 0, movementPulses: parts[10] + 0,
        lookPulses: parts[11] + 0, stableSamples: parts[12] + 0,
        observations: parts[13], raw: result
    }
    if receipt.pulses > maxPulses
        || receipt.movementPulses > receipt.pulses
        || receipt.lookPulses > 1
        || receipt.elapsedMs > deadlineMs + 1500
        return false
    if receipt.status = "FAILED"
        return !receipt.okPrefix && receipt.reason != "STABLE_BOTH"
            && receipt.reason != "STABLE_STORAGE_ONLY"
    if receipt.status != "RECOVERED" || !receipt.okPrefix
        return false
    if receipt.port != 29200 && receipt.port != 29300
        return false
    if receipt.stableSamples < 3
        return false
    postPhase := expectedPhase = "post-wash"
        || expectedPhase = "post-wash-storage"
    if postPhase && (!receipt.compulsory || receipt.movementPulses < 1)
        return false
    if !postPhase && receipt.compulsory
        return false
    if expectedPhase = "verify" || expectedPhase = "post-wash"
        return receipt.state = "BOTH" && receipt.reason = "STABLE_BOTH"
    return (receipt.state = "BOTH" && receipt.reason = "STABLE_BOTH")
        || (receipt.state = "STORAGE_ONLY"
            && receipt.reason = "STABLE_STORAGE_ONLY")
}

EndlessWashRecoveryHardFailure(result, receipt := 0) {
    reason := IsObject(receipt) ? receipt.reason : DiagnosticToken(result)
    return InStr(reason, "SERVER_SESSION_CHANGED")
        || InStr(reason, "INPUT_RELEASE_UNAVAILABLE")
        || InStr(reason, "TARGET_RELEASE_UNAVAILABLE")
        || InStr(reason, "MANUAL_INPUT")
        || InStr(reason, "AMBIGUOUS")
        || InStr(reason, "CANCELLED")
        || InStr(reason, "TARGET_CLOSED")
        || (!IsObject(receipt) && !InStr(reason, "BRIDGE_TIMEOUT"))
}

EndlessWashRecoveryContextCurrent(generation, taskId := 0,
    expectedState := "") {
    global State
    if expectedState != ""
        return IsCurrentFarmTask(generation, taskId, expectedState)
    if taskId
        return IsCurrentFarmTask(generation, taskId)
    return IsCurrentRun(generation)
}

RunEndlessWashZoneRecovery(generation, taskId, expectedState, phase,
    maxPulses, deadlineMs, &receipt) {
    global State, LocalNav
    receipt := 0
    if !EndlessWashModeEnabled()
        || !EndlessWashRecoveryContextCurrent(generation, taskId,
            expectedState)
        || !EndlessWashRecoveryPhaseValid(phase)
        || maxPulses < 1 || maxPulses > 12
        || deadlineMs < 500 || deadlineMs > 8000
        return false
    port := State.lastDevConPort = 29200 || State.lastDevConPort = 29300
        ? State.lastDevConPort : 0
    State.statusLabel.Text := phase = "post-wash"
        || phase = "post-wash-storage"
        ? "●  洗浄後退の停止を確認。荷台前の位置を閉ループ補正中"
        : "●  「石を洗う」と登録荷台の両方へ自動復旧中"
    UpdateRuntimeStatusOverlay()
    result := RunBackgroundBridgeCancelable(generation,
        "recover-wash-zone", State.serverEpoch, port, maxPulses,
        deadlineMs, phase)
    if !EndlessWashRecoveryContextCurrent(generation, taskId,
        expectedState)
        return false
    parsed := ParseEndlessWashRecoveryReceipt(result, phase, maxPulses,
        deadlineMs, &receipt)
    State.endlessWashLastReceipt := result
    WriteDiagnostic("ENDLESS_WASH_RECOVERY phase=" phase
        " budget=" maxPulses "/" deadlineMs " result="
        DiagnosticToken(result))
    if !parsed || receipt.status != "RECOVERED"
        return false
    State.lastDevConPort := receipt.port
    State.targetLostSince := 0
    State.targetRecoveryAttempts := 0
    State.workViewStatus := "TARGET_OK"
    State.lastWorkViewVerifiedAt := MonotonicMs()
    if receipt.movementPulses > 0 {
        State.nudges += 1
        State.mealLabel.Text := "荷台前の位置補正`n" State.nudges
    }
    LocalNav.washRecoveryOutcome := "ENDLESS_WASH_READY"
    LocalNav.washFeedback := (
        "荷台前を再確認：" receipt.state
        " / 移動" receipt.movementPulses "回 / 視点"
        receipt.lookPulses "回 / " receipt.elapsedMs "ms")
    State.statusLabel.Text := "●  荷台前の洗浄位置を実測確認。作業を再開します"
    QueueWebUiFlush(true)
    return true
}

HandleEndlessWashCompletionRecoveryFailure(generation, taskId,
    attemptId, result, receipt := 0) {
    global State, LocalNav
    if !IsCurrentFarmTask(generation, taskId, "WASH_CORRECTING")
        return false
    State.endlessWashRecoveryFailures += 1
    reason := IsObject(receipt) ? receipt.reason : DiagnosticToken(result)
    LocalNav.washFeedback := "荷台前の洗浄位置を再取得します（" reason "）"
    if EndlessWashRecoveryHardFailure(result, receipt) {
        StopAutomationWithFault(
            "荷台前の位置を安全に判定できないため停止しました（" reason "）",
            "overview", "ENDLESS_WASH_RECOVERY_UNSAFE")
        return false
    }
    ResetWashCompletionRecoveryState()
    EnterFarmRecovery(generation, "FARMING",
        "endless_wash_post_completion_" reason)
    return false
}

RecoverEndlessWashFarmTask(generation, taskId) {
    global State, Config
    if !IsCurrentFarmTask(generation, taskId, "RECOVERY")
        return true
    if !StationaryRecoveryCanWait(State.pendingFarmAttempt,
        State.storagePending, State.actionCompletionPending)
        return false
    ReleaseAllInputs()
    if !ReleaseBackgroundTarget(true) {
        HandleFarmRecoveryPreflightFailure(generation, taskId,
            "endless_release_target", "INPUT_RELEASE")
        return true
    }
    closeResult := RunBackgroundBridgeCancelable(generation,
        "close-inventory")
    if !IsCurrentFarmTask(generation, taskId, "RECOVERY")
        return true
    if closeResult != "CLOSED" {
        HandleFarmRecoveryPreflightFailure(generation, taskId,
            "endless_close_inventory", closeResult)
        return true
    }
    if !ValidateServerEpochCheckpoint(generation, "endless_wash_recovery") {
        StopAutomationWithFault(
            "サーバー再起動または再接続を検知したため停止しました",
            "overview", "SERVER_SESSION_CHANGED")
        return true
    }
    phase := Config.rawStoneItemName && State.lastRawStoneCount = 0
        ? "storage" : "verify"
    budget := State.recoveryRestartCount > 0 ? 2 : 6
    recovered := RunEndlessWashZoneRecovery(generation, taskId,
        "RECOVERY", phase, budget, 8000, &receipt)
    if !IsCurrentFarmTask(generation, taskId, "RECOVERY")
        return true
    if recovered {
        State.endlessWashRecoveryFailures := 0
        State.recoveryPreflightFailures := 0
        State.farmWatchdogAt := MonotonicMs()
        if Config.rawStoneItemName && State.lastRawStoneCount = 0 {
            State.nextCapacityCheckAt := 0
            if TransitionFarmState("CHECKING_INVENTORY",
                "未洗浄石0。登録荷台へ収納・補充",
                generation, taskId)
                MaybeHandleVehicleCapacity(generation)
            return true
        }
        returnState := State.recoveryReturnState = "RESUMING_FARM"
            ? "RESUMING_FARM" : "FARMING"
        TransitionFarmState(returnState,
            "荷台前の洗浄範囲を実測復旧", generation, taskId)
        ScheduleNext(generation, 1)
        return true
    }
    State.endlessWashRecoveryFailures += 1
    if EndlessWashRecoveryHardFailure(State.endlessWashLastReceipt,
        receipt) {
        reason := IsObject(receipt) ? receipt.reason : "INVALID_RECEIPT"
        StopAutomationWithFault(
            "荷台前の復旧結果が安全条件を満たさないため停止しました（"
                reason "）", "overview", "ENDLESS_WASH_RECOVERY_UNSAFE")
        return true
    }
    if RestartFarmAfterRecoveryExhausted(generation,
        "endless_wash_zone_not_recovered")
        return true
    if IsCurrentFarmTask(generation, taskId, "RECOVERY")
        StopAutomationWithFault(
            "荷台前の位置を上限内で復旧し、同モードを一度再始動しても両操作を確認できないため停止しました",
            "overview", "ENDLESS_WASH_RECOVERY_EXHAUSTED")
    return true
}

ValidateEndlessWashPolicy() {
    good := 'WASH_RECOVERY {"version":1,"status":"RECOVERED",'
        . '"reason":"STABLE_BOTH","state":"BOTH","phase":"post-wash",'
        . '"compulsoryCorrectionApplied":true,"port":29200,"elapsedMs":321,'
        . '"pulses":2,"movementPulses":1,"lookPulses":1,"stableSamples":3,'
        . '"observations":[{"elapsedMs":12,"afterPulse":"W","pulseMs":50,'
        . '"beforeState":"STORAGE_ONLY","state":"BOTH","washCount":2,'
        . '"storageCount":1,"progressBefore":"IDLE","progressAfter":"IDLE",'
        . '"inventoryBefore":"CLOSED","inventoryAfter":"CLOSED","epoch":true}]}'
    if !ParseEndlessWashRecoveryReceipt(good, "post-wash", 6, 8000,
        &receipt) || receipt.state != "BOTH" || !receipt.compulsory
        return false
    badAmbiguous := StrReplace(good, '"state":"BOTH"',
        '"state":"AMBIGUOUS"')
    if ParseEndlessWashRecoveryReceipt(badAmbiguous, "post-wash", 6,
        8000, &badReceipt)
        return false
    if ParseEndlessWashRecoveryReceipt(good "`n", "post-wash", 6,
        8000, &badReceipt)
        return false
    return EndlessWashPostMotionSettleMs() >= 1100
        && EndlessWashPostMotionSettleMs() <= 1300
        && EndlessWashRecoveryPhaseValid("post-wash-storage")
        && !EndlessWashRecoveryPhaseValid("walk-forever")
}
