using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static partial class CdpBridge {
 // Reuses the miner's exact metadata / registered trunk / two-sided transfer verification.
 // Every call stays on the captured server epoch. No walking or camera commands exist here.
 public sealed class FishingStorageBridge {
  readonly string epoch;readonly string[] frames;readonly CancellationToken token;
  public FishingStorageBridge(string expected,CancellationToken cancel){epoch=expected;token=cancel;if(!TryDecodeServerEpoch(expected,out frames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");}
  async Task<string> Eval(string frame,string expression,bool gesture,int milliseconds){
   token.ThrowIfCancellationRequested();using(var s=await CdpSession.OpenAsync(frame,TimeSpan.FromMilliseconds(milliseconds),frames).ConfigureAwait(false)){
    using(token.Register(()=>s.FishingDeadline(1))){token.ThrowIfCancellationRequested();if(!await s.MatchesServerEpochAsync().ConfigureAwait(false))throw new InvalidOperationException("SERVER_SESSION_CHANGED");return await s.EvaluateStringAsync(expression,gesture).ConfigureAwait(false);}
   }
  }
  public static async Task<string> CurrentEpoch(){string h=await HealthAsync().ConfigureAwait(false);if(!h.StartsWith("HEALTH READY ",StringComparison.Ordinal))throw new InvalidOperationException("対応するゲームUIを確認できません");return h.Substring(13);}
  public static string PairExpression(){return "(() => {"+InventoryPrelude()+@"
    const store=findStore();if(!store)return 'ERROR INVENTORY_UNAVAILABLE';
    const inv=store.getState().inventory;
    const canonical=v=>{if(v===null||v===undefined)return '{}';const clean=x=>{if(x===null||typeof x!=='object')return x;if(Array.isArray(x))return x.map(clean);const o=Object.create(null);for(const k of Object.keys(x).sort())o[k]=clean(x[k]);return o;};return JSON.stringify(clean(v));};
    const snapshot=x=>{if(!x)return null;const rows=[],seen=new Set();let weight=0;for(const item of x.items||[]){if(!item||!item.name||!(item.count>0))continue;
      if(!Number.isInteger(+item.slot)||!Number.isInteger(+item.count)||seen.has(+item.slot))throw Error('INVALID_ITEMS');seen.add(+item.slot);
      rows.push({slot:+item.slot,name:String(item.name),count:+item.count,meta:canonical(item.metadata)});weight+=Math.max(0,num(item.weight));}
      return {weight:whole(weight),max:whole(x.maxWeight),slots:whole(x.slots),used:rows.length,items:rows};};
    if(!inv||!inv.leftInventory||inv.leftInventory.type!=='player')return 'ERROR INVENTORY_UNAVAILABLE';
    const r=inv.rightInventory;return JSON.stringify({open:inventoryVisible(),id:r&&r.id!=null?String(r.id):'',type:String(r&&r.type||''),player:String(inv.leftInventory.id??''),label:String(r&&r.label||''),left:snapshot(inv.leftInventory),right:snapshot(r)});
   })()";}
  public async Task<FishingPilot.StorageView> Pair(){
   string raw=await Eval(InventoryFramePart,PairExpression(),false,3500).ConfigureAwait(false);if(raw.StartsWith("ERROR"))throw new InvalidOperationException(raw);
   var serializer=new JavaScriptSerializer();var d=serializer.Deserialize<Dictionary<string,object>>(raw);
   string left=FormatInventorySnapshotResult("SNAPSHOT_DETAIL "+serializer.Serialize(d["left"]));
   string right=d["right"]==null?"ERROR NO_RIGHT":FormatInventorySnapshotResult("SNAPSHOT_DETAIL "+serializer.Serialize(d["right"]));
   return new FishingPilot.StorageView{Epoch=epoch,Id=GetString(d,"id"),Type=GetString(d,"type"),PlayerId=GetString(d,"player"),Label=GetString(d,"label"),Open=d.ContainsKey("open")&&d["open"] is bool&&(bool)d["open"],Left=FishingPilot.Inventory.Parse(left),Right=FishingPilot.Inventory.Parse(right),LeftSpec=Spec(left),RightSpec=Spec(right)};
  }
  static string Spec(string text){string[] a=text.Split(new[]{' '},6);return a.Length==6&&a[0]=="SNAPSHOT"?a[5]:"";}
  public async Task<string> OpenNearby(int port){
   token.ThrowIfCancellationRequested();
   string existing=await Eval(TargetFramePart,StorageTargetExpression(false),false,2000).ConfigureAwait(false);
   if(existing=="AMBIGUOUS")return "AMBIGUOUS_STORAGE_TARGET";
   if(existing=="PRESENT"){await Task.Delay(60,token).ConfigureAwait(false);return await Eval(TargetFramePart,StorageTargetExpression(true),true,2000).ConfigureAwait(false);}
   if(port==0||port!=FishingPilot.Native.FiveMConsolePort())return "NO_REGISTERED_TARGET_INPUT";
   token.ThrowIfCancellationRequested();bool pressed=false;
   try{
    pressed=TrySendDevCon(port,"+ox_target",0);if(!pressed)return "TARGET_INPUT_REJECTED";
    int stable=0;for(int i=0;i<25;i++){
     await Task.Delay(60,token).ConfigureAwait(false);
     string p=await Eval(TargetFramePart,StorageTargetExpression(false),false,2000).ConfigureAwait(false);
     if(p=="AMBIGUOUS")return "AMBIGUOUS_STORAGE_TARGET";
     if(p=="PRESENT")stable++;else stable=0;
     if(stable>=2){token.ThrowIfCancellationRequested();return await Eval(TargetFramePart,StorageTargetExpression(true),true,2000).ConfigureAwait(false);}
    }return "NEARBY_STORAGE_NOT_VISIBLE";
   }finally{if(pressed)TrySendDevCon(port,"-ox_target",0);}
  }
  public async Task<string> Close(){token.ThrowIfCancellationRequested();return await CloseInventoryAsync(frames).ConfigureAwait(false);}
  public async Task<string> Transfer(FishingPilot.StorageIntent intent){
   if(intent.Epoch!=epoch||intent.Authorized.Count!=1||intent.Count<1)throw new InvalidOperationException("INVALID_STORAGE_INTENT");
   token.ThrowIfCancellationRequested();
   using(token.Register(()=>{Task.Run(async ()=>{try{await CancelOperationAsync(intent.Token,frames).ConfigureAwait(false);}catch{}});})){return await DepositDeltaAsync(intent.StorageId,"trunk",intent.Baseline,intent.Authorized,intent.Token,frames).ConfigureAwait(false);}
  }
 }
}

namespace FishingPilot {
 public sealed class NearbyStorageService {
  readonly string root;readonly Action<string,string> log;readonly Action<string> display;
  public NearbyStorageService(string directory,Action<string,string> logger,Action<string> show){root=directory;log=logger;display=show;}
  public static async Task<StorageView> Inspect(CancellationToken token){string epoch=await CdpBridge.FishingStorageBridge.CurrentEpoch().ConfigureAwait(false);return await new CdpBridge.FishingStorageBridge(epoch,token).Pair().ConfigureAwait(false);}
  public async Task<int> Run(StorageRegistration registration,CatchLedger ledger,string epoch,int port,CancellationToken token){
   registration.Validate();if(registration.Epoch!=epoch)throw new InvalidOperationException("SERVER_SESSION_CHANGED: 荷台を登録し直してください");
   var journal=new StorageJournal(root);var bridge=new CdpBridge.FishingStorageBridge(epoch,token);int moved=0;
   display("荷台を確認しています（移動・視点変更なし）");StorageView view=await bridge.Pair().ConfigureAwait(false);
   if(!view.Open){string opened=await bridge.OpenNearby(port).ConfigureAwait(false);log("storage_target",opened);if(opened!="CLICKED")return 0;
    for(int i=0;i<25;i++){await Task.Delay(80,token).ConfigureAwait(false);view=await bridge.Pair().ConfigureAwait(false);if(view.Open)break;}}
   if(!registration.Matches(view))throw new InvalidOperationException("WRONG_OR_UNVERIFIED_STORAGE: 登録した荷台ではありません");
   var pending=journal.Pending();
   if(pending!=null){
    // Never resend an uncertain operation. Only a matching paired change can retire it.
    if(!pending.PairConfirmed(view))throw new InvalidOperationException("PENDING_STORAGE_UNCONFIRMED: 未確定の収納は再送しません");
    journal.Confirm(pending);moved+=pending.Count;log("storage_reconciled","token="+pending.Token+" paired_delta=1 no_resend=1");
   }
   for(int index=0;index<100;index++){
    token.ThrowIfCancellationRequested();view=await bridge.Pair().ConfigureAwait(false);
    var intent=StorageIntent.Plan(registration,view,ledger);if(intent==null)break;
    display("釣果を収納中："+intent.Name+" × "+intent.Count);intent.State="dispatched_or_unknown";journal.Write(intent);
    // Durable write BEFORE the first mutation. A crash cannot erase an in-flight operation.
    log("storage_dispatch","token="+intent.Token+" count="+intent.Count+" slot="+intent.SourceSlot);
    string receipt;
    try{receipt=await bridge.Transfer(intent).ConfigureAwait(false);intent.Receipt=receipt;journal.Write(intent);}
    catch{log("storage_pending","token="+intent.Token+" no_retry=1");throw;}
    if(!intent.ReceiptConfirmed(receipt)){
     log("storage_receipt_rejected",receipt);
     if(ProvablyNotSent(receipt)) {System.IO.File.Delete(System.IO.Path.Combine(root,"storage-pending.json"));System.IO.File.Delete(System.IO.Path.Combine(root,"storage-pending.json.bak"));break;}
     throw new InvalidOperationException("STORAGE_RESULT_UNCONFIRMED: 転送結果を再確認してください");
    }
    StorageView after=await bridge.Pair().ConfigureAwait(false);
    if(!intent.PairConfirmed(after))throw new InvalidOperationException("STORAGE_PAIR_NOT_CONFIRMED");
    journal.Confirm(intent);ledger.Debit(intent.Key,intent.Count);moved+=intent.Count;
    log("storage_confirmed","token="+intent.Token+" count="+intent.Count+" both_inventories=1");
   }
   display("荷台を閉じて釣り再開を準備しています");string closed=await bridge.Close().ConfigureAwait(false);if(closed!="CLOSED")throw new InvalidOperationException("STORAGE_CLOSE_UNCONFIRMED");
   var final=await bridge.Pair().ConfigureAwait(false);if(final.Open)throw new InvalidOperationException("STORAGE_STILL_OPEN");
   log("storage_cycle_complete","moved="+moved+" closed=1");return moved;
  }
  public static bool ProvablyNotSent(string receipt){return new[]{"ERROR STORAGE_FULL","ERROR NO_DELTA","ERROR UNAUTHORIZED_DELTA","ERROR WRONG_STORAGE","ERROR INVENTORY_CLOSED","ERROR UNSAFE_ITEM","ERROR CANCELLED","ERROR INVALID_BASELINE","ERROR INVALID_AUTHORIZATION","ERROR MOVE_REJECTED"}.Contains(receipt);}
 }
}
