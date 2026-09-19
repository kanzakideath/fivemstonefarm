using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;
namespace FishingPilot {
 public sealed class GameOverlay:Form {
  Status state=new Status(); readonly Timer tick; IntPtr game; uint pid; bool enabled;
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetWindowDisplayAffinity(IntPtr h,uint value);
  protected override bool ShowWithoutActivation {get{return true;}}
  protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x08000000|0x00080000|0x00000020|0x00000080;return p;}}
  public GameOverlay(){FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;BackColor=Color.FromArgb(22,29,43);Opacity=.90;DoubleBuffered=true;StartPosition=FormStartPosition.Manual;Font=new Font("Yu Gothic UI",10);Size=new Size(414,260);
   tick=new Timer{Interval=200};tick.Tick+=delegate{Position();};tick.Start();}
  public void UpdateStatus(Status s,IntPtr window,bool show){state=s??new Status();if(game!=window){game=window;Native.GetWindowThreadProcessId(game,out pid);}enabled=show;Position();Invalidate();}
  void Position(){uint p;if(!enabled||game==IntPtr.Zero||!Native.IsWindow(game)||IsIconic(game)||Native.GetForegroundWindow()!=game){if(Visible)Hide();return;}Native.GetWindowThreadProcessId(game,out p);if(p!=pid){Hide();return;}var r=Native.Client(game);if(r.Width<400||r.Height<300){Hide();return;}
   int width=Math.Min(440,Math.Max(300,r.Width/3)),rows=Math.Min(4,state.CurrentItems.Length);int height=164+Math.Max(1,rows)*24;Bounds=new Rectangle(r.Left+14,r.Top+14,width,height);if(!Visible){Show();SetWindowDisplayAffinity(Handle,0x11);}}
  public void ShowTest(Status s,Rectangle bounds){tick.Stop();state=s;Bounds=bounds;Show();Invalidate();}
  protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);var g=e.Graphics;g.SmoothingMode=SmoothingMode.AntiAlias;
   using(var title=new Font(Font.FontFamily,12,FontStyle.Bold))using(var white=new SolidBrush(Color.White))using(var muted=new SolidBrush(Color.FromArgb(193,207,228)))using(var accent=new SolidBrush(Color.FromArgb(102,173,255))){
    g.DrawString("釣りアシスト  |  F5開始・F6停止",title,white,12,10);
    Draw(g,state.Phase,accent,12,40,Width-24);Draw(g,state.Detail,muted,12,64,Width-24);
    Draw(g,"重量 "+state.Inventory+"   "+(state.InventoryFresh?"最新":"更新待ち"),white,12,90,Width-24);
    Draw(g,"投竿 "+state.Casts+"  判定入力 "+state.Keys+"  取得確認 "+state.Results,muted,12,114,Width-24);
    Draw(g,"現在所持  /  釣り後の増加累計",accent,12,140,Width-24);
    int y=165;var items=state.CurrentItems.Take(4).ToArray();if(items.Length==0)Draw(g,state.InventoryFresh?"現在所持なし（収納後はここから消えます）":"インベントリの読み取り待ち",muted,12,y,Width-24);
    foreach(var row in items){Draw(g,row.Label+" ×"+row.Count+(row.Caught>0?"  /  累計 "+row.Caught:""),white,12,y,Width-24);y+=24;}
   }}
  void Draw(Graphics g,string text,Brush brush,int x,int y,int width){using(var f=new StringFormat{Trimming=StringTrimming.EllipsisCharacter,FormatFlags=StringFormatFlags.NoWrap})g.DrawString(text??"",Font,brush,new RectangleF(x,y,width,23),f);}
  protected override void WndProc(ref Message m){if(m.Msg==0x0084){m.Result=new IntPtr(-1);return;}if(m.Msg==0x0021){m.Result=new IntPtr(3);return;}base.WndProc(ref m);}
  protected override void Dispose(bool disposing){if(disposing)tick.Dispose();base.Dispose(disposing);}
 }
}
