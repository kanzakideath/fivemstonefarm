using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace AiMiner.UiHost
{
    internal static class Protocol
    {
        internal const int WmCopyData = 0x004A;
        internal static readonly IntPtr CopyDataTag = new IntPtr(0x31495541); // "AIU1"
        private const int MaximumWebMessageCharacters = 16 * 1024;
        private const int MaximumStateCharacters = 256 * 1024;
        private const int MaximumProtocolArgumentCharacters = 512;

        internal static bool TryTranslateWebMessage(string json, out string action,
            out IList<string> arguments, out string error)
        {
            action = null;
            arguments = null;
            error = null;
            try
            {
                if (String.IsNullOrEmpty(json) || json.Length > MaximumWebMessageCharacters)
                    throw new FormatException("Web message is empty or too large.");
                JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = MaximumWebMessageCharacters };
                Dictionary<string, object> envelope = serializer.DeserializeObject(json) as Dictionary<string, object>;
                if (envelope == null)
                    throw new FormatException("Web message root must be an object.");
                EnsureOnlyKeys(envelope, "type", "action", "payload");
                if (!GetRequiredString(envelope, "type").Equals("action", StringComparison.Ordinal))
                    throw new FormatException("Web message type is not allowed.");
                action = GetRequiredString(envelope, "action");
                Dictionary<string, object> payload = GetRequiredObject(envelope, "payload");
                List<string> values = new List<string>();

                switch (action)
                {
                    case "hello":
                        EnsureOnlyKeys(payload, "schema", "framework", "frameworkVersion", "fixture");
                        if (!IsIntegerValue(payload["schema"], 1)
                            || !String.Equals(GetSafeString(payload, "framework", 32), "Framework7", StringComparison.Ordinal)
                            || !String.Equals(GetSafeString(payload, "frameworkVersion", 32), "9.1.3", StringComparison.Ordinal))
                            throw new FormatException("UI handshake is incompatible.");
                        values.Add("1");
                        values.Add("Framework7");
                        values.Add("9.1.3");
                        values.Add(GetBoolean(payload, "fixture") ? "1" : "0");
                        break;

                    case "run.toggle":
                    case "washing.fast.start":
                    case "vehicle.register":
                    case "vehicle.route":
                    case "vehicle.delete":
                    case "update.check":
                    case "diagnostics.mark":
                    case "diagnostics.export":
                    case "window.close":
                        EnsureOnlyKeys(payload);
                        break;

                    case "diagnostics.clientError":
                        EnsureOnlyKeys(payload, "message");
                        values.Add(GetSafeString(payload, "message", 400));
                        break;

                    case "nav":
                        EnsureOnlyKeys(payload, "page");
                        values.Add(GetEnum(payload, "page", "overview", "stone", "vehicle", "routes", "settings", "update"));
                        break;

                    case "route.teach":
                    case "route.trial":
                    case "route.stationary":
                    case "action.select":
                        EnsureOnlyKeys(payload, "mode");
                        values.Add(GetEnum(payload, "mode", "mining", "washing", "gold"));
                        break;

                    case "washing.fast.toggle":
                    case "vehicle.toggle":
                        EnsureOnlyKeys(payload, "enabled");
                        values.Add(GetBoolean(payload, "enabled") ? "1" : "0");
                        break;

                    case "update.install":
                        EnsureOnlyKeys(payload, "version");
                        values.Add(GetStableVersion(payload, "version"));
                        break;

                    case "settings.save":
                        EnsureOnlyKeys(payload, "startHotkey", "stopHotkey", "backgroundMode",
                            "hideWhileRunning", "correctionEnabled", "autoEat", "foodKey",
                            "autoCheckUpdates", "minimumFreeWeight", "storageTriggerPercent",
                            "estimatedRewardWeight", "minimumFreeSlots", "storageMaxRetries",
                            "farmWatchdogMs", "targetLostRecoveryMs", "debugOverlay");
                        values.Add(GetSafeString(payload, "startHotkey", 64));
                        values.Add(GetSafeString(payload, "stopHotkey", 64));
                        values.Add(GetBoolean(payload, "backgroundMode") ? "1" : "0");
                        values.Add(GetBoolean(payload, "hideWhileRunning") ? "1" : "0");
                        values.Add(GetBoolean(payload, "correctionEnabled") ? "1" : "0");
                        values.Add(GetBoolean(payload, "autoEat") ? "1" : "0");
                        values.Add(GetInteger(payload, "foodKey", 1, 5)
                            .ToString(CultureInfo.InvariantCulture));
                        values.Add(GetBoolean(payload, "autoCheckUpdates") ? "1" : "0");
                        values.Add(GetInteger(payload, "minimumFreeWeight", 250, 20000)
                            .ToString(CultureInfo.InvariantCulture));
                        values.Add(GetInteger(payload, "storageTriggerPercent", 50, 99)
                            .ToString(CultureInfo.InvariantCulture));
                        values.Add(GetInteger(payload, "estimatedRewardWeight", 250, 20000)
                            .ToString(CultureInfo.InvariantCulture));
                        values.Add(GetInteger(payload, "minimumFreeSlots", 0, 10)
                            .ToString(CultureInfo.InvariantCulture));
                        values.Add(GetInteger(payload, "storageMaxRetries", 1, 8)
                            .ToString(CultureInfo.InvariantCulture));
                        values.Add(GetInteger(payload, "farmWatchdogMs", 15000, 180000)
                            .ToString(CultureInfo.InvariantCulture));
                        values.Add(GetInteger(payload, "targetLostRecoveryMs", 5000, 60000)
                            .ToString(CultureInfo.InvariantCulture));
                        values.Add(GetBoolean(payload, "debugOverlay") ? "1" : "0");
                        break;

                    case "smoke.result":
                        EnsureOnlyKeys(payload, "result");
                        values.Add(GetSafeString(payload, "result", MaximumProtocolArgumentCharacters));
                        break;

                    default:
                        throw new FormatException("Web action is not allowed.");
                }

                arguments = values;
                return true;
            }
            catch (Exception ex)
            {
                action = null;
                arguments = null;
                error = SanitizeDiagnostic(ex.Message);
                return false;
            }
        }

        internal static string BuildActionLine(string session, string action, IList<string> arguments)
        {
            StringBuilder builder = new StringBuilder("AIUI1\t");
            builder.Append(SanitizeArgument(session, 128));
            builder.Append('\t');
            builder.Append(SanitizeArgument(action, 64));
            for (int i = 0; i < arguments.Count; i++)
            {
                builder.Append('\t');
                builder.Append(SanitizeArgument(arguments[i], MaximumProtocolArgumentCharacters));
            }
            return builder.ToString();
        }

        internal static bool TryParseBackendMessage(string message, string session,
            out BackendMessage backendMessage)
        {
            backendMessage = null;
            if (String.IsNullOrEmpty(message) || message.Length > MaximumStateCharacters + 256)
                return false;
            string[] parts = message.Split(new[] { '\t' }, 3);
            if (parts.Length != 3 || !String.Equals(parts[1], session, StringComparison.Ordinal))
                return false;

            if (parts[0] == "AIUICMD1")
            {
                if (parts[2] != "SHOW" && parts[2] != "SHOWNOACTIVATE" && parts[2] != "HIDE"
                    && parts[2] != "EXIT" && parts[2] != "SMOKE")
                    return false;
                backendMessage = new BackendMessage { Kind = BackendMessageKind.Command, Value = parts[2] };
                return true;
            }

            if (parts[0] != "AIUISTATE1" || parts[2].Length > MaximumStateCharacters)
                return false;
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = MaximumStateCharacters };
                Dictionary<string, object> state = serializer.DeserializeObject(parts[2]) as Dictionary<string, object>;
                object type;
                object revision;
                if (state == null || !state.TryGetValue("type", out type) || !(type is string)
                    || !String.Equals((string)type, "state", StringComparison.Ordinal)
                    || !state.TryGetValue("revision", out revision) || !IsIntegerValue(revision, null))
                    return false;
                backendMessage = new BackendMessage { Kind = BackendMessageKind.State, Value = parts[2] };
                return true;
            }
            catch
            {
                return false;
            }
        }

        internal static string SanitizeDiagnostic(string text)
        {
            if (String.IsNullOrEmpty(text)) return "unknown";
            string result = text.Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' ').Replace('\0', ' ').Trim();
            return result.Length <= 300 ? result : result.Substring(0, 300);
        }

        internal static bool IsIntegerValue(object value, int? required)
        {
            long converted;
            if (value is int) converted = (int)value;
            else if (value is long) converted = (long)value;
            else if (value is short) converted = (short)value;
            else if (value is byte) converted = (byte)value;
            else return false;
            return !required.HasValue || converted == required.Value;
        }

        internal static bool RunSelfTests(out string error)
        {
            error = null;
            try
            {
                AssertAction(@"{""type"":""action"",""action"":""hello"",""payload"":{""schema"":1,""framework"":""Framework7"",""frameworkVersion"":""9.1.3"",""fixture"":false}}",
                    "hello", new[] { "1", "Framework7", "9.1.3", "0" });
                AssertAction(@"{""type"":""action"",""action"":""nav"",""payload"":{""page"":""vehicle""}}",
                    "nav", new[] { "vehicle" });
                AssertAction(@"{""type"":""action"",""action"":""nav"",""payload"":{""page"":""stone""}}",
                    "nav", new[] { "stone" });
                AssertAction(@"{""type"":""action"",""action"":""nav"",""payload"":{""page"":""overview""}}",
                    "nav", new[] { "overview" });
                AssertAction(@"{""type"":""action"",""action"":""action.select"",""payload"":{""mode"":""gold""}}",
                    "action.select", new[] { "gold" });
                AssertAction(@"{""type"":""action"",""action"":""vehicle.toggle"",""payload"":{""enabled"":true}}",
                    "vehicle.toggle", new[] { "1" });
                AssertAction(@"{""type"":""action"",""action"":""vehicle.register"",""payload"":{}}",
                    "vehicle.register", new string[0]);
                AssertAction(@"{""type"":""action"",""action"":""nav"",""payload"":{""page"":""routes""}}",
                    "nav", new[] { "routes" });
                AssertAction(@"{""type"":""action"",""action"":""route.teach"",""payload"":{""mode"":""washing""}}",
                    "route.teach", new[] { "washing" });
                AssertAction(@"{""type"":""action"",""action"":""route.trial"",""payload"":{""mode"":""gold""}}",
                    "route.trial", new[] { "gold" });
                AssertAction(@"{""type"":""action"",""action"":""vehicle.route"",""payload"":{}}",
                    "vehicle.route", new string[0]);
                AssertAction(@"{""type"":""action"",""action"":""diagnostics.export"",""payload"":{}}", "diagnostics.export", new string[0]);
                AssertRejected(@"{""type"":""action"",""action"":""diagnostics.export"",""payload"":{""path"":""secret""}}");
                AssertAction(@"{""type"":""action"",""action"":""diagnostics.mark"",""payload"":{}}", "diagnostics.mark", new string[0]);
                AssertAction(@"{""type"":""action"",""action"":""route.stationary"",""payload"":{""mode"":""washing""}}",
                    "route.stationary", new[] { "washing" });
                AssertRejected(@"{""type"":""action"",""action"":""route.stationary"",""payload"":{""mode"":""external""}}");
                AssertRejected(@"{""type"":""action"",""action"":""route.teach"",""payload"":{""mode"":""external""}}");
                AssertRejected(@"{""type"":""action"",""action"":""route.trial"",""payload"":{""mode"":""gold"",""command"":""bad""}}");
                AssertAction(@"{""type"":""action"",""action"":""washing.fast.start"",""payload"":{}}",
                    "washing.fast.start", new string[0]);
                AssertAction(@"{""type"":""action"",""action"":""washing.fast.toggle"",""payload"":{""enabled"":true}}",
                    "washing.fast.toggle", new[] { "1" });
                AssertAction(@"{""type"":""action"",""action"":""washing.fast.toggle"",""payload"":{""enabled"":false}}",
                    "washing.fast.toggle", new[] { "0" });
                AssertRejected(@"{""type"":""action"",""action"":""washing.fast.start"",""payload"":{""enabled"":true}}");
                AssertRejected(@"{""type"":""action"",""action"":""washing.fast.toggle"",""payload"":{}}");
                AssertAction(@"{""type"":""action"",""action"":""update.install"",""payload"":{""version"":""9.1.15""}}",
                    "update.install", new[] { "9.1.15" });
                AssertRejected(@"{""type"":""action"",""action"":""update.install"",""payload"":{""version"":""9.1.15-beta""}}");
                AssertRejected(@"{""type"":""action"",""action"":""update.install"",""payload"":{""version"":""../9.1.15""}}");
                AssertRejected(@"{""type"":""action"",""action"":""update.install"",""payload"":{""version"":""9.1.15"",""url"":""https://example.invalid""}}");
                const string settingsFixture = @"{""type"":""action"",""action"":""settings.save"",""payload"":{""startHotkey"":""F8"",""stopHotkey"":""F9"",""backgroundMode"":true,""hideWhileRunning"":false,""correctionEnabled"":true,""autoEat"":true,""foodKey"":1,""autoCheckUpdates"":true,""minimumFreeWeight"":2000,""storageTriggerPercent"":90,""estimatedRewardWeight"":2000,""minimumFreeSlots"":1,""storageMaxRetries"":3,""farmWatchdogMs"":45000,""targetLostRecoveryMs"":12000,""debugOverlay"":false}}";
                AssertAction(settingsFixture,
                    "settings.save", new[] { "F8", "F9", "1", "0", "1", "1", "1", "1", "2000",
                        "90", "2000", "1", "3", "45000", "12000", "0" });
                AssertRejected(@"{""type"":""action"",""action"":""unknown"",""payload"":{}}");
                AssertRejected(@"{""type"":""action"",""action"":""nav"",""payload"":{""page"":""external""}}");
                AssertRejected(settingsFixture.Replace(@"""startHotkey"":""F8""",
                    @"""startHotkey"":""F8\tBAD"""));
                AssertRejected(settingsFixture.Replace(@"""foodKey"":1", @"""foodKey"":6"));
                AssertRejected(settingsFixture.Replace(@"""storageTriggerPercent"":90",
                    @"""storageTriggerPercent"":49"));
                AssertRejected(settingsFixture.Replace(@"""estimatedRewardWeight"":2000",
                    @"""estimatedRewardWeight"":249"));
                AssertRejected(settingsFixture.Replace(@"""minimumFreeSlots"":1",
                    @"""minimumFreeSlots"":11"));
                AssertRejected(settingsFixture.Replace(@"""storageMaxRetries"":3",
                    @"""storageMaxRetries"":9"));
                AssertRejected(settingsFixture.Replace(@"""farmWatchdogMs"":45000",
                    @"""farmWatchdogMs"":14999"));
                AssertRejected(settingsFixture.Replace(@"""targetLostRecoveryMs"":12000",
                    @"""targetLostRecoveryMs"":60001"));
                AssertRejected(settingsFixture.Replace(@"""debugOverlay"":false",
                    @"""debugOverlay"":0"));

                string session = "0123456789abcdef";
                BackendMessage parsed;
                if (!TryParseBackendMessage("AIUISTATE1\t" + session
                    + "\t{\"type\":\"state\",\"revision\":1}", session, out parsed)
                    || parsed.Kind != BackendMessageKind.State)
                    throw new InvalidOperationException("State protocol fixture failed.");
                if (!TryParseBackendMessage("AIUICMD1\t" + session + "\tSMOKE", session, out parsed)
                    || parsed.Kind != BackendMessageKind.Command || parsed.Value != "SMOKE")
                    throw new InvalidOperationException("Command protocol fixture failed.");
                if (TryParseBackendMessage("AIUISTATE1\twrong-session\t{\"type\":\"state\",\"revision\":1}",
                    session, out parsed))
                    throw new InvalidOperationException("Wrong-session fixture was accepted.");
                if (TryParseBackendMessage("AIUISTATE1\t" + session
                    + "\t{\"type\":\"state\",\"revision\":1.5}", session, out parsed))
                    throw new InvalidOperationException("Fractional revision fixture was accepted.");
                string resetToken = "0123456789abcdef0123456789abcdef:7";
                string reset = BuildActionLine(session, "meta.reset", new[] { resetToken });
                if (reset != "AIUI1\t" + session + "\tmeta.reset\t" + resetToken)
                    throw new InvalidOperationException("Metagame recovery reset fixture failed.");
                string metaAck = BuildActionLine(session, "meta.ack",
                    new[] { "MINING_SUCCESS", "mine:00000001" });
                if (metaAck != "AIUI1\t" + session
                    + "\tmeta.ack\tMINING_SUCCESS\tmine:00000001")
                    throw new InvalidOperationException("Metagame typed ACK fixture failed.");
                return true;
            }
            catch (Exception ex)
            {
                error = SanitizeDiagnostic(ex.Message);
                return false;
            }
        }

        private static void AssertAction(string json, string expectedAction, string[] expectedArguments)
        {
            string action;
            IList<string> arguments;
            string error;
            if (!TryTranslateWebMessage(json, out action, out arguments, out error)
                || !String.Equals(action, expectedAction, StringComparison.Ordinal)
                || arguments.Count != expectedArguments.Length)
                throw new InvalidOperationException("Valid action fixture failed: " + expectedAction);
            for (int i = 0; i < expectedArguments.Length; i++)
                if (!String.Equals(arguments[i], expectedArguments[i], StringComparison.Ordinal))
                    throw new InvalidOperationException("Action argument fixture failed: " + expectedAction);
        }

        private static void AssertRejected(string json)
        {
            string action;
            IList<string> arguments;
            string error;
            if (TryTranslateWebMessage(json, out action, out arguments, out error))
                throw new InvalidOperationException("Invalid action fixture was accepted.");
        }

        private static string GetRequiredString(Dictionary<string, object> values, string key)
        {
            object value;
            if (!values.TryGetValue(key, out value) || !(value is string) || String.IsNullOrEmpty((string)value))
                throw new FormatException("Missing or invalid field: " + key);
            return (string)value;
        }

        private static Dictionary<string, object> GetRequiredObject(Dictionary<string, object> values, string key)
        {
            object value;
            Dictionary<string, object> result;
            if (!values.TryGetValue(key, out value) || (result = value as Dictionary<string, object>) == null)
                throw new FormatException("Missing or invalid object: " + key);
            return result;
        }

        private static string GetSafeString(Dictionary<string, object> values, string key, int maximumLength)
        {
            return SanitizeArgument(GetRequiredString(values, key), maximumLength);
        }

        private static string GetEnum(Dictionary<string, object> values, string key, params string[] allowed)
        {
            string value = GetSafeString(values, key, 64);
            for (int i = 0; i < allowed.Length; i++)
                if (String.Equals(value, allowed[i], StringComparison.Ordinal)) return value;
            throw new FormatException("Field is outside its allowlist: " + key);
        }

        private static string GetStableVersion(Dictionary<string, object> values, string key)
        {
            string value = GetSafeString(values, key, 32);
            if (!Regex.IsMatch(value,
                @"^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$",
                RegexOptions.CultureInvariant))
                throw new FormatException("Version must be a stable semantic version.");
            return value;
        }

        private static bool GetBoolean(Dictionary<string, object> values, string key)
        {
            object value;
            if (!values.TryGetValue(key, out value) || !(value is bool))
                throw new FormatException("Missing or invalid boolean: " + key);
            return (bool)value;
        }

        private static int GetInteger(Dictionary<string, object> values, string key, int minimum, int maximum)
        {
            object value;
            if (!values.TryGetValue(key, out value) || !IsIntegerValue(value, null))
                throw new FormatException("Missing or invalid integer: " + key);
            long converted = value is int ? (int)value : (long)value;
            if (converted < minimum || converted > maximum)
                throw new FormatException("Integer is outside its allowed range: " + key);
            return checked((int)converted);
        }

        private static string SanitizeArgument(string value, int maximumLength)
        {
            if (String.IsNullOrEmpty(value) || value.Length > maximumLength
                || value.IndexOfAny(new[] { '\t', '\r', '\n', '\0' }) >= 0)
                throw new FormatException("Protocol argument contains forbidden characters or has an invalid length.");
            return value;
        }

        private static void EnsureOnlyKeys(Dictionary<string, object> values, params string[] allowed)
        {
            HashSet<string> allowedSet = new HashSet<string>(allowed, StringComparer.Ordinal);
            foreach (string key in values.Keys)
                if (!allowedSet.Contains(key)) throw new FormatException("Unexpected field: " + key);
            if (values.Count != allowedSet.Count)
                throw new FormatException("A required field is missing.");
        }
    }

    internal enum BackendMessageKind
    {
        State,
        Command
    }

    internal sealed class BackendMessage
    {
        internal BackendMessageKind Kind;
        internal string Value;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct CopyDataStruct
    {
        internal IntPtr DataTag;
        internal int ByteCount;
        internal IntPtr Data;
    }
}
