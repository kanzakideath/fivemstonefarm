using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
internal static partial class CdpBridge {
 // Transport recovery never falls back to desktop keys or blindly resubmits an uncertain action.
 public sealed class FishingBackgroundControl : IDisposable {
  readonly string epoch;readonly CancellationToken token;CdpSession inventory;bool installed,dead;string uncertainId="";int uncertainSlot;
  public string LastResult="not_initialized";
  public FishingBackgroundControl(string expected,CancellationToken cancel){epoch=expected;token=cancel;}
  void Disconnect(){if(inventory!=null)try{inventory.Dispose();}catch{}inventory=null;installed=false;}
  public async Task<bool> UseSlot(int slot,string id){
   token.ThrowIfCancellationRequested();if(dead||slot<1||slot>5)return false;
   bool mightSubmit=false;
   try{
    string[] frames;if(!TryDecodeServerEpoch(epoch,out frames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");
    if(inventory==null){inventory=await CdpSession.OpenAsync(InventoryFramePart,TimeSpan.FromSeconds(2),frames).ConfigureAwait(false);inventory.FishingDeadline(-1);}
    inventory.FishingDeadline(1800);
    if(!await inventory.MatchesServerEpochAsync().ConfigureAwait(false))throw new InvalidOperationException("SERVER_SESSION_CHANGED");
    if(uncertainId!=""){
     string check=await inventory.EvaluateStringAsync("window.__fpSlots064?window.__fpSlots064.query("+Json.Serialize(uncertainId)+"): 'CONTEXT_LOST'",false).ConfigureAwait(false);
     if(check=="CONTEXT_LOST"){LastResult="DELIVERY_UNCERTAIN_CONTEXT_LOST: 前回の入力結果を確認できません。F6で停止して状態確認";return false;}
     var receipt=Json.DeserializeObject(check) as Dictionary<string,object>;
     string code=receipt==null?"INVALID_RESULT":GetString(receipt,"code");
     if(code=="RECEIPT"){uncertainId="";installed=true;LastResult=slot==uncertainSlot?"SUBMITTED_RECEIPT_RECOVERED":"PREVIOUS_ACTION_RECEIPT_RECOVERED";return slot==uncertainSlot;}
     if(code!="NOT_FOUND"){LastResult="DELIVERY_UNCERTAIN";return false;}
     uncertainId="";
    }
    if(!installed){
     string source=File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"BackgroundSlots.js"));
     await inventory.EvaluateStringAsync(source,false).ConfigureAwait(false);
     await inventory.EvaluateStringAsync("window.__fpSlots064.start()",false).ConfigureAwait(false);installed=true;
    }
    token.ThrowIfCancellationRequested();string request=Json.Serialize(new Dictionary<string,object>{{"slot",slot},{"id",id}});
    mightSubmit=true;
    string raw=await inventory.EvaluateStringAsync("window.__fpSlots064.use("+request+")",false).ConfigureAwait(false);
    var data=Json.DeserializeObject(raw) as Dictionary<string,object>;LastResult=data==null?"INVALID_RESULT":GetString(data,"code");
    if(data==null){uncertainId=id;uncertainSlot=slot;return false;}
    return data.ContainsKey("sent")&&data["sent"] is bool&&(bool)data["sent"];
   }catch(Exception e){
    if(token.IsCancellationRequested||e.Message.Contains("SERVER_SESSION_CHANGED"))throw;
    if(mightSubmit){uncertainId=id;uncertainSlot=slot;}
    LastResult=(mightSubmit?"DELIVERY_UNCERTAIN":"RECONNECTING")+": "+e.GetType().Name+" "+e.Message;
    Disconnect();return false;
   }finally{if(inventory!=null)try{inventory.FishingDeadline(-1);}catch{}}
  }
  public void CompleteObservedAction(){if(dead)return;uncertainId="";if(inventory==null||!installed)return;try{inventory.FishingDeadline(500);inventory.EvaluateStringAsync("window.__fpSlots064?window.__fpSlots064.complete():'NONE'",false).GetAwaiter().GetResult();}catch{}finally{try{inventory.FishingDeadline(-1);}catch{}}}
  public void Dispose(){if(dead)return;dead=true;if(inventory!=null){try{inventory.FishingDeadline(350);inventory.EvaluateStringAsync("window.__fpSlots064?window.__fpSlots064.stop():'STOPPED'",false).GetAwaiter().GetResult();}catch{}Disconnect();}}
 }
}
namespace FishingPilot {
 public sealed class BackgroundRaster : IDisposable {
  readonly object gate=new object();readonly CancellationToken token;readonly Func<double> now;readonly Func<bool> enabled;readonly string epoch,templates;readonly bool high;
  readonly Task task;Scene requested=new Scene(),result=new Scene();double captured=-10000;string error="";
  public BackgroundRaster(string expected,string digits,bool accurate,Func<double> clock,Func<bool> active,CancellationToken cancel){epoch=expected;templates=digits;high=accurate;now=clock;enabled=active;token=cancel;task=Task.Run((Func<Task>)Run);}
  public void Request(Scene scene){lock(gate)requested=scene;}
  public Scene Snapshot(out string fault){lock(gate){fault=error;if(now()-captured+result.Cost>180)return new Scene();return result;}}
  async Task Run(){CdpBridge.FishingConnection link=null;var precise=new AdaptiveRingReader(templates);var reader=new RingReader(templates);
   try{while(!token.IsCancellationRequested){
    if(!enabled()){await Task.Delay(100,token).ConfigureAwait(false);continue;}
    try{
     if(link==null){link=new CdpBridge.FishingConnection(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"SceneProbe.js")),token);await link.Initialize(epoch).ConfigureAwait(false);}
     Scene source;lock(gate)source=requested;double started=now();Ring r;
     using(var image=await link.Capture(source,false).ConfigureAwait(false))r=high?precise.ReadAuto(image):reader.ReadAuto(image);
     if(source.Key>=0&&source.Key!=r.Key)r.Valid=false;
     var value=new Scene{Present=r.Valid,Ring=r,Source="NUI raster worker",Frame=source.Frame,Key=source.Key,Stamp=source.Stamp,At=now(),Cost=now()-started};
     lock(gate){result=value;captured=value.At;error="";}
     await Task.Delay(source.Present?30:350,token).ConfigureAwait(false);
    }catch(Exception e){if(token.IsCancellationRequested)break;lock(gate)error=e.Message;if(link!=null){link.Dispose();link=null;}await Task.Delay(1000,token).ConfigureAwait(false);}
   }}catch(OperationCanceledException){}finally{if(link!=null)link.Dispose();}
  }
  public void Dispose(){try{task.Wait(1800);}catch{}}
 }
}
