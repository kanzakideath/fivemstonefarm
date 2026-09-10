import type { RandomSource } from '../rng';

export const MAX_COMBAT_VALUE = 1_000_000_000_000;

export type CombatSide = 'PLAYER' | 'ENEMY';
export type CombatRole = 'VANGUARD' | 'TANK' | 'GUARDIAN' | 'STRIKER' | 'BREAKER' | 'SUPPORT' | 'CONTROLLER';
export type CombatElement =
  | 'NEUTRAL'
  | 'FIRE'
  | 'WATER'
  | 'EARTH'
  | 'WIND'
  | 'LIGHT'
  | 'DARK'
  | 'METAL'
  | 'CRYSTAL'
  | 'ANCIENT';
export type CombatStatKey =
  | 'maxHp'
  | 'attack'
  | 'defense'
  | 'speed'
  | 'accuracy'
  | 'resistance'
  | 'critChance'
  | 'critDamage'
  | 'breakPower';
export type CombatTarget = 'SELF' | 'ALLY_LOWEST' | 'ALL_ALLIES' | 'ENEMY' | 'ALL_ENEMIES' | 'BOSS';
export type CombatEffectKind =
  | 'DAMAGE'
  | 'HEAL'
  | 'SHIELD'
  | 'BUFF'
  | 'DEBUFF'
  | 'DOT'
  | 'CONTROL'
  | 'BREAK'
  | 'COUNTER'
  | 'ULTIMATE_GAIN'
  | 'STATUS';
export type ControlKind = 'STUN' | 'SILENCE' | 'TAUNT';
export type CombatStatusKind = 'BURN' | 'CRACK' | 'VULNERABLE' | 'STUN' | 'SILENCE' | 'SLOW' | 'SHIELD' | 'REGENERATION';
export type BattleOutcome = 'PLAYER' | 'ENEMY' | 'DRAW' | null;

export interface CombatStats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  accuracy: number;
  resistance: number;
  critChance: number;
  critDamage: number;
  breakPower: number;
}

export interface SkillEffect {
  kind: CombatEffectKind;
  /** Damage/healing/counter coefficient. DoT uses max-HP ratio. */
  power?: number;
  /** Flat break, ultimate or modifier value. Buff/debuff values are ratios. */
  value?: number;
  stat?: CombatStatKey;
  duration?: number;
  chance?: number;
  control?: ControlKind;
  status?: CombatStatusKind;
}

export interface AdvancedSkillDefinition {
  id: string;
  name: string;
  target: CombatTarget;
  element?: CombatElement;
  effects: readonly SkillEffect[];
  cooldown?: number;
  ultimateCost?: number;
  priority?: number;
  tags?: readonly ('ATTACK' | 'HEAL' | 'DEFENSE' | 'CONTROL' | 'BREAK' | 'ULTIMATE')[];
}

export interface BossPhaseDefinition {
  id: string;
  hpRatio: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  speedMultiplier?: number;
  weakPoint?: CombatElement;
  ultimateGain?: number;
  summons?: readonly CombatantTemplate[];
}

export interface BossDefinition {
  phases?: readonly BossPhaseDefinition[];
  enrageTurn?: number;
  enrageMultiplier?: number;
  weakPoint?: CombatElement;
  weakPointMultiplier?: number;
  breakThreshold?: number;
}

export interface CombatantTemplate {
  id: string;
  name: string;
  side: CombatSide;
  role: CombatRole;
  family?: string;
  element?: CombatElement;
  level: number;
  stats: CombatStats;
  skillIds: readonly string[];
  initialUltimate?: number;
  boss?: BossDefinition;
}

export interface StatModifier {
  stat: CombatStatKey;
  value: number;
  turns: number;
  sourceId: string;
}

export interface DamageOverTime {
  id: string;
  power: number;
  turns: number;
  sourceId: string;
}

export interface ControlStatus {
  kind: ControlKind;
  turns: number;
  sourceId: string;
}

export interface CounterStatus {
  power: number;
  turns: number;
  sourceId: string;
}

export interface TimedCombatStatus {
  kind: CombatStatusKind;
  power: number;
  turns: number;
  sourceId: string;
}

export interface BossRuntimeState {
  profile: BossDefinition;
  triggeredPhaseIds: string[];
  enraged: boolean;
  weakPoint?: CombatElement;
}

export interface AdvancedCombatant extends Omit<CombatantTemplate, 'stats' | 'skillIds' | 'boss'> {
  stats: CombatStats;
  skillIds: string[];
  hp: number;
  shield: number;
  ultimate: number;
  breakGauge: number;
  cooldowns: Record<string, number>;
  modifiers: StatModifier[];
  dots: DamageOverTime[];
  controls: ControlStatus[];
  statuses: TimedCombatStatus[];
  counter: CounterStatus | null;
  alive: boolean;
  bossState: BossRuntimeState | null;
}

export interface TeamSynergy {
  roleDiversity: number;
  lineagePairs: number;
  attackBonus: number;
  defenseBonus: number;
  speedBonus: number;
  breakBonus: number;
  ultimateStart: number;
}

export interface EffectResolution {
  targetId: string;
  kind: CombatEffectKind;
  hit: boolean;
  amount: number;
  critical?: boolean;
  absorbed?: number;
  status?: string;
}

export interface BattleLogEntry {
  turn: number;
  actorId: string;
  skillId: string;
  resolutions: EffectResolution[];
  counter?: { actorId: string; targetId: string; damage: number };
}

export interface AdvancedBattleState {
  units: AdvancedCombatant[];
  skills: Readonly<Record<string, AdvancedSkillDefinition>>;
  turn: number;
  maxTurns: number;
  outcome: BattleOutcome;
  log: BattleLogEntry[];
  synergies: Record<CombatSide, TeamSynergy>;
}

export interface AdvancedBattleConfig {
  units: readonly CombatantTemplate[];
  skills: Readonly<Record<string, AdvancedSkillDefinition>>;
  maxTurns?: number;
}

export interface CombatCommand {
  actorId: string;
  skillId: string;
  targetIds?: readonly string[];
}

export type CommandProvider = (
  state: Readonly<AdvancedBattleState>,
  actorId: string,
  rng: RandomSource,
) => CombatCommand | null;

export interface RoundOptions {
  commands?: Readonly<Record<string, CombatCommand>>;
  commandProvider?: CommandProvider;
}

const clamp = (value: number, min = 0, max = MAX_COMBAT_VALUE): number => {
  if (!Number.isFinite(value)) return value > 0 ? max : min;
  return Math.max(min, Math.min(max, value));
};

const safeRound = (value: number): number => Math.round(clamp(value));

const assertFinite = (value: number, label: string, min = 0, max = MAX_COMBAT_VALUE): number => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be finite and within ${min}..${max}`);
  }
  return value;
};

const assertRatio = (value: number, label: string, max = 10): number => assertFinite(value, label, 0, max);

const cloneBoss = (boss: BossDefinition): BossDefinition => ({
  ...boss,
  phases: boss.phases?.map((phase) => ({
    ...phase,
    summons: phase.summons?.map((summon) => cloneTemplate(summon)),
  })),
});

const cloneTemplate = (template: CombatantTemplate): CombatantTemplate => ({
  ...template,
  stats: { ...template.stats },
  skillIds: [...template.skillIds],
  boss: template.boss ? cloneBoss(template.boss) : undefined,
});

const validateSkill = (skill: AdvancedSkillDefinition): void => {
  if (!skill.id || !skill.name || skill.effects.length === 0) throw new TypeError('Skills require id, name and effects');
  assertFinite(skill.cooldown ?? 0, `${skill.id}.cooldown`, 0, 100);
  assertFinite(skill.ultimateCost ?? 0, `${skill.id}.ultimateCost`, 0, 100);
  for (const effect of skill.effects) {
    assertFinite(effect.power ?? 0, `${skill.id}.${effect.kind}.power`, 0, 100);
    assertFinite(Math.abs(effect.value ?? 0), `${skill.id}.${effect.kind}.value`, 0, MAX_COMBAT_VALUE);
    assertFinite(effect.duration ?? 0, `${skill.id}.${effect.kind}.duration`, 0, 1_000);
    assertFinite(effect.chance ?? 1, `${skill.id}.${effect.kind}.chance`, 0, 1);
    if ((effect.kind === 'BUFF' || effect.kind === 'DEBUFF') && !effect.stat) {
      throw new TypeError(`${skill.id}.${effect.kind} requires a stat`);
    }
    if (effect.kind === 'STATUS' && !effect.status) throw new TypeError(`${skill.id}.STATUS requires a status`);
  }
};

const validateTemplate = (template: CombatantTemplate, skills: Readonly<Record<string, AdvancedSkillDefinition>>): void => {
  if (!template.id || !template.name || template.skillIds.length === 0) throw new TypeError('Combatants require id, name and skills');
  assertFinite(template.level, `${template.id}.level`, 1, 1_000_000);
  for (const [stat, value] of Object.entries(template.stats)) assertFinite(value, `${template.id}.${stat}`);
  assertRatio(template.stats.critChance, `${template.id}.critChance`, 1);
  assertRatio(template.stats.critDamage, `${template.id}.critDamage`, 10);
  assertFinite(template.initialUltimate ?? 0, `${template.id}.initialUltimate`, 0, 100);
  for (const skillId of template.skillIds) {
    if (!skills[skillId]) throw new RangeError(`Unknown skill ${skillId} on ${template.id}`);
  }
  if (template.boss) {
    assertFinite(template.boss.enrageTurn ?? 0, `${template.id}.enrageTurn`, 0, 10_000);
    assertRatio(template.boss.enrageMultiplier ?? 1.5, `${template.id}.enrageMultiplier`);
    assertRatio(template.boss.weakPointMultiplier ?? 1.5, `${template.id}.weakPointMultiplier`);
    assertFinite(template.boss.breakThreshold ?? 100, `${template.id}.breakThreshold`, 1);
    for (const phase of template.boss.phases ?? []) {
      assertRatio(phase.hpRatio, `${template.id}.${phase.id}.hpRatio`, 1);
      assertRatio(phase.attackMultiplier ?? 1, `${template.id}.${phase.id}.attackMultiplier`);
      assertRatio(phase.defenseMultiplier ?? 1, `${template.id}.${phase.id}.defenseMultiplier`);
      assertRatio(phase.speedMultiplier ?? 1, `${template.id}.${phase.id}.speedMultiplier`);
      if ((phase.summons?.length ?? 0) > 20) throw new RangeError(`${template.id}.${phase.id} has too many summons`);
      for (const summon of phase.summons ?? []) validateTemplate(summon, skills);
    }
  }
};

export const createAdvancedCombatant = (template: CombatantTemplate): AdvancedCombatant => {
  const copied = cloneTemplate(template);
  return {
    id: copied.id,
    name: copied.name,
    side: copied.side,
    role: copied.role,
    family: copied.family,
    element: copied.element,
    level: copied.level,
    stats: copied.stats,
    skillIds: [...copied.skillIds],
    hp: copied.stats.maxHp,
    shield: 0,
    ultimate: clamp(copied.initialUltimate ?? 0, 0, 100),
    breakGauge: 0,
    cooldowns: {},
    modifiers: [],
    dots: [],
    controls: [],
    statuses: [],
    counter: null,
    alive: true,
    bossState: copied.boss
      ? { profile: copied.boss, triggeredPhaseIds: [], enraged: false, weakPoint: copied.boss.weakPoint }
      : null,
  };
};

export const calculateTeamSynergy = (templates: readonly Pick<CombatantTemplate, 'role' | 'family'>[]): TeamSynergy => {
  const roles = new Set(templates.map((unit) => unit.role));
  const familyCounts = new Map<string, number>();
  for (const unit of templates) {
    if (unit.family) familyCounts.set(unit.family, (familyCounts.get(unit.family) ?? 0) + 1);
  }
  const lineagePairs = [...familyCounts.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0);
  const hasGuardian = roles.has('TANK') || roles.has('GUARDIAN');
  const hasDamage = roles.has('STRIKER') || roles.has('BREAKER');
  const completeCore = hasGuardian && hasDamage && roles.has('SUPPORT');
  return {
    roleDiversity: roles.size,
    lineagePairs,
    attackBonus: clamp((roles.size - 1) * 0.025 + lineagePairs * 0.03 + (completeCore ? 0.05 : 0), 0, 0.5),
    defenseBonus: clamp((hasGuardian ? 0.06 : 0) + lineagePairs * 0.02, 0, 0.5),
    speedBonus: clamp((roles.has('CONTROLLER') ? 0.04 : 0) + Math.max(0, roles.size - 3) * 0.01, 0, 0.25),
    breakBonus: clamp((roles.has('BREAKER') ? 0.12 : 0) + (roles.has('VANGUARD') ? 0.03 : 0), 0, 0.35),
    ultimateStart: clamp((roles.has('SUPPORT') ? 8 : 0) + lineagePairs * 4, 0, 30),
  };
};

const addSynergy = (unit: AdvancedCombatant, synergy: TeamSynergy): void => {
  unit.modifiers.push(
    { stat: 'attack', value: synergy.attackBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: 'team-synergy' },
    { stat: 'defense', value: synergy.defenseBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: 'team-synergy' },
    { stat: 'speed', value: synergy.speedBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: 'team-synergy' },
    { stat: 'breakPower', value: synergy.breakBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: 'team-synergy' },
  );
  unit.ultimate = clamp(unit.ultimate + synergy.ultimateStart, 0, 100);
};

export const createAdvancedBattle = (config: AdvancedBattleConfig): AdvancedBattleState => {
  const skills = Object.fromEntries(
    Object.entries(config.skills).map(([id, skill]) => [id, { ...skill, effects: skill.effects.map((effect) => ({ ...effect })), tags: skill.tags ? [...skill.tags] : undefined }]),
  );
  for (const [key, skill] of Object.entries(skills)) {
    validateSkill(skill);
    if (key !== skill.id) throw new RangeError(`Skill registry key ${key} does not match ${skill.id}`);
  }
  if (config.units.length < 2 || config.units.length > 50) throw new RangeError('A battle requires 2..50 starting combatants');
  const ids = new Set<string>();
  for (const template of config.units) {
    validateTemplate(template, skills);
    if (ids.has(template.id)) throw new RangeError(`Duplicate combatant id ${template.id}`);
    ids.add(template.id);
  }
  if (!config.units.some((unit) => unit.side === 'PLAYER') || !config.units.some((unit) => unit.side === 'ENEMY')) {
    throw new RangeError('A battle requires both PLAYER and ENEMY combatants');
  }
  const units = config.units.map(createAdvancedCombatant);
  const synergies: Record<CombatSide, TeamSynergy> = {
    PLAYER: calculateTeamSynergy(config.units.filter((unit) => unit.side === 'PLAYER')),
    ENEMY: calculateTeamSynergy(config.units.filter((unit) => unit.side === 'ENEMY')),
  };
  for (const unit of units) addSynergy(unit, synergies[unit.side]);
  return {
    units,
    skills,
    turn: 0,
    maxTurns: Math.floor(assertFinite(config.maxTurns ?? 100, 'maxTurns', 1, 10_000)),
    outcome: null,
    log: [],
    synergies,
  };
};

/** Strict persistence guard for resumable battles. */
export const validateAdvancedBattleState: (value: unknown) => AdvancedBattleState = (value) => {
  if (!value || typeof value !== 'object') throw new TypeError('Advanced battle must be an object');
  const state = value as AdvancedBattleState;
  if (!Array.isArray(state.units) || state.units.length < 2 || state.units.length > 50) throw new RangeError('Advanced battle units are invalid');
  if (!state.skills || typeof state.skills !== 'object' || Array.isArray(state.skills)) throw new TypeError('Advanced battle skill book is invalid');
  for (const [id, skill] of Object.entries(state.skills)) {
    validateSkill(skill);
    if (id !== skill.id) throw new RangeError(`Skill registry key ${id} does not match ${skill.id}`);
  }
  assertFinite(state.turn, 'advanced.turn', 0, 10_000);
  assertFinite(state.maxTurns, 'advanced.maxTurns', 1, 10_000);
  if (!Number.isInteger(state.turn) || !Number.isInteger(state.maxTurns) || state.turn > state.maxTurns) throw new RangeError('Advanced battle turn is invalid');
  if (state.outcome !== null && !['PLAYER', 'ENEMY', 'DRAW'].includes(state.outcome)) throw new TypeError('Advanced battle outcome is invalid');
  const ids = new Set<string>();
  for (const unit of state.units) {
    validateTemplate({ ...unit, boss: unit.bossState?.profile }, state.skills);
    if (ids.has(unit.id)) throw new RangeError(`Duplicate advanced combatant id ${unit.id}`);
    ids.add(unit.id);
    assertFinite(unit.hp, `${unit.id}.hp`, 0, unit.stats.maxHp);
    assertFinite(unit.shield, `${unit.id}.shield`);
    assertFinite(unit.ultimate, `${unit.id}.ultimate`, 0, 100);
    assertFinite(unit.breakGauge, `${unit.id}.breakGauge`);
    if (unit.alive !== (unit.hp > 0)) throw new RangeError(`${unit.id}.alive disagrees with hp`);
    const numericRuntime: unknown[] = [unit.cooldowns, unit.modifiers, unit.dots, unit.controls, unit.statuses, unit.counter];
    const stack = [...numericRuntime];
    while (stack.length) {
      const current = stack.pop();
      if (typeof current === 'number' && !Number.isFinite(current)) throw new RangeError(`${unit.id} has a non-finite runtime value`);
      else if (Array.isArray(current)) stack.push(...current);
      else if (current && typeof current === 'object') stack.push(...Object.values(current));
    }
  }
  if (!state.units.some((unit) => unit.side === 'PLAYER') || !state.units.some((unit) => unit.side === 'ENEMY')) throw new RangeError('Advanced battle requires both sides');
  if (!Array.isArray(state.log) || state.log.length > 100_000) throw new RangeError('Advanced battle log is invalid');
  for (const entry of state.log) {
    if (!ids.has(entry.actorId) || !state.skills[entry.skillId]) throw new RangeError('Advanced battle log references an unknown actor or skill');
    if (!Array.isArray(entry.resolutions) || entry.resolutions.some((resolution) => !ids.has(resolution.targetId) || !Number.isFinite(resolution.amount))) throw new RangeError('Advanced battle resolution is invalid');
  }
  return state;
};

export const getEffectiveStat = (unit: AdvancedCombatant, stat: CombatStatKey): number => {
  const multiplier = unit.modifiers
    .filter((modifier) => modifier.stat === stat && modifier.turns > 0)
    .reduce((value, modifier) => clamp(value * (1 + modifier.value), 0, 100), 1);
  const statusMultiplier = unit.statuses
    .filter((status) => (stat === 'defense' && status.kind === 'CRACK') || (stat === 'speed' && status.kind === 'SLOW'))
    .reduce((value, status) => value * (1 - clamp(status.power, 0, 0.9)), 1);
  return clamp(unit.stats[stat] * multiplier * statusMultiplier);
};

export const getLivingUnits = (state: Readonly<AdvancedBattleState>, side?: CombatSide): AdvancedCombatant[] =>
  state.units.filter((unit) => unit.alive && (side === undefined || unit.side === side));

export const getUsableSkills = (state: Readonly<AdvancedBattleState>, actorId: string): AdvancedSkillDefinition[] => {
  const actor = state.units.find((unit) => unit.id === actorId);
  if (!actor?.alive) return [];
  const silenced = actor.controls.some((control) => control.kind === 'SILENCE' && control.turns > 0);
  return actor.skillIds
    .map((skillId) => state.skills[skillId])
    .filter((skill): skill is AdvancedSkillDefinition => Boolean(skill))
    .filter((skill) => (actor.cooldowns[skill.id] ?? 0) <= 0)
    .filter((skill) => (skill.ultimateCost ?? 0) <= actor.ultimate)
    .filter((skill) => !(silenced && (skill.ultimateCost ?? 0) > 0));
};

export const getTurnOrder = (state: Readonly<AdvancedBattleState>): string[] =>
  getLivingUnits(state)
    .sort((left, right) => getEffectiveStat(right, 'speed') - getEffectiveStat(left, 'speed') || left.id.localeCompare(right.id))
    .map((unit) => unit.id);

const opponentsOf = (state: Readonly<AdvancedBattleState>, actor: AdvancedCombatant): AdvancedCombatant[] =>
  getLivingUnits(state, actor.side === 'PLAYER' ? 'ENEMY' : 'PLAYER');

const alliesOf = (state: Readonly<AdvancedBattleState>, actor: AdvancedCombatant): AdvancedCombatant[] =>
  getLivingUnits(state, actor.side);

const targetByIds = (candidates: AdvancedCombatant[], targetIds: readonly string[] | undefined): AdvancedCombatant[] => {
  if (!targetIds?.length) return candidates;
  const allowed = new Set(targetIds);
  return candidates.filter((unit) => allowed.has(unit.id));
};

const resolveTargets = (
  state: Readonly<AdvancedBattleState>,
  actor: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
  targetIds: readonly string[] | undefined,
): AdvancedCombatant[] => {
  const allies = alliesOf(state, actor);
  const opponents = opponentsOf(state, actor);
  switch (skill.target) {
    case 'SELF':
      return targetIds?.length && !targetIds.includes(actor.id) ? [] : [actor];
    case 'ALL_ALLIES':
      return allies;
    case 'ALLY_LOWEST': {
      const explicit = targetByIds(allies, targetIds)[0];
      if (targetIds?.length && !explicit) return [];
      return [explicit ?? [...allies].sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp || a.id.localeCompare(b.id))[0]].filter(
        (unit): unit is AdvancedCombatant => Boolean(unit),
      );
    }
    case 'ALL_ENEMIES':
      return opponents;
    case 'BOSS': {
      const bosses = opponents.filter((unit) => unit.bossState);
      const explicit = targetByIds(bosses, targetIds)[0];
      if (targetIds?.length && !explicit) return [];
      return [explicit ?? bosses[0] ?? targetByIds(opponents, targetIds)[0] ?? opponents[0]].filter(
        (unit): unit is AdvancedCombatant => Boolean(unit),
      );
    }
    case 'ENEMY': {
      const taunter = opponents.find((unit) => unit.controls.some((control) => control.kind === 'TAUNT' && control.turns > 0));
      const explicit = targetByIds(opponents, targetIds)[0];
      if (targetIds?.length && !explicit) return [];
      return [taunter ?? explicit ?? opponents[0]].filter((unit): unit is AdvancedCombatant => Boolean(unit));
    }
  }
};

const hostile = (actor: AdvancedCombatant, target: AdvancedCombatant): boolean => actor.side !== target.side;

const hitChance = (actor: AdvancedCombatant, target: AdvancedCombatant, bonus = 1): number => {
  const accuracy = getEffectiveStat(actor, 'accuracy');
  const resistance = getEffectiveStat(target, 'resistance');
  return clamp((0.82 + (accuracy - resistance) / (accuracy + resistance + 200)) * bonus, 0.05, 0.99);
};

const applyDamage = (
  actor: AdvancedCombatant,
  target: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
  effect: SkillEffect,
  rng: RandomSource,
): EffectResolution => {
  if (!rng.chance(hitChance(actor, target, effect.chance ?? 1))) return { targetId: target.id, kind: effect.kind, hit: false, amount: 0 };
  const critical = rng.chance(clamp(getEffectiveStat(actor, 'critChance'), 0, 0.95));
  const attack = getEffectiveStat(actor, 'attack');
  const defense = getEffectiveStat(target, 'defense');
  const levelScale = clamp(1 + (actor.level - target.level) * 0.015, 0.25, 4);
  const mitigation = 100 / (100 + Math.sqrt(Math.max(0, defense)) * 8);
  let raw = clamp(attack * (effect.power ?? 1) * levelScale * mitigation);
  const attackElement = skill.element ?? actor.element;
  const advantages: Partial<Record<CombatElement, readonly CombatElement[]>> = {
    FIRE: ['EARTH'], EARTH: ['WIND'], WIND: ['WATER'], WATER: ['FIRE'],
    LIGHT: ['DARK'], DARK: ['LIGHT'], METAL: ['CRYSTAL'], CRYSTAL: ['ANCIENT'], ANCIENT: ['METAL'],
  };
  if (attackElement && target.element) {
    if (advantages[attackElement]?.includes(target.element)) raw = clamp(raw * 1.2);
    else if (advantages[target.element]?.includes(attackElement)) raw = clamp(raw * 0.84);
  }
  if (critical) raw = clamp(raw * getEffectiveStat(actor, 'critDamage'));
  const weakPoint = target.bossState?.weakPoint;
  if (weakPoint && skill.element === weakPoint) raw = clamp(raw * (target.bossState?.profile.weakPointMultiplier ?? 1.5));
  const vulnerable = target.statuses
    .filter((status) => status.kind === 'VULNERABLE')
    .reduce((multiplier, status) => multiplier * (1 + clamp(status.power, 0, 2)), 1);
  raw = clamp(raw * vulnerable);
  if (target.controls.some((control) => control.kind === 'STUN' && control.sourceId === 'break')) raw = clamp(raw * 1.25);
  const amount = Math.max(1, safeRound(raw));
  const absorbed = Math.min(target.shield, amount);
  target.shield = clamp(target.shield - absorbed);
  let unassignedAbsorb = absorbed;
  for (const status of target.statuses.filter((candidate) => candidate.kind === 'SHIELD')) {
    const fromStatus = Math.min(status.power, unassignedAbsorb);
    status.power -= fromStatus;
    unassignedAbsorb -= fromStatus;
    if (unassignedAbsorb <= 0) break;
  }
  const hpDamage = Math.min(target.hp, amount - absorbed);
  target.hp = clamp(target.hp - hpDamage, 0, target.stats.maxHp);
  target.alive = target.hp > 0;
  target.ultimate = clamp(target.ultimate + Math.min(15, 5 + hpDamage / Math.max(1, target.stats.maxHp) * 20), 0, 100);
  return { targetId: target.id, kind: effect.kind, hit: true, amount: hpDamage, absorbed, critical };
};

const applyHeal = (actor: AdvancedCombatant, target: AdvancedCombatant, effect: SkillEffect): EffectResolution => {
  const amount = Math.max(1, safeRound(getEffectiveStat(actor, 'attack') * (effect.power ?? 1)));
  const restored = Math.min(amount, target.stats.maxHp - target.hp);
  target.hp = clamp(target.hp + restored, 0, target.stats.maxHp);
  if (target.hp > 0) target.alive = true;
  return { targetId: target.id, kind: effect.kind, hit: true, amount: restored };
};

const applyShield = (actor: AdvancedCombatant, target: AdvancedCombatant, effect: SkillEffect): EffectResolution => {
  const amount = Math.max(1, safeRound(getEffectiveStat(actor, 'attack') * (effect.power ?? 1)));
  const before = target.shield;
  target.shield = clamp(target.shield + amount, 0, target.stats.maxHp * 3);
  return { targetId: target.id, kind: effect.kind, hit: true, amount: target.shield - before };
};

const applyModifier = (
  actor: AdvancedCombatant,
  target: AdvancedCombatant,
  effect: SkillEffect,
  rng: RandomSource,
): EffectResolution => {
  const isHostile = effect.kind === 'DEBUFF' && hostile(actor, target);
  if (isHostile && !rng.chance(hitChance(actor, target, effect.chance ?? 1))) {
    return { targetId: target.id, kind: effect.kind, hit: false, amount: 0 };
  }
  const value = effect.kind === 'DEBUFF' ? -Math.abs(effect.value ?? 0.15) : Math.abs(effect.value ?? 0.15);
  target.modifiers.push({ stat: effect.stat as CombatStatKey, value: clamp(value, -0.9, 5), turns: Math.max(1, Math.floor(effect.duration ?? 2)), sourceId: actor.id });
  return { targetId: target.id, kind: effect.kind, hit: true, amount: value, status: effect.stat };
};

const applyStatus = (
  actor: AdvancedCombatant,
  target: AdvancedCombatant,
  effect: SkillEffect,
  rng: RandomSource,
): EffectResolution => {
  if (hostile(actor, target) && !rng.chance(hitChance(actor, target, effect.chance ?? 1))) {
    return { targetId: target.id, kind: effect.kind, hit: false, amount: 0 };
  }
  if (effect.kind === 'DOT') {
    target.dots.push({ id: `${actor.id}:${target.dots.length}`, power: clamp(effect.power ?? 0.04, 0, 1), turns: Math.max(1, Math.floor(effect.duration ?? 2)), sourceId: actor.id });
    return { targetId: target.id, kind: effect.kind, hit: true, amount: effect.power ?? 0.04, status: 'DOT' };
  }
  if (effect.kind === 'CONTROL') {
    const control = effect.control ?? 'STUN';
    target.controls.push({ kind: control, turns: Math.max(1, Math.floor(effect.duration ?? 1)), sourceId: actor.id });
    return { targetId: target.id, kind: effect.kind, hit: true, amount: 0, status: control };
  }
  if (effect.kind === 'BREAK') {
    const cracked = target.statuses.some((status) => status.kind === 'CRACK');
    const amount = clamp(((effect.value ?? 20) + getEffectiveStat(actor, 'breakPower') * (effect.power ?? 1)) * (cracked ? 1.3 : 1));
    target.breakGauge = clamp(target.breakGauge + amount, 0, target.bossState?.profile.breakThreshold ?? 100);
    const threshold = target.bossState?.profile.breakThreshold ?? 100;
    if (target.breakGauge >= threshold) {
      target.breakGauge = 0;
      target.controls.push({ kind: 'STUN', turns: 1, sourceId: 'break' });
    }
    return { targetId: target.id, kind: effect.kind, hit: true, amount };
  }
  if (effect.kind === 'COUNTER') {
    target.counter = { power: clamp(effect.power ?? 0.6, 0, 10), turns: Math.max(1, Math.floor(effect.duration ?? 2)), sourceId: actor.id };
    return { targetId: target.id, kind: effect.kind, hit: true, amount: effect.power ?? 0.6, status: 'COUNTER' };
  }
  if (effect.kind === 'STATUS') {
    const status = effect.status as CombatStatusKind;
    const duration = Math.max(1, Math.floor(effect.duration ?? 2));
    if (status === 'STUN' || status === 'SILENCE') {
      target.controls.push({ kind: status, turns: duration, sourceId: actor.id });
      return { targetId: target.id, kind: effect.kind, hit: true, amount: 0, status };
    }
    if (status === 'SHIELD') {
      const shield = applyShield(actor, target, effect);
      target.statuses.push({ kind: status, power: shield.amount, turns: duration, sourceId: actor.id });
      return { ...shield, kind: effect.kind, status };
    }
    const defaults: Partial<Record<CombatStatusKind, number>> = {
      BURN: 0.035,
      CRACK: 0.18,
      VULNERABLE: 0.16,
      SLOW: 0.18,
      REGENERATION: 0.08,
    };
    const power = clamp(effect.power ?? defaults[status] ?? 0, 0, status === 'REGENERATION' || status === 'BURN' ? 1 : 2);
    target.statuses.push({ kind: status, power, turns: duration, sourceId: actor.id });
    return { targetId: target.id, kind: effect.kind, hit: true, amount: power, status };
  }
  const amount = clamp(effect.value ?? 10, 0, 100);
  target.ultimate = clamp(target.ultimate + amount, 0, 100);
  return { targetId: target.id, kind: effect.kind, hit: true, amount };
};

const triggerBossPhases = (state: AdvancedBattleState, boss: AdvancedCombatant): void => {
  if (!boss.bossState) return;
  const hpRatio = boss.hp / Math.max(1, boss.stats.maxHp);
  const phases = [...(boss.bossState.profile.phases ?? [])].sort((a, b) => b.hpRatio - a.hpRatio);
  for (const phase of phases) {
    if (hpRatio > phase.hpRatio || boss.bossState.triggeredPhaseIds.includes(phase.id)) continue;
    boss.bossState.triggeredPhaseIds.push(phase.id);
    if (phase.attackMultiplier !== undefined) boss.modifiers.push({ stat: 'attack', value: phase.attackMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${phase.id}` });
    if (phase.defenseMultiplier !== undefined) boss.modifiers.push({ stat: 'defense', value: phase.defenseMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${phase.id}` });
    if (phase.speedMultiplier !== undefined) boss.modifiers.push({ stat: 'speed', value: phase.speedMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${phase.id}` });
    if (phase.weakPoint) boss.bossState.weakPoint = phase.weakPoint;
    boss.ultimate = clamp(boss.ultimate + (phase.ultimateGain ?? 0), 0, 100);
    for (const [index, summon] of (phase.summons ?? []).entries()) {
      const copy = cloneTemplate(summon);
      copy.side = boss.side;
      copy.id = `${boss.id}:${phase.id}:${index}:${copy.id}`;
      const unit = createAdvancedCombatant(copy);
      addSynergy(unit, state.synergies[boss.side]);
      state.units.push(unit);
    }
  }
};

const updateOutcome = (state: AdvancedBattleState): void => {
  const playerAlive = state.units.some((unit) => unit.side === 'PLAYER' && unit.alive);
  const enemyAlive = state.units.some((unit) => unit.side === 'ENEMY' && unit.alive);
  if (!playerAlive && !enemyAlive) state.outcome = 'DRAW';
  else if (!enemyAlive) state.outcome = 'PLAYER';
  else if (!playerAlive) state.outcome = 'ENEMY';
  else if (state.turn >= state.maxTurns) state.outcome = 'DRAW';
};

const performCounter = (
  state: AdvancedBattleState,
  defender: AdvancedCombatant,
  attacker: AdvancedCombatant,
  rng: RandomSource,
): { actorId: string; targetId: string; damage: number } | undefined => {
  if (!defender.alive || !attacker.alive || !defender.counter || defender.counter.turns <= 0) return undefined;
  const result = applyDamage(
    defender,
    attacker,
    { id: 'counter', name: 'Counter', target: 'ENEMY', effects: [], tags: ['ATTACK'] },
    { kind: 'DAMAGE', power: defender.counter.power, chance: 1 },
    rng,
  );
  if (attacker.bossState) triggerBossPhases(state, attacker);
  return { actorId: defender.id, targetId: attacker.id, damage: result.amount };
};

/** Authoritative action resolver used by both manual commands and automatic AI. Mutates `state`. */
export const resolveAdvancedCommand = (
  state: AdvancedBattleState,
  command: CombatCommand,
  rng: RandomSource,
): BattleLogEntry => {
  if (state.outcome) throw new RangeError('Battle has already ended');
  const actor = state.units.find((unit) => unit.id === command.actorId);
  if (!actor?.alive) throw new RangeError(`Actor ${command.actorId} is unavailable`);
  const skill = state.skills[command.skillId];
  if (!skill || !actor.skillIds.includes(skill.id)) throw new RangeError(`Skill ${command.skillId} is unavailable`);
  if (!getUsableSkills(state, actor.id).some((candidate) => candidate.id === skill.id)) throw new RangeError(`Skill ${command.skillId} is not ready`);
  const targets = resolveTargets(state, actor, skill, command.targetIds);
  if (targets.length === 0) throw new RangeError(`Skill ${command.skillId} has no valid target`);

  actor.ultimate = clamp(actor.ultimate - (skill.ultimateCost ?? 0), 0, 100);
  if ((skill.cooldown ?? 0) > 0) actor.cooldowns[skill.id] = Math.floor(skill.cooldown ?? 0) + 1;
  const resolutions: EffectResolution[] = [];
  let counter: BattleLogEntry['counter'];
  for (const effect of skill.effects) {
    for (const target of targets.filter((candidate) => candidate.alive)) {
      let resolution: EffectResolution;
      if (effect.kind === 'DAMAGE') resolution = applyDamage(actor, target, skill, effect, rng);
      else if (effect.kind === 'HEAL') resolution = applyHeal(actor, target, effect);
      else if (effect.kind === 'SHIELD') resolution = applyShield(actor, target, effect);
      else if (effect.kind === 'BUFF' || effect.kind === 'DEBUFF') resolution = applyModifier(actor, target, effect, rng);
      else resolution = applyStatus(actor, target, effect, rng);
      resolutions.push(resolution);
      if (effect.kind === 'DAMAGE' && resolution.hit && target.bossState) triggerBossPhases(state, target);
      if (effect.kind === 'DAMAGE' && resolution.hit && (resolution.amount > 0 || (resolution.absorbed ?? 0) > 0) && hostile(actor, target)) {
        counter = performCounter(state, target, actor, rng) ?? counter;
      }
      updateOutcome(state);
      if (state.outcome) break;
    }
    if (state.outcome) break;
  }
  if ((skill.ultimateCost ?? 0) === 0) actor.ultimate = clamp(actor.ultimate + 12, 0, 100);
  const entry: BattleLogEntry = { turn: state.turn, actorId: actor.id, skillId: skill.id, resolutions, counter };
  state.log.push(entry);
  updateOutcome(state);
  return entry;
};

const tickActorStart = (state: AdvancedBattleState, actor: AdvancedCombatant): boolean => {
  for (const dot of actor.dots) {
    const amount = Math.max(1, safeRound(actor.stats.maxHp * dot.power));
    actor.hp = clamp(actor.hp - Math.min(actor.hp, amount), 0, actor.stats.maxHp);
    dot.turns -= 1;
  }
  actor.dots = actor.dots.filter((dot) => dot.turns > 0);
  for (const status of actor.statuses) {
    if (status.kind === 'BURN') {
      const amount = Math.max(1, safeRound(actor.stats.maxHp * status.power));
      actor.hp = clamp(actor.hp - Math.min(actor.hp, amount), 0, actor.stats.maxHp);
    } else if (status.kind === 'REGENERATION' && actor.hp > 0) {
      const amount = Math.max(1, safeRound(actor.stats.maxHp * status.power));
      actor.hp = clamp(actor.hp + amount, 0, actor.stats.maxHp);
    }
  }
  actor.alive = actor.hp > 0;
  updateOutcome(state);
  return actor.controls.some((control) => control.kind === 'STUN' && control.turns > 0);
};

const tickActorEnd = (actor: AdvancedCombatant): void => {
  for (const skillId of Object.keys(actor.cooldowns)) actor.cooldowns[skillId] = Math.max(0, (actor.cooldowns[skillId] ?? 0) - 1);
  for (const modifier of actor.modifiers) if (modifier.turns < Number.MAX_SAFE_INTEGER) modifier.turns -= 1;
  actor.modifiers = actor.modifiers.filter((modifier) => modifier.turns > 0);
  for (const control of actor.controls) control.turns -= 1;
  actor.controls = actor.controls.filter((control) => control.turns > 0);
  for (const status of actor.statuses) status.turns -= 1;
  const expiredShield = actor.statuses
    .filter((status) => status.kind === 'SHIELD' && status.turns <= 0)
    .reduce((sum, status) => sum + status.power, 0);
  actor.shield = clamp(actor.shield - expiredShield, 0, actor.stats.maxHp * 3);
  actor.statuses = actor.statuses.filter((status) => status.turns > 0 && (status.kind !== 'SHIELD' || status.power > 0));
  if (actor.counter) {
    actor.counter.turns -= 1;
    if (actor.counter.turns <= 0) actor.counter = null;
  }
};

const applyEnrage = (state: AdvancedBattleState): void => {
  for (const unit of state.units) {
    const boss = unit.bossState;
    if (!unit.alive || !boss || boss.enraged || !boss.profile.enrageTurn || state.turn < boss.profile.enrageTurn) continue;
    boss.enraged = true;
    const bonus = (boss.profile.enrageMultiplier ?? 1.5) - 1;
    unit.modifiers.push(
      { stat: 'attack', value: bonus, turns: Number.MAX_SAFE_INTEGER, sourceId: 'enrage' },
      { stat: 'speed', value: bonus * 0.5, turns: Number.MAX_SAFE_INTEGER, sourceId: 'enrage' },
    );
  }
};

export const runAdvancedRound = (state: AdvancedBattleState, options: RoundOptions, rng: RandomSource): AdvancedBattleState => {
  if (state.outcome) return state;
  state.turn += 1;
  applyEnrage(state);
  const order = getTurnOrder(state);
  for (const actorId of order) {
    if (state.outcome) break;
    const actor = state.units.find((unit) => unit.id === actorId);
    if (!actor?.alive) continue;
    const stunned = tickActorStart(state, actor);
    if (!state.outcome && !stunned) {
      const command = options.commands?.[actorId] ?? options.commandProvider?.(state, actorId, rng) ?? null;
      if (command) resolveAdvancedCommand(state, command, rng);
    }
    tickActorEnd(actor);
  }
  updateOutcome(state);
  return state;
};

export const runAdvancedBattle = (
  state: AdvancedBattleState,
  commandProvider: CommandProvider,
  rng: RandomSource,
): AdvancedBattleState => {
  while (!state.outcome && state.turn < state.maxTurns) runAdvancedRound(state, { commandProvider }, rng);
  updateOutcome(state);
  return state;
};

export const STANDARD_ADVANCED_SKILLS: Readonly<Record<string, AdvancedSkillDefinition>> = {
  strike: { id: 'strike', name: 'Stone Strike', target: 'ENEMY', effects: [{ kind: 'DAMAGE', power: 1 }], tags: ['ATTACK'] },
  sweep: { id: 'sweep', name: 'Shard Sweep', target: 'ALL_ENEMIES', effects: [{ kind: 'DAMAGE', power: 0.68 }], cooldown: 2, tags: ['ATTACK'] },
  mend: {
    id: 'mend',
    name: 'Crystal Mend',
    target: 'ALLY_LOWEST',
    effects: [{ kind: 'HEAL', power: 1.1 }, { kind: 'STATUS', status: 'REGENERATION', power: 0.06, duration: 2 }],
    cooldown: 2,
    tags: ['HEAL'],
  },
  bulwark: {
    id: 'bulwark',
    name: 'Reflecting Bulwark',
    target: 'SELF',
    effects: [{ kind: 'STATUS', status: 'SHIELD', power: 0.8, duration: 2 }, { kind: 'COUNTER', power: 0.55, duration: 2 }],
    cooldown: 3,
    tags: ['DEFENSE'],
  },
  fracture: {
    id: 'fracture',
    name: 'Fracture',
    target: 'ENEMY',
    effects: [
      { kind: 'DAMAGE', power: 0.65 },
      { kind: 'STATUS', status: 'CRACK', power: 0.16, duration: 2 },
      { kind: 'STATUS', status: 'VULNERABLE', power: 0.12, duration: 2 },
      { kind: 'BREAK', value: 28, power: 0.5 },
    ],
    cooldown: 1,
    tags: ['ATTACK', 'BREAK'],
  },
  eclipse: {
    id: 'eclipse',
    name: 'Eclipse Dust',
    target: 'ALL_ENEMIES',
    effects: [
      { kind: 'STATUS', status: 'BURN', power: 0.035, duration: 3 },
      { kind: 'STATUS', status: 'SLOW', power: 0.15, duration: 2 },
      { kind: 'STATUS', status: 'SILENCE', duration: 1, chance: 0.8 },
      { kind: 'DEBUFF', stat: 'attack', value: 0.18, duration: 2 },
    ],
    cooldown: 3,
    tags: ['CONTROL'],
  },
  stun: { id: 'stun', name: 'Seismic Lock', target: 'ENEMY', effects: [{ kind: 'STATUS', status: 'STUN', duration: 1, chance: 0.85 }], cooldown: 3, tags: ['CONTROL'] },
  nova: {
    id: 'nova',
    name: 'Astral Nova',
    target: 'ALL_ENEMIES',
    element: 'LIGHT',
    effects: [{ kind: 'DAMAGE', power: 2.2 }, { kind: 'BREAK', value: 35, power: 0.8 }],
    ultimateCost: 100,
    tags: ['ATTACK', 'BREAK', 'ULTIMATE'],
  },
};
