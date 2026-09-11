from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
def read(name): return (ROOT / name).read_text(encoding='utf-8-sig')
def write(name, value): (ROOT / name).write_text(value, encoding='utf-8', newline='\n')
def once(text, before, after):
    if text.count(before) != 1: raise RuntimeError('Unexpected source boundary: ' + before[:100])
    return text.replace(before, after)

html = read('src/ui-web/src/index.html')
if 'id="screen-routes"' in html:
    raise RuntimeError('Route UI already present; do not reapply')
nav = '''              <button id="tab-routes" class="sidebar-item" type="button" role="tab" aria-selected="false" aria-controls="screen-routes" data-page="routes">
                <svg aria-hidden="true"><use href="#icon-link"></use></svg><span>ルート設定</span>
              </button>
'''
anchor = '              <button id="tab-settings"'
html = once(html, anchor, nav + anchor)
card = '''                <button id="overview-route" class="route-launch" type="button" aria-controls="screen-routes">
                  <span class="route-launch-icon" aria-hidden="true">↔</span>
                  <span><strong>自動収納・石補充のルートを設定</strong><small id="overview-route-summary">車両登録 → 往復記録 → 自動試走</small></span>
                  <svg class="chevron" aria-hidden="true"><use href="#icon-chevron"></use></svg>
                </button>
'''
anchor = '                <button id="run-button"'
html = once(html, anchor, card + anchor)
html = once(html, '                <button id="vehicle-route" class="primary-action secondary-primary pressable" type="button">徒歩ルート・音声設定（EXEのみ）</button>\n', '')
anchor = '                  <p>登録済みの車両を近くから探索し、確認済みの作業報酬だけを同じ荷台へ収納します</p>\n                </header>'
html = once(html, anchor, '''                  <p>荷台を登録し、作業現場との往復ルートを設定します</p>
                </header>
                <button id="vehicle-route" class="route-launch" type="button" aria-controls="screen-routes">
                  <span class="route-launch-icon" aria-hidden="true">↔</span>
                  <span><strong>ルート設定を開く</strong><small>自動収納・石洗い補充 ／ EXEだけで設定</small></span>
                  <svg class="chevron" aria-hidden="true"><use href="#icon-chevron"></use></svg>
                </button>''')
page = '''            <section id="screen-routes" class="screen" data-page="routes" role="tabpanel" aria-labelledby="tab-routes" aria-hidden="true">
              <div class="content-column route-column">
                <header class="page-heading">
                  <span class="route-eyebrow">EXE ONLY · サーバーへの追加導入なし</span>
                  <h1>ルート設定</h1>
                  <p>「どの現場から、どの荷台へ、どう戻るか」を画面で確認しながら登録します。</p>
                </header>
                <div class="route-mode-picker" role="group" aria-label="ルートを設定する作業">
                  <button type="button" data-route-mode="mining" aria-pressed="false">石掘り</button>
                  <button type="button" data-route-mode="washing" aria-pressed="false">石洗い</button>
                  <button type="button" data-route-mode="gold" aria-pressed="false">砂金取り</button>
                </div>
                <p id="route-mode-hint" class="route-hint"></p>
                <div class="route-journey" aria-label="登録する往復の流れ。実際の地図ではありません">
                  <span>作業現場</span><span class="route-journey-line">往路 →</span><strong>登録した荷台</strong><span class="route-journey-line">← 復路</span><span>同じ現場</span>
                </div>
                <p class="route-hint">これは手順図です。画面だけから実際の地図・車両座標は表示しません。</p>
                <div id="route-feedback" class="route-feedback" role="status" aria-live="polite">上から順番に設定してください。記録や試走だけではアイテムを移動しません。</div>
                <div class="route-steps">
                  <article class="route-step" id="route-step-vehicle">
                    <span class="route-step-number">1</span><div class="route-step-body"><div class="route-step-heading"><h2>収納先の車両を登録</h2><span id="route-vehicle-badge" class="route-badge">未登録</span></div>
                    <p>停車した自分のバン／トラックの荷台を一度開きます。他の車両の荷台には収納しません。</p>
                    <button id="route-register" type="button" class="route-button">車両登録を開始</button></div>
                  </article>
                  <article class="route-step" id="route-step-record">
                    <span class="route-step-number">2</span><div class="route-step-body"><div class="route-step-heading"><h2>現場との往復を教える</h2><span id="route-record-badge" class="route-badge">未記録</span></div>
                    <p>作業できる位置から開始。画面上の案内に従って荷台まで歩き、同じ現場へ戻ります。石洗いは手持ち石を用意してください。</p>
                    <div class="route-key-guide"><span><kbd>W A S D</kbd> 徒歩</span><span><kbd>F6</kbd> 照合点</span><span><kbd>F7</kbd> 片道の終点</span><span><kbd>F9</kbd> 中止</span></div>
                    <p>4秒以内ごとに立ち止まると、景色を照合点として保存します。往路・復路はそれぞれ記録します。</p>
                    <button id="route-teach" type="button" class="route-button">画面ガイド付きで往復を記録</button></div>
                  </article>
                  <article class="route-step" id="route-step-trial">
                    <span class="route-step-number">3</span><div class="route-step-body"><div class="route-step-heading"><h2>収納せずに自動試走</h2><span id="route-trial-badge" class="route-badge">未試走</span></div>
                    <p>元の作業位置から自動で往復します。荷台IDと現場の作業ボタンを確認できた場合だけ試走済みになります。</p>
                    <button id="route-trial" type="button" class="route-button">自動試走を開始（収納なし）</button></div>
                  </article>
                  <article class="route-step" id="route-step-enable">
                    <span class="route-step-number">4</span><div class="route-step-body"><div class="route-step-heading"><h2>自動収納・補充を有効にする</h2><span id="route-enabled-badge" class="route-badge">OFF</span></div>
                    <p>石掘り・砂金は容量のしきい値で収納。石洗いは石0または容量のしきい値で成果を収納し、石を補充します。</p>
                    <button id="route-enable" type="button" class="route-button">自動収納・補充をON</button>
                    <button id="route-return-home" type="button" class="route-button route-button-quiet">作業画面へ戻る</button></div>
                  </article>
                </div>
                <aside class="route-notice"><strong>記録中・試走中はFiveMを前面にしてください。</strong><p>F9で中止できます。車両や現場を変えたときは再記録、再接続時は再確認が必要です。試走記録があっても接続とルートの一致を開始時に再確認します。実ゲームの全状況での到達保証はありません。</p></aside>
                <button id="route-voice" class="route-button route-button-quiet" type="button">音声・別ウィンドウの設定を開く</button>
                <p class="route-hint">画面の入口が使えない場合：Ctrl + Alt + R ／ 完了ボイス：VOICEVOX:四国めたん</p>
              </div>
            </section>

'''
anchor = '            <section id="screen-settings"'
html = once(html, anchor, page + anchor)
write('src/ui-web/src/index.html', html)

css = read('src/ui-web/src/app.css')
css = once(css, '    grid-template-columns: repeat(5, minmax(0, 1fr));', '    grid-template-columns: none;\n    grid-auto-flow: column;\n    grid-auto-columns: minmax(66px, 1fr);\n    overflow-x: auto;\n    overflow-y: hidden;\n    scrollbar-width: thin;')
css += '''
/* Route setup paints its own surface; white text must never rely on a missing child. */
.route-launch { display:flex; align-items:center; gap:14px; width:100%; min-height:76px; margin:0 0 22px; padding:16px; border:1px solid #b5c9e8; border-radius:16px; background:#eaf2ff; color:#15365f; text-align:left; cursor:pointer; }
.route-launch > span:nth-child(2) { flex:1; min-width:0; }
.route-launch strong,.route-launch small { display:block; line-height:1.5; }
.route-launch strong { font-size:16px; }
.route-launch small { font-size:12px; margin-top:3px; color:#3f5573; }
.route-launch-icon { font-size:27px; }
.route-launch svg { flex-shrink:0; }
.route-launch:focus-visible,.route-button:focus-visible,.route-mode-picker button:focus-visible { outline:3px solid #0066cc; outline-offset:3px; }
.route-eyebrow { display:block; margin-bottom:9px; color:#36577c; font-size:11px; letter-spacing:.07em; font-weight:700; }
.route-mode-picker { display:flex; gap:7px; padding:5px; border:1px solid #d7dde7; border-radius:14px; background:#e6eaf0; }
.route-mode-picker button { flex:1; min-height:44px; border:0; border-radius:10px; background:transparent; color:#344257; font:inherit; font-weight:600; }
.route-mode-picker button[aria-pressed="true"] { background:#183e6e; color:white; box-shadow:0 2px 4px #172b4d22; }
.route-hint { color:#556478; font-size:12px; line-height:1.7; margin:10px 0 18px; }
.route-journey { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:18px 14px; background:#152a45; color:#f6f8fc; border-radius:14px; font-size:12px; }
.route-journey-line { color:#9bceee; }
.route-feedback { background:#e9f1fb; border-left:4px solid #3675b7; padding:14px 16px; color:#183e62; font-size:13px; line-height:1.75; margin:18px 0; border-radius:5px; overflow-wrap:anywhere; }
.route-steps { display:grid; gap:14px; }
.route-step { display:flex; align-items:flex-start; gap:12px; padding:19px; border:1px solid #dce2eb; border-radius:16px; background:#fff; }
.route-step-number { display:grid; place-items:center; flex:0 0 32px; height:32px; border-radius:50%; background:#eaf1fa; color:#2b5785; font-weight:700; }
.route-step.is-done .route-step-number { color:#fff; background:#176d51; }
.route-step-body { flex:1; min-width:0; }
.route-step-heading { display:flex; flex-wrap:wrap; align-items:center; gap:8px; justify-content:space-between; }
.route-step h2 { margin:3px 0; font-size:16px; line-height:1.5; }
.route-step p { font-size:13px; line-height:1.8; color:#526176; margin:9px 0 13px; }
.route-badge { color:#4a5767; background:#edf0f4; padding:4px 9px; font-size:11px; border-radius:20px; }
.route-step.is-done .route-badge { color:#135a42; background:#e3f3ec; }
.route-button { min-height:44px; padding:11px 16px; border:0; border-radius:10px; background:#1c5994; color:#fff; font:inherit; font-size:13px; font-weight:600; line-height:1.5; cursor:pointer; }
.route-button-quiet { background:#e7edf5; color:#254561; }
.route-button:disabled { background:#e5e9ee; color:#6b7480; cursor:not-allowed; }
.route-key-guide { display:flex; flex-wrap:wrap; gap:8px 14px; color:#4f6074; font-size:11px; }
.route-key-guide kbd { display:inline-block; padding:3px 6px; border:1px solid #c8d1de; border-bottom-width:2px; border-radius:5px; color:#233c59; background:#f5f8fc; font:inherit; font-weight:700; }
.route-notice { padding:16px; margin:20px 0; border:1px solid #ded6b7; border-radius:12px; background:#fcf8ea; color:#584a26; font-size:12px; line-height:1.8; }
.route-notice p { margin:5px 0 0; }
@media (max-width:600px) { .route-step { padding:14px 12px; gap:9px; } .route-journey { flex-wrap:wrap; justify-content:center; } .route-button { width:100%; margin-top:5px; } .route-launch { padding:12px; gap:9px; } }
@media (max-width:699px) { .sidebar-item > span { white-space:nowrap; } }
'''
write('src/ui-web/src/app.css', css)
js = read('src/ui-web/src/app.js')
js = once(js, "['overview', 'stone', 'vehicle', 'settings', 'update']", "['overview', 'stone', 'vehicle', 'routes', 'settings', 'update']")
js = once(js, "'vehicle-delete', 'vehicle-route', 'start-hotkey'", "'vehicle-delete', 'vehicle-route', 'overview-route', 'overview-route-summary',\n    'route-mode-hint', 'route-feedback', 'route-register', 'route-teach', 'route-trial',\n    'route-enable', 'route-return-home', 'route-voice', 'start-hotkey'")
js = once(js, '    renderVehicle(options.animate !== false && previousRevision >= 0);', '    renderVehicle(options.animate !== false && previousRevision >= 0);\n    renderRoutes();')
render = '''  function renderRoutes() {
    const route = state.routes || {};
    const busy = Boolean(state.running || state.registrationActive || route.busy);
    const hasVehicle = route.hasVehicle === true;
    const recorded = route.recorded === true;
    const trial = route.trialSaved === true;
    const enabled = booleanOf(control('vehicleEnabled', 'vehicleEnabledControl'));
    const statuses = [
      ['vehicle', hasVehicle, hasVehicle ? '荷台登録済み' : '未登録'],
      ['record', recorded, recorded ? '往復記録あり' : '未記録'],
      ['trial', trial, trial ? '前回の試走記録あり' : '未試走'],
      ['enable', enabled, enabled ? 'ON（開始時再確認）' : 'OFF'],
    ];
    for (const [name, done, text] of statuses) {
      document.getElementById(`route-step-${name}`).classList.toggle('is-done', done);
      document.getElementById(`route-${name === 'enable' ? 'enabled' : name}-badge`).textContent = text;
    }
    document.querySelectorAll('[data-route-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.routeMode === state.actionMode));
      button.disabled = busy;
    });
    setText(elements.routeModeHint, `現在の設定対象：${modeDetails[state.actionMode].label}。ルートは作業ごとに別保存です。`, false);
    setText(elements.routeFeedback, route.feedback || (busy
      ? '作業または登録中です。中止はF9。終了後に設定を変更できます。'
      : '上から順番に設定してください。荷台の登録だけでは徒歩移動は有効になりません。'), false);
    setText(elements.overviewRouteSummary, trial ? '往復の試走記録あり · 接続は開始時に再確認' : recorded ? '往復記録あり · 次は自動試走' : '未設定 · 車両登録 → 往復記録 → 自動試走', false);
    elements.routeRegister.disabled = busy;
    elements.routeTeach.disabled = busy || !hasVehicle;
    elements.routeTrial.disabled = busy || !recorded || !hasVehicle;
    elements.routeEnable.disabled = busy || (!enabled && (!trial || !hasVehicle));
    elements.routeEnable.textContent = enabled ? '自動収納・補充をOFF' : '自動収納・補充をON';
    elements.routeVoice.disabled = busy;
  }

'''
js = once(js, '  function renderVehicle(', render + '  function renderVehicle(')
js = once(js, "    elements.vehicleRoute.addEventListener('click', () => sendAction('vehicle.route'));", '''    const openRoutes = () => switchPage('routes', { animate: true, send: true });
    elements.vehicleRoute.addEventListener('click', openRoutes);
    elements.overviewRoute.addEventListener('click', openRoutes);
    elements.routeRegister.addEventListener('click', () => sendAction('vehicle.register'));
    elements.routeTeach.addEventListener('click', () => sendAction('route.teach', { mode: state.actionMode }));
    elements.routeTrial.addEventListener('click', () => sendAction('route.trial', { mode: state.actionMode }));
    elements.routeEnable.addEventListener('click', () => sendAction('vehicle.toggle', { enabled: !booleanOf(control('vehicleEnabled', 'vehicleEnabledControl')) }));
    elements.routeVoice.addEventListener('click', () => sendAction('vehicle.route'));
    elements.routeReturnHome.addEventListener('click', () => switchPage('overview', { animate: true, send: true }));
    document.querySelectorAll('[data-route-mode]').forEach((button) => {
      button.addEventListener('click', () => sendAction('action.select', { mode: button.dataset.routeMode }));
    });''')
js = once(js, "    if (action === 'vehicle.delete') {", '''    if (action === 'route.teach' || action === 'route.trial' || action === 'vehicle.route') {
      next.routes = { ...(next.routes || {}), feedback: '画面プレビューです。実際の記録・試走・別ウィンドウはWindows版EXEで行います。' };
    }
    if (action === 'vehicle.delete') {''')
js = js.replace('itemRect.left - navRect.left}px', 'itemRect.left - navRect.left + selected.parentElement.scrollLeft}px')
write('src/ui-web/src/app.js', js)

test = read('src/ui-web/test.mjs').replace("['overview', 'stone', 'vehicle', 'settings', 'update']", "['overview', 'stone', 'vehicle', 'routes', 'settings', 'update']")
test += r'''
for (const id of ['overview-route', 'vehicle-route', 'route-register', 'route-teach', 'route-trial', 'route-enable']) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(css, /\.route-launch\s*\{[^}]*background:#eaf2ff/);
assert.match(js, /sendAction\('route\.teach', \{ mode: state\.actionMode \}\)/);
assert.match(js, /sendAction\('route\.trial', \{ mode: state\.actionMode \}\)/);
assert.match(js, /trialSaved === true/);
assert.match(js, /routeTeach\.disabled = busy \|\| !hasVehicle/);
assert.match(css, /grid-auto-flow: column/);
for (const [,body] of html.matchAll(/<button\b[^>]*class="[^"]*primary-action[^"]*"[^>]*>([\s\S]*?)<\/button>/g)) {
  assert.match(body, /class="press-surface"/, 'white primary buttons must have a visible surface');
}
console.log('Route setup entries, visible surfaces and guarded commands verified');
'''
write('src/ui-web/test.mjs', test)
print('Route UI applied; Windows and browser validation remain required.')
