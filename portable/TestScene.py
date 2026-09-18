from pathlib import Path
import argparse,json,math
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--browser');p.add_argument('--output',default='scene-evidence');a=p.parse_args()
r=Path(__file__).parent;out=Path(a.output);out.mkdir(parents=True,exist_ok=True);probe=(r/'SceneProbe.js').read_text(encoding='utf-8-sig')
html='''<html><body style="margin:0;background:#132330;color:white"><div id="stage" style="position:absolute;left:50%;top:50%;width:260px;height:260px;transform:translate(-50%,-50%)"><svg width="260" height="260"><circle cx="50%" cy="50%" r="60" fill="none" stroke="#455362" stroke-width="9"/><circle id="green" cx="50%" cy="50%" r="60" fill="none" stroke="#46a99b" stroke-width="9" transform="rotate(110 130 130)"/><circle id="white" cx="50%" cy="50%" r="60" fill="none" stroke="white" stroke-width="9" transform="rotate(-90 130 130)"/></svg><div id="digit" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:48px Arial">4</div></div><div role="alert" id="notice"></div><progress aria-label="hunger" value="43" max="100" style="position:absolute;left:8px;bottom:8px"></progress><script>window.keys=[];window.ups=[];window.addEventListener('keydown',e=>keys.push({key:e.key,target:e.target.id}));window.addEventListener('keyup',e=>ups.push(e.key));window.setAngle=(x)=>{const L=2*Math.PI*60;green.style.strokeDasharray=L;green.style.strokeDashoffset=L-L*35/360;white.style.strokeDasharray=L;white.style.strokeDashoffset=L-L*x/360;};setAngle(210);</script></body></html>'''
checks=[];scenarios=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=a.browser,args=['--no-sandbox']);ctx=b.new_context();page=ctx.new_page()
 def sample(enabled=False,cycle='case'):
  return json.loads(page.evaluate('([enabled,cycle])=>window.__fpProbe3.sample(true,{enabled,cycle})',[enabled,cycle]))
 def fresh():
  page.set_content(html);page.evaluate('delete window.__fpProbe3');page.evaluate(probe)
 for w,h in [(800,600),(1280,720),(1440,900),(1920,1080),(2560,1440),(3440,1440),(3840,2160)]:
  page.set_viewport_size({'width':w,'height':h});fresh()
  for zoom in [.75,1,1.5]:
   page.evaluate('(z)=>document.body.style.zoom=z',zoom);d=sample();v=d['ring'];assert v['valid'] and v['key']==4 and abs(v['start']-200)<.2 and abs(v['pointer']-210)<.2,(w,h,zoom,d)
   checks.append({'viewport':[w,h],'zoom':zoom,'key':v['key'],'pointer':v['pointer']})
 page.set_viewport_size({'width':1440,'height':900});fresh()
 assert not sample()['input']['sent'] and page.evaluate('keys.length')==0
 assert not sample(True)['input']['sent'];sent=sample(True);assert sent['input']['sent'] and sent['input']['key']==4
 for _ in range(20):assert not sample(True)['input']['sent']
 page.wait_for_timeout(60);assert page.evaluate('keys')==[{'key':'4','target':'digit'}] and page.evaluate('ups')==['4'];scenarios.append('same_turn_single_down_up')
 # A second request can have the same digit; observe the actual reset first.
 page.evaluate('setAngle(15)');assert not sample(True)['input']['sent'];page.evaluate('setAngle(208)');sent=sample(True);assert sent['input']['sent'] and sent['input']['round']==2;scenarios.append('same_digit_reset')
 page.evaluate("digit.textContent='1';setAngle(30)");sample(True);page.evaluate('setAngle(212)');assert sample(True)['input']['key']==1;scenarios.append('changed_digit_reset')
 page.evaluate('stage.style.display="none"');page.wait_for_timeout(30);assert not sample(True)['ring']['present'];n=page.evaluate('keys.length');page.wait_for_timeout(100);assert page.evaluate('keys.length')==n;scenarios.append('hidden_or_stopped_no_delayed_down')
 fresh();page.evaluate('setAngle(198)');sample(True);assert not sample(True)['input']['sent'];page.evaluate('setAngle(241)');assert not sample(True)['input']['sent'];scenarios.append('early_and_late_refused')
 fresh();page.evaluate("document.body.insertAdjacentHTML('beforeend','<input id=editing>');editing.focus()");sample(True);assert sample(True)['input']['reason']=='editing';assert page.evaluate('keys.length')==0;scenarios.append('editing_refused')
 fresh();other=ctx.new_page();other.set_content('<script>window.keys=[];window.addEventListener("keydown",e=>keys.push(e.key))</script>');other.bring_to_front();sample(True);assert sample(True)['input']['sent'];assert other.evaluate('keys.length')==0;scenarios.append('targeted_input_other_foreground_page_untouched')
 # Demonstrate that no autonomous key-down is scheduled after a host request.
 fresh();page.evaluate('setAngle(175)');sample(True);page.evaluate('setAngle(208)');page.wait_for_timeout(100);assert page.evaluate('keys.length')==0;assert sample(True)['input']['sent'];page.evaluate('window.__fpProbe3.stop()');n=page.evaluate('keys.length');sample(False);page.wait_for_timeout(100);assert page.evaluate('keys.length')==n;scenarios.append('stop_and_no_recurring_input_timer')
 fresh();page.evaluate("notice.textContent='魚に逃げられました'");d=json.loads(page.evaluate('window.__fpProbe3.sample(false,null)'));assert d['notices'][0]['kind']=='FAIL';assert d['hunger']==43;scenarios.append('failure_notice_and_explicit_hud_value')
 fresh();page.evaluate('setAngle(200)');sample(True);page.evaluate('setAngle(201)');assert not sample(True)['input']['sent'];page.evaluate('setAngle(205)');assert sample(True)['input']['sent'];scenarios.append('narrow_inside_margin')
 # Only read rendered geometry; actual game state/stores are not present in this fixture.
 b.close()
(out/'RESULT.json').write_text(json.dumps({'pass':True,'resolution_cases':checks,'scenarios':scenarios,'live_fivem':False,'mechanism':'production SceneProbe.js, rendered SVG, normal DOM key events'},indent=2),encoding='utf-8')
print('SCENE030_PASS',len(checks),'resolution/zoom cases;',len(scenarios),'functional scenarios')
