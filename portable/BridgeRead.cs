using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
internal static partial class CdpBridge {
 public sealed class FishingTelemetryReader : IDisposable {
  CdpSession session; string epoch; bool dead,installed; DateTime nextEpochCheck;
  readonly string probe=File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"InventoryProbe.js"));
  public async Task<FishingPilot.Telemetry> Read() {
   if(dead)throw new ObjectDisposedException("Telemetry reader");
   if(session==null){string h=await HealthAsync().ConfigureAwait(false);if(!h.StartsWith("HEALTH READY ",StringComparison.Ordinal))return new FishingPilot.Telemetry{Error="対応NUIを確認しています"};epoch=h.Substring(13);string[] frames;if(!TryDecodeServerEpoch(epoch,out frames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");session=await CdpSession.OpenAsync(InventoryFramePart,TimeSpan.FromSeconds(2),frames).ConfigureAwait(false);session.FishingDeadline(-1);}
   session.FishingDeadline(1000);
   try {
    if(DateTime.UtcNow>=nextEpochCheck){if(!await session.MatchesServerEpochAsync().ConfigureAwait(false))return new FishingPilot.Telemetry{Error="接続が変わりました"};nextEpochCheck=DateTime.UtcNow.AddMilliseconds(1000);}
    string expression=installed?"window.__fpInventory060?window.__fpInventory060.sample():'REINSTALL'":"(()=>{"+InventoryPrelude()+"return "+probe.Trim().TrimEnd(';')+";})()";
    string raw=await session.EvaluateStringAsync(expression,false).ConfigureAwait(false);
    if(raw=="REINSTALL"){installed=false;return new FishingPilot.Telemetry{Epoch=epoch,Error="所持品の更新監視を再接続中"};}
    installed=true;
    var d=Json.DeserializeObject(raw) as Dictionary<string,object>;if(d==null)throw new InvalidDataException("Invalid live inventory snapshot");
    var l=GetObject(d,"left");var r=GetObject(d,"right");
    var inv=Decode(l);var right=Decode(r);
    bool unknown=d.ContainsKey("unknownDelta")&&d["unknownDelta"] is bool&&(bool)d["unknownDelta"];
    bool open=d.ContainsKey("open")&&d["open"] is bool&&(bool)d["open"];
    string type=GetString(r,"type");
    return new FishingPilot.Telemetry{Known=inv.Known&&!unknown,InventoryOpen=open,Inventory=inv,Epoch=epoch,
      Trunk=type=="trunk"?right:new FishingPilot.Inventory(),TrunkId=type=="trunk"?GetString(r,"id"):"",TrunkLabel=type=="trunk"?GetString(r,"label"):"",TrunkOpen=open&&type=="trunk",
      Revision=d.ContainsKey("revision")?Convert.ToInt64(d["revision"]):0,InventorySource=GetString(d,"source"),
      Error=inv.Known&&!unknown?"": "所持品を一度開いて閉じ、重量と全スロットを同期してください"};
   }finally{session.FishingDeadline(-1);}
  }
  static FishingPilot.Inventory Decode(Dictionary<string,object> data) {
   if(data==null||data.Count==0||!data.ContainsKey("weight")||Convert.ToDouble(data["weight"])<0)return new FishingPilot.Inventory();
   var inv=FishingPilot.Inventory.Parse(FormatInventorySnapshotResult("SNAPSHOT_DETAIL "+Json.Serialize(data)));
   object rows;if(data.TryGetValue("items",out rows)&&rows is object[])foreach(var obj in (object[])rows){var item=obj as Dictionary<string,object>;if(item==null)continue;string name=GetString(item,"name"),label=GetString(item,"label");if(name.Length>0&&label.Length<=128)inv.Labels[name]=label;}
   return inv;
  }
  public void Dispose(){dead=true;if(session!=null)session.Dispose();session=null;}
 }
}
