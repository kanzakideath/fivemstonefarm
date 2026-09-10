import type { SkillTreeNode, Stats, StoneSpeciesDefinition } from '../domain/types';

const stats = (
  hardness: number,
  purity: number,
  power: number,
  defense: number,
  speed: number,
  resonance: number,
  maxHp: number,
): Stats => ({ hardness, purity, power, defense, speed, resonance, maxHp });

const growth = (base: Stats, scale: number): StoneSpeciesDefinition['growth'] => ({
  base,
  perLevel: {
    hardness: 0.42 * scale,
    purity: 0.36 * scale,
    power: 0.64 * scale,
    defense: 0.58 * scale,
    speed: 0.38 * scale,
    resonance: 0.54 * scale,
    maxHp: 5.8 * scale,
  },
});

const standardTree = (prefix: string, elementSkill: string): SkillTreeNode[] => [
  { id: `${prefix}_attack_1`, branch: 'ATTACK', cost: 1, prerequisites: [], statBonus: { power: 4 } },
  { id: `${prefix}_attack_2`, branch: 'ATTACK', cost: 2, prerequisites: [`${prefix}_attack_1`], statBonus: { power: 7 } },
  { id: `${prefix}_defense_1`, branch: 'DEFENSE', cost: 1, prerequisites: [], statBonus: { defense: 4, maxHp: 25 } },
  { id: `${prefix}_support_1`, branch: 'SUPPORT', cost: 1, prerequisites: [], statBonus: { resonance: 4 } },
  { id: `${prefix}_critical_1`, branch: 'CRITICAL', cost: 2, prerequisites: [`${prefix}_attack_1`], statBonus: { purity: 6 } },
  { id: `${prefix}_element_1`, branch: 'ELEMENT', cost: 3, prerequisites: [`${prefix}_support_1`], grantsSkillId: elementSkill },
];

export const SPECIES: readonly StoneSpeciesDefinition[] = [
  {
    id: 'species_pebblit', name: 'Pebblit', description: 'A lively fieldstone whose humble core holds surprising promise.',
    rarity: 'NORMAL', family: 'terra', role: 'ATTACK', primaryElement: 'EARTH', possibleSecondaryElements: ['NEUTRAL', 'METAL'],
    growth: growth(stats(12, 8, 11, 10, 10, 8, 105), 0.82),
    skillPool: [{ skillId: 'skill_stone_strike', level: 1 }, { skillId: 'skill_quake', level: 18 }],
    traitPool: ['trait_dense_core', 'trait_keen_edge', 'trait_swift_fault'], hiddenTraitPool: ['trait_wild_vein'],
    naturalWeight: 5_000, gachaWeight: 3_800, minMiningLevel: 1, maxAwakening: 5,
    evolutions: [{ id: 'evo_pebblit_granitus', targetSpeciesId: 'species_granitus', conditions: [{ kind: 'LEVEL', value: 24 }, { kind: 'AFFINITY', value: 2 }], hidden: false, hint: 'Grow together until its core hardens.' }],
    skillTree: standardTree('pebblit', 'skill_quake'),
  },
  {
    id: 'species_granitus', name: 'Granitus', description: 'An enduring granite guardian tempered by companionship.',
    rarity: 'RARE', family: 'terra', role: 'TANK', primaryElement: 'EARTH', possibleSecondaryElements: ['METAL'],
    growth: growth(stats(22, 13, 17, 24, 10, 15, 175), 1.1),
    skillPool: [{ skillId: 'skill_stone_strike', level: 1 }, { skillId: 'skill_bastion', level: 1 }, { skillId: 'skill_quake', level: 28 }],
    traitPool: ['trait_dense_core', 'trait_last_bastion'], hiddenTraitPool: ['trait_wild_vein', 'trait_ancient_oath'],
    naturalWeight: 720, gachaWeight: 1_050, minMiningLevel: 8, maxAwakening: 5, evolutions: [],
    skillTree: standardTree('granitus', 'skill_quake'),
  },
  {
    id: 'species_quartzling', name: 'Quartzling', description: 'A clear crystal that remembers every vibration around it.',
    rarity: 'RARE', family: 'crystal', role: 'SUPPORT', primaryElement: 'CRYSTAL', possibleSecondaryElements: ['LIGHT', 'WATER'],
    growth: growth(stats(10, 22, 13, 12, 15, 23, 108), 0.98),
    skillPool: [{ skillId: 'skill_stone_strike', level: 1 }, { skillId: 'skill_crystal_mend', level: 10 }, { skillId: 'skill_resonant_chorus', level: 24 }],
    traitPool: ['trait_resonant', 'trait_swift_fault'], hiddenTraitPool: ['trait_crystal_memory', 'trait_wild_vein'],
    naturalWeight: 1_400, gachaWeight: 1_550, minMiningLevel: 4, maxAwakening: 5,
    evolutions: [
      { id: 'evo_quartz_prismara', targetSpeciesId: 'species_prismara', conditions: [{ kind: 'LEVEL', value: 36 }, { kind: 'AFFINITY', value: 3 }, { kind: 'SKILL', value: 'skill_resonant_chorus' }], hidden: false, hint: 'Master resonance beneath a brilliant light.' },
      { id: 'evo_quartz_eclipse', targetSpeciesId: 'species_eclipse_geode', conditions: [{ kind: 'LEVEL', value: 40 }, { kind: 'AREA', value: 'area_void_rift' }, { kind: 'ITEM', value: 'item_eclipse_shard', amount: 1 }], hidden: true, hint: 'A silent crystal waits where light is swallowed.' },
    ],
    skillTree: standardTree('quartzling', 'skill_resonant_chorus'),
  },
  {
    id: 'species_prismara', name: 'Prismara', description: 'A many-faceted oracle that bends possibility into color.',
    rarity: 'SSR', family: 'crystal', role: 'SUPPORT', primaryElement: 'CRYSTAL', possibleSecondaryElements: ['LIGHT', 'WIND'],
    growth: growth(stats(17, 35, 24, 19, 25, 37, 164), 1.35),
    skillPool: [{ skillId: 'skill_crystal_mend', level: 1 }, { skillId: 'skill_resonant_chorus', level: 1 }, { skillId: 'skill_prismatic_nova', level: 55 }],
    traitPool: ['trait_resonant', 'trait_first_light'], hiddenTraitPool: ['trait_crystal_memory', 'trait_prism_reflex'],
    naturalWeight: 20, gachaWeight: 120, minMiningLevel: 35, maxAwakening: 7, evolutions: [],
    skillTree: standardTree('prismara', 'skill_prismatic_nova'),
  },
  {
    id: 'species_emberite', name: 'Emberite', description: 'A volcanic stone with an impatient pulse.',
    rarity: 'SR', family: 'igneous', role: 'ATTACK', primaryElement: 'FIRE', possibleSecondaryElements: ['EARTH', 'DARK'],
    growth: growth(stats(16, 13, 25, 14, 18, 17, 122), 1.12),
    skillPool: [{ skillId: 'skill_stone_strike', level: 1 }, { skillId: 'skill_ember_lance', level: 8 }, { skillId: 'skill_magma_cataclysm', level: 42 }],
    traitPool: ['trait_keen_edge', 'trait_flame_soul'], hiddenTraitPool: ['trait_wild_vein'],
    naturalWeight: 470, gachaWeight: 800, minMiningLevel: 12, maxAwakening: 6,
    evolutions: [{ id: 'evo_ember_pyroclast', targetSpeciesId: 'species_pyroclast', conditions: [{ kind: 'LEVEL', value: 42 }, { kind: 'BATTLE_COUNT', value: 40 }, { kind: 'ITEM', value: 'item_magma_heart', amount: 2 }], hidden: false, hint: 'Temper its flame through battle.' }],
    skillTree: standardTree('emberite', 'skill_magma_cataclysm'),
  },
  {
    id: 'species_pyroclast', name: 'Pyroclast', description: 'A sovereign fragment of the world beneath the crust.',
    rarity: 'UR', family: 'igneous', role: 'ATTACK', primaryElement: 'FIRE', possibleSecondaryElements: ['ANCIENT'],
    growth: growth(stats(27, 22, 42, 25, 28, 30, 205), 1.58),
    skillPool: [{ skillId: 'skill_ember_lance', level: 1 }, { skillId: 'skill_quake', level: 1 }, { skillId: 'skill_magma_cataclysm', level: 1 }],
    traitPool: ['trait_flame_soul', 'trait_keen_edge'], hiddenTraitPool: ['trait_ancient_oath'],
    naturalWeight: 2, gachaWeight: 18, minMiningLevel: 60, maxAwakening: 7, evolutions: [],
    skillTree: standardTree('pyroclast', 'skill_magma_cataclysm'),
  },
  {
    id: 'species_aquamarite', name: 'Aquamarite', description: 'A tranquil mineral carrying the memory of ancient tides.',
    rarity: 'SR', family: 'crystal', role: 'SUPPORT', primaryElement: 'WATER', possibleSecondaryElements: ['CRYSTAL', 'WIND'],
    growth: growth(stats(13, 25, 16, 17, 21, 26, 132), 1.13),
    skillPool: [{ skillId: 'skill_tidal_cut', level: 1 }, { skillId: 'skill_crystal_mend', level: 12 }, { skillId: 'skill_resonant_chorus', level: 35 }],
    traitPool: ['trait_resonant', 'trait_swift_fault'], hiddenTraitPool: ['trait_crystal_memory'],
    naturalWeight: 520, gachaWeight: 820, minMiningLevel: 14, maxAwakening: 6, evolutions: [],
    skillTree: standardTree('aquamarite', 'skill_crystal_mend'),
  },
  {
    id: 'species_zephyrite', name: 'Zephyrite', description: 'A light geode that hums just before a storm.',
    rarity: 'SR', family: 'aerial', role: 'CONTROL', primaryElement: 'WIND', possibleSecondaryElements: ['CRYSTAL', 'LIGHT'],
    growth: growth(stats(10, 19, 20, 11, 31, 21, 112), 1.1),
    skillPool: [{ skillId: 'skill_stone_strike', level: 1 }, { skillId: 'skill_gale_shard', level: 7 }, { skillId: 'skill_resonant_chorus', level: 34 }],
    traitPool: ['trait_swift_fault', 'trait_first_light'], hiddenTraitPool: ['trait_crystal_memory'],
    naturalWeight: 430, gachaWeight: 790, minMiningLevel: 16, maxAwakening: 6, evolutions: [],
    skillTree: standardTree('zephyrite', 'skill_gale_shard'),
  },
  {
    id: 'species_ironwarden', name: 'Ironwarden', description: 'A sentient ore plate that interposes itself without hesitation.',
    rarity: 'SSR', family: 'metal', role: 'TANK', primaryElement: 'METAL', possibleSecondaryElements: ['EARTH', 'FIRE'],
    growth: growth(stats(36, 15, 21, 40, 11, 18, 232), 1.42),
    skillPool: [{ skillId: 'skill_stone_strike', level: 1 }, { skillId: 'skill_bastion', level: 1 }, { skillId: 'skill_iron_taunt', level: 20 }],
    traitPool: ['trait_dense_core', 'trait_last_bastion'], hiddenTraitPool: ['trait_ancient_oath', 'trait_wild_vein'],
    naturalWeight: 26, gachaWeight: 140, minMiningLevel: 33, maxAwakening: 7, evolutions: [],
    skillTree: standardTree('ironwarden', 'skill_iron_taunt'),
  },
  {
    id: 'species_eclipse_geode', name: 'Eclipse Geode', description: 'A forbidden geode whose hollow contains a starless sky.',
    rarity: 'UR', family: 'void', role: 'CONTROL', primaryElement: 'DARK', possibleSecondaryElements: ['CRYSTAL', 'ANCIENT'],
    growth: growth(stats(24, 34, 38, 26, 35, 40, 196), 1.62),
    skillPool: [{ skillId: 'skill_void_grip', level: 1 }, { skillId: 'skill_ancient_echo', level: 24 }, { skillId: 'skill_prismatic_nova', level: 60 }],
    traitPool: ['trait_gene_weaver', 'trait_first_light'], hiddenTraitPool: ['trait_crystal_memory', 'trait_prism_reflex'],
    naturalWeight: 0, gachaWeight: 12, minMiningLevel: 70, maxAwakening: 7, evolutions: [],
    skillTree: standardTree('eclipse', 'skill_prismatic_nova'),
  },
  {
    id: 'species_solaris', name: 'Solaris Heart', description: 'A stellar jewel condensed from unspent dawns.',
    rarity: 'UR', family: 'celestial', role: 'ATTACK', primaryElement: 'LIGHT', possibleSecondaryElements: ['FIRE', 'CRYSTAL'],
    growth: growth(stats(26, 40, 43, 24, 33, 39, 188), 1.64),
    skillPool: [{ skillId: 'skill_stone_strike', level: 1 }, { skillId: 'skill_resonant_chorus', level: 20 }, { skillId: 'skill_solar_verdict', level: 48 }],
    traitPool: ['trait_keen_edge', 'trait_first_light'], hiddenTraitPool: ['trait_crystal_memory'],
    naturalWeight: 3, gachaWeight: 24, minMiningLevel: 58, maxAwakening: 7, evolutions: [],
    skillTree: standardTree('solaris', 'skill_solar_verdict'),
  },
  {
    id: 'species_worldheart', name: 'Worldheart Monolith', description: 'A legendary cornerstone said to remember the first mountain.',
    rarity: 'LEGENDARY', family: 'ancient', role: 'TANK', primaryElement: 'ANCIENT', possibleSecondaryElements: ['EARTH', 'LIGHT'],
    growth: growth(stats(52, 44, 46, 55, 27, 50, 315), 2.05),
    skillPool: [{ skillId: 'skill_bastion', level: 1 }, { skillId: 'skill_ancient_echo', level: 1 }, { skillId: 'skill_moonlit_aegis', level: 1 }],
    traitPool: ['trait_last_bastion', 'trait_resonant'], hiddenTraitPool: ['trait_ancient_oath', 'trait_wild_vein'],
    naturalWeight: 0.08, gachaWeight: 1, minMiningLevel: 90, maxAwakening: 10, evolutions: [],
    skillTree: standardTree('worldheart', 'skill_moonlit_aegis'),
  },
] as const;

export const SPECIES_BY_ID: Readonly<Record<string, StoneSpeciesDefinition>> = Object.freeze(
  Object.fromEntries(SPECIES.map((definition) => [definition.id, definition])),
);
