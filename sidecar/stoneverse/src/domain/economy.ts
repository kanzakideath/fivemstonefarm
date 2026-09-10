import { ACHIEVEMENTS, XP_CURVES } from '../data';
import type {
  AchievementDefinition,
  AchievementMetric,
  Clock,
  Currencies,
  GameState,
  InventoryCost,
  InventoryReward,
} from './types';
import { isPerfectIv } from './stone';
import { systemClock } from './rng';

export const canAfford = (state: Pick<GameState, 'inventory'>, cost: InventoryCost): boolean => {
  for (const [key, amount] of Object.entries(cost.currencies ?? {})) {
    if ((state.inventory.currencies[key as keyof Currencies] ?? 0) < (amount ?? 0)) return false;
  }
  for (const [itemId, amount] of Object.entries(cost.items ?? {})) {
    if ((state.inventory.items[itemId] ?? 0) < amount) return false;
  }
  return true;
};

export const spendCost = (state: Pick<GameState, 'inventory'>, cost: InventoryCost): void => {
  if (!canAfford(state, cost)) throw new Error('Insufficient resources');
  for (const [key, amount] of Object.entries(cost.currencies ?? {})) {
    const currency = key as keyof Currencies;
    state.inventory.currencies[currency] -= amount ?? 0;
  }
  for (const [itemId, amount] of Object.entries(cost.items ?? {})) {
    state.inventory.items[itemId] = Math.max(0, (state.inventory.items[itemId] ?? 0) - amount);
  }
};

export const gainAccountXp = (state: Pick<GameState, 'accountProgress'>, amount: number): number => {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Account XP must be non-negative');
  const start = state.accountProgress.level;
  state.accountProgress.xp += Math.floor(amount);
  while (state.accountProgress.level < 100) {
    const needed = XP_CURVES.account(state.accountProgress.level);
    if (state.accountProgress.xp < needed) break;
    state.accountProgress.xp -= needed;
    state.accountProgress.level += 1;
    state.accountProgress.skillPoints += state.accountProgress.level % 3 === 0 ? 1 : 0;
  }
  return state.accountProgress.level - start;
};

export const grantReward = (state: GameState, reward: InventoryReward): void => {
  for (const [key, amount] of Object.entries(reward.currencies ?? {})) {
    const currency = key as keyof Currencies;
    state.inventory.currencies[currency] += amount ?? 0;
  }
  for (const [itemId, amount] of Object.entries(reward.items ?? {})) {
    state.inventory.items[itemId] = (state.inventory.items[itemId] ?? 0) + amount;
  }
  if (reward.accountXp) gainAccountXp(state, reward.accountXp);
  if (reward.miningXp) state.mining.xp += reward.miningXp;
};

export const achievementMetricValue = (state: GameState, metric: AchievementMetric): number => {
  switch (metric) {
    case 'MINED': return state.mining.totalMined;
    case 'SPECIES_OWNED': return state.collection.discoveredSpeciesIds.length;
    case 'FUSIONS': return state.statistics.fusionCount;
    case 'BATTLE_WINS': return state.statistics.battleWins;
    case 'GACHA_PULLS': return Object.values(state.gacha.pityByBanner).reduce((sum, pity) => sum + pity.lifetimePulls, 0);
    case 'MAX_AFFINITY': return Math.max(0, ...Object.values(state.stones).map((stone) => stone.affinity.rank));
    case 'MUTATIONS': return state.statistics.mutationCount;
    case 'PERFECT_IV': return Object.values(state.stones).filter((stone) => isPerfectIv(stone.individualValues)).length;
    case 'ACCOUNT_LEVEL': return state.accountProgress.level;
  }
};

export const evaluateAchievements = (
  state: GameState,
  clock: Clock = systemClock,
): AchievementDefinition[] => {
  const newlyUnlocked: AchievementDefinition[] = [];
  for (const definition of ACHIEVEMENTS) {
    const progress = state.achievements[definition.id] ?? { value: 0, unlockedAt: null, claimedAt: null };
    progress.value = achievementMetricValue(state, definition.metric);
    if (progress.unlockedAt === null && progress.value >= definition.threshold) {
      progress.unlockedAt = clock.now().toISOString();
      newlyUnlocked.push(definition);
    }
    state.achievements[definition.id] = progress;
  }
  return newlyUnlocked;
};

export const claimAchievement = (state: GameState, achievementId: string, clock: Clock = systemClock): void => {
  const definition = ACHIEVEMENTS.find((entry) => entry.id === achievementId);
  const progress = state.achievements[achievementId];
  if (!definition || !progress?.unlockedAt) throw new Error('Achievement is not unlocked');
  if (progress.claimedAt) throw new Error('Achievement reward already claimed');
  grantReward(state, definition.reward);
  if (definition.reward.titleId && !state.account.ownedTitleIds.includes(definition.reward.titleId)) state.account.ownedTitleIds.push(definition.reward.titleId);
  if (definition.reward.frameId && !state.account.ownedFrameIds.includes(definition.reward.frameId)) state.account.ownedFrameIds.push(definition.reward.frameId);
  progress.claimedAt = clock.now().toISOString();
};

