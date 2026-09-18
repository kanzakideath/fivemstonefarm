using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
namespace FishingPilot {
 public sealed class Telemetry {public bool Known;public string Epoch="",Notice="NONE",Error="";public Inventory Inventory=new Inventory();public double At;}
 public sealed class Options {public int RodKey=2,FoodKey=1,DrinkKey=3;public bool AutoNeeds=true,ObserveOnly=false;public int ReserveGrams=500;public double FoodX=-1,FoodY=-1,WaterX=-1,WaterY=-1,GaugeRadius=20;}
 public sealed class Status {public string Phase="停止中",Detail="",Inventory="未確認",Hunger="未確認",Thirst="未確認",Ring="未検出";public int Casts,Keys,Results;public bool Running;}
 public sealed class Engine : IDisposable {
  public event Action<Status> Changed;public event Action<string> Alert;
  readonly string root,templates;readonly object gate=new object(),logGate=new object();
  CancellationTokenSource stop;Task worker,telemetryWorker;readonly Stopwatch clock=Stopwatch.StartNew();
  Telemetry telemetry=new Telemetry();Status state=new Status();IntPtr target;uint targetPid;Options options;
  string epoch="",phase="ready",noticeBaseline="NONE";double castAt,lastRingAt=-10000,nextCastAt,nextHud,foodActionAt=-10000;
  Inventory before;RoundController round=new RoundController();bool castIssued,seenRing,fullAlert;
  VitalGauge hunger=new VitalGauge(),water=new VitalGauge(),cachedFood=new VitalGauge(),cachedWater=new VitalGauge();int hungerVotes,waterVotes;double hungerObservedAt,waterObservedAt;
  string pendingNeed="";double needBefore;bool disposed;
  public Engine(string directory,string templateFile){root=directory;templates=templateFile;Directory.CreateDirectory(root);}
  double Now{get{return clock.Elapsed.TotalMilliseconds;}}
  public bool Running{get{return stop!=null&&!stop.IsCancellationRequested&&worker!=null&&!worker.IsCompleted;}}
  public void Start(Options o) {
   if(Running)return;if(telemetryWorker!=null&&!telemetryWorker.IsCompleted)throw new InvalidOperationException("前の接続処理の終了を待っています。数秒後に再開してください");if(worker!=null&&!worker.IsCompleted)throw new InvalidOperationException("前の処理が停止するまでお待ちください");
   target=Native.FishingWindow();if(target==IntPtr.Zero)throw new InvalidOperationException("FiveMを前面にしてF8を押してください");Native.GetWindowThreadProcessId(target,out targetPid);
   options=o;stop=new CancellationTokenSource();var token=stop.Token;round.Reset();epoch="";phase="ready";castIssued=false;seenRing=false;fullAlert=false;before=null;pendingNeed="";foodActionAt=-10000;nextHud=0;hungerVotes=waterVotes=0;hunger=new VitalGauge();water=new VitalGauge();cachedFood=new VitalGauge();cachedWater=new VitalGauge();
   telemetry=new Telemetry();state=new Status{Running=true};Log("start", "observe_only="+o.ObserveOnly+" auto_needs="+o.AutoNeeds);
   telemetryWorker=Task.Run(()=>TelemetryLoop(token));worker=Task.Run(()=>Loop(token));
  }
  async Task TelemetryLoop(CancellationToken token) {
   while(!token.IsCancellationRequested) {
    Telemetry value;try{value=await CdpBridge.FishingReadOnlyAsync().ConfigureAwait(false);}catch(Exception e){value=new Telemetry{Error=e.GetType().Name};}
    value.At=Now;if(token.IsCancellationRequested)return;lock(gate)telemetry=value;
    try{await Task.Delay(600,token).ConfigureAwait(false);}catch(OperationCanceledException){return;}
   }
  }
  void Loop(CancellationToken token) {
   Native.timeBeginPeriod(1);
   try {
    var reader=new RingReader(templates);double lastUi=0;nextCastAt=Now;
    while(!token.IsCancellationRequested) {
     double now=Now;uint pid;Native.GetWindowThreadProcessId(target,out pid);
     if(!Native.IsWindow(target)||pid!=targetPid){Fail("FiveMが終了したため停止しました");break;}
     Telemetry t;lock(gate)t=telemetry;
     if(t.Epoch!=""&&epoch!=""&&t.Epoch!=epoch){Fail("サーバー再接続・再起動を検出。再開にはF8が必要です");break;}
     if(t.Known&&epoch=="")epoch=t.Epoch;
     if(Native.GetForegroundWindow()!=target) {Update("一時停止","FiveMを前面に戻すと再観測します",t);token.WaitHandle.WaitOne(100);continue;}
     Rectangle c=Native.Client(target);
     if(c.Width<600||c.Height<400){Update("一時停止","ゲーム画面が小さい・最小化されています",t);token.WaitHandle.WaitOne(200);continue;}
     int side=(int)(c.Height*.28);Rectangle roi=new Rectangle(c.X+c.Width/2-side/2,c.Y+c.Height/2-side/2,side,side);
     Ring r;double started=Now;using(Bitmap b=Native.Capture(roi,320,320))r=reader.Read(b);double ended=Now;
     if(token.IsCancellationRequested)break;if(Native.GetForegroundWindow()!=target)continue;
     if(ended-started>110){state.Ring="撮影遅延：入力しません";Log("stale_frame",(ended-started).ToString("F0"));token.WaitHandle.WaitOne(10);continue;}
     now=Now;
     if(r.Valid) {lastRingAt=now;state.Ring=String.Format("数字 {0} / 白 {1:F0}° / 緑 {2:F0}〜{3:F0}°",r.Key,r.Pointer,r.Start,r.End);}
     else state.Ring="円なし／判読不能";
     bool fresh=t.Known&&now-t.At>=0&&now-t.At<3000;
     if(options.ObserveOnly){if(now>=nextHud){ReadVitals(c);nextHud=Now+2500;}if(r.Valid){int k=round.Observe(r,now);if(k>=0){state.Keys++;Log("dry_decision","key="+k+" round="+round.Round);}}else round.Observe(r,now);phase="observe";}
     else if(r.Valid && castIssued) {
      seenRing=true;phase="challenge";int key=round.Observe(r,now);
      if(key>=0) {if(!Native.Press(target,targetPid,key,token)){Fail("キー入力を送れません。FiveMの前面状態と権限を確認してください");break;}state.Keys++;Log("round_key",String.Format("key={0} round={1} pointer={2:F0} target={3:F0}-{4:F0}",key,round.Round,r.Pointer,r.Start,r.End));}
     } else if(r.Valid && !castIssued) {phase="existing_challenge";state.Detail="既に釣り中です。手動で完了後、F9→F8で開始してください";}
     else if(castIssued) {
      round.Observe(r,now);
      if(seenRing && now-lastRingAt>180) {
       phase="result";
       bool obtained=fresh&&t.At>round.LastHit&&t.Inventory.IncreasedSince(before);
       bool failed=t.Notice=="FAIL"&&noticeBaseline!="FAIL"&&t.At>castAt;
       if(obtained||failed) {
        if(obtained)state.Results++;
        Log(obtained?"inventory_gain_confirmed":"failure_notification","rounds="+round.Round+" since_last_key_ms="+(now-round.LastHit).ToString("F0"));
        castIssued=false;seenRing=false;phase="ready";before=null;nextCastAt=now+220;
       } else if(now-lastRingAt>12000){Fail("釣りの終了結果を確認できません。診断ログを保存してください");break;}
      } else if(now-castAt>100000){Fail("アタリを確認できません。竿・餌・通知を確認してください");break;}
     }
     if(!r.Valid && !castIssued && phase!="existing_challenge" && phase!="observe") {
      if(now>=nextHud) {ReadVitals(c);nextHud=Now+2500;now=Now;}
      if(!fresh){phase="telemetry";state.Detail=t.Error==""?"所持品・サーバー状態を確認しています":t.Error;}
      else if(t.Inventory.Full(options.ReserveGrams)) {
       phase="full";
       if(!fullAlert){fullAlert=true;Notify(t.Inventory.Weight>=t.Inventory.Maximum?"インベントリがいっぱいになったよ":"インベントリの空きが少なくなったよ");Log("capacity_wait",t.Inventory.Weight+"/"+t.Inventory.Maximum);}
      } else {
       fullAlert=false;bool needReady=HandleNeeds(now,token);
       if(needReady && now>=nextCastAt && now-lastRingAt>250) {
        if(t.Notice=="BLOCK"){Fail("竿・餌または容量の問題を検出しました");break;}
        before=t.Inventory;noticeBaseline=t.Notice;round.Reset();castAt=now;lastRingAt=-10000;
        if(!Native.Press(target,targetPid,options.RodKey,token)){Fail("投竿キーを送れませんでした");break;}
        castIssued=true;seenRing=false;phase="bite";state.Casts++;Log("cast","key="+options.RodKey);
       }
      }
     }
     if(now-lastUi>200){Update(Label(phase),Detail(phase),t);lastUi=now;}
     token.WaitHandle.WaitOne(8);
    }
   } catch(Exception e){Log("exception",e.GetType().Name+": "+e.Message);Notify("処理エラー。診断ログを確認してください");state.Detail=e.Message;}
   finally{stop.Cancel();state.Running=false;state.Phase="停止中";Publish();Log("stop","keys released by input scope");Native.timeEndPeriod(1);}
  }
  void ReadVitals(Rectangle c) {
   int h=Math.Min(c.Height,140),w=Math.Min(c.Width,400);
   using(Bitmap b=Native.Capture(new Rectangle(c.X,c.Bottom-h,w,h),w,h)) {
    hunger=HudReader.Read(b,true,options.FoodX<0?(cachedFood.Known?cachedFood.X:-1):options.FoodX*c.Width,options.FoodY<0?(cachedFood.Known?cachedFood.Y:-1):options.FoodY*c.Height-(c.Height-h),options.FoodX<0&&cachedFood.Known?cachedFood.Radius:options.GaugeRadius);
    water=HudReader.Read(b,false,options.WaterX<0?(cachedWater.Known?cachedWater.X:-1):options.WaterX*c.Width,options.WaterY<0?(cachedWater.Known?cachedWater.Y:-1):options.WaterY*c.Height-(c.Height-h),options.WaterX<0&&cachedWater.Known?cachedWater.Radius:options.GaugeRadius);
   }
   double now=Now;
   if(options.FoodX<0&&hunger.Known)cachedFood=hunger;if(options.WaterX<0&&water.Known)cachedWater=water;
   if(hunger.Known){hungerObservedAt=now;hungerVotes=hunger.Value<=50?hungerVotes+1:0;}
   if(water.Known){waterObservedAt=now;waterVotes=water.Value<=50?waterVotes+1:0;}
   Log("vitals",String.Format("hunger={0} water={1}",hunger.Known?hunger.Value.ToString("F0"):"unknown",water.Known?water.Value.ToString("F0"):"unknown"));
  }
  bool HandleNeeds(double now,CancellationToken token) {
   if(!options.AutoNeeds)return true;
   if(pendingNeed!="") {
    VitalGauge g=pendingNeed=="food"?hunger:water;
    if(g.Known&&g.Value>=needBefore+3){Log("supply_confirmed",pendingNeed);pendingNeed="";nextCastAt=now+200;return true;}
    if(now-foodActionAt>14000){Fail("食事・水分の回復を確認できません。設定したスロットを確認してください");return false;}
    phase="supply";return false;
   }
   if(!hunger.Known||!water.Known||now-hungerObservedAt>10000||now-waterObservedAt>10000){phase="vitals";return false;}
   string kind=hungerVotes>=2?"food":waterVotes>=2?"water":"";
   if(kind==""&&(hunger.Value<=50||water.Value<=50)){phase="vitals";nextHud=Math.Min(nextHud,now+180);return false;}
   if(kind=="")return true;
   if(now-foodActionAt<15000){phase="supply";return false;}
   int key=kind=="food"?options.FoodKey:options.DrinkKey;
   if(key==options.RodKey){Fail("食料・飲料のキーと竿のキーが同じです");return false;}
   needBefore=kind=="food"?hunger.Value:water.Value;
   if(!Native.Press(target,targetPid,key,token)){Fail("補給キーの送信に失敗しました");return false;}
   pendingNeed=kind;foodActionAt=now;phase="supply";Log("supply_key",kind+" key="+key+" before="+needBefore.ToString("F0"));return false;
  }
  string Label(string p){switch(p){case "bite":return "アタリ待ち";case "challenge":return "数字・タイミング判定";case "result":return "追加判定／結果確認";case "full":return "空き容量待ち";case "supply":return "50%以下のゲージを補給・確認";case "vitals":return "空腹・水分ゲージの確認待ち";case "telemetry":return "対応NUIの確認待ち";case "observe":return "観察テスト（キー入力なし）";case "existing_challenge":return "手動の釣りが進行中";default:return "次の釣りを準備";}}
  string Detail(string p){switch(p){case "bite":return "2を再送せず、中央の円を待っています";case "challenge":return "実際に白が緑へ入ったときだけ1回入力";case "result":return "円の消失だけで再投入しません";case "vitals":return "ゲージを読めないため補給を推測しません。設定・位置を確認";case "full":return "自動収納は未実装。空きが戻れば再開します";case "supply":return "食事中は投竿しません。回復を確認後に再開";default:return state.Detail;}}
  void Update(string label,string detail,Telemetry t){state.Phase=label;state.Detail=detail;state.Inventory=t.Known?String.Format("{0:F1} / {1:F1} kg",t.Inventory.Weight/1000.0,t.Inventory.Maximum/1000.0):"未確認";state.Hunger=hunger.Known?hunger.Value.ToString("F0")+"%":"未確認";state.Thirst=water.Known?water.Value.ToString("F0")+"%":"未確認";Publish();}
  void Publish(){var e=Changed;if(e!=null)e(new Status{Running=state.Running,Phase=state.Phase,Detail=state.Detail,Inventory=state.Inventory,Hunger=state.Hunger,Thirst=state.Thirst,Ring=state.Ring,Casts=state.Casts,Keys=state.Keys,Results=state.Results});}
  void Notify(string text){var e=Alert;if(e!=null)e(text);}
  void Fail(string text){state.Detail=text;Log("blocked",text);Notify(text);stop.Cancel();}
  public void Stop(){if(stop!=null)stop.Cancel();}
  public void Log(string kind,string detail){lock(logGate){try{string p=Path.Combine(root,"events.jsonl");if(File.Exists(p)&&new FileInfo(p).Length>4*1024*1024){string old=p+".1";if(File.Exists(old))File.Delete(old);File.Move(p,old);}File.AppendAllText(p,new JavaScriptSerializer().Serialize(new {utc=DateTime.UtcNow.ToString("o"),ms=Now,type=kind,detail=detail})+Environment.NewLine);}catch{}}}
  public void Dispose(){if(disposed)return;disposed=true;Stop();if(worker!=null)try{worker.Wait(1200);}catch{}}
 }
}
