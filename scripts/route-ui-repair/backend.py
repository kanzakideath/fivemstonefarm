from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
def read(name): return (ROOT / name).read_text(encoding='utf-8-sig')
def write(name, value): (ROOT / name).write_text(value, encoding='utf-8', newline='\n')
def once(text, before, after):
    if text.count(before) != 1: raise RuntimeError('Unexpected source boundary: ' + before[:100])
    return text.replace(before, after)

name = 'src/mining-auto.ahk'
t = read(name)
t = once(t, 'dialog: 0, lastBatchKey:', 'dialog: 0, guide: 0, feedback: "", requestActive: false, lastBatchKey:')
t = once(t, '"stone", true, "update", true)', '"stone", true, "routes", true, "update", true)')
t = once(t, '    OnMessage(0x004A, ReceiveWebUiCopyData)', '    Hotkey "^!r", OpenExeRouteSettings\n    OnMessage(0x004A, ReceiveWebUiCopyData)')
t = once(t, '    A_TrayMenu.Add("キー・動作設定", ShowSettings)', '    A_TrayMenu.Add("自動収納のルート設定", OpenExeRouteSettings)\n    A_TrayMenu.Add("キー・動作設定", ShowSettings)')
t = once(t, 'ProcessWebUiActions(*) {\n    global State, Config', 'ProcessWebUiActions(*) {\n    global State, Config, LocalNav')
t = once(t, '            } else if action = "vehicle.delete" && parts.Length = 3 {', '''            } else if (action = "route.teach" || action = "route.trial") && parts.Length = 4 {
                mode := parts[4]
                if mode != "mining" && mode != "washing" && mode != "gold"
                    continue
                if State.running || State.registrationActive || State.startInProgress || LocalNav.busy {
                    LocalNav.feedback := "作業・登録中です。F9で停止してから設定してください。"
                } else if mode != Config.actionMode {
                    LocalNav.feedback := "作業の選択が変わりました。現在の作業を確認して、もう一度開始してください。"
                } else if State.visualTest {
                    LocalNav.feedback := "表示テストです。実際のFiveM操作は開始しません。"
                } else
                    RequestExeRouteSetup(action = "route.teach" ? "teach" : "trial", mode)
            } else if action = "vehicle.delete" && parts.Length = 3 {''')
t = once(t, '            WriteDiagnostic("UI_ACTION_ERROR action=" action " error=" err.Message)', '''            WriteDiagnostic("UI_ACTION_ERROR action=" action " error=" err.Message)
            if InStr(action, "route") {
                LocalNav.feedback := "ルート設定を開けませんでした：" err.Message
                ShowPage("routes")
            }''')
anchor = "        . ',\"controls\":{' controlsJson '}}'"
t = once(t, anchor, "        . ',\"routes\":' ExeRouteSetupStateJson(actionMode)\n" + anchor)
write(name, t)

name = 'src/ui-host/Protocol.cs'
t = read(name)
t = once(t, 'GetEnum(payload, "page", "overview", "stone", "vehicle", "settings", "update")', 'GetEnum(payload, "page", "overview", "stone", "vehicle", "routes", "settings", "update")')
t = once(t, '                    case "action.select":', '                    case "route.teach":\n                    case "route.trial":\n                    case "action.select":')
checks = r'''                AssertAction(@"{""type"":""action"",""action"":""nav"",""payload"":{""page"":""routes""}}",
                    "nav", new[] { "routes" });
                AssertAction(@"{""type"":""action"",""action"":""route.teach"",""payload"":{""mode"":""washing""}}",
                    "route.teach", new[] { "washing" });
                AssertAction(@"{""type"":""action"",""action"":""route.trial"",""payload"":{""mode"":""gold""}}",
                    "route.trial", new[] { "gold" });
                AssertAction(@"{""type"":""action"",""action"":""vehicle.route"",""payload"":{}}",
                    "vehicle.route", new string[0]);
                AssertRejected(@"{""type"":""action"",""action"":""route.teach"",""payload"":{""mode"":""external""}}");
                AssertRejected(@"{""type"":""action"",""action"":""route.trial"",""payload"":{""mode"":""gold"",""command"":""bad""}}");
'''
t = once(t, '                const string settingsFixture = ', checks + '                const string settingsFixture = ')
write(name, t)
name = 'src/ui-host/Program.cs'
t = read(name)
t = t.replace('"overview", "action-sheet", "settings", "vehicle", "update", "narrow",', '"overview", "action-sheet", "settings", "vehicle", "routes", "update", "narrow",')
t = once(t, '                    case "vehicle":\n', '                    case "routes":\n                        return "https://app.local/index.html?fixture=1&page=routes";\n                    case "vehicle":\n')
t = once(t, ': scene == "vehicle"\n', ': scene == "routes"\n                                    ? "https://app.local/index.html?fixture=1&page=routes"\n                                : scene == "vehicle"\n')
write(name, t)

name = 'src/exe-route-navigation.ahk'
t = read(name)
functions = r'''
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
            && IniRead(meta, "Route", "StorageId", "") = Config.vehicleStorageId
            && IniRead(meta, "Route", "StorageType", "") = Config.vehicleStorageType
        recorded := bound && !!FileExist(root "\outbound.json") && !!FileExist(root "\return.json")
        trialSaved := recorded && IniRead(meta, "Route", "Verified", "0") = "1"
            && !!FileExist(root "\outbound.verified") && !!FileExist(root "\return.verified")
    }
    return '{"hasVehicle":' (hasVehicle ? "true" : "false")
        . ',"recorded":' (recorded ? "true" : "false")
        . ',"trialSaved":' (trialSaved ? "true" : "false")
        . ',"busy":' ((LocalNav.busy || LocalNav.requestActive) ? "true" : "false")
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
'''
t = once(t, '\nShowExeRoutePanel(', functions + '\nShowExeRoutePanel(')
t = once(t, '''    if State.running || State.registrationActive || State.startInProgress
        || LocalNav.busy
        return''', '''    if State.running || State.registrationActive || State.startInProgress || LocalNav.busy {
        LocalNav.feedback := "作業・登録中です。F9で停止してからルート設定を開いてください。"
        QueueWebUiFlush(true)
        return
    }''')
t = once(t, '    panel.SetFont("s10", "Yu Gothic UI")', '''    panel.SetFont("s10", "Yu Gothic UI")
    panel.AddButton("w640 h40", "ルート設定の専用画面を開く").OnEvent("Click", (*) => (panel.Hide(), OpenExeRouteSettings()))''')
t = t.replace('.OnEvent("Click", TeachExeRoute)', '.OnEvent("Click", RequestExeRouteSetup.Bind("teach", Config.actionMode))')
t = t.replace('.OnEvent("Click", TrialExeRoute)', '.OnEvent("Click", RequestExeRouteSetup.Bind("trial", Config.actionMode))')
t = once(t, '"LOCAL_ROUTE_SETUP_REQUIRED")\n        return false', '"LOCAL_ROUTE_SETUP_REQUIRED")\n        ShowPage("routes")\n        return false')
t = once(t, '    try {\n        if !ReleaseBackgroundTarget(true) || RunBridgeForContext', '    try {\n        HideExeSetupGuide()\n        if !ReleaseBackgroundTarget(true) || RunBridgeForContext')
t = once(t, '    CancelExeRouteOperation()\n    ReleaseBackgroundTarget(true)', '    CancelExeRouteOperation()\n    HideExeSetupGuide()\n    ReleaseBackgroundTarget(true)')
t = once(t, '''    State.vehicleStatusLabel.Text := message
    ShowMainWindow()
    QueueWebUiFlush(true)
    MsgBox message, "EXE徒歩ルート"''', '''    State.vehicleStatusLabel.Text := message
    LocalNav.feedback := message
    ShowPage("routes")
    ShowMainWindow()
    QueueWebUiFlush(true)''')
t = once(t, '    try {\n        if !ProbeExeRouteWork(0, Config.actionMode)', '    try {\n        SetExeSetupGuide("準備：作業現場を確認中", "選択した作業のボタンが出る位置に立ってください。")\n        if !ProbeExeRouteWork(0, Config.actionMode)')
t = once(t, '''        if !ProbeExeRouteCargo(0, &id, &type)
            || id != Config.vehicleStorageId || type != Config.vehicleStorageType
            throw Error("終点で登録した荷台を確認できません。記録は保存しません。")''', '''        SetExeSetupGuide("往路の終点：荷台を確認中", "登録した荷台IDを照合しています。完了後は復路の案内に切り替わります。")
        if !ProbeExeRouteCargo(0, &id, &type)
            || id != Config.vehicleStorageId || type != Config.vehicleStorageType
            throw Error("終点で登録した荷台を確認できません。記録は保存しません。")''')
t = once(t, '        TrayTip "次は同じ作業現場へ歩いて戻り、到着したらF7を押してください。", "復路を記録します", 1', '        SetExeSetupGuide("次は復路：荷台 → 同じ作業現場", "これから帰り道を記録します。元の作業位置へ歩いて戻り、停止してF7。")\n        Sleep 1600')
t = once(t, '''        if !ProbeExeRouteWork(0, Config.actionMode)
            throw Error("復路終点で作業ボタンを確認できません。正しい現場で記録してください。")''', '''        SetExeSetupGuide("復路の終点：作業場所を確認中", "元の現場の作業ボタンを確認しています。まだアイテムは移動しません。")
        if !ProbeExeRouteWork(0, Config.actionMode)
            throw Error("復路終点で作業ボタンを確認できません。正しい現場で記録してください。")''')
t = once(t, '''        if !ProbeExeRouteCargo(0, &id, &type)
            || id != Config.vehicleStorageId || type != Config.vehicleStorageType
            throw Error("試走終点の荷台IDが一致しません。歩行を成功扱いにしません。")''', '''        SetExeSetupGuide("試走 1/2：到着先の荷台を確認", "荷台IDを照合します。試走では収納も補充もしません。")
        if !ProbeExeRouteCargo(0, &id, &type)
            || id != Config.vehicleStorageId || type != Config.vehicleStorageType
            throw Error("試走終点の荷台IDが一致しません。歩行を成功扱いにしません。")''')
t = once(t, '''        if !ProbeExeRouteWork(0, Config.actionMode)
            throw Error("元の現場の作業ボタンを確認できません。経路を短い区間で記録し直してください。")''', '''        SetExeSetupGuide("試走 2/2：帰還先の作業場所を確認", "最後の確認です。作業ボタンの確認後に試走結果を保存します。")
        if !ProbeExeRouteWork(0, Config.actionMode)
            throw Error("元の現場の作業ボタンを確認できません。経路を短い区間で記録し直してください。")''')
write(name, t)
for name in ['src/mining-auto.ahk', 'README.md', 'src/README.md', 'docs/AI採掘機_使い方.txt', 'config/AI採掘機.ini', 'src/ui-web/package.json', 'src/ui-web/package-lock.json', 'src/ui-web/src/app.js', 'src/ui-web/README.md', 'src/ui-web/screenshots/README.md']:
    write(name, read(name).replace('9.1.8', '9.1.9'))
print('Guarded backend setup actions and version markers applied.')
