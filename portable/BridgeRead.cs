using System;
using System.Threading;
using System.Threading.Tasks;
internal static partial class CdpBridge {
 public sealed class FishingTelemetryReader : IDisposable {
  CdpSession session;string epoch;bool dead;
  public async Task<FishingPilot.Telemetry> Read() {
   if(dead)throw new ObjectDisposedException("Telemetry reader");
   if(session==null){string h=await HealthAsync().ConfigureAwait(false);if(!h.StartsWith("HEALTH READY ",StringComparison.Ordinal))return new FishingPilot.Telemetry{Error="対応NUIを確認しています"};epoch=h.Substring(13);string[] frames;if(!TryDecodeServerEpoch(epoch,out frames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");session=await CdpSession.OpenAsync(InventoryFramePart,TimeSpan.FromSeconds(2),frames).ConfigureAwait(false);session.FishingDeadline(-1);}
   session.FishingDeadline(1500);
   try {
    if(!await session.MatchesServerEpochAsync().ConfigureAwait(false))return new FishingPilot.Telemetry{Error="接続が変わりました"};
    string raw=await session.EvaluateStringAsync(InventorySnapshotExpression(),false).ConfigureAwait(false);
    var inv=FishingPilot.Inventory.Parse(FormatInventorySnapshotResult(raw));
    if(raw.StartsWith("SNAPSHOT_DETAIL ",StringComparison.Ordinal))try{var d=Json.DeserializeObject(raw.Substring(16)) as System.Collections.Generic.Dictionary<string,object>;foreach(var item in (object[])d["items"]){var row=(System.Collections.Generic.Dictionary<string,object>)item;string n=GetString(row,"name"),label=GetString(row,"label");if(label.Length>0&&label.Length<=128)inv.Labels[n]=label;}}catch{}
    string inventoryState=await session.EvaluateStringAsync(ClosedInventoryStateExpression(),false).ConfigureAwait(false);
    return new FishingPilot.Telemetry{Known=inv.Known,InventoryOpen=inventoryState!="CLOSED",Inventory=inv,Epoch=epoch,Error=inv.Known?"":"所持品を一度開いて閉じると初期化されます"};
   }finally {session.FishingDeadline(-1);}
  }
  public void Dispose(){dead=true;if(session!=null)session.Dispose();session=null;}
 }
}
