using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
namespace FishingPilot {
 internal static class Tests050 {
  static int checks;static void Check(bool ok,string why){checks++;if(!ok)throw new Exception("050: "+why);}
  [DllImport("user32.dll",EntryPoint="GetWindowLongW")]static extern int GetStyle(IntPtr h,int n);
  static Inventory Stock(string spec){return Inventory.Parse("SNAPSHOT 1200 120000 3 40 "+spec);}
  public static int Run(string output){
   checks=0;string root=Path.Combine(output,"book-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);
   var book=new CatchBook(root);var names=new Dictionary<string,string>{{"fish","サバ"}};
   var before=Stock("0001.food.e30=2,0002.rod.e30=1,0006.fish.e30=1");
   var after=Stock("0001.food.e30=2,0002.rod.e30=1,0006.fish.e30=4");
   book.Observe(after,names,100);book.Credit("first",before,after,false);
   Check(book.Held.Single(x=>x.Name=="fish").Count==4,"current holdings are snapshot values");
   Check(book.Totals.Single(x=>x.Name=="fish").Caught==3,"cumulative is verified increase, not current total");
   book.Credit("first",before,after,false);Check(book.Totals[0].Caught==3,"same completed cast is not counted twice");
   book.Observe(Stock("0001.food.e30=2,0002.rod.e30=1"),names,200);
   Check(!book.Held.Any(x=>x.Name=="fish")&&book.Totals[0].Caught==3,"manual storage removes current row but preserves total");
   book.Observe(Stock("0001.food.e30=1,0002.rod.e30=1"),names,300);Check(book.Held.Single(x=>x.Name=="food").Count==1,"manual usage decreases current quantity");
   book.Observe(new Inventory(),names,310);Check(!book.Fresh(320),"unknown snapshot not presented as fresh empty inventory");
   Check(book.Held.Length==2,"unknown snapshot keeps last values with stale flag");
   book.Credit("manual-inventory",before,after,true);Check(book.Totals[0].Caught==3,"manual inventory operation is not credited as fish");
   var reload=new CatchBook(root);Check(reload.Totals.Single(x=>x.Name=="fish").Caught==3,"cumulative survives process restart");
   Check(book.Held.All(x=>x.Count>0),"zero-count items absent");
   var labels=CdpBridge.FishingTelemetryReader.Labels("SNAPSHOT_DETAIL {\"items\":[{\"name\":\"fish\",\"label\":\"サバ\"}]}");Check(labels["fish"]=="サバ","actual display label from inventory snapshot");
   var c=new RoundController();
   var pixel=new Ring{Valid=true,Key=4,Pointer=208,Start=200,End=240,Confidence=1};c.Observe(pixel,0);pixel.Pointer=215;Check(c.Observe(pixel,20)==4,"foreground timing observed");
   var dom=new Ring{Valid=true,Native=true,Identity="frame:7",Key=4,Pointer=216,Start=200,End=240,Confidence=1};Check(c.Observe(dom,200)<0,"switch to background must not re-send same round");
   dom.Pointer=25;c.Observe(dom,400);dom.Pointer=215;Check(c.Observe(dom,450)==4,"same digit next round remains supported");
   dom.Pointer=219;Check(c.Observe(dom,550)<0,"no duplicate after additional key");
   for(int i=0;i<7;i++){dom.Native=!dom.Native;Check(c.Observe(dom,600+i*50)<0,"backend oscillation keeps latch");}
   var scene=CdpBridge.FishingConnection.DecodeScene("{\"ring\":{\"present\":false},\"notices\":[],\"editing\":true,\"diagnostic\":\"frames=3\",\"w\":1280,\"h\":720}","nui://test/");Check(scene.Editing&&scene.Diagnostic=="frames=3","diagnostic/editing data propagated");
   Check(!scene.Present,"no fictitious ring in failed probe");
   var options=new Options();Check(options.ShowOverlay,"overlay enabled by default");
   Check(MainForm.StartVirtualKey==0x74&&MainForm.StopVirtualKey==0x75,"F5 start/F6 stop virtual keys");
   using(var game=new Form{Text="Overlay fixture",ClientSize=new Size(960,620)})using(var overlay=new GameOverlay()){
    game.Show();game.Activate();Application.DoEvents();var beforeFocus=Native.GetForegroundWindow();
    var state=new Status{Phase="数字・タイミング判定",Detail="前面の実画面を読み取り中 / 次の判定へ",Inventory="42.5 / 120.0 kg",InventoryFresh=true,Casts=12,Keys=27,Results=11,CurrentItems=new[]{new ItemCount{Name="fish",Label="サバ",Count=4,Caught=17},new ItemCount{Name="salmon",Label="サーモン",Count=2,Caught=8}}};
    overlay.ShowTest(state,new Rectangle(game.Left+20,game.Top+40,420,238));Application.DoEvents();Thread.Sleep(80);Application.DoEvents();
    int flags=GetStyle(overlay.Handle,-20);Check((flags&0x08000000)!=0&&(flags&0x20)!=0,"overlay nonactivating and click-through styles");
    Check(Native.GetForegroundWindow()==beforeFocus,"overlay does not steal focus");
    using(var bmp=new Bitmap(overlay.Width,overlay.Height)){overlay.DrawToBitmap(bmp,new Rectangle(Point.Empty,bmp.Size));bmp.Save(Path.Combine(output,"overlay.png"));}
    overlay.Hide();game.Close();
   }
   File.WriteAllText(Path.Combine(output,"REGRESSION050.txt"),"PASS "+checks+" checks: inventory replacement, manual removal, separate cumulative totals, cancellation-safe backend latch, F5/F6, overlay nonactivation. Synthetic Windows only.");
   return checks;
  }
 }
}
