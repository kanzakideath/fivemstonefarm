using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace AiMiner.StoneMetaGame
{
    public interface IRandomSource
    {
        int NextInt(int exclusiveMaximum);
    }

    public interface IMetaGameClock
    {
        DateTimeOffset UtcNow { get; }
        TimeZoneInfo LocalTimeZone { get; }
    }

    public sealed class CryptoRandomSource : IRandomSource
    {
        public int NextInt(int exclusiveMaximum)
        {
            if (exclusiveMaximum <= 0) throw new ArgumentOutOfRangeException(nameof(exclusiveMaximum));
            ulong range = (ulong)UInt32.MaxValue + 1UL;
            ulong limit = range - range % (ulong)exclusiveMaximum;
            byte[] bytes = new byte[4];
            using (RandomNumberGenerator random = RandomNumberGenerator.Create())
            {
                uint value;
                do
                {
                    random.GetBytes(bytes);
                    value = BitConverter.ToUInt32(bytes, 0);
                } while ((ulong)value >= limit);
                return (int)((ulong)value % (ulong)exclusiveMaximum);
            }
        }
    }

    public sealed class SystemMetaGameClock : IMetaGameClock
    {
        public DateTimeOffset UtcNow { get { return DateTimeOffset.UtcNow; } }
        public TimeZoneInfo LocalTimeZone { get { return TimeZoneInfo.Local; } }
    }

    public sealed class MetaGameService
    {
        private static readonly Regex EventIdPattern = new Regex("^[A-Za-z0-9._:-]{8,128}$",
            RegexOptions.CultureInvariant);
        private readonly object _gate = new object();
        private readonly MetaGameCatalog _catalog;
        private readonly MetaGameStateStore _store;
        private readonly IRandomSource _random;
        private readonly IMetaGameClock _clock;
        private MetaGameState _state;
        private string _forcedRarity;
        private bool? _forcedFakeout;
        private string _forcedVariant;
        private string _forcedPreCue;

        public MetaGameService(MetaGameCatalog catalog, MetaGameStateStore store,
            IRandomSource random = null, IMetaGameClock clock = null)
        {
            _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
            _store = store ?? throw new ArgumentNullException(nameof(store));
            _random = random ?? new CryptoRandomSource();
            _clock = clock ?? new SystemMetaGameClock();
            _state = _store.LoadOrCreate(_clock.UtcNow);
            bool changed = EnsureCatalogState();
            RecalculateDerivedValues();
            if (RecoverInterruptedSession(_clock.UtcNow)) changed = true;
            if (changed) Save(_clock.UtcNow);
        }

        public MetaGameCatalog Catalog { get { return _catalog; } }

        public MetaGameSnapshot GetSnapshot()
        {
            lock (_gate) return BuildSnapshot(_clock.UtcNow);
        }

        // Trusted host boundary. One verified reward observation becomes one atomic progression commit.
        // This method must never be mapped directly to a WebView action.
        public MutationResult RecordVerifiedMiningSuccess(string eventId, DateTimeOffset completedAtUtc)
        {
            lock (_gate)
            {
                if (!IsSafeEventId(eventId)) return Failure("INVALID_MINING_EVENT_ID");
                if (_state.ProcessedMiningEventIds.Contains(eventId))
                    return Success(true, null, new List<MetaGameEvent>());

                long previousTotal = _state.Mining.TotalStoneMined;
                int previousLevel = _state.Mining.MiningLevel;
                AffinityRank previousAffinity = _catalog.AffinityAt(previousTotal);

                _state.Mining.TotalStoneMined++;
                _state.Mining.MiningXp = checked(_state.Mining.MiningXp
                    + _catalog.Gacha.Progression.XpPerMining);
                int pointGain = _catalog.Gacha.Economy.MiningPointsPerSuccess;
                _state.Mining.AvailableMiningPoints = checked(_state.Mining.AvailableMiningPoints + pointGain);
                _state.Mining.TotalMiningPointsEarned = checked(_state.Mining.TotalMiningPointsEarned + pointGain);
                _state.Mining.MiningLevel = LevelForXp(_state.Mining.MiningXp);
                _state.Mining.LastMinedAtUtc = FormatUtc(completedAtUtc);

                DateTimeOffset local = TimeZoneInfo.ConvertTime(completedAtUtc, _clock.LocalTimeZone);
                string dayKey = local.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                long daily;
                _state.Mining.DailyTotals.TryGetValue(dayKey, out daily);
                _state.Mining.DailyTotals[dayKey] = checked(daily + 1);

                int milestoneEvery = _catalog.Gacha.Economy.TicketEveryMines;
                long oldMilestones = previousTotal / milestoneEvery;
                long newMilestones = _state.Mining.TotalStoneMined / milestoneEvery;
                if (newMilestones > oldMilestones)
                {
                    int gain = checked((int)((newMilestones - oldMilestones)
                        * _catalog.Gacha.Economy.TicketsPerMilestone));
                    _state.Mining.GachaTickets = checked(_state.Mining.GachaTickets + gain);
                }

                _state.ProcessedMiningEventIds.Add(eventId);
                TrimFromFront(_state.ProcessedMiningEventIds,
                    _catalog.Gacha.Economy.ProcessedEventLimit);

                var events = new List<MetaGameEvent>();
                AddAffinityCrossings(previousAffinity, previousTotal, _state.Mining.TotalStoneMined,
                    completedAtUtc, events);
                AddLevelCrossings(previousLevel, _state.Mining.MiningLevel, completedAtUtc, events);
                UpdateLiveSessionDuration(completedAtUtc);
                UnlockAchievements(new AchievementContext { MiningLocalTime = local }, events, completedAtUtc);
                Save(completedAtUtc);
                return Success(false, null, events);
            }
        }

        public MutationResult BeginMiningSession(string sessionId, DateTimeOffset startedAtUtc)
        {
            lock (_gate)
            {
                if (!IsSafeEventId(sessionId)) return Failure("INVALID_SESSION_ID");
                if (_state.Mining.ActiveSessionId == sessionId)
                    return Success(true, null, new List<MetaGameEvent>());
                if (!String.IsNullOrEmpty(_state.Mining.ActiveSessionId)) FinishActiveSession(startedAtUtc);
                _state.Mining.ActiveSessionId = sessionId;
                _state.Mining.ActiveSessionStartedAtUtc = FormatUtc(startedAtUtc);
                Save(startedAtUtc);
                return Success(false, null, new List<MetaGameEvent>());
            }
        }

        public MutationResult EndMiningSession(string sessionId, DateTimeOffset endedAtUtc)
        {
            lock (_gate)
            {
                if (!IsSafeEventId(sessionId) || _state.Mining.ActiveSessionId != sessionId)
                    return Failure("SESSION_NOT_ACTIVE");
                FinishActiveSession(endedAtUtc);
                var events = new List<MetaGameEvent>();
                UnlockAchievements(new AchievementContext(), events, endedAtUtc);
                Save(endedAtUtc);
                return Success(false, null, events);
            }
        }

        public MutationResult Draw(string requestId, int count, string payment)
        {
            return Draw(requestId, _catalog.DefaultBanner.Id, count, payment);
        }

        public MutationResult Draw(string requestId, string bannerId, int count, string payment)
        {
            lock (_gate)
            {
                if (!IsSafeEventId(requestId)) return Failure("INVALID_DRAW_REQUEST_ID");
                if (count != 1 && count != 10) return Failure("INVALID_DRAW_COUNT");
                DrawReceipt existing = _state.RecentDrawReceipts.FirstOrDefault(x => x.RequestId == requestId);
                if (existing != null) return Success(true, existing, new List<MetaGameEvent>());

                GachaBannerDefinition banner;
                if (!_catalog.BannersById.TryGetValue(bannerId ?? "", out banner)
                    || !BannerIsActive(banner, _clock.UtcNow)) return Failure("GACHA_BANNER_NOT_AVAILABLE");
                BannerProgressState progress = BannerProgress(banner);
                int ticketsRequired = count;
                int pointsRequired = count == 10 ? banner.TenPullCost : banner.Cost;
                string selectedPayment = ResolvePayment(payment, ticketsRequired, pointsRequired);
                if (selectedPayment == null) return Failure("INSUFFICIENT_GACHA_CURRENCY");

                var receipt = new DrawReceipt
                {
                    RequestId = requestId,
                    DrawnAtUtc = FormatUtc(_clock.UtcNow),
                    BannerId = banner.Id,
                    BannerName = banner.Name,
                    Count = count,
                    Payment = selectedPayment,
                    TicketsSpent = selectedPayment == "tickets" ? ticketsRequired : 0,
                    PointsSpent = selectedPayment == "points" ? pointsRequired : 0
                };
                if (selectedPayment == "tickets") _state.Mining.GachaTickets -= ticketsRequired;
                else _state.Mining.AvailableMiningPoints -= pointsRequired;

                int highRarityInBatch = 0;
                int legendaryInBatch = 0;
                int tenMinimumOrder = _catalog.RarityOrder(banner.TenPullMinimumRarity);
                for (int index = 0; index < count; index++)
                {
                    PityTrackDefinition triggeredTrack = TriggeredPityTrack(banner, progress);
                    int minimumOrder = triggeredTrack == null ? 0
                        : _catalog.RarityOrder(triggeredTrack.MinimumRarity);
                    if (count == 10 && index == count - 1
                        && !receipt.Results.Any(x => _catalog.RarityOrder(x.Rarity) >= tenMinimumOrder))
                        minimumOrder = Math.Max(minimumOrder, tenMinimumOrder);

                    RarityDefinition rarity = String.IsNullOrEmpty(_forcedRarity)
                        ? ChooseRarity(banner, minimumOrder)
                        : _catalog.RaritiesById[_forcedRarity];
                    ItemDefinition item = ChooseItem(banner, rarity.Id);
                    CollectionEntry owned;
                    bool isNew = !_state.Collection.TryGetValue(item.Id, out owned);
                    if (isNew)
                    {
                        owned = new CollectionEntry
                        {
                            ItemId = item.Id,
                            Count = 0,
                            FirstAcquiredAtUtc = receipt.DrawnAtUtc,
                            Seen = false
                        };
                        _state.Collection[item.Id] = owned;
                    }
                    owned.Count++;
                    owned.LastAcquiredAtUtc = receipt.DrawnAtUtc;

                    int fragments = 0;
                    if (!isNew)
                    {
                        fragments = _catalog.Gacha.Economy.DuplicateFragments[rarity.Id];
                        _state.Mining.StoneFragments = checked(_state.Mining.StoneFragments + fragments);
                        _state.Mining.TotalStoneFragmentsEarned = checked(
                            _state.Mining.TotalStoneFragmentsEarned + fragments);
                    }

                    int pityBefore = triggeredTrack == null
                        ? progress.PityCounters[banner.PityTracks[0].Id]
                        : progress.PityCounters[triggeredTrack.Id];
                    bool fakeout = _forcedFakeout ?? ShouldFakeout(rarity.Id);
                    string variant = PresentationVariant(rarity.Id);
                    string preCue = PreCue(rarity.Id);
                    var result = new DrawResult
                    {
                        ItemId = item.Id,
                        Rarity = rarity.Id,
                        IsNew = isNew,
                        OwnedCount = owned.Count,
                        Fakeout = fakeout,
                        PresentedFromRarity = fakeout ? FakeoutOrigin(rarity.Order) : rarity.Id,
                        PityTriggered = triggeredTrack != null,
                        PityTrackId = triggeredTrack == null ? "" : triggeredTrack.Id,
                        PityCountBefore = pityBefore,
                        NominalBasisPoints = NominalItemBasisPoints(banner, item),
                        FragmentsGained = fragments,
                        PresentationVariant = variant,
                        PreCue = preCue
                    };
                    receipt.Results.Add(result);
                    UpdateGlobalGachaCounters(result);
                    UpdateBannerPity(banner, progress, rarity.Id);
                    progress.TotalDraws++;
                    if (rarity.Order >= _catalog.RarityOrder("SSR")) highRarityInBatch++;
                    if (rarity.Id == "LEGENDARY") legendaryInBatch++;

                    _state.Gacha.History.Add(new GachaHistoryEntry
                    {
                        Sequence = _state.Gacha.TotalDraws,
                        DrawnAtUtc = receipt.DrawnAtUtc,
                        RequestId = requestId,
                        BatchSize = count,
                        BannerId = banner.Id,
                        BannerName = banner.Name,
                        ItemId = item.Id,
                        Rarity = rarity.Id,
                        WasNew = isNew,
                        WasFakeout = fakeout,
                        PresentationVariant = variant,
                        NominalBasisPoints = result.NominalBasisPoints,
                        PityCountBefore = pityBefore,
                        PityTrackId = result.PityTrackId
                    });
                }

                if (count == 1) _state.Gacha.SingleDraws++;
                else _state.Gacha.TenPullBatches++;
                _state.Gacha.BestHighRarityBatch = Math.Max(_state.Gacha.BestHighRarityBatch,
                    highRarityInBatch);
                _state.Gacha.BestLegendaryBatch = Math.Max(_state.Gacha.BestLegendaryBatch,
                    legendaryInBatch);
                SyncLegacyPity();
                TrimFromFront(_state.Gacha.History, _catalog.Gacha.Economy.HistoryLimit);
                _state.RecentDrawReceipts.Add(receipt);
                TrimFromFront(_state.RecentDrawReceipts, 32);

                var events = new List<MetaGameEvent>();
                UnlockAchievements(new AchievementContext { LastBatch = receipt.Results }, events,
                    _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, receipt, events);
            }
        }

        public MutationResult RenameProfile(string name)
        {
            lock (_gate)
            {
                string clean = (name ?? "").Trim();
                if (clean.Length < 1 || clean.Length > 24 || clean.Any(Char.IsControl))
                    return Failure("INVALID_PROFILE_NAME");
                _state.Profile.Name = clean;
                Save(_clock.UtcNow);
                return Success(false, null, new List<MetaGameEvent>());
            }
        }

        public MutationResult SetProfileAppearance(string icon, string frame, string customIconDataUri)
        {
            lock (_gate)
            {
                string iconValue = icon ?? "";
                string frameValue = frame ?? "";
                string custom = customIconDataUri ?? "";
                if (!CanUseAppearance(iconValue, "profileIcon", custom)
                    || !CanUseAppearance(frameValue, "profileFrame", ""))
                    return Failure("PROFILE_APPEARANCE_NOT_OWNED");
                _state.Profile.Icon = iconValue;
                _state.Profile.Frame = frameValue;
                _state.Profile.CustomIconDataUri = iconValue == "custom:image" ? custom : "";
                var events = new List<MetaGameEvent>();
                UnlockAchievements(new AchievementContext(), events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        public MutationResult SetProfileTitle(string titleId)
        {
            lock (_gate)
            {
                if (!_catalog.TitlesById.ContainsKey(titleId ?? "")
                    || !_state.OwnedTitles.ContainsKey(titleId ?? ""))
                    return Failure("PROFILE_TITLE_NOT_OWNED");
                _state.Profile.TitleId = titleId;
                var events = new List<MetaGameEvent>();
                UnlockAchievements(new AchievementContext(), events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        public MutationResult UpdateProfile(string name, string icon, string frame,
            string customIconDataUri, string titleId)
        {
            lock (_gate)
            {
                string clean = (name ?? "").Trim();
                string iconValue = icon ?? "";
                string frameValue = frame ?? "";
                string custom = customIconDataUri ?? "";
                string titleValue = titleId ?? "";

                // Validate the complete edit before changing any field. The editor is one
                // Save operation, so a bad entitlement must never leave a partially updated card.
                if (clean.Length < 1 || clean.Length > 24 || clean.Any(Char.IsControl))
                    return Failure("INVALID_PROFILE_NAME");
                if (!CanUseAppearance(iconValue, "profileIcon", custom)
                    || !CanUseAppearance(frameValue, "profileFrame", ""))
                    return Failure("PROFILE_APPEARANCE_NOT_OWNED");
                if (!_catalog.TitlesById.ContainsKey(titleValue)
                    || !_state.OwnedTitles.ContainsKey(titleValue))
                    return Failure("PROFILE_TITLE_NOT_OWNED");

                _state.Profile.Name = clean;
                _state.Profile.Icon = iconValue;
                _state.Profile.Frame = frameValue;
                _state.Profile.CustomIconDataUri = iconValue == "custom:image" ? custom : "";
                _state.Profile.TitleId = titleValue;
                var events = new List<MetaGameEvent>();
                UnlockAchievements(new AchievementContext(), events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        public MutationResult SetCollectionFavorite(string itemId, bool favorite)
        {
            lock (_gate)
            {
                CollectionEntry entry;
                if (!_state.Collection.TryGetValue(itemId ?? "", out entry))
                    return Failure("COLLECTION_ITEM_NOT_OWNED");
                entry.Favorite = favorite;
                var events = new List<MetaGameEvent>();
                UnlockAchievements(new AchievementContext(), events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        public MutationResult AcknowledgeCollection(string itemId)
        {
            lock (_gate)
            {
                if (itemId == "*")
                {
                    foreach (CollectionEntry entry in _state.Collection.Values) entry.Seen = true;
                }
                else
                {
                    CollectionEntry entry;
                    if (!_state.Collection.TryGetValue(itemId ?? "", out entry))
                        return Failure("COLLECTION_ITEM_NOT_OWNED");
                    entry.Seen = true;
                }
                Save(_clock.UtcNow);
                return Success(false, null, new List<MetaGameEvent>());
            }
        }

        public MutationResult CompleteOnboarding()
        {
            lock (_gate)
            {
                _state.Profile.OnboardingComplete = true;
                Save(_clock.UtcNow);
                return Success(false, null, new List<MetaGameEvent>());
            }
        }

        public MutationResult UpdateSettings(MetaSettings settings)
        {
            lock (_gate)
            {
                if (settings == null || !ValidVolume(settings.MasterVolume)
                    || !ValidVolume(settings.BgmVolume) || !ValidVolume(settings.SfxVolume)
                    || (settings.EffectQuality != "low" && settings.EffectQuality != "normal"
                        && settings.EffectQuality != "high")
                    || (settings.AnimationSpeed != "normal" && settings.AnimationSpeed != "fast"
                        && settings.AnimationSpeed != "skip"))
                    return Failure("INVALID_META_SETTINGS");
                _state.Settings = settings;
                Save(_clock.UtcNow);
                return Success(false, null, new List<MetaGameEvent>());
            }
        }

        public MutationResult ClaimReward(string grantId)
        {
            lock (_gate)
            {
                RewardGrantProgress progress;
                if (!_state.RewardGrants.TryGetValue(grantId ?? "", out progress))
                    return Failure("REWARD_GRANT_NOT_FOUND");
                if (progress.Claimed) return Success(true, null, new List<MetaGameEvent>());
                List<RewardDefinition> rewards = ResolveGrantRewards(progress);
                ApplyRewards(rewards, _clock.UtcNow);
                MarkGrantClaimed(progress, _clock.UtcNow);
                var events = new List<MetaGameEvent> { RewardClaimedEvent(progress, rewards) };
                UnlockAchievements(new AchievementContext(), events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        public MutationResult ClaimAllRewards()
        {
            lock (_gate)
            {
                var events = new List<MetaGameEvent>();
                foreach (RewardGrantProgress progress in _state.RewardGrants.Values
                    .Where(x => !x.Claimed).OrderBy(x => x.UnlockedAtUtc).ToList())
                {
                    List<RewardDefinition> rewards = ResolveGrantRewards(progress);
                    ApplyRewards(rewards, _clock.UtcNow);
                    MarkGrantClaimed(progress, _clock.UtcNow);
                    events.Add(RewardClaimedEvent(progress, rewards));
                }
                if (events.Count == 0) return Success(true, null, events);
                UnlockAchievements(new AchievementContext(), events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        // Development-only operations. The host is responsible for enforcing development mode.
        public MutationResult DebugGrantMiningPoints(long amount)
        {
            lock (_gate)
            {
                if (amount <= 0 || amount > 10000000) return Failure("INVALID_DEBUG_AMOUNT");
                _state.Mining.AvailableMiningPoints = checked(_state.Mining.AvailableMiningPoints + amount);
                _state.Mining.TotalMiningPointsEarned = checked(_state.Mining.TotalMiningPointsEarned + amount);
                Save(_clock.UtcNow);
                return Success(false, null, new List<MetaGameEvent>());
            }
        }

        public MutationResult DebugAddXp(long amount)
        {
            lock (_gate)
            {
                if (amount <= 0 || amount > 100000000) return Failure("INVALID_DEBUG_AMOUNT");
                int previous = _state.Mining.MiningLevel;
                _state.Mining.MiningXp = checked(_state.Mining.MiningXp + amount);
                _state.Mining.MiningLevel = LevelForXp(_state.Mining.MiningXp);
                var events = new List<MetaGameEvent>();
                AddLevelCrossings(previous, _state.Mining.MiningLevel, _clock.UtcNow, events);
                UnlockAchievements(new AchievementContext(), events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        public MutationResult DebugSetStoneMined(long total)
        {
            lock (_gate)
            {
                if (total < 0 || total > 1000000000) return Failure("INVALID_DEBUG_TOTAL");
                long previousTotal = _state.Mining.TotalStoneMined;
                int previousLevel = _state.Mining.MiningLevel;
                AffinityRank previousAffinity = _catalog.AffinityAt(previousTotal);
                _state.Mining.TotalStoneMined = total;
                _state.Mining.MiningXp = checked(total * _catalog.Gacha.Progression.XpPerMining);
                _state.Mining.MiningLevel = LevelForXp(_state.Mining.MiningXp);
                string day = TimeZoneInfo.ConvertTime(_clock.UtcNow, _clock.LocalTimeZone)
                    .ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                _state.Mining.DailyTotals[day] = total;
                var events = new List<MetaGameEvent>();
                if (total > previousTotal)
                {
                    AddAffinityCrossings(previousAffinity, previousTotal, total, _clock.UtcNow, events);
                    AddLevelCrossings(previousLevel, _state.Mining.MiningLevel, _clock.UtcNow, events);
                }
                UnlockAchievements(new AchievementContext
                {
                    MiningLocalTime = TimeZoneInfo.ConvertTime(_clock.UtcNow, _clock.LocalTimeZone)
                }, events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        public MutationResult DebugAdvanceAffinity()
        {
            lock (_gate)
            {
                AffinityRank next = _catalog.NextAffinity(_state.Mining.TotalStoneMined);
                return next == null ? Failure("AFFINITY_ALREADY_MAXIMUM")
                    : DebugSetStoneMined(next.Mined);
            }
        }

        public MutationResult DebugUnlockAchievement(string achievementId)
        {
            lock (_gate)
            {
                AchievementDefinition definition;
                if (!_catalog.AchievementsById.TryGetValue(achievementId ?? "", out definition))
                    return Failure("INVALID_DEBUG_ACHIEVEMENT");
                _state.Achievements.Remove(definition.Id);
                _state.RewardGrants.Remove("achievement:" + definition.Id);
                var events = new List<MetaGameEvent>();
                UnlockAchievement(definition, events, _clock.UtcNow);
                Save(_clock.UtcNow);
                return Success(false, null, events);
            }
        }

        public MutationResult DebugForceDraw(string requestId, int count, string rarity)
        {
            return DebugForceDraw(requestId, _catalog.DefaultBanner.Id, count, rarity, false, "", "");
        }

        public MutationResult DebugForceDraw(string requestId, string bannerId, int count, string rarity,
            bool forceFakeout, string variant, string preCue)
        {
            lock (_gate)
            {
                if (!_catalog.RaritiesById.ContainsKey(rarity ?? ""))
                    return Failure("INVALID_DEBUG_RARITY");
                _forcedRarity = rarity;
                _forcedFakeout = forceFakeout ? (bool?)true : null;
                _forcedVariant = variant ?? "";
                _forcedPreCue = preCue ?? "";
                try { return Draw(requestId, bannerId, count, "auto"); }
                finally
                {
                    _forcedRarity = null;
                    _forcedFakeout = null;
                    _forcedVariant = null;
                    _forcedPreCue = null;
                }
            }
        }

        public MutationResult DebugSetPity(string bannerId, string trackId, int value)
        {
            lock (_gate)
            {
                GachaBannerDefinition banner;
                if (!_catalog.BannersById.TryGetValue(bannerId ?? "", out banner))
                    return Failure("INVALID_DEBUG_BANNER");
                PityTrackDefinition track = banner.PityTracks.FirstOrDefault(x => x.Id == trackId);
                if (track == null || value < 0 || value >= track.Threshold)
                    return Failure("INVALID_DEBUG_PITY");
                BannerProgress(banner).PityCounters[track.Id] = value;
                SyncLegacyPity();
                Save(_clock.UtcNow);
                return Success(false, null, new List<MetaGameEvent>());
            }
        }

        public MutationResult DebugPrimePity(string kind)
        {
            string track = kind == "ssr" ? "ssr-pity" : kind == "ur" ? "ur-pity" : "";
            PityTrackDefinition definition = _catalog.DefaultBanner.PityTracks
                .FirstOrDefault(x => x.Id == track);
            return definition == null ? Failure("INVALID_DEBUG_PITY")
                : DebugSetPity(_catalog.DefaultBanner.Id, definition.Id, definition.Threshold - 1);
        }

        private bool EnsureCatalogState()
        {
            bool changed = false;
            foreach (GachaBannerDefinition banner in _catalog.Banners)
            {
                BannerProgressState progress;
                if (!_state.Gacha.BannerProgress.TryGetValue(banner.Id, out progress))
                {
                    progress = new BannerProgressState { BannerId = banner.Id };
                    _state.Gacha.BannerProgress[banner.Id] = progress;
                    changed = true;
                }
                if (progress.PityCounters == null)
                {
                    progress.PityCounters = new Dictionary<string, int>(StringComparer.Ordinal);
                    changed = true;
                }
                foreach (PityTrackDefinition pity in banner.PityTracks)
                    if (!progress.PityCounters.ContainsKey(pity.Id))
                    {
                        int legacy = banner.IsDefault && pity.Id == "ssr-pity" ? _state.Gacha.SsrMisses
                            : banner.IsDefault && pity.Id == "ur-pity" ? _state.Gacha.UrMisses : 0;
                        progress.PityCounters[pity.Id] = Math.Max(0, Math.Min(pity.Threshold - 1, legacy));
                        changed = true;
                    }
            }
            if (!_state.OwnedTitles.ContainsKey("rookie-miner"))
            {
                _state.OwnedTitles["rookie-miner"] = _state.Profile.CreatedAtUtc;
                changed = true;
            }
            if (!_state.OwnedTitles.ContainsKey(_state.Profile.TitleId))
            {
                _state.Profile.TitleId = "rookie-miner";
                changed = true;
            }

            // v1 users already passed these milestones before rewards existed. Record them as claimed
            // instead of granting migration-time windfalls or allowing repeated claims.
            if (_state.Mining.TotalStoneMined > 0 && _state.RewardGrants.Count == 0)
            {
                string at = String.IsNullOrEmpty(_state.Profile.CreatedAtUtc)
                    ? FormatUtc(_clock.UtcNow) : _state.Profile.CreatedAtUtc;
                foreach (LevelRewardDefinition reward in _catalog.LevelRewards
                    .Where(x => x.Level <= _state.Mining.MiningLevel))
                    AddHistoricalClaim("level", reward.Level.ToString(CultureInfo.InvariantCulture), at);
                foreach (AffinityRank rank in _catalog.AffinityRanks
                    .Where(x => x.Mined > 0 && x.Mined <= _state.Mining.TotalStoneMined && x.Rewards.Count > 0))
                    AddHistoricalClaim("affinity", rank.Id, at);
                changed = true;
            }
            SyncLegacyPity();
            return changed;
        }

        private void AddHistoricalClaim(string sourceType, string sourceId, string at)
        {
            string id = sourceType + ":" + sourceId;
            _state.RewardGrants[id] = new RewardGrantProgress
            {
                GrantId = id,
                SourceType = sourceType,
                SourceId = sourceId,
                UnlockedAtUtc = at,
                Claimed = true,
                ClaimedAtUtc = at
            };
        }

        private string ResolvePayment(string requested, int tickets, int points)
        {
            string value = String.IsNullOrEmpty(requested) ? "auto" : requested;
            if (value == "tickets") return _state.Mining.GachaTickets >= tickets ? "tickets" : null;
            if (value == "points") return _state.Mining.AvailableMiningPoints >= points ? "points" : null;
            if (value != "auto") return null;
            if (_state.Mining.GachaTickets >= tickets) return "tickets";
            return _state.Mining.AvailableMiningPoints >= points ? "points" : null;
        }

        private RarityDefinition ChooseRarity(GachaBannerDefinition banner, int minimumOrder)
        {
            List<RarityDefinition> allowed = _catalog.Gacha.Rarities
                .Where(x => x.Order >= minimumOrder).OrderBy(x => x.Order).ToList();
            int total = allowed.Sum(x => banner.Rates[x.Id]);
            int roll = _random.NextInt(total);
            foreach (RarityDefinition rarity in allowed)
            {
                int weight = banner.Rates[rarity.Id];
                if (roll < weight) return rarity;
                roll -= weight;
            }
            return allowed[allowed.Count - 1];
        }

        private ItemDefinition ChooseItem(GachaBannerDefinition banner, string rarity)
        {
            List<ItemDefinition> pool = BannerItems(banner).Where(x => x.Rarity == rarity).ToList();
            List<PickupDefinition> pickups = banner.Pickups
                .Where(x => pool.Any(item => item.Id == x.ItemId)).ToList();
            if (pickups.Count > 0)
            {
                int pickupRoll = _random.NextInt(10000);
                foreach (PickupDefinition pickup in pickups)
                {
                    if (pickupRoll < pickup.ShareBasisPoints)
                        return pool.First(x => x.Id == pickup.ItemId);
                    pickupRoll -= pickup.ShareBasisPoints;
                }
            }
            var pickupIds = new HashSet<string>(pickups.Select(x => x.ItemId), StringComparer.Ordinal);
            List<ItemDefinition> regular = pool.Where(x => !pickupIds.Contains(x.Id)).ToList();
            return WeightedItem(regular.Count > 0 ? regular : pool);
        }

        private ItemDefinition WeightedItem(List<ItemDefinition> items)
        {
            int total = items.Sum(x => x.Weight);
            int roll = _random.NextInt(total);
            foreach (ItemDefinition item in items)
            {
                if (roll < item.Weight) return item;
                roll -= item.Weight;
            }
            return items[items.Count - 1];
        }

        private List<ItemDefinition> BannerItems(GachaBannerDefinition banner)
        {
            IEnumerable<ItemDefinition> items = _catalog.Items;
            if (banner.Pool.ItemIds.Count > 0)
            {
                var ids = new HashSet<string>(banner.Pool.ItemIds, StringComparer.Ordinal);
                items = items.Where(x => ids.Contains(x.Id));
            }
            if (banner.Pool.Categories.Count > 0)
            {
                var categories = new HashSet<string>(banner.Pool.Categories, StringComparer.Ordinal);
                items = items.Where(x => categories.Contains(x.CollectionCategory));
            }
            if (!banner.Pool.IncludeSecret) items = items.Where(x => !x.IsSecret);
            return items.ToList();
        }

        private int NominalItemBasisPoints(GachaBannerDefinition banner, ItemDefinition item)
        {
            int rarityRate = banner.Rates[item.Rarity];
            List<ItemDefinition> pool = BannerItems(banner).Where(x => x.Rarity == item.Rarity).ToList();
            List<PickupDefinition> pickups = banner.Pickups
                .Where(x => pool.Any(candidate => candidate.Id == x.ItemId)).ToList();
            PickupDefinition pickup = pickups.FirstOrDefault(x => x.ItemId == item.Id);
            if (pickup != null) return Math.Max(1,
                (int)Math.Round((double)rarityRate * pickup.ShareBasisPoints / 10000));
            int remainingShare = Math.Max(0, 10000 - pickups.Sum(x => x.ShareBasisPoints));
            var pickupIds = new HashSet<string>(pickups.Select(x => x.ItemId), StringComparer.Ordinal);
            List<ItemDefinition> regular = pool.Where(x => !pickupIds.Contains(x.Id)).ToList();
            if (regular.Count == 0) regular = pool;
            int totalWeight = regular.Sum(x => x.Weight);
            return Math.Max(1, (int)Math.Round((double)rarityRate * remainingShare
                * item.Weight / Math.Max(1, totalWeight) / 10000));
        }

        private PityTrackDefinition TriggeredPityTrack(GachaBannerDefinition banner,
            BannerProgressState progress)
        {
            return banner.PityTracks
                .Where(x => progress.PityCounters[x.Id] + 1 >= x.Threshold)
                .OrderByDescending(x => _catalog.RarityOrder(x.MinimumRarity))
                .ThenBy(x => x.Threshold)
                .FirstOrDefault();
        }

        private void UpdateBannerPity(GachaBannerDefinition banner, BannerProgressState progress,
            string rarity)
        {
            int resultOrder = _catalog.RarityOrder(rarity);
            foreach (PityTrackDefinition pity in banner.PityTracks)
            {
                progress.PityCounters[pity.Id] = resultOrder >= _catalog.RarityOrder(pity.ResetAtOrAbove)
                    ? 0 : checked(progress.PityCounters[pity.Id] + 1);
            }
        }

        private BannerProgressState BannerProgress(GachaBannerDefinition banner)
        {
            BannerProgressState value;
            if (!_state.Gacha.BannerProgress.TryGetValue(banner.Id, out value))
            {
                value = new BannerProgressState { BannerId = banner.Id };
                _state.Gacha.BannerProgress[banner.Id] = value;
            }
            if (value.PityCounters == null)
                value.PityCounters = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (PityTrackDefinition pity in banner.PityTracks)
                if (!value.PityCounters.ContainsKey(pity.Id)) value.PityCounters[pity.Id] = 0;
            return value;
        }

        private void SyncLegacyPity()
        {
            BannerProgressState progress = BannerProgress(_catalog.DefaultBanner);
            int value;
            _state.Gacha.SsrMisses = progress.PityCounters.TryGetValue("ssr-pity", out value) ? value : 0;
            _state.Gacha.UrMisses = progress.PityCounters.TryGetValue("ur-pity", out value) ? value : 0;
        }

        private bool ShouldFakeout(string rarity)
        {
            int chance;
            return _catalog.Gacha.Presentation.FakeoutBasisPoints != null
                && _catalog.Gacha.Presentation.FakeoutBasisPoints.TryGetValue(rarity, out chance)
                && chance > 0 && _random.NextInt(10000) < chance;
        }

        private string FakeoutOrigin(int targetOrder)
        {
            int origin = Math.Max(0, targetOrder - (targetOrder >= 4 ? 1 : 2));
            return _catalog.Gacha.Rarities.First(x => x.Order == origin).Id;
        }

        private string PresentationVariant(string rarity)
        {
            if (!String.IsNullOrEmpty(_forcedVariant)) return _forcedVariant;
            List<string> variants;
            if (!_catalog.Gacha.Presentation.HighRarityVariants.TryGetValue(rarity, out variants)
                || variants.Count == 0) return "standard";
            return variants[_random.NextInt(variants.Count)];
        }

        private string PreCue(string rarity)
        {
            if (!String.IsNullOrEmpty(_forcedPreCue)) return _forcedPreCue;
            int chance;
            if (!_catalog.Gacha.Presentation.PreCueBasisPoints.TryGetValue(rarity, out chance)
                || chance <= 0 || _random.NextInt(10000) >= chance) return "none";
            return rarity == "LEGENDARY" ? "zero-signal"
                : rarity == "UR" ? "rainbow-glint" : "warm-glow";
        }

        private void UpdateGlobalGachaCounters(DrawResult result)
        {
            int order = _catalog.RarityOrder(result.Rarity);
            int ssrOrder = _catalog.RarityOrder("SSR");
            int urOrder = _catalog.RarityOrder("UR");
            _state.Gacha.TotalDraws++;
            long count;
            _state.Gacha.RarityCounts.TryGetValue(result.Rarity, out count);
            _state.Gacha.RarityCounts[result.Rarity] = count + 1;
            if (order >= ssrOrder)
            {
                _state.Gacha.CurrentSsrMissStreak = 0;
            }
            else
            {
                _state.Gacha.CurrentSsrMissStreak++;
                _state.Gacha.WorstSsrMissStreak = Math.Max(_state.Gacha.WorstSsrMissStreak,
                    _state.Gacha.CurrentSsrMissStreak);
            }
            if (order >= urOrder)
            {
                _state.Gacha.CurrentUrMissStreak = 0;
            }
            else
            {
                _state.Gacha.CurrentUrMissStreak++;
                _state.Gacha.WorstUrMissStreak = Math.Max(_state.Gacha.WorstUrMissStreak,
                    _state.Gacha.CurrentUrMissStreak);
            }
            if (String.IsNullOrEmpty(_state.Gacha.HighestRarity)
                || order > _catalog.RarityOrder(_state.Gacha.HighestRarity))
                _state.Gacha.HighestRarity = result.Rarity;
        }

        private void AddAffinityCrossings(AffinityRank previousAffinity, long previousTotal,
            long currentTotal, DateTimeOffset at, List<MetaGameEvent> events)
        {
            foreach (AffinityRank rank in _catalog.AffinityRanks
                .Where(x => x.Mined > previousTotal && x.Mined <= currentTotal))
            {
                string grantId = CreateRewardGrant("affinity", rank.Id, rank.Rewards, at);
                events.Add(new MetaGameEvent
                {
                    Type = "affinity.levelUp",
                    Id = rank.Id,
                    Title = String.IsNullOrEmpty(rank.EventTitle) ? "Relationship Level Up" : rank.EventTitle,
                    Subtitle = rank.Line,
                    Previous = previousAffinity.Name,
                    Current = rank.Name,
                    Rarity = AffinityEventRarity(rank),
                    Variant = rank.Mined >= 50000 ? "legendary" : rank.Mined >= 5000 ? "chapter" : "standard",
                    Rewards = rank.Rewards ?? new List<RewardDefinition>(),
                    GrantId = grantId
                });
                previousAffinity = rank;
            }
        }

        private void AddLevelCrossings(int previous, int current, DateTimeOffset at,
            List<MetaGameEvent> events)
        {
            if (current <= previous) return;
            var rewards = new List<RewardDefinition>();
            foreach (LevelRewardDefinition definition in _catalog.LevelRewards
                .Where(x => x.Level > previous && x.Level <= current))
            {
                string grantId = CreateRewardGrant("level",
                    definition.Level.ToString(CultureInfo.InvariantCulture), definition.Rewards, at);
                rewards.AddRange(definition.Rewards ?? new List<RewardDefinition>());
                events.Add(new MetaGameEvent
                {
                    Type = "reward.available",
                    Id = "level-" + definition.Level,
                    Title = definition.Name,
                    Subtitle = "LV." + definition.Level + " 到達報酬",
                    Rarity = LevelEventRarity(definition.Level),
                    Rewards = definition.Rewards ?? new List<RewardDefinition>(),
                    GrantId = grantId
                });
            }
            events.Insert(0, new MetaGameEvent
            {
                Type = "mining.levelUp",
                Id = "level-" + current,
                Title = "MINING LEVEL UP",
                Subtitle = "LV." + previous + " → LV." + current,
                Previous = previous.ToString(CultureInfo.InvariantCulture),
                Current = current.ToString(CultureInfo.InvariantCulture),
                Rarity = LevelEventRarity(current),
                Variant = current >= 100 ? "legendary" : current >= 50 ? "major" : "standard",
                Rewards = rewards
            });
        }

        private string CreateRewardGrant(string sourceType, string sourceId,
            List<RewardDefinition> rewards, DateTimeOffset at)
        {
            if (rewards == null || rewards.Count == 0) return "";
            string id = sourceType + ":" + sourceId;
            if (!_state.RewardGrants.ContainsKey(id))
                _state.RewardGrants[id] = new RewardGrantProgress
                {
                    GrantId = id,
                    SourceType = sourceType,
                    SourceId = sourceId,
                    UnlockedAtUtc = FormatUtc(at)
                };
            return id;
        }

        private List<RewardDefinition> ResolveGrantRewards(RewardGrantProgress progress)
        {
            if (progress.SourceType == "level")
            {
                int level;
                return Int32.TryParse(progress.SourceId, NumberStyles.None, CultureInfo.InvariantCulture,
                    out level) ? (_catalog.LevelRewards.FirstOrDefault(x => x.Level == level)?.Rewards
                        ?? new List<RewardDefinition>()) : new List<RewardDefinition>();
            }
            if (progress.SourceType == "affinity")
                return _catalog.AffinityRanks.FirstOrDefault(x => x.Id == progress.SourceId)?.Rewards
                    ?? new List<RewardDefinition>();
            if (progress.SourceType == "achievement")
                return _catalog.AchievementsById.ContainsKey(progress.SourceId)
                    ? (_catalog.AchievementsById[progress.SourceId].Rewards
                        ?? new List<RewardDefinition>()) : new List<RewardDefinition>();
            return new List<RewardDefinition>();
        }

        private string GrantTitle(RewardGrantProgress progress)
        {
            if (progress.SourceType == "level")
            {
                int level;
                LevelRewardDefinition value = Int32.TryParse(progress.SourceId, out level)
                    ? _catalog.LevelRewards.FirstOrDefault(x => x.Level == level) : null;
                return value == null ? "Level Reward" : value.Name;
            }
            if (progress.SourceType == "affinity")
                return _catalog.AffinityRanks.FirstOrDefault(x => x.Id == progress.SourceId)?.EventTitle
                    ?? "Relationship Reward";
            if (progress.SourceType == "achievement")
                return _catalog.AchievementsById.ContainsKey(progress.SourceId)
                    ? _catalog.AchievementsById[progress.SourceId].Name : "Achievement Reward";
            return "Reward";
        }

        private void ApplyRewards(IEnumerable<RewardDefinition> rewards, DateTimeOffset at)
        {
            foreach (RewardDefinition reward in rewards)
            {
                switch (reward.Type)
                {
                    case "points":
                        _state.Mining.AvailableMiningPoints = checked(
                            _state.Mining.AvailableMiningPoints + reward.Amount);
                        _state.Mining.TotalMiningPointsEarned = checked(
                            _state.Mining.TotalMiningPointsEarned + reward.Amount);
                        break;
                    case "tickets":
                        _state.Mining.GachaTickets = checked(_state.Mining.GachaTickets + reward.Amount);
                        break;
                    case "fragments":
                        _state.Mining.StoneFragments = checked(_state.Mining.StoneFragments + reward.Amount);
                        _state.Mining.TotalStoneFragmentsEarned = checked(
                            _state.Mining.TotalStoneFragmentsEarned + reward.Amount);
                        break;
                    case "title":
                        if (!_state.OwnedTitles.ContainsKey(reward.TitleId))
                            _state.OwnedTitles[reward.TitleId] = FormatUtc(at);
                        break;
                    case "profileIcon":
                    case "profileFrame":
                        CollectionEntry entry;
                        if (!_state.Collection.TryGetValue(reward.ItemId, out entry))
                        {
                            entry = new CollectionEntry
                            {
                                ItemId = reward.ItemId,
                                FirstAcquiredAtUtc = FormatUtc(at),
                                Seen = false
                            };
                            _state.Collection[reward.ItemId] = entry;
                        }
                        entry.Count++;
                        entry.LastAcquiredAtUtc = FormatUtc(at);
                        break;
                }
            }
        }

        private void MarkGrantClaimed(RewardGrantProgress grant, DateTimeOffset at)
        {
            grant.Claimed = true;
            grant.ClaimedAtUtc = FormatUtc(at);
            if (grant.SourceType == "achievement")
            {
                AchievementProgress progress;
                if (_state.Achievements.TryGetValue(grant.SourceId, out progress))
                {
                    progress.RewardClaimed = true;
                    progress.RewardClaimedAtUtc = grant.ClaimedAtUtc;
                }
            }
        }

        private MetaGameEvent RewardClaimedEvent(RewardGrantProgress progress,
            List<RewardDefinition> rewards)
        {
            return new MetaGameEvent
            {
                Type = "reward.claimed",
                Id = progress.GrantId,
                Title = "REWARD ACQUIRED",
                Subtitle = GrantTitle(progress),
                Rarity = "EPIC",
                Variant = "reward",
                Rewards = rewards,
                GrantId = progress.GrantId
            };
        }

        private void UnlockAchievements(AchievementContext context, List<MetaGameEvent> events,
            DateTimeOffset unlockedAt)
        {
            foreach (AchievementDefinition definition in _catalog.Achievements)
                if (!_state.Achievements.ContainsKey(definition.Id)
                    && AchievementSatisfied(definition.Condition, context))
                    UnlockAchievement(definition, events, unlockedAt);
        }

        private void UnlockAchievement(AchievementDefinition definition, List<MetaGameEvent> events,
            DateTimeOffset unlockedAt)
        {
            string grantId = CreateRewardGrant("achievement", definition.Id, definition.Rewards, unlockedAt);
            _state.Achievements[definition.Id] = new AchievementProgress
            {
                AchievementId = definition.Id,
                UnlockedAtUtc = FormatUtc(unlockedAt),
                RewardClaimed = String.IsNullOrEmpty(grantId),
                RewardClaimedAtUtc = String.IsNullOrEmpty(grantId) ? FormatUtc(unlockedAt) : ""
            };
            events.Add(new MetaGameEvent
            {
                Type = "achievement.unlocked",
                Id = definition.Id,
                Title = definition.Name,
                Subtitle = definition.Description,
                Rarity = definition.Tier,
                Variant = definition.Tier == "SECRET" ? "secret-reveal" : "standard",
                Rewards = definition.Rewards ?? new List<RewardDefinition>(),
                GrantId = grantId
            });
        }

        private bool AchievementSatisfied(AchievementCondition condition, AchievementContext context)
        {
            switch (condition.Type)
            {
                case "minedTotal": return _state.Mining.TotalStoneMined >= condition.Value;
                case "minedDaily":
                    return context.MiningLocalTime.HasValue
                        && DailyValue(context.MiningLocalTime.Value) >= condition.Value;
                case "minedAtLocalHour":
                    return context.MiningLocalTime.HasValue
                        && context.MiningLocalTime.Value.Hour == condition.Value;
                case "longestSessionMinutes":
                    return _state.Mining.LongestSessionSeconds >= condition.Value * 60;
                case "activeMinutes": return _state.Mining.TotalActiveSeconds >= condition.Value * 60;
                case "gachaTotal": return _state.Gacha.TotalDraws >= condition.Value;
                case "tenPullBatches": return _state.Gacha.TenPullBatches >= condition.Value;
                case "rarityCountAtLeast": return RarityCountAtLeast(condition.Rarity) >= condition.Value;
                case "maxDuplicateCount": return _state.Collection.Values.Any(x => x.Count >= condition.Value);
                case "collectionPercent": return CollectionPercent() + 0.0001 >= condition.Value;
                case "affinityMax": return _catalog.NextAffinity(_state.Mining.TotalStoneMined) == null;
                case "ssrMissStreak": return _state.Gacha.CurrentSsrMissStreak >= condition.Value;
                case "rarityInLastBatchAtLeast":
                    return context.LastBatch != null && context.LastBatch.Count(x =>
                        _catalog.RarityOrder(x.Rarity) >= _catalog.RarityOrder(condition.Rarity))
                        >= condition.Value;
                case "miningLevel": return _state.Mining.MiningLevel >= condition.Value;
                case "favoriteCount": return _state.Collection.Values.Count(x => x.Favorite) >= condition.Value;
                case "profileCustomIcon": return _state.Profile.Icon == "custom:image";
                case "profileTitleEquipped": return _state.Profile.TitleId != "rookie-miner";
                case "fragmentTotal": return _state.Mining.TotalStoneFragmentsEarned >= condition.Value;
                default: return false;
            }
        }

        private long AchievementCurrent(AchievementCondition condition, DateTimeOffset now)
        {
            switch (condition.Type)
            {
                case "minedTotal": return _state.Mining.TotalStoneMined;
                case "minedDaily": return DailyValue(TimeZoneInfo.ConvertTime(now, _clock.LocalTimeZone));
                case "minedAtLocalHour": return 0;
                case "longestSessionMinutes": return _state.Mining.LongestSessionSeconds / 60;
                case "activeMinutes": return _state.Mining.TotalActiveSeconds / 60;
                case "gachaTotal": return _state.Gacha.TotalDraws;
                case "tenPullBatches": return _state.Gacha.TenPullBatches;
                case "rarityCountAtLeast": return RarityCountAtLeast(condition.Rarity);
                case "maxDuplicateCount": return _state.Collection.Count == 0 ? 0
                    : _state.Collection.Values.Max(x => x.Count);
                case "collectionPercent": return (long)Math.Floor(CollectionPercent());
                case "affinityMax": return _catalog.NextAffinity(_state.Mining.TotalStoneMined) == null ? 1 : 0;
                case "ssrMissStreak": return _state.Gacha.CurrentSsrMissStreak;
                case "miningLevel": return _state.Mining.MiningLevel;
                case "favoriteCount": return _state.Collection.Values.Count(x => x.Favorite);
                case "profileCustomIcon": return _state.Profile.Icon == "custom:image" ? 1 : 0;
                case "profileTitleEquipped": return _state.Profile.TitleId != "rookie-miner" ? 1 : 0;
                case "fragmentTotal": return _state.Mining.TotalStoneFragmentsEarned;
                default: return 0;
            }
        }

        private long RarityCountAtLeast(string rarity)
        {
            int order = _catalog.RarityOrder(rarity);
            long total = 0;
            foreach (KeyValuePair<string, long> pair in _state.Gacha.RarityCounts)
                if (_catalog.RarityOrder(pair.Key) >= order) total += pair.Value;
            return total;
        }

        private int LevelForXp(long xp)
        {
            long used = 0;
            int level = 1;
            while (level < _catalog.Gacha.Progression.MaximumLevel)
            {
                long cost = XpCostForLevel(level);
                if (xp - used < cost) break;
                used = checked(used + cost);
                level++;
            }
            return level;
        }

        private long XpCostForLevel(int level)
        {
            return (long)Math.Ceiling(_catalog.Gacha.Progression.LevelBaseXp
                * Math.Pow(Math.Max(1, level), _catalog.Gacha.Progression.LevelExponent));
        }

        private long CumulativeXpForLevel(int level)
        {
            long total = 0;
            for (int current = 1; current < level; current++) total = checked(total + XpCostForLevel(current));
            return total;
        }

        private void RecalculateDerivedValues()
        {
            _state.Mining.MiningLevel = LevelForXp(_state.Mining.MiningXp);
        }

        private void UpdateLiveSessionDuration(DateTimeOffset now)
        {
            DateTimeOffset start;
            if (!String.IsNullOrEmpty(_state.Mining.ActiveSessionId)
                && DateTimeOffset.TryParse(_state.Mining.ActiveSessionStartedAtUtc,
                    CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out start))
                _state.Mining.LongestSessionSeconds = Math.Max(_state.Mining.LongestSessionSeconds,
                    Math.Max(0, (long)(now - start).TotalSeconds));
        }

        private void FinishActiveSession(DateTimeOffset endedAt)
        {
            DateTimeOffset start;
            if (DateTimeOffset.TryParse(_state.Mining.ActiveSessionStartedAtUtc,
                CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out start))
            {
                long seconds = Math.Max(0, (long)(endedAt - start).TotalSeconds);
                _state.Mining.TotalActiveSeconds = checked(_state.Mining.TotalActiveSeconds + seconds);
                _state.Mining.LongestSessionSeconds = Math.Max(_state.Mining.LongestSessionSeconds, seconds);
            }
            _state.Mining.ActiveSessionId = "";
            _state.Mining.ActiveSessionStartedAtUtc = "";
        }

        private bool RecoverInterruptedSession(DateTimeOffset now)
        {
            if (String.IsNullOrEmpty(_state.Mining.ActiveSessionId)) return false;
            DateTimeOffset start;
            DateTimeOffset lastMined;
            long seconds = 0;
            if (DateTimeOffset.TryParse(_state.Mining.ActiveSessionStartedAtUtc,
                    CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out start)
                && DateTimeOffset.TryParse(_state.Mining.LastMinedAtUtc,
                    CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out lastMined)
                && lastMined >= start && lastMined <= now)
                seconds = Math.Max(0, (long)(lastMined - start).TotalSeconds);
            _state.Mining.TotalActiveSeconds = checked(_state.Mining.TotalActiveSeconds + seconds);
            _state.Mining.LongestSessionSeconds = Math.Max(_state.Mining.LongestSessionSeconds, seconds);
            _state.Mining.ActiveSessionId = "";
            _state.Mining.ActiveSessionStartedAtUtc = "";
            return true;
        }

        private bool CanUseAppearance(string value, string rewardType, string custom)
        {
            if (rewardType == "profileIcon" && (value == "builtin:stone" || value == "custom:image"))
                return value != "custom:image" || IsValidCustomIconDataUri(custom);
            if (rewardType == "profileFrame" && value == "builtin:default") return true;
            if (!value.StartsWith("item:", StringComparison.Ordinal)) return false;
            string id = value.Substring(5);
            ItemDefinition item;
            return _catalog.ItemsById.TryGetValue(id, out item) && item.RewardType == rewardType
                && _state.Collection.ContainsKey(id);
        }

        private MetaGameSnapshot BuildSnapshot(DateTimeOffset now)
        {
            AffinityRank current = _catalog.AffinityAt(_state.Mining.TotalStoneMined);
            AffinityRank next = _catalog.NextAffinity(_state.Mining.TotalStoneMined);
            long span = next == null ? 1 : Math.Max(1, next.Mined - current.Mined);
            long rankProgress = Math.Max(0, _state.Mining.TotalStoneMined - current.Mined);
            long levelStart = CumulativeXpForLevel(_state.Mining.MiningLevel);
            long nextLevel = _state.Mining.MiningLevel >= _catalog.Gacha.Progression.MaximumLevel
                ? levelStart : checked(levelStart + XpCostForLevel(_state.Mining.MiningLevel));
            long levelRequired = Math.Max(1, nextLevel - levelStart);
            DateTimeOffset created;
            int days = DateTimeOffset.TryParse(_state.Profile.CreatedAtUtc, out created)
                ? Math.Max(1, (int)(now - created).TotalDays + 1) : 1;

            var snapshot = new MetaGameSnapshot
            {
                SchemaVersion = _state.SchemaVersion,
                Profile = _state.Profile,
                Mining = _state.Mining,
                Gacha = _state.Gacha,
                Settings = _state.Settings,
                Achievements = _state.Achievements,
                Collection = _state.Collection,
                OwnedTitles = _state.OwnedTitles,
                Affinity = new AffinityView
                {
                    Id = current.Id,
                    Name = current.Name,
                    Line = current.Line,
                    Badge = current.Badge,
                    Current = _state.Mining.TotalStoneMined,
                    RankStart = current.Mined,
                    NextAt = next == null ? current.Mined : next.Mined,
                    Remaining = next == null ? 0 : next.Mined - _state.Mining.TotalStoneMined,
                    Progress = next == null ? 1 : Math.Min(1, (double)rankProgress / span),
                    IsMaximum = next == null,
                    DaysTogether = days,
                    NextRewards = next?.Rewards ?? new List<RewardDefinition>()
                },
                LevelProgress = new LevelProgressView
                {
                    Level = _state.Mining.MiningLevel,
                    TotalXp = _state.Mining.MiningXp,
                    LevelStartXp = levelStart,
                    NextLevelXp = nextLevel,
                    XpIntoLevel = Math.Max(0, _state.Mining.MiningXp - levelStart),
                    XpRequired = levelRequired,
                    Progress = Math.Min(1, (double)Math.Max(0, _state.Mining.MiningXp - levelStart)
                        / levelRequired),
                    NextReward = _catalog.LevelRewards.FirstOrDefault(x => x.Level > _state.Mining.MiningLevel)
                },
                Statistics = BuildStatistics(now),
                CollectionTotal = _catalog.Items.Count,
                CollectionOwned = _state.Collection.Count,
                CollectionPercent = CollectionPercent(),
                AchievementTotal = _catalog.Achievements.Count,
                AchievementUnlocked = _state.Achievements.Count,
                UnseenCollectionCount = _state.Collection.Values.Count(x => !x.Seen),
                PendingRewardCount = _state.RewardGrants.Values.Count(x => !x.Claimed),
                GachaStatistics = BuildGachaStatistics(),
                AchievementViews = BuildAchievementViews(now),
                RewardGrantViews = BuildRewardGrantViews()
            };
            snapshot.HomeGoals = BuildHomeGoals(snapshot);
            return snapshot;
        }

        private StatisticsView BuildStatistics(DateTimeOffset utcNow)
        {
            DateTimeOffset local = TimeZoneInfo.ConvertTime(utcNow, _clock.LocalTimeZone);
            DateTime today = local.Date;
            int offset = ((int)today.DayOfWeek + 6) % 7;
            DateTime weekStart = today.AddDays(-offset);
            DateTime monthStart = new DateTime(today.Year, today.Month, 1);
            long todayCount = 0, week = 0, month = 0;
            foreach (KeyValuePair<string, long> pair in _state.Mining.DailyTotals)
            {
                DateTime date;
                if (!DateTime.TryParseExact(pair.Key, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out date)) continue;
                if (date == today) todayCount += pair.Value;
                if (date >= weekStart && date <= today) week += pair.Value;
                if (date >= monthStart && date <= today) month += pair.Value;
            }
            return new StatisticsView { Today = todayCount, Week = week, Month = month,
                Lifetime = _state.Mining.TotalStoneMined };
        }

        private GachaStatisticsView BuildGachaStatistics()
        {
            var result = new GachaStatisticsView
            {
                TotalDraws = _state.Gacha.TotalDraws,
                SingleDraws = _state.Gacha.SingleDraws,
                TenPullBatches = _state.Gacha.TenPullBatches,
                WorstSsrMissStreak = _state.Gacha.WorstSsrMissStreak,
                WorstUrMissStreak = _state.Gacha.WorstUrMissStreak,
                BestHighRarityBatch = _state.Gacha.BestHighRarityBatch,
                BestLegendaryBatch = _state.Gacha.BestLegendaryBatch,
                RarityCounts = new Dictionary<string, long>(_state.Gacha.RarityCounts,
                    StringComparer.Ordinal)
            };
            foreach (RarityDefinition rarity in _catalog.Gacha.Rarities)
            {
                long count;
                _state.Gacha.RarityCounts.TryGetValue(rarity.Id, out count);
                result.ActualRates[rarity.Id] = _state.Gacha.TotalDraws == 0 ? 0
                    : (double)count * 100 / _state.Gacha.TotalDraws;
                result.PublishedRates[rarity.Id] = (double)_catalog.DefaultBanner.Rates[rarity.Id] / 100;
            }
            return result;
        }

        private List<AchievementView> BuildAchievementViews(DateTimeOffset now)
        {
            return _catalog.Achievements.Select(definition =>
            {
                AchievementProgress unlocked;
                bool has = _state.Achievements.TryGetValue(definition.Id, out unlocked);
                long current = has ? definition.Condition.Value
                    : AchievementCurrent(definition.Condition, now);
                return new AchievementView
                {
                    Id = definition.Id,
                    Unlocked = has,
                    RewardClaimed = has && unlocked.RewardClaimed,
                    Current = Math.Min(definition.Condition.Value, Math.Max(0, current)),
                    Target = definition.Condition.Value,
                    Progress = definition.Condition.Value <= 0 ? 0
                        : Math.Min(1, (double)Math.Max(0, current) / definition.Condition.Value)
                };
            }).ToList();
        }

        private List<RewardGrantView> BuildRewardGrantViews()
        {
            return _state.RewardGrants.Values.OrderByDescending(x => x.UnlockedAtUtc)
                .Select(progress => new RewardGrantView
                {
                    GrantId = progress.GrantId,
                    SourceType = progress.SourceType,
                    SourceId = progress.SourceId,
                    Title = GrantTitle(progress),
                    UnlockedAtUtc = progress.UnlockedAtUtc,
                    Claimed = progress.Claimed,
                    Rewards = ResolveGrantRewards(progress)
                }).ToList();
        }

        private List<HomeGoalView> BuildHomeGoals(MetaGameSnapshot snapshot)
        {
            var goals = new List<HomeGoalView>();
            if (snapshot.PendingRewardCount > 0)
                goals.Add(new HomeGoalView { Id = "pending-rewards", Kind = "reward",
                    Label = "受け取れる報酬があります", RewardLabel = snapshot.PendingRewardCount + "件",
                    Current = snapshot.PendingRewardCount, Target = snapshot.PendingRewardCount,
                    Remaining = 0, Progress = 1 });

            int ticketEvery = _catalog.Gacha.Economy.TicketEveryMines;
            long ticketTarget = checked((_state.Mining.TotalStoneMined / ticketEvery + 1) * ticketEvery);
            goals.Add(Goal("next-ticket", "ticket", "次の採掘チケット",
                "ガチャチケット ×" + _catalog.Gacha.Economy.TicketsPerMilestone,
                _state.Mining.TotalStoneMined, ticketTarget, ticketTarget - ticketEvery));

            AffinityRank nextAffinity = _catalog.NextAffinity(_state.Mining.TotalStoneMined);
            if (nextAffinity != null)
            {
                AffinityRank currentAffinity = _catalog.AffinityAt(_state.Mining.TotalStoneMined);
                goals.Add(Goal("next-affinity", "affinity", "次の関係「" + nextAffinity.Name + "」",
                    RewardSummary(nextAffinity.Rewards), _state.Mining.TotalStoneMined,
                    nextAffinity.Mined, currentAffinity.Mined));
            }

            if (_state.Mining.MiningLevel < _catalog.Gacha.Progression.MaximumLevel)
                goals.Add(Goal("next-level", "level", "Mining LV."
                    + (_state.Mining.MiningLevel + 1), "レベルアップ",
                    _state.Mining.MiningXp, snapshot.LevelProgress.NextLevelXp,
                    snapshot.LevelProgress.LevelStartXp));

            int nextPercent = new[] { 25, 50, 75, 100 }.FirstOrDefault(x => snapshot.CollectionPercent < x);
            if (nextPercent > 0)
            {
                long targetOwned = (long)Math.Ceiling((double)_catalog.Items.Count * nextPercent / 100);
                goals.Add(Goal("collection-" + nextPercent, "collection",
                    "COLLECTION " + nextPercent + "%", "図鑑マイルストーン",
                    _state.Collection.Count, targetOwned));
            }
            return goals.Take(4).ToList();
        }

        private static HomeGoalView Goal(string id, string kind, string label, string reward,
            long current, long target, long start = 0)
        {
            long span = Math.Max(0, target - start);
            long position = Math.Max(0, Math.Min(span, current - start));
            return new HomeGoalView
            {
                Id = id, Kind = kind, Label = label, RewardLabel = reward,
                Current = position, Target = span, Remaining = Math.Max(0, target - current),
                Progress = span <= 0 ? 1 : Math.Min(1, (double)position / span)
            };
        }

        private string RewardSummary(List<RewardDefinition> rewards)
        {
            if (rewards == null || rewards.Count == 0) return "関係バッジ";
            RewardDefinition first = rewards[0];
            if (first.Type == "tickets") return "ガチャチケット ×" + first.Amount;
            if (first.Type == "points") return "Mining Points ×" + first.Amount;
            if (first.Type == "fragments") return "Stone Fragment ×" + first.Amount;
            if (first.Type == "title" && _catalog.TitlesById.ContainsKey(first.TitleId))
                return "称号「" + _catalog.TitlesById[first.TitleId].Name + "」";
            if (!String.IsNullOrEmpty(first.ItemId) && _catalog.ItemsById.ContainsKey(first.ItemId))
                return _catalog.ItemsById[first.ItemId].Name;
            return "記念報酬";
        }

        private long DailyValue(DateTimeOffset local)
        {
            long value;
            _state.Mining.DailyTotals.TryGetValue(local.ToString("yyyy-MM-dd",
                CultureInfo.InvariantCulture), out value);
            return value;
        }

        private double CollectionPercent()
        {
            return _catalog.Items.Count == 0 ? 0
                : (double)_state.Collection.Count * 100 / _catalog.Items.Count;
        }

        private string AffinityEventRarity(AffinityRank rank)
        {
            int index = _catalog.AffinityRanks.ToList().FindIndex(x => x.Id == rank.Id);
            if (index >= _catalog.AffinityRanks.Count - 1) return "LEGENDARY";
            if (index >= 10) return "UR";
            if (index >= 7) return "SSR";
            if (index >= 4) return "SUPER_RARE";
            return index >= 2 ? "RARE" : "NORMAL";
        }

        private static string LevelEventRarity(int level)
        {
            if (level >= 100) return "LEGENDARY";
            if (level >= 75) return "UR";
            if (level >= 50) return "SSR";
            if (level >= 25) return "SUPER_RARE";
            return level >= 10 ? "RARE" : "NORMAL";
        }

        private bool BannerIsActive(GachaBannerDefinition banner, DateTimeOffset now)
        {
            DateTimeOffset start;
            DateTimeOffset end;
            return (String.IsNullOrEmpty(banner.StartAtUtc)
                    || !DateTimeOffset.TryParse(banner.StartAtUtc, out start) || now >= start)
                && (String.IsNullOrEmpty(banner.EndAtUtc)
                    || !DateTimeOffset.TryParse(banner.EndAtUtc, out end) || now <= end);
        }

        private static bool IsValidCustomIconDataUri(string value)
        {
            if (String.IsNullOrEmpty(value) || value.Length > 700000
                || value.IndexOfAny(new[] { '\r', '\n', '\0' }) >= 0) return false;
            string[] prefixes =
            {
                "data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"
            };
            string prefix = prefixes.FirstOrDefault(x => value.StartsWith(x, StringComparison.Ordinal));
            if (prefix == null) return false;
            string payload = value.Substring(prefix.Length);
            if (payload.Length < 4 || payload.Length % 4 != 0) return false;
            try
            {
                byte[] decoded = Convert.FromBase64String(payload);
                return decoded.Length > 0 && decoded.Length <= 512 * 1024;
            }
            catch (FormatException) { return false; }
        }

        private MutationResult Success(bool duplicate, DrawReceipt draw, List<MetaGameEvent> events)
        {
            return new MutationResult { Ok = true, Duplicate = duplicate, Draw = draw,
                Events = events, Snapshot = BuildSnapshot(_clock.UtcNow) };
        }

        private MutationResult Failure(string error)
        {
            return new MutationResult { Ok = false, Error = error, Snapshot = BuildSnapshot(_clock.UtcNow) };
        }

        private void Save(DateTimeOffset now) { _store.Save(_state, now); }
        private static bool IsSafeEventId(string value)
        {
            return !String.IsNullOrEmpty(value) && EventIdPattern.IsMatch(value);
        }
        private static bool ValidVolume(double value)
        {
            return !Double.IsNaN(value) && !Double.IsInfinity(value) && value >= 0 && value <= 1;
        }
        private static string FormatUtc(DateTimeOffset value)
        {
            return value.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
        }
        private static void TrimFromFront<T>(List<T> values, int maximum)
        {
            if (values.Count > maximum) values.RemoveRange(0, values.Count - maximum);
        }

        private sealed class AchievementContext
        {
            public DateTimeOffset? MiningLocalTime;
            public List<DrawResult> LastBatch;
        }
    }
}
