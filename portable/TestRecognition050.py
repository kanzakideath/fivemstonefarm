"""Production rendered-probe regression tests. No FiveM or real-player success claim."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--browser');p.add_argument('--output',default='recognition050-evidence');a=p.parse_args()
r=Path(__file__).parent;out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
probe=(r/'SceneProbe.js').read_text(encoding='utf-8-sig');checks=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=a.browser,args=['--no-sandbox']);context=browser.new_context(viewport={'width':1440,'height':900});page=context.new_page()
 html='''<html><body style="margin:0;background:#132330"><div id="shape" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:120px;height:120px;border-radius:50%;background:conic-gradient(white 0deg 180deg,#49ab99 180deg 210deg,#455362 210deg 360deg)"><div id="middle" style="position:absolute;inset:10px;border-radius:50%;background:#132330;display:grid;place-items:center"><span><b id="digit" style="font:48px Arial;color:white">4</b></span></div></div><script>window.received=[];for(const type of ['keydown','keypress','keyup'])window.addEventListener(type,e=>received.push([type,e.key,e.target.id]));</script></body></html>'''
 def fresh(text=html):
  page.set_content(text);page.evaluate('delete window.__fpProbe3');return json.loads(page.evaluate(probe))
 def candidate(key):return json.loads(page.evaluate('(key)=>__fpProbe3.describePixel({key})',key))
 for w,h in [(800,600),(1280,720),(1440,900),(1920,1080),(2560,1440),(3440,1440),(3840,2160)]:
  page.set_viewport_size({'width':w,'height':h});fresh();v=candidate(-1);assert v['valid'] and v['key']==4,(w,h,v)
  sampled=json.loads(page.evaluate('__fpProbe3.sample(false,null)'));assert sampled['ring']['present'] and not sampled['ring']['valid']
  assert page.evaluate('received.length')==0
  checks.append(f'css_round_bootstrap_nested_digit_{w}x{h}')
 page.set_viewport_size({'width':1440,'height':900});fresh();v=candidate(4)
 assert page.evaluate('(s)=>__fpProbe3.pixelKey({key:4,stamp:s,inside:true})',v['stamp'])=='SENT'
 page.wait_for_timeout(40);assert page.evaluate('received')==[['keydown','4','digit'],['keypress','4','digit'],['keyup','4','digit']]
 checks.append('css_pixel_binding_normal_keyboard_sequence')
 fresh();v=candidate(4);page.evaluate("digit.textContent='2'");assert page.evaluate('(s)=>__fpProbe3.pixelKey({key:4,stamp:s,inside:true})',v['stamp'])=='STALE';assert page.evaluate('received.length')==0;checks.append('changed_digit_never_uses_stale_capture')
 fresh();page.evaluate("document.body.insertAdjacentHTML('beforeend','<input id=chat>');chat.focus()");v=candidate(4);assert not v['valid'];assert page.evaluate("__fpProbe3.pixelKey({key:4,stamp:'a',inside:true})")=='EDITING';checks.append('chat_blocks_background_keyboard')
 fresh();page.evaluate("const twin=shape.cloneNode(true);twin.style.marginLeft='50px';document.body.append(twin)");assert not candidate(4)['valid'];checks.append('two_digits_no_broadcast')
 fresh();page.evaluate("shape.style.display='none'");assert not candidate(4)['valid'];checks.append('hidden_circle_no_input')
 fresh('<html><body style="margin:0"><div id="host"></div><script>window.received=[];window.addEventListener("keydown",e=>received.push(e.key))</script></body></html>')
 page.evaluate("""() => {const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div style="position:fixed;left:50%;top:50%;width:120px;height:120px;transform:translate(-50%,-50%);border-radius:50%;background:conic-gradient(white,teal);display:grid;place-items:center"><span style="font:40px Arial;color:white">3</span></div>'; }""")
 v=candidate(3);assert v['valid'];assert page.evaluate('(s)=>__fpProbe3.pixelKey({key:3,stamp:s,inside:true})',v['stamp'])=='SENT';assert page.evaluate('received')==['3'];checks.append('open_shadow_root_composed_input')
 fresh();other=context.new_page();other.set_content('<script>window.received=[];window.addEventListener("keydown",e=>received.push(e.key))</script>');other.bring_to_front();v=candidate(4);assert page.evaluate('(s)=>__fpProbe3.pixelKey({key:4,stamp:s,inside:true})',v['stamp'])=='SENT';assert other.evaluate('received.length')==0;checks.append('other_app_surface_receives_no_key')
 browser.close()
# These are source contracts rather than interactive game tests; kept separate in report.
engine=(r/'Engine.cs').read_text(encoding='utf-8-sig')
assert 'if(foreground&&c.Width>=300' in engine
assert 'Capture(scene.Present?scene:null,false)' in engine
assert 'if(!r.Valid&&!scene.Source.Contains("ambiguous")' in engine
assert 'if(foreground){sent=Native.Press' in engine
assert 'if(!foreground&&!options.BackgroundMode)' in engine
assert 'castInventoryTouched' in engine and 'book.Observe' in engine
report={'pass':True,'rendered_scenarios':checks,'source_contracts':['foreground_capture_independent_of_background_toggle','unknown_DOM_can_bootstrap_rendered_capture','foreground_native_input_and_targeted_background_separate','fresh_snapshot_replaces_live_stock'],'live_fivem':False}
(out/'RESULT.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('RECOGNITION050_PASS',len(checks),'rendered scenarios')
