using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
namespace FishingPilot {
 public sealed class Scene {
  public Ring Ring=new Ring(); public bool Present,Busy; public string Frame="",Stamp="",Source="none"; public int Key=-1,Width,Height;
  public double At,Cost,X,Y,W,H,Hunger=-1,Water=-1; public List<Notice> Notices=new List<Notice>();
 }
 public sealed class Notice {public string Kind,Id;}
}
internal static partial class CdpBridge {
 // Independent NUI contexts, one serialized caller per connection; never sends desktop keys.
 public sealed class FishingConnection : IDisposable {
  readonly Dictionary<string,CdpSession> sessions=new Dictionary<string,CdpSession>();
  readonly string probe; readonly List<string> urls=new List<string>(); readonly CancellationToken token;
  string selected=""; string[] epochFrames; string epoch=""; int scan; double scanAt,healthAt; bool dead;
  readonly System.Diagnostics.Stopwatch timer=System.Diagnostics.Stopwatch.StartNew();
  public string Epoch {get{return epoch;}}
  public FishingConnection(string script,CancellationToken cancellation){probe=script;token=cancellation;}
  async Task<CdpSession> Get(string url){CdpSession s;if(sessions.TryGetValue(url,out s))return s;s=await CdpSession.OpenAsync(url,TimeSpan.FromMilliseconds(2000),epochFrames).ConfigureAwait(false);s.FishingDeadline(-1);sessions[url]=s;return s;}
  async Task<string> Read(CdpSession s,string expression){token.ThrowIfCancellationRequested();s.FishingDeadline(1200);try{return await s.EvaluateStringAsync(expression,false).ConfigureAwait(false);}finally{s.FishingDeadline(-1);}}
  public async Task Initialize(string expected) {
   if(!TryDecodeServerEpoch(expected,out epochFrames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");epoch=expected;
   using(var s=await CdpSession.OpenAsync("nui://game/ui/root.html",TimeSpan.FromSeconds(3),epochFrames).ConfigureAwait(false)){
    var tree=await s.FishingFrames().ConfigureAwait(false);Collect(tree,urls);
   }
   urls.Sort((a,b)=>Rank(a).CompareTo(Rank(b)));healthAt=timer.Elapsed.TotalMilliseconds;
  }
  static int Rank(string s){s=s.ToLowerInvariant();return s.Contains("ox_lib")?0:s.Contains("skill")||s.Contains("circle")||s.Contains("fish")||s.Contains("minigame")||s.Contains("bl_ui")?1:s.Contains("hud")?2:3;}
  static void Collect(Dictionary<string,object> tree,List<string> result){var f=GetObject(tree,"frame");string u=GetString(f,"url");if(u.IndexOf("cfx-nui-",StringComparison.OrdinalIgnoreCase)>=0&&!result.Contains(u))result.Add(u);object ch;if(tree.TryGetValue("childFrames",out ch))foreach(var o in (object[])ch)Collect((Dictionary<string,object>)o,result);}
  public async Task<FishingPilot.Scene> Poll() {
   token.ThrowIfCancellationRequested();double now=timer.Elapsed.TotalMilliseconds;
   if(now-healthAt>1200){var s=await Get(InventoryFramePart).ConfigureAwait(false);s.FishingDeadline(1200);try{var tree=await s.FishingFrames().ConfigureAwait(false);if(!ServerFrameTreeMatches(tree,epochFrames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");Collect(tree,urls);}finally{s.FishingDeadline(-1);}healthAt=now;}
   FishingPilot.Scene chosen=new FishingPilot.Scene();
   var batch=new List<string>();if(selected!="")batch.Add(selected);
   if(now>=scanAt&&urls.Count>0){string u=urls[scan++%urls.Count];if(!batch.Contains(u))batch.Add(u);scanAt=now+(selected==""?20:180);}
   string noticeUrl=urls.FirstOrDefault(u=>u.Contains(ProgressFramePart));
   if(noticeUrl!=null&&!batch.Contains(noticeUrl)&&now>=noticeAt){batch.Add(noticeUrl);noticeAt=now+180;}
   foreach(string u in batch){
    var s=await Get(u).ConfigureAwait(false);string text=await Read(s,probe).ConfigureAwait(false);var d=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(text);
    var ring=(Dictionary<string,object>)d["ring"];bool present=Bool(ring,"present"),valid=Bool(ring,"valid");
    var current=new FishingPilot.Scene{Frame=u,Present=present,Busy=Bool(d,"busy"),Width=NumI(d,"w"),Height=NumI(d,"h"),Hunger=Num(d,"hunger",-1),Water=Num(d,"water",-1),Source=valid?"NUI geometry":"NUI candidate"};
    current.Key=NumI(ring,"key",-1);current.Stamp=GetString(ring,"stamp");current.X=Num(ring,"x",0);current.Y=Num(ring,"y",0);current.W=Num(ring,"w",0);current.H=Num(ring,"h",0);
    if(valid)current.Ring=new FishingPilot.Ring{Valid=true,Key=current.Key,Radius=Num(ring,"radius",0),Pointer=Num(ring,"pointer",0),Start=Num(ring,"start",0),End=Num(ring,"end",0),Confidence=1,Identity=u+":"+current.Stamp,Native=true};
    if(d.ContainsKey("notices"))foreach(var item in (object[])d["notices"]){var a=(Dictionary<string,object>)item;current.Notices.Add(new FishingPilot.Notice{Kind=GetString(a,"kind"),Id=u+":"+GetString(a,"id")});}
    if(present){if(chosen.Present&&chosen.Frame!=u){chosen.Ring.Valid=false;chosen.Source="ambiguous NUI";}else {current.Notices.AddRange(chosen.Notices);current.Busy|=chosen.Busy;if(current.Hunger<0)current.Hunger=chosen.Hunger;if(current.Water<0)current.Water=chosen.Water;chosen=current;selected=u;}}
    else {chosen.Busy|=current.Busy;chosen.Notices.AddRange(current.Notices);if(chosen.Width==0){chosen.Width=current.Width;chosen.Height=current.Height;}if(current.Hunger>=0)chosen.Hunger=current.Hunger;if(current.Water>=0)chosen.Water=current.Water;}
   }
   // Persistent notification/vitals frames are scanned even with a selected ring.
   return chosen;
  }
  double noticeAt;
  static bool Bool(Dictionary<string,object>d,string key){object v;return d.TryGetValue(key,out v)&&v is bool&&(bool)v;}
  static double Num(Dictionary<string,object>d,string key,double fallback){object v;double x;return d.TryGetValue(key,out v)&&v!=null&&Double.TryParse(Convert.ToString(v,System.Globalization.CultureInfo.InvariantCulture),System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out x)?x:fallback;}
  static int NumI(Dictionary<string,object>d,string key,int fallback=0){return (int)Num(d,key,fallback);}
  public async Task<Bitmap> Capture(FishingPilot.Scene scene,bool hud) {
   var s=await Get("nui://game/ui/root.html").ConfigureAwait(false);token.ThrowIfCancellationRequested();s.FishingDeadline(1600);
   try{return await s.FishingScreenshot(scene,hud).ConfigureAwait(false);}finally{s.FishingDeadline(-1);}
  }
  public async Task<bool> Digit(FishingPilot.Scene scene,int key) {
   token.ThrowIfCancellationRequested();if(!scene.Present||key<0||key>9||scene.Frame=="")return false;
   var s=await Get(scene.Frame).ConfigureAwait(false);
   // Re-read visible controls immediately before dispatch. Normal DOM keyboard input only.
   string expr="(() => {const q=JSON.parse("+probe+");const r=q.ring;if(!r.present||r.key!=="+key+"||String(r.stamp)!=="+Json.Serialize(scene.Stamp)+")return 'STALE';const a=document.activeElement;if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.isContentEditable))return 'EDITING';if(r.valid){const span=(r.end-r.start+360)%360,p=(r.pointer-r.start+360)%360;if(p<2||p>span-2)return 'LATE';}const e={key:'"+key+"',code:'Digit"+key+"',keyCode:"+(48+key)+",which:"+(48+key)+",bubbles:true,cancelable:true};try{document.dispatchEvent(new KeyboardEvent('keydown',e));}finally{document.dispatchEvent(new KeyboardEvent('keyup',e));}return 'SENT';})()";
   return await Read(s,expr).ConfigureAwait(false)=="SENT";
  }
  public static int ConsolePort() {var open=new List<int>();foreach(int p in new[]{29200,29300})try{using(var c=new TcpClient()){if(c.ConnectAsync("127.0.0.1",p).Wait(250)&&c.Connected)open.Add(p);}}catch{}return open.Count==1?open[0]:0;}
  public static bool Hotbar(int port,int digit,CancellationToken token){if(token.IsCancellationRequested||digit<1||digit>5||(port!=29200&&port!=29300))return false;string cmd="hotkey"+digit;bool sent=false;try{sent=TrySendDevCon(port,"-"+cmd+";+"+cmd,0);if(sent)token.WaitHandle.WaitOne(50);return sent;}finally{if(sent)TrySendDevCon(port,"-"+cmd,0);}}
  public void Dispose(){if(dead)return;dead=true;foreach(var s in sessions.Values)try{s.Dispose();}catch{}sessions.Clear();}
 }
}
