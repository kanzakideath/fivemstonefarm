using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;
namespace FishingPilot {
 // Separate, mouse-transparent status window. No game injection and no activation.
 public sealed class StatusOverlay:Form {
  Status status=new Status();IntPtr game;bool enabled=true;readonly Timer follow;bool smoke;
  [DllImport("user32.dll")]static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")]static extern bool SetWindowDisplayAffinity(IntPtr hwnd,uint flags);
  protected override bool ShowWithoutActivation{get{return true;}}
  protected override CreateParams CreateParams{get{var p=base.CreateParams;p.ExStyle|=0x08000000|0x00000020|0x00000080;return p;}}
  public StatusOverlay(){FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;BackColor=Color.FromArgb(21,31,47);ForeColor=Color.White;Opacity=.91;DoubleBuffered=true;ClientSize=new Size(400,330);Font=new Font("Yu Gothic UI",10);follow=new Timer{Interval=200};follow.Tick+=delegate{Follow();};follow.Start();}
  public void UpdateState(Status s,IntPtr hwnd,bool show){status=s;game=hwnd;enabled=show;Follow();Invalidate();}
  void Follow(){if(smoke)return;if(!enabled||game==IntPtr.Zero||!Native.IsWindow(game)||IsIconic(game)||Native.GetForegroundWindow()!=game){if(Visible)Hide();return;}
   var c=Native.Client(game);if(c.Width<300||c.Height<240){Hide();return;}int w=Math.Min(440,Math.Max(260,(int)(c.Width*.31)));int h=Math.Min(330,c.Height-24);Bounds=new Rectangle(c.Left+12,c.Top+12,w,h);if(!Visible)Show();
  }
  protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);try{SetWindowDisplayAffinity(Handle,0x11);}catch{}}
  protected override void WndProc(ref Message m){if(m.Msg==0x0084){m.Result=new IntPtr(-1);return;}if(m.Msg==0x0021){m.Result=new IntPtr(3);return;}base.WndProc(ref m);}
  protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);var g=e.Graphics;g.SmoothingMode=SmoothingMode.AntiAlias;g.TextRenderingHint=System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;int y=12;
   using(var accent=new SolidBrush(Color.FromArgb(108,175,255)))g.FillRectangle(accent,0,0,4,Height);
   using(var title=new Font(Font,FontStyle.Bold)){Line(g,"釣りアシスト  ·  F5開始 / F6停止",title,ref y,24);Line(g,status.Phase,title,ref y,25);}
   Line(g,status.Detail,Font,ref y,32);Line(g,status.Backend+"  "+status.ReadMs.ToString("F0")+"ms",Font,ref y,23);
   Line(g,"重量 "+status.Inventory+"   空腹 "+status.Hunger+" / 水分 "+status.Thirst,Font,ref y,25);
   Line(g,status.Ring,Font,ref y,26);Line(g,status.InventoryFresh?"現在の所持品（手動収納も反映）":"所持品の更新待ち（前回値）",Font,ref y,24);
   int rows=Math.Min(3,Math.Max(0,(Height-y-28)/21));
   foreach(var item in (status.HeldItems??new ItemDisplay[0]).Take(rows))Line(g,item.Label+"  × "+item.Count,Font,ref y,21);
   if(status.HeldItems==null||status.HeldItems.Length==0)Line(g,status.InventoryFresh?"対象の所持品なし":"未確認",Font,ref y,21);
   string sum=String.Join("  /  ",(status.CaughtItems??new ItemDisplay[0]).Take(3).Select(x=>x.Label+" ×"+x.Total));y=Math.Min(y,Height-25);Line(g,"取得累計  "+(sum==""?"0":sum),Font,ref y,24);
  }
  void Line(Graphics g,string text,Font font,ref int y,int height){if(y+height>Height)return;TextRenderer.DrawText(g,text??"",font,new Rectangle(14,y,Width-28,height),ForeColor,TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix|TextFormatFlags.VerticalCenter);y+=height;}
  public static void Screenshot(string path){using(var f=new StatusOverlay()){f.smoke=true;f.Opacity=1;f.ClientSize=new Size(440,330);f.status=new Status{Phase="数字・タイミング判定",Detail="4を検出。判定範囲と入力時刻を監視しています",Backend="前面画像 / Windows入力",Inventory="48.5 / 150.0 kg",InventoryFresh=true,Hunger="73%",Thirst="66%",Ring="画像: 数字4 白198° 緑200〜225°",ReadMs=9,HeldItems=new[]{new ItemDisplay{Label="魚（表示例）",Count=12}},CaughtItems=new[]{new ItemDisplay{Label="魚（表示例）",Total=28}}};f.Show();Application.DoEvents();using(var bitmap=new Bitmap(f.Width,f.Height)){f.DrawToBitmap(bitmap,f.ClientRectangle);bitmap.Save(path);}f.Close();}}
  protected override void Dispose(bool disposing){if(disposing)follow.Dispose();base.Dispose(disposing);}
 }
}
