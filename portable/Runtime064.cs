using System;
using System.Linq;
namespace FishingPilot {
 public static class Runtime064 {
  public static bool ValidTheme(string theme,bool overlay=false){return (overlay?new[]{"match","light","dark"}:new[]{"system","light","dark"}).Contains(theme);}
  public static bool Dark(string theme){if(theme=="dark")return true;if(theme=="light")return false;try{using(var key=Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))return Convert.ToInt32(key==null?1:key.GetValue("AppsUseLightTheme",1))==0;}catch{return false;}}
  // Unknown telemetry is not invented. The user may continue fishing with a warning,
  // or choose strict waiting. A missing side never prevents observing the other side.
  public static string Need(double now,bool hk,double h,double ha,int hv,bool wk,double w,double wa,int wv,bool keepGoing){
   bool hf=hk&&now-ha>=0&&now-ha<=10000,wf=wk&&now-wa>=0&&now-wa<=10000;
   if(hf&&h<=50&&hv>=2)return "food";
   if(wf&&w<=50&&wv>=2)return "water";
   if((hf&&h<=50)||(wf&&w<=50))return "confirm";
   return (!hf||!wf)&&!keepGoing?"unknown":"continue";
  }
  public static double RecastAt(double now,double lastHit,int normalMs,bool failed,int failureMs){return failed?Math.Max(now+failureMs,lastHit+300):RecastPolicy.Earliest(now,lastHit,normalMs);}
  public static bool QuietRecovery(double now,double castAt,double quietAt,bool seenRing,bool known,bool fresh,bool open,bool ring,bool busy){
   // Unknown bite waits remain conservative; never spam a rod during a long bite.
   return known&&fresh&&!open&&!ring&&!busy&&quietAt>=0&&now-quietAt>=(seenRing?2500:90000)&&now-castAt>=(seenRing?2500:90000);
  }
 }
}
