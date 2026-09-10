import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stoneverseApi } from '../api/stoneverseApi';
import { cloneGameState } from '../domain/state';
import type { LeaderboardEntry } from '../domain/types';
import { stoneverseStore } from '../store/stoneverseStore';
import { useStoneverseGame } from './useStoneverseGame';

const leaderboardEntry = (username: string, value: number): LeaderboardEntry => ({
  rank: 1,
  previousRank: 2,
  accountId: `account-${username}`,
  username,
  avatarId: 'avatar-test',
  frameId: 'frame-test',
  titleId: 'title-test',
  value,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe('useStoneverseGame public API bridge', () => {
  beforeEach(() => {
    stoneverseApi.events.clear();
    stoneverseStore.getState().resetGame({ seed: 'ui-api-bridge' });
    stoneverseStore.getState().updateSettings({ reduceMotion: true });
  });

  afterEach(() => {
    cleanup();
    stoneverseApi.events.clear();
    vi.restoreAllMocks();
  });

  it('reacts to public stone-detail navigation using the store selection', async () => {
    const { result } = renderHook(() => useStoneverseGame());
    const stoneId = result.current.stones[0].id;

    act(() => stoneverseApi.openStoneDetail(stoneId));

    await waitFor(() => {
      expect(result.current.route).toBe('collection');
      expect(result.current.selectedStoneId).toBe(stoneId);
    });
    act(() => result.current.selectStone(undefined));
    expect(stoneverseStore.getState().selectedStoneId).toBeNull();
  });

  it('projects every occupied expedition slot and exposes repeat-stop control', async () => {
    const upgraded = cloneGameState(stoneverseStore.getState().game);
    upgraded.facilities.expeditionGuild = 3;
    upgraded.settings.developerMode = true;
    stoneverseStore.setState({ game: upgraded });
    const speciesId = Object.values(upgraded.stones)[0]!.speciesId;
    while (Object.keys(stoneverseStore.getState().game.stones).length < 6) stoneverseStore.getState().createPerfectStone(speciesId);
    const stoneIds = Object.keys(stoneverseStore.getState().game.stones);
    stoneverseStore.getState().setParty(stoneIds.slice(0, 3));
    const first = stoneverseStore.getState().startExpedition({ regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED' });
    stoneverseStore.getState().setParty(stoneIds.slice(3, 6));
    const second = stoneverseStore.getState().startExpedition({ regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: true });

    const { result } = renderHook(() => useStoneverseGame());
    expect(result.current.expeditionModel).toMatchObject({ usedSlots: 2, availableSlots: 2 });
    expect(result.current.expeditionModel.runs.map((run) => run.id)).toEqual([second.expeditionId, first.expeditionId]);

    act(() => { result.current.stopExpedition(second.expeditionId); });
    await waitFor(() => expect(result.current.expeditionModel.runs.find((run) => run.id === second.expeditionId)).toMatchObject({ repeat: false, canStop: false }));
  });

  it('processes UI gameplay once and publishes every gameplay event externally', async () => {
    const seeded = cloneGameState(stoneverseStore.getState().game);
    seeded.unappraisedFinds.push({
      discoveryId: 'ui-bridge-discovery',
      seed: 'ui-bridge-discovery-seed',
      veinId: 'vein_crystal',
      areaId: 'area_greenbreak',
      discoveredAt: new Date().toISOString(),
      hintedRarity: 'NORMAL',
      sourceEventId: 'ui-bridge-source',
    });
    stoneverseStore.setState({ game: seeded });

    const mined = vi.fn();
    const discovered = vi.fn();
    const levelUp = vi.fn();
    const fused = vi.fn();
    const gacha = vi.fn();
    const battleStarted = vi.fn();
    const battleFinished = vi.fn();
    stoneverseApi.on('stone:mined', mined);
    stoneverseApi.on('stone:discovered', discovered);
    stoneverseApi.on('stone:levelUp', levelUp);
    stoneverseApi.on('stone:fused', fused);
    stoneverseApi.on('gacha:result', gacha);
    stoneverseApi.on('battle:started', battleStarted);
    stoneverseApi.on('battle:finished', battleFinished);

    const { result } = renderHook(() => useStoneverseGame());
    const starterIds = result.current.stones.slice(0, 2).map((stone) => stone.id);

    const stonesBeforeAppraisal = Object.keys(stoneverseApi.getStoneverseState().stones).length;
    await act(async () => { await result.current.appraise('ui-bridge-discovery'); });
    expect(Object.keys(stoneverseApi.getStoneverseState().stones)).toHaveLength(stonesBeforeAppraisal + 1);

    act(() => { result.current.train(starterIds[0]); });

    const ticketsBefore = stoneverseApi.getStoneverseState().inventory.currencies.gachaTickets;
    await act(async () => { await result.current.pullGacha(1); });
    expect(stoneverseApi.getStoneverseState().inventory.currencies.gachaTickets).toBe(ticketsBefore - 1);

    const fusionsBefore = stoneverseApi.getStoneverseState().statistics.fusionCount;
    await act(async () => { await result.current.fuse(starterIds); });
    expect(stoneverseApi.getStoneverseState().statistics.fusionCount).toBe(fusionsBefore + 1);

    const battlesBefore = stoneverseApi.getStoneverseState().statistics.battleWins + stoneverseApi.getStoneverseState().statistics.battleLosses;
    await act(async () => { await result.current.startBattle(); });
    expect(stoneverseApi.getStoneverseState().activeBattle?.winner).toBeNull();
    act(() => { result.current.setBattleAuto(true); });
    act(() => { stoneverseApi.runBattle(); });
    const afterBattle = stoneverseApi.getStoneverseState();
    expect(afterBattle.statistics.battleWins + afterBattle.statistics.battleLosses).toBe(battlesBefore + 1);

    const minedBefore = stoneverseApi.getFarmStatistics().totalMined;
    await act(async () => {
      await result.current.mine();
      await new Promise((resolve) => window.setTimeout(resolve, 70));
    });
    expect(stoneverseApi.getFarmStatistics().totalMined).toBe(minedBefore + 1);

    expect(discovered).toHaveBeenCalledOnce();
    expect(levelUp).toHaveBeenCalledOnce();
    expect(gacha).toHaveBeenCalledOnce();
    expect(fused).toHaveBeenCalledOnce();
    expect(battleStarted).toHaveBeenCalledOnce();
    expect(battleFinished).toHaveBeenCalledOnce();
    expect(mined).toHaveBeenCalledOnce();
  });

  it('preserves the selected ranking category when game dependencies refresh', async () => {
    const getLeaderboard = vi.spyOn(stoneverseApi, 'getLeaderboard').mockImplementation((category) => Promise.resolve([
      leaderboardEntry(category === 'PVP' ? 'ArenaLeader' : 'TotalLeader', 999_999_999),
    ]));
    const { result } = renderHook(() => useStoneverseGame());

    await waitFor(() => {
      expect(result.current.rankingCategory).toBe('TOTAL_MINING');
      expect(result.current.rankingCategoryLabel).toBe('総合採掘');
      expect(result.current.rankings[0]?.name).toBe('TotalLeader');
    });
    await act(async () => { await result.current.loadRankings('アリーナ'); });
    expect(getLeaderboard).toHaveBeenLastCalledWith('PVP', 1_000);
    expect(result.current.rankingCategory).toBe('PVP');
    expect(result.current.rankingCategoryLabel).toBe('アリーナ');
    expect(result.current.rankings[0]?.name).toBe('ArenaLeader');

    const pvpCallsBeforeRefresh = getLeaderboard.mock.calls.filter(([category]) => category === 'PVP').length;
    const refreshed = cloneGameState(stoneverseStore.getState().game);
    refreshed.account.arenaRating += 1;
    act(() => stoneverseStore.setState({ game: refreshed }));

    await waitFor(() => {
      const pvpCalls = getLeaderboard.mock.calls.filter(([category]) => category === 'PVP');
      expect(pvpCalls.length).toBeGreaterThan(pvpCallsBeforeRefresh);
      expect(getLeaderboard).toHaveBeenLastCalledWith('PVP', 1_000);
      expect(result.current.rankingCategoryLabel).toBe('アリーナ');
      expect(result.current.rankings[0]?.name).toBe('ArenaLeader');
    });
  });

  it('maps added activity rankings and omits unmeasured local Endless metrics', async () => {
    const seeded = cloneGameState(stoneverseStore.getState().game);
    seeded.endlessMine.weeklyHighestFloor = 41;
    seeded.endlessMine.highestFloor = 64;
    seeded.expeditions.totalCycles = 7;
    stoneverseStore.setState({ game: seeded });
    const getLeaderboard = vi.spyOn(stoneverseApi, 'getLeaderboard').mockResolvedValue([
      leaderboardEntry('MockLeader', 999_999),
    ]);
    const { result } = renderHook(() => useStoneverseGame());
    await waitFor(() => expect(getLeaderboard).toHaveBeenCalledWith('TOTAL_MINING', 1_000));

    await act(async () => { await result.current.loadRankings('Endless最高階層'); });
    expect(getLeaderboard).toHaveBeenLastCalledWith('ENDLESS_HIGHEST_FLOOR', 1_000);
    expect(result.current.rankingCategoryLabel).toBe('Endless最高階層');
    expect(result.current.rankings.find((entry) => entry.isPlayer)?.score).toBe(41);

    await act(async () => { await result.current.loadRankings('遠征スコア'); });
    expect(getLeaderboard).toHaveBeenLastCalledWith('EXPEDITION_SCORE', 1_000);
    expect(result.current.rankings.find((entry) => entry.isPlayer)?.score).toBe(1_725);

    await act(async () => { await result.current.loadRankings('最速踏破'); });
    expect(getLeaderboard).toHaveBeenLastCalledWith('ENDLESS_FASTEST_CLEAR', 1_000);
    expect(result.current.rankingCategoryLabel).toBe('最速踏破');
    expect(result.current.rankings.some((entry) => entry.isPlayer)).toBe(false);
  });

  it('ignores stale ranking responses and keeps current rows after a failed request', async () => {
    const getLeaderboard = vi.spyOn(stoneverseApi, 'getLeaderboard').mockResolvedValue([]);
    const { result } = renderHook(() => useStoneverseGame());
    await waitFor(() => expect(getLeaderboard).toHaveBeenCalledWith('TOTAL_MINING', 1_000));

    const pvp = deferred<LeaderboardEntry[]>();
    const raid = deferred<LeaderboardEntry[]>();
    getLeaderboard.mockImplementation((category) => {
      if (category === 'PVP') return pvp.promise;
      if (category === 'RAID') return raid.promise;
      return Promise.resolve([]);
    });

    let pvpLoad!: Promise<void>;
    let raidLoad!: Promise<void>;
    act(() => {
      pvpLoad = result.current.loadRankings('アリーナ');
      raidLoad = result.current.loadRankings('レイド');
    });
    raid.resolve([leaderboardEntry('RaidLeader', 999_999_999)]);
    await act(async () => { await raidLoad; });
    await waitFor(() => {
      expect(result.current.rankingCategory).toBe('RAID');
      expect(result.current.rankingCategoryLabel).toBe('レイド');
      expect(result.current.rankings[0]?.name).toBe('RaidLeader');
    });

    pvp.resolve([leaderboardEntry('LateArenaLeader', 999_999_999)]);
    await act(async () => { await pvpLoad; });
    expect(result.current.rankingCategory).toBe('RAID');
    expect(result.current.rankingCategoryLabel).toBe('レイド');
    expect(result.current.rankings[0]?.name).toBe('RaidLeader');

    getLeaderboard.mockRejectedValueOnce(new Error('ranking offline'));
    await act(async () => { await expect(result.current.loadRankings('図鑑')).resolves.toBeUndefined(); });
    expect(result.current.rankingCategory).toBe('RAID');
    expect(result.current.rankingCategoryLabel).toBe('レイド');
    expect(result.current.rankings[0]?.name).toBe('RaidLeader');

    const refreshed = cloneGameState(stoneverseStore.getState().game);
    refreshed.collection.discoveredSpeciesIds.push('ranking-refresh-marker');
    act(() => stoneverseStore.setState({ game: refreshed }));
    await waitFor(() => {
      expect(getLeaderboard).toHaveBeenLastCalledWith('RAID', 1_000);
      expect(result.current.rankingCategoryLabel).toBe('レイド');
      expect(result.current.rankings[0]?.name).toBe('RaidLeader');
    });
  });
});
