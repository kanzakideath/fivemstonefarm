import { CURRENT_SCHEMA_VERSION, createInitialGameState } from '../domain/state';
import { SPECIES_BY_ID } from '../data';
import { stableChecksum } from '../domain/rng';
import { calculateStoneStats, STAT_KEYS, validateStone } from '../domain/stone';
import { ELEMENTS, ORIGINS, RARITIES } from '../domain/types';
import type { BattleState, Clock, GameState, StoneInstance } from '../domain/types';
import { systemClock } from '../domain/rng';
import { createIdleState } from '../domain/idle';
import { createInitialEndlessCampaign, validateEndlessCampaignState } from '../domain/endlessCampaign';
import { createInitialMasteryState, validateMasteryState } from '../domain/mastery';
import { EXPEDITION_DURATIONS, EXPEDITION_REGIONS, MAX_EXPEDITION_DISCOVERY_STORAGE, MAX_EXPEDITION_REPORT_EVENTS, MAX_PENDING_RARE_DISCOVERIES } from '../domain/expedition';
import { EXPEDITION_STRATEGIES } from '../domain/types';
import { validateAdvancedBattleState } from '../domain/advanced';

export const SAVE_KEY = 'stoneverse.save.v5';
export const SAVE_BACKUP_KEY = 'stoneverse.save.v5.backup';
export const SAVE_TEMP_KEY = 'stoneverse.save.v5.pending';
export const LEGACY_SAVE_KEYS = ['stoneverse.save.v4', 'stoneverse.save.v4.pending', 'stoneverse.save.v4.backup', 'stoneverse.save.v3'] as const;

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveEnvelope {
  format: 'STONEVERSE_SAVE';
  schemaVersion: number;
  savedAt: string;
  checksum: string;
  state: GameState;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

export const browserStorage = (): StorageAdapter | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validationError = (path: string, expectation: string): never => {
  throw new Error(`Invalid save at ${path}: ${expectation}`);
};

const requireRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) return validationError(path, 'expected an object');
  return value as Record<string, unknown>;
};

const requireExactKeys = (value: Record<string, unknown>, allowed: readonly string[], path: string): void => {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unexpected !== undefined) validationError(`${path}.${unexpected}`, 'unexpected field');
};

const requireString = (value: unknown, path: string, options: { nullable?: boolean; min?: number; max?: number } = {}): string | null => {
  if (value === null && options.nullable) return null;
  if (typeof value !== 'string') return validationError(path, 'expected a string');
  const min = options.min ?? 0;
  const max = options.max ?? 10_000;
  if (value.length < min || value.length > max) return validationError(path, `expected length ${min}-${max}`);
  return value as string;
};

const requireBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') return validationError(path, 'expected a boolean');
  return value as boolean;
};

const requireNumber = (
  value: unknown,
  path: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return validationError(path, 'expected a finite number');
  if (options.integer && !Number.isSafeInteger(value)) return validationError(path, 'expected a safe integer');
  if (options.min !== undefined && value < options.min) return validationError(path, `expected >= ${options.min}`);
  if (options.max !== undefined && value > options.max) return validationError(path, `expected <= ${options.max}`);
  return value as number;
};

const requireEnum = <T extends string>(value: unknown, allowed: readonly T[], path: string): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) return validationError(path, `expected one of ${allowed.join(', ')}`);
  return value as T;
};

const requireArray = (value: unknown, path: string, max = 100_000): unknown[] => {
  if (!Array.isArray(value)) return validationError(path, 'expected an array');
  if (value.length > max) return validationError(path, `array exceeds ${max} entries`);
  return value as unknown[];
};

const requireIsoDate = (value: unknown, path: string, nullable = false): string | null => {
  if (value === null && nullable) return null;
  const text = requireString(value, path, { min: 1, max: 64 });
  if (text === null || !Number.isFinite(Date.parse(text))) validationError(path, 'expected a valid timestamp');
  return text;
};

const requireStringArray = (
  value: unknown,
  path: string,
  options: { max?: number; unique?: boolean } = {},
): string[] => {
  const entries = requireArray(value, path, options.max ?? 100_000).map((entry, index) => requireString(entry, `${path}[${index}]`, { min: 1, max: 256 }) as string);
  if (options.unique && new Set(entries).size !== entries.length) validationError(path, 'duplicate entries are not allowed');
  return entries;
};

const requireStats = (value: unknown, path: string, allowZero = false): void => {
  const stats = requireRecord(value, path);
  for (const key of [...STAT_KEYS, 'maxHp'] as const) requireNumber(stats[key], `${path}.${key}`, { min: allowZero ? 0 : 1, max: 1_000_000_000 });
};

const requireInventoryNumbers = (value: unknown, path: string): void => {
  const record = requireRecord(value, path);
  for (const [key, amount] of Object.entries(record)) {
    if (!key || key.length > 256) validationError(path, 'contains an invalid key');
    requireNumber(amount, `${path}.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  }
};

const requireEquipment = (value: unknown, path: string): void => {
  const equipment = requireRecord(value, path);
  requireString(equipment.instanceId, `${path}.instanceId`, { min: 1, max: 256 });
  requireString(equipment.definitionId, `${path}.definitionId`, { min: 1, max: 256 });
  requireEnum(equipment.slot, ['CORE', 'RUNE', 'RELIC', 'CHARM'] as const, `${path}.slot`);
  requireNumber(equipment.level, `${path}.level`, { min: 1, max: 10_000, integer: true });
  requireEnum(equipment.rarity, RARITIES, `${path}.rarity`);
  if (equipment.setId !== undefined && equipment.setId !== null) {
    requireEnum(equipment.setId, ['BASTION', 'RESONANCE', 'HUNTER', 'ABYSSAL'] as const, `${path}.setId`);
  }
  requireBoolean(equipment.locked, `${path}.locked`);
  requireArray(equipment.affixes, `${path}.affixes`, 32).forEach((affix, index) => {
    const entry = requireRecord(affix, `${path}.affixes[${index}]`);
    requireEnum(entry.stat, [...STAT_KEYS, 'maxHp'] as const, `${path}.affixes[${index}].stat`);
    requireEnum(entry.operation, ['FLAT', 'PERCENT'] as const, `${path}.affixes[${index}].operation`);
    requireNumber(entry.value, `${path}.affixes[${index}].value`, { min: -1_000_000, max: 1_000_000 });
    if (entry.sourceStat !== undefined) {
      requireEnum(entry.sourceStat, ['maxHp', 'attack', 'defense', 'speed', 'accuracy', 'resistance', 'critChance', 'critDamage', 'breakPower'] as const, `${path}.affixes[${index}].sourceStat`);
    }
  });
};

const requireOwner = (value: unknown, path: string): void => {
  const owner = requireRecord(value, path);
  requireString(owner.accountId, `${path}.accountId`, { min: 1, max: 128 });
  requireString(owner.username, `${path}.username`, { min: 1, max: 64 });
};

const requireLineage = (value: unknown, path: string): void => {
  const lineage = requireRecord(value, path);
  requireString(lineage.instanceId, `${path}.instanceId`, { min: 1, max: 256 });
  requireString(lineage.speciesId, `${path}.speciesId`, { min: 1, max: 256 });
  requireString(lineage.serialNumber, `${path}.serialNumber`, { min: 1, max: 256 });
  requireString(lineage.nickname, `${path}.nickname`, { nullable: true, max: 20 });
  requireEnum(lineage.mutation, ['NONE', 'PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'] as const, `${path}.mutation`);
  requireEnum(lineage.colorVariant, ['STANDARD', 'SHINY', 'AURORA', 'OBSIDIAN'] as const, `${path}.colorVariant`);
  requireStringArray(lineage.traitIds, `${path}.traitIds`, { max: 8, unique: true });
};

const requireStone = (value: unknown, mapKey: string, path: string): StoneInstance => {
  const stone = requireRecord(value, path);
  const instanceId = requireString(stone.instanceId, `${path}.instanceId`, { min: 1, max: 256 }) as string;
  if (instanceId !== mapKey) validationError(path, 'map key must equal instanceId');
  requireString(stone.serialNumber, `${path}.serialNumber`, { min: 1, max: 256 });
  requireString(stone.speciesId, `${path}.speciesId`, { min: 1, max: 256 });
  requireString(stone.name, `${path}.name`, { min: 1, max: 128 });
  requireString(stone.nickname, `${path}.nickname`, { nullable: true, max: 20 });
  requireEnum(stone.rarity, RARITIES, `${path}.rarity`);
  requireEnum(stone.origin, ORIGINS, `${path}.origin`);
  requireNumber(stone.level, `${path}.level`, { min: 1, max: 120, integer: true });
  requireNumber(stone.xp, `${path}.xp`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireNumber(stone.potential, `${path}.potential`, { min: 0, max: 100, integer: true });
  requireString(stone.personalityId, `${path}.personalityId`, { min: 1, max: 256 });
  requireEnum(stone.primaryElement, ELEMENTS, `${path}.primaryElement`);
  if (stone.secondaryElement !== null) requireEnum(stone.secondaryElement, ELEMENTS, `${path}.secondaryElement`);
  requireStats(stone.stats, `${path}.stats`);
  const ivs = requireRecord(stone.individualValues, `${path}.individualValues`);
  for (const key of STAT_KEYS) requireNumber(ivs[key], `${path}.individualValues.${key}`, { min: 0, max: 31, integer: true });
  requireStringArray(stone.traitIds, `${path}.traitIds`, { max: 8, unique: true });
  requireArray(stone.skills, `${path}.skills`, 6).forEach((skill, index) => {
    const entry = requireRecord(skill, `${path}.skills[${index}]`);
    requireString(entry.skillId, `${path}.skills[${index}].skillId`, { min: 1, max: 256 });
    requireNumber(entry.level, `${path}.skills[${index}].level`, { min: 1, max: 100, integer: true });
    requireEnum(entry.source, ['NATURAL', 'LEVEL', 'AWAKENING', 'FUSION', 'EQUIPMENT', 'TREE'] as const, `${path}.skills[${index}].source`);
  });
  requireNumber(stone.skillPoints, `${path}.skillPoints`, { min: 0, max: 1_000_000, integer: true });
  requireStringArray(stone.learnedSkillNodes, `${path}.learnedSkillNodes`, { max: 1_000, unique: true });
  const equipment = requireRecord(stone.equipment, `${path}.equipment`);
  for (const [slot, item] of Object.entries(equipment)) {
    requireEnum(slot, ['CORE', 'RUNE', 'RELIC', 'CHARM'] as const, `${path}.equipment slot`);
    requireEquipment(item, `${path}.equipment.${slot}`);
    if ((item as Record<string, unknown>).slot !== slot) validationError(`${path}.equipment.${slot}`, 'equipment slot mismatch');
  }
  const affinity = requireRecord(stone.affinity, `${path}.affinity`);
  requireNumber(affinity.points, `${path}.affinity.points`, { min: 0, max: 9_999, integer: true });
  requireNumber(affinity.rank, `${path}.affinity.rank`, { min: 0, max: 7, integer: true });
  requireArray(affinity.claimedMilestones, `${path}.affinity.claimedMilestones`, 32).forEach((entry, index) => requireNumber(entry, `${path}.affinity.claimedMilestones[${index}]`, { min: 0, max: 100, integer: true }));
  requireNumber(stone.awakeningStage, `${path}.awakeningStage`, { min: 0, max: 10, integer: true });
  requireNumber(stone.evolutionStage, `${path}.evolutionStage`, { min: 0, max: 100, integer: true });
  requireNumber(stone.reincarnationCount, `${path}.reincarnationCount`, { min: 0, max: 1_000, integer: true });
  requireNumber(stone.limitBreak, `${path}.limitBreak`, { min: 0, max: 5, integer: true });
  requireEnum(stone.mutation, ['NONE', 'PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'] as const, `${path}.mutation`);
  requireEnum(stone.colorVariant, ['STANDARD', 'SHINY', 'AURORA', 'OBSIDIAN'] as const, `${path}.colorVariant`);
  requireArray(stone.parents, `${path}.parents`, 4).forEach((entry, index) => requireLineage(entry, `${path}.parents[${index}]`));
  requireArray(stone.grandparents, `${path}.grandparents`, 8).forEach((entry, index) => requireLineage(entry, `${path}.grandparents[${index}]`));
  requireNumber(stone.generation, `${path}.generation`, { min: 0, max: 100_000, integer: true });
  requireOwner(stone.originalOwner, `${path}.originalOwner`);
  requireOwner(stone.currentOwner, `${path}.currentOwner`);
  requireOwner(stone.discoverer, `${path}.discoverer`);
  requireIsoDate(stone.createdAt, `${path}.createdAt`);
  requireIsoDate(stone.firstObtainedAt, `${path}.firstObtainedAt`);
  requireIsoDate(stone.appraisedAt, `${path}.appraisedAt`, true);
  const battle = requireRecord(stone.battleStatistics, `${path}.battleStatistics`);
  for (const key of ['battles', 'wins', 'losses', 'damageDealt', 'damageTaken', 'healingDone', 'criticalHits', 'enemiesDefeated', 'ultimatesUsed']) {
    requireNumber(battle[key], `${path}.battleStatistics.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  }
  requireBoolean(stone.favorite, `${path}.favorite`);
  requireBoolean(stone.locked, `${path}.locked`);
  requireStringArray(stone.tags, `${path}.tags`, { max: 100, unique: true });
  const typed = stone as unknown as StoneInstance;
  const issues = validateStone(typed);
  if (issues.length > 0) validationError(path, issues.join(', '));
  return typed;
};

const requireReward = (value: unknown, path: string): void => {
  const reward = requireRecord(value, path);
  if (reward.currencies !== undefined) requireInventoryNumbers(reward.currencies, `${path}.currencies`);
  if (reward.items !== undefined) requireInventoryNumbers(reward.items, `${path}.items`);
  for (const key of ['accountXp', 'miningXp', 'stoneXp']) if (reward[key] !== undefined) requireNumber(reward[key], `${path}.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
};

const requirePartialStats = (value: unknown, path: string): void => {
  const stats = requireRecord(value, path);
  for (const [key, amount] of Object.entries(stats)) {
    requireEnum(key, [...STAT_KEYS, 'maxHp'] as const, `${path} key`);
    requireNumber(amount, `${path}.${key}`, { min: -1_000_000_000, max: 1_000_000_000 });
  }
};

const requireExpeditionDiscovery = (value: unknown, path: string): string => {
  const discovery = requireRecord(value, path);
  const id = requireString(discovery.discoveryId, `${path}.discoveryId`, { min: 1, max: 256 }) as string;
  requireString(discovery.seed, `${path}.seed`, { min: 1, max: 1_024 });
  const speciesId = requireString(discovery.speciesId, `${path}.speciesId`, { min: 1, max: 256 }) as string;
  if (!SPECIES_BY_ID[speciesId]) validationError(`${path}.speciesId`, 'references an unknown species');
  requireString(discovery.veinId, `${path}.veinId`, { min: 1, max: 256 });
  requireString(discovery.areaId, `${path}.areaId`, { min: 1, max: 256 });
  requireEnum(discovery.hintedRarity, RARITIES, `${path}.hintedRarity`);
  requireString(discovery.sourceEventId, `${path}.sourceEventId`, { min: 1, max: 256 });
  requireIsoDate(discovery.discoveredAt, `${path}.discoveredAt`);
  return id;
};

const requireExpeditionReward = (value: unknown, path: string): void => {
  const reward = requireRecord(value, path);
  for (const key of ['credits', 'upgradeDust', 'researchCores', 'accountXp', 'stoneXpPerMember', 'affinityPerMember']) {
    requireNumber(reward[key], `${path}.${key}`, { min: 0, max: 1_000_000_000, integer: true });
  }
  requireInventoryNumbers(reward.items, `${path}.items`);
  const ids = new Set<string>();
  requireArray(reward.rareDiscoveries, `${path}.rareDiscoveries`, MAX_PENDING_RARE_DISCOVERIES).forEach((entry, index) => {
    const id = requireExpeditionDiscovery(entry, `${path}.rareDiscoveries[${index}]`);
    if (ids.has(id)) validationError(`${path}.rareDiscoveries[${index}].discoveryId`, 'duplicate discovery ID');
    ids.add(id);
  });
};

const requireExpeditionReport = (value: unknown, path: string, expeditionId: string): void => {
  const report = requireRecord(value, path);
  requireString(report.reportId, `${path}.reportId`, { min: 1, max: 512 });
  if (requireString(report.expeditionId, `${path}.expeditionId`, { min: 1, max: 256 }) !== expeditionId) validationError(`${path}.expeditionId`, 'does not match its expedition');
  requireNumber(report.cycle, `${path}.cycle`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireIsoDate(report.completedAt, `${path}.completedAt`);
  requireNumber(report.offsetMs, `${path}.offsetMs`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireEnum(report.kind, ['DEPARTURE', 'BATTLE', 'MINING', 'MATERIAL', 'EQUIPMENT', 'DISCOVERY', 'EVENT', 'BOSS', 'RETURN'] as const, `${path}.kind`);
  requireString(report.title, `${path}.title`, { min: 1, max: 256 });
  requireString(report.detail, `${path}.detail`, { max: 2_048 });
  requireNumber(report.successScore, `${path}.successScore`, { min: 0, max: 1_000 });
  if (report.battleWon !== null) requireBoolean(report.battleWon, `${path}.battleWon`);
  requireNumber(report.miningYield, `${path}.miningYield`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireString(report.equipmentDropId, `${path}.equipmentDropId`, { nullable: true, max: 256 });
  requireString(report.equipmentDropSeed, `${path}.equipmentDropSeed`, { nullable: true, max: 1_024 });
  if (report.bestDropRarity !== null) requireEnum(report.bestDropRarity, RARITIES, `${path}.bestDropRarity`);
  requireNumber(report.rareDiscoveryCount, `${path}.rareDiscoveryCount`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  const reward = requireRecord(report.reward, `${path}.reward`);
  for (const key of ['credits', 'upgradeDust', 'researchCores', 'accountXp', 'stoneXpPerMember', 'affinityPerMember']) requireNumber(reward[key], `${path}.reward.${key}`, { min: 0, max: 1_000_000_000, integer: true });
  requireInventoryNumbers(reward.items, `${path}.reward.items`);
};

const requireBattle = (
  value: unknown,
  path: string,
  stoneIds: ReadonlySet<string>,
  options: { active: boolean },
): BattleState => {
  const battle = requireRecord(value, path);
  requireString(battle.battleId, `${path}.battleId`, { min: 1, max: 256 });
  requireEnum(battle.mode, ['DUNGEON', 'INFINITE_MINE', 'PVP', 'RAID', 'SIMULATION'] as const, `${path}.mode`);
  if (battle.dungeonId !== undefined) requireString(battle.dungeonId, `${path}.dungeonId`, { min: 1, max: 256 });
  if (battle.stageId !== undefined) requireString(battle.stageId, `${path}.stageId`, { min: 1, max: 256 });
  const battleTurn = requireNumber(battle.turn, `${path}.turn`, { min: 0, max: 100, integer: true });
  const units = requireArray(battle.units, `${path}.units`, 32);
  if (units.length === 0) validationError(`${path}.units`, 'battle must contain units');
  const unitIds = new Set<string>();
  let hasPlayer = false;
  let hasEnemy = false;
  let hasLivingPlayer = false;
  let hasLivingEnemy = false;
  units.forEach((valueUnit, index) => {
    const unitPath = `${path}.units[${index}]`;
    const unit = requireRecord(valueUnit, unitPath);
    const unitId = requireString(unit.unitId, `${unitPath}.unitId`, { min: 1, max: 256 }) as string;
    if (unitIds.has(unitId)) validationError(`${unitPath}.unitId`, 'duplicate unitId');
    unitIds.add(unitId);
    const stoneId = requireString(unit.stoneId, `${unitPath}.stoneId`, { min: 1, max: 256 }) as string;
    const team = requireEnum(unit.team, ['PLAYER', 'ENEMY'] as const, `${unitPath}.team`);
    hasPlayer ||= team === 'PLAYER';
    hasEnemy ||= team === 'ENEMY';
    if (options.active && team === 'PLAYER' && !stoneIds.has(stoneId)) validationError(`${unitPath}.stoneId`, 'active player unit references a missing stone');
    requireString(unit.speciesId, `${unitPath}.speciesId`, { min: 1, max: 256 });
    requireString(unit.name, `${unitPath}.name`, { min: 1, max: 128 });
    requireEnum(unit.element, ELEMENTS, `${unitPath}.element`);
    requireEnum(unit.role, ['ATTACK', 'TANK', 'SUPPORT', 'CONTROL'] as const, `${unitPath}.role`);
    requireNumber(unit.level, `${unitPath}.level`, { min: 1, max: 120, integer: true });
    requireStats(unit.stats, `${unitPath}.stats`);
    const maximumHp = requireNumber((unit.stats as Record<string, unknown>).maxHp, `${unitPath}.stats.maxHp`, { min: 1, max: 1_000_000_000 });
    const currentHp = requireNumber(unit.currentHp, `${unitPath}.currentHp`, { min: 0, max: maximumHp });
    requireNumber(unit.shield, `${unitPath}.shield`, { min: 0, max: 1_000_000_000 });
    requireNumber(unit.ultimate, `${unitPath}.ultimate`, { min: 0, max: 100 });
    requireInventoryNumbers(unit.cooldowns, `${unitPath}.cooldowns`);
    requireStringArray(unit.skillIds, `${unitPath}.skillIds`, { max: 6, unique: true });
    requireStringArray(unit.traitIds, `${unitPath}.traitIds`, { max: 8, unique: true });
    const alive = requireBoolean(unit.alive, `${unitPath}.alive`);
    if (alive !== (currentHp > 0)) validationError(`${unitPath}.alive`, 'must agree with currentHp');
    hasLivingPlayer ||= team === 'PLAYER' && alive;
    hasLivingEnemy ||= team === 'ENEMY' && alive;
    requireArray(unit.statuses, `${unitPath}.statuses`, 32).forEach((statusValue, statusIndex) => {
      const status = requireRecord(statusValue, `${unitPath}.statuses[${statusIndex}]`);
      requireEnum(status.id, ['BURN', 'POISON', 'STUN', 'FRACTURE', 'REGEN', 'TAUNT'] as const, `${unitPath}.statuses[${statusIndex}].id`);
      requireNumber(status.turns, `${unitPath}.statuses[${statusIndex}].turns`, { min: 1, max: 100, integer: true });
      requireNumber(status.potency, `${unitPath}.statuses[${statusIndex}].potency`, { min: 0, max: 10 });
      requireString(status.sourceId, `${unitPath}.statuses[${statusIndex}].sourceId`, { min: 1, max: 256 });
    });
    requireArray(unit.modifiers, `${unitPath}.modifiers`, 64).forEach((modifierValue, modifierIndex) => {
      const modifier = requireRecord(modifierValue, `${unitPath}.modifiers[${modifierIndex}]`);
      requireEnum(modifier.stat, [...STAT_KEYS, 'maxHp'] as const, `${unitPath}.modifiers[${modifierIndex}].stat`);
      requireNumber(modifier.multiplier, `${unitPath}.modifiers[${modifierIndex}].multiplier`, { min: 0.01, max: 100 });
      requireNumber(modifier.turns, `${unitPath}.modifiers[${modifierIndex}].turns`, { min: 1, max: 100, integer: true });
      requireString(modifier.sourceId, `${unitPath}.modifiers[${modifierIndex}].sourceId`, { min: 1, max: 256 });
    });
  });
  if (!hasPlayer || !hasEnemy) validationError(`${path}.units`, 'battle requires both player and enemy teams');
  requireArray(battle.actionLog, `${path}.actionLog`, 100_000).forEach((actionValue, index) => {
    const actionPath = `${path}.actionLog[${index}]`;
    const action = requireRecord(actionValue, actionPath);
    requireNumber(action.turn, `${actionPath}.turn`, { min: 1, max: 100, integer: true });
    const actorId = requireString(action.actorId, `${actionPath}.actorId`, { min: 1, max: 256 }) as string;
    if (!unitIds.has(actorId)) validationError(`${actionPath}.actorId`, 'references an unknown unit');
    requireString(action.skillId, `${actionPath}.skillId`, { min: 1, max: 256 });
    for (const targetId of requireStringArray(action.targetIds, `${actionPath}.targetIds`, { max: 32 })) if (!unitIds.has(targetId)) validationError(`${actionPath}.targetIds`, 'references an unknown unit');
    requireNumber(action.damage, `${actionPath}.damage`, { min: 0, max: Number.MAX_SAFE_INTEGER });
    requireNumber(action.healing, `${actionPath}.healing`, { min: 0, max: Number.MAX_SAFE_INTEGER });
    requireBoolean(action.critical, `${actionPath}.critical`);
    requireStringArray(action.statusesApplied, `${actionPath}.statusesApplied`, { max: 32 });
    for (const defeatedId of requireStringArray(action.defeatedIds, `${actionPath}.defeatedIds`, { max: 32 })) if (!unitIds.has(defeatedId)) validationError(`${actionPath}.defeatedIds`, 'references an unknown unit');
    for (const detailKey of ['damageByTarget', 'healingByTarget']) {
      if (action[detailKey] === undefined) continue;
      const detail = requireRecord(action[detailKey], `${actionPath}.${detailKey}`);
      for (const [targetId, amount] of Object.entries(detail)) {
        if (!unitIds.has(targetId)) validationError(`${actionPath}.${detailKey}`, 'references an unknown unit');
        requireNumber(amount, `${actionPath}.${detailKey}.${targetId}`, { min: 0, max: Number.MAX_SAFE_INTEGER });
      }
    }
  });
  if (battle.winner !== null) requireEnum(battle.winner, ['PLAYER', 'ENEMY', 'DRAW'] as const, `${path}.winner`);
  if (battle.reward !== null) requireReward(battle.reward, `${path}.reward`);
  if (battle.advanced !== undefined) {
    const advanced = validateAdvancedBattleState(battle.advanced);
    if (advanced.turn !== battleTurn) validationError(`${path}.advanced.turn`, 'must match projected battle turn');
    if (advanced.outcome !== battle.winner) validationError(`${path}.advanced.outcome`, 'must match projected battle winner');
    for (const advancedUnit of advanced.units) if (!unitIds.has(advancedUnit.id)) validationError(`${path}.advanced.units`, 'contains an unprojected combatant');
  }
  if (battle.controlMode !== undefined) requireEnum(battle.controlMode, ['MANUAL', 'AUTO'] as const, `${path}.controlMode`);
  if (battle.speed !== undefined) {
    const speed = requireNumber(battle.speed, `${path}.speed`, { integer: true });
    if (![1, 2, 4].includes(speed)) validationError(`${path}.speed`, 'expected one of 1, 2, 4');
  }
  requireIsoDate(battle.startedAt, `${path}.startedAt`);
  if (battle.winner === null) {
    if (battle.finishedAt !== null) validationError(`${path}.finishedAt`, 'unfinished battle must not have a finish timestamp');
    if (!hasLivingPlayer || !hasLivingEnemy) validationError(`${path}.winner`, 'unfinished battle must have living units on both teams');
  } else {
    requireIsoDate(battle.finishedAt, `${path}.finishedAt`);
    if (battle.winner === 'PLAYER' && (!hasLivingPlayer || hasLivingEnemy)) validationError(`${path}.winner`, 'PLAYER result disagrees with living teams');
    if (battle.winner === 'ENEMY' && (!hasLivingEnemy || hasLivingPlayer)) validationError(`${path}.winner`, 'ENEMY result disagrees with living teams');
    if (battle.winner === 'DRAW' && hasLivingPlayer && hasLivingEnemy && battleTurn < 100) validationError(`${path}.winner`, 'living-team DRAW requires the turn limit');
  }
  if (!options.active && battle.winner === null) validationError(`${path}.winner`, 'battle history cannot contain an unfinished battle');
  return battle as unknown as BattleState;
};

const mergeDefaults = (raw: Record<string, unknown>): GameState => {
  const accountRaw = isRecord(raw.account) ? raw.account : {};
  const base = createInitialGameState({
    username: typeof accountRaw.username === 'string' ? accountRaw.username : undefined,
    accountId: typeof accountRaw.accountId === 'string' ? accountRaw.accountId : undefined,
    withStarter: false,
    seed: 'migration-defaults',
  });
  const nested = <T extends object>(defaults: T, value: unknown): T => ({ ...defaults, ...(isRecord(value) ? value : {}) });
  const state = {
    ...base,
    ...raw,
    account: nested(base.account, raw.account),
    accountProgress: nested(base.accountProgress, raw.accountProgress),
    mining: nested(base.mining, raw.mining),
    facilities: nested(base.facilities, raw.facilities),
    expeditions: nested(base.expeditions, raw.expeditions),
    training: nested(base.training, raw.training),
    affinityGarden: nested(base.affinityGarden, raw.affinityGarden),
    research: nested(base.research, raw.research),
    idle: {
      ...base.idle,
      ...(isRecord(raw.idle) ? raw.idle : {}),
      timeCheckpoint: nested(base.idle.timeCheckpoint, isRecord(raw.idle) ? raw.idle.timeCheckpoint : undefined),
      scheduler: nested(base.idle.scheduler, isRecord(raw.idle) ? raw.idle.scheduler : undefined),
    },
    endlessMine: raw.endlessMine === undefined ? base.endlessMine : raw.endlessMine,
    mastery: raw.mastery === undefined ? base.mastery : raw.mastery,
    inventory: {
      ...base.inventory,
      ...(isRecord(raw.inventory) ? raw.inventory : {}),
      currencies: nested(base.inventory.currencies, isRecord(raw.inventory) ? raw.inventory.currencies : undefined),
      items: nested(base.inventory.items, isRecord(raw.inventory) ? raw.inventory.items : undefined),
      equipment: nested(base.inventory.equipment, isRecord(raw.inventory) ? raw.inventory.equipment : undefined),
    },
    collection: nested(base.collection, raw.collection),
    gacha: nested(base.gacha, raw.gacha),
    profile: nested(base.profile, raw.profile),
    statistics: nested(base.statistics, raw.statistics),
    online: nested(base.online, raw.online),
    settings: nested(base.settings, raw.settings),
  } as unknown as GameState;
  return state;
};

/** Runtime trust boundary for both imported and locally persisted GameState. */
export const validateAndNormalizeGameState = (value: unknown): GameState => {
  const state = requireRecord(value, 'state');
  requireNumber(state.schemaVersion, 'state.schemaVersion', { min: CURRENT_SCHEMA_VERSION, max: CURRENT_SCHEMA_VERSION, integer: true });
  requireNumber(state.revision, 'state.revision', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });

  const account = requireRecord(state.account, 'state.account');
  const accountId = requireString(account.accountId, 'state.account.accountId', { min: 1, max: 128 }) as string;
  requireString(account.username, 'state.account.username', { min: 1, max: 24 });
  requireString(account.avatarId, 'state.account.avatarId', { min: 1, max: 256 });
  requireString(account.profileFrameId, 'state.account.profileFrameId', { min: 1, max: 256 });
  requireString(account.equippedTitleId, 'state.account.equippedTitleId', { min: 1, max: 256 });
  requireStringArray(account.ownedTitleIds, 'state.account.ownedTitleIds', { max: 10_000, unique: true });
  requireStringArray(account.ownedFrameIds, 'state.account.ownedFrameIds', { max: 10_000, unique: true });
  requireNumber(account.arenaRating, 'state.account.arenaRating', { min: 0, max: 1_000_000, integer: true });
  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'LEGEND'] as const;
  requireEnum(account.arenaTier, tiers, 'state.account.arenaTier');
  requireEnum(account.highestArenaTier, tiers, 'state.account.highestArenaTier');
  const raidStats = requireRecord(account.raidStats, 'state.account.raidStats');
  requireNumber(raidStats.lifetimeDamage, 'state.account.raidStats.lifetimeDamage', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireNumber(raidStats.bossesDefeated, 'state.account.raidStats.bossesDefeated', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  if (raidStats.bestContributionRank !== null) requireNumber(raidStats.bestContributionRank, 'state.account.raidStats.bestContributionRank', { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireIsoDate(account.createdAt, 'state.account.createdAt');
  requireIsoDate(account.lastOnlineAt, 'state.account.lastOnlineAt');

  const accountProgress = requireRecord(state.accountProgress, 'state.accountProgress');
  requireNumber(accountProgress.level, 'state.accountProgress.level', { min: 1, max: 100, integer: true });
  requireNumber(accountProgress.xp, 'state.accountProgress.xp', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireNumber(accountProgress.researchPoints, 'state.accountProgress.researchPoints', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireNumber(accountProgress.skillPoints, 'state.accountProgress.skillPoints', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireStringArray(accountProgress.selectedSkillNodes, 'state.accountProgress.selectedSkillNodes', { max: 10_000, unique: true });

  const mining = requireRecord(state.mining, 'state.mining');
  requireNumber(mining.level, 'state.mining.level', { min: 1, max: 100, integer: true });
  requireNumber(mining.xp, 'state.mining.xp', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  for (const key of ['totalMined', 'dailyMined', 'weeklyMined', 'monthlyMined']) requireNumber(mining[key], `state.mining.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireStringArray(mining.unlockedAreas, 'state.mining.unlockedAreas', { max: 10_000, unique: true });
  requireStringArray(mining.unlockedVeins, 'state.mining.unlockedVeins', { max: 10_000, unique: true });
  const farmLedger = requireRecord(mining.processedFarmEventIds, 'state.mining.processedFarmEventIds');
  for (const [eventId, marker] of Object.entries(farmLedger)) {
    if (!eventId || eventId.length > 128 || marker !== true) validationError(`state.mining.processedFarmEventIds.${eventId}`, 'expected an exact event ID mapped to true');
  }
  requireIsoDate(mining.lastMinedAt, 'state.mining.lastMinedAt', true);

  const facilities = requireRecord(state.facilities, 'state.facilities');
  for (const key of ['fusionLab', 'researchLab', 'expeditionGuild']) requireNumber(facilities[key], `state.facilities.${key}`, { min: 1, max: 100, integer: true });

  const stonesRecord = requireRecord(state.stones, 'state.stones');
  const stoneIds = new Set<string>();
  for (const [stoneId, stone] of Object.entries(stonesRecord)) {
    if (stoneIds.has(stoneId)) validationError(`state.stones.${stoneId}`, 'duplicate stone ID');
    stoneIds.add(stoneId);
    requireStone(stone, stoneId, `state.stones.${stoneId}`);
  }

  const endlessMine = validateEndlessCampaignState(state.endlessMine);
  for (const stoneId of endlessMine.partyStoneIds) if (!stoneIds.has(stoneId)) validationError('state.endlessMine.partyStoneIds', 'references a missing stone');
  const mastery = validateMasteryState(state.mastery);
  for (const stoneId of Object.keys(mastery.stones)) if (!stoneIds.has(stoneId)) validationError('state.mastery.stones', 'references a missing stone');

  const expeditionState = requireRecord(state.expeditions, 'state.expeditions');
  const expeditionRuns = requireRecord(expeditionState.runs, 'state.expeditions.runs');
  if (Object.keys(expeditionRuns).length > 100) validationError('state.expeditions.runs', 'exceeds 100 retained runs');
  const expeditionOrder = requireStringArray(expeditionState.order, 'state.expeditions.order', { max: 100, unique: true });
  const durationById = new Map(EXPEDITION_DURATIONS.map((entry) => [entry.id, entry]));
  const regionIds = new Set(EXPEDITION_REGIONS.map((entry) => entry.id));
  const activeExpeditionStones = new Set<string>();
  const expeditionPartyReferences: string[] = [];
  for (const [expeditionId, runValue] of Object.entries(expeditionRuns)) {
    const path = `state.expeditions.runs.${expeditionId}`;
    const run = requireRecord(runValue, path);
    if (requireString(run.expeditionId, `${path}.expeditionId`, { min: 1, max: 256 }) !== expeditionId) validationError(`${path}.expeditionId`, 'map key must equal expeditionId');
    const regionId = requireString(run.regionId, `${path}.regionId`, { min: 1, max: 256 }) as string;
    if (!regionIds.has(regionId)) validationError(`${path}.regionId`, 'references an unknown region');
    const durationId = requireString(run.durationId, `${path}.durationId`, { min: 1, max: 256 }) as string;
    const duration = durationById.get(durationId);
    if (!duration) validationError(`${path}.durationId`, 'references an unknown duration');
    const durationMs = requireNumber(run.durationMs, `${path}.durationMs`, { min: 1, max: 24 * 60 * 60 * 1_000, integer: true });
    if (durationMs !== duration?.durationMs) validationError(`${path}.durationMs`, 'does not match duration configuration');
    requireEnum(run.strategy, EXPEDITION_STRATEGIES, `${path}.strategy`);
    const partyId = requireString(run.partyId, `${path}.partyId`, { min: 1, max: 256 }) as string;
    expeditionPartyReferences.push(partyId);
    const status = requireEnum(run.status, ['ACTIVE', 'READY', 'CLAIMED'] as const, `${path}.status`);
    const partySnapshot = requireArray(run.partySnapshot, `${path}.partySnapshot`, 3);
    if (partySnapshot.length === 0) validationError(`${path}.partySnapshot`, 'must contain at least one stone');
    const snapshotIds = new Set<string>();
    partySnapshot.forEach((memberValue, index) => {
      const memberPath = `${path}.partySnapshot[${index}]`;
      const member = requireRecord(memberValue, memberPath);
      const stoneId = requireString(member.stoneId, `${memberPath}.stoneId`, { min: 1, max: 256 }) as string;
      if (snapshotIds.has(stoneId)) validationError(`${memberPath}.stoneId`, 'duplicate party snapshot stone');
      snapshotIds.add(stoneId);
      if (status !== 'CLAIMED' && !stoneIds.has(stoneId)) validationError(`${memberPath}.stoneId`, 'active expedition references a missing stone');
      if (status !== 'CLAIMED') {
        if (activeExpeditionStones.has(stoneId)) validationError(`${memberPath}.stoneId`, 'stone is assigned to multiple expeditions');
        activeExpeditionStones.add(stoneId);
      }
      const speciesId = requireString(member.speciesId, `${memberPath}.speciesId`, { min: 1, max: 256 }) as string;
      if (!SPECIES_BY_ID[speciesId]) validationError(`${memberPath}.speciesId`, 'references an unknown species');
      requireNumber(member.level, `${memberPath}.level`, { min: 1, max: 120, integer: true });
      requireEnum(member.rarity, RARITIES, `${memberPath}.rarity`);
      requireEnum(member.primaryElement, ELEMENTS, `${memberPath}.primaryElement`);
      if (member.secondaryElement !== null) requireEnum(member.secondaryElement, ELEMENTS, `${memberPath}.secondaryElement`);
      requireStats(member.stats, `${memberPath}.stats`);
      const ivs = requireRecord(member.individualValues, `${memberPath}.individualValues`);
      for (const key of STAT_KEYS) requireNumber(ivs[key], `${memberPath}.individualValues.${key}`, { min: 0, max: 31, integer: true });
      requireStringArray(member.skillIds, `${memberPath}.skillIds`, { max: 6, unique: true });
      requireStringArray(member.traitIds, `${memberPath}.traitIds`, { max: 8, unique: true });
      requireArray(member.equipment, `${memberPath}.equipment`, 4).forEach((equipment, equipmentIndex) => requireEquipment(equipment, `${memberPath}.equipment[${equipmentIndex}]`));
      requirePartialStats(member.equipmentBonuses, `${memberPath}.equipmentBonuses`);
      requireEnum(member.mutation, ['NONE', 'PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'] as const, `${memberPath}.mutation`);
      requireNumber(member.generation, `${memberPath}.generation`, { min: 0, max: 100_000, integer: true });
      requireArray(member.lineage, `${memberPath}.lineage`, 8).forEach((entry, lineageIndex) => requireLineage(entry, `${memberPath}.lineage[${lineageIndex}]`));
      requireNumber(member.power, `${memberPath}.power`, { min: 1, max: 1_000_000_000, integer: true });
      requireNumber(member.affinityRank, `${memberPath}.affinityRank`, { min: 0, max: 7, integer: true });
    });
    requireString(run.seed, `${path}.seed`, { min: 1, max: 1_024 });
    const repeat = requireBoolean(run.repeat, `${path}.repeat`);
    requireIsoDate(run.startedAt, `${path}.startedAt`);
    requireIsoDate(run.lastSimulatedAt, `${path}.lastSimulatedAt`);
    requireIsoDate(run.nextCompletionAt, `${path}.nextCompletionAt`);
    const completedCycles = requireNumber(run.completedCycles, `${path}.completedCycles`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
    const claimedCycles = requireNumber(run.claimedCycles, `${path}.claimedCycles`, { min: 0, max: completedCycles, integer: true });
    requireNumber(run.claimCount, `${path}.claimCount`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
    // A repeating expedition that received a return order keeps its completed
    // history while `repeat` becomes false for the final in-flight cycle.
    if (status === 'READY' && (repeat || completedCycles <= claimedCycles)) validationError(`${path}.status`, 'READY requires an unclaimed non-repeating completion');
    if (status === 'CLAIMED' && (repeat || completedCycles !== claimedCycles)) validationError(`${path}.status`, 'CLAIMED must be a fully claimed non-repeating expedition');
    requireExpeditionReward(run.expeditionStorage, `${path}.expeditionStorage`);
    const reportIds = new Set<string>();
    requireArray(run.reportEvents, `${path}.reportEvents`, MAX_EXPEDITION_REPORT_EVENTS).forEach((report, index) => {
      requireExpeditionReport(report, `${path}.reportEvents[${index}]`, expeditionId);
      const reportId = (report as Record<string, unknown>).reportId as string;
      if (reportIds.has(reportId)) validationError(`${path}.reportEvents[${index}].reportId`, 'duplicate report ID');
      reportIds.add(reportId);
    });
    const summary = requireRecord(run.reportSummary, `${path}.reportSummary`);
    for (const key of ['battles', 'wins', 'miningYield', 'rareDiscoveries', 'equipmentDrops']) requireNumber(summary[key], `${path}.reportSummary.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
    if ((summary.wins as number) > (summary.battles as number)) validationError(`${path}.reportSummary.wins`, 'cannot exceed battles');
    if (summary.bestDropRarity !== null) requireEnum(summary.bestDropRarity, RARITIES, `${path}.reportSummary.bestDropRarity`);
    requireIsoDate(run.lastClaimedAt, `${path}.lastClaimedAt`, true);
    if (claimedCycles > 0 && run.lastClaimedAt === null) validationError(`${path}.lastClaimedAt`, 'claimed cycles require a claim timestamp');
  }
  for (const expeditionId of expeditionOrder) if (!Object.prototype.hasOwnProperty.call(expeditionRuns, expeditionId)) validationError('state.expeditions.order', 'references a missing expedition');
  const storedDiscoveryIds = new Set<string>();
  requireArray(expeditionState.discoveryStorage, 'state.expeditions.discoveryStorage', MAX_EXPEDITION_DISCOVERY_STORAGE).forEach((entry, index) => {
    const id = requireExpeditionDiscovery(entry, `state.expeditions.discoveryStorage[${index}]`);
    if (storedDiscoveryIds.has(id)) validationError(`state.expeditions.discoveryStorage[${index}].discoveryId`, 'duplicate stored discovery');
    storedDiscoveryIds.add(id);
  });
  for (const key of ['overflowDiscarded', 'totalCycles', 'totalClaims']) requireNumber(expeditionState[key], `state.expeditions.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });

  const training = requireRecord(state.training, 'state.training');
  if (training.assignment !== null) {
    const assignment = requireRecord(training.assignment, 'state.training.assignment');
    const stoneId = requireString(assignment.stoneId, 'state.training.assignment.stoneId', { min: 1, max: 256 }) as string;
    if (!stoneIds.has(stoneId)) validationError('state.training.assignment.stoneId', 'references a missing stone');
    if (activeExpeditionStones.has(stoneId)) validationError('state.training.assignment.stoneId', 'stone is also assigned to an expedition');
    requireIsoDate(assignment.assignedAt, 'state.training.assignment.assignedAt');
    requireIsoDate(assignment.lastProcessedAt, 'state.training.assignment.lastProcessedAt');
    requireNumber(assignment.xpPerHour, 'state.training.assignment.xpPerHour', { min: 1, max: 10_000, integer: true });
    requireNumber(assignment.bankedMs, 'state.training.assignment.bankedMs', { min: 0, max: 30 * 24 * 60 * 60 * 1_000, integer: true });
    requireNumber(assignment.totalClaimedXp, 'state.training.assignment.totalClaimedXp', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  }

  const garden = requireRecord(state.affinityGarden, 'state.affinityGarden');
  if (garden.assignment !== null) {
    const assignment = requireRecord(garden.assignment, 'state.affinityGarden.assignment');
    const stoneId = requireString(assignment.stoneId, 'state.affinityGarden.assignment.stoneId', { min: 1, max: 256 }) as string;
    if (!stoneIds.has(stoneId)) validationError('state.affinityGarden.assignment.stoneId', 'references a missing stone');
    if (activeExpeditionStones.has(stoneId) || (training.assignment !== null && (training.assignment as Record<string, unknown>).stoneId === stoneId)) validationError('state.affinityGarden.assignment.stoneId', 'stone has another background assignment');
    requireIsoDate(assignment.assignedAt, 'state.affinityGarden.assignment.assignedAt');
    requireIsoDate(assignment.lastProcessedAt, 'state.affinityGarden.assignment.lastProcessedAt');
    requireNumber(assignment.affinityPerHour, 'state.affinityGarden.assignment.affinityPerHour', { min: 1, max: 100, integer: true });
    requireNumber(assignment.bankedMs, 'state.affinityGarden.assignment.bankedMs', { min: 0, max: 30 * 24 * 60 * 60 * 1_000, integer: true });
    requireNumber(assignment.totalClaimedAffinity, 'state.affinityGarden.assignment.totalClaimedAffinity', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  }

  const research = requireRecord(state.research, 'state.research');
  const researchIds = ['GEOLOGY_SURVEY', 'GENETIC_ARCHIVE', 'EXPEDITION_LOGISTICS'] as const;
  if (research.slot !== null) {
    const slot = requireRecord(research.slot, 'state.research.slot');
    requireString(slot.researchId, 'state.research.slot.researchId', { min: 1, max: 256 });
    requireEnum(slot.projectId, researchIds, 'state.research.slot.projectId');
    requireString(slot.seed, 'state.research.slot.seed', { min: 1, max: 1_024 });
    requireIsoDate(slot.startedAt, 'state.research.slot.startedAt');
    requireIsoDate(slot.completesAt, 'state.research.slot.completesAt');
    const status = requireEnum(slot.status, ['ACTIVE', 'READY', 'CLAIMED'] as const, 'state.research.slot.status');
    requireIsoDate(slot.claimedAt, 'state.research.slot.claimedAt', true);
    if ((status === 'CLAIMED') !== (slot.claimedAt !== null)) validationError('state.research.slot.claimedAt', 'must agree with research status');
  }
  requireArray(research.completedProjectIds, 'state.research.completedProjectIds', researchIds.length).forEach((entry, index) => requireEnum(entry, researchIds, `state.research.completedProjectIds[${index}]`));
  const claimLedger = requireRecord(research.claimLedger, 'state.research.claimLedger');
  for (const [researchId, marker] of Object.entries(claimLedger)) if (!researchId || researchId.length > 256 || marker !== true) validationError(`state.research.claimLedger.${researchId}`, 'expected an exact research ID mapped to true');

  const idle = requireRecord(state.idle, 'state.idle');
  const checkpoint = requireRecord(idle.timeCheckpoint, 'state.idle.timeCheckpoint');
  requireNumber(checkpoint.version, 'state.idle.timeCheckpoint.version', { min: 1, max: 1, integer: true });
  const trustedNowMs = requireNumber(checkpoint.trustedNowMs, 'state.idle.timeCheckpoint.trustedNowMs', { min: 0, max: 8_640_000_000_000_000, integer: true });
  const wallHighWaterMs = requireNumber(checkpoint.wallHighWaterMs, 'state.idle.timeCheckpoint.wallHighWaterMs', { min: 0, max: 8_640_000_000_000_000, integer: true });
  if (trustedNowMs > wallHighWaterMs) validationError('state.idle.timeCheckpoint', 'trusted time cannot exceed wall high-water');
  requireNumber(checkpoint.reconciliationCount, 'state.idle.timeCheckpoint.reconciliationCount', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  const scheduler = requireRecord(idle.scheduler, 'state.idle.scheduler');
  requireNumber(scheduler.version, 'state.idle.scheduler.version', { min: 1, max: 1, integer: true });
  const schedulerIds = new Set<string>();
  requireArray(scheduler.jobs, 'state.idle.scheduler.jobs', 256).forEach((jobValue, index) => {
    const jobPath = `state.idle.scheduler.jobs[${index}]`;
    const job = requireRecord(jobValue, jobPath);
    const id = requireString(job.id, `${jobPath}.id`, { min: 1, max: 512 }) as string;
    if (schedulerIds.has(id)) validationError(`${jobPath}.id`, 'duplicate scheduler job');
    schedulerIds.add(id);
    const dueAtMs = requireNumber(job.dueAtMs, `${jobPath}.dueAtMs`, { min: 0, max: 8_640_000_000_000_000, integer: true });
    const repeatEveryMs = job.repeatEveryMs === undefined
      ? undefined
      : requireNumber(job.repeatEveryMs, `${jobPath}.repeatEveryMs`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
    const endAtMs = job.endAtMs === undefined
      ? undefined
      : requireNumber(job.endAtMs, `${jobPath}.endAtMs`, { min: 0, max: 8_640_000_000_000_000, integer: true });
    if (endAtMs !== undefined && repeatEveryMs === undefined) validationError(`${jobPath}.endAtMs`, 'requires repeatEveryMs');
    if (endAtMs !== undefined && endAtMs < dueAtMs) validationError(`${jobPath}.endAtMs`, 'cannot precede dueAtMs');
    if (job.sequence !== undefined) requireNumber(job.sequence, `${jobPath}.sequence`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
    const payload = requireRecord(job.payload, `${jobPath}.payload`);
    const kind = requireEnum(payload.kind, ['EXPEDITION', 'TRAINING', 'AFFINITY_GARDEN', 'RESEARCH', 'ENDLESS_MINE'] as const, `${jobPath}.payload.kind`);
    if (kind === 'EXPEDITION') {
      requireExactKeys(payload, ['kind', 'expeditionId'], `${jobPath}.payload`);
      requireString(payload.expeditionId, `${jobPath}.payload.expeditionId`, { min: 1, max: 256 });
    } else if (kind === 'RESEARCH') {
      requireExactKeys(payload, ['kind', 'researchId'], `${jobPath}.payload`);
      requireString(payload.researchId, `${jobPath}.payload.researchId`, { min: 1, max: 256 });
    } else if (kind === 'ENDLESS_MINE') {
      requireExactKeys(payload, ['kind', 'runId'], `${jobPath}.payload`);
      requireString(payload.runId, `${jobPath}.payload.runId`, { min: 1, max: 512 });
    } else {
      requireExactKeys(payload, ['kind', 'stoneId'], `${jobPath}.payload`);
      requireString(payload.stoneId, `${jobPath}.payload.stoneId`, { min: 1, max: 256 });
    }
  });
  requireIsoDate(idle.lastProcessedAt, 'state.idle.lastProcessedAt');
  requireIsoDate(idle.lastActiveAt, 'state.idle.lastActiveAt');
  if (idle.lastWelcomeBack !== null) {
    const summary = requireRecord(idle.lastWelcomeBack, 'state.idle.lastWelcomeBack');
    requireString(summary.summaryId, 'state.idle.lastWelcomeBack.summaryId', { min: 1, max: 512 });
    requireIsoDate(summary.from, 'state.idle.lastWelcomeBack.from');
    requireIsoDate(summary.to, 'state.idle.lastWelcomeBack.to');
    for (const key of ['elapsedMs', 'expeditionCycles', 'trainingXpReady', 'affinityReady', 'endlessFloors', 'endlessCredits', 'equipmentAdded', 'equipmentSalvaged', 'rareDiscoveries']) requireNumber(summary[key], `state.idle.lastWelcomeBack.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
    requireBoolean(summary.capped, 'state.idle.lastWelcomeBack.capped');
    requireBoolean(summary.rollbackDetected, 'state.idle.lastWelcomeBack.rollbackDetected');
    requireBoolean(summary.researchReady, 'state.idle.lastWelcomeBack.researchReady');
    requireIsoDate(summary.createdAt, 'state.idle.lastWelcomeBack.createdAt');
  }

  const inventory = requireRecord(state.inventory, 'state.inventory');
  const currencies = requireRecord(inventory.currencies, 'state.inventory.currencies');
  for (const key of ['credits', 'gachaTickets', 'researchCores', 'upgradeDust']) requireNumber(currencies[key], `state.inventory.currencies.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  for (const [key, amount] of Object.entries(currencies)) requireNumber(amount, `state.inventory.currencies.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireInventoryNumbers(inventory.items, 'state.inventory.items');
  const inventoryEquipment = requireRecord(inventory.equipment, 'state.inventory.equipment');
  for (const [instanceId, equipment] of Object.entries(inventoryEquipment)) {
    requireEquipment(equipment, `state.inventory.equipment.${instanceId}`);
    if ((equipment as Record<string, unknown>).instanceId !== instanceId) validationError(`state.inventory.equipment.${instanceId}`, 'map key must equal instanceId');
  }
  requireNumber(inventory.capacity, 'state.inventory.capacity', { min: stoneIds.size, max: 1_000_000, integer: true });

  const discoveries = requireArray(state.unappraisedFinds, 'state.unappraisedFinds', 100_000);
  const discoveryIds = new Set<string>();
  discoveries.forEach((valueDiscovery, index) => {
    const path = `state.unappraisedFinds[${index}]`;
    const discovery = requireRecord(valueDiscovery, path);
    const id = requireString(discovery.discoveryId, `${path}.discoveryId`, { min: 1, max: 256 }) as string;
    if (discoveryIds.has(id)) validationError(`${path}.discoveryId`, 'duplicate discovery ID');
    discoveryIds.add(id);
    requireString(discovery.seed, `${path}.seed`, { min: 1, max: 1_024 });
    requireString(discovery.veinId, `${path}.veinId`, { min: 1, max: 256 });
    requireString(discovery.areaId, `${path}.areaId`, { min: 1, max: 256 });
    requireIsoDate(discovery.discoveredAt, `${path}.discoveredAt`);
    requireEnum(discovery.hintedRarity, RARITIES, `${path}.hintedRarity`);
    const sourceEventId = requireString(discovery.sourceEventId, `${path}.sourceEventId`, { min: 1, max: 128 }) as string;
    if (!Object.prototype.hasOwnProperty.call(farmLedger, sourceEventId)) validationError(`${path}.sourceEventId`, 'does not exist in the Farm event ledger');
  });

  const collection = requireRecord(state.collection, 'state.collection');
  requireStringArray(collection.discoveredSpeciesIds, 'state.collection.discoveredSpeciesIds', { max: 100_000, unique: true });
  const mutationSpecies = requireRecord(collection.mutationSpecies, 'state.collection.mutationSpecies');
  for (const [speciesId, mutations] of Object.entries(mutationSpecies)) requireArray(mutations, `state.collection.mutationSpecies.${speciesId}`, 5).forEach((mutation, index) => requireEnum(mutation, ['NONE', 'PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'] as const, `state.collection.mutationSpecies.${speciesId}[${index}]`));
  const variantSpecies = requireRecord(collection.variantSpecies, 'state.collection.variantSpecies');
  for (const [speciesId, variants] of Object.entries(variantSpecies)) requireArray(variants, `state.collection.variantSpecies.${speciesId}`, 4).forEach((variant, index) => requireEnum(variant, ['STANDARD', 'SHINY', 'AURORA', 'OBSIDIAN'] as const, `state.collection.variantSpecies.${speciesId}[${index}]`));
  requireInventoryNumbers(collection.origins, 'state.collection.origins');

  requireArray(state.fusionHistory, 'state.fusionHistory', 100_000).forEach((valueHistory, index) => {
    const path = `state.fusionHistory[${index}]`;
    const history = requireRecord(valueHistory, path);
    requireString(history.id, `${path}.id`, { min: 1, max: 256 });
    const parentIds = requireStringArray(history.parentIds, `${path}.parentIds`, { max: 4, unique: true });
    if (parentIds.length < 2) validationError(`${path}.parentIds`, 'fusion requires at least two parents');
    // Historical stones may later be consumed; the immutable ID remains valid provenance.
    requireString(history.childId, `${path}.childId`, { min: 1, max: 256 });
    requireString(history.recipeId, `${path}.recipeId`, { nullable: true, max: 256 });
    requireStringArray(history.catalystIds, `${path}.catalystIds`, { max: 16, unique: true });
    requireStringArray(history.inheritedTraits, `${path}.inheritedTraits`, { max: 8, unique: true });
    requireStringArray(history.inheritedSkills, `${path}.inheritedSkills`, { max: 6, unique: true });
    requireEnum(history.mutation, ['NONE', 'PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'] as const, `${path}.mutation`);
    requireBoolean(history.consumeParents, `${path}.consumeParents`);
    requireIsoDate(history.createdAt, `${path}.createdAt`);
  });

  const gacha = requireRecord(state.gacha, 'state.gacha');
  const pityByBanner = requireRecord(gacha.pityByBanner, 'state.gacha.pityByBanner');
  for (const [bannerId, valuePity] of Object.entries(pityByBanner)) {
    const pity = requireRecord(valuePity, `state.gacha.pityByBanner.${bannerId}`);
    requireNumber(pity.pullsSinceSsr, `state.gacha.pityByBanner.${bannerId}.pullsSinceSsr`, { min: 0, max: 1_000_000, integer: true });
    requireNumber(pity.lifetimePulls, `state.gacha.pityByBanner.${bannerId}.lifetimePulls`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
    requireBoolean(pity.featuredGuaranteed, `state.gacha.pityByBanner.${bannerId}.featuredGuaranteed`);
  }
  requireArray(gacha.history, 'state.gacha.history', 1_000).forEach((valueHistory, index) => {
    const path = `state.gacha.history[${index}]`;
    const history = requireRecord(valueHistory, path);
    requireString(history.id, `${path}.id`, { min: 1, max: 256 });
    requireString(history.bannerId, `${path}.bannerId`, { min: 1, max: 256 });
    // Gacha history outlives a stone that is later consumed in fusion.
    requireString(history.stoneId, `${path}.stoneId`, { min: 1, max: 256 });
    requireEnum(history.rarity, RARITIES, `${path}.rarity`);
    requireNumber(history.pullNumber, `${path}.pullNumber`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
    requireNumber(history.pityBefore, `${path}.pityBefore`, { min: 0, max: 1_000_000, integer: true });
    requireBoolean(history.guaranteed, `${path}.guaranteed`);
    requireIsoDate(history.createdAt, `${path}.createdAt`);
  });
  const rarityCounts = requireRecord(gacha.rarityCounts, 'state.gacha.rarityCounts');
  for (const [rarity, count] of Object.entries(rarityCounts)) {
    requireEnum(rarity, RARITIES, `state.gacha.rarityCounts key ${rarity}`);
    requireNumber(count, `state.gacha.rarityCounts.${rarity}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  }

  const achievements = requireRecord(state.achievements, 'state.achievements');
  for (const [achievementId, valueProgress] of Object.entries(achievements)) {
    const progress = requireRecord(valueProgress, `state.achievements.${achievementId}`);
    requireNumber(progress.value, `state.achievements.${achievementId}.value`, { min: 0, max: Number.MAX_SAFE_INTEGER });
    requireIsoDate(progress.unlockedAt, `state.achievements.${achievementId}.unlockedAt`, true);
    requireIsoDate(progress.claimedAt, `state.achievements.${achievementId}.claimedAt`, true);
    if (progress.claimedAt !== null && progress.unlockedAt === null) validationError(`state.achievements.${achievementId}`, 'claimed achievement must be unlocked');
  }

  const parties = requireArray(state.parties, 'state.parties', 100);
  if (parties.length === 0) validationError('state.parties', 'at least one party is required');
  const partyIds = new Set<string>();
  parties.forEach((valueParty, index) => {
    const path = `state.parties[${index}]`;
    const party = requireRecord(valueParty, path);
    const partyId = requireString(party.id, `${path}.id`, { min: 1, max: 256 }) as string;
    if (partyIds.has(partyId)) validationError(`${path}.id`, 'duplicate party ID');
    partyIds.add(partyId);
    requireString(party.name, `${path}.name`, { min: 1, max: 64 });
    requireBoolean(party.defense, `${path}.defense`);
    const partyStoneIds = new Set<string>();
    requireArray(party.slots, `${path}.slots`, 3).forEach((slotValue, slotIndex) => {
      const slot = requireRecord(slotValue, `${path}.slots[${slotIndex}]`);
      const stoneId = requireString(slot.stoneId, `${path}.slots[${slotIndex}].stoneId`, { min: 1, max: 256 }) as string;
      if (!stoneIds.has(stoneId)) validationError(`${path}.slots[${slotIndex}].stoneId`, 'references a missing stone');
      if (partyStoneIds.has(stoneId)) validationError(`${path}.slots`, 'contains a duplicate stone');
      partyStoneIds.add(stoneId);
      requireEnum(slot.position, ['FRONT', 'BACK', 'SUPPORT'] as const, `${path}.slots[${slotIndex}].position`);
    });
  });
  const activePartyId = requireString(state.activePartyId, 'state.activePartyId', { min: 1, max: 256 }) as string;
  if (!partyIds.has(activePartyId)) validationError('state.activePartyId', 'references a missing party');

  const activeBattle = state.activeBattle === null ? null : requireBattle(state.activeBattle, 'state.activeBattle', stoneIds, { active: true });
  const battleIds = new Set<string>();
  requireArray(state.battleHistory, 'state.battleHistory', 100).forEach((battleValue, index) => {
    const battle = requireBattle(battleValue, `state.battleHistory[${index}]`, stoneIds, { active: false });
    if (battleIds.has(battle.battleId)) validationError(`state.battleHistory[${index}].battleId`, 'duplicate battle ID');
    battleIds.add(battle.battleId);
  });
  void activeBattle;

  const dungeonClears = requireRecord(state.dungeonClears, 'state.dungeonClears');
  for (const [stageId, valueClear] of Object.entries(dungeonClears)) {
    const clear = requireRecord(valueClear, `state.dungeonClears.${stageId}`);
    requireNumber(clear.bestTurns, `state.dungeonClears.${stageId}.bestTurns`, { min: 1, max: 100, integer: true });
    requireNumber(clear.clearCount, `state.dungeonClears.${stageId}.clearCount`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
    requireIsoDate(clear.firstClearedAt, `state.dungeonClears.${stageId}.firstClearedAt`);
  }

  const profile = requireRecord(state.profile, 'state.profile');
  for (const stoneId of requireStringArray(profile.showcaseStoneIds, 'state.profile.showcaseStoneIds', { max: 6, unique: true })) if (!stoneIds.has(stoneId)) validationError('state.profile.showcaseStoneIds', 'references a missing stone');
  for (const stoneId of requireStringArray(profile.favoriteStoneIds, 'state.profile.favoriteStoneIds', { max: 12, unique: true })) if (!stoneIds.has(stoneId)) validationError('state.profile.favoriteStoneIds', 'references a missing stone');
  requireNumber(profile.totalAffinity, 'state.profile.totalAffinity', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  requireBoolean(profile.public, 'state.profile.public');

  const statistics = requireRecord(state.statistics, 'state.statistics');
  for (const key of ['fusionCount', 'mutationCount', 'rareDiscoveryCount', 'battleWins', 'battleLosses', 'highestInfiniteFloor', 'totalRaidDamage']) requireNumber(statistics[key], `state.statistics.${key}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });

  const online = requireRecord(state.online, 'state.online');
  requireBoolean(online.connected, 'state.online.connected');
  requireString(online.sessionId, 'state.online.sessionId', { min: 1, max: 256 });
  const onlineSequence = requireNumber(online.sequence, 'state.online.sequence', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
  const queuedIds = new Set<string>();
  requireArray(online.queue, 'state.online.queue', 100_000).forEach((eventValue, index) => {
    const path = `state.online.queue[${index}]`;
    const event = requireRecord(eventValue, path);
    const eventId = requireString(event.eventId, `${path}.eventId`, { min: 1, max: 256 }) as string;
    if (queuedIds.has(eventId)) validationError(`${path}.eventId`, 'duplicate queued event');
    queuedIds.add(eventId);
    requireString(event.sessionId, `${path}.sessionId`, { min: 1, max: 256 });
    const sequence = requireNumber(event.sequence, `${path}.sequence`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
    if (sequence > onlineSequence) validationError(`${path}.sequence`, 'exceeds online sequence');
    requireIsoDate(event.timestamp, `${path}.timestamp`);
    const eventAccountId = requireString(event.accountId, `${path}.accountId`, { min: 1, max: 128 });
    if (eventAccountId !== accountId) validationError(`${path}.accountId`, 'does not match account');
    requireEnum(event.kind, ['MINING_RECORDED', 'STONE_CREATED', 'STONE_EVOLVED', 'STONE_FUSED', 'BATTLE_FINISHED', 'ACHIEVEMENT_UNLOCKED', 'PROFILE_UPDATED', 'RANK_REQUESTED'] as const, `${path}.kind`);
    // JSON.parse already removes functions/prototypes; require a serialisable JSON payload shape.
    if (event.payload === undefined) validationError(`${path}.payload`, 'payload is required');
    requireNumber(event.attempts, `${path}.attempts`, { min: 0, max: 1_000, integer: true });
    requireIsoDate(event.nextAttemptAt, `${path}.nextAttemptAt`);
  });
  const receiptIds = new Set<string>();
  requireArray(online.processedReceipts, 'state.online.processedReceipts', 2_000).forEach((receiptValue, index) => {
    const path = `state.online.processedReceipts[${index}]`;
    const receipt = requireRecord(receiptValue, path);
    const eventId = requireString(receipt.eventId, `${path}.eventId`, { min: 1, max: 256 }) as string;
    if (receiptIds.has(eventId)) validationError(`${path}.eventId`, 'duplicate receipt');
    if (queuedIds.has(eventId)) validationError(`${path}.eventId`, 'event cannot be both queued and acknowledged');
    receiptIds.add(eventId);
    requireIsoDate(receipt.processedAt, `${path}.processedAt`);
    requireString(receipt.checksum, `${path}.checksum`, { min: 1, max: 256 });
  });
  requireIsoDate(online.lastSyncedAt, 'state.online.lastSyncedAt', true);

  const settings = requireRecord(state.settings, 'state.settings');
  requireEnum(settings.effectQuality, ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const, 'state.settings.effectQuality');
  requireBoolean(settings.reduceMotion, 'state.settings.reduceMotion');
  requireBoolean(settings.mute, 'state.settings.mute');
  requireNumber(settings.masterVolume, 'state.settings.masterVolume', { min: 0, max: 1 });
  requireNumber(settings.musicVolume, 'state.settings.musicVolume', { min: 0, max: 1 });
  requireNumber(settings.effectsVolume, 'state.settings.effectsVolume', { min: 0, max: 1 });
  requireNumber(settings.textScale, 'state.settings.textScale', { min: 0.8, max: 1.5 });
  requireBoolean(settings.developerMode, 'state.settings.developerMode');
  requireIsoDate(state.createdAt, 'state.createdAt');
  requireIsoDate(state.updatedAt, 'state.updatedAt');

  const typed = state as unknown as GameState;
  // Stats are derived, so validated finite input is normalized to catalog truth.
  for (const stone of Object.values(typed.stones)) stone.stats = calculateStoneStats(stone);
  return typed;
};

const migrateStateInternal = (rawValue: unknown, allowCurrentEnvelope: boolean): GameState => {
  if (!isRecord(rawValue)) throw new Error('Save state must be an object');
  if (typeof rawValue.schemaVersion !== 'number') throw new Error('Legacy raw saves require an explicit schemaVersion');
  const sourceVersion = rawValue.schemaVersion;
  if (!Number.isSafeInteger(sourceVersion) || sourceVersion < 1) throw new Error('Save schemaVersion must be a positive integer');
  if (sourceVersion > CURRENT_SCHEMA_VERSION) throw new Error(`Save schema ${sourceVersion} is newer than this client`);
  if (sourceVersion === CURRENT_SCHEMA_VERSION && !allowCurrentEnvelope) throw new Error(`Raw schema ${CURRENT_SCHEMA_VERSION} saves are not accepted; a checksummed STONEVERSE_SAVE envelope is required`);
  if (sourceVersion === 4 && !allowCurrentEnvelope) throw new Error('Raw schema 4 saves are not accepted; the checksummed v4 STONEVERSE_SAVE envelope is required');
  const raw = { ...rawValue };
  if (sourceVersion < 2) {
    raw.facilities ??= { fusionLab: 1, researchLab: 1, expeditionGuild: 1 };
    raw.statistics ??= { fusionCount: 0, mutationCount: 0, rareDiscoveryCount: 0, battleWins: 0, battleLosses: 0, highestInfiniteFloor: 0, totalRaidDamage: 0 };
    raw.online ??= { connected: true, sessionId: 'migrated_session', sequence: 0, queue: [], processedReceipts: [], lastSyncedAt: null };
  }
  if (sourceVersion < 3) {
    raw.activeBattle ??= null;
    raw.dungeonClears ??= {};
    raw.unappraisedFinds ??= [];
  }
  if (sourceVersion < 4) {
    const mining = isRecord(raw.mining) ? { ...raw.mining } : {};
    const online = isRecord(raw.online) ? raw.online : {};
    const receipts = Array.isArray(online.processedReceipts) ? online.processedReceipts : [];
    const ledger: Record<string, true> = {};
    // v3 wrote locally processed Farm IDs into processedReceipts. Online acknowledgements
    // generated by this client use the reserved sync_ prefix and are intentionally excluded.
    for (const candidate of receipts) {
      if (!isRecord(candidate) || typeof candidate.eventId !== 'string' || candidate.eventId.startsWith('sync_')) continue;
      Object.defineProperty(ledger, candidate.eventId, { value: true, enumerable: true, configurable: true, writable: true });
    }
    mining.processedFarmEventIds = ledger;
    raw.mining = mining;
  }
  if (sourceVersion < 5) {
    const timestampCandidates = [raw.updatedAt, isRecord(raw.account) ? raw.account.lastOnlineAt : undefined, raw.createdAt];
    const anchorText = timestampCandidates.find((candidate): candidate is string => typeof candidate === 'string' && Number.isFinite(Date.parse(candidate)));
    const anchor = anchorText ? new Date(anchorText) : systemClock.now();
    raw.expeditions ??= { runs: {}, order: [], discoveryStorage: [], overflowDiscarded: 0, totalCycles: 0, totalClaims: 0 };
    raw.training ??= { assignment: null };
    raw.affinityGarden ??= { assignment: null };
    raw.research ??= { slot: null, completedProjectIds: [], claimLedger: {} };
    raw.idle ??= createIdleState(anchor);
  }
  const progressionAnchorText = [raw.updatedAt, raw.createdAt].find((candidate): candidate is string => typeof candidate === 'string' && Number.isFinite(Date.parse(candidate)));
  const progressionAnchor = progressionAnchorText ? new Date(progressionAnchorText) : systemClock.now();
  raw.endlessMine ??= createInitialEndlessCampaign(progressionAnchor);
  raw.mastery ??= createInitialMasteryState();
  if (isRecord(raw.idle) && isRecord(raw.idle.lastWelcomeBack)) {
    raw.idle.lastWelcomeBack.endlessFloors ??= 0;
    raw.idle.lastWelcomeBack.endlessCredits ??= 0;
    raw.idle.lastWelcomeBack.equipmentAdded ??= 0;
    raw.idle.lastWelcomeBack.equipmentSalvaged ??= 0;
    raw.idle.lastWelcomeBack.rareDiscoveries ??= 0;
  }
  raw.schemaVersion = CURRENT_SCHEMA_VERSION;
  const legacy = sourceVersion < CURRENT_SCHEMA_VERSION;
  const state = legacy ? mergeDefaults(raw) : raw as unknown as GameState;
  state.schemaVersion = CURRENT_SCHEMA_VERSION;
  if (legacy) {
    state.stones = isRecord(raw.stones) ? raw.stones as GameState['stones'] : state.stones;
    state.unappraisedFinds = Array.isArray(raw.unappraisedFinds) ? raw.unappraisedFinds as GameState['unappraisedFinds'] : state.unappraisedFinds;
    state.fusionHistory = Array.isArray(raw.fusionHistory) ? raw.fusionHistory as GameState['fusionHistory'] : state.fusionHistory;
    state.parties = Array.isArray(raw.parties) ? raw.parties as GameState['parties'] : state.parties;
    state.battleHistory = Array.isArray(raw.battleHistory) ? raw.battleHistory as GameState['battleHistory'] : state.battleHistory;
    state.achievements = isRecord(raw.achievements) ? raw.achievements as GameState['achievements'] : state.achievements;
    state.dungeonClears = isRecord(raw.dungeonClears) ? raw.dungeonClears as GameState['dungeonClears'] : state.dungeonClears;
    state.expeditions.runs = isRecord(state.expeditions.runs) ? state.expeditions.runs : {};
    state.expeditions.order = Array.isArray(state.expeditions.order) ? state.expeditions.order : [];
    state.expeditions.discoveryStorage = Array.isArray(state.expeditions.discoveryStorage) ? state.expeditions.discoveryStorage : [];
    state.research.completedProjectIds = Array.isArray(state.research.completedProjectIds) ? state.research.completedProjectIds : [];
    state.research.claimLedger = isRecord(state.research.claimLedger) ? state.research.claimLedger : {};
    state.idle.scheduler.jobs = Array.isArray(state.idle.scheduler.jobs) ? state.idle.scheduler.jobs : [];
    state.online.queue = Array.isArray(state.online.queue) ? state.online.queue : [];
    state.online.processedReceipts = Array.isArray(state.online.processedReceipts) ? state.online.processedReceipts : [];
    state.collection.discoveredSpeciesIds = Array.isArray(state.collection.discoveredSpeciesIds) ? [...new Set(state.collection.discoveredSpeciesIds)] : [];
    state.collection.mutationSpecies = isRecord(state.collection.mutationSpecies) ? state.collection.mutationSpecies : {};
    state.collection.variantSpecies = isRecord(state.collection.variantSpecies) ? state.collection.variantSpecies : {};
    state.collection.origins = isRecord(state.collection.origins) ? state.collection.origins : {};
    // Stone capacity was not consistently enforced before schema v5. Preserve every
    // legacy Stone by expanding a valid historical capacity before strict validation.
    const legacyStoneCount = Object.keys(state.stones).length;
    if (legacyStoneCount > 1_000_000) throw new Error('Legacy save exceeds the maximum Stone capacity');
    if (Number.isSafeInteger(state.inventory.capacity) && state.inventory.capacity >= 0 && state.inventory.capacity <= 1_000_000) {
      state.inventory.capacity = Math.max(state.inventory.capacity, legacyStoneCount);
    }
    const rawFarmLedger = isRecord(state.mining.processedFarmEventIds) ? state.mining.processedFarmEventIds : {};
    const farmLedger: Record<string, true> = {};
    for (const eventId of Object.keys(rawFarmLedger)) Object.defineProperty(farmLedger, eventId, { value: true, enumerable: true, configurable: true, writable: true });
    for (const discovery of state.unappraisedFinds) {
      if (isRecord(discovery) && typeof discovery.sourceEventId === 'string') Object.defineProperty(farmLedger, discovery.sourceEventId, { value: true, enumerable: true, configurable: true, writable: true });
    }
    state.mining.processedFarmEventIds = farmLedger;
    // Lineage trait snapshots were introduced in v4.
    for (const stone of Object.values(state.stones)) {
      if (!isRecord(stone)) continue;
      for (const field of ['parents', 'grandparents'] as const) {
        if (!Array.isArray(stone[field])) continue;
        for (const lineage of stone[field]) if (isRecord(lineage) && !Array.isArray(lineage.traitIds)) lineage.traitIds = [];
      }
    }
  }
  return validateAndNormalizeGameState(state);
};

/** Explicit migration entry point accepts legacy raw v1-v3 only. */
export const migrateState = (rawValue: unknown): GameState => migrateStateInternal(rawValue, false);

export const exportSave = (state: GameState, clock: Clock = systemClock): string => {
  let stateCopy: GameState;
  try {
    stateCopy = JSON.parse(JSON.stringify(state)) as GameState;
  } catch {
    throw new Error('Game state is not JSON serializable');
  }
  validateAndNormalizeGameState(stateCopy);
  const envelope: SaveEnvelope = {
    format: 'STONEVERSE_SAVE',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: clock.now().toISOString(),
    checksum: stableChecksum(stateCopy),
    state: stateCopy,
  };
  return JSON.stringify(envelope, null, 2);
};

export const importSave = (serialized: string): GameState => {
  if (serialized.length > 20_000_000) throw new Error('Save exceeds the 20 MB safety limit');
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { throw new Error('Save is not valid JSON'); }
  if (!isRecord(parsed)) throw new Error('Save envelope must be an object');
  if (parsed.format === 'STONEVERSE_SAVE') {
    if (!isRecord(parsed.state)) throw new Error('Save envelope has no state');
    const envelopeVersion = requireNumber(parsed.schemaVersion, 'envelope.schemaVersion', { min: 1, max: CURRENT_SCHEMA_VERSION, integer: true });
    const stateVersion = requireNumber(parsed.state.schemaVersion, 'envelope.state.schemaVersion', { min: 1, max: CURRENT_SCHEMA_VERSION, integer: true });
    if (envelopeVersion !== stateVersion) throw new Error('Save envelope schemaVersion does not match its state');
    requireIsoDate(parsed.savedAt, 'envelope.savedAt');
    const checksum = requireString(parsed.checksum, 'envelope.checksum', { min: 8, max: 8 });
    if (!checksum || !/^[0-9a-f]{8}$/i.test(checksum)) throw new Error('Save envelope checksum is invalid');
    if (stableChecksum(parsed.state) !== checksum) throw new Error('Save checksum mismatch');
    return migrateStateInternal(parsed.state, true);
  }
  if (typeof parsed.schemaVersion !== 'number') throw new Error('Legacy raw saves require an explicit schemaVersion');
  const rawVersion = parsed.schemaVersion;
  if (rawVersion >= 4) throw new Error(`Raw schema ${rawVersion} saves require their original checksummed STONEVERSE_SAVE envelope`);
  // Historical raw-state exports remain importable for v1-v3 only; v4 introduced
  // the mandatory checksum boundary and remains envelope-only after migration.
  return migrateStateInternal(parsed, false);
};

export const saveAtomically = (storage: StorageAdapter, state: GameState, clock: Clock = systemClock): void => {
  const serialized = exportSave(state, clock);
  const previous = storage.getItem(SAVE_KEY);
  const previousBackup = storage.getItem(SAVE_BACKUP_KEY);
  try {
    storage.setItem(SAVE_TEMP_KEY, serialized);
    // Verify the pending write before touching the current save.
    const pending = storage.getItem(SAVE_TEMP_KEY);
    if (!pending) throw new Error('Storage did not retain pending save');
    importSave(pending);
    if (previous) {
      // Never replace a known recovery slot with a corrupt primary candidate.
      try {
        importSave(previous);
        storage.setItem(SAVE_BACKUP_KEY, previous);
      } catch { /* keep the independently validated existing backup */ }
    }
    storage.setItem(SAVE_KEY, pending);
    const committed = storage.getItem(SAVE_KEY);
    if (!committed) throw new Error('Storage did not retain committed save');
    importSave(committed);
    storage.removeItem(SAVE_TEMP_KEY);
  } catch (cause) {
    // Best-effort rollback keeps the last validated save authoritative. Individual
    // restore failures are ignored so the original storage error is preserved.
    try {
      if (previous === null) storage.removeItem(SAVE_KEY);
      else storage.setItem(SAVE_KEY, previous);
    } catch { /* storage may still be unavailable */ }
    try {
      if (previousBackup === null) storage.removeItem(SAVE_BACKUP_KEY);
      else storage.setItem(SAVE_BACKUP_KEY, previousBackup);
    } catch { /* storage may still be unavailable */ }
    try { storage.removeItem(SAVE_TEMP_KEY); } catch { /* storage may still be unavailable */ }
    throw cause;
  }
};

export interface SaveLoadInspection {
  state: GameState | null;
  invalidReadableCandidates: number;
  unreadableSlots: number;
}

export const inspectBestSave = (storage: StorageAdapter): SaveLoadInspection => {
  const candidates: string[] = [];
  let unreadableSlots = 0;
  for (const key of [SAVE_KEY, SAVE_TEMP_KEY, SAVE_BACKUP_KEY, ...LEGACY_SAVE_KEYS]) {
    try {
      const candidate = storage.getItem(key);
      if (candidate) candidates.push(candidate);
    } catch {
      unreadableSlots += 1;
      // A denied/corrupt storage slot must not prevent startup or recovery from
      // another independently readable candidate.
    }
  }
  let invalidReadableCandidates = 0;
  for (const candidate of candidates) {
    try { return { state: importSave(candidate), invalidReadableCandidates, unreadableSlots }; }
    catch { invalidReadableCandidates += 1; }
  }
  return { state: null, invalidReadableCandidates, unreadableSlots };
};

export const loadBestSave = (storage: StorageAdapter): GameState | null => inspectBestSave(storage).state;
