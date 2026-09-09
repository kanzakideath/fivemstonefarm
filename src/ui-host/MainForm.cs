using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using AiMiner.StoneMetaGame;
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
        private readonly BlockingCollection<MetaWorkItem> _metaWork
            = new BlockingCollection<MetaWorkItem>(256);
        private readonly Thread _senderThread;
        private readonly Thread _metaThread;
        private readonly MetaGameRuntime _metaGame;
        private readonly string _metaGameCreationError;
        private readonly string _fixtureMetaStateDirectory;
        private volatile bool _closing;
        private bool _webReady;
        private bool _backendRequestedExit;
        private bool _pendingSmoke;
        private bool _visualBaseSmokePassed;
        private bool _visualMetaSmokePassed;
        private bool _visualSmokeFailed;
        private bool _stoneHostMiningIssued;
        private readonly List<MetaWebRequest> _pendingMetaRequests = new List<MetaWebRequest>();
        private string _pendingStateJson;
        private int _visualBrowserProcessId;

        internal MainForm(Program.HostOptions options)
            : this(options, null)
        {
        }

        private MainForm(Program.HostOptions options, string metaGameStatePathOverride)
        {
            _options = options;
            string fixtureStateDirectory;
            string metaCreationError;
            _metaGame = CreateMetaGameRuntime(options, metaGameStatePathOverride,
                out metaCreationError, out fixtureStateDirectory);
            _metaGameCreationError = metaCreationError;
            _fixtureMetaStateDirectory = fixtureStateDirectory;
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
            _metaThread = new Thread(MetaCommandLoop)
            {
                IsBackground = true,
                Name = "AI採掘機 Stone Metagame"
            };

            Shown += async delegate { await InitializeWebViewAsync(); };
            FormClosing += MainFormOnClosing;
            FormClosed += MainFormOnClosed;

            if (_metaGame != null) _metaThread.Start();
            if (!_options.Fixture)
            {
                _senderThread.Start();
                _backendMonitor.Start();
            }
        }

        // Exercises the same authenticated WM_COPYDATA ingress, worker queue, atomic sidecar
        // persistence, and typed ACK egress used by the AHK controller. The state override is
        // private to this in-process self-test so production startup can only use LocalAppData.
        internal static bool RunTrustedTransportSelfTest(string assetsPath, out string error)
        {
            error = null;
            string temporaryRoot = Path.Combine(Path.GetTempPath(),
                "ai-miner-meta-transport-test-" + Guid.NewGuid().ToString("N"));
            string statePath = Path.Combine(temporaryRoot, "state.json");
            string dataPath = Path.Combine(assetsPath, "metagame", "data");
            const string session = "transport-session-0001";
            string eventId = "transport:mining:" + Guid.NewGuid().ToString("N");
            MainForm form = null;
            MetaTransportTestBackend backend = null;
            TransportTestSenderWindow impostor = null;
            try
            {
                Directory.CreateDirectory(temporaryRoot);
                backend = new MetaTransportTestBackend(session, eventId, dataPath, statePath);
                impostor = new TransportTestSenderWindow();
                Program.HostOptions options = new Program.HostOptions
                {
                    BackendWindow = backend.Handle,
                    BackendPid = Process.GetCurrentProcess().Id,
                    Session = session,
                    AssetsPath = Path.GetFullPath(assetsPath),
                    Fixture = false,
                    VisualTest = false
                };
                form = new MainForm(options, statePath);
                IntPtr hostWindow = form.Handle;
                backend.ExpectedHostWindow = hostWindow;

                if (form._metaGame == null || !form._metaGame.IsAvailable
                    || !String.Equals(form._metaGame.StatePath, Path.GetFullPath(statePath),
                        StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        "transport fixture did not use its isolated metagame state");
                }

                long timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                string wire = "AIUIMETA1\t" + session + "\tMINING_SUCCESS\t" + eventId
                    + "\t" + timestamp.ToString(CultureInfo.InvariantCulture);

                IntPtr dispatchResult;
                if (!SendTransportTestCopyData(hostWindow, impostor.Handle, wire,
                        out dispatchResult) || dispatchResult != IntPtr.Zero)
                {
                    throw new InvalidOperationException(
                        "transport fixture accepted an unregistered sender window");
                }
                MetaGameState rejectedState = new MetaGameStateStore(statePath)
                    .LoadOrCreate(DateTimeOffset.UtcNow);
                if (rejectedState.Mining.TotalStoneMined != 0 || backend.MiningAckCount != 0)
                    throw new InvalidOperationException(
                        "rejected transport mutated state or emitted an ACK");

                if (!SendTransportTestCopyData(hostWindow, backend.Handle, wire,
                        out dispatchResult) || dispatchResult != new IntPtr(1))
                    throw new InvalidOperationException("authenticated mining event was not queued");
                PumpTransportMessagesUntil(backend, 1, 5000);

                // A durable outbox retry must receive another ACK but must not increment again.
                if (!SendTransportTestCopyData(hostWindow, backend.Handle, wire,
                        out dispatchResult) || dispatchResult != new IntPtr(1))
                    throw new InvalidOperationException("authenticated mining replay was not queued");
                PumpTransportMessagesUntil(backend, 2, 5000);

                if (!String.IsNullOrEmpty(backend.Failure))
                    throw new InvalidOperationException(backend.Failure);
                if (backend.MiningAckCount != 2 || backend.DurableMiningAckCount != 2)
                    throw new InvalidOperationException(
                        "typed mining ACKs were not emitted after durable persistence");

                MetaGameState finalState = new MetaGameStateStore(statePath)
                    .LoadOrCreate(DateTimeOffset.UtcNow);
                int eventOccurrences = 0;
                foreach (string processedId in finalState.ProcessedMiningEventIds)
                    if (String.Equals(processedId, eventId, StringComparison.Ordinal))
                        eventOccurrences++;
                if (finalState.Mining.TotalStoneMined != 1 || eventOccurrences != 1)
                    throw new InvalidOperationException(
                        "transport replay was not persisted exactly once");
                return true;
            }
            catch (Exception exception)
            {
                error = "metagame transport self-test failed: "
                    + Protocol.SanitizeDiagnostic(exception.Message);
                return false;
            }
            finally
            {
                if (form != null)
                {
                    try
                    {
                        form._backendRequestedExit = true;
                        if (!form.IsDisposed) form.Close();
                        Application.DoEvents();
                    }
                    catch { }
                    try { form.Dispose(); }
                    catch { }
                }
                if (impostor != null) impostor.Dispose();
                if (backend != null) backend.Dispose();
                try
                {
                    DirectoryInfo directory = new DirectoryInfo(temporaryRoot);
                    string tempParent = Path.GetFullPath(Path.GetTempPath()).TrimEnd(
                        Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                    if (directory.Exists && directory.Parent != null
                        && String.Equals(directory.Parent.FullName.TrimEnd(
                                Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                            tempParent, StringComparison.OrdinalIgnoreCase)
                        && directory.Name.StartsWith("ai-miner-meta-transport-test-",
                            StringComparison.Ordinal)
                        && (directory.Attributes & FileAttributes.ReparsePoint) == 0)
                        directory.Delete(true);
                }
                catch { }
            }
        }

        private static void PumpTransportMessagesUntil(MetaTransportTestBackend backend,
            int expectedAckCount, int timeoutMilliseconds)
        {
            Stopwatch stopwatch = Stopwatch.StartNew();
            while (backend.MiningAckCount < expectedAckCount
                && String.IsNullOrEmpty(backend.Failure)
                && stopwatch.ElapsedMilliseconds < timeoutMilliseconds)
            {
                Application.DoEvents();
                Thread.Sleep(10);
            }
            Application.DoEvents();
            if (!String.IsNullOrEmpty(backend.Failure))
                throw new InvalidOperationException(backend.Failure);
            if (backend.MiningAckCount < expectedAckCount)
                throw new TimeoutException("timed out waiting for the persisted metagame ACK");
        }

        private static bool SendTransportTestCopyData(IntPtr target, IntPtr sender, string message,
            out IntPtr result)
        {
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
                IntPtr sent = SendMessageTimeout(target, Protocol.WmCopyData, sender, ref data,
                    SmtoBlock | SmtoAbortIfHung, 1500, out result);
                return sent != IntPtr.Zero;
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == Protocol.WmCopyData && !_options.Fixture
                && BackendIdentity.IsMatchingSender(message.WParam, _options.BackendWindow, _options.BackendPid))
            {
                if (message.LParam == IntPtr.Zero)
                {
                    message.Result = IntPtr.Zero;
                    return;
                }
                CopyDataStruct copyData = (CopyDataStruct)Marshal.PtrToStructure(message.LParam, typeof(CopyDataStruct));
                if (copyData.DataTag == Protocol.CopyDataTag
                    && copyData.ByteCount > 0 && copyData.ByteCount <= (256 * 1024 + 512) * 2
                    && copyData.ByteCount % 2 == 0 && copyData.Data != IntPtr.Zero)
                {
                    string wire = Marshal.PtrToStringUni(copyData.Data, copyData.ByteCount / 2);
                    if (!String.IsNullOrEmpty(wire) && wire[wire.Length - 1] == '\0'
                        && wire.IndexOf('\0') == wire.Length - 1)
                    {
                        string raw = wire.Substring(0, wire.Length - 1);
                        TrustedMetaCommand metaCommand;
                        if (MetaGameBridge.TryParseTrustedMessage(raw, _options.Session,
                            DateTimeOffset.UtcNow, out metaCommand))
                        {
                            bool accepted = _metaGame != null && !_metaWork.IsAddingCompleted
                                && _metaWork.TryAdd(MetaWorkItem.FromTrusted(metaCommand));
                            message.Result = accepted ? new IntPtr(1) : IntPtr.Zero;
                            return;
                        }

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
                    if (!IsAllowedTopLevelAppUri(args.Uri)) args.Cancel = true;
                    else
                    {
                        _webReady = false;
                        if (_options.VisualTest)
                        {
                            _visualBaseSmokePassed = false;
                            _visualMetaSmokePassed = false;
                            _visualSmokeFailed = false;
                            Text = "AI採掘機を準備中";
                        }
                    }
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
            if (!args.IsSuccess || !IsAllowedTopLevelAppUri(
                    _webView.Source == null ? null : _webView.Source.AbsoluteUri))
            {
                ShowNativeError("UIファイルを安全に読み込めませんでした。");
                return;
            }
            _webReady = true;
            if (!String.IsNullOrEmpty(_pendingStateJson))
            {
                PostJsonToWeb(_pendingStateJson);
                _pendingStateJson = null;
            }
            if (_pendingMetaRequests.Count > 0)
            {
                MetaWebRequest[] queued = _pendingMetaRequests.ToArray();
                _pendingMetaRequests.Clear();
                foreach (MetaWebRequest request in queued) QueueMetaWebRequest(request);
            }
            if (_options.VisualTest)
                PostJsonToWeb("{\"type\":\"command\",\"command\":\"SMOKE\"}");
            if (_pendingSmoke)
            {
                _pendingSmoke = false;
                PostJsonToWeb("{\"type\":\"command\",\"command\":\"SMOKE\"}");
            }
        }

        private void CoreOnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            if (!IsAllowedTopLevelAppUri(args.Source)
                || !IsAllowedTopLevelAppUri(
                    _webView.Source == null ? null : _webView.Source.AbsoluteUri))
                return;

            string action;
            IList<string> arguments;
            string error;
            bool recognizedMeta;
            MetaWebRequest metaRequest;
            if (MetaGameBridge.TryParseWebRequest(args.WebMessageAsJson, out recognizedMeta,
                out metaRequest, out error))
            {
                if (_webReady) QueueMetaWebRequest(metaRequest);
                else if (_pendingMetaRequests.Count < 32) _pendingMetaRequests.Add(metaRequest);
                return;
            }
            if (recognizedMeta)
            {
                if (metaRequest != null && !String.IsNullOrEmpty(metaRequest.RequestId))
                    PostJsonToWeb(MetaGameBridge.BuildErrorResponse(metaRequest.RequestId,
                        error ?? "INVALID_META_ACTION"));
                else
                    PostHostError("INVALID_META_ACTION", error ?? "メタゲームの操作を確認できません。");
                return;
            }
            if (!Protocol.TryTranslateWebMessage(args.WebMessageAsJson, out action, out arguments, out error))
            {
                PostHostError("INVALID_ACTION", error);
                return;
            }

            // The page can post its one-shot handshake immediately before WebView2 raises
            // NavigationCompleted. Keep all other actions gated until navigation is complete.
            if (!_webReady && action != "hello"
                && !(_options.VisualTest && action == "smoke.result")) return;

            if (_options.Fixture)
            {
                if (action == "window.close") Close();
                else if (_options.VisualTest && action == "smoke.result")
                    HandleVisualSmokeResult(arguments.Count == 1 ? arguments[0] : null);
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
            _metaWork.CompleteAdding();
            if (_senderThread.IsAlive) _senderThread.Join(600);
            if (_metaThread.IsAlive) _metaThread.Join(5000);
            _backendMonitor.Dispose();
            DeleteFixtureMetaStateDirectory();
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

        private void MetaCommandLoop()
        {
            try
            {
                foreach (MetaWorkItem item in _metaWork.GetConsumingEnumerable())
                {
                    if (_closing) break;
                    if (!WaitForMetaRecoveryReset()) break;
                    if (item.Trusted != null) ProcessTrustedMetaWork(item.Trusted);
                    else if (item.Web != null) ProcessWebMetaWork(item.Web);
                }
            }
            catch (Exception exception)
            {
                WaitForMetaRecoveryReset();
                PostMetaErrorFromWorker("META_PROCESSING_FAILED", exception.Message);
            }
        }

        private void ProcessTrustedMetaWork(TrustedMetaCommand command)
        {
            try
            {
                string result = _metaGame.ApplyTrusted(command);
                // Queue acceptance is not an ACK. A verified mining event is acknowledged only
                // after the sidecar transaction, including its atomic save, returned successfully.
                // Include command + id: BEGIN and END intentionally share a session ID, so an
                // id-only ACK could incorrectly remove a different durable outbox head.
                string acknowledgement = Protocol.BuildActionLine(_options.Session,
                    "meta.ack", new[] { MetaGameBridge.CommandToken(command.Kind), command.Id });
                SendCopyData(acknowledgement, 1500);
                PostMetaResultFromWorker(result);
            }
            catch (Exception exception)
            {
                WaitForMetaRecoveryReset();
                PostMetaErrorFromWorker("META_PROCESSING_FAILED", exception.Message);
            }
        }

        private void ProcessWebMetaWork(MetaWebRequest request)
        {
            try
            {
                string response;
                if (request.Kind == MetaWebRequestKind.Bootstrap)
                {
                    string bootstrap = _metaGame.GetBootstrapJson();
                    response = MetaGameBridge.BuildBootstrapResponse(request.RequestId, bootstrap);
                }
                else
                {
                    string mutation = _metaGame.ExecuteUiJson(request.ExecuteJson);
                    response = MetaGameBridge.BuildExecuteResponse(request.RequestId, mutation);
                }
                PostMetaResultFromWorker(response);

                if (_options.IsHostBackedStoneFixture && !_stoneHostMiningIssued
                    && request.Kind == MetaWebRequestKind.Execute
                    && String.Equals(request.Action, "onboarding.complete", StringComparison.Ordinal))
                {
                    _stoneHostMiningIssued = true;
                    TrustedMetaCommand mining = new TrustedMetaCommand
                    {
                        Kind = TrustedMetaCommandKind.MiningSuccess,
                        Id = "visual:stone-host:mining:1",
                        TimestampUtc = DateTimeOffset.UtcNow
                    };
                    PostMetaResultFromWorker(_metaGame.ApplyTrusted(mining));
                }
            }
            catch (Exception exception)
            {
                WaitForMetaRecoveryReset();
                PostMetaResultFromWorker(MetaGameBridge.BuildErrorResponse(request.RequestId,
                    exception.Message));
                if (_options.IsHostBackedStoneFixture)
                    SetVisualErrorFromWorker("META_HOST_FLOW_FAILED");
            }
        }

        private bool WaitForMetaRecoveryReset()
        {
            if (_metaGame == null || _options.Fixture) return true;
            while (!_closing)
            {
                string token;
                if (!_metaGame.TryGetRecoverySignal(out token)) return true;
                string reset = Protocol.BuildActionLine(_options.Session, "meta.reset",
                    new[] { token });
                if (SendCopyData(reset, 1500))
                {
                    _metaGame.MarkRecoverySignalSent(token);
                    continue;
                }
                Thread.Sleep(250);
            }
            return false;
        }

        private void QueueMetaWebRequest(MetaWebRequest request)
        {
            if (_metaGame == null)
            {
                PostJsonToWeb(MetaGameBridge.BuildErrorResponse(request.RequestId,
                    _metaGameCreationError ?? "META_UNAVAILABLE"));
                return;
            }
            if (!_metaWork.IsAddingCompleted && _metaWork.TryAdd(MetaWorkItem.FromWeb(request))) return;
            PostJsonToWeb(MetaGameBridge.BuildErrorResponse(request.RequestId, "META_QUEUE_FULL"));
        }

        private void HandleVisualSmokeResult(string result)
        {
            if (!_options.VisualTest || _visualSmokeFailed) return;
            if (String.Equals(result, "OK", StringComparison.Ordinal))
            {
                _visualBaseSmokePassed = true;
                TryMarkVisualReady();
                return;
            }

            string expected;
            if (_options.IsHostBackedStoneFixture)
                expected = "META_HOST_OK:home:rendered:mined=1:debug=0:mutation=onboarding.complete";
            else if (_options.IsStoneFixture)
                expected = "META_OK:" + _options.ExpectedMetaRoute + ":rendered";
            else
                expected = null;

            if (expected != null && String.Equals(result, expected, StringComparison.Ordinal))
            {
                _visualMetaSmokePassed = true;
                TryMarkVisualReady();
                return;
            }

            SetVisualError(String.IsNullOrEmpty(result) ? "SMOKE_EMPTY" : "SMOKE_FAILED");
        }

        private void TryMarkVisualReady()
        {
            if (!_options.VisualTest || _visualSmokeFailed || !_webReady || !_visualBaseSmokePassed)
                return;
            if (_options.IsStoneFixture && !_visualMetaSmokePassed) return;
            Text = "AI採掘機 READY";
        }

        private void SetVisualError(string code)
        {
            if (!_options.VisualTest) return;
            _visualSmokeFailed = true;
            Text = "AI採掘機 ERROR " + Protocol.SanitizeDiagnostic(code ?? "UNKNOWN");
        }

        private void SetVisualErrorFromWorker(string code)
        {
            if (!_options.VisualTest || _closing) return;
            try
            {
                BeginInvoke((Action)delegate
                {
                    if (!_closing) SetVisualError(code);
                });
            }
            catch { }
        }

        private void PostMetaResultFromWorker(string json)
        {
            if (_closing || String.IsNullOrEmpty(json)) return;
            try
            {
                BeginInvoke((Action)delegate
                {
                    if (!_closing && _webReady) PostJsonToWeb(json);
                });
            }
            catch { }
        }

        private void PostMetaErrorFromWorker(string code, string message)
        {
            if (_closing) return;
            try
            {
                BeginInvoke((Action)delegate
                {
                    if (!_closing) PostHostError(code, Protocol.SanitizeDiagnostic(message));
                });
            }
            catch { }
        }

        private static MetaGameRuntime CreateMetaGameRuntime(Program.HostOptions options,
            string statePathOverride, out string error, out string fixtureStateDirectory)
        {
            error = null;
            fixtureStateDirectory = null;
            try
            {
                string dataPath = Path.Combine(options.AssetsPath, "metagame", "data");
                string statePath;
                if (!String.IsNullOrEmpty(statePathOverride))
                {
                    statePath = Path.GetFullPath(statePathOverride);
                }
                else if (options.Fixture)
                {
                    fixtureStateDirectory = Path.Combine(Path.GetTempPath(),
                        "ai-miner-meta-fixture-" + Guid.NewGuid().ToString("N"));
                    statePath = Path.Combine(fixtureStateDirectory, "state.json");
                }
                else
                {
                    statePath = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "AI採掘機", "metagame", "state.json");
                }
                // Distribution and all current fixture paths are production-trust mode. There is
                // intentionally no general command-line switch that enables debug mutations.
                MetaGameRuntime runtime = new MetaGameRuntime(dataPath, statePath, false);
                if (!runtime.IsAvailable) error = runtime.LastError;
                return runtime;
            }
            catch (Exception exception)
            {
                error = Protocol.SanitizeDiagnostic(exception.Message);
                return null;
            }
        }

        private void DeleteFixtureMetaStateDirectory()
        {
            if (!_options.Fixture || String.IsNullOrEmpty(_fixtureMetaStateDirectory)) return;
            try
            {
                string parent = Path.GetFullPath(Path.GetTempPath()).TrimEnd(
                    Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                DirectoryInfo directory = new DirectoryInfo(_fixtureMetaStateDirectory);
                if (directory.Exists && directory.Parent != null
                    && String.Equals(directory.Parent.FullName.TrimEnd(
                            Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                        parent, StringComparison.OrdinalIgnoreCase)
                    && directory.Name.StartsWith("ai-miner-meta-fixture-", StringComparison.Ordinal)
                    && (directory.Attributes & FileAttributes.ReparsePoint) == 0)
                    directory.Delete(true);
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
            if (_options.VisualTest) SetVisualError("NATIVE_UI_ERROR");
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

        private bool IsAllowedTopLevelAppUri(string value)
        {
            if (!IsAllowedAppUri(value)) return false;
            Uri actual;
            Uri expected;
            return Uri.TryCreate(value, UriKind.Absolute, out actual)
                && Uri.TryCreate(_options.GetInitialAppUri(), UriKind.Absolute, out expected)
                && String.Equals(actual.AbsolutePath, expected.AbsolutePath,
                    StringComparison.Ordinal)
                && String.Equals(actual.Query, expected.Query, StringComparison.Ordinal)
                && String.IsNullOrEmpty(actual.Fragment);
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

        private sealed class TransportTestSenderWindow : NativeWindow, IDisposable
        {
            internal TransportTestSenderWindow()
            {
                CreateHandle(new CreateParams
                {
                    Caption = "AI Miner Transport Test Sender",
                    Parent = new IntPtr(-3)
                });
            }

            public void Dispose()
            {
                if (Handle != IntPtr.Zero) DestroyHandle();
            }
        }

        private sealed class MetaTransportTestBackend : NativeWindow, IDisposable
        {
            private readonly string _session;
            private readonly string _eventId;
            private readonly string _dataPath;
            private readonly string _statePath;

            internal MetaTransportTestBackend(string session, string eventId, string dataPath,
                string statePath)
            {
                _session = session;
                _eventId = eventId;
                _dataPath = dataPath;
                _statePath = statePath;
                CreateHandle(new CreateParams
                {
                    Caption = "AI Miner Transport Test Backend",
                    Parent = new IntPtr(-3)
                });
            }

            internal IntPtr ExpectedHostWindow { get; set; }
            internal int MiningAckCount { get; private set; }
            internal int DurableMiningAckCount { get; private set; }
            internal string Failure { get; private set; }

            protected override void WndProc(ref Message message)
            {
                if (message.Msg != Protocol.WmCopyData)
                {
                    base.WndProc(ref message);
                    return;
                }
                try
                {
                    if (message.WParam != ExpectedHostWindow || message.LParam == IntPtr.Zero)
                        throw new InvalidOperationException("ACK sender window was not the UI host");
                    CopyDataStruct copyData = (CopyDataStruct)Marshal.PtrToStructure(
                        message.LParam, typeof(CopyDataStruct));
                    if (copyData.DataTag != Protocol.CopyDataTag || copyData.ByteCount <= 0
                        || copyData.ByteCount > 4096 || copyData.ByteCount % 2 != 0
                        || copyData.Data == IntPtr.Zero)
                        throw new InvalidOperationException("ACK COPYDATA envelope was invalid");
                    string wire = Marshal.PtrToStringUni(copyData.Data, copyData.ByteCount / 2);
                    if (String.IsNullOrEmpty(wire) || wire[wire.Length - 1] != '\0'
                        || wire.IndexOf('\0') != wire.Length - 1)
                        throw new InvalidOperationException("ACK COPYDATA string was invalid");
                    string[] parts = wire.Substring(0, wire.Length - 1).Split('\t');
                    if (parts.Length != 5 || parts[0] != "AIUI1" || parts[1] != _session
                        || parts[2] != "meta.ack" || parts[3] != "MINING_SUCCESS"
                        || parts[4] != _eventId)
                        throw new InvalidOperationException("typed mining ACK payload was invalid");

                    MiningAckCount++;
                    if (IsMiningStateDurable()) DurableMiningAckCount++;
                    else throw new InvalidOperationException(
                        "mining ACK arrived before the atomic state was durable");
                    message.Result = new IntPtr(1);
                    return;
                }
                catch (Exception exception)
                {
                    Failure = Protocol.SanitizeDiagnostic(exception.Message);
                    message.Result = IntPtr.Zero;
                    return;
                }
            }

            private bool IsMiningStateDurable()
            {
                FileInfo stateFile = new FileInfo(_statePath);
                string directory = Path.GetDirectoryName(_statePath);
                if (!stateFile.Exists || stateFile.Length <= 0
                    || Directory.GetFiles(directory,
                        Path.GetFileName(_statePath) + ".tmp-*").Length != 0)
                    return false;
                MetaGameState state = new MetaGameStateStore(_statePath)
                    .LoadOrCreate(DateTimeOffset.UtcNow);
                int occurrences = 0;
                foreach (string processedId in state.ProcessedMiningEventIds)
                    if (String.Equals(processedId, _eventId, StringComparison.Ordinal))
                        occurrences++;
                return state.SchemaVersion == 2 && state.Mining.TotalStoneMined == 1
                    && occurrences == 1;
            }

            public void Dispose()
            {
                if (Handle != IntPtr.Zero) DestroyHandle();
            }
        }
    }

    internal sealed class MetaWorkItem
    {
        internal TrustedMetaCommand Trusted;
        internal MetaWebRequest Web;

        internal static MetaWorkItem FromTrusted(TrustedMetaCommand command)
        {
            return new MetaWorkItem { Trusted = command };
        }

        internal static MetaWorkItem FromWeb(MetaWebRequest request)
        {
            return new MetaWorkItem { Web = request };
        }
    }
}
