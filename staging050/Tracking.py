from pathlib import Path
root=Path('portable')
p=root/'AdaptiveRecognition.cs';s=p.read_text(encoding='utf-8-sig');needle='  sealed class Candidate'
assert needle in s
s=s.replace(needle,'''  public Ring ReadTracked(Bitmap source){
   if(!locked)return new Ring();
   var r=Decode(source,cx*source.Width,cy*source.Height,Math.Min(source.Width,source.Height));
   if(r.Valid)Evidence="追跡＋数字形状＋円弧";else locked=false;
   return r;
  }
''' +needle);p.write_text(s,encoding='utf-8-sig')
p=root/'Engine.cs';s=p.read_text(encoding='utf-8-sig');a='side,side),320,320))r=reader.ReadAuto(image);';b='side,side),320,320)){r=reader.ReadAuto(image);if(!r.Valid&&options.HighAccuracy)r=precise.ReadTracked(image);}'
assert a in s;s=s.replace(a,b);p.write_text(s,encoding='utf-8-sig')
