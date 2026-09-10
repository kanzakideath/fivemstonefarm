import { describe, expect, it } from 'vitest';
import { getTurnOrder, getUsableSkills } from '../domain/advanced';
import { SeededRng } from '../domain/rng';
import { createInitialGameState } from '../domain/state';
import { stoneToAdvancedCombatant } from '../domain/stoneCombatAdapter';
import type { Clock } from '../domain/types';
import { MemoryStorageAdapter } from './persistence';
import { createStoneverseStore } from './stoneverseStore';

const clock: Clock = { now: () => new Date('2026-09-10T06:00:00.000Z') };

describe('advanced dungeon store integration', () => {
  it('builds all three combatants from real Stone skills, traits, element, equipment sets and lineage', () => {
    const initial = createInitialGameState({ seed: 'dungeon-real-party', clock });
    const stone = Object.values(initial.stones)[0]!;
    stone.traitIds = ['trait_keen_edge'];
    stone.parents = [{ instanceId: 'lineage-parent', speciesId: 'species_quartzling', serialNumber: 'SV-LINE', nickname: null, mutation: 'NONE', colorVariant: 'STANDARD', traitIds: [] }];
    for (const slot of ['CORE', 'RUNE', 'RELIC', 'CHARM'] as const) stone.equipment[slot] = {
      instanceId: `set-${slot}`, definitionId: `ABYSSAL_${slot}`, slot, level: 20, rarity: 'SSR', setId: 'ABYSSAL', locked: false,
      affixes: slot === 'CORE' ? [{ stat: 'power', operation: 'FLAT', value: 250, sourceStat: 'attack' }] : [],
    };
    const expected = stoneToAdvancedCombatant(stone);
    const store = createStoneverseStore({ initialState: initial, storage: null, autoSave: false, clock, rng: new SeededRng('real-party') });

    const battle = store.getState().startDungeonBattle('dungeon_echoing_depths', 'echo_1');
    const actual = battle.advanced!.units.find((unit) => unit.id === `player_${stone.instanceId}`)!;

    expect(battle.advanced!.units.filter((unit) => unit.side === 'PLAYER')).toHaveLength(3);
    expect(actual.stats).toEqual(expected.stats);
    expect(actual.skillIds).toEqual(expected.skillIds);
    expect(actual.family).toBe('lineage:species_quartzling');
    expect(actual.element).toBe(stone.primaryElement);
    expect(actual.stats.attack).toBeGreaterThan(stone.stats.power + 250);
  });

  it('reloads a manual turn, completes it with auto, ignores speed for logic and settles once', () => {
    const storage = new MemoryStorageAdapter();
    let store = createStoneverseStore({ storage, clock, rng: new SeededRng('dungeon-persist'), newGame: { seed: 'dungeon-persist' } });
    store.getState().startDungeonBattle('dungeon_echoing_depths', 'echo_1');
    const started = store.getState().game.activeBattle!;
    const actorId = getTurnOrder(started.advanced!).find((id) => started.advanced!.units.find((unit) => unit.id === id)?.side === 'PLAYER')!;
    const skillId = getUsableSkills(started.advanced!, actorId)[0]!.id;
    store.getState().issueBattleCommand(skillId);
    const afterManual = store.getState().game.activeBattle!;
    const persistedSnapshot = JSON.stringify(afterManual.advanced);
    expect(afterManual.turn).toBe(1);
    expect(afterManual.advanced!.log.some((entry) => entry.actorId === actorId && entry.skillId === skillId)).toBe(true);

    store = createStoneverseStore({ storage, clock, rng: new SeededRng('dungeon-after-reload') });
    expect(JSON.stringify(store.getState().game.activeBattle!.advanced)).toBe(persistedSnapshot);
    store.getState().setBattleSpeed(4);
    expect(JSON.stringify(store.getState().game.activeBattle!.advanced)).toBe(persistedSnapshot);
    store.getState().setBattleSpeed(2);
    expect(JSON.stringify(store.getState().game.activeBattle!.advanced)).toBe(persistedSnapshot);
    store.getState().setBattleAuto(true);
    const creditsBefore = store.getState().game.inventory.currencies.credits;
    const finished = store.getState().runActiveBattle();
    expect(finished.winner).not.toBeNull();
    expect(store.getState().game.battleHistory).toHaveLength(1);
    const creditsAfter = store.getState().game.inventory.currencies.credits;
    const statisticsAfter = { ...store.getState().game.statistics };

    store.getState().runActiveBattle();
    expect(store.getState().game.battleHistory).toHaveLength(1);
    expect(store.getState().game.inventory.currencies.credits).toBe(creditsAfter);
    expect(store.getState().game.statistics).toEqual(statisticsAfter);
    if (finished.winner === 'PLAYER') expect(creditsAfter).toBeGreaterThan(creditsBefore);
  });
});
