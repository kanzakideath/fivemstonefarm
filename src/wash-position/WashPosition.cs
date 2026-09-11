// Observed, foreground-only wash drift correction. No game memory, native game
// commands, server resources, camera injection or action-timer manipulation.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class WashPosition : Form
{
    internal const int W = 256, H = 144, TileSize = 14, Search = 10;
    internal static readonly Point[] Tiles = { new Point(24,34), new Point(70,34),
        new Point(170,34), new Point(216,34), new Point(24,74), new Point(70,74),
        new Point(170,74), new Point(216,74), new Point(76,110), new Point(182,110) };
    internal sealed class Match
    {
        public bool valid;
        public double error;
        public int support;
        public double quality;
    }
    internal sealed class Anchor
    {
        public int schema = 1, width, height, pid, owner;
        public long hwnd;
        public string reference;
        public string createdUtc;
    }
    internal sealed class Report
    {
        public int schema = 1;
        public string startedUtc = DateTime.UtcNow.ToString("O");
        public string result = "ERROR INCOMPLETE";
        public int pulses, inputMs;
        public double beforeError, afterError;
        public long elapsedMs, stableWaitMs;
        public bool inputsReleased;
        public List<string> events = new List<string>();
    }
    private readonly IntPtr target;
    private readonly int gamePid, parentPid;
    private readonly string operation, anchorPath, cancelPath;
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 300000 };
    private readonly Label label = new Label();
    private readonly Report report = new Report();
    private bool keyHeld, manualInput;
    private IntPtr mouseHook, keyHook;
    private HookCallback mouseCallback, keyCallback;
    private int clientWidth, clientHeight;
    private const long Marker = 0x57415348;
    internal string Result = "ERROR INCOMPLETE";

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 2) return 64;
        string result;
        try
        {
            if (args[0] == "self-test") result = SelfTest();
            else if (args.Length == 8 && (args[0] == "wash-anchor" || args[0] == "wash-correct" || args[0] == "wash-check"))
            {
                long h; int owner, pid;
                if (!Int64.TryParse(args[2], out h) || h <= 0 || !Int32.TryParse(args[3], out owner)
                    || owner <= 0 || !Int32.TryParse(args[7], out pid) || pid <= 0) throw new Exception("INVALID_IDENTITY");
                try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (EntryPointNotFoundException) { SetProcessDPIAware(); }
                Application.EnableVisualStyles();
                using (var form = new WashPosition(args[0], new IntPtr(h), owner, args[4], args[5], pid))
                { Application.Run(form); result = form.Result; }
            }
            else result = "ERROR INVALID_ARGUMENT";
        }
        catch (Exception e) { result = "ERROR " + Safe(e.Message); }
        try { AtomicWrite(args[1], result); } catch { return 74; }
        return result.StartsWith("ERROR", StringComparison.Ordinal) ? 1 : 0;
    }
    private WashPosition(string op, IntPtr window, int owner, string cancel, string path, int pid)
    {
        operation=op; target=window; parentPid=owner; gamePid=pid; cancelPath=cancel; anchorPath=path;
        FormBorderStyle=FormBorderStyle.None; ShowInTaskbar=false; TopMost=true;
        BackColor=Color.FromArgb(20,40,63); ClientSize=new Size(580,100); AutoScaleMode=AutoScaleMode.None;
        label.SetBounds(16,10,548,80); label.Font=new Font("Yu Gothic UI",10,FontStyle.Bold);
        label.ForeColor=Color.White; Controls.Add(label);
        Shown += delegate { BeginInvoke(new Action(Run)); };
        FormClosed += delegate { ReleaseKey(); RemoveHooks(); };
    }
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams
    { get { var p=base.CreateParams; p.ExStyle |= 0x08000000 | 0x00000020 | 0x00000080; return p; } }
    private void Say(string text)
    { label.Text=text + "\nF9／手動操作／他アプリへの切替で停止 · 座標ではなく景色の照合"; Refresh(); }
    private void Event(string text)
    { report.events.Add(clock.ElapsedMilliseconds.ToString(CultureInfo.InvariantCulture)+"ms "+text); }
    private void Run()
    {
        try
        {
            Guard(); RECT r; GetClientRect(target,out r); clientWidth=r.right; clientHeight=r.bottom;
            if (clientWidth < 640 || clientHeight < 360) throw new Exception("WINDOW_TOO_SMALL");
            POINT p=new POINT(); ClientToScreen(target,ref p); Location=new Point(p.x+16,p.y+16);
            foreach (int vk in new[] {0x57,0x41,0x53,0x44,0x10,0x11,0x20,0x01,0x02})
                if (Key(vk)) throw new Exception("RELEASE_MANUAL_KEYS");
            InstallHooks();
            if (operation == "wash-anchor")
            {
                Say("石洗い開始位置を記録中。視点・立ち位置は動かしません。");
                byte[] frame=WaitStable(); Match texture=Estimate(frame,frame);
                if (!texture.valid) throw new Exception("SCENERY_NOT_DISTINCT");
                // Only scenery tiles are persisted; exclude the HUD, central avatar and chat corners.
                byte[] masked=new byte[W*H];
                foreach (Point tile in Tiles) for(int y=0;y<TileSize;y++)
                    Array.Copy(frame,(tile.Y+y)*W+tile.X,masked,(tile.Y+y)*W+tile.X,TileSize);
                AtomicWrite(anchorPath,Json.Serialize(new Anchor {width=clientWidth,height=clientHeight,
                    pid=gamePid,owner=parentPid,hwnd=target.ToInt64(),reference=Convert.ToBase64String(masked),createdUtc=DateTime.UtcNow.ToString("O")}));
                Result="WASH_ANCHORED"; Event("ANCHOR_SAVED input=0");
            }
            else
            {
                var file=new FileInfo(anchorPath);
                if (!file.Exists || file.Length > 150000) throw new Exception("ANCHOR_MISSING");
                Anchor anchor=Json.Deserialize<Anchor>(File.ReadAllText(anchorPath,Encoding.UTF8));
                if(anchor==null || anchor.schema!=1 || anchor.pid!=gamePid || anchor.owner!=parentPid
                    || anchor.hwnd!=target.ToInt64() || anchor.width!=clientWidth || anchor.height!=clientHeight)
                    throw new Exception("ANCHOR_IDENTITY_CHANGED");
                byte[] reference=Convert.FromBase64String(anchor.reference);
                if(reference.Length!=W*H) throw new Exception("ANCHOR_INVALID");
                Say("洗浄後の動きが止まるまで実画面を確認中。まだ前進入力は送りません。");
                byte[] before=WaitStable(); Match match=Estimate(reference,before);
                if (!match.valid) throw new Exception("ANCHOR_LOST_NO_INPUT");
                report.beforeError=match.error; report.afterError=match.error;
                Event("OBSERVED error_px="+F(match.error)+" support="+match.support);
                if (operation=="wash-check" && !AtAnchor(match)) throw new Exception("ANCHOR_CHANGED_BEFORE_WASH");
                if (operation=="wash-correct")
                {
                    Correct(reference, before, WaitStable, PulseForward,
                        delegate { Guard(); }, delegate(Match m,int ms) {
                            Say("位置ずれ "+F(m.error)+"px · 前進 W "+ms+"ms → 画面で効果を確認");
                        }, report);
                }
                // Final independent stable sample prevents one transient frame from being success.
                Match final=Estimate(reference,WaitStable());
                if (!AtAnchor(final)) throw new Exception("FINAL_POSITION_NOT_VERIFIED");
                report.afterError=final.error;
                Result="WASH_STABLE "+report.pulses+" "+report.inputMs+" "+((int)Math.Round(final.error*1000))+" "+clock.ElapsedMilliseconds;
                Say(report.pulses==0 ? "位置ずれなし。前進せず、次の石洗いへ。" : "画面で補正完了を確認。次の石洗いへ。");
                Event("POSITION_VERIFIED pulses="+report.pulses+" error_px="+F(final.error));
            }
        }
        catch(Exception e) { Result="ERROR "+Safe(e.Message); Event(Result); }
        finally
        {
            ReleaseKey(); report.inputsReleased=!keyHeld;
            if(keyHeld) Result="ERROR KEY_RELEASE_FAILED";
            report.result=Result; report.elapsedMs=clock.ElapsedMilliseconds;
            try { AtomicWrite(anchorPath+".last-run.json",Json.Serialize(report)); } catch { Result="ERROR DIAGNOSTIC_SAVE_FAILED"; }
            RemoveHooks(); Close();
        }
    }
    internal static bool AtAnchor(Match m) { return m.valid && m.error <= 0.65; }
    // This is the same closed loop used by the real adapter and synthetic tests.
    // Re-observe after each bounded pulse. Never count input acceptance as motion.
    internal static void Correct(byte[] reference, byte[] initial, Func<byte[]> observe,
        Action<int> pulse, Action guard, Action<Match,int> status, Report r)
    {
        Match current=Estimate(reference,initial);
        int ms=30;
        for(int n=0;n<8 && r.inputMs<360 && !AtAnchor(current);n++)
        {
            guard();
            if(!current.valid || current.error > 8.0) throw new Exception("ANCHOR_LOST_NO_INPUT");
            ms=Math.Min(ms,360-r.inputMs); status(current,ms); guard();
            r.events.Add("PULSE_BEGIN ms="+ms+" before_px="+F(current.error));
            pulse(ms); r.pulses++; r.inputMs+=ms; guard();
            Match next=Estimate(reference,observe());
            r.afterError=next.error;
            r.events.Add("PULSE_OBSERVED after_px="+F(next.error)+" support="+next.support);
            if(!next.valid) throw new Exception("VISION_LOST_AFTER_INPUT");
            if(next.error > current.error + 0.45) throw new Exception("WRONG_DIRECTION_OR_CAMERA_MOVED");
            if(n>=1 && current.error-next.error<0.08 && !AtAnchor(next)) throw new Exception("FORWARD_NO_OBSERVED_EFFECT");
            double improvement=current.error-next.error;
            ms=improvement>0.08 ? (int)Math.Max(15,Math.Min(80,Math.Floor(Math.Max(0.1,next.error-0.3)/improvement*ms*0.65))) : Math.Min(80,ms+20);
            current=next;
        }
        if(!AtAnchor(current)) throw new Exception("POSITION_CORRECTION_BUDGET");
    }
    private byte[] WaitStable()
    {
        long begin=clock.ElapsedMilliseconds, stable=begin;
        byte[] first=CaptureFrame(), previous=first;
        while(clock.ElapsedMilliseconds-begin<6000)
        {
            Pause(120); byte[] next=CaptureFrame();
            Match adjacent=Estimate(previous,next), accumulated=Estimate(first,next);
            // Compare with the beginning of the window as well as the last frame:
            // slow root motion must not pass as stationary just because each delta is tiny.
            if(!adjacent.valid || adjacent.error>0.30 || !accumulated.valid || accumulated.error>0.45)
            { stable=clock.ElapsedMilliseconds; first=next; }
            if(clock.ElapsedMilliseconds-stable>=480)
            { report.stableWaitMs+=clock.ElapsedMilliseconds-begin; return next; }
            previous=next;
        }
        throw new Exception("SCENE_NOT_STABLE");
    }
    private byte[] CaptureFrame()
    {
        Guard(); RECT r; GetClientRect(target,out r);
        if(r.right!=clientWidth || r.bottom!=clientHeight) throw new Exception("DISPLAY_CHANGED");
        POINT p=new POINT(); ClientToScreen(target,ref p);
        bool visible=Visible;
        try
        {
            if(visible) Hide();
            DwmFlush(); Guard();
            using(var full=new Bitmap(r.right,r.bottom,PixelFormat.Format24bppRgb))
            using(var small=new Bitmap(W,H,PixelFormat.Format24bppRgb))
            {
                using(Graphics g=Graphics.FromImage(full)) g.CopyFromScreen(p.x,p.y,0,0,full.Size);
                using(Graphics g=Graphics.FromImage(small)) {g.InterpolationMode=InterpolationMode.HighQualityBilinear; g.DrawImage(full,0,0,W,H);}
                var data=new byte[W*H];
                for(int y=0;y<H;y++) for(int x=0;x<W;x++)
                {Color c=small.GetPixel(x,y); data[y*W+x]=(byte)((77*c.R+150*c.G+29*c.B)>>8);}
                return data;
            }
        }
        finally {if(visible && !IsDisposed) Show();}
    }
    internal static Match Estimate(byte[] reference,byte[] image)
    {
        var result=new Match {valid=false,error=Double.MaxValue};
        if(reference==null || image==null || reference.Length!=W*H || image.Length!=W*H) return result;
        var distances=new List<double>(); double quality=0;
        foreach(Point tile in Tiles)
        {
            double best=-2,second=-2; int bx=0,by=0;
            double[,] scores=new double[2*Search+1,2*Search+1];
            for(int dy=-Search;dy<=Search;dy++) for(int dx=-Search;dx<=Search;dx++)
            {
                double score=Ncc(reference,image,tile,dx,dy); scores[dx+Search,dy+Search]=score;
                if(score>best) {best=score;bx=dx;by=dy;}
            }
            if(best<0.86 || Math.Abs(bx)==Search || Math.Abs(by)==Search) continue;
            for(int dy=-Search;dy<=Search;dy++) for(int dx=-Search;dx<=Search;dx++)
                if(Math.Abs(dx-bx)>2 || Math.Abs(dy-by)>2) second=Math.Max(second,scores[dx+Search,dy+Search]);
            if(best-second<0.02) continue;
            double sx=Subpixel(scores[bx+Search-1,by+Search],best,scores[bx+Search+1,by+Search]);
            double sy=Subpixel(scores[bx+Search,by+Search-1],best,scores[bx+Search,by+Search+1]);
            distances.Add(Math.Sqrt((bx+sx)*(bx+sx)+(by+sy)*(by+sy))); quality+=best;
        }
        result.support=distances.Count;
        if(distances.Count<6) return result;
        distances.Sort();
        // Upper median prevents half the scene being unchanged (HUD/occlusion)
        // from hiding a drift observed by the other half.
        result.error=distances[distances.Count/2]; result.quality=quality/distances.Count; result.valid=true;
        return result;
    }
    private static double Ncc(byte[] a,byte[] b,Point p,int dx,int dy)
    {
        double sa=0,sb=0,aa=0,bb=0,ab=0; int n=TileSize*TileSize;
        for(int y=0;y<TileSize;y++) for(int x=0;x<TileSize;x++)
        {
            int av=a[(p.Y+y)*W+p.X+x],bv=b[(p.Y+y+dy)*W+p.X+x+dx];
            sa+=av;sb+=bv;aa+=av*av;bb+=bv*bv;ab+=av*bv;
        }
        double va=aa-sa*sa/n,vb=bb-sb*sb/n;
        return va/n<36 || vb/n<36 ? -1 : (ab-sa*sb/n)/Math.Sqrt(va*vb);
    }
    private static double Subpixel(double left,double centre,double right)
    {double d=left-2*centre+right;return Math.Abs(d)<1e-9?0:Math.Max(-.5,Math.Min(.5,.5*(left-right)/d));}
    private void PulseForward(int milliseconds)
    {
        if(operation!="wash-correct" || milliseconds<1 || milliseconds>100) throw new Exception("INPUT_NOT_AUTHORIZED");
        Guard(); keyHeld=true;
        try {KeyPacket(true); Event("W_DOWN actual_ms="+clock.ElapsedMilliseconds); Pause(milliseconds);}
        finally {ReleaseKey(); Event("W_UP actual_ms="+clock.ElapsedMilliseconds);}
        if(keyHeld) throw new Exception("KEY_RELEASE_FAILED");
    }
    private void KeyPacket(bool down)
    {
        INPUT input=new INPUT {type=1};
        input.data.key=new KEYBDINPUT {scan=(ushort)MapVirtualKey(0x57,0),flags=8u|(down?0u:2u),extra=new IntPtr(Marker)};
        if(SendInput(1,new[] {input},Marshal.SizeOf(typeof(INPUT)))!=1) throw new Exception("INPUT_REJECTED");
    }
    private void ReleaseKey()
    {
        if(!keyHeld) return;
        for(int n=0;n<3;n++) try {KeyPacket(false);keyHeld=false;break;} catch {Thread.Sleep(5);}
    }
    private void Guard()
    {
        if(File.Exists(cancelPath) || Key(0x78)) throw new Exception("CANCELLED");
        if(manualInput) throw new Exception("MANUAL_INPUT");
        if(!IsWindow(target) || GetForegroundWindow()!=target || IsIconic(target)) throw new Exception("GAME_NOT_FOREGROUND");
        uint pid;GetWindowThreadProcessId(target,out pid);if(pid!=gamePid) throw new Exception("GAME_PROCESS_CHANGED");
        try {using(var p=Process.GetProcessById(parentPid)) if(p.HasExited) throw new Exception();}
        catch {throw new Exception("OWNER_EXITED");}
        if(clock.ElapsedMilliseconds>18000) throw new Exception("CORRECTION_DEADLINE");
    }
    private void Pause(int ms)
    {long end=clock.ElapsedMilliseconds+ms; do {Guard();Application.DoEvents();Thread.Sleep(5);}while(clock.ElapsedMilliseconds<end);}
    private void InstallHooks()
    {
        keyCallback=delegate(int n,IntPtr w,IntPtr l) {
            if(n>=0 && GetForegroundWindow()==target && ((uint)Marshal.ReadInt32(l,8)&0x10)==0)
            {int k=Marshal.ReadInt32(l);if(k==0x57||k==0x41||k==0x53||k==0x44||k==0x20||k==0x1B||k==0x09)manualInput=true;}
            return CallNextHookEx(IntPtr.Zero,n,w,l);};
        mouseCallback=delegate(int n,IntPtr w,IntPtr l) {
            if(n>=0 && GetForegroundWindow()==target && ((uint)Marshal.ReadInt32(l,12)&1)==0)manualInput=true;
            return CallNextHookEx(IntPtr.Zero,n,w,l);};
        IntPtr module=GetModuleHandle(null);
        keyHook=SetWindowsHookEx(13,keyCallback,module,0); mouseHook=SetWindowsHookEx(14,mouseCallback,module,0);
        if(keyHook==IntPtr.Zero || mouseHook==IntPtr.Zero)throw new Exception("MANUAL_INPUT_GUARD_UNAVAILABLE");
    }
    private void RemoveHooks()
    {if(keyHook!=IntPtr.Zero){UnhookWindowsHookEx(keyHook);keyHook=IntPtr.Zero;} if(mouseHook!=IntPtr.Zero){UnhookWindowsHookEx(mouseHook);mouseHook=IntPtr.Zero;}}
    private static bool Key(int vk) {return (GetAsyncKeyState(vk)&0x8000)!=0;}
    private static string F(double x) {return x==Double.MaxValue?"unknown":x.ToString("0.00",CultureInfo.InvariantCulture);}
    private static string Safe(string x)
    {var s=new StringBuilder();foreach(char c in x??"UNKNOWN")if(char.IsLetterOrDigit(c)||c=='_')s.Append(c);return s.Length>100?s.ToString(0,100):s.ToString();}
    private static void AtomicWrite(string path,string text)
    {
        path=Path.GetFullPath(path);Directory.CreateDirectory(Path.GetDirectoryName(path));string tmp=path+"."+Guid.NewGuid().ToString("N")+".tmp";
        try {using(var f=new FileStream(tmp,FileMode.CreateNew,FileAccess.Write,FileShare.None)){byte[] b=Encoding.UTF8.GetBytes(text);f.Write(b,0,b.Length);f.Flush(true);}if(File.Exists(path))File.Replace(tmp,path,null);else File.Move(tmp,path);}
        finally {if(File.Exists(tmp))File.Delete(tmp);}
    }
    private static byte[] Shift(byte[] src,int dx,int dy,int brightness)
    {var b=new byte[W*H];for(int y=0;y<H;y++)for(int x=0;x<W;x++){int sx=x-dx,sy=y-dy;if(sx>=0&&sx<W&&sy>=0&&sy<H)b[y*W+x]=(byte)Math.Max(0,Math.Min(255,src[sy*W+sx]+brightness));}return b;}
    internal static string SelfTest()
    {
        var random=new Random(4412);var a=new byte[W*H];for(int n=0;n<a.Length;n++)a[n]=(byte)random.Next(25,205);
        if(!AtAnchor(Estimate(a,a)) || !AtAnchor(Estimate(a,Shift(a,0,0,20))))throw new Exception("STABLE_BRIGHTNESS_TEST");
        Match m=Estimate(a,Shift(a,0,4,0));if(!m.valid || Math.Abs(m.error-4)>.1)throw new Exception("SHIFT_TEST");
        if(Estimate(a,new byte[W*H]).valid || Estimate(new byte[W*H],new byte[W*H]).valid)throw new Exception("TEXTURE_TEST");
        var r=new Report();int shift=4;
        Correct(a,Shift(a,0,shift,0),delegate{return Shift(a,0,--shift,0);},delegate(int ms){},delegate{},delegate(Match q,int ms){},r);
        if(r.pulses!=4 || shift!=0)throw new Exception("CLOSED_LOOP_TEST");
        r=new Report();int sent=0;
        Correct(a,a,delegate{return a;},delegate(int ms){sent++;},delegate{},delegate(Match q,int ms){},r);
        if(sent!=0)throw new Exception("NO_DRIFT_MUST_NOT_MOVE");
        bool stopped=false;r=new Report();
        try {Correct(a,Shift(a,0,3,0),delegate{return Shift(a,0,3,0);},delegate(int ms){},delegate{},delegate(Match q,int ms){},r);}
        catch(Exception e){stopped=e.Message=="FORWARD_NO_OBSERVED_EFFECT";}
        if(!stopped || r.pulses!=2)throw new Exception("NO_EFFECT_GUARD_TEST");
        stopped=false;r=new Report();
        try{Correct(a,Shift(a,0,3,0),delegate{return Shift(a,0,4,0);},delegate(int ms){},delegate{},delegate(Match q,int ms){},r);}
        catch(Exception e){stopped=e.Message=="WRONG_DIRECTION_OR_CAMERA_MOVED";}
        if(!stopped || r.pulses!=1)throw new Exception("WRONG_DIRECTION_TEST");
        sent=0;stopped=false;
        try{Correct(a,Shift(a,0,3,0),delegate{return a;},delegate(int ms){sent++;},delegate{throw new Exception("CANCELLED");},delegate(Match q,int ms){},new Report());}
        catch(Exception e){stopped=e.Message=="CANCELLED";}
        if(!stopped||sent!=0)throw new Exception("CANCEL_TEST");
        if(Marshal.SizeOf(typeof(INPUT))!=(IntPtr.Size==8?40:28))throw new Exception("INPUT_LAYOUT_TEST");
        return "SELFTEST OK";
    }
    [StructLayout(LayoutKind.Sequential)] private struct RECT{public int left,top,right,bottom;}
    [StructLayout(LayoutKind.Sequential)] private struct POINT{public int x,y;}
    [StructLayout(LayoutKind.Sequential)] private struct KEYBDINPUT{public ushort key,scan;public uint flags,time;public IntPtr extra;}
    [StructLayout(LayoutKind.Sequential)] private struct MOUSEINPUT{public int x,y;public uint data,flags,time;public IntPtr extra;}
    [StructLayout(LayoutKind.Explicit)] private struct UNION{[FieldOffset(0)]public KEYBDINPUT key;[FieldOffset(0)]public MOUSEINPUT mouse;}
    [StructLayout(LayoutKind.Sequential)] private struct INPUT{public uint type;public UNION data;}
    private delegate IntPtr HookCallback(int n,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr h,out RECT r);
    [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr h,ref POINT p);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern uint MapVirtualKey(uint code,uint kind);
    [DllImport("user32.dll",SetLastError=true)] private static extern uint SendInput(uint count,INPUT[] inputs,int size);
    [DllImport("user32.dll",SetLastError=true)] private static extern IntPtr SetWindowsHookEx(int id,HookCallback fn,IntPtr module,uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr h);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr h,int n,IntPtr w,IntPtr l);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string name);
    [DllImport("dwmapi.dll")] private static extern int DwmFlush();
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] private static extern bool SetProcessDPIAware();
}
