'use strict';
window.fishingApp = new Framework7({el:'#app',theme:'ios',name:'FishingPilot',id:'local.fishingpilot',init:true});
const $=id=>document.getElementById(id);
const boolKeys=['ObserveOnly','BackgroundMode','AutoNeeds','AutoStorage','HighAccuracy','IncludeExistingCatch','ShowOverlay','ContinueOnUnknownNeeds'];
const numberKeys=['FoodKey','DrinkKey','ReserveGrams','MinRecastMs','GaugeRadius','FailureRecastMs'];
let busy=false,running=false,dirty=false,currentSettings='',ready=false,storageSignature='';
function send(action,settings){if(window.chrome&&window.chrome.webview)window.chrome.webview.postMessage(settings?{action,settings}:{action});}
function text(id,value){$(id).textContent=String(value??'未確認');}
for(const name of ['FoodKey','DrinkKey'])for(let k=0;k<=9;k++){const o=document.createElement('option');o.value=k;o.textContent=k+'番';$(name).append(o);}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active',p.id==='page-'+button.dataset.page));window.scrollTo(0,0);}));
let themeDirty=false,savedTheme='dark';
const darkPreference=window.matchMedia('(prefers-color-scheme: dark)');
function setTheme(theme){savedTheme=theme;const dark=theme==='dark'||theme==='system'&&darkPreference.matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('dark',dark);}
function applyTheme(o){if(!themeDirty){setTheme(o.Theme||'dark');$('AppTheme').value=o.Theme||'dark';$('OverlayTheme').value=o.Overlay?.Theme||'match';}}
darkPreference.addEventListener('change',()=>setTheme(savedTheme));
$('theme-form').addEventListener('input',()=>{themeDirty=true;setTheme($('AppTheme').value);});
$('theme-form').addEventListener('submit',e=>{e.preventDefault();themeDirty=false;send('theme.save',{Theme:$('AppTheme').value,OverlayTheme:$('OverlayTheme').value});});
function apply(data){if(!data||data.type!=='state')return;ready=true;busy=!!data.busy;running=!!data.status?.Running;const s=data.status||{};applyTheme(data.settings||{});text('needs-warning',s.Needs||'');$('needs-warning').hidden=!s.Needs;text('version',data.version);text('phase',data.countdown>0?data.countdown+'秒後に開始':s.Phase);text('detail',s.Detail||'停止中に設定を確認できます。');text('backend',s.Backend);text('delivery',s.Delivery);text('latency',s.ReadMs>0?s.ReadMs.toFixed(1)+' ms':'—');text('ring',s.Ring);text('inventory',s.Inventory);text('hunger',s.Hunger);text('thirst',s.Thirst);text('casts',s.Casts||0);text('keys',s.Keys||0);text('results',s.Results||0);text('side-state',running?'実行中':busy?'停止・準備中':'停止中');$('state-dot').classList.toggle('running',running);text('feedback',data.feedback||'');$('feedback').hidden=!data.feedback;
$('start').hidden=busy||running;$('stop').hidden=!busy&&!running;text('stop',running?'自動釣りを停止 / F6':data.countdown>0?'開始をキャンセル':'停止処理中 / F6');
const serialized=JSON.stringify(data.settings||{});if(!dirty&&serialized!==currentSettings){currentSettings=serialized;for(const k of boolKeys)$(k).checked=k==='ContinueOnUnknownNeeds'?data.settings[k]!==false:!!data.settings[k];for(const k of numberKeys)$(k).value=data.settings[k]??(k==='FailureRecastMs'?350:'');}
for(const k of [...boolKeys,...numberKeys,'save','reset-gauges','export','open-logs'])$(k).disabled=busy||running;
applyStorage(data);text('recognition',s.Recognition);text('storage-status',s.Storage);text('storage-count',(s.StorageCycles||0)+'回 / '+(s.StoredItems||0)+'個');
applyInventory(s);applyFinancial(data);text('start-help',data.settings?.ObserveOnly?'観察テストON：キーは送信しません。F5開始 / F6停止。設定でOFFにすると自動操作します。':'開始はF5、停止はF6。釣り竿は2番にセットしてください。');}
$('start').addEventListener('click',()=>{if(!ready||busy)return;busy=true;$('start').disabled=true;send('start');setTimeout(()=>$('start').disabled=false,500);});$('stop').addEventListener('click',()=>send('stop'));
$('settings-form').addEventListener('input',()=>{dirty=true;text('save-state','未保存の変更があります');});
$('settings-form').addEventListener('submit',event=>{event.preventDefault();if(busy||running||!$('settings-form').reportValidity())return;const settings={};for(const k of boolKeys)settings[k]=$(k).checked;for(const k of numberKeys)settings[k]=Number($(k).value);dirty=false;currentSettings='';send('save',settings);text('save-state','本体の保存結果を確認しています');});
$('reset-gauges').addEventListener('click',()=>{if(!busy)send('calibration.reset');});$('export').addEventListener('click',()=>{if(!busy)send('diagnostics.export');});$('open-logs').addEventListener('click',()=>{if(!busy)send('logs.open');});

function applyStorage(data){const s=data.storage||{},signature=JSON.stringify(s);text('storage-feedback',data.feedback||'初回に荷台と収納対象を登録してください。');text('registered-storage',s.registered?(s.label||s.id)+' / '+s.id:'未登録');text('candidate-storage',s.candidateLabel||s.candidateId||'未確認');
 if(signature!==storageSignature){storageSignature=signature;const list=$('storage-items');list.replaceChildren();for(const item of s.candidates||[]){const label=document.createElement('label');label.className='row';const span=document.createElement('span');span.textContent=item.name+' × '+item.count;const input=document.createElement('input');input.type='checkbox';input.dataset.storageItem=item.name;input.checked=(s.selected||[]).includes(item.name);input.setAttribute('aria-label',item.name+'を収納対象にする');label.append(span,input);list.append(label);}if(!list.children.length){const p=document.createElement('p');p.className='footnote';p.textContent='収納対象の魚を手持ち（ホットバー以外）へ置いて読み込んでください。';list.append(p);}}
 $('storage-inspect').disabled=busy||running;$('storage-register').disabled=busy||running||!s.candidateId;for(const e of document.querySelectorAll('[data-storage-item]'))e.disabled=busy||running;
}
$('storage-inspect').addEventListener('click',()=>{if(!busy&&!running)send('storage.inspect');});
$('storage-register').addEventListener('click',()=>{if(busy||running)return;const items=[...document.querySelectorAll('[data-storage-item]:checked')].map(e=>e.dataset.storageItem);if(!items.length){text('storage-feedback','収納する魚を選択してください。');return;}window.chrome?.webview?.postMessage({action:'storage.register',items});});


window.fishingUi={apply};

function applyInventory(s){const held=$('held-items'),caught=$('caught-items');held.replaceChildren();caught.replaceChildren();text('inventory-age',s.InventoryFresh?'所持品の最新値（手動収納・売却も反映）':'更新待ち：前回の所持品です');
 for(const [node,rows,total] of [[held,s.HeldItems||[],false],[caught,s.CaughtItems||[],true]]){for(const row of rows){const el=document.createElement('div');el.className='row';const label=document.createElement('span'),n=document.createElement('strong');label.textContent=row.Label||row.Name;n.textContent=String(total?row.Total:row.Count);el.append(label,n);node.append(el);}if(!rows.length){const el=document.createElement('p');el.className='footnote';el.textContent=total?'取得累計はまだありません':'表示する所持品はありません';node.append(el);}}}

const overlayFlags=['ShowSession','ShowHeldValue','ShowTrunkValue','ShowWeight','ShowNeeds','ShowStatus','ShowItems','ShowLifetime','ShowDiagnostics','ShowMovement'];
const overlayNumbers=['Opacity','Width','FontSize','MaxRows'];
let overlayDirty=false,overlaySignature='',priceSignature='';
const overlayDefaults={Opacity:90,Width:360,FontSize:10,MaxRows:3,Position:'top-left',Theme:'match',ShowSession:true,ShowHeldValue:true,ShowTrunkValue:true,ShowWeight:true,ShowStatus:true,ShowMovement:true};
function money(v){return v?.Known?'¥'+Number(v.Total||0).toLocaleString('ja-JP')+(v.UnknownKinds?' + 未登録'+v.UnknownKinds+'種':''):'未確認';}
function applyFinancial(data){const s=data.status||{},v=s.Live||{};text('session-value',money(v.SessionValue));text('held-value',money(v.HeldValue)+(v.Fresh?'':' · 前回値'));text('trunk-value',money(v.TrunkValue));text('trunk-age',v.TrunkKnown?(v.TrunkOpen?'開いている荷台':'最終確認 '+v.TrunkUpdated)+' · '+(v.TrunkLabel||v.TrunkId):'荷台を開くと中身全体を集計します');text('movement-state',s.Movement||'OFF');text('overlay-feedback',data.feedback||'');
 text('session-note',v.SessionValue?.UnknownKinds?'単価未登録の釣果 '+v.SessionValue.UnknownKinds+'種は未算入です':'開始前の所持分や収納による移動は含めません');
 const settings=data.settings||{},sig=JSON.stringify([settings.Overlay,settings.AutoNudge,settings.NudgeHoldMs,settings.ShowOverlay]);if(!overlayDirty&&sig!==overlaySignature){overlaySignature=sig;const o={...overlayDefaults,...settings.Overlay};for(const k of overlayFlags)$('overlay-'+k).checked=!!o[k];for(const k of overlayNumbers)$('overlay-'+k).value=o[k];$('overlay-Position').value=o.Position;$('overlay-Theme').value=o.Theme;$('OverlayEnabled').checked=settings.ShowOverlay!==false;$('AutoNudge').checked=!!settings.AutoNudge;$('NudgeHoldMs').value=settings.NudgeHoldMs||300;}
 $('price-save').disabled=busy||running;
 const prices=data.prices||[],ps=JSON.stringify(prices);if(ps!==priceSignature){priceSignature=ps;const selected=$('price-label').value;$('price-label').replaceChildren();for(const row of prices){const o=document.createElement('option');o.value=row.Label;o.textContent=row.Label+' · ¥'+Number(row.Yen).toLocaleString('ja-JP');$('price-label').append(o);}if(prices.some(x=>x.Label===selected))$('price-label').value=selected;}
 $('unknown-names').replaceChildren();const names=new Set();for(const row of [...(v.HeldValue?.Items||[]),...(v.TrunkValue?.Items||[])])if(!row.PriceKnown&&!names.has(row.Name)){names.add(row.Name);const o=document.createElement('option');o.value=row.Name;o.label=row.Label||row.Name;$('unknown-names').append(o);}
}
$('open-overlay').addEventListener('click',()=>document.querySelector('[data-page="overlay"]').click());
$('overlay-form').addEventListener('input',()=>{overlayDirty=true;text('overlay-feedback','未保存の変更があります');});
$('overlay-form').addEventListener('submit',event=>{event.preventDefault();if(!$('overlay-form').reportValidity())return;const Overlay={};for(const k of overlayFlags)Overlay[k]=$('overlay-'+k).checked;for(const k of overlayNumbers)Overlay[k]=Number($('overlay-'+k).value);Overlay.Position=$('overlay-Position').value;Overlay.Theme=$('overlay-Theme').value;overlayDirty=false;overlaySignature='';send('overlay.save',{Overlay,ShowOverlay:$('OverlayEnabled').checked,AutoNudge:$('AutoNudge').checked,NudgeHoldMs:Number($('NudgeHoldMs').value)});});
$('price-form').addEventListener('submit',event=>{event.preventDefault();if(busy||running||!$('price-form').reportValidity())return;send('price.map',{Name:$('price-name').value.trim(),Label:$('price-label').value});});

if(window.chrome&&window.chrome.webview){window.chrome.webview.addEventListener('message',event=>{apply(event.data);if(event.data?.feedback==='設定を保存しました')text('save-state','保存しました');});send('ready');}
