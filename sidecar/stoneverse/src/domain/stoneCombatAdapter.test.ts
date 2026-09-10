import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './state';
import { buildStoneCombatSkillBook, stoneToAdvancedCombatant } from './stoneCombatAdapter';

describe('real Stone to advanced combat adapter', () => {
  it('carries actual stats, affinity, mutation, lineage and learned skills', () => {
    const state = createInitialGameState({ seed: 'adapter', accountId: 'adapter', username: 'Adapter' });
    const stone = Object.values(state.stones)[0]!;
    stone.affinity.rank = 3;
    stone.mutation = 'PERFECT';
    stone.parents = [{ instanceId: 'parent', speciesId: 'species_quartzling', serialNumber: 'SV-P', nickname: null, mutation: 'NONE', colorVariant: 'STANDARD', traitIds: [] }];
    const unit = stoneToAdvancedCombatant(stone);
    const skills = buildStoneCombatSkillBook([stone]);
    expect(unit.family).toBe('lineage:species_quartzling');
    expect(unit.stats.maxHp).toBeGreaterThan(stone.stats.maxHp);
    expect(unit.skillIds.every((id) => Boolean(skills[id]))).toBe(true);
    expect(unit.stats.accuracy).toBeGreaterThan(0);
    expect(Number.isFinite(unit.stats.breakPower)).toBe(true);
  });

  it('applies exact Endless affixes and multi-piece set bonuses to real combat stats', () => {
    const state = createInitialGameState({ seed: 'adapter-equipment' });
    const stone = Object.values(state.stones)[0]!;
    const baseline = stoneToAdvancedCombatant(stone);
    const slots = ['CORE', 'RUNE', 'RELIC', 'CHARM'] as const;
    for (const [index, slot] of slots.entries()) {
      stone.equipment[slot] = {
        instanceId: `abyssal-${slot}`,
        definitionId: `ABYSSAL_${slot}`,
        slot,
        level: 20,
        rarity: 'SSR',
        setId: 'ABYSSAL',
        locked: false,
        affixes: index === 0 ? [{ stat: 'power', operation: 'FLAT', value: 500, sourceStat: 'attack' }] : [],
      };
    }

    const equipped = stoneToAdvancedCombatant(stone);
    expect(equipped.stats.attack).toBeGreaterThan((baseline.stats.attack + 500) * 1.17);
    expect(equipped.stats.breakPower).toBeGreaterThan(baseline.stats.breakPower * 1.14);
  });
});
