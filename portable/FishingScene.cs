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
  public string RenderVisibility=""; public bool RenderFocused; public string Discovery=""; public Ring Ring=new Ring(); public bool Present,Busy; public string Frame="",Stamp="",Source="none"; public int Key=-1,Width,Height;
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
  string selected=""; readonly Dictionary<string,double> failedUntil=new Dictionary<string,double>(); public string LastDiscovery=""; double lastRingAt=-10000; readonly HashSet<string> installed=new HashSet<string>(); string[] epochFrames; string epoch=""; int scan; double scanAt,healthAt; bool dead;
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
  static void Collect(Dictionary<string,object> tree,List<string> result){var f=GetObject(tree,"frame");string u=GetString(f,"url");if((u.IndexOf("cfx-nui-",StringComparison.OrdinalIgnoreCase)>=0||u.StartsWith("nui://",StringComparison.OrdinalIgnoreCase))&&!result.Contains(u))result.Add(u);object ch;if(tree.TryGetValue("childFrames",out ch)){var children=ReadJsonArray(ch);if(children!=null)foreach(var o in children){var child=o as Dictionary<string,object>;if(child!=null)Collect(child,result);}}}
  async Task<FishingPilot.Scene> ReadOne(string url,bool allowInput,string cycle,bool fast) {
   var session=await Get(url).ConfigureAwait(false);
   if(!installed.Contains(url)){await Read(session,probe).ConfigureAwait(false);installed.Add(url);}
   string command=Json.Serialize(new Dictionary<string,object>{{"enabled",allowInput},{"cycle",cycle??""}});
   string raw=await Read(session,"window.__fpProbe3?window.__fpProbe3.sample("+(fast?"true":"false")+","+command+"): 'REINSTALL'").ConfigureAwait(false);
   if(raw=="REINSTALL"){installed.Remove(url);return new FishingPilot.Scene{Source="NUI reinitialize"};}
   return DecodeScene(raw,url);
  }
  public static FishingPilot.Scene DecodeScene(string raw,string url){
   var d=new JavaScriptSerializer().DeserializeObject(raw) as Dictionary<string,object>;if(d==null)throw new InvalidOperationException("INVALID_SCENE");
   var r=GetObject(d,"ring");
   var scene=new FishingPilot.Scene{Frame=url,Present=Bool(r,"present"),Busy=Bool(d,"busy"),Width=NumI(d,"w"),Height=NumI(d,"h"),Hunger=Num(d,"hunger",-1),Water=Num(d,"water",-1),Source=Bool(r,"valid")?"NUI same-turn":"NUI candidate"};
   if(Bool(r,"ambiguous"))scene.Source="ambiguous NUI";
   scene.Key=NumI(r,"key",-1);scene.Stamp=GetString(r,"stamp");scene.X=Num(r,"x",0);scene.Y=Num(r,"y",0);scene.W=Num(r,"w",0);scene.H=Num(r,"h",0);
   if(Bool(r,"valid"))scene.Ring=new FishingPilot.Ring{Valid=true,Native=true,Key=scene.Key,Pointer=Num(r,"pointer",0),Start=Num(r,"start",0),End=Num(r,"end",0),Radius=Num(r,"radius",0),Identity=url+":"+scene.Stamp,Confidence=1};
   scene.Delivery=GetString(d,"delivery");var input=GetObject(d,"input");scene.InputReason=GetString(input,"reason");
   if(Bool(input,"sent")){scene.SentKey=NumI(input,"key",-1);scene.InputSequence=NumI(input,"seq");scene.InputRound=NumI(input,"round");scene.InputPointer=Num(input,"pointer",0);scene.InputStart=Num(input,"start",0);scene.InputEnd=Num(input,"end",0);}
   if(d.ContainsKey("notices"))foreach(var n in ReadJsonArray(d["notices"])??new object[0]){var v=(Dictionary<string,object>)n;scene.Notices.Add(new FishingPilot.Notice{Kind=GetString(v,"kind"),Id=url+":"+GetString(v,"id")});}
   scene.RenderVisibility=GetString(d,"documentVisible");scene.RenderFocused=Bool(d,"focused");return scene;
  }
  readonly Dictionary<string,FishingPilot.Scene> recent=new Dictionary<string,FishingPilot.Scene>();
  public string BackgroundStatus="focus_emulation=not_requested";bool backgroundActive;
  public async Task SetBackgroundActive(bool active){
   if(backgroundActive==active)return;
   var root=await Get("nui://game/ui/root.html").ConfigureAwait(false);root.FishingDeadline(800);
   try{await root.FishingBackgroundFocus(active).ConfigureAwait(false);backgroundActive=active;BackgroundStatus="focus_emulation="+active;}
   catch(Exception e){BackgroundStatus="focus_emulation_unavailable="+e.Message;root.Dispose();sessions.Remove("nui://game/ui/root.html");}
   finally{try{root.FishingDeadline(-1);}catch(ObjectDisposedException){}}
  }
  void Remember(string url,FishingPilot.Scene value){value.At=timer.Elapsed.TotalMilliseconds;recent[url]=new FishingPilot.Scene{At=value.At,Busy=value.Busy,Hunger=value.Hunger,Water=value.Water,Notices=new List<FishingPilot.Notice>(value.Notices)};}
  void Ancillary(FishingPilot.Scene value,double now){
   foreach(var pair in recent){var old=pair.Value;if(ReferenceEquals(old,value)||now-old.At>3000)continue;
    value.Busy|=old.Busy;if(value.Hunger<0&&old.Hunger>=0)value.Hunger=old.Hunger;if(value.Water<0&&old.Water>=0)value.Water=old.Water;
    foreach(var n in old.Notices)if(!value.Notices.Exists(v=>v.Id==n.Id))value.Notices.Add(n);
   }
  }
  async Task<FishingPilot.Scene> Probe(string url,bool allow,string cycle){
   double now=timer.Elapsed.TotalMilliseconds,until;if(failedUntil.TryGetValue(url,out until)&&until>now)return null;
   try{var value=await ReadOne(url,allow,cycle,true).ConfigureAwait(false);Remember(url,value);failedUntil.Remove(url);return value;}
   catch(Exception e){if(e.Message.Contains("SERVER_SESSION_CHANGED"))throw;CdpSession broken;if(sessions.TryGetValue(url,out broken)){broken.Dispose();sessions.Remove(url);}installed.Remove(url);failedUntil[url]=now+2000;LastDiscovery="frame="+url+" error="+e.Message;return null;}
  }
  public async Task<FishingPilot.Scene> Poll(bool allowInput=false,string cycle="") {
   token.ThrowIfCancellationRequested();double now=timer.Elapsed.TotalMilliseconds;
   var chosen=new FishingPilot.Scene();
   // Sample the active ring before health checks, screenshot capture or any unrelated UI.
   if(selected!=""){
    var v=await Probe(selected,allowInput,cycle).ConfigureAwait(false);
    if(v!=null){chosen=v;if(v.Ring.Valid){lastRingAt=now;Ancillary(v,now);v.Discovery=LastDiscovery;return v;}}
   }
   if(now-healthAt>1500){var connection=await Get(InventoryFramePart).ConfigureAwait(false);connection.FishingDeadline(1200);
    try{var tree=await connection.FishingFrames().ConfigureAwait(false);if(!ServerFrameTreeMatches(tree,epochFrames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");Collect(tree,urls);}finally{connection.FishingDeadline(-1);}healthAt=now;}
   // Known skill/fishing resources are sampled every poll, not once per complete frame sweep.
   var priority=urls.Where(u=>Rank(u)<=1&&u!=selected).Take(8).ToList();
   if(now>=scanAt&&urls.Count>0){for(int i=0;i<urls.Count;i++){string u=urls[scan++%urls.Count];if(u!=selected&&!priority.Contains(u)&&u!="nui://game/ui/root.html"){priority.Add(u);break;}}scanAt=now+120;}
   foreach(string u in priority){
    var current=await Probe(u,allowInput,cycle).ConfigureAwait(false);if(current==null)continue;
    if(current.Ring.Valid){selected=u;lastRingAt=now;Ancillary(current,now);current.Discovery="native_frame="+u+" "+BackgroundStatus;return current;}
    if(current.Present&&!chosen.Present)chosen=current;
   }
   Ancillary(chosen,now);chosen.Discovery="frames="+urls.Count+" scanned="+scan+" "+BackgroundStatus+" "+LastDiscovery;
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
  // Raster fallback requires a consistently observed central game ring.
  // Keyboard focus remains in a local game iframe; no desktop fallback.
  public async Task<bool> PixelDigit(FishingPilot.Scene scene,int digit) {
   token.ThrowIfCancellationRequested();if(digit<0||digit>9)return false;
   var root=await Get("nui://game/ui/root.html").ConfigureAwait(false);
   string focus=await Read(root,@"(() => {const a=document.activeElement;if(!a)return 'NONE';if(a.matches('input,textarea,[contenteditable=true]'))return 'EDITING';if(a.tagName==='IFRAME'){const s=a.src||'';return /cfx-nui-|^nui:/.test(s)&&!/ox_inventory|chat|phone|browser/i.test(s)?s:'NONE';}return 'NONE';})()").ConfigureAwait(false);
   if(focus!="NONE"&&focus!="EDITING"&&urls.Any(u=>u==focus)) {
    var focused=await Get(focus).ConfigureAwait(false);
    string guard=await Read(focused,"(() => {const a=document.activeElement;return a&&a.matches('input,textarea,[contenteditable=true]')?'EDITING':'OK';})()").ConfigureAwait(false);
    if(guard!="OK")return false;
    root.FishingDeadline(700);try{return await root.FishingKey(digit,token).ConfigureAwait(false);}finally{try{root.FishingDeadline(-1);}catch(ObjectDisposedException){}}
   }
   if(scene!=null&&scene.Present&&scene.Key==digit&&scene.Frame!="")return await Digit(scene,digit).ConfigureAwait(false);
   return false;
  }
  public static bool Forward(int port,int milliseconds,CancellationToken token,Func<bool> enabled){
   if(token.IsCancellationRequested||!enabled()||port==0||port!=ConsolePort()||milliseconds<100||milliseconds>700)return false;
   bool sent=false;try{sent=TrySendDevCon(port,"-move_up_only;+move_up_only",0);if(sent){var sw=System.Diagnostics.Stopwatch.StartNew();while(sw.ElapsedMilliseconds<milliseconds&&!token.IsCancellationRequested&&enabled())token.WaitHandle.WaitOne(10);}return sent;}
   finally{if(sent)TrySendDevCon(port,"-move_up_only",0);}
  }
  public static int ConsolePort() { return FishingPilot.Native.FiveMConsolePort(); }
  public static bool Hotbar(int port,int digit,CancellationToken token){if(token.IsCancellationRequested||digit<1||digit>5||(port!=29200&&port!=29300))return false;string cmd="hotkey"+digit;bool sent=false;try{sent=TrySendDevCon(port,"-"+cmd+";+"+cmd,0);if(sent)token.WaitHandle.WaitOne(50);return sent;}finally{if(sent)TrySendDevCon(port,"-"+cmd,0);}}
  public void Dispose(){if(dead)return;dead=true;if(backgroundActive)try{SetBackgroundActive(false).GetAwaiter().GetResult();}catch{}foreach(var s in sessions.Values)try{s.FishingDeadline(200);s.EvaluateStringAsync("window.__fpProbe3?window.__fpProbe3.stop(): 'STOPPED'",false).GetAwaiter().GetResult();}catch{}finally{s.Dispose();}sessions.Clear();}
 }
}
