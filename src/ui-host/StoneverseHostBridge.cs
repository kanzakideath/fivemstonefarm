using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace AiMiner.UiHost
{
    // Delivers the controller's durable Farm facts to the public STONEVERSE API.
    // A controller ACK is eligible only after accepted/duplicate is returned.
    internal sealed class StoneverseHostBridge : IDisposable
    {
        private const int ProtocolVersion = 1;
        private const int ResultTimeoutMilliseconds = 8000;
        private static readonly Regex SafeId = new Regex(@"\A[A-Za-z0-9][A-Za-z0-9:._-]{0,255}\z",
            RegexOptions.CultureInvariant);
        private readonly object _gate = new object();
        private readonly object _deliveryGate = new object();
        private readonly Dictionary<string, PendingResult> _pending =
            new Dictionary<string, PendingResult>(StringComparer.Ordinal);
        private bool _pageReady;
        private bool _pageSessionActive;
        private bool _disposed;
        private string _activeFarmSessionId;

        internal void ResetPage()
        {
            PendingResult[] pending;
            lock (_gate)
            {
                _pageReady = false;
                _pageSessionActive = false;
                pending = new List<PendingResult>(_pending.Values).ToArray();
            }
            foreach (PendingResult item in pending) item.Fail("PAGE_NAVIGATED");
        }

        internal bool TryHandleWebMessage(string json)
        {
            Dictionary<string, object> message;
            try
            {
                var serializer = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 };
                message = serializer.DeserializeObject(json) as Dictionary<string, object>;
            }
            catch { return false; }
            if (message == null) return false;

            string type = ReadString(message, "type");
            if (String.Equals(type, "stoneverse.ready", StringComparison.Ordinal))
            {
                if (!IsProtocol(message) || !SafeId.IsMatch(ReadString(message, "accountId") ?? String.Empty))
                    return true;
                lock (_gate) { if (!_disposed) _pageReady = true; }
                return true;
            }
            if (!String.Equals(type, "stoneverse.result", StringComparison.Ordinal)) return false;

            string requestId = ReadString(message, "requestId");
            PendingResult pending;
            lock (_gate)
            {
                if (!IsProtocol(message) || String.IsNullOrEmpty(requestId)
                    || !_pending.TryGetValue(requestId, out pending)) return true;
            }
            pending.Complete(new DeliveryResult
            {
                RequestId = requestId,
                Command = ReadString(message, "command"),
                Id = ReadString(message, "id"),
                Ok = ReadBoolean(message, "ok"),
                Accepted = ReadBoolean(message, "accepted"),
                Duplicate = ReadBoolean(message, "duplicate"),
                Error = ReadString(message, "error")
            });
            return true;
        }

        internal bool Deliver(TrustedMetaCommand command, Action<string> postJson, out string error)
        {
            error = null;
            if (command == null || postJson == null)
            {
                error = "INVALID_STONEVERSE_DELIVERY";
                return false;
            }

            lock (_deliveryGate)
            {
                // Navigating between Farm and the complete sidecar creates a new JS runtime.
                // Resume the still-active managed session before its next durable fact.
                if (command.Kind != TrustedMetaCommandKind.SessionBegin
                    && !String.IsNullOrEmpty(_activeFarmSessionId) && !_pageSessionActive)
                {
                    DeliveryResult resumed;
                    var resume = new TrustedMetaCommand
                    {
                        Kind = TrustedMetaCommandKind.SessionBegin,
                        Id = _activeFarmSessionId,
                        TimestampUtc = DateTimeOffset.UtcNow
                    };
                    if (!SendAndWait(resume, postJson, out resumed, out error) || !resumed.Ok)
                    {
                        error = error ?? resumed.Error ?? "STONEVERSE_SESSION_RESUME_FAILED";
                        return false;
                    }
                    _pageSessionActive = true;
                }

                DeliveryResult result;
                if (!SendAndWait(command, postJson, out result, out error)) return false;
                if (!result.Ok)
                {
                    error = result.Error ?? "STONEVERSE_REJECTED";
                    return false;
                }
                if (command.Kind == TrustedMetaCommandKind.MiningSuccess
                    && !result.Accepted && !result.Duplicate)
                {
                    error = "STONEVERSE_MINING_NOT_COMMITTED";
                    return false;
                }
                if (command.Kind == TrustedMetaCommandKind.SessionBegin)
                {
                    _activeFarmSessionId = command.Id;
                    _pageSessionActive = true;
                }
                else if (command.Kind == TrustedMetaCommandKind.SessionEnd)
                {
                    _activeFarmSessionId = null;
                    _pageSessionActive = false;
                }
                return true;
            }
        }

        private bool SendAndWait(TrustedMetaCommand command, Action<string> postJson,
            out DeliveryResult result, out string error)
        {
            result = new DeliveryResult();
            error = null;
            string requestId = "sv-" + Guid.NewGuid().ToString("N");
            var pending = new PendingResult();
            lock (_gate)
            {
                if (_disposed || !_pageReady)
                {
                    error = "STONEVERSE_NOT_READY";
                    return false;
                }
                _pending.Add(requestId, pending);
            }

            try
            {
                var payload = new Dictionary<string, object>
                {
                    { "type", "stoneverse.command" }, { "protocol", ProtocolVersion },
                    { "requestId", requestId },
                    { "command", MetaGameBridge.CommandToken(command.Kind) },
                    { "id", command.Id },
                    { "timestamp", command.TimestampUtc.UtcDateTime.ToString("O", CultureInfo.InvariantCulture) }
                };
                if (command.Kind == TrustedMetaCommandKind.MiningSuccess)
                {
                    payload["amount"] = 1;
                    payload["quality"] = 0.5;
                    payload["areaId"] = "area_greenbreak";
                    payload["veinId"] = "vein_common";
                    payload["metadata"] = new Dictionary<string, object>
                    {
                        { "source", "fiveM-farm" },
                        { "mode", ModeFromEventId(command.Id) },
                        { "transport", "durable-outbox-v1" }
                    };
                }
                postJson(new JavaScriptSerializer().Serialize(payload));
                if (!pending.Wait(ResultTimeoutMilliseconds))
                {
                    error = "STONEVERSE_TIMEOUT";
                    return false;
                }
                result = pending.Result ?? new DeliveryResult();
                if (!String.IsNullOrEmpty(pending.Error))
                {
                    error = pending.Error;
                    return false;
                }
                if (!String.Equals(result.RequestId, requestId, StringComparison.Ordinal)
                    || !String.Equals(result.Command, MetaGameBridge.CommandToken(command.Kind), StringComparison.Ordinal)
                    || !String.Equals(result.Id, command.Id, StringComparison.Ordinal))
                {
                    error = "STONEVERSE_RESULT_MISMATCH";
                    return false;
                }
                return true;
            }
            finally
            {
                lock (_gate) _pending.Remove(requestId);
                pending.Dispose();
            }
        }

        private static string ModeFromEventId(string eventId)
        {
            if (eventId.IndexOf(":washing:", StringComparison.OrdinalIgnoreCase) >= 0) return "washing";
            if (eventId.IndexOf(":gold:", StringComparison.OrdinalIgnoreCase) >= 0) return "gold";
            return "mining";
        }

        private static bool IsProtocol(Dictionary<string, object> message)
        {
            object value;
            try
            {
                return message.TryGetValue("protocol", out value)
                    && Convert.ToInt32(value, CultureInfo.InvariantCulture) == ProtocolVersion;
            }
            catch { return false; }
        }

        private static string ReadString(Dictionary<string, object> message, string key)
        {
            object value;
            return message.TryGetValue(key, out value) ? value as string : null;
        }

        private static bool ReadBoolean(Dictionary<string, object> message, string key)
        {
            object value;
            return message.TryGetValue(key, out value) && value is bool && (bool)value;
        }

        public void Dispose()
        {
            lock (_gate) _disposed = true;
            ResetPage();
        }

        private sealed class DeliveryResult
        {
            internal string RequestId;
            internal string Command;
            internal string Id;
            internal bool Ok;
            internal bool Accepted;
            internal bool Duplicate;
            internal string Error;
        }

        private sealed class PendingResult : IDisposable
        {
            private readonly ManualResetEventSlim _completed = new ManualResetEventSlim(false);
            internal DeliveryResult Result;
            internal string Error;
            internal void Complete(DeliveryResult result)
            {
                Result = result;
                try { _completed.Set(); }
                catch (ObjectDisposedException) { }
            }
            internal void Fail(string error)
            {
                Error = error;
                try { _completed.Set(); }
                catch (ObjectDisposedException) { }
            }
            internal bool Wait(int milliseconds) { return _completed.Wait(milliseconds); }
            public void Dispose() { _completed.Dispose(); }
        }
    }
}
