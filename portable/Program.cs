using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
namespace FishingPilot {
 static class Program {
  [STAThread]static int Main(string[] args) {
   Native.SetProcessDPIAware();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   if(args.Length>0&&args[0]=="--self-test")return Tests.Run(args.Length>1?args[1]:"test-evidence");
   if(args.Length>0&&args[0]=="--ui-smoke") {using(var f=new MainForm()){f.Show();Application.DoEvents();using(var b=new Bitmap(f.Width,f.Height)){f.DrawToBitmap(b,new Rectangle(Point.Empty,b.Size));b.Save(args[1]);}f.Close();}return 0;}
   bool created;using(var mutex=new Mutex(true,"Local\\FishingPilotPortablePreview",out created)){if(!created){MessageBox.Show("釣りアシストは既に起動しています。");return 1;}Application.Run(new MainForm());}return 0;
  }
 }
 public sealed class MainForm:Form {
  readonly string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"FishingPilotPortable");
  Engine engine;Options config;Label phase,detail,numbers,ring,meters;CheckBox observe,needs;NumericUpDown food,drink,reserve,radius;
  Button start,stop,save;NotifyIcon tray;bool closing;int countdown;System.Windows.Forms.Timer timer;
  public MainForm(){
   Text="釣りアシスト 0.1.0-preview";Width=840;Height=800;MinimumSize=new Size(660,640);StartPosition=FormStartPosition.CenterScreen;Font=new Font("Yu Gothic UI",11);BackColor=Color.FromArgb(242,244,248);
   Directory.CreateDirectory(root);config=new Options{ObserveOnly=true};string cfg=Path.Combine(root,"settings.json");try{if(File.Exists(cfg))config=new JavaScriptSerializer().Deserialize<Options>(File.ReadAllText(cfg));}catch{}
   engine=new Engine(root,Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"digit-templates.json"));engine.Changed+=OnState;engine.Alert+=OnAlert;
   var flow=new FlowLayoutPanel{Dock=DockStyle.Fill,AutoScroll=true,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new Padding(24)};Controls.Add(flow);
   flow.Controls.Add(new Label{Text="釣りアシスト",Font=new Font(Font.FontFamily,24,FontStyle.Bold),AutoSize=true,Margin=new Padding(0,0,0,10)});
   flow.Controls.Add(new Label{Text="2で投竿 → 数字を判定 → 追加判定を待つ → 結果を確認して再投入",AutoSize=true,MaximumSize=new Size(740,0)});
   phase=new Label{Text="停止中",AutoSize=true,Font=new Font(Font.FontFamily,18,FontStyle.Bold),Margin=new Padding(0,22,0,4)};flow.Controls.Add(phase);
   detail=new Label{Text="初回は観察テストで数字・円の認識を確認してください。",AutoSize=true,MaximumSize=new Size(740,0)};flow.Controls.Add(detail);
   ring=new Label{Text="円：未確認",AutoSize=true,MaximumSize=new Size(740,0),Margin=new Padding(0,14,0,6)};flow.Controls.Add(ring);
   meters=new Label{Text="重量：未確認   空腹：未確認   水分：未確認",AutoSize=true,MaximumSize=new Size(740,0)};flow.Controls.Add(meters);
   numbers=new Label{Text="投竿 0    判定入力 0    取得確認 0",AutoSize=true,Margin=new Padding(0,12,0,12)};flow.Controls.Add(numbers);
   observe=new CheckBox{Text="観察テスト（キーを押さず、認識・入力候補だけ記録）",AutoSize=true,Checked=config.ObserveOnly};flow.Controls.Add(observe);
   needs=new CheckBox{Text="空腹・水分が50%以下のとき自動補給（読めないときは待機）",AutoSize=true,Checked=config.AutoNeeds};flow.Controls.Add(needs);
   var row=new FlowLayoutPanel{AutoSize=true,WrapContents=true,MaximumSize=new Size(740,0)};
   row.Controls.Add(new Label{Text="食料キー",AutoSize=true});food=Num(0,9,config.FoodKey);row.Controls.Add(food);
   row.Controls.Add(new Label{Text="飲料キー",AutoSize=true});drink=Num(0,9,config.DrinkKey);row.Controls.Add(drink);
   row.Controls.Add(new Label{Text="空き余裕(g)",AutoSize=true});reserve=Num(0,20000,config.ReserveGrams);reserve.Width=90;row.Controls.Add(reserve);flow.Controls.Add(row);
   flow.Controls.Add(new Label{AutoSize=true,MaximumSize=new Size(740,0),Text="竿は2固定。食料と飲料が同じ品なら同じキーに設定できます。\n旧採掘ツールは終了してから使ってください。FiveMは前面のままにします。",Margin=new Padding(0,8,0,16)});
   var buttons=new FlowLayoutPanel{AutoSize=true};start=Button("3秒後に開始 / F8",delegate{Save();countdown=3;timer.Start();start.Enabled=false;phase.Text="3秒以内にFiveMへ戻ってください";});stop=Button("停止 / F9",delegate{countdown=0;timer.Stop();engine.Stop();start.Enabled=true;phase.Text="停止中";});buttons.Controls.Add(start);buttons.Controls.Add(stop);flow.Controls.Add(buttons);
   flow.Controls.Add(new Label{Text="ゲージの位置が自動で見つからないとき",AutoSize=true,Font=new Font(Font,FontStyle.Bold),Margin=new Padding(0,18,0,6)});
   flow.Controls.Add(new Label{Text="停止中に、ゲーム内の空腹アイコン中心へマウスを合わせ Ctrl+Alt+F6。\n水分アイコン中心では Ctrl+Alt+F7。円の外周半径も合わせてください。",AutoSize=true,MaximumSize=new Size(740,0)});
   var calibrate=new FlowLayoutPanel{AutoSize=true};calibrate.Controls.Add(new Label{Text="ゲージ半径(px)",AutoSize=true});radius=Num(12,44,(decimal)config.GaugeRadius);calibrate.Controls.Add(radius);calibrate.Controls.Add(Button("位置を自動検出に戻す",delegate{if(engine.Running)return;config.FoodX=config.FoodY=config.WaterX=config.WaterY=-1;Save();detail.Text="次回開始時に再検出します";}));flow.Controls.Add(calibrate);
   var logs=new FlowLayoutPanel{AutoSize=true};save=Button("設定を保存",delegate{Save();detail.Text="設定を保存しました";});logs.Controls.Add(save);logs.Controls.Add(Button("診断ZIPを保存",Export));logs.Controls.Add(Button("ログフォルダー",delegate{Process.Start(root);}));flow.Controls.Add(logs);
   flow.Controls.Add(new Label{AutoSize=true,MaximumSize=new Size(740,0),ForeColor=Color.DimGray,Text="試用版：実FiveMの連続成功率は未検証。自動収納・座標移動はありません。\n満杯・補給未確認・接続変更・釣果未確認では入力を止めます。ログは自動送信しません。",Margin=new Padding(0,14,0,0)});
   tray=new NotifyIcon{Icon=SystemIcons.Information,Text="釣りアシスト",Visible=true};tray.DoubleClick+=delegate{Show();WindowState=FormWindowState.Normal;Activate();};
   timer=new System.Windows.Forms.Timer{Interval=1000};timer.Tick+=delegate{if(--countdown<=0){timer.Stop();StartNow();}else phase.Text=countdown+"秒以内にFiveMへ戻ってください";};
   Shown+=delegate{bool a=Native.RegisterHotKey(Handle,1,0x4000,0x77),b=Native.RegisterHotKey(Handle,2,0x4000,0x78);Native.RegisterHotKey(Handle,3,0x4003,0x75);Native.RegisterHotKey(Handle,4,0x4003,0x76);if(!a||!b)detail.Text="F8/F9が他アプリと競合しています。旧採掘ツールを終了し、このツールを再起動してください。画面ボタンは使えます。";};
   FormClosing+=delegate{closing=true;timer.Stop();engine.Dispose();for(int i=1;i<=4;i++)Native.UnregisterHotKey(Handle,i);tray.Visible=false;tray.Dispose();};
  }
  NumericUpDown Num(int min,int max,decimal v){return new NumericUpDown{Minimum=min,Maximum=max,Value=Math.Max(min,Math.Min(max,v)),Width=62};}
  Button Button(string text,Action action){var b=new Button{Text=text,AutoSize=true,Height=42,Padding=new Padding(10,6,10,6),Margin=new Padding(0,4,10,4)};b.Click+=delegate{try{action();}catch(Exception e){MessageBox.Show(e.Message,"釣りアシスト");}};return b;}
  void Save(){if(engine.Running)throw new InvalidOperationException("設定変更はF9で停止してから行ってください");config.FoodKey=(int)food.Value;config.DrinkKey=(int)drink.Value;config.ReserveGrams=(int)reserve.Value;config.AutoNeeds=needs.Checked;config.ObserveOnly=observe.Checked;config.GaugeRadius=(double)radius.Value;string p=Path.Combine(root,"settings.json"),tmp=p+".tmp";File.WriteAllText(tmp,new JavaScriptSerializer().Serialize(config));if(File.Exists(p))File.Replace(tmp,p,p+".bak");else File.Move(tmp,p);}
  void StartNow(){try{Save();if(config.AutoNeeds&&(config.FoodKey==2||config.DrinkKey==2))throw new InvalidOperationException("食料・飲料キーに2は使えません。2には釣り竿をセットしてください");engine.Start(config);start.Enabled=false;}catch(Exception e){start.Enabled=true;phase.Text="開始できませんでした";detail.Text=e.Message;}}
  void OnState(Status s){if(closing||IsDisposed)return;try{BeginInvoke((Action)delegate{phase.Text=s.Phase;detail.Text=s.Detail;ring.Text=s.Ring;meters.Text="重量 "+s.Inventory+"    空腹 "+s.Hunger+"    水分 "+s.Thirst;numbers.Text="投竿 "+s.Casts+"    判定入力 "+s.Keys+"    取得確認 "+s.Results;start.Enabled=!s.Running;save.Enabled=food.Enabled=drink.Enabled=reserve.Enabled=observe.Enabled=needs.Enabled=radius.Enabled=!s.Running;});}catch(InvalidOperationException){}}
  void OnAlert(string text){if(closing)return;try{BeginInvoke((Action)delegate{tray.ShowBalloonTip(8000,"釣りアシスト",text,ToolTipIcon.Warning);System.Media.SystemSounds.Exclamation.Play();});}catch{}Task.Run(delegate{try{Type type=Type.GetTypeFromProgID("SAPI.SpVoice");object voice=Activator.CreateInstance(type);type.InvokeMember("Speak",BindingFlags.InvokeMethod,null,voice,new object[]{text,0});MarshalRelease(voice);}catch{}});}
  static void MarshalRelease(object o){try{System.Runtime.InteropServices.Marshal.FinalReleaseComObject(o);}catch{}}
  void Export(){if(engine.Running)throw new InvalidOperationException("F9で停止してから診断ZIPを保存してください");using(var d=new SaveFileDialog{Filter="ZIP|*.zip",FileName="FishingPilot-diagnostics-"+DateTime.Now.ToString("yyyyMMdd-HHmmss")+".zip"}){if(d.ShowDialog()!=DialogResult.OK)return;using(var a=ZipFile.Open(d.FileName,ZipArchiveMode.Create)){foreach(string f in Directory.GetFiles(root)){if(Path.GetFileName(f).StartsWith("events.jsonl")||Path.GetFileName(f)=="settings.json")a.CreateEntryFromFile(f,Path.GetFileName(f));}}detail.Text="診断ZIPを保存しました。内容を確認してこのチャットへ添付してください";}}
  protected override void WndProc(ref Message m){if(m.Msg==0x0312){int id=m.WParam.ToInt32();if(id==1&&!engine.Running){StartNow();}else if(id==2){timer.Stop();countdown=0;engine.Stop();start.Enabled=true;}else if((id==3||id==4)&&!engine.Running){IntPtr h=Native.FishingWindow();if(h!=IntPtr.Zero){Rectangle c=Native.Client(h);Point p=Cursor.Position;if(c.Contains(p)){double x=(p.X-c.X)/(double)c.Width,y=(p.Y-c.Y)/(double)c.Height;if(id==3){config.FoodX=x;config.FoodY=y;}else{config.WaterX=x;config.WaterY=y;}Save();tray.ShowBalloonTip(2500,"ゲージ位置を保存",id==3?"空腹の位置を保存しました":"水分の位置を保存しました",ToolTipIcon.Info);}}}}base.WndProc(ref m);}
 }
}
