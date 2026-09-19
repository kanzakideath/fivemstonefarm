using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Web.Script.Serialization;
namespace FishingPilot {
 public static class Tests064 {
  public static int Run(string output){
   int n=0;Action<bool,string> check=(ok,text)=>{if(!ok)throw new Exception("064: "+text);n++;};
   var o=new Options();check(o.Theme=="dark"&&o.Overlay.Theme=="match","dark application and matching overlay defaults");
   var json=new JavaScriptSerializer();var migrated=json.Deserialize<Options>("{\"AutoNeeds\":true,\"BackgroundMode\":true}");
   check(migrated.ContinueOnUnknownNeeds&&migrated.FailureRecastMs==350,"legacy settings gain explicit non-blocking needs defaults");
   foreach(var theme in new[]{"dark","light","system"}){o.Theme=theme;UiCommands.Validate(o);check(Runtime064.ValidTheme(theme),"app theme accepted: "+theme);}
   foreach(var theme in new[]{"dark","light","match"}){o.Overlay.Theme=theme;UiCommands.Validate(o);check(Runtime064.ValidTheme(theme,true),"overlay theme accepted: "+theme);}
   check(!Runtime064.ValidTheme("match")&&!Runtime064.ValidTheme("system",true)&&!Runtime064.ValidTheme("bogus"),"theme enumeration does not accept arbitrary strings");
   check(Runtime064.Dark("dark")&&!Runtime064.Dark("light"),"deterministic light/dark independent of OS");
   var m=UiCommands.Parse("{\"action\":\"theme.save\",\"settings\":{\"Theme\":\"light\",\"OverlayTheme\":\"dark\"}}");
   check((string)m["action"]=="theme.save","theme action allowed by native protocol");
   bool rejected=false;try{UiCommands.Parse("{\"action\":\"theme.save\"}");}catch(ArgumentException){rejected=true;}check(rejected,"theme action requires typed settings");
   check(Runtime064.Need(1000,false,0,0,0,false,0,0,0,true)=="continue","unknown gauges do not block when continuation selected");
   check(Runtime064.Need(1000,false,0,0,0,false,0,0,0,false)=="unknown","strict wait remains an explicit option");
   check(Runtime064.Need(1000,true,20,900,2,false,0,0,0,true)=="food","known hunger can be supplied when water missing");
   check(Runtime064.Need(1000,false,0,0,0,true,20,900,2,true)=="water","known water can be supplied when hunger missing");
   check(Runtime064.Need(1000,true,80,900,0,true,80,900,0,true)=="continue","full gauges never consume items");
   check(Runtime064.Need(1000,true,20,900,1,false,0,0,0,true)=="confirm","one low observation does not trigger supply");
   check(Runtime064.Need(12000,true,20,900,2,false,0,0,0,true)=="continue","stale low gauge never triggers supply");
   check(Runtime064.Need(1000,true,20,1100,2,false,0,0,0,true)=="continue","future timestamps do not trigger supply");
   check(Runtime064.RecastAt(5000,4600,1400,true,350)==5350,"confirmed failure uses requested 350ms instead of normal recovery");
   check(Runtime064.RecastAt(5000,4990,1400,true,200)==5290,"very recent digit still has minimum release boundary");
   check(Runtime064.RecastAt(5000,4600,1400,false,350)==RecastPolicy.Earliest(5000,4600,1400),"normal-success recovery unchanged");
   check(!RecastPolicy.Ready(5350,5350,5000,true,false,true),"failure wait never overrides an additional visible ring");
   check(!RecastPolicy.Ready(5350,5350,5000,false,true,true),"failure wait never overrides progress");
   check(!RecastPolicy.Ready(5350,5350,5000,false,false,false),"failure wait requires fresh inventory");
   check(Runtime064.QuietRecovery(5000,1000,2500,true,true,true,false,false,false),"quiet post-ring recovery is bounded at 2.5s");
   check(!Runtime064.QuietRecovery(4999,1000,2500,true,true,true,false,false,false),"quiet timer not early");
   check(!Runtime064.QuietRecovery(9000,1000,2500,false,true,true,false,false,false),"long bite without a seen ring is not mistaken for failure");
   check(!Runtime064.QuietRecovery(9000,1000,2500,true,false,true,false,false,false),"unknown scene cannot unlock retries");
   check(!Runtime064.QuietRecovery(9000,1000,2500,true,true,true,true,false,false),"open inventory cannot unlock retries");
   check(!Runtime064.QuietRecovery(9000,1000,2500,true,true,true,false,true,false),"additional ring cannot unlock retries");
   check(!Runtime064.QuietRecovery(9000,1000,2500,true,true,true,false,false,true),"live progress cannot unlock retries");
   var path=Path.Combine(output,"overlay-dark.png");StatusOverlay.Screenshot(path,true);
   check(File.Exists(path)&&new FileInfo(path).Length>1000,"native dark overlay renders to image");
   File.WriteAllText(Path.Combine(output,"064.txt"),"PASS\nassertions="+n+"\nTheme persistence and validation, unknown-needs policy, independent gauges, confirmed-failure wait and quiet recovery safety. Native dark overlay image generated. No live FiveM claim.\n");
   return n;
  }
 }
}
