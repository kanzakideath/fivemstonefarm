using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
[assembly: AssemblyVersion("0.6.4.0")]
[assembly: AssemblyFileVersion("0.6.4.0")]
namespace FishingPilot {
 static class Program {
  internal const string Version="0.6.4-preview";
  [STAThread] static int Main(string[] args) {
   Native.SetProcessDPIAware();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   if(args.Length>1&&args[0]=="--storage-expressions"){CdpBridge.ExportStorageExpressions(args[1]);return 0;}
   if(args.Length>1&&args[0]=="--overlay-dark-smoke"){StatusOverlay.Screenshot(args[1],true);return 0;}
   if(args.Length>1&&args[0]=="--overlay-smoke"){StatusOverlay.Screenshot(args[1]);return 0;}
   if(args.Length>0&&args[0]=="--self-test")return Tests.Run(args.Length>1?args[1]:"test-evidence");
   if(args.Length>1&&args[0]=="--ui-smoke") {using(var form=new MainForm(args[1]))Application.Run(form);return MainForm.SmokeExit;}
   bool created;using(var mutex=new Mutex(true,"Local\\FishingPilotPortablePreview",out created)){
    if(!created){MessageBox.Show("釣りアシストは既に起動しています。旧版を終了してください。");return 1;}
    Application.Run(new MainForm(null));
   }return 0;
  }
 }
 public static class UiCommands {
  static readonly HashSet<string> Actions=new HashSet<string>{"ready","start","stop","save","calibration.reset","logs.open","diagnostics.export","storage.inspect","storage.register","overlay.save","price.map","theme.save"};
  public static Dictionary<string,object> Parse(string json) {
   if(json==null||json.Length>12000)throw new ArgumentException("不正な操作サイズです");
   var d=new JavaScriptSerializer().DeserializeObject(json) as Dictionary<string,object>;
   if(d==null||!d.ContainsKey("action")||!(d["action"] is string)||!Actions.Contains((string)d["action"]))throw new ArgumentException("未対応の操作です");
   foreach(var k in d.Keys)if(k!="action"&&k!="settings"&&k!="items")throw new ArgumentException("不正な操作項目です");
   if((string)d["action"]=="save"||(string)d["action"]=="overlay.save"||(string)d["action"]=="price.map"||(string)d["action"]=="theme.save"){if(!d.ContainsKey("settings")||!(d["settings"] is Dictionary<string,object>))throw new ArgumentException("設定がありません");}
   else if(d.ContainsKey("settings"))throw new ArgumentException("この操作に設定は指定できません");
   if((string)d["action"]=="storage.register"){
    if(!d.ContainsKey("items")||!(d["items"] is object[]))throw new ArgumentException("釣果の選択がありません");
    var a=(object[])d["items"];if(a.Length<1||a.Length>128||a.Any(x=>!(x is string)||!StorageRegistration.ValidItem((string)x)))throw new ArgumentException("収納対象の選択が不正です");
   }else if(d.ContainsKey("items"))throw new ArgumentException("この操作に収納対象は指定できません");
   return d;
  }
  public static Options Update(Options current,Dictionary<string,object> d) {
   var keys=new HashSet<string>{"FoodKey","DrinkKey","ReserveGrams","AutoNeeds","ObserveOnly","BackgroundMode","MinRecastMs","GaugeRadius","AutoStorage","HighAccuracy","IncludeExistingCatch","ShowOverlay","ContinueOnUnknownNeeds","FailureRecastMs"};
   if(d.Count<8||d.Count>keys.Count)throw new ArgumentException("設定項目が不足しています");foreach(var key in d.Keys)if(!keys.Contains(key))throw new ArgumentException("未対応の設定項目です");
   var json=new JavaScriptSerializer();var o=json.Deserialize<Options>(json.Serialize(current));
   if(d.ContainsKey("ContinueOnUnknownNeeds"))o.ContinueOnUnknownNeeds=Bool(d,"ContinueOnUnknownNeeds");if(d.ContainsKey("FailureRecastMs"))o.FailureRecastMs=Int(d,"FailureRecastMs",200,3000);
   o.RodKey=2;o.FoodKey=Int(d,"FoodKey",0,9);o.DrinkKey=Int(d,"DrinkKey",0,9);o.ReserveGrams=Int(d,"ReserveGrams",0,20000);o.MinRecastMs=Int(d,"MinRecastMs",800,5000);o.GaugeRadius=Int(d,"GaugeRadius",12,44);
   o.AutoNeeds=Bool(d,"AutoNeeds");o.ObserveOnly=Bool(d,"ObserveOnly");o.BackgroundMode=Bool(d,"BackgroundMode");if(d.ContainsKey("AutoStorage"))o.AutoStorage=Bool(d,"AutoStorage");if(d.ContainsKey("HighAccuracy"))o.HighAccuracy=Bool(d,"HighAccuracy");if(d.ContainsKey("IncludeExistingCatch"))o.IncludeExistingCatch=Bool(d,"IncludeExistingCatch");if(d.ContainsKey("ShowOverlay"))o.ShowOverlay=Bool(d,"ShowOverlay");Validate(o);return o;
  }
  public static Options UpdateOverlay(Options current,Dictionary<string,object> d){
   var allowed=new HashSet<string>{"Overlay","ShowOverlay","AutoNudge","NudgeHoldMs"};if(d.Count!=4||d.Keys.Any(k=>!allowed.Contains(k)))throw new ArgumentException("表示設定の項目が不正です");
   var json=new JavaScriptSerializer();var o=json.Deserialize<Options>(json.Serialize(current));var fields=d["Overlay"] as Dictionary<string,object>;
   var flags=new HashSet<string>{"ShowSession","ShowHeldValue","ShowTrunkValue","ShowWeight","ShowNeeds","ShowStatus","ShowItems","ShowLifetime","ShowDiagnostics","ShowMovement"};
   if(fields==null||(fields.Count!=15&&fields.Count!=16))throw new ArgumentException("表示項目が不足しています");
   foreach(var field in fields){if(flags.Contains(field.Key)){if(!(field.Value is bool))throw new ArgumentException("表示項目はON/OFFで指定してください");}else if(field.Key=="Opacity"||field.Key=="Width"||field.Key=="FontSize"||field.Key=="MaxRows"){if(!(field.Value is int))throw new ArgumentException("表示サイズは整数で指定してください");}else if((field.Key!="Position"&&field.Key!="Theme")||!(field.Value is string))throw new ArgumentException("未対応の表示設定です");}
   o.Overlay=json.Deserialize<OverlayOptions>(json.Serialize(fields));o.ShowOverlay=Bool(d,"ShowOverlay");o.AutoNudge=Bool(d,"AutoNudge");o.NudgeHoldMs=Int(d,"NudgeHoldMs",100,700);Validate(o);return o;
  }
  static bool Bool(Dictionary<string,object>d,string k){if(!(d[k] is bool))throw new ArgumentException(k+" はON/OFFで指定してください");return (bool)d[k];}
  static int Int(Dictionary<string,object>d,string k,int lo,int hi){if(!(d[k] is int))throw new ArgumentException(k+" は整数で指定してください");int v=(int)d[k];if(v<lo||v>hi)throw new ArgumentException(k+" が範囲外です");return v;}
  public static void Validate(Options o){if(!Runtime064.ValidTheme(o.Theme)||o.FailureRecastMs<200||o.FailureRecastMs>3000)throw new ArgumentException("テーマ／失敗後待機時間が不正です");if(o.Overlay==null)o.Overlay=new OverlayOptions();o.Overlay.Validate();if(o.NudgeHoldMs<100||o.NudgeHoldMs>700)throw new ArgumentException("前進時間は100〜700msです");if(o.RodKey!=2||o.ReserveGrams<0||o.ReserveGrams>20000||o.MinRecastMs<800||o.MinRecastMs>5000||o.GaugeRadius<12||o.GaugeRadius>44)throw new ArgumentException("設定値が範囲外です");
   if(o.FoodKey<0||o.FoodKey>9||o.DrinkKey<0||o.DrinkKey>9)throw new ArgumentException("食料・飲料キーが範囲外です");
   if(o.AutoNeeds&&(o.FoodKey==2||o.DrinkKey==2))throw new ArgumentException("2番は釣り竿用です。食料・飲料には別のキーを設定してください");
   if(o.AutoNeeds&&o.BackgroundMode&&(o.FoodKey<1||o.FoodKey>5||o.DrinkKey<1||o.DrinkKey>5))throw new ArgumentException("裏画面の補給は登録ホットバー1〜5を使います");
  }
 }
 public sealed class MainForm:Form {
  const string Home="https://fishingpilot.local/index.html";
  readonly string root,smoke;FishPrice[] chart;readonly JavaScriptSerializer json=new JavaScriptSerializer();
  StatusOverlay overlay; WebView2 view;Engine engine;Options config;Status state=new Status();NotifyIcon tray;Label fallback;System.Windows.Forms.Timer timer;
  StorageView storageCandidate;StorageRegistration storageRegistration;bool setupBusy;CancellationTokenSource setupStop;
  bool ready,closing;int countdown,countdownTick;string feedback="",smokeRoot;public static int SmokeExit=1;
  public MainForm():this(null){}
  public MainForm(string smokePath) {
   smoke=smokePath;root=smoke==null?Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"FishingPilotPortable"):(smokeRoot=Path.Combine(Path.GetTempPath(),"FishingPilot-ui-"+Guid.NewGuid().ToString("N")));
   Text="釣りアシスト "+Program.Version;ClientSize=new Size(1160,820);MinimumSize=new Size(600,580);StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(242,242,247);Font=new Font("Yu Gothic UI",11);
   Directory.CreateDirectory(root);chart=new PriceCatalog(root).Entries;config=new Options{ObserveOnly=true};string cfg=Path.Combine(root,"settings.json");
   if(File.Exists(cfg))try{config=json.Deserialize<Options>(File.ReadAllText(cfg))??config;UiCommands.Validate(config);}catch{feedback="設定ファイルを確認してください。開始前に設定の保存が必要です";config=new Options{ObserveOnly=true};}
   string registrationFile=Path.Combine(root,"storage-registration.json");if(File.Exists(registrationFile))try{storageRegistration=json.Deserialize<StorageRegistration>(File.ReadAllText(registrationFile));storageRegistration.Validate();}catch{feedback="荷台の登録情報を確認してください";storageRegistration=null;}
   engine=new Engine(root,Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"digit-templates.json"));engine.Changed+=OnState;engine.Alert+=OnAlert;overlay=new StatusOverlay();overlay.Configure(config.Overlay,config.Theme);
   fallback=new Label{Dock=DockStyle.Fill,Text="釣りアシストを起動しています…",TextAlign=ContentAlignment.MiddleCenter};Controls.Add(fallback);
   tray=new NotifyIcon{Icon=SystemIcons.Information,Text="釣りアシスト",Visible=smoke==null};var menu=new ContextMenuStrip();menu.Items.Add("表示",null,delegate{Show();WindowState=FormWindowState.Normal;Activate();});menu.Items.Add("停止（F6）",null,delegate{StopNow();});menu.Items.Add("診断ZIPを保存",null,delegate{TryAction(Export);});menu.Items.Add("終了",null,delegate{Close();});tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate{Show();WindowState=FormWindowState.Normal;Activate();};
   timer=new System.Windows.Forms.Timer{Interval=500};timer.Tick+=async delegate{if(countdown>0&&++countdownTick%2==0){countdown--;if(countdown==0)TryAction(StartNow);}if(smoke==null&&countdown==0&&!setupBusy&&!engine.Busy)await engine.RefreshIdleInventory();Push();};timer.Start();
   Shown+=async delegate {if(smoke==null){bool a=Native.RegisterHotKey(Handle,1,0x4000,InputPolicy.StartKey),b=Native.RegisterHotKey(Handle,2,0x4000,InputPolicy.StopKey);Native.RegisterHotKey(Handle,3,0x4003,0x75);Native.RegisterHotKey(Handle,4,0x4003,0x76);engine.Log("hotkeys_registered","F5="+a+" F6="+b);if(!a||!b){feedback="F5/F6が他アプリと競合しています。旧採掘機・旧FishingPilotを終了してください";tray.ShowBalloonTip(6000,"釣りアシスト",feedback,ToolTipIcon.Warning);}}await Initialize();};
   FormClosing+=delegate {closing=true;countdown=0;if(setupStop!=null)setupStop.Cancel();timer.Stop();overlay.Dispose();engine.Dispose();for(int i=1;i<=4;i++)Native.UnregisterHotKey(Handle,i);tray.Visible=false;tray.Dispose();};
  }
  async Task Initialize(){try{
   view=new WebView2{Dock=DockStyle.Fill,DefaultBackgroundColor=BackColor};Controls.Add(view);view.BringToFront();
   var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(root,"webview"));await view.EnsureCoreWebView2Async(env);
   var core=view.CoreWebView2;core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;
   core.SetVirtualHostNameToFolderMapping("fishingpilot.local",Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"ui"),CoreWebView2HostResourceAccessKind.Deny);
   core.NavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){if(e.Uri!=Home)e.Cancel=true;};
   core.NewWindowRequested+=delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e){e.Handled=true;};
   core.PermissionRequested+=delegate(object sender,CoreWebView2PermissionRequestedEventArgs e){e.State=CoreWebView2PermissionState.Deny;};
   core.DownloadStarting+=delegate(object sender,CoreWebView2DownloadStartingEventArgs e){e.Cancel=true;};
   core.WebMessageReceived+=delegate(object sender,CoreWebView2WebMessageReceivedEventArgs e){if(e.Source!=Home||closing)return;TryAction(delegate{HandleMessage(UiCommands.Parse(e.WebMessageAsJson));});};
   core.ProcessFailed+=delegate{engine.Stop();ready=false;fallback.Text="画面プロセスが終了したため自動操作を停止しました。アプリを起動し直してください";fallback.BringToFront();};
   core.Navigate(Home);
   if(smoke!=null){var sw=Stopwatch.StartNew();while(!ready&&sw.ElapsedMilliseconds<20000)await Task.Delay(60);if(!ready)throw new Exception("Web UI did not acknowledge ready");
    await Task.Delay(350);Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(smoke)));
    var result=await core.ExecuteScriptAsync("JSON.stringify({framework:!!window.fishingApp,theme:window.fishingApp&&window.fishingApp.theme,sidebar:document.querySelectorAll('[data-page]').length,actions:!!document.getElementById('start'),version:document.getElementById('version').textContent})");
    File.WriteAllText(Path.ChangeExtension(smoke,".json"),result);if(!result.Contains("ios")||!result.Contains(Program.Version))throw new Exception("Theme or native state handshake failed");
    using(var output=File.Create(smoke))await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,output);
    await core.ExecuteScriptAsync("document.getElementById('AppTheme').value='light';document.getElementById('OverlayTheme').value='dark';document.getElementById('theme-form').requestSubmit()");
    var themeWait=Stopwatch.StartNew();while(config.Theme!="light"&&themeWait.ElapsedMilliseconds<3000)await Task.Delay(50);
    if(config.Theme!="light"||config.Overlay.Theme!="dark")throw new Exception("Native theme save did not apply");
    var stored=json.Deserialize<Options>(File.ReadAllText(Path.Combine(root,"settings.json")));if(stored.Theme!="light"||stored.Overlay.Theme!="dark")throw new Exception("Theme settings were not persisted");
    await Task.Delay(200);using(var output=File.Create(Path.Combine(Path.GetDirectoryName(smoke),"ui-light.png")))await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,output);
    await core.ExecuteScriptAsync("document.getElementById('AppTheme').value='dark';document.getElementById('theme-form').requestSubmit()");
    themeWait.Restart();while(config.Theme!="dark"&&themeWait.ElapsedMilliseconds<3000)await Task.Delay(50);
    if(config.Theme!="dark")throw new Exception("Native theme switch back did not apply");
    await Task.Delay(200);using(var output=File.Create(Path.Combine(Path.GetDirectoryName(smoke),"ui-dark.png")))await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,output);
    File.WriteAllText(Path.Combine(Path.GetDirectoryName(smoke),"theme-native.json"),"{\"pass\":true,\"light_and_dark_webview_rendered\":true,\"independent_overlay_theme_persisted\":true}");
    SmokeExit=0;Close();}
   }catch(Exception e){engine.Stop();fallback.Text="画面を開始できませんでした。ZIPを一式展開して起動してください。\nWebView2 Runtime が必要です。\n"+e.Message;fallback.BringToFront();if(smoke!=null){File.WriteAllText(smoke+".error.txt",e.ToString());SmokeExit=1;Close();}}
  }
  void HandleMessage(Dictionary<string,object> m){string action=(string)m["action"];
   if(action=="ready"){ready=true;ApplyTheme();Push();return;}
   if(action=="theme.save"){var d=(Dictionary<string,object>)m["settings"];if(d.Count!=2||!d.ContainsKey("Theme")||!d.ContainsKey("OverlayTheme")||!(d["Theme"] is string)||!(d["OverlayTheme"] is string)||!Runtime064.ValidTheme((string)d["Theme"])||!Runtime064.ValidTheme((string)d["OverlayTheme"],true))throw new ArgumentException("テーマが不正です");var o=json.Deserialize<Options>(json.Serialize(config));o.Theme=(string)d["Theme"];o.Overlay.Theme=(string)d["OverlayTheme"];Save(o);config=o;ApplyTheme();feedback="テーマを保存しました";Push();return;}if(action=="stop"){StopNow();return;}
   if(action=="start"){EnsureIdle();UiCommands.Validate(config);countdown=3;feedback="3秒以内にFiveMへ戻ってください";Push();return;}
   if(action=="storage.inspect"||action=="storage.register"){EnsureIdle();StorageSetup(action=="storage.register",action=="storage.register"?((object[])m["items"]).Cast<string>().ToArray():new string[0]);return;}
   if(action=="overlay.save"){var o=UiCommands.UpdateOverlay(config,(Dictionary<string,object>)m["settings"]);Save(o);config=o;engine.ConfigureLive(o);overlay.Configure(o.Overlay,o.Theme);overlay.UpdateState(state,engine.TargetWindow,o.ShowOverlay);feedback="オーバーレイ設定を保存しました";Push();return;}
   if(action=="price.map"){EnsureIdle();var d=(Dictionary<string,object>)m["settings"];if(d.Count!=2||!d.ContainsKey("Name")||!d.ContainsKey("Label")||!(d["Name"] is string)||!(d["Label"] is string)||!StorageRegistration.ValidItem((string)d["Name"]))throw new ArgumentException("品名の対応付けが不正です");
    var catalog=new PriceCatalog(root);string name=(string)d["Name"],label=(string)d["Label"];if(!catalog.Entries.Any(x=>x.Label==label))throw new ArgumentException("価格表から魚を選択してください");string path=Path.Combine(root,"price-aliases.json");var map=File.Exists(path)?json.Deserialize<Dictionary<string,string>>(File.ReadAllText(path)):new Dictionary<string,string>();map[name]=label;string temp=path+".tmp";File.WriteAllText(temp,json.Serialize(map));if(File.Exists(path))File.Replace(temp,path,path+".bak");else File.Move(temp,path);engine.ReloadPrices();feedback="単価の対応を保存しました";Push();return;}
   EnsureIdle();if(action=="save"){var replacement=UiCommands.Update(config,(Dictionary<string,object>)m["settings"]);Save(replacement);config=replacement;feedback="設定を保存しました";}
   else if(action=="calibration.reset"){var replacement=json.Deserialize<Options>(json.Serialize(config));replacement.FoodX=replacement.FoodY=replacement.WaterX=replacement.WaterY=-1;Save(replacement);config=replacement;feedback="ゲージ位置を自動検出に戻しました";}
   else if(action=="logs.open")Process.Start(new ProcessStartInfo(root){UseShellExecute=true});
   else if(action=="diagnostics.export")Export();Push();
  }
  object StorageState(){
   var rows=storageCandidate!=null&&storageCandidate.Left.Known?StorageRow.Parse(storageCandidate.LeftSpec):new List<StorageRow>();
   var hotbar=new HashSet<string>(rows.Where(x=>x.Slot<=5).Select(x=>x.Name),StringComparer.Ordinal);
   var candidates=rows.Where(x=>x.Slot>5&&!hotbar.Contains(x.Name)&&!x.Name.StartsWith("WEAPON_",StringComparison.OrdinalIgnoreCase)).GroupBy(x=>x.Name).Select(g=>new{name=g.Key,count=g.Sum(x=>(long)x.Count)}).ToArray();
   return new{registered=storageRegistration!=null,id=storageRegistration==null?"":storageRegistration.Id,label=storageRegistration==null?"未登録":storageRegistration.Label,
    candidateId=storageCandidate==null?"":storageCandidate.Id,candidateLabel=storageCandidate==null?"":storageCandidate.Label,candidates=candidates,selected=storageRegistration==null?new string[0]:storageRegistration.Items};
  }
  async void StorageSetup(bool register,string[] items){
   setupBusy=true;setupStop=new CancellationTokenSource(TimeSpan.FromSeconds(12));feedback="開いている荷台と所持品を確認しています";Push();
   try{
    var view=await NearbyStorageService.Inspect(setupStop.Token);setupStop.Token.ThrowIfCancellationRequested();
    if(!view.Open||view.Type!="trunk"||!view.Left.Known||!view.Right.Known)throw new InvalidOperationException("ゲームで登録したい荷台を開いたまま、このボタンを押してください");
    if(!register){storageCandidate=view;feedback="荷台を読み取りました。収納する魚だけにチェックしてください";}
    else{
     if(storageCandidate==null||view.Id!=storageCandidate.Id||view.Epoch!=storageCandidate.Epoch||view.PlayerId!=storageCandidate.PlayerId)throw new InvalidOperationException("荷台が変わりました。もう一度読み込んでください");
     var rows=StorageRow.Parse(view.LeftSpec);var protectedNames=new HashSet<string>(rows.Where(x=>x.Slot<=5).Select(x=>x.Name),StringComparer.Ordinal);
     if(items.Distinct(StringComparer.Ordinal).Count()!=items.Length||items.Any(n=>protectedNames.Contains(n)||n.StartsWith("WEAPON_",StringComparison.OrdinalIgnoreCase)||!rows.Any(x=>x.Slot>5&&x.Name==n)))throw new InvalidOperationException("魚をホットバー以外に置き、収納対象を選び直してください");
     var reg=new StorageRegistration{Id=view.Id,Type=view.Type,Epoch=view.Epoch,PlayerId=view.PlayerId,Label=view.Label,Items=items};reg.Validate();
     string p=Path.Combine(root,"storage-registration.json"),tmp=p+".tmp";File.WriteAllText(tmp,json.Serialize(reg));if(File.Exists(p))File.Replace(tmp,p,p+".bak");else File.Move(tmp,p);storageRegistration=reg;
     var o=json.Deserialize<Options>(json.Serialize(config));o.AutoStorage=true;Save(o);config=o;
     feedback="荷台と釣果を登録し、自動収納をONにしました。ゲームで荷台を閉じてF5で開始してください";
     engine.Log("storage_registered","trunk_verified=1 allowed_item_types="+items.Length+" read_only_setup=1");
    }
   }catch(OperationCanceledException){feedback="荷台の確認を中止しました";}
   catch(Exception e){feedback=e.Message;engine.Log("storage_setup_error",e.GetType().Name+" "+e.Message);}
   finally{setupBusy=false;setupStop.Dispose();setupStop=null;if(!closing)Push();}
  }
  void EnsureIdle(){if(countdown>0||engine.Busy||setupBusy)throw new InvalidOperationException("停止処理を完了してから操作してください");}
  void Save(Options o){UiCommands.Validate(o);string p=Path.Combine(root,"settings.json"),tmp=p+".tmp";File.WriteAllText(tmp,json.Serialize(o));if(File.Exists(p))File.Replace(tmp,p,p+".bak");else File.Move(tmp,p);}
  void StartNow(){engine.Log("start_requested","source=F5_or_button observe_only="+config.ObserveOnly+" background="+config.BackgroundMode);countdown=0;EnsureIdle();UiCommands.Validate(config);Save(config);engine.Start(json.Deserialize<Options>(json.Serialize(config)));state.Running=true;feedback="";Push();}
  void StopNow(){countdown=0;if(setupStop!=null)setupStop.Cancel();engine.Stop();state.Running=false;state.Phase="停止処理中";feedback="停止を要求しました";Push();}
  void TryAction(Action a){try{a();}catch(Exception e){feedback=e.Message;engine.Log("ui_error",e.GetType().Name+": "+e.Message);if(!engine.Running){state.Phase="開始できませんでした";state.Detail=e.Message;overlay.Configure(config.Overlay,config.Theme);overlay.UpdateState(state,Native.FindFishingWindow(),config.ShowOverlay);}try{tray.ShowBalloonTip(6000,"釣りアシスト",e.Message,ToolTipIcon.Warning);}catch{}Push();}}
  void OnState(Status s){if(closing||IsDisposed)return;try{BeginInvoke((Action)delegate{if(engine.Running&&!s.Running)return;state=s;overlay.Configure(config.Overlay,config.Theme);overlay.UpdateState(s,engine.TargetWindow,config.ShowOverlay);Push();});}catch(InvalidOperationException){}}
  void ApplyTheme(){bool dark=Runtime064.Dark(config.Theme);BackColor=dark?Color.FromArgb(18,18,22):Color.FromArgb(242,242,247);if(fallback!=null){fallback.BackColor=BackColor;fallback.ForeColor=dark?Color.White:Color.Black;}overlay.Configure(config.Overlay,config.Theme);if(view!=null){view.DefaultBackgroundColor=BackColor;if(view.CoreWebView2!=null)view.CoreWebView2.Profile.PreferredColorScheme=config.Theme=="system"?CoreWebView2PreferredColorScheme.Auto:dark?CoreWebView2PreferredColorScheme.Dark:CoreWebView2PreferredColorScheme.Light;}}
  void Push(){if(!ready||closing||view==null||view.CoreWebView2==null)return;try{view.CoreWebView2.PostWebMessageAsJson(json.Serialize(new{type="state",version=Program.Version,status=state,settings=config,busy=engine.Busy||countdown>0||setupBusy,countdown=countdown,feedback=feedback,storage=StorageState(),prices=chart}));}catch{}}
  void OnAlert(string text){if(closing)return;try{BeginInvoke((Action)delegate{tray.ShowBalloonTip(8000,"釣りアシスト",text,ToolTipIcon.Warning);System.Media.SystemSounds.Exclamation.Play();});}catch{}Task.Run(delegate{object voice=null;try{var type=Type.GetTypeFromProgID("SAPI.SpVoice");voice=Activator.CreateInstance(type);type.InvokeMember("Speak",BindingFlags.InvokeMethod,null,voice,new object[]{text,0});}catch{}finally{if(voice!=null)try{System.Runtime.InteropServices.Marshal.FinalReleaseComObject(voice);}catch{}}});}
  void Export(){EnsureIdle();engine.FlushLogs();using(var dialog=new SaveFileDialog{Filter="ZIP|*.zip",FileName="FishingPilot-diagnostics-"+DateTime.Now.ToString("yyyyMMdd-HHmmss")+".zip",OverwritePrompt=true}){if(dialog.ShowDialog(this)!=DialogResult.OK)return;string tmp=dialog.FileName+".tmp-"+Guid.NewGuid().ToString("N");try{using(var zip=ZipFile.Open(tmp,ZipArchiveMode.Create)){foreach(string file in Directory.GetFiles(root)){string name=Path.GetFileName(file);if(name=="settings.json"||name=="events.jsonl"||name=="events.jsonl.1"||name=="storage-registration.json"||name=="storage-pending.json"||name=="storage-pending.json.bak"||name=="storage-receipts.jsonl"||name=="storage-receipts.jsonl.1"||name=="catch-history.json"||name=="price-aliases.json")zip.CreateEntryFromFile(file,name);}var entry=zip.CreateEntry("build.json");using(var writer=new StreamWriter(entry.Open()))writer.Write(json.Serialize(new{version=Program.Version,exported=DateTime.UtcNow.ToString("o"),live_game_verified=false}));}if(File.Exists(dialog.FileName))File.Replace(tmp,dialog.FileName,null);else File.Move(tmp,dialog.FileName);}finally{if(File.Exists(tmp))File.Delete(tmp);}feedback="診断ZIPを保存しました。中身を確認してチャットへ添付してください";}}
  protected override void WndProc(ref Message m){if(m.Msg==0x0312){int id=m.WParam.ToInt32();if(id==1){engine.Log("hotkey_received","key=F5 busy="+engine.Busy+" countdown="+countdown);if(!engine.Busy&&countdown==0)TryAction(StartNow);}else if(id==2)StopNow();else if((id==3||id==4)&&!engine.Busy&&countdown==0)TryAction(delegate{IntPtr h=Native.FishingWindow();if(h==IntPtr.Zero)return;var c=Native.Client(h);Point p=Cursor.Position;if(!c.Contains(p))return;var o=json.Deserialize<Options>(json.Serialize(config));double x=(p.X-c.X)/(double)c.Width,y=(p.Y-c.Y)/(double)c.Height;if(id==3){o.FoodX=x;o.FoodY=y;}else{o.WaterX=x;o.WaterY=y;}Save(o);config=o;feedback=id==3?"空腹ゲージの位置を登録しました":"水分ゲージの位置を登録しました";Push();});}base.WndProc(ref m);}
 }
}
