using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;

namespace FishingPilot {
 public sealed class Ring {
  public bool Valid, Native; public string Identity=""; public int Key; public double Radius, Pointer, Start, End, Confidence, CenterX, CenterY;
 }
 public sealed class Pixels {
  public int W,H; public byte[] Data;
  public Pixels(Bitmap b) {
   W=b.Width; H=b.Height;
   using(Bitmap copy=new Bitmap(W,H,PixelFormat.Format32bppArgb)) {
    using(Graphics g=Graphics.FromImage(copy))g.DrawImageUnscaled(b,0,0);
    BitmapData d=copy.LockBits(new Rectangle(0,0,W,H),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
    try {Data=new byte[W*H*4];for(int y=0;y<H;y++) Marshal.Copy(IntPtr.Add(d.Scan0,y*d.Stride),Data,y*W*4,W*4);} finally {copy.UnlockBits(d);}
   }
  }
  public void RGB(int x,int y,out int r,out int g,out int b) {x=Math.Max(0,Math.Min(W-1,x));y=Math.Max(0,Math.Min(H-1,y));int i=(y*W+x)*4;b=Data[i];g=Data[i+1];r=Data[i+2];}
  public int Kind(int x,int y) {
   int r,g,b;RGB(x,y,out r,out g,out b);
   if(Math.Min(r,Math.Min(g,b))>185 && Math.Max(r,Math.Max(g,b))-Math.Min(r,Math.Min(g,b))<48)return 1;
   if(g>r+20 && b>r+15 && g>70 && g>b-40 && g<245)return 2;
   if(b>=42 && b<=122 && g>=32 && g<=110 && r>=24 && r<=95 && b>=r && b-r<40)return 3;
   return 0;
  }
 }
 public sealed class RingReader {
  readonly Dictionary<int,List<bool[]>> templates=new Dictionary<int,List<bool[]>>();
  static readonly double[] Sin=Enumerable.Range(0,180).Select(i=>Math.Sin(i*2*Math.PI/180)).ToArray();
  static readonly double[] Cos=Enumerable.Range(0,180).Select(i=>Math.Cos(i*2*Math.PI/180)).ToArray();
  public RingReader(string templateFile) {
   var map=new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(File.ReadAllText(templateFile));
   foreach(var e in map){int k=Int32.Parse(e.Key);templates[k]=new List<bool[]>{e.Value.Select(c=>c=='1').ToArray()};AddResampledTemplates(k,e.Value);}
   for(int k=0;k<=9;k++) if(!templates.ContainsKey(k)) {
    templates[k]=new List<bool[]>();
    foreach(string font in new[]{"Segoe UI","Arial","Tahoma"}) using(Bitmap b=new Bitmap(320,320)) {
     using(Graphics g=Graphics.FromImage(b))using(Font f=new Font(font,48,FontStyle.Regular,GraphicsUnit.Pixel)) {
      g.Clear(Color.Black);g.TextRenderingHint=System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
      StringFormat sf=new StringFormat();sf.Alignment=StringAlignment.Center;sf.LineAlignment=StringAlignment.Center;
      g.DrawString(k.ToString(),f,Brushes.White,new RectangleF(125,122,70,76),sf);
     }
     bool[] mask=Glyph(new Pixels(b),64);if(mask!=null)templates[k].Add(mask);
    }
   }
  }
  void AddResampledTemplates(int key,string mask) {
   // Match the recorded glyph after the actual capture/resize pipeline, not by
   // weakening the confidence or ambiguity threshold.
   foreach(int width in new[]{key==1?22:36})foreach(int size in new[]{192,256,480,640}) {
    using(var src=new Bitmap(320,320))using(var small=new Bitmap(size,size))using(var normalized=new Bitmap(320,320)) {
     using(var g=Graphics.FromImage(src)){g.Clear(Color.Black);for(int y=0;y<50;y++)for(int x=0;x<width;x++)if(mask[(y*40/50)*24+x*24/width]=='1')g.FillRectangle(Brushes.White,160-width/2+x,135+y,1,1);}
     using(var g=Graphics.FromImage(small))g.DrawImage(src,0,0,size,size);
     using(var g=Graphics.FromImage(normalized)){g.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear;g.DrawImage(small,new RectangleF(0,0,320,320),new RectangleF(0,0,size,size),GraphicsUnit.Pixel);}
     var glyph=Glyph(new Pixels(normalized),60);if(glyph!=null)templates[key].Add(glyph);
    }
   }
  }
  int trackedRadius; readonly System.Diagnostics.Stopwatch acquisitionClock=System.Diagnostics.Stopwatch.StartNew();double acquireAt;
  public Ring ReadFast(Bitmap bitmap){
   if(trackedRadius>0){var fast=Read(bitmap,trackedRadius);if(fast.Valid)return fast;trackedRadius=0;}
   if(acquisitionClock.Elapsed.TotalMilliseconds<acquireAt)return new Ring();
   acquireAt=acquisitionClock.Elapsed.TotalMilliseconds+100;var found=Read(bitmap);if(found.Valid){trackedRadius=(int)found.Radius;acquireAt=0;}return found;
  }
  public Ring Read(Bitmap bitmap,int radiusHint=0) {
   var p=new Pixels(bitmap);var result=new Ring();if(p.W!=320||p.H!=320)return result;
   double best=-1; int radius=0;int[] kinds=null;
   for(int r=radiusHint>0?Math.Max(18,radiusHint-4):18;r<=(radiusHint>0?Math.Min(132,radiusHint+4):132);r++) {
    int n=0,w=0,green=0;var row=new int[180];
    for(int a=0;a<180;a++) {int c=p.Kind((int)Math.Round(160+r*Sin[a]),(int)Math.Round(160-r*Cos[a]));row[a]=c;if(c!=0)n++;if(c==1)w++;if(c==2)green++;}
    if(n<157 || w<1 || green<3)continue;
    double score=n/180.0+0.06*Math.Min(green,5)/5.0;
    if(score>best){best=score;radius=r;kinds=row;}
   }
   if(kinds==null)return result;
   bool[] glyph=Glyph(p,radius);if(glyph==null)return result;
   double first=-1,second=-1;int digit=-1;
   foreach(var e in templates) {
    double score=0;
    foreach(bool[] temp in e.Value) {int inter=0,union=0;for(int i=0;i<glyph.Length;i++){if(glyph[i]&&temp[i])inter++;if(glyph[i]||temp[i])union++;}score=Math.Max(score,inter/(double)Math.Max(1,union));}
    if(score>first){second=first;first=score;digit=e.Key;}else second=Math.Max(second,score);
   }
   result.Key=digit;result.Confidence=first;
   if(first<.62 || first-second<.12)return result;
   int end=0,gap=0,lo=360,hi=-1;
   for(int a=0;a<180;a++) {if(kinds[a]==1){end=a*2;gap=0;}else if(++gap>=4)break;}
   int bestSpan=0;
   for(int a=0;a<180;a++) if(kinds[a]==2) {
    int begin=a,last=a,holes=0;
    while(a<180){if(kinds[a]==2){last=a;holes=0;}else if(++holes>2)break;a++;}
    int span=last-begin+1;if(span>bestSpan){bestSpan=span;lo=begin*2;hi=last*2;}
   }
   if(hi-lo<4 || hi-lo>100)return result;
   result.Valid=true;result.Key=digit;result.Radius=radius;result.Pointer=end;result.Start=lo;result.End=hi;result.Confidence=first;return result;
  }
  public Ring ReadAuto(Bitmap bitmap) {
   double[,] offsets={{0,0},{-.075,0},{.075,0},{0,-.075},{0,.075}};
   for(int i=0;i<offsets.GetLength(0);i++)using(var normalized=new Bitmap(320,320)) {
    using(var g=Graphics.FromImage(normalized)){g.Clear(Color.Black);g.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear;
     float side=Math.Min(bitmap.Width,bitmap.Height),x=(bitmap.Width-side)/2+(float)(side*offsets[i,0]),y=(bitmap.Height-side)/2+(float)(side*offsets[i,1]);
     g.DrawImage(bitmap,new RectangleF(0,0,320,320),new RectangleF(x,y,side,side),GraphicsUnit.Pixel);}
    var ring=Read(normalized);if(ring.Valid)return ring;
   }
   return new Ring();
  }
  public static bool[] Glyph(Pixels p,int radius) {
   int dx=(int)(radius*.48),dy=(int)(radius*.57),w=dx*2+1,h=dy*2+1;
   bool[] mask=new bool[w*h],seen=new bool[w*h];for(int y=0;y<h;y++)for(int x=0;x<w;x++)mask[y*w+x]=p.Kind(160-dx+x,160-dy+y)==1;
   List<int> best=new List<int>();
   for(int i=0;i<mask.Length;i++)if(mask[i]&&!seen[i]) {
    var q=new Queue<int>();var cc=new List<int>();q.Enqueue(i);seen[i]=true;
    while(q.Count>0){int n=q.Dequeue();cc.Add(n);int x=n%w,y=n/w;for(int yy=Math.Max(0,y-1);yy<=Math.Min(h-1,y+1);yy++)for(int xx=Math.Max(0,x-1);xx<=Math.Min(w-1,x+1);xx++){int v=yy*w+xx;if(mask[v]&&!seen[v]){seen[v]=true;q.Enqueue(v);}}}
    if(cc.Count>best.Count)best=cc;
   }
   if(best.Count<25)return null;
   int x0=w,y0=h,x1=0,y1=0;foreach(int n in best){x0=Math.Min(x0,n%w);x1=Math.Max(x1,n%w);y0=Math.Min(y0,n/w);y1=Math.Max(y1,n/w);}
   int bw=x1-x0+1,bh=y1-y0+1;if(bh<radius*.38||bh>radius*1.08||bw<4)return null;
   var set=new HashSet<int>(best);bool[] output=new bool[960];
   for(int y=0;y<40;y++)for(int x=0;x<24;x++)output[y*24+x]=set.Contains((y0+y*bh/40)*w+x0+x*bw/24);
   return output;
  }
 }
 public sealed class RoundController {
  public int Round, Hits; public bool Latched; public double MissingSince=-1,LastSeen,LastHit=-1000;
  int key=-1,stable;double areaStart,areaEnd,prevPointer,previousAt,velocity;bool haveArea;string identity="";
  public void Reset(){Round=0;Hits=0;Latched=false;MissingSince=-1;LastSeen=0;LastHit=-1000;key=-1;stable=0;haveArea=false;identity="";previousAt=velocity=0;}
  public void InputRejected(){Latched=false;Hits=Math.Max(0,Hits-1);LastHit=-1000;}
  public int Observe(Ring r,double now,double observationAgeMs=0) {
   if(!r.Valid){if(MissingSince<0)MissingSince=now;stable=0;return -1;}
   bool reappeared=MissingSince>=0 && now-MissingSince>=100;
   bool reset=key!=r.Key || (r.Native && haveArea && (identity!=r.Identity || Math.Abs(r.Start-areaStart)>6)) || (haveArea && r.Pointer<prevPointer-45) || (reappeared && r.Pointer<60 && now-LastHit>200);
   if(reset && now-LastHit>=65){Round++;Latched=false;haveArea=false;stable=0;}
   double step=(r.Pointer-prevPointer+540)%360-180,dt=now-previousAt;
   if(!reset&&dt>=2&&dt<=180&&step>=0&&step/dt<=2)velocity=velocity==0?step/dt:velocity*.5+step/dt*.5;else if(reset)velocity=0;
   previousAt=now;MissingSince=-1;LastSeen=now;prevPointer=r.Pointer;
   if(!haveArea){areaStart=r.Start;areaEnd=r.End;haveArea=true;key=r.Key;identity=r.Identity;}
   else if(!Latched && r.Start<areaStart){areaStart=r.Start;areaEnd=Math.Max(areaEnd,r.End);}
   stable++;
   double span=(areaEnd-areaStart+360)%360;
   double lead=observationAgeMs>0 ? Math.Min(span*.45, velocity*Math.Max(0,Math.Min(50,observationAgeMs+6))) : 0;
   double progress=(r.Pointer+lead-areaStart+360)%360;
   double margin=Math.Max(1.75,Math.Min(3,span*.1));double observedProgress=(r.Pointer-areaStart+360)%360;
   if(!Latched && stable>=2 && now-LastHit>80 && observedProgress>=margin && observedProgress<=span-margin && progress>=margin && progress<=span-margin) {Latched=true;LastHit=now;Hits++;return r.Key;}
   return -1;
  }
 }
 public sealed class Inventory {
  public bool Known;public long Weight,Maximum;public Dictionary<string,string> Labels=new Dictionary<string,string>();public HashSet<string> ProtectedNames=new HashSet<string>(StringComparer.Ordinal);public Dictionary<string,long> Counts=new Dictionary<string,long>();
  public static Inventory Parse(string text) {
   var v=new Inventory();if(text==null || !text.StartsWith("SNAPSHOT ",StringComparison.Ordinal))return v;
   string[] fields=text.Trim().Split(new[]{' '},6);long used,slots;
   if(fields.Length!=6||!Int64.TryParse(fields[1],out v.Weight)||!Int64.TryParse(fields[2],out v.Maximum)||!Int64.TryParse(fields[3],out used)||!Int64.TryParse(fields[4],out slots)||v.Weight<0||v.Maximum<=0)return v;
   if(fields[5]!="-")foreach(string entry in fields[5].Split(',')) {int dot=entry.IndexOf('.'),eq=entry.LastIndexOf('=');long count;if(dot<0||eq<=dot||!Int64.TryParse(entry.Substring(eq+1),out count)||count<0)return new Inventory();string id=entry.Substring(dot+1,eq-dot-1);int slot;int meta=id.IndexOf('.');if(meta>0&&Int32.TryParse(entry.Substring(0,dot),out slot)&&slot<=5)v.ProtectedNames.Add(id.Substring(0,meta));long old;v.Counts.TryGetValue(id,out old);v.Counts[id]=old+count;}
   v.Known=true;return v;
  }
  public bool IncreasedSince(Inventory old) {if(!Known||old==null||!old.Known)return false;foreach(var e in Counts){long n;old.Counts.TryGetValue(e.Key,out n);if(e.Value>n)return true;}return false;}
  public bool Full(long reserve){return Known && Maximum-Weight<=reserve;}
 }
 public sealed class VitalGauge {public bool Known;public double Value,X,Y,Radius;}
 public static class HudReader {
  public static VitalGauge Read(Bitmap hud,bool food,double configuredX,double configuredY,double configuredRadius) {
   Pixels p=new Pixels(hud);
   if(configuredX>=0)return Measure(p,configuredX,configuredY,configuredRadius,food);
   VitalGauge best=new VitalGauge();double score=0;
   for(int r=15;r<=38;r+=2)for(int y=Math.Max(r,p.H-100);y<p.H-r;y+=3)for(int x=r;x<Math.Min(p.W-r,280);x+=3) {
    int color=0,support=0;for(int a=0;a<360;a+=20){int rr,g,b;p.RGB((int)(x+r*Math.Sin(a*Math.PI/180)),(int)(y-r*Math.Cos(a*Math.PI/180)),out rr,out g,out b);if(IsGaugeColor(rr,g,b,true))color++;if(IsGaugeColor(rr,g,b,true)||(rr<115&&g<115&&b<135))support++;}
    if(color<3||support<16)continue;
    int white=0;for(int yy=-r/2;yy<=r/2;yy+=2)for(int xx=-r/2;xx<=r/2;xx+=2)if(p.Kind(x+xx,y+yy)==1)white++;
    if(white<12)continue;
    double sc=color+support*.15+Math.Min(white,70)*.01;
    if(sc>score){score=sc;best=Measure(p,x,y,r,true);}
   }
   if(food || !best.Known)return best;
   VitalGauge water=new VitalGauge();double max=-1;
   for(int dx=(int)(best.Radius*2);dx<best.Radius*3.4;dx+=2) {var a=Measure(p,best.X+dx,best.Y,best.Radius,false);if(a.Known && a.Value>max){max=a.Value;water=a;}}
   return water;
  }
  static bool IsGaugeColor(int r,int g,int b,bool food){return food ? r>135 && g>50 && g<210 && b<115 && r>g+30 : b>95 && g>70 && b>r+35 && g>r+20;}
  static VitalGauge Measure(Pixels p,double x,double y,double r,bool food) {
   if(x-r<0||y-r<0||x+r>=p.W||y+r>=p.H)return new VitalGauge();
   int colored=0,support=0,white=0;for(int a=0;a<360;a+=3) {
    bool hit=false,known=false;for(int dr=-1;dr<=1;dr++){int rr,g,b;p.RGB((int)Math.Round(x+(r+dr)*Math.Sin(a*Math.PI/180)),(int)Math.Round(y-(r+dr)*Math.Cos(a*Math.PI/180)),out rr,out g,out b);hit|=IsGaugeColor(rr,g,b,food);known|=(rr<115&&g<115&&b<135);}
    if(hit)colored++;if(hit||known)support++;
   }
   for(int yy=-(int)r/2;yy<r/2;yy+=2)for(int xx=-(int)r/2;xx<r/2;xx+=2)if(p.Kind((int)x+xx,(int)y+yy)==1)white++;
   return new VitalGauge {Known=support>=110&&white>=12,Value=colored*100.0/120,X=x,Y=y,Radius=r};
  }
 }
 public interface IStorageService {bool Supported {get;} void RequestStorage();}
 public sealed class NoStorage : IStorageService {public bool Supported{get{return false;}}public void RequestStorage(){throw new NotSupportedException("この版は重量通知のみです");}}
}
