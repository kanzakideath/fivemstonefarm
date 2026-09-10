import { describe, expect, it } from 'vitest';
import { SPECIES_BY_ID } from '../data';
import { SeededRng } from './rng';
import { gainAffinity, gainStoneXp, generateStone, isPerfectIv, validateStone } from './stone';
import type { Clock } from './types';

const clock: Clock = { now: () => new Date('2026-09-10T00:00:00.000Z') };
const owner = { accountId: 'account_test', username: 'Tester' };

describe('stone instances', () => {
  it('replays generation exactly from an injected seed', () => {
    const options = { species: SPECIES_BY_ID.species_quartzling!, origin: 'NATURAL' as const, owner, clock };
    const first = generateStone({ ...options, rng: new SeededRng('same-seed') });
    const second = generateStone({ ...options, rng: new SeededRng('same-seed') });
    expect(first).toEqual(second);
    expect(validateStone(first)).toEqual([]);
    expect(first.stats.maxHp).toBeGreaterThan(0);
    expect(first.serialNumber).toContain('QUARTZLING');
  });

  it('makes PERFECT mutation a genuinely perfect individual', () => {
    const stone = generateStone({ species: SPECIES_BY_ID.species_worldheart!, origin: 'FUSION', owner, clock, rng: new SeededRng('perfect'), mutation: 'PERFECT' });
    expect(isPerfectIv(stone.individualValues)).toBe(true);
    expect(Object.values(stone.individualValues)).toEqual([31, 31, 31, 31, 31, 31]);
  });

  it('applies multi-level XP, new skills and affinity ranks', () => {
    const stone = generateStone({ species: SPECIES_BY_ID.species_emberite!, origin: 'EVENT', owner, clock, rng: new SeededRng('growth') });
    const beforePower = stone.stats.power;
    const result = gainStoneXp(stone, 100_000);
    const affinity = gainAffinity(stone, 1_500);
    expect(result.levelsGained).toBeGreaterThan(10);
    expect(stone.stats.power).toBeGreaterThan(beforePower);
    expect(stone.skills.some((skill) => skill.skillId === 'skill_ember_lance')).toBe(true);
    expect(affinity.rank).toBeGreaterThanOrEqual(4);
  });
});

