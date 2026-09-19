/* Only the normal ox_inventory useItem UI route. No state edits or success callbacks. */
(() => {
  'use strict';
  if(window.__fpSlots064)return 'READY';
  if(window.__fpSlots063)window.__fpSlots063.stop();
  const requests = new Map(); let active = null, stopped = false;
  const visible=e=>{if(!e||!e.isConnected)return false;for(let p=e;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;}return e.getClientRects().length>0;};
  const result = (code, sent=false, extra={}) => JSON.stringify({code,sent,...extra});
  const api = {
    start(){stopped=false;return 'READY';},
    use(request){
      if(stopped)return result('STOPPED');
      if(!request || !/^[a-zA-Z0-9:._-]{1,100}$/.test(request.id || '') || !Number.isInteger(request.slot) || request.slot<1 || request.slot>5)return result('INVALID_REQUEST');
      if(requests.has(request.id))return result('ALREADY_SUBMITTED',false);
      if(active && active.pending)return result('PREVIOUS_REQUEST_PENDING');
      if(typeof GetParentResourceName!=='function' || GetParentResourceName()!=='ox_inventory')return result('UNSUPPORTED_INVENTORY');
      if(!window.__fpInventory060)return result('INVENTORY_NOT_READY');
      const snapshot=JSON.parse(window.__fpInventory060.sample());
      if(snapshot.unknownDelta || !snapshot.left || snapshot.left.weight<0)return result('INVENTORY_NOT_READY');
      if(snapshot.open)return result('INVENTORY_OPEN');
      const item=snapshot.left.items.find(x=>x.slot===request.slot && x.count>0);
      if(!item)return result('EMPTY_SLOT');
      const a=document.activeElement;
      if(a && a.matches && a.matches('input,textarea,[contenteditable=true]') && visible(a))return result('EDITING');
      const entry={id:request.id,slot:request.slot,name:item.name,pending:true,status:'submitted',controller:new AbortController()};
      requests.set(request.id,entry);active=entry;
      if(requests.size>64)requests.delete(requests.keys().next().value);
      // Start the request now; never schedule another useItem when a promise completes.
      try{
        fetch('https://ox_inventory/useItem',{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(request.slot),signal:entry.controller.signal})
          .then(async response=>{entry.status=response.ok?'callback_returned':'http_error';entry.response=(await response.text()).slice(0,128);})
          .catch(e=>{entry.status=e.name==='AbortError'?'aborted':'transport_uncertain';})
          .finally(()=>{entry.pending=false;});
      }catch(e){entry.pending=false;entry.status='not_submitted';requests.delete(request.id);return result('NOT_SUBMITTED');}
      return result('SUBMITTED',true,{slot:item.slot,item:item.name});
    },
    query(id){const e=requests.get(id);return e?result('RECEIPT',true,{id:e.id,pending:e.pending,status:e.status}):result('NOT_FOUND');},
    status(){return result(active?active.status:'idle',false,{pending:!!(active&&active.pending)});},
    complete(){if(active){active.status='completion_observed';active.pending=false;active.controller.abort();}return 'COMPLETED';},
    stop(){stopped=true;if(active&&active.pending)active.controller.abort();return 'STOPPED';}
  };
  window.__fpSlots064=api;return 'READY';
})()
