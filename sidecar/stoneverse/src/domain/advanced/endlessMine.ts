import { SeededRng, type RandomSource } from '../rng';
import { createAutoCommandProvider, type AiStrategy } from './ai';
import {
  createAdvancedBattle,
  runAdvancedBattle,
  STANDARD_ADVANCED_SKILLS,
  type AdvancedBattleState,
  type AdvancedSkillDefinition,
  type CombatantTemplate,
  type CombatElement,
} from './combat';

/** Operational overflow guard, not a designed ending. Content validation covers at least floors 1..1,000. */
export const MAX_ENDLESS_FLOOR = 1_000_000;
export const MAX_ENDLESS_REWARD = Number.MAX_SAFE_INTEGER;
export const MAX_ENDLESS_INTEGRITY = 100;

export type EndlessMode = 'ACTIVE' | 'AUTO' | 'OFFLINE';
export type EndlessRunStatus = 'CLIMBING' | 'DEFEATED' | 'COMPLETE';
export type EndlessBiome = 'CRYSTAL_CAVERN' | 'MAGMA_VEIN' | 'FOSSIL_DEPTHS' | 'ASTRAL_RIFT';
export const ENDLESS_ENCOUNTER_TYPES = ['BATTLE', 'MINING', 'TREASURE', 'ELITE', 'REST', 'RANDOM_EVENT', 'BOSS'] as const;
export type EndlessEncounterType = (typeof ENDLESS_ENCOUNTER_TYPES)[number];
export type EndlessRuleId =
  | 'LOW_GRAVITY'
  | 'STONE_DUST'
  | 'FRACTURED_GROUND'
  | 'RESONANT_AIR'
  | 'BOSS_FLOOR'
  | 'WEEKLY_OVERCHARGE'
  | 'WEEKLY_FORTUNE'
  | 'WEEKLY_FRACTURE';

export interface EndlessFloorRule {
  id: EndlessRuleId;
  label: string;
  attackMultiplier: number;
  defenseMultiplier: number;
  speedMultiplier: number;
  accuracyMultiplier: number;
  breakMultiplier: number;
}

export interface EndlessEncounterDefinition {
  label: string;
  description: string;
  /** Multiplier already reflected by baseReward; exposed for previews and audits. */
  rewardMultiplier: number;
  /** Scales the deterministic power check for non-combat/offline resolution. */
  powerMultiplier: number;
  /** Deterministic drop chance evaluated from the floor seed. */
  equipmentChance: number;
  /** Recovery supplied by a safe floor. Runtime battles start fresh, so this is reported as expedition recovery. */
  recoveryRatio: number;
  /** Extra deterministic challenge variance. Zero means a completely safe encounter. */
  risk: number;
  /** Persisted seed-derived roll; same seed and floor therefore resolve identically for the same power. */
  outcomeRoll: number;
}

export interface EndlessFloorDefinition {
  floor: number;
  biome: EndlessBiome;
  encounterType: EndlessEncounterType;
  isBossFloor: boolean;
  difficulty: number;
  rules: EndlessFloorRule[];
  enemies: CombatantTemplate[];
  encounter: EndlessEncounterDefinition;
  baseReward: number;
}

export interface EndlessMineConfig {
  maxFloor: number;
  checkpointInterval: number;
  battleMaxTurns: number;
  efficiency: Record<EndlessMode, number>;
  offlineFloorsPerHour: number;
  maxOfflineHours: number;
}

export type EndlessConfigOverrides = Omit<Partial<EndlessMineConfig>, 'efficiency'> & {
  efficiency?: Partial<Record<EndlessMode, number>>;
};

export const DEFAULT_ENDLESS_CONFIG: Readonly<EndlessMineConfig> = {
  maxFloor: MAX_ENDLESS_FLOOR,
  checkpointInterval: 10,
  battleMaxTurns: 80,
  efficiency: { ACTIVE: 1, AUTO: 0.94, OFFLINE: 0.78 },
  offlineFloorsPerHour: 12,
  maxOfflineHours: 720,
};

export interface EndlessRunState {
  seed: string;
  mode: EndlessMode;
  status: EndlessRunStatus;
  currentFloor: number;
  highestClearedFloor: number;
  checkpointFloor: number;
  lastDefeatFloor: number | null;
  totalReward: number;
  clearedBosses: number;
  battles: number;
  /** Persistent run condition. REST floors restore it; risky floors wear it down. */
  resonanceIntegrity: number;
}

export interface FloorResolution {
  outcome: 'PLAYER' | 'ENEMY' | 'DRAW';
  turns: number;
  encounterType?: EndlessEncounterType;
  recoveredRatio?: number;
}

export type EndlessFloorResolver = (
  battle: AdvancedBattleState,
  floor: EndlessFloorDefinition,
  rng: RandomSource,
) => FloorResolution;

export interface AdvanceFloorOptions {
  config?: EndlessConfigOverrides;
  rng?: RandomSource;
  playerStrategy?: AiStrategy;
  enemyStrategy?: AiStrategy;
  /** Host skill book merged over the built-in enemy skills. */
  skills?: Readonly<Record<string, AdvancedSkillDefinition>>;
  resolveFloor?: EndlessFloorResolver;
}

export interface AutoClimbOptions extends AdvanceFloorOptions {
  maxBattles?: number;
}

export interface EndlessAggregateSimulation {
  fromFloor: number;
  toFloor: number;
  floors: number;
  bossFloors: number;
  enemies: number;
  totalBaseReward: number;
  maxDifficulty: number;
  finite: boolean;
}

export interface OfflineProgressResult {
  attemptedFloors: number;
  clearedFloors: number;
  reward: number;
  stoppedAtFloor: number;
}

const biomes: readonly EndlessBiome[] = ['CRYSTAL_CAVERN', 'MAGMA_VEIN', 'FOSSIL_DEPTHS', 'ASTRAL_RIFT'];
const weakPoints: readonly CombatElement[] = ['FIRE', 'WATER', 'EARTH', 'WIND', 'LIGHT', 'DARK', 'METAL', 'CRYSTAL'];

const encounterCatalog: Readonly<Record<EndlessEncounterType, Omit<EndlessEncounterDefinition, 'outcomeRoll'>>> = {
  BATTLE: { label: 'Shard Ambush', description: '通常戦闘。安定したDepth Creditを得る。', rewardMultiplier: 1, powerMultiplier: 1, equipmentChance: 0.18, recoveryRatio: 0, risk: 0.12 },
  MINING: { label: 'Resonance Vein', description: '採掘力を試し、Creditと装備鉱石を回収する。', rewardMultiplier: 1.18, powerMultiplier: 0.62, equipmentChance: 0.34, recoveryRatio: 0, risk: 0.32 },
  TREASURE: { label: 'Sealed Geode', description: '罠を見切れば高密度の報酬を得る。', rewardMultiplier: 1.72, powerMultiplier: 0.38, equipmentChance: 0.78, recoveryRatio: 0, risk: 0.58 },
  ELITE: { label: 'Elite Formation', description: '強化個体との高リスク戦闘。', rewardMultiplier: 1.7, powerMultiplier: 1.12, equipmentChance: 0.58, recoveryRatio: 0, risk: 0.24 },
  REST: { label: 'Quiet Stratum', description: '安全な地層で共鳴を30%回復する。', rewardMultiplier: 0.28, powerMultiplier: 0, equipmentChance: 0, recoveryRatio: 0.3, risk: 0 },
  RANDOM_EVENT: { label: 'Unknown Signal', description: 'Seedで固定された未知現象を突破する。', rewardMultiplier: 1.42, powerMultiplier: 0.82, equipmentChance: 0.42, recoveryRatio: 0.08, risk: 0.85 },
  BOSS: { label: 'Depth Guardian', description: '10層ごとのGuardian戦。Checkpointを確保する。', rewardMultiplier: 4, powerMultiplier: 1.15, equipmentChance: 1, recoveryRatio: 0, risk: 0.3 },
};

type EnvironmentalRuleId = Extract<EndlessRuleId, 'LOW_GRAVITY' | 'STONE_DUST' | 'FRACTURED_GROUND' | 'RESONANT_AIR'>;

const ruleCatalog: Readonly<Record<EnvironmentalRuleId, EndlessFloorRule>> = {
  LOW_GRAVITY: { id: 'LOW_GRAVITY', label: 'Low Gravity', attackMultiplier: 1, defenseMultiplier: 1, speedMultiplier: 1.12, accuracyMultiplier: 1, breakMultiplier: 1 },
  STONE_DUST: { id: 'STONE_DUST', label: 'Stone Dust', attackMultiplier: 1.06, defenseMultiplier: 1, speedMultiplier: 1, accuracyMultiplier: 0.9, breakMultiplier: 1 },
  FRACTURED_GROUND: { id: 'FRACTURED_GROUND', label: 'Fractured Ground', attackMultiplier: 1, defenseMultiplier: 0.93, speedMultiplier: 1, accuracyMultiplier: 1, breakMultiplier: 1.2 },
  RESONANT_AIR: { id: 'RESONANT_AIR', label: 'Resonant Air', attackMultiplier: 1.1, defenseMultiplier: 1.06, speedMultiplier: 1, accuracyMultiplier: 1.05, breakMultiplier: 1 },
};

const bossRule: EndlessFloorRule = {
  id: 'BOSS_FLOOR',
  label: 'Guardian Domain',
  attackMultiplier: 1.12,
  defenseMultiplier: 1.14,
  speedMultiplier: 1.04,
  accuracyMultiplier: 1.06,
  breakMultiplier: 1.1,
};

const weeklyRules: readonly EndlessFloorRule[] = [
  { id: 'WEEKLY_OVERCHARGE', label: 'Weekly: Overcharge', attackMultiplier: 1.08, defenseMultiplier: 1, speedMultiplier: 1.04, accuracyMultiplier: 1, breakMultiplier: 1 },
  { id: 'WEEKLY_FORTUNE', label: 'Weekly: Fortune Vein', attackMultiplier: 1, defenseMultiplier: 1.03, speedMultiplier: 1, accuracyMultiplier: 1.03, breakMultiplier: 1.04 },
  { id: 'WEEKLY_FRACTURE', label: 'Weekly: Deep Fracture', attackMultiplier: 1.04, defenseMultiplier: 0.96, speedMultiplier: 1, accuracyMultiplier: 1, breakMultiplier: 1.12 },
];

const bounded = (value: number, max = MAX_ENDLESS_REWARD): number => {
  if (!Number.isFinite(value)) return value > 0 ? max : 0;
  return Math.max(0, Math.min(max, value));
};

const assertFloor = (floor: number, maxFloor = MAX_ENDLESS_FLOOR): number => {
  if (!Number.isSafeInteger(floor) || floor < 1 || floor > maxFloor) throw new RangeError(`floor must be an integer within 1..${maxFloor}`);
  return floor;
};

const normalizeConfig = (partial: EndlessConfigOverrides = {}): EndlessMineConfig => {
  const efficiency = { ...DEFAULT_ENDLESS_CONFIG.efficiency, ...partial.efficiency };
  const config: EndlessMineConfig = { ...DEFAULT_ENDLESS_CONFIG, ...partial, efficiency };
  if (!Number.isSafeInteger(config.maxFloor) || config.maxFloor < 1 || config.maxFloor > MAX_ENDLESS_FLOOR) throw new RangeError('maxFloor is invalid');
  if (!Number.isSafeInteger(config.checkpointInterval) || config.checkpointInterval < 1) throw new RangeError('checkpointInterval is invalid');
  if (!Number.isSafeInteger(config.battleMaxTurns) || config.battleMaxTurns < 1 || config.battleMaxTurns > 10_000) throw new RangeError('battleMaxTurns is invalid');
  for (const [mode, value] of Object.entries(config.efficiency)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${mode} efficiency must be within 0..1`);
  }
  if (!Number.isFinite(config.offlineFloorsPerHour) || config.offlineFloorsPerHour < 0) throw new RangeError('offlineFloorsPerHour is invalid');
  if (!Number.isFinite(config.maxOfflineHours) || config.maxOfflineHours < 0) throw new RangeError('maxOfflineHours is invalid');
  return config;
};

const validateRun = (run: Readonly<EndlessRunState>, maxFloor = MAX_ENDLESS_FLOOR): void => {
  if (!run.seed || !['ACTIVE', 'AUTO', 'OFFLINE'].includes(run.mode) || !['CLIMBING', 'DEFEATED', 'COMPLETE'].includes(run.status)) {
    throw new TypeError('Endless run identity is invalid');
  }
  for (const [field, value] of Object.entries({
    currentFloor: run.currentFloor,
    highestClearedFloor: run.highestClearedFloor,
    checkpointFloor: run.checkpointFloor,
    totalReward: run.totalReward,
    clearedBosses: run.clearedBosses,
    battles: run.battles,
    resonanceIntegrity: run.resonanceIntegrity,
  })) {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_ENDLESS_REWARD) throw new RangeError(`${field} is invalid`);
  }
  if (run.currentFloor < 1 || run.currentFloor > maxFloor) throw new RangeError('currentFloor is outside configured range');
  if (run.resonanceIntegrity > MAX_ENDLESS_INTEGRITY) throw new RangeError('resonanceIntegrity is invalid');
  if (run.lastDefeatFloor !== null && (!Number.isSafeInteger(run.lastDefeatFloor) || run.lastDefeatFloor < 1 || run.lastDefeatFloor > MAX_ENDLESS_FLOOR)) {
    throw new RangeError('lastDefeatFloor is invalid');
  }
};

const floorDifficulty = (floor: number): number => Math.round((1 + floor * 0.032 + Math.pow(floor, 1.18) * 0.0018) * 100_000) / 100_000;

const makeEnemy = (
  floor: number,
  index: number,
  difficulty: number,
  rules: readonly EndlessFloorRule[],
  isBoss: boolean,
  rng: RandomSource,
): CombatantTemplate => {
  const combined = rules.reduce(
    (value, rule) => ({
      attack: value.attack * rule.attackMultiplier,
      defense: value.defense * rule.defenseMultiplier,
      speed: value.speed * rule.speedMultiplier,
      accuracy: value.accuracy * rule.accuracyMultiplier,
      breakPower: value.breakPower * rule.breakMultiplier,
    }),
    { attack: 1, defense: 1, speed: 1, accuracy: 1, breakPower: 1 },
  );
  const bossScale = isBoss ? 2.25 : 1;
  const maxHp = Math.round(bounded((390 + floor * 22) * difficulty * bossScale, 1_000_000_000));
  const summon: CombatantTemplate = {
    id: 'echo',
    name: 'Guardian Echo',
    side: 'ENEMY',
    role: 'CONTROLLER',
    family: 'mine-echo',
    level: floor,
    stats: {
      maxHp: Math.round(maxHp * 0.18),
      attack: Math.round((34 + floor * 1.3) * difficulty),
      defense: Math.round((22 + floor) * difficulty),
      speed: 86 + Math.min(300, floor * 0.12),
      accuracy: 100 + Math.min(400, floor * 0.2),
      resistance: 80 + Math.min(400, floor * 0.18),
      critChance: 0.08,
      critDamage: 1.45,
      breakPower: 18,
    },
    skillIds: ['strike', 'stun'],
  };
  return {
    id: isBoss ? `floor-${floor}-guardian` : `floor-${floor}-enemy-${index}`,
    name: isBoss ? `Depth Guardian ${floor / 10}` : `Depth Shard ${index + 1}`,
    side: 'ENEMY',
    role: isBoss ? 'TANK' : index % 2 === 0 ? 'STRIKER' : 'CONTROLLER',
    family: isBoss ? 'depth-guardian' : `mine-${floor % 4}`,
    level: floor,
    stats: {
      maxHp,
      attack: Math.round(bounded((42 + floor * 1.7) * difficulty * combined.attack * (isBoss ? 1.15 : 1), 100_000_000)),
      defense: Math.round(bounded((30 + floor * 1.4) * difficulty * combined.defense * (isBoss ? 1.25 : 1), 100_000_000)),
      speed: bounded((82 + Math.min(420, floor * 0.14) + rng.int(-3, 3)) * combined.speed, 10_000),
      accuracy: bounded((100 + Math.min(500, floor * 0.24)) * combined.accuracy, 10_000),
      resistance: bounded(88 + Math.min(600, floor * 0.26) + (isBoss ? 40 : 0), 10_000),
      critChance: Math.min(0.45, 0.06 + floor * 0.00022),
      critDamage: Math.min(3, 1.45 + floor * 0.0005),
      breakPower: bounded((18 + Math.min(300, floor * 0.08)) * combined.breakPower, 10_000),
    },
    skillIds: isBoss ? ['strike', 'sweep', 'fracture', 'eclipse', 'nova'] : index % 2 === 0 ? ['strike', 'fracture'] : ['strike', 'stun', 'eclipse'],
    initialUltimate: isBoss ? 35 : 0,
    boss: isBoss
      ? {
          weakPoint: rng.pick(weakPoints),
          weakPointMultiplier: 1.65,
          breakThreshold: 140 + floor * 0.2,
          enrageTurn: 14,
          enrageMultiplier: 1.55,
          phases: [
            { id: 'fracture', hpRatio: 0.67, attackMultiplier: 1.12, speedMultiplier: 1.06, ultimateGain: 30 },
            { id: 'echoes', hpRatio: 0.34, defenseMultiplier: 1.18, weakPoint: rng.pick(weakPoints), summons: [summon], ultimateGain: 45 },
          ],
        }
      : undefined,
  };
};

type NonBossEncounterType = Exclude<EndlessEncounterType, 'BOSS'>;
const nonBossEncounterTypes: readonly NonBossEncounterType[] = ['BATTLE', 'MINING', 'TREASURE', 'ELITE', 'REST', 'RANDOM_EVENT'];
const nonBossEncounterWeights: Readonly<Record<NonBossEncounterType, number>> = { BATTLE: 44, MINING: 18, TREASURE: 9, ELITE: 12, REST: 9, RANDOM_EVENT: 8 };

export const isEndlessCombatEncounter = (floor: Pick<EndlessFloorDefinition, 'encounterType'>): boolean =>
  floor.encounterType === 'BATTLE' || floor.encounterType === 'ELITE' || floor.encounterType === 'BOSS';

export const generateEndlessFloor = (floor: number, seed = 'stoneverse-endless'): EndlessFloorDefinition => {
  assertFloor(floor);
  const rng = new SeededRng(`${seed}:floor:${floor}`);
  const isBossFloor = floor % 10 === 0;
  const encounterType: EndlessEncounterType = isBossFloor
    ? 'BOSS'
    : floor === 1
      ? 'BATTLE'
      : rng.weighted(nonBossEncounterTypes, (type) => nonBossEncounterWeights[type]);
  const difficulty = floorDifficulty(floor);
  const possibleRules = Object.values(ruleCatalog);
  const ruleCount = Math.min(2, Math.floor(floor / 75) + (floor >= 20 ? 1 : 0));
  const rules = rng.shuffle(possibleRules).slice(0, ruleCount).map((rule) => ({ ...rule }));
  const weeklyRule = new SeededRng(`${seed}:weekly-rule`).pick(weeklyRules);
  rules.push({ ...weeklyRule });
  if (isBossFloor) rules.push({ ...bossRule });
  const combat = encounterType === 'BATTLE' || encounterType === 'ELITE' || encounterType === 'BOSS';
  const regularCount = !combat ? 0 : isBossFloor ? Math.min(2, 1 + Math.floor(floor / 400)) : 1 + (Math.floor((floor - 1) / 25) % 3) + (encounterType === 'ELITE' ? 1 : 0);
  const enemyDifficulty = encounterType === 'ELITE' ? difficulty * 1.2 : difficulty;
  const enemies = Array.from({ length: regularCount }, (_, index) => makeEnemy(floor, index, enemyDifficulty, rules, false, rng));
  if (isBossFloor) enemies.unshift(makeEnemy(floor, 0, difficulty, rules, true, rng));
  const profile = encounterCatalog[encounterType];
  const encounter: EndlessEncounterDefinition = { ...profile, outcomeRoll: Math.round(rng.next() * 1_000_000) / 1_000_000 };
  return {
    floor,
    biome: biomes[Math.floor((floor - 1) / 25) % biomes.length] as EndlessBiome,
    encounterType,
    isBossFloor,
    difficulty,
    rules,
    enemies,
    encounter,
    baseReward: Math.round(bounded((40 + floor * 13 + Math.pow(floor, 1.25) * 1.8) * profile.rewardMultiplier)),
  };
};

export const calculateEndlessPartyPower = (party: readonly CombatantTemplate[]): number => party.reduce((sum, unit) => bounded(
  sum + unit.stats.maxHp * 0.08 + unit.stats.attack * 4 + unit.stats.defense * 2 + unit.stats.speed + unit.stats.breakPower * 2,
), 0);

/** Deterministic challenge shared by non-combat active floors and all offline floors. */
export const getEndlessFloorPowerRequirement = (floor: Readonly<EndlessFloorDefinition>): number => {
  if (floor.encounterType === 'REST') return 0;
  const base = floor.enemies.length
    ? floor.enemies.reduce((sum, enemy) => bounded(sum + enemy.stats.maxHp * 0.08 + enemy.stats.attack * 4 + enemy.stats.defense * 2), 0)
    : bounded((190 + floor.floor * 11.5) * floor.difficulty);
  const variance = 1 + floor.encounter.risk * (floor.encounter.outcomeRoll - 0.5);
  return Math.round(bounded(base * floor.encounter.powerMultiplier * variance));
};

/** Same definition + same effective power always produces the same result. */
export const resolveEndlessFloorByPower = (
  floor: Readonly<EndlessFloorDefinition>,
  effectivePartyPower: number,
): FloorResolution => {
  if (!Number.isFinite(effectivePartyPower) || effectivePartyPower < 0) throw new RangeError('Endless party power must be finite and non-negative');
  const cleared = floor.encounterType === 'REST' || effectivePartyPower >= getEndlessFloorPowerRequirement(floor);
  return {
    outcome: cleared ? 'PLAYER' : 'ENEMY',
    turns: 0,
    encounterType: floor.encounterType,
    recoveredRatio: cleared ? floor.encounter.recoveryRatio : 0,
  };
};

export const getEndlessIntegrityPowerMultiplier = (integrity: number): number => {
  if (!Number.isSafeInteger(integrity) || integrity < 0 || integrity > MAX_ENDLESS_INTEGRITY) throw new RangeError('Endless resonance integrity is invalid');
  return 0.75 + integrity / MAX_ENDLESS_INTEGRITY * 0.25;
};

/** Applies deterministic wear/recovery and returns the actual points restored. */
export const settleEndlessIntegrity = (
  run: EndlessRunState,
  floor: Readonly<EndlessFloorDefinition>,
  cleared: boolean,
): number => {
  const before = run.resonanceIntegrity;
  getEndlessIntegrityPowerMultiplier(before);
  const baseWear: Readonly<Record<EndlessEncounterType, number>> = {
    BATTLE: 3, MINING: 2, TREASURE: 3, ELITE: 7, REST: 0, RANDOM_EVENT: 5, BOSS: 10,
  };
  const wear = cleared
    ? Math.round(baseWear[floor.encounterType] * (0.75 + floor.encounter.outcomeRoll * 0.5))
    : Math.ceil(8 + floor.encounter.risk * 12);
  const afterWear = Math.max(0, before - wear);
  const recovery = cleared ? Math.round(floor.encounter.recoveryRatio * MAX_ENDLESS_INTEGRITY) : 0;
  run.resonanceIntegrity = Math.min(MAX_ENDLESS_INTEGRITY, afterWear + recovery);
  return run.resonanceIntegrity - afterWear;
};

export const createEndlessRun = (seed: string, mode: EndlessMode = 'ACTIVE'): EndlessRunState => {
  if (!seed) throw new TypeError('Endless run requires a seed');
  return {
    seed,
    mode,
    status: 'CLIMBING',
    currentFloor: 1,
    highestClearedFloor: 0,
    checkpointFloor: 0,
    lastDefeatFloor: null,
    totalReward: 0,
    clearedBosses: 0,
    battles: 0,
    resonanceIntegrity: MAX_ENDLESS_INTEGRITY,
  };
};

const defaultResolver = (
  playerStrategy: AiStrategy,
  enemyStrategy: AiStrategy,
): EndlessFloorResolver => (battle, _floor, rng) => {
  const playerProvider = createAutoCommandProvider(playerStrategy);
  const enemyProvider = createAutoCommandProvider(enemyStrategy);
  runAdvancedBattle(battle, (state, actorId, source) => {
    const actor = state.units.find((unit) => unit.id === actorId);
    return actor?.side === 'PLAYER' ? playerProvider(state, actorId, source) : enemyProvider(state, actorId, source);
  }, rng);
  return { outcome: battle.outcome ?? 'DRAW', turns: battle.turn };
};

export const advanceEndlessFloor = (
  run: EndlessRunState,
  party: readonly CombatantTemplate[],
  options: AdvanceFloorOptions = {},
): FloorResolution => {
  const config = normalizeConfig(options.config);
  validateRun(run, config.maxFloor);
  if (run.status !== 'CLIMBING') throw new RangeError('Run is not climbing');
  if (run.currentFloor > config.maxFloor) throw new RangeError('Run is past maxFloor');
  if (party.length === 0 || party.some((unit) => unit.side !== 'PLAYER')) throw new RangeError('Endless party must contain PLAYER combatants');
  const floor = generateEndlessFloor(assertFloor(run.currentFloor, config.maxFloor), run.seed);
  const rng = options.rng ?? new SeededRng(`${run.seed}:battle:${floor.floor}`);
  let resolution: FloorResolution;
  if (!isEndlessCombatEncounter(floor) && !options.resolveFloor) {
    resolution = resolveEndlessFloorByPower(floor, calculateEndlessPartyPower(party) * config.efficiency[run.mode] * getEndlessIntegrityPowerMultiplier(run.resonanceIntegrity));
  } else {
    const skills = { ...STANDARD_ADVANCED_SKILLS, ...options.skills };
    // A supplied resolver is an explicit simulation override and remains able
    // to inspect every floor. Non-combat overrides receive a deterministic
    // challenge proxy; production non-combat progression never creates it.
    const enemies = floor.enemies.length
      ? floor.enemies
      : [makeEnemy(floor.floor, 0, floor.difficulty * Math.max(0.25, floor.encounter.powerMultiplier), floor.rules, false, new SeededRng(`${run.seed}:proxy:${floor.floor}`))];
    const battle = createAdvancedBattle({ units: [...party, ...enemies], skills, maxTurns: config.battleMaxTurns });
    const resolver = options.resolveFloor ?? defaultResolver(options.playerStrategy ?? 'BALANCED', options.enemyStrategy ?? 'AGGRESSIVE');
    resolution = resolver(battle, floor, rng);
  }
  if (!['PLAYER', 'ENEMY', 'DRAW'].includes(resolution.outcome) || !Number.isSafeInteger(resolution.turns) || resolution.turns < 0) {
    throw new TypeError('Floor resolver returned an invalid result');
  }
  resolution = { ...resolution, encounterType: floor.encounterType, recoveredRatio: resolution.outcome === 'PLAYER' ? floor.encounter.recoveryRatio : 0 };
  run.battles += 1;
  settleEndlessIntegrity(run, floor, resolution.outcome === 'PLAYER');
  if (resolution.outcome === 'PLAYER') {
    const firstClear = floor.floor > run.highestClearedFloor;
    if (firstClear) {
      const efficiency = config.efficiency[run.mode];
      run.totalReward = Math.min(MAX_ENDLESS_REWARD, run.totalReward + Math.floor(floor.baseReward * efficiency));
      run.highestClearedFloor = floor.floor;
      if (floor.isBossFloor) run.clearedBosses += 1;
    }
    if (floor.floor % config.checkpointInterval === 0) run.checkpointFloor = floor.floor;
    if (floor.floor >= config.maxFloor) run.status = 'COMPLETE';
    else run.currentFloor = floor.floor + 1;
  } else {
    run.status = 'DEFEATED';
    run.lastDefeatFloor = floor.floor;
  }
  return resolution;
};

export const resumeEndlessFromCheckpoint = (run: EndlessRunState): EndlessRunState => {
  if (run.status !== 'DEFEATED') return run;
  run.currentFloor = Math.min(MAX_ENDLESS_FLOOR, Math.max(1, run.checkpointFloor + 1));
  run.resonanceIntegrity = Math.max(50, run.resonanceIntegrity);
  run.status = 'CLIMBING';
  return run;
};

export const autoClimb = (
  run: EndlessRunState,
  party: readonly CombatantTemplate[],
  options: AutoClimbOptions = {},
): EndlessRunState => {
  const config = normalizeConfig(options.config);
  validateRun(run, config.maxFloor);
  const maxBattles = options.maxBattles ?? Math.min(1_000, config.maxFloor - run.currentFloor + 1);
  if (!Number.isSafeInteger(maxBattles) || maxBattles < 0 || maxBattles > config.maxFloor) throw new RangeError('maxBattles is invalid');
  let attempts = 0;
  while (run.status === 'CLIMBING' && attempts < maxBattles) {
    advanceEndlessFloor(run, party, { ...options, config });
    attempts += 1;
  }
  return run;
};

export const simulateEndlessFloors = (
  fromFloor = 1,
  toFloor = 1_000,
  seed = 'stoneverse-endless',
): EndlessAggregateSimulation => {
  assertFloor(fromFloor);
  assertFloor(toFloor);
  if (toFloor < fromFloor) throw new RangeError('toFloor must not precede fromFloor');
  let bossFloors = 0;
  let enemies = 0;
  let totalBaseReward = 0;
  let maxDifficulty = 0;
  let finite = true;
  for (let floorNumber = fromFloor; floorNumber <= toFloor; floorNumber += 1) {
    const floor = generateEndlessFloor(floorNumber, seed);
    bossFloors += floor.isBossFloor ? 1 : 0;
    enemies += floor.enemies.length;
    totalBaseReward = Math.min(MAX_ENDLESS_REWARD, totalBaseReward + floor.baseReward);
    maxDifficulty = Math.max(maxDifficulty, floor.difficulty);
    finite = finite && [floor.difficulty, floor.baseReward, ...Object.values(floor.encounter).filter((value): value is number => typeof value === 'number'), ...floor.enemies.flatMap((enemy) => Object.values(enemy.stats))].every(Number.isFinite);
  }
  return { fromFloor, toFloor, floors: toFloor - fromFloor + 1, bossFloors, enemies, totalBaseReward, maxDifficulty, finite };
};

/** Aggregated offline estimate. The caller/server remains authoritative for awarded progress. */
export const simulateOfflineProgress = (
  run: Readonly<EndlessRunState>,
  elapsedHours: number,
  partyPower: number,
  partialConfig: EndlessConfigOverrides = {},
): OfflineProgressResult => {
  const config = normalizeConfig(partialConfig);
  validateRun(run, config.maxFloor);
  if (!Number.isFinite(elapsedHours) || elapsedHours < 0 || !Number.isFinite(partyPower) || partyPower < 0) {
    throw new RangeError('Offline hours and party power must be finite and non-negative');
  }
  const hours = Math.min(config.maxOfflineHours, elapsedHours);
  const floorBudget = Math.min(config.maxFloor - run.currentFloor + 1, Math.floor(hours * config.offlineFloorsPerHour));
  let attemptedFloors = 0;
  let clearedFloors = 0;
  let reward = 0;
  let floorNumber = run.currentFloor;
  let integrity = run.resonanceIntegrity;
  while (attemptedFloors < floorBudget && floorNumber <= config.maxFloor) {
    attemptedFloors += 1;
    const floor = generateEndlessFloor(floorNumber, run.seed);
    const resolution = resolveEndlessFloorByPower(floor, partyPower * config.efficiency.OFFLINE * getEndlessIntegrityPowerMultiplier(integrity));
    if (resolution.outcome !== 'PLAYER') break;
    const simulatedRun = { ...run, resonanceIntegrity: integrity };
    settleEndlessIntegrity(simulatedRun, floor, true);
    integrity = simulatedRun.resonanceIntegrity;
    reward = Math.min(MAX_ENDLESS_REWARD, reward + Math.floor(floor.baseReward * config.efficiency.OFFLINE));
    clearedFloors += 1;
    floorNumber += 1;
  }
  return { attemptedFloors, clearedFloors, reward, stoppedAtFloor: floorNumber };
};
