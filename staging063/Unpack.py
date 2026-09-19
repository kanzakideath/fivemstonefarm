from pathlib import Path
import gzip,json,hashlib
p=Path(__file__).resolve().parent
b=b''.join((p/('bundle'+str(i)+'.part')).read_bytes() for i in range(4))
assert hashlib.sha256(b).hexdigest()=='9f7ee6cd26cb0a23aed94254fddd89808d2416f76e868f6518224d5b824ef05e','Source bundle integrity mismatch'
for name,text in json.loads(gzip.decompress(b)).items():
 assert Path(name).name==name and not name.startswith('.'),name
 (p/name).write_text(text,encoding='utf-8',newline='\n')
f=p/'Refine.py'
f.write_text(f.read_text(encoding='utf-8')+'''
f=p/'FishingScene.cs';s=f.read_text(encoding='utf-8')
s=s.replace('finally{root.FishingDeadline(-1);}', 'finally{try{root.FishingDeadline(-1);}catch(ObjectDisposedException){}}')
s=s.replace('public string Discovery="";', 'public string RenderVisibility=""; public bool RenderFocused; public string Discovery="";')
s=s.replace('return scene;','scene.RenderVisibility=GetString(d,"documentVisible");scene.RenderFocused=Bool(d,"focused");return scene;')
f.write_text(s,encoding='utf-8',newline='\\n')
f=p/'Engine.cs';s=f.read_text(encoding='utf-8').replace('+" input_reason="+s.InputReason', '+" visibility="+s.RenderVisibility+" nui_focus="+s.RenderFocused+" input_reason="+s.InputReason')
f.write_text(s,encoding='utf-8',newline='\\n')
f=p/'SceneProbe.js';s=f.read_text(encoding='utf-8').replace("if(!t||t.length>400)continue;", "if(!t){notices.delete(e);continue;}if(t.length>400)continue;")
f.write_text(s,encoding='utf-8',newline='\\n')
''',encoding='utf-8',newline='\n')
# Match the requested state: actual browser window covered by a different desktop
# app, not a second tab selected inside the game browser. A hidden tab was shown
# to throttle requestAnimationFrame to ~2 FPS even with document focus emulated.
f=p/'BrowserPeer.py';s=f.read_text(encoding='utf-8')
s=s.replace('launch(headless=True,', "launch(headless=False,args=['--window-size=1000,760','--window-position=0,0'],")
s=s.replace("  other=await ctx.new_page();await other.set_content('<textarea autofocus>Editor tab</textarea>');await other.bring_to_front()", '  # Win32 editor covers this real browser window throughout the test.')
s=s.replace('  # Another browser tab is selected too; the Win32 harness keeps a distinct editor foreground.', '  # Keep the game tab selected; the Win32 harness owns desktop foreground.')
s=s.replace("     value=await frames[i].evaluate(expr)", """     value=await frames[i].evaluate(expr)
     if i==3 and '__fpProbe3' in expr and isinstance(value,str) and value.startswith('{'):
      sample=json.loads(value);ring=sample.get('ring',{});entry={'at':sample.get('at'),'ring':ring,'input':sample.get('input'),'visibility':sample.get('documentVisible'),'focused':sample.get('focused')}
      reads=trace.setdefault('reads',[])
      if len(reads)<2500 and (ring.get('present') or (reads and reads[-1]['ring'].get('present'))):reads.append(entry)
""")
f.write_text(s,encoding='utf-8',newline='\n')
f=p/'Integration.cs';s=f.read_text(encoding='utf-8').replace('editor.StartPosition=FormStartPosition.CenterScreen;', 'editor.StartPosition=FormStartPosition.Manual;editor.Location=new Point(0,0);editor.WindowState=FormWindowState.Maximized;')
f.write_text(s,encoding='utf-8',newline='\n')
print('Source bundle verified and extracted')
# A pending second cast is deliberately left in flight when F6 is pressed.
# Its later natural timeout is expected, but any failure before host stop, or
# any digit sent after stop, must still fail the integration gate.
f=p/'BrowserPeer.py';s=f.read_text(encoding='utf-8')
s=s.replace("trace['rounds'].append(json.loads(route.request.post_data));", "entry=json.loads(route.request.post_data);entry['after_host_stop']='stopped_at' in trace;trace['rounds'].append(entry);")
s=s.replace("     value=await frames[i].evaluate(expr)", "     if i==2 and '__fpSlots063.stop()' in expr:trace['stopped_at']=time.monotonic();persist()\n     value=await frames[i].evaluate(expr)")
f.write_text(s,encoding='utf-8',newline='\n')
f=p/'RunBackground.ps1';s=f.read_text(encoding='utf-8').replace("Where-Object {!$_.ok}", "Where-Object {!$_.ok -and !($_.after_host_stop -and $null -eq $_.key)}")
f.write_text(s,encoding='utf-8',newline='\n')
f=p/'Package.py';s=f.read_text(encoding='utf-8').replace("all(x['ok'] for x in b['rounds'])", "all(x['ok'] or (x.get('after_host_stop') and x.get('key') is None) for x in b['rounds'])")
s=s.replace(" assert b['actual_inventory_js']>0", " assert not any(x.get('after_host_stop') and x.get('key') is not None for x in b['rounds']), 'digit after host stop'\n assert b['actual_inventory_js']>0")
f.write_text(s,encoding='utf-8',newline='\n')
# Keep cached observations raw: merged busy flags must not feed themselves back
# through other frames and remain true indefinitely after a progress bar ends.
f=p/'Refine.py';s=f.read_text(encoding='utf-8')
s+='''
f=p/'FishingScene.cs';s=f.read_text(encoding='utf-8')
s=s.replace('recent[url]=value;', 'recent[url]=new FishingPilot.Scene{At=value.At,Busy=value.Busy,Hunger=value.Hunger,Water=value.Water,Notices=new List<FishingPilot.Notice>(value.Notices)};')
f.write_text(s,encoding='utf-8',newline='\\n')
'''
f.write_text(s,encoding='utf-8',newline='\n')
f=p/'Integration.cs';s=f.read_text(encoding='utf-8')
s=s.replace('[STAThread]static int Main', '''static void CheckRawCache(){
 var type=typeof(Engine).Assembly.GetType("CdpBridge+FishingConnection");
 using(var link=(IDisposable)Activator.CreateInstance(type,new object[]{"",CancellationToken.None})){
 var flags=System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic;
 var remember=type.GetMethod("Remember",flags);var merge=type.GetMethod("Ancillary",flags);
 var busy=new Scene{Busy=true};var idle=new Scene();
 remember.Invoke(link,new object[]{"a",busy});remember.Invoke(link,new object[]{"b",idle});merge.Invoke(link,new object[]{idle,0.0});
 if(!idle.Busy)throw new Exception("Expected live busy observation to propagate");
 var clear=new Scene();remember.Invoke(link,new object[]{"a",clear});merge.Invoke(link,new object[]{clear,0.0});
 if(clear.Busy)throw new Exception("Derived busy state polluted the raw cache");
 }}
 [STAThread]static int Main''')
s=s.replace('try{using(var game=', 'try{CheckRawCache();result["raw_cache_regression"]=true;using(var game=')
f.write_text(s,encoding='utf-8',newline='\n')
