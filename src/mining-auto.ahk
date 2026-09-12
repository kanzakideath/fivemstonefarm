#Requires AutoHotkey v2.0
#SingleInstance Force

SendMode "Event"
SetMouseDelay 25
SetKeyDelay 25, 25
SetTitleMatchMode 2
CoordMode "Pixel", "Screen"
CoordMode "Mouse", "Screen"
Thread "Interrupt", 0

global AppVersion := "9.1.16"
;@Ahk2Exe-SetVersion %A_PriorLine~U)^.*"([^"]+)".*$~$1%
processId := DllCall("GetCurrentProcessId")
global LocalNav := {busy: false, pid: 0, cancel: "", taskId: 0, dialog: 0, guide: 0, feedback: "", requestActive: false, cycle: 0, lastBatchKey: "", lastActionKey: ""}
isUiSmokeTest := HasCommandLineArgument("--smoke-test")
isVisualTest := HasCommandLineArgument("--visual-test")
isUiTestRun := isUiSmokeTest || isVisualTest
isValidationRun := HasCommandLineArgument("--validate")
isHistoryImportTestRun := HasCommandLineArgument("--history-import-self-test")
if isValidationRun || isUiTestRun
    OnError(ValidationFatalError)
; GUI updaters may have no stderr handle. Logging must not fail validation.
if isValidationRun
    try FileAppend "VALIDATION_PHASE entry " A_Args.Length "`n", "**", "UTF-8-RAW"
; Windows reuses process IDs. Validation artifacts keyed only by PID could be
; mistaken for the current run after an earlier test left a receipt behind.
testRunId := processId "-" (A_TickCount & 0xFFFFFFFF) "-" Random(100000, 999999)
persistentDataRoot := isUiTestRun || isValidationRun
    ? A_Temp "\ai-miner-persistent-test-" testRunId
    : isHistoryImportTestRun
        ? EnvGet("LOCALAPPDATA") "\AI採掘機"
        : EnvGet("USERPROFILE") "\Saved Games\AI採掘機"
#Include diagnostics.ahk
InitSupportDiagnostics(persistentDataRoot, isUiTestRun || isValidationRun || isHistoryImportTestRun || HasCommandLineArgument("--cursor-api-test"), processId)
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
#Include exe-route-navigation.ahk
#Include wash-position.ahk
#Include nearby-wash.ahk
#Include stationary-only.ahk
InitExeRouteAssets()
settingsPath := isUiTestRun || isValidationRun
    ? A_Temp "\ai-miner-ui-test-" testRunId ".ini"
    : A_ScriptDir "\AI採掘機.ini"
legacySettingsPath := A_ScriptDir "\自動採掘マクロ.ini"
if !isUiTestRun && !isValidationRun
    && !FileExist(settingsPath) && FileExist(legacySettingsPath) {
    try FileCopy legacySettingsPath, settingsPath, false
    catch
        settingsPath := legacySettingsPath
}
updateSettingsSchema := ReadIntegerSetting(settingsPath, "Updates", "Schema", 0, 0, 1)

global Config := {
    actionMode: ReadActionMode(settingsPath),
    backgroundMode: 1, ; stationary UI adapter only
    retiredBackgroundMode: ReadIntegerSetting(settingsPath, "General", "BackgroundMode", 1, 0, 1),
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
    workViewLock: 0, ; retired by stationary-only policy
    workViewDownPulseMs: ReadIntegerSetting(settingsPath, "ViewLock", "DownPulseMs", 450, 100, 1500),
    workViewIntervalMs: ReadIntegerSetting(settingsPath, "ViewLock", "ReapplyIntervalMs", 4000, 1500, 30000),
    workViewMouseStep: ReadIntegerSetting(settingsPath, "ViewLock", "MouseStep", 24, 4, 80),
    workViewMouseDirection: ReadViewDirectionSetting(settingsPath),
    washCycleMs: ReadIntegerSetting(settingsPath, "Washing", "CycleMs", 9000, 7000, 20000),
    washReadinessGraceMs: ReadIntegerSetting(settingsPath, "Washing", "ReadinessGraceMs", 7000, 5500, 12000),
    fastWashMode: ReadIntegerSetting(settingsPath, "Washing", "FastMode", 1, 0, 1),
    washForwardCorrection: 0, ; retired by stationary-only policy
    washForwardPulseMs: ReadIntegerSetting(settingsPath, "Washing", "ForwardPulseMs", 100, 50, 250),
    washForwardSettleMs: ReadIntegerSetting(settingsPath, "Washing", "ForwardSettleMs", 250, 50, 3000),
    ; FiveM keeps applying the washing animation's backward root motion for about
    ; one second after the progress UI disappears.  Do not let an older 1.2 s INI
    ; value dispatch W while that motion can still be active.
    washPostCompletionSettleMs: ReadIntegerSetting(settingsPath, "Washing", "PostCompletionSettleMs", 2000, 2000, 4000),
    rawStoneItemName: ReadTextSetting(settingsPath, "Washing", "RawStoneItem", ""),
    washRefillMaximum: ReadIntegerSetting(settingsPath, "Washing", "RefillMaximum", 1000000, 1, 1000000),
    goldCycleMs: ReadIntegerSetting(settingsPath, "GoldPanning", "CycleMs", 6000, 4000, 15000),
    goldRecoveryEnabled: 0, ; retired by stationary-only policy
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
    storageTriggerPercent: ReadIntegerSetting(settingsPath, "VehicleStorage", "StorageTriggerPercent", 92, 50, 99),
    estimatedRewardWeight: ReadIntegerSetting(settingsPath, "VehicleStorage", "EstimatedRewardWeight", 2000, 250, 20000),
    minimumFreeSlots: ReadIntegerSetting(settingsPath, "VehicleStorage", "MinimumFreeSlots", 1, 0, 10),
    storageMaxRetries: ReadIntegerSetting(settingsPath, "VehicleStorage", "MaxRetries", 5, 1, 8),
    storageVerifyTimeoutMs: ReadIntegerSetting(settingsPath, "VehicleStorage", "VerifyTimeoutMs", 5000, 1000, 15000),
    routeIdleFinishMs: ReadIntegerSetting(settingsPath, "VehicleStorage", "RouteIdleFinishMs", 1200, 700, 3000),
    routeSettleMs: ReadIntegerSetting(settingsPath, "VehicleStorage", "RouteSettleMs", 700, 200, 3000),
    vehicleSearchPulseMs: ReadIntegerSetting(settingsPath, "VehicleStorage", "SearchPulseMs", 180, 120, 350),
    serverHealthIntervalMs: ReadIntegerSetting(settingsPath, "Safety", "ServerHealthIntervalMs", 3500, 1500, 10000),
    farmWatchdogMs: ReadIntegerSetting(settingsPath, "Safety", "FarmWatchdogMs", 60000, 15000, 180000),
    targetLostRecoveryMs: ReadIntegerSetting(settingsPath, "Safety", "TargetLostRecoveryMs", 15000, 5000, 60000),
    rewardConfirmTimeoutMs: ReadIntegerSetting(settingsPath, "Safety", "RewardConfirmTimeoutMs", 5000, 1000, 10000),
    debugOverlay: ReadIntegerSetting(settingsPath, "Safety", "DebugOverlay", 0, 0, 1)
}

if StrLen(Config.vehicleName) > 40
    Config.vehicleName := SubStr(Config.vehicleName, 1, 40)
if Config.rawStoneItemName
    && !RegExMatch(Config.rawStoneItemName, "^[A-Za-z0-9_-]{1,64}$")
    Config.rawStoneItemName := ""
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
    startInProgress: false,
    startRequestSequence: 0,
    startRequestToken: 0,
    stopInProgress: false,
    ; A timer callback can be suspended by F9.  Keep its ownership until the
    ; complete stack has unwound so F8 cannot install a new run underneath an
    ; old recovery/storage finally block.
    activeFarmCallbacks: 0,
    runMode: "mining",
    generation: 0,
    timerFn: 0,
    pendingFarmTimerGeneration: 0,
    pendingFarmTimerTaskId: 0,
    pendingFarmTimerDueAt: 0,
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
    actionCompletionPending: false,
    actionCompletionMode: "",
    actionDispatchUncertain: false,
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
    lastWorkViewVerifiedAt: 0,
    workViewStatus: "UNKNOWN",
    workViewFailures: 0,
    workViewNoEffectCount: 0,
    workViewDirection: Config.workViewMouseDirection,
    diagnosticPath: isUiTestRun || HasCommandLineArgument("--validate")
        ? A_Temp "\ai-miner-diagnostic-test-" testRunId ".log"
        : A_ScriptDir "\AI採掘機_診断.log",
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
    farmState: "IDLE",
    farmStateReason: "起動待ち",
    farmStateEnteredAt: 0,
    farmStateTaskId: 0,
    farmStateRetry: 0,
    farmStateLastError: "",
    farmWatchdogAt: 0,
    lastVerifiedRewardAt: 0,
    watchdogRecoveryCount: 0,
    targetLostSince: 0,
    targetRecoveryAttempts: 0,
    recoveryPreflightFailures: 0,
    recoveryRestartCount: 0,
    recoveryRestartPending: false,
    recoveryReturnState: "FARMING",
    recoveryReason: "",
    inventorySnapshotRevision: 0,
    confirmedInventory: 0,
    pendingFarmAttempt: 0,
    miningAttemptId: 0,
    resumeVerificationPending: false,
    rewardReconcileAttempts: 0,
    washRecoveryGeneration: 0,
    washRecoveryAttemptId: 0,
    washSettleDeadline: 0,
    washCorrectionInFlight: false,
    washCorrectionSent: false,
    washCameraRestoreSent: false,
    washVerificationAttempts: 0,
    storagePreSnapshot: 0,
    storageRetryCount: 0,
    storageMovementHistory: [],
    storageMatchedViewRoute: "",
    recoveryAtStorage: false,
    farmSessionId: "",
    farmSessionStartedAt: 0,
    farmSessionEndedAt: 0,
    metagameSessionResetCount: 0,
    lastMetaResetToken: "",
    farmSessionBeginQueued: false,
    farmSessionBeginSent: false,
    farmSessionEndQueued: false,
    farmSessionEndSent: false,
    lastMiningEventId: "",
    metagameOutbox: [],
    metagameOutboxDirty: false,
    metagameReplayNormalized: false,
    metagameJournalReady: false,
    metagameJournalOps: 0,
    metagameFlushActive: false,
    persistentDataRoot: persistentDataRoot,
    metagameStatePath: persistentDataRoot "\metagame\state.json",
    uiUserDataPath: persistentDataRoot "\WebView2",
    legacyDurabilityReceiptPath: persistentDataRoot
        "\legacy-durability-import.v1.tsv",
    legacyDurabilityBackupRoot: persistentDataRoot "\legacy-backups",
    legacyDurabilityMigrationReady: false,
    metagameOutboxPath: isUiTestRun || isValidationRun
        ? A_Temp "\ai-miner-meta-outbox-test-" testRunId ".tsv"
        : persistentDataRoot "\metagame-outbox.tsv",
    metagameBackfillMarkerPath: isUiTestRun || isValidationRun
        ? A_Temp "\ai-miner-meta-backfill-test-" testRunId ".done"
        : A_ScriptDir "\AI採掘機_STONE履歴移行.v1.done",
    metagameSupportBackfillReceiptPath: isUiTestRun || isValidationRun
        ? A_Temp "\ai-miner-meta-support-receipt-test-" testRunId ".done"
        : A_ScriptDir "\AI採掘機_STONE履歴復元.v1.receipt",
    verifiedRewardWalPath: isUiTestRun || isValidationRun
        ? A_Temp "\ai-miner-verified-reward-wal-test-" testRunId ".tsv"
        : persistentDataRoot "\verified-reward-wal.tsv",
    verifiedRewardWalPending: Map(),
    verifiedRewardWalOps: 0,
    verifiedRewardWalReady: false,
    ; Exact name+metadata quantities observed only at a finalized Farm reward.
    ; This ledger, rather than an elapsed-run inventory delta, is the authority
    ; for every player -> vehicle transfer.
    farmOutputLedger: Map(),
    storageDepositCheckpoint: 0,
    storageDepositSequence: 0,
    inventoryBaseline: "",
    inventoryBaselineWeight: -1,
    nextCapacityCheckAt: 0,
    nextActionAt: 0,
    storagePending: false,
    storageStartPending: false,
    storageRecoveryAttempted: false,
    storageReason: "",
    storageOutputsVerified: false,
    storageRefillVerified: false,
    capacityProbeFailures: 0,
    workpointProbeFailures: 0,
    serverEpoch: "",
    serverHealthFailures: 0,
    nextServerHealthAt: 0,
    lastInventoryWeight: 0,
    lastInventoryMaxWeight: 0,
    lastInventoryFreeWeight: 0,
    lastCapacityReason: "未確認",
    lastAlertKind: "",
    lastAlertAt: 0,
    speechVoice: 0,
    speechVoiceConfigured: false,
    storageTrips: 0,
    washRefillTrips: 0,
    lastRawStoneCount: -1,
    lastStorageResult: "未実行",
    lastStorageProbeResult: "",
    lastTargetProbeResult: "",
    lastTargetProbeFatal: false,
    statusOverlay: 0,
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

; Mining events are persisted independently from the farm INI. A Host crash or an
; app restart therefore cannot turn an already verified ore reward into a lost
; metagame event. Invalid/corrupt rows are ignored fail-closed while valid rows
; retain FIFO order.
State.legacyDurabilityMigrationReady := isUiTestRun || isValidationRun
    || isHistoryImportTestRun || MigrateLegacyMetagameDurabilityFiles()
State.metagameOutbox := LoadMetagameOutbox(State.metagameOutboxPath)
State.metagameReplayNormalized := NormalizeStoppedMetagameOutboxAtStartup()
loadedRewardWalPending := Map()
loadedRewardWalOps := 0
State.verifiedRewardWalReady := LoadVerifiedRewardWal(
    State.verifiedRewardWalPath, &loadedRewardWalPending, &loadedRewardWalOps)
State.verifiedRewardWalPending := loadedRewardWalPending
State.verifiedRewardWalOps := loadedRewardWalOps
if State.verifiedRewardWalReady
    State.verifiedRewardWalReady := RecoverVerifiedRewardWal()

; Compiled integration test entry point. It exercises the same install-local log
; and marker plus LocalAppData outbox paths, then exits before UI/FiveM interaction.
if HasCommandLineArgument("--history-import-self-test") {
    historyImportTestOk := State.verifiedRewardWalReady
        && RunLegacyFarmHistoryBackfill()
    DeleteExtractedTemplates()
    ExitApp(historyImportTestOk ? 0 : 144)
}

; コンパイル前後の構文・埋め込み画像チェック用です。
if isValidationRun {
    if !ValidateStationaryOnlyPolicy()
        ExitApp(159)
    try FileAppend "VALIDATION_PHASE proofs " A_TickCount "`n", "**", "UTF-8-RAW"
    if !ValidateStorageCycleProof() || !ValidateStationaryWorkflow() || !ValidateNearbyWashRecovery() || !ValidateNearbyWashService() || !ValidateSupportDiagnostics() {
        DeleteExtractedTemplates()
        ExitApp(145)
    }
    try FileAppend "VALIDATION_PHASE updater " A_TickCount "`n", "**", "UTF-8-RAW"
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
    testOverlayBounds := RuntimeStatusOverlayBounds(100, 200, 1280, 720)
    testOutboxPath := A_Temp "\ai-miner-outbox-selftest-" testRunId ".tsv"
    try FileDelete testOutboxPath
    testOutbox := []
    testOutboxSessionId := "run_11_1_946684800000"
    testOutboxFirstId := "mine_run_11_1_1000_1_1"
    testOutboxSecondId := "mine_run_11_1_1000_2_2"
    testOutboxEnqueueOk := MetagameOutboxEnqueue(&testOutbox,
        testOutboxSessionId, 946684800000, "SESSION_BEGIN")
        && MetagameOutboxEnqueue(&testOutbox,
            testOutboxFirstId, 946684801000)
    ; Three failed deliveries must not poison or replace the first event while a
    ; second verified mining reward arrives.
    if testOutboxEnqueueOk
        testOutbox[2].retries := 3
    testOutboxEnqueueOk := testOutboxEnqueueOk
        && MetagameOutboxEnqueue(&testOutbox,
            testOutboxSecondId, 946684802000)
        && MetagameOutboxEnqueue(&testOutbox,
            testOutboxSessionId, 946684803000, "SESSION_END")
        && !MetagameOutboxEnqueue(&testOutbox,
            testOutboxFirstId, 946684804000)
        && PersistMetagameOutbox(testOutbox, testOutboxPath)
    testRestartOutbox := LoadMetagameOutbox(testOutboxPath)
    testLostAckRetained := testRestartOutbox.Length = 4
        && testRestartOutbox[1].command = "SESSION_BEGIN"
        && testRestartOutbox[1].id = testOutboxSessionId
        && testRestartOutbox[1].at = 946684800000
        && testRestartOutbox[2].command = "MINING_SUCCESS"
        && testRestartOutbox[2].id = testOutboxFirstId
        && testRestartOutbox[2].at = 946684801000
        && testRestartOutbox[3].id = testOutboxSecondId
        && testRestartOutbox[4].command = "SESSION_END"
        && testRestartOutbox[4].id = testOutboxSessionId
        && testRestartOutbox[4].at = 946684803000
    testResetOutbox := LoadMetagameOutbox(testOutboxPath)
    testRebaseSessionId := "run_22_2_1893456000000_r1"
    testSessionRebaseOk := RebaseMetagameOutboxForSession(&testResetOutbox,
        testRebaseSessionId, 1893456000000)
        && testResetOutbox.Length = 3
        && testResetOutbox[1].command = "SESSION_BEGIN"
        && testResetOutbox[1].id = testRebaseSessionId
        && testResetOutbox[2].id = testOutboxFirstId
        && testResetOutbox[2].at = 946684801000
        && testResetOutbox[3].id = testOutboxSecondId
        && testResetOutbox[3].at = 946684802000
    testAckOriginal := LoadMetagameOutbox(testOutboxPath)
    testAckCopyOnWriteOk := BuildMetagameOutboxAfterAck(testAckOriginal,
        "SESSION_BEGIN", testOutboxSessionId, &testAckCandidate)
        && testAckOriginal.Length = 4 && testAckCandidate.Length = 3
        && testAckOriginal[1].command = "SESSION_BEGIN"
        && testAckCandidate[1].command = "MINING_SUCCESS"
    testIdleReplayOutbox := LoadMetagameOutbox(testOutboxPath)
    testIdleReplaySession := "run_33_3_1893456001000_r2"
    testIdleReplayOk := RebaseMetagameOutboxForSession(
        &testIdleReplayOutbox, testIdleReplaySession, 1893456001000,
        true, 1893456001001)
        && testIdleReplayOutbox.Length = 4
        && testIdleReplayOutbox[1].command = "SESSION_BEGIN"
        && testIdleReplayOutbox[2].at = 946684801000
        && testIdleReplayOutbox[3].at = 946684802000
        && testIdleReplayOutbox[4].command = "SESSION_END"
    ; A delayed duplicate BEGIN ACK cannot delete the END with the same ID.
    testOutboxAckOk := MetagameOutboxAcknowledge(&testRestartOutbox,
        "SESSION_BEGIN", testOutboxSessionId)
        && MetagameOutboxAcknowledge(&testRestartOutbox,
            "MINING_SUCCESS", testOutboxFirstId)
        && testRestartOutbox.Length = 2
        && testRestartOutbox[1].id = testOutboxSecondId
        && MetagameOutboxAcknowledge(&testRestartOutbox,
            "MINING_SUCCESS", testOutboxSecondId)
        && !MetagameOutboxAcknowledge(&testRestartOutbox,
            "SESSION_BEGIN", testOutboxSessionId)
        && MetagameOutboxAcknowledge(&testRestartOutbox,
            "SESSION_END", testOutboxSessionId)
        && !MetagameOutboxAcknowledge(&testRestartOutbox,
            "SESSION_END", testOutboxSessionId)
        && testRestartOutbox.Length = 0
    testFarmAttempt := {
        generation: 9, actionMode: "mining", attemptId: 4,
        before: {weight: 1000, items: "0001.ore.e30=1"},
        beforeRevision: 8, clicked: true, completed: false,
        rewardSessionId: "run_9_9_1893456000000",
        rewardEventId: "mine_run_9_9_1893456000000_mining_4_9",
        rewardConfirmedAtUnixMs: 1893456000001,
        rewardConfirmedInfo: {revision: 9}
    }
    testFarmAttemptWithoutBaseline := {
        generation: 9, actionMode: "mining", attemptId: 5,
        before: 0, beforeRevision: 0, clicked: false, completed: false
    }
    testFarmBaselineGuardOk := FarmAttemptHasBaseline(testFarmAttempt, 9,
        "mining") && !FarmAttemptHasBaseline(testFarmAttemptWithoutBaseline,
        9, "mining")
    testFarmClickOnlyNotSuccess := !FarmAttemptCanFinalize(testFarmAttempt, 9,
        "mining", {revision: 9})
    testFarmAttempt.completed := true
    testFarmFinalizeGuardOk := testFarmClickOnlyNotSuccess
        && FarmAttemptCanFinalize(testFarmAttempt, 9, "mining",
            {revision: 9})
    testDebugOverlayText := RuntimeStatusOverlayDebug("FARMING", 9200,
        10000, 1000, 5200, 2, "FOUND", "INPUT_SENT", 61000, 60000)
    testDebugOverlayOk := InStr(testDebugOverlayText, "Inventory 92")
        && InStr(testDebugOverlayText, "Reward 4.2s")
        && InStr(testDebugOverlayText, "Storage retry 2")
        && InStr(testDebugOverlayText, "Target FOUND")
        && InStr(testDebugOverlayText, "Camera VERIFY")
        && InStr(testDebugOverlayText, "Watchdog LATE")
    testCameraOverlayStatesOk :=
        InStr(RuntimeStatusOverlayDebug("RECOVERY", 0, 0, 0, 1000, 0,
            "LOST", "WAIT_FG", 0, 60000), "Camera WAIT_FG")
        && InStr(RuntimeStatusOverlayDebug("RECOVERY", 0, 0, 0, 1000, 0,
            "LOST", "INPUT_SENT", 0, 60000), "Camera VERIFY")
        && InStr(RuntimeStatusOverlayDebug("FARMING", 0, 0, 0, 1000, 0,
            "FOUND", "TARGET_OK", 0, 60000), "Camera TARGET_OK")
        && InStr(RuntimeStatusOverlayDebug("RECOVERY", 0, 0, 0, 1000, 0,
            "LOST", "FAILED", 0, 60000), "Camera FAILED")
    testFarmFailureCodesOk :=
        FarmFailureCode("所持品を取得できません", "INVENTORY_CHECK")
            = "INVENTORY_DETECTION_FAILED"
        && FarmFailureCode("登録車両の探索に失敗", "OPENING_STORAGE")
            = "STORAGE_UI_NOT_FOUND"
        && FarmFailureCode("車両ストレージへ収納できません", "STORING")
            = "STORAGE_ACTION_FAILED"
        && FarmFailureCode("収納後の減少を確認できません", "VERIFY_STORAGE")
            = "STORAGE_VERIFY_FAILED"
        && FarmFailureCode("作業対象を確認できません", "FARMING")
            = "FARM_TARGET_LOST"
        && FarmFailureCode("作業位置へ安全に戻れません", "RESUMING_FARM")
            = "FARM_RESUME_FAILED"
        && FarmFailureCode("ERROR INPUT_RELEASE", "FARMING")
            = "INPUT_STUCK"
        && FarmFailureCode("実際の作業報酬を3回確認できません", "FARMING")
            = "WATCHDOG_TIMEOUT"
        && FarmFailureCode("dispatcher_unhandled_BROKEN", "BROKEN")
            = "UNKNOWN_STATE"
        && FarmFailureCode("サーバー再起動を検知", "FARMING")
            = "SERVER_SESSION_CHANGED"
        && FarmFailureCode("開始後の差分を特定できません", "INVENTORY_FULL",
            "", "UNTRUSTED_STORAGE_BASELINE")
            = "UNTRUSTED_STORAGE_BASELINE"
    ; This is the exact reservation/counting guard used immediately before the
    ; production deposit-delta call. Food/tool baseline units stay reserved while
    ; only the two newly mined ore units are eligible for vehicle storage.
    testProtectedInventoryBaseline :=
        "0001.food.e30=2,0002.tool.e30=1,0003.ore.e30=1"
    testInventoryAfterMining :=
        "0001.food.e30=2,0002.tool.e30=1,0003.ore.e30=3"
    testStorageDeltaSelectionOk := InventorySpecDeltaUnitCount(
        testInventoryAfterMining, testProtectedInventoryBaseline) = 2
        && StorageDeltaBaselineIsSafe(testProtectedInventoryBaseline,
            testInventoryAfterMining)
        && !StorageDeltaBaselineIsSafe("-", testInventoryAfterMining)
        && !StorageDeltaBaselineIsSafe(testProtectedInventoryBaseline,
            testProtectedInventoryBaseline)
    ; The production selector is stricter than the legacy run baseline above.
    ; Only exact name+metadata growth from a finalized reward enters the ledger;
    ; unrelated food acquired later is synthesized into the protected baseline.
    testLedgerBefore :=
        "0001.food.e30=2,0002.tool.e30=1,0003.ore.e30=1"
    testLedgerRewardAfter :=
        "0001.food.e30=2,0002.tool.e30=1,0003.ore.e30=3"
    ; Five unrelated food units and one same-exact-key ore unit arrive after the
    ; verified reward. Both must remain protected; the ledger still authorizes
    ; exactly the two reward units and never expands from later live growth.
    testLedgerCurrent :=
        "0001.food.e30=7,0002.tool.e30=1,0003.ore.e30=4"
    testLedger := NewExactInventoryCountMap()
    testLedgerAccumulated := AccumulateVerifiedFarmOutputLedger(testLedger,
        testLedgerBefore, testLedgerRewardAfter, &testLedgerAdded)
    testLedgerBaselineBuilt := BuildFarmOutputProtectedBaseline(
        testLedgerCurrent, testLedger, &testLedgerProtected,
        &testLedgerEligible, &testLedgerBaselineFailure)
    testLedgerCheckpoint := CreateStorageDepositCheckpoint(1, 1,
        testLedgerCurrent, testLedger)
    testLedgerPartial :=
        "0001.food.e30=7,0002.tool.e30=1,0003.ore.e30=3"
    testLedgerLate :=
        "0001.food.e30=7,0002.tool.e30=1,0003.ore.e30=2"
    testUnboundLedger := ClonePositiveInventoryCounts(testLedger)
    testUnboundCheckpoint := CreateStorageDepositCheckpoint(1, 99,
        testLedgerCurrent, testUnboundLedger)
    testUnboundReceiptFailsClosed := IsObject(testUnboundCheckpoint)
        && !ReconcileStorageDepositCheckpoint(testUnboundCheckpoint,
            testLedgerPartial, testUnboundLedger, &testUnboundApplied)
        && testUnboundApplied = 0
        && PositiveInventoryCountTotal(testUnboundLedger) = 2
    testPartialReceiptResult := "DEPOSITED 1 2 1 dHJ1bmsxMjM= "
        . "dHJ1bms= 123-7 PARTIAL_MOVE_REJECTED ore.e30=1"
    testPartialReceiptParsed := ParseVerifiedStorageDepositReceipt(
        testPartialReceiptResult, "dHJ1bmsxMjM=", "dHJ1bms=",
        &testPartialReceipt)
    testPartialReceiptBound := testPartialReceiptParsed
        && StorageDepositReceiptOperationMatches(testPartialReceipt, "123-7")
        && !StorageDepositReceiptOperationMatches(testPartialReceipt, "123-8")
        && BindStorageDepositReceipt(testLedgerCheckpoint,
            testPartialReceipt, testLedger, 2)
    testAmbiguousReceiptResult := "DEPOSITED 1 2 1 dHJ1bmsxMjM= "
        . "dHJ1bms= 123-amb PARTIAL_AMBIGUOUS_TRANSFER ore.e30=1"
    testAmbiguousReceiptRejected := ParseVerifiedStorageDepositReceipt(
        testAmbiguousReceiptResult, "dHJ1bmsxMjM=", "dHJ1bms=",
        &testAmbiguousReceipt)
        && !BindStorageDepositReceipt(testLedgerCheckpoint,
            testAmbiguousReceipt, testLedger, 2)
    testLedgerPartialOk := IsObject(testLedgerCheckpoint)
        && testPartialReceiptBound
        && ReconcileStorageDepositCheckpoint(testLedgerCheckpoint,
            testLedgerPartial, testLedger, &testLedgerPartialApplied)
        && testLedgerPartialApplied = 1
        && PositiveInventoryCountTotal(testLedger) = 1
        && StorageDepositCheckpointReceiptRemaining(testLedgerCheckpoint) = 0
        && ReconcileStorageDepositCheckpoint(testLedgerCheckpoint,
            testLedgerPartial, testLedger, &testLedgerDuplicateApplied)
        && testLedgerDuplicateApplied = 0
        && PositiveInventoryCountTotal(testLedger) = 1
    testLedgerRetryCheckpoint := CreateStorageDepositCheckpoint(1, 2,
        testLedgerPartial, testLedger)
    testRetryReceiptResult := "DEPOSITED 1 1 1 dHJ1bmsxMjM= "
        . "dHJ1bms= 123-8 COMPLETE ore.e30=1"
    testRetryReceiptOk := ParseVerifiedStorageDepositReceipt(
        testRetryReceiptResult, "dHJ1bmsxMjM=", "dHJ1bms=",
        &testRetryReceipt)
        && BindStorageDepositReceipt(testLedgerRetryCheckpoint,
            testRetryReceipt, testLedger, 1)
        && ReconcileStorageDepositCheckpoint(testLedgerRetryCheckpoint,
            testLedgerLate, testLedger, &testLedgerLateApplied)
        && testLedgerLateApplied = 1
        && PositiveInventoryCountTotal(testLedger) = 0
        && ReconcileStorageDepositCheckpoint(testLedgerRetryCheckpoint,
            testLedgerLate, testLedger, &testLedgerLateDuplicateApplied)
        && testLedgerLateDuplicateApplied = 0
        && !ParseVerifiedStorageDepositReceipt("DEPOSITED 1 1",
            "dHJ1bmsxMjM=", "dHJ1bms=", &testLegacyReceipt)
    testNoLedger := NewExactInventoryCountMap()
    testNoLedgerFailsClosed := !BuildFarmOutputProtectedBaseline(
        testLedgerCurrent, testNoLedger, &testNoLedgerBaseline,
        &testNoLedgerEligible, &testNoLedgerReason)
        && testNoLedgerReason = "empty_ledger"
    testMetadataMutationLedger := NewExactInventoryCountMap()
    testMetadataMutationOk := AccumulateVerifiedFarmOutputLedger(
        testMetadataMutationLedger, "0001.tool.e30=1",
        "0001.tool.eyJxIjoxfQ=1", &testMetadataMutationAdded)
        && testMetadataMutationAdded = 0
        && !FarmOutputLedgerHasPending(testMetadataMutationLedger)
    try FileAppend "VALIDATION_PHASE inventory-tests " A_TickCount "`n", "**", "UTF-8-RAW"
    testWashOutputLedger := NewExactInventoryCountMap()
    testWashOutputOnlyOk := AccumulateVerifiedFarmOutputLedger(
        testWashOutputLedger, "0001.raw_stone.e30=2",
        "0001.raw_stone.e30=1,0002.washed_stone.e30=1",
        &testWashOutputAdded)
        && testWashOutputAdded = 1
        && !testWashOutputLedger.Has("raw_stone.e30")
        && testWashOutputLedger.Has("washed_stone.e30")
        && testWashOutputLedger["washed_stone.e30"] = 1
    testFarmOutputLedgerOk := testLedgerAccumulated && testLedgerAdded = 2
        && testLedgerBaselineBuilt && testLedgerEligible = 2
        && IsObject(testLedgerCheckpoint)
        && testLedgerCheckpoint.authorizedSpec = "ore.e30=2"
        && testLedgerCheckpoint.authorizedUnits = 2
        && InventorySpecDeltaUnitCount(testLedgerCurrent,
            testLedgerProtected) = 2
        && InStr(testLedgerProtected, "0001.food.e30=7")
        && InStr(testLedgerProtected, "0003.ore.e30=2")
        && testUnboundReceiptFailsClosed && testAmbiguousReceiptRejected
        && testLedgerPartialOk
        && testRetryReceiptOk && testNoLedgerFailsClosed
        && testMetadataMutationOk && testWashOutputOnlyOk
    testStaleStorageCleanupGuardOk := StorageCycleCleanupAllowed(7, 7, true)
        && !StorageCycleCleanupAllowed(7, 8, true)
        && !StorageCycleCleanupAllowed(7, 7, false)
    testStopResetSource := []
    testStopResetOldId := "run_44_4_1893456002000"
    testStopResetMiningId := "mine_run_44_4_1893456002000_4_8"
    testStopResetEnqueueOk := MetagameOutboxEnqueue(&testStopResetSource,
        testStopResetOldId, 1893456002000, "SESSION_BEGIN")
        && MetagameOutboxEnqueue(&testStopResetSource,
            testStopResetMiningId, 1893456002500)
    testStopResetIncludeEnd := MetagameResetRequiresEnd(true, true,
        testStopResetSource, testStopResetOldId)
    testActiveResetStaysOpen := !MetagameResetRequiresEnd(true, false,
        testStopResetSource, testStopResetOldId)
    testStopResetRebased := testStopResetSource
    testStopResetNewId := "run_55_5_1893456003000_r1"
    testStopResetOk := testStopResetEnqueueOk && testStopResetIncludeEnd
        && testActiveResetStaysOpen
        && RebaseMetagameOutboxForSession(&testStopResetRebased,
            testStopResetNewId, 1893456003000, testStopResetIncludeEnd,
            1893456003001)
        && testStopResetRebased.Length = 3
        && testStopResetRebased[1].command = "SESSION_BEGIN"
        && testStopResetRebased[1].id = testStopResetNewId
        && testStopResetRebased[2].command = "MINING_SUCCESS"
        && testStopResetRebased[2].id = testStopResetMiningId
        && testStopResetRebased[3].command = "SESSION_END"
        && testStopResetRebased[3].id = testStopResetNewId
    testEndPendingSource := testStopResetSource
    testStopResetOk := testStopResetOk
        && MetagameOutboxEnqueue(&testEndPendingSource,
            testStopResetOldId, 1893456002600, "SESSION_END")
        && MetagameResetRequiresEnd(true, false, testEndPendingSource,
            testStopResetOldId)
    testGracefulTailOk := MetagameOutboxEndsWithSessionEnd(testEndPendingSource)
    testHardKillTail := []
    MetagameOutboxEnqueue(&testHardKillTail, testStopResetOldId,
        1893456002000, "SESSION_BEGIN")
    MetagameOutboxEnqueue(&testHardKillTail, testStopResetMiningId,
        1893456002500)
    testGracefulTailOk := testGracefulTailOk
        && !MetagameOutboxEndsWithSessionEnd(testHardKillTail)
    testCapacityDispatcherOk := FarmStateRequiresCapacityDispatch(
        "INVENTORY_CHECK", false)
        && FarmStateRequiresCapacityDispatch("STOPPING_FARM", true)
        && !FarmStateRequiresCapacityDispatch("STOPPING_FARM", false)
        && !FarmStateRequiresCapacityDispatch("FARMING", true)
    testLargeOutboxPath := A_Temp "\ai-miner-large-outbox-selftest-"
        . testRunId ".tsv"
    try FileDelete testLargeOutboxPath
    testLongIdSuffix := ""
    Loop 90
        testLongIdSuffix .= "x"
    testLargeOutbox := []
    Loop 4096 {
        testLargeOutbox.Push({command: "MINING_SUCCESS",
            id: "mine_backlog_" Format("{:04}", A_Index) "_"
                . testLongIdSuffix,
            at: 946684800000 + A_Index, retries: 0, nextAt: 0,
            windows: 0, enqueued: false})
    }
    testLargeOutboxOk := MetagameOutboxEnqueue(&testLargeOutbox,
        "mine_backlog_tail_" testLongIdSuffix, 946684900000)
        && testLargeOutbox.Length = 4097
        && PersistMetagameOutbox(testLargeOutbox, testLargeOutboxPath)
        && FileGetSize(testLargeOutboxPath) > 262144
    testLargeReload := testLargeOutboxOk
        ? LoadMetagameOutbox(testLargeOutboxPath) : []
    testLargeOutboxOk := testLargeOutboxOk
        && testLargeReload.Length = 4097
        && testLargeReload[4097].id = "mine_backlog_tail_" testLongIdSuffix
    try FileDelete testLargeOutboxPath
    testJournalPath := A_Temp "\ai-miner-journal-selftest-" testRunId ".tsv"
    try FileDelete testJournalPath
    savedMetaOutbox := State.metagameOutbox
    savedMetaPath := State.metagameOutboxPath
    savedMetaDirty := State.metagameOutboxDirty
    savedJournalReady := State.metagameJournalReady
    savedJournalOps := State.metagameJournalOps
    savedRewardWalPath := State.verifiedRewardWalPath
    savedRewardWalPending := State.verifiedRewardWalPending
    savedRewardWalOps := State.verifiedRewardWalOps
    savedRewardWalReady := State.verifiedRewardWalReady
    savedReplayNormalized := State.metagameReplayNormalized
    savedFarmSessionId := State.farmSessionId
    savedFarmSessionStartedAt := State.farmSessionStartedAt
    savedFarmSessionEndedAt := State.farmSessionEndedAt
    savedFarmSessionBeginQueued := State.farmSessionBeginQueued
    savedFarmSessionBeginSent := State.farmSessionBeginSent
    savedFarmSessionEndQueued := State.farmSessionEndQueued
    savedFarmSessionEndSent := State.farmSessionEndSent
    savedRunning := State.running
    savedStopInProgress := State.stopInProgress
    savedGeneration := State.generation
    savedRunMode := State.runMode
    savedLastMiningEventId := State.lastMiningEventId
    State.metagameOutbox := []
    State.metagameOutboxPath := testJournalPath
    State.metagameOutboxDirty := false
    State.metagameJournalReady := false
    State.metagameJournalOps := 0
    testJournalSession := "run_66_6_1893456004000"
    testJournalFirst := "mine_run_66_6_1893456004000_1_1"
    testJournalSecond := "mine_run_66_6_1893456004000_2_2"
    testJournalOk := DurablyEnqueueMetagameEvent("SESSION_BEGIN",
        testJournalSession, 1893456004000)
        && DurablyEnqueueMetagameEvent("MINING_SUCCESS",
            testJournalFirst, 946684801000)
        && DurablyEnqueueMetagameEvent("MINING_SUCCESS",
            testJournalSecond, 946684802000)
        && AcknowledgeMetagameEvent("SESSION_BEGIN", testJournalSession)
    SetTimer FlushMetagameOutboxReplay, 0
    testJournalReload := testJournalOk
        ? LoadMetagameOutbox(testJournalPath) : []
    testJournalCrashReloadOk := testJournalOk && testJournalReload.Length = 2
        && testJournalReload[1].id = testJournalFirst
        && testJournalReload[1].at = 946684801000
        && testJournalReload[2].id = testJournalSecond
    testJournalLastId := ""
    Loop 252 {
        testJournalLastId := "mine_journal_compact_"
            . Format("{:04}", A_Index) "_stable"
        if !DurablyEnqueueMetagameEvent("MINING_SUCCESS",
            testJournalLastId, 946684802000 + A_Index) {
            testJournalOk := false
            break
        }
    }
    testJournalOk := testJournalOk && AcknowledgeMetagameEvent(
        "MINING_SUCCESS", testJournalFirst)
    SetTimer FlushMetagameOutboxReplay, 0
    testJournalCompacted := testJournalOk
        ? LoadMetagameOutbox(testJournalPath) : []
    testJournalOk := testJournalOk && testJournalCrashReloadOk
        && State.metagameJournalOps = 0
        && testJournalCompacted.Length = 253
        && testJournalCompacted[1].id = testJournalSecond
        && testJournalCompacted[1].at = 946684802000
        && testJournalCompacted[253].id = testJournalLastId
    SetTimer FlushMetagameOutboxReplay, 0

    ; Force the exact historical race: an ACK/compact timer becomes due after E
    ; was flushed but before the enqueue's memory Push. It must run only after the
    ; transaction commits, observe both entries, and compact the new mining row.
    testInterleavePath := A_Temp "\ai-miner-interleave-selftest-"
        . testRunId ".tsv"
    try FileDelete testInterleavePath
    State.metagameOutbox := []
    State.metagameOutboxPath := testInterleavePath
    State.metagameOutboxDirty := false
    State.metagameJournalReady := false
    State.metagameJournalOps := 0
    testInterleaveSession := "run_99_9_1893456006000"
    testInterleaveMining := "mine_run_99_9_1893456006000_1_1"
    MetagameInterleaveAckCommand := "SESSION_BEGIN"
    MetagameInterleaveAckId := testInterleaveSession
    MetagameInterleaveAckOk := false
    MetagameInterleaveAckSawCount := 0
    MetagameInterleaveTimerRan := false
    MetagameInterleaveTimerRanInside := false
    testInterleaveOk := DurablyEnqueueMetagameEvent("SESSION_BEGIN",
        testInterleaveSession, 1893456006000)
    ; The deferred ACK must cross the compaction threshold when it finally runs.
    State.metagameJournalOps := 255
    testInterleaveOk := testInterleaveOk
        && DurablyEnqueueMetagameEvent("MINING_SUCCESS",
            testInterleaveMining, 1893456006500,
            ScheduleMetagameInterleaveSelfTestAck)
    Sleep 80
    SetTimer RunMetagameInterleaveSelfTestAck, 0
    SetTimer FlushMetagameOutboxReplay, 0
    testInterleaveReload := testInterleaveOk
        ? LoadMetagameOutbox(testInterleavePath) : []
    testInterleaveOk := testInterleaveOk
        && !MetagameInterleaveTimerRanInside
        && MetagameInterleaveTimerRan
        && MetagameInterleaveAckOk
        && MetagameInterleaveAckSawCount = 2
        && State.metagameOutbox.Length = 1
        && State.metagameOutbox[1].id = testInterleaveMining
        && State.metagameJournalOps = 0
        && testInterleaveReload.Length = 1
        && testInterleaveReload[1].id = testInterleaveMining
    try FileDelete testInterleavePath

    ; The same exclusion must cover reset's stale-copy boundary. A mining enqueue
    ; timer due after rebase but before persist may run only after reset installs
    ; the new FIFO/session, so both the retained and new rewards remain durable.
    testResetInterleavePath := A_Temp
        . "\ai-miner-reset-interleave-selftest-" testRunId ".tsv"
    try FileDelete testResetInterleavePath
    State.metagameOutbox := []
    State.metagameOutboxPath := testResetInterleavePath
    State.metagameOutboxDirty := false
    State.metagameJournalReady := false
    State.metagameJournalOps := 0
    State.metagameReplayNormalized := true
    State.running := true
    State.stopInProgress := false
    State.farmSessionId := "run_101_10_1893456007000"
    State.farmSessionStartedAt := 1893456007000
    State.farmSessionEndedAt := 0
    State.farmSessionBeginQueued := true
    State.farmSessionBeginSent := false
    State.farmSessionEndQueued := false
    State.farmSessionEndSent := false
    State.metagameSessionResetCount := 0
    testResetRetainedMining := "mine_run_101_10_1893456007000_1_1"
    MetagameResetInterleaveMiningId :=
        "mine_run_101_10_1893456007000_2_2"
    MetagameResetCriticalObserved := false
    MetagameResetTimerRan := false
    MetagameResetTimerRanInside := false
    MetagameResetInterleaveEnqueueOk := false
    MetagameResetInterleaveSawSession := ""
    testResetInterleaveOk := DurablyEnqueueMetagameEvent("SESSION_BEGIN",
        State.farmSessionId, State.farmSessionStartedAt)
        && DurablyEnqueueMetagameEvent("MINING_SUCCESS",
            testResetRetainedMining, 1893456007250)
        && ResetFarmMetagameSession("selftest_interleave",
            ProbeMetagameResetCriticalSelfTest)
    Sleep 80
    SetTimer RunMetagameResetInterleaveSelfTestEnqueue, 0
    SetTimer FlushMetagameOutboxReplay, 0
    testResetInterleaveReload := testResetInterleaveOk
        ? LoadMetagameOutbox(testResetInterleavePath) : []
    testResetInterleaveOk := testResetInterleaveOk
        && MetagameResetCriticalObserved
        && !MetagameResetTimerRanInside
        && MetagameResetTimerRan
        && MetagameResetInterleaveEnqueueOk
        && MetagameResetInterleaveSawSession = State.farmSessionId
        && State.farmSessionId != "run_101_10_1893456007000"
        && State.metagameOutbox.Length = 3
        && State.metagameOutbox[1].command = "SESSION_BEGIN"
        && State.metagameOutbox[1].id = State.farmSessionId
        && State.metagameOutbox[2].id = testResetRetainedMining
        && State.metagameOutbox[3].id = MetagameResetInterleaveMiningId
        && testResetInterleaveReload.Length = 3
        && testResetInterleaveReload[2].id = testResetRetainedMining
        && testResetInterleaveReload[3].id = MetagameResetInterleaveMiningId
    State.running := false
    State.stopInProgress := false
    try FileDelete testResetInterleavePath

    testAppendFailureOutbox := []
    TryParseMetagameOutboxFields("MINING_SUCCESS",
        "mine_append_failure_stable", 946684803000,
        &testAppendFailureEntry)
    testAppendFailureOk := !CommitDurableMetagameEntry(
        testAppendFailureOutbox, testAppendFailureEntry, false)
        && testAppendFailureOutbox.Length = 0
        && !FlushMetagameFileHandle(0)
    testTornPath := A_Temp "\ai-miner-torn-journal-selftest-"
        . testRunId ".tsv"
    try FileDelete testTornPath
    State.metagameOutbox := []
    State.metagameOutboxPath := testTornPath
    State.metagameOutboxDirty := false
    State.metagameJournalReady := false
    State.metagameJournalOps := 0
    testTornOk := PersistMetagameOutboxWithRetry()
    tornFile := FileOpen(testTornPath, "a", "UTF-8-RAW")
    tornFile.Write("E`tMINING_SUCCESS`tmine_torn_partial")
    FlushMetagameFileHandle(tornFile.Handle)
    tornFile.Close()
    testTornId := "mine_after_torn_tail_stable"
    testTornOk := testTornOk && DurablyEnqueueMetagameEvent(
        "MINING_SUCCESS", testTornId, 946684804000)
    testTornReload := testTornOk ? LoadMetagameOutbox(testTornPath) : []
    testTornOk := testTornOk && testTornReload.Length = 1
        && testTornReload[1].id = testTornId
        && testTornReload[1].at = 946684804000

    ; Simulate a disk failure after BEGIN was already ACKed by the Host. END must
    ; retain one immutable timestamp, block the next start, then append exactly
    ; once when the idle retry gets a writable journal.
    testEndBlockerPath := A_Temp "\ai-miner-end-blocker-selftest-" testRunId
    testEndRetryPath := A_Temp "\ai-miner-end-retry-selftest-" testRunId ".tsv"
    try FileDelete testEndRetryPath
    try FileDelete testEndBlockerPath
    blockerFile := FileOpen(testEndBlockerPath, "w", "UTF-8-RAW")
    blockerFile.Write("not-a-directory")
    blockerFile.Close()
    State.metagameOutbox := []
    State.metagameOutboxPath := testEndBlockerPath "\outbox.tsv"
    State.metagameOutboxDirty := false
    State.metagameJournalReady := false
    State.metagameJournalOps := 0
    State.metagameReplayNormalized := true
    State.running := false
    State.farmSessionId := "run_77_7_1893456005000"
    State.farmSessionStartedAt := 1893456005000
    State.farmSessionEndedAt := 0
    State.farmSessionBeginQueued := true
    State.farmSessionBeginSent := true
    State.farmSessionEndQueued := false
    State.farmSessionEndSent := false
    testInitialEndFailure := !EndFarmMetagameSession(false)
    testCapturedEndedAt := State.farmSessionEndedAt
    SetTimer FlushMetagameOutboxReplay, 0
    testEndRetryOk := testInitialEndFailure
        && !PrepareMetagameForNewFarmStart()
        && FarmMetagameClosurePending()
        && State.metagameOutbox.Length = 0
        && State.farmSessionId = "run_77_7_1893456005000"
        && testCapturedEndedAt >= State.farmSessionStartedAt
        && State.farmSessionEndedAt = testCapturedEndedAt
    SetTimer FlushMetagameOutboxReplay, 0
    State.metagameOutboxPath := testEndRetryPath
    State.metagameJournalReady := false
    testEndRetryOk := testEndRetryOk && PrepareMetagameForNewFarmStart()
        && !FarmMetagameClosurePending()
        && State.metagameOutbox.Length = 1
        && State.metagameOutbox[1].command = "SESSION_END"
        && State.metagameOutbox[1].id = "run_77_7_1893456005000"
        && State.metagameOutbox[1].at = testCapturedEndedAt
    testEndRetryReload := testEndRetryOk
        ? LoadMetagameOutbox(testEndRetryPath) : []
    testEndRetryOk := testEndRetryOk && testEndRetryReload.Length = 1
        && testEndRetryReload[1].command = "SESSION_END"
        && testEndRetryReload[1].at = testCapturedEndedAt
    SetTimer FlushMetagameOutboxReplay, 0
    try FileDelete testEndRetryPath
    try FileDelete testEndBlockerPath

    ; A graceful offline FIFO keeps its original session duration. In contrast,
    ; a hard-kill FIFO whose tail lacks END is the only shape normalized later.
    testGracefulReplayPath := A_Temp
        . "\ai-miner-graceful-replay-selftest-" testRunId ".tsv"
    try FileDelete testGracefulReplayPath
    testGracefulOutbox := []
    State.metagameOutboxPath := testGracefulReplayPath
    State.metagameOutboxDirty := false
    State.metagameJournalReady := false
    MetagameOutboxEnqueue(&testGracefulOutbox,
        "run_88_8_946684800000", 946684800000, "SESSION_BEGIN")
    MetagameOutboxEnqueue(&testGracefulOutbox,
        "mine_run_88_8_946684800000_1_1", 946684801000)
    MetagameOutboxEnqueue(&testGracefulOutbox,
        "run_88_8_946684800000", 946684809000, "SESSION_END")
    State.metagameOutbox := testGracefulOutbox
    testGracefulReplayOk := PersistMetagameOutboxWithRetry()
        && NormalizeStoppedMetagameOutboxAtStartup()
        && State.metagameOutbox.Length = 3
        && State.metagameOutbox[1].at = 946684800000
        && State.metagameOutbox[2].at = 946684801000
        && State.metagameOutbox[3].at = 946684809000
        && State.metagameOutbox[3].command = "SESSION_END"
    testGracefulReplayReload := testGracefulReplayOk
        ? LoadMetagameOutbox(testGracefulReplayPath) : []
    testGracefulReplayOk := testGracefulReplayOk
        && testGracefulReplayReload.Length = 3
        && testGracefulReplayReload[1].id = "run_88_8_946684800000"
        && testGracefulReplayReload[3].at = 946684809000
    ; A backwards Windows clock correction must preserve IDs/order while making
    ; every replay timestamp acceptable to the Host's future-skew guard.
    testFutureClampAt := 1893456000000
    testFutureSession := "run_88_8_1893456010000"
    testFutureReward := "mine_run_88_8_1893456010000_gold_2_3"
    testFutureOutbox := []
    testGracefulReplayOk := testGracefulReplayOk
        && MetagameOutboxEnqueue(&testFutureOutbox, testFutureSession,
            testFutureClampAt + 10000, "SESSION_BEGIN")
        && MetagameOutboxEnqueue(&testFutureOutbox, testFutureReward,
            testFutureClampAt + 11000)
        && MetagameOutboxEnqueue(&testFutureOutbox, testFutureSession,
            testFutureClampAt + 12000, "SESSION_END")
    testRuntimeFutureClampOk := BuildClampedMetagameReplayOutbox(
        testFutureOutbox, testFutureClampAt, &testFutureCandidate,
        &testFutureChanged)
        && testFutureChanged = 3
        && testFutureOutbox[1].at = testFutureClampAt + 10000
        && testFutureOutbox[2].at = testFutureClampAt + 11000
        && testFutureCandidate[1].id = testFutureSession
        && testFutureCandidate[2].id = testFutureReward
        && testFutureCandidate[1].at = testFutureClampAt
        && testFutureCandidate[2].at = testFutureClampAt
        && testFutureCandidate[3].at = testFutureClampAt
    State.metagameOutbox := testFutureOutbox
    State.metagameJournalReady := false
    testRuntimeFutureClampOk := testRuntimeFutureClampOk
        && PersistMetagameOutboxWithRetry()
        && PersistRuntimeMetagameFutureClamp(testFutureClampAt)
    testFutureReload := testRuntimeFutureClampOk
        ? LoadMetagameOutbox(testGracefulReplayPath) : []
    testRuntimeFutureClampOk := testRuntimeFutureClampOk
        && testFutureReload.Length = 3
        && testFutureReload[1].id = testFutureSession
        && testFutureReload[2].id = testFutureReward
        && testFutureReload[1].at = testFutureClampAt
        && testFutureReload[2].at = testFutureClampAt
        && testFutureReload[3].at = testFutureClampAt
    ; Startup uses the same candidate builder and must retain the same guarantees.
    State.metagameOutbox := testFutureOutbox
    State.metagameJournalReady := false
    testGracefulReplayOk := testGracefulReplayOk
        && PersistMetagameOutboxWithRetry()
        && NormalizeStoppedMetagameOutboxAtStartup(testFutureClampAt)
        && State.metagameOutbox[1].id = testFutureSession
        && State.metagameOutbox[2].id = testFutureReward
        && State.metagameOutbox[1].at = testFutureClampAt
        && State.metagameOutbox[3].at = testFutureClampAt
    try FileDelete testGracefulReplayPath

    ; A confirmed reward may not advance visible state before its event is durable.
    ; Force SESSION_BEGIN persistence to fail, restore a writable journal, retry the
    ; same stable mode-aware ID, and simulate a restart/retry without duplication.
    testRewardBlockerPath := A_Temp
        . "\ai-miner-reward-blocker-selftest-" testRunId
    testRewardRetryPath := A_Temp
        . "\ai-miner-reward-retry-selftest-" testRunId ".tsv"
    testRewardWalPath := A_Temp
        . "\ai-miner-reward-wal-selftest-" testRunId ".tsv"
    try FileDelete testRewardRetryPath
    try FileDelete testRewardWalPath
    try FileDelete testRewardBlockerPath
    blockerFile := FileOpen(testRewardBlockerPath, "w", "UTF-8-RAW")
    blockerFile.Write("not-a-directory")
    blockerFile.Close()
    State.metagameOutbox := []
    State.metagameOutboxPath := testRewardBlockerPath "\outbox.tsv"
    State.metagameOutboxDirty := false
    State.metagameJournalReady := false
    State.metagameJournalOps := 0
    State.verifiedRewardWalPath := testRewardWalPath
    State.verifiedRewardWalPending := Map()
    State.verifiedRewardWalOps := 0
    State.verifiedRewardWalReady := true
    State.metagameReplayNormalized := true
    State.running := true
    State.stopInProgress := false
    State.generation := 191
    State.runMode := "washing"
    testRewardStartedAt := UnixTimeMilliseconds()
    State.farmSessionId := BuildFarmSessionId(191, 191,
        testRewardStartedAt)
    State.farmSessionStartedAt := testRewardStartedAt
    State.farmSessionEndedAt := 0
    State.farmSessionBeginQueued := false
    State.farmSessionBeginSent := false
    State.farmSessionEndQueued := false
    State.farmSessionEndSent := false
    State.lastMiningEventId := ""
    testRewardFrozenSessionId := State.farmSessionId
    testRewardEventId := BuildFarmRewardEventId(testRewardFrozenSessionId,
        "washing", 5, 17)
    testRewardCompletedAt := testRewardStartedAt + 25
    testRewardRetryOk := !EmitVerifiedFarmReward(191, "washing", 5, 17,
        testRewardCompletedAt, testRewardEventId, testRewardFrozenSessionId)
        && State.metagameOutbox.Length = 0
        && State.verifiedRewardWalPending.Count = 1
    ; Simulate termination at the exact WAL -> outbox failure boundary. A fresh
    ; process must atomically restore BEGIN + reward + END and tombstone the intent.
    State.metagameOutboxPath := testRewardRetryPath
    State.metagameJournalReady := false
    try FileAppend "VALIDATION_PHASE reward-wal " A_TickCount "`n", "**", "UTF-8-RAW"
    testRewardReloadedWalOk := LoadVerifiedRewardWal(testRewardWalPath,
        &testRewardReloadedPending, &testRewardReloadedOps)
    State.verifiedRewardWalPending := testRewardReloadedPending
    State.verifiedRewardWalOps := testRewardReloadedOps
    RewardWalRecoveryCriticalObserved := false
    RewardWalRecoveryTimerRan := false
    RewardWalRecoveryTimerRanInside := false
    testRewardRetryOk := testRewardRetryOk && testRewardReloadedWalOk
        && State.verifiedRewardWalPending.Count = 1
        && RecoverVerifiedRewardWal(ProbeRewardWalRecoveryCriticalSelfTest)
        && State.verifiedRewardWalPending.Count = 0
    ; A meta.reset may install a new active envelope after the reward was frozen.
    ; Stable-ID validation must use the attempt's immutable session, not this S2.
    State.farmSessionId := BuildFarmSessionId(191, 191,
        testRewardStartedAt + 10, 1)
    State.farmSessionStartedAt := testRewardStartedAt + 10
    State.farmSessionBeginQueued := false
    State.farmSessionBeginSent := false
    State.farmSessionEndQueued := false
    State.farmSessionEndSent := false
    testRewardRetryOk := testRewardRetryOk
        && EmitVerifiedFarmReward(191, "washing", 5, 17,
            testRewardCompletedAt + 86400000, testRewardEventId,
            testRewardFrozenSessionId)
    ; A heavily loaded release build can delay a one-shot timer beyond 80 ms even
    ; though it was correctly held outside the Critical WAL section. Wait for the
    ; observable post-critical callback. A busy game machine may postpone the
    ; timer beyond one second, so keep a bounded three-second liveness ceiling.
    Loop 120 {
        if RewardWalRecoveryTimerRan
            break
        Sleep 25
    }
    SetTimer RunRewardWalRecoveryCriticalSelfTestTimer, 0
    testRewardRetryOk := testRewardRetryOk
        && RewardWalRecoveryCriticalObserved
        && !RewardWalRecoveryTimerRanInside
        && RewardWalRecoveryTimerRan
    SetTimer FlushMetagameOutboxReplay, 0
    testRewardReload := testRewardRetryOk
        ? LoadMetagameOutbox(testRewardRetryPath) : []
    testRewardSuccessCount := 0
    for entry in testRewardReload {
        if entry.command = "MINING_SUCCESS"
            testRewardSuccessCount += 1
    }
    ; Reloaded FIFO is the restart boundary; retrying the same completed reward
    ; sees its durable row and cannot append a second copy.
    State.metagameOutbox := testRewardReload
    State.metagameJournalReady := false
    testRewardRetryOk := testRewardRetryOk
        && testRewardReload.Length = 3
        && testRewardReload[1].command = "SESSION_BEGIN"
        && InStr(testRewardReload[1].id, "reward_wal_recovery_") = 1
        && testRewardReload[2].command = "MINING_SUCCESS"
        && testRewardReload[2].id = testRewardEventId
        && testRewardReload[2].at = testRewardCompletedAt
        && testRewardReload[3].command = "SESSION_END"
        && testRewardReload[3].id = testRewardReload[1].id
        && testRewardSuccessCount = 1
        && EmitVerifiedFarmReward(191, "washing", 5, 17,
            testRewardCompletedAt + 172800000, testRewardEventId,
            testRewardFrozenSessionId)
        && State.metagameOutbox.Length = 3
    ; A torn append is isolated on its own row; the next valid E/A pair must load.
    tornWalFile := FileOpen(testRewardWalPath, "a", "UTF-8-RAW")
    if IsObject(tornWalFile) {
        tornWalFile.Write("`nE`ttruncated_reward")
        FlushMetagameFileHandle(tornWalFile.Handle)
        tornWalFile.Close()
    } else
        testRewardRetryOk := false
    testTornRewardId := "mine_run_191_191_" testRewardStartedAt
        . "_gold_6_18"
    testRewardRetryOk := testRewardRetryOk
        && PersistVerifiedRewardIntent(testTornRewardId, "gold", 18,
            testRewardCompletedAt + 1, &testTornPersistedAt)
        && LoadVerifiedRewardWal(testRewardWalPath,
            &testTornWalPending, &testTornWalOps)
        && testTornWalPending.Has(testTornRewardId)
        && CommitVerifiedRewardIntent(testTornRewardId)
        && LoadVerifiedRewardWal(testRewardWalPath,
            &testTornWalResolved, &testTornWalResolvedOps)
        && !testTornWalResolved.Has(testTornRewardId)
    ; Same-process F9 -> F8 preparation recovers unresolved WAL work before the
    ; next run can reset diagnostics or issue another Farm action.
    testRestartRewardId := "mine_run_191_191_" testRewardStartedAt
        . "_mining_7_19"
    testRestartFutureAt := testRewardCompletedAt + 86400000
    testRewardRetryOk := testRewardRetryOk
        && PersistVerifiedRewardIntent(testRestartRewardId, "mining", 19,
            testRestartFutureAt, &testRestartPersistedAt)
        && State.verifiedRewardWalPending.Count = 1
        && PrepareMetagameForNewFarmStart()
        && State.verifiedRewardWalPending.Count = 0
        && MetagameOutboxContainsCommand(State.metagameOutbox,
            "MINING_SUCCESS", testRestartRewardId)
    testRestartReplayAt := 0
    for queued in State.metagameOutbox {
        if queued.command = "MINING_SUCCESS"
            && queued.id = testRestartRewardId {
            testRestartReplayAt := queued.at
            break
        }
    }
    testRewardRetryOk := testRewardRetryOk && testRestartReplayAt >= 1
        && testRestartReplayAt < testRestartFutureAt
        && testRestartReplayAt <= UnixTimeMilliseconds()
    SetTimer FlushMetagameOutboxReplay, 0
    try FileDelete testRewardRetryPath
    try FileDelete testRewardWalPath
    try FileDelete testRewardBlockerPath

    State.metagameOutbox := savedMetaOutbox
    State.metagameOutboxPath := savedMetaPath
    State.metagameOutboxDirty := savedMetaDirty
    State.metagameJournalReady := savedJournalReady
    State.metagameJournalOps := savedJournalOps
    State.verifiedRewardWalPath := savedRewardWalPath
    State.verifiedRewardWalPending := savedRewardWalPending
    State.verifiedRewardWalOps := savedRewardWalOps
    State.verifiedRewardWalReady := savedRewardWalReady
    State.metagameReplayNormalized := savedReplayNormalized
    State.farmSessionId := savedFarmSessionId
    State.farmSessionStartedAt := savedFarmSessionStartedAt
    State.farmSessionEndedAt := savedFarmSessionEndedAt
    State.farmSessionBeginQueued := savedFarmSessionBeginQueued
    State.farmSessionBeginSent := savedFarmSessionBeginSent
    State.farmSessionEndQueued := savedFarmSessionEndQueued
    State.farmSessionEndSent := savedFarmSessionEndSent
    State.running := savedRunning
    State.stopInProgress := savedStopInProgress
    State.generation := savedGeneration
    State.runMode := savedRunMode
    State.lastMiningEventId := savedLastMiningEventId
    try FileDelete testJournalPath
    try FileDelete testTornPath
    testLegacyOutboxPath := A_Temp "\ai-miner-v2-outbox-selftest-"
        . testRunId ".tsv"
    try FileDelete testLegacyOutboxPath
    legacyFile := FileOpen(testLegacyOutboxPath, "w", "UTF-8-RAW")
    legacyFile.Write("AIUIMETAOUTBOX2`nMINING_SUCCESS`t"
        testOutboxFirstId "`t946684801000`n")
    legacyFile.Close()
    testLegacyOutbox := LoadMetagameOutbox(testLegacyOutboxPath)
    testLegacyMigrationOk := testLegacyOutbox.Length = 1
        && testLegacyOutbox[1].id = testOutboxFirstId
        && testLegacyOutbox[1].at = 946684801000
        && PersistMetagameOutbox(testLegacyOutbox, testLegacyOutboxPath)
    testMigratedOutbox := testLegacyMigrationOk
        ? LoadMetagameOutbox(testLegacyOutboxPath) : []
    testLegacyMigrationOk := testLegacyMigrationOk
        && testMigratedOutbox.Length = 1
        && testMigratedOutbox[1].id = testOutboxFirstId
        && testMigratedOutbox[1].at = 946684801000
    try FileDelete testLegacyOutboxPath
    try FileDelete testOutboxPath
    testModeSessionId := BuildFarmSessionId(71, 8, 1893456008000)
    testMiningModeId := BuildFarmRewardEventId(testModeSessionId, "mining", 4, 9)
    testWashingModeId := BuildFarmRewardEventId(testModeSessionId, "washing", 4, 9)
    testGoldModeId := BuildFarmRewardEventId(testModeSessionId, "gold", 4, 9)
    testFarmModeIdsOk := IsSupportedStoneActivityMode("mining")
        && IsSupportedStoneActivityMode("washing")
        && IsSupportedStoneActivityMode("gold")
        && !IsSupportedStoneActivityMode("storage")
        && testMiningModeId != testWashingModeId
        && testWashingModeId != testGoldModeId
        && testMiningModeId != testGoldModeId
        && BuildFarmRewardEventId(testModeSessionId, "storage", 4, 9) = ""
    testAckedMiningId := "mine_run_71_8_1893456008000_1_7"
    testPendingMiningId := "mine_run_71_8_1893456008000_4_11"
    testHistoryFixture := "2026-09-10 12:00:00.000 | AI採掘機 v9.0.1 診断開始`n"
        . "2026-09-10 12:00:01.000 | FARM_REWARD_CONFIRMED id=1 mode=mining reason=weight_increase beforeWeight=1000 afterWeight=2000 revision=7`n"
        . "2026-09-10 12:00:01.010 | METAGAME command=MINING_SUCCESS id="
        . testAckedMiningId . " sent=1`n"
        . "2026-09-10 12:00:01.020 | METAGAME_ACK command=MINING_SUCCESS id="
        . testAckedMiningId . " remaining=0`n"
        . "2026-09-10 12:00:02.000 | FARM_REWARD_CONFIRMED id=2 mode=washing reason=weight_increase beforeWeight=2000 afterWeight=3000 revision=8`n"
        . "2026-09-10 12:00:02.010 | ACTION_PROGRESS_DONE mode=washing elapsed=9000`n"
        . "2026-09-10 12:00:02.020 | BG_CLICKED mode=washing`n"
        . "2026-09-10 12:00:03.000 | FARM_REWARD_CONFIRMED id=3 mode=gold reason=item_increase beforeWeight=3000 afterWeight=3000 revision=9`n"
        . "2026-09-10 12:00:04.000 | FARM_REWARD_CONFIRMED id=4 mode=mining reason=weight_increase beforeWeight=3000 afterWeight=4000 revision=11`n"
        . "2026-09-10 12:00:04.010 | METAGAME command=MINING_SUCCESS id="
        . testPendingMiningId . " sent=0`n"
    testHistoryParsed := ParseLegacyFarmHistoryContents([testHistoryFixture],
        &testHistoryRecords)
    testHistoryParserOk := testHistoryParsed && testHistoryRecords.Length = 4
        && testHistoryRecords[1].acknowledged
        && testHistoryRecords[1].exactEventId = testAckedMiningId
        && testHistoryRecords[2].mode = "washing"
        && testHistoryRecords[3].mode = "gold"
        && !testHistoryRecords[4].acknowledged
        && testHistoryRecords[4].exactEventId = testPendingMiningId
    testHistoryStrictOk := !ParseVerifiedFarmRewardDiagnosticLine(
        "2026-09-10 12:00:05.000 | ACTION_PROGRESS_DONE mode=gold elapsed=6000",
        &testRejectedRecord)
        && !ParseVerifiedFarmRewardDiagnosticLine(
            "2026-09-10 12:00:05.000 | BG_CLICKED mode=gold", &testRejectedRecord)
        && !ParseVerifiedFarmRewardDiagnosticLine(
            "2026-09-10 12:00:05.000 | FARM_REWARD_CONFIRMED id=5 mode=storage reason=weight_increase beforeWeight=1 afterWeight=2 revision=12",
            &testRejectedRecord)
        && ParseVerifiedFarmRewardDiagnosticLine(
            "2026-09-10 12:00:05.000 | FARM_REWARD_CONFIRMED id=5 mode=washing reason=wash_exchange_raw_1_output_2 beforeWeight=2 afterWeight=1 revision=12",
            &testWashExchangeRecord)
        && !ParseVerifiedFarmRewardDiagnosticLine(
            "2026-09-10 12:00:05.000 | FARM_REWARD_CONFIRMED id=5 mode=washing reason=wash_exchange_raw_0_output_2 beforeWeight=2 afterWeight=1 revision=12",
            &testRejectedRecord)
    testCurrentHistoryId := "mine_run_71_8_1893456008000_washing_5_12"
    testCurrentHistoryFixture := "2026-09-10 12:30:00.000 | AI採掘機 v9.0.2 診断開始`n"
        . "2026-09-10 12:30:01.000 | FARM_REWARD_CONFIRMED id=5 mode=washing reason=weight_increase beforeWeight=1 afterWeight=2 revision=12 eventId="
        . testCurrentHistoryId . " eventAt=1893456008000`n"
    testCurrentHistoryParsed := ParseLegacyFarmHistoryContents(
        [testCurrentHistoryFixture], &testCurrentHistoryRecords)
    testTornCurrentHistory := "2026-09-10 12:31:00.000 | AI採掘機 v9.0.2 診断開始`n"
        . "2026-09-10 12:31:01.000 | FARM_REWARD_CONFIRMED id=5 mode=washing reason=weight_increase beforeWeight=1 afterWeight=2 revision=12`n"
    testTornCurrentParsed := ParseLegacyFarmHistoryContents(
        [testTornCurrentHistory], &testTornCurrentRecords)
    testDuplicateReward := "2026-09-10 12:40:01.000 | FARM_REWARD_CONFIRMED id=1 mode=mining reason=weight_increase beforeWeight=1 afterWeight=2 revision=7`n"
    testDuplicateSupport := "2026-09-10 12:40:00.000 | AI採掘機 v9.0.1 診断開始`n"
        . testDuplicateReward
    testDuplicateNormal := "2026-09-10 12:40:00.000 | AI採掘機 v9.0.1 診断開始`n"
        . testDuplicateReward
        . "2026-09-10 12:40:01.020 | METAGAME_ACK command=MINING_SUCCESS id="
        . testAckedMiningId . " remaining=0`n"
    testDuplicateParsed := ParseLegacyFarmHistoryContents(
        [{content: testDuplicateSupport, support: true},
            {content: testDuplicateNormal, support: false}],
        &testDuplicateRecords)
    testHistoryStrictOk := testHistoryStrictOk
        && testCurrentHistoryParsed && testCurrentHistoryRecords.Length = 1
        && testCurrentHistoryRecords[1].exactEventId = testCurrentHistoryId
        && testCurrentHistoryRecords[1].mode = "washing"
        && testTornCurrentParsed && testTornCurrentRecords.Length = 0
        && testDuplicateParsed && testDuplicateRecords.Length = 1
        && testDuplicateRecords[1].acknowledged
        && testDuplicateRecords[1].exactEventId = testAckedMiningId
        && testDuplicateRecords[1].supportSource
        && testDuplicateRecords[1].normalSource
    testSegmentFixture := "2026-09-10 13:00:00.000 | AI採掘機 v9.0.1 診断開始`n"
        . "2026-09-10 13:00:01.000 | FARM_REWARD_CONFIRMED id=1 mode=mining reason=weight_increase beforeWeight=1 afterWeight=2 revision=7`n"
        . "2026-09-10 13:00:01.010 | METAGAME_ACK command=MINING_SUCCESS id="
        . testAckedMiningId . " remaining=0`n"
        . "2026-09-10 14:00:00.000 | AI採掘機 v9.0.1 診断開始`n"
        . "2026-09-10 14:00:01.000 | FARM_REWARD_CONFIRMED id=1 mode=mining reason=weight_increase beforeWeight=1 afterWeight=2 revision=7`n"
    testSegmentParsed := ParseLegacyFarmHistoryContents([testSegmentFixture],
        &testSegmentRecords)
    testHistorySegmentOk := testSegmentParsed && testSegmentRecords.Length = 2
        && testSegmentRecords[1].acknowledged
        && !testSegmentRecords[2].acknowledged
        && testSegmentRecords[2].exactEventId = ""
    testHistoryBatchOk := testHistoryParsed
        && BuildLegacyFarmHistoryBatch([], testHistoryRecords, 1893456009000,
            &testHistoryBatch, &testHistoryAdded)
        && testHistoryAdded = 3 && testHistoryBatch.Length = 5
        && testHistoryBatch[1].command = "SESSION_BEGIN"
        && testHistoryBatch[1].id = "legacy_farm_rewards_v1"
        && testHistoryBatch[2].command = "MINING_SUCCESS"
        && InStr(testHistoryBatch[2].id, "_washing_")
        && testHistoryBatch[3].command = "MINING_SUCCESS"
        && InStr(testHistoryBatch[3].id, "_gold_")
        && testHistoryBatch[4].id = testPendingMiningId
        && testHistoryBatch[5].command = "SESSION_END"
    testHistoryReplayOk := testHistoryBatchOk
        && BuildLegacyFarmHistoryBatch(testHistoryBatch, testHistoryRecords,
            1893456010000, &testHistoryReplay, &testHistoryReplayAdded)
        && testHistoryReplayAdded = 0
        && testHistoryReplay.Length = testHistoryBatch.Length
    testHistoryIntegrationOk := TestLegacyFarmHistoryBackfillIntegration(
        testHistoryFixture, 5)
    testDurabilityHoldAttempt := {
        rewardSessionId: "run_1_1_1893456000000",
        rewardEventId: "mine_run_1_1_1893456000000_gold_1_2",
        rewardConfirmedAtUnixMs: 1893456000001,
        rewardConfirmedInfo: {revision: 2}, completed: false,
        rewardDurabilityPending: true
    }
    testDurabilityHoldOk := FarmAttemptRequiresDurabilityHold(
        testDurabilityHoldAttempt)
        && RewardReconcileDecision(false, true, 999, 100, true)
            = "DURABILITY_HOLD"
    testStartOperationOwnershipOk := TestStartOperationOwnership()
    testFarmTimerHandoffPolicyOk := FarmTimerScheduleAction(1, true, false,
        true) = "DEFER"
        && FarmTimerScheduleAction(0, true, false, true) = "ARM"
        && FarmTimerScheduleAction(0, false, false, true) = "DROP"
        && FarmTimerScheduleAction(0, true, true, true) = "DROP"
        && FarmTimerScheduleAction(0, true, false, false) = "DROP"
        && RunFarmTimerHandoffMockTest(100)
    testRecoveryRestartPolicyOk := RecoveryRestartAllowed(0, false)
        && !RecoveryRestartAllowed(1, false)
        && !RecoveryRestartAllowed(0, true)
    testRecoveryPreflightPolicyOk := RecoveryPreflightAction(1, 0, false)
        = "RETRY"
        && RecoveryPreflightAction(2, 0, false) = "RETRY"
        && RecoveryPreflightAction(3, 0, false) = "RESTART"
        && RecoveryPreflightAction(3, 1, false) = "STOP"
        && RecoveryPreflightAction(3, 0, true) = "STOP"
    testCompleteRefillReceiptParsed := ParseVerifiedWashingRefillReceipt(
        "WITHDRAWN 8 2 dHJ1bmsxMjM= dHJ1bms= 123-9 COMPLETE",
        "dHJ1bmsxMjM=", "dHJ1bms=", &testCompleteRefillReceipt)
    testPartialRefillReceiptParsed := ParseVerifiedWashingRefillReceipt(
        "WITHDRAWN_PARTIAL 1 1 dHJ1bmsxMjM= dHJ1bms= 123-10 PARTIAL_NO_PROGRESS",
        "dHJ1bmsxMjM=", "dHJ1bms=", &testPartialRefillReceipt)
    testWashingRefillReceiptPolicyOk := testCompleteRefillReceiptParsed
        && testCompleteRefillReceipt.moved = 8
        && testCompleteRefillReceipt.stacks = 2
        && testCompleteRefillReceipt.status = "COMPLETE"
        && WashingRefillReceiptOperationMatches(testCompleteRefillReceipt,
            "123-9")
        && testPartialRefillReceiptParsed
        && testPartialRefillReceipt.moved = 1
        && testPartialRefillReceipt.status = "PARTIAL_NO_PROGRESS"
        && StorageTransferReceiptAction(testPartialRefillReceipt.status, true)
            = "STOP"
        && StorageTransferReceiptAction("PARTIAL_AMBIGUOUS_TRANSFER", true)
            = "STOP"
        && StorageTransferReceiptAction("PARTIAL_MOVE_REJECTED", true)
            = "RETRY_EXACT"
        && StorageTransferReceiptAction("PARTIAL_INVENTORY_CAPACITY", true)
            = "COMMIT_EXACT"
        && WashingRefillFailureAction("ERROR AMBIGUOUS_TRANSFER")
            = "STOP_AMBIGUOUS"
        && WashingRefillFailureAction("ERROR NO_PROGRESS")
            = "STOP_AMBIGUOUS"
        && WashingRefillFailureAction("ERROR MOVE_REJECTED") = "RETRY_ZERO"
        && WashingRefillFailureAction("ERROR UNKNOWN") = "STOP_FATAL"
        && !ParseVerifiedWashingRefillReceipt(
            "WITHDRAWN_PARTIAL 1 1 dHJ1bmsxMjM= dHJ1bms= 123-10 COMPLETE",
            "dHJ1bmsxMjM=", "dHJ1bms=", &testInvalidRefillReceipt)
        && WashingRefillErrorKind("ERROR INVENTORY_CAPACITY") = "CAPACITY"
        && WashingRefillErrorKind("ERROR RAW_STONE_NOT_FOUND")
            = "SOURCE_EMPTY"
        && WashingRefillReceiptDeltaStatus(5, 6, 1) = "MATCH"
        && WashingRefillReceiptDeltaStatus(5, 5, 1) = "PENDING"
        && WashingRefillReceiptDeltaStatus(5, 7, 1) = "UNPAIRED"
        && WashingRefillAccountedTotalMatches(5, 8, 3)
        && !WashingRefillAccountedTotalMatches(5, 8, 2)
    testWorkViewDownPolicyOk := WorkViewDownModeSupported("washing")
        && WorkViewDownModeSupported("gold")
        && !WorkViewDownModeSupported("mining")
    testProgressStatusOk := BuildFarmProgressStatus("復旧（", 3, 3)
        = "復旧（3/3）"
        && BuildFarmProgressStatus("再出現 ", 2, 4, "") = "再出現 2/4"
    testAlertPolicyOk := AutomationAlertSoundType("capacity") = 0x30
        && AutomationAlertSoundType("error") = 0x10
        && AutomationAlertSoundType("wash_complete") = 0x40
        && AutomationAlertSoundType("other") = 0
    testBackgroundViewRouteOk := BackgroundCameraDownRoute(450) = "450:32"
        && BackgroundCameraDownRoute(1) = "100:32"
        && BackgroundCameraDownRoute(2000) = "1500:32"
    testVisualFixtureVersionOk := VisualFixtureNewerVersion("9.1.0") = "9.1.1"
        && VisualFixtureNewerVersion("12.34.99") = "12.34.100"
        && VisualFixtureNewerVersion("09.1.0") = ""
    testConsumedSingleOk := DetectConsumedInventoryItem(
        "0001.raw_stone.e30=6,0002.food.e30=2,0003.washed_stone.e30=1",
        "0001.raw_stone.e30=5,0002.food.e30=2,0003.washed_stone.e30=2",
        &testConsumedName, &testConsumedCount)
        && testConsumedName = "raw_stone" && testConsumedCount = 1
    testConsumedMultipleRejectedOk := !DetectConsumedInventoryItem(
        "0001.raw_stone.e30=6,0002.food.e30=2",
        "0001.raw_stone.e30=5,0002.food.e30=1",
        &testAmbiguousConsumedName, &testAmbiguousConsumedCount)
        && testAmbiguousConsumedName = ""
        && testAmbiguousConsumedCount = 0
    testWashingRewardEvidenceOk := WashingSnapshotHasExchangeReward(
        {items: "0001.raw_stone.e30=1,0002.food.e30=1,0003.washed_stone.e30=1"},
        {items: "0001.raw_stone.e30=2,0002.food.e30=1"},
        "raw_stone", &testWashRawName, &testWashRawUnits,
        &testWashOutputUnits)
        && testWashRawName = "raw_stone" && testWashRawUnits = 1
        && testWashOutputUnits = 1
        && WashingSnapshotHasExchangeReward(
            {items: "0001.raw_stone.e30=1,0002.washed_stone.e30=1"},
            {items: "0001.raw_stone.e30=2"}, "",
            &testLearnedWashRawName, &testLearnedWashRawUnits,
            &testLearnedWashOutputUnits)
        && testLearnedWashRawName = "raw_stone"
        && !WashingSnapshotHasExchangeReward(
            {items: "0001.raw_stone.e30=2,0002.washed_stone.e30=1"},
            {items: "0001.raw_stone.e30=2"}, "raw_stone",
            &testWashOutputOnlyName, &testWashOutputOnlyRaw,
            &testWashOutputOnlyGain)
        && !WashingSnapshotHasExchangeReward(
            {items: "0001.raw_stone.e30=1"},
            {items: "0001.raw_stone.e30=2"}, "raw_stone",
            &testWashRawOnlyName, &testWashRawOnlyCount,
            &testWashRawOnlyOutput)
    testWashingBatchCompleteOk := WashingBatchWasCompleted(
        "0001.raw_stone.e30=1,0002.food.e30=2",
        "0002.food.e30=2,0003.washed.e30=1", "raw_stone")
        && !WashingBatchWasCompleted(
            "0001.raw_stone.e30=2", "0001.raw_stone.e30=1", "raw_stone")
        && !WashingBatchWasCompleted(
            "0002.food.e30=2", "0002.food.e30=2", "raw_stone")
    try FileAppend "VALIDATION_PHASE mode-workflows " A_TickCount "`n", "**", "UTF-8-RAW"
    testMiningWorkflowOk := RunFarmStorageResumeModeMockTest("mining", 100,
        &testMiningWorkflowStats)
    testGoldWorkflowOk := RunFarmStorageResumeModeMockTest("gold", 100,
        &testGoldWorkflowStats)
    testWashingWorkflowOk := RunWashingStorageRefillResumeMockTest(100,
        &testWashingWorkflowStats)
    testWorkflowFaultCoverageOk := testMiningWorkflowOk && testGoldWorkflowOk
        && testWashingWorkflowOk
        && FarmWorkflowMockFaultCoverage(testMiningWorkflowStats)
        && FarmWorkflowMockFaultCoverage(testGoldWorkflowStats)
        && FarmWorkflowMockFaultCoverage(testWashingWorkflowStats)
    testWorkflowOwnershipOk := testMiningWorkflowOk && testGoldWorkflowOk
        && testWashingWorkflowOk
        && testMiningWorkflowStats.clean && testGoldWorkflowStats.clean
        && testWashingWorkflowStats.clean
        && testMiningWorkflowStats.blockedDuplicateTasks >= 200
        && testGoldWorkflowStats.blockedDuplicateTasks >= 200
        && testWashingWorkflowStats.blockedDuplicateTasks >= 200
        && testMiningWorkflowStats.blockedConcurrentInputs >= 200
        && testGoldWorkflowStats.blockedConcurrentInputs >= 200
        && testWashingWorkflowStats.blockedConcurrentInputs >= 200
    testHeadingIndependentOk := FarmMockStorageDepartureGate(
        "0001.food.e30=2", "0001.food.e30=2,0002.ore.e30=1", 90)
        && FarmMockStorageDepartureGate("0001.food.e30=2",
            "0001.food.e30=2,0002.ore.e30=1", 180)
        && FarmMockStorageDepartureGate("0001.food.e30=2",
            "0001.food.e30=2,0002.ore.e30=1", 317)
        && !FarmMockStorageDepartureGate("0001.food.e30=2",
            "0001.food.e30=2", 90)
    testColdStartWashInfo := BuildWorkflowMockInventory("washing", 0, 0,
        5000)
    testColdStartNeedsStorage := FarmModeNeedsStorage("washing",
        testColdStartWashInfo, "raw_stone", testColdStartWashInfo.weight,
        &testColdStartReason, &testColdStartFreeWeight,
        &testColdStartRawCount)
    testRefillOnlyDepartureOk := testColdStartNeedsStorage
        && testColdStartReason = "raw_stone_empty"
        && testColdStartRawCount = 0
        && !StorageDeltaBaselineIsSafe(testColdStartWashInfo.items,
            testColdStartWashInfo.items)
        && IsVerifiedWashingRefillOnlyDeparture("washing", true, true,
            "raw_stone_empty", 0)
        && !IsVerifiedWashingRefillOnlyDeparture("mining", true, true,
            "raw_stone_empty", 0)
        && !IsVerifiedWashingRefillOnlyDeparture("washing", false, true,
            "raw_stone_empty", 0)
        && !IsVerifiedWashingRefillOnlyDeparture("washing", true, false,
            "raw_stone_empty", 0)
        && !IsVerifiedWashingRefillOnlyDeparture("washing", true, true,
            "weight_percent", 0)
        && !IsVerifiedWashingRefillOnlyDeparture("washing", true, true,
            "raw_stone_empty", 1)
    testLateDepositRecoveryOk := StorageRecoverySnapshotAction(true, true,
        false, false, "washing", true) = "REFILL"
        && StorageRecoverySnapshotAction(true, true, false, true,
            "washing", true) = "REFILL"
        && StorageRecoverySnapshotAction(true, true, false, false,
            "mining", false) = "RETURN"
        && StorageRecoverySnapshotAction(true, true, false, true,
            "mining", false) = "RETRY"
        && StorageRecoverySnapshotAction(false, true, false, false,
            "washing", true) = "RETRY"
        && StorageRecoverySnapshotAction(true, true, true, false,
            "washing", true) = "RETRY"
    testBoundedStorageRecoveryOk := RunBoundedStorageRecoveryPolicyMockTest(100)
    testAmbiguousTransferNoRetryOk := RunAmbiguousTransferNoRetryMockTest(100)
    testVerifiedRefillReturnGateOk := !StorageReturnAllowed("washing", true,
        false) && StorageReturnAllowed("washing", true, true)
        && StorageReturnAllowed("washing", false, false)
        && StorageReturnAllowed("mining", true, false)
    try FileAppend "VALIDATION_PHASE final-checks " A_TickCount "`n", "**", "UTF-8-RAW"
    exitCode := !FileExist(State.buttonTemplates[1].path) ? 11
        : !FileExist(State.buttonTemplates[2].path) ? 12
        : !FileExist(State.hungerTemplatePath) ? 13
        : !FileExist(State.stoneMarkerTemplatePath) ? 14
        : !FileExist(State.backgroundBridgePath) ? 15
        : !FileExist(State.updaterPath) ? 16
        : MonotonicMs() <= 0 ? 17
        : RunBackgroundBridge("capabilities") != "CAPS 12 MINE WASH GOLD NUDGE STORAGE INVENTORY ROUTE TRY VIEW HOTBAR INVENTORYKEY HEALTH COMPANION ACTIONWAIT REFILL" ? 18
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
        : AutomationStartAllowed(false, false, false, true) ? 69
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
        : testCapacityReason != "next_reward_weight" || testFreeWeight != 2000 ? 54
        : CapacityNeedsStorage({weight: 7999, maxWeight: 10000,
            used: 2, slots: 20}, &testCapacityReason, &testFreeWeight) ? 55
        : !CapacityNeedsStorage({weight: 1000, maxWeight: 10000,
            used: 20, slots: 20}, &testCapacityReason, &testFreeWeight) ? 56
        : testCapacityReason != "free_slots" ? 57
        : !InventorySlotWasConsumed("0001.food.e30=2", "0001.food.e30=1", 1) ? 70
        : InventorySlotWasConsumed("0001.food.e30=2", "0001.food.e30=2", 1) ? 71
        : !InventorySlotWasConsumed("0001.food.e30=1", "-", 1) ? 72
        : RuntimeStatusOverlayModeLabel("washing") != "石洗い" ? 73
        : RuntimeStatusOverlayCompactStatus("●  FiveM内部UIへ再接続中")
            != "FiveM内部UIへ再接続中" ? 74
        : RuntimeStatusOverlayMeta(3, true, 2500, 2)
            != "実成功 3 | 空き 2.5 kg | 収納 2" ? 75
        : RuntimeStatusOverlayTitle("washing", "●  所持品確認中", "")
            != "石洗い | 所持品確認中" ? 76
        : testOverlayBounds.x != 480 ? 77
        : testOverlayBounds.y != 234 || testOverlayBounds.w != 520
            || testOverlayBounds.h != 58 ? 78
        : WorkCooldownWakeDelay(6000) != 4500 ? 79
        : WorkCooldownWakeDelay(1500) != 1500 ? 80
        : !CapacityNeedsStorage({weight: 149995, maxWeight: 150000,
            used: 8, slots: 50}, &testCapacityReason, &testFreeWeight) ? 81
        : testCapacityReason != "weight_percent" || testFreeWeight != 5 ? 82
        : !ParseActionCompletionResult("ACTION_COMPLETED WASH 9123",
            "washing", &testActionElapsed) ? 83
        : testActionElapsed != 9123 ? 84
        : ParseActionCompletionResult("ACTION_COMPLETED WASH -1",
            "washing", &testActionElapsed) ? 85
        : ParseActionCompletionResult("ACTION_COMPLETED WASH 30001",
            "washing", &testActionElapsed) ? 86
        : ParseActionCompletionResult("ACTION_COMPLETED WASH 1 extra",
            "washing", &testActionElapsed) ? 87
        : ParseActionCompletionResult("ACTION_COMPLETED MINE 5000",
            "washing", &testActionElapsed) ? 88
        : BackgroundActionCommandToken("mining") != "mine"
            || BackgroundActionResultToken("gold") != "GOLD" ? 89
        : State.actionCompletionPending ? 90
        : State.actionCompletionMode != "" ? 91
        : State.HasOwnProp("washCompletionPending") ? 92
        : State.actionDispatchUncertain ? 93
        : !IsActionCompletionBridgeResult("ERROR MINE_NOT_STARTED", "mining") ? 94
        : IsActionCompletionBridgeResult("ERROR WASH_NOT_STARTED", "mining") ? 95
        : !IsActionCompletionBridgeResult("ACTION_COMPLETED GOLD 6100", "gold") ? 96
        : IsActionCompletionBridgeResult("ERROR GOLD_UNKNOWN", "gold") ? 97
        : !InventorySnapshotHasReward(
            {weight: 1200, items: "0001.ore.e30=2"},
            {weight: 1000, items: "0001.ore.e30=1"}) ? 98
        : InventorySnapshotHasReward(
            {weight: 1000, items: "0001.ore.e30=1"},
            {weight: 1000, items: "0001.ore.e30=1"}) ? 99
        : !InventorySnapshotWasReduced(
            {weight: 800, items: "0001.ore.e30=1"},
            {weight: 1000, items: "0001.ore.e30=2"}) ? 100
        : FarmStateTransitionAllowed("STORING", "RETURNING_TO_FARM") ? 101
        : !FarmStateTransitionAllowed("VERIFY_STORAGE", "RETURNING_TO_FARM") ? 102
        : !RunFarmStateMachineMockTest(100) ? 103
        : RuntimeStatusOverlayBounds(0, 0, 1920, 1080, true).h != 94 ? 104
        : MetagameRetryBackoffMs(1) != 4000
            || MetagameRetryBackoffMs(9) != 30000 ? 105
        : BuildMiningEventId(BuildFarmSessionId(12, 3, 1000), 7, 9)
            = BuildMiningEventId(BuildFarmSessionId(12, 3, 1001), 7, 9) ? 106
        : !RegExMatch(BuildMiningEventId(
            BuildFarmSessionId(1234, 99, 1893456000000), 999, 888),
            "^[A-Za-z0-9._:-]{8,128}$") ? 107
        : State.successes != 0 || IsObject(State.pendingFarmAttempt) ? 108
        : RewardReconcileDecision(false, true, 100, 200) != "WAIT" ? 109
        : RewardReconcileDecision(true, true, 100, 200) != "CONFIRMED" ? 110
        : RewardReconcileDecision(false, false, 100, 200)
            != "SESSION_CHANGED" ? 111
        : RewardReconcileDecision(false, true, 200, 200) != "TIMEOUT" ? 112
        : !testOutboxEnqueueOk || !testLostAckRetained ? 113
        : !testOutboxAckOk ? 114
        : !testSessionRebaseOk ? 115
        : !testAckCopyOnWriteOk ? 116
        : !testIdleReplayOk ? 117
        : (!IsValidMetaResetToken("9db26bb47a1845efa9905f8cb47d25d3:4")
            || IsValidMetaResetToken("9db26bb4-7a18-45ef-a990-5f8cb47d25d3:4")
            || IsValidMetaResetToken("9db26bb47a1845efa9905f8cb47d25d3:0")
            || IsValidMetaResetToken("reset 4")) ? 118
        : !testFarmBaselineGuardOk ? 119
        : !testFarmFinalizeGuardOk ? 120
        : !testDebugOverlayOk ? 121
        : !testFarmFailureCodesOk ? 122
        : !testStopResetOk ? 123
        : !testCapacityDispatcherOk ? 124
        : !testLargeOutboxOk ? 125
        : !testJournalOk ? 126
        : !testLegacyMigrationOk ? 127
        : !testTornOk ? 128
        : !testAppendFailureOk ? 129
        : !testStorageDeltaSelectionOk ? 130
        : !testGracefulTailOk ? 131
        : !testEndRetryOk ? 132
        : !testGracefulReplayOk ? 133
        : !testInterleaveOk ? 134
        : !testResetInterleaveOk ? 135
        : !testCameraOverlayStatesOk ? 136
        : !testFarmModeIdsOk ? 137
        : !testHistoryParserOk ? 138
        : !testHistoryStrictOk ? 139
        : !testHistorySegmentOk ? 140
        : !testHistoryBatchOk ? 141
        : !testHistoryReplayOk ? 142
        : !testHistoryIntegrationOk ? 143
        : !testRewardRetryOk ? 145
        : !testRuntimeFutureClampOk ? 146
        : !testDurabilityHoldOk ? 147
        : !testStartOperationOwnershipOk ? 148
        : !testRecoveryRestartPolicyOk ? 149
        : !testWorkViewDownPolicyOk ? 150
        : !testProgressStatusOk ? 151
        : !testAlertPolicyOk ? 152
        : !testBackgroundViewRouteOk ? 153
        : !testConsumedSingleOk ? 154
        : !testConsumedMultipleRejectedOk ? 155
        : !testMiningWorkflowOk ? 156
        : !testGoldWorkflowOk ? 157
        : !testWashingWorkflowOk ? 158
        : !testWorkflowFaultCoverageOk ? 159
        : !testWorkflowOwnershipOk ? 160
        : !testHeadingIndependentOk ? 161
        : !testRefillOnlyDepartureOk ? 162
        : !testLateDepositRecoveryOk ? 163
        : !testBoundedStorageRecoveryOk ? 164
        : !testVerifiedRefillReturnGateOk ? 165
        : !testFarmOutputLedgerOk ? 166
        : !testStaleStorageCleanupGuardOk ? 167
        : !testVisualFixtureVersionOk ? 168
        : !testRecoveryPreflightPolicyOk ? 169
        : !testWashingRefillReceiptPolicyOk ? 170
        : !testFarmTimerHandoffPolicyOk ? 171
        : !testWashingRewardEvidenceOk ? 172
        : !testAmbiguousTransferNoRetryOk ? 173
        : !testWashingBatchCompleteOk ? 174 : 0
    try FileAppend "VALIDATION_PHASE final-result " A_TickCount "`n", "**", "UTF-8-RAW"
    if exitCode = 0 && (CompletionPhrase("mining") != "石掘りが終わったよ"
        || CompletionPhrase("washing") != "石洗いが終わったよ"
        || CompletionPhrase("gold") != "砂金取りが終わりました")
        exitCode := 175
    if exitCode = 19
        try FileAppend "UPDATER_CAPS=" updaterCapabilities "`r`n",
            State.diagnosticPath, "UTF-8"
    DeleteExtractedTemplates()
    try FileDelete State.diagnosticPath
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

; Import only records that the previous executable wrote after a verified inventory
; increase. Persist the complete closed session and its one-time marker before the
; WebView Host can observe any event; a failed migration therefore cannot partially
; update Stone progression or erase the source diagnostics.
if !isUiTestRun && (!State.legacyDurabilityMigrationReady
    || !State.verifiedRewardWalReady
    || !RunLegacyFarmHistoryBackfill()) {
    MsgBox "以前の作業履歴をSTONEの共通保存先へ安全に保存できませんでした。`n"
        . "履歴を失わないため、AI採掘機を開始せず終了します。"
    DeleteExtractedTemplates()
    ExitApp 2
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
    State.pages := Map("overview", true, "vehicle", true, "settings", true,
        "stone", true, "routes", true, "update", true)
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
    State.fastWashControl := WebUiControl("fastWashMode", "", Config.fastWashMode)
    State.autoEatControl := WebUiControl("autoEatControl", "", Config.autoEat)
    State.foodKeyControl := WebUiControl("foodKeyControl", "", Config.foodKey)
    State.autoUpdateControl := WebUiControl("autoUpdateControl", "", Config.autoCheckUpdates)
    State.minimumFreeWeightControl := WebUiControl("minimumFreeWeightControl", "",
        Config.minimumFreeWeight)
    State.storageTriggerPercentControl := WebUiControl("storageTriggerPercent", "",
        Config.storageTriggerPercent)
    State.estimatedRewardWeightControl := WebUiControl("estimatedRewardWeight", "",
        Config.estimatedRewardWeight)
    State.minimumFreeSlotsControl := WebUiControl("minimumFreeSlots", "",
        Config.minimumFreeSlots)
    State.storageMaxRetriesControl := WebUiControl("storageMaxRetries", "",
        Config.storageMaxRetries)
    State.farmWatchdogMsControl := WebUiControl("farmWatchdogMs", "",
        Config.farmWatchdogMs)
    State.targetLostRecoveryMsControl := WebUiControl("targetLostRecoveryMs", "",
        Config.targetLostRecoveryMs)
    State.debugOverlayControl := WebUiControl("debugOverlay", "",
        Config.debugOverlay)
    State.settingsButton := WebUiControl("settingsButton", "設定を保存")
    State.settingsErrorLabel := WebUiControl("settingsErrorLabel", "")

    State.currentVersionLabel := WebUiControl("currentVersionLabel", "v" AppVersion)
    State.updatePageStatus := WebUiControl("updatePageStatus", "未確認")
    State.updateButton := WebUiControl("updateButton", "アップデートを確認")
    State.ui.navUpdate := WebUiControl("navUpdate", "アップデート")

    Hotkey "^!r", OpenExeRouteSettings
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
        DirCreate State.uiAssetsPath "\metagame\data"
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
        FileInstall "ui-runtime\web\metagame\meta-game.css",
            State.uiAssetsPath "\metagame\meta-game.css", true
        FileInstall "ui-runtime\web\metagame\meta-game.js",
            State.uiAssetsPath "\metagame\meta-game.js", true
        FileInstall "ui-runtime\web\metagame\meta-game-adapter.js",
            State.uiAssetsPath "\metagame\meta-game-adapter.js", true
        FileInstall "ui-runtime\web\metagame\meta-game-entry.js",
            State.uiAssetsPath "\metagame\meta-game-entry.js", true
        FileInstall "ui-runtime\web\metagame\meta-game-template.html",
            State.uiAssetsPath "\metagame\meta-game-template.html", true
        FileInstall "ui-runtime\web\metagame\demo-adapter.js",
            State.uiAssetsPath "\metagame\demo-adapter.js", true
        FileInstall "ui-runtime\web\metagame\data\achievements.json",
            State.uiAssetsPath "\metagame\data\achievements.json", true
        FileInstall "ui-runtime\web\metagame\data\affinity.json",
            State.uiAssetsPath "\metagame\data\affinity.json", true
        FileInstall "ui-runtime\web\metagame\data\assets.json",
            State.uiAssetsPath "\metagame\data\assets.json", true
        FileInstall "ui-runtime\web\metagame\data\banners.json",
            State.uiAssetsPath "\metagame\data\banners.json", true
        FileInstall "ui-runtime\web\metagame\data\gacha.json",
            State.uiAssetsPath "\metagame\data\gacha.json", true
        FileInstall "ui-runtime\web\metagame\data\items.json",
            State.uiAssetsPath "\metagame\data\items.json", true
        FileInstall "ui-runtime\web\metagame\data\level-rewards.json",
            State.uiAssetsPath "\metagame\data\level-rewards.json", true
        FileInstall "ui-runtime\web\metagame\data\messages.json",
            State.uiAssetsPath "\metagame\data\messages.json", true
        FileInstall "ui-runtime\web\metagame\data\titles.json",
            State.uiAssetsPath "\metagame\data\titles.json", true
        ;@BUILD_STONEVERSE_FILEINSTALLS
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
        State.uiAssetsPath "\vendor\framework7-bundle.min.js",
        State.uiAssetsPath "\metagame\meta-game.css",
        State.uiAssetsPath "\metagame\meta-game.js",
        State.uiAssetsPath "\metagame\meta-game-adapter.js",
        State.uiAssetsPath "\metagame\meta-game-entry.js",
        State.uiAssetsPath "\metagame\meta-game-template.html",
        State.uiAssetsPath "\metagame\demo-adapter.js",
        State.uiAssetsPath "\metagame\data\achievements.json",
        State.uiAssetsPath "\metagame\data\affinity.json",
        State.uiAssetsPath "\metagame\data\assets.json",
        State.uiAssetsPath "\metagame\data\banners.json",
        State.uiAssetsPath "\metagame\data\gacha.json",
        State.uiAssetsPath "\metagame\data\items.json",
        State.uiAssetsPath "\metagame\data\level-rewards.json",
        State.uiAssetsPath "\metagame\data\messages.json",
        State.uiAssetsPath "\metagame\data\titles.json",
        State.uiAssetsPath "\stoneverse-host.js",
        State.uiAssetsPath "\stoneverse\index.html"]
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
        . " --state-path " QuoteCommandArg(State.metagameStatePath)
        . " --user-data " QuoteCommandArg(State.uiUserDataPath)
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
    if State.running
        ResetFarmMetagameSession("ui_host_process_ended")
}

ReceiveWebUiCopyData(wParam, lParam, *) {
    global State, AppVersion
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
            ; Give a freshly loaded Host a brief chance to emit meta.reset first,
            ; then replay any durable FIFO even while Farm itself is stopped.
            ScheduleMetagameOutboxReplay(150)
            return true
        }
        if !State.uiReady || wParam != State.uiHwnd
            return false

        if parts[3] = "meta.ack" && parts.Length = 5
            return AcknowledgeMetagameEvent(parts[4], parts[5])
        if parts[3] = "meta.reset" && parts.Length = 4
            return HandleMetagameReset(parts[4])
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
    global State, Config, LocalNav
    State.uiActionPending := false
    while State.uiActionQueue.Length {
        parts := State.uiActionQueue.RemoveAt(1)
        action := parts[3]
        try {
            if action = "nav" && parts.Length = 4 {
                ShowPage(parts[4])
            } else if action = "action.select" && parts.Length = 4 {
                if LocalNav.busy || LocalNav.requestActive || State.registrationActive
                    continue
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
            } else if action = "vehicle.route" && parts.Length = 3 {
                if !State.visualTest
                    ShowExeRoutePanel()
            } else if (action = "route.teach" || action = "route.trial" || action = "route.stationary") && parts.Length = 4 {
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
                    RequestExeRouteSetup(action = "route.teach" ? "teach" : action = "route.stationary" ? "stationary" : "trial", mode)
            } else if action = "vehicle.delete" && parts.Length = 3 {
                if State.visualTest {
                    State.vehicleStatusLabel.Text := "未登録"
                    State.vehicleDeleteButton.Enabled := false
                } else
                    DeleteVehicleRegistration()
            } else if action = "washing.fast.toggle" && parts.Length = 4 {
                ToggleFastWashMode(parts[4] = "1")
            } else if action = "settings.save"
                && (parts.Length = 12 || parts.Length = 19) {
                ApplyWebUiSettings(parts)
            } else if action = "update.check" && parts.Length = 3 {
                if State.visualTest {
                    State.updatePageStatus.Text := "新しいバージョン v"
                        . VisualFixtureNewerVersion(AppVersion) . " があります"
                    State.updateButton.Text := "ダウンロードして更新"
                    State.ui.navUpdate.Text := "アップデート •"
                } else
                    CheckForUpdates()
            } else if action = "diagnostics.mark" && parts.Length = 3 {
                SupportMarkProblem()
            } else if action = "diagnostics.export" && parts.Length = 3 {
                ExportSupportDiagnostics()
            } else if action = "diagnostics.clientError" && parts.Length = 4 {
                SupportWriteEvent("WEB_ERROR", parts[4])
            } else if action = "window.close" && parts.Length = 3 {
                ExitApp()
            }
        } catch as err {
            WriteDiagnostic("UI_ACTION_ERROR action=" action " error=" err.Message)
            if InStr(action, "route") {
                LocalNav.feedback := "ルート設定を開けませんでした：" err.Message
                ShowPage("routes")
            }
            State.settingsErrorLabel.Opt("cB42318")
            State.settingsErrorLabel.Text := "操作を完了できませんでした。"
        }
    }
    QueueWebUiFlush()
}

ToggleFastWashMode(enabled) {
    global State, Config
    requested := enabled ? 1 : 0
    if State.running || State.startInProgress || State.registrationActive {
        State.fastWashControl.Value := Config.fastWashMode
        State.settingsErrorLabel.Opt("cB42318")
        State.settingsErrorLabel.Text := "最速石洗いはF9で停止してから変更してください。"
        QueueWebUiFlush(true)
        return false
    }
    previous := Config.fastWashMode
    Config.fastWashMode := requested
    State.fastWashControl.Value := requested
    try SaveAllSettingsAtomically()
    catch as err {
        Config.fastWashMode := previous
        State.fastWashControl.Value := previous
        State.settingsErrorLabel.Opt("cB42318")
        State.settingsErrorLabel.Text := "最速石洗いを保存できません: " err.Message
        QueueWebUiFlush(true)
        return false
    }
    State.settingsErrorLabel.Opt("c248A3D")
    State.settingsErrorLabel.Text := requested
        ? "最速石洗いON：通常洗浄はストレージ表示を待たず、洗浄対象だけを待ちます。"
        : "最速石洗いOFF：従来どおり荷台前の両操作を確認してから洗浄します。"
    SupportWriteEvent("FAST_WASH_SETTING", "enabled=" requested)
    QueueWebUiFlush(true)
    return true
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
    if parts.Length >= 19 {
        State.storageTriggerPercentControl.Value := parts[13]
        State.estimatedRewardWeightControl.Value := parts[14]
        State.minimumFreeSlotsControl.Value := parts[15]
        State.storageMaxRetriesControl.Value := parts[16]
        State.farmWatchdogMsControl.Value := parts[17]
        State.targetLostRecoveryMsControl.Value := parts[18]
        State.debugOverlayControl.Value := parts[19] = "1"
    }
    if !State.visualTest {
        SaveInlineSettings()
        return
    }
    Config.startHotkey := parts[4]
    Config.stopHotkey := parts[5]
    Config.backgroundMode := parts[6] = "1"
    Config.hideWhileRunning := parts[7] = "1"
    Config.washForwardCorrection := false ; stationary-only policy
    Config.goldRecoveryEnabled := false ; stationary-only policy
    Config.workViewLock := false ; stationary-only policy
    Config.autoEat := parts[9] = "1"
    try Config.foodKey := Integer(parts[10])
    Config.autoCheckUpdates := parts[11] = "1"
    try Config.minimumFreeWeight := Integer(parts[12])
    if parts.Length >= 19 {
        try Config.storageTriggerPercent := Integer(parts[13])
        try Config.estimatedRewardWeight := Integer(parts[14])
        try Config.minimumFreeSlots := Integer(parts[15])
        try Config.storageMaxRetries := Integer(parts[16])
        try Config.farmWatchdogMs := Integer(parts[17])
        try Config.targetLostRecoveryMs := Integer(parts[18])
        Config.debugOverlay := parts[19] = "1"
    }
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

VisualFixtureNewerVersion(version) {
    if !RegExMatch(String(version),
        "^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$", &parts)
        return ""
    try nextPatch := Integer(parts[3]) + 1
    catch
        return ""
    return parts[1] "." parts[2] "." nextPatch
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
        . ',"farmState":' JsonQuote(State.farmState)
        . ',"farmStateReason":' JsonQuote(State.farmStateReason)
        . ',"farmStateTaskId":' State.farmStateTaskId
        . ',"inventorySnapshotRevision":' State.inventorySnapshotRevision
        . ',"farmRetry":' State.farmStateRetry
        . ',"windowVisible":' (State.uiWindowVisible ? "true" : "false")
        . ',"visualTest":' (State.visualTest ? "true" : "false")
        . ',"diagnostics":' SupportUiJson()
        . ',"routes":' ExeRouteSetupStateJson(actionMode)
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

UnixTimeMilliseconds() {
    fileTime := Buffer(8, 0)
    DllCall("kernel32\GetSystemTimeAsFileTime", "Ptr", fileTime.Ptr)
    windowsTicks := NumGet(fileTime, 0, "Int64")
    return Floor((windowsTicks - 116444736000000000) / 10000)
}

SendMetagameCommand(command, identifier, eventAtUnixMs) {
    global State
    if command != "SESSION_BEGIN" && command != "MINING_SUCCESS"
        && command != "SESSION_END"
        return false
    if !RegExMatch(identifier, "^[A-Za-z0-9._:-]{8,128}$")
        return false
    try eventAtUnixMs := Integer(eventAtUnixMs)
    catch
        return false
    if eventAtUnixMs < 1 || !State.uiSession
        return false
    if !State.uiReady || !State.uiHwnd
        EnsureWebUiHost()
    sent := State.uiReady && State.uiHwnd
        && SendWebUiCopyData(State.uiHwnd, "AIUIMETA1`t" State.uiSession
            "`t" command "`t" identifier "`t" eventAtUnixMs)
    WriteDiagnostic("METAGAME command=" command " id=" identifier
        " sent=" (sent ? 1 : 0))
    return sent
}

BeginFarmMetagameSession(expectedGeneration) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsCurrentRun(expectedGeneration)
            return false
        if !State.metagameReplayNormalized
            && !NormalizeStoppedMetagameOutboxAtStartup()
            return false
        State.metagameReplayNormalized := true
        if !EnsureFarmMetagameSessionIdentity(expectedGeneration)
            return false
        if !EnsureFarmMetagameSessionBeginQueued()
            return false
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    FlushPendingMetagameMiningEvent(expectedGeneration)
    ; Durable FIFO membership, rather than WM_COPYDATA queue acceptance, is the
    ; condition required before a mining event may be appended behind SESSION_BEGIN.
    return State.farmSessionBeginQueued
}

EnsureFarmMetagameSessionIdentity(expectedGeneration) {
    global State
    if !IsCurrentRun(expectedGeneration)
        return false
    if State.farmSessionId
        return State.farmSessionStartedAt >= 1
    startedAt := UnixTimeMilliseconds()
    sessionId := BuildFarmSessionId(DllCall("GetCurrentProcessId"),
        expectedGeneration, startedAt)
    if !sessionId
        return false
    State.farmSessionId := sessionId
    State.farmSessionStartedAt := startedAt
    State.farmSessionEndedAt := 0
    State.farmSessionBeginQueued := false
    State.farmSessionBeginSent := false
    State.farmSessionEndQueued := false
    State.farmSessionEndSent := false
    return true
}

EnsureFarmMetagameSessionBeginQueued() {
    global State
    if !State.farmSessionId || State.farmSessionStartedAt < 1
        return false
    if State.farmSessionBeginQueued
        return true
    if MetagameOutboxContainsCommand(State.metagameOutbox,
        "SESSION_BEGIN", State.farmSessionId) {
        if State.metagameOutboxDirty && !PersistMetagameOutboxWithRetry()
            return false
        State.farmSessionBeginQueued := true
        return true
    }
    if !DurablyEnqueueMetagameEvent("SESSION_BEGIN", State.farmSessionId,
        State.farmSessionStartedAt)
        return false
    State.farmSessionBeginQueued := true
    return true
}

BuildFarmSessionId(processId, generation, startedAtUnixMs, resetOrdinal := 0) {
    suffix := resetOrdinal > 0 ? "_r" resetOrdinal : ""
    return "run_" processId "_" generation "_" startedAtUnixMs suffix
}

BuildMiningEventId(farmSessionId, attemptId, snapshotRevision) {
    return BuildFarmRewardEventId(farmSessionId, "mining", attemptId,
        snapshotRevision)
}

IsSupportedStoneActivityMode(actionMode) {
    return actionMode = "mining" || actionMode = "washing"
        || actionMode = "gold"
}

BuildFarmRewardEventId(farmSessionId, actionMode, attemptId,
    snapshotRevision) {
    if !IsSupportedStoneActivityMode(actionMode)
        return ""
    eventId := "mine_" farmSessionId "_" actionMode "_" attemptId "_"
        . snapshotRevision
    return RegExMatch(eventId, "^[A-Za-z0-9._:-]{8,128}$") ? eventId : ""
}

TryParseDiagnosticTimestamp(timestampText, &timestampToken, &eventAtUnixMs) {
    timestampToken := ""
    eventAtUnixMs := 0
    if !RegExMatch(timestampText,
        "^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{3})$",
        &parts)
        return false
    try {
        localTime := Buffer(16, 0)
        NumPut("UShort", Integer(parts[1]), localTime, 0)
        NumPut("UShort", Integer(parts[2]), localTime, 2)
        NumPut("UShort", Integer(parts[3]), localTime, 6)
        NumPut("UShort", Integer(parts[4]), localTime, 8)
        NumPut("UShort", Integer(parts[5]), localTime, 10)
        NumPut("UShort", Integer(parts[6]), localTime, 12)
        NumPut("UShort", Integer(parts[7]), localTime, 14)
        utcTime := Buffer(16, 0)
        if !DllCall("kernel32\TzSpecificLocalTimeToSystemTime", "Ptr", 0,
            "Ptr", localTime.Ptr, "Ptr", utcTime.Ptr, "Int")
            return false
        fileTime := Buffer(8, 0)
        if !DllCall("kernel32\SystemTimeToFileTime", "Ptr", utcTime.Ptr,
            "Ptr", fileTime.Ptr, "Int")
            return false
        windowsTicks := NumGet(fileTime, 0, "Int64")
        eventAtUnixMs := Floor((windowsTicks - 116444736000000000) / 10000)
    } catch
        return false
    timestampToken := RegExReplace(timestampText, "[^0-9]", "")
    return StrLen(timestampToken) = 17 && eventAtUnixMs >= 1
        && eventAtUnixMs <= 9999999999999
}

ParseVerifiedFarmRewardDiagnosticLine(line, &record,
    allowLegacyWithoutEventSuffix := true) {
    record := 0
    currentFormat := RegExMatch(line,
        "^([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}) \| FARM_REWARD_CONFIRMED id=([1-9][0-9]{0,17}) mode=(mining|washing|gold) reason=(weight_increase|item_increase|wash_exchange_raw_[1-9][0-9]*_output_[1-9][0-9]*) beforeWeight=([0-9]{1,18}) afterWeight=([0-9]{1,18}) revision=([1-9][0-9]{0,17}) eventId=([A-Za-z0-9._:-]{8,128}) eventAt=([1-9][0-9]{0,12})$",
        &parts)
    if !currentFormat {
        if !allowLegacyWithoutEventSuffix
            return false
        if !RegExMatch(line,
            "^([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}) \| FARM_REWARD_CONFIRMED id=([1-9][0-9]{0,17}) mode=(mining|washing|gold) reason=(weight_increase|item_increase|wash_exchange_raw_[1-9][0-9]*_output_[1-9][0-9]*) beforeWeight=([0-9]{1,18}) afterWeight=([0-9]{1,18}) revision=([1-9][0-9]{0,17})$",
            &parts)
            return false
    }
    if !TryParseDiagnosticTimestamp(parts[1], &timestampToken, &eventAt)
        return false
    try {
        attemptId := Integer(parts[2])
        beforeWeight := Integer(parts[5])
        afterWeight := Integer(parts[6])
        snapshotRevision := Integer(parts[7])
    } catch
        return false
    if parts[4] = "weight_increase" && afterWeight <= beforeWeight
        return false
    exactEventId := ""
    if currentFormat {
        exactEventId := parts[8]
        try eventAt := Integer(parts[9])
        catch
            return false
        if !TryParseHistoricalFarmRewardEventId(exactEventId, &eventMode,
            &eventAttemptId, &eventRevision)
            || eventMode != parts[3] || eventAttemptId != attemptId
            || eventRevision != snapshotRevision
            return false
    }
    record := {at: eventAt, timestampToken: timestampToken, mode: parts[3],
        attemptId: attemptId, revision: snapshotRevision,
        exactEventId: exactEventId, acknowledged: false,
        supportSource: false, normalSource: false}
    return true
}

TryParseLegacyMiningEventId(eventId, &attemptId, &snapshotRevision) {
    attemptId := 0
    snapshotRevision := 0
    if !RegExMatch(eventId,
        "^mine_run_[0-9]+_[0-9]+_[0-9]+(?:_r[1-9][0-9]*)?_([1-9][0-9]{0,17})_([1-9][0-9]{0,17})$",
        &parts)
        return false
    try {
        attemptId := Integer(parts[1])
        snapshotRevision := Integer(parts[2])
    } catch
        return false
    return true
}

TryParseHistoricalFarmRewardEventId(eventId, &actionMode, &attemptId,
    &snapshotRevision) {
    actionMode := ""
    attemptId := 0
    snapshotRevision := 0
    if RegExMatch(eventId,
        "^mine_run_[0-9]+_[0-9]+_[0-9]+(?:_r[1-9][0-9]*)?_(mining|washing|gold)_([1-9][0-9]{0,17})_([1-9][0-9]{0,17})$",
        &parts) {
        actionMode := parts[1]
        try {
            attemptId := Integer(parts[2])
            snapshotRevision := Integer(parts[3])
        } catch
            return false
        return true
    }
    if !TryParseLegacyMiningEventId(eventId, &attemptId, &snapshotRevision)
        return false
    actionMode := "mining"
    return true
}

ParseHistoricalMiningMetagameDiagnosticLine(line, &link) {
    link := 0
    acknowledged := false
    if RegExMatch(line,
        "^([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}) \| METAGAME command=MINING_SUCCESS id=([A-Za-z0-9._:-]{8,128}) sent=[01]$",
        &parts) {
        acknowledged := false
    } else if RegExMatch(line,
        "^([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}) \| METAGAME_ACK command=MINING_SUCCESS id=([A-Za-z0-9._:-]{8,128}) remaining=[0-9]+$",
        &parts) {
        acknowledged := true
    } else
        return false
    if !TryParseDiagnosticTimestamp(parts[1], &timestampToken, &eventAt)
        return false
    eventId := parts[2]
    if !TryParseHistoricalFarmRewardEventId(eventId, &actionMode, &attemptId,
        &snapshotRevision)
        return false
    link := {at: eventAt, id: eventId, attemptId: attemptId,
        revision: snapshotRevision, mode: actionMode,
        acknowledged: acknowledged}
    return true
}

ParseDiagnosticSessionStartLine(line, &versionCode) {
    versionCode := 0
    if !RegExMatch(line,
        "^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3} \| AI採掘機 v([0-9]{1,4})\.([0-9]{1,4})\.([0-9]{1,4}) 診断開始$",
        &parts)
        return false
    try versionCode := Integer(parts[1]) * 100000000
        + Integer(parts[2]) * 10000 + Integer(parts[3])
    catch
        return false
    return true
}

IsDiagnosticSessionStartLine(line) {
    return ParseDiagnosticSessionStartLine(line, &versionCode)
}

AppendLegacyFarmHistorySegment(segmentLines, &records,
    allowLegacyWithoutEventSuffix := true, supportSource := false) {
    segmentRecords := []
    linksById := Map()
    for line in segmentLines {
        if ParseVerifiedFarmRewardDiagnosticLine(line, &record,
            allowLegacyWithoutEventSuffix) {
            record.supportSource := supportSource
            record.normalSource := !supportSource
            segmentRecords.Push(record)
            continue
        }
        if !ParseHistoricalMiningMetagameDiagnosticLine(line, &link)
            continue
        if !linksById.Has(link.id) {
            linksById[link.id] := link
            continue
        }
        existing := linksById[link.id]
        if link.at < existing.at
            existing.at := link.at
        if link.acknowledged
            existing.acknowledged := true
    }

    usedExactIds := Map()
    for record in segmentRecords {
        if record.mode != "mining"
            continue
        bestLink := 0
        bestDelta := 0
        for eventId, link in linksById {
            if usedExactIds.Has(eventId)
                || link.mode != record.mode
                || link.attemptId != record.attemptId
                || link.revision != record.revision
                || (record.exactEventId && eventId != record.exactEventId)
                continue
            ; The attempt/revision pair is unique inside one diagnostic session.
            ; Do not depend on wall-clock ordering because Windows time correction can
            ; move the ACK timestamp slightly behind the reward timestamp.
            delta := Abs(link.at - record.at)
            if !IsObject(bestLink) || delta < bestDelta {
                bestLink := link
                bestDelta := delta
            }
        }
        if IsObject(bestLink) {
            usedExactIds[bestLink.id] := true
            record.exactEventId := bestLink.id
            record.acknowledged := bestLink.acknowledged
        }
    }
    for record in segmentRecords
        records.Push(record)
    return true
}

FarmHistoryRecordFingerprint(record) {
    if !IsObject(record) || !record.HasOwnProp("timestampToken")
        || !record.HasOwnProp("mode") || !record.HasOwnProp("attemptId")
        || !record.HasOwnProp("revision")
        return ""
    fingerprint := record.timestampToken "|" record.mode "|"
        . record.attemptId "|" record.revision
    return RegExMatch(fingerprint,
        "^[0-9]{17}\|(mining|washing|gold)\|[1-9][0-9]{0,17}\|[1-9][0-9]{0,17}$")
        ? fingerprint : ""
}

ConsolidateLegacyFarmHistoryRecords(inputRecords, &records) {
    records := []
    grouped := Map()
    order := []
    for record in inputRecords {
        fingerprint := FarmHistoryRecordFingerprint(record)
        if !fingerprint
            return false
        if !grouped.Has(fingerprint) {
            grouped[fingerprint] := record
            order.Push(fingerprint)
            continue
        }
        existing := grouped[fingerprint]
        if existing.exactEventId && record.exactEventId
            && existing.exactEventId != record.exactEventId
            return false
        if !existing.exactEventId && record.exactEventId
            existing.exactEventId := record.exactEventId
        existing.acknowledged := existing.acknowledged || record.acknowledged
        existing.supportSource := existing.supportSource || record.supportSource
        existing.normalSource := existing.normalSource || record.normalSource
    }
    for fingerprint in order
        records.Push(grouped[fingerprint])
    return true
}

ParseLegacyFarmHistoryContents(contents, &records, maximumRecords := 16384) {
    parsedRecords := []
    segmentLines := []
    segmentAllowsLegacy := true
    segmentIsSupport := false
    for contentItem in contents {
        content := IsObject(contentItem) ? contentItem.content : contentItem
        contentIsSupport := IsObject(contentItem)
            && contentItem.HasOwnProp("support") && contentItem.support
        normalized := StrReplace(content, "`r", "")
        for rawLine in StrSplit(normalized, "`n") {
            line := rawLine
            if SubStr(line, 1, 1) = Chr(0xFEFF)
                line := SubStr(line, 2)
            if ParseDiagnosticSessionStartLine(line, &sessionVersionCode) {
                if segmentLines.Length
                    AppendLegacyFarmHistorySegment(segmentLines, &parsedRecords,
                        segmentAllowsLegacy, segmentIsSupport)
                if parsedRecords.Length > maximumRecords
                    return false
                segmentLines := []
                segmentIsSupport := contentIsSupport
                segmentAllowsLegacy := contentIsSupport
                    || sessionVersionCode < 900000002
            } else if !segmentLines.Length {
                segmentIsSupport := contentIsSupport
                segmentAllowsLegacy := contentIsSupport
            }
            if line
                segmentLines.Push(line)
        }
    }
    if segmentLines.Length
        AppendLegacyFarmHistorySegment(segmentLines, &parsedRecords,
            segmentAllowsLegacy, segmentIsSupport)
    if parsedRecords.Length > maximumRecords
        return false
    return ConsolidateLegacyFarmHistoryRecords(parsedRecords, &records)
}

BuildLegacyFarmRewardEventId(record) {
    if !IsObject(record) || !record.HasOwnProp("timestampToken")
        || !record.HasOwnProp("mode") || !record.HasOwnProp("attemptId")
        || !record.HasOwnProp("revision")
        || !RegExMatch(record.timestampToken, "^[0-9]{17}$")
        || !IsSupportedStoneActivityMode(record.mode)
        return ""
    eventId := "legacy_reward_" record.timestampToken "_" record.mode "_"
        . record.attemptId "_" record.revision
    return RegExMatch(eventId, "^[A-Za-z0-9._:-]{8,128}$") ? eventId : ""
}

BuildLegacyFarmHistoryBatch(baseOutbox, records, batchAtUnixMs, &candidate,
    &addedCount, sessionId := "legacy_farm_rewards_v1") {
    candidate := []
    addedCount := 0
    try batchAtUnixMs := Integer(batchAtUnixMs)
    catch
        return false
    if batchAtUnixMs < 1 || batchAtUnixMs >= 9999999999999
        return false
    for entry in baseOutbox {
        if !MetagameOutboxEntryValid(entry)
            return false
        candidate.Push(entry)
    }

    missingEvents := []
    seen := Map()
    for record in records {
        if !IsObject(record) || !record.HasOwnProp("acknowledged")
            || !record.HasOwnProp("at")
            return false
        if record.acknowledged
            continue
        eventId := record.HasOwnProp("exactEventId") && record.exactEventId
            ? record.exactEventId : BuildLegacyFarmRewardEventId(record)
        ; Host rejects timestamps more than two minutes in the future. Keep the
        ; original diagnostic timestamp in the stable ID, but clamp only the
        ; replay time to the migration transaction time so a corrected Windows
        ; clock/timezone cannot block the durable FIFO head forever.
        replayAt := Min(record.at, batchAtUnixMs)
        if !eventId || !TryParseMetagameOutboxFields("MINING_SUCCESS", eventId,
            replayAt, &entry)
            return false
        if seen.Has(eventId)
            continue
        seen[eventId] := true
        if MetagameOutboxContainsCommand(candidate, "MINING_SUCCESS", eventId)
            continue
        missingEvents.Push(entry)
    }
    if !missingEvents.Length
        return true

    if !RegExMatch(sessionId, "^[A-Za-z0-9._:-]{8,128}$")
        return false
    if MetagameOutboxContainsCommand(candidate, "SESSION_BEGIN", sessionId)
        || MetagameOutboxContainsCommand(candidate, "SESSION_END", sessionId)
        return false
    if !MetagameOutboxEnqueue(&candidate, sessionId, batchAtUnixMs,
        "SESSION_BEGIN")
        return false
    for entry in missingEvents
        candidate.Push(entry)
    if !MetagameOutboxEnqueue(&candidate, sessionId, batchAtUnixMs + 1,
        "SESSION_END")
        return false
    addedCount := missingEvents.Length
    return true
}

ReadLegacyFarmHistoryFiles(paths, &records) {
    contents := []
    for path in paths {
        if !FileExist(path)
            continue
        try {
            if FileGetSize(path) > 16777216
                return false
            contents.Push({content: FileRead(path, "UTF-8"),
                support: RegExMatch(path,
                    "i)\\AI採掘機_STONE履歴復元\.log$") != 0})
        } catch
            return false
    }
    return ParseLegacyFarmHistoryContents(contents, &records)
}

LegacyFarmHistorySupportReceiptToken(contents) {
    ; The receipt follows verified support-file content, not only its path or mtime.
    ; A changed export is safely reprocessed while an identical launch is a no-op.
    hash := 2166136261
    Loop Parse String(contents) {
        hash := ((hash ^ Ord(A_LoopField)) * 16777619) & 0xFFFFFFFF
    }
    return Format("{:08X}", hash) "_" StrLen(contents)
}

LegacyFarmHistorySupportReceipt(contents) {
    return "AIMINER_METAGAME_SUPPORT_BACKFILL_V1 "
        . LegacyFarmHistorySupportReceiptToken(contents) "`n"
}

LegacyFarmHistorySupportReceiptComplete(receiptPath, expectedReceipt) {
    if !receiptPath || !expectedReceipt || !FileExist(receiptPath)
        return false
    try return FileRead(receiptPath, "UTF-8") = expectedReceipt
    catch
        return false
}

WriteLegacyFarmHistorySupportReceipt(receiptPath, receiptText) {
    if !receiptPath || !receiptText
        return false
    SplitPath receiptPath, , &directory
    try DirCreate directory
    catch
        return false
    tempPath := receiptPath "." DllCall("GetCurrentProcessId") ".tmp"
    try {
        try FileDelete tempPath
        receiptFile := FileOpen(tempPath, "w", "UTF-8-RAW")
        if !IsObject(receiptFile)
            return false
        receiptFile.Write(receiptText)
        flushed := FlushMetagameFileHandle(receiptFile.Handle)
        receiptFile.Close()
        if !flushed {
            try FileDelete tempPath
            return false
        }
        moved := DllCall("kernel32\MoveFileExW", "Str", tempPath, "Str",
            receiptPath, "UInt", 0x00000009, "Int")
        if !moved {
            try FileDelete tempPath
            return false
        }
        return true
    } catch {
        try receiptFile.Close()
        try FileDelete tempPath
        return false
    }
}

LegacyFarmHistoryBackfillComplete(markerPath) {
    if !markerPath || !FileExist(markerPath)
        return false
    try return FileRead(markerPath, "UTF-8")
        = "AIMINER_METAGAME_FARM_REWARD_BACKFILL_V1`n"
    catch
        return false
}

WriteLegacyFarmHistoryBackfillMarker(markerPath) {
    if !markerPath
        return false
    SplitPath markerPath, , &directory
    try DirCreate directory
    catch
        return false
    tempPath := markerPath "." DllCall("GetCurrentProcessId") ".tmp"
    try {
        try FileDelete tempPath
        markerFile := FileOpen(tempPath, "w", "UTF-8-RAW")
        if !IsObject(markerFile)
            return false
        markerFile.Write("AIMINER_METAGAME_FARM_REWARD_BACKFILL_V1`n")
        flushed := FlushMetagameFileHandle(markerFile.Handle)
        markerFile.Close()
        if !flushed {
            try FileDelete tempPath
            return false
        }
        moved := DllCall("kernel32\MoveFileExW", "Str", tempPath, "Str",
            markerPath, "UInt", 0x00000009, "Int")
        if !moved {
            try FileDelete tempPath
            return false
        }
        return true
    } catch {
        try markerFile.Close()
        try FileDelete tempPath
        return false
    }
}

LegacyDurabilityPathEquals(left, right) {
    return StrLower(RTrim(left, "\/")) = StrLower(RTrim(right, "\/"))
}

AddLegacyDurabilityStorageRoot(&roots, path) {
    global State
    if !path || LegacyDurabilityPathEquals(path, State.persistentDataRoot)
        return
    for existing in roots {
        if LegacyDurabilityPathEquals(path, existing)
            return
    }
    if DirExist(path)
        roots.Push(RTrim(path, "\/"))
}

GetLegacyMetagameStorageRoots() {
    roots := []
    userProfile := EnvGet("USERPROFILE")
    if userProfile
        AddLegacyDurabilityStorageRoot(&roots,
            userProfile "\AppData\Local\AI採掘機")
    localAppData := EnvGet("LOCALAPPDATA")
    if localAppData
        AddLegacyDurabilityStorageRoot(&roots,
            RTrim(localAppData, "\/") "\AI採掘機")
    packagesRoot := userProfile
        ? userProfile "\AppData\Local\Packages" : ""
    if packagesRoot && DirExist(packagesRoot) {
        try {
            Loop Files packagesRoot "\*", "D"
                AddLegacyDurabilityStorageRoot(&roots,
                    A_LoopFileFullPath "\LocalCache\Local\AI採掘機")
        }
    }
    return roots
}

ReadStableLegacyDurabilityFile(path, &contents) {
    contents := ""
    try {
        if FileGetSize(path) > 67108864
            return false
        firstRead := FileRead(path, "UTF-8")
        secondRead := FileRead(path, "UTF-8")
        if firstRead != secondRead
            return false
        contents := firstRead
        return true
    } catch
        return false
}

LegacyDurabilitySourceKey(kind, path, contents) {
    if !RegExMatch(kind, "^[A-Z_]{3,32}$")
        return ""
    return kind "_" LegacyFarmHistorySupportReceiptToken(
        StrLower(path) "`n" contents)
}

LoadLegacyDurabilityReceipts(path) {
    receipts := Map()
    if !path || !FileExist(path)
        return receipts
    try contents := FileRead(path, "UTF-8")
    catch
        return receipts
    lines := StrSplit(StrReplace(contents, "`r", ""), "`n")
    if !lines.Length || lines[1] != "AIMINER_LEGACY_DURABILITY_IMPORT_V1"
        return receipts
    Loop lines.Length - 1 {
        line := lines[A_Index + 1]
        if !line
            continue
        fields := StrSplit(line, "`t")
        if fields.Length != 2
            || !RegExMatch(fields[1],
                "^[A-Z_]{3,32}_[0-9A-F]{8}_[1-9][0-9]{0,10}$")
            continue
        receipts[fields[1]] := fields[2]
    }
    return receipts
}

PersistLegacyDurabilityReceipts(receipts, path) {
    if !IsObject(receipts) || !path
        return false
    SplitPath path, , &directory
    try DirCreate directory
    catch
        return false
    tempPath := path "." DllCall("GetCurrentProcessId") ".tmp"
    try {
        try FileDelete tempPath
        receiptFile := FileOpen(tempPath, "w", "UTF-8-RAW")
        if !IsObject(receiptFile)
            return false
        receiptFile.Write("AIMINER_LEGACY_DURABILITY_IMPORT_V1`n")
        for key, sourcePath in receipts {
            if !RegExMatch(key,
                "^[A-Z_]{3,32}_[0-9A-F]{8}_[1-9][0-9]{0,10}$")
                || InStr(sourcePath, "`r") || InStr(sourcePath, "`n")
                || InStr(sourcePath, "`t") {
                receiptFile.Close()
                try FileDelete tempPath
                return false
            }
            receiptFile.Write(key "`t" sourcePath "`n")
        }
        flushed := FlushMetagameFileHandle(receiptFile.Handle)
        receiptFile.Close()
        if !flushed {
            try FileDelete tempPath
            return false
        }
        moved := DllCall("kernel32\MoveFileExW", "Str", tempPath,
            "Str", path, "UInt", 0x00000009, "Int")
        if !moved {
            try FileDelete tempPath
            return false
        }
        return true
    } catch {
        try receiptFile.Close()
        try FileDelete tempPath
        return false
    }
}

PersistImmutableLegacyDurabilityBackup(label, sourceKey, contents) {
    global State
    if !RegExMatch(label, "^[a-z-]{3,32}$")
        || !RegExMatch(sourceKey,
            "^[A-Z_]{3,32}_[0-9A-F]{8}_[1-9][0-9]{0,10}$")
        return false
    try DirCreate State.legacyDurabilityBackupRoot
    catch
        return false
    backupPath := State.legacyDurabilityBackupRoot "\" label "-"
        . sourceKey ".tsv"
    if FileExist(backupPath) {
        try return FileRead(backupPath, "UTF-8") = contents
        catch
            return false
    }
    tempPath := backupPath "." DllCall("GetCurrentProcessId") ".tmp"
    try {
        try FileDelete tempPath
        backupFile := FileOpen(tempPath, "w", "UTF-8-RAW")
        if !IsObject(backupFile)
            return false
        backupFile.Write(contents)
        flushed := FlushMetagameFileHandle(backupFile.Handle)
        backupFile.Close()
        if !flushed {
            try FileDelete tempPath
            return false
        }
        moved := DllCall("kernel32\MoveFileExW", "Str", tempPath,
            "Str", backupPath, "UInt", 0x00000008, "Int")
        if !moved {
            try FileDelete tempPath
            try return FileRead(backupPath, "UTF-8") = contents
            catch
                return false
        }
        return true
    } catch {
        try backupFile.Close()
        try FileDelete tempPath
        return false
    }
}

BuildMergedLegacyDurabilityOutbox(canonicalOutbox, importedOutboxes,
    &candidate, &addedCount) {
    candidate := []
    addedCount := 0
    miningEntries := []
    seen := Map()
    for entry in canonicalOutbox {
        if !MetagameOutboxEntryValid(entry)
            return false
        if entry.command = "MINING_SUCCESS" && !seen.Has(entry.id) {
            seen[entry.id] := true
            miningEntries.Push(entry)
        }
        candidate.Push(entry)
    }
    for imported in importedOutboxes {
        for entry in imported {
            if !MetagameOutboxEntryValid(entry)
                return false
            if entry.command != "MINING_SUCCESS" || seen.Has(entry.id)
                continue
            seen[entry.id] := true
            miningEntries.Push(entry)
            addedCount += 1
        }
    }
    if !addedCount
        return true

    recoveryAt := UnixTimeMilliseconds()
    sessionId := "legacy_durability_v1_" recoveryAt "_" addedCount
    candidate := []
    if !MetagameOutboxEnqueue(&candidate, sessionId, recoveryAt,
        "SESSION_BEGIN")
        return false
    for entry in miningEntries {
        if !TryParseMetagameOutboxFields("MINING_SUCCESS", entry.id,
            Min(Integer(entry.at), recoveryAt), &replayEntry)
            return false
        candidate.Push(replayEntry)
    }
    return MetagameOutboxEnqueue(&candidate, sessionId, recoveryAt + 1,
        "SESSION_END")
}

MergeVerifiedRewardWalPending(source, &candidate, &addedCount) {
    for eventId, entry in source {
        if !VerifiedRewardWalEntryValid(entry)
            return false
        if candidate.Has(eventId) {
            existing := candidate[eventId]
            if existing.mode != entry.mode
                || existing.revision != entry.revision
                || existing.at != entry.at
                return false
            continue
        }
        candidate[eventId] := {id: entry.id, mode: entry.mode,
            revision: Integer(entry.revision), at: Integer(entry.at)}
        addedCount += 1
    }
    return true
}

PersistVerifiedRewardWalSnapshot(pending, path) {
    if !IsObject(pending) || !path
        return false
    SplitPath path, , &directory
    try DirCreate directory
    catch
        return false
    tempPath := path "." DllCall("GetCurrentProcessId") ".migration.tmp"
    try {
        try FileDelete tempPath
        walFile := FileOpen(tempPath, "w", "UTF-8-RAW")
        if !IsObject(walFile)
            return false
        walFile.Write("AIMINERREWARDWAL1`n")
        for eventId, entry in pending {
            if eventId != entry.id || !VerifiedRewardWalEntryValid(entry) {
                walFile.Close()
                try FileDelete tempPath
                return false
            }
            walFile.Write("E`t" eventId "`t" entry.mode "`t"
                Integer(entry.revision) "`t" Integer(entry.at) "`n")
        }
        flushed := FlushMetagameFileHandle(walFile.Handle)
        walFile.Close()
        if !flushed {
            try FileDelete tempPath
            return false
        }
        moved := DllCall("kernel32\MoveFileExW", "Str", tempPath,
            "Str", path, "UInt", 0x00000009, "Int")
        if !moved {
            try FileDelete tempPath
            return false
        }
        return true
    } catch {
        try walFile.Close()
        try FileDelete tempPath
        return false
    }
}

MigrateLegacyMetagameDurabilityFiles() {
    global State
    try DirCreate State.persistentDataRoot
    catch
        return false

    canonicalOutbox := []
    canonicalOutboxContents := ""
    if FileExist(State.metagameOutboxPath) {
        if !ReadStableLegacyDurabilityFile(State.metagameOutboxPath,
            &canonicalOutboxContents)
            || !ParseMetagameOutboxContents(canonicalOutboxContents,
                &canonicalOutbox)
            return false
    }
    canonicalWal := Map()
    canonicalWalContents := ""
    canonicalWalOps := 0
    if FileExist(State.verifiedRewardWalPath) {
        if !ReadStableLegacyDurabilityFile(State.verifiedRewardWalPath,
            &canonicalWalContents)
            || !ParseVerifiedRewardWalContents(canonicalWalContents,
                &canonicalWal, &canonicalWalOps)
            return false
    }

    receipts := LoadLegacyDurabilityReceipts(
        State.legacyDurabilityReceiptPath)
    pendingReceipts := []
    importedOutboxes := []
    importedWals := []
    for storageRoot in GetLegacyMetagameStorageRoots() {
        for source in [
            {kind: "OUTBOX", name: "metagame-outbox.tsv",
                backup: "legacy-outbox"},
            {kind: "WAL", name: "verified-reward-wal.tsv",
                backup: "legacy-wal"}] {
            sourcePath := storageRoot "\" source.name
            if !FileExist(sourcePath)
                continue
            if !ReadStableLegacyDurabilityFile(sourcePath, &contents)
                return false
            sourceKey := LegacyDurabilitySourceKey(source.kind,
                sourcePath, contents)
            if !sourceKey
                return false
            if receipts.Has(sourceKey)
                continue
            if !PersistImmutableLegacyDurabilityBackup(source.backup,
                sourceKey, contents)
                return false
            pendingReceipts.Push({key: sourceKey, path: sourcePath})
            if source.kind = "OUTBOX" {
                if ParseMetagameOutboxContents(contents, &importedOutbox)
                    importedOutboxes.Push(importedOutbox)
            } else {
                importedWalOps := 0
                if ParseVerifiedRewardWalContents(contents, &importedWal,
                    &importedWalOps)
                    importedWals.Push(importedWal)
            }
        }
    }
    if !pendingReceipts.Length
        return true

    if !BuildMergedLegacyDurabilityOutbox(canonicalOutbox,
        importedOutboxes, &mergedOutbox, &outboxAdded)
        return false
    mergedWal := Map()
    walAdded := 0
    if !MergeVerifiedRewardWalPending(canonicalWal, &mergedWal, &walAdded)
        return false
    canonicalWalCount := mergedWal.Count
    for importedWal in importedWals {
        if !MergeVerifiedRewardWalPending(importedWal, &mergedWal, &walAdded)
            return false
    }

    if outboxAdded {
        if canonicalOutboxContents {
            canonicalKey := LegacyDurabilitySourceKey("CANONICAL_OUTBOX",
                State.metagameOutboxPath, canonicalOutboxContents)
            if !PersistImmutableLegacyDurabilityBackup("canonical-outbox",
                canonicalKey, canonicalOutboxContents)
                return false
        }
        if !PersistMetagameOutbox(mergedOutbox, State.metagameOutboxPath)
            return false
    }
    if mergedWal.Count != canonicalWalCount {
        if canonicalWalContents {
            canonicalKey := LegacyDurabilitySourceKey("CANONICAL_WAL",
                State.verifiedRewardWalPath, canonicalWalContents)
            if !PersistImmutableLegacyDurabilityBackup("canonical-wal",
                canonicalKey, canonicalWalContents)
                return false
        }
        if !PersistVerifiedRewardWalSnapshot(mergedWal,
            State.verifiedRewardWalPath)
            return false
    }
    for receipt in pendingReceipts
        receipts[receipt.key] := receipt.path
    return PersistLegacyDurabilityReceipts(receipts,
        State.legacyDurabilityReceiptPath)
}

RunLegacyFarmHistoryBackfill(supportPathOverride := "") {
    global State
    if !State.metagameReplayNormalized
        return false
    normalPending := !LegacyFarmHistoryBackfillComplete(
        State.metagameBackfillMarkerPath)
    ; Validation fixtures must never mix a real installation's support export into
    ; their deterministic record count. Production callers omit the override.
    supportPath := supportPathOverride
        ? supportPathOverride
        : A_ScriptDir "\AI採掘機_STONE履歴復元.log"
    supportExists := FileExist(supportPath)
    supportReceipt := ""
    supportPending := false
    if supportExists {
        try supportContents := FileRead(supportPath, "UTF-8")
        catch
            return false
        supportReceipt := LegacyFarmHistorySupportReceipt(supportContents)
        supportPending := !LegacyFarmHistorySupportReceiptComplete(
            State.metagameSupportBackfillReceiptPath, supportReceipt)
    }
    if !normalPending && !supportPending
        return true
    ; A support-assisted recovery export is optional and never shipped in the
    ; application bundle. Feed it through the same strict session-aware parser
    ; before the normal rotations so copied, audited rewards can be recovered.
    paths := [supportPath,
        State.diagnosticPath ".2", State.diagnosticPath ".1",
        State.diagnosticPath]
    if !ReadLegacyFarmHistoryFiles(paths, &records)
        return false
    selectedRecords := []
    hasNormalRecords := false
    hasSupportRecords := false
    for record in records {
        if record.normalSource
            hasNormalRecords := true
        if record.supportSource
            hasSupportRecords := true
        if (normalPending && record.normalSource)
            || (supportPending && record.supportSource)
            selectedRecords.Push(record)
    }
    ; An empty normal install remains eligible for a later rotated log. An existing
    ; support export receives its independent content receipt even when it contains
    ; no complete verified rows, so an unchanged torn export is not retried forever.
    if !selectedRecords.Length && !supportPending
        return true
    batchSessionId := normalPending && hasNormalRecords
        ? "legacy_farm_rewards_v1"
        : "legacy_farm_support_v1_"
            . LegacyFarmHistorySupportReceiptToken(supportContents)
    if !BuildLegacyFarmHistoryBatch(State.metagameOutbox, selectedRecords,
        UnixTimeMilliseconds(), &candidate, &addedCount, batchSessionId)
        return false
    batchPersisted := candidate.Length != State.metagameOutbox.Length
    if batchPersisted {
        persisted := false
        Loop 3 {
            if PersistMetagameOutbox(candidate, State.metagameOutboxPath) {
                persisted := true
                break
            }
            if A_Index < 3
                Sleep 20
        }
        if !persisted
            return false
    }
    if normalPending && hasNormalRecords {
        markerWritten := false
        Loop 3 {
            if WriteLegacyFarmHistoryBackfillMarker(
                State.metagameBackfillMarkerPath) {
                markerWritten := true
                break
            }
            if A_Index < 3
                Sleep 20
        }
        if !markerWritten
            return false
    }
    if supportPending {
        receiptWritten := false
        Loop 3 {
            if WriteLegacyFarmHistorySupportReceipt(
                State.metagameSupportBackfillReceiptPath, supportReceipt) {
                receiptWritten := true
                break
            }
            if A_Index < 3
                Sleep 20
        }
        if !receiptWritten
            return false
    }
    State.metagameOutbox := candidate
    State.metagameOutboxDirty := false
    if batchPersisted {
        State.metagameJournalReady := true
        State.metagameJournalOps := 0
    }
    State.metagameReplayNormalized := true
    return true
}

TestLegacyFarmHistoryBackfillIntegration(fixture, expectedOutboxLength) {
    global State, testRunId
    testRoot := A_Temp "\ai-miner-meta-history-integration-" testRunId
    testLogPath := testRoot "\AI採掘機_診断.log"
    testOutboxPath := testRoot "\outbox.tsv"
    testMarkerPath := testRoot "\backfill.done"
    testSupportReceiptPath := testRoot "\support-backfill.done"
    testSupportLogPath := testRoot "\support-history.log"
    saved := {
        diagnosticPath: State.diagnosticPath,
        outboxPath: State.metagameOutboxPath,
        markerPath: State.metagameBackfillMarkerPath,
        supportReceiptPath: State.metagameSupportBackfillReceiptPath,
        outbox: State.metagameOutbox,
        outboxDirty: State.metagameOutboxDirty,
        replayNormalized: State.metagameReplayNormalized,
        journalReady: State.metagameJournalReady,
        journalOps: State.metagameJournalOps
    }
    passed := false
    try {
        try DirCreate testRoot
        try FileDelete testLogPath
        try FileDelete testOutboxPath
        try FileDelete testMarkerPath
        try FileDelete testSupportReceiptPath
        try FileDelete testSupportLogPath
        fixtureFile := FileOpen(testLogPath, "w", "UTF-8-RAW")
        if !IsObject(fixtureFile)
            return false
        fixtureFile.Write(fixture)
        fixtureFile.Close()

        State.diagnosticPath := testLogPath
        State.metagameOutboxPath := testOutboxPath
        State.metagameBackfillMarkerPath := testMarkerPath
        State.metagameSupportBackfillReceiptPath := testSupportReceiptPath
        State.metagameOutbox := []
        State.metagameOutboxDirty := false
        State.metagameReplayNormalized := true
        State.metagameJournalReady := false
        State.metagameJournalOps := 0

        firstRun := RunLegacyFarmHistoryBackfill(testSupportLogPath)
        diskOutbox := firstRun ? LoadMetagameOutbox(testOutboxPath) : []
        firstRunOk := firstRun
            && LegacyFarmHistoryBackfillComplete(testMarkerPath)
            && State.metagameOutbox.Length = expectedOutboxLength
            && diskOutbox.Length = expectedOutboxLength
            && diskOutbox[1].command = "SESSION_BEGIN"
            && diskOutbox[diskOutbox.Length].command = "SESSION_END"

        ; Simulate a complete application restart. The marker must prevent a second
        ; synthetic session and the durable FIFO must remain byte-for-byte equivalent.
        State.metagameOutbox := diskOutbox
        State.metagameReplayNormalized := true
        secondRun := RunLegacyFarmHistoryBackfill(testSupportLogPath)
        passed := firstRunOk && secondRun
            && State.metagameOutbox.Length = expectedOutboxLength
            && LoadMetagameOutbox(testOutboxPath).Length = expectedOutboxLength
    } catch {
        passed := false
    } finally {
        State.diagnosticPath := saved.diagnosticPath
        State.metagameOutboxPath := saved.outboxPath
        State.metagameBackfillMarkerPath := saved.markerPath
        State.metagameSupportBackfillReceiptPath := saved.supportReceiptPath
        State.metagameOutbox := saved.outbox
        State.metagameOutboxDirty := saved.outboxDirty
        State.metagameReplayNormalized := saved.replayNormalized
        State.metagameJournalReady := saved.journalReady
        State.metagameJournalOps := saved.journalOps
        try FileDelete testLogPath
        try FileDelete testOutboxPath
        try FileDelete testMarkerPath
        try FileDelete testSupportReceiptPath
        try FileDelete testSupportLogPath
        try DirDelete testRoot
    }
    return passed
}

VerifiedRewardWalEntryValid(entry) {
    if !IsObject(entry) || !entry.HasOwnProp("id")
        || !entry.HasOwnProp("mode") || !entry.HasOwnProp("revision")
        || !entry.HasOwnProp("at")
        || !RegExMatch(entry.id, "^[A-Za-z0-9._:-]{8,128}$")
        || !IsSupportedStoneActivityMode(entry.mode)
        return false
    try {
        revision := Integer(entry.revision)
        eventAt := Integer(entry.at)
    } catch
        return false
    return revision >= 1 && revision <= 999999999999999999
        && eventAt >= 1 && eventAt <= 9999999999999
}

LoadVerifiedRewardWal(path, &pending, &operationCount) {
    pending := Map()
    operationCount := 0
    if !path || !FileExist(path)
        return true
    try content := FileRead(path, "UTF-8")
    catch
        return false
    return ParseVerifiedRewardWalContents(content, &pending, &operationCount)
}

ParseVerifiedRewardWalContents(content, &pending, &operationCount) {
    pending := Map()
    operationCount := 0
    lines := StrSplit(StrReplace(content, "`r", ""), "`n")
    if !lines.Length || lines[1] != "AIMINERREWARDWAL1"
        return false
    resolved := Map()
    Loop lines.Length - 1 {
        line := lines[A_Index + 1]
        if !line
            continue
        fields := StrSplit(line, "`t")
        if fields[1] = "E" && fields.Length = 5 {
            entry := {id: fields[2], mode: fields[3], revision: fields[4],
                at: fields[5]}
            if !VerifiedRewardWalEntryValid(entry)
                continue
            entry.revision := Integer(entry.revision)
            entry.at := Integer(entry.at)
            if !resolved.Has(entry.id) && !pending.Has(entry.id)
                pending[entry.id] := entry
        } else if fields[1] = "A" && fields.Length = 2 {
            if !RegExMatch(fields[2], "^[A-Za-z0-9._:-]{8,128}$")
                continue
            pending.Delete(fields[2])
            resolved[fields[2]] := true
        } else
            ; A leading newline makes an interrupted append its own physical row.
            ; Ignore that torn row: a torn E was never committed, while a torn A
            ; safely leaves the E pending for same-ID replay.
            continue
        operationCount += 1
        if operationCount > 262144
            return false
    }
    return true
}

AppendVerifiedRewardWalRecord(recordLine) {
    global State
    path := State.verifiedRewardWalPath
    if !path || InStr(recordLine, "`r") || InStr(recordLine, "`n")
        return false
    SplitPath path, , &directory
    try DirCreate directory
    catch
        return false
    try newFile := !FileExist(path) || FileGetSize(path) = 0
    catch
        return false
    if newFile {
        tempPath := path "." DllCall("GetCurrentProcessId") ".init.tmp"
        try {
            try FileDelete tempPath
            walFile := FileOpen(tempPath, "w", "UTF-8-RAW")
            if !IsObject(walFile)
                return false
            walFile.Write("AIMINERREWARDWAL1`n" recordLine "`n")
            flushed := FlushMetagameFileHandle(walFile.Handle)
            walFile.Close()
            if !flushed {
                try FileDelete tempPath
                return false
            }
            moved := DllCall("kernel32\MoveFileExW", "Str", tempPath,
                "Str", path, "UInt", 0x00000009, "Int")
            if !moved {
                try FileDelete tempPath
                return false
            }
            return true
        } catch {
            try walFile.Close()
            try FileDelete tempPath
            return false
        }
    }
    try {
        walFile := FileOpen(path, "a", "UTF-8-RAW")
        if !IsObject(walFile)
            return false
        ; Prefix every append. If Windows stops during this write, the next retry
        ; starts on a fresh row instead of concatenating onto a torn record.
        walFile.Write("`n" recordLine)
        flushed := FlushMetagameFileHandle(walFile.Handle)
        walFile.Close()
        return flushed
    } catch {
        try walFile.Close()
        return false
    }
}

PersistVerifiedRewardIntent(eventId, actionMode, snapshotRevision,
    eventAtUnixMs, &persistedAtUnixMs) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        persistedAtUnixMs := 0
        if State.verifiedRewardWalPending.Has(eventId) {
            entry := State.verifiedRewardWalPending[eventId]
            if entry.mode != actionMode || entry.revision != snapshotRevision
                return false
            persistedAtUnixMs := entry.at
            return true
        }
        entry := {id: eventId, mode: actionMode, revision: snapshotRevision,
            at: eventAtUnixMs}
        if !VerifiedRewardWalEntryValid(entry)
            return false
        if !AppendVerifiedRewardWalRecord("E`t" entry.id "`t" entry.mode
            "`t" entry.revision "`t" entry.at)
            return false
        ; The fsync and matching in-memory pending row are one non-interruptible
        ; transaction, so F9/F8 cannot strand an E until a full process restart.
        State.verifiedRewardWalPending[entry.id] := entry
        State.verifiedRewardWalOps += 1
        persistedAtUnixMs := entry.at
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

CommitVerifiedRewardIntent(eventId) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !State.verifiedRewardWalPending.Has(eventId)
            return true
        if !AppendVerifiedRewardWalRecord("A`t" eventId)
            return false
        State.verifiedRewardWalPending.Delete(eventId)
        State.verifiedRewardWalOps += 1
        MaybeCompactVerifiedRewardWal()
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

MaybeCompactVerifiedRewardWal() {
    global State
    if State.verifiedRewardWalOps < 512
        return true
    path := State.verifiedRewardWalPath
    tempPath := path "." DllCall("GetCurrentProcessId") ".tmp"
    try {
        try FileDelete tempPath
        walFile := FileOpen(tempPath, "w", "UTF-8-RAW")
        if !IsObject(walFile)
            return false
        walFile.Write("AIMINERREWARDWAL1`n")
        for eventId, entry in State.verifiedRewardWalPending
            walFile.Write("E`t" eventId "`t" entry.mode "`t"
                entry.revision "`t" entry.at "`n")
        flushed := FlushMetagameFileHandle(walFile.Handle)
        walFile.Close()
        if !flushed {
            try FileDelete tempPath
            return false
        }
        moved := DllCall("kernel32\MoveFileExW", "Str", tempPath, "Str",
            path, "UInt", 0x00000009, "Int")
        if !moved {
            try FileDelete tempPath
            return false
        }
        State.verifiedRewardWalOps := State.verifiedRewardWalPending.Count
        return true
    } catch {
        try walFile.Close()
        try FileDelete tempPath
        return false
    }
}

RecoverVerifiedRewardWal(beforeMemoryCommit := 0) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !State.metagameReplayNormalized
            return false
        if !State.verifiedRewardWalPending.Count
            return true
        candidate := []
        for queued in State.metagameOutbox {
            if !MetagameOutboxEntryValid(queued)
                return false
            candidate.Push(queued)
        }
        missing := []
        recoveredIds := []
        for eventId, entry in State.verifiedRewardWalPending {
            if !VerifiedRewardWalEntryValid(entry)
                return false
            if !MetagameOutboxContainsCommand(candidate, "MINING_SUCCESS",
                eventId) {
                missing.Push(entry)
            }
            recoveredIds.Push(eventId)
        }
        if missing.Length {
            recoveredAt := UnixTimeMilliseconds()
            recoverySessionId := "reward_wal_recovery_" recoveredAt "_"
                . missing.Length
            if !MetagameOutboxEnqueue(&candidate, recoverySessionId,
                recoveredAt, "SESSION_BEGIN")
                return false
            for entry in missing {
                replayAt := Min(entry.at, recoveredAt)
                if !MetagameOutboxEnqueue(&candidate, entry.id, replayAt)
                    return false
            }
            if !MetagameOutboxEnqueue(&candidate, recoverySessionId,
                recoveredAt + 1, "SESSION_END")
                return false
            persisted := false
            Loop 3 {
                if PersistMetagameOutbox(candidate, State.metagameOutboxPath) {
                    persisted := true
                    break
                }
                if A_Index < 3
                    Sleep 20
            }
            if !persisted
                return false
        }
        if IsObject(beforeMemoryCommit) && HasMethod(beforeMemoryCommit, "Call")
            beforeMemoryCommit.Call()
        ; ACK/reset callbacks cannot interleave with this copy-on-write transaction.
        ; Disk replacement precedes memory replacement, which precedes every WAL A.
        State.metagameOutbox := candidate
        State.metagameOutboxDirty := false
        if missing.Length {
            State.metagameJournalReady := true
            State.metagameJournalOps := 0
        }
        for eventId in recoveredIds {
            if !CommitVerifiedRewardIntent(eventId)
                return false
        }
        WriteDiagnostic("STONE_REWARD_WAL_RECOVERED count=" recoveredIds.Length)
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

MetagameRetryBackoffMs(retryWindow) {
    return Min(30000, 2000 * (2 ** Min(Max(1, retryWindow), 4)))
}

EnterMetagameOutboxCritical() {
    ; AHK timers and WM_COPYDATA callbacks are otherwise allowed to interrupt after
    ; every line (`Thread "Interrupt", 0`). Preserve an enclosing Critical section
    ; while making the outermost outbox transaction non-interruptible.
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    return criticalWasOn
}

LeaveMetagameOutboxCritical(criticalWasOn) {
    if !criticalWasOn
        Critical "Off"
}

TryGetMetagameOutboxHead(&entry) {
    global State
    entry := 0
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !State.metagameOutbox.Length
            return false
        entry := State.metagameOutbox[1]
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

ScheduleMetagameInterleaveSelfTestAck(*) {
    global MetagameInterleaveTimerRan, MetagameInterleaveTimerRanInside
    SetTimer RunMetagameInterleaveSelfTestAck, -1
    ; The timer becomes due while DurablyEnqueueMetagameEvent is between its
    ; flushed E record and memory Push. Critical must defer it past the Push.
    Sleep 35
    MetagameInterleaveTimerRanInside := MetagameInterleaveTimerRan
}

RunMetagameInterleaveSelfTestAck(*) {
    global State, MetagameInterleaveAckCommand, MetagameInterleaveAckId
    global MetagameInterleaveAckOk, MetagameInterleaveAckSawCount
    global MetagameInterleaveTimerRan
    MetagameInterleaveAckSawCount := State.metagameOutbox.Length
    MetagameInterleaveAckOk := AcknowledgeMetagameEvent(
        MetagameInterleaveAckCommand, MetagameInterleaveAckId)
    MetagameInterleaveTimerRan := true
    SetTimer FlushMetagameOutboxReplay, 0
}

ProbeRewardWalRecoveryCriticalSelfTest(*) {
    global RewardWalRecoveryCriticalObserved, RewardWalRecoveryTimerRan
    global RewardWalRecoveryTimerRanInside
    RewardWalRecoveryCriticalObserved := A_IsCritical != 0
    SetTimer RunRewardWalRecoveryCriticalSelfTestTimer, -1
    Sleep 35
    RewardWalRecoveryTimerRanInside := RewardWalRecoveryTimerRan
}

RunRewardWalRecoveryCriticalSelfTestTimer(*) {
    global RewardWalRecoveryTimerRan
    RewardWalRecoveryTimerRan := true
}

ProbeMetagameResetCriticalSelfTest(*) {
    global MetagameResetCriticalObserved, MetagameResetTimerRan
    global MetagameResetTimerRanInside
    ; Called after reset copied/rebased the FIFO but before it replaces disk/state.
    ; Any Farm timer at this boundary must still be deferred.
    MetagameResetCriticalObserved := A_IsCritical != 0
    SetTimer RunMetagameResetInterleaveSelfTestEnqueue, -1
    Sleep 35
    MetagameResetTimerRanInside := MetagameResetTimerRan
}

RunMetagameResetInterleaveSelfTestEnqueue(*) {
    global State, MetagameResetInterleaveMiningId
    global MetagameResetInterleaveEnqueueOk, MetagameResetInterleaveSawSession
    global MetagameResetTimerRan
    MetagameResetInterleaveSawSession := State.farmSessionId
    MetagameResetInterleaveEnqueueOk := DurablyEnqueueMetagameEvent(
        "MINING_SUCCESS", MetagameResetInterleaveMiningId, 1893456007500)
    MetagameResetTimerRan := true
    SetTimer FlushMetagameOutboxReplay, 0
}

LoadMetagameOutbox(path) {
    outbox := []
    if !path || !FileExist(path)
        return outbox
    try content := FileRead(path, "UTF-8")
    catch
        return outbox
    ParseMetagameOutboxContents(content, &outbox)
    return outbox
}

ParseMetagameOutboxContents(content, &outbox) {
    outbox := []
    lines := StrSplit(StrReplace(content, "`r", ""), "`n")
    if !lines.Length
        return false
    header := lines[1]
    if header = "AIUIMETAOUTBOX3" {
        journal := []
        headIndex := 1
        seen := Map()
        Loop lines.Length - 1 {
            line := lines[A_Index + 1]
            if !line
                continue
            fields := StrSplit(line, "`t")
            if fields[1] = "E" && fields.Length = 4 {
                if !TryParseMetagameOutboxFields(fields[2], fields[3],
                    fields[4], &entry)
                    continue
                key := entry.command "|" entry.id
                if seen.Has(key)
                    continue
                seen[key] := true
                journal.Push(entry)
            } else if fields[1] = "A" && fields.Length = 3 {
                ; ACK records are accepted only in FIFO order. A torn or corrupt
                ; tail therefore cannot delete an unrelated event.
                if headIndex <= journal.Length
                    && journal[headIndex].command = fields[2]
                    && journal[headIndex].id = fields[3]
                    headIndex += 1
            }
        }
        if headIndex <= journal.Length {
            Loop journal.Length - headIndex + 1
                outbox.Push(journal[headIndex + A_Index - 1])
        }
        return true
    }
    if header != "AIUIMETAOUTBOX1" && header != "AIUIMETAOUTBOX2"
        return false
    legacyFormat := header = "AIUIMETAOUTBOX1"
    seen := Map()
    Loop lines.Length - 1 {
        line := lines[A_Index + 1]
        if !line
            continue
        fields := StrSplit(line, "`t")
        if (legacyFormat && fields.Length != 2)
            || (!legacyFormat && fields.Length != 3)
            continue
        command := legacyFormat ? "MINING_SUCCESS" : fields[1]
        eventId := legacyFormat ? fields[1] : fields[2]
        timestampField := legacyFormat ? fields[2] : fields[3]
        if !TryParseMetagameOutboxFields(command, eventId,
            timestampField, &entry)
            continue
        key := entry.command "|" entry.id
        if seen.Has(key)
            continue
        seen[key] := true
        outbox.Push(entry)
    }
    return true
}

TryParseMetagameOutboxFields(command, eventId, timestampField, &entry) {
    entry := 0
    if command != "SESSION_BEGIN" && command != "MINING_SUCCESS"
        && command != "SESSION_END"
        return false
    if !RegExMatch(eventId, "^[A-Za-z0-9._:-]{8,128}$")
        return false
    try eventAt := Integer(timestampField)
    catch
        return false
    if eventAt < 1 || eventAt > 9999999999999
        return false
    entry := {command: command, id: eventId, at: eventAt, retries: 0,
        nextAt: 0, windows: 0, enqueued: false}
    return true
}

MetagameOutboxEntryValid(entry) {
    if !IsObject(entry)
        || !entry.HasOwnProp("command") || !entry.HasOwnProp("id")
        || !entry.HasOwnProp("at")
        || (entry.command != "SESSION_BEGIN"
            && entry.command != "MINING_SUCCESS"
            && entry.command != "SESSION_END")
        || !RegExMatch(entry.id, "^[A-Za-z0-9._:-]{8,128}$")
        return false
    try eventAt := Integer(entry.at)
    catch
        return false
    return eventAt >= 1 && eventAt <= 9999999999999
}

PersistMetagameOutbox(outbox, path) {
    if !path
        return false
    SplitPath path, , &directory
    try DirCreate directory
    catch
        return false
    tempPath := path "." DllCall("GetCurrentProcessId") ".tmp"
    try {
        try FileDelete tempPath
        outboxFile := FileOpen(tempPath, "w", "UTF-8-RAW")
        if !IsObject(outboxFile)
            return false
        outboxFile.Write("AIUIMETAOUTBOX3`n")
        for entry in outbox {
            if !MetagameOutboxEntryValid(entry) {
                outboxFile.Close()
                try FileDelete tempPath
                return false
            }
            outboxFile.Write("E`t" entry.command "`t" entry.id "`t"
                Integer(entry.at) "`n")
        }
        flushed := FlushMetagameFileHandle(outboxFile.Handle)
        outboxFile.Close()
        if !flushed {
            try FileDelete tempPath
            return false
        }
        ; Same-volume replace with write-through keeps either the previous complete
        ; file or the new complete file after a crash; a partial FIFO is never read.
        moved := DllCall("kernel32\MoveFileExW", "Str", tempPath, "Str", path,
            "UInt", 0x00000009, "Int")
        if !moved {
            try FileDelete tempPath
            return false
        }
        return true
    } catch {
        try FileDelete tempPath
        return false
    }
}

FlushMetagameFileHandle(fileHandle) {
    return fileHandle
        && DllCall("kernel32\FlushFileBuffers", "Ptr", fileHandle, "Int") != 0
}

EnsureMetagameJournalReady() {
    global State
    if State.metagameJournalReady
        return true
    isJournal := false
    if FileExist(State.metagameOutboxPath) {
        try {
            journalFile := FileOpen(State.metagameOutboxPath, "r", "UTF-8")
            if IsObject(journalFile) {
                isJournal := RTrim(journalFile.ReadLine(), "`r`n")
                    = "AIUIMETAOUTBOX3"
                journalFile.Close()
            }
        }
    }
    if !isJournal && !PersistMetagameOutboxWithRetry()
        return false
    State.metagameJournalReady := true
    State.metagameJournalOps := 0
    return true
}

AppendMetagameJournalRecord(recordLine) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !EnsureMetagameJournalReady()
            return false
        try {
            journalFile := FileOpen(State.metagameOutboxPath, "a", "UTF-8-RAW")
            if !IsObject(journalFile)
                return false
            ; A leading newline is intentional. If the previous process died halfway
            ; through a record, this terminates that malformed tail before the next E/A
            ; record, so one torn write cannot consume a later verified reward.
            journalFile.Write("`n" recordLine "`n")
            flushed := FlushMetagameFileHandle(journalFile.Handle)
            journalFile.Close()
            if !flushed
                return false
            State.metagameJournalOps += 1
            return true
        } catch {
            try journalFile.Close()
            return false
        }
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

MaybeCompactMetagameJournal() {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        try journalBytes := FileGetSize(State.metagameOutboxPath)
        catch {
            journalBytes := 0
        }
        if State.metagameJournalOps < 256 && journalBytes < 1048576
            return true
        if !PersistMetagameOutboxWithRetry()
            return false
        State.metagameJournalReady := true
        State.metagameJournalOps := 0
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

PersistMetagameOutboxWithRetry() {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        persisted := PersistMetagameOutboxArrayWithRetry(State.metagameOutbox)
        if persisted {
            State.metagameOutboxDirty := false
            State.metagameJournalReady := true
            State.metagameJournalOps := 0
        }
        return persisted
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

PersistMetagameOutboxArrayWithRetry(outbox) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        Loop 3 {
            if PersistMetagameOutbox(outbox, State.metagameOutboxPath)
                return true
            if A_Index < 3
                Sleep 20
        }
        WriteDiagnostic("METAGAME_OUTBOX_PERSIST_ERROR count="
            outbox.Length)
        return false
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

MetagameOutboxContains(outbox, eventId) {
    for entry in outbox {
        if entry.id = eventId
            return true
    }
    return false
}

MetagameOutboxContainsCommand(outbox, command, eventId) {
    for entry in outbox {
        if entry.command = command && entry.id = eventId
            return true
    }
    return false
}

RebaseMetagameOutboxForSession(&outbox, sessionId, startedAtUnixMs,
    includeEnd := false, endedAtUnixMs := 0) {
    if !RegExMatch(sessionId, "^[A-Za-z0-9._:-]{8,128}$")
        return false
    retainedMining := []
    for entry in outbox {
        if entry.command = "MINING_SUCCESS"
            retainedMining.Push(entry)
    }
    replacement := []
    if !MetagameOutboxEnqueue(&replacement, sessionId, startedAtUnixMs,
        "SESSION_BEGIN")
        return false
    for entry in retainedMining
        replacement.Push(entry)
    if includeEnd {
        if endedAtUnixMs < startedAtUnixMs
            return false
        if !MetagameOutboxEnqueue(&replacement, sessionId, endedAtUnixMs,
            "SESSION_END")
            return false
    }
    outbox := replacement
    return true
}

MetagameResetRequiresEnd(running, stopInProgress, outbox, sessionId) {
    if !running || stopInProgress
        return true
    return sessionId
        && MetagameOutboxContainsCommand(outbox, "SESSION_END", sessionId)
}

BuildClampedMetagameReplayOutbox(outbox, recoveryAtUnixMs, &candidate,
    &changedCount) {
    candidate := outbox
    changedCount := 0
    try recoveryAtUnixMs := Integer(recoveryAtUnixMs)
    catch
        return false
    if recoveryAtUnixMs < 1 || recoveryAtUnixMs > 9999999999999
        return false
    for entry in outbox {
        if !MetagameOutboxEntryValid(entry)
            return false
        if entry.at > recoveryAtUnixMs
            changedCount += 1
    }
    if !changedCount
        return true
    ; Build a deep candidate so an fsync/replace failure cannot mutate the live
    ; FIFO before the replacement is durable. Runtime retry metadata is preserved.
    candidate := []
    for entry in outbox
        candidate.Push({command: entry.command, id: entry.id,
            at: Min(Integer(entry.at), recoveryAtUnixMs),
            retries: entry.HasOwnProp("retries") ? entry.retries : 0,
            nextAt: entry.HasOwnProp("nextAt") ? entry.nextAt : 0,
            windows: entry.HasOwnProp("windows") ? entry.windows : 0,
            enqueued: entry.HasOwnProp("enqueued") ? entry.enqueued : false})
    return true
}

ClampMetagameReplayFutureTimestamps(outbox, recoveryAtUnixMs, &changed) {
    if !BuildClampedMetagameReplayOutbox(outbox, recoveryAtUnixMs,
        &candidate, &changedCount)
        return false
    changed := changedCount > 0
    if changed {
        Loop outbox.Length
            outbox[A_Index] := candidate[A_Index]
    }
    return true
}

PersistRuntimeMetagameFutureClamp(recoveryAtUnixMs) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !BuildClampedMetagameReplayOutbox(State.metagameOutbox,
            recoveryAtUnixMs, &candidate, &changedCount)
            return false
        if !changedCount
            return true
        ; Persist every future row at the same sampled wall-clock instant before
        ; changing memory or sending the head. IDs and FIFO ordering stay intact.
        if !PersistMetagameOutboxArrayWithRetry(candidate)
            return false
        State.metagameOutbox := candidate
        State.metagameOutboxDirty := false
        State.metagameJournalReady := true
        State.metagameJournalOps := 0
        WriteDiagnostic("METAGAME_RUNTIME_FUTURE_TIME_CLAMPED at="
            recoveryAtUnixMs " count=" changedCount " persisted=1")
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

NormalizeStoppedMetagameOutboxAtStartup(recoveryAtUnixMs := 0) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !State.metagameOutbox.Length
            return true
        try recoveryAt := recoveryAtUnixMs
            ? Integer(recoveryAtUnixMs) : UnixTimeMilliseconds()
        catch
            return false
        ; Stable IDs remain untouched, but a Windows clock correction must not
        ; leave an otherwise durable FIFO permanently rejected as future data.
        if !BuildClampedMetagameReplayOutbox(State.metagameOutbox,
            recoveryAt, &startupCandidate, &changedCount)
            return false
        if changedCount {
            if !PersistMetagameOutboxArrayWithRetry(startupCandidate)
                return false
            State.metagameOutbox := startupCandidate
            State.metagameOutboxDirty := false
            State.metagameJournalReady := true
            State.metagameJournalOps := 0
            WriteDiagnostic("METAGAME_FUTURE_TIME_CLAMPED at=" recoveryAt
                " count=" changedCount " persisted=1")
        }
        ; A graceful stop already has the authoritative END and its real duration.
        ; Preserve that FIFO byte-for-byte; only a hard-kill tail without END is folded
        ; into a fresh closed recovery session. A prefix may already have been ACKed,
        ; so MINING...END and END-only tails are valid graceful replays too.
        if MetagameOutboxEndsWithSessionEnd(State.metagameOutbox) {
            WriteDiagnostic("METAGAME_STARTUP_GRACEFUL_REPLAY pending="
                State.metagameOutbox.Length " preserved=1")
            return true
        }
        ; A hard kill can leave BEGIN + verified mining rows without END. Replaying
        ; that historical BEGIN after Host recovery would reopen the old session and
        ; count offline time. Fold every retained mining row into a fresh, immediately
        ; closed recovery session before the first idle replay. Commit disk first.
        startedAt := recoveryAt
        resetOrdinal := Max(1, State.metagameSessionResetCount + 1)
        sessionId := BuildFarmSessionId(DllCall("GetCurrentProcessId"), 1,
            startedAt, resetOrdinal)
        outbox := State.metagameOutbox
        if !RebaseMetagameOutboxForSession(&outbox, sessionId, startedAt,
            true, startedAt + 1)
            return false
        if !PersistMetagameOutboxArrayWithRetry(outbox)
            return false
        State.metagameOutbox := outbox
        State.metagameOutboxDirty := false
        State.metagameJournalReady := true
        State.metagameJournalOps := 0
        State.metagameSessionResetCount := resetOrdinal
        WriteDiagnostic("METAGAME_STARTUP_RECOVERY session=" sessionId
            " pending=" outbox.Length " persisted=1")
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

MetagameOutboxEndsWithSessionEnd(outbox) {
    return outbox.Length
        && outbox[outbox.Length].command = "SESSION_END"
}

ResetFarmMetagameSession(reason, beforePersist := 0) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !State.running && !State.metagameOutbox.Length
            return false
        oldSessionId := State.farmSessionId
        startedAt := Max(UnixTimeMilliseconds(), State.farmSessionStartedAt + 1)
        nextResetCount := State.metagameSessionResetCount + 1
        includeEnd := MetagameResetRequiresEnd(State.running,
            State.stopInProgress, State.metagameOutbox, oldSessionId)
        sessionId := BuildFarmSessionId(DllCall("GetCurrentProcessId"),
            Max(1, State.generation), startedAt, nextResetCount)
        outbox := State.metagameOutbox
        if !RebaseMetagameOutboxForSession(&outbox, sessionId, startedAt,
            includeEnd, includeEnd ? startedAt + 1 : 0)
            return false
        if IsObject(beforePersist) && HasMethod(beforePersist, "Call")
            beforePersist.Call()
        ; Reset is copy-on-write too: the Host keeps reset pending while this returns
        ; false, so neither the in-memory session nor its generation may advance until
        ; the replacement FIFO is durably on disk.
        persisted := PersistMetagameOutboxArrayWithRetry(outbox)
        if !persisted {
            WriteDiagnostic("METAGAME_SESSION_RESET code=" DiagnosticToken(reason)
                " old=" oldSessionId " new=" sessionId
                " pending=" outbox.Length " persisted=0")
            return false
        }
        State.metagameOutbox := outbox
        State.metagameOutboxDirty := false
        State.metagameReplayNormalized := true
        State.metagameJournalReady := true
        State.metagameJournalOps := 0
        State.metagameSessionResetCount := nextResetCount
        if State.running {
            State.farmSessionId := sessionId
            State.farmSessionStartedAt := startedAt
            State.farmSessionEndedAt := includeEnd ? startedAt + 1 : 0
            State.farmSessionBeginQueued := true
            State.farmSessionBeginSent := false
            State.farmSessionEndQueued := includeEnd
            State.farmSessionEndSent := false
        }
        WriteDiagnostic("METAGAME_SESSION_RESET code=" DiagnosticToken(reason)
            " old=" oldSessionId " new=" sessionId
            " pending=" State.metagameOutbox.Length " persisted=1")
        ScheduleMetagameOutboxReplay(1)
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

IsValidMetaResetToken(token) {
    ; Host persistence epochs are deliberately narrower than metagame event IDs:
    ; exactly 16 random bytes in hex followed by a positive recovery generation.
    return RegExMatch(token, "^[0-9A-Fa-f]{32}:[1-9][0-9]{0,18}$") != 0
}

HandleMetagameReset(resetToken) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsValidMetaResetToken(resetToken)
            return false
        if resetToken = State.lastMetaResetToken
            return true
        ; If StopMining is still waiting to durably append its immutable END, close
        ; that intent first. Otherwise an empty FIFO could acknowledge Host reset and
        ; silently abandon the active sidecar session.
        if FarmMetagameClosurePending() && !EndFarmMetagameSession(false)
            return false
        if !State.running && !State.metagameOutbox.Length {
            ; Persisting the empty envelope is the durable acknowledgement that there
            ; was no replay work. A failed write leaves the token unrecorded for retry.
            if !PersistMetagameOutboxWithRetry()
                return false
        } else if !ResetFarmMetagameSession("host_persistence_reset_"
            resetToken) {
            return false
        }
        State.lastMetaResetToken := resetToken
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

ScheduleMetagameOutboxReplay(delayMs := 1) {
    global State
    if !State.metagameOutbox.Length && !FarmMetagameClosurePending() {
        SetTimer FlushMetagameOutboxReplay, 0
        return
    }
    SetTimer FlushMetagameOutboxReplay, -Max(1, Round(delayMs))
}

FlushMetagameOutboxReplay(*) {
    global State
    if FarmMetagameClosurePending() && !EndFarmMetagameSession(false) {
        ScheduleMetagameOutboxReplay(1500)
        return
    }
    if !State.metagameOutbox.Length
        return
    if !State.running && !State.metagameReplayNormalized {
        if !NormalizeStoppedMetagameOutboxAtStartup() {
            ScheduleMetagameOutboxReplay(1500)
            return
        }
        State.metagameReplayNormalized := true
    }
    if !State.uiReady || !State.uiHwnd {
        EnsureWebUiHost()
        ScheduleMetagameOutboxReplay(1500)
        return
    }
    FlushPendingMetagameMiningEvent(0)
    if !TryGetMetagameOutboxHead(&head)
        return
    delayMs := head.nextAt ? Max(50, head.nextAt - MonotonicMs()) : 100
    ScheduleMetagameOutboxReplay(Min(30000, delayMs))
}

FarmMetagameClosurePending() {
    global State
    return State.farmSessionId && State.farmSessionEndedAt > 0
        && !State.farmSessionEndQueued && !State.farmSessionEndSent
}

PrepareMetagameForNewFarmStart() {
    global State
    if FarmMetagameClosurePending() && !EndFarmMetagameSession(false) {
        ScheduleMetagameOutboxReplay(1500)
        return false
    }
    if !State.metagameReplayNormalized {
        if !NormalizeStoppedMetagameOutboxAtStartup()
            return false
        State.metagameReplayNormalized := true
    }
    ; F9 followed by F8 in the same process must recover a verified reward intent
    ; just like a full restart. Never reset diagnostics/start a new run first.
    if State.verifiedRewardWalPending.Count && !RecoverVerifiedRewardWal()
        return false
    return true
}

EndFarmMetagameSession(allowDrain := true) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !State.farmSessionId || State.farmSessionEndSent
            return true
        ; Capture the stop wall-clock once. Every append retry must carry this same
        ; value or an I/O outage would inflate the recorded Farm duration.
        if State.farmSessionEndedAt < 1
            State.farmSessionEndedAt := Max(UnixTimeMilliseconds(),
                State.farmSessionStartedAt)
        if !EnsureFarmMetagameSessionBeginQueued() {
            ScheduleMetagameOutboxReplay(1500)
            return false
        }
        if !State.farmSessionEndQueued {
            if MetagameOutboxContainsCommand(State.metagameOutbox,
                "SESSION_END", State.farmSessionId) {
                State.farmSessionEndQueued := !State.metagameOutboxDirty
                    || PersistMetagameOutboxWithRetry()
            } else {
                State.farmSessionEndQueued := DurablyEnqueueMetagameEvent(
                    "SESSION_END", State.farmSessionId, State.farmSessionEndedAt)
            }
        }
        if !State.farmSessionEndQueued {
            ScheduleMetagameOutboxReplay(1500)
            return false
        }
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    if allowDrain && State.running && State.metagameOutbox.Length {
        ; Input is already released before this function is called. Give the Host a
        ; short bounded window to finish atomic persistence and return meta.ack;
        ; anything still pending remains in the durable FIFO for the next launch.
        drainDeadline := MonotonicMs() + 1200
        while MonotonicMs() < drainDeadline {
            if !TryGetMetagameOutboxHead(&entry)
                break
            if !entry.nextAt || MonotonicMs() >= entry.nextAt
                FlushPendingMetagameMiningEvent(State.generation)
            Sleep 25
        }
    }
    ; A missing ACK keeps SESSION_END in the durable FIFO for ordered replay.
    if State.metagameOutbox.Length
        ScheduleMetagameOutboxReplay(1)
    return true
}

MetagameOutboxEnqueue(&outbox, eventId, eventAtUnixMs,
    command := "MINING_SUCCESS") {
    if !TryParseMetagameOutboxFields(command, eventId, eventAtUnixMs,
        &entry)
        return false
    if MetagameOutboxContainsCommand(outbox, command, eventId)
        return false
    outbox.Push(entry)
    return true
}

DurablyEnqueueMetagameEvent(command, eventId, eventAtUnixMs,
    beforeMemoryCommit := 0) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if (command = "MINING_SUCCESS" && eventId = State.lastMiningEventId)
            || MetagameOutboxContainsCommand(State.metagameOutbox, command, eventId)
            return true
        if !TryParseMetagameOutboxFields(command, eventId, eventAtUnixMs,
            &entry)
            return false
        ; Journal append + FlushFileBuffers and the matching memory commit are one
        ; non-interruptible transaction. An ACK/reset cannot compact away this E
        ; record between those two operations.
        if !AppendMetagameJournalRecord("E`t" entry.command "`t" entry.id
            "`t" entry.at)
            return false
        ; Validation injects a one-shot timer here to prove that an ACK/compact
        ; cannot observe the journal E before its matching memory entry exists.
        if IsObject(beforeMemoryCommit) && HasMethod(beforeMemoryCommit, "Call")
            beforeMemoryCommit.Call()
        CommitDurableMetagameEntry(State.metagameOutbox, entry, true)
        State.metagameOutboxDirty := false
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

CommitDurableMetagameEntry(outbox, entry, appendWasDurable) {
    if !appendWasDurable
        return false
    outbox.Push(entry)
    return true
}

MetagameOutboxAcknowledge(&outbox, command, eventId) {
    if !BuildMetagameOutboxAfterAck(outbox, command, eventId, &candidate)
        return false
    outbox := candidate
    return true
}

BuildMetagameOutboxAfterAck(outbox, command, eventId, &candidate) {
    candidate := []
    if !outbox.Length || outbox[1].command != command
        || outbox[1].id != eventId
        return false
    Loop outbox.Length - 1
        candidate.Push(outbox[A_Index + 1])
    return true
}

AcknowledgeMetagameEvent(command, eventId) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if command != "SESSION_BEGIN" && command != "MINING_SUCCESS"
            && command != "SESSION_END"
            return false
        if !State.metagameOutbox.Length
            return false
        acknowledgedEntry := State.metagameOutbox[1]
        acknowledgedId := acknowledgedEntry.id
        acknowledgedCommand := acknowledgedEntry.command
        if !BuildMetagameOutboxAfterAck(State.metagameOutbox, command,
            eventId, &outbox)
            return false
        ; Tombstone flush, memory removal, and optional compaction share the same
        ; non-interruptible transaction as enqueue/reset.
        if !AppendMetagameJournalRecord("A`t" command "`t" eventId) {
            WriteDiagnostic("METAGAME_ACK_PERSIST_BLOCKED command=" command
                " id=" eventId)
            return false
        }
        State.metagameOutbox := outbox
        State.metagameOutboxDirty := false
        if acknowledgedCommand = "MINING_SUCCESS"
            State.lastMiningEventId := acknowledgedId
        else if acknowledgedCommand = "SESSION_BEGIN"
            && acknowledgedId = State.farmSessionId
            State.farmSessionBeginSent := true
        else if acknowledgedCommand = "SESSION_END"
            && acknowledgedId = State.farmSessionId
            State.farmSessionEndSent := true
        if State.metagameOutbox.Length {
            ; ACK matching includes command + stable ID and the FIFO rejects duplicate
            ; rows, so a predecessor ACK cannot remove the next head. Dispatch on the
            ; next timer tick; the old 100 ms gap made restored history visibly lag.
            State.metagameOutbox[1].enqueued := false
            State.metagameOutbox[1].nextAt := MonotonicMs() + 1
        }
        WriteDiagnostic("METAGAME_ACK command=" acknowledgedCommand " id=" eventId
            " remaining=" State.metagameOutbox.Length)
        MaybeCompactMetagameJournal()
        ScheduleMetagameOutboxReplay(1)
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

EmitVerifiedFarmReward(expectedGeneration, actionMode, attemptId,
    snapshotRevision, completedAtUnixMs := 0, stableEventId := "",
    rewardSessionId := "") {
    global State
    if !IsCurrentRun(expectedGeneration)
        || !IsSupportedStoneActivityMode(actionMode)
        || State.runMode != actionMode
        return false
    ; farmSessionId carries PID + wall-clock start and prevents persistent dedupe
    ; collisions after an app restart. Mode prevents attempt/revision collisions
    ; between mining, washing, and gold-panning runs while retries retain the ID.
    if !EnsureFarmMetagameSessionIdentity(expectedGeneration)
        return false
    eventSessionId := rewardSessionId ? rewardSessionId : State.farmSessionId
    expectedEventId := BuildFarmRewardEventId(eventSessionId, actionMode,
        attemptId, snapshotRevision)
    eventId := stableEventId ? stableEventId : expectedEventId
    if !eventId || eventId != expectedEventId
        return false
    if eventId = State.lastMiningEventId
        return CommitVerifiedRewardIntent(eventId)
    try eventAt := completedAtUnixMs
        ? Integer(completedAtUnixMs) : UnixTimeMilliseconds()
    catch
        return false
    if eventAt < 1 || eventAt > 9999999999999
        return false
    if MetagameOutboxContainsCommand(State.metagameOutbox,
        "MINING_SUCCESS", eventId) {
        ; The queue row is already durable. Resolve a surviving pre-queue intent
        ; before allowing it to be sent or treating the retry as committed.
        if !CommitVerifiedRewardIntent(eventId)
            return false
        for queued in State.metagameOutbox {
            if queued.command = "MINING_SUCCESS" && queued.id = eventId {
                queued.nextAt := 0
                break
            }
        }
        FlushPendingMetagameMiningEvent(expectedGeneration)
        return true
    }
    ; A separate fsync'd intent precedes the normal outbox. It survives F9, a new
    ; Farm start (which resets diagnostics), app termination, and an interrupted
    ; outbox write. Recovery always reuses this exact ID and timestamp.
    if !PersistVerifiedRewardIntent(eventId, actionMode, snapshotRevision,
        eventAt, &eventAt)
        return false
    if !BeginFarmMetagameSession(expectedGeneration)
        return false
    if !DurablyEnqueueMetagameEvent("MINING_SUCCESS", eventId, eventAt) {
        WriteDiagnostic("METAGAME_OUTBOX_PERSIST_FAILED id=" eventId)
        return false
    }
    if !CommitVerifiedRewardIntent(eventId) {
        WriteDiagnostic("METAGAME_REWARD_WAL_COMMIT_FAILED id=" eventId)
        return false
    }
    FlushPendingMetagameMiningEvent(expectedGeneration)
    return true
}

WaitForVerifiedFarmRewardDurability(expectedGeneration, actionMode, attemptId,
    snapshotRevision, completedAtUnixMs, stableEventId, rewardSessionId) {
    global State
    retryCount := 0
    while IsCurrentRun(expectedGeneration) {
        attempt := State.pendingFarmAttempt
        if !IsObject(attempt) || attempt.generation != expectedGeneration
            || attempt.actionMode != actionMode
            || attempt.attemptId != attemptId || !attempt.completed
            || attempt.rewardSessionId != rewardSessionId
            || attempt.rewardEventId != stableEventId
            return false
        if EmitVerifiedFarmReward(expectedGeneration, actionMode, attemptId,
            snapshotRevision, completedAtUnixMs, stableEventId,
            rewardSessionId) {
            if retryCount
                WriteDiagnostic("STONE_DURABLE_RECOVERED id=" attemptId
                    " mode=" actionMode " retries=" retryCount)
            return true
        }
        ; A verified inventory gain is not committed to the visible counter until
        ; its stable event is fsync'd into the outbox. Hold this Farm attempt and
        ; retry the exact same ID; never click the work target again in this state.
        retryCount += 1
        State.farmWatchdogAt := MonotonicMs()
        State.statusLabel.Text := "●  作業結果をSTONEへ安全に保存中（再試行 "
            . retryCount "）"
        if retryCount = 1 || Mod(retryCount, 8) = 0
            WriteDiagnostic("STONE_DURABLE_RETRY id=" attemptId
                " mode=" actionMode " retry=" retryCount)
        retryDelay := Min(5000, 250 * (2 ** Min(retryCount - 1, 4)))
        retryUntil := MonotonicMs() + retryDelay
        while IsCurrentRun(expectedGeneration)
            && MonotonicMs() < retryUntil
            Sleep Min(30, Max(1, retryUntil - MonotonicMs()))
    }
    return false
}

FlushPendingMetagameMiningEvent(expectedGeneration) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if State.metagameFlushActive
            return false
        State.metagameFlushActive := true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    try return FlushMetagameOutboxHead(expectedGeneration)
    finally {
        criticalWasOn := EnterMetagameOutboxCritical()
        try State.metagameFlushActive := false
        finally LeaveMetagameOutboxCritical(criticalWasOn)
    }
}

FlushMetagameOutboxHead(expectedGeneration) {
    global State
    retryExhausted := false
    exhaustedWindow := 0
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !State.metagameOutbox.Length
            return true
        if expectedGeneration && !IsCurrentRun(expectedGeneration)
            return false
        if State.metagameOutboxDirty && !PersistMetagameOutboxWithRetry()
            return false
        ; Windows wall time can move backwards while the app remains open. Clamp
        ; the complete future tail transactionally before Host validation sees it.
        wallClockNow := UnixTimeMilliseconds()
        if !PersistRuntimeMetagameFutureClamp(wallClockNow)
            return false
        entry := State.metagameOutbox[1]
        now := MonotonicMs()
        ; A verified reward may enter the FIFO only after its independent intent
        ; record, and may leave for the Host only after that intent's durable
        ; commit tombstone. This closes the crash window between the two journals.
        if entry.command = "MINING_SUCCESS"
            && State.verifiedRewardWalPending.Has(entry.id) {
            entry.nextAt := now + 250
            return false
        }
        if entry.nextAt && now < entry.nextAt
            return false
        if entry.retries >= 3 {
            entry.windows += 1
            entry.retries := 0
            entry.nextAt := now + MetagameRetryBackoffMs(entry.windows)
            retryExhausted := true
            exhaustedWindow := entry.windows
        }
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    if retryExhausted {
        WriteDiagnostic("METAGAME_RETRY_EXHAUSTED id="
            entry.id " window=" exhaustedWindow)
        EnsureWebUiHost()
        return false
    }
    ; `at` remains the real event time unless Windows moved behind it. In that one
    ; case the full future tail was durably clamped above so Host replay can resume.
    sent := SendMetagameCommand(entry.command, entry.id, entry.at)
    updated := false
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if State.metagameOutbox.Length
            && State.metagameOutbox[1].command = entry.command
            && State.metagameOutbox[1].id = entry.id {
            current := State.metagameOutbox[1]
            current.enqueued := sent ? true : current.enqueued
            current.retries += 1
            current.nextAt := now + 2000
            updated := true
        }
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    ; WM_COPYDATA return means only that Host accepted the enqueue. Keep this FIFO
    ; entry until the authenticated meta.ack sent after Host atomic persistence.
    if sent && updated
        WriteDiagnostic("METAGAME_ENQUEUED command=" entry.command " id=" entry.id
            " awaitingAck=1")
    return false
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
    try {
        callSucceeded := !!DllCall("user32\SendMessageTimeoutW", "Ptr", targetHwnd,
            "UInt", 0x004A, "Ptr", State.uiBackendGui.Hwnd, "Ptr", copyData.Ptr,
            "UInt", 0x0002, "UInt", 2000, "Ptr*", &sendResult, "Ptr")
        return callSucceeded && sendResult != 0
    }
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
            && !State.startInProgress
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
    ; Keep the in-app readiness budget inside the updater's 60 s validation window.
    ; A cold WebView2 profile on a busy FiveM/GTA machine can legitimately exceed 15 s.
    deadline := MonotonicMs() + 38000
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
    for pageName in ["overview", "stone", "vehicle", "routes", "settings", "update"] {
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
    if State.running || State.startInProgress || State.registrationActive
        StopMining()
    else
        StartMining()
}

CanStartFromHotkey(*) {
    global State
    if !AutomationStartAllowed(State.running, State.registrationActive,
        State.startInProgress, State.stopInProgress,
        State.activeFarmCallbacks)
        return false
    activeHwnd := WinExist("A")
    return activeHwnd && IsFiveMWindow(activeHwnd)
}

AutomationStartAllowed(running, registrationActive, startInProgress := false,
    stopInProgress := false, activeFarmCallbacks := 0) {
    return !running && !registrationActive && !startInProgress
        && !stopInProgress && activeFarmCallbacks = 0
}

TryClaimStartOperation(&startToken) {
    global State
    startToken := 0
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !AutomationStartAllowed(State.running, State.registrationActive,
            State.startInProgress, State.stopInProgress,
            State.activeFarmCallbacks)
            return false
        State.startRequestSequence += 1
        if State.startRequestSequence < 1
            State.startRequestSequence := 1
        State.startRequestToken := State.startRequestSequence
        State.startInProgress := true
        startToken := State.startRequestToken
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

IsStartOperationCurrent(startToken) {
    global State
    return startToken > 0 && State.startInProgress
        && State.startRequestToken = startToken
        && !State.running && !State.registrationActive
        && !State.stopInProgress && State.activeFarmCallbacks = 0
}

ReleaseStartOperation(startToken) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsStartOperationCurrent(startToken)
            return false
        State.startInProgress := false
        State.startRequestToken := 0
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

CancelStartOperation() {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !State.startInProgress
            return false
        State.startInProgress := false
        State.startRequestToken := 0
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

ShowStartPreparationState(startToken) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsStartOperationCurrent(startToken)
            return false
        State.mainButton.Text := "開始準備を停止"
        State.actionControl.Enabled := false
        State.statusLabel.Text := "●  開始前の接続を確認中"
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

FinishStartPreparation(startToken) {
    global State
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsStartOperationCurrent(startToken)
            return false
        ; Restore controls before releasing ownership. A queued UI click cannot
        ; claim a new start and then be overwritten by this older finally block.
        State.mainButton.Text := "自動操作を開始"
        State.actionControl.Enabled := true
        State.startInProgress := false
        State.startRequestToken := 0
        return true
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
}

TestStartOperationOwnership() {
    global State
    savedRunning := State.running
    savedRegistrationActive := State.registrationActive
    savedStartInProgress := State.startInProgress
    savedStopInProgress := State.stopInProgress
    savedActiveFarmCallbacks := State.activeFarmCallbacks
    savedStartRequestSequence := State.startRequestSequence
    savedStartRequestToken := State.startRequestToken
    passed := false
    try {
        State.running := false
        State.registrationActive := false
        State.startInProgress := false
        State.stopInProgress := true
        State.activeFarmCallbacks := 0
        State.startRequestSequence := 40
        State.startRequestToken := 0
        firstToken := 0
        duplicateToken := 0
        nextToken := 0
        stopOwnerBlocked := !TryClaimStartOperation(&firstToken)
        State.stopInProgress := false
        State.activeFarmCallbacks := 1
        callbackOwnerBlocked := !TryClaimStartOperation(&firstToken)
        callbackOwnerReleased := ReleaseFarmCallback()
        firstClaimed := TryClaimStartOperation(&firstToken)
        duplicateBlocked := !TryClaimStartOperation(&duplicateToken)
        stopCancelled := CancelStartOperation()
        oldOwnerInvalid := !IsStartOperationCurrent(firstToken)
        nextClaimed := TryClaimStartOperation(&nextToken)
        staleReleaseBlocked := !ReleaseStartOperation(firstToken)
        nextOwnerReleased := ReleaseStartOperation(nextToken)
        passed := stopOwnerBlocked && callbackOwnerBlocked
            && callbackOwnerReleased
            && firstClaimed && firstToken = 41
            && duplicateBlocked && duplicateToken = 0
            && stopCancelled && oldOwnerInvalid
            && nextClaimed && nextToken = 42
            && staleReleaseBlocked && nextOwnerReleased
            && !State.startInProgress && State.startRequestToken = 0
    } finally {
        State.running := savedRunning
        State.registrationActive := savedRegistrationActive
        State.startInProgress := savedStartInProgress
        State.stopInProgress := savedStopInProgress
        State.activeFarmCallbacks := savedActiveFarmCallbacks
        State.startRequestSequence := savedStartRequestSequence
        State.startRequestToken := savedStartRequestToken
    }
    return passed
}

FarmStateTransitionAllowed(fromState, toState) {
    if fromState = toState
        return true
    allowed := Map(
        "IDLE", "|FARMING|ERROR|",
        "FARMING", "|WASH_SETTLING|CHECKING_INVENTORY|INVENTORY_CHECK|RECOVERY|STOPPING_FARM|ERROR|",
        "WASH_SETTLING", "|WASH_CORRECTING|FARMING|CHECKING_INVENTORY|RECOVERY|STOPPING_FARM|ERROR|",
        "WASH_CORRECTING", "|FARMING|CHECKING_INVENTORY|RECOVERY|STOPPING_FARM|ERROR|",
        "CHECKING_INVENTORY", "|FARMING|NEED_STORAGE|RECOVERY|STOPPING_FARM|ERROR|",
        "INVENTORY_CHECK", "|FARMING|INVENTORY_FULL|NEED_STORAGE|RECOVERY|STOPPING_FARM|ERROR|",
        "NEED_STORAGE", "|STOPPING_FARM|RECOVERY|ERROR|",
        "INVENTORY_FULL", "|STOPPING_FARM|RECOVERY|ERROR|",
        "STOPPING_FARM", "|LOCATING_TRUCK|OPENING_STORAGE|IDLE|RECOVERY|ERROR|",
        "LOCATING_TRUCK", "|MOVING_TO_TRUCK|VERIFY_TRUCK_REACHED|OPENING_STORAGE|RECOVERY|ERROR|",
        "MOVING_TO_TRUCK", "|MOVING_TO_TRUCK|VERIFY_TRUCK_REACHED|LOCATING_TRUCK|RECOVERY|ERROR|",
        "VERIFY_TRUCK_REACHED", "|OPENING_STORAGE|LOCATING_TRUCK|RECOVERY|ERROR|",
        "OPENING_STORAGE", "|STORING_OUTPUTS|STORING|RECOVERY|ERROR|",
        "STORING_OUTPUTS", "|VERIFY_STORAGE|RECOVERY|ERROR|",
        "STORING", "|VERIFY_STORAGE|RECOVERY|ERROR|",
        "VERIFY_STORAGE", "|STORING_OUTPUTS|STORING|REFILLING_INPUT|LOCATING_FARM|RETURNING_TO_FARM|RECOVERY|ERROR|",
        "REFILLING_INPUT", "|VERIFY_REFILL|RECOVERY|ERROR|",
        "VERIFY_REFILL", "|REFILLING_INPUT|LOCATING_FARM|RETURNING_TO_FARM|RECOVERY|ERROR|",
        "LOCATING_FARM", "|RETURNING_TO_FARM|RECOVERY|ERROR|",
        "RETURNING_TO_FARM", "|VERIFY_FARM_REACHED|RESUMING_FARM|RECOVERY|ERROR|",
        "VERIFY_FARM_REACHED", "|RESUMING_FARM|RECOVERY|ERROR|",
        "RESUMING_FARM", "|VERIFY_FARM_RESUMED|FARMING|CHECKING_INVENTORY|INVENTORY_CHECK|RECOVERY|STOPPING_FARM|ERROR|",
        "VERIFY_FARM_RESUMED", "|FARMING|RECOVERY|ERROR|",
        "RECOVERY", "|FARMING|CHECKING_INVENTORY|INVENTORY_CHECK|LOCATING_TRUCK|OPENING_STORAGE|STORING_OUTPUTS|STORING|REFILLING_INPUT|LOCATING_FARM|RETURNING_TO_FARM|VERIFY_FARM_REACHED|RESUMING_FARM|STOPPING_FARM|ERROR|",
        "ERROR", "|IDLE|FARMING|")
    return allowed.Has(fromState) && InStr(allowed[fromState], "|" toState "|")
}

FarmStateLegacyPhase(farmState) {
    return farmState = "IDLE" ? "stopped"
        : farmState = "FARMING" ? "working"
        : farmState = "WASH_SETTLING" ? "wash_settle"
        : farmState = "WASH_CORRECTING" ? "wash_correct"
        : farmState = "CHECKING_INVENTORY" ? "capacity_check"
        : farmState = "INVENTORY_CHECK" ? "capacity_check"
        : farmState = "NEED_STORAGE" ? "capacity_full"
        : farmState = "INVENTORY_FULL" ? "capacity_full"
        : farmState = "STOPPING_FARM" ? "stopping_work"
        : farmState = "LOCATING_TRUCK" ? "find_registered_vehicle"
        : farmState = "MOVING_TO_TRUCK" ? "move_to_registered_vehicle"
        : farmState = "VERIFY_TRUCK_REACHED" ? "verify_registered_vehicle"
        : farmState = "OPENING_STORAGE" ? "find_registered_vehicle"
        : farmState = "STORING_OUTPUTS" ? "depositing"
        : farmState = "STORING" ? "depositing"
        : farmState = "VERIFY_STORAGE" ? "verify_storage"
        : farmState = "REFILLING_INPUT" ? "refilling_input"
        : farmState = "VERIFY_REFILL" ? "verify_refill"
        : farmState = "LOCATING_FARM" ? "locate_work"
        : farmState = "RETURNING_TO_FARM" ? "return_to_work"
        : farmState = "VERIFY_FARM_REACHED" ? "verify_workpoint"
        : farmState = "RESUMING_FARM" ? "verify_workpoint"
        : farmState = "VERIFY_FARM_RESUMED" ? "verify_reward"
        : farmState = "RECOVERY" ? "recovery"
        : farmState = "ERROR" ? "error" : "unknown"
}

TransitionFarmState(nextState, reason, expectedGeneration := 0,
    expectedTaskId := 0, force := false) {
    global State
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if expectedGeneration && !IsCurrentRun(expectedGeneration) {
            WriteDiagnostic("FSM_STALE_GENERATION expected=" expectedGeneration
                " actual=" State.generation " next=" nextState)
            return false
        }
        if expectedTaskId && expectedTaskId != State.farmStateTaskId {
            WriteDiagnostic("FSM_STALE_TASK expected=" expectedTaskId
                " actual=" State.farmStateTaskId " next=" nextState)
            return false
        }
        previousState := State.farmState
        if !force && !FarmStateTransitionAllowed(previousState, nextState) {
            WriteDiagnostic("FSM_INVALID from=" previousState " to=" nextState
                " reason=" DiagnosticToken(reason))
            return false
        }
        State.farmState := nextState
        State.farmStateReason := reason
        State.farmStateEnteredAt := MonotonicMs()
        State.farmStateTaskId += 1
        taskId := State.farmStateTaskId
        State.automationPhase := FarmStateLegacyPhase(nextState)
        snapshotWeight := IsObject(State.confirmedInventory)
            ? State.confirmedInventory.weight : -1
        snapshotUsed := IsObject(State.confirmedInventory)
            ? State.confirmedInventory.used : -1
        targetLostAge := State.targetLostSince
            ? Max(0, MonotonicMs() - State.targetLostSince) : 0
        watchdogAge := State.farmWatchdogAt
            ? Max(0, MonotonicMs() - State.farmWatchdogAt) : 0
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
    WriteDiagnostic("FSM gen=" State.generation " task=" taskId
        " from=" previousState " to=" nextState
        " reason=" DiagnosticToken(reason)
        " retry=" State.farmStateRetry
        " revision=" State.inventorySnapshotRevision
        " weight=" snapshotWeight " used=" snapshotUsed
        " targetLostMs=" targetLostAge " watchdogMs=" watchdogAge)
    if previousState != nextState
        && (nextState = "INVENTORY_FULL" || nextState = "NEED_STORAGE")
        EmitAutomationAlert("capacity", reason)
    else if previousState != nextState && nextState = "ERROR"
        EmitAutomationAlert("error", reason)
    return true
}

EmitAutomationAlert(kind, message := "") {
    global State, isUiTestRun
    soundType := AutomationAlertSoundType(kind)
    if !soundType
        return false
    now := MonotonicMs()
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        ; A repeated transition or stale callback must not produce an alarm loop.
        if State.lastAlertKind = kind && State.lastAlertAt
            && now - State.lastAlertAt < 1500
            return true
        State.lastAlertKind := kind
        State.lastAlertAt := now
    } finally LeaveMetagameOutboxCritical(criticalWasOn)

    if isUiTestRun || HasCommandLineArgument("--validate")
        return true
    played := false
    if kind = "wash_complete" || kind = "mining_complete" || kind = "gold_complete" {
        try TrayTip message, "AI採掘機", 1
        played := PlayExeCompletionVoice(kind)
        if !played
            played := SpeakAutomationMessage(message)
    }
    if !played
        try played := DllCall("user32\MessageBeep", "UInt", soundType, "Int") != 0
    WriteDiagnostic("ALERT kind=" kind " played=" (played ? 1 : 0)
        " message=" DiagnosticToken(message))
    return played
}

SpeakAutomationMessage(message) {
    global State, isUiTestRun
    if !message || isUiTestRun || HasCommandLineArgument("--validate")
        return false
    try {
        voice := IsObject(State.speechVoice)
            ? State.speechVoice : ComObject("SAPI.SpVoice")
        if !State.speechVoiceConfigured {
            preferredVoice := 0
            japaneseVoice := 0
            voices := voice.GetVoices()
            Loop voices.Count {
                token := voices.Item(A_Index - 1)
                language := ""
                gender := ""
                description := ""
                try language := StrLower(token.GetAttribute("Language"))
                try gender := StrLower(token.GetAttribute("Gender"))
                try description := StrLower(token.GetDescription())
                isJapanese := InStr(language, "411")
                    || InStr(description, "japanese")
                    || InStr(description, "haruka")
                    || InStr(description, "ayumi")
                if !isJapanese
                    continue
                if !IsObject(japaneseVoice)
                    japaneseVoice := token
                if gender = "female" || InStr(description, "haruka")
                    || InStr(description, "ayumi") {
                    preferredVoice := token
                    break
                }
            }
            selectedVoice := IsObject(preferredVoice)
                ? preferredVoice : japaneseVoice
            if IsObject(selectedVoice)
                voice.Voice := selectedVoice
            State.speechVoice := voice
            State.speechVoiceConfigured := true
        }
        ; SVSFlagsAsync | SVSFPurgeBeforeSpeak: never queue repeated stale lines.
        voice.Speak(message, 3)
        return true
    } catch as err {
        WriteDiagnostic("VOICE_ALERT_ERROR=" DiagnosticToken(err.Message))
        return false
    }
}

DiagnosticToken(value) {
    value := RegExReplace(String(value), "[\r\n\t]+", " ")
    return StrLen(value) > 160 ? SubStr(value, 1, 160) : value
}

IsCurrentFarmTask(expectedGeneration, expectedTaskId := 0,
    expectedState := "") {
    global State
    return IsCurrentRun(expectedGeneration)
        && (!expectedTaskId || expectedTaskId = State.farmStateTaskId)
        && (!expectedState || expectedState = State.farmState)
}

TryClaimFarmCallback(expectedGeneration, expectedTaskId) {
    global State
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if State.stopInProgress || State.activeFarmCallbacks != 0
            return false
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId)
            return false
        if IsObject(State.timerFn)
            try SetTimer(State.timerFn, 0)
        State.timerFn := 0
        State.activeFarmCallbacks += 1
        return true
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

ReleaseFarmCallback() {
    global State
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if State.activeFarmCallbacks <= 0 {
            WriteDiagnostic("FARM_CALLBACK_RELEASE_WITHOUT_OWNER")
            State.activeFarmCallbacks := 0
            return false
        }
        State.activeFarmCallbacks -= 1
        if State.activeFarmCallbacks = 0
            ArmPendingFarmTimerAfterOwnerRelease()
        return true
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

FarmTimerScheduleAction(activeCallbacks, running, stopInProgress,
    generationMatches) {
    return !running || stopInProgress || !generationMatches ? "DROP"
        : activeCallbacks > 0 ? "DEFER" : "ARM"
}

RunFarmTimerHandoffMockTest(iterations := 100) {
    ; Deterministically model repeated one-shot requests made by one callback.
    ; The last request must win, owner release must arm exactly once, and a
    ; concurrent stop must make every later request fail closed.
    if iterations < 1
        return false
    Loop iterations {
        generation := A_Index
        activeCallbacks := 1
        running := true
        stopInProgress := false
        pendingGeneration := 0
        pendingTaskId := 0
        pendingDue := 0
        armedCount := 0
        for request in [{taskId: 11, due: 40}, {taskId: 12, due: 15},
            {taskId: 13, due: 25}] {
            if FarmTimerScheduleAction(activeCallbacks, running,
                stopInProgress, true) != "DEFER"
                return false
            pendingGeneration := generation
            pendingTaskId := request.taskId
            pendingDue := request.due
        }
        if pendingGeneration != generation || pendingTaskId != 13
            || pendingDue != 25
            return false
        activeCallbacks -= 1
        if activeCallbacks != 0 || FarmTimerScheduleAction(activeCallbacks,
            running, stopInProgress, pendingGeneration = generation) != "ARM"
            return false
        armedCount += 1
        pendingGeneration := 0
        pendingTaskId := 0
        pendingDue := 0
        if pendingGeneration || pendingTaskId || pendingDue || armedCount != 1
            return false
        stopInProgress := true
        if FarmTimerScheduleAction(activeCallbacks, running,
            stopInProgress, true) != "DROP"
            return false
    }
    return true
}

ArmFarmTimerOwned(expectedGeneration, expectedTaskId, delayMs) {
    global State
    if IsObject(State.timerFn)
        try SetTimer(State.timerFn, 0)
    nextFn := AutomationCycle.Bind(expectedGeneration, expectedTaskId)
    State.timerFn := nextFn
    SetTimer(nextFn, -Max(1, Round(delayMs)))
    return true
}

ArmPendingFarmTimerAfterOwnerRelease() {
    global State
    expectedGeneration := State.pendingFarmTimerGeneration
    expectedTaskId := State.pendingFarmTimerTaskId
    dueAt := State.pendingFarmTimerDueAt
    State.pendingFarmTimerGeneration := 0
    State.pendingFarmTimerTaskId := 0
    State.pendingFarmTimerDueAt := 0
    if FarmTimerScheduleAction(State.activeFarmCallbacks, State.running,
        State.stopInProgress, expectedGeneration > 0
            && expectedGeneration = State.generation) != "ARM"
        return false
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId)
        return false
    return ArmFarmTimerOwned(expectedGeneration, expectedTaskId,
        Max(1, dueAt - MonotonicMs()))
}

FarmStateDisplayName(farmState) {
    return farmState = "IDLE" ? "停止中"
        : farmState = "FARMING" ? "作業中"
        : farmState = "WASH_SETTLING" ? "洗浄後の静止待ち"
        : farmState = "WASH_CORRECTING" ? "洗浄位置を補正"
        : farmState = "CHECKING_INVENTORY" ? "所持品確認"
        : farmState = "INVENTORY_CHECK" ? "所持品確認"
        : farmState = "NEED_STORAGE" ? "収納が必要"
        : farmState = "INVENTORY_FULL" ? "容量不足"
        : farmState = "STOPPING_FARM" ? "作業停止"
        : farmState = "LOCATING_TRUCK" ? "登録車両を探索"
        : farmState = "MOVING_TO_TRUCK" ? "登録車両へ移動"
        : farmState = "VERIFY_TRUCK_REACHED" ? "荷台への到達確認"
        : farmState = "OPENING_STORAGE" ? "荷台探索"
        : farmState = "STORING_OUTPUTS" ? "作業結果を収納"
        : farmState = "STORING" ? "収納中"
        : farmState = "VERIFY_STORAGE" ? "収納確認"
        : farmState = "REFILLING_INPUT" ? "未洗浄石を補充"
        : farmState = "VERIFY_REFILL" ? "補充確認"
        : farmState = "LOCATING_FARM" ? "作業地点を探索"
        : farmState = "RETURNING_TO_FARM" ? "作業地点へ復帰"
        : farmState = "VERIFY_FARM_REACHED" ? "作業地点への到達確認"
        : farmState = "RESUMING_FARM" ? "再開確認"
        : farmState = "VERIFY_FARM_RESUMED" ? "実報酬で再開確認"
        : farmState = "RECOVERY" ? "自動復旧"
        : farmState = "ERROR" ? "要確認" : farmState
}

BuildFarmProgressStatus(prefix, current, total, suffix := "）") {
    return String(prefix) . String(current) . "/" . String(total) . String(suffix)
}

WorkViewDownModeSupported(mode) {
    return mode = "washing" || mode = "gold"
}

AutomationAlertSoundType(kind) {
    return kind = "error" ? 0x10
        : kind = "capacity" ? 0x30
        : (kind = "wash_complete" || kind = "mining_complete" || kind = "gold_complete") ? 0x40 : 0
}

BackgroundCameraDownRoute(durationMs) {
    return Max(100, Min(1500, Round(durationMs))) . ":32"
}

FarmMockStep(&stateName, nextState) {
    if !FarmStateTransitionAllowed(stateName, nextState)
        return false
    stateName := nextState
    return true
}

FarmMockRandomHit(&seed, numerator, denominator) {
    ; Park-Miller PRNG gives reproducible fault schedules without using the global
    ; Random state, so --validate produces the same failing cycle on every PC.
    seed := Mod(seed * 48271, 2147483647)
    return Mod(seed, denominator) < numerator
}

BuildFarmMockInventory(weight, oreCount) {
    items := oreCount > 0 ? "0001.ore.e30=" oreCount : "-"
    return {weight: weight, maxWeight: 100000,
        used: oreCount > 0 ? oreCount + 1 : 1, slots: 50, items: items}
}

RunFarmStateMachineMockTest(cycleCount := 100) {
    ; Deterministic integration model. It uses the production transition, capacity,
    ; inventory-delta and storage-reduction guards instead of merely walking a list
    ; of state names. The injected faults are deterministic so a failed invariant
    ; returns the same validation code on every machine.
    stateName := "FARMING"
    inventoryWeight := 100000 ; start already full: first cycle must store
    oreCount := 8
    firstStorageFailurePending := true
    firstResumeFailurePending := true
    faultSeed := 73092026
    stats := {verified: 0, initialFullStorage: 0, storageCycles: 0,
        storageUiDelay: 0, storageUiFlicker: 0, storageFailures: 0,
        storageRecoveryLoops: 0, delayedReduction: 0,
        cameraLost: 0, targetLost: 0,
        resumeFailures: 0, delayedRewards: 0}
    Loop cycleCount {
        cycleNumber := A_Index
        injectCameraLost := FarmMockRandomHit(&faultSeed, 1, 8)
        injectTargetLost := FarmMockRandomHit(&faultSeed, 1, 9)
        injectStorageUiDelay := FarmMockRandomHit(&faultSeed, 1, 2)
        injectStorageUiFlicker := FarmMockRandomHit(&faultSeed, 1, 3)
        injectInventoryDelay := FarmMockRandomHit(&faultSeed, 1, 2)
        injectDelayedReward := FarmMockRandomHit(&faultSeed, 1, 6)
        if injectCameraLost {
            if !FarmMockStep(&stateName, "RECOVERY")
                || !FarmMockStep(&stateName, "FARMING")
                return false
            stats.cameraLost += 1
        }
        if injectTargetLost {
            if !FarmMockStep(&stateName, "RECOVERY")
                || !FarmMockStep(&stateName, "FARMING")
                return false
            stats.targetLost += 1
        }
        if !FarmMockStep(&stateName, "INVENTORY_CHECK")
            return false
        beforeCapacity := BuildFarmMockInventory(inventoryWeight, oreCount)
        storageCycle := CapacityNeedsStorage(beforeCapacity,
            &capacityReason, &freeWeight)
        if storageCycle {
            stats.storageCycles += 1
            if cycleNumber = 1
                stats.initialFullStorage += 1
            for nextState in ["INVENTORY_FULL", "STOPPING_FARM",
                "OPENING_STORAGE"] {
                if !FarmMockStep(&stateName, nextState)
                    return false
            }
            if injectStorageUiDelay {
                ; UI appears late: remain in OPENING_STORAGE, never store blind.
                if !FarmMockStep(&stateName, "OPENING_STORAGE")
                    return false
                stats.storageUiDelay += 1
            }
            if injectStorageUiFlicker {
                ; One-frame visibility flicker is handled in the same state.
                if !FarmMockStep(&stateName, "OPENING_STORAGE")
                    return false
                stats.storageUiFlicker += 1
            }
            if !FarmMockStep(&stateName, "STORING")
                || !FarmMockStep(&stateName, "VERIFY_STORAGE")
                return false
            if firstStorageFailurePending {
                firstStorageFailurePending := false
                stats.storageFailures += 1
                unchanged := BuildFarmMockInventory(inventoryWeight, oreCount)
                if InventorySnapshotWasReduced(unchanged, beforeCapacity)
                    || stateName != "VERIFY_STORAGE"
                    return false
                ; Model max-retry exhaustion too: RECOVERY observes that inventory
                ; is unchanged and routes back to OPENING/STORING, never FARMING.
                if FarmStateTransitionAllowed("STORING", "RETURNING_TO_FARM")
                    || !FarmMockStep(&stateName, "RECOVERY")
                    || !FarmMockStep(&stateName, "OPENING_STORAGE")
                    || !FarmMockStep(&stateName, "STORING")
                    || !FarmMockStep(&stateName, "VERIFY_STORAGE")
                    return false
                stats.storageRecoveryLoops += 1
            }
            ; Inventory propagation is delayed for one observation. VERIFY_STORAGE
            ; remains active until an actual weight/item reduction is visible.
            if injectInventoryDelay {
                delayed := BuildFarmMockInventory(inventoryWeight, oreCount)
                if InventorySnapshotWasReduced(delayed, beforeCapacity)
                    || !FarmMockStep(&stateName, "VERIFY_STORAGE")
                    return false
                stats.delayedReduction += 1
            }
            reduced := BuildFarmMockInventory(1000, 0)
            if !InventorySnapshotWasReduced(reduced, beforeCapacity)
                || CapacityNeedsStorage(reduced, &postReason, &postFree)
                return false
            inventoryWeight := reduced.weight
            oreCount := 0
            if !FarmMockStep(&stateName, "RETURNING_TO_FARM")
                || !FarmMockStep(&stateName, "RESUMING_FARM")
                return false
            if firstResumeFailurePending {
                firstResumeFailurePending := false
                if !FarmMockStep(&stateName, "RECOVERY")
                    || !FarmMockStep(&stateName, "RESUMING_FARM")
                    return false
                stats.resumeFailures += 1
            }
        } else {
            if !FarmMockStep(&stateName, "FARMING")
                return false
        }

        rewardBefore := BuildFarmMockInventory(inventoryWeight, oreCount)
        if injectDelayedReward {
            delayedReward := BuildFarmMockInventory(inventoryWeight, oreCount)
            if InventorySnapshotHasReward(delayedReward, rewardBefore)
                return false
            stats.delayedRewards += 1
        }
        rewardAfter := BuildFarmMockInventory(inventoryWeight + 12000,
            oreCount + 1)
        if !InventorySnapshotHasReward(rewardAfter, rewardBefore)
            return false
        if stateName = "RESUMING_FARM" {
            ; Only the verified post-storage reward completes resume.
            if !FarmMockStep(&stateName, "FARMING")
                return false
        }
        inventoryWeight := rewardAfter.weight
        oreCount += 1
        stats.verified += 1
    }
    return stats.verified = cycleCount && stateName = "FARMING"
        && stats.initialFullStorage = 1 && stats.storageCycles >= 2
        && stats.storageUiDelay > 0 && stats.storageUiFlicker > 0
        && stats.storageFailures = 1 && stats.storageRecoveryLoops = 1
        && stats.delayedReduction > 0
        && stats.cameraLost > 0 && stats.targetLost > 0
        && stats.resumeFailures = 1 && stats.delayedRewards > 0
        && !FarmStateTransitionAllowed("STORING", "RETURNING_TO_FARM")
        && !FarmStateTransitionAllowed("VERIFY_STORAGE", "RESUMING_FARM")
}

BuildWorkflowMockInventory(mode, rawCount, outputCount, weight) {
    outputName := mode = "mining" ? "ore"
        : mode = "gold" ? "gold_flake" : "washed_stone"
    items := "0001.food.e30=2"
    used := 1
    if rawCount > 0 {
        items .= ",0002.raw_stone.e30=" rawCount
        used += 1
    }
    if outputCount > 0 {
        items .= ",0003." outputName ".e30=" outputCount
        used += 1
    }
    return {weight: weight, maxWeight: 100000, used: used,
        slots: 50, items: items}
}

FarmMockWalk(&stateName, nextStates*) {
    for nextState in nextStates {
        if !FarmMockStep(&stateName, nextState)
            return false
    }
    return true
}

CreateFarmWorkflowMockRuntime() {
    return {activeTask: "", inputMask: 0, taskSequence: 0,
        blockedDuplicateTasks: 0, blockedConcurrentInputs: 0,
        leakedTasks: 0, leakedInputs: 0}
}

FarmWorkflowMockAcquireTask(runtime, taskName) {
    if runtime.activeTask {
        runtime.blockedDuplicateTasks += 1
        return false
    }
    runtime.taskSequence += 1
    runtime.activeTask := taskName ":" runtime.taskSequence
    return true
}

FarmWorkflowMockReleaseTask(runtime) {
    if !runtime.activeTask {
        runtime.leakedTasks += 1
        return false
    }
    runtime.activeTask := ""
    return true
}

FarmWorkflowMockBeginInput(runtime, inputMask) {
    if runtime.inputMask {
        runtime.blockedConcurrentInputs += 1
        return false
    }
    if inputMask < 1 || inputMask > 255
        return false
    runtime.inputMask := inputMask
    return true
}

FarmWorkflowMockReleaseInput(runtime) {
    if !runtime.inputMask {
        runtime.leakedInputs += 1
        return false
    }
    runtime.inputMask := 0
    return true
}

FarmWorkflowMockOwnedRoute(runtime, taskName, inputMask) {
    if !FarmWorkflowMockAcquireTask(runtime, taskName)
        return false
    ; Deterministically inject both forbidden races while the owner is live. The
    ; mock gate must reject them and the finally-equivalent cleanup below must leave
    ; neither a task nor a pressed key behind.
    duplicateBlocked := !FarmWorkflowMockAcquireTask(runtime,
        taskName "-duplicate")
    inputStarted := FarmWorkflowMockBeginInput(runtime, inputMask)
    concurrentBlocked := inputStarted
        && !FarmWorkflowMockBeginInput(runtime, 1)
    inputReleased := inputStarted && FarmWorkflowMockReleaseInput(runtime)
    taskReleased := FarmWorkflowMockReleaseTask(runtime)
    return duplicateBlocked && concurrentBlocked && inputReleased && taskReleased
}

FarmWorkflowMockReacquireMovedTruck(stats, cycleNumber) {
    ; This models the production local search re-acquiring the registered trunk
    ; from fresh visual/storage identity on every trip. It is deliberately not a
    ; claim of world-coordinate access: the small signed offset only proves that
    ; the fixture never relies on the vehicle remaining at one recorded position.
    stats.truckReacquisitions += 1
    signedOffset := Mod(cycleNumber * 5, 7) - 3
    if signedOffset = 0
        signedOffset := 1
    if Abs(signedOffset) > 3
        return false
    stats.truckSmallPositionChanges += 1
    return true
}

FarmWorkflowMockRouteWithBoundedPause(runtime, taskName, inputMask,
    injectPause, stats) {
    if !injectPause
        return FarmWorkflowMockOwnedRoute(runtime, taskName, inputMask)
    ; The first owner is interrupted but still releases task/input state. Exactly
    ; one clean reacquisition is then allowed; no third owner or leaked key exists.
    if !FarmWorkflowMockOwnedRoute(runtime, taskName "-paused", inputMask)
        return false
    stats.routePauses += 1
    if !FarmWorkflowMockIsClean(runtime)
        || !FarmWorkflowMockOwnedRoute(runtime, taskName "-recovery", inputMask)
        return false
    stats.routeRecoveries += 1
    return true
}

FarmWorkflowMockIsClean(runtime) {
    return !runtime.activeTask && !runtime.inputMask
        && runtime.leakedTasks = 0 && runtime.leakedInputs = 0
        && runtime.blockedDuplicateTasks > 0
        && runtime.blockedConcurrentInputs > 0
}

FarmMockCameraHeading(&seed, cycleNumber) {
    if Mod(cycleNumber, 3) = 1
        return 90
    if Mod(cycleNumber, 3) = 2
        return 180
    seed := Mod(seed * 48271, 2147483647)
    return Mod(seed, 360)
}

FarmMockStorageDepartureGate(baselineSpec, currentSpec, cameraHeading) {
    ; The heading is intentionally observational only. Production departure is
    ; authorized by a trusted baseline plus positive inventory delta, not camera
    ; direction or a Farm button that can disappear at full capacity.
    ignoredHeading := cameraHeading
    return StorageDeltaBaselineIsSafe(baselineSpec, currentSpec)
        && InventorySpecDeltaUnitCount(currentSpec, baselineSpec) > 0
}

RecordFarmMockHeading(stats, heading) {
    if heading = 90
        stats.heading90 += 1
    else if heading = 180
        stats.heading180 += 1
    else
        stats.headingRandom += 1
}

RunFarmStorageResumeModeMockTest(mode, cycleCount, &stats) {
    stats := {cycles: 0, verifiedRewards: 0, storageUiFirstFailures: 0,
        inventoryDelays: 0, resumeFirstFailures: 0, targetLosses: 0,
        truckReacquisitions: 0, truckSmallPositionChanges: 0,
        routePauses: 0, routeRecoveries: 0,
        heading90: 0, heading180: 0, headingRandom: 0, clean: false,
        blockedDuplicateTasks: 0, blockedConcurrentInputs: 0}
    if (mode != "mining" && mode != "gold") || cycleCount < 1
        return false
    runtime := CreateFarmWorkflowMockRuntime()
    stateName := "FARMING"
    headingSeed := mode = "mining" ? 9072026 : 10092026
    Loop cycleCount {
        cycleNumber := A_Index
        if Mod(cycleNumber, 9) = 0 {
            if !FarmMockWalk(&stateName, "RECOVERY", "FARMING")
                return false
            stats.targetLosses += 1
        }

        baseline := BuildWorkflowMockInventory(mode, 0, 0, 5000)
        current := BuildWorkflowMockInventory(mode, 0, 1, 100000)
        if !CapacityNeedsStorage(current, &capacityReason, &freeWeight)
            || !FarmMockWalk(&stateName, "CHECKING_INVENTORY", "NEED_STORAGE",
                "STOPPING_FARM")
            return false
        heading := FarmMockCameraHeading(&headingSeed, cycleNumber)
        RecordFarmMockHeading(stats, heading)
        if !FarmWorkflowMockReacquireMovedTruck(stats, cycleNumber)
            return false
        if !FarmMockStorageDepartureGate(baseline.items, current.items, heading)
            || !FarmMockWalk(&stateName, "LOCATING_TRUCK", "MOVING_TO_TRUCK")
            || !FarmWorkflowMockRouteWithBoundedPause(runtime,
                mode "-to-truck", 1, cycleNumber = 2, stats)
            || !FarmMockWalk(&stateName, "VERIFY_TRUCK_REACHED",
                "OPENING_STORAGE")
            return false

        if cycleNumber = 1 {
            ; The first UI open fails after every route input is already released.
            if !FarmWorkflowMockIsClean(runtime)
                || !FarmMockWalk(&stateName, "RECOVERY", "OPENING_STORAGE")
                return false
            stats.storageUiFirstFailures += 1
        }
        if !FarmMockWalk(&stateName, "STORING_OUTPUTS", "VERIFY_STORAGE")
            return false
        if Mod(cycleNumber, 4) = 0 {
            if InventorySnapshotWasReduced(current, current)
                || !FarmMockStep(&stateName, "VERIFY_STORAGE")
                return false
            stats.inventoryDelays += 1
        }
        afterDeposit := BuildWorkflowMockInventory(mode, 0, 0, 5000)
        if !InventorySnapshotWasReduced(afterDeposit, current)
            || CapacityNeedsStorage(afterDeposit, &afterReason, &afterFree)
            || !FarmMockWalk(&stateName, "LOCATING_FARM", "RETURNING_TO_FARM")
            || !FarmWorkflowMockOwnedRoute(runtime, mode "-to-farm", 2)
            || !FarmMockWalk(&stateName, "VERIFY_FARM_REACHED",
                "RESUMING_FARM")
            return false
        if cycleNumber = 1 {
            if !FarmMockWalk(&stateName, "RECOVERY", "RESUMING_FARM")
                return false
            stats.resumeFirstFailures += 1
        }
        rewardAfter := BuildWorkflowMockInventory(mode, 0, 1, 17000)
        if !InventorySnapshotHasReward(rewardAfter, afterDeposit)
            || !FarmMockWalk(&stateName, "VERIFY_FARM_RESUMED", "FARMING")
            return false
        stats.cycles += 1
        stats.verifiedRewards += 1
    }
    stats.clean := FarmWorkflowMockIsClean(runtime)
    stats.blockedDuplicateTasks := runtime.blockedDuplicateTasks
    stats.blockedConcurrentInputs := runtime.blockedConcurrentInputs
    return stateName = "FARMING" && stats.cycles = cycleCount
        && stats.verifiedRewards = cycleCount && stats.clean
}

RunWashingStorageRefillResumeMockTest(cycleCount, &stats) {
    stats := {cycles: 0, outputsDeposited: 0, rawRefills: 0,
        rawConsumptions: 0, verifiedRewards: 0,
        storageUiFirstFailures: 0, inventoryDelays: 0,
        resumeFirstFailures: 0, targetLosses: 0,
        truckReacquisitions: 0, truckSmallPositionChanges: 0,
        routePauses: 0, routeRecoveries: 0,
        heading90: 0, heading180: 0, headingRandom: 0, clean: false,
        blockedDuplicateTasks: 0, blockedConcurrentInputs: 0}
    if cycleCount < 1
        return false
    runtime := CreateFarmWorkflowMockRuntime()
    stateName := "FARMING"
    headingSeed := 22092026
    refillBaseline := BuildWorkflowMockInventory("washing", 6, 0, 10000)
    current := BuildWorkflowMockInventory("washing", 5, 1, 100000)
    Loop cycleCount {
        cycleNumber := A_Index
        if Mod(cycleNumber, 8) = 0 {
            if !FarmMockWalk(&stateName, "RECOVERY", "FARMING")
                return false
            stats.targetLosses += 1
        }
        if !CapacityNeedsStorage(current, &capacityReason, &freeWeight)
            || !FarmMockWalk(&stateName, "CHECKING_INVENTORY", "NEED_STORAGE",
                "STOPPING_FARM")
            return false
        heading := FarmMockCameraHeading(&headingSeed, cycleNumber)
        RecordFarmMockHeading(stats, heading)
        if !FarmWorkflowMockReacquireMovedTruck(stats, cycleNumber)
            return false
        if !FarmMockStorageDepartureGate(refillBaseline.items, current.items,
            heading)
            || !FarmMockWalk(&stateName, "LOCATING_TRUCK", "MOVING_TO_TRUCK")
            || !FarmWorkflowMockRouteWithBoundedPause(runtime,
                "washing-to-truck", 1, cycleNumber = 2, stats)
            || !FarmMockWalk(&stateName, "VERIFY_TRUCK_REACHED",
                "OPENING_STORAGE")
            return false
        if cycleNumber = 1 {
            if !FarmWorkflowMockIsClean(runtime)
                || !FarmMockWalk(&stateName, "RECOVERY", "OPENING_STORAGE")
                return false
            stats.storageUiFirstFailures += 1
        }

        if !FarmMockWalk(&stateName, "STORING_OUTPUTS", "VERIFY_STORAGE")
            return false
        if Mod(cycleNumber, 4) = 0 {
            if InventorySnapshotWasReduced(current, current)
                || !FarmMockStep(&stateName, "VERIFY_STORAGE")
                return false
            stats.inventoryDelays += 1
        }
        afterDeposit := BuildWorkflowMockInventory("washing", 5, 0, 5000)
        if !InventorySnapshotWasReduced(afterDeposit, current)
            || InventorySpecHasIncrease(afterDeposit.items,
                refillBaseline.items)
            || !FarmMockWalk(&stateName, "REFILLING_INPUT", "VERIFY_REFILL")
            return false
        stats.outputsDeposited += 1

        if Mod(cycleNumber, 5) = 0 {
            if InventorySpecNameCount(afterDeposit.items, "raw_stone") != 5
                || !FarmMockStep(&stateName, "VERIFY_REFILL")
                return false
            stats.inventoryDelays += 1
        }
        refilled := BuildWorkflowMockInventory("washing", 6, 0, 10000)
        if InventorySpecNameCount(refilled.items, "raw_stone")
            <= InventorySpecNameCount(afterDeposit.items, "raw_stone")
            || CapacityNeedsStorage(refilled, &refillReason, &refillFree)
            || !FarmMockWalk(&stateName, "LOCATING_FARM", "RETURNING_TO_FARM")
            || !FarmWorkflowMockOwnedRoute(runtime, "washing-to-farm", 2)
            || !FarmMockWalk(&stateName, "VERIFY_FARM_REACHED",
                "RESUMING_FARM")
            return false
        stats.rawRefills += 1
        if cycleNumber = 1 {
            if !FarmMockWalk(&stateName, "RECOVERY", "RESUMING_FARM")
                return false
            stats.resumeFirstFailures += 1
        }

        resumed := BuildWorkflowMockInventory("washing", 5, 1, 12000)
        if !DetectConsumedInventoryItem(refilled.items, resumed.items,
            &consumedName, &consumedCount)
            || consumedName != "raw_stone" || consumedCount != 1
            || !InventorySnapshotHasReward(resumed, refilled)
            || !FarmMockWalk(&stateName, "VERIFY_FARM_RESUMED", "FARMING",
                "WASH_SETTLING", "WASH_CORRECTING", "FARMING")
            return false
        stats.rawConsumptions += 1
        stats.verifiedRewards += 1
        stats.cycles += 1
        refillBaseline := refilled
        ; Model the next verified output accumulation reaching the configured
        ; storage threshold. The resume reward itself is observed above; this
        ; deterministic snapshot represents the later full Farm state.
        current := BuildWorkflowMockInventory("washing", 5, 1, 100000)
    }
    stats.clean := FarmWorkflowMockIsClean(runtime)
    stats.blockedDuplicateTasks := runtime.blockedDuplicateTasks
    stats.blockedConcurrentInputs := runtime.blockedConcurrentInputs
    return stateName = "FARMING" && stats.cycles = cycleCount
        && stats.outputsDeposited = cycleCount && stats.rawRefills = cycleCount
        && stats.rawConsumptions = cycleCount
        && stats.verifiedRewards = cycleCount && stats.clean
}

FarmWorkflowMockFaultCoverage(stats) {
    return stats.storageUiFirstFailures = 1 && stats.inventoryDelays > 0
        && stats.resumeFirstFailures = 1 && stats.targetLosses > 0
        && stats.heading90 > 0 && stats.heading180 > 0
        && stats.headingRandom > 0
        && stats.truckReacquisitions = stats.cycles
        && stats.truckSmallPositionChanges = stats.cycles
        && stats.routePauses = 1 && stats.routeRecoveries = 1
}

RunBoundedStorageRecoveryPolicyMockTest(cycleCount := 100) {
    if cycleCount < 1
        return false
    recoveryClaims := 0
    terminalFailures := 0
    Loop cycleCount {
        storagePending := true
        recoveryAttempted := false
        if !StorageRecoveryRetryAllowed(storagePending, recoveryAttempted)
            return false
        recoveryAttempted := true
        recoveryClaims += 1
        ; The failed recovery may not schedule a third storage owner.
        if StorageRecoveryRetryAllowed(storagePending, recoveryAttempted)
            return false
        terminalFailures += 1
        storagePending := false
        recoveryAttempted := false
        if StorageRecoveryRetryAllowed(storagePending, recoveryAttempted)
            return false
    }
    return recoveryClaims = cycleCount && terminalFailures = cycleCount
}

RunAmbiguousTransferNoRetryMockTest(cycleCount := 100) {
    ; Model three late-server cases that previously caused a second swapItems:
    ; a first withdraw with no confirmed units, and a delayed second stack after
    ; one confirmed deposit/withdraw stack. The late mutation is deliberately
    ; applied after the result is classified; a safe policy must not dispatch
    ; again in any cycle.
    if cycleCount < 1
        return false
    Loop cycleCount {
        delayedFirstWithdrawDispatches := 1
        if WashingRefillFailureAction("ERROR AMBIGUOUS_TRANSFER")
            = "RETRY_ZERO"
            delayedFirstWithdrawDispatches += 1
        lateFirstWithdrawApplied := true
        if !lateFirstWithdrawApplied || delayedFirstWithdrawDispatches != 1
            return false

        delayedDepositStackDispatches := 2
        if StorageTransferReceiptAction("PARTIAL_AMBIGUOUS_TRANSFER")
            = "RETRY_EXACT"
            delayedDepositStackDispatches += 1
        lateDepositStackApplied := true
        if !lateDepositStackApplied || delayedDepositStackDispatches != 2
            return false

        delayedWithdrawStackDispatches := 2
        if StorageTransferReceiptAction("PARTIAL_NO_PROGRESS", true)
            = "RETRY_EXACT"
            delayedWithdrawStackDispatches += 1
        lateWithdrawStackApplied := true
        if !lateWithdrawStackApplied || delayedWithdrawStackDispatches != 2
            return false
    }
    return true
}

IsMiningActive(*) {
    global State
    ; The stop hotkey must remain live while a blocking start preflight is running.
    return State.running || State.registrationActive || State.startInProgress
}

ConfigureTrayMenu() {
    A_TrayMenu.Delete()
    A_TrayMenu.Add("AI採掘機を開く", ShowMainWindow)
    A_TrayMenu.Add()
    A_TrayMenu.Add("自動操作を開始 / 停止", ToggleMining)
    A_TrayMenu.Add("荷台前の設定・自動再開", OpenExeRouteSettings)
    A_TrayMenu.Add("キー・動作設定", ShowSettings)
    A_TrayMenu.Add("不具合の目印を記録", SupportMarkProblem)
    A_TrayMenu.Add("診断ZIPを保存（停止後）", ExportSupportDiagnostics)
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
    if State.running || State.registrationActive || State.startInProgress {
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
        State.taglineLabel.Text := "画面を奪わず、洗浄完了を確認して石を洗います"
    } else if actionMode = "gold" {
        State.countLabel.Text := "砂金採り回数`n" State.successes
        State.mealLabel.Text := "位置補正`n" State.nudges
        State.taglineLabel.Text := "画面を奪わず、位置ずれも検知して砂金を採ります"
    } else {
        State.countLabel.Text := "採掘回数`n" State.successes
        State.mealLabel.Text := "食事回数`n" State.meals
        State.taglineLabel.Text := "画面を奪わず、石の再出現を見て採掘します"
    }
    if StationaryOnlyEnabled() {
        State.taglineLabel.Text := "荷台前の両操作を確認し、移動・視点入力なしで続けます"
        if actionMode != "mining"
            State.mealLabel.Text := "自動移動（なし）`n0"
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

StartRuntimeStatusOverlay() {
    SetTimer UpdateRuntimeStatusOverlay, 250
    UpdateRuntimeStatusOverlay()
}

HideRuntimeStatusOverlay() {
    global State
    SetTimer UpdateRuntimeStatusOverlay, 0
    if IsObject(State.statusOverlay) && State.statusOverlay.visible {
        try State.statusOverlay.gui.Hide()
        State.statusOverlay.visible := false
    }
}

DestroyRuntimeStatusOverlay() {
    global State
    SetTimer UpdateRuntimeStatusOverlay, 0
    if IsObject(State.statusOverlay) {
        try State.statusOverlay.gui.Destroy()
    }
    State.statusOverlay := 0
}

EnsureRuntimeStatusOverlay() {
    global State
    if IsObject(State.statusOverlay)
        return State.statusOverlay

    overlay := Gui("+AlwaysOnTop -Caption +ToolWindow +E0x20 +E0x08000000")
    overlay.BackColor := "171A21"
    overlay.MarginX := 14
    overlay.MarginY := 7
    overlay.SetFont("s10 w700 cF4F7FB", "Segoe UI")
    title := overlay.AddText("x14 y7 w492 h20 Center", "")
    overlay.SetFont("s8 w500 cB8C2D0", "Segoe UI")
    meta := overlay.AddText("x14 y31 w492 h18 Center", "")
    overlay.SetFont("s7 w500 c8F9AAA", "Cascadia Mono")
    debug := overlay.AddText("x14 y50 w492 h36 Center Hidden", "")
    State.statusOverlay := {
        gui: overlay, title: title, meta: meta, debug: debug,
        visible: false, textKey: "", x: "", y: "", w: "", h: ""
    }
    return State.statusOverlay
}

UpdateRuntimeStatusOverlay(*) {
    global State, Config, LocalNav
    if !RuntimeStatusOverlayShouldBeVisible(&bounds) || LocalNav.pid {
        if IsObject(State.statusOverlay) && State.statusOverlay.visible {
            try State.statusOverlay.gui.Hide()
            State.statusOverlay.visible := false
        }
        return
    }

    statusOverlay := EnsureRuntimeStatusOverlay()
    title := RuntimeStatusOverlayTitle(State.runMode, State.statusLabel.Text,
        State.automationPhase)
    meta := RuntimeStatusOverlayMeta(State.successes,
        State.lastInventoryMaxWeight > 0, State.lastInventoryFreeWeight,
        State.storageTrips)
    if State.runMode = "washing"
        meta .= " | 移動入力禁止"
    now := MonotonicMs()
    watchdogAge := State.farmWatchdogAt
        ? Max(0, now - State.farmWatchdogAt) : 0
    targetState := State.targetLostSince ? "LOST"
        : InStr(State.lastTargetProbeResult, "PRESENT ") = 1 ? "FOUND"
        : InStr(State.lastTargetProbeResult, "MISSING ") = 1 ? "LOST"
        : "UNKNOWN"
    cameraState := State.workViewStatus ? State.workViewStatus : "UNKNOWN"
    debugText := Config.debugOverlay
        ? RuntimeStatusOverlayDebug(State.farmState,
            State.lastInventoryWeight, State.lastInventoryMaxWeight,
            State.lastVerifiedRewardAt, now, State.storageRetryCount,
            targetState, cameraState, watchdogAge, Config.farmWatchdogMs)
        : ""
    textKey := title "`n" meta "`n" debugText
    boundsChanged := statusOverlay.x != bounds.x || statusOverlay.y != bounds.y
        || statusOverlay.w != bounds.w || statusOverlay.h != bounds.h
    textChanged := statusOverlay.textKey != textKey
    wasVisible := statusOverlay.visible

    if boundsChanged {
        statusOverlay.title.Move(14, 7, bounds.w - 28, 20)
        statusOverlay.meta.Move(14, 31, bounds.w - 28, 18)
        statusOverlay.debug.Move(14, 50, bounds.w - 28, 36)
    }
    if textChanged {
        statusOverlay.title.Text := title
        statusOverlay.meta.Text := meta
        statusOverlay.debug.Text := debugText
        statusOverlay.debug.Visible := Config.debugOverlay
        statusOverlay.textKey := textKey
    }

    if !State.running || !IsTargetForeground(State.generation) || LocalNav.pid {
        try statusOverlay.gui.Hide()
        statusOverlay.visible := false
        return
    }
    if !statusOverlay.visible {
        statusOverlay.gui.Show("x" bounds.x " y" bounds.y " w" bounds.w
            " h" bounds.h " NoActivate")
        try WinSetTransparent 224, "ahk_id " statusOverlay.gui.Hwnd
        ApplyRoundedWindowCorners(statusOverlay.gui.Hwnd)
        statusOverlay.visible := true
    } else if boundsChanged {
        try WinMove bounds.x, bounds.y, bounds.w, bounds.h,
            "ahk_id " statusOverlay.gui.Hwnd
    }
    ; 初回表示とクライアント矩形の変化時だけ、フォーカスを奪わず最前面へ
    ; 戻します。250msごとのz-order更新はAlt+Tab先を邪魔するため行いません。
    if !wasVisible || boundsChanged {
        try DllCall("user32\SetWindowPos", "Ptr", statusOverlay.gui.Hwnd,
            "Ptr", -1, "Int", 0, "Int", 0, "Int", 0, "Int", 0, "UInt", 0x13)
    }

    if boundsChanged {
        statusOverlay.x := bounds.x
        statusOverlay.y := bounds.y
        statusOverlay.w := bounds.w
        statusOverlay.h := bounds.h
    }
}

RuntimeStatusOverlayShouldBeVisible(&bounds) {
    global State, Config, LocalNav
    bounds := 0
    if LocalNav.pid
        return false
    if !State.running || !State.targetHwnd
        return false
    if !DllCall("user32\IsWindow", "Ptr", State.targetHwnd, "Int")
        return false
    if !IsFiveMWindow(State.targetHwnd)
        return false
    try {
        if WinGetMinMax("ahk_id " State.targetHwnd) = -1
            return false
    } catch {
        return false
    }
    if !WinActive("ahk_id " State.targetHwnd)
        return false
    try WinGetClientPos &clientX, &clientY, &clientW, &clientH,
        "ahk_id " State.targetHwnd
    catch
        return false
    if clientW <= 0 || clientH <= 0
        return false
    bounds := RuntimeStatusOverlayBounds(clientX, clientY, clientW, clientH,
        Config.debugOverlay)
    return true
}

RuntimeStatusOverlayBounds(clientX, clientY, clientW, clientH,
    debugEnabled := false) {
    margin := clientW >= 360 ? 18 : 8
    overlayW := Min(520, Max(160, clientW - margin * 2))
    overlayH := debugEnabled ? 94 : 58
    overlayX := clientX + Floor((clientW - overlayW) / 2)
    overlayY := clientY + (clientH >= 240 ? 34 : 12)
    return {x: overlayX, y: overlayY, w: overlayW, h: overlayH}
}

RuntimeStatusOverlayDebug(farmState, inventoryWeight, inventoryMaxWeight,
    lastVerifiedRewardAt, now, storageRetry, targetState, cameraState,
    watchdogAge, watchdogLimit) {
    inventoryText := inventoryMaxWeight > 0
        ? Round(inventoryWeight * 100 / inventoryMaxWeight, 1) "%"
        : "--"
    rewardText := lastVerifiedRewardAt > 0
        ? Round(Max(0, now - lastVerifiedRewardAt) / 1000, 1) "s"
        : "--"
    targetText := targetState = "FOUND" || targetState = "LOST"
        ? targetState : "UNKNOWN"
    cameraText := cameraState = "TARGET_OK" ? "TARGET_OK"
        : cameraState = "INPUT_SENT" ? "VERIFY"
        : cameraState = "WAIT_FG" ? "WAIT_FG"
        : cameraState = "FAILED" ? "FAILED" : "UNKNOWN"
    watchdogText := watchdogLimit > 0 && watchdogAge >= watchdogLimit
        ? "LATE" : "OK"
    return "FSM " farmState " | Inventory " inventoryText
        . " | Reward " rewardText
        . "`nStorage retry " Max(0, storageRetry)
        . " | Target " targetText " | Camera " cameraText
        . " | Watchdog " watchdogText
}

RuntimeStatusOverlayTitle(mode, rawStatus, phase) {
    return RuntimeStatusOverlayModeLabel(mode) " | "
        . RuntimeStatusOverlayCompactStatus(rawStatus, phase)
}

RuntimeStatusOverlayModeLabel(mode) {
    return mode = "washing" ? "石洗い"
        : mode = "gold" ? "砂金採り" : "採掘"
}

RuntimeStatusOverlayCompactStatus(rawStatus, phase := "") {
    statusText := Trim(String(rawStatus), " `t`r`n")
    statusText := RegExReplace(statusText, "^(?:●\s*|状態:\s*)")
    if !statusText
        statusText := RuntimeStatusOverlayPhaseLabel(phase)
    if StrLen(statusText) > 34
        statusText := SubStr(statusText, 1, 33) "..."
    return statusText
}

RuntimeStatusOverlayPhaseLabel(phase) {
    return phase = "capacity_check" ? "所持品確認中"
        : phase = "find_registered_vehicle" ? "現在位置の荷台を確認中"
        : phase = "depositing" ? "収納中"
        : phase = "return_to_work" ? "同じ位置で作業を再確認"
        : phase = "priming_inventory" ? "所持品準備中"
        : phase = "eating" ? "食事中"
        : phase = "preparing" ? "準備中"
        : phase = "stopped" ? "停止中" : "作業中"
}

RuntimeStatusOverlayMeta(successes, freeWeightKnown, freeWeight, storageTrips) {
    freeWeightText := freeWeightKnown ? FormatInventoryWeight(freeWeight) : "未確認"
    return "実成功 " successes " | 空き " freeWeightText " | 収納 " storageTrips
}

UpdateConnectionStatus(*) {
    global State, Config
    hwnd := FindFiveMWindow()
    State.connectionLabel.Text := hwnd ? "FiveM　接続済み" : "FiveM　未接続"
    State.modeLabel.Text := Config.actionMode = "washing" && Config.washForwardCorrection
        ? "操作　石洗い＋位置補正（FiveMを前面にしてください）"
        : Config.backgroundMode
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
    if State.startInProgress {
        State.settingsErrorLabel.Text := "開始準備を停止してから設定を変更してください。"
        return
    }
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
    try {
        newStorageTriggerPercent := Integer(Trim(
            State.storageTriggerPercentControl.Value))
        newEstimatedRewardWeight := Integer(Trim(
            State.estimatedRewardWeightControl.Value))
        newMinimumFreeSlots := Integer(Trim(
            State.minimumFreeSlotsControl.Value))
        newStorageMaxRetries := Integer(Trim(
            State.storageMaxRetriesControl.Value))
        newFarmWatchdogMs := Integer(Trim(State.farmWatchdogMsControl.Value))
        newTargetLostRecoveryMs := Integer(Trim(
            State.targetLostRecoveryMsControl.Value))
    } catch {
        State.settingsErrorLabel.Text := "自動収納・復旧の設定値を数値で指定してください。"
        return
    }
    if newStorageTriggerPercent < 50 || newStorageTriggerPercent > 99
        || newEstimatedRewardWeight < 250 || newEstimatedRewardWeight > 20000
        || newMinimumFreeSlots < 0 || newMinimumFreeSlots > 10
        || newStorageMaxRetries < 1 || newStorageMaxRetries > 8
        || newFarmWatchdogMs < 15000 || newFarmWatchdogMs > 180000
        || newTargetLostRecoveryMs < 5000 || newTargetLostRecoveryMs > 60000 {
        State.settingsErrorLabel.Text := "自動収納・復旧の設定値が許容範囲外です。"
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
        minimumFreeWeight: Config.minimumFreeWeight,
        storageTriggerPercent: Config.storageTriggerPercent,
        estimatedRewardWeight: Config.estimatedRewardWeight,
        minimumFreeSlots: Config.minimumFreeSlots,
        storageMaxRetries: Config.storageMaxRetries,
        farmWatchdogMs: Config.farmWatchdogMs,
        targetLostRecoveryMs: Config.targetLostRecoveryMs,
        debugOverlay: Config.debugOverlay
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
    Config.storageTriggerPercent := newStorageTriggerPercent
    Config.estimatedRewardWeight := newEstimatedRewardWeight
    Config.minimumFreeSlots := newMinimumFreeSlots
    Config.storageMaxRetries := newStorageMaxRetries
    Config.farmWatchdogMs := newFarmWatchdogMs
    Config.targetLostRecoveryMs := newTargetLostRecoveryMs
    Config.debugOverlay := State.debugOverlayControl.Value ? 1 : 0
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
        Config.storageTriggerPercent := oldConfig.storageTriggerPercent
        Config.estimatedRewardWeight := oldConfig.estimatedRewardWeight
        Config.minimumFreeSlots := oldConfig.minimumFreeSlots
        Config.storageMaxRetries := oldConfig.storageMaxRetries
        Config.farmWatchdogMs := oldConfig.farmWatchdogMs
        Config.targetLostRecoveryMs := oldConfig.targetLostRecoveryMs
        Config.debugOverlay := oldConfig.debugOverlay
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
        IniWrite Config.fastWashMode, temporarySettingsPath, "Washing", "FastMode"
        IniWrite Config.washPostCompletionSettleMs, temporarySettingsPath, "Washing", "PostCompletionSettleMs"
        IniWrite Config.rawStoneItemName, temporarySettingsPath, "Washing", "RawStoneItem"
        IniWrite Config.washRefillMaximum, temporarySettingsPath, "Washing", "RefillMaximum"
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
        IniWrite Config.workViewMouseStep, temporarySettingsPath, "ViewLock", "MouseStep"
        IniWrite Config.workViewMouseDirection, temporarySettingsPath, "ViewLock", "MouseDirection"
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
        IniWrite Config.storageTriggerPercent, temporarySettingsPath, "VehicleStorage", "StorageTriggerPercent"
        IniWrite Config.estimatedRewardWeight, temporarySettingsPath, "VehicleStorage", "EstimatedRewardWeight"
        IniWrite Config.minimumFreeSlots, temporarySettingsPath, "VehicleStorage", "MinimumFreeSlots"
        IniWrite Config.storageMaxRetries, temporarySettingsPath, "VehicleStorage", "MaxRetries"
        IniWrite Config.storageVerifyTimeoutMs, temporarySettingsPath, "VehicleStorage", "VerifyTimeoutMs"
        IniWrite Config.routeIdleFinishMs, temporarySettingsPath, "VehicleStorage", "RouteIdleFinishMs"
        IniWrite Config.routeSettleMs, temporarySettingsPath, "VehicleStorage", "RouteSettleMs"
        IniWrite Config.vehicleSearchPulseMs, temporarySettingsPath, "VehicleStorage", "SearchPulseMs"
        IniWrite Config.serverHealthIntervalMs, temporarySettingsPath, "Safety", "ServerHealthIntervalMs"
        IniWrite Config.farmWatchdogMs, temporarySettingsPath, "Safety", "FarmWatchdogMs"
        IniWrite Config.targetLostRecoveryMs, temporarySettingsPath, "Safety", "TargetLostRecoveryMs"
        IniWrite Config.rewardConfirmTimeoutMs, temporarySettingsPath, "Safety", "RewardConfirmTimeoutMs"
        IniWrite Config.debugOverlay, temporarySettingsPath, "Safety", "DebugOverlay"
        FileMove temporarySettingsPath, settingsPath, true
    } catch as err {
        try FileDelete temporarySettingsPath
        throw err
    }
}

ToggleLocalVehicleStorage(control) {
    global State, Config
    if State.running || State.registrationActive || State.startInProgress {
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
    State.vehicleEnabledControl.Enabled := valid && !State.running
        && !State.registrationActive && !State.startInProgress
    State.vehicleNameEdit.Value := Config.vehicleName
    State.vehicleNameEdit.Enabled := !State.running && !State.registrationActive
        && !State.startInProgress
    State.vehicleRegisterButton.Enabled := !State.running
        && !State.registrationActive && !State.startInProgress
    State.vehicleRegisterButton.Text := valid ? "別の車両を登録" : "車両を登録"
    State.vehicleDeleteButton.Enabled := valid && !State.running
        && !State.registrationActive && !State.startInProgress

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
        || State.startInProgress
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
        . Config.stopHotkey . "で中止")
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
    if State.running || State.registrationActive || State.startInProgress
        || !IsValidVehicleProfile(Config)
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
            . FormatInventoryWeight(State.lastInventoryWeight) . " / "
            . FormatInventoryWeight(State.lastInventoryMaxWeight) . "　" . percent . "%"
        State.capacityDetailLabel.Text := "残り "
            . FormatInventoryWeight(State.lastInventoryFreeWeight)
            . "　·　収納開始 " . FormatInventoryWeight(Config.minimumFreeWeight)
    } else {
        State.capacityProgress.Value := 0
        State.capacityStatusLabel.Text := "所持重量　自動操作の開始後に確認"
        State.capacityDetailLabel.Text := "残り "
            . FormatInventoryWeight(Config.minimumFreeWeight) . " 以下で自動収納"
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
    present := ProbeTargetOption(probeMode, expected, expectedGeneration)
    ; A completed helper can be interrupted by F9 before this caller resumes.
    ; Never let an observation from the stopped generation restore TARGET_OK.
    if expectedGeneration && !IsCurrentRun(expectedGeneration)
        return false
    if !present
        return false
    return ConfirmWorkViewTarget(actionMode, "probe", expectedGeneration)
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
        IniWrite Config.fastWashMode, temporarySettingsPath, "Washing", "FastMode"
        IniWrite Config.washPostCompletionSettleMs, temporarySettingsPath, "Washing", "PostCompletionSettleMs"
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
    if State.startInProgress {
        State.updatePageStatus.Text := "開始準備を停止してから更新してください。"
        QueueWebUiFlush()
        return
    }
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
    if State.startInProgress {
        if !silent
            State.statusLabel.Text := "●  開始準備を停止してから更新してください"
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

    if State.running || State.startInProgress || State.updateOperation
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
    global State, Config, LocalNav
    ; Legacy INI/UI settings cannot reactivate movement, camera control or
    ; foreground pixel macros. Storage/eating opt-ins remain user settings.
    if StationaryOnlyEnabled() {
        Config.backgroundMode := 1
        Config.washForwardCorrection := 0
        Config.goldRecoveryEnabled := 0
        Config.workViewLock := 0
    }

    ; UI・トレイ・設定可能なショートカットのどこから呼ばれても、
    ; 車両登録・通常run・別の開始preflightと同時実行しません。
    ; Claim happens before every blocking check. F8連打/UI+F8の2本目は、
    ; 最初の開始がまだrunning=falseの間も必ず拒否されます。
    if !TryClaimStartOperation(&startToken)
        return
    if IsObject(LocalNav.dialog)
        try LocalNav.dialog.Hide()
    runInitializationOwned := false
    try {
    if !ShowStartPreparationState(startToken)
        return
    ; A previous graceful stop may have hit a transient disk error while appending
    ; SESSION_END. Never overwrite that session identity with a new run until its
    ; immutable stop record is durably queued.
    startPrepared := PrepareMetagameForNewFarmStart()
    if !IsStartOperationCurrent(startToken)
        return
    if !startPrepared {
        State.statusLabel.Text := "●  前回のSTONE記録を安全に保存中です。少し待って再試行してください"
        WriteDiagnostic("METAGAME_START_BLOCKED pendingEnd="
            (FarmMetagameClosurePending() ? 1 : 0) " rewardWal="
            State.verifiedRewardWalPending.Count)
        return
    }
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
    if !IsStartOperationCurrent(startToken)
        return
    if !targetHwnd {
        State.statusLabel.Text := "●  FiveMが見つかりません"
        State.connectionLabel.Text := "FiveM: 未接続"
        return
    }
    try targetPid := WinGetPID("ahk_id " targetHwnd)
    catch
        targetPid := 0
    if !IsStartOperationCurrent(startToken)
        return
    if !targetPid {
        State.statusLabel.Text := "●  FiveMのプロセスを確認できません"
        return
    }
    preflightHealth := RunBackgroundBridge("health")
    if !IsStartOperationCurrent(startToken)
        return
    if !ParseServerHealth(preflightHealth, &serverEpoch) {
        State.statusLabel.Text := "●  サーバー接続を確認できないため開始しません"
        State.connectionLabel.Text := "FiveM　サーバー未接続"
        WriteDiagnostic("SERVER_PREFLIGHT_ERROR=" preflightHealth)
        return
    }
    companionEpoch := ""
    if Config.vehicleStorageEnabled && Config.vehicleCompanionProtocol = 1 {
        companionReady := QueryCompanionStatus(&preflightCompanion)
        if !IsStartOperationCurrent(startToken)
            return
        if !companionReady {
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

    criticalWasOn := EnterMetagameOutboxCritical()
    try {
    if !IsStartOperationCurrent(startToken)
        return
    State.running := true
    State.stationaryWaiting := false
    State.startInProgress := false
    State.startRequestToken := 0
    State.runMode := Config.actionMode
    State.generation += 1
    runGeneration := State.generation
    State.pendingFarmTimerGeneration := 0
    State.pendingFarmTimerTaskId := 0
    State.pendingFarmTimerDueAt := 0
    ; Transfer ownership from the preflight token to the same callback-drain gate
    ; used by timer work. F9 may interrupt any bridge/storage setup below; until
    ; this StartMining stack fully unwinds, F8 cannot install a replacement run.
    State.activeFarmCallbacks += 1
    runInitializationOwned := true
    State.targetHwnd := targetHwnd
    State.targetPid := targetPid
    State.successes := 0
    State.attempts := 0
    State.meals := 0
    State.nudges := 0
    ResetActionCompletionState()
    ResetGoldRecoveryState()
    ResetWashCompletionRecoveryState()
    State.nextHungerCheckAt := 0
    State.nextEatAllowedAt := 0
    State.nextBackgroundEatAt := MonotonicMs() + Config.backgroundFirstEatDelayMs
    State.backgroundHungerUnknownLogged := false
    State.backgroundEatFailures := 0
    State.lastWorkViewAt := 0
    State.lastWorkViewVerifiedAt := 0
    State.workViewStatus := "UNKNOWN"
    State.workViewFailures := 0
    State.workViewNoEffectCount := 0
    State.workViewDirection := Config.workViewMouseDirection
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
    State.farmState := "IDLE"
    State.farmStateReason := "開始準備"
    State.farmStateEnteredAt := MonotonicMs()
    State.farmStateTaskId += 1
    State.farmStateRetry := 0
    State.farmStateLastError := ""
    State.farmWatchdogAt := MonotonicMs()
    State.lastVerifiedRewardAt := 0
    State.watchdogRecoveryCount := 0
    State.targetLostSince := 0
    State.targetRecoveryAttempts := 0
    State.recoveryPreflightFailures := 0
    State.recoveryRestartCount := 0
    State.recoveryRestartPending := false
    State.lastTargetProbeResult := ""
    State.recoveryReturnState := "FARMING"
    State.recoveryReason := ""
    State.inventorySnapshotRevision := 0
    State.confirmedInventory := 0
    State.pendingFarmAttempt := 0
    State.miningAttemptId := 0
    State.resumeVerificationPending := false
    State.rewardReconcileAttempts := 0
    State.storagePreSnapshot := 0
    State.storageRetryCount := 0
    State.storageMovementHistory := []
    State.storageMatchedViewRoute := ""
    State.recoveryAtStorage := false
    State.farmSessionId := ""
    State.farmSessionStartedAt := 0
    State.farmSessionEndedAt := 0
    State.metagameSessionResetCount := 0
    State.farmSessionBeginQueued := false
    State.farmSessionBeginSent := false
    State.farmSessionEndQueued := false
    State.farmSessionEndSent := false
    State.lastMiningEventId := ""
    ResetFarmOutputLedger()
    State.inventoryBaseline := ""
    State.inventoryBaselineWeight := -1
    State.nextActionAt := 0
    State.workpointProbeFailures := 0
    State.nextCapacityCheckAt := 0
    State.storagePending := false
    State.storageStartPending := false
    State.storageRecoveryAttempted := false
    State.storageReason := ""
    State.storageOutputsVerified := false
    State.storageRefillVerified := false
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
    State.lastAlertKind := ""
    State.lastAlertAt := 0
    State.mainButton.Text := "自動操作を停止"
    State.actionControl.Enabled := false
    SetConfigurationEnabled(false)
    UpdateActionUi()
    State.statusLabel.Text := "●  準備中"
    State.connectionLabel.Text := "FiveM: 接続済み"
    State.modeLabel.Text := StationaryOnlyEnabled() ? "荷台前専用：移動・視点入力なし／一時不在は自動再開待ち" : State.runMode = "washing" && Config.washForwardCorrection
        ? "石洗いの画面補正: FiveMを前面にしてください"
        : Config.backgroundMode
            ? "バックグラウンド操作: オン（徒歩・画面補正時は前面が必要）"
            : "バックグラウンド操作: オフ（前面操作）"
    if Config.hideWhileRunning
        State.gui.Hide()
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    StartRuntimeStatusOverlay()

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
        snapshotResult := RunBackgroundBridgeCancelable(runGeneration,
            "inventory-snapshot")
        if !IsCurrentRun(runGeneration)
            return
        if !ParseInventorySnapshot(snapshotResult, &inventoryInfo) {
            WriteDiagnostic("INVENTORY_BASELINE_ERROR=" snapshotResult)
            StopMining()
            State.statusLabel.Text := "インベントリ状態を取得できないため開始しませんでした"
            ShowPage("vehicle")
            return
        }
        startCapacityBlocked := CapacityNeedsStorage(inventoryInfo,
            &startReason, &startFreeWeight)
        criticalWasOn := A_IsCritical
        if !criticalWasOn
            Critical "On"
        try {
            if !IsCurrentRun(runGeneration)
                return
            State.inventoryBaseline := inventoryInfo.items
            State.inventoryBaselineWeight := inventoryInfo.weight
            if !RecordConfirmedInventory(inventoryInfo, "start_companion",
                runGeneration)
                return
            if !startCapacityBlocked {
                State.nextCapacityCheckAt := MonotonicMs()
                    + Config.capacityCheckIntervalMs
            }
        } finally {
            if !criticalWasOn
                Critical "Off"
        }
        if startCapacityBlocked {
            WriteDiagnostic("INVENTORY_START_CAPACITY_BLOCKED reason=" startReason
                " free=" startFreeWeight " baseline=protected")
            StopAutomationWithFault(
                "開始時点ですでに容量が不足しています。既存の食料や道具を保護するため自動収納は行いません。手動で空きを作ってから再開してください",
                "vehicle", "UNTRUSTED_STORAGE_BASELINE")
            return
        }
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

    if IsCurrentRun(runGeneration) {
        if !BeginFarmMetagameSession(runGeneration) {
            WriteDiagnostic("METAGAME_START_SESSION_PERSIST_FAILED gen="
                runGeneration)
            StopMining()
            State.statusLabel.Text := "●  STONE記録の開始を保存できないため、自動操作を開始しませんでした"
            return
        }
        if State.storagePending {
            TransitionFarmState("NEED_STORAGE",
                "開始時に補充が必要", runGeneration, 0, true)
            TransitionFarmState("STOPPING_FARM",
                "開始時容量不足から自動収納", runGeneration)
        } else
            TransitionFarmState("FARMING", "開始準備完了", runGeneration, 0, true)
        ScheduleNext(runGeneration, State.storagePending ? 100 : 900)
    }
    } finally {
        FinishStartPreparation(startToken)
        if runInitializationOwned
            ReleaseFarmCallback()
    }
}

StopMining(faultContext := 0, *) {
    global State, Config

    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    faultOwnerMismatch := IsObject(faultContext)
        && faultContext.HasOwnProp("expectedGeneration")
        && (!State.running
            || State.generation != faultContext.expectedGeneration
            || (faultContext.HasOwnProp("expectedTaskId")
                && State.farmStateTaskId != faultContext.expectedTaskId))
    if State.stopInProgress || faultOwnerMismatch {
        if !criticalWasOn
            Critical "Off"
        return false
    }
    State.stopInProgress := true
    if !criticalWasOn
        Critical "Off"
    CancelExeRouteOperation()

    try {
    startCancelled := CancelStartOperation()
    if startCancelled && !State.running {
        ; Preflight owns no Farm session or scheduled work yet. Invalidating its
        ; token is sufficient; when its current blocking bridge call returns, every
        ; continuation check/finally observes cancellation and cannot commit a run.
        ReleaseAllInputs()
        State.automationPhase := "stopped"
        State.mainButton.Text := "自動操作を開始"
        State.actionControl.Enabled := true
        SetConfigurationEnabled(true)
        State.statusLabel.Text := "●  開始準備を中止しました"
        UpdateActionUi()
        return
    }
    if State.registrationActive && !State.running {
        CancelVehicleRegistration()
        return
    }

    previousPhase := State.automationPhase
    previousFarmState := State.farmState
    faultRequested := IsObject(faultContext)
        && faultContext.HasOwnProp("message")
    if faultRequested {
        WriteDiagnostic("FARM_STOP code="
            . DiagnosticToken(faultContext.faultCode)
            . " state=" . State.farmState . " reason="
            . DiagnosticToken(faultContext.message))
    }
    if State.running
        TransitionFarmState("STOPPING_FARM", "停止要求", State.generation, 0, true)
    ; Stop/ERRORは外部IPCより先に、所有する全入力と進行中helperを止めます。
    CancelActiveBridgeProcess()
    ReleaseAllInputs()
    ReleaseBackgroundTarget(true)
    endDurable := EndFarmMetagameSession()
    cancelCompanion := Config.vehicleCompanionProtocol = 1
        && (State.companionReady || State.companionEpoch)
    State.running := false
    if State.metagameOutbox.Length || !endDurable
        ScheduleMetagameOutboxReplay(1)
    State.generation += 1
    State.automationPhase := "stopped"
    ResetActionCompletionState()
    ResetWashCompletionRecoveryState()
    DiscardPendingFarmAttempt("run_stopped")
    State.rewardReconcileAttempts := 0
    State.targetLostSince := 0
    State.targetRecoveryAttempts := 0
    State.recoveryPreflightFailures := 0
    State.recoveryRestartCount := 0
    State.recoveryRestartPending := false
    ResetFarmOutputLedger()
    State.inventoryBaseline := ""
    State.inventoryBaselineWeight := -1
    State.nextActionAt := 0
    State.capacityProbeFailures := 0
    State.workpointProbeFailures := 0
    State.storagePending := false
    State.storageStartPending := false
    State.storageRecoveryAttempted := false
    State.storageReason := ""
    State.storageOutputsVerified := false
    State.storageRefillVerified := false
    State.serverEpoch := ""
    State.serverHealthFailures := 0
    State.nextServerHealthAt := 0
    State.nextBackgroundEatAt := 0
    State.backgroundHungerUnknownLogged := false
    State.backgroundEatFailures := 0
    State.lastWorkViewAt := 0
    State.lastWorkViewVerifiedAt := 0
    State.workViewStatus := "UNKNOWN"
    State.workViewFailures := 0
    State.workViewNoEffectCount := 0
    State.workViewDirection := Config.workViewMouseDirection
    State.targetPid := 0
    HideRuntimeStatusOverlay()

    if IsObject(State.timerFn) {
        try SetTimer(State.timerFn, 0)
    }
    State.timerFn := 0
    State.pendingFarmTimerGeneration := 0
    State.pendingFarmTimerTaskId := 0
    State.pendingFarmTimerDueAt := 0

    CancelActiveBridgeProcess()
    ; route helperを止めた直後に、先にDevCon入力を解放します。補助リソースの
    ; cancel応答待ち中も、前進・視点入力を押しっぱなしにしません。
    ReleaseAllInputs()
    ReleaseBackgroundTarget(true)
    if cancelCompanion
        RunCompanionCommand("cancel")
    ; cancel処理側で状態が変わっても、終了時の最終解放をもう一度保証します。
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
    if faultRequested {
        State.lastStorageResult := faultContext.message
        State.farmStateLastError := faultContext.message
        TransitionFarmState("ERROR", faultContext.message, 0, 0, true)
        State.statusLabel.Text := faultContext.message
        ShowPage(faultContext.pageName)
        ShowMainWindow()
    } else {
        State.statusLabel.Text := "●  停止中"
        TransitionFarmState("IDLE", "停止完了 (from " previousFarmState ")",
            0, 0, true)
    }
    ; Keep session identity/endedAt while a durable END append is pending. The idle
    ; replay timer retries it, and StartMining refuses to replace it. Successful
    ; closure is reset atomically when the next run is installed above.
    UpdateActionUi()
    State.gui.Show("NoActivate")
    UpdateConnectionStatus()
    return true
    } finally {
        criticalWasOn := A_IsCritical
        if !criticalWasOn
            Critical "On"
        State.stopInProgress := false
        if !criticalWasOn
            Critical "Off"
    }
}

SetConfigurationEnabled(enabled) {
    global State
    for control in [State.startHotkeyControl, State.stopHotkeyControl,
        State.backgroundControl, State.hideControl,
        State.washCorrectionControl, State.autoEatControl, State.foodKeyControl,
        State.autoUpdateControl, State.vehicleEnabledControl,
        State.vehicleRegisterButton, State.vehicleNameEdit,
        State.minimumFreeWeightControl, State.storageTriggerPercentControl,
        State.estimatedRewardWeightControl, State.minimumFreeSlotsControl,
        State.storageMaxRetriesControl, State.farmWatchdogMsControl,
        State.targetLostRecoveryMsControl, State.debugOverlayControl] {
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
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentRun(expectedGeneration)
            return false
        expectedTaskId := State.farmStateTaskId
        if IsObject(State.timerFn)
            try SetTimer(State.timerFn, 0)
        State.timerFn := 0
        action := FarmTimerScheduleAction(State.activeFarmCallbacks,
            State.running, State.stopInProgress,
            expectedGeneration = State.generation)
        if action = "DROP"
            return false
        if action = "DEFER" {
            ; One-shot timers scheduled by the current callback must not fire and
            ; disappear while that callback still owns the stack. Last request
            ; wins; ReleaseFarmCallback arms exactly one successor.
            State.pendingFarmTimerGeneration := expectedGeneration
            State.pendingFarmTimerTaskId := expectedTaskId
            State.pendingFarmTimerDueAt := MonotonicMs() + Max(1, Round(delayMs))
            return true
        }
        State.pendingFarmTimerGeneration := 0
        State.pendingFarmTimerTaskId := 0
        State.pendingFarmTimerDueAt := 0
        return ArmFarmTimerOwned(expectedGeneration, expectedTaskId, delayMs)
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

WorkCooldownWakeDelay(remainingMs) {
    ; 次回target表示の少し前に起き、サーバー確認・視点補正・食事判定を
    ; 待ち時間内で済ませます。残り1.5秒以下なら表示予定時刻まで待ちます。
    remaining := Max(0, Round(remainingMs))
    return remaining > 1800 ? remaining - 1500 : remaining
}

ScheduleWorkCooldown(expectedGeneration, actionRequestedAt, cooldownMs) {
    global State
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentRun(expectedGeneration)
            return false
        State.nextActionAt := actionRequestedAt + cooldownMs
        remaining := State.nextActionAt - MonotonicMs()
        return ScheduleNext(expectedGeneration,
            Max(1, WorkCooldownWakeDelay(remaining)))
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
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
                State.statusLabel.Text := BuildFarmProgressStatus(
                    "ゲーム内連携を再確認中（", State.companionHealthFailures, 3)
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
    if !State.storagePending && now < State.nextCapacityCheckAt {
        TransitionFarmState("FARMING", "容量確認はまだ不要",
            expectedGeneration, 0, true)
        return false
    }
    State.nextCapacityCheckAt := now + Config.capacityCheckIntervalMs
    snapshotResult := RunBackgroundBridgeCancelable(expectedGeneration, "inventory-snapshot")
    if !IsCurrentRun(expectedGeneration)
        return true
    if !ParseInventorySnapshot(snapshotResult, &inventoryInfo) {
        State.capacityProbeFailures += 1
        WriteDiagnostic("CAPACITY_PROBE_ERROR=" snapshotResult)
        if State.capacityProbeFailures >= 3 {
            EnterFarmRecovery(expectedGeneration, "FARMING",
                "capacity_snapshot_unavailable")
            return true
        }
        State.statusLabel.Text := "所持重量を再確認中（" State.capacityProbeFailures "/3）"
        State.nextCapacityCheckAt := MonotonicMs() + 850
        ScheduleNext(expectedGeneration, 950)
        return true
    }
    State.capacityProbeFailures := 0
    RecordConfirmedInventory(inventoryInfo, "capacity_check",
        expectedGeneration)
    needsStorage := FarmModeNeedsStorage(State.runMode, inventoryInfo,
        Config.rawStoneItemName, State.inventoryBaselineWeight,
        &capacityReason, &freeWeight, &rawStoneCount)
    if rawStoneCount >= 0
        State.lastRawStoneCount := rawStoneCount
    if !needsStorage {
        State.storagePending := false
        State.storageRecoveryAttempted := false
        TransitionFarmState("FARMING", "容量に余裕あり", expectedGeneration)
        return false
    }
    ; A transfer is authorized only by exact name+metadata quantities accumulated
    ; from finalized Farm reward snapshots. A broad "anything since start" delta
    ; would also include food picked up mid-run, so it is never a departure gate.
    ; A cold-start washing run with zero raw stone has no output delta by design.
    ; InitializeLocalVehicleRun already proved that exact refill-only objective from
    ; a live snapshot. Preserve it only while the next live snapshot still reports
    ; zero of the learned raw item; every ordinary/full-start case requires a
    ; positive verified-output ledger below.
    refillOnly := IsVerifiedWashingRefillOnlyDeparture(State.runMode,
        State.storagePending, State.storageOutputsVerified, State.storageReason,
        rawStoneCount)
    ledgerUnits := PositiveInventoryCountTotal(State.farmOutputLedger)
    ledgerReady := refillOnly || (ledgerUnits > 0
        && BuildFarmOutputProtectedBaseline(inventoryInfo.items,
            State.farmOutputLedger, &departureBaseline, &departureUnits,
            &ledgerFailure))
    if !ledgerReady {
        WriteDiagnostic("STORAGE_LEDGER_BLOCKED source=capacity reason="
            (ledgerUnits > 0 ? ledgerFailure : "empty_ledger")
            " ledger=" ledgerUnits " current="
            DiagnosticToken(inventoryInfo.items))
        StopAutomationWithFault(
            "確定した作業報酬だけを安全に特定できないため、食料や道具を保護して停止しました",
            "vehicle", "UNTRUSTED_STORAGE_BASELINE")
        return true
    }
    if !State.storagePending {
        State.storagePending := true
        State.storageRecoveryAttempted := false
    }
    if State.runMode = "mining" || State.runMode = "gold"
        NotifyExeBatchComplete(expectedGeneration, State.runMode)
    State.storageReason := capacityReason
    if !refillOnly
        State.storageOutputsVerified := false
    State.storageRefillVerified := false
    ; 一度容量不足になったら、収納完了または停止まで通常の採集へ戻しません。
    State.nextCapacityCheckAt := 0
    State.storagePreSnapshot := inventoryInfo
    if State.farmState != "STOPPING_FARM" {
        State.storageRetryCount := 0
        TransitionFarmState("NEED_STORAGE", "収納条件: " capacityReason,
            expectedGeneration)
    }
    State.lastCapacityReason := InStr(capacityReason, "raw_stone_empty")
        ? "未洗浄の石がなくなった"
        : capacityReason = "weight_percent"
        ? "重量率がしきい値以上"
        : capacityReason = "next_reward_weight"
            ? "次の報酬重量を保持できない"
            : "空きスロットがしきい値以下"
    WriteDiagnostic("VEHICLE_CAPACITY_TRIGGER reason=" capacityReason
        " weight=" inventoryInfo.weight " max=" inventoryInfo.maxWeight
        " free=" freeWeight " used=" inventoryInfo.used " slots=" inventoryInfo.slots)
    ; Inventory truth and the positive verified-output ledger are the authoritative
    ; departure gate. A full warning, finished resource, or shifted camera can hide the Farm
    ; target; probing it here used to deadlock before any truck movement was sent.
    ; The reversible route owns the departure pose, and the return path verifies the
    ; actual Farm target and next real reward before FARMING is committed again.
    if State.farmState != "STOPPING_FARM"
        TransitionFarmState("STOPPING_FARM", "収納前に作業を停止",
            expectedGeneration)
    DiscardPendingFarmAttempt("inventory_full")
    ResetActionCompletionState()
    ReleaseAllInputs()
    if !ReleaseBackgroundTarget(true) {
        EnterFarmRecovery(expectedGeneration, "FARMING",
            "storage_preflight_input_release")
        return true
    }
    WriteDiagnostic("VEHICLE_STORAGE_DEPARTURE_DIRECT reason=" capacityReason
        " target_gate=removed ledger_units=" ledgerUnits
        " refill_only=" (refillOnly ? 1 : 0))
    State.workpointProbeFailures := 0
    State.storageRecoveryAttempted := false
    State.timerFn := 0
    TransitionFarmState("LOCATING_TRUCK", "登録車両を現在位置から探索",
        expectedGeneration)
    RunVehicleStorageCycle(expectedGeneration)
    return true
}

WorkTargetCooldownRemainingMs() {
    global State, Config
    if !State.lastMineAt
        return 0
    ; 洗浄ループ自体は完了後すぐ再開しますが、車両回収や食事のための位置確認は
    ; targetが戻るまで待ち、約5.4秒の再出現中に位置回復を始めません。
    cooldownMs := State.runMode = "washing" ? Config.washReadinessGraceMs
        : State.runMode = "gold" ? Config.goldCycleMs + 750
        : Config.stoneResyncAfterMs
    return Max(0, State.lastMineAt + cooldownMs - MonotonicMs())
}

CapacityNeedsStorage(inventoryInfo, &reason, &freeWeight) {
    global Config
    reason := ""
    freeWeight := Max(0, inventoryInfo.maxWeight - inventoryInfo.weight)
    predictedReserve := Max(Config.minimumFreeWeight,
        Config.estimatedRewardWeight)
    usagePercent := inventoryInfo.maxWeight > 0
        ? inventoryInfo.weight * 100 / inventoryInfo.maxWeight : 100
    freeSlots := Max(0, inventoryInfo.slots - inventoryInfo.used)
    if usagePercent >= Config.storageTriggerPercent {
        reason := "weight_percent"
        return true
    }
    if freeWeight <= predictedReserve {
        reason := "next_reward_weight"
        return true
    }
    if freeSlots <= Config.minimumFreeSlots {
        reason := "free_slots"
        return true
    }
    return false
}

FarmModeNeedsStorage(mode, inventoryInfo, rawStoneItemName,
    baselineWeight, &reason, &freeWeight, &rawStoneCount) {
    global Config
    rawStoneCount := -1
    genericNeedsStorage := CapacityNeedsStorage(inventoryInfo, &reason,
        &freeWeight)
    if mode != "washing" || !rawStoneItemName
        return genericNeedsStorage

    rawStoneCount := InventorySpecNameCount(inventoryInfo.items,
        rawStoneItemName)
    if rawStoneCount = 0 {
        reason := genericNeedsStorage
            ? "raw_stone_empty_and_capacity" : "raw_stone_empty"
        return true
    }
    if baselineWeight < 0
        return genericNeedsStorage

    ; Protected washing input may intentionally be heavy. Only newly accumulated
    ; output weight or exhausted slots can trigger a trip before the input reaches
    ; zero; this same policy is used by normal dispatch and Recovery.
    freeSlots := Max(0, inventoryInfo.slots - inventoryInfo.used)
    netFarmGrowth := Max(0, inventoryInfo.weight - baselineWeight)
    predictedReserve := Max(Config.minimumFreeWeight,
        Config.estimatedRewardWeight)
    needsStorage := freeSlots <= Config.minimumFreeSlots
        || (netFarmGrowth > 0 && freeWeight <= predictedReserve)
    reason := needsStorage
        ? (freeSlots <= Config.minimumFreeSlots
            ? "free_slots" : "washing_output_capacity")
        : ""
    return needsStorage
}

IsVerifiedWashingRefillOnlyDeparture(mode, storagePending,
    storageOutputsVerified, storageReason, rawStoneCount) {
    return mode = "washing" && storagePending && storageOutputsVerified
        && storageReason = "raw_stone_empty" && rawStoneCount = 0
}

StorageRecoverySnapshotAction(atStorage, reduced, remainingDelta, stillFull,
    mode, rawStoneConfigured) {
    if !atStorage || !reduced || remainingDelta
        return "RETRY"
    if mode = "washing" && rawStoneConfigured
        return "REFILL"
    return stillFull ? "RETRY" : "RETURN"
}

StorageRecoveryRetryAllowed(storagePending, recoveryAttempted) {
    return storagePending && !recoveryAttempted
}

StorageReturnAllowed(mode, rawStoneConfigured, refillVerified) {
    return mode != "washing" || !rawStoneConfigured || refillVerified
}

TryClaimStorageRecoveryAttempt(expectedGeneration, expectedTaskId) {
    global State
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
            || !StorageRecoveryRetryAllowed(State.storagePending,
                State.storageRecoveryAttempted)
            return false
        State.storageRecoveryAttempted := true
        return true
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

WashingRefillReserveWeight(maxWeight) {
    global Config
    reserveForPercent := Ceil(Max(0, maxWeight)
        * (100 - Config.storageTriggerPercent) / 100) + 1
    return Max(Config.minimumFreeWeight + 1,
        Config.estimatedRewardWeight + 1, reserveForPercent)
}

WashingRefillReserveSlots(totalSlots) {
    global Config
    return Min(Max(0, totalSlots), Config.minimumFreeSlots + 1)
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

RecordConfirmedInventory(inventoryInfo, source := "snapshot",
    expectedGeneration := 0) {
    global State
    if !IsObject(inventoryInfo)
        return 0
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if expectedGeneration && !IsCurrentRun(expectedGeneration)
            return 0
        State.inventorySnapshotRevision += 1
        inventoryInfo.revision := State.inventorySnapshotRevision
        inventoryInfo.confirmedAt := MonotonicMs()
        State.confirmedInventory := inventoryInfo
        UpdateInventoryCapacityState(inventoryInfo)
        WriteDiagnostic("INVENTORY_CONFIRMED source=" source
            " revision=" inventoryInfo.revision
            " weight=" inventoryInfo.weight " max=" inventoryInfo.maxWeight
            " used=" inventoryInfo.used " slots=" inventoryInfo.slots)
        return inventoryInfo.revision
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

InventorySpecTotalCount(spec) {
    total := 0
    for row in InventorySpecToRows(spec)
        total += row.count
    return total
}

InventorySnapshotHasReward(afterInfo, beforeInfo) {
    if !IsObject(afterInfo) || !IsObject(beforeInfo)
        return false
    return afterInfo.weight > beforeInfo.weight
        || InventorySpecHasIncrease(afterInfo.items, beforeInfo.items)
}

WashingSnapshotHasExchangeReward(afterInfo, beforeInfo, configuredRawName,
    &consumedRawName, &consumedUnits, &outputUnits) {
    consumedRawName := ""
    consumedUnits := 0
    outputUnits := 0
    if !IsObject(afterInfo) || !IsObject(beforeInfo)
        return false
    if configuredRawName {
        beforeRaw := InventorySpecNameCount(beforeInfo.items,
            configuredRawName)
        afterRaw := InventorySpecNameCount(afterInfo.items,
            configuredRawName)
        if beforeRaw <= afterRaw
            return false
        consumedRawName := configuredRawName
        consumedUnits := beforeRaw - afterRaw
    } else if !DetectConsumedInventoryItem(beforeInfo.items, afterInfo.items,
        &consumedRawName, &consumedUnits) {
        return false
    }
    beforeNames := InventorySpecNameTotals(beforeInfo.items)
    afterNames := InventorySpecNameTotals(afterInfo.items)
    for name, afterCount in afterNames {
        if StrCompare(name, consumedRawName, true) = 0
            continue
        beforeCount := beforeNames.Has(name) ? beforeNames[name] : 0
        if afterCount > beforeCount
            outputUnits += afterCount - beforeCount
    }
    return consumedUnits > 0 && outputUnits > 0
}

InventorySnapshotWasReduced(afterInfo, beforeInfo) {
    if !IsObject(afterInfo) || !IsObject(beforeInfo)
        return false
    return afterInfo.weight < beforeInfo.weight
        || InventorySpecTotalCount(afterInfo.items)
            < InventorySpecTotalCount(beforeInfo.items)
}

CaptureFarmAttemptBaseline(expectedGeneration, actionMode) {
    global State
    if !IsCurrentRun(expectedGeneration)
        return false
    expectedTaskId := State.farmStateTaskId
    snapshotResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "inventory-snapshot")
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId)
        return false
    if !ParseInventorySnapshot(snapshotResult, &beforeInfo) {
        WriteDiagnostic("FARM_REWARD_BASELINE_ERROR mode=" actionMode
            " result=" snapshotResult)
        return false
    }
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId)
            || State.runMode != actionMode
            || (State.farmState != "FARMING"
                && State.farmState != "RESUMING_FARM")
            return false
        revision := RecordConfirmedInventory(beforeInfo,
            "before_" actionMode, expectedGeneration)
        if !revision
            return false
        State.miningAttemptId += 1
        State.pendingFarmAttempt := {
            generation: expectedGeneration,
            attemptId: State.miningAttemptId,
            actionMode: actionMode,
            before: beforeInfo,
            beforeRevision: revision,
            clicked: false,
            completed: false,
            rewardSessionId: "",
            rewardDurabilityPending: false,
            rewardConfirmedAtUnixMs: 0,
            rewardEventId: "",
            rewardConfirmedInfo: 0,
            rewardConfirmationReason: "",
            rewardDiagnosticWritten: false,
            outputLedgerCommitted: false,
            progressCompleted: false,
            completionAt: 0,
            completionElapsedMs: 0,
            completionWasBundled: false,
            reconcileDeadline: 0,
            reconcileAttempts: 0
        }
        return true
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

DiscardPendingFarmAttempt(reason := "discarded") {
    global State
    if IsObject(State.pendingFarmAttempt)
        WriteDiagnostic("FARM_ATTEMPT_DISCARD id="
            State.pendingFarmAttempt.attemptId " reason=" reason)
    State.pendingFarmAttempt := 0
}

MarkPendingFarmAttemptClicked(expectedGeneration, actionMode) {
    global State
    Critical "On"
    if !IsCurrentRun(expectedGeneration) {
        Critical "Off"
        return false
    }
    if !FarmAttemptHasBaseline(State.pendingFarmAttempt,
        expectedGeneration, actionMode) {
        Critical "Off"
        return false
    }
    State.pendingFarmAttempt.clicked := true
    Critical "Off"
    ; try-* がクリックを返した時点で、対象NUIが実在したことは確認済みです。
    ; SendInputを受理しただけではなく、この観測を視点復旧の成功条件にします。
    return ConfirmWorkViewTarget(actionMode, "action_click", expectedGeneration)
}

FarmAttemptHasBaseline(attempt, expectedGeneration, actionMode) {
    return IsObject(attempt)
        && attempt.generation = expectedGeneration
        && attempt.actionMode = actionMode
        && IsObject(attempt.before)
        && attempt.beforeRevision > 0
}

FarmAttemptCanFinalize(attempt, expectedGeneration, actionMode,
    confirmedInfo) {
    return FarmAttemptHasBaseline(attempt, expectedGeneration, actionMode)
        && attempt.clicked && attempt.completed
        && IsObject(confirmedInfo) && confirmedInfo.revision > attempt.beforeRevision
        && attempt.HasOwnProp("rewardConfirmedInfo")
        && IsObject(attempt.rewardConfirmedInfo)
        && attempt.rewardConfirmedInfo.revision = confirmedInfo.revision
        && attempt.HasOwnProp("rewardSessionId") && attempt.rewardSessionId
        && attempt.HasOwnProp("rewardEventId") && attempt.rewardEventId
        && attempt.HasOwnProp("rewardConfirmedAtUnixMs")
        && attempt.rewardConfirmedAtUnixMs > 0
        && BuildFarmRewardEventId(attempt.rewardSessionId, actionMode,
            attempt.attemptId, confirmedInfo.revision) = attempt.rewardEventId
}

FarmAttemptHasFrozenReward(attempt) {
    return IsObject(attempt)
        && attempt.HasOwnProp("rewardSessionId") && attempt.rewardSessionId
        && attempt.HasOwnProp("rewardEventId") && attempt.rewardEventId
        && attempt.HasOwnProp("rewardConfirmedAtUnixMs")
        && attempt.rewardConfirmedAtUnixMs > 0
        && attempt.HasOwnProp("rewardConfirmedInfo")
        && IsObject(attempt.rewardConfirmedInfo)
}

FarmAttemptRequiresDurabilityHold(attempt) {
    ; Once an inventory delta is proven, a filesystem outage must never turn that
    ; evidence into a normal reconciliation timeout/discard. It is retried until
    ; the exact frozen ID is durable or the user explicitly stops the run.
    return FarmAttemptHasFrozenReward(attempt)
}

VerifiedFarmRewardIsDurable(eventId) {
    global State
    return eventId
        && !State.verifiedRewardWalPending.Has(eventId)
        && (eventId = State.lastMiningEventId
            || MetagameOutboxContainsCommand(State.metagameOutbox,
                "MINING_SUCCESS", eventId))
}

ConfirmPendingFarmReward(expectedGeneration, actionMode, &confirmedInfo,
    &confirmationReason) {
    global State, Config
    confirmedInfo := 0
    confirmationReason := ""
    if !IsCurrentRun(expectedGeneration) || !IsObject(State.pendingFarmAttempt)
        return false
    attempt := State.pendingFarmAttempt
    if attempt.generation != expectedGeneration || attempt.actionMode != actionMode
        return false
    deadline := MonotonicMs() + Config.rewardConfirmTimeoutMs
    lastResult := ""
    while MonotonicMs() < deadline {
        snapshotState := TryConfirmPendingFarmRewardSnapshot(expectedGeneration,
            actionMode, &confirmedInfo, &confirmationReason, &lastResult)
        if snapshotState = "CONFIRMED"
            return true
        if snapshotState = "STALE"
            return false
        ; A valid but unchanged snapshot may precede the server inventory update.
        Sleep snapshotState = "UNCHANGED" ? 120 : 180
    }
    WriteDiagnostic("FARM_REWARD_TIMEOUT id=" attempt.attemptId
        " mode=" actionMode " last=" lastResult)
    confirmationReason := "inventory_delta_timeout"
    return false
}

TryConfirmPendingFarmRewardSnapshot(expectedGeneration, actionMode,
    &confirmedInfo, &confirmationReason, &snapshotResult) {
    global State, Config
    confirmedInfo := 0
    confirmationReason := ""
    snapshotResult := ""
    if !IsCurrentRun(expectedGeneration) || !IsObject(State.pendingFarmAttempt)
        return "STALE"
    attempt := State.pendingFarmAttempt
    if attempt.generation != expectedGeneration || attempt.actionMode != actionMode
        return "STALE"
    attemptId := attempt.attemptId
    needsSnapshot := !FarmAttemptHasFrozenReward(attempt)
    if needsSnapshot {
        snapshotResult := RunBackgroundBridgeCancelable(expectedGeneration,
            "inventory-snapshot")
    }

    ; The positive inventory proof, immutable identity freeze, and first fsync'd WAL
    ; E are one non-interruptible transaction. F9 cannot discard the attempt after
    ; proof but before its durable intent exists, and completed is never exposed
    ; until that first WAL record is durable.
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsCurrentRun(expectedGeneration)
            || !IsObject(State.pendingFarmAttempt)
            return "STALE"
        attempt := State.pendingFarmAttempt
        if attempt.generation != expectedGeneration
            || attempt.actionMode != actionMode
            || attempt.attemptId != attemptId
            return "STALE"
        if !FarmAttemptHasFrozenReward(attempt) {
            if !needsSnapshot || !ParseInventorySnapshot(snapshotResult, &afterInfo)
                return "UNAVAILABLE"
            if actionMode = "washing" {
                if !WashingSnapshotHasExchangeReward(afterInfo, attempt.before,
                    Config.rawStoneItemName, &consumedRawName,
                    &consumedRawUnits, &washOutputUnits)
                    return "UNCHANGED"
            } else if !InventorySnapshotHasReward(afterInfo, attempt.before)
                return "UNCHANGED"
            if !EnsureFarmMetagameSessionIdentity(expectedGeneration)
                return "UNAVAILABLE"
            RecordConfirmedInventory(afterInfo, "reward_" actionMode,
                expectedGeneration)
            frozenAt := UnixTimeMilliseconds()
            frozenSessionId := State.farmSessionId
            frozenEventId := BuildFarmRewardEventId(frozenSessionId,
                actionMode, attempt.attemptId, afterInfo.revision)
            if !frozenEventId
                return "UNAVAILABLE"
            attempt.rewardSessionId := frozenSessionId
            attempt.rewardConfirmedAtUnixMs := frozenAt
            attempt.rewardEventId := frozenEventId
            attempt.rewardConfirmedInfo := afterInfo
            attempt.rewardConfirmationReason := actionMode = "washing"
                ? "wash_exchange_raw_" . consumedRawUnits
                    . "_output_" . washOutputUnits
                : afterInfo.weight > attempt.before.weight
                    ? "weight_increase" : "item_increase"
            attempt.rewardDurabilityPending := true
        }
        if !FarmAttemptHasFrozenReward(attempt)
            || BuildFarmRewardEventId(attempt.rewardSessionId, actionMode,
                attempt.attemptId, attempt.rewardConfirmedInfo.revision)
                    != attempt.rewardEventId
            return "UNAVAILABLE"
        if !attempt.completed {
            attempt.rewardDurabilityPending := true
            if !PersistVerifiedRewardIntent(attempt.rewardEventId, actionMode,
                attempt.rewardConfirmedInfo.revision,
                attempt.rewardConfirmedAtUnixMs, &persistedAtUnixMs) {
                snapshotResult := "STONE_WAL_DURABILITY_PENDING"
                return "PERSIST_PENDING"
            }
            attempt.rewardConfirmedAtUnixMs := persistedAtUnixMs
            attempt.completed := true
        }
        frozenRevision := attempt.rewardConfirmedInfo.revision
        frozenAt := attempt.rewardConfirmedAtUnixMs
        frozenEventId := attempt.rewardEventId
        frozenSessionId := attempt.rewardSessionId
    } finally LeaveMetagameOutboxCritical(criticalWasOn)

    if !EmitVerifiedFarmReward(expectedGeneration, actionMode,
        attemptId, frozenRevision, frozenAt, frozenEventId,
        frozenSessionId) {
        criticalWasOn := EnterMetagameOutboxCritical()
        try {
            if IsCurrentRun(expectedGeneration)
                && IsObject(State.pendingFarmAttempt)
                && State.pendingFarmAttempt.attemptId = attemptId
                && State.pendingFarmAttempt.rewardEventId = frozenEventId
                State.pendingFarmAttempt.rewardDurabilityPending := true
        } finally LeaveMetagameOutboxCritical(criticalWasOn)
        snapshotResult := "STONE_DURABILITY_PENDING"
        return "PERSIST_PENDING"
    }
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsCurrentRun(expectedGeneration)
            || !IsObject(State.pendingFarmAttempt)
            return "STALE"
        attempt := State.pendingFarmAttempt
        if attempt.generation != expectedGeneration
            || attempt.actionMode != actionMode
            || attempt.attemptId != attemptId
            || attempt.rewardSessionId != frozenSessionId
            || attempt.rewardEventId != frozenEventId
            return "STALE"
        attempt.rewardDurabilityPending := false
        confirmedInfo := attempt.rewardConfirmedInfo
        confirmationReason := attempt.rewardConfirmationReason
        if !attempt.rewardDiagnosticWritten {
            WriteDiagnostic("FARM_REWARD_CONFIRMED id=" attempt.attemptId
                " mode=" actionMode " reason=" confirmationReason
                " beforeWeight=" attempt.before.weight
                " afterWeight=" confirmedInfo.weight
                " revision=" confirmedInfo.revision
                " eventId=" attempt.rewardEventId
                " eventAt=" attempt.rewardConfirmedAtUnixMs)
            attempt.rewardDiagnosticWritten := true
        }
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    return "CONFIRMED"
}

RewardReconcileDecision(hasReward, epochMatches, nowMs, deadlineMs,
    durabilityHold := false) {
    if durabilityHold
        return "DURABILITY_HOLD"
    if !epochMatches
        return "SESSION_CHANGED"
    if hasReward
        return "CONFIRMED"
    return nowMs >= deadlineMs ? "TIMEOUT" : "WAIT"
}

BeginPendingFarmRewardReconciliation(expectedGeneration, actionMode,
    completionAt, completionElapsedMs, completionWasBundled) {
    global State, Config
    if !IsCurrentRun(expectedGeneration) || !IsObject(State.pendingFarmAttempt)
        return false
    attempt := State.pendingFarmAttempt
    if attempt.generation != expectedGeneration || attempt.actionMode != actionMode
        return false
    attempt.progressCompleted := true
    attempt.completionAt := completionAt
    attempt.completionElapsedMs := completionElapsedMs
    attempt.completionWasBundled := completionWasBundled
    ; The fast confirmation window already elapsed. Keep the exact attempt and
    ; baseline for a second bounded window, with no new click, while late server
    ; inventory replication catches up.
    attempt.reconcileDeadline := FarmAttemptRequiresDurabilityHold(attempt)
        ? 0 : MonotonicMs()
            + Max(5000, Min(30000, Config.rewardConfirmTimeoutMs * 3))
    attempt.reconcileAttempts := 0
    State.rewardReconcileAttempts := 0
    ResetActionCompletionState()
    return EnterFarmRecovery(expectedGeneration,
        State.farmState = "RESUMING_FARM" ? "RESUMING_FARM" : "FARMING",
        actionMode "_reward_reconciliation")
}

HandlePendingFarmRewardReconciliation(expectedGeneration, expectedTaskId) {
    global State
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
        return false
    if !IsObject(State.pendingFarmAttempt)
        || !State.pendingFarmAttempt.progressCompleted
        || (!State.pendingFarmAttempt.reconcileDeadline
            && !FarmAttemptRequiresDurabilityHold(State.pendingFarmAttempt))
        return false
    attempt := State.pendingFarmAttempt
    actionMode := attempt.actionMode
    attempt.reconcileAttempts += 1
    State.rewardReconcileAttempts := attempt.reconcileAttempts
    snapshotState := TryConfirmPendingFarmRewardSnapshot(expectedGeneration,
        actionMode, &confirmedInfo, &rewardReason, &snapshotResult)
    if snapshotState = "STALE"
        return true
    now := MonotonicMs()
    durabilityHold := snapshotState != "CONFIRMED"
        && (snapshotState = "PERSIST_PENDING"
            || FarmAttemptRequiresDurabilityHold(attempt))
    decision := RewardReconcileDecision(snapshotState = "CONFIRMED", true,
        now, attempt.reconcileDeadline, durabilityHold)
    WriteDiagnostic("FARM_REWARD_RECONCILE id=" attempt.attemptId
        " try=" attempt.reconcileAttempts " snapshot=" snapshotState
        " decision=" decision " remainingMs="
        . (attempt.reconcileDeadline
            ? Max(0, attempt.reconcileDeadline - now) : -1))
    if snapshotState = "CONFIRMED" {
        CompleteVerifiedFarmReward(expectedGeneration, actionMode,
            attempt.completionAt, attempt.completionElapsedMs,
            attempt.completionWasBundled, confirmedInfo, rewardReason)
        return true
    }
    if decision = "DURABILITY_HOLD" {
        State.farmWatchdogAt := now
        State.statusLabel.Text := "●  " BackgroundActionDisplayName(actionMode)
            . "の結果をSTONEへ安全に保存中（" attempt.reconcileAttempts "回）"
        retryDelay := Min(5000,
            250 * (2 ** Min(attempt.reconcileAttempts - 1, 4)))
        ScheduleNext(expectedGeneration, retryDelay)
        return true
    }
    if decision = "TIMEOUT" {
        DiscardPendingFarmAttempt("reward_reconciliation_timeout")
        StopAutomationWithFault(BackgroundActionDisplayName(actionMode)
            . "の実報酬を最終期限まで確認できないため停止しました",
            "overview", "REWARD_RECONCILE_TIMEOUT")
        return true
    }
    State.statusLabel.Text := "●  " BackgroundActionDisplayName(actionMode)
        . "の報酬反映を再確認中（" attempt.reconcileAttempts "回）"
    ScheduleNext(expectedGeneration, snapshotState = "UNCHANGED" ? 120 : 220)
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
    return InventorySpecDeltaUnitCount(currentSpec, baselineSpec) > 0
}

InventorySpecDeltaUnitCount(currentSpec, baselineSpec) {
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
    deltaUnits := 0
    for row in currentRows
        deltaUnits += Max(0, row.count - row.reserved)
    return deltaUnits
}

StorageDeltaBaselineIsSafe(baselineSpec, currentSpec) {
    return baselineSpec != "-" && IsValidInventorySpec(baselineSpec)
        && IsValidInventorySpec(currentSpec)
        && InventorySpecDeltaUnitCount(currentSpec, baselineSpec) > 0
}

InventorySpecToRows(spec) {
    rows := []
    if !IsValidInventorySpec(spec) || spec = "-"
        return rows
    for entry in StrSplit(spec, ",") {
        if !RegExMatch(entry,
            "^([0-9]{4})\.([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{2,10923})=([0-9]{1,10})$", &parts)
            continue
        rows.Push({slot: parts[1] + 0, name: parts[2], metadata: parts[3],
            key: parts[2] "." parts[3], count: parts[4] + 0, reserved: 0})
    }
    return rows
}

NewExactInventoryCountMap() {
    counts := Map()
    counts.CaseSense := "On"
    return counts
}

InventorySpecExactTotals(spec) {
    totals := NewExactInventoryCountMap()
    for row in InventorySpecToRows(spec)
        totals[row.key] := (totals.Has(row.key) ? totals[row.key] : 0)
            + row.count
    return totals
}

ClonePositiveInventoryCounts(source) {
    clone := NewExactInventoryCountMap()
    if Type(source) != "Map"
        return clone
    for key, count in source {
        if IsInteger(count) && count > 0
            clone[key] := count
    }
    return clone
}

PositiveInventoryCountTotal(counts) {
    total := 0
    if Type(counts) != "Map"
        return 0
    for key, count in counts {
        if IsInteger(count) && count > 0
            total += count
    }
    return total
}

FarmOutputLedgerHasPending(ledger) {
    return PositiveInventoryCountTotal(ledger) > 0
}

AccumulateVerifiedFarmOutputLedger(ledger, beforeSpec, afterSpec,
    &addedUnits) {
    addedUnits := 0
    if Type(ledger) != "Map" || !IsValidInventorySpec(beforeSpec)
        || !IsValidInventorySpec(afterSpec)
        return false
    beforeTotals := InventorySpecExactTotals(beforeSpec)
    afterTotals := InventorySpecExactTotals(afterSpec)
    beforeNames := InventorySpecNameTotals(beforeSpec)
    afterNames := InventorySpecNameTotals(afterSpec)
    remainingNameGrowth := NewExactInventoryCountMap()
    for name, afterNameCount in afterNames {
        beforeNameCount := beforeNames.Has(name) ? beforeNames[name] : 0
        if afterNameCount > beforeNameCount
            remainingNameGrowth[name] := afterNameCount - beforeNameCount
    }
    for key, afterCount in afterTotals {
        separator := InStr(key, ".")
        name := separator > 1 ? SubStr(key, 1, separator - 1) : ""
        if !name || !remainingNameGrowth.Has(name)
            || remainingNameGrowth[name] <= 0
            continue
        beforeCount := beforeTotals.Has(key) ? beforeTotals[key] : 0
        increase := Min(Max(0, afterCount - beforeCount),
            remainingNameGrowth[name])
        if increase <= 0
            continue
        ledger[key] := (ledger.Has(key) ? ledger[key] : 0) + increase
        remainingNameGrowth[name] -= increase
        addedUnits += increase
    }
    return true
}

BuildFarmOutputProtectedBaseline(currentSpec, ledger, &baselineSpec,
    &eligibleUnits, &failureReason) {
    baselineSpec := ""
    eligibleUnits := 0
    failureReason := ""
    if !IsValidInventorySpec(currentSpec) {
        failureReason := "invalid_inventory"
        return false
    }
    pending := ClonePositiveInventoryCounts(ledger)
    expectedUnits := PositiveInventoryCountTotal(pending)
    if expectedUnits <= 0 {
        failureReason := "empty_ledger"
        return false
    }
    rows := InventorySpecToRows(currentSpec)
    currentTotals := InventorySpecExactTotals(currentSpec)
    for key, count in pending {
        if !currentTotals.Has(key) || currentTotals[key] < count {
            failureReason := "ledger_item_missing"
            return false
        }
    }

    ; Mark only exact name+canonical-metadata units from the verified-reward
    ; ledger as transferable. Allocate from higher slots first because the bridge
    ; processes sources in that same order. Every other live unit becomes the
    ; synthetic protected baseline, including items acquired after Farm started.
    Loop rows.Length {
        row := rows[rows.Length - A_Index + 1]
        row.ledgerEligible := 0
        if !pending.Has(row.key) || pending[row.key] <= 0
            continue
        take := Min(row.count, pending[row.key])
        row.ledgerEligible := take
        pending[row.key] -= take
        eligibleUnits += take
    }
    for key, count in pending {
        if count != 0 {
            failureReason := "ledger_allocation_failed"
            return false
        }
    }
    if eligibleUnits != expectedUnits {
        failureReason := "ledger_count_mismatch"
        return false
    }

    protectedParts := []
    for row in rows {
        protectedCount := row.count - row.ledgerEligible
        if protectedCount <= 0
            continue
        protectedParts.Push(Format("{:04}", row.slot) "." row.name "."
            . row.metadata "=" protectedCount)
    }
    baselineSpec := protectedParts.Length ? JoinInventorySpecParts(protectedParts)
        : "-"
    if !IsValidInventorySpec(baselineSpec)
        || InventorySpecDeltaUnitCount(currentSpec, baselineSpec) != eligibleUnits {
        failureReason := "synthetic_baseline_mismatch"
        baselineSpec := ""
        eligibleUnits := 0
        return false
    }
    return true
}

JoinInventorySpecParts(parts) {
    result := ""
    for part in parts
        result .= (result ? "," : "") part
    return result
}

BuildFarmOutputAuthorizationSpec(ledger, &spec, &totalUnits) {
    spec := ""
    totalUnits := 0
    if Type(ledger) != "Map"
        return false
    parts := []
    for key, count in ledger {
        if !RegExMatch(key,
            "^[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{2,10923}$")
            || !IsInteger(count) || count <= 0
            || count > 2147483647 - totalUnits
            return false
        parts.Push(key "=" count)
        totalUnits += count
    }
    if !parts.Length
        return false
    spec := JoinInventorySpecParts(parts)
    return StrLen(spec) <= 24000 && totalUnits > 0
}

CreateStorageDepositCheckpoint(expectedGeneration, checkpointId, currentSpec,
    ledger) {
    if expectedGeneration < 1 || checkpointId < 1
        || !IsValidInventorySpec(currentSpec)
        || !FarmOutputLedgerHasPending(ledger)
        return 0
    if !BuildFarmOutputAuthorizationSpec(ledger, &authorizedSpec,
        &authorizedUnits)
        return 0
    return {
        generation: expectedGeneration,
        checkpointId: checkpointId,
        observedItems: currentSpec,
        authorizedByKey: ClonePositiveInventoryCounts(ledger),
        authorizedSpec: authorizedSpec,
        authorizedUnits: authorizedUnits,
        receiptVerified: false,
        receiptUnits: 0,
        receiptAppliedUnits: 0,
        receiptRemainingByKey: NewExactInventoryCountMap()
    }
}

ParseExactFarmOutputReceiptSpec(spec, &exactCounts, &totalUnits) {
    exactCounts := NewExactInventoryCountMap()
    totalUnits := 0
    spec := String(spec)
    if !spec || StrLen(spec) > 24000
        return false
    previousKey := ""
    for entry in StrSplit(spec, ",") {
        if !RegExMatch(entry,
            "^([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{2,10923})=([1-9][0-9]{0,9})$",
            &parts)
            return false
        key := parts[1] "." parts[2]
        if previousKey && StrCompare(previousKey, key, true) >= 0
            return false
        count := parts[3] + 0
        if count < 1 || count > 2147483647 - totalUnits
            return false
        exactCounts[key] := count
        totalUnits += count
        previousKey := key
    }
    return totalUnits > 0
}

ParseVerifiedStorageDepositReceipt(result, expectedStorageId,
    expectedStorageType, &receipt) {
    receipt := 0
    result := String(result)
    if !RegExMatch(result,
        "^DEPOSITED ([1-9][0-9]{0,9}) ([1-9][0-9]{0,9}) "
        . "([1-9][0-9]{0,9}) ([A-Za-z0-9+/]+={0,2}) "
        . "([A-Za-z0-9+/]+={0,2}) ([A-Za-z0-9_-]{1,64}) "
        . "(COMPLETE|PARTIAL_[A-Z_]{2,48}) (.{1,24000})$", &parts)
        return false
    if parts[4] != expectedStorageId || parts[5] != expectedStorageType
        || !IsValidBase64Token(parts[4]) || !IsValidBase64Token(parts[5])
        return false
    if !ParseExactFarmOutputReceiptSpec(parts[8], &exactCounts, &totalUnits)
        || totalUnits != parts[1] + 0
        || parts[2] + 0 < totalUnits
        || (parts[7] = "COMPLETE" && parts[1] + 0 != parts[2] + 0)
        || (parts[7] != "COMPLETE" && parts[1] + 0 >= parts[2] + 0)
        return false
    receipt := {
        moved: parts[1] + 0,
        planned: parts[2] + 0,
        stacks: parts[3] + 0,
        storageId: parts[4],
        storageType: parts[5],
        operationToken: parts[6],
        status: parts[7],
        exactCounts: exactCounts
    }
    return true
}

StorageDepositReceiptOperationMatches(receipt, expectedOperationToken) {
    return IsObject(receipt) && receipt.HasOwnProp("operationToken")
        && RegExMatch(expectedOperationToken, "^[A-Za-z0-9_-]{1,64}$")
        && receipt.operationToken = expectedOperationToken
}

StorageTransferResultIsAmbiguous(result) {
    result := Trim(String(result))
    return result = "ERROR AMBIGUOUS_TRANSFER"
        || result = "ERROR NO_PROGRESS"
        || result = "ERROR BRIDGE_TIMEOUT"
        || result = "ERROR no bridge result"
}

StorageTransferReceiptAction(status, allowCapacityCommit := false) {
    status := Trim(String(status))
    if status = "COMPLETE"
        return "COMPLETE"
    if status = "PARTIAL_MOVE_REJECTED"
        return "RETRY_EXACT"
    if allowCapacityCommit && status = "PARTIAL_INVENTORY_CAPACITY"
        return "COMMIT_EXACT"
    ; NO_PROGRESS is retained for compatibility with older bridge binaries.
    ; Historically it could mean that swapItems was already in flight. Every
    ; other non-whitelisted partial status also stops closed by default.
    return InStr(status, "PARTIAL_") = 1 ? "STOP" : "INVALID"
}

BindStorageDepositReceipt(checkpoint, receipt, ledger, expectedUnits) {
    receiptAction := IsObject(receipt) && receipt.HasOwnProp("status")
        ? StorageTransferReceiptAction(receipt.status) : "INVALID"
    if !IsObject(checkpoint) || !IsObject(receipt)
        || Type(ledger) != "Map" || expectedUnits < 1
        || !checkpoint.HasOwnProp("authorizedByKey")
        || Type(checkpoint.authorizedByKey) != "Map"
        || !checkpoint.HasOwnProp("receiptVerified")
        || checkpoint.receiptVerified
        || (receiptAction != "COMPLETE" && receiptAction != "RETRY_EXACT")
        || receipt.planned != expectedUnits || receipt.moved > expectedUnits
        || (receipt.status = "COMPLETE" && receipt.moved != expectedUnits)
        || (receipt.status != "COMPLETE" && receipt.moved >= expectedUnits)
        || PositiveInventoryCountTotal(checkpoint.authorizedByKey)
            != expectedUnits
        || PositiveInventoryCountTotal(receipt.exactCounts) != receipt.moved
        return false
    ; The bridge receipt is produced only after the same registered trunk gained
    ; each exact name+metadata quantity and the player lost it. A PARTIAL receipt
    ; may authorize a strict positive subset after a later source failed; only that
    ; proven subset can consume ledger before a fresh checkpoint retries the rest.
    for key, receiptCount in receipt.exactCounts {
        if !checkpoint.authorizedByKey.Has(key)
            || checkpoint.authorizedByKey[key] < receiptCount
            || !ledger.Has(key) || ledger[key] < receiptCount
            return false
    }
    checkpoint.receiptRemainingByKey := ClonePositiveInventoryCounts(
        receipt.exactCounts)
    checkpoint.receiptVerified := true
    checkpoint.receiptUnits := receipt.moved
    checkpoint.receiptAppliedUnits := 0
    checkpoint.receiptOperationToken := receipt.operationToken
    return true
}

BindActiveStorageDepositReceipt(expectedGeneration, result, expectedUnits,
    &receiptUnits, &failureReason) {
    global State, Config
    receiptUnits := 0
    failureReason := ""
    if !IsCurrentRun(expectedGeneration) {
        failureReason := "stale_generation"
        return false
    }
    checkpoint := State.storageDepositCheckpoint
    if !IsObject(checkpoint) || checkpoint.generation != expectedGeneration {
        failureReason := "missing_checkpoint"
        return false
    }
    if !ParseVerifiedStorageDepositReceipt(result, Config.vehicleStorageId,
        Config.vehicleStorageType, &receipt) {
        failureReason := StorageTransferResultIsAmbiguous(result)
            ? "ambiguous_transfer" : "unverified_bridge_result"
        return false
    }
    receiptAction := StorageTransferReceiptAction(receipt.status)
    if receiptAction != "COMPLETE" && receiptAction != "RETRY_EXACT" {
        failureReason := "terminal_receipt_status_" receipt.status
        return false
    }
    if !BindStorageDepositReceipt(checkpoint, receipt,
        State.farmOutputLedger, expectedUnits) {
        failureReason := "receipt_ledger_mismatch"
        return false
    }
    receiptUnits := receipt.moved
    WriteDiagnostic("FARM_OUTPUT_DEPOSIT_RECEIPT checkpoint="
        checkpoint.checkpointId " units=" receiptUnits " token="
        DiagnosticToken(receipt.operationToken))
    return true
}

StorageDepositCheckpointReceiptRemaining(checkpoint) {
    return IsObject(checkpoint) && checkpoint.HasOwnProp("receiptVerified")
        && checkpoint.receiptVerified
        && checkpoint.HasOwnProp("receiptRemainingByKey")
        ? PositiveInventoryCountTotal(checkpoint.receiptRemainingByKey) : -1
}

RetireCompletedStorageDepositCheckpoint(expectedGeneration) {
    global State
    checkpoint := State.storageDepositCheckpoint
    if !IsCurrentRun(expectedGeneration) || !IsObject(checkpoint)
        || checkpoint.generation != expectedGeneration
        || StorageDepositCheckpointReceiptRemaining(checkpoint) != 0
        return false
    WriteDiagnostic("FARM_OUTPUT_DEPOSIT_CHECKPOINT_RETIRED id="
        checkpoint.checkpointId " receiptApplied="
        checkpoint.receiptAppliedUnits " ledgerRemaining="
        PositiveInventoryCountTotal(State.farmOutputLedger))
    State.storageDepositCheckpoint := 0
    return true
}

ReconcileStorageDepositCheckpoint(checkpoint, liveSpec, ledger,
    &appliedUnits) {
    appliedUnits := 0
    if !IsObject(checkpoint) || Type(ledger) != "Map"
        || !checkpoint.HasOwnProp("observedItems")
        || !checkpoint.HasOwnProp("receiptVerified")
        || !checkpoint.receiptVerified
        || !checkpoint.HasOwnProp("receiptRemainingByKey")
        || Type(checkpoint.receiptRemainingByKey) != "Map"
        || !IsValidInventorySpec(checkpoint.observedItems)
        || !IsValidInventorySpec(liveSpec)
        return false
    beforeTotals := InventorySpecExactTotals(checkpoint.observedItems)
    afterTotals := InventorySpecExactTotals(liveSpec)
    ; A paired bridge receipt authorizes the whole observed reduction frontier.
    ; Reject extra reduction on the same key and any reduction on an unreceipted
    ; key before mutating either the receipt or Farm ledger.
    for key, beforeCount in beforeTotals {
        afterCount := afterTotals.Has(key) ? afterTotals[key] : 0
        observedReduction := Max(0, beforeCount - afterCount)
        allowance := checkpoint.receiptRemainingByKey.Has(key)
            ? checkpoint.receiptRemainingByKey[key] : 0
        if observedReduction > allowance
            return false
    }
    exhaustedKeys := []
    for key, allowance in checkpoint.receiptRemainingByKey {
        if !IsInteger(allowance) || allowance <= 0
            continue
        beforeCount := beforeTotals.Has(key) ? beforeTotals[key] : 0
        afterCount := afterTotals.Has(key) ? afterTotals[key] : 0
        observedReduction := Max(0, beforeCount - afterCount)
        ledgerCount := ledger.Has(key) ? ledger[key] : 0
        if observedReduction > ledgerCount
            return false
        applied := observedReduction
        if applied <= 0
            continue
        nextAllowance := allowance - applied
        if nextAllowance > 0
            checkpoint.receiptRemainingByKey[key] := nextAllowance
        else
            exhaustedKeys.Push(key)
        nextLedgerCount := ledgerCount - applied
        if nextLedgerCount > 0
            ledger[key] := nextLedgerCount
        else if ledger.Has(key)
            ledger.Delete(key)
        appliedUnits += applied
    }
    ; Do not structurally modify the Map while its enumerator is live. This also
    ; keeps the observation/reconciliation pass deterministic on every AHK build.
    for key in exhaustedKeys {
        if checkpoint.receiptRemainingByKey.Has(key)
            checkpoint.receiptRemainingByKey.Delete(key)
    }
    checkpoint.receiptAppliedUnits += appliedUnits
    if checkpoint.receiptAppliedUnits > checkpoint.receiptUnits
        return false
    ; Moving this observation frontier on every valid snapshot makes a repeated
    ; or late callback idempotent. The same exact player reduction cannot be
    ; consumed from the ledger twice.
    checkpoint.observedItems := liveSpec
    return true
}

ResetFarmOutputLedger() {
    global State
    State.farmOutputLedger := NewExactInventoryCountMap()
    State.storageDepositCheckpoint := 0
    State.storageDepositSequence := 0
}

BeginActiveStorageDepositCheckpoint(expectedGeneration, currentSpec) {
    global State
    if !IsCurrentRun(expectedGeneration)
        || !FarmOutputLedgerHasPending(State.farmOutputLedger)
        return false
    if IsObject(State.storageDepositCheckpoint) {
        return State.storageDepositCheckpoint.generation = expectedGeneration
    }
    State.storageDepositSequence += 1
    checkpoint := CreateStorageDepositCheckpoint(expectedGeneration,
        State.storageDepositSequence, currentSpec, State.farmOutputLedger)
    if !IsObject(checkpoint)
        return false
    State.storageDepositCheckpoint := checkpoint
    WriteDiagnostic("FARM_OUTPUT_DEPOSIT_CHECKPOINT_BEGIN id="
        checkpoint.checkpointId " units="
        PositiveInventoryCountTotal(checkpoint.authorizedByKey))
    return true
}

ReconcileActiveStorageDepositCheckpoint(expectedGeneration, liveSpec,
    &appliedUnits, &remainingUnits) {
    global State
    appliedUnits := 0
    remainingUnits := PositiveInventoryCountTotal(State.farmOutputLedger)
    if !IsCurrentRun(expectedGeneration)
        return false
    checkpoint := State.storageDepositCheckpoint
    if !IsObject(checkpoint) || checkpoint.generation != expectedGeneration
        return false
    if !ReconcileStorageDepositCheckpoint(checkpoint, liveSpec,
        State.farmOutputLedger, &appliedUnits)
        return false
    remainingUnits := PositiveInventoryCountTotal(State.farmOutputLedger)
    if appliedUnits > 0 {
        WriteDiagnostic("FARM_OUTPUT_LEDGER_REDUCED checkpoint="
            checkpoint.checkpointId " applied=" appliedUnits
            " remaining=" remainingUnits)
    }
    return true
}

FinalizeVerifiedFarmOutputDeposit(expectedGeneration, verifiedInfo) {
    global State
    if !IsCurrentRun(expectedGeneration) || !IsObject(verifiedInfo)
        || FarmOutputLedgerHasPending(State.farmOutputLedger)
        return false
    checkpointId := IsObject(State.storageDepositCheckpoint)
        ? State.storageDepositCheckpoint.checkpointId : 0
    State.farmOutputLedger := NewExactInventoryCountMap()
    State.storageDepositCheckpoint := 0
    State.inventoryBaseline := verifiedInfo.items
    State.inventoryBaselineWeight := verifiedInfo.weight
    State.storageOutputsVerified := true
    WriteDiagnostic("FARM_OUTPUT_LEDGER_DEPOSIT_VERIFIED checkpoint="
        checkpointId " remaining=0")
    return true
}

InventorySpecNameTotals(spec) {
    totals := Map()
    totals.CaseSense := "On"
    for row in InventorySpecToRows(spec)
        totals[row.name] := (totals.Has(row.name) ? totals[row.name] : 0)
            + row.count
    return totals
}

InventorySpecNameCount(spec, itemName) {
    if !RegExMatch(itemName, "^[A-Za-z0-9_-]{1,64}$")
        return 0
    totals := InventorySpecNameTotals(spec)
    return totals.Has(itemName) ? totals[itemName] : 0
}

DetectConsumedInventoryItem(beforeSpec, afterSpec, &itemName,
    &consumedCount) {
    itemName := ""
    consumedCount := 0
    beforeTotals := InventorySpecNameTotals(beforeSpec)
    afterTotals := InventorySpecNameTotals(afterSpec)
    candidates := 0
    for name, beforeCount in beforeTotals {
        afterCount := afterTotals.Has(name) ? afterTotals[name] : 0
        if afterCount >= beforeCount
            continue
        candidates += 1
        itemName := name
        consumedCount := beforeCount - afterCount
    }
    if candidates != 1 {
        itemName := ""
        consumedCount := 0
        return false
    }
    return true
}

LearnRawStoneItemFromVerifiedWash(beforeInfo, afterInfo) {
    global Config, State
    if !IsObject(beforeInfo) || !IsObject(afterInfo)
        return ""
    if Config.rawStoneItemName {
        beforeCount := InventorySpecNameCount(beforeInfo.items,
            Config.rawStoneItemName)
        afterCount := InventorySpecNameCount(afterInfo.items,
            Config.rawStoneItemName)
        State.lastRawStoneCount := afterCount
        if beforeCount > afterCount {
            WriteDiagnostic("WASH_RAW_STONE_VERIFIED item="
                Config.rawStoneItemName " consumed=" (beforeCount - afterCount)
                " remaining=" afterCount)
            return ""
        }
        WriteDiagnostic("WASH_RAW_STONE_NOT_CONSUMED item="
            Config.rawStoneItemName " before=" beforeCount " after=" afterCount)
        return ""
    }
    if !DetectConsumedInventoryItem(beforeInfo.items, afterInfo.items,
        &candidateName, &consumedCount) {
        WriteDiagnostic("WASH_RAW_STONE_LEARN_SKIPPED reason=ambiguous_or_none")
        return ""
    }
    Config.rawStoneItemName := candidateName
    State.lastRawStoneCount := InventorySpecNameCount(afterInfo.items,
        candidateName)
    WriteDiagnostic("WASH_RAW_STONE_LEARNED item=" candidateName
        " consumed=" consumedCount " remaining=" State.lastRawStoneCount)
    return candidateName
}

WashingBatchWasCompleted(beforeSpec, afterSpec, rawStoneItemName) {
    if !rawStoneItemName
        return false
    beforeCount := InventorySpecNameCount(beforeSpec, rawStoneItemName)
    afterCount := InventorySpecNameCount(afterSpec, rawStoneItemName)
    return beforeCount > 0 && afterCount = 0
}

InitializeLocalVehicleRun(expectedGeneration) {
    global State, Config
    State.statusLabel.Text := "作業位置と満重量判定を確認しています"
    epochValid := ValidateServerEpochCheckpoint(expectedGeneration, "local_work_start")
    if !IsCurrentRun(expectedGeneration)
        return false
    if !epochValid {
        StopMining()
        State.statusLabel.Text := "接続状態が変わったため開始しませんでした"
        ShowPage("vehicle")
        return false
    }

    if !RequireExeRouteForRun(expectedGeneration)
        return false
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
    startCapacityBlocked := CapacityNeedsStorage(inventoryInfo, &startReason,
        &startFreeWeight)
    startRawStoneCount := State.runMode = "washing"
        && Config.rawStoneItemName
        ? InventorySpecNameCount(inventoryInfo.items,
            Config.rawStoneItemName) : -1
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentRun(expectedGeneration)
            return false
        State.inventoryBaseline := inventoryInfo.items
        State.inventoryBaselineWeight := inventoryInfo.weight
        if !RecordConfirmedInventory(inventoryInfo, "start_local",
            expectedGeneration)
            return false
        if startRawStoneCount >= 0
            State.lastRawStoneCount := startRawStoneCount
        if !startCapacityBlocked && startRawStoneCount = 0 {
            ; No work output exists in this new run, so there is nothing to deposit.
            ; Mark that empty output phase as verified and perform a refill-only trip;
            ; do not require a wash button that legitimately disappears at zero input.
            State.storagePending := true
            State.storageReason := "raw_stone_empty"
            State.storagePreSnapshot := inventoryInfo
            State.storageOutputsVerified := true
            State.storageRefillVerified := false
            State.nextCapacityCheckAt := 0
        }
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
    if startCapacityBlocked {
        WriteDiagnostic("LOCAL_INVENTORY_START_CAPACITY_BLOCKED reason="
            startReason " free=" startFreeWeight " baseline=protected")
        StopAutomationWithFault(
            "開始時点ですでに容量が不足しています。既存の食料や道具を保護するため自動収納は行いません。手動で空きを作ってから再開してください",
            "vehicle", "UNTRUSTED_STORAGE_BASELINE")
        return false
    }
    if startRawStoneCount = 0 {
        WriteDiagnostic("LOCAL_WASH_START_REFILL_ONLY item="
            . Config.rawStoneItemName . " count=0")
        return true
    }
    fastWashDeferred := FastWashModeEnabled()
    workTargetPresent := fastWashDeferred ? true
        : StationaryOnlyEnabled() ? WaitStationaryTaskReady(expectedGeneration)
        : ProbeWorkTarget(State.runMode, expectedGeneration)
    if fastWashDeferred
        WriteDiagnostic("FAST_WASH_START readiness=deferred_to_try_washing storage_gate=0")
    if !IsCurrentRun(expectedGeneration)
        return false
    if !workTargetPresent {
        StopMining()
        State.statusLabel.Text := "作業ボタンを確認できないため開始しませんでした"
        ShowPage("vehicle")
        return false
    }
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentRun(expectedGeneration)
            return false
        State.nextCapacityCheckAt := MonotonicMs()
            + Config.capacityCheckIntervalMs
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
    WriteDiagnostic("LOCAL_INVENTORY_BASELINE weight=" inventoryInfo.weight
        " max=" inventoryInfo.maxWeight " used=" inventoryInfo.used
        " slots=" inventoryInfo.slots)
    return true
}

VerifyStorageReduction(expectedGeneration, beforeInfo, &afterInfo,
    &lastSnapshotResult) {
    global Config
    afterInfo := 0
    lastSnapshotResult := ""
    deadline := MonotonicMs() + Config.storageVerifyTimeoutMs
    while MonotonicMs() < deadline {
        lastSnapshotResult := RunBackgroundBridgeCancelable(expectedGeneration,
            "inventory-snapshot")
        if !IsCurrentRun(expectedGeneration)
            return false
        if ParseInventorySnapshot(lastSnapshotResult, &candidateInfo) {
            RecordConfirmedInventory(candidateInfo, "storage_verify",
                expectedGeneration)
            if InventorySnapshotWasReduced(candidateInfo, beforeInfo) {
                afterInfo := candidateInfo
                return true
            }
            Sleep 140
            continue
        }
        Sleep 180
    }
    return false
}

VerifyStorageLedgerProgress(expectedGeneration, &afterInfo,
    &lastSnapshotResult, &appliedUnits) {
    global Config
    afterInfo := 0
    lastSnapshotResult := ""
    appliedUnits := 0
    deadline := MonotonicMs() + Config.storageVerifyTimeoutMs
    while MonotonicMs() < deadline {
        lastSnapshotResult := RunBackgroundBridgeCancelable(expectedGeneration,
            "inventory-snapshot")
        if !IsCurrentRun(expectedGeneration)
            return false
        if ParseInventorySnapshot(lastSnapshotResult, &candidateInfo) {
            RecordConfirmedInventory(candidateInfo, "storage_ledger_verify",
                expectedGeneration)
            if !ReconcileActiveStorageDepositCheckpoint(expectedGeneration,
                candidateInfo.items, &observedApplied, &remainingUnits) {
                lastSnapshotResult := "ERROR LEDGER_RECONCILE"
                return false
            }
            appliedUnits += observedApplied
            receiptRemaining := StorageDepositCheckpointReceiptRemaining(
                State.storageDepositCheckpoint)
            if receiptRemaining = 0 {
                afterInfo := candidateInfo
                return true
            }
            if receiptRemaining < 0 {
                lastSnapshotResult := "ERROR UNVERIFIED_DEPOSIT_RECEIPT"
                return false
            }
            Sleep 140
            continue
        }
        Sleep 180
    }
    return false
}

StorageCycleCleanupAllowed(expectedGeneration, currentGeneration, running) {
    return running && expectedGeneration > 0
        && expectedGeneration = currentGeneration
}

StorageCycleStillOwnsCleanup(expectedGeneration) {
    global State
    return StorageCycleCleanupAllowed(expectedGeneration, State.generation,
        State.running)
}

WashingRefillReceiptDeltaStatus(beforeCount, observedCount, expectedMoved) {
    if beforeCount < 0 || expectedMoved < 1
        || beforeCount > 2147483647 - expectedMoved
        return "INVALID"
    expectedCount := beforeCount + expectedMoved
    return observedCount = expectedCount ? "MATCH"
        : observedCount >= beforeCount && observedCount < expectedCount
            ? "PENDING" : "UNPAIRED"
}

WashingRefillAccountedTotalMatches(originalCount, currentCount,
    verifiedUnits) {
    return originalCount >= 0 && currentCount >= originalCount
        && verifiedUnits >= 0 && currentCount - originalCount = verifiedUnits
}

VerifyRawStoneReceiptDelta(expectedGeneration, itemName, beforeCount,
    expectedMoved, &afterInfo, &lastSnapshotResult, &failureReason) {
    global Config
    afterInfo := 0
    lastSnapshotResult := ""
    failureReason := ""
    if WashingRefillReceiptDeltaStatus(beforeCount, beforeCount,
        expectedMoved) = "INVALID" {
        failureReason := "INVALID_RECEIPT_DELTA"
        return false
    }
    expectedCount := beforeCount + expectedMoved
    deadline := MonotonicMs() + Config.storageVerifyTimeoutMs
    while MonotonicMs() < deadline {
        lastSnapshotResult := RunBackgroundBridgeCancelable(expectedGeneration,
            "inventory-snapshot")
        if !IsCurrentRun(expectedGeneration)
            return false
        if ParseInventorySnapshot(lastSnapshotResult, &candidateInfo) {
            candidateCount := InventorySpecNameCount(candidateInfo.items,
                itemName)
            deltaStatus := WashingRefillReceiptDeltaStatus(beforeCount,
                candidateCount, expectedMoved)
            if deltaStatus = "MATCH" {
                afterInfo := candidateInfo
                return true
            }
            if deltaStatus = "UNPAIRED" || deltaStatus = "INVALID" {
                afterInfo := candidateInfo
                failureReason := "UNPAIRED_DELTA"
                return false
            }
            Sleep 140
            continue
        }
        Sleep 180
    }
    failureReason := "RECEIPT_DELTA_TIMEOUT"
    return false
}

ParseVerifiedWashingRefillReceipt(result, expectedStorageId,
    expectedStorageType, &receipt) {
    receipt := 0
    result := Trim(String(result))
    if !RegExMatch(result,
        "^(WITHDRAWN|WITHDRAWN_PARTIAL) ([1-9][0-9]{0,6}) "
        . "([1-9][0-9]{0,3}) ([A-Za-z0-9+/]+={0,2}) "
        . "([A-Za-z0-9+/]+={0,2}) ([A-Za-z0-9_-]{1,64}) "
        . "(COMPLETE|PARTIAL_[A-Z_]{2,48})$", &parts)
        return false
    moved := parts[2] + 0
    stacks := parts[3] + 0
    if parts[4] != expectedStorageId || parts[5] != expectedStorageType
        || !IsValidBase64Token(parts[4]) || !IsValidBase64Token(parts[5])
        || stacks > moved || stacks > 1000
        || (parts[1] = "WITHDRAWN" && parts[7] != "COMPLETE")
        || (parts[1] = "WITHDRAWN_PARTIAL"
            && !InStr(parts[7], "PARTIAL_") = 1)
        return false
    receipt := {
        moved: moved,
        stacks: stacks,
        storageId: parts[4],
        storageType: parts[5],
        operationToken: parts[6],
        status: parts[7]
    }
    return true
}

WashingRefillReceiptOperationMatches(receipt, expectedOperationToken) {
    return IsObject(receipt) && receipt.HasOwnProp("operationToken")
        && RegExMatch(expectedOperationToken, "^[A-Za-z0-9_-]{1,64}$")
        && receipt.operationToken = expectedOperationToken
}

WashingRefillErrorKind(result) {
    result := Trim(String(result))
    return result = "ERROR INVENTORY_CAPACITY" ? "CAPACITY"
        : result = "ERROR RAW_STONE_NOT_FOUND" ? "SOURCE_EMPTY" : "ERROR"
}

WashingRefillFailureAction(result) {
    result := Trim(String(result))
    if StorageTransferResultIsAmbiguous(result)
        return "STOP_AMBIGUOUS"
    ; Only explicit results produced before a transfer, or a definitive false
    ; swapItems response, may retry. Unknown/process errors fail closed because
    ; the server may still apply an unobserved request after the bridge returns.
    return result = "ERROR MOVE_REJECTED"
        || result = "ERROR INVENTORY_CLOSED"
        || result = "ERROR INVENTORY_UNAVAILABLE"
        || result = "ERROR STORAGE_UNAVAILABLE"
        || result = "ERROR CALLBACK_UNAVAILABLE"
        ? "RETRY_ZERO" : "STOP_FATAL"
}

CommitVerifiedWashingRefill(expectedGeneration, info, originalCount,
    verifiedUnits, requireIncrease, &afterInfo, &failureMessage,
    &fatalFailure, proof) {
    global State, Config
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentRun(expectedGeneration) || State.runMode != "washing"
            || !State.storagePending || !State.storageOutputsVerified
            return false
        verifiedCount := InventorySpecNameCount(info.items,
            Config.rawStoneItemName)
        observedUnits := verifiedCount - originalCount
        if requireIncrease {
            if verifiedUnits < 1 || observedUnits != verifiedUnits {
                failureMessage := "補充レシートと未洗浄石の増加量が一致しません"
                fatalFailure := true
                return false
            }
        } else if verifiedCount < Config.washRefillMaximum {
            failureMessage := "設定した補充数へ到達していません"
            return false
        }
        if CapacityNeedsStorage(info, &capacityReason, &freeWeight) {
            failureMessage := "補充後の作業用空き容量を確保できませんでした"
            fatalFailure := true
            WriteDiagnostic("WASH_REFILL_RESERVE_FAILED reason="
                . capacityReason . " free=" . freeWeight
                . " proof=" . DiagnosticToken(proof))
            return false
        }
        afterInfo := info
        RecordConfirmedInventory(info, "washing_refill_commit",
            expectedGeneration)
        State.inventoryBaseline := info.items
        State.inventoryBaselineWeight := info.weight
        State.lastRawStoneCount := verifiedCount
        State.storageRefillVerified := true
        if requireIncrease {
            State.washRefillTrips += 1
            State.lastStorageResult := "洗浄結果を収納・未洗浄石を"
                . observedUnits . "個補充"
        }
        WriteDiagnostic("WASH_REFILL_CONFIRMED item="
            . Config.rawStoneItemName . " before=" . originalCount
            . " after=" . verifiedCount . " verifiedUnits=" . verifiedUnits
            . " weight=" . info.weight . " proof="
            . DiagnosticToken(proof))
        return true
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

RefillWashingInputAtStorage(expectedGeneration, currentInfo, &afterInfo,
    &failureMessage, &fatalFailure) {
    global State, Config
    afterInfo := currentInfo
    failureMessage := ""
    fatalFailure := false
    if State.runMode != "washing" || !Config.rawStoneItemName
        return true
    if !RegExMatch(Config.rawStoneItemName, "^[A-Za-z0-9_-]{1,64}$") {
        failureMessage := "未洗浄石の識別情報が壊れているため補充できません"
        fatalFailure := true
        return false
    }

    currentCount := InventorySpecNameCount(currentInfo.items,
        Config.rawStoneItemName)
    originalCount := currentCount
    verifiedRefillUnits := 0
    if currentCount >= Config.washRefillMaximum {
        ; The live storage snapshot itself proves that the configured working
        ; quantity is already present; no withdraw command is necessary.
        return CommitVerifiedWashingRefill(expectedGeneration, currentInfo,
            originalCount, 0, false, &afterInfo, &failureMessage,
            &fatalFailure, "already_at_target")
    }

    Loop {
        if !StationaryOnlyEnabled() && A_Index > Config.storageMaxRetries
            break
        if !IsCurrentRun(expectedGeneration)
            return false
        refillAttempt := A_Index
        if StationaryOnlyEnabled() && !ValidateServerEpochCheckpoint(expectedGeneration, "stationary_refill_wait") {
            fatalFailure := true
            failureMessage := "補充待機中に接続が変わりました。新しい接続へ要求を再送しません"
            return false
        }
        if refillAttempt > 1 {
            liveResult := RunBackgroundBridgeCancelable(expectedGeneration,
                "inventory-snapshot")
            if !IsCurrentRun(expectedGeneration)
                return false
            if !ParseInventorySnapshot(liveResult, &liveInfo) {
                WriteDiagnostic("WASH_REFILL_REOBSERVE_ERROR retry="
                    . refillAttempt . " result=" . DiagnosticToken(liveResult))
                if StationaryOnlyEnabled() {
                    if !StationaryPause(expectedGeneration, State.farmStateTaskId, "補充前の所持品再確認待ち", refillAttempt)
                        return false
                } else Sleep 180
                continue
            }
            liveCount := InventorySpecNameCount(liveInfo.items,
                Config.rawStoneItemName)
            if !WashingRefillAccountedTotalMatches(originalCount,
                liveCount, verifiedRefillUnits) {
                failureMessage := "補充レシートにない未洗浄石の増減を検知したため停止します"
                fatalFailure := true
                WriteDiagnostic("WASH_REFILL_UNPAIRED_REOBSERVE original="
                    . originalCount . " observed=" . liveCount
                    . " verified=" . verifiedRefillUnits)
                return false
            }
            currentInfo := liveInfo
            currentCount := liveCount
        }
        targetTotalCount := Min(1000000, Max(1, Config.washRefillMaximum))
        ; Keep the post-refill snapshot below every configured departure threshold,
        ; otherwise the next cycle would immediately return to storage without a
        ; positive Farm delta. The bridge still computes the exact item count from
        ; the live per-item weight and available slots.
        reserveWeight := WashingRefillReserveWeight(currentInfo.maxWeight)
        reserveSlots := WashingRefillReserveSlots(currentInfo.slots)
        TransitionFarmState("REFILLING_INPUT", "未洗浄石を補充 "
            . refillAttempt . "/" . Config.storageMaxRetries,
            expectedGeneration, 0, true)
        State.statusLabel.Text := BuildFarmProgressStatus(
            "未洗浄の石を持てる限界まで補充しています（",
            refillAttempt, Config.storageMaxRetries)
        WriteDiagnostic("WASH_REFILL_REQUEST item=" . Config.rawStoneItemName
            . " before=" . currentCount . " targetTotal=" . targetTotalCount
            . " reserveWeight=" . reserveWeight
            . " reserveSlots=" . reserveSlots . " retry=" . refillAttempt)
        withdrawResult := RunBackgroundBridgeCancelable(expectedGeneration,
            "withdraw-item", Config.vehicleStorageId,
            Config.vehicleStorageType, Config.rawStoneItemName, targetTotalCount,
            reserveWeight, reserveSlots)
        if !IsCurrentRun(expectedGeneration)
            return false

        if ParseVerifiedWashingRefillReceipt(withdrawResult,
            Config.vehicleStorageId, Config.vehicleStorageType,
            &withdrawReceipt) {
            receiptAction := StorageTransferReceiptAction(
                withdrawReceipt.status, true)
            TransitionFarmState("VERIFY_REFILL",
                "荷台減少済みレシートと未洗浄石の増加を照合",
                expectedGeneration, 0, true)
            receiptMatched := VerifyRawStoneReceiptDelta(expectedGeneration,
                Config.rawStoneItemName, currentCount, withdrawReceipt.moved,
                &verifiedInfo, &verifiedSnapshot, &receiptFailure)
            if !IsCurrentRun(expectedGeneration)
                return false
            WriteDiagnostic("WASH_REFILL_RECEIPT_VERIFY retry="
                . refillAttempt . " token="
                . DiagnosticToken(withdrawReceipt.operationToken)
                . " status=" . withdrawReceipt.status
                . " moved=" . withdrawReceipt.moved
                . " matched=" . (receiptMatched ? 1 : 0)
                . " failure=" . receiptFailure
                . " snapshot=" . DiagnosticToken(verifiedSnapshot))
            if !receiptMatched {
                failureMessage := receiptFailure = "UNPAIRED_DELTA"
                    ? "補充レシートと未洗浄石の増加量が一致しません"
                    : "補充レシートの反映を確認できませんでした"
                ; The bridge already proved a paired trunk decrease/player
                ; increase. Never issue another transfer without reconciling it.
                fatalFailure := true
                return false
            }
            if verifiedRefillUnits > 2147483647 - withdrawReceipt.moved {
                failureMessage := "補充レシートの合計が上限を超えました"
                fatalFailure := true
                return false
            }
            verifiedRefillUnits += withdrawReceipt.moved
            newCount := InventorySpecNameCount(verifiedInfo.items,
                Config.rawStoneItemName)
            if !WashingRefillAccountedTotalMatches(originalCount,
                newCount, verifiedRefillUnits) {
                failureMessage := "複数の補充レシートと所持数が一致しません"
                fatalFailure := true
                return false
            }
            currentInfo := verifiedInfo
            currentCount := newCount
            if receiptAction = "STOP" || receiptAction = "INVALID" {
                failureMessage := "補充要求の結果が確定できないため、安全のため停止します: "
                    . withdrawReceipt.status
                fatalFailure := true
                WriteDiagnostic("WASH_REFILL_TERMINAL_RECEIPT status="
                    . withdrawReceipt.status . " verified="
                    . verifiedRefillUnits . " current=" . currentCount)
                return false
            }
            if receiptAction = "COMPLETE"
                || receiptAction = "COMMIT_EXACT" {
                refillProofPrefix := receiptAction = "COMPLETE"
                    ? "complete_receipt_" : "capacity_receipt_"
                return CommitVerifiedWashingRefill(expectedGeneration,
                    verifiedInfo, originalCount, verifiedRefillUnits, true,
                    &afterInfo, &failureMessage, &fatalFailure,
                    refillProofPrefix . withdrawReceipt.operationToken)
            }
            if receiptAction != "RETRY_EXACT" {
                failureMessage := "補充レシートの状態を安全に判定できません"
                fatalFailure := true
                return false
            }
            failureMessage := "未洗浄石を一部補充しました。残量を再確認します"
            WriteDiagnostic("WASH_REFILL_PARTIAL_ACCOUNTED total="
                . verifiedRefillUnits . " current=" . currentCount)
            if refillAttempt < Config.storageMaxRetries
                Sleep 180
            continue
        }

        errorKind := WashingRefillErrorKind(withdrawResult)
        accountedExactly := verifiedRefillUnits > 0
            && WashingRefillAccountedTotalMatches(originalCount,
                currentCount, verifiedRefillUnits)
        if (errorKind = "SOURCE_EMPTY" || errorKind = "CAPACITY")
            && accountedExactly {
            return CommitVerifiedWashingRefill(expectedGeneration,
                currentInfo, originalCount, verifiedRefillUnits, true,
                &afterInfo, &failureMessage, &fatalFailure,
                errorKind = "SOURCE_EMPTY"
                    ? "source_empty_after_partial"
                    : "capacity_after_partial")
        }
        if errorKind = "SOURCE_EMPTY" && StationaryOnlyEnabled() {
            ; Definite zero movement only. A sent/uncertain transfer never reaches here.
            if !StationaryPause(expectedGeneration, State.farmStateTaskId, "荷台の未洗浄石補充待ち", Max(5, refillAttempt))
                return false
            continue
        }
        if errorKind = "SOURCE_EMPTY" {
            failureMessage := "車両ストレージに未洗浄の石がありません"
            fatalFailure := true
            WriteDiagnostic(
                "Stone Washing paused: no raw stone available in truck storage")
            return false
        }
        if errorKind = "CAPACITY" {
            failureMessage := "未洗浄石を補充できる安全な空き容量がありません"
            fatalFailure := true
            return false
        }
        failureAction := WashingRefillFailureAction(withdrawResult)
        if failureAction != "RETRY_ZERO" {
            failureMessage := failureAction = "STOP_AMBIGUOUS"
                ? "補充要求の反映有無を確認できないため、二重取得を防いで停止します"
                : "未洗浄石を安全に補充できません: "
                    . DiagnosticToken(withdrawResult)
            fatalFailure := true
            WriteDiagnostic("WASH_REFILL_TERMINAL_RESULT action="
                . failureAction . " result=" DiagnosticToken(withdrawResult))
            return false
        }
        failureMessage := "未洗浄石の補充操作を開始できませんでした: "
            . DiagnosticToken(withdrawResult)
        if refillAttempt < Config.storageMaxRetries {
            ; This branch is an explicit, definite-zero result only. The next
            ; command still re-observes the exact accounted total first.
            Sleep 180
        }
        if StationaryOnlyEnabled() && !StationaryPause(expectedGeneration, State.farmStateTaskId, "転送前の一時エラー・再確認待ち", refillAttempt)
            return false
    }
    return false
}

RunLocalVehicleStorageCycle(expectedGeneration, reuseStoragePose := false) {
    global State, Config
    if !IsCurrentRun(expectedGeneration)
        return

    if !reuseStoragePose
        ObserveStorageCycle(expectedGeneration, "departure")
    protectedSnapshot := IsObject(State.storagePreSnapshot)
        ? State.storagePreSnapshot : State.confirmedInventory
    ledgerUnits := PositiveInventoryCountTotal(State.farmOutputLedger)
    refillOnlyDeparture := !reuseStoragePose && State.runMode = "washing"
        && State.storageOutputsVerified
        && State.storageReason = "raw_stone_empty"
    verifiedRefillRecovery := reuseStoragePose && State.runMode = "washing"
        && State.storageOutputsVerified && Config.rawStoneItemName != ""
    ledgerSnapshotValid := IsObject(protectedSnapshot) && ledgerUnits > 0
        && BuildFarmOutputProtectedBaseline(protectedSnapshot.items,
            State.farmOutputLedger, &preflightBaseline, &preflightUnits,
            &preflightFailure)
    if !IsObject(protectedSnapshot)
        || (!ledgerSnapshotValid && !refillOnlyDeparture
            && !verifiedRefillRecovery) {
        WriteDiagnostic("STORAGE_LEDGER_BLOCKED source=departure reason="
            (!IsObject(protectedSnapshot) ? "missing_snapshot"
                : ledgerUnits <= 0 ? "empty_ledger" : preflightFailure)
            " ledger=" ledgerUnits)
        StopAutomationWithFault(
            "確定した作業報酬だけを安全に特定できないため、車両へ移動せず停止しました",
            "vehicle", "UNTRUSTED_STORAGE_BASELINE")
        return
    }

    TransitionFarmState("LOCATING_TRUCK", "現在位置の登録荷台を確認",
        expectedGeneration, 0, true)
    State.statusLabel.Text := "同じ位置で登録荷台を確認しています（移動なし）"
    WriteDiagnostic("LOCAL_STORAGE_TRIP_START trip=" (State.storageTrips + 1))
    if !ValidateServerEpochCheckpoint(expectedGeneration,
        "local_vehicle_departure") {
        StopAutomationWithFault("移動前の接続状態が変わったため安全停止しました",
            "vehicle")
        return
    }

    movementHistory := reuseStoragePose && IsObject(State.storageMovementHistory)
        ? State.storageMovementHistory : []
    matchedViewRoute := reuseStoragePose ? State.storageMatchedViewRoute : ""
    try {
        if reuseStoragePose {
            recoveryViewRoute := ""
            storageFound := StationaryOnlyEnabled() ? WaitStationaryCargo(expectedGeneration, &recoveredId, &recoveredType) : ProbeExeRouteCargo(expectedGeneration, &recoveredId, &recoveredType)
            searchFailure := storageFound ? "" : "復旧位置で登録した荷台を確認できません"
            fatalSearch := !storageFound
            if recoveryViewRoute
                matchedViewRoute := JoinLocalRoutes([matchedViewRoute,
                    recoveryViewRoute])
            if fatalSearch && !storageFound
                searchFailure := searchFailure ? searchFailure
                    : "収納復旧中に荷台を安全に開けませんでした"
        } else {
            storageFound := FindRegisteredStorageNearby(expectedGeneration,
                &movementHistory, &matchedViewRoute, &searchFailure)
        }
    }
    catch as err {
        storageFound := false
        searchFailure := "登録車両の探索中にエラーが発生しました"
        WriteDiagnostic("LOCAL_STORAGE_SEARCH_ERROR=" err.Message)
    }
    if !IsCurrentRun(expectedGeneration)
        return
    State.storageMovementHistory := movementHistory
    State.storageMatchedViewRoute := matchedViewRoute
    if !storageFound {
        cleanupOk := CloseLocalStorageUi()
        if !cleanupOk {
            StopAutomationWithFault("探索画面を安全に閉じられないため停止しました",
                "vehicle")
            return
        }
        EnterFarmRecovery(expectedGeneration,
            reuseStoragePose ? "OPENING_STORAGE" : "FARMING",
            searchFailure ? searchFailure : "registered_storage_not_found")
        return
    }

    ; The storage probe only succeeds after the exact registered rightInventory id
    ; and trunk type are visible, which is the observable arrival condition in
    ; server-independent local mode. Never deposit merely because movement ended.
    TransitionFarmState("VERIFY_TRUCK_REACHED",
        "登録済み荷台との一致を確認", expectedGeneration, 0, true)
    TransitionFarmState("OPENING_STORAGE",
        "登録済み荷台を開いた状態を確認", expectedGeneration)
    ObserveStorageCycle(expectedGeneration, "truck_arrived")

    depositOk := State.storageOutputsVerified
        && !FarmOutputLedgerHasPending(State.farmOutputLedger)
    refillOk := true
    fatalDeposit := false
    fatalRefill := false
    failureMessage := "収納後の所持量を確認できませんでした"
    refillFailureMessage := ""
    postInfo := protectedSnapshot
    depositedCount := 0
    try {
        if !ValidateServerEpochCheckpoint(expectedGeneration,
            "local_before_deposit") {
            failureMessage := "収納直前に接続状態が変わったため停止しました"
            fatalDeposit := true
        } else {
            if depositOk {
                resumedSnapshot := RunBackgroundBridgeCancelable(expectedGeneration,
                    "inventory-snapshot")
                if !ParseInventorySnapshot(resumedSnapshot, &postInfo) {
                    depositOk := false
                    failureMessage := "収納済み所持品を再確認できませんでした"
                } else {
                    RecordConfirmedInventory(postInfo,
                        "storage_resume_verified", expectedGeneration)
                    if FarmOutputLedgerHasPending(State.farmOutputLedger) {
                        depositOk := false
                        failureMessage := "収納復旧中に未収納の確定作業報酬を検出しました"
                    }
                }
            }
            if !depositOk {
                Loop Config.storageMaxRetries {
                    if !IsCurrentRun(expectedGeneration)
                        return
                    State.storageRetryCount := A_Index
                    State.farmStateRetry := A_Index - 1
                    TransitionFarmState("STORING_OUTPUTS", "収納試行 " A_Index "/"
                        Config.storageMaxRetries, expectedGeneration, 0, true)
                    State.statusLabel.Text := BuildFarmProgressStatus(
                        "確定した作業報酬を収納しています（", A_Index,
                        Config.storageMaxRetries)

                    ; Re-observe immediately before every command. This first
                    ; reconciles a late completion from the one active checkpoint,
                    ; then synthesizes a new baseline that protects every live unit
                    ; except the exact remaining ledger quantities.
                    liveSnapshotResult := RunBackgroundBridgeCancelable(
                        expectedGeneration, "inventory-snapshot")
                    if !IsCurrentRun(expectedGeneration)
                        return
                    if !ParseInventorySnapshot(liveSnapshotResult, &beforeAttempt) {
                        failureMessage := "収納直前の所持品を再確認できませんでした"
                        WriteDiagnostic("LOCAL_DEPOSIT_PRE_SNAPSHOT_ERROR retry="
                            A_Index " result=" liveSnapshotResult)
                    } else {
                        RecordConfirmedInventory(beforeAttempt,
                            "storage_ledger_before", expectedGeneration)
                        if IsObject(State.storageDepositCheckpoint) {
                            if !State.storageDepositCheckpoint.receiptVerified {
                                failureMessage := "荷台側の増加を証明する収納レシートがないため停止しました"
                                fatalDeposit := true
                                break
                            }
                            if !ReconcileActiveStorageDepositCheckpoint(
                                expectedGeneration, beforeAttempt.items,
                                &lateApplied, &remainingBefore) {
                                failureMessage := "収納台帳の遅延結果を照合できませんでした"
                                fatalDeposit := true
                                break
                            }
                            depositedCount += lateApplied
                            receiptRemaining := StorageDepositCheckpointReceiptRemaining(
                                State.storageDepositCheckpoint)
                            if remainingBefore > 0 && receiptRemaining > 0 {
                                ; A trusted bridge receipt already proved the paired
                                ; registered-trunk increase. Wait only for the rest of
                                ; that exact receipt to become visible in player state;
                                ; never dispatch a second transfer for it.
                                TransitionFarmState("VERIFY_STORAGE",
                                    "検証済み収納レシートの反映待ち",
                                    expectedGeneration, 0, true)
                                receiptObserved := VerifyStorageLedgerProgress(
                                    expectedGeneration, &postInfo, &postResult,
                                    &continuedApplied)
                                if !IsCurrentRun(expectedGeneration)
                                    return
                                depositedCount += continuedApplied
                                remainingBefore := PositiveInventoryCountTotal(
                                    State.farmOutputLedger)
                                if !receiptObserved {
                                    failureMessage := "検証済み収納レシートの所持品反映を確認できませんでした"
                                    if InStr(postResult, "LEDGER_RECONCILE")
                                        || InStr(postResult, "UNVERIFIED_DEPOSIT_RECEIPT") {
                                        fatalDeposit := true
                                        break
                                    }
                                    continue
                                }
                                beforeAttempt := postInfo
                                if remainingBefore > 0 {
                                    if !RetireCompletedStorageDepositCheckpoint(
                                        expectedGeneration) {
                                        failureMessage := "部分収納レシートを安全に完了できませんでした"
                                        fatalDeposit := true
                                        break
                                    }
                                }
                            } else if remainingBefore > 0 {
                                ; A fully reconciled PARTIAL receipt authorizes a
                                ; fresh checkpoint for only the ledger remainder.
                                if !RetireCompletedStorageDepositCheckpoint(
                                    expectedGeneration) {
                                    failureMessage := "収納レシートと未収納台帳の残量が一致しません"
                                    fatalDeposit := true
                                    break
                                }
                            }
                        } else
                            remainingBefore := PositiveInventoryCountTotal(
                                State.farmOutputLedger)

                        if remainingBefore = 0 {
                            postInfo := beforeAttempt
                            if !FinalizeVerifiedFarmOutputDeposit(
                                expectedGeneration, postInfo) {
                                failureMessage := "空になった収納台帳を確定できませんでした"
                                fatalDeposit := true
                                break
                            }
                            stillFull := State.runMode = "washing" ? false
                                : CapacityNeedsStorage(postInfo,
                                    &postCapacityReason, &postFreeWeight)
                            if stillFull {
                                depositOk := false
                                fatalDeposit := true
                                failureMessage := "作業報酬は収納しましたが、保護対象の持ち物で容量不足が続いています"
                            } else
                                depositOk := true
                            break
                        }

                        if !BuildFarmOutputProtectedBaseline(beforeAttempt.items,
                            State.farmOutputLedger, &protectedBaseline,
                            &eligibleUnits, &baselineFailure) {
                            failureMessage := "収納対象台帳と現在の所持品が一致しません（"
                                . baselineFailure . "）"
                            fatalDeposit := true
                            break
                        }
                        if !BeginActiveStorageDepositCheckpoint(
                            expectedGeneration, beforeAttempt.items) {
                            failureMessage := "収納台帳のチェックポイントを開始できませんでした"
                            fatalDeposit := true
                            break
                        }

                        depositResult := RunBackgroundBridgeCancelable(
                            expectedGeneration, "deposit-delta",
                            Config.vehicleStorageId, Config.vehicleStorageType,
                            protectedBaseline,
                            State.storageDepositCheckpoint.authorizedSpec)
                        if !IsCurrentRun(expectedGeneration)
                            return
                        if !BindActiveStorageDepositReceipt(expectedGeneration,
                            depositResult, eligibleUnits, &receiptUnits,
                            &receiptFailure) {
                            ; ERROR/timeout/no-result is deliberately terminal. A
                            ; player-only decrease cannot prove that the registered
                            ; trunk gained the item, so it must never consume ledger.
                            failureMessage := DepositFailureMessage(depositResult)
                                . "（収納レシート: " . receiptFailure . "）"
                            fatalDeposit := true
                            WriteDiagnostic("LOCAL_DEPOSIT_RECEIPT_REJECTED retry="
                                A_Index " result=" DiagnosticToken(depositResult)
                                " reason=" receiptFailure)
                            break
                        }
                        TransitionFarmState("VERIFY_STORAGE",
                            "荷台増加済みレシートと台帳減少を照合",
                            expectedGeneration)
                        reduced := VerifyStorageLedgerProgress(
                            expectedGeneration, &postInfo, &postResult,
                            &appliedUnits)
                        if !IsCurrentRun(expectedGeneration)
                            return
                        depositedCount += appliedUnits
                        remainingAfter := PositiveInventoryCountTotal(
                            State.farmOutputLedger)
                        WriteDiagnostic("LOCAL_DEPOSIT_ATTEMPT retry=" A_Index
                            " command=" depositResult
                            " receiptUnits=" receiptUnits
                            " ledgerApplied=" appliedUnits
                            " ledgerRemaining=" remainingAfter
                            " eligible=" eligibleUnits
                            " snapshot=" postResult)
                        if reduced && remainingAfter = 0 {
                            if !FinalizeVerifiedFarmOutputDeposit(
                                expectedGeneration, postInfo) {
                                failureMessage := "収納後の空台帳を確定できませんでした"
                                fatalDeposit := true
                                break
                            }
                            stillFull := State.runMode = "washing" ? false
                                : CapacityNeedsStorage(postInfo,
                                    &postCapacityReason, &postFreeWeight)
                            if stillFull {
                                depositOk := false
                                fatalDeposit := true
                                failureMessage := "作業報酬は収納しましたが、保護対象の持ち物で容量不足が続いています"
                            } else {
                                depositOk := true
                                State.lastStorageResult := depositedCount
                                    . "個の確定報酬を収納"
                            }
                            break
                        }
                        if reduced {
                            if !RetireCompletedStorageDepositCheckpoint(
                                expectedGeneration) {
                                failureMessage := "部分収納レシートを安全に完了できませんでした"
                                fatalDeposit := true
                                break
                            }
                            failureMessage := "部分収納済み。確定台帳の残量だけ再試行します"
                        }
                        else {
                            failureMessage := "検証済み収納レシートの所持品反映を確認できませんでした"
                            if InStr(postResult, "LEDGER_RECONCILE") {
                                fatalDeposit := true
                                break
                            }
                        }
                    }
                    if A_Index < Config.storageMaxRetries {
                        TransitionFarmState("STORING_OUTPUTS", "収納を再試行",
                            expectedGeneration)
                        Sleep 180
                    }
                }
            }
            if depositOk && State.runMode = "washing"
                && Config.rawStoneItemName {
                refillOk := RefillWashingInputAtStorage(expectedGeneration,
                    postInfo, &refilledInfo, &refillFailureMessage,
                    &fatalRefill)
                if refillOk
                    postInfo := refilledInfo
            }
        }
    } catch as err {
        if depositOk && State.runMode = "washing"
            && Config.rawStoneItemName {
            refillOk := false
            refillFailureMessage := "未洗浄石の補充処理でエラーが発生しました"
        } else
            failureMessage := "収納処理でエラーが発生しました"
        WriteDiagnostic("LOCAL_STORAGE_CYCLE_ERROR=" err.Message)
    } finally {
        ; F9 may interrupt a blocking bridge call and F8 may already own a newer
        ; generation when this old stack unwinds. Only the exact live generation
        ; may release inputs or close NUI; StopMining already cleaned the old run.
        if StorageCycleStillOwnsCleanup(expectedGeneration) {
            ReleaseAllInputs()
            releaseOk := ReleaseBackgroundTarget(true)
            closeResult := RunBackgroundBridge("close-inventory")
        } else {
            releaseOk := false
            closeResult := "STALE_OWNER"
            WriteDiagnostic("LOCAL_STORAGE_CLEANUP_SKIPPED staleGeneration="
                expectedGeneration " currentGeneration=" State.generation)
        }
    }

    if !IsCurrentRun(expectedGeneration)
        return
    cleanupOk := releaseOk && closeResult = "CLOSED"
    if !cleanupOk
        cleanupOk := CloseLocalStorageUi()
    if !cleanupOk {
        StopAutomationWithFault("インベントリを安全に閉じられないため停止しました",
            "vehicle")
        return
    }

    if !depositOk {
        if fatalDeposit {
            StopAutomationWithFault(failureMessage, "vehicle")
            return
        }
        State.recoveryAtStorage := true
        EnterFarmRecovery(expectedGeneration, "OPENING_STORAGE",
            "storage_verify_exhausted: " failureMessage)
        return
    }

    if !refillOk {
        failureCode := InStr(refillFailureMessage, "ありません")
            ? "RAW_STONE_NOT_FOUND" : "RAW_STONE_REFILL_FAILED"
        StopAutomationWithFault(refillFailureMessage, "vehicle", failureCode)
        return
    }

    if !StorageReturnAllowed(State.runMode, Config.rawStoneItemName != "",
        State.storageRefillVerified) {
        StopAutomationWithFault(
            "未洗浄石の補充を所持品で確認できないため作業地点へ戻りません",
            "vehicle", "RAW_STONE_REFILL_UNVERIFIED")
        return
    }

    ObserveStorageCycle(expectedGeneration, "deposit_verified")
    if State.runMode = "washing"
        ObserveStorageCycle(expectedGeneration, "refill_verified")
    CompleteVerifiedStorageReturn(expectedGeneration)
}

CompleteVerifiedStorageReturn(expectedGeneration) {
    global State, Config
    if !IsCurrentRun(expectedGeneration)
        return false
    if FarmOutputLedgerHasPending(State.farmOutputLedger) {
        StopAutomationWithFault(
            "未収納の確定作業報酬が台帳に残っているため作業地点へ戻りません",
            "vehicle", "STORAGE_LEDGER_REMAINING")
        return false
    }
    TransitionFarmState("LOCATING_FARM", "収納・補充確認後に元の作業地点を復元",
        expectedGeneration, 0, true)
    TransitionFarmState("RETURNING_TO_FARM", "元の作業地点へ復帰",
        expectedGeneration, 0, true)
    State.statusLabel.Text := ExeStorageMethod(State.runMode) = "stationary" ? "近接位置の作業状態を確認しています" : "作業位置へ戻っています"
    poseRestored := ExecuteExeRouteLeg(expectedGeneration, "return")
    if !IsCurrentRun(expectedGeneration)
        return false
    if !poseRestored {
        StopAutomationWithFault("作業位置へ安全に戻れないため停止しました", "vehicle")
        return false
    }
    TransitionFarmState("VERIFY_FARM_REACHED", "登録した復路の実画面照合を確認",
        expectedGeneration, 0, true)
    if !ValidateServerEpochCheckpoint(expectedGeneration, "local_work_return") {
        StopAutomationWithFault("収納中のサーバー再起動または再接続を検知しました",
            "vehicle")
        return false
    }
    ; Storage/refill and the reversible return route are now independently proven.
    ; Clear the storage objective before target recovery so a high-but-protected raw
    ; stone baseline cannot send RECOVERY back to the truck a second time.
    State.storagePending := false
    State.storageStartPending := false
    State.storagePreSnapshot := 0
    State.storageRecoveryAttempted := false
    State.recoveryAtStorage := false
    WriteDiagnostic("LOCAL_FARM_RETURN_ROUTE_CONFIRMED refill="
        . (State.storageRefillVerified ? 1 : 0))
    State.statusLabel.Text := "作業ボタンを再確認しています"
    workRecovered := StationaryOnlyEnabled() ? WaitStationaryTaskReady(expectedGeneration) : ProbeExeRouteWork(expectedGeneration, State.runMode)
    if !IsCurrentRun(expectedGeneration)
        return false
    if !workRecovered {
        StopAutomationWithFault("復路終点の作業ボタンを確認できません。徒歩をやり直さず停止しました", "vehicle", "EXE_ROUTE_WORK_NOT_VERIFIED")
        return false
    }
    ObserveStorageCycle(expectedGeneration, "work_arrived")
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
    State.storageStartPending := false
    State.storageOutputsVerified := false
    State.storageRefillVerified := false
    State.storageRecoveryAttempted := false
    State.recoveryAtStorage := false
    State.resumeVerificationPending := true
    State.targetLostSince := 0
    State.farmWatchdogAt := MonotonicMs()
    TransitionFarmState("RESUMING_FARM",
        "収納完了。次の実報酬で再開確認", expectedGeneration, 0, true)
    State.statusLabel.Text := "収納完了。次の作業結果を確認します"
    WriteDiagnostic("LOCAL_STORAGE_TRIP_COMPLETE trip=" State.storageTrips
        " resumePending=1")
    ScheduleNext(expectedGeneration, 100)
    return true
}

FindRegisteredStorageNearby(expectedGeneration, &movementHistory,
    &matchedViewRoute, &failureMessage) {
    if StationaryOnlyEnabled() {
        movementHistory := []
        matchedViewRoute := ""
        failureMessage := ""
        return WaitStationaryCargo(expectedGeneration, &stationaryId, &stationaryType)
    }
    global State
    movementHistory := []
    matchedViewRoute := ""
    failureMessage := ""
    TransitionFarmState("MOVING_TO_TRUCK", "登録した往路を実画面照合しながら徒歩移動", expectedGeneration, 0, true)
    if !ExecuteExeRouteLeg(expectedGeneration, "outbound") {
        failureMessage := ExeStorageMethod(State.runMode) = "stationary" ? "近接設定の荷台・接続を確認できません。近接確認をやり直してください。" : "EXE徒歩往路の実画面照合に失敗しました。盲目的な再走はしません。"
        return false
    }
    if !ProbeExeRouteCargo(expectedGeneration, &id, &type) {
        failureMessage := ExeStorageMethod(State.runMode) = "stationary" ? "今の位置・視点で登録荷台を確認できません。両方のボタンが見える位置で近接収納を再確認してください。" : "徒歩経路の終点で登録した荷台を確認できませんでした。"
        if IsCurrentRun(expectedGeneration)
            StopAutomationWithFault(failureMessage, "vehicle", "EXE_ROUTE_CARGO_NOT_VERIFIED")
        return false
    }
    return true
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
    if StationaryOnlyEnabled()
        return false
    global State
    if !IsCurrentRun(expectedGeneration) || !route || !State.serverEpoch
        return false

    ; DevCon movement is intentionally retained for background-safe walking, but
    ; +look_* is not a mouse axis and can report ROUTE even when GTA's camera did
    ; not move.  When FiveM owns the foreground, route every storage view segment
    ; through the same relative SendInput adapter used by work-view recovery.
    ; OpenStorageAndCapture remains the proof that the resulting view is useful.
    if RouteViewSegmentCount(route) > 0
        && State.targetHwnd && WinActive("ahk_id " State.targetHwnd)
        return PlayForegroundViewRoute(expectedGeneration, route)

    if !EnsureDevConPort(false)
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

PlayForegroundViewRoute(expectedGeneration, route) {
    if StationaryOnlyEnabled()
        return false
    global State, Config
    if !IsCurrentRun(expectedGeneration) || !IsValidRoute(route, false)
        || !State.targetHwnd || !WinActive("ahk_id " State.targetHwnd)
        return false

    ; A held ox_target cursor consumes relative mouse input.  Close only the
    ; target session owned by this run before applying physical camera motion.
    if !ReleaseBackgroundTarget(false) || !WaitWhileReady(60, expectedGeneration)
        return false

    totalSent := 0
    for routeStep in StrSplit(route, ",") {
        if !RegExMatch(routeStep, "^(\d+):(\d+)$", &parts)
            return false
        durationMs := parts[1] + 0
        mask := parts[2] + 0
        if mask & 15 {
            ; Storage view routes must never smuggle walking input through the
            ; global foreground keyboard. Walking stays on the cancellable DevCon
            ; path so switching tabs cannot type W/A/S/D into another app.
            WriteDiagnostic("STORAGE_VIEW_ROUTE_REJECTED reason=movement_mask route="
                . DiagnosticToken(route))
            return false
        }

        horizontalDirection := (mask & 64) ? -1 : (mask & 128) ? 1 : 0
        ; MouseDirection is the empirically selected GTA downward axis. Logical
        ; look-up is its inverse; logical look-down uses it directly.
        verticalDirection := (mask & 16) ? -Config.workViewMouseDirection
            : (mask & 32) ? Config.workViewMouseDirection : 0
        deadline := MonotonicMs() + durationMs
        while MonotonicMs() < deadline {
            Critical "On"
            if !IsTargetForeground(expectedGeneration) {
                Critical "Off"
                return false
            }
            sent := SendRelativeMouseDelta(
                horizontalDirection * Config.workViewMouseStep,
                verticalDirection * Config.workViewMouseStep)
            Critical "Off"
            if !sent
                return false
            totalSent += 1
            if !WaitWhileReady(16, expectedGeneration)
                return false
        }
    }
    WriteDiagnostic("STORAGE_CAMERA_INPUT adapter=sendinput-relative route="
        . DiagnosticToken(route) " packets=" totalSent " verified=0")
    return totalSent > 0 && IsTargetForeground(expectedGeneration)
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
    ; DevConのlook文字列は実カメラ移動を証明できません。位置だけを戻し、
    ; 続くRecoverLocalWorkTargetが前面ガード付き相対入力と再検出を担当します。
    if IsCurrentRun(expectedGeneration)
        WriteDiagnostic("CAMERA_RETURN_PENDING adapter=sendinput-relative")
    return true
}

RecoverLocalWorkTarget(expectedGeneration, cameraAlreadySent := false) {
    global State, Config
    if Config.workViewLock && !cameraAlreadySent {
        if !MaintainBackgroundWorkView(expectedGeneration, true)
            return false
    }
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

EnsureDevConPort(preflightRelease := true) {
    global State
    if State.lastDevConPort = 29200 || State.lastDevConPort = 29300 {
        ; play-route(-health) はhelper自身が実行前後に全入力を解除します。
        ; 既知portに別helperの解除を重ねる約2秒の空白は省けます。
        if !preflightRelease
            return true
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
    if InStr(result, "AMBIGUOUS_TRANSFER")
        || InStr(result, "BRIDGE_TIMEOUT")
        return "収納要求の反映有無を確認できないため、二重収納を防いで停止しました"
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

FarmStateNameKnown(farmState) {
    return InStr("|IDLE|FARMING|WASH_SETTLING|WASH_CORRECTING|CHECKING_INVENTORY|INVENTORY_CHECK|NEED_STORAGE|INVENTORY_FULL|"
        . "STOPPING_FARM|LOCATING_TRUCK|MOVING_TO_TRUCK|VERIFY_TRUCK_REACHED|"
        . "OPENING_STORAGE|STORING_OUTPUTS|STORING|VERIFY_STORAGE|"
        . "REFILLING_INPUT|VERIFY_REFILL|LOCATING_FARM|RETURNING_TO_FARM|"
        . "VERIFY_FARM_REACHED|RESUMING_FARM|VERIFY_FARM_RESUMED|RECOVERY|ERROR|",
        "|" farmState "|") != 0
}

FarmFailureCode(message, farmState, recoveryReason := "",
    requestedCode := "FARM_FATAL") {
    if requestedCode != "FARM_FATAL"
        return requestedCode
    detail := String(message) " " String(recoveryReason)
    if InStr(detail, "サーバー再起動") || InStr(detail, "再接続")
        || InStr(detail, "サーバー接続") || InStr(detail, "SERVER_SESSION")
        || InStr(detail, "連携状態が変わった")
        return "SERVER_SESSION_CHANGED"
    if InStr(detail, "watchdog") || InStr(detail, "実際の作業報酬を3回")
        return "WATCHDOG_TIMEOUT"
    if InStr(detail, "INPUT_RELEASE") || InStr(detail, "入力を")
        || InStr(detail, "安全に閉じられない")
        || InStr(detail, "補正結果を確認できない")
        return "INPUT_STUCK"
    if !FarmStateNameKnown(farmState) || InStr(detail, "内部状態")
        || InStr(detail, "dispatcher_unhandled")
        return "UNKNOWN_STATE"
    if farmState = "LOCATING_FARM" || farmState = "RETURNING_TO_FARM"
        || farmState = "VERIFY_FARM_REACHED" || farmState = "RESUMING_FARM"
        || farmState = "VERIFY_FARM_RESUMED"
        || InStr(detail, "作業位置へ安全に戻れない")
        return "FARM_RESUME_FAILED"
    if farmState = "LOCATING_TRUCK" || farmState = "MOVING_TO_TRUCK"
        || farmState = "VERIFY_TRUCK_REACHED" || farmState = "OPENING_STORAGE"
        || InStr(detail, "荷台")
        || InStr(detail, "登録車両の探索")
        || InStr(detail, "登録した車両と一致しない")
        return "STORAGE_UI_NOT_FOUND"
    if farmState = "REFILLING_INPUT" || farmState = "VERIFY_REFILL"
        || InStr(detail, "未洗浄石") || InStr(detail, "未洗浄の石")
        return "RAW_STONE_REFILL_FAILED"
    if farmState = "VERIFY_STORAGE" || InStr(detail, "収納後")
        || InStr(detail, "減少を確認") || InStr(detail, "容量不足が続")
        return "STORAGE_VERIFY_FAILED"
    if farmState = "STORING_OUTPUTS" || farmState = "STORING"
        || InStr(detail, "車両ストレージへ収納")
        || InStr(detail, "ストレージの容量")
        return "STORAGE_ACTION_FAILED"
    if farmState = "CHECKING_INVENTORY" || farmState = "INVENTORY_CHECK"
        || InStr(detail, "所持品")
        || InStr(detail, "インベントリ状態")
        return "INVENTORY_DETECTION_FAILED"
    if InStr(detail, "作業対象") || InStr(detail, "作業視点")
        || InStr(detail, "作業位置") || InStr(detail, "target_lost")
        return "FARM_TARGET_LOST"
    return "FARM_FATAL"
}

StopAutomationWithFault(message, pageName := "overview",
    faultCode := "FARM_FATAL") {
    global State
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        ; Bind the fault to the run/task that observed it.  StopMining validates
        ; this token in the same critical claim that installs stopInProgress, so
        ; a delayed old callback can never fault a later run (or turn a normal F9
        ; stop into ERROR after its stack resumes).
        if !State.running || State.stopInProgress
            return false
        expectedGeneration := State.generation
        expectedTaskId := State.farmStateTaskId
        resolvedCode := FarmFailureCode(message, State.farmState,
            State.recoveryReason, faultCode)
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
    SupportWriteEvent("FAULT", "code=" resolvedCode " detail=" message)
    ObserveStorageCycle(expectedGeneration, "stopped", resolvedCode)
    return StopMining({message: message, pageName: pageName,
        faultCode: resolvedCode, expectedGeneration: expectedGeneration,
        expectedTaskId: expectedTaskId})
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

AutomationCycle(expectedGeneration, expectedTaskId := 0) {
    if !TryClaimFarmCallback(expectedGeneration, expectedTaskId)
        return
    try AutomationCycleOwned(expectedGeneration, expectedTaskId)
    finally ReleaseFarmCallback()
}

AutomationCycleOwned(expectedGeneration, expectedTaskId := 0) {
    global State, Config
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId)
        return

    if State.metagameOutbox.Length
        FlushPendingMetagameMiningEvent(expectedGeneration)

    if State.farmState = "IDLE" || State.farmState = "ERROR"
        return
    if State.farmState = "RECOVERY" {
        RunFarmRecoveryCycle(expectedGeneration, expectedTaskId)
        return
    }
    if IsWashCompletionRecoveryState(State.farmState) {
        RunWashCompletionRecoveryCycle(expectedGeneration, expectedTaskId)
        return
    }
    if FarmStateRequiresCapacityDispatch(State.farmState,
        State.storagePending) {
        MaybeHandleVehicleCapacity(expectedGeneration)
        return
    }
    if State.farmState != "FARMING" && State.farmState != "RESUMING_FARM" {
        EnterFarmRecovery(expectedGeneration, "FARMING",
            "dispatcher_unhandled_" State.farmState)
        return
    }

    if (!StationaryOnlyEnabled() || State.actionCompletionPending || IsObject(State.pendingFarmAttempt)) && State.farmWatchdogAt
        && MonotonicMs() - State.farmWatchdogAt >= Config.farmWatchdogMs {
        if State.watchdogRecoveryCount >= 3 {
            StopAutomationWithFault(
                "実際の作業報酬を3回の復旧後も確認できないため停止しました")
            return
        }
        State.watchdogRecoveryCount += 1
        returnState := State.farmState = "RESUMING_FARM"
            ? "RESUMING_FARM" : "FARMING"
        EnterFarmRecovery(expectedGeneration, returnState,
            "watchdog_no_verified_reward")
        return
    }

    ; クリック済みの作業は、実際の進捗UIが完了するまで容量・視点・食事や
    ; 次のクリックへ進めません。完了後だけ通常cycleへ戻します。
    if State.actionCompletionPending {
        WaitPendingBackgroundActionCompletion(expectedGeneration)
        return
    }

    ; 収穫アニメーション中に軽い保守処理を先行します。容量は報酬反映後の
    ; 正確な値が必要なので、次アクション時刻までは意図的に読みません。
    if State.nextActionAt > MonotonicMs() {
        if MaybeHandleServerHealth(expectedGeneration)
            return
        if !WorkViewDownModeSupported(State.runMode)
            && !MaintainBackgroundWorkView(expectedGeneration)
            return
        if MaybeHandleBackgroundEating(expectedGeneration)
            return
        remaining := State.nextActionAt - MonotonicMs()
        if remaining > 0 {
            ScheduleNext(expectedGeneration, remaining)
            return
        }
    }
    State.nextActionAt := 0
    if MaybeHandleServerHealth(expectedGeneration)
        return
    if State.farmState = "FARMING" && Config.vehicleStorageEnabled {
        TransitionFarmState("CHECKING_INVENTORY", "定期所持品確認",
            expectedGeneration)
        if MaybeHandleVehicleCapacity(expectedGeneration)
            return
        if State.farmState != "FARMING"
            return
    }
    ; Washing/gold perform one explicit down alignment in their attempt function.
    ; Do not stack the generic maintenance pulse immediately before that pulse.
    if !WorkViewDownModeSupported(State.runMode)
        && !MaintainBackgroundWorkView(expectedGeneration)
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

FarmStateRequiresCapacityDispatch(farmState, storagePending) {
    return farmState = "CHECKING_INVENTORY"
        || farmState = "INVENTORY_CHECK"
        || (farmState = "STOPPING_FARM" && storagePending)
}

EnterFarmRecovery(expectedGeneration, returnState, reason) {
    global State
    if !IsCurrentRun(expectedGeneration)
        return false
    State.recoveryReturnState := returnState
    State.recoveryReason := reason
    WriteDiagnostic("FARM_RECOVERY code=" DiagnosticToken(reason)
        " from=" State.farmState " return=" returnState)
    State.farmStateRetry += 1
    if !TransitionFarmState("RECOVERY", reason, expectedGeneration, 0, true)
        return false
    State.recoveryPreflightFailures := 0
    ; The recovery cycle owns target release and inventory closure so every
    ; failure is counted. Entry only cancels helpers and releases local inputs.
    CancelActiveBridgeProcess()
    ReleaseAllInputs()
    ScheduleNext(expectedGeneration, 120)
    return true
}

HandleFarmTargetMissing(expectedGeneration, actionMode) {
    if FastWashModeEnabled() && actionMode = "washing" {
        global State, Config
        if !IsCurrentRun(expectedGeneration)
            return true
        State.statusLabel.Text := "●  最速石洗い：洗浄対象だけを待機中（ストレージ表示は不要）"
        SupportWriteEvent("FAST_WASH_RETRY", "reason=wash_target_missing storage_gate=0")
        ScheduleNext(expectedGeneration, Min(350, Max(100, Config.notFoundRetryMs)))
        return true
    }
    if StationaryOnlyEnabled() {
        if WaitStationaryTaskReady(expectedGeneration)
            ScheduleNext(expectedGeneration, 1)
        return true
    }
    global State, Config
    if !IsCurrentRun(expectedGeneration)
        return true
    now := MonotonicMs()
    if !State.targetLostSince
        State.targetLostSince := now
    MarkWorkViewNoEffect(actionMode, "action_missing", expectedGeneration)
    lostFor := now - State.targetLostSince
    WriteDiagnostic("FARM_TARGET_MISSING mode=" actionMode
        " lostMs=" lostFor " state=" State.farmState)

    ; 最初のMISSING直後に実相対入力を試します。従来の15秒待ちと
    ; DevCon疑似成功を挟まず、FiveMが前面なら次cycleで即再検出します。
    if Config.workViewLock
        && (State.workViewStatus = "WAIT_FG"
            || State.workViewStatus = "FAILED"
            || !State.lastWorkViewAt
            || now - State.lastWorkViewAt >= 500) {
        State.statusLabel.Text := "●  作業対象へ視点を自動復旧中"
        if !MaintainBackgroundWorkView(expectedGeneration, true)
            return true
        ScheduleNext(expectedGeneration, 100)
        return true
    }
    if lostFor >= Config.targetLostRecoveryMs {
        returnState := State.farmState = "RESUMING_FARM"
            ? "RESUMING_FARM" : "FARMING"
        EnterFarmRecovery(expectedGeneration, returnState,
            "target_lost_" actionMode)
        return true
    }
    State.statusLabel.Text := "●  作業対象を再検出中（"
        . Round(lostFor / 1000, 1) . "秒）"
    ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
    return true
}

RunFarmRecoveryCycle(expectedGeneration, expectedTaskId) {
    if StationaryOnlyEnabled() && StationaryRecover(expectedGeneration, expectedTaskId)
        return
    global State, Config
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
        return
    rewardReconciliation := IsObject(State.pendingFarmAttempt)
        && State.pendingFarmAttempt.progressCompleted
        && (State.pendingFarmAttempt.reconcileDeadline
            || FarmAttemptRequiresDurabilityHold(State.pendingFarmAttempt))
    if rewardReconciliation {
        State.statusLabel.Text := "●  遅延した実報酬を再照合中"
    } else {
        State.statusLabel.Text := "●  入力と画面を復旧準備中"
    }
    ReleaseAllInputs()
    if !ReleaseBackgroundTarget(true) {
        HandleFarmRecoveryPreflightFailure(expectedGeneration,
            expectedTaskId, "release_background_target", "INPUT_RELEASE")
        return
    }
    closeResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "close-inventory")
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
        return
    if closeResult != "CLOSED" {
        HandleFarmRecoveryPreflightFailure(expectedGeneration,
            expectedTaskId, "close_inventory", closeResult)
        return
    }
    State.recoveryPreflightFailures := 0
    ; A reward whose inventory delta is already frozen must finish its local WAL /
    ; outbox transaction even if the server epoch changes afterwards. It cannot be
    ; discarded as an unconfirmed game observation at this point.
    if rewardReconciliation
        && FarmAttemptRequiresDurabilityHold(State.pendingFarmAttempt) {
        HandlePendingFarmRewardReconciliation(expectedGeneration, expectedTaskId)
        return
    }
    if !ValidateServerEpochCheckpoint(expectedGeneration, "farm_recovery") {
        DiscardPendingFarmAttempt("reconcile_server_session_changed")
        StopAutomationWithFault("復旧中にサーバー再起動または切断を検知しました")
        return
    }
    if rewardReconciliation {
        HandlePendingFarmRewardReconciliation(expectedGeneration, expectedTaskId)
        return
    }
    if State.storagePending {
        snapshotResult := RunBackgroundBridgeCancelable(expectedGeneration,
            "inventory-snapshot")
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
            return
        if ParseInventorySnapshot(snapshotResult, &inventoryInfo) {
            RecordConfirmedInventory(inventoryInfo, "storage_recovery",
                expectedGeneration)
            ledgerApplied := 0
            remainingLedgerUnits := PositiveInventoryCountTotal(
                State.farmOutputLedger)
            if IsObject(State.storageDepositCheckpoint) {
                if !State.storageDepositCheckpoint.receiptVerified {
                    StopAutomationWithFault(
                        "荷台側の増加を証明する収納レシートがないため、遅延した所持品減少を採用せず停止しました",
                        "vehicle", "UNVERIFIED_STORAGE_RECEIPT")
                    return
                }
                if !ReconcileActiveStorageDepositCheckpoint(expectedGeneration,
                    inventoryInfo.items, &ledgerApplied,
                    &remainingLedgerUnits) {
                    StopAutomationWithFault(
                        "遅延した収納結果を確定報酬台帳と照合できないため停止しました",
                        "vehicle", "STORAGE_LEDGER_RECONCILE_FAILED")
                    return
                }
                if remainingLedgerUnits = 0 {
                    if !FinalizeVerifiedFarmOutputDeposit(expectedGeneration,
                        inventoryInfo) {
                        StopAutomationWithFault(
                            "遅延収納後の空台帳を確定できないため停止しました",
                            "vehicle", "STORAGE_LEDGER_RECONCILE_FAILED")
                        return
                    }
                } else if StorageDepositCheckpointReceiptRemaining(
                    State.storageDepositCheckpoint) = 0 {
                    ; Every unit in a trusted PARTIAL receipt is now reflected.
                    ; Retire it before the bounded recovery issues a new command
                    ; for only the still-authorized ledger remainder.
                    if !RetireCompletedStorageDepositCheckpoint(
                        expectedGeneration) {
                        StopAutomationWithFault(
                            "部分収納レシートを完了できないため停止しました",
                            "vehicle", "STORAGE_LEDGER_RECONCILE_FAILED")
                        return
                    }
                }
            }
            remainingDelta := remainingLedgerUnits > 0
            reduced := ledgerApplied > 0 || State.storageOutputsVerified
            stillFull := FarmModeNeedsStorage(State.runMode, inventoryInfo,
                Config.rawStoneItemName, State.inventoryBaselineWeight,
                &capacityReason, &freeWeight, &recoveryRawStoneCount)
            if recoveryRawStoneCount >= 0
                State.lastRawStoneCount := recoveryRawStoneCount
            WriteDiagnostic("FSM_STORAGE_RECOVERY ledgerApplied=" ledgerApplied
                " ledgerRemaining=" remainingLedgerUnits
                " outputsVerified=" (State.storageOutputsVerified ? 1 : 0)
                " full=" (stillFull ? 1 : 0)
                " atStorage=" (State.recoveryAtStorage ? 1 : 0))
            if !remainingDelta && !State.storageOutputsVerified {
                refillOnlyRecovery := IsVerifiedWashingRefillOnlyDeparture(
                    State.runMode, State.storagePending,
                    State.storageOutputsVerified, State.storageReason,
                    recoveryRawStoneCount)
                if !refillOnlyRecovery {
                    StopAutomationWithFault(
                        "収納できる確定作業報酬が台帳にないため、保護対象を動かさず停止しました",
                        "vehicle", "UNTRUSTED_STORAGE_BASELINE")
                    return
                }
            }
            if State.recoveryAtStorage && !remainingDelta
                && State.runMode != "washing" && stillFull {
                StopAutomationWithFault(
                    "作業報酬は収納済みですが、保護対象の持ち物で容量不足が続いています",
                    "vehicle", "PROTECTED_INVENTORY_FULL")
                return
            }
            storageRecoveryAction := StorageRecoverySnapshotAction(
                State.recoveryAtStorage, reduced, remainingDelta, stillFull,
                State.runMode, Config.rawStoneItemName != "")
            if storageRecoveryAction = "RETURN"
                || storageRecoveryAction = "REFILL" {
                ; The single checkpoint has consumed every exact late reduction once.
                ; Only now can the verified live snapshot become the next baseline.
                State.inventoryBaseline := inventoryInfo.items
                State.inventoryBaselineWeight := inventoryInfo.weight
                State.storagePreSnapshot := inventoryInfo
                State.storageOutputsVerified := true
                State.storageRefillVerified := false
                State.targetRecoveryAttempts := 0
                if storageRecoveryAction = "REFILL" {
                    ; Re-open the same verified storage only once to finish washing
                    ; input refill. This consumes the same bounded recovery slot as
                    ; every other storage retry.
                    if !TryClaimStorageRecoveryAttempt(expectedGeneration,
                        expectedTaskId) {
                        if !IsCurrentFarmTask(expectedGeneration,
                            expectedTaskId, "RECOVERY")
                            return
                        StopAutomationWithFault(
                            "収納復旧を1回試しても未洗浄石の補充を完了できないため停止しました",
                            "vehicle", "STORAGE_RECOVERY_EXHAUSTED")
                        return
                    }
                    TransitionFarmState("OPENING_STORAGE",
                        "遅延収納を確認。未洗浄石の補充を再開",
                        expectedGeneration, expectedTaskId)
                    RunLocalVehicleStorageCycle(expectedGeneration, true)
                } else
                    CompleteVerifiedStorageReturn(expectedGeneration)
                return
            }
            if !State.recoveryAtStorage && !remainingDelta && !stillFull {
                ; We are already back at the work point and capacity recovered by
                ; an externally completed/late operation. Rebase the delta and use
                ; the normal target recovery below; no vehicle return route exists.
                State.inventoryBaseline := inventoryInfo.items
                State.inventoryBaselineWeight := inventoryInfo.weight
                State.storagePending := false
                State.storageStartPending := false
                State.storagePreSnapshot := 0
                State.storageRecoveryAttempted := false
                State.capacityProbeFailures := 0
                WriteDiagnostic("FSM_STORAGE_RECOVERY clearedAtFarm=1")
            }
        } else {
            State.capacityProbeFailures += 1
            WriteDiagnostic("FSM_STORAGE_RECOVERY_SNAPSHOT_ERROR attempt="
                State.capacityProbeFailures " result=" snapshotResult)
            if State.capacityProbeFailures < 3 {
                State.statusLabel.Text := BuildFarmProgressStatus(
                    "●  収納復旧の所持品を再確認中（",
                    State.capacityProbeFailures, 3)
                ScheduleNext(expectedGeneration, 500)
                return
            }
        }
        if State.storagePending {
            ; Still full/unchanged (or three snapshots unavailable): remain in the
            ; storage closed loop. The normal storage cycle gets at most one clean
            ; recovery restart; a second failure is terminal, so no timer can loop
            ; forever and no Farm input can overlap the storage owner.
            State.capacityProbeFailures := 0
            atStorage := State.recoveryAtStorage
            if !TryClaimStorageRecoveryAttempt(expectedGeneration,
                expectedTaskId) {
                if !IsCurrentFarmTask(expectedGeneration, expectedTaskId,
                    "RECOVERY")
                    return
                StopAutomationWithFault(
                    "収納を1回復旧しても安全な完了を確認できないため停止しました",
                    "vehicle", "STORAGE_RECOVERY_EXHAUSTED")
                return
            }
            TransitionFarmState("OPENING_STORAGE", atStorage
                ? "収納地点で荷台を再確認" : "容量不足のまま荷台を再探索",
                expectedGeneration, expectedTaskId)
            RunLocalVehicleStorageCycle(expectedGeneration, atStorage)
            return
        }
    }
    if State.targetRecoveryAttempts >= 3 {
        restartReason := "target_not_found_after_three_view_recoveries"
        restarted := RestartFarmAfterRecoveryExhausted(expectedGeneration,
            restartReason)
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
            return
        if restarted
            return
        StopAutomationWithFault(
            "視点を含む一度の安全な再始動後も作業対象を確認できないため停止しました")
        return
    }
    cameraDispatched := Config.workViewLock
    if cameraDispatched && !MaintainBackgroundWorkView(expectedGeneration, true)
        return
    Critical "On"
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY") {
        Critical "Off"
        return
    }
    State.targetRecoveryAttempts += 1
    recoveryAttempt := State.targetRecoveryAttempts
    if cameraDispatched {
        State.statusLabel.Text := BuildFarmProgressStatus(
            "●  視点入力後の作業対象を確認中（", recoveryAttempt, 3)
    } else {
        State.statusLabel.Text := BuildFarmProgressStatus(
            "●  作業対象を自動復旧中（", recoveryAttempt, 3)
    }
    Critical "Off"
    ; 最初の2回は視点だけを検証します。3回目だけ境界付き位置補正へ進み、
    ; 1回の表示で複数のカメラpulseを重ねません。
    targetReady := cameraDispatched && recoveryAttempt < 3
        ? ProbeWorkTarget(State.runMode, expectedGeneration)
        : RecoverLocalWorkTarget(expectedGeneration, cameraDispatched)
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
        return
    if !targetReady {
        MarkWorkViewNoEffect(State.runMode, "recovery_probe",
            expectedGeneration)
        ScheduleNext(expectedGeneration, 650)
        return
    }
    State.targetLostSince := 0
    State.targetRecoveryAttempts := 0
    State.farmWatchdogAt := MonotonicMs()
    returnState := State.recoveryReturnState = "RESUMING_FARM"
        ? "RESUMING_FARM" : "FARMING"
    TransitionFarmState(returnState, "自動復旧完了: " State.recoveryReason,
        expectedGeneration, expectedTaskId)
    ScheduleNext(expectedGeneration, 100)
}

RecoveryRestartAllowed(restartCount, restartPending) {
    return restartCount < 1 && !restartPending
}

RecoveryPreflightAction(failureCount, restartCount, restartPending) {
    if failureCount < 3
        return "RETRY"
    return RecoveryRestartAllowed(restartCount, restartPending)
        ? "RESTART" : "STOP"
}

HandleFarmRecoveryPreflightFailure(expectedGeneration, expectedTaskId,
    reason, detail := "") {
    global State
    Critical "On"
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY") {
        Critical "Off"
        return true
    }
    State.recoveryPreflightFailures += 1
    failureCount := State.recoveryPreflightFailures
    restartCount := State.recoveryRestartCount
    restartPending := State.recoveryRestartPending
    Critical "Off"

    WriteDiagnostic("FARM_RECOVERY_PREFLIGHT_ERROR reason="
        . DiagnosticToken(reason) . " attempt=" . failureCount . "/3 detail="
        . DiagnosticToken(detail))
    action := RecoveryPreflightAction(failureCount, restartCount,
        restartPending)
    if action = "RETRY" {
        State.statusLabel.Text := BuildFarmProgressStatus(
            "●  復旧前の入力・画面解放を再確認中（", failureCount, 3)
        ScheduleNext(expectedGeneration, 500)
        return true
    }
    if action = "RESTART" {
        restarted := RestartFarmAfterRecoveryExhausted(expectedGeneration,
            "preflight_" reason)
        if restarted
            return true
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
            return true
    }
    if IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY") {
        StopAutomationWithFault(
            "入力・画面の解放を3回確認し、同モードを一度再始動しても復旧できないため停止しました",
            "overview", "RECOVERY_PREFLIGHT_EXHAUSTED")
    }
    return true
}

RestartFarmAfterRecoveryExhausted(expectedGeneration, reason) {
    global State
    expectedTaskId := 0
    runMode := ""
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsCurrentFarmTask(expectedGeneration, 0, "RECOVERY")
            return false
        if !RecoveryRestartAllowed(State.recoveryRestartCount,
            State.recoveryRestartPending)
            return false
        ; A proven reward is never discarded/replayed to recover a view. The WAL
        ; reconciliation path above owns it until the same event ID is durable.
        if FarmAttemptRequiresDurabilityHold(State.pendingFarmAttempt)
            return false
        State.recoveryRestartPending := true
        State.recoveryRestartCount += 1
        expectedTaskId := State.farmStateTaskId
        runMode := State.runMode
        WriteDiagnostic("FARM_RECOVERY_RESTART_BEGIN mode=" runMode
            " reason=" DiagnosticToken(reason))
    } finally LeaveMetagameOutboxCritical(criticalWasOn)

    ; This is an in-session dispatcher restart, not a new Farm/metagame session.
    ; Stable reward IDs and all pending completion evidence therefore remain intact.
    CancelActiveBridgeProcess()
    ReleaseAllInputs()
    targetReleased := ReleaseBackgroundTarget(true)
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
        return true
    closeResult := targetReleased
        ? RunBackgroundBridgeCancelable(expectedGeneration, "close-inventory")
        : "ERROR INPUT_RELEASE"
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
        return true
    if !targetReleased || closeResult != "CLOSED" {
        WriteDiagnostic("FARM_RECOVERY_RESTART_RELEASE_ERROR target="
            (targetReleased ? 1 : 0) " close=" DiagnosticToken(closeResult))
        return false
    }

    transitionOk := false
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, "RECOVERY")
            || !State.recoveryRestartPending || State.recoveryRestartCount != 1
            || State.runMode != runMode
            return true
        State.targetRecoveryAttempts := 0
        State.targetLostSince := 0
        State.workViewStatus := "UNKNOWN"
        State.lastWorkViewAt := 0
        State.lastWorkViewVerifiedAt := 0
        State.workViewFailures := 0
        State.workViewNoEffectCount := 0
        State.lastTargetProbeResult := ""
        State.lastTargetProbeFatal := false
        State.farmWatchdogAt := MonotonicMs()
        ResetWashCompletionRecoveryState()
        if runMode = "gold"
            ResetGoldRecoveryState()
        returnState := State.recoveryReturnState = "RESUMING_FARM"
            ? "RESUMING_FARM" : "FARMING"
        transitionOk := TransitionFarmState(returnState,
            "視点復旧上限から同モードを一度だけ安全再始動",
            expectedGeneration, expectedTaskId)
        if !transitionOk
            return false
        State.recoveryRestartPending := false
        State.statusLabel.Text := "●  入力を全解放し、" . BackgroundActionDisplayName(runMode)
            . "を一度だけ再始動します"
        WriteDiagnostic("FARM_RECOVERY_RESTARTED mode=" runMode
            " count=" State.recoveryRestartCount)
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    if !transitionOk
        return false
    ScheduleNext(expectedGeneration, 120)
    return true
}

MaintainBackgroundWorkView(expectedGeneration, force := false,
    ignoreVerifiedTarget := false) {
    if StationaryOnlyEnabled()
        return IsCurrentRun(expectedGeneration)
    global State, Config, LocalNav
    if State.runMode = "washing" && Config.washForwardCorrection {
        WriteDiagnostic("WASH_VIEW_PRESERVED generation=" expectedGeneration " camera_input=0")
        return IsCurrentRun(expectedGeneration)
    }
    if !Config.workViewLock
        return true
    now := MonotonicMs()
    ; TARGET_OK is a real NUI observation. Never apply periodic/forced relative
    ; mouse input while that observation is still valid; correction is event-driven
    ; only after an actual MISSING probe records targetLostSince.
    if State.workViewStatus = "TARGET_OK" && !State.targetLostSince
        && !ignoreVerifiedTarget
        return true
    if !force && State.workViewStatus != "WAIT_FG"
        && State.workViewStatus != "FAILED" && State.lastWorkViewAt
        && now - State.lastWorkViewAt < Config.workViewIntervalMs
        return true

    if !IsCurrentRun(expectedGeneration)
        return false

    ; FiveM/GTAのカメラは相対マウス軸です。前面時は物理的な
    ; SendInputを使い、別アプリが前面のバックグラウンド動作では
    ; DevConの期限付きlook_down routeを使います。後者もhelperが入力前後に
    ; 全解放し、呼び出し元が実targetを再観測してはじめて成功扱いします。
    if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd) {
        State.workViewStatus := "FAILED"
        State.workViewFailures += 1
        WriteDiagnostic("CAMERA_TARGET_WINDOW_MISSING failures="
            State.workViewFailures)
        if State.workViewFailures >= 3 {
            StopAutomationWithFault(
                "作業視点を確認できないため3回失敗後に安全停止しました")
            return false
        }
        State.statusLabel.Text := "●  FiveM画面を再確認中"
        ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
        return false
    }

    if !WinActive("ahk_id " State.targetHwnd) {
        if Config.backgroundMode && (force || State.targetLostSince) {
            return SendBackgroundCameraDown(expectedGeneration,
                Config.workViewDownPulseMs)
        }
        State.workViewStatus := "WAIT_FG"
        WriteDiagnostic("CAMERA_WAIT_FOREGROUND force=" (force ? 1 : 0))
        if force || State.targetLostSince {
            State.statusLabel.Text := "●  FiveMを前面にすると視点を自動復旧します"
            ScheduleNext(expectedGeneration, 300)
            return false
        }
        return true
    }

    ; ox_targetのカーソル状態が残ったままでは同じマウス入力がUIカーソルへ
    ; 消費されるため、所有中のtargetだけを先に解放します。
    released := ReleaseBackgroundTarget(false)
    if !IsCurrentRun(expectedGeneration)
        return false
    if !released {
        State.workViewStatus := "FAILED"
        State.workViewFailures += 1
        WriteDiagnostic("CAMERA_TARGET_RELEASE_ERROR failures="
            State.workViewFailures)
        if State.workViewFailures >= 3 {
            StopAutomationWithFault(
                "作業視点の入力を解放できないため3回失敗後に安全停止しました")
            return false
        }
        State.statusLabel.Text := "●  視点入力を再準備中"
        ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
        return false
    }

    if !WaitWhileReady(70, expectedGeneration) {
        if !IsCurrentRun(expectedGeneration)
            return false
        State.workViewStatus := "WAIT_FG"
        State.statusLabel.Text := "●  FiveMを前面にすると視点を自動復旧します"
        WriteDiagnostic("CAMERA_WAIT_FOREGROUND source=settle")
        ScheduleNext(expectedGeneration, 300)
        return false
    }
    direction := State.workViewDirection < 0 ? -1 : 1
    sent := SendForegroundCameraDown(expectedGeneration,
        Config.workViewDownPulseMs, Config.workViewMouseStep, direction)
    if !sent {
        if !IsCurrentRun(expectedGeneration)
            return false
        if State.targetHwnd && WinExist("ahk_id " State.targetHwnd)
            && !WinActive("ahk_id " State.targetHwnd) {
            State.workViewStatus := "WAIT_FG"
            State.statusLabel.Text := "●  FiveMを前面にすると視点を自動復旧します"
            WriteDiagnostic("CAMERA_WAIT_FOREGROUND source=pulse")
            ScheduleNext(expectedGeneration, 300)
            return false
        }
        State.workViewStatus := "FAILED"
        State.workViewFailures += 1
        WriteDiagnostic("CAMERA_INPUT_ERROR failures=" State.workViewFailures)
        if State.workViewFailures >= 3 {
            StopAutomationWithFault(
                "作業視点を動かせないため3回失敗後に安全停止しました")
            return false
        }
        State.statusLabel.Text := "●  作業視点を再調整中"
        ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
        return false
    }
    ; F9 can interrupt immediately after the pulse. Commit its unverified state
    ; atomically with the generation check so a stopped/new run is never overwritten.
    Critical "On"
    if !IsCurrentRun(expectedGeneration) {
        Critical "Off"
        return false
    }
    State.lastWorkViewAt := MonotonicMs()
    State.workViewStatus := "INPUT_SENT"
    runMode := State.runMode
    Critical "Off"
    WriteDiagnostic("CAMERA_INPUT_SENT adapter=sendinput-relative dy="
        (Config.workViewMouseStep * direction)
        " duration=" Config.workViewDownPulseMs
        " verified=0 mode=" runMode)
    return true
}

EnsureWorkViewDown(expectedGeneration, mode, force := false) {
    if StationaryOnlyEnabled()
        return IsCurrentRun(expectedGeneration)
    global State, Config
    Critical "On"
    if !WorkViewDownModeSupported(mode)
        || !IsCurrentRun(expectedGeneration) || State.runMode != mode {
        Critical "Off"
        return false
    }
    if !Config.workViewLock {
        Critical "Off"
        return true
    }
    ; Washing and gold-panning targets are below the character. A normal verified
    ; target suppresses periodic drift, but an explicit per-action alignment must
    ; still drive the pitch to GTA's lower clamp before this cycle's click.
    State.statusLabel.Text := "●  " . BackgroundActionDisplayName(mode)
        . "の視点を真下へ整えています"
    ; Recovery may temporarily reverse its exploratory direction. A normal washing /
    ; gold attempt always returns to the user's configured down direction.
    State.workViewDirection := Config.workViewMouseDirection
    Critical "Off"
    aligned := MaintainBackgroundWorkView(expectedGeneration, true, force)
    if !aligned || !IsCurrentRun(expectedGeneration)
        return false

    ; Input acceptance is not target proof. The immediately following try-washing /
    ; try-gold helper performs target discovery and click in one bound CDP session,
    ; so a separate ProbeWorkTarget here only duplicated the expensive frame scan.
    WriteDiagnostic("WORK_VIEW_DOWN mode=" mode " force=" (force ? 1 : 0)
        " verified=0 proof=deferred_to_try adapter="
        (WinActive("ahk_id " State.targetHwnd)
            ? "sendinput-relative" : "devcon-route"))
    return true
}

SendBackgroundCameraDown(expectedGeneration, durationMs) {
    if StationaryOnlyEnabled()
        return false
    global State, Config
    if !Config.backgroundMode || !IsCurrentRun(expectedGeneration)
        return false
    portReady := EnsureDevConPort(false)
    if !IsCurrentRun(expectedGeneration)
        return false
    if !portReady {
        Critical "On"
        if !IsCurrentRun(expectedGeneration) {
            Critical "Off"
            return false
        }
        State.workViewStatus := "FAILED"
        State.workViewFailures += 1
        failures := State.workViewFailures
        Critical "Off"
        WriteDiagnostic("CAMERA_BACKGROUND_PORT_ERROR failures="
            failures)
        return HandleWorkViewDispatchFailure(expectedGeneration, failures,
            "background_view_port_unavailable")
    }
    port := State.lastDevConPort
    route := BackgroundCameraDownRoute(durationMs)
    duration := SubStr(route, 1, InStr(route, ":") - 1) + 0
    result := RunBackgroundBridgeCancelable(expectedGeneration,
        "play-route-health", port, route, State.serverEpoch)
    if !IsCurrentRun(expectedGeneration)
        return false
    if result != "ROUTE " port " " duration {
        Critical "On"
        if !IsCurrentRun(expectedGeneration) {
            Critical "Off"
            return false
        }
        State.lastDevConPort := 0
        State.workViewStatus := "FAILED"
        State.workViewFailures += 1
        failures := State.workViewFailures
        Critical "Off"
        WriteDiagnostic("CAMERA_BACKGROUND_INPUT_ERROR failures="
            failures " result=" DiagnosticToken(result))
        return HandleWorkViewDispatchFailure(expectedGeneration, failures,
            "background_view_input_failed")
    }
    Critical "On"
    if !IsCurrentRun(expectedGeneration) {
        Critical "Off"
        return false
    }
    State.lastWorkViewAt := MonotonicMs()
    State.workViewStatus := "INPUT_SENT"
    runMode := State.runMode
    Critical "Off"
    WriteDiagnostic("CAMERA_INPUT_SENT adapter=devcon-route mask=32 duration="
        duration " verified=0 mode=" runMode)
    return true
}

HandleWorkViewDispatchFailure(expectedGeneration, failures, reason) {
    global State, Config
    if failures < 3 {
        ScheduleNext(expectedGeneration, Config.notFoundRetryMs)
        return false
    }
    ; Three failed dispatches inside RECOVERY must reach the same bounded-restart
    ; gate as three successful-but-ineffective camera pulses. Do not recursively
    ; re-enter RECOVERY with a new task forever when DevCon itself is unavailable.
    Critical "On"
    if !IsCurrentRun(expectedGeneration) {
        Critical "Off"
        return false
    }
    alreadyRecovering := State.farmState = "RECOVERY"
    returnState := State.farmState = "RESUMING_FARM"
        ? "RESUMING_FARM" : "FARMING"
    if alreadyRecovering
        State.targetRecoveryAttempts := Max(3, State.targetRecoveryAttempts)
    Critical "Off"
    if alreadyRecovering
        ScheduleNext(expectedGeneration, 1)
    else
        EnterFarmRecovery(expectedGeneration, returnState, reason)
    return false
}

SendForegroundCameraDown(expectedGeneration, durationMs, stepPixels, direction := -1) {
    if StationaryOnlyEnabled()
        return false
    global State
    duration := Max(100, Min(1500, Round(durationMs)))
    step := Max(4, Min(80, Round(stepPixels)))
    direction := direction < 0 ? -1 : 1
    deadline := MonotonicMs() + duration
    sentCount := 0

    while MonotonicMs() < deadline {
        ; Keep the final identity/foreground check and the physical input in one
        ; uninterruptible commit. F9 is serviced as soon as the input call returns.
        Critical "On"
        if !IsTargetForeground(expectedGeneration) {
            Critical "Off"
            return false
        }
        ; 初期方向は実機検証済みの負Yです。対象が戻らないときは方向を
        ; 反転して再試行するため、ゲーム側のマウス反転設定にも追従します。
        sent := SendRelativeMouseDelta(0, step * direction)
        Critical "Off"
        if !sent
            return false
        sentCount += 1
        if !WaitWhileReady(16, expectedGeneration)
            return false
    }
    return sentCount > 0 && IsTargetForeground(expectedGeneration)
}

SendRelativeMouseDelta(deltaX, deltaY) {
    if StationaryOnlyEnabled()
        return false
    ; INPUT union is aligned to pointer size: MOUSEINPUT begins at 8 bytes on
    ; 64-bit and 4 bytes on 32-bit AutoHotkey.
    inputSize := A_PtrSize = 8 ? 40 : 28
    mouseOffset := A_PtrSize = 8 ? 8 : 4
    input := Buffer(inputSize, 0)
    NumPut "UInt", 0, input, 0
    NumPut "Int", Round(deltaX), input, mouseOffset
    NumPut "Int", Round(deltaY), input, mouseOffset + 4
    NumPut "UInt", 0x0001, input, mouseOffset + 12
    return DllCall("user32\SendInput", "UInt", 1, "Ptr", input.Ptr,
        "Int", inputSize, "UInt") = 1
}

ConfirmWorkViewTarget(actionMode, source := "target", expectedGeneration := 0) {
    global State
    ; TARGET_OK is an observed NUI result. Guard its state commit so a late probe or
    ; click from the generation stopped by F9 cannot resurrect a successful status.
    Critical "On"
    if expectedGeneration && !IsCurrentRun(expectedGeneration) {
        Critical "Off"
        return false
    }
    State.workViewStatus := "TARGET_OK"
    State.lastWorkViewVerifiedAt := MonotonicMs()
    State.workViewFailures := 0
    State.workViewNoEffectCount := 0
    State.targetLostSince := 0
    dispatchAge := State.lastWorkViewAt
        ? Max(0, MonotonicMs() - State.lastWorkViewAt) : -1
    Critical "Off"
    WriteDiagnostic("CAMERA_TARGET_CONFIRMED source=" DiagnosticToken(source)
        " mode=" DiagnosticToken(actionMode)
        " dispatchAge=" dispatchAge)
    return true
}

MarkWorkViewNoEffect(actionMode, source := "target_missing",
    expectedGeneration := 0) {
    global State
    Critical "On"
    if expectedGeneration && !IsCurrentRun(expectedGeneration) {
        Critical "Off"
        return false
    }
    if State.workViewStatus = "INPUT_SENT" {
        State.workViewStatus := "FAILED"
        State.workViewNoEffectCount += 1
        State.workViewDirection *= -1
        noEffectCount := State.workViewNoEffectCount
        nextDirection := State.workViewDirection
        Critical "Off"
        WriteDiagnostic("CAMERA_NO_EFFECT source=" DiagnosticToken(source)
            " mode=" DiagnosticToken(actionMode)
            " count=" noEffectCount
            " nextDirection=" nextDirection)
        return true
    }
    Critical "Off"
    return false
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

BackgroundActionCommandToken(actionMode) {
    return actionMode = "washing" ? "wash"
        : actionMode = "gold" ? "gold"
        : actionMode = "mining" ? "mine" : ""
}

BackgroundActionResultToken(actionMode) {
    return actionMode = "washing" ? "WASH"
        : actionMode = "gold" ? "GOLD"
        : actionMode = "mining" ? "MINE" : ""
}

BackgroundActionDisplayName(actionMode) {
    return actionMode = "washing" ? "洗浄"
        : actionMode = "gold" ? "砂金採り" : "採掘"
}

ResetActionCompletionState() {
    global State
    State.actionCompletionPending := false
    State.actionCompletionMode := ""
    State.actionDispatchUncertain := false
}

BeginActionCompletionWait(actionMode, dispatchUncertain := false) {
    global State
    State.actionCompletionPending := true
    State.actionCompletionMode := actionMode
    State.actionDispatchUncertain := dispatchUncertain
    ; 再出現猶予が必要な収納・食事だけはクリック起点で計算します。
    ; 完了時刻で上書きすると、完了検知後にも同じ待ち時間が丸ごと加算されます。
    State.lastMineAt := MonotonicMs()
    State.nextActionAt := 0
}

ParseActionCompletionResult(result, expectedMode, &elapsedMs) {
    elapsedMs := 0
    expectedToken := BackgroundActionResultToken(expectedMode)
    if !expectedToken
        return false
    if !RegExMatch(result,
        "^ACTION_COMPLETED (MINE|WASH|GOLD) ([0-9]{1,5})$", &parts)
        return false
    if StrCompare(parts[1], expectedToken, true) != 0
        return false
    try elapsedMs := Integer(parts[2])
    catch
        return false
    return elapsedMs >= 0 && elapsedMs <= 30000
}

IsActionCompletionBridgeResult(result, expectedMode) {
    if ParseActionCompletionResult(result, expectedMode, &elapsedMs)
        return true
    resultToken := BackgroundActionResultToken(expectedMode)
    if !resultToken
        return false
    return result = "ERROR " resultToken "_NOT_STARTED"
        || result = "ERROR " resultToken "_COMPLETION_TIMEOUT"
        || result = "ERROR " resultToken "_PROGRESS_UNAVAILABLE"
}

IsWashCompletionRecoveryState(farmState) {
    return farmState = "WASH_SETTLING"
        || farmState = "WASH_CORRECTING"
}

ResetWashCompletionRecoveryState() {
    global State
    State.washRecoveryGeneration := 0
    State.washRecoveryAttemptId := 0
    State.washSettleDeadline := 0
    State.washCorrectionInFlight := false
    State.washCorrectionSent := false
    State.washCameraRestoreSent := false
    State.washVerificationAttempts := 0
}

BeginWashCompletionRecovery(expectedGeneration, attemptId) {
    global State, Config, LocalNav
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    transitionFailed := false
    try {
        if !IsCurrentRun(expectedGeneration) || State.runMode != "washing"
            || attemptId < 1
            return false
        if !TransitionFarmState("WASH_SETTLING",
            "洗浄報酬確認後の後退停止待ち", expectedGeneration) {
            transitionFailed := true
        } else {
            taskId := State.farmStateTaskId
            settleDelay := StationaryOnlyEnabled() ? 1 : Config.washForwardCorrection ? 1 : Config.washPostCompletionSettleMs
            settleDeadline := MonotonicMs() + settleDelay
            if !IsCurrentFarmTask(expectedGeneration, taskId, "WASH_SETTLING")
                return false
            State.washRecoveryGeneration := expectedGeneration
            State.washRecoveryAttemptId := attemptId
            State.washSettleDeadline := settleDeadline
            State.washCorrectionInFlight := false
            State.washCorrectionSent := false
            State.washCameraRestoreSent := false
            State.washVerificationAttempts := 0
        }
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
    if transitionFailed {
        StopAutomationWithFault(
            "洗浄完了後の静止待ちへ移れないため安全停止しました")
        return false
    }
    State.statusLabel.Text := Config.washForwardCorrection
        ? "●  前進補正ON：洗浄完了。静止確認後に微小後退を測ります（W未送信）"
        : "●  前進補正OFF：この設定では洗浄後にWを送りません"
    LocalNav.washFeedback := State.statusLabel.Text
    QueueWebUiFlush(true)
    WriteDiagnostic("attempt=" attemptId " WASH_SETTLE_BEGIN delay="
        settleDelay " deadline=" settleDeadline " observed=" Config.washForwardCorrection)
    ScheduleNext(expectedGeneration, StationaryOnlyEnabled() ? 1 : Config.washForwardCorrection ? 1 : Config.washPostCompletionSettleMs)
    return true
}

PerformWashCompletionCorrection(expectedGeneration, expectedTaskId,
    expectedAttemptId) {
    if StationaryOnlyEnabled()
        return IsCurrentRun(expectedGeneration)
    global State, Config, LocalNav
    if !Config.washForwardCorrection
        return true
    if !IsTargetForeground(expectedGeneration) {
        State.statusLabel.Text := "●  石洗いの位置確認待ち。FiveMを前面にしてください"
        ScheduleNext(expectedGeneration, 300)
        return false
    }
    Critical "On"
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId,
        "WASH_CORRECTING")
        || State.washRecoveryGeneration != expectedGeneration
        || State.washRecoveryAttemptId != expectedAttemptId {
        Critical "Off"
        return false
    }
    if State.washCorrectionSent {
        Critical "Off"
        return !State.washCorrectionInFlight
    }
    if State.washCorrectionInFlight {
        Critical "Off"
        return false
    }
    State.washCorrectionInFlight := true
    ; This latches the entire observed transaction, not each native micro-pulse.
    ; Only that helper can take another measured step within its small budget.
    State.washCorrectionSent := true
    Critical "Off"
    if LocalNav.washAnchorGeneration != expectedGeneration
        return FailObservedWash(expectedGeneration, "ERROR ANCHOR_MISSING")
    if IsNearbyWashService(expectedGeneration)
        return PerformNearbyWashService(expectedGeneration, expectedTaskId, expectedAttemptId)

    State.statusLabel.Text := "●  画面で静止・位置ずれ・前進の効果を確認しています"
    UpdateRuntimeStatusOverlay()
    WriteDiagnostic("attempt=" expectedAttemptId " WASH_VISUAL_BEGIN settle=observed input=foreground_scancode")
    LocalNav.washRecoveryOutcome := "VISUAL_PENDING"
    correctionOperation := ObservedWashCorrectionOperation(expectedGeneration)
    WriteDiagnostic("WASH_CORRECTION_PROFILE operation=" correctionOperation)
    nudgeResult := RunObservedWashHelper(correctionOperation, expectedGeneration)
    visualOk := RegExMatch(nudgeResult, "^WASH_STABLE (\d+) (\d+) (\d+) (\d+)$", &observed)
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId,
            "WASH_CORRECTING")
            || State.washRecoveryGeneration != expectedGeneration
            || State.washRecoveryAttemptId != expectedAttemptId
            return false
        State.washCorrectionInFlight := false
        if visualOk {
            LocalNav.washRecoveryOutcome := "VISUAL_VERIFIED"
            if observed[1] + 0 > 0 {
                State.nudges += 1
                State.mealLabel.Text := "画面確認済み補正`n" State.nudges
            }
            LocalNav.washFeedback := (correctionOperation = "wash-maintain" ? "荷台前・微小後退補正" : "通常補正")
                . " / " (observed[1] + 0 > 0 ? "前進効果確認" : "許容範囲内のためW未送信")
                . " / W入力 " observed[1] "回・計" observed[2] "ms / ずれ "
                . (observed[3] / 1000) "px / 確認時間 " observed[4] "ms"
            WriteDiagnostic("attempt=" expectedAttemptId " WASH_VISUAL_VERIFIED " nudgeResult)
        }
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    if !visualOk
        return FailObservedWash(expectedGeneration, nudgeResult)
    ; Stable scene was independently checked after the last input. No additional
    ; unconditional 2-second delay or camera sweep is added here.
    return IsCurrentRun(expectedGeneration)
}

RunWashCompletionRecoveryCycle(expectedGeneration, expectedTaskId) {
    global State, Config
    currentState := State.farmState
    if !IsWashCompletionRecoveryState(currentState)
        || !IsCurrentFarmTask(expectedGeneration, expectedTaskId, currentState)
        return
    if State.runMode != "washing"
        || State.washRecoveryGeneration != expectedGeneration
        || State.washRecoveryAttemptId < 1 {
        StopAutomationWithFault(
            "洗浄完了後の復旧状態が一致しないため安全停止しました")
        return
    }
    attemptId := State.washRecoveryAttemptId
    WriteDiagnostic("WASH_RECOVERY_TICK phase=" currentState " correction=" Config.washForwardCorrection
        " stateAgeMs=" (MonotonicMs() - State.farmStateEnteredAt) " attempt=" attemptId)

    if currentState = "WASH_SETTLING" {
        remaining := State.washSettleDeadline - MonotonicMs()
        if remaining > 0 {
            State.statusLabel.Text := (Config.washForwardCorrection ? "●  前進補正ON：開始待ち（" : "●  前進補正OFF：Wを送らず待機（")
                . (Ceil(remaining / 100) / 10) . "秒）"
            ScheduleNext(expectedGeneration, remaining)
            return
        }
        WriteDiagnostic("attempt=" attemptId " WASH_SETTLE_DONE")
        if Config.washForwardCorrection {
            if !TransitionFarmState("WASH_CORRECTING",
                "洗浄後退停止後の前進補正", expectedGeneration,
                expectedTaskId)
                return
            ScheduleNext(expectedGeneration, 1)
            return
        }
        ResumeAfterWashCompletionRecovery(expectedGeneration,
            expectedTaskId, "WASH_SETTLING", attemptId)
        return
    }

    if currentState = "WASH_CORRECTING" {
        if !PerformWashCompletionCorrection(expectedGeneration,
            expectedTaskId, attemptId)
            return
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId,
            "WASH_CORRECTING")
            return
        ResumeAfterWashCompletionRecovery(expectedGeneration,
            expectedTaskId, "WASH_CORRECTING", attemptId)
        return
    }

}

ResumeAfterWashCompletionRecovery(expectedGeneration, expectedTaskId,
    expectedState, attemptId) {
    global State, Config, LocalNav
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId, expectedState)
        return false

    ; The final raw stone legitimately removes the interaction.  Route to the
    ; existing refill workflow instead of waiting for a button that cannot exist.
    if Config.rawStoneItemName && State.lastRawStoneCount = 0 {
        WriteDiagnostic("WASH_INPUT_EMPTY_AFTER_CORRECTION item="
            . Config.rawStoneItemName . " next=CHECKING_INVENTORY")
        ResetWashCompletionRecoveryState()
        if !Config.vehicleStorageEnabled {
            StopAutomationWithFault(
                "未洗浄の石がなくなりましたが、自動収納が無効なため停止しました",
                "vehicle", "RAW_STONE_NOT_FOUND")
            return false
        }
        State.nextCapacityCheckAt := 0
        if !TransitionFarmState("CHECKING_INVENTORY",
            "未洗浄石0を確認。収納と補充へ移行", expectedGeneration,
            expectedTaskId)
            return false
        MaybeHandleVehicleCapacity(expectedGeneration)
        return true
    }

    ; try-washing owns the next target wait, click and progress observation in one
    ; CDP session.  A separate probe here only duplicated work and added seconds.
    if !TransitionFarmState("FARMING",
        "洗浄後の継続条件を確認。次の対象を即時監視", expectedGeneration,
        expectedTaskId)
        return false
    ResetWashCompletionRecoveryState()
    State.targetLostSince := 0
    State.targetRecoveryAttempts := 0
    State.statusLabel.Text := LocalNav.HasOwnProp("washRecoveryOutcome")
        && LocalNav.washRecoveryOutcome = "NEARBY_WASH_READY"
        ? "●  荷台前の操作範囲を確認。次の石洗いを開始します"
        : "●  作業状態を確認。移動せず次の石洗いへ"
    WriteDiagnostic("attempt=" attemptId " WASH_RECOVERY_DIRECT_RESUME")
    ScheduleNext(expectedGeneration, 1)
    return true
}

CompleteVerifiedFarmReward(expectedGeneration, actionMode, completionAt,
    completionElapsedMs, completionWasBundled, confirmedInfo, rewardReason) {
    global State, Config
    if !IsCurrentRun(expectedGeneration)
        || !IsSupportedStoneActivityMode(actionMode)
        || State.runMode != actionMode
        return false
    attempt := State.pendingFarmAttempt
    if !FarmAttemptCanFinalize(attempt, expectedGeneration, actionMode,
        confirmedInfo)
        return false
    attemptId := attempt.attemptId
    completedAtUnixMs := attempt.HasOwnProp("rewardConfirmedAtUnixMs")
        ? attempt.rewardConfirmedAtUnixMs : 0
    stableEventId := attempt.HasOwnProp("rewardEventId")
        ? attempt.rewardEventId : ""
    rewardSessionId := attempt.HasOwnProp("rewardSessionId")
        ? attempt.rewardSessionId : ""
    snapshotRevision := IsObject(attempt.rewardConfirmedInfo)
        ? attempt.rewardConfirmedInfo.revision : 0
    if completedAtUnixMs < 1 || !stableEventId || !rewardSessionId
        || snapshotRevision != confirmedInfo.revision
        return false
    ; Durable STONE membership is the commit point for a verified Farm reward.
    ; Until it succeeds, keep the exact completed attempt and do not advance any
    ; UI/stat counter or discard the evidence required for an identical retry.
    if !WaitForVerifiedFarmRewardDurability(expectedGeneration, actionMode,
        attemptId, snapshotRevision, completedAtUnixMs, stableEventId,
        rewardSessionId)
        return false
    ; The durability wait is intentionally interruptible. Re-enter Critical and
    ; validate the exact frozen attempt before one atomic visible-state commit, so
    ; a late callback from F9 -> F8 cannot increment/discard the new run.
    startWashRecovery := false
    washBatchCompleted := false
    learnedRawStoneName := ""
    ledgerAddedUnits := 0
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsCurrentRun(expectedGeneration)
            || !IsObject(State.pendingFarmAttempt)
            return false
        attempt := State.pendingFarmAttempt
        if attempt.generation != expectedGeneration
            || attempt.actionMode != actionMode
            || attempt.attemptId != attemptId
            || attempt.rewardSessionId != rewardSessionId
            || attempt.rewardEventId != stableEventId
            || attempt.rewardConfirmedAtUnixMs != completedAtUnixMs
            || !FarmAttemptCanFinalize(attempt, expectedGeneration, actionMode,
                attempt.rewardConfirmedInfo)
            || !VerifiedFarmRewardIsDurable(stableEventId)
            return false
        confirmedInfo := attempt.rewardConfirmedInfo
        rewardReason := attempt.rewardConfirmationReason
        if !attempt.HasOwnProp("outputLedgerCommitted")
            attempt.outputLedgerCommitted := false
        if !attempt.outputLedgerCommitted {
            if !AccumulateVerifiedFarmOutputLedger(State.farmOutputLedger,
                attempt.before.items, confirmedInfo.items, &ledgerAddedUnits)
                return false
            attempt.outputLedgerCommitted := true
        }
        confirmedAt := MonotonicMs()
        ResetActionCompletionState()
        State.successes += 1
        State.farmWatchdogAt := confirmedAt
        State.lastVerifiedRewardAt := confirmedAt
        State.watchdogRecoveryCount := 0
        State.rewardReconcileAttempts := 0
        if Config.vehicleStorageEnabled
            State.nextCapacityCheckAt := 0
        State.targetLostSince := 0
        State.targetRecoveryAttempts := 0
        ; A verified reward ends the current no-result recovery episode. A later,
        ; independent target loss may use its own single safe dispatcher restart.
        State.recoveryRestartCount := 0
        State.recoveryRestartPending := false

        ; Learn the real unwashed-stone item id only from one verified washing
        ; transaction. A unique decrease in the before/after snapshots is stronger
        ; evidence than a translated label or a guessed server-specific item name.
        if actionMode = "washing" {
            learnedRawStoneName := LearnRawStoneItemFromVerifiedWash(
                attempt.before, confirmedInfo)
            if Config.rawStoneItemName {
                rawStoneCountBefore := InventorySpecNameCount(
                    attempt.before.items, Config.rawStoneItemName)
                washBatchCompleted := WashingBatchWasCompleted(
                    attempt.before.items, confirmedInfo.items,
                    Config.rawStoneItemName)
                if washBatchCompleted
                    WriteDiagnostic("WASH_ALL_INPUTS_CONSUMED item="
                        Config.rawStoneItemName " before=" rawStoneCountBefore)
            }
        }

        DiscardPendingFarmAttempt("reward_confirmed")

        wasResume := State.resumeVerificationPending
        if wasResume {
            State.resumeVerificationPending := false
            ObserveStorageCycle(expectedGeneration, "resumed_verified")
        }
        if State.farmState = "RECOVERY" || State.farmState = "RESUMING_FARM" {
            transitionReason := wasResume
                ? "収納後の実報酬を確認: " rewardReason
                : "遅延した実報酬を確認: " rewardReason
            if wasResume
                TransitionFarmState("VERIFY_FARM_RESUMED", transitionReason,
                    expectedGeneration, 0, true)
            if !TransitionFarmState("FARMING", transitionReason,
                expectedGeneration)
                return false
        }
        ; bridgeが返却直前に同じCDP接続で3つのNUI frameを照合済みです。
        ; 直後に別helperで同じhealthを重ねず、次の定期確認まで有効扱いにします。
        State.serverHealthFailures := 0
        State.nextServerHealthAt := confirmedAt + Config.serverHealthIntervalMs
        State.countLabel.Text := actionMode = "washing"
            ? "石洗い回数`n" State.successes
            : actionMode = "gold" ? "砂金採り回数`n" State.successes
            : "採掘回数`n" State.successes
        if actionMode = "gold"
            ResetGoldRecoveryState()
        WriteDiagnostic("attempt=" State.attempts " ACTION_PROGRESS_DONE mode="
            actionMode " elapsed=" completionElapsedMs
            " bundled=" completionWasBundled
            " reward=" rewardReason " revision=" confirmedInfo.revision
            " ledgerAdded=" ledgerAddedUnits " ledgerPending="
            PositiveInventoryCountTotal(State.farmOutputLedger)
            " reconcile=" (completionAt < confirmedAt - 1000 ? 1 : 0)
            " clickAge=" (State.lastMineAt ? confirmedAt - State.lastMineAt : -1))
        startWashRecovery := actionMode = "washing"
        if !startWashRecovery
            State.statusLabel.Text := "●  " BackgroundActionDisplayName(actionMode)
                . "完了。次の作業を確認します"
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    if learnedRawStoneName {
        try {
            SaveAllSettingsAtomically()
            WriteDiagnostic("WASH_RAW_STONE_SAVED item=" learnedRawStoneName)
        } catch as err {
            ; Keep the verified in-memory identity for this run, but make persistence
            ; failure explicit. It must not roll back or duplicate a durable reward.
            WriteDiagnostic("WASH_RAW_STONE_SAVE_ERROR=" DiagnosticToken(err.Message))
        }
    }
    ; Timer/input side effects happen after the atomic visible commit. Both paths
    ; revalidate generation ownership, so an intervening F9 cannot touch a new run.
    NotifyExeActionComplete(expectedGeneration, actionMode, attemptId)
    if startWashRecovery {
        recoveryStarted := BeginWashCompletionRecovery(expectedGeneration,
            attemptId)
        if washBatchCompleted && IsCurrentRun(expectedGeneration) {
            State.statusLabel.Text := "●  持っている石を全部洗い終わりました"
            NotifyExeBatchComplete(expectedGeneration, "washing")
        }
        return recoveryStarted
    }
    if !IsCurrentRun(expectedGeneration)
        return false
    ScheduleNext(expectedGeneration, 1)
    return true
}

WaitPendingBackgroundActionCompletion(expectedGeneration, suppliedResult := "") {
    global State, Config
    if !IsCurrentRun(expectedGeneration) || !State.actionCompletionPending
        return
    actionMode := State.actionCompletionMode
    commandToken := BackgroundActionCommandToken(actionMode)
    resultToken := BackgroundActionResultToken(actionMode)
    if !commandToken || !resultToken || actionMode != State.runMode {
        StopAutomationWithFault(
            "作業完了の内部状態が一致しないため安全停止しました")
        return
    }

    displayName := BackgroundActionDisplayName(actionMode)
    dispatchUncertain := State.actionDispatchUncertain
    State.statusLabel.Text := "●  " displayName "完了を確認中"
    completionWasBundled := suppliedResult != ""
    completionResult := completionWasBundled ? suppliedResult
        : RunBackgroundBridgeCancelable(expectedGeneration,
            "wait-action-completion", commandToken, State.serverEpoch)
    if !IsCurrentRun(expectedGeneration)
        return
    if ParseActionCompletionResult(completionResult, actionMode,
        &completionElapsedMs) {
        completionAt := MonotonicMs()
        if completionWasBundled
            State.lastMineAt := Max(1, completionAt - completionElapsedMs)
        if !IsObject(State.pendingFarmAttempt)
            || !State.pendingFarmAttempt.clicked {
            ResetActionCompletionState()
            StopAutomationWithFault(
                displayName "の報酬照合元がないため安全停止しました")
            return
        }
        attemptId := State.pendingFarmAttempt.attemptId
        if !ConfirmPendingFarmReward(expectedGeneration, actionMode,
            &confirmedInfo, &rewardReason) {
            BeginPendingFarmRewardReconciliation(expectedGeneration, actionMode,
                completionAt, completionElapsedMs, completionWasBundled)
            return
        }
        ; progress完了だけではなく、NUIの個数/重量増加を確認したこの地点だけを
        ; 1回の実績と再開成功として扱います。
        CompleteVerifiedFarmReward(expectedGeneration, actionMode, completionAt,
            completionElapsedMs, completionWasBundled, confirmedInfo, rewardReason)
        return
    }

    WriteDiagnostic("attempt=" State.attempts " ACTION_PROGRESS_ERROR mode="
        actionMode " bundled=" completionWasBundled " result=" completionResult)
    if completionResult = "ERROR SERVER_SESSION_CHANGED" {
        DiscardPendingFarmAttempt("server_session_changed")
        StopAutomationWithFault(
            "サーバー再起動または再接続を検知したため自動停止しました")
        return
    }
    expectedPrefix := "ERROR " resultToken "_"
    if completionResult = expectedPrefix "NOT_STARTED" {
        ; The bundled helper pre-opens its progress frame. Its NOT_STARTED result
        ; is the only case where absence is authoritative enough to reselect.
        if completionWasBundled && !dispatchUncertain {
            ResetActionCompletionState()
            DiscardPendingFarmAttempt("action_not_started_confirmed")
            State.lastMineAt := 0
            returnState := State.farmState = "RESUMING_FARM"
                ? "RESUMING_FARM" : "FARMING"
            EnterFarmRecovery(expectedGeneration, returnState,
                actionMode "_not_started")
            return
        }
        ; A standalone monitor began after dispatch. It may have missed the whole
        ; progress bar, so preserve the baseline and reconcile inventory without a
        ; second click. A real late reward can still complete RESUMING_FARM.
        if BeginPendingFarmRewardReconciliation(expectedGeneration, actionMode,
            MonotonicMs(), 0, false)
            return
        DiscardPendingFarmAttempt("action_not_started_unrecoverable")
        StopAutomationWithFault(
            displayName "を開始したか確認できないため安全停止しました")
        return
    }
    if completionResult = expectedPrefix "COMPLETION_TIMEOUT" {
        if BeginPendingFarmRewardReconciliation(expectedGeneration, actionMode,
            MonotonicMs(), 0, completionWasBundled)
            return
        DiscardPendingFarmAttempt("completion_timeout")
        StopAutomationWithFault(
            displayName "の進捗が完了しないため安全停止しました")
        return
    }
    if completionResult = expectedPrefix "PROGRESS_UNAVAILABLE" {
        if BeginPendingFarmRewardReconciliation(expectedGeneration, actionMode,
            MonotonicMs(), 0, completionWasBundled)
            return
        DiscardPendingFarmAttempt("progress_unavailable")
        StopAutomationWithFault(
            displayName "の進捗を確認できないため安全停止しました")
        return
    }
    ; helper起動失敗や結果ファイル欠落も、実行済みか否かを区別できません。
    ; pendingのまま再監視・再クリックせず、二重操作を避けて停止します。
    if BeginPendingFarmRewardReconciliation(expectedGeneration, actionMode,
        MonotonicMs(), 0, completionWasBundled)
        return
    DiscardPendingFarmAttempt("completion_unknown")
    StopAutomationWithFault(
        displayName "完了の結果を確認できないため安全停止しました")
}

WashAttemptBackground(expectedGeneration) {
    global State, Config
    if StationaryOnlyEnabled() && !FastWashModeEnabled()
        && !WaitStationaryTaskReady(expectedGeneration)
        return
    if !IsCurrentRun(expectedGeneration)
        return
    State.timerFn := 0
    if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd) {
        StopMining()
        State.statusLabel.Text := "●  FiveMが終了したため停止"
        return
    }
    if !EnsureObservedWashAnchor(expectedGeneration)
        return
    State.attempts += 1
    if !CaptureFarmAttemptBaseline(expectedGeneration, "washing") {
        EnterFarmRecovery(expectedGeneration,
            State.farmState = "RESUMING_FARM" ? "RESUMING_FARM" : "FARMING",
            "wash_reward_baseline_unavailable")
        return
    }
    ; Observed correction preserves the captured camera. The legacy view-only
    ; mode remains opt-out; never pitch-clamp the visual anchor on every attempt.
    if !Config.washForwardCorrection && !EnsureWorkViewDown(expectedGeneration, "washing", true) {
        if IsCurrentRun(expectedGeneration)
            DiscardPendingFarmAttempt("washing_view_down_failed")
        return
    }
    State.statusLabel.Text := "●  「石を洗う」を確認中"
    dispatchStartedAt := MonotonicMs()
    WriteDiagnostic("WASH_DISPATCH_BEGIN sinceRewardMs=" (State.lastVerifiedRewardAt ? dispatchStartedAt-State.lastVerifiedRewardAt : -1))
    clickResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "try-washing", State.serverEpoch, (State.lastDevConPort = 29200 || State.lastDevConPort = 29300 ? State.lastDevConPort : 0))
    if !IsCurrentRun(expectedGeneration)
        return
    WriteDiagnostic("WASH_DISPATCH_END elapsedMs=" (MonotonicMs()-dispatchStartedAt))
    WriteDiagnostic("attempt=" State.attempts " WASH_TRY=" clickResult)
    if IsActionCompletionBridgeResult(clickResult, "washing") {
        MarkPendingFarmAttemptClicked(expectedGeneration, "washing")
        BeginActionCompletionWait("washing")
        WaitPendingBackgroundActionCompletion(expectedGeneration, clickResult)
        return
    }
    if clickResult = "CLICKED WASH" {
        MarkPendingFarmAttemptClicked(expectedGeneration, "washing")
        BeginActionCompletionWait("washing", true)
        WaitPendingBackgroundActionCompletion(expectedGeneration)
        return
    }
    if clickResult = "UNCERTAIN WASH" {
        MarkPendingFarmAttemptClicked(expectedGeneration, "washing")
        BeginActionCompletionWait("washing", true)
        WaitPendingBackgroundActionCompletion(expectedGeneration)
        return
    }
    if clickResult = "ERROR SERVER_SESSION_CHANGED" {
        DiscardPendingFarmAttempt("server_session_changed")
        StopAutomationWithFault(
            "サーバー再起動または再接続を検知したため自動停止しました")
        return
    }
    if clickResult != "MISSING WASH" {
        DiscardPendingFarmAttempt("wash_click_error")
        StopAutomationWithFault(
            "洗浄クリックの結果を確認できないため安全停止しました")
        return
    }
    DiscardPendingFarmAttempt("wash_target_missing")
    HandleFarmTargetMissing(expectedGeneration, "washing")
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
    if StationaryOnlyEnabled()
        return false
    global State, Config
    if !IsCurrentRun(expectedGeneration) || State.goldRecoveryExhausted
        return false
    nextStep := State.goldRecoveryStep + 1
    route := GoldRecoveryRoute(nextStep)
    if !route
        return false
    portReady := EnsureDevConPort(false)
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
    if StationaryOnlyEnabled() && !WaitStationaryTaskReady(expectedGeneration)
        return
    global State, Config

    if !IsCurrentRun(expectedGeneration)
        return
    State.timerFn := 0
    if !State.targetHwnd || !WinExist("ahk_id " State.targetHwnd) {
        StopMining()
        State.statusLabel.Text := "●  FiveMが終了したため停止"
        return
    }
    State.attempts += 1
    if !CaptureFarmAttemptBaseline(expectedGeneration, "gold") {
        EnterFarmRecovery(expectedGeneration,
            State.farmState = "RESUMING_FARM" ? "RESUMING_FARM" : "FARMING",
            "gold_reward_baseline_unavailable")
        return
    }
    ; Keep camera alignment adjacent to the actual scan/click.  Doing this before
    ; the inventory baseline let a slow NUI snapshot undo the alignment.
    if !EnsureWorkViewDown(expectedGeneration, "gold", true) {
        if IsCurrentRun(expectedGeneration)
            DiscardPendingFarmAttempt("gold_view_down_failed")
        return
    }
    ; 毎回まず現在位置を検査します。bridgeが同じCDPセッションでtargetを
    ; 長時間監視するため、固定6秒待機や短い再起動ループは挟みません。
    State.statusLabel.Text := "●  「砂金採りトレイ」を確認中"
    clickResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "try-gold", State.serverEpoch)
    if !IsCurrentRun(expectedGeneration)
        return
    WriteDiagnostic("attempt=" State.attempts " GOLD_TRY=" clickResult)
    if IsActionCompletionBridgeResult(clickResult, "gold") {
        MarkPendingFarmAttemptClicked(expectedGeneration, "gold")
        recoveredSteps := State.goldRecoveryStep
        if recoveredSteps
            WriteDiagnostic("attempt=" State.attempts
                " GOLD_RECOVERED steps=" recoveredSteps)
        BeginActionCompletionWait("gold")
        WaitPendingBackgroundActionCompletion(expectedGeneration, clickResult)
        return
    }
    if clickResult = "CLICKED GOLD" {
        MarkPendingFarmAttemptClicked(expectedGeneration, "gold")
        recoveredSteps := State.goldRecoveryStep
        if recoveredSteps
            WriteDiagnostic("attempt=" State.attempts
                " GOLD_RECOVERED steps=" recoveredSteps)
        BeginActionCompletionWait("gold", true)
        WaitPendingBackgroundActionCompletion(expectedGeneration)
        return
    }
    if clickResult = "UNCERTAIN GOLD" {
        MarkPendingFarmAttemptClicked(expectedGeneration, "gold")
        BeginActionCompletionWait("gold", true)
        WaitPendingBackgroundActionCompletion(expectedGeneration)
        return
    }
    if clickResult = "ERROR SERVER_SESSION_CHANGED" {
        DiscardPendingFarmAttempt("server_session_changed")
        StopAutomationWithFault(
            "サーバー再起動または再接続を検知したため自動停止しました")
        return
    }
    if clickResult != "MISSING GOLD" {
        DiscardPendingFarmAttempt("gold_click_error")
        State.goldMissingSince := 0
        StopAutomationWithFault(
            "砂金採りクリックの結果を確認できないため安全停止しました")
        return
    }

    DiscardPendingFarmAttempt("gold_target_missing")
    HandleFarmTargetMissing(expectedGeneration, "gold")
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

    if StationaryOnlyEnabled() || Config.backgroundMode {
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
    if !CaptureFarmAttemptBaseline(expectedGeneration, "mining") {
        StopAutomationWithFault(
            "採掘前の所持品状態を確認できないため安全停止しました")
        return
    }
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
                        State.statusLabel.Text := BuildFarmProgressStatus(
                            "状態: 石を安全に再同期中 ", State.stoneReadyVotes,
                            Config.stoneReadyConfirmations, "")
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
                        State.statusLabel.Text := BuildFarmProgressStatus(
                            "状態: 石の消失を確認中 ", State.stoneAbsentVotes,
                            Config.stoneGoneConfirmations, "")
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
                State.statusLabel.Text := BuildFarmProgressStatus(
                    "状態: 石の再出現を確認中 ", State.stoneReadyVotes,
                    Config.stoneReadyConfirmations, "")
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
        MarkPendingFarmAttemptClicked(expectedGeneration, "mining")
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
            BeginActionCompletionWait("mining", true)
            State.statusLabel.Text := "状態: 採掘結果を確認しています"
            ScheduleNext(expectedGeneration, 1)
        } else if IsCurrentRun(expectedGeneration)
            DiscardPendingFarmAttempt("foreground_no_click")
    }
}

MineAttemptBackground(expectedGeneration) {
    if StationaryOnlyEnabled() && !WaitStationaryTaskReady(expectedGeneration)
        return
    global State, Config

    if !IsCurrentRun(expectedGeneration)
        return

    State.attempts += 1
    if !CaptureFarmAttemptBaseline(expectedGeneration, "mining") {
        EnterFarmRecovery(expectedGeneration,
            State.farmState = "RESUMING_FARM" ? "RESUMING_FARM" : "FARMING",
            "mine_reward_baseline_unavailable")
        return
    }
    State.statusLabel.Text := "●  石をバックグラウンド確認中"
    ; bridgeが石の再出現を同じセッションで待ってから原子的にクリックします。
    ; 旧来の350ms probe・消失3票・再出現2票・固定5.2秒待機は使いません。
    State.statusLabel.Text := "●  採掘ボタンを待っています"
    clickResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "try-mining", State.serverEpoch)
    if !IsCurrentRun(expectedGeneration)
        return
    WriteDiagnostic("attempt=" State.attempts " BG_TRY=" clickResult)
    if IsActionCompletionBridgeResult(clickResult, "mining") {
        MarkPendingFarmAttemptClicked(expectedGeneration, "mining")
        BeginActionCompletionWait("mining")
        WaitPendingBackgroundActionCompletion(expectedGeneration, clickResult)
        return
    }
    if clickResult = "CLICKED MINE" {
        MarkPendingFarmAttemptClicked(expectedGeneration, "mining")
        BeginActionCompletionWait("mining", true)
        WaitPendingBackgroundActionCompletion(expectedGeneration)
        return
    }
    if clickResult = "UNCERTAIN MINE" {
        MarkPendingFarmAttemptClicked(expectedGeneration, "mining")
        BeginActionCompletionWait("mining", true)
        WaitPendingBackgroundActionCompletion(expectedGeneration)
        return
    }
    if clickResult = "ERROR SERVER_SESSION_CHANGED" {
        DiscardPendingFarmAttempt("server_session_changed")
        StopAutomationWithFault(
            "サーバー再起動または再接続を検知したため自動停止しました")
        return
    }
    if clickResult != "MISSING MINE" {
        DiscardPendingFarmAttempt("mine_click_error")
        StopAutomationWithFault(
            "採掘クリックの結果を確認できないため安全停止しました")
        return
    }
    DiscardPendingFarmAttempt("mine_target_missing")
    HandleFarmTargetMissing(expectedGeneration, "mining")
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
    if StationaryOnlyEnabled() && StationaryBridgeMotionBlocked(mode)
        return StationaryMotionDenied(mode)
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
    if StationaryOnlyEnabled() && StationaryBridgeMotionBlocked(mode)
        return StationaryMotionDenied(mode)
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
    if mode = "deposit-delta" || mode = "withdraw-item" {
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
        } else if mode = "try-washing" || mode = "try-mining"
            || mode = "try-gold" {
            ; target待機・クリック・進捗完了を同じhelperで連続監視します。
            ; 石洗いの異常時上限19.5秒も含め、プロセスを途中で切らない余裕を持たせます。
            timeoutMs := 52000
        } else if mode = "wait-action-completion" {
            timeoutMs := 35000
        } else if mode = "companion-command" && bridgeArgs.Length >= 1 {
            companionCommand := bridgeArgs[1]
            longCompanionCommand := companionCommand = "go-vehicle"
                || companionCommand = "return-work"
            timeoutMs := longCompanionCommand ? 125000
                : companionCommand = "open-cargo" ? 28000 : 18000
        } else {
            timeoutMs := mode = "deposit-delta" || mode = "withdraw-item"
                ? 50000 : 9000
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
        try result := Trim(FileRead(resultPath, "UTF-8"))
        catch as err
            return "ERROR " err.Message
        if mode = "deposit-delta" && InStr(result, "DEPOSITED ") = 1 {
            expectedStorageId := bridgeArgs.Length >= 2 ? bridgeArgs[1] : ""
            expectedStorageType := bridgeArgs.Length >= 2 ? bridgeArgs[2] : ""
            if !ParseVerifiedStorageDepositReceipt(result, expectedStorageId,
                expectedStorageType, &depositReceipt)
                || !StorageDepositReceiptOperationMatches(depositReceipt,
                    operationToken)
                return "ERROR DEPOSIT_RECEIPT_MISMATCH"
        }
        if mode = "withdraw-item"
            && (InStr(result, "WITHDRAWN ") = 1
                || InStr(result, "WITHDRAWN_PARTIAL ") = 1) {
            expectedStorageId := bridgeArgs.Length >= 2 ? bridgeArgs[1] : ""
            expectedStorageType := bridgeArgs.Length >= 2 ? bridgeArgs[2] : ""
            if !ParseVerifiedWashingRefillReceipt(result, expectedStorageId,
                expectedStorageType, &withdrawReceipt)
                || !WashingRefillReceiptOperationMatches(withdrawReceipt,
                    operationToken)
                return "ERROR WITHDRAW_RECEIPT_MISMATCH"
        }
        return result
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
    if (mode = "deposit-delta" || mode = "withdraw-item") && operationToken {
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
    CancelExeRouteOperation()
    global State, Config

    previousPhase := State.automationPhase
    wasRegistering := State.registrationActive
    CancelStartOperation()
    CancelActiveBridgeProcess()
    ReleaseAllInputs()
    ReleaseBackgroundTarget(true)
    State.stopInProgress := true
    EndFarmMetagameSession()
    State.running := false
    State.stopInProgress := false
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
    DestroyRuntimeStatusOverlay()
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
            State.uiAssetsPath "\vendor\framework7-bundle.min.js",
            State.uiAssetsPath "\metagame\meta-game.css",
            State.uiAssetsPath "\metagame\meta-game.js",
            State.uiAssetsPath "\metagame\meta-game-adapter.js",
            State.uiAssetsPath "\metagame\meta-game-entry.js",
            State.uiAssetsPath "\metagame\meta-game-template.html",
            State.uiAssetsPath "\metagame\demo-adapter.js",
            State.uiAssetsPath "\metagame\data\achievements.json",
            State.uiAssetsPath "\metagame\data\affinity.json",
            State.uiAssetsPath "\metagame\data\assets.json",
            State.uiAssetsPath "\metagame\data\banners.json",
            State.uiAssetsPath "\metagame\data\gacha.json",
            State.uiAssetsPath "\metagame\data\items.json",
            State.uiAssetsPath "\metagame\data\level-rewards.json",
            State.uiAssetsPath "\metagame\data\messages.json",
            State.uiAssetsPath "\metagame\data\titles.json"
        ]
        for filePath in knownUiFiles
            try FileDelete filePath
        try DirDelete State.uiAssetsPath "\metagame\data"
        try DirDelete State.uiAssetsPath "\metagame"
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
    ; Keep the legacy reward-import format intact; journal is separately bounded.
    SupportWriteEvent("TRACE", message)
    if State.diagnosticLines >= 5000 {
        RotateDiagnosticLogs()
        State.diagnosticLines := 0
    }

    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss") "."
        . Format("{:03}", A_MSec)
    try {
        FileAppend timestamp " | " message "`r`n", State.diagnosticPath, "UTF-8"
        State.diagnosticLines += 1
    }
}

RotateDiagnosticLogs() {
    global State
    currentPath := State.diagnosticPath
    firstArchive := currentPath ".1"
    secondArchive := currentPath ".2"
    try FileDelete secondArchive
    try {
        if FileExist(firstArchive)
            FileMove firstArchive, secondArchive, true
    }
    try {
        if FileExist(currentPath)
            FileMove currentPath, firstArchive, true
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

    relativeSent := SendRelativeMouseDelta(6, 0)
    Sleep 60
    relativeX := 0
    relativeY := 0
    relativeRead := GetSystemCursorPos(&relativeX, &relativeY)
    relativeMoved := relativeRead && relativeX > actualX

    WriteDiagnostic("API_TEST start=" startX "," startY
        " target=" testX "," testY " actual=" actualX "," actualY
        " set=" setOk " read=" readOk " moved=" movedOk
        " relativeSent=" relativeSent " relativeActual=" relativeX ","
        relativeY " relativeMoved=" relativeMoved)

    DllCall "user32\SetCursorPos", "Int", startX, "Int", startY
    return setOk && movedOk && relativeSent && relativeMoved
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

ReadViewDirectionSetting(settingsFile) {
    try value := Integer(IniRead(settingsFile, "ViewLock", "MouseDirection", -1))
    catch
        return -1
    return value > 0 ? 1 : -1
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
