import { ACHIEVEMENTS } from '../data';
import type { Clock, GameState, OwnerIdentity, StoneAccount } from './types';
import type { RandomSource } from './rng';
import { makeId, SeededRng, systemClock } from './rng';
import { createSeedStone } from './stone';
import { createTrustedTimeCheckpoint } from './timeProvider';
import { createInitialEndlessCampaign } from './endlessCampaign';
import { createInitialMasteryState } from './mastery';

export const CURRENT_SCHEMA_VERSION = 5;

export interface NewGameOptions {
  username?: string;
  accountId?: string;
  seed?: string;
  withStarter?: boolean;
  clock?: Clock;
  rng?: RandomSource;
}

export const createInitialGameState = (options: NewGameOptions = {}): GameState => {
  const clock = options.clock ?? systemClock;
  const now = clock.now();
  const rng = options.rng ?? new SeededRng(options.seed ?? `${now.toISOString()}:new-game`);
  const accountId = options.accountId ?? makeId('account', rng, now.getTime());
  const username = (options.username?.trim() || 'Stonekeeper').slice(0, 24);
  const account: StoneAccount = {
    accountId,
    username,
    avatarId: 'avatar_founder',
    profileFrameId: 'frame_basalt',
    equippedTitleId: 'title_new_resonance',
    ownedTitleIds: ['title_new_resonance'],
    ownedFrameIds: ['frame_basalt'],
    arenaRating: 1_000,
    arenaTier: 'BRONZE',
    highestArenaTier: 'BRONZE',
    raidStats: { lifetimeDamage: 0, bossesDefeated: 0, bestContributionRank: null },
    createdAt: now.toISOString(),
    lastOnlineAt: now.toISOString(),
  };
  const owner: OwnerIdentity = { accountId, username };
  const starters = options.withStarter === false ? [] : [
    createSeedStone('species_pebblit', owner, `${options.seed ?? accountId}:starter:1`, clock),
    createSeedStone('species_quartzling', owner, `${options.seed ?? accountId}:starter:2`, clock),
    createSeedStone('species_emberite', owner, `${options.seed ?? accountId}:starter:3`, clock),
  ];
  const stones = Object.fromEntries(starters.map((stone) => [stone.instanceId, stone]));
  const initialAchievements = Object.fromEntries(ACHIEVEMENTS.map((entry) => [
    entry.id,
    { value: 0, unlockedAt: null, claimedAt: null },
  ]));

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    account,
    accountProgress: { level: 1, xp: 0, researchPoints: 0, skillPoints: 0, selectedSkillNodes: [] },
    mining: {
      level: 1, xp: 0, totalMined: 0, dailyMined: 0, weeklyMined: 0, monthlyMined: 0,
      unlockedAreas: ['area_greenbreak'], unlockedVeins: ['vein_common'], processedFarmEventIds: {}, lastMinedAt: null,
    },
    facilities: { fusionLab: 1, researchLab: 1, expeditionGuild: 1 },
    expeditions: { runs: {}, order: [], discoveryStorage: [], overflowDiscarded: 0, totalCycles: 0, totalClaims: 0 },
    training: { assignment: null },
    affinityGarden: { assignment: null },
    research: { slot: null, completedProjectIds: [], claimLedger: {} },
    idle: {
      timeCheckpoint: createTrustedTimeCheckpoint(now.getTime()),
      scheduler: { version: 1, jobs: [] },
      lastProcessedAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      lastWelcomeBack: null,
    },
    endlessMine: createInitialEndlessCampaign(now),
    mastery: createInitialMasteryState(),
    stones,
    unappraisedFinds: [],
    inventory: {
      currencies: { credits: 3_000, gachaTickets: 12, researchCores: 0, upgradeDust: 250 },
      items: { item_magma_heart: 0, item_eclipse_shard: 0, item_primordial_core: 0 },
      equipment: {}, capacity: 500,
    },
    collection: {
      discoveredSpeciesIds: starters.map((stone) => stone.speciesId),
      mutationSpecies: Object.fromEntries(starters.map((stone) => [stone.speciesId, [stone.mutation]])),
      variantSpecies: Object.fromEntries(starters.map((stone) => [stone.speciesId, [stone.colorVariant]])),
      origins: starters.length ? { EVENT: starters.length } : {},
    },
    fusionHistory: [],
    gacha: { pityByBanner: {}, history: [], rarityCounts: {} },
    achievements: initialAchievements,
    parties: [{ id: 'party_primary', name: 'Primary Formation', slots: starters.map((stone, index) => ({ stoneId: stone.instanceId, position: index === 0 ? 'FRONT' as const : 'BACK' as const })), defense: false }],
    activePartyId: 'party_primary',
    activeBattle: null,
    battleHistory: [],
    dungeonClears: {},
    profile: { showcaseStoneIds: starters.map((stone) => stone.instanceId), favoriteStoneIds: [], totalAffinity: 0, public: true },
    statistics: { fusionCount: 0, mutationCount: 0, rareDiscoveryCount: 0, battleWins: 0, battleLosses: 0, highestInfiniteFloor: 0, totalRaidDamage: 0 },
    online: { connected: true, sessionId: makeId('session', rng, now.getTime()), sequence: 0, queue: [], processedReceipts: [], lastSyncedAt: null },
    settings: { effectQuality: 'HIGH', reduceMotion: false, mute: false, masterVolume: 0.8, musicVolume: 0.55, effectsVolume: 0.8, textScale: 1, developerMode: false },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
};

export const cloneGameState = (state: GameState): GameState => {
  if (typeof structuredClone === 'function') return structuredClone(state);
  return JSON.parse(JSON.stringify(state)) as GameState;
};

export const touchState = (state: GameState, clock: Clock = systemClock): void => {
  state.revision += 1;
  state.updatedAt = clock.now().toISOString();
};
