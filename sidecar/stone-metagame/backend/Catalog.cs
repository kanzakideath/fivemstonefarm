using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace AiMiner.StoneMetaGame
{
    public sealed class MetaGameCatalog
    {
        private static readonly Regex SafeId = new Regex("^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$",
            RegexOptions.CultureInvariant);
        private static readonly Regex ProceduralImage = new Regex("^procedural://(?:stone|frame|avatar)/[a-z0-9-]{1,80}$",
            RegexOptions.CultureInvariant);
        private static readonly Regex AssetUri = new Regex("^procedural://(?:stone|frame|avatar|banner|icon)/[a-z0-9-]{1,80}$",
            RegexOptions.CultureInvariant);
        private static readonly string[] RequiredRarities =
        {
            "NORMAL", "RARE", "SUPER_RARE", "SSR", "UR", "LEGENDARY"
        };
        private static readonly HashSet<string> AchievementConditionTypes =
            new HashSet<string>(new[]
            {
                "minedTotal", "minedDaily", "minedAtLocalHour", "longestSessionMinutes",
                "activeMinutes", "gachaTotal", "rarityCountAtLeast", "maxDuplicateCount",
                "collectionPercent", "affinityMax", "ssrMissStreak", "rarityInLastBatchAtLeast",
                "miningLevel", "favoriteCount", "profileCustomIcon", "profileTitleEquipped",
                "fragmentTotal", "tenPullBatches"
            }, StringComparer.Ordinal);
        private static readonly HashSet<string> AchievementTiers = new HashSet<string>(new[]
        {
            "COMMON", "RARE", "EPIC", "LEGENDARY", "SECRET"
        }, StringComparer.Ordinal);
        private static readonly HashSet<string> AchievementCategories = new HashSet<string>(new[]
        {
            "MINING", "GACHA", "COLLECTION", "RELATIONSHIP", "PROFILE", "SECRET"
        }, StringComparer.Ordinal);
        private static readonly HashSet<string> RewardTypes = new HashSet<string>(new[]
        {
            "points", "tickets", "fragments", "title", "profileIcon", "profileFrame"
        }, StringComparer.Ordinal);

        public GachaCatalogDocument Gacha { get; private set; }
        public IReadOnlyList<ItemDefinition> Items { get; private set; }
        public IReadOnlyList<AffinityRank> AffinityRanks { get; private set; }
        public IReadOnlyList<AchievementDefinition> Achievements { get; private set; }
        public IReadOnlyList<GachaBannerDefinition> Banners { get; private set; }
        public IReadOnlyList<LevelRewardDefinition> LevelRewards { get; private set; }
        public IReadOnlyList<TitleDefinition> Titles { get; private set; }
        public IReadOnlyList<AssetDefinition> Assets { get; private set; }
        public MessagesDocument Messages { get; private set; }
        public IReadOnlyDictionary<string, ItemDefinition> ItemsById { get; private set; }
        public IReadOnlyDictionary<string, RarityDefinition> RaritiesById { get; private set; }
        public IReadOnlyDictionary<string, AchievementDefinition> AchievementsById { get; private set; }
        public IReadOnlyDictionary<string, GachaBannerDefinition> BannersById { get; private set; }
        public IReadOnlyDictionary<string, LevelRewardDefinition> LevelRewardsById { get; private set; }
        public IReadOnlyDictionary<string, TitleDefinition> TitlesById { get; private set; }
        public IReadOnlyDictionary<string, AssetDefinition> AssetsById { get; private set; }
        public GachaBannerDefinition DefaultBanner { get; private set; }

        public static MetaGameCatalog Load(string dataDirectory)
        {
            if (String.IsNullOrWhiteSpace(dataDirectory))
                throw new ArgumentException("Data directory is required.", nameof(dataDirectory));
            string root = Path.GetFullPath(dataDirectory);
            if (!Directory.Exists(root)) throw new DirectoryNotFoundException(root);

            var serializer = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };
            GachaCatalogDocument gacha = Read<GachaCatalogDocument>(serializer, root, "gacha.json");
            ItemsDocument items = Read<ItemsDocument>(serializer, root, "items.json");
            AffinityDocument affinity = Read<AffinityDocument>(serializer, root, "affinity.json");
            AchievementsDocument achievements = Read<AchievementsDocument>(serializer, root, "achievements.json");
            MessagesDocument messages = Read<MessagesDocument>(serializer, root, "messages.json");
            BannersDocument banners = Read<BannersDocument>(serializer, root, "banners.json");
            LevelRewardsDocument levelRewards = Read<LevelRewardsDocument>(serializer, root, "level-rewards.json");
            TitlesDocument titles = Read<TitlesDocument>(serializer, root, "titles.json");
            AssetsDocument assets = Read<AssetsDocument>(serializer, root, "assets.json");
            if (items.SchemaVersion != 2 || affinity.SchemaVersion != 2
                || achievements.SchemaVersion != 2 || banners.SchemaVersion != 1
                || levelRewards.SchemaVersion != 1 || titles.SchemaVersion != 1
                || assets.SchemaVersion != 1)
                throw new InvalidDataException("A metagame catalog does not match schema v2.");

            var result = new MetaGameCatalog
            {
                Gacha = gacha,
                Items = (items.Items ?? new List<ItemDefinition>()).AsReadOnly(),
                AffinityRanks = (affinity.Ranks ?? new List<AffinityRank>()).AsReadOnly(),
                Achievements = (achievements.Achievements ?? new List<AchievementDefinition>()).AsReadOnly(),
                Banners = (banners.Banners ?? new List<GachaBannerDefinition>()).AsReadOnly(),
                LevelRewards = (levelRewards.Rewards ?? new List<LevelRewardDefinition>()).AsReadOnly(),
                Titles = (titles.Titles ?? new List<TitleDefinition>()).AsReadOnly(),
                Assets = (assets.Assets ?? new List<AssetDefinition>()).AsReadOnly(),
                Messages = messages
            };
            result.Validate();
            result.ItemsById = result.Items.ToDictionary(x => x.Id, StringComparer.Ordinal);
            result.RaritiesById = result.Gacha.Rarities.ToDictionary(x => x.Id, StringComparer.Ordinal);
            result.AchievementsById = result.Achievements.ToDictionary(x => x.Id, StringComparer.Ordinal);
            result.BannersById = result.Banners.ToDictionary(x => x.Id, StringComparer.Ordinal);
            result.LevelRewardsById = result.LevelRewards.ToDictionary(x => "level:" + x.Level,
                StringComparer.Ordinal);
            result.TitlesById = result.Titles.ToDictionary(x => x.Id, StringComparer.Ordinal);
            result.AssetsById = result.Assets.ToDictionary(x => x.Id, StringComparer.Ordinal);
            result.DefaultBanner = result.Banners.Single(x => x.IsDefault);
            return result;
        }

        public int RarityOrder(string rarity)
        {
            RarityDefinition value;
            return rarity != null && RaritiesById.TryGetValue(rarity, out value) ? value.Order : -1;
        }

        public AffinityRank AffinityAt(long totalMined)
        {
            AffinityRank current = AffinityRanks[0];
            foreach (AffinityRank rank in AffinityRanks)
            {
                if (rank.Mined > totalMined) break;
                current = rank;
            }
            return current;
        }

        public AffinityRank NextAffinity(long totalMined)
        {
            return AffinityRanks.FirstOrDefault(x => x.Mined > totalMined);
        }

        private void Validate()
        {
            if (Gacha == null || Gacha.SchemaVersion != 2 || Gacha.Economy == null
                || Gacha.Progression == null || Gacha.Presentation == null
                || Gacha.Rarities == null || Gacha.Rarities.Count < 2)
                throw new InvalidDataException("gacha.json does not match schema v2.");
            if (Items == null || Items.Count < 100)
                throw new InvalidDataException("At least 100 collection items are required.");
            if (AffinityRanks == null || AffinityRanks.Count < 2 || AffinityRanks[0].Mined != 0)
                throw new InvalidDataException("Affinity ranks must start at zero.");
            if (Achievements == null || Achievements.Count == 0)
                throw new InvalidDataException("Achievement definitions are required.");
            if (Banners == null || Banners.Count == 0 || Banners.Count(x => x.IsDefault) != 1)
                throw new InvalidDataException("Exactly one default gacha banner is required.");
            if (LevelRewards == null || Titles == null || Titles.Count == 0
                || Assets == null || Assets.Count == 0)
                throw new InvalidDataException("Progression content documents are required.");
            if (Messages == null || Messages.SchemaVersion != 2)
                throw new InvalidDataException("messages.json does not match schema v2.");

            EnsureUniqueIds(Gacha.Rarities.Select(x => x.Id), "rarity");
            EnsureUniqueIds(Items.Select(x => x.Id), "item");
            EnsureUniqueIds(AffinityRanks.Select(x => x.Id), "affinity");
            EnsureUniqueIds(Achievements.Select(x => x.Id), "achievement");
            EnsureUniqueIds(Banners.Select(x => x.Id), "banner");
            EnsureUniqueIds(Titles.Select(x => x.Id), "title");
            EnsureUniqueIds(Assets.Select(x => x.Id), "asset");
            if (LevelRewards.Select(x => x.Level).Distinct().Count() != LevelRewards.Count)
                throw new InvalidDataException("Level reward levels must be unique.");

            int probability = Gacha.Rarities.Sum(x => x.BasisPoints);
            if (probability != 10000)
                throw new InvalidDataException("Gacha rarity rates must total exactly 10,000 basis points.");
            if (Gacha.Rarities.Any(x => x.BasisPoints <= 0 || x.Order < 0
                || String.IsNullOrWhiteSpace(x.Label) || !IsCssHexColor(x.Color)))
                throw new InvalidDataException("A rarity definition is invalid.");
            if (Gacha.Rarities.Select(x => x.Order).Distinct().Count() != Gacha.Rarities.Count)
                throw new InvalidDataException("Rarity order values must be unique.");

            var rarityIds = new HashSet<string>(Gacha.Rarities.Select(x => x.Id), StringComparer.Ordinal);
            var rarityById = Gacha.Rarities.ToDictionary(x => x.Id, StringComparer.Ordinal);
            string[] orderedRarities = Gacha.Rarities.OrderBy(x => x.Order).Select(x => x.Id).ToArray();
            if (!orderedRarities.SequenceEqual(RequiredRarities, StringComparer.Ordinal)
                || !Gacha.Rarities.OrderBy(x => x.Order).Select(x => x.Order)
                    .SequenceEqual(Enumerable.Range(0, RequiredRarities.Length)))
                throw new InvalidDataException("The required rarity ladder is invalid.");
            var itemIds = new HashSet<string>(Items.Select(x => x.Id), StringComparer.Ordinal);
            var itemsById = Items.ToDictionary(x => x.Id, StringComparer.Ordinal);
            var titleIds = new HashSet<string>(Titles.Select(x => x.Id), StringComparer.Ordinal);
            var assetIds = new HashSet<string>(Assets.Select(x => x.Id), StringComparer.Ordinal);
            foreach (ItemDefinition item in Items)
            {
                if (!SafeId.IsMatch(item.Id ?? "") || String.IsNullOrWhiteSpace(item.Name)
                    || String.IsNullOrWhiteSpace(item.Description) || !rarityIds.Contains(item.Rarity)
                    || !ProceduralImage.IsMatch(item.Image ?? "") || item.Weight <= 0
                    || String.IsNullOrWhiteSpace(item.CollectionCategory))
                    throw new InvalidDataException("Invalid collection item: " + (item.Id ?? "<null>"));
                if (!String.IsNullOrEmpty(item.RewardType) && item.RewardType != "profileIcon"
                    && item.RewardType != "profileFrame")
                    throw new InvalidDataException("Invalid reward type: " + item.Id);
                if (!String.IsNullOrEmpty(item.AssetId) && !assetIds.Contains(item.AssetId))
                    throw new InvalidDataException("Unknown item asset: " + item.Id);
            }
            foreach (string rarity in rarityIds)
                if (!Items.Any(x => x.Rarity == rarity))
                    throw new InvalidDataException("Rarity has no items: " + rarity);
            foreach (AssetDefinition asset in Assets)
            {
                if (String.IsNullOrWhiteSpace(asset.Type) || !AssetUri.IsMatch(asset.Uri ?? "")
                    || !AssetUri.IsMatch(asset.FallbackUri ?? ""))
                    throw new InvalidDataException("Invalid asset: " + asset.Id);
            }
            foreach (TitleDefinition title in Titles)
                if (String.IsNullOrWhiteSpace(title.Name) || !AchievementTiers.Contains(title.Tier))
                    throw new InvalidDataException("Invalid title: " + title.Id);
            if (!titleIds.Contains("rookie-miner"))
                throw new InvalidDataException("The default title is missing.");

            var categories = new HashSet<string>(Items.Select(x => x.CollectionCategory), StringComparer.Ordinal);
            foreach (GachaBannerDefinition banner in Banners)
            {
                if (String.IsNullOrWhiteSpace(banner.Name) || String.IsNullOrWhiteSpace(banner.Description)
                    || !assetIds.Contains(banner.BannerAssetId ?? "") || banner.Cost <= 0
                    || banner.TenPullCost <= 0 || banner.Pool == null || banner.Rates == null
                    || banner.Rates.Count != rarityIds.Count || banner.Rates.Keys.Any(x => !rarityIds.Contains(x))
                    || banner.Rates.Values.Any(x => x <= 0) || banner.Rates.Values.Sum() != 10000
                    || banner.PityTracks == null || banner.PityTracks.Count == 0
                    || !rarityIds.Contains(banner.TenPullMinimumRarity))
                    throw new InvalidDataException("Invalid gacha banner: " + (banner.Id ?? "<null>"));
                if (banner.Pool.ItemIds == null || banner.Pool.Categories == null
                    || banner.Pool.ItemIds.Any(x => !itemIds.Contains(x))
                    || banner.Pool.Categories.Any(x => !categories.Contains(x)))
                    throw new InvalidDataException("Invalid banner pool: " + banner.Id);
                if (banner.Pickups == null || banner.Pickups.Any(x => !itemIds.Contains(x.ItemId)
                    || x.ShareBasisPoints <= 0 || x.ShareBasisPoints > 10000))
                    throw new InvalidDataException("Invalid pickup: " + banner.Id);
                IEnumerable<ItemDefinition> eligible = Items;
                if (banner.Pool.ItemIds.Count > 0)
                {
                    var ids = new HashSet<string>(banner.Pool.ItemIds, StringComparer.Ordinal);
                    eligible = eligible.Where(x => ids.Contains(x.Id));
                }
                if (banner.Pool.Categories.Count > 0)
                {
                    var includedCategories = new HashSet<string>(banner.Pool.Categories,
                        StringComparer.Ordinal);
                    eligible = eligible.Where(x => includedCategories.Contains(x.CollectionCategory));
                }
                if (!banner.Pool.IncludeSecret) eligible = eligible.Where(x => !x.IsSecret);
                List<ItemDefinition> eligibleItems = eligible.ToList();
                foreach (string rarity in rarityIds)
                    if (banner.Rates[rarity] > 0 && !eligibleItems.Any(x => x.Rarity == rarity))
                        throw new InvalidDataException("Banner has no eligible item for " + rarity
                            + ": " + banner.Id);
                if (banner.Pickups.Any(x => !eligibleItems.Any(item => item.Id == x.ItemId)))
                    throw new InvalidDataException("Pickup is outside its banner pool: " + banner.Id);
                foreach (IGrouping<string, PickupDefinition> group in banner.Pickups
                    .GroupBy(x => itemsById[x.ItemId].Rarity, StringComparer.Ordinal))
                    if (group.Sum(x => x.ShareBasisPoints) > 10000)
                        throw new InvalidDataException("Pickup shares exceed 100%: " + banner.Id);
                EnsureUniqueIds(banner.PityTracks.Select(x => x.Id), "pity track");
                foreach (PityTrackDefinition pity in banner.PityTracks)
                    if (String.IsNullOrWhiteSpace(pity.Label) || pity.Threshold < 2
                        || !rarityIds.Contains(pity.MinimumRarity)
                        || !rarityIds.Contains(pity.ResetAtOrAbove)
                        || rarityById[pity.MinimumRarity].Order < rarityById[pity.ResetAtOrAbove].Order)
                        throw new InvalidDataException("Invalid pity track: " + banner.Id + "/" + pity.Id);
            }

            long previous = -1;
            foreach (AffinityRank rank in AffinityRanks)
            {
                if (!SafeId.IsMatch(rank.Id ?? "") || rank.Mined <= previous
                    || String.IsNullOrWhiteSpace(rank.Name) || String.IsNullOrWhiteSpace(rank.Line)
                    || String.IsNullOrWhiteSpace(rank.Badge) || String.IsNullOrWhiteSpace(rank.EventTitle))
                    throw new InvalidDataException("Affinity ranks must be strictly ordered.");
                ValidateRewards(rank.Rewards, itemIds, itemsById, titleIds, "affinity:" + rank.Id);
                previous = rank.Mined;
            }
            foreach (AchievementDefinition achievement in Achievements)
            {
                if (!SafeId.IsMatch(achievement.Id ?? "") || String.IsNullOrWhiteSpace(achievement.Name)
                    || String.IsNullOrWhiteSpace(achievement.Description)
                    || !AchievementTiers.Contains(achievement.Tier)
                    || !AchievementCategories.Contains(achievement.Category)
                    || !assetIds.Contains(achievement.Icon ?? "") || achievement.Condition == null
                    || !AchievementConditionTypes.Contains(achievement.Condition.Type)
                    || achievement.Condition.Value <= 0)
                    throw new InvalidDataException("Invalid achievement: " + (achievement.Id ?? "<null>"));
                if (!String.IsNullOrEmpty(achievement.Condition.Rarity)
                    && !rarityIds.Contains(achievement.Condition.Rarity))
                    throw new InvalidDataException("Achievement rarity condition is invalid: " + achievement.Id);
                bool rarityCondition = achievement.Condition.Type == "rarityCountAtLeast"
                    || achievement.Condition.Type == "rarityInLastBatchAtLeast";
                if (rarityCondition != !String.IsNullOrEmpty(achievement.Condition.Rarity))
                    throw new InvalidDataException("Achievement rarity field is invalid: " + achievement.Id);
                if (achievement.Hidden && String.IsNullOrWhiteSpace(achievement.HiddenDescription))
                    throw new InvalidDataException("Hidden achievement hint is required: " + achievement.Id);
                ValidateRewards(achievement.Rewards, itemIds, itemsById, titleIds,
                    "achievement:" + achievement.Id);
            }

            int previousLevel = 0;
            foreach (LevelRewardDefinition reward in LevelRewards.OrderBy(x => x.Level))
            {
                if (reward.Level <= previousLevel || String.IsNullOrWhiteSpace(reward.Name))
                    throw new InvalidDataException("Level rewards must be strictly ordered.");
                ValidateRewards(reward.Rewards, itemIds, itemsById, titleIds, "level:" + reward.Level);
                previousLevel = reward.Level;
            }

            EconomyDefinition economy = Gacha.Economy;
            if (economy.MiningPointsPerSuccess <= 0 || economy.PointsPerDraw <= 0
                || economy.TicketEveryMines <= 0 || economy.TicketsPerMilestone <= 0
                || economy.HistoryLimit < 100 || economy.HistoryLimit > 10000
                || economy.ProcessedEventLimit < 128 || economy.ProcessedEventLimit > 10000
                || economy.DuplicateFragments == null || economy.DuplicateFragments.Count != rarityIds.Count
                || economy.DuplicateFragments.Keys.Any(x => !rarityIds.Contains(x))
                || economy.DuplicateFragments.Values.Any(x => x <= 0))
                throw new InvalidDataException("Economy settings are outside safe limits.");
            ProgressionDefinition progression = Gacha.Progression;
            if (progression.XpPerMining <= 0 || progression.LevelBaseXp <= 0
                || progression.LevelExponent < 1.05 || progression.LevelExponent > 3.0
                || progression.MaximumLevel < 100 || progression.MaximumLevel > 10000)
                throw new InvalidDataException("Progression settings are outside safe limits.");
            if (Gacha.Presentation.SingleReelCards < 20
                || Gacha.Presentation.SingleTargetIndex < 10
                || Gacha.Presentation.SingleTargetIndex >= Gacha.Presentation.SingleReelCards
                || Gacha.Presentation.HistoryPreviewLimit < 1
                || Gacha.Presentation.HistoryPreviewLimit > economy.HistoryLimit
                || Gacha.Presentation.FakeoutBasisPoints == null
                || Gacha.Presentation.FakeoutBasisPoints.Any(x => !rarityIds.Contains(x.Key)
                    || x.Value < 0 || x.Value > 10000)
                || Gacha.Presentation.HighRarityVariants == null
                || new[] { "SSR", "UR", "LEGENDARY" }.Any(x =>
                    !Gacha.Presentation.HighRarityVariants.ContainsKey(x)
                    || Gacha.Presentation.HighRarityVariants[x].Count < 3)
                || Gacha.Presentation.PreCueBasisPoints == null
                || Gacha.Presentation.PreCueBasisPoints.Any(x => !rarityIds.Contains(x.Key)
                    || x.Value < 0 || x.Value > 10000)
                || Gacha.Presentation.SpeedMultipliers == null
                || new[] { "normal", "fast", "skip" }.Any(x =>
                    !Gacha.Presentation.SpeedMultipliers.ContainsKey(x)
                    || Gacha.Presentation.SpeedMultipliers[x] <= 0
                    || Gacha.Presentation.SpeedMultipliers[x] > 1))
                throw new InvalidDataException("Presentation settings are invalid.");
            if (Messages.Milestones == null || Messages.Milestones.Count == 0
                || Messages.BadPull == null || Messages.BadPull.Count == 0
                || Messages.Legendary == null || Messages.Legendary.Count == 0
                || Messages.NewItem == null || Messages.NewItem.Count == 0
                || Messages.Duplicate == null || Messages.Duplicate.Count == 0
                || Messages.Onboarding == null || Messages.Onboarding.Count != 3
                || Messages.BadPull.Concat(Messages.Legendary).Concat(Messages.NewItem)
                    .Concat(Messages.Duplicate).Concat(Messages.Onboarding)
                    .Any(String.IsNullOrWhiteSpace))
                throw new InvalidDataException("Message definitions are invalid.");
            long previousMilestone = -1;
            foreach (MilestoneMessage milestone in Messages.Milestones)
            {
                if (milestone.Mined <= previousMilestone || String.IsNullOrWhiteSpace(milestone.Text))
                    throw new InvalidDataException("Milestone messages must be strictly ordered.");
                previousMilestone = milestone.Mined;
            }
        }

        private static void ValidateRewards(IEnumerable<RewardDefinition> rewards,
            HashSet<string> itemIds, Dictionary<string, ItemDefinition> itemsById,
            HashSet<string> titleIds, string owner)
        {
            foreach (RewardDefinition reward in rewards ?? Enumerable.Empty<RewardDefinition>())
            {
                if (reward == null || !RewardTypes.Contains(reward.Type ?? "") || reward.Amount <= 0)
                    throw new InvalidDataException("Invalid reward: " + owner);
                if (reward.Type == "title")
                {
                    if (!titleIds.Contains(reward.TitleId ?? ""))
                        throw new InvalidDataException("Unknown title reward: " + owner);
                }
                else if (reward.Type == "profileIcon" || reward.Type == "profileFrame")
                {
                    ItemDefinition item;
                    if (!itemIds.Contains(reward.ItemId ?? "")
                        || !itemsById.TryGetValue(reward.ItemId ?? "", out item)
                        || item.RewardType != reward.Type)
                        throw new InvalidDataException("Invalid profile item reward: " + owner);
                }
            }
        }

        private static void EnsureUniqueIds(IEnumerable<string> ids, string kind)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (string id in ids)
                if (!SafeId.IsMatch(id ?? "") || !seen.Add(id))
                    throw new InvalidDataException("Invalid or duplicate " + kind + " id: " + (id ?? "<null>"));
        }

        private static bool IsCssHexColor(string value)
        {
            return value != null && Regex.IsMatch(value, "^#[0-9A-Fa-f]{6}$",
                RegexOptions.CultureInvariant);
        }

        private static T Read<T>(JavaScriptSerializer serializer, string root, string name)
        {
            string path = Path.Combine(root, name);
            byte[] bytes = File.ReadAllBytes(path);
            if (bytes.Length == 0 || bytes.Length > 8 * 1024 * 1024)
                throw new InvalidDataException("Catalog file size is invalid: " + name);
            string json = new UTF8Encoding(false, true).GetString(bytes);
            T value = serializer.Deserialize<T>(json);
            if (value == null) throw new InvalidDataException("Catalog is empty: " + name);
            return value;
        }
    }
}
