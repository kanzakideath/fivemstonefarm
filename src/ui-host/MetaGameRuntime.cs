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
        private bool _recoverySignalCoversNextReload;
        // Remains set after meta.reset is accepted until the controller's replacement
        // SESSION_BEGIN commits. This prevents stale commands that were already queued across
        // the reset handshake from scheduling an unbounded series of redundant rebases.
        private bool _controllerRebaseOutstanding;
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
                    string result;
                    switch (command.Kind)
                    {
                        case TrustedMetaCommandKind.SessionBegin:
                            result = host.BeginMiningSessionJson(command.Id, command.TimestampUtc);
                            break;
                        case TrustedMetaCommandKind.MiningSuccess:
                            result = host.RecordVerifiedMiningSuccessJson(command.Id,
                                command.TimestampUtc);
                            break;
                        case TrustedMetaCommandKind.SessionEnd:
                            result = host.EndMiningSessionJson(command.Id, command.TimestampUtc);
                            break;
                        default:
                            throw new InvalidOperationException("INVALID_META_COMMAND");
                    }
                    bool ok;
                    string error;
                    if (command.Kind == TrustedMetaCommandKind.SessionBegin
                        && TryReadMutationOutcome(result, out ok, out error) && ok)
                    {
                        // The durable replacement envelope has reached the sidecar. Any stale
                        // pre-reset commands that were already queued are now behind this barrier.
                        _controllerRebaseOutstanding = false;
                    }
                    return result;
                }
                catch
                {
                    InvalidateAfterMutationFailureLocked();
                    throw;
                }
            }
        }

        // A strict SESSION_NOT_ACTIVE response for SESSION_END means the controller's durable
        // FIFO and the sidecar disagree about their session boundary. Never ACK that END. Ask
        // the existing authenticated reset handshake to atomically replace the controller FIFO
        // with a fresh BEGIN/(retained rewards)/END envelope instead.
        internal void RequestControllerRebaseForRejectedSessionEnd()
        {
            lock (_gate) ScheduleControllerRebaseLocked();
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

        // Trusted controller commands are stamped when WM_COPYDATA accepts them. If a reset is
        // completed before that queued item reaches the worker, the stamp no longer matches and
        // the item belongs to the discarded pre-reset FIFO. Dropping it without ACK lets the
        // controller's durable replacement envelope remain the sole source of retries.
        internal long CaptureControllerQueueEpoch()
        {
            lock (_gate) return _reportedRecoveryGeneration;
        }

        internal bool IsControllerQueueEpochCurrent(long acceptedEpoch)
        {
            lock (_gate) return acceptedEpoch == _reportedRecoveryGeneration;
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
            ScheduleControllerRebaseLocked();
            // This generation already tells the controller to rebuild its ordered envelope.
            // If reconstruction also closes a persisted active sidecar session, the same reset
            // covers both facts; emitting a second generation would rebase the FIFO twice. Keep
            // the suppression intent across a failed immediate reload and consume it only when
            // some later operation successfully constructs the replacement Host.
            _recoverySignalCoversNextReload = true;
            InvalidateAndReloadLocked();
        }

        private bool TryReloadLocked()
        {
            string activeSessionBeforeLoad = ReadActiveSessionIdBeforeHostConstruction();
            try
            {
                StoneMetaGameHost host = new StoneMetaGameHost(_dataPath, _statePath,
                    _developmentMode);
                // MetaGameService deliberately closes an interrupted session during
                // construction, accounting only through its last verified reward. Tell the
                // controller before it processes a stale END-only head so AHK can replace the
                // old envelope with a fresh BEGIN/reward/END transaction. This keeps recovery
                // metadata out of the completed sidecar state schema.
                if (!_recoverySignalCoversNextReload
                    && !String.IsNullOrEmpty(activeSessionBeforeLoad)
                    && String.IsNullOrEmpty(host.Service.GetSnapshot().Mining.ActiveSessionId))
                    ScheduleControllerRebaseLocked();
                _host = host;
                _recoverySignalCoversNextReload = false;
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

        private void ScheduleControllerRebaseLocked()
        {
            if (_controllerRebaseOutstanding) return;
            _controllerRebaseOutstanding = true;
            _recoveryGeneration = checked(_recoveryGeneration + 1);
        }

        private string ReadActiveSessionIdBeforeHostConstruction()
        {
            // Avoid creating a state file merely to probe a fresh install. For an existing
            // state, use the sidecar's own checksum/fallback loader so a corrupt primary cannot
            // manufacture a false recovery signal.
            if (!File.Exists(_statePath) && !File.Exists(_statePath + ".bak")) return null;
            try
            {
                MetaGameState state = new MetaGameStateStore(_statePath)
                    .LoadOrCreate(DateTimeOffset.UtcNow);
                return state.Mining == null ? null : state.Mining.ActiveSessionId;
            }
            catch
            {
                // Host construction below remains the authority for reporting load failures.
                return null;
            }
        }

        internal static bool TryReadMutationOutcome(string json, out bool ok, out string error)
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
                TestHostRestartSignalsInterruptedSessionRecovery(data,
                    Path.Combine(root, "host-restart.json"));
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
            if (runtime.TryGetRecoverySignal(out token))
                throw new InvalidOperationException(
                    "successful delayed Host reload emitted a duplicate reset");
            MetaGameSnapshot recovered = runtime.GetSnapshotForTests();
            if (recovered.Mining.TotalStoneMined != 1
                || recovered.Mining.ActiveSessionId != "session:fault:new1")
                throw new InvalidOperationException("mining retry did not preserve count/session");
            var restarted = new MetaGameRuntime(data, state, false);
            if (restarted.GetSnapshotForTests().Mining.TotalStoneMined != 1)
                throw new InvalidOperationException("mining retry was not durable after restart");
        }

        private static void TestHostRestartSignalsInterruptedSessionRecovery(string data,
            string state)
        {
            DateTimeOffset now = DateTimeOffset.UtcNow;
            DateTimeOffset startedAt = now.AddMinutes(-1);
            DateTimeOffset minedAt = now.AddSeconds(-30);
            const string oldSession = "session:restart:old1";
            const string eventId = "mine:restart:event1";
            var firstHost = new MetaGameRuntime(data, state, false);
            AssertTrustedMutationOk(firstHost.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.SessionBegin,
                Id = oldSession,
                TimestampUtc = startedAt
            }), "restart fixture BEGIN failed");
            AssertTrustedMutationOk(firstHost.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.MiningSuccess,
                Id = eventId,
                TimestampUtc = minedAt
            }), "restart fixture reward failed");
            string token;
            if (firstHost.TryGetRecoverySignal(out token))
                throw new InvalidOperationException("fresh Host emitted a recovery reset");

            // Constructing a new runtime is the real Host-process restart boundary. The
            // unchanged sidecar closes its persisted active session through lastMined; the
            // runtime must signal AHK before it can process the stale END-only FIFO head.
            var restarted = new MetaGameRuntime(data, state, false);
            MetaGameSnapshot recovered = restarted.GetSnapshotForTests();
            if (recovered.Mining.ActiveSessionId != ""
                || recovered.Mining.TotalStoneMined != 1
                || recovered.Mining.TotalActiveSeconds != 30)
                throw new InvalidOperationException("Host restart recovery state was incorrect");
            if (!restarted.TryGetRecoverySignal(out token)
                || !token.EndsWith(":1", StringComparison.Ordinal))
                throw new InvalidOperationException("Host restart did not request one FIFO rebase");
            restarted.MarkRecoverySignalSent(token);
            if (restarted.TryGetRecoverySignal(out token))
                throw new InvalidOperationException("Host restart recovery reset repeated");

            // Mirrors the AHK reset transaction: a fresh closed envelope surrounds any retained
            // stable reward IDs. The reward replay is a duplicate and the new END is accepted,
            // so the old END-only row can never wedge the durable FIFO.
            const string rebasedSession = "session:restart:rebased1";
            AssertTrustedMutationOk(restarted.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.SessionBegin,
                Id = rebasedSession,
                TimestampUtc = now
            }), "rebased BEGIN failed");
            AssertTrustedMutationOk(restarted.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.MiningSuccess,
                Id = eventId,
                TimestampUtc = minedAt
            }), "rebased reward replay failed");
            AssertTrustedMutationOk(restarted.ApplyTrusted(new TrustedMetaCommand
            {
                Kind = TrustedMetaCommandKind.SessionEnd,
                Id = rebasedSession,
                TimestampUtc = now.AddMilliseconds(1)
            }), "rebased END failed");
            MetaGameSnapshot final = restarted.GetSnapshotForTests();
            if (final.Mining.ActiveSessionId != "" || final.Mining.TotalStoneMined != 1
                || final.Mining.TotalActiveSeconds != 30)
                throw new InvalidOperationException("rebased recovery changed durable progress");

            // A second Host process that starts after END was durably committed sees an
            // intentionally inactive sidecar, so there is no eager startup reset. If the old
            // controller END survived because its ACK was lost, its strict rejection schedules
            // exactly one reset; the rejected END itself remains unacknowledgeable.
            var afterCommittedEndRestart = new MetaGameRuntime(data, state, false);
            if (afterCommittedEndRestart.TryGetRecoverySignal(out token))
                throw new InvalidOperationException(
                    "inactive sidecar incorrectly requested an eager restart reset");
            AssertTrustedMutationFailure(afterCommittedEndRestart.ApplyTrusted(
                new TrustedMetaCommand
                {
                    Kind = TrustedMetaCommandKind.SessionEnd,
                    Id = rebasedSession,
                    TimestampUtc = now.AddMilliseconds(2)
                }), "SESSION_NOT_ACTIVE", "lost-ACK END replay was unexpectedly accepted");
            afterCommittedEndRestart.RequestControllerRebaseForRejectedSessionEnd();
            if (!afterCommittedEndRestart.TryGetRecoverySignal(out token)
                || !token.EndsWith(":1", StringComparison.Ordinal))
                throw new InvalidOperationException(
                    "lost-ACK END replay did not request a Host-restart FIFO rebase");
            afterCommittedEndRestart.MarkRecoverySignalSent(token);
            afterCommittedEndRestart.RequestControllerRebaseForRejectedSessionEnd();
            if (afterCommittedEndRestart.TryGetRecoverySignal(out token))
                throw new InvalidOperationException(
                    "duplicate stale END scheduled a second reset before replacement BEGIN");

            // A successful replacement BEGIN is the only release barrier. After it commits, a
            // different mismatched END while active may request one new generation, but remains
            // rejected and cannot close or receive credit for the active session.
            const string liveSession = "session:restart:live1";
            AssertTrustedMutationOk(afterCommittedEndRestart.ApplyTrusted(
                new TrustedMetaCommand
                {
                    Kind = TrustedMetaCommandKind.SessionBegin,
                    Id = liveSession,
                    TimestampUtc = now.AddMilliseconds(3)
                }), "post-reset BEGIN failed");
            AssertTrustedMutationFailure(afterCommittedEndRestart.ApplyTrusted(
                new TrustedMetaCommand
                {
                    Kind = TrustedMetaCommandKind.SessionEnd,
                    Id = "session:restart:foreign1",
                    TimestampUtc = now.AddMilliseconds(4)
                }), "SESSION_NOT_ACTIVE", "foreign END was unexpectedly accepted");
            if (afterCommittedEndRestart.GetSnapshotForTests().Mining.ActiveSessionId != liveSession)
                throw new InvalidOperationException("foreign END changed the active session");
            afterCommittedEndRestart.RequestControllerRebaseForRejectedSessionEnd();
            if (!afterCommittedEndRestart.TryGetRecoverySignal(out token)
                || !token.EndsWith(":2", StringComparison.Ordinal))
                throw new InvalidOperationException(
                    "successful replacement BEGIN did not release reset deduplication");
            afterCommittedEndRestart.MarkRecoverySignalSent(token);
            const string finalSession = "session:restart:final1";
            AssertTrustedMutationOk(afterCommittedEndRestart.ApplyTrusted(
                new TrustedMetaCommand
                {
                    Kind = TrustedMetaCommandKind.SessionBegin,
                    Id = finalSession,
                    TimestampUtc = now.AddMilliseconds(5)
                }), "second recovery BEGIN failed");
            AssertTrustedMutationOk(afterCommittedEndRestart.ApplyTrusted(
                new TrustedMetaCommand
                {
                    Kind = TrustedMetaCommandKind.SessionEnd,
                    Id = finalSession,
                    TimestampUtc = now.AddMilliseconds(6)
                }), "second recovery END failed");
        }

        private static void AssertTrustedMutationOk(string result, string message)
        {
            bool ok;
            string error;
            if (!TryReadMutationOutcome(result, out ok, out error) || !ok)
                throw new InvalidOperationException(message + ": " + (error ?? "INVALID_META_RESULT"));
        }

        private static void AssertTrustedMutationFailure(string result, string expectedError,
            string message)
        {
            bool ok;
            string error;
            if (!TryReadMutationOutcome(result, out ok, out error) || ok
                || !String.Equals(error, expectedError, StringComparison.Ordinal))
                throw new InvalidOperationException(message + ": " + (error ?? "INVALID_META_RESULT"));
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
