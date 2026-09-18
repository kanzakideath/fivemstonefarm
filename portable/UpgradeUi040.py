from pathlib import Path
r=Path(__file__).parent

def edit(name,old,new,count=1):
 p=r/name;s=p.read_text(encoding='utf-8-sig')
 if s.count(old)!=count:raise RuntimeError(f'{name}: expected {count} occurrences, got {s.count(old)}: {old[:80]}')
 p.write_text(s.replace(old,new),encoding='utf-8-sig')

if 'storage.inspect' in (r/'Program.cs').read_text(encoding='utf-8-sig'):
 print('Storage UI already integrated');raise SystemExit(0)
edit('Program.cs','using System.IO;','using System.IO;\nusing System.Linq;')
edit('Program.cs','"logs.open","diagnostics.export"};','"logs.open","diagnostics.export","storage.inspect","storage.register"};')
edit('Program.cs','if(k!="action"&&k!="settings")','if(k!="action"&&k!="settings"&&k!="items")')
edit('Program.cs','   return d;','''   if((string)d["action"]=="storage.register"){
    if(!d.ContainsKey("items")||!(d["items"] is object[]))throw new ArgumentException("釣果の選択がありません");
    var a=(object[])d["items"];if(a.Length<1||a.Length>128||a.Any(x=>!(x is string)||!StorageRegistration.ValidItem((string)x)))throw new ArgumentException("収納対象の選択が不正です");
   }else if(d.ContainsKey("items"))throw new ArgumentException("この操作に収納対象は指定できません");
   return d;''')
edit('Program.cs','bool ready,closing;int countdown;','StorageView storageCandidate;StorageRegistration storageRegistration;bool setupBusy;CancellationTokenSource setupStop;\n  bool ready,closing;int countdown;')
edit('Program.cs','   engine=new Engine(root,','''   string registrationFile=Path.Combine(root,"storage-registration.json");if(File.Exists(registrationFile))try{storageRegistration=json.Deserialize<StorageRegistration>(File.ReadAllText(registrationFile));storageRegistration.Validate();}catch{feedback="荷台の登録情報を確認してください";storageRegistration=null;}
   engine=new Engine(root,''')
edit('Program.cs','closing=true;countdown=0;timer.Stop();','closing=true;countdown=0;if(setupStop!=null)setupStop.Cancel();timer.Stop();')
edit('Program.cs','   EnsureIdle();if(action=="save")','''   if(action=="storage.inspect"||action=="storage.register"){EnsureIdle();StorageSetup(action=="storage.register",action=="storage.register"?((object[])m["items"]).Cast<string>().ToArray():new string[0]);return;}
   EnsureIdle();if(action=="save")''')
edit('Program.cs','if(countdown>0||engine.Busy)','if(countdown>0||engine.Busy||setupBusy)')
edit('Program.cs','void StopNow(){countdown=0;engine.Stop();','void StopNow(){countdown=0;if(setupStop!=null)setupStop.Cancel();engine.Stop();')
edit('Program.cs','busy=engine.Busy||countdown>0,countdown=countdown,feedback=feedback','busy=engine.Busy||countdown>0||setupBusy,countdown=countdown,feedback=feedback,storage=StorageState()')
edit('Program.cs','name=="events.jsonl.1"','name=="events.jsonl.1"||name=="storage-registration.json"||name=="storage-pending.json"||name=="storage-pending.json.bak"||name=="storage-receipts.jsonl"||name=="storage-receipts.jsonl.1"')
pos='  void EnsureIdle()'
text='''  object StorageState(){
   var rows=storageCandidate!=null&&storageCandidate.Left.Known?StorageRow.Parse(storageCandidate.LeftSpec):new List<StorageRow>();
   var hotbar=new HashSet<string>(rows.Where(x=>x.Slot<=5).Select(x=>x.Name),StringComparer.Ordinal);
   var candidates=rows.Where(x=>x.Slot>5&&!hotbar.Contains(x.Name)&&!x.Name.StartsWith("WEAPON_",StringComparison.OrdinalIgnoreCase)).GroupBy(x=>x.Name).Select(g=>new{name=g.Key,count=g.Sum(x=>(long)x.Count)}).ToArray();
   return new{registered=storageRegistration!=null,id=storageRegistration==null?"":storageRegistration.Id,label=storageRegistration==null?"未登録":storageRegistration.Label,
    candidateId=storageCandidate==null?"":storageCandidate.Id,candidateLabel=storageCandidate==null?"":storageCandidate.Label,candidates=candidates,selected=storageRegistration==null?new string[0]:storageRegistration.Items};
  }
  async void StorageSetup(bool register,string[] items){
   setupBusy=true;setupStop=new CancellationTokenSource(TimeSpan.FromSeconds(12));feedback="開いている荷台と所持品を確認しています";Push();
   try{
    var view=await NearbyStorageService.Inspect(setupStop.Token);setupStop.Token.ThrowIfCancellationRequested();
    if(!view.Open||view.Type!="trunk"||!view.Left.Known||!view.Right.Known)throw new InvalidOperationException("ゲームで登録したい荷台を開いたまま、このボタンを押してください");
    if(!register){storageCandidate=view;feedback="荷台を読み取りました。収納する魚だけにチェックしてください";}
    else{
     if(storageCandidate==null||view.Id!=storageCandidate.Id||view.Epoch!=storageCandidate.Epoch||view.PlayerId!=storageCandidate.PlayerId)throw new InvalidOperationException("荷台が変わりました。もう一度読み込んでください");
     var rows=StorageRow.Parse(view.LeftSpec);var protectedNames=new HashSet<string>(rows.Where(x=>x.Slot<=5).Select(x=>x.Name),StringComparer.Ordinal);
     if(items.Distinct(StringComparer.Ordinal).Count()!=items.Length||items.Any(n=>protectedNames.Contains(n)||n.StartsWith("WEAPON_",StringComparison.OrdinalIgnoreCase)||!rows.Any(x=>x.Slot>5&&x.Name==n)))throw new InvalidOperationException("魚をホットバー以外に置き、収納対象を選び直してください");
     var reg=new StorageRegistration{Id=view.Id,Type=view.Type,Epoch=view.Epoch,PlayerId=view.PlayerId,Label=view.Label,Items=items};reg.Validate();
     string p=Path.Combine(root,"storage-registration.json"),tmp=p+".tmp";File.WriteAllText(tmp,json.Serialize(reg));if(File.Exists(p))File.Replace(tmp,p,p+".bak");else File.Move(tmp,p);storageRegistration=reg;
     var o=json.Deserialize<Options>(json.Serialize(config));o.AutoStorage=true;Save(o);config=o;
     feedback="荷台と釣果を登録し、自動収納をONにしました。ゲームで荷台を閉じてF8で開始してください";
     engine.Log("storage_registered","trunk_verified=1 allowed_item_types="+items.Length+" read_only_setup=1");
    }
   }catch(OperationCanceledException){feedback="荷台の確認を中止しました";}
   catch(Exception e){feedback=e.Message;engine.Log("storage_setup_error",e.GetType().Name+" "+e.Message);}
   finally{setupBusy=false;setupStop.Dispose();setupStop=null;if(!closing)Push();}
  }
'''
edit('Program.cs',pos,text+pos)
p=r/'ui/index.html';s=p.read_text(encoding='utf-8-sig')
s=s.replace('<button class="nav" data-page="settings">','<button class="nav" data-page="storage"><span>▱</span>荷台収納</button><button class="nav" data-page="settings">',1)
s=s.replace('<h2>今回の記録</h2>','<h2>認識と収納</h2><div class="card"><div class="row"><span>認識の根拠</span><span id="recognition">未確認</span></div><div class="row"><span>荷台収納</span><span id="storage-status">OFF</span></div><div class="row"><span>収納確認</span><span id="storage-count">0回 / 0個</span></div></div><h2>今回の記録</h2>',1)
s=s.replace('<h2>ホットバーと容量</h2>','''<h2>認識と荷台</h2><div class="card"><label class="row"><span>高精度の画像認識<small>探索・数字形状・連続した観測で確認</small></span><span class="toggle toggle-init"><input id="HighAccuracy" type="checkbox"><span class="toggle-icon"></span></span></label><label class="row"><span>近接荷台への自動収納<small>登録した荷台・選択した釣果のみ</small></span><span class="toggle toggle-init"><input id="AutoStorage" type="checkbox"><span class="toggle-icon"></span></span></label></div><h2>ホットバーと容量</h2>''',1)
s=s.replace('自動収納はまだありません。','自動収納には「荷台収納」画面で登録が必要です。')
section='''<section id="page-storage" class="pane"><h1>荷台収納</h1><p class="subtitle">移動せず、釣果を荷台へ。その場で釣りを再開。</p><div id="storage-feedback" class="note" role="status"></div>
<h2>1．荷台を一度開く</h2><div class="card"><div class="row"><span>登録中の荷台</span><span id="registered-storage">未登録</span></div></div><p class="footnote">釣りができ、Altで「ストレージを開く」が出る位置にトラックを停めます。自動釣りを停止し、ゲームで荷台を開いたまま次のボタンを押してください。</p><button id="storage-inspect" class="button button-large secondary">現在開いている荷台を読み込む</button>
<h2>2．収納する魚だけを選ぶ</h2><div class="card"><div class="row"><span>読み込んだ荷台</span><span id="candidate-storage">未確認</span></div><div id="storage-items"><p class="footnote">手持ちの魚をホットバー以外へ置いて読み込んでください。</p></div></div><button id="storage-register" class="button button-fill button-large primary">この荷台と選択した釣果を登録</button><p class="footnote">登録すると自動収納がONになります。荷台を閉じ、同じ位置でF8。作業開始前から持っていた品・竿・食事・ホットバー1〜5は保護し、開始後に増加を確認した選択済みの釣果だけを収納します。</p>
<div class="note"><strong>収納は数量の変化まで確認</strong><p>登録荷台ID、同じ接続、品名・metadata・数量と、手持ちからの減少／荷台側の増加を照合します。結果が不明な操作は再送しません。別の荷台や候補が複数ある場合は移動・視点変更せず待機または停止します。</p><p>釣果の名前が増えた場合は対象を選び直してください。ゲームの再接続後は荷台の再登録が必要です。これらは実機での収納成功を保証する表示ではありません。</p></div></section>
'''
s=s.replace('<section id="page-settings"',section+'<section id="page-settings"',1);p.write_text(s,encoding='utf-8-sig')
edit('ui/app.js',"const boolKeys=['ObserveOnly','BackgroundMode','AutoNeeds'];","const boolKeys=['ObserveOnly','BackgroundMode','AutoNeeds','AutoStorage','HighAccuracy'];")
edit('ui/app.js',"let busy=false,running=false,dirty=false,currentSettings='',ready=false;","let busy=false,running=false,dirty=false,currentSettings='',ready=false,storageSignature='';")
edit('ui/app.js',"text('start-help',data.settings?.ObserveOnly?","applyStorage(data);text('recognition',s.Recognition);text('storage-status',s.Storage);text('storage-count',(s.StorageCycles||0)+'回 / '+(s.StoredItems||0)+'個');\ntext('start-help',data.settings?.ObserveOnly?")
extra='''
function applyStorage(data){const s=data.storage||{},signature=JSON.stringify(s);text('storage-feedback',data.feedback||'初回に荷台と収納対象を登録してください。');text('registered-storage',s.registered?(s.label||s.id)+' / '+s.id:'未登録');text('candidate-storage',s.candidateLabel||s.candidateId||'未確認');
 if(signature!==storageSignature){storageSignature=signature;const list=$('storage-items');list.replaceChildren();for(const item of s.candidates||[]){const label=document.createElement('label');label.className='row';const span=document.createElement('span');span.textContent=item.name+' × '+item.count;const input=document.createElement('input');input.type='checkbox';input.dataset.storageItem=item.name;input.checked=(s.selected||[]).includes(item.name);input.setAttribute('aria-label',item.name+'を収納対象にする');label.append(span,input);list.append(label);}if(!list.children.length){const p=document.createElement('p');p.className='footnote';p.textContent='収納対象の魚を手持ち（ホットバー以外）へ置いて読み込んでください。';list.append(p);}}
 $('storage-inspect').disabled=busy||running;$('storage-register').disabled=busy||running||!s.candidateId;for(const e of document.querySelectorAll('[data-storage-item]'))e.disabled=busy||running;
}
$('storage-inspect').addEventListener('click',()=>{if(!busy&&!running)send('storage.inspect');});
$('storage-register').addEventListener('click',()=>{if(busy||running)return;const items=[...document.querySelectorAll('[data-storage-item]:checked')].map(e=>e.dataset.storageItem);if(!items.length){text('storage-feedback','収納する魚を選択してください。');return;}window.chrome?.webview?.postMessage({action:'storage.register',items});});
'''
p=r/'ui/app.js';s=p.read_text(encoding='utf-8-sig');s=s.replace("if(window.chrome&&window.chrome.webview){window.chrome.webview.addEventListener",extra+"\nif(window.chrome&&window.chrome.webview){window.chrome.webview.addEventListener",1);p.write_text(s,encoding='utf-8-sig')
with (r/'ui/app.css').open('a',encoding='utf-8') as f:f.write('\n#storage-items input[type=checkbox]{width:22px;height:22px;accent-color:#487bff}#recognition,#storage-status{font-size:13px}#storage-feedback{margin-bottom:24px}\n')
print('Integrated registered-truck UI and explicit fish selection')
