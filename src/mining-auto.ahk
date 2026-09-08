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

global AppVersion := "6.2.0"
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
    goldCycleMs: ReadIntegerSetting(settingsPath, "GoldPanning", "CycleMs", 6000, 4000, 15000),
    goldRecoveryEnabled: ReadIntegerSetting(settingsPath, "GoldPanning", "RecoveryEnabled", 1, 0, 1),
    goldRecoveryAfterMs: ReadIntegerSetting(settingsPath, "GoldPanning", "RecoveryAfterMs", 12000, 8000, 60000),
    goldRecoveryPulseMs: ReadIntegerSetting(settingsPath, "GoldPanning", "RecoveryPulseMs", 150, 150, 250),
    goldRecoverySettleMs: ReadIntegerSetting(settingsPath, "GoldPanning", "RecoverySettleMs", 300, 100, 3000),
    vehicleStorageEnabled: ReadIntegerSetting(settingsPath, "VehicleStorage", "Enabled", 0, 0, 1),
    vehicleRegistered: ReadIntegerSetting(settingsPath, "VehicleStorage", "Registered", 0, 0, 1),
    vehicleName: ReadTextSetting(settingsPath, "VehicleStorage", "DisplayName", "登録車両"),
    vehicleStorageId: ReadTextSetting(settingsPath, "VehicleStorage", "StorageId", ""),
    vehicleStorageType: ReadTextSetting(settingsPath, "VehicleStorage", "StorageType", ""),
    vehicleWorkMode: ReadVehicleWorkMode(settingsPath),
    vehicleRouteFormat: ReadIntegerSetting(settingsPath, "VehicleStorage", "RouteFormat", 1, 0, 3),
    vehicleOutboundRoute: ReadTextSetting(settingsPath, "VehicleStorage", "OutboundRoute", ""),
    vehicleReturnRoute: ReadTextSetting(settingsPath, "VehicleStorage", "ReturnRoute", ""),
    capacityCheckIntervalMs: ReadIntegerSetting(settingsPath, "VehicleStorage", "CapacityCheckIntervalMs", 3000, 1500, 15000),
    minimumFreeWeight: ReadIntegerSetting(settingsPath, "VehicleStorage", "MinimumFreeWeight", 2000, 250, 20000),
    routeIdleFinishMs: ReadIntegerSetting(settingsPath, "VehicleStorage", "RouteIdleFinishMs", 1200, 700, 3000),
    routeSettleMs: ReadIntegerSetting(settingsPath, "VehicleStorage", "RouteSettleMs", 700, 200, 3000),
    vehicleSearchPulseMs: ReadIntegerSetting(settingsPath, "VehicleStorage", "SearchPulseMs", 180, 120, 350),
    serverHealthIntervalMs: ReadIntegerSetting(settingsPath, "Safety", "ServerHealthIntervalMs", 3500, 1500, 10000)
}

if StrLen(Config.vehicleName) > 40
    Config.vehicleName := SubStr(Config.vehicleName, 1, 40)
if !IsValidVehicleProfile(Config)
    Config.vehicleStorageEnabled := 0

; v5.1以前の「未設定なので無効」という仮設定だけを、安全な署名付き更新へ移行します。
needsUpdateSettingsMigration := Config.updateSettingsSchema < 1
if needsUpdateSettingsMigration && !(A_Args.Length && A_Args[1] = "--smoke-test") {
    Config.updateSettingsSchema := 1
    Config.autoCheckUpdates := 1
}

global State := {
    running: false,
    runMode: "mining",
    generation: 0,
    timerFn: 0,
    targetHwnd: 0,
    targetPid: 0,
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
    goldMissingSince: 0,
    goldRecoveryStep: 0,
    goldRecoveryExhausted: false,
    goldRecoveryFault: false,
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
    activeBridgePid: 0,
    activeBridgeMode: "",
    activeBridgeOperationToken: "",
    lastBridgeError: "",
    automationPhase: "stopped",
    inventoryBaseline: "",
    nextCapacityCheckAt: 0,
    capacityProbeFailures: 0,
    workpointProbeFailures: 0,
    serverEpoch: "",
    serverHealthFailures: 0,
    nextServerHealthAt: 0,
    lastInventoryWeight: 0,
    lastInventoryMaxWeight: 0,
    lastInventoryFreeWeight: 0,
    lastCapacityReason: "未確認",
    storageTrips: 0,
    lastStorageResult: "未実行",
    lastStorageProbeResult: "",
    registrationActive: false,
    registrationCancelled: false,
    registrationOverlay: 0,
    registrationOverlayTitle: 0,
    registrationOverlayDetail: 0,
    registrationOverlayFeedback: 0,
    registrationOverlayTimer: 0,
    registrationOverlayFooter: 0,
    registrationOverlayWatchFn: 0,
    registrationKeyControls: Map(),
    registrationViewMask: 0,
    registrationHotIf: 0,
    registrationMovementHotIf: 0,
    registrationMovementBlocked: false,
    registrationLastMask: -1,
    page: "overview",
    pages: Map(),
    ui: {},
    layoutReady: false
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
        : RunBackgroundBridge("capabilities") != "CAPS 6 MINE WASH GOLD NUDGE STORAGE INVENTORY ROUTE TRY VIEW HEALTH" ? 18
        : updaterCapabilities != "UPDATE_CAPS 1 CHECK DOWNLOAD APPLY" ? 19
        : !IsSafeConfiguredHotkey("F8") ? 20
        : IsSafeConfiguredHotkey("A") ? 21
        : !IsSafeConfiguredHotkey("^A") ? 22
        : !IsValidInventorySpec("0001.ore.e30=10") ? 23
        : IsValidInventorySpec("ore=10") ? 24
        : !InventorySpecHasIncrease("0002.ore.e30=11", "0001.ore.e30=10") ? 25
        : InventorySpecHasIncrease("0002.ore.e30=9", "0001.ore.e30=10") ? 26
        : InventorySpecHasIncrease("0002.tool.eyJkIjo5OX0=1", "0001.tool.eyJkIjoxMDB9=1") ? 27
        : !InventorySpecHasIncrease("0002.tool.eyJkIjo5OX0=2", "0001.tool.eyJkIjoxMDB9=1") ? 28
        : !InventorySpecHasIncrease("0001.ore.e30=1", "0001.food.e30=1") ? 29
        : !IsValidRoute("150:1") ? 30
        : IsValidRoute("6000:1") ? 31
        : GoldRecoveryRoute(1, 150) != "150:1" ? 32
        : GoldRecoveryRoute(2, 150) != "300:2" ? 33
        : GoldRecoveryRoute(6, 150) != "150:4" ? 34
        : GoldRecoveryRoute(7, 150) != "" ? 35
        : !GoldRecoveryPatternIsBalanced(150) ? 36
        : !IsValidRoute("150:65") ? 37
        : !IsValidRoute("150:64", false) ? 38
        : !IsValidRoute("25:64", false, 25) ? 39
        : IsValidRoute("150:64") ? 40
        : IsValidRoute("150:48") ? 41
        : IsValidRoute("150:192") ? 42
        : IsValidRoute("150:256") ? 43
        : CombineRoutes("150:1", "150:64") != "150:1,150:64" ? 44
        : RouteViewSegmentCount("150:1,150:64,150:128") != 2 ? 45
        : AutomationStartAllowed(false, true) ? 46
        : !AutomationStartAllowed(false, false) ? 47
        : ReverseRoute("180:1,200:5") != "200:10,180:2" ? 48
        : VehicleSearchRoutes(180).Length != 20 ? 49
        : !ParseServerHealth("HEALTH READY YWJjZGVmZ2g", &testEpoch) ? 50
        : testEpoch != "YWJjZGVmZ2g" ? 51
        : !CapacityNeedsStorage({weight: 8000, maxWeight: 10000,
            used: 2, slots: 20}, &testCapacityReason, &testFreeWeight) ? 52
        : testCapacityReason != "weight" || testFreeWeight != 2000 ? 53
        : CapacityNeedsStorage({weight: 7999, maxWeight: 10000,
            used: 2, slots: 20}, &testCapacityReason, &testFreeWeight) ? 54
        : !CapacityNeedsStorage({weight: 1000, maxWeight: 10000,
            used: 20, slots: 20}, &testCapacityReason, &testFreeWeight) ? 55
        : testCapacityReason != "slots" ? 56 : 0
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
    smokeExitCode := RunUiSmokeTest()
    State.gui.Hide()
    ExitApp smokeExitCode
}

if A_Args.Length && A_Args[1] = "--updated"
    State.statusLabel.Text := "●  v" AppVersion " への更新が完了しました"
else if A_Args.Length && A_Args[1] = "--update-failed"
    State.statusLabel.Text := "●  更新に失敗したため以前の版へ戻しました"
else if !A_Args.Length && Config.autoCheckUpdates && A_IsCompiled
    SetTimer((*) => BeginUpdateCheck(true), -1800)

BuildGui() {
    global State, Config, AppVersion

    ; 広い画面はiPadOSの設定に近いサイドバー＋内容ペイン、狭い画面は
    ; 上部ナビゲーションへ切り替え、520x640でも主要操作を画面内に保ちます。
    State.gui := Gui("+Resize +MinSize520x640", "AI採掘機")
    State.gui.BackColor := "F5F5F7"
    State.gui.MarginX := 0
    State.gui.MarginY := 0
    State.pages := Map("overview", [], "vehicle", [], "settings", [], "update", [])
    State.ui := {}

    State.gui.SetFont("s14 w600 c1D1D1F", "Segoe UI Variable Text")
    State.ui.appTitle := State.gui.AddText("x24 y17 w420 h30", "AI採掘機")
    State.gui.SetFont("s9 w400 c6E6E73", "Segoe UI Variable Text")
    State.ui.version := State.gui.AddText("x650 y25 w110 h22 Right", "v" AppVersion)
    State.ui.appSubtitle := State.gui.AddText("x24 y45 w500 h20",
        "FiveM ユーティリティ")

    State.ui.sidebarSurface := State.gui.AddText(
        "x16 y76 w176 h224 Disabled BackgroundFFFFFF", "")
    State.ui.selectionBar := State.gui.AddText(
        "x16 y88 w4 h44 Disabled Background0A84FF", "")
    State.gui.SetFont("s10 w600 c1D1D1F", "Segoe UI Variable Text")
    State.ui.navOverview := State.gui.AddButton("x28 y100 w152 h44", "概要")
    State.ui.navVehicle := State.gui.AddButton("x28 y152 w152 h44", "車両")
    State.ui.navSettings := State.gui.AddButton("x28 y204 w152 h44", "設定")
    State.ui.navUpdate := State.gui.AddButton("x28 y256 w152 h44", "アップデート")
    State.ui.navOverview.OnEvent("Click", (*) => ShowPage("overview"))
    State.ui.navVehicle.OnEvent("Click", (*) => ShowPage("vehicle"))
    State.ui.navSettings.OnEvent("Click", (*) => ShowPage("settings"))
    State.ui.navUpdate.OnEvent("Click", (*) => ShowPage("update"))

    BuildOverviewPage()
    BuildVehiclePage()
    BuildSettingsPage()
    BuildUpdatePage()

    State.gui.OnEvent("Close", (*) => ExitApp())
    State.gui.OnEvent("Escape", HandleMainEscape)
    State.gui.OnEvent("Size", LayoutMainWindow)
    State.gui.Show("w820 h640")
    ApplyRoundedWindowCorners(State.gui.Hwnd)
    State.layoutReady := true
    LayoutMainWindow(State.gui, 0, 820, 640)
    ShowPage("overview")
    UpdateActionUi()
    UpdateConnectionStatus()
    RefreshVehicleUi()
    RefreshUpdateUi()
}

AddPageControl(pageName, control) {
    global State
    State.pages[pageName].Push(control)
    control.Visible := false
    return control
}

BuildOverviewPage() {
    global State, Config
    gui := State.gui
    gui.SetFont("s20 w600 c1D1D1F", "Segoe UI Variable Text")
    State.ui.overviewTitle := AddPageControl("overview", gui.AddText("x0 y0 w400 h38", "自動操作"))
    gui.SetFont("s9 w400 c6E6E73", "Segoe UI Variable Text")
    State.taglineLabel := AddPageControl("overview", gui.AddText("x0 y0 w400 h36",
        "画面を奪わず、選んだ作業を続けます"))
    State.ui.statusSurface := AddPageControl("overview",
        gui.AddText("x0 y0 w400 h142 Disabled Background17171C", ""))
    ; 動的な状態文が狭幅でも1行で読める密度にします。
    gui.SetFont("s11 w600 cFFFFFF", "Segoe UI Variable Text")
    State.statusLabel := AddPageControl("overview",
        gui.AddText("x0 y0 w400 h32 BackgroundTrans", "停止中"))
    State.ui.statusSeparator1 := AddPageControl("overview",
        gui.AddText("x0 y0 w400 h1 Background3A3A3C"))
    gui.SetFont("s10 w400 cD1D1D6", "Segoe UI Variable Text")
    State.connectionLabel := AddPageControl("overview",
        gui.AddText("x0 y0 w400 h28 BackgroundTrans", "FiveM　確認中"))
    State.ui.statusSeparator2 := AddPageControl("overview",
        gui.AddText("x0 y0 w400 h1 Background3A3A3C"))
    State.modeLabel := AddPageControl("overview",
        gui.AddText("x0 y0 w400 h28 BackgroundTrans", "バックグラウンド操作"))
    gui.SetFont("s9 w600 c6E6E73", "Segoe UI Variable Text")
    State.ui.actionCaption := AddPageControl("overview", gui.AddText("x0 y0 w100 h24", "作業") )
    gui.SetFont("s10 w400 c1D1D1F", "Segoe UI Variable Text")
    actionIndex := Config.actionMode = "washing" ? 2 : Config.actionMode = "gold" ? 3 : 1
    State.actionControl := AddPageControl("overview", gui.AddDropDownList("x0 y0 w300 Choose" actionIndex,
        ["鉱石を採掘する", "石を洗う", "砂金採りトレイ"]))
    State.actionControl.OnEvent("Change", ChangeActionMode)
    gui.SetFont("s11 w600", "Segoe UI Variable Text")
    State.mainButton := AddPageControl("overview",
        gui.AddButton("x0 y0 w300 h50 Default", "自動操作を開始"))
    State.mainButton.OnEvent("Click", ToggleMining)
    State.ui.metricsSurface := AddPageControl("overview",
        gui.AddText("x0 y0 w400 h78 Disabled BackgroundFFFFFF", ""))
    gui.SetFont("s9 w600 c1D1D1F", "Segoe UI Variable Text")
    State.countLabel := AddPageControl("overview",
        gui.AddText("x0 y0 w120 h40 Center 0x200 BackgroundTrans", "採掘回数`n0"))
    State.mealLabel := AddPageControl("overview",
        gui.AddText("x0 y0 w120 h40 Center 0x200 BackgroundTrans", "食事回数`n0"))
    State.vehicleTripLabel := AddPageControl("overview",
        gui.AddText("x0 y0 w120 h40 Center 0x200 BackgroundTrans", "自動収納`n0"))
    gui.SetFont("s9 w400 c6E6E73", "Segoe UI Variable Text")
    State.footerLabel := AddPageControl("overview", gui.AddText("x0 y0 w400 h24 Center",
        "開始 " Config.startHotkey "　停止 " Config.stopHotkey))
}

BuildVehiclePage() {
    global State, Config
    gui := State.gui
    gui.SetFont("s20 w600 c1D1D1F", "Segoe UI Variable Text")
    State.ui.vehicleTitle := AddPageControl("vehicle", gui.AddText("x0 y0 w400 h38", "車両収納"))
    gui.SetFont("s9 w400 c6E6E73", "Segoe UI Variable Text")
    State.ui.vehicleSubtitle := AddPageControl("vehicle", gui.AddText("x0 y0 w480 h36",
        "容量が少なくなると、登録した車両へ採集品だけを収納します"))
    State.ui.vehicleSurface := AddPageControl("vehicle",
        gui.AddText("x0 y0 w400 h160 Disabled BackgroundFFFFFF", ""))
    gui.SetFont("s11 w600 c1C1C1E", "Segoe UI Variable Text")
    State.vehicleStatusLabel := AddPageControl("vehicle",
        gui.AddText("x0 y0 w400 h30 BackgroundTrans", "未登録"))
    State.ui.vehicleSeparator1 := AddPageControl("vehicle", gui.AddText("x0 y0 w400 h1 BackgroundD1D1D6"))
    gui.SetFont("s9 w400 c3A3A3C", "Segoe UI Variable Text")
    State.ui.vehicleNameCaption := AddPageControl("vehicle",
        gui.AddText("x0 y0 w100 h28 0x200 BackgroundTrans", "表示名"))
    State.vehicleNameEdit := AddPageControl("vehicle", gui.AddEdit("x0 y0 w240 h30", Config.vehicleName))
    State.ui.vehicleSeparator2 := AddPageControl("vehicle", gui.AddText("x0 y0 w400 h1 BackgroundD1D1D6"))
    State.vehicleEnabledControl := AddPageControl("vehicle",
        gui.AddCheckbox("x0 y0 w360 h32", "容量不足時に自動収納"))
    State.vehicleEnabledControl.Value := Config.vehicleStorageEnabled
    State.vehicleEnabledControl.OnEvent("Click", ToggleVehicleStorage)
    State.ui.capacitySurface := AddPageControl("vehicle",
        gui.AddText("x0 y0 w400 h82 Disabled BackgroundFFFFFF", ""))
    gui.SetFont("s10 w600 c1D1D1F", "Segoe UI Variable Text")
    State.capacityStatusLabel := AddPageControl("vehicle",
        gui.AddText("x0 y0 w400 h28 BackgroundTrans", "所持重量　開始後に確認します"))
    State.capacityProgress := AddPageControl("vehicle",
        gui.AddProgress("x0 y0 w400 h6 Disabled BackgroundE5E5EA c0A84FF Range0-100", 0))
    gui.SetFont("s9 w400 c6E6E73", "Segoe UI Variable Text")
    State.capacityDetailLabel := AddPageControl("vehicle",
        gui.AddText("x0 y0 w400 h22 BackgroundTrans", "重量を優先し、空きスロットも安全確認します"))
    State.ui.routeSurface := AddPageControl("vehicle",
        gui.AddText("x0 y0 w400 h104 Disabled BackgroundFFFFFF", ""))
    gui.SetFont("s10 w600 c1C1C1E", "Segoe UI Variable Text")
    State.routeStatusLabel := AddPageControl("vehicle",
        gui.AddText("x0 y0 w400 h28 BackgroundTrans", "往復ルート　未登録"))
    gui.SetFont("s9 w400 c636366", "Segoe UI Variable Text")
    State.routeDetailLabel := AddPageControl("vehicle", gui.AddText("x0 y0 w400 h48 BackgroundTrans",
        "作業場所から車両後部までの往路と復路を記録します。"))
    gui.SetFont("s10 w600 c1C1C1E", "Segoe UI Variable Text")
    State.vehicleRegisterButton := AddPageControl("vehicle",
        gui.AddButton("x0 y0 w240 h48", "車両とルートを登録"))
    State.vehicleDeleteButton := AddPageControl("vehicle",
        gui.AddButton("x0 y0 w160 h48", "登録を削除"))
    State.vehicleRegisterButton.OnEvent("Click", BeginVehicleRegistration)
    State.vehicleDeleteButton.OnEvent("Click", DeleteVehicleRegistration)
    gui.SetFont("s9 w400 c636366", "Segoe UI Variable Text")
    State.ui.vehicleHelp := AddPageControl("vehicle", gui.AddText("x0 y0 w460 h72",
        "開始前から持っていた道具・食料・所持品は移動しません。`n"
        "登録中はW/A/S/Dで移動、矢印で視点を記録します。少しの車両移動は荷台周辺を自動探索します。"))
}

BuildSettingsPage() {
    global State, Config
    gui := State.gui
    gui.SetFont("s20 w600 c1D1D1F", "Segoe UI Variable Text")
    State.ui.settingsTitle := AddPageControl("settings", gui.AddText("x0 y0 w400 h38", "設定"))
    gui.SetFont("s9 w400 c6E6E73", "Segoe UI Variable Text")
    State.ui.settingsSubtitle := AddPageControl("settings", gui.AddText("x0 y0 w460 h36",
        "キーボード操作とバックグラウンド動作"))
    State.ui.keysSurface := AddPageControl("settings",
        gui.AddText("x0 y0 w400 h126 Disabled BackgroundFFFFFF", ""))
    gui.SetFont("s10 w400 c1C1C1E", "Segoe UI Variable Text")
    State.ui.startKeyCaption := AddPageControl("settings",
        gui.AddText("x0 y0 w150 h30 0x200 BackgroundTrans", "開始キー"))
    State.startHotkeyControl := AddPageControl("settings", gui.AddHotkey("x0 y0 w180 h32", Config.startHotkey))
    State.ui.keysSeparator := AddPageControl("settings", gui.AddText("x0 y0 w400 h1 BackgroundD1D1D6"))
    State.ui.stopKeyCaption := AddPageControl("settings",
        gui.AddText("x0 y0 w150 h30 0x200 BackgroundTrans", "停止キー"))
    State.stopHotkeyControl := AddPageControl("settings", gui.AddHotkey("x0 y0 w180 h32", Config.stopHotkey))
    State.ui.optionsSurface := AddPageControl("settings",
        gui.AddText("x0 y0 w400 h214 Disabled BackgroundFFFFFF", ""))
    State.backgroundControl := AddPageControl("settings",
        gui.AddCheckbox("x0 y0 w400 h36", "バックグラウンドで操作する"))
    State.backgroundControl.Value := Config.backgroundMode
    State.hideControl := AddPageControl("settings",
        gui.AddCheckbox("x0 y0 w400 h36", "開始後にこの画面を隠す"))
    State.hideControl.Value := Config.hideWhileRunning
    State.washCorrectionControl := AddPageControl("settings",
        gui.AddCheckbox("x0 y0 w400 h36", "洗浄・砂金採りの位置ずれを補正"))
    State.washCorrectionControl.Value := Config.washForwardCorrection && Config.goldRecoveryEnabled
    State.autoUpdateControl := AddPageControl("settings",
        gui.AddCheckbox("x0 y0 w400 h36", "起動時にアップデートを確認"))
    State.autoUpdateControl.Value := Config.autoCheckUpdates
    State.ui.minimumFreeWeightCaption := AddPageControl("settings",
        gui.AddText("x0 y0 w220 h34 0x200 BackgroundTrans", "自動収納を始める残り重量 (g)"))
    State.minimumFreeWeightControl := AddPageControl("settings",
        gui.AddEdit("x0 y0 w120 h32 Number", Config.minimumFreeWeight))
    gui.SetFont("s10 w600 c1C1C1E", "Segoe UI Variable Text")
    State.settingsButton := AddPageControl("settings", gui.AddButton("x0 y0 w220 h48 Default", "設定を保存"))
    State.settingsButton.OnEvent("Click", SaveInlineSettings)
    gui.SetFont("s9 w400 cB42318", "Segoe UI Variable Text")
    State.settingsErrorLabel := AddPageControl("settings", gui.AddText("x0 y0 w460 h44", ""))
}

BuildUpdatePage() {
    global State, AppVersion
    gui := State.gui
    gui.SetFont("s20 w600 c1D1D1F", "Segoe UI Variable Text")
    State.ui.updateTitle := AddPageControl("update", gui.AddText("x0 y0 w400 h38", "アップデート"))
    gui.SetFont("s9 w400 c636366", "Segoe UI Variable Text")
    State.ui.updateSubtitle := AddPageControl("update", gui.AddText("x0 y0 w460 h36",
        "署名を検証してから安全に更新します"))
    State.ui.updateSurface := AddPageControl("update",
        gui.AddText("x0 y0 w400 h170 Disabled BackgroundFFFFFF", ""))
    gui.SetFont("s10 w400 c1C1C1E", "Segoe UI Variable Text")
    State.ui.currentVersionCaption := AddPageControl("update",
        gui.AddText("x0 y0 w160 h30 BackgroundTrans", "現在のバージョン"))
    State.currentVersionLabel := AddPageControl("update",
        gui.AddText("x0 y0 w180 h30 Right BackgroundTrans", "v" AppVersion))
    State.ui.updateSeparator1 := AddPageControl("update", gui.AddText("x0 y0 w400 h1 BackgroundD1D1D6"))
    State.updatePageStatus := AddPageControl("update",
        gui.AddText("x0 y0 w400 h34 BackgroundTrans", "未確認"))
    State.ui.updateSeparator2 := AddPageControl("update", gui.AddText("x0 y0 w400 h1 BackgroundD1D1D6"))
    gui.SetFont("s9 w400 c636366", "Segoe UI Variable Text")
    State.ui.signatureLabel := AddPageControl("update", gui.AddText("x0 y0 w400 h42 BackgroundTrans",
        "ECDSA署名・SHA-256・起動検証・失敗時ロールバック"))
    gui.SetFont("s10 w600 c1C1C1E", "Segoe UI Variable Text")
    State.updateButton := AddPageControl("update", gui.AddButton("x0 y0 w240 h48", "アップデートを確認"))
    State.updateButton.OnEvent("Click", CheckForUpdates)
    gui.SetFont("s9 w400 c636366", "Segoe UI Variable Text")
    State.ui.updateHelp := AddPageControl("update", gui.AddText("x0 y0 w460 h64",
        "新しいバージョンがあると、この画面とサイドバーに表示します。"))
}

ShowPage(pageName, *) {
    global State
    if !State.pages.Has(pageName)
        return
    State.page := pageName
    for name, controls in State.pages {
        visible := name = pageName
        for control in controls
            control.Visible := visible
    }
    RefreshNavigationSelection()
    if pageName = "vehicle"
        RefreshVehicleUi()
    else if pageName = "update"
        RefreshUpdateUi()
    try {
        State.gui.GetPos(,, &width, &height)
        LayoutMainWindow(State.gui, 0, width, height)
    }
}

RefreshNavigationSelection() {
    global State
    ; 選択状態は青いバーで表現します。選択中の項目も通常のボタンとして
    ; 有効にしておくことで、「選択中」と「操作不能」を混同させません。
    for control in [State.ui.navOverview, State.ui.navVehicle,
        State.ui.navSettings, State.ui.navUpdate]
        control.Enabled := true
}

RunUiSmokeTest() {
    global State

    ; 装飾面が有効だと前面の透明な壁になり、下のボタンや入力欄を
    ; Windowのhit-testから隠します。実際に起きた回帰を起動テストで防ぎます。
    for surface in [State.ui.sidebarSurface, State.ui.selectionBar,
        State.ui.statusSurface, State.ui.metricsSurface, State.ui.vehicleSurface,
        State.ui.capacitySurface, State.ui.routeSurface, State.ui.keysSurface, State.ui.optionsSurface,
        State.ui.updateSurface] {
        if surface.Enabled
            return 41
    }
    for nav in [State.ui.navOverview, State.ui.navVehicle,
        State.ui.navSettings, State.ui.navUpdate] {
        if !nav.Enabled
            return 42
    }
    ; 実際のBM_CLICKを通して各ナビゲーションのイベント配線も確認します。
    ; Enabled確認だけでは見つからない無反応の配線回帰を防ぎます。
    for navCase in [
        {control: State.ui.navOverview, page: "overview"},
        {control: State.ui.navVehicle, page: "vehicle"},
        {control: State.ui.navSettings, page: "settings"},
        {control: State.ui.navUpdate, page: "update"}
    ] {
        DllCall("user32\PostMessageW", "Ptr", navCase.control.Hwnd,
            "UInt", 0x00F5, "Ptr", 0, "Ptr", 0, "Int")
        Sleep 25
        if State.page != navCase.page
            return 59
    }
    for interactive in [State.actionControl, State.mainButton,
        State.vehicleNameEdit, State.vehicleRegisterButton,
        State.backgroundControl, State.startHotkeyControl,
        State.stopHotkeyControl, State.minimumFreeWeightControl,
        State.settingsButton, State.updateButton] {
        if !interactive.Enabled
            return 57
    }
    for pageName in ["overview", "vehicle", "settings", "update"] {
        ShowPage(pageName)
        if State.page != pageName
            return 43
    }
    compactChecks := Map(
        "overview", [State.mainButton, State.ui.metricsSurface, State.footerLabel],
        "vehicle", [State.ui.vehicleSurface, State.ui.routeSurface,
            State.vehicleRegisterButton, State.vehicleDeleteButton],
        "settings", [State.ui.optionsSurface, State.settingsButton,
            State.settingsErrorLabel],
        "update", [State.ui.updateSurface, State.updateButton, State.ui.updateHelp])
    for pageName, controls in compactChecks {
        ShowPage(pageName)
        LayoutMainWindow(State.gui, 0, 520, 640)
        for control in controls {
            if !ControlFitsLayout(control, 520, 640)
                return 58
        }
    }
    try {
        CreateRegistrationOverlay(State.gui.Hwnd)
        if State.registrationKeyControls.Count != 8
            return 44
        UpdateRegistrationOverlay("車両登録　2/4", "表示テスト", "● 記録中", "info")
        UpdateRegistrationInputState(81, 1250)
        if State.registrationKeyControls["w"].control.Text != "W"
            || State.registrationKeyControls["left"].control.Text != "←"
            || State.registrationKeyControls["s"].control.Text != "S"
            return 45
        ConfigureRegistrationControlKeys(true)
        ConfigureRegistrationControlKeys(false)
    } catch as err {
        WriteDiagnostic("REGISTRATION_UI_SMOKE_ERROR=" err.Message)
        return 46
    } finally {
        CloseRegistrationOverlay()
    }
    ShowPage("overview")
    LayoutMainWindow(State.gui, 0, 820, 640)
    return 0
}

ControlFitsLayout(control, clientWidth, clientHeight) {
    try control.GetPos(&x, &y, &width, &height)
    catch
        return false
    return x >= 0 && y >= 0 && width > 0 && height > 0
        && x + width <= clientWidth && y + height <= clientHeight
}

HandleMainEscape(*) {
    global State
    if State.page != "overview"
        ShowPage("overview")
    else
        State.gui.Hide()
}

LayoutMainWindow(guiObj, minMax, width, height) {
    global State
    if minMax = -1 || !State.layoutReady && width < 100
        return
    State.ui.lastWidth := width
    State.ui.lastHeight := height
    wide := width >= 700
    margin := wide ? 24 : 16
    if wide {
        sidebarX := 16, sidebarY := 76, sidebarW := 176, sidebarH := 224
        availableW := Max(420, width - 248)
        contentW := Min(760, availableW)
        contentX := 224 + Floor((availableW - contentW) / 2)
        contentY := 20
        State.ui.sidebarSurface.Move(sidebarX, sidebarY, sidebarW, sidebarH)
        navY := [88, 140, 192, 244]
        for index, control in [State.ui.navOverview, State.ui.navVehicle,
            State.ui.navSettings, State.ui.navUpdate]
            control.Move(28, navY[index], 152, 44)
        selectedIndex := State.page = "vehicle" ? 2 : State.page = "settings" ? 3
            : State.page = "update" ? 4 : 1
        State.ui.selectionBar.Move(16, navY[selectedIndex], 4, 44)
    } else {
        sidebarX := 16, sidebarY := 60, sidebarW := width - 32, sidebarH := 52
        contentX := 16, contentY := 120, contentW := width - 32
        State.ui.sidebarSurface.Move(sidebarX, sidebarY, sidebarW, sidebarH)
        gap := 6
        navW := Floor((sidebarW - 24 - gap * 3) / 4)
        navX := sidebarX + 12
        for index, control in [State.ui.navOverview, State.ui.navVehicle,
            State.ui.navSettings, State.ui.navUpdate] {
            control.Move(navX + (index - 1) * (navW + gap), sidebarY + 6, navW, 40)
        }
        selectedIndex := State.page = "vehicle" ? 2 : State.page = "settings" ? 3
            : State.page = "update" ? 4 : 1
        State.ui.selectionBar.Move(navX + (selectedIndex - 1) * (navW + gap),
            sidebarY + 47, navW, 3)
    }

    State.ui.appTitle.Move(margin, 15, wide ? 168 : Max(260, width - 190), 30)
    State.ui.appSubtitle.Move(margin, 43, wide ? 168 : Max(300, width - 180), 20)
    State.ui.version.Move(Max(margin, width - 132), 22, 108, 22)
    State.ui.appSubtitle.Visible := wide
    ApplyRoundedControlCorners(State.ui.sidebarSurface.Hwnd, 12)

    ; 概要
    State.ui.overviewTitle.Move(contentX, contentY, contentW, 38)
    State.taglineLabel.Move(contentX, contentY + 38, contentW, 32)
    State.ui.statusSurface.Move(contentX, contentY + 76, contentW, 142)
    State.statusLabel.Move(contentX + 18, contentY + 91, contentW - 36, 32)
    State.ui.statusSeparator1.Move(contentX + 18, contentY + 127, contentW - 18, 1)
    State.connectionLabel.Move(contentX + 18, contentY + 137, contentW - 36, 28)
    State.ui.statusSeparator2.Move(contentX + 18, contentY + 174, contentW - 18, 1)
    State.modeLabel.Move(contentX + 18, contentY + 184, contentW - 36, 28)
    State.ui.actionCaption.Move(contentX, contentY + 238, 100, 24)
    State.actionControl.Move(contentX, contentY + 264, contentW, 34)
    State.mainButton.Move(contentX, contentY + 312, contentW, 50)
    State.ui.metricsSurface.Move(contentX, contentY + 382, contentW, 78)
    metricW := Floor(contentW / 3)
    State.countLabel.Move(contentX, contentY + 399, metricW, 44)
    State.mealLabel.Move(contentX + metricW, contentY + 399, metricW, 44)
    State.vehicleTripLabel.Move(contentX + metricW * 2, contentY + 399,
        contentW - metricW * 2, 44)
    State.footerLabel.Move(contentX, Min(height - 30, contentY + 478), contentW, 24)
    ApplyRoundedControlCorners(State.ui.statusSurface.Hwnd, 14)
    ApplyRoundedControlCorners(State.ui.metricsSurface.Hwnd, 12)
    ApplyRoundedControlCorners(State.mainButton.Hwnd, 12)

    ; 車両
    vehicleShift := wide ? 0 : -32
    State.ui.vehicleSubtitle.Visible := wide && State.page = "vehicle"
    State.ui.vehicleHelp.Visible := wide && State.page = "vehicle"
    State.ui.vehicleTitle.Move(contentX, contentY, contentW, 38)
    State.ui.vehicleSubtitle.Move(contentX, contentY + 38, contentW, 34)
    State.ui.vehicleSurface.Move(contentX, contentY + 76 + vehicleShift, contentW, 160)
    State.vehicleStatusLabel.Move(contentX + 18, contentY + 90 + vehicleShift, contentW - 36, 30)
    State.ui.vehicleSeparator1.Move(contentX + 18, contentY + 125 + vehicleShift, contentW - 18, 1)
    State.ui.vehicleNameCaption.Move(contentX + 18, contentY + 135 + vehicleShift, 96, 30)
    State.vehicleNameEdit.Move(contentX + 118, contentY + 134 + vehicleShift, contentW - 136, 32)
    State.ui.vehicleSeparator2.Move(contentX + 18, contentY + 175 + vehicleShift, contentW - 18, 1)
    State.vehicleEnabledControl.Move(contentX + 18, contentY + 187 + vehicleShift, contentW - 36, 34)
    State.ui.capacitySurface.Move(contentX, contentY + 250 + vehicleShift, contentW, 82)
    State.capacityStatusLabel.Move(contentX + 18, contentY + 260 + vehicleShift, contentW - 36, 24)
    State.capacityProgress.Move(contentX + 18, contentY + 289 + vehicleShift, contentW - 36, 6)
    State.capacityDetailLabel.Move(contentX + 18, contentY + 301 + vehicleShift, contentW - 36, 22)
    State.ui.routeSurface.Move(contentX, contentY + 346 + vehicleShift, contentW, 104)
    State.routeStatusLabel.Move(contentX + 18, contentY + 360 + vehicleShift, contentW - 36, 28)
    State.routeDetailLabel.Move(contentX + 18, contentY + 391 + vehicleShift, contentW - 36, 48)
    buttonGap := 12
    registerW := Max(210, Floor((contentW - buttonGap) * 0.62))
    deleteW := contentW - registerW - buttonGap
    State.vehicleRegisterButton.Move(contentX, contentY + 466 + vehicleShift, registerW, 48)
    State.vehicleDeleteButton.Move(contentX + registerW + buttonGap,
        contentY + 466 + vehicleShift, deleteW, 48)
    State.ui.vehicleHelp.Move(contentX, contentY + 528 + vehicleShift, contentW, 58)
    ApplyRoundedControlCorners(State.ui.vehicleSurface.Hwnd, 12)
    ApplyRoundedControlCorners(State.ui.capacitySurface.Hwnd, 12)
    ApplyRoundedControlCorners(State.ui.routeSurface.Hwnd, 12)
    ApplyRoundedControlCorners(State.vehicleRegisterButton.Hwnd, 12)
    ApplyRoundedControlCorners(State.vehicleDeleteButton.Hwnd, 12)

    ; 設定
    settingsShift := wide ? 0 : -32
    State.ui.settingsSubtitle.Visible := wide && State.page = "settings"
    State.ui.settingsTitle.Move(contentX, contentY, contentW, 38)
    State.ui.settingsSubtitle.Move(contentX, contentY + 38, contentW, 34)
    State.ui.keysSurface.Move(contentX, contentY + 76 + settingsShift, contentW, 126)
    State.ui.startKeyCaption.Move(contentX + 18, contentY + 90 + settingsShift, 150, 32)
    State.startHotkeyControl.Move(contentX + contentW - 208,
        contentY + 88 + settingsShift, 190, 34)
    State.ui.keysSeparator.Move(contentX + 18, contentY + 137 + settingsShift, contentW - 18, 1)
    State.ui.stopKeyCaption.Move(contentX + 18, contentY + 151 + settingsShift, 150, 32)
    State.stopHotkeyControl.Move(contentX + contentW - 208,
        contentY + 149 + settingsShift, 190, 34)
    State.ui.optionsSurface.Move(contentX, contentY + 222 + settingsShift, contentW, 214)
    for index, control in [State.backgroundControl, State.hideControl,
        State.washCorrectionControl, State.autoUpdateControl]
        control.Move(contentX + 18, contentY + 229 + settingsShift
            + (index - 1) * 39, contentW - 36, 34)
    State.ui.minimumFreeWeightCaption.Move(contentX + 18,
        contentY + 385 + settingsShift, contentW - 174, 34)
    State.minimumFreeWeightControl.Move(contentX + contentW - 148,
        contentY + 386 + settingsShift, 130, 32)
    State.settingsButton.Move(contentX, contentY + 456 + settingsShift, Min(250, contentW), 48)
    State.settingsErrorLabel.Move(contentX, contentY + 514 + settingsShift,
        contentW, wide ? 44 : 38)
    ApplyRoundedControlCorners(State.ui.keysSurface.Hwnd, 12)
    ApplyRoundedControlCorners(State.ui.optionsSurface.Hwnd, 12)
    ApplyRoundedControlCorners(State.settingsButton.Hwnd, 12)

    ; アップデート
    updateShift := wide ? 0 : -32
    State.ui.updateSubtitle.Visible := wide && State.page = "update"
    State.ui.updateTitle.Move(contentX, contentY, contentW, 38)
    State.ui.updateSubtitle.Move(contentX, contentY + 38, contentW, 34)
    State.ui.updateSurface.Move(contentX, contentY + 76 + updateShift, contentW, 170)
    State.ui.currentVersionCaption.Move(contentX + 18, contentY + 92 + updateShift, 180, 30)
    State.currentVersionLabel.Move(contentX + contentW - 198,
        contentY + 92 + updateShift, 180, 30)
    State.ui.updateSeparator1.Move(contentX + 18,
        contentY + 132 + updateShift, contentW - 18, 1)
    State.updatePageStatus.Move(contentX + 18,
        contentY + 145 + updateShift, contentW - 36, 34)
    State.ui.updateSeparator2.Move(contentX + 18,
        contentY + 184 + updateShift, contentW - 18, 1)
    State.ui.signatureLabel.Move(contentX + 18,
        contentY + 198 + updateShift, contentW - 36, 40)
    State.updateButton.Move(contentX, contentY + 270 + updateShift, Min(280, contentW), 48)
    State.ui.updateHelp.Move(contentX, contentY + 338 + updateShift, contentW, 64)
    ApplyRoundedControlCorners(State.ui.updateSurface.Hwnd, 12)
    ApplyRoundedControlCorners(State.updateButton.Hwnd, 12)
}

ApplyRoundedControlCorners(hwnd, radius := 16) {
    try {
        WinGetPos(,, &width, &height, "ahk_id " hwnd)
        if width <= 0 || height <= 0
            return
        region := DllCall("gdi32\CreateRoundRectRgn", "Int", 0, "Int", 0,
            "Int", width + 1, "Int", height + 1, "Int", radius, "Int", radius, "Ptr")
        if region
            DllCall("user32\SetWindowRgn", "Ptr", hwnd, "Ptr", region, "Int", true)
    }
}

ToggleMining(*) {
    global State
    if State.running
        StopMining()
    else
        StartMining()
}

CanStartFromHotkey(*) {
    global State
    if !AutomationStartAllowed(State.running, State.registrationActive)
        return false
    activeHwnd := WinExist("A")
    return activeHwnd && IsFiveMWindow(activeHwnd)
}

AutomationStartAllowed(running, registrationActive) {
    return !running && !registrationActive
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
    A_TrayMenu.Add("アップデート", OpenUpdatePage)
    A_TrayMenu.Add()
    A_TrayMenu.Add("終了", (*) => ExitApp())
    A_TrayMenu.Default := "AI採掘機を開く"
}

ShowMainWindow(*) {
    global State
    ; 利用者がトレイから明示的に開いた場合は、最初のクリックから操作できる
    ; よう通常表示します。自動処理側の表示は引き続きNoActivateです。
    State.gui.Show()
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
    RefreshVehicleUi()
}

UpdateActionUi() {
    global State, Config
    actionMode := State.running ? State.runMode : Config.actionMode
    if actionMode = "washing" {
        State.countLabel.Text := "石洗い回数`n" State.successes
        State.mealLabel.Text := "後退補正`n" State.nudges
        State.taglineLabel.Text := "画面を奪わず、約9秒ごとに石を洗います"
    } else if actionMode = "gold" {
        State.countLabel.Text := "砂金採り回数`n" State.successes
        State.mealLabel.Text := "位置補正`n" State.nudges
        State.taglineLabel.Text := "画面を奪わず、位置ずれも検知して砂金を採ります"
    } else {
        State.countLabel.Text := "採掘回数`n" State.successes
        State.mealLabel.Text := "食事回数`n" State.meals
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
    State.connectionLabel.Text := hwnd ? "FiveM　接続済み" : "FiveM　未接続"
    State.modeLabel.Text := Config.backgroundMode
        ? "操作　バックグラウンド（解像度に依存しません）"
        : "操作　前面のみ（画面画像で検出）"
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
    ShowPage("settings")
}

SaveInlineSettings(*) {
    global State, Config, settingsPath
    State.settingsErrorLabel.Opt("cB42318")
    if State.running {
        ; 実行中もボタン自体は反応させ、何も起きないように見える状態を避けます。
        StopMining()
        ShowPage("settings")
        State.settingsErrorLabel.Text := "自動操作を停止しました。設定を変更してから保存してください。"
        return
    }
    if State.updateOperation {
        State.settingsErrorLabel.Text := "アップデート確認が終わるまでお待ちください。"
        return
    }
    newStart := Trim(State.startHotkeyControl.Value)
    newStop := Trim(State.stopHotkeyControl.Value)
    if !IsSafeConfiguredHotkey(newStart) || !IsSafeConfiguredHotkey(newStop) {
        State.settingsErrorLabel.Text := "Fキー、またはCtrl/Alt/Shiftを組み合わせたキーを指定してください。"
        return
    }
    if StrLower(newStart) = StrLower(newStop) {
        State.settingsErrorLabel.Text := "開始キーと停止キーは別々にしてください。"
        return
    }
    newBackground := State.backgroundControl.Value ? 1 : 0
    try newMinimumFreeWeight := Integer(Trim(State.minimumFreeWeightControl.Value))
    catch {
        State.settingsErrorLabel.Text := "残り重量は250～20000gの数値で指定してください。"
        return
    }
    if newMinimumFreeWeight < 250 || newMinimumFreeWeight > 20000 {
        State.settingsErrorLabel.Text := "残り重量は250～20000gで指定してください。"
        return
    }
    if Config.vehicleStorageEnabled && !newBackground {
        State.settingsErrorLabel.Text := "車両収納を使う場合はバックグラウンド操作が必要です。"
        return
    }

    oldConfig := {
        startHotkey: Config.startHotkey,
        stopHotkey: Config.stopHotkey,
        backgroundMode: Config.backgroundMode,
        hideWhileRunning: Config.hideWhileRunning,
        autoCheckUpdates: Config.autoCheckUpdates,
        washForwardCorrection: Config.washForwardCorrection,
        goldRecoveryEnabled: Config.goldRecoveryEnabled,
        minimumFreeWeight: Config.minimumFreeWeight
    }
    UnregisterConfiguredHotkeys()
    Config.startHotkey := newStart
    Config.stopHotkey := newStop
    try RegisterConfiguredHotkeys()
    catch as err {
        Config.startHotkey := oldConfig.startHotkey
        Config.stopHotkey := oldConfig.stopHotkey
        try RegisterConfiguredHotkeys()
        State.settingsErrorLabel.Text := "そのキーは登録できません: " err.Message
        return
    }

    Config.backgroundMode := newBackground
    Config.hideWhileRunning := State.hideControl.Value ? 1 : 0
    Config.autoCheckUpdates := State.autoUpdateControl.Value ? 1 : 0
    Config.washForwardCorrection := State.washCorrectionControl.Value ? 1 : 0
    Config.goldRecoveryEnabled := State.washCorrectionControl.Value ? 1 : 0
    Config.minimumFreeWeight := newMinimumFreeWeight
    try {
        SaveAllSettingsAtomically()
    } catch as err {
        UnregisterConfiguredHotkeys()
        Config.startHotkey := oldConfig.startHotkey
        Config.stopHotkey := oldConfig.stopHotkey
        Config.backgroundMode := oldConfig.backgroundMode
        Config.hideWhileRunning := oldConfig.hideWhileRunning
        Config.autoCheckUpdates := oldConfig.autoCheckUpdates
        Config.washForwardCorrection := oldConfig.washForwardCorrection
        Config.goldRecoveryEnabled := oldConfig.goldRecoveryEnabled
        Config.minimumFreeWeight := oldConfig.minimumFreeWeight
        try RegisterConfiguredHotkeys()
        State.settingsErrorLabel.Text := "設定を保存できません: " err.Message
        return
    }
    State.footerLabel.Text := "開始 " Config.startHotkey "　停止 " Config.stopHotkey
    State.settingsErrorLabel.Opt("c248A3D")
    State.settingsErrorLabel.Text := "設定を保存しました。"
    RefreshCapacityUi()
    UpdateConnectionStatus()
}

SaveAllSettingsAtomically() {
    global Config, settingsPath
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
        IniWrite Config.goldRecoveryEnabled, temporarySettingsPath, "GoldPanning", "RecoveryEnabled"
        IniWrite Config.goldRecoveryAfterMs, temporarySettingsPath, "GoldPanning", "RecoveryAfterMs"
        IniWrite Config.goldRecoveryPulseMs, temporarySettingsPath, "GoldPanning", "RecoveryPulseMs"
        IniWrite Config.goldRecoverySettleMs, temporarySettingsPath, "GoldPanning", "RecoverySettleMs"
        IniWrite Config.vehicleStorageEnabled, temporarySettingsPath, "VehicleStorage", "Enabled"
        IniWrite Config.vehicleRegistered, temporarySettingsPath, "VehicleStorage", "Registered"
        IniWrite Config.vehicleName, temporarySettingsPath, "VehicleStorage", "DisplayName"
        IniWrite Config.vehicleStorageId, temporarySettingsPath, "VehicleStorage", "StorageId"
        IniWrite Config.vehicleStorageType, temporarySettingsPath, "VehicleStorage", "StorageType"
        IniWrite Config.vehicleWorkMode, temporarySettingsPath, "VehicleStorage", "WorkMode"
        IniWrite Config.vehicleRouteFormat, temporarySettingsPath, "VehicleStorage", "RouteFormat"
        IniWrite Config.vehicleOutboundRoute, temporarySettingsPath, "VehicleStorage", "OutboundRoute"
        IniWrite Config.vehicleReturnRoute, temporarySettingsPath, "VehicleStorage", "ReturnRoute"
        IniWrite Config.capacityCheckIntervalMs, temporarySettingsPath, "VehicleStorage", "CapacityCheckIntervalMs"
        IniWrite Config.minimumFreeWeight, temporarySettingsPath, "VehicleStorage", "MinimumFreeWeight"
        IniWrite Config.routeIdleFinishMs, temporarySettingsPath, "VehicleStorage", "RouteIdleFinishMs"
        IniWrite Config.routeSettleMs, temporarySettingsPath, "VehicleStorage", "RouteSettleMs"
        IniWrite Config.vehicleSearchPulseMs, temporarySettingsPath, "VehicleStorage", "SearchPulseMs"
        IniWrite Config.serverHealthIntervalMs, temporarySettingsPath, "Safety", "ServerHealthIntervalMs"
        FileMove temporarySettingsPath, settingsPath, true
    } catch as err {
        try FileDelete temporarySettingsPath
        throw err
    }
}

ToggleVehicleStorage(control, *) {
    global State, Config
    if State.running || State.registrationActive {
        control.Value := Config.vehicleStorageEnabled
        return
    }
    requested := control.Value ? 1 : 0
    if requested && !IsValidVehicleProfile(Config) {
        control.Value := 0
        Config.vehicleStorageEnabled := 0
        State.vehicleStatusLabel.Text := "先に車両と往復ルートを登録してください"
        return
    }
    if requested && !Config.backgroundMode {
        control.Value := 0
        State.vehicleStatusLabel.Text := "設定でバックグラウンド操作をオンにしてください"
        return
    }
    Config.vehicleStorageEnabled := requested
    try SaveAllSettingsAtomically()
    catch as err {
        Config.vehicleStorageEnabled := !requested
        control.Value := Config.vehicleStorageEnabled
        State.vehicleStatusLabel.Text := "設定を保存できません: " err.Message
        return
    }
    RefreshVehicleUi()
}

RefreshVehicleUi(*) {
    global State, Config
    if !IsObject(State.vehicleStatusLabel)
        return
    valid := IsValidVehicleProfile(Config)
    State.vehicleEnabledControl.Value := Config.vehicleStorageEnabled && valid
    State.vehicleEnabledControl.Enabled := valid
        && !State.running && !State.registrationActive
    if valid {
        State.vehicleStatusLabel.Text := "登録済み　" Config.vehicleName
        outSeconds := Round(RouteTotalMs(Config.vehicleOutboundRoute) / 1000, 1)
        backSeconds := Round(RouteTotalMs(Config.vehicleReturnRoute) / 1000, 1)
        State.routeStatusLabel.Text := "往路 " outSeconds "秒　復路 " backSeconds "秒"
        if Config.vehicleRouteFormat >= 3 {
            State.routeDetailLabel.Text := "作業: " ActionModeLabel(Config.vehicleWorkMode)
                . "　荷台の近距離自動探索: オン"
            State.vehicleRegisterButton.Text := "車両ルートを登録し直す"
        } else {
            State.routeDetailLabel.Text := "旧ルートです。荷台の再探索を使うには登録し直してください。"
            State.vehicleRegisterButton.Text := "自動探索対応へ更新"
        }
        State.vehicleDeleteButton.Enabled := !State.running && !State.registrationActive
    } else {
        legacyProfile := Config.vehicleRegistered
            && Config.vehicleRouteFormat > 0 && Config.vehicleRouteFormat < 3
        State.vehicleStatusLabel.Text := legacyProfile ? "安全更新が必要　" Config.vehicleName : "未登録"
        State.routeStatusLabel.Text := legacyProfile ? "旧方式のルートは自動再生しません" : "往復ルート　未登録"
        State.routeDetailLabel.Text := legacyProfile
            ? "視点入力方式が変わったため、車両とルートを登録し直してください。"
            : "作業場所から車両後部までの往路と復路を記録します。"
        State.vehicleRegisterButton.Text := legacyProfile ? "新方式で登録し直す" : "車両とルートを登録"
        State.vehicleDeleteButton.Enabled := false
    }
    if !State.registrationActive
        State.vehicleNameEdit.Value := Config.vehicleName
    State.vehicleRegisterButton.Enabled := !State.running && !State.registrationActive
    State.vehicleNameEdit.Enabled := !State.running && !State.registrationActive
    RefreshCapacityUi()
}

RefreshCapacityUi(*) {
    global State, Config
    if !State.ui.HasOwnProp("capacitySurface")
        return
    if State.lastInventoryMaxWeight > 0 {
        percent := Min(100, Max(0, Round(State.lastInventoryWeight * 100
            / State.lastInventoryMaxWeight)))
        State.capacityProgress.Value := percent
        State.capacityStatusLabel.Text := "所持重量　"
            FormatInventoryWeight(State.lastInventoryWeight) " / "
            FormatInventoryWeight(State.lastInventoryMaxWeight) "　" percent "%"
        State.capacityDetailLabel.Text := "残り "
            . FormatInventoryWeight(State.lastInventoryFreeWeight)
            . "　·　収納開始 " . FormatInventoryWeight(Config.minimumFreeWeight)
    } else {
        State.capacityProgress.Value := 0
        State.capacityStatusLabel.Text := "所持重量　自動操作の開始後に確認"
        State.capacityDetailLabel.Text := "残り "
            FormatInventoryWeight(Config.minimumFreeWeight) " 以下で自動収納"
    }
}

RefreshUpdateUi(*) {
    global State
    if !IsObject(State.updatePageStatus)
        return
    if State.updateOperation = "check" {
        State.updatePageStatus.Text := "新しいバージョンを確認中…"
        State.updateButton.Text := "確認中…"
    } else if State.updateOperation = "download" {
        State.updatePageStatus.Text := "v" State.updateVersion " を検証しながらダウンロード中…"
        State.updateButton.Text := "ダウンロード中…"
    } else if State.updateVersion {
        State.updatePageStatus.Text := "新しいバージョン v" State.updateVersion " があります"
        State.updateButton.Text := "ダウンロードして更新"
        State.ui.navUpdate.Text := "アップデート •"
    } else {
        if !State.updatePageStatus.Text
            State.updatePageStatus.Text := "未確認"
        State.updateButton.Text := "アップデートを確認"
        State.ui.navUpdate.Text := "アップデート"
    }
    State.updateButton.Enabled := !State.updateOperation
    if State.running && !State.updateOperation
        State.updateButton.Text := State.updateVersion ? "停止して更新" : "停止して確認"
}

ActionModeLabel(mode) {
    return mode = "washing" ? "石を洗う" : mode = "gold" ? "砂金採りトレイ" : "鉱石を採掘する"
}

BeginVehicleRegistration(*) {
    global State, Config
    if State.running || State.updateOperation || State.registrationActive
        return
    if !Config.backgroundMode {
        State.vehicleStatusLabel.Text := "設定でバックグラウンド操作をオンにしてください"
        return
    }
    targetHwnd := FindFiveMWindow()
    if !targetHwnd {
        State.vehicleStatusLabel.Text := "FiveMが見つかりません"
        return
    }
    try targetPid := WinGetPID("ahk_id " targetHwnd)
    catch
        targetPid := 0
    healthResult := RunBackgroundBridge("health")
    if !targetPid || !ParseServerHealth(healthResult, &registrationEpoch) {
        State.vehicleStatusLabel.Text := "サーバー接続を確認できません"
        WriteDiagnostic("REGISTRATION_PREFLIGHT_ERROR=" healthResult)
        return
    }
    vehicleName := Trim(StrReplace(StrReplace(State.vehicleNameEdit.Value, "`r", " "), "`n", " "))
    if !vehicleName
        vehicleName := "登録車両"
    if StrLen(vehicleName) > 40
        vehicleName := SubStr(vehicleName, 1, 40)

    State.registrationActive := true
    State.registrationCancelled := false
    State.registrationViewMask := 0
    ; 実際のルート記録中以外は移動を通さず、未記録の位置ずれを防ぎます。
    State.registrationMovementBlocked := true
    State.targetHwnd := targetHwnd
    State.targetPid := targetPid
    State.serverEpoch := registrationEpoch
    RefreshVehicleUi()
    try {
        ConfigureRegistrationControlKeys(true)
        State.gui.Hide()
        try WinRestore "ahk_id " targetHwnd
        try WinActivate "ahk_id " targetHwnd
        if !WinWaitActive("ahk_id " targetHwnd,, 3)
            throw Error("FiveMを前面にできませんでした。最小化を解除してやり直してください。")
        CreateRegistrationOverlay(targetHwnd)
        UpdateRegistrationOverlay("車両登録　1/4", "現在の作業ボタンを検出しています…",
            "● 確認中", "info")
        if !WaitRegistration(450)
            throw Error("登録を中止しました")
        if !ConfirmRegistrationStart(Config.actionMode)
            throw Error("ここでは「" ActionModeLabel(Config.actionMode) "」を確認できません。作業場所に立ってやり直してください。")

        outboundRoute := RecordMovementRoute("車両登録　2/4",
            "W/A/S/Dで車両後部へ移動し、矢印キーで荷台が見える視点へ合わせます")

        if !CaptureStorageWithGuidedAdjustment(&outboundRoute, &storageId, &storageType)
            throw Error("車両後部の「ストレージを開く」を確認できませんでした。")
        registrationReleased := ReleaseBackgroundTarget(true)
        registrationCloseResult := RunBackgroundBridge("close-inventory")
        if registrationCloseResult != "CLOSED" || !registrationReleased
            throw Error("荷台画面を安全に閉じられないため、復路の記録を開始しません。")
        if !WaitRegistration(500)
            throw Error("登録を中止しました")

        returnRoute := RecordMovementRoute("車両登録　4/4",
            "W/A/S/Dで元の位置へ戻し、矢印キーで作業対象へ視点を合わせます")
        if !ConfirmWorkWithGuidedAdjustment(&returnRoute, Config.actionMode)
            throw Error("復路の終点で作業ボタンを確認できません。往復ルートを登録し直してください。")
        VerifyVehicleRegistration(outboundRoute, returnRoute, storageId, storageType,
            Config.actionMode)

        oldProfile := {
            enabled: Config.vehicleStorageEnabled,
            registered: Config.vehicleRegistered,
            name: Config.vehicleName,
            id: Config.vehicleStorageId,
            type: Config.vehicleStorageType,
            mode: Config.vehicleWorkMode,
            routeFormat: Config.vehicleRouteFormat,
            outbound: Config.vehicleOutboundRoute,
            inbound: Config.vehicleReturnRoute
        }
        Config.vehicleName := vehicleName
        Config.vehicleStorageId := storageId
        Config.vehicleStorageType := storageType
        Config.vehicleWorkMode := Config.actionMode
        Config.vehicleRouteFormat := 3
        Config.vehicleOutboundRoute := outboundRoute
        Config.vehicleReturnRoute := returnRoute
        Config.vehicleRegistered := 1
        Config.vehicleStorageEnabled := 1
        if !IsValidVehicleProfile(Config)
            throw Error("登録データの検証に失敗しました。")
        try SaveAllSettingsAtomically()
        catch as err {
            Config.vehicleStorageEnabled := oldProfile.enabled
            Config.vehicleRegistered := oldProfile.registered
            Config.vehicleName := oldProfile.name
            Config.vehicleStorageId := oldProfile.id
            Config.vehicleStorageType := oldProfile.type
            Config.vehicleWorkMode := oldProfile.mode
            Config.vehicleRouteFormat := oldProfile.routeFormat
            Config.vehicleOutboundRoute := oldProfile.outbound
            Config.vehicleReturnRoute := oldProfile.inbound
            throw err
        }
        State.lastStorageResult := "登録完了"
        State.vehicleStatusLabel.Text := "登録が完了しました"
    } catch as err {
        if State.registrationCancelled
            State.vehicleStatusLabel.Text := "登録を中止しました"
        else
            State.vehicleStatusLabel.Text := err.Message
        WriteDiagnostic("VEHICLE_REGISTER=" err.Message)
    } finally {
        try SetRegistrationViewMask(0)
        ConfigureRegistrationControlKeys(false)
        ReleaseBackgroundTarget(true)
        RunBackgroundBridge("close-inventory")
        CloseRegistrationOverlay()
        State.registrationActive := false
        State.registrationCancelled := false
        State.targetHwnd := 0
        State.targetPid := 0
        State.serverEpoch := ""
        RefreshVehicleUi()
        ShowPage("vehicle")
        ShowMainWindow()
    }
}

CancelVehicleRegistration(*) {
    global State
    State.registrationCancelled := true
}

CreateRegistrationOverlay(targetHwnd) {
    global State
    WinGetClientPos(&gameX, &gameY, &gameW, &gameH, "ahk_id " targetHwnd)
    overlayW := Min(680, Max(240, gameW - 24))
    overlayX := gameX + Floor((gameW - overlayW) / 2)
    overlayY := gameY + 20
    overlay := Gui("+AlwaysOnTop -Caption +ToolWindow +E0x20")
    overlay.BackColor := "111318"
    overlay.MarginX := 0
    overlay.MarginY := 0
    brandW := Min(150, Max(82, Floor((overlayW - 54) * 0.45)))
    feedbackX := 30 + brandW
    feedbackW := Max(82, overlayW - feedbackX - 18)
    overlay.SetFont("s9 w600 c8E8E93", "Segoe UI Variable Text")
    overlay.AddText("x18 y10 w" brandW " h20 0x200", "AI採掘機  /  ROUTE")
    overlay.SetFont("s9 w600 c4CC9F0", "Segoe UI Variable Text")
    feedbackLabel := overlay.AddText("x" feedbackX " y10 w" feedbackW
        . " h20 Right 0x200", "準備中")
    overlay.SetFont("s15 w600 cFFFFFF", "Segoe UI Variable Text")
    titleLabel := overlay.AddText("x18 y34 w" (overlayW - 36) " h28 0x200", "車両ルートを登録")
    overlay.SetFont("s9 w400 cC7C7CC", "Segoe UI Variable Text")
    detailLabel := overlay.AddText("x18 y65 w" (overlayW - 36) " h34 0x200", "準備しています…")

    moveCenter := Floor(overlayW / 2)
    State.registrationKeyControls := Map()
    AddRegistrationKeyControl(overlay, "w", "W", 1, moveCenter - 91, 105)
    AddRegistrationKeyControl(overlay, "a", "A", 4, moveCenter - 43, 105)
    AddRegistrationKeyControl(overlay, "s", "S", 2, moveCenter + 5, 105)
    AddRegistrationKeyControl(overlay, "d", "D", 8, moveCenter + 53, 105)
    AddRegistrationKeyControl(overlay, "up", "↑", 16, moveCenter - 91, 137)
    AddRegistrationKeyControl(overlay, "left", "←", 64, moveCenter - 43, 137)
    AddRegistrationKeyControl(overlay, "down", "↓", 32, moveCenter + 5, 137)
    AddRegistrationKeyControl(overlay, "right", "→", 128, moveCenter + 53, 137)

    overlay.SetFont("s9 w600 cE5E5EA", "Segoe UI Variable Text")
    timerLabel := overlay.AddText("x18 y171 w" (overlayW - 36) " h20 Center 0x200",
        "待機中  ·  WASD 移動  ·  矢印 視点")
    overlay.SetFont("s8 w400 c8E8E93", "Segoe UI Variable Text")
    footerLabel := overlay.AddText("x18 y196 w" (overlayW - 36) " h18 Center",
        "Enter  決定      Esc  中止")
    overlay.Show("NA x" overlayX " y" overlayY " w" overlayW " h220")
    WinSetTransparent 248, "ahk_id " overlay.Hwnd
    ApplyRoundedWindowCorners(overlay.Hwnd)
    ApplyRoundedControlCorners(overlay.Hwnd, 16)
    State.registrationOverlay := overlay
    State.registrationOverlayTitle := titleLabel
    State.registrationOverlayDetail := detailLabel
    State.registrationOverlayFeedback := feedbackLabel
    State.registrationOverlayTimer := timerLabel
    State.registrationOverlayFooter := footerLabel
    State.registrationOverlayWatchFn := MaintainRegistrationOverlayVisibility
    State.registrationLastMask := -1
    SetTimer State.registrationOverlayWatchFn, 250
    UpdateRegistrationInputState(0, 0)
}

UpdateRegistrationFooter(text) {
    global State
    if IsObject(State.registrationOverlayFooter)
        State.registrationOverlayFooter.Text := text
}

AddRegistrationKeyControl(overlay, keyName, label, bit, x, y) {
    global State
    overlay.SetFont("s10 w600 cC7C7CC", "Segoe UI Variable Text")
    control := overlay.AddText("x" x " y" y " w38 h28 Center Border 0x200", label)
    State.registrationKeyControls[keyName] := {control: control, label: label, bit: bit}
}

UpdateRegistrationOverlay(title, detail := "", feedback := "", feedbackKind := "info") {
    global State
    if IsObject(State.registrationOverlayTitle)
        State.registrationOverlayTitle.Text := title
    if IsObject(State.registrationOverlayDetail)
        State.registrationOverlayDetail.Text := detail
    if IsObject(State.registrationOverlayFeedback) {
        color := feedbackKind = "success" ? "30D158"
            : feedbackKind = "error" ? "FF453A"
            : feedbackKind = "warning" ? "FF9F0A" : "4CC9F0"
        State.registrationOverlayFeedback.Opt("c" color)
        State.registrationOverlayFeedback.Text := feedback
    }
    if State.registrationMovementBlocked && IsObject(State.registrationOverlayTimer) {
        phaseText := RegExReplace(feedback, "^[●\s]+", "")
        State.registrationOverlayTimer.Text := (phaseText ? phaseText : "待機中")
            . "  ·  入力待ち"
    }
}

UpdateRegistrationInputState(mask, elapsedMs := 0) {
    global State
    if IsObject(State.registrationKeyControls) && mask != State.registrationLastMask {
        for _, info in State.registrationKeyControls {
            active := (mask & info.bit) != 0
            info.control.SetFont(active ? "s10 w700 c4CC9F0" : "s10 w600 cC7C7CC",
                "Segoe UI Variable Text")
        }
        State.registrationLastMask := mask
    }
    if IsObject(State.registrationOverlayTimer) {
        if State.registrationMovementBlocked {
            State.registrationOverlayTimer.Text := "待機中  ·  入力はまだ記録されません"
        } else {
            moving := (mask & 15) ? "移動中" : "停止"
            looking := (mask & 240) ? "視点調整中" : "視点停止"
            State.registrationOverlayTimer.Text := "記録 " Round(elapsedMs / 1000, 1)
                . "秒  ·  " moving "  ·  " looking
        }
    }
}

CloseRegistrationOverlay() {
    global State
    if IsObject(State.registrationOverlayWatchFn)
        try SetTimer State.registrationOverlayWatchFn, 0
    if IsObject(State.registrationOverlay) {
        try State.registrationOverlay.Destroy()
    }
    State.registrationOverlay := 0
    State.registrationOverlayTitle := 0
    State.registrationOverlayDetail := 0
    State.registrationOverlayFeedback := 0
    State.registrationOverlayTimer := 0
    State.registrationOverlayFooter := 0
    State.registrationOverlayWatchFn := 0
    State.registrationKeyControls := Map()
    State.registrationLastMask := -1
}

MaintainRegistrationOverlayVisibility(*) {
    global State
    if !State.registrationActive || !IsObject(State.registrationOverlay)
        return
    visible := DllCall("user32\IsWindowVisible", "Ptr", State.registrationOverlay.Hwnd, "Int") != 0
    if WinActive("ahk_id " State.targetHwnd) {
        if !visible
            ShowRegistrationOverlayAtTarget()
    } else if visible
        try State.registrationOverlay.Hide()
}

ShowRegistrationOverlayAtTarget() {
    global State
    if !IsObject(State.registrationOverlay) || !State.targetHwnd
        return false
    try {
        WinGetClientPos(&gameX, &gameY, &gameW, &gameH, "ahk_id " State.targetHwnd)
        State.registrationOverlay.GetPos(,, &overlayW, &overlayH)
        overlayX := gameX + Floor((gameW - overlayW) / 2)
        overlayY := gameY + 18
        State.registrationOverlay.Show("NA x" overlayX " y" overlayY)
        return true
    } catch
        return false
}

ConfigureRegistrationControlKeys(enabled) {
    global State
    keyNames := ["Left", "Right", "Up", "Down", "Enter", "Esc",
        "LShift", "RShift", "LControl", "RControl", "Space"]
    movementKeys := ["w", "s", "a", "d"]
    if enabled {
        State.registrationHotIf := IsVehicleRegistrationInputActive
        State.registrationMovementHotIf := IsVehicleRegistrationMovementBlocked
        registeredKeys := []
        registeredMovementKeys := []
        try {
            HotIf State.registrationHotIf
            for keyName in keyNames {
                callback := keyName = "Esc" ? CancelVehicleRegistration : BlockRegistrationControlKey
                Hotkey "$*" keyName, callback, "On"
                registeredKeys.Push(keyName)
            }
            HotIf State.registrationMovementHotIf
            for keyName in movementKeys {
                Hotkey "$*" keyName, BlockRegistrationControlKey, "On"
                registeredMovementKeys.Push(keyName)
            }
        } catch as err {
            HotIf State.registrationHotIf
            for keyName in registeredKeys
                try Hotkey "$*" keyName, "Off"
            HotIf State.registrationMovementHotIf
            for keyName in registeredMovementKeys
                try Hotkey "$*" keyName, "Off"
            throw Error("登録用キーを準備できませんでした: " err.Message)
        } finally {
            HotIf
        }
        return
    }
    try {
        if IsObject(State.registrationHotIf)
            HotIf State.registrationHotIf
        for keyName in keyNames
            try Hotkey "$*" keyName, "Off"
        if IsObject(State.registrationMovementHotIf)
            HotIf State.registrationMovementHotIf
        for keyName in movementKeys
            try Hotkey "$*" keyName, "Off"
    } finally {
        HotIf
        State.registrationHotIf := 0
        State.registrationMovementHotIf := 0
        State.registrationMovementBlocked := false
    }
}

IsVehicleRegistrationInputActive(*) {
    global State
    return State.registrationActive && State.targetHwnd
        && WinActive("ahk_id " State.targetHwnd)
}

IsVehicleRegistrationMovementBlocked(*) {
    global State
    return IsVehicleRegistrationInputActive() && State.registrationMovementBlocked
}

BlockRegistrationControlKey(*) {
    ; 矢印はDevConのdirect-lookへ変換します。未記録区間の移動と、
    ; 再生距離を変えるShift/Ctrl/Spaceも登録中だけゲームへ通しません。
}

WaitRegistration(delayMs) {
    global State
    endAt := MonotonicMs() + Max(1, delayMs)
    while MonotonicMs() < endAt {
        if State.registrationCancelled || !State.targetHwnd
            || !WinExist("ahk_id " State.targetHwnd)
            return false
        Sleep Min(30, Max(1, endAt - MonotonicMs()))
    }
    return !State.registrationCancelled
}

RecordMovementRoute(title, instruction, requireMovement := true, showCountdown := true) {
    global State
    State.registrationMovementBlocked := true
    if showCountdown {
        UpdateRegistrationFooter("Enter 記録開始 / 到着確定　　　Esc 中止")
        while GetKeyState("Enter", "P") {
            if !WaitRegistration(20)
                throw Error("登録を中止しました")
        }
        UpdateRegistrationOverlay(title,
            instruction "`nキーをすべて離し、Enterで記録を開始してください。",
            "● 開始待ち", "info")
        loop {
            if !WaitRegistration(25)
                throw Error("登録を中止しました")
            if !WinActive("ahk_id " State.targetHwnd)
                continue
            preStartMask := CurrentPhysicalRouteMask()
            unsupportedKey := CurrentUnsupportedRegistrationKey()
            UpdateRegistrationInputState(preStartMask, 0)
            if GetKeyState("Enter", "P") {
                if preStartMask || unsupportedKey {
                    UpdateRegistrationOverlay(title,
                        "W/A/S/D・矢印・Shift/Ctrl/Spaceをすべて離してから、Enterで開始してください。",
                        "キーを離してください", "warning")
                } else {
                    break
                }
            }
        }
        ; Enterを押したまま次の移動キーを押しても、そのdownはゲーム側へ
        ; 届いていません。全キーのreleaseを確認してから新しい押下で始めます。
        while GetKeyState("Enter", "P") || CurrentPhysicalRouteMask()
            || CurrentUnsupportedRegistrationKey() {
            if !WaitRegistration(20)
                throw Error("登録を中止しました")
        }
    } else {
        UpdateRegistrationFooter("W/A/S/D 位置   矢印 視点   Enter 確定   Esc 中止")
        UpdateRegistrationOverlay(title,
            instruction "`nキーをすべて離すと調整記録を開始します。",
            "● 入力待ち", "info")
        while GetKeyState("Enter", "P") || CurrentPhysicalRouteMask()
            || CurrentUnsupportedRegistrationKey() {
            if !WaitRegistration(20)
                throw Error("登録を中止しました")
        }
    }
    State.registrationMovementBlocked := false
    UpdateRegistrationOverlay(title,
        instruction "`n到着後にキーをすべて離し、Enterで確定してください。",
        "● 記録中", "info")
    segments := []
    previousMask := 0
    segmentStartedAt := MonotonicMs()
    routeStartedAt := segmentStartedAt
    movementObserved := false
    inputObserved := false
    enterWasDown := false
    lastUiAt := 0
    pausedAt := 0
    try {
        loop {
            if !WaitRegistration(25)
                throw Error("登録を中止しました")
            now := MonotonicMs()
            if !WinActive("ahk_id " State.targetHwnd) {
                ; 復帰キーや他アプリで押したWを未記録のままFiveMへ通さないよう、
                ; フォーカスが戻る前から移動を遮断して全キーreleaseを待ちます。
                State.registrationMovementBlocked := true
                if previousMask {
                    AppendRouteSegments(segments, now - segmentStartedAt, previousMask)
                    previousMask := 0
                }
                SetRegistrationViewMask(0)
                UpdateRegistrationInputState(0, now - routeStartedAt)
                UpdateRegistrationOverlay(title,
                    "記録を一時停止しました。キーを離してFiveMへ戻ると再開します。",
                    "一時停止", "warning")
                try State.registrationOverlay.Hide()
                pausedAt := now
                while !WinActive("ahk_id " State.targetHwnd) {
                    if !WaitRegistration(50)
                        throw Error("登録を中止しました")
                }
                while CurrentPhysicalRouteMask() || GetKeyState("Enter", "P")
                    || CurrentUnsupportedRegistrationKey() {
                    UpdateRegistrationInputState(CurrentPhysicalRouteMask(), now - routeStartedAt)
                    if !WaitRegistration(25)
                        throw Error("登録を中止しました")
                }
                resumedAt := MonotonicMs()
                ShowRegistrationOverlayAtTarget()
                routeStartedAt += resumedAt - pausedAt
                segmentStartedAt := resumedAt
                enterWasDown := false
                State.registrationMovementBlocked := false
                UpdateRegistrationOverlay(title,
                    instruction "`n到着後にキーをすべて離し、Enterで確定してください。",
                    "● 記録中", "info")
                continue
            }
            mask := CurrentPhysicalRouteMask()
            if (mask & 3) = 3 || (mask & 12) = 12
                || (mask & 48) = 48 || (mask & 192) = 192
                throw Error("反対方向のキーが同時に押されました。キーを一方向ずつ使ってください。")
            requestedViewMask := (mask >> 4) & 15
            if requestedViewMask != State.registrationViewMask {
                if !SetRegistrationViewMask(requestedViewMask)
                    throw Error("FiveMの視点入力へ接続できませんでした。")
                now := MonotonicMs()
            }
            maskChanged := mask != previousMask
            if maskChanged {
                duration := now - segmentStartedAt
                if duration >= 25 && (previousMask || inputObserved) {
                    ; 中間停止は慣性を止める分だけ残し、考えていた長い待ち時間は圧縮します。
                    recordedDuration := previousMask ? duration : Min(duration, 300)
                    AppendRouteSegments(segments, recordedDuration, previousMask)
                }
                previousMask := mask
                segmentStartedAt := now
                UpdateRegistrationOverlay(title,
                    instruction "`n到着後にキーをすべて離し、Enterで確定してください。",
                    "● 記録中", "info")
            }
            if mask {
                inputObserved := true
                if mask & 15
                    movementObserved := true
            }
            if now - lastUiAt >= 100 || maskChanged {
                UpdateRegistrationInputState(mask, now - routeStartedAt)
                lastUiAt := now
            }

            enterDown := GetKeyState("Enter", "P")
            if enterDown && !enterWasDown {
                if mask {
                    UpdateRegistrationOverlay(title,
                        "先にW/A/S/Dをすべて離してから、Enterを押してください。",
                        "キーを離してください", "warning")
                } else if requireMovement && !movementObserved {
                    UpdateRegistrationOverlay(title, instruction,
                        "● W/A/S/Dの移動がまだありません", "error")
                } else {
                    break
                }
            }
            enterWasDown := enterDown
            if now - routeStartedAt >= 60000
                throw Error("1区間の記録が60秒を超えたため中止しました。車両を近くへ停めてください。")
        }
    } finally {
        ; 検出・確認・保存前テスト中に未記録の移動が入らないよう、
        ; 記録ループを抜けた瞬間からW/A/S/Dを再び遮断します。
        State.registrationMovementBlocked := true
        SetRegistrationViewMask(0)
        UpdateRegistrationInputState(0, MonotonicMs() - routeStartedAt)
    }

    ; Enter確定時の無操作時間は再生しません。
    if previousMask
        AppendRouteSegments(segments, MonotonicMs() - segmentStartedAt, previousMask)
    route := ""
    for index, step in segments
        route .= (index > 1 ? "," : "") step
    while GetKeyState("Enter", "P") || CurrentPhysicalRouteMask()
        || CurrentUnsupportedRegistrationKey() {
        if !WaitRegistration(20)
            throw Error("登録を中止しました")
    }
    if !route && !requireMovement
        return ""
    if !IsValidRoute(route, requireMovement, requireMovement ? 150 : 25)
        throw Error(requireMovement ? "移動が短すぎるか、ルートを正しく記録できませんでした。"
            : "立ち位置の調整を正しく記録できませんでした。")
    return route
}

ConfirmRegistrationStart(actionMode) {
    loop 8 {
        UpdateRegistrationOverlay("車両登録　1/4", "現在の作業ボタンを検出しています…",
            "● 再検出中", "info")
        if ProbeWorkTarget(actionMode) {
            UpdateRegistrationOverlay("1/4  作業場所を確認", "作業ボタンを認識しました。",
                "● 作業ボタンを検出", "success")
            return WaitRegistration(650)
        }
        UpdateRegistrationOverlay("車両登録　1/4",
            "まだ見つかりません。W/A/S/Dで立ち位置、矢印キーで視点を調整してください。",
            "作業ボタン未検出", "warning")
        ; ここでの調整後の位置・視点が往路の起点になるため、調整断片自体は保存しません。
        RecordMovementRoute("車両登録　1/4",
            "作業ボタンが画面内に入るよう開始位置を調整します", false, false)
    }
    return false
}

CaptureStorageWithGuidedAdjustment(&route, &storageId, &storageType) {
    global State
    loop 8 {
        UpdateRegistrationOverlay("車両登録　3/4", "「ストレージを開く」を検出しています…",
            "● 再検出中", "info")
        if OpenStorageAndCapture(&storageId, &storageType) {
            UpdateRegistrationOverlay("車両登録　3/4", "車両とストレージを確認しました。",
                "● ストレージを検出", "success")
            return WaitRegistration(650)
        }
        UpdateRegistrationOverlay("車両登録　3/4",
            "まだ見つかりません。車両後部へ寄り、矢印キーで下向きに合わせてください。",
            "荷台ターゲット未検出", "warning")
        adjustment := RecordMovementRoute("車両登録　3/4",
            "ストレージが画面内に入るよう微調整します", false, false)
        route := CombineRoutes(route, adjustment)
        if !IsValidRoute(route)
            throw Error("往路が長すぎるか、調整データを保存できませんでした。")
    }
    return false
}

ConfirmWorkWithGuidedAdjustment(&route, actionMode) {
    global State
    loop 8 {
        UpdateRegistrationOverlay("車両登録　4/4", "元の作業ボタンを検出しています…",
            "● 再検出中", "info")
        if ProbeWorkTarget(actionMode) {
            UpdateRegistrationOverlay("車両登録　4/4", "作業場所を確認しました。続いて往復テストを行います。",
                "● 作業ボタンを検出", "success")
            return WaitRegistration(650)
        }
        UpdateRegistrationOverlay("車両登録　4/4",
            "まだ見つかりません。W/A/S/Dで立ち位置、矢印キーで視点を調整してください。",
            "作業ボタン未検出", "warning")
        adjustment := RecordMovementRoute("車両登録　4/4",
            "作業ボタンが画面内に入るよう微調整します", false, false)
        route := CombineRoutes(route, adjustment)
        if !IsValidRoute(route)
            throw Error("復路が長すぎるか、調整データを保存できませんでした。")
    }
    return false
}

VerifyVehicleRegistration(outboundRoute, returnRoute, storageId, storageType, actionMode) {
    UpdateRegistrationFooter("往復テスト中は操作しないでください　　　Esc 中止")
    UpdateRegistrationOverlay("確認テスト", "記録した移動で車両へ向かいます。操作せずお待ちください。",
        "● 往路を再生", "info")
    if !PlayRegistrationRoute(outboundRoute)
        throw Error("保存前テストで車両まで移動できませんでした。ルートを登録し直してください。")

    UpdateRegistrationOverlay("保存前の往復テスト", "登録した車両ストレージを照合しています…",
        "● 車両を確認", "info")
    if !OpenStorageAndCapture(&testStorageId, &testStorageType) {
        ReleaseBackgroundTarget(true)
        RunBackgroundBridge("close-inventory")
        throw Error("保存前テストで車両ストレージを検出できませんでした。安全のため自動復路は再生しません。手動で作業場所へ戻ってください。")
    }
    if testStorageId != storageId || testStorageType != storageType {
        ReleaseBackgroundTarget(true)
        RunBackgroundBridge("close-inventory")
        throw Error("保存前テストで別のストレージを検出しました。安全のため自動復路は再生しません。手動で作業場所へ戻ってください。")
    }
    verificationReleased := ReleaseBackgroundTarget(true)
    verificationCloseResult := RunBackgroundBridge("close-inventory")
    if verificationCloseResult != "CLOSED" || !verificationReleased
        throw Error("保存前テストで荷台画面を閉じられませんでした。自動復路は再生しません。手動で作業場所へ戻ってください。")

    UpdateRegistrationOverlay("保存前の往復テスト", "記録した復路と視点で作業場所へ戻ります。",
        "● 復路を再生", "info")
    if !PlayRegistrationRoute(returnRoute)
        throw Error("保存前テストで作業場所へ戻れませんでした。入力を解除しました。")

    UpdateRegistrationOverlay("保存前の往復テスト", "復帰先の作業ボタンを照合しています…",
        "● 作業場所を確認", "info")
    if !ProbeWorkTarget(actionMode)
        throw Error("保存前テストの復帰位置で作業ボタンを検出できませんでした。")
    UpdateRegistrationOverlay("登録完了", "往路・車両・復路・作業場所の実動作を確認しました。",
        "● 往復テスト成功", "success")
    if !WaitRegistration(850)
        throw Error("登録を中止しました")
}

PlayRegistrationRoute(route) {
    global State, Config
    if !IsValidRoute(route) || !State.registrationActive || State.registrationCancelled
        return false
    if !EnsureDevConPort()
        return false
    port := State.lastDevConPort
    routeStartedAt := MonotonicMs()
    result := RunBackgroundBridgeCancelable(0,
        "play-route-health", port, route, State.serverEpoch)
    elapsedMs := MonotonicMs() - routeStartedAt
    if !RegExMatch(result, "^ROUTE (29200|29300) (\d+)$", &parts)
        return false
    totalMs := parts[2] + 0
    return totalMs = RouteTotalMs(route) && elapsedMs + 250 >= totalMs
        && WaitRegistration(Config.routeSettleMs)
}

SetRegistrationViewMask(mask) {
    global State
    mask := Integer(mask)
    if mask < 0 || mask > 15 || (mask & 3) = 3 || (mask & 12) = 12
        return false
    if mask = State.registrationViewMask
        return true
    if !EnsureDevConPort()
        return false
    port := State.lastDevConPort
    result := RunBridgeForContext(0, "set-view", port, mask)
    if result != "VIEW " port " " mask {
        WriteDiagnostic("REGISTRATION_VIEW_ERROR=" result)
        releaseResult := RunBackgroundBridge("deactivate-" port)
        if releaseResult != "RELEASED" {
            Sleep 75
            releaseResult := RunBackgroundBridge("deactivate-" port)
        }
        WriteDiagnostic("REGISTRATION_VIEW_RELEASE=" releaseResult)
        State.registrationViewMask := 0
        return false
    }
    State.registrationViewMask := mask
    return true
}

CurrentPhysicalMovementMask() {
    mask := 0
    if GetKeyState("w", "P")
        mask |= 1
    if GetKeyState("s", "P")
        mask |= 2
    if GetKeyState("a", "P")
        mask |= 4
    if GetKeyState("d", "P")
        mask |= 8
    return mask
}

CurrentPhysicalRouteMask() {
    mask := CurrentPhysicalMovementMask()
    if GetKeyState("Up", "P")
        mask |= 16
    if GetKeyState("Down", "P")
        mask |= 32
    if GetKeyState("Left", "P")
        mask |= 64
    if GetKeyState("Right", "P")
        mask |= 128
    return mask
}

CurrentUnsupportedRegistrationKey() {
    for keyName in ["LShift", "RShift", "LControl", "RControl", "Space"] {
        if GetKeyState(keyName, "P")
            return keyName
    }
    return ""
}

AppendRouteSegments(segments, duration, mask) {
    duration := Round(duration)
    while duration > 3000 {
        segments.Push("3000:" mask)
        duration -= 3000
    }
    if duration >= 25
        segments.Push(duration ":" mask)
}

CombineRoutes(firstRoute, secondRoute) {
    firstRoute := Trim(String(firstRoute), " ,")
    secondRoute := Trim(String(secondRoute), " ,")
    return !firstRoute ? secondRoute : !secondRoute ? firstRoute : firstRoute "," secondRoute
}

ProbeWorkTarget(actionMode, expectedGeneration := 0) {
    probeMode := actionMode = "washing" ? "probe-washing"
        : actionMode = "gold" ? "probe-gold" : "probe-mining"
    expected := actionMode = "washing" ? "PRESENT WASH"
        : actionMode = "gold" ? "PRESENT GOLD" : "PRESENT MINE"
    return ProbeTargetOption(probeMode, expected, expectedGeneration)
}

ProbeTargetOption(probeMode, expectedResult, expectedGeneration := 0) {
    global State
    if !ReleaseBackgroundTarget(true)
        return false
    activateResult := RunBridgeForContext(expectedGeneration, "activate")
    if !RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &portMatch)
        return false
    State.backgroundTargetActive := true
    State.backgroundDevConPort := portMatch[1] + 0
    State.lastDevConPort := State.backgroundDevConPort
    Sleep 350
    if expectedGeneration && !IsCurrentRun(expectedGeneration) {
        ReleaseBackgroundTarget(true)
        return false
    }
    result := RunBridgeForContext(expectedGeneration, probeMode)
    released := ReleaseBackgroundTarget(true)
    return released && result = expectedResult
}

OpenStorageAndCapture(&storageId, &storageType, expectedGeneration := 0) {
    global State
    storageId := ""
    storageType := ""
    State.lastStorageProbeResult := ""
    ; 以前の入力を先に解放し、rightInventoryを誤認しないよう閉じた状態から開始します。
    if !ReleaseBackgroundTarget(true) {
        State.lastStorageProbeResult := "ERROR INPUT_RELEASE"
        return false
    }
    closeResult := RunBridgeForContext(expectedGeneration, "close-inventory")
    if closeResult != "CLOSED" {
        State.lastStorageProbeResult := closeResult
        return false
    }
    activateResult := RunBridgeForContext(expectedGeneration, "activate")
    if !RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &portMatch) {
        State.lastStorageProbeResult := activateResult
        return false
    }
    State.backgroundTargetActive := true
    State.backgroundDevConPort := portMatch[1] + 0
    State.lastDevConPort := State.backgroundDevConPort
    Sleep 350
    probeResult := RunBridgeForContext(expectedGeneration, "probe-storage")
    State.lastStorageProbeResult := probeResult
    if probeResult != "PRESENT STORAGE" {
        if !ReleaseBackgroundTarget(true)
            State.lastStorageProbeResult := "ERROR INPUT_RELEASE"
        return false
    }
    clickResult := RunBridgeForContext(expectedGeneration, "click-storage")
    State.lastStorageProbeResult := clickResult
    if clickResult != "CLICKED STORAGE" {
        CloseInventoryAfterStorageFailure(clickResult)
        return false
    }
    if !ReleaseBackgroundTarget(true) {
        State.lastStorageProbeResult := "ERROR INPUT_RELEASE"
        CloseInventoryAfterStorageFailure(State.lastStorageProbeResult)
        return false
    }
    deadline := MonotonicMs() + 5000
    while MonotonicMs() < deadline {
        if expectedGeneration && !IsCurrentRun(expectedGeneration) {
            CloseInventoryAfterStorageFailure(State.lastStorageProbeResult)
            return false
        }
        if State.registrationActive && State.registrationCancelled {
            CloseInventoryAfterStorageFailure(State.lastStorageProbeResult)
            return false
        }
        if !State.registrationActive && !State.running {
            CloseInventoryAfterStorageFailure(State.lastStorageProbeResult)
            return false
        }
        capture := RunBridgeForContext(expectedGeneration, "capture-storage")
        State.lastStorageProbeResult := capture
        if ParseStorageCapture(capture, &storageInfo) {
            storageId := storageInfo.id
            storageType := storageInfo.type
            State.lastStorageProbeResult := "CAPTURED STORAGE"
            return true
        }
        Sleep 180
    }
    CloseInventoryAfterStorageFailure(State.lastStorageProbeResult)
    return false
}

CloseInventoryAfterStorageFailure(originalResult) {
    global State
    released := ReleaseBackgroundTarget(true)
    closeResult := RunBackgroundBridge("close-inventory")
    State.lastStorageProbeResult := closeResult != "CLOSED" ? closeResult
        : !released ? "ERROR INPUT_RELEASE" : originalResult
    return closeResult = "CLOSED" && released
}

RunBridgeForContext(expectedGeneration, mode, bridgeArgs*) {
    global State
    return expectedGeneration || State.registrationActive
        ? RunBackgroundBridgeCancelable(expectedGeneration, mode, bridgeArgs*)
        : RunBackgroundBridgeArgs(mode, bridgeArgs*)
}

ParseStorageCapture(result, &storageInfo) {
    storageInfo := 0
    if !RegExMatch(result,
        "^STORAGE ([A-Za-z0-9+/]+={0,2}) ([A-Za-z0-9+/]+={0,2}) (\d+) (\d+) (\d+) (\d+)$", &parts)
        return false
    if !IsValidBase64Token(parts[1]) || parts[2] != "dHJ1bms="
        return false
    storageInfo := {
        id: parts[1], type: parts[2], weight: parts[3] + 0,
        maxWeight: parts[4] + 0, used: parts[5] + 0, slots: parts[6] + 0
    }
    return storageInfo.maxWeight > 0 && storageInfo.slots > 0
}

DeleteVehicleRegistration(*) {
    global State, Config
    if State.running || State.registrationActive || !IsValidVehicleProfile(Config)
        return
    if !State.ui.HasOwnProp("deleteArmed") || !State.ui.deleteArmed {
        State.ui.deleteArmed := true
        State.vehicleDeleteButton.Text := "もう一度押して削除"
        State.vehicleStatusLabel.Text := "登録だけを削除します。5秒以内にもう一度押してください。"
        SetTimer ResetVehicleDeleteConfirmation, -5000
        return
    }
    ResetVehicleDeleteConfirmation()
    Config.vehicleStorageEnabled := 0
    Config.vehicleRegistered := 0
    Config.vehicleStorageId := ""
    Config.vehicleStorageType := ""
    Config.vehicleRouteFormat := 0
    Config.vehicleOutboundRoute := ""
    Config.vehicleReturnRoute := ""
    try SaveAllSettingsAtomically()
    catch as err {
        State.vehicleStatusLabel.Text := "登録を削除できません: " err.Message
        return
    }
    State.lastStorageResult := "登録なし"
    RefreshVehicleUi()
}

ResetVehicleDeleteConfirmation(*) {
    global State
    State.ui.deleteArmed := false
    if IsObject(State.vehicleDeleteButton)
        State.vehicleDeleteButton.Text := "登録を削除"
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
        washForwardCorrection: Config.washForwardCorrection,
        goldRecoveryEnabled: Config.goldRecoveryEnabled
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
    Config.goldRecoveryEnabled := washCorrectionControl.Value ? 1 : 0
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
        IniWrite Config.goldRecoveryEnabled, temporarySettingsPath, "GoldPanning", "RecoveryEnabled"
        IniWrite Config.goldRecoveryAfterMs, temporarySettingsPath, "GoldPanning", "RecoveryAfterMs"
        IniWrite Config.goldRecoveryPulseMs, temporarySettingsPath, "GoldPanning", "RecoveryPulseMs"
        IniWrite Config.goldRecoverySettleMs, temporarySettingsPath, "GoldPanning", "RecoverySettleMs"
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
        Config.goldRecoveryEnabled := oldConfig.goldRecoveryEnabled
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
    global State
    ShowPage("update")
    if State.running {
        StopMining()
        ShowPage("update")
        State.updatePageStatus.Text := "自動操作を停止しました。更新を確認します。"
    }
    if State.updateVersion && FileExist(State.updateManifestPath)
        && FileExist(State.updateSignaturePath)
        BeginUpdateDownload()
    else
        BeginUpdateCheck(false)
}

OpenUpdatePage(*) {
    global State
    ShowMainWindow()
    ShowPage("update")
    ; 起動時の静かな確認で見つかった更新も、利用者が画面の
    ; 「ダウンロードして更新」を押すまでは適用しません。
    if !State.updateVersion && !State.updateOperation
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
        State.updatePageStatus.Text := "更新機能は配布版EXEで利用できます"
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
        State.updatePageStatus.Text := "新しいバージョンを確認中…"
        if !silent
            State.statusLabel.Text := "●  新しいバージョンを確認中"
        RefreshUpdateUi()
    } catch as err {
        State.updateOperation := ""
        State.updateButton.Enabled := true
        State.statusLabel.Text := "●  更新確認を開始できません"
        State.updatePageStatus.Text := "更新確認を開始できませんでした"
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
    RefreshUpdateUi()
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
        State.updatePageStatus.Text := "最新バージョンです"
        CleanupUpdateStage()
        RefreshUpdateUi()
        return
    }
    if status = "NOT_PUBLISHED" {
        State.updatePageStatus.Text := "公開済みアップデートはありません"
        if !silent
            State.statusLabel.Text := "●  公開済みアップデートはありません"
        CleanupUpdateStage()
        RefreshUpdateUi()
        return
    }
    if status != "UPDATE_AVAILABLE" {
        WriteDiagnostic("UPDATE_CHECK_ERROR=" message)
        securityIssue := InStr(StrLower(message), "signature")
            || InStr(StrLower(message), "public key")
            || InStr(StrLower(message), "security")
        State.updatePageStatus.Text := securityIssue
            ? "安全でない更新を拒否しました" : "更新情報を確認できませんでした"
        if !silent || securityIssue {
            State.statusLabel.Text := securityIssue
                ? "●  安全でない更新を拒否しました" : "●  更新を確認できません"
        }
        CleanupUpdateStage()
        RefreshUpdateUi()
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
    State.updatePageStatus.Text := "新しいバージョン v" State.updateVersion " があります"
    RefreshUpdateUi()
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
        RefreshUpdateUi()
    } catch as err {
        FinishUpdateOperation()
        CleanupUpdateStage()
        State.statusLabel.Text := "●  ダウンロードを開始できません"
        State.updatePageStatus.Text := "ダウンロードを開始できませんでした"
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
        State.updatePageStatus.Text := "更新ファイルの検証に失敗しました"
        WriteDiagnostic("UPDATE_DOWNLOAD_ERROR=" message)
        CleanupUpdateStage()
        RefreshUpdateUi()
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
        State.updatePageStatus.Text := "更新を適用できませんでした"
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

    ; UI・トレイ・設定可能なショートカットのどこから呼ばれても、
    ; 車両登録と通常自動操作を同じbridge/state上で同時実行しません。
    if !AutomationStartAllowed(State.running, State.registrationActive)
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
    if Config.vehicleStorageEnabled {
        if !Config.backgroundMode {
            State.statusLabel.Text := "車両収納にはバックグラウンド操作が必要です"
            return
        }
        if !IsValidVehicleProfile(Config) {
            State.statusLabel.Text := "車両と往復ルートを登録してから開始してください"
            ShowPage("vehicle")
            return
        }
        if Config.vehicleWorkMode != Config.actionMode {
            State.statusLabel.Text := "この作業用の車両ルートを登録し直してください"
            ShowPage("vehicle")
            return
        }
    }

    targetHwnd := FindFiveMWindow()
    if !targetHwnd {
        State.statusLabel.Text := "●  FiveMが見つかりません"
        State.connectionLabel.Text := "FiveM: 未接続"
        return
    }
    try targetPid := WinGetPID("ahk_id " targetHwnd)
    catch
        targetPid := 0
    if !targetPid {
        State.statusLabel.Text := "●  FiveMのプロセスを確認できません"
        return
    }
    preflightHealth := RunBackgroundBridge("health")
    if !ParseServerHealth(preflightHealth, &serverEpoch) {
        State.statusLabel.Text := "●  サーバー接続を確認できないため開始しません"
        State.connectionLabel.Text := "FiveM　サーバー未接続"
        WriteDiagnostic("SERVER_PREFLIGHT_ERROR=" preflightHealth)
        return
    }

    Critical "On"
    try {
    State.running := true
    State.runMode := Config.actionMode
    State.generation += 1
    runGeneration := State.generation
    State.targetHwnd := targetHwnd
    State.targetPid := targetPid
    State.successes := 0
    State.attempts := 0
    State.meals := 0
    State.nudges := 0
    State.washNudgePending := false
    ResetGoldRecoveryState()
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
    State.automationPhase := "preparing"
    State.inventoryBaseline := ""
    State.workpointProbeFailures := 0
    State.nextCapacityCheckAt := 0
    State.capacityProbeFailures := 0
    State.serverEpoch := serverEpoch
    State.serverHealthFailures := 0
    State.nextServerHealthAt := MonotonicMs() + Config.serverHealthIntervalMs
    State.lastInventoryWeight := 0
    State.lastInventoryMaxWeight := 0
    State.lastInventoryFreeWeight := 0
    State.lastCapacityReason := "監視中"
    State.mainButton.Text := "自動操作を停止"
    State.actionControl.Enabled := false
    SetConfigurationEnabled(false)
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
        releaseOk := ReleaseBackgroundTarget(true)
        if !IsCurrentRun(runGeneration)
            return
        WriteDiagnostic("BG_START_RELEASE=" (releaseOk ? "RELEASED" : "FAILED"))
        if !releaseOk {
            StopMining()
            State.statusLabel.Text := "開始前の入力解除を確認できないため安全停止しました"
            return
        }
    }

    if Config.vehicleStorageEnabled && IsCurrentRun(runGeneration) {
        State.statusLabel.Text := "開始時の所持品を保護しています"
        snapshotResult := RunBackgroundBridge("inventory-snapshot")
        if !ParseInventorySnapshot(snapshotResult, &inventoryInfo) {
            WriteDiagnostic("INVENTORY_BASELINE_ERROR=" snapshotResult)
            StopMining()
            State.statusLabel.Text := "インベントリ状態を取得できないため開始しませんでした"
            ShowPage("vehicle")
            return
        }
        State.inventoryBaseline := inventoryInfo.items
        UpdateInventoryCapacityState(inventoryInfo)
        if CapacityNeedsStorage(inventoryInfo, &startReason, &startFreeWeight) {
            WriteDiagnostic("INVENTORY_START_CAPACITY reason=" startReason
                " free=" startFreeWeight)
            StopMining()
            State.statusLabel.Text := startReason = "weight"
                ? "開始時点で残り重量が少ないため開始しませんでした"
                : "開始時点で空きスロットがないため開始しませんでした"
            ShowPage("vehicle")
            return
        }
        State.nextCapacityCheckAt := MonotonicMs() + Config.capacityCheckIntervalMs
        WriteDiagnostic("INVENTORY_BASELINE weight=" inventoryInfo.weight
            " max=" inventoryInfo.maxWeight " used=" inventoryInfo.used)
    }

    if !Config.backgroundMode && IsCurrentRun(runGeneration)
        && !WinActive("ahk_id " targetHwnd) {
        try WinActivate "ahk_id " targetHwnd
    }

    if IsCurrentRun(runGeneration)
        State.automationPhase := "working"
    if IsCurrentRun(runGeneration)
        ScheduleNext(runGeneration, 900)
}

StopMining(*) {
    global State

    previousPhase := State.automationPhase
    State.running := false
    State.generation += 1
    State.automationPhase := "stopped"
    State.inventoryBaseline := ""
    State.capacityProbeFailures := 0
    State.workpointProbeFailures := 0
    State.serverEpoch := ""
    State.serverHealthFailures := 0
    State.nextServerHealthAt := 0
    State.targetPid := 0

    if IsObject(State.timerFn) {
        try SetTimer(State.timerFn, 0)
    }
    State.timerFn := 0

    CancelActiveBridgeProcess()
    ReleaseAllInputs()
    ReleaseBackgroundTarget(true)
    ; 収納中の停止はUIを閉じ、bridge側の次スタック処理もfail-closedさせます。
    if previousPhase = "depositing"
        RunBackgroundBridge("close-inventory")
    State.mainButton.Text := "自動操作を開始"
    State.actionControl.Enabled := true
    SetConfigurationEnabled(true)
    State.statusLabel.Text := "●  停止中"
    UpdateActionUi()
    State.gui.Show("NoActivate")
    UpdateConnectionStatus()
}

SetConfigurationEnabled(enabled) {
    global State
    for control in [State.startHotkeyControl, State.stopHotkeyControl,
        State.backgroundControl, State.hideControl,
        State.washCorrectionControl, State.autoUpdateControl, State.vehicleEnabledControl,
        State.vehicleRegisterButton, State.vehicleNameEdit,
        State.minimumFreeWeightControl] {
        try control.Enabled := enabled
    }
    ; 実行中もナビゲーションと主要ボタンは押せます。変更操作を選んだ時点で
    ; 明示的に停止し、無反応に見えるDisabledボタンを作りません。
    try State.settingsButton.Enabled := true
    try State.settingsButton.Text := enabled ? "設定を保存" : "停止して設定を変更"
    if enabled
        RefreshVehicleUi()
    else
        try State.vehicleDeleteButton.Enabled := false
    RefreshUpdateUi()
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

ParseServerHealth(result, &epoch) {
    epoch := ""
    if !RegExMatch(result, "^HEALTH READY ([A-Za-z0-9_-]{8,512})$", &parts)
        return false
    epoch := parts[1]
    return true
}

ValidateServerEpochCheckpoint(expectedGeneration, checkpoint) {
    global State
    if !IsCurrentRun(expectedGeneration) || !State.serverEpoch
        return false
    if !IsTargetIdentityAlive()
        return false
    healthResult := RunBackgroundBridgeCancelable(expectedGeneration, "health")
    if !ParseServerHealth(healthResult, &epoch) || epoch != State.serverEpoch {
        WriteDiagnostic("SERVER_CHECKPOINT_ERROR point=" checkpoint
            " expected=" State.serverEpoch " result=" healthResult)
        return false
    }
    return true
}

IsTargetIdentityAlive() {
    global State
    if !State.targetHwnd || !State.targetPid || !WinExist("ahk_id " State.targetHwnd)
        return false
    try return WinGetPID("ahk_id " State.targetHwnd) = State.targetPid
    catch
        return false
}

MaybeHandleServerHealth(expectedGeneration) {
    global State, Config
    if !IsCurrentRun(expectedGeneration)
        return true
    if !IsTargetIdentityAlive() {
        StopAutomationWithFault("FiveMが終了したため自動停止しました")
        return true
    }
    now := MonotonicMs()
    if now < State.nextServerHealthAt
        return false

    State.automationPhase := "server_health"
    healthResult := RunBackgroundBridgeCancelable(expectedGeneration, "health")
    if !IsCurrentRun(expectedGeneration)
        return true
    if ParseServerHealth(healthResult, &epoch) {
        if State.serverEpoch && epoch != State.serverEpoch {
            WriteDiagnostic("SERVER_EPOCH_CHANGED old=" State.serverEpoch " new=" epoch)
            StopAutomationWithFault("サーバー再起動または再接続を検知したため自動停止しました")
            return true
        }
        State.serverEpoch := epoch
        State.serverHealthFailures := 0
        State.nextServerHealthAt := now + Config.serverHealthIntervalMs
        State.connectionLabel.Text := "FiveM　サーバー接続中"
        State.automationPhase := "working"
        return false
    }

    State.serverHealthFailures += 1
    State.nextServerHealthAt := now + 900
    WriteDiagnostic("SERVER_HEALTH_ERROR attempt=" State.serverHealthFailures
        " result=" healthResult)
    if State.serverHealthFailures >= 3 {
        StopAutomationWithFault("サーバー再起動または切断を検知したため自動停止しました")
        return true
    }
    State.statusLabel.Text := "接続状態を確認中（" State.serverHealthFailures "/3）"
    State.connectionLabel.Text := "FiveM　応答待ち"
    ScheduleNext(expectedGeneration, 1000)
    return true
}

MaybeHandleVehicleCapacity(expectedGeneration) {
    global State, Config
    if !Config.vehicleStorageEnabled || !IsCurrentRun(expectedGeneration)
        return false
    now := MonotonicMs()
    if now < State.nextCapacityCheckAt
        return false
    State.nextCapacityCheckAt := now + Config.capacityCheckIntervalMs
    State.automationPhase := "capacity_check"
    snapshotResult := RunBackgroundBridgeCancelable(expectedGeneration, "inventory-snapshot")
    if !IsCurrentRun(expectedGeneration)
        return true
    if !ParseInventorySnapshot(snapshotResult, &inventoryInfo) {
        State.capacityProbeFailures += 1
        WriteDiagnostic("CAPACITY_PROBE_ERROR=" snapshotResult)
        if State.capacityProbeFailures >= 3 {
            StopAutomationWithFault("インベントリ状態を確認できないため安全停止しました", "vehicle")
            return true
        }
        State.statusLabel.Text := "所持重量を再確認中（" State.capacityProbeFailures "/3）"
        State.nextCapacityCheckAt := MonotonicMs() + 850
        ScheduleNext(expectedGeneration, 950)
        return true
    }
    State.capacityProbeFailures := 0
    UpdateInventoryCapacityState(inventoryInfo)
    needsStorage := CapacityNeedsStorage(inventoryInfo, &capacityReason, &freeWeight)
    if !needsStorage {
        State.automationPhase := "working"
        return false
    }
    if !InventorySpecHasIncrease(inventoryInfo.items, State.inventoryBaseline) {
        StopAutomationWithFault("開始前の持ち物で容量が不足しています。所持品を整理してください", "vehicle")
        return true
    }
    State.lastCapacityReason := capacityReason = "weight"
        ? "残り重量が設定値以下" : "空きスロットなし"
    WriteDiagnostic("VEHICLE_CAPACITY_TRIGGER reason=" capacityReason
        " weight=" inventoryInfo.weight " max=" inventoryInfo.maxWeight
        " free=" freeWeight " used=" inventoryInfo.used " slots=" inventoryInfo.slots)
    if !ProbeWorkTarget(State.runMode, expectedGeneration) {
        ; 再出現待ちや洗浄・砂金の位置ずれ中に、登録起点前提のルートを
        ; 再生しません。容量不足中は追加採集も止めたまま再確認します。
        State.workpointProbeFailures += 1
        State.nextCapacityCheckAt := 0
        State.automationPhase := "verify_workpoint"
        State.statusLabel.Text := "収納前に登録した作業位置を確認中（"
            State.workpointProbeFailures "/10）"
        WriteDiagnostic("VEHICLE_WORKPOINT_PENDING attempt=" State.workpointProbeFailures)
        if State.workpointProbeFailures >= 10 {
            StopAutomationWithFault("登録した作業位置を確認できないため安全停止しました", "vehicle")
            return true
        }
        ScheduleNext(expectedGeneration, 850)
        return true
    }
    State.workpointProbeFailures := 0
    State.timerFn := 0
    RunVehicleStorageCycle(expectedGeneration)
    return true
}

CapacityNeedsStorage(inventoryInfo, &reason, &freeWeight) {
    global Config
    reason := ""
    freeWeight := Max(0, inventoryInfo.maxWeight - inventoryInfo.weight)
    if freeWeight <= Config.minimumFreeWeight {
        reason := "weight"
        return true
    }
    if inventoryInfo.used >= inventoryInfo.slots {
        reason := "slots"
        return true
    }
    return false
}

UpdateInventoryCapacityState(inventoryInfo) {
    global State, Config
    State.lastInventoryWeight := inventoryInfo.weight
    State.lastInventoryMaxWeight := inventoryInfo.maxWeight
    State.lastInventoryFreeWeight := Max(0, inventoryInfo.maxWeight - inventoryInfo.weight)
    State.lastCapacityReason := "残り " . FormatInventoryWeight(State.lastInventoryFreeWeight)
        . "（収納開始 " . FormatInventoryWeight(Config.minimumFreeWeight) . "）"
    RefreshCapacityUi()
}

FormatInventoryWeight(value) {
    value := Max(0, Round(value))
    if value >= 1000
        return Round(value / 1000, 1) " kg"
    return value " g"
}

ParseInventorySnapshot(result, &inventoryInfo) {
    inventoryInfo := 0
    if !RegExMatch(result, "^SNAPSHOT (\d+) (\d+) (\d+) (\d+) ([A-Za-z0-9_.=,-]+)$", &parts)
        return false
    weight := parts[1] + 0
    maxWeight := parts[2] + 0
    used := parts[3] + 0
    slots := parts[4] + 0
    items := parts[5]
    if maxWeight <= 0 || slots <= 0 || used < 0 || used > slots
        return false
    if !IsValidInventorySpec(items)
        return false
    inventoryInfo := {weight: weight, maxWeight: maxWeight, used: used,
        slots: slots, items: items}
    return true
}

IsValidInventorySpec(spec) {
    if spec = "-"
        return true
    if StrLen(spec) > 24000
        return false
    seenSlots := Map()
    for entry in StrSplit(spec, ",") {
        if !RegExMatch(entry,
            "^([0-9]{4})\.[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{2,10923}=([0-9]{1,10})$", &parts)
            return false
        slot := parts[1] + 0
        count := parts[2] + 0
        if slot < 1 || slot > 1000 || seenSlots.Has(slot)
            || count < 1 || count > 2147483647
            return false
        seenSlots[slot] := true
    }
    return true
}

InventorySpecHasIncrease(currentSpec, baselineSpec) {
    currentRows := InventorySpecToRows(currentSpec)
    baselineRows := InventorySpecToRows(baselineSpec)
    baselineBySlot := Map()
    remainingExact := Map()
    remainingExact.CaseSense := "On"
    remainingNames := Map()
    remainingNames.CaseSense := "On"

    for row in baselineRows {
        baselineBySlot[row.slot] := row
        remainingExact[row.key] := (remainingExact.Has(row.key)
            ? remainingExact[row.key] : 0)
            + row.count
        remainingNames[row.name] := (remainingNames.Has(row.name)
            ? remainingNames[row.name] : 0) + row.count
    }

    ; 元スロットに残る同名品の開始時数量を、メタデータ（耐久値など）が変化しても先に保護します。
    ; 同じ品が別スロットへ移動していた場合は、その後に同一キー分も保護します。
    for row in currentRows {
        if !baselineBySlot.Has(row.slot)
            continue
        base := baselineBySlot[row.slot]
        if StrCompare(base.name, row.name, true) != 0
            continue
        reserve := Min(row.count, base.count)
        row.reserved += reserve
        if StrCompare(base.key, row.key, true) = 0 && remainingExact.Has(row.key)
            remainingExact[row.key] := Max(0, remainingExact[row.key] - reserve)
        if remainingNames.Has(row.name)
            remainingNames[row.name] := Max(0, remainingNames[row.name] - reserve)
    }
    for row in currentRows {
        if !remainingExact.Has(row.key) || remainingExact[row.key] <= 0
            continue
        reserve := Min(row.count - row.reserved, remainingExact[row.key])
        row.reserved += reserve
        remainingExact[row.key] -= reserve
        if remainingNames.Has(row.name)
            remainingNames[row.name] := Max(0, remainingNames[row.name] - reserve)
    }
    for row in currentRows {
        if !remainingNames.Has(row.name) || remainingNames[row.name] <= 0
            continue
        reserve := Min(row.count - row.reserved, remainingNames[row.name])
        row.reserved += reserve
        remainingNames[row.name] -= reserve
    }
    for row in currentRows {
        if row.count > row.reserved
            return true
    }
    return false
}

InventorySpecToRows(spec) {
    rows := []
    if !IsValidInventorySpec(spec) || spec = "-"
        return rows
    for entry in StrSplit(spec, ",") {
        if !RegExMatch(entry,
            "^([0-9]{4})\.([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{2,10923})=([0-9]{1,10})$", &parts)
            continue
        rows.Push({slot: parts[1] + 0, name: parts[2], key: parts[2] "." parts[3],
            count: parts[4] + 0, reserved: 0})
    }
    return rows
}

RunVehicleStorageCycle(expectedGeneration) {
    global State, Config
    State.automationPhase := "route_to_vehicle"
    State.statusLabel.Text := "車両へ移動しています"
    WriteDiagnostic("VEHICLE_TRIP_START trip=" (State.storageTrips + 1))
    if !PlayRegisteredRoute(Config.vehicleOutboundRoute, expectedGeneration, "車両へ移動中") {
        if IsCurrentRun(expectedGeneration)
            StopAutomationWithFault("車両への移動を完了できないため安全停止しました", "vehicle")
        return
    }
    if !ValidateServerEpochCheckpoint(expectedGeneration, "vehicle_arrival") {
        StopAutomationWithFault("移動中のサーバー再起動または切断を検知したため自動停止しました", "vehicle")
        return
    }

    storageOpened := false
    depositOk := false
    failureMessage := ""
    storageReturnCorrection := ""
    locatorFailure := ""
    inventoryCloseResult := ""
    inputReleaseOk := false
    try {
        if !IsCurrentRun(expectedGeneration)
            return
        State.automationPhase := "locate_storage"
        State.statusLabel.Text := "車両後部の荷台ターゲットを探索しています"
        if !LocateRegisteredStorage(&storageId, &storageType,
            &storageReturnCorrection, &locatorFailure, expectedGeneration) {
            failureMessage := locatorFailure = "wrong_storage"
                ? "別の車両ストレージを検出したため何も収納しませんでした"
                : locatorFailure = "ambiguous"
                    ? "荷台候補が複数あるため安全停止しました"
                : locatorFailure = "route_error"
                    ? "荷台探索中の位置を保証できないため安全停止しました"
                    : "登録車両の荷台を安全に特定できませんでした"
        } else {
            storageOpened := true
            if !ValidateServerEpochCheckpoint(expectedGeneration, "before_deposit") {
                failureMessage := "収納直前にサーバー再起動または切断を検知したため停止しました"
                locatorFailure := "server_session"
            } else {
                State.automationPhase := "depositing"
                State.statusLabel.Text := "今回増えた採集品だけを収納しています"
                depositResult := RunBackgroundBridgeCancelable(expectedGeneration,
                    "deposit-delta",
                    Config.vehicleStorageId, Config.vehicleStorageType,
                    State.inventoryBaseline)
                if RegExMatch(depositResult, "^DEPOSITED (\d+) (\d+)$", &depositParts)
                    && depositParts[1] + 0 > 0 {
                    postDepositResult := RunBackgroundBridgeCancelable(expectedGeneration,
                        "inventory-snapshot")
                    if !ParseInventorySnapshot(postDepositResult, &postDepositInfo)
                        || InventorySpecHasIncrease(postDepositInfo.items,
                            State.inventoryBaseline) {
                        failureMessage := "収納後の所持品を確認できなかったため停止します"
                        WriteDiagnostic("VEHICLE_DEPOSIT_VERIFY_ERROR=" postDepositResult)
                    } else {
                        ; 消費済みの開始時アイテムを将来の採集品と取り違えないよう、
                        ; 正常収納後の残量を次回の保護基準にします。
                        State.inventoryBaseline := postDepositInfo.items
                        UpdateInventoryCapacityState(postDepositInfo)
                        depositOk := true
                        State.lastStorageResult := depositParts[1] "個を収納"
                        WriteDiagnostic("VEHICLE_DEPOSIT count=" depositParts[1]
                            " stacks=" depositParts[2])
                    }
                } else {
                    failureMessage := DepositFailureMessage(depositResult)
                    WriteDiagnostic("VEHICLE_DEPOSIT_ERROR=" depositResult)
                }
            }
        }
    } catch as err {
        failureMessage := "収納処理でエラーが発生しました"
        if !storageOpened
            locatorFailure := "route_error"
        WriteDiagnostic("VEHICLE_CYCLE_ERROR=" err.Message)
    } finally {
        inputReleaseOk := ReleaseBackgroundTarget(true)
        inventoryCloseResult := RunBackgroundBridge("close-inventory")
    }

    if !IsCurrentRun(expectedGeneration)
        return
    if inventoryCloseResult != "CLOSED" {
        WriteDiagnostic("VEHICLE_CLOSE_ERROR=" inventoryCloseResult)
        StopAutomationWithFault("インベントリを安全に閉じられないため停止しました", "vehicle")
        return
    }
    if !inputReleaseOk {
        StopAutomationWithFault("荷台操作の入力解除を確認できないため安全停止しました", "vehicle")
        return
    }
    if storageOpened && !ValidateServerEpochCheckpoint(expectedGeneration, "after_deposit") {
        StopAutomationWithFault("収納中のサーバー再起動または切断を検知したため自動停止しました", "vehicle")
        return
    }
    if locatorFailure {
        StopAutomationWithFault(failureMessage, "vehicle")
        return
    }
    if storageReturnCorrection {
        State.automationPhase := "return_to_route_anchor"
        State.statusLabel.Text := "探索位置から登録ルートへ戻しています"
        if !PlayRegisteredRoute(storageReturnCorrection, expectedGeneration,
            "荷台探索のずれを戻しています") {
            StopAutomationWithFault("荷台探索位置から戻れないため安全停止しました", "vehicle")
            return
        }
    }
    State.automationPhase := "route_to_work"
    State.statusLabel.Text := "作業場所へ戻っています"
    returned := PlayRegisteredRoute(Config.vehicleReturnRoute, expectedGeneration, "作業場所へ復帰中")
    if !IsCurrentRun(expectedGeneration)
        return
    if !returned {
        StopAutomationWithFault("作業場所へ戻れないため安全停止しました", "vehicle")
        return
    }
    State.automationPhase := "verify_workpoint"
    State.statusLabel.Text := "作業位置を確認しています"
    if !ProbeWorkTarget(State.runMode, expectedGeneration) {
        StopAutomationWithFault("復帰位置で作業ボタンを確認できないため再開しません", "vehicle")
        return
    }
    if !depositOk {
        StopAutomationWithFault(failureMessage ? failureMessage : "収納できなかったため停止しました", "vehicle")
        return
    }

    State.storageTrips += 1
    State.vehicleTripLabel.Text := "自動収納`n" State.storageTrips
    State.waitingForStone := false
    State.stoneGoneObserved := false
    State.stoneAbsentVotes := 0
    State.stoneReadyVotes := 0
    State.lastMineAt := 0
    ResetGoldRecoveryState()
    State.nextCapacityCheckAt := MonotonicMs() + Config.capacityCheckIntervalMs
    State.workpointProbeFailures := 0
    State.automationPhase := "working"
    State.statusLabel.Text := "収納完了。作業を再開します"
    WriteDiagnostic("VEHICLE_TRIP_COMPLETE trip=" State.storageTrips)
    ScheduleNext(expectedGeneration, 900)
}

LocateRegisteredStorage(&storageId, &storageType, &returnCorrection,
    &failureCode, expectedGeneration) {
    global State, Config
    storageId := ""
    storageType := ""
    returnCorrection := ""
    failureCode := ""

    if OpenStorageAndCapture(&candidateId, &candidateType, expectedGeneration) {
        if candidateId = Config.vehicleStorageId
            && candidateType = Config.vehicleStorageType {
            storageId := candidateId
            storageType := candidateType
            WriteDiagnostic("VEHICLE_SEARCH anchor=matched")
            return true
        }
        WriteDiagnostic("VEHICLE_SEARCH anchor=wrong_storage")
        if !CloseInventoryAfterStorageFailure("WRONG STORAGE") {
            failureCode := "route_error"
            return false
        }
        failureCode := "wrong_storage"
        return false
    }
    initialProbeFailure := StorageProbeFailureCode()
    if initialProbeFailure {
        failureCode := initialProbeFailure
        WriteDiagnostic("VEHICLE_SEARCH anchor_probe=" State.lastStorageProbeResult)
        return false
    }

    searchRoutes := VehicleSearchRoutes(Config.vehicleSearchPulseMs)
    for index, correctionRoute in searchRoutes {
        if !IsCurrentRun(expectedGeneration)
            return false
        inverseRoute := ReverseRoute(correctionRoute)
        if !inverseRoute {
            failureCode := "route_error"
            return false
        }
        State.statusLabel.Text := "荷台ターゲットを再探索中（" index "/" searchRoutes.Length "）"
        if !PlayRegisteredRoute(correctionRoute, expectedGeneration,
            "車両後部を探索中") {
            failureCode := "route_error"
            return false
        }

        matched := false
        openedCandidate := OpenStorageAndCapture(&candidateId, &candidateType,
            expectedGeneration)
        if openedCandidate {
            if candidateId = Config.vehicleStorageId
                && candidateType = Config.vehicleStorageType {
                matched := true
                storageId := candidateId
                storageType := candidateType
                returnCorrection := inverseRoute
                WriteDiagnostic("VEHICLE_SEARCH matched_attempt=" index)
            } else {
                WriteDiagnostic("VEHICLE_SEARCH wrong_storage_attempt=" index)
                if !CloseInventoryAfterStorageFailure("WRONG STORAGE") {
                    failureCode := "route_error"
                    return false
                }
                if !PlayRegisteredRoute(inverseRoute, expectedGeneration,
                    "探索位置を戻しています") {
                    failureCode := "route_error"
                    return false
                }
                failureCode := "wrong_storage"
                return false
            }
        } else {
            probeFailure := StorageProbeFailureCode()
            if probeFailure {
                if !CloseInventoryAfterStorageFailure(State.lastStorageProbeResult) {
                    failureCode := "route_error"
                    return false
                }
                if !PlayRegisteredRoute(inverseRoute, expectedGeneration,
                    "探索位置を戻しています") {
                    failureCode := "route_error"
                    return false
                }
                failureCode := probeFailure
                WriteDiagnostic("VEHICLE_SEARCH probe_stop=" State.lastStorageProbeResult)
                return false
            }
        }
        if matched
            return true
        if !PlayRegisteredRoute(inverseRoute, expectedGeneration,
            "探索位置を戻しています") {
            failureCode := "route_error"
            return false
        }
    }
    failureCode := "not_found"
    WriteDiagnostic("VEHICLE_SEARCH exhausted=" searchRoutes.Length)
    return false
}

StorageProbeFailureCode() {
    global State
    if State.lastStorageProbeResult = "AMBIGUOUS STORAGE"
        return "ambiguous"
    if InStr(State.lastStorageProbeResult, "ERROR ") = 1
        return "route_error"
    return ""
}

VehicleSearchRoutes(pulseMs) {
    pulseMs := Min(350, Max(150, Round(pulseMs)))
    longerMs := Min(500, pulseMs + 140)
    routes := []
    ; 原点から毎回短く出て必ず戻るため、探索のたびに位置ずれを累積しません。
    ; まず立ち位置を探し、その後だけdirect-lookを組み合わせて、車両位置と
    ; カメラ方向の小さなずれを両方カバーします。登録ID一致までは収納しません。
    for mask in [1, 2, 4, 8, 5, 9, 6, 10]
        routes.Push(pulseMs ":" mask)
    for mask in [17, 34, 68, 136, 65, 129, 66, 130]
        routes.Push(pulseMs ":" mask)
    for mask in [1, 2, 4, 8]
        routes.Push(longerMs ":" mask)
    return routes
}

ReverseRoute(route) {
    if !IsValidRoute(route, false, 25)
        return ""
    steps := StrSplit(route, ",")
    reversed := ""
    loop steps.Length {
        step := steps[steps.Length - A_Index + 1]
        if !RegExMatch(step, "^(\d{2,4}):(\d{1,3})$", &parts)
            return ""
        mask := parts[2] + 0
        inverseMask := 0
        if mask & 1
            inverseMask |= 2
        if mask & 2
            inverseMask |= 1
        if mask & 4
            inverseMask |= 8
        if mask & 8
            inverseMask |= 4
        if mask & 16
            inverseMask |= 32
        if mask & 32
            inverseMask |= 16
        if mask & 64
            inverseMask |= 128
        if mask & 128
            inverseMask |= 64
        reversed .= (reversed ? "," : "") parts[1] ":" inverseMask
    }
    return IsValidRoute(reversed, false, 25) ? reversed : ""
}

PlayRegisteredRoute(route, expectedGeneration, statusText) {
    global State, Config
    if !IsValidRoute(route) || !IsCurrentRun(expectedGeneration)
        return false
    if !EnsureDevConPort()
        return false
    port := State.lastDevConPort
    State.statusLabel.Text := statusText
    routeStartedAt := MonotonicMs()
    routeResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "play-route-health", port, route, State.serverEpoch)
    routeElapsedMs := MonotonicMs() - routeStartedAt
    if !RegExMatch(routeResult, "^ROUTE (29200|29300) (\d+)$", &parts)
        return false
    totalMs := parts[2] + 0
    if totalMs != RouteTotalMs(route)
        return false
    if routeElapsedMs + 250 < totalMs
        return false
    return WaitWhileBackgroundReady(Config.routeSettleMs, expectedGeneration)
}

EnsureDevConPort() {
    global State
    if State.lastDevConPort = 29200 || State.lastDevConPort = 29300 {
        cachedRelease := RunBackgroundBridge("deactivate-" State.lastDevConPort)
        if cachedRelease != "RELEASED" {
            Sleep 75
            cachedRelease := RunBackgroundBridge("deactivate-" State.lastDevConPort)
        }
        WriteDiagnostic("DEVCON_CACHED_RELEASE=" cachedRelease)
        if cachedRelease = "RELEASED" {
            State.backgroundTargetActive := false
            State.backgroundDevConPort := 0
            return true
        }
        State.lastDevConPort := 0
    }
    activateResult := RunBackgroundBridge("activate")
    if !RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &parts)
        return false
    candidatePort := parts[1] + 0
    releaseResult := RunBackgroundBridge("deactivate-" candidatePort)
    if releaseResult != "RELEASED" {
        Sleep 75
        releaseResult := RunBackgroundBridge("deactivate-" candidatePort)
    }
    WriteDiagnostic("DEVCON_PREFLIGHT_RELEASE=" releaseResult)
    if releaseResult != "RELEASED" {
        State.lastDevConPort := 0
        return false
    }
    State.lastDevConPort := candidatePort
    State.backgroundTargetActive := false
    State.backgroundDevConPort := 0
    return true
}

DepositFailureMessage(result) {
    if InStr(result, "WRONG_STORAGE")
        return "登録した車両と一致しないため、何も収納しませんでした"
    if InStr(result, "STORAGE_FULL")
        return "車両ストレージの容量が足りません"
    if InStr(result, "NO_DELTA")
        return "今回増えた採集品を確認できませんでした"
    if InStr(result, "NO_PROGRESS")
        return "収納結果を確認できなかったため停止しました"
    return "車両ストレージへ収納できませんでした"
}

StopAutomationWithFault(message, pageName := "overview") {
    global State
    State.lastStorageResult := message
    StopMining()
    State.statusLabel.Text := message
    ShowPage(pageName)
    ShowMainWindow()
}

AutomationCycle(expectedGeneration) {
    global State
    if !IsCurrentRun(expectedGeneration)
        return
    if MaybeHandleServerHealth(expectedGeneration)
        return
    if MaybeHandleVehicleCapacity(expectedGeneration)
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

    nextCycleAnchor := MonotonicMs()
    clickedThisAttempt := false
    State.attempts += 1
    State.statusLabel.Text := "●  石洗いの準備中"

    try {
        ; 成功した洗浄1回につき1度だけ、次のtarget表示前に短く前進します。
        if State.washNudgePending {
            State.washNudgePending := false
            if Config.washForwardCorrection {
                if !EnsureDevConPort() {
                    State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
                    WriteDiagnostic("attempt=" State.attempts " WASH_NUDGE_PORT_MISSING")
                    return
                }
                State.statusLabel.Text := "●  洗浄位置を少し前へ補正中"
                nudgeResult := RunBackgroundBridge("nudge-forward",
                    State.lastDevConPort, Config.washForwardPulseMs)
                if !IsCurrentRun(expectedGeneration)
                    return
                WriteDiagnostic("attempt=" State.attempts " WASH_NUDGE=" nudgeResult)
                if nudgeResult = "NUDGED " State.lastDevConPort {
                    State.nudges += 1
                    State.mealLabel.Text := "後退補正`n" State.nudges
                }
                ; packetだけ届いてhelper応答が失われた場合も、前進中にtargetを開きません。
                if !WaitWhileBackgroundReady(Config.washForwardPulseMs
                    + Config.washForwardSettleMs + 50, expectedGeneration)
                    return
            }
        }

        State.statusLabel.Text := "●  「石を洗う」を確認中"
        clickRequestedAt := MonotonicMs()
        clickResult := RunBackgroundBridgeCancelable(expectedGeneration, "try-washing")
        if !IsCurrentRun(expectedGeneration)
            return
        if clickResult != "CLICKED WASH" {
            WriteDiagnostic("attempt=" State.attempts " WASH_TRY=" clickResult)
            State.statusLabel.Text := clickResult = "MISSING WASH"
                ? "●  「石を洗う」を待っています"
                : "●  FiveM内部UIへ再接続中"
            return
        }

        State.successes += 1
        clickedThisAttempt := true
        State.lastMineAt := MonotonicMs()
        nextCycleAnchor := clickRequestedAt
        State.washNudgePending := Config.washForwardCorrection = 1
        State.countLabel.Text := "石洗い回数`n" State.successes
        State.statusLabel.Text := "●  約9秒後にもう一度洗います"
        WriteDiagnostic("attempt=" State.attempts " WASH_CLICKED")
    } catch as err {
        WriteDiagnostic("attempt=" State.attempts " WASH_ERROR=" err.Message)
        if IsCurrentRun(expectedGeneration)
            State.statusLabel.Text := "●  石洗いを安全に再試行します"
    } finally {
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

ResetGoldRecoveryState() {
    global State
    State.goldMissingSince := 0
    State.goldRecoveryStep := 0
    State.goldRecoveryExhausted := false
    State.goldRecoveryFault := false
}

GoldRecoveryRoute(stepNumber, pulseMs := 0) {
    global Config
    pulse := pulseMs > 0 ? pulseMs : Config.goldRecoveryPulseMs
    if pulse < 150 || pulse > 250
        return ""
    switch stepNumber {
    case 1:
        return pulse ":1"
    case 2:
        return (pulse * 2) ":2"
    case 3:
        return pulse ":1"
    case 4:
        return pulse ":4"
    case 5:
        return (pulse * 2) ":8"
    case 6:
        return pulse ":4"
    default:
        return ""
    }
}

GoldRecoveryPatternIsBalanced(pulseMs := 150) {
    vertical := 0
    horizontal := 0
    Loop 6 {
        route := GoldRecoveryRoute(A_Index, pulseMs)
        if !IsValidRoute(route)
            return false
        for routeStep in StrSplit(route, ",") {
            separator := InStr(routeStep, ":")
            duration := SubStr(routeStep, 1, separator - 1) + 0
            mask := SubStr(routeStep, separator + 1) + 0
            if (mask & 1)
                vertical += duration
            if (mask & 2)
                vertical -= duration
            if (mask & 4)
                horizontal -= duration
            if (mask & 8)
                horizontal += duration
        }
    }
    return vertical = 0 && horizontal = 0
}

PerformGoldRecoveryStep(expectedGeneration) {
    global State, Config
    if !IsCurrentRun(expectedGeneration) || State.goldRecoveryExhausted
        return false
    nextStep := State.goldRecoveryStep + 1
    route := GoldRecoveryRoute(nextStep)
    if !route
        return false
    if !EnsureDevConPort() {
        ; 移動は始まっていないので、改めて12秒の連続未検出を確認します。
        State.goldMissingSince := 0
        State.statusLabel.Text := "●  位置補正の接続を再確認しています"
        WriteDiagnostic("attempt=" State.attempts " GOLD_RECOVERY_PORT_MISSING")
        return false
    }
    if !IsCurrentRun(expectedGeneration)
        return false

    ; bridgeの応答が失われても同じ方向へ無制限に進まないよう、実行前に
    ; 段階を消費します。6段階全体では前後・左右の入力時間が釣り合います。
    State.goldRecoveryStep := nextStep
    port := State.lastDevConPort
    State.statusLabel.Text := "●  砂金位置を自動補正中 (" nextStep "/6)"
    recoveryResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "play-route-health", port, route, State.serverEpoch)
    if !IsCurrentRun(expectedGeneration)
        return false
    routeOk := recoveryResult = "ROUTE " port " " RouteTotalMs(route)
    WriteDiagnostic("attempt=" State.attempts " GOLD_RECOVERY_STEP=" nextStep
        " route=" route " result=" recoveryResult)
    if routeOk {
        State.nudges += 1
        State.mealLabel.Text := "位置補正`n" State.nudges
    } else {
        ; 次回はDevConポートから再検出します。部分的に入力された可能性が
        ; あるため、同じ未検出中にはそれ以上移動しないfail-closed動作です。
        State.lastDevConPort := 0
        State.goldRecoveryFault := true
        State.goldRecoveryExhausted := true
        State.statusLabel.Text := "●  位置補正を完了できません。停止して位置を確認してください"
        return false
    }
    return WaitWhileBackgroundReady(Config.goldRecoverySettleMs, expectedGeneration)
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

    nextCycleAnchor := MonotonicMs()
    clickedThisAttempt := false
    State.attempts += 1
    State.statusLabel.Text := "●  砂金採りの準備中"

    try {
        ; 毎回まず現在位置を検査します。前周期のMISSINGだけを根拠に先に
        ; 移動すると、自然復帰したtargetから離れる競合が起きるためです。
        State.statusLabel.Text := "●  「砂金採りトレイ」を確認中"
        clickRequestedAt := MonotonicMs()
        clickResult := RunBackgroundBridgeCancelable(expectedGeneration, "try-gold")
        if !IsCurrentRun(expectedGeneration)
            return
        if clickResult != "CLICKED GOLD" {
            WriteDiagnostic("attempt=" State.attempts " GOLD_TRY=" clickResult)
            if clickResult = "MISSING GOLD" {
                missingNow := MonotonicMs()
                if !State.goldMissingSince {
                    State.goldMissingSince := missingNow
                    WriteDiagnostic("attempt=" State.attempts " GOLD_MISSING_STARTED")
                }
                missingForMs := missingNow - State.goldMissingSince
                if Config.goldRecoveryEnabled
                    && missingForMs >= Config.goldRecoveryAfterMs {
                    if State.goldRecoveryFault {
                        State.statusLabel.Text := "●  位置補正を完了できません。停止して位置を確認してください"
                    } else if State.goldRecoveryStep >= 6 {
                        if !State.goldRecoveryExhausted
                            WriteDiagnostic("attempt=" State.attempts " GOLD_RECOVERY_EXHAUSTED")
                        State.goldRecoveryExhausted := true
                        State.statusLabel.Text := "●  補正範囲外。位置を戻すと自動再開します"
                    } else {
                        recoveryMoved := PerformGoldRecoveryStep(expectedGeneration)
                        if recoveryMoved && IsCurrentRun(expectedGeneration)
                            State.statusLabel.Text := "●  補正後の位置を再確認します"
                    }
                } else {
                    State.statusLabel.Text := "●  「砂金採りトレイ」を待っています"
                }
            } else {
                ; 接続系の失敗を挟んだ時間は「連続未検出」に数えません。
                State.goldMissingSince := 0
                State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
            }
            return
        }

        recoveredSteps := State.goldRecoveryStep
        ResetGoldRecoveryState()
        State.successes += 1
        clickedThisAttempt := true
        State.lastMineAt := MonotonicMs()
        nextCycleAnchor := clickRequestedAt
        State.countLabel.Text := "砂金採り回数`n" State.successes
        State.statusLabel.Text := "●  約6秒後にもう一度採ります"
        if recoveredSteps
            WriteDiagnostic("attempt=" State.attempts " GOLD_RECOVERED steps=" recoveredSteps)
        WriteDiagnostic("attempt=" State.attempts " GOLD_CLICKED")
    } catch as err {
        WriteDiagnostic("attempt=" State.attempts " GOLD_ERROR=" err.Message)
        if IsCurrentRun(expectedGeneration)
            State.statusLabel.Text := "●  砂金採りを安全に再試行します"
    } finally {
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
            State.countLabel.Text := "採掘回数`n" State.successes
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
        if State.waitingForStone {
            ; 1プロセス内でtargetを開閉して確認し、物理マウスや前面画面には触れません。
            probeResult := RunBackgroundBridgeCancelable(expectedGeneration,
                "try-probe-mining")
            if !IsCurrentRun(expectedGeneration)
                return
            if probeResult != "PRESENT MINE" && probeResult != "MISSING MINE" {
                State.lastBridgeError := probeResult
                State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
                WriteDiagnostic("attempt=" State.attempts " BG_PROBE_ERROR=" probeResult)
                ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
                return
            }
            found := probeResult = "PRESENT MINE"
            WriteDiagnostic("attempt=" State.attempts " BG_BUTTON_"
                (found ? "PRESENT" : "MISSING"))
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
        }

        State.statusLabel.Text := "●  採掘しています"
        clickResult := RunBackgroundBridgeCancelable(expectedGeneration, "try-mining")
        if !IsCurrentRun(expectedGeneration)
            return
        if clickResult != "CLICKED MINE" {
            State.statusLabel.Text := clickResult = "MISSING MINE"
                ? "●  採掘ボタンを待っています"
                : "●  FiveM内部UIへ再接続中"
            WriteDiagnostic("attempt=" State.attempts " BG_TRY=" clickResult)
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
        if clickIssued && IsCurrentRun(expectedGeneration) {
            State.successes += 1
            State.waitingForStone := true
            State.stoneGoneObserved := false
            State.stoneAbsentVotes := 0
            State.stoneReadyVotes := 0
            State.lastMineAt := MonotonicMs()
            State.countLabel.Text := "採掘回数`n" State.successes
            State.statusLabel.Text := "●  採掘完了を待っています"
            ScheduleNext(expectedGeneration, Config.miningCompleteWaitMs)
        }
    }
}

RunBackgroundBridge(mode, extra1 := "", extra2 := "") {
    args := []
    if extra1 != ""
        args.Push(extra1)
    if extra2 != ""
        args.Push(extra2)
    return RunBackgroundBridgeArgs(mode, args*)
}

RunBackgroundBridgeArgs(mode, bridgeArgs*) {
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
        commandLine := QuoteCommandArg(State.backgroundBridgePath) " " mode " " QuoteCommandArg(resultPath)
        for value in bridgeArgs {
            value := String(value)
            if StrLen(value) > 24000 || InStr(value, "`r") || InStr(value, "`n")
                return "ERROR invalid bridge argument"
            commandLine .= " " QuoteCommandArg(value)
        }
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

RunBackgroundBridgeCancelable(expectedGeneration, mode, bridgeArgs*) {
    global State

    if !IsBridgeOperationContextValid(expectedGeneration)
        return "ERROR CANCELLED"
    if !RegExMatch(mode, "^[a-z0-9-]+$")
        return "ERROR invalid bridge mode"
    Critical "On"
    State.bridgeCallId += 1
    callId := State.bridgeCallId
    Critical "Off"
    resultPath := State.backgroundResultPath "." callId ".txt"
    helperPid := 0
    operationToken := ""
    if mode = "deposit-delta" {
        operationToken := DllCall("GetCurrentProcessId") "-" callId
        bridgeArgs.Push(operationToken)
    }

    try {
        try FileDelete resultPath
        commandLine := QuoteCommandArg(State.backgroundBridgePath) " " mode " " QuoteCommandArg(resultPath)
        for value in bridgeArgs {
            value := String(value)
            if StrLen(value) > 24000 || InStr(value, "`r") || InStr(value, "`n")
                return "ERROR invalid bridge argument"
            commandLine .= " " QuoteCommandArg(value)
        }
        Critical "On"
        if !IsBridgeOperationContextValid(expectedGeneration) {
            Critical "Off"
            return "ERROR CANCELLED"
        }
        try Run commandLine,, "Hide", &helperPid
        catch as err {
            Critical "Off"
            return "ERROR " err.Message
        }
        State.activeBridgePid := helperPid
        State.activeBridgeMode := mode
        State.activeBridgeOperationToken := operationToken
        Critical "Off"

        if InStr(mode, "play-route") && bridgeArgs.Length >= 2 {
            routeDurationMs := RouteTotalMs(bridgeArgs[2])
            if mode = "play-route-health" {
                ; 各2.5秒区切りのCDP healthはroot取得3秒＋socket処理4秒まで
                ; 待つため、長い登録経路では全チェック回数分を予算化します。
                ; 開始時と終了時の照合も含め、境界一致時の重複省略ぶんは余裕側です。
                healthChecks := Floor(routeDurationMs / 2500) + 2
                timeoutMs := Min(380000,
                    Max(18000, routeDurationMs + healthChecks * 7200 + 5000))
            } else {
                timeoutMs := Min(125000, Max(9000, routeDurationMs + 5000))
            }
        } else {
            timeoutMs := mode = "deposit-delta" ? 50000 : 9000
        }
        deadline := MonotonicMs() + timeoutMs
        while helperPid && ProcessExist(helperPid) {
            if !IsBridgeOperationContextValid(expectedGeneration) {
                CancelBridgeProcess(helperPid, mode, operationToken)
                ReleaseBackgroundTarget(true)
                return "ERROR CANCELLED"
            }
            if !IsTargetIdentityAlive() {
                CancelBridgeProcess(helperPid, mode, operationToken)
                ReleaseBackgroundTarget(true)
                return "ERROR TARGET_CLOSED"
            }
            if InStr(mode, "play-route") && WinActive("ahk_id " State.targetHwnd)
                && (CurrentPhysicalRouteMask() || CurrentUnsupportedRegistrationKey()) {
                CancelBridgeProcess(helperPid, mode, operationToken)
                ReleaseBackgroundTarget(true)
                State.lastStorageResult := "手動の移動・視点入力を検知して中止"
                return "ERROR MANUAL_INPUT"
            }
            if MonotonicMs() >= deadline {
                CancelBridgeProcess(helperPid, mode, operationToken)
                ReleaseBackgroundTarget(true)
                return "ERROR BRIDGE_TIMEOUT"
            }
            Sleep 25
        }
        if !FileExist(resultPath)
            return "ERROR no bridge result"
        try return Trim(FileRead(resultPath, "UTF-8"))
        catch as err
            return "ERROR " err.Message
    } finally {
        Critical "On"
        if helperPid && State.activeBridgePid = helperPid {
            State.activeBridgePid := 0
            State.activeBridgeMode := ""
            State.activeBridgeOperationToken := ""
        }
        Critical "Off"
        try FileDelete resultPath
    }
}

IsBridgeOperationContextValid(expectedGeneration) {
    global State
    return expectedGeneration ? IsCurrentRun(expectedGeneration)
        : State.registrationActive && !State.registrationCancelled
}

CancelActiveBridgeProcess() {
    global State
    Critical "On"
    processId := State.activeBridgePid
    mode := State.activeBridgeMode
    operationToken := State.activeBridgeOperationToken
    State.activeBridgePid := 0
    State.activeBridgeMode := ""
    State.activeBridgeOperationToken := ""
    Critical "Off"
    if processId
        CancelBridgeProcess(processId, mode, operationToken)
}

CancelBridgeProcess(processId, mode := "", operationToken := "") {
    if !processId || !ProcessExist(processId)
        return
    if mode = "deposit-delta" && operationToken {
        ; 先にNUIへ同じ操作IDの中止を通知し、現在の1トランザクションが
        ; 確定または失敗するまで待ってから補助プロセスを終了します。
        ReleaseBackgroundTarget(true)
        RunBackgroundBridge("cancel-operation", operationToken)
        RunBackgroundBridge("close-inventory")
        try ProcessWaitClose processId, 6
    }
    if ProcessExist(processId)
        StopOwnedBridgeProcess(processId)
    try ProcessWaitClose processId, 1
}

StopOwnedBridgeProcess(processId) {
    global State
    if !processId || !ProcessExist(processId)
        return
    try {
        processPath := ProcessGetPath(processId)
        if StrLower(processPath) = StrLower(State.backgroundBridgePath) {
            ProcessClose processId
            try ProcessWaitClose processId, 1
        }
    }
}

ReleaseBackgroundTarget(force := false) {
    global State

    if !State.backgroundTargetActive && !force
        return true
    knownPort := State.backgroundTargetActive && State.backgroundDevConPort
        ? State.backgroundDevConPort
        : (State.lastDevConPort = 29200 || State.lastDevConPort = 29300)
            ? State.lastDevConPort : 0
    mode := knownPort ? "deactivate-" knownPort : "deactivate"
    result := RunBackgroundBridge(mode)
    if result != "RELEASED" {
        Sleep 75
        result := RunBackgroundBridge(mode)
    }
    if result != "RELEASED" && force && knownPort {
        ; FiveM更新などでDevConポートが切り替わった可能性があるため、既知の
        ; ポートが失効したときだけ固定2ポートの安全解除へフォールバックします。
        result := RunBackgroundBridge("deactivate")
        if result != "RELEASED" {
            Sleep 75
            result := RunBackgroundBridge("deactivate")
        }
        if result = "RELEASED"
            State.lastDevConPort := 0
    }
    WriteDiagnostic("BG_RELEASE=" result)
    if result = "RELEASED" {
        State.backgroundTargetActive := false
        State.backgroundDevConPort := 0
        return true
    }
    return false
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
    State.mealLabel.Text := "食事回数`n" State.meals
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

    previousPhase := State.automationPhase
    State.running := false
    State.generation += 1
    if IsObject(State.timerFn) {
        try SetTimer(State.timerFn, 0)
    }
    State.timerFn := 0
    StopUpdatePollTimer()
    if !State.updateApplying
        CleanupUpdateStage()
    CancelActiveBridgeProcess()
    ReleaseAllInputs()
    ReleaseBackgroundTarget(true)
    if previousPhase = "depositing"
        RunBackgroundBridge("close-inventory")
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

ReadVehicleWorkMode(settingsFile) {
    value := StrLower(ReadTextSetting(settingsFile, "VehicleStorage", "WorkMode", "mining"))
    return value = "washing" ? "washing" : value = "gold" ? "gold" : "mining"
}

IsValidVehicleProfile(config) {
    return config.vehicleRegistered = 1
        && IsValidBase64Token(config.vehicleStorageId)
        && config.vehicleStorageType = "dHJ1bms="
        && (config.vehicleWorkMode = "mining" || config.vehicleWorkMode = "washing"
            || config.vehicleWorkMode = "gold")
        && config.vehicleRouteFormat = 3
        && IsValidRoute(config.vehicleOutboundRoute)
        && IsValidRoute(config.vehicleReturnRoute)
}

IsValidBase64Token(value) {
    value := String(value)
    return StrLen(value) >= 4 && StrLen(value) <= 512
        && Mod(StrLen(value), 4) = 0
        && RegExMatch(value, "^[A-Za-z0-9+/]+={0,2}$")
}

IsValidRoute(route, requireMovement := true, minimumTotalMs := 150) {
    route := String(route)
    if StrLen(route) < 4 || StrLen(route) > 8192
        return false
    steps := StrSplit(route, ",")
    if steps.Length < 1 || steps.Length > 240
        return false
    total := 0
    hasMovement := false
    hasInput := false
    for step in steps {
        if !RegExMatch(step, "^(\d{2,4}):(\d{1,3})$", &parts)
            return false
        duration := parts[1] + 0
        mask := parts[2] + 0
        if duration < 25 || duration > 3000 || mask < 0 || mask > 255
            return false
        if (mask & 3) = 3 || (mask & 12) = 12
            || (mask & 48) = 48 || (mask & 192) = 192
            return false
        total += duration
        if mask & 15
            hasMovement := true
        if mask
            hasInput := true
    }
    return hasInput && (!requireMovement || hasMovement)
        && total >= minimumTotalMs && total <= 90000
}

RouteTotalMs(route) {
    if !IsValidRoute(route)
        return 0
    total := 0
    for step in StrSplit(route, ",") {
        separator := InStr(step, ":")
        total += SubStr(step, 1, separator - 1) + 0
    }
    return total
}

RouteViewSegmentCount(route) {
    if !IsValidRoute(route, false)
        return 0
    count := 0
    for step in StrSplit(route, ",") {
        separator := InStr(step, ":")
        mask := SubStr(step, separator + 1) + 0
        if mask & 240
            count += 1
    }
    return count
}

ReadFoodKey(settingsFile) {
    try value := Trim(IniRead(settingsFile, "Eating", "FoodKey", "1"))
    catch
        return "1"

    ; FiveMのホットバースロットだけを許可し、壊れた設定で別キーを押さないようにします。
    return RegExMatch(value, "^[1-9]$") ? value : "1"
}
