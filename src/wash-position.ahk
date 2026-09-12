; Foreground visual reference is fixed for one Farm generation. Never re-anchor
; after each reward: doing that would silently follow cumulative backward drift.
ObservedWashAnchorPath(generation) {
    global LocalNav
    return LocalNav.runtime "\wash-position-" generation ".json"
}

RunObservedWashHelper(operation, generation) {
    global LocalNav, State
    if !IsCurrentRun(generation) || !IsTargetForeground(generation)
        return "ERROR GAME_NOT_FOREGROUND"
    if !ValidateServerEpochCheckpoint(generation, "wash_position_before")
        return "ERROR SERVER_SESSION_CHANGED"
    HideRuntimeStatusOverlay()
    path := ObservedWashAnchorPath(generation)
    try {
        result := RunExeRouteHelper(operation, path, generation)
        if IsCurrentRun(generation) && FileExist(path ".last-run.json") {
            try FileCopy path ".last-run.json", LocalNav.root "\wash-position-last.json", true
        }
        if !IsCurrentRun(generation)
            return "ERROR CANCELLED"
        if !ValidateServerEpochCheckpoint(generation, "wash_position_after")
            return "ERROR SERVER_SESSION_CHANGED"
        return result
    } finally {
        if IsCurrentRun(generation)
            StartRuntimeStatusOverlay()
    }
}

EnsureObservedWashAnchor(generation) {
    global LocalNav, State, Config
    if !Config.washForwardCorrection
        return true
    if !IsCurrentRun(generation)
        return false
    if !IsTargetForeground(generation) {
        State.statusLabel.Text := "●  石洗いの位置確認待ち。FiveMを前面にしてください"
        ScheduleNext(generation, 300)
        return false
    }
    if LocalNav.washAnchorGeneration = generation {
        if State.farmState != "RESUMING_FARM"
            return true
        result := RunObservedWashHelper("wash-check", generation)
        if !IsCurrentRun(generation)
            return false
        if InStr(result, "WASH_STABLE ") = 1
            return true
        return FailObservedWash(generation, result)
    }
    ; The baseline must be a real washing spot, not a truck prompt or empty area.
    if !ProbeWorkTarget("washing", generation) {
        if !IsCurrentRun(generation)
            return false
        State.statusLabel.Text := "●  この視点に「石を洗う」がありません。作業場所と視点を確認してください"
        WriteDiagnostic("WASH_ANCHOR_TARGET_MISSING camera_input=0")
        return FailObservedWash(generation, "ERROR WASH_TARGET_MISSING_AT_ANCHOR")
    }
    result := RunObservedWashHelper("wash-anchor", generation)
    Critical "On"
    if !IsCurrentRun(generation) {
        Critical "Off"
        return false
    }
    if result = "WASH_ANCHORED" {
        LocalNav.washAnchorGeneration := generation
        LocalNav.washFeedback := "開始位置を保存。各洗浄後に画面で位置ずれと前進の効果を確認します"
    }
    Critical "Off"
    WriteDiagnostic("WASH_ANCHOR result=" result " generation=" generation)
    if result != "WASH_ANCHORED"
        return FailObservedWash(generation, result)
    return true
}

FailObservedWash(generation, result) {
    global LocalNav
    if !IsCurrentRun(generation)
        return false
    ; A fixed-camera pixel threshold is not the task completion criterion at a
    ; verified nearby cargo spot. Do not change the visual report or count a nudge.
    if TryAcceptNearbyWashRecovery(generation, result)
        return true
    if !IsCurrentRun(generation)
        return false
    reason := InStr(result, "WASH_TARGET_MISSING_AT_ANCHOR")
        ? "この位置・視点では「石を洗う」を確認できません。未洗浄石と作業地点を確認してください"
        : InStr(result, "FORWARD_NO_OBSERVED_EFFECT")
        ? "前進Wを送信しましたが、画面上の移動を確認できません。補正成功にせず停止しました"
        : InStr(result, "WRONG_DIRECTION")
        ? "前進で位置のずれが増えたため停止しました。向き・障害物・操作設定を確認してください"
        : InStr(result, "NOT_FOREGROUND")
        ? "FiveMが前面ではなくなったため、位置補正を中止しました"
        : InStr(result, "SCENE_NOT_STABLE")
        ? "洗浄後の景色が安定しないため前進しません。演出・水面・周囲の動きを確認してください"
        : InStr(result, "SCENERY_NOT_DISTINCT")
        ? "位置を判定する目印が不足しています。岩や岸が見える視点で開始し直してください"
        : "開始位置との照合を確認できないため停止しました。視点・立ち位置を確認してください"
    LocalNav.washFeedback := reason "（" result "）"
    LocalNav.feedback := LocalNav.washFeedback
    WriteDiagnostic("WASH_POSITION_FAILED result=" result " input_success_is_not_motion=1")
    StopAutomationWithFault(LocalNav.washFeedback, "routes", "WASH_POSITION_UNVERIFIED")
    return false
}


; Validation must exit non-zero with a trace, never wait on an invisible dialog.
; This handler is installed only by --validate / UI test modes.
ValidationFatalError(err, mode) {
    message := "VALIDATION_ERROR " mode
    try message .= " line=" err.Line " " err.Message "`n" err.Stack
    try FileAppend message "`n", "**", "UTF-8-RAW"
    ExitApp(146)
}
