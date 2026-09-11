from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def change(text, old, new):
    if old not in text: raise RuntimeError('Preparation boundary missing: ' + old[:100])
    return text.replace(old, new)

p = HERE / 'web.py'
t = p.read_text(encoding='utf-8')
t = change(t, '                <button id="vehicle-route" class="primary-action secondary-primary pressable" type="button">徒歩ルート・音声設定（EXEのみ）</button>', '                  <button id="vehicle-route" class="primary-action secondary-primary pressable" type="button">徒歩ルート・音声設定（EXEのみ）</button>')
t = change(t, '    renderVehicle(options.animate !== false && previousRevision >= 0);', '    renderVehicle(previousRevision, options.animate !== false);')
t = change(t, "booleanOf(control('vehicleEnabled', 'vehicleEnabledControl'))", "booleanOf(control('vehicleEnabledControl')?.value)")
t = change(t, '${modeDetails[state.actionMode].label}', '${modeDetails[state.actionMode].title}')
t = change(t, "js = once(js, \"    elements.vehicleRoute.addEventListener('click', () => sendAction('vehicle.route'));\",", "js = once(js, \"    on('vehicle-route', 'click', () => sendAction('vehicle.route'));\",")
t = change(t, "js = once(js, \"    if (action === 'vehicle.delete') {\",", "js = once(js, \"      case 'vehicle.delete':\",")
t = change(t, """    if (action === 'route.teach' || action === 'route.trial' || action === 'vehicle.route') {
      next.routes = { ...(next.routes || {}), feedback: '画面プレビューです。実際の記録・試走・別ウィンドウはWindows版EXEで行います。' };
    }
    if (action === 'vehicle.delete') {""", """      case 'route.teach':
      case 'route.trial':
      case 'vehicle.route':
        next.routes = { ...(next.routes || {}), feedback: '画面プレビューです。実際の記録・試走・別ウィンドウはWindows版EXEで行います。' };
        break;
      case 'vehicle.delete':""")
t = change(t, "js = js.replace('itemRect.left - navRect.left}px', 'itemRect.left - navRect.left + selected.parentElement.scrollLeft}px')", "js = once(js, 'const left = Math.round(itemRect.left - navRect.left);', 'const left = Math.round(itemRect.left - navRect.left + nav.scrollLeft);')")
t = change(t, "test += r'''\n", "test = \"import assert from 'node:assert/strict';\\n\" + test\ntest += r'''\nconst js = script;\n")
p.write_text(t, encoding='utf-8', newline='\n')
p = HERE / 'backend.py'; t = p.read_text(encoding='utf-8')
t = change(t, '"stone", true, "update", true)', '"stone", true, "metagame", true, "stoneverse", true, "update", true)')
t = change(t, '"stone", true, "routes", true, "update", true)', '"stone", true, "metagame", true, "stoneverse", true, "routes", true, "update", true)')
t = change(t, 'OnMessage(0x004A, ReceiveWebUiCopyData)', 'OnMessage(0x004A, HandleWebUiCopyData)')
t = change(t, '((LocalNav.busy || LocalNav.requestActive) ? "true" : "false")', '((LocalNav.busy || LocalNav.requestActive || State.running || State.registrationActive || State.startInProgress) ? "true" : "false")')
p.write_text(t, encoding='utf-8', newline='\n')
for script in ['web.py', 'backend.py', 'overlay.py']:
    subprocess.run([sys.executable, str(HERE/script)], cwd=ROOT, check=True)
# C# newlines must be escapes, not visible backslash-n text in the overlay.
p = ROOT/'src/local-navigation/LocalNavigation.cs'
t = p.read_text(encoding='utf-8').replace(r'\\n', r'\n')
p.write_text(t, encoding='utf-8', newline='\n')
print('Prepared visible route setup and native overlay; validation not yet complete.')
