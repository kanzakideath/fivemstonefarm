from pathlib import Path
R=Path(__file__).resolve().parents[2]
def edit(path,old,new):
    p=R/path;s=p.read_text(encoding='utf-8-sig')
    if s.count(old)!=1: raise RuntimeError(str(path)+': '+old[:90])
    p.write_text(s.replace(old,new),encoding='utf-8',newline='\n')
p='src/ui-web/src/index.html'
edit(p,'<h2>現場との往復を教える</h2>','<h2>収納方法を選ぶ</h2>')
edit(p,'<p>作業できる位置から開始。画面上の案内に従って荷台まで歩き、同じ現場へ戻ります。石洗いは手持ち石を用意してください。</p>', '''<div class="route-nearby-option">
                      <strong>作業と荷台のボタンが同じ場所で出る場合はこちら</strong>
                      <p>立ち位置・視点を変えずに、作業 → 登録荷台 → 作業を確認します。徒歩記録は不要です。確認ではアイテムを動かしません。</p>
                      <button id="route-stationary" type="button" class="route-button">この位置で近接収納を確認（歩かない）</button>
                    </div>
                    <p><strong>荷台まで歩く必要がある場合：</strong>現場から往復を記録します。視点を勝手に下へ動かしません。各片道の準備画面で、向きを整えて <kbd>F6</kbd> を押すと記録開始。石洗いは手持ち石を用意してください。</p>''')
edit(p,'<h2>収納せずに自動試走</h2>','<h2>実際の接続・終点を確認</h2>')
edit(p,'<p>元の作業位置から自動で往復します。荷台IDと現場の作業ボタンを確認できた場合だけ試走済みになります。</p>', '<p>徒歩モードは元の現場から自動で往復。近接モードは移動せず再確認します。登録荷台と作業ボタンの実確認に成功した場合だけ利用可能になります。</p>')
edit(p,'<kbd>F6</kbd> 照合点','<kbd>F6</kbd> 開始／照合点')
p='src/ui-web/src/app.js'
edit(p,"'route-mode-hint', 'route-feedback', 'route-register', 'route-teach', 'route-trial',", "'route-mode-hint', 'route-feedback', 'route-register', 'route-teach', 'route-trial', 'route-stationary',")
edit(p,"departure: '徒歩移動を開始。収納はまだ確認していません。',", "departure: '収納先への移動／近接確認を開始。収納はまだ確認していません。',")
edit(p,'    const trial = route.trialSaved === true;', "    const trial = route.trialSaved === true;\n    const stationary = route.method === 'stationary';")
edit(p,"['record', recorded, recorded ? '往復記録あり' : '未記録'],", "['record', recorded, recorded ? (stationary ? '近接モード' : '往復記録あり') : '未設定'],")
edit(p,"['trial', trial, trial ? '前回の試走記録あり' : '未試走'],", "['trial', trial, trial ? (stationary ? '近接確認済み' : '前回の試走記録あり') : '未確認'],")
edit(p,"`現在の設定対象：${modeDetails[state.actionMode].label}。ルートは作業ごとに別保存です。`", "`現在の設定対象：${modeDetails[state.actionMode].label}。方式：${stationary ? '近接収納（歩かない）' : '徒歩ルート'}。作業ごとに別保存です。`")
edit(p,"    elements.routeTeach.disabled = busy || !hasVehicle;", "    elements.routeTeach.disabled = busy || !hasVehicle;\n    elements.routeStationary.disabled = busy || !hasVehicle;\n    elements.routeTrial.textContent = stationary ? '近接状態を再確認（収納なし）' : '自動試走を開始（収納なし）';")
edit(p,"trial ? '往復の試走記録あり · 接続は開始時に再確認'", "trial ? (stationary ? '近接収納の確認済み · 移動せず毎回荷台を確認' : '往復の試走記録あり · 接続は開始時に再確認')")
edit(p,"action === 'route.trial' || action === 'vehicle.route'", "action === 'route.trial' || action === 'route.stationary' || action === 'vehicle.route'")
edit(p,"    elements.routeTeach.addEventListener('click', () => sendAction('route.teach', { mode: state.actionMode }));", "    elements.routeTeach.addEventListener('click', () => sendAction('route.teach', { mode: state.actionMode }));\n    elements.routeStationary.addEventListener('click', () => sendAction('route.stationary', { mode: state.actionMode }));")
p=R/'src/ui-web/src/app.css';p.write_text(p.read_text()+'''\n.route-nearby-option { padding: 16px; margin: 12px 0 18px; border: 1px solid #83bab1; border-radius: 12px; background: #eef8f5; color: #184e43; }
.route-nearby-option .route-button { background: #126755; color: #fff; }
.route-feedback { overflow-wrap: anywhere; }
''',encoding='utf-8',newline='\n')
p='scripts/ui-tests/Test-RouteSetupBrowser.py'
edit(p,"            assert page.locator('#route-teach').is_disabled()", "            assert page.locator('#route-teach').is_disabled()\n            assert page.locator('#route-stationary').is_disabled()")
edit(p,"            assert page.locator('#route-teach').is_enabled()", "            assert page.locator('#route-teach').is_enabled()\n            assert page.locator('#route-stationary').is_enabled()")
edit(p,"['#route-register','#route-teach','#route-trial','#route-enable','[data-route-mode=\"gold\"]']", "['#route-register','#route-teach','#route-stationary','#route-trial','#route-enable','[data-route-mode=\"gold\"]']")
edit(p,"            page.locator('#route-return-home').click()", '''            page.locator('#route-stationary').click()
            assert page.evaluate("window.__sent.some(m => m.action === 'route.stationary' && m.payload.mode === 'washing')")
            page.evaluate('''+"'''"+'''() => {
                const s = window.aiMinerTest.getState(); s.revision += 10;
                s.routes = {hasVehicle:true,recorded:true,trialSaved:true,busy:false,method:'stationary',feedback:'近接モードの表示試験です。実際の荷台確認ではありません。'};
                window.aiMinerTest.setState(s);
            }'''+"'''"+''')
            assert '近接' in page.locator('#route-trial').inner_text()
            assert '近接モード' in page.locator('#route-record-badge').inner_text()
            assert page.locator('#route-enable').is_enabled()
            page.screenshot(path=str(output / f'nearby-{width}.png'), full_page=True)
            page.locator('#route-return-home').click()''')
for name in ['src/mining-auto.ahk','src/ui-web/src/app.js','src/ui-web/package.json','src/ui-web/package-lock.json','config/AI採掘機.ini','README.md','src/README.md']:
    p=R/name;s=p.read_text(encoding='utf-8-sig')
    if '9.1.9' not in s: raise RuntimeError('Version boundary: '+name)
    p.write_text(s.replace('9.1.9','9.1.10'),encoding='utf-8',newline='\n')
p=R/'scripts/Test-ExeRoutes.ps1';s=p.read_text(encoding='utf-8-sig')
s+='''
Assert-Check (-not $helper.Contains('NormalisePitch')) 'Forced camera normalization returned.'
Assert-Check ($helper.Contains('RequirePlayback(mode); Guard();') -and $helper.Contains('RECORDING_INJECTION_POLICY_TEST')) 'Passive recording input policy missing.'
Assert-Check ($helper.Contains('LEGACY_ROUTE_RERECORD_NO_PITCH')) 'Legacy route needs explicit re-recording.'
Assert-Check ($module.Contains('EvaluateStationarySpot(') -and $main.Contains('ValidateStationaryWorkflow()')) 'Stationary workflow/compiled test missing.'
$start = $module.IndexOf('ProbeExeRouteCargo(generation,')
$end = $module.IndexOf('; This receipt', $start)
Assert-Check ($start -ge 0 -and $end -gt $start) 'Endpoint boundary missing.'
$endpoints = $module.Substring($start, $end - $start)
Assert-Check (-not $endpoints.Contains('ExeRouteCameraStep(')) 'Endpoint check must not change the recorded view.'
Write-Host 'Passive recording and stationary source contracts passed. Live game checks are separate.'
'''
p.write_text(s,encoding='utf-8-sig',newline='\n')
print('Nearby UI and versioned regression coverage applied; full build and browser tests required.')
