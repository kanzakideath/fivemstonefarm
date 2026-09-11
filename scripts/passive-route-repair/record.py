from pathlib import Path
R = Path(__file__).resolve().parents[2]
p = R / 'src/local-navigation/LocalNavigation.cs'
s = p.read_text(encoding='utf-8-sig')
def replace(old, new):
    global s
    if s.count(old) != 1: raise RuntimeError('Recorder boundary: ' + old[:90])
    s = s.replace(old, new)
replace('public int schema = 1;', 'public int schema = 2;\n        public string cameraPolicy = "recorded-view";\n        public string recordedAtUtc;')
replace('private long checkpointSavedAt;', 'private long checkpointSavedAt, lastOverlayAt;\n    private bool awaitingStart;\n    private int previousPhysicalMask;')
replace('    private void UpdateOverlay()\n    {', '    private void UpdateOverlay()\n    {\n        if (lastOverlayAt > 0 && clock.ElapsedMilliseconds - lastOverlayAt < 100) return;\n        lastOverlayAt = clock.ElapsedMilliseconds;')
replace('(mode == "record" ? "記録中 / " : "自動徒歩 / ")', '(mode == "record" ? (awaitingStart ? "準備 / " : "記録中 / ") : "自動徒歩 / ")')
replace('keyGuide.Text = "W A S D：徒歩   F6：照合点   F7：停止して片道終了   F9：中止";', 'keyGuide.Text = awaitingStart ? "F6：今の視点で記録開始   F9：中止（視点は自動で動かしません）"\n                : "W A S D：徒歩   F6：照合点   F7：停止して片道終了   F9：中止";')
a = s.index('                for (int seconds = 3; seconds >= 1; seconds--)')
b = s.index('                RAWINPUTDEVICE[] devices', a)
s = s[:a] + '''                // Recording is passive. No camera or keyboard injection is permitted.
                awaitingStart = true;
                byte[] start = WaitForStartFrame();
                awaitingStart = false;
                route = new Route { width = r.right, height = r.bottom, down = down,
                    recordedAtUtc = DateTime.UtcNow.ToString("o"), start = Convert.ToBase64String(start) };
''' + s[b:]
replace('                recording = true; timer.Start();', '                previousPhysicalMask = 0; lastF6 = Key(0x75); lastF7 = Key(0x76);\n                recording = true; timer.Start();')
replace('            if (elapsed > 150) throw new InvalidOperationException("RECORDING_LAG_RERECORD");', '''            int currentMask = ReadPhysicalMask();
            // Idle delays contain no movement to lose. Motion delays remain unsafe.
            if (elapsed > 150 && (previousPhysicalMask != 0 || currentMask != 0 || rawX != 0 || rawY != 0))
                throw new InvalidOperationException("RECORDING_LAG_RERECORD");
            elapsed = Math.Max(1, Math.Min(150, elapsed));''')
replace('int mask = ReadPhysicalMask(); int x = rawX, y = rawY; rawX = rawY = 0;', 'int mask = currentMask; int heldDuringInterval = previousPhysicalMask; previousPhysicalMask = mask;\n            int x = rawX, y = rawY; rawX = rawY = 0;')
replace('pending.Add(new Sample { ms = elapsed, mask = mask, dx = x, dy = y });', 'pending.Add(RecordedInterval(elapsed, heldDuringInterval, x, y));')
replace('NormalisePitch(); byte[] image = CaptureScenery(); RequireTexture(image);', 'byte[] image = CaptureScenery(); RequireTexture(image);\n            if (ReadPhysicalMask() != 0) throw new InvalidOperationException("RECORDING_MOVED_DURING_CHECKPOINT");')
replace('pending.Clear(); segmentMs = 0; rawX = rawY = 0; idleSince = 0; lastTick = clock.ElapsedMilliseconds;', 'pending.Clear(); segmentMs = 0; rawX = rawY = 0; previousPhysicalMask = 0; idleSince = 0; lastTick = clock.ElapsedMilliseconds;')
replace('        ReleaseKeys(); NormalisePitch();', '        ReleaseKeys(); // Preserve the recorded pitch; never force it to a limit.')
a = s.index('    private void NormalisePitch()')
b = s.index('    private byte[] CaptureScenery()', a)
s = s[:a] + r'''    private byte[] WaitForStartFrame()
    {
        bool pressed = Key(0x75);
        label.Text = "歩く方向と周囲の目印が見える視点にしてください。\n準備できたら立ち止まってF6。下向き補正・再起動は行いません。";
        UpdateOverlay();
        while (true)
        {
            Wait(25);
            bool current = Key(0x75);
            if (current && !pressed)
            {
                if (ReadPhysicalMask() != 0) label.Text = "W/A/S/Dを離してからF6を押してください。視点はそのまま保存します。";
                else
                {
                    byte[] frame = CaptureScenery();
                    if (Matches(frame, frame)) return frame;
                    label.Text = "この景色は目印が不足しています。\n手動で岩や建物が見える視点にして、もう一度F6。F9で中止。";
                }
            }
            pressed = current; UpdateOverlay();
        }
    }
    internal static Sample RecordedInterval(int elapsed, int previousMask, int dx, int dy)
    {
        return new Sample { ms = elapsed, mask = previousMask, dx = dx, dy = dy };
    }
''' .replace('\\n', '\\n') + s[b:]
replace('// Bounded yaw search; pitch is normalised identically during teach/repeat.', '// Bounded view search only. Recording preserves the user-chosen pitch.')
# Small pitch refinement after the yaw scan; never a forced full-down pulse.
needle = '        throw new InvalidOperationException("VISUAL_CHECKPOINT_MISMATCH");\n    }\n    private byte[] WaitForStartFrame()'
replace(needle, '''        int[] offsets = { -40, 40, -80, 80, -120, 120, 0 };
        int currentY = 0;
        foreach (int nextY in offsets)
        {
            if (clock.ElapsedMilliseconds >= deadline) break;
            MoveCamera(0, nextY - currentY); currentY = nextY; Wait(110);
            if (Matches(reference, CaptureScenery())) { Wait(90); if (Matches(reference, CaptureScenery())) return; }
        }
        MoveCamera(0, -currentY);
        throw new InvalidOperationException("VISUAL_CHECKPOINT_MISMATCH");
    }
    private byte[] WaitForStartFrame()''')
replace('if (value == null || value.schema != 1 || value.width < 640', 'if (value != null && (value.schema != 2 || value.cameraPolicy != "recorded-view"))\n            throw new InvalidOperationException("LEGACY_ROUTE_RERECORD_NO_PITCH");\n        if (value == null || value.width < 640')
replace('private bool recording, finishing, injecting, playing, manualOverride;', 'private bool recording, finishing, playing, manualOverride;')
replace('&& recording && !finishing && !injecting && GetForegroundWindow()', '&& recording && !finishing && GetForegroundWindow()')
replace('        if (injecting && mode == "record" && ReadPhysicalMask() != 0)\n            throw new InvalidOperationException("RECORDING_MOVED_DURING_CHECKPOINT");\n', '')
replace('        Guard(); int[] keys = { 0x57, 0x53, 0x41, 0x44 };', '        RequirePlayback(mode); Guard();\n        int[] keys = { 0x57, 0x53, 0x41, 0x44 };')
replace('        Guard(); if (x == 0 && y == 0) return;', '        RequirePlayback(mode); Guard(); if (x == 0 && y == 0) return;')
replace('    private void MoveCamera(int x, int y)\n', '''    internal static void RequirePlayback(string operation)
    {
        if (operation != "play") throw new InvalidOperationException("RECORDING_MUST_NOT_INJECT_INPUT");
    }
    private void MoveCamera(int x, int y)
''')
replace('schema = 1, operation = mode, result = result, events = diagnosticEvents,', 'schema = 2, operation = mode, result = result, events = diagnosticEvents,\n                cameraPolicy = "recorded-view", recordingInputInjectionAllowed = false,\n                clientWidth = route == null ? 0 : route.width, clientHeight = route == null ? 0 : route.height,')
replace('        return "SELFTEST OK";', '''        var press = RecordedInterval(16, 0, 4, -3);
        var held = RecordedInterval(16, 1, 0, 0);
        if (press.mask != 0 || held.mask != 1 || press.dx != 4 || press.dy != -3)
            throw new Exception("RECORDING_INTERVAL_ORDER_TEST");
        route.schema = 1;
        bool rejectedLegacy = false;
        try { ValidateRoute(route); } catch (InvalidOperationException error) { rejectedLegacy = error.Message == "LEGACY_ROUTE_RERECORD_NO_PITCH"; }
        if (!rejectedLegacy) throw new Exception("LEGACY_ROUTE_ACCEPTED");
        route.schema = 2; ValidateRoute(route);
        int blocked = 0;
        foreach (string operation in new[] { "record", "preview", "", null })
        { try { RequirePlayback(operation); } catch (InvalidOperationException) { blocked++; } }
        if (blocked != 4) throw new Exception("RECORDING_INJECTION_POLICY_TEST");
        RequirePlayback("play");
        return "SELFTEST OK";''')
assert 'NormalisePitch' not in s
p.write_text(s, encoding='utf-8', newline='\n')
print('Natural-view recording source applied; compiler validation required.')
