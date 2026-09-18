'use strict';
window.fishingApp = new Framework7({el:'#app',theme:'ios',name:'FishingPilot',id:'local.fishingpilot',init:true});
const $=id=>document.getElementById(id);
const boolKeys=['ObserveOnly','BackgroundMode','AutoNeeds'];
const numberKeys=['FoodKey','DrinkKey','ReserveGrams','MinRecastMs','GaugeRadius'];
let busy=false,running=false,dirty=false,currentSettings='',ready=false;
function send(action,settings){if(window.chrome&&window.chrome.webview)window.chrome.webview.postMessage(settings?{action,settings}:{action});}
function text(id,value){$(id).textContent=String(value??'未確認');}
for(const name of ['FoodKey','DrinkKey'])for(let k=0;k<=9;k++){const o=document.createElement('option');o.value=k;o.textContent=k+'番';$(name).append(o);}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active',p.id==='page-'+button.dataset.page));window.scrollTo(0,0);}));
function apply(data){if(!data||data.type!=='state')return;ready=true;busy=!!data.busy;running=!!data.status?.Running;const s=data.status||{};text('version',data.version);text('phase',data.countdown>0?data.countdown+'秒後に開始':s.Phase);text('detail',s.Detail||'停止中に設定を確認できます。');text('backend',s.Backend);text('delivery',s.Delivery);text('latency',s.ReadMs>0?s.ReadMs.toFixed(1)+' ms':'—');text('ring',s.Ring);text('inventory',s.Inventory);text('hunger',s.Hunger);text('thirst',s.Thirst);text('casts',s.Casts||0);text('keys',s.Keys||0);text('results',s.Results||0);text('side-state',running?'実行中':busy?'停止・準備中':'停止中');$('state-dot').classList.toggle('running',running);text('feedback',data.feedback||'');$('feedback').hidden=!data.feedback;
$('start').hidden=busy||running;$('stop').hidden=!busy&&!running;text('stop',running?'自動釣りを停止 / F9':data.countdown>0?'開始をキャンセル':'停止処理中 / F9');
const serialized=JSON.stringify(data.settings||{});if(!dirty&&serialized!==currentSettings){currentSettings=serialized;for(const k of boolKeys)$(k).checked=!!data.settings[k];for(const k of numberKeys)$(k).value=data.settings[k];}
for(const k of [...boolKeys,...numberKeys,'save','reset-gauges','export','open-logs'])$(k).disabled=busy||running;
text('start-help',data.settings?.ObserveOnly?'観察テストON：キーは送信しません。設定でOFFにすると自動操作します。':'開始はF8、停止はF9。釣り竿は2番にセットしてください。');}
$('start').addEventListener('click',()=>{if(!ready||busy)return;busy=true;$('start').disabled=true;send('start');setTimeout(()=>$('start').disabled=false,500);});$('stop').addEventListener('click',()=>send('stop'));
$('settings-form').addEventListener('input',()=>{dirty=true;text('save-state','未保存の変更があります');});
$('settings-form').addEventListener('submit',event=>{event.preventDefault();if(busy||running||!$('settings-form').reportValidity())return;const settings={};for(const k of boolKeys)settings[k]=$(k).checked;for(const k of numberKeys)settings[k]=Number($(k).value);dirty=false;currentSettings='';send('save',settings);text('save-state','本体の保存結果を確認しています');});
$('reset-gauges').addEventListener('click',()=>{if(!busy)send('calibration.reset');});$('export').addEventListener('click',()=>{if(!busy)send('diagnostics.export');});$('open-logs').addEventListener('click',()=>{if(!busy)send('logs.open');});
if(window.chrome&&window.chrome.webview){window.chrome.webview.addEventListener('message',event=>{apply(event.data);if(event.data?.feedback==='設定を保存しました')text('save-state','保存しました');});send('ready');}
window.fishingUi={apply};
