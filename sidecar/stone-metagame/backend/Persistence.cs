using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace AiMiner.StoneMetaGame
{
    public sealed class UnsupportedMetaGameSchemaException : Exception
    {
        public UnsupportedMetaGameSchemaException(int version)
            : base("Unsupported metagame schema: " + version) { }
    }

    public sealed class MetaGameStateStore
    {
        private const int CurrentSchemaVersion = 2;
        private const int MaximumStateBytes = 8 * 1024 * 1024;
        private readonly string _path;
        private readonly string _backupPath;
        private readonly JavaScriptSerializer _serializer = new JavaScriptSerializer
        {
            MaxJsonLength = MaximumStateBytes
        };

        public MetaGameStateStore(string statePath)
        {
            if (String.IsNullOrWhiteSpace(statePath))
                throw new ArgumentException("State path is required.", nameof(statePath));
            _path = Path.GetFullPath(statePath);
            _backupPath = _path + ".bak";
        }

        public string StatePath { get { return _path; } }

        public MetaGameState LoadOrCreate(DateTimeOffset now)
        {
            MetaGameState state;
            string loadedFrom = null;
            if (TryLoad(_path, out state)) loadedFrom = _path;
            else if (TryLoad(_backupPath, out state)) loadedFrom = _backupPath;
            if (loadedFrom != null)
            {
                int originalVersion = state.SchemaVersion <= 0 ? 1 : state.SchemaVersion;
                Migrate(state);
                Normalize(state, now);
                if (originalVersion < CurrentSchemaVersion)
                {
                    string migrationBackup = _path + ".schema" + originalVersion + ".bak";
                    File.Copy(loadedFrom, migrationBackup, true);
                    Save(state, now);
                }
                return state;
            }

            state = new MetaGameState();
            state.Profile.CreatedAtUtc = now.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
            Normalize(state, now);
            Save(state, now);
            return state;
        }

        public void Save(MetaGameState state, DateTimeOffset now)
        {
            if (state == null) throw new ArgumentNullException(nameof(state));
            Normalize(state, now);
            string payload = _serializer.Serialize(state);
            byte[] payloadBytes = new UTF8Encoding(false).GetBytes(payload);
            if (payloadBytes.Length > MaximumStateBytes)
                throw new InvalidDataException("Metagame state exceeds the size limit.");

            var envelope = new StateEnvelope
            {
                SchemaVersion = CurrentSchemaVersion,
                WrittenAtUtc = now.UtcDateTime.ToString("O", CultureInfo.InvariantCulture),
                PayloadJson = payload,
                Sha256 = Sha256(payloadBytes)
            };
            byte[] envelopeBytes = new UTF8Encoding(false).GetBytes(_serializer.Serialize(envelope));
            if (envelopeBytes.Length > MaximumStateBytes)
                throw new InvalidDataException("Metagame state envelope exceeds the size limit.");

            string directory = Path.GetDirectoryName(_path);
            Directory.CreateDirectory(directory);
            string temporary = _path + ".tmp-" + Guid.NewGuid().ToString("N");
            try
            {
                using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write,
                    FileShare.None, 4096, FileOptions.WriteThrough))
                {
                    stream.Write(envelopeBytes, 0, envelopeBytes.Length);
                    stream.Flush(true);
                }

                if (File.Exists(_path))
                {
                    try { File.Replace(temporary, _path, _backupPath, true); }
                    catch (PlatformNotSupportedException)
                    {
                        File.Copy(_path, _backupPath, true);
                        File.Delete(_path);
                        File.Move(temporary, _path);
                    }
                }
                else
                {
                    File.Move(temporary, _path);
                }
            }
            finally
            {
                try { if (File.Exists(temporary)) File.Delete(temporary); }
                catch { }
            }
        }

        private bool TryLoad(string path, out MetaGameState state)
        {
            state = null;
            try
            {
                if (!File.Exists(path)) return false;
                var info = new FileInfo(path);
                if (info.Length <= 0 || info.Length > MaximumStateBytes) return false;
                byte[] bytes = File.ReadAllBytes(path);
                string json = new UTF8Encoding(false, true).GetString(bytes);
                StateEnvelope envelope = _serializer.Deserialize<StateEnvelope>(json);
                if (envelope == null || envelope.SchemaVersion < 1
                    || String.IsNullOrEmpty(envelope.PayloadJson)
                    || String.IsNullOrEmpty(envelope.Sha256)) return false;
                if (envelope.SchemaVersion > CurrentSchemaVersion)
                    throw new UnsupportedMetaGameSchemaException(envelope.SchemaVersion);
                byte[] payloadBytes = new UTF8Encoding(false).GetBytes(envelope.PayloadJson);
                if (!FixedTimeEquals(envelope.Sha256, Sha256(payloadBytes))) return false;
                state = _serializer.Deserialize<MetaGameState>(envelope.PayloadJson);
                if (state == null) return false;
                return true;
            }
            catch (UnsupportedMetaGameSchemaException)
            {
                throw;
            }
            catch
            {
                state = null;
                return false;
            }
        }

        private static void Migrate(MetaGameState state)
        {
            if (state.SchemaVersion <= 0) state.SchemaVersion = 1;
            if (state.SchemaVersion > CurrentSchemaVersion)
                throw new UnsupportedMetaGameSchemaException(state.SchemaVersion);
            if (state.SchemaVersion == 1)
            {
                if (state.Profile == null) state.Profile = new ProfileState();
                state.Profile.TitleId = "rookie-miner";
                state.Profile.OnboardingComplete = true;
                if (state.Collection != null)
                    foreach (CollectionEntry entry in state.Collection.Values) entry.Seen = true;
                if (state.Achievements != null)
                    foreach (AchievementProgress progress in state.Achievements.Values)
                    {
                        progress.RewardClaimed = true;
                        progress.RewardClaimedAtUtc = progress.UnlockedAtUtc;
                    }
                state.SchemaVersion = 2;
            }
            if (state.SchemaVersion != CurrentSchemaVersion)
                throw new InvalidDataException("Metagame schema migration is incomplete: " + state.SchemaVersion);
        }

        private static void Normalize(MetaGameState state, DateTimeOffset now)
        {
            state.SchemaVersion = CurrentSchemaVersion;
            if (state.Profile == null) state.Profile = new ProfileState();
            if (state.Mining == null) state.Mining = new MiningState();
            if (state.Gacha == null) state.Gacha = new GachaState();
            if (state.Settings == null) state.Settings = new MetaSettings();
            if (state.RewardGrants == null)
                state.RewardGrants = new Dictionary<string, RewardGrantProgress>(StringComparer.Ordinal);
            if (state.OwnedTitles == null)
                state.OwnedTitles = new Dictionary<string, string>(StringComparer.Ordinal);
            if (state.Achievements == null)
                state.Achievements = new Dictionary<string, AchievementProgress>(StringComparer.Ordinal);
            if (state.Collection == null)
                state.Collection = new Dictionary<string, CollectionEntry>(StringComparer.Ordinal);
            if (state.ProcessedMiningEventIds == null) state.ProcessedMiningEventIds = new List<string>();
            if (state.RecentDrawReceipts == null) state.RecentDrawReceipts = new List<DrawReceipt>();
            if (state.Mining.DailyTotals == null)
                state.Mining.DailyTotals = new Dictionary<string, long>(StringComparer.Ordinal);
            if (state.Gacha.RarityCounts == null)
                state.Gacha.RarityCounts = new Dictionary<string, long>(StringComparer.Ordinal);
            if (state.Gacha.History == null) state.Gacha.History = new List<GachaHistoryEntry>();
            if (state.Gacha.BannerProgress == null)
                state.Gacha.BannerProgress = new Dictionary<string, BannerProgressState>(StringComparer.Ordinal);
            if (String.IsNullOrWhiteSpace(state.Profile.Name)) state.Profile.Name = "Miner";
            if (String.IsNullOrWhiteSpace(state.Profile.Icon)) state.Profile.Icon = "builtin:stone";
            if (String.IsNullOrWhiteSpace(state.Profile.Frame)) state.Profile.Frame = "builtin:default";
            if (state.Profile.CustomIconDataUri == null) state.Profile.CustomIconDataUri = "";
            if (String.IsNullOrWhiteSpace(state.Profile.TitleId)) state.Profile.TitleId = "rookie-miner";
            if (String.IsNullOrWhiteSpace(state.Profile.CreatedAtUtc))
                state.Profile.CreatedAtUtc = now.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
            if (!state.OwnedTitles.ContainsKey("rookie-miner"))
                state.OwnedTitles["rookie-miner"] = state.Profile.CreatedAtUtc;
            state.Mining.TotalStoneMined = Math.Max(0, state.Mining.TotalStoneMined);
            state.Mining.MiningXp = Math.Max(0, state.Mining.MiningXp);
            state.Mining.MiningLevel = Math.Max(1, state.Mining.MiningLevel);
            state.Mining.AvailableMiningPoints = Math.Max(0, state.Mining.AvailableMiningPoints);
            state.Mining.TotalMiningPointsEarned = Math.Max(0, state.Mining.TotalMiningPointsEarned);
            state.Mining.GachaTickets = Math.Max(0, state.Mining.GachaTickets);
            state.Mining.StoneFragments = Math.Max(0, state.Mining.StoneFragments);
            state.Mining.TotalStoneFragmentsEarned = Math.Max(0,
                state.Mining.TotalStoneFragmentsEarned);
            state.Mining.TotalActiveSeconds = Math.Max(0, state.Mining.TotalActiveSeconds);
            state.Mining.LongestSessionSeconds = Math.Max(0, state.Mining.LongestSessionSeconds);
            state.Gacha.TotalDraws = Math.Max(0, state.Gacha.TotalDraws);
            state.Gacha.SsrMisses = Math.Max(0, state.Gacha.SsrMisses);
            state.Gacha.UrMisses = Math.Max(0, state.Gacha.UrMisses);
            state.Gacha.CurrentSsrMissStreak = Math.Max(0, state.Gacha.CurrentSsrMissStreak);
            state.Gacha.WorstSsrMissStreak = Math.Max(0, state.Gacha.WorstSsrMissStreak);
            state.Gacha.CurrentUrMissStreak = Math.Max(0, state.Gacha.CurrentUrMissStreak);
            state.Gacha.WorstUrMissStreak = Math.Max(0, state.Gacha.WorstUrMissStreak);
            state.Gacha.SingleDraws = Math.Max(0, state.Gacha.SingleDraws);
            state.Gacha.TenPullBatches = Math.Max(0, state.Gacha.TenPullBatches);
            state.Settings.MasterVolume = Clamp01(state.Settings.MasterVolume);
            state.Settings.BgmVolume = Clamp01(state.Settings.BgmVolume);
            state.Settings.SfxVolume = Clamp01(state.Settings.SfxVolume);
            if (state.Settings.EffectQuality != "low" && state.Settings.EffectQuality != "normal"
                && state.Settings.EffectQuality != "high") state.Settings.EffectQuality = "normal";
            if (state.Settings.AnimationSpeed != "normal" && state.Settings.AnimationSpeed != "fast"
                && state.Settings.AnimationSpeed != "skip") state.Settings.AnimationSpeed = "normal";

            foreach (BannerProgressState progress in state.Gacha.BannerProgress.Values)
            {
                if (progress.PityCounters == null)
                    progress.PityCounters = new Dictionary<string, int>(StringComparer.Ordinal);
                progress.TotalDraws = Math.Max(0, progress.TotalDraws);
                foreach (string key in progress.PityCounters.Keys.ToList())
                    progress.PityCounters[key] = Math.Max(0, progress.PityCounters[key]);
            }

            string cutoff = now.Date.AddDays(-400).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            foreach (string key in state.Mining.DailyTotals.Keys.ToList())
                if (String.CompareOrdinal(key, cutoff) < 0 || state.Mining.DailyTotals[key] < 0)
                    state.Mining.DailyTotals.Remove(key);
        }

        private static double Clamp01(double value)
        {
            if (Double.IsNaN(value) || Double.IsInfinity(value)) return 0;
            return Math.Max(0, Math.Min(1, value));
        }

        private static string Sha256(byte[] bytes)
        {
            using (SHA256 hash = SHA256.Create())
                return BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
        }

        private static bool FixedTimeEquals(string left, string right)
        {
            if (left == null || right == null || left.Length != right.Length) return false;
            int difference = 0;
            for (int i = 0; i < left.Length; i++) difference |= left[i] ^ right[i];
            return difference == 0;
        }

        private sealed class StateEnvelope
        {
            public int SchemaVersion { get; set; }
            public string WrittenAtUtc { get; set; }
            public string PayloadJson { get; set; }
            public string Sha256 { get; set; }
        }
    }
}
