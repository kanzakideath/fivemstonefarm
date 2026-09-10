import { describe, expect, it } from 'vitest';
import { createDungeonBattle, runBattleRound, runBattleToCompletion, runDungeonManualRound, settleBattle } from './battle';
import { SeededRng } from './rng';
import { createInitialGameState } from './state';
import type { Clock } from './types';

const clock: Clock = { now: () => new Date('2026-09-10T04:00:00.000Z') };

describe('turn battle', () => {
  it('runs by speed/skills to a bounded result and settles rewards only once', () => {
    const state = createInitialGameState({ seed: 'battle', clock });
    const battle = createDungeonBattle(state, 'dungeon_echoing_depths', 'echo_1', new SeededRng('setup'), clock);
    runBattleToCompletion(battle, new SeededRng('turns'), clock);
    expect(battle.winner).not.toBeNull();
    expect(battle.turn).toBeLessThanOrEqual(100);
    expect(battle.actionLog.length).toBeGreaterThan(0);
    settleBattle(state, battle, clock);
    const wins = state.statistics.battleWins;
    const losses = state.statistics.battleLosses;
    settleBattle(state, battle, clock);
    expect(state.battleHistory).toHaveLength(1);
    expect(state.statistics.battleWins).toBe(wins);
    expect(state.statistics.battleLosses).toBe(losses);
  });

  it('records a turn-limit draw without misclassifying it as a loss', () => {
    const state = createInitialGameState({ seed: 'battle-draw', clock });
    const battle = createDungeonBattle(state, 'dungeon_echoing_depths', 'echo_1', new SeededRng('draw-setup'), clock);
    battle.turn = 100;
    battle.winner = 'DRAW';
    battle.finishedAt = clock.now().toISOString();

    settleBattle(state, battle, clock);

    expect(state.statistics.battleWins).toBe(0);
    expect(state.statistics.battleLosses).toBe(0);
    expect(state.battleHistory).toHaveLength(1);
    for (const unit of battle.units.filter((candidate) => candidate.team === 'PLAYER')) {
      expect(state.stones[unit.stoneId]?.battleStatistics.battles).toBe(1);
      expect(state.stones[unit.stoneId]?.battleStatistics.wins).toBe(0);
      expect(state.stones[unit.stoneId]?.battleStatistics.losses).toBe(0);
    }
  });

  it('applies a manual command to the persisted advanced state and lets auto finish that exact encounter', () => {
    const state = createInitialGameState({ seed: 'advanced-manual', clock });
    const battle = createDungeonBattle(state, 'dungeon_echoing_depths', 'echo_1', new SeededRng('setup'), clock);
    const authoritative = battle.advanced!;
    const firstActor = authoritative.units
      .filter((unit) => unit.side === 'PLAYER')
      .sort((left, right) => right.stats.speed - left.stats.speed)[0]!;
    const skillId = firstActor.skillIds[0]!;

    const actions = runDungeonManualRound(battle, skillId, undefined, new SeededRng('manual-command'), clock);

    expect(battle.advanced).toBe(authoritative);
    expect(authoritative.turn).toBe(1);
    expect(authoritative.log.some((entry) => entry.actorId === firstActor.id && entry.skillId === skillId)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);

    runBattleToCompletion(battle, new SeededRng('same-state-auto'), clock);
    expect(battle.advanced).toBe(authoritative);
    expect(battle.winner).not.toBeNull();
    settleBattle(state, battle, clock);
    settleBattle(state, battle, clock);
    expect(state.battleHistory).toHaveLength(1);
  });

  it('keeps advanced AI heal, area and ultimate choices in a real three-Stone dungeon', () => {
    const state = createInitialGameState({ seed: 'advanced-ai', clock });
    const owned = Object.values(state.stones);
    const quartz = owned.find((stone) => stone.speciesId === 'species_quartzling')!;
    const ember = owned.find((stone) => stone.speciesId === 'species_emberite')!;
    quartz.skills.push({ skillId: 'skill_crystal_mend', level: 1, source: 'LEVEL' });
    ember.skills.push({ skillId: 'skill_magma_cataclysm', level: 1, source: 'LEVEL' });
    const battle = createDungeonBattle(state, 'dungeon_echoing_depths', 'echo_1', new SeededRng('setup-ai'), clock);
    const advanced = battle.advanced!;
    const wounded = advanced.units.find((unit) => unit.side === 'PLAYER' && unit.id !== `player_${quartz.instanceId}`)!;
    wounded.hp = 1;
    advanced.units.find((unit) => unit.id === `player_${ember.instanceId}`)!.ultimate = 100;

    runBattleRound(battle, new SeededRng('engine-ai'), clock);

    const heal = advanced.log.find((entry) => entry.skillId === 'skill_crystal_mend');
    const ultimate = advanced.log.find((entry) => entry.skillId === 'skill_magma_cataclysm');
    expect(heal?.resolutions.some((resolution) => resolution.kind === 'HEAL' && resolution.amount > 0)).toBe(true);
    expect(ultimate?.resolutions.filter((resolution) => resolution.kind === 'DAMAGE')).toHaveLength(2);
  });
});
