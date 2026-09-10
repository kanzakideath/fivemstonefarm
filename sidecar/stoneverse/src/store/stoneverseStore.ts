import { create, type StateCreator, type StoreApi, useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { FUSION_CATALYSTS, SPECIES_BY_ID } from '../data';
import { applyMiningEvent, appraiseDiscovery, registerStoneInCollection, validateMiningIngress, type MiningIngressContext } from '../domain/mining';
import { pullGacha } from '../domain/gacha';
import { fuseStones } from '../domain/fusion';
import { createDungeonBattle, runBattleRound, runBattleToCompletion, runDungeonManualRound, settleBattle } from '../domain/battle';
import {
  availableEvolutions,
  awakenStone,
  evolveStone,
  gainAffinity,
  generateStone,
  learnSkillTreeNode,
  reincarnateStone,
} from '../domain/stone';
import { claimAchievement as claimAchievementReward, spendCost } from '../domain/economy';
import { dueOnlineEvents, enqueueOnlineEvent, scheduleOnlineRetry } from '../domain/onlineQueue';
import { cloneGameState, createInitialGameState, touchState, type NewGameOptions } from '../domain/state';
import { claimExpedition, claimStoredExpeditionDiscovery, parseExpeditionEquipmentReward, startExpedition, stopExpedition, type StartExpeditionOptions } from '../domain/expedition';
import { processIdleState, refreshBackgroundSchedule, type IdleProcessingMode, type IdleProcessingOptions } from '../domain/idle';
import {
  claimAffinityGarden,
  claimResearch,
  claimTraining,
  startAffinityGarden,
  startResearch,
  startTraining,
  stopAffinityGarden,
  stopTraining,
} from '../domain/backgroundActivities';
import {
  advanceEndlessAuto,
  claimEndlessCampaign,
  pauseEndlessCampaign,
  resumeEndlessCampaign,
  runEndlessManualRound,
  setEndlessLootFilter,
  setEndlessMode,
  startEndlessCampaign,
  type EndlessAdvanceSummary,
  type EndlessClaimResult,
  type PlayerAiStrategy,
} from '../domain/endlessCampaign';
import { gainStoneXpWithMastery, type MasteryGainResult } from '../domain/mastery';
import { addEquipment, equippedItemToAdvancedEquipment, generateEquipment, salvageEquipment, type LootFilter } from '../domain/advanced';
import { calculateStoneStats } from '../domain/stone';
import { CryptoRng, SeededRng, type RandomSource, systemClock } from '../domain/rng';
import type {
  AppraisalResult,
  BattleAction,
  BattleState,
  Clock,
  EvolutionResult,
  ExpeditionClaimResult,
  ExpeditionRun,
  FusionOptions,
  FusionResult,
  GameSettings,
  GameState,
  GachaPullResult,
  LevelGainResult,
  MiningPayload,
  MiningResult,
  OnlineEvent,
  OnlineEventKind,
  OnlineSyncResult,
  OnlineTransport,
  ResearchProjectId,
  ResearchSlot,
  StoneInstance,
  StoneverseRoute,
  WelcomeBackSummary,
} from '../domain/types';
import {
  browserStorage,
  exportSave as serializeSave,
  importSave as deserializeSave,
  inspectBestSave,
  loadBestSave,
  saveAtomically,
  type StorageAdapter,
} from './persistence';

export interface StoneverseStoreDependencies {
  clock?: Clock;
  rng?: RandomSource;
  rngFactory?: () => RandomSource;
  storage?: StorageAdapter | null;
  autoSave?: boolean;
  initialState?: GameState;
  newGame?: NewGameOptions;
}

export interface StoneverseStore {
  game: GameState;
  route: StoneverseRoute;
  selectedStoneId: string | null;
  /** Runtime-only host lifecycle; undefined keeps standalone/direct-store mining available. */
  farmSessionActive: boolean | undefined;
  /** False means progress currently lives in memory only and will be lost on exit. */
  persistenceAvailable: boolean;
  lastError: string | null;
  mine(payload: MiningPayload, context?: MiningIngressContext): MiningResult;
  appraise(discoveryId: string): AppraisalResult;
  pullGacha(bannerId: string, count: 1 | 10): GachaPullResult;
  fuse(parentIds: readonly string[], options?: FusionOptions): FusionResult;
  addStoneXp(stoneId: string, amount: number): MasteryGainResult;
  addAffinity(stoneId: string, amount: number): { previousRank: number; rank: number };
  evolve(stoneId: string, evolutionId: string, areaId?: string): EvolutionResult;
  awaken(stoneId: string): void;
  reincarnate(stoneId: string): void;
  learnSkillNode(stoneId: string, nodeId: string): void;
  toggleFavorite(stoneId: string): void;
  toggleLock(stoneId: string): void;
  setNickname(stoneId: string, nickname: string | null): void;
  setParty(stoneIds: readonly string[], partyId?: string): void;
  startDungeonBattle(dungeonId: string, stageId: string): BattleState;
  advanceBattle(): BattleAction[];
  issueBattleCommand(skillId: string, targetIds?: readonly string[]): BattleAction[];
  setBattleAuto(auto: boolean): void;
  setBattleSpeed(speed: 1 | 2 | 4): void;
  runActiveBattle(): BattleState;
  abandonBattle(): void;
  claimAchievement(achievementId: string): void;
  processBackground(mode?: IdleProcessingMode): WelcomeBackSummary | null;
  nextBackgroundDueAtMs(): number | null;
  dismissWelcomeBack(summaryId: string): void;
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
  claimResearch(researchId: string): { projectId: ResearchProjectId; researchPoints: number; items: Record<string, number> };
  startEndlessMine(partyStoneIds?: readonly string[]): void;
  advanceEndlessMine(maxFloors?: number): EndlessAdvanceSummary;
  setEndlessManual(manual: boolean): void;
  setEndlessStrategy(strategy: PlayerAiStrategy): void;
  setEndlessSpeed(speed: 1 | 2 | 4): void;
  issueEndlessCommand(skillId: string, targetIds?: readonly string[]): EndlessAdvanceSummary | null;
  pauseEndlessMine(): void;
  resumeEndlessMine(): void;
  claimEndlessMine(): EndlessClaimResult;
  updateEndlessLootFilter(filter: LootFilter): void;
  salvageEndlessEquipment(equipmentId: string): number;
  equipEndlessEquipment(equipmentId: string, stoneId: string): void;
  unequipEndlessEquipment(equipmentId: string, stoneId: string): void;
  setEndlessEquipmentLocked(equipmentId: string, locked: boolean): void;
  setShowcase(stoneIds: readonly string[]): void;
  setRoute(route: StoneverseRoute, selectedStoneId?: string | null): void;
  setFarmSessionActive(active: boolean): void;
  updateSettings(settings: Partial<GameSettings>): void;
  addCurrency(currency: keyof GameState['inventory']['currencies'], amount: number): void;
  createPerfectStone(speciesId: string): string;
  queueOnlineEvent(kind: OnlineEventKind, payload: unknown, eventId?: string): OnlineEvent;
  syncOnline(transport: OnlineTransport): Promise<OnlineSyncResult>;
  setOnlineConnected(connected: boolean): void;
  exportSave(): string;
  importSave(serialized: string): void;
  save(): void;
  load(): boolean;
  resetGame(options?: NewGameOptions): void;
  clearError(): void;
}

const creatorFor = (dependencies: StoneverseStoreDependencies = {}): StateCreator<StoneverseStore> => (set, get) => {
  const clock = dependencies.clock ?? systemClock;
  const storage = dependencies.storage === undefined ? browserStorage() : dependencies.storage;
  let persistenceAvailable = storage !== null;
  const persist = (state: GameState): void => {
    if (!storage) {
      persistenceAvailable = false;
      throw new Error('Local persistence is unavailable; this session cannot be saved');
    }
    try {
      saveAtomically(storage, state, clock);
      persistenceAvailable = true;
    } catch (error) {
      persistenceAvailable = false;
      throw error;
    }
  };
  const autoSave = dependencies.autoSave ?? true;
  const sharedRng = dependencies.rng;
  const nextRng = (): RandomSource => dependencies.rngFactory?.() ?? sharedRng ?? new CryptoRng();
  const loadInspection = storage ? inspectBestSave(storage) : { state: null, invalidReadableCandidates: 0, unreadableSlots: 0 };
  const loaded = loadInspection.state;
  let recoveryWriteBlocked = !loaded && loadInspection.invalidReadableCandidates > 0;
  const sourceInitial = dependencies.initialState ?? loaded ?? createInitialGameState({ ...dependencies.newGame, clock });
  let initial = cloneGameState(sourceInitial);
  let startupError: string | null = recoveryWriteBlocked
    ? '保存データを検証できません。破損スロットを保護するため、Importまたは明示的なResetまで書き込みを停止しました。'
    : null;
  try {
    processIdleState(initial, clock);
    if (loaded && autoSave && storage) persist(initial);
  } catch (error) {
    // Offline rewards and their trusted-time checkpoint commit together. If the
    // durable write fails, retain the last committed state instead of duplicating rewards.
    initial = cloneGameState(sourceInitial);
    startupError = error instanceof Error ? error.message : String(error);
  }

  const transaction = <T,>(
    operation: (state: GameState, rng: RandomSource, trustedClock: Clock, welcomeBack: WelcomeBackSummary | null) => T,
    idleOptions: IdleProcessingOptions = { mode: 'ACTIVE' },
  ): T => {
    let output: T | undefined;
    let caught: unknown;
    set((current) => {
      try {
        const game = cloneGameState(current.game);
        const welcomeBack = processIdleState(game, clock, idleOptions);
        const trustedClock: Clock = { now: () => new Date(game.idle.timeCheckpoint.trustedNowMs) };
        output = operation(game, nextRng(), trustedClock, welcomeBack);
        refreshBackgroundSchedule(game);
        touchState(game, trustedClock);
        if (autoSave && storage) {
          if (recoveryWriteBlocked) throw new Error('Corrupt save recovery is write-protected; import a valid save or explicitly reset');
          persist(game);
        }
        return { ...current, game, persistenceAvailable, lastError: null };
      } catch (error) {
        caught = error;
        return { ...current, persistenceAvailable, lastError: error instanceof Error ? error.message : String(error) };
      }
    });
    if (caught) throw caught;
    return output as T;
  };

  const requireStone = (state: GameState, stoneId: string) => {
    const stone = state.stones[stoneId];
    if (!stone) throw new Error(`Stone not found: ${stoneId}`);
    return stone;
  };

  const finishIfNecessary = (state: GameState, battle: BattleState, rng: RandomSource): void => {
    const wasSettled = state.battleHistory.some((entry) => entry.battleId === battle.battleId);
    if (battle.winner) {
      settleBattle(state, battle, clock);
      if (!wasSettled) enqueueOnlineEvent(state, 'BATTLE_FINISHED', { battleId: battle.battleId, mode: battle.mode, winner: battle.winner, turns: battle.turn }, rng, clock, `sync_battle_${battle.battleId}`);
    }
  };

  return {
    game: initial,
    route: 'HOME',
    selectedStoneId: null,
    farmSessionActive: undefined,
    persistenceAvailable,
    lastError: startupError,
    mine: (payload, context) => {
      const initialIngress = validateMiningIngress(get().game, payload, clock, context);
      if (!initialIngress.valid) return { accepted: false, duplicate: false, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 };
      return transaction((state, rng) => {
        const provenance = validateMiningIngress(state, payload, clock, context);
        const result = applyMiningEvent(state, payload, rng, clock, context);
        if (result.accepted) enqueueOnlineEvent(state, 'MINING_RECORDED', {
          amount: provenance.amount,
          quality: provenance.quality,
          areaId: payload.areaId ?? 'area_greenbreak',
          veinId: payload.veinId ?? null,
          source: {
            eventId: payload.eventId,
            sessionId: payload.sessionId ?? state.online.sessionId,
            timestamp: provenance.sourceTimestamp,
            metadata: provenance.metadata ?? {},
          },
        }, rng, clock, `sync_mining_${payload.eventId}`);
        return result;
      });
    },
    appraise: (discoveryId) => transaction((state, rng) => {
      const result = appraiseDiscovery(state, discoveryId, clock);
      enqueueOnlineEvent(state, 'STONE_CREATED', { stoneId: result.stone.instanceId, speciesId: result.stone.speciesId, rarity: result.stone.rarity, origin: result.stone.origin }, rng, clock, `sync_stone_${result.stone.instanceId}`);
      return result;
    }),
    pullGacha: (bannerId, count) => transaction((state, rng) => pullGacha(state, bannerId, count, rng, clock)),
    fuse: (parentIds, options = {}) => transaction((state, rng) => {
      if (options.consumeParents) {
        const assigned = new Set([
          ...Object.values(state.expeditions.runs).filter((run) => run.status !== 'CLAIMED').flatMap((run) => run.partySnapshot.map((member) => member.stoneId)),
          ...(state.training.assignment ? [state.training.assignment.stoneId] : []),
          ...(state.affinityGarden.assignment ? [state.affinityGarden.assignment.stoneId] : []),
          ...((state.endlessMine.status === 'RUNNING' || state.endlessMine.status === 'PAUSED') ? state.endlessMine.partyStoneIds : []),
          ...(state.activeBattle && !state.activeBattle.winner ? state.activeBattle.units.filter((unit) => unit.team === 'PLAYER').map((unit) => unit.stoneId) : []),
        ]);
        if (parentIds.some((id) => assigned.has(id))) throw new Error('A stone assigned to a background activity cannot be consumed');
      }
      const result = fuseStones(state, parentIds, options, rng, clock);
      enqueueOnlineEvent(state, 'STONE_FUSED', { fusionId: result.history.id, parentIds: result.history.parentIds, childId: result.child.instanceId, recipeId: result.history.recipeId }, rng, clock, `sync_fusion_${result.history.id}`);
      return result;
    }),
    addStoneXp: (stoneId, amount) => transaction((state) => gainStoneXpWithMastery(requireStone(state, stoneId), state.mastery, amount)),
    addAffinity: (stoneId, amount) => transaction((state) => {
      const result = gainAffinity(requireStone(state, stoneId), amount);
      state.profile.totalAffinity = Object.values(state.stones).reduce((sum, stone) => sum + stone.affinity.points, 0);
      return result;
    }),
    evolve: (stoneId, evolutionId, areaId) => transaction((state, rng) => {
      const stone = requireStone(state, stoneId);
      const context = {
        items: state.inventory.items,
        areaId,
        achievementIds: Object.entries(state.achievements).filter(([, progress]) => Boolean(progress.unlockedAt)).map(([id]) => id),
        fusionCount: state.statistics.fusionCount,
        timestamp: clock.now(),
      };
      const evolution = availableEvolutions(stone, context).find((candidate) => candidate.id === evolutionId);
      if (!evolution) throw new Error('Evolution conditions are not met');
      const requiredItems = Object.fromEntries(evolution.conditions.filter((condition) => condition.kind === 'ITEM').map((condition) => [String(condition.value), condition.amount ?? 1]));
      spendCost(state, { ...evolution.cost, items: { ...requiredItems, ...(evolution.cost?.items ?? {}) } });
      const result = evolveStone(stone, evolution);
      enqueueOnlineEvent(state, 'STONE_EVOLVED', { stoneId, previousSpeciesId: result.previousSpeciesId, speciesId: result.stone.speciesId, evolutionId }, rng, clock, `sync_evolution_${stoneId}_${stone.evolutionStage}`);
      return result;
    }),
    awaken: (stoneId) => transaction((state) => {
      const stone = requireStone(state, stoneId);
      spendCost(state, { currencies: { upgradeDust: 100 * (stone.awakeningStage + 1) } });
      awakenStone(stone);
    }),
    reincarnate: (stoneId) => transaction((state) => reincarnateStone(requireStone(state, stoneId))),
    learnSkillNode: (stoneId, nodeId) => transaction((state) => learnSkillTreeNode(requireStone(state, stoneId), nodeId)),
    toggleFavorite: (stoneId) => transaction((state) => {
      const stone = requireStone(state, stoneId);
      stone.favorite = !stone.favorite;
      state.profile.favoriteStoneIds = stone.favorite
        ? [...new Set([...state.profile.favoriteStoneIds, stoneId])].slice(0, 12)
        : state.profile.favoriteStoneIds.filter((id) => id !== stoneId);
    }),
    toggleLock: (stoneId) => transaction((state) => { const stone = requireStone(state, stoneId); stone.locked = !stone.locked; }),
    setNickname: (stoneId, nickname) => transaction((state) => {
      const value = nickname?.trim() || null;
      if (value && value.length > 20) throw new Error('Nickname must be 20 characters or fewer');
      requireStone(state, stoneId).nickname = value;
    }),
    setParty: (stoneIds, partyId = get().game.activePartyId) => transaction((state) => {
      if (stoneIds.length < 1 || stoneIds.length > 3 || new Set(stoneIds).size !== stoneIds.length) throw new Error('A party requires 1-3 unique stones');
      for (const id of stoneIds) requireStone(state, id);
      const party = state.parties.find((candidate) => candidate.id === partyId);
      if (!party) throw new Error('Party not found');
      party.slots = stoneIds.map((stoneId, index) => ({ stoneId, position: index === 0 ? 'FRONT' : 'BACK' }));
      state.activePartyId = party.id;
    }),
    startDungeonBattle: (dungeonId, stageId) => transaction((state, rng) => {
      const party = state.parties.find((entry) => entry.id === state.activePartyId);
      const busy = new Set([
        ...Object.values(state.expeditions.runs).filter((run) => run.status !== 'CLAIMED').flatMap((run) => run.partySnapshot.map((member) => member.stoneId)),
        ...(state.training.assignment ? [state.training.assignment.stoneId] : []),
        ...(state.affinityGarden.assignment ? [state.affinityGarden.assignment.stoneId] : []),
        ...((state.endlessMine.status === 'RUNNING' || state.endlessMine.status === 'PAUSED') ? state.endlessMine.partyStoneIds : []),
      ]);
      if (party?.slots.some((slot) => busy.has(slot.stoneId))) throw new Error('A deployed Stone cannot enter a dungeon battle');
      const battle = createDungeonBattle(state, dungeonId, stageId, rng, clock);
      state.activeBattle = battle;
      return battle;
    }),
    advanceBattle: () => transaction((state, rng) => {
      if (!state.activeBattle) throw new Error('No active battle');
      const actions = runBattleRound(state.activeBattle, rng, clock);
      finishIfNecessary(state, state.activeBattle, rng);
      return actions;
    }),
    issueBattleCommand: (skillId, targetIds) => transaction((state, rng, trustedClock) => {
      if (!state.activeBattle) throw new Error('No active battle');
      if (state.activeBattle.controlMode === 'AUTO') throw new Error('Switch to MANUAL before issuing a command');
      const actions = runDungeonManualRound(state.activeBattle, skillId, targetIds, rng, trustedClock);
      finishIfNecessary(state, state.activeBattle, rng);
      return actions;
    }),
    setBattleAuto: (auto) => transaction((state) => {
      if (!state.activeBattle || state.activeBattle.winner) throw new Error('No active battle');
      state.activeBattle.controlMode = auto ? 'AUTO' : 'MANUAL';
    }),
    setBattleSpeed: (speed) => transaction((state) => {
      if (![1, 2, 4].includes(speed)) throw new Error('Battle speed must be 1x, 2x, or 4x');
      if (!state.activeBattle) throw new Error('No active battle');
      state.activeBattle.speed = speed;
    }),
    runActiveBattle: () => transaction((state, rng) => {
      if (!state.activeBattle) throw new Error('No active battle');
      runBattleToCompletion(state.activeBattle, rng, clock);
      finishIfNecessary(state, state.activeBattle, rng);
      return state.activeBattle;
    }),
    abandonBattle: () => transaction((state) => { state.activeBattle = null; }),
    claimAchievement: (achievementId) => transaction((state) => claimAchievementReward(state, achievementId, clock)),
    processBackground: (mode = 'OFFLINE') => transaction((_state, _rng, _trustedClock, welcomeBack) => welcomeBack, { mode }),
    nextBackgroundDueAtMs: () => {
      const due = get().game.idle.scheduler.jobs.map((job) => job.dueAtMs).filter(Number.isSafeInteger);
      return due.length ? Math.min(...due) : null;
    },
    dismissWelcomeBack: (summaryId) => transaction((state) => {
      if (state.idle.lastWelcomeBack?.summaryId !== summaryId) return;
      state.idle.lastWelcomeBack = null;
    }),
    startExpedition: (options) => transaction((state, rng, trustedClock) => {
      const run = startExpedition(state, options, rng, trustedClock);
      refreshBackgroundSchedule(state);
      return run;
    }),
    stopExpedition: (expeditionId) => transaction((state) => {
      const run = stopExpedition(state, expeditionId);
      refreshBackgroundSchedule(state);
      return run;
    }),
    claimExpedition: (expeditionId) => transaction((state, _rng, trustedClock) => {
      const run = state.expeditions.runs[expeditionId];
      if (!run) throw new Error('Expedition not found');
      const previousClaimedCycles = run.claimedCycles;
      const result = claimExpedition(state, expeditionId, trustedClock);
      const equipmentRewards = Object.entries(result.reward.items)
        .filter(([itemId]) => itemId.startsWith('equipment_'));
      // Expedition's domain report keeps the logical drop id, but the player's
      // inventory receives a real affixed equipment instance rather than a
      // second, unusable generic-item token.
      for (const [itemId, count] of equipmentRewards) {
        const remaining = Math.max(0, (state.inventory.items[itemId] ?? 0) - count);
        if (remaining === 0) delete state.inventory.items[itemId];
        else state.inventory.items[itemId] = remaining;
      }
      const rarityMap = { NORMAL: 'COMMON', RARE: 'UNCOMMON', SR: 'RARE', SSR: 'EPIC', UR: 'LEGENDARY', LEGENDARY: 'MYTHIC' } as const;
      const equipmentSlot = (logicalId: string) => logicalId.endsWith('_charm') ? 'CHARM' as const
        : logicalId.endsWith('_rune') ? 'RUNE' as const
          : logicalId.endsWith('_relic') ? 'RELIC' as const : 'CORE' as const;
      const equipmentSet = (logicalId: string) => logicalId.includes('abyssal') ? 'ABYSSAL' as const
        : logicalId.includes('meteor') ? 'HUNTER' as const
          : logicalId.includes('ancestor') ? 'BASTION' as const
            : logicalId.includes('resonance') || logicalId.includes('celestial') ? 'RESONANCE' as const : null;
      let fallbackIndex = 0;
      for (const [rewardKey, count] of equipmentRewards) {
        const descriptor = parseExpeditionEquipmentReward(rewardKey);
        for (let index = 0; index < Math.min(10_000, count); index += 1) {
          const logicalId = descriptor?.itemId ?? rewardKey;
          const seed = descriptor?.seed ?? `${run.seed}:equipment-claim:${previousClaimedCycles}:${fallbackIndex}`;
          fallbackIndex += 1;
          const item = generateEquipment({
            level: Math.max(1, Math.max(...run.partySnapshot.map((member) => member.level))),
            source: `expedition-${run.regionId}`,
            ...(descriptor ? { rarity: rarityMap[descriptor.rarity], slot: equipmentSlot(logicalId), setId: equipmentSet(logicalId) } : {}),
          }, new SeededRng(seed));
          addEquipment(state.endlessMine.equipment, item, state.endlessMine.lootFilter);
        }
      }
      return result;
    }),
    claimStoredExpeditionDiscovery: (discoveryId) => transaction((state, _rng, trustedClock) => claimStoredExpeditionDiscovery(state, discoveryId, trustedClock)),
    startTraining: (stoneId) => transaction((state, _rng, trustedClock) => {
      startTraining(state, stoneId, trustedClock.now());
      refreshBackgroundSchedule(state);
    }),
    claimTraining: () => transaction((state, _rng, trustedClock) => claimTraining(state, trustedClock.now())),
    stopTraining: () => transaction((state) => {
      stopTraining(state);
      refreshBackgroundSchedule(state);
    }),
    startAffinityGarden: (stoneId) => transaction((state, _rng, trustedClock) => {
      startAffinityGarden(state, stoneId, trustedClock.now());
      refreshBackgroundSchedule(state);
    }),
    claimAffinityGarden: () => transaction((state, _rng, trustedClock) => claimAffinityGarden(state, trustedClock.now())),
    stopAffinityGarden: () => transaction((state) => {
      stopAffinityGarden(state);
      refreshBackgroundSchedule(state);
    }),
    startResearch: (projectId) => transaction((state, rng, trustedClock) => {
      const slot = startResearch(state, projectId, rng, trustedClock);
      refreshBackgroundSchedule(state);
      return slot;
    }),
    claimResearch: (researchId) => transaction((state, _rng, trustedClock) => claimResearch(state, researchId, trustedClock.now())),
    startEndlessMine: (partyStoneIds) => transaction((state, rng, trustedClock) => {
      const activeParty = state.parties.find((party) => party.id === state.activePartyId);
      const ids = [...(partyStoneIds ?? activeParty?.slots.map((slot) => slot.stoneId) ?? [])];
      const unavailable = new Set<string>();
      for (const run of Object.values(state.expeditions.runs)) if (run.status !== 'CLAIMED') for (const member of run.partySnapshot) unavailable.add(member.stoneId);
      if (state.training.assignment) unavailable.add(state.training.assignment.stoneId);
      if (state.affinityGarden.assignment) unavailable.add(state.affinityGarden.assignment.stoneId);
      if (state.activeBattle && !state.activeBattle.winner) for (const unit of state.activeBattle.units) if (unit.team === 'PLAYER') unavailable.add(unit.stoneId);
      if (ids.some((id) => unavailable.has(id))) throw new Error('A deployed Stone cannot enter Endless Mine');
      const seed = `endless:${state.account.accountId}:${trustedClock.now().getTime()}:${Math.floor(rng.next() * 0x1_0000_0000).toString(16)}`;
      startEndlessCampaign(state.endlessMine, state.stones, ids, trustedClock.now(), seed);
      refreshBackgroundSchedule(state);
    }),
    advanceEndlessMine: (maxFloors = 1) => transaction(
      (state, _rng, trustedClock) => advanceEndlessAuto(state.endlessMine, maxFloors, trustedClock.now()),
      { mode: 'ACTIVE', skipEndless: true },
    ),
    setEndlessManual: (manual) => transaction((state) => setEndlessMode(state.endlessMine, manual)),
    setEndlessStrategy: (strategy) => transaction((state) => {
      if (!['BALANCED', 'AGGRESSIVE', 'DEFENSIVE', 'BOSS_FOCUS', 'RESOURCE_SAVE'].includes(strategy)) throw new Error('Unknown Endless AI strategy');
      state.endlessMine.strategy = strategy;
    }),
    setEndlessSpeed: (speed) => transaction((state) => {
      if (![1, 2, 4].includes(speed)) throw new Error('Unsupported battle speed');
      state.endlessMine.speed = speed;
    }),
    issueEndlessCommand: (skillId, targetIds) => transaction((state) => runEndlessManualRound(state.endlessMine, skillId, targetIds)),
    pauseEndlessMine: () => transaction((state, _rng, trustedClock) => pauseEndlessCampaign(state.endlessMine, trustedClock.now())),
    resumeEndlessMine: () => transaction((state, _rng, trustedClock) => resumeEndlessCampaign(state.endlessMine, trustedClock.now())),
    claimEndlessMine: () => transaction((state) => {
      const result = claimEndlessCampaign(state.endlessMine);
      state.inventory.currencies.credits = Math.min(Number.MAX_SAFE_INTEGER, state.inventory.currencies.credits + result.credits);
      state.inventory.currencies.upgradeDust = Math.min(Number.MAX_SAFE_INTEGER, state.inventory.currencies.upgradeDust + result.upgradeDust);
      state.statistics.highestInfiniteFloor = Math.max(state.statistics.highestInfiniteFloor, result.highestFloor);
      return result;
    }),
    updateEndlessLootFilter: (filter) => transaction((state) => setEndlessLootFilter(state.endlessMine, filter)),
    salvageEndlessEquipment: (equipmentId) => transaction((state) => salvageEquipment(state.endlessMine.equipment, equipmentId).materialsGained),
    equipEndlessEquipment: (equipmentId, stoneId) => transaction((state) => {
      const stone = requireStone(state, stoneId);
      const itemIndex = state.endlessMine.equipment.items.findIndex((item) => item.id === equipmentId);
      const item = state.endlessMine.equipment.items[itemIndex];
      if (!item) throw new Error('Endless equipment not found');
      const old = stone.equipment[item.slot];
      const rarityMap = { COMMON: 'NORMAL', UNCOMMON: 'RARE', RARE: 'SR', EPIC: 'SSR', LEGENDARY: 'UR', MYTHIC: 'LEGENDARY' } as const;
      const statMap = { maxHp: 'maxHp', attack: 'power', defense: 'defense', speed: 'speed', accuracy: 'purity', resistance: 'hardness', critChance: 'resonance', critDamage: 'power', breakPower: 'resonance', ultimateStart: 'resonance' } as const;
      stone.equipment[item.slot] = {
        instanceId: item.id,
        definitionId: `${item.setId ?? 'FIELD'}_${item.slot}`,
        slot: item.slot,
        level: item.level,
        rarity: rarityMap[item.rarity],
        setId: item.setId,
        locked: item.locked,
        affixes: item.affixes.map((affix) => ({
          stat: statMap[affix.stat],
          operation: ['maxHp', 'attack', 'defense'].includes(affix.stat) ? 'FLAT' as const : 'PERCENT' as const,
          value: affix.value,
          sourceStat: affix.stat,
        })),
      };
      state.endlessMine.equipment.items.splice(itemIndex, 1);
      if (old) {
        const restored = equippedItemToAdvancedEquipment(old);
        // Removing the incoming item created exactly one inventory slot, so the
        // replaced build piece is always recoverable and never auto-salvaged.
        addEquipment(state.endlessMine.equipment, restored, { autoSalvage: false });
        delete state.inventory.equipment[old.instanceId];
      }
      stone.stats = calculateStoneStats(stone);
    }),
    unequipEndlessEquipment: (equipmentId, stoneId) => transaction((state) => {
      const stone = requireStone(state, stoneId);
      const slot = (Object.keys(stone.equipment) as Array<keyof typeof stone.equipment>)
        .find((candidate) => stone.equipment[candidate]?.instanceId === equipmentId);
      if (!slot) throw new Error('Equipped item was not found on this Stone');
      const equipped = stone.equipment[slot];
      if (!equipped) throw new Error('Equipped item was not found on this Stone');
      if (state.endlessMine.equipment.items.length >= state.endlessMine.equipment.capacity) {
        throw new Error('Equipment storage is full; salvage an item before unequipping');
      }
      addEquipment(state.endlessMine.equipment, equippedItemToAdvancedEquipment(equipped), { autoSalvage: false });
      delete stone.equipment[slot];
      delete state.inventory.equipment[equipped.instanceId];
      stone.stats = calculateStoneStats(stone);
    }),
    setEndlessEquipmentLocked: (equipmentId, locked) => transaction((state) => {
      const inventoryItem = state.endlessMine.equipment.items.find((item) => item.id === equipmentId);
      if (inventoryItem) {
        inventoryItem.locked = locked;
        return;
      }
      for (const stone of Object.values(state.stones)) {
        const equipped = Object.values(stone.equipment).find((item) => item?.instanceId === equipmentId);
        if (equipped) {
          equipped.locked = locked;
          return;
        }
      }
      throw new Error('Equipment not found');
    }),
    setShowcase: (stoneIds) => transaction((state) => {
      if (stoneIds.length > 6 || new Set(stoneIds).size !== stoneIds.length) throw new Error('Showcase supports up to six unique stones');
      for (const id of stoneIds) requireStone(state, id);
      state.profile.showcaseStoneIds = [...stoneIds];
    }),
    setRoute: (route, selectedStoneId = null) => set((current) => ({ ...current, route, selectedStoneId })),
    setFarmSessionActive: (active) => set((current) => ({ ...current, farmSessionActive: active })),
    updateSettings: (settings) => transaction((state) => {
      state.settings = {
        ...state.settings,
        ...settings,
        masterVolume: Math.max(0, Math.min(1, settings.masterVolume ?? state.settings.masterVolume)),
        musicVolume: Math.max(0, Math.min(1, settings.musicVolume ?? state.settings.musicVolume)),
        effectsVolume: Math.max(0, Math.min(1, settings.effectsVolume ?? state.settings.effectsVolume)),
        textScale: Math.max(0.8, Math.min(1.5, settings.textScale ?? state.settings.textScale)),
      };
    }),
    addCurrency: (currency, amount) => transaction((state) => {
      if (!state.settings.developerMode) throw new Error('Developer mode is disabled');
      state.inventory.currencies[currency] = Math.max(0, state.inventory.currencies[currency] + Math.floor(amount));
    }),
    createPerfectStone: (speciesId) => transaction((state, rng) => {
      if (!state.settings.developerMode) throw new Error('Developer mode is disabled');
      if (Object.keys(state.stones).length >= state.inventory.capacity) throw new Error('Stone storage is full');
      const species = SPECIES_BY_ID[speciesId];
      if (!species) throw new Error('Unknown species');
      const stone = generateStone({ species, origin: 'EVENT', owner: { accountId: state.account.accountId, username: state.account.username }, rng, clock, mutation: 'PERFECT' });
      state.stones[stone.instanceId] = stone;
      registerStoneInCollection(state, stone);
      state.statistics.mutationCount += 1;
      enqueueOnlineEvent(state, 'STONE_CREATED', { stoneId: stone.instanceId, speciesId: stone.speciesId, rarity: stone.rarity, origin: stone.origin }, rng, clock, `sync_stone_${stone.instanceId}`);
      return stone.instanceId;
    }),
    queueOnlineEvent: (kind, payload, eventId) => transaction((state, rng) => enqueueOnlineEvent(state, kind, payload, rng, clock, eventId)),
    syncOnline: async (transport) => {
      const candidates = dueOnlineEvents(get().game, clock, 100);
      if (candidates.length === 0) return { sent: 0, accepted: 0, rejected: 0, remaining: get().game.online.queue.length, connected: get().game.online.connected };
      try {
        const response = await transport.pushEvents(candidates);
        return transaction((state) => {
          const acceptedIds = new Set(response.accepted.map((receipt) => receipt.eventId));
          const rejected = new Map(response.rejected.map((entry) => [entry.eventId, entry]));
          for (const receipt of response.accepted) {
            if (!state.online.processedReceipts.some((entry) => entry.eventId === receipt.eventId)) state.online.processedReceipts.push(receipt);
          }
          state.online.queue = state.online.queue.filter((event) => {
            if (acceptedIds.has(event.eventId)) return false;
            const rejection = rejected.get(event.eventId);
            if (!rejection) return true;
            if (rejection.retryable) {
              scheduleOnlineRetry(event, clock);
              return true;
            }
            return false;
          });
          state.online.connected = true;
          state.online.lastSyncedAt = clock.now().toISOString();
          if (state.online.processedReceipts.length > 2_000) state.online.processedReceipts.splice(0, state.online.processedReceipts.length - 2_000);
          return { sent: candidates.length, accepted: response.accepted.length, rejected: response.rejected.length, remaining: state.online.queue.length, connected: true };
        });
      } catch {
        return transaction((state) => {
          const candidateIds = new Set(candidates.map((event) => event.eventId));
          for (const event of state.online.queue) if (candidateIds.has(event.eventId)) scheduleOnlineRetry(event, clock);
          state.online.connected = false;
          return { sent: candidates.length, accepted: 0, rejected: candidates.length, remaining: state.online.queue.length, connected: false };
        });
      }
    },
    setOnlineConnected: (connected) => transaction((state) => { state.online.connected = connected; }),
    exportSave: () => serializeSave(get().game, clock),
    importSave: (serialized) => {
      const game = cloneGameState(deserializeSave(serialized));
      processIdleState(game, clock);
      if (storage) persist(game);
      recoveryWriteBlocked = false;
      set((current) => ({ ...current, game, persistenceAvailable, lastError: null }));
    },
    save: () => {
      try {
        if (recoveryWriteBlocked) throw new Error('Corrupt save recovery is write-protected; import a valid save or explicitly reset');
        persist(get().game);
        set((current) => ({ ...current, persistenceAvailable, lastError: null }));
      } catch (error) {
        set((current) => ({ ...current, persistenceAvailable, lastError: error instanceof Error ? error.message : String(error) }));
        throw error;
      }
    },
    load: () => {
      if (!storage) return false;
      const loadedGame = loadBestSave(storage);
      if (!loadedGame) return false;
      const game = cloneGameState(loadedGame);
      processIdleState(game, clock);
      if (autoSave) persist(game);
      set((current) => ({ ...current, game, persistenceAvailable, lastError: null }));
      return true;
    },
    resetGame: (options = {}) => {
      const game = createInitialGameState({ ...dependencies.newGame, ...options, clock });
      if (storage) persist(game);
      recoveryWriteBlocked = false;
      set((current) => ({ ...current, game, persistenceAvailable, route: 'HOME', selectedStoneId: null, lastError: null }));
    },
    clearError: () => set((current) => ({ ...current, lastError: null })),
  };
};

export const createStoneverseStore = (dependencies: StoneverseStoreDependencies = {}): StoreApi<StoneverseStore> => createStore(creatorFor(dependencies));

/** App singleton. Hosts that need isolation should call createStoneverseStore instead. */
export const useStoneverseStore = create<StoneverseStore>(creatorFor());
export const stoneverseStore = useStoneverseStore;

/** Allows component libraries to consume an injected vanilla store. */
export const useInjectedStoneverseStore = <T,>(store: StoreApi<StoneverseStore>, selector: (state: StoneverseStore) => T): T => useStore(store, selector);

export const CATALYST_IDS = FUSION_CATALYSTS.map((entry) => entry.id);
