import { XP_CURVES } from '../data';
import { gainStoneXp, stoneMaxLevel } from './stone';
import type { LevelGainResult, StoneInstance } from './types';
import { safeProgressionAdd } from './numberFormat';

export interface MasteryEntry {
  xp: number;
  level: number;
  unlockedRewardIds: string[];
}

export interface MasteryState {
  version: 1;
  stones: Record<string, MasteryEntry>;
  species: Record<string, MasteryEntry>;
  totalXp: number;
}

export interface MasteryGainResult extends LevelGainResult {
  masteryXpGained: number;
  stoneMasteryLevel: number;
  speciesMasteryLevel: number;
}

export const createInitialMasteryState = (): MasteryState => ({ version: 1, stones: {}, species: {}, totalXp: 0 });

const threshold = (level: number): number => Math.max(500, Math.floor(750 * Math.pow(level + 1, 1.24)));

const rewardIds = (level: number): string[] => [
  ...(level >= 2 ? ['lore-entry-1'] : []),
  ...(level >= 5 ? ['profile-badge'] : []),
  ...(level >= 10 ? ['resonance-aura'] : []),
  ...(level >= 20 ? ['minor-passive'] : []),
  ...(level >= 40 ? ['mastery-title'] : []),
];

const grant = (entry: MasteryEntry, amount: number): void => {
  entry.xp = safeProgressionAdd(entry.xp, amount);
  while (entry.level < 10_000) {
    const required = threshold(entry.level);
    if (entry.xp < required) break;
    entry.xp -= required;
    entry.level += 1;
  }
  entry.unlockedRewardIds = rewardIds(entry.level);
};

const ensure = (map: Record<string, MasteryEntry>, id: string): MasteryEntry => map[id] ??= { xp: 0, level: 0, unlockedRewardIds: [] };

const consumedStoneXp = (beforeLevel: number, beforeXp: number, afterLevel: number, afterXp: number): number => {
  if (afterLevel === beforeLevel) return Math.max(0, afterXp - beforeXp);
  let consumed = Math.max(0, XP_CURVES.stone(beforeLevel) - beforeXp);
  for (let level = beforeLevel + 1; level < afterLevel; level += 1) consumed = safeProgressionAdd(consumed, XP_CURVES.stone(level));
  return safeProgressionAdd(consumed, afterXp);
};

/**
 * Converts XP which cannot become base levels into permanent, non-resetting
 * mastery. Mastery unlocks identity rewards and only a capped minor passive.
 */
export const gainStoneXpWithMastery = (
  stone: StoneInstance,
  mastery: MasteryState,
  amount: number,
): MasteryGainResult => {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('XP amount must be finite and non-negative');
  const awarded = Math.floor(amount);
  const beforeLevel = stone.level;
  const beforeXp = stone.xp;
  const alreadyMax = stone.level >= stoneMaxLevel(stone);
  const result = gainStoneXp(stone, awarded);
  const consumed = alreadyMax ? 0 : Math.min(awarded, consumedStoneXp(beforeLevel, beforeXp, stone.level, stone.xp));
  const overflow = Math.max(0, awarded - consumed);
  const stoneEntry = ensure(mastery.stones, stone.instanceId);
  const speciesEntry = ensure(mastery.species, stone.speciesId);
  if (overflow > 0) {
    grant(stoneEntry, overflow);
    grant(speciesEntry, Math.max(1, Math.floor(overflow * 0.35)));
    mastery.totalXp = safeProgressionAdd(mastery.totalXp, overflow);
  }
  return { ...result, masteryXpGained: overflow, stoneMasteryLevel: stoneEntry.level, speciesMasteryLevel: speciesEntry.level };
};

/** Minor combat bonus stays capped so mastery cannot create runaway stats. */
export const masteryPassiveMultiplier = (entry: MasteryEntry | undefined): number => 1 + Math.min(0.05, (entry?.level ?? 0) * 0.0025);

export const validateMasteryState = (value: unknown): MasteryState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid mastery state');
  const state = value as Record<string, unknown>;
  if (state.version !== 1 || !Number.isSafeInteger(state.totalXp) || (state.totalXp as number) < 0) throw new Error('Invalid mastery state header');
  for (const field of ['stones', 'species'] as const) {
    const map = state[field];
    if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map as object).length > 100_000) throw new Error(`Invalid mastery ${field}`);
    for (const [id, raw] of Object.entries(map as Record<string, unknown>)) {
      if (!id || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Invalid mastery entry ${id}`);
      const entry = raw as Record<string, unknown>;
      if (!Number.isSafeInteger(entry.xp) || (entry.xp as number) < 0 || !Number.isSafeInteger(entry.level) || (entry.level as number) < 0 || (entry.level as number) > 10_000) throw new Error(`Invalid mastery progression ${id}`);
      if (!Array.isArray(entry.unlockedRewardIds) || entry.unlockedRewardIds.length > 16 || entry.unlockedRewardIds.some((reward) => typeof reward !== 'string')) throw new Error(`Invalid mastery rewards ${id}`);
    }
  }
  return value as MasteryState;
};
