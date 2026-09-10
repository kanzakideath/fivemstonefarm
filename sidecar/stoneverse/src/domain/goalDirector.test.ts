import { describe, expect, it } from 'vitest';
import { directNextGoals } from './goalDirector';

describe('goal director', () => {
  it('surfaces 3-5 diverse live goals and prioritises claimable work', () => {
    const goals = directNextGoals({
      expedition: { active: true, remainingMinutes: 18, completedCycles: 2 },
      endless: { floor: 98, nextBossFloor: 100, running: true },
      training: { active: true, readyXp: 420 },
      research: { active: true, ready: true, remainingMinutes: 0 },
      collection: { discovered: 8, total: 12 },
      fusionCount: 3,
      weeklyWins: 1,
    });
    expect(goals).toHaveLength(5);
    expect(goals[0]?.id).toBe('research-ready');
    expect(new Set(goals.map((goal) => goal.kind)).size).toBe(goals.length);
    expect(goals.some((goal) => goal.id === 'endless-boss')).toBe(true);
  });

  it('offers empty background slots without daily coercion', () => {
    const goals = directNextGoals({ collection: { discovered: 1, total: 20 }, fusionCount: 0, weeklyWins: 0 });
    expect(goals.map((goal) => goal.id)).toContain('expedition-start');
    expect(goals.map((goal) => goal.id)).toContain('training-empty');
    expect(goals.map((goal) => goal.id)).toContain('research-empty');
  });
});
