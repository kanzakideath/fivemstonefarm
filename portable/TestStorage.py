from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--browser');p.add_argument('--expressions',required=True);p.add_argument('--output',required=True);a=p.parse_args()
expressions=json.loads(Path(a.expressions).read_text(encoding='utf-8-sig'));out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
html='''<html><body><div id="root"></div><div class="inventory-wrapper" style="width:300px;height:200px">Inventory</div><div id="options-wrapper"><button class="option-container">ストレージを開く</button></div><script>
window.calls=[];window.clicks=0;document.querySelector('button').onclick=()=>clicks++;
const item=(slot,name,count,weight)=>({slot,name,count,weight,metadata:{},stack:true});
window.inventory={leftInventory:{id:'player-test',type:'player',slots:40,maxWeight:150000,items:[item(1,'food',5,500),item(2,'rod',1,200),item(6,'fish',13,1300)]},rightInventory:{id:'trunk-test',type:'trunk',label:'Truck',slots:40,maxWeight:100000,items:[item(1,'fish',2,200)]}};
const store={getState:()=>({inventory}),dispatch:()=>{throw Error('store writes forbidden in production expression')}};
document.getElementById('root')['__reactContainer$fixture']={memoizedProps:{store}};
window.GetParentResourceName=()=> 'ox_inventory';
window.mode='success';window.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(mode==='reject')return{ok:true,json:async()=>false};if(mode==='throw')throw Error('transport unknown');
 if(mode==='delayed')await new Promise(r=>setTimeout(r,100));
 if(mode==='success'||mode==='delayed'||mode==='one_sided'||mode==='changed'){
 const p=JSON.parse(options.body),left=inventory.leftInventory.items.find(v=>v.slot===p.fromSlot),right=inventory.rightInventory.items.find(v=>v.slot===p.toSlot);left.count-=p.count;left.weight=left.count*100;
 if(mode!=='one_sided'){right.count+=p.count;right.weight=right.count*100;}
 if(mode==='changed')inventory.rightInventory.id='other-truck';
 }return{ok:true,json:async()=>true};};
</script></body></html>'''
scenarios=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=a.browser,args=['--no-sandbox']);page=browser.new_page()
 def fresh():page.set_content(html)
 def run():return page.evaluate(expressions['deposit'])
 fresh();result=run();d=json.loads(result.removeprefix('DEPOSIT_DETAIL '));assert d['status']=='COMPLETE' and d['moved']==3 and d['items']==[{'name':'fish','meta':'{}','count':3}],result
 assert page.evaluate('calls.length')==1 and page.evaluate('inventory.leftInventory.items[0].count')==5 and page.evaluate('inventory.leftInventory.items[1].count')==1
 assert page.evaluate('inventory.leftInventory.items[2].count')==10 and page.evaluate('inventory.rightInventory.items[0].count')==5;scenarios.append('one_exact_stack_paired_delta_food_and_rod_preserved')
 for code,setup in [
  ('WRONG_STORAGE',"inventory.rightInventory.id='other-truck'"),
  ('STORAGE_FULL','inventory.rightInventory.maxWeight=250'),
  ('UNAUTHORIZED_DELTA','inventory.leftInventory.items[2].count=14'),
  ('UNAUTHORIZED_DELTA',"inventory.leftInventory.items.push({slot:8,name:'random_gift',count:1,weight:1,metadata:{},stack:true})"),
  ('CANCELLED',"window.__aiMinerCancelledOperations={'test-operation':true}"),
  ('INVENTORY_CLOSED',"document.querySelector('.inventory-wrapper').style.display='none'"),
  ('NO_DELTA',"inventory.leftInventory.items[2].metadata={quality:'other'}")
 ]:
  fresh();page.evaluate(setup);result=run();assert result=='ERROR '+code,(setup,result);assert page.evaluate('calls.length')==0;scenarios.append('preflight_'+code.lower())
 for mode in ['reject','throw','one_sided','changed','delayed']:
  fresh();page.evaluate('(m)=>window.mode=m',mode);result=run()
  expected='ERROR MOVE_REJECTED' if mode=='reject' else 'DEPOSIT_DETAIL ' if mode=='delayed' else 'ERROR AMBIGUOUS_TRANSFER'
  assert result.startswith(expected),(mode,result);assert page.evaluate('calls.length')==1;scenarios.append('inflight_'+mode+'_no_duplicate_request')
 fresh();pair=json.loads(page.evaluate(expressions['pair']));assert pair['open'] and pair['id']=='trunk-test' and pair['left']['items'][2]['count']==13;scenarios.append('production_pair_snapshot')
 fresh();assert page.evaluate(expressions['targetProbe'])=='PRESENT';assert page.evaluate(expressions['targetClick'])=='CLICKED';assert page.evaluate('clicks')==1;scenarios.append('unique_visible_target_click')
 fresh();page.evaluate("document.getElementById('options-wrapper').insertAdjacentHTML('beforeend','<button class=option-container>ストレージを開く</button>')");assert page.evaluate(expressions['targetClick'])=='AMBIGUOUS';assert page.evaluate('clicks')==0;scenarios.append('ambiguous_target_no_click')
 fresh();page.evaluate("document.getElementById('options-wrapper').style.display='none'");assert page.evaluate(expressions['targetClick'])=='MISSING';assert page.evaluate('clicks')==0;scenarios.append('hidden_target_no_click')
 browser.close()
(out/'RESULT.json').write_text(json.dumps({'pass':True,'scenarios':scenarios,'mechanism':'production miner inventory/target expressions exported by the built FishingPilot executable','live_fivem':False},indent=2),encoding='utf-8')
print('STORAGE040_PASS',len(scenarios),'fault-injection scenarios; not live FiveM')
