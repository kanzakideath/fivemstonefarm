import { describe, expect, it } from 'vitest';
import { RARITY_ORDER } from '../data';
import { pullGacha } from './gacha';
import { SeededRng } from './rng';
import { createInitialGameState } from './state';
import { createSeedStone } from './stone';
import type { Clock } from './types';

const clock: Clock = { now: () => new Date('2026-09-10T02:00:00.000Z') };

describe('gacha guarantees', () => {
  it('honours hard pity and then resets the SSR counter', () => {
    const state = createInitialGameState({ seed: 'pity', clock });
    state.gacha.pityByBanner.banner_genesis = { pullsSinceSsr: 79, lifetimePulls: 79, featuredGuaranteed: false };
    const result = pullGacha(state, 'banner_genesis', 1, new SeededRng('hard-pity'), clock);
    expect(RARITY_ORDER[result.stones[0]!.rarity]).toBeGreaterThanOrEqual(RARITY_ORDER.SSR);
    expect(result.pityAfter.pullsSinceSsr).toBe(0);
    expect(result.history[0]!.pityBefore).toBe(79);
  });

  it('guarantees SR or above in every ten-pull and records all results', () => {
    const state = createInitialGameState({ seed: 'ten-pull', clock });
    const beforeTickets = state.inventory.currencies.gachaTickets;
    const result = pullGacha(state, 'banner_genesis', 10, new SeededRng('ten-pull-result'), clock);
    expect(result.stones).toHaveLength(10);
    expect(result.stones.some((stone) => RARITY_ORDER[stone.rarity] >= RARITY_ORDER.SR)).toBe(true);
    expect(state.gacha.history).toHaveLength(10);
    expect(state.gacha.history[0]?.pullNumber).toBe(10);
    expect(state.gacha.history[9]?.pullNumber).toBe(1);
    expect(result.history[0]?.pullNumber).toBe(1);
    expect(result.history[9]?.pullNumber).toBe(10);
    expect(state.inventory.currencies.gachaTickets).toBe(beforeTickets - 10);
  });

  it('rejects a ten-pull atomically when 499 of 500 Stone slots are occupied', () => {
    const state = createInitialGameState({ seed: 'capacity-ten-pull', clock });
    const owner = { accountId: state.account.accountId, username: state.account.username };
    for (let index = Object.keys(state.stones).length; index < 499; index += 1) {
      const stone = createSeedStone('species_pebblit', owner, `capacity-fill-${index}`, clock);
      state.stones[stone.instanceId] = stone;
    }
    expect(Object.keys(state.stones)).toHaveLength(499);
    expect(state.inventory.capacity).toBe(500);
    const before = JSON.stringify(state);

    expect(() => pullGacha(state, 'banner_genesis', 10, new SeededRng('capacity-rejected'), clock)).toThrow(/capacity/i);
    expect(JSON.stringify(state)).toBe(before);
  });
});
