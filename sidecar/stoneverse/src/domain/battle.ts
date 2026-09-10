import { DUNGEON_BY_ID, SKILL_BY_ID, SPECIES_BY_ID, TRAIT_BY_ID } from '../data';
import type {
  BattleAction,
  BattleState,
  BattleStatus,
  BattleUnit,
  Clock,
  DungeonStageDefinition,
  Element,
  GameState,
  InventoryReward,
  SkillDefinition,
  SkillEffect,
  StatKey,
  Stats,
  StoneInstance,
} from './types';
import type { RandomSource } from './rng';
import { makeId, systemClock } from './rng';
import { calculateStoneStats, gainAffinity, gainStoneXp } from './stone';
import { evaluateAchievements, gainAccountXp, grantReward } from './economy';
import {
  createAdvancedBattle,
  createAutoCommandProvider,
  getTurnOrder,
  getUsableSkills,
  runAdvancedBattle,
  runAdvancedRound,
  type AdvancedBattleState,
  type AdvancedCombatant,
  type BattleLogEntry,
  type CombatantTemplate,
} from './advanced';
import { adaptSkillForAdvancedCombat, buildStoneCombatSkillBook, stoneToAdvancedCombatant } from './stoneCombatAdapter';

const matchup: Partial<Record<Element, Element[]>> = {
  FIRE: ['EARTH'], EARTH: ['WIND'], WIND: ['WATER'], WATER: ['FIRE'],
  LIGHT: ['DARK'], DARK: ['LIGHT'], METAL: ['CRYSTAL'], CRYSTAL: ['ANCIENT'], ANCIENT: ['METAL'],
};

export const elementMultiplier = (attacking: Element, defending: Element): number => {
  if (attacking === 'NEUTRAL' || defending === 'NEUTRAL') return 1;
  if (matchup[attacking]?.includes(defending)) return 1.25;
  if (matchup[defending]?.includes(attacking)) return 0.8;
  return 1;
};

const mergeReward = (a: InventoryReward, b: InventoryReward): InventoryReward => ({
  currencies: Object.fromEntries([...new Set([...Object.keys(a.currencies ?? {}), ...Object.keys(b.currencies ?? {})])]
    .map((key) => [key, (a.currencies?.[key as keyof NonNullable<InventoryReward['currencies']>] ?? 0) + (b.currencies?.[key as keyof NonNullable<InventoryReward['currencies']>] ?? 0)])),
  items: Object.fromEntries([...new Set([...Object.keys(a.items ?? {}), ...Object.keys(b.items ?? {})])]
    .map((key) => [key, (a.items?.[key] ?? 0) + (b.items?.[key] ?? 0)])),
  accountXp: (a.accountXp ?? 0) + (b.accountXp ?? 0),
  miningXp: (a.miningXp ?? 0) + (b.miningXp ?? 0),
  stoneXp: (a.stoneXp ?? 0) + (b.stoneXp ?? 0),
});

const stoneToUnit = (stone: StoneInstance, team: BattleUnit['team']): BattleUnit => ({
  unitId: `${team.toLowerCase()}_${stone.instanceId}`,
  stoneId: stone.instanceId,
  team,
  speciesId: stone.speciesId,
  name: stone.nickname || stone.name,
  element: stone.primaryElement,
  role: SPECIES_BY_ID[stone.speciesId]?.role ?? 'ATTACK',
  level: stone.level,
  stats: { ...stone.stats },
  currentHp: stone.stats.maxHp,
  shield: 0,
  ultimate: 0,
  cooldowns: {},
  statuses: [],
  modifiers: [],
  skillIds: stone.skills.map((skill) => skill.skillId),
  traitIds: [...stone.traitIds],
  alive: true,
});

const enemyToUnit = (stage: DungeonStageDefinition, enemyIndex: number, rng: RandomSource): BattleUnit => {
  const enemy = stage.enemies[enemyIndex];
  if (!enemy) throw new Error('Enemy definition missing');
  const species = SPECIES_BY_ID[enemy.speciesId];
  if (!species) throw new Error(`Unknown enemy species ${enemy.speciesId}`);
  const synthetic: Parameters<typeof calculateStoneStats>[0] = {
    speciesId: species.id,
    level: enemy.level,
    individualValues: { hardness: 15, purity: 15, power: 15, defense: 15, speed: 15, resonance: 15 },
    personalityId: 'personality_stalwart', potential: 45, awakeningStage: 0, reincarnationCount: 0,
    limitBreak: 0, mutation: 'NONE', traitIds: enemy.traitIds, learnedSkillNodes: [],
  };
  const base = calculateStoneStats(synthetic);
  const stats = Object.fromEntries(Object.entries(base).map(([key, value]) => [key, Math.max(1, Math.round(value * enemy.statMultiplier))])) as unknown as Stats;
  return {
    unitId: `enemy_${enemy.id}_${rng.int(1000, 9999)}`, stoneId: enemy.id, team: 'ENEMY', speciesId: species.id,
    name: species.name, element: species.primaryElement, role: species.role, level: enemy.level, stats,
    currentHp: stats.maxHp, shield: 0, ultimate: 0, cooldowns: {}, statuses: [], modifiers: [],
    skillIds: enemy.skillIds, traitIds: enemy.traitIds, alive: true,
  };
};

const effectiveStat = (unit: BattleUnit, key: keyof Stats): number => {
  let multiplier = unit.modifiers.filter((modifier) => modifier.stat === key).reduce((value, modifier) => value * modifier.multiplier, 1);
  if (key === 'defense' && unit.statuses.some((status) => status.id === 'FRACTURE')) {
    multiplier *= 1 - Math.max(...unit.statuses.filter((status) => status.id === 'FRACTURE').map((status) => status.potency));
  }
  if (key === 'defense' && unit.currentHp / unit.stats.maxHp <= 0.3 && unit.traitIds.includes('trait_last_bastion')) multiplier *= 1.35;
  return Math.max(1, unit.stats[key] * multiplier);
};

const initialiseTraits = (unit: BattleUnit): void => {
  for (const traitId of unit.traitIds) {
    for (const effect of TRAIT_BY_ID[traitId]?.effects ?? []) {
      if (effect.trigger !== 'BATTLE_START' || !effect.stat || effect.value === undefined) continue;
      unit.modifiers.push({ stat: effect.stat, multiplier: 1 + effect.value, turns: 1, sourceId: traitId });
    }
  }
};

export const createDungeonBattle = (
  state: GameState,
  dungeonId: string,
  stageId: string,
  rng: RandomSource,
  clock: Clock = systemClock,
): BattleState => {
  if (state.activeBattle && state.activeBattle.winner === null) throw new Error('A battle is already active');
  const dungeon = DUNGEON_BY_ID[dungeonId];
  if (!dungeon) throw new Error(`Unknown dungeon ${dungeonId}`);
  if (state.accountProgress.level < dungeon.minAccountLevel) throw new Error('Account level is too low for this dungeon');
  const stage = dungeon.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`Unknown dungeon stage ${stageId}`);
  const party = state.parties.find((candidate) => candidate.id === state.activePartyId);
  const stones = (party?.slots ?? []).map((slot) => state.stones[slot.stoneId]).filter((stone): stone is StoneInstance => Boolean(stone)).slice(0, 3);
  if (stones.length === 0) throw new Error('The active party is empty');
  if (new Set(stones.map((stone) => stone.instanceId)).size !== stones.length) throw new Error('Party contains duplicate stones');
  const playerUnits = stones.map((stone) => stoneToUnit(stone, 'PLAYER'));
  const enemyUnits = stage.enemies.map((_, index) => enemyToUnit(stage, index, rng));
  for (const unit of [...playerUnits, ...enemyUnits]) initialiseTraits(unit);
  const firstClear = !state.dungeonClears[`${dungeonId}:${stageId}`];
  const reward = firstClear ? mergeReward(stage.reward, stage.firstClearReward) : { ...stage.reward };
  const now = clock.now();
  const skillBook = Object.freeze({
    ...buildStoneCombatSkillBook(stones),
    ...Object.fromEntries(stage.enemies.flatMap((enemy) => enemy.skillIds)
      .map((skillId) => SKILL_BY_ID[skillId])
      .filter((skill): skill is SkillDefinition => Boolean(skill))
      .map((skill) => [skill.id, adaptSkillForAdvancedCombat(skill)])),
  });
  const playerTemplates = stones.map((stone, index) => ({
    ...stoneToAdvancedCombatant(stone),
    id: playerUnits[index]!.unitId,
  }));
  const enemyTemplates: CombatantTemplate[] = enemyUnits.map((unit, index) => ({
    id: unit.unitId,
    name: unit.name,
    side: 'ENEMY',
    role: unit.role === 'TANK' ? 'GUARDIAN' : unit.role === 'CONTROL' ? 'CONTROLLER' : unit.role === 'SUPPORT' ? 'SUPPORT' : 'STRIKER',
    family: SPECIES_BY_ID[unit.speciesId]?.family,
    element: unit.element,
    level: unit.level,
    stats: {
      maxHp: unit.stats.maxHp,
      attack: unit.stats.power,
      defense: unit.stats.defense + unit.stats.hardness * 0.2,
      speed: unit.stats.speed,
      accuracy: 92 + unit.stats.purity * 0.1,
      resistance: 82 + unit.stats.hardness * 0.12,
      critChance: Math.min(0.5, 0.05 + unit.stats.purity / 1_200),
      critDamage: 1.5,
      breakPower: 15 + unit.stats.resonance * 0.2,
    },
    skillIds: unit.skillIds,
    initialUltimate: stage.enemies.length === 1 ? 35 : 0,
    boss: stage.enemies.length === 1 && index === 0 ? {
      weakPoint: dungeon.element,
      weakPointMultiplier: 1.6,
      breakThreshold: 120 + unit.level * 2,
      enrageTurn: 14,
      enrageMultiplier: 1.5,
      phases: [
        { id: 'resonance-fracture', hpRatio: 0.6, attackMultiplier: 1.12, ultimateGain: 30 },
        { id: 'last-stand', hpRatio: 0.28, defenseMultiplier: 1.18, speedMultiplier: 1.1, ultimateGain: 45 },
      ],
    } : undefined,
  }));
  const battle: BattleState = {
    battleId: makeId('battle', rng, now.getTime()), mode: 'DUNGEON', dungeonId, stageId, turn: 0,
    units: [...playerUnits, ...enemyUnits], actionLog: [], winner: null, reward,
    startedAt: now.toISOString(), finishedAt: null,
    advanced: createAdvancedBattle({ units: [...playerTemplates, ...enemyTemplates], skills: skillBook, maxTurns: 100 }),
    controlMode: 'MANUAL',
    speed: 1,
  };
  syncAdvancedProjection(battle);
  return battle;
};

const aliveAllies = (battle: BattleState, actor: BattleUnit): BattleUnit[] => battle.units.filter((unit) => unit.team === actor.team && unit.alive);
const aliveEnemies = (battle: BattleState, actor: BattleUnit): BattleUnit[] => battle.units.filter((unit) => unit.team !== actor.team && unit.alive);

const selectTargets = (battle: BattleState, actor: BattleUnit, skill: SkillDefinition, rng: RandomSource): BattleUnit[] => {
  const allies = aliveAllies(battle, actor);
  const enemies = aliveEnemies(battle, actor);
  switch (skill.target) {
    case 'SELF': return [actor];
    case 'ALLY': return [allies.reduce((lowest, current) => current.currentHp / current.stats.maxHp < lowest.currentHp / lowest.stats.maxHp ? current : lowest, actor)];
    case 'ALL_ALLIES': return allies;
    case 'ALL_ENEMIES': return enemies;
    case 'ENEMY': {
      const taunters = enemies.filter((enemy) => enemy.statuses.some((status) => status.id === 'TAUNT'));
      return [rng.pick(taunters.length > 0 ? taunters : enemies)];
    }
  }
};

const chooseSkill = (battle: BattleState, actor: BattleUnit, rng: RandomSource): SkillDefinition => {
  const known = actor.skillIds.map((id) => SKILL_BY_ID[id]).filter((skill): skill is SkillDefinition => Boolean(skill));
  const available = known.filter((skill) => (actor.cooldowns[skill.id] ?? 0) <= 0 && (skill.ultimateCost <= 0 || actor.ultimate >= skill.ultimateCost));
  if (available.length === 0) return SKILL_BY_ID.skill_stone_strike as SkillDefinition;
  const allies = aliveAllies(battle, actor);
  return rng.weighted(available, (skill) => {
    const hasWounded = allies.some((ally) => ally.currentHp / ally.stats.maxHp < 0.55);
    const supportBonus = hasWounded && skill.effects.some((effect) => effect.type === 'HEAL' || effect.type === 'SHIELD') ? 8 : 1;
    const ultimateBonus = skill.ultimateCost > 0 ? 12 : 1;
    const roleBonus = actor.role === 'SUPPORT' && skill.tags.includes('support') ? 2 : actor.role === 'TANK' && skill.tags.includes('tank') ? 2 : 1;
    return Math.max(0.1, (skill.priority + 1) * supportBonus * ultimateBonus * roleBonus);
  });
};

const applyDamage = (actor: BattleUnit, target: BattleUnit, skill: SkillDefinition, power: number, rng: RandomSource): { damage: number; critical: boolean; defeated: boolean } => {
  const attack = effectiveStat(actor, 'power');
  const defense = effectiveStat(target, 'defense');
  const resonance = effectiveStat(actor, 'resonance');
  const purity = effectiveStat(actor, 'purity');
  const criticalChance = Math.min(0.42, 0.04 + purity / (purity + 260) * 0.28 + resonance / (resonance + 500) * 0.08);
  const critical = rng.chance(criticalChance);
  const variance = 0.92 + rng.next() * 0.16;
  const elemental = elementMultiplier(skill.element, target.element);
  const raw = Math.max(1, attack * power * (1.25 + actor.level * 0.006) - defense * 0.34);
  let damage = Math.max(1, Math.round(raw * elemental * variance * (critical ? 1.55 : 1)));
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, damage);
    target.shield -= absorbed;
    damage -= absorbed;
  }
  target.currentHp = Math.max(0, target.currentHp - damage);
  target.ultimate = Math.min(100, target.ultimate + Math.max(6, Math.round(damage / Math.max(1, target.stats.maxHp) * 28)));
  if (target.currentHp <= 0) target.alive = false;
  return { damage, critical, defeated: !target.alive };
};

const applyEffect = (
  battle: BattleState,
  actor: BattleUnit,
  targets: BattleUnit[],
  skill: SkillDefinition,
  effect: SkillEffect,
  rng: RandomSource,
  action: BattleAction,
): void => {
  for (const target of targets) {
    if (!target.alive && effect.type !== 'DAMAGE') continue;
    switch (effect.type) {
      case 'DAMAGE': {
        const result = applyDamage(actor, target, skill, effect.power ?? 1, rng);
        action.damage += result.damage;
        if (action.damageByTarget) action.damageByTarget[target.unitId] = (action.damageByTarget[target.unitId] ?? 0) + result.damage;
        action.critical ||= result.critical;
        if (result.defeated) action.defeatedIds.push(target.unitId);
        break;
      }
      case 'HEAL': {
        const healing = Math.min(target.stats.maxHp - target.currentHp, Math.max(1, Math.round(effectiveStat(actor, 'resonance') * (effect.power ?? 1) + actor.level * 1.5)));
        target.currentHp += healing;
        action.healing += healing;
        if (action.healingByTarget) action.healingByTarget[target.unitId] = (action.healingByTarget[target.unitId] ?? 0) + healing;
        break;
      }
      case 'SHIELD': target.shield += Math.max(1, Math.round(effectiveStat(actor, 'resonance') * (effect.power ?? 1))); break;
      case 'BUFF':
      case 'DEBUFF': {
        if (!effect.stat || effect.value === undefined) break;
        target.modifiers.push({ stat: effect.stat, multiplier: Math.max(0.1, 1 + effect.value), turns: effect.duration ?? 1, sourceId: skill.id });
        break;
      }
      case 'STATUS': {
        if (!effect.statusId || !rng.chance(effect.chance ?? 1)) break;
        target.statuses = target.statuses.filter((status) => status.id !== effect.statusId);
        target.statuses.push({ id: effect.statusId, turns: effect.duration ?? 1, potency: effect.value ?? 0, sourceId: actor.unitId });
        action.statusesApplied.push(effect.statusId);
        break;
      }
      case 'ULTIMATE_GAIN': target.ultimate = Math.min(100, target.ultimate + (effect.value ?? 0)); break;
    }
  }
  void battle;
};

const applyTurnStartStatuses = (unit: BattleUnit): boolean => {
  for (const status of unit.statuses) {
    if (status.id === 'BURN' || status.id === 'POISON') {
      unit.currentHp = Math.max(0, unit.currentHp - Math.max(1, Math.round(unit.stats.maxHp * status.potency)));
      if (unit.currentHp === 0) unit.alive = false;
    }
    if (status.id === 'REGEN') unit.currentHp = Math.min(unit.stats.maxHp, unit.currentHp + Math.max(1, Math.round(unit.stats.maxHp * status.potency)));
  }
  return unit.statuses.some((status) => status.id === 'STUN');
};

const tickDurations = (unit: BattleUnit): void => {
  unit.statuses = unit.statuses.map((status) => ({ ...status, turns: status.turns - 1 })).filter((status) => status.turns > 0);
  unit.modifiers = unit.modifiers.map((modifier) => ({ ...modifier, turns: modifier.turns - 1 })).filter((modifier) => modifier.turns > 0);
};

const determineWinner = (battle: BattleState): BattleState['winner'] => {
  const playerAlive = battle.units.some((unit) => unit.team === 'PLAYER' && unit.alive);
  const enemyAlive = battle.units.some((unit) => unit.team === 'ENEMY' && unit.alive);
  if (!playerAlive && !enemyAlive) return 'DRAW';
  if (!playerAlive) return 'ENEMY';
  if (!enemyAlive) return 'PLAYER';
  if (battle.turn >= 100) return 'DRAW';
  return null;
};

/** Resolves one complete initiative round. The result is deterministic for a supplied RNG. */
const runLegacyBattleRound = (battle: BattleState, rng: RandomSource, clock: Clock = systemClock): BattleAction[] => {
  if (battle.winner) return [];
  battle.turn += 1;
  const actions: BattleAction[] = [];
  const actors = battle.units.filter((unit) => unit.alive).sort((a, b) => {
    const difference = effectiveStat(b, 'speed') - effectiveStat(a, 'speed');
    return Math.abs(difference) > 0.001 ? difference : rng.next() - 0.5;
  });
  for (const actor of actors) {
    if (!actor.alive || battle.winner) continue;
    for (const skillId of Object.keys(actor.cooldowns)) actor.cooldowns[skillId] = Math.max(0, (actor.cooldowns[skillId] ?? 0) - 1);
    const stunned = applyTurnStartStatuses(actor);
    if (!actor.alive) {
      battle.winner = determineWinner(battle);
      continue;
    }
    if (!stunned) {
      const skill = chooseSkill(battle, actor, rng);
      const targets = selectTargets(battle, actor, skill, rng).filter(Boolean);
      const action: BattleAction = { turn: battle.turn, actorId: actor.unitId, skillId: skill.id, targetIds: targets.map((target) => target.unitId), damage: 0, healing: 0, damageByTarget: {}, healingByTarget: {}, critical: false, statusesApplied: [], defeatedIds: [] };
      if (skill.ultimateCost > 0) actor.ultimate = Math.max(0, actor.ultimate - skill.ultimateCost);
      else actor.ultimate = Math.min(100, actor.ultimate + 15);
      if (skill.cooldown > 0) actor.cooldowns[skill.id] = skill.cooldown + 1;
      for (const effect of skill.effects) applyEffect(battle, actor, targets, skill, effect, rng, action);
      actions.push(action);
      battle.actionLog.push(action);
    }
    tickDurations(actor);
    battle.winner = determineWinner(battle);
  }
  battle.winner = determineWinner(battle);
  if (battle.winner) battle.finishedAt = clock.now().toISOString();
  return actions;
};

const statusIdFromAdvanced = (status: string): BattleAction['statusesApplied'][number] | undefined => {
  if (status === 'BURN') return 'BURN';
  if (status === 'STUN') return 'STUN';
  if (status === 'CRACK' || status === 'VULNERABLE') return 'FRACTURE';
  if (status === 'REGENERATION') return 'REGEN';
  if (status === 'TAUNT') return 'TAUNT';
  return undefined;
};

const statsFromAdvanced = (unit: AdvancedCombatant): Stats => ({
  maxHp: unit.stats.maxHp,
  power: unit.stats.attack,
  defense: unit.stats.defense,
  speed: unit.stats.speed,
  hardness: unit.stats.resistance,
  purity: unit.stats.accuracy,
  resonance: unit.stats.breakPower,
});

const syncAdvancedUnit = (battle: BattleState, advanced: AdvancedCombatant): BattleUnit => {
  const existing = battle.units.find((unit) => unit.unitId === advanced.id);
  const playerStoneId = advanced.side === 'PLAYER' ? advanced.id.replace(/^player_/, '') : advanced.id;
  const unit: BattleUnit = existing ?? {
    unitId: advanced.id,
    stoneId: playerStoneId,
    team: advanced.side,
    speciesId: playerStoneId,
    name: advanced.name,
    element: advanced.element ?? 'NEUTRAL',
    role: advanced.role === 'GUARDIAN' || advanced.role === 'VANGUARD' || advanced.role === 'TANK' ? 'TANK'
      : advanced.role === 'SUPPORT' ? 'SUPPORT' : advanced.role === 'CONTROLLER' || advanced.role === 'BREAKER' ? 'CONTROL' : 'ATTACK',
    level: advanced.level,
    stats: statsFromAdvanced(advanced),
    currentHp: advanced.hp,
    shield: advanced.shield,
    ultimate: advanced.ultimate,
    cooldowns: {}, statuses: [], modifiers: [], skillIds: [...advanced.skillIds], traitIds: [], alive: advanced.alive,
  };
  unit.stats = statsFromAdvanced(advanced);
  unit.currentHp = advanced.hp;
  unit.shield = advanced.shield;
  unit.ultimate = advanced.ultimate;
  unit.cooldowns = { ...advanced.cooldowns };
  unit.alive = advanced.alive;
  unit.skillIds = [...advanced.skillIds];
  const projectedStatuses = [
    ...advanced.statuses.map((status) => ({ id: statusIdFromAdvanced(status.kind), turns: status.turns, potency: status.power, sourceId: status.sourceId })),
    ...advanced.controls.map((status) => ({ id: statusIdFromAdvanced(status.kind), turns: status.turns, potency: 1, sourceId: status.sourceId })),
    ...advanced.dots.map((status) => ({ id: 'BURN' as const, turns: status.turns, potency: status.power, sourceId: status.sourceId })),
  ].filter((status): status is BattleStatus => Boolean(status.id));
  unit.statuses = projectedStatuses.map((status) => ({ ...status, turns: Math.max(1, Math.min(100, status.turns)) }));
  unit.modifiers = advanced.modifiers.flatMap((modifier) => {
    const stat = modifier.stat === 'attack' ? 'power'
      : modifier.stat === 'resistance' ? 'hardness'
        : modifier.stat === 'accuracy' ? 'purity'
          : modifier.stat === 'breakPower' ? 'resonance'
            : modifier.stat === 'critChance' || modifier.stat === 'critDamage' ? null : modifier.stat;
    return stat ? [{ stat, multiplier: Math.max(0.01, 1 + modifier.value), turns: Math.max(1, Math.min(100, modifier.turns)), sourceId: modifier.sourceId }] : [];
  });
  return unit;
};

const actionFromAdvanced = (battle: BattleState, entry: BattleLogEntry): BattleAction => {
  const targetIds = [...new Set(entry.resolutions.map((resolution) => resolution.targetId))];
  const damageByTarget: Record<string, number> = {};
  const healingByTarget: Record<string, number> = {};
  const statusesApplied = new Set<BattleAction['statusesApplied'][number]>();
  for (const resolution of entry.resolutions) {
    if (resolution.kind === 'DAMAGE' || resolution.kind === 'DOT') damageByTarget[resolution.targetId] = (damageByTarget[resolution.targetId] ?? 0) + resolution.amount;
    if (resolution.kind === 'HEAL') healingByTarget[resolution.targetId] = (healingByTarget[resolution.targetId] ?? 0) + resolution.amount;
    const status = statusIdFromAdvanced(resolution.status ?? '');
    if (status) statusesApplied.add(status);
  }
  return {
    turn: entry.turn,
    actorId: entry.actorId,
    skillId: entry.skillId,
    targetIds,
    damage: Object.values(damageByTarget).reduce((sum, amount) => sum + amount, 0),
    healing: Object.values(healingByTarget).reduce((sum, amount) => sum + amount, 0),
    damageByTarget,
    healingByTarget,
    critical: entry.resolutions.some((resolution) => resolution.critical),
    statusesApplied: [...statusesApplied],
    defeatedIds: [],
  };
};

const syncAdvancedProjection = (battle: BattleState, newEntries: readonly BattleLogEntry[] = [], clock: Clock = systemClock, livingBefore?: ReadonlySet<string>): void => {
  if (!battle.advanced) return;
  const actionStart = battle.actionLog.length;
  for (const advanced of battle.advanced.units) {
    const projected = syncAdvancedUnit(battle, advanced);
    const index = battle.units.findIndex((unit) => unit.unitId === projected.unitId);
    if (index >= 0) battle.units[index] = projected;
    else battle.units.push(projected);
  }
  for (const entry of newEntries) {
    battle.actionLog.push(actionFromAdvanced(battle, entry));
    if (entry.counter) battle.actionLog.push({
      turn: entry.turn,
      actorId: entry.counter.actorId,
      skillId: 'counter',
      targetIds: [entry.counter.targetId],
      damage: entry.counter.damage,
      healing: 0,
      damageByTarget: { [entry.counter.targetId]: entry.counter.damage },
      healingByTarget: {},
      critical: false,
      statusesApplied: [],
      defeatedIds: [],
    });
  }
  for (const defeated of battle.advanced.units.filter((unit) => unit.alive === false && livingBefore?.has(unit.id))) {
    let finishingAction: BattleAction | undefined;
    for (let index = battle.actionLog.length - 1; index >= actionStart; index -= 1) {
      const candidate = battle.actionLog[index];
      if ((candidate?.damageByTarget?.[defeated.id] ?? 0) > 0) { finishingAction = candidate; break; }
    }
    if (finishingAction && !finishingAction.defeatedIds.includes(defeated.id)) finishingAction.defeatedIds.push(defeated.id);
  }
  battle.turn = battle.advanced.turn;
  battle.winner = battle.advanced.outcome;
  if (battle.winner && !battle.finishedAt) battle.finishedAt = clock.now().toISOString();
};

const advancedProvider = (strategy: 'BALANCED' | 'AGGRESSIVE' = 'BALANCED') => {
  const playerAi = createAutoCommandProvider(strategy);
  const enemyAi = createAutoCommandProvider('AGGRESSIVE');
  return (state: Readonly<AdvancedBattleState>, actorId: string, rng: RandomSource) =>
    state.units.find((unit) => unit.id === actorId)?.side === 'PLAYER'
      ? playerAi(state, actorId, rng)
      : enemyAi(state, actorId, rng);
};

/** Advances the authoritative engine by one full speed-ordered round using AI. */
export const runBattleRound = (battle: BattleState, rng: RandomSource, clock: Clock = systemClock): BattleAction[] => {
  if (!battle.advanced) return runLegacyBattleRound(battle, rng, clock);
  const actionStart = battle.actionLog.length;
  const logStart = battle.advanced.log.length;
  const livingBefore = new Set(battle.advanced.units.filter((unit) => unit.alive).map((unit) => unit.id));
  runAdvancedRound(battle.advanced, { commandProvider: advancedProvider() }, rng);
  syncAdvancedProjection(battle, battle.advanced.log.slice(logStart), clock, livingBefore);
  return battle.actionLog.slice(actionStart);
};

/** Executes one player-selected command; all remaining actors use the same advanced AI path. */
export const runDungeonManualRound = (
  battle: BattleState,
  skillId: string,
  targetIds: readonly string[] | undefined,
  rng: RandomSource,
  clock: Clock = systemClock,
): BattleAction[] => {
  if (!battle.advanced || battle.winner) throw new Error('No active advanced dungeon battle');
  const actorId = getTurnOrder(battle.advanced).find((id) => battle.advanced!.units.find((unit) => unit.id === id)?.side === 'PLAYER');
  if (!actorId) throw new Error('No living player actor');
  if (!getUsableSkills(battle.advanced, actorId).some((skill) => skill.id === skillId)) throw new Error('Selected skill is not usable');
  const actionStart = battle.actionLog.length;
  const logStart = battle.advanced.log.length;
  const livingBefore = new Set(battle.advanced.units.filter((unit) => unit.alive).map((unit) => unit.id));
  runAdvancedRound(battle.advanced, {
    commands: { [actorId]: { actorId, skillId, targetIds } },
    commandProvider: advancedProvider(),
  }, rng);
  syncAdvancedProjection(battle, battle.advanced.log.slice(logStart), clock, livingBefore);
  return battle.actionLog.slice(actionStart);
};

export const runBattleToCompletion = (battle: BattleState, rng: RandomSource, clock: Clock = systemClock): BattleState => {
  if (battle.advanced) {
    const logStart = battle.advanced.log.length;
    const livingBefore = new Set(battle.advanced.units.filter((unit) => unit.alive).map((unit) => unit.id));
    runAdvancedBattle(battle.advanced, advancedProvider(), rng);
    syncAdvancedProjection(battle, battle.advanced.log.slice(logStart), clock, livingBefore);
  } else while (!battle.winner) runLegacyBattleRound(battle, rng, clock);
  return battle;
};

/** Applies a finished battle exactly once to persistent progression. */
export const settleBattle = (state: GameState, battle: BattleState, clock: Clock = systemClock): void => {
  if (!battle.winner || !battle.finishedAt) throw new Error('Battle has not finished');
  if (state.battleHistory.some((entry) => entry.battleId === battle.battleId)) return;
  const won = battle.winner === 'PLAYER';
  const lost = battle.winner === 'ENEMY';
  if (won) state.statistics.battleWins += 1;
  else if (lost) state.statistics.battleLosses += 1;
  const playerUnits = battle.units.filter((unit) => unit.team === 'PLAYER');
  for (const unit of playerUnits) {
    const stone = state.stones[unit.stoneId];
    if (!stone) continue;
    const ownActions = battle.actionLog.filter((action) => action.actorId === unit.unitId);
    const receivedDamage = battle.actionLog.filter((action) => action.targetIds.includes(unit.unitId)).reduce((sum, action) => {
      if (action.damageByTarget) return sum + (action.damageByTarget[unit.unitId] ?? 0);
      return sum + action.damage / Math.max(1, action.targetIds.length);
    }, 0);
    stone.battleStatistics.battles += 1;
    if (won) stone.battleStatistics.wins += 1;
    else if (lost) stone.battleStatistics.losses += 1;
    stone.battleStatistics.damageDealt += ownActions.reduce((sum, action) => sum + action.damage, 0);
    stone.battleStatistics.damageTaken += receivedDamage;
    stone.battleStatistics.healingDone += ownActions.reduce((sum, action) => sum + action.healing, 0);
    stone.battleStatistics.criticalHits += ownActions.filter((action) => action.critical).length;
    stone.battleStatistics.enemiesDefeated += ownActions.reduce((sum, action) => sum + action.defeatedIds.length, 0);
    stone.battleStatistics.ultimatesUsed += ownActions.filter((action) => (SKILL_BY_ID[action.skillId]?.ultimateCost ?? 0) > 0).length;
    gainStoneXp(stone, won ? battle.reward?.stoneXp ?? 45 : Math.round((battle.reward?.stoneXp ?? 30) * 0.35));
    gainAffinity(stone, won ? 18 : 6);
  }
  if (won && battle.reward) grantReward(state, { ...battle.reward, stoneXp: undefined });
  if (won && battle.mode === 'DUNGEON' && battle.dungeonId && battle.stageId) {
    const key = `${battle.dungeonId}:${battle.stageId}`;
    const previous = state.dungeonClears[key];
    state.dungeonClears[key] = previous
      ? { ...previous, bestTurns: Math.min(previous.bestTurns, battle.turn), clearCount: previous.clearCount + 1 }
      : { bestTurns: battle.turn, clearCount: 1, firstClearedAt: clock.now().toISOString() };
  }
  gainAccountXp(state, won ? 25 : 8);
  state.profile.totalAffinity = Object.values(state.stones).reduce((sum, stone) => sum + stone.affinity.points, 0);
  state.battleHistory.unshift(battle);
  if (state.battleHistory.length > 100) state.battleHistory.length = 100;
  evaluateAchievements(state, clock);
};
