import { describe, expect, it } from 'vitest';
import { createStoneverseApi } from '../api/stoneverseApi';
import { SeededRng } from '../domain/rng';
import { MemoryStorageAdapter } from '../store/persistence';
import { createStoneverseStore } from '../store/stoneverseStore';
import { createFarmHostDispatcher } from './farmHostBridge';

describe('FiveM Farm host bridge', () => {
  it('persists one committed event and treats the same eventId retry as a duplicate', () => {
    const storage = new MemoryStorageAdapter();
    const store = createStoneverseStore({
      storage,
      rng: new SeededRng('farm-host-duplicate'),
      newGame: { seed: 'farm-host-duplicate', accountId: 'focused-account' },
    });
    const dispatch = createFarmHostDispatcher(createStoneverseApi({ store, online: null }));
    const timestamp = new Date().toISOString();
    expect(dispatch({
      type: 'stoneverse.command', protocol: 1, requestId: 'request-begin',
      command: 'SESSION_BEGIN', id: 'farm-session-1', timestamp,
    })).toMatchObject({ ok: true, accepted: true });
    const event = {
      type: 'stoneverse.command', protocol: 1, command: 'MINING_SUCCESS',
      id: 'work:mining:durable:0001', timestamp, amount: 1, quality: 0.5,
      metadata: { source: 'fiveM-farm', mode: 'mining' },
    } as const;
    expect(dispatch({ ...event, requestId: 'request-first' }))
      .toMatchObject({ ok: true, accepted: true, duplicate: false });
    expect(dispatch({ ...event, requestId: 'request-retry' }))
      .toMatchObject({ ok: true, accepted: false, duplicate: true });
    expect(store.getState().game.mining.totalMined).toBe(1);
    expect(Object.keys(store.getState().game.mining.processedFarmEventIds)).toEqual([event.id]);

    const restarted = createStoneverseStore({ storage, rng: new SeededRng('restart') });
    expect(restarted.getState().game.mining.totalMined).toBe(1);
  });
});
