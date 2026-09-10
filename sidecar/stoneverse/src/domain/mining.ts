import { MINING_AREAS, RARITY_ORDER, SPECIES, XP_CURVES } from '../data';
import type {
  AppraisalResult,
  Clock,
  GameState,
  MiningPayload,
  MiningResult,
  OwnerIdentity,
  StoneInstance,
  StoneSpeciesDefinition,
  UnappraisedFind,
} from './types';
import type { RandomSource } from './rng';
import { makeId, SeededRng, systemClock } from './rng';
import { generateStone, isPerfectIv } from './stone';
import { evaluateAchievements, gainAccountXp } from './economy';

export const FARM_EVENT_MAX_FUTURE_MS = 5 * 60_000;
export const FARM_EVENT_MAX_AGE_MS = 30 * 24 * 60 * 60_000;
export const FARM_METADATA_MAX_BYTES = 16_384;

export interface MiningIngressContext {
  /** Undefined preserves standalone/direct-store behavior; false means an explicitly ended host lifecycle. */
  farmSessionActive?: boolean;
}

export interface MiningIngressValidation {
  valid: boolean;
  reason?: string;
  amount?: number;
  quality?: number;
  sourceTimestamp?: string;
  metadata?: Record<string, unknown>;
}

const cloneJsonMetadata = (metadata: unknown): Record<string, unknown> | undefined => {
  if (metadata === undefined) return undefined;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Mining metadata must be an object');
  let serialized: string;
  try {
    serialized = JSON.stringify(metadata);
  } catch {
    throw new Error('Mining metadata must be JSON serializable');
  }
  const byteLength = typeof TextEncoder === 'function'
    ? new TextEncoder().encode(serialized).byteLength
    : utf8ByteLengthFallback(serialized);
  if (byteLength > FARM_METADATA_MAX_BYTES) throw new Error('Mining metadata exceeds the 16 KB limit');
  const cloned = JSON.parse(serialized) as unknown;
  if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) throw new Error('Mining metadata must be a JSON object');
  return cloned as Record<string, unknown>;
};

const utf8ByteLengthFallback = (value: string): number => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index)!;
    if (codePoint > 0xffff) index += 1;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
};

/** Validates all untrusted Farm ingress before any reward-bearing state is touched. */
export const validateMiningIngress = (
  state: Pick<GameState, 'online'>,
  payload: MiningPayload,
  clock: Clock = systemClock,
  context: MiningIngressContext = {},
): MiningIngressValidation => {
  if (context.farmSessionActive === false) return { valid: false, reason: 'Farm session is not active' };
  if (typeof payload.eventId !== 'string' || !payload.eventId.trim() || payload.eventId.length > 128) return { valid: false, reason: 'Mining eventId must be 1-128 characters' };
  if (payload.sessionId !== undefined && (typeof payload.sessionId !== 'string' || payload.sessionId !== state.online.sessionId)) return { valid: false, reason: 'Mining sessionId does not match the active session' };
  if (payload.amount !== undefined && (typeof payload.amount !== 'number' || !Number.isSafeInteger(payload.amount))) return { valid: false, reason: 'Mining amount must be an integer' };
  const amount = payload.amount ?? 1;
  if (amount < 1 || amount > 100) return { valid: false, reason: 'Mining amount is outside the accepted range' };
  if (payload.quality !== undefined && (typeof payload.quality !== 'number' || !Number.isFinite(payload.quality))) return { valid: false, reason: 'Mining quality must be finite' };
  const quality = payload.quality ?? 0.5;
  if (quality < 0 || quality > 1) return { valid: false, reason: 'Mining quality must be between 0 and 1' };
  const now = clock.now().getTime();
  let timestamp = now;
  if (payload.timestamp !== undefined) {
    if (typeof payload.timestamp !== 'string') return { valid: false, reason: 'Mining timestamp must be a string' };
    timestamp = Date.parse(payload.timestamp);
    if (!Number.isFinite(timestamp)) return { valid: false, reason: 'Mining timestamp is invalid' };
    if (timestamp - now > FARM_EVENT_MAX_FUTURE_MS) return { valid: false, reason: 'Mining timestamp is too far in the future' };
    if (now - timestamp > FARM_EVENT_MAX_AGE_MS) return { valid: false, reason: 'Mining timestamp is too old' };
  }
  try {
    return { valid: true, amount, quality, sourceTimestamp: new Date(timestamp).toISOString(), metadata: cloneJsonMetadata(payload.metadata) };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
};

const unlockMiningContent = (state: GameState): void => {
  for (const area of MINING_AREAS) {
    if (state.mining.level >= area.unlockLevel && !state.mining.unlockedAreas.includes(area.id)) state.mining.unlockedAreas.push(area.id);
    if (state.mining.level >= area.unlockLevel) {
      for (const vein of area.veins) if (!state.mining.unlockedVeins.includes(vein)) state.mining.unlockedVeins.push(vein);
    }
  }
};

const grantMiningXp = (state: GameState, amount: number): number => {
  const previousLevel = state.mining.level;
  state.mining.xp += Math.max(0, Math.floor(amount));
  while (state.mining.level < 100) {
    const needed = XP_CURVES.mining(state.mining.level);
    if (state.mining.xp < needed) break;
    state.mining.xp -= needed;
    state.mining.level += 1;
  }
  unlockMiningContent(state);
  return state.mining.level - previousLevel;
};

const markProcessed = (state: GameState, payload: MiningPayload, clock: Clock): void => {
  // defineProperty safely handles hostile-but-valid keys such as "__proto__".
  Object.defineProperty(state.mining.processedFarmEventIds, payload.eventId, {
    value: true,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  void clock;
};

export const applyMiningEvent = (
  state: GameState,
  payload: MiningPayload,
  rng: RandomSource,
  clock: Clock = systemClock,
  context: MiningIngressContext = {},
): MiningResult => {
  const ingress = validateMiningIngress(state, payload, clock, context);
  if (!ingress.valid) {
    return { accepted: false, duplicate: false, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 };
  }
  if (Object.prototype.hasOwnProperty.call(state.mining.processedFarmEventIds, payload.eventId)) {
    return { accepted: false, duplicate: true, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 };
  }
  const amount = ingress.amount as number;
  const quality = ingress.quality as number;
  const requestedArea = MINING_AREAS.find((candidate) => candidate.id === payload.areaId);
  const area = requestedArea && state.mining.unlockedAreas.includes(requestedArea.id) ? requestedArea : MINING_AREAS[0];
  if (!area) throw new Error('Mining area configuration is missing');
  const discoveries: UnappraisedFind[] = [];
  const discoveryChance = Math.min(0.6, area.discoveryRate + quality * 0.08 + state.mining.level * 0.0007);
  const now = clock.now();
  for (let index = 0; index < amount; index += 1) {
    if (!rng.chance(discoveryChance)) continue;
    const discoveryRng = rng.fork(`${payload.eventId}:${index}`);
    const rarityRoll = discoveryRng.next() / (area.rarityBias + quality * 0.25);
    const hintedRarity = rarityRoll < 0.00008 ? 'LEGENDARY'
      : rarityRoll < 0.0018 ? 'UR'
        : rarityRoll < 0.013 ? 'SSR'
          : rarityRoll < 0.09 ? 'SR'
            : rarityRoll < 0.35 ? 'RARE'
              : 'NORMAL';
    discoveries.push({
      discoveryId: makeId('discovery', discoveryRng, now.getTime() + index),
      seed: `${payload.eventId}:${state.account.accountId}:${index}:${Math.floor(discoveryRng.next() * 1e12)}`,
      veinId: payload.veinId && state.mining.unlockedVeins.includes(payload.veinId) ? payload.veinId : area.veins[0],
      areaId: area.id,
      discoveredAt: now.toISOString(),
      hintedRarity,
      sourceEventId: payload.eventId,
    });
  }
  const xpGranted = amount * (10 + Math.round(quality * 8));
  const creditsGranted = amount * (8 + Math.round(quality * 7));
  state.mining.totalMined += amount;
  state.mining.dailyMined += amount;
  state.mining.weeklyMined += amount;
  state.mining.monthlyMined += amount;
  state.mining.lastMinedAt = now.toISOString();
  state.unappraisedFinds.push(...discoveries);
  state.inventory.currencies.credits += creditsGranted;
  const miningLevelsGained = grantMiningXp(state, xpGranted);
  gainAccountXp(state, Math.ceil(xpGranted * 0.35));
  markProcessed(state, payload, clock);
  evaluateAchievements(state, clock);
  return { accepted: true, duplicate: false, xpGranted, creditsGranted, discoveries, miningLevelsGained };
};

const chooseNaturalSpecies = (
  state: GameState,
  find: UnappraisedFind,
  rng: RandomSource,
): StoneSpeciesDefinition => {
  const targetOrder = RARITY_ORDER[find.hintedRarity];
  let candidates = SPECIES.filter((species) => species.naturalWeight > 0 && species.minMiningLevel <= state.mining.level);
  // The appraisal hint is meaningful but not a promise except for legendary resonance.
  if (find.hintedRarity === 'LEGENDARY') {
    const legendary = candidates.filter((species) => species.rarity === 'LEGENDARY');
    if (legendary.length > 0) candidates = legendary;
  } else {
    const bounded = candidates.filter((species) => RARITY_ORDER[species.rarity] <= targetOrder + 1);
    if (bounded.length > 0) candidates = bounded;
  }
  if (candidates.length === 0) candidates = SPECIES.filter((species) => species.naturalWeight > 0 && species.minMiningLevel <= 1);
  return rng.weighted(candidates, (species) => {
    const distance = Math.abs(RARITY_ORDER[species.rarity] - targetOrder);
    return species.naturalWeight / (1 + distance * distance * 3);
  });
};

export const registerStoneInCollection = (state: GameState, stone: StoneInstance): boolean => {
  const isNewSpecies = !state.collection.discoveredSpeciesIds.includes(stone.speciesId);
  if (isNewSpecies) state.collection.discoveredSpeciesIds.push(stone.speciesId);
  const mutations = state.collection.mutationSpecies[stone.speciesId] ?? [];
  if (!mutations.includes(stone.mutation)) mutations.push(stone.mutation);
  state.collection.mutationSpecies[stone.speciesId] = mutations;
  const variants = state.collection.variantSpecies[stone.speciesId] ?? [];
  if (!variants.includes(stone.colorVariant)) variants.push(stone.colorVariant);
  state.collection.variantSpecies[stone.speciesId] = variants;
  state.collection.origins[stone.origin] = (state.collection.origins[stone.origin] ?? 0) + 1;
  return isNewSpecies;
};

export const appraiseDiscovery = (
  state: GameState,
  discoveryId: string,
  clock: Clock = systemClock,
): AppraisalResult => {
  const index = state.unappraisedFinds.findIndex((find) => find.discoveryId === discoveryId);
  if (index < 0) throw new Error('Discovery not found or already appraised');
  if (Object.keys(state.stones).length >= state.inventory.capacity) throw new Error('Stone capacity is full');
  const find = state.unappraisedFinds[index] as UnappraisedFind;
  const rng = new SeededRng(find.seed);
  const species = chooseNaturalSpecies(state, find, rng);
  const owner: OwnerIdentity = { accountId: state.account.accountId, username: state.account.username };
  const stone = generateStone({ species, origin: 'NATURAL', owner, rng, clock, appraised: true });
  state.unappraisedFinds.splice(index, 1);
  if (state.stones[stone.instanceId]) throw new Error('Stone ID collision');
  state.stones[stone.instanceId] = stone;
  const isNewSpecies = registerStoneInCollection(state, stone);
  const isNaturalLegendary = stone.rarity === 'LEGENDARY';
  if (RARITY_ORDER[stone.rarity] >= RARITY_ORDER.SSR) state.statistics.rareDiscoveryCount += 1;
  if (stone.mutation !== 'NONE') state.statistics.mutationCount += 1;
  if (isPerfectIv(stone.individualValues)) state.statistics.mutationCount += stone.mutation === 'PERFECT' ? 0 : 1;
  evaluateAchievements(state, clock);
  return { stone, isNewSpecies, isNaturalLegendary };
};
