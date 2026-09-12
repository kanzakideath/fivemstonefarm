// Explicit local support ZIP: no network, screenshots, recursive collection,
// INI, saves, browser data or route image references.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

internal static class Diagnostics
{
    private const int MaxFile = 2200000, MaxTotal = 14000000;
    private static readonly Encoding Utf8 = new UTF8Encoding(false);
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = MaxFile, RecursionLimit = 20 };
    private static readonly string[] ContextKeys = { "running", "mode", "fsm", "generation", "task", "washAttempt", "foreground", "correctionEnabled", "storageEnabled", "rawStoneCount", "writeFailures", "attempts", "successes", "storageTrips", "storageRetries", "bridgeMode" };
    private static readonly string[] ReportKeys = { "schema", "startedUtc", "result", "pulses", "inputMs", "beforeError", "afterError", "elapsedMs", "stableWaitMs", "inputsReleased", "events", "generation", "task", "decision", "visualResult", "imageVerified", "extraForwardInput", "rawStoneCount", "updatedAt", "leg", "step", "steps", "score", "reason", "profile", "tolerancePx" };

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 2) return 64;
        string result;
        try {
            if (args.Length == 2 && args[0] == "self-test") { SelfTest(); result = "SELFTEST OK"; }
            else if (args.Length == 6 && args[0] == "export") {
                Export(args[2], args[3], args[4], args[5]); result = "EXPORTED";
            }
            else return 64;
        } catch (Exception ex) { result = "ERROR " + ex.GetType().Name; }
        try { File.WriteAllText(args[1], result, Utf8); } catch { return 74; }
        return result == "EXPORTED" || result == "SELFTEST OK" ? 0 : 1;
    }
    internal static string Redact(string value)
    {
        if (value == null) return "";
        string s = value.Length > 4000 ? value.Substring(0, 4000) : value;
        s = Regex.Replace(s, @"[\r\n\t]+", " ");
        s = Regex.Replace(s, @"https?://\S+", "[url]", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"(?:[A-Za-z]:\\|\\\\)[^|]*", "[path]");
        s = Regex.Replace(s, @"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email]");
        s = Regex.Replace(s, @"\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b", "[address]");
        s = Regex.Replace(s, @"\b(?:token|secret|password|authorization|cookie|epoch|storageId|plate|license|identifier|playerName|vehicleName|metadata|baseline|snapshot|reference|hwnd)\s*[:=].*", "[private-fields-omitted]", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"[A-Za-z0-9_+/=-]{48,}", "[long-value]");
        return s.Length > 1600 ? s.Substring(0,1600) : s;
    }
    private static bool NoLinks(string path)
    {
        string current = Path.GetFullPath(path);
        while (!String.IsNullOrEmpty(current)) {
            if ((Directory.Exists(current) || File.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) return false;
            current = Path.GetDirectoryName(current);
        }
        return true;
    }
    private static string ReadLimited(string path, int limit)
    {
        if (!NoLinks(path)) throw new IOException("Reparse point rejected");
        using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
            if (stream.Length > limit) throw new InvalidDataException("Too large");
            int size = (int)stream.Length;
            byte[] bytes = new byte[size]; int read = 0, count;
            while (read < size && (count = stream.Read(bytes, read, size-read)) > 0) read += count;
            return Utf8.GetString(bytes,0,read).TrimStart('\uFEFF');
        }
    }
    private static Dictionary<string,object> Scalars(Dictionary<string,object> data, string[] keys)
    {
        var clean = new Dictionary<string,object>();
        foreach (string key in keys) {
            object v;
            if (!data.TryGetValue(key,out v) || v == null) continue;
            if (v is string) clean[key] = Redact((string)v);
            else if (v is bool || v is int || v is long || v is decimal) clean[key] = v;
            else if (v is double && !Double.IsInfinity((double)v) && !Double.IsNaN((double)v)) clean[key] = v;
            else if (key == "events" && v is IList) {
                var list = new List<string>();
                foreach (object entry in (IList)v) { if (list.Count >= 150) break; if (entry is string) list.Add(Redact((string)entry)); }
                clean[key] = list;
            }
        }
        return clean;
    }
    private static string SanitizeJournal(string raw, ref int skipped, List<string> important)
    {
        var result = new StringBuilder();
        using (var reader = new StringReader(raw)) {
            string line;
            while ((line = reader.ReadLine()) != null) {
                if (String.IsNullOrWhiteSpace(line)) continue;
                try {
                    if (line.Length > 16000) throw new InvalidDataException();
                    var data = Json.DeserializeObject(line) as Dictionary<string,object>;
                    if (data == null || !data.ContainsKey("event")) throw new InvalidDataException();
                    var clean = Scalars(data, new[] {"schema","utc","monotonicMs","version","session","seq","event","message"});
                    object context;
                    if (data.TryGetValue("context",out context) && context is Dictionary<string,object>)
                        clean["context"] = Scalars((Dictionary<string,object>)context,ContextKeys);
                    string safe = Json.Serialize(clean);
                    result.AppendLine(safe);
                    object evt; clean.TryGetValue("event",out evt);
                    object msg; clean.TryGetValue("message",out msg);
                    string eventName = Convert.ToString(evt,CultureInfo.InvariantCulture);
                    string message = Convert.ToString(msg,CultureInfo.InvariantCulture);
                    if (eventName == "USER_MARK" || eventName.Contains("ERROR") || eventName.Contains("FAULT") || message.Contains("FAILED") || message.Contains("ERROR ")) {
                        important.Add(safe); if (important.Count > 40) important.RemoveAt(0);
                    }
                } catch { skipped++; }
            }
        }
        return result.ToString();
    }
    private static string Hash(byte[] bytes)
    { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant(); }

    internal static void Export(string rootPath, string outputPath, string executablePath, string version)
    {
        if (!Regex.IsMatch(version, @"^\d+\.\d+\.\d+$")) throw new ArgumentException("Version");
        string root = Path.GetFullPath(rootPath), output = Path.GetFullPath(outputPath);
        if (File.Exists(output) || Directory.Exists(output) || !output.EndsWith(".zip",StringComparison.OrdinalIgnoreCase)) throw new IOException("Destination exists or invalid");
        if (!Directory.Exists(root) || !NoLinks(root) || !NoLinks(Path.GetDirectoryName(output))) throw new IOException("Invalid root");
        var entries = new Dictionary<string,byte[]>();
        var omissions = new List<string>(); var important = new List<string>();
        int skipped=0,total=0;
        for (int n=4;n>=0;n--) {
            string name="events.jsonl"+(n==0 ? "" : "."+n);
            string source=Path.Combine(root,"diagnostics",name);
            if (!File.Exists(source)) continue;
            try {
                string sanitized=SanitizeJournal(ReadLimited(source,MaxFile),ref skipped,important);
                Add(entries,"logs/"+name,sanitized,ref total);
            } catch { omissions.Add("logs/"+name+": omitted (unreadable, oversized, or linked)"); }
        }
        string[] reports={ "wash-position-last.json", "wash-nearby-last.json",
            "mining/outbound.json.last-run.json", "mining/return.json.last-run.json",
            "washing/outbound.json.last-run.json", "washing/return.json.last-run.json",
            "gold/outbound.json.last-run.json", "gold/return.json.last-run.json" };
        foreach (string name in reports) {
            string source=Path.Combine(root,"exe-routes",name.Replace('/',Path.DirectorySeparatorChar));
            if (!File.Exists(source)) continue;
            try {
                var data=Json.DeserializeObject(ReadLimited(source,131072)) as Dictionary<string,object>;
                if(data==null) throw new InvalidDataException();
                Add(entries,"reports/"+name,Json.Serialize(Scalars(data,ReportKeys))+"\n",ref total);
            } catch { omissions.Add("reports/"+name+": omitted (unreadable, invalid, oversized, or linked)"); }
        }
        string updater=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"AI採掘機","updater.log");
        // A test export must not read the real user's updater log.
        if (Path.GetFileName(root)=="AI採掘機" && File.Exists(updater)) {
            try {
                string[] lines=ReadLimited(updater,MaxFile).Split(new[]{'\n'},StringSplitOptions.None);
                var safe=new StringBuilder();
                for(int i=Math.Max(0,lines.Length-400);i<lines.Length;i++) safe.AppendLine(Redact(lines[i]));
                Add(entries,"reports/updater-redacted.txt",safe.ToString(),ref total);
            } catch { omissions.Add("reports/updater-redacted.txt: omitted (unreadable or oversized)"); }
        }
        string exeHash="unavailable";
        try {
            if (NoLinks(executablePath) && new FileInfo(executablePath).Length <= 40000000)
                using(var s=File.OpenRead(executablePath)) using(var sha=SHA256.Create())
                    exeHash=BitConverter.ToString(sha.ComputeHash(s)).Replace("-", "").ToLowerInvariant();
        } catch { omissions.Add("executable hash unavailable"); }
        var system=new Dictionary<string,object> {
            {"schema",1},{"appVersion",version},{"createdUtc",DateTime.UtcNow.ToString("O")},
            {"osVersion",Environment.OSVersion.Version.ToString()},{"is64BitOS",Environment.Is64BitOperatingSystem},
            {"clrVersion",Environment.Version.ToString()},{"exeSha256",exeHash},{"skippedJournalLines",skipped},
            {"omissions",omissions},{"automaticUpload",false},{"screenshotsIncluded",false},
            {"personalSettingsIncluded",false},{"note","Review before sharing. A log is an observation, not proof of a completed game transfer."}
        };
        Add(entries,"manifest.json",Json.Serialize(system)+"\n",ref total);
        Add(entries,"READ-ME.txt","AI採掘機 診断パック v"+version+"\n\nこのZIPを問題が起きた時間・作業名・期待した動きと一緒にチャットへ添付してください。\n"
            +"自動送信はしていません。共有前に内容を確認してください。\n"
            +"logs/: 直近の起動・操作・停止・5秒ごとの稼働状態。USER_MARKは利用者の不具合の目印です。\n"
            +"reports/: 補正・近接判定・ルート結果の許可した項目だけ。入力受理と移動確認、転送完了は別です。\n"
            +"last-events.txt: エラー候補と利用者マーク。根本原因の確定ではありません。\n"
            +"保存データ・INI全体・チャット・画像・音声・認証情報・ルート画像は収集対象にしません。\n"
            +"ログは約10MiBまで保持し、古いものから置き換わります。部分的なログはmanifestのomissions/skippedJournalLinesを確認してください。\n",ref total);
        Add(entries,"last-events.txt",String.Join(Environment.NewLine,important)+"\n",ref total);
        var hashes=new StringBuilder();
        foreach(var kv in entries) hashes.AppendLine(Hash(kv.Value)+"  "+kv.Key);
        Add(entries,"SHA256SUMS.txt",hashes.ToString(),ref total);
        string temporary=output+".partial-"+Guid.NewGuid().ToString("N");
        bool own=false;
        try {
            using(var file=new FileStream(temporary,FileMode.CreateNew,FileAccess.Write,FileShare.None)) {
                own=true;
                using(var zip=new ZipArchive(file,ZipArchiveMode.Create,true)) {
                    foreach(var kv in entries) {
                        var entry=zip.CreateEntry(kv.Key,CompressionLevel.Optimal);
                        using(var stream=entry.Open()) stream.Write(kv.Value,0,kv.Value.Length);
                    }
                }
                file.Flush(true);
            }
            using(var verify=ZipFile.OpenRead(temporary)) if(verify.Entries.Count!=entries.Count) throw new InvalidDataException("ZIP count");
            File.Move(temporary,output); own=false;
        } finally { if(own && File.Exists(temporary)) File.Delete(temporary); }
    }
    private static void Add(Dictionary<string,byte[]> entries,string name,string value,ref int total)
    {
        byte[] bytes=Utf8.GetBytes(value);
        if(total+bytes.Length>MaxTotal) throw new InvalidDataException("Bundle budget exceeded");
        entries.Add(name,bytes);total+=bytes.Length;
    }
    private static void Assert(bool condition,string message) {if(!condition) throw new Exception(message);}
    private static void SelfTest()
    {
        string root=Path.Combine(Path.GetTempPath(),"ai-miner-diagnostics-test-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root,"diagnostics"));Directory.CreateDirectory(Path.Combine(root,"exe-routes"));
        try {
            string canary="PRIVATE_CANARY_DO_NOT_EXPORT";
            var ev=new Dictionary<string,object> {{"schema",1},{"event","USER_MARK"},{"seq",1},{"message","C:\\Users\\Alice\\secret.txt"},
                {"reference",canary},{"context",new Dictionary<string,object>{{"mode","washing"},{"rawStoneCount",4},{"password",canary}}}};
            File.WriteAllText(Path.Combine(root,"diagnostics","events.jsonl"),Json.Serialize(ev)+"\n{torn",Utf8);
            File.WriteAllText(Path.Combine(root,"exe-routes","wash-position-last.json"),Json.Serialize(new Dictionary<string,object>{{"result","ERROR FORWARD_NO_OBSERVED_EFFECT"},{"pulses",2},{"inputMs",80},{"inputsReleased",true},{"reference",canary},{"events",new[]{"token="+canary,"W_DOWN 40ms"}}}),Utf8);
            File.WriteAllText(Path.Combine(root,"settings.ini"),canary);File.WriteAllText(Path.Combine(root,"secret.txt"),canary);
            string exe=Path.Combine(root,"sample.exe");File.WriteAllText(exe,"test bytes");
            string output=Path.Combine(root,"support.zip");Export(root,output,exe,"9.1.13");
            using(var zip=ZipFile.OpenRead(output)) {
                Assert(zip.GetEntry("READ-ME.txt")!=null && zip.GetEntry("manifest.json")!=null,"entries");
                foreach(var entry in zip.Entries) using(var reader=new StreamReader(entry.Open(),Utf8)) {
                    string text=reader.ReadToEnd();Assert(!text.Contains(canary)&&!text.Contains("Alice"),"privacy");
                    if(entry.FullName=="manifest.json") Assert(text.Contains("\"skippedJournalLines\":1"),"torn line accounting");
                }
                Assert(zip.GetEntry("settings.ini")==null,"INI excluded");
            }
            string before=Hash(File.ReadAllBytes(output));bool rejected=false;
            try{Export(root,output,exe,"9.1.13");}catch(IOException){rejected=true;}
            Assert(rejected && before==Hash(File.ReadAllBytes(output)),"overwrite refusal");
            Assert(Redact("mail=a@example.test http://127.0.0.1:999/token").IndexOf("example.test",StringComparison.Ordinal)<0,"redact urls and email");
            File.WriteAllText(Path.Combine(root,"exe-routes","wash-nearby-last.json"),"{bad");
            Export(root,Path.Combine(root,"corrupt.zip"),exe,"9.1.13");
            Assert(File.ReadAllText(Path.Combine(root,"settings.ini"))==canary,"original untouched");
            File.WriteAllText(Path.Combine(root,"diagnostics","events.jsonl.4"),new string('X',MaxFile+1));
            Export(root,Path.Combine(root,"oversize.zip"),exe,"9.1.13");
        } finally {Directory.Delete(root,true);}
    }
}
