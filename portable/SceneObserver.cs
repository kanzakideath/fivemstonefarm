using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
namespace FishingPilot {
 // Independent, READ-ONLY connection. Never sends a digit or steals foreground focus.
 // Slow frame discovery cannot block the foreground timing/input loop.
 public sealed class SceneObserver : IDisposable {
  readonly object gate=new object();readonly Func<string> getEpoch;readonly Func<bool> foreground;readonly Func<double> now;readonly CancellationToken token;
  CdpBridge.FishingConnection link;Scene latest=new Scene();double observed=-10000;string error="";Task task;
  readonly Queue<Notice> pending=new Queue<Notice>();readonly HashSet<string> seen=new HashSet<string>();
  public SceneObserver(Func<string> epoch,Func<bool> front,Func<double> clock,CancellationToken cancel){getEpoch=epoch;foreground=front;now=clock;token=cancel;task=Task.Run((Func<Task>)Run);}
  async Task Run(){
   try{while(!token.IsCancellationRequested){
    if(!foreground()||String.IsNullOrEmpty(getEpoch())){await Task.Delay(50,token).ConfigureAwait(false);continue;}
    try{
     if(link==null){link=new CdpBridge.FishingConnection(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"SceneProbe.js")),token);await link.Initialize(getEpoch()).ConfigureAwait(false);}
     double started=now();var scene=await link.Poll(false,"").ConfigureAwait(false);scene.Cost=now()-started;scene.At=now();
     lock(gate){latest=scene;observed=scene.At;error="";foreach(var n in scene.Notices)if(seen.Add(n.Id)){pending.Enqueue(n);if(pending.Count>128)pending.Dequeue();}if(seen.Count>4096)seen.Clear();}
     await Task.Delay(scene.Present?4:25,token).ConfigureAwait(false);
    }catch(Exception e){if(token.IsCancellationRequested)break;lock(gate)error=e.Message;if(link!=null)link.Dispose();link=null;await Task.Delay(500,token).ConfigureAwait(false);}
   }}catch(OperationCanceledException){}finally{if(link!=null)link.Dispose();link=null;}
  }
  public Scene Snapshot(out bool fresh,out string fault){lock(gate){fresh=now()-observed<1500;fault=error;var l=latest;
   var s=new Scene{Present=fresh&&l.Present,Busy=fresh&&l.Busy,Frame=l.Frame,Stamp=l.Stamp,Source="foreground observer",Key=l.Key,Width=l.Width,Height=l.Height,
    At=l.At,Cost=l.Cost,Hunger=l.Hunger,Water=l.Water,Discovery=l.Discovery};
   // A stale DOM angle may never be used to press a digit. Pixel capture remains available.
   if(fresh&&now()-l.At+l.Cost<=60)s.Ring=l.Ring;
   while(pending.Count>0)s.Notices.Add(pending.Dequeue());return s;}}
  public void Dispose(){if(task!=null)try{task.Wait(2000);}catch{}}
 }
}
