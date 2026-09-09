using AiMiner.StoneMetaGame;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

internal static class Program
{
    private static int _assertions;

    private static int Main()
    {
        string temporary = Path.Combine(Path.GetTempPath(), "ai-miner-meta-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temporary);
        try
        {
            string data = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data");
            MetaGameCatalog catalog = MetaGameCatalog.Load(data);
            Assert(catalog.Items.Count >= 100, "catalog has 100+ items");
            Assert(catalog.Gacha.Rarities.Sum(x => x.BasisPoints) == 10000, "rates total 100%");
            Assert(catalog.AffinityAt(10000).Name == "結婚", "affinity table loads");

            var clock = new FakeClock(new DateTimeOffset(2026, 9, 9, 3, 15, 0, TimeSpan.FromHours(9)));
            string statePath = Path.Combine(temporary, "state.json");
            var service = new MetaGameService(catalog, new MetaGameStateStore(statePath),
                new SequenceRandom(0), clock);

            MutationResult first = service.RecordVerifiedMiningSuccess("mine:test-session:0001", clock.UtcNow);
            Assert(first.Ok && !first.Duplicate, "verified mining succeeds");
            Assert(first.Snapshot.Mining.TotalStoneMined == 1, "mining count increments once");
            Assert(first.Snapshot.Mining.AvailableMiningPoints == 1, "mining points increment");
            Assert(first.Events.Any(x => x.Id == "first-stone"), "first mining achievement unlocks");
            Assert(first.Events.Any(x => x.Id == "night-stone"), "local hour achievement unlocks");

            MutationResult duplicate = service.RecordVerifiedMiningSuccess("mine:test-session:0001", clock.UtcNow);
            Assert(duplicate.Ok && duplicate.Duplicate, "duplicate mining event is idempotent");
            Assert(duplicate.Snapshot.Mining.TotalStoneMined == 1, "duplicate does not increment");

            // The domain API intentionally counts a trusted, verified work-completion event
            // without knowing which Farm mode produced it. The controller owns that distinction
            // and encodes it in the stable event ID. This keeps mining/washing/gold integration
            // outside the validated progression, gacha, pity, and persistence implementation.
            string mixedWorkState = Path.Combine(temporary, "mixed-work-state.json");
            var mixedWorkService = new MetaGameService(catalog,
                new MetaGameStateStore(mixedWorkState), new SequenceRandom(0), clock);
            string[] mixedWorkIds =
            {
                "work:mining:run0001:attempt0001:revision0003",
                "work:washing:run0001:attempt0002:revision0006",
                "work:gold:run0001:attempt0003:revision0009"
            };
            for (int index = 0; index < mixedWorkIds.Length; index++)
            {
                MutationResult recorded = mixedWorkService.RecordVerifiedMiningSuccess(
                    mixedWorkIds[index], clock.UtcNow.AddSeconds(index));
                Assert(recorded.Ok && !recorded.Duplicate
                    && recorded.Snapshot.Mining.TotalStoneMined == index + 1,
                    "each verified Farm mode advances STONE exactly once");
            }
            foreach (string eventId in mixedWorkIds.Reverse())
            {
                MutationResult replay = mixedWorkService.RecordVerifiedMiningSuccess(
                    eventId, clock.UtcNow.AddMinutes(1));
                Assert(replay.Ok && replay.Duplicate
                    && replay.Snapshot.Mining.TotalStoneMined == mixedWorkIds.Length,
                    "mixed Farm event replay is idempotent");
            }
            var mixedWorkReloaded = new MetaGameService(catalog,
                new MetaGameStateStore(mixedWorkState), new SequenceRandom(0), clock);
            Assert(mixedWorkReloaded.GetSnapshot().Mining.TotalStoneMined == 3
                && mixedWorkReloaded.GetSnapshot().Mining.MiningXp == 3
                && mixedWorkReloaded.GetSnapshot().Mining.AvailableMiningPoints == 3,
                "mixed Farm progression remains exact after restart");

            // Historical import is modeled as a sequence of stable per-completion IDs, never as
            // an untrusted total. A restart can occur after any saved row; replaying the complete
            // batch must fill only missing rows and must not grant XP/points twice.
            string backfillState = Path.Combine(temporary, "backfill-state.json");
            string[] historicalIds =
            {
                "backfill:v1:mining:20260908T010101001:a1:r3",
                "backfill:v1:washing:20260908T010111002:a2:r6",
                "backfill:v1:gold:20260908T010121003:a3:r9",
                "backfill:v1:gold:20260908T010131004:a4:r12",
                "backfill:v1:washing:20260908T010141005:a5:r15"
            };
            var interruptedBackfill = new MetaGameService(catalog,
                new MetaGameStateStore(backfillState), new SequenceRandom(0), clock);
            for (int index = 0; index < 2; index++)
                Assert(interruptedBackfill.RecordVerifiedMiningSuccess(historicalIds[index],
                    clock.UtcNow.AddDays(-2).AddSeconds(index)).Ok,
                    "historical prefix is committed before simulated restart");
            var resumedBackfill = new MetaGameService(catalog,
                new MetaGameStateStore(backfillState), new SequenceRandom(0), clock);
            for (int index = 0; index < historicalIds.Length; index++)
            {
                MutationResult imported = resumedBackfill.RecordVerifiedMiningSuccess(
                    historicalIds[index], clock.UtcNow.AddDays(-2).AddSeconds(index));
                Assert(imported.Ok && imported.Duplicate == (index < 2),
                    "historical replay imports only rows missing after restart");
            }
            MetaGameSnapshot importedSnapshot = resumedBackfill.GetSnapshot();
            Assert(importedSnapshot.Mining.TotalStoneMined == historicalIds.Length
                && importedSnapshot.Mining.MiningXp == historicalIds.Length
                && importedSnapshot.Mining.AvailableMiningPoints == historicalIds.Length,
                "historical batch awards exactly one progression unit per verified row");
            var replayedBackfill = new MetaGameService(catalog,
                new MetaGameStateStore(backfillState), new SequenceRandom(0), clock);
            foreach (string eventId in historicalIds)
                Assert(replayedBackfill.RecordVerifiedMiningSuccess(eventId,
                    clock.UtcNow).Duplicate, "completed historical batch remains idempotent");
            Assert(replayedBackfill.GetSnapshot().Mining.TotalStoneMined
                == historicalIds.Length, "re-running backfill leaves the exact total unchanged");

            Assert(service.DebugGrantMiningPoints(9999).Ok, "debug point grant works in service");
            Assert(service.DebugPrimePity("ssr").Ok, "SSR pity can be primed for tests");
            MutationResult pityDraw = service.Draw("draw:test-session:0001", 1, "points");
            Assert(pityDraw.Ok && pityDraw.Draw.Results.Count == 1, "single draw succeeds");
            Assert(catalog.RarityOrder(pityDraw.Draw.Results[0].Rarity) >= catalog.RarityOrder("SSR"),
                "SSR pity enforces minimum rarity");
            long drawsAfterFirst = pityDraw.Snapshot.Gacha.TotalDraws;
            long pointsAfterFirst = pityDraw.Snapshot.Mining.AvailableMiningPoints;
            MutationResult repeatedDraw = service.Draw("draw:test-session:0001", 1, "points");
            Assert(repeatedDraw.Ok && repeatedDraw.Duplicate, "draw request is idempotent");
            Assert(repeatedDraw.Snapshot.Gacha.TotalDraws == drawsAfterFirst
                && repeatedDraw.Snapshot.Mining.AvailableMiningPoints == pointsAfterFirst,
                "duplicate draw does not spend twice");

            Assert(service.DebugGrantMiningPoints(2000).Ok, "10-pull funds granted");
            MutationResult ten = service.Draw("draw:test-session:0010", 10, "points");
            Assert(ten.Ok && ten.Draw.Results.Count == 10, "ten-pull returns ten fixed results");
            Assert(ten.Draw.Results.Any(x => catalog.RarityOrder(x.Rarity) >= catalog.RarityOrder("RARE")),
                "ten-pull minimum rarity is enforced");
            Assert(ten.Snapshot.CollectionOwned > 0 && ten.Snapshot.Gacha.History.Count == 11,
                "collection and history persist results");

            var reloaded = new MetaGameService(catalog, new MetaGameStateStore(statePath),
                new SequenceRandom(0), clock);
            Assert(reloaded.GetSnapshot().Mining.TotalStoneMined == 1, "state reload preserves mining total");
            Assert(reloaded.GetSnapshot().Gacha.TotalDraws == 11, "state reload preserves gacha history");

            Assert(reloaded.RecordVerifiedMiningSuccess("mine:test-session:0002", clock.UtcNow).Ok,
                "second save creates backup");
            File.WriteAllText(statePath, "{corrupted");
            var recovered = new MetaGameService(catalog, new MetaGameStateStore(statePath),
                new SequenceRandom(0), clock);
            Assert(recovered.GetSnapshot().Mining.TotalStoneMined >= 1,
                "corrupted primary recovers from checksum-verified backup");

            string hostState = Path.Combine(temporary, "host-state.json");
            var productionHost = new StoneMetaGameHost(data, hostState, false);
            string denied = productionHost.ExecuteUiJson(
                "{\"action\":\"debug.grantPoints\",\"payload\":{\"amount\":1000}}");
            Assert(denied.Contains("DEBUG_ACTION_DISABLED"), "production host blocks debug actions");
            string forged = productionHost.ExecuteUiJson(
                "{\"action\":\"mining.increment\",\"payload\":{\"amount\":999999}}");
            Assert(forged.Contains("META_ACTION_NOT_ALLOWED"), "WebView cannot forge mining increments");
            string renamed = productionHost.ExecuteUiJson(
                "{\"action\":\"profile.rename\",\"payload\":{\"name\":\"Stone Miner\"}}");
            Assert(renamed.Contains("Stone Miner"), "profile rename is persisted through allowlisted UI command");
            MutationResult rejectedProfile = productionHost.Service.UpdateProfile("Partial Update",
                "builtin:stone", "builtin:default", "", "not-owned-title");
            Assert(!rejectedProfile.Ok && productionHost.Service.GetSnapshot().Profile.Name == "Stone Miner",
                "atomic profile update validates all fields before changing the name");
            string atomicProfile = productionHost.ExecuteUiJson(
                "{\"action\":\"profile.update\",\"payload\":{\"name\":\"Atomic Miner\",\"icon\":\"builtin:stone\",\"frame\":\"builtin:default\",\"customIconDataUri\":\"\",\"titleId\":\"rookie-miner\"}}");
            Assert(atomicProfile.Contains("Atomic Miner"),
                "profile editor commits name, title, icon, and frame through one allowlisted command");
            string unsafeImage = productionHost.ExecuteUiJson(
                "{\"action\":\"profile.appearance\",\"payload\":{\"icon\":\"custom:image\",\"frame\":\"builtin:default\",\"customIconDataUri\":\"data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=\"}}");
            Assert(unsafeImage.Contains("PROFILE_APPEARANCE_NOT_OWNED"),
                "custom profile image rejects active SVG content");

            string debugState = Path.Combine(temporary, "debug-state.json");
            var developmentHost = new StoneMetaGameHost(data, debugState, true);
            string affinityDebug = developmentHost.ExecuteUiJson(
                "{\"action\":\"debug.advanceAffinity\",\"payload\":{}}");
            Assert(affinityDebug.Contains("affinity.levelUp"), "development host can preview affinity cinematic");
            string achievementDebug = developmentHost.ExecuteUiJson(
                "{\"action\":\"debug.unlockAchievement\",\"payload\":{\"id\":\"first-stone\"}}");
            Assert(achievementDebug.Contains("achievement.unlocked"),
                "development host can preview achievement cinematic");

            string futureState = Path.Combine(temporary, "future-state.json");
            new MetaGameService(catalog, new MetaGameStateStore(futureState),
                new SequenceRandom(0), clock);
            string futureJson = File.ReadAllText(futureState);
            const string currentSchema = "\"SchemaVersion\":2";
            int schemaAt = futureJson.IndexOf(currentSchema, StringComparison.Ordinal);
            Assert(schemaAt >= 0, "future-schema fixture contains envelope version");
            futureJson = futureJson.Substring(0, schemaAt) + "\"SchemaVersion\":999"
                + futureJson.Substring(schemaAt + currentSchema.Length);
            File.WriteAllText(futureState, futureJson);
            bool futureRejected = false;
            try
            {
                new MetaGameService(catalog, new MetaGameStateStore(futureState),
                    new SequenceRandom(0), clock);
            }
            catch (UnsupportedMetaGameSchemaException)
            {
                futureRejected = true;
            }
            Assert(futureRejected, "future schema is rejected instead of reset");
            Assert(File.ReadAllText(futureState) == futureJson, "future schema file is never overwritten");

            string interruptedState = Path.Combine(temporary, "interrupted-state.json");
            DateTimeOffset interruptedStart = new DateTimeOffset(2026, 9, 9, 8, 0, 0, TimeSpan.Zero);
            var interruptedService = new MetaGameService(catalog,
                new MetaGameStateStore(interruptedState), new SequenceRandom(0),
                new FakeClock(interruptedStart));
            Assert(interruptedService.BeginMiningSession("session:interrupted:01", interruptedStart).Ok,
                "interrupted session fixture starts");
            Assert(interruptedService.RecordVerifiedMiningSuccess("mine:interrupted:01",
                interruptedStart.AddMinutes(10)).Ok, "interrupted session records last verified activity");
            var afterCrash = new MetaGameService(catalog, new MetaGameStateStore(interruptedState),
                new SequenceRandom(0), new FakeClock(interruptedStart.AddDays(3)));
            MetaGameSnapshot crashSnapshot = afterCrash.GetSnapshot();
            Assert(crashSnapshot.Mining.TotalActiveSeconds == 600,
                "crash recovery excludes offline time after last verified activity");
            Assert(String.IsNullOrEmpty(crashSnapshot.Mining.ActiveSessionId),
                "crash recovery closes stale active session");

            string boundaryState = Path.Combine(temporary, "boundary-state.json");
            var boundaryService = new MetaGameService(catalog,
                new MetaGameStateStore(boundaryState), new SequenceRandom(0), clock);
            MutationResult beforeThousand = boundaryService.DebugSetStoneMined(999);
            Assert(beforeThousand.Ok && !beforeThousand.Snapshot.Achievements.ContainsKey("mining-contractor"),
                "999 mined remains below the 1,000 achievement boundary");
            HomeGoalView ticketGoal = beforeThousand.Snapshot.HomeGoals.Single(x => x.Kind == "ticket");
            HomeGoalView affinityGoal = beforeThousand.Snapshot.HomeGoals.Single(x => x.Kind == "affinity");
            Assert(ticketGoal.Current == 999 && ticketGoal.Target == 1000
                && Math.Abs(ticketGoal.Progress - .999) < .000001,
                "recurring ticket goal reports progress inside the current 1,000-mine cycle");
            Assert(affinityGoal.Current == 499 && affinityGoal.Target == 500
                && Math.Abs(affinityGoal.Progress - .998) < .000001,
                "affinity goal reports progress inside the current relationship rank");
            MutationResult atThousand = boundaryService.RecordVerifiedMiningSuccess(
                "mine:boundary:1000", clock.UtcNow);
            Assert(atThousand.Ok && atThousand.Snapshot.Mining.TotalStoneMined == 1000,
                "the exact 1,000th verified mine is committed");
            Assert(atThousand.Events.Count(x => x.Type == "achievement.unlocked"
                && x.Id == "mining-contractor") == 1,
                "the 1,000 mining achievement unlocks exactly at its boundary");
            Assert(atThousand.Events.Any(x => x.Type == "affinity.levelUp" && x.Id == "destiny"),
                "affinity crossing is emitted at the same 1,000 transaction");
            MutationResult afterThousand = boundaryService.RecordVerifiedMiningSuccess(
                "mine:boundary:1001", clock.UtcNow);
            Assert(afterThousand.Ok && afterThousand.Events.All(x => x.Id != "mining-contractor"),
                "1,001 mined does not unlock the same achievement twice");

            int ticketsBeforeClaim = afterThousand.Snapshot.Mining.GachaTickets;
            MutationResult rewardClaim = boundaryService.ClaimReward("achievement:mining-contractor");
            Assert(rewardClaim.Ok && !rewardClaim.Duplicate
                && rewardClaim.Snapshot.Mining.GachaTickets == ticketsBeforeClaim + 3,
                "achievement reward is applied once");
            Assert(rewardClaim.Snapshot.OwnedTitles.ContainsKey("mining-master"),
                "title reward becomes an owned profile option");
            MutationResult rewardReplay = boundaryService.ClaimReward("achievement:mining-contractor");
            Assert(rewardReplay.Ok && rewardReplay.Duplicate
                && rewardReplay.Snapshot.Mining.GachaTickets == ticketsBeforeClaim + 3,
                "reward replay is idempotent");
            var boundaryReloaded = new MetaGameService(catalog,
                new MetaGameStateStore(boundaryState), new SequenceRandom(0), clock);
            RewardGrantView persistedGrant = boundaryReloaded.GetSnapshot().RewardGrantViews
                .Single(x => x.GrantId == "achievement:mining-contractor");
            Assert(persistedGrant.Claimed && boundaryReloaded.GetSnapshot().OwnedTitles.ContainsKey("mining-master"),
                "claimed reward and entitlement survive restart");

            string levelState = Path.Combine(temporary, "level-boundary-state.json");
            var levelService = new MetaGameService(catalog,
                new MetaGameStateStore(levelState), new SequenceRandom(0), clock);
            long levelTenXp = XpRequiredForLevel(catalog, 10);
            MutationResult levelNineEdge = levelService.DebugAddXp(levelTenXp - 1);
            Assert(levelNineEdge.Snapshot.Mining.MiningLevel == 9,
                "one XP below the level 10 threshold remains level 9");
            MutationResult levelTenEdge = levelService.DebugAddXp(1);
            Assert(levelTenEdge.Snapshot.Mining.MiningLevel == 10
                && levelTenEdge.Events.Count(x => x.Type == "mining.levelUp") == 1,
                "exact level threshold emits one level-up event");
            MutationResult levelTenPlusOne = levelService.DebugAddXp(1);
            Assert(levelTenPlusOne.Snapshot.Mining.MiningLevel == 10
                && levelTenPlusOne.Events.All(x => x.Type != "mining.levelUp"),
                "one XP after the boundary does not repeat level-up");
            Assert(levelTenEdge.Snapshot.RewardGrantViews.Count(x => x.GrantId == "level:10") == 1,
                "level reward grant is created once at the boundary");
            HomeGoalView levelGoal = levelTenPlusOne.Snapshot.HomeGoals.Single(x => x.Kind == "level");
            long levelTenCost = XpRequiredForLevel(catalog, 11) - levelTenXp;
            Assert(levelGoal.Current == 1 && levelGoal.Target == levelTenCost
                && Math.Abs(levelGoal.Progress - (1d / levelTenCost)) < .000001,
                "next-level goal resets its progress bar at the new level boundary");

            string pityState = Path.Combine(temporary, "pity-priority-state.json");
            var pityService = new MetaGameService(catalog,
                new MetaGameStateStore(pityState), new SequenceRandom(0), clock);
            Assert(pityService.DebugGrantMiningPoints(10000).Ok, "pity test funds granted");
            Assert(pityService.DebugSetPity("eternal-stone", "ssr-pity", 49).Ok
                && pityService.DebugSetPity("eternal-stone", "ur-pity", 299).Ok,
                "simultaneous SSR and UR pity counters can be primed");
            MutationResult simultaneousPity = pityService.Draw(
                "draw:pity:priority:ur", "eternal-stone", 1, "points");
            Assert(simultaneousPity.Draw.Results[0].PityTrackId == "ur-pity"
                && catalog.RarityOrder(simultaneousPity.Draw.Results[0].Rarity) >= catalog.RarityOrder("UR"),
                "the highest simultaneous pity floor wins");
            Assert(pityService.DebugSetPity("eternal-stone", "ssr-pity", 49).Ok
                && pityService.DebugSetPity("eternal-stone", "ur-pity", 299).Ok
                && pityService.DebugSetPity("eternal-stone", "legendary-spark", 999).Ok,
                "all three pity counters can be primed together");
            MutationResult legendaryPity = pityService.Draw(
                "draw:pity:priority:legendary", "eternal-stone", 1, "points");
            Assert(legendaryPity.Draw.Results[0].PityTrackId == "legendary-spark"
                && legendaryPity.Draw.Results[0].Rarity == "LEGENDARY",
                "legendary spark overrides lower simultaneous pity tracks");

            string pickupState = Path.Combine(temporary, "pickup-state.json");
            var pickupService = new MetaGameService(catalog,
                new MetaGameStateStore(pickupState), new SequenceRandom(0), clock);
            Assert(pickupService.DebugGrantMiningPoints(1000).Ok, "pickup test funds granted");
            MutationResult pickup = pickupService.DebugForceDraw(
                "draw:pickup:gold-frame", "golden-mining-pickup", 1, "SSR", false, "", "");
            Assert(pickup.Ok && pickup.Draw.Results[0].ItemId == "golden-frame",
                "banner pickup selection is separate from the rarity roll");

            Console.WriteLine("Stone metagame backend tests passed: " + _assertions + " assertions");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error);
            return 1;
        }
        finally
        {
            try { Directory.Delete(temporary, true); }
            catch { }
        }
    }

    private static void Assert(bool condition, string message)
    {
        _assertions++;
        if (!condition) throw new InvalidOperationException("Assertion failed: " + message);
    }

    private static long XpRequiredForLevel(MetaGameCatalog catalog, int targetLevel)
    {
        long total = 0;
        for (int level = 1; level < targetLevel; level++)
            total += (long)Math.Ceiling(catalog.Gacha.Progression.LevelBaseXp
                * Math.Pow(level, catalog.Gacha.Progression.LevelExponent));
        return total;
    }

    private sealed class SequenceRandom : IRandomSource
    {
        private readonly Queue<int> _values;
        internal SequenceRandom(params int[] values) { _values = new Queue<int>(values); }
        public int NextInt(int exclusiveMaximum)
        {
            int value = _values.Count > 0 ? _values.Dequeue() : 0;
            return Math.Abs(value % exclusiveMaximum);
        }
    }

    private sealed class FakeClock : IMetaGameClock
    {
        private readonly DateTimeOffset _local;
        internal FakeClock(DateTimeOffset local) { _local = local; }
        public DateTimeOffset UtcNow { get { return _local.ToUniversalTime(); } }
        public TimeZoneInfo LocalTimeZone
        {
            get { return TimeZoneInfo.CreateCustomTimeZone("Test JST", TimeSpan.FromHours(9), "Test JST", "Test JST"); }
        }
    }
}
