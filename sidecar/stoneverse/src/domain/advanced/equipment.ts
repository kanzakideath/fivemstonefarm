import type { RandomSource } from '../rng';
import type { EquippedItem } from '../types';
import { MAX_COMBAT_VALUE, type CombatStatKey } from './combat';

export const EQUIPMENT_SLOTS = ['CORE', 'RUNE', 'RELIC', 'CHARM'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export const EQUIPMENT_RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'] as const;
export type EquipmentRarity = (typeof EQUIPMENT_RARITIES)[number];
export type EquipmentAffixStat = CombatStatKey;
export type EquipmentBonusStat = EquipmentAffixStat | 'ultimateStart';

export interface EquipmentAffix {
  id: string;
  stat: EquipmentAffixStat;
  /** Ratio for percentage stats; bounded flat value for maxHp/attack/defense. */
  value: number;
  tier: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  level: number;
  setId: EquipmentSetId | null;
  affixes: EquipmentAffix[];
  score: number;
  locked: boolean;
}

export type EquipmentSetId = 'BASTION' | 'RESONANCE' | 'HUNTER' | 'ABYSSAL';

export interface EquipmentSetBonus {
  pieces: number;
  stat: EquipmentBonusStat;
  value: number;
}

export interface EquipmentSetDefinition {
  id: EquipmentSetId;
  name: string;
  bonuses: readonly EquipmentSetBonus[];
}

export const EQUIPMENT_SETS: Readonly<Record<EquipmentSetId, EquipmentSetDefinition>> = {
  BASTION: { id: 'BASTION', name: 'Bastion', bonuses: [{ pieces: 2, stat: 'defense', value: 0.12 }, { pieces: 4, stat: 'maxHp', value: 0.2 }] },
  RESONANCE: { id: 'RESONANCE', name: 'Resonance', bonuses: [{ pieces: 2, stat: 'ultimateStart', value: 12 }, { pieces: 4, stat: 'speed', value: 0.15 }] },
  HUNTER: { id: 'HUNTER', name: 'Hunter', bonuses: [{ pieces: 2, stat: 'critChance', value: 0.1 }, { pieces: 4, stat: 'critDamage', value: 0.35 }] },
  ABYSSAL: { id: 'ABYSSAL', name: 'Abyssal', bonuses: [{ pieces: 2, stat: 'breakPower', value: 0.15 }, { pieces: 4, stat: 'attack', value: 0.18 }] },
};

export interface EquipmentGenerationOptions {
  level: number;
  slot?: EquipmentSlot;
  rarity?: EquipmentRarity;
  setId?: EquipmentSetId | null;
  source?: string;
}

/** Converts a Stone's equipped schema item back into the shared field-inventory model. */
export const equippedItemToAdvancedEquipment = (item: EquippedItem): EquipmentItem => {
  const rarityMap = { NORMAL: 'COMMON', RARE: 'UNCOMMON', SR: 'RARE', SSR: 'EPIC', UR: 'LEGENDARY', LEGENDARY: 'MYTHIC' } as const;
  const sourceMap = { maxHp: 'maxHp', power: 'attack', defense: 'defense', speed: 'speed', purity: 'accuracy', hardness: 'resistance', resonance: 'breakPower' } as const;
  const setId = item.setId ?? (['BASTION', 'RESONANCE', 'HUNTER', 'ABYSSAL'] as const).find((candidate) => item.definitionId.startsWith(`${candidate}_`)) ?? null;
  const rank = ['NORMAL', 'RARE', 'SR', 'SSR', 'UR', 'LEGENDARY'].indexOf(item.rarity) + 1;
  return {
    id: item.instanceId,
    name: item.definitionId.replaceAll('_', ' ').toLowerCase(),
    slot: item.slot,
    rarity: rarityMap[item.rarity],
    level: item.level,
    setId,
    locked: item.locked,
    affixes: item.affixes.map((affix, index) => ({
      id: `${affix.sourceStat ?? affix.stat}:${index}`,
      stat: affix.sourceStat ?? sourceMap[affix.stat],
      value: affix.value,
      tier: Math.max(1, Math.min(10, rank)),
    })),
    score: Math.max(1, Math.round(item.level * 4 + rank * 100 + item.affixes.reduce((sum, affix) => sum + Math.abs(affix.value) * (affix.operation === 'PERCENT' ? 1_000 : 1), 0))),
  };
};

export interface LootFilter {
  minRarity?: EquipmentRarity;
  minScore?: number;
  allowedSlots?: readonly EquipmentSlot[];
  alwaysKeepSets?: readonly EquipmentSetId[];
  autoSalvage?: boolean;
}

export interface EquipmentInventory {
  capacity: number;
  items: EquipmentItem[];
  salvageMaterials: number;
}

export type EquipmentLoadout = Partial<Record<EquipmentSlot, EquipmentItem>>;

export interface EquipResult {
  equipped: EquipmentItem;
  replaced: EquipmentItem | null;
}

export interface InventoryMutationResult {
  accepted: boolean;
  salvagedIds: string[];
  materialsGained: number;
  reason: 'ADDED' | 'FILTERED' | 'REPLACED' | 'CAPACITY' | 'SALVAGED';
}

export interface ActiveSetBonus extends EquipmentSetBonus {
  setId: EquipmentSetId;
}

const MAX_INVENTORY_CAPACITY = 10_000;
const MAX_MATERIALS = Number.MAX_SAFE_INTEGER;
const rarityRank = (rarity: EquipmentRarity): number => EQUIPMENT_RARITIES.indexOf(rarity);
const rarityAffixes: Record<EquipmentRarity, number> = { COMMON: 1, UNCOMMON: 2, RARE: 3, EPIC: 4, LEGENDARY: 5, MYTHIC: 6 };
const affixStats: readonly EquipmentAffixStat[] = ['maxHp', 'attack', 'defense', 'speed', 'accuracy', 'resistance', 'critChance', 'critDamage', 'breakPower'];
const setIds = Object.keys(EQUIPMENT_SETS) as EquipmentSetId[];

const assertFinite = (value: number, label: string, min = 0, max = MAX_COMBAT_VALUE): number => {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${label} must be finite and within ${min}..${max}`);
  return value;
};

const bounded = (value: number, max = MAX_COMBAT_VALUE): number => {
  if (!Number.isFinite(value)) return value > 0 ? max : 0;
  return Math.max(0, Math.min(max, value));
};

const safeMaterialAdd = (left: number, right: number): number => {
  assertFinite(left, 'salvageMaterials', 0, MAX_MATERIALS);
  assertFinite(right, 'materialsGained', 0, MAX_MATERIALS);
  return Math.min(MAX_MATERIALS, left + right);
};

const randomRarity = (level: number, rng: RandomSource): EquipmentRarity => {
  const luck = Math.min(3, Math.log10(level + 1) * 0.45);
  return rng.weighted(EQUIPMENT_RARITIES, (rarity) => {
    const base = [5_000, 2_500, 900, 250, 55, 8][rarityRank(rarity)] ?? 1;
    return base * Math.pow(1 + luck, rarityRank(rarity));
  });
};

const affixValue = (stat: EquipmentAffixStat, level: number, rarity: EquipmentRarity, tier: number, rng: RandomSource): number => {
  const quality = 0.85 + rng.next() * 0.3;
  const rank = rarityRank(rarity) + 1;
  if (stat === 'maxHp') return Math.round(bounded((15 + level * 3.5) * rank * tier * quality));
  if (stat === 'attack' || stat === 'defense') return Math.round(bounded((3 + level * 0.55) * rank * tier * quality));
  const base = stat === 'speed' ? 0.008 : stat === 'critDamage' ? 0.025 : 0.012;
  return Math.round(Math.min(5, base * rank * tier * quality) * 100_000) / 100_000;
};

const calculateEquipmentScore = (affixes: readonly EquipmentAffix[], level: number, rarity: EquipmentRarity): number => {
  const affixScore = affixes.reduce((sum, affix) => {
    const normalized = affix.stat === 'maxHp' ? affix.value / 10 : affix.stat === 'attack' || affix.stat === 'defense' ? affix.value : affix.value * 1_000;
    return bounded(sum + normalized * affix.tier);
  }, 0);
  return Math.round(bounded(affixScore + level * 4 + (rarityRank(rarity) + 1) * 100));
};

const validateItem = (item: EquipmentItem): void => {
  if (!item.id || !item.name || !EQUIPMENT_SLOTS.includes(item.slot) || !EQUIPMENT_RARITIES.includes(item.rarity)) {
    throw new TypeError('Invalid equipment identity');
  }
  assertFinite(item.level, `${item.id}.level`, 1, 1_000_000);
  assertFinite(item.score, `${item.id}.score`);
  if (item.setId && !EQUIPMENT_SETS[item.setId]) throw new RangeError(`Unknown set ${item.setId}`);
  for (const affix of item.affixes) {
    if (!affix.id || !affixStats.includes(affix.stat)) throw new TypeError(`Invalid affix on ${item.id}`);
    assertFinite(affix.value, `${item.id}.${affix.id}.value`);
    assertFinite(affix.tier, `${item.id}.${affix.id}.tier`, 1, 10);
  }
};

export const generateEquipment = (options: EquipmentGenerationOptions, rng: RandomSource): EquipmentItem => {
  const level = Math.floor(assertFinite(options.level, 'equipment.level', 1, 1_000_000));
  const slot = options.slot ?? rng.pick(EQUIPMENT_SLOTS);
  const rarity = options.rarity ?? randomRarity(level, rng);
  if (!EQUIPMENT_SLOTS.includes(slot) || !EQUIPMENT_RARITIES.includes(rarity)) throw new RangeError('Unknown equipment slot or rarity');
  const setId = options.setId === undefined ? (rng.chance(Math.min(0.65, 0.12 + rarityRank(rarity) * 0.08)) ? rng.pick(setIds) : null) : options.setId;
  if (setId && !EQUIPMENT_SETS[setId]) throw new RangeError(`Unknown equipment set ${setId}`);
  const selectedStats = rng.shuffle(affixStats).slice(0, rarityAffixes[rarity]);
  const affixes = selectedStats.map((stat, index): EquipmentAffix => {
    const tier = Math.min(10, 1 + rarityRank(rarity) + rng.int(0, 2));
    return { id: `${stat}:${index}`, stat, value: affixValue(stat, level, rarity, tier, rng), tier };
  });
  const source = (options.source ?? 'mine').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'drop';
  const id = `eq:${source}:${level}:${rng.int(0, 0x7fffffff).toString(36)}:${rng.int(0, 0x7fffffff).toString(36)}`;
  const item: EquipmentItem = {
    id,
    name: `${setId ? EQUIPMENT_SETS[setId].name : rarity.toLowerCase()} ${slot.toLowerCase()}`,
    slot,
    rarity,
    level,
    setId,
    affixes,
    score: calculateEquipmentScore(affixes, level, rarity),
    locked: false,
  };
  validateItem(item);
  return item;
};

export const createEquipmentInventory = (capacity = 300, salvageMaterials = 0): EquipmentInventory => ({
  capacity: Math.floor(assertFinite(capacity, 'inventory.capacity', 1, MAX_INVENTORY_CAPACITY)),
  items: [],
  salvageMaterials: assertFinite(salvageMaterials, 'inventory.salvageMaterials', 0, MAX_MATERIALS),
});

export const shouldKeepEquipment = (item: EquipmentItem, filter: LootFilter = {}): boolean => {
  validateItem(item);
  if (item.locked) return true;
  if (item.setId && filter.alwaysKeepSets?.includes(item.setId)) return true;
  if (filter.allowedSlots && !filter.allowedSlots.includes(item.slot)) return false;
  if (filter.minRarity && rarityRank(item.rarity) < rarityRank(filter.minRarity)) return false;
  if (filter.minScore !== undefined && item.score < assertFinite(filter.minScore, 'lootFilter.minScore')) return false;
  return true;
};

export const equipmentSalvageValue = (item: EquipmentItem): number => {
  validateItem(item);
  return Math.max(1, Math.floor(bounded((rarityRank(item.rarity) + 1) ** 2 * (10 + Math.sqrt(item.level) * 8))));
};

const salvageValueInto = (inventory: EquipmentInventory, item: EquipmentItem): number => {
  const gained = equipmentSalvageValue(item);
  const before = inventory.salvageMaterials;
  inventory.salvageMaterials = safeMaterialAdd(before, gained);
  return inventory.salvageMaterials - before;
};

export const salvageEquipment = (inventory: EquipmentInventory, itemId: string): InventoryMutationResult => {
  const index = inventory.items.findIndex((item) => item.id === itemId);
  if (index < 0) throw new RangeError(`Equipment ${itemId} is not in inventory`);
  const item = inventory.items[index];
  if (!item || item.locked) throw new RangeError(`Equipment ${itemId} cannot be salvaged`);
  inventory.items.splice(index, 1);
  const gained = salvageValueInto(inventory, item);
  return { accepted: false, salvagedIds: [item.id], materialsGained: gained, reason: 'SALVAGED' };
};

/** Never lets `items.length` exceed capacity; incoming overflow is rejected or safely salvaged. */
export const addEquipment = (
  inventory: EquipmentInventory,
  item: EquipmentItem,
  filter: LootFilter = {},
): InventoryMutationResult => {
  validateItem(item);
  assertFinite(inventory.capacity, 'inventory.capacity', 1, MAX_INVENTORY_CAPACITY);
  if (!Number.isSafeInteger(inventory.capacity)) throw new RangeError('inventory.capacity must be a safe integer');
  assertFinite(inventory.salvageMaterials, 'inventory.salvageMaterials', 0, MAX_MATERIALS);
  if (inventory.items.length > inventory.capacity) throw new RangeError('Inventory is already over capacity');
  if (inventory.items.some((existing) => existing.id === item.id)) throw new RangeError(`Duplicate equipment id ${item.id}`);

  if (!shouldKeepEquipment(item, filter) && filter.autoSalvage) {
    const gained = salvageValueInto(inventory, item);
    return { accepted: false, salvagedIds: [item.id], materialsGained: gained, reason: 'FILTERED' };
  }
  if (inventory.items.length < inventory.capacity) {
    inventory.items.push(item);
    return { accepted: true, salvagedIds: [], materialsGained: 0, reason: 'ADDED' };
  }
  // Capacity must never turn a generated drop into nothing. Even with the
  // optional loot filter disabled, an unlocked overflow drop is converted to
  // upgrade material as the final safety valve.
  if (!filter.autoSalvage) {
    if (item.locked) throw new RangeError('Locked equipment cannot enter a full inventory');
    const gained = salvageValueInto(inventory, item);
    return { accepted: false, salvagedIds: [item.id], materialsGained: gained, reason: 'CAPACITY' };
  }

  const replaceable = inventory.items
    .filter((candidate) => !candidate.locked && !(candidate.setId && filter.alwaysKeepSets?.includes(candidate.setId)))
    .sort((left, right) => left.score - right.score || rarityRank(left.rarity) - rarityRank(right.rarity) || left.id.localeCompare(right.id))[0];
  if (!replaceable || replaceable.score >= item.score) {
    const gained = salvageValueInto(inventory, item);
    return { accepted: false, salvagedIds: [item.id], materialsGained: gained, reason: 'CAPACITY' };
  }
  const index = inventory.items.findIndex((candidate) => candidate.id === replaceable.id);
  inventory.items.splice(index, 1, item);
  const gained = salvageValueInto(inventory, replaceable);
  return { accepted: true, salvagedIds: [replaceable.id], materialsGained: gained, reason: 'REPLACED' };
};

export const calculateSetBonuses = (equipped: readonly EquipmentItem[]): ActiveSetBonus[] => {
  const onePerSlot = new Map<EquipmentSlot, EquipmentItem>();
  for (const item of equipped) onePerSlot.set(item.slot, item);
  const counts = new Map<EquipmentSetId, number>();
  for (const item of onePerSlot.values()) {
    validateItem(item);
    if (item.setId) counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  }
  const result: ActiveSetBonus[] = [];
  for (const [setId, count] of counts) {
    for (const bonus of EQUIPMENT_SETS[setId].bonuses) if (count >= bonus.pieces) result.push({ setId, ...bonus });
  }
  return result.sort((left, right) => left.setId.localeCompare(right.setId) || left.pieces - right.pieces);
};

export const createEquipmentLoadout = (items: readonly EquipmentItem[] = []): EquipmentLoadout => {
  const loadout: EquipmentLoadout = {};
  for (const item of items) {
    validateItem(item);
    if (loadout[item.slot]) throw new RangeError(`Duplicate equipped slot ${item.slot}`);
    loadout[item.slot] = item;
  }
  return loadout;
};

export const equipItem = (loadout: EquipmentLoadout, item: EquipmentItem): EquipResult => {
  validateItem(item);
  const replaced = loadout[item.slot] ?? null;
  loadout[item.slot] = item;
  return { equipped: item, replaced };
};

export const unequipItem = (loadout: EquipmentLoadout, slot: EquipmentSlot): EquipmentItem | null => {
  if (!EQUIPMENT_SLOTS.includes(slot)) throw new RangeError(`Unknown equipment slot ${String(slot)}`);
  const removed = loadout[slot] ?? null;
  delete loadout[slot];
  return removed;
};

export const aggregateEquipmentAffixes = (loadout: Readonly<EquipmentLoadout>): Partial<Record<EquipmentBonusStat, number>> => {
  const totals: Partial<Record<EquipmentBonusStat, number>> = {};
  for (const item of Object.values(loadout)) {
    if (!item) continue;
    validateItem(item);
    for (const affix of item.affixes) totals[affix.stat] = bounded((totals[affix.stat] ?? 0) + affix.value);
  }
  for (const bonus of calculateSetBonuses(Object.values(loadout).filter((item): item is EquipmentItem => Boolean(item)))) {
    totals[bonus.stat] = bounded((totals[bonus.stat] ?? 0) + bonus.value);
  }
  return totals;
};
