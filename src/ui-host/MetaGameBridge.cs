using AiMiner.StoneMetaGame;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace AiMiner.UiHost
{
    internal enum TrustedMetaCommandKind
    {
        SessionBegin,
        MiningSuccess,
        SessionEnd
    }

    internal sealed class TrustedMetaCommand
    {
        internal TrustedMetaCommandKind Kind;
        internal string Id;
        internal DateTimeOffset TimestampUtc;
    }

    internal enum MetaWebRequestKind
    {
        Bootstrap,
        Execute
    }

    internal sealed class MetaWebRequest
    {
        internal MetaWebRequestKind Kind;
        internal string RequestId;
        internal string Action;
        internal string ExecuteJson;
    }

    // Integration-only protocol adapter. Domain behavior remains in the linked, validated
    // StoneMetaGame backend; this class only validates IPC/WebView envelopes and response IDs.
    internal static class MetaGameBridge
    {
        private const int MaximumTrustedMessageCharacters = 1024;
        private const int MaximumUiMessageCharacters = 1024 * 1024;
        // Mining completions are held in the authenticated controller's durable outbox. Preserve
        // their original completedAt across arbitrarily delayed replays so daily statistics stay
        // correct. Sender/session validation protects this boundary and event IDs are the durable
        // idempotency authority; only future timestamps retain a strict clock-skew limit.
        private static readonly TimeSpan MaximumFutureTimestampSkew = TimeSpan.FromMinutes(2);
        private static readonly Regex SafeIdPattern = new Regex(@"\A[A-Za-z0-9._:-]{8,128}\z",
            RegexOptions.CultureInvariant);
        private static readonly HashSet<string> AllowedUiActions = new HashSet<string>(
            new[]
            {
                "gacha.draw", "profile.update", "profile.rename", "profile.appearance",
                "profile.title", "collection.favorite", "collection.acknowledge",
                "reward.claim", "reward.claimAll", "onboarding.complete", "settings.update"
            }, StringComparer.Ordinal);
        internal static bool TryParseTrustedMessage(string message, string expectedUiSession,
            DateTimeOffset receivedAtUtc, out TrustedMetaCommand command)
        {
            command = null;
            if (String.IsNullOrEmpty(message) || message.Length > MaximumTrustedMessageCharacters
                || String.IsNullOrEmpty(expectedUiSession) || !SafeIdPattern.IsMatch(expectedUiSession))
                return false;

            // Tabs make the field count unambiguous and match the existing AIUI1 transport.
            string[] fields = message.Split('\t');
            if (fields.Length != 5
                || !String.Equals(fields[0], "AIUIMETA1", StringComparison.Ordinal)
                || !String.Equals(fields[1], expectedUiSession, StringComparison.Ordinal)
                || !SafeIdPattern.IsMatch(fields[3]))
                return false;

            TrustedMetaCommandKind kind;
            switch (fields[2])
            {
                case "SESSION_BEGIN": kind = TrustedMetaCommandKind.SessionBegin; break;
                case "MINING_SUCCESS": kind = TrustedMetaCommandKind.MiningSuccess; break;
                case "SESSION_END": kind = TrustedMetaCommandKind.SessionEnd; break;
                default: return false;
            }

            long unixMilliseconds;
            if (!Int64.TryParse(fields[4], NumberStyles.None, CultureInfo.InvariantCulture,
                out unixMilliseconds))
                return false;

            DateTimeOffset timestamp;
            try { timestamp = DateTimeOffset.FromUnixTimeMilliseconds(unixMilliseconds); }
            catch (ArgumentOutOfRangeException) { return false; }

            DateTimeOffset received = receivedAtUtc.ToUniversalTime();
            if (timestamp > received + MaximumFutureTimestampSkew)
                return false;

            command = new TrustedMetaCommand
            {
                Kind = kind,
                Id = fields[3],
                TimestampUtc = timestamp
            };
            return true;
        }

        internal static string CommandToken(TrustedMetaCommandKind kind)
        {
            switch (kind)
            {
                case TrustedMetaCommandKind.SessionBegin: return "SESSION_BEGIN";
                case TrustedMetaCommandKind.MiningSuccess: return "MINING_SUCCESS";
                case TrustedMetaCommandKind.SessionEnd: return "SESSION_END";
                default: throw new ArgumentOutOfRangeException(nameof(kind));
            }
        }

        // recognized=false means this belongs to the existing UI protocol. A recognized but
        // invalid metagame request is never allowed to fall through to the farm command parser.
        internal static bool TryParseWebRequest(string json, out bool recognized,
            out MetaWebRequest request, out string error)
        {
            recognized = false;
            request = null;
            error = null;
            try
            {
                if (String.IsNullOrEmpty(json) || json.Length > MaximumUiMessageCharacters)
                    return false;
                JavaScriptSerializer serializer = CreateSerializer();
                Dictionary<string, object> root = serializer.DeserializeObject(json)
                    as Dictionary<string, object>;
                if (root == null) return false;
                object typeValue;
                string type = root.TryGetValue("type", out typeValue) ? typeValue as string : null;
                if (type == null || !type.StartsWith("meta.", StringComparison.Ordinal)) return false;
                recognized = true;

                if (type == "meta.bootstrap")
                {
                    EnsureOnly(root, "type", "requestId");
                    request = new MetaWebRequest
                    {
                        Kind = MetaWebRequestKind.Bootstrap,
                        RequestId = SafeId(root, "requestId")
                    };
                    return true;
                }

                if (type == "meta.execute")
                {
                    EnsureOnly(root, "type", "requestId", "action", "payload");
                    request = new MetaWebRequest
                    {
                        Kind = MetaWebRequestKind.Execute,
                        RequestId = SafeId(root, "requestId")
                    };
                    string action = StringValue(root, "action", 64);
                    if (!AllowedUiActions.Contains(action))
                        throw new FormatException("META_ACTION_NOT_ALLOWED");
                    request.Action = action;
                    Dictionary<string, object> payload = ObjectValue(root, "payload");
                    request.ExecuteJson = serializer.Serialize(new Dictionary<string, object>
                    {
                        { "action", action }, { "payload", payload }
                    });
                    return true;
                }

                throw new FormatException("UNKNOWN_META_MESSAGE");
            }
            catch (Exception exception)
            {
                error = Protocol.SanitizeDiagnostic(exception.Message);
                return false;
            }
        }

        internal static string BuildBootstrapResponse(string requestId, string bootstrapJson)
        {
            return BuildResponse(requestId, CreateSerializer().DeserializeObject(bootstrapJson));
        }

        internal static string BuildExecuteResponse(string requestId, string mutationJson)
        {
            Dictionary<string, object> envelope = CreateSerializer().DeserializeObject(mutationJson)
                as Dictionary<string, object>;
            object result;
            if (envelope == null || !envelope.TryGetValue("result", out result))
                throw new FormatException("INVALID_META_RESULT");
            return BuildResponse(requestId, result);
        }

        internal static string BuildErrorResponse(string requestId, string error)
        {
            return BuildResponse(requestId, new Dictionary<string, object>
            {
                { "ok", false }, { "error", Protocol.SanitizeDiagnostic(error) }
            });
        }

        internal static bool RunSelfTests(string assetsPath, out string error)
        {
            error = null;
            string temporaryRoot = Path.Combine(Path.GetTempPath(),
                "ai-miner-meta-test-" + Guid.NewGuid().ToString("N"));
            try
            {
                ValidateIntegratedAssets(assetsPath);
                DateTimeOffset now = DateTimeOffset.UtcNow;
                string session = "ui-session-0001";
                string timestamp = now.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
                TrustedMetaCommand command;
                if (!TryParseTrustedMessage("AIUIMETA1\t" + session
                    + "\tMINING_SUCCESS\tmine:1:reward:1\t" + timestamp,
                    session, now, out command)
                    || command.Kind != TrustedMetaCommandKind.MiningSuccess
                    || command.Id != "mine:1:reward:1")
                    throw new InvalidOperationException("trusted mining fixture was rejected");
                if (TryParseTrustedMessage("AIUIMETA1\twrong-session\tMINING_SUCCESS"
                    + "\tmine:1:reward:1\t" + timestamp, session, now, out command))
                    throw new InvalidOperationException("wrong UI session was accepted");
                if (TryParseTrustedMessage("AIUIMETA1\t" + session
                    + "\tMINING_SUCCESS\t採掘イベント\t" + timestamp,
                    session, now, out command))
                    throw new InvalidOperationException("non-ASCII event ID was accepted");
                if (TryParseTrustedMessage("AIUIMETA1\t" + session
                    + "\tMINING_SUCCESS\tmine:1:reward:1\t" + timestamp + "\textra",
                    session, now, out command))
                    throw new InvalidOperationException("extra trusted field was accepted");
                string durable = now.Subtract(TimeSpan.FromDays(365)).ToUnixTimeMilliseconds()
                    .ToString(CultureInfo.InvariantCulture);
                if (!TryParseTrustedMessage("AIUIMETA1\t" + session
                    + "\tMINING_SUCCESS\tmine:durable:0001\t" + durable,
                    session, now, out command))
                    throw new InvalidOperationException("durable trusted replay was rejected");
                if (!TryParseTrustedMessage("AIUIMETA1\t" + session
                    + "\tMINING_SUCCESS\tmine:epoch:0001\t0",
                    session, now, out command)
                    || command.TimestampUtc != DateTimeOffset.FromUnixTimeMilliseconds(0))
                    throw new InvalidOperationException("Unix epoch replay boundary was rejected");
                string futureBoundary = now.Add(MaximumFutureTimestampSkew)
                    .ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
                if (!TryParseTrustedMessage("AIUIMETA1\t" + session
                    + "\tMINING_SUCCESS\tmine:future:edge\t" + futureBoundary,
                    session, now, out command))
                    throw new InvalidOperationException("future skew boundary was rejected");
                string future = now.Add(MaximumFutureTimestampSkew).AddMilliseconds(1)
                    .ToUnixTimeMilliseconds()
                    .ToString(CultureInfo.InvariantCulture);
                if (TryParseTrustedMessage("AIUIMETA1\t" + session
                    + "\tMINING_SUCCESS\tmine:future:0001\t" + future,
                    session, now, out command))
                    throw new InvalidOperationException("future trusted timestamp was accepted");
                if (TryParseTrustedMessage("AIUIMETA1\t" + session
                    + "\tMINING_SUCCESS\tmine:range:0001\t253402300800000",
                    session, now, out command))
                    throw new InvalidOperationException("out-of-range Unix timestamp was accepted");
                if (CommandToken(TrustedMetaCommandKind.SessionBegin) != "SESSION_BEGIN"
                    || CommandToken(TrustedMetaCommandKind.MiningSuccess) != "MINING_SUCCESS"
                    || CommandToken(TrustedMetaCommandKind.SessionEnd) != "SESSION_END")
                    throw new InvalidOperationException("trusted ACK command token changed");

                bool recognized;
                MetaWebRequest webRequest;
                string parseError;
                if (!TryParseWebRequest("{\"type\":\"meta.bootstrap\",\"requestId\":\"request:0001\"}",
                    out recognized, out webRequest, out parseError)
                    || !recognized || webRequest.Kind != MetaWebRequestKind.Bootstrap)
                    throw new InvalidOperationException("bootstrap request fixture was rejected");
                if (!TryParseWebRequest("{\"type\":\"meta.execute\",\"requestId\":\"request:0002\","
                    + "\"action\":\"collection.favorite\",\"payload\":{\"itemId\":\"stone-001\","
                    + "\"favorite\":true}}", out recognized, out webRequest, out parseError)
                    || !recognized || webRequest.Kind != MetaWebRequestKind.Execute)
                    throw new InvalidOperationException("execute request fixture was rejected");
                if (TryParseWebRequest("{\"type\":\"meta.execute\",\"requestId\":\"request:0003\","
                    + "\"action\":\"debug.setMined\",\"payload\":{\"total\":99}}",
                    out recognized, out webRequest, out parseError) || !recognized
                    || webRequest == null || webRequest.RequestId != "request:0003")
                    throw new InvalidOperationException("debug WebView action was accepted");

                Directory.CreateDirectory(temporaryRoot);
                string dataPath = Path.Combine(assetsPath, "metagame", "data");
                string statePath = Path.Combine(temporaryRoot, "state.json");
                StoneMetaGameHost host = new StoneMetaGameHost(dataPath, statePath, false);
                host.BeginMiningSessionJson("session:integration:1", now);
                string[] verifiedWorkIds =
                {
                    "work:mining:integration:1",
                    "work:washing:integration:2",
                    "work:gold:integration:3"
                };
                for (int index = 0; index < verifiedWorkIds.Length; index++)
                    host.RecordVerifiedMiningSuccessJson(verifiedWorkIds[index],
                        now.AddMilliseconds(index + 1));
                for (int index = verifiedWorkIds.Length - 1; index >= 0; index--)
                    host.RecordVerifiedMiningSuccessJson(verifiedWorkIds[index],
                        now.AddMilliseconds(20 + index));
                if (host.Service.GetSnapshot().Mining.TotalStoneMined != 3)
                    throw new InvalidOperationException(
                        "verified mining, washing, and gold events were not idempotent");
                for (int index = 4; index <= 10; index++)
                {
                    string eventId = "work:mining:integration:"
                        + index.ToString(CultureInfo.InvariantCulture);
                    host.RecordVerifiedMiningSuccessJson(eventId, now.AddMilliseconds(index));
                }
                if (host.Service.GetSnapshot().Mining.TotalStoneMined != 10)
                    throw new InvalidOperationException(
                        "ten unique verified work events did not produce ten records");
                host.EndMiningSessionJson("session:integration:1", now.AddSeconds(1));
                host = new StoneMetaGameHost(dataPath, statePath, false);
                if (host.Service.GetSnapshot().Mining.TotalStoneMined != 10)
                    throw new InvalidOperationException("integrated state was not restored after restart");

                // A replay older than the former 30-day limit must retain its original local day,
                // increment once, and remain idempotent after persistence/restart.
                DateTimeOffset historicCompletedAt = now.Subtract(TimeSpan.FromDays(365));
                string historicDay = TimeZoneInfo.ConvertTime(historicCompletedAt,
                    TimeZoneInfo.Local).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                string historicStatePath = Path.Combine(temporaryRoot, "historic-state.json");
                StoneMetaGameHost historicHost = new StoneMetaGameHost(dataPath,
                    historicStatePath, false);
                historicHost.RecordVerifiedMiningSuccessJson("mine:historic:0001",
                    historicCompletedAt);
                historicHost.RecordVerifiedMiningSuccessJson("mine:historic:0001",
                    historicCompletedAt);
                MetaGameSnapshot historicSnapshot = historicHost.Service.GetSnapshot();
                long historicDaily;
                if (historicSnapshot.Mining.TotalStoneMined != 1
                    || !historicSnapshot.Mining.DailyTotals.TryGetValue(historicDay,
                        out historicDaily)
                    || historicDaily != 1)
                    throw new InvalidOperationException(
                        "historic replay was not deduplicated on its original day");
                historicHost = new StoneMetaGameHost(dataPath, historicStatePath, false);
                historicSnapshot = historicHost.Service.GetSnapshot();
                if (historicSnapshot.Mining.TotalStoneMined != 1
                    || !historicSnapshot.Mining.DailyTotals.TryGetValue(historicDay,
                        out historicDaily)
                    || historicDaily != 1)
                    throw new InvalidOperationException(
                        "historic replay totals were not restored after restart");
                string debugResult = host.ExecuteUiJson(
                    "{\"action\":\"debug.setMined\",\"payload\":{\"total\":99}}");
                if (debugResult.IndexOf("DEBUG_ACTION_DISABLED", StringComparison.Ordinal) < 0)
                    throw new InvalidOperationException("production host accepted a debug action");
                if (!File.Exists(statePath))
                    throw new InvalidOperationException("metagame state was not saved");
                return true;
            }
            catch (Exception exception)
            {
                error = "metagame bridge self-test failed: "
                    + Protocol.SanitizeDiagnostic(exception.Message);
                return false;
            }
            finally
            {
                try
                {
                    if (Directory.Exists(temporaryRoot)) Directory.Delete(temporaryRoot, true);
                }
                catch { }
            }
        }

        private static string BuildResponse(string requestId, object result)
        {
            if (!SafeIdPattern.IsMatch(requestId ?? String.Empty))
                throw new FormatException("INVALID_META_REQUEST_ID");
            return CreateSerializer().Serialize(new Dictionary<string, object>
            {
                { "type", "meta.response" }, { "requestId", requestId }, { "result", result }
            });
        }

        private static JavaScriptSerializer CreateSerializer()
        {
            return new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };
        }

        private static void ValidateIntegratedAssets(string assetsPath)
        {
            string[] required =
            {
                "meta-game.js", "meta-game.css", "meta-game-template.html",
                "meta-game-adapter.js", "meta-game-entry.js", "demo-adapter.js",
                "data/achievements.json", "data/affinity.json", "data/assets.json",
                "data/banners.json", "data/gacha.json", "data/items.json",
                "data/level-rewards.json", "data/messages.json", "data/titles.json"
            };
            string root = Path.GetFullPath(Path.Combine(assetsPath, "metagame")
                + Path.DirectorySeparatorChar);
            foreach (string relative in required)
            {
                string path = Path.GetFullPath(Path.Combine(root,
                    relative.Replace('/', Path.DirectorySeparatorChar)));
                if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("metagame asset escaped its root");
                FileInfo file = new FileInfo(path);
                if (!file.Exists || file.Length <= 0 || file.Length > 4L * 1024L * 1024L
                    || (file.Attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException("metagame asset is missing or invalid: " + relative);
                // Reject malformed text before WebView2 or the catalog loader observes it.
                new System.Text.UTF8Encoding(false, true).GetString(File.ReadAllBytes(path));
            }
        }

        private static string SafeId(Dictionary<string, object> values, string key)
        {
            string value = StringValue(values, key, 128);
            if (!SafeIdPattern.IsMatch(value)) throw new FormatException("INVALID_META_REQUEST_ID");
            return value;
        }

        private static string StringValue(Dictionary<string, object> values, string key, int maximum)
        {
            object raw;
            string value = values.TryGetValue(key, out raw) ? raw as string : null;
            if (String.IsNullOrEmpty(value) || value.Length > maximum || value.IndexOf('\0') >= 0)
                throw new FormatException("INVALID_META_STRING_" + key);
            return value;
        }

        private static Dictionary<string, object> ObjectValue(Dictionary<string, object> values, string key)
        {
            object raw;
            Dictionary<string, object> result = values.TryGetValue(key, out raw)
                ? raw as Dictionary<string, object> : null;
            if (result == null) throw new FormatException("INVALID_META_OBJECT_" + key);
            return result;
        }

        private static void EnsureOnly(Dictionary<string, object> value, params string[] keys)
        {
            HashSet<string> expected = new HashSet<string>(keys, StringComparer.Ordinal);
            if (value.Count != expected.Count || value.Keys.Any(key => !expected.Contains(key)))
                throw new FormatException("INVALID_META_ENVELOPE");
        }
    }
}
