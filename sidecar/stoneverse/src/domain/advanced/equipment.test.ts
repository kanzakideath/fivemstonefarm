import { describe, expect, it } from 'vitest';
import { SeededRng } from '../rng';
import {
  EQUIPMENT_RARITIES,
  EQUIPMENT_SLOTS,
  addEquipment,
  aggregateEquipmentAffixes,
  calculateSetBonuses,
  createEquipmentInventory,
  createEquipmentLoadout,
  equipItem,
  generateEquipment,
  salvageEquipment,
  shouldKeepEquipment,
  type EquipmentItem,
} from './equipment';

describe('advanced equipment', () => {
  it('generates every Core/Rune/Relic/Charm slot with rarity-scaled random affixes', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      const common = generateEquipment({ level: 50, slot, rarity: 'COMMON' }, new SeededRng(`common:${slot}`));
      const mythic = generateEquipment({ level: 50, slot, rarity: 'MYTHIC' }, new SeededRng(`mythic:${slot}`));
      expect(common.slot).toBe(slot);
      expect(common.affixes).toHaveLength(1);
      expect(mythic.affixes).toHaveLength(6);
      expect(new Set(mythic.affixes.map((affix) => affix.stat)).size).toBe(6);
      expect(Number.isFinite(mythic.score)).toBe(true);
    }
    expect(EQUIPMENT_RARITIES).toHaveLength(6);
  });

  it('is deterministic for a seeded generation context', () => {
    expect(generateEquipment({ level: 125, source: 'boss' }, new SeededRng('drop'))).toEqual(
      generateEquipment({ level: 125, source: 'boss' }, new SeededRng('drop')),
    );
  });

  it('activates two- and four-piece set bonuses', () => {
    const pieces = EQUIPMENT_SLOTS.map((slot) => generateEquipment(
      { level: 40, slot, rarity: 'EPIC', setId: 'BASTION' },
      new SeededRng(`set:${slot}`),
    ));
    expect(calculateSetBonuses(pieces.slice(0, 2))).toEqual([
      expect.objectContaining({ setId: 'BASTION', pieces: 2, stat: 'defense' }),
    ]);
    expect(calculateSetBonuses(pieces)).toEqual([
      expect.objectContaining({ setId: 'BASTION', pieces: 2 }),
      expect.objectContaining({ setId: 'BASTION', pieces: 4 }),
    ]);
    const loadout = createEquipmentLoadout(pieces);
    expect(aggregateEquipmentAffixes(loadout).maxHp).toBeGreaterThan(0);
    const replacement = generateEquipment({ level: 60, slot: 'CORE', rarity: 'LEGENDARY' }, new SeededRng('replacement'));
    expect(equipItem(loadout, replacement).replaced?.slot).toBe('CORE');
  });

  it('applies loot filters and auto-salvages without exceeding capacity', () => {
    const inventory = createEquipmentInventory(4);
    const filter = { minRarity: 'EPIC' as const, autoSalvage: true };
    const common = generateEquipment({ level: 1, rarity: 'COMMON' }, new SeededRng('common'));
    expect(shouldKeepEquipment(common, filter)).toBe(false);
    const filtered = addEquipment(inventory, common, filter);
    expect(filtered.reason).toBe('FILTERED');
    expect(inventory.items).toHaveLength(0);
    expect(inventory.salvageMaterials).toBeGreaterThan(0);

    for (let index = 0; index < 200; index += 1) {
      addEquipment(
        inventory,
        generateEquipment({ level: index + 1, rarity: index % 12 === 0 ? 'MYTHIC' : 'RARE' }, new SeededRng(`bulk:${index}`)),
        { autoSalvage: true },
      );
      expect(inventory.items.length).toBeLessThanOrEqual(inventory.capacity);
    }
    expect(inventory.items).toHaveLength(4);
  });

  it('protects locked items and replaces a lower score item when full', () => {
    const inventory = createEquipmentInventory(1);
    const weak = generateEquipment({ level: 1, rarity: 'COMMON' }, new SeededRng('weak'));
    const strong = generateEquipment({ level: 500, rarity: 'MYTHIC' }, new SeededRng('strong'));
    addEquipment(inventory, weak);
    const replaced = addEquipment(inventory, strong, { autoSalvage: true });
    expect(replaced.reason).toBe('REPLACED');
    expect(inventory.items[0]?.id).toBe(strong.id);
    inventory.items[0]!.locked = true;
    expect(() => salvageEquipment(inventory, strong.id)).toThrow(/cannot be salvaged/);
  });

  it('converts unlocked overflow to materials even when the optional auto-filter is off', () => {
    const inventory = createEquipmentInventory(1);
    const kept = generateEquipment({ level: 10, rarity: 'RARE' }, new SeededRng('overflow-kept'));
    const incoming = generateEquipment({ level: 11, rarity: 'RARE' }, new SeededRng('overflow-incoming'));
    addEquipment(inventory, kept, { autoSalvage: false });

    const overflow = addEquipment(inventory, incoming, { autoSalvage: false });

    expect(overflow).toMatchObject({ accepted: false, reason: 'CAPACITY', salvagedIds: [incoming.id] });
    expect(overflow.materialsGained).toBeGreaterThan(0);
    expect(inventory.items.map((item) => item.id)).toEqual([kept.id]);
    expect(inventory.salvageMaterials).toBe(overflow.materialsGained);
  });

  it('clamps material overflow and rejects NaN or Infinity item values', () => {
    const inventory = createEquipmentInventory(1, Number.MAX_SAFE_INTEGER - 1);
    const valid = generateEquipment({ level: 1_000, rarity: 'MYTHIC' }, new SeededRng('overflow'));
    addEquipment(inventory, valid);
    salvageEquipment(inventory, valid.id);
    expect(inventory.salvageMaterials).toBe(Number.MAX_SAFE_INTEGER);
    const malformed: EquipmentItem = { ...valid, id: 'malformed', score: Number.NaN };
    expect(() => addEquipment(inventory, malformed)).toThrow(/finite/);
    const malformedAffix: EquipmentItem = {
      ...valid,
      id: 'malformed-affix',
      score: 1,
      affixes: [{ ...valid.affixes[0]!, value: Number.POSITIVE_INFINITY }],
    };
    expect(() => addEquipment(inventory, malformedAffix)).toThrow(/finite/);
  });
});
