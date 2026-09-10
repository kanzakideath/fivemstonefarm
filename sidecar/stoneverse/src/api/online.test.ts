import { describe, expect, it } from 'vitest';
import { enqueueOnlineEvent } from '../domain/onlineQueue';
import { SeededRng } from '../domain/rng';
import { createInitialGameState } from '../domain/state';
import type { Clock, LeaderboardCategory } from '../domain/types';
import { MockOnlineAdapter } from './online';

const clock: Clock = { now: () => new Date('2026-09-10T06:00:00.000Z') };

describe('online authority and idempotency', () => {
  it('accepts an event once and returns the same receipt for a replay', async () => {
    const state = createInitialGameState({ seed: 'online', clock });
    const event = enqueueOnlineEvent(state, 'MINING_RECORDED', { amount: 3, quality: 0.7 }, new SeededRng('event'), clock, 'online-event-1');
    const adapter = new MockOnlineAdapter({ fakeUserCount: 50, seed: 'server', now: clock.now });
    const first = await adapter.pushEvents([event]);
    const replay = await adapter.pushEvents([event]);
    expect(first.accepted).toHaveLength(1);
    expect(replay.accepted[0]).toEqual(first.accepted[0]);
    expect(replay.rejected).toEqual([]);
  });

  it('rejects impossible mining amounts and supports large mock rankings', async () => {
    const state = createInitialGameState({ seed: 'invalid-online', clock });
    const event = enqueueOnlineEvent(state, 'MINING_RECORDED', { amount: 1_000_000, quality: 0.7 }, new SeededRng('bad-event'), clock, 'bad-mining');
    const adapter = new MockOnlineAdapter({ fakeUserCount: 1_000, seed: 'rankings', now: clock.now });
    const response = await adapter.pushEvents([event]);
    const ranking = await adapter.getLeaderboard('TOTAL_MINING', 100);
    expect(response.rejected[0]?.reason).toMatch(/impossible/i);
    expect(ranking).toHaveLength(100);
    expect(ranking[0]!.value).toBeGreaterThanOrEqual(ranking[99]!.value);
  });

  it('generates every leaderboard deterministically and ranks lower-is-better metrics ascending', async () => {
    const categories: LeaderboardCategory[] = [
      'TOTAL_MINING', 'DAILY_MINING', 'WEEKLY_MINING', 'MONTHLY_MINING', 'COLLECTION', 'ACHIEVEMENTS',
      'PVP', 'RAID', 'RARE_DISCOVERY', 'FUSION', 'ENDLESS_HIGHEST_FLOOR', 'ENDLESS_FASTEST_CLEAR',
      'ENDLESS_FEWEST_DAMAGE', 'EXPEDITION_SCORE', 'BOSS_CLEARS', 'BATTLE_POWER',
    ];
    const first = new MockOnlineAdapter({ fakeUserCount: 120, seed: 'weekly-rankings', now: clock.now });
    const second = new MockOnlineAdapter({ fakeUserCount: 120, seed: 'weekly-rankings', now: clock.now });

    for (const category of categories) {
      const ranking = await first.getLeaderboard(category, 60);
      expect(ranking).toHaveLength(60);
      expect(ranking.every((entry) => Number.isFinite(entry.value))).toBe(true);
      for (let index = 1; index < ranking.length; index += 1) {
        const previous = ranking[index - 1]!.value;
        const current = ranking[index]!.value;
        if (category === 'ENDLESS_FASTEST_CLEAR' || category === 'ENDLESS_FEWEST_DAMAGE') expect(previous).toBeLessThanOrEqual(current);
        else expect(previous).toBeGreaterThanOrEqual(current);
      }
      expect(await second.getLeaderboard(category, 60)).toEqual(ranking);
      expect(await first.getLeaderboard(category, 60)).toEqual(ranking);
    }
  });

  it('returns expanded public activity metrics without exposing its stored mock profile', async () => {
    const adapter = new MockOnlineAdapter({ fakeUserCount: 4, seed: 'public-activity', now: clock.now });
    const profile = await adapter.getPublicProfile('mock_00000');
    expect(profile).toMatchObject({
      currentExpeditionCount: expect.any(Number),
      expeditionCount: expect.any(Number),
      bossKills: expect.any(Number),
      battleWins: expect.any(Number),
      battlePower: expect.any(Number),
      favoriteStoneCount: expect.any(Number),
      perfectStoneCount: expect.any(Number),
      mutationCollectionCount: expect.any(Number),
      fastestEndlessClearTurns: expect.any(Number),
      fewestEndlessDamage: expect.any(Number),
    });
    expect(profile?.highestEndlessFloor).toBeGreaterThanOrEqual(profile?.weeklyHighestEndlessFloor ?? 0);

    profile!.username = 'mutated outside';
    profile!.bestTeamStoneIds!.length = 0;
    const fresh = await adapter.getPublicProfile('mock_00000');
    expect(fresh?.username).not.toBe('mutated outside');
    expect(fresh?.bestTeamStoneIds?.length).toBeGreaterThan(0);
  });
});
