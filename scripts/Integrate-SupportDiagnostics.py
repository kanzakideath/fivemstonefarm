from pathlib import Path
import subprocess
r=Path(__file__).resolve().parents[1]
subprocess.run(['git','diff','--exit-code','d775e88e0bbb068c6ff01dca2c83c1aa4d684357','HEAD','--','src/mining-auto.ahk','src/ui-host/Protocol.cs','scripts/Build.ps1','src/ui-web/src','src/wash-position.ahk','scripts/ui-tests/Test-RouteSetupBrowser.py'],cwd=r,check=True)
def edit(name,old,new):
 p=r/name;b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
 if s.count(old)!=1: raise RuntimeError((name,old[:80],s.count(old)))
 s=s.replace(old,new,1)
 p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.encode())
edit('src/mining-auto.ahk','buttonTemplatePath := A_Temp', '''#Include diagnostics.ahk
InitSupportDiagnostics(persistentDataRoot, isUiTestRun || isValidationRun || isHistoryImportTestRun || HasCommandLineArgument("--cursor-api-test"), processId)
buttonTemplatePath := A_Temp''')
edit('src/mining-auto.ahk','    if !ValidateStorageCycleProof() || !ValidateStationaryWorkflow() || !ValidateNearbyWashRecovery() {','    if !ValidateStorageCycleProof() || !ValidateStationaryWorkflow() || !ValidateNearbyWashRecovery() || !ValidateSupportDiagnostics() {')
edit('src/mining-auto.ahk','WriteDiagnostic(message) {\n    global State', '''WriteDiagnostic(message) {
    global State
    ; Keep the legacy reward-import format intact; journal is separately bounded.
    SupportWriteEvent("TRACE", message)''')
edit('src/mining-auto.ahk','    ObserveStorageCycle(expectedGeneration, "stopped", resolvedCode)', '    SupportWriteEvent("FAULT", "code=" resolvedCode " detail=" message)\n    ObserveStorageCycle(expectedGeneration, "stopped", resolvedCode)')
edit('src/mining-auto.ahk', '''            } else if action = "window.close" && parts.Length = 3 {''','''            } else if action = "diagnostics.mark" && parts.Length = 3 {
                SupportMarkProblem()
            } else if action = "diagnostics.export" && parts.Length = 3 {
                ExportSupportDiagnostics()
            } else if action = "diagnostics.clientError" && parts.Length = 4 {
                SupportWriteEvent("WEB_ERROR", parts[4])
            } else if action = "window.close" && parts.Length = 3 {''')
edit('src/mining-auto.ahk','        . \',"routes":\' ExeRouteSetupStateJson(actionMode)','        . \',"diagnostics":\' SupportUiJson()\n        . \',"routes":\' ExeRouteSetupStateJson(actionMode)')
edit('src/wash-position.ahk','            try FileCopy path ".last-run.json", LocalNav.root "\\wash-position-last.json", true','''            try FileCopy path ".last-run.json", LocalNav.root "\\wash-position-last.json", true
            SupportReportEvent(path ".last-run.json", "WASH_REPORT")''')
edit('scripts/Build.ps1',"Copy-Item -LiteralPath (Join-Path $sourceRoot 'nearby-wash.ahk') -Destination $stageRoot -Force", "Copy-Item -LiteralPath (Join-Path $sourceRoot 'nearby-wash.ahk') -Destination $stageRoot -Force\nCopy-Item -LiteralPath (Join-Path $sourceRoot 'diagnostics.ahk') -Destination $stageRoot -Force")
edit('scripts/Build.ps1',"        '/reference:System.Windows.Forms.dll',", "        '/reference:System.Windows.Forms.dll',\n        '/reference:System.IO.Compression.dll',\n        '/reference:System.IO.Compression.FileSystem.dll',")
edit('scripts/Build.ps1',"$washPositionOutput = Join-Path $stageRoot 'WashPosition.exe'", "$diagnosticsOutput = Join-Path $stageRoot 'Diagnostics.exe'\nInvoke-CSharpBuild -Source (Join-Path $sourceRoot 'diagnostics\\Diagnostics.cs') -Output $diagnosticsOutput\nInvoke-CapabilitySmokeTest -Executable $diagnosticsOutput -Expected 'SELFTEST OK' -Mode 'self-test'\n$washPositionOutput = Join-Path $stageRoot 'WashPosition.exe'")
edit('src/ui-host/Protocol.cs','                    case "window.close":', '''                    case "diagnostics.mark":
                    case "diagnostics.export":
                    case "window.close":''')
edit('src/ui-host/Protocol.cs','                    case "nav":', '''                    case "diagnostics.clientError":
                        EnsureOnlyKeys(payload, "message");
                        values.Add(GetSafeString(payload, "message", 400));
                        break;

                    case "nav":''')
edit('src/ui-host/Protocol.cs','                AssertAction(@"{""type"":""action"",""action"":""route.stationary""', '''                AssertAction(@"{""type"":""action"",""action"":""diagnostics.export"",""payload"":{}}", "diagnostics.export", new string[0]);
                AssertRejected(@"{""type"":""action"",""action"":""diagnostics.export"",""payload"":{""path"":""secret""}}");
                AssertAction(@"{""type"":""action"",""action"":""diagnostics.mark"",""payload"":{}}", "diagnostics.mark", new string[0]);
                AssertAction(@"{""type"":""action"",""action"":""route.stationary""''')
edit('src/ui-web/src/index.html','                <button id="settings-save"', '''                <section id="support-diagnostics" class="support-card" aria-labelledby="support-heading">
                  <h2 id="support-heading">不具合の記録・診断ZIP</h2>
                  <p>操作・停止理由・前進入力と効果をローカルに自動記録します。再起動しても直近約10MiBを保持します。</p>
                  <p>画像・チャット・セーブ・INI全体は収集しません。外部への自動送信はありません。</p>
                  <p id="diagnostics-status" role="status" aria-live="polite">診断の状態を確認中</p>
                  <div class="support-actions">
                    <button id="diagnostics-mark" class="support-button" type="button">今の不具合に目印を付ける</button>
                    <button id="diagnostics-export" class="support-button support-primary" type="button">診断ZIPを保存</button>
                  </div>
                  <p id="diagnostics-feedback" role="status" aria-live="polite">不具合が起きたら目印 → F9で停止 → 診断ZIPを保存 → このチャットへ添付してください。共有前に内容を確認できます。</p>
                </section>

                <button id="settings-save"''')
edit('src/ui-web/src/index.html','                  <p id="route-wash-position">未計測。FiveMを前面にして石洗いを開始してください。</p>', '''                  <p id="route-wash-position">未計測。FiveMを前面にして石洗いを開始してください。</p>
                  <button id="route-diagnostics" class="support-button" type="button">不具合の診断ZIP・ログを開く</button>''')
edit('src/ui-web/src/index.html','                <p id="update-feedback" class="persistent-feedback" role="status" aria-live="polite"></p>', '''                <p id="update-feedback" class="persistent-feedback" role="status" aria-live="polite"></p>
                <button id="update-diagnostics" class="support-button" type="button">更新失敗の診断ZIP・ログを開く</button>''')
edit('src/ui-web/src/app.js', "    'app-version', 'overview-subtitle'", "    'diagnostics-status', 'diagnostics-mark', 'diagnostics-export', 'diagnostics-feedback', 'route-diagnostics', 'update-diagnostics',\n    'app-version', 'overview-subtitle'")
edit('src/ui-web/src/app.js','    renderRoutes();','    renderRoutes();\n    renderDiagnostics();')
edit('src/ui-web/src/app.js','  function renderRoutes() {', '''  function renderDiagnostics() {
    const diagnostic = state.diagnostics || {};
    const busy = Boolean(state.running || state.registrationActive || state.routes?.busy || diagnostic.busy);
    const status = diagnostic.writeFailures > 0
      ? `ログ書込失敗 ${diagnostic.writeFailures}回。空き容量・保存先を確認してください。`
      : diagnostic.enabled === true ? 'ローカルに記録中 · 外部送信なし'
      : fixtureMode ? '画面プレビュー（ログ保存なし）' : '診断ログの状態を確認中';
    setText(elements.diagnosticsStatus, status, false);
    elements.diagnosticsExport.disabled = busy;
    elements.diagnosticsMark.disabled = Boolean(diagnostic.busy);
    setText(elements.diagnosticsFeedback, diagnostic.feedback || (busy
      ? '不具合に目印を付けてからF9で停止すると、診断ZIPを保存できます。'
      : '診断ZIPを保存して、このチャットへ添付してください。送信前にZIPの内容を確認してください。'), false);
  }

  function renderRoutes() {''')
edit('src/ui-web/src/app.js', "    actionButton.addEventListener('click', openActionPicker);", '''    actionButton.addEventListener('click', openActionPicker);
    elements.diagnosticsMark.addEventListener('click', () => sendAction('diagnostics.mark'));
    elements.diagnosticsExport.addEventListener('click', () => sendAction('diagnostics.export'));
    const openDiagnostics = () => {
      switchPage('settings', { animate: true, send: true });
      requestAnimationFrame(() => document.getElementById('support-diagnostics').scrollIntoView({ block: 'center', behavior: 'instant' }));
    };
    elements.routeDiagnostics.addEventListener('click', openDiagnostics);
    elements.updateDiagnostics.addEventListener('click', openDiagnostics);''')
edit('src/ui-web/src/app.js', "    if (action === 'update.check') {", '''    if (action === 'diagnostics.mark' || action === 'diagnostics.export') {
      next.diagnostics = { ...(next.diagnostics || {}), feedback: '画面プレビューです。実際の診断ZIPはWindows版EXEで保存します。外部送信なし。' };
    }
    if (action === 'update.check') {''')
edit('src/ui-web/src/app.js','  function sendAction(action, payload = {}) {', '''  let diagnosticErrorCount = 0;
  let diagnosticErrorWindow = Date.now();
  function reportClientError(message) {
    if (Date.now() - diagnosticErrorWindow > 30000) { diagnosticErrorCount = 0; diagnosticErrorWindow = Date.now(); }
    if (++diagnosticErrorCount > 5) return;
    sendAction('diagnostics.clientError', { message: String(message || 'Unknown web error').replace(/[\\r\\n\\t]/g, ' ').slice(0, 400) });
  }
  window.addEventListener('error', event => reportClientError(event.message));
  window.addEventListener('unhandledrejection', event => reportClientError(event.reason?.message || 'Unhandled promise rejection'));

  function sendAction(action, payload = {}) {''')
p=r/'src/ui-web/src/app.css';p.write_text(p.read_text(encoding='utf-8')+'''\n/* Readable support actions independent of animated press surfaces. */
.support-card { margin: 24px 0; padding: 22px; border: 1px solid #ccd4e4; border-radius: 18px; background: #fff; overflow-wrap: anywhere; }
.support-card h2 { margin: 0 0 12px; font-size: 19px; }
.support-card p { line-height: 1.65; }
.support-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.support-button { min-height: 44px; max-width: 100%; border: 1px solid #527195; border-radius: 12px; background: #edf3fc; color: #1e3655; padding: 12px 16px; cursor: pointer; font: inherit; font-weight: 600; white-space: normal; }
.support-primary { color: #fff; background: #335b8b; }
.support-button:disabled { opacity: .55; cursor: not-allowed; }
.support-button:focus-visible { outline: 3px solid #4479ff; outline-offset: 3px; }
''',encoding='utf-8',newline='\n')
edit('scripts/ui-tests/Test-RouteSetupBrowser.py',"            assert not errors, errors",'''            page.locator('#route-diagnostics').click()
            page.wait_for_function('window.aiMinerTest.getState().page === "settings"')
            assert page.locator('#diagnostics-export').is_visible()
            assert page.locator('#diagnostics-export').is_enabled()
            page.locator('#diagnostics-mark').click()
            page.locator('#diagnostics-export').click()
            assert page.evaluate("window.__sent.some(m => m.action === 'diagnostics.mark' && Object.keys(m.payload).length === 0)")
            assert page.evaluate("window.__sent.some(m => m.action === 'diagnostics.export' && Object.keys(m.payload).length === 0)")
            page.screenshot(path=str(output / f'diagnostics-{width}.png'), full_page=True)
            page.evaluate("() => { const s=window.aiMinerTest.getState();s.revision+=10;s.running=true;window.aiMinerTest.setState(s); }")
            assert page.locator('#diagnostics-export').is_disabled()
            assert page.locator('#diagnostics-mark').is_enabled()
            assert not page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
            assert not errors, errors''')
edit('src/mining-auto.ahk','    A_TrayMenu.Add("キー・動作設定", ShowSettings)', '    A_TrayMenu.Add("キー・動作設定", ShowSettings)\n    A_TrayMenu.Add("不具合の目印を記録", SupportMarkProblem)\n    A_TrayMenu.Add("診断ZIPを保存（停止後）", ExportSupportDiagnostics)')
print('Patched runtime, local export, protocol, UI and executable regressions.')
