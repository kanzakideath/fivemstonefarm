; EXE-only routes: explicitly taught walking + visual checkpoints.
; Cargo identity and item receipts remain independently checked by the parent.
InitExeRouteAssets() {
    global LocalNav, persistentDataRoot, processId
    LocalNav.root := persistentDataRoot "\exe-routes"
    LocalNav.runtime := A_Temp "\ai-miner-local-navigation-" processId
    DirCreate LocalNav.root
    DirCreate LocalNav.runtime
    LocalNav.helper := LocalNav.runtime "\LocalNavigation.exe"
    FileInstall "LocalNavigation.exe", LocalNav.helper, true
    FileInstall "audio\mining-complete-sweet.wav", LocalNav.runtime "\mining-complete-sweet.wav", true
    FileInstall "audio\washing-complete-sweet.wav", LocalNav.runtime "\washing-complete-sweet.wav", true
    FileInstall "audio\gold-complete-sweet.wav", LocalNav.runtime "\gold-complete-sweet.wav", true
    FileInstall "audio\mining-complete-clear.wav", LocalNav.runtime "\mining-complete-clear.wav", true
    FileInstall "audio\washing-complete-clear.wav", LocalNav.runtime "\washing-complete-clear.wav", true
    FileInstall "audio\gold-complete-clear.wav", LocalNav.runtime "\gold-complete-clear.wav", true
    FileInstall "audio\CREDITS.txt", LocalNav.runtime "\CREDITS.txt", true
    LocalNav.options := LocalNav.root "\options.ini"
    LocalNav.voiceStyle := IniRead(LocalNav.options, "Voice", "Style", "clear")
    if LocalNav.voiceStyle != "sweet" && LocalNav.voiceStyle != "clear"
        && LocalNav.voiceStyle != "off"
        LocalNav.voiceStyle := "clear"
    LocalNav.voiceScope := IniRead(LocalNav.options, "Voice", "Scope", "batch")
    if LocalNav.voiceScope != "batch" && LocalNav.voiceScope != "action"
        LocalNav.voiceScope := "batch"
}

; A saved trial is not a live position/connection proof. Execution guards remain unchanged.
ExeRouteSetupStateJson(mode) {
    global State, Config, LocalNav
    root := ExeRouteModeRoot(mode)
    meta := root "\route.ini"
    hasVehicle := IsValidVehicleProfile(Config) && Config.vehicleCompanionProtocol = 0
    recorded := false
    trialSaved := false
    try {
        bound := hasVehicle
            && IniRead(meta, "Route", "StorageId", "") == Config.vehicleStorageId
            && IniRead(meta, "Route", "StorageType", "") == Config.vehicleStorageType
        recorded := bound && !!FileExist(root "\outbound.json") && !!FileExist(root "\return.json")
        trialSaved := recorded && ExeRouteFilesMatch(root)
            && IniRead(meta, "Route", "Verified", "0") = "1"
    }
    return '{"hasVehicle":' (hasVehicle ? "true" : "false")
        . ',"recorded":' (recorded ? "true" : "false")
        . ',"trialSaved":' (trialSaved ? "true" : "false")
        . ',"busy":' ((LocalNav.busy || LocalNav.requestActive || State.running || State.registrationActive || State.startInProgress) ? "true" : "false")
        . ',"cycle":' StorageCycleProofJson(LocalNav.cycle)
        . ',"feedback":' JsonQuote(LocalNav.feedback) '}'
}

RequestExeRouteSetup(operation, mode, *) {
    global State, Config, LocalNav
    if LocalNav.requestActive || LocalNav.busy || State.running || State.registrationActive || State.startInProgress
        return false
    if mode != Config.actionMode
        return false
    LocalNav.requestActive := true
    QueueWebUiFlush(true)
    try {
        if operation = "teach"
            TeachExeRoute()
        else if operation = "trial"
            TrialExeRoute()
        else
            return false
    } finally {
        LocalNav.requestActive := false
        QueueWebUiFlush(true)
    }
    return true
}

OpenExeRouteSettings(*) {
    global State, LocalNav
    if LocalNav.busy {
        TrayTip "記録・試走中です。中止する場合はF9を押してください。", "ルート設定", 1
        return
    }
    ShowPage("routes")
    ShowMainWindow()
}

SetExeSetupGuide(title, detail) {
    global LocalNav, State
    HideExeSetupGuide()
    guide := Gui("+AlwaysOnTop -Caption +ToolWindow +E0x08000020", "ルート設定ガイド")
    guide.BackColor := "14283F"
    guide.SetFont("s12 cFFFFFF", "Yu Gothic UI")
    guide.AddText("x18 y14 w470", title)
    guide.SetFont("s10 cC7DAED")
    guide.AddText("x18 y45 w470 h70", detail "`n中止：F9　／　サーバー追加導入なし")
    if State.targetHwnd {
        WinGetClientPos &x, &y, &w, &h, "ahk_id " State.targetHwnd
        guide.Show("NoActivate x" (x + 16) " y" (y + 16) " w510 h126")
    } else
        guide.Show("NoActivate w510 h126")
    LocalNav.guide := guide
}

HideExeSetupGuide() {
    global LocalNav
    if IsObject(LocalNav.guide)
        try LocalNav.guide.Destroy()
    LocalNav.guide := 0
}

ShowExeRoutePanel(*) {
    global LocalNav, State, Config
    if State.running || State.registrationActive || State.startInProgress || LocalNav.busy {
        LocalNav.feedback := "作業・登録中です。F9で停止してからルート設定を開いてください。"
        QueueWebUiFlush(true)
        return
    }
    if IsObject(LocalNav.dialog)
        try LocalNav.dialog.Destroy()
    panel := Gui("+AlwaysOnTop", "EXEだけで徒歩往復・完了ボイス")
    panel.SetFont("s10", "Yu Gothic UI")
    panel.AddButton("w640 h40", "ルート設定の専用画面を開く").OnEvent("Click", (*) => (panel.Hide(), OpenExeRouteSettings()))
    panel.AddText("w640", "サーバー導入は不要です。作業モードごとに、同じ作業場所と停車車両の往路・復路を記録します。`n徒歩中だけFiveMを前面で使用します。他アプリへ切替／F9／手動操作で停止します。")
    panel.AddText("y+12 w640", "① 先に通常の車両登録を行う。`n② 作業場所で下の「往復を教える」。W/A/S/Dとマウスだけで歩く。4秒以内ごとに立ち止まると照合点を保存。各終点でF7。`n③ 元の現場で「自動試走」。往復の画面照合・荷台ID・作業ボタンが確認できた経路だけ有効になります。")
    panel.AddText("y+10 w640 cA34512", "車両の移動、別サーバー／再接続、画面サイズ・カメラ設定変更時は再登録が必要です。天候・照明・遮蔽物で画面照合できない場合も停止します。任意の車両を自動追跡する方式ではありません。")
    panel.AddText("y+10 w640", "現在の作業：" BackgroundActionDisplayName(Config.actionMode))
    panel.AddButton("y+12 w305 h36", "1. 往復を教える").OnEvent("Click", RequestExeRouteSetup.Bind("teach", Config.actionMode))
    panel.AddButton("x+12 yp w305 h36", "2. 自動試走（収納しない）").OnEvent("Click", RequestExeRouteSetup.Bind("trial", Config.actionMode))
    panel.AddText("xm y+20 w600", "完了ボイス　VOICEVOX:四国めたん")
    voice := panel.AddDropDownList("w305", ["アニメ調・甘め", "クリアな女性音声（標準）", "音声なし"])
    voice.Choose(LocalNav.voiceStyle = "clear" ? 2 : LocalNav.voiceStyle = "off" ? 3 : 1)
    timing := panel.AddDropDownList("x+12 yp w305", ["満杯／手持ちの石0で通知", "作業が1回成功するたび通知"])
    timing.Choose(LocalNav.voiceScope = "action" ? 2 : 1)
    save := panel.AddButton("xm y+10 w190 h32", "音声設定を保存")
    save.OnEvent("Click", (*) => SaveExeVoiceOptions(voice.Value, timing.Value))
    panel.AddButton("x+12 yp w190 h32", "今の作業の声を試聴").OnEvent("Click",
        (*) => PreviewExeVoice(voice.Value, Config.actionMode))
    panel.AddText("xm y+12 w640", "音声利用規約：voicevox.hiroshiba.jp/term/　zunko.jp/con_ongen_kiyaku.html`nこの音声を再利用する場合も、両規約とクレジット表記を守ってください。")
    panel.OnEvent("Close", (*) => panel.Hide())
    LocalNav.dialog := panel
    panel.Show()
}

SaveExeVoiceOptions(voiceIndex, timingIndex) {
    global LocalNav
    LocalNav.voiceStyle := voiceIndex = 2 ? "clear" : voiceIndex = 3 ? "off" : "sweet"
    LocalNav.voiceScope := timingIndex = 2 ? "action" : "batch"
    tmp := LocalNav.options ".tmp"
    try {
        IniWrite LocalNav.voiceStyle, tmp, "Voice", "Style"
        IniWrite LocalNav.voiceScope, tmp, "Voice", "Scope"
        FileMove tmp, LocalNav.options, true
    } catch as err {
        MsgBox "音声設定を保存できませんでした：" err.Message
    }
}

PreviewExeVoice(index, mode) {
    global LocalNav
    previous := LocalNav.voiceStyle
    LocalNav.voiceStyle := index = 2 ? "clear" : index = 3 ? "off" : "sweet"
    try PlayExeCompletionVoice(mode = "washing" ? "wash_complete" : mode "_complete")
    finally LocalNav.voiceStyle := previous
}

PlayExeCompletionVoice(kind) {
    global LocalNav, isUiTestRun, isValidationRun
    if isUiTestRun || isValidationRun || LocalNav.voiceStyle = "off"
        return true
    stem := kind = "wash_complete" ? "washing-complete"
        : kind = "mining_complete" ? "mining-complete"
        : kind = "gold_complete" ? "gold-complete" : ""
    if !stem
        return false
    clip := LocalNav.runtime "\" stem "-" LocalNav.voiceStyle ".wav"
    if !FileExist(clip)
        return false
    ; Pre-generated licensed speech; no server, runtime model, or network request.
    return DllCall("winmm\PlaySoundW", "Str", clip, "Ptr", 0,
        "UInt", 0x20003, "Int") != 0
}

CompletionPhrase(mode) {
    return mode = "washing" ? "石洗いが終わったよ"
        : mode = "gold" ? "砂金取りが終わりました" : "石掘りが終わったよ"
}

NotifyExeBatchComplete(expectedGeneration, mode) {
    global State, LocalNav
    if !IsCurrentRun(expectedGeneration) || LocalNav.voiceScope = "action"
        return false
    key := expectedGeneration ":" (mode = "washing" ? State.miningAttemptId : State.storageTrips) ":" mode
    if LocalNav.lastBatchKey = key
        return false
    LocalNav.lastBatchKey := key
    return EmitAutomationAlert(mode = "washing" ? "wash_complete" : mode "_complete", CompletionPhrase(mode))
}

NotifyExeActionComplete(expectedGeneration, mode, attemptId) {
    global LocalNav
    if !IsCurrentRun(expectedGeneration) || LocalNav.voiceScope != "action"
        return false
    key := expectedGeneration ":" attemptId ":" mode
    if LocalNav.lastActionKey = key
        return false
    LocalNav.lastActionKey := key
    return EmitAutomationAlert(mode = "washing" ? "wash_complete" : mode "_complete", CompletionPhrase(mode))
}

ExeRouteModeRoot(mode) {
    global LocalNav
    if mode != "mining" && mode != "washing" && mode != "gold"
        throw Error("Invalid route mode")
    path := LocalNav.root "\" mode
    DirCreate path
    return path
}

ExeRouteFilesMatch(root) {
    try {
        for leg in ["outbound", "return"] {
            file := root "\" leg ".json"
            proof := root "\" leg ".verified"
            if !FileExist(file) || !FileExist(proof)
                return false
            if FileGetSize(file) > 4 * 1024 * 1024 || FileGetSize(proof) > 4 * 1024 * 1024
                return false
            if !(FileRead(file, "UTF-8") == FileRead(proof, "UTF-8"))
                return false
        }
        return true
    } catch
        return false
}

ExeRouteBindingValid(mode, epoch, verified := true) {
    global Config
    root := ExeRouteModeRoot(mode)
    meta := root "\route.ini"
    try {
        return IniRead(meta, "Route", "StorageId", "") == Config.vehicleStorageId
            && IniRead(meta, "Route", "StorageType", "") == Config.vehicleStorageType
            && (!verified || IniRead(meta, "Route", "Epoch", "") = epoch)
            && (!verified || IniRead(meta, "Route", "Verified", "0") = "1")
            && ExeRouteFilesMatch(root)
    } catch
        return false
}

RequireExeRouteForRun(expectedGeneration) {
    global State, Config
    if !Config.vehicleStorageEnabled
        return true
    if !ExeRouteBindingValid(State.runMode, State.serverEpoch) {
        StopAutomationWithFault("この作業のEXE徒歩ルートが未登録・未試走か、接続が変わりました。車両画面の「徒歩ルート・音声設定」で往復を教え、自動試走してください", "vehicle", "LOCAL_ROUTE_SETUP_REQUIRED")
        ShowPage("routes")
        return false
    }
    return IsCurrentRun(expectedGeneration)
}

ExeRouteContextValid(generation) {
    global LocalNav, State
    return generation ? IsCurrentRun(generation)
        : LocalNav.busy && State.registrationActive && !State.registrationCancelled
}

CancelExeRouteOperation(*) {
    global LocalNav, State
    if LocalNav.busy && State.registrationActive
        State.registrationCancelled := true
    if LocalNav.cancel
        try FileAppend "cancel", LocalNav.cancel, "UTF-8"
}

RunExeRouteHelper(operation, routePath, generation := 0) {
    global LocalNav, State, Config, processId
    if !ExeRouteContextValid(generation) || !State.targetHwnd
        return "ERROR CANCELLED"
    if LocalNav.pid
        return "ERROR NAVIGATION_BUSY"
    LocalNav.taskId += 1
    task := LocalNav.taskId
    resultPath := LocalNav.runtime "\result-" task ".txt"
    cancelPath := LocalNav.runtime "\cancel-" task ".txt"
    LocalNav.cancel := cancelPath
    helperPid := 0
    try {
        HideExeSetupGuide()
        if !ReleaseBackgroundTarget(true) || RunBridgeForContext(generation, "close-inventory") != "CLOSED"
            return "ERROR UI_NOT_CLOSED"
        if !ExeRouteContextValid(generation)
            return "ERROR CANCELLED"
        ; The route setup explicitly discloses foreground use. Never type into
        ; another application after a user switches away during navigation.
        try WinActivate "ahk_id " State.targetHwnd
        if !WinWaitActive("ahk_id " State.targetHwnd,, 3)
            return "ERROR GAME_NOT_FOREGROUND"
        command := QuoteCommandArg(LocalNav.helper) " " operation " " QuoteCommandArg(resultPath)
            . " " State.targetHwnd " " processId " " QuoteCommandArg(cancelPath)
            . " " QuoteCommandArg(routePath) " " Config.workViewMouseDirection " " State.targetPid
        Critical "On"
        if !ExeRouteContextValid(generation) {
            Critical "Off"
            return "ERROR CANCELLED"
        }
        try Run command,, "Hide", &helperPid
        finally Critical "Off"
        LocalNav.pid := helperPid
        deadline := MonotonicMs() + 365000
        while ProcessExist(helperPid) {
            if !ExeRouteContextValid(generation) || MonotonicMs() >= deadline {
                CancelExeRouteOperation()
                ProcessWaitClose helperPid, 2
                if ProcessExist(helperPid) {
                    ; Last resort cleanup only. Do not resume/replay an interrupted leg.
                    try ProcessClose helperPid
                    for key in ["w", "a", "s", "d"]
                        try SendEvent "{" key " up}"
                }
                return "ERROR CANCELLED"
            }
            Sleep 25
        }
        if !ExeRouteContextValid(generation)
            return "ERROR CANCELLED"
        if !FileExist(resultPath)
            return "ERROR NO_NAVIGATION_RESULT"
        result := Trim(FileRead(resultPath, "UTF-8"))
        WriteDiagnostic("EXE_ROUTE operation=" operation " leg=" routePath " result=" result)
        return result
    } finally {
        if LocalNav.taskId = task {
            LocalNav.pid := 0
            LocalNav.cancel := ""
        }
        try FileDelete resultPath
        try FileDelete cancelPath
    }
}

BeginExeRouteSetupContext() {
    global LocalNav, State, Config
    if State.running || State.registrationActive || State.startInProgress || LocalNav.busy
        return false
    if !IsValidVehicleProfile(Config) || Config.vehicleCompanionProtocol != 0 {
        MsgBox "先に、このEXEの通常の車両登録から荷台を登録してください。"
        return false
    }
    hwnd := FindFiveMWindow()
    if !hwnd || !ParseServerHealth(RunBackgroundBridge("health"), &epoch) {
        MsgBox "FiveMの対象UI接続を確認できません。"
        return false
    }
    LocalNav.busy := true
    State.registrationActive := true
    State.registrationCancelled := false
    State.targetHwnd := hwnd
    State.targetPid := WinGetPID("ahk_id " hwnd)
    State.serverEpoch := epoch
    if IsObject(LocalNav.dialog)
        LocalNav.dialog.Hide()
    State.gui.Hide()
    try {
        WinActivate "ahk_id " hwnd
        if !WinWaitActive("ahk_id " hwnd,, 3)
            throw Error("FiveMを前面にできませんでした。")
    } catch as err {
        FinishExeRouteSetupContext(err.Message)
        return false
    }
    return true
}

FinishExeRouteSetupContext(message) {
    global LocalNav, State
    CancelExeRouteOperation()
    HideExeSetupGuide()
    ReleaseBackgroundTarget(true)
    RunBackgroundBridge("close-inventory")
    State.registrationActive := false
    State.registrationCancelled := false
    State.targetHwnd := 0
    State.targetPid := 0
    State.serverEpoch := ""
    LocalNav.busy := false
    State.vehicleStatusLabel.Text := message
    LocalNav.feedback := message
    ShowPage("routes")
    ShowMainWindow()
    QueueWebUiFlush(true)
}

TeachExeRoute(*) {
    global LocalNav, State, Config
    if MsgBox("作業場所で、通常の作業ボタンを出せる位置に立ってください。石洗いは手持ちに未洗浄石が必要です。`n`n往路：トラックの荷台前へ歩いてF7。`n復路：同じ作業場所へ歩いてF7。`n4秒以内ごとに立ち止まり、照合用の景色を保存してください。`n記録中はW/A/S/Dとマウスだけ。走る・乗車・UI操作はしないでください。`n`n徒歩中にFiveMを前面にすることへ同意して開始します。", "EXE徒歩ルートの記録", "OKCancel") != "OK"
        return
    if !BeginExeRouteSetupContext()
        return
    root := ExeRouteModeRoot(Config.actionMode)
    outPath := root "\outbound.pending"
    backPath := root "\return.pending"
    message := "記録は未完了です。以前の登録は変更していません。"
    epoch := State.serverEpoch
    try {
        SetExeSetupGuide("準備：作業現場を確認中", "選択した作業のボタンが出る位置に立ってください。")
        if !ProbeExeRouteWork(0, Config.actionMode)
            throw Error("開始地点で作業ボタンを確認できません。作業可能な現場で開始してください。")
        result := RunExeRouteHelper("record", outPath)
        if result != "RECORDED"
            throw Error("往路記録：" ExeRouteErrorMessage(result))
        SetExeSetupGuide("往路の終点：荷台を確認中", "登録した荷台IDを照合しています。完了後は復路の案内に切り替わります。")
        if !ProbeExeRouteCargo(0, &id, &type)
            || id != Config.vehicleStorageId || type != Config.vehicleStorageType
            throw Error("終点で登録した荷台を確認できません。記録は保存しません。")
        if !CloseLocalStorageUi()
            throw Error("荷台を閉じられません。停止しました。")
        SetExeSetupGuide("次は復路：荷台 → 同じ作業現場", "これから帰り道を記録します。元の作業位置へ歩いて戻り、停止してF7。")
        Sleep 1600
        result := RunExeRouteHelper("record", backPath)
        if result != "RECORDED"
            throw Error("復路記録：" ExeRouteErrorMessage(result))
        SetExeSetupGuide("復路の終点：作業場所を確認中", "元の現場の作業ボタンを確認しています。まだアイテムは移動しません。")
        if !ProbeExeRouteWork(0, Config.actionMode)
            throw Error("復路終点で作業ボタンを確認できません。正しい現場で記録してください。")
        if !ParseServerHealth(RunBackgroundBridge("health"), &currentEpoch)
            || currentEpoch != epoch || State.registrationCancelled
            throw Error("記録中に接続が変わったか、取り消されました。")
        ; Mark unverified before replacing either leg. A crash can never leave a
        ; new leg enabled with the old trial receipt.
        meta := root "\route.ini"
        IniWrite "0", meta, "Route", "Verified"
        FileMove outPath, root "\outbound.json", true
        FileMove backPath, root "\return.json", true
        FileCopy root "\outbound.json", root "\outbound.verified", true
        FileCopy root "\return.json", root "\return.verified", true
        IniWrite Config.vehicleStorageId, meta, "Route", "StorageId"
        IniWrite Config.vehicleStorageType, meta, "Route", "StorageType"
        IniWrite epoch, meta, "Route", "Epoch"
        message := "往復の記録ができました。まだ自動収納は有効になりません。元の作業場所で「自動試走」を実行してください。"
    } catch as err {
        message := err.Message
    } finally {
        try FileDelete outPath
        try FileDelete backPath
        FinishExeRouteSetupContext(message)
    }
}

TrialExeRoute(*) {
    global State, Config
    if !BeginExeRouteSetupContext()
        return
    root := ExeRouteModeRoot(Config.actionMode)
    message := "試走に失敗しました。"
    epoch := State.serverEpoch
    try {
        if !ExeRouteBindingValid(Config.actionMode, epoch, false)
            throw Error("同じ作業と荷台の往復記録を確認できません。記録を作成・修復してから試走してください。")
        IniWrite "0", root "\route.ini", "Route", "Verified"
        result := RunExeRouteHelper("play", root "\outbound.json")
        if result != "ROUTE_REPLAYED"
            throw Error("往路試走：" ExeRouteErrorMessage(result))
        SetExeSetupGuide("試走 1/2：到着先の荷台を確認", "荷台IDを照合します。試走では収納も補充もしません。")
        if !ProbeExeRouteCargo(0, &id, &type)
            || id != Config.vehicleStorageId || type != Config.vehicleStorageType
            throw Error("試走終点の荷台IDが一致しません。歩行を成功扱いにしません。")
        if !CloseLocalStorageUi()
            throw Error("荷台が閉じられないため復路を開始しません。")
        result := RunExeRouteHelper("play", root "\return.json")
        if result != "ROUTE_REPLAYED"
            throw Error("復路試走：" ExeRouteErrorMessage(result))
        SetExeSetupGuide("試走 2/2：帰還先の作業場所を確認", "最後の確認です。作業ボタンの確認後に試走結果を保存します。")
        if !ProbeExeRouteWork(0, Config.actionMode)
            throw Error("元の現場の作業ボタンを確認できません。経路を短い区間で記録し直してください。")
        if !ParseServerHealth(RunBackgroundBridge("health"), &liveEpoch)
            || liveEpoch != epoch || State.registrationCancelled
            throw Error("試走中に接続が変わったか、取り消されました。")
        ; Renew a connection only AFTER a fresh trial verifies both endpoints.
        IniWrite epoch, root "\route.ini", "Route", "Epoch"
        IniWrite "1", root "\route.ini", "Route", "Verified"
        message := "自動試走で往路・登録荷台・復路・作業ボタンを確認しました。今回の接続で、この作業の徒歩収納／石補充を使えます。車両を動かした場合は記録し直してください。"
    } catch as err {
        message := err.Message
    } finally FinishExeRouteSetupContext(message)
}

ExeRouteErrorMessage(result) {
    if InStr(result, "VISUAL_CHECKPOINT")
        return "記録した景色に一致しません。視点だけではなく立ち位置・照明・車両位置・カメラ設定を確認し、短い区間で記録し直してください。"
    if InStr(result, "FOREGROUND")
        return "FiveMが前面でなくなったため入力を止めました。"
    if InStr(result, "CHECKPOINT") || InStr(result, "SEGMENT")
        return "1区間が長すぎます。4秒以内ごとに立ち止まって記録してください。"
    if InStr(result, "WALK_ONLY")
        return "記録中はW/A/S/Dとマウスだけで歩いてください。ダッシュ・UI操作などは記録しません。"
    if InStr(result, "SCENERY")
        return "照合する景色の特徴が不足しています。真っ暗・単色の地面だけにならない場所で記録してください。"
    if InStr(result, "DISPLAY_CHANGED")
        return "画面サイズや上下視点設定が変わりました。同じ設定で記録し直してください。"
    if InStr(result, "CANCEL") || InStr(result, "MANUAL_OVERRIDE")
        return "停止キーまたは手動操作によって中止しました。"
    return result
}

ExecuteExeRouteLeg(generation, leg) {
    global State, Config
    if (leg != "outbound" && leg != "return") || !IsCurrentRun(generation)
        return false
    if !ExeRouteBindingValid(State.runMode, State.serverEpoch)
        return false
    if !ValidateServerEpochCheckpoint(generation, "exe_route_" leg)
        return false
    result := RunExeRouteHelper("play", ExeRouteModeRoot(State.runMode) "\" leg ".json", generation)
    if !IsCurrentRun(generation)
        return false
    if result != "ROUTE_REPLAYED" {
        ; No retry of a possibly partially traversed leg. Never reverse time-based
        ; input or fall back to blind wandering after a visual failure.
        StopAutomationWithFault(ExeRouteErrorMessage(result), "vehicle", "EXE_ROUTE_UNVERIFIED")
        return false
    }
    return ValidateServerEpochCheckpoint(generation, "exe_route_" leg "_end")
}

ExeRouteCameraStep(generation, dx, dy) {
    global State
    if !ExeRouteContextValid(generation) || !WinActive("ahk_id " State.targetHwnd)
        return false
    if !ReleaseBackgroundTarget(true)
        return false
    Critical "On"
    try {
        if !ExeRouteContextValid(generation) || !WinActive("ahk_id " State.targetHwnd)
            return false
        return SendRelativeMouseDelta(dx, dy)
    } finally Critical "Off"
}

ProbeExeRouteCargo(generation, &storageId, &storageType) {
    global State, Config
    storageId := ""
    storageType := ""
    ; The taught route supplies position/yaw. Only bounded pitch adjustment is
    ; permitted here; this is not the old in-place search pretending to navigate.
    Loop 9 {
        if !ExeRouteContextValid(generation)
            return false
        if OpenStorageAndCapture(&id, &type, generation, &fatal) {
            if id != Config.vehicleStorageId || type != Config.vehicleStorageType {
                CloseLocalStorageUi()
                WriteDiagnostic("EXE_ROUTE_WRONG_CARGO")
                return false
            }
            storageId := id
            storageType := type
            return true
        }
        if fatal
            return false
        if !ExeRouteCameraStep(generation, 0, -Config.workViewMouseDirection * 100)
            return false
        Sleep 100
    }
    return false
}

ProbeExeRouteWork(generation, mode) {
    global Config
    if !ExeRouteContextValid(generation)
        return false
    if ProbeWorkTarget(mode, generation)
        return true
    if !ExeRouteCameraStep(generation, 0, Config.workViewMouseDirection * 2200)
        return false
    Sleep 200
    return ExeRouteContextValid(generation) && ProbeWorkTarget(mode, generation)
}


; This receipt reports observations. It is never authority to replay an item transfer.
NewStorageCycleProof(generation, mode) {
    return {generation: generation, mode: mode, phase: "departure", complete: false,
        reason: "", updatedAt: A_NowUTC}
}

AdvanceStorageCycleProof(proof, phase) {
    if !IsObject(proof) || proof.complete || proof.phase = "stopped"
        return false
    next := proof.phase = "departure" ? "truck_arrived"
        : proof.phase = "truck_arrived" ? "deposit_verified"
        : proof.phase = "deposit_verified" ? (proof.mode = "washing" ? "refill_verified" : "work_arrived")
        : proof.phase = "refill_verified" ? "work_arrived"
        : proof.phase = "work_arrived" ? "resumed_verified" : ""
    if phase != next
        return false
    proof.phase := phase
    proof.updatedAt := A_NowUTC
    proof.complete := phase = "resumed_verified"
    return true
}

StorageCycleProofJson(proof) {
    if !IsObject(proof)
        return "null"
    return '{"mode":' JsonQuote(proof.mode) ',"phase":' JsonQuote(proof.phase)
        . ',"complete":' (proof.complete ? "true" : "false")
        . ',"reason":' JsonQuote(proof.reason) ',"updatedAt":' JsonQuote(proof.updatedAt) '}'
}

ObserveStorageCycle(generation, phase, reason := "") {
    global LocalNav, State
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentRun(generation)
            return false
        if phase = "departure"
            LocalNav.cycle := NewStorageCycleProof(generation, State.runMode)
        else {
            proof := LocalNav.cycle
            if !IsObject(proof) || proof.generation != generation
                return false
            if phase = "stopped" && !proof.complete {
                proof.phase := "stopped"
                proof.reason := SubStr(reason, 1, 200)
                proof.updatedAt := A_NowUTC
            } else if !AdvanceStorageCycleProof(proof, phase) {
                WriteDiagnostic("CYCLE_PROOF_REJECTED phase=" phase " previous=" proof.phase)
                return false
            }
        }
        try {
            output := LocalNav.root "\last-cycle.json"
            temp := output ".tmp"
            if FileExist(temp)
                FileDelete temp
            FileAppend StorageCycleProofJson(LocalNav.cycle), temp, "UTF-8-RAW"
            FileMove temp, output, true
        } catch as err {
            WriteDiagnostic("CYCLE_PROOF_SAVE_ERROR=" err.Message)
        }
        WriteDiagnostic("CYCLE_PROOF phase=" phase " mode=" State.runMode)
        QueueWebUiFlush(true)
        return true
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

ValidateStorageCycleProof() {
    for mode in ["mining", "washing", "gold"] {
        Loop 100 {
            proof := NewStorageCycleProof(7, mode)
            if AdvanceStorageCycleProof(proof, "resumed_verified") || proof.complete
                return false
            if !AdvanceStorageCycleProof(proof, "truck_arrived") || !AdvanceStorageCycleProof(proof, "deposit_verified")
                return false
            if mode = "washing" {
                if AdvanceStorageCycleProof(proof, "work_arrived") || !AdvanceStorageCycleProof(proof, "refill_verified")
                    return false
            }
            if !AdvanceStorageCycleProof(proof, "work_arrived") || proof.complete
                return false
            if !AdvanceStorageCycleProof(proof, "resumed_verified") || !proof.complete
                return false
            if AdvanceStorageCycleProof(proof, "resumed_verified")
                return false
        }
    }
    return true
}
