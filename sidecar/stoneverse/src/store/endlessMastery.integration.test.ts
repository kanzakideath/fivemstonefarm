import { describe, expect, it } from 'vitest';
import { addEquipment, createEquipmentInventory, generateEquipment } from '../domain/advanced';
import { ENDLESS_FLOOR_INTERVAL_MS } from '../domain/endlessCampaign';
import { encodeExpeditionEquipmentReward } from '../domain/expedition';
import { calculateStoneStats, stoneMaxLevel } from '../domain/stone';
import { createInitialGameState } from '../domain/state';
import { SeededRng, stableChecksum } from '../domain/rng';
import type { Clock, GameState } from '../domain/types';
import {
  exportSave,
  importSave,
  MemoryStorageAdapter,
  SAVE_KEY,
} from './persistence';
import { createStoneverseStore } from './stoneverseStore';

const START_MS = Date.parse('2026-09-10T00:00:00.000Z');
const FIFTEEN_MINUTES_MS = 15 * 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;

class MutableClock implements Clock {
  constructor(public milliseconds = START_MS) {}
  now(): Date { return new Date(this.milliseconds); }
}

const maxLevelState = (clock: Clock, seed: string): GameState => {
  const state = createInitialGameState({ seed, clock });
  for (const stone of Object.values(state.stones)) {
    stone.level = stoneMaxLevel(stone);
    stone.xp = 0;
    stone.stats = calculateStoneStats(stone);
  }
  return state;
};

describe('schema-v5 Endless Mine and mastery integration', () => {
  it('adds safe Endless Mine and mastery defaults while migrating a checksummed v4 envelope', () => {
    const clock = new MutableClock();
    const current = createInitialGameState({ seed: 'v4-new-domain-defaults', clock });
    const {
      expeditions: _expeditions,
      training: _training,
      affinityGarden: _affinityGarden,
      research: _research,
      idle: _idle,
      endlessMine: _endlessMine,
      mastery: _mastery,
      ...legacyFields
    } = current;
    const v4State = { ...legacyFields, schemaVersion: 4 };
    const serialized = JSON.stringify({
      format: 'STONEVERSE_SAVE',
      schemaVersion: 4,
      savedAt: clock.now().toISOString(),
      checksum: stableChecksum(v4State),
      state: v4State,
    });

    const migrated = importSave(serialized);

    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.endlessMine).toMatchObject({
      version: 1,
      status: 'READY',
      runId: null,
      pendingCredits: 0,
      highestFloor: 0,
      claimLedger: {},
    });
    expect(migrated.endlessMine.equipment).toMatchObject({ capacity: 300, items: [], salvageMaterials: 0 });
    expect(migrated.mastery).toEqual({ version: 1, stones: {}, species: {}, totalXp: 0 });
  });

  it('round-trips non-default Endless Mine and mastery data through a schema-v5 save', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'v5-roundtrip-domains', clock });
    const stone = Object.values(state.stones)[0]!;
    state.endlessMine.highestFloor = 37;
    state.endlessMine.weeklyHighestFloor = 31;
    state.endlessMine.pendingCredits = 12_345;
    state.endlessMine.equipment.salvageMaterials = 678;
    state.mastery.totalXp = 4_321;
    state.mastery.stones[stone.instanceId] = { xp: 321, level: 2, unlockedRewardIds: ['lore-entry-1'] };
    state.mastery.species[stone.speciesId] = { xp: 112, level: 1, unlockedRewardIds: [] };

    const restored = importSave(exportSave(state, clock));

    expect(restored.endlessMine).toEqual(state.endlessMine);
    expect(restored.mastery).toEqual(state.mastery);
  });

  it('persists auto/offline Endless progress exactly once across repeated reloads', () => {
    const clock = new MutableClock();
    const storage = new MemoryStorageAdapter();
    let store = createStoneverseStore({
      storage,
      clock,
      initialState: maxLevelState(clock, 'endless-reload'),
      rngFactory: () => new SeededRng('endless-reload-rng'),
    });
    const partyIds = Object.keys(store.getState().game.stones).slice(0, 3);
    store.getState().startEndlessMine(partyIds);
    const activeRunId = store.getState().game.endlessMine.runId;
    expect(activeRunId).toBeTruthy();

    clock.milliseconds += ENDLESS_FLOOR_INTERVAL_MS;
    const onlineStep = store.getState().advanceEndlessMine(1);
    expect(onlineStep.attemptedFloors).toBe(1);
    clock.milliseconds += 6 * HOUR_MS;
    store = createStoneverseStore({ storage, clock, rngFactory: () => new SeededRng('endless-reload-rng') });

    const afterFirstReload = store.getState().game.endlessMine;
    const once = {
      floor: afterFirstReload.run?.currentFloor,
      pendingCredits: afterFirstReload.pendingCredits,
      equipmentIds: afterFirstReload.equipment.items.map((item) => item.id),
      salvageMaterials: afterFirstReload.equipment.salvageMaterials,
      lastProcessedAt: afterFirstReload.lastProcessedAt,
    };
    expect(once.pendingCredits).toBeGreaterThanOrEqual(onlineStep.credits);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();

    for (let reload = 0; reload < 10; reload += 1) {
      store = createStoneverseStore({ storage, clock, rngFactory: () => new SeededRng(`endless-reload-${reload}`) });
      const campaign = store.getState().game.endlessMine;
      expect(campaign.run?.currentFloor).toBe(once.floor);
      expect(campaign.pendingCredits).toBe(once.pendingCredits);
      expect(campaign.equipment.items.map((item) => item.id)).toEqual(once.equipmentIds);
      expect(campaign.equipment.salvageMaterials).toBe(once.salvageMaterials);
      expect(campaign.lastProcessedAt).toBe(once.lastProcessedAt);
    }
  });

  it('commits an Endless claim once and rejects duplicate collection without changing credits', () => {
    const clock = new MutableClock();
    const storage = new MemoryStorageAdapter();
    const store = createStoneverseStore({
      storage,
      clock,
      initialState: maxLevelState(clock, 'endless-duplicate-claim'),
      rngFactory: () => new SeededRng('endless-duplicate-claim-rng'),
    });
    store.getState().startEndlessMine();
    clock.milliseconds += ENDLESS_FLOOR_INTERVAL_MS;
    store.getState().advanceEndlessMine(1);
    if (store.getState().game.endlessMine.status === 'RUNNING') store.getState().pauseEndlessMine();

    const beforeCredits = store.getState().game.inventory.currencies.credits;
    const beforeDust = store.getState().game.inventory.currencies.upgradeDust;
    store.getState().game.endlessMine.equipment.salvageMaterials = 37;
    const first = store.getState().claimEndlessMine();
    const afterCredits = store.getState().game.inventory.currencies.credits;
    expect(afterCredits).toBe(beforeCredits + first.credits);
    expect(first.upgradeDust).toBe(37);
    expect(store.getState().game.inventory.currencies.upgradeDust).toBe(beforeDust + 37);
    expect(store.getState().game.endlessMine.equipment.salvageMaterials).toBe(0);
    expect(() => store.getState().claimEndlessMine()).toThrow(/already claimed/i);
    expect(store.getState().game.inventory.currencies.credits).toBe(afterCredits);
    expect(importSave(storage.getItem(SAVE_KEY)!).inventory.currencies.credits).toBe(afterCredits);
  });

  it('auto-salvages equipment overflow while never exceeding inventory capacity', () => {
    const inventory = createEquipmentInventory(1);
    const high = generateEquipment(
      { level: 100, rarity: 'MYTHIC', slot: 'CORE', setId: null, source: 'overflow-high' },
      new SeededRng('overflow-high'),
    );
    const low = generateEquipment(
      { level: 1, rarity: 'COMMON', slot: 'CORE', setId: null, source: 'overflow-low' },
      new SeededRng('overflow-low'),
    );
    expect(addEquipment(inventory, high, { autoSalvage: true }).accepted).toBe(true);

    const overflow = addEquipment(inventory, low, { autoSalvage: true });

    expect(overflow).toMatchObject({ accepted: false, reason: 'CAPACITY', salvagedIds: [low.id] });
    expect(overflow.materialsGained).toBeGreaterThan(0);
    expect(inventory.items).toHaveLength(1);
    expect(inventory.items[0]?.id).toBe(high.id);
    expect(inventory.salvageMaterials).toBe(overflow.materialsGained);
  });

  it('converts Training Chamber XP at Lv.MAX into persistent mastery XP', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({
      storage: null,
      autoSave: false,
      clock,
      initialState: maxLevelState(clock, 'training-mastery'),
      rng: new SeededRng('training-mastery-rng'),
    });
    const stoneId = Object.keys(store.getState().game.stones)[0]!;
    store.getState().startTraining(stoneId);
    clock.milliseconds += HOUR_MS;

    const claimedXp = store.getState().claimTraining();

    expect(claimedXp).toBeGreaterThan(0);
    expect(store.getState().game.stones[stoneId]?.level).toBe(stoneMaxLevel(store.getState().game.stones[stoneId]!));
    expect(store.getState().game.mastery.totalXp).toBe(claimedXp);
    expect(store.getState().game.mastery.stones[stoneId]?.xp).toBeGreaterThan(0);
  });

  it('converts every Lv.MAX expedition party member reward into mastery XP', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({
      storage: null,
      autoSave: false,
      clock,
      initialState: maxLevelState(clock, 'expedition-mastery'),
      rngFactory: () => new SeededRng('expedition-mastery-rng'),
    });
    const run = store.getState().startExpedition({
      regionId: 'region_starter_quarry',
      durationId: 'duration_15m',
      strategy: 'SAFE',
      repeat: false,
    });
    clock.milliseconds += FIFTEEN_MINUTES_MS;
    store.getState().processBackground();

    const claimed = store.getState().claimExpedition(run.expeditionId);
    const partyIds = run.partySnapshot.map((member) => member.stoneId);

    expect(claimed.reward.stoneXpPerMember).toBeGreaterThan(0);
    expect(store.getState().game.mastery.totalXp).toBe(claimed.reward.stoneXpPerMember * partyIds.length);
    for (const stoneId of partyIds) expect(store.getState().game.mastery.stones[stoneId]?.xp).toBeGreaterThan(0);
  });

  it('materializes Expedition equipment drops as affixed instances without duplicate item tokens', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({
      storage: null,
      autoSave: false,
      clock,
      initialState: maxLevelState(clock, 'expedition-equipment-instance'),
      rng: new SeededRng('expedition-equipment-instance-rng'),
    });
    const run = store.getState().startExpedition({
      regionId: 'region_starter_quarry',
      durationId: 'duration_15m',
      strategy: 'BALANCED',
      repeat: false,
    });
    run.completedCycles = 1;
    run.status = 'READY';
    run.expeditionStorage.items.equipment_quarry_charm = 2;
    store.getState().game.endlessMine.lootFilter = { autoSalvage: false };
    const before = store.getState().game.endlessMine.equipment.items.length;

    const result = store.getState().claimExpedition(run.expeditionId);
    const game = store.getState().game;

    expect(result.reward.items.equipment_quarry_charm).toBe(2);
    expect(game.inventory.items.equipment_quarry_charm).toBeUndefined();
    expect(game.endlessMine.equipment.items).toHaveLength(before + 2);
    expect(game.endlessMine.equipment.items.slice(-2).every((item) => item.affixes.length > 0 && item.score > 0)).toBe(true);
  });

  it('materializes the exact Expedition report rarity, slot, set and seed descriptor', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({
      storage: null,
      autoSave: false,
      clock,
      initialState: maxLevelState(clock, 'expedition-exact-equipment'),
      rng: new SeededRng('expedition-exact-equipment-rng'),
    });
    const run = store.getState().startExpedition({
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: false,
    });
    run.completedCycles = 1;
    run.status = 'READY';
    const rewardKey = encodeExpeditionEquipmentReward({
      itemId: 'equipment_resonance_rune', rarity: 'SSR', seed: `${run.seed}:equipment:1`,
    });
    run.expeditionStorage.items[rewardKey] = 1;
    store.getState().game.endlessMine.lootFilter = { autoSalvage: false };

    store.getState().claimExpedition(run.expeditionId);
    const item = store.getState().game.endlessMine.equipment.items.at(-1)!;

    expect(item).toMatchObject({ rarity: 'EPIC', slot: 'RUNE', setId: 'RESONANCE' });
    expect(item.affixes).toHaveLength(4);
    expect(store.getState().game.inventory.items[rewardKey]).toBeUndefined();
  });

  it('returns replaced build equipment to the usable Endless inventory', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({ storage: null, autoSave: false, clock, newGame: { seed: 'equipment-swap' } });
    const stoneId = Object.keys(store.getState().game.stones)[0]!;
    const first = generateEquipment({ level: 15, slot: 'CORE', rarity: 'RARE', setId: 'BASTION', source: 'swap-first' }, new SeededRng('swap-first'));
    const second = generateEquipment({ level: 20, slot: 'CORE', rarity: 'EPIC', setId: 'ABYSSAL', source: 'swap-second' }, new SeededRng('swap-second'));
    store.getState().game.endlessMine.equipment.items.push(first, second);

    store.getState().equipEndlessEquipment(first.id, stoneId);
    store.getState().equipEndlessEquipment(second.id, stoneId);

    expect(store.getState().game.stones[stoneId]!.equipment.CORE?.instanceId).toBe(second.id);
    expect(store.getState().game.endlessMine.equipment.items.some((item) => item.id === first.id && item.setId === 'BASTION')).toBe(true);
    expect(store.getState().game.inventory.equipment[first.id]).toBeUndefined();
  });

  it('supports target-specific equip, lock, unequip, and manual salvage without losing gear', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({ storage: null, autoSave: false, clock, newGame: { seed: 'equipment-management' } });
    const stoneId = Object.keys(store.getState().game.stones)[1]!;
    const item = generateEquipment({ level: 31, slot: 'RELIC', rarity: 'LEGENDARY', setId: 'HUNTER', source: 'manage' }, new SeededRng('manage'));
    store.getState().game.endlessMine.equipment.items.push(item);

    store.getState().equipEndlessEquipment(item.id, stoneId);
    expect(store.getState().game.stones[stoneId]!.equipment.RELIC?.instanceId).toBe(item.id);
    store.getState().setEndlessEquipmentLocked(item.id, true);
    expect(store.getState().game.stones[stoneId]!.equipment.RELIC?.locked).toBe(true);

    store.getState().unequipEndlessEquipment(item.id, stoneId);
    const returned = store.getState().game.endlessMine.equipment.items.find((candidate) => candidate.id === item.id);
    expect(returned).toMatchObject({ locked: true, setId: 'HUNTER', slot: 'RELIC' });
    expect(store.getState().game.stones[stoneId]!.equipment.RELIC).toBeUndefined();
    expect(() => store.getState().salvageEndlessEquipment(item.id)).toThrow(/cannot be salvaged/i);

    store.getState().setEndlessEquipmentLocked(item.id, false);
    const gained = store.getState().salvageEndlessEquipment(item.id);
    expect(gained).toBeGreaterThan(0);
    expect(store.getState().game.endlessMine.equipment.items.some((candidate) => candidate.id === item.id)).toBe(false);
  });

  it('rejects unequip atomically when field storage is full', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({ storage: null, autoSave: false, clock, newGame: { seed: 'equipment-full-unequip' } });
    const stoneId = Object.keys(store.getState().game.stones)[0]!;
    const equipped = generateEquipment({ level: 12, slot: 'CHARM', rarity: 'RARE', source: 'full-equipped' }, new SeededRng('full-equipped'));
    const blocker = generateEquipment({ level: 8, slot: 'CORE', rarity: 'COMMON', source: 'full-blocker' }, new SeededRng('full-blocker'));
    store.getState().game.endlessMine.equipment.capacity = 1;
    store.getState().game.endlessMine.equipment.items.push(equipped);
    store.getState().equipEndlessEquipment(equipped.id, stoneId);
    store.getState().game.endlessMine.equipment.items.push(blocker);

    expect(() => store.getState().unequipEndlessEquipment(equipped.id, stoneId)).toThrow(/storage is full/i);
    expect(store.getState().game.stones[stoneId]!.equipment.CHARM?.instanceId).toBe(equipped.id);
    expect(store.getState().game.endlessMine.equipment.items.map((item) => item.id)).toEqual([blocker.id]);
  });

  it('registers one event-driven ENDLESS_MINE scheduler job at the next floor boundary', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({
      storage: null,
      autoSave: false,
      clock,
      initialState: maxLevelState(clock, 'endless-scheduler'),
      rng: new SeededRng('endless-scheduler-rng'),
    });
    store.getState().startEndlessMine();
    const campaign = store.getState().game.endlessMine;
    const jobs = store.getState().game.idle.scheduler.jobs.filter((job) => job.payload.kind === 'ENDLESS_MINE');

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: `endless-mine:${campaign.runId}`,
      dueAtMs: START_MS + ENDLESS_FLOOR_INTERVAL_MS,
      payload: { kind: 'ENDLESS_MINE', runId: campaign.runId },
    });
    expect(store.getState().nextBackgroundDueAtMs()).toBe(START_MS + ENDLESS_FLOOR_INTERVAL_MS);
  });

  it('uses real Advanced AI at active-auto efficiency and aggregated power only offline', () => {
    const baseClock = new MutableClock();
    const initial = maxLevelState(baseClock, 'active-vs-offline');
    const activeClock = new MutableClock();
    const offlineClock = new MutableClock();
    const active = createStoneverseStore({ storage: null, autoSave: false, clock: activeClock, initialState: initial, rng: new SeededRng('mode-rng') });
    const offline = createStoneverseStore({ storage: null, autoSave: false, clock: offlineClock, initialState: initial, rng: new SeededRng('mode-rng') });
    active.getState().startEndlessMine();
    offline.getState().startEndlessMine();
    activeClock.milliseconds += ENDLESS_FLOOR_INTERVAL_MS;
    offlineClock.milliseconds += ENDLESS_FLOOR_INTERVAL_MS;

    expect(active.getState().processBackground('ACTIVE')).toBeNull();
    const offlineWelcome = offline.getState().processBackground('OFFLINE');

    expect(active.getState().game.endlessMine.run?.battles).toBe(1);
    expect(offline.getState().game.endlessMine.run?.battles).toBe(1);
    expect(active.getState().game.endlessMine.pendingCredits).toBeGreaterThan(offline.getState().game.endlessMine.pendingCredits);
    expect(offlineWelcome?.endlessFloors).toBe(1);
  });

  it('keeps each Stone exclusive across every background activity in both directions', () => {
    const clock = new MutableClock();
    const store = createStoneverseStore({
      storage: null,
      autoSave: false,
      clock,
      initialState: maxLevelState(clock, 'background-exclusive'),
      rng: new SeededRng('background-exclusive-rng'),
    });
    const partyIds = store.getState().game.parties.find((party) => party.id === store.getState().game.activePartyId)!.slots.map((slot) => slot.stoneId);

    store.getState().startEndlessMine(partyIds);
    expect(() => store.getState().startTraining(partyIds[0]!)).toThrow(/Endless Mine/);
    expect(() => store.getState().startExpedition({
      regionId: 'region_starter_quarry',
      durationId: 'duration_15m',
      strategy: 'BALANCED',
    })).toThrow(/another background activity/);

    store.getState().pauseEndlessMine();
    store.getState().claimEndlessMine();
    store.getState().startTraining(partyIds[0]!);
    expect(() => store.getState().startEndlessMine(partyIds)).toThrow(/deployed Stone/);
  });
});
