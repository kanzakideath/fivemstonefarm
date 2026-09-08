#Requires AutoHotkey v2.0
#SingleInstance Force

SendMode "Event"
SetMouseDelay 25
SetKeyDelay 25, 25
SetTitleMatchMode 2
CoordMode "Pixel", "Screen"
CoordMode "Mouse", "Screen"
Thread "Interrupt", 0

global AppVersion := "8.0.3"
processId := DllCall("GetCurrentProcessId")
isUiSmokeTest := HasCommandLineArgument("--smoke-test")
isVisualTest := HasCommandLineArgument("--visual-test")
isUiTestRun := isUiSmokeTest || isVisualTest
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
settingsPath := isUiTestRun
    ? A_Temp "\ai-miner-ui-test-" processId ".ini"
    : A_ScriptDir "\AI採掘機.ini"
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
    backgroundEatFallback: ReadIntegerSetting(settingsPath, "Eating", "BackgroundFallback", 1, 0, 1),
    backgroundFirstEatDelayMs: ReadIntegerSetting(settingsPath, "Eating", "BackgroundFirstEatDelayMs", 60000, 15000, 900000),
    backgroundEatIntervalMs: ReadIntegerSetting(settingsPath, "Eating", "BackgroundEatIntervalMs", 480000, 120000, 1800000),
    failedEatRetryMs: ReadIntegerSetting(settingsPath, "Eating", "FailedEatRetryMs", 30000, 10000, 300000),
    workViewLock: ReadIntegerSetting(settingsPath, "ViewLock", "Enabled", 1, 0, 1),
    workViewDownPulseMs: ReadIntegerSetting(settingsPath, "ViewLock", "DownPulseMs", 450, 100, 1500),
    workViewIntervalMs: ReadIntegerSetting(settingsPath, "ViewLock", "ReapplyIntervalMs", 4000, 1500, 30000),
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
    vehicleRouteFormat: ReadIntegerSetting(settingsPath, "VehicleStorage", "RouteFormat", 0, 0, 5),
    vehicleCompanionProtocol: ReadIntegerSetting(settingsPath, "VehicleStorage", "CompanionProtocol", 0, 0, 1),
    vehicleRegistrationId: ReadTextSetting(settingsPath, "VehicleStorage", "CompanionRegistrationId", ""),
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
    nextBackgroundEatAt: 0,
    backgroundHungerUnknownLogged: false,
    backgroundEatFailures: 0,
    lastWorkViewAt: 0,
    workViewFailures: 0,
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
    storagePending: false,
    storageRecoveryAttempted: false,
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
    lastTargetProbeResult: "",
    lastTargetProbeFatal: false,
    registrationActive: false,
    registrationCancelled: false,
    registrationOverlay: 0,
    registrationDeadline: 0,
    companionReady: false,
    companionEpoch: "",
    companionResourceVersion: "",
    companionStatus: "未確認",
    companionRegistrationAvailable: false,
    companionRegistrationId: "",
    companionVehiclePlate: "",
    companionVehicleLabel: "",
    companionLastSequence: 0,
    companionLastCheckAt: 0,
    companionHealthFailures: 0,
    companionTransactionSupported: false,
    companionTransactionPending: false,
    companionServerRegistrationSynchronized: false,
    page: "overview",
    pages: Map(),
    ui: {},
    layoutReady: false,
    visualTest: isVisualTest,
    uiSmokeTest: isUiSmokeTest,
    uiBackendGui: 0,
    uiHostPath: "",
    uiAssetsPath: "",
    uiRuntimeRoot: "",
    uiHostPid: 0,
    uiHwnd: 0,
    uiReady: false,
    uiSession: "",
    uiRevision: 0,
    uiFlushPending: false,
    uiActionPending: false,
    uiActionQueue: [],
    uiControls: Map(),
    uiWindowVisible: true,
    uiSmokeResult: "",
    uiHostError: ""
}

; コンパイル前後の構文・埋め込み画像チェック用です。
if A_Args.Length && A_Args[1] = "--validate" {
    updaterCapabilities := RunUpdaterCapabilities()
    testRegistrationId := "YW12X2FhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYQ=="
    testCompanionResult := "COMPANION 1 1.0.0 ame_aaaaaaaaaaaaaaaa 42 ready 1 "
        . testRegistrationId . " QUJDMTIz VHJ1Y2s= 123456 1 250 REGISTERED 1 1 1"
    testCompanionParsed := ParseCompanionStatus(testCompanionResult, &testCompanion)
    testUnsynchronizedCompanionParsed := ParseCompanionStatus(
        "COMPANION 1 1.0.0 ame_aaaaaaaaaaaaaaaa 43 ready 0 - - - 0 0 -1 IDLE 1 0 0",
        &testUnsynchronizedCompanion)
    testLegacyCompanionRejected := !ParseCompanionStatus(
        "COMPANION 1 1.0.0 ame_aaaaaaaaaaaaaaaa 43 ready 0 - - - 0 0 -1 IDLE 1 0",
        &testLegacyCompanion)
    testCompanionDone := CompanionCommandSucceeded("COMPANION_DONE go-vehicle "
        . "ARRIVED_VEHICLE " . testRegistrationId . " 123", "go-vehicle",
        &testDoneId, &testDoneCode, &testDoneNetworkId)
    testCommitDone := IsCommittedRegistrationResponse(
        "COMPANION_DONE commit-registration REGISTRATION_COMMITTED "
        . testRegistrationId . " 123", testRegistrationId)
    testAbortDone := IsAbortedRegistrationResponse(
        "COMPANION_DONE abort-registration REGISTRATION_ABORTED - 0")
    testCancelledCommitRetryBlocked := !CompanionCommitRetryAllowed(
        "ERROR CANCELLED", false)
    testUserCancelledCommitRetryBlocked := !CompanionCommitRetryAllowed(
        "ERROR COMPANION_BUSY", true)
    testUncertainCommitRetryAllowed := CompanionCommitRetryAllowed(
        "ERROR COMPANION_REGISTRATION_TRANSACTION_NOT_FOUND", false)
    testVehicleProfile := {
        vehicleRegistered: 1, vehicleCompanionProtocol: 0,
        vehicleRegistrationId: "",
        vehicleStorageId: "dHJ1bmsxMjM=", vehicleStorageType: "dHJ1bms=",
        vehicleWorkMode: "mining", vehicleRouteFormat: 5,
        vehicleOutboundRoute: "", vehicleReturnRoute: ""
    }
    exitCode := !FileExist(State.buttonTemplates[1].path) ? 11
        : !FileExist(State.buttonTemplates[2].path) ? 12
        : !FileExist(State.hungerTemplatePath) ? 13
        : !FileExist(State.stoneMarkerTemplatePath) ? 14
        : !FileExist(State.backgroundBridgePath) ? 15
        : !FileExist(State.updaterPath) ? 16
        : MonotonicMs() <= 0 ? 17
        : RunBackgroundBridge("capabilities") != "CAPS 9 MINE WASH GOLD NUDGE STORAGE INVENTORY ROUTE TRY VIEW HOTBAR INVENTORYKEY HEALTH COMPANION" ? 18
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
        : RouteViewSegmentCount("150:1,150:64,150:128") != 2 ? 44
        : RouteTotalMs("150:64", false) != 150 ? 68
        : AutomationStartAllowed(false, true) ? 45
        : !AutomationStartAllowed(false, false) ? 46
        : !ParseServerHealth("HEALTH READY YWJjZGVmZ2g", &testEpoch) ? 47
        : testEpoch != "YWJjZGVmZ2g" ? 48
        : !testCompanionParsed ? 49
        : testCompanion.registrationId != testRegistrationId
            || testCompanion.epoch != "ame_aaaaaaaaaaaaaaaa"
            || testCompanion.sequence != 42 || !testCompanion.available
            || !testCompanion.transactionSupported
            || !testCompanion.transactionPending
            || !testCompanion.serverRegistrationSynchronized ? 50
        : !IsValidCompanionRegistrationId(testRegistrationId) ? 51
        : IsValidCompanionRegistrationId("YWJkZA==") ? 52
        : !testCompanionDone || testDoneId != testRegistrationId
            || testDoneCode != "ARRIVED_VEHICLE" || testDoneNetworkId != 123 ? 58
        : !IsValidVehicleProfile(testVehicleProfile) ? 59
        : !testCommitDone ? 60
        : !testAbortDone ? 61
        : IsCommittedRegistrationResponse(
            "COMPANION_DONE commit-registration REGISTRATION_COMMITTED "
            . testRegistrationId . " 0", testRegistrationId) ? 62
        : !testCancelledCommitRetryBlocked ? 63
        : !testUserCancelledCommitRetryBlocked ? 64
        : !testUncertainCommitRetryAllowed ? 65
        : !testUnsynchronizedCompanionParsed
            || testUnsynchronizedCompanion.serverRegistrationSynchronized ? 66
        : !testLegacyCompanionRejected ? 67
        : !CapacityNeedsStorage({weight: 8000, maxWeight: 10000,
            used: 2, slots: 20}, &testCapacityReason, &testFreeWeight) ? 53
        : testCapacityReason != "weight" || testFreeWeight != 2000 ? 54
        : CapacityNeedsStorage({weight: 7999, maxWeight: 10000,
            used: 2, slots: 20}, &testCapacityReason, &testFreeWeight) ? 55
        : !CapacityNeedsStorage({weight: 1000, maxWeight: 10000,
            used: 20, slots: 20}, &testCapacityReason, &testFreeWeight) ? 56
        : testCapacityReason != "slots" ? 57
        : WorkViewDownRoute(450) != "450:32" ? 69
        : !InventorySlotWasConsumed("0001.food.e30=2", "0001.food.e30=1", 1) ? 70
        : InventorySlotWasConsumed("0001.food.e30=2", "0001.food.e30=2", 1) ? 71
        : !InventorySlotWasConsumed("0001.food.e30=1", "-", 1) ? 72 : 0
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

BuildWebGui()
ConfigureTrayMenu()
if !isUiTestRun {
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
}
OnExit Cleanup

if isUiSmokeTest {
    smokeExitCode := RunUiSmokeTest()
    State.gui.Hide()
    ExitApp smokeExitCode
}

if isVisualTest
    ApplyVisualTestFixture()

if A_Args.Length && A_Args[1] = "--updated"
    State.statusLabel.Text := "●  v" AppVersion " への更新が完了しました"
else if A_Args.Length && A_Args[1] = "--update-failed"
    State.statusLabel.Text := "●  更新に失敗したため以前の版へ戻しました"
else if !A_Args.Length && Config.autoCheckUpdates && A_IsCompiled && !isUiTestRun
    SetTimer((*) => BeginUpdateCheck(true), -1800)

HasCommandLineArgument(argumentName) {
    for argument in A_Args {
        if argument = argumentName
            return true
    }
    return false
}

class WebUiControl {
    __New(key, text := "", value := "", enabled := true) {
        global State
        this.Key := key
        this._text := String(text)
        this._value := value
        this._enabled := enabled ? true : false
        this._visible := true
        this._tone := "default"
        this.Hwnd := 0
        State.uiControls[key] := this
    }

    Text {
        get => this._text
        set {
            nextValue := String(value)
            if this._text != nextValue {
                this._text := nextValue
                QueueWebUiFlush()
            }
            return value
        }
    }

    Value {
        get => this._value
        set {
            if this._value != value {
                this._value := value
                QueueWebUiFlush()
            }
            return value
        }
    }

    Enabled {
        get => this._enabled
        set {
            nextValue := value ? true : false
            if this._enabled != nextValue {
                this._enabled := nextValue
                QueueWebUiFlush()
            }
            return value
        }
    }

    Visible {
        get => this._visible
        set {
            nextValue := value ? true : false
            if this._visible != nextValue {
                this._visible := nextValue
                QueueWebUiFlush()
            }
            return value
        }
    }

    Tone {
        get => this._tone
        set {
            nextValue := String(value)
            if this._tone != nextValue {
                this._tone := nextValue
                QueueWebUiFlush()
            }
            return value
        }
    }

    Choose(index) {
        this.Value := index
    }

    Opt(options) {
        if InStr(options, "cB42318")
            this.Tone := "error"
        else if InStr(options, "c248A3D")
            this.Tone := "success"
        return this
    }

    Move(*) {
    }
}

class WebUiWindow {
    __New(hwnd) {
        this.Hwnd := hwnd
    }

    Show(options := "") {
        global State
        State.uiWindowVisible := true
        EnsureWebUiHost()
        SendWebUiCommand(InStr(options, "NoActivate") ? "SHOWNOACTIVATE" : "SHOW")
        QueueWebUiFlush()
    }

    Hide() {
        global State
        State.uiWindowVisible := false
        SendWebUiCommand("HIDE")
        QueueWebUiFlush()
    }
}

BuildWebGui() {
    global State, Config, AppVersion

    State.uiSession := CreateWebUiSessionToken()
    State.uiBackendGui := Gui("+ToolWindow -Caption", "AI採掘機 Backend " State.uiSession)
    State.uiBackendGui.Show("Hide w1 h1")
    State.gui := WebUiWindow(State.uiBackendGui.Hwnd)
    State.pages := Map("overview", true, "vehicle", true, "settings", true, "update", true)
    State.ui := {
        deleteArmed: false,
        capacitySurface: true
    }

    State.taglineLabel := WebUiControl("taglineLabel", "画面を奪わず、選んだ作業を続けます")
    State.statusLabel := WebUiControl("statusLabel", "停止中")
    State.connectionLabel := WebUiControl("connectionLabel", "FiveM　確認中")
    State.modeLabel := WebUiControl("modeLabel", Config.backgroundMode
        ? "操作　バックグラウンド" : "操作　前面のみ")
    actionIndex := Config.actionMode = "washing" ? 2 : Config.actionMode = "gold" ? 3 : 1
    State.actionControl := WebUiControl("actionControl", "", actionIndex)
    State.mainButton := WebUiControl("mainButton", "自動操作を開始")
    State.countLabel := WebUiControl("countLabel", "採掘回数`n0")
    State.mealLabel := WebUiControl("mealLabel", "食事回数`n0")
    State.vehicleTripLabel := WebUiControl("vehicleTripLabel", "自動収納`n0")
    State.footerLabel := WebUiControl("footerLabel",
        "開始 " Config.startHotkey "　停止 " Config.stopHotkey)

    State.vehicleStatusLabel := WebUiControl("vehicleStatusLabel", "未登録")
    State.vehicleNameEdit := WebUiControl("vehicleNameEdit", "", Config.vehicleName)
    State.vehicleEnabledControl := WebUiControl("vehicleEnabledControl", "",
        Config.vehicleStorageEnabled)
    State.capacityStatusLabel := WebUiControl("capacityStatusLabel",
        "所持重量　開始後に確認します")
    State.capacityProgress := WebUiControl("capacityProgress", "", 0)
    State.capacityDetailLabel := WebUiControl("capacityDetailLabel",
        "重量を優先し、空きスロットも安全確認します")
    State.routeStatusLabel := WebUiControl("routeStatusLabel", "ローカル登録　未確認")
    State.routeDetailLabel := WebUiControl("routeDetailLabel",
        "登録を開始し、対象車両のストレージを一度だけ開いてください。")
    State.vehicleRegisterButton := WebUiControl("vehicleRegisterButton",
        "車両を登録")
    State.vehicleDeleteButton := WebUiControl("vehicleDeleteButton", "登録を削除", "", false)

    State.startHotkeyControl := WebUiControl("startHotkeyControl", "", Config.startHotkey)
    State.stopHotkeyControl := WebUiControl("stopHotkeyControl", "", Config.stopHotkey)
    State.backgroundControl := WebUiControl("backgroundControl", "", Config.backgroundMode)
    State.hideControl := WebUiControl("hideControl", "", Config.hideWhileRunning)
    State.washCorrectionControl := WebUiControl("washCorrectionControl", "",
        Config.washForwardCorrection && Config.goldRecoveryEnabled && Config.workViewLock)
    State.autoEatControl := WebUiControl("autoEatControl", "", Config.autoEat)
    State.foodKeyControl := WebUiControl("foodKeyControl", "", Config.foodKey)
    State.autoUpdateControl := WebUiControl("autoUpdateControl", "", Config.autoCheckUpdates)
    State.minimumFreeWeightControl := WebUiControl("minimumFreeWeightControl", "",
        Config.minimumFreeWeight)
    State.settingsButton := WebUiControl("settingsButton", "設定を保存")
    State.settingsErrorLabel := WebUiControl("settingsErrorLabel", "")

    State.currentVersionLabel := WebUiControl("currentVersionLabel", "v" AppVersion)
    State.updatePageStatus := WebUiControl("updatePageStatus", "未確認")
    State.updateButton := WebUiControl("updateButton", "アップデートを確認")
    State.ui.navUpdate := WebUiControl("navUpdate", "アップデート")

    OnMessage(0x004A, ReceiveWebUiCopyData)
    PrepareWebUiRuntime()
    EnsureWebUiHost()
    UpdateActionUi()
    UpdateConnectionStatus()
    RefreshVehicleUi()
    RefreshUpdateUi()
    SetTimer UpdateConnectionStatus, 2000
}

CreateWebUiSessionToken() {
    return Format("{:08X}{:08X}{:08X}", DllCall("GetCurrentProcessId"),
        A_TickCount & 0xFFFFFFFF, Random(0, 0x7FFFFFFF))
}

PrepareWebUiRuntime() {
    global State, AppVersion

    if A_IsCompiled {
        State.uiRuntimeRoot := A_Temp "\ai-miner-ui-" DllCall("GetCurrentProcessId")
        State.uiHostPath := State.uiRuntimeRoot "\AiMiner.UiHost.exe"
        State.uiAssetsPath := State.uiRuntimeRoot "\web"
        DirCreate State.uiRuntimeRoot
        DirCreate State.uiAssetsPath "\vendor"
        FileInstall "ui-runtime\host\AiMiner.UiHost.exe", State.uiHostPath, true
        FileInstall "ui-runtime\host\AiMiner.UiHost.exe.config",
            State.uiHostPath ".config", true
        FileInstall "ui-runtime\host\Microsoft.Web.WebView2.Core.dll",
            State.uiRuntimeRoot "\Microsoft.Web.WebView2.Core.dll", true
        FileInstall "ui-runtime\host\Microsoft.Web.WebView2.WinForms.dll",
            State.uiRuntimeRoot "\Microsoft.Web.WebView2.WinForms.dll", true
        FileInstall "ui-runtime\host\WebView2Loader.dll",
            State.uiRuntimeRoot "\WebView2Loader.dll", true
        FileInstall "ui-runtime\web\index.html", State.uiAssetsPath "\index.html", true
        FileInstall "ui-runtime\web\app.css", State.uiAssetsPath "\app.css", true
        FileInstall "ui-runtime\web\app.js", State.uiAssetsPath "\app.js", true
        FileInstall "ui-runtime\web\build-info.json",
            State.uiAssetsPath "\build-info.json", true
        FileInstall "ui-runtime\web\vendor\framework7-bundle.min.css",
            State.uiAssetsPath "\vendor\framework7-bundle.min.css", true
        FileInstall "ui-runtime\web\vendor\framework7-bundle.min.js",
            State.uiAssetsPath "\vendor\framework7-bundle.min.js", true
    } else {
        repositoryRoot := RegExReplace(A_ScriptDir, "\\src$")
        State.uiRuntimeRoot := repositoryRoot "\build\ui-host"
        State.uiHostPath := State.uiRuntimeRoot "\AiMiner.UiHost.exe"
        State.uiAssetsPath := A_ScriptDir "\ui-web\www"
    }

    required := [State.uiHostPath, State.uiHostPath ".config",
        State.uiRuntimeRoot "\Microsoft.Web.WebView2.Core.dll",
        State.uiRuntimeRoot "\Microsoft.Web.WebView2.WinForms.dll",
        State.uiRuntimeRoot "\WebView2Loader.dll", State.uiAssetsPath "\index.html",
        State.uiAssetsPath "\app.css", State.uiAssetsPath "\app.js",
        State.uiAssetsPath "\build-info.json",
        State.uiAssetsPath "\vendor\framework7-bundle.min.css",
        State.uiAssetsPath "\vendor\framework7-bundle.min.js"]
    for path in required {
        if !FileExist(path)
            throw Error("UI runtime file is missing: " path)
    }
}

EnsureWebUiHost(*) {
    global State
    if State.uiHostPid && ProcessExist(State.uiHostPid)
        return true
    if !FileExist(State.uiHostPath)
        return false

    State.uiReady := false
    State.uiHwnd := 0
    State.uiHostError := ""
    commandLine := QuoteCommandArg(State.uiHostPath)
        . " --backend-hwnd " State.uiBackendGui.Hwnd
        . " --backend-pid " DllCall("GetCurrentProcessId")
        . " --session " State.uiSession
        . " --assets " QuoteCommandArg(State.uiAssetsPath)
    try Run commandLine,,, &childPid
    catch as err {
        State.uiHostError := err.Message
        return false
    }
    State.uiHostPid := childPid
    SetTimer MonitorWebUiHost, 1000
    return true
}

MonitorWebUiHost(*) {
    global State
    if !State.uiHostPid || ProcessExist(State.uiHostPid)
        return
    State.uiHostPid := 0
    State.uiHwnd := 0
    State.uiReady := false
    SetTimer MonitorWebUiHost, 0
}

ReceiveWebUiCopyData(wParam, lParam, *) {
    global State
    try {
        if NumGet(lParam, 0, "Ptr") != 0x31495541
            return false
        byteCount := NumGet(lParam, A_PtrSize, "UInt")
        dataPointer := NumGet(lParam, A_PtrSize = 8 ? 16 : 8, "Ptr")
        if !dataPointer || byteCount < 2 || byteCount > 131072 || Mod(byteCount, 2)
            return false
        message := StrGet(dataPointer, byteCount // 2 - 1, "UTF-16")
        parts := StrSplit(message, "`t")
        if parts.Length < 3 || parts[1] != "AIUI1" || parts[2] != State.uiSession
            return false

        senderPid := 0
        DllCall("user32\GetWindowThreadProcessId", "Ptr", wParam, "UInt*", &senderPid)
        if senderPid != State.uiHostPid
            return false
        if parts[3] = "hello" {
            if parts.Length != 7 || parts[4] != "1" || parts[5] != "Framework7"
                || parts[6] != "9.1.3" || (parts[7] != "0" && parts[7] != "1")
                return false
            State.uiHwnd := wParam
            State.uiReady := true
            SendWebUiCommand(State.uiWindowVisible ? "SHOW" : "HIDE")
            QueueWebUiFlush(true)
            return true
        }
        if !State.uiReady || wParam != State.uiHwnd
            return false

        if parts[3] = "smoke.result" {
            State.uiSmokeResult := parts.Length >= 4 ? parts[4] : "ERROR"
            return true
        }
        State.uiActionQueue.Push(parts)
        if !State.uiActionPending {
            State.uiActionPending := true
            SetTimer ProcessWebUiActions, -1
        }
        return true
    } catch as err {
        WriteDiagnostic("UI_MESSAGE_ERROR=" err.Message)
        return false
    }
}

ProcessWebUiActions(*) {
    global State, Config
    State.uiActionPending := false
    while State.uiActionQueue.Length {
        parts := State.uiActionQueue.RemoveAt(1)
        action := parts[3]
        try {
            if action = "nav" && parts.Length = 4 {
                ShowPage(parts[4])
            } else if action = "action.select" && parts.Length = 4 {
                mode := parts[4]
                if mode = "mining" || mode = "washing" || mode = "gold" {
                    State.actionControl.Choose(mode = "washing" ? 2 : mode = "gold" ? 3 : 1)
                    ChangeActionMode(State.actionControl)
                }
            } else if action = "run.toggle" && parts.Length = 3 {
                if State.visualTest
                    ToggleVisualTestRun()
                else
                    ToggleMining()
            } else if action = "vehicle.toggle" && parts.Length = 4 {
                if State.visualTest {
                    State.vehicleEnabledControl.Value := parts[4] = "1"
                    Config.vehicleStorageEnabled := State.vehicleEnabledControl.Value
                } else {
                    State.vehicleEnabledControl.Value := parts[4] = "1"
                    ToggleVehicleStorage(State.vehicleEnabledControl)
                }
            } else if action = "vehicle.register" && parts.Length = 3 {
                if State.visualTest
                    State.vehicleStatusLabel.Text := "登録する車両のストレージを開いてください"
                else
                    BeginVehicleRegistration()
            } else if action = "vehicle.delete" && parts.Length = 3 {
                if State.visualTest {
                    State.vehicleStatusLabel.Text := "未登録"
                    State.vehicleDeleteButton.Enabled := false
                } else
                    DeleteVehicleRegistration()
            } else if action = "settings.save" && parts.Length = 12 {
                ApplyWebUiSettings(parts)
            } else if action = "update.check" && parts.Length = 3 {
                if State.visualTest {
                    State.updatePageStatus.Text := "新しいバージョン v8.1.0 があります"
                    State.updateButton.Text := "ダウンロードして更新"
                    State.ui.navUpdate.Text := "アップデート •"
                } else
                    CheckForUpdates()
            } else if action = "window.close" && parts.Length = 3 {
                ExitApp()
            }
        } catch as err {
            WriteDiagnostic("UI_ACTION_ERROR action=" action " error=" err.Message)
            State.settingsErrorLabel.Opt("cB42318")
            State.settingsErrorLabel.Text := "操作を完了できませんでした。"
        }
    }
    QueueWebUiFlush()
}

ApplyWebUiSettings(parts) {
    global State, Config
    if State.registrationActive {
        State.settingsErrorLabel.Opt("cB42318")
        State.settingsErrorLabel.Text := "車両登録を中止してから設定を変更してください。"
        QueueWebUiFlush()
        return
    }
    State.startHotkeyControl.Value := parts[4]
    State.stopHotkeyControl.Value := parts[5]
    State.backgroundControl.Value := parts[6] = "1"
    State.hideControl.Value := parts[7] = "1"
    State.washCorrectionControl.Value := parts[8] = "1"
    State.autoEatControl.Value := parts[9] = "1"
    State.foodKeyControl.Value := parts[10]
    State.autoUpdateControl.Value := parts[11] = "1"
    State.minimumFreeWeightControl.Value := parts[12]
    if !State.visualTest {
        SaveInlineSettings()
        return
    }
    Config.startHotkey := parts[4]
    Config.stopHotkey := parts[5]
    Config.backgroundMode := parts[6] = "1"
    Config.hideWhileRunning := parts[7] = "1"
    Config.washForwardCorrection := parts[8] = "1"
    Config.goldRecoveryEnabled := parts[8] = "1"
    Config.workViewLock := parts[8] = "1"
    Config.autoEat := parts[9] = "1"
    try Config.foodKey := Integer(parts[10])
    Config.autoCheckUpdates := parts[11] = "1"
    try Config.minimumFreeWeight := Integer(parts[12])
    State.footerLabel.Text := "開始 " Config.startHotkey "　停止 " Config.stopHotkey
    State.settingsErrorLabel.Opt("c248A3D")
    State.settingsErrorLabel.Text := "設定を保存しました。"
    UpdateConnectionStatus()
}

ToggleVisualTestRun() {
    global State
    State.running := !State.running
    State.mainButton.Text := State.running ? "自動操作を停止" : "自動操作を開始"
    State.actionControl.Enabled := !State.running
    State.statusLabel.Text := State.running ? "●  砂金を採っています" : "●  停止中"
    if State.running {
        State.successes := 22
        State.nudges := 2
        State.countLabel.Text := "砂金採り回数`n22"
        State.mealLabel.Text := "位置補正`n2"
    }
}

ApplyVisualTestFixture() {
    global State, Config
    Config.actionMode := "gold"
    State.actionControl.Value := 3
    State.connectionLabel.Text := "FiveM　接続済み"
    State.modeLabel.Text := "操作　バックグラウンド"
    State.taglineLabel.Text := "画面を奪わず、位置ずれも検知して砂金を採ります"
    State.statusLabel.Text := "●  停止中"
    State.countLabel.Text := "砂金採り回数`n22"
    State.mealLabel.Text := "位置補正`n0"
    State.vehicleTripLabel.Text := "自動収納`n0"
    State.vehicleStatusLabel.Text := "登録済み　作業用トラック"
    State.vehicleNameEdit.Value := "作業用トラック"
    State.vehicleEnabledControl.Enabled := true
    State.routeStatusLabel.Text := "ローカル登録　準備完了"
    State.routeDetailLabel.Text := "作業: 砂金採りトレイ　·　現在位置を取得できます"
    State.capacityStatusLabel.Text := "所持重量　8.0 kg / 20.0 kg　40%"
    State.capacityProgress.Value := 40
    State.capacityDetailLabel.Text := "残り 12.0 kg　·　収納開始 2.0 kg"
    State.updatePageStatus.Text := "最新バージョンです"
    QueueWebUiFlush(true)
}

QueueWebUiFlush(immediate := false) {
    global State
    if State.uiFlushPending
        return
    State.uiFlushPending := true
    SetTimer FlushWebUiState, immediate ? -1 : -16
}

FlushWebUiState(*) {
    global State
    State.uiFlushPending := false
    if !State.uiReady || !State.uiHwnd
        return
    State.uiRevision += 1
    payload := BuildWebUiStateJson()
    if !SendWebUiCopyData(State.uiHwnd,
        "AIUISTATE1`t" State.uiSession "`t" payload) {
        State.uiReady := false
        State.uiHwnd := 0
    }
}

BuildWebUiStateJson() {
    global State, Config, AppVersion
    controlsJson := ""
    for key, control in State.uiControls {
        if controlsJson
            controlsJson .= ","
        controlsJson .= JsonQuote(key) ":{"
            . '"text":' JsonQuote(control.Text) ","
            . '"value":' JsonScalar(control.Value) ","
            . '"enabled":' (control.Enabled ? "true" : "false") ","
            . '"visible":' (control.Visible ? "true" : "false") ","
            . '"tone":' JsonQuote(control.Tone) "}"
    }
    actionMode := State.running ? State.runMode : Config.actionMode
    return '{"type":"state","revision":' State.uiRevision
        . ',"version":' JsonQuote(AppVersion)
        . ',"page":' JsonQuote(State.page)
        . ',"running":' (State.running ? "true" : "false")
        . ',"registrationActive":' (State.registrationActive ? "true" : "false")
        . ',"actionMode":' JsonQuote(actionMode)
        . ',"windowVisible":' (State.uiWindowVisible ? "true" : "false")
        . ',"visualTest":' (State.visualTest ? "true" : "false")
        . ',"controls":{' controlsJson '}}'
}

JsonScalar(value) {
    valueType := Type(value)
    if valueType = "Integer" || valueType = "Float"
        return String(value)
    return JsonQuote(value)
}

JsonQuote(value) {
    value := String(value)
    value := StrReplace(value, "\", "\\")
    value := StrReplace(value, Chr(34), "\" Chr(34))
    value := StrReplace(value, "`b", "\b")
    value := StrReplace(value, "`f", "\f")
    value := StrReplace(value, "`r", "\r")
    value := StrReplace(value, "`n", "\n")
    value := StrReplace(value, "`t", "\t")
    return Chr(34) value Chr(34)
}

SendWebUiCommand(command) {
    global State
    if !State.uiReady || !State.uiHwnd
        return false
    return SendWebUiCopyData(State.uiHwnd,
        "AIUICMD1`t" State.uiSession "`t" command)
}

SendWebUiCopyData(targetHwnd, message) {
    global State
    if !targetHwnd || !DllCall("user32\IsWindow", "Ptr", targetHwnd, "Int")
        return false
    messageBuffer := Buffer((StrLen(message) + 1) * 2, 0)
    StrPut(message, messageBuffer, "UTF-16")
    copyDataSize := A_PtrSize = 8 ? 24 : 12
    copyData := Buffer(copyDataSize, 0)
    NumPut("Ptr", 0x31495541, copyData, 0)
    NumPut("UInt", messageBuffer.Size, copyData, A_PtrSize)
    NumPut("Ptr", messageBuffer.Ptr, copyData, A_PtrSize = 8 ? 16 : 8)
    sendResult := 0
    try return !!DllCall("user32\SendMessageTimeoutW", "Ptr", targetHwnd,
        "UInt", 0x004A, "Ptr", State.uiBackendGui.Hwnd, "Ptr", copyData.Ptr,
        "UInt", 0x0002, "UInt", 2000, "Ptr*", &sendResult, "Ptr")
    catch
        return false
}

ShowPage(pageName, *) {
    global State
    if !State.pages.Has(pageName)
        return
    State.page := pageName
    RefreshNavigationSelection()
    if pageName = "vehicle" {
        RefreshVehicleUi()
        if !State.running && !State.registrationActive
            SetTimer CheckCompanionStatusForUi, -30
    } else if pageName = "update"
        RefreshUpdateUi()
    QueueWebUiFlush()
}

RefreshNavigationSelection() {
    global State
    QueueWebUiFlush()
}

RunUiSmokeTest() {
    global State
    deadline := MonotonicMs() + 15000
    while !State.uiReady && MonotonicMs() < deadline
        Sleep 50
    if !State.uiReady || !State.uiHwnd
        return 41
    if State.uiControls.Count < 20 || !State.uiControls.Has("mainButton")
        || !State.uiControls.Has("vehicleNameEdit")
        || !State.uiControls.Has("settingsButton")
        || !State.uiControls.Has("updateButton")
        return 42
    State.uiSmokeResult := ""
    if !SendWebUiCommand("SMOKE")
        return 43
    deadline := MonotonicMs() + 12000
    while !State.uiSmokeResult && MonotonicMs() < deadline
        Sleep 50
    if State.uiSmokeResult != "OK"
        return 44
    for pageName in ["overview", "vehicle", "settings", "update"] {
        ShowPage(pageName)
        if State.page != pageName
            return 45
    }
    ShowPage("overview")
    return 0
}

HandleMainEscape(*) {
    global State
    if State.page != "overview"
        ShowPage("overview")
    else
        State.gui.Hide()
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
    return State.running || State.registrationActive
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
    if State.running || State.registrationActive {
        activeMode := State.running ? State.runMode : Config.actionMode
        control.Choose(activeMode = "washing" ? 2 : activeMode = "gold" ? 3 : 1)
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
    if State.registrationActive {
        State.settingsErrorLabel.Text := "車両登録を中止してから設定を変更してください。"
        return
    }
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
    try newFoodKey := Integer(Trim(State.foodKeyControl.Value))
    catch {
        State.settingsErrorLabel.Text := "食料スロットは1～5で指定してください。"
        return
    }
    if newFoodKey < 1 || newFoodKey > 5 {
        State.settingsErrorLabel.Text := "食料スロットは1～5で指定してください。"
        return
    }
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
        workViewLock: Config.workViewLock,
        autoEat: Config.autoEat,
        foodKey: Config.foodKey,
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
    Config.workViewLock := State.washCorrectionControl.Value ? 1 : 0
    Config.autoEat := State.autoEatControl.Value ? 1 : 0
    Config.foodKey := newFoodKey
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
        Config.workViewLock := oldConfig.workViewLock
        Config.autoEat := oldConfig.autoEat
        Config.foodKey := oldConfig.foodKey
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
        IniWrite Config.foodKey, temporarySettingsPath, "Eating", "FoodKey"
        IniWrite Config.foodKeyHoldMs, temporarySettingsPath, "Eating", "FoodKeyHoldMs"
        IniWrite Config.autoEat, temporarySettingsPath, "Eating", "AutoEat"
        IniWrite Config.hungerCheckIntervalMs, temporarySettingsPath, "Eating", "HungerCheckIntervalMs"
        IniWrite Config.hungerConfirmFrames, temporarySettingsPath, "Eating", "HungerConfirmFrames"
        IniWrite Config.hungerConfirmGapMs, temporarySettingsPath, "Eating", "HungerConfirmGapMs"
        IniWrite Config.eatAnimationMs, temporarySettingsPath, "Eating", "EatAnimationMs"
        IniWrite Config.gaugeSettleMs, temporarySettingsPath, "Eating", "GaugeSettleMs"
        IniWrite Config.eatCooldownMs, temporarySettingsPath, "Eating", "EatCooldownMs"
        IniWrite Config.postEatResumeMs, temporarySettingsPath, "Eating", "PostEatResumeMs"
        IniWrite Config.backgroundEatFallback, temporarySettingsPath, "Eating", "BackgroundFallback"
        IniWrite Config.backgroundFirstEatDelayMs, temporarySettingsPath, "Eating", "BackgroundFirstEatDelayMs"
        IniWrite Config.backgroundEatIntervalMs, temporarySettingsPath, "Eating", "BackgroundEatIntervalMs"
        IniWrite Config.failedEatRetryMs, temporarySettingsPath, "Eating", "FailedEatRetryMs"
        IniWrite Config.workViewLock, temporarySettingsPath, "ViewLock", "Enabled"
        IniWrite Config.workViewDownPulseMs, temporarySettingsPath, "ViewLock", "DownPulseMs"
        IniWrite Config.workViewIntervalMs, temporarySettingsPath, "ViewLock", "ReapplyIntervalMs"
        IniWrite Config.vehicleStorageEnabled, temporarySettingsPath, "VehicleStorage", "Enabled"
        IniWrite Config.vehicleRegistered, temporarySettingsPath, "VehicleStorage", "Registered"
        IniWrite Config.vehicleName, temporarySettingsPath, "VehicleStorage", "DisplayName"
        IniWrite Config.vehicleStorageId, temporarySettingsPath, "VehicleStorage", "StorageId"
        IniWrite Config.vehicleStorageType, temporarySettingsPath, "VehicleStorage", "StorageType"
        IniWrite Config.vehicleWorkMode, temporarySettingsPath, "VehicleStorage", "WorkMode"
        IniWrite Config.vehicleRouteFormat, temporarySettingsPath, "VehicleStorage", "RouteFormat"
        IniWrite Config.vehicleCompanionProtocol, temporarySettingsPath, "VehicleStorage", "CompanionProtocol"
        IniWrite Config.vehicleRegistrationId, temporarySettingsPath, "VehicleStorage", "CompanionRegistrationId"
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

ToggleLocalVehicleStorage(control) {
    global State, Config
    if State.running || State.registrationActive {
        control.Value := Config.vehicleStorageEnabled
        return
    }

    requested := control.Value ? 1 : 0
    if requested && !IsValidVehicleProfile(Config) {
        control.Value := 0
        Config.vehicleStorageEnabled := 0
        State.vehicleStatusLabel.Text := "先に登録する車両のストレージを一度開いてください"
        RefreshLocalVehicleUi()
        return
    }
    if requested && !Config.backgroundMode {
        control.Value := 0
        Config.vehicleStorageEnabled := 0
        State.vehicleStatusLabel.Text := "車両収納にはバックグラウンド操作が必要です"
        RefreshLocalVehicleUi()
        return
    }

    previous := Config.vehicleStorageEnabled
    Config.vehicleStorageEnabled := requested
    try SaveAllSettingsAtomically()
    catch as err {
        Config.vehicleStorageEnabled := previous
        control.Value := previous
        State.vehicleStatusLabel.Text := "設定を保存できません: " err.Message
        QueueWebUiFlush()
        return
    }
    RefreshLocalVehicleUi()
}

RefreshLocalVehicleUi(*) {
    global State, Config
    if !IsObject(State.vehicleStatusLabel)
        return

    valid := IsValidVehicleProfile(Config)
    Config.vehicleStorageEnabled := Config.vehicleStorageEnabled && valid ? 1 : 0
    State.vehicleEnabledControl.Value := Config.vehicleStorageEnabled
    State.vehicleEnabledControl.Enabled := valid && !State.running && !State.registrationActive
    State.vehicleNameEdit.Value := Config.vehicleName
    State.vehicleNameEdit.Enabled := !State.running && !State.registrationActive
    State.vehicleRegisterButton.Enabled := !State.running && !State.registrationActive
    State.vehicleRegisterButton.Text := valid ? "別の車両を登録" : "車両を登録"
    State.vehicleDeleteButton.Enabled := valid && !State.running && !State.registrationActive

    if State.registrationActive {
        State.vehicleStatusLabel.Text := "登録する車両のストレージを開いてください"
        State.routeStatusLabel.Text := "ストレージを待っています"
        State.routeDetailLabel.Text := "通常どおり荷台を開くと、端末内への登録が自動で完了します。"
    } else if valid {
        State.vehicleStatusLabel.Text := "登録済み　" Config.vehicleName
        State.routeStatusLabel.Text := "ローカル登録　準備完了"
        State.routeDetailLabel.Text := "満重量になると近くの同じストレージだけを探し、採集分を収納して作業へ戻ります。"
    } else {
        State.vehicleStatusLabel.Text := "未登録"
        State.routeStatusLabel.Text := "サーバー側への導入は不要です"
        State.routeDetailLabel.Text := "登録を開始し、対象車両のストレージを一度だけ手動で開いてください。"
    }
    RefreshCapacityUi()
    QueueWebUiFlush()
}

BeginLocalVehicleRegistration(*) {
    global State, Config
    if State.running || State.updateOperation || State.registrationActive
        return
    if !Config.backgroundMode {
        State.vehicleStatusLabel.Text := "設定でバックグラウンド操作をオンにしてください"
        QueueWebUiFlush()
        return
    }

    targetHwnd := FindFiveMWindow()
    if !targetHwnd {
        State.vehicleStatusLabel.Text := "FiveMが見つかりません"
        QueueWebUiFlush()
        return
    }
    try targetPid := WinGetPID("ahk_id " targetHwnd)
    catch
        targetPid := 0
    healthResult := RunBackgroundBridge("health")
    if !targetPid || !ParseServerHealth(healthResult, &registrationEpoch) {
        State.vehicleStatusLabel.Text := "FiveMのインベントリ接続を確認できません"
        WriteDiagnostic("LOCAL_REGISTRATION_PREFLIGHT_ERROR=" healthResult)
        QueueWebUiFlush()
        return
    }

    ; 登録開始前から開かれていた別ストレージを誤登録しないよう、必ず閉じた状態を作ります。
    closeResult := RunBackgroundBridge("close-inventory")
    if closeResult != "CLOSED" {
        State.vehicleStatusLabel.Text := "インベントリを閉じてから、もう一度登録してください"
        WriteDiagnostic("LOCAL_REGISTRATION_CLOSE_ERROR=" closeResult)
        QueueWebUiFlush()
        return
    }

    previousProfile := SnapshotVehicleProfile()
    finalStatus := ""
    registrationSucceeded := false
    State.registrationActive := true
    State.registrationCancelled := false
    State.registrationDeadline := MonotonicMs() + 75000
    State.targetHwnd := targetHwnd
    State.targetPid := targetPid
    State.serverEpoch := registrationEpoch
    State.actionControl.Enabled := false
    SetConfigurationEnabled(false)
    State.settingsButton.Enabled := false
    State.vehicleStatusLabel.Text := "登録する車両のストレージを開いてください"
    RefreshLocalVehicleUi()
    State.gui.Hide()
    ShowLocalRegistrationOverlay(targetHwnd)
    try WinActivate "ahk_id " targetHwnd

    try {
        nextHealthAt := 0
        loop {
            if State.registrationCancelled {
                finalStatus := "車両登録を中止しました"
                break
            }
            if !IsTargetIdentityAlive() {
                finalStatus := "FiveMが終了したため登録を中止しました"
                break
            }
            now := MonotonicMs()
            if now >= State.registrationDeadline {
                finalStatus := "時間内にストレージを確認できませんでした"
                break
            }
            UpdateLocalRegistrationOverlay(Ceil((State.registrationDeadline - now) / 1000))
            if now >= nextHealthAt {
                liveHealth := RunBackgroundBridgeCancelable(0, "health")
                if !ParseServerHealth(liveHealth, &liveEpoch) || liveEpoch != registrationEpoch {
                    finalStatus := "サーバー再起動または再接続を検知したため登録を中止しました"
                    WriteDiagnostic("LOCAL_REGISTRATION_EPOCH_ERROR=" liveHealth)
                    break
                }
                nextHealthAt := MonotonicMs() + 2200
            }

            captureResult := RunBackgroundBridgeCancelable(0, "capture-storage")
            State.lastStorageProbeResult := captureResult
            if ParseStorageCapture(captureResult, &storageInfo) {
                ; 保存直前にも同じFiveMプロセスとNUIセッションであることを照合します。
                finalHealth := RunBackgroundBridgeCancelable(0, "health")
                if !ParseServerHealth(finalHealth, &finalEpoch)
                    || finalEpoch != registrationEpoch || !IsTargetIdentityAlive() {
                    finalStatus := "接続状態が変わったため車両を登録しませんでした"
                    WriteDiagnostic("LOCAL_REGISTRATION_FINAL_EPOCH_ERROR=" finalHealth)
                    break
                }

                displayName := Trim(StrReplace(StrReplace(State.vehicleNameEdit.Value,
                    "`r", " "), "`n", " "))
                if !displayName
                    displayName := "登録車両"
                if StrLen(displayName) > 40
                    displayName := SubStr(displayName, 1, 40)
                commitCancelled := false
                Critical "On"
                try {
                    if State.registrationCancelled || !IsTargetIdentityAlive() {
                        commitCancelled := true
                    } else {
                        Config.vehicleName := displayName
                        Config.vehicleStorageId := storageInfo.id
                        Config.vehicleStorageType := storageInfo.type
                        Config.vehicleWorkMode := Config.actionMode
                        Config.vehicleCompanionProtocol := 0
                        Config.vehicleRegistrationId := ""
                        Config.vehicleRouteFormat := 5
                        Config.vehicleOutboundRoute := ""
                        Config.vehicleReturnRoute := ""
                        Config.vehicleRegistered := 1
                        Config.vehicleStorageEnabled := 1
                        SaveAllSettingsAtomically()
                        registrationSucceeded := true
                        finalStatus := "登録完了　" Config.vehicleName
                        State.lastStorageResult := "登録済み"
                        WriteDiagnostic("LOCAL_REGISTRATION_COMPLETE type=" storageInfo.type
                            " weight=" storageInfo.weight " max=" storageInfo.maxWeight)
                    }
                } catch as err {
                    RestoreVehicleProfile(previousProfile)
                    finalStatus := "登録を保存できません: " err.Message
                    WriteDiagnostic("LOCAL_REGISTRATION_SAVE_ERROR=" err.Message)
                } finally {
                    Critical "Off"
                }
                if commitCancelled
                    finalStatus := "車両登録を中止しました"
                break
            }
            Sleep 220
        }
    } catch as err {
        if !registrationSucceeded
            RestoreVehicleProfile(previousProfile)
        finalStatus := "車両登録を完了できませんでした"
        WriteDiagnostic("LOCAL_REGISTRATION_ERROR=" err.Message)
    } finally {
        CloseLocalRegistrationOverlay()
        ReleaseBackgroundTarget(true)
        RunBackgroundBridge("close-inventory")
        State.registrationActive := false
        State.registrationCancelled := false
        State.registrationDeadline := 0
        State.targetHwnd := 0
        State.targetPid := 0
        State.serverEpoch := ""
        State.actionControl.Enabled := true
        SetConfigurationEnabled(true)
        State.settingsButton.Enabled := true
        RefreshLocalVehicleUi()
        if finalStatus
            State.vehicleStatusLabel.Text := finalStatus
        ShowPage("vehicle")
        ShowMainWindow()
        QueueWebUiFlush(true)
    }
}

ShowLocalRegistrationOverlay(targetHwnd) {
    global State, Config
    CloseLocalRegistrationOverlay()
    overlay := Gui("+AlwaysOnTop -Caption +ToolWindow +E0x20")
    overlay.BackColor := "F2F2F7"
    overlay.MarginX := 22
    overlay.MarginY := 15
    overlay.SetFont("s12 w600 c1C1C1E", "Segoe UI")
    overlay.AddText("w396 Center", "登録する車両のストレージを開いてください")
    overlay.SetFont("s9 w400 c6C6C70", "Segoe UI")
    countdown := overlay.AddText("y+7 w396 Center", "開くと自動で登録されます　·　"
        Config.stopHotkey "で中止")
    State.registrationOverlay := {gui: overlay, countdown: countdown}
    try WinGetPos(&windowX, &windowY, &windowW, &windowH, "ahk_id " targetHwnd)
    catch {
        windowX := 0
        windowY := 0
        windowW := A_ScreenWidth
    }
    overlayW := 440
    overlayH := 78
    overlayX := windowX + Floor((windowW - overlayW) / 2)
    overlayY := windowY + 56
    overlay.Show("x" overlayX " y" overlayY " w" overlayW " h" overlayH " NoActivate")
    ApplyRoundedWindowCorners(overlay.Hwnd)
}

UpdateLocalRegistrationOverlay(secondsRemaining) {
    global State, Config
    if !IsObject(State.registrationOverlay)
        return
    try State.registrationOverlay.countdown.Text := "開くと自動で登録されます　·　残り "
        . Max(0, secondsRemaining) "秒　·　" Config.stopHotkey "で中止"
}

CloseLocalRegistrationOverlay() {
    global State
    if IsObject(State.registrationOverlay) {
        try State.registrationOverlay.gui.Destroy()
    }
    State.registrationOverlay := 0
}

DeleteLocalVehicleRegistration(*) {
    global State, Config
    if State.running || State.registrationActive || !IsValidVehicleProfile(Config)
        return
    previousProfile := SnapshotVehicleProfile()
    Config.vehicleStorageEnabled := 0
    Config.vehicleRegistered := 0
    Config.vehicleStorageId := ""
    Config.vehicleStorageType := ""
    Config.vehicleCompanionProtocol := 0
    Config.vehicleRegistrationId := ""
    Config.vehicleRouteFormat := 0
    Config.vehicleOutboundRoute := ""
    Config.vehicleReturnRoute := ""
    try SaveAllSettingsAtomically()
    catch as err {
        RestoreVehicleProfile(previousProfile)
        State.vehicleStatusLabel.Text := "登録を削除できません: " err.Message
        QueueWebUiFlush()
        return
    }
    State.lastStorageResult := "登録なし"
    RefreshLocalVehicleUi()
}

ToggleVehicleStorage(control, *) {
    ToggleLocalVehicleStorage(control)
}

RefreshVehicleUi(*) {
    RefreshLocalVehicleUi()
}

CheckCompanionStatusForUi(*) {
    UpdateConnectionStatus()
    RefreshLocalVehicleUi()
}

QueryCompanionStatus(&companionInfo, expectedEpoch := "", expectedGeneration := -1) {
    global State
    companionInfo := 0
    result := expectedGeneration >= 0
        ? RunBackgroundBridgeCancelable(expectedGeneration, "companion-status")
        : RunBackgroundBridge("companion-status")
    if !ParseCompanionStatus(result, &parsed) {
        State.companionReady := false
        if !expectedEpoch
            State.companionEpoch := ""
        State.companionResourceVersion := ""
        State.companionRegistrationAvailable := false
        State.companionRegistrationId := ""
        State.companionVehiclePlate := ""
        State.companionVehicleLabel := ""
        State.companionTransactionSupported := false
        State.companionTransactionPending := false
        State.companionServerRegistrationSynchronized := false
        State.companionStatus := InStr(result, "NUI_FRAME_NOT_FOUND")
            ? "補助リソース未接続" : "補助連携を確認できません"
        WriteDiagnostic("COMPANION_STATUS_ERROR=" result)
        return false
    }
    if expectedEpoch && parsed.epoch != expectedEpoch {
        State.companionReady := false
        State.companionStatus := "補助リソースが再起動しました"
        WriteDiagnostic("COMPANION_EPOCH_CHANGED expected=" expectedEpoch
            " actual=" parsed.epoch)
        return false
    }
    companionInfo := parsed
    State.companionReady := true
    State.companionEpoch := parsed.epoch
    State.companionResourceVersion := parsed.resourceVersion
    State.companionRegistrationAvailable := parsed.available
    State.companionRegistrationId := parsed.registrationId
    State.companionVehiclePlate := parsed.plate
    State.companionVehicleLabel := parsed.label
    State.companionLastSequence := parsed.sequence
    State.companionLastCheckAt := MonotonicMs()
    State.companionStatus := parsed.status
    State.companionTransactionSupported := parsed.transactionSupported
    State.companionTransactionPending := parsed.transactionPending
    State.companionServerRegistrationSynchronized := parsed.serverRegistrationSynchronized
    return true
}

ParseCompanionStatus(result, &info) {
    info := 0
    parts := StrSplit(Trim(result), " ")
    if parts.Length != 17 || parts[1] != "COMPANION" || parts[2] != "1"
        return false
    if !RegExMatch(parts[3], "^\d+\.\d+\.\d+$")
        || !RegExMatch(parts[4], "^[a-z0-9_]{16,128}$")
        || !RegExMatch(parts[6], "^[a-z][a-z0-9_]{0,47}$")
        || (parts[7] != "0" && parts[7] != "1")
        || (parts[12] != "0" && parts[12] != "1")
        || !RegExMatch(parts[14], "^[A-Z0-9_]{1,64}$")
        || (parts[15] != "0" && parts[15] != "1")
        || (parts[16] != "0" && parts[16] != "1")
        || (parts[17] != "0" && parts[17] != "1")
        return false
    try {
        sequence := Integer(parts[5])
        model := Integer(parts[11])
        distanceCm := Integer(parts[13])
    } catch {
        return false
    }
    if sequence < 0 || model < 0 || distanceCm < -1
        return false
    registered := parts[7] = "1"
    transactionSupported := parts[15] = "1"
    transactionPending := parts[16] = "1"
    serverRegistrationSynchronized := parts[17] = "1"
    if transactionPending && (!transactionSupported || !registered)
        return false
    if registered {
        if !IsValidCompanionRegistrationId(parts[8]) || !IsValidBase64Token(parts[9])
            || !IsValidBase64Token(parts[10]) || model = 0
            return false
    } else if parts[8] != "-" || parts[9] != "-" || parts[10] != "-"
        return false
    info := {
        resourceVersion: parts[3], epoch: parts[4], sequence: sequence,
        status: parts[6], registered: registered,
        registrationId: registered ? parts[8] : "",
        plate: registered ? parts[9] : "",
        label: registered ? parts[10] : "", model: model,
        available: parts[12] = "1", distanceCm: distanceCm,
        lastCode: parts[14], transactionSupported: transactionSupported,
        transactionPending: transactionPending,
        serverRegistrationSynchronized: serverRegistrationSynchronized
    }
    return true
}

CompanionProfileMatches(info) {
    global Config
    return IsObject(info) && info.registered
        && info.transactionSupported && !info.transactionPending
        && info.serverRegistrationSynchronized
        && IsValidVehicleProfile(Config)
        && info.registrationId = Config.vehicleRegistrationId
}

RunCompanionCommand(command, registrationId := "") {
    args := [command]
    if registrationId
        args.Push(registrationId)
    return RunBackgroundBridge("companion-command", args*)
}

RunCompanionCommandCancelable(expectedGeneration, command, registrationId := "") {
    args := [command]
    if registrationId
        args.Push(registrationId)
    return RunBackgroundBridgeCancelable(expectedGeneration, "companion-command", args*)
}

CompanionCommandSucceeded(result, command, &registrationId := "", &resultCode := "",
    &networkId := 0) {
    registrationId := ""
    resultCode := ""
    networkId := 0
    if !RegExMatch(result,
        "^COMPANION_DONE ([a-z][a-z0-9_-]{0,47}) ([A-Z0-9_]{1,64}) ([-A-Za-z0-9+/=]+) (\d+)$", &parts)
        return false
    if parts[1] != command
        return false
    if parts[3] != "-" {
        if !IsValidCompanionRegistrationId(parts[3])
            return false
        registrationId := parts[3]
    }
    try networkId := Integer(parts[4])
    catch
        return false
    if networkId < 0 || networkId > 2147483647
        return false
    resultCode := parts[2]
    return true
}

IsValidCompanionRegistrationId(value) {
    value := String(value)
    ; serverの `amv_` + 36桁hexをbridgeがUTF-8/Base64化した固定長です。
    return StrLen(value) = 56 && RegExMatch(value, "^[A-Za-z0-9+/]{54}==$")
}

CompanionFailureMessage(result, fallback) {
    code := RegExMatch(result, "^ERROR COMPANION_([A-Z0-9_]{1,64})$", &parts)
        ? parts[1] : ""
    return code = "OWNERSHIP_ADAPTER_NOT_CONFIGURED"
        ? "サーバー側の車両所有確認が未設定です"
        : code = "INCOMPATIBLE"
            ? "FiveM補助リソースが古いため、管理者による更新が必要です"
        : code = "VEHICLE_NOT_OWNED" || code = "OWNERSHIP_ACE_DENIED"
            ? "この車両の所有権を確認できません"
        : code = "VEHICLE_TOO_FAR" ? "登録車両が遠すぎるため停止しました"
        : code = "VEHICLE_UNAVAILABLE" ? "登録車両が現在存在しないため停止しました"
        : code = "VEHICLE_MATCH_AMBIGUOUS" ? "同じ車両候補が複数あるため停止しました"
        : code = "NAVIGATION_STUCK" ? "経路が塞がれているため停止しました"
        : code = "RETURN_STUCK" ? "作業地点へ戻る経路が塞がれているため停止しました"
        : code = "NAVIGATION_TIMEOUT" || code = "RETURN_TIMEOUT"
            ? "自動移動が時間切れになったため停止しました"
        : code = "VEHICLE_UNSTREAMED" ? "移動中に登録車両を見失ったため停止しました"
        : code = "VEHICLE_MOVED_AFTER_ARRIVAL"
            ? "到着確認中に車両が移動したため停止しました"
        : code = "PLAYER_CANNOT_NAVIGATE"
            ? "徒歩で安全に移動できる状態ではないため停止しました"
        : code = "MANUAL_OVERRIDE" ? "手動操作を検知したため自動移動を停止しました"
        : code = "VEHICLE_SELECTION_AMBIGUOUS" ? "車両を1台だけ画面中央に合わせてください"
        : code = "VEHICLE_NOT_AIMED" ? "登録する車両を画面中央に合わせてください"
        : code = "REGISTRATION_TIMEOUT" ? "車両登録が時間切れになりました"
        : code = "REGISTRATION_CANCELLED" ? "車両登録を中止しました"
        : code = "REGISTRATION_TRANSACTION_EXPIRED"
            ? "車両登録候補の有効時間が切れました。もう一度登録してください"
        : code = "REGISTRATION_TRANSACTION_NOT_FOUND"
            ? "車両登録候補が見つかりません。もう一度登録してください"
        : code = "REGISTRATION_TRANSACTION_PENDING"
            ? "別の未確定車両候補があります。登録画面からやり直してください"
        : code = "REGISTRATION_ID_INVALID"
            ? "車両登録候補IDが不正なため確定しませんでした"
        : code = "SERVER_REGISTRATION_SYNC_PENDING"
            ? "サーバーの車両登録同期が終わるまでお待ちください"
        : code = "REGISTRATION_CANDIDATE_MISMATCH"
            ? "別の車両登録候補へ切り替わったため確定しませんでした"
        : code = "REGISTRATION_COMMIT_REJECTED"
            ? "サーバー側が車両登録の確定を拒否しました"
        : code = "REGISTRATION_COMMIT_FAILED"
            ? "サーバー側で車両登録を確定できませんでした"
        : code = "REGISTRATION_ABORT_FAILED"
            ? "サーバー側で車両登録候補を破棄できませんでした"
        : code = "REGISTRATION_NOT_PENDING"
            ? "車両登録候補はすでに確定または破棄されています"
        : code = "BUSY" ? "ゲーム内連携が別の操作を実行中です"
        : code = "WORK_ANCHOR_UNSAFE" ? "徒歩で停止して作業対象の前に立ってください"
        : code = "CARGO_TOO_FAR" ? "荷台から離れたため収納を開始できません"
        : code = "CARGO_PROVIDER_UNAVAILABLE" ? "サーバーの荷台連携が利用できません"
        : code = "CARGO_OPEN_ERROR" || code = "CARGO_OPEN_REJECTED"
            ? "登録車両の荷台を開けませんでした"
        : code = "REGISTRATION_NOT_FOUND" ? "登録車両がサーバー側に存在しません"
        : code = "MANUAL_INPUT" ? "手動操作を検知したため自動移動を停止しました"
        : code = "COMPANION_SESSION_CHANGED" ? "補助リソースの再起動を検知しました"
        : fallback
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
    BeginLocalVehicleRegistration()
}

CancelVehicleRegistration(*) {
    global State
    State.registrationCancelled := true
}

SnapshotVehicleProfile() {
    global Config
    return {
        enabled: Config.vehicleStorageEnabled,
        registered: Config.vehicleRegistered,
        name: Config.vehicleName,
        id: Config.vehicleStorageId,
        type: Config.vehicleStorageType,
        mode: Config.vehicleWorkMode,
        protocol: Config.vehicleCompanionProtocol,
        registrationId: Config.vehicleRegistrationId,
        routeFormat: Config.vehicleRouteFormat,
        outbound: Config.vehicleOutboundRoute,
        inbound: Config.vehicleReturnRoute
    }
}

RestoreVehicleProfile(profile) {
    global Config
    Config.vehicleStorageEnabled := profile.enabled
    Config.vehicleRegistered := profile.registered
    Config.vehicleName := profile.name
    Config.vehicleStorageId := profile.id
    Config.vehicleStorageType := profile.type
    Config.vehicleWorkMode := profile.mode
    Config.vehicleCompanionProtocol := profile.protocol
    Config.vehicleRegistrationId := profile.registrationId
    Config.vehicleRouteFormat := profile.routeFormat
    Config.vehicleOutboundRoute := profile.outbound
    Config.vehicleReturnRoute := profile.inbound
}

ReconcileVehicleProfileWithCompanion(companionInfo, &changed, &diagnostic) {
    global Config
    changed := false
    diagnostic := ""
    if !IsObject(companionInfo) || !companionInfo.transactionSupported
        || companionInfo.transactionPending
        || !companionInfo.serverRegistrationSynchronized {
        diagnostic := "companion state is not stable"
        return false
    }
    if IsValidVehicleProfile(Config) && companionInfo.registered
        && Config.vehicleRegistrationId = companionInfo.registrationId
        return true

    hasLocalRegistration := Config.vehicleStorageEnabled || Config.vehicleRegistered
        || Config.vehicleStorageId != "" || Config.vehicleStorageType != ""
        || Config.vehicleCompanionProtocol != 0 || Config.vehicleRegistrationId != ""
        || Config.vehicleRouteFormat != 0 || Config.vehicleOutboundRoute != ""
        || Config.vehicleReturnRoute != ""
    if !hasLocalRegistration
        return true

    previousProfile := SnapshotVehicleProfile()
    Config.vehicleStorageEnabled := 0
    Config.vehicleRegistered := 0
    Config.vehicleStorageId := ""
    Config.vehicleStorageType := ""
    Config.vehicleCompanionProtocol := 0
    Config.vehicleRegistrationId := ""
    Config.vehicleRouteFormat := 0
    Config.vehicleOutboundRoute := ""
    Config.vehicleReturnRoute := ""
    try SaveAllSettingsAtomically()
    catch as err {
        RestoreVehicleProfile(previousProfile)
        diagnostic := err.Message
        return false
    }
    changed := true
    WriteDiagnostic("REGISTRATION_LOCAL_RECONCILED serverRegistered="
        (companionInfo.registered ? 1 : 0))
    return true
}

CommitCandidateRegistration(candidateId, expectedEpoch, &commitApplied,
    &failureResult) {
    global State
    commitApplied := false
    failureResult := "ERROR COMPANION_REGISTRATION_COMMIT_FAILED"
    if !IsValidCompanionRegistrationId(candidateId)
        return false

    firstResult := RunCompanionCommandCancelable(0,
        "commit-registration", candidateId)
    failureResult := firstResult
    firstAccepted := IsCommittedRegistrationResponse(firstResult, candidateId)
    if firstAccepted {
        commitApplied := true
        if WaitForCommittedRegistrationStatus(candidateId, expectedEpoch, 3500)
            return true
        failureResult := "ERROR COMPANION_COMMIT_STATUS_UNCONFIRMED"
        return false
    }

    ; ユーザーが中止したcommitは再送しません。最初の要求がserverへ届いていた
    ; 可能性だけ、同epochの確定済みstatusを読み取って解決します。
    if !CompanionCommitRetryAllowed(firstResult, State.registrationCancelled) {
        if WaitForCommittedRegistrationStatus(candidateId, expectedEpoch, 1400) {
            commitApplied := true
            return true
        }
        return false
    }

    ; DONEだけを失った可能性をstatusで解決してから、同じ候補を一度だけ再送します。
    if WaitForCommittedRegistrationStatus(candidateId, expectedEpoch, 1400) {
        commitApplied := true
        return true
    }
    if !CompanionCommitRetryAllowed(firstResult, State.registrationCancelled)
        return false
    retryResult := RunCompanionCommand("commit-registration", candidateId)
    failureResult := retryResult
    if IsCommittedRegistrationResponse(retryResult, candidateId)
        commitApplied := true
    if WaitForCommittedRegistrationStatus(candidateId, expectedEpoch, 3500) {
        commitApplied := true
        return true
    }
    if commitApplied
        failureResult := "ERROR COMPANION_COMMIT_STATUS_UNCONFIRMED"
    else
        failureResult .= " retry_after=" firstResult
    return false
}

CompanionCommitRetryAllowed(firstResult, registrationCancelled) {
    return !registrationCancelled && Trim(firstResult) != "ERROR CANCELLED"
}

IsCommittedRegistrationResponse(result, candidateId) {
    return CompanionCommandSucceeded(result, "commit-registration", &commitId,
        &commitCode, &commitNetworkId)
        && commitCode = "REGISTRATION_COMMITTED"
        && commitId = candidateId && commitNetworkId > 0
}

WaitForCommittedRegistrationStatus(candidateId, expectedEpoch, timeoutMs) {
    deadline := MonotonicMs() + timeoutMs
    loop {
        if QueryCompanionStatus(&companionInfo, expectedEpoch)
            && companionInfo.registered && companionInfo.status = "ready"
            && companionInfo.transactionSupported
            && !companionInfo.transactionPending
            && companionInfo.serverRegistrationSynchronized
            && companionInfo.registrationId = candidateId
            && companionInfo.lastCode = "REGISTRATION_COMMITTED"
            return true
        if MonotonicMs() >= deadline
            return false
        Sleep 180
    }
}

AbortCandidateRegistration(candidateId, expectedEpoch, previousRegistration,
    &diagnostic) {
    diagnostic := ""
    if !IsValidCompanionRegistrationId(candidateId) {
        diagnostic := "invalid candidate id"
        return false
    }
    firstResult := RunCompanionCommand("abort-registration", candidateId)
    firstAccepted := IsAbortedRegistrationResponse(firstResult)
    if WaitForAbortedRegistrationStatus(expectedEpoch, previousRegistration,
        firstAccepted ? 3500 : 1400)
        return true
    if firstAccepted {
        diagnostic := "abort status was not confirmed after " firstResult
        return false
    }

    ; 応答だけを失った場合に限り、idempotentなabortを同じ候補で一度再送します。
    retryResult := RunCompanionCommand("abort-registration", candidateId)
    retryAccepted := IsAbortedRegistrationResponse(retryResult)
    if WaitForAbortedRegistrationStatus(expectedEpoch, previousRegistration, 3500)
        return true
    diagnostic := retryAccepted
        ? "abort status was not confirmed after retry"
        : retryResult " retry_after=" firstResult
    return false
}

IsAbortedRegistrationResponse(result) {
    return CompanionCommandSucceeded(result, "abort-registration", &abortId,
        &abortCode, &abortNetworkId) && abortCode = "REGISTRATION_ABORTED"
}

AbortStaleCandidateRegistration(candidateId, expectedEpoch, &restoredInfo,
    &diagnostic) {
    restoredInfo := 0
    diagnostic := ""
    if !IsValidCompanionRegistrationId(candidateId) {
        diagnostic := "invalid stale candidate id"
        return false
    }
    firstResult := RunCompanionCommand("abort-registration", candidateId)
    firstAccepted := IsAbortedRegistrationResponse(firstResult)
    if WaitForStaleAbortedRegistrationStatus(expectedEpoch,
        firstAccepted ? 3500 : 1400, &restoredInfo)
        return true
    if firstAccepted {
        diagnostic := "stale abort status was not confirmed after " firstResult
        return false
    }

    ; DONEを失った不確定状態だけ、同じ候補IDを一度だけ再送して解決します。
    retryResult := RunCompanionCommand("abort-registration", candidateId)
    retryAccepted := IsAbortedRegistrationResponse(retryResult)
    if WaitForStaleAbortedRegistrationStatus(expectedEpoch, 3500, &restoredInfo)
        return true
    diagnostic := retryAccepted
        ? "stale abort status was not confirmed after retry"
        : retryResult " retry_after=" firstResult
    return false
}

WaitForStaleAbortedRegistrationStatus(expectedEpoch, timeoutMs, &restoredInfo) {
    restoredInfo := 0
    deadline := MonotonicMs() + timeoutMs
    loop {
        if QueryCompanionStatus(&live, expectedEpoch)
            && live.transactionSupported && !live.transactionPending
            && live.serverRegistrationSynchronized
            && live.status = "ready" && live.lastCode = "REGISTRATION_ABORTED" {
            restoredInfo := live
            return true
        }
        if MonotonicMs() >= deadline
            return false
        Sleep 180
    }
}

WaitForAbortedRegistrationStatus(expectedEpoch, previousRegistration, timeoutMs) {
    deadline := MonotonicMs() + timeoutMs
    loop {
        if QueryCompanionStatus(&restoredCompanion, expectedEpoch)
            && restoredCompanion.status = "ready"
            && restoredCompanion.transactionSupported
            && !restoredCompanion.transactionPending
            && restoredCompanion.serverRegistrationSynchronized
            && restoredCompanion.lastCode = "REGISTRATION_ABORTED" {
            if previousRegistration.registered {
                if restoredCompanion.registered
                    && restoredCompanion.registrationId = previousRegistration.registrationId
                    return true
            } else if !restoredCompanion.registered {
                return true
            }
        }
        if MonotonicMs() >= deadline
            return false
        Sleep 180
    }
}

WaitForCompanionRegistration(initialSequence, expectedCompanionEpoch, expectedServerEpoch,
    &companionInfo, &failureResult) {
    global State
    companionInfo := 0
    failureResult := "ERROR COMPANION_REGISTRATION_TIMEOUT"
    deadline := MonotonicMs() + 40000
    nextServerCheckAt := 0
    statusFailures := 0
    loop {
        if State.registrationCancelled {
            failureResult := "ERROR COMPANION_REGISTRATION_CANCELLED"
            return false
        }
        if !State.targetHwnd || !State.targetPid || !IsTargetIdentityAlive() {
            failureResult := "ERROR TARGET_CLOSED"
            return false
        }
        now := MonotonicMs()
        if now >= deadline
            return false
        if now >= nextServerCheckAt {
            healthResult := RunBackgroundBridgeCancelable(0, "health")
            if !ParseServerHealth(healthResult, &liveServerEpoch)
                || liveServerEpoch != expectedServerEpoch {
                failureResult := "ERROR COMPANION_SESSION_CHANGED"
                return false
            }
            nextServerCheckAt := MonotonicMs() + 2500
        }
        if QueryCompanionStatus(&live, expectedCompanionEpoch, 0) {
            statusFailures := 0
            if !live.serverRegistrationSynchronized {
                failureResult := "ERROR COMPANION_SERVER_REGISTRATION_SYNC_PENDING"
                return false
            }
            if live.sequence > initialSequence && live.registered
                && live.transactionSupported && live.transactionPending
                && live.serverRegistrationSynchronized
                && live.status = "ready" && live.lastCode = "REGISTERED" {
                companionInfo := live
                return true
            }
            if live.sequence > initialSequence
                && (live.status = "cancelled" || live.status = "error") {
                failureResult := "ERROR COMPANION_" live.lastCode
                return false
            }
        } else {
            statusFailures += 1
            if statusFailures >= 3 {
                failureResult := "ERROR COMPANION_SESSION_CHANGED"
                return false
            }
        }
        Sleep 180
    }
}

ValidateRegistrationEpochs(expectedServerEpoch, expectedCompanionEpoch) {
    healthResult := RunBackgroundBridgeCancelable(0, "health")
    if !ParseServerHealth(healthResult, &serverEpoch) || serverEpoch != expectedServerEpoch
        return false
    return QueryCompanionStatus(&companionInfo, expectedCompanionEpoch, 0)
        && companionInfo.serverRegistrationSynchronized
}

CaptureCompanionStorage(&storageId, &storageType, expectedGeneration) {
    global State
    storageId := ""
    storageType := ""
    deadline := MonotonicMs() + 5000
    while MonotonicMs() < deadline {
        if !IsBridgeOperationContextValid(expectedGeneration)
            return false
        captureResult := RunBridgeForContext(expectedGeneration, "capture-storage")
        State.lastStorageProbeResult := captureResult
        if ParseStorageCapture(captureResult, &storageInfo) {
            storageId := storageInfo.id
            storageType := storageInfo.type
            return true
        }
        Sleep 140
    }
    return false
}

OpenCompanionCargoAndCapture(registrationId, expectedGeneration, &storageId,
    &storageType, &failureResult) {
    global State
    storageId := ""
    storageType := ""
    failureResult := ""
    cargoResult := RunCompanionCommandCancelable(expectedGeneration,
        "open-cargo", registrationId)
    if CompanionCommandSucceeded(cargoResult, "open-cargo", &cargoId, &cargoCode,
        &cargoNetworkId) {
        if (cargoCode != "CARGO_READY" && cargoCode != "CARGO_OPENED"
            && cargoCode != "CARGO_OPEN_REQUESTED")
            || cargoId != registrationId || cargoNetworkId <= 0 {
            failureResult := "ERROR COMPANION_PROTOCOL"
            return false
        }
        if CaptureCompanionStorage(&storageId, &storageType, expectedGeneration)
            return true
        failureResult := "ERROR COMPANION_CARGO_CAPTURE"
        return false
    }
    if Trim(cargoResult) = "ERROR COMPANION_UNSUPPORTED" {
        ; arrival_only構成だけは、companionが所有権確認済みの登録車両後端へ
        ; 到着した後に限り、既存の構造化target操作で荷台を開きます。
        if OpenStorageAndCapture(&storageId, &storageType, expectedGeneration,
            &fatalFailure)
            return true
        failureResult := State.lastStorageProbeResult
            ? State.lastStorageProbeResult : cargoResult
        return false
    }
    failureResult := cargoResult
    return false
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

ProbeWorkTarget(actionMode, expectedGeneration := 0) {
    probeMode := actionMode = "washing" ? "probe-washing"
        : actionMode = "gold" ? "probe-gold" : "probe-mining"
    expected := actionMode = "washing" ? "PRESENT WASH"
        : actionMode = "gold" ? "PRESENT GOLD" : "PRESENT MINE"
    return ProbeTargetOption(probeMode, expected, expectedGeneration)
}

ProbeTargetOption(probeMode, expectedResult, expectedGeneration := 0) {
    global State
    State.lastTargetProbeResult := ""
    State.lastTargetProbeFatal := false
    if !ReleaseBackgroundTarget(true) {
        State.lastTargetProbeResult := "ERROR INPUT_RELEASE"
        State.lastTargetProbeFatal := true
        return false
    }
    activateResult := RunBridgeForContext(expectedGeneration, "activate")
    State.lastTargetProbeResult := activateResult
    if !RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &portMatch) {
        State.lastTargetProbeFatal := true
        return false
    }
    State.backgroundTargetActive := true
    State.backgroundDevConPort := portMatch[1] + 0
    State.lastDevConPort := State.backgroundDevConPort
    Sleep 350
    if expectedGeneration && !IsCurrentRun(expectedGeneration) {
        if !ReleaseBackgroundTarget(true) {
            State.lastTargetProbeResult := "ERROR INPUT_RELEASE"
            State.lastTargetProbeFatal := true
        }
        return false
    }
    result := RunBridgeForContext(expectedGeneration, probeMode)
    released := ReleaseBackgroundTarget(true)
    State.lastTargetProbeResult := result
    if !released {
        State.lastTargetProbeResult := "ERROR INPUT_RELEASE"
        State.lastTargetProbeFatal := true
        return false
    }
    if result = expectedResult
        return true
    expectedMissing := StrReplace(expectedResult, "PRESENT ", "MISSING ")
    if result != expectedMissing
        State.lastTargetProbeFatal := true
    return false
}

OpenStorageAndCapture(&storageId, &storageType, expectedGeneration, &fatalFailure) {
    global State
    storageId := ""
    storageType := ""
    fatalFailure := false
    State.lastStorageProbeResult := ""
    ; 以前の入力を先に解放し、rightInventoryを誤認しないよう閉じた状態から開始します。
    if !ReleaseBackgroundTarget(true) {
        State.lastStorageProbeResult := "ERROR INPUT_RELEASE"
        fatalFailure := true
        return false
    }
    closeResult := RunBridgeForContext(expectedGeneration, "close-inventory")
    if closeResult != "CLOSED" {
        State.lastStorageProbeResult := closeResult
        fatalFailure := true
        return false
    }
    activateResult := RunBridgeForContext(expectedGeneration, "activate")
    if !RegExMatch(activateResult, "^ACTIVATED (29200|29300)$", &portMatch) {
        State.lastStorageProbeResult := activateResult
        fatalFailure := true
        return false
    }
    State.backgroundTargetActive := true
    State.backgroundDevConPort := portMatch[1] + 0
    State.lastDevConPort := State.backgroundDevConPort
    Sleep 350
    probeResult := RunBridgeForContext(expectedGeneration, "probe-storage")
    State.lastStorageProbeResult := probeResult
    if probeResult != "PRESENT STORAGE" {
        if !ReleaseBackgroundTarget(true) {
            State.lastStorageProbeResult := "ERROR INPUT_RELEASE"
            fatalFailure := true
        } else if probeResult != "MISSING STORAGE"
            && probeResult != "AMBIGUOUS STORAGE" {
            fatalFailure := true
        }
        return false
    }
    clickResult := RunBridgeForContext(expectedGeneration, "click-storage")
    State.lastStorageProbeResult := clickResult
    if clickResult != "CLICKED STORAGE" {
        cleanupOk := CloseInventoryAfterStorageFailure(clickResult)
        fatalFailure := !cleanupOk || (clickResult != "MISSING STORAGE"
            && clickResult != "AMBIGUOUS STORAGE")
        return false
    }
    if !ReleaseBackgroundTarget(true) {
        State.lastStorageProbeResult := "ERROR INPUT_RELEASE"
        CloseInventoryAfterStorageFailure(State.lastStorageProbeResult)
        fatalFailure := true
        return false
    }
    deadline := MonotonicMs() + 5000
    while MonotonicMs() < deadline {
        if expectedGeneration && !IsCurrentRun(expectedGeneration) {
            fatalFailure := !CloseInventoryAfterStorageFailure(
                State.lastStorageProbeResult)
            return false
        }
        if State.registrationActive && State.registrationCancelled {
            fatalFailure := !CloseInventoryAfterStorageFailure(
                State.lastStorageProbeResult)
            return false
        }
        if !State.registrationActive && !State.running {
            fatalFailure := !CloseInventoryAfterStorageFailure(
                State.lastStorageProbeResult)
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
    captureFailure := State.lastStorageProbeResult
    cleanupOk := CloseInventoryAfterStorageFailure(captureFailure)
    ; ボタンを押した後にtrunk identityを取得できない状態は、単なる候補なしでは
    ; ありません。close成功時も次の移動へ進まず、このrunを安全停止します。
    fatalFailure := true
    WriteDiagnostic("STORAGE_CAPTURE_FATAL result=" captureFailure
        " cleanup=" cleanupOk)
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
    DeleteLocalVehicleRegistration()
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
    if State.registrationActive {
        State.updatePageStatus.Text := "車両登録を中止してから更新してください。"
        QueueWebUiFlush()
        return
    }
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
    if State.registrationActive {
        State.updatePageStatus.Text := "車両登録中は更新を開始できません。"
        QueueWebUiFlush()
        return
    }
    ; 起動時の静かな確認で見つかった更新も、利用者が画面の
    ; 「ダウンロードして更新」を押すまでは適用しません。
    if !State.updateVersion && !State.updateOperation
        BeginUpdateCheck(false)
}

BeginUpdateCheck(silent := false) {
    global State, AppVersion

    if State.registrationActive {
        if !silent
            State.updatePageStatus.Text := "車両登録を中止してから更新してください。"
        return
    }
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
            State.statusLabel.Text := "車両画面でストレージを登録してから開始してください"
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
    companionEpoch := ""
    if Config.vehicleStorageEnabled && Config.vehicleCompanionProtocol = 1 {
        if !QueryCompanionStatus(&preflightCompanion) {
            State.statusLabel.Text := "●  登録車両のゲーム内連携を確認できないため開始しません"
            ShowPage("vehicle")
            return
        }
        if !preflightCompanion.serverRegistrationSynchronized {
            State.statusLabel.Text := "●  サーバーの車両登録同期が終わるまでお待ちください"
            ShowPage("vehicle")
            return
        }
        if preflightCompanion.transactionPending {
            State.statusLabel.Text := "●  未確定の車両候補があります。車両画面で登録し直してください"
            ShowPage("vehicle")
            return
        }
        if !CompanionProfileMatches(preflightCompanion) {
            State.statusLabel.Text := preflightCompanion.transactionSupported
                ? "●  登録車両がサーバー側と一致しないため開始しません"
                : "●  FiveM補助リソースの更新が必要です"
            ShowPage("vehicle")
            return
        }
        companionEpoch := preflightCompanion.epoch
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
    State.nextBackgroundEatAt := MonotonicMs() + Config.backgroundFirstEatDelayMs
    State.backgroundHungerUnknownLogged := false
    State.backgroundEatFailures := 0
    State.lastWorkViewAt := 0
    State.workViewFailures := 0
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
    State.storagePending := false
    State.storageRecoveryAttempted := false
    State.capacityProbeFailures := 0
    State.serverEpoch := serverEpoch
    State.serverHealthFailures := 0
    State.companionEpoch := companionEpoch
    State.companionHealthFailures := 0
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

    if Config.backgroundMode && (Config.autoEat || Config.vehicleStorageEnabled) {
        State.automationPhase := "priming_inventory"
        State.statusLabel.Text := "●  インベントリ状態を準備しています"
        inventoryReady := EnsureBackgroundInventoryReady(runGeneration,
            &primedInventory)
        if !IsCurrentRun(runGeneration)
            return
        if !inventoryReady {
            StopMining()
            State.statusLabel.Text := "●  インベントリを確認できないため開始しませんでした"
            WriteDiagnostic("INVENTORY_PRIME_FAILED")
            return
        }
        State.automationPhase := "preparing"
    }

    if Config.vehicleStorageEnabled && Config.vehicleCompanionProtocol = 1
        && IsCurrentRun(runGeneration) {
        State.statusLabel.Text := "現在の作業地点をゲーム内連携へ登録しています"
        workTargetPresent := ProbeWorkTarget(State.runMode, runGeneration)
        if !IsCurrentRun(runGeneration)
            return
        if !workTargetPresent {
            StopMining()
            State.statusLabel.Text := "作業ボタンを確認できないため開始しませんでした"
            ShowPage("vehicle")
            return
        }
        anchorResult := RunCompanionCommandCancelable(runGeneration, "set-work-anchor")
        if !CompanionCommandSucceeded(anchorResult, "set-work-anchor", &anchorId,
            &anchorCode, &anchorNetworkId) || anchorCode != "WORK_ANCHOR_SET"
            || anchorId != Config.vehicleRegistrationId || anchorNetworkId <= 0 {
            WriteDiagnostic("WORK_ANCHOR_ERROR=" anchorResult)
            StopMining()
            State.statusLabel.Text := CompanionFailureMessage(anchorResult,
                "作業地点を登録できないため開始しませんでした")
            ShowPage("vehicle")
            return
        }
        if !ValidateAutomationEpochCheckpoint(runGeneration, "work_anchor") {
            StopMining()
            State.statusLabel.Text := "作業地点の登録中に接続が変わったため開始しませんでした"
            ShowPage("vehicle")
            return
        }
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

    if Config.vehicleStorageEnabled && Config.vehicleCompanionProtocol = 0
        && IsCurrentRun(runGeneration) {
        if !InitializeLocalVehicleRun(runGeneration)
            return
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
    global State, Config

    if State.registrationActive && !State.running {
        CancelVehicleRegistration()
        return
    }

    previousPhase := State.automationPhase
    cancelCompanion := Config.vehicleCompanionProtocol = 1
        && (State.companionReady || State.companionEpoch)
    State.running := false
    State.generation += 1
    State.automationPhase := "stopped"
    State.inventoryBaseline := ""
    State.capacityProbeFailures := 0
    State.workpointProbeFailures := 0
    State.storagePending := false
    State.storageRecoveryAttempted := false
    State.serverEpoch := ""
    State.serverHealthFailures := 0
    State.nextServerHealthAt := 0
    State.nextBackgroundEatAt := 0
    State.backgroundHungerUnknownLogged := false
    State.backgroundEatFailures := 0
    State.lastWorkViewAt := 0
    State.workViewFailures := 0
    State.targetPid := 0

    if IsObject(State.timerFn) {
        try SetTimer(State.timerFn, 0)
    }
    State.timerFn := 0

    CancelActiveBridgeProcess()
    if cancelCompanion
        RunCompanionCommand("cancel")
    ReleaseAllInputs()
    ReleaseBackgroundTarget(true)
    ; 車両探索・収納・復帰中の停止はUIを閉じ、移動入力もfail-closedさせます。
    if previousPhase = "find_registered_vehicle" || previousPhase = "depositing"
        || previousPhase = "return_to_work" || previousPhase = "verify_workpoint"
        || previousPhase = "priming_inventory" || previousPhase = "eating"
        RunBackgroundBridge("close-inventory")
    State.companionEpoch := ""
    State.companionHealthFailures := 0
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
        State.washCorrectionControl, State.autoEatControl, State.foodKeyControl,
        State.autoUpdateControl, State.vehicleEnabledControl,
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

ValidateCompanionEpochCheckpoint(expectedGeneration, checkpoint) {
    global State, Config
    if Config.vehicleCompanionProtocol = 0
        return true
    if !Config.vehicleStorageEnabled
        return true
    if !IsCurrentRun(expectedGeneration) || !State.companionEpoch
        return false
    if !QueryCompanionStatus(&companionInfo, State.companionEpoch,
        expectedGeneration) || !CompanionProfileMatches(companionInfo) {
        WriteDiagnostic("COMPANION_CHECKPOINT_ERROR point=" checkpoint
            " expected=" State.companionEpoch " status=" State.companionStatus)
        return false
    }
    return true
}

ValidateAutomationEpochCheckpoint(expectedGeneration, checkpoint) {
    return ValidateServerEpochCheckpoint(expectedGeneration, checkpoint)
        && ValidateCompanionEpochCheckpoint(expectedGeneration, checkpoint)
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
        if Config.vehicleStorageEnabled && Config.vehicleCompanionProtocol = 1 {
            if QueryCompanionStatus(&companionInfo, State.companionEpoch,
                expectedGeneration) {
                State.companionHealthFailures := 0
                if !CompanionProfileMatches(companionInfo) {
                    WriteDiagnostic("COMPANION_PROFILE_CHANGED status=" companionInfo.status)
                    StopAutomationWithFault("登録車両の連携状態が変わったため自動停止しました",
                        "vehicle")
                    return true
                }
            } else {
                State.companionHealthFailures += 1
                State.nextServerHealthAt := now + 900
                WriteDiagnostic("COMPANION_HEALTH_ERROR attempt="
                    State.companionHealthFailures " status=" State.companionStatus)
                if State.companionHealthFailures >= 3 {
                    StopAutomationWithFault("補助リソースの再起動または切断を検知したため自動停止しました",
                        "vehicle")
                    return true
                }
                State.statusLabel.Text := "ゲーム内連携を再確認中（"
                    State.companionHealthFailures "/3）"
                ScheduleNext(expectedGeneration, 1000)
                return true
            }
        }
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
    if !State.storagePending && now < State.nextCapacityCheckAt
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
        State.storagePending := false
        State.storageRecoveryAttempted := false
        State.automationPhase := "working"
        return false
    }
    if !State.storagePending {
        State.storagePending := true
        State.storageRecoveryAttempted := false
    }
    ; 一度容量不足になったら、収納完了または停止まで通常の採集へ戻しません。
    State.nextCapacityCheckAt := 0
    if !InventorySpecHasIncrease(inventoryInfo.items, State.inventoryBaseline) {
        StopAutomationWithFault("開始前の持ち物で容量が不足しています。所持品を整理してください", "vehicle")
        return true
    }
    State.lastCapacityReason := capacityReason = "weight"
        ? "残り重量が設定値以下" : "空きスロットなし"
    WriteDiagnostic("VEHICLE_CAPACITY_TRIGGER reason=" capacityReason
        " weight=" inventoryInfo.weight " max=" inventoryInfo.maxWeight
        " free=" freeWeight " used=" inventoryInfo.used " slots=" inventoryInfo.slots)
    ; 容量到達時も先に視点を作業方向へ戻します。通常cycleより前にreturnする
    ; 経路なので、ここで強制しないと視点ずれを対象消失と誤認します。
    if !MaintainBackgroundWorkView(expectedGeneration, true)
        return true
    workTargetPresent := ProbeWorkTarget(State.runMode, expectedGeneration)
    if !IsCurrentRun(expectedGeneration)
        return true
    if !workTargetPresent {
        if State.lastTargetProbeFatal {
            StopAutomationWithFault(
                "収納前の作業対象を安全に確認できないため停止しました", "vehicle")
            return true
        }
        cooldownRemaining := WorkTargetCooldownRemainingMs()
        if cooldownRemaining > 0 {
            State.automationPhase := "verify_workpoint"
            State.statusLabel.Text := "収納前に作業ボタンの再表示を待っています"
            ScheduleNext(expectedGeneration, Min(850, cooldownRemaining))
            return true
        }
        if !State.storageRecoveryAttempted {
            State.storageRecoveryAttempted := true
            workTargetPresent := RecoverLocalWorkTarget(expectedGeneration)
            if !IsCurrentRun(expectedGeneration)
                return true
            if !workTargetPresent && State.lastTargetProbeFatal {
                StopAutomationWithFault(
                    "収納前の作業対象を安全に再確認できないため停止しました", "vehicle")
                return true
            }
        }
        if workTargetPresent {
            State.workpointProbeFailures := 0
        } else {
        ; 再出現待ちや洗浄・砂金の位置ずれ中には車両移動を始めません。
        ; 容量不足中は追加採集も止めたまま作業対象を再確認します。
            State.workpointProbeFailures += 1
            State.nextCapacityCheckAt := 0
            State.automationPhase := "verify_workpoint"
            State.statusLabel.Text := "収納前に現在の作業位置を確認中（"
                State.workpointProbeFailures "/10）"
            WriteDiagnostic("VEHICLE_WORKPOINT_PENDING attempt="
                State.workpointProbeFailures)
            if State.workpointProbeFailures >= 10 {
                StopAutomationWithFault(
                    "現在の作業位置を確認できないため安全停止しました", "vehicle")
                return true
            }
            ScheduleNext(expectedGeneration, 850)
            return true
        }
    }
    State.workpointProbeFailures := 0
    State.storageRecoveryAttempted := false
    State.timerFn := 0
    RunVehicleStorageCycle(expectedGeneration)
    return true
}

WorkTargetCooldownRemainingMs() {
    global State, Config
    if !State.lastMineAt
        return 0
    cooldownMs := State.runMode = "washing" ? Config.washCycleMs + 750
        : State.runMode = "gold" ? Config.goldCycleMs + 750
        : Config.stoneResyncAfterMs
    return Max(0, State.lastMineAt + cooldownMs - MonotonicMs())
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

InventorySpecSlotState(spec, slotNumber, &itemKey, &itemCount) {
    itemKey := ""
    itemCount := 0
    if slotNumber < 1 || slotNumber > 1000 || !IsValidInventorySpec(spec)
        return false
    for row in InventorySpecToRows(spec) {
        if row.slot != slotNumber
            continue
        itemKey := row.key
        itemCount := row.count
        return true
    }
    return false
}

InventorySlotWasConsumed(beforeSpec, afterSpec, slotNumber) {
    if !InventorySpecSlotState(beforeSpec, slotNumber, &beforeKey, &beforeCount)
        return false
    if !InventorySpecSlotState(afterSpec, slotNumber, &afterKey, &afterCount)
        return true
    return StrCompare(beforeKey, afterKey, true) = 0 && afterCount < beforeCount
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

InitializeLocalVehicleRun(expectedGeneration) {
    global State, Config
    State.statusLabel.Text := "作業位置と満重量判定を確認しています"
    workTargetPresent := ProbeWorkTarget(State.runMode, expectedGeneration)
    if !IsCurrentRun(expectedGeneration)
        return false
    if !workTargetPresent {
        StopMining()
        State.statusLabel.Text := "作業ボタンを確認できないため開始しませんでした"
        ShowPage("vehicle")
        return false
    }
    epochValid := ValidateServerEpochCheckpoint(expectedGeneration, "local_work_start")
    if !IsCurrentRun(expectedGeneration)
        return false
    if !epochValid {
        StopMining()
        State.statusLabel.Text := "接続状態が変わったため開始しませんでした"
        ShowPage("vehicle")
        return false
    }

    State.statusLabel.Text := "開始前の所持品を保護しています"
    snapshotResult := RunBackgroundBridgeCancelable(expectedGeneration, "inventory-snapshot")
    if !IsCurrentRun(expectedGeneration)
        return false
    if !ParseInventorySnapshot(snapshotResult, &inventoryInfo) {
        WriteDiagnostic("LOCAL_INVENTORY_BASELINE_ERROR=" snapshotResult)
        StopMining()
        State.statusLabel.Text := "インベントリ状態を取得できないため開始しませんでした"
        ShowPage("vehicle")
        return false
    }
    State.inventoryBaseline := inventoryInfo.items
    UpdateInventoryCapacityState(inventoryInfo)
    if CapacityNeedsStorage(inventoryInfo, &startReason, &startFreeWeight) {
        WriteDiagnostic("LOCAL_INVENTORY_START_CAPACITY reason=" startReason
            " free=" startFreeWeight)
        StopMining()
        State.statusLabel.Text := startReason = "weight"
            ? "開始前から残り重量が少ないため、所持品を整理してください"
            : "開始前から空きスロットがないため、所持品を整理してください"
        ShowPage("vehicle")
        return false
    }
    State.nextCapacityCheckAt := MonotonicMs() + Config.capacityCheckIntervalMs
    WriteDiagnostic("LOCAL_INVENTORY_BASELINE weight=" inventoryInfo.weight
        " max=" inventoryInfo.maxWeight " used=" inventoryInfo.used
        " slots=" inventoryInfo.slots)
    return true
}

RunLocalVehicleStorageCycle(expectedGeneration) {
    global State, Config
    if !IsCurrentRun(expectedGeneration)
        return

    State.automationPhase := "find_registered_vehicle"
    State.statusLabel.Text := "近くの登録車両を探しています"
    WriteDiagnostic("LOCAL_STORAGE_TRIP_START trip=" (State.storageTrips + 1))
    epochValid := ValidateServerEpochCheckpoint(expectedGeneration,
        "local_vehicle_departure")
    if !IsCurrentRun(expectedGeneration)
        return
    if !epochValid {
        StopAutomationWithFault("移動前の接続状態が変わったため安全停止しました", "vehicle")
        return
    }

    movementHistory := []
    matchedViewRoute := ""
    try storageFound := FindRegisteredStorageNearby(expectedGeneration, &movementHistory,
        &matchedViewRoute, &searchFailure)
    catch as err {
        storageFound := false
        searchFailure := "登録車両の探索中にエラーが発生しました"
        WriteDiagnostic("LOCAL_STORAGE_SEARCH_ERROR=" err.Message)
    }
    if !IsCurrentRun(expectedGeneration)
        return
    if !storageFound {
        cleanupOk := CloseLocalStorageUi()
        if !cleanupOk
            searchFailure := "探索画面を安全に閉じられないため停止しました"
        if IsCurrentRun(expectedGeneration)
            StopAutomationWithFault(searchFailure ? searchFailure
                : "近くに登録車両を確認できませんでした", "vehicle")
        return
    }

    depositOk := false
    failureMessage := ""
    closeResult := ""
    releaseOk := false
    try {
        epochValid := ValidateServerEpochCheckpoint(expectedGeneration,
            "local_before_deposit")
        if !IsCurrentRun(expectedGeneration) {
            failureMessage := ""
        } else if !epochValid {
            failureMessage := "収納直前に接続状態が変わったため停止しました"
        } else {
            State.automationPhase := "depositing"
            State.statusLabel.Text := "開始後に増えた持ち物だけを収納しています"
            depositResult := RunBackgroundBridgeCancelable(expectedGeneration,
                "deposit-delta", Config.vehicleStorageId,
                Config.vehicleStorageType, State.inventoryBaseline)
            if RegExMatch(depositResult, "^DEPOSITED (\d+) (\d+)$", &depositParts)
                && depositParts[1] + 0 > 0 {
                postResult := RunBackgroundBridgeCancelable(expectedGeneration,
                    "inventory-snapshot")
                if !ParseInventorySnapshot(postResult, &postInfo)
                    || InventorySpecHasIncrease(postInfo.items, State.inventoryBaseline) {
                    failureMessage := "収納後の所持品を確認できなかったため停止します"
                    WriteDiagnostic("LOCAL_DEPOSIT_VERIFY_ERROR=" postResult)
                } else {
                    State.inventoryBaseline := postInfo.items
                    UpdateInventoryCapacityState(postInfo)
                    depositOk := true
                    State.lastStorageResult := depositParts[1] "個を収納"
                    WriteDiagnostic("LOCAL_DEPOSIT count=" depositParts[1]
                        " stacks=" depositParts[2])
                }
            } else {
                failureMessage := DepositFailureMessage(depositResult)
                WriteDiagnostic("LOCAL_DEPOSIT_ERROR=" depositResult)
            }
        }
    } catch as err {
        failureMessage := "収納処理でエラーが発生しました"
        WriteDiagnostic("LOCAL_STORAGE_CYCLE_ERROR=" err.Message)
    } finally {
        releaseOk := ReleaseBackgroundTarget(true)
        closeResult := RunBackgroundBridge("close-inventory")
    }

    if !IsCurrentRun(expectedGeneration)
        return
    cleanupOk := releaseOk && closeResult = "CLOSED"
    if !cleanupOk
        cleanupOk := CloseLocalStorageUi()
    if !cleanupOk {
        WriteDiagnostic("LOCAL_STORAGE_CLOSE_ERROR=" closeResult)
        StopAutomationWithFault("インベントリを安全に閉じられないため停止しました", "vehicle")
        return
    }
    State.automationPhase := "return_to_work"
    State.statusLabel.Text := "作業位置へ戻っています"
    poseRestored := RestoreLocalSearchPose(expectedGeneration, movementHistory,
        matchedViewRoute)
    if !IsCurrentRun(expectedGeneration)
        return
    if !poseRestored {
        StopAutomationWithFault("作業位置へ安全に戻れないため停止しました", "vehicle")
        return
    }
    epochValid := ValidateServerEpochCheckpoint(expectedGeneration, "local_work_return")
    if !IsCurrentRun(expectedGeneration)
        return
    if !epochValid {
        StopAutomationWithFault("収納中のサーバー再起動または再接続を検知しました", "vehicle")
        return
    }

    State.automationPhase := "verify_workpoint"
    State.statusLabel.Text := "作業ボタンを再確認しています"
    workRecovered := RecoverLocalWorkTarget(expectedGeneration)
    if !IsCurrentRun(expectedGeneration)
        return
    if !workRecovered {
        StopAutomationWithFault("作業位置を再検出できないため再開しません", "vehicle")
        return
    }
    if !depositOk {
        StopAutomationWithFault(failureMessage ? failureMessage
            : "収納できなかったため停止しました", "vehicle")
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
    State.storagePending := false
    State.storageRecoveryAttempted := false
    State.automationPhase := "working"
    State.statusLabel.Text := "収納完了。作業を再開します"
    WriteDiagnostic("LOCAL_STORAGE_TRIP_COMPLETE trip=" State.storageTrips)
    ScheduleNext(expectedGeneration, 900)
}

FindRegisteredStorageNearby(expectedGeneration, &movementHistory,
    &matchedViewRoute, &failureMessage) {
    global State, Config
    movementHistory := []
    matchedViewRoute := ""
    failureMessage := ""

    primaryViews := ["", "520:16", "420:80", "420:144",
        "700:64", "700:128", "1000:64", "1000:128"]
    if TryRegisteredStorageViews(expectedGeneration, primaryViews,
        &matchedViewRoute, &viewFailure, &fatalFailure)
        return true
    if fatalFailure {
        ; 解放・close・bridgeの結果が不確定なときは、追加の視点/移動入力を
        ; 一切送らず停止します。復元を試す方がNUIへ入力される危険があります。
        failureMessage := viewFailure
            ? viewFailure : "探索画面を安全に閉じられないため停止しました"
        return false
    }

    pulse := Config.vehicleSearchPulseMs
    movementSteps := [(pulse * 2) ":2", (pulse * 2) ":4",
        (pulse * 4) ":1", (pulse * 4) ":8", (pulse * 4) ":2"]
    nearbyViews := ["", "520:16", "440:80", "440:144", "820:16"]
    for movementRoute in movementSteps {
        State.statusLabel.Text := "登録車両を近距離で再探索しています ("
            . A_Index "/" movementSteps.Length ")"
        if !PlayLocalRoute(expectedGeneration, movementRoute) {
            failureMessage := "車両探索の移動を確認できないため安全停止しました"
            return false
        }
        movementHistory.Push(movementRoute)
        if TryRegisteredStorageViews(expectedGeneration, nearbyViews,
            &matchedViewRoute, &viewFailure, &fatalFailure)
            return true
        if fatalFailure {
            failureMessage := viewFailure
                ? viewFailure : "探索画面を安全に閉じられないため停止しました"
            return false
        }
    }

    restored := RestoreLocalSearchPose(expectedGeneration, movementHistory, "")
    movementHistory := []
    if !restored {
        failureMessage := "登録車両を見つけられず、元の位置も確認できないため停止しました"
        return false
    }
    failureMessage := "近くに登録した車両のストレージを確認できませんでした"
    return false
}

TryRegisteredStorageViews(expectedGeneration, viewCandidates,
    &matchedViewRoute, &failureMessage, &fatalFailure) {
    global State, Config
    matchedViewRoute := ""
    failureMessage := ""
    fatalFailure := false
    sawDifferentStorage := false

    for candidateRoute in viewCandidates {
        if candidateRoute && !PlayLocalRoute(expectedGeneration, candidateRoute) {
            fatalFailure := true
            failureMessage := "車両を探す視点操作を確認できないため安全停止しました"
            return false
        }

        opened := OpenStorageAndCapture(&storageId, &storageType,
            expectedGeneration, &probeFatal)
        if opened && storageId = Config.vehicleStorageId
            && storageType = Config.vehicleStorageType {
            matchedViewRoute := candidateRoute
            WriteDiagnostic("LOCAL_REGISTERED_STORAGE_FOUND positionView=" A_Index)
            return true
        }
        if opened {
            sawDifferentStorage := true
            WriteDiagnostic("LOCAL_STORAGE_MISMATCH ignored=1")
            if !CloseLocalStorageUi() {
                matchedViewRoute := candidateRoute
                fatalFailure := true
                failureMessage := "別の車両を閉じられないため安全停止しました"
                return false
            }
        }
        if probeFatal {
            fatalFailure := true
            failureMessage := "荷台を安全に確認できないため停止しました"
            WriteDiagnostic("LOCAL_STORAGE_PROBE_FATAL result="
                State.lastStorageProbeResult)
            return false
        }

        if candidateRoute && !PlayLocalRoute(expectedGeneration,
            ReverseLocalRoute(candidateRoute)) {
            fatalFailure := true
            failureMessage := "探索した視点を元に戻せないため安全停止しました"
        }
        if fatalFailure
            return false
    }

    failureMessage := sawDifferentStorage
        ? "登録車両とは異なるストレージだけを検出しました"
        : "登録車両のストレージが見つかりません"
    return false
}

CloseLocalStorageUi() {
    released := ReleaseBackgroundTarget(true)
    closeResult := RunBackgroundBridge("close-inventory")
    if closeResult != "CLOSED" {
        Sleep 100
        closeResult := RunBackgroundBridge("close-inventory")
    }
    return released && closeResult = "CLOSED"
}

PlayLocalRoute(expectedGeneration, route) {
    global State
    if !IsCurrentRun(expectedGeneration) || !route || !State.serverEpoch
        return false
    if !EnsureDevConPort()
        return false
    port := State.lastDevConPort
    result := RunBackgroundBridgeCancelable(expectedGeneration,
        "play-route-health", port, route, State.serverEpoch)
    routeOk := result = "ROUTE " port " " RouteTotalMs(route, false)
    WriteDiagnostic("LOCAL_ROUTE route=" route " result=" result)
    if !routeOk
        State.lastDevConPort := 0
    return routeOk
}

ReverseLocalRoute(route) {
    segments := StrSplit(route, ",")
    reversed := ""
    Loop segments.Length {
        segment := segments[segments.Length - A_Index + 1]
        if !RegExMatch(segment, "^(\d+):(\d+)$", &parts)
            return ""
        oppositeMask := OppositeLocalInputMask(parts[2] + 0)
        reversed .= (reversed ? "," : "") parts[1] ":" oppositeMask
    }
    return reversed
}

OppositeLocalInputMask(mask) {
    opposite := 0
    if mask & 1
        opposite |= 2
    if mask & 2
        opposite |= 1
    if mask & 4
        opposite |= 8
    if mask & 8
        opposite |= 4
    if mask & 16
        opposite |= 32
    if mask & 32
        opposite |= 16
    if mask & 64
        opposite |= 128
    if mask & 128
        opposite |= 64
    return opposite
}

JoinLocalRoutes(routes) {
    result := ""
    for route in routes {
        if route
            result .= (result ? "," : "") route
    }
    return result
}

RestoreLocalSearchPose(expectedGeneration, movementHistory, matchedViewRoute) {
    if matchedViewRoute {
        inverseView := ReverseLocalRoute(matchedViewRoute)
        if !inverseView || !PlayLocalRoute(expectedGeneration, inverseView)
            return false
    }
    movementRoute := JoinLocalRoutes(movementHistory)
    if movementRoute {
        inverseMovement := ReverseLocalRoute(movementRoute)
        if !inverseMovement || !PlayLocalRoute(expectedGeneration, inverseMovement)
            return false
    }
    ; 作業は真下向きで安定するため、相対復元後に下限へ寄せて誤差を消します。
    if IsCurrentRun(expectedGeneration) {
        if !PlayLocalRoute(expectedGeneration, "900:32")
            return false
    }
    return true
}

RecoverLocalWorkTarget(expectedGeneration) {
    global State, Config
    workTargetPresent := ProbeWorkTarget(State.runMode, expectedGeneration)
    if !IsCurrentRun(expectedGeneration)
        return false
    if workTargetPresent
        return true
    if State.lastTargetProbeFatal {
        WriteDiagnostic("LOCAL_WORK_PROBE_FATAL result=" State.lastTargetProbeResult)
        return false
    }

    pulse := Max(120, Min(250, Config.vehicleSearchPulseMs))
    correctionSteps := [pulse ":1", (pulse * 2) ":2", pulse ":1",
        pulse ":4", (pulse * 2) ":8", pulse ":4"]
    for route in correctionSteps {
        movementOk := PlayLocalRoute(expectedGeneration, route)
        if !IsCurrentRun(expectedGeneration)
            return false
        if !movementOk {
            State.lastTargetProbeFatal := true
            State.lastTargetProbeResult := "ERROR RECOVERY_ROUTE"
            return false
        }
        viewOk := PlayLocalRoute(expectedGeneration, "650:32")
        if !IsCurrentRun(expectedGeneration)
            return false
        if !viewOk {
            State.lastTargetProbeFatal := true
            State.lastTargetProbeResult := "ERROR RECOVERY_VIEW"
            return false
        }
        workTargetPresent := ProbeWorkTarget(State.runMode, expectedGeneration)
        if !IsCurrentRun(expectedGeneration)
            return false
        if workTargetPresent {
            State.nudges += 1
            State.mealLabel.Text := State.runMode = "washing"
                ? "後退補正`n" State.nudges : "位置補正`n" State.nudges
            WriteDiagnostic("LOCAL_WORK_RECOVERED step=" A_Index)
            return true
        }
        if State.lastTargetProbeFatal {
            WriteDiagnostic("LOCAL_WORK_RECOVERY_PROBE_FATAL result="
                State.lastTargetProbeResult)
            return false
        }
    }
    return false
}

RunVehicleStorageCycle(expectedGeneration) {
    RunLocalVehicleStorageCycle(expectedGeneration)
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
        return "開始後に増えた持ち物を確認できませんでした"
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

EnsureBackgroundInventoryReady(expectedGeneration, &inventoryInfo) {
    global State
    inventoryInfo := 0
    snapshotResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "inventory-snapshot")
    if !IsCurrentRun(expectedGeneration)
        return false
    snapshotReady := ParseInventorySnapshot(snapshotResult, &inventoryInfo)

    ; 開いたままのinventoryを持ち越さず、初期化済みの場合も閉状態を保証します。
    closeResult := RunBackgroundBridgeCancelable(expectedGeneration, "close-inventory")
    if !IsCurrentRun(expectedGeneration)
        return false
    if closeResult != "CLOSED" {
        WriteDiagnostic("INVENTORY_PRIME_CLOSE_ERROR=" closeResult)
        return false
    }
    if !snapshotReady {
        ; 未初期化だけを開き直します。通信・解析エラーを「未初期化」と
        ; 誤認してキーを送ると、開いていたinventoryを反転させるため危険です。
        if snapshotResult != "ERROR INVENTORY_UNAVAILABLE" {
            WriteDiagnostic("INVENTORY_PRIME_SNAPSHOT_ERROR=" snapshotResult)
            return false
        }
        portReady := EnsureDevConPort()
        if !IsCurrentRun(expectedGeneration)
            return false
        if !portReady {
            WriteDiagnostic("INVENTORY_PRIME_PORT_ERROR")
            return false
        }
        port := State.lastDevConPort
        pressResult := RunBackgroundBridgeCancelable(expectedGeneration,
            "press-inventory", port, 80)
        if !IsCurrentRun(expectedGeneration)
            return false
        if pressResult != "INVENTORY " port {
            WriteDiagnostic("INVENTORY_PRIME_KEY_ERROR=" pressResult)
            State.lastDevConPort := 0
            if IsCurrentRun(expectedGeneration)
                RunBackgroundBridgeCancelable(expectedGeneration, "close-inventory")
            return false
        }
        if !WaitWhileBackgroundReady(900, expectedGeneration) {
            if IsCurrentRun(expectedGeneration)
                RunBackgroundBridgeCancelable(expectedGeneration, "close-inventory")
            return false
        }

        deadline := MonotonicMs() + 4000
        snapshotReady := false
        while MonotonicMs() < deadline {
            snapshotResult := RunBackgroundBridgeCancelable(expectedGeneration,
                "inventory-snapshot")
            if !IsCurrentRun(expectedGeneration)
                return false
            if ParseInventorySnapshot(snapshotResult, &inventoryInfo) {
                snapshotReady := true
                break
            }
            Sleep 160
        }
        closeResult := RunBackgroundBridgeCancelable(expectedGeneration,
            "close-inventory")
        if !IsCurrentRun(expectedGeneration)
            return false
        if closeResult != "CLOSED" {
            WriteDiagnostic("INVENTORY_PRIME_FINAL_CLOSE_ERROR=" closeResult)
            return false
        }
    }
    epochValid := ValidateServerEpochCheckpoint(expectedGeneration,
        "inventory_prime")
    if !IsCurrentRun(expectedGeneration)
        return false
    WriteDiagnostic("INVENTORY_PRIME ready=" snapshotReady
        " epoch=" epochValid " snapshot=" snapshotResult)
    return snapshotReady && epochValid
}

AutomationCycle(expectedGeneration) {
    global State
    if !IsCurrentRun(expectedGeneration)
        return
    if MaybeHandleServerHealth(expectedGeneration)
        return
    if MaybeHandleVehicleCapacity(expectedGeneration)
        return
    if !MaintainBackgroundWorkView(expectedGeneration)
        return
    if MaybeHandleBackgroundEating(expectedGeneration)
        return
    if State.runMode = "washing"
        WashAttemptBackground(expectedGeneration)
    else if State.runMode = "gold"
        GoldAttemptBackground(expectedGeneration)
    else
        MineAttempt(expectedGeneration)
}

WorkViewDownRoute(pulseMs) {
    pulse := Round(pulseMs)
    return pulse >= 100 && pulse <= 1500 ? pulse ":32" : ""
}

MaintainBackgroundWorkView(expectedGeneration, force := false) {
    global State, Config
    if !Config.backgroundMode || !Config.workViewLock
        return true
    now := MonotonicMs()
    if !force && State.lastWorkViewAt
        && now - State.lastWorkViewAt < Config.workViewIntervalMs
        return true
    route := WorkViewDownRoute(Config.workViewDownPulseMs)
    portReady := route ? EnsureDevConPort() : false
    if !IsCurrentRun(expectedGeneration)
        return false
    if !route || !portReady {
        State.workViewFailures += 1
        WriteDiagnostic("WORK_VIEW_PORT_ERROR failures=" State.workViewFailures)
        if State.workViewFailures >= 3 {
            StopAutomationWithFault(
                "作業視点を確認できないため3回失敗後に安全停止しました")
            return false
        }
        State.statusLabel.Text := "●  作業視点を再接続中"
        ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
        return false
    }
    if !IsCurrentRun(expectedGeneration)
        return false
    port := State.lastDevConPort
    viewResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "play-route-health", port, route, State.serverEpoch)
    if !IsCurrentRun(expectedGeneration)
        return false
    if viewResult != "ROUTE " port " " Config.workViewDownPulseMs {
        State.workViewFailures += 1
        State.lastDevConPort := 0
        WriteDiagnostic("WORK_VIEW_ERROR result=" viewResult
            " failures=" State.workViewFailures)
        if State.workViewFailures >= 3 {
            StopAutomationWithFault(
                "作業視点を固定できないため3回失敗後に安全停止しました")
            return false
        }
        State.statusLabel.Text := "●  作業視点を再調整中"
        ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
        return false
    }
    State.lastWorkViewAt := MonotonicMs()
    State.workViewFailures := 0
    WriteDiagnostic("WORK_VIEW_DOWN pulse=" Config.workViewDownPulseMs
        " mode=" State.runMode)
    return true
}

MaybeHandleBackgroundEating(expectedGeneration) {
    global State, Config
    if !Config.backgroundMode || !Config.autoEat || !IsCurrentRun(expectedGeneration)
        return false

    now := MonotonicMs()
    hungerKnown := false
    hungerLow := false
    if (!State.nextHungerCheckAt || now >= State.nextHungerCheckAt)
        && WinActive("ahk_id " State.targetHwnd) {
        State.nextHungerCheckAt := now + Config.hungerCheckIntervalMs
        hungerKnown := ReadForegroundHungerConfirmed(expectedGeneration, &hungerLow)
        if hungerKnown {
            State.backgroundHungerUnknownLogged := false
            if !hungerLow {
                ; A visible full gauge is stronger evidence than the time fallback.
                State.backgroundEatFailures := 0
                State.nextBackgroundEatAt := now + Config.backgroundEatIntervalMs
                return false
            }
        }
    }

    fallbackDue := Config.backgroundEatFallback
        && State.nextBackgroundEatAt && now >= State.nextBackgroundEatAt
    if !hungerLow && !fallbackDue {
        if !hungerKnown && !State.backgroundHungerUnknownLogged {
            State.backgroundHungerUnknownLogged := true
            WriteDiagnostic("HUNGER_BACKGROUND_UNKNOWN fallbackAt="
                State.nextBackgroundEatAt)
        }
        return false
    }
    if State.nextEatAllowedAt && now < State.nextEatAllowedAt
        return false

    cooldownRemaining := WorkTargetCooldownRemainingMs()
    if cooldownRemaining > 0 {
        State.statusLabel.Text := "●  作業完了後に食事します"
        ScheduleNext(expectedGeneration, Min(750, cooldownRemaining))
        return true
    }
    workTargetPresent := ProbeWorkTarget(State.runMode, expectedGeneration)
    if !IsCurrentRun(expectedGeneration)
        return true
    if !workTargetPresent {
        if State.lastTargetProbeFatal {
            StopAutomationWithFault("食事前の作業位置を安全に確認できないため停止しました")
            return true
        }
        State.statusLabel.Text := "●  作業ボタンの再表示後に食事します"
        ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
        return true
    }

    reason := hungerLow ? "gauge" : "periodic"
    State.automationPhase := "eating"
    eatResult := PerformBackgroundEating(expectedGeneration, reason)
    if !IsCurrentRun(expectedGeneration)
        return true
    State.automationPhase := "working"
    if eatResult {
        State.backgroundEatFailures := 0
        State.nextBackgroundEatAt := MonotonicMs() + Config.backgroundEatIntervalMs
        State.nextEatAllowedAt := MonotonicMs() + Config.eatCooldownMs
        State.nextHungerCheckAt := MonotonicMs() + Config.hungerCheckIntervalMs
        State.statusLabel.Text := "●  食事完了。作業を再開します"
        ScheduleNext(expectedGeneration, Config.postEatResumeMs)
        return true
    }

    ; 食料切れ・使用拒否のまま採集だけを無期限継続しないよう、
    ; 連続3回確認できなければ安全停止します。
    State.backgroundEatFailures += 1
    if State.backgroundEatFailures >= 3 {
        StopAutomationWithFault("スロット " Config.foodKey
            . " の食事を3回確認できないため安全停止しました", "settings")
        return true
    }
    ; コマンドが受理されたか不明な場合も短時間の連打はしません。
    State.nextBackgroundEatAt := MonotonicMs() + Config.failedEatRetryMs
    State.nextEatAllowedAt := MonotonicMs() + Config.failedEatRetryMs
    State.statusLabel.Text := "●  スロット " Config.foodKey
        . " の食事を確認できません。後で再試行します"
    ScheduleNext(expectedGeneration, Config.postEatResumeMs)
    return true
}

ReadForegroundHungerConfirmed(expectedGeneration, &isLow) {
    global State, Config
    isLow := false
    validVotes := 0
    lowVotes := 0
    loop Config.hungerConfirmFrames {
        if !IsCurrentRun(expectedGeneration)
            || !WinActive("ahk_id " State.targetHwnd)
            return false
        if ReadHungerLow(&frameLow) {
            validVotes += 1
            if frameLow
                lowVotes += 1
        }
        if A_Index < Config.hungerConfirmFrames
            Sleep Config.hungerConfirmGapMs
    }
    requiredVotes := Floor(Config.hungerConfirmFrames / 2) + 1
    if validVotes < requiredVotes
        return false
    isLow := lowVotes >= requiredVotes
    WriteDiagnostic("HUNGER_FOREGROUND low=" isLow
        " votes=" lowVotes "/" validVotes)
    return true
}

PerformBackgroundEating(expectedGeneration, reason) {
    global State, Config
    ; StartMiningで一度だけinventory storeを初期化します。食事のたびに
    ; +invを送り直すと、通信失敗時に画面を開閉反転させる恐れがあります。
    beforeResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "inventory-snapshot")
    if !IsCurrentRun(expectedGeneration)
        return false
    if !ParseInventorySnapshot(beforeResult, &beforeInfo)
        || !InventorySpecSlotState(beforeInfo.items, Config.foodKey,
            &beforeKey, &beforeCount) {
        WriteDiagnostic("EAT_BG_NO_CONFIGURED_ITEM slot=" Config.foodKey
            " snapshot=" beforeResult)
        return false
    }
    if !EnsureDevConPort() || !IsCurrentRun(expectedGeneration) {
        WriteDiagnostic("EAT_BG_PORT_ERROR slot=" Config.foodKey)
        return false
    }
    port := State.lastDevConPort
    State.statusLabel.Text := "●  食事中（スロット " Config.foodKey "）"
    pressResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "press-hotbar", port, Config.foodKey, Config.foodKeyHoldMs)
    WriteDiagnostic("EAT_BG_PRESS reason=" reason " result=" pressResult
        " before=" beforeKey "=" beforeCount)
    if pressResult != "HOTBAR " port " " Config.foodKey
        return false
    if !WaitWhileBackgroundReady(Config.eatAnimationMs + Config.gaugeSettleMs,
        expectedGeneration)
        return false

    afterResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "inventory-snapshot")
    if !ParseInventorySnapshot(afterResult, &afterInfo)
        || !InventorySlotWasConsumed(beforeInfo.items, afterInfo.items,
            Config.foodKey) {
        WriteDiagnostic("EAT_BG_NOT_CONSUMED slot=" Config.foodKey
            " after=" afterResult)
        return false
    }
    State.meals += 1
    State.mealLabel.Text := "食事回数`n" State.meals
    WriteDiagnostic("EAT_BG_CONFIRMED slot=" Config.foodKey
        " meals=" State.meals)
    return true
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
            if Config.washForwardCorrection {
                portReady := EnsureDevConPort()
                if !IsCurrentRun(expectedGeneration)
                    return
                if !portReady {
                    State.statusLabel.Text := "●  FiveM内部UIへ再接続中"
                    WriteDiagnostic("attempt=" State.attempts " WASH_NUDGE_PORT_MISSING")
                    return
                }
                port := State.lastDevConPort
                State.statusLabel.Text := "●  洗浄位置を少し前へ補正中"
                nudgeResult := RunBackgroundBridgeCancelable(expectedGeneration,
                    "play-route-health", port, Config.washForwardPulseMs ":1",
                    State.serverEpoch)
                if !IsCurrentRun(expectedGeneration)
                    return
                WriteDiagnostic("attempt=" State.attempts " WASH_NUDGE=" nudgeResult)
                if nudgeResult = "ROUTE " port " " Config.washForwardPulseMs {
                    State.washNudgePending := false
                    State.nudges += 1
                    State.mealLabel.Text := "後退補正`n" State.nudges
                } else {
                    ; 入力が一部届いた可能性を否定できないため、重ねて前進も
                    ; 洗浄続行もせず停止します。
                    StopAutomationWithFault(
                        "洗浄位置の補正結果を確認できないため安全停止しました")
                    return
                }
                ; packetだけ届いてhelper応答が失われた場合も、前進中にtargetを開きません。
                if !WaitWhileBackgroundReady(Config.washForwardSettleMs + 50,
                    expectedGeneration)
                    return
            } else {
                State.washNudgePending := false
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
    portReady := EnsureDevConPort()
    if !IsCurrentRun(expectedGeneration)
        return false
    if !portReady {
        ; 移動は始まっていないので、改めて12秒の連続未検出を確認します。
        State.goldMissingSince := 0
        State.statusLabel.Text := "●  位置補正の接続を再確認しています"
        WriteDiagnostic("attempt=" State.attempts " GOLD_RECOVERY_PORT_MISSING")
        return false
    }
    ; bridgeの応答が失われても同じ方向へ無制限に進まないよう、実行前に
    ; 段階を消費します。6段階全体では前後・左右の入力時間が釣り合います。
    State.goldRecoveryStep := nextStep
    port := State.lastDevConPort
    State.statusLabel.Text := "●  砂金位置を自動補正中 (" nextStep "/6)"
    recoveryResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "play-route-health", port, route, State.serverEpoch)
    if !IsCurrentRun(expectedGeneration)
        return false
    routeOk := recoveryResult = "ROUTE " port " " RouteTotalMs(route, false)
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
        StopAutomationWithFault(
            "位置補正を完了できないため安全停止しました。位置を確認してください")
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

        longCompanionCommand := false
        if InStr(mode, "play-route") && bridgeArgs.Length >= 2 {
            routeDurationMs := RouteTotalMs(bridgeArgs[2], false)
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
        } else if mode = "companion-command" && bridgeArgs.Length >= 1 {
            companionCommand := bridgeArgs[1]
            longCompanionCommand := companionCommand = "go-vehicle"
                || companionCommand = "return-work"
            timeoutMs := longCompanionCommand ? 125000
                : companionCommand = "open-cargo" ? 28000 : 18000
        } else {
            timeoutMs := mode = "deposit-delta" ? 50000 : 9000
        }
        deadline := MonotonicMs() + timeoutMs
        nextCompanionEpochCheckAt := longCompanionCommand
            ? MonotonicMs() + 6000 : 0
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
            if longCompanionCommand && MonotonicMs() >= nextCompanionEpochCheckAt {
                if !ValidateActiveCompanionCommandEpochs(expectedGeneration) {
                    CancelBridgeProcess(helperPid, mode, operationToken)
                    ReleaseBackgroundTarget(true)
                    return "ERROR COMPANION_SESSION_CHANGED"
                }
                nextCompanionEpochCheckAt := MonotonicMs() + 6000
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

ValidateActiveCompanionCommandEpochs(expectedGeneration) {
    global State
    if !IsBridgeOperationContextValid(expectedGeneration)
        return false
    healthResult := RunBackgroundBridge("health")
    if !ParseServerHealth(healthResult, &serverEpoch)
        || !State.serverEpoch || serverEpoch != State.serverEpoch {
        WriteDiagnostic("COMPANION_LONG_SERVER_EPOCH_ERROR result=" healthResult)
        return false
    }
    companionResult := RunBackgroundBridge("companion-status")
    if !ParseCompanionStatus(companionResult, &companionInfo)
        || !State.companionEpoch || companionInfo.epoch != State.companionEpoch {
        WriteDiagnostic("COMPANION_LONG_RESOURCE_EPOCH_ERROR result=" companionResult)
        return false
    }
    if !companionInfo.serverRegistrationSynchronized {
        WriteDiagnostic("COMPANION_LONG_SERVER_REGISTRATION_NOT_SYNCHRONIZED")
        return false
    }
    ; 通常runでは途中で未確定候補へ切り替わった時点で停止します。
    ; expectedGeneration=0は登録候補へ移動中なのでpending=trueが正しい状態です。
    if expectedGeneration && !CompanionProfileMatches(companionInfo) {
        WriteDiagnostic("COMPANION_LONG_REGISTRATION_CHANGED pending="
            (companionInfo.transactionPending ? 1 : 0))
        return false
    }
    return true
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
    if mode = "companion-command" {
        ; 別bridgeプロセスからresourceへ中止を通知してから、待機中helperを閉じます。
        RunBackgroundBridge("companion-command", "cancel")
        try ProcessWaitClose processId, 2
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
    global State, Config

    previousPhase := State.automationPhase
    wasRegistering := State.registrationActive
    State.running := false
    State.generation += 1
    if IsObject(State.timerFn) {
        try SetTimer(State.timerFn, 0)
    }
    State.timerFn := 0
    StopUpdatePollTimer()
    if !State.updateApplying
        CleanupUpdateStage()
    cancelCompanion := Config.vehicleCompanionProtocol = 1
        && (State.companionReady || State.companionEpoch)
    State.registrationCancelled := true
    CloseLocalRegistrationOverlay()
    CancelActiveBridgeProcess()
    if cancelCompanion
        RunCompanionCommand("cancel")
    ReleaseAllInputs()
    ReleaseBackgroundTarget(true)
    if wasRegistering || previousPhase = "find_registered_vehicle" || previousPhase = "depositing"
        || previousPhase = "return_to_work" || previousPhase = "verify_workpoint"
        RunBackgroundBridge("close-inventory")
    UnregisterConfiguredHotkeys()
    SetTimer UpdateConnectionStatus, 0
    SetTimer MonitorWebUiHost, 0
    State.uiWindowVisible := false
    SendWebUiCommand("EXIT")
    if State.uiHostPid {
        try ProcessWaitClose State.uiHostPid, 2
    }
    DeleteExtractedTemplates()
}

DeleteExtractedTemplates() {
    global State, settingsPath

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
    if A_IsCompiled && State.uiRuntimeRoot {
        knownUiFiles := [
            State.uiHostPath,
            State.uiHostPath ".config",
            State.uiRuntimeRoot "\Microsoft.Web.WebView2.Core.dll",
            State.uiRuntimeRoot "\Microsoft.Web.WebView2.WinForms.dll",
            State.uiRuntimeRoot "\WebView2Loader.dll",
            State.uiAssetsPath "\index.html",
            State.uiAssetsPath "\app.css",
            State.uiAssetsPath "\app.js",
            State.uiAssetsPath "\build-info.json",
            State.uiAssetsPath "\vendor\framework7-bundle.min.css",
            State.uiAssetsPath "\vendor\framework7-bundle.min.js"
        ]
        for filePath in knownUiFiles
            try FileDelete filePath
        try DirDelete State.uiAssetsPath "\vendor"
        try DirDelete State.uiAssetsPath
        try DirDelete State.uiRuntimeRoot
    }
    if State.uiSmokeTest || State.visualTest {
        try FileDelete settingsPath
        ; 配布EXE自身のテストで、配布フォルダーへ診断ログを残しません。
        try FileDelete State.diagnosticPath
    }
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
        && config.vehicleCompanionProtocol = 0
        && config.vehicleRegistrationId = ""
        && IsValidBase64Token(config.vehicleStorageId)
        && config.vehicleStorageType = "dHJ1bms="
        && (config.vehicleWorkMode = "mining" || config.vehicleWorkMode = "washing"
            || config.vehicleWorkMode = "gold")
        && config.vehicleRouteFormat = 5
        && config.vehicleOutboundRoute = ""
        && config.vehicleReturnRoute = ""
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

RouteTotalMs(route, requireMovement := true) {
    if !IsValidRoute(route, requireMovement)
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

    ; ox_inventoryが標準登録するホットバー1～5だけを許可します。
    ; 6～9を許すとキー自体は送れてもuseSlotへ結び付かないため安全側で1へ戻します。
    return RegExMatch(value, "^[1-5]$") ? value : "1"
}
