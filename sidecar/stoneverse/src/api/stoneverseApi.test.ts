import { describe, expect, it, vi } from 'vitest';
import { SPECIES } from '../data';
import { SeededRng } from '../domain/rng';
import { generateEquipment, getTurnOrder, getUsableSkills } from '../domain/advanced';
import { stoneMaxLevel } from '../domain/stone';
import type { Clock } from '../domain/types';
import { createStoneverseStore } from '../store/stoneverseStore';
import { MemoryStorageAdapter } from '../store/persistence';
import { createStoneverseApi } from './stoneverseApi';

const clock: Clock = { now: () => new Date('2026-09-10T07:00:00.000Z') };

describe('public sidecar API', () => {
  it('keeps Farm input narrow and emits typed progression events', () => {
    const store = createStoneverseStore({ clock, rng: new SeededRng('api'), storage: new MemoryStorageAdapter(), newGame: { seed: 'api-game' } });
    const api = createStoneverseApi({ store, online: null });
    const mined = vi.fn();
    api.on('stone:mined', mined);
    const result = api.onStoneMined({ eventId: 'farm-api-1', amount: 2, quality: 0.5 });
    expect(result.accepted).toBe(true);
    expect(mined).toHaveBeenCalledWith(result);
    expect(api.getStoneverseState()).not.toBe(store.getState().game);
    expect(api.getFarmStatistics().totalMined).toBe(2);
  });

  it('exports and imports through the public contract', () => {
    const store = createStoneverseStore({ clock, rng: new SeededRng('api-save'), storage: new MemoryStorageAdapter(), newGame: { seed: 'api-save-game' } });
    const api = createStoneverseApi({ store, online: null });
    api.onStoneMined({ eventId: 'farm-api-save', amount: 4 });
    const exported = api.exportStoneverseSave();
    store.getState().resetGame({ seed: 'replacement' });
    api.importStoneverseSave(exported);
    expect(api.getFarmStatistics().totalMined).toBe(4);
  });

  it('projects the local collection completion into the public profile', async () => {
    const store = createStoneverseStore({ clock, rng: new SeededRng('api-profile'), storage: null, newGame: { seed: 'api-profile-game' } });
    const api = createStoneverseApi({ store, online: null });
    const state = api.getStoneverseState();
    const profile = await api.getPublicProfile(state.account.accountId);

    expect(profile?.collectionPercent).toBe(Math.round(state.collection.discoveredSpeciesIds.length / SPECIES.length * 100));
    expect(profile?.collectionPercent).toBeGreaterThan(0);
    expect(profile).toMatchObject({
      highestEndlessFloor: state.endlessMine.highestFloor,
      weeklyHighestEndlessFloor: state.endlessMine.weeklyHighestFloor,
      currentExpeditionCount: 0,
      expeditionCount: state.expeditions.totalCycles,
      bossKills: state.account.raidStats.bossesDefeated,
      battleWins: state.statistics.battleWins,
      bestTeamStoneIds: state.parties.find((party) => party.id === state.activePartyId)?.slots.map((slot) => slot.stoneId),
      favoriteStoneIds: state.profile.favoriteStoneIds,
      favoriteStoneCount: Object.values(state.stones).filter((stone) => stone.favorite).length,
      perfectStoneCount: Object.values(state.stones).filter((stone) => Object.values(stone.individualValues).every((iv) => iv === 31)).length,
      fastestEndlessClearTurns: null,
      fewestEndlessDamage: null,
    });
    expect(profile?.battlePower).toBeGreaterThan(0);
  });

  it('stores public stone-detail navigation in the shared route state', () => {
    const store = createStoneverseStore({ clock, rng: new SeededRng('api-route'), storage: null, newGame: { seed: 'api-route-game' } });
    const api = createStoneverseApi({ store, online: null });
    const routeChanged = vi.fn();
    const stoneId = Object.keys(store.getState().game.stones)[0];
    api.on('route:changed', routeChanged);

    api.openStoneDetail(stoneId);

    expect(store.getState().route).toBe('STONE_DETAIL');
    expect(store.getState().selectedStoneId).toBe(stoneId);
    expect(routeChanged).toHaveBeenCalledOnce();
    expect(routeChanged).toHaveBeenCalledWith({ route: 'STONE_DETAIL', selectedStoneId: stoneId });
  });

  it('rejects mining after an explicitly managed Farm session ends', () => {
    const store = createStoneverseStore({ clock, rng: new SeededRng('api-session'), storage: new MemoryStorageAdapter(), newGame: { seed: 'api-session-game' } });
    const api = createStoneverseApi({ store, online: null });
    const sessionId = api.onFarmSessionStarted();
    const active = api.onStoneMined({ eventId: 'farm-session-active', sessionId, amount: 1 });
    const minedBeforeEnd = api.getFarmStatistics().totalMined;

    api.onFarmSessionEnded();
    const secondApiForSameStore = createStoneverseApi({ store, online: null });
    const ended = secondApiForSameStore.onStoneMined({ eventId: 'farm-session-ended', sessionId, amount: 100, quality: 1 });

    expect(active.accepted).toBe(true);
    expect(ended).toMatchObject({ accepted: false, duplicate: false, xpGranted: 0, creditsGranted: 0 });
    expect(api.getFarmStatistics().totalMined).toBe(minedBeforeEnd);
    expect(store.getState().game.mining.processedFarmEventIds['farm-session-ended']).toBeUndefined();
  });

  it('exposes the complete expedition lifecycle and emits background transitions', () => {
    let nowMs = Date.parse('2026-09-10T07:00:00.000Z');
    const mutableClock: Clock = { now: () => new Date(nowMs) };
    const store = createStoneverseStore({ clock: mutableClock, rng: new SeededRng('api-expedition'), storage: null, newGame: { seed: 'api-expedition-game' } });
    const api = createStoneverseApi({ store, online: null });
    const started = vi.fn();
    const completed = vi.fn();
    const claimed = vi.fn();
    const idle = vi.fn();
    api.on('expedition:started', started);
    api.on('expedition:completed', completed);
    api.on('expedition:claimed', claimed);
    api.on('idle:processed', idle);

    const run = api.startExpedition({ regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED' });
    expect(started).toHaveBeenCalledWith(expect.objectContaining({ expeditionId: run.expeditionId, status: 'ACTIVE' }));

    nowMs += 15 * 60 * 1_000;
    const summary = api.processBackground();
    expect(summary?.expeditionCycles).toBe(1);
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ previousCompletedCycles: 0, cyclesCompleted: 1 }));
    expect(idle).toHaveBeenCalledWith(expect.objectContaining({ expeditionCycles: 1 }));

    const reward = api.claimExpedition(run.expeditionId);
    expect(reward.cyclesClaimed).toBe(1);
    expect(claimed).toHaveBeenCalledWith(reward);
  });

  it('exposes a repeat stop that leaves the current cycle and stored rewards intact', () => {
    let nowMs = Date.parse('2026-09-10T07:00:00.000Z');
    const mutableClock: Clock = { now: () => new Date(nowMs) };
    const store = createStoneverseStore({ clock: mutableClock, rng: new SeededRng('api-repeat-stop'), storage: null, newGame: { seed: 'api-repeat-stop-game' } });
    const api = createStoneverseApi({ store, online: null });
    const run = api.startExpedition({ regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: true });
    nowMs += 15 * 60 * 1_000;
    api.processBackground();
    const credits = api.getStoneverseState().expeditions.runs[run.expeditionId]!.expeditionStorage.credits;

    const stopped = api.stopExpedition(run.expeditionId);

    expect(stopped).toMatchObject({ expeditionId: run.expeditionId, repeat: false, status: 'ACTIVE', completedCycles: 1 });
    expect(stopped).not.toBe(store.getState().game.expeditions.runs[run.expeditionId]);
    expect(api.getStoneverseState().expeditions.runs[run.expeditionId]!.expeditionStorage.credits).toBe(credits);
  });

  it('publishes typed training, affinity, and research start/complete/claim events', () => {
    let nowMs = Date.parse('2026-09-10T07:00:00.000Z');
    const mutableClock: Clock = { now: () => new Date(nowMs) };
    const store = createStoneverseStore({ clock: mutableClock, rng: new SeededRng('api-facilities'), storage: null, newGame: { seed: 'api-facilities-game' } });
    store.getState().game.inventory.currencies.researchCores = 10;
    const api = createStoneverseApi({ store, online: null });
    const stoneIds = Object.keys(store.getState().game.stones);
    const trainingStarted = vi.fn();
    const trainingClaimed = vi.fn();
    const trainingStopped = vi.fn();
    const affinityStarted = vi.fn();
    const affinityClaimed = vi.fn();
    const affinityStopped = vi.fn();
    const researchStarted = vi.fn();
    const researchCompleted = vi.fn();
    const researchClaimed = vi.fn();
    api.on('training:started', trainingStarted);
    api.on('training:claimed', trainingClaimed);
    api.on('training:stopped', trainingStopped);
    api.on('affinityGarden:started', affinityStarted);
    api.on('affinityGarden:claimed', affinityClaimed);
    api.on('affinityGarden:stopped', affinityStopped);
    api.on('research:started', researchStarted);
    api.on('research:completed', researchCompleted);
    api.on('research:claimed', researchClaimed);

    api.startTraining(stoneIds[0]!);
    api.startAffinityGarden(stoneIds[1]!);
    const research = api.startResearch('GEOLOGY_SURVEY');
    expect(trainingStarted).toHaveBeenCalledWith(expect.objectContaining({ stoneId: stoneIds[0] }));
    expect(affinityStarted).toHaveBeenCalledWith(expect.objectContaining({ stoneId: stoneIds[1] }));
    expect(researchStarted).toHaveBeenCalledWith(expect.objectContaining({ researchId: research.researchId }));

    nowMs += 60 * 60 * 1_000;
    api.processBackground();
    expect(researchCompleted).toHaveBeenCalledWith(expect.objectContaining({ researchId: research.researchId, status: 'READY' }));

    expect(api.claimTraining()).toBeGreaterThan(0);
    expect(api.claimAffinityGarden()).toBeGreaterThan(0);
    const researchReward = api.claimResearch(research.researchId);
    expect(trainingClaimed).toHaveBeenCalledWith(expect.objectContaining({ stoneId: stoneIds[0], xp: expect.any(Number) }));
    expect(affinityClaimed).toHaveBeenCalledWith(expect.objectContaining({ stoneId: stoneIds[1], affinity: expect.any(Number) }));
    expect(researchClaimed).toHaveBeenCalledWith({ researchId: research.researchId, ...researchReward });

    api.stopTraining();
    api.stopAffinityGarden();
    expect(trainingStopped).toHaveBeenCalledWith({ stoneId: stoneIds[0] });
    expect(affinityStopped).toHaveBeenCalledWith({ stoneId: stoneIds[1] });
  });

  it('emits each new rare signal once and exposes overflow discovery claiming', () => {
    let nowMs = Date.parse('2026-09-10T07:00:00.000Z');
    const mutableClock: Clock = { now: () => new Date(nowMs) };
    const store = createStoneverseStore({ clock: mutableClock, rng: new SeededRng('api-rare'), storage: null, newGame: { seed: 'api-rare-game' } });
    const api = createStoneverseApi({ store, online: null });
    const rare = vi.fn();
    const discoveryClaimed = vi.fn();
    api.on('expedition:rareDiscovered', rare);
    api.on('expedition:discoveryClaimed', discoveryClaimed);
    const run = api.startExpedition({
      regionId: 'region_starter_quarry',
      durationId: 'duration_15m',
      strategy: 'HIGH_RISK',
      repeat: true,
    });

    nowMs += 30 * 24 * 60 * 60 * 1_000;
    const summary = api.processBackground();
    expect(summary?.expeditionCycles).toBeGreaterThan(0);
    expect(rare).toHaveBeenCalled();
    const rareEventCount = rare.mock.calls.length;

    store.getState().game.inventory.capacity = Object.keys(store.getState().game.stones).length;
    const claim = api.claimExpedition(run.expeditionId);
    expect(claim.storedDiscoveries.length).toBeGreaterThan(0);
    expect(rare).toHaveBeenCalledTimes(rareEventCount);

    store.getState().game.inventory.capacity += 1;
    const stored = claim.storedDiscoveries[0]!;
    const stone = api.claimStoredExpeditionDiscovery(stored.discoveryId);
    expect(discoveryClaimed).toHaveBeenCalledWith({ discoveryId: stored.discoveryId, stone: expect.objectContaining({ instanceId: stone.instanceId }) });
  });

  it('exposes Endless Mine progression and emits each state transition once', () => {
    let nowMs = Date.parse('2026-09-10T07:00:00.000Z');
    const mutableClock: Clock = { now: () => new Date(nowMs) };
    const store = createStoneverseStore({ clock: mutableClock, rng: new SeededRng('api-endless'), storage: null, newGame: { seed: 'api-endless-game' } });
    const api = createStoneverseApi({ store, online: null });
    const started = vi.fn();
    const advanced = vi.fn();
    const paused = vi.fn();
    const claimed = vi.fn();
    api.on('endless:started', started);
    api.on('endless:advanced', advanced);
    api.on('endless:paused', paused);
    api.on('endless:claimed', claimed);

    const campaign = api.startEndlessMine();
    expect(campaign).not.toBe(store.getState().game.endlessMine);
    expect(campaign.status).toBe('RUNNING');
    expect(started).toHaveBeenCalledOnce();
    expect(started).toHaveBeenCalledWith(expect.objectContaining({ runId: campaign.runId }));
    expect(() => api.advanceEndlessMine(1)).toThrow(/not ready/);
    expect(store.getState().game.endlessMine.run?.battles).toBe(0);

    nowMs += 5 * 60 * 1_000;
    const summary = api.advanceEndlessMine(1);
    expect(summary.attemptedFloors).toBe(1);
    expect(advanced).toHaveBeenCalledOnce();
    expect(advanced).toHaveBeenCalledWith(expect.objectContaining({
      runId: campaign.runId,
      attemptedFloors: 1,
      clearedFloors: summary.clearedFloors,
    }));

    if (store.getState().game.endlessMine.status === 'RUNNING') {
      api.pauseEndlessMine();
      expect(paused).toHaveBeenCalledOnce();
    }
    const result = api.claimEndlessMine();
    expect(claimed).toHaveBeenCalledOnce();
    expect(claimed).toHaveBeenCalledWith(result);

    // Processing the same instant again cannot replay a transition event.
    const advancedCalls = advanced.mock.calls.length;
    api.processBackground();
    expect(advanced).toHaveBeenCalledTimes(advancedCalls);
    nowMs += 1;
  });

  it('publishes manual/auto controls, commands, loot filters, salvage, and equip events', () => {
    const store = createStoneverseStore({ clock, rng: new SeededRng('api-endless-controls'), storage: null, newGame: { seed: 'api-endless-controls-game' } });
    const api = createStoneverseApi({ store, online: null });
    const manualChanged = vi.fn();
    const strategyChanged = vi.fn();
    const speedChanged = vi.fn();
    const command = vi.fn();
    const filterChanged = vi.fn();
    const salvaged = vi.fn();
    const equipped = vi.fn();
    const unequipped = vi.fn();
    const lockChanged = vi.fn();
    api.on('endless:manualChanged', manualChanged);
    api.on('endless:strategyChanged', strategyChanged);
    api.on('endless:speedChanged', speedChanged);
    api.on('endless:command', command);
    api.on('endless:lootFilterChanged', filterChanged);
    api.on('endless:equipmentSalvaged', salvaged);
    api.on('endless:equipmentEquipped', equipped);
    api.on('endless:equipmentUnequipped', unequipped);
    api.on('endless:equipmentLockChanged', lockChanged);

    api.startEndlessMine();
    api.setEndlessStrategy('BOSS_FOCUS');
    api.setEndlessSpeed(4);
    const manualState = api.setEndlessManual(true);
    expect(strategyChanged).toHaveBeenCalledOnce();
    expect(speedChanged).toHaveBeenCalledOnce();
    expect(manualChanged).toHaveBeenCalledOnce();

    const battle = manualState.activeBattle!;
    const actorId = getTurnOrder(battle).find((id) => battle.units.find((unit) => unit.id === id)?.side === 'PLAYER')!;
    const skill = getUsableSkills(battle, actorId)[0]!;
    api.issueEndlessCommand(skill.id);
    expect(command).toHaveBeenCalledOnce();
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ skillId: skill.id }));

    api.setEndlessManual(false);
    expect(manualChanged).toHaveBeenCalledTimes(2);
    // Reapplying the same mode is a no-op and must not replay the change event.
    api.setEndlessManual(false);
    expect(manualChanged).toHaveBeenCalledTimes(2);

    api.updateEndlessLootFilter({ minRarity: 'EPIC', minScore: 200, autoSalvage: true, alwaysKeepSets: ['ABYSSAL'] });
    expect(filterChanged).toHaveBeenCalledOnce();

    const stoneId = Object.keys(store.getState().game.stones)[0]!;
    const equipItem = generateEquipment({ level: 25, rarity: 'EPIC', source: 'api-test-equip' }, new SeededRng('api-test-equip'));
    const salvageItem = generateEquipment({ level: 12, rarity: 'RARE', source: 'api-test-salvage' }, new SeededRng('api-test-salvage'));
    store.getState().game.endlessMine.equipment.items.push(equipItem, salvageItem);
    api.equipEndlessEquipment(equipItem.id, stoneId);
    expect(equipped).toHaveBeenCalledOnce();
    expect(equipped).toHaveBeenCalledWith(expect.objectContaining({ equipment: expect.objectContaining({ id: equipItem.id }), stone: expect.objectContaining({ instanceId: stoneId }) }));
    api.setEndlessEquipmentLocked(equipItem.id, true);
    expect(lockChanged).toHaveBeenCalledWith({ equipmentId: equipItem.id, locked: true });
    api.unequipEndlessEquipment(equipItem.id, stoneId);
    expect(unequipped).toHaveBeenCalledWith({ equipmentId: equipItem.id, stoneId });
    const materials = api.salvageEndlessEquipment(salvageItem.id);
    expect(materials).toBeGreaterThan(0);
    expect(salvaged).toHaveBeenCalledOnce();
    expect(salvaged).toHaveBeenCalledWith({ equipmentId: salvageItem.id, materialsGained: materials });
  });

  it('emits one aggregate mastery gain with every changed mastery entry', () => {
    const store = createStoneverseStore({ clock, rng: new SeededRng('api-mastery'), storage: null, newGame: { seed: 'api-mastery-game' } });
    const api = createStoneverseApi({ store, online: null });
    const mastery = vi.fn();
    api.on('mastery:gained', mastery);
    const stoneId = Object.keys(store.getState().game.stones)[0]!;
    const stone = store.getState().game.stones[stoneId]!;
    stone.level = stoneMaxLevel(stone);
    stone.xp = 0;

    const result = api.trainStone(stoneId, 2_000);
    expect(result.masteryXpGained).toBe(2_000);
    expect(mastery).toHaveBeenCalledOnce();
    expect(mastery).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'trainStone',
      xpGained: 2_000,
      totalXp: 2_000,
      stones: [expect.objectContaining({ id: stoneId })],
      species: [expect.objectContaining({ id: stone.speciesId })],
    }));

    api.trainStone(stoneId, 0);
    expect(mastery).toHaveBeenCalledOnce();
  });

  it('isolates returned snapshots and each event listener from mutation at the public boundary', async () => {
    const store = createStoneverseStore({ clock, rng: new SeededRng('api-isolation'), storage: null, newGame: { seed: 'api-isolation-game' } });
    const api = createStoneverseApi({ store, online: null });
    const observedBySecond: boolean[] = [];
    api.on('stone:mined', (payload) => { payload.accepted = false; payload.discoveries.length = 0; });
    api.on('stone:mined', (payload) => { observedBySecond.push(payload.accepted); });

    const result = api.onStoneMined({ eventId: 'api-isolated-mine', amount: 2, quality: 0.5 });
    result.accepted = false;
    const snapshot = api.getStoneverseState();
    snapshot.account.username = 'mutated outside';
    const profile = await api.getPublicProfile(store.getState().game.account.accountId);
    if (profile) profile.username = 'mutated profile';

    expect(observedBySecond).toEqual([true]);
    expect(store.getState().game.mining.totalMined).toBe(2);
    expect(store.getState().game.account.username).not.toBe('mutated outside');
    expect((await api.getPublicProfile(store.getState().game.account.accountId))?.username).not.toBe('mutated profile');
  });
});
