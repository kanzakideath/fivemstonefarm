using AiMiner.StoneMetaGame;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace AiMiner.UiHost
{
    // AppData can be transparently redirected when the executable is started by an MSIX host.
    // This adapter imports every valid legacy branch into the explicit, non-AppData state path
    // supplied by the controller. Source files are never deleted, and every mutation remains an
    // atomic MetaGameStateStore commit so an interrupted migration can safely resume.
    internal static class MetaGameStateRecovery
    {
        private const int MaximumStateBytes = 8 * 1024 * 1024;
        private const int CurrentSchemaVersion = 2;
        private static readonly Regex SafeEventId = new Regex(
            @"\A[A-Za-z0-9._:-]{8,128}\z", RegexOptions.CultureInvariant);
        private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer
        {
            MaxJsonLength = MaximumStateBytes
        };

        internal sealed class RecoveryReport
        {
            internal string StatePath;
            internal int SourceCount;
            internal int ImportedMiningEvents;
            internal int ImportedDrawRequests;
            internal bool Changed;
            internal readonly List<string> Warnings = new List<string>();
        }

        private sealed class StateEnvelope
        {
            public int SchemaVersion { get; set; }
            public string WrittenAtUtc { get; set; }
            public string PayloadJson { get; set; }
            public string Sha256 { get; set; }
        }

        private sealed class Candidate
        {
            internal string RequestedPath;
            internal string LoadedPath;
            internal string PayloadSha256;
            internal string WrittenAtUtc;
            internal DateTimeOffset WrittenAt;
            internal MetaGameState State;
            internal bool IsCanonical;
        }

        private sealed class MigrationMarker
        {
            public int SchemaVersion { get; set; }
            public string CompletedAtUtc { get; set; }
            public Dictionary<string, string> Sources { get; set; }
                = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        private sealed class DrawImport
        {
            internal string RequestId;
            internal DateTimeOffset DrawnAt;
            internal DrawReceipt Receipt;
            internal List<GachaHistoryEntry> History;
        }

        internal static RecoveryReport Prepare(string dataPath, string canonicalStatePath)
        {
            return PrepareCore(dataPath, canonicalStatePath, null, true);
        }

        private static RecoveryReport PrepareCore(string dataPath, string canonicalStatePath,
            IEnumerable<string> explicitLegacyPaths, bool discoverLegacyPaths)
        {
            string canonical = Path.GetFullPath(canonicalStatePath);
            string root = Path.GetDirectoryName(canonical);
            if (String.IsNullOrEmpty(root))
                throw new InvalidDataException("METAGAME_STATE_DIRECTORY_REQUIRED");
            Directory.CreateDirectory(root);

            var report = new RecoveryReport { StatePath = canonical };
            string lockPath = Path.Combine(root, "state-recovery.lock");
            using (var migrationLock = new FileStream(lockPath, FileMode.OpenOrCreate,
                FileAccess.ReadWrite, FileShare.None))
            {
                List<string> requested = new List<string> { canonical };
                if (explicitLegacyPaths != null) requested.AddRange(explicitLegacyPaths);
                if (discoverLegacyPaths) requested.AddRange(DiscoverLegacyStatePaths());
                requested = requested.Where(x => !String.IsNullOrWhiteSpace(x))
                    .Select(Path.GetFullPath)
                    .Distinct(StringComparer.OrdinalIgnoreCase).ToList();

                var candidates = new List<Candidate>();
                var invalidExisting = new List<string>();
                foreach (string requestedPath in requested)
                {
                    Candidate candidate;
                    bool exists = File.Exists(requestedPath) || File.Exists(requestedPath + ".bak");
                    string error;
                    if (TryLoadCandidate(requestedPath, canonical, out candidate, out error))
                        candidates.Add(candidate);
                    else if (exists)
                        invalidExisting.Add(requestedPath + ":" + error);
                }

                // Never let an older build reinterpret or replace a state written by a
                // newer schema, even when another legacy branch is otherwise readable.
                if (invalidExisting.Any(x => x.IndexOf("STATE_SCHEMA_FUTURE",
                    StringComparison.Ordinal) >= 0))
                    throw new InvalidDataException("METAGAME_STATE_SCHEMA_FUTURE");

                // The same redirected file can be reachable by two textual paths. Keep one copy
                // per signed payload, while preferring the canonical spelling when applicable.
                candidates = candidates.GroupBy(x => x.PayloadSha256, StringComparer.OrdinalIgnoreCase)
                    .Select(group => group.OrderByDescending(x => x.IsCanonical).First()).ToList();
                report.SourceCount = candidates.Count;

                Candidate canonicalCandidate = candidates.FirstOrDefault(x => x.IsCanonical);
                if (canonicalCandidate == null && (File.Exists(canonical) || File.Exists(canonical + ".bak"))
                    && candidates.Count == 0)
                    throw new InvalidDataException("METAGAME_STATE_AND_BACKUP_INVALID");
                if (candidates.Count == 0)
                {
                    if (invalidExisting.Count > 0)
                        throw new InvalidDataException("NO_VALID_METAGAME_STATE:" + invalidExisting[0]);
                    return report;
                }

                List<Candidate> legacy = candidates.Where(x => !x.IsCanonical).ToList();
                if (canonicalCandidate != null && legacy.Count == 0)
                {
                    if (invalidExisting.Count > 0) report.Warnings.Add("INVALID_LEGACY_STATE_IGNORED");
                    return report;
                }
                string markerPath = Path.Combine(root, "state-recovery-sources.json");
                if (canonicalCandidate != null && SourcesAlreadyImported(markerPath, legacy))
                {
                    if (invalidExisting.Count > 0) report.Warnings.Add("INVALID_LEGACY_STATE_IGNORED");
                    return report;
                }

                MetaGameCatalog catalog = MetaGameCatalog.Load(dataPath);
                Candidate baseCandidate = canonicalCandidate ?? SelectBase(candidates);
                EnsureExactMergePreconditions(candidates,
                    catalog.Gacha.Economy.ProcessedEventLimit,
                    catalog.Gacha.Economy.HistoryLimit);
                ProfileState recoveredProfile = Clone(baseCandidate.State.Profile);
                BackupSources(root, requested);
                MetaGameState merged = Clone(baseCandidate.State);
                // A custom avatar can be hundreds of kilobytes. Mining replay deliberately
                // performs one sidecar commit per verified event, so keep that blob out of the
                // temporary replay state and restore it after the transaction journal is merged.
                if (!String.IsNullOrEmpty(merged.Profile.CustomIconDataUri))
                {
                    merged.Profile.Icon = "builtin:stone";
                    merged.Profile.CustomIconDataUri = "";
                }
                string staging = Path.Combine(root, ".state-recovery-"
                    + Guid.NewGuid().ToString("N") + ".json");
                var store = new MetaGameStateStore(staging);
                store.Save(merged, DateTimeOffset.UtcNow);

                var knownMining = new HashSet<string>(merged.ProcessedMiningEventIds
                    .Where(IsSafeEventId), StringComparer.Ordinal);
                var miningImports = new List<KeyValuePair<string, DateTimeOffset>>();
                List<Candidate> miningCandidates = MiningImportCandidates(
                    candidates, baseCandidate,
                    catalog.Gacha.Economy.ProcessedEventLimit, report);
                foreach (Candidate candidate in miningCandidates.OrderBy(x => x.WrittenAt))
                {
                    DateTimeOffset completedAt = MiningTimestamp(candidate);
                    foreach (string eventId in candidate.State.ProcessedMiningEventIds)
                    {
                        if (!IsSafeEventId(eventId))
                        {
                            report.Warnings.Add("INVALID_MINING_EVENT_SKIPPED");
                            continue;
                        }
                        if (knownMining.Add(eventId))
                            miningImports.Add(new KeyValuePair<string, DateTimeOffset>(eventId, completedAt));
                    }
                }

                var service = new MetaGameService(catalog, store);
                foreach (KeyValuePair<string, DateTimeOffset> item in miningImports)
                {
                    MutationResult result = service.RecordVerifiedMiningSuccess(item.Key, item.Value);
                    if (!result.Ok) throw new InvalidDataException("MINING_RECOVERY_FAILED:" + result.Error);
                    if (!result.Duplicate) report.ImportedMiningEvents++;
                }

                merged = store.LoadOrCreate(DateTimeOffset.UtcNow);
                ImportGachaBranches(merged, candidates, catalog, report);
                MergeDailyAndActivity(merged, candidates);
                MergeCollectionMetadata(merged, candidates);
                MergeOwnedTitles(merged, candidates);
                MergeAchievementsAndGrants(merged, candidates, out List<string> grantsToClaim);
                merged.Settings = Clone(baseCandidate.State.Settings);
                merged.Profile = recoveredProfile;
                store.Save(merged, DateTimeOffset.UtcNow);

                // Claim only grants that were already claimed in another branch but not in the
                // selected base. This reuses the verified sidecar reward resolver and prevents
                // both lost payouts and duplicate payouts.
                service = new MetaGameService(catalog, store);
                foreach (string grantId in grantsToClaim.Distinct(StringComparer.Ordinal))
                {
                    MutationResult claim = service.ClaimReward(grantId);
                    if (!claim.Ok) throw new InvalidDataException("REWARD_RECOVERY_FAILED:" + grantId);
                }

                MetaGameState beforeUnlock = store.LoadOrCreate(DateTimeOffset.UtcNow);
                MutationResult refresh = service.UpdateProfile(beforeUnlock.Profile.Name,
                    beforeUnlock.Profile.Icon, beforeUnlock.Profile.Frame,
                    beforeUnlock.Profile.CustomIconDataUri, beforeUnlock.Profile.TitleId);
                if (!refresh.Ok)
                {
                    CollectionEntry first = beforeUnlock.Collection.Values.FirstOrDefault();
                    if (first != null) service.SetCollectionFavorite(first.ItemId, first.Favorite);
                    else report.Warnings.Add("DERIVED_ACHIEVEMENT_REFRESH_SKIPPED");
                }

                MetaGameState completed = store.LoadOrCreate(DateTimeOffset.UtcNow);
                PromoteStagedState(staging, canonical);
                WriteMarker(markerPath, legacy, report);
                WriteAuditLog(root, candidates, completed, report);
                report.Changed = true;
                if (invalidExisting.Count > 0) report.Warnings.Add("INVALID_LEGACY_STATE_IGNORED");
                return report;
            }
        }

        private static IEnumerable<string> DiscoverLegacyStatePaths()
        {
            var result = new List<string>();
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (!String.IsNullOrWhiteSpace(local))
                result.Add(Path.Combine(local, "AI採掘機", "metagame", "state.json"));

            string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (String.IsNullOrWhiteSpace(profile)) return result;
            string packages = Path.Combine(profile, "AppData", "Local", "Packages");
            try
            {
                if (Directory.Exists(packages))
                    foreach (string package in Directory.EnumerateDirectories(packages))
                    {
                        string candidate = Path.Combine(package, "LocalCache", "Local",
                            "AI採掘機", "metagame", "state.json");
                        if (File.Exists(candidate) || File.Exists(candidate + ".bak"))
                            result.Add(candidate);
                    }
            }
            catch (UnauthorizedAccessException) { }
            catch (IOException) { }
            return result;
        }

        private static bool TryLoadCandidate(string requestedPath, string canonical,
            out Candidate candidate, out string error)
        {
            candidate = null;
            error = "STATE_NOT_FOUND";
            foreach (string path in new[] { requestedPath, requestedPath + ".bak" })
            {
                StateEnvelope envelope;
                MetaGameState raw;
                string envelopeError;
                if (!TryReadEnvelope(path, out envelope, out raw, out envelopeError))
                {
                    if (File.Exists(path)) error = envelopeError;
                    continue;
                }
                try
                {
                    MetaGameState normalized = NormalizeWithoutTouchingSource(path);
                    DateTimeOffset written;
                    if (!TryParseUtc(envelope.WrittenAtUtc, out written))
                        written = File.GetLastWriteTimeUtc(path);
                    candidate = new Candidate
                    {
                        RequestedPath = Path.GetFullPath(requestedPath),
                        LoadedPath = Path.GetFullPath(path),
                        PayloadSha256 = envelope.Sha256.ToLowerInvariant(),
                        WrittenAtUtc = envelope.WrittenAtUtc ?? "",
                        WrittenAt = written,
                        State = normalized,
                        IsCanonical = String.Equals(Path.GetFullPath(requestedPath), canonical,
                            StringComparison.OrdinalIgnoreCase)
                    };
                    return true;
                }
                catch (Exception exception)
                {
                    error = "STATE_NORMALIZE_FAILED:" + exception.GetType().Name;
                }
            }
            return false;
        }

        private static bool TryReadEnvelope(string path, out StateEnvelope envelope,
            out MetaGameState state, out string error)
        {
            envelope = null;
            state = null;
            error = "STATE_NOT_FOUND";
            try
            {
                if (!File.Exists(path)) return false;
                var info = new FileInfo(path);
                if (info.Length <= 0 || info.Length > MaximumStateBytes)
                {
                    error = "STATE_SIZE_INVALID";
                    return false;
                }
                string json = new UTF8Encoding(false, true).GetString(File.ReadAllBytes(path));
                envelope = Serializer.Deserialize<StateEnvelope>(json);
                if (envelope != null && envelope.SchemaVersion > CurrentSchemaVersion)
                {
                    error = "STATE_SCHEMA_FUTURE";
                    return false;
                }
                if (envelope == null || envelope.SchemaVersion < 1
                    || String.IsNullOrEmpty(envelope.PayloadJson)
                    || String.IsNullOrEmpty(envelope.Sha256))
                {
                    error = "STATE_ENVELOPE_INVALID";
                    return false;
                }
                byte[] payload = new UTF8Encoding(false).GetBytes(envelope.PayloadJson);
                if (!FixedTimeEquals(envelope.Sha256, Sha256(payload)))
                {
                    error = "STATE_HASH_INVALID";
                    return false;
                }
                state = Serializer.Deserialize<MetaGameState>(envelope.PayloadJson);
                if (state == null)
                {
                    error = "STATE_PAYLOAD_INVALID";
                    return false;
                }
                return true;
            }
            catch (Exception exception)
            {
                error = "STATE_READ_FAILED:" + exception.GetType().Name;
                return false;
            }
        }

        private static MetaGameState NormalizeWithoutTouchingSource(string sourcePath)
        {
            string temporaryRoot = Path.Combine(Path.GetTempPath(),
                "ai-miner-state-read-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temporaryRoot);
            string temporaryState = Path.Combine(temporaryRoot, "state.json");
            try
            {
                File.Copy(sourcePath, temporaryState, true);
                return new MetaGameStateStore(temporaryState).LoadOrCreate(DateTimeOffset.UtcNow);
            }
            finally
            {
                try { Directory.Delete(temporaryRoot, true); }
                catch { }
            }
        }

        private static Candidate SelectBase(IEnumerable<Candidate> candidates)
        {
            return candidates.OrderByDescending(x => x.State.ProcessedMiningEventIds.Count
                    + x.State.Gacha.History.Count)
                .ThenByDescending(x => x.State.Mining.TotalStoneMined)
                .ThenByDescending(x => x.State.Gacha.TotalDraws)
                .ThenByDescending(x => x.State.Collection.Count)
                .ThenByDescending(x => x.State.RewardGrants.Count).First();
        }

        private static void EnsureExactMergePreconditions(IEnumerable<Candidate> candidates,
            int processedMiningEventLimit, int gachaHistoryLimit)
        {
            var requestFingerprints = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (Candidate candidate in candidates)
            {
                long expectedMiningHistory = Math.Min(
                    Math.Max(0L, candidate.State.Mining.TotalStoneMined),
                    processedMiningEventLimit);
                if (expectedMiningHistory != candidate.State.ProcessedMiningEventIds.Count
                    || candidate.State.ProcessedMiningEventIds
                        .Distinct(StringComparer.Ordinal).Count()
                        != candidate.State.ProcessedMiningEventIds.Count)
                    throw new InvalidDataException("MINING_HISTORY_NOT_EXACT");
                long expectedGachaHistory = Math.Min(
                    Math.Max(0L, candidate.State.Gacha.TotalDraws), gachaHistoryLimit);
                if (expectedGachaHistory != candidate.State.Gacha.History.Count)
                    throw new InvalidDataException("GACHA_HISTORY_NOT_EXACT");
                foreach (IGrouping<string, GachaHistoryEntry> group in candidate.State.Gacha.History
                    .Where(x => x != null && !String.IsNullOrEmpty(x.RequestId))
                    .GroupBy(x => x.RequestId, StringComparer.Ordinal))
                {
                    string fingerprint = Serializer.Serialize(group.OrderBy(x => x.Sequence).ToList());
                    string existing;
                    if (requestFingerprints.TryGetValue(group.Key, out existing)
                        && !String.Equals(existing, fingerprint, StringComparison.Ordinal))
                        throw new InvalidDataException("GACHA_REQUEST_CONFLICT:" + group.Key);
                    requestFingerprints[group.Key] = fingerprint;
                }
            }
        }

        private static List<Candidate> MiningImportCandidates(List<Candidate> candidates,
            Candidate baseCandidate, int processedMiningEventLimit,
            RecoveryReport report)
        {
            if (baseCandidate.State.Mining.TotalStoneMined <= processedMiningEventLimit)
            {
                if (candidates.Any(x => x.State.Mining.TotalStoneMined
                    > processedMiningEventLimit))
                    throw new InvalidDataException("MINING_HISTORY_WINDOW_CONFLICT");
                return candidates;
            }

            // Once the sidecar's bounded deduplication window is full, an older
            // branch can contain ids already represented by the canonical total
            // but naturally absent from its most-recent window. Replaying those
            // ids would duplicate XP, points and achievements. Preserve the base
            // total and only accept branches that cannot be newer than it.
            if (candidates.Any(x => x.State.Mining.TotalStoneMined
                > baseCandidate.State.Mining.TotalStoneMined))
                throw new InvalidDataException("MINING_HISTORY_WINDOW_CONFLICT");
            if (candidates.Count > 1)
                report.Warnings.Add("BOUNDED_MINING_HISTORY_PRESERVED_BASE");
            return new List<Candidate> { baseCandidate };
        }

        private static void ImportGachaBranches(MetaGameState state, List<Candidate> candidates,
            MetaGameCatalog catalog, RecoveryReport report)
        {
            var knownRequests = new HashSet<string>(state.Gacha.History
                .Where(x => !String.IsNullOrEmpty(x.RequestId)).Select(x => x.RequestId),
                StringComparer.Ordinal);
            foreach (DrawReceipt receipt in state.RecentDrawReceipts)
                if (!String.IsNullOrEmpty(receipt.RequestId)) knownRequests.Add(receipt.RequestId);

            bool completeHistory = state.Gacha.TotalDraws == state.Gacha.History.Count
                && candidates.All(x => x.State.Gacha.TotalDraws == x.State.Gacha.History.Count);
            var imports = new Dictionary<string, DrawImport>(StringComparer.Ordinal);
            foreach (Candidate candidate in candidates)
            {
                var receipts = candidate.State.RecentDrawReceipts
                    .Where(x => x != null && !String.IsNullOrEmpty(x.RequestId))
                    .GroupBy(x => x.RequestId, StringComparer.Ordinal)
                    .ToDictionary(x => x.Key, x => x.Last(), StringComparer.Ordinal);
                foreach (IGrouping<string, GachaHistoryEntry> group in candidate.State.Gacha.History
                    .Where(x => x != null && !String.IsNullOrEmpty(x.RequestId))
                    .GroupBy(x => x.RequestId, StringComparer.Ordinal))
                {
                    if (knownRequests.Contains(group.Key)) continue;
                    DrawReceipt receipt;
                    receipts.TryGetValue(group.Key, out receipt);
                    var import = new DrawImport
                    {
                        RequestId = group.Key,
                        Receipt = receipt == null ? null : Clone(receipt),
                        History = group.OrderBy(x => x.Sequence).Select(Clone).ToList(),
                        DrawnAt = ParseUtcOr(group.First().DrawnAtUtc, candidate.WrittenAt)
                    };
                    DrawImport existing;
                    if (imports.TryGetValue(group.Key, out existing))
                    {
                        if (!DrawImportEquals(existing, import))
                            throw new InvalidDataException(
                                "GACHA_REQUEST_CONFLICT:" + group.Key);
                    }
                    else
                        imports[group.Key] = import;
                }
            }

            var importedEntries = new List<GachaHistoryEntry>();
            foreach (DrawImport import in imports.Values.OrderBy(x => x.DrawnAt)
                .ThenBy(x => x.RequestId, StringComparer.Ordinal))
            {
                if (!knownRequests.Add(import.RequestId)) continue;
                if (import.History.Count == 0) continue;
                if (!DrawReceiptMatchesHistory(import.Receipt, import.History))
                    throw new InvalidDataException(
                        "GACHA_RECEIPT_NOT_EXACT:" + import.RequestId);
                long points = Math.Max(0, import.Receipt.PointsSpent);
                int tickets = Math.Max(0, import.Receipt.TicketsSpent);
                if (state.Mining.AvailableMiningPoints < points
                    || state.Mining.GachaTickets < tickets)
                    report.Warnings.Add("CURRENCY_BRANCH_CONFLICT_CLAMPED");
                state.Mining.AvailableMiningPoints = Math.Max(0,
                    state.Mining.AvailableMiningPoints - points);
                state.Mining.GachaTickets = Math.Max(0, state.Mining.GachaTickets - tickets);
                long fragments = import.Receipt.Results.Sum(
                    x => (long)Math.Max(0, x.FragmentsGained));
                state.Mining.StoneFragments = checked(state.Mining.StoneFragments + fragments);
                state.Mining.TotalStoneFragmentsEarned = checked(
                    state.Mining.TotalStoneFragmentsEarned + fragments);
                state.RecentDrawReceipts.Add(Clone(import.Receipt));

                foreach (GachaHistoryEntry entry in import.History)
                {
                    if (!catalog.ItemsById.ContainsKey(entry.ItemId)
                        || !catalog.RaritiesById.ContainsKey(entry.Rarity)
                        || !catalog.BannersById.ContainsKey(entry.BannerId))
                    {
                        report.Warnings.Add("UNKNOWN_GACHA_RESULT_SKIPPED");
                        continue;
                    }
                    GachaHistoryEntry copy = Clone(entry);
                    importedEntries.Add(copy);
                    state.Gacha.History.Add(copy);
                    AddCollectionResult(state, copy);
                }
                report.ImportedDrawRequests++;
            }

            state.RecentDrawReceipts = state.RecentDrawReceipts
                .Where(x => x != null && !String.IsNullOrEmpty(x.RequestId))
                .GroupBy(x => x.RequestId, StringComparer.Ordinal).Select(x => x.Last())
                .OrderBy(x => ParseUtcOr(x.DrawnAtUtc, DateTimeOffset.MinValue))
                .TakeLastCompat(32).ToList();

            if (completeHistory && state.Gacha.History.Count <= catalog.Gacha.Economy.HistoryLimit)
                RebuildGachaCounters(state, catalog);
            else
                AppendGachaCounters(state, importedEntries, catalog);

            if (state.Gacha.History.Count > catalog.Gacha.Economy.HistoryLimit)
                state.Gacha.History.RemoveRange(0,
                    state.Gacha.History.Count - catalog.Gacha.Economy.HistoryLimit);
        }

        private static bool DrawImportEquals(DrawImport left, DrawImport right)
        {
            if (left == null || right == null) return left == right;
            return String.Equals(Serializer.Serialize(left.Receipt),
                    Serializer.Serialize(right.Receipt), StringComparison.Ordinal)
                && String.Equals(Serializer.Serialize(left.History),
                    Serializer.Serialize(right.History), StringComparison.Ordinal);
        }

        private static bool DrawReceiptMatchesHistory(DrawReceipt receipt,
            IList<GachaHistoryEntry> history)
        {
            if (receipt == null || history == null || receipt.Results == null
                || String.IsNullOrEmpty(receipt.RequestId)
                || receipt.Count != history.Count || receipt.Results.Count != history.Count)
                return false;
            for (int index = 0; index < history.Count; index++)
            {
                GachaHistoryEntry entry = history[index];
                DrawResult result = receipt.Results[index];
                if (!String.Equals(entry.RequestId, receipt.RequestId,
                        StringComparison.Ordinal)
                    || !String.Equals(entry.BannerId, receipt.BannerId,
                        StringComparison.Ordinal)
                    || !String.Equals(entry.ItemId, result.ItemId,
                        StringComparison.Ordinal)
                    || !String.Equals(entry.Rarity, result.Rarity,
                        StringComparison.Ordinal)
                    || entry.WasNew != result.IsNew)
                    return false;
            }
            return true;
        }

        private static void RebuildGachaCounters(MetaGameState state, MetaGameCatalog catalog)
        {
            List<GachaHistoryEntry> history = state.Gacha.History
                .OrderBy(x => ParseUtcOr(x.DrawnAtUtc, DateTimeOffset.MinValue))
                .ThenBy(x => x.RequestId, StringComparer.Ordinal).ThenBy(x => x.Sequence).ToList();
            var gacha = new GachaState();
            foreach (GachaBannerDefinition banner in catalog.Banners)
                gacha.BannerProgress[banner.Id] = NewBannerProgress(banner);

            int ssrOrder = catalog.RarityOrder("SSR");
            int urOrder = catalog.RarityOrder("UR");
            for (int index = 0; index < history.Count; index++)
            {
                GachaHistoryEntry entry = history[index];
                entry.Sequence = index + 1;
                gacha.TotalDraws++;
                long rarityCount;
                gacha.RarityCounts.TryGetValue(entry.Rarity, out rarityCount);
                gacha.RarityCounts[entry.Rarity] = rarityCount + 1;
                int order = catalog.RarityOrder(entry.Rarity);
                if (order >= ssrOrder) gacha.CurrentSsrMissStreak = 0;
                else
                {
                    gacha.CurrentSsrMissStreak++;
                    gacha.WorstSsrMissStreak = Math.Max(gacha.WorstSsrMissStreak,
                        gacha.CurrentSsrMissStreak);
                }
                if (order >= urOrder) gacha.CurrentUrMissStreak = 0;
                else
                {
                    gacha.CurrentUrMissStreak++;
                    gacha.WorstUrMissStreak = Math.Max(gacha.WorstUrMissStreak,
                        gacha.CurrentUrMissStreak);
                }
                if (String.IsNullOrEmpty(gacha.HighestRarity)
                    || order > catalog.RarityOrder(gacha.HighestRarity))
                    gacha.HighestRarity = entry.Rarity;

                GachaBannerDefinition banner;
                if (catalog.BannersById.TryGetValue(entry.BannerId, out banner))
                {
                    BannerProgressState progress = gacha.BannerProgress[banner.Id];
                    progress.TotalDraws++;
                    ApplyPityResult(progress, banner, entry.Rarity, catalog);
                }
            }

            foreach (IGrouping<string, GachaHistoryEntry> batch in history.GroupBy(x => x.RequestId,
                StringComparer.Ordinal))
            {
                int declared = batch.First().BatchSize;
                if (declared == 10) gacha.TenPullBatches++;
                else gacha.SingleDraws++;
                gacha.BestHighRarityBatch = Math.Max(gacha.BestHighRarityBatch,
                    batch.Count(x => catalog.RarityOrder(x.Rarity) >= ssrOrder));
                gacha.BestLegendaryBatch = Math.Max(gacha.BestLegendaryBatch,
                    batch.Count(x => x.Rarity == "LEGENDARY"));
            }
            BannerProgressState primary = gacha.BannerProgress[catalog.DefaultBanner.Id];
            int value;
            gacha.SsrMisses = primary.PityCounters.TryGetValue("ssr-pity", out value) ? value : 0;
            gacha.UrMisses = primary.PityCounters.TryGetValue("ur-pity", out value) ? value : 0;
            gacha.History = history;
            state.Gacha = gacha;
        }

        private static void AppendGachaCounters(MetaGameState state,
            List<GachaHistoryEntry> imported, MetaGameCatalog catalog)
        {
            foreach (IGrouping<string, GachaHistoryEntry> batch in imported.GroupBy(x => x.RequestId,
                StringComparer.Ordinal))
            {
                if (batch.First().BatchSize == 10) state.Gacha.TenPullBatches++;
                else state.Gacha.SingleDraws++;
                state.Gacha.BestHighRarityBatch = Math.Max(state.Gacha.BestHighRarityBatch,
                    batch.Count(x => catalog.RarityOrder(x.Rarity) >= catalog.RarityOrder("SSR")));
                state.Gacha.BestLegendaryBatch = Math.Max(state.Gacha.BestLegendaryBatch,
                    batch.Count(x => x.Rarity == "LEGENDARY"));
            }
            foreach (GachaHistoryEntry entry in imported)
            {
                state.Gacha.TotalDraws++;
                long count;
                state.Gacha.RarityCounts.TryGetValue(entry.Rarity, out count);
                state.Gacha.RarityCounts[entry.Rarity] = count + 1;
                if (String.IsNullOrEmpty(state.Gacha.HighestRarity)
                    || catalog.RarityOrder(entry.Rarity) > catalog.RarityOrder(state.Gacha.HighestRarity))
                    state.Gacha.HighestRarity = entry.Rarity;
                GachaBannerDefinition banner;
                BannerProgressState progress;
                if (catalog.BannersById.TryGetValue(entry.BannerId, out banner)
                    && state.Gacha.BannerProgress.TryGetValue(entry.BannerId, out progress))
                {
                    progress.TotalDraws++;
                    ApplyPityResult(progress, banner, entry.Rarity, catalog);
                }
            }
            BannerProgressState primary;
            int value;
            if (state.Gacha.BannerProgress.TryGetValue(catalog.DefaultBanner.Id, out primary))
            {
                state.Gacha.SsrMisses = primary.PityCounters.TryGetValue("ssr-pity", out value) ? value : 0;
                state.Gacha.UrMisses = primary.PityCounters.TryGetValue("ur-pity", out value) ? value : 0;
            }
        }

        private static BannerProgressState NewBannerProgress(GachaBannerDefinition banner)
        {
            var result = new BannerProgressState { BannerId = banner.Id };
            foreach (PityTrackDefinition pity in banner.PityTracks) result.PityCounters[pity.Id] = 0;
            return result;
        }

        private static void ApplyPityResult(BannerProgressState progress,
            GachaBannerDefinition banner, string rarity, MetaGameCatalog catalog)
        {
            int order = catalog.RarityOrder(rarity);
            foreach (PityTrackDefinition pity in banner.PityTracks)
                progress.PityCounters[pity.Id] = order >= catalog.RarityOrder(pity.ResetAtOrAbove)
                    ? 0 : checked(progress.PityCounters[pity.Id] + 1);
        }

        private static void AddCollectionResult(MetaGameState state, GachaHistoryEntry history)
        {
            CollectionEntry entry;
            if (!state.Collection.TryGetValue(history.ItemId, out entry))
            {
                entry = new CollectionEntry
                {
                    ItemId = history.ItemId,
                    FirstAcquiredAtUtc = history.DrawnAtUtc,
                    Seen = false
                };
                state.Collection[history.ItemId] = entry;
            }
            entry.Count = checked(entry.Count + 1);
            if (String.IsNullOrEmpty(entry.FirstAcquiredAtUtc)
                || CompareUtc(history.DrawnAtUtc, entry.FirstAcquiredAtUtc) < 0)
                entry.FirstAcquiredAtUtc = history.DrawnAtUtc;
            if (String.IsNullOrEmpty(entry.LastAcquiredAtUtc)
                || CompareUtc(history.DrawnAtUtc, entry.LastAcquiredAtUtc) > 0)
                entry.LastAcquiredAtUtc = history.DrawnAtUtc;
        }

        private static void MergeCollectionMetadata(MetaGameState state, IEnumerable<Candidate> candidates)
        {
            foreach (Candidate candidate in candidates)
                foreach (KeyValuePair<string, CollectionEntry> pair in candidate.State.Collection)
                {
                    CollectionEntry current;
                    if (!state.Collection.TryGetValue(pair.Key, out current))
                    {
                        state.Collection[pair.Key] = Clone(pair.Value);
                        continue;
                    }
                    current.Count = Math.Max(current.Count, pair.Value.Count);
                    current.Favorite |= pair.Value.Favorite;
                    current.Seen |= pair.Value.Seen;
                    if (String.IsNullOrEmpty(current.FirstAcquiredAtUtc)
                        || CompareUtc(pair.Value.FirstAcquiredAtUtc, current.FirstAcquiredAtUtc) < 0)
                        current.FirstAcquiredAtUtc = pair.Value.FirstAcquiredAtUtc;
                    if (String.IsNullOrEmpty(current.LastAcquiredAtUtc)
                        || CompareUtc(pair.Value.LastAcquiredAtUtc, current.LastAcquiredAtUtc) > 0)
                        current.LastAcquiredAtUtc = pair.Value.LastAcquiredAtUtc;
                }
        }

        private static void MergeOwnedTitles(MetaGameState state, IEnumerable<Candidate> candidates)
        {
            foreach (Candidate candidate in candidates)
                foreach (KeyValuePair<string, string> title in candidate.State.OwnedTitles)
                {
                    string existing;
                    if (!state.OwnedTitles.TryGetValue(title.Key, out existing)
                        || CompareUtc(title.Value, existing) < 0)
                        state.OwnedTitles[title.Key] = title.Value;
                }
        }

        private static void MergeAchievementsAndGrants(MetaGameState state,
            IEnumerable<Candidate> candidates, out List<string> grantsToClaim)
        {
            grantsToClaim = new List<string>();
            foreach (Candidate candidate in candidates)
            {
                foreach (KeyValuePair<string, RewardGrantProgress> pair in candidate.State.RewardGrants)
                {
                    RewardGrantProgress current;
                    if (!state.RewardGrants.TryGetValue(pair.Key, out current))
                    {
                        current = Clone(pair.Value);
                        if (current.Claimed)
                        {
                            current.Claimed = false;
                            current.ClaimedAtUtc = "";
                            grantsToClaim.Add(pair.Key);
                        }
                        state.RewardGrants[pair.Key] = current;
                    }
                    else
                    {
                        if (CompareUtc(pair.Value.UnlockedAtUtc, current.UnlockedAtUtc) < 0)
                            current.UnlockedAtUtc = pair.Value.UnlockedAtUtc;
                        if (pair.Value.Claimed && !current.Claimed) grantsToClaim.Add(pair.Key);
                    }
                }

                foreach (KeyValuePair<string, AchievementProgress> pair in candidate.State.Achievements)
                {
                    AchievementProgress current;
                    if (!state.Achievements.TryGetValue(pair.Key, out current))
                    {
                        current = Clone(pair.Value);
                        if (pair.Value.RewardClaimed
                            && state.RewardGrants.ContainsKey("achievement:" + pair.Key))
                        {
                            current.RewardClaimed = false;
                            current.RewardClaimedAtUtc = "";
                        }
                        state.Achievements[pair.Key] = current;
                    }
                    else
                    {
                        if (CompareUtc(pair.Value.UnlockedAtUtc, current.UnlockedAtUtc) < 0)
                            current.UnlockedAtUtc = pair.Value.UnlockedAtUtc;
                        if (pair.Value.RewardClaimed
                            && !state.RewardGrants.ContainsKey("achievement:" + pair.Key))
                        {
                            current.RewardClaimed = true;
                            current.RewardClaimedAtUtc = pair.Value.RewardClaimedAtUtc;
                        }
                    }
                }
            }
        }

        private static void MergeDailyAndActivity(MetaGameState state, List<Candidate> candidates)
        {
            bool completeIds = candidates.All(x =>
                x.State.Mining.TotalStoneMined == x.State.ProcessedMiningEventIds.Count);
            bool disjoint = true;
            var ids = new HashSet<string>(StringComparer.Ordinal);
            foreach (Candidate candidate in candidates)
                foreach (string id in candidate.State.ProcessedMiningEventIds)
                    if (!ids.Add(id)) disjoint = false;

            var daily = new Dictionary<string, long>(StringComparer.Ordinal);
            foreach (Candidate candidate in candidates)
                foreach (KeyValuePair<string, long> pair in candidate.State.Mining.DailyTotals)
                {
                    long current;
                    daily.TryGetValue(pair.Key, out current);
                    daily[pair.Key] = completeIds && disjoint
                        ? checked(current + Math.Max(0, pair.Value))
                        : Math.Max(current, Math.Max(0, pair.Value));
                }
            if (daily.Count > 0) state.Mining.DailyTotals = daily;
            state.Mining.TotalActiveSeconds = candidates.Max(x => x.State.Mining.TotalActiveSeconds);
            state.Mining.LongestSessionSeconds = candidates.Max(x => x.State.Mining.LongestSessionSeconds);
            state.Mining.LastMinedAtUtc = candidates.Select(x => x.State.Mining.LastMinedAtUtc)
                .Where(x => !String.IsNullOrEmpty(x)).OrderBy(x => ParseUtcOr(x,
                    DateTimeOffset.MinValue)).LastOrDefault() ?? state.Mining.LastMinedAtUtc;
        }

        private static DateTimeOffset MiningTimestamp(Candidate candidate)
        {
            return ParseUtcOr(candidate.State.Mining.LastMinedAtUtc, candidate.WrittenAt);
        }

        private static bool SourcesAlreadyImported(string markerPath, IEnumerable<Candidate> legacy)
        {
            try
            {
                if (!File.Exists(markerPath)) return false;
                MigrationMarker marker = Serializer.Deserialize<MigrationMarker>(
                    File.ReadAllText(markerPath, Encoding.UTF8));
                if (marker == null || marker.SchemaVersion != 1 || marker.Sources == null) return false;
                foreach (Candidate source in legacy)
                {
                    string fingerprint;
                    if (!marker.Sources.TryGetValue(source.RequestedPath, out fingerprint)
                        || !String.Equals(fingerprint, source.PayloadSha256,
                            StringComparison.OrdinalIgnoreCase)) return false;
                }
                return true;
            }
            catch { return false; }
        }

        private static void WriteMarker(string markerPath, IEnumerable<Candidate> legacy,
            RecoveryReport report)
        {
            var marker = new MigrationMarker
            {
                SchemaVersion = 1,
                CompletedAtUtc = DateTimeOffset.UtcNow.UtcDateTime.ToString("O",
                    CultureInfo.InvariantCulture),
                Sources = legacy.ToDictionary(x => x.RequestedPath, x => x.PayloadSha256,
                    StringComparer.OrdinalIgnoreCase)
            };
            WriteAtomicText(markerPath, Serializer.Serialize(marker));
        }

        private static void BackupSources(string root, IEnumerable<string> requestedPaths)
        {
            string backupRoot = Path.Combine(root, "migration-backups",
                DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff", CultureInfo.InvariantCulture));
            int index = 0;
            foreach (string requested in requestedPaths.Distinct(StringComparer.OrdinalIgnoreCase))
                foreach (string source in new[] { requested, requested + ".bak" })
                {
                    if (!File.Exists(source)) continue;
                    Directory.CreateDirectory(backupRoot);
                    string name = (++index).ToString("D3", CultureInfo.InvariantCulture)
                        + "-" + Sha256(Encoding.UTF8.GetBytes(Path.GetFullPath(source))).Substring(0, 12)
                        + "-" + Path.GetFileName(source);
                    File.Copy(source, Path.Combine(backupRoot, name), true);
                }
        }

        private static void PromoteStagedState(string staging, string canonical)
        {
            if (!File.Exists(staging))
                throw new InvalidDataException("RECOVERY_STAGING_STATE_MISSING");
            Directory.CreateDirectory(Path.GetDirectoryName(canonical));
            if (File.Exists(canonical))
            {
                string preserved = canonical + ".pre-recovery-"
                    + DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff",
                        CultureInfo.InvariantCulture) + ".bak";
                File.Replace(staging, canonical, preserved, true);
            }
            else
                File.Move(staging, canonical);
            try { if (File.Exists(staging + ".bak")) File.Delete(staging + ".bak"); }
            catch { }
        }

        private static void WriteAuditLog(string root, IEnumerable<Candidate> sources,
            MetaGameState state, RecoveryReport report)
        {
            try
            {
                string sourceSummary = String.Join(",", sources.Select(x =>
                    x.PayloadSha256.Substring(0, 12)));
                string line = DateTimeOffset.UtcNow.UtcDateTime.ToString("O", CultureInfo.InvariantCulture)
                    + " sources=" + sourceSummary
                    + " mined=" + state.Mining.TotalStoneMined.ToString(CultureInfo.InvariantCulture)
                    + " draws=" + state.Gacha.TotalDraws.ToString(CultureInfo.InvariantCulture)
                    + " importedMining=" + report.ImportedMiningEvents.ToString(CultureInfo.InvariantCulture)
                    + " importedDrawRequests=" + report.ImportedDrawRequests.ToString(CultureInfo.InvariantCulture)
                    + Environment.NewLine;
                File.AppendAllText(Path.Combine(root, "state-recovery.log"), line,
                    new UTF8Encoding(false));
            }
            catch { }
        }

        private static void WriteAtomicText(string path, string text)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            string temporary = path + ".tmp-" + Guid.NewGuid().ToString("N");
            try
            {
                File.WriteAllText(temporary, text, new UTF8Encoding(false));
                if (File.Exists(path)) File.Replace(temporary, path, path + ".bak", true);
                else File.Move(temporary, path);
            }
            finally
            {
                try { if (File.Exists(temporary)) File.Delete(temporary); }
                catch { }
            }
        }

        private static bool IsSafeEventId(string value)
        {
            return !String.IsNullOrEmpty(value) && SafeEventId.IsMatch(value);
        }

        private static T Clone<T>(T value)
        {
            return value == null ? default(T) : Serializer.Deserialize<T>(Serializer.Serialize(value));
        }

        private static int CompareUtc(string left, string right)
        {
            DateTimeOffset l = ParseUtcOr(left, DateTimeOffset.MinValue);
            DateTimeOffset r = ParseUtcOr(right, DateTimeOffset.MinValue);
            return l.CompareTo(r);
        }

        private static bool TryParseUtc(string value, out DateTimeOffset result)
        {
            return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind, out result);
        }

        private static DateTimeOffset ParseUtcOr(string value, DateTimeOffset fallback)
        {
            DateTimeOffset result;
            return TryParseUtc(value, out result) ? result : fallback;
        }

        private static string Sha256(byte[] bytes)
        {
            using (SHA256 hash = SHA256.Create())
                return BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-", "")
                    .ToLowerInvariant();
        }

        private static bool FixedTimeEquals(string left, string right)
        {
            if (left == null || right == null || left.Length != right.Length) return false;
            int difference = 0;
            for (int index = 0; index < left.Length; index++) difference |= left[index] ^ right[index];
            return difference == 0;
        }

        internal static bool RunSelfTests(string dataPath, out string error)
        {
            error = null;
            string root = Path.Combine(Path.GetTempPath(),
                "ai-miner-state-recovery-test-" + Guid.NewGuid().ToString("N"));
            try
            {
                Directory.CreateDirectory(root);
                string first = Path.Combine(root, "legacy-a", "state.json");
                string second = Path.Combine(root, "legacy-b", "state.json");
                string canonical = Path.Combine(root, "saved-games", "state.json");
                SeedBranch(dataPath, first, "branchA", "Alpha", "draw:test:branchA");
                SeedBranch(dataPath, second, "branchB", "Miner", "draw:test:branchB");

                RecoveryReport report = PrepareCore(dataPath, canonical,
                    new[] { first, second }, false);
                MetaGameState state = new MetaGameStateStore(canonical)
                    .LoadOrCreate(DateTimeOffset.UtcNow);
                if (!report.Changed || report.ImportedMiningEvents != 100
                    || report.ImportedDrawRequests != 1
                    || state.Mining.TotalStoneMined != 200
                    || state.ProcessedMiningEventIds.Distinct(StringComparer.Ordinal).Count() != 200
                    || state.Gacha.TotalDraws != 2
                    || state.Gacha.History.Select(x => x.RequestId)
                        .Distinct(StringComparer.Ordinal).Count() != 2
                    || state.Collection.Values.Sum(x => x.Count) < 2
                    || state.Mining.AvailableMiningPoints != 0
                    || state.Profile.Name != "Alpha")
                {
                    error = "state branches were not merged losslessly: changed=" + report.Changed
                        + ",miningImported=" + report.ImportedMiningEvents
                        + ",drawImported=" + report.ImportedDrawRequests
                        + ",mined=" + state.Mining.TotalStoneMined
                        + ",ids=" + state.ProcessedMiningEventIds.Distinct(StringComparer.Ordinal).Count()
                        + ",draws=" + state.Gacha.TotalDraws
                        + ",requests=" + state.Gacha.History.Select(x => x.RequestId)
                            .Distinct(StringComparer.Ordinal).Count()
                        + ",collection=" + state.Collection.Values.Sum(x => x.Count)
                        + ",points=" + state.Mining.AvailableMiningPoints
                        + ",profile=" + state.Profile.Name;
                    return false;
                }

                byte[] before = File.ReadAllBytes(canonical);
                RecoveryReport repeated = PrepareCore(dataPath, canonical,
                    new[] { first, second }, false);
                byte[] after = File.ReadAllBytes(canonical);
                if (repeated.Changed || !before.SequenceEqual(after))
                {
                    error = "state recovery was not restart-idempotent";
                    return false;
                }

                string cappedCanonical = Path.Combine(root, "capped", "state.json");
                string olderCappedBranch = Path.Combine(root, "capped-legacy", "state.json");
                SeedMiningWindow(cappedCanonical, "current", 2050, 2048);
                SeedMiningWindow(olderCappedBranch, "older", 1900, 1900);
                RecoveryReport cappedReport = PrepareCore(dataPath, cappedCanonical,
                    new[] { olderCappedBranch }, false);
                MetaGameState cappedState = new MetaGameStateStore(cappedCanonical)
                    .LoadOrCreate(DateTimeOffset.UtcNow);
                if (!cappedReport.Changed || cappedReport.ImportedMiningEvents != 0
                    || cappedState.Mining.TotalStoneMined != 2050
                    || cappedState.ProcessedMiningEventIds.Count != 2048
                    || !cappedReport.Warnings.Contains(
                        "BOUNDED_MINING_HISTORY_PRESERVED_BASE"))
                {
                    error = "bounded mining history was not preserved safely";
                    return false;
                }

                string corruptRoot = Path.Combine(root, "corrupt-only");
                Directory.CreateDirectory(corruptRoot);
                string corrupt = Path.Combine(corruptRoot, "state.json");
                File.WriteAllText(corrupt, "{broken", new UTF8Encoding(false));
                bool failedClosed = false;
                try { PrepareCore(dataPath, corrupt, new string[0], false); }
                catch (InvalidDataException) { failedClosed = true; }
                if (!failedClosed)
                {
                    error = "invalid primary and backup did not fail closed";
                    return false;
                }

                string future = Path.Combine(root, "future", "state.json");
                Directory.CreateDirectory(Path.GetDirectoryName(future));
                StateEnvelope futureEnvelope = Serializer.Deserialize<StateEnvelope>(
                    File.ReadAllText(first, Encoding.UTF8));
                futureEnvelope.SchemaVersion = CurrentSchemaVersion + 1;
                File.WriteAllText(future, Serializer.Serialize(futureEnvelope),
                    new UTF8Encoding(false));
                byte[] futureBefore = File.ReadAllBytes(future);
                bool futureFailedClosed = false;
                try { PrepareCore(dataPath, future, new[] { second }, false); }
                catch (InvalidDataException exception)
                {
                    futureFailedClosed = exception.Message == "METAGAME_STATE_SCHEMA_FUTURE";
                }
                if (!futureFailedClosed || !futureBefore.SequenceEqual(File.ReadAllBytes(future)))
                {
                    error = "future schema was not preserved fail-closed";
                    return false;
                }

                string receiptless = Path.Combine(root, "receiptless", "state.json");
                Directory.CreateDirectory(Path.GetDirectoryName(receiptless));
                File.Copy(second, receiptless, true);
                MetaGameState receiptlessState = new MetaGameStateStore(receiptless)
                    .LoadOrCreate(DateTimeOffset.UtcNow);
                receiptlessState.RecentDrawReceipts.Clear();
                new MetaGameStateStore(receiptless).Save(receiptlessState,
                    DateTimeOffset.UtcNow);
                string atomicCanonical = Path.Combine(root, "atomic", "state.json");
                bool receiptFailedClosed = false;
                try { PrepareCore(dataPath, atomicCanonical, new[] { first, receiptless }, false); }
                catch (InvalidDataException exception)
                {
                    receiptFailedClosed = exception.Message.StartsWith(
                        "GACHA_RECEIPT_NOT_EXACT:", StringComparison.Ordinal);
                }
                if (!receiptFailedClosed || File.Exists(atomicCanonical))
                {
                    error = "receiptless merge changed canonical state before validation";
                    return false;
                }
                return true;
            }
            catch (Exception exception)
            {
                error = "state recovery self-test failed: " + exception.Message;
                return false;
            }
            finally
            {
                try { Directory.Delete(root, true); }
                catch { }
            }
        }

        private static void SeedBranch(string dataPath, string statePath, string prefix,
            string profileName, string drawRequest)
        {
            DateTimeOffset now = DateTimeOffset.UtcNow;
            var state = new MetaGameState();
            state.Profile.CreatedAtUtc = now.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
            state.Profile.Name = profileName;
            state.Profile.OnboardingComplete = true;
            state.Mining.TotalStoneMined = 100;
            state.Mining.MiningXp = 100;
            state.Mining.AvailableMiningPoints = 100;
            state.Mining.TotalMiningPointsEarned = 100;
            state.Mining.LastMinedAtUtc = now.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
            state.Mining.DailyTotals[now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)] = 100;
            for (int index = 0; index < 100; index++)
                state.ProcessedMiningEventIds.Add("mine:test:" + prefix + ":"
                    + index.ToString("D3", CultureInfo.InvariantCulture));
            var store = new MetaGameStateStore(statePath);
            store.Save(state, now);
            var host = new StoneMetaGameHost(dataPath, statePath, false);
            MutationResult draw = host.Service.Draw(drawRequest, 1, "points");
            if (!draw.Ok) throw new InvalidDataException("test branch draw failed: " + draw.Error);
        }

        private static void SeedMiningWindow(string statePath, string prefix,
            int total, int retained)
        {
            DateTimeOffset now = DateTimeOffset.UtcNow;
            var state = new MetaGameState();
            state.Profile.CreatedAtUtc = now.UtcDateTime.ToString("O",
                CultureInfo.InvariantCulture);
            state.Profile.Name = "Miner";
            state.Profile.OnboardingComplete = true;
            state.Mining.TotalStoneMined = total;
            state.Mining.MiningXp = total;
            state.Mining.AvailableMiningPoints = total;
            state.Mining.TotalMiningPointsEarned = total;
            state.Mining.LastMinedAtUtc = now.UtcDateTime.ToString("O",
                CultureInfo.InvariantCulture);
            state.Mining.DailyTotals[now.ToString("yyyy-MM-dd",
                CultureInfo.InvariantCulture)] = total;
            int first = Math.Max(0, total - retained);
            for (int index = first; index < total; index++)
                state.ProcessedMiningEventIds.Add("mine:test:" + prefix + ":"
                    + index.ToString("D5", CultureInfo.InvariantCulture));
            new MetaGameStateStore(statePath).Save(state, now);
        }
    }

    internal static class RecoveryEnumerableExtensions
    {
        internal static IEnumerable<T> TakeLastCompat<T>(this IEnumerable<T> source, int count)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            if (count <= 0) return Enumerable.Empty<T>();
            var queue = new Queue<T>(count);
            foreach (T item in source)
            {
                if (queue.Count == count) queue.Dequeue();
                queue.Enqueue(item);
            }
            return queue;
        }
    }
}
