using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static class CdpBridge
{
    private const string TargetsUrl = "http://127.0.0.1:13172/json";
    private const string TargetFramePart = "cfx-nui-ox_target/web/index.html";
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };
    private static int _nextId = 1;

    public static int Main(string[] args)
    {
        bool nudgeMode = args.Length == 4 && args[0] == "nudge-forward";
        bool twoArgumentMode = args.Length == 2 && (args[0] == "capabilities"
            || args[0] == "probe-mining"
            || args[0] == "click-mining" || args[0] == "probe-washing"
            || args[0] == "click-washing" || args[0] == "probe-gold"
            || args[0] == "click-gold" || args[0] == "activate"
            || args[0] == "deactivate" || args[0] == "deactivate-29200"
            || args[0] == "deactivate-29300");
        int nudgePort = 0;
        int nudgeMilliseconds = 0;
        if (!twoArgumentMode && (!nudgeMode || !Int32.TryParse(args[2], out nudgePort)
            || (nudgePort != 29200 && nudgePort != 29300)
            || !Int32.TryParse(args[3], out nudgeMilliseconds)
            || nudgeMilliseconds < 50 || nudgeMilliseconds > 250))
            return 64;

        string result;
        int exitCode;
        try
        {
            if (args[0] == "capabilities")
            {
                result = "CAPS 3 MINE WASH GOLD NUDGE";
            }
            else if (nudgeMode)
            {
                result = NudgeForward(nudgePort, nudgeMilliseconds);
            }
            else if (args[0] == "activate")
            {
                result = ActivateAsync().GetAwaiter().GetResult();
            }
            else if (args[0].StartsWith("deactivate", StringComparison.Ordinal))
            {
                int selectedPort = args[0].EndsWith("29200", StringComparison.Ordinal) ? 29200
                    : args[0].EndsWith("29300", StringComparison.Ordinal) ? 29300 : 0;
                SendRelease(selectedPort);
                result = "RELEASED";
            }
            else
            {
                result = RunAsync(args[0]).GetAwaiter().GetResult();
            }
            exitCode = result == "CAPS 3 MINE WASH GOLD NUDGE"
                || result.StartsWith("PRESENT ", StringComparison.Ordinal)
                || result.StartsWith("CLICKED ", StringComparison.Ordinal)
                || result.StartsWith("ACTIVATED ", StringComparison.Ordinal)
                || result.StartsWith("NUDGED ", StringComparison.Ordinal)
                || result == "RELEASED" ? 0 : 10;
        }
        catch (Exception ex)
        {
            result = "ERROR " + OneLine(ex.Message);
            exitCode = 2;
        }

        try { File.WriteAllText(args[1], result, new UTF8Encoding(false)); }
        catch { return 3; }
        return exitCode;
    }

    private static async Task<string> RunAsync(string mode)
    {
        string socketUrl = FindRootSocketUrl();
        using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(4)))
        using (var socket = new ClientWebSocket())
        {
            await socket.ConnectAsync(new Uri(socketUrl), timeout.Token).ConfigureAwait(false);
            var frameResponse = await CommandAsync(socket, "Page.getFrameTree", null, timeout.Token).ConfigureAwait(false);
            string frameId = FindTargetFrame(GetObject(GetObject(frameResponse, "result"), "frameTree"));
            if (String.IsNullOrEmpty(frameId))
                throw new InvalidOperationException("ox_target frame not found");

            // 既定worldを使い、数秒ごとのprobeでisolated worldを増やし続けないようにします。
            int contextId = await FindDefaultContextAsync(socket, frameId, timeout.Token).ConfigureAwait(false);

            bool clickMode = mode.StartsWith("click-", StringComparison.Ordinal);
            bool washingMode = mode.EndsWith("washing", StringComparison.Ordinal);
            bool goldMode = mode.EndsWith("gold", StringComparison.Ordinal);
            string targetLabel = washingMode ? "石を洗う"
                : goldMode ? "砂金採りトレイ" : "鉱石を採掘する";
            string actionToken = washingMode ? "WASH" : goldMode ? "GOLD" : "MINE";
            bool exactOnly = washingMode || goldMode;
            string expression = clickMode ? ClickExpression(targetLabel, exactOnly)
                : ProbeExpression(targetLabel, exactOnly);
            var evaluateParams = new Dictionary<string, object>
            {
                { "expression", expression },
                { "contextId", contextId },
                { "returnByValue", true },
                { "awaitPromise", true },
                { "userGesture", clickMode },
                { "includeCommandLineAPI", true }
            };
            var evaluateResponse = await CommandAsync(socket, "Runtime.evaluate", evaluateParams, timeout.Token).ConfigureAwait(false);
            var commandResult = GetObject(evaluateResponse, "result");
            if (commandResult.ContainsKey("exceptionDetails"))
                throw new InvalidOperationException("NUI evaluation failed");
            var remoteObject = GetObject(commandResult, "result");
            bool value = remoteObject.ContainsKey("value") && Convert.ToBoolean(remoteObject["value"]);

            // select callbackは非同期なので、-ox_targetより先にFiveMへ届く時間を確保します。
            if (clickMode && value)
                await Task.Delay(300, timeout.Token).ConfigureAwait(false);

            // 応答取得後は待たずに閉じ、CEFが不調でもマクロのループを止めません。
            try { socket.Abort(); }
            catch { }
            return (value ? (clickMode ? "CLICKED " : "PRESENT ") : "MISSING ") + actionToken;
        }
    }

    private static async Task<string> ActivateAsync()
    {
        SendRelease(0);
        foreach (int port in new[] { 29200, 29300 })
        {
            if (!TrySendDevCon(port, "+ox_target"))
                continue;
            // devconには応答パケットがありません。接続できたクライアントを記録し、
            // UIの出現有無は後続のDOM probeで判定します（石の前でなくても起動可能）。
            await Task.Delay(180).ConfigureAwait(false);
            return "ACTIVATED " + port;
        }
        throw new InvalidOperationException("ox_target activation unavailable");
    }

    private static void SendRelease(int selectedPort)
    {
        if (selectedPort == 29200 || selectedPort == 29300)
        {
            TrySendDevCon(selectedPort, "-ox_target");
            TrySendDevCon(selectedPort, "-move_up_only");
        }
        else
        {
            TrySendDevCon(29200, "-ox_target");
            TrySendDevCon(29300, "-ox_target");
            TrySendDevCon(29200, "-move_up_only");
            TrySendDevCon(29300, "-move_up_only");
        }
    }

    private static string NudgeForward(int port, int milliseconds)
    {
        // down/upを1つのFiveM command bufferへ入れるため、helperが直後に終了しても
        // 最後のreleaseがFiveM側で必ず予約された状態になります。
        string command = "-move_up_only;+move_up_only;wait " + milliseconds + ";-move_up_only";
        if (!TrySendDevCon(port, command))
            throw new InvalidOperationException("FiveM forward input unavailable");
        return "NUDGED " + port;
    }

    private static bool TrySendDevCon(int port, string command, int postWriteDelayMs = 75)
    {
        try
        {
            using (var client = new TcpClient())
            {
                Task connecting = client.ConnectAsync("127.0.0.1", port);
                if (!connecting.Wait(800)) return false;
                byte[] payload = Encoding.UTF8.GetBytes(command + "\0");
                int totalLength = 12 + payload.Length;
                byte[] packet = new byte[totalLength];
                packet[0] = (byte)'C'; packet[1] = (byte)'M';
                packet[2] = (byte)'N'; packet[3] = (byte)'D';
                packet[4] = 0x00; packet[5] = 0xD3;
                packet[6] = (byte)((totalLength >> 24) & 0xFF);
                packet[7] = (byte)((totalLength >> 16) & 0xFF);
                packet[8] = (byte)((totalLength >> 8) & 0xFF);
                packet[9] = (byte)(totalLength & 0xFF);
                packet[10] = 0; packet[11] = 0;
                Buffer.BlockCopy(payload, 0, packet, 12, payload.Length);
                NetworkStream stream = client.GetStream();
                stream.Write(packet, 0, packet.Length);
                stream.Flush();
                if (postWriteDelayMs > 0)
                    Thread.Sleep(postWriteDelayMs);
                return true;
            }
        }
        catch { return false; }
    }

    private static string FindRootSocketUrl()
    {
        string text;
        using (var client = new TimeoutWebClient())
        {
            client.Encoding = Encoding.UTF8;
            text = client.DownloadString(TargetsUrl);
        }
        var targets = Json.DeserializeObject(text) as object[];
        if (targets == null)
            throw new InvalidOperationException("FiveM debug target list unavailable");
        foreach (object item in targets)
        {
            var target = item as Dictionary<string, object>;
            if (target == null) continue;
            string url = GetString(target, "url");
            string socket = GetString(target, "webSocketDebuggerUrl");
            if (url == "nui://game/ui/root.html" && !String.IsNullOrEmpty(socket))
                return socket;
        }
        throw new InvalidOperationException("CitizenFX root UI unavailable");
    }

    private static async Task<Dictionary<string, object>> CommandAsync(
        ClientWebSocket socket, string method, Dictionary<string, object> parameters, CancellationToken token)
    {
        int id = _nextId++;
        var message = new Dictionary<string, object> { { "id", id }, { "method", method } };
        if (parameters != null) message["params"] = parameters;
        byte[] payload = Encoding.UTF8.GetBytes(Json.Serialize(message));
        await socket.SendAsync(new ArraySegment<byte>(payload), WebSocketMessageType.Text, true, token).ConfigureAwait(false);

        while (true)
        {
            string responseText = await ReceiveTextAsync(socket, token).ConfigureAwait(false);
            var response = Json.DeserializeObject(responseText) as Dictionary<string, object>;
            if (response == null || !response.ContainsKey("id") || Convert.ToInt32(response["id"]) != id)
                continue;
            if (response.ContainsKey("error"))
                throw new InvalidOperationException("CDP command failed: " + method);
            return response;
        }
    }

    private static async Task<int> FindDefaultContextAsync(
        ClientWebSocket socket, string frameId, CancellationToken token)
    {
        int id = _nextId++;
        var message = new Dictionary<string, object>
        {
            { "id", id },
            { "method", "Runtime.enable" },
            { "params", new Dictionary<string, object>() }
        };
        byte[] payload = Encoding.UTF8.GetBytes(Json.Serialize(message));
        await socket.SendAsync(new ArraySegment<byte>(payload), WebSocketMessageType.Text, true, token).ConfigureAwait(false);

        bool responseReceived = false;
        int contextId = 0;
        while (!responseReceived || contextId == 0)
        {
            string responseText = await ReceiveTextAsync(socket, token).ConfigureAwait(false);
            var response = Json.DeserializeObject(responseText) as Dictionary<string, object>;
            if (response == null) continue;

            object responseId;
            if (response.TryGetValue("id", out responseId) && Convert.ToInt32(responseId) == id)
            {
                if (response.ContainsKey("error"))
                    throw new InvalidOperationException("CDP command failed: Runtime.enable");
                responseReceived = true;
            }

            if (GetString(response, "method") != "Runtime.executionContextCreated")
                continue;
            try
            {
                var parameters = GetObject(response, "params");
                var context = GetObject(parameters, "context");
                var auxData = GetObject(context, "auxData");
                object isDefaultValue;
                bool isDefault = auxData.TryGetValue("isDefault", out isDefaultValue)
                    && Convert.ToBoolean(isDefaultValue);
                if (isDefault && GetString(auxData, "frameId") == frameId)
                    contextId = Convert.ToInt32(GetValue(context, "id"));
            }
            catch { }
        }
        return contextId;
    }

    private static async Task<string> ReceiveTextAsync(ClientWebSocket socket, CancellationToken token)
    {
        var buffer = new byte[8192];
        using (var stream = new MemoryStream())
        {
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token).ConfigureAwait(false);
                if (result.MessageType == WebSocketMessageType.Close)
                    throw new IOException("CDP socket closed");
                stream.Write(buffer, 0, result.Count);
            } while (!result.EndOfMessage);
            return Encoding.UTF8.GetString(stream.ToArray());
        }
    }

    private static string FindTargetFrame(Dictionary<string, object> frameTree)
    {
        var frame = GetObject(frameTree, "frame");
        if (GetString(frame, "url").IndexOf(TargetFramePart, StringComparison.OrdinalIgnoreCase) >= 0)
            return GetString(frame, "id");
        object childrenObject;
        if (frameTree.TryGetValue("childFrames", out childrenObject))
        {
            var children = childrenObject as object[];
            if (children != null)
            {
                foreach (object child in children)
                {
                    var childDictionary = child as Dictionary<string, object>;
                    if (childDictionary == null) continue;
                    string found = FindTargetFrame(childDictionary);
                    if (!String.IsNullOrEmpty(found)) return found;
                }
            }
        }
        return null;
    }

    private static string ProbeExpression(string targetLabel, bool exactOnly)
    {
        return "(() => {"
            + "const q='" + targetLabel + "',exact=" + (exactOnly ? "true" : "false")
            + ",n=s=>String(s||'').replace(/\\s+/g,' ').trim(),body=document.body;"
            + "if(!body||getComputedStyle(body).visibility!=='visible')return false;"
            + "const root=document.querySelector('#options-wrapper');if(!root)return false;"
            + "const match=t=>exact?t===q:(t===q||t.startsWith(q+' ')||t.startsWith(q+'（')||t.startsWith(q+'('));"
            + "const matches=[...root.querySelectorAll('*')].filter(e=>{const t=n(e.textContent);"
            + "return match(t)&&![...e.children].some(c=>match(n(c.textContent)));});"
            + "if(matches.length!==1)return false;const e=matches[0],s=getComputedStyle(e),r=e.getBoundingClientRect();"
            + "return s.visibility!=='hidden'&&s.display!=='none'&&r.width>0&&r.height>0;})()";
    }

    private static string ClickExpression(string targetLabel, bool exactOnly)
    {
        return "(() => {"
            + "const q='" + targetLabel + "',exact=" + (exactOnly ? "true" : "false")
            + ",n=s=>String(s||'').replace(/\\s+/g,' ').trim(),body=document.body;"
            + "if(!body||getComputedStyle(body).visibility!=='visible')return false;"
            + "const root=document.querySelector('#options-wrapper');if(!root)return false;"
            + "const match=t=>exact?t===q:(t===q||t.startsWith(q+' ')||t.startsWith(q+'（')||t.startsWith(q+'('));"
            + "const matches=[...root.querySelectorAll('*')].filter(e=>{const t=n(e.textContent);"
            + "return match(t)&&![...e.children].some(c=>match(n(c.textContent)));});"
            + "if(matches.length!==1)return false;const leaf=matches[0];"
            + "let hit=leaf.closest('.option-container,li,button,[role=button]')||leaf.closest('a')||leaf;"
            + "const usable=e=>{if(!e||!e.isConnected)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();"
            + "return s.visibility!=='hidden'&&s.display!=='none'&&s.pointerEvents!=='none'&&Number(s.opacity)>0"
            + "&&r.width>0&&r.height>0&&!e.matches(':disabled')&&e.getAttribute('aria-disabled')!=='true';};"
            + "if(!root.contains(hit)||!usable(leaf)||!usable(hit))return false;hit.click();return true;})()";
    }

    private sealed class TimeoutWebClient : WebClient
    {
        protected override WebRequest GetWebRequest(Uri address)
        {
            WebRequest request = base.GetWebRequest(address);
            request.Timeout = 3000;
            var httpRequest = request as HttpWebRequest;
            if (httpRequest != null) httpRequest.ReadWriteTimeout = 3000;
            return request;
        }
    }

    private static Dictionary<string, object> GetObject(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value))
            throw new InvalidOperationException("Missing CDP field: " + key);
        var dictionary = value as Dictionary<string, object>;
        if (dictionary == null)
            throw new InvalidOperationException("Invalid CDP field: " + key);
        return dictionary;
    }

    private static object GetValue(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value))
            throw new InvalidOperationException("Missing CDP field: " + key);
        return value;
    }

    private static string GetString(Dictionary<string, object> source, string key)
    {
        object value;
        return source != null && source.TryGetValue(key, out value) && value != null ? Convert.ToString(value) : "";
    }

    private static string OneLine(string value)
    {
        return (value ?? "unknown").Replace('\r', ' ').Replace('\n', ' ');
    }
}
