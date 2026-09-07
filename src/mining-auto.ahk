#Requires AutoHotkey v2.0
#SingleInstance Force

Persistent
SendMode "Event"
SetMouseDelay 25
SetKeyDelay 25, 25
SetTitleMatchMode 2
CoordMode "Pixel", "Screen"
CoordMode "Mouse", "Screen"
Thread "Interrupt", 0

global AppVersion := "5.2.0"
processId := DllCall("GetCurrentProcessId")
buttonTemplatePath := A_Temp "\codex-mining-button-" processId ".png"
windowedButtonTemplatePath := A_Temp "\codex-mining-button-windowed-" processId ".png"
hungerTemplatePath := A_Temp "\codex-hunger-icon-" processId ".png"
stoneMarkerTemplatePath := A_Temp "\codex-stone-marker-" processId ".png"
backgroundBridgePath := A_Temp "\ai-miner-background-" processId ".exe"
backgroundResultPath := A_Temp "\ai-miner-background-result-" processId ".txt"
updaterHelperPath := A_Temp "\ai-miner-updater-" processId ".exe"
FileInstall "mining-button-template.png", buttonTemplatePath, true
FileInstall "mining-button-template-windowed.png", windowedButtonTemplatePath, true
FileInstall "hunger-icon-template.png", hungerTemplatePath, true
FileInstall "stone-marker-template.png", stoneMarkerTemplatePath, true
FileInstall "AI採掘機_Background.exe", backgroundBridgePath, true
FileInstall "AI採掘機_Updater.exe", updaterHelperPath, true
settingsPath := A_ScriptDir "\AI採掘機.ini"
legacySettingsPath := A_ScriptDir "\自動採掘マクロ.ini"
if !FileExist(settingsPath) && FileExist(legacySettingsPath) {
    try FileCopy legacySettingsPath, settingsPath, false
    catch
        settingsPath := legacySettingsPath
}
updateSettingsSchema := ReadIntegerSetting(settingsPath, "Updates", "Schema", 0, 0, 1)

global Config := {
    actionMode: ReadActionMode(settingsPath),
    backgroundMode: ReadIntegerSetting(settingsPath, "General", "BackgroundMode", 1, 0, 1),
    hideWhileRunning: ReadIntegerSetting(settingsPath, "General", "HideWhileRunning", 1, 0, 1),
    startHotkey: ReadTextSetting(settingsPath, "Controls", "StartHotkey", "F8"),
    stopHotkey: ReadTextSetting(settingsPath, "Controls", "StopHotkey", "F9"),
    updateSettingsSchema: updateSettingsSchema,
    autoCheckUpdates: updateSettingsSchema < 1 ? 1
        : ReadIntegerSetting(settingsPath, "Updates", "AutoCheck", 1, 0, 1),
    resetWaitMs: ReadTiming(settingsPath, "ResetWaitMs", 180, 50, 2000),
    altBeforeRightMs: ReadTiming(settingsPath, "AltBeforeRightMs", 220, 50, 3000),
    menuOpenWaitMs: ReadTiming(settingsPath, "MenuOpenWaitMs", 650, 100, 5000),
    searchTimeoutMs: ReadTiming(settingsPath, "SearchTimeoutMs", 1600, 200, 10000),
    searchPollMs: ReadTiming(settingsPath, "SearchPollMs", 120, 50, 1000),
    cursorSettleMs: ReadTiming(settingsPath, "CursorSettleMs", 60, 40, 1000),
    hoverBeforeClickMs: ReadTiming(settingsPath, "HoverBeforeClickMs", 180, 30, 2000),
    leftHoldMs: ReadTiming(settingsPath, "LeftHoldMs", 75, 30, 1000),
    afterLeftUpMs: ReadTiming(settingsPath, "AfterLeftUpMs", 120, 30, 2000),
    rightToAltReleaseMs: ReadTiming(settingsPath, "RightToAltReleaseMs", 120, 30, 2000),
    miningCompleteWaitMs: ReadTiming(settingsPath, "MiningCompleteWaitMs", 5200, 3000, 15000),
    stoneProbeSearchMs: ReadTiming(settingsPath, "StoneProbeSearchMs", 500, 150, 3000),
    stoneProbeRetryMs: ReadTiming(settingsPath, "StoneProbeRetryMs", 300, 100, 3000),
    stoneGoneConfirmations: ReadTiming(settingsPath, "StoneGoneConfirmations", 3, 1, 5),
    stoneReadyConfirmations: ReadTiming(settingsPath, "StoneReadyConfirmations", 2, 1, 5),
    stoneResyncAfterMs: ReadTiming(settingsPath, "StoneResyncAfterMs", 12000, 8000, 60000),
    markerFallbackAfterMs: ReadTiming(settingsPath, "MarkerFallbackAfterMs", 20000, 10000, 120000),
    notFoundRetryMs: ReadTiming(settingsPath, "NotFoundRetryMs", 750, 100, 10000),
    inactiveRetryMs: 500,
    autoEat: ReadIntegerSetting(settingsPath, "Eating", "AutoEat", 1, 0, 1),
    foodKey: ReadFoodKey(settingsPath),
    hungerCheckIntervalMs: ReadIntegerSetting(settingsPath, "Eating", "HungerCheckIntervalMs", 3000, 500, 60000),
    hungerConfirmFrames: ReadIntegerSetting(settingsPath, "Eating", "HungerConfirmFrames", 3, 1, 7),
    hungerConfirmGapMs: ReadIntegerSetting(settingsPath, "Eating", "HungerConfirmGapMs", 90, 40, 1000),
    foodKeyHoldMs: ReadIntegerSetting(settingsPath, "Eating", "FoodKeyHoldMs", 90, 30, 1000),
    eatAnimationMs: ReadIntegerSetting(settingsPath, "Eating", "EatAnimationMs", 6500, 500, 30000),
    gaugeSettleMs: ReadIntegerSetting(settingsPath, "Eating", "GaugeSettleMs", 1200, 0, 10000),
    eatCooldownMs: ReadIntegerSetting(settingsPath, "Eating", "EatCooldownMs", 45000, 5000, 300000),
    postEatResumeMs: ReadIntegerSetting(settingsPath, "Eating", "PostEatResumeMs", 350, 100, 5000),
    washCycleMs: ReadIntegerSetting(settingsPath, "Washing", "CycleMs", 9000, 7000, 20000),
    washForwardCorrection: ReadIntegerSetting(settingsPath, "Washing", "ForwardCorrection", 1, 0, 1),
    washForwardPulseMs: ReadIntegerSetting(settingsPath, "Washing", "ForwardPulseMs", 100, 50, 250),
    washForwardSettleMs: ReadIntegerSetting(settingsPath, "Washing", "ForwardSettleMs", 250, 50, 3000),
    goldCycleMs: ReadIntegerSetting(settingsPath, "GoldPanning", "CycleMs", 6000, 4000, 15000)
}

; v5.1以前の「未設定なので無効」という仮設定だけを、安全な署名付き更新へ移行します。
needsUpdateSettingsMigration := Config.updateSettingsSchema < 1
if needsUpdateSettingsMigration {
    Config.updateSettingsSchema := 1
    Config.autoCheckUpdates := 1
}

global State := {
    running: false,
    runMode: "mining",
    generation: 0,
    timerFn: 0,
    targetHwnd: 0,
    buttonTemplates: [
        {path: buttonTemplatePath, width: 220, height: 42, clickOffsetX: 194, clickOffsetY: 21},
        {path: windowedButtonTemplatePath, width: 239, height: 43, clickOffsetX: 210, clickOffsetY: 21}
    ],
    hungerTemplatePath: hungerTemplatePath,
    stoneMarkerTemplatePath: stoneMarkerTemplatePath,
    backgroundBridgePath: backgroundBridgePath,
    backgroundResultPath: backgroundResultPath,
    updaterPath: updaterHelperPath,
    updateRoot: EnvGet("LOCALAPPDATA") "\AI採掘機\updates",
    updateOperation: "",
    updateResultPath: "",
    updateStageDir: "",
    updateManifestPath: "",
    updateSignaturePath: "",
    updateVersion: "",
    updateNotesUrl: "",
    updateSilent: false,
    updateProcessId: 0,
    updateDeadline: 0,
    updatePollFn: 0,
    updateApplying: false,
    hungerTemplateWidth: 37,
    hungerTemplateHeight: 36,
    hungerCenterOffsetX: 18,
    hungerCenterOffsetY: 17,
    hungerRingRadius: 33,
    altHeld: false,
    rightHeld: false,
    leftHeld: false,
    foodHeld: false,
    successes: 0,
    attempts: 0,
    meals: 0,
    nudges: 0,
    washNudgePending: false,
    waitingForStone: false,
    stoneGoneObserved: false,
    stoneAbsentVotes: 0,
    stoneReadyVotes: 0,
    lastMineAt: 0,
    lastMarkerX: 0,
    lastMarkerY: 0,
    nextHungerCheckAt: 0,
    nextEatAllowedAt: 0,
    diagnosticPath: A_ScriptDir "\AI採掘機_診断.log",
    diagnosticLines: 0,
    startHotIf: 0,
    stopHotIf: 0,
    registeredStartHotkey: "",
    registeredStopHotkey: "",
    settingsGui: 0,
    backgroundTargetActive: false,
    backgroundDevConPort: 0,
    lastDevConPort: 0,
    bridgeCallId: 0,
    lastBridgeError: ""
}

; コンパイル前後の構文・埋め込み画像チェック用です。
if A_Args.Length && A_Args[1] = "--validate" {
    updaterCapabilities := RunUpdaterCapabilities()
    exitCode := !FileExist(State.buttonTemplates[1].path) ? 11
        : !FileExist(State.buttonTemplates[2].path) ? 12
        : !FileExist(State.hungerTemplatePath) ? 13
        : !FileExist(State.stoneMarkerTemplatePath) ? 14
        : !FileExist(State.backgroundBridgePath) ? 15
        : !FileExist(State.updaterPath) ? 16
        : MonotonicMs() <= 0 ? 17
        : RunBackgroundBridge("capabilities") != "CAPS 3 MINE WASH GOLD NUDGE" ? 18
        : updaterCapabilities != "UPDATE_CAPS 1 CHECK DOWNLOAD APPLY" ? 19
        : !IsSafeConfiguredHotkey("F8") ? 20
        : IsSafeConfiguredHotkey("A") ? 21
        : !IsSafeConfiguredHotkey("^A") ? 22 : 0
    if exitCode = 19
        try FileAppend "UPDATER_CAPS=" updaterCapabilities "`r`n",
            State.diagnosticPath, "UTF-8"
    DeleteExtractedTemplates()
    ExitApp exitCode
}

if A_Args.Length && A_Args[1] = "--cursor-api-test" {
    ResetDiagnosticLog()
    apiTestOk := TestCursorMovementApis()
    DeleteExtractedTemplates()
    ExitApp(apiTestOk ? 0 : 3)
}

; 自己更新の--validate中は利用者のINIを変更せず、通常起動時だけ移行を書き込みます。
if needsUpdateSettingsMigration {
    try IniWrite 1, settingsPath, "Updates", "Schema"
    try IniWrite 1, settingsPath, "Updates", "AutoCheck"
}

BuildGui()
ConfigureTrayMenu()
try RegisterConfiguredHotkeys()
catch as err {
    ; 手編集されたINIのキーが壊れていても、アプリ自体は既定キーで起動します。
    Config.startHotkey := "F8"
    Config.stopHotkey := "F9"
    try {
        RegisterConfiguredHotkeys()
        State.footerLabel.Text := "開始 F8   /   停止 F9"
        State.statusLabel.Text := "●  無効なキー設定をF8 / F9へ戻しました"
    } catch as fallbackErr {
        State.statusLabel.Text := "●  ショートカット登録不可（画面から操作できます）"
        WriteDiagnostic("HOTKEY_FALLBACK_REGISTER_ERROR=" fallbackErr.Message)
    }
    try IniWrite Config.startHotkey, settingsPath, "Controls", "StartHotkey"
    try IniWrite Config.stopHotkey, settingsPath, "Controls", "StopHotkey"
    WriteDiagnostic("HOTKEY_FALLBACK=" err.Message)
}
OnExit Cleanup

if A_Args.Length && A_Args[1] = "--smoke-test" {
    State.gui.Hide()
    SetTimer((*) => ExitApp(0), -250)
}

if A_Args.Length && A_Args[1] = "--updated"
    State.statusLabel.Text := "●  v" AppVersion " への更新が完了しました"
else if A_Args.Length && A_Args[1] = "--update-failed"
    State.statusLabel.Text := "●  更新に失敗したため以前の版へ戻しました"
else if !A_Args.Length && Config.autoCheckUpdates && A_IsCompiled
    SetTimer((*) => BeginUpdateCheck(true), -1800)

BuildGui() {
    global State, Config, AppVersion

    State.gui := Gui("-MaximizeBox +MinSize420x440", "AI採掘機")
    State.gui.BackColor := "F2F2F7"
    State.gui.MarginX := 20
    State.gui.MarginY := 18
    State.gui.SetFont("s20 w600 c1D1D1F", "Yu Gothic UI")
    State.gui.AddText("x20 y16 w290 h35", "AI採掘機")
    State.gui.SetFont("s9 w400 c6E6E73", "Yu Gothic UI")
    State.gui.AddText("x330 y25 w70 Right", "v" AppVersion)
    State.taglineLabel := State.gui.AddText("x20 y54 w380 h24", "画面を奪わず、自動で採掘・石洗いを続けます")
    State.gui.AddText("x20 y84 w380 h1 BackgroundD1D1D6")

    State.gui.SetFont("s11 w600 c1D1D1F", "Yu Gothic UI")
    State.statusLabel := State.gui.AddText("x20 y101 w380 h42", "●  停止中")
    State.gui.SetFont("s9 w400 c515154", "Yu Gothic UI")
    State.connectionLabel := State.gui.AddText("x20 y146 w380 h22", "FiveM: 確認中")
    modeText := Config.backgroundMode ? "バックグラウンド操作: オン" : "バックグラウンド操作: オフ"
    State.modeLabel := State.gui.AddText("x20 y169 w380 h22", modeText)

    State.gui.SetFont("s9 w400 c6E6E73", "Yu Gothic UI")
    State.gui.AddText("x20 y198 w48 h24", "動作")
    State.gui.SetFont("s10 w400 c1D1D1F", "Yu Gothic UI")
    actionIndex := Config.actionMode = "washing" ? 2 : Config.actionMode = "gold" ? 3 : 1
    State.actionControl := State.gui.AddDropDownList("x70 y193 w330 Choose" actionIndex,
        ["鉱石を採掘する", "石を洗う", "砂金採りトレイ"])
    State.actionControl.OnEvent("Change", ChangeActionMode)

    State.gui.SetFont("s11 w600 c1D1D1F", "Yu Gothic UI")
    State.mainButton := State.gui.AddButton("x20 y235 w380 h46 Default", "自動操作を開始")
    State.mainButton.OnEvent("Click", ToggleMining)

    State.gui.SetFont("s10 w600 c1D1D1F", "Yu Gothic UI")
    State.countLabel := State.gui.AddText("x20 y300 w180 h26 Center", "採掘回数  0")
    State.mealLabel := State.gui.AddText("x220 y300 w180 h26 Center", "食事回数  0")
    State.gui.AddText("x20 y338 w380 h1 BackgroundD1D1D6")

    State.gui.SetFont("s9 w400 c1D1D1F", "Yu Gothic UI")
    State.settingsButton := State.gui.AddButton("x20 y355 w185 h38", "キー・動作設定")
    State.updateButton := State.gui.AddButton("x215 y355 w185 h38", "アップデート")
    State.settingsButton.OnEvent("Click", ShowSettings)
    State.updateButton.OnEvent("Click", CheckForUpdates)
    State.gui.SetFont("s9 w400 c6E6E73", "Yu Gothic UI")
    State.footerLabel := State.gui.AddText("x20 y405 w380 h20 Center",
        "開始 " Config.startHotkey "   /   停止 " Config.stopHotkey)

    State.gui.OnEvent("Close", (*) => ExitApp())
    State.gui.Show("w420 h445")
    ApplyRoundedWindowCorners(State.gui.Hwnd)
    UpdateActionUi()
    UpdateConnectionStatus()
}

ToggleMining(*) {
    global State
    if State.running
        StopMining()
    else
        StartMining()
}

CanStartFromHotkey(*) {
    activeHwnd := WinExist("A")
    return activeHwnd && IsFiveMWindow(activeHwnd)
}

IsMiningActive(*) {
    global State
    return State.running
}

ConfigureTrayMenu() {
    A_TrayMenu.Delete()
    A_TrayMenu.Add("AI採掘機を開く", ShowMainWindow)
    A_TrayMenu.Add()
    A_TrayMenu.Add("自動操作を開始 / 停止", ToggleMining)
    A_TrayMenu.Add("キー・動作設定", ShowSettings)
    A_TrayMenu.Add("アップデート", CheckForUpdates)
    A_TrayMenu.Add()
    A_TrayMenu.Add("終了", (*) => ExitApp())
    A_TrayMenu.Default := "AI採掘機を開く"
}

ShowMainWindow(*) {
    global State
    State.gui.Show("w420 h445")
    UpdateConnectionStatus()
}

ChangeActionMode(control, *) {
    global State, Config, settingsPath
    if State.running {
        control.Choose(State.runMode = "washing" ? 2 : State.runMode = "gold" ? 3 : 1)
        return
    }
    oldMode := Config.actionMode
    Config.actionMode := control.Value = 2 ? "washing" : control.Value = 3 ? "gold" : "mining"
    try IniWrite Config.actionMode, settingsPath, "General", "ActionMode"
    catch as err {
        Config.actionMode := oldMode
        control.Choose(oldMode = "washing" ? 2 : oldMode = "gold" ? 3 : 1)
        State.statusLabel.Text := "●  動作設定を保存できません"
        WriteDiagnostic("ACTION_SAVE_ERROR=" err.Message)
    }
    UpdateActionUi()
}

UpdateActionUi() {
    global State, Config
    actionMode := State.running ? State.runMode : Config.actionMode
    if actionMode = "washing" {
        State.countLabel.Text := "石洗い回数  " State.successes
        State.mealLabel.Text := "後退補正  " State.nudges
        State.taglineLabel.Text := "画面を奪わず、約9秒ごとに石を洗います"
    } else if actionMode = "gold" {
        State.countLabel.Text := "砂金採り回数  " State.successes
        State.mealLabel.Text := "周期  約6秒"
        State.taglineLabel.Text := "画面を奪わず、約6秒ごとに砂金を採ります"
    } else {
        State.countLabel.Text := "採掘回数  " State.successes
        State.mealLabel.Text := "食事回数  " State.meals
        State.taglineLabel.Text := "画面を奪わず、石の再出現を見て採掘します"
    }
}

ApplyRoundedWindowCorners(hwnd) {
    try {
        preference := Buffer(4, 0)
        NumPut "Int", 2, preference
        DllCall "dwmapi\DwmSetWindowAttribute", "Ptr", hwnd,
            "UInt", 33, "Ptr", preference.Ptr, "UInt", 4
    }
}

UpdateConnectionStatus(*) {
    global State, Config
    hwnd := FindFiveMWindow()
    State.connectionLabel.Text := hwnd ? "FiveM: 接続済み" : "FiveM: 未接続"
    State.modeLabel.Text := Config.backgroundMode
        ? "バックグラウンド操作: オン（解像度に依存しません）"
        : "バックグラウンド操作: オフ（画面画像で検出）"
}

RegisterConfiguredHotkeys() {
    global State, Config

    if !IsSafeConfiguredHotkey(Config.startHotkey)
        || !IsSafeConfiguredHotkey(Config.stopHotkey)
        || StrLower(Config.startHotkey) = StrLower(Config.stopHotkey)
        throw Error("無効または重複したキー設定です")

    State.startHotIf := CanStartFromHotkey
    State.stopHotIf := IsMiningActive
    startName := "$" Config.startHotkey
    stopName := "$~" Config.stopHotkey

    try {
        HotIf State.startHotIf
        Hotkey startName, StartMining, "On"
        State.registeredStartHotkey := startName
        HotIf State.stopHotIf
        Hotkey stopName, StopMining, "On"
        State.registeredStopHotkey := stopName
    } catch as err {
        UnregisterConfiguredHotkeys()
        throw err
    } finally {
        HotIf
    }
}

UnregisterConfiguredHotkeys() {
    global State

    try {
        if State.registeredStartHotkey {
            HotIf State.startHotIf
            try Hotkey State.registeredStartHotkey, "Off"
        }
        if State.registeredStopHotkey {
            HotIf State.stopHotIf
            try Hotkey State.registeredStopHotkey, "Off"
        }
    } finally {
        HotIf
    }
    State.registeredStartHotkey := ""
    State.registeredStopHotkey := ""
}

ShowSettings(*) {
    global State, Config

    if State.running
        return
    if State.updateOperation {
        State.statusLabel.Text := "●  アップデート確認が終わるまでお待ちください"
        return
    }
    if IsObject(State.settingsGui) {
        try {
            State.settingsGui.Show()
            return
        } catch {
            State.settingsGui := 0
        }
    }

    settingsGui := Gui("+Owner" State.gui.Hwnd " -MaximizeBox", "AI採掘機の設定")
    settingsGui.BackColor := "F2F2F7"
    settingsGui.MarginX := 20
    settingsGui.MarginY := 18
    settingsGui.SetFont("s16 w600 c1D1D1F", "Yu Gothic UI")
    settingsGui.AddText("w360", "キーと動作")
    settingsGui.SetFont("s9 w400 c515154", "Yu Gothic UI")
    settingsGui.AddText("xm y+18 w150", "開始キー")
    startControl := settingsGui.AddHotkey("x+10 yp-4 w190", Config.startHotkey)
    settingsGui.AddText("xm y+17 w150", "停止キー")
    stopControl := settingsGui.AddHotkey("x+10 yp-4 w190", Config.stopHotkey)
    backgroundControl := settingsGui.AddCheckbox("xm y+22 w360",
        "バックグラウンドで操作する（推奨）")
    backgroundControl.Value := Config.backgroundMode
    hideControl := settingsGui.AddCheckbox("xm y+10 w360", "開始後にこの画面を隠す")
    hideControl.Value := Config.hideWhileRunning
    washCorrectionControl := settingsGui.AddCheckbox("xm y+10 w360",
        "石洗い後の後退を自動で補正する")
    washCorrectionControl.Value := Config.washForwardCorrection
    autoUpdateControl := settingsGui.AddCheckbox("xm y+10 w360",
        "起動時に新しいバージョンを確認する")
    autoUpdateControl.Value := Config.autoCheckUpdates
    settingsGui.AddText("xm y+8 w360 h34",
        "更新ファイルは電子署名とSHA-256を検証してから適用します。")
    errorLabel := settingsGui.AddText("xm y+8 w360 h34 cB42318", "")
    cancelButton := settingsGui.AddButton("xm y+8 w170 h38", "キャンセル")
    saveButton := settingsGui.AddButton("x+20 w170 h38 Default", "保存")
    cancelButton.OnEvent("Click", CloseSettingsGui.Bind(settingsGui))
    saveButton.OnEvent("Click", SaveSettings.Bind(settingsGui, startControl,
        stopControl, backgroundControl, hideControl, washCorrectionControl,
        autoUpdateControl, errorLabel))
    settingsGui.OnEvent("Close", CloseSettingsGui.Bind(settingsGui))
    settingsGui.OnEvent("Escape", CloseSettingsGui.Bind(settingsGui))
    State.settingsGui := settingsGui
    settingsGui.Show("w400 h410")
    ApplyRoundedWindowCorners(settingsGui.Hwnd)
}

CloseSettingsGui(settingsGui, *) {
    global State
    State.settingsGui := 0
    try settingsGui.Destroy()
}

SaveSettings(settingsGui, startControl, stopControl, backgroundControl,
    hideControl, washCorrectionControl, autoUpdateControl, errorLabel, *) {
    global State, Config, settingsPath

    newStart := Trim(startControl.Value)
    newStop := Trim(stopControl.Value)
    if !IsSafeConfiguredHotkey(newStart) || !IsSafeConfiguredHotkey(newStop) {
        errorLabel.Text := "Fキー、またはCtrl/Alt/Shiftを組み合わせたキーを指定してください。"
        return
    }
    if StrLower(newStart) = StrLower(newStop) {
        errorLabel.Text := "開始キーと停止キーは別々にしてください。"
        return
    }

    oldConfig := {
        startHotkey: Config.startHotkey,
        stopHotkey: Config.stopHotkey,
        backgroundMode: Config.backgroundMode,
        hideWhileRunning: Config.hideWhileRunning,
        autoCheckUpdates: Config.autoCheckUpdates,
        washForwardCorrection: Config.washForwardCorrection
    }
    UnregisterConfiguredHotkeys()
    Config.startHotkey := newStart
    Config.stopHotkey := newStop
    try RegisterConfiguredHotkeys()
    catch as err {
        Config.startHotkey := oldConfig.startHotkey
        Config.stopHotkey := oldConfig.stopHotkey
        try RegisterConfiguredHotkeys()
        errorLabel.Text := "そのキーは登録できません: " err.Message
        return
    }

    Config.backgroundMode := backgroundControl.Value ? 1 : 0
    Config.hideWhileRunning := hideControl.Value ? 1 : 0
    Config.autoCheckUpdates := autoUpdateControl.Value ? 1 : 0
    Config.washForwardCorrection := washCorrectionControl.Value ? 1 : 0
    temporarySettingsPath := settingsPath ".tmp-" A_TickCount
    try {
        if FileExist(settingsPath)
            FileCopy settingsPath, temporarySettingsPath, true
        IniWrite Config.actionMode, temporarySettingsPath, "General", "ActionMode"
        IniWrite Config.startHotkey, temporarySettingsPath, "Controls", "StartHotkey"
        IniWrite Config.stopHotkey, temporarySettingsPath, "Controls", "StopHotkey"
        IniWrite Config.backgroundMode, temporarySettingsPath, "General", "BackgroundMode"
        IniWrite Config.hideWhileRunning, temporarySettingsPath, "General", "HideWhileRunning"
        IniWrite 1, temporarySettingsPath, "Updates", "Schema"
        IniWrite Config.autoCheckUpdates, temporarySettingsPath, "Updates", "AutoCheck"
        IniWrite Config.washForwardCorrection, temporarySettingsPath, "Washing", "ForwardCorrection"
        FileMove temporarySettingsPath, settingsPath, true
    } catch as err {
        try FileDelete temporarySettingsPath
        UnregisterConfiguredHotkeys()
        Config.startHotkey := oldConfig.startHotkey
        Config.stopHotkey := oldConfig.stopHotkey
        Config.backgroundMode := oldConfig.backgroundMode
        Config.hideWhileRunning := oldConfig.hideWhileRunning
        Config.autoCheckUpdates := oldConfig.autoCheckUpdates
        Config.washForwardCorrection := oldConfig.washForwardCorrection
        try RegisterConfiguredHotkeys()
        errorLabel.Text := "設定ファイルへ保存できません: " err.Message
        return
    }
    State.footerLabel.Text := "開始 " Config.startHotkey "   /   停止 " Config.stopHotkey
    State.settingsGui := 0
    settingsGui.Destroy()
    UpdateConnectionStatus()
    State.statusLabel.Text := "●  設定を保存しました"
}

IsSafeConfiguredHotkey(value) {
    if !value || StrLen(value) > 32
        return false
    if !RegExMatch(value,
        "i)^([\^!+]*)(F(?:[1-9]|1[0-9]|2[0-4])|[A-Z0-9])$", &parts)
        return false
    modifiers := parts[1]
    keyName := parts[2]
    for symbol in ["^", "!", "+"] {
        if StrLen(modifiers) - StrLen(StrReplace(modifiers, symbol)) > 1
            return false
    }
    ; 無修飾キーはFiveM中でも文字入力を奪わないF1～F24だけ許可します。
    if !modifiers && !RegExMatch(keyName, "i)^F(?:[1-9]|1[0-9]|2[0-4])$")
        return false
    return true
}

CheckForUpdates(*) {
    BeginUpdateCheck(false)
}

BeginUpdateCheck(silent := false) {
    global State, AppVersion

    if State.running {
        State.statusLabel.Text := "●  自動操作を停止してから更新してください"
        return
    }
    if State.updateOperation {
        if !silent
            State.statusLabel.Text := "●  アップデートを確認中です"
        return
    }
    if !A_IsCompiled {
        State.statusLabel.Text := "●  更新機能は配布版EXEで利用できます"
        return
    }
    if !FileExist(State.updaterPath) {
        State.statusLabel.Text := "●  更新コンポーネントが見つかりません"
        if !silent
            MsgBox "AI採掘機を一式でもう一度展開してください。", "アップデート", "Iconx"
        return
    }

    try {
        DirCreate State.updateRoot
        stageName := FormatTime(, "yyyyMMdd-HHmmss") "-" DllCall("GetCurrentProcessId") "-" A_TickCount
        State.updateStageDir := State.updateRoot "\" stageName
        DirCreate State.updateStageDir
        State.updateResultPath := State.updateStageDir "\check-result.txt"
        try FileDelete State.updateResultPath

        commandLine := QuoteCommandArg(State.updaterPath) . " check "
            . QuoteCommandArg(State.updateResultPath) . " "
            . QuoteCommandArg(AppVersion) . " " . QuoteCommandArg(State.updateStageDir)
        Run commandLine,, "Hide", &childPid
        State.updateOperation := "check"
        State.updateSilent := silent
        State.updateProcessId := childPid
        State.updateDeadline := MonotonicMs() + 60000
        State.updatePollFn := PollUpdateOperation
        SetTimer State.updatePollFn, 250
        State.updateButton.Enabled := false
        if !silent
            State.statusLabel.Text := "●  新しいバージョンを確認中"
    } catch as err {
        State.updateOperation := ""
        State.updateButton.Enabled := true
        State.statusLabel.Text := "●  更新確認を開始できません"
        WriteDiagnostic("UPDATE_CHECK_START_ERROR=" err.Message)
        if !silent
            MsgBox "更新確認を開始できませんでした。`n`n" err.Message,
                "アップデート", "Iconx"
    }
}

PollUpdateOperation(*) {
    global State

    if !State.updateOperation {
        StopUpdatePollTimer()
        return
    }

    if FileExist(State.updateResultPath) {
        operation := State.updateOperation
        silent := State.updateSilent
        try result := ReadUpdaterResult(State.updateResultPath)
        catch as err {
            FinishUpdateOperation()
            CleanupUpdateStage()
            WriteDiagnostic("UPDATE_RESULT_ERROR=" err.Message)
            if !silent
                MsgBox "更新結果を読み取れませんでした。", "アップデート", "Iconx"
            return
        }
        FinishUpdateOperation()
        try FileDelete State.updateResultPath
        if operation = "check"
            HandleUpdateCheckResult(result, silent)
        else if operation = "download"
            HandleUpdateDownloadResult(result)
        return
    }

    processEnded := State.updateProcessId && !ProcessExist(State.updateProcessId)
    if processEnded || MonotonicMs() >= State.updateDeadline {
        operation := State.updateOperation
        silent := State.updateSilent
        FinishUpdateOperation()
        CleanupUpdateStage()
        WriteDiagnostic("UPDATE_NO_RESULT operation=" operation)
        if !silent {
            State.statusLabel.Text := "●  更新サーバーへ接続できません"
            MsgBox "更新サーバーから応答がありませんでした。`n時間をおいて再試行してください。",
                "アップデート", "Icon!"
        }
    }
}

FinishUpdateOperation() {
    global State
    StopUpdatePollTimer()
    State.updateOperation := ""
    State.updateProcessId := 0
    State.updateDeadline := 0
    if !State.running
        State.updateButton.Enabled := true
}

StopUpdatePollTimer() {
    global State
    if IsObject(State.updatePollFn) {
        try SetTimer State.updatePollFn, 0
    }
    State.updatePollFn := 0
}

HandleUpdateCheckResult(result, silent) {
    global State
    status := UpdaterValue(result, "Status")
    message := UpdaterValue(result, "Message")

    if status = "UP_TO_DATE" {
        State.statusLabel.Text := "●  最新バージョンです"
        if !silent
            MsgBox "現在のAI採掘機は最新です。", "アップデート", "Iconi"
        CleanupUpdateStage()
        return
    }
    if status = "NOT_PUBLISHED" {
        if !silent {
            State.statusLabel.Text := "●  公開済みアップデートはありません"
            MsgBox "まだGitHub Releaseが公開されていません。", "アップデート", "Iconi"
        }
        CleanupUpdateStage()
        return
    }
    if status != "UPDATE_AVAILABLE" {
        WriteDiagnostic("UPDATE_CHECK_ERROR=" message)
        securityIssue := InStr(StrLower(message), "signature")
            || InStr(StrLower(message), "public key")
            || InStr(StrLower(message), "security")
        if !silent || securityIssue {
            State.statusLabel.Text := securityIssue
                ? "●  安全でない更新を拒否しました" : "●  更新を確認できません"
            shownMessage := message ? message : "更新情報を確認できませんでした。"
            MsgBox shownMessage, "アップデート", securityIssue ? "Iconx" : "Icon!"
        }
        CleanupUpdateStage()
        return
    }

    State.updateVersion := UpdaterValue(result, "Version")
    State.updateManifestPath := UpdaterValue(result, "ManifestPath")
    State.updateSignaturePath := UpdaterValue(result, "SignaturePath")
    State.updateNotesUrl := UpdaterValue(result, "NotesUrl")
    if !State.updateVersion || !FileExist(State.updateManifestPath)
        || !FileExist(State.updateSignaturePath) {
        State.statusLabel.Text := "●  更新情報が不完全なため中止しました"
        WriteDiagnostic("UPDATE_CHECK_INCOMPLETE")
        CleanupUpdateStage()
        return
    }

    State.statusLabel.Text := "●  v" State.updateVersion " を利用できます"
    answer := MsgBox("AI採掘機 v" State.updateVersion " があります。`n`n"
        "署名を検証して今すぐ更新しますか？",
        "アップデート", "YesNo Iconi Default2")
    if answer = "Yes"
        BeginUpdateDownload()
    else
        CleanupUpdateStage()
}

BeginUpdateDownload() {
    global State

    if State.running || State.updateOperation
        return
    try {
        State.updateResultPath := State.updateStageDir "\download-result.txt"
        stagedExePath := State.updateStageDir "\ai-miner-win-x64.exe"
        try FileDelete State.updateResultPath
        try FileDelete stagedExePath
        commandLine := QuoteCommandArg(State.updaterPath) . " download "
            . QuoteCommandArg(State.updateResultPath) . " "
            . QuoteCommandArg(State.updateManifestPath) . " "
            . QuoteCommandArg(State.updateSignaturePath) . " "
            . QuoteCommandArg(stagedExePath)
        Run commandLine,, "Hide", &childPid
        State.updateOperation := "download"
        State.updateSilent := false
        State.updateProcessId := childPid
        State.updateDeadline := MonotonicMs() + 180000
        State.updatePollFn := PollUpdateOperation
        SetTimer State.updatePollFn, 250
        State.updateButton.Enabled := false
        State.statusLabel.Text := "●  v" State.updateVersion " を安全にダウンロード中"
    } catch as err {
        FinishUpdateOperation()
        CleanupUpdateStage()
        State.statusLabel.Text := "●  ダウンロードを開始できません"
        WriteDiagnostic("UPDATE_DOWNLOAD_START_ERROR=" err.Message)
        MsgBox "ダウンロードを開始できませんでした。`n`n" err.Message,
            "アップデート", "Iconx"
    }
}

HandleUpdateDownloadResult(result) {
    global State
    status := UpdaterValue(result, "Status")
    message := UpdaterValue(result, "Message")
    stagedPath := UpdaterValue(result, "StagedPath")
    if status != "DOWNLOADED" || !stagedPath || !FileExist(stagedPath) {
        State.statusLabel.Text := "●  更新ファイルを検証できません"
        WriteDiagnostic("UPDATE_DOWNLOAD_ERROR=" message)
        MsgBox(message ? message : "更新ファイルの検証に失敗しました。",
            "アップデート", "Iconx")
        CleanupUpdateStage()
        return
    }
    if State.running {
        State.statusLabel.Text := "●  停止後にもう一度アップデートしてください"
        CleanupUpdateStage()
        return
    }

    try {
        parentPid := DllCall("GetCurrentProcessId")
        commandLine := QuoteCommandArg(State.updaterPath) . " apply " . parentPid . " "
            . QuoteCommandArg(State.updateManifestPath) . " "
            . QuoteCommandArg(State.updateSignaturePath) . " "
            . QuoteCommandArg(stagedPath) . " " . QuoteCommandArg(A_ScriptFullPath)
        Run commandLine,, "Hide"
        State.updateApplying := true
        State.statusLabel.Text := "●  更新を適用して再起動します"
        Sleep 150
        ExitApp 0
    } catch as err {
        State.updateApplying := false
        CleanupUpdateStage()
        State.statusLabel.Text := "●  更新を適用できません"
        WriteDiagnostic("UPDATE_APPLY_START_ERROR=" err.Message)
        MsgBox "更新を適用できませんでした。`n`n" err.Message,
            "アップデート", "Iconx"
    }
}

ReadUpdaterResult(resultPath) {
    values := Map()
    contents := FileRead(resultPath, "UTF-8")
    for rawLine in StrSplit(contents, "`n") {
        line := Trim(rawLine, " `t`r")
        if !line
            continue
        separator := InStr(line, "=")
        if separator <= 1
            continue
        key := SubStr(line, 1, separator - 1)
        values[key] := SubStr(line, separator + 1)
    }
    return values
}

UpdaterValue(values, keyName, defaultValue := "") {
    return values.Has(keyName) ? values[keyName] : defaultValue
}

CleanupUpdateStage() {
    global State

    stagePath := RTrim(State.updateStageDir, "\/")
    rootPath := RTrim(State.updateRoot, "\/")
    knownFiles := [State.updateResultPath, State.updateManifestPath,
        State.updateSignaturePath]
    State.updateStageDir := ""
    State.updateResultPath := ""
    State.updateManifestPath := ""
    State.updateSignaturePath := ""
    State.updateVersion := ""
    State.updateNotesUrl := ""
    if !stagePath || !rootPath
        return

    expectedPrefix := StrLower(rootPath "\")
    if SubStr(StrLower(stagePath), 1, StrLen(expectedPrefix)) != expectedPrefix
        return
    if StrLen(stagePath) <= StrLen(rootPath) + 8
        return
    knownFiles.Push(stagePath "\check-result.txt")
    knownFiles.Push(stagePath "\download-result.txt")
    knownFiles.Push(stagePath "\update-manifest.json")
    knownFiles.Push(stagePath "\update-manifest.sig")
    knownFiles.Push(stagePath "\ai-miner-win-x64.exe")
    for filePath in knownFiles {
        if filePath && SubStr(StrLower(filePath), 1, StrLen(expectedPrefix)) = expectedPrefix
            try FileDelete filePath
    }
    ; 通常経路は既知ファイルだけで空になるため、再帰削除は使用しません。
    try DirDelete stagePath
}

QuoteCommandArg(value) {
    value := String(value)
    if InStr(value, Chr(34))
        throw Error("コマンド引数に引用符を使用できません")
    return Chr(34) value Chr(34)
}

RunUpdaterCapabilities() {
    global State
    resultPath := A_Temp "\ai-miner-updater-caps-" DllCall("GetCurrentProcessId") "-" A_TickCount ".txt"
    try {
        try FileDelete resultPath
        commandLine := QuoteCommandArg(State.updaterPath) " capabilities " QuoteCommandArg(resultPath)
        try exitCode := RunWait(commandLine,, "Hide")
        catch as err
            return "ERROR " err.Message
        if exitCode != 0 || !FileExist(resultPath)
            return "ERROR updater capabilities (" exitCode ")"
        return Trim(FileRead(resultPath, "UTF-8"), " `t`r`n")
    } finally {
        try FileDelete resultPath
    }
}

StartMining(*) {
    global State, Config

    if State.running
        return
    if State.updateOperation {
        State.statusLabel.Text := "●  アップデート確認が終わるまでお待ちください"
        return
    }

    if IsObject(State.settingsGui) {
        try {
            State.settingsGui.Show()
            State.statusLabel.Text := "●  設定画面を閉じてから開始してください"
            return
        } catch {
            State.settingsGui := 0
        }
    }

    if Config.actionMode != "mining" && !Config.backgroundMode {
        State.statusLabel.Text := "●  石洗い・砂金採りはバックグラウンド操作をオンにしてください"
        return
    }

    targetHwnd := FindFiveMWindow()
    if !targetHwnd {
        State.statusLabel.Text := "●  FiveMが見つかりません"
        State.connectionLabel.Text := "FiveM: 未接続"
        return
    }

    Critical "On"
    try {
    State.running := true
    State.runMode := Config.actionMode
    State.generation += 1
    runGeneration := State.generation
    State.targetHwnd := targetHwnd
    State.successes := 0
    State.attempts := 0
    State.meals := 0
    State.nudges := 0
    State.washNudgePending := false
    State.nextHungerCheckAt := 0
    State.nextEatAllowedAt := 0
    State.waitingForStone := false
    State.stoneGoneObserved := false
    State.stoneAbsentVotes := 0
    State.stoneReadyVotes := 0
    State.lastMineAt := 0
    State.lastMarkerX := 0
    State.lastMarkerY := 0
    State.lastDevConPort := 0
    State.backgroundTargetActive := false
    State.backgroundDevConPort := 0
    State.mainButton.Text := "自動操作を停止"
    State.actionControl.Enabled := false
    State.settingsButton.Enabled := false
    State.updateButton.Enabled := false
    UpdateActionUi()
    State.statusLabel.Text := "●  準備中"
    State.connectionLabel.Text := "FiveM: 接続済み"
    State.modeLabel.Text := Config.backgroundMode
        ? "バックグラウンド操作: オン（他の作業を妨げません）"
        : "バックグラウンド操作: オフ（前面操作）"
    if Config.hideWhileRunning
        State.gui.Hide()
    } finally {
        Critical "Off"
    }

    ResetDiagnosticLog()
    WriteDiagnostic("START admin=" A_IsAdmin " hwnd=" targetHwnd
        " background=" Config.backgroundMode " mode=" State.runMode)
    if !IsCurrentRun(runGeneration)
        return
    if Config.backgroundMode {
        releaseResult := RunBackgroundBridge("deactivate")
        if !IsCurrentRun(runGeneration)
            return
        WriteDiagnostic("BG_START_RELEASE=" releaseResult)
    }

    if !Config.backgroundMode && IsCurrentRun(runGeneration)
        && !WinActive("ahk_id " targetHwnd) {
        try WinActivate "ahk_id " targetHwnd
    }

    if IsCurrentRun(runGeneration)
        ScheduleNext(runGeneration, 900)
}

StopMining(*) {
    global State

    State.running := false
    State.generation += 1

    if IsObject(State.timerFn) {
        try SetTimer(State.timerFn, 0)
    }
    State.timerFn := 0

    ReleaseAllInputs()
    ReleaseBackgroundTarget(true)
    State.mainButton.Text := "自動操作を開始"
    State.actionControl.Enabled := true
    State.settingsButton.Enabled := true
    State.updateButton.Enabled := true
    State.statusLabel.Text := "●  停止中"
    UpdateActionUi()
    State.gui.Show("NoActivate w420 h445")
    UpdateConnectionStatus()
}

ScheduleNext(expectedGeneration, delayMs) {
    global State

    if !IsCurrentRun(expectedGeneration)
        return

    if IsObject(State.timerFn) {
        try SetTimer(State.timerFn, 0)
    }

    nextFn := AutomationCycle.Bind(expectedGeneration)
    State.timerFn := nextFn
    SetTimer(nextFn, -Max(1, delayMs))
}

AutomationCycle(expectedGeneration) {
    global State
    if !IsCurrentRun(expectedGeneration)
        return
    if State.runMode = "washing"
        WashAttemptBackground(expectedGeneration)
    else if State.runMode = "gold"
        GoldAttemptBackground(expectedGeneration)
    else
        MineAttempt(expectedGeneration)
}

WashAttemptBackground(expectedGeneration) {
    global State, Config

    if !IsCurrentRun(expectedGeneration)
        return
    State.timerFn := 0
    if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd) {
        StopMining()
        State.statusLabel.Text := "●  FiveMが終了したため停止"
        return
    }

    cycleStartedAt := MonotonicMs()
    nextCycleAnchor := cycleStartedAt
    clickedThisAttempt := false
    State.attempts += 1
    State.statusLabel.Text := "●  石洗いの準備中"

    try {
        ; 前周期のtargetと前進を必ず解除してから始めます。
        ReleaseBackgroundTarget(true)
        if !IsCurrentRun(expectedGeneration)
            return

        ; 成功した洗浄1回につき1度だけ、次のtarget表示前に短く前進します。
        if State.washNudgePending {
            State.washNudgePending := false
            if Config.washForwardCorrection && State.lastDevConPort {
                State.statusLabel.Text := "●  洗浄位置を少し前へ補正中"
                nudgeResult := RunBackgroundBridge("nudge-forward",
                    State.lastDevConPort, Config.washForwardPulseMs)
                if !IsCurrentRun(expectedGeneration)
                    return
                WriteDiagnostic("attempt=" State.attempts " WASH_NUDGE=" nudgeResult)
                if nudgeResult = "NUDGED " State.lastDevConPort {
                    State.nudges += 1
                    State.mealLabel.Text := "後退補正  " State.nudges
                }
                ; packetだけ届いてhelper応答が失われた場合も、前進中にtargetを開きません。
                if !WaitWhileBackgroundReady(Config.washForwardPulseMs
                    + Config.washForwardSettleMs + 50, expectedGeneration)
                    return
            }
        }

        State.statusLabel.Text := "●  「石を洗う」を確認中"
        activateResult := RunBackgroundBridge("activate")
        if !IsCurrentRun(expectedGeneration) {
            if RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &stalePort)
                RunBackgroundBridge("deactivate-" stalePort[1])
            return
        }
        if !RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &portMatch) {
            WriteDiagnostic("attempt=" State.attempts " WASH_ACTIVATE=" activateResult)
            State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
            return
        }
        State.backgroundTargetActive := true
        State.backgroundDevConPort := portMatch[1] + 0
        State.lastDevConPort := State.backgroundDevConPort

        if !WaitWhileBackgroundReady(Min(Config.menuOpenWaitMs, 350),
            expectedGeneration)
            return

        probeResult := WaitForBackgroundActionOption(expectedGeneration,
            Config.searchTimeoutMs, "probe-washing", "PRESENT WASH", "MISSING WASH")
        if !IsCurrentRun(expectedGeneration)
            return
        if probeResult = -1 {
            WriteDiagnostic("attempt=" State.attempts " WASH_PROBE_ERROR=" State.lastBridgeError)
            State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
            return
        }
        if probeResult = 0 {
            WriteDiagnostic("attempt=" State.attempts " WASH_BUTTON_MISSING")
            State.statusLabel.Text := "●  「石を洗う」を待っています"
            return
        }

        State.statusLabel.Text := "●  石を洗っています"
        clickRequestedAt := MonotonicMs()
        clickResult := RunBackgroundBridge("click-washing")
        if !IsCurrentRun(expectedGeneration)
            return
        if clickResult != "CLICKED WASH" {
            WriteDiagnostic("attempt=" State.attempts " WASH_CLICK=" clickResult)
            State.statusLabel.Text := "●  「石を洗う」を再確認します"
            return
        }

        State.successes += 1
        clickedThisAttempt := true
        State.lastMineAt := MonotonicMs()
        nextCycleAnchor := clickRequestedAt
        State.washNudgePending := Config.washForwardCorrection = 1
        State.countLabel.Text := "石洗い回数  " State.successes
        State.statusLabel.Text := "●  約9秒後にもう一度洗います"
        WriteDiagnostic("attempt=" State.attempts " WASH_CLICKED")
    } catch as err {
        WriteDiagnostic("attempt=" State.attempts " WASH_ERROR=" err.Message)
        if IsCurrentRun(expectedGeneration)
            State.statusLabel.Text := "●  石洗いを安全に再試行します"
    } finally {
        ; activate応答だけが失われた場合もtarget状態を残しません。
        ReleaseBackgroundTarget(true)
        if IsCurrentRun(expectedGeneration) {
            if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd) {
                StopMining()
                State.statusLabel.Text := "●  FiveMが終了したため停止"
            } else {
                nextDelay := clickedThisAttempt
                    ? Max(500, nextCycleAnchor + Config.washCycleMs - MonotonicMs())
                    : Config.notFoundRetryMs
                ScheduleNext(expectedGeneration, nextDelay)
            }
        }
    }
}

GoldAttemptBackground(expectedGeneration) {
    global State, Config

    if !IsCurrentRun(expectedGeneration)
        return
    State.timerFn := 0
    if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd) {
        StopMining()
        State.statusLabel.Text := "●  FiveMが終了したため停止"
        return
    }

    cycleStartedAt := MonotonicMs()
    nextCycleAnchor := cycleStartedAt
    clickedThisAttempt := false
    State.attempts += 1
    State.statusLabel.Text := "●  砂金採りの準備中"

    try {
        ReleaseBackgroundTarget(true)
        if !IsCurrentRun(expectedGeneration)
            return

        State.statusLabel.Text := "●  「砂金採りトレイ」を確認中"
        activateResult := RunBackgroundBridge("activate")
        if !IsCurrentRun(expectedGeneration) {
            if RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &stalePort)
                RunBackgroundBridge("deactivate-" stalePort[1])
            return
        }
        if !RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &portMatch) {
            WriteDiagnostic("attempt=" State.attempts " GOLD_ACTIVATE=" activateResult)
            State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
            return
        }
        State.backgroundTargetActive := true
        State.backgroundDevConPort := portMatch[1] + 0
        State.lastDevConPort := State.backgroundDevConPort

        if !WaitWhileBackgroundReady(Min(Config.menuOpenWaitMs, 350),
            expectedGeneration)
            return

        probeResult := WaitForBackgroundActionOption(expectedGeneration,
            Config.searchTimeoutMs, "probe-gold", "PRESENT GOLD", "MISSING GOLD")
        if !IsCurrentRun(expectedGeneration)
            return
        if probeResult = -1 {
            WriteDiagnostic("attempt=" State.attempts " GOLD_PROBE_ERROR=" State.lastBridgeError)
            State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
            return
        }
        if probeResult = 0 {
            WriteDiagnostic("attempt=" State.attempts " GOLD_BUTTON_MISSING")
            State.statusLabel.Text := "●  「砂金採りトレイ」を待っています"
            return
        }

        State.statusLabel.Text := "●  砂金を採っています"
        clickRequestedAt := MonotonicMs()
        clickResult := RunBackgroundBridge("click-gold")
        if !IsCurrentRun(expectedGeneration)
            return
        if clickResult != "CLICKED GOLD" {
            WriteDiagnostic("attempt=" State.attempts " GOLD_CLICK=" clickResult)
            State.statusLabel.Text := "●  砂金採りを再確認します"
            return
        }

        State.successes += 1
        clickedThisAttempt := true
        State.lastMineAt := MonotonicMs()
        nextCycleAnchor := clickRequestedAt
        State.countLabel.Text := "砂金採り回数  " State.successes
        State.statusLabel.Text := "●  約6秒後にもう一度採ります"
        WriteDiagnostic("attempt=" State.attempts " GOLD_CLICKED")
    } catch as err {
        WriteDiagnostic("attempt=" State.attempts " GOLD_ERROR=" err.Message)
        if IsCurrentRun(expectedGeneration)
            State.statusLabel.Text := "●  砂金採りを安全に再試行します"
    } finally {
        ; activate応答だけが失われた場合もtarget状態を残しません。
        ReleaseBackgroundTarget(true)
        if IsCurrentRun(expectedGeneration) {
            if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd) {
                StopMining()
                State.statusLabel.Text := "●  FiveMが終了したため停止"
            } else {
                nextDelay := clickedThisAttempt
                    ? Max(500, nextCycleAnchor + Config.goldCycleMs - MonotonicMs())
                    : Config.notFoundRetryMs
                ScheduleNext(expectedGeneration, nextDelay)
            }
        }
    }
}

WaitForBackgroundActionOption(expectedGeneration, timeoutMs,
    probeMode, presentResult, missingResult) {
    global State, Config

    deadline := MonotonicMs() + Max(100, timeoutMs)
    loop {
        if !WaitWhileBackgroundReady(1, expectedGeneration)
            return -1
        result := RunBackgroundBridge(probeMode)
        if !IsCurrentRun(expectedGeneration)
            return -1
        if result = presentResult
            return 1
        if result != missingResult {
            State.lastBridgeError := result
            return -1
        }
        if MonotonicMs() >= deadline
            return 0
        if !WaitWhileBackgroundReady(Config.searchPollMs, expectedGeneration)
            return -1
    }
}

MineAttempt(expectedGeneration) {
    global State, Config

    if !IsCurrentRun(expectedGeneration)
        return

    State.timerFn := 0

    if !WinExist("ahk_id " State.targetHwnd) {
        StopMining()
        State.statusLabel.Text := "●  FiveMが終了したため停止"
        return
    }

    if Config.backgroundMode {
        MineAttemptBackground(expectedGeneration)
        return
    }

    if !IsTargetForeground(expectedGeneration) {
        ReleaseAllInputs()
        State.statusLabel.Text := "状態: 一時停止中（FiveMを前面にしてください）"
        ScheduleNext(expectedGeneration, Config.inactiveRetryMs)
        return
    }

    State.attempts += 1
    State.statusLabel.Text := "状態: 入力をリセット中（試行 " State.attempts "）"
    clickIssued := false

    try {
        ; 毎回、前の入力状態を完全に解除してから開始します。
        ReleaseAllInputs()
        if !WaitWhileReady(Config.resetWaitMs, expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }

        ; 消失確認前は短い不在時間を逃さないよう、食事を後回しにします。
        if !State.waitingForStone || State.stoneGoneObserved {
            eatResult := MaybeEat(expectedGeneration)
            if eatResult = -1 {
                RetryAfterInterruption(expectedGeneration)
                return
            }
            if eatResult = 1 {
                State.statusLabel.Text := "状態: 食事完了。採掘を再開します"
                ScheduleNext(expectedGeneration, Config.postEatResumeMs)
                return
            }
        }

        ; Altは採掘を試すたびに必ず新しく押し直します。
        if !PressAltFresh(expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }
        State.statusLabel.Text := "状態: Altを押し直しました"
        if !WaitWhileReady(Config.altBeforeRightMs, expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }

        ; 右ボタンも毎回、新しく押して長押しします。
        if !PressRightFresh(expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }
        State.statusLabel.Text := "状態: 右ボタン長押し・メニュー待ち"
        if !WaitWhileReady(Config.menuOpenWaitMs, expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }

        ; 前回の白いカーソルで検出画像が隠れないよう、検索範囲外へ毎回退避します。
        ParkCursorOutsideDetectionArea(expectedGeneration)
        if !WaitWhileReady(Config.cursorSettleMs, expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }

        markerPresent := FindStoneMarker(&markerX, &markerY)
        if markerPresent {
            State.lastMarkerX := markerX
            State.lastMarkerY := markerY
            WriteDiagnostic("attempt=" State.attempts " MARKER_PRESENT pos=" markerX "," markerY)
        } else {
            WriteDiagnostic("attempt=" State.attempts " MARKER_MISSING")
        }

        State.statusLabel.Text := "状態: 青い石マーカーと採掘ボタンを検出中"
        buttonSearchMs := State.waitingForStone
            ? Config.stoneProbeSearchMs : Config.searchTimeoutMs
        ; マーカーが無い消失判定では、500msの途中で湧いた状態を混ぜず同じ瞬間を確認します。
        found := State.waitingForStone && !markerPresent
            ? FindMiningButton(&clickX, &clickY, false)
            : WaitForMiningButton(&clickX, &clickY, expectedGeneration, buttonSearchMs)
        if !IsTargetForeground(expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }
        WriteDiagnostic("attempt=" State.attempts " BUTTON_" (found ? "PRESENT" : "MISSING"))

        if State.waitingForStone {
            elapsedSinceClick := State.lastMineAt
                ? MonotonicMs() - State.lastMineAt : 0
            goneFrame := !markerPresent && !found
            markerFallback := found && !markerPresent
                && elapsedSinceClick >= Config.markerFallbackAfterMs
            readyFrame := found && (markerPresent || markerFallback)

            if markerFallback
                WriteDiagnostic("attempt=" State.attempts " MARKER_FALLBACK elapsed=" elapsedSinceClick)

            if !State.stoneGoneObserved {
                safeResyncFrame := readyFrame
                    && elapsedSinceClick >= Config.stoneResyncAfterMs
                if safeResyncFrame {
                    State.stoneAbsentVotes := 0
                    State.stoneReadyVotes += 1
                    if State.stoneReadyVotes >= Config.stoneReadyConfirmations {
                        State.stoneGoneObserved := true
                        WriteDiagnostic("attempt=" State.attempts
                            " CYCLE_RESYNC elapsed=" elapsedSinceClick)
                    } else {
                        State.statusLabel.Text := "状態: 石を安全に再同期中 "
                            State.stoneReadyVotes "/" Config.stoneReadyConfirmations
                        WriteDiagnostic("attempt=" State.attempts " RESYNC_CANDIDATE votes="
                            State.stoneReadyVotes " elapsed=" elapsedSinceClick)
                        ScheduleNext(expectedGeneration, Config.stoneProbeRetryMs)
                        return
                    }
                } else {
                    State.stoneReadyVotes := 0
                    if goneFrame
                        State.stoneAbsentVotes += 1
                    else
                        State.stoneAbsentVotes := 0

                    if State.stoneAbsentVotes >= Config.stoneGoneConfirmations {
                        State.stoneGoneObserved := true
                        State.statusLabel.Text := "状態: 石の消失を確認。再出現を監視中"
                        WriteDiagnostic("attempt=" State.attempts " MARKER_GONE_CONFIRMED")
                    } else {
                        State.statusLabel.Text := "状態: 石の消失を確認中 "
                            State.stoneAbsentVotes "/" Config.stoneGoneConfirmations
                        WriteDiagnostic("attempt=" State.attempts " GONE_CANDIDATE votes="
                            State.stoneAbsentVotes " marker=" markerPresent " button=" found)
                    }
                    ScheduleNext(expectedGeneration, Config.stoneProbeRetryMs)
                    return
                }
            }

            if !readyFrame {
                State.stoneReadyVotes := 0
                State.statusLabel.Text := "状態: 石の再出現を監視中"
                WriteDiagnostic("attempt=" State.attempts " WAIT_RESPAWN marker="
                    markerPresent " button=" found)
                ScheduleNext(expectedGeneration, Config.stoneProbeRetryMs)
                return
            }

            State.stoneReadyVotes += 1
            if State.stoneReadyVotes < Config.stoneReadyConfirmations {
                State.statusLabel.Text := "状態: 石の再出現を確認中 "
                    State.stoneReadyVotes "/" Config.stoneReadyConfirmations
                WriteDiagnostic("attempt=" State.attempts " READY_CANDIDATE votes="
                    State.stoneReadyVotes " pos=" markerX "," markerY)
                ScheduleNext(expectedGeneration, Config.stoneProbeRetryMs)
                return
            }

            State.statusLabel.Text := "状態: 石の再出現を検知。採掘します"
            WriteDiagnostic("attempt=" State.attempts " RESPAWN_CONFIRMED marker="
                markerX "," markerY " target=" clickX "," clickY)
        } else if !found {
            WriteDiagnostic("attempt=" State.attempts " BUTTON_NOT_FOUND")
            if IsCurrentRun(expectedGeneration) {
                State.statusLabel.Text := "状態: ボタン未検出。全部離して再試行します"
                ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
            }
            return
        }
        WriteDiagnostic("attempt=" State.attempts " BUTTON_FOUND target=" clickX "," clickY)

        ; 白い矢印は画面画像に含まれない場合があるため、検出済み座標へ直接動かします。
        State.statusLabel.Text := "状態: 実カーソルを採掘ボタンへ直接移動中"
        if !MoveVirtualCursorTo(clickX, clickY, expectedGeneration) {
            WriteDiagnostic("attempt=" State.attempts " CURSOR_MOVE_FAILED")
            if IsCurrentRun(expectedGeneration) {
                State.statusLabel.Text := "状態: カーソル移動APIが失敗しました。再試行します"
                ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
            }
            return
        }

        ; ホバー状態が反映されるのを待ってから、現在位置で左ボタンを押します。
        if !WaitWhileReady(Config.hoverBeforeClickMs, expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }
        if !PressLeftHere(expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }
        ; down送信後はfinallyのupでもクリックが成立し得るため、以後は再出現待ちへ移ります。
        clickIssued := true
        State.statusLabel.Text := "状態: 採掘ボタンをクリック中"
        if !WaitWhileReady(Config.leftHoldMs, expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }

        ReleaseLeft()
        if !WaitWhileReady(Config.afterLeftUpMs, expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }

        ; 左→右→Altの順で離し、次回にAltを新しく押せる状態へ戻します。
        ReleaseRight()
        if !WaitWhileReady(Config.rightToAltReleaseMs, expectedGeneration) {
            RetryAfterInterruption(expectedGeneration)
            return
        }
        ReleaseAlt()
        WriteDiagnostic("attempt=" State.attempts " CLICK_SENT")
    } catch as err {
        ReleaseAllInputs()
        WriteDiagnostic("attempt=" State.attempts " ERROR=" err.Message)
        if IsCurrentRun(expectedGeneration) {
            State.statusLabel.Text := "状態: エラーのため停止しました"
            MsgBox "自動採掘を停止しました。`n`n" err.Message, "AI採掘機", "Iconx"
            StopMining()
        }
        return
    } finally {
        ; 途中停止・未検出・例外でも押しっぱなしを残しません。
        ReleaseAllInputs()
        if clickIssued && IsCurrentRun(expectedGeneration) {
            State.successes += 1
            State.waitingForStone := true
            State.stoneGoneObserved := false
            State.stoneAbsentVotes := 0
            State.stoneReadyVotes := 0
            State.lastMineAt := MonotonicMs()
            State.countLabel.Text := "採掘ボタンのクリック回数: " State.successes
            State.statusLabel.Text := "状態: 採掘完了まで待機後、石の再出現を監視します"
            ScheduleNext(expectedGeneration, Config.miningCompleteWaitMs)
        }
    }
}

MineAttemptBackground(expectedGeneration) {
    global State, Config

    if !IsCurrentRun(expectedGeneration)
        return

    State.attempts += 1
    State.statusLabel.Text := "●  石をバックグラウンド確認中"
    clickIssued := false

    try {
        ; FiveM公式の+ox_targetコマンドをローカルdevconへ送り、物理キーを一切触りません。
        ReleaseBackgroundTarget()
        if !WaitWhileBackgroundReady(Config.resetWaitMs, expectedGeneration) {
            RetryBackgroundInterruption(expectedGeneration)
            return
        }

        activateResult := RunBackgroundBridge("activate")
        if !IsCurrentRun(expectedGeneration) {
            if RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &stalePort)
                RunBackgroundBridge("deactivate-" stalePort[1])
            return
        }
        if !RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &portMatch) {
            State.statusLabel.Text := "●  バックグラウンド接続を再試行中"
            WriteDiagnostic("attempt=" State.attempts " BG_ACTIVATE=" activateResult)
            ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
            return
        }
        State.backgroundTargetActive := true
        State.backgroundDevConPort := portMatch[1] + 0
        State.lastDevConPort := State.backgroundDevConPort

        if !WaitWhileBackgroundReady(Min(Config.menuOpenWaitMs, 350), expectedGeneration) {
            RetryBackgroundInterruption(expectedGeneration)
            return
        }

        ; 再出現監視中は1回だけ即時確認し、石が消えている約5秒を取り逃がしません。
        probeResult := State.waitingForStone
            ? ProbeBackgroundMiningOption(expectedGeneration)
            : WaitForBackgroundMiningOption(expectedGeneration, Config.searchTimeoutMs)
        if !IsCurrentRun(expectedGeneration)
            return
        if probeResult = -1 {
            State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
            WriteDiagnostic("attempt=" State.attempts " BG_PROBE_ERROR=" State.lastBridgeError)
            ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
            return
        }
        found := probeResult = 1
        WriteDiagnostic("attempt=" State.attempts " BG_BUTTON_" (found ? "PRESENT" : "MISSING"))

        if State.waitingForStone {
            elapsedSinceClick := State.lastMineAt
                ? MonotonicMs() - State.lastMineAt : 0

            if !State.stoneGoneObserved {
                safeResyncFrame := found
                    && elapsedSinceClick >= Config.stoneResyncAfterMs
                if safeResyncFrame {
                    State.stoneAbsentVotes := 0
                    State.stoneReadyVotes += 1
                    if State.stoneReadyVotes >= Config.stoneReadyConfirmations {
                        State.stoneGoneObserved := true
                        WriteDiagnostic("attempt=" State.attempts
                            " BG_CYCLE_RESYNC elapsed=" elapsedSinceClick)
                    } else {
                        State.statusLabel.Text := "●  石を安全に再同期中"
                        ScheduleNext(expectedGeneration, Config.stoneProbeRetryMs)
                        return
                    }
                } else {
                    State.stoneReadyVotes := 0
                    State.stoneAbsentVotes := found ? 0 : State.stoneAbsentVotes + 1
                    if State.stoneAbsentVotes >= Config.stoneGoneConfirmations {
                        State.stoneGoneObserved := true
                        State.statusLabel.Text := "●  石の再出現を待っています"
                        WriteDiagnostic("attempt=" State.attempts " BG_GONE_CONFIRMED")
                    } else {
                        State.statusLabel.Text := "●  採掘完了を確認中"
                    }
                    ScheduleNext(expectedGeneration, Config.stoneProbeRetryMs)
                    return
                }
            }

            if !found {
                State.stoneReadyVotes := 0
                State.statusLabel.Text := "●  石の再出現を待っています"
                ScheduleNext(expectedGeneration, Config.stoneProbeRetryMs)
                return
            }

            State.stoneReadyVotes += 1
            if State.stoneReadyVotes < Config.stoneReadyConfirmations {
                State.statusLabel.Text := "●  石の再出現を確認中"
                ScheduleNext(expectedGeneration, Config.stoneProbeRetryMs)
                return
            }
            WriteDiagnostic("attempt=" State.attempts " BG_RESPAWN_CONFIRMED")
        } else if !found {
            State.statusLabel.Text := "●  採掘ボタンを待っています"
            ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
            return
        }

        State.statusLabel.Text := "●  採掘しています"
        clickResult := RunBackgroundBridge("click-mining")
        if !IsCurrentRun(expectedGeneration)
            return
        if clickResult != "CLICKED MINE" {
            State.statusLabel.Text := "●  採掘ボタンを再確認中"
            WriteDiagnostic("attempt=" State.attempts " BG_CLICK=" clickResult)
            ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
            return
        }
        clickIssued := true
        WriteDiagnostic("attempt=" State.attempts " BG_CLICKED")
    } catch as err {
        WriteDiagnostic("attempt=" State.attempts " BG_ERROR=" err.Message)
        if IsCurrentRun(expectedGeneration) {
            State.statusLabel.Text := "●  バックグラウンド接続を再試行中"
            ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
        }
    } finally {
        ReleaseBackgroundTarget()
        if clickIssued && IsCurrentRun(expectedGeneration) {
            State.successes += 1
            State.waitingForStone := true
            State.stoneGoneObserved := false
            State.stoneAbsentVotes := 0
            State.stoneReadyVotes := 0
            State.lastMineAt := MonotonicMs()
            State.countLabel.Text := "採掘回数  " State.successes
            State.statusLabel.Text := "●  採掘完了を待っています"
            ScheduleNext(expectedGeneration, Config.miningCompleteWaitMs)
        }
    }
}

ProbeBackgroundMiningOption(expectedGeneration) {
    global State

    if !WaitWhileBackgroundReady(1, expectedGeneration)
        return -1
    result := RunBackgroundBridge("probe-mining")
    if !IsCurrentRun(expectedGeneration)
        return -1
    if result = "PRESENT MINE"
        return 1
    if result = "MISSING MINE"
        return 0
    State.lastBridgeError := result
    return -1
}

WaitForBackgroundMiningOption(expectedGeneration, timeoutMs) {
    global State, Config

    deadline := MonotonicMs() + Max(100, timeoutMs)
    loop {
        if !WaitWhileBackgroundReady(1, expectedGeneration)
            return -1
        result := RunBackgroundBridge("probe-mining")
        if !IsCurrentRun(expectedGeneration)
            return -1
        if result = "PRESENT MINE"
            return 1
        if SubStr(result, 1, 5) = "ERROR" {
            State.lastBridgeError := result
            return -1
        }
        if MonotonicMs() >= deadline
            return 0
        if !WaitWhileBackgroundReady(Config.searchPollMs, expectedGeneration)
            return -1
    }
}

RunBackgroundBridge(mode, extra1 := "", extra2 := "") {
    global State

    if !RegExMatch(mode, "^[a-z0-9-]+$")
        return "ERROR invalid bridge mode"
    Critical "On"
    State.bridgeCallId += 1
    callId := State.bridgeCallId
    Critical "Off"
    resultPath := State.backgroundResultPath "." callId ".txt"

    try {
        try FileDelete resultPath
        commandLine := '"' State.backgroundBridgePath '" ' mode ' "' resultPath '"'
        if extra1 != ""
            commandLine .= " " Round(extra1)
        if extra2 != ""
            commandLine .= " " Round(extra2)
        try exitCode := RunWait(commandLine,, "Hide")
        catch as err
            return "ERROR " err.Message

        if !FileExist(resultPath)
            return "ERROR no bridge result (" exitCode ")"
        try result := Trim(FileRead(resultPath, "UTF-8"))
        catch as err
            return "ERROR " err.Message
        return result
    } finally {
        try FileDelete resultPath
    }
}

ReleaseBackgroundTarget(force := false) {
    global State

    if !State.backgroundTargetActive && !force
        return
    mode := State.backgroundTargetActive && State.backgroundDevConPort
        ? "deactivate-" State.backgroundDevConPort : "deactivate"
    result := RunBackgroundBridge(mode)
    WriteDiagnostic("BG_RELEASE=" result)
    State.backgroundTargetActive := false
    State.backgroundDevConPort := 0
}

WaitWhileBackgroundReady(delayMs, expectedGeneration) {
    global State

    endAt := MonotonicMs() + delayMs
    while MonotonicMs() < endAt {
        if !IsCurrentRun(expectedGeneration)
            return false
        if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd)
            return false
        remainingMs := endAt - MonotonicMs()
        Sleep Min(30, Max(1, remainingMs))
    }
    return IsCurrentRun(expectedGeneration)
        && State.targetHwnd && WinExist("ahk_id " State.targetHwnd)
}

RetryBackgroundInterruption(expectedGeneration) {
    global State, Config

    if !IsCurrentRun(expectedGeneration)
        return
    if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd) {
        StopMining()
        State.statusLabel.Text := "●  FiveMが終了したため停止"
        return
    }
    State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
    ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
}

WaitForMiningButton(&clickX, &clickY, expectedGeneration, timeoutMs := 0) {
    global Config

    effectiveTimeoutMs := timeoutMs > 0 ? timeoutMs : Config.searchTimeoutMs
    deadline := MonotonicMs() + effectiveTimeoutMs
    searchPass := 0

    loop {
        if !IsTargetForeground(expectedGeneration)
            return false

        searchPass += 1
        useScaledFallbacks := searchPass >= 4
        if FindMiningButton(&clickX, &clickY, useScaledFallbacks)
            return true

        if MonotonicMs() >= deadline
            return false

        Sleep Config.searchPollMs
    }
}

FindMiningButton(&clickX, &clickY, useScaledFallbacks := false) {
    global State

    WinGetClientPos &clientX, &clientY, &clientW, &clientH, "ahk_id " State.targetHwnd
    if clientW < 600 || clientH < 400
        return false

    ; 添付画像の配置を含む、FiveMクライアント中央付近だけを検索します。
    searchLeft := clientX + Round(clientW * 0.12)
    searchTop := clientY + Round(clientH * 0.28)
    searchRight := clientX + Round(clientW * 0.72)
    searchBottom := clientY + Round(clientH * 0.76)

    plans := BuildButtonSearchPlans(clientW, clientH, useScaledFallbacks)

    for buttonTemplate in State.buttonTemplates {
        for plan in plans {
            scalePercent := plan[1]
            variation := plan[2]
            scaledWidth := Round(buttonTemplate.width * scalePercent / 100)

            if scalePercent = 100
                imageSpec := "*" variation " " buttonTemplate.path
            else
                imageSpec := "*" variation " *w" scaledWidth " *h-1 " buttonTemplate.path

            if ImageSearch(&foundX, &foundY,
                searchLeft, searchTop, searchRight, searchBottom, imageSpec) {
                clickX := foundX + Round(buttonTemplate.clickOffsetX * scalePercent / 100)
                clickY := foundY + Round(buttonTemplate.clickOffsetY * scalePercent / 100)
                return true
            }
        }
    }

    ; 画像倍率が未知でも、白い横長ピル形状からボタン中央を求める解像度非依存fallback。
    if FindMiningButtonByPill(&clickX, &clickY,
        searchLeft, searchTop, searchRight, searchBottom, clientW, clientH)
        return true

    return false
}

FindMiningButtonByPill(&clickX, &clickY,
    searchLeft, searchTop, searchRight, searchBottom, clientW, clientH) {

    minRunWidth := Max(70, Round(clientW * 0.07))
    maxRunWidth := Round(clientW * 0.30)
    rowStep := Max(1, Round(clientH / 600))
    y := searchTop

    while y <= searchBottom {
        if FindBrightRunAtRow(&runLeft, &runRight, y,
            searchLeft, searchRight, minRunWidth, maxRunWidth) {
            runWidth := runRight - runLeft + 1
            estimatedHeight := Min(140, Max(20, Round(runWidth / 6.6)))
            confirmY := Min(searchBottom, y + estimatedHeight - 5)
            confirmMinWidth := Round(minRunWidth * 0.80)

            if FindBrightRunAtRow(&bottomLeft, &bottomRight, confirmY,
                searchLeft, searchRight, confirmMinWidth, maxRunWidth)
                && Abs(((bottomLeft + bottomRight) / 2)
                    - ((runLeft + runRight) / 2)) <= estimatedHeight {
                clickX := Round((runLeft + runRight) / 2)
                clickY := Round(y + estimatedHeight / 2)
                WriteDiagnostic("BUTTON_PILL_FOUND run=" runLeft "," y ","
                    runRight " height=" estimatedHeight " target=" clickX "," clickY)
                return true
            }
        }
        y += rowStep
    }

    return false
}

FindBrightRunAtRow(&runLeft, &runRight, y,
    searchLeft, searchRight, minRunWidth, maxRunWidth) {

    cursorX := searchLeft
    while cursorX <= searchRight {
        try found := PixelSearch(&seedX, &seedY,
            cursorX, y, searchRight, y, 0xFFFFFF, 30)
        catch
            return false
        if !found
            return false

        left := seedX
        while left > searchLeft && IsPillWhite(left - 1, y)
            left -= 1
        right := seedX
        while right < searchRight && IsPillWhite(right + 1, y)
            right += 1

        width := right - left + 1
        if width >= minRunWidth && width <= maxRunWidth {
            runLeft := left
            runRight := right
            return true
        }
        cursorX := Max(seedX + 1, right + 1)
    }

    return false
}

IsPillWhite(x, y) {
    try color := PixelGetColor(x, y, "RGB")
    catch
        return false
    red := (color >> 16) & 0xFF
    green := (color >> 8) & 0xFF
    blue := color & 0xFF
    return red >= 225 && green >= 225 && blue >= 225
        && Abs(red - green) <= 25 && Abs(red - blue) <= 25
        && Abs(green - blue) <= 25
}

BuildButtonSearchPlans(clientW, clientH, includeFallbacks) {
    ; 添付画像(約2880x1800)を基準に、現在のクライアント解像度から最有力倍率を計算します。
    autoScale := Round(Min(clientW / 2880, clientH / 1800) * 100)
    autoScale := Min(220, Max(35, autoScale))
    requestedScales := [autoScale, 100]

    if includeFallbacks {
        for delta in [-5, 5, -10, 10, -15, 15]
            requestedScales.Push(autoScale + delta)
        for commonScale in [35, 40, 45, 50, 60, 67, 70, 75, 80, 90,
            110, 120, 125, 140, 160, 180, 200, 220]
            requestedScales.Push(commonScale)
    }

    plans := []
    seen := Map()
    for scalePercent in requestedScales {
        scalePercent := Min(220, Max(35, Round(scalePercent)))
        if seen.Has(scalePercent)
            continue
        seen[scalePercent] := true
        variation := scalePercent = 100 ? 35 : (includeFallbacks ? 60 : 50)
        plans.Push([scalePercent, variation])
    }
    return plans
}

FindStoneMarker(&markerX, &markerY) {
    global State

    markerX := 0
    markerY := 0
    WinGetClientPos &clientX, &clientY, &clientW, &clientH, "ahk_id " State.targetHwnd
    if clientW < 600 || clientH < 400
        return false

    ; 石の上に出る青リングの固定色。添付された2枚の画像で石以外には存在しません。
    stoneBlue := 0x6287EC
    searchLeft := clientX + Round(clientW * 0.30)
    searchTop := clientY + Round(clientH * 0.25)
    searchRight := clientX + Round(clientW * 0.75)
    searchBottom := clientY + Round(clientH * 0.80)

    ; 再出現位置はほぼ同じなので、前回位置が現在のクライアント内なら周辺を先に調べます。
    if State.lastMarkerX >= searchLeft && State.lastMarkerX <= searchRight
        && State.lastMarkerY >= searchTop && State.lastMarkerY <= searchBottom {
        localLeft := Max(searchLeft, State.lastMarkerX - 120)
        localTop := Max(searchTop, State.lastMarkerY - 120)
        localRight := Min(searchRight, State.lastMarkerX + 120)
        localBottom := Min(searchBottom, State.lastMarkerY + 120)
        if SearchStoneMarkerRegion(&markerX, &markerY,
            localLeft, localTop, localRight, localBottom, stoneBlue)
            return true
    }

    return SearchStoneMarkerRegion(&markerX, &markerY,
        searchLeft, searchTop, searchRight, searchBottom, stoneBlue)
}

SearchStoneMarkerRegion(&markerX, &markerY, left, top, right, bottom, stoneBlue) {
    global State

    if left > right || top > bottom
        return false

    ; 固定UI色なら高速な完全一致、色が少し変わった場合はリング形状テンプレートで確認します。
    try {
        if PixelSearch(&markerX, &markerY, left, top, right, bottom, stoneBlue, 0)
            return true
    } catch as err {
        WriteDiagnostic("MARKER_PIXEL_ERROR=" err.Message)
    }

    try {
        imageSpec := "*85 *Trans0xFF00FF " State.stoneMarkerTemplatePath
        if ImageSearch(&foundX, &foundY, left, top, right, bottom, imageSpec) {
            markerX := foundX + 14
            markerY := foundY + 14
            return true
        }
    } catch as err {
        WriteDiagnostic("MARKER_IMAGE_ERROR=" err.Message)
    }

    return false
}

MaybeEat(expectedGeneration) {
    global State, Config

    if !Config.autoEat
        return 0

    now := MonotonicMs()
    if State.nextHungerCheckAt && now < State.nextHungerCheckAt
        return 0
    State.nextHungerCheckAt := now + Config.hungerCheckIntervalMs

    validVotes := 0
    lowVotes := 0
    loop Config.hungerConfirmFrames {
        if !IsTargetForeground(expectedGeneration)
            return -1

        if ReadHungerLow(&isLow) {
            validVotes += 1
            if isLow
                lowVotes += 1
        }

        if A_Index < Config.hungerConfirmFrames {
            if !WaitWhileReady(Config.hungerConfirmGapMs, expectedGeneration)
                return -1
        }
    }

    requiredVotes := Floor(Config.hungerConfirmFrames / 2) + 1
    if validVotes < requiredVotes || lowVotes < requiredVotes
        return 0

    if State.nextEatAllowedAt && MonotonicMs() < State.nextEatAllowedAt {
        State.statusLabel.Text := "状態: 空腹50%以下・食事クールダウン中"
        return 0
    }

    return PerformEating(expectedGeneration) ? 1 : -1
}

ReadHungerLow(&isLow) {
    if !FindHungerGauge(&centerX, &centerY, &ringRadius)
        return false

    ; 通常取得がDirectX描画で黒くなる環境だけSlowへフォールバックします。
    if ReadHungerLowWithMode(&isLow, centerX, centerY, ringRadius, "RGB")
        return true
    return ReadHungerLowWithMode(&isLow, centerX, centerY, ringRadius, "Slow RGB")
}

ReadHungerLowWithMode(&isLow, centerX, centerY, ringRadius, pixelMode) {
    ; アイコンだけの誤一致や黒画面を除外し、誤って食料を消費しないようにします。
    validRingPoints := 0
    for angle in [5, 45, 90, 225, 270, 315] {
        if SampleRingHasFoodColor(centerX, centerY, ringRadius, angle, pixelMode)
            validRingPoints += 1
    }
    if validRingPoints < 4
        return false

    ; 12時直後は残量が少なくても点灯するため、明るさの基準にします。
    reference := Max(
        SampleRingBrightness(centerX, centerY, ringRadius, 3, pixelMode),
        SampleRingBrightness(centerX, centerY, ringRadius, 6, pixelMode),
        SampleRingBrightness(centerX, centerY, ringRadius, 9, pixelMode))

    ; 50%地点（6時）を少し越えた3点を調べます。
    half1 := SampleRingBrightness(centerX, centerY, ringRadius, 181, pixelMode)
    half2 := SampleRingBrightness(centerX, centerY, ringRadius, 183, pixelMode)
    half3 := SampleRingBrightness(centerX, centerY, ringRadius, 185, pixelMode)

    ; ほぼ空のときは基準側も暗くなるため、その場合も空腹扱いです。
    if reference < 165 {
        isLow := true
        return true
    }

    activeThreshold := Max(110, Round(reference * 0.74))
    activeVotes := 0
    if half1 >= activeThreshold && reference - half1 <= 40
        activeVotes += 1
    if half2 >= activeThreshold && reference - half2 <= 40
        activeVotes += 1
    if half3 >= activeThreshold && reference - half3 <= 40
        activeVotes += 1

    isLow := activeVotes < 2
    return true
}

FindHungerGauge(&centerX, &centerY, &ringRadius) {
    global State

    WinGetClientPos &clientX, &clientY, &clientW, &clientH, "ahk_id " State.targetHwnd
    searchLeft := clientX
    searchTop := clientY + Round(clientH * 0.65)
    searchRight := clientX + Round(clientW * 0.28)
    searchBottom := clientY + clientH - 1
    plans := [[100, 30], [100, 45], [90, 40], [110, 40], [125, 45], [80, 45]]

    for plan in plans {
        scalePercent := plan[1]
        variation := plan[2]
        scaledWidth := Round(State.hungerTemplateWidth * scalePercent / 100)
        if scalePercent = 100
            imageSpec := "*" variation " *Trans0xFF00FF " State.hungerTemplatePath
        else
            imageSpec := "*" variation " *Trans0xFF00FF *w" scaledWidth " *h-1 " State.hungerTemplatePath

        if ImageSearch(&foundX, &foundY,
            searchLeft, searchTop, searchRight, searchBottom, imageSpec) {
            centerX := foundX + Round(State.hungerCenterOffsetX * scalePercent / 100)
            centerY := foundY + Round(State.hungerCenterOffsetY * scalePercent / 100)
            ringRadius := Round(State.hungerRingRadius * scalePercent / 100)

            ; 円周がクライアント外やタスクバーに隠れる場合は誤判定せず不明扱いにします。
            margin := ringRadius + 5
            if centerX - margin < clientX || centerX + margin > clientX + clientW - 1
                return false
            if centerY - margin < clientY || centerY + margin > clientY + clientH - 1
                return false
            return true
        }
    }

    return false
}

SampleRingHasFoodColor(centerX, centerY, ringRadius, clockwiseDegreesFromTop, pixelMode) {
    radians := clockwiseDegreesFromTop * 3.141592653589793 / 180
    radius := Max(1, ringRadius - 3)
    while radius <= ringRadius + 3 {
        sampleX := Round(centerX + Sin(radians) * radius)
        sampleY := Round(centerY - Cos(radians) * radius)
        color := PixelGetColor(sampleX, sampleY, pixelMode)
        red := (color >> 16) & 0xFF
        green := (color >> 8) & 0xFF
        blue := color & 0xFF
        if red >= 90 && red - green >= 30 && red - blue >= 30
            return true
        radius += 1
    }
    return false
}

SampleRingBrightness(centerX, centerY, ringRadius, clockwiseDegreesFromTop, pixelMode := "RGB") {
    radians := clockwiseDegreesFromTop * 3.141592653589793 / 180
    bestValue := 0
    startRadius := Max(1, ringRadius - 3)
    endRadius := ringRadius + 3

    radius := startRadius
    while radius <= endRadius {
        sampleX := Round(centerX + Sin(radians) * radius)
        sampleY := Round(centerY - Cos(radians) * radius)
        color := PixelGetColor(sampleX, sampleY, pixelMode)
        red := (color >> 16) & 0xFF
        green := (color >> 8) & 0xFF
        blue := color & 0xFF
        bestValue := Max(bestValue, red, green, blue)
        radius += 1
    }

    return bestValue
}

PerformEating(expectedGeneration) {
    global State, Config

    ReleaseAllInputs()
    if !WaitWhileReady(Config.resetWaitMs, expectedGeneration)
        return false

    Critical "On"
    valid := IsTargetForeground(expectedGeneration)
    if valid {
        ; ゲージ反映が遅くても連続消費しないよう、押す前にクールダウンを開始します。
        State.nextEatAllowedAt := MonotonicMs() + Config.eatCooldownMs
        State.foodHeld := true
        SendEvent "{Blind}{" Config.foodKey " down}"
    }
    Critical "Off"
    if !valid
        return false

    if !WaitWhileReady(Config.foodKeyHoldMs, expectedGeneration) {
        ReleaseFood()
        return false
    }
    ReleaseFood()

    State.meals += 1
    State.mealLabel.Text := "自動で食べた回数: " State.meals
    State.statusLabel.Text := "状態: 食事中（ホットバースロット " Config.foodKey "）"

    totalEatingWait := Config.eatAnimationMs + Config.gaugeSettleMs
    if !WaitWhileReady(totalEatingWait, expectedGeneration)
        return false

    State.nextHungerCheckAt := MonotonicMs() + Config.hungerCheckIntervalMs
    return true
}

ParkCursorOutsideDetectionArea(expectedGeneration) {
    global State

    if !IsTargetForeground(expectedGeneration)
        return false

    try WinGetClientPos &clientX, &clientY, &clientW, &clientH,
        "ahk_id " State.targetHwnd
    catch
        return false

    if clientW < 100 || clientH < 100
        return false

    parkX := clientX + clientW - 32
    parkY := clientY + 48
    setOk := DllCall("user32\SetCursorPos",
        "Int", parkX, "Int", parkY, "Int") != 0
    postOk := PostClientMouseMove(State.targetHwnd, parkX, parkY)
    WriteDiagnostic("CURSOR_PARK target=" parkX "," parkY
        " set=" setOk " post=" postOk)
    return setOk || postOk
}

MoveVirtualCursorTo(targetX, targetY, expectedGeneration) {
    global State, Config

    if !IsTargetForeground(expectedGeneration)
        return false

    beforeX := 0
    beforeY := 0
    beforeOk := GetSystemCursorPos(&beforeX, &beforeY)
    attempted := false
    setAny := false
    postAny := false
    verified := false

    ; NUIカーソルは画像として取得できない場合があるため、画像検索を一切前提にしません。
    ; 検出済みボタンのスクリーン座標へ、OSとNUIメッセージの2経路で直接置きます。
    loop 3 {
        if !IsTargetForeground(expectedGeneration)
            return false

        setOk := DllCall("user32\SetCursorPos",
            "Int", Round(targetX), "Int", Round(targetY), "Int") != 0
        postOk := PostClientMouseMove(State.targetHwnd, targetX, targetY)
        setAny := setAny || setOk
        postAny := postAny || postOk
        attempted := attempted || setOk || postOk

        if !WaitWhileReady(Config.cursorSettleMs, expectedGeneration)
            return false

        if GetSystemCursorPos(&actualX, &actualY)
            && IsCursorInsideButton(actualX, actualY, targetX, targetY) {
            verified := true
            break
        }
    }

    if !IsTargetForeground(expectedGeneration)
        return false

    ; CEFへhover更新を確実に届けるため2pxだけ往復し、最後は正確な座標へ戻します。
    jogSet := DllCall("user32\SetCursorPos",
        "Int", Round(targetX + 2), "Int", Round(targetY), "Int") != 0
    jogPost := PostClientMouseMove(State.targetHwnd, targetX + 2, targetY)
    Sleep 16
    finalSet := DllCall("user32\SetCursorPos",
        "Int", Round(targetX), "Int", Round(targetY), "Int") != 0
    finalPost := PostClientMouseMove(State.targetHwnd, targetX, targetY)
    attempted := attempted || jogSet || jogPost || finalSet || finalPost

    if !WaitWhileReady(Config.cursorSettleMs, expectedGeneration)
        return false

    afterX := 0
    afterY := 0
    afterOk := GetSystemCursorPos(&afterX, &afterY)
    if afterOk && IsCursorInsideButton(afterX, afterY, targetX, targetY)
        verified := true

    beforeText := beforeOk ? beforeX "," beforeY : "unavailable"
    afterText := afterOk ? afterX "," afterY : "unavailable"
    WriteDiagnostic("CURSOR target=" targetX "," targetY
        " before=" beforeText " after=" afterText
        " set=" setAny " post=" postAny
        " jog=" jogSet "/" jogPost " final=" finalSet "/" finalPost
        " verified=" verified)

    ; ソフトウェアカーソルではOS座標を検証できない場合もあるため、送信成功ならクリックへ進みます。
    return attempted
}

GetSystemCursorPos(&cursorX, &cursorY) {
    point := Buffer(8, 0)
    if !DllCall("user32\GetCursorPos", "Ptr", point.Ptr, "Int")
        return false
    cursorX := NumGet(point, 0, "Int")
    cursorY := NumGet(point, 4, "Int")
    return true
}

IsCursorInsideButton(cursorX, cursorY, targetX, targetY) {
    return Abs(cursorX - targetX) <= 8 && Abs(cursorY - targetY) <= 8
}

PostClientMouseMove(hwnd, screenX, screenY) {
    if !GetPackedClientPosition(hwnd, screenX, screenY, &packedPosition)
        return false
    ; WM_MOUSEMOVE。右ボタン長押し中なのでwParamへMK_RBUTTONを含めます。
    return DllCall("user32\PostMessageW",
        "Ptr", hwnd, "UInt", 0x0200, "UPtr", 0x0002,
        "Ptr", packedPosition, "Int") != 0
}

GetPackedClientPosition(hwnd, screenX, screenY, &packedPosition) {
    point := Buffer(8, 0)
    NumPut "Int", Round(screenX), point, 0
    NumPut "Int", Round(screenY), point, 4
    if !DllCall("user32\ScreenToClient", "Ptr", hwnd, "Ptr", point.Ptr, "Int")
        return false

    clientX := NumGet(point, 0, "Int")
    clientY := NumGet(point, 4, "Int")
    packedPosition := (clientX & 0xFFFF) | ((clientY & 0xFFFF) << 16)
    return true
}

PressAltFresh(expectedGeneration) {
    global State

    Critical "On"
    valid := IsTargetForeground(expectedGeneration)
    if valid {
        SendEvent "{Blind}{LAlt down}"
        State.altHeld := true
    }
    Critical "Off"
    return valid
}

PressRightFresh(expectedGeneration) {
    global State

    Critical "On"
    valid := IsTargetForeground(expectedGeneration)
    if valid {
        SendEvent "{Blind}{RButton down}"
        State.rightHeld := true
    }
    Critical "Off"
    return valid
}

PressLeftHere(expectedGeneration) {
    global State

    Critical "On"
    valid := IsTargetForeground(expectedGeneration)
    if valid {
        ; カーソルを直接置いた現在位置で、通常の左ボタン入力を送ります。
        SendEvent "{Blind}{LButton down}"
        State.leftHeld := true
        WriteDiagnostic("LEFT_DOWN physical=1")
    }
    Critical "Off"
    return valid
}

ReleaseLeft() {
    global State
    if State.leftHeld
        try SendEvent "{Blind}{LButton up}"
    State.leftHeld := false
}

ReleaseRight() {
    global State
    if State.rightHeld
        try SendEvent "{Blind}{RButton up}"
    State.rightHeld := false
}

ReleaseAlt() {
    global State
    if State.altHeld
        try SendEvent "{Blind}{LAlt up}"
    State.altHeld := false
}

ReleaseFood() {
    global State, Config
    if State.foodHeld
        try SendEvent "{Blind}{" Config.foodKey " up}"
    State.foodHeld := false
}

ReleaseAllInputs(*) {
    Critical "On"
    ReleaseLeft()
    ReleaseRight()
    ReleaseAlt()
    ReleaseFood()
    Critical "Off"
}

WaitWhileReady(delayMs, expectedGeneration) {
    endAt := MonotonicMs() + delayMs

    while MonotonicMs() < endAt {
        if !IsTargetForeground(expectedGeneration)
            return false
        remainingMs := endAt - MonotonicMs()
        Sleep Min(30, Max(1, remainingMs))
    }

    return IsTargetForeground(expectedGeneration)
}

MonotonicMs() {
    return DllCall("kernel32\GetTickCount64", "UInt64")
}

RetryAfterInterruption(expectedGeneration) {
    global State, Config

    if IsCurrentRun(expectedGeneration) {
        State.statusLabel.Text := "状態: FiveMが前面になるまで一時停止"
        ScheduleNext(expectedGeneration, Config.inactiveRetryMs)
    }
}

IsCurrentRun(expectedGeneration) {
    global State
    return State.running && expectedGeneration = State.generation
}

IsTargetForeground(expectedGeneration) {
    global State
    return IsCurrentRun(expectedGeneration)
        && State.targetHwnd
        && WinActive("ahk_id " State.targetHwnd)
}

FindFiveMWindow() {
    activeHwnd := WinExist("A")
    if activeHwnd && IsFiveMWindow(activeHwnd)
        return activeHwnd

    for hwnd in WinGetList() {
        if IsFiveMWindow(hwnd)
            return hwnd
    }

    return 0
}

IsFiveMWindow(hwnd) {
    try {
        exeName := WinGetProcessName("ahk_id " hwnd)
        return RegExMatch(exeName, "i)^FiveM(?:_b\d+)?_GTAProcess\.exe$")
    } catch {
        return false
    }
}

Cleanup(*) {
    global State

    StopUpdatePollTimer()
    if !State.updateApplying
        CleanupUpdateStage()
    ReleaseBackgroundTarget(true)
    State.running := false
    State.generation += 1
    if IsObject(State.timerFn) {
        try SetTimer(State.timerFn, 0)
    }
    ReleaseAllInputs()
    UnregisterConfiguredHotkeys()
    DeleteExtractedTemplates()
}

DeleteExtractedTemplates() {
    global State

    for buttonTemplate in State.buttonTemplates {
        try FileDelete buttonTemplate.path
    }
    try FileDelete State.hungerTemplatePath
    try FileDelete State.stoneMarkerTemplatePath
    try FileDelete State.backgroundBridgePath
    try FileDelete State.backgroundResultPath
    try FileDelete State.backgroundResultPath ".*.txt"
    ; apply中はWindowsが実行ファイルを保護するため、更新helper自身が後で削除します。
    try FileDelete State.updaterPath
    try FileDelete State.updateResultPath
}

ResetDiagnosticLog() {
    global State, AppVersion
    State.diagnosticLines := 0
    try FileDelete State.diagnosticPath
    WriteDiagnostic("AI採掘機 v" AppVersion " 診断開始")
}

WriteDiagnostic(message) {
    global State
    if State.diagnosticLines >= 400
        return

    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    try {
        FileAppend timestamp " | " message "`r`n", State.diagnosticPath, "UTF-8"
        State.diagnosticLines += 1
    }
}

TestCursorMovementApis() {
    if !GetSystemCursorPos(&startX, &startY)
        return false

    virtualX := SysGet(76)
    virtualY := SysGet(77)
    virtualW := SysGet(78)
    virtualH := SysGet(79)
    testX := startX < virtualX + virtualW - 2 ? startX + 1 : startX - 1
    testY := startY < virtualY + virtualH - 2 ? startY + 1 : startY - 1

    setOk := DllCall("user32\SetCursorPos", "Int", testX, "Int", testY, "Int") != 0
    Sleep 60
    actualX := 0
    actualY := 0
    readOk := GetSystemCursorPos(&actualX, &actualY)
    movedOk := readOk && Abs(actualX - testX) <= 2 && Abs(actualY - testY) <= 2

    WriteDiagnostic("API_TEST start=" startX "," startY
        " target=" testX "," testY " actual=" actualX "," actualY
        " set=" setOk " read=" readOk " moved=" movedOk)

    DllCall "user32\SetCursorPos", "Int", startX, "Int", startY
    return setOk && movedOk
}

ReadTiming(settingsFile, keyName, defaultValue, minimum, maximum) {
    return ReadIntegerSetting(settingsFile, "Timings", keyName,
        defaultValue, minimum, maximum)
}

ReadIntegerSetting(settingsFile, sectionName, keyName, defaultValue, minimum, maximum) {
    try value := Integer(IniRead(settingsFile, sectionName, keyName, defaultValue))
    catch
        return defaultValue

    return Min(maximum, Max(minimum, value))
}

ReadTextSetting(settingsFile, sectionName, keyName, defaultValue) {
    try value := Trim(IniRead(settingsFile, sectionName, keyName, defaultValue))
    catch
        return defaultValue
    return value
}

ReadActionMode(settingsFile) {
    value := StrLower(ReadTextSetting(settingsFile, "General", "ActionMode", "mining"))
    return value = "washing" ? "washing" : value = "gold" ? "gold" : "mining"
}

ReadFoodKey(settingsFile) {
    try value := Trim(IniRead(settingsFile, "Eating", "FoodKey", "1"))
    catch
        return "1"

    ; FiveMのホットバースロットだけを許可し、壊れた設定で別キーを押さないようにします。
    return RegExMatch(value, "^[1-9]$") ? value : "1"
}
