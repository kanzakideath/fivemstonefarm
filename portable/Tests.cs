using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
namespace FishingPilot {
 static class Tests {
  static int count;static void Check(bool ok,string why){count++;if(!ok)throw new Exception(why);}
  static Ring R(int key,double pointer){return new Ring{Valid=true,Key=key,Pointer=pointer,Start=200,End=250,Confidence=1};}
  public static int Run(string output) {
   Directory.CreateDirectory(output);var notes=new List<string>();
   try {
    Check(!Inventory.Parse("ERROR").Known,"unknown inventory rejected");
    var inv=Inventory.Parse("SNAPSHOT 800 1000 1 40 0001.fish.e30=2");Check(inv.Known&&!inv.Full(100),"parse capacity");Check(inv.Full(200),"reserve boundary");Check(Inventory.Parse("SNAPSHOT 1000 1000 1 40 -").Full(0),"full boundary");
    Check(!Inventory.Parse("SNAPSHOT 0 0 0 40 -").Known,"invalid maximum");Check(Inventory.Parse("SNAPSHOT 800 1000 1 40 0004.fish.e30=3").IncreasedSince(inv),"count increase ignores moved slots");
    Check(!Inventory.Parse("SNAPSHOT 800 1000 1 40 0004.fish.e30=2").IncreasedSince(inv),"slot movement not catch");
    var c=new RoundController();c.Reset();Check(c.Observe(R(1,190),0)<0,"before zone");Check(c.Observe(R(1,201),20)<0,"entry margin");Check(c.Observe(R(1,205),40)==1,"eligible once");
    for(int i=0;i<100;i++)Check(c.Observe(R(1,220),50+i*10)<0,"never duplicate a latched round");
    c.Observe(R(3,30),1100);Check(c.Observe(R(3,212),1120)==3,"additional changed digit");
    c.Observe(R(3,20),1300);Check(c.Observe(R(3,220),1330)==3,"same digit after reset");
    c.Observe(new Ring(),1340);Check(c.Observe(R(3,230),1540)<0,"temporary recognition loss is not new round");
    c.Reset();c.Observe(R(2,190),2000);Check(c.Observe(R(2,260),2200)<0,"do not hit late");notes.Add("round-state: additional/same-digit/no-duplicate/dropout/late-input guards passed");
    var reader=new RingReader(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"digit-templates.json"));
    string fixture=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"fixtures");
    string[] fixtureFiles=Directory.GetFiles(fixture,"ring-*.png");Check(fixtureFiles.Length==6,"all six recorded-glyph synthetic-circle fixtures present");
    foreach(string file in fixtureFiles){int expected=Int32.Parse(Path.GetFileNameWithoutExtension(file).Split('-')[1]);using(Bitmap b=new Bitmap(file)){Ring r=reader.Read(b);Check(r.Valid&&r.Key==expected,"recorded glyph on synthetic circle "+Path.GetFileName(file));}}
    using(Bitmap b=new Bitmap(320,320)){Check(!reader.Read(b).Valid,"empty image must not authorize input");}
    foreach(int percent in new[]{0,25,45,50,55,75,100})foreach(bool food in new[]{true,false})using(Bitmap b=new Bitmap(100,100)) {
     using(Graphics g=Graphics.FromImage(b)){g.Clear(Color.Black);using(var pen=new Pen(Color.FromArgb(55,62,70),5))g.DrawEllipse(pen,30,30,40,40);if(percent>0)using(var pen=new Pen(food?Color.FromArgb(235,140,15):Color.FromArgb(22,151,205),5))g.DrawArc(pen,30,30,40,40,-90,percent*3.6f);g.FillRectangle(Brushes.White,45,43,10,14);}
     var v=HudReader.Read(b,food,50,50,20);Check(v.Known&&Math.Abs(v.Value-percent)<4,"HUD arc percent "+percent);}
    notes.Add("HUD measurement: synthetic food/water ring percentages 0..100 passed; live HUD recognition is not proven");
    // Regression for the exact short re-cast schedule in the user's diagnostic log.
    double next=RecastPolicy.Earliest(468213,467391,1400);
    Check(!RecastPolicy.Ready(468482,next,468250,false,false,true),"logged 269ms re-cast is too early");
    Check(RecastPolicy.Ready(next,next,468250,false,false,true),"resume as soon as recovery and idle stability pass");
    Check(!RecastPolicy.Ready(next+1000,next,468250,true,false,true),"additional round blocks rod");
    Check(!RecastPolicy.Ready(next+1000,next,468250,false,true,true),"busy animation blocks rod");
    Check(!RecastPolicy.Ready(next+1000,next,468250,false,false,false),"stale inventory blocks rod");
    Check(!RecastPolicy.MayRetryUnacknowledged(40000,0,0,false,false,false,true),"never re-cast during normal 30s bite window");
    Check(RecastPolicy.MayRetryUnacknowledged(65000,0,0,false,false,false,true),"unacknowledged cast can recover with bounded retry");
    Check(!RecastPolicy.MayRetryUnacknowledged(65000,0,2,false,false,false,true),"retry budget prevents endless rod toggling");
    Check(!RecastPolicy.MayRetryUnacknowledged(65000,0,0,true,false,false,true),"acknowledged fishing cannot be reset by a timeout");
    foreach(string file in fixtureFiles)foreach(int size in new[]{192,256,480,640})using(var src=new Bitmap(file))using(var scaled=new Bitmap(size,size)) {
     using(var g=Graphics.FromImage(scaled))g.DrawImage(src,0,0,size,size);
     Ring r=reader.ReadAuto(scaled);int k=Int32.Parse(Path.GetFileNameWithoutExtension(file).Split('-')[1]);Check(r.Valid&&r.Key==k,"auto pixel scale "+size+" "+file+" valid="+r.Valid+" key="+r.Key+" score="+r.Confidence);
    }
    c.Reset();var wrap=new Ring{Valid=true,Key=2,Pointer=355,Start=345,End=25,Native=true,Identity="wrap"};c.Observe(wrap,0);Check(c.Observe(wrap,30)==2,"native target crossing zero degrees");
    c.InputRejected();Check(c.Observe(wrap,100)==2,"a locally rejected stale input may be reobserved");
    notes.Add("recast: recorded premature schedule, busy/extra-round/staleness and bounded acknowledgement recovery passed");
    notes.Add("pixel normalization: four sizes per synthetic recorded-glyph fixture; wrapping native angles passed");
    var pending=new OutcomeLatch();pending.Mark("FAIL");pending.Mark("NONE");
    Check(pending.Terminal&&pending.Failed,"terminal notice survives a later frame before ring closure");
    pending.Clear();Check(!pending.Terminal&&!pending.Full,"new cast clears previous terminal event");
    pending.Mark("FULL");Check(pending.Full&&!pending.Terminal,"full capacity is distinct from catch");
    pending.Mark("BLOCK");Check(pending.Blocked,"missing rod or bait stays blocked");
    notes.Add("pending outcomes: notice retention, per-cast reset, full and blocked causes separated");
    c.Reset();c.Observe(R(4,175),0,10);c.Observe(R(4,185),20,10);
    Check(c.Observe(R(4,204),40,10)==4,"bounded pixel latency enters the interior");
    c.Reset();c.Observe(R(4,190),0,20);Check(c.Observe(R(4,258),30,20)<0,"missed window remains refused");
    Check(Native.FiveMConsolePort()==0,"unrelated listener cannot authorize hotbar");
    notes.Add("bounded latency, missed-window refusal, and process-owned hotbar selection checked");
    var cfg=new Options{ObserveOnly=true,FoodX=.12,WaterY=.8};
    var setting=new System.Collections.Generic.Dictionary<string,object>{{"FoodKey",1},{"DrinkKey",3},{"ReserveGrams",500},{"MinRecastMs",1400},{"GaugeRadius",20},{"AutoNeeds",true},{"ObserveOnly",false},{"BackgroundMode",true}};
    var updated=UiCommands.Update(cfg,setting);Check(updated.FoodX==.12&&updated.WaterY==.8&&!updated.ObserveOnly&&cfg.ObserveOnly,"UI settings preserve calibration and are copy-on-write");
    Check((string)UiCommands.Parse("{\"action\":\"start\"}")["action"]=="start","native start accepted");
    foreach(string invalid in new[]{"{\"action\":\"execute\",\"url\":\"bad\"}","{\"action\":\"start\",\"settings\":{}}","{\"action\":\"save\"}"}){bool rejected=false;try{UiCommands.Parse(invalid);}catch(ArgumentException){rejected=true;}Check(rejected,"unsafe or incomplete UI message rejected");}
    setting["FoodKey"]=2;bool rodRejected=false;try{UiCommands.Update(cfg,setting);}catch(ArgumentException){rodRejected=true;}Check(rodRejected,"UI cannot use rod slot for food");
    notes.Add("native UI protocol: allowlist, typed payload validation, immutable settings update, calibration preservation");
    count+=Tests050.Run(output);
    count+=Tests060.Run(output);
    count+=Tests064.Run(output);
    count+=Tests040.Run(output);notes.Add("storage040: exact metadata ledger, protected items, paired receipts, durable pending guard tested");
    NativeInputTest(notes);
    File.WriteAllText(Path.Combine(output,"RESULT.txt"),"PASS\nassertions="+count+"\n"+String.Join("\n",notes.ToArray())+"\nNo live FiveM execution or catch-success claim.\n");return 0;
   } catch(Exception e){File.WriteAllText(Path.Combine(output,"RESULT.txt"),"FAIL\n"+e.ToString());return 1;}
  }
  static void NativeInputTest(List<string> notes) {
   using(Form f=new Form{Text="FishingPilot input fixture",KeyPreview=true,Width=360,Height=180}) {
    int downs=0,ups=0;f.KeyDown+=delegate(object s,KeyEventArgs e){if(e.KeyCode==Keys.D3)downs++;};f.KeyUp+=delegate(object s,KeyEventArgs e){if(e.KeyCode==Keys.D3)ups++;};f.Show();f.Activate();f.Focus();Application.DoEvents();
    var sw=Stopwatch.StartNew();while(Native.GetForegroundWindow()!=f.Handle&&sw.ElapsedMilliseconds<2000){Application.DoEvents();Thread.Sleep(10);f.Activate();}
    Check(Native.GetForegroundWindow()==f.Handle,"test desktop must provide foreground input");uint pid;Native.GetWindowThreadProcessId(f.Handle,out pid);IntPtr hwnd=f.Handle;
    Task<bool> t=Task.Run(()=>Native.Press(hwnd,pid,3,CancellationToken.None));while(!t.IsCompleted){Application.DoEvents();Thread.Sleep(2);}for(int i=0;i<20;i++){Application.DoEvents();Thread.Sleep(5);}
    Check(t.Result&&downs==1&&ups==1,"native key-down and key-up observed once");
    var cancel=new CancellationTokenSource();cancel.Cancel();Check(!Native.Press(hwnd,pid,3,cancel.Token),"cancelled input rejected");Check(!Native.Press(hwnd,pid+1,3,CancellationToken.None),"wrong PID rejected");
    using(Form other=new Form{Text="Other application fixture"}){other.Show();other.Activate();Application.DoEvents();Check(!Native.Press(hwnd,pid,3,CancellationToken.None),"other foreground receives no input");other.Close();}
    f.Close();notes.Add("native Windows fixture: 1 key-down / 1 key-up, cancellation, wrong PID, foreground-loss passed; not a FiveM test");
   }
  }
 }
}
