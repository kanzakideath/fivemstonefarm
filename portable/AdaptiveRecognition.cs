using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;

namespace FishingPilot {
 // Expensive acquisition runs only when tracking is lost. Native SVG reads stay on their fast path.
 public sealed class AdaptiveRingReader {
  readonly RingReader decoder;double cx=.5,cy=.5;bool locked;
  public string Evidence="未検出";
  public AdaptiveRingReader(string templates){decoder=new RingReader(templates);}
  Ring Decode(Bitmap source,double x,double y,double side){
   if(side<40)return new Ring();using(var b=new Bitmap(320,320)){
    using(var g=Graphics.FromImage(b)){g.Clear(Color.Black);g.InterpolationMode=InterpolationMode.HighQualityBilinear;g.DrawImage(source,new RectangleF(0,0,320,320),new RectangleF((float)(x-side/2),(float)(y-side/2),(float)side,(float)side),GraphicsUnit.Pixel);}
    var r=decoder.Read(b);r.CenterX=x;r.CenterY=y;return r;
   }
  }
  sealed class Candidate {public double X,Y,R,Score;}
  public Ring ReadAuto(Bitmap source){
   double side=Math.Min(source.Width,source.Height);
   if(locked){var tracked=Decode(source,cx*source.Width,cy*source.Height,side);if(tracked.Valid){Evidence="追跡＋数字形状＋円弧";return tracked;}locked=false;}
   var centered=Decode(source,source.Width*.5,source.Height*.5,side);
   if(centered.Valid){cx=cy=.5;locked=true;Evidence="中心円＋数字形状＋円弧";return centered;}
   using(var normalized=new Bitmap(320,320)){
    using(var g=Graphics.FromImage(normalized)){g.InterpolationMode=InterpolationMode.HighQualityBilinear;g.DrawImage(source,0,0,320,320);}
    var pixels=new Pixels(normalized);var candidates=new List<Candidate>();
    for(int y=88;y<=232;y+=8)for(int x=88;x<=232;x+=8)for(int radius=22;radius<=118;radius+=4){
     if(x-radius<0||x+radius>=320||y-radius<0||y+radius>=320)continue;
     int support=0,white=0,green=0;
     for(int a=0;a<360;a+=10){int k=pixels.Kind((int)Math.Round(x+radius*Math.Sin(a*Math.PI/180)),(int)Math.Round(y-radius*Math.Cos(a*Math.PI/180)));if(k>0)support++;if(k==1)white++;if(k==2)green++;}
     if(support<31||white<2||green<1)continue;
     candidates.Add(new Candidate{X=x,Y=y,R=radius,Score=support+Math.Min(green,4)*.25});
    }
    var accepted=new List<Ring>();var centers=new List<Candidate>();
    foreach(var c in candidates.OrderByDescending(v=>v.Score)){
     if(centers.Any(v=>Math.Abs(v.X-c.X)<6&&Math.Abs(v.Y-c.Y)<6))continue;centers.Add(c);if(centers.Count>12)break;
     Ring best=null;
     for(int dy=-3;dy<=3;dy+=3)for(int dx=-3;dx<=3;dx+=3){double x=(c.X+dx)*source.Width/320.0,y=(c.Y+dy)*source.Height/320.0;var r=Decode(source,x,y,side);if(r.Valid&&(best==null||r.Confidence>best.Confidence))best=r;}
     if(best!=null)accepted.Add(best);
    }
    if(accepted.Count==0){Evidence="複数中心・複数半径を探索中";return new Ring();}
    var top=accepted.OrderByDescending(v=>v.Confidence).First();
    if(accepted.Any(r=>(Math.Abs(r.CenterX-top.CenterX)>side*.05||Math.Abs(r.CenterY-top.CenterY)>side*.05)&&r.Confidence>=top.Confidence-.08)) {Evidence="複数候補のため入力を保留";return new Ring();}
    cx=top.CenterX/source.Width;cy=top.CenterY/source.Height;locked=true;Evidence="広域円探索＋数字形状＋円弧の一致";return top;
   }
  }
 }
 public sealed class PixelEvidenceGate {
  Ring previous;double at=-1;int votes;
  static double Distance(double a,double b){return Math.Abs((a-b+540)%360-180);}
  public bool Accept(Ring current,double now){
   if(!current.Valid||current.Confidence<.62){previous=null;votes=0;return false;}
   bool same=previous!=null&&now>=at&&now-at<200&&current.Key==previous.Key&&Distance(current.Start,previous.Start)<=7&&Distance(current.End,previous.End)<=10;
   votes=same?votes+1:1;previous=current;at=now;return votes>=2;
  }
 }
}
