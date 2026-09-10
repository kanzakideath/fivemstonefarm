import { SKILL_BY_ID, SPECIES_BY_ID, TRAIT_BY_ID } from '../data';
import type { EquipmentSetId, EquipmentSourceStat, SkillDefinition, SkillEffect as CoreSkillEffect, StoneInstance } from './types';
import {
  STANDARD_ADVANCED_SKILLS,
  type AdvancedSkillDefinition,
  type CombatEffectKind,
  type CombatRole,
  type CombatStatKey,
  type CombatantTemplate,
  type SkillEffect,
} from './advanced';

const coreStatMap: Record<string, CombatStatKey> = {
  maxHp: 'maxHp', power: 'attack', defense: 'defense', hardness: 'defense', purity: 'resistance',
  speed: 'speed', resonance: 'breakPower',
};

const EQUIPMENT_SET_IDS: readonly EquipmentSetId[] = ['BASTION', 'RESONANCE', 'HUNTER', 'ABYSSAL'];

const equipmentSetId = (item: NonNullable<StoneInstance['equipment'][keyof StoneInstance['equipment']]>): EquipmentSetId | null =>
  item.setId ?? EQUIPMENT_SET_IDS.find((id) => item.definitionId.startsWith(`${id}_`)) ?? null;

const applyRatio = (value: number, ratio: number): number => value * (1 + ratio);

const roleForStone = (stone: StoneInstance): CombatRole => {
  const tags = stone.skills.flatMap((entry) => SKILL_BY_ID[entry.skillId]?.tags ?? []);
  if (tags.includes('support')) return 'SUPPORT';
  if (tags.includes('control') && stone.stats.speed >= stone.stats.power) return 'CONTROLLER';
  if (tags.some((tag) => tag === 'break') || stone.traitIds.some((id) => /fract|break/i.test(id))) return 'BREAKER';
  const role = SPECIES_BY_ID[stone.speciesId]?.role;
  if (role === 'TANK') return 'GUARDIAN';
  if (role === 'SUPPORT') return 'SUPPORT';
  if (role === 'CONTROL') return 'CONTROLLER';
  return stone.stats.defense > stone.stats.power * 1.2 ? 'VANGUARD' : 'STRIKER';
};

const effectKind = (effect: CoreSkillEffect): CombatEffectKind => effect.type;

const mapStatus = (status: CoreSkillEffect['statusId']): SkillEffect => {
  if (status === 'BURN') return { kind: 'STATUS', status: 'BURN' };
  if (status === 'FRACTURE') return { kind: 'STATUS', status: 'CRACK' };
  if (status === 'STUN') return { kind: 'STATUS', status: 'STUN' };
  if (status === 'REGEN') return { kind: 'STATUS', status: 'REGENERATION' };
  if (status === 'TAUNT') return { kind: 'CONTROL', control: 'TAUNT' };
  return { kind: 'STATUS', status: 'VULNERABLE' };
};

const mapEffect = (effect: CoreSkillEffect): SkillEffect => {
  const status = effect.type === 'STATUS' ? mapStatus(effect.statusId) : undefined;
  const mapped: SkillEffect = {
    kind: status?.kind ?? effectKind(effect),
    power: effect.power ?? (effect.type === 'STATUS' ? effect.value : undefined),
    value: effect.value === undefined ? undefined : Math.abs(effect.value),
    duration: effect.duration,
    chance: effect.chance,
    stat: effect.stat ? coreStatMap[effect.stat] : undefined,
    control: status?.control,
    status: status?.status,
  };
  return mapped;
};

export const adaptSkillForAdvancedCombat = (skill: SkillDefinition): AdvancedSkillDefinition => ({
  id: skill.id,
  name: skill.name,
  target: skill.target === 'ALLY' ? 'ALLY_LOWEST' : skill.target,
  element: skill.element,
  effects: skill.effects.flatMap((effect) => [
    mapEffect(effect),
    ...(effect.type === 'STATUS' && effect.statusId === 'FRACTURE'
      ? [{ kind: 'BREAK' as const, power: 0.65, value: 15, chance: effect.chance }]
      : []),
  ]),
  cooldown: skill.cooldown,
  ultimateCost: skill.ultimateCost,
  priority: skill.priority,
  tags: [
    ...(skill.tags.includes('attack') || skill.effects.some((effect) => effect.type === 'DAMAGE') ? ['ATTACK' as const] : []),
    ...(skill.tags.includes('support') || skill.effects.some((effect) => effect.type === 'HEAL') ? ['HEAL' as const] : []),
    ...(skill.tags.includes('tank') || skill.effects.some((effect) => effect.type === 'SHIELD') ? ['DEFENSE' as const] : []),
    ...(skill.tags.includes('control') || skill.effects.some((effect) => effect.type === 'STATUS' || effect.type === 'DEBUFF') ? ['CONTROL' as const] : []),
    ...(skill.tags.includes('break') || skill.effects.some((effect) => effect.type === 'STATUS' && effect.statusId === 'FRACTURE') ? ['BREAK' as const] : []),
    ...(skill.tags.includes('ultimate') ? ['ULTIMATE' as const] : []),
  ],
});

/** Builds a combatant from the real Stone Instance; no summary CP shortcut is used. */
export const stoneToAdvancedCombatant = (stone: StoneInstance, side: 'PLAYER' | 'ENEMY' = 'PLAYER'): CombatantTemplate => {
  const species = SPECIES_BY_ID[stone.speciesId];
  const mutationScale = stone.mutation === 'PERFECT' ? 1.08 : stone.mutation === 'ANCIENT' || stone.mutation === 'PRISMATIC' ? 1.04 : 1;
  const affinityScale = 1 + Math.min(0.07, stone.affinity.rank * 0.01);
  const equipped = Object.values(stone.equipment).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const learned = stone.skills.map((entry) => SKILL_BY_ID[entry.skillId]).filter((skill): skill is SkillDefinition => Boolean(skill));
  const skillIds = learned.map((skill) => skill.id);
  if (!skillIds.length) skillIds.push('strike');
  const lineageFamily = stone.parents[0]?.speciesId ? `lineage:${stone.parents[0].speciesId}` : species?.family;
  const stats = {
    maxHp: Math.max(1, stone.stats.maxHp * mutationScale * affinityScale),
    attack: Math.max(1, stone.stats.power * mutationScale * affinityScale),
    defense: Math.max(1, (stone.stats.defense + stone.stats.hardness * 0.2) * mutationScale * affinityScale),
    speed: Math.max(1, stone.stats.speed * (1 + stone.individualValues.speed / 310)),
    accuracy: Math.max(1, 92 + stone.individualValues.purity * 1.2 + stone.stats.purity * 0.08),
    resistance: Math.max(1, 82 + stone.individualValues.hardness + stone.stats.hardness * 0.12),
    critChance: Math.min(0.65, 0.05 + stone.potential / 1_000 + stone.individualValues.power / 620),
    critDamage: Math.min(3, 1.45 + stone.individualValues.power / 155),
    breakPower: Math.max(1, 15 + stone.stats.resonance * 0.22 + stone.individualValues.resonance * 0.7),
  };
  for (const traitId of stone.traitIds) {
    for (const effect of TRAIT_BY_ID[traitId]?.effects ?? []) {
      if ((effect.trigger !== 'ALWAYS' && effect.trigger !== 'BATTLE_START') || !effect.stat || effect.value === undefined) continue;
      const target = coreStatMap[effect.stat];
      if (!target) continue;
      if (target === 'critChance' || target === 'critDamage') continue;
      stats[target] = Math.max(1, effect.operation === 'PERCENT' ? applyRatio(stats[target], effect.value) : stats[target] + effect.value);
    }
  }
  let ultimateFromEquipment = 0;
  for (const item of equipped) {
    for (const affix of item.affixes) {
      const source: EquipmentSourceStat = affix.sourceStat ?? (
        affix.stat === 'power' ? 'attack'
          : affix.stat === 'purity' ? 'accuracy'
            : affix.stat === 'hardness' ? 'resistance'
              : affix.stat === 'resonance' ? 'breakPower'
                : affix.stat
      );
      const ratio = affix.operation === 'PERCENT';
      if (source === 'maxHp' || source === 'attack' || source === 'defense' || source === 'speed' || source === 'accuracy' || source === 'resistance' || source === 'breakPower') {
        stats[source] = Math.max(1, ratio ? applyRatio(stats[source], affix.value) : stats[source] + affix.value);
      } else if (source === 'critChance') {
        stats.critChance = Math.max(0, stats.critChance + (ratio ? affix.value : affix.value / 100));
      } else {
        stats.critDamage = Math.max(1, stats.critDamage + (ratio ? affix.value : affix.value / 100));
      }
    }
  }
  const setCounts = new Map<EquipmentSetId, number>();
  for (const item of equipped) {
    const setId = equipmentSetId(item);
    if (setId) setCounts.set(setId, (setCounts.get(setId) ?? 0) + 1);
  }
  if ((setCounts.get('BASTION') ?? 0) >= 2) stats.defense = applyRatio(stats.defense, 0.12);
  if ((setCounts.get('BASTION') ?? 0) >= 4) stats.maxHp = applyRatio(stats.maxHp, 0.2);
  if ((setCounts.get('RESONANCE') ?? 0) >= 2) ultimateFromEquipment += 12;
  if ((setCounts.get('RESONANCE') ?? 0) >= 4) stats.speed = applyRatio(stats.speed, 0.15);
  if ((setCounts.get('HUNTER') ?? 0) >= 2) stats.critChance += 0.1;
  if ((setCounts.get('HUNTER') ?? 0) >= 4) stats.critDamage += 0.35;
  if ((setCounts.get('ABYSSAL') ?? 0) >= 2) stats.breakPower = applyRatio(stats.breakPower, 0.15);
  if ((setCounts.get('ABYSSAL') ?? 0) >= 4) stats.attack = applyRatio(stats.attack, 0.18);

  return {
    id: stone.instanceId,
    name: stone.nickname || stone.name,
    side,
    role: roleForStone(stone),
    family: lineageFamily,
    element: stone.primaryElement,
    level: stone.level,
    stats: {
      maxHp: Math.round(stats.maxHp), attack: Math.round(stats.attack), defense: Math.round(stats.defense), speed: Math.round(stats.speed),
      accuracy: Math.round(stats.accuracy), resistance: Math.round(stats.resistance),
      critChance: Math.min(0.95, stats.critChance), critDamage: Math.min(5, stats.critDamage), breakPower: Math.round(stats.breakPower),
    },
    skillIds,
    initialUltimate: Math.min(100, stone.affinity.rank * 4 + stone.awakeningStage * 3 + ultimateFromEquipment),
  };
};

export const buildStoneCombatSkillBook = (stones: readonly StoneInstance[]): Readonly<Record<string, AdvancedSkillDefinition>> => {
  const learned = stones.flatMap((stone) => stone.skills).map((entry) => SKILL_BY_ID[entry.skillId]).filter((skill): skill is SkillDefinition => Boolean(skill));
  return Object.freeze({
    ...STANDARD_ADVANCED_SKILLS,
    ...Object.fromEntries(learned.map((skill) => [skill.id, adaptSkillForAdvancedCombat(skill)])),
  });
};
