from pathlib import Path

root = Path(__file__).resolve().parents[1]
def modify(name, replacements):
    path = root / name
    raw = path.read_bytes()
    text = raw.decode('utf-8-sig').replace('\r\n', '\n')
    for before, after in replacements:
        if text.count(before) != 1:
            raise RuntimeError(f'Unexpected boundary in {name}: {before[:100]}')
        text = text.replace(before, after, 1)
    path.write_bytes((b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'') + text.encode('utf-8'))

modify('src/ui-web/src/app.js', [
    ("version: '9.1.14'", "version: '9.1.15'"),
    ("'未計測。FiveMを前面にして石洗いを開始してください。'", "'移動・視点入力なし。両操作が戻れば自動再開します。'"),
    ("'収納・必要な補充・帰還・次の実報酬まで確認しました。'", "'その場で収納・必要な補充・次の実報酬まで確認しました。'"),
    ("'まだ実行記録はありません。試走では収納しません。'", "'まだ実行記録はありません。接続確認だけでは収納しません。'"),
    ("recorded ? (stationary ? '近接モード' : '往復記録あり') : '未設定'", "recorded ? '近接モード' : '未設定'"),
    ("trial ? (stationary ? '近接確認済み' : '前回の試走記録あり') : '未確認'", "trial ? '近接確認済み' : '未確認'"),
    ("trial ? (stationary ? '近接収納の確認済み · 移動せず毎回荷台を確認' : '往復の試走記録あり · 接続は開始時に再確認') : recorded ? '往復記録あり · 次は自動試走' : '荷台登録 → 同じ位置で確認 → 自動収納ON'", "trial ? '近接収納の確認済み · 一時不在は自動再開待ち' : recorded ? '近接設定あり · 次は同じ位置で再確認' : '荷台登録 → 同じ位置で確認 → 自動収納ON'"),
    ("stationary ? '近接状態を再確認（収納なし）' : '自動試走を開始（収納なし）'", "'近接状態を再確認（収納なし）'"),
    ("    elements.routeTeach.addEventListener('click', () => sendAction('route.teach', { mode: state.actionMode }));\n", ""),
])
modify('src/ui-web/test.mjs', [
    ("assert.match(js, /sendAction\\('route\\.teach', \\{ mode: state\\.actionMode \\}\\)/);", "assert.doesNotMatch(js, /sendAction\\('route\\.teach'/, 'walking commands must not be emitted');"),
    ("assert.match(js, /routeTeach\\.disabled = busy \\|\\| !hasVehicle/);", "assert.match(js, /routeTeach\\.disabled = true/);\nassert.match(js, /routeTeach\\.hidden = true/);\nassert.match(html, /id=\"stationary-policy\"/);\nassert.match(html, /F8を押し直さず自動再開/);\nassert.match(js, /sendAction\\('route\\.stationary', \\{ mode: state\\.actionMode \\}\\)/);"),
])
modify('src/ui-web/src/index.html', [
    ('aria-label="登録する往復の流れ。移動しない作業の流れ"', 'aria-label="同じ場所で行う作業と収納の流れ"'),
    ('上から順番に設定してください。記録や試走だけではアイテムを移動しません。', '上から順番に設定してください。接続確認だけではアイテムを移動しません。'),
    ('まだ実行記録はありません。試走では収納しません。', 'まだ実行記録はありません。接続確認だけでは収納しません。'),
    ('aria-label="石洗いの位置補正"', 'aria-label="移動なしと自動再開の状態"'),
    ('<h2>収納方法を選ぶ</h2>', '<h2>荷台前の操作範囲を確認</h2>'),
    ('id="route-record-badge" class="route-badge">未記録', 'id="route-record-badge" class="route-badge">未設定'),
    ('id="route-trial-badge" class="route-badge">未試走', 'id="route-trial-badge" class="route-badge">未確認'),
])
modify('src/mining-auto.ahk', [('A_TrayMenu.Add("自動収納のルート設定", OpenExeRouteSettings)', 'A_TrayMenu.Add("荷台前の設定・自動再開", OpenExeRouteSettings)')])

# Commit observed readiness only while ownership is still current. Never let a
# delayed observation update a new run after the user presses stop/start.
path = root / 'src/stationary-only.ahk'
raw = path.read_bytes()
text = raw.decode('utf-8-sig')
start = text.index('            if decision = "READY" {\n')
end = text.index('            if decision = "FAULT" {', start)
block = text[start:end]
body = block[len('            if decision = "READY" {\n'):-len('            }\n')]
assert 'return true' in body and 'Critical' not in body
new = '            if decision = "READY" {\n                criticalWasOn := A_IsCritical\n                if !criticalWasOn\n                    Critical "On"\n                try {\n                    if !IsCurrentFarmTask(generation, task)\n                        return false\n'
new += ''.join('    ' + line if line.strip() else line for line in body.splitlines(keepends=True))
new += '                } finally {\n                    if !criticalWasOn\n                        Critical "Off"\n                }\n            }\n'
text = text[:start] + new + text[end:]
path.write_bytes((b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'') + text.encode('utf-8'))
print('Stationary UI, version fixture and generation-safe readiness commit finalized.')
