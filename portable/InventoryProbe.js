/* FishingPilot 0.6: read-only mirror of ox_inventory NUI messages.
 * Requires the existing InventoryPrelude helpers (findStore, inventoryVisible).
 * Never dispatches actions, requests game callbacks, or writes game state.
 */
(() => {
  'use strict';
  const key = '__fpInventory060';
  if (window[key]) return window[key].sample();
  let left = null, right = null, revision = 0, source = 'initializing';
  let lastChange = performance.now(), unknownDelta = false, unsubscribe = null;
  const labels = Object.create(null);
  let store = null, lastLeftRef=null, lastRightRef=null;
  const integer = v => Number.isSafeInteger(Number(v)) && Number(v) >= 0;
  const stable = o => {
    if (o === null || typeof o !== 'object') return JSON.stringify(o);
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k)+':'+stable(o[k])).join(',') + '}';
  };
  function touch(why) { revision++; lastChange=performance.now(); source=why; }
  function row(item) {
    if (!item || !integer(item.slot) || Number(item.slot)<1) return null;
    if (!item.name) return {slot:Number(item.slot),empty:true};
    if (!integer(item.count)) return null;
    if (Number(item.count)===0) return {slot:Number(item.slot),empty:true};
    const metadata=item.metadata && typeof item.metadata==='object' ? item.metadata : {};
    return {slot:Number(item.slot), name:String(item.name), count:Number(item.count),
      meta:stable(metadata), label:String(metadata.label || item.label || labels[item.name] || item.name),
      weight:item.weight!==undefined && Number.isFinite(Number(item.weight)) && Number(item.weight)>=0 ? Number(item.weight) : null};
  }
  function inventory(i) {
    if (!i || typeof i !== 'object' || !i.items || typeof i.items !== 'object') return null;
    const rows=Object.create(null);let invalid=false;
    for (const x of Object.values(i.items)) { const r=row(x); if(r&&!r.empty)rows[r.slot]=r; else if(x&&x.name&&!r)invalid=true; }
    return {invalid,id:String(i.id ?? ''),type:String(i.type || ''),label:String(i.label || ''),
      max:Number(i.maxWeight)||0,slots:Number(i.slots)||0,rows};
  }
  function setup(data, why) {
    if (!data || typeof data !== 'object') return;
    let changed=false;
    if (data.leftInventory) {const v=inventory(data.leftInventory); if(v && v.type==='player'){left=v;unknownDelta=false;changed=true;}}
    if (data.rightInventory) {const v=inventory(data.rightInventory);right=v;changed=true;}
    if(changed)touch(why);
  }
  function syncStore(inv,why) {
    if(!inv)return;
    const update={};
    if(inv.leftInventory!==lastLeftRef || !left){update.leftInventory=inv.leftInventory;lastLeftRef=inv.leftInventory;}
    if(inv.rightInventory!==lastRightRef){update.rightInventory=inv.rightInventory;lastRightRef=inv.rightInventory;}
    setup(update,why);
  }
  function seed() {
    try {
      if(!store)store=findStore();
      const state=store&&store.getState(), inv=state&&state.inventory;
      if(!inv)return;
      const catalog=state.items || state.itemData;
      if(catalog&&typeof catalog==='object')for(const [n,v] of Object.entries(catalog))if(v&&v.label)labels[n]=String(v.label);
      // A React snapshot is authoritative at initialization or while its UI is open.
      // Closed-store snapshots must not overwrite newer refreshSlots messages.
      if(!left || inventoryVisible())syncStore(inv,'visible-store');
      if(!unsubscribe && typeof store.subscribe==='function')unsubscribe=store.subscribe(()=>{
        try{if(inventoryVisible())syncStore(store.getState().inventory,'store-change');}catch{}
      });
    } catch {}
  }
  function message(event) {
    const m=event && event.data;
    if(!m || typeof m!=='object')return;
    if(m.action==='init' && m.data && m.data.items) {
      for(const [n,v] of Object.entries(m.data.items))if(v&&v.label)labels[n]=String(v.label);
      return;
    }
    if(m.action==='setupInventory') {setup(m.data,'setupInventory');return;}
    if(m.action!=='refreshSlots'||!m.data||!m.data.items||typeof m.data.items!=='object')return;
    let changed=false;
    for(const delta of Object.values(m.data.items)) {
      if(!delta||!delta.item)continue;
      const id=delta.inventory===undefined?'player':String(delta.inventory);
      let target=null;
      if(left&&(id==='player'||id===left.id))target=left;
      else if(right&&(id===right.id||id===right.type))target=right;
      // An unrecognized non-player container does not invalidate the player baseline.
      else {if(!left&&(id==='player'||typeof delta.inventory==='number'))unknownDelta=true;continue;}
      const r=row(delta.item); if(!r){if(target===left)unknownDelta=true;continue;}
      if(r.empty)delete target.rows[r.slot];else target.rows[r.slot]=r;
      changed=true;
    }
    if(changed)touch('refreshSlots');
  }
  function detail(i) {
    if(!i)return null;
    const items=Object.values(i.rows).sort((a,b)=>a.slot-b.slot);
    const weightsKnown=!i.invalid&&items.every(x=>x.weight!==null);
    return {id:i.id,type:i.type,label:i.label,max:i.max,slots:i.slots,used:items.length,
      weight:weightsKnown?Math.round(items.reduce((n,x)=>n+x.weight,0)):-1,weightsKnown,
      items:items.map(x=>({...x,label:x.label===x.name?(labels[x.name]||x.name):x.label}))};
  }
  function sample() {
    seed();
    return JSON.stringify({version:6,revision,source,changeAgeMs:Math.round(performance.now()-lastChange),
      open:!!inventoryVisible(), left:detail(left),right:detail(right),unknownDelta});
  }
  window.addEventListener('message',message);
  window[key]={sample,dispose(){window.removeEventListener('message',message);if(unsubscribe)unsubscribe();delete window[key];}};
  return sample();
})()
