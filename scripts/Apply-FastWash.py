from pathlib import Path

root = Path(__file__).resolve().parents[1]

def read(rel):
    return (root / rel).read_text(encoding='utf-8-sig').replace('\r\n', '\n')

def write(rel, text, bom=False):
    data = text.encode('utf-8')
    if bom:
        data = b'\xef\xbb\xbf' + data
    (root / rel).write_bytes(data)

def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, got {count}')
    return text.replace(old, new, 1)

# Backend/runtime.
p = 'src/mining-auto.ahk'
s = read(p)
s = once(s, 'global AppVersion := "9.1.15"', 'global AppVersion := "9.1.16"', 'app version')
s = once(s,
'''    washReadinessGraceMs: ReadIntegerSetting(settingsPath, "Washing", "ReadinessGraceMs", 7000, 5500, 12000),\n    washForwardCorrection: 0, ; retired by stationary-only policy''',
'''    washReadinessGraceMs: ReadIntegerSetting(settingsPath, "Washing", "ReadinessGraceMs", 7000, 5500, 12000),\n    fastWashMode: ReadIntegerSetting(settingsPath, "Washing", "FastMode", 1, 0, 1),\n    washForwardCorrection: 0, ; retired by stationary-only policy''', 'fast config')
s = once(s,
'''    State.washCorrectionControl := WebUiControl("washCorrectionControl", "",\n        Config.washForwardCorrection && Config.goldRecoveryEnabled && Config.workViewLock)\n    State.autoEatControl := WebUiControl("autoEatControl", "", Config.autoEat)''',
'''    State.washCorrectionControl := WebUiControl("washCorrectionControl", "",\n        Config.washForwardCorrection && Config.goldRecoveryEnabled && Config.workViewLock)\n    State.fastWashControl := WebUiControl("fastWashMode", "", Config.fastWashMode)\n    State.autoEatControl := WebUiControl("autoEatControl", "", Config.autoEat)''', 'fast ui control')
s = once(s,
'''            } else if action = "settings.save"\n                && (parts.Length = 12 || parts.Length = 19) {\n                ApplyWebUiSettings(parts)\n            } else if action = "update.check" && parts.Length = 3 {''',
'''            } else if action = "washing.fast.toggle" && parts.Length = 4 {\n                ToggleFastWashMode(parts[4] = "1")\n            } else if action = "settings.save"\n                && (parts.Length = 12 || parts.Length = 19) {\n                ApplyWebUiSettings(parts)\n            } else if action = "update.check" && parts.Length = 3 {''', 'fast action')
marker = 'ApplyWebUiSettings(parts) {\n'
insert = '''ToggleFastWashMode(enabled) {\n    global State, Config\n    requested := enabled ? 1 : 0\n    if State.running || State.startInProgress || State.registrationActive {\n        State.fastWashControl.Value := Config.fastWashMode\n        State.settingsErrorLabel.Opt("cB42318")\n        State.settingsErrorLabel.Text := "最速石洗いはF9で停止してから変更してください。"\n        QueueWebUiFlush(true)\n        return false\n    }\n    previous := Config.fastWashMode\n    Config.fastWashMode := requested\n    State.fastWashControl.Value := requested\n    try SaveAllSettingsAtomically()\n    catch as err {\n        Config.fastWashMode := previous\n        State.fastWashControl.Value := previous\n        State.settingsErrorLabel.Opt("cB42318")\n        State.settingsErrorLabel.Text := "最速石洗いを保存できません: " err.Message\n        QueueWebUiFlush(true)\n        return false\n    }\n    State.settingsErrorLabel.Opt("c248A3D")\n    State.settingsErrorLabel.Text := requested\n        ? "最速石洗いON：通常洗浄はストレージ表示を待たず、洗浄対象だけを待ちます。"\n        : "最速石洗いOFF：従来どおり荷台前の両操作を確認してから洗浄します。"\n    SupportWriteEvent("FAST_WASH_SETTING", "enabled=" requested)\n    QueueWebUiFlush(true)\n    return true\n}\n\n'''
if s.count(marker) != 1:
    raise RuntimeError('ApplyWebUiSettings marker')
s = s.replace(marker, insert + marker, 1)
s = once(s,
'''        IniWrite Config.washForwardCorrection, temporarySettingsPath, "Washing", "ForwardCorrection"\n        IniWrite Config.washPostCompletionSettleMs, temporarySettingsPath, "Washing", "PostCompletionSettleMs"''',
'''        IniWrite Config.washForwardCorrection, temporarySettingsPath, "Washing", "ForwardCorrection"\n        IniWrite Config.fastWashMode, temporarySettingsPath, "Washing", "FastMode"\n        IniWrite Config.washPostCompletionSettleMs, temporarySettingsPath, "Washing", "PostCompletionSettleMs"''', 'persist fast')
s = once(s,
'''    workTargetPresent := StationaryOnlyEnabled() ? WaitStationaryTaskReady(expectedGeneration) : ProbeWorkTarget(State.runMode, expectedGeneration)''',
'''    fastWashDeferred := FastWashModeEnabled()\n    workTargetPresent := fastWashDeferred ? true\n        : StationaryOnlyEnabled() ? WaitStationaryTaskReady(expectedGeneration)\n        : ProbeWorkTarget(State.runMode, expectedGeneration)\n    if fastWashDeferred\n        WriteDiagnostic("FAST_WASH_START readiness=deferred_to_try_washing storage_gate=0")''', 'startup gate')
s = once(s,
'''HandleFarmTargetMissing(expectedGeneration, actionMode) {\n    if StationaryOnlyEnabled() {\n        if WaitStationaryTaskReady(expectedGeneration)\n            ScheduleNext(expectedGeneration, 1)\n        return true\n    }''',
'''HandleFarmTargetMissing(expectedGeneration, actionMode) {\n    if FastWashModeEnabled() && actionMode = "washing" {\n        global State, Config\n        if !IsCurrentRun(expectedGeneration)\n            return true\n        State.statusLabel.Text := "●  最速石洗い：洗浄対象だけを待機中（ストレージ表示は不要）"\n        SupportWriteEvent("FAST_WASH_RETRY", "reason=wash_target_missing storage_gate=0")\n        ScheduleNext(expectedGeneration, Min(350, Max(100, Config.notFoundRetryMs)))\n        return true\n    }\n    if StationaryOnlyEnabled() {\n        if WaitStationaryTaskReady(expectedGeneration)\n            ScheduleNext(expectedGeneration, 1)\n        return true\n    }''', 'missing fast retry')
s = once(s,
'''WashAttemptBackground(expectedGeneration) {\n    if StationaryOnlyEnabled() && !WaitStationaryTaskReady(expectedGeneration)\n        return\n    global State, Config''',
'''WashAttemptBackground(expectedGeneration) {\n    global State, Config\n    if StationaryOnlyEnabled() && !FastWashModeEnabled()\n        && !WaitStationaryTaskReady(expectedGeneration)\n        return''', 'wash pre-gate')
write(p, s, True)

# Stationary policy: fast wash defers cargo readiness during normal washing only.
p = 'src/stationary-only.ahk'
s = read(p)
s = once(s,
'''StationaryOnlyEnabled() {\n    return true\n}\n''',
'''StationaryOnlyEnabled() {\n    return true\n}\n\nFastWashModeEnabled() {\n    global Config, State\n    return StationaryOnlyEnabled() && Config.fastWashMode && State.runMode = "washing"\n}\n''', 'fast helper')
s = once(s,
'''    ; Raw-stone exhaustion is determined later from the protected live snapshot.\n    ; A known raw item can start refill-only; no wash button is required here.\n    if !WaitStationaryCargo(generation, &id, &kind)\n        return false\n    if !CloseLocalStorageUi() {\n        StopAutomationWithFault("荷台画面の閉鎖を確認できません", "routes", "STATIONARY_UI_CLOSE_FAILED")\n        return false\n    }''',
'''    ; Fast wash does not require the cargo prompt to be visible before every wash.\n    ; Registration identity remains mandatory and actual cargo is re-verified at\n    ; the moment a deposit/refill is needed.\n    if FastWashModeEnabled() {\n        SupportWriteEvent("FAST_WASH_SITE", "startup_cargo_probe=deferred transfer_verification=required")\n    } else {\n        if !WaitStationaryCargo(generation, &id, &kind)\n            return false\n        if !CloseLocalStorageUi() {\n            StopAutomationWithFault("荷台画面の閉鎖を確認できません", "routes", "STATIONARY_UI_CLOSE_FAILED")\n            return false\n        }\n    }''', 'stationary startup cargo')
s = once(s,
'''StationaryRecover(generation, task) {\n    global State\n    if !IsCurrentFarmTask(generation, task, "RECOVERY")\n        return false\n    if !StationaryRecoveryCanWait(State.pendingFarmAttempt, State.storagePending, State.actionCompletionPending)\n        return false\n    if !WaitStationaryTaskReady(generation)\n        return true''',
'''StationaryRecover(generation, task) {\n    global State\n    if !IsCurrentFarmTask(generation, task, "RECOVERY")\n        return false\n    if !StationaryRecoveryCanWait(State.pendingFarmAttempt, State.storagePending, State.actionCompletionPending)\n        return false\n    if FastWashModeEnabled() {\n        State.farmWatchdogAt := MonotonicMs()\n        State.watchdogRecoveryCount := 0\n        State.targetRecoveryAttempts := 0\n        TransitionFarmState(State.resumeVerificationPending ? "RESUMING_FARM" : "FARMING",\n            "最速石洗い：洗浄対象の再検出へ復帰", generation, task)\n        ScheduleNext(generation, 1)\n        return true\n    }\n    if !WaitStationaryTaskReady(generation)\n        return true''', 'fast recovery')
write(p, s, False)

# Web UI.
p = 'src/ui-web/src/app.js'
s = read(p)
s = once(s,
"    'setting-correction', 'setting-auto-eat', 'food-key', 'setting-auto-update',",
"    'setting-correction', 'setting-fast-wash', 'setting-auto-eat', 'food-key', 'setting-auto-update',", 'ui element')
s = once(s,
'''    updateSwitch(\n      elements.settingCorrection,\n      control('correctionEnabled', 'washCorrectionControl'),\n      'correctionEnabled',\n    );\n    updateSwitch(elements.settingAutoEat, control('autoEat', 'autoEatControl'), 'autoEat');''',
'''    updateSwitch(\n      elements.settingCorrection,\n      control('correctionEnabled', 'washCorrectionControl'),\n      'correctionEnabled',\n    );\n    updateSwitch(elements.settingFastWash, control('fastWashMode'), 'fastWashMode');\n    updateSwitch(elements.settingAutoEat, control('autoEat', 'autoEatControl'), 'autoEat');''', 'render fast')
s = once(s,
'''    elements.vehicleEnabled.addEventListener('change', () => {\n      const previous = booleanOf(control('vehicleEnabled'));''',
'''    elements.settingFastWash.addEventListener('change', () => {\n      const previous = booleanOf(control('fastWashMode'), true);\n      const desired = elements.settingFastWash.checked;\n      elements.settingFastWash.checked = previous;\n      elements.settingFastWash.disabled = true;\n      sendAction('washing.fast.toggle', { enabled: desired });\n    });\n    elements.vehicleEnabled.addEventListener('change', () => {\n      const previous = booleanOf(control('vehicleEnabled'));''', 'fast event')
s = once(s,
'''    if (action === 'settings.save') {''',
'''    if (action === 'washing.fast.toggle') {\n      next.controls.fastWashMode = { value: Boolean(payload.enabled), enabled: true };\n      next.controls.settingsFeedback = {\n        text: payload.enabled\n          ? '最速石洗いON：通常洗浄はストレージ表示を待ちません'\n          : '最速石洗いOFF：両操作を確認してから洗浄します',\n        tone: 'success',\n      };\n    }\n    if (action === 'settings.save') {''', 'fixture fast')
write(p, s, False)

p = 'src/ui-web/src/index.html'
s = read(p)
s = once(s,
'''                    <label class="setting-row switch-row" for="setting-auto-eat">''',
'''                    <label class="setting-row switch-row" for="setting-fast-wash">\n                      <span class="row-label">最速石洗い（ストレージ表示を待たない）</span>\n                      <span class="toggle color-green"><input id="setting-fast-wash" type="checkbox" checked><span class="toggle-icon"></span></span>\n                    </label>\n                    <label class="setting-row switch-row" for="setting-auto-eat">''', 'fast html')
s = once(s,
'''                  <p class="group-footnote">荷台前専用です。移動・視点の自動補正は廃止しました。一時的に作業ボタンが消えても、監視を続けて自動再開します。</p>''',
'''                  <p class="group-footnote">「最速石洗い」ONでは通常洗浄時にストレージ表示を待たず、洗浄対象だけを待って即開始します。収納・補充が必要な瞬間だけ登録荷台を確認します。</p>''', 'fast footnote')
write(p, s, False)

# Config template.
p = 'config/AI採掘機.ini'
s = read(p)
s = once(s, '; AI採掘機 v9.1.15 設定テンプレート', '; AI採掘機 v9.1.16 設定テンプレート', 'config version')
s = once(s,
'''ReadinessGraceMs=7000\n; 洗浄報酬の確認後''',
'''ReadinessGraceMs=7000\n; 1なら通常洗浄でストレージ表示を待たず、洗浄対象だけを待って即開始します。\n; 収納・補充が必要な瞬間だけ登録荷台を確認します。\nFastMode=1\n; 洗浄報酬の確認後''', 'config fast')
write(p, s, True)

# Active package versions.
for p in ['src/ui-web/package.json', 'src/ui-web/package-lock.json']:
    s = read(p)
    if '9.1.15' not in s:
        raise RuntimeError(f'{p}: version missing')
    s = s.replace('9.1.15', '9.1.16')
    write(p, s, False)

# Active docs/readmes: change only headline/current references, retain old release docs.
for p in ['README.md', 'src/README.md', 'docs/AI採掘機_使い方.txt']:
    s = read(p)
    s = s.replace('v9.1.15', 'v9.1.16').replace('AI-Miner-v9.1.15.zip', 'AI-Miner-v9.1.16.zip')
    write(p, s, False)

release = '''# AI採掘機 v9.1.16 — 最速石洗いモード\n\n## 新しい設定\n\n設定に **「最速石洗い（ストレージ表示を待たない）」** を追加しました。既定ONです。\n\nONでは、通常の石洗いを始める前に「石を洗う」と「ストレージを開く」が同時に表示されることを要求しません。既存の `try-washing` が対象UIを有効化し、「石を洗う」だけを待って、利用可能になった時点で1回だけクリックします。\n\nストレージは不要になったわけではありません。手持ち石0、成果収納、容量不足など、実際に収納・補充が必要になった瞬間だけ登録荷台を開き、StorageId/StorageType、品目、数量、metadata、双方のインベントリ差分、転送レシートを従来どおり確認します。\n\n## 速くなる箇所\n\n通常洗浄ごとに実行していた「作業＋荷台の両方が3回安定して表示されるまで待つ」前段を省きます。起動時も最速モードでは荷台表示確認を洗浄開始の条件にせず、実際の荷台確認を最初の転送時まで延期します。\n\n洗浄対象そのものが物理的に範囲外の場合、存在しない操作を偽って成功扱いにはしません。`try-washing` の対象待機後も見つからなければ短い間隔で再試行し、ストレージ表示待ちには戻りません。\n\nゲーム側の洗浄アニメーションやクールダウンを短縮・回避する変更ではありません。サーバー追加、メモリ読み取り、DLL注入、アンチチート回避もありません。\n\n## OFF\n\nOFFではv9.1.15相当の荷台前確認を使い、作業とストレージの両操作を確認してから通常洗浄を開始します。設定変更はF9で停止中のみ可能です。\n\n## 診断\n\n`FAST_WASH_SETTING`、`FAST_WASH_START`、`FAST_WASH_SITE`、`FAST_WASH_RETRY` を診断ログへ残します。通常洗浄でストレージ表示を待ったのか、洗浄対象だけを待ったのかを区別できます。\n'''
write('docs/RELEASE_v9.1.16.md', release, False)
validation = '''# v9.1.16 検証設計\n\n- 最速モードONで通常洗浄の前段から `WaitStationaryTaskReady` の両操作ゲートが外れていること。\n- `try-washing` の既存の洗浄対象待機・単発クリック・進捗監視・報酬確認を維持すること。\n- 最速モードOFFでは従来の両操作ゲートを維持すること。\n- 起動時の荷台表示確認は最速洗浄だけ延期し、実際の収納/補充時は登録荷台検証を必須にすること。\n- 洗浄対象MISSING時はストレージ表示待ちへ戻らず、短い再試行へ進むこと。\n- F9、世代変更、接続変更、未確定転送、別荷台、二重送信防止を維持すること。\n- 設定UIのON/OFF保存、更新後の既存INI保持、診断ZIPを検証すること。\n\n合成/契約試験と実FiveMの長時間成功率は区別して報告します。\n'''
write('docs/VALIDATION_v9.1.16.md', validation, False)

# Static contract test used in CI/release validation.
test = r'''$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Get-Content -LiteralPath (Join-Path $root 'src/mining-auto.ahk') -Raw
$stationary = Get-Content -LiteralPath (Join-Path $root 'src/stationary-only.ahk') -Raw
$ui = Get-Content -LiteralPath (Join-Path $root 'src/ui-web/src/app.js') -Raw
$html = Get-Content -LiteralPath (Join-Path $root 'src/ui-web/src/index.html') -Raw
$config = Get-Content -LiteralPath (Join-Path $root 'config/AI採掘機.ini') -Raw
function Assert([bool]$ok,[string]$message){ if(-not $ok){ throw $message } }
Assert ($source.Contains('fastWashMode: ReadIntegerSetting(settingsPath, "Washing", "FastMode", 1, 0, 1)')) 'FastMode config missing.'
Assert ($source.Contains('if StationaryOnlyEnabled() && !FastWashModeEnabled()')) 'Washing pre-gate is not conditional.'
Assert ($source.Contains('FAST_WASH_RETRY') -and $source.Contains('storage_gate=0')) 'Fast wash missing-target retry missing.'
Assert ($source.Contains('IniWrite Config.fastWashMode, temporarySettingsPath, "Washing", "FastMode"')) 'FastMode persistence missing.'
Assert ($stationary.Contains('FastWashModeEnabled()') -and $stationary.Contains('startup_cargo_probe=deferred')) 'Stationary fast-mode deferral missing.'
Assert ($stationary.Contains('WaitStationaryCargo(generation, &id, &kind)')) 'Actual cargo verification was removed.'
Assert ($ui.Contains('setting-fast-wash') -and $ui.Contains("washing.fast.toggle")) 'Fast wash UI wiring missing.'
Assert ($html.Contains('最速石洗い（ストレージ表示を待たない）')) 'Fast wash toggle missing.'
Assert ($config.Contains('FastMode=1')) 'Fast mode template default is not ON.'
Assert ($source.Contains('"try-washing"')) 'Atomic wash helper path missing.'
Assert ($source.Contains('deposit-delta') -and $source.Contains('withdraw-item')) 'Transfer verification paths missing.'
Write-Host 'FAST_WASH_CONTRACT_PASS'
'''
write('scripts/Test-FastWashContract.ps1', test, False)
print('Applied v9.1.16 fast-wash setting and runtime gate changes.')
