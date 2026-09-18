from pathlib import Path
r=Path(__file__).parent

def edit(name,old,new,count=1):
 p=r/name;s=p.read_text(encoding='utf-8-sig')
 if s.count(old)!=count:raise RuntimeError(f'{name}: {s.count(old)} occurrences for {old[:65]}')
 p.write_text(s.replace(old,new),encoding='utf-8-sig')
if 'IncludeExistingCatch' in (r/'Engine.cs').read_text(encoding='utf-8-sig'):raise SystemExit(0)
edit('Engine.cs','public bool AutoStorage=false,HighAccuracy=true;','public bool AutoStorage=false,HighAccuracy=true,IncludeExistingCatch=false;')
edit('Engine.cs','catchLedger=new CatchLedger(t.Inventory);','catchLedger=new CatchLedger(t.Inventory,options.IncludeExistingCatch&&storageRegistration!=null?storageRegistration.Items:null);')
edit('StorageModel.cs','public CatchLedger(Inventory initial){if(initial!=null&&initial.Known)foreach(var e in initial.Counts){string name=Name(e.Key);long n;protectedNames.TryGetValue(name,out n);protectedNames[name]=n+e.Value;}}','public CatchLedger(Inventory initial,IEnumerable<string> includeExisting=null){var approved=new HashSet<string>(includeExisting??new string[0],StringComparer.Ordinal);if(initial!=null&&initial.Known)foreach(var e in initial.Counts){string name=Name(e.Key);if(approved.Contains(name)){earned[e.Key]=e.Value;continue;}long n;protectedNames.TryGetValue(name,out n);protectedNames[name]=n+e.Value;}}')
edit('Program.cs','"AutoStorage","HighAccuracy"};','"AutoStorage","HighAccuracy","IncludeExistingCatch"};')
edit('Program.cs','if(d.Count<8||d.Count>keys.Count)','if(d.Count<8||d.Count>keys.Count)')
edit('Program.cs','if(d.ContainsKey("HighAccuracy"))o.HighAccuracy=Bool(d,"HighAccuracy");','if(d.ContainsKey("HighAccuracy"))o.HighAccuracy=Bool(d,"HighAccuracy");if(d.ContainsKey("IncludeExistingCatch"))o.IncludeExistingCatch=Bool(d,"IncludeExistingCatch");')
edit('ui/app.js',"'AutoStorage','HighAccuracy'];","'AutoStorage','HighAccuracy','IncludeExistingCatch'];")
edit('ui/index.html','<h2>ホットバーと容量</h2>','''<div class="card"><label class="row"><span>開始時の魚も収納<small>選択した魚のみ。OFFなら開始前の品は保護</small></span><span class="toggle toggle-init"><input id="IncludeExistingCatch" type="checkbox"><span class="toggle-icon"></span></span></label></div><h2>ホットバーと容量</h2>''')
edit('ui/index.html','開始後に増加を確認した選択済みの釣果だけを収納します。','開始後に増加を確認した選択済みの釣果だけを収納します。設定の「開始時の魚も収納」を明示的にONにした場合だけ、選択した魚の初期所持分も対象になります。')
edit('Tests040.cs','   var options=new Options','   var explicitInitial=new CatchLedger(view.Left,new[]{"fish"});Check(StorageIntent.Plan(reg,view,explicitInitial).Count==13,"initial fish require explicit opt-in");\n   var options=new Options')
print('Explicit pre-existing fish authorization added; default remains protected')
