from pathlib import Path
import hashlib

root = Path(__file__).resolve().parents[1]
expected = {
    'src/mining-auto.ahk': '9a72ac43ec05aaa9ed692de9e23f021e7bcd4ccd',
    'src/wash-position/WashPosition.cs': '7120d49b49105d43fed856973e831a81c83f6809',
    'src/exe-route-navigation.ahk': 'd6dc1665d022cf2f8a1ebc796417e57a4819fdc1'
}
for n, h in expected.items():
    b = (root / n).read_bytes()
    if hashlib.sha1(b'blob ' + str(len(b)).encode() + b'\0' + b).hexdigest() != h:
        raise RuntimeError('Concurrent change: ' + n)

def read(n):
    return (root / n).read_text(encoding='utf-8-sig')

def write(n, s):
    p = root / n
    bom = p.exists() and p.read_bytes().startswith(b'\xef\xbb\xbf')
    p.write_bytes((b'\xef\xbb\xbf' if bom else b'') + s.encode())

def once(s, a, b):
    if s.count(a) != 1:
        raise RuntimeError('Expected one boundary: ' + a[:120] + ' count=' + str(s.count(a)))
    return s.replace(a, b, 1)

n = 'src/wash-position/WashPosition.cs'
s = read(n)
s = once(s, 'public int pulses, inputMs;', 'public int pulses, inputMs;\n        public string profile = "standard";\n        public double tolerancePx = 0.65;')
s = once(s, '(args[0] == "wash-anchor" || args[0] == "wash-correct" || args[0] == "wash-check")', '(args[0] == "wash-anchor" || args[0] == "wash-correct" || args[0] == "wash-maintain" || args[0] == "wash-check")')
s = once(s, 'private readonly string operation, anchorPath, cancelPath;', 'private readonly string operation, anchorPath, cancelPath;\n    private bool Nearby { get { return operation == "wash-maintain"; } }')
s = once(s, 'private void Say(string text)\n    { label.Text=text + "\\nF9／手動操作／他アプリへの切替で停止 · 座標ではなく景色の照合"; Refresh(); }', '''private void Say(string text)
    {
        label.Text=text + "\\n" + (report.pulses==0 ? "W未送信" : "W送信済み "+report.pulses+"回・計"+report.inputMs+"ms")
            + " / 経過 "+(clock.ElapsedMilliseconds/1000.0).ToString("0.0",CultureInfo.InvariantCulture)+"秒"
            + "\\nF9／手動操作／他アプリ切替で停止 · 画像上のずれ（座標ではありません）";
        Refresh();
    }''')
s = once(s, 'Guard(); RECT r; GetClientRect(target,out r); clientWidth=r.right; clientHeight=r.bottom;', '''report.profile=Nearby ? "nearby-micro" : "standard";
            report.tolerancePx=Nearby ? 0.20 : 0.65;
            Event("PROFILE "+report.profile+" tolerance_px="+F(report.tolerancePx));
            Guard(); RECT r; GetClientRect(target,out r); clientWidth=r.right; clientHeight=r.bottom;''')
s = once(s, 'byte[] before=WaitStable(); Match match=Estimate(reference,before);', 'byte[] before=WaitStable(); Match match=Estimate(reference,before,Nearby);')
s = once(s, 'if (operation=="wash-correct")', 'if (operation=="wash-correct" || Nearby)')
s = once(s, '                        }, report);', '                        }, report, Nearby);')
s = once(s, 'Match final=Estimate(reference,WaitStable());\n                if (!AtAnchor(final))', 'Match final=Estimate(reference,WaitStable(),Nearby);\n                if (!AtAnchor(final,report.tolerancePx))')
s = once(s, 'internal static bool AtAnchor(Match m) { return m.valid && m.error <= 0.65; }', 'internal static bool AtAnchor(Match m, double tolerance = 0.65) { return m.valid && m.error <= tolerance; }')
a = s.index('    internal static void Correct(')
b = s.index('    private byte[] WaitStable()', a)
s = s[:a] + '''    internal static void Correct(byte[] reference, byte[] initial, Func<byte[]> observe,
        Action<int> pulse, Action guard, Action<Match,int> status, Report r, bool nearby = false)
    {
        double tolerance=nearby ? 0.20 : 0.65;
        double minimumImprovement=nearby ? 0.025 : 0.08;
        r.profile=nearby ? "nearby-micro" : "standard"; r.tolerancePx=tolerance;
        Match current=Estimate(reference,initial,nearby);
        int ms=30, noEffect=0;
        r.beforeError=current.error; r.afterError=current.error;
        if(AtAnchor(current,tolerance)) r.events.Add("NO_INPUT_WITHIN_TOLERANCE error_px="+F(current.error));
        for(int n=0;n<8 && r.inputMs<360 && !AtAnchor(current,tolerance);n++)
        {
            guard();
            if(!current.valid || current.error > 8.0) throw new Exception("ANCHOR_LOST_NO_INPUT");
            ms=Math.Min(ms,360-r.inputMs); status(current,ms); guard();
            r.events.Add("PULSE_BEGIN ms="+ms+" before_px="+F(current.error));
            pulse(ms); r.pulses++; r.inputMs+=ms; guard();
            Match next=Estimate(reference,observe(),nearby);
            r.afterError=next.error;
            r.events.Add("PULSE_OBSERVED after_px="+F(next.error)+" support="+next.support);
            if(!next.valid) throw new Exception("VISION_LOST_AFTER_INPUT");
            if(next.error > current.error + 0.45) throw new Exception("WRONG_DIRECTION_OR_CAMERA_MOVED");
            double improvement=current.error-next.error;
            // Count consecutive ineffective pulses, not the index of the pulse.
            // One delayed sample after an effective pulse is not two failures.
            noEffect=improvement>=minimumImprovement || AtAnchor(next,tolerance) ? 0 : noEffect+1;
            if(noEffect>=2) throw new Exception("FORWARD_NO_OBSERVED_EFFECT");
            ms=improvement>=minimumImprovement
                ? (int)Math.Max(15,Math.Min(80,Math.Floor(Math.Max(0.05,next.error-tolerance*0.5)/improvement*ms*0.65)))
                : Math.Min(80,ms+20);
            current=next;
        }
        if(!AtAnchor(current,tolerance)) throw new Exception("POSITION_CORRECTION_BUDGET");
    }
''' + s[b:]
s = once(s, 'Match adjacent=Estimate(previous,next), accumulated=Estimate(first,next);', 'Match adjacent=Estimate(previous,next,Nearby), accumulated=Estimate(first,next,Nearby);')
s = once(s, 'if(!adjacent.valid || adjacent.error>0.30 || !accumulated.valid || accumulated.error>0.45)', 'if(!adjacent.valid || adjacent.error>(Nearby?0.12:0.30) || !accumulated.valid || accumulated.error>(Nearby?0.18:0.45))')
s = once(s, '            previous=next;', '            Say("静止確認中。まだWを押しません（安定 "+(clock.ElapsedMilliseconds-stable)+" / 480ms）");\n            previous=next;')
s = once(s, 'internal static Match Estimate(byte[] reference,byte[] image)', 'internal static Match Estimate(byte[] reference,byte[] image,bool precise = false)')
s = once(s, '            distances.Add(Math.Sqrt((bx+sx)*(bx+sx)+(by+sy)*(by+sy))); quality+=best;', '            if(precise) RefineSubpixel(reference,image,tile,bx,by,out sx,out sy);\n            distances.Add(Math.Sqrt((bx+sx)*(bx+sx)+(by+sy)*(by+sy))); quality+=best;')
pos = s.index('    private static double Ncc(')
s = s[:pos] + '''    // A parabola through three integer NCC scores systematically understates
    // small shifts of interpolated textures. Fit the fractional translation
    // itself instead. Inner pixels need no data outside the persisted tile.
    private static void RefineSubpixel(byte[] reference,byte[] image,Point tile,int dx,int dy,out double sx,out double sy)
    {
        double best=-2,fx=0,fy=0;
        for(int y=-4;y<=4;y++) for(int x=-4;x<=4;x++)
        {
            double score=FractionalNcc(reference,image,tile,dx,dy,x/8.0,y/8.0);
            if(score>best){best=score;fx=x/8.0;fy=y/8.0;}
        }
        double cx=fx,cy=fy;
        for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++)
        {
            double tx=Math.Max(-.5,Math.Min(.5,cx+x/32.0));
            double ty=Math.Max(-.5,Math.Min(.5,cy+y/32.0));
            double score=FractionalNcc(reference,image,tile,dx,dy,tx,ty);
            if(score>best){best=score;fx=tx;fy=ty;}
        }
        sx=fx;sy=fy;
    }
    private static double FractionalNcc(byte[] a,byte[] b,Point p,int dx,int dy,double fx,double fy)
    {
        double sa=0,sb=0,aa=0,bb=0,ab=0; int n=(TileSize-2)*(TileSize-2);
        for(int y=1;y<TileSize-1;y++) for(int x=1;x<TileSize-1;x++)
        {
            double px=p.X+x-fx,py=p.Y+y-fy; int ix=(int)Math.Floor(px),iy=(int)Math.Floor(py);
            double u=px-ix,v=py-iy;
            double av=(1-v)*((1-u)*a[iy*W+ix]+u*a[iy*W+ix+1])
                +v*((1-u)*a[(iy+1)*W+ix]+u*a[(iy+1)*W+ix+1]);
            double bv=b[(p.Y+y+dy)*W+p.X+x+dx];
            sa+=av;sb+=bv;aa+=av*av;bb+=bv*bv;ab+=av*bv;
        }
        double va=aa-sa*sa/n,vb=bb-sb*sb/n;
        return va/n<4 || vb/n<4 ? -1 : (ab-sa*sb/n)/Math.Sqrt(va*vb);
    }
''' + s[pos:]
s = once(s, 'if(operation!="wash-correct" || milliseconds<1 || milliseconds>100)', 'if((operation!="wash-correct" && !Nearby) || milliseconds<1 || milliseconds>100)')
s = once(s, 'try {KeyPacket(true); Event("W_DOWN actual_ms="+clock.ElapsedMilliseconds); Pause(milliseconds);}', 'try {Say("前進Wを押下 "+milliseconds+"ms → 解除 → 効果を測定"); Guard(); KeyPacket(true); Event("W_DOWN actual_ms="+clock.ElapsedMilliseconds); Pause(milliseconds);}')
pos = s.index('    internal static string SelfTest()')
s = s[:pos] + '''    private static byte[] FractionShift(byte[] src,double dy)
    {
        var b=new byte[W*H];
        for(int y=2;y<H-2;y++) for(int x=0;x<W;x++)
        {double sy=y-dy;int iy=(int)Math.Floor(sy);double v=sy-iy;
            if(iy>=0 && iy+1<H)b[y*W+x]=(byte)Math.Round((1-v)*src[iy*W+x]+v*src[(iy+1)*W+x]);}
        return b;
    }
    private static void MicroTests(byte[] a)
    {
        foreach(double shift in new[]{0.0,0.18,0.30,0.40,0.65,1.25})
        {Match m=Estimate(a,FractionShift(a,shift),true);
            if(!m.valid || Math.Abs(m.error-shift)>0.075)throw new Exception("FRACTIONAL_TRANSLATION_TEST");}
        var r=new Report();int inputs=0;
        Correct(a,a,delegate{return a;},delegate(int ms){inputs++;},delegate{},delegate(Match m,int ms){},r,true);
        if(inputs!=0)throw new Exception("NEARBY_NO_DRIFT_NO_INPUT");
        double residual=0;int pulses=0;
        for(int cycle=0;cycle<100;cycle++)
        {
            residual+=0.18;r=new Report();
            Correct(a,FractionShift(a,residual),delegate{return FractionShift(a,residual);},
                delegate(int ms){residual=Math.Max(0,residual-0.18);pulses++;},delegate{},delegate(Match m,int ms){},r,true);
            if(residual>0.22 || r.inputMs>360)throw new Exception("CUMULATIVE_MICRO_DRIFT_TEST");
        }
        if(pulses<90)throw new Exception("MICRO_DRIFT_WAS_IGNORED");
        int sample=0;double d=3;r=new Report();
        Correct(a,FractionShift(a,d),delegate{sample++;if(sample!=2)d=Math.Max(0,d-1);return FractionShift(a,d);},
            delegate(int ms){},delegate{},delegate(Match m,int ms){},r,true);
        if(r.pulses!=4)throw new Exception("ONE_DELAYED_SAMPLE_MUST_NOT_ABORT");
    }
''' + s[pos:]
s = once(s, '        return "SELFTEST OK";', '        MicroTests(a);\n        return "SELFTEST OK";')
write(n, s)

n = 'src/wash-position.ahk'
s = read(n)
pos = s.index('RunObservedWashHelper(')
s = s[:pos] + '''ObservedWashCorrectionOperation(generation) {
    global State, Config
    if IsCurrentRun(generation) && State.runMode = "washing"
        && Config.washForwardCorrection && Config.vehicleStorageEnabled
        && ExeStorageMethod("washing") = "stationary"
        && ExeRouteBindingValid("washing", State.serverEpoch)
        return "wash-maintain"
    return "wash-correct"
}

''' + s[pos:]
write(n, s)
n = 'src/exe-route-navigation.ahk'
s = read(n)
s = once(s, 'washOperation := operation = "wash-anchor" || operation = "wash-correct" || operation = "wash-check"', 'washOperation := operation = "wash-anchor" || operation = "wash-correct"\n            || operation = "wash-maintain" || operation = "wash-check"')
write(n, s)
n = 'src/mining-auto.ahk'
s = read(n)
s = once(s, 'BeginWashCompletionRecovery(expectedGeneration, attemptId) {\n    global State, Config', 'BeginWashCompletionRecovery(expectedGeneration, attemptId) {\n    global State, Config, LocalNav')
s = once(s, '    State.statusLabel.Text := "●  洗浄完了。後退が止まるまで待機中"', '''    State.statusLabel.Text := Config.washForwardCorrection
        ? "●  前進補正ON：洗浄完了。静止確認後に微小後退を測ります（W未送信）"
        : "●  前進補正OFF：この設定では洗浄後にWを送りません"
    LocalNav.washFeedback := State.statusLabel.Text
    QueueWebUiFlush(true)''')
s = once(s, '    nudgeResult := RunObservedWashHelper("wash-correct", expectedGeneration)', '''    correctionOperation := ObservedWashCorrectionOperation(expectedGeneration)
    WriteDiagnostic("WASH_CORRECTION_PROFILE operation=" correctionOperation)
    nudgeResult := RunObservedWashHelper(correctionOperation, expectedGeneration)''')
s = once(s, '            LocalNav.washFeedback := (observed[1] + 0 > 0 ? "補正確認" : "補正不要")', '            LocalNav.washFeedback := (correctionOperation = "wash-maintain" ? "荷台前・微小後退補正" : "通常補正")\n                . " / " (observed[1] + 0 > 0 ? "前進効果確認" : "許容範囲内のためW未送信")')
s = once(s, '    attemptId := State.washRecoveryAttemptId\n\n    if currentState = "WASH_SETTLING"', '''    attemptId := State.washRecoveryAttemptId
    WriteDiagnostic("WASH_RECOVERY_TICK phase=" currentState " correction=" Config.washForwardCorrection
        " stateAgeMs=" (MonotonicMs() - State.farmStateEnteredAt) " attempt=" attemptId)

    if currentState = "WASH_SETTLING"''')
s = once(s, '            State.statusLabel.Text := "●  洗浄完了。後退が止まるまで待機中（"', '            State.statusLabel.Text := (Config.washForwardCorrection ? "●  前進補正ON：開始待ち（" : "●  前進補正OFF：Wを送らず待機（")')
s = once(s, '        State.storageTrips)\n    now := MonotonicMs()', '''        State.storageTrips)
    if State.runMode = "washing"
        meta .= Config.washForwardCorrection ? " | 前進補正ON" : " | 前進補正OFF"
    now := MonotonicMs()''')
write(n, s)
for n in ['README.md', 'src/README.md', 'docs/AI採掘機_使い方.txt', 'config/AI採掘機.ini', 'src/mining-auto.ahk', 'src/ui-web/package.json', 'src/ui-web/package-lock.json', 'src/ui-web/src/app.js']:
    s = read(n)
    if '9.1.12' not in s:
        raise RuntimeError('Missing version marker: ' + n)
    write(n, s.replace('9.1.12', '9.1.13'))

n = 'scripts/ui-tests/WashPositionDesktopProbe.cs'
s = read(n)
s = once(s, 'private int offset, keyDowns, keyUps;', 'private int offset, keyDowns, keyUps, microPixels;')
s = once(s, 'if(!noEffect)offset+=wrongDirection?1:-1;', 'if(!noEffect){if(microPixels>0)microPixels--;else offset+=wrongDirection?1:-1;}')
s = once(s, 'new Rectangle(0,offset*4,1024,576)', 'new Rectangle(0,offset*4+microPixels,1024,576)')
s = once(s, '+" offset="+offset);', '+" offset="+offset+" microPixels="+microPixels);')
s = once(s, '{offset=displacement;keyDowns=keyUps=0;', '{offset=displacement;microPixels=0;keyDowns=keyUps=0;')
s = once(s, '            evidence.AppendLine("DESKTOP_PROBE OK', '''            Reset(0,false,false);
            Check(Execute("wash-maintain","nearby-no-drift",false).StartsWith("WASH_STABLE 0 0 "),"NEARBY_NO_DRIFT_MOVED");
            // One physical screen pixel is 0.25px in the captured 256-wide image.
            // This previously fell inside the 0.65px no-input band.
            Reset(0,false,false);microPixels=1;Invalidate();Update();Pump(150);
            Check(Execute("wash-correct","micro-standard-baseline",false).StartsWith("WASH_STABLE 0 0 "),"STANDARD_PROFILE_CHANGED");
            Check(microPixels==1 && keyDowns==0,"STANDARD_BASELINE_MOVED");
            for(int cycle=0;cycle<8;cycle++)
            {
                keyDowns=keyUps=0;microPixels=1;Invalidate();Update();Pump(150);
                Check(Execute("wash-maintain","micro-cycle-"+cycle,false).StartsWith("WASH_STABLE "),"MICRO_CYCLE_FAILED");
                Check(microPixels==0 && offset==0 && keyDowns==1,"MICRO_NATIVE_INPUT_NOT_OBSERVED");
            }
            Reset(3,true,false);
            Check(Execute("wash-maintain","nearby-no-effect",false)=="ERROR FORWARD_NO_OBSERVED_EFFECT","NEARBY_NO_EFFECT_GUARD");
            Check(keyDowns==2,"NEARBY_NO_EFFECT_BUDGET");
            Reset(3,false,true);
            Check(Execute("wash-maintain","nearby-wrong-direction",false)=="ERROR WRONG_DIRECTION_OR_CAMERA_MOVED","NEARBY_DIRECTION_GUARD");
            Check(keyDowns==1,"NEARBY_DIRECTION_BUDGET");
            Reset(3,false,false);
            Check(Execute("wash-maintain","nearby-pre-cancel",true)=="ERROR CANCELLED","NEARBY_CANCEL");
            Check(keyDowns==0,"NEARBY_CANCEL_INPUT");
            evidence.AppendLine("DESKTOP_PROBE OK''')
write(n, s)
n = 'scripts/Test-WashPositionDesktop.ps1'
s = read(n)
s = once(s, 'WaitForExit(90000)', 'WaitForExit(180000)')
write(n, s)
n = 'scripts/Test-WashRecoveryContract.ps1'
s = read(n)
s += '''
$washModule = [IO.File]::ReadAllText((Join-Path (Split-Path $resolvedSource) 'wash-position.ahk'))
Assert-Contract ($washModule.Contains('ObservedWashCorrectionOperation(generation)') -and
    $washModule.Contains('ExeRouteBindingValid("washing", State.serverEpoch)') -and
    $correct.Contains('RunObservedWashHelper(correctionOperation, expectedGeneration)')) 'Nearby precise correction is not bound to the registered active route.'
Assert-Contract ($vision.Contains('CUMULATIVE_MICRO_DRIFT_TEST') -and $vision.Contains('RefineSubpixel') -and
    $vision.Contains('NO_INPUT_WITHIN_TOLERANCE') -and $vision.Contains('noEffect>=2')) 'Micro drift, zero-input and consecutive-no-effect regressions are missing.'
Assert-Contract ($source.Contains('WASH_RECOVERY_TICK') -and $source.Contains('前進補正OFF')) 'Input-disabled and pending-dispatch states are not observable.'
'''
write(n, s)
print('Applied nearby micro-displacement detection, correction response and observable input stages.')
