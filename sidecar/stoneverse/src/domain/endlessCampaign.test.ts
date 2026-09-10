import { describe, expect, it } from 'vitest';
import { generateEndlessFloor, generateEquipment, isEndlessCombatEncounter, MAX_ENDLESS_FLOOR } from './advanced';
import { SeededRng } from './rng';
import { createInitialGameState } from './state';
import { advanceEndlessAuto, claimEndlessCampaign, createInitialEndlessCampaign, pauseEndlessCampaign, processEndlessOffline, resumeEndlessCampaign, setEndlessMode, startEndlessCampaign, validateEndlessCampaignState } from './endlessCampaign';

describe('persistent Endless Mine campaign', () => {
  const fixture = () => {
    const game = createInitialGameState({ seed: 'endless-campaign', accountId: 'endless-account' });
    for (const stone of Object.values(game.stones)) {
      stone.level = 100;
      for (const key of Object.keys(stone.stats) as Array<keyof typeof stone.stats>) stone.stats[key] *= 40;
    }
    const state = createInitialEndlessCampaign(new Date('2026-01-01T00:00:00.000Z'));
    const party = Object.keys(game.stones).slice(0, 3);
    startEndlessCampaign(state, game.stones, party, new Date('2026-01-01T00:00:00.000Z'), 'campaign-seed');
    return { game, state };
  };

  const positionAt = (state: ReturnType<typeof createInitialEndlessCampaign>, floor: number): void => {
    state.run!.currentFloor = floor;
    state.run!.highestClearedFloor = floor - 1;
    state.run!.checkpointFloor = Math.floor((floor - 1) / 10) * 10;
    state.run!.clearedBosses = Math.floor((floor - 1) / 10);
    state.highestFloor = floor - 1;
    state.weeklyHighestFloor = floor - 1;
    state.nextFloorAt = '2026-01-01T00:05:00.000Z';
  };

  it('uses the same advanced combat engine for auto floor resolution', () => {
    const { state } = fixture();
    const summary = advanceEndlessAuto(state, 3, new Date('2026-01-01T00:15:00.000Z'));
    expect(summary.attemptedFloors).toBeGreaterThan(0);
    expect(state.run!.battles).toBe(summary.attemptedFloors);
    expect(state.recentLog.length).toBeGreaterThan(1);
    expect(Number.isFinite(state.pendingCredits)).toBe(true);
  });

  it('settles an auto non-combat encounter through the common first-clear ledger', () => {
    const { state } = fixture();
    const floor = Array.from({ length: 8 }, (_, index) => generateEndlessFloor(index + 2, state.run!.seed))
      .find((candidate) => !isEndlessCombatEncounter(candidate))!;
    expect(floor).toBeDefined();
    positionAt(state, floor.floor);

    const summary = advanceEndlessAuto(state, 1, new Date('2026-01-01T00:05:00.000Z'));

    expect(summary).toMatchObject({ attemptedFloors: 1, clearedFloors: 1, defeated: false });
    expect(summary.credits).toBe(Math.floor(floor.baseReward * 0.94));
    expect(state.run!.highestClearedFloor).toBe(floor.floor);
    expect(state.activeFloor).toBeNull();
    expect(state.activeBattle).toBeNull();
    expect(state.recentLog.some((line) => line.includes(floor.encounterType))).toBe(true);
  });

  it('active mode resolves deterministic field encounters and stops on the next real battle', () => {
    const { state } = fixture();
    const floor = Array.from({ length: 8 }, (_, index) => generateEndlessFloor(index + 2, state.run!.seed))
      .find((candidate) => !isEndlessCombatEncounter(candidate))!;
    positionAt(state, floor.floor);

    setEndlessMode(state, true);

    expect(state.run!.currentFloor).toBeGreaterThan(floor.floor);
    expect(state.activeFloor).not.toBeNull();
    expect(isEndlessCombatEncounter(state.activeFloor!)).toBe(true);
    expect(state.activeBattle).not.toBeNull();
    expect(state.pendingCredits).toBeGreaterThan(0);
  });

  it('produces identical offline encounter results from identical persisted snapshots', () => {
    const { state } = fixture();
    const left = structuredClone(state);
    const right = structuredClone(state);
    const now = new Date('2026-01-01T00:30:00.000Z');

    const leftResult = processEndlessOffline(left, now);
    const rightResult = processEndlessOffline(right, now);

    expect(leftResult).toEqual(rightResult);
    expect(left.run).toEqual(right.run);
    expect(left.pendingCredits).toBe(right.pendingCredits);
    expect(left.equipment).toEqual(right.equipment);
  });

  it('continues the persisted manual battle when control switches to auto', () => {
    const { state } = fixture();
    setEndlessMode(state, true);
    const persistedBattle = state.activeBattle!;
    expect(persistedBattle.outcome).toBeNull();

    setEndlessMode(state, false);
    advanceEndlessAuto(state, 1, new Date('2026-01-01T00:05:00.000Z'));

    expect(persistedBattle.outcome).not.toBeNull();
    expect(state.run!.battles).toBe(1);
  });

  it('preserves a partially played manual battle across pause and resume', () => {
    const { state } = fixture();
    setEndlessMode(state, true);
    const battle = state.activeBattle!;
    const floor = state.activeFloor!;
    battle.units[0]!.hp = Math.max(1, battle.units[0]!.hp - 37);
    battle.turn = 4;

    pauseEndlessCampaign(state, new Date('2026-01-01T00:01:00.000Z'));
    resumeEndlessCampaign(state, new Date('2026-01-01T00:02:00.000Z'));

    expect(state.activeBattle).toBe(battle);
    expect(state.activeFloor).toBe(floor);
    expect(state.activeBattle!.turn).toBe(4);
    expect(state.activeBattle!.units[0]!.hp).toBe(battle.units[0]!.hp);
  });

  it('does not duplicate credits or deterministic equipment on a checkpoint re-clear', () => {
    const { state } = fixture();
    advanceEndlessAuto(state, 1, new Date('2026-01-01T00:05:00.000Z'));
    expect(state.run!.highestClearedFloor).toBe(1);
    const firstCredits = state.pendingCredits;
    const firstEquipmentIds = state.equipment.items.map((item) => item.id);
    state.run!.currentFloor = 1;
    state.run!.status = 'CLIMBING';
    state.status = 'RUNNING';
    state.nextFloorAt = '2026-01-01T00:10:00.000Z';

    advanceEndlessAuto(state, 1, new Date('2026-01-01T00:10:00.000Z'));

    expect(state.pendingCredits).toBe(firstCredits);
    expect(state.equipment.items.map((item) => item.id)).toEqual(firstEquipmentIds);
    expect(state.run!.highestClearedFloor).toBe(1);
  });

  it('advances once for an offline interval and does not replay it', () => {
    const { state } = fixture();
    const future = new Date('2026-01-01T06:00:00.000Z');
    const first = processEndlessOffline(state, future);
    const credits = state.pendingCredits;
    const floor = state.run!.currentFloor;
    const second = processEndlessOffline(state, future);
    expect(first.clearedFloors).toBeGreaterThan(0);
    expect(second.clearedFloors).toBe(0);
    expect(state.pendingCredits).toBe(credits);
    expect(state.run!.currentFloor).toBe(floor);
  });

  it('preserves partial floor time across offline reconciliation', () => {
    const { state } = fixture();
    const first = processEndlessOffline(state, new Date('2026-01-01T00:06:00.000Z'));
    expect(first.attemptedFloors).toBe(1);
    expect(state.lastProcessedAt).toBe('2026-01-01T00:05:00.000Z');
    expect(state.nextFloorAt).toBe('2026-01-01T00:10:00.000Z');

    const remainderOnly = processEndlessOffline(state, new Date('2026-01-01T00:09:59.999Z'));
    expect(remainderOnly.attemptedFloors).toBe(0);
    const second = processEndlessOffline(state, new Date('2026-01-01T00:10:00.000Z'));
    expect(second.attemptedFloors).toBe(1);
  });

  it('reconciles a capped 30-day offline window in one bounded pass without replay', () => {
    const { state } = fixture();
    const future = new Date('2026-01-31T00:00:00.000Z');
    const started = performance.now();
    const first = processEndlessOffline(state, future);
    const wallMs = Math.round((performance.now() - started) * 1_000) / 1_000;
    const snapshot = { floor: state.run!.currentFloor, credits: state.pendingCredits, items: state.equipment.items.length };
    const replay = processEndlessOffline(state, future);

    expect(first.attemptedFloors).toBeLessThanOrEqual(30 * 24 * 12);
    expect(Number.isSafeInteger(first.credits)).toBe(true);
    expect(replay).toMatchObject({ attemptedFloors: 0, clearedFloors: 0, credits: 0 });
    expect({ floor: state.run!.currentFloor, credits: state.pendingCredits, items: state.equipment.items.length }).toEqual(snapshot);
    console.info(`[endless-offline-30d] ${JSON.stringify({ ...first, wallMs })}`);
  });

  it('discards time older than 720 hours instead of replaying capped batches', () => {
    const { state } = fixture();
    for (const member of state.partySnapshot) {
      member.stats.maxHp = 1_000_000_000_000;
      member.stats.attack = 1_000_000_000_000;
      member.stats.defense = 1_000_000_000_000;
      member.stats.speed = 1_000_000_000_000;
      member.stats.breakPower = 1_000_000_000_000;
    }
    const now = new Date('2026-03-02T00:00:00.000Z');

    const started = performance.now();
    const first = processEndlessOffline(state, now);
    const wallMs = Math.round((performance.now() - started) * 1_000) / 1_000;
    const replay = processEndlessOffline(state, now);

    expect(first.attemptedFloors).toBe(30 * 24 * 12);
    expect(replay).toMatchObject({ attemptedFloors: 0, clearedFloors: 0, credits: 0 });
    expect(state.nextFloorAt).toBe('2026-03-02T00:05:00.000Z');
    console.info(`[endless-offline-30d-overpowered] ${JSON.stringify({ attemptedFloors: first.attemptedFloors, clearedFloors: first.clearedFloors, wallMs })}`);
  });

  it('claim ledger rejects duplicate reward collection', () => {
    const { state } = fixture();
    advanceEndlessAuto(state, 1);
    setEndlessMode(state, true);
    state.status = 'PAUSED';
    const first = claimEndlessCampaign(state);
    expect(first.credits).toBeGreaterThanOrEqual(0);
    expect(() => claimEndlessCampaign(state)).toThrow(/already claimed/);
  });

  it('cannot overwrite an unclaimed ended run but can start again after its atomic claim', () => {
    const { game, state } = fixture();
    advanceEndlessAuto(state, 1);
    state.status = 'PAUSED';
    const party = [...state.partyStoneIds];
    state.status = 'ENDED';

    expect(() => startEndlessCampaign(state, game.stones, party, new Date('2026-01-01T01:00:00.000Z'), 'replacement')).toThrow(/Claim the previous/);
    claimEndlessCampaign(state);
    expect(() => startEndlessCampaign(state, game.stones, party, new Date('2026-01-01T01:00:00.000Z'), 'replacement')).not.toThrow();
    expect(state.runId).toContain('replacement');
  });

  it('ends cleanly after the configured deepest floor and never schedules an invalid next wake', () => {
    const { state } = fixture();
    state.run!.currentFloor = MAX_ENDLESS_FLOOR;
    state.run!.highestClearedFloor = MAX_ENDLESS_FLOOR - 1;
    state.run!.checkpointFloor = MAX_ENDLESS_FLOOR - 10;
    state.run!.clearedBosses = Math.floor((MAX_ENDLESS_FLOOR - 1) / 10);
    state.highestFloor = MAX_ENDLESS_FLOOR - 1;
    state.weeklyHighestFloor = MAX_ENDLESS_FLOOR - 1;
    setEndlessMode(state, true);
    for (const unit of state.activeBattle!.units) {
      if (unit.side === 'PLAYER') {
        unit.hp = 1_000_000_000_000;
        unit.stats.maxHp = 1_000_000_000_000;
        unit.stats.attack = 1_000_000_000_000;
        unit.stats.defense = 1_000_000_000_000;
        unit.stats.speed = 1_000_000_000_000;
      } else {
        unit.hp = 1;
        unit.stats.maxHp = 1;
        unit.stats.defense = 0;
      }
    }
    setEndlessMode(state, false);

    const summary = advanceEndlessAuto(state, 1, new Date('2026-01-01T00:05:00.000Z'));

    expect(summary).toMatchObject({ attemptedFloors: 1, clearedFloors: 1, toFloor: MAX_ENDLESS_FLOOR, defeated: false });
    expect(state.run).toMatchObject({ status: 'COMPLETE', currentFloor: MAX_ENDLESS_FLOOR, highestClearedFloor: MAX_ENDLESS_FLOOR });
    expect(state.status).toBe('ENDED');
    expect(state.nextFloorAt).toBeNull();
    expect(processEndlessOffline(state, new Date('2027-01-01T00:00:00.000Z'))).toMatchObject({ attemptedFloors: 0, clearedFloors: 0 });
    expect(() => validateEndlessCampaignState(state)).not.toThrow();
  });

  it('clamps aggregated offline completion to the deepest floor', () => {
    const { state } = fixture();
    state.run!.currentFloor = MAX_ENDLESS_FLOOR;
    state.run!.highestClearedFloor = MAX_ENDLESS_FLOOR - 1;
    state.run!.checkpointFloor = MAX_ENDLESS_FLOOR - 10;
    state.run!.clearedBosses = Math.floor((MAX_ENDLESS_FLOOR - 1) / 10);
    state.highestFloor = MAX_ENDLESS_FLOOR - 1;
    state.weeklyHighestFloor = MAX_ENDLESS_FLOOR - 1;
    for (const member of state.partySnapshot) {
      member.stats.maxHp = 1_000_000_000_000;
      member.stats.attack = 1_000_000_000_000;
      member.stats.defense = 1_000_000_000_000;
      member.stats.speed = 1_000_000_000_000;
      member.stats.breakPower = 1_000_000_000_000;
    }

    const summary = processEndlessOffline(state, new Date('2026-01-01T00:05:00.000Z'));

    expect(summary).toMatchObject({ attemptedFloors: 1, clearedFloors: 1, toFloor: MAX_ENDLESS_FLOOR, defeated: false });
    expect(state.run).toMatchObject({ status: 'COMPLETE', currentFloor: MAX_ENDLESS_FLOOR, highestClearedFloor: MAX_ENDLESS_FLOOR });
    expect(state.status).toBe('ENDED');
    expect(state.nextFloorAt).toBeNull();
    expect(() => validateEndlessCampaignState(state)).not.toThrow();
  });

  it('rejects malformed loot filters, duplicate equipment ids, and incoherent run state', () => {
    const { state } = fixture();
    expect(() => validateEndlessCampaignState(state)).not.toThrow();

    const badFilter = structuredClone(state) as unknown as Record<string, any>;
    badFilter.lootFilter = { minRarity: 'IMPOSSIBLE', autoSalvage: true };
    expect(() => validateEndlessCampaignState(badFilter)).toThrow(/loot rarity/);

    const duplicateEquipment = structuredClone(state);
    const item = generateEquipment({ level: 10 }, new SeededRng('duplicate-validation'));
    duplicateEquipment.equipment.items = [item, structuredClone(item)];
    expect(() => validateEndlessCampaignState(duplicateEquipment)).toThrow(/Duplicate Endless equipment id/);

    const endedClimber = structuredClone(state);
    endedClimber.status = 'ENDED';
    endedClimber.nextFloorAt = null;
    expect(() => validateEndlessCampaignState(endedClimber)).toThrow(/Unclaimed climbing run/);

    const pastMaximum = structuredClone(state);
    pastMaximum.run!.currentFloor = MAX_ENDLESS_FLOOR + 1;
    expect(() => validateEndlessCampaignState(pastMaximum)).toThrow(/floor bounds/);

    const invalidGlobalMaximum = structuredClone(state);
    invalidGlobalMaximum.highestFloor = MAX_ENDLESS_FLOOR + 1;
    expect(() => validateEndlessCampaignState(invalidGlobalMaximum)).toThrow(/campaign bounds/);
  });

  it('rejects malformed essential nested combat structures', () => {
    const { state } = fixture();
    const malformedSnapshot = structuredClone(state) as unknown as Record<string, any>;
    malformedSnapshot.partySnapshot[0].stats.attack = Number.NaN;
    expect(() => validateEndlessCampaignState(malformedSnapshot)).toThrow(/combatant attack/);

    const malformedSkill = structuredClone(state) as unknown as Record<string, any>;
    const firstSkill = Object.keys(malformedSkill.skillBook)[0];
    malformedSkill.skillBook[firstSkill].effects = 'damage';
    expect(() => validateEndlessCampaignState(malformedSkill)).toThrow(/skill definition/);

    const incompleteBattle = structuredClone(state) as unknown as Record<string, any>;
    incompleteBattle.activeFloor = { floor: 1 };
    expect(() => validateEndlessCampaignState(incompleteBattle)).toThrow(/Incomplete Endless active battle/);
  });

  it('strictly validates encounter metadata and upgrades legacy persisted battles', () => {
    const { state } = fixture();
    setEndlessMode(state, true);
    const legacy = structuredClone(state) as unknown as Record<string, any>;
    delete legacy.activeFloor.encounterType;
    delete legacy.activeFloor.encounter;
    delete legacy.run.resonanceIntegrity;
    expect(() => validateEndlessCampaignState(legacy)).not.toThrow();
    expect(legacy.activeFloor).toMatchObject({ encounterType: 'BATTLE', encounter: { outcomeRoll: 0.5 } });
    expect(legacy.run.resonanceIntegrity).toBe(100);

    const malformed = structuredClone(state) as unknown as Record<string, any>;
    malformed.activeFloor.encounter.outcomeRoll = Number.NaN;
    expect(() => validateEndlessCampaignState(malformed)).toThrow(/encounter outcomeRoll/);

    const nonCombatBattle = structuredClone(state) as unknown as Record<string, any>;
    nonCombatBattle.activeFloor = Array.from({ length: 100 }, (_, index) => generateEndlessFloor(index + 2, state.run!.seed))
      .find((floor) => !isEndlessCombatEncounter(floor));
    nonCombatBattle.run.currentFloor = nonCombatBattle.activeFloor.floor;
    expect(() => validateEndlessCampaignState(nonCombatBattle)).toThrow(/Non-combat.*battle/);
  });

  it('accepts valid ready and paused campaigns including a persisted manual battle', () => {
    expect(() => validateEndlessCampaignState(createInitialEndlessCampaign(new Date('2026-01-01T00:00:00.000Z')))).not.toThrow();
    const { state } = fixture();
    setEndlessMode(state, true);
    pauseEndlessCampaign(state, new Date('2026-01-01T00:01:00.000Z'));
    expect(() => validateEndlessCampaignState(state)).not.toThrow();
  });

  it('retains weekly progress within an ISO week and resets it at the week boundary', () => {
    const game = createInitialGameState({ seed: 'weekly-campaign', accountId: 'weekly-account' });
    const party = Object.keys(game.stones).slice(0, 3);
    const sameWeek = createInitialEndlessCampaign(new Date('2026-01-05T00:00:00.000Z'));
    const originalWeek = sameWeek.weeklySeed;
    sameWeek.weeklyHighestFloor = 321;
    startEndlessCampaign(sameWeek, game.stones, party, new Date('2026-01-08T00:00:00.000Z'), 'same-week');
    expect(sameWeek.weeklySeed).toBe(originalWeek);
    expect(sameWeek.run!.seed).toBe(originalWeek);
    expect(sameWeek.weeklyHighestFloor).toBe(321);

    const sameWeekSecondRun = createInitialEndlessCampaign(new Date('2026-01-05T00:00:00.000Z'));
    startEndlessCampaign(sameWeekSecondRun, game.stones, party, new Date('2026-01-09T00:00:00.000Z'), 'different-caller-seed');
    expect(generateEndlessFloor(47, sameWeekSecondRun.run!.seed)).toEqual(generateEndlessFloor(47, sameWeek.run!.seed));

    const nextWeek = createInitialEndlessCampaign(new Date('2026-01-05T00:00:00.000Z'));
    nextWeek.weeklyHighestFloor = 654;
    startEndlessCampaign(nextWeek, game.stones, party, new Date('2026-01-12T00:00:00.000Z'), 'next-week');
    expect(nextWeek.weeklySeed).not.toBe(originalWeek);
    expect(nextWeek.run!.seed).toBe(nextWeek.weeklySeed);
    expect(nextWeek.weeklyHighestFloor).toBe(0);
  });
});
