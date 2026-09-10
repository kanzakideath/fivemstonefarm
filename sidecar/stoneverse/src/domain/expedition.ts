import { SKILL_BY_ID, SPECIES_BY_ID, TRAIT_BY_ID } from '../data';
import { evaluateAchievements, gainAccountXp } from './economy';
import { makeId, SeededRng, systemClock, type RandomSource } from './rng';
import { gainAffinity, generateStone, isPerfectIv } from './stone';
import { gainStoneXpWithMastery } from './mastery';
import { registerStoneInCollection } from './mining';
import { EXPEDITION_STRATEGIES } from './types';
import type {
  Clock,
  CombatStatKey,
  Element,
  ExpeditionClaimResult,
  ExpeditionPartyMemberSnapshot,
  ExpeditionRareDiscovery,
  ExpeditionReportEvent,
  ExpeditionReportSummary,
  ExpeditionRewardBundle,
  ExpeditionRun,
  ExpeditionStrategy,
  GameState,
  Mutation,
  Rarity,
  Stats,
} from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const MAX_EXPEDITION_OFFLINE_MS = 30 * 24 * HOUR;
export const MAX_EXPEDITION_CYCLES_PER_ADVANCE = 2_880;
export const MAX_EXPEDITION_REPORT_EVENTS = 64;
export const MAX_PENDING_RARE_DISCOVERIES = 32;
export const MAX_EXPEDITION_DISCOVERY_STORAGE = 100;
const MAX_REWARD_VALUE = 1_000_000_000;
const EQUIPMENT_REWARD_SEPARATOR = '::';
const DISCOVERY_MUTATION_SEPARATOR = ':expedition-mutation:';
const MUTATIONS: readonly Mutation[] = ['NONE', 'PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'];

export interface ExpeditionEquipmentRewardDescriptor {
  itemId: string;
  rarity: Rarity;
  seed: string;
}

/** Persists the exact report roll inside the reward key without expanding save schema. */
export const encodeExpeditionEquipmentReward = (descriptor: ExpeditionEquipmentRewardDescriptor): string =>
  `${descriptor.itemId}${EQUIPMENT_REWARD_SEPARATOR}${descriptor.rarity}${EQUIPMENT_REWARD_SEPARATOR}${encodeURIComponent(descriptor.seed)}`;

export const parseExpeditionEquipmentReward = (rewardKey: string): ExpeditionEquipmentRewardDescriptor | null => {
  const [itemId, rarity, encodedSeed, ...extra] = rewardKey.split(EQUIPMENT_REWARD_SEPARATOR);
  if (!itemId?.startsWith('equipment_') || !rarity || !encodedSeed || extra.length > 0 || !RARITY_ORDER.includes(rarity as Rarity)) return null;
  try {
    const seed = decodeURIComponent(encodedSeed);
    return seed ? { itemId, rarity: rarity as Rarity, seed } : null;
  } catch {
    return null;
  }
};

export interface ExpeditionDurationDefinition {
  id: string;
  label: string;
  durationMs: number;
  yieldMultiplier: number;
  rareMultiplier: number;
}

export const EXPEDITION_DURATIONS: readonly ExpeditionDurationDefinition[] = [
  { id: 'duration_15m', label: '15 minutes', durationMs: 15 * MINUTE, yieldMultiplier: 0.25, rareMultiplier: 0.52 },
  { id: 'duration_30m', label: '30 minutes', durationMs: 30 * MINUTE, yieldMultiplier: 0.5, rareMultiplier: 0.72 },
  { id: 'duration_1h', label: '1 hour', durationMs: HOUR, yieldMultiplier: 1, rareMultiplier: 1 },
  { id: 'duration_3h', label: '3 hours', durationMs: 3 * HOUR, yieldMultiplier: 2.9, rareMultiplier: 1.8 },
  { id: 'duration_4h', label: '4 hours', durationMs: 4 * HOUR, yieldMultiplier: 3.8, rareMultiplier: 2.08 },
  { id: 'duration_6h', label: '6 hours', durationMs: 6 * HOUR, yieldMultiplier: 5.6, rareMultiplier: 2.55 },
  { id: 'duration_12h', label: '12 hours', durationMs: 12 * HOUR, yieldMultiplier: 10.8, rareMultiplier: 3.65 },
  { id: 'duration_24h', label: '24 hours', durationMs: 24 * HOUR, yieldMultiplier: 20.5, rareMultiplier: 5.2 },
] as const;

export interface ExpeditionRegionDefinition {
  id: string;
  name: string;
  requiredGuildLevel: number;
  enemyTags: string[];
  enemyPower: number;
  favoredElements: Element[];
  baseCreditsPerHour: number;
  baseDustPerHour: number;
  baseAccountXpPerHour: number;
  baseStoneXpPerHour: number;
  baseAffinityPerHour: number;
  miningDifficulty: number;
  materialDropIds: string[];
  materialChance: number;
  rareSpeciesIds: string[];
  rareDiscoveryChance: number;
  mutationEncounterChance: number;
  equipmentDropId: string;
  equipmentDropChance: number;
  eventChance: number;
  bossChance: number;
}

export const EXPEDITION_REGIONS: readonly ExpeditionRegionDefinition[] = [
  {
    id: 'region_starter_quarry', name: 'Starter Quarry', requiredGuildLevel: 1,
    enemyTags: ['pebble-swarm', 'quarry-slime'], enemyPower: 160, favoredElements: ['EARTH', 'NEUTRAL'],
    baseCreditsPerHour: 105, baseDustPerHour: 16, baseAccountXpPerHour: 25, baseStoneXpPerHour: 58, baseAffinityPerHour: 2,
    miningDifficulty: 120, materialDropIds: ['material_quarry_ore'], materialChance: 0.48,
    rareSpeciesIds: ['species_quartzling'], rareDiscoveryChance: 0.003, mutationEncounterChance: 0.002,
    equipmentDropId: 'equipment_quarry_charm', equipmentDropChance: 0.012, eventChance: 0.05, bossChance: 0.01,
  },
  {
    id: 'region_crystal_cavern', name: 'Crystal Cavern', requiredGuildLevel: 2,
    enemyTags: ['crystal-mite', 'resonant-sentinel'], enemyPower: 520, favoredElements: ['CRYSTAL', 'WATER'],
    baseCreditsPerHour: 175, baseDustPerHour: 29, baseAccountXpPerHour: 42, baseStoneXpPerHour: 82, baseAffinityPerHour: 3,
    miningDifficulty: 360, materialDropIds: ['material_resonant_shard', 'material_clear_geode'], materialChance: 0.44,
    rareSpeciesIds: ['species_aquamarite', 'species_prismara'], rareDiscoveryChance: 0.0045, mutationEncounterChance: 0.003,
    equipmentDropId: 'equipment_resonance_rune', equipmentDropChance: 0.016, eventChance: 0.065, bossChance: 0.014,
  },
  {
    id: 'region_volcanic_rift', name: 'Volcanic Rift', requiredGuildLevel: 3,
    enemyTags: ['magma-wyrm', 'rift-forged'], enemyPower: 900, favoredElements: ['FIRE', 'EARTH'],
    baseCreditsPerHour: 245, baseDustPerHour: 44, baseAccountXpPerHour: 58, baseStoneXpPerHour: 112, baseAffinityPerHour: 4,
    miningDifficulty: 650, materialDropIds: ['material_magma_glass', 'item_magma_heart'], materialChance: 0.4,
    rareSpeciesIds: ['species_emberite', 'species_pyroclast'], rareDiscoveryChance: 0.0055, mutationEncounterChance: 0.004,
    equipmentDropId: 'equipment_caldera_core', equipmentDropChance: 0.019, eventChance: 0.075, bossChance: 0.022,
  },
  {
    id: 'region_ancient_stratum', name: 'Ancient Stratum', requiredGuildLevel: 4,
    enemyTags: ['fossil-guardian', 'first-age-echo'], enemyPower: 1_420, favoredElements: ['ANCIENT', 'METAL'],
    baseCreditsPerHour: 330, baseDustPerHour: 62, baseAccountXpPerHour: 80, baseStoneXpPerHour: 148, baseAffinityPerHour: 5,
    miningDifficulty: 980, materialDropIds: ['material_ancient_tablet', 'item_primordial_core'], materialChance: 0.35,
    rareSpeciesIds: ['species_ironwarden', 'species_worldheart'], rareDiscoveryChance: 0.006, mutationEncounterChance: 0.008,
    equipmentDropId: 'equipment_ancestor_relic', equipmentDropChance: 0.022, eventChance: 0.085, bossChance: 0.03,
  },
  {
    id: 'region_meteor_crater', name: 'Meteor Crater', requiredGuildLevel: 5,
    enemyTags: ['star-spawn', 'meteor-colossus'], enemyPower: 2_080, favoredElements: ['LIGHT', 'METAL'],
    baseCreditsPerHour: 440, baseDustPerHour: 86, baseAccountXpPerHour: 108, baseStoneXpPerHour: 192, baseAffinityPerHour: 6,
    miningDifficulty: 1_420, materialDropIds: ['material_meteor_alloy', 'material_stardust'], materialChance: 0.32,
    rareSpeciesIds: ['species_ironwarden', 'species_solaris'], rareDiscoveryChance: 0.007, mutationEncounterChance: 0.009,
    equipmentDropId: 'equipment_meteor_relic', equipmentDropChance: 0.027, eventChance: 0.095, bossChance: 0.036,
  },
  {
    id: 'region_abyssal_mine', name: 'Abyssal Mine', requiredGuildLevel: 6,
    enemyTags: ['void-stalker', 'abyssal-overseer'], enemyPower: 3_050, favoredElements: ['DARK', 'CRYSTAL'],
    baseCreditsPerHour: 585, baseDustPerHour: 118, baseAccountXpPerHour: 145, baseStoneXpPerHour: 255, baseAffinityPerHour: 7,
    miningDifficulty: 2_050, materialDropIds: ['material_void_crystal', 'item_eclipse_shard'], materialChance: 0.29,
    rareSpeciesIds: ['species_eclipse_geode', 'species_prismara'], rareDiscoveryChance: 0.0085, mutationEncounterChance: 0.014,
    equipmentDropId: 'equipment_abyssal_rune', equipmentDropChance: 0.031, eventChance: 0.11, bossChance: 0.044,
  },
  {
    id: 'region_celestial_fault', name: 'Celestial Fault', requiredGuildLevel: 7,
    enemyTags: ['solar-seraph', 'fault-titan'], enemyPower: 4_250, favoredElements: ['LIGHT', 'ANCIENT'],
    baseCreditsPerHour: 780, baseDustPerHour: 158, baseAccountXpPerHour: 192, baseStoneXpPerHour: 330, baseAffinityPerHour: 9,
    miningDifficulty: 2_900, materialDropIds: ['material_celestial_fragment', 'material_first_light'], materialChance: 0.26,
    rareSpeciesIds: ['species_solaris', 'species_worldheart'], rareDiscoveryChance: 0.011, mutationEncounterChance: 0.018,
    equipmentDropId: 'equipment_celestial_core', equipmentDropChance: 0.038, eventChance: 0.13, bossChance: 0.055,
  },
] as const;

const DURATION_BY_ID = Object.fromEntries(EXPEDITION_DURATIONS.map((entry) => [entry.id, entry])) as Record<string, ExpeditionDurationDefinition>;
const REGION_BY_ID = Object.fromEntries(EXPEDITION_REGIONS.map((entry) => [entry.id, entry])) as Record<string, ExpeditionRegionDefinition>;
const RARITY_ORDER: readonly Rarity[] = ['NORMAL', 'RARE', 'SR', 'SSR', 'UR', 'LEGENDARY'];

export interface StartExpeditionOptions {
  regionId: string;
  durationId: string;
  strategy: ExpeditionStrategy;
  partyId?: string;
  repeat?: boolean;
}

export interface ExpeditionStrategyDefinition {
  id: ExpeditionStrategy;
  battle: number;
  mining: number;
  xp: number;
  material: number;
  discovery: number;
  reward: number;
  winShift: number;
  failureRetention: number;
}

export const EXPEDITION_STRATEGY_CONFIGS: Readonly<Record<ExpeditionStrategy, ExpeditionStrategyDefinition>> = {
  BALANCED: { id: 'BALANCED', battle: 1, mining: 1, xp: 1, material: 1, discovery: 1, reward: 1, winShift: 0, failureRetention: 0.62 },
  COMBAT: { id: 'COMBAT', battle: 1.28, mining: 0.82, xp: 1.25, material: 0.82, discovery: 0.78, reward: 1.08, winShift: 0.08, failureRetention: 0.58 },
  MINING: { id: 'MINING', battle: 0.9, mining: 1.52, xp: 0.86, material: 1.7, discovery: 1.05, reward: 1.08, winShift: -0.04, failureRetention: 0.68 },
  DISCOVERY: { id: 'DISCOVERY', battle: 0.88, mining: 1.08, xp: 0.84, material: 0.92, discovery: 1.9, reward: 1.03, winShift: -0.05, failureRetention: 0.64 },
  SAFE: { id: 'SAFE', battle: 1.08, mining: 0.92, xp: 0.88, material: 0.86, discovery: 0.72, reward: 0.76, winShift: 0.17, failureRetention: 0.92 },
  HIGH_RISK: { id: 'HIGH_RISK', battle: 0.9, mining: 1.12, xp: 1.3, material: 1.36, discovery: 1.62, reward: 1.62, winShift: -0.16, failureRetention: 0.3 },
  EXPERIENCE: { id: 'EXPERIENCE', battle: 1.08, mining: 0.82, xp: 1.55, material: 0.8, discovery: 0.82, reward: 1, winShift: 0, failureRetention: 0.6 },
  MATERIALS: { id: 'MATERIALS', battle: 0.92, mining: 1.42, xp: 0.86, material: 1.7, discovery: 0.88, reward: 1.04, winShift: -0.03, failureRetention: 0.66 },
};

/**
 * The mutation result is written into the discovery seed. This keeps the
 * descriptor backwards-compatible while making appraisal independent of when
 * or on which lifecycle path (foreground, offline or after reload) it occurs.
 */
export const parseExpeditionDiscoveryMutation = (seed: string): Mutation | null => {
  const markerIndex = seed.lastIndexOf(DISCOVERY_MUTATION_SEPARATOR);
  if (markerIndex < 0) return null;
  const candidate = seed.slice(markerIndex + DISCOVERY_MUTATION_SEPARATOR.length);
  return MUTATIONS.includes(candidate as Mutation) ? candidate as Mutation : null;
};

const encodeExpeditionDiscoveryMutation = (seed: string, mutation: Mutation): string =>
  `${seed}${DISCOVERY_MUTATION_SEPARATOR}${mutation}`;

export const rollExpeditionDiscoveryMutation = (
  seed: string,
  regionId: string,
  durationId: string,
  strategyId: ExpeditionStrategy,
  explorationStrength = 1,
): Mutation => {
  const region = REGION_BY_ID[regionId];
  const duration = DURATION_BY_ID[durationId];
  const strategy = EXPEDITION_STRATEGY_CONFIGS[strategyId];
  if (!region || !duration || !strategy) throw new Error('Cannot roll a mutation for invalid expedition configuration');
  const strength = Math.max(0.55, Math.min(2.5, explorationStrength));
  // 0.15% is the normal EXPEDITION baseline. The regional anomaly value is
  // now a real modifier rather than only a material-trace drop chance.
  const chance = Math.min(0.35, 0.0015 + region.mutationEncounterChance * duration.rareMultiplier * strategy.discovery * strength);
  const rng = new SeededRng(`${seed}:mutation-roll:${region.id}:${duration.id}:${strategy.id}`);
  if (!rng.chance(chance)) return 'NONE';
  return rng.weighted<Mutation>(['PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'], (mutation) => ({
    NONE: 0, PRISMATIC: 54, ANCIENT: 27, CORRUPTED: 16, PERFECT: 3,
  })[mutation]);
};

export interface AdvanceExpeditionResult {
  cyclesProcessed: number;
  reports: ExpeditionReportEvent[];
  capped: boolean;
}

export const createEmptyExpeditionReward = (): ExpeditionRewardBundle => ({
  credits: 0,
  upgradeDust: 0,
  researchCores: 0,
  accountXp: 0,
  stoneXpPerMember: 0,
  affinityPerMember: 0,
  items: {},
  rareDiscoveries: [],
});

export const createEmptyExpeditionReportSummary = (): ExpeditionReportSummary => ({
  battles: 0,
  wins: 0,
  miningYield: 0,
  rareDiscoveries: 0,
  equipmentDrops: 0,
  bestDropRarity: null,
});

const boundedInteger = (value: number, max = MAX_REWARD_VALUE): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(max, Math.floor(value));
};

const saturatingAdd = (left: number, right: number, max = MAX_REWARD_VALUE): number =>
  Math.min(max, boundedInteger(left, max) + boundedInteger(right, max));

const addReward = (target: ExpeditionRewardBundle, source: ExpeditionRewardBundle): void => {
  if (target.rareDiscoveries.length + source.rareDiscoveries.length > MAX_PENDING_RARE_DISCOVERIES) {
    throw new Error('Expedition rare-discovery storage capacity invariant exceeded');
  }
  target.credits = saturatingAdd(target.credits, source.credits);
  target.upgradeDust = saturatingAdd(target.upgradeDust, source.upgradeDust);
  target.researchCores = saturatingAdd(target.researchCores, source.researchCores);
  target.accountXp = saturatingAdd(target.accountXp, source.accountXp);
  target.stoneXpPerMember = saturatingAdd(target.stoneXpPerMember, source.stoneXpPerMember);
  target.affinityPerMember = saturatingAdd(target.affinityPerMember, source.affinityPerMember);
  for (const [itemId, count] of Object.entries(source.items)) target.items[itemId] = saturatingAdd(target.items[itemId] ?? 0, count);
  target.rareDiscoveries.push(...source.rareDiscoveries);
};

const cloneReward = (reward: ExpeditionRewardBundle): ExpeditionRewardBundle => ({
  ...reward,
  items: { ...reward.items },
  rareDiscoveries: reward.rareDiscoveries.map((entry) => ({ ...entry })),
});

const statsTotal = (stats: Stats): number => stats.hardness + stats.purity + stats.power + stats.defense + stats.speed + stats.resonance + stats.maxHp / 8;

const equipmentBonuses = (stone: GameState['stones'][string]): Partial<Stats> => {
  const bonuses: Partial<Stats> = {};
  const setCounts = new Map<string, number>();
  for (const equipment of Object.values(stone.equipment)) {
    if (!equipment) continue;
    const setId = equipment.setId ?? ['BASTION', 'RESONANCE', 'HUNTER', 'ABYSSAL'].find((id) => equipment.definitionId.startsWith(`${id}_`));
    if (setId) setCounts.set(setId, (setCounts.get(setId) ?? 0) + 1);
    for (const affix of equipment.affixes) {
      const base = stone.stats[affix.stat];
      const value = affix.operation === 'PERCENT' ? base * affix.value : affix.value;
      bonuses[affix.stat] = (bonuses[affix.stat] ?? 0) + value;
    }
  }
  if ((setCounts.get('BASTION') ?? 0) >= 2) bonuses.defense = (bonuses.defense ?? 0) + stone.stats.defense * 0.12;
  if ((setCounts.get('BASTION') ?? 0) >= 4) bonuses.maxHp = (bonuses.maxHp ?? 0) + stone.stats.maxHp * 0.2;
  if ((setCounts.get('RESONANCE') ?? 0) >= 4) bonuses.speed = (bonuses.speed ?? 0) + stone.stats.speed * 0.15;
  if ((setCounts.get('HUNTER') ?? 0) >= 2) bonuses.power = (bonuses.power ?? 0) + stone.stats.power * 0.1;
  if ((setCounts.get('ABYSSAL') ?? 0) >= 2) bonuses.resonance = (bonuses.resonance ?? 0) + stone.stats.resonance * 0.15;
  if ((setCounts.get('ABYSSAL') ?? 0) >= 4) bonuses.power = (bonuses.power ?? 0) + stone.stats.power * 0.18;
  return bonuses;
};

const snapshotParty = (state: GameState, partyId: string): ExpeditionPartyMemberSnapshot[] => {
  const party = state.parties.find((candidate) => candidate.id === partyId);
  if (!party || party.slots.length === 0) throw new Error('Expedition requires a non-empty party');
  return party.slots.map(({ stoneId }) => {
    const stone = state.stones[stoneId];
    if (!stone) throw new Error(`Expedition party stone is missing: ${stoneId}`);
    const equipment = Object.values(stone.equipment).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    return {
      stoneId,
      speciesId: stone.speciesId,
      level: stone.level,
      rarity: stone.rarity,
      primaryElement: stone.primaryElement,
      secondaryElement: stone.secondaryElement,
      stats: { ...stone.stats },
      individualValues: { ...stone.individualValues },
      skillIds: stone.skills.map((skill) => skill.skillId),
      traitIds: [...stone.traitIds],
      equipment: equipment.map((entry) => ({ ...entry, affixes: entry.affixes.map((affix) => ({ ...affix })) })),
      equipmentBonuses: equipmentBonuses(stone),
      mutation: stone.mutation,
      generation: stone.generation,
      lineage: [...stone.parents, ...stone.grandparents].slice(0, 8).map((entry) => ({ ...entry, traitIds: [...entry.traitIds] })),
      power: Math.floor(statsTotal(stone.stats)),
      affinityRank: stone.affinity.rank,
    };
  });
};

const activeRunCount = (state: GameState): number => Object.values(state.expeditions.runs).filter((run) => run.status !== 'CLAIMED').length;

/**
 * Converts a repeating expedition into a one-cycle finish. The current cycle
 * keeps its original completion time and every already completed cycle remains
 * in Expedition Storage until it is claimed.
 */
export const stopExpedition = (state: GameState, expeditionId: string): ExpeditionRun => {
  const run = state.expeditions.runs[expeditionId];
  if (!run) throw new Error('Expedition not found');
  if (run.status === 'CLAIMED') throw new Error('Expedition is already claimed');
  run.repeat = false;
  return run;
};

export const startExpedition = (
  state: GameState,
  options: StartExpeditionOptions,
  rng: RandomSource,
  clock: Clock = systemClock,
): ExpeditionRun => {
  const region = REGION_BY_ID[options.regionId];
  const duration = DURATION_BY_ID[options.durationId];
  if (!region) throw new Error(`Unknown expedition region: ${options.regionId}`);
  if (!duration) throw new Error(`Unknown expedition duration: ${options.durationId}`);
  if (!EXPEDITION_STRATEGIES.includes(options.strategy)) throw new Error('Unknown expedition strategy');
  if (state.facilities.expeditionGuild < region.requiredGuildLevel) throw new Error(`Expedition Guild level ${region.requiredGuildLevel} required`);
  const slotLimit = Math.min(4, 1 + Math.floor((state.facilities.expeditionGuild - 1) / 2));
  if (activeRunCount(state) >= slotLimit) throw new Error('All expedition slots are occupied');
  const partyId = options.partyId ?? state.activePartyId;
  const partySnapshot = snapshotParty(state, partyId);
  const facilityStoneIds = new Set([
    ...(state.training.assignment ? [state.training.assignment.stoneId] : []),
    ...(state.affinityGarden.assignment ? [state.affinityGarden.assignment.stoneId] : []),
    ...((state.endlessMine.status === 'RUNNING' || state.endlessMine.status === 'PAUSED') ? state.endlessMine.partyStoneIds : []),
    ...(state.activeBattle && !state.activeBattle.winner ? state.activeBattle.units.filter((unit) => unit.team === 'PLAYER').map((unit) => unit.stoneId) : []),
  ]);
  if (partySnapshot.some((member) => facilityStoneIds.has(member.stoneId))) throw new Error('A party stone is assigned to another background activity');
  const occupied = new Set(Object.values(state.expeditions.runs)
    .filter((run) => run.status !== 'CLAIMED')
    .flatMap((run) => run.partySnapshot.map((member) => member.stoneId)));
  if (partySnapshot.some((member) => occupied.has(member.stoneId))) throw new Error('A party stone is already on expedition');
  const now = clock.now();
  if (!Number.isFinite(now.getTime())) throw new Error('Expedition clock returned an invalid date');
  const expeditionId = makeId('expedition', rng, now.getTime());
  const seed = `${expeditionId}:${Math.floor(rng.next() * 0x1_0000_0000).toString(16)}`;
  const run: ExpeditionRun = {
    expeditionId,
    regionId: region.id,
    durationId: duration.id,
    durationMs: duration.durationMs,
    strategy: options.strategy,
    partyId,
    partySnapshot,
    seed,
    repeat: Boolean(options.repeat),
    status: 'ACTIVE',
    startedAt: now.toISOString(),
    lastSimulatedAt: now.toISOString(),
    nextCompletionAt: new Date(now.getTime() + duration.durationMs).toISOString(),
    completedCycles: 0,
    claimedCycles: 0,
    claimCount: 0,
    expeditionStorage: createEmptyExpeditionReward(),
    reportEvents: [{
      reportId: `${expeditionId}:departure`, expeditionId, cycle: 0, completedAt: now.toISOString(), offsetMs: 0,
      kind: 'DEPARTURE', title: `Departed for ${region.name}`, detail: `${partySnapshot.length} stones began a ${duration.label} expedition.`,
      successScore: 0, battleWon: null, miningYield: 0, equipmentDropId: null, equipmentDropSeed: null, bestDropRarity: null, rareDiscoveryCount: 0,
      reward: { credits: 0, upgradeDust: 0, researchCores: 0, accountXp: 0, stoneXpPerMember: 0, affinityPerMember: 0, items: {} },
    }],
    reportSummary: createEmptyExpeditionReportSummary(),
    lastClaimedAt: null,
  };
  state.expeditions.runs[expeditionId] = run;
  state.expeditions.order.unshift(expeditionId);
  state.expeditions.order = state.expeditions.order.slice(0, 100);
  const retained = new Set(state.expeditions.order);
  for (const [id, existing] of Object.entries(state.expeditions.runs)) if (!retained.has(id) && existing.status === 'CLAIMED') delete state.expeditions.runs[id];
  return run;
};

export interface ExpeditionBuildMetrics {
  combat: number;
  mining: number;
  exploration: number;
  research: number;
  elementMatches: number;
}

type ExpeditionAptitudes = Omit<ExpeditionBuildMetrics, 'elementMatches'>;

const emptyAptitudes = (): ExpeditionAptitudes => ({ combat: 0, mining: 0, exploration: 0, research: 0 });

const addAptitudes = (target: ExpeditionAptitudes, source: ExpeditionAptitudes, scale = 1): void => {
  target.combat += source.combat * scale;
  target.mining += source.mining * scale;
  target.exploration += source.exploration * scale;
  target.research += source.research * scale;
};

const STAT_APTITUDES: Readonly<Record<CombatStatKey, ExpeditionAptitudes>> = {
  hardness: { combat: 0.18, mining: 1.35, exploration: 0.2, research: 0.08 },
  purity: { combat: 0.08, mining: 0.92, exploration: 0.84, research: 0.78 },
  power: { combat: 1.3, mining: 0.16, exploration: 0.1, research: 0.06 },
  defense: { combat: 1, mining: 0.32, exploration: 0.36, research: 0.05 },
  speed: { combat: 0.7, mining: 0.14, exploration: 0.78, research: 0.2 },
  resonance: { combat: 0.42, mining: 0.72, exploration: 1.08, research: 1.4 },
  maxHp: { combat: 0.14, mining: 0.018, exploration: 0.035, research: 0.01 },
};

const ELEMENT_APTITUDES: Readonly<Record<Element, ExpeditionAptitudes>> = {
  NEUTRAL: { combat: 3, mining: 3, exploration: 3, research: 3 },
  FIRE: { combat: 13, mining: 5, exploration: 2, research: 2 },
  WATER: { combat: 5, mining: 4, exploration: 11, research: 5 },
  EARTH: { combat: 7, mining: 14, exploration: 5, research: 2 },
  WIND: { combat: 6, mining: 2, exploration: 14, research: 4 },
  LIGHT: { combat: 7, mining: 2, exploration: 8, research: 10 },
  DARK: { combat: 12, mining: 4, exploration: 8, research: 5 },
  CRYSTAL: { combat: 5, mining: 8, exploration: 9, research: 14 },
  METAL: { combat: 9, mining: 13, exploration: 3, research: 4 },
  ANCIENT: { combat: 8, mining: 7, exploration: 8, research: 15 },
};

const ROLE_APTITUDES = {
  ATTACK: { combat: 15, mining: 3, exploration: 2, research: 1 },
  TANK: { combat: 11, mining: 9, exploration: 5, research: 1 },
  SUPPORT: { combat: 6, mining: 4, exploration: 9, research: 12 },
  CONTROL: { combat: 9, mining: 2, exploration: 12, research: 7 },
} as const satisfies Readonly<Record<string, ExpeditionAptitudes>>;

const MUTATION_APTITUDES: Readonly<Record<Mutation, ExpeditionAptitudes>> = {
  NONE: emptyAptitudes(),
  PRISMATIC: { combat: 9, mining: 4, exploration: 17, research: 15 },
  ANCIENT: { combat: 11, mining: 13, exploration: 8, research: 17 },
  CORRUPTED: { combat: 18, mining: 11, exploration: 5, research: 4 },
  PERFECT: { combat: 25, mining: 25, exploration: 25, research: 25 },
};

const addTagAptitudes = (target: ExpeditionAptitudes, tags: readonly string[], scale = 1): void => {
  for (const tag of tags) {
    const contribution: ExpeditionAptitudes | null = ({
      attack: { combat: 8, mining: 1, exploration: 1, research: 0.5 },
      basic: { combat: 3, mining: 2, exploration: 2, research: 1 },
      tank: { combat: 7, mining: 5, exploration: 4, research: 0.5 },
      support: { combat: 4, mining: 2, exploration: 7, research: 8 },
      control: { combat: 6, mining: 1, exploration: 9, research: 5 },
      speed: { combat: 3, mining: 1, exploration: 8, research: 2 },
      critical: { combat: 7, mining: 1, exploration: 4, research: 4 },
      element: { combat: 3, mining: 2, exploration: 4, research: 5 },
      fire: { combat: 6, mining: 3, exploration: 0.5, research: 0.5 },
      natural: { combat: 1, mining: 8, exploration: 7, research: 2 },
      fusion: { combat: 4, mining: 1, exploration: 2, research: 8 },
      ancient: { combat: 4, mining: 5, exploration: 4, research: 9 },
      mutation: { combat: 3, mining: 3, exploration: 8, research: 7 },
      rare: { combat: 2, mining: 1, exploration: 3, research: 5 },
      legendary: { combat: 5, mining: 3, exploration: 5, research: 8 },
      ultimate: { combat: 6, mining: 1, exploration: 2, research: 4 },
    } as Record<string, ExpeditionAptitudes>)[tag] ?? null;
    if (contribution) addAptitudes(target, contribution, scale);
  }
};

const skillAptitudes = (skillId: string, region: ExpeditionRegionDefinition): ExpeditionAptitudes => {
  const result = emptyAptitudes();
  const skill = SKILL_BY_ID[skillId];
  if (!skill) return result;
  const targetScale = skill.target === 'ALL_ENEMIES' || skill.target === 'ALL_ALLIES' ? 1.22 : skill.target === 'SELF' ? 0.88 : 1;
  const cadence = skill.ultimateCost > 0 ? 0.82 : 1 / (1 + skill.cooldown * 0.08);
  for (const effect of skill.effects) {
    const power = Math.max(0, effect.power ?? 0) * targetScale * cadence;
    switch (effect.type) {
      case 'DAMAGE': addAptitudes(result, { combat: 29, mining: 2.5, exploration: 2, research: 0.8 }, power); break;
      case 'HEAL': addAptitudes(result, { combat: 13, mining: 1, exploration: 18, research: 5 }, power); break;
      case 'SHIELD': addAptitudes(result, { combat: 17, mining: 3, exploration: 15, research: 2 }, power); break;
      case 'BUFF':
      case 'DEBUFF': {
        const statWeights = effect.stat ? STAT_APTITUDES[effect.stat] : null;
        if (statWeights) addAptitudes(result, statWeights, Math.abs(effect.value ?? 0) * 58 * targetScale * cadence);
        break;
      }
      case 'STATUS': addAptitudes(result, { combat: 8, mining: 0.5, exploration: 8, research: 4 }, (effect.chance ?? 1) * targetScale * cadence); break;
      case 'ULTIMATE_GAIN': addAptitudes(result, { combat: 3, mining: 0.5, exploration: 2, research: 5 }, Math.max(0, effect.value ?? 0) / 8); break;
    }
  }
  addTagAptitudes(result, skill.tags, cadence);
  addAptitudes(result, ELEMENT_APTITUDES[skill.element], region.favoredElements.includes(skill.element) ? 1.35 : 0.72);
  result.research += Math.max(0, skill.priority) * 0.8 + skill.effects.length * 1.2;
  return result;
};

const traitAptitudes = (
  traitIds: readonly string[],
  effective: Stats,
  region: ExpeditionRegionDefinition,
): ExpeditionAptitudes => {
  const result = emptyAptitudes();
  for (const traitId of traitIds) {
    const trait = TRAIT_BY_ID[traitId];
    if (!trait) continue;
    const tierScale = trait.tier === 'COMMON' ? 1 : trait.tier === 'RARE' ? 1.2 : 1.38;
    const triggerScale = { ALWAYS: 1, BATTLE_START: 0.88, LOW_HP: 0.48, ON_HIT: 0.74, ON_CRIT: 0.42, TURN_START: 0.82 } as const;
    for (const effect of trait.effects) {
      if (!effect.stat) continue;
      const base = Math.sqrt(Math.max(1, effective[effect.stat]));
      const magnitude = effect.operation === 'PERCENT' ? base * Math.abs(effect.value ?? 0) * 6 : Math.log2(1 + Math.abs(effect.value ?? 0));
      const elementScale = effect.element ? (region.favoredElements.includes(effect.element) ? 1.35 : 0.72) : 1;
      addAptitudes(result, STAT_APTITUDES[effect.stat], magnitude * triggerScale[effect.trigger] * elementScale * tierScale);
    }
    addTagAptitudes(result, trait.tags, tierScale);
    result.research += trait.effects.length * tierScale;
  }
  return result;
};

const equipmentAptitudes = (member: ExpeditionPartyMemberSnapshot): ExpeditionAptitudes => {
  const result = emptyAptitudes();
  const setCounts = new Map<string, number>();
  const rarityValue: Readonly<Record<Rarity, number>> = { NORMAL: 1, RARE: 1.25, SR: 1.55, SSR: 1.9, UR: 2.3, LEGENDARY: 2.8 };
  const slotValues: Readonly<Record<string, ExpeditionAptitudes>> = {
    CORE: { combat: 7, mining: 3, exploration: 2, research: 5 },
    RUNE: { combat: 3, mining: 3, exploration: 6, research: 9 },
    RELIC: { combat: 4, mining: 8, exploration: 6, research: 4 },
    CHARM: { combat: 2, mining: 5, exploration: 9, research: 5 },
  };
  for (const equipment of member.equipment) {
    const setId = equipment.setId ?? ['BASTION', 'RESONANCE', 'HUNTER', 'ABYSSAL'].find((id) => equipment.definitionId.startsWith(`${id}_`)) ?? null;
    if (setId) setCounts.set(setId, (setCounts.get(setId) ?? 0) + 1);
    const quality = rarityValue[equipment.rarity] * (1 + Math.max(0, equipment.level - 1) * 0.025);
    addAptitudes(result, slotValues[equipment.slot] ?? emptyAptitudes(), quality);
    for (const affix of equipment.affixes) {
      const magnitude = affix.operation === 'PERCENT' ? Math.abs(affix.value) * 48 : Math.log2(1 + Math.abs(affix.value)) * 0.8;
      addAptitudes(result, STAT_APTITUDES[affix.stat], magnitude);
      const source = affix.sourceStat;
      if (source === 'accuracy') addAptitudes(result, { combat: 3, mining: 0, exploration: 7, research: 1 }, magnitude);
      else if (source === 'resistance') addAptitudes(result, { combat: 4, mining: 1, exploration: 6, research: 2 }, magnitude);
      else if (source === 'critChance' || source === 'critDamage') addAptitudes(result, { combat: 8, mining: 0, exploration: 2, research: 1 }, magnitude);
      else if (source === 'breakPower') addAptitudes(result, { combat: 5, mining: 8, exploration: 1, research: 0 }, magnitude);
    }
    const definitionId = equipment.definitionId.toLowerCase();
    if (definitionId.includes('quarry')) addAptitudes(result, { combat: 0, mining: 7, exploration: 3, research: 1 }, quality);
    if (definitionId.includes('resonance') || definitionId.includes('rune')) addAptitudes(result, { combat: 1, mining: 2, exploration: 4, research: 7 }, quality);
    if (definitionId.includes('caldera')) addAptitudes(result, { combat: 7, mining: 5, exploration: 1, research: 0 }, quality);
    if (definitionId.includes('ancestor')) addAptitudes(result, { combat: 2, mining: 4, exploration: 4, research: 8 }, quality);
    if (definitionId.includes('meteor')) addAptitudes(result, { combat: 3, mining: 6, exploration: 7, research: 2 }, quality);
    if (definitionId.includes('abyss')) addAptitudes(result, { combat: 6, mining: 2, exploration: 7, research: 4 }, quality);
    if (definitionId.includes('celestial')) addAptitudes(result, { combat: 4, mining: 2, exploration: 7, research: 8 }, quality);
  }
  const setVectors: Readonly<Record<string, ExpeditionAptitudes>> = {
    BASTION: { combat: 8, mining: 5, exploration: 4, research: 1 },
    RESONANCE: { combat: 3, mining: 4, exploration: 7, research: 10 },
    HUNTER: { combat: 10, mining: 6, exploration: 3, research: 1 },
    ABYSSAL: { combat: 9, mining: 3, exploration: 8, research: 6 },
  };
  for (const [setId, count] of setCounts) {
    const vector = setVectors[setId];
    if (!vector) continue;
    addAptitudes(result, vector, count + (count >= 2 ? 1.5 : 0) + (count >= 4 ? 2.5 : 0));
  }
  return result;
};

const lineageAptitudes = (
  member: ExpeditionPartyMemberSnapshot,
  effective: Stats,
  region: ExpeditionRegionDefinition,
): ExpeditionAptitudes => {
  const result = emptyAptitudes();
  member.lineage.forEach((ancestor, index) => {
    const species = SPECIES_BY_ID[ancestor.speciesId];
    if (!species) return;
    const depthScale = 0.72 / (1 + index * 0.18);
    addAptitudes(result, ROLE_APTITUDES[species.role], depthScale);
    addAptitudes(result, ELEMENT_APTITUDES[species.primaryElement], depthScale * (region.favoredElements.includes(species.primaryElement) ? 1.25 : 0.58));
    addAptitudes(result, traitAptitudes(ancestor.traitIds, effective, region), depthScale * 0.42);
    addAptitudes(result, MUTATION_APTITUDES[ancestor.mutation], depthScale * 0.55);
  });
  return result;
};

const partyMetrics = (party: readonly ExpeditionPartyMemberSnapshot[], region: ExpeditionRegionDefinition): ExpeditionBuildMetrics => {
  const totals: ExpeditionBuildMetrics = { combat: 0, mining: 0, exploration: 0, research: 0, elementMatches: 0 };
  for (const member of party) {
    const effective = Object.fromEntries(Object.entries(member.stats).map(([key, value]) => [key, value + (member.equipmentBonuses[key as keyof Stats] ?? 0)])) as Stats;
    const geneQuality = Object.values(member.individualValues).reduce((sum, value) => sum + value, 0) / 186;
    const lineageDepth = Math.min(8, member.lineage.length) * 0.015 + Math.min(10, member.generation) * 0.012;
    const elementMatch = region.favoredElements.includes(member.primaryElement) || (member.secondaryElement !== null && region.favoredElements.includes(member.secondaryElement));
    if (elementMatch) totals.elementMatches += 1;

    totals.combat += effective.power * 1.25 + effective.defense + effective.speed * 0.72 + effective.maxHp * 0.14
      + member.affinityRank * 12 + geneQuality * 80 + lineageDepth * 100 + (elementMatch ? 72 : 0);
    totals.mining += effective.hardness * 1.2 + effective.purity + effective.resonance * 0.9 + member.level * 2.2 + geneQuality * 32;
    totals.exploration += effective.purity * 0.9 + effective.resonance * 1.25 + effective.speed * 0.4
      + member.affinityRank * 15 + lineageDepth * 75 + (elementMatch ? 28 : 0);
    totals.research += effective.resonance * 1.18 + effective.purity * 0.76 + effective.speed * 0.18
      + member.level * 1.35 + member.affinityRank * 9 + geneQuality * 42 + lineageDepth * 82;

    const build = emptyAptitudes();
    for (const skillId of member.skillIds) addAptitudes(build, skillAptitudes(skillId, region));
    addAptitudes(build, traitAptitudes(member.traitIds, effective, region));
    addAptitudes(build, equipmentAptitudes(member));
    addAptitudes(build, lineageAptitudes(member, effective, region));
    addAptitudes(build, MUTATION_APTITUDES[member.mutation]);
    addAptitudes(build, ELEMENT_APTITUDES[member.primaryElement], elementMatch ? 1.4 : 0.52);
    if (member.secondaryElement) addAptitudes(build, ELEMENT_APTITUDES[member.secondaryElement], region.favoredElements.includes(member.secondaryElement) ? 0.8 : 0.32);
    totals.combat += build.combat;
    totals.mining += build.mining;
    totals.exploration += build.exploration;
    totals.research += build.research;
  }
  return {
    combat: Math.round(totals.combat * 1_000_000) / 1_000_000,
    mining: Math.round(totals.mining * 1_000_000) / 1_000_000,
    exploration: Math.round(totals.exploration * 1_000_000) / 1_000_000,
    research: Math.round(totals.research * 1_000_000) / 1_000_000,
    elementMatches: totals.elementMatches,
  };
};

export const evaluateExpeditionPartyBuild = (
  party: readonly ExpeditionPartyMemberSnapshot[],
  regionId: string,
): ExpeditionBuildMetrics => {
  const region = REGION_BY_ID[regionId];
  if (!region) throw new Error(`Unknown expedition region: ${regionId}`);
  return partyMetrics(party, region);
};

const bestRarity = (left: Rarity | null, right: Rarity | null): Rarity | null => {
  if (left === null) return right;
  if (right === null) return left;
  return RARITY_ORDER.indexOf(right) > RARITY_ORDER.indexOf(left) ? right : left;
};

const rewardWithoutDiscoveries = (reward: ExpeditionRewardBundle): Omit<ExpeditionRewardBundle, 'rareDiscoveries'> => ({
  credits: reward.credits,
  upgradeDust: reward.upgradeDust,
  researchCores: reward.researchCores,
  accountXp: reward.accountXp,
  stoneXpPerMember: reward.stoneXpPerMember,
  affinityPerMember: reward.affinityPerMember,
  items: { ...reward.items },
});

const simulateCycle = (run: ExpeditionRun, cycle: number, completedAtMs: number, guaranteeStarterCore = false): { reward: ExpeditionRewardBundle; events: ExpeditionReportEvent[]; summary: ExpeditionReportSummary } => {
  const region = REGION_BY_ID[run.regionId];
  const duration = DURATION_BY_ID[run.durationId];
  if (!region || !duration || run.durationMs !== duration.durationMs) throw new Error('Expedition references invalid configuration');
  const rng = new SeededRng(`${run.seed}:cycle:${cycle}`);
  const metrics = partyMetrics(run.partySnapshot, region);
  const strategy = EXPEDITION_STRATEGY_CONFIGS[run.strategy];
  const battleRatio = metrics.combat * strategy.battle / Math.max(1, region.enemyPower);
  const miningRatio = Math.max(0.3, Math.min(2.5, metrics.mining * strategy.mining / Math.max(1, region.miningDifficulty)));
  const explorationRatio = Math.max(0.3, Math.min(2.5, metrics.exploration / Math.max(100, region.miningDifficulty * 0.48)));
  const researchRatio = Math.max(0.3, Math.min(2.5, metrics.research / Math.max(100, region.miningDifficulty * 0.42)));
  const winChance = Math.max(0.08, Math.min(0.995, 0.42 + Math.log2(Math.max(0.25, battleRatio)) * 0.18 + metrics.elementMatches * 0.035 + strategy.winShift));
  const bossEncountered = rng.chance(Math.min(0.8, region.bossChance * duration.rareMultiplier));
  const battleWon = rng.chance(Math.max(0.08, winChance - (bossEncountered ? 0.16 : 0)));
  const performance = Math.max(0.22, Math.min(1.65, 0.72 + battleRatio * 0.2 + (battleWon ? 0.24 : -0.12))) * (battleWon ? 1 : strategy.failureRetention);
  const variance = 0.88 + rng.next() * 0.24;
  const factor = duration.yieldMultiplier * performance * variance * strategy.reward;
  const miningYield = boundedInteger(10 * duration.yieldMultiplier * miningRatio * strategy.material, 1_000_000);
  const reward = createEmptyExpeditionReward();
  reward.credits = boundedInteger(region.baseCreditsPerHour * factor * (0.86 + explorationRatio * 0.14));
  reward.upgradeDust = boundedInteger(region.baseDustPerHour * factor * strategy.material * (0.78 + miningRatio * 0.22));
  reward.accountXp = boundedInteger(region.baseAccountXpPerHour * factor * strategy.xp * (0.78 + researchRatio * 0.22));
  reward.stoneXpPerMember = boundedInteger(region.baseStoneXpPerHour * factor * strategy.xp * (0.88 + (battleRatio + researchRatio) * 0.06));
  reward.affinityPerMember = boundedInteger(region.baseAffinityPerHour * duration.yieldMultiplier
    * (run.strategy === 'BALANCED' ? 1.15 : 1) * (0.82 + explorationRatio * 0.1 + researchRatio * 0.08));
  // One account-level bootstrap removes the Guild-1 -> Core -> Research
  // deadlock. It is not repeated for every newly-created Starter run.
  if (guaranteeStarterCore
    || rng.chance(Math.min(0.72, (0.012 + region.requiredGuildLevel * 0.011) * duration.rareMultiplier * (0.72 + researchRatio * 0.28)))) reward.researchCores = 1;
  const materialChance = Math.min(0.96, region.materialChance * duration.rareMultiplier * strategy.material * (0.82 + miningRatio * 0.18));
  if (rng.chance(materialChance)) reward.items[rng.pick(region.materialDropIds)] = Math.max(1, Math.floor(Math.sqrt(duration.yieldMultiplier) * miningRatio));
  const equipmentDropped = rng.chance(Math.min(0.55, region.equipmentDropChance * duration.rareMultiplier * strategy.material * (0.84 + explorationRatio * 0.16)));
  const equipmentRarity: Rarity | null = equipmentDropped ? (region.requiredGuildLevel >= 6 ? 'UR' : region.requiredGuildLevel >= 4 ? 'SSR' : 'SR') : null;
  const equipmentDropSeed = equipmentDropped ? `${run.seed}:equipment:${cycle}` : null;
  if (equipmentDropped && equipmentRarity && equipmentDropSeed) {
    reward.items[encodeExpeditionEquipmentReward({ itemId: region.equipmentDropId, rarity: equipmentRarity, seed: equipmentDropSeed })] = 1;
  }
  let mutationEncountered = rng.chance(Math.min(0.5, region.mutationEncounterChance * duration.rareMultiplier * strategy.discovery * (0.8 + explorationRatio * 0.2)));
  if (mutationEncountered) reward.items.material_mutation_trace = 1;
  const eventEncountered = rng.chance(Math.min(0.8, region.eventChance * duration.rareMultiplier * (0.78 + explorationRatio * 0.22)));
  if (eventEncountered) reward.credits = saturatingAdd(reward.credits, Math.floor(region.baseCreditsPerHour * 0.35 * duration.yieldMultiplier));
  const rareChance = Math.min(0.35, region.rareDiscoveryChance * duration.rareMultiplier * strategy.discovery * explorationRatio * (battleWon ? 1 : 0.55));
  if (rng.chance(rareChance)) {
    const speciesId = rng.pick(region.rareSpeciesIds);
    const species = SPECIES_BY_ID[speciesId];
    if (species) {
      const baseSeed = `${run.seed}:discovery:${cycle}`;
      const mutation = rollExpeditionDiscoveryMutation(baseSeed, region.id, duration.id, run.strategy, explorationRatio);
      const seed = encodeExpeditionDiscoveryMutation(baseSeed, mutation);
      if (mutation !== 'NONE') {
        mutationEncountered = true;
        reward.items.material_mutation_trace = Math.max(1, reward.items.material_mutation_trace ?? 0);
      }
      reward.rareDiscoveries.push({
        discoveryId: `${run.expeditionId}:discovery:${cycle}`,
        seed,
        speciesId,
        veinId: `${region.id}:rare`,
        areaId: region.id,
        hintedRarity: species.rarity,
        sourceEventId: `${run.expeditionId}:cycle:${cycle}`,
        discoveredAt: new Date(completedAtMs).toISOString(),
      });
    }
  }
  const completedAt = new Date(completedAtMs).toISOString();
  const offsetMs = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, completedAtMs - Date.parse(run.startedAt)));
  const successScore = Math.round(winChance * 1000) / 10;
  const events: ExpeditionReportEvent[] = [{
    reportId: `${run.expeditionId}:${cycle}:${bossEncountered ? 'boss' : 'battle'}`,
    expeditionId: run.expeditionId,
    cycle,
    completedAt,
    offsetMs,
    kind: bossEncountered ? 'BOSS' : 'BATTLE',
    title: bossEncountered ? `Boss encounter: ${region.enemyTags.at(-1)}` : `Battle in ${region.name}`,
    detail: battleWon ? 'The expedition party secured the route.' : 'The party withdrew safely and preserved part of the haul.',
    successScore,
    battleWon,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: null,
    rareDiscoveryCount: 0,
    reward: rewardWithoutDiscoveries(createEmptyExpeditionReward()),
  }, {
    reportId: `${run.expeditionId}:${cycle}:mining`, expeditionId: run.expeditionId, cycle, completedAt, offsetMs,
    kind: 'MINING', title: `Surveyed ${region.name}`, detail: `Recovered ${miningYield} units from ${region.miningDifficulty} difficulty strata.`,
    successScore, battleWon: null, miningYield, equipmentDropId: null, equipmentDropSeed: null, bestDropRarity: null, rareDiscoveryCount: 0,
    reward: rewardWithoutDiscoveries(reward),
  }];
  if (equipmentDropped) events.push({
    reportId: `${run.expeditionId}:${cycle}:equipment`, expeditionId: run.expeditionId, cycle, completedAt, offsetMs,
    kind: 'EQUIPMENT', title: 'Equipment cache recovered', detail: region.equipmentDropId,
    successScore, battleWon: null, miningYield: 0, equipmentDropId: region.equipmentDropId, equipmentDropSeed, bestDropRarity: equipmentRarity, rareDiscoveryCount: 0,
    reward: rewardWithoutDiscoveries(createEmptyExpeditionReward()),
  });
  const materialDrops = Object.keys(reward.items).filter((itemId) => !parseExpeditionEquipmentReward(itemId) && itemId !== region.equipmentDropId && itemId !== 'material_mutation_trace');
  if (materialDrops.length > 0) events.push({
    reportId: `${run.expeditionId}:${cycle}:material`, expeditionId: run.expeditionId, cycle, completedAt, offsetMs,
    kind: 'MATERIAL', title: 'Material cache secured', detail: materialDrops.join(', '),
    successScore, battleWon: null, miningYield: 0, equipmentDropId: null, equipmentDropSeed: null, bestDropRarity: 'RARE', rareDiscoveryCount: 0,
    reward: rewardWithoutDiscoveries(createEmptyExpeditionReward()),
  });
  if (reward.rareDiscoveries.length > 0) events.push({
    reportId: `${run.expeditionId}:${cycle}:discovery`, expeditionId: run.expeditionId, cycle, completedAt, offsetMs,
    kind: 'DISCOVERY', title: 'Rare resonance detected', detail: reward.rareDiscoveries.map((entry) => entry.speciesId).join(', '),
    successScore, battleWon: null, miningYield: 0, equipmentDropId: null, equipmentDropSeed: null, bestDropRarity: reward.rareDiscoveries[0]?.hintedRarity ?? null, rareDiscoveryCount: reward.rareDiscoveries.length,
    reward: rewardWithoutDiscoveries(createEmptyExpeditionReward()),
  });
  if (eventEncountered || mutationEncountered) events.push({
    reportId: `${run.expeditionId}:${cycle}:event`, expeditionId: run.expeditionId, cycle, completedAt, offsetMs,
    kind: 'EVENT', title: mutationEncountered ? 'Mutation trace recorded' : 'Field event resolved', detail: mutationEncountered ? 'The team archived an unstable geological signature.' : 'A local anomaly yielded bonus resources.',
    successScore, battleWon: null, miningYield: 0, equipmentDropId: null, equipmentDropSeed: null, bestDropRarity: mutationEncountered ? 'SSR' : null, rareDiscoveryCount: 0,
    reward: rewardWithoutDiscoveries(createEmptyExpeditionReward()),
  });
  return {
    reward,
    events,
    summary: { battles: 1, wins: battleWon ? 1 : 0, miningYield, rareDiscoveries: reward.rareDiscoveries.length, equipmentDrops: equipmentDropped ? 1 : 0, bestDropRarity: bestRarity(equipmentRarity, reward.rareDiscoveries[0]?.hintedRarity ?? null) },
  };
};

const appendReports = (run: ExpeditionRun, events: readonly ExpeditionReportEvent[]): void => {
  run.reportEvents.push(...events);
  if (run.reportEvents.length > MAX_EXPEDITION_REPORT_EVENTS) run.reportEvents.splice(0, run.reportEvents.length - MAX_EXPEDITION_REPORT_EVENTS);
};

export const advanceExpeditions = (state: GameState, now: Date): AdvanceExpeditionResult => {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('Expedition clock returned an invalid date');
  let cyclesProcessed = 0;
  let capped = false;
  const reports: ExpeditionReportEvent[] = [];
  for (const expeditionId of state.expeditions.order) {
    const run = state.expeditions.runs[expeditionId];
    if (!run || run.status !== 'ACTIVE') continue;
    const nextMs = Date.parse(run.nextCompletionAt);
    const previousMs = Date.parse(run.lastSimulatedAt);
    if (!Number.isFinite(nextMs) || !Number.isFinite(previousMs)) throw new Error('Expedition contains an invalid timestamp');
    if (nowMs < previousMs || nowMs < nextMs) continue;
    const rawCycles = Math.floor((nowMs - nextMs) / run.durationMs) + 1;
    const thirtyDayCycles = Math.max(1, Math.floor(MAX_EXPEDITION_OFFLINE_MS / run.durationMs));
    const allowedCycles = Math.min(MAX_EXPEDITION_CYCLES_PER_ADVANCE, thirtyDayCycles);
    const dueBySchedule = run.repeat ? Math.min(rawCycles, allowedCycles) : 1;
    const dueCycles = Math.min(dueBySchedule, Number.MAX_SAFE_INTEGER - run.completedCycles);
    const discarded = run.repeat && rawCycles > dueCycles;
    capped ||= discarded;
    if (run.completedCycles >= Number.MAX_SAFE_INTEGER) {
      capped = true;
      run.lastSimulatedAt = now.toISOString();
      run.nextCompletionAt = new Date(nowMs + run.durationMs).toISOString();
      continue;
    }
    let processedForRun = 0;
    let discoveryStorageBlocked = false;
    simulationChunks: for (let offset = 0; offset < dueCycles; offset += 128) {
      const chunkEnd = Math.min(dueCycles, offset + 128);
      for (let index = offset; index < chunkEnd; index += 1) {
        const cycle = run.completedCycles + 1;
        const completionMs = nextMs + index * run.durationMs;
        const needsResearchBootstrap = REGION_BY_ID[run.regionId]?.requiredGuildLevel === 1
          && state.inventory.currencies.researchCores === 0
          && state.research.slot === null
          && state.research.completedProjectIds.length === 0
          && !Object.values(state.expeditions.runs).some((candidate) => candidate.expeditionStorage.researchCores > 0);
        const result = simulateCycle(run, cycle, completionMs, needsResearchBootstrap);
        // Never truncate a discovered Stone. A repeat expedition stops at the
        // exact unprocessed cycle until the player claims its current Storage.
        // This keeps the save bounded without converting overflow into loss.
        if (run.expeditionStorage.rareDiscoveries.length + result.reward.rareDiscoveries.length > MAX_PENDING_RARE_DISCOVERIES) {
          discoveryStorageBlocked = true;
          capped = true;
          break simulationChunks;
        }
        addReward(run.expeditionStorage, result.reward);
        appendReports(run, result.events);
        reports.push(...result.events);
        if (reports.length > MAX_EXPEDITION_REPORT_EVENTS) reports.splice(0, reports.length - MAX_EXPEDITION_REPORT_EVENTS);
        run.completedCycles = saturatingAdd(run.completedCycles, 1, Number.MAX_SAFE_INTEGER);
        run.reportSummary.battles = saturatingAdd(run.reportSummary.battles, result.summary.battles, Number.MAX_SAFE_INTEGER);
        run.reportSummary.wins = saturatingAdd(run.reportSummary.wins, result.summary.wins, Number.MAX_SAFE_INTEGER);
        run.reportSummary.miningYield = saturatingAdd(run.reportSummary.miningYield, result.summary.miningYield, Number.MAX_SAFE_INTEGER);
        run.reportSummary.rareDiscoveries = saturatingAdd(run.reportSummary.rareDiscoveries, result.summary.rareDiscoveries, Number.MAX_SAFE_INTEGER);
        run.reportSummary.equipmentDrops = saturatingAdd(run.reportSummary.equipmentDrops, result.summary.equipmentDrops, Number.MAX_SAFE_INTEGER);
        run.reportSummary.bestDropRarity = bestRarity(run.reportSummary.bestDropRarity, result.summary.bestDropRarity);
        state.expeditions.totalCycles = saturatingAdd(state.expeditions.totalCycles, 1, Number.MAX_SAFE_INTEGER);
        cyclesProcessed += 1;
        processedForRun += 1;
      }
    }
    if (discoveryStorageBlocked) {
      if (processedForRun > 0) run.lastSimulatedAt = new Date(nextMs + (processedForRun - 1) * run.durationMs).toISOString();
      run.nextCompletionAt = new Date(nextMs + processedForRun * run.durationMs).toISOString();
    } else {
      run.lastSimulatedAt = now.toISOString();
    }
    if (run.repeat && !discoveryStorageBlocked) run.nextCompletionAt = new Date(discarded ? nowMs + run.durationMs : nextMs + dueCycles * run.durationMs).toISOString();
    else {
      if (discoveryStorageBlocked) continue;
      run.status = 'READY';
      appendReports(run, [{
        reportId: `${run.expeditionId}:return`, expeditionId: run.expeditionId, cycle: run.completedCycles,
        completedAt: new Date(nextMs).toISOString(), offsetMs: Math.min(Number.MAX_SAFE_INTEGER, nextMs - Date.parse(run.startedAt)),
        kind: 'RETURN', title: 'Expedition complete', detail: 'The party returned with rewards ready to claim.', successScore: 100,
        battleWon: null, miningYield: 0, equipmentDropId: null, equipmentDropSeed: null, bestDropRarity: run.reportSummary.bestDropRarity,
        rareDiscoveryCount: run.reportSummary.rareDiscoveries, reward: rewardWithoutDiscoveries(run.expeditionStorage),
      }]);
    }
  }
  return { cyclesProcessed, reports, capped };
};

const safeGrant = (current: number, amount: number): number => saturatingAdd(current, amount, Number.MAX_SAFE_INTEGER);

const registerExpeditionStone = (state: GameState, stone: GameState['stones'][string], clock: Clock): void => {
  state.stones[stone.instanceId] = stone;
  registerStoneInCollection(state, stone);
  if (RARITY_ORDER.indexOf(stone.rarity) >= RARITY_ORDER.indexOf('SSR')) state.statistics.rareDiscoveryCount = safeGrant(state.statistics.rareDiscoveryCount, 1);
  if (stone.mutation !== 'NONE') state.statistics.mutationCount = safeGrant(state.statistics.mutationCount, 1);
  if (isPerfectIv(stone.individualValues) && stone.mutation !== 'PERFECT') state.statistics.mutationCount = safeGrant(state.statistics.mutationCount, 1);
  evaluateAchievements(state, clock);
};

export const claimExpedition = (state: GameState, expeditionId: string, clock: Clock = systemClock): ExpeditionClaimResult => {
  const run = state.expeditions.runs[expeditionId];
  if (!run) throw new Error('Expedition not found');
  const cyclesClaimed = run.completedCycles - run.claimedCycles;
  if (cyclesClaimed <= 0) throw new Error('Expedition has no unclaimed completion');
  const reward = cloneReward(run.expeditionStorage);
  const owner = { accountId: state.account.accountId, username: state.account.username };
  const availableStoneCapacity = Math.max(0, state.inventory.capacity - Object.keys(state.stones).length);
  const discoveriesToCreate = reward.rareDiscoveries.slice(0, availableStoneCapacity);
  const overflow = reward.rareDiscoveries.slice(discoveriesToCreate.length);
  const storageCapacity = Math.max(0, MAX_EXPEDITION_DISCOVERY_STORAGE - state.expeditions.discoveryStorage.length);
  // A full temporary box aborts the entire transactional claim. The rewards
  // remain in Expedition Storage, so a rare discovery is never silently lost.
  if (overflow.length > storageCapacity) throw new Error('Temporary Discovery Storage is full; free a Stone/storage slot before claiming');
  const storedDiscoveries = overflow.map((entry) => ({ ...entry }));
  const discoveredStones = discoveriesToCreate.map((discovery) => {
    const species = SPECIES_BY_ID[discovery.speciesId];
    if (!species) throw new Error(`Unknown expedition species: ${discovery.speciesId}`);
    const discoveryClock: Clock = { now: () => new Date(discovery.discoveredAt) };
    const mutation = parseExpeditionDiscoveryMutation(discovery.seed);
    return generateStone({
      species,
      origin: 'EXPEDITION',
      owner,
      rng: new SeededRng(discovery.seed),
      clock: discoveryClock,
      appraised: true,
      ...(mutation === null ? {} : { mutation }),
    });
  });
  if (new Set(discoveredStones.map((stone) => stone.instanceId)).size !== discoveredStones.length || discoveredStones.some((stone) => state.stones[stone.instanceId])) {
    throw new Error('Expedition discovery ID collision');
  }
  state.inventory.currencies.credits = safeGrant(state.inventory.currencies.credits, reward.credits);
  state.inventory.currencies.upgradeDust = safeGrant(state.inventory.currencies.upgradeDust, reward.upgradeDust);
  state.inventory.currencies.researchCores = safeGrant(state.inventory.currencies.researchCores, reward.researchCores);
  for (const [itemId, amount] of Object.entries(reward.items)) state.inventory.items[itemId] = safeGrant(state.inventory.items[itemId] ?? 0, amount);
  gainAccountXp(state, Math.min(reward.accountXp, Number.MAX_SAFE_INTEGER - state.accountProgress.xp));
  for (const member of run.partySnapshot) {
    const stone = state.stones[member.stoneId];
    if (!stone) continue;
    gainStoneXpWithMastery(stone, state.mastery, reward.stoneXpPerMember);
    gainAffinity(stone, reward.affinityPerMember);
  }
  for (const stone of discoveredStones) {
    registerExpeditionStone(state, stone, clock);
  }
  state.expeditions.discoveryStorage.push(...storedDiscoveries);
  state.profile.totalAffinity = Object.values(state.stones).reduce((sum, stone) => safeGrant(sum, stone.affinity.points), 0);
  const now = clock.now();
  run.claimedCycles = run.completedCycles;
  run.claimCount = saturatingAdd(run.claimCount, 1, Number.MAX_SAFE_INTEGER);
  run.lastClaimedAt = now.toISOString();
  run.expeditionStorage = createEmptyExpeditionReward();
  // A repeat stop leaves the current cycle in flight. Banked earlier cycles
  // may still be claimed without cancelling that final cycle; only a run that
  // has actually returned is released from its occupied slot.
  if (run.status === 'READY') run.status = 'CLAIMED';
  state.expeditions.totalClaims = saturatingAdd(state.expeditions.totalClaims, 1, Number.MAX_SAFE_INTEGER);
  return { expeditionId, cyclesClaimed, reward, discoveredStones, storedDiscoveries, reports: run.reportEvents.map((entry) => ({ ...entry, reward: { ...entry.reward, items: { ...entry.reward.items } } })) };
};

export const claimStoredExpeditionDiscovery = (state: GameState, discoveryId: string, clock: Clock = systemClock): GameState['stones'][string] => {
  if (Object.keys(state.stones).length >= state.inventory.capacity) throw new Error('Stone capacity is full');
  const index = state.expeditions.discoveryStorage.findIndex((entry) => entry.discoveryId === discoveryId);
  if (index < 0) throw new Error('Stored expedition discovery not found');
  const discovery = state.expeditions.discoveryStorage[index]!;
  const species = SPECIES_BY_ID[discovery.speciesId];
  if (!species) throw new Error(`Unknown expedition species: ${discovery.speciesId}`);
  const owner = { accountId: state.account.accountId, username: state.account.username };
  const discoveryClock: Clock = { now: () => new Date(discovery.discoveredAt) };
  const mutation = parseExpeditionDiscoveryMutation(discovery.seed);
  const stone = generateStone({
    species,
    origin: 'EXPEDITION',
    owner,
    rng: new SeededRng(discovery.seed),
    clock: discoveryClock,
    appraised: true,
    ...(mutation === null ? {} : { mutation }),
  });
  if (state.stones[stone.instanceId]) throw new Error('Expedition discovery ID collision');
  registerExpeditionStone(state, stone, clock);
  state.expeditions.discoveryStorage.splice(index, 1);
  return stone;
};
