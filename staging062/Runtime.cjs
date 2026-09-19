'use strict';
// Execute the actual Runtime.evaluate expression received from the Windows EXE.
// Fake DOM/Redux data only; no network and no access to a real game.
const vm=require('node:vm'),readline=require('node:readline');
const listeners=new Set();let mode='right-null',done=false,lastDone=false;
const row=()=>({slot:10,name:'salmon',label:'サケ',count:done?2:1,weight:mode==='full'?150000:done?1200:1000,metadata:{}});
const left=()=>({id:28,type:'player',label:'Local test',maxWeight:150000,slots:40,items:[row()]});
const state={inventory:{leftInventory:null,rightInventory:null}};
const store={getState:()=>state,dispatch:()=>{throw new Error('Read-only fixture');},subscribe:()=>()=>{}};
const root={__reactContainer$fixture:{memoizedProps:{store}}};
const wrapper={isConnected:true,getBoundingClientRect:()=>({width:700,height:560})};
const window={addEventListener:(name,cb)=>{if(name==='message')listeners.add(cb);},removeEventListener:(name,cb)=>listeners.delete(cb)};
const context=vm.createContext({window,performance:{now:()=>performance.now()},document:{getElementById:id=>id==='root'?root:null,querySelectorAll:selector=>selector==='.inventory-wrapper'&&mode==='inventory-open'?[wrapper]:[]},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})});
readline.createInterface({input:process.stdin,crlfDelay:Infinity}).on('line',line=>{
 try{
  const q=JSON.parse(line);mode=q.mode;done=!!q.done;
  if(!state.inventory.leftInventory&&mode!=='left-null')state.inventory.leftInventory=left();
  if(done!==lastDone){state.inventory.leftInventory=mode==='left-null'?null:left();for(const cb of listeners)cb({data:{action:'refreshSlots',data:{items:[{inventory:28,item:row()}]}}});lastDone=done;}
  const value=vm.runInContext(q.expression,context,{timeout:800});
  const result={type:typeof value};if(value!==undefined)result.value=value;
  process.stdout.write(JSON.stringify({result})+'\n');
 }catch(e){process.stdout.write(JSON.stringify({result:{type:'undefined'},exceptionDetails:{text:String(e)}})+'\n');}
});
