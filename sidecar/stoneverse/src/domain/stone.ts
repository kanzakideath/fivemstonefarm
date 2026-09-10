import { PERSONALITIES, PERSONALITY_BY_ID, SPECIES_BY_ID, TRAIT_BY_ID } from '../data';
import { XP_CURVES } from '../data/config';
import type {
  Clock,
  EvolutionCondition,
  EvolutionDefinition,
  EvolutionResult,
  IndividualValues,
  LevelGainResult,
  LineageRef,
  Mutation,
  OwnerIdentity,
  Rarity,
  StatKey,
  Stats,
  StoneInstance,
  StoneOrigin,
  StoneSpeciesDefinition,
} from './types';
import type { RandomSource } from './rng';
import { makeId, SeededRng, systemClock } from './rng';

export const STAT_KEYS: readonly StatKey[] = ['hardness', 'purity', 'power', 'defense', 'speed', 'resonance'];

const emptyBattleStatistics = (): StoneInstance['battleStatistics'] => ({
  battles: 0, wins: 0, losses: 0, damageDealt: 0, damageTaken: 0, healingDone: 0,
  criticalHits: 0, enemiesDefeated: 0, ultimatesUsed: 0,
});

export const rarityMultiplier = (rarity: Rarity): number => ({
  NORMAL: 0.92, RARE: 1, SR: 1.08, SSR: 1.18, UR: 1.3, LEGENDARY: 1.47,
})[rarity];

export const stoneMaxLevel = (stone: Pick<StoneInstance, 'limitBreak'>): number => Math.min(120, 100 + stone.limitBreak * 4);

export const lineRef = (stone: StoneInstance): LineageRef => ({
  instanceId: stone.instanceId,
  speciesId: stone.speciesId,
  serialNumber: stone.serialNumber,
  nickname: stone.nickname,
  mutation: stone.mutation,
  colorVariant: stone.colorVariant,
  traitIds: [...stone.traitIds],
});

export interface GenerateStoneOptions {
  species: StoneSpeciesDefinition;
  origin: StoneOrigin;
  owner: OwnerIdentity;
  rng: RandomSource;
  clock?: Clock;
  rarity?: Rarity;
  level?: number;
  mutation?: Mutation;
  personalityId?: string;
  parents?: LineageRef[];
  grandparents?: LineageRef[];
  generation?: number;
  forcedIvs?: Partial<IndividualValues>;
  forcedTraits?: string[];
  forcedSkills?: string[];
  appraised?: boolean;
}

const rollIv = (rng: RandomSource, rarity: Rarity): number => {
  // Two draws favour the middle/lower range; high rarity adds only a small floor so perfect remains exceptional.
  const floor: Record<Rarity, number> = { NORMAL: 0, RARE: 1, SR: 2, SSR: 4, UR: 6, LEGENDARY: 8 };
  const raw = Math.floor((rng.next() + rng.next()) * 16);
  return Math.min(31, Math.max(floor[rarity], raw));
};

export const rollIndividualValues = (
  rng: RandomSource,
  rarity: Rarity,
  forced: Partial<IndividualValues> = {},
): IndividualValues => Object.fromEntries(
  STAT_KEYS.map((key) => [key, Math.max(0, Math.min(31, Math.round(forced[key] ?? rollIv(rng, rarity))))]),
) as unknown as IndividualValues;

export const calculateStoneStats = (stone: Pick<
  StoneInstance,
  'speciesId' | 'level' | 'individualValues' | 'personalityId' | 'potential' | 'awakeningStage' | 'reincarnationCount' | 'limitBreak' | 'mutation' | 'traitIds' | 'learnedSkillNodes'
>): Stats => {
  const species = SPECIES_BY_ID[stone.speciesId];
  if (!species) throw new Error(`Unknown species: ${stone.speciesId}`);
  const personality = PERSONALITY_BY_ID[stone.personalityId];
  if (!personality) throw new Error(`Unknown personality: ${stone.personalityId}`);

  const result = {} as Stats;
  const allKeys = [...STAT_KEYS, 'maxHp'] as const;
  const rarityScale = rarityMultiplier(species.rarity);
  const permanentScale = 1 + stone.potential * 0.0025 + stone.awakeningStage * 0.035 + stone.reincarnationCount * 0.025 + stone.limitBreak * 0.015;
  const mutationScale: Record<Mutation, number> = { NONE: 1, PRISMATIC: 1.035, ANCIENT: 1.04, CORRUPTED: 1.055, PERFECT: 1.075 };

  for (const key of allKeys) {
    const iv = key === 'maxHp' ? Object.values(stone.individualValues).reduce((a, b) => a + b, 0) / 6 : stone.individualValues[key];
    const base = species.growth.base[key] + species.growth.perLevel[key] * Math.max(0, stone.level - 1);
    const ivBonus = key === 'maxHp' ? iv * 1.35 : iv * (0.18 + stone.level * 0.004);
    const nature = personality.statMultipliers[key] ?? 1;
    let value = (base + ivBonus) * rarityScale * permanentScale * mutationScale[stone.mutation] * nature;
    for (const traitId of stone.traitIds) {
      const trait = TRAIT_BY_ID[traitId];
      for (const effect of trait?.effects ?? []) {
        if (effect.trigger !== 'ALWAYS' || effect.stat !== key || effect.value === undefined) continue;
        value = effect.operation === 'FLAT' ? value + effect.value : value * (1 + effect.value);
      }
    }
    for (const node of species.skillTree) {
      if (stone.learnedSkillNodes.includes(node.id)) value += node.statBonus?.[key] ?? 0;
    }
    result[key] = Math.max(1, Math.round(value));
  }
  return result;
};

const rollMutation = (rng: RandomSource, origin: StoneOrigin): Mutation => {
  const rate = origin === 'FUSION' ? 0.012 : origin === 'NATURAL' ? 0.003 : 0.0015;
  if (!rng.chance(rate)) return 'NONE';
  return rng.weighted<Mutation>(['PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'], (mutation) => ({
    NONE: 0, PRISMATIC: 54, ANCIENT: 27, CORRUPTED: 16, PERFECT: 3,
  })[mutation]);
};

export const generateStone = (options: GenerateStoneOptions): StoneInstance => {
  const clock = options.clock ?? systemClock;
  const now = clock.now();
  const timestamp = now.getTime();
  const { species, rng } = options;
  const rarity = options.rarity ?? species.rarity;
  const origin = options.origin;
  const mutation = options.mutation ?? rollMutation(rng, origin);
  const personalityId = options.personalityId ?? rng.pick(PERSONALITIES).id;
  const individualValues = rollIndividualValues(rng, rarity, options.forcedIvs);
  if (mutation === 'PERFECT') for (const key of STAT_KEYS) individualValues[key] = 31;

  const traitCandidates = [...species.traitPool];
  if (origin === 'NATURAL') traitCandidates.push(...species.hiddenTraitPool.filter((id) => TRAIT_BY_ID[id]?.tier === 'NATURAL_EXCLUSIVE'));
  if (origin === 'FUSION') traitCandidates.push('trait_gene_weaver');
  if (mutation === 'PRISMATIC') traitCandidates.push('trait_prism_reflex');
  if (mutation === 'ANCIENT') traitCandidates.push('trait_ancient_oath');
  const targetTraitCount = rarity === 'LEGENDARY' ? 3 : rarity === 'UR' || rarity === 'SSR' ? 2 : 1;
  const traits = options.forcedTraits
    ? [...new Set(options.forcedTraits)].slice(0, 4)
    : rng.shuffle([...new Set(traitCandidates)]).slice(0, targetTraitCount);
  const level = Math.max(1, Math.min(100, Math.floor(options.level ?? 1)));
  const defaultSkills = species.skillPool.filter((entry) => entry.level <= level).slice(0, 4).map((entry) => entry.skillId);
  if (defaultSkills.length === 0 && species.skillPool[0]) defaultSkills.push(species.skillPool[0].skillId);
  const skills = [...new Set(options.forcedSkills ?? defaultSkills)].slice(0, 6).map((skillId) => ({
    skillId,
    level: 1,
    source: origin === 'FUSION' ? 'FUSION' as const : 'NATURAL' as const,
  }));
  const instanceId = makeId('stone', rng, timestamp);
  const stone: StoneInstance = {
    instanceId,
    serialNumber: `${now.getUTCFullYear()}-${species.id.replace('species_', '').toUpperCase()}-${instanceId.slice(-10).toUpperCase()}`,
    speciesId: species.id,
    name: species.name,
    nickname: null,
    rarity,
    origin,
    level,
    xp: 0,
    potential: Math.min(100, Math.round(35 + rng.next() * 55 + rarityMultiplier(rarity) * 5)),
    personalityId,
    primaryElement: species.primaryElement,
    secondaryElement: species.possibleSecondaryElements.length > 0 && rng.chance(0.28) ? rng.pick(species.possibleSecondaryElements) : null,
    stats: {} as Stats,
    individualValues,
    traitIds: traits,
    skills,
    skillPoints: Math.floor(level / 5),
    learnedSkillNodes: [],
    equipment: {},
    affinity: { points: 0, rank: 0, claimedMilestones: [] },
    awakeningStage: 0,
    evolutionStage: 0,
    reincarnationCount: 0,
    limitBreak: 0,
    mutation,
    colorVariant: rng.chance(origin === 'FUSION' ? 0.012 : 0.006) ? 'SHINY' : 'STANDARD',
    parents: options.parents?.slice(0, 4) ?? [],
    grandparents: options.grandparents?.slice(0, 8) ?? [],
    generation: Math.max(0, options.generation ?? 0),
    originalOwner: { ...options.owner },
    currentOwner: { ...options.owner },
    discoverer: { ...options.owner },
    createdAt: now.toISOString(),
    firstObtainedAt: now.toISOString(),
    appraisedAt: options.appraised === false ? null : now.toISOString(),
    battleStatistics: emptyBattleStatistics(),
    favorite: false,
    locked: false,
    tags: [],
  };
  stone.stats = calculateStoneStats(stone);
  return stone;
};

export const gainStoneXp = (stone: StoneInstance, amount: number): LevelGainResult => {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('XP amount must be a non-negative finite number');
  const previousLevel = stone.level;
  const before = { ...stone.stats };
  stone.xp += Math.floor(amount);
  const max = stoneMaxLevel(stone);
  while (stone.level < max) {
    const required = XP_CURVES.stone(stone.level);
    if (stone.xp < required) break;
    stone.xp -= required;
    stone.level += 1;
    stone.skillPoints += stone.level % 5 === 0 ? 1 : 0;
    const species = SPECIES_BY_ID[stone.speciesId];
    for (const entry of species?.skillPool ?? []) {
      if (entry.level === stone.level && !stone.skills.some((skill) => skill.skillId === entry.skillId) && stone.skills.length < 6) {
        stone.skills.push({ skillId: entry.skillId, level: 1, source: 'LEVEL' });
      }
    }
  }
  if (stone.level >= max) stone.xp = Math.min(stone.xp, XP_CURVES.stone(max) - 1);
  stone.stats = calculateStoneStats(stone);
  const statIncrease = Object.fromEntries(
    Object.entries(stone.stats).map(([key, value]) => [key, value - before[key as keyof Stats]]),
  ) as Partial<Stats>;
  return { previousLevel, level: stone.level, xp: stone.xp, levelsGained: stone.level - previousLevel, statIncrease };
};

export const affinityRankForPoints = (points: number): number => {
  const thresholds = [0, 100, 300, 700, 1_400, 2_500, 4_000, 6_000];
  let rank = 0;
  while (rank + 1 < thresholds.length && points >= (thresholds[rank + 1] ?? Number.POSITIVE_INFINITY)) rank += 1;
  return rank;
};

export const gainAffinity = (stone: StoneInstance, amount: number): { previousRank: number; rank: number } => {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Affinity amount must be non-negative');
  const previousRank = stone.affinity.rank;
  stone.affinity.points = Math.min(9_999, stone.affinity.points + Math.floor(amount));
  stone.affinity.rank = affinityRankForPoints(stone.affinity.points);
  return { previousRank, rank: stone.affinity.rank };
};

export interface EvolutionContext {
  items: Record<string, number>;
  areaId?: string;
  achievementIds: string[];
  timestamp?: Date;
  fusionCount: number;
}

export const meetsEvolutionCondition = (
  stone: StoneInstance,
  condition: EvolutionCondition,
  context: EvolutionContext,
): boolean => {
  switch (condition.kind) {
    case 'LEVEL': return stone.level >= Number(condition.value);
    case 'AFFINITY': return stone.affinity.rank >= Number(condition.value);
    case 'BATTLE_COUNT': return stone.battleStatistics.battles >= Number(condition.value);
    case 'ITEM': return (context.items[String(condition.value)] ?? 0) >= (condition.amount ?? 1);
    case 'AREA': return context.areaId === String(condition.value);
    case 'SKILL': return stone.skills.some((skill) => skill.skillId === String(condition.value));
    case 'FUSION_HISTORY': return context.fusionCount >= Number(condition.value);
    case 'ACHIEVEMENT': return context.achievementIds.includes(String(condition.value));
    case 'TIME': {
      const hour = (context.timestamp ?? new Date()).getHours();
      return condition.value === 'NIGHT' ? hour >= 20 || hour < 5 : condition.value === 'DAY' ? hour >= 5 && hour < 20 : true;
    }
  }
};

export const availableEvolutions = (stone: StoneInstance, context: EvolutionContext): EvolutionDefinition[] => {
  const species = SPECIES_BY_ID[stone.speciesId];
  return (species?.evolutions ?? []).filter((evolution) => evolution.conditions.every((condition) => meetsEvolutionCondition(stone, condition, context)));
};

export const evolveStone = (stone: StoneInstance, evolution: EvolutionDefinition): EvolutionResult => {
  const target = SPECIES_BY_ID[evolution.targetSpeciesId];
  if (!target) throw new Error(`Unknown evolution species: ${evolution.targetSpeciesId}`);
  const previousSpeciesId = stone.speciesId;
  stone.speciesId = target.id;
  stone.name = target.name;
  stone.rarity = target.rarity;
  stone.primaryElement = target.primaryElement;
  stone.evolutionStage += 1;
  stone.origin = 'EVOLUTION';
  for (const entry of target.skillPool.filter((candidate) => candidate.level <= stone.level)) {
    if (!stone.skills.some((skill) => skill.skillId === entry.skillId) && stone.skills.length < 6) {
      stone.skills.push({ skillId: entry.skillId, level: 1, source: 'LEVEL' });
    }
  }
  stone.stats = calculateStoneStats(stone);
  return { previousSpeciesId, stone, evolutionId: evolution.id };
};

export const awakenStone = (stone: StoneInstance): void => {
  const species = SPECIES_BY_ID[stone.speciesId];
  if (!species || stone.awakeningStage >= species.maxAwakening) throw new Error('Stone is at maximum awakening');
  if (stone.affinity.rank < Math.min(6, stone.awakeningStage + 1)) throw new Error('Affinity is too low to awaken');
  stone.awakeningStage += 1;
  stone.stats = calculateStoneStats(stone);
};

export const reincarnateStone = (stone: StoneInstance): void => {
  if (stone.level < stoneMaxLevel(stone)) throw new Error('Only a max-level stone may reincarnate');
  stone.level = 1;
  stone.xp = 0;
  stone.reincarnationCount += 1;
  stone.potential = Math.min(100, stone.potential + 3);
  stone.skillPoints += 2;
  stone.stats = calculateStoneStats(stone);
};

export const learnSkillTreeNode = (stone: StoneInstance, nodeId: string): void => {
  const species = SPECIES_BY_ID[stone.speciesId];
  const node = species?.skillTree.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error('Unknown skill node');
  if (stone.learnedSkillNodes.includes(nodeId)) throw new Error('Skill node already learned');
  if (!node.prerequisites.every((required) => stone.learnedSkillNodes.includes(required))) throw new Error('Prerequisite not learned');
  if (stone.skillPoints < node.cost) throw new Error('Not enough skill points');
  stone.skillPoints -= node.cost;
  stone.learnedSkillNodes.push(nodeId);
  if (node.grantsSkillId && !stone.skills.some((skill) => skill.skillId === node.grantsSkillId)) {
    if (stone.skills.length >= 6) throw new Error('No open skill slot');
    stone.skills.push({ skillId: node.grantsSkillId, level: 1, source: 'TREE' });
  }
  stone.stats = calculateStoneStats(stone);
};

export const isPerfectIv = (ivs: IndividualValues): boolean => STAT_KEYS.every((key) => ivs[key] === 31);

export const validateStone = (stone: StoneInstance): string[] => {
  const issues: string[] = [];
  if (!stone.instanceId) issues.push('instanceId is required');
  if (!SPECIES_BY_ID[stone.speciesId]) issues.push(`Unknown species ${stone.speciesId}`);
  if (!PERSONALITY_BY_ID[stone.personalityId]) issues.push(`Unknown personality ${stone.personalityId}`);
  if (stone.level < 1 || stone.level > stoneMaxLevel(stone)) issues.push('Level is out of range');
  if (stone.skills.length > 6) issues.push('Too many skills');
  if (new Set(stone.traitIds).size !== stone.traitIds.length) issues.push('Duplicate traits');
  for (const key of STAT_KEYS) if (stone.individualValues[key] < 0 || stone.individualValues[key] > 31) issues.push(`IV ${key} is out of range`);
  if (stone.parents.some((parent) => parent.instanceId === stone.instanceId)) issues.push('Stone cannot be its own parent');
  return issues;
};

export const createSeedStone = (speciesId: string, owner: OwnerIdentity, seed: string, clock?: Clock): StoneInstance => {
  const species = SPECIES_BY_ID[speciesId];
  if (!species) throw new Error(`Unknown species ${speciesId}`);
  return generateStone({ species, origin: 'EVENT', owner, rng: new SeededRng(seed), clock });
};
