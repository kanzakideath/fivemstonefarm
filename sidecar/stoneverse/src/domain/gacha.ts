import { GACHA_BANNER_BY_ID, RARITY_ORDER, SPECIES_BY_ID } from '../data';
import { RARITIES } from './types';
import type {
  Clock,
  GameState,
  GachaBannerDefinition,
  GachaHistoryEntry,
  GachaPullResult,
  InventoryCost,
  PityState,
  Rarity,
  StoneSpeciesDefinition,
} from './types';
import type { RandomSource } from './rng';
import { makeId, systemClock } from './rng';
import { spendCost } from './economy';
import { generateStone } from './stone';
import { registerStoneInCollection } from './mining';
import { evaluateAchievements, gainAccountXp } from './economy';

const multiplyCost = (cost: InventoryCost, multiplier: number): InventoryCost => ({
  currencies: Object.fromEntries(Object.entries(cost.currencies ?? {}).map(([key, amount]) => [key, (amount ?? 0) * multiplier])),
  items: Object.fromEntries(Object.entries(cost.items ?? {}).map(([key, amount]) => [key, amount * multiplier])),
});

const rarityAtLeast = (candidate: Rarity, minimum: Rarity): boolean => RARITY_ORDER[candidate] >= RARITY_ORDER[minimum];

export const effectiveGachaRates = (banner: GachaBannerDefinition, pity: PityState): Record<Rarity, number> => {
  const rates = { ...banner.rates };
  const nextPull = pity.pullsSinceSsr + 1;
  if (nextPull >= banner.pity.hard) {
    const highTotal = rates.SSR + rates.UR + rates.LEGENDARY;
    rates.NORMAL = 0;
    rates.RARE = 0;
    rates.SR = 0;
    rates.SSR /= highTotal;
    rates.UR /= highTotal;
    rates.LEGENDARY /= highTotal;
    return rates;
  }
  if (nextPull > banner.pity.softStart) {
    const steps = nextPull - banner.pity.softStart;
    const extraHigh = Math.min(0.75, steps * 0.055);
    const baseHigh = rates.SSR + rates.UR + rates.LEGENDARY;
    const targetHigh = Math.min(0.92, baseHigh + extraHigh);
    const highScale = targetHigh / baseHigh;
    const lowScale = (1 - targetHigh) / (1 - baseHigh);
    rates.SSR *= highScale;
    rates.UR *= highScale;
    rates.LEGENDARY *= highScale;
    rates.NORMAL *= lowScale;
    rates.RARE *= lowScale;
    rates.SR *= lowScale;
  }
  return rates;
};

export const sampleGachaRarity = (rates: Record<Rarity, number>, rng: RandomSource, minimum?: Rarity): Rarity => {
  const eligible = RARITIES.filter((rarity) => !minimum || rarityAtLeast(rarity, minimum));
  return rng.weighted(eligible, (rarity) => rates[rarity]);
};

const chooseSpecies = (
  banner: GachaBannerDefinition,
  rarity: Rarity,
  featuredGuaranteed: boolean,
  rng: RandomSource,
): { species: StoneSpeciesDefinition; featured: boolean } => {
  const exact = banner.pool.filter((entry) => SPECIES_BY_ID[entry.speciesId]?.rarity === rarity);
  const candidates = exact.length > 0 ? exact : banner.pool.filter((entry) => rarityAtLeast(SPECIES_BY_ID[entry.speciesId]?.rarity ?? 'NORMAL', rarity));
  if (candidates.length === 0) throw new Error(`Banner ${banner.id} has no species for ${rarity}`);
  const featured = candidates.filter((entry) => entry.pickup);
  const selectionPool = featuredGuaranteed && featured.length > 0 ? featured : candidates;
  const selected = rng.weighted(selectionPool, (entry) => entry.weight * (entry.pickup ? 1.5 : 1));
  const species = SPECIES_BY_ID[selected.speciesId];
  if (!species) throw new Error(`Unknown gacha species ${selected.speciesId}`);
  return { species, featured: Boolean(selected.pickup) };
};

export const pullGacha = (
  state: GameState,
  bannerId: string,
  count: 1 | 10,
  rng: RandomSource,
  clock: Clock = systemClock,
): GachaPullResult => {
  const banner = GACHA_BANNER_BY_ID[bannerId];
  if (!banner) throw new Error(`Unknown gacha banner: ${bannerId}`);
  if (count !== 1 && count !== 10) throw new Error('Gacha supports only one or ten pulls');
  if (Object.keys(state.stones).length + count > state.inventory.capacity) {
    throw new Error('Stone capacity is full');
  }
  spendCost(state, multiplyCost(banner.singleCost, count));
  const pity: PityState = state.gacha.pityByBanner[bannerId] ?? {
    pullsSinceSsr: 0, lifetimePulls: 0, featuredGuaranteed: false,
  };
  const stones = [];
  const history: GachaHistoryEntry[] = [];
  let hasTenPullGuarantee = false;
  for (let index = 0; index < count; index += 1) {
    const pityBefore = pity.pullsSinceSsr;
    const hardGuaranteed = pity.pullsSinceSsr + 1 >= banner.pity.hard;
    const finalTenSlot = count === 10 && index === 9 && !hasTenPullGuarantee;
    const rates = effectiveGachaRates(banner, pity);
    const rarity = sampleGachaRarity(rates, rng, finalTenSlot ? banner.tenPullGuarantee : undefined);
    if (rarityAtLeast(rarity, banner.tenPullGuarantee)) hasTenPullGuarantee = true;
    const highRarity = rarityAtLeast(rarity, 'SSR');
    const choice = chooseSpecies(banner, rarity, highRarity && pity.featuredGuaranteed, rng);
    const owner = { accountId: state.account.accountId, username: state.account.username };
    const stone = generateStone({ species: choice.species, rarity, origin: 'GACHA', owner, rng, clock });
    if (state.stones[stone.instanceId]) throw new Error('Stone ID collision');
    state.stones[stone.instanceId] = stone;
    registerStoneInCollection(state, stone);
    pity.lifetimePulls += 1;
    if (highRarity) {
      pity.pullsSinceSsr = 0;
      if (banner.pity.featuredGuaranteeAfterLoss) pity.featuredGuaranteed = !choice.featured;
    } else {
      pity.pullsSinceSsr += 1;
    }
    const now = clock.now();
    const entry: GachaHistoryEntry = {
      id: makeId('pull', rng, now.getTime() + index), bannerId, stoneId: stone.instanceId, rarity,
      pullNumber: pity.lifetimePulls, pityBefore, guaranteed: hardGuaranteed || finalTenSlot, createdAt: now.toISOString(),
    };
    stones.push(stone);
    history.push(entry);
    state.gacha.rarityCounts[rarity] = (state.gacha.rarityCounts[rarity] ?? 0) + 1;
  }
  state.gacha.pityByBanner[bannerId] = pity;
  // Persistent history is newest-first. Keep the returned batch in draw order,
  // but put the final draw of a multi-pull at the front of the global log.
  state.gacha.history.unshift(...[...history].reverse());
  if (state.gacha.history.length > 1_000) state.gacha.history.length = 1_000;
  gainAccountXp(state, 8 * count);
  evaluateAchievements(state, clock);
  const highestRarity = stones.reduce<Rarity>((highest, stone) => RARITY_ORDER[stone.rarity] > RARITY_ORDER[highest] ? stone.rarity : highest, 'NORMAL');
  return { stones, history, highestRarity, pityAfter: { ...pity } };
};
