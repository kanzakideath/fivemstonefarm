// Fishing Recorder 1.0.0 -- explicit, local, read-only observation.
// No SendInput, keybd_event, hooks, process-memory access, CDP or network calls.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
[assembly: AssemblyTitle("Fishing Recorder")]
[assembly: AssemblyDescription("Local, consent-based fishing timing recorder; no automation")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]
namespace FishingRecorder {
static class Native {
    [StructLayout(LayoutKind.Sequential)] internal struct RECT { public int L,T,R,B; }
    [StructLayout(LayoutKind.Sequential)] internal struct POINT { public int X,Y; }
    internal delegate bool EnumProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumProc cb, IntPtr p);
    [DllImport("user32.dll")] internal static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] internal static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr h, out uint id);
    [DllImport("user32.dll")] internal static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] internal static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [DllImport("user32.dll")] internal static extern short GetAsyncKeyState(int v);
    [DllImport("user32.dll", SetLastError=true)] internal static extern bool RegisterHotKey(IntPtr h, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] internal static extern bool UnregisterHotKey(IntPtr h, int id);
    [DllImport("user32.dll")] internal static extern bool SetProcessDpiAwarenessContext(IntPtr c);
    [DllImport("user32.dll")] internal static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] internal static extern bool SetWindowDisplayAffinity(IntPtr h, uint a);
    [DllImport("winmm.dll")] internal static extern uint timeBeginPeriod(uint p);
    [DllImport("winmm.dll")] internal static extern uint timeEndPeriod(uint p);
    internal static bool Bounds(IntPtr h, out Rectangle r) {
        RECT q; POINT p = new POINT(); r=Rectangle.Empty;
        if (!IsWindow(h) || IsIconic(h) || !GetClientRect(h,out q) || !ClientToScreen(h,ref p)) return false;
        r = new Rectangle(p.X,p.Y,q.R-q.L,q.B-q.T);
        return r.Width >= 320 && r.Height >= 240 && SystemInformation.VirtualScreen.Contains(r);
    }
    internal static bool Active(IntPtr h, uint pid) {
        uint current; GetWindowThreadProcessId(h,out current);
        return GetForegroundWindow()==h && IsWindow(h) && !IsIconic(h) && current==pid;
    }
    internal static List<GameWindow> Games() {
        var result=new List<GameWindow>();
        EnumWindows(delegate(IntPtr h,IntPtr unused) {
            try {
                if (!IsWindowVisible(h)) return true;
                uint id; GetWindowThreadProcessId(h,out id);
                using(var p=Process.GetProcessById((int)id)) {
                    Rectangle r;
                    if(p.ProcessName.StartsWith("FiveM",StringComparison.OrdinalIgnoreCase) && Bounds(h,out r))
                        result.Add(new GameWindow(h,id,r));
                }
            } catch { }
            return true;
        },IntPtr.Zero);
        return result.OrderByDescending(x=>x.Rect.Width*x.Rect.Height).ToList();
    }
}
sealed class GameWindow {
    internal IntPtr Handle; internal uint Pid; internal Rectangle Rect;
    internal GameWindow(IntPtr h,uint p,Rectangle r){Handle=h;Pid=p;Rect=r;}
    public override string ToString(){return "FiveM  " + Rect.Width + " x " + Rect.Height + "  (PID " + Pid + ")";}
}
static class Json {
    internal static string Serialize(object o){return new JavaScriptSerializer().Serialize(o);}
    internal static void Save(string path,object o){File.WriteAllText(path,Serialize(o),new UTF8Encoding(false));}
}
sealed class Journal : IDisposable {
    readonly object gate=new object(); StreamWriter writer;
    internal Journal(string path){writer=new StreamWriter(new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.Read),new UTF8Encoding(false));writer.AutoFlush=true;}
    internal void Write(object e){lock(gate){if(writer!=null) writer.WriteLine(Json.Serialize(e));}}
    public void Dispose(){lock(gate){if(writer!=null){writer.Dispose();writer=null;}}}
}
// An allowed-key edge tracker. Initial/held keys and focus transitions never synthesize a press.
sealed class KeyTracker {
    readonly bool[] old=new bool[20]; bool ready;
    internal void Update(bool active,bool[] states,Action<int,string> emit) {
        if(!active){
            if(ready) for(int i=0;i<20;i++) if(old[i]) emit(i,"cancel");
            ready=false; Array.Clear(old,0,20); return;
        }
        if(!ready){Array.Copy(states,old,20);ready=true;return;}
        for(int i=0;i<20;i++) if(states[i]!=old[i]){old[i]=states[i];emit(i,states[i]?"down":"up");}
    }
}
// Baseline MJPEG AVI, one independently decodable JPEG per frame. Exact capture
// timing is in frames.csv; playback is an inspection convenience, not a clock.
sealed class AviWriter : IDisposable {
    readonly FileStream f; readonly BinaryWriter w;
    readonly List<Tuple<uint,uint>> index=new List<Tuple<uint,uint>>();
    readonly int width,height,fps; long moviSize,moviType,totalFrames,strLength; bool closed;
    internal int Count {get{return index.Count;}}
    internal long Bytes {get{return f.Position;}}
    internal AviWriter(string path,int width,int height,int fps) {
        this.width=width;this.height=height;this.fps=fps;
        f=new FileStream(path,FileMode.CreateNew,FileAccess.ReadWrite,FileShare.Read,65536);w=new BinaryWriter(f);
        Four("RIFF");w.Write(0);Four("AVI ");
        long hdrl=BeginList("hdrl");Four("avih");w.Write(56);
        w.Write(1000000/fps);w.Write(width*height*fps);w.Write(0);w.Write(0x10);
        totalFrames=f.Position;w.Write(0);w.Write(0);w.Write(1);w.Write(width*height*3);
        w.Write(width);w.Write(height);for(int i=0;i<4;i++)w.Write(0);
        long strl=BeginList("strl");Four("strh");w.Write(56);Four("vids");Four("MJPG");
        w.Write(0);w.Write((short)0);w.Write((short)0);w.Write(0);w.Write(1);w.Write(fps);w.Write(0);
        strLength=f.Position;w.Write(0);w.Write(width*height*3);w.Write(-1);w.Write(0);
        w.Write((short)0);w.Write((short)0);w.Write((short)width);w.Write((short)height);
        Four("strf");w.Write(40);w.Write(40);w.Write(width);w.Write(height);
        w.Write((short)1);w.Write((short)24);Four("MJPG");w.Write(width*height*3);
        w.Write(0);w.Write(0);w.Write(0);w.Write(0);EndList(strl);EndList(hdrl);
        moviSize=BeginList("movi");moviType=moviSize+4;
    }
    void Four(string s){w.Write(Encoding.ASCII.GetBytes(s));}
    long BeginList(string s){Four("LIST");long p=f.Position;w.Write(0);Four(s);return p;}
    void Patch(long p,uint value){long e=f.Position;f.Position=p;w.Write(value);f.Position=e;}
    void EndList(long p){Patch(p,checked((uint)(f.Position-p-4)));}
    internal void Add(byte[] jpeg){
        if(closed)throw new ObjectDisposedException("AVI");
        index.Add(Tuple.Create(checked((uint)(f.Position-moviType)),(uint)jpeg.Length));
        Four("00dc");w.Write(jpeg.Length);w.Write(jpeg);if((jpeg.Length&1)!=0)w.Write((byte)0);
        if(index.Count%60==0)w.Flush();
    }
    public void Dispose(){
        if(closed)return;closed=true;
        try{EndList(moviSize);Four("idx1");w.Write(index.Count*16);
            foreach(var e in index){Four("00dc");w.Write(0x10);w.Write(e.Item1);w.Write(e.Item2);}
            Patch(totalFrames,(uint)index.Count);Patch(strLength,(uint)index.Count);Patch(4,checked((uint)(f.Position-8)));w.Flush();
        }finally{w.Dispose();}
    }
}
static class Capture {
    internal static readonly ImageCodecInfo Codec=ImageCodecInfo.GetImageEncoders().First(x=>x.MimeType=="image/jpeg");
    internal static Rectangle Ring(Rectangle game) {
        int side=Math.Max(100,(int)Math.Round(game.Height*.28));
        return new Rectangle(game.X+(game.Width-side)/2,game.Y+(game.Height-side)/2,side,side);
    }
    internal static Rectangle Notice(Rectangle g){return new Rectangle(g.X+(int)(g.Width*.68),g.Y+(int)(g.Height*.205),(int)(g.Width*.315),(int)(g.Height*.32));}
    internal static Rectangle Reward(Rectangle g){return new Rectangle(g.X+(int)(g.Width*.32),g.Y+(int)(g.Height*.70),(int)(g.Width*.40),(int)(g.Height*.23));}
    internal static Bitmap Region(Rectangle r,int width,int height) {
        using(var raw=new Bitmap(r.Width,r.Height,PixelFormat.Format24bppRgb)) {
            using(var g=Graphics.FromImage(raw))g.CopyFromScreen(r.Location,Point.Empty,r.Size,CopyPixelOperation.SourceCopy);
            var output=new Bitmap(width,height,PixelFormat.Format24bppRgb);
            using(var g=Graphics.FromImage(output)){g.InterpolationMode=InterpolationMode.HighQualityBilinear;g.DrawImage(raw,new Rectangle(0,0,width,height));}
            return output;
        }
    }
    internal static byte[] Jpeg(Bitmap bmp) {
        using(var ms=new MemoryStream())using(var ps=new EncoderParameters(1)) {
            ps.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,78L);
            bmp.Save(ms,Codec,ps);return ms.ToArray();
        }
    }
    internal static Bitmap Context(Rectangle game) {
        var image=new Bitmap(640,440,PixelFormat.Format24bppRgb);
        try {using(var top=Region(Notice(game),640,270))using(var bottom=Region(Reward(game),640,144))
            using(var g=Graphics.FromImage(image)) {
                g.Clear(Color.Black);g.DrawImageUnscaled(top,0,18);g.DrawImageUnscaled(bottom,0,296);
                g.DrawString("Notification area (not classified)",SystemFonts.DefaultFont,Brushes.White,4,2);
                g.DrawString("Reward area (not classified)",SystemFonts.DefaultFont,Brushes.White,4,281);
            }
            return image;
        }catch{image.Dispose();throw;}
    }
}
sealed class Session {
    internal const int FPS=60; internal const long LimitBytes=180L*1024*1024;
    internal readonly string Folder; internal readonly GameWindow Game; internal readonly Stopwatch Clock=new Stopwatch();
    internal volatile bool Paused,Stopping,Done,Focused; internal volatile string Problem="",StopReason="user",LastKey="-";
    internal volatile int Frames,KeyDowns,Contexts; internal long TotalBytes;
    internal double MaxFrameGap,MaxKeyPollGap,CaptureTotalMs; internal int KeyPollsOver20;
    internal int Marker; internal readonly int LimitSeconds; internal string ArchivePath="";
    readonly Journal events; readonly Thread captureThread,keyThread; int keyContactRequested; bool finalized; uint timerResult;
    internal Session(GameWindow game,string parent,int seconds){
        Game=game;LimitSeconds=seconds;
        Folder=Path.Combine(parent,"FishingSample-"+DateTime.Now.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N").Substring(0,6));
        Directory.CreateDirectory(Folder);Directory.CreateDirectory(Path.Combine(Folder,"context"));Directory.CreateDirectory(Path.Combine(Folder,"contacts"));
        events=new Journal(Path.Combine(Folder,"events.jsonl"));
        Json.Save(Path.Combine(Folder,"session.json"),new {schema=1,version="1.0.0",started_utc=DateTime.UtcNow.ToString("o"),clock="Stopwatch monotonic; milliseconds from recording start",stopwatch_frequency=Stopwatch.Frequency,
            capture="Foreground screen crops only; no input generated",target_fps=FPS,ring_output=new[]{320,320},context_target_fps=6,ring_side_fraction_of_height=.28,
            notice_roi=new[]{.68,.205,.315,.32},reward_roi=new[]{.32,.70,.40,.23},allowed_keys="Top row 0-9 and numpad 0-9 only",key_sampling="2 ms requested; actual gaps measured; polled observations, not hardware timestamps",limits=new{seconds=seconds,bytes=LimitBytes},os_version=Environment.OSVersion.VersionString});
        captureThread=new Thread(CaptureLoop){IsBackground=true,Name="FishingRecorder.Capture"};
        keyThread=new Thread(KeyLoop){IsBackground=true,Name="FishingRecorder.NumericKeys"};
    }
    internal double Ms {get{return Clock.ElapsedTicks*1000.0/Stopwatch.Frequency;}}
    internal void Start(){timerResult=Native.timeBeginPeriod(1);Clock.Start();Event("recording_started","explicit user start");keyThread.Start();captureThread.Start();}
    internal bool Allowed(){return !Paused && !Stopping && Native.Active(Game.Handle,Game.Pid);}
    internal void Event(string kind,string detail){events.Write(new {t_ms=Math.Round(Ms,3),type=kind,detail=detail});}
    internal void Mark(){int n=Interlocked.Increment(ref Marker);Event("user_marker","marker "+n+"; no success/failure assumption");}
    internal void Pause(){Paused=!Paused;Event(Paused?"user_pause":"user_resume","");}
    internal void RequestStop(string reason){StopReason=reason;Stopping=true;}
    void KeyLoop(){
        var tracker=new KeyTracker();var states=new bool[20];double previous=Ms;bool activeBefore=false;
        try{while(!Stopping){
            double now=Ms;double gap=now-previous;previous=now;
            bool active=Allowed();
            // Never inspect digit state outside the target window or with command modifiers.
            if(active) active=Native.GetAsyncKeyState(0x11)>=0 && Native.GetAsyncKeyState(0x12)>=0;
            if(active){
                if(activeBefore){MaxKeyPollGap=Math.Max(MaxKeyPollGap,gap);if(gap>20)KeyPollsOver20++;}
                for(int i=0;i<20;i++)states[i]=Native.GetAsyncKeyState(i<10?0x30+i:0x60+i-10)<0;
                // Drop this entire observation if focus changed while sampling.
                active=Allowed();
            }
            tracker.Update(active,states,delegate(int i,string edge){
                events.Write(new{t_ms=Math.Round(Ms,3),type="digit",edge=edge,key=i%10,bank=i<10?"top":"numpad",sample_gap_ms=Math.Round(gap,3)});
                if(edge=="down"){Interlocked.Increment(ref KeyDowns);LastKey=(i%10).ToString();Interlocked.Increment(ref keyContactRequested);}
            });
            activeBefore=active;Thread.Sleep(2);
        }
        tracker.Update(false,states,delegate(int i,string edge){events.Write(new{t_ms=Math.Round(Ms,3),type="digit",edge="cancel",key=i%10,bank=i<10?"top":"numpad",reason="recorder_stop"});});
        }catch(Exception e){Problem="キー記録: "+e.GetType().Name;RequestStop("key_record_error");}
    }
    void CaptureLoop(){
        AviWriter avi=null;StreamWriter times=null;StreamWriter contexts=null;
        double next=0,nextContext=0,lastFrame=-1;bool priorFocus=false;Rectangle lastRect=Rectangle.Empty;int contact=0;
        try{
            avi=new AviWriter(Path.Combine(Folder,"ring.avi"),320,320,FPS);
            times=new StreamWriter(Path.Combine(Folder,"frames.csv"),false,new UTF8Encoding(false));
            contexts=new StreamWriter(Path.Combine(Folder,"context.csv"),false,new UTF8Encoding(false));
            times.WriteLine("frame,t_start_ms,t_end_ms,client_x,client_y,client_width,client_height,roi_x,roi_y,roi_width,roi_height,jpeg_bytes");
            contexts.WriteLine("frame,t_start_ms,t_end_ms,file");
            while(!Stopping){
                double now=Ms;
                if(now>=LimitSeconds*1000){RequestStop("duration_limit");break;}
                if(Interlocked.Read(ref TotalBytes)>=LimitBytes){RequestStop("size_limit");break;}
                Rectangle rect;
                bool active=Allowed() && Native.Bounds(Game.Handle,out rect);
                Focused=active;
                if(active!=priorFocus){Event(active?"capture_resume":"capture_pause",active?"target_foreground":"not_foreground_or_paused_or_outside_screen");priorFocus=active;lastFrame=-1;}
                if(!active){Thread.Sleep(15);continue;}
                if(now<next){Thread.Sleep(1);continue;}
                if(!Native.Bounds(Game.Handle,out rect)){Thread.Sleep(15);continue;}
                if(rect!=lastRect){Event("client_geometry",rect.X+","+rect.Y+","+rect.Width+","+rect.Height);lastRect=rect;}
                Rectangle roi=Capture.Ring(rect);double started=Ms;
                using(var image=Capture.Region(roi,320,320)){
                    double ended=Ms; Rectangle current;
                    if(!Allowed() || !Native.Bounds(Game.Handle,out current) || current!=rect){next=Ms+16;continue;}
                    byte[] jpeg=Capture.Jpeg(image);int number=avi.Count;avi.Add(jpeg);
                    times.WriteLine(String.Format(System.Globalization.CultureInfo.InvariantCulture,"{0},{1:F3},{2:F3},{3},{4},{5},{6},{7},{8},{9},{10},{11}",number,started,ended,rect.X,rect.Y,rect.Width,rect.Height,roi.X,roi.Y,roi.Width,roi.Height,jpeg.Length));
                    if(lastFrame>=0)MaxFrameGap=Math.Max(MaxFrameGap,started-lastFrame);
                    lastFrame=started;CaptureTotalMs+=ended-started;Frames=avi.Count;Interlocked.Add(ref TotalBytes,jpeg.Length);
                    if(number==0)File.WriteAllBytes(Path.Combine(Folder,"first-ring.jpg"),jpeg);
                    if(Interlocked.Exchange(ref keyContactRequested,0)>0 && contact<300){
                        string name="contacts/"+(contact++).ToString("D4")+"-key-"+LastKey+"-"+((long)ended)+"ms.jpg";
                        File.WriteAllBytes(Path.Combine(Folder,name),jpeg);
                        Event("contact_frame",name+"; next available frame after key-down, not the exact key frame");
                    }
                }
                // Context crops are evidence, not an automatic result classifier.
                if(Ms>=nextContext && Allowed()){
                    double cs=Ms;
                    using(var context=Capture.Context(rect)){
                        double ce=Ms;Rectangle current;
                        if(Allowed() && Native.Bounds(Game.Handle,out current) && current==rect){
                            byte[] bytes=Capture.Jpeg(context);string name="context/"+Contexts.ToString("D5")+".jpg";
                            File.WriteAllBytes(Path.Combine(Folder,name),bytes);
                            contexts.WriteLine(String.Format(System.Globalization.CultureInfo.InvariantCulture,"{0},{1:F3},{2:F3},{3}",Contexts,cs,ce,name));
                            Contexts++;Interlocked.Add(ref TotalBytes,bytes.Length);
                        }
                    }
                    nextContext=Ms+1000.0/6;
                }
                if(Frames%60==0){times.Flush();contexts.Flush();}
                next=Math.Max(next+1000.0/FPS,Ms);
            }
        }catch(Exception e){Problem="画面記録: "+e.GetType().Name;RequestStop("capture_error");}
        finally{
            Stopping=true;
            try{if(avi!=null)avi.Dispose();if(times!=null)times.Dispose();if(contexts!=null)contexts.Dispose();}
            catch(Exception e){Problem="動画の確定: "+e.GetType().Name;StopReason="finalize_error";}
            Done=true;
        }
    }
    internal string Finish(){
        if(finalized)return ArchivePath;
        Stopping=true;
        if(!captureThread.Join(8000) || !keyThread.Join(3000))throw new IOException("記録スレッドの終了待ちです。元データは保存先フォルダーに残っています。");
        if(timerResult==0)Native.timeEndPeriod(1);
        Event("recording_stopped",StopReason);events.Dispose();
        Json.Save(Path.Combine(Folder,"summary.json"),new{schema=1,version="1.0.0",elapsed_ms=Math.Round(Ms,3),frames=Frames,context_frames=Contexts,digit_downs=KeyDowns,markers=Marker,
            max_contiguous_frame_gap_ms=Math.Round(MaxFrameGap,3),max_active_key_poll_gap_ms=Math.Round(MaxKeyPollGap,3),key_poll_gaps_over_20ms=KeyPollsOver20,
            average_capture_ms=Frames>0?Math.Round(CaptureTotalMs/Frames,3):0,stop_reason=StopReason,error=Problem,
            fish_caught=(int?)null,note="Digit presses, including 2, are NOT classified as cast or catch. Use frames.csv, events.jsonl and context.csv together. ring.avi playback omits pauses/dropped frame time; CSV timestamps are authoritative."});
        File.WriteAllText(Path.Combine(Folder,"HOW-TO-ANALYZE.txt"),
            "Fishing Recorder 1.0.0 / LOCAL OBSERVATION ONLY\r\n"+
            "ring.avi: 320x320 MJPEG, nominal 60 fps. Each frame maps 1:1 to frames.csv.\r\n"+
            "Do not use video playback time to measure gameplay: lost focus, pause and capture delays create gaps. Use t_start_ms/t_end_ms from the shared monotonic clock.\r\n"+
            "events.jsonl: only top-row/numpad digit edges while target foreground, recording and no Ctrl/Alt. cancel is NOT a physical release. Polling can miss taps shorter than actual polling gaps.\r\n"+
            "context/*.jpg + context.csv: right notification crop above the middle and lower-center reward crop, sampled about 6/s. Captured text is not interpreted.\r\n"+
            "contacts/: first available central frame after one or more digit-downs; not frame-accurate key time.\r\n"+
            "No network upload, audio, process memory, server calls or automatic input. No success is inferred merely from key 2 or ring disappearance.\r\n"+
            "Images can include game labels or notifications. Inspect before sharing. Do not chat/type secrets while recording.\r\n"+
            "Analyze cast->ring appearance, white edge/green arc at key-down, repeated prompts (including same digit), reward confirmation and next manual cast.\r\n",new UTF8Encoding(false));
        string html="<!doctype html><meta charset=\"utf-8\"><title>Fishing recording review</title><style>body{font:16px system-ui;margin:24px;background:#f4f5f8}img{max-width:100%}figure{display:inline-block;background:white;padding:12px;vertical-align:top}figcaption{max-width:320px}h1{font-size:24px}</style><h1>釣り記録の確認</h1><p>数字入力の直後のサンプルです。正確な前後関係は ring.avi と frames.csv・events.jsonl で確認します。入力数は釣果数ではありません。</p>";
        foreach(string f in Directory.GetFiles(Path.Combine(Folder,"contacts"),"*.jpg").OrderBy(x=>x))html+="<figure><img width=320 src=\"contacts/"+Path.GetFileName(f)+"\"><figcaption>"+Path.GetFileName(f)+"</figcaption></figure>";
        File.WriteAllText(Path.Combine(Folder,"review.html"),html,new UTF8Encoding(false));
        string zip=Folder+".zip",temp=zip+".partial";
        if(File.Exists(temp))File.Delete(temp);
        ZipFile.CreateFromDirectory(Folder,temp,CompressionLevel.Fastest,false);
        File.Move(temp,zip);ArchivePath=zip;finalized=true;return zip;
    }
}
sealed class Hud : Form {
    internal string CaptionText="";
    internal Hud(){FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;BackColor=Color.FromArgb(24,35,51);ForeColor=Color.White;ClientSize=new Size(350,82);Font=new Font("Yu Gothic UI",10);DoubleBuffered=true;}
    protected override bool ShowWithoutActivation {get{return true;}}
    protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x08000000|0x20|0x80;return p;}}
    protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);try{Native.SetWindowDisplayAffinity(Handle,0x11);}catch{}}
    protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);e.Graphics.DrawString(CaptionText,Font,Brushes.White,new RectangleF(12,10,330,65));}
}
sealed class MainForm : Form {
    readonly ComboBox targets=new ComboBox(),minutes=new ComboBox();
    readonly Button start=new Button(),stop=new Button(),pause=new Button(),refresh=new Button(),open=new Button();
    readonly Label info=new Label(),status=new Label();
    readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer(); readonly Hud hud=new Hud();
    internal Session Current; internal string OutputRoot; bool saving; int countdown; string lastArchive="";double lastFramesTime;int lastFrames;double observedFps;
    internal MainForm(){
        Text="釣りの記録ツール 1.0.0（自動操作なし）";ClientSize=new Size(660,620);MinimumSize=new Size(640,600);
        Font=new Font("Yu Gothic UI",10);BackColor=Color.FromArgb(244,246,249);StartPosition=FormStartPosition.CenterScreen;AutoScaleMode=AutoScaleMode.Dpi;
        OutputRoot=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"FishingRecorder");
        var title=new Label{Text="手動の釣りを、そのまま記録",Font=new Font("Yu Gothic UI",20,FontStyle.Bold),AutoSize=true,Location=new Point(24,20)};Controls.Add(title);
        info.Text="中央の円・数字と、右の通知／下の獲得欄を撮影します。\n数字 0～9 の押した・離した時刻を記録。キーは送りません。\nFiveM以外へ切り替えると撮影と数字の記録を中断します。";
        info.SetBounds(26,74,610,76);Controls.Add(info);
        targets.DropDownStyle=ComboBoxStyle.DropDownList;targets.SetBounds(26,160,470,30);Controls.Add(targets);
        refresh.Text="再検出";refresh.SetBounds(506,158,124,34);refresh.Click+=delegate{RefreshGames();};Controls.Add(refresh);
        var length=new Label{Text="自動保存まで",AutoSize=true,Location=new Point(26,210)};Controls.Add(length);
        minutes.DropDownStyle=ComboBoxStyle.DropDownList;minutes.Items.AddRange(new object[]{"3分（おすすめ）","5分"});minutes.SelectedIndex=0;minutes.SetBounds(145,205,180,32);Controls.Add(minutes);
        var tip=new Label{Text="上限180MiBで先に保存する場合もあります。",AutoSize=true,Location=new Point(338,210),Font=new Font("Yu Gothic UI",8)};Controls.Add(tip);
        start.Text="記録開始（3秒後）";start.SetBounds(26,252,294,52);start.BackColor=Color.FromArgb(42,110,209);start.ForeColor=Color.White;start.FlatStyle=FlatStyle.Flat;start.Click+=delegate{StartCountdown();};Controls.Add(start);
        stop.Text="終了してZIPを保存";stop.SetBounds(334,252,296,52);stop.Enabled=false;stop.Click+=delegate{EndRecording();};Controls.Add(stop);
        pause.Text="一時停止／再開";pause.SetBounds(26,316,210,36);pause.Enabled=false;pause.Click+=delegate{if(Current!=null && !saving)Current.Pause();};Controls.Add(pause);
        open.Text="保存フォルダー";open.SetBounds(248,316,190,36);open.Click+=delegate{Directory.CreateDirectory(OutputRoot);Process.Start("explorer.exe",'"'+OutputRoot+'"');};Controls.Add(open);
        var keys=new Label{Text="Ctrl + Alt + F8：開始／一時停止／再開\nCtrl + Alt + F9：終了・保存　　F10（Ctrl+Alt）：目印",AutoSize=false,Location=new Point(26,366),Size=new Size(604,50)};Controls.Add(keys);
        status.SetBounds(26,423,600,84);status.Font=new Font("Yu Gothic UI",10,FontStyle.Bold);status.Text="①採掘ツールの自動操作を停止　②FiveMをウィンドウ表示\n③記録開始 → FiveMへ戻り、普段どおり2で竿を使って釣る";Controls.Add(status);
        var privacy=new Label{Text="録音・全画面撮影・自動送信なし。数字以外の文字は記録しません。\nただし撮影範囲に映るゲーム内の文字は残ります。チャット時は一時停止。\n終了後に作られる FishingSample-日時.zip をチャットに添付してください。",AutoSize=false,Location=new Point(26,515),Size=new Size(604,82),ForeColor=Color.DimGray};Controls.Add(privacy);
        timer.Interval=250;timer.Tick+=Tick;timer.Start();
        Shown+=delegate{RefreshGames();bool ok=true;ok&=Native.RegisterHotKey(Handle,1,0x4003,0x77);ok&=Native.RegisterHotKey(Handle,2,0x4003,0x78);ok&=Native.RegisterHotKey(Handle,3,0x4003,0x79);if(!ok)MessageBox.Show(this,"ショートカットの一部が他アプリで使用中です。画面の開始・終了ボタンは使えます。","お知らせ");};
        FormClosing+=delegate(object sender,FormClosingEventArgs e){if(Current!=null || saving){e.Cancel=true;if(!saving)EndRecording();}else{timer.Stop();for(int i=1;i<=3;i++)Native.UnregisterHotKey(Handle,i);hud.Close();}};
    }
    void RefreshGames(){if(Current!=null || saving)return;targets.Items.Clear();foreach(var g in Native.Games())targets.Items.Add(g);if(targets.Items.Count>0)targets.SelectedIndex=0;else status.Text="FiveMのゲーム画面を開いてから「再検出」を押してください。";}
    protected override void WndProc(ref Message m){if(m.Msg==0x312){int id=m.WParam.ToInt32();if(id==1){if(Current==null)StartCountdown();else if(!saving)Current.Pause();}if(id==2)EndRecording();if(id==3 && Current!=null && !saving)Current.Mark();}base.WndProc(ref m);}
    void StartCountdown(){
        if(Current!=null || saving || countdown>0)return;
        if(targets.SelectedItem==null){RefreshGames();if(targets.SelectedItem==null)return;}
        try{Directory.CreateDirectory(OutputRoot);var drive=new DriveInfo(Path.GetPathRoot(Path.GetFullPath(OutputRoot)));if(drive.AvailableFreeSpace<500L*1024*1024)throw new IOException("保存先に500MiB以上の空きが必要です。");}
        catch(Exception e){MessageBox.Show(this,e.Message,"保存先エラー");return;}
        countdown=12;start.Enabled=false;stop.Enabled=true;status.Text="3秒後に開始します。FiveMの画面へ切り替えてください。";
    }
    void Tick(object sender,EventArgs e){
        if(countdown>0){countdown--;if(countdown==0){
            try{Current=new Session((GameWindow)targets.SelectedItem,OutputRoot,minutes.SelectedIndex==1?300:180);Current.Start();pause.Enabled=true;refresh.Enabled=false;targets.Enabled=false;minutes.Enabled=false;lastFrames=0;lastFramesTime=0;observedFps=0;WindowState=FormWindowState.Minimized;}
            catch(Exception ex){Current=null;start.Enabled=true;stop.Enabled=false;MessageBox.Show(this,ex.Message,"記録開始エラー");}
        }return;}
        var s=Current;if(s==null || saving)return;
        if(s.Done){EndRecording();return;}
        double elapsed=s.Ms;
        if(elapsed-lastFramesTime>=1000){observedFps=(s.Frames-lastFrames)*1000/(elapsed-lastFramesTime);lastFrames=s.Frames;lastFramesTime=elapsed;}
        string stage=s.Paused?"一時停止中":s.Focused?"記録中":"FiveMが前面になるまで待機";
        string timing=TimeSpan.FromMilliseconds(elapsed).ToString(@"mm\:ss");
        status.Text=stage+"  "+timing+" / 数字入力 "+s.KeyDowns+"回\n中央 "+observedFps.ToString("F0")+" fps（目標60） / "+(Interlocked.Read(ref s.TotalBytes)/1048576.0).ToString("F1")+" MiB\nCtrl+Alt+F9 で保存して終了";
        Rectangle r;
        if(Native.Active(s.Game.Handle,s.Game.Pid) && Native.Bounds(s.Game.Handle,out r)){
            hud.Location=new Point(r.X+12,r.Y+Math.Max(12,r.Height-170));hud.CaptionText=stage+" "+timing+"  数字 "+s.KeyDowns+"回\n中央 "+observedFps.ToString("F0")+" fps / 最後の数字 "+s.LastKey+"\nCtrl+Alt+F9：ZIP保存";hud.Invalidate();if(!hud.Visible)hud.Show();
        }else hud.Hide();
    }
    void EndRecording(){
        if(saving)return;
        if(countdown>0){countdown=0;start.Enabled=true;stop.Enabled=false;status.Text="開始を取り消しました。";return;}
        var s=Current;if(s==null)return;saving=true;s.RequestStop(s.Done?s.StopReason:"user");hud.Hide();stop.Enabled=false;pause.Enabled=false;status.Text="ZIPを保存しています。ウィンドウを閉じずにお待ちください。";
        var worker=new Thread(delegate(){
            string result="",error="";try{result=s.Finish();}catch(Exception ex){error=ex.Message;}
            BeginInvoke((Action)delegate{
                saving=false;Current=null;start.Enabled=true;refresh.Enabled=true;targets.Enabled=true;minutes.Enabled=true;WindowState=FormWindowState.Normal;Show();Activate();lastArchive=result;
                if(error.Length>0){status.Text="保存に問題がありました。元データは残っています。";MessageBox.Show(this,error+"\n"+s.Folder,"保存エラー");}
                else{status.Text="保存しました。ZIPをこのチャットへ添付してください。\n"+Path.GetFileName(result)+"\n中央 "+s.Frames+"フレーム / 数字入力 "+s.KeyDowns+"回（釣果数ではありません）";
                    if(s.Frames==0)MessageBox.Show(this,"画面を1枚も撮影できていません。FiveMをウィンドウ／ボーダーレス表示にして前面で再記録してください。","記録を確認してください");
                    else if(s.KeyDowns==0)MessageBox.Show(this,"数字入力が0回です。キーを使っていないか、入力を観測できませんでした。ZIPは保存しました。","入力記録の確認");
                    if(s.Problem.Length>0)MessageBox.Show(this,s.Problem+"\n途中までのデータを保存しました。","一部記録エラー");
                    Process.Start("explorer.exe","/select,\""+result+"\"");}
            });
        });worker.IsBackground=true;worker.Start();
    }
}
static class Tests {
    static int assertions;
    static void Check(bool b,string name){assertions++;if(!b)throw new Exception(name);}
    internal static void Run(string output){
        Directory.CreateDirectory(output);
        var tracker=new KeyTracker();var states=new bool[20];var found=new List<string>();Action<int,string> edge=(i,s)=>found.Add(i+":"+s);
        tracker.Update(true,states,edge);states[1]=true;tracker.Update(true,states,edge);tracker.Update(true,states,edge);states[1]=false;tracker.Update(true,states,edge);states[1]=true;tracker.Update(true,states,edge);states[1]=false;tracker.Update(true,states,edge);
        Check(String.Join(",",found)=="1:down,1:up,1:down,1:up","same digit two prompts, no repeated down while held");
        states[2]=true;tracker.Update(true,states,edge);tracker.Update(false,states,edge);int count=found.Count;states[3]=true;tracker.Update(false,states,edge);tracker.Update(true,states,edge);Check(found.Count==count,"outside focus/held baseline generates no input");
        states[2]=false;states[3]=false;tracker.Update(true,states,edge);states[12]=true;tracker.Update(true,states,edge);Check(found.Last()=="12:down","numpad distinguished from top row");
        using(var b=new Bitmap(320,320))using(var g=Graphics.FromImage(b))using(var avi=new AviWriter(Path.Combine(output,"format-test.avi"),320,320,60)){
            for(int i=0;i<30;i++){g.Clear(Color.Navy);g.FillEllipse(Brushes.Teal,90+i,80,100,100);avi.Add(Capture.Jpeg(b));}Check(avi.Count==30,"AVI frame count");}
        using(var f=new Form()){
            f.Text="Recorder synthetic fixture (not FiveM)";f.ClientSize=new Size(960,600);f.StartPosition=FormStartPosition.Manual;f.Location=new Point(0,0);f.FormBorderStyle=FormBorderStyle.FixedToolWindow;
            f.BackColor=Color.FromArgb(10,28,43);
            int frame=0;
            f.Paint+=delegate(object sender,PaintEventArgs e){
                using(var green=new Pen(Color.Teal,10))using(var white=new Pen(Color.White,10)){
                    e.Graphics.DrawArc(green,430,250,100,100,92,38);e.Graphics.DrawArc(white,430,250,100,100,-90,frame%360);
                }
                using(var font=new Font("Segoe UI",24))e.Graphics.DrawString(frame<60?"1":"3",font,Brushes.White,466,274);
                e.Graphics.DrawString("Synthetic notification",SystemFonts.DefaultFont,Brushes.White,680,150);
                e.Graphics.DrawString("Synthetic reward",SystemFonts.DefaultFont,Brushes.White,370,475);
            };
            f.Show();f.Activate();Pump(200,()=>{});Rectangle r;Check(Native.Bounds(f.Handle,out r),"capture client rect");
            uint pid;Native.GetWindowThreadProcessId(f.Handle,out pid);
            var session=new Session(new GameWindow(f.Handle,pid,r),output,10);session.Start();
            Pump(1000,()=>{frame+=7;f.Invalidate();});Check(session.Frames>5,"real GDI frame capture on foreground synthetic window");
            session.Pause();Pump(100,()=>{});int pausedFrames=session.Frames;Pump(200,()=>{});Check(session.Frames==pausedFrames,"pause captures nothing");session.Pause();
            Pump(600,()=>{frame+=5;f.Invalidate();});
            using(var other=new Form()){other.Text="Unrelated app fixture";other.Show();other.Activate();Pump(150,()=>{});int before=session.Frames;Pump(250,()=>{});Check(session.Frames==before,"foreign foreground captures nothing");}
            f.Activate();Pump(200,()=>{frame+=9;f.Invalidate();});session.Mark();session.RequestStop("self_test");
            string archive=session.Finish();Check(File.Exists(archive),"ZIP export completed");
            using(var zip=ZipFile.OpenRead(archive)){Check(zip.GetEntry("frames.csv")!=null && zip.GetEntry("events.jsonl")!=null && zip.GetEntry("ring.avi")!=null && zip.GetEntry("summary.json")!=null,"archive contains clock, frames, input and metadata");Check(!zip.Entries.Any(x=>x.FullName.Contains(":") || x.FullName.Contains("..")),"relative archive entries");}
            using(var img=Image.FromFile(Path.Combine(session.Folder,"first-ring.jpg"))){Check(img.Width==320 && img.Height==320,"normalized center dimensions");}
            File.Copy(archive,Path.Combine(output,"synthetic-recording.zip"),true);
            f.Close();
        }
        using(var ui=new MainForm()){ui.Show();Pump(100,()=>{});using(var b=new Bitmap(ui.Width,ui.Height)){ui.DrawToBitmap(b,new Rectangle(Point.Empty,b.Size));b.Save(Path.Combine(output,"recorder-ui.png"),ImageFormat.Png);}ui.Close();}
        Json.Save(Path.Combine(output,"test-result.json"),new{passed=true,assertions=assertions,scope="Synthetic desktop capture, AVI, timestamp export and scripted key edges. NOT a FiveM game test; no keys sent to game."});
    }
    static void Pump(int ms,Action frame){var sw=Stopwatch.StartNew();while(sw.ElapsedMilliseconds<ms){frame();Application.DoEvents();Thread.Sleep(10);}}
}
static class Program {
    [STAThread] static int Main(string[] args){
        try{try{Native.SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{Native.SetProcessDPIAware();}
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            if(args.Length==2 && args[0]=="--self-test"){Tests.Run(Path.GetFullPath(args[1]));return 0;}
            bool created;using(var mutex=new Mutex(true,"Local\\FishingRecorder-1",out created)){
                if(!created){MessageBox.Show("記録ツールは既に起動しています。タスクバーを確認してください。");return 1;}
                Application.Run(new MainForm());return 0;
            }
        }catch(Exception e){
            if(args.Length==2 && args[0]=="--self-test"){Directory.CreateDirectory(args[1]);File.WriteAllText(Path.Combine(args[1],"test-failure.txt"),e.ToString());}
            else MessageBox.Show(e.Message,"釣り記録ツール");return 2;
        }
    }
}
}
