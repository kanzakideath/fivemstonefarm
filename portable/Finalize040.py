from pathlib import Path
r=Path(__file__).parent

def edit(name,old,new,count=1):
 p=r/name;s=p.read_text(encoding='utf-8-sig')
 if s.count(old)!=count:raise RuntimeError(f'{name}: expected {count}, got {s.count(old)}: {old[:70]}')
 p.write_text(s.replace(old,new),encoding='utf-8-sig')

if 'InventoryOpen;' in (r/'Engine.cs').read_text(encoding='utf-8-sig'):
 print('Final guards already integrated');raise SystemExit(0)
edit('Engine.cs','public sealed class Telemetry {public bool Known;','public sealed class Telemetry {public bool Known,InventoryOpen;')
edit('BridgeRead.cs','var inv=FishingPilot.Inventory.Parse(FormatInventorySnapshotResult(raw));','var inv=FishingPilot.Inventory.Parse(FormatInventorySnapshotResult(raw));\n    string inventoryState=await session.EvaluateStringAsync(ClosedInventoryStateExpression(),false).ConfigureAwait(false);')
edit('BridgeRead.cs','Known=inv.Known,Inventory=inv,Epoch=epoch','Known=inv.Known,InventoryOpen=inventoryState!="CLOSED",Inventory=inv,Epoch=epoch')
edit('Engine.cs','castIssued&&t.Known&&Now-t.At<2200','castIssued&&t.Known&&!t.InventoryOpen&&Now-t.At<2200')
edit('Engine.cs','if(fresh&&scene.Cost<100','if(fresh&&!t.InventoryOpen&&scene.Cost<100')
edit('Engine.cs','     if(!present&&!castIssued) {','''     if(!present&&!castIssued&&fresh&&t.InventoryOpen&&!reconcileStorage){phase="inventory";reason="所持品画面を閉じるまで入力を保留します";Emit(t,scene,Now,foreground);token.WaitHandle.WaitOne(60);continue;}
     if(!present&&!castIssued) {''')
edit('Engine.cs','case "storage":return "収納と釣り再開の確認";','case "storage":return "収納と釣り再開の確認";case "inventory":return "所持品画面の閉鎖待ち";')
edit('StorageModel.cs','foreach(var row in rows.OrderByDescending(x=>x.Slot)){','var hotbarNames=new HashSet<string>(rows.Where(x=>x.Slot<=5).Select(x=>x.Name),StringComparer.Ordinal);\n   foreach(var row in rows.OrderByDescending(x=>x.Slot)){')
edit('StorageModel.cs','if(row.Slot<=5||!allow.Contains(row.Name)','if(row.Slot<=5||hotbarNames.Contains(row.Name)||!allow.Contains(row.Name)')
edit('FishingStorage.cs','   if(port==0||port!=FishingPilot.Native.FiveMConsolePort())return "NO_REGISTERED_TARGET_INPUT";','''   token.ThrowIfCancellationRequested();
   string existing=await Eval(TargetFramePart,StorageTargetExpression(false),false,2000).ConfigureAwait(false);
   if(existing=="AMBIGUOUS")return "AMBIGUOUS_STORAGE_TARGET";
   if(existing=="PRESENT"){await Task.Delay(60,token).ConfigureAwait(false);return await Eval(TargetFramePart,StorageTargetExpression(true),true,2000).ConfigureAwait(false);}
   if(port==0||port!=FishingPilot.Native.FiveMConsolePort())return "NO_REGISTERED_TARGET_INPUT";''')
edit('TestStorage.py',"('NO_DELTA',\"inventory.leftInventory.items[2].metadata={quality:'other'}\")","('UNAUTHORIZED_DELTA',\"inventory.leftInventory.items[2].metadata={quality:'other'}\")")
# Retain safe captured glyph fixtures as synthetic tests; no user game screenshots enter GitHub.
edit('Tests040.cs','   File.WriteAllText(Path.Combine(output,"storage040.txt")','''   string templates=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"digit-templates.json");
   foreach(int digit in new[]{1,2,3})using(var fixture=new Bitmap(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"fixtures","ring-"+digit+"-60.png")))using(var shifted=new Bitmap(420,420)){
    using(var g=Graphics.FromImage(shifted)){g.Clear(Color.Black);g.DrawImage(fixture,new Rectangle(70,40,320,320));}
    var reader=new AdaptiveRingReader(templates);var found=reader.ReadAuto(shifted);Check(found.Valid&&found.Key==digit,"off-center adaptive image acquisition "+digit);
    found=reader.ReadAuto(shifted);Check(found.Valid&&found.Key==digit,"cached local tracking "+digit);
   }
   File.WriteAllText(Path.Combine(output,"storage040.txt")''')
# Add a UI-only storage selection test to each responsive viewport in the existing browser suite.
edit('TestUi.py',"  page.locator('[data-page=version]').click();",'''  storage={'registered':False,'candidateId':'trunk-test','candidateLabel':'Test truck','candidates':[{'name':'fish','count':3}],'selected':[]}
  page.evaluate('(d)=>window.__receive({data:d})',{**state,'storage':storage});page.locator('[data-page=storage]').click();page.wait_for_timeout(100)
  page.locator('[data-storage-item=fish]').check();page.locator('#storage-register').click();assert page.evaluate("__sent.some(m=>m.action==='storage.register'&&m.items[0]==='fish')")
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  page.screenshot(path=str(out/f'storage-{width}.png'),full_page=True)
  page.locator('[data-page=version]').click();''')
print('Final inventory/target guards and extended recognition/storage UI tests ready')
