from pathlib import Path
r=Path(__file__).parent

def edit(name, old, new, count=1):
 p=r/name;s=p.read_text(encoding='utf-8-sig')
 if s.count(old)!=count:raise RuntimeError(f'{name}: expected {count} occurrences of {old[:70]!r}, got {s.count(old)}')
 p.write_text(s.replace(old,new),encoding='utf-8-sig')

if 'Version="0.4.0-preview"' in (r/'Program.cs').read_text(encoding='utf-8-sig'):
 print('0.4.0 sources already integrated');raise SystemExit(0)

# Keep metadata tokens URL-safe, but storage IDs use the original miner's regular Base64 contract.
edit('StorageModel.cs',"return Convert.ToBase64String(Encoding.UTF8.GetBytes(value)).TrimEnd('=').Replace('+','-').Replace('/','_');","return Convert.ToBase64String(Encoding.UTF8.GetBytes(value));")
# Expose the exact production transfer expression for fault-injection browser tests.
p=r/'CdpBridge.cs';s=p.read_text(encoding='utf-8-sig');a=s.index('    private static async Task<string> DepositDeltaAsync(');b=s.index('    private static string FormatDepositReceipt(',a)
block=s[a:b];expr=block.replace('private static async Task<string> DepositDeltaAsync(', 'private static string DepositDeltaExpression(',1)
end='        string raw = await EvaluateInventoryStringAsync(expression, TimeSpan.FromSeconds(45), true).ConfigureAwait(false);\n        return FormatDepositReceipt(raw, storageId, storageType, operationToken);'
assert end in expr;expr=expr.replace(end,'        return expression;')
wrapper='''    private static async Task<string> DepositDeltaAsync(string storageId, string storageType,
        Dictionary<string,int> baseline, Dictionary<string,int> authorized, string operationToken,
        string[] expectedServerFrames = null)
    {
        string expression = DepositDeltaExpression(storageId,storageType,baseline,authorized,operationToken);
        string raw = await EvaluateInventoryStringAsync(expression,TimeSpan.FromSeconds(12),true,expectedServerFrames).ConfigureAwait(false);
        return FormatDepositReceipt(raw,storageId,storageType,operationToken);
    }

'''
s=s[:a]+wrapper+expr+s[b:];p.write_text(s,encoding='utf-8-sig')
edit('CdpBridge.cs','private static async Task<string> EvaluateInventoryStringAsync(string expression, TimeSpan timeout, bool userGesture)','private static async Task<string> EvaluateInventoryStringAsync(string expression, TimeSpan timeout, bool userGesture, string[] expectedServerFrames = null)')
edit('CdpBridge.cs','CdpSession.OpenAsync(InventoryFramePart, timeout).ConfigureAwait(false)','CdpSession.OpenAsync(InventoryFramePart, timeout, expectedServerFrames).ConfigureAwait(false)')
edit('CdpBridge.cs','private static async Task<string> CloseInventoryAsync()','private static async Task<string> CloseInventoryAsync(string[] expectedServerFrames = null)')
edit('CdpBridge.cs','EvaluateInventoryStringAsync(expression, TimeSpan.FromSeconds(6), true)','EvaluateInventoryStringAsync(expression, TimeSpan.FromSeconds(6), true, expectedServerFrames)')
edit('CdpBridge.cs','private static async Task<string> CancelOperationAsync(string operationToken)','private static async Task<string> CancelOperationAsync(string operationToken, string[] expectedServerFrames = null)')
edit('CdpBridge.cs','CdpSession.OpenAsync(InventoryFramePart, TimeSpan.FromSeconds(4)).ConfigureAwait(false)','CdpSession.OpenAsync(InventoryFramePart, TimeSpan.FromSeconds(4), expectedServerFrames).ConfigureAwait(false)')
# Narrower spans are resolved from actual geometry, never enlarged by a lower match threshold.
edit('SceneProbe.js','!g||!a)return null','!g||!a||g.k!==\'green\'||a.k!==\'white\')return null')
edit('SceneProbe.js','g.sweep<4||g.sweep>130','g.sweep<2||g.sweep>130')
edit('SceneProbe.js',"a.k==='green'&&a.sweep>=4&&a.sweep<=130","a.k==='green'&&a.sweep>=2&&a.sweep<=130")
edit('SceneProbe.js','Math.max(1.2,Math.min(3,r.span*.10))','Math.max(.35,Math.min(3,r.span*.10))')
# Allow the fallback to locate off-center rings, with temporal agreement before any pixel key.
edit('FishCore.cs','public double Radius, Pointer, Start, End, Confidence;','public double Radius, Pointer, Start, End, Confidence, CenterX, CenterY;')
edit('Engine.cs','public int ReserveGrams=500,MinRecastMs=1400;','public bool AutoStorage=false,HighAccuracy=true;public int ReserveGrams=500,MinRecastMs=1400;')
edit('Engine.cs','public string Backend="未確認",Delivery="未確認";','public string Storage="未登録／OFF",Recognition="未確認"; public int StorageCycles,StoredItems; public string Backend="未確認",Delivery="未確認";')
edit('Engine.cs','bool disposed;string sessionId="";','bool disposed;string sessionId="";StorageRegistration storageRegistration;CatchLedger catchLedger;double nextStorageAt;bool reconcileStorage,storageResumePending;')
edit('Engine.cs','options=o;stop=new CancellationTokenSource();','''options=o;
   storageRegistration=null;catchLedger=null;nextStorageAt=0;storageResumePending=false;
   reconcileStorage=new StorageJournal(root).Pending()!=null;
   if(reconcileStorage&&!o.AutoStorage)throw new InvalidOperationException("未確定の収納があります。自動収納ONで登録荷台を開き、再確認してください");
   if(o.AutoStorage){string path=Path.Combine(root,"storage-registration.json");if(!File.Exists(path))throw new InvalidOperationException("先に荷台と収納対象を登録してください");storageRegistration=new JavaScriptSerializer().Deserialize<StorageRegistration>(File.ReadAllText(path));storageRegistration.Validate();if(storageRegistration.Items.Length==0)throw new InvalidOperationException("収納対象の釣果を選択してください");}
   stop=new CancellationTokenSource();''')
edit('Engine.cs','var reader=new RingReader(templates);','var reader=new RingReader(templates);var precise=new AdaptiveRingReader(templates);var pixelGate=new PixelEvidenceGate();')
edit('Engine.cs','r=reader.ReadAuto(b);','r=options.HighAccuracy?precise.ReadAuto(b):reader.ReadAuto(b);',2)
edit('Engine.cs','bool fresh=t.Known&&now-t.At>=0&&now-t.At<2500;','''bool fresh=t.Known&&now-t.At>=0&&now-t.At<2500;
     if(fresh&&catchLedger==null)catchLedger=new CatchLedger(t.Inventory);
     if(options.AutoStorage&&fresh&&storageRegistration.Epoch!=t.Epoch){Fail("サーバー接続が変わりました。荷台を登録し直してください");break;}
     state.Recognition=r.Native?"SVG描画値＋数字＋連続観測":options.HighAccuracy?precise.Evidence:"画像テンプレート";
     state.Storage=options.AutoStorage?"登録荷台・選択した釣果のみ収納":"自動収納OFF";''')
edit('Engine.cs','if(fresh&&scene.Cost<100&&!(options.BackgroundMode&&r.Native))','if(fresh&&scene.Cost<100&&!(options.BackgroundMode&&r.Native)&&(!options.HighAccuracy||r.Native||pixelGate.Accept(r,now)))')
edit('Engine.cs','if(obtained)state.Results++;','if(obtained){state.Results++;if(storageRegistration!=null)catchLedger.Credit(before,t.Inventory,storageRegistration.Items);}')
edit('Engine.cs','acknowledged=true;}','acknowledged=true;if(storageResumePending){storageResumePending=false;Log("storage_fishing_resumed","progress_or_round_observed=1");}}')
old='else if(t.Inventory.Full(options.ReserveGrams)||fullNotice){phase="full";HandleNeeds(now,token,foreground);if(!fullAlert){fullAlert=true;Notify("インベントリがいっぱい、または空きが少なくなったよ");Log("capacity_wait",t.Inventory.Weight+"/"+t.Inventory.Maximum);}}'
new='''else if(t.Inventory.Full(options.ReserveGrams)||fullNotice||reconcileStorage){
       phase="full";bool needsReady=HandleNeeds(now,token,foreground);
       if(!fullAlert){fullAlert=true;Notify(options.AutoStorage?"インベントリがいっぱいになったよ。登録荷台への収納を確認します":"インベントリがいっぱい、または空きが少なくなったよ");Log("capacity_wait",t.Inventory.Weight+"/"+t.Inventory.Maximum);}
       if(options.AutoStorage&&needsReady&&sceneKnown&&!scene.Busy&&now>=nextStorageAt&&RecastPolicy.Ready(now,nextCastAt,quietSince,present,scene.Busy,fresh)){
        phase="storage";state.Phase="荷台収納・転送確認";Publish();
        var service=new NearbyStorageService(root,Log,text=>{state.Detail=text;state.Storage=text;Publish();});
        int moved=service.Run(storageRegistration,catchLedger,epoch,CdpBridge.FishingConnection.ConsolePort(),token).GetAwaiter().GetResult();
        token.ThrowIfCancellationRequested();reconcileStorage=false;nextStorageAt=Now+15000;
        if(moved>0){state.StorageCycles++;state.StoredItems+=moved;storageResumePending=true;nextCastAt=Now+700;quietSince=-1;nextHud=0;Log("storage_resume_pending","moved="+moved+" wait_fresh_inventory=1");}
        else{reason="収納できる今回の釣果・荷台の空きを確認待ちです";Log("storage_no_progress","no_unverified_success=1");}
        Emit(t,new Scene(),Now,foreground);continue;
       }
      }'''
edit('Engine.cs',old,new)
edit('Engine.cs','ReadMs=state.ReadMs});','ReadMs=state.ReadMs,Storage=state.Storage,Recognition=state.Recognition,StorageCycles=state.StorageCycles,StoredItems=state.StoredItems});')
edit('Engine.cs','case "full":return "空き容量待ち";','case "full":return "空き容量／登録荷台待ち";case "storage":return "収納と釣り再開の確認";')
# Release target mode and native pending keyups on cancellation as well as normal close.
edit('FishingScene.cs','public void Dispose(){if(dead)return;dead=true;foreach(var s in sessions.Values)try{s.Dispose();}catch{}sessions.Clear();}', 'public void Dispose(){if(dead)return;dead=true;foreach(var s in sessions.Values)try{s.FishingDeadline(200);s.EvaluateStringAsync("window.__fpProbe3?window.__fpProbe3.stop(): \'STOPPED\'",false).GetAwaiter().GetResult();}catch{}finally{s.Dispose();}sessions.Clear();}')
edit('FishingPilot.csproj','RecastPolicy.cs;Tests.cs','RecastPolicy.cs;Tests.cs;StorageModel.cs;FishingStorage.cs;AdaptiveRecognition.cs;Tests040.cs')
edit('Tests.cs','    NativeInputTest(notes);','    count+=Tests040.Run(output);notes.Add("storage040: exact metadata ledger, protected items, paired receipts, durable pending guard tested");\n    NativeInputTest(notes);')
edit('Program.cs','if(args.Length>0&&args[0]=="--self-test")','if(args.Length>1&&args[0]=="--storage-expressions"){CdpBridge.ExportStorageExpressions(args[1]);return 0;}\n   if(args.Length>0&&args[0]=="--self-test")')
# New flags are optional in old settings payloads; this preserves existing saved settings and UI protocol.
edit('Program.cs','"MinRecastMs","GaugeRadius"};','"MinRecastMs","GaugeRadius","AutoStorage","HighAccuracy"};')
edit('Program.cs','if(d.Count!=keys.Count)','if(d.Count<8||d.Count>keys.Count)')
edit('Program.cs','o.BackgroundMode=Bool(d,"BackgroundMode");Validate(o);','o.BackgroundMode=Bool(d,"BackgroundMode");if(d.ContainsKey("AutoStorage"))o.AutoStorage=Bool(d,"AutoStorage");if(d.ContainsKey("HighAccuracy"))o.HighAccuracy=Bool(d,"HighAccuracy");Validate(o);')
# Version all runtime and test files, leaving dependencies pinned.
for name in ['Program.cs','Engine.cs','SceneProbe.js','Build.ps1','TestScene.py','TestUi.py','README.txt','ui/index.html']:
 p=r/name;p.write_text(p.read_text(encoding='utf-8-sig').replace('0.3.0','0.4.0'),encoding='utf-8-sig')
print('Integrated recognition and epoch-bound storage engine 0.4.0')
