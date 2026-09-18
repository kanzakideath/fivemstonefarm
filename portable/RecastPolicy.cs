using System;
namespace FishingPilot {
 public sealed class OutcomeLatch {
  public bool Terminal,Failed,Full,Blocked;
  public void Mark(string kind){Terminal|=kind=="CAUGHT"||kind=="FAIL"||kind=="CANCEL";Failed|=kind=="FAIL"||kind=="CANCEL";Full|=kind=="FULL";Blocked|=kind=="BLOCK";}
  public void Clear(){Terminal=Failed=Full=Blocked=false;}
 }

 public static class RecastPolicy {
  // The recorded failure followed a 260 ms post-result key. Wait for recovery,
  // not simply inventory gain, and extend automatically while progress is visible.
  public static double Earliest(double resultAt,double lastKey,int minimumRecoveryMs){return Math.Max(resultAt+700,lastKey+Math.Max(800,minimumRecoveryMs));}
  public static bool Ready(double now,double earliest,double quietSince,bool ringVisible,bool busy,bool fresh){return fresh&&!ringVisible&&!busy&&quietSince>=0&&now-quietSince>=300&&now>=earliest;}
  public static bool MayRetryUnacknowledged(double now,double castAt,int retries,bool acknowledged,bool ringVisible,bool busy,bool fresh){return fresh&&!acknowledged&&!ringVisible&&!busy&&retries<2&&now-castAt>=65000;}
 }
}
