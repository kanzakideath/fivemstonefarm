from pathlib import Path
import json,argparse,mimetypes
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--browser');p.add_argument('--inline',action='store_true');p.add_argument('--output',default='ui-evidence');a=p.parse_args();r=Path(__file__).parent/'ui';out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
state={'type':'state','version':'0.6.0-preview','busy':False,'countdown':0,'feedback':'','status':{'Phase':'停止中','Ring':'未検出','Backend':'未確認','Delivery':'未確認','ReadMs':0,'Inventory':'未確認','Hunger':'未確認','Thirst':'未確認'},'settings':{'ObserveOnly':True,'BackgroundMode':True,'AutoNeeds':True,'FoodKey':1,'DrinkKey':3,'ReserveGrams':500,'GaugeRadius':20,'MinRecastMs':1400,'ShowOverlay':True}}
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=a.browser,args=['--no-sandbox']);ctx=b.new_context();page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 ctx.add_init_script("window.__sent=[];window.chrome={webview:{postMessage:m=>__sent.push(m),addEventListener:(type,cb)=>window.__receive=cb}}")
 def serve(route):
  from urllib.parse import urlparse,unquote
  rel=unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html';f=(r/rel).resolve()
  if not f.is_relative_to(r.resolve()) or not f.is_file():route.fulfill(status=404,body='not found');return
  route.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
 ctx.route('http://127.0.0.1:8765/**',serve)
 for width in [1366,1160,820,600,390]:
  if a.inline:
   page.close();page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_viewport_size({'width':width,'height':900})
  if a.inline:
   import re
   body=(r/'index.html').read_text(encoding='utf-8');body=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', body)
   for file in ['vendor/framework7-bundle.min.css','app.css']:body=body.replace('<link rel="stylesheet" href="'+file+'">','<style>'+(r/file).read_text(encoding='utf-8')+'</style>')
   for file in ['vendor/framework7-bundle.min.js','app.js']:body=body.replace('<script src="'+file+'"></script>','')
   page.set_content(body);page.evaluate("window.__sent=[];window.chrome={webview:{postMessage:m=>__sent.push(m),addEventListener:(type,cb)=>window.__receive=cb}}")
   for file in ['vendor/framework7-bundle.min.js','app.js']:page.add_script_tag(content=(r/file).read_text(encoding='utf-8'))
  else:page.goto('http://127.0.0.1:8765/index.html')
  page.wait_for_function('window.fishingUi');page.evaluate('(d)=>window.__receive({data:d})',state);page.wait_for_timeout(250)
  assert page.evaluate('fishingApp.theme')=='ios';assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  assert page.locator('#start').is_visible();page.locator('#start').click();assert page.evaluate("__sent.some(m=>m.action==='start')")
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'busy':True,'status':{**state['status'],'Running':True}});assert page.locator('#stop').is_visible() and page.locator('#start').is_hidden();page.locator('#stop').click();assert page.evaluate("__sent.some(m=>m.action==='stop')")
  page.evaluate('(d)=>window.__receive({data:d})',state);page.locator('[data-page=settings]').click();page.wait_for_timeout(200);page.locator('#FoodKey').select_option('4');page.locator('#save').click();last=page.evaluate("__sent.filter(m=>m.action==='save').at(-1)");assert last['settings']['FoodKey']==4 and last['settings']['BackgroundMode']
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'settings':{**state['settings'],'FoodKey':4},'feedback':'設定を保存しました'});assert page.locator('#FoodKey').input_value()=='4'
  page.screenshot(path=str(out/f'settings-{width}.png'),full_page=True)
  page.locator('[data-page=diagnostics]').click();page.wait_for_timeout(200);page.locator('#export').click();assert page.evaluate("__sent.some(m=>m.action==='diagnostics.export')")
  storage={'registered':False,'candidateId':'trunk-test','candidateLabel':'Test truck','candidates':[{'name':'fish','count':3}],'selected':[]}
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'storage':storage});page.locator('[data-page=storage]').click();page.wait_for_timeout(100)
  page.locator('[data-storage-item=fish]').check();page.locator('#storage-register').click();assert page.evaluate("__sent.some(m=>m.action==='storage.register'&&m.items[0]==='fish')")
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  page.screenshot(path=str(out/f'storage-{width}.png'),full_page=True)
  page.locator('[data-page=version]').click();page.wait_for_timeout(200);assert page.locator('#page-version').is_visible()
  page.locator('[data-page=overview]').click();page.wait_for_timeout(200);page.screenshot(path=str(out/f'overview-{width}.png'),full_page=True)
  sample_status={**state['status'],'InventoryFresh':True,'HeldItems':[{'Name':'fish','Label':'表示検証の魚','Count':7}],'CaughtItems':[{'Name':'fish','Label':'表示検証の魚','Total':3}]}
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'status':sample_status})
  assert '7' in page.locator('#held-items').inner_text() and '3' in page.locator('#caught-items').inner_text()
  page.screenshot(path=str(out/f'inventory-{width}.png'),full_page=True)
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'status':{**sample_status,'HeldItems':[]}})
  assert page.locator('#held-items .row').count()==0 and '3' in page.locator('#caught-items').inner_text()
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'status':{**sample_status,'InventoryFresh':False}})
  assert '更新待ち' in page.locator('#inventory-age').inner_text()
  assert 'F5' in page.locator('body').inner_text() and 'F6' in page.locator('body').inner_text()
  page.locator('[data-page=settings]').click();page.locator('#open-overlay').click();assert page.locator('#page-overlay').is_visible()
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'busy':True,'status':{**sample_status,'Running':True}})
  page.locator('#overlay-Opacity').fill('75');page.locator('label.row:has(#AutoNudge)').click();page.locator('#overlay-Position').select_option('bottom-right');page.locator('#overlay-save').click()
  submitted=page.evaluate("__sent.filter(m=>m.action==='overlay.save').at(-1)");assert submitted['settings']['Overlay']['Opacity']==75 and submitted['settings']['AutoNudge'] and submitted['settings']['Overlay']['Position']=='bottom-right'
  assert len(submitted['settings']['Overlay'])==15
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  page.screenshot(path=str(out/f'overlay-settings-{width}.png'),full_page=True)
  live={'Fresh':True,'Weight':'48.50 / 150.00 kg','SessionValue':{'Known':True,'Total':1260000,'UnknownKinds':0},'HeldValue':{'Known':True,'Total':600000,'UnknownKinds':0},'TrunkValue':{'Known':True,'Total':4620000,'UnknownKinds':1},'TrunkKnown':True,'TrunkOpen':True,'TrunkLabel':'表示試験の荷台','TrunkUpdated':'12:00:00'}
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'status':{**sample_status,'Live':live}});page.locator('[data-page=overview]').click()
  assert '1,260,000' in page.locator('#session-value').inner_text() and '未登録1種' in page.locator('#trunk-value').inner_text()
  page.screenshot(path=str(out/f'finance-{width}.png'),full_page=True)
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'status':{**sample_status,'Live':{**live,'Fresh':False,'TrunkOpen':False}}});assert '最終確認' in page.locator('#trunk-age').inner_text()
  results.append({'width':width,'no_horizontal_overflow':True,'start_stop_settings_diagnostics':True})
 assert not errors,errors;b.close()
(out/'RESULT.json').write_text(json.dumps({'pass':True,'cases':results,'page_errors':errors,'native_backend':'mock for browser-only layout test; separate Windows WebView2 handshake test','live_fivem':False,'inline_fixture_without_csp':a.inline},indent=2),encoding='utf-8');print('UI030_PASS',len(results),'widths')
