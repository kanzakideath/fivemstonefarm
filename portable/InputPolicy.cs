using System;
namespace FishingPilot {
 public static class InputPolicy {
  public const uint StartKey=0x74, StopKey=0x75; // F5 / F6
  public static string Route(bool foreground,bool allowBackground){return foreground?"foreground":allowBackground?"background":"paused";}
  public static double CaptureSide(int width,int height){return Math.Min(Math.Min(width,height)*.85,Math.Max(height*.40,width*.13));}
 }
}
