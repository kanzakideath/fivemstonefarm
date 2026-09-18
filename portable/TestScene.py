from pathlib import Path
import json, math, argparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--browser');p.add_argument('--output',default='scene-evidence');a=p.parse_args()
root=Path(__file__).parent;out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
probe=(root/'SceneProbe.js').read_text(encoding='utf-8-sig'); L=2*math.pi*60
html='''<html><body style="margin:0;background:#101d28;color:white">
<div class="stage" style="position:absolute;left:50%;top:50%;width:260px;height:260px;transform:translate(-50%,-50%)">
<svg width="260" height="260"><circle cx="130" cy="130" r="60" fill="none" stroke="#465363" stroke-width="9"/>
<circle id="green" cx="130" cy="130" r="60" fill="none" stroke="#46a99b" stroke-width="9" transform="rotate(110 130 130)"/>
<circle id="white" cx="130" cy="130" r="60" fill="none" stroke="#ffffff" stroke-width="9" transform="rotate(-90 130 130)"/></svg>
<div id="digit" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:48px Arial">1</div>
</div><div id="notice" role="alert"></div>
<progress aria-label="hunger" max="100" value="43" style="position:absolute;left:5px;bottom:5px"></progress>
<script>window.keys=[];document.addEventListener('keydown',e=>keys.push(e.key));</script></body></html>'''
checks=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=a.browser,args=['--no-sandbox'])
 context=browser.new_context();page=context.new_page()
 for width,height in [(800,600),(1280,720),(1440,900),(1920,1080),(2560,1440),(3440,1440),(3840,2160)]:
  page.set_viewport_size({'width':width,'height':height});page.set_content(html)
  page.evaluate('''([L])=>{green.style.strokeDasharray=L;green.style.strokeDashoffset=L-L*50/360;white.style.strokeDasharray=L;white.style.strokeDashoffset=L-L*218/360;}''',[L])
  for zoom in [0.75,1,1.5]:
   page.evaluate('(v)=>document.body.style.zoom=v',zoom)
   d=json.loads(page.evaluate(probe));r=d['ring'];assert r['valid'] and r['key']==1,(width,height,zoom,d)
   assert abs(r['start']-200)<.2 and abs(r['pointer']-218)<.2,(zoom,r)
   checks.append({'viewport':[width,height],'zoom':zoom,'key':r['key'],'start':r['start'],'pointer':r['pointer']})
  page.evaluate("document.body.style.zoom=1")
  page.screenshot(path=str(out/f'ring-{width}.png'))
 # Screen coordinates and CSS scale do not define the decision: SVG transforms do.
 page.evaluate("document.body.style.zoom=1")
 # Additional same digit/changed digit values, hidden overlays, unrelated notifications.
 for k in range(10):
  page.evaluate('(k)=>digit.textContent=String(k)',k);d=json.loads(page.evaluate(probe));assert d['ring']['valid'] and d['ring']['key']==k
 page.evaluate("document.querySelector('.stage').style.display='none'");assert not json.loads(page.evaluate(probe))['ring']['present']
 page.evaluate("document.querySelector('.stage').style.display='block';digit.textContent='2'")
 first=json.loads(page.evaluate(probe));stamp=first['ring']['stamp']
 # Exact ordinary-key event mechanism used by the C# helper; no success callback.
 dispatch=f"""(() => {{const q=JSON.parse({probe});const r=q.ring;if(!r.present||r.key!==2||String(r.stamp)!=={json.dumps(stamp)})return 'STALE';const e={{key:'2',code:'Digit2',keyCode:50,which:50,bubbles:true,cancelable:true}};try{{document.dispatchEvent(new KeyboardEvent('keydown',e));}}finally{{document.dispatchEvent(new KeyboardEvent('keyup',e));}}return 'SENT';}})()"""
 other=context.new_page();other.set_content('<script>window.keys=[];document.addEventListener("keydown",e=>keys.push(e.key));</script>');other.bring_to_front()
 assert page.evaluate(dispatch)=='SENT';assert page.evaluate('keys')==['2'];assert other.evaluate('keys')==[]
 page.evaluate("notice.textContent='魚に逃げられました'");n1=json.loads(page.evaluate(probe))['notices'];n2=json.loads(page.evaluate(probe))['notices'];assert n1==n2 and n1[0]['kind']=='FAIL'
 page.evaluate("notice.remove();document.body.insertAdjacentHTML('beforeend','<div role=alert>魚に逃げられました</div>')");n3=json.loads(page.evaluate(probe))['notices'];assert n3[0]['id']!=n1[0]['id']
 # Unknown/hidden meter values are not fabricated.
 assert json.loads(page.evaluate(probe))['hunger']==43
 page.evaluate("document.querySelector('progress').style.display='none'");assert json.loads(page.evaluate(probe))['hunger'] is None
 browser.close()
(out/'RESULT.json').write_text(json.dumps({'pass':True,'resolution_cases':checks,'other_digit_cases':10,'targeted_background_dom_keyboard':True,'other_page_keys':0,'duplicate_notice_guard':True,'new_identical_notice':True,'live_fivem':False},indent=2),encoding='utf-8')
print('SCENE_DOM_PASS',len(checks),'viewport/zoom cases; target-only keyboard on a non-front page; no live FiveM claim')
