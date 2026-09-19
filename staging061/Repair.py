from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'portable'
def edit(name,old,new):
 path=p/name
 text=path.read_text(encoding='utf-8-sig')
 if old not in text:
  if new in text:return
  raise RuntimeError('Source mismatch: '+name+' / '+old[:100])
 assert text.count(old)==1,(name,text.count(old))
 path.write_text(text.replace(old,new),encoding='utf-8',newline='\n')
# A missing right-hand container is normal, not a failed player inventory.
edit('BridgeRead.cs','    var l=GetObject(d,"left");var r=GetObject(d,"right");','    var l=OptionalObject(d,"left");var r=OptionalObject(d,"right");')
edit('BridgeRead.cs','    var d=Json.DeserializeObject(raw) as Dictionary<string,object>;if(d==null)throw new InvalidDataException("Invalid live inventory snapshot");','    return DecodeSnapshot(raw,epoch);\n   }finally{session.FishingDeadline(-1);}\n  }\n  public static FishingPilot.Telemetry DecodeSnapshot(string raw,string epoch) {\n    var d=Json.DeserializeObject(raw) as Dictionary<string,object>;if(d==null)throw new InvalidDataException("Invalid live inventory snapshot");')
edit('BridgeRead.cs','   }finally{session.FishingDeadline(-1);}\n  }\n  static FishingPilot.Inventory Decode','  }\n  static Dictionary<string,object> OptionalObject(Dictionary<string,object> parent,string key){object value;return parent.TryGetValue(key,out value)?value as Dictionary<string,object>:null;}\n  static FishingPilot.Inventory Decode')
# Nested JSON lists may be ArrayList. Normalize instead of casting or silently skipping.
edit('CdpBridge.cs','    private static Dictionary<string, object> GetObject(Dictionary<string, object> source, string key)','    private static object[] ReadJsonArray(object value)\n    {\n        var array=value as object[]; if(array!=null)return array;\n        var list=value as System.Collections.IList; if(list==null)return null;\n        var result=new object[list.Count];list.CopyTo(result,0);return result;\n    }\n\n    private static Dictionary<string, object> GetObject(Dictionary<string, object> source, string key)')
path=p/'CdpBridge.cs';text=path.read_text(encoding='utf-8-sig')
text=text.replace('itemsValue as object[]','ReadJsonArray(itemsValue)').replace('object[] array = value as object[];','object[] array = ReadJsonArray(value);').replace('Json.DeserializeObject(text) as object[]','ReadJsonArray(Json.DeserializeObject(text))').replace('childrenObject as object[]','ReadJsonArray(childrenObject)')
path.write_text(text,encoding='utf-8',newline='\n')
edit('FishingScene.cs','object ch;if(tree.TryGetValue("childFrames",out ch))foreach(var o in (object[])ch)Collect((Dictionary<string,object>)o,result);','object ch;if(tree.TryGetValue("childFrames",out ch)){var children=ReadJsonArray(ch);if(children!=null)foreach(var o in children){var child=o as Dictionary<string,object>;if(child!=null)Collect(child,result);}}')
edit('FishingScene.cs','if(d.ContainsKey("notices")&&d["notices"] is object[])foreach(var n in (object[])d["notices"])','if(d.ContainsKey("notices"))foreach(var n in ReadJsonArray(d["notices"])??new object[0])')
edit('BridgeRead.cs','object rows;if(data.TryGetValue("items",out rows)&&rows is object[])foreach(var obj in (object[])rows)','object rows;if(data.TryGetValue("items",out rows))foreach(var obj in ReadJsonArray(rows)??new object[0])')
# Explicit start/scene/input diagnostics, including exceptions formerly hidden by SceneObserver.
edit('Engine.cs','public async Task RefreshIdleInventory(){if(Busy||idleBusy||disposed)return;idleBusy=true;string marker=sessionId;','public async Task RefreshIdleInventory(){if(Busy||idleBusy||disposed)return;idleBusy=true;string marker=sessionId;if(target==IntPtr.Zero||!Native.IsWindow(target))target=Native.FindFishingWindow();')
edit('Engine.cs','Scene scene=new Scene();bool sceneKnown=false;double captureAt=Now;','Scene scene=new Scene();bool sceneKnown=false;string sceneFault="";double captureAt=Now;')
edit('Engine.cs','scene=observer.Snapshot(out sceneKnown,out observerError);if(observerError.Contains','scene=observer.Snapshot(out sceneKnown,out observerError);sceneFault=observerError;if(observerError!="")LogThrottled("scene_observer_error",observerError);if(observerError.Contains')
edit('Engine.cs','else if(needReady){phase="recovery";reason=scene.Busy?"ゲームの進捗が終わるまで待っています":"終了動作の回復を確認して次の投竿へ進みます";}','else if(needReady){phase=sceneKnown?"recovery":"scene";reason=!sceneKnown?"投竿前の画面確認待ち: "+(sceneFault==""?"対応UIを接続中（解消しない場合は診断ZIPを保存）":sceneFault):scene.Busy?"ゲームの進捗が終わるまで待っています":"終了動作の回復を確認して次の投竿へ進みます";}')
edit('Engine.cs','case "telemetry":return "対応NUIの確認待ち";','case "scene":return "投竿前の画面読み取り待ち";case "telemetry":return "所持品の同期待ち";')
edit('Engine.cs','if(foreground)return Native.Press(target,targetPid,key,token);','if(foreground){bool sent=Native.Press(target,targetPid,key,token,100);Log("slot_input", "key="+key+" sent="+sent+" "+Native.LastInputDiagnostic);return sent;}')
# Preserve 24ms fast digits, but hold hotbar actions for 100ms. Never send to other windows.
edit('Native.cs','[DllImport("user32.dll")]static extern uint SendInput','[DllImport("user32.dll",SetLastError=true)]static extern uint SendInput')
edit('Native.cs','[DllImport("user32.dll")]public static extern bool RegisterHotKey','[DllImport("user32.dll",SetLastError=true)]public static extern bool RegisterHotKey')
edit('Native.cs','  public static bool Press(IntPtr h,uint expectedPid,int digit,CancellationToken cancel){','  [ThreadStatic] public static string LastInputDiagnostic;\n  public static bool Press(IntPtr h,uint expectedPid,int digit,CancellationToken cancel,int holdMs=24){')
edit('Native.cs','if(cancel.IsCancellationRequested||h!=GetForegroundWindow()||pid!=expectedPid||!IsWindow(h)||digit<0||digit>9)return false;','LastInputDiagnostic="target_or_cancel_guard";\n   if(cancel.IsCancellationRequested||h!=GetForegroundWindow()||pid!=expectedPid||!IsWindow(h)||digit<0||digit>9||holdMs<10||holdMs>200)return false;')
edit('Native.cs','int vk=0x30+digit;if((GetAsyncKeyState(vk)&0x8000)!=0)return false;','int vk=0x30+digit;if((GetAsyncKeyState(vk)&0x8000)!=0){LastInputDiagnostic="key_already_down";return false;}')
edit('Native.cs','try{sent=SendInput(1,new[]{down},Marshal.SizeOf(typeof(INPUT)))==1;if(sent)cancel.WaitHandle.WaitOne(24);return sent;}','try{sent=SendInput(1,new[]{down},Marshal.SizeOf(typeof(INPUT)))==1;int error=Marshal.GetLastWin32Error();LastInputDiagnostic=sent?"keydown_sent hold_ms="+holdMs:"SendInput_failed win32="+error+" integrity_or_input_block_possible";if(sent)cancel.WaitHandle.WaitOne(holdMs);return sent;}')
# UI actions and failures now leave usable, immediate evidence. No forced admin elevation.
edit('Program.cs','void StartNow(){countdown=0;EnsureIdle();','void StartNow(){engine.Log("start_requested","source=F5_or_button observe_only="+config.ObserveOnly+" background="+config.BackgroundMode);countdown=0;EnsureIdle();')
edit('Program.cs','void TryAction(Action a){try{a();}catch(Exception e){feedback=e.Message;engine.Log("ui_error",e.GetType().Name);Push();}}','void TryAction(Action a){try{a();}catch(Exception e){feedback=e.Message;engine.Log("ui_error",e.GetType().Name+": "+e.Message);if(!engine.Running){state.Phase="開始できませんでした";state.Detail=e.Message;overlay.Configure(config.Overlay);overlay.UpdateState(state,Native.FindFishingWindow(),config.ShowOverlay);}try{tray.ShowBalloonTip(6000,"釣りアシスト",e.Message,ToolTipIcon.Warning);}catch{}Push();}}')
edit('Program.cs','if(!a||!b)feedback="F5/F6が他アプリと競合しています。旧採掘機・旧FishingPilotを終了してください";','engine.Log("hotkeys_registered","F5="+a+" F6="+b);if(!a||!b){feedback="F5/F6が他アプリと競合しています。旧採掘機・旧FishingPilotを終了してください";tray.ShowBalloonTip(6000,"釣りアシスト",feedback,ToolTipIcon.Warning);}')
edit('Program.cs','if(id==1&&!engine.Busy&&countdown==0)TryAction(StartNow);','if(id==1){engine.Log("hotkey_received","key=F5 busy="+engine.Busy+" countdown="+countdown);if(!engine.Busy&&countdown==0)TryAction(StartNow);}')
# Waiting reason is not hidden behind the optional technical-details switch.
edit('StatusOverlay.cs','(settings.ShowStatus?line:0)','(settings.ShowStatus?line+42:0)')
edit('StatusOverlay.cs','if(settings.ShowStatus)Row(g,status.Running?"実行中":"停止",status.Phase,ref y,width);','if(settings.ShowStatus){Row(g,status.Running?"実行中":"停止",status.Phase,ref y,width);using(var f=new Font("Yu Gothic UI",9))using(var b=new SolidBrush(Color.FromArgb(103,112,128)))using(var fmt=new StringFormat{Trimming=StringTrimming.EllipsisCharacter})g.DrawString(status.Detail??"",f,b,new RectangleF(17,y,width-34,40),fmt);y+=42;}')
# Status overlay is deliberately excluded from screenshot capture, as in 0.6.0.
# Do not infer from a screenshot that a user cannot see it on their display.
for name in ['Engine.cs','Program.cs','README.txt','Build.ps1','ui/index.html','TestUi.py']:
 path=p/name;text=path.read_text(encoding='utf-8-sig').replace('0.6.0-preview','0.6.1-preview').replace('0.6.0.0','0.6.1.0').replace('FishingPilot 0.6.0 build ready.','FishingPilot 0.6.1 build ready.')
 path.write_text(text,encoding='utf-8',newline='\n')
path=p/'README.txt';text=path.read_text(encoding='utf-8-sig');notes='''\n【0.6.1 修正】\n荷台未開放で right:null の正常な所持品応答を受け取れるよう修正。\n未取得の left:null は「所持品を一度開いて閉じる」案内へ戻し、例外再接続を繰り返しません。\n画面ツリーの配列を object[] に決め打ちする箇所を修正。\nF5の登録・受付・開始要求、画面読み取りエラー、スロット入力の結果をログに残します。\n開始前の待機理由はオーバーレイの状態欄にも表示します。\n投竿・補給のキー押下は100ms、円のタイミング入力は従来の24msです。\n未知の所持品を空、未知の空腹水分を満タンと扱う変更はしていません。\nUIから「診断ログ → 診断ZIPを保存」。まずF5で開始を試し、F6で止めて保存してください。\n実サーバーでの開始・長時間自動運転は未検証です。\n'''
if '【0.6.1 修正】' not in text:path.write_text(text+notes,encoding='utf-8',newline='\n')
print('Applied 0.6.1 null-container, collection and startup diagnostic repair')
