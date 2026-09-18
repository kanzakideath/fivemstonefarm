using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
namespace FishingPilot {
 public sealed class Telemetry {public bool Known;public string Epoch="",Notice="NONE",Error="";public Inventory Inventory=new Inventory();public double At;}
 public sealed class Options {public int RodKey=2,FoodKey=1,DrinkKey=3;public bool AutoNeeds=true,ObserveOnly=false,BackgroundMode=true;public int ReserveGrams=500,MinRecastMs=1400;public double FoodX=-1,FoodY=-1,WaterX=-1,WaterY=-1,GaugeRadius=20;}
 public sealed class Status {public string Phase="停止中",Detail="",Inventory="未確認",Hunger="未確認",Thirst="未確認",Ring="未検出";public string Backend="未確認",Delivery="未確認"; public double ReadMs; public int Casts,Keys,Results;public bool Running;}
 public sealed class Engine : IDisposable {
  public event Action<Status> Changed;public event Action<string> Alert;
  readonly string root,templates;readonly object gate=new object(),logGate=new object();
  CancellationTokenSource stop;Task worker,telemetryWorker;readonly Stopwatch clock=Stopwatch.StartNew();
  Telemetry telemetry=new Telemetry();Status state=new Status();IntPtr target;uint targetPid;Options options;
  string epoch="",phase="ready",reason="",pendingNeed="",lastPhase="";double castAt,lastRingAt=-10000,nextCastAt,nextHud,foodActionAt=-10000,quietSince=-1,heartbeat,lastUi,sceneRetry;
  OutcomeLatch outcomes=new OutcomeLatch();
  Inventory before;RoundController round=new RoundController();bool castIssued,seenRing,fullAlert,acknowledged,resultWarned;
  int castRetries,consolePort,castSerial; string castCycle="";CdpBridge.FishingConnection sceneLink;
  HashSet<string> notices=new HashSet<string>();Queue<string> noticeQueue=new Queue<string>();
  VitalGauge hunger=new VitalGauge(),water=new VitalGauge(),cachedFood=new VitalGauge(),cachedWater=new VitalGauge();int hungerVotes,waterVotes;double hungerObservedAt,waterObservedAt,needBefore;
  bool disposed;string sessionId="";
  public Engine(string directory,string templateFile){root=directory;templates=templateFile;Directory.CreateDirectory(root);}
  double Now{get{return clock.Elapsed.TotalMilliseconds;}}
  public bool Busy {get{return (worker!=null&&!worker.IsCompleted)||(telemetryWorker!=null&&!telemetryWorker.IsCompleted);}}
  public bool Running{get{return stop!=null&&!stop.IsCancellationRequested&&worker!=null&&!worker.IsCompleted;}}
  public void Start(Options o) {
   if(Running)return;if(worker!=null&&!worker.IsCompleted||telemetryWorker!=null&&!telemetryWorker.IsCompleted)throw new InvalidOperationException("停止処理中です。数秒後に再開してください");
   target=Native.FishingWindow();if(target==IntPtr.Zero&&o.BackgroundMode)target=Native.FindFishingWindow();if(target==IntPtr.Zero)throw new InvalidOperationException("FiveMを起動し、最初はゲーム上でF8を押してください");Native.GetWindowThreadProcessId(target,out targetPid);
   options=o;stop=new CancellationTokenSource();var token=stop.Token;sessionId=Guid.NewGuid().ToString("N").Substring(0,12);round.Reset();outcomes.Clear();epoch="";phase="ready";reason="";lastPhase="";castIssued=seenRing=fullAlert=acknowledged=resultWarned=false;before=null;pendingNeed="";nextHud=0;foodActionAt=-10000;nextCastAt=Now;lastRingAt=-10000;quietSince=-1;hungerVotes=waterVotes=0;castRetries=0;heartbeat=lastUi=sceneRetry=0;
   hunger=new VitalGauge();water=new VitalGauge();cachedFood=new VitalGauge();cachedWater=new VitalGauge();notices.Clear();noticeQueue.Clear();
   consolePort=o.BackgroundMode?CdpBridge.FishingConnection.ConsolePort():0;
   telemetry=new Telemetry();state=new Status{Running=true};Log("start","version=0.3.0-preview observe_only="+o.ObserveOnly+" background="+o.BackgroundMode+" console="+consolePort+" auto_needs="+o.AutoNeeds);
   telemetryWorker=Task.Run(()=>TelemetryLoop(token));worker=Task.Run(()=>Loop(token));
  }
  async Task TelemetryLoop(CancellationToken token) {
   CdpBridge.FishingTelemetryReader reader=null;
   try{while(!token.IsCancellationRequested){Telemetry value;try{if(reader==null)reader=new CdpBridge.FishingTelemetryReader();value=await reader.Read().ConfigureAwait(false);}catch(Exception e){value=new Telemetry{Error="NUI読み取り再接続: "+e.GetType().Name};if(reader!=null)reader.Dispose();reader=null;}value.At=Now;if(token.IsCancellationRequested)return;lock(gate)telemetry=value;await Task.Delay(350,token).ConfigureAwait(false);}}
   catch(OperationCanceledException){}finally{if(reader!=null)reader.Dispose();}
  }
  void Loop(CancellationToken token) {
   Native.timeBeginPeriod(1);
   try {
    var reader=new RingReader(templates);
    while(!token.IsCancellationRequested) {
     double now=Now;uint pid;Native.GetWindowThreadProcessId(target,out pid);
     if(!Native.IsWindow(target)||pid!=targetPid){Fail("FiveM終了を確認しました");break;}
     Telemetry t;lock(gate)t=telemetry;
     if(t.Error=="接続が変わりました"||(t.Epoch!=""&&epoch!=""&&t.Epoch!=epoch)){Fail("サーバー再接続・再起動を検出。再開にはF8が必要です");break;}
     if(t.Known&&epoch=="")epoch=t.Epoch;
     bool foreground=Native.GetForegroundWindow()==target;
     if(!foreground&&!options.BackgroundMode){phase="focus";reason="バックグラウンド動作がOFFです";Emit(t,new Scene(),now,foreground);token.WaitHandle.WaitOne(100);continue;}
     Scene scene=new Scene();bool sceneKnown=false;double captureAt=Now;
     if(epoch!=""&&now>=sceneRetry)try {
      if(sceneLink==null){sceneLink=new CdpBridge.FishingConnection(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"SceneProbe.js")),token);sceneLink.Initialize(epoch).GetAwaiter().GetResult();Log("nui_connected","contexts_discovered=1");}
      bool permit=options.BackgroundMode&&!options.ObserveOnly&&castIssued&&t.Known&&Now-t.At<2200&&pendingNeed==""&&!token.IsCancellationRequested;
      scene=sceneLink.Poll(permit,castCycle).GetAwaiter().GetResult();sceneKnown=true;
      if(token.IsCancellationRequested)break;
     }catch(Exception e){if(token.IsCancellationRequested)break;if(e.Message.Contains("SERVER_SESSION_CHANGED")){Fail("NUI接続の変更を検出しました");break;}Log("nui_retry",e.GetType().Name+" "+e.Message);if(sceneLink!=null)sceneLink.Dispose();sceneLink=null;sceneRetry=Now+800;}
     Rectangle c=Native.Client(target);Ring r=scene.Ring;
     if(!r.Valid&&!scene.Source.Contains("ambiguous")) {
      if(options.BackgroundMode&&sceneKnown&&sceneLink!=null&&scene.Present)try{using(var b=sceneLink.Capture(scene,false).GetAwaiter().GetResult()){r=reader.ReadAuto(b);scene.Source="NUI capture";}if(r.Valid&&scene.Key>=0&&r.Key!=scene.Key)r.Valid=false;}catch(Exception e){LogThrottled("capture_unavailable",e.GetType().Name);}
      else if(!options.BackgroundMode&&foreground&&c.Width>=300&&c.Height>=240){int side=(int)Math.Min(c.Width,c.Height*.4);using(var b=Native.Capture(new Rectangle(c.X+c.Width/2-side/2,c.Y+c.Height/2-side/2,side,side),320,320))r=reader.ReadAuto(b);scene.Source="foreground capture";}
     }
     scene.Cost=Now-captureAt;scene.At=Now;now=Now;
     state.ReadMs=scene.Cost;state.Backend=options.BackgroundMode?(scene.Ring.Valid?"NUI同一処理内の判定・入力":sceneKnown?"NUI画像／対象確認中":"バックグラウンド接続待ち"):"前面画像＋Windows入力";
     state.Delivery=scene.Delivery=="transition_observed"?"入力後の画面遷移を確認":scene.Delivery=="sent_unconfirmed"?"送信済み・次判定を確認中":sceneKnown?"円の認識待ち":"未確認";
     if(scene.SentKey>=0){state.Keys++;round.Round=Math.Max(round.Round,scene.InputRound);round.LastHit=now;round.Latched=true;Log("round_key","backend=nui_same_turn key="+scene.SentKey+" sequence="+scene.InputSequence+" round="+scene.InputRound+" pointer="+scene.InputPointer.ToString("F2")+" target="+scene.InputStart.ToString("F2")+"-"+scene.InputEnd.ToString("F2")+" poll_ms="+scene.Cost.ToString("F1"));}bool present=scene.Present||r.Valid;
     if(present){lastRingAt=now;quietSince=-1;}else if(scene.Busy)quietSince=-1;else if(quietSince<0)quietSince=now;
     bool fresh=t.Known&&now-t.At>=0&&now-t.At<2500;
     state.Ring=r.Valid?String.Format("{0} : 数字{1} 白{2:F0}° 緑{3:F0}〜{4:F0}°",scene.Source,r.Key,r.Pointer,r.Start,r.End):scene.Present?"円を検出／数値確認中":"円なし（"+scene.Source+"）";
     bool terminal=false,fail=false,block=false,castNotice=false,fullNotice=false;
     foreach(var n in scene.Notices){if(!notices.Add(n.Id))continue;noticeQueue.Enqueue(n.Id);if(noticeQueue.Count>512)notices.Remove(noticeQueue.Dequeue());Log("notice","kind="+n.Kind);if(castIssued){outcomes.Mark(n.Kind);terminal|=n.Kind=="CAUGHT"||n.Kind=="FAIL"||n.Kind=="CANCEL";fail|=n.Kind=="FAIL"||n.Kind=="CANCEL";block|=n.Kind=="BLOCK";fullNotice|=n.Kind=="FULL";castNotice|=n.Kind=="CAST"||n.Kind=="BITE";}}
     terminal|=outcomes.Terminal;fail|=outcomes.Failed;block|=outcomes.Blocked;fullNotice|=outcomes.Full;
     if(options.ObserveOnly){if(now>=nextHud){ReadVitals(c,scene,foreground);nextHud=Now+2500;}int key=round.Observe(r,now);if(key>=0){state.Keys++;Log("dry_decision","key="+key+" round="+round.Round);}phase="observe";Emit(t,scene,now,foreground);token.WaitHandle.WaitOne(12);continue;}
     if(present&&!castIssued&&fresh&&pendingNeed==""){before=t.Inventory;outcomes.Clear();castIssued=true;seenRing=true;acknowledged=true;castAt=now;castCycle=sessionId+":"+(++castSerial);round.Reset();Log("adopt_existing_round","no_rod_key_sent=1");}
     if(castIssued&&(castNotice||scene.Busy||present)){if(!acknowledged)Log("cast_ack",present?"ring":"progress_or_notice");acknowledged=true;}
     if(r.Valid&&castIssued){seenRing=true;phase="challenge";reason="追加判定も継続して監視しています";
      if(fresh&&scene.Cost<100&&!(options.BackgroundMode&&r.Native)){int key=round.Observe(r,now,Math.Min(40,scene.Cost));if(key>=0){bool sent=false,uncertain=false;
        if(options.BackgroundMode&&sceneLink!=null&&scene.Present&&scene.Key==key){
         try{sent=sceneLink.Digit(scene,key).GetAwaiter().GetResult();}
         catch(OperationCanceledException){if(token.IsCancellationRequested)throw;uncertain=true;}
         catch(Exception e){uncertain=true;Log("key_delivery_unconfirmed",e.GetType().Name+" latched=1 no_duplicate=1");}
         if(uncertain){sceneLink.Dispose();sceneLink=null;sceneRetry=Now+800;reason="入力結果を再確認中。二重入力せず次の画面変化を待ちます";}
        }
        else if(!options.BackgroundMode&&foreground)sent=Native.Press(target,targetPid,key,token);
        if(sent){state.Keys++;Log("round_key","key="+key+" round="+round.Round+" backend="+(options.BackgroundMode&&scene.Present?"targeted_nui":"foreground")+" observed_ms="+scene.Cost.ToString("F0"));}
        else if(!uncertain){round.InputRejected();LogThrottled("round_not_sent","stale_round_or_no_safe_backend");}
      }}else reason=options.BackgroundMode&&r.Native?"円の描画値と同じ処理内で入力しています":"接続または描画の新鮮さを再確認しています";
     }else if(castIssued){round.Observe(new Ring(),now);
      if(block){Fail("竿・餌を使用できない通知を検出しました");break;}
      bool obtained=seenRing&&fresh&&t.At>round.LastHit&&t.Inventory.IncreasedSince(before);
      if(!present&&!scene.Busy&&now-lastRingAt>180&&(obtained||terminal||fullNotice)){
       if(obtained)state.Results++;
       Log(obtained?"inventory_gain_confirmed":fullNotice?"full_notice":"terminal_notice","failed="+fail+" rounds="+round.Round+" key_to_result_ms="+(now-round.LastHit).ToString("F0"));
       nextCastAt=RecastPolicy.Earliest(now,round.LastHit,options.MinRecastMs);castIssued=false;seenRing=false;acknowledged=false;castRetries=0;before=null;phase="recovery";resultWarned=false;outcomes.Clear();
       Log("recast_recovery","remaining_ms="+(nextCastAt-now).ToString("F0"));
      }else if(seenRing){phase="result";reason="結果通知・所持品の変化・追加判定を確認中";
       if(now-lastRingAt>12000&&!resultWarned){resultWarned=true;Log("result_wait","not_stopped=1 outcome_unknown=1");Notify("釣りの終了結果を再確認しています");}
      }else if(RecastPolicy.MayRetryUnacknowledged(now,castAt,castRetries,acknowledged,present,scene.Busy,fresh)){
       castRetries++;castIssued=false;nextCastAt=now+700;phase="recovery";Log("cast_unacknowledged_retry","retry="+castRetries+" waited_ms="+(now-castAt).ToString("F0")+" no_round=1");
      }else {phase="bite";reason=acknowledged?"投竿後の進行を確認。アタリを待っています":"投竿キー送信済み。開始受付を監視しています";}
     }
     if(!present&&!castIssued) {
      if(now>=nextHud){ReadVitals(c,scene,foreground);nextHud=Now+2000;now=Now;}
      if(!fresh){phase="telemetry";reason=t.Error==""?"新しい所持品データを確認中":t.Error;}
      else if(t.Inventory.Full(options.ReserveGrams)||fullNotice){phase="full";HandleNeeds(now,token,foreground);if(!fullAlert){fullAlert=true;Notify("インベントリがいっぱい、または空きが少なくなったよ");Log("capacity_wait",t.Inventory.Weight+"/"+t.Inventory.Maximum);}}
      else {fullAlert=false;bool needReady=HandleNeeds(now,token,foreground);
       if(needReady&&RecastPolicy.Ready(now,nextCastAt,quietSince,present,scene.Busy,fresh&&now-t.At<2500)&&!token.IsCancellationRequested){
        before=t.Inventory;round.Reset();outcomes.Clear();seenRing=false;acknowledged=false;resultWarned=false;
        if(PressSlot(options.RodKey,token,foreground)){castAt=Now;castCycle=sessionId+":"+(++castSerial);castIssued=true;phase="bite";state.Casts++;Log("cast","key="+options.RodKey+" ack=pending backend="+(options.BackgroundMode&&consolePort!=0?"registered_hotbar":"foreground"));}
        else {phase="input";reason="対象ゲーム用の入力先が未確認です。別アプリには入力していません";nextCastAt=now+2000;LogThrottled("cast_not_sent","console="+consolePort+" foreground="+foreground);}
       }else if(needReady){phase="recovery";reason=scene.Busy?"ゲームの進捗が終わるまで待っています":"終了動作の回復を確認して次の投竿へ進みます";}
      }
     }
     Emit(t,scene,Now,foreground);token.WaitHandle.WaitOne(present?3:20);
    }
   }catch(Exception e){if(!token.IsCancellationRequested){Log("exception",e.GetType().Name+": "+e.Message);Notify("接続・認識エラー。診断ログを確認してください");state.Detail=e.Message;}}
   finally{stop.Cancel();if(sceneLink!=null){sceneLink.Dispose();sceneLink=null;}state.Running=false;state.Phase="停止中";Publish();Log("stop","input_scope_closed=1 no_deferred_keydown=1");Native.timeEndPeriod(1);}
  }
  bool PressSlot(int key,CancellationToken token,bool foreground){
   if(options.BackgroundMode){if(consolePort==0)consolePort=CdpBridge.FishingConnection.ConsolePort();
    if(consolePort!=0)return CdpBridge.FishingConnection.Hotbar(consolePort,key,token);
    LogThrottled("background_hotbar_unavailable","no_unique_fivem_owned_console=1 no_desktop_fallback=1");return false;}
   return foreground&&Native.Press(target,targetPid,key,token);
  }
  void ReadVitals(Rectangle c,Scene scene,bool foreground) {
   hunger=new VitalGauge();water=new VitalGauge();
   if(scene.Hunger>=0)hunger=new VitalGauge{Known=true,Value=scene.Hunger};if(scene.Water>=0)water=new VitalGauge{Known=true,Value=scene.Water};
   if(scene.Hunger<0||scene.Water<0){Bitmap b=null;
    try{if(options.BackgroundMode&&sceneLink!=null)b=sceneLink.Capture(null,true).GetAwaiter().GetResult();else if(foreground&&c.Height>0){double scale=900.0/c.Height;int h=(int)(c.Height*.2),w=Math.Min(c.Width,(int)(c.Height*.5));b=Native.Capture(new Rectangle(c.X,c.Bottom-h,w,h),(int)(w*scale),(int)(h*scale));}
     if(b!=null){double scale=c.Height>0?900.0/c.Height:1;
      if(scene.Hunger<0)hunger=HudReader.Read(b,true,options.FoodX<0?(cachedFood.Known?cachedFood.X:-1):options.FoodX*c.Width*scale,options.FoodY<0?(cachedFood.Known?cachedFood.Y:-1):options.FoodY*900-720,options.FoodX<0&&cachedFood.Known?cachedFood.Radius:options.GaugeRadius*scale);
      if(scene.Water<0)water=HudReader.Read(b,false,options.WaterX<0?(cachedWater.Known?cachedWater.X:-1):options.WaterX*c.Width*scale,options.WaterY<0?(cachedWater.Known?cachedWater.Y:-1):options.WaterY*900-720,options.WaterX<0&&cachedWater.Known?cachedWater.Radius:options.GaugeRadius*scale);
     }}catch(Exception e){LogThrottled("vitals_capture_retry",e.GetType().Name);}finally{if(b!=null)b.Dispose();}}
   double now=Now;
   if(options.FoodX<0&&hunger.Known&&hunger.Radius>0)cachedFood=hunger;if(options.WaterX<0&&water.Known&&water.Radius>0)cachedWater=water;
   if(hunger.Known){hungerObservedAt=now;hungerVotes=hunger.Value<=50?hungerVotes+1:0;}else hungerVotes=0;
   if(water.Known){waterObservedAt=now;waterVotes=water.Value<=50?waterVotes+1:0;}else waterVotes=0;
   Log("vitals",String.Format("hunger={0} water={1}",hunger.Known?hunger.Value.ToString("F0"):"unknown",water.Known?water.Value.ToString("F0"):"unknown"));
  }
  bool HandleNeeds(double now,CancellationToken token,bool foreground) {
   if(!options.AutoNeeds)return true;
   if(pendingNeed!=""){var g=pendingNeed=="food"?hunger:water;if(g.Known&&g.Value>=needBefore+3){Log("supply_confirmed",pendingNeed);pendingNeed="";nextCastAt=Math.Max(nextCastAt,now+500);return true;}phase="supply";reason="補給の回復を確認しています";if(now-foodActionAt>16000){reason="補給未確認。食料・飲料スロットの確認が必要です";LogThrottled("supply_wait","recovery_not_confirmed");}return false;}
   if(!hunger.Known||!water.Known||now-hungerObservedAt>10000||now-waterObservedAt>10000){phase="vitals";reason="空腹・水分を再検出しています（不明を満タンとは扱いません）";return false;}
   string kind=hungerVotes>=2?"food":waterVotes>=2?"water":"";
   if(kind==""&&(hunger.Value<=50||water.Value<=50)){phase="vitals";nextHud=Math.Min(nextHud,now+180);return false;}if(kind=="")return true;
   if(now-foodActionAt<15000){phase="supply";return false;}
   int key=kind=="food"?options.FoodKey:options.DrinkKey;if(key==options.RodKey){Fail("食料・飲料と竿のキーが同じです");return false;}
   needBefore=kind=="food"?hunger.Value:water.Value;if(!PressSlot(key,token,foreground)){phase="input";reason="補給用のゲーム入力先を確認中";return false;}
   pendingNeed=kind;foodActionAt=now;phase="supply";Log("supply_key",kind+" key="+key+" before="+needBefore.ToString("F0"));return false;
  }
  void Emit(Telemetry t,Scene s,double now,bool foreground){
   if(phase!=lastPhase){Log("phase","from="+lastPhase+" to="+phase+" reason="+reason);lastPhase=phase;}
   if(now-heartbeat>=2000){Log("state","phase="+phase+" pending="+castIssued+" ack="+acknowledged+" seen_ring="+seenRing+" ring="+s.Present+" foreground="+foreground+" background="+options.BackgroundMode+" telemetry_age_ms="+(now-t.At).ToString("F0")+" source="+s.Source+" frame_ms="+s.Cost.ToString("F0")+" viewport="+s.Width+"x"+s.Height);heartbeat=now;}
   if(now-lastUi<180)return;lastUi=now;state.Phase=Label(phase);state.Detail=reason;state.Inventory=t.Known?String.Format("{0:F1} / {1:F1} kg",t.Inventory.Weight/1000.0,t.Inventory.Maximum/1000.0):"未確認";state.Hunger=hunger.Known?hunger.Value.ToString("F0")+"%":"未確認";state.Thirst=water.Known?water.Value.ToString("F0")+"%":"未確認";Publish();
  }
  string Label(string p){switch(p){case "bite":return "アタリ待ち／投竿の受付監視";case "challenge":return "数字・タイミング判定";case "result":return "追加判定／結果確認";case "recovery":return "次の投竿の受付を準備";case "full":return "空き容量待ち";case "supply":return "50%以下のゲージを補給・確認";case "vitals":return "空腹・水分ゲージの確認待ち";case "telemetry":return "対応NUIの確認待ち";case "observe":return "観察テスト（入力なし）";case "focus":return "前面表示待ち";case "input":return "対象ゲームの入力先を確認中";default:return "次の釣りを準備";}}
  void Publish(){var e=Changed;if(e!=null)e(new Status{Running=state.Running,Phase=state.Phase,Detail=state.Detail,Inventory=state.Inventory,Hunger=state.Hunger,Thirst=state.Thirst,Ring=state.Ring,Casts=state.Casts,Keys=state.Keys,Results=state.Results,Backend=state.Backend,Delivery=state.Delivery,ReadMs=state.ReadMs});}
  void Notify(string text){var e=Alert;if(e!=null)e(text);}void Fail(string text){state.Detail=text;Log("blocked",text);Notify(text);stop.Cancel();}
  public void Stop(){if(stop!=null){Log("stop_requested","user=1");stop.Cancel();}}
  double lastLimited;
  void LogThrottled(string kind,string detail){if(Now-lastLimited<2000)return;lastLimited=Now;Log(kind,detail);}
  public void Log(string kind,string detail){lock(logGate){try{string p=Path.Combine(root,"events.jsonl");if(File.Exists(p)&&new FileInfo(p).Length>4*1024*1024){string old=p+".1";if(File.Exists(old))File.Delete(old);File.Move(p,old);}File.AppendAllText(p,new JavaScriptSerializer().Serialize(new{utc=DateTime.UtcNow.ToString("o"),ms=Now,version="0.3.0-preview",session=sessionId,type=kind,detail=detail})+Environment.NewLine);}catch{}}}
  public void Dispose(){if(disposed)return;disposed=true;Stop();if(worker!=null)try{worker.Wait(2000);}catch{}}
 }
}
