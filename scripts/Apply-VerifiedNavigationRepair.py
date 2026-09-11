"""Apply the reviewed controller integration once, before Windows validation.
This script is temporary and must not be included in a release.
"""
from pathlib import Path
import hashlib

root = Path(__file__).resolve().parent.parent
p = root / 'src/mining-auto.ahk'
raw = p.read_bytes()
# Refuse to rewrite a source file that has changed since review.
expected_blob = 'e0096903549553335148672ac07a337725f41dbd'
actual_blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
if actual_blob != expected_blob:
    raise SystemExit('Controller changed since review: ' + actual_blob)
s = raw.decode('utf-8-sig')
def replace(old, new):
    global s
    if s.count(old) != 1:
        raise RuntimeError('Expected one exact controller match: ' + old[:100])
    s = s.replace(old, new, 1)
replace('#SingleInstance Force\n', '#SingleInstance Force\n#Include verified-storage-navigation.ahk\n')
replace('BeginVehicleRegistration(*) {\n    BeginLocalVehicleRegistration()\n}', 'BeginVehicleRegistration(*) {\n    BeginCompanionVehicleRegistration()\n}')
replace('''            } else if action = "vehicle.delete" && parts.Length = 3 {''', '''            } else if action = "vehicle.register-local" && parts.Length = 3 {
                if State.visualTest
                    State.vehicleStatusLabel.Text := "近接収納のみ。徒歩移動は行いません"
                else
                    BeginLocalVehicleRegistration()
            } else if action = "vehicle.delete" && parts.Length = 3 {''')
replace('''    State.vehicleRegisterButton.Text := valid ? "別の車両を登録" : "車両を登録"''', '''    State.vehicleRegisterButton.Text := "徒歩往復する車両を登録"''')
replace('''        State.routeStatusLabel.Text := "ローカル登録　準備完了"
        State.routeDetailLabel.Text := "満重量になると近くの同じストレージだけを探し、採集分を収納して作業へ戻ります。"''', '''        State.routeStatusLabel.Text := Config.vehicleCompanionProtocol = 1
            ? "徒歩ナビ連携　登録済み" : "近接収納のみ・徒歩ナビ未設定"
        State.routeDetailLabel.Text := Config.vehicleCompanionProtocol = 1
            ? "ゲーム内連携で車両の現在位置まで歩き、収納・石補充後に開始地点へ戻ります。開始時に連携を再検証します。"
            : "従来登録は荷台IDだけで位置を持ちません。徒歩往復にはサーバー管理者のai_miner_companion導入後、上のボタンで登録し直してください。"''')
replace('''        State.routeStatusLabel.Text := "サーバー側への導入は不要です"
        State.routeDetailLabel.Text := "登録を開始し、対象車両のストレージを一度だけ手動で開いてください。"''', '''        State.routeStatusLabel.Text := "徒歩連携または近接収納を選択"
        State.routeDetailLabel.Text := "徒歩往復にはサーバー管理者によるai_miner_companion導入が必要です。近接収納だけの従来登録とは異なります。"''')
replace('''    return config.vehicleRegistered = 1
        && config.vehicleCompanionProtocol = 0
        && config.vehicleRegistrationId = ""''', '''    return config.vehicleRegistered = 1
        && ((config.vehicleCompanionProtocol = 0
                && config.vehicleRegistrationId = "")
            || (config.vehicleCompanionProtocol = 1
                && IsValidCompanionRegistrationId(config.vehicleRegistrationId)))''')
replace('''    try {
        if reuseStoragePose {
            recoveryViewRoute := ""''', '''    try {
        if Config.vehicleCompanionProtocol = 1 {
            ; Real game-confirmed walking must run BEFORE any local camera search.
            ; The existing deposit/refill ledger below is shared by both adapters.
            movementHistory := []
            matchedViewRoute := ""
            storageFound := FindRegisteredStorageByCompanion(expectedGeneration,
                &searchFailure)
        } else if reuseStoragePose {
            recoveryViewRoute := ""''')
replace('''        EnterFarmRecovery(expectedGeneration,
            reuseStoragePose ? "OPENING_STORAGE" : "FARMING",
            searchFailure ? searchFailure : "registered_storage_not_found")''', '''        if Config.vehicleCompanionProtocol = 1 {
            ; A failed, cancelled or stale navigation receipt must not fall back
            ; to guessing movement from screen coordinates or timed key pulses.
            StopAutomationWithFault(searchFailure ? searchFailure
                : "登録車両への徒歩到着を確認できませんでした",
                "vehicle", "NAVIGATION_UNVERIFIED")
            return
        }
        EnterFarmRecovery(expectedGeneration,
            reuseStoragePose ? "OPENING_STORAGE" : "FARMING",
            searchFailure ? searchFailure : "registered_storage_not_found")''')
replace('''    poseRestored := RestoreLocalSearchPose(expectedGeneration,
        State.storageMovementHistory, State.storageMatchedViewRoute)''', '''    poseRestored := Config.vehicleCompanionProtocol = 1
        ? ReturnToWorkByCompanion(expectedGeneration)
        : RestoreLocalSearchPose(expectedGeneration,
            State.storageMovementHistory, State.storageMatchedViewRoute)''')
replace('''    TransitionFarmState("VERIFY_FARM_REACHED", "往路の逆操作完了を確認",
        expectedGeneration, 0, true)''', '''    TransitionFarmState("VERIFY_FARM_REACHED",
        Config.vehicleCompanionProtocol = 1
            ? "ゲーム内の開始地点到着を確認" : "近接探索の逆入力完了・対象再検出待ち",
        expectedGeneration, 0, true)''')
replace('''    pulse := Max(120, Min(250, Config.vehicleSearchPulseMs))
    correctionSteps := [pulse ":1",''', '''    if Config.vehicleCompanionProtocol = 1 {
        ; The native return already restored the anchor and camera. Do not wander
        ; away with blind movement pulses when the work interaction is unavailable.
        WriteDiagnostic("NAVIGATION_WORK_TARGET_PENDING anchor=verified")
        return false
    }
    pulse := Max(120, Min(250, Config.vehicleSearchPulseMs))
    correctionSteps := [pulse ":1",''')
a = s.index('    primaryViews := ', s.index('\nFindRegisteredStorageNearby('))
b = s.index('\n}\n\nTryRegisteredStorageViews', a)
s = s[:a] + '''    ; Legacy registration knows only an opaque trunk ID, not its coordinates.
    ; One bounded in-place check remains available for backward compatibility.
    ; Do not spend minutes turning or send random walking inputs toward no target.
    primaryViews := ["", "400:16"]
    if TryRegisteredStorageViews(expectedGeneration, primaryViews,
        &matchedViewRoute, &viewFailure, &fatalFailure)
        return true
    failureMessage := fatalFailure ? viewFailure
        : "近接範囲に登録荷台がありません。徒歩往復にはサーバー管理者のai_miner_companion導入と徒歩連携での再登録が必要です"
    WriteDiagnostic("LOCAL_STORAGE_LIMIT mode=proximity_only walking=unavailable")
    return false''' + s[b:]
replace('''        workTargetPresent := ProbeWorkTarget(State.runMode, runGeneration)
        if !IsCurrentRun(runGeneration)
            return
        if !workTargetPresent {''', '''        startWithEmptyRawStone := State.runMode = "washing"
            && Config.rawStoneItemName != "" && IsSet(primedInventory)
            && IsObject(primedInventory)
            && InventorySpecNameCount(primedInventory.items,
                Config.rawStoneItemName) = 0
        workTargetPresent := startWithEmptyRawStone
            || ProbeWorkTarget(State.runMode, runGeneration)
        if !IsCurrentRun(runGeneration)
            return
        if !workTargetPresent {''')
replace('''            if !startCapacityBlocked {
                State.nextCapacityCheckAt := MonotonicMs()
                    + Config.capacityCheckIntervalMs
            }''', '''            if !startCapacityBlocked {
                State.nextCapacityCheckAt := MonotonicMs()
                    + Config.capacityCheckIntervalMs
                if State.runMode = "washing" && Config.rawStoneItemName
                    && InventorySpecNameCount(inventoryInfo.items,
                        Config.rawStoneItemName) = 0 {
                    State.lastRawStoneCount := 0
                    State.storagePending := true
                    State.storageReason := "raw_stone_empty"
                    State.storagePreSnapshot := inventoryInfo
                    State.storageOutputsVerified := true
                    State.storageRefillVerified := false
                    State.nextCapacityCheckAt := 0
                }
            }''')
replace('''        WriteDiagnostic("attempt=" attemptId " WASH_SETTLE_DONE")
        if Config.washForwardCorrection {''', '''        WriteDiagnostic("attempt=" attemptId " WASH_SETTLE_DONE")
        if Config.rawStoneItemName && State.lastRawStoneCount = 0 {
            ; Finish the animation's root motion, then depart for refill directly.
            ; No forward correction or missing work-button search at zero stock.
            ResumeAfterWashCompletionRecovery(expectedGeneration,
                expectedTaskId, "WASH_SETTLING", attemptId)
            return
        }
        if Config.washForwardCorrection {''')
replace('''                "持ってる石、全部洗い終わったよ")''', '''                "石洗いが終わったよ")''')
replace('''        played := SpeakAutomationMessage(message)''', '''        played := PlayWashingCompletionVoice(message)''')
replace('''    ; 通常runでは途中で未確定候補へ切り替わった時点で停止します。
''', '''    WriteDiagnostic("NAVIGATION_PROGRESS status=" companionInfo.status
        " distanceCm=" companionInfo.distanceCm
        " code=" companionInfo.lastCode " sequence=" companionInfo.sequence)
    ; 通常runでは途中で未確定候補へ切り替わった時点で停止します。
''')
replace('''    exitCode := !FileExist(State.buttonTemplates[1].path) ? 11''', '''    testVerifiedNavigationOk := RunVerifiedNavigationSelfTest()
    exitCode := !FileExist(State.buttonTemplates[1].path) ? 11''')
replace('''        : !testWashingBatchCompleteOk ? 174 : 0''', '''        : !testWashingBatchCompleteOk ? 174
        : !testVerifiedNavigationOk ? 175 : 0''')
p.write_bytes(s.encode('utf-8'))

p = root / 'scripts/Build.ps1'
raw = p.read_bytes()
s = raw.decode('utf-8-sig')
old = 'Copy-Item -LiteralPath $mainSource -Destination $stagedMain -Force\n'
assert s.count(old) == 1
s = s.replace(old, old + "Copy-Item -LiteralPath (Join-Path $sourceRoot 'verified-storage-navigation.ahk') -Destination $stageRoot -Force\n", 1)
p.write_bytes((b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'') + s.encode('utf-8'))

p = root / 'src/ui-web/src/app.js'
s = p.read_text(encoding='utf-8')
old = '''    if (!text || /補助リソース|サーバー管理者|サーバー側/i.test(text)) {
      return '登録を押したあと、FiveMで目的の車両ストレージを一度開いてください。';
    }
    return text;'''
assert s.count(old) == 1
s = s.replace(old, "    return text || '徒歩往復にはサーバー管理者によるai_miner_companion導入が必要です。';", 1)
s = s.replace("'vehicle-register-label',", "'vehicle-register-label', 'vehicle-register-local',", 1)
s = s.replace('    elements.vehicleRegister.disabled = !enabledOf(register);', '    elements.vehicleRegister.disabled = !enabledOf(register);\n    elements.vehicleRegisterLocal.disabled = !enabledOf(register);', 1)
s = s.replace("    elements.vehicleDelete.addEventListener('click', () => {", """    elements.vehicleRegisterLocal.addEventListener('click', () => {
      app.dialog.confirm(
        '荷台が近くにある場合だけの収納です。車両の位置を取得できないため徒歩移動は行いません。',
        '近接収納のみ登録',
        () => sendAction('vehicle.register-local'),
      );
    });
    elements.vehicleDelete.addEventListener('click', () => {""", 1)
s = s.replace("    if (action === 'vehicle.register') {", "    if (action === 'vehicle.register' || action === 'vehicle.register-local') {", 1)
s = s.replace("next.controls.companionDetail = { text: 'FiveMで目的の車両ストレージを一度開いてください。' };", "next.controls.companionDetail = { text: 'プレビューです。徒歩往復には実際のFiveMサーバー連携が必要です。' };", 1)
p.write_bytes(s.encode('utf-8'))
(root / 'src/ui-web/www/app.js').write_bytes(s.encode('utf-8'))
p = root / 'src/ui-web/src/index.html'
s = p.read_text(encoding='utf-8')
s = s.replace('登録を押したあと、FiveMで目的の車両ストレージを一度開いてください。', '徒歩往復にはサーバー管理者によるai_miner_companion導入が必要です。近接収納だけの登録とは異なります。')
s = s.replace('<span id="vehicle-register-label">車両登録を開始</span>', '<span id="vehicle-register-label">徒歩往復する車両を登録</span>')
s = s.replace('                <button id="vehicle-delete"', '                <button id="vehicle-register-local" class="text-action" type="button">近接収納だけ登録（徒歩移動なし）</button>\n                <button id="vehicle-delete"', 1)
p.write_bytes(s.encode('utf-8'))
(root / 'src/ui-web/www/index.html').write_bytes(s.encode('utf-8'))
p = root / 'src/ui-host/Protocol.cs'
s = p.read_text(encoding='utf-8-sig')
s = s.replace('                    case "vehicle.register":', '                    case "vehicle.register":\n                    case "vehicle.register-local":', 1)
needle = '''                AssertAction(@"{""type"":""action"",""action"":""vehicle.register"",""payload"":{}}",
                    "vehicle.register", new string[0]);'''
assert s.count(needle) == 1
s = s.replace(needle, needle + '''
                AssertAction(@"{""type"":""action"",""action"":""vehicle.register-local"",""payload"":{}}",
                    "vehicle.register-local", new string[0]);''', 1)
p.write_bytes(s.encode('utf-8'))
print('Reviewed integration applied. Windows compilation and tests are still required.')
