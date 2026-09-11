; Verified walking uses the administrator-installed ai_miner_companion resource.
; An opaque trunk ID contains no position. Never substitute random key presses
; or a successful DevCon write for a game-confirmed arrival.

VerifiedNavigationReceiptMatches(result, command, expectedId) {
    expectedCode := command = "go-vehicle" ? "ARRIVED_VEHICLE"
        : command = "return-work" ? "ARRIVED_WORK" : ""
    return expectedCode != "" && IsValidCompanionRegistrationId(expectedId)
        && CompanionCommandSucceeded(result, command, &actualId, &code, &netId)
        && actualId = expectedId && code = expectedCode && netId > 0
}

class VerifiedNavigationAdapter {
    __New(generation) {
        this.Generation := generation
    }
    Current() => IsBridgeOperationContextValid(this.Generation)
    Checkpoint(label) {
        global State
        return this.Generation
            ? ValidateAutomationEpochCheckpoint(this.Generation, label)
            : ValidateRegistrationEpochs(State.serverEpoch, State.companionEpoch)
    }
    Release() {
        ReleaseAllInputs()
        return ReleaseBackgroundTarget(true)
    }
    CloseInventory() {
        return RunBackgroundBridgeCancelable(this.Generation,
            "close-inventory") = "CLOSED"
    }
    Move(command, id) {
        return RunCompanionCommandCancelable(this.Generation, command,
            command = "go-vehicle" ? id : "")
    }
}

ExecuteVerifiedNavigation(adapter, command, expectedId, &failure) {
    failure := "ERROR COMPANION_NAVIGATION_UNVERIFIED"
    if !IsValidCompanionRegistrationId(expectedId)
        || (command != "go-vehicle" && command != "return-work")
        return false
    if !adapter.Current()
        return false
    if !adapter.Release() || !adapter.Current()
        return false
    if !adapter.CloseInventory() || !adapter.Current()
        return false
    if !adapter.Checkpoint("before_" command) || !adapter.Current()
        return false
    ; This waits for ARRIVED_*, not for acceptance of the navigation command.
    result := adapter.Move(command, expectedId)
    failure := result
    if !adapter.Current()
        return false
    if !VerifiedNavigationReceiptMatches(result, command, expectedId)
        return false
    if !adapter.Checkpoint("after_" command) || !adapter.Current() {
        failure := "ERROR COMPANION_SESSION_CHANGED"
        return false
    }
    failure := ""
    return true
}

FindRegisteredStorageByCompanion(expectedGeneration, &failureMessage) {
    global State, Config
    failureMessage := "登録車両への徒歩到着を確認できませんでした"
    if !IsCurrentRun(expectedGeneration) || Config.vehicleCompanionProtocol != 1
        return false
    TransitionFarmState("MOVING_TO_TRUCK", "登録車両の現在位置へ徒歩移動",
        expectedGeneration, 0, true)
    State.statusLabel.Text := "登録したバン・トラックの荷台へ歩いています"
    WriteDiagnostic("NAVIGATION_BEGIN mode=companion command=go-vehicle")
    adapter := VerifiedNavigationAdapter(expectedGeneration)
    if !ExecuteVerifiedNavigation(adapter, "go-vehicle",
        Config.vehicleRegistrationId, &failure) {
        failureMessage := CompanionFailureMessage(failure, failureMessage)
        WriteDiagnostic("NAVIGATION_FAILED command=go-vehicle result="
            DiagnosticToken(failure))
        return false
    }
    if !IsCurrentRun(expectedGeneration)
        return false
    TransitionFarmState("VERIFY_TRUCK_REACHED", "ゲーム内の荷台到着を確認",
        expectedGeneration, 0, true)
    if !OpenCompanionCargoAndCapture(Config.vehicleRegistrationId,
        expectedGeneration, &storageId, &storageType, &cargoFailure) {
        failureMessage := CompanionFailureMessage(cargoFailure,
            "徒歩到着後に荷台を開けませんでした")
        WriteDiagnostic("NAVIGATION_CARGO_FAILED result=" DiagnosticToken(cargoFailure))
        return false
    }
    if !IsCurrentRun(expectedGeneration)
        return false
    if storageId != Config.vehicleStorageId || storageType != Config.vehicleStorageType {
        failureMessage := "開いた荷台IDが登録車両と一致しないため何も収納しません"
        WriteDiagnostic("NAVIGATION_CARGO_ID_MISMATCH")
        return false
    }
    WriteDiagnostic("NAVIGATION_ARRIVED_VERIFIED command=go-vehicle cargo=matched")
    return true
}

ReturnToWorkByCompanion(expectedGeneration) {
    global Config
    adapter := VerifiedNavigationAdapter(expectedGeneration)
    arrived := ExecuteVerifiedNavigation(adapter, "return-work",
        Config.vehicleRegistrationId, &failure)
    WriteDiagnostic(arrived
        ? "NAVIGATION_ARRIVED_VERIFIED command=return-work"
        : "NAVIGATION_FAILED command=return-work result=" DiagnosticToken(failure))
    return arrived
}

BeginCompanionVehicleRegistration(*) {
    global State, Config
    ; Own the operation before any blocking IPC: F8 cannot start underneath it.
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if State.running || State.updateOperation || State.registrationActive
            || State.startInProgress || State.stopInProgress
            return
        State.registrationActive := true
        State.registrationCancelled := false
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
    previous := SnapshotVehicleProfile()
    candidateId := ""
    initialInfo := 0
    committed := false
    ownsCompanionOperation := false
    ownsGameInput := false
    saved := false
    statusText := "車両を登録できませんでした"
    try {
        SetConfigurationEnabled(false)
        State.actionControl.Enabled := false
        if !Config.backgroundMode {
            statusText := "設定でバックグラウンド操作をオンにしてください"
            return
        }
        State.targetHwnd := FindFiveMWindow()
        if !State.targetHwnd {
            statusText := "FiveMが見つかりません"
            return
        }
        State.targetPid := WinGetPID("ahk_id " State.targetHwnd)
        health := RunBackgroundBridgeCancelable(0, "health")
        if !ParseServerHealth(health, &epoch)
            return
        State.serverEpoch := epoch
        if !QueryCompanionStatus(&initialInfo, "", 0) {
            statusText := "徒歩連携が未導入です。サーバー管理者によるai_miner_companionの導入が必要です"
            return
        }
        if !initialInfo.serverRegistrationSynchronized || !initialInfo.transactionSupported {
            statusText := "車両連携の同期・対応バージョンを確認してください"
            return
        }
        if initialInfo.transactionPending {
            statusText := "未確定の車両候補があります。ゲーム内の /aiminer-cancel で取消後、再登録してください"
            return
        }
        State.companionEpoch := initialInfo.epoch
        ownsGameInput := true
        if !ReleaseBackgroundTarget(true)
            return
        if RunBackgroundBridgeCancelable(0, "close-inventory") != "CLOSED"
            return
        if !IsBridgeOperationContextValid(0)
            return
        State.vehicleStatusLabel.Text := "FiveMで登録車両を選択してください"
        State.routeStatusLabel.Text := "徒歩ナビ用の車両登録中"
        State.routeDetailLabel.Text := "車両を狙ってE、またはox_targetの「AI採掘機に登録」を選択してください。"
        QueueWebUiFlush(true)
        State.gui.Hide()
        try WinActivate "ahk_id " State.targetHwnd
        ownsCompanionOperation := true
        armed := RunCompanionCommandCancelable(0, "arm-register")
        if !CompanionCommandSucceeded(armed, "arm-register", &armedId,
            &armedCode, &armedNet) || armedCode != "ARMED" {
            statusText := CompanionFailureMessage(armed, "車両選択を開始できませんでした")
            return
        }
        if !WaitForCompanionRegistration(initialInfo.sequence, initialInfo.epoch,
            epoch, &candidate, &registrationFailure) {
            statusText := CompanionFailureMessage(registrationFailure, "車両選択が完了しませんでした")
            return
        }
        candidateId := candidate.registrationId
        adapter := VerifiedNavigationAdapter(0)
        if !ExecuteVerifiedNavigation(adapter, "go-vehicle", candidateId,
            &navigationFailure) {
            statusText := CompanionFailureMessage(navigationFailure,
                "登録候補の荷台まで歩けませんでした")
            return
        }
        if !OpenCompanionCargoAndCapture(candidateId, 0, &storageId,
            &storageType, &cargoFailure) {
            statusText := CompanionFailureMessage(cargoFailure, "荷台のアクセスを確認できませんでした")
            return
        }
        if !IsBridgeOperationContextValid(0)
            return
        if !CommitCandidateRegistration(candidateId, initialInfo.epoch,
            &committed, &commitFailure) {
            statusText := CompanionFailureMessage(commitFailure, "車両登録の確定を確認できませんでした")
            return
        }
        Critical "On"
        try {
            if !IsBridgeOperationContextValid(0)
                return
            displayName := SubStr(Trim(RegExReplace(State.vehicleNameEdit.Value,
                "[\r\n\t]+", " ")), 1, 40)
            Config.vehicleName := displayName ? displayName : "登録車両"
            Config.vehicleStorageId := storageId
            Config.vehicleStorageType := storageType
            Config.vehicleWorkMode := Config.actionMode
            Config.vehicleCompanionProtocol := 1
            Config.vehicleRegistrationId := candidateId
            Config.vehicleRouteFormat := 5
            Config.vehicleOutboundRoute := ""
            Config.vehicleReturnRoute := ""
            Config.vehicleRegistered := 1
            Config.vehicleStorageEnabled := 1
            if !IsValidVehicleProfile(Config)
                throw Error("登録データが不正です")
            SaveAllSettingsAtomically()
            saved := true
            statusText := "徒歩連携で登録完了　" Config.vehicleName
            WriteDiagnostic("NAVIGATION_REGISTRATION_COMMITTED protocol=1")
        } finally Critical "Off"
    } catch as err {
        statusText := "車両登録エラー: " err.Message
        WriteDiagnostic("NAVIGATION_REGISTRATION_ERROR=" DiagnosticToken(err.Message))
    } finally {
        if !saved {
            RestoreVehicleProfile(previous)
            if candidateId && !committed && IsObject(initialInfo)
                AbortCandidateRegistration(candidateId, initialInfo.epoch,
                    initialInfo, &abortDiagnostic)
            ; The server may have committed while the local save/ack failed.
            ; Keep the prior profile, but block automation rather than using two
            ; different vehicle identities. A later explicit registration reconciles it.
            if committed {
                Config.vehicleStorageEnabled := 0
                try SaveAllSettingsAtomically()
            }
        }
        if ownsCompanionOperation && State.companionReady && !saved
            RunCompanionCommand("cancel")
        if ownsGameInput {
            ReleaseBackgroundTarget(true)
            RunBackgroundBridge("close-inventory")
        }
        State.registrationActive := false
        State.registrationCancelled := false
        State.targetHwnd := 0
        State.targetPid := 0
        State.serverEpoch := ""
        State.actionControl.Enabled := true
        SetConfigurationEnabled(true)
        RefreshVehicleUi()
        State.vehicleStatusLabel.Text := statusText
        ShowPage("vehicle")
        ShowMainWindow()
        QueueWebUiFlush(true)
    }
}

; These tests call the same navigation orchestration used at runtime with fake
; transport/arrival receipts. They are not tests of FiveM movement or its NavMesh.
class FakeVerifiedNavigationAdapter {
    __New(result, failureAt := "", cancelAfterMove := false) {
        this.Result := result
        this.FailureAt := failureAt
        this.CancelAfterMove := cancelAfterMove
        this.Active := true
        this.Calls := ""
    }
    Current() => this.Active
    Step(name) {
        this.Calls .= (this.Calls ? "|" : "") name
        return name != this.FailureAt
    }
    Release() => this.Step("release")
    CloseInventory() => this.Step("close")
    Checkpoint(label) => this.Step(label)
    Move(command, id) {
        this.Step("move_" command)
        if this.CancelAfterMove
            this.Active := false
        return this.Result
    }
}

RunVerifiedNavigationSelfTest() {
    id := "YW12X2FhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYQ=="
    foreachCommand := ["go-vehicle", "return-work"]
    for command in foreachCommand {
        code := command = "go-vehicle" ? "ARRIVED_VEHICLE" : "ARRIVED_WORK"
        receipt := "COMPANION_DONE " command " " code " " id " 123"
        driver := FakeVerifiedNavigationAdapter(receipt)
        if !ExecuteVerifiedNavigation(driver, command, id, &failure)
            || driver.Calls != "release|close|before_" command
                . "|move_" command "|after_" command
            return false
        for bad in ["COMPANION_DONE " command " ACCEPTED " id " 123",
            "COMPANION_DONE " command " " code " " id " 0",
            "COMPANION_DONE " command " " code " - 123",
            "ERROR COMPANION_NAVIGATION_STUCK", "ERROR COMPANION_MANUAL_OVERRIDE"] {
            driver := FakeVerifiedNavigationAdapter(bad)
            if ExecuteVerifiedNavigation(driver, command, id, &failure)
                || InStr(driver.Calls, "after_")
                return false
        }
        for stage in ["release", "close", "before_" command] {
            driver := FakeVerifiedNavigationAdapter(receipt, stage)
            if ExecuteVerifiedNavigation(driver, command, id, &failure)
                || InStr(driver.Calls, "move_")
                return false
        }
        driver := FakeVerifiedNavigationAdapter(receipt, "after_" command)
        if ExecuteVerifiedNavigation(driver, command, id, &failure)
            return false
        driver := FakeVerifiedNavigationAdapter(receipt, "", true)
        if ExecuteVerifiedNavigation(driver, command, id, &failure)
            || InStr(driver.Calls, "after_")
            return false
    }
    profile := {vehicleRegistered: 1, vehicleCompanionProtocol: 1,
        vehicleRegistrationId: id, vehicleStorageId: "dHJ1bmsxMjM=",
        vehicleStorageType: "dHJ1bms=", vehicleWorkMode: "washing",
        vehicleRouteFormat: 5, vehicleOutboundRoute: "", vehicleReturnRoute: ""}
    if !IsValidVehicleProfile(profile)
        return false
    profile.vehicleRegistrationId := ""
    return !IsValidVehicleProfile(profile)
}

PlayWashingCompletionVoice(message) {
    ; Optional, locally supplied Japanese voice recording. No network or API key
    ; is required. The built-in Japanese SAPI voice remains an explicit fallback.
    voicePath := A_ScriptDir "\audio\stone-washing-complete.wav"
    if FileExist(voicePath) {
        try {
            if FileGetSize(voicePath) > 44 && FileGetSize(voicePath) <= 10485760 {
                SoundPlay voicePath, false
                WriteDiagnostic("WASH_VOICE source=local_recording")
                return true
            }
        }
    }
    spoken := SpeakAutomationMessage(message)
    WriteDiagnostic("WASH_VOICE source=windows_sapi played=" (spoken ? 1 : 0))
    return spoken
}
