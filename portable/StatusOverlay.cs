using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;
namespace FishingPilot {
 // Native, per-pixel alpha panel: translucent background, opaque text, click-through.
 public sealed class StatusOverlay:Form {
  Status status=new Status();IntPtr game;bool enabled=true;readonly Timer follow;OverlayOptions settings=new OverlayOptions();bool rendering;
  [StructLayout(LayoutKind.Sequential)]struct POINT{public int X,Y;public POINT(int x,int y){X=x;Y=y;}}
  [StructLayout(LayoutKind.Sequential)]struct SIZE{public int W,H;public SIZE(int w,int h){W=w;H=h;}}
  [StructLayout(LayoutKind.Sequential,Pack=1)]struct BLEND{public byte Op,Flags,Alpha,Format;}
  [DllImport("user32.dll")]static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")]static extern bool SetWindowDisplayAffinity(IntPtr hwnd,uint flags);
  [DllImport("user32.dll")]static extern IntPtr GetDC(IntPtr h);
  [DllImport("user32.dll")]static extern int ReleaseDC(IntPtr h,IntPtr dc);
  [DllImport("gdi32.dll")]static extern IntPtr CreateCompatibleDC(IntPtr h);
  [DllImport("gdi32.dll")]static extern bool DeleteDC(IntPtr h);
  [DllImport("gdi32.dll")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
  [DllImport("gdi32.dll")]static extern bool DeleteObject(IntPtr obj);
  [DllImport("user32.dll",SetLastError=true)]static extern bool UpdateLayeredWindow(IntPtr h,IntPtr dst,ref POINT pos,ref SIZE size,IntPtr src,ref POINT origin,int key,ref BLEND blend,int flags);
  protected override bool ShowWithoutActivation{get{return true;}}
  protected override CreateParams CreateParams{get{var p=base.CreateParams;p.ExStyle|=0x08000000|0x20|0x80|0x80000;return p;}}
  public StatusOverlay(){FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;ClientSize=new Size(360,260);Font=new Font("Yu Gothic UI",10);follow=new Timer{Interval=200};follow.Tick+=delegate{Follow();};follow.Start();}
  public void Configure(OverlayOptions o){if(Object.ReferenceEquals(o,settings))return;settings=o??new OverlayOptions();settings.Validate();Follow();Render();}
  public void UpdateState(Status s,IntPtr hwnd,bool show){status=s??new Status();game=hwnd;enabled=show;Follow();Render();}
  int DesiredHeight(){int line=settings.FontSize+18;return 45+(settings.ShowSession?92:0)+(settings.ShowHeldValue?line:0)+(settings.ShowTrunkValue?line+22:0)+(settings.ShowWeight?line:0)+(settings.ShowNeeds?line:0)+(settings.ShowStatus?line:0)+(settings.ShowMovement?line:0)+(settings.ShowLifetime?line:0)+(settings.ShowDiagnostics?line*2:0)+(settings.ShowItems?Math.Min(settings.MaxRows,(status.Live.HeldValue.Items??new ItemDisplay[0]).Length)*line:0);}
  void Follow(){if(!enabled||game==IntPtr.Zero||!Native.IsWindow(game)||IsIconic(game)||Native.GetForegroundWindow()!=game){if(Visible)Hide();return;}
   var c=Native.Client(game);if(c.Width<300||c.Height<240){if(Visible)Hide();return;}
   int w=Math.Min(settings.Width,c.Width-24),h=Math.Min(DesiredHeight(),c.Height-24);
   int x=settings.Position.EndsWith("right",StringComparison.Ordinal)?c.Right-w-12:c.Left+12;
   int y=settings.Position.StartsWith("bottom",StringComparison.Ordinal)?c.Bottom-h-12:c.Top+12;
   var rect=new Rectangle(x,y,w,h);bool changed=Bounds!=rect;Bounds=rect;if(!Visible){Show();changed=true;}if(changed)Render();
  }
  protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);try{SetWindowDisplayAffinity(Handle,0x11);}catch{}}
  protected override void WndProc(ref Message m){if(m.Msg==0x0084){m.Result=new IntPtr(-1);return;}if(m.Msg==0x0021){m.Result=new IntPtr(3);return;}base.WndProc(ref m);}
  static GraphicsPath Rounded(float x,float y,float width,float height,float radius){var p=new GraphicsPath();float d=radius*2;p.AddArc(x,y,d,d,180,90);p.AddArc(x+width-d,y,d,d,270,90);p.AddArc(x+width-d,y+height-d,d,d,0,90);p.AddArc(x,y+height-d,d,d,90,90);p.CloseFigure();return p;}
  static string Money(Valuation v){return v!=null&&v.Known?"¥"+v.Total.ToString("N0")+(v.UnknownKinds>0?" + 未登録"+v.UnknownKinds+"種":""):"未確認";}
  void DrawPanel(Graphics g,int width,int height){
   g.SmoothingMode=SmoothingMode.AntiAlias;g.TextRenderingHint=System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
   using(var path=Rounded(1,1,width-2,height-2,18))using(var bg=new SolidBrush(Color.FromArgb(settings.Opacity*255/100,247,249,252)))using(var border=new Pen(Color.FromArgb(150,255,255,255))) {g.FillPath(bg,path);g.DrawPath(border,path);}
   int y=14;var live=status.Live??new LivePanel();
   DrawText(g,"FISHING   ·   F5 / F6",9,FontStyle.Bold,Color.FromArgb(103,112,128),ref y,23,width);
   if(settings.ShowSession){DrawText(g,"今回の釣果 · 売却見込",settings.FontSize,FontStyle.Regular,Color.FromArgb(92,101,119),ref y,22,width);
    DrawText(g,live.SessionValue.Known?"¥"+live.SessionValue.Total.ToString("N0"):"¥0",27,FontStyle.Bold,Color.FromArgb(0,112,235),ref y,45,width);
    DrawText(g,live.SessionValue.UnknownKinds>0?"単価未登録 "+live.SessionValue.UnknownKinds+"種（合計には未算入）":"開始前の所持分・収納による移動は含めません",9,FontStyle.Regular,Color.FromArgb(117,125,139),ref y,25,width);}
   if(settings.ShowHeldValue)Row(g,"手持ち",Money(live.HeldValue)+(live.Fresh?"":" · 前回値"),ref y,width);
   if(settings.ShowTrunkValue){Row(g,"荷台全体",Money(live.TrunkValue),ref y,width);DrawText(g,live.TrunkKnown?(live.TrunkOpen?"開いている荷台 · ":"最終確認 "+live.TrunkUpdated+" · ")+(live.TrunkLabel==""?live.TrunkId:live.TrunkLabel):"荷台を開くと中身全体を集計します",9,FontStyle.Regular,Color.FromArgb(117,125,139),ref y,22,width);}
   if(settings.ShowWeight)Row(g,"重量",live.Weight+(live.Fresh?"":" · 更新待ち"),ref y,width);
   if(settings.ShowNeeds)Row(g,"空腹 / 水分",status.Hunger+" / "+status.Thirst,ref y,width);
   if(settings.ShowStatus)Row(g,status.Running?"実行中":"停止",status.Phase,ref y,width);
   if(settings.ShowMovement)Row(g,"10分ごと前進",status.Movement,ref y,width);
   if(settings.ShowLifetime)Row(g,"取得累計の見込",Money(live.LifetimeValue),ref y,width);
   if(settings.ShowItems)foreach(var item in live.HeldValue.Items.Take(settings.MaxRows))Row(g,item.Label+" ×"+item.Count,item.PriceKnown?"¥"+item.Value.ToString("N0"):"単価未登録",ref y,width);
   if(settings.ShowDiagnostics){Row(g,"認識",status.Backend+" "+status.ReadMs.ToString("F0")+"ms",ref y,width);Row(g,"詳細",status.Detail,ref y,width);}
  }
  void Row(Graphics g,string label,string value,ref int y,int width){int h=settings.FontSize+18;if(y+h>Height-8)return;
   using(var pen=new Pen(Color.FromArgb(26,70,83,102)))g.DrawLine(pen,17,y,width-17,y);
   using(var f=new Font("Yu Gothic UI",settings.FontSize))using(var fg=new SolidBrush(Color.FromArgb(31,41,57)))using(var sub=new SolidBrush(Color.FromArgb(102,110,127)))using(var format=new StringFormat{Trimming=StringTrimming.EllipsisCharacter,FormatFlags=StringFormatFlags.NoWrap,LineAlignment=StringAlignment.Center}){
    g.DrawString(label,f,sub,new RectangleF(17,y,Math.Min(112,width*.35f),h),format);format.Alignment=StringAlignment.Far;g.DrawString(value??"",f,fg,new RectangleF(Math.Min(130,width*.39f),y,width-Math.Min(130,width*.39f)-17,h),format);}
   y+=h;
  }
  void DrawText(Graphics g,string text,float size,FontStyle style,Color color,ref int y,int h,int width){if(y+h>Height-8)return;using(var f=new Font("Yu Gothic UI",size,style))using(var b=new SolidBrush(color))using(var fmt=new StringFormat{Trimming=StringTrimming.EllipsisCharacter,FormatFlags=StringFormatFlags.NoWrap,LineAlignment=StringAlignment.Center})g.DrawString(text??"",f,b,new RectangleF(17,y,width-34,h),fmt);y+=h;}
  void Render(){if(rendering||!Visible||!IsHandleCreated||Width<1||Height<1)return;rendering=true;
   IntPtr screen=IntPtr.Zero,dc=IntPtr.Zero,hbitmap=IntPtr.Zero,old=IntPtr.Zero;
   try{using(var bitmap=new Bitmap(Width,Height,PixelFormat.Format32bppPArgb)){using(var g=Graphics.FromImage(bitmap)){g.Clear(Color.Transparent);DrawPanel(g,Width,Height);}screen=GetDC(IntPtr.Zero);dc=CreateCompatibleDC(screen);hbitmap=bitmap.GetHbitmap(Color.FromArgb(0));old=SelectObject(dc,hbitmap);var pos=new POINT(Left,Top);var size=new SIZE(Width,Height);var src=new POINT(0,0);var blend=new BLEND{Op=0,Alpha=255,Format=1};UpdateLayeredWindow(Handle,screen,ref pos,ref size,dc,ref src,0,ref blend,2);}}
   finally{if(old!=IntPtr.Zero)SelectObject(dc,old);if(hbitmap!=IntPtr.Zero)DeleteObject(hbitmap);if(dc!=IntPtr.Zero)DeleteDC(dc);if(screen!=IntPtr.Zero)ReleaseDC(IntPtr.Zero,screen);rendering=false;}
  }
  public static void Screenshot(string path){using(var f=new StatusOverlay()){f.settings.Opacity=94;f.status=new Status{Running=true,Phase="アタリ待ち",Movement="次の前進まで 428秒",Live=new LivePanel{Fresh=true,Weight="48.50 / 150.00 kg",SessionValue=new Valuation{Known=true,Total=1260000},HeldValue=new Valuation{Known=true,Total=600000},TrunkValue=new Valuation{Known=true,Total=4620000},TrunkKnown=true,TrunkOpen=true,TrunkLabel="荷台（表示テスト）"}};f.ClientSize=new Size(400,f.DesiredHeight());using(var bitmap=new Bitmap(f.Width,f.Height)){using(var g=Graphics.FromImage(bitmap)){g.Clear(Color.FromArgb(227,232,240));f.DrawPanel(g,f.Width,f.Height);}bitmap.Save(path,ImageFormat.Png);}}}
  protected override void Dispose(bool disposing){if(disposing)follow.Dispose();base.Dispose(disposing);}
 }
}
