import type { StoreApi } from 'zustand/vanilla';
import { cloneGameState } from '../domain/state';
import { isPerfectIv } from '../domain/stone';
import type { StartExpeditionOptions } from '../domain/expedition';
import type { IdleProcessingMode } from '../domain/idle';
import type {
  EndlessAdvanceSummary,
  EndlessCampaignState,
  EndlessClaimResult,
  PlayerAiStrategy,
} from '../domain/endlessCampaign';
import type { MasteryEntry, MasteryGainResult } from '../domain/mastery';
import type { EquipmentItem, LootFilter } from '../domain/advanced';
import { SPECIES } from '../data';
import type {
  AppraisalResult,
  BattleAction,
  BattleState,
  ExpeditionClaimResult,
  ExpeditionRun,
  FusionOptions,
  FusionResult,
  GameState,
  GachaPullResult,
  LeaderboardCategory,
  LeaderboardEntry,
  MiningPayload,
  MiningResult,
  OnlineSyncResult,
  OnlineTransport,
  PublicProfile,
  ResearchProjectId,
  ResearchSlot,
  StoneInstance,
  StoneverseRoute,
  WelcomeBackSummary,
} from '../domain/types';
import { stoneverseStore, type StoneverseStore } from '../store/stoneverseStore';
import { MockOnlineAdapter } from './online';
import {
  StoneverseEventBus,
  type EventUnsubscribe,
  type ResearchClaimReward,
  type StoneverseEventMap,
  type StoneverseEventName,
} from './events';

export type { StartExpeditionOptions } from '../domain/expedition';

export interface FarmStatisticsSnapshot {
  miningLevel: number;
  miningXp: number;
  totalMined: number;
  dailyMined: number;
  weeklyMined: number;
  monthlyMined: number;
  stoneCount: number;
  collectionCount: number;
  revision: number;
}

export interface StoneverseApiOptions {
  store?: Pick<StoreApi<StoneverseStore>, 'getState' | 'subscribe'>;
  online?: OnlineTransport | null;
  events?: StoneverseEventBus;
}

export interface StoneverseApi {
  readonly events: StoneverseEventBus;
  on<K extends StoneverseEventName>(event: K, listener: (payload: StoneverseEventMap[K]) => void): EventUnsubscribe;
  onStoneMined(payload: MiningPayload): MiningResult;
  onFarmSessionStarted(): string;
  onFarmSessionEnded(): void;
  syncFarmStatistics(): Promise<OnlineSyncResult>;
  openStoneverse(): void;
  openProfile(): void;
  openGacha(): void;
  openCollection(): void;
  openRanking(): void;
  openStoneDetail(stoneId: string): void;
  getStoneverseState(): GameState;
  getFarmStatistics(): FarmStatisticsSnapshot;
  exportStoneverseSave(): string;
  importStoneverseSave(serialized: string): void;
  appraiseStone(discoveryId: string): AppraisalResult;
  pullGacha(bannerId: string, count: 1 | 10): GachaPullResult;
  fuseStones(parentIds: readonly string[], options?: FusionOptions): FusionResult;
  trainStone(stoneId: string, xp: number): MasteryGainResult;
  evolveStone(stoneId: string, evolutionId: string, areaId?: string): void;
  awakenStone(stoneId: string): void;
  startDungeonBattle(dungeonId: string, stageId: string): BattleState;
  advanceBattle(): BattleAction[];
  issueBattleCommand(skillId: string, targetIds?: readonly string[]): BattleAction[];
  setBattleAuto(auto: boolean): BattleState;
  setBattleSpeed(speed: 1 | 2 | 4): BattleState;
  runBattle(): BattleState;
  abandonBattle(): void;
  processBackground(mode?: IdleProcessingMode): WelcomeBackSummary | null;
  startExpedition(options: StartExpeditionOptions): ExpeditionRun;
  stopExpedition(expeditionId: string): ExpeditionRun;
  claimExpedition(expeditionId: string): ExpeditionClaimResult;
  claimStoredExpeditionDiscovery(discoveryId: string): StoneInstance;
  startTraining(stoneId: string): void;
  claimTraining(): number;
  stopTraining(): void;
  startAffinityGarden(stoneId: string): void;
  claimAffinityGarden(): number;
  stopAffinityGarden(): void;
  startResearch(projectId: ResearchProjectId): ResearchSlot;
  claimResearch(researchId: string): ResearchClaimReward;
  startEndlessMine(partyStoneIds?: readonly string[]): EndlessCampaignState;
  advanceEndlessMine(maxFloors?: number): EndlessAdvanceSummary;
  setEndlessManual(manual: boolean): EndlessCampaignState;
  setEndlessStrategy(strategy: PlayerAiStrategy): EndlessCampaignState;
  setEndlessSpeed(speed: 1 | 2 | 4): EndlessCampaignState;
  issueEndlessCommand(skillId: string, targetIds?: readonly string[]): EndlessAdvanceSummary | null;
  pauseEndlessMine(): EndlessCampaignState;
  resumeEndlessMine(): EndlessCampaignState;
  claimEndlessMine(): EndlessClaimResult;
  updateEndlessLootFilter(filter: LootFilter): EndlessCampaignState;
  salvageEndlessEquipment(equipmentId: string): number;
  equipEndlessEquipment(equipmentId: string, stoneId: string): void;
  unequipEndlessEquipment(equipmentId: string, stoneId: string): void;
  setEndlessEquipmentLocked(equipmentId: string, locked: boolean): void;
  getPublicProfile(accountId: string): Promise<PublicProfile | null>;
  getLeaderboard(category: LeaderboardCategory, limit?: number): Promise<LeaderboardEntry[]>;
}

const ownProfile = (state: GameState): PublicProfile => {
  const stones = Object.values(state.stones);
  const activeParty = state.parties.find((party) => party.id === state.activePartyId) ?? state.parties[0];
  const bestTeamStoneIds = activeParty?.slots.map((slot) => slot.stoneId).filter((stoneId) => Boolean(state.stones[stoneId])) ?? [];
  const battlePower = bestTeamStoneIds.reduce((total, stoneId) => {
    const stone = state.stones[stoneId];
    return stone
      ? total + Math.round(stone.stats.power * 1.9 + stone.stats.defense * 1.45 + stone.stats.speed * 1.15 + stone.stats.resonance * 1.25 + stone.stats.maxHp * 0.18)
      : total;
  }, 0);
  const mutationCollectionCount = Object.values(state.collection.mutationSpecies)
    .reduce((total, mutations) => total + mutations.filter((mutation) => mutation !== 'NONE').length, 0);
  const currentExpeditionCount = Object.values(state.expeditions.runs).filter((run) => run.status === 'ACTIVE').length;
  const highestEndlessFloor = Math.max(state.endlessMine.highestFloor, state.statistics.highestInfiniteFloor);
  const bossKills = state.account.raidStats.bossesDefeated + Math.floor(highestEndlessFloor / 10);

  return {
    accountId: state.account.accountId,
    username: state.account.username,
    avatarId: state.account.avatarId,
    frameId: state.account.profileFrameId,
    titleId: state.account.equippedTitleId,
    accountLevel: state.accountProgress.level,
    miningLevel: state.mining.level,
    totalMined: state.mining.totalMined,
    collectionPercent: SPECIES.length === 0 ? 0 : Math.round(state.collection.discoveredSpeciesIds.length / SPECIES.length * 100),
    achievementPercent: Object.values(state.achievements).length === 0 ? 0 : Math.round(Object.values(state.achievements).filter((progress) => progress.unlockedAt).length / Object.values(state.achievements).length * 100),
    arenaTier: state.account.arenaTier,
    arenaRating: state.account.arenaRating,
    raidStats: { ...state.account.raidStats },
    showcaseStoneIds: [...state.profile.showcaseStoneIds],
    lastOnlineAt: state.account.lastOnlineAt,
    highestEndlessFloor,
    weeklyHighestEndlessFloor: state.endlessMine.weeklyHighestFloor,
    currentExpeditionCount,
    expeditionCount: state.expeditions.totalCycles,
    expeditionScore: Math.min(Number.MAX_SAFE_INTEGER, state.expeditions.totalCycles * 100 + state.endlessMine.weeklyHighestFloor * 25),
    bossKills,
    battleWins: state.statistics.battleWins,
    battlePower,
    bestTeamStoneIds,
    favoriteStoneIds: [...state.profile.favoriteStoneIds],
    favoriteStoneCount: stones.filter((stone) => stone.favorite).length,
    perfectStoneCount: stones.filter((stone) => isPerfectIv(stone.individualValues)).length,
    mutationCollectionCount,
    // The current save schema does not retain authoritative weekly Endless
    // clear-turn and damage totals, so own profiles explicitly remain unmeasured.
    fastestEndlessClearTurns: null,
    fewestEndlessDamage: null,
  };
};

const cloneBoundaryValue = <T,>(value: T): T => {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

export const createStoneverseApi = (options: StoneverseApiOptions = {}): StoneverseApi => {
  const store = options.store ?? stoneverseStore;
  const online = options.online === undefined ? new MockOnlineAdapter() : options.online;
  const events = options.events ?? new StoneverseEventBus();
  const emitNewAchievements = (before: GameState, after: GameState): void => {
    for (const [achievementId, progress] of Object.entries(after.achievements)) {
      if (progress.unlockedAt && !before.achievements[achievementId]?.unlockedAt) events.emit('achievement:unlocked', { achievementId });
    }
  };

  const cloneEndless = (state: GameState): EndlessCampaignState => cloneGameState(state).endlessMine;
  const cloneMasteryEntry = (entry: MasteryEntry): MasteryEntry => ({
    xp: entry.xp,
    level: entry.level,
    unlockedRewardIds: [...entry.unlockedRewardIds],
  });
  const masteryEntryChanged = (previous: MasteryEntry | undefined, current: MasteryEntry): boolean =>
    !previous
    || previous.xp !== current.xp
    || previous.level !== current.level
    || previous.unlockedRewardIds.length !== current.unlockedRewardIds.length
    || previous.unlockedRewardIds.some((reward, index) => reward !== current.unlockedRewardIds[index]);
  const sameLootFilter = (left: LootFilter, right: LootFilter): boolean =>
    left.minRarity === right.minRarity
    && left.minScore === right.minScore
    && left.autoSalvage === right.autoSalvage
    && (left.allowedSlots ?? []).join('|') === (right.allowedSlots ?? []).join('|')
    && (left.alwaysKeepSets ?? []).join('|') === (right.alwaysKeepSets ?? []).join('|');

  const emitBackgroundTransitions = (operation: string, before: GameState, after: GameState): void => {
    for (const [expeditionId, expedition] of Object.entries(after.expeditions.runs)) {
      const previous = before.expeditions.runs[expeditionId];
      if (previous && expedition.completedCycles > previous.completedCycles) {
        events.emit('expedition:completed', {
          expedition,
          previousCompletedCycles: previous.completedCycles,
          cyclesCompleted: expedition.completedCycles - previous.completedCycles,
        });
      }
      const knownDiscoveries = new Set(previous?.expeditionStorage.rareDiscoveries.map((entry) => entry.discoveryId) ?? []);
      for (const discovery of expedition.expeditionStorage.rareDiscoveries) {
        if (!knownDiscoveries.has(discovery.discoveryId)) events.emit('expedition:rareDiscovered', { expeditionId, discovery });
      }
    }

    const previousResearch = before.research.slot;
    if (previousResearch?.status === 'ACTIVE') {
      const currentResearch = after.research.slot?.researchId === previousResearch.researchId ? after.research.slot : null;
      if (currentResearch?.status === 'READY') events.emit('research:completed', currentResearch);
      else if (after.research.claimLedger[previousResearch.researchId]) {
        events.emit('research:completed', { ...previousResearch, status: 'READY', claimedAt: null });
      }
    }

    const summary = after.idle.lastWelcomeBack;
    if (summary && summary.summaryId !== before.idle.lastWelcomeBack?.summaryId) events.emit('idle:processed', summary);

    const previousEndless = before.endlessMine;
    const endless = after.endlessMine;
    const previousRun = previousEndless.run;
    const run = endless.run;
    const sameRun = Boolean(run && endless.runId && endless.runId === previousEndless.runId);
    if (endless.runId && endless.runId !== previousEndless.runId) {
      events.emit('endless:started', cloneEndless(after));
    }
    if (sameRun && run && previousRun) {
      const attemptedFloors = Math.max(0, run.battles - previousRun.battles);
      const clearedFloors = Math.max(0, run.highestClearedFloor - previousRun.highestClearedFloor);
      const creditsGained = Math.max(0, endless.pendingCredits - previousEndless.pendingCredits);
      const previousEquipmentIds = new Set(previousEndless.equipment.items.map((item) => item.id));
      const equipmentAddedIds = endless.equipment.items
        .filter((item) => !previousEquipmentIds.has(item.id))
        .map((item) => item.id);
      if (attemptedFloors > 0 || clearedFloors > 0 || creditsGained > 0 || equipmentAddedIds.length > 0) {
        events.emit('endless:advanced', {
          runId: endless.runId!,
          previousFloor: previousRun.currentFloor,
          floor: run.currentFloor,
          attemptedFloors,
          clearedFloors,
          creditsGained,
          bossesCleared: Math.max(0, run.clearedBosses - previousRun.clearedBosses),
          equipmentAddedIds,
          state: cloneEndless(after),
        });
      }
      if (previousEndless.status === 'RUNNING' && endless.status === 'PAUSED') {
        events.emit('endless:paused', cloneEndless(after));
      }
      if ((previousEndless.status === 'PAUSED' || previousEndless.status === 'ENDED') && endless.status === 'RUNNING') {
        events.emit('endless:resumed', cloneEndless(after));
      }
      if (previousEndless.status !== 'ENDED' && endless.status === 'ENDED') {
        const reason = run.status === 'DEFEATED' ? 'DEFEATED' : run.status === 'COMPLETE' ? 'COMPLETE' : 'CLAIMED';
        events.emit('endless:finished', { runId: endless.runId!, reason, state: cloneEndless(after) });
      }
    }
    if (previousEndless.manualMode !== endless.manualMode) {
      events.emit('endless:manualChanged', { manual: endless.manualMode, state: cloneEndless(after) });
    }
    if (previousEndless.strategy !== endless.strategy) {
      events.emit('endless:strategyChanged', { strategy: endless.strategy, state: cloneEndless(after) });
    }
    if (previousEndless.speed !== endless.speed) {
      events.emit('endless:speedChanged', { speed: endless.speed, state: cloneEndless(after) });
    }
    if (!sameLootFilter(previousEndless.lootFilter, endless.lootFilter)) {
      events.emit('endless:lootFilterChanged', { filter: { ...endless.lootFilter }, state: cloneEndless(after) });
    }

    const masteryXpGained = Math.max(0, after.mastery.totalXp - before.mastery.totalXp);
    if (masteryXpGained > 0) {
      const changesFor = (current: Readonly<Record<string, MasteryEntry>>, previous: Readonly<Record<string, MasteryEntry>>) =>
        Object.entries(current)
          .filter(([id, entry]) => masteryEntryChanged(previous[id], entry))
          .map(([id, entry]) => ({
            id,
            previous: previous[id] ? cloneMasteryEntry(previous[id]!) : null,
            current: cloneMasteryEntry(entry),
          }));
      events.emit('mastery:gained', {
        operation,
        xpGained: masteryXpGained,
        totalXp: after.mastery.totalXp,
        stones: changesFor(after.mastery.stones, before.mastery.stones),
        species: changesFor(after.mastery.species, before.mastery.species),
      });
    }
  };

  const perform = <T,>(
    operation: string,
    callback: () => T,
    onSuccess?: (result: T, before: GameState, after: GameState) => void,
  ): T => {
    const before = cloneGameState(store.getState().game);
    try {
      const result = cloneBoundaryValue(callback());
      const after = cloneGameState(store.getState().game);
      emitNewAchievements(before, after);
      emitBackgroundTransitions(operation, before, after);
      onSuccess?.(result, before, after);
      return result;
    } catch (cause) {
      events.emit('error', { operation, message: cause instanceof Error ? cause.message : String(cause), cause });
      throw cause;
    }
  };

  const setRoute = (route: StoneverseRoute, selectedStoneId: string | null = null): void => {
    store.getState().setRoute(route, selectedStoneId);
    events.emit('route:changed', { route, selectedStoneId });
  };

  const api: StoneverseApi = {
    events,
    on: (event, listener) => events.on(event, listener),
    onStoneMined: (payload) => perform('onStoneMined', () => {
      const previousLevel = store.getState().game.mining.level;
      const result = store.getState().mine(payload, { farmSessionActive: store.getState().farmSessionActive });
      events.emit('stone:mined', result);
      const level = store.getState().game.mining.level;
      if (level > previousLevel) events.emit('mining:levelUp', { previousLevel, level });
      return result;
    }),
    onFarmSessionStarted: () => {
      const state = store.getState().game;
      if (store.getState().farmSessionActive !== true) {
        store.getState().setFarmSessionActive(true);
        events.emit('session:started', { sessionId: state.online.sessionId, at: new Date().toISOString() });
      }
      return state.online.sessionId;
    },
    onFarmSessionEnded: () => {
      if (store.getState().farmSessionActive !== true) return;
      const state = store.getState().game;
      store.getState().setFarmSessionActive(false);
      events.emit('session:ended', { sessionId: state.online.sessionId, at: new Date().toISOString() });
      store.getState().save();
    },
    syncFarmStatistics: async () => {
      if (!online) return { sent: 0, accepted: 0, rejected: 0, remaining: store.getState().game.online.queue.length, connected: false };
      const snapshot = api.getFarmStatistics();
      store.getState().queueOnlineEvent('PROFILE_UPDATED', snapshot, `sync_profile_${snapshot.revision}`);
      const result = await store.getState().syncOnline(online);
      events.emit('sync:completed', { accepted: result.accepted, rejected: result.rejected, remaining: result.remaining });
      return result;
    },
    openStoneverse: () => setRoute('HOME'),
    openProfile: () => setRoute('PROFILE'),
    openGacha: () => setRoute('GACHA'),
    openCollection: () => setRoute('COLLECTION'),
    openRanking: () => setRoute('RANKING'),
    openStoneDetail: (stoneId) => {
      if (!store.getState().game.stones[stoneId]) throw new Error('Stone not found');
      setRoute('STONE_DETAIL', stoneId);
    },
    getStoneverseState: () => cloneGameState(store.getState().game),
    getFarmStatistics: () => {
      const state = store.getState().game;
      return {
        miningLevel: state.mining.level, miningXp: state.mining.xp, totalMined: state.mining.totalMined,
        dailyMined: state.mining.dailyMined, weeklyMined: state.mining.weeklyMined, monthlyMined: state.mining.monthlyMined,
        stoneCount: Object.keys(state.stones).length, collectionCount: state.collection.discoveredSpeciesIds.length, revision: state.revision,
      };
    },
    exportStoneverseSave: () => store.getState().exportSave(),
    importStoneverseSave: (serialized) => perform('importStoneverseSave', () => {
      store.getState().importSave(serialized);
      events.emit('save:imported', { schemaVersion: store.getState().game.schemaVersion });
    }),
    appraiseStone: (discoveryId) => perform('appraiseStone', () => {
      const result = store.getState().appraise(discoveryId);
      events.emit('stone:discovered', result);
      return result;
    }),
    pullGacha: (bannerId, count) => perform('pullGacha', () => {
      const result = store.getState().pullGacha(bannerId, count);
      events.emit('gacha:result', result);
      return result;
    }),
    fuseStones: (parentIds, fusionOptions) => perform('fuseStones', () => {
      const result = store.getState().fuse(parentIds, fusionOptions);
      events.emit('stone:fused', result);
      return result;
    }),
    trainStone: (stoneId, xp) => perform('trainStone', () => {
      const result = store.getState().addStoneXp(stoneId, xp);
      if (result.levelsGained > 0) events.emit('stone:levelUp', { stone: store.getState().game.stones[stoneId]!, previousLevel: result.previousLevel, level: result.level });
      return result;
    }),
    evolveStone: (stoneId, evolutionId, areaId) => perform('evolveStone', () => {
      const result = store.getState().evolve(stoneId, evolutionId, areaId);
      events.emit('stone:evolved', result);
    }),
    awakenStone: (stoneId) => perform('awakenStone', () => {
      store.getState().awaken(stoneId);
      const stone = store.getState().game.stones[stoneId]!;
      events.emit('stone:awakened', { stone, stage: stone.awakeningStage });
    }),
    startDungeonBattle: (dungeonId, stageId) => perform('startDungeonBattle', () => {
      const battle = store.getState().startDungeonBattle(dungeonId, stageId);
      events.emit('battle:started', battle);
      return battle;
    }),
    advanceBattle: () => perform('advanceBattle', () => {
      const wasFinished = Boolean(store.getState().game.activeBattle?.winner);
      const actions = store.getState().advanceBattle();
      const battle = store.getState().game.activeBattle!;
      events.emit('battle:turn', { battle, actionCount: actions.length });
      if (!wasFinished && battle.winner) events.emit('battle:finished', battle);
      return actions;
    }),
    issueBattleCommand: (skillId, targetIds) => perform('issueBattleCommand', () => {
      const wasFinished = Boolean(store.getState().game.activeBattle?.winner);
      const actions = store.getState().issueBattleCommand(skillId, targetIds);
      const battle = store.getState().game.activeBattle!;
      events.emit('battle:turn', { battle, actionCount: actions.length });
      if (!wasFinished && battle.winner) events.emit('battle:finished', battle);
      return actions;
    }),
    setBattleAuto: (auto) => perform('setBattleAuto', () => {
      store.getState().setBattleAuto(auto);
      return store.getState().game.activeBattle!;
    }),
    setBattleSpeed: (speed) => perform('setBattleSpeed', () => {
      store.getState().setBattleSpeed(speed);
      return store.getState().game.activeBattle!;
    }),
    runBattle: () => perform('runBattle', () => {
      const wasFinished = Boolean(store.getState().game.activeBattle?.winner);
      const battle = store.getState().runActiveBattle();
      if (!wasFinished && battle.winner) events.emit('battle:finished', battle);
      return battle;
    }),
    abandonBattle: () => perform('abandonBattle', () => store.getState().abandonBattle()),
    processBackground: (mode) => perform('processBackground', () => store.getState().processBackground(mode)),
    startExpedition: (expeditionOptions) => perform(
      'startExpedition',
      () => store.getState().startExpedition(expeditionOptions),
      (result, _before, after) => events.emit('expedition:started', after.expeditions.runs[result.expeditionId] ?? result),
    ),
    stopExpedition: (expeditionId) => perform(
      'stopExpedition',
      () => store.getState().stopExpedition(expeditionId),
    ),
    claimExpedition: (expeditionId) => perform(
      'claimExpedition',
      () => store.getState().claimExpedition(expeditionId),
      (result, before) => {
        const knownDiscoveries = new Set(before.expeditions.runs[expeditionId]?.expeditionStorage.rareDiscoveries.map((entry) => entry.discoveryId) ?? []);
        for (const discovery of result.reward.rareDiscoveries) {
          if (!knownDiscoveries.has(discovery.discoveryId)) events.emit('expedition:rareDiscovered', { expeditionId, discovery });
        }
        events.emit('expedition:claimed', result);
      },
    ),
    claimStoredExpeditionDiscovery: (discoveryId) => perform(
      'claimStoredExpeditionDiscovery',
      () => store.getState().claimStoredExpeditionDiscovery(discoveryId),
      (result, _before, after) => events.emit('expedition:discoveryClaimed', {
        discoveryId,
        stone: after.stones[result.instanceId] ?? result,
      }),
    ),
    startTraining: (stoneId) => perform(
      'startTraining',
      () => store.getState().startTraining(stoneId),
      (_result, _before, after) => {
        if (after.training.assignment) events.emit('training:started', after.training.assignment);
      },
    ),
    claimTraining: () => perform(
      'claimTraining',
      () => store.getState().claimTraining(),
      (xp, before, after) => {
        const assignment = after.training.assignment ?? before.training.assignment;
        if (assignment) events.emit('training:claimed', { stoneId: assignment.stoneId, xp, assignment });
      },
    ),
    stopTraining: () => perform(
      'stopTraining',
      () => store.getState().stopTraining(),
      (_result, before) => {
        if (before.training.assignment) events.emit('training:stopped', { stoneId: before.training.assignment.stoneId });
      },
    ),
    startAffinityGarden: (stoneId) => perform(
      'startAffinityGarden',
      () => store.getState().startAffinityGarden(stoneId),
      (_result, _before, after) => {
        if (after.affinityGarden.assignment) events.emit('affinityGarden:started', after.affinityGarden.assignment);
      },
    ),
    claimAffinityGarden: () => perform(
      'claimAffinityGarden',
      () => store.getState().claimAffinityGarden(),
      (affinity, before, after) => {
        const assignment = after.affinityGarden.assignment ?? before.affinityGarden.assignment;
        if (assignment) events.emit('affinityGarden:claimed', { stoneId: assignment.stoneId, affinity, assignment });
      },
    ),
    stopAffinityGarden: () => perform(
      'stopAffinityGarden',
      () => store.getState().stopAffinityGarden(),
      (_result, before) => {
        if (before.affinityGarden.assignment) events.emit('affinityGarden:stopped', { stoneId: before.affinityGarden.assignment.stoneId });
      },
    ),
    startResearch: (projectId) => perform(
      'startResearch',
      () => store.getState().startResearch(projectId),
      (result, _before, after) => events.emit('research:started', after.research.slot ?? result),
    ),
    claimResearch: (researchId) => perform(
      'claimResearch',
      () => store.getState().claimResearch(researchId),
      (result) => events.emit('research:claimed', { researchId, ...result }),
    ),
    startEndlessMine: (partyStoneIds) => perform('startEndlessMine', () => {
      store.getState().startEndlessMine(partyStoneIds);
      return cloneEndless(store.getState().game);
    }),
    advanceEndlessMine: (maxFloors) => perform('advanceEndlessMine', () => store.getState().advanceEndlessMine(maxFloors)),
    setEndlessManual: (manual) => perform('setEndlessManual', () => {
      store.getState().setEndlessManual(manual);
      return cloneEndless(store.getState().game);
    }),
    setEndlessStrategy: (strategy) => perform('setEndlessStrategy', () => {
      store.getState().setEndlessStrategy(strategy);
      return cloneEndless(store.getState().game);
    }),
    setEndlessSpeed: (speed) => perform('setEndlessSpeed', () => {
      store.getState().setEndlessSpeed(speed);
      return cloneEndless(store.getState().game);
    }),
    issueEndlessCommand: (skillId, targetIds) => perform(
      'issueEndlessCommand',
      () => store.getState().issueEndlessCommand(skillId, targetIds),
      (settled, _before, after) => events.emit('endless:command', {
        skillId,
        targetIds: [...(targetIds ?? [])],
        settled,
        state: cloneEndless(after),
      }),
    ),
    pauseEndlessMine: () => perform('pauseEndlessMine', () => {
      store.getState().pauseEndlessMine();
      return cloneEndless(store.getState().game);
    }),
    resumeEndlessMine: () => perform('resumeEndlessMine', () => {
      store.getState().resumeEndlessMine();
      return cloneEndless(store.getState().game);
    }),
    claimEndlessMine: () => perform(
      'claimEndlessMine',
      () => store.getState().claimEndlessMine(),
      (result) => events.emit('endless:claimed', result),
    ),
    updateEndlessLootFilter: (filter) => perform('updateEndlessLootFilter', () => {
      store.getState().updateEndlessLootFilter(filter);
      return cloneEndless(store.getState().game);
    }),
    salvageEndlessEquipment: (equipmentId) => perform(
      'salvageEndlessEquipment',
      () => store.getState().salvageEndlessEquipment(equipmentId),
      (materialsGained) => events.emit('endless:equipmentSalvaged', { equipmentId, materialsGained }),
    ),
    equipEndlessEquipment: (equipmentId, stoneId) => perform(
      'equipEndlessEquipment',
      () => store.getState().equipEndlessEquipment(equipmentId, stoneId),
      (_result, before, after) => {
        const equipment = before.endlessMine.equipment.items.find((item) => item.id === equipmentId) as EquipmentItem | undefined;
        const stone = after.stones[stoneId];
        if (equipment && stone) events.emit('endless:equipmentEquipped', { equipment, stone });
      },
    ),
    unequipEndlessEquipment: (equipmentId, stoneId) => perform(
      'unequipEndlessEquipment',
      () => store.getState().unequipEndlessEquipment(equipmentId, stoneId),
      () => events.emit('endless:equipmentUnequipped', { equipmentId, stoneId }),
    ),
    setEndlessEquipmentLocked: (equipmentId, locked) => perform(
      'setEndlessEquipmentLocked',
      () => store.getState().setEndlessEquipmentLocked(equipmentId, locked),
      () => events.emit('endless:equipmentLockChanged', { equipmentId, locked }),
    ),
    getPublicProfile: async (accountId) => cloneBoundaryValue(accountId === store.getState().game.account.accountId ? ownProfile(store.getState().game) : await (online?.getPublicProfile(accountId) ?? null)),
    getLeaderboard: async (category, limit) => cloneBoundaryValue(await (online?.getLeaderboard(category, limit) ?? [])),
  };
  return api;
};

export const stoneverseApi = createStoneverseApi();
