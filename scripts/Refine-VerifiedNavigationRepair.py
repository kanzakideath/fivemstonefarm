"""Temporary, exact-match follow-up to the reviewed navigation integration."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent

def edit(path, old, new):
    p = root / path
    raw = p.read_bytes()
    text = raw.decode('utf-8-sig').replace('\r\n', '\n')
    if text.count(old) != 1:
        raise RuntimeError('Expected one exact match in ' + path + ': ' + old[:90])
    text = text.replace(old, new, 1)
    p.write_bytes((b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'') + text.encode('utf-8'))

edit('scripts/Test-StorageClosedLoopContract.ps1',
     '$source = Get-Content -LiteralPath $resolvedSource -Raw -Encoding UTF8\n',
     '''$source = Get-Content -LiteralPath $resolvedSource -Raw -Encoding UTF8
# Validate the same literal module that the compiled controller includes.
# Missing modules remain a hard failure; do not waive production entry checks.
if ($source -match '(?m)^#Include verified-storage-navigation\\.ahk\\s*$') {
    $navigationModule = Join-Path (Split-Path -Parent $resolvedSource) 'verified-storage-navigation.ahk'
    $source += "`n" + (Get-Content -LiteralPath $navigationModule -Raw -Encoding UTF8 -ErrorAction Stop)
}
''')
edit('src/verified-storage-navigation.ahk',
     '&& actualId = expectedId && code = expectedCode && netId > 0',
     '&& actualId == expectedId && code == expectedCode && netId > 0')
edit('scripts/Test-VerifiedNavigation.mjs',
     'actualId = expectedId && code = expectedCode && netId > 0',
     'actualId == expectedId && code == expectedCode && netId > 0')
edit('src/verified-storage-navigation.ahk',
     'if storageId != Config.vehicleStorageId || storageType != Config.vehicleStorageType {',
     'if !(storageId == Config.vehicleStorageId) || !(storageType == Config.vehicleStorageType) {')
edit('src/verified-storage-navigation.ahk',
     '        State.registrationActive := true\n        State.registrationCancelled := false',
     '        State.registrationActive := true\n        State.registrationCancelled := false\n        State.registrationNavigation := true\n        State.navigationRegistrationMessage := ""')
edit('src/verified-storage-navigation.ahk',
     '        ownsCompanionOperation := true\n        armed := RunCompanionCommandCancelable(0, "arm-register")',
     '        armed := RunCompanionCommandCancelable(0, "arm-register")')
edit('src/verified-storage-navigation.ahk',
     '        if !WaitForCompanionRegistration(initialInfo.sequence, initialInfo.epoch,',
     '        ownsCompanionOperation := true\n        if !WaitForCompanionRegistration(initialInfo.sequence, initialInfo.epoch,')
edit('src/verified-storage-navigation.ahk',
     '        State.registrationActive := false\n        State.registrationCancelled := false',
     '        State.navigationRegistrationMessage := statusText\n        State.registrationNavigation := false\n        State.registrationActive := false\n        State.registrationCancelled := false')
edit('src/mining-auto.ahk',
     '''    if State.registrationActive {
        State.vehicleStatusLabel.Text := "登録する車両のストレージを開いてください"
        State.routeStatusLabel.Text := "ストレージを待っています"
        State.routeDetailLabel.Text := "通常どおり荷台を開くと、端末内への登録が自動で完了します。"
''',
     '''    if State.registrationActive {
        nativeRegistration := State.HasOwnProp("registrationNavigation")
            && State.registrationNavigation
        State.vehicleStatusLabel.Text := nativeRegistration
            ? "徒歩連携用の車両を選択してください" : "登録する車両のストレージを開いてください"
        State.routeStatusLabel.Text := nativeRegistration
            ? "徒歩ナビ用の車両登録中" : "ストレージを待っています"
        State.routeDetailLabel.Text := nativeRegistration
            ? "車両を狙ってE、またはox_targetの登録項目を選択してください。F9で中止できます。"
            : "通常どおり荷台を開くと、端末内への登録が自動で完了します。"
''')
edit('src/mining-auto.ahk',
     '''    RefreshCapacityUi()
    QueueWebUiFlush()
}

BeginLocalVehicleRegistration(*) {''',
     '''    if !State.registrationActive && State.HasOwnProp("navigationRegistrationMessage")
        && State.navigationRegistrationMessage
        State.vehicleStatusLabel.Text := State.navigationRegistrationMessage
    RefreshCapacityUi()
    QueueWebUiFlush()
}

BeginLocalVehicleRegistration(*) {''')
edit('src/mining-auto.ahk',
     '''    previousProfile := SnapshotVehicleProfile()
    finalStatus := ""
''',
     '''    State.navigationRegistrationMessage := ""
    State.registrationNavigation := false
    previousProfile := SnapshotVehicleProfile()
    finalStatus := ""
''')
# Returning within the cargo radius is insufficient for a narrow wash interaction.
edit('fivem-resource/ai_miner_companion/config.shared.lua',
     '    ArrivalDistance = 1.75,',
     '    ArrivalDistance = 1.75,\n    -- Work anchors require a tighter stop than a vehicle cargo interaction.\n    WorkArrivalDistance = 0.40,')
p = root / 'fivem-resource/ai_miner_companion/client.lua'
text = p.read_text(encoding='utf-8')
a = text.index('local function runReturnNavigation(operation)')
b = text.index('\nlocal function startReturnNavigation', a)
section = text[a:b]
assert section.count('Config.Navigation.ArrivalDistance') == 2
section = section.replace('    local ped = PlayerPedId()',
    '    local arrivalDistance = math.max(0.15, math.min(0.75, tonumber(Config.Navigation.WorkArrivalDistance) or 0.40))\n    local ped = PlayerPedId()', 1)
section = section.replace('Config.Navigation.ArrivalDistance', 'arrivalDistance')
p.write_bytes((text[:a] + section + text[b:]).encode('utf-8'))
# Keep the user-facing guide truthful for both adapters.
p = root / 'README.md'
text = p.read_text(encoding='utf-8')
a = text.index('## 車両登録と自動収納')
b = text.index('## 視点固定と自動食事', a)
text = text[:a] + '''## 車両登録と自動収納

この修正候補では、徒歩往復と近接収納を区別します。

**徒歩往復には、サーバー管理者による `ai_miner_companion` の導入と所有権検証の設定が必要です。**
「徒歩往復する車両を登録」から候補を選択し、荷台までの移動・アクセスを確認して登録を確定します。
作業開始時に現在位置と視点を記録し、石掘り・砂金は容量しきい値で徒歩収納へ、石洗いは石0または容量しきい値で収納・補充へ進みます。
帰還には開始地点の座標を使用し、既定0.40m以内を到着条件にします。実際の作業ボタンと次の報酬も再確認します。

従来登録は荷台IDだけで位置を持ちません。「近接収納だけ登録（徒歩移動なし）」では少数のその場の確認だけを行います。
登録IDを根拠に架空の座標を作ったり、ランダムな徒歩入力で探索したりしません。既存登録も勝手に徒歩連携へ変換しません。

作業中に増えた確認済み成果だけを収納し、食料・道具などの既存所持品を保護します。収納と補充は操作レシートと両インベントリの数量を照合します。
石洗い補充では、未洗浄石の在庫・重量・空きスロット・次の報酬用余裕から安全な上限を計算します。
不確定な収納結果は自動再送せず、荷台満杯・補充石なし・所有権不一致・経路不達・停止操作も尊重します。
開始時点ですでに満量で、今回の作業成果と既存所持品を区別できない場合は手動で空きを作ってから開始してください。

設定・音声・制限・実機確認項目は [徒歩収納ガイド](docs/VERIFIED_STORAGE_NAVIGATION.md) を参照してください。
本番と同じ処理を使う模擬試験は実施しますが、利用先FiveMでの歩行・収納成功は別途実機検証が必要です。

''' + text[b:]
text = text.replace('持ってる石、全部洗い終わったよ', '石洗いが終わったよ')
text = text.replace('静止後に前進補正を1度だけ実行し、', '静止後、石が残っていれば前進補正を1度だけ実行し、')
p.write_bytes(text.encode('utf-8'))
p = root / 'docs/AI採掘機_使い方.txt'
text = p.read_text(encoding='utf-8')
text = text.replace('- サーバー側へのresource導入、DLL/ASI導入、メモリ読取りは不要です。',
    '- 徒歩往復には管理者によるai_miner_companion導入と所有権検証の設定が必要です。DLL/ASI導入やメモリ読取りは行いません。')
a = text.index('車両登録\n--------')
b = text.index('Farmと自動収納の復旧', a)
text = text[:a] + '''車両登録と収納・石補充
----------------------
徒歩往復を使うには、サーバー管理者がai_miner_companionを導入し、所有権検証を設定してください。
車両画面の「徒歩往復する車両を登録」から登録し、手動で作業地点へ戻って開始します。
作業開始時の位置が帰還先です。容量不足で登録車両へ歩き、作業成果だけ収納し、開始地点へ戻ります。
石洗いでは最後の石がなくなると「石洗いが終わったよ」と通知し、収納後に安全な所持上限まで石を補充します。
独自のAI音源は同梱していません。既存のWindows日本語女性音声優先の読み上げ、またはEXE横の
 audio/stone-washing-complete.wav の任意のローカル音源を使用します。
従来の荷台IDだけの登録は「近接収納だけ登録（徒歩移動なし）」です。遠くの車両位置は分かりません。
別荷台や不確定な移動結果には何も収納せず、荷台満杯・補充在庫0・経路不達では停止します。
開始前から持っていた品は保護します。開始時点ですでに満量なら、手動で空きを作ってください。
詳しくはリポジトリのdocs/VERIFIED_STORAGE_NAVIGATION.mdを参照してください。

''' + text[b:]
p.write_bytes(text.encode('utf-8'))
print('Module-aware tests, exact return radius and persistent setup errors applied.')
