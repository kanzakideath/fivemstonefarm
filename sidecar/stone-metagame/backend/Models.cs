using System;
using System.Collections.Generic;

namespace AiMiner.StoneMetaGame
{
    public sealed class MetaGameState
    {
        public int SchemaVersion { get; set; } = 2;
        public ProfileState Profile { get; set; } = new ProfileState();
        public MiningState Mining { get; set; } = new MiningState();
        public GachaState Gacha { get; set; } = new GachaState();
        public Dictionary<string, AchievementProgress> Achievements { get; set; }
            = new Dictionary<string, AchievementProgress>(StringComparer.Ordinal);
        public Dictionary<string, CollectionEntry> Collection { get; set; }
            = new Dictionary<string, CollectionEntry>(StringComparer.Ordinal);
        public MetaSettings Settings { get; set; } = new MetaSettings();
        public Dictionary<string, RewardGrantProgress> RewardGrants { get; set; }
            = new Dictionary<string, RewardGrantProgress>(StringComparer.Ordinal);
        public Dictionary<string, string> OwnedTitles { get; set; }
            = new Dictionary<string, string>(StringComparer.Ordinal);
        public List<string> ProcessedMiningEventIds { get; set; } = new List<string>();
        public List<DrawReceipt> RecentDrawReceipts { get; set; } = new List<DrawReceipt>();
    }

    public sealed class ProfileState
    {
        public string Name { get; set; } = "Miner";
        public string Icon { get; set; } = "builtin:stone";
        public string Frame { get; set; } = "builtin:default";
        public string CustomIconDataUri { get; set; } = "";
        public string TitleId { get; set; } = "rookie-miner";
        public bool OnboardingComplete { get; set; }
        public string CreatedAtUtc { get; set; } = "";
    }

    public sealed class MiningState
    {
        public long TotalStoneMined { get; set; }
        public long MiningXp { get; set; }
        public int MiningLevel { get; set; } = 1;
        public long AvailableMiningPoints { get; set; }
        public long TotalMiningPointsEarned { get; set; }
        public int GachaTickets { get; set; }
        public long StoneFragments { get; set; }
        public long TotalStoneFragmentsEarned { get; set; }
        public long TotalActiveSeconds { get; set; }
        public long LongestSessionSeconds { get; set; }
        public string ActiveSessionId { get; set; } = "";
        public string ActiveSessionStartedAtUtc { get; set; } = "";
        public string LastMinedAtUtc { get; set; } = "";
        public Dictionary<string, long> DailyTotals { get; set; }
            = new Dictionary<string, long>(StringComparer.Ordinal);
    }

    public sealed class GachaState
    {
        public long TotalDraws { get; set; }
        public int SsrMisses { get; set; }
        public int UrMisses { get; set; }
        public int CurrentSsrMissStreak { get; set; }
        public int WorstSsrMissStreak { get; set; }
        public int CurrentUrMissStreak { get; set; }
        public int WorstUrMissStreak { get; set; }
        public int BestHighRarityBatch { get; set; }
        public int BestLegendaryBatch { get; set; }
        public long SingleDraws { get; set; }
        public long TenPullBatches { get; set; }
        public string HighestRarity { get; set; } = "";
        public Dictionary<string, long> RarityCounts { get; set; }
            = new Dictionary<string, long>(StringComparer.Ordinal);
        public List<GachaHistoryEntry> History { get; set; } = new List<GachaHistoryEntry>();
        public Dictionary<string, BannerProgressState> BannerProgress { get; set; }
            = new Dictionary<string, BannerProgressState>(StringComparer.Ordinal);
    }

    public sealed class BannerProgressState
    {
        public string BannerId { get; set; }
        public long TotalDraws { get; set; }
        public Dictionary<string, int> PityCounters { get; set; }
            = new Dictionary<string, int>(StringComparer.Ordinal);
    }

    public sealed class GachaHistoryEntry
    {
        public long Sequence { get; set; }
        public string DrawnAtUtc { get; set; }
        public string RequestId { get; set; }
        public int BatchSize { get; set; }
        public string BannerId { get; set; }
        public string BannerName { get; set; }
        public string ItemId { get; set; }
        public string Rarity { get; set; }
        public bool WasNew { get; set; }
        public bool WasFakeout { get; set; }
        public string PresentationVariant { get; set; }
        public int NominalBasisPoints { get; set; }
        public int PityCountBefore { get; set; }
        public string PityTrackId { get; set; }
    }

    public sealed class CollectionEntry
    {
        public string ItemId { get; set; }
        public int Count { get; set; }
        public string FirstAcquiredAtUtc { get; set; }
        public string LastAcquiredAtUtc { get; set; }
        public bool Favorite { get; set; }
        public bool Seen { get; set; }
    }

    public sealed class AchievementProgress
    {
        public string AchievementId { get; set; }
        public string UnlockedAtUtc { get; set; }
        public bool RewardClaimed { get; set; }
        public string RewardClaimedAtUtc { get; set; }
    }

    public sealed class RewardGrantProgress
    {
        public string GrantId { get; set; }
        public string SourceType { get; set; }
        public string SourceId { get; set; }
        public string UnlockedAtUtc { get; set; }
        public bool Claimed { get; set; }
        public string ClaimedAtUtc { get; set; }
    }

    public sealed class MetaSettings
    {
        public double MasterVolume { get; set; } = 0.8;
        public double BgmVolume { get; set; } = 0.45;
        public double SfxVolume { get; set; } = 0.8;
        public bool Muted { get; set; }
        public string EffectQuality { get; set; } = "normal";
        public bool ReduceMotion { get; set; }
        public string AnimationSpeed { get; set; } = "normal";
        public bool SkipPreviouslySeenLegendary { get; set; }
    }

    public sealed class MutationResult
    {
        public bool Ok { get; set; }
        public bool Duplicate { get; set; }
        public string Error { get; set; }
        public MetaGameSnapshot Snapshot { get; set; }
        public List<MetaGameEvent> Events { get; set; } = new List<MetaGameEvent>();
        public DrawReceipt Draw { get; set; }
    }

    public sealed class DrawReceipt
    {
        public string RequestId { get; set; }
        public string DrawnAtUtc { get; set; }
        public string BannerId { get; set; }
        public string BannerName { get; set; }
        public int Count { get; set; }
        public string Payment { get; set; }
        public int PointsSpent { get; set; }
        public int TicketsSpent { get; set; }
        public List<DrawResult> Results { get; set; } = new List<DrawResult>();
    }

    public sealed class DrawResult
    {
        public string ItemId { get; set; }
        public string Rarity { get; set; }
        public bool IsNew { get; set; }
        public int OwnedCount { get; set; }
        public bool Fakeout { get; set; }
        public string PresentedFromRarity { get; set; }
        public bool PityTriggered { get; set; }
        public string PityTrackId { get; set; }
        public int PityCountBefore { get; set; }
        public int NominalBasisPoints { get; set; }
        public int FragmentsGained { get; set; }
        public string PresentationVariant { get; set; }
        public string PreCue { get; set; }
    }

    public sealed class MetaGameEvent
    {
        public string Type { get; set; }
        public string Id { get; set; }
        public string Title { get; set; }
        public string Subtitle { get; set; }
        public string Rarity { get; set; }
        public string Previous { get; set; }
        public string Current { get; set; }
        public string Variant { get; set; }
        public List<RewardDefinition> Rewards { get; set; } = new List<RewardDefinition>();
        public string GrantId { get; set; }
    }

    public sealed class MetaGameSnapshot
    {
        public int SchemaVersion { get; set; }
        public ProfileState Profile { get; set; }
        public MiningState Mining { get; set; }
        public GachaState Gacha { get; set; }
        public MetaSettings Settings { get; set; }
        public Dictionary<string, AchievementProgress> Achievements { get; set; }
        public Dictionary<string, CollectionEntry> Collection { get; set; }
        public AffinityView Affinity { get; set; }
        public StatisticsView Statistics { get; set; }
        public int CollectionTotal { get; set; }
        public int CollectionOwned { get; set; }
        public double CollectionPercent { get; set; }
        public int AchievementTotal { get; set; }
        public int AchievementUnlocked { get; set; }
        public int PendingRewardCount { get; set; }
        public int UnseenCollectionCount { get; set; }
        public LevelProgressView LevelProgress { get; set; }
        public GachaStatisticsView GachaStatistics { get; set; }
        public List<AchievementView> AchievementViews { get; set; }
            = new List<AchievementView>();
        public List<RewardGrantView> RewardGrantViews { get; set; }
            = new List<RewardGrantView>();
        public List<HomeGoalView> HomeGoals { get; set; } = new List<HomeGoalView>();
        public Dictionary<string, string> OwnedTitles { get; set; }
    }

    public sealed class AffinityView
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Line { get; set; }
        public long Current { get; set; }
        public long RankStart { get; set; }
        public long NextAt { get; set; }
        public long Remaining { get; set; }
        public double Progress { get; set; }
        public bool IsMaximum { get; set; }
        public int DaysTogether { get; set; }
        public string Badge { get; set; }
        public List<RewardDefinition> NextRewards { get; set; } = new List<RewardDefinition>();
    }

    public sealed class LevelProgressView
    {
        public int Level { get; set; }
        public long TotalXp { get; set; }
        public long LevelStartXp { get; set; }
        public long NextLevelXp { get; set; }
        public long XpIntoLevel { get; set; }
        public long XpRequired { get; set; }
        public double Progress { get; set; }
        public LevelRewardDefinition NextReward { get; set; }
    }

    public sealed class GachaStatisticsView
    {
        public long TotalDraws { get; set; }
        public long SingleDraws { get; set; }
        public long TenPullBatches { get; set; }
        public int WorstSsrMissStreak { get; set; }
        public int WorstUrMissStreak { get; set; }
        public int BestHighRarityBatch { get; set; }
        public int BestLegendaryBatch { get; set; }
        public Dictionary<string, long> RarityCounts { get; set; }
            = new Dictionary<string, long>(StringComparer.Ordinal);
        public Dictionary<string, double> ActualRates { get; set; }
            = new Dictionary<string, double>(StringComparer.Ordinal);
        public Dictionary<string, double> PublishedRates { get; set; }
            = new Dictionary<string, double>(StringComparer.Ordinal);
    }

    public sealed class AchievementView
    {
        public string Id { get; set; }
        public bool Unlocked { get; set; }
        public bool RewardClaimed { get; set; }
        public long Current { get; set; }
        public long Target { get; set; }
        public double Progress { get; set; }
    }

    public sealed class RewardGrantView
    {
        public string GrantId { get; set; }
        public string SourceType { get; set; }
        public string SourceId { get; set; }
        public string Title { get; set; }
        public string UnlockedAtUtc { get; set; }
        public bool Claimed { get; set; }
        public List<RewardDefinition> Rewards { get; set; } = new List<RewardDefinition>();
    }

    public sealed class HomeGoalView
    {
        public string Id { get; set; }
        public string Kind { get; set; }
        public string Label { get; set; }
        public string RewardLabel { get; set; }
        public long Current { get; set; }
        public long Target { get; set; }
        public long Remaining { get; set; }
        public double Progress { get; set; }
    }

    public sealed class StatisticsView
    {
        public long Today { get; set; }
        public long Week { get; set; }
        public long Month { get; set; }
        public long Lifetime { get; set; }
    }

    public sealed class GachaCatalogDocument
    {
        public int SchemaVersion { get; set; }
        public EconomyDefinition Economy { get; set; }
        public List<RarityDefinition> Rarities { get; set; }
        public PresentationDefinition Presentation { get; set; }
        public ProgressionDefinition Progression { get; set; }
    }

    public sealed class BannersDocument
    {
        public int SchemaVersion { get; set; }
        public List<GachaBannerDefinition> Banners { get; set; }
    }

    public sealed class GachaBannerDefinition
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string BannerAssetId { get; set; }
        public string StartAtUtc { get; set; }
        public string EndAtUtc { get; set; }
        public bool IsDefault { get; set; }
        public int Cost { get; set; }
        public int TenPullCost { get; set; }
        public BannerPoolDefinition Pool { get; set; }
        public List<PickupDefinition> Pickups { get; set; }
        public Dictionary<string, int> Rates { get; set; }
        public List<PityTrackDefinition> PityTracks { get; set; }
        public string TenPullMinimumRarity { get; set; }
    }

    public sealed class BannerPoolDefinition
    {
        public List<string> ItemIds { get; set; }
        public List<string> Categories { get; set; }
        public bool IncludeSecret { get; set; }
    }

    public sealed class PickupDefinition
    {
        public string ItemId { get; set; }
        public int ShareBasisPoints { get; set; }
    }

    public sealed class PityTrackDefinition
    {
        public string Id { get; set; }
        public string Label { get; set; }
        public int Threshold { get; set; }
        public string MinimumRarity { get; set; }
        public string ResetAtOrAbove { get; set; }
    }

    public sealed class EconomyDefinition
    {
        public int MiningPointsPerSuccess { get; set; }
        public int PointsPerDraw { get; set; }
        public int TicketEveryMines { get; set; }
        public int TicketsPerMilestone { get; set; }
        public int HistoryLimit { get; set; }
        public int ProcessedEventLimit { get; set; }
        public Dictionary<string, int> DuplicateFragments { get; set; }
    }

    public sealed class ProgressionDefinition
    {
        public int XpPerMining { get; set; }
        public int LevelBaseXp { get; set; }
        public double LevelExponent { get; set; }
        public int MaximumLevel { get; set; }
    }

    public sealed class RarityDefinition
    {
        public string Id { get; set; }
        public string Label { get; set; }
        public int BasisPoints { get; set; }
        public int Order { get; set; }
        public string Color { get; set; }
    }

    public sealed class PresentationDefinition
    {
        public Dictionary<string, int> FakeoutBasisPoints { get; set; }
        public int SingleReelCards { get; set; }
        public int SingleTargetIndex { get; set; }
        public int HistoryPreviewLimit { get; set; }
        public Dictionary<string, List<string>> HighRarityVariants { get; set; }
        public Dictionary<string, int> PreCueBasisPoints { get; set; }
        public Dictionary<string, double> SpeedMultipliers { get; set; }
    }

    public sealed class ItemsDocument
    {
        public int SchemaVersion { get; set; }
        public List<ItemDefinition> Items { get; set; }
    }

    public sealed class ItemDefinition
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string Rarity { get; set; }
        public string Image { get; set; }
        public int Weight { get; set; }
        public bool IsSecret { get; set; }
        public string CollectionCategory { get; set; }
        public string RewardType { get; set; }
        public string Series { get; set; }
        public string AssetId { get; set; }
    }

    public sealed class AffinityDocument
    {
        public int SchemaVersion { get; set; }
        public List<AffinityRank> Ranks { get; set; }
    }

    public sealed class AffinityRank
    {
        public string Id { get; set; }
        public long Mined { get; set; }
        public string Name { get; set; }
        public string Line { get; set; }
        public string Badge { get; set; }
        public string EventTitle { get; set; }
        public List<RewardDefinition> Rewards { get; set; }
    }

    public sealed class AchievementsDocument
    {
        public int SchemaVersion { get; set; }
        public List<AchievementDefinition> Achievements { get; set; }
    }

    public sealed class AchievementDefinition
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string HiddenDescription { get; set; }
        public string Icon { get; set; }
        public string Category { get; set; }
        public string Tier { get; set; }
        public bool Hidden { get; set; }
        public AchievementCondition Condition { get; set; }
        public List<RewardDefinition> Rewards { get; set; }
    }

    public sealed class AchievementCondition
    {
        public string Type { get; set; }
        public long Value { get; set; }
        public string Rarity { get; set; }
    }

    public sealed class RewardDefinition
    {
        public string Type { get; set; }
        public int Amount { get; set; }
        public string ItemId { get; set; }
        public string TitleId { get; set; }
    }

    public sealed class LevelRewardsDocument
    {
        public int SchemaVersion { get; set; }
        public List<LevelRewardDefinition> Rewards { get; set; }
    }

    public sealed class LevelRewardDefinition
    {
        public int Level { get; set; }
        public string Name { get; set; }
        public List<RewardDefinition> Rewards { get; set; }
    }

    public sealed class TitlesDocument
    {
        public int SchemaVersion { get; set; }
        public List<TitleDefinition> Titles { get; set; }
    }

    public sealed class TitleDefinition
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Tier { get; set; }
    }

    public sealed class AssetsDocument
    {
        public int SchemaVersion { get; set; }
        public List<AssetDefinition> Assets { get; set; }
    }

    public sealed class AssetDefinition
    {
        public string Id { get; set; }
        public string Type { get; set; }
        public string Uri { get; set; }
        public string FallbackUri { get; set; }
    }

    public sealed class MessagesDocument
    {
        public int SchemaVersion { get; set; }
        public List<MilestoneMessage> Milestones { get; set; }
        public List<string> BadPull { get; set; }
        public List<string> Legendary { get; set; }
        public List<string> NewItem { get; set; }
        public List<string> Duplicate { get; set; }
        public List<string> Onboarding { get; set; }
    }

    public sealed class MilestoneMessage
    {
        public long Mined { get; set; }
        public string Text { get; set; }
    }
}
