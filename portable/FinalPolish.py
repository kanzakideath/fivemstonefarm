from pathlib import Path
root=Path(__file__).resolve().parent
def change(file,old,new):
 p=root/file;s=p.read_text(encoding='utf-8-sig');assert s.count(old)==1,(file,old[:80],s.count(old));p.write_text(s.replace(old,new,1),encoding='utf-8-sig' if file.endswith(('.cs','.ps1')) else 'utf-8',newline='\n')
change('FishCore.cs',"foreach(var e in map)templates[Int32.Parse(e.Key)]=new List<bool[]>{e.Value.Select(c=>c=='1').ToArray()};", "foreach(var e in map){int k=Int32.Parse(e.Key);templates[k]=new List<bool[]>{e.Value.Select(c=>c=='1').ToArray()};AddResampledTemplates(k,e.Value);}")
change('FishCore.cs','  public Ring Read(Bitmap bitmap) {', '''  void AddResampledTemplates(int key,string mask) {
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
  public Ring Read(Bitmap bitmap) {''')
change('FishCore.cs','   if(first<.62 || first-second<.12)return result;','   result.Key=digit;result.Confidence=first;\n   if(first<.62 || first-second<.12)return result;')
change('Tests.cs','"auto pixel scale "+size+" "+file','"auto pixel scale "+size+" "+file+" valid="+r.Valid+" key="+r.Key+" score="+r.Confidence')
change('RecastPolicy.cs','namespace FishingPilot {','''namespace FishingPilot {
 public sealed class OutcomeLatch {
  public bool Terminal,Failed,Full,Blocked;
  public void Mark(string kind){Terminal|=kind=="CAUGHT"||kind=="FAIL"||kind=="CANCEL";Failed|=kind=="FAIL"||kind=="CANCEL";Full|=kind=="FULL";Blocked|=kind=="BLOCK";}
  public void Clear(){Terminal=Failed=Full=Blocked=false;}
 }
''')
change('Engine.cs','  Inventory before;RoundController round=new RoundController();','  OutcomeLatch outcomes=new OutcomeLatch();\n  Inventory before;RoundController round=new RoundController();')
change('Engine.cs','round.Reset();epoch="";','round.Reset();outcomes.Clear();epoch="";')
change('Engine.cs','if(castIssued){terminal|=n.Kind=="CAUGHT"','if(castIssued){outcomes.Mark(n.Kind);terminal|=n.Kind=="CAUGHT"')
change('Engine.cs','     if(options.ObserveOnly){','     terminal|=outcomes.Terminal;fail|=outcomes.Failed;block|=outcomes.Blocked;fullNotice|=outcomes.Full;\n     if(options.ObserveOnly){')
change('Engine.cs','before=t.Inventory;castIssued=true;seenRing=true;','before=t.Inventory;outcomes.Clear();castIssued=true;seenRing=true;')
change('Engine.cs','phase="recovery";resultWarned=false;','phase="recovery";resultWarned=false;outcomes.Clear();')
change('Engine.cs','before=t.Inventory;round.Reset();seenRing=false;','before=t.Inventory;round.Reset();outcomes.Clear();seenRing=false;')
change('FishingScene.cs','current.Notices.AddRange(chosen.Notices);current.Busy|=chosen.Busy;chosen=current;', 'current.Notices.AddRange(chosen.Notices);current.Busy|=chosen.Busy;if(current.Hunger<0)current.Hunger=chosen.Hunger;if(current.Water<0)current.Water=chosen.Water;chosen=current;')
change('Tests.cs','    NativeInputTest(notes);','''    var pending=new OutcomeLatch();pending.Mark("FAIL");pending.Mark("NONE");
    Check(pending.Terminal&&pending.Failed,"terminal notice survives a later frame before ring closure");
    pending.Clear();Check(!pending.Terminal&&!pending.Full,"new cast clears previous terminal event");
    pending.Mark("FULL");Check(pending.Full&&!pending.Terminal,"full capacity is distinct from catch");
    pending.Mark("BLOCK");Check(pending.Blocked,"missing rod or bait stays blocked");
    notes.Add("pending outcomes: notice retention, per-cast reset, full and blocked causes separated");
    NativeInputTest(notes);''')
print('POLISH_APPLIED: scaled glyph templates, retained terminal notices, frame-vitals merge')
