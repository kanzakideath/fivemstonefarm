import { describe, expect, it } from 'vitest';
import { SeededRng } from '../domain/rng';
import type { Clock } from '../domain/types';
import { createStoneverseStore } from './stoneverseStore';
import { importSave, MemoryStorageAdapter, SAVE_KEY, SAVE_TEMP_KEY } from './persistence';

const startMs = Date.parse('2026-09-10T00:00:00.000Z');
class MutableClock implements Clock {
  constructor(public milliseconds = startMs) {}
  now(): Date { return new Date(this.milliseconds); }
}

class FailOnceStorage extends MemoryStorageAdapter {
  failKey: string | null = null;
  override setItem(key: string, value: string): void {
    if (key === this.failKey) {
      this.failKey = null;
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    }
    super.setItem(key, value);
  }
}

describe('background store transactions', () => {
  it('commits expedition rewards and the claim marker in the same atomic save', () => {
    const clock = new MutableClock();
    const storage = new MemoryStorageAdapter();
    const store = createStoneverseStore({ storage, clock, rng: new SeededRng('atomic-background'), newGame: { seed: 'atomic-background' } });
    const run = store.getState().startExpedition({
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: false,
    });
    clock.milliseconds += 15 * 60 * 1_000;
    expect(store.getState().processBackground()?.expeditionCycles).toBe(1);
    const beforeCredits = store.getState().game.inventory.currencies.credits;
    const result = store.getState().claimExpedition(run.expeditionId);
    const committed = importSave(storage.getItem(SAVE_KEY)!);
    expect(committed.inventory.currencies.credits).toBe(beforeCredits + result.reward.credits);
    expect(committed.expeditions.runs[run.expeditionId]?.status).toBe('CLAIMED');
    for (let replay = 0; replay < 100; replay += 1) expect(() => store.getState().claimExpedition(run.expeditionId)).toThrow(/unclaimed/i);
    expect(store.getState().game.inventory.currencies.credits).toBe(beforeCredits + result.reward.credits);
  });

  it('rolls the complete claim back if atomic persistence fails', () => {
    const clock = new MutableClock();
    const storage = new FailOnceStorage();
    const store = createStoneverseStore({ storage, clock, rng: new SeededRng('claim-quota'), newGame: { seed: 'claim-quota' } });
    const run = store.getState().startExpedition({
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: false,
    });
    clock.milliseconds += 15 * 60 * 1_000;
    store.getState().processBackground();
    const before = store.getState().game;
    storage.failKey = SAVE_TEMP_KEY;
    expect(() => store.getState().claimExpedition(run.expeditionId)).toThrow(/quota/i);
    expect(store.getState().game).toBe(before);
    expect(store.getState().game.expeditions.runs[run.expeditionId]?.status).toBe('READY');
    expect(store.getState().persistenceAvailable).toBe(false);
  });

  it('reschedules a stopped repeat for one final cycle and keeps earlier storage claimable', () => {
    const clock = new MutableClock();
    const storage = new MemoryStorageAdapter();
    const store = createStoneverseStore({ storage, clock, rng: new SeededRng('repeat-stop-store'), newGame: { seed: 'repeat-stop-store' } });
    const run = store.getState().startExpedition({
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: true,
    });
    clock.milliseconds += 45 * 60 * 1_000;
    store.getState().processBackground();

    const finalDueAt = Date.parse(store.getState().game.expeditions.runs[run.expeditionId]!.nextCompletionAt);
    const stopped = store.getState().stopExpedition(run.expeditionId);
    expect(stopped.repeat).toBe(false);
    expect(importSave(storage.getItem(SAVE_KEY)!).expeditions.runs[run.expeditionId]).toMatchObject({ repeat: false, status: 'ACTIVE', completedCycles: 3 });
    expect(store.getState().nextBackgroundDueAtMs()).toBe(finalDueAt);
    expect(store.getState().claimExpedition(run.expeditionId).cyclesClaimed).toBe(3);
    expect(store.getState().game.expeditions.runs[run.expeditionId]?.status).toBe('ACTIVE');
    expect(store.getState().nextBackgroundDueAtMs()).toBe(finalDueAt);

    clock.milliseconds = finalDueAt;
    store.getState().processBackground();
    expect(store.getState().game.expeditions.runs[run.expeditionId]).toMatchObject({ status: 'READY', completedCycles: 4, claimedCycles: 3 });
    expect(store.getState().nextBackgroundDueAtMs()).toBeNull();
  });

  it('does not amplify a capped offline reward across 100 rapid restarts', () => {
    const clock = new MutableClock();
    const storage = new MemoryStorageAdapter();
    let store = createStoneverseStore({ storage, clock, rngFactory: () => new SeededRng('restart'), newGame: { seed: 'restart' } });
    const stoneId = Object.keys(store.getState().game.stones)[0]!;
    store.getState().startTraining(stoneId);
    clock.milliseconds += 365 * 24 * 60 * 60 * 1_000;
    store = createStoneverseStore({ storage, clock, rngFactory: () => new SeededRng('restart') });
    const firstBank = store.getState().game.training.assignment!.bankedMs;
    expect(firstBank).toBe(30 * 24 * 60 * 60 * 1_000);
    for (let restart = 0; restart < 100; restart += 1) {
      store = createStoneverseStore({ storage, clock, rngFactory: () => new SeededRng(`restart-${restart}`) });
      expect(store.getState().game.training.assignment!.bankedMs).toBe(firstBank);
    }
  });

  it('keeps active battles and every background deployment mutually exclusive', () => {
    const clock = new MutableClock();
    const deployed = createStoneverseStore({ storage: null, clock, rng: new SeededRng('battle-deployed'), newGame: { seed: 'battle-deployed' } });
    deployed.getState().startExpedition({ regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED' });
    expect(() => deployed.getState().startDungeonBattle('dungeon_echoing_depths', 'echo_1')).toThrow(/deployed Stone/i);

    const battling = createStoneverseStore({ storage: null, clock, rng: new SeededRng('deployed-battle'), newGame: { seed: 'deployed-battle' } });
    battling.getState().startDungeonBattle('dungeon_echoing_depths', 'echo_1');
    const activeStone = battling.getState().game.parties[0]!.slots[0]!.stoneId;
    expect(() => battling.getState().startTraining(activeStone)).toThrow(/active battle/i);
    expect(() => battling.getState().startExpedition({ regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED' })).toThrow(/background activity/i);
    expect(() => battling.getState().startEndlessMine()).toThrow(/deployed Stone/i);
  });

  it('reports volatile sessions instead of claiming that a silent save succeeded', () => {
    const store = createStoneverseStore({ storage: null, autoSave: false, clock: new MutableClock(), newGame: { seed: 'volatile-session' } });

    expect(store.getState().persistenceAvailable).toBe(false);
    expect(() => store.getState().save()).toThrow(/cannot be saved/i);
    expect(store.getState().lastError).toMatch(/cannot be saved/i);
  });
});
