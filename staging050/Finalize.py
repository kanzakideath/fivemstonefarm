from pathlib import Path
root=Path('portable')
def read(n):return (root/n).read_text(encoding='utf-8-sig')
def write(n,s):(root/n).write_text(s,encoding='utf-8-sig')
def rep(s,a,b):
 if a not in s:raise ValueError('missing '+a[:100])
 return s.replace(a,b)
s=read('SceneProbe.js').replace('0.4.0-final','0.5.0-final')
s=rep(s,'if(!e || !e.isConnected)return false;',"if(!e || !e.isConnected||e.closest('[data-fishingpilot-overlay]'))return false;")
s=rep(s,'r=e.r.baseVal.value;center={x:e.cx.baseVal.value,y:e.cy.baseVal.value};L=2*Math.PI*r;p0={x:center.x+r,y:center.y};', '''const geometry=(value,attribute,axis)=>{let text=String(value||'').trim();if(!text||text==='auto'||text==='none')return attribute.baseVal.value;
        if(text.endsWith('%')){const svg=e.ownerSVGElement,v=svg.viewBox.baseVal,w=v&&v.width?v.width:svg.clientWidth,h=v&&v.height?v.height:svg.clientHeight;return parseFloat(text)/100*(axis==='x'?w:axis==='y'?h:Math.hypot(w,h)/Math.SQRT2);}
        const result=lengthValue(text,e);return Number.isFinite(result)?result:attribute.baseVal.value;};
      r=geometry(s.r,e.r,'r');center={x:geometry(s.cx,e.cx,'x'),y:geometry(s.cy,e.cy,'y')};L=2*Math.PI*r;p0={x:center.x+r,y:center.y};''')
write('SceneProbe.js',s)
s=read('Engine.cs');s=rep(s,'scene=sceneLink.Poll(permit,castCycle).GetAwaiter().GetResult();sceneKnown=true;r=scene.Ring;captureAt=Now;', 'captureAt=Now;scene=sceneLink.Poll(permit,castCycle).GetAwaiter().GetResult();sceneKnown=true;r=scene.Ring;')
write('Engine.cs',s)
s=read('Build.ps1').replace('FishingPilot 0.4.0 build ready.','FishingPilot 0.5.0 build ready.');write('Build.ps1',s)
s=read('TestScene.py');s=rep(s,' # Only read rendered geometry;', ''' # CSS geometry can render correctly even when SVG attribute baseVal is zero.
 fresh();page.evaluate("document.querySelectorAll('circle').forEach(e=>{e.style.r='60px';e.style.cx='130px';e.style.cy='130px';e.removeAttribute('r');e.removeAttribute('cx');e.removeAttribute('cy');})")
 assert page.evaluate('white.r.baseVal.value')==0
 s=sample();assert s['ring']['valid'] and s['ring']['key']==4,s
 sample(True);assert sample(True)['input']['sent'];scenarios.append('css_only_svg_geometry_zero_attribute_regression')
 fresh();cdp=ctx.new_cdp_session(page);cdp.send('Input.dispatchKeyEvent',{'type':'rawKeyDown','key':'4','code':'Digit4','windowsVirtualKeyCode':52});cdp.send('Input.dispatchKeyEvent',{'type':'keyUp','key':'4','code':'Digit4','windowsVirtualKeyCode':52});assert page.evaluate('keys.length')==1;assert other.evaluate('keys.length')==0;scenarios.append('cdp_key_pair_other_page_untouched')
 # Only read rendered geometry;''');write('TestScene.py',s)
s=read('TestUi.py');s=rep(s,"'MinRecastMs':1400}","'MinRecastMs':1400,'ShowOverlay':True}")
s=rep(s,"  results.append({'width':width",'''  sample_status={**state['status'],'InventoryFresh':True,'HeldItems':[{'Name':'fish','Label':'表示検証の魚','Count':7}],'CaughtItems':[{'Name':'fish','Label':'表示検証の魚','Total':3}]}
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'status':sample_status})
  assert '7' in page.locator('#held-items').inner_text() and '3' in page.locator('#caught-items').inner_text()
  page.screenshot(path=str(out/f'inventory-{width}.png'),full_page=True)
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'status':{**sample_status,'HeldItems':[]}})
  assert page.locator('#held-items .row').count()==0 and '3' in page.locator('#caught-items').inner_text()
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'status':{**sample_status,'InventoryFresh':False}})
  assert '更新待ち' in page.locator('#inventory-age').inner_text()
  assert 'F5' in page.locator('body').inner_text() and 'F6' in page.locator('body').inner_text()
  results.append({'width':width''')
write('TestUi.py',s)
# Actual engine invariants, supplemental to behavioral tests (not a substitute).
engine=read('Engine.cs');assert 'if(foreground&&c.Width>=300' in engine
assert 'if(foreground)return Native.Press(target,targetPid,key,token);' in engine
assert 'if(sceneLink!=null)try{captureAt=Now;using(var image=sceneLink.Capture(scene,false)' in engine
assert 'if(!foreground&&options.BackgroundMode&&sceneLink!=null)b=sceneLink.Capture' in engine
assert 'statistics.Credit(before,t.Inventory)' in engine
assert 'RefreshIdleInventory' in engine
assert 'InputPolicy.StartKey' in read('Program.cs') and 'InputPolicy.StopKey' in read('Program.cs')
print('050 source integration invariants passed')
