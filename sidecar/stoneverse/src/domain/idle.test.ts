import { describe, expect, it } from 'vitest';
import {
  affinityReady,
  claimAffinityGarden,
  claimResearch,
  claimTraining,
  startAffinityGarden,
  startResearch,
  startTraining,
  trainingXpReady,
} from './backgroundActivities';
import { MAX_PENDING_RARE_DISCOVERIES, startExpedition } from './expedition';
import { processIdleState, refreshBackgroundSchedule } from './idle';
import { SeededRng } from './rng';
import { cloneGameState, createInitialGameState } from './state';
import type { Clock } from './types';

const startMs = Date.parse('2026-09-10T00:00:00.000Z');
class MutableClock implements Clock {
  constructor(public milliseconds = startMs) {}
  now(): Date { return new Date(this.milliseconds); }
}

describe('idle aggregation', () => {
  it.each([
    ['15m', 15 * 60 * 1_000],
    ['1h', 60 * 60 * 1_000],
    ['12h', 12 * 60 * 60 * 1_000],
    ['24h', 24 * 60 * 60 * 1_000],
    ['7d', 7 * 24 * 60 * 60 * 1_000],
    ['30d', 30 * 24 * 60 * 60 * 1_000],
  ])('aggregates the %s welcome-back window without per-tick loops', (_label, elapsedMs) => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: `idle-${elapsedMs}`, clock });
    const stones = Object.values(state.stones);
    startTraining(state, stones[0]!.instanceId, clock.now());
    startAffinityGarden(state, stones[1]!.instanceId, clock.now());
    clock.milliseconds += elapsedMs;
    const summary = processIdleState(state, clock)!;
    expect(summary.elapsedMs).toBe(elapsedMs);
    expect(summary.trainingXpReady).toBe(trainingXpReady(state));
    expect(summary.affinityReady).toBe(affinityReady(state));
    expect(state.training.assignment!.bankedMs).toBe(elapsedMs);
    expect(state.affinityGarden.assignment!.bankedMs).toBe(elapsedMs);
    expect(Number.isSafeInteger(summary.trainingXpReady)).toBe(true);
  });

  it('aggregates expedition, training, garden and research into one welcome-back summary', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'welcome-all', clock });
    state.inventory.currencies.researchCores = 5;
    const stones = Object.values(state.stones);
    // Use one-member expedition party so the two facilities can use distinct stones.
    state.parties[0]!.slots = [state.parties[0]!.slots[0]!];
    startExpedition(state, { regionId: 'region_starter_quarry', durationId: 'duration_1h', strategy: 'BALANCED' }, new SeededRng('welcome-expedition'), clock);
    startTraining(state, stones[1]!.instanceId, clock.now());
    startAffinityGarden(state, stones[2]!.instanceId, clock.now());
    const research = startResearch(state, 'GEOLOGY_SURVEY', new SeededRng('welcome-research'), clock);
    clock.milliseconds += 60 * 60 * 1_000;
    const summary = processIdleState(state, clock)!;
    expect(summary.expeditionCycles).toBe(1);
    expect(summary.trainingXpReady).toBeGreaterThan(0);
    expect(summary.affinityReady).toBeGreaterThan(0);
    expect(summary.researchReady).toBe(true);
    expect(state.research.slot?.status).toBe('READY');
    expect(claimTraining(state, clock.now())).toBeGreaterThan(0);
    expect(claimAffinityGarden(state, clock.now())).toBeGreaterThan(0);
    const reward = claimResearch(state, research.researchId, clock.now());
    expect(reward.projectId).toBe('GEOLOGY_SURVEY');
    for (let attempt = 0; attempt < 100; attempt += 1) expect(() => claimResearch(state, research.researchId, clock.now())).toThrow(/already claimed/i);
  });

  it('awards nothing for clock rollback', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'rollback', clock });
    startTraining(state, Object.keys(state.stones)[0]!, clock.now());
    clock.milliseconds += 60 * 60 * 1_000;
    processIdleState(state, clock);
    const banked = state.training.assignment!.bankedMs;
    const trusted = state.idle.timeCheckpoint.trustedNowMs;
    clock.milliseconds -= 30 * 60 * 1_000;
    const summary = processIdleState(state, clock)!;
    expect(summary.rollbackDetected).toBe(true);
    expect(summary.elapsedMs).toBe(0);
    expect(state.training.assignment!.bankedMs).toBe(banked);
    expect(state.idle.timeCheckpoint.trustedNowMs).toBe(trusted);
  });

  it('caps a huge jump once and prevents reward amplification through restart spam', () => {
    const clock = new MutableClock();
    let state = createInitialGameState({ seed: 'restart-spam', clock });
    startTraining(state, Object.keys(state.stones)[0]!, clock.now());
    clock.milliseconds += 365 * 24 * 60 * 60 * 1_000;
    const first = processIdleState(state, clock)!;
    expect(first.capped).toBe(true);
    expect(first.elapsedMs).toBe(30 * 24 * 60 * 60 * 1_000);
    const banked = state.training.assignment!.bankedMs;
    for (let restart = 0; restart < 100; restart += 1) {
      state = cloneGameState(state);
      expect(processIdleState(state, clock)).toBeNull();
      expect(state.training.assignment!.bankedMs).toBe(banked);
    }
    expect(state.idle.timeCheckpoint.wallHighWaterMs).toBe(clock.milliseconds);
  });

  it('marks an undismissed multi-window report capped when its combined period exceeds 30 days', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'combined-cap', clock });
    startTraining(state, Object.keys(state.stones)[0]!, clock.now());
    clock.milliseconds += 20 * 24 * 60 * 60 * 1_000;
    expect(processIdleState(state, clock)?.capped).toBe(false);
    clock.milliseconds += 20 * 24 * 60 * 60 * 1_000;
    const combined = processIdleState(state, clock)!;

    expect(combined.elapsedMs).toBe(30 * 24 * 60 * 60 * 1_000);
    expect(combined.capped).toBe(true);
  });

  it('preserves an undismissed offline report across active runtime ticks', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'welcome-lifecycle', clock });
    startTraining(state, Object.keys(state.stones)[0]!, clock.now());
    clock.milliseconds += 60 * 60 * 1_000;
    const welcome = processIdleState(state, clock)!;
    clock.milliseconds += 1_000;

    expect(processIdleState(state, clock, { mode: 'ACTIVE' })).toBeNull();
    expect(state.idle.lastWelcomeBack).toEqual(welcome);
  });

  it('accumulates successive hidden-tab due windows into one undismissed report', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'hidden-due-report', clock });
    startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: true,
    }, new SeededRng('hidden-due-report-run'), clock);

    clock.milliseconds += 15 * 60 * 1_000;
    const first = processIdleState(state, clock, { mode: 'OFFLINE' })!;
    clock.milliseconds += 15 * 60 * 1_000;
    const combined = processIdleState(state, clock, { mode: 'OFFLINE' })!;

    expect(first.expeditionCycles).toBe(1);
    expect(combined.expeditionCycles).toBe(2);
    expect(combined.elapsedMs).toBe(30 * 60 * 1_000);
    expect(state.idle.lastWelcomeBack).toEqual(combined);
  });

  it('reports only the new facility gains after an earlier report was dismissed without claiming', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'welcome-period-delta', clock });
    const stones = Object.values(state.stones);
    startTraining(state, stones[0]!.instanceId, clock.now());
    startAffinityGarden(state, stones[1]!.instanceId, clock.now());
    clock.milliseconds += 60 * 60 * 1_000;
    const first = processIdleState(state, clock)!;
    state.idle.lastWelcomeBack = null;
    clock.milliseconds += 60 * 60 * 1_000;
    const second = processIdleState(state, clock)!;

    expect(second.trainingXpReady).toBe(first.trainingXpReady);
    expect(second.affinityReady).toBe(first.affinityReady);
    expect(trainingXpReady(state)).toBe(first.trainingXpReady + second.trainingXpReady);
    expect(affinityReady(state)).toBe(first.affinityReady + second.affinityReady);
  });

  it('unschedules a repeat expedition while its Rare mailbox applies backpressure', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'rare-backpressure', clock });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'DISCOVERY', repeat: true,
    }, new SeededRng('rare-backpressure-run'), clock);
    run.expeditionStorage.rareDiscoveries = Array.from({ length: MAX_PENDING_RARE_DISCOVERIES }, (_, index) => ({
      discoveryId: `blocked:${index}`,
      seed: `blocked-seed:${index}`,
      speciesId: 'species_quartzling',
      veinId: 'region_starter_quarry:rare',
      areaId: 'region_starter_quarry',
      hintedRarity: 'RARE' as const,
      sourceEventId: `blocked-event:${index}`,
      discoveredAt: clock.now().toISOString(),
    }));

    expect(refreshBackgroundSchedule(state)).toBeNull();
    expect(state.idle.scheduler.jobs).toHaveLength(0);
    run.expeditionStorage.rareDiscoveries = [];
    expect(refreshBackgroundSchedule(state)).toBe(Date.parse(run.nextCompletionAt));
  });
});
