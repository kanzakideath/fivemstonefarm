// Client-only teach/repeat navigation. This process never reads game memory,
// installs a game resource, or equates successful SendInput with arrival.
// It operates on a visible, foreground game window and saved visual checkpoints.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class LocalNavigation : Form
{
    internal sealed class Sample { public int ms; public int mask; public int dx; public int dy; }
    internal sealed class Segment { public List<Sample> samples = new List<Sample>(); public string image; }
    internal sealed class Route
    {
        public int schema = 1;
        public int width;
        public int height;
        public int down;
        public string start;
        public List<Segment> segments = new List<Segment>();
    }
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024, RecursionLimit = 30 };
    private const int ImageWidth = 96, ImageHeight = 54, MaximumSegmentMs = 5000, MaximumRouteMs = 90000;
    private const long InputMarker = 0x534E4156;
    private readonly IntPtr target;
    private readonly int parent;
    private readonly int targetPid;
    private readonly string cancelFile, path, mode;
    private readonly int down;
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    private readonly Label label = new Label();
    private readonly List<Sample> pending = new List<Sample>();
    private Route route;
    private long lastTick, idleSince, startedAt;
    private int rawX, rawY, segmentMs, heldMask;
    private bool recording, finishing, injecting, playing, manualOverride;
    private bool lastF6, lastF7;
    private HookCallback keyboardCallback, mouseCallback;
    private IntPtr keyboardHook, mouseHook;
    internal string Result = "ERROR NAVIGATION_NOT_COMPLETED";

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 2) return 64;
        string result = "ERROR INVALID_ARGUMENT";
        try
        {
            if (args[0] == "self-test") result = SelfTest();
            else if (args.Length == 8 && (args[0] == "record" || args[0] == "play"))
            {
                long hwnd;
                int pid, direction, owner;
                if (!Int64.TryParse(args[2], out hwnd) || hwnd <= 0 || !Int32.TryParse(args[3], out owner)
                    || !Int32.TryParse(args[6], out direction) || Math.Abs(direction) != 1
                    || !Int32.TryParse(args[7], out pid) || owner <= 0 || pid <= 0)
                    throw new InvalidOperationException("INVALID_IDENTITY");
                Application.EnableVisualStyles();
                using (var form = new LocalNavigation(args[0], new IntPtr(hwnd), owner, args[4], args[5], direction, pid))
                {
                    Application.Run(form);
                    result = form.Result;
                }
            }
        }
        catch (Exception error) { result = "ERROR " + SafeError(error); }
        try { AtomicWrite(args[1], result + "\n"); } catch { return 74; }
        return result.StartsWith("ERROR", StringComparison.Ordinal) ? 1 : 0;
    }

    private LocalNavigation(string operation, IntPtr window, int parentPid, string cancellation, string routePath, int direction, int process)
    {
        mode = operation; target = window; parent = parentPid; cancelFile = cancellation; path = routePath; down = direction; targetPid = process;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false; TopMost = true; BackColor = Color.FromArgb(25, 29, 38); Opacity = 0.9;
        Width = 650; Height = 55;
        label.Dock = DockStyle.Fill; label.ForeColor = Color.White; label.TextAlign = ContentAlignment.MiddleCenter;
        label.Font = new Font("Yu Gothic UI", 10); Controls.Add(label);
        timer.Interval = 16;
        timer.Tick += Tick;
        Shown += delegate { BeginInvoke(new Action(BeginOperation)); };
        FormClosed += delegate { timer.Stop(); ReleaseKeys(); RemoveHooks(); };
    }
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams
    {
        get { var p = base.CreateParams; p.ExStyle |= 0x08000000 | 0x00000020 | 0x00000080; return p; }
    }
    private void BeginOperation()
    {
        try
        {
            Guard();
            RECT r; GetClientRect(target, out r); POINT p = new POINT(); ClientToScreen(target, ref p);
            Location = new Point(p.x + Math.Max(0, (r.right - Width) / 2), p.y + Math.Max(0, r.bottom - 70));
            if (mode == "record")
            {
                label.Text = "3秒後に記録開始。W/A/S/D・マウスだけで徒歩移動。立ち止まると照合点を保存。終点でF7、取消F9";
                Wait(3000); NormalisePitch();
                byte[] start = CaptureScenery(); RequireTexture(start);
                route = new Route { width = r.right, height = r.bottom, down = down, start = Convert.ToBase64String(start) };
                RAWINPUTDEVICE[] devices = { new RAWINPUTDEVICE { page = 1, usage = 2, flags = 0x100, window = Handle } };
                if (!RegisterRawInputDevices(devices, 1, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE))))
                    throw new InvalidOperationException("RAW_INPUT_UNAVAILABLE");
                rawX = rawY = 0; lastTick = clock.ElapsedMilliseconds; startedAt = lastTick; idleSince = 0;
                recording = true; timer.Start();
            }
            else
            {
                var file = new FileInfo(path);
                if (!file.Exists || file.Length > 4 * 1024 * 1024) throw new InvalidOperationException("ROUTE_FILE_INVALID");
                route = Json.Deserialize<Route>(File.ReadAllText(path, Encoding.UTF8));
                ValidateRoute(route);
                if (route.width != r.right || route.height != r.bottom || route.down != down)
                    throw new InvalidOperationException("DISPLAY_CHANGED_RERECORD_ROUTE");
                playing = true; InstallHooks();
                Play();
                Result = "ROUTE_REPLAYED"; // The parent MUST independently verify cargo ID / work target.
                Close();
            }
        }
        catch (Exception error) { Fail(error); }
    }
    private void Tick(object sender, EventArgs e)
    {
        if (!recording || finishing) return;
        try
        {
            Guard();
            long now = clock.ElapsedMilliseconds;
            int elapsed = (int)(now - lastTick); lastTick = now;
            if (elapsed > 150) throw new InvalidOperationException("RECORDING_LAG_RERECORD");
            if (now - startedAt > 180000) throw new InvalidOperationException("RECORDING_TIMEOUT");
            if (Key(0x10) || Key(0x11) || Key(0x20) || Key(0x45) || Key(0x01) || Key(0x02))
                throw new InvalidOperationException("RECORD_WALK_ONLY_NO_SPRINT_OR_INTERACTION");
            int mask = ReadPhysicalMask(); int x = rawX, y = rawY; rawX = rawY = 0;
            bool f6 = Key(0x75), f7 = Key(0x76);
            bool end = f7 && !lastF7, checkpoint = f6 && !lastF6; lastF6 = f6; lastF7 = f7;
            if (elapsed > 0 && (pending.Count > 0 || mask != 0 || x != 0 || y != 0))
            {
                pending.Add(new Sample { ms = elapsed, mask = mask, dx = x, dy = y }); segmentMs += elapsed;
            }
            if (mask != 0 || x != 0 || y != 0) idleSince = 0;
            else if (idleSince == 0) idleSince = now;
            if (segmentMs > MaximumSegmentMs + 1000)
                throw new InvalidOperationException("CHECKPOINT_REQUIRED_STOP_EVERY_FOUR_SECONDS");
            if (mask == 0 && pending.Count > 0 && ((idleSince != 0 && now - idleSince >= 650) || checkpoint || end))
                SaveCheckpoint();
            label.Text = "記録中：区間 " + (route.segments.Count + 1) + " / 40。4秒以内ごとに停止。終点でF7、取消F9";
            if (end)
            {
                if (mask != 0) throw new InvalidOperationException("STOP_WALKING_BEFORE_FINISH");
                recording = false; timer.Stop(); ValidateRoute(route);
                AtomicWrite(path, Json.Serialize(route));
                Result = "RECORDED"; Close();
            }
        }
        catch (Exception error) { Fail(error); }
    }
    private void SaveCheckpoint()
    {
        finishing = true;
        try
        {
            while (pending.Count > 0)
            {
                Sample tail = pending[pending.Count - 1];
                if (tail.mask != 0 || tail.dx != 0 || tail.dy != 0) break;
                segmentMs -= tail.ms; pending.RemoveAt(pending.Count - 1);
            }
            if (pending.Count == 0) return;
            if (segmentMs > MaximumSegmentMs) throw new InvalidOperationException("CHECKPOINT_SEGMENT_TOO_LONG");
            NormalisePitch(); byte[] image = CaptureScenery(); RequireTexture(image);
            var segment = new Segment { samples = new List<Sample>(pending), image = Convert.ToBase64String(image) };
            route.segments.Add(segment);
            if (route.segments.Count > 40) throw new InvalidOperationException("TOO_MANY_CHECKPOINTS");
            pending.Clear(); segmentMs = 0; rawX = rawY = 0; idleSince = 0; lastTick = clock.ElapsedMilliseconds;
        }
        finally { finishing = false; }
    }
    protected override void WndProc(ref Message message)
    {
        if (message.Msg == 0x00FF && recording && !finishing && !injecting && GetForegroundWindow() == target)
        {
            uint size = 0; uint header = (uint)(IntPtr.Size == 8 ? 24 : 16);
            GetRawInputData(message.LParam, 0x10000003, IntPtr.Zero, ref size, header);
            if (size >= header + 24 && size < 4096)
            {
                IntPtr data = Marshal.AllocHGlobal((int)size);
                try
                {
                    if (GetRawInputData(message.LParam, 0x10000003, data, ref size, header) == size && Marshal.ReadInt32(data) == 0)
                    {
                        int offset = (int)header;
                        if ((Marshal.ReadInt16(data, offset) & 1) != 0) manualOverride = true;
                        else { rawX += Marshal.ReadInt32(data, offset + 12); rawY += Marshal.ReadInt32(data, offset + 16); }
                    }
                }
                finally { Marshal.FreeHGlobal(data); }
            }
        }
        base.WndProc(ref message);
    }
    // Shared orchestration permits tests to inject observations and cancellation
    // without pretending that a synthetic adapter exercised the real game.
    internal static void ExecutePlan(Route value, Action<byte[]> align,
        Action<Segment, int> replay, Action release, Action guard, Action<int, int> progress)
    {
        ValidateRoute(value); guard(); align(Convert.FromBase64String(value.start));
        for (int n = 0; n < value.segments.Count; n++)
        {
            guard();
            try { replay(value.segments[n], n); }
            finally { release(); }
            guard(); align(Convert.FromBase64String(value.segments[n].image));
            progress(n + 1, value.segments.Count);
        }
    }
    private void Play()
    {
        ExecutePlan(route, Align, ReplaySegment, ReleaseKeys, Guard,
            delegate(int completed, int total) { File.WriteAllText(path + ".progress", completed + "/" + total, Encoding.UTF8); });
    }
    private void ReplaySegment(Segment segment, int number)
    {
        label.Text = "徒歩ルート " + (number + 1) + "/" + route.segments.Count + "：実画面照合つき。F9／手動操作／他アプリ切替で停止";
        long origin = clock.ElapsedMilliseconds; int timeline = 0;
        foreach (Sample step in segment.samples)
        {
            Guard();
            if (clock.ElapsedMilliseconds - origin - timeline > 180)
                throw new InvalidOperationException("PLAYBACK_LAG_STOPPED");
            SetKeys(step.mask);
            if (step.dx != 0 || step.dy != 0) MoveCamera(step.dx, step.dy);
            timeline += step.ms;
            while (clock.ElapsedMilliseconds < origin + timeline) Wait(5);
        }
        ReleaseKeys(); Wait(250);
        // The caller may align the view, but must never replay this walking
        // segment after an uncertain endpoint or a focus interruption.
    }
    private void Align(byte[] reference)
    {
        ReleaseKeys(); NormalisePitch();
        byte[] live = CaptureScenery();
        if (Matches(reference, live)) { Wait(90); if (Matches(reference, CaptureScenery())) return; }
        label.Text = "記録した景色へ視点を合わせています。照合できない場合は歩かず停止します";
        long deadline = clock.ElapsedMilliseconds + 16000;
        int totalX = 0, bestX = 0;
        double best = Similarity(reference, live);
        // Bounded yaw search; pitch is normalised identically during teach/repeat.
        for (int n = 0; n < 60 && clock.ElapsedMilliseconds < deadline; n++)
        {
            MoveCamera(80, 0); totalX += 80; Wait(90); live = CaptureScenery();
            double score = Similarity(reference, live);
            if (score > best) { best = score; bestX = totalX; }
            if (Matches(reference, live)) { Wait(90); if (Matches(reference, CaptureScenery())) return; }
        }
        MoveCamera(bestX - totalX, 0); Wait(140);
        for (int step = 40; step >= 5 && clock.ElapsedMilliseconds < deadline; step /= 2)
        {
            double centre = Similarity(reference, CaptureScenery());
            MoveCamera(step, 0); Wait(90); double right = Similarity(reference, CaptureScenery());
            MoveCamera(-2 * step, 0); Wait(90); double left = Similarity(reference, CaptureScenery());
            if (right > centre && right > left) MoveCamera(2 * step, 0);
            else if (centre >= left) MoveCamera(step, 0);
            Wait(90);
            if (Matches(reference, CaptureScenery())) { Wait(90); if (Matches(reference, CaptureScenery())) return; }
        }
        throw new InvalidOperationException("VISUAL_CHECKPOINT_MISMATCH");
    }
    private void NormalisePitch()
    {
        injecting = true;
        try
        {
            for (int n = 0; n < 6; n++) { MoveCamera(0, down * 350); Wait(35); }
            Wait(150); MoveCamera(0, -down * 320); Wait(180);
        }
        finally { injecting = false; rawX = rawY = 0; }
    }
    private byte[] CaptureScenery()
    {
        Guard(); RECT r;
        if (!GetClientRect(target, out r) || r.right < 640 || r.bottom < 360)
            throw new InvalidOperationException("GAME_WINDOW_TOO_SMALL");
        if (route != null && (route.width != r.right || route.height != r.bottom))
            throw new InvalidOperationException("DISPLAY_CHANGED_RERECORD_ROUTE");
        POINT p = new POINT(); ClientToScreen(target, ref p);
        using (var full = new Bitmap(r.right, r.bottom, PixelFormat.Format24bppRgb))
        using (var small = new Bitmap(ImageWidth, ImageHeight, PixelFormat.Format24bppRgb))
        {
            using (Graphics g = Graphics.FromImage(full)) g.CopyFromScreen(p.x, p.y, 0, 0, full.Size, CopyPixelOperation.SourceCopy);
            using (Graphics g = Graphics.FromImage(small)) { g.InterpolationMode = InterpolationMode.HighQualityBilinear; g.DrawImage(full, 0, 0, ImageWidth, ImageHeight); }
            byte[] values = new byte[ImageWidth * ImageHeight];
            for (int y = 0; y < ImageHeight; y++) for (int x = 0; x < ImageWidth; x++)
            {
                Color c = small.GetPixel(x, y); values[y * ImageWidth + x] = (byte)((c.R * 77 + c.G * 150 + c.B * 29) >> 8);
            }
            return values;
        }
    }
    // Use separated scenery tiles. Exclude the minimap, lower HUD, and central avatar.
    private static readonly Rectangle[] Tiles = { new Rectangle(8, 12, 22, 16), new Rectangle(37, 9, 22, 14), new Rectangle(66, 12, 22, 16), new Rectangle(8, 29, 22, 13), new Rectangle(66, 29, 22, 13) };
    internal static double Similarity(byte[] a, byte[] b)
    {
        if (a == null || b == null || a.Length != ImageWidth * ImageHeight || b.Length != a.Length) return -1;
        var scores = new List<double>();
        foreach (Rectangle tile in Tiles)
        {
            double sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; int count = tile.Width * tile.Height;
            for (int y = tile.Top; y < tile.Bottom; y++) for (int x = tile.Left; x < tile.Right; x++)
            {
                int av = a[y * ImageWidth + x], bv = b[y * ImageWidth + x];
                sa += av; sb += bv; saa += av * av; sbb += bv * bv; sab += av * bv;
            }
            double va = saa - sa * sa / count, vb = sbb - sb * sb / count;
            scores.Add(va / count < 36 || vb / count < 36 ? -1 : (sab - sa * sb / count) / Math.Sqrt(va * vb));
        }
        scores.Sort();
        // Four of five tiles must agree; one can contain another player / an effect.
        return Math.Min(scores[1], (scores[1] + scores[2] + scores[3] + scores[4]) / 4);
    }
    internal static bool Matches(byte[] a, byte[] b) { return Similarity(a, b) >= 0.88; }
    private static void RequireTexture(byte[] data)
    {
        if (!Matches(data, data)) throw new InvalidOperationException("SCENERY_NOT_DISTINCT_ENOUGH");
    }
    internal static void ValidateRoute(Route value)
    {
        if (value == null || value.schema != 1 || value.width < 640 || value.width > 16384 || value.height < 360 || value.height > 8640
            || Math.Abs(value.down) != 1 || value.segments == null || value.segments.Count < 1 || value.segments.Count > 40)
            throw new InvalidOperationException("ROUTE_SCHEMA_INVALID");
        RequireTexture(Convert.FromBase64String(value.start));
        int total = 0, walking = 0, sampleCount = 0;
        foreach (Segment segment in value.segments)
        {
            if (segment == null || segment.samples == null || segment.samples.Count == 0) throw new InvalidOperationException("EMPTY_SEGMENT");
            RequireTexture(Convert.FromBase64String(segment.image));
            int duration = 0;
            foreach (Sample sample in segment.samples)
            {
                if (sample == null || sample.ms < 1 || sample.ms > 150 || sample.mask < 0 || sample.mask > 15
                    || Math.Abs((long)sample.dx) > 2000 || Math.Abs((long)sample.dy) > 2000)
                    throw new InvalidOperationException("INVALID_SAMPLE");
                duration += sample.ms; sampleCount++;
                if (sample.mask != 0) walking += sample.ms;
            }
            if (duration > MaximumSegmentMs) throw new InvalidOperationException("SEGMENT_TOO_LONG");
            total += duration;
        }
        if (total > MaximumRouteMs || sampleCount > 12000 || walking < 100) throw new InvalidOperationException("ROUTE_BUDGET_OR_NO_WALK");
    }
    private void Guard()
    {
        if (File.Exists(cancelFile)) throw new InvalidOperationException("CANCELLED");
        if (manualOverride || Key(0x78)) throw new InvalidOperationException("MANUAL_OVERRIDE");
        if (injecting && mode == "record" && ReadPhysicalMask() != 0)
            throw new InvalidOperationException("RECORDING_MOVED_DURING_CHECKPOINT");
        if (!IsWindow(target) || GetForegroundWindow() != target || IsIconic(target)) throw new InvalidOperationException("GAME_NOT_FOREGROUND");
        uint pid; GetWindowThreadProcessId(target, out pid);
        if (pid != targetPid) throw new InvalidOperationException("GAME_PROCESS_CHANGED");
        try { using (var p = Process.GetProcessById(parent)) if (p.HasExited) throw new InvalidOperationException(); }
        catch { throw new InvalidOperationException("OWNER_EXITED"); }
        if (clock.ElapsedMilliseconds > 360000) throw new InvalidOperationException("NAVIGATION_DEADLINE");
    }
    private void Wait(int milliseconds)
    {
        long end = clock.ElapsedMilliseconds + milliseconds;
        do { Guard(); Application.DoEvents(); Thread.Sleep(5); } while (clock.ElapsedMilliseconds < end);
    }
    private static bool Key(int vk) { return (GetAsyncKeyState(vk) & 0x8000) != 0; }
    private static int ReadPhysicalMask() { return (Key(0x57) ? 1 : 0) | (Key(0x53) ? 2 : 0) | (Key(0x41) ? 4 : 0) | (Key(0x44) ? 8 : 0); }
    private void SetKeys(int mask)
    {
        Guard(); int[] keys = { 0x57, 0x53, 0x41, 0x44 };
        for (int n = 0; n < 4; n++) if (((heldMask ^ mask) & (1 << n)) != 0)
        {
            int bit = 1 << n;
            // Track ownership before submission so finally releases even after a partial SendInput failure.
            bool downKey = (mask & bit) != 0;
            if (downKey) heldMask |= bit;
            KeyPacket(keys[n], downKey);
            if (!downKey) heldMask &= ~bit;
        }
    }
    private void ReleaseKeys()
    {
        int mask = heldMask; heldMask = 0; int[] keys = { 0x57, 0x53, 0x41, 0x44 };
        for (int n = 0; n < 4; n++) if ((mask & (1 << n)) != 0) { try { KeyPacket(keys[n], false); } catch { } }
    }
    private static void KeyPacket(int vk, bool downKey)
    {
        INPUT input = new INPUT { type = 1 };
        input.data.keyboard = new KEYBDINPUT { scan = (ushort)MapVirtualKey((uint)vk, 0), flags = 8u | (downKey ? 0u : 2u), extra = new IntPtr(InputMarker) };
        if (SendInput(1, new[] { input }, Marshal.SizeOf(typeof(INPUT))) != 1) throw new InvalidOperationException("INPUT_REJECTED");
    }
    private void MoveCamera(int x, int y)
    {
        Guard(); if (x == 0 && y == 0) return;
        INPUT input = new INPUT { type = 0 };
        input.data.mouse = new MOUSEINPUT { x = x, y = y, flags = 1, extra = new IntPtr(InputMarker) };
        if (SendInput(1, new[] { input }, Marshal.SizeOf(typeof(INPUT))) != 1) throw new InvalidOperationException("INPUT_REJECTED");
    }
    private void InstallHooks()
    {
        keyboardCallback = delegate(int code, IntPtr w, IntPtr l)
        {
            if (code >= 0 && playing && GetForegroundWindow() == target)
            {
                uint flags = (uint)Marshal.ReadInt32(l, 8);
                int key = Marshal.ReadInt32(l);
                if ((flags & 0x10) == 0 && (key == 0x57 || key == 0x41 || key == 0x53 || key == 0x44 || key == 0x20 || key == 0x1B)) manualOverride = true;
            }
            return CallNextHookEx(IntPtr.Zero, code, w, l);
        };
        mouseCallback = delegate(int code, IntPtr w, IntPtr l)
        {
            if (code >= 0 && playing && GetForegroundWindow() == target && ((uint)Marshal.ReadInt32(l, 12) & 1) == 0) manualOverride = true;
            return CallNextHookEx(IntPtr.Zero, code, w, l);
        };
        keyboardHook = SetWindowsHookEx(13, keyboardCallback, GetModuleHandle(null), 0);
        mouseHook = SetWindowsHookEx(14, mouseCallback, GetModuleHandle(null), 0);
        if (keyboardHook == IntPtr.Zero || mouseHook == IntPtr.Zero) throw new InvalidOperationException("MANUAL_STOP_HOOK_UNAVAILABLE");
    }
    private void RemoveHooks() { if (keyboardHook != IntPtr.Zero) UnhookWindowsHookEx(keyboardHook); if (mouseHook != IntPtr.Zero) UnhookWindowsHookEx(mouseHook); }
    private void Fail(Exception error) { recording = false; timer.Stop(); ReleaseKeys(); Result = "ERROR " + SafeError(error); Close(); }
    private static string SafeError(Exception error)
    {
        string value = error is InvalidOperationException ? error.Message : error.GetType().Name;
        var text = new StringBuilder(); foreach (char c in value) if (Char.IsLetterOrDigit(c) || c == '_') text.Append(c);
        return text.Length == 0 ? "UNKNOWN" : text.ToString();
    }
    private static void AtomicWrite(string output, string value)
    {
        string full = Path.GetFullPath(output); Directory.CreateDirectory(Path.GetDirectoryName(full));
        string temp = full + "." + Guid.NewGuid().ToString("N") + ".tmp";
        using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        { byte[] data = new UTF8Encoding(false).GetBytes(value); stream.Write(data, 0, data.Length); stream.Flush(true); }
        if (File.Exists(full)) File.Replace(temp, full, null); else File.Move(temp, full);
    }
    private static string SelfTest()
    {
        byte[] a = new byte[ImageWidth * ImageHeight], b = new byte[a.Length], other = new byte[a.Length];
        var random = new Random(177);
        for (int n = 0; n < a.Length; n++) { a[n] = (byte)random.Next(20, 180); b[n] = (byte)(a[n] + 30); other[n] = (byte)random.Next(20, 180); }
        if (!Matches(a, a) || !Matches(a, b) || Matches(a, other) || Matches(new byte[a.Length], new byte[a.Length])) throw new Exception("VISION_TEST");
        var route = new Route { width = 1280, height = 720, down = 1, start = Convert.ToBase64String(a) };
        route.segments.Add(new Segment { image = route.start, samples = new List<Sample> { new Sample { ms = 100, mask = 1 } } });
        ValidateRoute(route);
        int rejected = 0;
        foreach (int bad in new[] { -1, 0, 151, Int32.MaxValue })
        { route.segments[0].samples[0].ms = bad; try { ValidateRoute(route); } catch { rejected++; } }
        route.segments[0].samples[0].ms = 100; route.segments[0].samples[0].mask = 16;
        try { ValidateRoute(route); } catch { rejected++; }
        route.segments[0].samples[0].mask = 0;
        try { ValidateRoute(route); } catch { rejected++; }
        if (rejected != 6 || Marshal.SizeOf(typeof(INPUT)) != (IntPtr.Size == 8 ? 40 : 28)) throw new Exception("CONTRACT_TEST");
        route.segments[0].samples[0].mask = 1;
        route.segments.Add(new Segment { image = route.start, samples = new List<Sample> { new Sample { ms = 100, mask = 2 } } });
        int aligned = 0, walked = 0, released = 0, observed = 0;
        ExecutePlan(route, delegate(byte[] image) { aligned++; }, delegate(Segment seg, int n) { walked++; },
            delegate { released++; }, delegate { }, delegate(int n, int count) { observed++; });
        if (aligned != 3 || walked != 2 || released != 2 || observed != 2) throw new Exception("SEQUENCE_TEST");
        aligned = walked = released = observed = 0;
        try
        {
            ExecutePlan(route, delegate(byte[] image) { if (++aligned == 2) throw new InvalidOperationException("VISUAL_CHECKPOINT_MISMATCH"); },
                delegate(Segment seg, int n) { walked++; }, delegate { released++; }, delegate { }, delegate(int n, int count) { observed++; });
            throw new Exception("FAILURE_NOT_PROPAGATED");
        }
        catch (InvalidOperationException) { }
        if (walked != 1 || released != 1 || observed != 0) throw new Exception("NO_REPLAY_AFTER_FAILED_CHECKPOINT");
        walked = 0;
        try
        {
            ExecutePlan(route, delegate(byte[] image) { }, delegate(Segment seg, int n) { walked++; }, delegate { },
                delegate { throw new InvalidOperationException("CANCELLED"); }, delegate(int n, int count) { });
            throw new Exception("CANCEL_NOT_PROPAGATED");
        }
        catch (InvalidOperationException) { }
        if (walked != 0) throw new Exception("INPUT_AFTER_CANCEL");
        return "SELFTEST OK";
    }

    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct RAWINPUTDEVICE { public ushort page, usage; public uint flags; public IntPtr window; }
    [StructLayout(LayoutKind.Sequential)] private struct MOUSEINPUT { public int x, y; public uint data, flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] private struct KEYBDINPUT { public ushort key, scan; public uint flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] private struct INPUTDATA { [FieldOffset(0)] public MOUSEINPUT mouse; [FieldOffset(0)] public KEYBDINPUT keyboard; }
    [StructLayout(LayoutKind.Sequential)] private struct INPUT { public uint type; public INPUTDATA data; }
    private delegate IntPtr HookCallback(int code, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern uint MapVirtualKey(uint code, uint type);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] devices, uint count, uint size);
    [DllImport("user32.dll")] private static extern uint GetRawInputData(IntPtr handle, uint command, IntPtr data, ref uint size, uint headerSize);
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int id, HookCallback callback, IntPtr module, uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr h);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string name);
}
