import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './state';
import { createInitialMasteryState, gainStoneXpWithMastery, masteryPassiveMultiplier } from './mastery';
import { stoneMaxLevel } from './stone';

describe('post-cap resonance mastery', () => {
  it('converts max-level XP instead of discarding it', () => {
    const game = createInitialGameState({ seed: 'mastery' });
    const stone = Object.values(game.stones)[0]!;
    stone.level = stoneMaxLevel(stone);
    stone.xp = 0;
    const mastery = createInitialMasteryState();
    const result = gainStoneXpWithMastery(stone, mastery, 50_000);
    expect(result.masteryXpGained).toBe(50_000);
    expect(mastery.totalXp).toBe(50_000);
    expect(result.stoneMasteryLevel).toBeGreaterThan(0);
  });

  it('never turns mastery into an uncapped stat multiplier', () => {
    expect(masteryPassiveMultiplier({ xp: 0, level: 99_999, unlockedRewardIds: [] })).toBe(1.05);
  });
});
