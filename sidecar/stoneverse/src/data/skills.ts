import type { SkillDefinition } from '../domain/types';

export const SKILLS: readonly SkillDefinition[] = [
  {
    id: 'skill_stone_strike', name: 'Stone Strike', description: 'A reliable physical impact.', element: 'EARTH',
    target: 'ENEMY', cooldown: 0, ultimateCost: 0, priority: 0,
    effects: [{ type: 'DAMAGE', power: 0.9 }], tags: ['basic'],
  },
  {
    id: 'skill_ember_lance', name: 'Ember Lance', description: 'Pierces a target and may ignite it.', element: 'FIRE',
    target: 'ENEMY', cooldown: 2, ultimateCost: 0, priority: 1,
    effects: [{ type: 'DAMAGE', power: 1.25 }, { type: 'STATUS', statusId: 'BURN', chance: 0.35, value: 0.08, duration: 2 }], tags: ['attack'],
  },
  {
    id: 'skill_magma_cataclysm', name: 'Magma Cataclysm', description: 'An ultimate eruption against all enemies.', element: 'FIRE',
    target: 'ALL_ENEMIES', cooldown: 0, ultimateCost: 100, priority: 5,
    effects: [{ type: 'DAMAGE', power: 1.85 }, { type: 'STATUS', statusId: 'BURN', chance: 0.65, value: 0.1, duration: 3 }], tags: ['ultimate', 'rare'],
  },
  {
    id: 'skill_tidal_cut', name: 'Tidal Cut', description: 'A fast water-edged strike.', element: 'WATER',
    target: 'ENEMY', cooldown: 1, ultimateCost: 0, priority: 2,
    effects: [{ type: 'DAMAGE', power: 1.08 }, { type: 'ULTIMATE_GAIN', value: 8 }], tags: ['attack'],
  },
  {
    id: 'skill_crystal_mend', name: 'Crystal Mend', description: 'Restorative resonance heals the weakest ally.', element: 'CRYSTAL',
    target: 'ALLY', cooldown: 2, ultimateCost: 0, priority: 3,
    effects: [{ type: 'HEAL', power: 1.15 }, { type: 'STATUS', statusId: 'REGEN', chance: 1, value: 0.06, duration: 2 }], tags: ['support'],
  },
  {
    id: 'skill_bastion', name: 'Bastion', description: 'Hardens the caster and raises a shield.', element: 'EARTH',
    target: 'SELF', cooldown: 2, ultimateCost: 0, priority: 4,
    effects: [{ type: 'BUFF', stat: 'defense', value: 0.25, duration: 2 }, { type: 'SHIELD', power: 0.75 }], tags: ['tank'],
  },
  {
    id: 'skill_resonant_chorus', name: 'Resonant Chorus', description: 'Empowers the whole formation.', element: 'CRYSTAL',
    target: 'ALL_ALLIES', cooldown: 3, ultimateCost: 0, priority: 4,
    effects: [{ type: 'BUFF', stat: 'power', value: 0.18, duration: 3 }, { type: 'BUFF', stat: 'resonance', value: 0.18, duration: 3 }], tags: ['support'],
  },
  {
    id: 'skill_gale_shard', name: 'Gale Shard', description: 'A swift projectile that fractures defenses.', element: 'WIND',
    target: 'ENEMY', cooldown: 1, ultimateCost: 0, priority: 2,
    effects: [{ type: 'DAMAGE', power: 1.05 }, { type: 'DEBUFF', stat: 'defense', value: -0.16, duration: 2 }], tags: ['control'],
  },
  {
    id: 'skill_void_grip', name: 'Void Grip', description: 'Dark pressure with a chance to stun.', element: 'DARK',
    target: 'ENEMY', cooldown: 3, ultimateCost: 0, priority: 4,
    effects: [{ type: 'DAMAGE', power: 0.85 }, { type: 'STATUS', statusId: 'STUN', chance: 0.32, value: 0, duration: 1 }], tags: ['control'],
  },
  {
    id: 'skill_solar_verdict', name: 'Solar Verdict', description: 'A radiant ultimate that judges every enemy.', element: 'LIGHT',
    target: 'ALL_ENEMIES', cooldown: 0, ultimateCost: 100, priority: 5,
    effects: [{ type: 'DAMAGE', power: 1.65 }, { type: 'DEBUFF', stat: 'power', value: -0.18, duration: 2 }], tags: ['ultimate'],
  },
  {
    id: 'skill_iron_taunt', name: 'Iron Challenge', description: 'Provokes enemies while reinforcing defense.', element: 'METAL',
    target: 'SELF', cooldown: 3, ultimateCost: 0, priority: 5,
    effects: [{ type: 'STATUS', statusId: 'TAUNT', chance: 1, value: 0, duration: 2 }, { type: 'BUFF', stat: 'defense', value: 0.35, duration: 2 }], tags: ['tank'],
  },
  {
    id: 'skill_quake', name: 'Faultline Quake', description: 'Shakes all enemies and opens fractures.', element: 'EARTH',
    target: 'ALL_ENEMIES', cooldown: 3, ultimateCost: 0, priority: 2,
    effects: [{ type: 'DAMAGE', power: 0.82 }, { type: 'STATUS', statusId: 'FRACTURE', chance: 0.45, value: 0.15, duration: 2 }], tags: ['attack'],
  },
  {
    id: 'skill_ancient_echo', name: 'Ancient Echo', description: 'Timeless resonance damages and delays foes.', element: 'ANCIENT',
    target: 'ALL_ENEMIES', cooldown: 4, ultimateCost: 0, priority: 3,
    effects: [{ type: 'DAMAGE', power: 1.1 }, { type: 'DEBUFF', stat: 'speed', value: -0.2, duration: 2 }], tags: ['control', 'rare'],
  },
  {
    id: 'skill_prismatic_nova', name: 'Prismatic Nova', description: 'A spectrum-shattering ultimate.', element: 'CRYSTAL',
    target: 'ALL_ENEMIES', cooldown: 0, ultimateCost: 100, priority: 6,
    effects: [{ type: 'DAMAGE', power: 2.05 }, { type: 'ULTIMATE_GAIN', value: 10 }], tags: ['ultimate', 'legendary'],
  },
  {
    id: 'skill_moonlit_aegis', name: 'Moonlit Aegis', description: 'A grand barrier for the whole team.', element: 'LIGHT',
    target: 'ALL_ALLIES', cooldown: 4, ultimateCost: 100, priority: 7,
    effects: [{ type: 'SHIELD', power: 1.2 }, { type: 'HEAL', power: 0.75 }], tags: ['ultimate', 'support'],
  },
] as const;

export const SKILL_BY_ID: Readonly<Record<string, SkillDefinition>> = Object.freeze(
  Object.fromEntries(SKILLS.map((definition) => [definition.id, definition])),
);

