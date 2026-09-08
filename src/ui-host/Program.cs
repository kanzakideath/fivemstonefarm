using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace AiMiner.UiHost
{
    internal static class Program
    {
        internal const string Capabilities = "UI_CAPS 1 WEBVIEW2 WM_COPYDATA LOCAL_ASSETS FIXTURE";
        private static readonly Regex SafeSessionPattern =
            new Regex(@"\A[A-Za-z0-9_-]{8,128}\z", RegexOptions.CultureInvariant);

        [STAThread]
        private static int Main(string[] args)
        {
            TryEnablePerMonitorDpi();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            HostOptions options;
            string parseError;
            if (!HostOptions.TryParse(args, out options, out parseError))
            {
                MessageBox.Show(parseError, "AI採掘機", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 2;
            }

            if (!String.IsNullOrEmpty(options.CapabilitiesResultPath))
                return WriteResult(options.CapabilitiesResultPath, Capabilities) ? 0 : 3;

            if (!String.IsNullOrEmpty(options.SelfTestResultPath))
            {
                string validationError;
                bool valid = AssetValidator.TryValidate(options.AssetsPath, out validationError)
                    && HostOptions.RunSelfTests(options.AssetsPath, out validationError)
                    && Protocol.RunSelfTests(out validationError);
                string result = valid ? "SELFTEST OK" : "SELFTEST ERROR " + Protocol.SanitizeDiagnostic(validationError);
                if (!WriteResult(options.SelfTestResultPath, result))
                    return 3;
                return valid ? 0 : 4;
            }

            string assetError;
            if (!AssetValidator.TryValidate(options.AssetsPath, out assetError))
            {
                MessageBox.Show("UIファイルを確認できません。\r\n" + assetError,
                    "AI採掘機", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 4;
            }

            if (!options.Fixture)
            {
                string backendError;
                if (!BackendIdentity.TryValidate(options.BackendWindow, options.BackendPid, out backendError))
                {
                    MessageBox.Show("AI採掘機の本体へ接続できません。\r\n" + backendError,
                        "AI採掘機", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 5;
                }
            }

            using (MainForm form = new MainForm(options))
                Application.Run(form);
            return 0;
        }

        private static bool WriteResult(string path, string content)
        {
            try
            {
                string fullPath = Path.GetFullPath(path);
                string directory = Path.GetDirectoryName(fullPath);
                if (String.IsNullOrEmpty(directory))
                    return false;
                Directory.CreateDirectory(directory);
                string temporary = fullPath + "." + Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture)
                    + "." + Guid.NewGuid().ToString("N") + ".tmp";
                File.WriteAllText(temporary, content + "\r\n", new UTF8Encoding(false));
                if (File.Exists(fullPath))
                    File.Replace(temporary, fullPath, null, true);
                else
                    File.Move(temporary, fullPath);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static void TryEnablePerMonitorDpi()
        {
            try
            {
                if (SetProcessDpiAwarenessContext(new IntPtr(-4)))
                    return;
            }
            catch (EntryPointNotFoundException) { }
            catch (DllNotFoundException) { }

            try { SetProcessDPIAware(); }
            catch (EntryPointNotFoundException) { }
            catch (DllNotFoundException) { }
        }

        [DllImport("user32.dll")]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        internal sealed class HostOptions
        {
            private const int MinimumVisualWidth = 320;
            private const int MaximumVisualWidth = 2560;
            private const int MinimumVisualHeight = 360;
            private const int MaximumVisualHeight = 1600;
            private static readonly Regex VisualTestFolderPattern =
                new Regex(@"\Aai-miner-webview-test-[a-f0-9]{32}\z", RegexOptions.CultureInvariant);
            private static readonly HashSet<string> VisualFixtures = new HashSet<string>(StringComparer.Ordinal)
            {
                "overview", "action-sheet", "settings", "narrow"
            };

            internal IntPtr BackendWindow;
            internal int BackendPid;
            internal string Session;
            internal string AssetsPath;
            internal bool Fixture;
            internal bool VisualTest;
            internal string VisualFixture;
            internal int WindowWidth;
            internal int WindowHeight;
            internal string VisualTestUserDataFolder;
            internal string CapabilitiesResultPath;
            internal string SelfTestResultPath;

            internal string GetInitialAppUri()
            {
                if (!VisualTest)
                {
                    return Fixture
                        ? "https://app.local/index.html?fixture=1"
                        : "https://app.local/index.html";
                }

                switch (VisualFixture)
                {
                    case "action-sheet":
                        return "https://app.local/index.html?fixture=1&page=overview&picker=1";
                    case "settings":
                        return "https://app.local/index.html?fixture=1&page=settings";
                    case "narrow":
                    case "overview":
                        return "https://app.local/index.html?fixture=1&page=overview";
                    default:
                        throw new InvalidOperationException("ビジュアルテストのシーンが正しくありません。");
                }
            }

            internal static bool TryParse(string[] args, out HostOptions options, out string error)
            {
                if (args == null)
                {
                    options = new HostOptions();
                    error = "引数を確認できません。";
                    return false;
                }

                int visualTestCount = 0;
                foreach (string argument in args)
                {
                    if (String.Equals(argument, "--visual-test", StringComparison.Ordinal))
                        visualTestCount++;
                }
                if (visualTestCount > 1)
                {
                    options = new HostOptions();
                    error = "--visual-test が重複しています。";
                    return false;
                }
                if (visualTestCount == 1)
                    return TryParseVisualTest(args, out options, out error);

                return TryParseStandard(args, out options, out error);
            }

            private static bool TryParseStandard(string[] args, out HostOptions options, out string error)
            {
                options = new HostOptions();
                error = null;
                Dictionary<string, string> values = new Dictionary<string, string>(StringComparer.Ordinal);
                bool fixture = false;

                for (int i = 0; i < args.Length; i++)
                {
                    string key = args[i];
                    if (key == "--fixture")
                    {
                        if (fixture) { error = "--fixture が重複しています。"; return false; }
                        fixture = true;
                        continue;
                    }

                    if (key != "--backend-hwnd" && key != "--backend-pid" && key != "--session"
                        && key != "--assets" && key != "--capabilities" && key != "--self-test")
                    {
                        error = "不明な引数です: " + key;
                        return false;
                    }
                    if (values.ContainsKey(key)) { error = "引数が重複しています: " + key; return false; }
                    if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
                    {
                        error = "引数の値がありません: " + key;
                        return false;
                    }
                    values.Add(key, args[++i]);
                }

                string resultPath;
                if (values.TryGetValue("--capabilities", out resultPath))
                {
                    if (values.Count != 1 || fixture)
                    {
                        error = "--capabilities は結果ファイルだけを指定してください。";
                        return false;
                    }
                    options.CapabilitiesResultPath = resultPath;
                    return true;
                }

                if (values.TryGetValue("--self-test", out resultPath))
                {
                    string assets;
                    if (!values.TryGetValue("--assets", out assets) || values.Count != 2 || fixture)
                    {
                        error = "--self-test には結果ファイルと --assets が必要です。";
                        return false;
                    }
                    options.SelfTestResultPath = resultPath;
                    options.AssetsPath = NormalizeAbsoluteDirectory(assets, out error);
                    return error == null;
                }

                string assetsPath;
                if (!values.TryGetValue("--assets", out assetsPath))
                {
                    error = "--assets が必要です。";
                    return false;
                }
                options.AssetsPath = NormalizeAbsoluteDirectory(assetsPath, out error);
                if (error != null) return false;
                options.Fixture = fixture;

                if (fixture)
                {
                    if (values.Count != 1)
                    {
                        error = "--fixture では --assets 以外の接続引数を指定しません。";
                        return false;
                    }
                    options.Session = "fixture00";
                    return true;
                }

                string hwndText;
                string pidText;
                string session;
                if (!values.TryGetValue("--backend-hwnd", out hwndText)
                    || !values.TryGetValue("--backend-pid", out pidText)
                    || !values.TryGetValue("--session", out session)
                    || values.Count != 4)
                {
                    error = "--backend-hwnd、--backend-pid、--session、--assets が必要です。";
                    return false;
                }

                ulong hwndValue;
                int pid;
                if (!UInt64.TryParse(hwndText, NumberStyles.None, CultureInfo.InvariantCulture, out hwndValue)
                    || hwndValue == 0 || hwndValue > Int64.MaxValue)
                {
                    error = "--backend-hwnd が正しくありません。";
                    return false;
                }
                if (!Int32.TryParse(pidText, NumberStyles.None, CultureInfo.InvariantCulture, out pid) || pid <= 0)
                {
                    error = "--backend-pid が正しくありません。";
                    return false;
                }
                if (!SafeSessionPattern.IsMatch(session))
                {
                    error = "--session は英数字、_、- の8～128文字で指定してください。";
                    return false;
                }

                options.BackendWindow = new IntPtr(unchecked((long)hwndValue));
                options.BackendPid = pid;
                options.Session = session;
                return true;
            }

            private static bool TryParseVisualTest(string[] args, out HostOptions options, out string error)
            {
                options = new HostOptions();
                error = null;
                Dictionary<string, string> values = new Dictionary<string, string>(StringComparer.Ordinal);
                bool visualTest = false;

                for (int i = 0; i < args.Length; i++)
                {
                    string key = args[i];
                    if (key == "--visual-test")
                    {
                        if (visualTest)
                        {
                            error = "--visual-test が重複しています。";
                            return false;
                        }
                        visualTest = true;
                        continue;
                    }

                    if (key != "--assets" && key != "--fixture"
                        && key != "--window-width" && key != "--window-height")
                    {
                        error = "ビジュアルテストで使用できない引数です: " + key;
                        return false;
                    }
                    if (values.ContainsKey(key))
                    {
                        error = "引数が重複しています: " + key;
                        return false;
                    }
                    if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
                    {
                        error = "引数の値がありません: " + key;
                        return false;
                    }
                    values.Add(key, args[++i]);
                }

                string assets;
                string fixture;
                string widthText;
                string heightText;
                if (!visualTest || values.Count != 4
                    || !values.TryGetValue("--assets", out assets)
                    || !values.TryGetValue("--fixture", out fixture)
                    || !values.TryGetValue("--window-width", out widthText)
                    || !values.TryGetValue("--window-height", out heightText))
                {
                    error = "--visual-test には --assets、--fixture、--window-width、--window-height が必要です。";
                    return false;
                }
                if (!VisualFixtures.Contains(fixture))
                {
                    error = "--fixture は overview、action-sheet、settings、narrow のいずれかです。";
                    return false;
                }

                int width;
                int height;
                if (!Int32.TryParse(widthText, NumberStyles.None, CultureInfo.InvariantCulture, out width)
                    || width < MinimumVisualWidth || width > MaximumVisualWidth)
                {
                    error = "--window-width は " + MinimumVisualWidth.ToString(CultureInfo.InvariantCulture)
                        + "～" + MaximumVisualWidth.ToString(CultureInfo.InvariantCulture) + " で指定してください。";
                    return false;
                }
                if (!Int32.TryParse(heightText, NumberStyles.None, CultureInfo.InvariantCulture, out height)
                    || height < MinimumVisualHeight || height > MaximumVisualHeight)
                {
                    error = "--window-height は " + MinimumVisualHeight.ToString(CultureInfo.InvariantCulture)
                        + "～" + MaximumVisualHeight.ToString(CultureInfo.InvariantCulture) + " で指定してください。";
                    return false;
                }

                options.AssetsPath = NormalizeAbsoluteDirectory(assets, out error);
                if (error != null) return false;

                string userDataFolder = Environment.GetEnvironmentVariable(
                    "AI_MINER_VISUAL_TEST_USER_DATA_FOLDER", EnvironmentVariableTarget.Process);
                options.VisualTestUserDataFolder = NormalizeVisualTestUserDataFolder(userDataFolder, out error);
                if (error != null) return false;

                options.Fixture = true;
                options.VisualTest = true;
                options.VisualFixture = fixture;
                options.WindowWidth = width;
                options.WindowHeight = height;
                options.Session = "fixture00";
                return true;
            }

            internal static string NormalizeVisualTestUserDataFolder(string path, out string error)
            {
                error = null;
                try
                {
                    if (String.IsNullOrWhiteSpace(path) || !IsFullyQualifiedPath(path))
                    {
                        error = "AI_MINER_VISUAL_TEST_USER_DATA_FOLDER は絶対パスで指定してください。";
                        return null;
                    }

                    string fullPath = Path.GetFullPath(path)
                        .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                    string tempRoot = Path.GetFullPath(Path.GetTempPath())
                        .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                    DirectoryInfo directory = new DirectoryInfo(fullPath);
                    if (!VisualTestFolderPattern.IsMatch(directory.Name)
                        || directory.Parent == null
                        || !String.Equals(directory.Parent.FullName.TrimEnd(
                                Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                            tempRoot, StringComparison.OrdinalIgnoreCase))
                    {
                        error = "ビジュアルテストのWebView2フォルダーが安全な一時フォルダーではありません。";
                        return null;
                    }
                    if (!directory.Exists)
                    {
                        error = "ビジュアルテストのWebView2フォルダーがありません。";
                        return null;
                    }
                    if ((directory.Attributes & FileAttributes.ReparsePoint) != 0)
                    {
                        error = "ビジュアルテストのWebView2フォルダーに再解析ポイントは使用できません。";
                        return null;
                    }
                    return fullPath;
                }
                catch (Exception ex)
                {
                    error = "ビジュアルテストのWebView2フォルダーが正しくありません: " + ex.Message;
                    return null;
                }
            }

            internal static bool RunSelfTests(string assetsPath, out string error)
            {
                error = null;
                string variableName = "AI_MINER_VISUAL_TEST_USER_DATA_FOLDER";
                string previous = Environment.GetEnvironmentVariable(variableName, EnvironmentVariableTarget.Process);
                string temporary = Path.Combine(Path.GetTempPath(),
                    "ai-miner-webview-test-" + Guid.NewGuid().ToString("N"));
                try
                {
                    Directory.CreateDirectory(temporary);
                    Environment.SetEnvironmentVariable(variableName, temporary, EnvironmentVariableTarget.Process);

                    HostOptions parsed;
                    string parseError;
                    string[] scenes = { "overview", "action-sheet", "settings", "narrow" };
                    foreach (string scene in scenes)
                    {
                        string[] visualArgs =
                        {
                            "--visual-test", "--assets", assetsPath, "--fixture", scene,
                            "--window-width", scene == "narrow" ? "520" : "820", "--window-height", "640"
                        };
                        string expectedUri = scene == "action-sheet"
                            ? "https://app.local/index.html?fixture=1&page=overview&picker=1"
                            : scene == "settings"
                                ? "https://app.local/index.html?fixture=1&page=settings"
                                : "https://app.local/index.html?fixture=1&page=overview";
                        if (!TryParse(visualArgs, out parsed, out parseError)
                            || !parsed.VisualTest || !parsed.Fixture
                            || parsed.VisualFixture != scene
                            || parsed.WindowWidth != (scene == "narrow" ? 520 : 820)
                            || parsed.WindowHeight != 640
                            || parsed.GetInitialAppUri() != expectedUri
                            || !String.Equals(parsed.VisualTestUserDataFolder, temporary,
                                StringComparison.OrdinalIgnoreCase))
                        {
                            error = "visual-test parser rejected a valid " + scene + " fixture: " + parseError;
                            return false;
                        }
                    }

                    string[] ordinaryFixture = { "--fixture", "--assets", assetsPath };
                    if (!TryParse(ordinaryFixture, out parsed, out parseError)
                        || !parsed.Fixture || parsed.VisualTest
                        || parsed.GetInitialAppUri() != "https://app.local/index.html?fixture=1")
                    {
                        error = "ordinary fixture parsing changed: " + parseError;
                        return false;
                    }

                    string[] ordinaryConnected =
                    {
                        "--backend-hwnd", "1", "--backend-pid", "1",
                        "--session", "session0", "--assets", assetsPath
                    };
                    if (!TryParse(ordinaryConnected, out parsed, out parseError)
                        || parsed.Fixture || parsed.VisualTest
                        || parsed.GetInitialAppUri() != "https://app.local/index.html")
                    {
                        error = "ordinary connected parsing changed: " + parseError;
                        return false;
                    }

                    string[] invalidScene =
                    {
                        "--visual-test", "--assets", assetsPath, "--fixture", "unknown",
                        "--window-width", "820", "--window-height", "640"
                    };
                    if (TryParse(invalidScene, out parsed, out parseError))
                    {
                        error = "visual-test parser accepted an unknown fixture.";
                        return false;
                    }

                    string[] invalidWidth =
                    {
                        "--visual-test", "--assets", assetsPath, "--fixture", "overview",
                        "--window-width", "319", "--window-height", "640"
                    };
                    if (TryParse(invalidWidth, out parsed, out parseError))
                    {
                        error = "visual-test parser accepted an out-of-range window size.";
                        return false;
                    }

                    string[] connectedVisualTest =
                    {
                        "--visual-test", "--assets", assetsPath, "--fixture", "overview",
                        "--window-width", "820", "--window-height", "640",
                        "--backend-pid", "1"
                    };
                    if (TryParse(connectedVisualTest, out parsed, out parseError))
                    {
                        error = "visual-test parser accepted a backend connection argument.";
                        return false;
                    }

                    Environment.SetEnvironmentVariable(variableName, null, EnvironmentVariableTarget.Process);
                    string[] missingFolder =
                    {
                        "--visual-test", "--assets", assetsPath, "--fixture", "overview",
                        "--window-width", "820", "--window-height", "640"
                    };
                    if (TryParse(missingFolder, out parsed, out parseError))
                    {
                        error = "visual-test parser accepted a missing isolated user-data folder.";
                        return false;
                    }

                    string driveRelativeAsset = Path.GetPathRoot(assetsPath).TrimEnd(
                        Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + "relative-assets";
                    Environment.SetEnvironmentVariable(variableName, temporary, EnvironmentVariableTarget.Process);
                    string[] driveRelative =
                    {
                        "--visual-test", "--assets", driveRelativeAsset, "--fixture", "overview",
                        "--window-width", "820", "--window-height", "640"
                    };
                    if (TryParse(driveRelative, out parsed, out parseError))
                    {
                        error = "visual-test parser accepted a drive-relative asset path.";
                        return false;
                    }

                    return true;
                }
                catch (Exception ex)
                {
                    error = "visual-test parser self-test failed: " + ex.Message;
                    return false;
                }
                finally
                {
                    Environment.SetEnvironmentVariable(variableName, previous, EnvironmentVariableTarget.Process);
                    try
                    {
                        DirectoryInfo directory = new DirectoryInfo(temporary);
                        if (directory.Exists && (directory.Attributes & FileAttributes.ReparsePoint) == 0)
                            directory.Delete(false);
                    }
                    catch { }
                }
            }

            private static string NormalizeAbsoluteDirectory(string path, out string error)
            {
                error = null;
                try
                {
                    if (String.IsNullOrWhiteSpace(path) || !IsFullyQualifiedPath(path))
                    {
                        error = "--assets は絶対パスで指定してください。";
                        return null;
                    }
                    string fullPath = Path.GetFullPath(path);
                    if (!Directory.Exists(fullPath))
                    {
                        error = "UIファイルのフォルダーがありません。";
                        return null;
                    }
                    string root = Path.GetPathRoot(fullPath);
                    return String.Equals(root, fullPath, StringComparison.OrdinalIgnoreCase)
                        ? fullPath
                        : fullPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                }
                catch (Exception ex)
                {
                    error = "UIファイルのパスが正しくありません: " + ex.Message;
                    return null;
                }
            }

            private static bool IsFullyQualifiedPath(string path)
            {
                if (String.IsNullOrEmpty(path)) return false;
                string root;
                try { root = Path.GetPathRoot(path); }
                catch { return false; }
                if (String.IsNullOrEmpty(root)) return false;

                if (root.Length >= 3 && Char.IsLetter(root[0]) && root[1] == ':'
                    && (root[2] == Path.DirectorySeparatorChar || root[2] == Path.AltDirectorySeparatorChar))
                {
                    return true;
                }

                if (!root.StartsWith(@"\\", StringComparison.Ordinal)) return false;
                string[] parts = root.Trim('\\', '/').Split(new[] { '\\', '/' },
                    StringSplitOptions.RemoveEmptyEntries);
                return parts.Length >= 2;
            }
        }

        internal static class AssetValidator
        {
            private const long MaximumTextAssetBytes = 4L * 1024L * 1024L;
            private static readonly UTF8Encoding StrictUtf8 = new UTF8Encoding(false, true);

            internal static bool TryValidate(string root, out string error)
            {
                error = null;
                try
                {
                    if (String.IsNullOrEmpty(root) || !Path.IsPathRooted(root) || !Directory.Exists(root))
                        throw new InvalidDataException("UI asset root is missing or is not absolute.");
                    DirectoryInfo rootInfo = new DirectoryInfo(root);
                    if ((rootInfo.Attributes & FileAttributes.ReparsePoint) != 0)
                        throw new InvalidDataException("UI asset root cannot be a reparse point.");

                    string index = ReadRequiredText(root, "index.html");
                    ReadRequiredText(root, "app.css");
                    ReadRequiredText(root, "app.js");
                    ReadRequiredText(root, Path.Combine("vendor", "framework7-bundle.min.css"));
                    ReadRequiredText(root, Path.Combine("vendor", "framework7-bundle.min.js"));
                    string buildInfo = ReadRequiredText(root, "build-info.json");

                    if (!Regex.IsMatch(index,
                        @"<meta\b(?=[^>]*\bname\s*=\s*['""]ai-miner-ui-schema['""])(?=[^>]*\bcontent\s*=\s*['""]1['""])[^>]*>",
                        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
                    {
                        throw new InvalidDataException("index.html has no ai-miner-ui-schema=1 marker.");
                    }

                    JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 };
                    Dictionary<string, object> info = serializer.DeserializeObject(buildInfo) as Dictionary<string, object>;
                    if (info == null || !Protocol.IsIntegerValue(info.ContainsKey("schema") ? info["schema"] : null, 1))
                        throw new InvalidDataException("build-info.json must be an object with schema 1.");
                    object versionValue;
                    if (!info.TryGetValue("version", out versionValue)
                        || !(versionValue is string) || !Regex.IsMatch((string)versionValue,
                            @"\A\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\z", RegexOptions.CultureInvariant))
                    {
                        throw new InvalidDataException("build-info.json version is invalid.");
                    }
                    object framework;
                    object frameworkVersion;
                    object offline;
                    if (!info.TryGetValue("framework", out framework) || !(framework is string)
                        || !String.Equals((string)framework, "Framework7", StringComparison.Ordinal)
                        || !info.TryGetValue("frameworkVersion", out frameworkVersion) || !(frameworkVersion is string)
                        || !String.Equals((string)frameworkVersion, "9.1.3", StringComparison.Ordinal)
                        || !info.TryGetValue("offline", out offline) || !(offline is bool) || !(bool)offline)
                    {
                        throw new InvalidDataException("build-info.json does not describe the pinned offline UI.");
                    }
                    return true;
                }
                catch (Exception ex)
                {
                    error = ex.Message;
                    return false;
                }
            }

            private static string ReadRequiredText(string root, string relativePath)
            {
                string fullRoot = Path.GetFullPath(root + Path.DirectorySeparatorChar);
                string path = Path.GetFullPath(Path.Combine(root, relativePath));
                if (!path.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("UI asset path escaped its root.");
                FileInfo file = new FileInfo(path);
                if (!file.Exists || file.Length == 0 || file.Length > MaximumTextAssetBytes)
                    throw new InvalidDataException(relativePath + " is missing, empty, or too large.");
                if ((file.Attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException(relativePath + " cannot be a reparse point.");
                return StrictUtf8.GetString(File.ReadAllBytes(path));
            }
        }
    }
}
