import { describe, expect, it } from 'vitest';
import { GACHA_BANNERS, RARITY_ORDER } from '../data';
import { createDungeonBattle, runBattleToCompletion } from './battle';
import { rollFusionMutation } from './fusion';
import { sampleGachaRarity } from './gacha';
import { SeededRng } from './rng';
import { createInitialGameState } from './state';
import { rollIndividualValues } from './stone';
import type { Clock } from './types';

const clock: Clock = { now: () => new Date('2026-09-10T08:00:00.000Z') };

describe('large deterministic balance simulations', () => {
  it('simulates 1,000,000 base-rate gacha draws within statistical tolerance', () => {
    const banner = GACHA_BANNERS[0]!;
    const rng = new SeededRng('million-pulls');
    const counts = { NORMAL: 0, RARE: 0, SR: 0, SSR: 0, UR: 0, LEGENDARY: 0 };
    const draws = 1_000_000;
    for (let index = 0; index < draws; index += 1) counts[sampleGachaRarity(banner.rates, rng)] += 1;
    for (const [rarity, expected] of Object.entries(banner.rates)) {
      const observed = counts[rarity as keyof typeof counts] / draws;
      const tolerance = rarity === 'LEGENDARY' ? 0.00018 : rarity === 'UR' ? 0.00045 : 0.002;
      expect(Math.abs(observed - expected)).toBeLessThan(tolerance);
    }
  }, 20_000);

  it('simulates 200,000 fusion mutation rolls and IV genomes', () => {
    const state = createInitialGameState({ seed: 'fusion-simulation', clock });
    const parents = Object.values(state.stones).slice(0, 2);
    const rng = new SeededRng('fusion-200k');
    let mutations = 0;
    let ivTotal = 0;
    const samples = 200_000;
    for (let index = 0; index < samples; index += 1) {
      if (rollFusionMutation(parents, [], rng) !== 'NONE') mutations += 1;
      const ivs = rollIndividualValues(rng, 'SR');
      ivTotal += ivs.power;
    }
    const mutationRate = mutations / samples;
    expect(mutationRate).toBeGreaterThan(0.010);
    expect(mutationRate).toBeLessThan(0.014);
    expect(ivTotal / samples).toBeGreaterThan(14);
    expect(ivTotal / samples).toBeLessThan(17);
  }, 20_000);

  it('runs 100 complete battles without an unresolved or runaway state', () => {
    const outcomes = { PLAYER: 0, ENEMY: 0, DRAW: 0 };
    for (let index = 0; index < 100; index += 1) {
      const state = createInitialGameState({ seed: `battle-state-${index}`, clock });
      const battle = createDungeonBattle(state, 'dungeon_echoing_depths', 'echo_1', new SeededRng(`setup-${index}`), clock);
      runBattleToCompletion(battle, new SeededRng(`fight-${index}`), clock);
      outcomes[battle.winner ?? 'DRAW'] += 1;
      expect(battle.turn).toBeLessThanOrEqual(100);
    }
    expect(outcomes.PLAYER + outcomes.ENEMY + outcomes.DRAW).toBe(100);
    expect(RARITY_ORDER.LEGENDARY).toBeGreaterThan(RARITY_ORDER.SSR);
  }, 20_000);
});

