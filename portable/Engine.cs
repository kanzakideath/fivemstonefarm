using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
namespace FishingPilot {
 public sealed class Telemetry {public bool Known,InventoryOpen;public string Epoch="",Notice="NONE",Error="";public Inventory Inventory=new Inventory();public double At;public Inventory Trunk=new Inventory();public string TrunkId="",TrunkLabel="",InventorySource="";public bool TrunkOpen;public long Revision;}
 public sealed class Options {public int RodKey=2,FoodKey=1,DrinkKey=3;public bool AutoNeeds=true,ObserveOnly=false,BackgroundMode=true;public bool AutoStorage=false,HighAccuracy=true,IncludeExistingCatch=false,ShowOverlay=true;public int ReserveGrams=500,MinRecastMs=1400;public bool AutoNudge=false;public int NudgeHoldMs=300;public OverlayOptions Overlay=new OverlayOptions();public double FoodX=-1,FoodY=-1,WaterX=-1,WaterY=-1,GaugeRadius=20;}
 public sealed class Status {public LivePanel Live=new LivePanel();public string Movement="OFF";public int Recoveries;public string Phase="停止中",Detail="",Inventory="未確認",Hunger="未確認",Thirst="未確認",Ring="未検出";public string Storage="未登録／OFF",Recognition="未確認"; public int StorageCycles,StoredItems; public string Backend="未確認",Delivery="未確認"; public double ReadMs; public int Casts,Keys,Results;public bool Running,InventoryFresh;public ItemDisplay[] HeldItems=new ItemDisplay[0],CaughtItems=new ItemDisplay[0];}
 public sealed class Engine : IDisposable {
  public event Action<Status> Changed;public event Action<string> Alert;
  readonly string root,templates;readonly object gate=new object(),logGate=new object();
  CancellationTokenSource stop;Task worker,telemetryWorker;readonly Stopwatch clock=Stopwatch.StartNew();
  Telemetry telemetry=new Telemetry();Status state=new Status();IntPtr target;uint targetPid;Options options;
  CatchStatistics statistics;double statsAt;readonly object statsGate=new object();ValueSession valueSession;LivePanel live=new LivePanel();CdpBridge.FishingTelemetryReader idleReader;SceneObserver observer;readonly NudgeSchedule nudge=new NudgeSchedule();double quietRecoveryCooldown;bool inventoryTouchedDuringCast; public IntPtr TargetWindow{get{return target;}}
  string epoch="",phase="ready",reason="",pendingNeed="",lastPhase="";double castAt,lastRingAt=-10000,nextCastAt,nextHud,foodActionAt=-10000,quietSince=-1,heartbeat,lastUi,sceneRetry;
  OutcomeLatch outcomes=new OutcomeLatch();
  Inventory before;RoundController round=new RoundController();bool castIssued,seenRing,fullAlert,acknowledged,resultWarned;
  int castRetries,consolePort,castSerial; string castCycle="";CdpBridge.FishingConnection sceneLink;
  HashSet<string> notices=new HashSet<string>();Queue<string> noticeQueue=new Queue<string>();
  VitalGauge hunger=new VitalGauge(),water=new VitalGauge(),cachedFood=new VitalGauge(),cachedWater=new VitalGauge();int hungerVotes,waterVotes;double hungerObservedAt,waterObservedAt,needBefore;
  bool disposed;string sessionId="";StorageRegistration storageRegistration;CatchLedger catchLedger;double nextStorageAt;bool reconcileStorage,storageResumePending;
  public Engine(string directory,string templateFile){root=directory;templates=templateFile;Directory.CreateDirectory(root);}
  double Now{get{return clock.Elapsed.TotalMilliseconds;}}
  bool idleBusy;
  public async Task RefreshIdleInventory(){if(Busy||idleBusy||disposed)return;idleBusy=true;string marker=sessionId;
   try{if(idleReader==null)idleReader=new CdpBridge.FishingTelemetryReader();var t=await idleReader.Read().ConfigureAwait(false);if(Busy||disposed||sessionId!=marker)return;t.At=Now;if(target==IntPtr.Zero||!Native.IsWindow(target))target=Native.FindFishingWindow();ApplyInventory(t);Publish();}
   catch{if(idleReader!=null)idleReader.Dispose();idleReader=null;if(!Busy){ApplyInventory(new Telemetry());Publish();}}finally{idleBusy=false;}
  }
  void ApplyInventory(Telemetry t){lock(statsGate){if(statistics==null)statistics=new CatchStatistics(root);if(valueSession==null)valueSession=new ValueSession(new PriceCatalog(root),statistics.Caught);statistics.Observe(t.Known?t.Inventory:null,t.At);live=valueSession.Update(t,statistics,live);}}
  public void ReloadPrices(){if(Busy)throw new InvalidOperationException("停止してから単価を変更してください");lock(statsGate){if(valueSession!=null)valueSession.Reload(new PriceCatalog(root));}}
  public void ConfigureLive(Options o){if(options!=null){options.AutoNudge=o.AutoNudge;options.NudgeHoldMs=o.NudgeHoldMs;}}
  public bool Busy {get{return (worker!=null&&!worker.IsCompleted)||(telemetryWorker!=null&&!telemetryWorker.IsCompleted);}}
  public bool Running{get{return stop!=null&&!stop.IsCancellationRequested&&worker!=null&&!worker.IsCompleted;}}
  public void Start(Options o) {
   if(Running)return;if(worker!=null&&!worker.IsCompleted||telemetryWorker!=null&&!telemetryWorker.IsCompleted)throw new InvalidOperationException("停止処理中です。数秒後に再開してください");
   target=Native.FishingWindow();if(target==IntPtr.Zero&&o.BackgroundMode)target=Native.FindFishingWindow();if(target==IntPtr.Zero)throw new InvalidOperationException("FiveMを起動し、最初はゲーム上でF5を押してください");Native.GetWindowThreadProcessId(target,out targetPid);
   options=o;lock(statsGate){statistics=new CatchStatistics(root);valueSession=new ValueSession(new PriceCatalog(root),statistics.Caught);live=new LivePanel();}statsAt=-1;nudge.Reset(Now);inventoryTouchedDuringCast=false;quietRecoveryCooldown=0;
   storageRegistration=null;catchLedger=null;nextStorageAt=0;storageResumePending=false;
   reconcileStorage=new StorageJournal(root).Pending()!=null;
   if(reconcileStorage&&!o.AutoStorage)throw new InvalidOperationException("未確定の収納があります。自動収納ONで登録荷台を開き、再確認してください");
   if(o.AutoStorage){string path=Path.Combine(root,"storage-registration.json");if(!File.Exists(path))throw new InvalidOperationException("先に荷台と収納対象を登録してください");storageRegistration=new JavaScriptSerializer().Deserialize<StorageRegistration>(File.ReadAllText(path));storageRegistration.Validate();if(storageRegistration.Items.Length==0)throw new InvalidOperationException("収納対象の釣果を選択してください");}
   stop=new CancellationTokenSource();var token=stop.Token;sessionId=Guid.NewGuid().ToString("N").Substring(0,12);round.Reset();outcomes.Clear();epoch="";phase="ready";reason="";lastPhase="";castIssued=seenRing=fullAlert=acknowledged=resultWarned=false;before=null;pendingNeed="";nextHud=0;foodActionAt=-10000;nextCastAt=Now;lastRingAt=-10000;quietSince=-1;hungerVotes=waterVotes=0;castRetries=0;heartbeat=lastUi=sceneRetry=0;
   hunger=new VitalGauge();water=new VitalGauge();cachedFood=new VitalGauge();cachedWater=new VitalGauge();notices.Clear();noticeQueue.Clear();
   consolePort=o.BackgroundMode?CdpBridge.FishingConnection.ConsolePort():0;
   telemetry=new Telemetry();state=new Status{Running=true};Log("start","version=0.6.0-preview observe_only="+o.ObserveOnly+" background="+o.BackgroundMode+" console="+consolePort+" auto_needs="+o.AutoNeeds);
   observer=new SceneObserver(()=>epoch,()=>Native.GetForegroundWindow()==target,()=>Now,token);telemetryWorker=Task.Run(()=>TelemetryLoop(token));worker=Task.Run(()=>Loop(token));
  }
  async Task TelemetryLoop(CancellationToken token) {
   CdpBridge.FishingTelemetryReader reader=null;
   try{while(!token.IsCancellationRequested){Telemetry value;try{if(reader==null)reader=new CdpBridge.FishingTelemetryReader();value=await reader.Read().ConfigureAwait(false);}catch(Exception e){value=new Telemetry{Error="NUI読み取り再接続: "+e.GetType().Name};if(reader!=null)reader.Dispose();reader=null;}value.At=Now;if(token.IsCancellationRequested)return;lock(gate)telemetry=value;ApplyInventory(value);Publish();await Task.Delay(value.Known?120:400,token).ConfigureAwait(false);}}
   catch(OperationCanceledException){}finally{if(reader!=null)reader.Dispose();}
  }
  void Loop(CancellationToken token) {
   Native.timeBeginPeriod(1);
   try {
    var reader=new RingReader(templates);var precise=new AdaptiveRingReader(templates);var pixelGate=new PixelEvidenceGate();
    while(!token.IsCancellationRequested) {
     double now=Now;uint pid;Native.GetWindowThreadProcessId(target,out pid);
     if(!Native.IsWindow(target)||pid!=targetPid){Fail("FiveM終了を確認しました");break;}
     Telemetry t;lock(gate)t=telemetry;
     if(t.Error=="接続が変わりました"||(t.Epoch!=""&&epoch!=""&&t.Epoch!=epoch)){Fail("サーバー再接続・再起動を検出。再開にはF5が必要です");break;}
     if(t.Known&&epoch=="")epoch=t.Epoch;
     bool foreground=Native.GetForegroundWindow()==target;string route=InputPolicy.Route(foreground,options.BackgroundMode);
     if(route=="paused"){phase="focus";reason="バックグラウンド動作がOFFです";Emit(t,new Scene(),now,foreground);token.WaitHandle.WaitOne(100);continue;}
     Scene scene=new Scene();bool sceneKnown=false;double captureAt=Now;
     Rectangle c=Native.Client(target);Ring r=new Ring();
     if(foreground){string observerError;scene=observer.Snapshot(out sceneKnown,out observerError);if(observerError.Contains("SERVER_SESSION_CHANGED")){Fail("NUI接続の変更を検出しました");break;}
      if(scene.Ring.Valid){r=scene.Ring;captureAt=Math.Max(0,scene.At-scene.Cost);scene.Source="foreground live SVG";}
      else if(c.Width>=300&&c.Height>=240){int side=(int)InputPolicy.CaptureSide(c.Width,c.Height);captureAt=Now;
       try{using(var image=Native.Capture(new Rectangle(c.X+(c.Width-side)/2,c.Y+(c.Height-side)/2,side,side),320,320))r=reader.ReadFast(image);scene.Source="foreground radius tracking";}
       catch(Exception e){LogThrottled("foreground_capture_retry",e.GetType().Name);}
      }
     }
     if(!foreground&&!r.Valid&&epoch!=""&&now>=sceneRetry)try {
      if(sceneLink==null){sceneLink=new CdpBridge.FishingConnection(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"SceneProbe.js")),token);sceneLink.Initialize(epoch).GetAwaiter().GetResult();Log("nui_connected","frame_discovery_initialized=1");}
      bool permit=!foreground&&options.BackgroundMode&&!options.ObserveOnly&&castIssued&&t.Known&&!t.InventoryOpen&&Now-t.At<2200&&pendingNeed==""&&!token.IsCancellationRequested;
      captureAt=Now;scene=sceneLink.Poll(permit,castCycle).GetAwaiter().GetResult();sceneKnown=true;r=scene.Ring;
      if(token.IsCancellationRequested)break;
     }catch(Exception e){if(token.IsCancellationRequested)break;if(e.Message.Contains("SERVER_SESSION_CHANGED")){Fail("NUI接続の変更を検出しました");break;}LogThrottled("nui_retry",e.GetType().Name+" "+e.Message);if(sceneLink!=null)sceneLink.Dispose();sceneLink=null;sceneRetry=Now+800;}
     if(!foreground&&!r.Valid&&!scene.Source.Contains("ambiguous")){
      // No DOM candidate prerequisite: Canvas and CSS circles must reach raster recognition.
      if(sceneLink!=null)try{captureAt=Now;using(var image=sceneLink.Capture(scene,false).GetAwaiter().GetResult()){r=options.HighAccuracy?precise.ReadAuto(image):reader.ReadAuto(image);}scene.Source="NUI raster";if(r.Valid&&scene.Key>=0&&r.Key!=scene.Key)r.Valid=false;}
       catch(Exception e){LogThrottled("capture_unavailable",e.GetType().Name);}

     }
     scene.Present|=r.Valid;
     scene.Cost=Now-captureAt;scene.At=Now;now=Now;
     state.ReadMs=scene.Cost;state.Backend=!foreground&&options.BackgroundMode?(scene.Ring.Valid?"NUI同一処理内の判定・入力":sceneKnown?"NUI画像／対象確認中":"バックグラウンド接続待ち"):"前面画像＋Windows入力";
     state.Delivery=scene.Delivery=="transition_observed"?"入力後の画面遷移を確認":scene.Delivery=="sent_unconfirmed"?"送信済み・次判定を確認中":sceneKnown?"円の認識待ち":"未確認";
     if(scene.SentKey>=0){state.Keys++;round.Round=Math.Max(round.Round,scene.InputRound);round.LastHit=now;round.Latched=true;Log("round_key","backend=nui_same_turn key="+scene.SentKey+" sequence="+scene.InputSequence+" round="+scene.InputRound+" pointer="+scene.InputPointer.ToString("F2")+" target="+scene.InputStart.ToString("F2")+"-"+scene.InputEnd.ToString("F2")+" poll_ms="+scene.Cost.ToString("F1"));}bool present=scene.Present||r.Valid;
     if(present){lastRingAt=now;quietSince=-1;}else if(scene.Busy)quietSince=-1;else if(quietSince<0)quietSince=now;
     bool fresh=t.Known&&now-t.At>=0&&now-t.At<2500;bool movementDue=nudge.Due(options.AutoNudge,now);state.Movement=options.AutoNudge?(movementDue?"前進待ち：釣り終了後に実行":"次の前進まで "+nudge.Remaining(now)+"秒"):"OFF";
     if(statsAt!=t.At){ApplyInventory(t);statsAt=t.At;}
     state.InventoryFresh=fresh;state.HeldItems=live.Held;state.CaughtItems=live.Caught;
     if(fresh&&catchLedger==null)catchLedger=new CatchLedger(t.Inventory,options.IncludeExistingCatch&&storageRegistration!=null?storageRegistration.Items:null);
     if(options.AutoStorage&&fresh&&storageRegistration.Epoch!=t.Epoch){Fail("サーバー接続が変わりました。荷台を登録し直してください");break;}
     state.Recognition=r.Native?"SVG描画値＋数字＋連続観測":options.HighAccuracy?precise.Evidence:"画像テンプレート";
     state.Storage=options.AutoStorage?"登録荷台・選択した釣果のみ収納":"自動収納OFF";
     state.Ring=r.Valid?String.Format("{0} : 数字{1} 白{2:F0}° 緑{3:F0}〜{4:F0}°",scene.Source,r.Key,r.Pointer,r.Start,r.End):scene.Present?"円を検出／数値確認中":"円なし（"+scene.Source+"）";
     if(castIssued&&t.InventoryOpen)inventoryTouchedDuringCast=true;
     bool terminal=false,fail=false,block=false,castNotice=false,fullNotice=false;
     foreach(var n in scene.Notices){if(!notices.Add(n.Id))continue;noticeQueue.Enqueue(n.Id);if(noticeQueue.Count>512)notices.Remove(noticeQueue.Dequeue());Log("notice","kind="+n.Kind);if(castIssued){outcomes.Mark(n.Kind);terminal|=n.Kind=="CAUGHT"||n.Kind=="FAIL"||n.Kind=="CANCEL";fail|=n.Kind=="FAIL"||n.Kind=="CANCEL";block|=n.Kind=="BLOCK";fullNotice|=n.Kind=="FULL";castNotice|=n.Kind=="CAST"||n.Kind=="BITE";}}
     terminal|=outcomes.Terminal;fail|=outcomes.Failed;block|=outcomes.Blocked;fullNotice|=outcomes.Full;
     if(options.ObserveOnly){if(now>=nextHud){ReadVitals(c,scene,foreground);nextHud=Now+2500;}int key=round.Observe(r,now);if(key>=0){state.Keys++;Log("dry_decision","key="+key+" round="+round.Round);}phase="observe";Emit(t,scene,now,foreground);token.WaitHandle.WaitOne(12);continue;}
     if(present&&!castIssued&&fresh&&pendingNeed==""){before=t.Inventory;inventoryTouchedDuringCast=t.InventoryOpen;outcomes.Clear();castIssued=true;seenRing=true;acknowledged=true;castAt=now;castCycle=sessionId+":"+(++castSerial);round.Reset();Log("adopt_existing_round","no_rod_key_sent=1");}
     if(castIssued&&(castNotice||scene.Busy||present)){if(!acknowledged)Log("cast_ack",present?"ring":"progress_or_notice");acknowledged=true;if(storageResumePending){storageResumePending=false;Log("storage_fishing_resumed","progress_or_round_observed=1");}}
     if(r.Valid&&castIssued){seenRing=true;phase="challenge";reason="円と数字を追跡しています";
      bool nativeHandled=!foreground&&options.BackgroundMode&&r.Native;
      if(fresh&&!t.InventoryOpen&&scene.Cost<180&&!nativeHandled){
       bool evidence=r.Native||!options.HighAccuracy||pixelGate.Accept(r,now);
       int key=round.Observe(r,now,Math.Min(45,scene.Cost));
       if(key>=0){bool sent=false,uncertain=false;
        if(!evidence){round.InputRejected();reason="連続した画像の一致を確認しています";}
        else {
         try {if(foreground)sent=Native.Press(target,targetPid,key,token);
          else if(options.BackgroundMode&&sceneLink!=null)sent=sceneLink.PixelDigit(scene,key).GetAwaiter().GetResult();}
         catch(OperationCanceledException){if(token.IsCancellationRequested)throw;uncertain=true;}
         catch(Exception e){uncertain=true;Log("key_delivery_unconfirmed",e.GetType().Name+" no_duplicate=1");}
         if(sent){state.Keys++;state.Delivery="キー送信済み・次の状態を確認中";Log("round_key","key="+key+" round="+round.Round+" backend="+(foreground?"foreground":"focused_nui")+" observed_ms="+scene.Cost.ToString("F0"));}
         else if(!uncertain){round.InputRejected();reason="円は検出。入力を受けるゲームUIを確認できません";LogThrottled("round_not_sent","ring_detected=1 safe_target_unavailable=1 foreground="+foreground);}
        }
       }
      }else reason=nativeHandled?"NUIの描画確認と同じ処理内で入力します":t.InventoryOpen?"インベントリが開いているため判定キーを保留":"所持品の新鮮さ／読み取り時間を再確認しています";
     }else if(castIssued){round.Observe(new Ring(),now);
      if(block){Fail("竿・餌を使用できない通知を検出しました");break;}
      bool obtained=seenRing&&fresh&&!t.InventoryOpen&&!inventoryTouchedDuringCast&&t.At>round.LastHit&&t.Inventory.IncreasedSince(before);
      if(!present&&!scene.Busy&&now-lastRingAt>180&&(obtained||fail||fullNotice||(terminal&&now-lastRingAt>=1800))){
       if(obtained){state.Results++;lock(statsGate){statistics.Credit(before,t.Inventory);live=valueSession.Update(t,statistics,live);}state.HeldItems=live.Held;state.CaughtItems=live.Caught;if(storageRegistration!=null)catchLedger.Credit(before,t.Inventory,storageRegistration.Items);}
       Log(obtained?"inventory_gain_confirmed":fullNotice?"full_notice":"terminal_notice","failed="+fail+" rounds="+round.Round+" key_to_result_ms="+(now-round.LastHit).ToString("F0"));
       nextCastAt=RecastPolicy.Earliest(now,round.LastHit,options.MinRecastMs);castIssued=false;seenRing=false;acknowledged=false;castRetries=0;before=null;phase="recovery";resultWarned=false;outcomes.Clear();
       Log("recast_recovery","remaining_ms="+(nextCastAt-now).ToString("F0"));
      }else if(now>=quietRecoveryCooldown&&Recovery060.QuietTimeout(now,castAt,quietSince,seenRing,sceneKnown,fresh,t.InventoryOpen,present,scene.Busy)){
       // This is a retry, never a claimed catch. Quiet guards preserve additional rounds.
       Log("quiet_result_recovery","seen_ring="+seenRing+" quiet_ms="+(now-quietSince).ToString("F0")+" catch_credit=0");state.Recoveries++;
       castIssued=false;seenRing=false;acknowledged=false;castRetries=0;before=null;outcomes.Clear();round.Reset();phase="recovery";reason="判定終了後の無進行を検出。次の釣りへ再投入します";
       nextCastAt=now+1000;quietRecoveryCooldown=now+10000;
      }else if(seenRing){phase="result";reason="結果通知・所持品の変化・追加判定を確認中";
       if(now-lastRingAt>12000&&!resultWarned){resultWarned=true;Log("result_wait","not_stopped=1 outcome_unknown=1");Notify("釣りの終了結果を再確認しています");}
      }else if(RecastPolicy.MayRetryUnacknowledged(now,castAt,castRetries,acknowledged,present,scene.Busy,fresh)){
       castRetries++;castIssued=false;nextCastAt=now+700;phase="recovery";Log("cast_unacknowledged_retry","retry="+castRetries+" waited_ms="+(now-castAt).ToString("F0")+" no_round=1");
      }else {phase="bite";reason=acknowledged?"投竿後の進行を確認。アタリを待っています":"投竿キー送信済み。開始受付を監視しています";}
     }
     if(!present&&!castIssued&&fresh&&t.InventoryOpen&&!reconcileStorage){phase="inventory";reason="所持品画面を閉じるまで入力を保留します";Emit(t,scene,Now,foreground);token.WaitHandle.WaitOne(60);continue;}
     if(!present&&!castIssued) {
      if(now>=nextHud){ReadVitals(c,scene,foreground);nextHud=Now+2000;now=Now;}
      if(!fresh){phase="telemetry";reason=t.Error==""?"新しい所持品データを確認中":t.Error;}
      else if(t.Inventory.Full(options.ReserveGrams)||fullNotice||reconcileStorage){
       phase="full";bool needsReady=reconcileStorage||HandleNeeds(now,token,foreground);
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
      }
      else {fullAlert=false;bool needReady=HandleNeeds(now,token,foreground);
       if(needReady&&sceneKnown&&RecastPolicy.Ready(now,nextCastAt,quietSince,present,scene.Busy,fresh&&now-t.At<2500)&&!token.IsCancellationRequested){
        if(nudge.Due(options.AutoNudge,now)){bool moved=false;
         // No key-down is scheduled in the future: F6/toggle-off can interrupt the hold.
         phase="movement";state.Phase="短時間の前進";Publish();
         if(foreground)moved=Native.HoldForward(target,targetPid,options.NudgeHoldMs,token,()=>options.AutoNudge);
         else if(options.BackgroundMode)moved=CdpBridge.FishingConnection.Forward(CdpBridge.FishingConnection.ConsolePort(),options.NudgeHoldMs,token,()=>options.AutoNudge);
         nudge.Attempted(Now);state.Movement=moved?"前進入力済み（位置は未確認）":"前進未送信／次回まで保留";Log("forward_pulse","sent="+moved+" hold_ms="+options.NudgeHoldMs+" physical_movement_verified=0");nextCastAt=Now+700;Emit(t,scene,Now,foreground);continue;
        }
        before=t.Inventory;inventoryTouchedDuringCast=false;round.Reset();outcomes.Clear();seenRing=false;acknowledged=false;resultWarned=false;
        if(PressSlot(options.RodKey,token,foreground)){castAt=Now;castCycle=sessionId+":"+(++castSerial);castIssued=true;phase="bite";state.Casts++;Log("cast","key="+options.RodKey+" ack=pending backend="+(!foreground&&options.BackgroundMode&&consolePort!=0?"registered_hotbar":"foreground"));}
        else {phase="input";reason="対象ゲーム用の入力先が未確認です。別アプリには入力していません";nextCastAt=now+2000;LogThrottled("cast_not_sent","console="+consolePort+" foreground="+foreground);}
       }else if(needReady){phase="recovery";reason=scene.Busy?"ゲームの進捗が終わるまで待っています":"終了動作の回復を確認して次の投竿へ進みます";}
      }
     }
     Emit(t,scene,Now,foreground);token.WaitHandle.WaitOne(present?3:20);
    }
   }catch(Exception e){if(!token.IsCancellationRequested){Log("exception",e.GetType().Name+": "+e.Message);Notify("接続・認識エラー。診断ログを確認してください");state.Detail=e.Message;}}
   finally{stop.Cancel();if(observer!=null){observer.Dispose();observer=null;}if(sceneLink!=null){sceneLink.Dispose();sceneLink=null;}state.Running=false;state.Phase="停止中";Publish();Log("stop","input_scope_closed=1 no_deferred_keydown=1");Native.timeEndPeriod(1);}
  }
  bool PressSlot(int key,CancellationToken token,bool foreground){
   if(foreground)return Native.Press(target,targetPid,key,token);
   if(options.BackgroundMode){if(consolePort==0)consolePort=CdpBridge.FishingConnection.ConsolePort();
    if(consolePort!=0)return CdpBridge.FishingConnection.Hotbar(consolePort,key,token);
    LogThrottled("background_hotbar_unavailable","no_unique_fivem_owned_console=1 no_desktop_fallback=1");return false;}
   return foreground&&Native.Press(target,targetPid,key,token);
  }
  void ReadVitals(Rectangle c,Scene scene,bool foreground) {
   hunger=new VitalGauge();water=new VitalGauge();
   if(scene.Hunger>=0)hunger=new VitalGauge{Known=true,Value=scene.Hunger};if(scene.Water>=0)water=new VitalGauge{Known=true,Value=scene.Water};
   if(scene.Hunger<0||scene.Water<0){Bitmap b=null;
    try{if(!foreground&&options.BackgroundMode&&sceneLink!=null)b=sceneLink.Capture(null,true).GetAwaiter().GetResult();else if(foreground&&c.Height>0){double scale=900.0/c.Height;int h=(int)(c.Height*.2),w=Math.Min(c.Width,(int)(c.Height*.5));b=Native.Capture(new Rectangle(c.X,c.Bottom-h,w,h),(int)(w*scale),(int)(h*scale));}
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
   if(now-heartbeat>=2000){Log("state","phase="+phase+" pending="+castIssued+" ack="+acknowledged+" seen_ring="+seenRing+" ring="+s.Present+" foreground="+foreground+" background="+options.BackgroundMode+" telemetry_age_ms="+(now-t.At).ToString("F0")+" source="+s.Source+" frame_ms="+s.Cost.ToString("F0")+" viewport="+s.Width+"x"+s.Height+" discovery="+s.Discovery+" input_reason="+s.InputReason);heartbeat=now;}
   if(now-lastUi<180)return;lastUi=now;state.Phase=Label(phase);state.Detail=reason;state.Inventory=live.Weight;state.Hunger=hunger.Known?hunger.Value.ToString("F0")+"%":"未確認";state.Thirst=water.Known?water.Value.ToString("F0")+"%":"未確認";Publish();
  }
  string Label(string p){switch(p){case "bite":return "アタリ待ち／投竿の受付監視";case "challenge":return "数字・タイミング判定";case "result":return "追加判定／結果確認";case "recovery":return "次の投竿の受付を準備";case "full":return "空き容量／登録荷台待ち";case "storage":return "収納と釣り再開の確認";case "inventory":return "所持品画面の閉鎖待ち";case "supply":return "50%以下のゲージを補給・確認";case "vitals":return "空腹・水分ゲージの確認待ち";case "telemetry":return "対応NUIの確認待ち";case "observe":return "観察テスト（入力なし）";case "focus":return "前面表示待ち";case "input":return "対象ゲームの入力先を確認中";default:return "次の釣りを準備";}}
  void Publish(){var e=Changed;if(e!=null)e(new Status{Live=live,Movement=state.Movement,Recoveries=state.Recoveries,Running=state.Running,Phase=state.Phase,Detail=state.Detail,Inventory=live.Weight,Hunger=state.Hunger,Thirst=state.Thirst,Ring=state.Ring,Casts=state.Casts,Keys=state.Keys,Results=state.Results,Backend=state.Backend,Delivery=state.Delivery,ReadMs=state.ReadMs,Storage=state.Storage,Recognition=state.Recognition,StorageCycles=state.StorageCycles,StoredItems=state.StoredItems,InventoryFresh=live.Fresh,HeldItems=live.Held,CaughtItems=live.Caught});}
  void Notify(string text){var e=Alert;if(e!=null)e(text);}void Fail(string text){state.Detail=text;Log("blocked",text);Notify(text);stop.Cancel();}
  public void Stop(){if(stop!=null){Log("stop_requested","user=1");stop.Cancel();}}
  double lastLimited;
  void LogThrottled(string kind,string detail){if(Now-lastLimited<2000)return;lastLimited=Now;Log(kind,detail);}
  readonly System.Collections.Concurrent.ConcurrentQueue<string> logQueue=new System.Collections.Concurrent.ConcurrentQueue<string>();Task logWriter;
  public void Log(string kind,string detail){try{if(logQueue.Count>10000)return;logQueue.Enqueue(new JavaScriptSerializer().Serialize(new{utc=DateTime.UtcNow.ToString("o"),ms=Now,version="0.6.0-preview",session=sessionId,type=kind,detail=detail})+Environment.NewLine);lock(logGate){if(logWriter==null||logWriter.IsCompleted)logWriter=Task.Run((Action)WriteLogs);}}catch{}}
  void WriteLogs(){for(;;){var lines=new System.Text.StringBuilder();string line;for(int i=0;i<512&&logQueue.TryDequeue(out line);i++)lines.Append(line);if(lines.Length>0)try{string p=Path.Combine(root,"events.jsonl");if(File.Exists(p)&&new FileInfo(p).Length>4*1024*1024){string old=p+".1";if(File.Exists(old))File.Delete(old);File.Move(p,old);}File.AppendAllText(p,lines.ToString());}catch{}lock(logGate){if(logQueue.IsEmpty){logWriter=null;return;}}}}
  public void FlushLogs(){Task writer;lock(logGate)writer=logWriter;if(writer!=null)try{writer.Wait(3000);}catch{}}

  public void Dispose(){if(disposed)return;disposed=true;Stop();if(worker!=null)try{worker.Wait(2000);}catch{}if(idleReader!=null)idleReader.Dispose();FlushLogs();}
 }
}
