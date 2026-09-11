from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
path = ROOT / 'src/local-navigation/LocalNavigation.cs'
t = path.read_text(encoding='utf-8-sig')
def once(before, after):
    global t
    if t.count(before) != 1: raise RuntimeError('Unexpected helper boundary: ' + before[:100])
    t = t.replace(before, after)
once('    private readonly Label label = new Label();', '''    private readonly Label label = new Label();
    private readonly Label heading = new Label();
    private readonly Label progressLabel = new Label();
    private readonly Label keyGuide = new Label();
    private readonly Panel progressTrack = new Panel();
    private readonly Panel progressFill = new Panel();
    private long checkpointSavedAt;
    private int displayedSegment;
    private readonly bool overlayPreview;''')
once('            if (args[0] == "self-test") result = SelfTest();', '''            if (args[0] == "self-test") result = SelfTest();
            else if (args[0] == "overlay-preview" && args.Length == 3)
            {
                Application.EnableVisualStyles();
                using (var form = new LocalNavigation("preview", IntPtr.Zero, 0, "", args[2], 1, 0))
                {
                    Application.Run(form);
                    result = form.Result;
                }
            }''')
once('''        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false; TopMost = true; BackColor = Color.FromArgb(25, 29, 38); Opacity = 0.9;
        Width = 650; Height = 55;
        label.Dock = DockStyle.Fill; label.ForeColor = Color.White; label.TextAlign = ContentAlignment.MiddleCenter;
        label.Font = new Font("Yu Gothic UI", 10); Controls.Add(label);''', '''        overlayPreview = operation == "preview";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false; TopMost = true; BackColor = Color.FromArgb(20, 40, 63);
        AutoScaleMode = AutoScaleMode.None;
        ClientSize = new Size(640, 210);
        heading.ForeColor = Color.FromArgb(156, 216, 255);
        heading.Font = new Font("Yu Gothic UI", 12, FontStyle.Bold);
        heading.AutoEllipsis = true;
        label.ForeColor = Color.White;
        label.Font = new Font("Yu Gothic UI", 11);
        progressLabel.ForeColor = Color.FromArgb(206, 222, 239);
        progressLabel.Font = new Font("Yu Gothic UI", 10);
        keyGuide.ForeColor = Color.White;
        keyGuide.Font = new Font("Yu Gothic UI", 10, FontStyle.Bold);
        progressTrack.BackColor = Color.FromArgb(52, 75, 99);
        progressFill.BackColor = Color.FromArgb(82, 185, 222);
        progressTrack.Controls.Add(progressFill);
        Controls.Add(heading); Controls.Add(label); Controls.Add(progressLabel);
        Controls.Add(progressTrack); Controls.Add(keyGuide);
        LayoutOverlay();''')
methods = '''    private bool IsReturnLeg() { return Path.GetFileName(path).StartsWith("return", StringComparison.OrdinalIgnoreCase); }
    private void LayoutOverlay()
    {
        int inner = ClientSize.Width - 36;
        heading.SetBounds(18, 12, inner, 30);
        label.SetBounds(18, 48, inner, 60);
        progressLabel.SetBounds(18, 115, inner, 24);
        progressTrack.SetBounds(18, 144, inner, 7);
        keyGuide.SetBounds(18, 164, inner, 40);
    }
    private void UpdateOverlay()
    {
        string directory = Path.GetFileName(Path.GetDirectoryName(path));
        string work = directory == "washing" ? "石洗い" : directory == "gold" ? "砂金取り" : "石掘り";
        string leg = IsReturnLeg() ? "復路 / 荷台 → 同じ作業現場" : "往路 / 作業現場 → 登録した荷台";
        heading.Text = work + " / " + (mode == "record" ? "記録中 / " : "自動徒歩 / ") + leg;
        int count = route == null ? 0 : route.segments.Count;
        double fraction;
        if (mode == "record")
        {
            fraction = Math.Min(1, segmentMs / 4000.0);
            bool justSaved = checkpointSavedAt > 0 && clock.ElapsedMilliseconds - checkpointSavedAt < 1400;
            progressLabel.Text = (justSaved ? "照合点を保存しました  ·  " : "照合点 " + count + " 個  ·  ")
                + "この区間 " + (segmentMs / 1000.0).ToString("0.0") + " 秒 / 4 秒目安";
            progressFill.BackColor = segmentMs >= 3200 ? Color.FromArgb(247, 192, 95) : Color.FromArgb(82, 185, 222);
            keyGuide.Text = "W A S D：徒歩   F6：照合点   F7：停止して片道終了   F9：中止";
        }
        else
        {
            fraction = count == 0 ? 0 : (double)displayedSegment / count;
            progressLabel.Text = "照合済み " + displayedSegment + " / " + count + " 区間  ·  到着は荷台ID／作業ボタンで別途確認";
            keyGuide.Text = "F9：中止   ·   手動操作／別アプリへ切替でも停止します";
        }
        progressFill.SetBounds(0, 0, (int)(progressTrack.Width * fraction), progressTrack.Height);
        Refresh();
    }
'''
once('    protected override bool ShowWithoutActivation', methods + '    protected override bool ShowWithoutActivation')
once('''            Guard();
            RECT r; GetClientRect(target, out r); POINT p = new POINT(); ClientToScreen(target, ref p);
            Location = new Point(p.x + Math.Max(0, (r.right - Width) / 2), p.y + Math.Max(0, r.bottom - 70));''', r'''            if (overlayPreview)
            {
                heading.Text = "プレビュー：石洗い / 往路 / 現場 → 登録した荷台";
                label.Text = "トラックの荷台前へ歩いてください。\n4秒以内ごとに一度立ち止まると、景色を照合点として保存します。";
                progressLabel.Text = "照合点 3 個を保存済み   ·   現在の区間 2.8 秒 / 4 秒目安";
                keyGuide.Text = "W A S D：徒歩   F6：照合点   F7：荷台前で終了   F9：中止";
                progressFill.Size = new Size((int)(progressTrack.Width * .7), progressTrack.Height);
                using (var bitmap = new Bitmap(Width, Height))
                {
                    DrawToBitmap(bitmap, new Rectangle(0, 0, Width, Height));
                    bitmap.Save(path, ImageFormat.Png);
                }
                Result = "OVERLAY_PREVIEW_OK"; Close(); return;
            }
            Guard();
            RECT r; GetClientRect(target, out r); POINT p = new POINT(); ClientToScreen(target, ref p);
            Width = Math.Min(680, r.right - 32); LayoutOverlay();
            Location = new Point(p.x + 16, p.y + 16);
            UpdateOverlay();''')
once('''                label.Text = "3秒後に記録開始。W/A/S/D・マウスだけで徒歩移動。立ち止まると照合点を保存。終点でF7、取消F9";
                Wait(3000); NormalisePitch();''', r'''                for (int seconds = 3; seconds >= 1; seconds--)
                {
                    label.Text = seconds + "秒後に記録を開始します。今は動かずに待ってください。\n矢印は手順の案内です。実際の車両の方向を示すものではありません。";
                    Wait(1000);
                }
                NormalisePitch();''')
once('''            label.Text = "記録中：区間 " + (route.segments.Count + 1) + " / 40。4秒以内ごとに停止。終点でF7、取消F9";''', r'''            label.Text = segmentMs >= 3200
                ? "そろそろ一度立ち止まってください。\n停止すると照合用の景色を自動保存します。"
                : (IsReturnLeg() ? "同じ作業現場へ歩いて戻ってください。" : "登録した車両の荷台前へ歩いてください。")
                    + "\n終点では止まってF7。途中は4秒以内ごとに一度止まります。";
            UpdateOverlay();''')
once('''            route.segments.Add(segment);
            if (route.segments.Count > 40)''', '''            route.segments.Add(segment);
            checkpointSavedAt = clock.ElapsedMilliseconds;
            UpdateOverlay();
            if (route.segments.Count > 40)''')
once('''        label.Text = "徒歩ルート " + (number + 1) + "/" + route.segments.Count + "：実画面照合つき。F9／手動操作／他アプリ切替で停止";''', r'''        displayedSegment = number;
        label.Text = "自動で徒歩移動中。操作せずに見守ってください。\n景色が一致しない場合は入力を止めます。F9ですぐ中止できます。";
        UpdateOverlay();''')
once('''            delegate(int completed, int total) { File.WriteAllText(path + ".progress", completed + "/" + total, Encoding.UTF8); });''', '''            delegate(int completed, int total) {
                displayedSegment = completed; UpdateOverlay();
                File.WriteAllText(path + ".progress", completed + "/" + total, Encoding.UTF8);
            });''')
once('''        label.Text = "記録した景色へ視点を合わせています。照合できない場合は歩かず停止します";''', r'''        label.Text = "記録した景色へ視点を合わせています。\n照合できるまでは歩きません。一致しない場合は理由を表示して停止します。";
        UpdateOverlay();''')
once('''        using (var full = new Bitmap(r.right, r.bottom, PixelFormat.Format24bppRgb))''', '''        // Never compare the assistant overlay to itself. Restore without activation.
        bool restoreOverlay = Visible;
        if (restoreOverlay) { Hide(); DwmFlush(); }
        try
        {
        using (var full = new Bitmap(r.right, r.bottom, PixelFormat.Format24bppRgb))''')
once('''            return values;
        }
    }
    // Use separated scenery tiles.''', '''            return values;
        }
        }
        finally { if (restoreOverlay && !IsDisposed) Show(); }
    }
    // Use separated scenery tiles.''')
once('''    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();''', '''    [DllImport("dwmapi.dll")] private static extern int DwmFlush();
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();''')
path.write_text(t, encoding='utf-8', newline='\n')
print('Native overlay layout, recording progress and preview capture applied.')
