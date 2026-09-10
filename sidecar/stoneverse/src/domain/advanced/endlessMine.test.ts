import { describe, expect, it } from 'vitest';
import { SeededRng } from '../rng';
import type { CombatantTemplate, CombatStats } from './combat';
import {
  ENDLESS_ENCOUNTER_TYPES,
  advanceEndlessFloor,
  autoClimb,
  calculateEndlessPartyPower,
  createEndlessRun,
  generateEndlessFloor,
  getEndlessFloorPowerRequirement,
  isEndlessCombatEncounter,
  resolveEndlessFloorByPower,
  resumeEndlessFromCheckpoint,
  settleEndlessIntegrity,
  simulateEndlessFloors,
  simulateOfflineProgress,
} from './endlessMine';

const stats: CombatStats = {
  maxHp: 100_000,
  attack: 12_000,
  defense: 8_000,
  speed: 160,
  accuracy: 200,
  resistance: 180,
  critChance: 0.2,
  critDamage: 1.8,
  breakPower: 80,
};

const party: CombatantTemplate[] = [
  { id: 'climber', name: 'Climber', side: 'PLAYER', role: 'STRIKER', family: 'quartz', level: 1_000, stats, skillIds: ['strike', 'sweep', 'fracture', 'nova'], initialUltimate: 100 },
];

describe('endless mine', () => {
  it('procedurally generates deterministic rules and a boss every tenth floor', () => {
    expect(generateEndlessFloor(37, 'seed')).toEqual(generateEndlessFloor(37, 'seed'));
    expect(generateEndlessFloor(9).isBossFloor).toBe(false);
    const bossFloor = generateEndlessFloor(10);
    expect(bossFloor.isBossFloor).toBe(true);
    expect(bossFloor.rules.some((rule) => rule.id === 'BOSS_FLOOR')).toBe(true);
    expect(bossFloor.enemies[0]?.boss).toBeDefined();
  });

  it('generates every encounter class with combat-safe enemy cardinality and one stable weekly rule', () => {
    const floors = Array.from({ length: 300 }, (_, index) => generateEndlessFloor(index + 1, 'encounter-coverage'));
    expect(new Set(floors.map((floor) => floor.encounterType))).toEqual(new Set(ENDLESS_ENCOUNTER_TYPES));
    for (const floor of floors) {
      expect(floor.enemies.length > 0).toBe(isEndlessCombatEncounter(floor));
      expect(floor.isBossFloor).toBe(floor.encounterType === 'BOSS');
      expect(floor.rules.filter((rule) => rule.id.startsWith('WEEKLY_'))).toHaveLength(1);
    }
    const weeklyIds = new Set(floors.map((floor) => floor.rules.find((rule) => rule.id.startsWith('WEEKLY_'))!.id));
    expect(weeklyIds.size).toBe(1);
  });

  it('resolves non-combat risk deterministically from floor definition and effective party power', () => {
    const floor = Array.from({ length: 100 }, (_, index) => generateEndlessFloor(index + 2, 'noncombat-resolution'))
      .find((candidate) => !isEndlessCombatEncounter(candidate) && candidate.encounterType !== 'REST')!;
    const required = getEndlessFloorPowerRequirement(floor);
    expect(required).toBeGreaterThan(0);
    expect(resolveEndlessFloorByPower(floor, required)).toEqual(resolveEndlessFloorByPower(generateEndlessFloor(floor.floor, 'noncombat-resolution'), required));
    expect(resolveEndlessFloorByPower(floor, required).outcome).toBe('PLAYER');
    expect(resolveEndlessFloorByPower(floor, Math.max(0, required - 1)).outcome).toBe('ENEMY');
  });

  it('makes rest floors safe and exposes their concrete recovery', () => {
    const rest = Array.from({ length: 200 }, (_, index) => generateEndlessFloor(index + 2, 'rest-recovery'))
      .find((floor) => floor.encounterType === 'REST')!;
    expect(resolveEndlessFloorByPower(rest, 0)).toMatchObject({ outcome: 'PLAYER', turns: 0, encounterType: 'REST', recoveredRatio: 0.3 });
    expect(getEndlessFloorPowerRequirement(rest)).toBe(0);
    expect(calculateEndlessPartyPower(party)).toBeGreaterThan(0);
    const run = createEndlessRun('rest-integrity', 'ACTIVE');
    run.resonanceIntegrity = 41;
    expect(settleEndlessIntegrity(run, rest, true)).toBe(30);
    expect(run.resonanceIntegrity).toBe(71);
  });

  it('persists deterministic encounter wear and checkpoint recovery', () => {
    const battle = generateEndlessFloor(1, 'integrity-wear');
    const left = createEndlessRun('integrity-wear', 'AUTO');
    const right = structuredClone(left);
    settleEndlessIntegrity(left, battle, true);
    settleEndlessIntegrity(right, generateEndlessFloor(1, 'integrity-wear'), true);
    expect(left.resonanceIntegrity).toBeLessThan(100);
    expect(left.resonanceIntegrity).toBe(right.resonanceIntegrity);
    left.status = 'DEFEATED';
    left.checkpointFloor = 10;
    left.currentFloor = 13;
    left.resonanceIntegrity = 7;
    resumeEndlessFromCheckpoint(left);
    expect(left.resonanceIntegrity).toBe(50);
  });

  it('replays a combat floor identically for the same seed, floor, party and strategies', () => {
    const left = createEndlessRun('combat-result-determinism', 'AUTO');
    const right = createEndlessRun('combat-result-determinism', 'AUTO');
    const leftResolution = advanceEndlessFloor(left, party);
    const rightResolution = advanceEndlessFloor(right, party);
    expect(leftResolution).toEqual(rightResolution);
    expect(left).toEqual(right);
  });

  it('auto-climbs, records checkpoints, stops on defeat and resumes from the checkpoint', () => {
    const run = createEndlessRun('checkpoint', 'AUTO');
    autoClimb(run, party, {
      maxBattles: 20,
      config: { maxFloor: 20, checkpointInterval: 10 },
      resolveFloor: (_battle, floor) => ({ outcome: floor.floor <= 12 ? 'PLAYER' : 'ENEMY', turns: 3 }),
    });
    expect(run.status).toBe('DEFEATED');
    expect(run.highestClearedFloor).toBe(12);
    expect(run.lastDefeatFloor).toBe(13);
    expect(run.checkpointFloor).toBe(10);
    resumeEndlessFromCheckpoint(run);
    expect(run.status).toBe('CLIMBING');
    expect(run.currentFloor).toBe(11);
  });

  it('does not award credits or boss clears twice when replaying from a checkpoint', () => {
    const run = createEndlessRun('checkpoint-reward-ledger', 'AUTO');
    autoClimb(run, party, {
      maxBattles: 20,
      config: { maxFloor: 20, checkpointInterval: 10 },
      resolveFloor: (_battle, floor) => ({ outcome: floor.floor <= 12 ? 'PLAYER' : 'ENEMY', turns: 1 }),
    });
    const firstClearReward = run.totalReward;
    const firstBosses = run.clearedBosses;
    resumeEndlessFromCheckpoint(run);
    autoClimb(run, party, {
      maxBattles: 2,
      config: { maxFloor: 20, checkpointInterval: 10 },
      resolveFloor: () => ({ outcome: 'PLAYER', turns: 1 }),
    });

    expect(run.highestClearedFloor).toBe(12);
    expect(run.totalReward).toBe(firstClearReward);
    expect(run.clearedBosses).toBe(firstBosses);
    advanceEndlessFloor(run, party, { config: { maxFloor: 20 }, resolveFloor: () => ({ outcome: 'PLAYER', turns: 1 }) });
    expect(run.highestClearedFloor).toBe(13);
    expect(run.totalReward).toBeGreaterThan(firstClearReward);
  });

  it('applies explicit active, auto and offline efficiency without changing base floors', () => {
    const active = createEndlessRun('efficiency', 'ACTIVE');
    const automatic = createEndlessRun('efficiency', 'AUTO');
    const offline = createEndlessRun('efficiency', 'OFFLINE');
    const win = { resolveFloor: () => ({ outcome: 'PLAYER' as const, turns: 1 }) };
    advanceEndlessFloor(active, party, win);
    advanceEndlessFloor(automatic, party, win);
    advanceEndlessFloor(offline, party, win);
    expect(active.totalReward).toBeGreaterThan(automatic.totalReward);
    expect(automatic.totalReward).toBeGreaterThan(offline.totalReward);
  });

  it('aggregates floors 1 through 1000 with 100 bosses and no non-finite values', () => {
    const aggregate = simulateEndlessFloors(1, 1_000, 'floor-1000-regression');
    expect(aggregate).toMatchObject({ floors: 1_000, bossFloors: 100, finite: true });
    expect(aggregate.enemies).toBeGreaterThan(1_000);
    expect(aggregate.totalBaseReward).toBeGreaterThan(0);
    const finalFloor = generateEndlessFloor(1_000, 'floor-1000-regression');
    expect(finalFloor.isBossFloor).toBe(true);
    expect(finalFloor.difficulty).toBeGreaterThan(generateEndlessFloor(1, 'floor-1000-regression').difficulty);
    expect(Object.values(finalFloor.enemies[0]!.stats).every(Number.isFinite)).toBe(true);
    const deepSafetyFloor = generateEndlessFloor(1_000_000, 'deep-safety');
    expect(deepSafetyFloor.floor).toBe(1_000_000);
    expect(Object.values(deepSafetyFloor.enemies[0]!.stats).every(Number.isFinite)).toBe(true);
  });

  it('auto-progresses the complete Floor 1-1000 state machine with checkpoints and bounded rewards', () => {
    const run = createEndlessRun('floor-1000-auto-state', 'AUTO');
    autoClimb(run, party, {
      maxBattles: 1_000,
      config: { maxFloor: 1_000, checkpointInterval: 10 },
      resolveFloor: () => ({ outcome: 'PLAYER', turns: 1 }),
    });

    expect(run).toMatchObject({
      status: 'COMPLETE',
      currentFloor: 1_000,
      highestClearedFloor: 1_000,
      checkpointFloor: 1_000,
      clearedBosses: 100,
      battles: 1_000,
    });
    expect(Number.isSafeInteger(run.totalReward)).toBe(true);
    expect(run.totalReward).toBeGreaterThan(0);
  });

  it('merges a host skill book for real Stone party adapters', () => {
    const realSkill = { id: 'skill_stone_strike', name: 'Real Stone Strike', target: 'ENEMY' as const, effects: [{ kind: 'DAMAGE' as const, power: 1 }] };
    const realParty: CombatantTemplate[] = [{ ...party[0]!, skillIds: [realSkill.id] }];
    const run = createEndlessRun('host-skills', 'ACTIVE');
    advanceEndlessFloor(run, realParty, {
      skills: { [realSkill.id]: realSkill },
      resolveFloor: (battle) => {
        expect(battle.skills[realSkill.id]).toBeDefined();
        expect(battle.skills.strike).toBeDefined();
        return { outcome: 'PLAYER', turns: 1 };
      },
    });
    expect(run.highestClearedFloor).toBe(1);
  });

  it('bounds offline simulation and rejects NaN inputs', () => {
    const run = createEndlessRun('offline', 'OFFLINE');
    const result = simulateOfflineProgress(run, 10_000, Number.MAX_SAFE_INTEGER, { maxOfflineHours: 2, offlineFloorsPerHour: 10 });
    expect(result.attemptedFloors).toBe(20);
    expect(result.clearedFloors).toBeLessThanOrEqual(20);
    expect(Number.isSafeInteger(result.reward)).toBe(true);
    expect(() => simulateOfflineProgress(run, Number.NaN, 1_000)).toThrow(/finite/);
    expect(() => advanceEndlessFloor(run, party, { rng: new SeededRng('unused'), config: { efficiency: { OFFLINE: Number.NaN } as never } })).toThrow(/efficiency/);
  });

  it('counts only the first failed floor as attempted instead of the whole offline budget', () => {
    const run = createEndlessRun('offline-defeat-count', 'OFFLINE');
    const result = simulateOfflineProgress(run, 100, 0, { offlineFloorsPerHour: 12 });
    expect(result).toMatchObject({ attemptedFloors: 1, clearedFloors: 0, stoppedAtFloor: 1 });
  });
});
