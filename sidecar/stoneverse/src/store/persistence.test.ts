import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, createInitialGameState } from '../domain/state';
import { SeededRng, stableChecksum } from '../domain/rng';
import type { Clock } from '../domain/types';
import { createStoneverseStore } from './stoneverseStore';
import {
  importSave,
  exportSave,
  loadBestSave,
  MemoryStorageAdapter,
  migrateState,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  SAVE_TEMP_KEY,
  saveAtomically,
} from './persistence';

const clock: Clock = { now: () => new Date('2026-09-10T05:00:00.000Z') };

class FailOnceStorage extends MemoryStorageAdapter {
  failKey: string | null = null;

  override setItem(key: string, value: string): void {
    if (this.failKey === key) {
      this.failKey = null;
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    }
    super.setItem(key, value);
  }
}

class ThrowingReadStorage extends MemoryStorageAdapter {
  readonly deniedKeys = new Set<string>();

  override getItem(key: string): string | null {
    if (this.deniedKeys.has(key)) throw new DOMException(`Read denied: ${key}`, 'SecurityError');
    return super.getItem(key);
  }
}

const signedCurrentEnvelope = (state: ReturnType<typeof createInitialGameState>): string => {
  const normalized = JSON.parse(JSON.stringify(state)) as ReturnType<typeof createInitialGameState>;
  return JSON.stringify({
    format: 'STONEVERSE_SAVE',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: clock.now().toISOString(),
    checksum: stableChecksum(normalized),
    state: normalized,
  });
};

describe('save pipeline', () => {
  it('round-trips the full state with checksum integrity', () => {
    const state = createInitialGameState({ seed: 'save', clock });
    state.mining.totalMined = 777;
    const serialized = exportSave(state, clock);
    const restored = importSave(serialized);
    expect(restored.mining.totalMined).toBe(777);
    expect(restored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(Object.keys(restored.stones)).toHaveLength(3);
    const tampered = serialized.replace('"totalMined": 777', '"totalMined": 778');
    expect(() => importSave(tampered)).toThrow(/checksum/i);
  });

  it('requires an envelope for current raw state and a mandatory checksum', () => {
    const state = createInitialGameState({ seed: 'raw-current', clock });
    expect(() => importSave(JSON.stringify(state))).toThrow(/checksummed.*envelope/i);
    const versionStripped = { ...state, schemaVersion: undefined };
    expect(() => importSave(JSON.stringify(versionStripped))).toThrow(/explicit schemaVersion/i);
    const envelope = JSON.parse(exportSave(state, clock)) as Record<string, unknown>;
    delete envelope.checksum;
    expect(() => importSave(JSON.stringify(envelope))).toThrow(/checksum/i);
  });

  it('rejects a checksummed current save with invalid runtime settings', () => {
    const envelope = JSON.parse(exportSave(createInitialGameState({ seed: 'invalid-setting', clock }), clock)) as {
      checksum: string;
      state: ReturnType<typeof createInitialGameState> & { settings: { effectQuality: unknown } };
    };
    (envelope.state.settings as unknown as { effectQuality: unknown }).effectQuality = null;
    envelope.checksum = stableChecksum(envelope.state);
    expect(() => importSave(JSON.stringify(envelope))).toThrow(/settings\.effectQuality/i);
  });

  it('rejects checksummed scheduler snapshots that violate runtime invariants', () => {
    const invalidJobs: Array<{ job: Record<string, unknown>; expected: RegExp }> = [
      {
        job: { id: 'finite-one-shot', dueAtMs: 100, endAtMs: 200, payload: { kind: 'RESEARCH', researchId: 'research-1' } },
        expected: /endAtMs.*requires repeatEveryMs/i,
      },
      {
        job: { id: 'backwards-repeat', dueAtMs: 200, repeatEveryMs: 10, endAtMs: 199, payload: { kind: 'RESEARCH', researchId: 'research-1' } },
        expected: /endAtMs.*cannot precede dueAtMs/i,
      },
      {
        job: { id: 'zero-repeat', dueAtMs: 100, repeatEveryMs: 0, endAtMs: 200, payload: { kind: 'RESEARCH', researchId: 'research-1' } },
        expected: /repeatEveryMs/i,
      },
    ];

    for (const [index, { job, expected }] of invalidJobs.entries()) {
      const state = createInitialGameState({ seed: `invalid-scheduler-${index}`, clock });
      state.idle.scheduler.jobs = [job as unknown as (typeof state.idle.scheduler.jobs)[number]];
      expect(() => importSave(signedCurrentEnvelope(state))).toThrow(expected);
    }
  });

  it('rejects duplicate scheduler IDs and payload fields that disagree with their kind', () => {
    const duplicate = createInitialGameState({ seed: 'duplicate-scheduler', clock });
    const sharedJob = {
      id: 'duplicate-job',
      dueAtMs: 100,
      payload: { kind: 'TRAINING' as const, stoneId: Object.keys(duplicate.stones)[0]! },
    };
    duplicate.idle.scheduler.jobs = [sharedJob, { ...sharedJob, dueAtMs: 200 }];
    expect(() => importSave(signedCurrentEnvelope(duplicate))).toThrow(/duplicate scheduler job/i);

    const malformedPayloads: Array<Record<string, unknown>> = [
      { kind: 'EXPEDITION', stoneId: 'stone-1' },
      { kind: 'TRAINING', stoneId: 'stone-1', expeditionId: 'expedition-1' },
      { kind: 'AFFINITY_GARDEN', researchId: 'research-1' },
      { kind: 'RESEARCH', runId: 'run-1' },
      { kind: 'ENDLESS_MINE', runId: '' },
    ];
    for (const [index, payload] of malformedPayloads.entries()) {
      const state = createInitialGameState({ seed: `malformed-payload-${index}`, clock });
      state.idle.scheduler.jobs = [{
        id: `malformed-payload-${index}`,
        dueAtMs: 100,
        payload: payload as unknown as (typeof state.idle.scheduler.jobs)[number]['payload'],
      }];
      expect(() => importSave(signedCurrentEnvelope(state))).toThrow(/idle\.scheduler\.jobs\[0\]\.payload/i);
    }
  });

  it('accepts valid bounded and unbounded repeat schedules', () => {
    const state = createInitialGameState({ seed: 'valid-repeat-scheduler', clock });
    state.idle.scheduler.jobs = [
      {
        id: 'bounded-expedition',
        dueAtMs: 100,
        repeatEveryMs: 25,
        endAtMs: 200,
        sequence: 3,
        payload: { kind: 'EXPEDITION', expeditionId: 'expedition-1' },
      },
      {
        id: 'unbounded-training',
        dueAtMs: 300,
        repeatEveryMs: 50,
        payload: { kind: 'TRAINING', stoneId: Object.keys(state.stones)[0]! },
      },
    ];

    const imported = importSave(signedCurrentEnvelope(state));
    expect(imported.idle.scheduler.jobs).toEqual(state.idle.scheduler.jobs);
  });

  it('validates Stone capacity against owned Stones rather than equipment', () => {
    const state = createInitialGameState({ seed: 'invalid-stone-capacity', clock });
    state.inventory.capacity = Object.keys(state.stones).length - 1;
    expect(Object.keys(state.inventory.equipment)).toHaveLength(0);
    expect(() => importSave(signedCurrentEnvelope(state))).toThrow(/inventory\.capacity/i);
  });

  it('rejects invalid finite values, structures, array members and live references', () => {
    const corruptions: Array<(state: ReturnType<typeof createInitialGameState>) => void> = [
      (state) => { (state.settings as unknown as { mute: unknown }).mute = 'yes'; },
      (state) => { state.inventory.currencies.credits = -1; },
      (state) => { state.mining.totalMined = Number.POSITIVE_INFINITY; },
      (state) => { (state as unknown as { account: unknown }).account = null; },
      (state) => { (state.online as unknown as { queue: unknown }).queue = {}; },
      (state) => { state.parties[0]!.slots = [{ stoneId: 'missing-stone', position: 'FRONT' }]; },
      (state) => { (state as unknown as { activeBattle: unknown }).activeBattle = { battleId: 'broken' }; },
      (state) => { (state as unknown as { battleHistory: unknown }).battleHistory = [{ battleId: 'unfinished' }]; },
    ];
    for (const corrupt of corruptions) {
      const state = createInitialGameState({ seed: `corruption-${corruptions.indexOf(corrupt)}`, clock });
      corrupt(state);
      expect(() => importSave(signedCurrentEnvelope(state))).toThrow(/invalid save/i);
    }
  });

  it('migrates a sparse v1 raw state into the current schema', () => {
    const migrated = migrateState({
      schemaVersion: 1,
      account: { accountId: 'legacy', username: 'Legacy' },
      stones: {},
      mining: { level: 4, xp: 12, totalMined: 25 },
    });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.account.accountId).toBe('legacy');
    expect(migrated.facilities.fusionLab).toBe(1);
    expect(migrated.activeBattle).toBeNull();
    expect(migrated.online.queue).toEqual([]);
  });

  it('migrates a checksummed v4 envelope while preserving the v4 checksum boundary', () => {
    const current = createInitialGameState({ seed: 'legacy-v4', clock });
    const { expeditions: _expeditions, training: _training, affinityGarden: _garden, research: _research, idle: _idle, ...legacyState } = current;
    const v4State = { ...legacyState, inventory: { ...legacyState.inventory, capacity: 1 }, schemaVersion: 4, revision: 17 };
    const envelope = JSON.stringify({
      format: 'STONEVERSE_SAVE',
      schemaVersion: 4,
      savedAt: clock.now().toISOString(),
      checksum: stableChecksum(v4State),
      state: v4State,
    });
    const migrated = importSave(envelope);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.revision).toBe(17);
    expect(migrated.expeditions.runs).toEqual({});
    expect(migrated.training.assignment).toBeNull();
    expect(migrated.idle.lastProcessedAt).toBe(current.updatedAt);
    expect(migrated.inventory.capacity).toBe(Object.keys(migrated.stones).length);
    expect(() => importSave(JSON.stringify(v4State))).toThrow(/checksummed/i);
  });

  it('raises a pre-v4 capacity to preserve all legacy Stones', () => {
    const current = createInitialGameState({ seed: 'legacy-v3-capacity', clock });
    const legacy = JSON.parse(JSON.stringify(current)) as Record<string, unknown> & {
      inventory: { capacity: number };
      schemaVersion: number;
    };
    legacy.schemaVersion = 3;
    legacy.inventory.capacity = 1;

    const migrated = migrateState(legacy);
    expect(Object.keys(migrated.stones)).toHaveLength(3);
    expect(migrated.inventory.capacity).toBe(3);
  });

  it('carries v3 Farm receipts into the dedicated exact replay ledger', () => {
    const migrated = migrateState({
      schemaVersion: 3,
      account: { accountId: 'legacy-v3', username: 'Legacy V3' },
      stones: {},
      mining: { level: 1, xp: 0, totalMined: 1 },
      online: {
        connected: true,
        sessionId: 'legacy-session',
        sequence: 2,
        queue: [],
        processedReceipts: [
          { eventId: 'farm-event-from-v3', processedAt: clock.now().toISOString(), checksum: 'abc' },
          { eventId: 'sync_mining_farm-event-from-v3', processedAt: clock.now().toISOString(), checksum: 'def' },
        ],
        lastSyncedAt: null,
      },
    });
    expect(migrated.mining.processedFarmEventIds['farm-event-from-v3']).toBe(true);
    expect(migrated.mining.processedFarmEventIds['sync_mining_farm-event-from-v3']).toBeUndefined();
  });

  it('uses pending verification and retains a recoverable previous backup', () => {
    const storage = new MemoryStorageAdapter();
    const state = createInitialGameState({ seed: 'atomic', clock });
    saveAtomically(storage, state, clock);
    state.revision = 9;
    saveAtomically(storage, state, clock);
    expect(storage.getItem(SAVE_KEY)).toContain('"revision": 9');
    expect(storage.getItem(SAVE_BACKUP_KEY)).toContain('"revision": 0');
    expect(storage.getItem(SAVE_TEMP_KEY)).toBeNull();
    expect(loadBestSave(storage)?.revision).toBe(9);
  });

  it('falls back to backup when the current envelope is checksummed but structurally invalid', () => {
    const storage = new MemoryStorageAdapter();
    const state = createInitialGameState({ seed: 'fallback', clock });
    saveAtomically(storage, state, clock);
    state.revision = 1;
    saveAtomically(storage, state, clock);
    const current = JSON.parse(storage.getItem(SAVE_KEY)!) as {
      checksum: string;
      state: ReturnType<typeof createInitialGameState> & { settings: { effectQuality: unknown } };
    };
    (current.state.settings as unknown as { effectQuality: unknown }).effectQuality = null;
    current.checksum = stableChecksum(current.state);
    storage.setItem(SAVE_KEY, JSON.stringify(current));
    const recovered = loadBestSave(storage);
    expect(recovered?.revision).toBe(0);
    expect(recovered?.settings.effectQuality).toBe('HIGH');
  });

  it('restores the previous committed save when atomic promotion fails', () => {
    const storage = new FailOnceStorage();
    const state = createInitialGameState({ seed: 'atomic-failure', clock });
    saveAtomically(storage, state, clock);
    state.revision = 11;
    storage.failKey = SAVE_KEY;
    expect(() => saveAtomically(storage, state, clock)).toThrow(/quota/i);
    expect(importSave(storage.getItem(SAVE_KEY)!).revision).toBe(0);
    expect(storage.getItem(SAVE_TEMP_KEY)).toBeNull();
  });

  it('rolls back a reward-bearing store transaction when persistence hits quota', () => {
    const storage = new FailOnceStorage();
    const store = createStoneverseStore({ storage, clock, rng: new SeededRng('quota-rng'), newGame: { seed: 'quota-game' }, autoSave: true });
    const before = store.getState().game;
    storage.failKey = SAVE_TEMP_KEY;
    expect(() => store.getState().mine({ eventId: 'quota-mine', amount: 1, quality: 0.5 })).toThrow(/quota/i);
    const after = store.getState().game;
    expect(after).toBe(before);
    expect(after.mining.totalMined).toBe(0);
    expect(after.mining.processedFarmEventIds['quota-mine']).toBeUndefined();
    expect(after.online.queue).toHaveLength(0);
  });

  it('skips unreadable save slots and recovers another valid candidate', () => {
    const storage = new ThrowingReadStorage();
    const backup = createInitialGameState({ seed: 'readable-backup', clock });
    backup.revision = 23;
    storage.setItem(SAVE_BACKUP_KEY, exportSave(backup, clock));
    storage.deniedKeys.add(SAVE_KEY);
    storage.deniedKeys.add(SAVE_TEMP_KEY);

    expect(loadBestSave(storage)?.revision).toBe(23);

    storage.deniedKeys.add(SAVE_BACKUP_KEY);
    for (const key of ['stoneverse.save.v3']) storage.deniedKeys.add(key);
    expect(loadBestSave(storage)).toBeNull();
  });

  it('starts without readable storage and rolls back when an atomic pre-read throws', () => {
    const storage = new ThrowingReadStorage();
    for (const key of [SAVE_KEY, SAVE_TEMP_KEY, SAVE_BACKUP_KEY, 'stoneverse.save.v3']) storage.deniedKeys.add(key);
    const store = createStoneverseStore({ storage, clock, rng: new SeededRng('read-denied-rng'), newGame: { seed: 'read-denied-game' }, autoSave: true });
    const before = store.getState().game;

    expect(() => store.getState().mine({ eventId: 'read-denied-mine', amount: 1 })).toThrow(/read denied/i);
    expect(store.getState().game).toBe(before);
    expect(store.getState().game.mining.totalMined).toBe(0);
  });

  it('write-protects readable corrupt slots until an explicit reset or valid import', () => {
    const storage = new MemoryStorageAdapter();
    storage.setItem(SAVE_KEY, '{"format":"STONEVERSE_SAVE","broken":true}');
    storage.setItem(SAVE_BACKUP_KEY, '{not-json');
    const corruptPrimary = storage.getItem(SAVE_KEY);
    const corruptBackup = storage.getItem(SAVE_BACKUP_KEY);
    const store = createStoneverseStore({ storage, clock, rng: new SeededRng('corrupt-protection'), newGame: { seed: 'protected-new-game' }, autoSave: true });

    expect(store.getState().lastError).toMatch(/書き込みを停止/);
    expect(() => store.getState().save()).toThrow(/write-protected/i);
    expect(() => store.getState().mine({ eventId: 'must-not-overwrite', amount: 1 })).toThrow(/write-protected/i);
    expect(storage.getItem(SAVE_KEY)).toBe(corruptPrimary);
    expect(storage.getItem(SAVE_BACKUP_KEY)).toBe(corruptBackup);

    store.getState().resetGame({ seed: 'explicit-recovery' });
    expect(() => importSave(storage.getItem(SAVE_KEY)!)).not.toThrow();
    expect(store.getState().lastError).toBeNull();
  });
});
