import { describe, expect, it } from 'vitest';
import { applyMiningEvent, appraiseDiscovery } from './mining';
import { SeededRng } from './rng';
import { createInitialGameState } from './state';
import type { Clock } from './types';
import { createStoneverseStore } from '../store/stoneverseStore';

const clock: Clock = { now: () => new Date('2026-09-10T01:00:00.000Z') };

describe('mining and appraisal', () => {
  it('rejects replayed host events without duplicating rewards', () => {
    const state = createInitialGameState({ seed: 'mine', clock });
    const payload = { eventId: 'farm-event-1', amount: 10, quality: 0.8 };
    const first = applyMiningEvent(state, payload, new SeededRng('mine-roll'), clock);
    const credits = state.inventory.currencies.credits;
    const second = applyMiningEvent(state, payload, new SeededRng('other-roll'), clock);
    expect(first.accepted).toBe(true);
    expect(second).toMatchObject({ accepted: false, duplicate: true });
    expect(state.inventory.currencies.credits).toBe(credits);
    expect(state.mining.totalMined).toBe(10);
  });

  it('turns a deterministic discovery into one unique natural stone', () => {
    const state = createInitialGameState({ seed: 'appraisal', clock });
    const mined = applyMiningEvent(state, { eventId: 'large-mine', amount: 100, quality: 1 }, new SeededRng('discoveries'), clock);
    expect(mined.discoveries.length).toBeGreaterThan(0);
    const before = Object.keys(state.stones).length;
    const result = appraiseDiscovery(state, mined.discoveries[0]!.discoveryId, clock);
    expect(result.stone.origin).toBe('NATURAL');
    expect(result.stone.appraisedAt).not.toBeNull();
    expect(Object.keys(state.stones)).toHaveLength(before + 1);
    expect(() => appraiseDiscovery(state, mined.discoveries[0]!.discoveryId, clock)).toThrow(/not found/i);
  });

  it('retains an unappraised discovery when Stone storage is full', () => {
    const state = createInitialGameState({ seed: 'full-appraisal', clock });
    const mined = applyMiningEvent(state, { eventId: 'full-appraisal-find', amount: 100, quality: 1 }, new SeededRng('full-appraisal-find'), clock);
    expect(mined.discoveries.length).toBeGreaterThan(0);
    const discovery = mined.discoveries[0]!;
    state.inventory.capacity = Object.keys(state.stones).length;
    const before = JSON.stringify(state);

    expect(() => appraiseDiscovery(state, discovery.discoveryId, clock)).toThrow(/capacity/i);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.unappraisedFinds.some((find) => find.discoveryId === discovery.discoveryId)).toBe(true);
  });

  it('still rejects the oldest replay after more than 2,000 later Farm events', () => {
    const state = createInitialGameState({ seed: 'durable-ledger', clock, withStarter: false });
    const rng = new SeededRng('durable-ledger-rolls');
    const eventCount = 2_050;
    for (let index = 0; index < eventCount; index += 1) {
      const result = applyMiningEvent(state, { eventId: `farm-ledger-${index}`, amount: 1, quality: 0 }, rng, clock);
      expect(result.accepted).toBe(true);
    }
    const minedBeforeReplay = state.mining.totalMined;
    const creditsBeforeReplay = state.inventory.currencies.credits;
    const replay = applyMiningEvent(state, { eventId: 'farm-ledger-0', amount: 1, quality: 1 }, rng, clock);
    expect(Object.keys(state.mining.processedFarmEventIds)).toHaveLength(eventCount);
    expect(replay).toMatchObject({ accepted: false, duplicate: true, xpGranted: 0, creditsGranted: 0 });
    expect(state.mining.totalMined).toBe(minedBeforeReplay);
    expect(state.inventory.currencies.credits).toBe(creditsBeforeReplay);
  }, 20_000);

  it('rejects mismatched sessions, stale/future timestamps and non-finite quality before rewards', () => {
    const invalidPayloads = [
      { eventId: 'wrong-session', sessionId: 'not-the-active-session', amount: 1 },
      { eventId: 'future', timestamp: '2026-09-10T01:06:00.000Z', amount: 1 },
      { eventId: 'too-old', timestamp: '2026-08-10T00:59:59.000Z', amount: 1 },
      { eventId: 'nan-quality', quality: Number.NaN, amount: 1 },
      { eventId: 'infinite-quality', quality: Number.POSITIVE_INFINITY, amount: 1 },
    ];
    for (const payload of invalidPayloads) {
      const state = createInitialGameState({ seed: `invalid-${payload.eventId}`, clock, withStarter: false });
      const credits = state.inventory.currencies.credits;
      const result = applyMiningEvent(state, payload, new SeededRng(payload.eventId), clock);
      expect(result).toMatchObject({ accepted: false, duplicate: false, xpGranted: 0, creditsGranted: 0 });
      expect(state.mining.totalMined).toBe(0);
      expect(state.inventory.currencies.credits).toBe(credits);
      expect(Object.keys(state.mining.processedFarmEventIds)).toHaveLength(0);
    }
  });

  it('preserves validated Farm provenance in the offline online-event queue', () => {
    const store = createStoneverseStore({ storage: null, autoSave: false, clock, rng: new SeededRng('provenance'), newGame: { seed: 'provenance-game' } });
    const sessionId = store.getState().game.online.sessionId;
    const metadata = { farm: 'FiveM', tool: { id: 'diamond-drill', tier: 3 }, tags: ['rare-vein'] };
    const result = store.getState().mine({
      eventId: 'provenance-event',
      sessionId,
      timestamp: '2026-09-10T00:58:00.000Z',
      areaId: 'area_greenbreak',
      veinId: 'vein_common',
      amount: 2,
      quality: 0.75,
      metadata,
    });
    metadata.tool.tier = 99;
    expect(result.accepted).toBe(true);
    const queued = store.getState().game.online.queue[0]!;
    expect(queued.kind).toBe('MINING_RECORDED');
    expect(queued.payload).toMatchObject({
      amount: 2,
      quality: 0.75,
      areaId: 'area_greenbreak',
      veinId: 'vein_common',
      source: {
        eventId: 'provenance-event',
        sessionId,
        timestamp: '2026-09-10T00:58:00.000Z',
        metadata: { farm: 'FiveM', tool: { id: 'diamond-drill', tier: 3 }, tags: ['rare-vein'] },
      },
    });
  });

  it('enforces the metadata limit in UTF-8 bytes for multibyte text', () => {
    const acceptedState = createInitialGameState({ seed: 'metadata-accepted', clock, withStarter: false });
    const accepted = applyMiningEvent(acceptedState, {
      eventId: 'metadata-accepted',
      amount: 1,
      metadata: { label: '石'.repeat(5_000) },
    }, new SeededRng('metadata-accepted'), clock);
    expect(accepted.accepted).toBe(true);

    const rejectedState = createInitialGameState({ seed: 'metadata-rejected', clock, withStarter: false });
    const multibyteMetadata = { label: '石😀'.repeat(2_500) };
    expect(JSON.stringify(multibyteMetadata).length).toBeLessThan(16_384);
    expect(new TextEncoder().encode(JSON.stringify(multibyteMetadata)).byteLength).toBeGreaterThan(16_384);
    const rejected = applyMiningEvent(rejectedState, {
      eventId: 'metadata-rejected',
      amount: 1,
      metadata: multibyteMetadata,
    }, new SeededRng('metadata-rejected'), clock);

    expect(rejected).toMatchObject({ accepted: false, duplicate: false, xpGranted: 0, creditsGranted: 0 });
    expect(rejectedState.mining.totalMined).toBe(0);
    expect(rejectedState.mining.processedFarmEventIds['metadata-rejected']).toBeUndefined();
  });
});
