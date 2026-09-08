using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AiMiner.UiHost
{
    internal sealed class MainForm : Form
    {
        private const uint SmtoBlock = 0x0001;
        private const uint SmtoAbortIfHung = 0x0002;
        private const int SwShowNoActivate = 4;
        private readonly Program.HostOptions _options;
        private readonly WebView2 _webView;
        private readonly Label _nativeError;
        private readonly System.Windows.Forms.Timer _backendMonitor;
        private readonly BlockingCollection<string> _outbound = new BlockingCollection<string>(128);
        private readonly Thread _senderThread;
        private volatile bool _closing;
        private bool _webReady;
        private bool _backendRequestedExit;
        private bool _pendingSmoke;
        private string _pendingStateJson;
        private int _visualBrowserProcessId;

        internal MainForm(Program.HostOptions options)
        {
            _options = options;
            Text = _options.VisualTest ? "AI採掘機を準備中" : "AI採掘機";
            try
            {
                Icon executableIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (executableIcon != null) Icon = executableIcon;
            }
            catch { }
            Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            StartPosition = FormStartPosition.CenterScreen;
            if (_options.VisualTest)
            {
                MinimumSize = new Size(320, 360);
                ClientSize = new Size(_options.WindowWidth, _options.WindowHeight);
            }
            else
            {
                MinimumSize = new Size(640, 560);
                ClientSize = new Size(980, 720);
            }
            FormBorderStyle = FormBorderStyle.Sizable;
            MinimizeBox = true;
            MaximizeBox = true;
            ShowIcon = true;
            BackColor = Color.FromArgb(242, 242, 247);

            _webView = new WebView2
            {
                Dock = DockStyle.Fill,
                Visible = false,
                DefaultBackgroundColor = Color.FromArgb(242, 242, 247)
            };
            _nativeError = new Label
            {
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter,
                Padding = new Padding(40),
                ForeColor = Color.FromArgb(60, 60, 67),
                BackColor = Color.FromArgb(242, 242, 247),
                Font = new Font("Segoe UI", 11F, FontStyle.Regular, GraphicsUnit.Point),
                Visible = false
            };
            Controls.Add(_webView);
            Controls.Add(_nativeError);

            _backendMonitor = new System.Windows.Forms.Timer { Interval = 1000 };
            _backendMonitor.Tick += BackendMonitorOnTick;

            _senderThread = new Thread(SenderLoop)
            {
                IsBackground = true,
                Name = "AI採掘機 UI IPC"
            };

            Shown += async delegate { await InitializeWebViewAsync(); };
            FormClosing += MainFormOnClosing;
            FormClosed += MainFormOnClosed;

            if (!_options.Fixture)
            {
                _senderThread.Start();
                _backendMonitor.Start();
            }
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == Protocol.WmCopyData && !_options.Fixture
                && BackendIdentity.IsMatchingSender(message.WParam, _options.BackendWindow, _options.BackendPid))
            {
                CopyDataStruct copyData = (CopyDataStruct)Marshal.PtrToStructure(message.LParam, typeof(CopyDataStruct));
                if (copyData.ByteCount > 0 && copyData.ByteCount <= (256 * 1024 + 512) * 2
                    && copyData.ByteCount % 2 == 0 && copyData.Data != IntPtr.Zero)
                {
                    string raw = Marshal.PtrToStringUni(copyData.Data, copyData.ByteCount / 2);
                    if (raw != null)
                    {
                        raw = raw.TrimEnd('\0');
                        BackendMessage parsed;
                        if (Protocol.TryParseBackendMessage(raw, _options.Session, out parsed))
                        {
                            HandleBackendMessage(parsed);
                            message.Result = new IntPtr(1);
                            return;
                        }
                    }
                }
                message.Result = IntPtr.Zero;
                return;
            }
            base.WndProc(ref message);
        }

        private async Task InitializeWebViewAsync()
        {
            try
            {
                string userDataFolder;
                if (_options.VisualTest)
                {
                    string visualFolderError;
                    userDataFolder = Program.HostOptions.NormalizeVisualTestUserDataFolder(
                        _options.VisualTestUserDataFolder, out visualFolderError);
                    if (!String.Equals(userDataFolder, _options.VisualTestUserDataFolder,
                        StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException(visualFolderError
                            ?? "ビジュアルテストのWebView2フォルダーを確認できません。");
                    }
                }
                else
                {
                    userDataFolder = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "AI採掘機", "WebView2");
                    Directory.CreateDirectory(userDataFolder);
                }
                CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await _webView.EnsureCoreWebView2Async(environment);
                if (_options.VisualTest)
                {
                    uint browserProcessId = _webView.CoreWebView2.BrowserProcessId;
                    if (browserProcessId > 0 && browserProcessId <= Int32.MaxValue)
                        _visualBrowserProcessId = (int)browserProcessId;
                }

                CoreWebView2 core = _webView.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreHostObjectsAllowed = false;
                core.Settings.AreDefaultScriptDialogsEnabled = false;
                core.Settings.IsWebMessageEnabled = true;
                core.SetVirtualHostNameToFolderMapping("app.local", _options.AssetsPath,
                    CoreWebView2HostResourceAccessKind.DenyCors);
                core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args)
                {
                    if (!IsAllowedAppUri(args.Uri)) args.Cancel = true;
                };
                core.FrameNavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args)
                {
                    if (!IsAllowedAppUri(args.Uri)) args.Cancel = true;
                };
                core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args)
                {
                    args.Handled = true;
                };
                core.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs args)
                {
                    args.Cancel = true;
                };
                core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs args)
                {
                    args.State = CoreWebView2PermissionState.Deny;
                    args.Handled = true;
                };
                core.WebResourceRequested += CoreOnWebResourceRequested;
                core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
                core.WebMessageReceived += CoreOnWebMessageReceived;
                core.NavigationCompleted += CoreOnNavigationCompleted;

                _webView.Visible = true;
                _nativeError.Visible = false;
                core.Navigate(_options.GetInitialAppUri());
            }
            catch (WebView2RuntimeNotFoundException)
            {
                ShowNativeError("Microsoft Edge WebView2 Runtime が必要です。\r\n"
                    + "Microsoft公式のWebView2 Runtimeをインストールしてから、AI採掘機を起動し直してください。");
            }
            catch (Exception ex)
            {
                ShowNativeError("UIを起動できませんでした。\r\n" + Protocol.SanitizeDiagnostic(ex.Message));
            }
        }

        private void CoreOnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs args)
        {
            if (!args.IsSuccess || !IsAllowedAppUri(_webView.Source == null ? null : _webView.Source.AbsoluteUri))
            {
                ShowNativeError("UIファイルを安全に読み込めませんでした。");
                return;
            }
            _webReady = true;
            if (_options.VisualTest) Text = "AI採掘機";
            if (!String.IsNullOrEmpty(_pendingStateJson))
            {
                PostJsonToWeb(_pendingStateJson);
                _pendingStateJson = null;
            }
            if (_pendingSmoke)
            {
                _pendingSmoke = false;
                PostJsonToWeb("{\"type\":\"command\",\"command\":\"SMOKE\"}");
            }
        }

        private void CoreOnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            if (!IsAllowedAppUri(args.Source)
                || !IsAllowedAppUri(_webView.Source == null ? null : _webView.Source.AbsoluteUri))
                return;

            string action;
            IList<string> arguments;
            string error;
            if (!Protocol.TryTranslateWebMessage(args.WebMessageAsJson, out action, out arguments, out error))
            {
                PostHostError("INVALID_ACTION", error);
                return;
            }

            // The page can post its one-shot handshake immediately before WebView2 raises
            // NavigationCompleted. Keep all other actions gated until navigation is complete.
            if (!_webReady && action != "hello") return;

            if (_options.Fixture)
            {
                if (action == "window.close") Close();
                return;
            }

            string line;
            try { line = Protocol.BuildActionLine(_options.Session, action, arguments); }
            catch (Exception ex)
            {
                PostHostError("INVALID_ACTION", Protocol.SanitizeDiagnostic(ex.Message));
                return;
            }

            if (!_outbound.TryAdd(line))
                PostHostError("BACKEND_BUSY", "本体への操作待ちが上限に達しました。");
        }

        private void CoreOnWebResourceRequested(object sender, CoreWebView2WebResourceRequestedEventArgs args)
        {
            if (IsAllowedResourceUri(args.Request.Uri)) return;
            MemoryStream body = new MemoryStream(Encoding.UTF8.GetBytes("Blocked"), false);
            args.Response = _webView.CoreWebView2.Environment.CreateWebResourceResponse(
                body, 403, "Forbidden", "Content-Type: text/plain; charset=utf-8\r\nCache-Control: no-store");
        }

        private void HandleBackendMessage(BackendMessage message)
        {
            if (message.Kind == BackendMessageKind.State)
            {
                if (_webReady) PostJsonToWeb(message.Value);
                else _pendingStateJson = message.Value;
                return;
            }

            switch (message.Value)
            {
                case "SHOW":
                    if (!Visible) Show();
                    if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
                    Activate();
                    break;
                case "SHOWNOACTIVATE":
                    ShowWindow(Handle, SwShowNoActivate);
                    break;
                case "HIDE":
                    Hide();
                    break;
                case "EXIT":
                    _backendRequestedExit = true;
                    Close();
                    break;
                case "SMOKE":
                    if (_webReady) PostJsonToWeb("{\"type\":\"command\",\"command\":\"SMOKE\"}");
                    else _pendingSmoke = true;
                    break;
            }
        }

        private void BackendMonitorOnTick(object sender, EventArgs args)
        {
            if (!_closing && !BackendIdentity.IsBackendAlive(_options.BackendWindow, _options.BackendPid))
            {
                _backendRequestedExit = true;
                Close();
            }
        }

        private void MainFormOnClosing(object sender, FormClosingEventArgs args)
        {
            if (_closing) return;
            _closing = true;
            _backendMonitor.Stop();
            if (_options.VisualTest) CloseVisualTestWebView();
            if (!_options.Fixture && !_backendRequestedExit)
            {
                string closeLine = Protocol.BuildActionLine(_options.Session, "window.close", new string[0]);
                SendCopyData(closeLine, 400);
            }
        }

        private void MainFormOnClosed(object sender, FormClosedEventArgs args)
        {
            _outbound.CompleteAdding();
            if (_senderThread.IsAlive) _senderThread.Join(600);
            _backendMonitor.Dispose();
        }

        private void CloseVisualTestWebView()
        {
            int browserProcessId = _visualBrowserProcessId;
            _visualBrowserProcessId = 0;
            try { _webView.Dispose(); }
            catch { }

            if (browserProcessId <= 0) return;
            try
            {
                using (Process browserProcess = Process.GetProcessById(browserProcessId))
                {
                    if (!browserProcess.HasExited) browserProcess.WaitForExit(3000);
                }
            }
            catch (ArgumentException) { }
            catch (InvalidOperationException) { }
            catch (System.ComponentModel.Win32Exception) { }
        }

        private void SenderLoop()
        {
            try
            {
                foreach (string line in _outbound.GetConsumingEnumerable())
                {
                    if (_closing) break;
                    if (!SendCopyData(line, 1500))
                    {
                        try
                        {
                            BeginInvoke((Action)delegate
                            {
                                if (!_closing) PostHostError("BACKEND_UNAVAILABLE", "本体へ操作を送信できませんでした。");
                            });
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        private bool SendCopyData(string message, uint timeoutMilliseconds)
        {
            if (!BackendIdentity.IsBackendAlive(_options.BackendWindow, _options.BackendPid)) return false;
            byte[] bytes = Encoding.Unicode.GetBytes(message + "\0");
            IntPtr buffer = Marshal.AllocHGlobal(bytes.Length);
            try
            {
                Marshal.Copy(bytes, 0, buffer, bytes.Length);
                CopyDataStruct data = new CopyDataStruct
                {
                    DataTag = Protocol.CopyDataTag,
                    ByteCount = bytes.Length,
                    Data = buffer
                };
                IntPtr result;
                IntPtr sent = SendMessageTimeout(_options.BackendWindow, Protocol.WmCopyData,
                    Handle, ref data, SmtoBlock | SmtoAbortIfHung, timeoutMilliseconds, out result);
                return sent != IntPtr.Zero && result != IntPtr.Zero;
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }

        private void PostJsonToWeb(string json)
        {
            try { _webView.CoreWebView2.PostWebMessageAsJson(json); }
            catch (Exception ex) { ShowNativeError("UIとの通信に失敗しました。\r\n" + Protocol.SanitizeDiagnostic(ex.Message)); }
        }

        private void PostHostError(string code, string message)
        {
            if (!_webReady) return;
            string json = "{\"type\":\"host.error\",\"code\":\"" + EscapeJson(code)
                + "\",\"message\":\"" + EscapeJson(message) + "\"}";
            PostJsonToWeb(json);
        }

        private void ShowNativeError(string message)
        {
            _webReady = false;
            _webView.Visible = false;
            _nativeError.Text = message;
            _nativeError.Visible = true;
            _nativeError.BringToFront();
        }

        private static bool IsAllowedAppUri(string value)
        {
            Uri uri;
            return Uri.TryCreate(value, UriKind.Absolute, out uri)
                && uri.Scheme == Uri.UriSchemeHttps
                && String.Equals(uri.Host, "app.local", StringComparison.OrdinalIgnoreCase)
                && uri.Port == 443
                && String.IsNullOrEmpty(uri.UserInfo);
        }

        private static bool IsAllowedResourceUri(string value)
        {
            if (IsAllowedAppUri(value)) return true;
            Uri uri;
            if (!Uri.TryCreate(value, UriKind.Absolute, out uri)) return false;
            return uri.Scheme == "data"
                || (uri.Scheme == "blob" && value.StartsWith("blob:https://app.local/", StringComparison.OrdinalIgnoreCase));
        }

        private static string EscapeJson(string value)
        {
            if (value == null) return String.Empty;
            StringBuilder builder = new StringBuilder(value.Length + 8);
            foreach (char c in value)
            {
                switch (c)
                {
                    case '\\': builder.Append("\\\\"); break;
                    case '"': builder.Append("\\\""); break;
                    case '\r': builder.Append("\\r"); break;
                    case '\n': builder.Append("\\n"); break;
                    case '\t': builder.Append("\\t"); break;
                    default:
                        if (c < 0x20) builder.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else builder.Append(c);
                        break;
                }
            }
            return builder.ToString();
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SendMessageTimeout(IntPtr target, int message, IntPtr sender,
            ref CopyDataStruct data, uint flags, uint timeout, out IntPtr result);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr window, int command);
    }
}
