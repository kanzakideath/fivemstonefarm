using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
namespace FishingPilot {
 public static class Tests050 {
  public static int Run(string output){int n=0;Action<bool,string> check=(ok,why)=>{n++;if(!ok)throw new Exception("050: "+why);};
   check(InputPolicy.Route(true,true)=="foreground","background option must not disable foreground detection/input");
   check(InputPolicy.Route(false,true)=="background","background route");check(InputPolicy.Route(false,false)=="paused","background permission respected");
   check(InputPolicy.StartKey==0x74&&InputPolicy.StopKey==0x75,"F5 start F6 stop");
   foreach(var size in new[]{new[]{800,600},new[]{1280,720},new[]{1920,1080},new[]{3440,1440},new[]{3840,2160}}){double side=InputPolicy.CaptureSide(size[0],size[1]);check(side>100&&side<=Math.Min(size[0],size[1]),"client-relative capture bounds");}
   string dir=Path.Combine(output,"stats-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(dir);try{
    var stat=new CatchStatistics(dir);var initial=Inventory.Parse("SNAPSHOT 100 1000 3 40 0001.food.e30=5,0008.food.e30=10,0010.fish.e30=4");initial.Labels["fish"]="試験の魚";stat.Observe(initial,1);
    check(stat.Held.Length==1&&stat.Held[0].Count==4&&stat.Held[0].Label=="試験の魚","initial held counts do not credit catches, hotbar names protected");check(stat.Caught.Length==0,"no initial false credit");
    var after=Inventory.Parse("SNAPSHOT 300 1000 3 40 0001.food.e30=5,0008.food.e30=10,0010.fish.e30=7");stat.Credit(initial,after);check(stat.Caught.Single().Total==3,"quantity not round count");
    var removed=Inventory.Parse("SNAPSHOT 100 1000 1 40 0001.food.e30=5");stat.Observe(removed,2);check(stat.Held.Length==0&&stat.Caught.Single().Total==3,"manual transfer clears current list not cumulative");
    stat.Observe(new Inventory(),3);check(!stat.CurrentKnown,"unknown explicitly marked stale");
    var reread=new CatchStatistics(dir);check(reread.Caught.Single().Total==3,"totals persist across app restarts");
    stat.Credit(after,after);check(stat.Caught.Single().Total==3,"no duplicate credit for unchanged inventory");
   }finally{Directory.Delete(dir,true);}
   StatusOverlay.Screenshot(Path.Combine(output,"overlay.png"));check(File.Exists(Path.Combine(output,"overlay.png")),"native overlay rendered");
   File.WriteAllText(Path.Combine(output,"050.txt"),"PASS\nassertions="+n+"\nsource-route, hotkeys, live-vs-cumulative inventory, persistence, overlay screenshot\nNo live FiveM test.\n");return n;
  }
 }
}
