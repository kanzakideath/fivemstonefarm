using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Web.Script.Serialization;

namespace AiMiner.StoneMetaGame
{
    // Thin integration facade for AiMiner.UiHost. It keeps trusted mining events separate from
    // WebView-originated actions and applies a strict allowlist to every UI payload.
    public sealed class StoneMetaGameHost
    {
        private const int MaximumUiMessageCharacters = 1024 * 1024;
        private readonly JavaScriptSerializer _serializer = new JavaScriptSerializer
        {
            MaxJsonLength = 8 * 1024 * 1024
        };
        private readonly MetaGameService _service;
        private readonly bool _developmentMode;

        public StoneMetaGameHost(string dataDirectory, string statePath, bool developmentMode)
        {
            _service = new MetaGameService(MetaGameCatalog.Load(dataDirectory),
                new MetaGameStateStore(statePath));
            _developmentMode = developmentMode;
        }

        public MetaGameService Service { get { return _service; } }

        public string GetBootstrapJson()
        {
            var catalog = _service.Catalog;
            return _serializer.Serialize(new Dictionary<string, object>
            {
                { "type", "meta.bootstrap" },
                { "snapshot", _service.GetSnapshot() },
                { "catalog", new Dictionary<string, object>
                    {
                        { "gacha", catalog.Gacha },
                        { "banners", catalog.Banners },
                        { "items", catalog.Items },
                        { "affinityRanks", catalog.AffinityRanks },
                        { "achievements", catalog.Achievements },
                        { "levelRewards", catalog.LevelRewards },
                        { "titles", catalog.Titles },
                        { "assets", catalog.Assets },
                        { "messages", catalog.Messages }
                    }
                },
                { "developmentMode", _developmentMode }
            });
        }

        // Trusted-only entry points. MainForm must call these from authenticated backend IPC,
        // never from CoreWebView2.WebMessageReceived.
        public string RecordVerifiedMiningSuccessJson(string eventId, DateTimeOffset completedAtUtc)
        {
            return SerializeMutation("meta.miningRecorded",
                _service.RecordVerifiedMiningSuccess(eventId, completedAtUtc));
        }

        public string BeginMiningSessionJson(string sessionId, DateTimeOffset startedAtUtc)
        {
            return SerializeMutation("meta.sessionStarted",
                _service.BeginMiningSession(sessionId, startedAtUtc));
        }

        public string EndMiningSessionJson(string sessionId, DateTimeOffset endedAtUtc)
        {
            return SerializeMutation("meta.sessionEnded",
                _service.EndMiningSession(sessionId, endedAtUtc));
        }

        public string ExecuteUiJson(string json)
        {
            try
            {
                if (String.IsNullOrEmpty(json) || json.Length > MaximumUiMessageCharacters)
                    return SerializeError("INVALID_META_ACTION");
                var root = _serializer.DeserializeObject(json) as Dictionary<string, object>;
                if (root == null) return SerializeError("INVALID_META_ACTION");
                EnsureOnly(root, "action", "payload");
                string action = StringValue(root, "action", 64);
                var payload = ObjectValue(root, "payload");
                MutationResult result;
                switch (action)
                {
                    case "gacha.draw":
                        EnsureOnly(payload, "requestId", "bannerId", "count", "payment");
                        result = _service.Draw(StringValue(payload, "requestId", 128),
                            StringValue(payload, "bannerId", 64), IntValue(payload, "count", 1, 10),
                            StringValue(payload, "payment", 16));
                        break;
                    case "profile.rename":
                        EnsureOnly(payload, "name");
                        result = _service.RenameProfile(StringValue(payload, "name", 24));
                        break;
                    case "profile.appearance":
                        EnsureOnly(payload, "icon", "frame", "customIconDataUri");
                        result = _service.SetProfileAppearance(
                            StringValue(payload, "icon", 128),
                            StringValue(payload, "frame", 128),
                            StringValue(payload, "customIconDataUri", 700000, true));
                        break;
                    case "profile.title":
                        EnsureOnly(payload, "titleId");
                        result = _service.SetProfileTitle(StringValue(payload, "titleId", 64));
                        break;
                    case "profile.update":
                        EnsureOnly(payload, "name", "icon", "frame", "customIconDataUri", "titleId");
                        result = _service.UpdateProfile(
                            StringValue(payload, "name", 24),
                            StringValue(payload, "icon", 128),
                            StringValue(payload, "frame", 128),
                            StringValue(payload, "customIconDataUri", 700000, true),
                            StringValue(payload, "titleId", 64));
                        break;
                    case "collection.favorite":
                        EnsureOnly(payload, "itemId", "favorite");
                        result = _service.SetCollectionFavorite(StringValue(payload, "itemId", 64),
                            BoolValue(payload, "favorite"));
                        break;
                    case "collection.acknowledge":
                        EnsureOnly(payload, "itemId");
                        result = _service.AcknowledgeCollection(StringValue(payload, "itemId", 64));
                        break;
                    case "reward.claim":
                        EnsureOnly(payload, "grantId");
                        result = _service.ClaimReward(StringValue(payload, "grantId", 128));
                        break;
                    case "reward.claimAll":
                        EnsureOnly(payload);
                        result = _service.ClaimAllRewards();
                        break;
                    case "onboarding.complete":
                        EnsureOnly(payload);
                        result = _service.CompleteOnboarding();
                        break;
                    case "settings.update":
                        EnsureOnly(payload, "masterVolume", "bgmVolume", "sfxVolume", "muted",
                            "effectQuality", "reduceMotion", "animationSpeed",
                            "skipPreviouslySeenLegendary");
                        result = _service.UpdateSettings(new MetaSettings
                        {
                            MasterVolume = DoubleValue(payload, "masterVolume", 0, 1),
                            BgmVolume = DoubleValue(payload, "bgmVolume", 0, 1),
                            SfxVolume = DoubleValue(payload, "sfxVolume", 0, 1),
                            Muted = BoolValue(payload, "muted"),
                            EffectQuality = EnumValue(payload, "effectQuality", "low", "normal", "high"),
                            ReduceMotion = BoolValue(payload, "reduceMotion"),
                            AnimationSpeed = EnumValue(payload, "animationSpeed", "normal", "fast", "skip"),
                            SkipPreviouslySeenLegendary = BoolValue(payload, "skipPreviouslySeenLegendary")
                        });
                        break;
                    case "debug.grantPoints":
                        EnsureDevelopment();
                        EnsureOnly(payload, "amount");
                        result = _service.DebugGrantMiningPoints(LongValue(payload, "amount", 1, 10000000));
                        break;
                    case "debug.setMined":
                        EnsureDevelopment();
                        EnsureOnly(payload, "total");
                        result = _service.DebugSetStoneMined(LongValue(payload, "total", 0, 1000000000));
                        break;
                    case "debug.addXp":
                        EnsureDevelopment();
                        EnsureOnly(payload, "amount");
                        result = _service.DebugAddXp(LongValue(payload, "amount", 1, 100000000));
                        break;
                    case "debug.advanceAffinity":
                        EnsureDevelopment();
                        EnsureOnly(payload);
                        result = _service.DebugAdvanceAffinity();
                        break;
                    case "debug.unlockAchievement":
                        EnsureDevelopment();
                        EnsureOnly(payload, "id");
                        result = _service.DebugUnlockAchievement(StringValue(payload, "id", 64));
                        break;
                    case "debug.forceDraw":
                        EnsureDevelopment();
                        EnsureOnly(payload, "requestId", "bannerId", "count", "rarity", "fakeout",
                            "variant", "preCue");
                        result = _service.DebugForceDraw(StringValue(payload, "requestId", 128),
                            StringValue(payload, "bannerId", 64), IntValue(payload, "count", 1, 10),
                            StringValue(payload, "rarity", 32), BoolValue(payload, "fakeout"),
                            StringValue(payload, "variant", 64, true),
                            StringValue(payload, "preCue", 64, true));
                        break;
                    case "debug.primePity":
                        EnsureDevelopment();
                        EnsureOnly(payload, "kind");
                        result = _service.DebugPrimePity(EnumValue(payload, "kind", "ssr", "ur"));
                        break;
                    case "debug.setPity":
                        EnsureDevelopment();
                        EnsureOnly(payload, "bannerId", "trackId", "value");
                        result = _service.DebugSetPity(StringValue(payload, "bannerId", 64),
                            StringValue(payload, "trackId", 64), IntValue(payload, "value", 0, 999999));
                        break;
                    default:
                        return SerializeError("META_ACTION_NOT_ALLOWED");
                }
                return SerializeMutation("meta.result", result);
            }
            catch (Exception error)
            {
                return SerializeError(Sanitize(error.Message));
            }
        }

        private string SerializeMutation(string type, MutationResult result)
        {
            return _serializer.Serialize(new Dictionary<string, object>
            {
                { "type", type }, { "result", result }
            });
        }

        private string SerializeError(string error)
        {
            return _serializer.Serialize(new Dictionary<string, object>
            {
                { "type", "meta.result" },
                { "result", new MutationResult { Ok = false, Error = Sanitize(error),
                    Snapshot = _service.GetSnapshot() } }
            });
        }

        private void EnsureDevelopment()
        {
            if (!_developmentMode) throw new InvalidOperationException("DEBUG_ACTION_DISABLED");
        }

        private static void EnsureOnly(Dictionary<string, object> value, params string[] keys)
        {
            var expected = new HashSet<string>(keys, StringComparer.Ordinal);
            if (value.Count != expected.Count || value.Keys.Any(x => !expected.Contains(x)))
                throw new FormatException("INVALID_META_PAYLOAD");
        }

        private static Dictionary<string, object> ObjectValue(Dictionary<string, object> values, string key)
        {
            object value;
            var result = values.TryGetValue(key, out value) ? value as Dictionary<string, object> : null;
            if (result == null) throw new FormatException("INVALID_META_OBJECT_" + key);
            return result;
        }

        private static string StringValue(Dictionary<string, object> values, string key, int maximum,
            bool allowEmpty = false)
        {
            object raw;
            string value = values.TryGetValue(key, out raw) ? raw as string : null;
            if (value == null || (!allowEmpty && value.Length == 0) || value.Length > maximum
                || value.IndexOf('\0') >= 0) throw new FormatException("INVALID_META_STRING_" + key);
            return value;
        }

        private static bool BoolValue(Dictionary<string, object> values, string key)
        {
            object raw;
            if (!values.TryGetValue(key, out raw) || !(raw is bool))
                throw new FormatException("INVALID_META_BOOLEAN_" + key);
            return (bool)raw;
        }

        private static int IntValue(Dictionary<string, object> values, string key, int minimum, int maximum)
        {
            return checked((int)LongValue(values, key, minimum, maximum));
        }

        private static long LongValue(Dictionary<string, object> values, string key, long minimum, long maximum)
        {
            object raw;
            if (!values.TryGetValue(key, out raw)) throw new FormatException("MISSING_META_NUMBER_" + key);
            long value;
            if (raw is int) value = (int)raw;
            else if (raw is long) value = (long)raw;
            else throw new FormatException("INVALID_META_NUMBER_" + key);
            if (value < minimum || value > maximum) throw new FormatException("META_NUMBER_OUT_OF_RANGE_" + key);
            return value;
        }

        private static double DoubleValue(Dictionary<string, object> values, string key,
            double minimum, double maximum)
        {
            object raw;
            if (!values.TryGetValue(key, out raw)) throw new FormatException("MISSING_META_NUMBER_" + key);
            double value;
            if (raw is decimal) value = (double)(decimal)raw;
            else if (raw is double) value = (double)raw;
            else if (raw is int) value = (int)raw;
            else if (raw is long) value = (long)raw;
            else throw new FormatException("INVALID_META_NUMBER_" + key);
            if (Double.IsNaN(value) || Double.IsInfinity(value) || value < minimum || value > maximum)
                throw new FormatException("META_NUMBER_OUT_OF_RANGE_" + key);
            return value;
        }

        private static string EnumValue(Dictionary<string, object> values, string key, params string[] allowed)
        {
            string value = StringValue(values, key, 64);
            if (!allowed.Contains(value, StringComparer.Ordinal))
                throw new FormatException("INVALID_META_ENUM_" + key);
            return value;
        }

        private static string Sanitize(string value)
        {
            string safe = (value ?? "META_ERROR").Replace('\r', ' ').Replace('\n', ' ')
                .Replace('\t', ' ').Replace('\0', ' ').Trim();
            return safe.Length <= 160 ? safe : safe.Substring(0, 160);
        }
    }
}
