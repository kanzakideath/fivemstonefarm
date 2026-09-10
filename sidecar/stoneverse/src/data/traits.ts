import type { TraitDefinition } from '../domain/types';

export const TRAITS: readonly TraitDefinition[] = [
  { id: 'trait_dense_core', name: 'Dense Core', description: 'Defense +10%.', tier: 'COMMON', tags: ['tank'], effects: [{ trigger: 'ALWAYS', stat: 'defense', operation: 'PERCENT', value: 0.1 }] },
  { id: 'trait_keen_edge', name: 'Keen Edge', description: 'Power +8%.', tier: 'COMMON', tags: ['attack'], effects: [{ trigger: 'ALWAYS', stat: 'power', operation: 'PERCENT', value: 0.08 }] },
  { id: 'trait_resonant', name: 'Resonant Heart', description: 'Resonance +12%.', tier: 'COMMON', tags: ['support'], effects: [{ trigger: 'ALWAYS', stat: 'resonance', operation: 'PERCENT', value: 0.12 }] },
  { id: 'trait_swift_fault', name: 'Swift Fault', description: 'Speed +10%.', tier: 'COMMON', tags: ['speed'], effects: [{ trigger: 'ALWAYS', stat: 'speed', operation: 'PERCENT', value: 0.1 }] },
  { id: 'trait_last_bastion', name: 'Last Bastion', description: 'Greatly raises defense below 30% HP.', tier: 'RARE', tags: ['tank'], effects: [{ trigger: 'LOW_HP', stat: 'defense', operation: 'PERCENT', value: 0.35 }] },
  { id: 'trait_flame_soul', name: 'Flame Soul', description: 'Amplifies fire techniques.', tier: 'RARE', tags: ['element', 'fire'], effects: [{ trigger: 'ALWAYS', stat: 'power', operation: 'PERCENT', value: 0.13, element: 'FIRE' }] },
  { id: 'trait_crystal_memory', name: 'Crystal Memory', description: 'Critical actions resonate more strongly.', tier: 'HIDDEN', tags: ['critical'], effects: [{ trigger: 'ON_CRIT', stat: 'resonance', operation: 'PERCENT', value: 0.18 }] },
  { id: 'trait_first_light', name: 'First Light', description: 'Starts battle with heightened speed.', tier: 'RARE', tags: ['speed'], effects: [{ trigger: 'BATTLE_START', stat: 'speed', operation: 'PERCENT', value: 0.25 }] },
  { id: 'trait_wild_vein', name: 'Wild Vein', description: 'A mark found only in naturally mined stones.', tier: 'NATURAL_EXCLUSIVE', tags: ['natural'], effects: [{ trigger: 'ALWAYS', stat: 'purity', operation: 'PERCENT', value: 0.14 }] },
  { id: 'trait_gene_weaver', name: 'Gene Weaver', description: 'A rare signature born from fusion.', tier: 'FUSION_EXCLUSIVE', tags: ['fusion'], effects: [{ trigger: 'ALWAYS', stat: 'resonance', operation: 'PERCENT', value: 0.18 }] },
  { id: 'trait_ancient_oath', name: 'Ancient Oath', description: 'A primordial promise of endurance.', tier: 'HIDDEN', tags: ['ancient'], effects: [{ trigger: 'ALWAYS', stat: 'maxHp', operation: 'PERCENT', value: 0.16 }] },
  { id: 'trait_prism_reflex', name: 'Prism Reflex', description: 'Prismatic light sharpens every motion.', tier: 'HIDDEN', tags: ['mutation'], effects: [{ trigger: 'ALWAYS', stat: 'speed', operation: 'PERCENT', value: 0.12 }, { trigger: 'ALWAYS', stat: 'resonance', operation: 'PERCENT', value: 0.12 }] },
] as const;

export const TRAIT_BY_ID: Readonly<Record<string, TraitDefinition>> = Object.freeze(
  Object.fromEntries(TRAITS.map((definition) => [definition.id, definition])),
);

