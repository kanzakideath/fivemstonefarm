from pathlib import Path
import json
root=Path('portable')
p=root/'FishingScene.cs';s=p.read_text(encoding='utf-8-sig')
s=s.replace('public double At,Cost,X,Y,W,H,Hunger=-1,Water=-1;', 'public int SentKey=-1, InputSequence, InputRound; public string Delivery="", InputReason=""; public double InputPointer,InputStart,InputEnd;\n  public double At,Cost,X,Y,W,H,Hunger=-1,Water=-1;')
s=s.replace('string selected=""; string[] epochFrames;', 'string selected=""; double lastRingAt=-10000; readonly HashSet<string> installed=new HashSet<string>(); string[] epochFrames;')
a=s.index('  public async Task<FishingPilot.Scene> Poll()');b=s.index('  double noticeAt;',a)
s=s[:a]+'''  async Task<FishingPilot.Scene> ReadOne(string url,bool allowInput,string cycle,bool fast) {
   var session=await Get(url).ConfigureAwait(false);
   if(!installed.Contains(url)){await Read(session,probe).ConfigureAwait(false);installed.Add(url);}
   string command=Json.Serialize(new Dictionary<string,object>{{"enabled",allowInput},{"cycle",cycle??""}});
   string raw=await Read(session,"window.__fpProbe3?window.__fpProbe3.sample("+(fast?"true":"false")+","+command+"): 'REINSTALL'").ConfigureAwait(false);
   if(raw=="REINSTALL"){installed.Remove(url);return new FishingPilot.Scene{Source="NUI reinitialize"};}
   var d=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(raw);var r=(Dictionary<string,object>)d["ring"];
   var scene=new FishingPilot.Scene{Frame=url,Present=Bool(r,"present"),Busy=Bool(d,"busy"),Width=NumI(d,"w"),Height=NumI(d,"h"),Hunger=Num(d,"hunger",-1),Water=Num(d,"water",-1),Source=Bool(r,"valid")?"NUI same-turn":"NUI candidate"};
   if(Bool(r,"ambiguous"))scene.Source="ambiguous NUI";
   scene.Key=NumI(r,"key",-1);scene.Stamp=GetString(r,"stamp");scene.X=Num(r,"x",0);scene.Y=Num(r,"y",0);scene.W=Num(r,"w",0);scene.H=Num(r,"h",0);
   if(Bool(r,"valid"))scene.Ring=new FishingPilot.Ring{Valid=true,Native=true,Key=scene.Key,Pointer=Num(r,"pointer",0),Start=Num(r,"start",0),End=Num(r,"end",0),Radius=Num(r,"radius",0),Identity=url+":"+scene.Stamp,Confidence=1};
   scene.Delivery=GetString(d,"delivery");var input=GetObject(d,"input");scene.InputReason=GetString(input,"reason");
   if(Bool(input,"sent")){scene.SentKey=NumI(input,"key",-1);scene.InputSequence=NumI(input,"seq");scene.InputRound=NumI(input,"round");scene.InputPointer=Num(input,"pointer",0);scene.InputStart=Num(input,"start",0);scene.InputEnd=Num(input,"end",0);}
   if(d.ContainsKey("notices"))foreach(var n in (object[])d["notices"]){var v=(Dictionary<string,object>)n;scene.Notices.Add(new FishingPilot.Notice{Kind=GetString(v,"kind"),Id=url+":"+GetString(v,"id")});}
   return scene;
  }
  public async Task<FishingPilot.Scene> Poll(bool allowInput=false,string cycle="") {
   token.ThrowIfCancellationRequested();double now=timer.Elapsed.TotalMilliseconds;
   FishingPilot.Scene chosen=new FishingPilot.Scene();
   if(selected!="") {
    chosen=await ReadOne(selected,allowInput,cycle,now-lastRingAt<500).ConfigureAwait(false);
    // Critical path: return immediately, before discovery and ancillary reads.
    if(chosen.Present){lastRingAt=now;return chosen;}
   }
   if(now-healthAt>1500){var s=await Get(InventoryFramePart).ConfigureAwait(false);s.FishingDeadline(1200);try{var tree=await s.FishingFrames().ConfigureAwait(false);if(!ServerFrameTreeMatches(tree,epochFrames))throw new InvalidOperationException("SERVER_SESSION_CHANGED");Collect(tree,urls);}finally{s.FishingDeadline(-1);}healthAt=now;}
   var batch=new List<string>();if(now>=scanAt&&urls.Count>0){string u=urls[scan++%urls.Count];if(u!=selected)batch.Add(u);scanAt=now+(selected==""?10:100);}
   string noticeUrl=urls.FirstOrDefault(u=>u.Contains(ProgressFramePart));if(noticeUrl!=null&&noticeUrl!=selected&&!batch.Contains(noticeUrl)&&now>=noticeAt){batch.Add(noticeUrl);noticeAt=now+150;}
   foreach(string u in batch){
    var current=await ReadOne(u,false,cycle,false).ConfigureAwait(false);
    if(current.Present){current.Notices.AddRange(chosen.Notices);current.Busy|=chosen.Busy;if(current.Hunger<0)current.Hunger=chosen.Hunger;if(current.Water<0)current.Water=chosen.Water;selected=u;lastRingAt=now;return current;}
    chosen.Busy|=current.Busy;chosen.Notices.AddRange(current.Notices);if(chosen.Width==0){chosen.Width=current.Width;chosen.Height=current.Height;}if(current.Hunger>=0)chosen.Hunger=current.Hunger;if(current.Water>=0)chosen.Water=current.Water;
   }
   return chosen;
  }
''' +s[b:]
a=s.index('  public async Task<bool> Digit(');b=s.index('  public static int ConsolePort()',a)
s=s[:a]+'''  public async Task<bool> Digit(FishingPilot.Scene scene,int key) {
   token.ThrowIfCancellationRequested();if(!scene.Present||key<0||key>9||scene.Frame=="")return false;
   var session=await Get(scene.Frame).ConfigureAwait(false);
   string request=Json.Serialize(new Dictionary<string,object>{{"key",key},{"stamp",scene.Stamp},{"inside",true}});
   string result=await Read(session,"window.__fpProbe3?window.__fpProbe3.pixelKey("+request+"): 'STALE'").ConfigureAwait(false);
   return result=="SENT";
  }
''' +s[b:]
a=s.index('  public static int ConsolePort()');b=s.index('  public static bool Hotbar',a)
s=s[:a]+'  public static int ConsolePort() { return FishingPilot.Native.FiveMConsolePort(); }\n'+s[b:]
p.write_text(s,encoding='utf-8-sig')
p=root/'Native.cs';s=p.read_text(encoding='utf-8-sig');pos=s.index('  public static bool Press(')
s=s[:pos]+'''  [DllImport("iphlpapi.dll", SetLastError=true)]static extern uint GetExtendedTcpTable(IntPtr table,ref int size,bool order,int family,int type,uint reserved);
  public static int FiveMConsolePort(){
   int size=0;GetExtendedTcpTable(IntPtr.Zero,ref size,false,2,3,0);if(size<=4||size>4000000)return 0;
   IntPtr buffer=Marshal.AllocHGlobal(size);
   try{if(GetExtendedTcpTable(buffer,ref size,false,2,3,0)!=0)return 0;int count=Marshal.ReadInt32(buffer);var found=new System.Collections.Generic.List<int>();
    for(int i=0;i<count;i++){int offset=4+i*24;if(offset+24>size)break;int state=Marshal.ReadInt32(buffer,offset);int port=Marshal.ReadByte(buffer,offset+8)*256+Marshal.ReadByte(buffer,offset+9);int pid=Marshal.ReadInt32(buffer,offset+20);if(state!=2||(port!=29200&&port!=29300))continue;
     try{if(Process.GetProcessById(pid).ProcessName.IndexOf("FiveM",StringComparison.OrdinalIgnoreCase)>=0&&!found.Contains(port))found.Add(port);}catch{}
    }return found.Count==1?found[0]:0;
   }finally{Marshal.FreeHGlobal(buffer);}
  }
''' +s[pos:];p.write_text(s,encoding='utf-8-sig')
p=root/'FishCore.cs';s=p.read_text(encoding='utf-8-sig');s=s.replace('double areaStart,areaEnd,prevPointer;', 'double areaStart,areaEnd,prevPointer,previousAt,velocity;')
s=s.replace('stable=0;haveArea=false;identity="";}', 'stable=0;haveArea=false;identity="";previousAt=velocity=0;}')
s=s.replace('public int Observe(Ring r,double now) {','public int Observe(Ring r,double now,double observationAgeMs=0) {')
s=s.replace('MissingSince=-1;LastSeen=now;prevPointer=r.Pointer;', '''double step=(r.Pointer-prevPointer+540)%360-180,dt=now-previousAt;
   if(!reset&&dt>=2&&dt<=180&&step>=0&&step/dt<=2)velocity=velocity==0?step/dt:velocity*.5+step/dt*.5;else if(reset)velocity=0;
   previousAt=now;MissingSince=-1;LastSeen=now;prevPointer=r.Pointer;''')
s=s.replace('double span=(areaEnd-areaStart+360)%360, progress=(r.Pointer-areaStart+360)%360;', '''double span=(areaEnd-areaStart+360)%360;
   double lead=observationAgeMs>0 ? Math.Min(span*.45, velocity*Math.Max(0,Math.Min(50,observationAgeMs+6))) : 0;
   double progress=(r.Pointer+lead-areaStart+360)%360;''')
p.write_text(s,encoding='utf-8-sig')
p=root/'Engine.cs';s=p.read_text(encoding='utf-8-sig');s=s.replace('0.2.0-preview','0.3.0-preview')
s=s.replace('public int Casts,Keys,Results;', 'public string Backend="未確認",Delivery="未確認"; public double ReadMs; public int Casts,Keys,Results;')
s=s.replace('int castRetries,consolePort;', 'int castRetries,consolePort,castSerial; string castCycle="";')
s=s.replace('scene=sceneLink.Poll().GetAwaiter().GetResult();sceneKnown=true;', '''bool permit=options.BackgroundMode&&!options.ObserveOnly&&castIssued&&t.Known&&Now-t.At<2200&&pendingNeed==""&&!token.IsCancellationRequested;
      scene=sceneLink.Poll(permit,castCycle).GetAwaiter().GetResult();sceneKnown=true;''')
s=s.replace('scene.Cost=Now-captureAt;scene.At=Now;now=Now;', '''scene.Cost=Now-captureAt;scene.At=Now;now=Now;
     state.ReadMs=scene.Cost;state.Backend=options.BackgroundMode?(scene.Ring.Valid?"NUI同一処理内の判定・入力":sceneKnown?"NUI画像／対象確認中":"バックグラウンド接続待ち"):"前面画像＋Windows入力";
     state.Delivery=scene.Delivery=="transition_observed"?"入力後の画面遷移を確認":scene.Delivery=="sent_unconfirmed"?"送信済み・次判定を確認中":sceneKnown?"円の認識待ち":"未確認";
     if(scene.SentKey>=0){state.Keys++;round.Round=Math.Max(round.Round,scene.InputRound);round.LastHit=now;round.Latched=true;Log("round_key","backend=nui_same_turn key="+scene.SentKey+" sequence="+scene.InputSequence+" round="+scene.InputRound+" pointer="+scene.InputPointer.ToString("F2")+" target="+scene.InputStart.ToString("F2")+"-"+scene.InputEnd.ToString("F2")+" poll_ms="+scene.Cost.ToString("F1"));}''')
s=s.replace('castAt=now;round.Reset();Log("adopt_existing_round"', 'castAt=now;castCycle=sessionId+":"+(++castSerial);round.Reset();Log("adopt_existing_round"')
s=s.replace('if(fresh&&scene.Cost<180){int key=round.Observe(r,now);', 'if(fresh&&scene.Cost<100&&!(options.BackgroundMode&&r.Native)){int key=round.Observe(r,now,scene.Cost*.5);')
s=s.replace('}else reason="接続または描画の新鮮さを再確認しています";', '}else reason=options.BackgroundMode&&r.Native?"円の描画値と同じ処理内で入力しています":"接続または描画の新鮮さを再確認しています";')
s=s.replace('castAt=Now;castIssued=true;phase="bite";', 'castAt=Now;castCycle=sessionId+":"+(++castSerial);castIssued=true;phase="bite";')
s=s.replace('token.WaitHandle.WaitOne(r.Valid?8:25);', 'token.WaitHandle.WaitOne(present?3:20);')
s=s.replace('bool PressSlot(int key,CancellationToken token,bool foreground){if(options.BackgroundMode&&consolePort!=0)return CdpBridge.FishingConnection.Hotbar(consolePort,key,token);return foreground&&Native.Press(target,targetPid,key,token);}', '''bool PressSlot(int key,CancellationToken token,bool foreground){
   if(options.BackgroundMode){if(consolePort==0)consolePort=CdpBridge.FishingConnection.ConsolePort();
    if(consolePort!=0)return CdpBridge.FishingConnection.Hotbar(consolePort,key,token);
    LogThrottled("background_hotbar_unavailable","no_unique_fivem_owned_console=1 no_desktop_fallback=1");return false;}
   return foreground&&Native.Press(target,targetPid,key,token);
  }''')
s=s.replace('else if(foreground)sent=Native.Press(target,targetPid,key,token);','else if(!options.BackgroundMode&&foreground)sent=Native.Press(target,targetPid,key,token);')
s=s.replace('Keys=state.Keys,Results=state.Results}', 'Keys=state.Keys,Results=state.Results,Backend=state.Backend,Delivery=state.Delivery,ReadMs=state.ReadMs}')
s=s.replace('"input_scope_closed=1"','"input_scope_closed=1 no_deferred_keydown=1"');p.write_text(s,encoding='utf-8-sig')
p=root/'Tests.cs';s=p.read_text(encoding='utf-8-sig');s=s.replace('    NativeInputTest(notes);','''    c.Reset();c.Observe(R(4,175),0,10);c.Observe(R(4,185),20,10);
    Check(c.Observe(R(4,202),40,10)==4,"bounded pixel latency enters the interior");
    c.Reset();c.Observe(R(4,190),0,20);Check(c.Observe(R(4,258),30,20)<0,"missed window remains refused");
    Check(Native.FiveMConsolePort()==0,"unrelated listener cannot authorize hotbar");
    notes.Add("bounded latency, missed-window refusal, and process-owned hotbar selection checked");
    NativeInputTest(notes);''');p.write_text(s,encoding='utf-8-sig')
p=root/'digit-templates.json';j=json.loads(p.read_text(encoding='utf-8-sig'));j['4']='000000000000000111110000000000000000000111110000000000000000000111110000000000000000001111110000000000000000011111110000000000000000011111110000000000000000111111110000000000000001111111110000000000000001111111110000000000000001111111110000000000000011110111110000000000000111100111110000000000000111100111110000000000001111000111110000000000011110000111110000000000111110000111110000000000111100000111110000000000111100000111110000000001111000000111110000000011110000000111110000000011110000000111110000000111100000000111110000001111000000000111110000001111000000000111110000011110000000000111110000011110000000000111110000111110000000000111110000111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000111110000000000000000000111110000000000000000000111110000000000000000000111110000000000000000000111110000000000000000000111110000000000000000000111110000000000000000000111110000000000000000000111110000';assert len(j['4'])==960;p.write_text(json.dumps(j),encoding='utf-8')
