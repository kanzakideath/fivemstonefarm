import {
  DEFAULT_ENDLESS_CONFIG,
  ENDLESS_ENCOUNTER_TYPES,
  EQUIPMENT_RARITIES,
  EQUIPMENT_SETS,
  EQUIPMENT_SLOTS,
  MAX_ENDLESS_FLOOR,
  MAX_ENDLESS_INTEGRITY,
  MAX_ENDLESS_REWARD,
  addEquipment,
  calculateEndlessPartyPower,
  createAdvancedBattle,
  createAutoCommandProvider,
  createEndlessRun,
  createEquipmentInventory,
  generateEndlessFloor,
  generateEquipment,
  getTurnOrder,
  getUsableSkills,
  getEndlessIntegrityPowerMultiplier,
  isEndlessCombatEncounter,
  resolveEndlessFloorByPower,
  runAdvancedBattle,
  runAdvancedRound,
  settleEndlessIntegrity,
  shouldKeepEquipment,
  type AdvancedBattleState,
  type AdvancedSkillDefinition,
  type AiStrategy,
  type CombatCommand,
  type CombatantTemplate,
  type EndlessFloorDefinition,
  type EndlessRunState,
  type EquipmentInventory,
  type LootFilter,
} from './advanced';
import { SeededRng } from './rng';
import { safeProgressionAdd } from './numberFormat';
import type { StoneInstance } from './types';
import { buildStoneCombatSkillBook, stoneToAdvancedCombatant } from './stoneCombatAdapter';

export const ENDLESS_FLOOR_INTERVAL_MS = 5 * 60 * 1_000;
export const MAX_ENDLESS_OFFLINE_MS = 30 * 24 * 60 * 60 * 1_000;
export const ENDLESS_CAMPAIGN_VERSION = 1;

export type EndlessCampaignStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'ENDED';
export type EndlessBattleSpeed = 1 | 2 | 4;
export type PlayerAiStrategy = Extract<AiStrategy, 'BALANCED' | 'AGGRESSIVE' | 'DEFENSIVE' | 'BOSS_FOCUS' | 'RESOURCE_SAVE'>;

export interface EndlessCampaignState {
  version: 1;
  status: EndlessCampaignStatus;
  runId: string | null;
  run: EndlessRunState | null;
  partyStoneIds: string[];
  partySnapshot: CombatantTemplate[];
  skillBook: Readonly<Record<string, AdvancedSkillDefinition>>;
  strategy: PlayerAiStrategy;
  speed: EndlessBattleSpeed;
  manualMode: boolean;
  activeFloor: EndlessFloorDefinition | null;
  activeBattle: AdvancedBattleState | null;
  startedAt: string | null;
  lastProcessedAt: string | null;
  nextFloorAt: string | null;
  highestFloor: number;
  weeklySeed: string;
  weeklyHighestFloor: number;
  winStreak: number;
  pendingCredits: number;
  equipment: EquipmentInventory;
  lootFilter: LootFilter;
  recentLog: string[];
  claimLedger: Record<string, true>;
}

export interface EndlessAdvanceSummary {
  attemptedFloors: number;
  clearedFloors: number;
  fromFloor: number;
  toFloor: number;
  credits: number;
  equipmentAdded: number;
  equipmentSalvaged: number;
  bossClears: number;
  defeated: boolean;
}

export interface EndlessClaimResult {
  runId: string;
  credits: number;
  upgradeDust: number;
  highestFloor: number;
  equipmentCount: number;
}

const dateValue = (now: Date): number => {
  const value = now.getTime();
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid Endless Mine timestamp');
  return value;
};

const isoWeekSeed = (now: Date): string => {
  const value = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `weekly:${value.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
};

export const createInitialEndlessCampaign = (now = new Date(0)): EndlessCampaignState => ({
  version: ENDLESS_CAMPAIGN_VERSION,
  status: 'READY',
  runId: null,
  run: null,
  partyStoneIds: [],
  partySnapshot: [],
  skillBook: {},
  strategy: 'BALANCED',
  speed: 1,
  manualMode: false,
  activeFloor: null,
  activeBattle: null,
  startedAt: null,
  lastProcessedAt: null,
  nextFloorAt: null,
  highestFloor: 0,
  weeklySeed: isoWeekSeed(now),
  weeklyHighestFloor: 0,
  winStreak: 0,
  pendingCredits: 0,
  equipment: createEquipmentInventory(300),
  lootFilter: { minRarity: 'RARE', autoSalvage: true, alwaysKeepSets: ['ABYSSAL'] },
  recentLog: [],
  claimLedger: {},
});

const appendLog = (state: EndlessCampaignState, text: string): void => {
  state.recentLog = [...state.recentLog, text].slice(-80);
};

const requireRun = (state: EndlessCampaignState): EndlessRunState => {
  if (!state.run || !state.runId) throw new Error('No Endless Mine run exists');
  return state.run;
};

const completeEndlessCampaign = (state: EndlessCampaignState, floor: number): void => {
  const run = requireRun(state);
  run.currentFloor = floor;
  run.status = 'COMPLETE';
  state.status = 'ENDED';
  state.nextFloorAt = null;
  appendLog(state, `最深部 Floor ${floor} を踏破。Endless Mine complete。`);
};

export const startEndlessCampaign = (
  state: EndlessCampaignState,
  stones: Readonly<Record<string, StoneInstance>>,
  partyStoneIds: readonly string[],
  now: Date,
  seed: string,
): EndlessCampaignState => {
  if (state.status === 'RUNNING' || state.status === 'PAUSED') throw new Error('Endless Mine is already active');
  if (state.runId && !state.claimLedger[state.runId]) throw new Error('Claim the previous Endless Mine run before starting another');
  if (partyStoneIds.length < 1 || partyStoneIds.length > 3 || new Set(partyStoneIds).size !== partyStoneIds.length) throw new Error('Endless Mine requires 1-3 unique Stones');
  const partyStones = partyStoneIds.map((id) => stones[id] ?? (() => { throw new Error(`Stone not found: ${id}`); })());
  const nowMs = dateValue(now);
  const runId = `endless:${nowMs}:${seed}`;
  const nextWeeklySeed = isoWeekSeed(now);
  if (state.weeklySeed !== nextWeeklySeed) state.weeklyHighestFloor = 0;
  state.weeklySeed = nextWeeklySeed;
  state.runId = runId;
  // The floor sequence is a true weekly ruleset shared by every run. The
  // caller seed remains in runId for claim idempotency, never for rerolling.
  state.run = createEndlessRun(nextWeeklySeed, 'AUTO');
  state.status = 'RUNNING';
  state.partyStoneIds = [...partyStoneIds];
  state.partySnapshot = partyStones.map((stone) => stoneToAdvancedCombatant(stone));
  state.skillBook = buildStoneCombatSkillBook(partyStones);
  state.manualMode = false;
  state.startedAt = now.toISOString();
  state.lastProcessedAt = now.toISOString();
  state.nextFloorAt = new Date(nowMs + ENDLESS_FLOOR_INTERVAL_MS).toISOString();
  state.activeFloor = null;
  state.activeBattle = null;
  state.winStreak = 0;
  state.pendingCredits = 0;
  appendLog(state, '潜行を開始。Party buildを固定しました。');
  return state;
};

export const setEndlessMode = (state: EndlessCampaignState, manual: boolean): void => {
  const run = requireRun(state);
  state.manualMode = manual;
  run.mode = manual ? 'ACTIVE' : 'AUTO';
  if (manual && state.status === 'RUNNING') prepareManualBattle(state);
};

const prepareManualBattle = (state: EndlessCampaignState): AdvancedBattleState | null => {
  const run = requireRun(state);
  if (run.status !== 'CLIMBING') throw new Error('Endless run is not climbing');
  if (state.activeBattle && !state.activeBattle.outcome) return state.activeBattle;
  // At most nine non-battle floors can precede the next guaranteed boss.
  // Active play resolves them immediately through the same deterministic
  // power check used by offline play, then presents the next real battle.
  for (let traversed = 0; traversed < 10 && state.status === 'RUNNING'; traversed += 1) {
    const floor = generateEndlessFloor(run.currentFloor, run.seed);
    if (!isEndlessCombatEncounter(floor)) {
      const resolution = resolveEndlessFloorByPower(floor, calculateEndlessPartyPower(state.partySnapshot) * DEFAULT_ENDLESS_CONFIG.efficiency.ACTIVE * getEndlessIntegrityPowerMultiplier(run.resonanceIntegrity));
      appendLog(state, `Floor ${floor.floor}: ${floor.encounter.label} / ${floor.encounter.description}`);
      settleResolvedFloor(state, floor, resolution.outcome, 'ACTIVE');
      continue;
    }
    state.activeFloor = floor;
    state.activeBattle = createAdvancedBattle({ units: [...state.partySnapshot, ...floor.enemies], skills: state.skillBook, maxTurns: 80 });
    appendLog(state, `Floor ${floor.floor}: ${floor.encounter.label}出現。`);
    return state.activeBattle;
  }
  if (state.status === 'RUNNING') throw new Error('Unable to prepare the next Endless battle');
  return null;
};

const awardFloorEquipment = (state: EndlessCampaignState, floor: EndlessFloorDefinition): { added: number; salvaged: number } => {
  const rng = new SeededRng(`${requireRun(state).seed}:equipment:${floor.floor}`);
  const chance = Math.min(1, floor.encounter.equipmentChance + (floor.encounterType === 'BATTLE' ? floor.floor * 0.0005 : 0));
  if (!rng.chance(chance)) return { added: 0, salvaged: 0 };
  const rarity = floor.isBossFloor && floor.floor >= 100
    ? 'EPIC' as const
    : floor.encounterType === 'ELITE' && floor.floor >= 50
      ? 'RARE' as const
      : undefined;
  const item = generateEquipment({ level: floor.floor, rarity, source: `endless-${floor.floor}` }, rng);
  const result = addEquipment(state.equipment, item, state.lootFilter);
  appendLog(state, result.accepted
    ? `${item.rarity} ${item.name}を獲得。`
    : `${item.name}を容量保護${result.reason === 'FILTERED' ? '・Loot Filter' : ''}分解（素材 +${result.materialsGained}）。`);
  return { added: result.accepted ? 1 : 0, salvaged: result.salvagedIds.length };
};

const settleResolvedFloor = (
  state: EndlessCampaignState,
  floor: EndlessFloorDefinition,
  outcome: 'PLAYER' | 'ENEMY' | 'DRAW',
  mode: 'ACTIVE' | 'AUTO' | 'OFFLINE',
): EndlessAdvanceSummary => {
  const run = requireRun(state);
  const from = floor.floor;
  run.battles = safeProgressionAdd(run.battles, 1);
  const recoveredIntegrity = settleEndlessIntegrity(run, floor, outcome === 'PLAYER');
  let credits = 0;
  let equipmentAdded = 0;
  let equipmentSalvaged = 0;
  let bossClears = 0;
  if (outcome === 'PLAYER') {
    const firstClear = floor.floor > run.highestClearedFloor;
    if (firstClear) {
      credits = Math.floor(floor.baseReward * DEFAULT_ENDLESS_CONFIG.efficiency[mode]);
      run.totalReward = Math.min(MAX_ENDLESS_REWARD, safeProgressionAdd(run.totalReward, credits));
      state.pendingCredits = safeProgressionAdd(state.pendingCredits, credits);
      run.highestClearedFloor = floor.floor;
    }
    state.highestFloor = Math.max(state.highestFloor, floor.floor);
    state.weeklyHighestFloor = Math.max(state.weeklyHighestFloor, floor.floor);
    state.winStreak = safeProgressionAdd(state.winStreak, 1);
    if (firstClear && floor.isBossFloor) { run.clearedBosses = safeProgressionAdd(run.clearedBosses, 1); bossClears = 1; }
    if (floor.floor % 10 === 0) run.checkpointFloor = floor.floor;
    if (firstClear) {
      const loot = awardFloorEquipment(state, floor);
      equipmentAdded = loot.added;
      equipmentSalvaged = loot.salvaged;
    }
    const recovery = recoveredIntegrity > 0 ? ` / 共鳴完全性 +${recoveredIntegrity} (${run.resonanceIntegrity}/100)` : ` / 共鳴完全性 ${run.resonanceIntegrity}/100`;
    appendLog(state, `Floor ${floor.floor} ${floor.encounterType} clear / CREDIT +${credits.toLocaleString('en-US')}${recovery}`);
    if (floor.floor >= DEFAULT_ENDLESS_CONFIG.maxFloor) completeEndlessCampaign(state, floor.floor);
    else run.currentFloor = floor.floor + 1;
  } else {
    run.status = 'DEFEATED';
    run.lastDefeatFloor = floor.floor;
    state.status = 'ENDED';
    state.nextFloorAt = null;
    state.winStreak = 0;
    appendLog(state, `Floor ${floor.floor} ${floor.encounterType}で共鳴崩壊。Checkpoint ${run.checkpointFloor}へ帰還可能。`);
  }
  state.activeBattle = null;
  state.activeFloor = null;
  return { attemptedFloors: 1, clearedFloors: outcome === 'PLAYER' ? 1 : 0, fromFloor: from, toFloor: run.currentFloor, credits, equipmentAdded, equipmentSalvaged, bossClears, defeated: outcome !== 'PLAYER' };
};

const settleManualFloor = (state: EndlessCampaignState): EndlessAdvanceSummary | null => {
  const battle = state.activeBattle;
  const floor = state.activeFloor;
  if (!battle?.outcome || !floor) return null;
  return settleResolvedFloor(state, floor, battle.outcome, state.manualMode ? 'ACTIVE' : 'AUTO');
};

export const runEndlessManualRound = (
  state: EndlessCampaignState,
  skillId: string,
  targetIds?: readonly string[],
): EndlessAdvanceSummary | null => {
  if (state.status !== 'RUNNING' || !state.manualMode) throw new Error('Manual Endless battle is not active');
  const battle = prepareManualBattle(state);
  if (!battle) throw new Error('The Endless encounter resolved without a manual battle');
  const playerActorId = getTurnOrder(battle).find((id) => battle.units.find((unit) => unit.id === id)?.side === 'PLAYER');
  if (!playerActorId) throw new Error('No living player actor');
  if (!getUsableSkills(battle, playerActorId).some((skill) => skill.id === skillId)) throw new Error('Selected skill is not usable');
  const command: CombatCommand = { actorId: playerActorId, skillId, targetIds };
  const playerAi = createAutoCommandProvider(state.strategy);
  const enemyAi = createAutoCommandProvider('AGGRESSIVE');
  const rng = new SeededRng(`${requireRun(state).seed}:manual:${requireRun(state).currentFloor}:${battle.turn}`);
  runAdvancedRound(battle, {
    commands: { [playerActorId]: command },
    commandProvider: (current, actorId, source) => current.units.find((unit) => unit.id === actorId)?.side === 'PLAYER'
      ? playerAi(current, actorId, source)
      : enemyAi(current, actorId, source),
  }, rng);
  const latest = battle.log.slice(-battle.units.length).map((entry) => `${entry.actorId}: ${entry.skillId}`);
  for (const line of latest) appendLog(state, line);
  return settleManualFloor(state);
};

const resolveAutoFloor = (state: EndlessCampaignState): EndlessAdvanceSummary => {
  const run = requireRun(state);
  const fromFloor = run.currentFloor;
  // Switching from manual to auto must continue the exact persisted battle.
  // Starting a fresh probabilistic encounter here would make both modes diverge
  // and could be exploited to erase a bad manual turn.
  const floor = state.activeFloor?.floor === fromFloor
    ? state.activeFloor
    : generateEndlessFloor(fromFloor, run.seed);
  if (!isEndlessCombatEncounter(floor)) {
    if (state.activeBattle) throw new Error('Non-combat Endless floor cannot retain a battle');
    const resolution = resolveEndlessFloorByPower(floor, calculateEndlessPartyPower(state.partySnapshot) * DEFAULT_ENDLESS_CONFIG.efficiency.AUTO * getEndlessIntegrityPowerMultiplier(run.resonanceIntegrity));
    appendLog(state, `Floor ${floor.floor}: ${floor.encounter.label} / ${floor.encounter.description}`);
    return settleResolvedFloor(state, floor, resolution.outcome, 'AUTO');
  }
  const battle = state.activeBattle && state.activeFloor?.floor === fromFloor && !state.activeBattle.outcome
    ? state.activeBattle
    : createAdvancedBattle({ units: [...state.partySnapshot, ...floor.enemies], skills: state.skillBook, maxTurns: 80 });
  const player = createAutoCommandProvider(state.strategy);
  const enemy = createAutoCommandProvider(floor.isBossFloor ? 'BOSS_FOCUS' : 'AGGRESSIVE');
  runAdvancedBattle(battle, (current, actorId, rng) => current.units.find((unit) => unit.id === actorId)?.side === 'PLAYER'
    ? player(current, actorId, rng)
    : enemy(current, actorId, rng), new SeededRng(`${run.seed}:auto:${fromFloor}:${battle.turn}`));
  state.activeFloor = floor;
  state.activeBattle = battle;
  return settleManualFloor(state)!;
};

export const advanceEndlessAuto = (state: EndlessCampaignState, maxFloors = 1, now = new Date()): EndlessAdvanceSummary => {
  if (state.status !== 'RUNNING' || state.manualMode) throw new Error('Auto Endless Mine is not running');
  if (!Number.isSafeInteger(maxFloors) || maxFloors < 0 || maxFloors > 10_000) throw new RangeError('Invalid floor batch size');
  const initialFloor = requireRun(state).currentFloor;
  const aggregate: EndlessAdvanceSummary = { attemptedFloors: 0, clearedFloors: 0, fromFloor: initialFloor, toFloor: initialFloor, credits: 0, equipmentAdded: 0, equipmentSalvaged: 0, bossClears: 0, defeated: false };
  if (maxFloors === 0) return aggregate;
  const nowMs = dateValue(now);
  const nextDueMs = Date.parse(state.nextFloorAt ?? '');
  if (!Number.isFinite(nextDueMs)) throw new Error('Auto Endless Mine has no valid next floor time');
  if (nowMs < nextDueMs) throw new Error('The next Endless Mine floor is not ready yet');
  const dueFloors = Math.min(10_000, Math.floor((nowMs - nextDueMs) / ENDLESS_FLOOR_INTERVAL_MS) + 1);
  const floorBudget = Math.min(maxFloors, dueFloors);
  while (aggregate.attemptedFloors < floorBudget && state.status === 'RUNNING') {
    const result = resolveAutoFloor(state);
    aggregate.attemptedFloors += 1;
    aggregate.clearedFloors += result.clearedFloors;
    aggregate.credits = safeProgressionAdd(aggregate.credits, result.credits);
    aggregate.equipmentAdded += result.equipmentAdded;
    aggregate.equipmentSalvaged += result.equipmentSalvaged;
    aggregate.bossClears += result.bossClears;
    aggregate.defeated ||= result.defeated;
  }
  aggregate.toFloor = requireRun(state).currentFloor;
  const consumedThroughMs = nextDueMs + Math.max(0, aggregate.attemptedFloors - 1) * ENDLESS_FLOOR_INTERVAL_MS;
  state.lastProcessedAt = new Date(consumedThroughMs).toISOString();
  state.nextFloorAt = state.status === 'RUNNING'
    ? new Date(nextDueMs + aggregate.attemptedFloors * ENDLESS_FLOOR_INTERVAL_MS).toISOString()
    : null;
  return aggregate;
};

export const processEndlessOffline = (state: EndlessCampaignState, now: Date): EndlessAdvanceSummary => {
  const run = requireRun(state);
  const fromMs = Date.parse(state.lastProcessedAt ?? state.startedAt ?? now.toISOString());
  const nowMs = dateValue(now);
  const fromFloor = run.currentFloor;
  const empty: EndlessAdvanceSummary = { attemptedFloors: 0, clearedFloors: 0, fromFloor, toFloor: fromFloor, credits: 0, equipmentAdded: 0, equipmentSalvaged: 0, bossClears: 0, defeated: false };
  if (state.status !== 'RUNNING' || state.manualMode || !Number.isFinite(fromMs) || nowMs <= fromMs) return empty;
  const persistedNextDueMs = Date.parse(state.nextFloorAt ?? new Date(fromMs + ENDLESS_FLOOR_INTERVAL_MS).toISOString());
  if (!Number.isFinite(persistedNextDueMs) || nowMs < persistedNextDueMs) return empty;
  // Discard time older than the authoritative 720-hour window. Advancing the
  // processed anchor to the end of that window also prevents repeated calls at
  // the same timestamp from claiming multiple 30-day batches.
  const nextDueMs = Math.max(persistedNextDueMs, nowMs - MAX_ENDLESS_OFFLINE_MS + ENDLESS_FLOOR_INTERVAL_MS);
  const dueFloors = Math.min(
    Math.floor(MAX_ENDLESS_OFFLINE_MS / ENDLESS_FLOOR_INTERVAL_MS),
    Math.floor((nowMs - nextDueMs) / ENDLESS_FLOOR_INTERVAL_MS) + 1,
  );
  const aggregate: EndlessAdvanceSummary = { ...empty };
  const basePower = calculateEndlessPartyPower(state.partySnapshot) * DEFAULT_ENDLESS_CONFIG.efficiency.OFFLINE;
  while (aggregate.attemptedFloors < dueFloors && state.status === 'RUNNING') {
    const floor = generateEndlessFloor(run.currentFloor, run.seed);
    const resolution = resolveEndlessFloorByPower(floor, basePower * getEndlessIntegrityPowerMultiplier(run.resonanceIntegrity));
    const settled = settleResolvedFloor(state, floor, resolution.outcome, 'OFFLINE');
    aggregate.attemptedFloors += settled.attemptedFloors;
    aggregate.clearedFloors += settled.clearedFloors;
    aggregate.credits = safeProgressionAdd(aggregate.credits, settled.credits);
    aggregate.equipmentAdded += settled.equipmentAdded;
    aggregate.equipmentSalvaged += settled.equipmentSalvaged;
    aggregate.bossClears += settled.bossClears;
    aggregate.defeated ||= settled.defeated;
  }
  aggregate.toFloor = run.currentFloor;
  const consumedThroughMs = nextDueMs + Math.max(0, aggregate.attemptedFloors - 1) * ENDLESS_FLOOR_INTERVAL_MS;
  state.lastProcessedAt = new Date(consumedThroughMs).toISOString();
  // Preserve the sub-floor remainder. A 6-minute absence clears one 5-minute
  // floor and leaves the next due at minute 10 instead of throwing away 1 min.
  state.nextFloorAt = state.status === 'RUNNING'
    ? new Date(nextDueMs + aggregate.attemptedFloors * ENDLESS_FLOOR_INTERVAL_MS).toISOString()
    : null;
  if (aggregate.clearedFloors) appendLog(state, `OFFLINE: Floor ${fromFloor} → ${run.currentFloor} / ${aggregate.clearedFloors} clear。`);
  return aggregate;
};

export const pauseEndlessCampaign = (state: EndlessCampaignState, now: Date): void => {
  if (state.status !== 'RUNNING') throw new Error('Endless Mine is not running');
  state.status = 'PAUSED';
  state.lastProcessedAt = now.toISOString();
  state.nextFloorAt = null;
  appendLog(state, '潜行を一時停止。');
};

export const resumeEndlessCampaign = (state: EndlessCampaignState, now: Date): void => {
  const run = requireRun(state);
  if (state.status !== 'PAUSED' && !(state.status === 'ENDED' && run.status === 'DEFEATED')) throw new Error('Endless Mine cannot resume');
  const checkpointRestart = run.status === 'DEFEATED';
  if (checkpointRestart) {
    run.currentFloor = Math.max(1, run.checkpointFloor + 1);
    run.resonanceIntegrity = Math.max(50, run.resonanceIntegrity);
    run.status = 'CLIMBING';
    state.activeBattle = null;
    state.activeFloor = null;
  }
  state.status = 'RUNNING';
  state.lastProcessedAt = now.toISOString();
  state.nextFloorAt = new Date(dateValue(now) + ENDLESS_FLOOR_INTERVAL_MS).toISOString();
  appendLog(state, checkpointRestart ? `Checkpoint ${run.checkpointFloor}から潜行再開。` : '中断した戦闘状態から潜行再開。');
};

export const setEndlessLootFilter = (state: EndlessCampaignState, filter: LootFilter): void => {
  validateLootFilter(filter);
  state.lootFilter = { ...filter, allowedSlots: filter.allowedSlots ? [...filter.allowedSlots] : undefined, alwaysKeepSets: filter.alwaysKeepSets ? [...filter.alwaysKeepSets] : undefined };
};

export const claimEndlessCampaign = (state: EndlessCampaignState): EndlessClaimResult => {
  const run = requireRun(state);
  const runId = state.runId!;
  if (state.claimLedger[runId]) throw new Error('Endless Mine reward was already claimed');
  if (state.status === 'RUNNING') throw new Error('Pause or retreat before claiming Endless rewards');
  const credits = state.pendingCredits;
  const upgradeDust = state.equipment.salvageMaterials;
  state.claimLedger[runId] = true;
  state.pendingCredits = 0;
  state.equipment.salvageMaterials = 0;
  state.status = 'ENDED';
  state.nextFloorAt = null;
  state.activeBattle = null;
  state.activeFloor = null;
  return { runId, credits, upgradeDust, highestFloor: run.highestClearedFloor, equipmentCount: state.equipment.items.length };
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const safeInteger = (value: unknown, min = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
const validIso = (value: unknown, nullable = false): boolean => value === null ? nullable : typeof value === 'string' && Number.isFinite(Date.parse(value));
const finiteNumber = (value: unknown, min = 0, max = 1_000_000_000_000): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const nonEmptyString = (value: unknown, max = 256): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;

const combatStats = ['maxHp', 'attack', 'defense', 'speed', 'accuracy', 'resistance', 'critChance', 'critDamage', 'breakPower'] as const;
const combatRoles = ['VANGUARD', 'TANK', 'GUARDIAN', 'STRIKER', 'BREAKER', 'SUPPORT', 'CONTROLLER'];
const combatTargets = ['SELF', 'ALLY_LOWEST', 'ALL_ALLIES', 'ENEMY', 'ALL_ENEMIES', 'BOSS'];
const combatEffects = ['DAMAGE', 'HEAL', 'SHIELD', 'BUFF', 'DEBUFF', 'DOT', 'CONTROL', 'BREAK', 'COUNTER', 'ULTIMATE_GAIN', 'STATUS'];

const validateCombatant = (value: unknown, runtime = false): void => {
  if (!isRecord(value) || !nonEmptyString(value.id) || !nonEmptyString(value.name) || !['PLAYER', 'ENEMY'].includes(String(value.side)) || !combatRoles.includes(String(value.role))) throw new Error('Invalid Endless combatant identity');
  if (!safeInteger(value.level, 1) || !isRecord(value.stats)) throw new Error('Invalid Endless combatant progression');
  for (const key of combatStats) if (!finiteNumber(value.stats[key])) throw new Error(`Invalid Endless combatant ${key}`);
  if (!Array.isArray(value.skillIds) || value.skillIds.length > 64 || value.skillIds.some((id) => !nonEmptyString(id)) || new Set(value.skillIds).size !== value.skillIds.length) throw new Error('Invalid Endless combatant skills');
  if (runtime) {
    for (const key of ['hp', 'shield', 'ultimate', 'breakGauge'] as const) if (!finiteNumber(value[key])) throw new Error(`Invalid Endless battle unit ${key}`);
    if (typeof value.alive !== 'boolean' || !isRecord(value.cooldowns) || Object.values(value.cooldowns).some((entry) => !safeInteger(entry))) throw new Error('Invalid Endless battle unit state');
    for (const key of ['modifiers', 'dots', 'controls', 'statuses'] as const) if (!Array.isArray(value[key]) || value[key].length > 256) throw new Error(`Invalid Endless battle unit ${key}`);
    if (value.counter !== null && !isRecord(value.counter)) throw new Error('Invalid Endless battle counter');
    if (value.bossState !== null && !isRecord(value.bossState)) throw new Error('Invalid Endless battle boss state');
  }
};

const validateSkillBook = (value: unknown): void => {
  if (!isRecord(value) || Object.keys(value).length > 256) throw new Error('Invalid Endless Mine skill book');
  for (const [key, skill] of Object.entries(value)) {
    if (!isRecord(skill) || skill.id !== key || !nonEmptyString(skill.id) || !nonEmptyString(skill.name) || !combatTargets.includes(String(skill.target)) || !Array.isArray(skill.effects) || skill.effects.length > 32) throw new Error('Invalid Endless skill definition');
    for (const effect of skill.effects) {
      if (!isRecord(effect) || !combatEffects.includes(String(effect.kind))) throw new Error('Invalid Endless skill effect');
      for (const field of ['power', 'value', 'duration', 'chance'] as const) if (effect[field] !== undefined && !finiteNumber(effect[field], -1_000_000_000_000)) throw new Error(`Invalid Endless skill effect ${field}`);
    }
  }
};

const validateFloor = (value: unknown): void => {
  if (!isRecord(value) || !safeInteger(value.floor, 1) || value.floor > MAX_ENDLESS_FLOOR || !['CRYSTAL_CAVERN', 'MAGMA_VEIN', 'FOSSIL_DEPTHS', 'ASTRAL_RIFT'].includes(String(value.biome)) || typeof value.isBossFloor !== 'boolean' || !finiteNumber(value.difficulty) || !safeInteger(value.baseReward)) throw new Error('Invalid Endless active floor');
  // schema-v5 saves created before encounter floors only persisted real battles.
  // Upgrade those in place without changing their battle or reward snapshot.
  if (value.encounterType === undefined && value.encounter === undefined) {
    const boss = value.isBossFloor === true;
    value.encounterType = boss ? 'BOSS' : 'BATTLE';
    value.encounter = {
      label: boss ? 'Depth Guardian' : 'Shard Ambush',
      description: 'Legacy persisted combat encounter.',
      rewardMultiplier: boss ? 4 : 1,
      powerMultiplier: boss ? 1.15 : 1,
      equipmentChance: boss ? 1 : 0.18,
      recoveryRatio: 0,
      risk: boss ? 0.3 : 0.12,
      outcomeRoll: 0.5,
    };
  }
  if (!ENDLESS_ENCOUNTER_TYPES.includes(value.encounterType as typeof ENDLESS_ENCOUNTER_TYPES[number])) throw new Error('Invalid Endless encounter type');
  if ((value.encounterType === 'BOSS') !== value.isBossFloor) throw new Error('Invalid Endless boss encounter');
  if (!isRecord(value.encounter) || !nonEmptyString(value.encounter.label) || !nonEmptyString(value.encounter.description)) throw new Error('Invalid Endless encounter definition');
  for (const key of ['rewardMultiplier', 'powerMultiplier', 'equipmentChance', 'recoveryRatio', 'risk', 'outcomeRoll'] as const) {
    if (!finiteNumber(value.encounter[key], 0, key === 'rewardMultiplier' || key === 'powerMultiplier' ? 10 : 1)) throw new Error(`Invalid Endless encounter ${key}`);
  }
  if (!Array.isArray(value.rules) || value.rules.length > 8 || value.rules.some((rule) => !isRecord(rule) || !nonEmptyString(rule.id) || !nonEmptyString(rule.label))) throw new Error('Invalid Endless floor rules');
  const combat = value.encounterType === 'BATTLE' || value.encounterType === 'ELITE' || value.encounterType === 'BOSS';
  if (!Array.isArray(value.enemies) || value.enemies.length > 16 || (combat ? value.enemies.length < 1 : value.enemies.length !== 0)) throw new Error('Invalid Endless floor enemies');
  for (const enemy of value.enemies) validateCombatant(enemy);
};

const validateBattle = (value: unknown): void => {
  if (!isRecord(value) || !Array.isArray(value.units) || value.units.length < 1 || value.units.length > 32 || !safeInteger(value.turn) || !safeInteger(value.maxTurns, 1) || value.maxTurns > 10_000 || ![null, 'PLAYER', 'ENEMY', 'DRAW'].includes(value.outcome as null | string) || !Array.isArray(value.log) || value.log.length > 100_000 || !isRecord(value.synergies)) throw new Error('Invalid Endless active battle');
  for (const unit of value.units) validateCombatant(unit, true);
  validateSkillBook(value.skills);
};

const validateLootFilter = (value: unknown): void => {
  if (!isRecord(value) || Object.keys(value).some((key) => !['minRarity', 'minScore', 'allowedSlots', 'alwaysKeepSets', 'autoSalvage'].includes(key))) throw new Error('Invalid Endless loot filter');
  if (value.minRarity !== undefined && !EQUIPMENT_RARITIES.includes(value.minRarity as typeof EQUIPMENT_RARITIES[number])) throw new Error('Invalid Endless loot rarity');
  if (value.minScore !== undefined && !finiteNumber(value.minScore)) throw new Error('Invalid Endless loot score');
  if (value.autoSalvage !== undefined && typeof value.autoSalvage !== 'boolean') throw new Error('Invalid Endless auto salvage');
  if (value.allowedSlots !== undefined && (!Array.isArray(value.allowedSlots) || value.allowedSlots.some((slot) => !EQUIPMENT_SLOTS.includes(slot)) || new Set(value.allowedSlots).size !== value.allowedSlots.length)) throw new Error('Invalid Endless allowed slots');
  const setIds = Object.keys(EQUIPMENT_SETS);
  if (value.alwaysKeepSets !== undefined && (!Array.isArray(value.alwaysKeepSets) || value.alwaysKeepSets.some((setId) => !setIds.includes(String(setId))) || new Set(value.alwaysKeepSets).size !== value.alwaysKeepSets.length)) throw new Error('Invalid Endless kept sets');
};

/** Strict import boundary for the serialised campaign embedded in schema-v5. */
export const validateEndlessCampaignState = (value: unknown): EndlessCampaignState => {
  if (!isRecord(value) || value.version !== 1) throw new Error('Invalid Endless Mine state version');
  if (!['READY', 'RUNNING', 'PAUSED', 'ENDED'].includes(String(value.status))) throw new Error('Invalid Endless Mine status');
  if (!Array.isArray(value.partyStoneIds) || value.partyStoneIds.length > 3 || value.partyStoneIds.some((id) => typeof id !== 'string') || new Set(value.partyStoneIds).size !== value.partyStoneIds.length) throw new Error('Invalid Endless Mine party');
  if (!Array.isArray(value.partySnapshot) || value.partySnapshot.length > 3) throw new Error('Invalid Endless Mine snapshot');
  for (const member of value.partySnapshot) validateCombatant(member);
  validateSkillBook(value.skillBook);
  if (!['BALANCED', 'AGGRESSIVE', 'DEFENSIVE', 'BOSS_FOCUS', 'RESOURCE_SAVE'].includes(String(value.strategy))) throw new Error('Invalid Endless Mine strategy');
  if (![1, 2, 4].includes(Number(value.speed)) || typeof value.manualMode !== 'boolean') throw new Error('Invalid Endless Mine controls');
  for (const key of ['startedAt', 'lastProcessedAt', 'nextFloorAt'] as const) if (!validIso(value[key], true)) throw new Error(`Invalid Endless Mine ${key}`);
  for (const key of ['highestFloor', 'weeklyHighestFloor', 'winStreak', 'pendingCredits'] as const) if (!safeInteger(value[key])) throw new Error(`Invalid Endless Mine ${key}`);
  if ((value.highestFloor as number) > MAX_ENDLESS_FLOOR || (value.weeklyHighestFloor as number) > MAX_ENDLESS_FLOOR || (value.pendingCredits as number) > MAX_ENDLESS_REWARD) throw new Error('Invalid Endless campaign bounds');
  if (typeof value.weeklySeed !== 'string' || value.weeklySeed.length > 128) throw new Error('Invalid weekly seed');
  if (!Array.isArray(value.recentLog) || value.recentLog.length > 80 || value.recentLog.some((line) => typeof line !== 'string' || line.length > 1_000)) throw new Error('Invalid Endless Mine log');
  if (!isRecord(value.claimLedger) || Object.keys(value.claimLedger).length > 100_000 || Object.keys(value.claimLedger).some((key) => !nonEmptyString(key, 512)) || Object.values(value.claimLedger).some((entry) => entry !== true)) throw new Error('Invalid Endless Mine claim ledger');
  const equipment = value.equipment;
  if (!isRecord(equipment) || !safeInteger(equipment.capacity, 1) || equipment.capacity > 10_000 || !safeInteger(equipment.salvageMaterials) || !Array.isArray(equipment.items) || equipment.items.length > equipment.capacity) throw new Error('Invalid Endless equipment inventory');
  const equipmentIds = new Set<string>();
  for (const item of equipment.items) {
    if (!isRecord(item) || !nonEmptyString(item.id, 512) || typeof item.locked !== 'boolean' || !Array.isArray(item.affixes)) throw new Error('Invalid Endless equipment item');
    if (equipmentIds.has(item.id)) throw new Error(`Duplicate Endless equipment id ${item.id}`);
    equipmentIds.add(item.id);
    shouldKeepEquipment(item as unknown as Parameters<typeof shouldKeepEquipment>[0]);
  }
  validateLootFilter(value.lootFilter);
  if ((value.activeFloor === null) !== (value.activeBattle === null)) throw new Error('Incomplete Endless active battle');
  if (value.activeFloor !== null) validateFloor(value.activeFloor);
  if (value.activeBattle !== null) validateBattle(value.activeBattle);
  if (isRecord(value.activeFloor) && !['BATTLE', 'ELITE', 'BOSS'].includes(String(value.activeFloor.encounterType))) throw new Error('Non-combat Endless floor cannot retain a battle');
  if (value.runId !== null && !nonEmptyString(value.runId, 512)) throw new Error('Invalid Endless run id');
  if (value.run !== null) {
    if (!isRecord(value.run) || !nonEmptyString(value.run.seed) || !['ACTIVE', 'AUTO', 'OFFLINE'].includes(String(value.run.mode)) || !['CLIMBING', 'DEFEATED', 'COMPLETE'].includes(String(value.run.status))) throw new Error('Invalid Endless run');
    if (value.run.resonanceIntegrity === undefined) value.run.resonanceIntegrity = MAX_ENDLESS_INTEGRITY;
    for (const key of ['currentFloor', 'highestClearedFloor', 'checkpointFloor', 'totalReward', 'clearedBosses', 'battles', 'resonanceIntegrity'] as const) if (!safeInteger(value.run[key])) throw new Error(`Invalid Endless run ${key}`);
    const currentFloor = value.run.currentFloor as number;
    const highestClearedFloor = value.run.highestClearedFloor as number;
    const checkpointFloor = value.run.checkpointFloor as number;
    const clearedBosses = value.run.clearedBosses as number;
    if (currentFloor < 1 || currentFloor > MAX_ENDLESS_FLOOR || highestClearedFloor > MAX_ENDLESS_FLOOR || checkpointFloor > highestClearedFloor || checkpointFloor % DEFAULT_ENDLESS_CONFIG.checkpointInterval !== 0 || clearedBosses > Math.floor(highestClearedFloor / 10) || (value.run.totalReward as number) > MAX_ENDLESS_REWARD || (value.run.resonanceIntegrity as number) > MAX_ENDLESS_INTEGRITY) throw new Error('Invalid Endless run floor bounds');
    if (value.run.lastDefeatFloor !== null && (!safeInteger(value.run.lastDefeatFloor, 1) || value.run.lastDefeatFloor > MAX_ENDLESS_FLOOR)) throw new Error('Invalid Endless defeat floor');
    if (value.run.status === 'DEFEATED' && (value.run.lastDefeatFloor === null || currentFloor !== value.run.lastDefeatFloor)) throw new Error('Incoherent defeated Endless run');
    if (value.run.status === 'COMPLETE' && (currentFloor !== MAX_ENDLESS_FLOOR || highestClearedFloor !== MAX_ENDLESS_FLOOR)) throw new Error('Incoherent completed Endless run');
  }
  if ((value.run === null) !== (value.runId === null)) throw new Error('Incomplete Endless run identity');
  if (value.status === 'READY' && (value.run !== null || value.runId !== null || value.partyStoneIds.length || value.partySnapshot.length || value.activeFloor !== null)) throw new Error('Incoherent ready Endless campaign');
  if (value.run !== null && value.partySnapshot.length !== value.partyStoneIds.length) throw new Error('Incoherent Endless party snapshot');
  if ((value.status === 'RUNNING' || value.status === 'PAUSED') && (value.run === null || value.run.status !== 'CLIMBING')) throw new Error('Active Endless campaign has no climbing run');
  if (value.status === 'ENDED' && value.run?.status === 'CLIMBING' && !value.claimLedger[String(value.runId)]) throw new Error('Unclaimed climbing run cannot be ended');
  if (value.run?.status === 'DEFEATED' && value.status !== 'ENDED') throw new Error('Defeated Endless run must be ended');
  if (value.run?.status === 'COMPLETE' && value.status !== 'ENDED') throw new Error('Completed Endless run must be ended');
  if (value.status === 'ENDED' && value.activeFloor !== null) throw new Error('Ended Endless campaign cannot retain a battle');
  if (value.status === 'RUNNING' && !value.nextFloorAt) throw new Error('Running Endless Mine is incomplete');
  if (value.status !== 'RUNNING' && value.nextFloorAt !== null) throw new Error('Inactive Endless Mine has a pending timer');
  if (value.run !== null && (!value.startedAt || !value.lastProcessedAt)) throw new Error('Endless run timestamps are missing');
  if (value.run && ((value.highestFloor as number) < (value.run.highestClearedFloor as number) || (value.pendingCredits as number) > (value.run.totalReward as number))) throw new Error('Incoherent Endless campaign progress');
  if (isRecord(value.activeFloor) && value.run && value.activeFloor.floor !== value.run.currentFloor) throw new Error('Endless active floor does not match run');
  const numericStack: unknown[] = [value.partySnapshot, value.skillBook, value.activeFloor, value.activeBattle];
  while (numericStack.length) {
    const next = numericStack.pop();
    if (typeof next === 'number' && !Number.isFinite(next)) throw new Error('Endless Mine contains a non-finite number');
    if (Array.isArray(next)) numericStack.push(...next);
    else if (isRecord(next)) numericStack.push(...Object.values(next));
  }
  return value as unknown as EndlessCampaignState;
};
