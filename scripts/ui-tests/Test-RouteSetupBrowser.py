"""Browser checks against the actual HTML/CSS/JS, without a game or server.
All URLs are served from the checked-in offline bundle by a local interceptor.
Requires Python Playwright. This is not a live FiveM navigation test.
"""
import argparse
import json
import mimetypes
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'src/ui-web/www'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser')
    parser.add_argument('--output', default=str(ROOT / 'artifacts/route-ui'))
    args = parser.parse_args()
    output = Path(args.output); output.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as p:
        options = {'headless': True}
        if args.browser: options['executable_path'] = args.browser
        browser = p.chromium.launch(**options)
        for width, height in [(1366,850), (820,640), (600,640), (390,700)]:
            page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            def serve(route):
                from urllib.parse import urlparse, unquote
                requested = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
                file = (WEB / requested).resolve()
                if not file.is_relative_to(WEB.resolve()) or not file.is_file():
                    route.fulfill(status=404, body='Not found'); return
                content_type = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
                if file.suffix == '.js': content_type = 'application/javascript'
                if file.suffix in ['.js','.css','.html']: content_type += '; charset=utf-8'
                route.fulfill(status=200, body=file.read_bytes(), content_type=content_type)
            page.route('https://app.local/**', serve)
            page.add_init_script('''window.__sent = []; window.chrome = window.chrome || {};
                window.chrome.webview = { postMessage: m => window.__sent.push(m), addEventListener: () => {} };''')
            page.goto('https://app.local/index.html?fixture=1', wait_until='networkidle')
            page.wait_for_function('window.aiMinerTest && document.querySelector("#overview-route")')
            page.screenshot(path=str(output / f'overview-{width}.png'), full_page=True)
            assert page.locator('#overview-route').is_visible()
            colour = page.locator('#overview-route').evaluate('(el) => getComputedStyle(el).backgroundColor')
            assert colour not in ['rgba(0, 0, 0, 0)', 'transparent'], colour
            page.locator('#overview-route').click()
            page.wait_for_function('window.aiMinerTest.getState().page === "routes"')
            assert page.locator('#screen-routes').is_visible()
            assert page.locator('#route-teach').is_disabled()
            assert page.locator('#route-stationary').is_disabled()
            assert page.locator('#route-trial').is_disabled()
            assert page.locator('#route-enable').is_disabled()
            page.evaluate('''() => {
                const s = window.aiMinerTest.getState(); s.revision += 10;
                s.routes = {hasVehicle:true,recorded:false,trialSaved:false,busy:false,feedback:'テスト：荷台登録済み'};
                window.aiMinerTest.setState(s);
            }''')
            assert page.locator('#route-teach').is_enabled()
            assert page.locator('#route-stationary').is_enabled()
            assert page.locator('#route-trial').is_disabled()
            page.locator('[data-route-mode="washing"]').click()
            page.wait_for_function('window.aiMinerTest.getState().actionMode === "washing"')
            page.locator('#route-teach').click()
            assert page.evaluate("window.__sent.some(m => m.action === 'route.teach' && m.payload.mode === 'washing')")
            page.evaluate('''() => {
                const s = window.aiMinerTest.getState(); s.revision += 10;
                s.routes = {hasVehicle:true,recorded:true,trialSaved:false,busy:false,feedback:'テスト：往復記録あり'};
                window.aiMinerTest.setState(s);
            }''')
            assert page.locator('#route-trial').is_enabled()
            assert page.locator('#route-enable').is_disabled()
            page.locator('#route-trial').click()
            assert page.evaluate("window.__sent.some(m => m.action === 'route.trial' && m.payload.mode === 'washing')")
            page.evaluate('''() => {
                const s = window.aiMinerTest.getState(); s.revision += 10;
                s.routes = {hasVehicle:true,recorded:true,trialSaved:true,busy:false,feedback:'テスト：前回の試走記録あり。接続は開始時に再確認。'};
                window.aiMinerTest.setState(s);
            }''')
            assert page.locator('#route-enable').is_enabled()
            page.locator('#route-enable').click()
            assert page.evaluate("window.__sent.some(m => m.action === 'vehicle.toggle' && m.payload.enabled === true)")
            page.evaluate('''() => {
                const s = window.aiMinerTest.getState(); s.revision += 10; s.routes.busy = true;
                window.aiMinerTest.setState(s);
            }''')
            for selector in ['#route-register','#route-teach','#route-stationary','#route-trial','#route-enable','[data-route-mode="gold"]']:
                assert page.locator(selector).is_disabled(), selector
            page.evaluate('''() => {
                const s = window.aiMinerTest.getState(); s.revision += 10; s.routes.busy = false;
                window.aiMinerTest.setState(s);
            }''')
            page.locator('#route-stationary').click()
            assert page.evaluate("window.__sent.some(m => m.action === 'route.stationary' && m.payload.mode === 'washing')")
            page.evaluate('''() => {
                const s = window.aiMinerTest.getState(); s.revision += 10;
                s.routes = {hasVehicle:true,recorded:true,trialSaved:true,busy:false,method:'stationary',feedback:'近接モードの表示試験です。実際の荷台確認ではありません。'};
                window.aiMinerTest.setState(s);
            }''')
            page.evaluate("""() => {
                const s = window.aiMinerTest.getState(); s.revision += 1;
                s.routes.washFeedback = '補正確認 / W入力 2回・計80ms / ずれ 0.1px';
                window.aiMinerTest.setState(s);
            }""")
            assert '80ms' in page.locator('#route-wash-position').inner_text()
            assert '近接' in page.locator('#route-trial').inner_text()
            assert '近接モード' in page.locator('#route-record-badge').inner_text()
            assert page.locator('#route-enable').is_enabled()
            page.screenshot(path=str(output / f'nearby-{width}.png'), full_page=True)
            page.locator('#route-return-home').click()
            page.locator('#tab-vehicle').click()
            assert page.locator('#vehicle-route').is_visible()
            page.locator('#vehicle-route').click()
            assert page.locator('#screen-routes').is_visible()
            page.locator('#tab-overview').click()
            page.locator('#tab-routes').click()
            assert page.locator('#screen-routes').is_visible()
            page.locator('#content-stage').evaluate('(el) => { el.scrollTop = 0; }')
            page.locator('#screen-routes').evaluate('(el) => { el.scrollTop = 0; }')
            page.wait_for_timeout(350)
            page.screenshot(path=str(output / f'routes-{width}.png'), full_page=True)
            overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
            assert not overflow, f'Horizontal page overflow at {width}'
            assert not errors, errors
            results.append({'width':width,'height':height,'passed':True,'pageErrors':errors,'pageOverflow':overflow})
            page.close()
        browser.close()
    (output/'results.json').write_text(json.dumps({'kind':'offline UI fixture, not game navigation','results':results},ensure_ascii=False,indent=2), encoding='utf-8')
    print('ROUTE_UI_BROWSER_PASS: four viewports, three entries, guarded setup stages and actual action payloads')

if __name__ == '__main__': main()
