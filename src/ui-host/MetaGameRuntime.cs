using AiMiner.StoneMetaGame;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace AiMiner.UiHost
{
    // Owns the replaceable sidecar host instance. A failed action may have changed the
    // service's in-memory state before persistence failed, so that instance is never reused.
    // The next operation always starts from the last atomic state on disk.
    internal sealed class MetaGameRuntime
    {
        private readonly object _gate = new object();
        private readonly string _dataPath;
        private readonly string _statePath;
        private readonly bool _developmentMode;
        private StoneMetaGameHost _host;
        private string _lastError;
        private long _recoveryGeneration;
        private long _reportedRecoveryGeneration;
        private readonly string _recoveryEpoch = Guid.NewGuid().ToString("N");

        private static readonly HashSet<string> ExpectedActionFailures = new HashSet<string>(
            new[]
            {
                "AFFINITY_ALREADY_MAXIMUM", "COLLECTION_ITEM_NOT_OWNED",
                "DEBUG_ACTION_DISABLED", "GACHA_BANNER_NOT_AVAILABLE",
                "INSUFFICIENT_GACHA_CURRENCY", "INVALID_DEBUG_ACHIEVEMENT",
                "INVALID_DEBUG_AMOUNT", "INVALID_DEBUG_BANNER", "INVALID_DEBUG_PITY",
                "INVALID_DEBUG_RARITY", "INVALID_DEBUG_TOTAL", "INVALID_DRAW_COUNT",
                "INVALID_DRAW_REQUEST_ID", "INVALID_META_ACTION", "INVALID_META_PAYLOAD",
                "INVALID_META_SETTINGS",
                "INVALID_PROFILE_NAME", "META_ACTION_NOT_ALLOWED",
                "PROFILE_APPEARANCE_NOT_OWNED", "PROFILE_TITLE_NOT_OWNED",
                "REWARD_GRANT_NOT_FOUND", "SESSION_NOT_ACTIVE"
            }, StringComparer.Ordinal);

        internal MetaGameRuntime(string dataPath, string statePath, bool developmentMode)
        {
            _dataPath = Path.GetFullPath(dataPath);
            _statePath = Path.GetFullPath(statePath);
            _developmentMode = developmentMode;
            lock (_gate) TryReloadLocked();
        }

        internal bool IsAvailable
        {
            get { lock (_gate) return _host != null; }
        }

        internal string LastError
        {
            get { lock (_gate) return _lastError ?? "META_UNAVAILABLE"; }
        }

        internal string StatePath { get { return _statePath; } }

        internal string GetBootstrapJson()
        {
            lock (_gate)
            {
                StoneMetaGameHost host = RequireHostLocked();
                // Bootstrap is read-only. Recreating after a serialization failure would invoke
                // interrupted-session recovery and incorrectly close an active farm session.
                return host.GetBootstrapJson();
            }
        }

        internal string ExecuteUiJson(string json)
        {
            lock (_gate)
            {
                StoneMetaGameHost host = RequireHostLocked();
                try
                {
                    string result = host.ExecuteUiJson(json);
                    bool ok;
                    string error;
                    if (!TryReadMutationOutcome(result, out ok, out error))
                        throw new InvalidDataException("INVALID_META_RESULT");
                    if (!ok)
                    {
                        // Host.cs intentionally serializes both expected domain failures and
                        // thrown persistence failures. Domain/validation failures occur before
                        // mutation and must not recreate the service (doing so would recover and
                        // close a currently active mining session). An unknown failure is treated
                        // as a poisoned post-mutation instance and is never reused.
                        if (IsExpectedActionFailure(error)) return result;
                        InvalidateAfterMutationFailureLocked();
                        throw new InvalidOperationException(error ?? "META_ACTION_FAILED");
                    }
                    return result;
                }
                catch
                {
                    if (Object.ReferenceEquals(_host, host)) InvalidateAfterMutationFailureLocked();
                    throw;
                }
            }
        }

        internal string ApplyTrusted(TrustedMetaCommand command)
        {
            if (command == null) throw new ArgumentNullException(nameof(command));
            lock (_gate)
            {
                StoneMetaGameHost host = RequireHostLocked();
                try
                {
                    switch (command.Kind)
                    {
                        case TrustedMetaCommandKind.SessionBegin:
                            return host.BeginMiningSessionJson(command.Id, command.TimestampUtc);
                        case TrustedMetaCommandKind.MiningSuccess:
                            return host.RecordVerifiedMiningSuccessJson(command.Id, command.TimestampUtc);
                        case TrustedMetaCommandKind.SessionEnd:
                            return host.EndMiningSessionJson(command.Id, command.TimestampUtc);
                        default:
                            throw new InvalidOperationException("INVALID_META_COMMAND");
                    }
                }
                catch
                {
                    InvalidateAfterMutationFailureLocked();
                    throw;
                }
            }
        }

        // MainForm consumes this once per poisoned runtime generation and sends an authenticated
        // meta.reset to the farm controller before it retries its durable outbox head.
        internal bool TryGetRecoverySignal(out string token)
        {
            lock (_gate)
            {
                token = _recoveryEpoch + ":" + _recoveryGeneration.ToString(CultureInfo.InvariantCulture);
                if (_reportedRecoveryGeneration >= _recoveryGeneration) return false;
                return true;
            }
        }

        internal void MarkRecoverySignalSent(string token)
        {
            lock (_gate)
            {
                string expected = _recoveryEpoch + ":"
                    + _recoveryGeneration.ToString(CultureInfo.InvariantCulture);
                if (String.Equals(token, expected, StringComparison.Ordinal))
                    _reportedRecoveryGeneration = _recoveryGeneration;
            }
        }

        internal MetaGameSnapshot GetSnapshotForTests()
        {
            lock (_gate) return RequireHostLocked().Service.GetSnapshot();
        }

        private StoneMetaGameHost RequireHostLocked()
        {
            if (_host == null && !TryReloadLocked())
                throw new InvalidOperationException(_lastError ?? "META_UNAVAILABLE");
            return _host;
        }

        private void InvalidateAndReloadLocked()
        {
            _host = null;
            TryReloadLocked();
        }

        private void InvalidateAfterMutationFailureLocked()
        {
            _recoveryGeneration = checked(_recoveryGeneration + 1);
            InvalidateAndReloadLocked();
        }

        private bool TryReloadLocked()
        {
            try
            {
                _host = new StoneMetaGameHost(_dataPath, _statePath, _developmentMode);
                _lastError = null;
                return true;
            }
            catch (Exception exception)
            {
                _host = null;
                _lastError = Protocol.SanitizeDiagnostic(exception.Message);
                return false;
            }
        }

        private static bool TryReadMutationOutcome(string json, out bool ok, out string error)
        {
            ok = false;
            error = null;
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };
                Dictionary<string, object> envelope = serializer.DeserializeObject(json)
                    as Dictionary<string, object>;
                object resultValue;
                Dictionary<string, object> result = envelope != null
                    && envelope.TryGetValue("result", out resultValue)
                    ? resultValue as Dictionary<string, object> : null;
                if (result == null) return false;
                object okValue;
                if (!result.TryGetValue("Ok", out okValue) && !result.TryGetValue("ok", out okValue))
                    return false;
                if (!(okValue is bool)) return false;
                ok = (bool)okValue;
                object errorValue;
                if (result.TryGetValue("Error", out errorValue) || result.TryGetValue("error", out errorValue))
                    error = errorValue as string;
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static bool IsExpectedActionFailure(string error)
        {
            if (String.IsNullOrEmpty(error)) return false;
            if (ExpectedActionFailures.Contains(error)) return true;
            // These are strict Host.cs payload parsers. They reject before invoking Service.cs,
            // so no state can have been mutated and no recovery is needed.
            return error.StartsWith("INVALID_META_OBJECT_", StringComparison.Ordinal)
                || error.StartsWith("INVALID_META_STRING_", StringComparison.Ordinal)
                || error.StartsWith("INVALID_META_BOOLEAN_", StringComparison.Ordinal)
                || error.StartsWith("INVALID_META_NUMBER_", StringComparison.Ordinal)
                || error.StartsWith("MISSING_META_NUMBER_", StringComparison.Ordinal)
                || error.StartsWith("META_NUMBER_OUT_OF_RANGE_", StringComparison.Ordinal)
                || error.StartsWith("INVALID_META_ENUM_", StringComparison.Ordinal);
        }

        internal static bool RunSelfTests(string assetsPath, out string error)
        {
            error = null;
            string root = Path.Combine(Path.GetTempPath(),
                "ai-miner-meta-runtime-test-" + Guid.NewGuid().ToString("N"));
            try
            {
                Directory.CreateDirectory(root);
                string data = Path.Combine(assetsPath, "metagame", "data");
                TestExpectedFailureKeepsSession(data, Path.Combine(root, "domain.json"));
                TestMiningPersistenceRecovery(data, Path.Combine(root, "mining.json"));
                TestProfilePersistenceRollback(data, Path.Combine(root, "profile.json"));
                TestGachaPersistenceRollback(data, Path.Combine(root, "gacha.json"));
                TestOrderedUiMutations(data, Path.Combine(root, "ordered.json"));
                return true;
            }
            catch (Exception exception)
            {
                error = "metagame runtime self-test failed: "
                    + Protocol.SanitizeDiagnostic(exception.Message);
                return false;
            }
            finally
            {
                try { if (Directory.Exists(root)) Directory.Delete(root, true); }
                catch { }
            }
        }

        private static void TestExpectedFailureKeepsSession(string data, string state)
        {
            var runtime = new MetaGameRuntime(data, state, false);
            DateTimeOffset now = DateTimeOffset.UtcNow;
            runtime.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.SessionBegin,
                Id = "session:domain:0001",
                TimestampUtc = now
            });
            string result = runtime.ExecuteUiJson(
                "{\"action\":\"profile.rename\",\"payload\":{\"name\":\"\\u0001\"}}");
            bool ok;
            string failure;
            if (!TryReadMutationOutcome(result, out ok, out failure) || ok
                || failure != "INVALID_PROFILE_NAME")
                throw new InvalidOperationException("expected profile failure was not preserved");
            string malformed = runtime.ExecuteUiJson(
                "{\"action\":\"profile.rename\",\"payload\":{\"name\":\"Miner\",\"extra\":true}}");
            if (!TryReadMutationOutcome(malformed, out ok, out failure) || ok
                || failure != "INVALID_META_PAYLOAD")
                throw new InvalidOperationException("payload validation failure was not preserved");
            string token;
            if (runtime.TryGetRecoverySignal(out token))
                throw new InvalidOperationException("domain failure incorrectly reset runtime");
            if (runtime.GetSnapshotForTests().Mining.ActiveSessionId != "session:domain:0001")
                throw new InvalidOperationException("domain failure ended the active session");
        }

        private static void TestMiningPersistenceRecovery(string data, string state)
        {
            var runtime = new MetaGameRuntime(data, state, false);
            DateTimeOffset now = DateTimeOffset.UtcNow;
            runtime.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.SessionBegin,
                Id = "session:fault:old1",
                TimestampUtc = now
            });
            using (LockStateForRead(state))
            {
                ExpectFailure(delegate
                {
                    runtime.ApplyTrusted(new TrustedMetaCommand
                    {
                        Kind = TrustedMetaCommandKind.MiningSuccess,
                        Id = "mine:fault:0001",
                        TimestampUtc = now.AddSeconds(1)
                    });
                }, "mining save fault was not surfaced");
            }
            string token;
            if (!runtime.TryGetRecoverySignal(out token) || !token.EndsWith(":1", StringComparison.Ordinal))
                throw new InvalidOperationException("runtime reset was not emitted exactly once");
            runtime.MarkRecoverySignalSent(token);
            if (runtime.TryGetRecoverySignal(out token))
                throw new InvalidOperationException("runtime reset was emitted more than once");

            // Mirrors the authenticated controller recovery handshake: begin a fresh session,
            // then retry the unchanged durable mining event ID.
            runtime.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.SessionBegin,
                Id = "session:fault:new1",
                TimestampUtc = now.AddSeconds(2)
            });
            runtime.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.MiningSuccess,
                Id = "mine:fault:0001",
                TimestampUtc = now.AddSeconds(1)
            });
            MetaGameSnapshot recovered = runtime.GetSnapshotForTests();
            if (recovered.Mining.TotalStoneMined != 1
                || recovered.Mining.ActiveSessionId != "session:fault:new1")
                throw new InvalidOperationException("mining retry did not preserve count/session");
            var restarted = new MetaGameRuntime(data, state, false);
            if (restarted.GetSnapshotForTests().Mining.TotalStoneMined != 1)
                throw new InvalidOperationException("mining retry was not durable after restart");
        }

        private static void TestProfilePersistenceRollback(string data, string state)
        {
            var runtime = new MetaGameRuntime(data, state, false);
            using (LockStateForRead(state))
            {
                ExpectFailure(delegate
                {
                    runtime.ExecuteUiJson(
                        "{\"action\":\"profile.rename\",\"payload\":{\"name\":\"Unsaved\"}}");
                }, "profile save fault was not surfaced");
            }
            if (runtime.GetSnapshotForTests().Profile.Name == "Unsaved")
                throw new InvalidOperationException("failed profile save leaked mutated state");
            var restarted = new MetaGameRuntime(data, state, false);
            if (restarted.GetSnapshotForTests().Profile.Name == "Unsaved")
                throw new InvalidOperationException("failed profile save reached disk");
        }

        private static void TestGachaPersistenceRollback(string data, string state)
        {
            var runtime = new MetaGameRuntime(data, state, true);
            RequireSuccess(runtime.ExecuteUiJson(
                "{\"action\":\"debug.grantPoints\",\"payload\":{\"amount\":1000}}"));
            MetaGameSnapshot before = runtime.GetSnapshotForTests();
            long drawsBefore = before.Gacha.TotalDraws;
            long pointsBefore = before.Mining.AvailableMiningPoints;
            int collectionBefore = before.CollectionOwned;
            using (LockStateForRead(state))
            {
                ExpectFailure(delegate
                {
                    runtime.ExecuteUiJson("{\"action\":\"gacha.draw\",\"payload\":{"
                        + "\"requestId\":\"draw:fault:0001\",\"bannerId\":\"eternal-stone\","
                        + "\"count\":1,\"payment\":\"points\"}}");
                }, "gacha save fault was not surfaced");
            }
            MetaGameSnapshot after = runtime.GetSnapshotForTests();
            if (after.Gacha.TotalDraws != drawsBefore
                || after.Mining.AvailableMiningPoints != pointsBefore
                || after.CollectionOwned != collectionBefore)
                throw new InvalidOperationException("failed gacha save leaked draw state");
            var restarted = new MetaGameRuntime(data, state, true);
            if (restarted.GetSnapshotForTests().Gacha.TotalDraws != drawsBefore)
                throw new InvalidOperationException("failed gacha save reached disk");
        }

        private static void TestOrderedUiMutations(string data, string state)
        {
            var runtime = new MetaGameRuntime(data, state, true);
            RequireSuccess(runtime.ExecuteUiJson(
                "{\"action\":\"debug.grantPoints\",\"payload\":{\"amount\":1000}}"));
            RequireSuccess(runtime.ExecuteUiJson("{\"action\":\"gacha.draw\",\"payload\":{"
                + "\"requestId\":\"draw:ordered:01\",\"bannerId\":\"eternal-stone\","
                + "\"count\":1,\"payment\":\"points\"}}"));
            string item = runtime.GetSnapshotForTests().Collection.Keys.Single();
            RequireSuccess(runtime.ExecuteUiJson("{\"action\":\"collection.acknowledge\","
                + "\"payload\":{\"itemId\":\"" + item + "\"}}"));
            RequireSuccess(runtime.ExecuteUiJson("{\"action\":\"collection.favorite\","
                + "\"payload\":{\"itemId\":\"" + item + "\",\"favorite\":true}}"));
            RequireSuccess(runtime.ExecuteUiJson("{\"action\":\"settings.update\",\"payload\":{"
                + "\"masterVolume\":0.5,\"bgmVolume\":0.25,\"sfxVolume\":0.75,"
                + "\"muted\":false,\"effectQuality\":\"high\",\"reduceMotion\":true,"
                + "\"animationSpeed\":\"fast\",\"skipPreviouslySeenLegendary\":true}}"));
            RequireSuccess(runtime.ExecuteUiJson("{\"action\":\"collection.favorite\","
                + "\"payload\":{\"itemId\":\"" + item + "\",\"favorite\":false}}"));
            RequireSuccess(runtime.ExecuteUiJson("{\"action\":\"collection.favorite\","
                + "\"payload\":{\"itemId\":\"" + item + "\",\"favorite\":true}}"));
            MetaGameSnapshot final = runtime.GetSnapshotForTests();
            CollectionEntry entry = final.Collection[item];
            if (!entry.Seen || !entry.Favorite || !final.Settings.ReduceMotion
                || final.Settings.AnimationSpeed != "fast"
                || Math.Abs(final.Settings.MasterVolume - 0.5) > 0.0001)
                throw new InvalidOperationException("rapid ordered UI mutations were reordered");
        }

        private static FileStream LockStateForRead(string state)
        {
            return new FileStream(state, FileMode.Open, FileAccess.Read, FileShare.Read);
        }

        private static void ExpectFailure(Action action, string message)
        {
            try { action(); }
            catch { return; }
            throw new InvalidOperationException(message);
        }

        private static void RequireSuccess(string json)
        {
            bool ok;
            string failure;
            if (!TryReadMutationOutcome(json, out ok, out failure) || !ok)
                throw new InvalidOperationException("mutation failed: " + (failure ?? "unknown"));
        }
    }
}
