import type { RandomSource } from '../rng';
import {
  getEffectiveStat,
  getLivingUnits,
  getUsableSkills,
  type AdvancedBattleState,
  type AdvancedCombatant,
  type AdvancedSkillDefinition,
  type CombatElement,
  type CombatCommand,
  type CommandProvider,
} from './combat';

/** Five player-facing strategies. CONTROL and BOSS_HUNTER remain compatibility aliases. */
export const AI_STRATEGIES = ['BALANCED', 'AGGRESSIVE', 'DEFENSIVE', 'BOSS_FOCUS', 'RESOURCE_SAVE'] as const;
export type CanonicalAiStrategy = (typeof AI_STRATEGIES)[number];
export type AiStrategy = CanonicalAiStrategy | 'CONTROL' | 'BOSS_HUNTER';
export const AI_STRATEGY_ALIASES = { BOSS_HUNTER: 'BOSS_FOCUS' } as const;
export const LEGACY_AI_STRATEGIES = ['CONTROL'] as const;
const acceptedStrategies: readonly AiStrategy[] = [...AI_STRATEGIES, 'CONTROL', 'BOSS_HUNTER'];

export interface AiPriorityRule {
  id: string;
  description: string;
  weight: number;
}

/** Public and inspectable so balancing tools can explain an automatic decision. */
export const AI_PRIORITY_RULES: readonly AiPriorityRule[] = [
  { id: 'emergency-heal', description: 'Heal an ally below 42% HP before normal offense.', weight: 1_200 },
  { id: 'ready-ultimate', description: 'Spend a ready ultimate when a valid enemy exists.', weight: 900 },
  { id: 'multi-target', description: 'Prefer area attacks against at least three targets.', weight: 320 },
  { id: 'boss-focus', description: 'Focus an active boss over its summons.', weight: 420 },
  { id: 'break-window', description: 'Prefer break/control against an unbroken boss.', weight: 260 },
  { id: 'status-coverage', description: 'Apply buffs, debuffs, control and damage-over-time only where coverage is useful.', weight: 180 },
  { id: 'element-context', description: 'Exploit elemental advantages and boss weak points while avoiding resisted attacks.', weight: 350 },
  { id: 'boss-escalation', description: 'Escalate control, break and burst after a boss phase or enrage activates.', weight: 420 },
] as const;

export interface AiDecision {
  command: CombatCommand | null;
  score: number;
  reasons: string[];
}

const hasTag = (skill: AdvancedSkillDefinition, tag: NonNullable<AdvancedSkillDefinition['tags']>[number]): boolean =>
  skill.tags?.includes(tag) ?? false;

const opposingSide = (actor: AdvancedCombatant): 'PLAYER' | 'ENEMY' => (actor.side === 'PLAYER' ? 'ENEMY' : 'PLAYER');

const ELEMENT_ADVANTAGES: Partial<Record<CombatElement, readonly CombatElement[]>> = {
  FIRE: ['EARTH'],
  EARTH: ['WIND'],
  WIND: ['WATER'],
  WATER: ['FIRE'],
  LIGHT: ['DARK'],
  DARK: ['LIGHT'],
  METAL: ['CRYSTAL'],
  CRYSTAL: ['ANCIENT'],
  ANCIENT: ['METAL'],
};

const pushReason = (reasons: string[], reason: string): void => {
  if (!reasons.includes(reason)) reasons.push(reason);
};

/** Mirrors the authoritative resolver's element table without estimating damage randomly. */
const elementContext = (
  actor: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
  target: AdvancedCombatant,
): { score: number; reason?: string } => {
  if (!hasTag(skill, 'ATTACK') && !skill.effects.some((effect) => effect.kind === 'DAMAGE')) return { score: 0 };
  if (skill.element && target.bossState?.weakPoint === skill.element) {
    return { score: 350, reason: 'element-weak-point' };
  }
  const attackElement = skill.element ?? actor.element;
  if (!attackElement || !target.element || attackElement === 'NEUTRAL' || target.element === 'NEUTRAL') return { score: 0 };
  if (ELEMENT_ADVANTAGES[attackElement]?.includes(target.element)) return { score: 120, reason: 'element-advantage' };
  if (ELEMENT_ADVANTAGES[target.element]?.includes(attackElement)) return { score: -170, reason: 'element-resisted' };
  return { score: 0 };
};

const lowestAlly = (state: Readonly<AdvancedBattleState>, actor: AdvancedCombatant): AdvancedCombatant | undefined =>
  getLivingUnits(state, actor.side).sort(
    (left, right) => left.hp / Math.max(1, left.stats.maxHp) - right.hp / Math.max(1, right.stats.maxHp) || left.id.localeCompare(right.id),
  )[0];

const hasTacticalModifier = (target: AdvancedCombatant, stat: string, positive: boolean): boolean =>
  target.modifiers.some(
    (modifier) =>
      modifier.turns > 0 &&
      modifier.sourceId !== 'team-synergy' &&
      modifier.stat === stat &&
      (positive ? modifier.value > 0 : modifier.value < 0),
  );

const hasActiveControl = (target: AdvancedCombatant, kind: string): boolean =>
  target.controls.some((control) => control.turns > 0 && control.kind === kind);

const hasActiveStatus = (target: AdvancedCombatant, kind: string): boolean =>
  target.statuses.some((status) => status.turns > 0 && status.kind === kind);

const statusNovelty = (skill: AdvancedSkillDefinition, target: AdvancedCombatant): number =>
  skill.effects.reduce((score, effect) => {
    if (effect.kind === 'DEBUFF' && effect.stat) return score + (hasTacticalModifier(target, effect.stat, false) ? -55 : 35);
    if (effect.kind === 'DOT') return score + (target.dots.some((dot) => dot.turns > 0) ? -55 : 35);
    if (effect.kind === 'CONTROL') return score + (hasActiveControl(target, effect.control ?? 'STUN') ? -70 : 45);
    if (effect.kind === 'STATUS' && effect.status) {
      if (effect.status === 'STUN' || effect.status === 'SILENCE') {
        return score + (hasActiveControl(target, effect.status) ? -70 : 45);
      }
      if (['BURN', 'CRACK', 'VULNERABLE', 'SLOW'].includes(effect.status)) {
        return score + (hasActiveStatus(target, effect.status) ? -55 : 35);
      }
    }
    return score;
  }, 0);

const targetPreference = (
  actor: AdvancedCombatant,
  target: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
  strategy: AiStrategy,
): number => {
  let score = Math.round((1 - target.hp / Math.max(1, target.stats.maxHp)) * 100);
  const element = elementContext(actor, skill, target);
  score += element.score;
  score += statusNovelty(skill, target);
  if (skill.effects.some((effect) => !['HEAL', 'SHIELD', 'BUFF', 'COUNTER', 'ULTIMATE_GAIN'].includes(effect.kind))) {
    const accuracy = getEffectiveStat(actor, 'accuracy');
    const resistance = getEffectiveStat(target, 'resistance');
    score += Math.max(-120, Math.min(50, Math.round(((accuracy - resistance) / Math.max(200, accuracy + resistance + 200)) * 240)));
  }
  if (target.bossState && (strategy === 'BOSS_HUNTER' || strategy === 'BOSS_FOCUS')) score += 2_000;
  if (target.bossState && strategy === 'CONTROL' && !hasActiveControl(target, 'STUN')) score += 1_200;
  return score;
};

const selectEnemy = (
  state: Readonly<AdvancedBattleState>,
  actor: AdvancedCombatant,
  strategy: AiStrategy,
  skill: AdvancedSkillDefinition,
): AdvancedCombatant | undefined => {
  const enemies = getLivingUnits(state, opposingSide(actor));
  const bosses = enemies.filter((enemy) => enemy.bossState);
  const candidates = skill.target === 'BOSS' && bosses.length > 0 ? bosses : enemies;
  return [...candidates].sort(
    (left, right) =>
      targetPreference(actor, right, skill, strategy) - targetPreference(actor, left, skill, strategy) ||
      left.hp / Math.max(1, left.stats.maxHp) - right.hp / Math.max(1, right.stats.maxHp) ||
      left.id.localeCompare(right.id),
  )[0];
};

const strategyWeight = (strategy: AiStrategy, skill: AdvancedSkillDefinition): number => {
  switch (strategy) {
    case 'AGGRESSIVE':
      return (hasTag(skill, 'ATTACK') ? 180 : 0) + (hasTag(skill, 'ULTIMATE') ? 200 : 0);
    case 'DEFENSIVE':
      return (hasTag(skill, 'HEAL') ? 220 : 0) + (hasTag(skill, 'DEFENSE') ? 180 : 0);
    case 'CONTROL':
      return (hasTag(skill, 'CONTROL') ? 240 : 0) + (hasTag(skill, 'BREAK') ? 190 : 0);
    case 'BOSS_HUNTER':
    case 'BOSS_FOCUS':
      return (hasTag(skill, 'ATTACK') ? 100 : 0) + (hasTag(skill, 'BREAK') ? 210 : 0);
    case 'RESOURCE_SAVE':
      return (skill.ultimateCost ?? 0) > 0 ? -1_050 : (skill.cooldown ?? 0) > 1 ? -120 : 130;
    case 'BALANCED':
      return hasTag(skill, 'ATTACK') ? 70 : 50;
  }
};

const hostileTargetsForSkill = (
  state: Readonly<AdvancedBattleState>,
  actor: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
  strategy: AiStrategy,
): AdvancedCombatant[] => {
  if (skill.target === 'ALL_ENEMIES') return getLivingUnits(state, opposingSide(actor));
  if (skill.target === 'ENEMY' || skill.target === 'BOSS') {
    const target = selectEnemy(state, actor, strategy, skill);
    return target ? [target] : [];
  }
  return [];
};

const friendlyTargetsForSkill = (
  state: Readonly<AdvancedBattleState>,
  actor: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
): AdvancedCombatant[] => {
  if (skill.target === 'SELF') return [actor];
  if (skill.target === 'ALL_ALLIES') return getLivingUnits(state, actor.side);
  if (skill.target === 'ALLY_LOWEST') {
    const target = lowestAlly(state, actor);
    return target ? [target] : [];
  }
  return [];
};

const coverageAdjustment = (fresh: number, total: number, usefulWeight = 180, redundantPenalty = 220): number => {
  if (total === 0) return 0;
  const coverage = fresh / total;
  return Math.round(usefulWeight * coverage - redundantPenalty * (1 - coverage));
};

const scoreEffectContext = (
  state: Readonly<AdvancedBattleState>,
  actor: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
  strategy: AiStrategy,
  reasons: string[],
): number => {
  const hostileTargets = hostileTargetsForSkill(state, actor, skill, strategy);
  const friendlyTargets = friendlyTargetsForSkill(state, actor, skill);
  let score = 0;

  for (const effect of skill.effects) {
    if (effect.kind === 'BUFF' && effect.stat && friendlyTargets.length > 0) {
      const fresh = friendlyTargets.filter((target) => !hasTacticalModifier(target, effect.stat as string, true)).length;
      score += coverageAdjustment(fresh, friendlyTargets.length);
      pushReason(reasons, fresh > 0 ? 'buff-coverage' : 'buff-already-active');
    } else if (effect.kind === 'DEBUFF' && effect.stat && hostileTargets.length > 0) {
      const fresh = hostileTargets.filter((target) => !hasTacticalModifier(target, effect.stat as string, false)).length;
      score += coverageAdjustment(fresh, hostileTargets.length);
      pushReason(reasons, fresh > 0 ? 'debuff-coverage' : 'debuff-already-active');
    } else if (effect.kind === 'DOT' && hostileTargets.length > 0) {
      const fresh = hostileTargets.filter((target) => !target.dots.some((dot) => dot.turns > 0)).length;
      score += coverageAdjustment(fresh, hostileTargets.length, 160, 210);
      pushReason(reasons, fresh > 0 ? 'dot-window' : 'dot-already-active');
    } else if (effect.kind === 'CONTROL' && hostileTargets.length > 0) {
      const control = effect.control ?? 'STUN';
      const fresh = hostileTargets.filter((target) => !hasActiveControl(target, control)).length;
      score += coverageAdjustment(fresh, hostileTargets.length, 190, 260);
      pushReason(reasons, fresh > 0 ? 'control-window' : 'control-already-active');
    } else if (effect.kind === 'BREAK' && hostileTargets.length > 0) {
      const actionable = hostileTargets.filter((target) => !hasActiveControl(target, 'STUN')).length;
      const gaugePressure = Math.max(
        0,
        ...hostileTargets.map((target) => target.breakGauge / Math.max(1, target.bossState?.profile.breakThreshold ?? 100)),
      );
      score += coverageAdjustment(actionable, hostileTargets.length, 100 + Math.round(gaugePressure * 160), 230);
      pushReason(reasons, actionable > 0 ? 'break-progress' : 'break-already-controlled');
    } else if (effect.kind === 'SHIELD' && friendlyTargets.length > 0) {
      const fresh = friendlyTargets.filter((target) => target.shield < target.stats.maxHp * 0.25).length;
      score += coverageAdjustment(fresh, friendlyTargets.length, 150, 230);
      pushReason(reasons, fresh > 0 ? 'shield-window' : 'shield-already-active');
    } else if (effect.kind === 'STATUS' && effect.status) {
      if ((effect.status === 'STUN' || effect.status === 'SILENCE') && hostileTargets.length > 0) {
        const fresh = hostileTargets.filter((target) => !hasActiveControl(target, effect.status as 'STUN' | 'SILENCE')).length;
        score += coverageAdjustment(fresh, hostileTargets.length, 190, 260);
        pushReason(reasons, fresh > 0 ? 'control-window' : 'control-already-active');
      } else if (['BURN', 'CRACK', 'VULNERABLE', 'SLOW'].includes(effect.status) && hostileTargets.length > 0) {
        const fresh = hostileTargets.filter((target) => !hasActiveStatus(target, effect.status as string)).length;
        score += coverageAdjustment(fresh, hostileTargets.length, 150, 210);
        pushReason(reasons, fresh > 0 ? (effect.status === 'BURN' ? 'dot-window' : 'debuff-coverage') : effect.status === 'BURN' ? 'dot-already-active' : 'debuff-already-active');
      } else if (effect.status === 'REGENERATION' && friendlyTargets.length > 0) {
        const fresh = friendlyTargets.filter((target) => !hasActiveStatus(target, effect.status as string) && target.hp < target.stats.maxHp).length;
        score += coverageAdjustment(fresh, friendlyTargets.length, 130, 190);
        pushReason(reasons, fresh > 0 ? 'buff-coverage' : 'buff-already-active');
      } else if (effect.status === 'SHIELD' && friendlyTargets.length > 0) {
        const fresh = friendlyTargets.filter((target) => !hasActiveStatus(target, effect.status as string) && target.shield < target.stats.maxHp * 0.25).length;
        score += coverageAdjustment(fresh, friendlyTargets.length, 150, 230);
        pushReason(reasons, fresh > 0 ? 'shield-window' : 'shield-already-active');
      }
    }
  }
  return score;
};

const scoreSkill = (
  state: Readonly<AdvancedBattleState>,
  actor: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
  strategy: AiStrategy,
): { score: number; reasons: string[] } => {
  const enemies = getLivingUnits(state, opposingSide(actor));
  const ally = lowestAlly(state, actor);
  const allyHpRatio = ally ? ally.hp / Math.max(1, ally.stats.maxHp) : 1;
  const hostileTargets = hostileTargetsForSkill(state, actor, skill, strategy);
  const boss = hostileTargets.find((enemy) => enemy.bossState);
  let score = skill.priority ?? 0;
  const reasons: string[] = [];

  score += strategyWeight(strategy, skill);
  if (actor.role === 'BREAKER' && hasTag(skill, 'BREAK')) score += 180;
  if (actor.role === 'GUARDIAN' && hasTag(skill, 'DEFENSE')) score += 180;
  if (hasTag(skill, 'HEAL')) {
    score += Math.round((1 - allyHpRatio) * 500);
    if (allyHpRatio <= 0.42) {
      score += 1_200;
      reasons.push('emergency-heal');
    } else if (allyHpRatio >= 0.98) {
      score -= 600;
    }
  }
  if (hasTag(skill, 'DEFENSE')) {
    const selfRatio = actor.hp / Math.max(1, actor.stats.maxHp);
    score += Math.round((1 - selfRatio) * 250);
    if (actor.shield > actor.stats.maxHp * 0.4) score -= 300;
  }
  if ((skill.ultimateCost ?? 0) > 0) {
    score += 900;
    pushReason(reasons, 'ready-ultimate');
  } else if (strategy === 'RESOURCE_SAVE') {
    pushReason(reasons, 'resource-conservation');
  }
  if (skill.target === 'ALL_ENEMIES') {
    score += enemies.length * 90;
    if (enemies.length >= 3) {
      score += 320;
      pushReason(reasons, 'multi-target');
    } else if (enemies.length === 1) {
      score -= 100;
    }
  }
  if (boss && (strategy === 'BOSS_HUNTER' || strategy === 'BOSS_FOCUS') && (skill.target === 'ENEMY' || skill.target === 'BOSS')) {
    score += 420;
    pushReason(reasons, 'boss-focus');
  }
  if (boss && (hasTag(skill, 'BREAK') || hasTag(skill, 'CONTROL')) && !hasActiveControl(boss, 'STUN')) {
    score += 260;
    pushReason(reasons, 'break-window');
  }

  score += scoreEffectContext(state, actor, skill, strategy, reasons);

  if (hostileTargets.length > 0) {
    const elementScores = hostileTargets.map((target) => elementContext(actor, skill, target));
    score += Math.round(elementScores.reduce((total, context) => total + context.score, 0) / hostileTargets.length);
    for (const context of elementScores) if (context.reason) pushReason(reasons, context.reason);

    const usesAccuracy = skill.effects.some((effect) => !['HEAL', 'SHIELD', 'BUFF', 'COUNTER', 'ULTIMATE_GAIN'].includes(effect.kind));
    if (usesAccuracy) {
      const accuracy = getEffectiveStat(actor, 'accuracy');
      const resistance = hostileTargets.reduce((total, target) => total + getEffectiveStat(target, 'resistance'), 0) / hostileTargets.length;
      const pressure = Math.round(((accuracy - resistance) / Math.max(200, accuracy + resistance + 200)) * 300);
      score += Math.max(-180, Math.min(60, pressure));
      if (resistance > accuracy) pushReason(reasons, 'target-resistance');
    }
  }

  const activeBosses = hostileTargets.filter((target) => target.bossState);
  if (activeBosses.some((target) => (target.bossState?.triggeredPhaseIds.length ?? 0) > 0)) {
    const phaseCount = Math.max(...activeBosses.map((target) => target.bossState?.triggeredPhaseIds.length ?? 0));
    const phasePressure =
      (hasTag(skill, 'ATTACK') ? 70 : 0) +
      (hasTag(skill, 'BREAK') || hasTag(skill, 'CONTROL') ? 130 : 0) +
      (hasTag(skill, 'ULTIMATE') ? 100 : 0) +
      Math.min(90, phaseCount * 30);
    if (phasePressure > 0) {
      score += phasePressure;
      pushReason(reasons, 'boss-phase-active');
    }
  }
  if (activeBosses.some((target) => target.bossState?.enraged)) {
    const enragePressure =
      (hasTag(skill, 'ATTACK') ? 100 : 0) +
      (hasTag(skill, 'BREAK') || hasTag(skill, 'CONTROL') ? 240 : 0) +
      (hasTag(skill, 'ULTIMATE') ? 420 : 0) +
      (hasTag(skill, 'HEAL') || hasTag(skill, 'DEFENSE') ? 120 : 0);
    if (enragePressure > 0) {
      score += enragePressure;
      pushReason(reasons, 'boss-enraged');
    }
  }
  return { score, reasons };
};

const commandForSkill = (
  state: Readonly<AdvancedBattleState>,
  actor: AdvancedCombatant,
  skill: AdvancedSkillDefinition,
  strategy: AiStrategy,
): CombatCommand => {
  if (skill.target === 'ALLY_LOWEST') {
    const ally = lowestAlly(state, actor);
    return { actorId: actor.id, skillId: skill.id, targetIds: ally ? [ally.id] : undefined };
  }
  if (skill.target === 'ENEMY' || skill.target === 'BOSS') {
    const enemy = selectEnemy(state, actor, skill.target === 'BOSS' ? 'BOSS_HUNTER' : strategy, skill);
    return { actorId: actor.id, skillId: skill.id, targetIds: enemy ? [enemy.id] : undefined };
  }
  return { actorId: actor.id, skillId: skill.id };
};

export const explainAiDecision = (
  state: Readonly<AdvancedBattleState>,
  actorId: string,
  strategy: AiStrategy,
  rng: RandomSource,
): AiDecision => {
  if (!acceptedStrategies.includes(strategy)) throw new RangeError(`Unknown AI strategy ${String(strategy)}`);
  const actor = state.units.find((unit) => unit.id === actorId);
  if (!actor?.alive || state.outcome) return { command: null, score: Number.NEGATIVE_INFINITY, reasons: ['actor-unavailable'] };
  const scored = getUsableSkills(state, actorId).map((skill) => ({ skill, ...scoreSkill(state, actor, skill, strategy) }));
  if (scored.length === 0) return { command: null, score: Number.NEGATIVE_INFINITY, reasons: ['no-usable-skill'] };
  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const finalists = scored.filter((entry) => entry.score === bestScore).sort((left, right) => left.skill.id.localeCompare(right.skill.id));
  // Keep the RandomSource parameter for CommandProvider compatibility, but never make a blind random choice.
  // Equal contextual scores resolve by stable skill id so manual replay and auto replay agree across seeds.
  void rng;
  const selected = finalists[0];
  if (!selected) return { command: null, score: Number.NEGATIVE_INFINITY, reasons: ['no-usable-skill'] };
  return { command: commandForSkill(state, actor, selected.skill, strategy), score: selected.score, reasons: selected.reasons };
};

export const selectAiCommand = (
  state: Readonly<AdvancedBattleState>,
  actorId: string,
  strategy: AiStrategy,
  rng: RandomSource,
): CombatCommand | null => explainAiDecision(state, actorId, strategy, rng).command;

export const createAutoCommandProvider = (
  strategy: AiStrategy | ((actor: AdvancedCombatant) => AiStrategy) = 'BALANCED',
): CommandProvider => (state, actorId, rng) => {
  const actor = state.units.find((unit) => unit.id === actorId);
  if (!actor) return null;
  return selectAiCommand(state, actorId, typeof strategy === 'function' ? strategy(actor) : strategy, rng);
};
