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
  public int SentKey=-1, InputSequence, InputRound; public string Delivery="", InputReason=""; public double InputPointer,InputStart,InputEnd;
  public double At,Cost,X,Y,W,H,Hunger=-1,Water=-1; public List<Notice> Notices=new List<Notice>();
 }
 public sealed class Notice {public string Kind,Id;}
}
internal static partial class CdpBridge {
 // Independent NUI contexts, one serialized caller per connection; never sends desktop keys.
 public sealed class FishingConnection : IDisposable {
  readonly Dictionary<string,CdpSession> sessions=new Dictionary<string,CdpSession>();
  readonly string probe; readonly List<string> urls=new List<string>(); readonly CancellationToken token;
  string selected=""; double lastRingAt=-10000; readonly HashSet<string> installed=new HashSet<string>(); string[] epochFrames; string epoch=""; int scan; double scanAt,healthAt; bool dead;
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
  async Task<FishingPilot.Scene> ReadOne(string url,bool allowInput,string cycle,bool fast) {
   var session=await Get(url).ConfigureAwait(false);
   if(!installed.Contains(url)){await Read(session,probe).ConfigureAwait(false);installed.Add(url);}
   string command=Json.Serialize(new Dictionary<string,object>{{"enabled",allowInput},{"cycle",cycle??""}});
   string raw=await Read(session,"window.__fpProbe3?window.__fpProbe3.sample("+(fast?"true":"false")+","+command+"): 'REINSTALL'").ConfigureAwait(false);
   if(raw=="REINSTALL"){installed.Remove(url);return new FishingPilot.Scene{Source="NUI reinitialize"};}
   var d=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(raw);var r=(Dictionary<string,object>)d["ring"];
   var scene=new FishingPilot.Scene{Frame=url,Present=Bool(r,"present"),Busy=Bool(d,"busy"),Width=NumI(d,"w"),Height=NumI(d,"h"),Hunger=Num(d,"hunger",-1),Water=Num(d,"water",-1),Source=Bool(r,"valid")?"NUI same-turn":"NUI candidate"};
   if(Bool(r,"ambiguous"))scene.Source="ambiguous NUI";
   scene.Key=NumI(r,"key",-1);scene.Stamp=GetString(r,"stamp");scene.X=Num(r,"x",0);scene.Y=Num(r,"y",0);scene.W=Num(r,"w",0);scene.H=Num(r,"h",0);
   if(Bool(r,"valid"))scene.Ring=new FishingPilot.Ring{Valid=true,Native=true,Key=scene.Key,Pointer=Num(r,"pointer",0),Start=Num(r,"start",0),End=Num(r,"end",0),Radius=Num(r,"radius",0),Identity=url+":"+scene.Stamp,Confidence=1};
   scene.Delivery=GetString(d,"delivery");var input=GetObject(d,"input");scene.InputReason=GetString(input,"reason");
   if(Bool(input,"sent")){scene.SentKey=NumI(input,"key",-1);scene.InputSequence=NumI(input,"seq");scene.InputRound=NumI(input,"round");scene.InputPointer=Num(input,"pointer",0);scene.InputStart=Num(input,"start",0);scene.InputEnd=Num(input,"end",0);}
   if(d.ContainsKey("notices"))foreach(var n in (object[])d["notices"]){var v=(Dictionary<string,object>)n;scene.Notices.Add(new FishingPilot.Notice{Kind=GetString(v,"kind"),Id=url+":"+GetString(v,"id")});}
   return scene;
  }
  public async Task<FishingPilot.Scene> Poll(bool allowInput=false,string cycle="") {
   token.ThrowIfCancellationRequested();double now=timer.Elapsed.TotalMilliseconds;
   FishingPilot.Scene chosen=new FishingPilot.Scene();
   if(selected!="") {
    chosen=await ReadOne(selected,allowInput,cycle,now-lastRingAt<500).ConfigureAwait(false);
    // Critical path: return immediately, before discovery and ancillary reads.
    if(chosen.Present){lastRingAt=now;return chosen;}
   }
   if(now-healthAt>1500){var s=await Get(InventoryFramePart).ConfigureAwait(false);s.FishingDeadline(1200);try{var tree=await s.FishingFrames().ConfigureAwait(false);if(!ServerFrameTreeMatches(tree,epochFrames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");Collect(tree,urls);}finally{s.FishingDeadline(-1);}healthAt=now;}
   var batch=new List<string>();if(now>=scanAt&&urls.Count>0){string u=urls[scan++%urls.Count];if(u!=selected)batch.Add(u);scanAt=now+(selected==""?10:100);}
   string noticeUrl=urls.FirstOrDefault(u=>u.Contains(ProgressFramePart));if(noticeUrl!=null&&noticeUrl!=selected&&!batch.Contains(noticeUrl)&&now>=noticeAt){batch.Add(noticeUrl);noticeAt=now+150;}
   foreach(string u in batch){
    var current=await ReadOne(u,false,cycle,false).ConfigureAwait(false);
    if(current.Present){current.Notices.AddRange(chosen.Notices);current.Busy|=chosen.Busy;if(current.Hunger<0)current.Hunger=chosen.Hunger;if(current.Water<0)current.Water=chosen.Water;selected=u;lastRingAt=now;return current;}
    chosen.Busy|=current.Busy;chosen.Notices.AddRange(current.Notices);if(chosen.Width==0){chosen.Width=current.Width;chosen.Height=current.Height;}if(current.Hunger>=0)chosen.Hunger=current.Hunger;if(current.Water>=0)chosen.Water=current.Water;
   }
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
   var session=await Get(scene.Frame).ConfigureAwait(false);
   string request=Json.Serialize(new Dictionary<string,object>{{"key",key},{"stamp",scene.Stamp},{"inside",true}});
   string result=await Read(session,"window.__fpProbe3?window.__fpProbe3.pixelKey("+request+"): 'STALE'").ConfigureAwait(false);
   return result=="SENT";
  }
  public static int ConsolePort() { return FishingPilot.Native.FiveMConsolePort(); }
  public static bool Hotbar(int port,int digit,CancellationToken token){if(token.IsCancellationRequested||digit<1||digit>5||(port!=29200&&port!=29300))return false;string cmd="hotkey"+digit;bool sent=false;try{sent=TrySendDevCon(port,"-"+cmd+";+"+cmd,0);if(sent)token.WaitHandle.WaitOne(50);return sent;}finally{if(sent)TrySendDevCon(port,"-"+cmd,0);}}
  public void Dispose(){if(dead)return;dead=true;foreach(var s in sessions.Values)try{s.Dispose();}catch{}sessions.Clear();}
 }
}
