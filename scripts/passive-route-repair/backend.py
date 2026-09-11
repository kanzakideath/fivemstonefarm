from pathlib import Path
R = Path(__file__).resolve().parents[2]
p = R/'src/exe-route-navigation.ahk'
s = p.read_text(encoding='utf-8-sig')
def replace(old,new):
    global s
    if s.count(old)!=1: raise RuntimeError('Backend boundary: '+old[:100])
    s=s.replace(old,new)
replace('    trialSaved := false\n    try {','    trialSaved := false\n    method := "walking"\n    try {')
replace('''        recorded := bound && !!FileExist(root "\\outbound.json") && !!FileExist(root "\\return.json")
        trialSaved := recorded && ExeRouteFilesMatch(root)
            && IniRead(meta, "Route", "Verified", "0") = "1"''','''        method := IniRead(meta, "Route", "Method", "walking")
        recorded := bound && (method = "stationary"
            ? IniRead(meta, "Route", "Schema", "0") = "2"
            : !!FileExist(root "\\outbound.json") && !!FileExist(root "\\return.json"))
        trialSaved := recorded && (method = "stationary" || ExeRouteFilesMatch(root))
            && IniRead(meta, "Route", "Verified", "0") = "1"''')
replace("        . ',\"cycle\":' StorageCycleProofJson(LocalNav.cycle)", "        . ',\"method\":' JsonQuote(method)\n        . ',\"cycle\":' StorageCycleProofJson(LocalNav.cycle)")
replace('''        else if operation = "trial"
            TrialExeRoute()''','''        else if operation = "trial"
            TrialExeRoute()
        else if operation = "stationary"
            SetupStationaryStorage()''')
replace('''            if !(FileRead(file, "UTF-8") == FileRead(proof, "UTF-8"))
                return false''',r'''            content := FileRead(file, "UTF-8")
            if !RegExMatch(content, '"schema"\s*:\s*2\b')
                || !InStr(content, '"recorded-view"')
                || !(content == FileRead(proof, "UTF-8"))
                return false''')
replace('''            && ExeRouteFilesMatch(root)
    } catch
        return false
}''','''            && (IniRead(meta, "Route", "Method", "walking") = "stationary"
                ? IniRead(meta, "Route", "Schema", "0") = "2"
                : ExeRouteFilesMatch(root))
    } catch
        return false
}''')
replace('''    return IsCurrentRun(expectedGeneration)
}

ExeRouteContextValid''','''    if ExeStorageMethod(State.runMode) = "stationary"
        WriteDiagnostic("STATIONARY_MODE_READY liveCargoCheckRequired=1")
    return IsCurrentRun(expectedGeneration)
}

ExeStorageMethod(mode) {
    try return IniRead(ExeRouteModeRoot(mode) "\\route.ini", "Route", "Method", "walking")
    catch
        return "walking"
}

ExeRouteContextValid''')
replace('''    LocalNav.feedback := message
    ShowPage("routes")''','''    LocalNav.feedback := message
    try {
        FileAppend A_NowUTC " " message "`n", LocalNav.root "\\setup-diagnostics.log", "UTF-8"
    }
    ShowPage("routes")''')
replace('''        IniWrite "0", meta, "Route", "Verified"
        FileMove outPath''','''        IniWrite "0", meta, "Route", "Verified"
        IniWrite "walking", meta, "Route", "Method"
        IniWrite "2", meta, "Route", "Schema"
        FileMove outPath''')
replace('''TrialExeRoute(*) {
    global State, Config
    if !BeginExeRouteSetupContext()''','''TrialExeRoute(*) {
    global State, Config
    if ExeStorageMethod(Config.actionMode) = "stationary" {
        SetupStationaryStorage()
        return
    }
    if !BeginExeRouteSetupContext()''')
replace('''    if !ValidateServerEpochCheckpoint(generation, "exe_route_" leg)
        return false
    result := RunExeRouteHelper''','''    if !ValidateServerEpochCheckpoint(generation, "exe_route_" leg)
        return false
    if ExeStorageMethod(State.runMode) = "stationary" {
        ; No input. Caller must still verify the live cargo/work endpoint.
        WriteDiagnostic("STATIONARY_LEG_NO_INPUT leg=" leg)
        return IsCurrentRun(generation)
    }
    result := RunExeRouteHelper''')
a=s.index('ProbeExeRouteCargo(generation,'); b=s.index('\n\n; This receipt',a)
s=s[:a]+r'''ProbeExeRouteCargo(generation, &storageId, &storageType) {
    global State, Config
    storageId := ""
    storageType := ""
    ; Probe only the current view; no unrecorded pitch sweep or second cargo.
    if !ExeRouteContextValid(generation)
        return false
    if !OpenStorageAndCapture(&id, &type, generation, &fatal)
        return false
    if !ExeRouteContextValid(generation)
        return false
    if id != Config.vehicleStorageId || type != Config.vehicleStorageType {
        CloseLocalStorageUi()
        WriteDiagnostic("EXE_ROUTE_WRONG_CARGO")
        return false
    }
    storageId := id
    storageType := type
    return true
}

ProbeExeRouteWork(generation, mode) {
    return ExeRouteContextValid(generation) && ProbeWorkTarget(mode, generation)
}

StationaryCargoProbe(generation) {
    return ProbeExeRouteCargo(generation, &id, &type)
}

; Shared real/test workflow. No move, camera or item-transfer callback exists.
EvaluateStationarySpot(guard, work, cargo, close) {
    try {
        if !guard.Call()
            return "CANCELLED"
        if !work.Call() || !guard.Call()
            return "WORK_NOT_VISIBLE"
        if !cargo.Call() || !guard.Call()
            return "REGISTERED_CARGO_NOT_VISIBLE"
        if !close.Call() || !guard.Call()
            return "UI_NOT_CLOSED"
        if !work.Call() || !guard.Call()
            return "WORK_NOT_VISIBLE_AFTER_CARGO"
        return "STATIONARY_VERIFIED"
    } finally {
        if guard.Call()
            close.Call()
    }
}

SetupStationaryStorage(*) {
    global State, Config, LocalNav
    if MsgBox("徒歩ルートを使わず、同じ立ち位置から作業と荷台を操作する設定です。`n`n画面に作業ボタンと登録した荷台のボタンが出る位置・視点にしてください。石洗いは未洗浄石を持ってください。`n移動・視点変更・アイテムの転送は行わず、作業→登録荷台→作業を確認します。`n確認に成功しても自動収納ONは別操作です。", "近接収納の確認（移動なし）", "OKCancel") != "OK"
        return
    if !BeginExeRouteSetupContext()
        return
    root := ExeRouteModeRoot(Config.actionMode)
    meta := root "\route.ini"
    temp := root "\stationary.tmp.ini"
    epoch := State.serverEpoch
    message := "近接収納の確認は未完了です。自動収納は有効にしていません。"
    try {
        IniWrite "0", meta, "Route", "Verified"
        SetExeSetupGuide("近接収納：移動せずに確認中", "作業ボタン → 登録した荷台ID → 作業ボタンを確認します。視点を動かさず待ってください。")
        result := EvaluateStationarySpot(ExeRouteContextValid.Bind(0),
            ProbeExeRouteWork.Bind(0, Config.actionMode), StationaryCargoProbe.Bind(0), CloseLocalStorageUi)
        if result != "STATIONARY_VERIFIED"
            throw Error("近接確認停止：" ExeRouteErrorMessage(result))
        if !ParseServerHealth(RunBackgroundBridge("health"), &liveEpoch)
            || liveEpoch != epoch || !ExeRouteContextValid(0)
            throw Error("接続変更／中止を検出したため、近接確認を保存しません。")
        if FileExist(temp)
            FileDelete temp
        IniWrite "2", temp, "Route", "Schema"
        IniWrite "stationary", temp, "Route", "Method"
        IniWrite Config.vehicleStorageId, temp, "Route", "StorageId"
        IniWrite Config.vehicleStorageType, temp, "Route", "StorageType"
        IniWrite epoch, temp, "Route", "Epoch"
        IniWrite "1", temp, "Route", "Verified"
        FileMove temp, meta, true
        message := "近接収納を確認しました。歩かず・視点を動かさず登録荷台へ収納／石補充を行います。「自動収納・補充をON」にしてください。実行時も毎回荷台IDと転送結果を確認します。"
    } catch as err {
        message := err.Message
    } finally {
        try FileDelete temp
        FinishExeRouteSetupContext(message)
    }
}

ValidateStationaryWorkflow() {
    for failAt in [0, 1, 2, 3, 4] {
        trace := []
        probe := (name, *) => (trace.Push(name), trace.Length != failAt)
        result := EvaluateStationarySpot(() => true, probe.Bind("work"), probe.Bind("cargo"), probe.Bind("close"))
        if (failAt = 0) != (result = "STATIONARY_VERIFIED")
            return false
        if failAt && trace.Length > failAt + 1
            return false
    }
    calls := []
    result := EvaluateStationarySpot(() => false, (*) => calls.Push("work"),
        (*) => calls.Push("cargo"), (*) => calls.Push("close"))
    return result = "CANCELLED" && calls.Length = 0
}
'''+s[b:]
replace('ExeRouteErrorMessage(result) {',r'''ExeRouteErrorMessage(result) {
    if InStr(result, "LEGACY_ROUTE")
        return "旧ルートは今回の自然視点方式で再記録してください。荷台がその場で開く場合は近接収納を確認できます。 [" result "]"
    if InStr(result, "WORK_NOT_VISIBLE")
        return "今の視点で作業ボタンを確認できません。手動で見える向きにして再確認してください。石洗いは手持ち石も必要です。 [" result "]"
    if InStr(result, "REGISTERED_CARGO_NOT_VISIBLE")
        return "今の位置・視点で登録荷台を確認できません。作業と荷台の両方に届く位置にするか徒歩ルートを記録してください。 [" result "]"
    if InStr(result, "UI_NOT_CLOSED")
        return "荷台画面を閉じたことを確認できません。ゲーム画面を確認してください。 [" result "]"
    if InStr(result, "RECORDING_LAG")
        return "移動中の記録が遅延したため停止しました。低負荷状態で短い区間を再記録してください。アプリの再起動ではありません。 [" result "]"
    if InStr(result, "RECORDING_MOVED_DURING")
        return "目印の撮影中に移動を検出しました。保存完了まで一度止まってください。 [" result "]"
    if InStr(result, "ROUTE_BUDGET_OR_NO_WALK")
        return "徒歩区間が記録されていません。荷台がその場で開く場合は近接収納を使用してください。 [" result "]"''')
replace('4秒以内ごとに立ち止まり、照合用の景色を保存してください。`n記録中は','各片道の準備画面でF6を押して記録開始。視点は勝手に動かしません。`n4秒以内ごとに立ち止まり、照合用の景色を保存してください。`n記録中は')
replace('    panel.AddText("y+10 w640", "現在の作業："', '    panel.AddButton("y+12 w640 h40", "この位置で近接収納を確認（歩かない）").OnEvent("Click", RequestExeRouteSetup.Bind("stationary", Config.actionMode))\n    panel.AddText("y+10 w640", "現在の作業："')
p.write_text(s,encoding='utf-8',newline='\n')
p=R/'src/mining-auto.ahk';s=p.read_text(encoding='utf-8-sig')
replace('(action = "route.teach" || action = "route.trial")','(action = "route.teach" || action = "route.trial" || action = "route.stationary")')
replace('RequestExeRouteSetup(action = "route.teach" ? "teach" : "trial", mode)','RequestExeRouteSetup(action = "route.teach" ? "teach" : action = "route.stationary" ? "stationary" : "trial", mode)')
replace('if !ValidateStorageCycleProof() {','if !ValidateStorageCycleProof() || !ValidateStationaryWorkflow() {')
replace('''            } else if action = "action.select" && parts.Length = 4 {
                mode := parts[4]''','''            } else if action = "action.select" && parts.Length = 4 {
                if LocalNav.busy || LocalNav.requestActive || State.registrationActive
                    continue
                mode := parts[4]''')
p.write_text(s,encoding='utf-8',newline='\n')
p=R/'src/ui-host/Protocol.cs';s=p.read_text(encoding='utf-8-sig')
replace('                    case "route.trial":','                    case "route.trial":\n                    case "route.stationary":')
replace('''                AssertRejected(@"{""type"":""action"",""action"":""route.teach"",""payload"":{""mode"":""external""}}");''','''                AssertAction(@"{""type"":""action"",""action"":""route.stationary"",""payload"":{""mode"":""washing""}}",
                    "route.stationary", new[] { "washing" });
                AssertRejected(@"{""type"":""action"",""action"":""route.stationary"",""payload"":{""mode"":""external""}}");
                AssertRejected(@"{""type"":""action"",""action"":""route.teach"",""payload"":{""mode"":""external""}}");''')
p.write_text(s,encoding='utf-8',newline='\n')
print('Explicit stationary workflow and passive endpoint checks applied; validation required.')
