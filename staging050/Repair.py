from pathlib import Path
root=Path('portable')
def read(n):return (root/n).read_text(encoding='utf-8-sig')
def write(n,s):(root/n).write_text(s,encoding='utf-8-sig')
def replace(s,a,b):
 if a not in s:raise ValueError('missing:'+a[:100])
 return s.replace(a,b)
s=read('FishCore.cs');s=replace(s,'public bool Known;public long Weight,Maximum;', 'public bool Known;public long Weight,Maximum;public Dictionary<string,string> Labels=new Dictionary<string,string>();public HashSet<string> ProtectedNames=new HashSet<string>(StringComparer.Ordinal);')
s=replace(s,'string id=entry.Substring(dot+1,eq-dot-1);long old;', 'string id=entry.Substring(dot+1,eq-dot-1);int slot;int meta=id.IndexOf(\'.\');if(meta>0&&Int32.TryParse(entry.Substring(0,dot),out slot)&&slot<=5)v.ProtectedNames.Add(id.Substring(0,meta));long old;')
write('FishCore.cs',s)
s=read('CdpBridge.cs');s=replace(s,'entries.push({slot:slot,name:name,count:count,meta:metadata});','entries.push({slot:slot,name:name,count:count,meta:metadata,label:String(item.label||(item.metadata&&item.metadata.label)||name).slice(0,128)});')
s=replace(s,'double side=Math.Min(h*.4,Math.Min(w,h));','double side=FishingPilot.InputPolicy.CaptureSide((int)w,(int)h);')
pos=s.index('        public static Task<CdpSession> OpenAsync(')
s=s[:pos]+'''        public async Task<bool> FishingKey(int digit, CancellationToken cancel) {
            if(digit<0||digit>9||cancel.IsCancellationRequested)return false;
            var args=new Dictionary<string,object>{{"type","rawKeyDown"},{"key",digit.ToString(CultureInfo.InvariantCulture)},{"code","Digit"+digit},{"windowsVirtualKeyCode",48+digit},{"nativeVirtualKeyCode",48+digit},{"modifiers",0},{"autoRepeat",false}};
            bool attempted=false;
            try{cancel.ThrowIfCancellationRequested();attempted=true;await CommandAsync(_socket,"Input.dispatchKeyEvent",args,_timeout.Token).ConfigureAwait(false);return true;}
            finally{if(attempted){args["type"]="keyUp";await CommandAsync(_socket,"Input.dispatchKeyEvent",args,_timeout.Token).ConfigureAwait(false);}}
        }
''' +s[pos:];write('CdpBridge.cs',s)
s=read('BridgeRead.cs');s=replace(s,'var inv=FishingPilot.Inventory.Parse(FormatInventorySnapshotResult(raw));','''var inv=FishingPilot.Inventory.Parse(FormatInventorySnapshotResult(raw));
    if(raw.StartsWith("SNAPSHOT_DETAIL ",StringComparison.Ordinal))try{var d=Json.DeserializeObject(raw.Substring(16)) as System.Collections.Generic.Dictionary<string,object>;foreach(var item in (object[])d["items"]){var row=(System.Collections.Generic.Dictionary<string,object>)item;string n=GetString(row,"name"),label=GetString(row,"label");if(label.Length>0&&label.Length<=128)inv.Labels[n]=label;}}catch{}''');write('BridgeRead.cs',s)
s=read('FishingScene.cs');s=replace(s,'public Ring Ring=new Ring();','public string Discovery=""; public Ring Ring=new Ring();')
s=replace(s,'if(u.IndexOf("cfx-nui-",StringComparison.OrdinalIgnoreCase)>=0&&!result.Contains(u))result.Add(u);','if((u.IndexOf("cfx-nui-",StringComparison.OrdinalIgnoreCase)>=0||u.StartsWith("nui://",StringComparison.OrdinalIgnoreCase))&&!result.Contains(u))result.Add(u);')
s=replace(s,'string selected="";', 'string selected=""; readonly Dictionary<string,double> failedUntil=new Dictionary<string,double>(); public string LastDiscovery="";')
s=replace(s,'if(chosen.Present){lastRingAt=now;return chosen;}', 'if(chosen.Present){lastRingAt=now;chosen.Discovery=LastDiscovery;return chosen;}')
s=replace(s,'var current=await ReadOne(u,false,cycle,false).ConfigureAwait(false);','''double until;if(failedUntil.TryGetValue(u,out until)&&until>now)continue;
    FishingPilot.Scene current;try{current=await ReadOne(u,false,cycle,false).ConfigureAwait(false);}catch(Exception e){if(e.Message.Contains("SERVER_SESSION_CHANGED"))throw;failedUntil[u]=now+5000;LastDiscovery="frames="+urls.Count+" failed="+failedUntil.Count;continue;}
    LastDiscovery="frames="+urls.Count+" scanned="+scan+" present="+current.Present+" source="+current.Source;''')
s=replace(s,'   return chosen;\n  }','   chosen.Discovery=LastDiscovery;return chosen;\n  }')
pos=s.index('  public static int ConsolePort()')
s=s[:pos]+'''  // Raster fallback requires a consistently observed central game ring.
  // Keyboard focus remains in a local game iframe; no desktop fallback.
  public async Task<bool> PixelDigit(FishingPilot.Scene scene,int digit) {
   token.ThrowIfCancellationRequested();if(digit<0||digit>9)return false;
   var root=await Get("nui://game/ui/root.html").ConfigureAwait(false);
   string focus=await Read(root,@"(() => {const a=document.activeElement;if(!a)return 'NONE';if(a.matches('input,textarea,[contenteditable=true]'))return 'EDITING';if(a.tagName==='IFRAME'){const s=a.src||'';return /cfx-nui-|^nui:/.test(s)&&!/ox_inventory|chat|phone|browser/i.test(s)?s:'NONE';}return 'NONE';})()").ConfigureAwait(false);
   if(focus!="NONE"&&focus!="EDITING"&&urls.Any(u=>u==focus)) {
    var focused=await Get(focus).ConfigureAwait(false);
    string guard=await Read(focused,"(() => {const a=document.activeElement;return a&&a.matches('input,textarea,[contenteditable=true]')?'EDITING':'OK';})()").ConfigureAwait(false);
    if(guard!="OK")return false;
    root.FishingDeadline(700);try{return await root.FishingKey(digit,token).ConfigureAwait(false);}finally{root.FishingDeadline(-1);}
   }
   if(scene!=null&&scene.Present&&scene.Key==digit&&scene.Frame!="")return await Digit(scene,digit).ConfigureAwait(false);
   return false;
  }
''' +s[pos:];write('FishingScene.cs',s)
s=read('Engine.cs');s=s.replace('0.4.0-preview','0.5.0-preview').replace('F8','F5').replace('F9','F6')
s=replace(s,'public bool AutoStorage=false,HighAccuracy=true,IncludeExistingCatch=false;', 'public bool AutoStorage=false,HighAccuracy=true,IncludeExistingCatch=false,ShowOverlay=true;')
s=replace(s,'public int Casts,Keys,Results;public bool Running;', 'public int Casts,Keys,Results;public bool Running,InventoryFresh;public ItemDisplay[] HeldItems=new ItemDisplay[0],CaughtItems=new ItemDisplay[0];')
s=replace(s,'string epoch="",phase=', 'CatchStatistics statistics;double statsAt; public IntPtr TargetWindow{get{return target;}}\n  string epoch="",phase=')
s=replace(s,'options=o;', 'options=o;statistics=new CatchStatistics(root);statsAt=-1;')
s=replace(s,'public bool Busy {', '''bool idleBusy;
  public async Task RefreshIdleInventory(){if(Busy||idleBusy||disposed)return;idleBusy=true;string marker=sessionId;
   try{using(var reader=new CdpBridge.FishingTelemetryReader()){var t=await reader.Read().ConfigureAwait(false);if(Busy||disposed||sessionId!=marker)return;if(statistics==null)statistics=new CatchStatistics(root);statistics.Observe(t.Known?t.Inventory:null,Now);state.InventoryFresh=t.Known;state.HeldItems=statistics.Held;state.CaughtItems=statistics.Caught;state.Inventory=t.Known?String.Format("{0:F1} / {1:F1} kg",t.Inventory.Weight/1000.0,t.Inventory.Maximum/1000.0):"未確認";Publish();}}
   catch{if(!Busy){state.InventoryFresh=false;Publish();}}finally{idleBusy=false;}
  }
  public bool Busy {''')
s=replace(s,'bool foreground=Native.GetForegroundWindow()==target;','bool foreground=Native.GetForegroundWindow()==target;string route=InputPolicy.Route(foreground,options.BackgroundMode);')
s=replace(s,'if(!foreground&&!options.BackgroundMode){phase="focus";','if(route=="paused"){phase="focus";')
a=s.index('     Scene scene=new Scene();');b=s.index('     scene.Cost=Now-captureAt;',a)
s=s[:a]+'''     Scene scene=new Scene();bool sceneKnown=false;double captureAt=Now;
     Rectangle c=Native.Client(target);Ring r=new Ring();
     // BackgroundMode grants permission when hidden; it cannot disable the foreground path.
     if(foreground&&c.Width>=300&&c.Height>=240){
      int side=(int)InputPolicy.CaptureSide(c.Width,c.Height);captureAt=Now;
      try{using(var image=Native.Capture(new Rectangle(c.X+(c.Width-side)/2,c.Y+(c.Height-side)/2,side,side),320,320))r=reader.ReadAuto(image);
       scene.Source="foreground capture";scene.Present=r.Valid;
      }catch(Exception e){LogThrottled("foreground_capture_retry",e.GetType().Name);}
     }
     if(!r.Valid&&epoch!=""&&now>=sceneRetry)try {
      if(sceneLink==null){sceneLink=new CdpBridge.FishingConnection(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"SceneProbe.js")),token);sceneLink.Initialize(epoch).GetAwaiter().GetResult();Log("nui_connected","frame_discovery_initialized=1");}
      bool permit=!foreground&&options.BackgroundMode&&!options.ObserveOnly&&castIssued&&t.Known&&!t.InventoryOpen&&Now-t.At<2200&&pendingNeed==""&&!token.IsCancellationRequested;
      scene=sceneLink.Poll(permit,castCycle).GetAwaiter().GetResult();sceneKnown=true;r=scene.Ring;captureAt=Now;
      if(token.IsCancellationRequested)break;
     }catch(Exception e){if(token.IsCancellationRequested)break;if(e.Message.Contains("SERVER_SESSION_CHANGED")){Fail("NUI接続の変更を検出しました");break;}LogThrottled("nui_retry",e.GetType().Name+" "+e.Message);if(sceneLink!=null)sceneLink.Dispose();sceneLink=null;sceneRetry=Now+800;}
     if(!r.Valid&&!scene.Source.Contains("ambiguous")){
      // No DOM candidate prerequisite: Canvas and CSS circles must reach raster recognition.
      if(sceneLink!=null)try{captureAt=Now;using(var image=sceneLink.Capture(scene,false).GetAwaiter().GetResult()){r=options.HighAccuracy?precise.ReadAuto(image):reader.ReadAuto(image);}scene.Source="NUI raster";if(r.Valid&&scene.Key>=0&&r.Key!=scene.Key)r.Valid=false;}
       catch(Exception e){LogThrottled("capture_unavailable",e.GetType().Name);}
      if(!r.Valid&&foreground&&options.HighAccuracy&&c.Width>=300&&c.Height>=240){int side=(int)InputPolicy.CaptureSide(c.Width,c.Height);captureAt=Now;using(var image=Native.Capture(new Rectangle(c.X+(c.Width-side)/2,c.Y+(c.Height-side)/2,side,side),320,320))r=precise.ReadAuto(image);scene.Source="foreground adaptive";}
     }
     scene.Present|=r.Valid;
''' +s[b:]
s=replace(s,'state.Backend=options.BackgroundMode?(scene.Ring.Valid?', 'state.Backend=!foreground&&options.BackgroundMode?(scene.Ring.Valid?')
s=replace(s,'if(fresh&&catchLedger==null)', '''if(statsAt!=t.At){statistics.Observe(t.Known?t.Inventory:null,t.At);statsAt=t.At;}
     state.InventoryFresh=fresh;state.HeldItems=statistics.Held;state.CaughtItems=statistics.Caught;
     if(fresh&&catchLedger==null)''')
a=s.index('     if(r.Valid&&castIssued)');b=s.index('     }else if(castIssued)',a)
s=s[:a]+'''     if(r.Valid&&castIssued){seenRing=true;phase="challenge";reason="円と数字を追跡しています";
      bool nativeHandled=!foreground&&options.BackgroundMode&&r.Native;
      if(fresh&&!t.InventoryOpen&&scene.Cost<180&&!nativeHandled){
       bool evidence=r.Native||!options.HighAccuracy||pixelGate.Accept(r,now);
       int key=round.Observe(r,now,Math.Min(45,scene.Cost));
       if(key>=0){bool sent=false,uncertain=false;
        if(!evidence){round.InputRejected();reason="連続した画像の一致を確認しています";}
        else {
         try {if(foreground)sent=Native.Press(target,targetPid,key,token);
          else if(options.BackgroundMode&&sceneLink!=null)sent=sceneLink.PixelDigit(scene,key).GetAwaiter().GetResult();}
         catch(OperationCanceledException){if(token.IsCancellationRequested)throw;uncertain=true;}
         catch(Exception e){uncertain=true;Log("key_delivery_unconfirmed",e.GetType().Name+" no_duplicate=1");}
         if(sent){state.Keys++;state.Delivery="キー送信済み・次の状態を確認中";Log("round_key","key="+key+" round="+round.Round+" backend="+(foreground?"foreground":"focused_nui")+" observed_ms="+scene.Cost.ToString("F0"));}
         else if(!uncertain){round.InputRejected();reason="円は検出。入力を受けるゲームUIを確認できません";LogThrottled("round_not_sent","ring_detected=1 safe_target_unavailable=1 foreground="+foreground);}
        }
       }
      }else reason=nativeHandled?"NUIの描画確認と同じ処理内で入力します":t.InventoryOpen?"インベントリが開いているため判定キーを保留":"所持品の新鮮さ／読み取り時間を再確認しています";
''' +s[b:]
s=replace(s,'if(obtained){state.Results++;', 'if(obtained){state.Results++;statistics.Credit(before,t.Inventory);state.HeldItems=statistics.Held;state.CaughtItems=statistics.Caught;')
s=replace(s,'bool PressSlot(int key,CancellationToken token,bool foreground){\n   if(options.BackgroundMode)', 'bool PressSlot(int key,CancellationToken token,bool foreground){\n   if(foreground)return Native.Press(target,targetPid,key,token);\n   if(options.BackgroundMode)')
s=replace(s,'backend="+(options.BackgroundMode&&consolePort!=0?"registered_hotbar":"foreground")', 'backend="+(!foreground&&options.BackgroundMode&&consolePort!=0?"registered_hotbar":"foreground")')
s=replace(s,'if(options.BackgroundMode&&sceneLink!=null)b=sceneLink.Capture(null,true).GetAwaiter().GetResult();else if(foreground&&c.Height>0)', 'if(!foreground&&options.BackgroundMode&&sceneLink!=null)b=sceneLink.Capture(null,true).GetAwaiter().GetResult();else if(foreground&&c.Height>0)')
s=replace(s,'+s.Width+"x"+s.Height)', '+s.Width+"x"+s.Height+" discovery="+s.Discovery+" input_reason="+s.InputReason)')
s=replace(s,'StoredItems=state.StoredItems});','StoredItems=state.StoredItems,InventoryFresh=state.InventoryFresh,HeldItems=state.HeldItems,CaughtItems=state.CaughtItems});')
write('Engine.cs',s)
s=read('Program.cs').replace('0.4.0','0.5.0').replace('F8','F5').replace('F9','F6')
s=replace(s,'"IncludeExistingCatch"};','"IncludeExistingCatch","ShowOverlay"};')
s=replace(s,'Validate(o);return o;', 'if(d.ContainsKey("ShowOverlay"))o.ShowOverlay=Bool(d,"ShowOverlay");Validate(o);return o;')
s=replace(s,'WebView2 view;Engine engine;', 'StatusOverlay overlay; WebView2 view;Engine engine;')
s=replace(s,'engine.Changed+=OnState;engine.Alert+=OnAlert;', 'engine.Changed+=OnState;engine.Alert+=OnAlert;overlay=new StatusOverlay();')
s=replace(s,'timer.Stop();engine.Dispose();', 'timer.Stop();overlay.Dispose();engine.Dispose();')
s=replace(s,'Native.RegisterHotKey(Handle,1,0x4000,0x77),b=Native.RegisterHotKey(Handle,2,0x4000,0x78)', 'Native.RegisterHotKey(Handle,1,0x4000,InputPolicy.StartKey),b=Native.RegisterHotKey(Handle,2,0x4000,InputPolicy.StopKey)')
s=replace(s,'state=s;Push();', 'if(engine.Running&&!s.Running)return;state=s;overlay.UpdateState(s,engine.TargetWindow,config.ShowOverlay);Push();')
s=replace(s,'name=="storage-receipts.jsonl.1"', 'name=="storage-receipts.jsonl.1"||name=="catch-history.json"')
s=replace(s,'if(args.Length>0&&args[0]=="--self-test")', 'if(args.Length>1&&args[0]=="--overlay-smoke"){StatusOverlay.Screenshot(args[1]);return 0;}\n   if(args.Length>0&&args[0]=="--self-test")')
s=replace(s,'timer.Tick+=delegate{','timer.Tick+=async delegate{')
s=replace(s,'TryAction(StartNow);}Push();};timer.Start();','TryAction(StartNow);}if(smoke==null&&countdown==0&&!setupBusy&&!engine.Busy)await engine.RefreshIdleInventory();Push();};timer.Start();')
write('Program.cs',s)
for f in ['ui/app.js','ui/index.html','TestUi.py']:
 s=read(f).replace('0.4.0','0.5.0').replace('F8','F5').replace('F9','F6')
 if f=='ui/app.js':
  s=replace(s,"'IncludeExistingCatch'];", "'IncludeExistingCatch','ShowOverlay'];")
  s=replace(s,"text('start-help',data.settings?.ObserveOnly?", "applyInventory(s);text('start-help',data.settings?.ObserveOnly?")
  s+='''\nfunction applyInventory(s){const held=$('held-items'),caught=$('caught-items');held.replaceChildren();caught.replaceChildren();text('inventory-age',s.InventoryFresh?'所持品の最新値（手動収納・売却も反映）':'更新待ち：前回の所持品です');
 for(const [node,rows,total] of [[held,s.HeldItems||[],false],[caught,s.CaughtItems||[],true]]){for(const row of rows){const el=document.createElement('div');el.className='row';const label=document.createElement('span'),n=document.createElement('strong');label.textContent=row.Label||row.Name;n.textContent=String(total?row.Total:row.Count);el.append(label,n);node.append(el);}if(!rows.length){const el=document.createElement('p');el.className='footnote';el.textContent=total?'取得累計はまだありません':'表示する所持品はありません';node.append(el);}}}
'''
 if f=='ui/index.html':
  s=replace(s,'<h2>今回の記録</h2>', '<h2>現在の所持品</h2><p id="inventory-age" class="footnote">更新待ち</p><div id="held-items" class="card"></div><h2>取得累計（保存されます）</h2><div id="caught-items" class="card"></div><p class="footnote">所持数は収納・売却で減り、0になると一覧から消えます。累計は減りません。累計は釣り終了に伴う所持品増加の観測です。同時の受け渡しとは区別できない場合があります。</p><h2>今回の記録</h2>')
  s=replace(s,'<h2>認識と荷台</h2>', '<h2>表示</h2><div class="card"><label class="row"><span>ゲーム上に状態を表示<small>マウスを遮らないオーバーレイ／F5開始・F6停止</small></span><span class="toggle toggle-init"><input id="ShowOverlay" type="checkbox"><span class="toggle-icon"></span></span></label></div><h2>認識と荷台</h2>')
  s=s.replace('対応するゲームUIへ入力','前面はWindows入力、裏では対応ゲームUIへ入力')
 write(f,s)
s=read('FishingPilot.csproj');s=replace(s,'Tests040.cs"','Tests040.cs;InputPolicy.cs;CatchStatistics.cs;StatusOverlay.cs;Tests050.cs"');write('FishingPilot.csproj',s)
s=read('Tests.cs');s=replace(s,'count+=Tests040.Run(output);','count+=Tests050.Run(output);\n    count+=Tests040.Run(output);');write('Tests.cs',s)
