const $e = (e, t, n, r, i, s, o) => ({ hardness: e, purity: t, power: n, defense: r, speed: i, resonance: s, maxHp: o }), Pe = (e, t) => ({
  base: e,
  perLevel: {
    hardness: 0.42 * t,
    purity: 0.36 * t,
    power: 0.64 * t,
    defense: 0.58 * t,
    speed: 0.38 * t,
    resonance: 0.54 * t,
    maxHp: 5.8 * t
  }
}), Fe = (e, t) => [
  { id: `${e}_attack_1`, branch: "ATTACK", cost: 1, prerequisites: [], statBonus: { power: 4 } },
  { id: `${e}_attack_2`, branch: "ATTACK", cost: 2, prerequisites: [`${e}_attack_1`], statBonus: { power: 7 } },
  { id: `${e}_defense_1`, branch: "DEFENSE", cost: 1, prerequisites: [], statBonus: { defense: 4, maxHp: 25 } },
  { id: `${e}_support_1`, branch: "SUPPORT", cost: 1, prerequisites: [], statBonus: { resonance: 4 } },
  { id: `${e}_critical_1`, branch: "CRITICAL", cost: 2, prerequisites: [`${e}_attack_1`], statBonus: { purity: 6 } },
  { id: `${e}_element_1`, branch: "ELEMENT", cost: 3, prerequisites: [`${e}_support_1`], grantsSkillId: t }
], Bt = [
  {
    id: "species_pebblit",
    name: "Pebblit",
    description: "A lively fieldstone whose humble core holds surprising promise.",
    rarity: "NORMAL",
    family: "terra",
    role: "ATTACK",
    primaryElement: "EARTH",
    possibleSecondaryElements: ["NEUTRAL", "METAL"],
    growth: Pe($e(12, 8, 11, 10, 10, 8, 105), 0.82),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_quake", level: 18 }],
    traitPool: ["trait_dense_core", "trait_keen_edge", "trait_swift_fault"],
    hiddenTraitPool: ["trait_wild_vein"],
    naturalWeight: 5e3,
    gachaWeight: 3800,
    minMiningLevel: 1,
    maxAwakening: 5,
    evolutions: [{ id: "evo_pebblit_granitus", targetSpeciesId: "species_granitus", conditions: [{ kind: "LEVEL", value: 24 }, { kind: "AFFINITY", value: 2 }], hidden: !1, hint: "Grow together until its core hardens." }],
    skillTree: Fe("pebblit", "skill_quake")
  },
  {
    id: "species_granitus",
    name: "Granitus",
    description: "An enduring granite guardian tempered by companionship.",
    rarity: "RARE",
    family: "terra",
    role: "TANK",
    primaryElement: "EARTH",
    possibleSecondaryElements: ["METAL"],
    growth: Pe($e(22, 13, 17, 24, 10, 15, 175), 1.1),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_bastion", level: 1 }, { skillId: "skill_quake", level: 28 }],
    traitPool: ["trait_dense_core", "trait_last_bastion"],
    hiddenTraitPool: ["trait_wild_vein", "trait_ancient_oath"],
    naturalWeight: 720,
    gachaWeight: 1050,
    minMiningLevel: 8,
    maxAwakening: 5,
    evolutions: [],
    skillTree: Fe("granitus", "skill_quake")
  },
  {
    id: "species_quartzling",
    name: "Quartzling",
    description: "A clear crystal that remembers every vibration around it.",
    rarity: "RARE",
    family: "crystal",
    role: "SUPPORT",
    primaryElement: "CRYSTAL",
    possibleSecondaryElements: ["LIGHT", "WATER"],
    growth: Pe($e(10, 22, 13, 12, 15, 23, 108), 0.98),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_crystal_mend", level: 10 }, { skillId: "skill_resonant_chorus", level: 24 }],
    traitPool: ["trait_resonant", "trait_swift_fault"],
    hiddenTraitPool: ["trait_crystal_memory", "trait_wild_vein"],
    naturalWeight: 1400,
    gachaWeight: 1550,
    minMiningLevel: 4,
    maxAwakening: 5,
    evolutions: [
      { id: "evo_quartz_prismara", targetSpeciesId: "species_prismara", conditions: [{ kind: "LEVEL", value: 36 }, { kind: "AFFINITY", value: 3 }, { kind: "SKILL", value: "skill_resonant_chorus" }], hidden: !1, hint: "Master resonance beneath a brilliant light." },
      { id: "evo_quartz_eclipse", targetSpeciesId: "species_eclipse_geode", conditions: [{ kind: "LEVEL", value: 40 }, { kind: "AREA", value: "area_void_rift" }, { kind: "ITEM", value: "item_eclipse_shard", amount: 1 }], hidden: !0, hint: "A silent crystal waits where light is swallowed." }
    ],
    skillTree: Fe("quartzling", "skill_resonant_chorus")
  },
  {
    id: "species_prismara",
    name: "Prismara",
    description: "A many-faceted oracle that bends possibility into color.",
    rarity: "SSR",
    family: "crystal",
    role: "SUPPORT",
    primaryElement: "CRYSTAL",
    possibleSecondaryElements: ["LIGHT", "WIND"],
    growth: Pe($e(17, 35, 24, 19, 25, 37, 164), 1.35),
    skillPool: [{ skillId: "skill_crystal_mend", level: 1 }, { skillId: "skill_resonant_chorus", level: 1 }, { skillId: "skill_prismatic_nova", level: 55 }],
    traitPool: ["trait_resonant", "trait_first_light"],
    hiddenTraitPool: ["trait_crystal_memory", "trait_prism_reflex"],
    naturalWeight: 20,
    gachaWeight: 120,
    minMiningLevel: 35,
    maxAwakening: 7,
    evolutions: [],
    skillTree: Fe("prismara", "skill_prismatic_nova")
  },
  {
    id: "species_emberite",
    name: "Emberite",
    description: "A volcanic stone with an impatient pulse.",
    rarity: "SR",
    family: "igneous",
    role: "ATTACK",
    primaryElement: "FIRE",
    possibleSecondaryElements: ["EARTH", "DARK"],
    growth: Pe($e(16, 13, 25, 14, 18, 17, 122), 1.12),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_ember_lance", level: 8 }, { skillId: "skill_magma_cataclysm", level: 42 }],
    traitPool: ["trait_keen_edge", "trait_flame_soul"],
    hiddenTraitPool: ["trait_wild_vein"],
    naturalWeight: 470,
    gachaWeight: 800,
    minMiningLevel: 12,
    maxAwakening: 6,
    evolutions: [{ id: "evo_ember_pyroclast", targetSpeciesId: "species_pyroclast", conditions: [{ kind: "LEVEL", value: 42 }, { kind: "BATTLE_COUNT", value: 40 }, { kind: "ITEM", value: "item_magma_heart", amount: 2 }], hidden: !1, hint: "Temper its flame through battle." }],
    skillTree: Fe("emberite", "skill_magma_cataclysm")
  },
  {
    id: "species_pyroclast",
    name: "Pyroclast",
    description: "A sovereign fragment of the world beneath the crust.",
    rarity: "UR",
    family: "igneous",
    role: "ATTACK",
    primaryElement: "FIRE",
    possibleSecondaryElements: ["ANCIENT"],
    growth: Pe($e(27, 22, 42, 25, 28, 30, 205), 1.58),
    skillPool: [{ skillId: "skill_ember_lance", level: 1 }, { skillId: "skill_quake", level: 1 }, { skillId: "skill_magma_cataclysm", level: 1 }],
    traitPool: ["trait_flame_soul", "trait_keen_edge"],
    hiddenTraitPool: ["trait_ancient_oath"],
    naturalWeight: 2,
    gachaWeight: 18,
    minMiningLevel: 60,
    maxAwakening: 7,
    evolutions: [],
    skillTree: Fe("pyroclast", "skill_magma_cataclysm")
  },
  {
    id: "species_aquamarite",
    name: "Aquamarite",
    description: "A tranquil mineral carrying the memory of ancient tides.",
    rarity: "SR",
    family: "crystal",
    role: "SUPPORT",
    primaryElement: "WATER",
    possibleSecondaryElements: ["CRYSTAL", "WIND"],
    growth: Pe($e(13, 25, 16, 17, 21, 26, 132), 1.13),
    skillPool: [{ skillId: "skill_tidal_cut", level: 1 }, { skillId: "skill_crystal_mend", level: 12 }, { skillId: "skill_resonant_chorus", level: 35 }],
    traitPool: ["trait_resonant", "trait_swift_fault"],
    hiddenTraitPool: ["trait_crystal_memory"],
    naturalWeight: 520,
    gachaWeight: 820,
    minMiningLevel: 14,
    maxAwakening: 6,
    evolutions: [],
    skillTree: Fe("aquamarite", "skill_crystal_mend")
  },
  {
    id: "species_zephyrite",
    name: "Zephyrite",
    description: "A light geode that hums just before a storm.",
    rarity: "SR",
    family: "aerial",
    role: "CONTROL",
    primaryElement: "WIND",
    possibleSecondaryElements: ["CRYSTAL", "LIGHT"],
    growth: Pe($e(10, 19, 20, 11, 31, 21, 112), 1.1),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_gale_shard", level: 7 }, { skillId: "skill_resonant_chorus", level: 34 }],
    traitPool: ["trait_swift_fault", "trait_first_light"],
    hiddenTraitPool: ["trait_crystal_memory"],
    naturalWeight: 430,
    gachaWeight: 790,
    minMiningLevel: 16,
    maxAwakening: 6,
    evolutions: [],
    skillTree: Fe("zephyrite", "skill_gale_shard")
  },
  {
    id: "species_ironwarden",
    name: "Ironwarden",
    description: "A sentient ore plate that interposes itself without hesitation.",
    rarity: "SSR",
    family: "metal",
    role: "TANK",
    primaryElement: "METAL",
    possibleSecondaryElements: ["EARTH", "FIRE"],
    growth: Pe($e(36, 15, 21, 40, 11, 18, 232), 1.42),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_bastion", level: 1 }, { skillId: "skill_iron_taunt", level: 20 }],
    traitPool: ["trait_dense_core", "trait_last_bastion"],
    hiddenTraitPool: ["trait_ancient_oath", "trait_wild_vein"],
    naturalWeight: 26,
    gachaWeight: 140,
    minMiningLevel: 33,
    maxAwakening: 7,
    evolutions: [],
    skillTree: Fe("ironwarden", "skill_iron_taunt")
  },
  {
    id: "species_eclipse_geode",
    name: "Eclipse Geode",
    description: "A forbidden geode whose hollow contains a starless sky.",
    rarity: "UR",
    family: "void",
    role: "CONTROL",
    primaryElement: "DARK",
    possibleSecondaryElements: ["CRYSTAL", "ANCIENT"],
    growth: Pe($e(24, 34, 38, 26, 35, 40, 196), 1.62),
    skillPool: [{ skillId: "skill_void_grip", level: 1 }, { skillId: "skill_ancient_echo", level: 24 }, { skillId: "skill_prismatic_nova", level: 60 }],
    traitPool: ["trait_gene_weaver", "trait_first_light"],
    hiddenTraitPool: ["trait_crystal_memory", "trait_prism_reflex"],
    naturalWeight: 0,
    gachaWeight: 12,
    minMiningLevel: 70,
    maxAwakening: 7,
    evolutions: [],
    skillTree: Fe("eclipse", "skill_prismatic_nova")
  },
  {
    id: "species_solaris",
    name: "Solaris Heart",
    description: "A stellar jewel condensed from unspent dawns.",
    rarity: "UR",
    family: "celestial",
    role: "ATTACK",
    primaryElement: "LIGHT",
    possibleSecondaryElements: ["FIRE", "CRYSTAL"],
    growth: Pe($e(26, 40, 43, 24, 33, 39, 188), 1.64),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_resonant_chorus", level: 20 }, { skillId: "skill_solar_verdict", level: 48 }],
    traitPool: ["trait_keen_edge", "trait_first_light"],
    hiddenTraitPool: ["trait_crystal_memory"],
    naturalWeight: 3,
    gachaWeight: 24,
    minMiningLevel: 58,
    maxAwakening: 7,
    evolutions: [],
    skillTree: Fe("solaris", "skill_solar_verdict")
  },
  {
    id: "species_worldheart",
    name: "Worldheart Monolith",
    description: "A legendary cornerstone said to remember the first mountain.",
    rarity: "LEGENDARY",
    family: "ancient",
    role: "TANK",
    primaryElement: "ANCIENT",
    possibleSecondaryElements: ["EARTH", "LIGHT"],
    growth: Pe($e(52, 44, 46, 55, 27, 50, 315), 2.05),
    skillPool: [{ skillId: "skill_bastion", level: 1 }, { skillId: "skill_ancient_echo", level: 1 }, { skillId: "skill_moonlit_aegis", level: 1 }],
    traitPool: ["trait_last_bastion", "trait_resonant"],
    hiddenTraitPool: ["trait_ancient_oath", "trait_wild_vein"],
    naturalWeight: 0.08,
    gachaWeight: 1,
    minMiningLevel: 90,
    maxAwakening: 10,
    evolutions: [],
    skillTree: Fe("worldheart", "skill_moonlit_aegis")
  }
], fe = Object.freeze(
  Object.fromEntries(Bt.map((e) => [e.id, e]))
), ot = {
  NORMAL: 0,
  RARE: 1,
  SR: 2,
  SSR: 3,
  UR: 4,
  LEGENDARY: 5
}, qt = {
  stone: (e) => Math.floor(65 + 30 * e + 7.5 * e ** 1.72),
  mining: (e) => Math.floor(80 + 55 * e + 14 * e ** 1.55),
  account: (e) => Math.floor(120 + 75 * e + 22 * e ** 1.48)
}, Kn = [
  { id: "area_greenbreak", name: "Greenbreak Quarry", unlockLevel: 1, discoveryRate: 0.18, rarityBias: 1, veins: ["vein_common", "vein_crystal"] },
  { id: "area_emberdeep", name: "Emberdeep Caldera", unlockLevel: 12, discoveryRate: 0.21, rarityBias: 1.12, veins: ["vein_volcanic", "vein_rare"] },
  { id: "area_skyfault", name: "Skyfault Shelf", unlockLevel: 25, discoveryRate: 0.23, rarityBias: 1.28, veins: ["vein_aerial", "vein_special"] },
  { id: "area_void_rift", name: "Nocturne Rift", unlockLevel: 45, discoveryRate: 0.25, rarityBias: 1.5, veins: ["vein_void", "vein_ancient"] }
], ds = [
  {
    id: "fusion_ember_quartz",
    type: "FIXED",
    requiredSpecies: ["species_emberite", "species_quartzling"],
    parentCount: 2,
    resultSpeciesIds: ["species_prismara"],
    weight: 1,
    hidden: !1,
    hint: "Flame refracted through a clear heart.",
    minimumLabLevel: 2,
    cost: { currencies: { credits: 1500, upgradeDust: 120 } }
  },
  {
    id: "fusion_eclipse",
    type: "HIDDEN",
    requiredSpecies: ["species_quartzling", "species_solaris"],
    parentCount: 2,
    resultSpeciesIds: ["species_eclipse_geode"],
    weight: 1,
    hidden: !0,
    hint: "When the purest light meets a crystal in darkness...",
    minimumLabLevel: 5,
    cost: { currencies: { credits: 8e3, upgradeDust: 600 }, items: { item_eclipse_shard: 1 } }
  },
  {
    id: "fusion_crystal_family",
    type: "FAMILY",
    requiredFamilies: ["crystal", "crystal"],
    parentCount: 2,
    resultSpeciesIds: ["species_quartzling", "species_aquamarite", "species_prismara"],
    weight: 1,
    hidden: !1,
    hint: "Crystal bloodlines amplify each other.",
    minimumLabLevel: 1,
    cost: { currencies: { credits: 900, upgradeDust: 80 } }
  },
  {
    id: "fusion_fire_crystal",
    type: "ELEMENT",
    requiredElements: ["FIRE", "CRYSTAL"],
    parentCount: 2,
    resultSpeciesIds: ["species_emberite", "species_prismara"],
    weight: 1,
    hidden: !1,
    hint: "Fire caught within a prism.",
    minimumLabLevel: 2,
    cost: { currencies: { credits: 1250, upgradeDust: 100 } }
  },
  {
    id: "fusion_ancient_convergence",
    type: "SPECIAL",
    requiredFamilies: ["igneous", "crystal", "metal", "celestial"],
    parentCount: 4,
    resultSpeciesIds: ["species_worldheart"],
    weight: 1,
    hidden: !0,
    hint: "Four pillars recall the first mountain.",
    minimumLabLevel: 8,
    cost: { currencies: { credits: 5e4, researchCores: 20, upgradeDust: 2500 }, items: { item_primordial_core: 1 } }
  }
], ar = [
  { id: "catalyst_ember", name: "Ember Catalyst", requiredLabLevel: 1, elementBias: "FIRE" },
  { id: "catalyst_gene_lock", name: "Gene Seal", requiredLabLevel: 3, traitLockSlots: 1 },
  { id: "catalyst_iv_lens", name: "Precision Lens", requiredLabLevel: 4, ivLockStats: ["power", "speed"] },
  { id: "catalyst_mutagen", name: "Prismatic Mutagen", requiredLabLevel: 6, mutationMultiplier: 4, shinyMultiplier: 2 },
  { id: "catalyst_eclipse", name: "Eclipse Key", requiredLabLevel: 5, unlockRecipeId: "fusion_eclipse" }
], us = Bt.filter((e) => e.gachaWeight > 0).map((e) => ({
  speciesId: e.id,
  weight: e.gachaWeight,
  pickup: e.id === "species_solaris" || e.id === "species_prismara"
})), ms = [
  {
    id: "banner_genesis",
    name: "Genesis Resonance",
    pool: us,
    rates: { NORMAL: 0.48, RARE: 0.3, SR: 0.16, SSR: 0.048, UR: 0.011, LEGENDARY: 1e-3 },
    pity: { softStart: 60, hard: 80, featuredGuaranteeAfterLoss: !0 },
    tenPullGuarantee: "SR",
    singleCost: { currencies: { gachaTickets: 1 } }
  }
], cr = [
  { id: "ach_mine_1", name: "First Resonance", description: "Mine once.", category: "MINING", metric: "MINED", threshold: 1, secret: !1, reward: { currencies: { credits: 500 }, accountXp: 40 } },
  { id: "ach_mine_100", name: "Quarry Regular", description: "Mine 100 times.", category: "MINING", metric: "MINED", threshold: 100, secret: !1, reward: { currencies: { gachaTickets: 3 }, titleId: "title_quarry_regular", accountXp: 250 } },
  { id: "ach_collection_5", name: "Lithic Archivist", description: "Discover five species.", category: "COLLECTION", metric: "SPECIES_OWNED", threshold: 5, secret: !1, reward: { currencies: { researchCores: 5 }, accountXp: 180 } },
  { id: "ach_fusion_1", name: "Two Become One", description: "Complete a fusion.", category: "FUSION", metric: "FUSIONS", threshold: 1, secret: !1, reward: { currencies: { upgradeDust: 250 }, accountXp: 120 } },
  { id: "ach_fusion_100", name: "Master Genealogist", description: "Complete 100 fusions.", category: "FUSION", metric: "FUSIONS", threshold: 100, secret: !1, reward: { frameId: "frame_genealogist", titleId: "title_genealogist", accountXp: 1e3 } },
  { id: "ach_battle_10", name: "Unbroken Formation", description: "Win ten battles.", category: "BATTLE", metric: "BATTLE_WINS", threshold: 10, secret: !1, reward: { currencies: { credits: 2e3 }, accountXp: 200 } },
  { id: "ach_gacha_50", name: "Echo Chaser", description: "Perform 50 summons.", category: "GACHA", metric: "GACHA_PULLS", threshold: 50, secret: !1, reward: { currencies: { gachaTickets: 5 }, accountXp: 250 } },
  { id: "ach_mutation_1", name: "Impossible Color", description: "Discover a mutation.", category: "SECRET", metric: "MUTATIONS", threshold: 1, secret: !0, reward: { titleId: "title_gene_anomaly", accountXp: 400 } },
  { id: "ach_perfect_iv", name: "Flawless Geometry", description: "Obtain a perfect-IV stone.", category: "SECRET", metric: "PERFECT_IV", threshold: 1, secret: !0, reward: { frameId: "frame_perfect", accountXp: 800 } },
  { id: "ach_level_25", name: "Stonekeeper", description: "Reach account level 25.", category: "PROFILE", metric: "ACCOUNT_LEVEL", threshold: 25, secret: !1, reward: { titleId: "title_stonekeeper", accountXp: 250 } }
], ps = [
  {
    id: "dungeon_echoing_depths",
    name: "Echoing Depths",
    element: "EARTH",
    minAccountLevel: 1,
    stages: [
      { id: "echo_1", name: "Rumbling Entrance", enemies: [{ id: "enemy_pebble_a", speciesId: "species_pebblit", level: 3, statMultiplier: 0.85, skillIds: ["skill_stone_strike"], traitIds: [] }, { id: "enemy_pebble_b", speciesId: "species_pebblit", level: 4, statMultiplier: 0.9, skillIds: ["skill_stone_strike"], traitIds: ["trait_dense_core"] }], reward: { currencies: { credits: 180, upgradeDust: 20 }, accountXp: 35, stoneXp: 45 }, firstClearReward: { currencies: { gachaTickets: 1 } }, staminaCost: 4 },
      { id: "echo_2", name: "Granite Sentinel", enemies: [{ id: "enemy_granitus", speciesId: "species_granitus", level: 10, statMultiplier: 1, skillIds: ["skill_stone_strike", "skill_bastion"], traitIds: ["trait_dense_core"] }], reward: { currencies: { credits: 300, upgradeDust: 35 }, accountXp: 55, stoneXp: 70 }, firstClearReward: { items: { item_magma_heart: 1 } }, staminaCost: 6 }
    ]
  },
  {
    id: "dungeon_prismatic_vault",
    name: "Prismatic Vault",
    element: "CRYSTAL",
    minAccountLevel: 12,
    stages: [
      { id: "prism_1", name: "Refracted Hall", enemies: [{ id: "enemy_quartz", speciesId: "species_quartzling", level: 18, statMultiplier: 1.15, skillIds: ["skill_stone_strike", "skill_crystal_mend"], traitIds: ["trait_resonant"] }, { id: "enemy_zephyr", speciesId: "species_zephyrite", level: 17, statMultiplier: 1.1, skillIds: ["skill_gale_shard"], traitIds: ["trait_swift_fault"] }], reward: { currencies: { credits: 650, researchCores: 1, upgradeDust: 70 }, accountXp: 120, stoneXp: 150 }, firstClearReward: { items: { item_eclipse_shard: 1 } }, staminaCost: 10 }
    ]
  }
], fs = Object.freeze(Object.fromEntries(ps.map((e) => [e.id, e]))), hs = Object.freeze(Object.fromEntries(ms.map((e) => [e.id, e]))), ei = Object.freeze(Object.fromEntries(ar.map((e) => [e.id, e]))), ti = [
  { id: "personality_bold", name: "Bold", description: "Hits hard and stands its ground.", statMultipliers: { power: 1.1, speed: 0.95 }, aiStyle: "AGGRESSIVE" },
  { id: "personality_calm", name: "Calm", description: "Channels resonance with patience.", statMultipliers: { resonance: 1.1, power: 0.96 }, aiStyle: "SUPPORTIVE" },
  { id: "personality_stalwart", name: "Stalwart", description: "Unusually difficult to crack.", statMultipliers: { defense: 1.1, speed: 0.94 }, aiStyle: "DEFENSIVE" },
  { id: "personality_hasty", name: "Hasty", description: "Acts before thinking, usually.", statMultipliers: { speed: 1.12, defense: 0.94 }, aiStyle: "AGGRESSIVE" },
  { id: "personality_precise", name: "Precise", description: "Polished focus with exceptional purity.", statMultipliers: { purity: 1.1, maxHp: 0.97 }, aiStyle: "TACTICAL" },
  { id: "personality_gentle", name: "Gentle", description: "Protects allies before itself.", statMultipliers: { resonance: 1.08, defense: 1.03, power: 0.94 }, aiStyle: "SUPPORTIVE" },
  { id: "personality_chaotic", name: "Chaotic", description: "No battle plan survives first contact.", statMultipliers: { power: 1.07, speed: 1.05, purity: 0.92 }, aiStyle: "CHAOTIC" },
  { id: "personality_sleepy", name: "Sleepy", description: "Eventually delivers a truly monumental hit.", statMultipliers: { power: 1.13, speed: 0.88, maxHp: 1.04 }, aiStyle: "DEFENSIVE" }
], ni = Object.freeze(
  Object.fromEntries(ti.map((e) => [e.id, e]))
), Es = [
  {
    id: "skill_stone_strike",
    name: "Stone Strike",
    description: "A reliable physical impact.",
    element: "EARTH",
    target: "ENEMY",
    cooldown: 0,
    ultimateCost: 0,
    priority: 0,
    effects: [{ type: "DAMAGE", power: 0.9 }],
    tags: ["basic"]
  },
  {
    id: "skill_ember_lance",
    name: "Ember Lance",
    description: "Pierces a target and may ignite it.",
    element: "FIRE",
    target: "ENEMY",
    cooldown: 2,
    ultimateCost: 0,
    priority: 1,
    effects: [{ type: "DAMAGE", power: 1.25 }, { type: "STATUS", statusId: "BURN", chance: 0.35, value: 0.08, duration: 2 }],
    tags: ["attack"]
  },
  {
    id: "skill_magma_cataclysm",
    name: "Magma Cataclysm",
    description: "An ultimate eruption against all enemies.",
    element: "FIRE",
    target: "ALL_ENEMIES",
    cooldown: 0,
    ultimateCost: 100,
    priority: 5,
    effects: [{ type: "DAMAGE", power: 1.85 }, { type: "STATUS", statusId: "BURN", chance: 0.65, value: 0.1, duration: 3 }],
    tags: ["ultimate", "rare"]
  },
  {
    id: "skill_tidal_cut",
    name: "Tidal Cut",
    description: "A fast water-edged strike.",
    element: "WATER",
    target: "ENEMY",
    cooldown: 1,
    ultimateCost: 0,
    priority: 2,
    effects: [{ type: "DAMAGE", power: 1.08 }, { type: "ULTIMATE_GAIN", value: 8 }],
    tags: ["attack"]
  },
  {
    id: "skill_crystal_mend",
    name: "Crystal Mend",
    description: "Restorative resonance heals the weakest ally.",
    element: "CRYSTAL",
    target: "ALLY",
    cooldown: 2,
    ultimateCost: 0,
    priority: 3,
    effects: [{ type: "HEAL", power: 1.15 }, { type: "STATUS", statusId: "REGEN", chance: 1, value: 0.06, duration: 2 }],
    tags: ["support"]
  },
  {
    id: "skill_bastion",
    name: "Bastion",
    description: "Hardens the caster and raises a shield.",
    element: "EARTH",
    target: "SELF",
    cooldown: 2,
    ultimateCost: 0,
    priority: 4,
    effects: [{ type: "BUFF", stat: "defense", value: 0.25, duration: 2 }, { type: "SHIELD", power: 0.75 }],
    tags: ["tank"]
  },
  {
    id: "skill_resonant_chorus",
    name: "Resonant Chorus",
    description: "Empowers the whole formation.",
    element: "CRYSTAL",
    target: "ALL_ALLIES",
    cooldown: 3,
    ultimateCost: 0,
    priority: 4,
    effects: [{ type: "BUFF", stat: "power", value: 0.18, duration: 3 }, { type: "BUFF", stat: "resonance", value: 0.18, duration: 3 }],
    tags: ["support"]
  },
  {
    id: "skill_gale_shard",
    name: "Gale Shard",
    description: "A swift projectile that fractures defenses.",
    element: "WIND",
    target: "ENEMY",
    cooldown: 1,
    ultimateCost: 0,
    priority: 2,
    effects: [{ type: "DAMAGE", power: 1.05 }, { type: "DEBUFF", stat: "defense", value: -0.16, duration: 2 }],
    tags: ["control"]
  },
  {
    id: "skill_void_grip",
    name: "Void Grip",
    description: "Dark pressure with a chance to stun.",
    element: "DARK",
    target: "ENEMY",
    cooldown: 3,
    ultimateCost: 0,
    priority: 4,
    effects: [{ type: "DAMAGE", power: 0.85 }, { type: "STATUS", statusId: "STUN", chance: 0.32, value: 0, duration: 1 }],
    tags: ["control"]
  },
  {
    id: "skill_solar_verdict",
    name: "Solar Verdict",
    description: "A radiant ultimate that judges every enemy.",
    element: "LIGHT",
    target: "ALL_ENEMIES",
    cooldown: 0,
    ultimateCost: 100,
    priority: 5,
    effects: [{ type: "DAMAGE", power: 1.65 }, { type: "DEBUFF", stat: "power", value: -0.18, duration: 2 }],
    tags: ["ultimate"]
  },
  {
    id: "skill_iron_taunt",
    name: "Iron Challenge",
    description: "Provokes enemies while reinforcing defense.",
    element: "METAL",
    target: "SELF",
    cooldown: 3,
    ultimateCost: 0,
    priority: 5,
    effects: [{ type: "STATUS", statusId: "TAUNT", chance: 1, value: 0, duration: 2 }, { type: "BUFF", stat: "defense", value: 0.35, duration: 2 }],
    tags: ["tank"]
  },
  {
    id: "skill_quake",
    name: "Faultline Quake",
    description: "Shakes all enemies and opens fractures.",
    element: "EARTH",
    target: "ALL_ENEMIES",
    cooldown: 3,
    ultimateCost: 0,
    priority: 2,
    effects: [{ type: "DAMAGE", power: 0.82 }, { type: "STATUS", statusId: "FRACTURE", chance: 0.45, value: 0.15, duration: 2 }],
    tags: ["attack"]
  },
  {
    id: "skill_ancient_echo",
    name: "Ancient Echo",
    description: "Timeless resonance damages and delays foes.",
    element: "ANCIENT",
    target: "ALL_ENEMIES",
    cooldown: 4,
    ultimateCost: 0,
    priority: 3,
    effects: [{ type: "DAMAGE", power: 1.1 }, { type: "DEBUFF", stat: "speed", value: -0.2, duration: 2 }],
    tags: ["control", "rare"]
  },
  {
    id: "skill_prismatic_nova",
    name: "Prismatic Nova",
    description: "A spectrum-shattering ultimate.",
    element: "CRYSTAL",
    target: "ALL_ENEMIES",
    cooldown: 0,
    ultimateCost: 100,
    priority: 6,
    effects: [{ type: "DAMAGE", power: 2.05 }, { type: "ULTIMATE_GAIN", value: 10 }],
    tags: ["ultimate", "legendary"]
  },
  {
    id: "skill_moonlit_aegis",
    name: "Moonlit Aegis",
    description: "A grand barrier for the whole team.",
    element: "LIGHT",
    target: "ALL_ALLIES",
    cooldown: 4,
    ultimateCost: 100,
    priority: 7,
    effects: [{ type: "SHIELD", power: 1.2 }, { type: "HEAL", power: 0.75 }],
    tags: ["ultimate", "support"]
  }
], Et = Object.freeze(
  Object.fromEntries(Es.map((e) => [e.id, e]))
), gs = [
  { id: "trait_dense_core", name: "Dense Core", description: "Defense +10%.", tier: "COMMON", tags: ["tank"], effects: [{ trigger: "ALWAYS", stat: "defense", operation: "PERCENT", value: 0.1 }] },
  { id: "trait_keen_edge", name: "Keen Edge", description: "Power +8%.", tier: "COMMON", tags: ["attack"], effects: [{ trigger: "ALWAYS", stat: "power", operation: "PERCENT", value: 0.08 }] },
  { id: "trait_resonant", name: "Resonant Heart", description: "Resonance +12%.", tier: "COMMON", tags: ["support"], effects: [{ trigger: "ALWAYS", stat: "resonance", operation: "PERCENT", value: 0.12 }] },
  { id: "trait_swift_fault", name: "Swift Fault", description: "Speed +10%.", tier: "COMMON", tags: ["speed"], effects: [{ trigger: "ALWAYS", stat: "speed", operation: "PERCENT", value: 0.1 }] },
  { id: "trait_last_bastion", name: "Last Bastion", description: "Greatly raises defense below 30% HP.", tier: "RARE", tags: ["tank"], effects: [{ trigger: "LOW_HP", stat: "defense", operation: "PERCENT", value: 0.35 }] },
  { id: "trait_flame_soul", name: "Flame Soul", description: "Amplifies fire techniques.", tier: "RARE", tags: ["element", "fire"], effects: [{ trigger: "ALWAYS", stat: "power", operation: "PERCENT", value: 0.13, element: "FIRE" }] },
  { id: "trait_crystal_memory", name: "Crystal Memory", description: "Critical actions resonate more strongly.", tier: "HIDDEN", tags: ["critical"], effects: [{ trigger: "ON_CRIT", stat: "resonance", operation: "PERCENT", value: 0.18 }] },
  { id: "trait_first_light", name: "First Light", description: "Starts battle with heightened speed.", tier: "RARE", tags: ["speed"], effects: [{ trigger: "BATTLE_START", stat: "speed", operation: "PERCENT", value: 0.25 }] },
  { id: "trait_wild_vein", name: "Wild Vein", description: "A mark found only in naturally mined stones.", tier: "NATURAL_EXCLUSIVE", tags: ["natural"], effects: [{ trigger: "ALWAYS", stat: "purity", operation: "PERCENT", value: 0.14 }] },
  { id: "trait_gene_weaver", name: "Gene Weaver", description: "A rare signature born from fusion.", tier: "FUSION_EXCLUSIVE", tags: ["fusion"], effects: [{ trigger: "ALWAYS", stat: "resonance", operation: "PERCENT", value: 0.18 }] },
  { id: "trait_ancient_oath", name: "Ancient Oath", description: "A primordial promise of endurance.", tier: "HIDDEN", tags: ["ancient"], effects: [{ trigger: "ALWAYS", stat: "maxHp", operation: "PERCENT", value: 0.16 }] },
  { id: "trait_prism_reflex", name: "Prism Reflex", description: "Prismatic light sharpens every motion.", tier: "HIDDEN", tags: ["mutation"], effects: [{ trigger: "ALWAYS", stat: "speed", operation: "PERCENT", value: 0.12 }, { trigger: "ALWAYS", stat: "resonance", operation: "PERCENT", value: 0.12 }] }
], Yt = Object.freeze(
  Object.fromEntries(gs.map((e) => [e.id, e]))
), ri = (e) => {
  let t = 2166136261;
  for (let n = 0; n < e.length; n += 1)
    t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
  return t += t << 13, t ^= t >>> 7, t += t << 3, t ^= t >>> 17, t += t << 5, t >>> 0;
};
class Re {
  constructor(t) {
    this.seed = t, this.state = typeof t == "number" ? t >>> 0 : ri(t), this.state === 0 && (this.state = 1831565813);
  }
  seed;
  state;
  draws = 0;
  next() {
    let t = this.state += 1831565813;
    return t = Math.imul(t ^ t >>> 15, t | 1), t ^= t + Math.imul(t ^ t >>> 7, t | 61), this.draws += 1, ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  int(t, n) {
    if (!Number.isSafeInteger(t) || !Number.isSafeInteger(n) || n < t)
      throw new RangeError(`Invalid integer range ${t}..${n}`);
    return Math.floor(this.next() * (n - t + 1)) + t;
  }
  chance(t) {
    if (!Number.isFinite(t)) throw new TypeError("Probability must be finite");
    return this.next() < Math.max(0, Math.min(1, t));
  }
  pick(t) {
    if (t.length === 0) throw new RangeError("Cannot pick from an empty collection");
    return t[this.int(0, t.length - 1)];
  }
  weighted(t, n) {
    if (t.length === 0) throw new RangeError("Cannot pick from an empty collection");
    const r = t.map((o) => Math.max(0, n(o))), i = r.reduce((o, a) => o + a, 0);
    if (!(i > 0)) throw new RangeError("At least one weight must be positive");
    let s = this.next() * i;
    for (let o = 0; o < t.length; o += 1)
      if (s -= r[o] ?? 0, s < 0) return t[o];
    return t[t.length - 1];
  }
  shuffle(t) {
    const n = [...t];
    for (let r = n.length - 1; r > 0; r -= 1) {
      const i = this.int(0, r);
      [n[r], n[i]] = [n[i], n[r]];
    }
    return n;
  }
  fork(t) {
    return new Re(`${String(this.seed)}:${t}:${this.draws}:${this.state}`);
  }
}
class lr {
  next() {
    const t = new Uint32Array(1);
    return typeof crypto < "u" && typeof crypto.getRandomValues == "function" ? (crypto.getRandomValues(t), t[0] / 4294967296) : Math.random();
  }
  int(t, n) {
    if (!Number.isSafeInteger(t) || !Number.isSafeInteger(n) || n < t)
      throw new RangeError(`Invalid integer range ${t}..${n}`);
    return Math.floor(this.next() * (n - t + 1)) + t;
  }
  chance(t) {
    return this.next() < Math.max(0, Math.min(1, t));
  }
  pick(t) {
    if (t.length === 0) throw new RangeError("Cannot pick from an empty collection");
    return t[this.int(0, t.length - 1)];
  }
  weighted(t, n) {
    if (t.length === 0) throw new RangeError("Cannot pick from an empty collection");
    const r = t.reduce((s, o) => s + Math.max(0, n(o)), 0);
    if (!(r > 0)) throw new RangeError("At least one weight must be positive");
    let i = this.next() * r;
    for (const s of t)
      if (i -= Math.max(0, n(s)), i < 0) return s;
    return t[t.length - 1];
  }
  shuffle(t) {
    const n = [...t];
    for (let r = n.length - 1; r > 0; r -= 1) {
      const i = this.int(0, r);
      [n[r], n[i]] = [n[i], n[r]];
    }
    return n;
  }
  fork() {
    return new lr();
  }
}
const tt = (e, t, n) => {
  const r = Array.from({ length: 4 }, () => t.int(0, 4294967295).toString(16).padStart(8, "0")).join("");
  return `${e}_${n.toString(36)}_${r}`;
}, Mn = (e) => {
  const t = JSON.stringify(e, (n, r) => r && typeof r == "object" && !Array.isArray(r) ? Object.fromEntries(Object.entries(r).sort(([i], [s]) => i.localeCompare(s))) : r);
  return ri(t ?? "").toString(16).padStart(8, "0");
}, de = { now: () => /* @__PURE__ */ new Date() }, je = ["hardness", "purity", "power", "defense", "speed", "resonance"], Is = () => ({
  battles: 0,
  wins: 0,
  losses: 0,
  damageDealt: 0,
  damageTaken: 0,
  healingDone: 0,
  criticalHits: 0,
  enemiesDefeated: 0,
  ultimatesUsed: 0
}), ii = (e) => ({
  NORMAL: 0.92,
  RARE: 1,
  SR: 1.08,
  SSR: 1.18,
  UR: 1.3,
  LEGENDARY: 1.47
})[e], Cn = (e) => Math.min(120, 100 + e.limitBreak * 4), ys = (e) => ({
  instanceId: e.instanceId,
  speciesId: e.speciesId,
  serialNumber: e.serialNumber,
  nickname: e.nickname,
  mutation: e.mutation,
  colorVariant: e.colorVariant,
  traitIds: [...e.traitIds]
}), Ss = (e, t) => {
  const n = { NORMAL: 0, RARE: 1, SR: 2, SSR: 4, UR: 6, LEGENDARY: 8 }, r = Math.floor((e.next() + e.next()) * 16);
  return Math.min(31, Math.max(n[t], r));
}, As = (e, t, n = {}) => Object.fromEntries(
  je.map((r) => [r, Math.max(0, Math.min(31, Math.round(n[r] ?? Ss(e, t))))])
), Ke = (e) => {
  const t = fe[e.speciesId];
  if (!t) throw new Error(`Unknown species: ${e.speciesId}`);
  const n = ni[e.personalityId];
  if (!n) throw new Error(`Unknown personality: ${e.personalityId}`);
  const r = {}, i = [...je, "maxHp"], s = ii(t.rarity), o = 1 + e.potential * 25e-4 + e.awakeningStage * 0.035 + e.reincarnationCount * 0.025 + e.limitBreak * 0.015, a = { NONE: 1, PRISMATIC: 1.035, ANCIENT: 1.04, CORRUPTED: 1.055, PERFECT: 1.075 };
  for (const l of i) {
    const d = l === "maxHp" ? Object.values(e.individualValues).reduce((m, A) => m + A, 0) / 6 : e.individualValues[l], u = t.growth.base[l] + t.growth.perLevel[l] * Math.max(0, e.level - 1), h = l === "maxHp" ? d * 1.35 : d * (0.18 + e.level * 4e-3), w = n.statMultipliers[l] ?? 1;
    let E = (u + h) * s * o * a[e.mutation] * w;
    for (const m of e.traitIds) {
      const A = Yt[m];
      for (const S of A?.effects ?? [])
        S.trigger !== "ALWAYS" || S.stat !== l || S.value === void 0 || (E = S.operation === "FLAT" ? E + S.value : E * (1 + S.value));
    }
    for (const m of t.skillTree)
      e.learnedSkillNodes.includes(m.id) && (E += m.statBonus?.[l] ?? 0);
    r[l] = Math.max(1, Math.round(E));
  }
  return r;
}, ws = (e, t) => {
  const n = t === "FUSION" ? 0.012 : t === "NATURAL" ? 3e-3 : 15e-4;
  return e.chance(n) ? e.weighted(["PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], (r) => ({
    NONE: 0,
    PRISMATIC: 54,
    ANCIENT: 27,
    CORRUPTED: 16,
    PERFECT: 3
  })[r]) : "NONE";
}, Ct = (e) => {
  const n = (e.clock ?? de).now(), r = n.getTime(), { species: i, rng: s } = e, o = e.rarity ?? i.rarity, a = e.origin, l = e.mutation ?? ws(s, a), d = e.personalityId ?? s.pick(ti).id, u = As(s, o, e.forcedIvs);
  if (l === "PERFECT") for (const p of je) u[p] = 31;
  const h = [...i.traitPool];
  a === "NATURAL" && h.push(...i.hiddenTraitPool.filter((p) => Yt[p]?.tier === "NATURAL_EXCLUSIVE")), a === "FUSION" && h.push("trait_gene_weaver"), l === "PRISMATIC" && h.push("trait_prism_reflex"), l === "ANCIENT" && h.push("trait_ancient_oath");
  const w = o === "LEGENDARY" ? 3 : o === "UR" || o === "SSR" ? 2 : 1, E = e.forcedTraits ? [...new Set(e.forcedTraits)].slice(0, 4) : s.shuffle([...new Set(h)]).slice(0, w), m = Math.max(1, Math.min(100, Math.floor(e.level ?? 1))), A = i.skillPool.filter((p) => p.level <= m).slice(0, 4).map((p) => p.skillId);
  A.length === 0 && i.skillPool[0] && A.push(i.skillPool[0].skillId);
  const S = [...new Set(e.forcedSkills ?? A)].slice(0, 6).map((p) => ({
    skillId: p,
    level: 1,
    source: a === "FUSION" ? "FUSION" : "NATURAL"
  })), k = tt("stone", s, r), T = {
    instanceId: k,
    serialNumber: `${n.getUTCFullYear()}-${i.id.replace("species_", "").toUpperCase()}-${k.slice(-10).toUpperCase()}`,
    speciesId: i.id,
    name: i.name,
    nickname: null,
    rarity: o,
    origin: a,
    level: m,
    xp: 0,
    potential: Math.min(100, Math.round(35 + s.next() * 55 + ii(o) * 5)),
    personalityId: d,
    primaryElement: i.primaryElement,
    secondaryElement: i.possibleSecondaryElements.length > 0 && s.chance(0.28) ? s.pick(i.possibleSecondaryElements) : null,
    stats: {},
    individualValues: u,
    traitIds: E,
    skills: S,
    skillPoints: Math.floor(m / 5),
    learnedSkillNodes: [],
    equipment: {},
    affinity: { points: 0, rank: 0, claimedMilestones: [] },
    awakeningStage: 0,
    evolutionStage: 0,
    reincarnationCount: 0,
    limitBreak: 0,
    mutation: l,
    colorVariant: s.chance(a === "FUSION" ? 0.012 : 6e-3) ? "SHINY" : "STANDARD",
    parents: e.parents?.slice(0, 4) ?? [],
    grandparents: e.grandparents?.slice(0, 8) ?? [],
    generation: Math.max(0, e.generation ?? 0),
    originalOwner: { ...e.owner },
    currentOwner: { ...e.owner },
    discoverer: { ...e.owner },
    createdAt: n.toISOString(),
    firstObtainedAt: n.toISOString(),
    appraisedAt: e.appraised === !1 ? null : n.toISOString(),
    battleStatistics: Is(),
    favorite: !1,
    locked: !1,
    tags: []
  };
  return T.stats = Ke(T), T;
}, si = (e, t) => {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("XP amount must be a non-negative finite number");
  const n = e.level, r = { ...e.stats };
  e.xp += Math.floor(t);
  const i = Cn(e);
  for (; e.level < i; ) {
    const o = qt.stone(e.level);
    if (e.xp < o) break;
    e.xp -= o, e.level += 1, e.skillPoints += e.level % 5 === 0 ? 1 : 0;
    const a = fe[e.speciesId];
    for (const l of a?.skillPool ?? [])
      l.level === e.level && !e.skills.some((d) => d.skillId === l.skillId) && e.skills.length < 6 && e.skills.push({ skillId: l.skillId, level: 1, source: "LEVEL" });
  }
  e.level >= i && (e.xp = Math.min(e.xp, qt.stone(i) - 1)), e.stats = Ke(e);
  const s = Object.fromEntries(
    Object.entries(e.stats).map(([o, a]) => [o, a - r[o]])
  );
  return { previousLevel: n, level: e.level, xp: e.xp, levelsGained: e.level - n, statIncrease: s };
}, vs = (e) => {
  const t = [0, 100, 300, 700, 1400, 2500, 4e3, 6e3];
  let n = 0;
  for (; n + 1 < t.length && e >= (t[n + 1] ?? Number.POSITIVE_INFINITY); ) n += 1;
  return n;
}, xn = (e, t) => {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("Affinity amount must be non-negative");
  const n = e.affinity.rank;
  return e.affinity.points = Math.min(9999, e.affinity.points + Math.floor(t)), e.affinity.rank = vs(e.affinity.points), { previousRank: n, rank: e.affinity.rank };
}, Ms = (e, t, n) => {
  switch (t.kind) {
    case "LEVEL":
      return e.level >= Number(t.value);
    case "AFFINITY":
      return e.affinity.rank >= Number(t.value);
    case "BATTLE_COUNT":
      return e.battleStatistics.battles >= Number(t.value);
    case "ITEM":
      return (n.items[String(t.value)] ?? 0) >= (t.amount ?? 1);
    case "AREA":
      return n.areaId === String(t.value);
    case "SKILL":
      return e.skills.some((r) => r.skillId === String(t.value));
    case "FUSION_HISTORY":
      return n.fusionCount >= Number(t.value);
    case "ACHIEVEMENT":
      return n.achievementIds.includes(String(t.value));
    case "TIME": {
      const r = (n.timestamp ?? /* @__PURE__ */ new Date()).getHours();
      return t.value === "NIGHT" ? r >= 20 || r < 5 : t.value === "DAY" ? r >= 5 && r < 20 : !0;
    }
  }
}, Rs = (e, t) => (fe[e.speciesId]?.evolutions ?? []).filter((r) => r.conditions.every((i) => Ms(e, i, t))), bs = (e, t) => {
  const n = fe[t.targetSpeciesId];
  if (!n) throw new Error(`Unknown evolution species: ${t.targetSpeciesId}`);
  const r = e.speciesId;
  e.speciesId = n.id, e.name = n.name, e.rarity = n.rarity, e.primaryElement = n.primaryElement, e.evolutionStage += 1, e.origin = "EVOLUTION";
  for (const i of n.skillPool.filter((s) => s.level <= e.level))
    !e.skills.some((s) => s.skillId === i.skillId) && e.skills.length < 6 && e.skills.push({ skillId: i.skillId, level: 1, source: "LEVEL" });
  return e.stats = Ke(e), { previousSpeciesId: r, stone: e, evolutionId: t.id };
}, Ts = (e) => {
  const t = fe[e.speciesId];
  if (!t || e.awakeningStage >= t.maxAwakening) throw new Error("Stone is at maximum awakening");
  if (e.affinity.rank < Math.min(6, e.awakeningStage + 1)) throw new Error("Affinity is too low to awaken");
  e.awakeningStage += 1, e.stats = Ke(e);
}, Ns = (e) => {
  if (e.level < Cn(e)) throw new Error("Only a max-level stone may reincarnate");
  e.level = 1, e.xp = 0, e.reincarnationCount += 1, e.potential = Math.min(100, e.potential + 3), e.skillPoints += 2, e.stats = Ke(e);
}, _s = (e, t) => {
  const r = fe[e.speciesId]?.skillTree.find((i) => i.id === t);
  if (!r) throw new Error("Unknown skill node");
  if (e.learnedSkillNodes.includes(t)) throw new Error("Skill node already learned");
  if (!r.prerequisites.every((i) => e.learnedSkillNodes.includes(i))) throw new Error("Prerequisite not learned");
  if (e.skillPoints < r.cost) throw new Error("Not enough skill points");
  if (e.skillPoints -= r.cost, e.learnedSkillNodes.push(t), r.grantsSkillId && !e.skills.some((i) => i.skillId === r.grantsSkillId)) {
    if (e.skills.length >= 6) throw new Error("No open skill slot");
    e.skills.push({ skillId: r.grantsSkillId, level: 1, source: "TREE" });
  }
  e.stats = Ke(e);
}, On = (e) => je.every((t) => e[t] === 31), ks = (e) => {
  const t = [];
  e.instanceId || t.push("instanceId is required"), fe[e.speciesId] || t.push(`Unknown species ${e.speciesId}`), ni[e.personalityId] || t.push(`Unknown personality ${e.personalityId}`), (e.level < 1 || e.level > Cn(e)) && t.push("Level is out of range"), e.skills.length > 6 && t.push("Too many skills"), new Set(e.traitIds).size !== e.traitIds.length && t.push("Duplicate traits");
  for (const n of je) (e.individualValues[n] < 0 || e.individualValues[n] > 31) && t.push(`IV ${n} is out of range`);
  return e.parents.some((n) => n.instanceId === e.instanceId) && t.push("Stone cannot be its own parent"), t;
}, Hn = (e, t, n, r) => {
  const i = fe[e];
  if (!i) throw new Error(`Unknown species ${e}`);
  return Ct({ species: i, origin: "EVENT", owner: t, rng: new Re(n), clock: r });
}, oi = {
  THIRTY_DAYS: 720 * 60 * 60 * 1e3
}, Cs = 864e13, Rt = (e, t) => {
  if (!Number.isSafeInteger(e) || e < 0 || e > Cs)
    throw new Error(`${t} must be a valid non-negative Date timestamp`);
}, xs = (e) => {
  const t = e.maxForwardAdvanceMs ?? oi.THIRTY_DAYS;
  if (!Number.isSafeInteger(t) || t <= 0) throw new Error("maxForwardAdvanceMs must be a positive safe integer");
  return t;
}, ai = (e) => (Rt(e, "observedWallMs"), { version: 1, trustedNowMs: e, wallHighWaterMs: e, reconciliationCount: 0 }), Os = (e) => {
  if (!e || e.version !== 1) throw new Error("Unsupported trusted-time checkpoint");
  return Rt(e.trustedNowMs, "checkpoint.trustedNowMs"), Rt(e.wallHighWaterMs, "checkpoint.wallHighWaterMs"), Rt(e.reconciliationCount, "checkpoint.reconciliationCount"), { ...e };
}, Ls = (e, t, n = {}) => {
  const r = Os(e);
  Rt(t, "observedWallMs");
  const i = Math.max(0, t - r.wallHighWaterMs), s = Math.min(i, xs(n)), o = t < r.wallHighWaterMs ? "rollback" : i > s ? "forward-capped" : "none", a = {
    version: 1,
    trustedNowMs: r.trustedNowMs + s,
    wallHighWaterMs: Math.max(r.wallHighWaterMs, t),
    reconciliationCount: r.reconciliationCount + 1
  };
  return Rt(a.trustedNowMs, "next.trustedNowMs"), Rt(a.reconciliationCount, "next.reconciliationCount"), { nowMs: a.trustedNowMs, advanceMs: s, observedWallMs: t, observedAdvanceMs: i, anomaly: o, checkpoint: a };
}, pn = 1e12, J = (e, t = 0, n = pn) => Number.isFinite(e) ? Math.max(t, Math.min(n, e)) : e > 0 ? n : t, Pt = (e) => Math.round(J(e)), we = (e, t, n = 0, r = pn) => {
  if (!Number.isFinite(e) || e < n || e > r)
    throw new RangeError(`${t} must be finite and within ${n}..${r}`);
  return e;
}, ut = (e, t, n = 10) => we(e, t, 0, n), Ds = (e) => ({
  ...e,
  phases: e.phases?.map((t) => ({
    ...t,
    summons: t.summons?.map((n) => dr(n))
  }))
}), dr = (e) => ({
  ...e,
  stats: { ...e.stats },
  skillIds: [...e.skillIds],
  boss: e.boss ? Ds(e.boss) : void 0
}), ci = (e) => {
  if (!e.id || !e.name || e.effects.length === 0) throw new TypeError("Skills require id, name and effects");
  we(e.cooldown ?? 0, `${e.id}.cooldown`, 0, 100), we(e.ultimateCost ?? 0, `${e.id}.ultimateCost`, 0, 100);
  for (const t of e.effects) {
    if (we(t.power ?? 0, `${e.id}.${t.kind}.power`, 0, 100), we(Math.abs(t.value ?? 0), `${e.id}.${t.kind}.value`, 0, pn), we(t.duration ?? 0, `${e.id}.${t.kind}.duration`, 0, 1e3), we(t.chance ?? 1, `${e.id}.${t.kind}.chance`, 0, 1), (t.kind === "BUFF" || t.kind === "DEBUFF") && !t.stat)
      throw new TypeError(`${e.id}.${t.kind} requires a stat`);
    if (t.kind === "STATUS" && !t.status) throw new TypeError(`${e.id}.STATUS requires a status`);
  }
}, ur = (e, t) => {
  if (!e.id || !e.name || e.skillIds.length === 0) throw new TypeError("Combatants require id, name and skills");
  we(e.level, `${e.id}.level`, 1, 1e6);
  for (const [n, r] of Object.entries(e.stats)) we(r, `${e.id}.${n}`);
  ut(e.stats.critChance, `${e.id}.critChance`, 1), ut(e.stats.critDamage, `${e.id}.critDamage`, 10), we(e.initialUltimate ?? 0, `${e.id}.initialUltimate`, 0, 100);
  for (const n of e.skillIds)
    if (!t[n]) throw new RangeError(`Unknown skill ${n} on ${e.id}`);
  if (e.boss) {
    we(e.boss.enrageTurn ?? 0, `${e.id}.enrageTurn`, 0, 1e4), ut(e.boss.enrageMultiplier ?? 1.5, `${e.id}.enrageMultiplier`), ut(e.boss.weakPointMultiplier ?? 1.5, `${e.id}.weakPointMultiplier`), we(e.boss.breakThreshold ?? 100, `${e.id}.breakThreshold`, 1);
    for (const n of e.boss.phases ?? []) {
      if (ut(n.hpRatio, `${e.id}.${n.id}.hpRatio`, 1), ut(n.attackMultiplier ?? 1, `${e.id}.${n.id}.attackMultiplier`), ut(n.defenseMultiplier ?? 1, `${e.id}.${n.id}.defenseMultiplier`), ut(n.speedMultiplier ?? 1, `${e.id}.${n.id}.speedMultiplier`), (n.summons?.length ?? 0) > 20) throw new RangeError(`${e.id}.${n.id} has too many summons`);
      for (const r of n.summons ?? []) ur(r, t);
    }
  }
}, li = (e) => {
  const t = dr(e);
  return {
    id: t.id,
    name: t.name,
    side: t.side,
    role: t.role,
    family: t.family,
    element: t.element,
    level: t.level,
    stats: t.stats,
    skillIds: [...t.skillIds],
    hp: t.stats.maxHp,
    shield: 0,
    ultimate: J(t.initialUltimate ?? 0, 0, 100),
    breakGauge: 0,
    cooldowns: {},
    modifiers: [],
    dots: [],
    controls: [],
    statuses: [],
    counter: null,
    alive: !0,
    bossState: t.boss ? { profile: t.boss, triggeredPhaseIds: [], enraged: !1, weakPoint: t.boss.weakPoint } : null
  };
}, _r = (e) => {
  const t = new Set(e.map((a) => a.role)), n = /* @__PURE__ */ new Map();
  for (const a of e)
    a.family && n.set(a.family, (n.get(a.family) ?? 0) + 1);
  const r = [...n.values()].reduce((a, l) => a + Math.floor(l / 2), 0), i = t.has("TANK") || t.has("GUARDIAN"), s = t.has("STRIKER") || t.has("BREAKER"), o = i && s && t.has("SUPPORT");
  return {
    roleDiversity: t.size,
    lineagePairs: r,
    attackBonus: J((t.size - 1) * 0.025 + r * 0.03 + (o ? 0.05 : 0), 0, 0.5),
    defenseBonus: J((i ? 0.06 : 0) + r * 0.02, 0, 0.5),
    speedBonus: J((t.has("CONTROLLER") ? 0.04 : 0) + Math.max(0, t.size - 3) * 0.01, 0, 0.25),
    breakBonus: J((t.has("BREAKER") ? 0.12 : 0) + (t.has("VANGUARD") ? 0.03 : 0), 0, 0.35),
    ultimateStart: J((t.has("SUPPORT") ? 8 : 0) + r * 4, 0, 30)
  };
}, di = (e, t) => {
  e.modifiers.push(
    { stat: "attack", value: t.attackBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: "team-synergy" },
    { stat: "defense", value: t.defenseBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: "team-synergy" },
    { stat: "speed", value: t.speedBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: "team-synergy" },
    { stat: "breakPower", value: t.breakBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: "team-synergy" }
  ), e.ultimate = J(e.ultimate + t.ultimateStart, 0, 100);
}, mr = (e) => {
  const t = Object.fromEntries(
    Object.entries(e.skills).map(([s, o]) => [s, { ...o, effects: o.effects.map((a) => ({ ...a })), tags: o.tags ? [...o.tags] : void 0 }])
  );
  for (const [s, o] of Object.entries(t))
    if (ci(o), s !== o.id) throw new RangeError(`Skill registry key ${s} does not match ${o.id}`);
  if (e.units.length < 2 || e.units.length > 50) throw new RangeError("A battle requires 2..50 starting combatants");
  const n = /* @__PURE__ */ new Set();
  for (const s of e.units) {
    if (ur(s, t), n.has(s.id)) throw new RangeError(`Duplicate combatant id ${s.id}`);
    n.add(s.id);
  }
  if (!e.units.some((s) => s.side === "PLAYER") || !e.units.some((s) => s.side === "ENEMY"))
    throw new RangeError("A battle requires both PLAYER and ENEMY combatants");
  const r = e.units.map(li), i = {
    PLAYER: _r(e.units.filter((s) => s.side === "PLAYER")),
    ENEMY: _r(e.units.filter((s) => s.side === "ENEMY"))
  };
  for (const s of r) di(s, i[s.side]);
  return {
    units: r,
    skills: t,
    turn: 0,
    maxTurns: Math.floor(we(e.maxTurns ?? 100, "maxTurns", 1, 1e4)),
    outcome: null,
    log: [],
    synergies: i
  };
}, $s = (e) => {
  if (!e || typeof e != "object") throw new TypeError("Advanced battle must be an object");
  const t = e;
  if (!Array.isArray(t.units) || t.units.length < 2 || t.units.length > 50) throw new RangeError("Advanced battle units are invalid");
  if (!t.skills || typeof t.skills != "object" || Array.isArray(t.skills)) throw new TypeError("Advanced battle skill book is invalid");
  for (const [r, i] of Object.entries(t.skills))
    if (ci(i), r !== i.id) throw new RangeError(`Skill registry key ${r} does not match ${i.id}`);
  if (we(t.turn, "advanced.turn", 0, 1e4), we(t.maxTurns, "advanced.maxTurns", 1, 1e4), !Number.isInteger(t.turn) || !Number.isInteger(t.maxTurns) || t.turn > t.maxTurns) throw new RangeError("Advanced battle turn is invalid");
  if (t.outcome !== null && !["PLAYER", "ENEMY", "DRAW"].includes(t.outcome)) throw new TypeError("Advanced battle outcome is invalid");
  const n = /* @__PURE__ */ new Set();
  for (const r of t.units) {
    if (ur({ ...r, boss: r.bossState?.profile }, t.skills), n.has(r.id)) throw new RangeError(`Duplicate advanced combatant id ${r.id}`);
    if (n.add(r.id), we(r.hp, `${r.id}.hp`, 0, r.stats.maxHp), we(r.shield, `${r.id}.shield`), we(r.ultimate, `${r.id}.ultimate`, 0, 100), we(r.breakGauge, `${r.id}.breakGauge`), r.alive !== r.hp > 0) throw new RangeError(`${r.id}.alive disagrees with hp`);
    const s = [...[r.cooldowns, r.modifiers, r.dots, r.controls, r.statuses, r.counter]];
    for (; s.length; ) {
      const o = s.pop();
      if (typeof o == "number" && !Number.isFinite(o)) throw new RangeError(`${r.id} has a non-finite runtime value`);
      Array.isArray(o) ? s.push(...o) : o && typeof o == "object" && s.push(...Object.values(o));
    }
  }
  if (!t.units.some((r) => r.side === "PLAYER") || !t.units.some((r) => r.side === "ENEMY")) throw new RangeError("Advanced battle requires both sides");
  if (!Array.isArray(t.log) || t.log.length > 1e5) throw new RangeError("Advanced battle log is invalid");
  for (const r of t.log) {
    if (!n.has(r.actorId) || !t.skills[r.skillId]) throw new RangeError("Advanced battle log references an unknown actor or skill");
    if (!Array.isArray(r.resolutions) || r.resolutions.some((i) => !n.has(i.targetId) || !Number.isFinite(i.amount))) throw new RangeError("Advanced battle resolution is invalid");
  }
  return t;
}, Te = (e, t) => {
  const n = e.modifiers.filter((i) => i.stat === t && i.turns > 0).reduce((i, s) => J(i * (1 + s.value), 0, 100), 1), r = e.statuses.filter((i) => t === "defense" && i.kind === "CRACK" || t === "speed" && i.kind === "SLOW").reduce((i, s) => i * (1 - J(s.power, 0, 0.9)), 1);
  return J(e.stats[t] * n * r);
}, gt = (e, t) => e.units.filter((n) => n.alive && (t === void 0 || n.side === t)), Ln = (e, t) => {
  const n = e.units.find((i) => i.id === t);
  if (!n?.alive) return [];
  const r = n.controls.some((i) => i.kind === "SILENCE" && i.turns > 0);
  return n.skillIds.map((i) => e.skills[i]).filter((i) => !!i).filter((i) => (n.cooldowns[i.id] ?? 0) <= 0).filter((i) => (i.ultimateCost ?? 0) <= n.ultimate).filter((i) => !(r && (i.ultimateCost ?? 0) > 0));
}, pr = (e) => gt(e).sort((t, n) => Te(n, "speed") - Te(t, "speed") || t.id.localeCompare(n.id)).map((t) => t.id), Ps = (e, t) => gt(e, t.side === "PLAYER" ? "ENEMY" : "PLAYER"), Fs = (e, t) => gt(e, t.side), In = (e, t) => {
  if (!t?.length) return e;
  const n = new Set(t);
  return e.filter((r) => n.has(r.id));
}, Bs = (e, t, n, r) => {
  const i = Fs(e, t), s = Ps(e, t);
  switch (n.target) {
    case "SELF":
      return r?.length && !r.includes(t.id) ? [] : [t];
    case "ALL_ALLIES":
      return i;
    case "ALLY_LOWEST": {
      const o = In(i, r)[0];
      return r?.length && !o ? [] : [o ?? [...i].sort((a, l) => a.hp / a.stats.maxHp - l.hp / l.stats.maxHp || a.id.localeCompare(l.id))[0]].filter(
        (a) => !!a
      );
    }
    case "ALL_ENEMIES":
      return s;
    case "BOSS": {
      const o = s.filter((l) => l.bossState), a = In(o, r)[0];
      return r?.length && !a ? [] : [a ?? o[0] ?? In(s, r)[0] ?? s[0]].filter(
        (l) => !!l
      );
    }
    case "ENEMY": {
      const o = s.find((l) => l.controls.some((d) => d.kind === "TAUNT" && d.turns > 0)), a = In(s, r)[0];
      return r?.length && !a ? [] : [o ?? a ?? s[0]].filter((l) => !!l);
    }
  }
}, fr = (e, t) => e.side !== t.side, hr = (e, t, n = 1) => {
  const r = Te(e, "accuracy"), i = Te(t, "resistance");
  return J((0.82 + (r - i) / (r + i + 200)) * n, 0.05, 0.99);
}, ui = (e, t, n, r, i) => {
  if (!i.chance(hr(e, t, r.chance ?? 1))) return { targetId: t.id, kind: r.kind, hit: !1, amount: 0 };
  const s = i.chance(J(Te(e, "critChance"), 0, 0.95)), o = Te(e, "attack"), a = Te(t, "defense"), l = J(1 + (e.level - t.level) * 0.015, 0.25, 4), d = 100 / (100 + Math.sqrt(Math.max(0, a)) * 8);
  let u = J(o * (r.power ?? 1) * l * d);
  const h = n.element ?? e.element, w = {
    FIRE: ["EARTH"],
    EARTH: ["WIND"],
    WIND: ["WATER"],
    WATER: ["FIRE"],
    LIGHT: ["DARK"],
    DARK: ["LIGHT"],
    METAL: ["CRYSTAL"],
    CRYSTAL: ["ANCIENT"],
    ANCIENT: ["METAL"]
  };
  h && t.element && (w[h]?.includes(t.element) ? u = J(u * 1.2) : w[t.element]?.includes(h) && (u = J(u * 0.84))), s && (u = J(u * Te(e, "critDamage")));
  const E = t.bossState?.weakPoint;
  E && n.element === E && (u = J(u * (t.bossState?.profile.weakPointMultiplier ?? 1.5)));
  const m = t.statuses.filter((p) => p.kind === "VULNERABLE").reduce((p, f) => p * (1 + J(f.power, 0, 2)), 1);
  u = J(u * m), t.controls.some((p) => p.kind === "STUN" && p.sourceId === "break") && (u = J(u * 1.25));
  const A = Math.max(1, Pt(u)), S = Math.min(t.shield, A);
  t.shield = J(t.shield - S);
  let k = S;
  for (const p of t.statuses.filter((f) => f.kind === "SHIELD")) {
    const f = Math.min(p.power, k);
    if (p.power -= f, k -= f, k <= 0) break;
  }
  const T = Math.min(t.hp, A - S);
  return t.hp = J(t.hp - T, 0, t.stats.maxHp), t.alive = t.hp > 0, t.ultimate = J(t.ultimate + Math.min(15, 5 + T / Math.max(1, t.stats.maxHp) * 20), 0, 100), { targetId: t.id, kind: r.kind, hit: !0, amount: T, absorbed: S, critical: s };
}, qs = (e, t, n) => {
  const r = Math.max(1, Pt(Te(e, "attack") * (n.power ?? 1))), i = Math.min(r, t.stats.maxHp - t.hp);
  return t.hp = J(t.hp + i, 0, t.stats.maxHp), t.hp > 0 && (t.alive = !0), { targetId: t.id, kind: n.kind, hit: !0, amount: i };
}, mi = (e, t, n) => {
  const r = Math.max(1, Pt(Te(e, "attack") * (n.power ?? 1))), i = t.shield;
  return t.shield = J(t.shield + r, 0, t.stats.maxHp * 3), { targetId: t.id, kind: n.kind, hit: !0, amount: t.shield - i };
}, Gs = (e, t, n, r) => {
  if (n.kind === "DEBUFF" && fr(e, t) && !r.chance(hr(e, t, n.chance ?? 1)))
    return { targetId: t.id, kind: n.kind, hit: !1, amount: 0 };
  const s = n.kind === "DEBUFF" ? -Math.abs(n.value ?? 0.15) : Math.abs(n.value ?? 0.15);
  return t.modifiers.push({ stat: n.stat, value: J(s, -0.9, 5), turns: Math.max(1, Math.floor(n.duration ?? 2)), sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: s, status: n.stat };
}, Us = (e, t, n, r) => {
  if (fr(e, t) && !r.chance(hr(e, t, n.chance ?? 1)))
    return { targetId: t.id, kind: n.kind, hit: !1, amount: 0 };
  if (n.kind === "DOT")
    return t.dots.push({ id: `${e.id}:${t.dots.length}`, power: J(n.power ?? 0.04, 0, 1), turns: Math.max(1, Math.floor(n.duration ?? 2)), sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: n.power ?? 0.04, status: "DOT" };
  if (n.kind === "CONTROL") {
    const s = n.control ?? "STUN";
    return t.controls.push({ kind: s, turns: Math.max(1, Math.floor(n.duration ?? 1)), sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: 0, status: s };
  }
  if (n.kind === "BREAK") {
    const s = t.statuses.some((l) => l.kind === "CRACK"), o = J(((n.value ?? 20) + Te(e, "breakPower") * (n.power ?? 1)) * (s ? 1.3 : 1));
    t.breakGauge = J(t.breakGauge + o, 0, t.bossState?.profile.breakThreshold ?? 100);
    const a = t.bossState?.profile.breakThreshold ?? 100;
    return t.breakGauge >= a && (t.breakGauge = 0, t.controls.push({ kind: "STUN", turns: 1, sourceId: "break" })), { targetId: t.id, kind: n.kind, hit: !0, amount: o };
  }
  if (n.kind === "COUNTER")
    return t.counter = { power: J(n.power ?? 0.6, 0, 10), turns: Math.max(1, Math.floor(n.duration ?? 2)), sourceId: e.id }, { targetId: t.id, kind: n.kind, hit: !0, amount: n.power ?? 0.6, status: "COUNTER" };
  if (n.kind === "STATUS") {
    const s = n.status, o = Math.max(1, Math.floor(n.duration ?? 2));
    if (s === "STUN" || s === "SILENCE")
      return t.controls.push({ kind: s, turns: o, sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: 0, status: s };
    if (s === "SHIELD") {
      const d = mi(e, t, n);
      return t.statuses.push({ kind: s, power: d.amount, turns: o, sourceId: e.id }), { ...d, kind: n.kind, status: s };
    }
    const a = {
      BURN: 0.035,
      CRACK: 0.18,
      VULNERABLE: 0.16,
      SLOW: 0.18,
      REGENERATION: 0.08
    }, l = J(n.power ?? a[s] ?? 0, 0, s === "REGENERATION" || s === "BURN" ? 1 : 2);
    return t.statuses.push({ kind: s, power: l, turns: o, sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: l, status: s };
  }
  const i = J(n.value ?? 10, 0, 100);
  return t.ultimate = J(t.ultimate + i, 0, 100), { targetId: t.id, kind: n.kind, hit: !0, amount: i };
}, pi = (e, t) => {
  if (!t.bossState) return;
  const n = t.hp / Math.max(1, t.stats.maxHp), r = [...t.bossState.profile.phases ?? []].sort((i, s) => s.hpRatio - i.hpRatio);
  for (const i of r)
    if (!(n > i.hpRatio || t.bossState.triggeredPhaseIds.includes(i.id))) {
      t.bossState.triggeredPhaseIds.push(i.id), i.attackMultiplier !== void 0 && t.modifiers.push({ stat: "attack", value: i.attackMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${i.id}` }), i.defenseMultiplier !== void 0 && t.modifiers.push({ stat: "defense", value: i.defenseMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${i.id}` }), i.speedMultiplier !== void 0 && t.modifiers.push({ stat: "speed", value: i.speedMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${i.id}` }), i.weakPoint && (t.bossState.weakPoint = i.weakPoint), t.ultimate = J(t.ultimate + (i.ultimateGain ?? 0), 0, 100);
      for (const [s, o] of (i.summons ?? []).entries()) {
        const a = dr(o);
        a.side = t.side, a.id = `${t.id}:${i.id}:${s}:${a.id}`;
        const l = li(a);
        di(l, e.synergies[t.side]), e.units.push(l);
      }
    }
}, an = (e) => {
  const t = e.units.some((r) => r.side === "PLAYER" && r.alive), n = e.units.some((r) => r.side === "ENEMY" && r.alive);
  !t && !n ? e.outcome = "DRAW" : n ? t ? e.turn >= e.maxTurns && (e.outcome = "DRAW") : e.outcome = "ENEMY" : e.outcome = "PLAYER";
}, Hs = (e, t, n, r) => {
  if (!t.alive || !n.alive || !t.counter || t.counter.turns <= 0) return;
  const i = ui(
    t,
    n,
    {},
    { kind: "DAMAGE", power: t.counter.power, chance: 1 },
    r
  );
  return n.bossState && pi(e, n), { actorId: t.id, targetId: n.id, damage: i.amount };
}, js = (e, t, n) => {
  if (e.outcome) throw new RangeError("Battle has already ended");
  const r = e.units.find((d) => d.id === t.actorId);
  if (!r?.alive) throw new RangeError(`Actor ${t.actorId} is unavailable`);
  const i = e.skills[t.skillId];
  if (!i || !r.skillIds.includes(i.id)) throw new RangeError(`Skill ${t.skillId} is unavailable`);
  if (!Ln(e, r.id).some((d) => d.id === i.id)) throw new RangeError(`Skill ${t.skillId} is not ready`);
  const s = Bs(e, r, i, t.targetIds);
  if (s.length === 0) throw new RangeError(`Skill ${t.skillId} has no valid target`);
  r.ultimate = J(r.ultimate - (i.ultimateCost ?? 0), 0, 100), (i.cooldown ?? 0) > 0 && (r.cooldowns[i.id] = Math.floor(i.cooldown ?? 0) + 1);
  const o = [];
  let a;
  for (const d of i.effects) {
    for (const u of s.filter((h) => h.alive)) {
      let h;
      if (d.kind === "DAMAGE" ? h = ui(r, u, i, d, n) : d.kind === "HEAL" ? h = qs(r, u, d) : d.kind === "SHIELD" ? h = mi(r, u, d) : d.kind === "BUFF" || d.kind === "DEBUFF" ? h = Gs(r, u, d, n) : h = Us(r, u, d, n), o.push(h), d.kind === "DAMAGE" && h.hit && u.bossState && pi(e, u), d.kind === "DAMAGE" && h.hit && (h.amount > 0 || (h.absorbed ?? 0) > 0) && fr(r, u) && (a = Hs(e, u, r, n) ?? a), an(e), e.outcome) break;
    }
    if (e.outcome) break;
  }
  (i.ultimateCost ?? 0) === 0 && (r.ultimate = J(r.ultimate + 12, 0, 100));
  const l = { turn: e.turn, actorId: r.id, skillId: i.id, resolutions: o, counter: a };
  return e.log.push(l), an(e), l;
}, Ys = (e, t) => {
  for (const n of t.dots) {
    const r = Math.max(1, Pt(t.stats.maxHp * n.power));
    t.hp = J(t.hp - Math.min(t.hp, r), 0, t.stats.maxHp), n.turns -= 1;
  }
  t.dots = t.dots.filter((n) => n.turns > 0);
  for (const n of t.statuses)
    if (n.kind === "BURN") {
      const r = Math.max(1, Pt(t.stats.maxHp * n.power));
      t.hp = J(t.hp - Math.min(t.hp, r), 0, t.stats.maxHp);
    } else if (n.kind === "REGENERATION" && t.hp > 0) {
      const r = Math.max(1, Pt(t.stats.maxHp * n.power));
      t.hp = J(t.hp + r, 0, t.stats.maxHp);
    }
  return t.alive = t.hp > 0, an(e), t.controls.some((n) => n.kind === "STUN" && n.turns > 0);
}, Vs = (e) => {
  for (const n of Object.keys(e.cooldowns)) e.cooldowns[n] = Math.max(0, (e.cooldowns[n] ?? 0) - 1);
  for (const n of e.modifiers) n.turns < Number.MAX_SAFE_INTEGER && (n.turns -= 1);
  e.modifiers = e.modifiers.filter((n) => n.turns > 0);
  for (const n of e.controls) n.turns -= 1;
  e.controls = e.controls.filter((n) => n.turns > 0);
  for (const n of e.statuses) n.turns -= 1;
  const t = e.statuses.filter((n) => n.kind === "SHIELD" && n.turns <= 0).reduce((n, r) => n + r.power, 0);
  e.shield = J(e.shield - t, 0, e.stats.maxHp * 3), e.statuses = e.statuses.filter((n) => n.turns > 0 && (n.kind !== "SHIELD" || n.power > 0)), e.counter && (e.counter.turns -= 1, e.counter.turns <= 0 && (e.counter = null));
}, Xs = (e) => {
  for (const t of e.units) {
    const n = t.bossState;
    if (!t.alive || !n || n.enraged || !n.profile.enrageTurn || e.turn < n.profile.enrageTurn) continue;
    n.enraged = !0;
    const r = (n.profile.enrageMultiplier ?? 1.5) - 1;
    t.modifiers.push(
      { stat: "attack", value: r, turns: Number.MAX_SAFE_INTEGER, sourceId: "enrage" },
      { stat: "speed", value: r * 0.5, turns: Number.MAX_SAFE_INTEGER, sourceId: "enrage" }
    );
  }
}, Dn = (e, t, n) => {
  if (e.outcome) return e;
  e.turn += 1, Xs(e);
  const r = pr(e);
  for (const i of r) {
    if (e.outcome) break;
    const s = e.units.find((a) => a.id === i);
    if (!s?.alive) continue;
    const o = Ys(e, s);
    if (!e.outcome && !o) {
      const a = t.commands?.[i] ?? t.commandProvider?.(e, i, n) ?? null;
      a && js(e, a, n);
    }
    Vs(s);
  }
  return an(e), e;
}, fi = (e, t, n) => {
  for (; !e.outcome && e.turn < e.maxTurns; ) Dn(e, { commandProvider: t }, n);
  return an(e), e;
}, Ws = {
  strike: { id: "strike", name: "Stone Strike", target: "ENEMY", effects: [{ kind: "DAMAGE", power: 1 }], tags: ["ATTACK"] },
  sweep: { id: "sweep", name: "Shard Sweep", target: "ALL_ENEMIES", effects: [{ kind: "DAMAGE", power: 0.68 }], cooldown: 2, tags: ["ATTACK"] },
  mend: {
    id: "mend",
    name: "Crystal Mend",
    target: "ALLY_LOWEST",
    effects: [{ kind: "HEAL", power: 1.1 }, { kind: "STATUS", status: "REGENERATION", power: 0.06, duration: 2 }],
    cooldown: 2,
    tags: ["HEAL"]
  },
  bulwark: {
    id: "bulwark",
    name: "Reflecting Bulwark",
    target: "SELF",
    effects: [{ kind: "STATUS", status: "SHIELD", power: 0.8, duration: 2 }, { kind: "COUNTER", power: 0.55, duration: 2 }],
    cooldown: 3,
    tags: ["DEFENSE"]
  },
  fracture: {
    id: "fracture",
    name: "Fracture",
    target: "ENEMY",
    effects: [
      { kind: "DAMAGE", power: 0.65 },
      { kind: "STATUS", status: "CRACK", power: 0.16, duration: 2 },
      { kind: "STATUS", status: "VULNERABLE", power: 0.12, duration: 2 },
      { kind: "BREAK", value: 28, power: 0.5 }
    ],
    cooldown: 1,
    tags: ["ATTACK", "BREAK"]
  },
  eclipse: {
    id: "eclipse",
    name: "Eclipse Dust",
    target: "ALL_ENEMIES",
    effects: [
      { kind: "STATUS", status: "BURN", power: 0.035, duration: 3 },
      { kind: "STATUS", status: "SLOW", power: 0.15, duration: 2 },
      { kind: "STATUS", status: "SILENCE", duration: 1, chance: 0.8 },
      { kind: "DEBUFF", stat: "attack", value: 0.18, duration: 2 }
    ],
    cooldown: 3,
    tags: ["CONTROL"]
  },
  stun: { id: "stun", name: "Seismic Lock", target: "ENEMY", effects: [{ kind: "STATUS", status: "STUN", duration: 1, chance: 0.85 }], cooldown: 3, tags: ["CONTROL"] },
  nova: {
    id: "nova",
    name: "Astral Nova",
    target: "ALL_ENEMIES",
    element: "LIGHT",
    effects: [{ kind: "DAMAGE", power: 2.2 }, { kind: "BREAK", value: 35, power: 0.8 }],
    ultimateCost: 100,
    tags: ["ATTACK", "BREAK", "ULTIMATE"]
  }
}, Ks = ["BALANCED", "AGGRESSIVE", "DEFENSIVE", "BOSS_FOCUS", "RESOURCE_SAVE"], zs = [...Ks, "CONTROL", "BOSS_HUNTER"], pe = (e, t) => e.tags?.includes(t) ?? !1, Er = (e) => e.side === "PLAYER" ? "ENEMY" : "PLAYER", kr = {
  FIRE: ["EARTH"],
  EARTH: ["WIND"],
  WIND: ["WATER"],
  WATER: ["FIRE"],
  LIGHT: ["DARK"],
  DARK: ["LIGHT"],
  METAL: ["CRYSTAL"],
  CRYSTAL: ["ANCIENT"],
  ANCIENT: ["METAL"]
}, Ae = (e, t) => {
  e.includes(t) || e.push(t);
}, hi = (e, t, n) => {
  if (!pe(t, "ATTACK") && !t.effects.some((i) => i.kind === "DAMAGE")) return { score: 0 };
  if (t.element && n.bossState?.weakPoint === t.element)
    return { score: 350, reason: "element-weak-point" };
  const r = t.element ?? e.element;
  return !r || !n.element || r === "NEUTRAL" || n.element === "NEUTRAL" ? { score: 0 } : kr[r]?.includes(n.element) ? { score: 120, reason: "element-advantage" } : kr[n.element]?.includes(r) ? { score: -170, reason: "element-resisted" } : { score: 0 };
}, gr = (e, t) => gt(e, t.side).sort(
  (n, r) => n.hp / Math.max(1, n.stats.maxHp) - r.hp / Math.max(1, r.stats.maxHp) || n.id.localeCompare(r.id)
)[0], zn = (e, t, n) => e.modifiers.some(
  (r) => r.turns > 0 && r.sourceId !== "team-synergy" && r.stat === t && (n ? r.value > 0 : r.value < 0)
), bt = (e, t) => e.controls.some((n) => n.turns > 0 && n.kind === t), vn = (e, t) => e.statuses.some((n) => n.turns > 0 && n.kind === t), Qs = (e, t) => e.effects.reduce((n, r) => {
  if (r.kind === "DEBUFF" && r.stat) return n + (zn(t, r.stat, !1) ? -55 : 35);
  if (r.kind === "DOT") return n + (t.dots.some((i) => i.turns > 0) ? -55 : 35);
  if (r.kind === "CONTROL") return n + (bt(t, r.control ?? "STUN") ? -70 : 45);
  if (r.kind === "STATUS" && r.status) {
    if (r.status === "STUN" || r.status === "SILENCE")
      return n + (bt(t, r.status) ? -70 : 45);
    if (["BURN", "CRACK", "VULNERABLE", "SLOW"].includes(r.status))
      return n + (vn(t, r.status) ? -55 : 35);
  }
  return n;
}, 0), Cr = (e, t, n, r) => {
  let i = Math.round((1 - t.hp / Math.max(1, t.stats.maxHp)) * 100);
  const s = hi(e, n, t);
  if (i += s.score, i += Qs(n, t), n.effects.some((o) => !["HEAL", "SHIELD", "BUFF", "COUNTER", "ULTIMATE_GAIN"].includes(o.kind))) {
    const o = Te(e, "accuracy"), a = Te(t, "resistance");
    i += Math.max(-120, Math.min(50, Math.round((o - a) / Math.max(200, o + a + 200) * 240)));
  }
  return t.bossState && (r === "BOSS_HUNTER" || r === "BOSS_FOCUS") && (i += 2e3), t.bossState && r === "CONTROL" && !bt(t, "STUN") && (i += 1200), i;
}, Ei = (e, t, n, r) => {
  const i = gt(e, Er(t)), s = i.filter((a) => a.bossState);
  return [...r.target === "BOSS" && s.length > 0 ? s : i].sort(
    (a, l) => Cr(t, l, r, n) - Cr(t, a, r, n) || a.hp / Math.max(1, a.stats.maxHp) - l.hp / Math.max(1, l.stats.maxHp) || a.id.localeCompare(l.id)
  )[0];
}, Js = (e, t) => {
  switch (e) {
    case "AGGRESSIVE":
      return (pe(t, "ATTACK") ? 180 : 0) + (pe(t, "ULTIMATE") ? 200 : 0);
    case "DEFENSIVE":
      return (pe(t, "HEAL") ? 220 : 0) + (pe(t, "DEFENSE") ? 180 : 0);
    case "CONTROL":
      return (pe(t, "CONTROL") ? 240 : 0) + (pe(t, "BREAK") ? 190 : 0);
    case "BOSS_HUNTER":
    case "BOSS_FOCUS":
      return (pe(t, "ATTACK") ? 100 : 0) + (pe(t, "BREAK") ? 210 : 0);
    case "RESOURCE_SAVE":
      return (t.ultimateCost ?? 0) > 0 ? -1050 : (t.cooldown ?? 0) > 1 ? -120 : 130;
    case "BALANCED":
      return pe(t, "ATTACK") ? 70 : 50;
  }
}, gi = (e, t, n, r) => {
  if (n.target === "ALL_ENEMIES") return gt(e, Er(t));
  if (n.target === "ENEMY" || n.target === "BOSS") {
    const i = Ei(e, t, r, n);
    return i ? [i] : [];
  }
  return [];
}, Zs = (e, t, n) => {
  if (n.target === "SELF") return [t];
  if (n.target === "ALL_ALLIES") return gt(e, t.side);
  if (n.target === "ALLY_LOWEST") {
    const r = gr(e, t);
    return r ? [r] : [];
  }
  return [];
}, Je = (e, t, n = 180, r = 220) => {
  if (t === 0) return 0;
  const i = e / t;
  return Math.round(n * i - r * (1 - i));
}, eo = (e, t, n, r, i) => {
  const s = gi(e, t, n, r), o = Zs(e, t, n);
  let a = 0;
  for (const l of n.effects)
    if (l.kind === "BUFF" && l.stat && o.length > 0) {
      const d = o.filter((u) => !zn(u, l.stat, !0)).length;
      a += Je(d, o.length), Ae(i, d > 0 ? "buff-coverage" : "buff-already-active");
    } else if (l.kind === "DEBUFF" && l.stat && s.length > 0) {
      const d = s.filter((u) => !zn(u, l.stat, !1)).length;
      a += Je(d, s.length), Ae(i, d > 0 ? "debuff-coverage" : "debuff-already-active");
    } else if (l.kind === "DOT" && s.length > 0) {
      const d = s.filter((u) => !u.dots.some((h) => h.turns > 0)).length;
      a += Je(d, s.length, 160, 210), Ae(i, d > 0 ? "dot-window" : "dot-already-active");
    } else if (l.kind === "CONTROL" && s.length > 0) {
      const d = l.control ?? "STUN", u = s.filter((h) => !bt(h, d)).length;
      a += Je(u, s.length, 190, 260), Ae(i, u > 0 ? "control-window" : "control-already-active");
    } else if (l.kind === "BREAK" && s.length > 0) {
      const d = s.filter((h) => !bt(h, "STUN")).length, u = Math.max(
        0,
        ...s.map((h) => h.breakGauge / Math.max(1, h.bossState?.profile.breakThreshold ?? 100))
      );
      a += Je(d, s.length, 100 + Math.round(u * 160), 230), Ae(i, d > 0 ? "break-progress" : "break-already-controlled");
    } else if (l.kind === "SHIELD" && o.length > 0) {
      const d = o.filter((u) => u.shield < u.stats.maxHp * 0.25).length;
      a += Je(d, o.length, 150, 230), Ae(i, d > 0 ? "shield-window" : "shield-already-active");
    } else if (l.kind === "STATUS" && l.status) {
      if ((l.status === "STUN" || l.status === "SILENCE") && s.length > 0) {
        const d = s.filter((u) => !bt(u, l.status)).length;
        a += Je(d, s.length, 190, 260), Ae(i, d > 0 ? "control-window" : "control-already-active");
      } else if (["BURN", "CRACK", "VULNERABLE", "SLOW"].includes(l.status) && s.length > 0) {
        const d = s.filter((u) => !vn(u, l.status)).length;
        a += Je(d, s.length, 150, 210), Ae(i, d > 0 ? l.status === "BURN" ? "dot-window" : "debuff-coverage" : l.status === "BURN" ? "dot-already-active" : "debuff-already-active");
      } else if (l.status === "REGENERATION" && o.length > 0) {
        const d = o.filter((u) => !vn(u, l.status) && u.hp < u.stats.maxHp).length;
        a += Je(d, o.length, 130, 190), Ae(i, d > 0 ? "buff-coverage" : "buff-already-active");
      } else if (l.status === "SHIELD" && o.length > 0) {
        const d = o.filter((u) => !vn(u, l.status) && u.shield < u.stats.maxHp * 0.25).length;
        a += Je(d, o.length, 150, 230), Ae(i, d > 0 ? "shield-window" : "shield-already-active");
      }
    }
  return a;
}, to = (e, t, n, r) => {
  const i = gt(e, Er(t)), s = gr(e, t), o = s ? s.hp / Math.max(1, s.stats.maxHp) : 1, a = gi(e, t, n, r), l = a.find((w) => w.bossState);
  let d = n.priority ?? 0;
  const u = [];
  if (d += Js(r, n), t.role === "BREAKER" && pe(n, "BREAK") && (d += 180), t.role === "GUARDIAN" && pe(n, "DEFENSE") && (d += 180), pe(n, "HEAL") && (d += Math.round((1 - o) * 500), o <= 0.42 ? (d += 1200, u.push("emergency-heal")) : o >= 0.98 && (d -= 600)), pe(n, "DEFENSE")) {
    const w = t.hp / Math.max(1, t.stats.maxHp);
    d += Math.round((1 - w) * 250), t.shield > t.stats.maxHp * 0.4 && (d -= 300);
  }
  if ((n.ultimateCost ?? 0) > 0 ? (d += 900, Ae(u, "ready-ultimate")) : r === "RESOURCE_SAVE" && Ae(u, "resource-conservation"), n.target === "ALL_ENEMIES" && (d += i.length * 90, i.length >= 3 ? (d += 320, Ae(u, "multi-target")) : i.length === 1 && (d -= 100)), l && (r === "BOSS_HUNTER" || r === "BOSS_FOCUS") && (n.target === "ENEMY" || n.target === "BOSS") && (d += 420, Ae(u, "boss-focus")), l && (pe(n, "BREAK") || pe(n, "CONTROL")) && !bt(l, "STUN") && (d += 260, Ae(u, "break-window")), d += eo(e, t, n, r, u), a.length > 0) {
    const w = a.map((m) => hi(t, n, m));
    d += Math.round(w.reduce((m, A) => m + A.score, 0) / a.length);
    for (const m of w) m.reason && Ae(u, m.reason);
    if (n.effects.some((m) => !["HEAL", "SHIELD", "BUFF", "COUNTER", "ULTIMATE_GAIN"].includes(m.kind))) {
      const m = Te(t, "accuracy"), A = a.reduce((k, T) => k + Te(T, "resistance"), 0) / a.length, S = Math.round((m - A) / Math.max(200, m + A + 200) * 300);
      d += Math.max(-180, Math.min(60, S)), A > m && Ae(u, "target-resistance");
    }
  }
  const h = a.filter((w) => w.bossState);
  if (h.some((w) => (w.bossState?.triggeredPhaseIds.length ?? 0) > 0)) {
    const w = Math.max(...h.map((m) => m.bossState?.triggeredPhaseIds.length ?? 0)), E = (pe(n, "ATTACK") ? 70 : 0) + (pe(n, "BREAK") || pe(n, "CONTROL") ? 130 : 0) + (pe(n, "ULTIMATE") ? 100 : 0) + Math.min(90, w * 30);
    E > 0 && (d += E, Ae(u, "boss-phase-active"));
  }
  if (h.some((w) => w.bossState?.enraged)) {
    const w = (pe(n, "ATTACK") ? 100 : 0) + (pe(n, "BREAK") || pe(n, "CONTROL") ? 240 : 0) + (pe(n, "ULTIMATE") ? 420 : 0) + (pe(n, "HEAL") || pe(n, "DEFENSE") ? 120 : 0);
    w > 0 && (d += w, Ae(u, "boss-enraged"));
  }
  return { score: d, reasons: u };
}, no = (e, t, n, r) => {
  if (n.target === "ALLY_LOWEST") {
    const i = gr(e, t);
    return { actorId: t.id, skillId: n.id, targetIds: i ? [i.id] : void 0 };
  }
  if (n.target === "ENEMY" || n.target === "BOSS") {
    const i = Ei(e, t, n.target === "BOSS" ? "BOSS_HUNTER" : r, n);
    return { actorId: t.id, skillId: n.id, targetIds: i ? [i.id] : void 0 };
  }
  return { actorId: t.id, skillId: n.id };
}, ro = (e, t, n, r) => {
  if (!zs.includes(n)) throw new RangeError(`Unknown AI strategy ${String(n)}`);
  const i = e.units.find((d) => d.id === t);
  if (!i?.alive || e.outcome) return { command: null, score: Number.NEGATIVE_INFINITY, reasons: ["actor-unavailable"] };
  const s = Ln(e, t).map((d) => ({ skill: d, ...to(e, i, d, n) }));
  if (s.length === 0) return { command: null, score: Number.NEGATIVE_INFINITY, reasons: ["no-usable-skill"] };
  const o = Math.max(...s.map((d) => d.score)), l = s.filter((d) => d.score === o).sort((d, u) => d.skill.id.localeCompare(u.skill.id))[0];
  return l ? { command: no(e, i, l.skill, n), score: l.score, reasons: l.reasons } : { command: null, score: Number.NEGATIVE_INFINITY, reasons: ["no-usable-skill"] };
}, io = (e, t, n, r) => ro(e, t, n).command, Gt = (e = "BALANCED") => (t, n, r) => {
  const i = t.units.find((s) => s.id === n);
  return i ? io(t, n, typeof e == "function" ? e(i) : e) : null;
}, Ze = 1e6, Rn = Number.MAX_SAFE_INTEGER, Tt = 100, so = ["BATTLE", "MINING", "TREASURE", "ELITE", "REST", "RANDOM_EVENT", "BOSS"], Ut = {
  maxFloor: Ze,
  checkpointInterval: 10,
  efficiency: { ACTIVE: 1, AUTO: 0.94, OFFLINE: 0.78 }
}, xr = ["CRYSTAL_CAVERN", "MAGMA_VEIN", "FOSSIL_DEPTHS", "ASTRAL_RIFT"], Or = ["FIRE", "WATER", "EARTH", "WIND", "LIGHT", "DARK", "METAL", "CRYSTAL"], oo = {
  BATTLE: { label: "Shard Ambush", description: "通常戦闘。安定したDepth Creditを得る。", rewardMultiplier: 1, powerMultiplier: 1, equipmentChance: 0.18, recoveryRatio: 0, risk: 0.12 },
  MINING: { label: "Resonance Vein", description: "採掘力を試し、Creditと装備鉱石を回収する。", rewardMultiplier: 1.18, powerMultiplier: 0.62, equipmentChance: 0.34, recoveryRatio: 0, risk: 0.32 },
  TREASURE: { label: "Sealed Geode", description: "罠を見切れば高密度の報酬を得る。", rewardMultiplier: 1.72, powerMultiplier: 0.38, equipmentChance: 0.78, recoveryRatio: 0, risk: 0.58 },
  ELITE: { label: "Elite Formation", description: "強化個体との高リスク戦闘。", rewardMultiplier: 1.7, powerMultiplier: 1.12, equipmentChance: 0.58, recoveryRatio: 0, risk: 0.24 },
  REST: { label: "Quiet Stratum", description: "安全な地層で共鳴を30%回復する。", rewardMultiplier: 0.28, powerMultiplier: 0, equipmentChance: 0, recoveryRatio: 0.3, risk: 0 },
  RANDOM_EVENT: { label: "Unknown Signal", description: "Seedで固定された未知現象を突破する。", rewardMultiplier: 1.42, powerMultiplier: 0.82, equipmentChance: 0.42, recoveryRatio: 0.08, risk: 0.85 },
  BOSS: { label: "Depth Guardian", description: "10層ごとのGuardian戦。Checkpointを確保する。", rewardMultiplier: 4, powerMultiplier: 1.15, equipmentChance: 1, recoveryRatio: 0, risk: 0.3 }
}, ao = {
  LOW_GRAVITY: { id: "LOW_GRAVITY", label: "Low Gravity", attackMultiplier: 1, defenseMultiplier: 1, speedMultiplier: 1.12, accuracyMultiplier: 1, breakMultiplier: 1 },
  STONE_DUST: { id: "STONE_DUST", label: "Stone Dust", attackMultiplier: 1.06, defenseMultiplier: 1, speedMultiplier: 1, accuracyMultiplier: 0.9, breakMultiplier: 1 },
  FRACTURED_GROUND: { id: "FRACTURED_GROUND", label: "Fractured Ground", attackMultiplier: 1, defenseMultiplier: 0.93, speedMultiplier: 1, accuracyMultiplier: 1, breakMultiplier: 1.2 },
  RESONANT_AIR: { id: "RESONANT_AIR", label: "Resonant Air", attackMultiplier: 1.1, defenseMultiplier: 1.06, speedMultiplier: 1, accuracyMultiplier: 1.05, breakMultiplier: 1 }
}, co = {
  id: "BOSS_FLOOR",
  label: "Guardian Domain",
  attackMultiplier: 1.12,
  defenseMultiplier: 1.14,
  speedMultiplier: 1.04,
  accuracyMultiplier: 1.06,
  breakMultiplier: 1.1
}, lo = [
  { id: "WEEKLY_OVERCHARGE", label: "Weekly: Overcharge", attackMultiplier: 1.08, defenseMultiplier: 1, speedMultiplier: 1.04, accuracyMultiplier: 1, breakMultiplier: 1 },
  { id: "WEEKLY_FORTUNE", label: "Weekly: Fortune Vein", attackMultiplier: 1, defenseMultiplier: 1.03, speedMultiplier: 1, accuracyMultiplier: 1.03, breakMultiplier: 1.04 },
  { id: "WEEKLY_FRACTURE", label: "Weekly: Deep Fracture", attackMultiplier: 1.04, defenseMultiplier: 0.96, speedMultiplier: 1, accuracyMultiplier: 1, breakMultiplier: 1.12 }
], Be = (e, t = Rn) => Number.isFinite(e) ? Math.max(0, Math.min(t, e)) : e > 0 ? t : 0, uo = (e, t = Ze) => {
  if (!Number.isSafeInteger(e) || e < 1 || e > t) throw new RangeError(`floor must be an integer within 1..${t}`);
  return e;
}, mo = (e) => Math.round((1 + e * 0.032 + Math.pow(e, 1.18) * 18e-4) * 1e5) / 1e5, Lr = (e, t, n, r, i, s) => {
  const o = r.reduce(
    (u, h) => ({
      attack: u.attack * h.attackMultiplier,
      defense: u.defense * h.defenseMultiplier,
      speed: u.speed * h.speedMultiplier,
      accuracy: u.accuracy * h.accuracyMultiplier,
      breakPower: u.breakPower * h.breakMultiplier
    }),
    { attack: 1, defense: 1, speed: 1, accuracy: 1, breakPower: 1 }
  ), a = i ? 2.25 : 1, l = Math.round(Be((390 + e * 22) * n * a, 1e9)), d = {
    id: "echo",
    name: "Guardian Echo",
    side: "ENEMY",
    role: "CONTROLLER",
    family: "mine-echo",
    level: e,
    stats: {
      maxHp: Math.round(l * 0.18),
      attack: Math.round((34 + e * 1.3) * n),
      defense: Math.round((22 + e) * n),
      speed: 86 + Math.min(300, e * 0.12),
      accuracy: 100 + Math.min(400, e * 0.2),
      resistance: 80 + Math.min(400, e * 0.18),
      critChance: 0.08,
      critDamage: 1.45,
      breakPower: 18
    },
    skillIds: ["strike", "stun"]
  };
  return {
    id: i ? `floor-${e}-guardian` : `floor-${e}-enemy-${t}`,
    name: i ? `Depth Guardian ${e / 10}` : `Depth Shard ${t + 1}`,
    side: "ENEMY",
    role: i ? "TANK" : t % 2 === 0 ? "STRIKER" : "CONTROLLER",
    family: i ? "depth-guardian" : `mine-${e % 4}`,
    level: e,
    stats: {
      maxHp: l,
      attack: Math.round(Be((42 + e * 1.7) * n * o.attack * (i ? 1.15 : 1), 1e8)),
      defense: Math.round(Be((30 + e * 1.4) * n * o.defense * (i ? 1.25 : 1), 1e8)),
      speed: Be((82 + Math.min(420, e * 0.14) + s.int(-3, 3)) * o.speed, 1e4),
      accuracy: Be((100 + Math.min(500, e * 0.24)) * o.accuracy, 1e4),
      resistance: Be(88 + Math.min(600, e * 0.26) + (i ? 40 : 0), 1e4),
      critChance: Math.min(0.45, 0.06 + e * 22e-5),
      critDamage: Math.min(3, 1.45 + e * 5e-4),
      breakPower: Be((18 + Math.min(300, e * 0.08)) * o.breakPower, 1e4)
    },
    skillIds: i ? ["strike", "sweep", "fracture", "eclipse", "nova"] : t % 2 === 0 ? ["strike", "fracture"] : ["strike", "stun", "eclipse"],
    initialUltimate: i ? 35 : 0,
    boss: i ? {
      weakPoint: s.pick(Or),
      weakPointMultiplier: 1.65,
      breakThreshold: 140 + e * 0.2,
      enrageTurn: 14,
      enrageMultiplier: 1.55,
      phases: [
        { id: "fracture", hpRatio: 0.67, attackMultiplier: 1.12, speedMultiplier: 1.06, ultimateGain: 30 },
        { id: "echoes", hpRatio: 0.34, defenseMultiplier: 1.18, weakPoint: s.pick(Or), summons: [d], ultimateGain: 45 }
      ]
    } : void 0
  };
}, po = ["BATTLE", "MINING", "TREASURE", "ELITE", "REST", "RANDOM_EVENT"], fo = { BATTLE: 44, MINING: 18, TREASURE: 9, ELITE: 12, REST: 9, RANDOM_EVENT: 8 }, Ii = (e) => e.encounterType === "BATTLE" || e.encounterType === "ELITE" || e.encounterType === "BOSS", Ir = (e, t = "stoneverse-endless") => {
  uo(e);
  const n = new Re(`${t}:floor:${e}`), r = e % 10 === 0, i = r ? "BOSS" : e === 1 ? "BATTLE" : n.weighted(po, (S) => fo[S]), s = mo(e), o = Object.values(ao), a = Math.min(2, Math.floor(e / 75) + (e >= 20 ? 1 : 0)), l = n.shuffle(o).slice(0, a).map((S) => ({ ...S })), d = new Re(`${t}:weekly-rule`).pick(lo);
  l.push({ ...d }), r && l.push({ ...co });
  const h = i === "BATTLE" || i === "ELITE" || i === "BOSS" ? r ? Math.min(2, 1 + Math.floor(e / 400)) : 1 + Math.floor((e - 1) / 25) % 3 + (i === "ELITE" ? 1 : 0) : 0, w = i === "ELITE" ? s * 1.2 : s, E = Array.from({ length: h }, (S, k) => Lr(e, k, w, l, !1, n));
  r && E.unshift(Lr(e, 0, s, l, !0, n));
  const m = oo[i], A = { ...m, outcomeRoll: Math.round(n.next() * 1e6) / 1e6 };
  return {
    floor: e,
    biome: xr[Math.floor((e - 1) / 25) % xr.length],
    encounterType: i,
    isBossFloor: r,
    difficulty: s,
    rules: l,
    enemies: E,
    encounter: A,
    baseReward: Math.round(Be((40 + e * 13 + Math.pow(e, 1.25) * 1.8) * m.rewardMultiplier))
  };
}, yr = (e) => e.reduce((t, n) => Be(
  t + n.stats.maxHp * 0.08 + n.stats.attack * 4 + n.stats.defense * 2 + n.stats.speed + n.stats.breakPower * 2
), 0), ho = (e) => {
  if (e.encounterType === "REST") return 0;
  const t = e.enemies.length ? e.enemies.reduce((r, i) => Be(r + i.stats.maxHp * 0.08 + i.stats.attack * 4 + i.stats.defense * 2), 0) : Be((190 + e.floor * 11.5) * e.difficulty), n = 1 + e.encounter.risk * (e.encounter.outcomeRoll - 0.5);
  return Math.round(Be(t * e.encounter.powerMultiplier * n));
}, Sr = (e, t) => {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("Endless party power must be finite and non-negative");
  const n = e.encounterType === "REST" || t >= ho(e);
  return {
    outcome: n ? "PLAYER" : "ENEMY",
    turns: 0,
    encounterType: e.encounterType,
    recoveredRatio: n ? e.encounter.recoveryRatio : 0
  };
}, $n = (e) => {
  if (!Number.isSafeInteger(e) || e < 0 || e > Tt) throw new RangeError("Endless resonance integrity is invalid");
  return 0.75 + e / Tt * 0.25;
}, Eo = (e, t, n) => {
  const r = e.resonanceIntegrity;
  $n(r);
  const s = n ? Math.round({
    BATTLE: 3,
    MINING: 2,
    TREASURE: 3,
    ELITE: 7,
    REST: 0,
    RANDOM_EVENT: 5,
    BOSS: 10
  }[t.encounterType] * (0.75 + t.encounter.outcomeRoll * 0.5)) : Math.ceil(8 + t.encounter.risk * 12), o = Math.max(0, r - s), a = n ? Math.round(t.encounter.recoveryRatio * Tt) : 0;
  return e.resonanceIntegrity = Math.min(Tt, o + a), e.resonanceIntegrity - o;
}, go = (e, t = "ACTIVE") => {
  if (!e) throw new TypeError("Endless run requires a seed");
  return {
    seed: e,
    mode: t,
    status: "CLIMBING",
    currentFloor: 1,
    highestClearedFloor: 0,
    checkpointFloor: 0,
    lastDefeatFloor: null,
    totalReward: 0,
    clearedBosses: 0,
    battles: 0,
    resonanceIntegrity: Tt
  };
}, bn = ["CORE", "RUNE", "RELIC", "CHARM"], fn = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"], cn = {
  BASTION: { id: "BASTION", name: "Bastion", bonuses: [{ pieces: 2, stat: "defense", value: 0.12 }, { pieces: 4, stat: "maxHp", value: 0.2 }] },
  RESONANCE: { id: "RESONANCE", name: "Resonance", bonuses: [{ pieces: 2, stat: "ultimateStart", value: 12 }, { pieces: 4, stat: "speed", value: 0.15 }] },
  HUNTER: { id: "HUNTER", name: "Hunter", bonuses: [{ pieces: 2, stat: "critChance", value: 0.1 }, { pieces: 4, stat: "critDamage", value: 0.35 }] },
  ABYSSAL: { id: "ABYSSAL", name: "Abyssal", bonuses: [{ pieces: 2, stat: "breakPower", value: 0.15 }, { pieces: 4, stat: "attack", value: 0.18 }] }
}, Qn = (e) => {
  const t = { NORMAL: "COMMON", RARE: "UNCOMMON", SR: "RARE", SSR: "EPIC", UR: "LEGENDARY", LEGENDARY: "MYTHIC" }, n = { maxHp: "maxHp", power: "attack", defense: "defense", speed: "speed", purity: "accuracy", hardness: "resistance", resonance: "breakPower" }, r = e.setId ?? ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"].find((s) => e.definitionId.startsWith(`${s}_`)) ?? null, i = ["NORMAL", "RARE", "SR", "SSR", "UR", "LEGENDARY"].indexOf(e.rarity) + 1;
  return {
    id: e.instanceId,
    name: e.definitionId.replaceAll("_", " ").toLowerCase(),
    slot: e.slot,
    rarity: t[e.rarity],
    level: e.level,
    setId: r,
    locked: e.locked,
    affixes: e.affixes.map((s, o) => ({
      id: `${s.sourceStat ?? s.stat}:${o}`,
      stat: s.sourceStat ?? n[s.stat],
      value: s.value,
      tier: Math.max(1, Math.min(10, i))
    })),
    score: Math.max(1, Math.round(e.level * 4 + i * 100 + e.affixes.reduce((s, o) => s + Math.abs(o.value) * (o.operation === "PERCENT" ? 1e3 : 1), 0)))
  };
}, yi = 1e4, nn = Number.MAX_SAFE_INTEGER, ze = (e) => fn.indexOf(e), Io = { COMMON: 1, UNCOMMON: 2, RARE: 3, EPIC: 4, LEGENDARY: 5, MYTHIC: 6 }, Si = ["maxHp", "attack", "defense", "speed", "accuracy", "resistance", "critChance", "critDamage", "breakPower"], yo = Object.keys(cn), Ue = (e, t, n = 0, r = pn) => {
  if (!Number.isFinite(e) || e < n || e > r) throw new RangeError(`${t} must be finite and within ${n}..${r}`);
  return e;
}, ln = (e, t = pn) => Number.isFinite(e) ? Math.max(0, Math.min(t, e)) : e > 0 ? t : 0, So = (e, t) => (Ue(e, "salvageMaterials", 0, nn), Ue(t, "materialsGained", 0, nn), Math.min(nn, e + t)), Ao = (e, t) => {
  const n = Math.min(3, Math.log10(e + 1) * 0.45);
  return t.weighted(fn, (r) => ([5e3, 2500, 900, 250, 55, 8][ze(r)] ?? 1) * Math.pow(1 + n, ze(r)));
}, wo = (e, t, n, r, i) => {
  const s = 0.85 + i.next() * 0.3, o = ze(n) + 1;
  return e === "maxHp" ? Math.round(ln((15 + t * 3.5) * o * r * s)) : e === "attack" || e === "defense" ? Math.round(ln((3 + t * 0.55) * o * r * s)) : Math.round(Math.min(5, (e === "speed" ? 8e-3 : e === "critDamage" ? 0.025 : 0.012) * o * r * s) * 1e5) / 1e5;
}, vo = (e, t, n) => {
  const r = e.reduce((i, s) => {
    const o = s.stat === "maxHp" ? s.value / 10 : s.stat === "attack" || s.stat === "defense" ? s.value : s.value * 1e3;
    return ln(i + o * s.tier);
  }, 0);
  return Math.round(ln(r + t * 4 + (ze(n) + 1) * 100));
}, Pn = (e) => {
  if (!e.id || !e.name || !bn.includes(e.slot) || !fn.includes(e.rarity))
    throw new TypeError("Invalid equipment identity");
  if (Ue(e.level, `${e.id}.level`, 1, 1e6), Ue(e.score, `${e.id}.score`), e.setId && !cn[e.setId]) throw new RangeError(`Unknown set ${e.setId}`);
  for (const t of e.affixes) {
    if (!t.id || !Si.includes(t.stat)) throw new TypeError(`Invalid affix on ${e.id}`);
    Ue(t.value, `${e.id}.${t.id}.value`), Ue(t.tier, `${e.id}.${t.id}.tier`, 1, 10);
  }
}, Ai = (e, t) => {
  const n = Math.floor(Ue(e.level, "equipment.level", 1, 1e6)), r = e.slot ?? t.pick(bn), i = e.rarity ?? Ao(n, t);
  if (!bn.includes(r) || !fn.includes(i)) throw new RangeError("Unknown equipment slot or rarity");
  const s = e.setId === void 0 ? t.chance(Math.min(0.65, 0.12 + ze(i) * 0.08)) ? t.pick(yo) : null : e.setId;
  if (s && !cn[s]) throw new RangeError(`Unknown equipment set ${s}`);
  const a = t.shuffle(Si).slice(0, Io[i]).map((h, w) => {
    const E = Math.min(10, 1 + ze(i) + t.int(0, 2));
    return { id: `${h}:${w}`, stat: h, value: wo(h, n, i, E, t), tier: E };
  }), u = {
    id: `eq:${(e.source ?? "mine").replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "drop"}:${n}:${t.int(0, 2147483647).toString(36)}:${t.int(0, 2147483647).toString(36)}`,
    name: `${s ? cn[s].name : i.toLowerCase()} ${r.toLowerCase()}`,
    slot: r,
    rarity: i,
    level: n,
    setId: s,
    affixes: a,
    score: vo(a, n, i),
    locked: !1
  };
  return Pn(u), u;
}, Mo = (e = 300, t = 0) => ({
  capacity: Math.floor(Ue(e, "inventory.capacity", 1, yi)),
  items: [],
  salvageMaterials: Ue(t, "inventory.salvageMaterials", 0, nn)
}), wi = (e, t = {}) => (Pn(e), e.locked || e.setId && t.alwaysKeepSets?.includes(e.setId) ? !0 : !(t.allowedSlots && !t.allowedSlots.includes(e.slot) || t.minRarity && ze(e.rarity) < ze(t.minRarity) || t.minScore !== void 0 && e.score < Ue(t.minScore, "lootFilter.minScore"))), Ro = (e) => (Pn(e), Math.max(1, Math.floor(ln((ze(e.rarity) + 1) ** 2 * (10 + Math.sqrt(e.level) * 8))))), Jt = (e, t) => {
  const n = Ro(t), r = e.salvageMaterials;
  return e.salvageMaterials = So(r, n), e.salvageMaterials - r;
}, bo = (e, t) => {
  const n = e.items.findIndex((s) => s.id === t);
  if (n < 0) throw new RangeError(`Equipment ${t} is not in inventory`);
  const r = e.items[n];
  if (!r || r.locked) throw new RangeError(`Equipment ${t} cannot be salvaged`);
  e.items.splice(n, 1);
  const i = Jt(e, r);
  return { accepted: !1, salvagedIds: [r.id], materialsGained: i, reason: "SALVAGED" };
}, rn = (e, t, n = {}) => {
  if (Pn(t), Ue(e.capacity, "inventory.capacity", 1, yi), !Number.isSafeInteger(e.capacity)) throw new RangeError("inventory.capacity must be a safe integer");
  if (Ue(e.salvageMaterials, "inventory.salvageMaterials", 0, nn), e.items.length > e.capacity) throw new RangeError("Inventory is already over capacity");
  if (e.items.some((o) => o.id === t.id)) throw new RangeError(`Duplicate equipment id ${t.id}`);
  if (!wi(t, n) && n.autoSalvage) {
    const o = Jt(e, t);
    return { accepted: !1, salvagedIds: [t.id], materialsGained: o, reason: "FILTERED" };
  }
  if (e.items.length < e.capacity)
    return e.items.push(t), { accepted: !0, salvagedIds: [], materialsGained: 0, reason: "ADDED" };
  if (!n.autoSalvage) {
    if (t.locked) throw new RangeError("Locked equipment cannot enter a full inventory");
    const o = Jt(e, t);
    return { accepted: !1, salvagedIds: [t.id], materialsGained: o, reason: "CAPACITY" };
  }
  const r = e.items.filter((o) => !o.locked && !(o.setId && n.alwaysKeepSets?.includes(o.setId))).sort((o, a) => o.score - a.score || ze(o.rarity) - ze(a.rarity) || o.id.localeCompare(a.id))[0];
  if (!r || r.score >= t.score) {
    const o = Jt(e, t);
    return { accepted: !1, salvagedIds: [t.id], materialsGained: o, reason: "CAPACITY" };
  }
  const i = e.items.findIndex((o) => o.id === r.id);
  e.items.splice(i, 1, t);
  const s = Jt(e, r);
  return { accepted: !0, salvagedIds: [r.id], materialsGained: s, reason: "REPLACED" };
}, Xe = (e, t) => {
  const n = (r) => Number.isFinite(r) ? Math.max(0, Math.floor(r)) : r > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return Math.min(Number.MAX_SAFE_INTEGER, n(e) + n(t));
}, vi = {
  maxHp: "maxHp",
  power: "attack",
  defense: "defense",
  hardness: "defense",
  purity: "resistance",
  speed: "speed",
  resonance: "breakPower"
}, To = ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"], No = (e) => e.setId ?? To.find((t) => e.definitionId.startsWith(`${t}_`)) ?? null, St = (e, t) => e * (1 + t), _o = (e) => {
  const t = e.skills.flatMap((r) => Et[r.skillId]?.tags ?? []);
  if (t.includes("support")) return "SUPPORT";
  if (t.includes("control") && e.stats.speed >= e.stats.power) return "CONTROLLER";
  if (t.some((r) => r === "break") || e.traitIds.some((r) => /fract|break/i.test(r))) return "BREAKER";
  const n = fe[e.speciesId]?.role;
  return n === "TANK" ? "GUARDIAN" : n === "SUPPORT" ? "SUPPORT" : n === "CONTROL" ? "CONTROLLER" : e.stats.defense > e.stats.power * 1.2 ? "VANGUARD" : "STRIKER";
}, ko = (e) => e.type, Co = (e) => e === "BURN" ? { kind: "STATUS", status: "BURN" } : e === "FRACTURE" ? { kind: "STATUS", status: "CRACK" } : e === "STUN" ? { kind: "STATUS", status: "STUN" } : e === "REGEN" ? { kind: "STATUS", status: "REGENERATION" } : e === "TAUNT" ? { kind: "CONTROL", control: "TAUNT" } : { kind: "STATUS", status: "VULNERABLE" }, xo = (e) => {
  const t = e.type === "STATUS" ? Co(e.statusId) : void 0;
  return {
    kind: t?.kind ?? ko(e),
    power: e.power ?? (e.type === "STATUS" ? e.value : void 0),
    value: e.value === void 0 ? void 0 : Math.abs(e.value),
    duration: e.duration,
    chance: e.chance,
    stat: e.stat ? vi[e.stat] : void 0,
    control: t?.control,
    status: t?.status
  };
}, Mi = (e) => ({
  id: e.id,
  name: e.name,
  target: e.target === "ALLY" ? "ALLY_LOWEST" : e.target,
  element: e.element,
  effects: e.effects.flatMap((t) => [
    xo(t),
    ...t.type === "STATUS" && t.statusId === "FRACTURE" ? [{ kind: "BREAK", power: 0.65, value: 15, chance: t.chance }] : []
  ]),
  cooldown: e.cooldown,
  ultimateCost: e.ultimateCost,
  priority: e.priority,
  tags: [
    ...e.tags.includes("attack") || e.effects.some((t) => t.type === "DAMAGE") ? ["ATTACK"] : [],
    ...e.tags.includes("support") || e.effects.some((t) => t.type === "HEAL") ? ["HEAL"] : [],
    ...e.tags.includes("tank") || e.effects.some((t) => t.type === "SHIELD") ? ["DEFENSE"] : [],
    ...e.tags.includes("control") || e.effects.some((t) => t.type === "STATUS" || t.type === "DEBUFF") ? ["CONTROL"] : [],
    ...e.tags.includes("break") || e.effects.some((t) => t.type === "STATUS" && t.statusId === "FRACTURE") ? ["BREAK"] : [],
    ...e.tags.includes("ultimate") ? ["ULTIMATE"] : []
  ]
}), Ri = (e, t = "PLAYER") => {
  const n = fe[e.speciesId], r = e.mutation === "PERFECT" ? 1.08 : e.mutation === "ANCIENT" || e.mutation === "PRISMATIC" ? 1.04 : 1, i = 1 + Math.min(0.07, e.affinity.rank * 0.01), s = Object.values(e.equipment).filter((w) => !!w), a = e.skills.map((w) => Et[w.skillId]).filter((w) => !!w).map((w) => w.id);
  a.length || a.push("strike");
  const l = e.parents[0]?.speciesId ? `lineage:${e.parents[0].speciesId}` : n?.family, d = {
    maxHp: Math.max(1, e.stats.maxHp * r * i),
    attack: Math.max(1, e.stats.power * r * i),
    defense: Math.max(1, (e.stats.defense + e.stats.hardness * 0.2) * r * i),
    speed: Math.max(1, e.stats.speed * (1 + e.individualValues.speed / 310)),
    accuracy: Math.max(1, 92 + e.individualValues.purity * 1.2 + e.stats.purity * 0.08),
    resistance: Math.max(1, 82 + e.individualValues.hardness + e.stats.hardness * 0.12),
    critChance: Math.min(0.65, 0.05 + e.potential / 1e3 + e.individualValues.power / 620),
    critDamage: Math.min(3, 1.45 + e.individualValues.power / 155),
    breakPower: Math.max(1, 15 + e.stats.resonance * 0.22 + e.individualValues.resonance * 0.7)
  };
  for (const w of e.traitIds)
    for (const E of Yt[w]?.effects ?? []) {
      if (E.trigger !== "ALWAYS" && E.trigger !== "BATTLE_START" || !E.stat || E.value === void 0) continue;
      const m = vi[E.stat];
      m && (m === "critChance" || m === "critDamage" || (d[m] = Math.max(1, E.operation === "PERCENT" ? St(d[m], E.value) : d[m] + E.value)));
    }
  let u = 0;
  for (const w of s)
    for (const E of w.affixes) {
      const m = E.sourceStat ?? (E.stat === "power" ? "attack" : E.stat === "purity" ? "accuracy" : E.stat === "hardness" ? "resistance" : E.stat === "resonance" ? "breakPower" : E.stat), A = E.operation === "PERCENT";
      m === "maxHp" || m === "attack" || m === "defense" || m === "speed" || m === "accuracy" || m === "resistance" || m === "breakPower" ? d[m] = Math.max(1, A ? St(d[m], E.value) : d[m] + E.value) : m === "critChance" ? d.critChance = Math.max(0, d.critChance + (A ? E.value : E.value / 100)) : d.critDamage = Math.max(1, d.critDamage + (A ? E.value : E.value / 100));
    }
  const h = /* @__PURE__ */ new Map();
  for (const w of s) {
    const E = No(w);
    E && h.set(E, (h.get(E) ?? 0) + 1);
  }
  return (h.get("BASTION") ?? 0) >= 2 && (d.defense = St(d.defense, 0.12)), (h.get("BASTION") ?? 0) >= 4 && (d.maxHp = St(d.maxHp, 0.2)), (h.get("RESONANCE") ?? 0) >= 2 && (u += 12), (h.get("RESONANCE") ?? 0) >= 4 && (d.speed = St(d.speed, 0.15)), (h.get("HUNTER") ?? 0) >= 2 && (d.critChance += 0.1), (h.get("HUNTER") ?? 0) >= 4 && (d.critDamage += 0.35), (h.get("ABYSSAL") ?? 0) >= 2 && (d.breakPower = St(d.breakPower, 0.15)), (h.get("ABYSSAL") ?? 0) >= 4 && (d.attack = St(d.attack, 0.18)), {
    id: e.instanceId,
    name: e.nickname || e.name,
    side: t,
    role: _o(e),
    family: l,
    element: e.primaryElement,
    level: e.level,
    stats: {
      maxHp: Math.round(d.maxHp),
      attack: Math.round(d.attack),
      defense: Math.round(d.defense),
      speed: Math.round(d.speed),
      accuracy: Math.round(d.accuracy),
      resistance: Math.round(d.resistance),
      critChance: Math.min(0.95, d.critChance),
      critDamage: Math.min(5, d.critDamage),
      breakPower: Math.round(d.breakPower)
    },
    skillIds: a,
    initialUltimate: Math.min(100, e.affinity.rank * 4 + e.awakeningStage * 3 + u)
  };
}, bi = (e) => {
  const t = e.flatMap((n) => n.skills).map((n) => Et[n.skillId]).filter((n) => !!n);
  return Object.freeze({
    ...Ws,
    ...Object.fromEntries(t.map((n) => [n.id, Mi(n)]))
  });
}, qe = 300 * 1e3, Dr = 720 * 60 * 60 * 1e3, Oo = 1, Fn = (e) => {
  const t = e.getTime();
  if (!Number.isSafeInteger(t) || t < 0) throw new RangeError("Invalid Endless Mine timestamp");
  return t;
}, Ti = (e) => {
  const t = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())), n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const r = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)), i = Math.ceil(((t.getTime() - r.getTime()) / 864e5 + 1) / 7);
  return `weekly:${t.getUTCFullYear()}-${String(i).padStart(2, "0")}`;
}, Ni = (e = /* @__PURE__ */ new Date(0)) => ({
  version: Oo,
  status: "READY",
  runId: null,
  run: null,
  partyStoneIds: [],
  partySnapshot: [],
  skillBook: {},
  strategy: "BALANCED",
  speed: 1,
  manualMode: !1,
  activeFloor: null,
  activeBattle: null,
  startedAt: null,
  lastProcessedAt: null,
  nextFloorAt: null,
  highestFloor: 0,
  weeklySeed: Ti(e),
  weeklyHighestFloor: 0,
  winStreak: 0,
  pendingCredits: 0,
  equipment: Mo(300),
  lootFilter: { minRarity: "RARE", autoSalvage: !0, alwaysKeepSets: ["ABYSSAL"] },
  recentLog: [],
  claimLedger: {}
}), He = (e, t) => {
  e.recentLog = [...e.recentLog, t].slice(-80);
}, Oe = (e) => {
  if (!e.run || !e.runId) throw new Error("No Endless Mine run exists");
  return e.run;
}, Lo = (e, t) => {
  const n = Oe(e);
  n.currentFloor = t, n.status = "COMPLETE", e.status = "ENDED", e.nextFloorAt = null, He(e, `最深部 Floor ${t} を踏破。Endless Mine complete。`);
}, Do = (e, t, n, r, i) => {
  if (e.status === "RUNNING" || e.status === "PAUSED") throw new Error("Endless Mine is already active");
  if (e.runId && !e.claimLedger[e.runId]) throw new Error("Claim the previous Endless Mine run before starting another");
  if (n.length < 1 || n.length > 3 || new Set(n).size !== n.length) throw new Error("Endless Mine requires 1-3 unique Stones");
  const s = n.map((d) => t[d] ?? (() => {
    throw new Error(`Stone not found: ${d}`);
  })()), o = Fn(r), a = `endless:${o}:${i}`, l = Ti(r);
  return e.weeklySeed !== l && (e.weeklyHighestFloor = 0), e.weeklySeed = l, e.runId = a, e.run = go(l, "AUTO"), e.status = "RUNNING", e.partyStoneIds = [...n], e.partySnapshot = s.map((d) => Ri(d)), e.skillBook = bi(s), e.manualMode = !1, e.startedAt = r.toISOString(), e.lastProcessedAt = r.toISOString(), e.nextFloorAt = new Date(o + qe).toISOString(), e.activeFloor = null, e.activeBattle = null, e.winStreak = 0, e.pendingCredits = 0, He(e, "潜行を開始。Party buildを固定しました。"), e;
}, $o = (e, t) => {
  const n = Oe(e);
  e.manualMode = t, n.mode = t ? "ACTIVE" : "AUTO", t && e.status === "RUNNING" && _i(e);
}, _i = (e) => {
  const t = Oe(e);
  if (t.status !== "CLIMBING") throw new Error("Endless run is not climbing");
  if (e.activeBattle && !e.activeBattle.outcome) return e.activeBattle;
  for (let n = 0; n < 10 && e.status === "RUNNING"; n += 1) {
    const r = Ir(t.currentFloor, t.seed);
    if (!Ii(r)) {
      const i = Sr(r, yr(e.partySnapshot) * Ut.efficiency.ACTIVE * $n(t.resonanceIntegrity));
      He(e, `Floor ${r.floor}: ${r.encounter.label} / ${r.encounter.description}`), Bn(e, r, i.outcome, "ACTIVE");
      continue;
    }
    return e.activeFloor = r, e.activeBattle = mr({ units: [...e.partySnapshot, ...r.enemies], skills: e.skillBook, maxTurns: 80 }), He(e, `Floor ${r.floor}: ${r.encounter.label}出現。`), e.activeBattle;
  }
  if (e.status === "RUNNING") throw new Error("Unable to prepare the next Endless battle");
  return null;
}, Po = (e, t) => {
  const n = new Re(`${Oe(e).seed}:equipment:${t.floor}`), r = Math.min(1, t.encounter.equipmentChance + (t.encounterType === "BATTLE" ? t.floor * 5e-4 : 0));
  if (!n.chance(r)) return { added: 0, salvaged: 0 };
  const i = t.isBossFloor && t.floor >= 100 ? "EPIC" : t.encounterType === "ELITE" && t.floor >= 50 ? "RARE" : void 0, s = Ai({ level: t.floor, rarity: i, source: `endless-${t.floor}` }, n), o = rn(e.equipment, s, e.lootFilter);
  return He(e, o.accepted ? `${s.rarity} ${s.name}を獲得。` : `${s.name}を容量保護${o.reason === "FILTERED" ? "・Loot Filter" : ""}分解（素材 +${o.materialsGained}）。`), { added: o.accepted ? 1 : 0, salvaged: o.salvagedIds.length };
}, Bn = (e, t, n, r) => {
  const i = Oe(e), s = t.floor;
  i.battles = Xe(i.battles, 1);
  const o = Eo(i, t, n === "PLAYER");
  let a = 0, l = 0, d = 0, u = 0;
  if (n === "PLAYER") {
    const h = t.floor > i.highestClearedFloor;
    if (h && (a = Math.floor(t.baseReward * Ut.efficiency[r]), i.totalReward = Math.min(Rn, Xe(i.totalReward, a)), e.pendingCredits = Xe(e.pendingCredits, a), i.highestClearedFloor = t.floor), e.highestFloor = Math.max(e.highestFloor, t.floor), e.weeklyHighestFloor = Math.max(e.weeklyHighestFloor, t.floor), e.winStreak = Xe(e.winStreak, 1), h && t.isBossFloor && (i.clearedBosses = Xe(i.clearedBosses, 1), u = 1), t.floor % 10 === 0 && (i.checkpointFloor = t.floor), h) {
      const E = Po(e, t);
      l = E.added, d = E.salvaged;
    }
    const w = o > 0 ? ` / 共鳴完全性 +${o} (${i.resonanceIntegrity}/100)` : ` / 共鳴完全性 ${i.resonanceIntegrity}/100`;
    He(e, `Floor ${t.floor} ${t.encounterType} clear / CREDIT +${a.toLocaleString("en-US")}${w}`), t.floor >= Ut.maxFloor ? Lo(e, t.floor) : i.currentFloor = t.floor + 1;
  } else
    i.status = "DEFEATED", i.lastDefeatFloor = t.floor, e.status = "ENDED", e.nextFloorAt = null, e.winStreak = 0, He(e, `Floor ${t.floor} ${t.encounterType}で共鳴崩壊。Checkpoint ${i.checkpointFloor}へ帰還可能。`);
  return e.activeBattle = null, e.activeFloor = null, { attemptedFloors: 1, clearedFloors: n === "PLAYER" ? 1 : 0, fromFloor: s, toFloor: i.currentFloor, credits: a, equipmentAdded: l, equipmentSalvaged: d, bossClears: u, defeated: n !== "PLAYER" };
}, ki = (e) => {
  const t = e.activeBattle, n = e.activeFloor;
  return !t?.outcome || !n ? null : Bn(e, n, t.outcome, e.manualMode ? "ACTIVE" : "AUTO");
}, Fo = (e, t, n) => {
  if (e.status !== "RUNNING" || !e.manualMode) throw new Error("Manual Endless battle is not active");
  const r = _i(e);
  if (!r) throw new Error("The Endless encounter resolved without a manual battle");
  const i = pr(r).find((u) => r.units.find((h) => h.id === u)?.side === "PLAYER");
  if (!i) throw new Error("No living player actor");
  if (!Ln(r, i).some((u) => u.id === t)) throw new Error("Selected skill is not usable");
  const s = { actorId: i, skillId: t, targetIds: n }, o = Gt(e.strategy), a = Gt("AGGRESSIVE"), l = new Re(`${Oe(e).seed}:manual:${Oe(e).currentFloor}:${r.turn}`);
  Dn(r, {
    commands: { [i]: s },
    commandProvider: (u, h, w) => u.units.find((E) => E.id === h)?.side === "PLAYER" ? o(u, h, w) : a(u, h, w)
  }, l);
  const d = r.log.slice(-r.units.length).map((u) => `${u.actorId}: ${u.skillId}`);
  for (const u of d) He(e, u);
  return ki(e);
}, Bo = (e) => {
  const t = Oe(e), n = t.currentFloor, r = e.activeFloor?.floor === n ? e.activeFloor : Ir(n, t.seed);
  if (!Ii(r)) {
    if (e.activeBattle) throw new Error("Non-combat Endless floor cannot retain a battle");
    const a = Sr(r, yr(e.partySnapshot) * Ut.efficiency.AUTO * $n(t.resonanceIntegrity));
    return He(e, `Floor ${r.floor}: ${r.encounter.label} / ${r.encounter.description}`), Bn(e, r, a.outcome, "AUTO");
  }
  const i = e.activeBattle && e.activeFloor?.floor === n && !e.activeBattle.outcome ? e.activeBattle : mr({ units: [...e.partySnapshot, ...r.enemies], skills: e.skillBook, maxTurns: 80 }), s = Gt(e.strategy), o = Gt(r.isBossFloor ? "BOSS_FOCUS" : "AGGRESSIVE");
  return fi(i, (a, l, d) => a.units.find((u) => u.id === l)?.side === "PLAYER" ? s(a, l, d) : o(a, l, d), new Re(`${t.seed}:auto:${n}:${i.turn}`)), e.activeFloor = r, e.activeBattle = i, ki(e);
}, Ci = (e, t = 1, n = /* @__PURE__ */ new Date()) => {
  if (e.status !== "RUNNING" || e.manualMode) throw new Error("Auto Endless Mine is not running");
  if (!Number.isSafeInteger(t) || t < 0 || t > 1e4) throw new RangeError("Invalid floor batch size");
  const r = Oe(e).currentFloor, i = { attemptedFloors: 0, clearedFloors: 0, fromFloor: r, toFloor: r, credits: 0, equipmentAdded: 0, equipmentSalvaged: 0, bossClears: 0, defeated: !1 };
  if (t === 0) return i;
  const s = Fn(n), o = Date.parse(e.nextFloorAt ?? "");
  if (!Number.isFinite(o)) throw new Error("Auto Endless Mine has no valid next floor time");
  if (s < o) throw new Error("The next Endless Mine floor is not ready yet");
  const a = Math.min(1e4, Math.floor((s - o) / qe) + 1), l = Math.min(t, a);
  for (; i.attemptedFloors < l && e.status === "RUNNING"; ) {
    const u = Bo(e);
    i.attemptedFloors += 1, i.clearedFloors += u.clearedFloors, i.credits = Xe(i.credits, u.credits), i.equipmentAdded += u.equipmentAdded, i.equipmentSalvaged += u.equipmentSalvaged, i.bossClears += u.bossClears, i.defeated ||= u.defeated;
  }
  i.toFloor = Oe(e).currentFloor;
  const d = o + Math.max(0, i.attemptedFloors - 1) * qe;
  return e.lastProcessedAt = new Date(d).toISOString(), e.nextFloorAt = e.status === "RUNNING" ? new Date(o + i.attemptedFloors * qe).toISOString() : null, i;
}, qo = (e, t) => {
  const n = Oe(e), r = Date.parse(e.lastProcessedAt ?? e.startedAt ?? t.toISOString()), i = Fn(t), s = n.currentFloor, o = { attemptedFloors: 0, clearedFloors: 0, fromFloor: s, toFloor: s, credits: 0, equipmentAdded: 0, equipmentSalvaged: 0, bossClears: 0, defeated: !1 };
  if (e.status !== "RUNNING" || e.manualMode || !Number.isFinite(r) || i <= r) return o;
  const a = Date.parse(e.nextFloorAt ?? new Date(r + qe).toISOString());
  if (!Number.isFinite(a) || i < a) return o;
  const l = Math.max(a, i - Dr + qe), d = Math.min(
    Math.floor(Dr / qe),
    Math.floor((i - l) / qe) + 1
  ), u = { ...o }, h = yr(e.partySnapshot) * Ut.efficiency.OFFLINE;
  for (; u.attemptedFloors < d && e.status === "RUNNING"; ) {
    const E = Ir(n.currentFloor, n.seed), m = Sr(E, h * $n(n.resonanceIntegrity)), A = Bn(e, E, m.outcome, "OFFLINE");
    u.attemptedFloors += A.attemptedFloors, u.clearedFloors += A.clearedFloors, u.credits = Xe(u.credits, A.credits), u.equipmentAdded += A.equipmentAdded, u.equipmentSalvaged += A.equipmentSalvaged, u.bossClears += A.bossClears, u.defeated ||= A.defeated;
  }
  u.toFloor = n.currentFloor;
  const w = l + Math.max(0, u.attemptedFloors - 1) * qe;
  return e.lastProcessedAt = new Date(w).toISOString(), e.nextFloorAt = e.status === "RUNNING" ? new Date(l + u.attemptedFloors * qe).toISOString() : null, u.clearedFloors && He(e, `OFFLINE: Floor ${s} → ${n.currentFloor} / ${u.clearedFloors} clear。`), u;
}, Go = (e, t) => {
  if (e.status !== "RUNNING") throw new Error("Endless Mine is not running");
  e.status = "PAUSED", e.lastProcessedAt = t.toISOString(), e.nextFloorAt = null, He(e, "潜行を一時停止。");
}, Uo = (e, t) => {
  const n = Oe(e);
  if (e.status !== "PAUSED" && !(e.status === "ENDED" && n.status === "DEFEATED")) throw new Error("Endless Mine cannot resume");
  const r = n.status === "DEFEATED";
  r && (n.currentFloor = Math.max(1, n.checkpointFloor + 1), n.resonanceIntegrity = Math.max(50, n.resonanceIntegrity), n.status = "CLIMBING", e.activeBattle = null, e.activeFloor = null), e.status = "RUNNING", e.lastProcessedAt = t.toISOString(), e.nextFloorAt = new Date(Fn(t) + qe).toISOString(), He(e, r ? `Checkpoint ${n.checkpointFloor}から潜行再開。` : "中断した戦闘状態から潜行再開。");
}, Ho = (e, t) => {
  Oi(t), e.lootFilter = { ...t, allowedSlots: t.allowedSlots ? [...t.allowedSlots] : void 0, alwaysKeepSets: t.alwaysKeepSets ? [...t.alwaysKeepSets] : void 0 };
}, jo = (e) => {
  const t = Oe(e), n = e.runId;
  if (e.claimLedger[n]) throw new Error("Endless Mine reward was already claimed");
  if (e.status === "RUNNING") throw new Error("Pause or retreat before claiming Endless rewards");
  const r = e.pendingCredits, i = e.equipment.salvageMaterials;
  return e.claimLedger[n] = !0, e.pendingCredits = 0, e.equipment.salvageMaterials = 0, e.status = "ENDED", e.nextFloorAt = null, e.activeBattle = null, e.activeFloor = null, { runId: n, credits: r, upgradeDust: i, highestFloor: t.highestClearedFloor, equipmentCount: e.equipment.items.length };
}, ge = (e) => !!e && typeof e == "object" && !Array.isArray(e), We = (e, t = 0) => typeof e == "number" && Number.isSafeInteger(e) && e >= t, Yo = (e, t = !1) => e === null ? t : typeof e == "string" && Number.isFinite(Date.parse(e)), Ht = (e, t = 0, n = 1e12) => typeof e == "number" && Number.isFinite(e) && e >= t && e <= n, xe = (e, t = 256) => typeof e == "string" && e.length > 0 && e.length <= t, Vo = ["maxHp", "attack", "defense", "speed", "accuracy", "resistance", "critChance", "critDamage", "breakPower"], Xo = ["VANGUARD", "TANK", "GUARDIAN", "STRIKER", "BREAKER", "SUPPORT", "CONTROLLER"], Wo = ["SELF", "ALLY_LOWEST", "ALL_ALLIES", "ENEMY", "ALL_ENEMIES", "BOSS"], Ko = ["DAMAGE", "HEAL", "SHIELD", "BUFF", "DEBUFF", "DOT", "CONTROL", "BREAK", "COUNTER", "ULTIMATE_GAIN", "STATUS"], Ar = (e, t = !1) => {
  if (!ge(e) || !xe(e.id) || !xe(e.name) || !["PLAYER", "ENEMY"].includes(String(e.side)) || !Xo.includes(String(e.role))) throw new Error("Invalid Endless combatant identity");
  if (!We(e.level, 1) || !ge(e.stats)) throw new Error("Invalid Endless combatant progression");
  for (const n of Vo) if (!Ht(e.stats[n])) throw new Error(`Invalid Endless combatant ${n}`);
  if (!Array.isArray(e.skillIds) || e.skillIds.length > 64 || e.skillIds.some((n) => !xe(n)) || new Set(e.skillIds).size !== e.skillIds.length) throw new Error("Invalid Endless combatant skills");
  if (t) {
    for (const n of ["hp", "shield", "ultimate", "breakGauge"]) if (!Ht(e[n])) throw new Error(`Invalid Endless battle unit ${n}`);
    if (typeof e.alive != "boolean" || !ge(e.cooldowns) || Object.values(e.cooldowns).some((n) => !We(n))) throw new Error("Invalid Endless battle unit state");
    for (const n of ["modifiers", "dots", "controls", "statuses"]) if (!Array.isArray(e[n]) || e[n].length > 256) throw new Error(`Invalid Endless battle unit ${n}`);
    if (e.counter !== null && !ge(e.counter)) throw new Error("Invalid Endless battle counter");
    if (e.bossState !== null && !ge(e.bossState)) throw new Error("Invalid Endless battle boss state");
  }
}, xi = (e) => {
  if (!ge(e) || Object.keys(e).length > 256) throw new Error("Invalid Endless Mine skill book");
  for (const [t, n] of Object.entries(e)) {
    if (!ge(n) || n.id !== t || !xe(n.id) || !xe(n.name) || !Wo.includes(String(n.target)) || !Array.isArray(n.effects) || n.effects.length > 32) throw new Error("Invalid Endless skill definition");
    for (const r of n.effects) {
      if (!ge(r) || !Ko.includes(String(r.kind))) throw new Error("Invalid Endless skill effect");
      for (const i of ["power", "value", "duration", "chance"]) if (r[i] !== void 0 && !Ht(r[i], -1e12)) throw new Error(`Invalid Endless skill effect ${i}`);
    }
  }
}, zo = (e) => {
  if (!ge(e) || !We(e.floor, 1) || e.floor > Ze || !["CRYSTAL_CAVERN", "MAGMA_VEIN", "FOSSIL_DEPTHS", "ASTRAL_RIFT"].includes(String(e.biome)) || typeof e.isBossFloor != "boolean" || !Ht(e.difficulty) || !We(e.baseReward)) throw new Error("Invalid Endless active floor");
  if (e.encounterType === void 0 && e.encounter === void 0) {
    const n = e.isBossFloor === !0;
    e.encounterType = n ? "BOSS" : "BATTLE", e.encounter = {
      label: n ? "Depth Guardian" : "Shard Ambush",
      description: "Legacy persisted combat encounter.",
      rewardMultiplier: n ? 4 : 1,
      powerMultiplier: n ? 1.15 : 1,
      equipmentChance: n ? 1 : 0.18,
      recoveryRatio: 0,
      risk: n ? 0.3 : 0.12,
      outcomeRoll: 0.5
    };
  }
  if (!so.includes(e.encounterType)) throw new Error("Invalid Endless encounter type");
  if (e.encounterType === "BOSS" !== e.isBossFloor) throw new Error("Invalid Endless boss encounter");
  if (!ge(e.encounter) || !xe(e.encounter.label) || !xe(e.encounter.description)) throw new Error("Invalid Endless encounter definition");
  for (const n of ["rewardMultiplier", "powerMultiplier", "equipmentChance", "recoveryRatio", "risk", "outcomeRoll"])
    if (!Ht(e.encounter[n], 0, n === "rewardMultiplier" || n === "powerMultiplier" ? 10 : 1)) throw new Error(`Invalid Endless encounter ${n}`);
  if (!Array.isArray(e.rules) || e.rules.length > 8 || e.rules.some((n) => !ge(n) || !xe(n.id) || !xe(n.label))) throw new Error("Invalid Endless floor rules");
  const t = e.encounterType === "BATTLE" || e.encounterType === "ELITE" || e.encounterType === "BOSS";
  if (!Array.isArray(e.enemies) || e.enemies.length > 16 || (t ? e.enemies.length < 1 : e.enemies.length !== 0)) throw new Error("Invalid Endless floor enemies");
  for (const n of e.enemies) Ar(n);
}, Qo = (e) => {
  if (!ge(e) || !Array.isArray(e.units) || e.units.length < 1 || e.units.length > 32 || !We(e.turn) || !We(e.maxTurns, 1) || e.maxTurns > 1e4 || ![null, "PLAYER", "ENEMY", "DRAW"].includes(e.outcome) || !Array.isArray(e.log) || e.log.length > 1e5 || !ge(e.synergies)) throw new Error("Invalid Endless active battle");
  for (const t of e.units) Ar(t, !0);
  xi(e.skills);
}, Oi = (e) => {
  if (!ge(e) || Object.keys(e).some((n) => !["minRarity", "minScore", "allowedSlots", "alwaysKeepSets", "autoSalvage"].includes(n))) throw new Error("Invalid Endless loot filter");
  if (e.minRarity !== void 0 && !fn.includes(e.minRarity)) throw new Error("Invalid Endless loot rarity");
  if (e.minScore !== void 0 && !Ht(e.minScore)) throw new Error("Invalid Endless loot score");
  if (e.autoSalvage !== void 0 && typeof e.autoSalvage != "boolean") throw new Error("Invalid Endless auto salvage");
  if (e.allowedSlots !== void 0 && (!Array.isArray(e.allowedSlots) || e.allowedSlots.some((n) => !bn.includes(n)) || new Set(e.allowedSlots).size !== e.allowedSlots.length)) throw new Error("Invalid Endless allowed slots");
  const t = Object.keys(cn);
  if (e.alwaysKeepSets !== void 0 && (!Array.isArray(e.alwaysKeepSets) || e.alwaysKeepSets.some((n) => !t.includes(String(n))) || new Set(e.alwaysKeepSets).size !== e.alwaysKeepSets.length)) throw new Error("Invalid Endless kept sets");
}, Jo = (e) => {
  if (!ge(e) || e.version !== 1) throw new Error("Invalid Endless Mine state version");
  if (!["READY", "RUNNING", "PAUSED", "ENDED"].includes(String(e.status))) throw new Error("Invalid Endless Mine status");
  if (!Array.isArray(e.partyStoneIds) || e.partyStoneIds.length > 3 || e.partyStoneIds.some((i) => typeof i != "string") || new Set(e.partyStoneIds).size !== e.partyStoneIds.length) throw new Error("Invalid Endless Mine party");
  if (!Array.isArray(e.partySnapshot) || e.partySnapshot.length > 3) throw new Error("Invalid Endless Mine snapshot");
  for (const i of e.partySnapshot) Ar(i);
  if (xi(e.skillBook), !["BALANCED", "AGGRESSIVE", "DEFENSIVE", "BOSS_FOCUS", "RESOURCE_SAVE"].includes(String(e.strategy))) throw new Error("Invalid Endless Mine strategy");
  if (![1, 2, 4].includes(Number(e.speed)) || typeof e.manualMode != "boolean") throw new Error("Invalid Endless Mine controls");
  for (const i of ["startedAt", "lastProcessedAt", "nextFloorAt"]) if (!Yo(e[i], !0)) throw new Error(`Invalid Endless Mine ${i}`);
  for (const i of ["highestFloor", "weeklyHighestFloor", "winStreak", "pendingCredits"]) if (!We(e[i])) throw new Error(`Invalid Endless Mine ${i}`);
  if (e.highestFloor > Ze || e.weeklyHighestFloor > Ze || e.pendingCredits > Rn) throw new Error("Invalid Endless campaign bounds");
  if (typeof e.weeklySeed != "string" || e.weeklySeed.length > 128) throw new Error("Invalid weekly seed");
  if (!Array.isArray(e.recentLog) || e.recentLog.length > 80 || e.recentLog.some((i) => typeof i != "string" || i.length > 1e3)) throw new Error("Invalid Endless Mine log");
  if (!ge(e.claimLedger) || Object.keys(e.claimLedger).length > 1e5 || Object.keys(e.claimLedger).some((i) => !xe(i, 512)) || Object.values(e.claimLedger).some((i) => i !== !0)) throw new Error("Invalid Endless Mine claim ledger");
  const t = e.equipment;
  if (!ge(t) || !We(t.capacity, 1) || t.capacity > 1e4 || !We(t.salvageMaterials) || !Array.isArray(t.items) || t.items.length > t.capacity) throw new Error("Invalid Endless equipment inventory");
  const n = /* @__PURE__ */ new Set();
  for (const i of t.items) {
    if (!ge(i) || !xe(i.id, 512) || typeof i.locked != "boolean" || !Array.isArray(i.affixes)) throw new Error("Invalid Endless equipment item");
    if (n.has(i.id)) throw new Error(`Duplicate Endless equipment id ${i.id}`);
    n.add(i.id), wi(i);
  }
  if (Oi(e.lootFilter), e.activeFloor === null != (e.activeBattle === null)) throw new Error("Incomplete Endless active battle");
  if (e.activeFloor !== null && zo(e.activeFloor), e.activeBattle !== null && Qo(e.activeBattle), ge(e.activeFloor) && !["BATTLE", "ELITE", "BOSS"].includes(String(e.activeFloor.encounterType))) throw new Error("Non-combat Endless floor cannot retain a battle");
  if (e.runId !== null && !xe(e.runId, 512)) throw new Error("Invalid Endless run id");
  if (e.run !== null) {
    if (!ge(e.run) || !xe(e.run.seed) || !["ACTIVE", "AUTO", "OFFLINE"].includes(String(e.run.mode)) || !["CLIMBING", "DEFEATED", "COMPLETE"].includes(String(e.run.status))) throw new Error("Invalid Endless run");
    e.run.resonanceIntegrity === void 0 && (e.run.resonanceIntegrity = Tt);
    for (const l of ["currentFloor", "highestClearedFloor", "checkpointFloor", "totalReward", "clearedBosses", "battles", "resonanceIntegrity"]) if (!We(e.run[l])) throw new Error(`Invalid Endless run ${l}`);
    const i = e.run.currentFloor, s = e.run.highestClearedFloor, o = e.run.checkpointFloor, a = e.run.clearedBosses;
    if (i < 1 || i > Ze || s > Ze || o > s || o % Ut.checkpointInterval !== 0 || a > Math.floor(s / 10) || e.run.totalReward > Rn || e.run.resonanceIntegrity > Tt) throw new Error("Invalid Endless run floor bounds");
    if (e.run.lastDefeatFloor !== null && (!We(e.run.lastDefeatFloor, 1) || e.run.lastDefeatFloor > Ze)) throw new Error("Invalid Endless defeat floor");
    if (e.run.status === "DEFEATED" && (e.run.lastDefeatFloor === null || i !== e.run.lastDefeatFloor)) throw new Error("Incoherent defeated Endless run");
    if (e.run.status === "COMPLETE" && (i !== Ze || s !== Ze)) throw new Error("Incoherent completed Endless run");
  }
  if (e.run === null != (e.runId === null)) throw new Error("Incomplete Endless run identity");
  if (e.status === "READY" && (e.run !== null || e.runId !== null || e.partyStoneIds.length || e.partySnapshot.length || e.activeFloor !== null)) throw new Error("Incoherent ready Endless campaign");
  if (e.run !== null && e.partySnapshot.length !== e.partyStoneIds.length) throw new Error("Incoherent Endless party snapshot");
  if ((e.status === "RUNNING" || e.status === "PAUSED") && (e.run === null || e.run.status !== "CLIMBING")) throw new Error("Active Endless campaign has no climbing run");
  if (e.status === "ENDED" && e.run?.status === "CLIMBING" && !e.claimLedger[String(e.runId)]) throw new Error("Unclaimed climbing run cannot be ended");
  if (e.run?.status === "DEFEATED" && e.status !== "ENDED") throw new Error("Defeated Endless run must be ended");
  if (e.run?.status === "COMPLETE" && e.status !== "ENDED") throw new Error("Completed Endless run must be ended");
  if (e.status === "ENDED" && e.activeFloor !== null) throw new Error("Ended Endless campaign cannot retain a battle");
  if (e.status === "RUNNING" && !e.nextFloorAt) throw new Error("Running Endless Mine is incomplete");
  if (e.status !== "RUNNING" && e.nextFloorAt !== null) throw new Error("Inactive Endless Mine has a pending timer");
  if (e.run !== null && (!e.startedAt || !e.lastProcessedAt)) throw new Error("Endless run timestamps are missing");
  if (e.run && (e.highestFloor < e.run.highestClearedFloor || e.pendingCredits > e.run.totalReward)) throw new Error("Incoherent Endless campaign progress");
  if (ge(e.activeFloor) && e.run && e.activeFloor.floor !== e.run.currentFloor) throw new Error("Endless active floor does not match run");
  const r = [e.partySnapshot, e.skillBook, e.activeFloor, e.activeBattle];
  for (; r.length; ) {
    const i = r.pop();
    if (typeof i == "number" && !Number.isFinite(i)) throw new Error("Endless Mine contains a non-finite number");
    Array.isArray(i) ? r.push(...i) : ge(i) && r.push(...Object.values(i));
  }
  return e;
}, Li = () => ({ version: 1, stones: {}, species: {}, totalXp: 0 }), Zo = (e) => Math.max(500, Math.floor(750 * Math.pow(e + 1, 1.24))), ea = (e) => [
  ...e >= 2 ? ["lore-entry-1"] : [],
  ...e >= 5 ? ["profile-badge"] : [],
  ...e >= 10 ? ["resonance-aura"] : [],
  ...e >= 20 ? ["minor-passive"] : [],
  ...e >= 40 ? ["mastery-title"] : []
], $r = (e, t) => {
  for (e.xp = Xe(e.xp, t); e.level < 1e4; ) {
    const n = Zo(e.level);
    if (e.xp < n) break;
    e.xp -= n, e.level += 1;
  }
  e.unlockedRewardIds = ea(e.level);
}, Pr = (e, t) => e[t] ??= { xp: 0, level: 0, unlockedRewardIds: [] }, ta = (e, t, n, r) => {
  if (n === e) return Math.max(0, r - t);
  let i = Math.max(0, qt.stone(e) - t);
  for (let s = e + 1; s < n; s += 1) i = Xe(i, qt.stone(s));
  return Xe(i, r);
}, wr = (e, t, n) => {
  if (!Number.isFinite(n) || n < 0) throw new RangeError("XP amount must be finite and non-negative");
  const r = Math.floor(n), i = e.level, s = e.xp, o = e.level >= Cn(e), a = si(e, r), l = o ? 0 : Math.min(r, ta(i, s, e.level, e.xp)), d = Math.max(0, r - l), u = Pr(t.stones, e.instanceId), h = Pr(t.species, e.speciesId);
  return d > 0 && ($r(u, d), $r(h, Math.max(1, Math.floor(d * 0.35))), t.totalXp = Xe(t.totalXp, d)), { ...a, masteryXpGained: d, stoneMasteryLevel: u.level, speciesMasteryLevel: h.level };
}, na = (e) => {
  if (!e || typeof e != "object" || Array.isArray(e)) throw new Error("Invalid mastery state");
  const t = e;
  if (t.version !== 1 || !Number.isSafeInteger(t.totalXp) || t.totalXp < 0) throw new Error("Invalid mastery state header");
  for (const n of ["stones", "species"]) {
    const r = t[n];
    if (!r || typeof r != "object" || Array.isArray(r) || Object.keys(r).length > 1e5) throw new Error(`Invalid mastery ${n}`);
    for (const [i, s] of Object.entries(r)) {
      if (!i || !s || typeof s != "object" || Array.isArray(s)) throw new Error(`Invalid mastery entry ${i}`);
      const o = s;
      if (!Number.isSafeInteger(o.xp) || o.xp < 0 || !Number.isSafeInteger(o.level) || o.level < 0 || o.level > 1e4) throw new Error(`Invalid mastery progression ${i}`);
      if (!Array.isArray(o.unlockedRewardIds) || o.unlockedRewardIds.length > 16 || o.unlockedRewardIds.some((a) => typeof a != "string")) throw new Error(`Invalid mastery rewards ${i}`);
    }
  }
  return e;
}, Ge = 5, Jn = (e = {}) => {
  const t = e.clock ?? de, n = t.now(), r = e.rng ?? new Re(e.seed ?? `${n.toISOString()}:new-game`), i = e.accountId ?? tt("account", r, n.getTime()), s = (e.username?.trim() || "Stonekeeper").slice(0, 24), o = {
    accountId: i,
    username: s,
    avatarId: "avatar_founder",
    profileFrameId: "frame_basalt",
    equippedTitleId: "title_new_resonance",
    ownedTitleIds: ["title_new_resonance"],
    ownedFrameIds: ["frame_basalt"],
    arenaRating: 1e3,
    arenaTier: "BRONZE",
    highestArenaTier: "BRONZE",
    raidStats: { lifetimeDamage: 0, bossesDefeated: 0, bestContributionRank: null },
    createdAt: n.toISOString(),
    lastOnlineAt: n.toISOString()
  }, a = { accountId: i, username: s }, l = e.withStarter === !1 ? [] : [
    Hn("species_pebblit", a, `${e.seed ?? i}:starter:1`, t),
    Hn("species_quartzling", a, `${e.seed ?? i}:starter:2`, t),
    Hn("species_emberite", a, `${e.seed ?? i}:starter:3`, t)
  ], d = Object.fromEntries(l.map((h) => [h.instanceId, h])), u = Object.fromEntries(cr.map((h) => [
    h.id,
    { value: 0, unlockedAt: null, claimedAt: null }
  ]));
  return {
    schemaVersion: Ge,
    revision: 0,
    account: o,
    accountProgress: { level: 1, xp: 0, researchPoints: 0, skillPoints: 0, selectedSkillNodes: [] },
    mining: {
      level: 1,
      xp: 0,
      totalMined: 0,
      dailyMined: 0,
      weeklyMined: 0,
      monthlyMined: 0,
      unlockedAreas: ["area_greenbreak"],
      unlockedVeins: ["vein_common"],
      processedFarmEventIds: {},
      lastMinedAt: null
    },
    facilities: { fusionLab: 1, researchLab: 1, expeditionGuild: 1 },
    expeditions: { runs: {}, order: [], discoveryStorage: [], overflowDiscarded: 0, totalCycles: 0, totalClaims: 0 },
    training: { assignment: null },
    affinityGarden: { assignment: null },
    research: { slot: null, completedProjectIds: [], claimLedger: {} },
    idle: {
      timeCheckpoint: ai(n.getTime()),
      scheduler: { version: 1, jobs: [] },
      lastProcessedAt: n.toISOString(),
      lastActiveAt: n.toISOString(),
      lastWelcomeBack: null
    },
    endlessMine: Ni(n),
    mastery: Li(),
    stones: d,
    unappraisedFinds: [],
    inventory: {
      currencies: { credits: 3e3, gachaTickets: 12, researchCores: 0, upgradeDust: 250 },
      items: { item_magma_heart: 0, item_eclipse_shard: 0, item_primordial_core: 0 },
      equipment: {},
      capacity: 500
    },
    collection: {
      discoveredSpeciesIds: l.map((h) => h.speciesId),
      mutationSpecies: Object.fromEntries(l.map((h) => [h.speciesId, [h.mutation]])),
      variantSpecies: Object.fromEntries(l.map((h) => [h.speciesId, [h.colorVariant]])),
      origins: l.length ? { EVENT: l.length } : {}
    },
    fusionHistory: [],
    gacha: { pityByBanner: {}, history: [], rarityCounts: {} },
    achievements: u,
    parties: [{ id: "party_primary", name: "Primary Formation", slots: l.map((h, w) => ({ stoneId: h.instanceId, position: w === 0 ? "FRONT" : "BACK" })), defense: !1 }],
    activePartyId: "party_primary",
    activeBattle: null,
    battleHistory: [],
    dungeonClears: {},
    profile: { showcaseStoneIds: l.map((h) => h.instanceId), favoriteStoneIds: [], totalAffinity: 0, public: !0 },
    statistics: { fusionCount: 0, mutationCount: 0, rareDiscoveryCount: 0, battleWins: 0, battleLosses: 0, highestInfiniteFloor: 0, totalRaidDamage: 0 },
    online: { connected: !0, sessionId: tt("session", r, n.getTime()), sequence: 0, queue: [], processedReceipts: [], lastSyncedAt: null },
    settings: { effectQuality: "HIGH", reduceMotion: !1, mute: !1, masterVolume: 0.8, musicVolume: 0.55, effectsVolume: 0.8, textScale: 1, developerMode: !1 },
    createdAt: n.toISOString(),
    updatedAt: n.toISOString()
  };
}, st = (e) => typeof structuredClone == "function" ? structuredClone(e) : JSON.parse(JSON.stringify(e)), ra = (e, t = de) => {
  e.revision += 1, e.updatedAt = t.now().toISOString();
}, Fr = (e) => {
  let t;
  const n = /* @__PURE__ */ new Set(), r = (d, u) => {
    const h = typeof d == "function" ? d(t) : d;
    if (!Object.is(h, t)) {
      const w = t;
      t = u ?? (typeof h != "object" || h === null) ? h : Object.assign({}, t, h), n.forEach((E) => E(t, w));
    }
  }, i = () => t, a = { setState: r, getState: i, getInitialState: () => l, subscribe: (d) => (n.add(d), () => n.delete(d)) }, l = t = e(r, i, a);
  return a;
}, ia = ((e) => e ? Fr(e) : Fr);
function sa(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var yn = { exports: {} }, Q = {};
var Br;
function oa() {
  if (Br) return Q;
  Br = 1;
  var e = /* @__PURE__ */ Symbol.for("react.transitional.element"), t = /* @__PURE__ */ Symbol.for("react.portal"), n = /* @__PURE__ */ Symbol.for("react.fragment"), r = /* @__PURE__ */ Symbol.for("react.strict_mode"), i = /* @__PURE__ */ Symbol.for("react.profiler"), s = /* @__PURE__ */ Symbol.for("react.consumer"), o = /* @__PURE__ */ Symbol.for("react.context"), a = /* @__PURE__ */ Symbol.for("react.forward_ref"), l = /* @__PURE__ */ Symbol.for("react.suspense"), d = /* @__PURE__ */ Symbol.for("react.memo"), u = /* @__PURE__ */ Symbol.for("react.lazy"), h = /* @__PURE__ */ Symbol.for("react.activity"), w = Symbol.iterator;
  function E(I) {
    return I === null || typeof I != "object" ? null : (I = w && I[w] || I["@@iterator"], typeof I == "function" ? I : null);
  }
  var m = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, A = Object.assign, S = {};
  function k(I, x, X) {
    this.props = I, this.context = x, this.refs = S, this.updater = X || m;
  }
  k.prototype.isReactComponent = {}, k.prototype.setState = function(I, x) {
    if (typeof I != "object" && typeof I != "function" && I != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, I, x, "setState");
  }, k.prototype.forceUpdate = function(I) {
    this.updater.enqueueForceUpdate(this, I, "forceUpdate");
  };
  function T() {
  }
  T.prototype = k.prototype;
  function p(I, x, X) {
    this.props = I, this.context = x, this.refs = S, this.updater = X || m;
  }
  var f = p.prototype = new T();
  f.constructor = p, A(f, k.prototype), f.isPureReactComponent = !0;
  var y = Array.isArray;
  function b() {
  }
  var M = { H: null, A: null, T: null, S: null }, N = Object.prototype.hasOwnProperty;
  function L(I, x, X) {
    var Y = X.ref;
    return {
      $$typeof: e,
      type: I,
      key: x,
      ref: Y !== void 0 ? Y : null,
      props: X
    };
  }
  function G(I, x) {
    return L(I.type, x, I.props);
  }
  function H(I) {
    return typeof I == "object" && I !== null && I.$$typeof === e;
  }
  function q(I) {
    var x = { "=": "=0", ":": "=2" };
    return "$" + I.replace(/[=:]/g, function(X) {
      return x[X];
    });
  }
  var K = /\/+/g;
  function ue(I, x) {
    return typeof I == "object" && I !== null && I.key != null ? q("" + I.key) : x.toString(36);
  }
  function F(I) {
    switch (I.status) {
      case "fulfilled":
        return I.value;
      case "rejected":
        throw I.reason;
      default:
        switch (typeof I.status == "string" ? I.then(b, b) : (I.status = "pending", I.then(
          function(x) {
            I.status === "pending" && (I.status = "fulfilled", I.value = x);
          },
          function(x) {
            I.status === "pending" && (I.status = "rejected", I.reason = x);
          }
        )), I.status) {
          case "fulfilled":
            return I.value;
          case "rejected":
            throw I.reason;
        }
    }
    throw I;
  }
  function z(I, x, X, Y, re) {
    var oe = typeof I;
    (oe === "undefined" || oe === "boolean") && (I = null);
    var le = !1;
    if (I === null) le = !0;
    else
      switch (oe) {
        case "bigint":
        case "string":
        case "number":
          le = !0;
          break;
        case "object":
          switch (I.$$typeof) {
            case e:
            case t:
              le = !0;
              break;
            case u:
              return le = I._init, z(
                le(I._payload),
                x,
                X,
                Y,
                re
              );
          }
      }
    if (le)
      return re = re(I), le = Y === "" ? "." + ue(I, 0) : Y, y(re) ? (X = "", le != null && (X = le.replace(K, "$&/") + "/"), z(re, x, X, "", function(nt) {
        return nt;
      })) : re != null && (H(re) && (re = G(
        re,
        X + (re.key == null || I && I.key === re.key ? "" : ("" + re.key).replace(
          K,
          "$&/"
        ) + "/") + le
      )), x.push(re)), 1;
    le = 0;
    var be = Y === "" ? "." : Y + ":";
    if (y(I))
      for (var Ee = 0; Ee < I.length; Ee++)
        Y = I[Ee], oe = be + ue(Y, Ee), le += z(
          Y,
          x,
          X,
          oe,
          re
        );
    else if (Ee = E(I), typeof Ee == "function")
      for (I = Ee.call(I), Ee = 0; !(Y = I.next()).done; )
        Y = Y.value, oe = be + ue(Y, Ee++), le += z(
          Y,
          x,
          X,
          oe,
          re
        );
    else if (oe === "object") {
      if (typeof I.then == "function")
        return z(
          F(I),
          x,
          X,
          Y,
          re
        );
      throw x = String(I), Error(
        "Objects are not valid as a React child (found: " + (x === "[object Object]" ? "object with keys {" + Object.keys(I).join(", ") + "}" : x) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return le;
  }
  function se(I, x, X) {
    if (I == null) return I;
    var Y = [], re = 0;
    return z(I, Y, "", "", function(oe) {
      return x.call(X, oe, re++);
    }), Y;
  }
  function _e(I) {
    if (I._status === -1) {
      var x = I._result;
      x = x(), x.then(
        function(X) {
          (I._status === 0 || I._status === -1) && (I._status = 1, I._result = X);
        },
        function(X) {
          (I._status === 0 || I._status === -1) && (I._status = 2, I._result = X);
        }
      ), I._status === -1 && (I._status = 0, I._result = x);
    }
    if (I._status === 1) return I._result.default;
    throw I._result;
  }
  var Ne = typeof reportError == "function" ? reportError : function(I) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var x = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof I == "object" && I !== null && typeof I.message == "string" ? String(I.message) : String(I),
        error: I
      });
      if (!window.dispatchEvent(x)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", I);
      return;
    }
    console.error(I);
  }, Le = {
    map: se,
    forEach: function(I, x, X) {
      se(
        I,
        function() {
          x.apply(this, arguments);
        },
        X
      );
    },
    count: function(I) {
      var x = 0;
      return se(I, function() {
        x++;
      }), x;
    },
    toArray: function(I) {
      return se(I, function(x) {
        return x;
      }) || [];
    },
    only: function(I) {
      if (!H(I))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return I;
    }
  };
  return Q.Activity = h, Q.Children = Le, Q.Component = k, Q.Fragment = n, Q.Profiler = i, Q.PureComponent = p, Q.StrictMode = r, Q.Suspense = l, Q.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = M, Q.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(I) {
      return M.H.useMemoCache(I);
    }
  }, Q.cache = function(I) {
    return function() {
      return I.apply(null, arguments);
    };
  }, Q.cacheSignal = function() {
    return null;
  }, Q.cloneElement = function(I, x, X) {
    if (I == null)
      throw Error(
        "The argument must be a React element, but you passed " + I + "."
      );
    var Y = A({}, I.props), re = I.key;
    if (x != null)
      for (oe in x.key !== void 0 && (re = "" + x.key), x)
        !N.call(x, oe) || oe === "key" || oe === "__self" || oe === "__source" || oe === "ref" && x.ref === void 0 || (Y[oe] = x[oe]);
    var oe = arguments.length - 2;
    if (oe === 1) Y.children = X;
    else if (1 < oe) {
      for (var le = Array(oe), be = 0; be < oe; be++)
        le[be] = arguments[be + 2];
      Y.children = le;
    }
    return L(I.type, re, Y);
  }, Q.createContext = function(I) {
    return I = {
      $$typeof: o,
      _currentValue: I,
      _currentValue2: I,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, I.Provider = I, I.Consumer = {
      $$typeof: s,
      _context: I
    }, I;
  }, Q.createElement = function(I, x, X) {
    var Y, re = {}, oe = null;
    if (x != null)
      for (Y in x.key !== void 0 && (oe = "" + x.key), x)
        N.call(x, Y) && Y !== "key" && Y !== "__self" && Y !== "__source" && (re[Y] = x[Y]);
    var le = arguments.length - 2;
    if (le === 1) re.children = X;
    else if (1 < le) {
      for (var be = Array(le), Ee = 0; Ee < le; Ee++)
        be[Ee] = arguments[Ee + 2];
      re.children = be;
    }
    if (I && I.defaultProps)
      for (Y in le = I.defaultProps, le)
        re[Y] === void 0 && (re[Y] = le[Y]);
    return L(I, oe, re);
  }, Q.createRef = function() {
    return { current: null };
  }, Q.forwardRef = function(I) {
    return { $$typeof: a, render: I };
  }, Q.isValidElement = H, Q.lazy = function(I) {
    return {
      $$typeof: u,
      _payload: { _status: -1, _result: I },
      _init: _e
    };
  }, Q.memo = function(I, x) {
    return {
      $$typeof: d,
      type: I,
      compare: x === void 0 ? null : x
    };
  }, Q.startTransition = function(I) {
    var x = M.T, X = {};
    M.T = X;
    try {
      var Y = I(), re = M.S;
      re !== null && re(X, Y), typeof Y == "object" && Y !== null && typeof Y.then == "function" && Y.then(b, Ne);
    } catch (oe) {
      Ne(oe);
    } finally {
      x !== null && X.types !== null && (x.types = X.types), M.T = x;
    }
  }, Q.unstable_useCacheRefresh = function() {
    return M.H.useCacheRefresh();
  }, Q.use = function(I) {
    return M.H.use(I);
  }, Q.useActionState = function(I, x, X) {
    return M.H.useActionState(I, x, X);
  }, Q.useCallback = function(I, x) {
    return M.H.useCallback(I, x);
  }, Q.useContext = function(I) {
    return M.H.useContext(I);
  }, Q.useDebugValue = function() {
  }, Q.useDeferredValue = function(I, x) {
    return M.H.useDeferredValue(I, x);
  }, Q.useEffect = function(I, x) {
    return M.H.useEffect(I, x);
  }, Q.useEffectEvent = function(I) {
    return M.H.useEffectEvent(I);
  }, Q.useId = function() {
    return M.H.useId();
  }, Q.useImperativeHandle = function(I, x, X) {
    return M.H.useImperativeHandle(I, x, X);
  }, Q.useInsertionEffect = function(I, x) {
    return M.H.useInsertionEffect(I, x);
  }, Q.useLayoutEffect = function(I, x) {
    return M.H.useLayoutEffect(I, x);
  }, Q.useMemo = function(I, x) {
    return M.H.useMemo(I, x);
  }, Q.useOptimistic = function(I, x) {
    return M.H.useOptimistic(I, x);
  }, Q.useReducer = function(I, x, X) {
    return M.H.useReducer(I, x, X);
  }, Q.useRef = function(I) {
    return M.H.useRef(I);
  }, Q.useState = function(I) {
    return M.H.useState(I);
  }, Q.useSyncExternalStore = function(I, x, X) {
    return M.H.useSyncExternalStore(
      I,
      x,
      X
    );
  }, Q.useTransition = function() {
    return M.H.useTransition();
  }, Q.version = "19.2.0", Q;
}
var Zt = { exports: {} };
Zt.exports;
var qr;
function aa() {
  return qr || (qr = 1, (function(e, t) {
    process.env.NODE_ENV !== "production" && (function() {
      function n(c, g) {
        Object.defineProperty(s.prototype, c, {
          get: function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              g[0],
              g[1]
            );
          }
        });
      }
      function r(c) {
        return c === null || typeof c != "object" ? null : (c = En && c[En] || c["@@iterator"], typeof c == "function" ? c : null);
      }
      function i(c, g) {
        c = (c = c.constructor) && (c.displayName || c.name) || "ReactClass";
        var _ = c + "." + g;
        It[_] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          g,
          c
        ), It[_] = !0);
      }
      function s(c, g, _) {
        this.props = c, this.context = g, this.refs = Kt, this.updater = _ || gn;
      }
      function o() {
      }
      function a(c, g, _) {
        this.props = c, this.context = g, this.refs = Kt, this.updater = _ || gn;
      }
      function l() {
      }
      function d(c) {
        return "" + c;
      }
      function u(c) {
        try {
          d(c);
          var g = !1;
        } catch {
          g = !0;
        }
        if (g) {
          g = console;
          var _ = g.error, P = typeof Symbol == "function" && Symbol.toStringTag && c[Symbol.toStringTag] || c.constructor.name || "Object";
          return _.call(
            g,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            P
          ), d(c);
        }
      }
      function h(c) {
        if (c == null) return null;
        if (typeof c == "function")
          return c.$$typeof === Qe ? null : c.displayName || c.name || null;
        if (typeof c == "string") return c;
        switch (c) {
          case I:
            return "Fragment";
          case X:
            return "Profiler";
          case x:
            return "StrictMode";
          case le:
            return "Suspense";
          case be:
            return "SuspenseList";
          case Wt:
            return "Activity";
        }
        if (typeof c == "object")
          switch (typeof c.tag == "number" && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), c.$$typeof) {
            case Le:
              return "Portal";
            case re:
              return c.displayName || "Context";
            case Y:
              return (c._context.displayName || "Context") + ".Consumer";
            case oe:
              var g = c.render;
              return c = c.displayName, c || (c = g.displayName || g.name || "", c = c !== "" ? "ForwardRef(" + c + ")" : "ForwardRef"), c;
            case Ee:
              return g = c.displayName || null, g !== null ? g : h(c.type) || "Memo";
            case nt:
              g = c._payload, c = c._init;
              try {
                return h(c(g));
              } catch {
              }
          }
        return null;
      }
      function w(c) {
        if (c === I) return "<>";
        if (typeof c == "object" && c !== null && c.$$typeof === nt)
          return "<...>";
        try {
          var g = h(c);
          return g ? "<" + g + ">" : "<...>";
        } catch {
          return "<...>";
        }
      }
      function E() {
        var c = Z.A;
        return c === null ? null : c.getOwner();
      }
      function m() {
        return Error("react-stack-top-frame");
      }
      function A(c) {
        if (R.call(c, "key")) {
          var g = Object.getOwnPropertyDescriptor(c, "key").get;
          if (g && g.isReactWarning) return !1;
        }
        return c.key !== void 0;
      }
      function S(c, g) {
        function _() {
          v || (v = !0, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            g
          ));
        }
        _.isReactWarning = !0, Object.defineProperty(c, "key", {
          get: _,
          configurable: !0
        });
      }
      function k() {
        var c = h(this.type);
        return Ie[c] || (Ie[c] = !0, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        )), c = this.props.ref, c !== void 0 ? c : null;
      }
      function T(c, g, _, P, j, ee) {
        var W = _.ref;
        return c = {
          $$typeof: Ne,
          type: c,
          key: g,
          props: _,
          _owner: P
        }, (W !== void 0 ? W : null) !== null ? Object.defineProperty(c, "ref", {
          enumerable: !1,
          get: k
        }) : Object.defineProperty(c, "ref", { enumerable: !1, value: null }), c._store = {}, Object.defineProperty(c._store, "validated", {
          configurable: !1,
          enumerable: !1,
          writable: !0,
          value: 0
        }), Object.defineProperty(c, "_debugInfo", {
          configurable: !1,
          enumerable: !1,
          writable: !0,
          value: null
        }), Object.defineProperty(c, "_debugStack", {
          configurable: !1,
          enumerable: !1,
          writable: !0,
          value: j
        }), Object.defineProperty(c, "_debugTask", {
          configurable: !1,
          enumerable: !1,
          writable: !0,
          value: ee
        }), Object.freeze && (Object.freeze(c.props), Object.freeze(c)), c;
      }
      function p(c, g) {
        return g = T(
          c.type,
          g,
          c.props,
          c._owner,
          c._debugStack,
          c._debugTask
        ), c._store && (g._store.validated = c._store.validated), g;
      }
      function f(c) {
        y(c) ? c._store && (c._store.validated = 1) : typeof c == "object" && c !== null && c.$$typeof === nt && (c._payload.status === "fulfilled" ? y(c._payload.value) && c._payload.value._store && (c._payload.value._store.validated = 1) : c._store && (c._store.validated = 1));
      }
      function y(c) {
        return typeof c == "object" && c !== null && c.$$typeof === Ne;
      }
      function b(c) {
        var g = { "=": "=0", ":": "=2" };
        return "$" + c.replace(/[=:]/g, function(_) {
          return g[_];
        });
      }
      function M(c, g) {
        return typeof c == "object" && c !== null && c.key != null ? (u(c.key), b("" + c.key)) : g.toString(36);
      }
      function N(c) {
        switch (c.status) {
          case "fulfilled":
            return c.value;
          case "rejected":
            throw c.reason;
          default:
            switch (typeof c.status == "string" ? c.then(l, l) : (c.status = "pending", c.then(
              function(g) {
                c.status === "pending" && (c.status = "fulfilled", c.value = g);
              },
              function(g) {
                c.status === "pending" && (c.status = "rejected", c.reason = g);
              }
            )), c.status) {
              case "fulfilled":
                return c.value;
              case "rejected":
                throw c.reason;
            }
        }
        throw c;
      }
      function L(c, g, _, P, j) {
        var ee = typeof c;
        (ee === "undefined" || ee === "boolean") && (c = null);
        var W = !1;
        if (c === null) W = !0;
        else
          switch (ee) {
            case "bigint":
            case "string":
            case "number":
              W = !0;
              break;
            case "object":
              switch (c.$$typeof) {
                case Ne:
                case Le:
                  W = !0;
                  break;
                case nt:
                  return W = c._init, L(
                    W(c._payload),
                    g,
                    _,
                    P,
                    j
                  );
              }
          }
        if (W) {
          W = c, j = j(W);
          var ae = P === "" ? "." + M(W, 0) : P;
          return zt(j) ? (_ = "", ae != null && (_ = ae.replace(ye, "$&/") + "/"), L(j, g, _, "", function(dt) {
            return dt;
          })) : j != null && (y(j) && (j.key != null && (W && W.key === j.key || u(j.key)), _ = p(
            j,
            _ + (j.key == null || W && W.key === j.key ? "" : ("" + j.key).replace(
              ye,
              "$&/"
            ) + "/") + ae
          ), P !== "" && W != null && y(W) && W.key == null && W._store && !W._store.validated && (_._store.validated = 2), j = _), g.push(j)), 1;
        }
        if (W = 0, ae = P === "" ? "." : P + ":", zt(c))
          for (var ne = 0; ne < c.length; ne++)
            P = c[ne], ee = ae + M(P, ne), W += L(
              P,
              g,
              _,
              ee,
              j
            );
        else if (ne = r(c), typeof ne == "function")
          for (ne === c.entries && (De || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), De = !0), c = ne.call(c), ne = 0; !(P = c.next()).done; )
            P = P.value, ee = ae + M(P, ne++), W += L(
              P,
              g,
              _,
              ee,
              j
            );
        else if (ee === "object") {
          if (typeof c.then == "function")
            return L(
              N(c),
              g,
              _,
              P,
              j
            );
          throw g = String(c), Error(
            "Objects are not valid as a React child (found: " + (g === "[object Object]" ? "object with keys {" + Object.keys(c).join(", ") + "}" : g) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return W;
      }
      function G(c, g, _) {
        if (c == null) return c;
        var P = [], j = 0;
        return L(c, P, "", "", function(ee) {
          return g.call(_, ee, j++);
        }), P;
      }
      function H(c) {
        if (c._status === -1) {
          var g = c._ioInfo;
          g != null && (g.start = g.end = performance.now()), g = c._result;
          var _ = g();
          if (_.then(
            function(j) {
              if (c._status === 0 || c._status === -1) {
                c._status = 1, c._result = j;
                var ee = c._ioInfo;
                ee != null && (ee.end = performance.now()), _.status === void 0 && (_.status = "fulfilled", _.value = j);
              }
            },
            function(j) {
              if (c._status === 0 || c._status === -1) {
                c._status = 2, c._result = j;
                var ee = c._ioInfo;
                ee != null && (ee.end = performance.now()), _.status === void 0 && (_.status = "rejected", _.reason = j);
              }
            }
          ), g = c._ioInfo, g != null) {
            g.value = _;
            var P = _.displayName;
            typeof P == "string" && (g.name = P);
          }
          c._status === -1 && (c._status = 0, c._result = _);
        }
        if (c._status === 1)
          return g = c._result, g === void 0 && console.error(
            `lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))

Did you accidentally put curly braces around the import?`,
            g
          ), "default" in g || console.error(
            `lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))`,
            g
          ), g.default;
        throw c._result;
      }
      function q() {
        var c = Z.H;
        return c === null && console.error(
          `Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`
        ), c;
      }
      function K() {
        Z.asyncTransitions--;
      }
      function ue(c) {
        if (yt === null)
          try {
            var g = ("require" + Math.random()).slice(0, 7);
            yt = (e && e[g]).call(
              e,
              "timers"
            ).setImmediate;
          } catch {
            yt = function(P) {
              Qt === !1 && (Qt = !0, typeof MessageChannel > "u" && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var j = new MessageChannel();
              j.port1.onmessage = P, j.port2.postMessage(void 0);
            };
          }
        return yt(c);
      }
      function F(c) {
        return 1 < c.length && typeof AggregateError == "function" ? new AggregateError(c) : c[0];
      }
      function z(c, g) {
        g !== at - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        ), at = g;
      }
      function se(c, g, _) {
        var P = Z.actQueue;
        if (P !== null)
          if (P.length !== 0)
            try {
              _e(P), ue(function() {
                return se(c, g, _);
              });
              return;
            } catch (j) {
              Z.thrownErrors.push(j);
            }
          else Z.actQueue = null;
        0 < Z.thrownErrors.length ? (P = F(Z.thrownErrors), Z.thrownErrors.length = 0, _(P)) : g(c);
      }
      function _e(c) {
        if (!Ot) {
          Ot = !0;
          var g = 0;
          try {
            for (; g < c.length; g++) {
              var _ = c[g];
              do {
                Z.didUsePromise = !1;
                var P = _(!1);
                if (P !== null) {
                  if (Z.didUsePromise) {
                    c[g] = _, c.splice(0, g);
                    return;
                  }
                  _ = P;
                } else break;
              } while (!0);
            }
            c.length = 0;
          } catch (j) {
            c.splice(0, g + 1), Z.thrownErrors.push(j);
          } finally {
            Ot = !1;
          }
        }
      }
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var Ne = /* @__PURE__ */ Symbol.for("react.transitional.element"), Le = /* @__PURE__ */ Symbol.for("react.portal"), I = /* @__PURE__ */ Symbol.for("react.fragment"), x = /* @__PURE__ */ Symbol.for("react.strict_mode"), X = /* @__PURE__ */ Symbol.for("react.profiler"), Y = /* @__PURE__ */ Symbol.for("react.consumer"), re = /* @__PURE__ */ Symbol.for("react.context"), oe = /* @__PURE__ */ Symbol.for("react.forward_ref"), le = /* @__PURE__ */ Symbol.for("react.suspense"), be = /* @__PURE__ */ Symbol.for("react.suspense_list"), Ee = /* @__PURE__ */ Symbol.for("react.memo"), nt = /* @__PURE__ */ Symbol.for("react.lazy"), Wt = /* @__PURE__ */ Symbol.for("react.activity"), En = Symbol.iterator, It = {}, gn = {
        isMounted: function() {
          return !1;
        },
        enqueueForceUpdate: function(c) {
          i(c, "forceUpdate");
        },
        enqueueReplaceState: function(c) {
          i(c, "replaceState");
        },
        enqueueSetState: function(c) {
          i(c, "setState");
        }
      }, rt = Object.assign, Kt = {};
      Object.freeze(Kt), s.prototype.isReactComponent = {}, s.prototype.setState = function(c, g) {
        if (typeof c != "object" && typeof c != "function" && c != null)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, c, g, "setState");
      }, s.prototype.forceUpdate = function(c) {
        this.updater.enqueueForceUpdate(this, c, "forceUpdate");
      };
      var Me = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      };
      for (Ce in Me)
        Me.hasOwnProperty(Ce) && n(Ce, Me[Ce]);
      o.prototype = s.prototype, Me = a.prototype = new o(), Me.constructor = a, rt(Me, s.prototype), Me.isPureReactComponent = !0;
      var zt = Array.isArray, Qe = /* @__PURE__ */ Symbol.for("react.client.reference"), Z = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        asyncTransitions: 0,
        isBatchingLegacy: !1,
        didScheduleLegacyUpdate: !1,
        didUsePromise: !1,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, R = Object.prototype.hasOwnProperty, U = console.createTask ? console.createTask : function() {
        return null;
      };
      Me = {
        react_stack_bottom_frame: function(c) {
          return c();
        }
      };
      var v, D, Ie = {}, Ye = Me.react_stack_bottom_frame.bind(
        Me,
        m
      )(), it = U(w(m)), De = !1, ye = /\/+/g, ke = typeof reportError == "function" ? reportError : function(c) {
        if (typeof window == "object" && typeof window.ErrorEvent == "function") {
          var g = new window.ErrorEvent("error", {
            bubbles: !0,
            cancelable: !0,
            message: typeof c == "object" && c !== null && typeof c.message == "string" ? String(c.message) : String(c),
            error: c
          });
          if (!window.dispatchEvent(g)) return;
        } else if (typeof process == "object" && typeof process.emit == "function") {
          process.emit("uncaughtException", c);
          return;
        }
        console.error(c);
      }, Qt = !1, yt = null, at = 0, ct = !1, Ot = !1, lt = typeof queueMicrotask == "function" ? function(c) {
        queueMicrotask(function() {
          return queueMicrotask(c);
        });
      } : ue;
      Me = Object.freeze({
        __proto__: null,
        c: function(c) {
          return q().useMemoCache(c);
        }
      });
      var Ce = {
        map: G,
        forEach: function(c, g, _) {
          G(
            c,
            function() {
              g.apply(this, arguments);
            },
            _
          );
        },
        count: function(c) {
          var g = 0;
          return G(c, function() {
            g++;
          }), g;
        },
        toArray: function(c) {
          return G(c, function(g) {
            return g;
          }) || [];
        },
        only: function(c) {
          if (!y(c))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return c;
        }
      };
      t.Activity = Wt, t.Children = Ce, t.Component = s, t.Fragment = I, t.Profiler = X, t.PureComponent = a, t.StrictMode = x, t.Suspense = le, t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Z, t.__COMPILER_RUNTIME = Me, t.act = function(c) {
        var g = Z.actQueue, _ = at;
        at++;
        var P = Z.actQueue = g !== null ? g : [], j = !1;
        try {
          var ee = c();
        } catch (ne) {
          Z.thrownErrors.push(ne);
        }
        if (0 < Z.thrownErrors.length)
          throw z(g, _), c = F(Z.thrownErrors), Z.thrownErrors.length = 0, c;
        if (ee !== null && typeof ee == "object" && typeof ee.then == "function") {
          var W = ee;
          return lt(function() {
            j || ct || (ct = !0, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          }), {
            then: function(ne, dt) {
              j = !0, W.then(
                function(Lt) {
                  if (z(g, _), _ === 0) {
                    try {
                      _e(P), ue(function() {
                        return se(
                          Lt,
                          ne,
                          dt
                        );
                      });
                    } catch (ls) {
                      Z.thrownErrors.push(ls);
                    }
                    if (0 < Z.thrownErrors.length) {
                      var cs = F(
                        Z.thrownErrors
                      );
                      Z.thrownErrors.length = 0, dt(cs);
                    }
                  } else ne(Lt);
                },
                function(Lt) {
                  z(g, _), 0 < Z.thrownErrors.length && (Lt = F(
                    Z.thrownErrors
                  ), Z.thrownErrors.length = 0), dt(Lt);
                }
              );
            }
          };
        }
        var ae = ee;
        if (z(g, _), _ === 0 && (_e(P), P.length !== 0 && lt(function() {
          j || ct || (ct = !0, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), Z.actQueue = null), 0 < Z.thrownErrors.length)
          throw c = F(Z.thrownErrors), Z.thrownErrors.length = 0, c;
        return {
          then: function(ne, dt) {
            j = !0, _ === 0 ? (Z.actQueue = P, ue(function() {
              return se(
                ae,
                ne,
                dt
              );
            })) : ne(ae);
          }
        };
      }, t.cache = function(c) {
        return function() {
          return c.apply(null, arguments);
        };
      }, t.cacheSignal = function() {
        return null;
      }, t.captureOwnerStack = function() {
        var c = Z.getCurrentStack;
        return c === null ? null : c();
      }, t.cloneElement = function(c, g, _) {
        if (c == null)
          throw Error(
            "The argument must be a React element, but you passed " + c + "."
          );
        var P = rt({}, c.props), j = c.key, ee = c._owner;
        if (g != null) {
          var W;
          e: {
            if (R.call(g, "ref") && (W = Object.getOwnPropertyDescriptor(
              g,
              "ref"
            ).get) && W.isReactWarning) {
              W = !1;
              break e;
            }
            W = g.ref !== void 0;
          }
          W && (ee = E()), A(g) && (u(g.key), j = "" + g.key);
          for (ae in g)
            !R.call(g, ae) || ae === "key" || ae === "__self" || ae === "__source" || ae === "ref" && g.ref === void 0 || (P[ae] = g[ae]);
        }
        var ae = arguments.length - 2;
        if (ae === 1) P.children = _;
        else if (1 < ae) {
          W = Array(ae);
          for (var ne = 0; ne < ae; ne++)
            W[ne] = arguments[ne + 2];
          P.children = W;
        }
        for (P = T(
          c.type,
          j,
          P,
          ee,
          c._debugStack,
          c._debugTask
        ), j = 2; j < arguments.length; j++)
          f(arguments[j]);
        return P;
      }, t.createContext = function(c) {
        return c = {
          $$typeof: re,
          _currentValue: c,
          _currentValue2: c,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        }, c.Provider = c, c.Consumer = {
          $$typeof: Y,
          _context: c
        }, c._currentRenderer = null, c._currentRenderer2 = null, c;
      }, t.createElement = function(c, g, _) {
        for (var P = 2; P < arguments.length; P++)
          f(arguments[P]);
        P = {};
        var j = null;
        if (g != null)
          for (ne in D || !("__self" in g) || "key" in g || (D = !0, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), A(g) && (u(g.key), j = "" + g.key), g)
            R.call(g, ne) && ne !== "key" && ne !== "__self" && ne !== "__source" && (P[ne] = g[ne]);
        var ee = arguments.length - 2;
        if (ee === 1) P.children = _;
        else if (1 < ee) {
          for (var W = Array(ee), ae = 0; ae < ee; ae++)
            W[ae] = arguments[ae + 2];
          Object.freeze && Object.freeze(W), P.children = W;
        }
        if (c && c.defaultProps)
          for (ne in ee = c.defaultProps, ee)
            P[ne] === void 0 && (P[ne] = ee[ne]);
        j && S(
          P,
          typeof c == "function" ? c.displayName || c.name || "Unknown" : c
        );
        var ne = 1e4 > Z.recentlyCreatedOwnerStacks++;
        return T(
          c,
          j,
          P,
          E(),
          ne ? Error("react-stack-top-frame") : Ye,
          ne ? U(w(c)) : it
        );
      }, t.createRef = function() {
        var c = { current: null };
        return Object.seal(c), c;
      }, t.forwardRef = function(c) {
        c != null && c.$$typeof === Ee ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : typeof c != "function" ? console.error(
          "forwardRef requires a render function but was given %s.",
          c === null ? "null" : typeof c
        ) : c.length !== 0 && c.length !== 2 && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          c.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        ), c != null && c.defaultProps != null && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var g = { $$typeof: oe, render: c }, _;
        return Object.defineProperty(g, "displayName", {
          enumerable: !1,
          configurable: !0,
          get: function() {
            return _;
          },
          set: function(P) {
            _ = P, c.name || c.displayName || (Object.defineProperty(c, "name", { value: P }), c.displayName = P);
          }
        }), g;
      }, t.isValidElement = y, t.lazy = function(c) {
        c = { _status: -1, _result: c };
        var g = {
          $$typeof: nt,
          _payload: c,
          _init: H
        }, _ = {
          name: "lazy",
          start: -1,
          end: -1,
          value: null,
          owner: null,
          debugStack: Error("react-stack-top-frame"),
          debugTask: console.createTask ? console.createTask("lazy()") : null
        };
        return c._ioInfo = _, g._debugInfo = [{ awaited: _ }], g;
      }, t.memo = function(c, g) {
        c == null && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          c === null ? "null" : typeof c
        ), g = {
          $$typeof: Ee,
          type: c,
          compare: g === void 0 ? null : g
        };
        var _;
        return Object.defineProperty(g, "displayName", {
          enumerable: !1,
          configurable: !0,
          get: function() {
            return _;
          },
          set: function(P) {
            _ = P, c.name || c.displayName || (Object.defineProperty(c, "name", { value: P }), c.displayName = P);
          }
        }), g;
      }, t.startTransition = function(c) {
        var g = Z.T, _ = {};
        _._updatedFibers = /* @__PURE__ */ new Set(), Z.T = _;
        try {
          var P = c(), j = Z.S;
          j !== null && j(_, P), typeof P == "object" && P !== null && typeof P.then == "function" && (Z.asyncTransitions++, P.then(K, K), P.then(l, ke));
        } catch (ee) {
          ke(ee);
        } finally {
          g === null && _._updatedFibers && (c = _._updatedFibers.size, _._updatedFibers.clear(), 10 < c && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), g !== null && _.types !== null && (g.types !== null && g.types !== _.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), g.types = _.types), Z.T = g;
        }
      }, t.unstable_useCacheRefresh = function() {
        return q().useCacheRefresh();
      }, t.use = function(c) {
        return q().use(c);
      }, t.useActionState = function(c, g, _) {
        return q().useActionState(
          c,
          g,
          _
        );
      }, t.useCallback = function(c, g) {
        return q().useCallback(c, g);
      }, t.useContext = function(c) {
        var g = q();
        return c.$$typeof === Y && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        ), g.useContext(c);
      }, t.useDebugValue = function(c, g) {
        return q().useDebugValue(c, g);
      }, t.useDeferredValue = function(c, g) {
        return q().useDeferredValue(c, g);
      }, t.useEffect = function(c, g) {
        return c == null && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        ), q().useEffect(c, g);
      }, t.useEffectEvent = function(c) {
        return q().useEffectEvent(c);
      }, t.useId = function() {
        return q().useId();
      }, t.useImperativeHandle = function(c, g, _) {
        return q().useImperativeHandle(c, g, _);
      }, t.useInsertionEffect = function(c, g) {
        return c == null && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        ), q().useInsertionEffect(c, g);
      }, t.useLayoutEffect = function(c, g) {
        return c == null && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        ), q().useLayoutEffect(c, g);
      }, t.useMemo = function(c, g) {
        return q().useMemo(c, g);
      }, t.useOptimistic = function(c, g) {
        return q().useOptimistic(c, g);
      }, t.useReducer = function(c, g, _) {
        return q().useReducer(c, g, _);
      }, t.useRef = function(c) {
        return q().useRef(c);
      }, t.useState = function(c) {
        return q().useState(c);
      }, t.useSyncExternalStore = function(c, g, _) {
        return q().useSyncExternalStore(
          c,
          g,
          _
        );
      }, t.useTransition = function() {
        return q().useTransition();
      }, t.version = "19.2.0", typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  })(Zt, Zt.exports)), Zt.exports;
}
var Gr;
function ca() {
  return Gr || (Gr = 1, process.env.NODE_ENV === "production" ? yn.exports = oa() : yn.exports = aa()), yn.exports;
}
var la = ca();
const Sn = /* @__PURE__ */ sa(la), da = (e) => e;
function ua(e, t = da) {
  const n = Sn.useSyncExternalStore(
    e.subscribe,
    Sn.useCallback(() => t(e.getState()), [e, t]),
    Sn.useCallback(() => t(e.getInitialState()), [e, t])
  );
  return Sn.useDebugValue(n), n;
}
const Ur = (e) => {
  const t = ia(e), n = (r) => ua(t, r);
  return Object.assign(n, t), n;
}, ma = ((e) => e ? Ur(e) : Ur), pa = (e, t) => {
  for (const [n, r] of Object.entries(t.currencies ?? {}))
    if ((e.inventory.currencies[n] ?? 0) < (r ?? 0)) return !1;
  for (const [n, r] of Object.entries(t.items ?? {}))
    if ((e.inventory.items[n] ?? 0) < r) return !1;
  return !0;
}, jt = (e, t) => {
  if (!pa(e, t)) throw new Error("Insufficient resources");
  for (const [n, r] of Object.entries(t.currencies ?? {})) {
    const i = n;
    e.inventory.currencies[i] -= r ?? 0;
  }
  for (const [n, r] of Object.entries(t.items ?? {}))
    e.inventory.items[n] = Math.max(0, (e.inventory.items[n] ?? 0) - r);
}, Vt = (e, t) => {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("Account XP must be non-negative");
  const n = e.accountProgress.level;
  for (e.accountProgress.xp += Math.floor(t); e.accountProgress.level < 100; ) {
    const r = qt.account(e.accountProgress.level);
    if (e.accountProgress.xp < r) break;
    e.accountProgress.xp -= r, e.accountProgress.level += 1, e.accountProgress.skillPoints += e.accountProgress.level % 3 === 0 ? 1 : 0;
  }
  return e.accountProgress.level - n;
}, Di = (e, t) => {
  for (const [n, r] of Object.entries(t.currencies ?? {})) {
    const i = n;
    e.inventory.currencies[i] += r ?? 0;
  }
  for (const [n, r] of Object.entries(t.items ?? {}))
    e.inventory.items[n] = (e.inventory.items[n] ?? 0) + r;
  t.accountXp && Vt(e, t.accountXp), t.miningXp && (e.mining.xp += t.miningXp);
}, fa = (e, t) => {
  switch (t) {
    case "MINED":
      return e.mining.totalMined;
    case "SPECIES_OWNED":
      return e.collection.discoveredSpeciesIds.length;
    case "FUSIONS":
      return e.statistics.fusionCount;
    case "BATTLE_WINS":
      return e.statistics.battleWins;
    case "GACHA_PULLS":
      return Object.values(e.gacha.pityByBanner).reduce((n, r) => n + r.lifetimePulls, 0);
    case "MAX_AFFINITY":
      return Math.max(0, ...Object.values(e.stones).map((n) => n.affinity.rank));
    case "MUTATIONS":
      return e.statistics.mutationCount;
    case "PERFECT_IV":
      return Object.values(e.stones).filter((n) => On(n.individualValues)).length;
    case "ACCOUNT_LEVEL":
      return e.accountProgress.level;
  }
}, Xt = (e, t = de) => {
  const n = [];
  for (const r of cr) {
    const i = e.achievements[r.id] ?? { value: 0, unlockedAt: null, claimedAt: null };
    i.value = fa(e, r.metric), i.unlockedAt === null && i.value >= r.threshold && (i.unlockedAt = t.now().toISOString(), n.push(r)), e.achievements[r.id] = i;
  }
  return n;
}, ha = (e, t, n = de) => {
  const r = cr.find((s) => s.id === t), i = e.achievements[t];
  if (!r || !i?.unlockedAt) throw new Error("Achievement is not unlocked");
  if (i.claimedAt) throw new Error("Achievement reward already claimed");
  Di(e, r.reward), r.reward.titleId && !e.account.ownedTitleIds.includes(r.reward.titleId) && e.account.ownedTitleIds.push(r.reward.titleId), r.reward.frameId && !e.account.ownedFrameIds.includes(r.reward.frameId) && e.account.ownedFrameIds.push(r.reward.frameId), i.claimedAt = n.now().toISOString();
}, Ea = 5 * 6e4, ga = 720 * 60 * 6e4, Ia = 16384, ya = (e) => {
  if (e === void 0) return;
  if (!e || typeof e != "object" || Array.isArray(e)) throw new Error("Mining metadata must be an object");
  let t;
  try {
    t = JSON.stringify(e);
  } catch {
    throw new Error("Mining metadata must be JSON serializable");
  }
  if ((typeof TextEncoder == "function" ? new TextEncoder().encode(t).byteLength : Sa(t)) > Ia) throw new Error("Mining metadata exceeds the 16 KB limit");
  const r = JSON.parse(t);
  if (!r || typeof r != "object" || Array.isArray(r)) throw new Error("Mining metadata must be a JSON object");
  return r;
}, Sa = (e) => {
  let t = 0;
  for (let n = 0; n < e.length; n += 1) {
    const r = e.codePointAt(n);
    r > 65535 && (n += 1), t += r <= 127 ? 1 : r <= 2047 ? 2 : r <= 65535 ? 3 : 4;
  }
  return t;
}, Zn = (e, t, n = de, r = {}) => {
  if (r.farmSessionActive === !1) return { valid: !1, reason: "Farm session is not active" };
  if (typeof t.eventId != "string" || !t.eventId.trim() || t.eventId.length > 128) return { valid: !1, reason: "Mining eventId must be 1-128 characters" };
  if (t.sessionId !== void 0 && (typeof t.sessionId != "string" || t.sessionId !== e.online.sessionId)) return { valid: !1, reason: "Mining sessionId does not match the active session" };
  if (t.amount !== void 0 && (typeof t.amount != "number" || !Number.isSafeInteger(t.amount))) return { valid: !1, reason: "Mining amount must be an integer" };
  const i = t.amount ?? 1;
  if (i < 1 || i > 100) return { valid: !1, reason: "Mining amount is outside the accepted range" };
  if (t.quality !== void 0 && (typeof t.quality != "number" || !Number.isFinite(t.quality))) return { valid: !1, reason: "Mining quality must be finite" };
  const s = t.quality ?? 0.5;
  if (s < 0 || s > 1) return { valid: !1, reason: "Mining quality must be between 0 and 1" };
  const o = n.now().getTime();
  let a = o;
  if (t.timestamp !== void 0) {
    if (typeof t.timestamp != "string") return { valid: !1, reason: "Mining timestamp must be a string" };
    if (a = Date.parse(t.timestamp), !Number.isFinite(a)) return { valid: !1, reason: "Mining timestamp is invalid" };
    if (a - o > Ea) return { valid: !1, reason: "Mining timestamp is too far in the future" };
    if (o - a > ga) return { valid: !1, reason: "Mining timestamp is too old" };
  }
  try {
    return { valid: !0, amount: i, quality: s, sourceTimestamp: new Date(a).toISOString(), metadata: ya(t.metadata) };
  } catch (l) {
    return { valid: !1, reason: l instanceof Error ? l.message : String(l) };
  }
}, Aa = (e) => {
  for (const t of Kn)
    if (e.mining.level >= t.unlockLevel && !e.mining.unlockedAreas.includes(t.id) && e.mining.unlockedAreas.push(t.id), e.mining.level >= t.unlockLevel)
      for (const n of t.veins) e.mining.unlockedVeins.includes(n) || e.mining.unlockedVeins.push(n);
}, wa = (e, t) => {
  const n = e.mining.level;
  for (e.mining.xp += Math.max(0, Math.floor(t)); e.mining.level < 100; ) {
    const r = qt.mining(e.mining.level);
    if (e.mining.xp < r) break;
    e.mining.xp -= r, e.mining.level += 1;
  }
  return Aa(e), e.mining.level - n;
}, va = (e, t, n) => {
  Object.defineProperty(e.mining.processedFarmEventIds, t.eventId, {
    value: !0,
    enumerable: !0,
    configurable: !0,
    writable: !0
  });
}, Ma = (e, t, n, r = de, i = {}) => {
  const s = Zn(e, t, r, i);
  if (!s.valid)
    return { accepted: !1, duplicate: !1, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 };
  if (Object.prototype.hasOwnProperty.call(e.mining.processedFarmEventIds, t.eventId))
    return { accepted: !1, duplicate: !0, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 };
  const o = s.amount, a = s.quality, l = Kn.find((S) => S.id === t.areaId), d = l && e.mining.unlockedAreas.includes(l.id) ? l : Kn[0];
  if (!d) throw new Error("Mining area configuration is missing");
  const u = [], h = Math.min(0.6, d.discoveryRate + a * 0.08 + e.mining.level * 7e-4), w = r.now();
  for (let S = 0; S < o; S += 1) {
    if (!n.chance(h)) continue;
    const k = n.fork(`${t.eventId}:${S}`), T = k.next() / (d.rarityBias + a * 0.25), p = T < 8e-5 ? "LEGENDARY" : T < 18e-4 ? "UR" : T < 0.013 ? "SSR" : T < 0.09 ? "SR" : T < 0.35 ? "RARE" : "NORMAL";
    u.push({
      discoveryId: tt("discovery", k, w.getTime() + S),
      seed: `${t.eventId}:${e.account.accountId}:${S}:${Math.floor(k.next() * 1e12)}`,
      veinId: t.veinId && e.mining.unlockedVeins.includes(t.veinId) ? t.veinId : d.veins[0],
      areaId: d.id,
      discoveredAt: w.toISOString(),
      hintedRarity: p,
      sourceEventId: t.eventId
    });
  }
  const E = o * (10 + Math.round(a * 8)), m = o * (8 + Math.round(a * 7));
  e.mining.totalMined += o, e.mining.dailyMined += o, e.mining.weeklyMined += o, e.mining.monthlyMined += o, e.mining.lastMinedAt = w.toISOString(), e.unappraisedFinds.push(...u), e.inventory.currencies.credits += m;
  const A = wa(e, E);
  return Vt(e, Math.ceil(E * 0.35)), va(e, t), Xt(e, r), { accepted: !0, duplicate: !1, xpGranted: E, creditsGranted: m, discoveries: u, miningLevelsGained: A };
}, Ra = (e, t, n) => {
  const r = ot[t.hintedRarity];
  let i = Bt.filter((s) => s.naturalWeight > 0 && s.minMiningLevel <= e.mining.level);
  if (t.hintedRarity === "LEGENDARY") {
    const s = i.filter((o) => o.rarity === "LEGENDARY");
    s.length > 0 && (i = s);
  } else {
    const s = i.filter((o) => ot[o.rarity] <= r + 1);
    s.length > 0 && (i = s);
  }
  return i.length === 0 && (i = Bt.filter((s) => s.naturalWeight > 0 && s.minMiningLevel <= 1)), n.weighted(i, (s) => {
    const o = Math.abs(ot[s.rarity] - r);
    return s.naturalWeight / (1 + o * o * 3);
  });
}, hn = (e, t) => {
  const n = !e.collection.discoveredSpeciesIds.includes(t.speciesId);
  n && e.collection.discoveredSpeciesIds.push(t.speciesId);
  const r = e.collection.mutationSpecies[t.speciesId] ?? [];
  r.includes(t.mutation) || r.push(t.mutation), e.collection.mutationSpecies[t.speciesId] = r;
  const i = e.collection.variantSpecies[t.speciesId] ?? [];
  return i.includes(t.colorVariant) || i.push(t.colorVariant), e.collection.variantSpecies[t.speciesId] = i, e.collection.origins[t.origin] = (e.collection.origins[t.origin] ?? 0) + 1, n;
}, ba = (e, t, n = de) => {
  const r = e.unappraisedFinds.findIndex((h) => h.discoveryId === t);
  if (r < 0) throw new Error("Discovery not found or already appraised");
  if (Object.keys(e.stones).length >= e.inventory.capacity) throw new Error("Stone capacity is full");
  const i = e.unappraisedFinds[r], s = new Re(i.seed), o = Ra(e, i, s), a = { accountId: e.account.accountId, username: e.account.username }, l = Ct({ species: o, origin: "NATURAL", owner: a, rng: s, clock: n, appraised: !0 });
  if (e.unappraisedFinds.splice(r, 1), e.stones[l.instanceId]) throw new Error("Stone ID collision");
  e.stones[l.instanceId] = l;
  const d = hn(e, l), u = l.rarity === "LEGENDARY";
  return ot[l.rarity] >= ot.SSR && (e.statistics.rareDiscoveryCount += 1), l.mutation !== "NONE" && (e.statistics.mutationCount += 1), On(l.individualValues) && (e.statistics.mutationCount += l.mutation === "PERFECT" ? 0 : 1), Xt(e, n), { stone: l, isNewSpecies: d, isNaturalLegendary: u };
}, et = ["NORMAL", "RARE", "SR", "SSR", "UR", "LEGENDARY"], Ta = [
  "NATURAL",
  "GACHA",
  "FUSION",
  "EVOLUTION",
  "RAID",
  "DUNGEON",
  "EXPEDITION",
  "EVENT"
], dn = [
  "NEUTRAL",
  "FIRE",
  "WATER",
  "EARTH",
  "WIND",
  "LIGHT",
  "DARK",
  "CRYSTAL",
  "METAL",
  "ANCIENT"
], $i = ["BALANCED", "COMBAT", "MINING", "DISCOVERY", "SAFE", "HIGH_RISK", "EXPERIENCE", "MATERIALS"], Na = (e, t) => ({
  currencies: Object.fromEntries(Object.entries(e.currencies ?? {}).map(([n, r]) => [n, (r ?? 0) * t])),
  items: Object.fromEntries(Object.entries(e.items ?? {}).map(([n, r]) => [n, r * t]))
}), Tn = (e, t) => ot[e] >= ot[t], _a = (e, t) => {
  const n = { ...e.rates }, r = t.pullsSinceSsr + 1;
  if (r >= e.pity.hard) {
    const i = n.SSR + n.UR + n.LEGENDARY;
    return n.NORMAL = 0, n.RARE = 0, n.SR = 0, n.SSR /= i, n.UR /= i, n.LEGENDARY /= i, n;
  }
  if (r > e.pity.softStart) {
    const i = r - e.pity.softStart, s = Math.min(0.75, i * 0.055), o = n.SSR + n.UR + n.LEGENDARY, a = Math.min(0.92, o + s), l = a / o, d = (1 - a) / (1 - o);
    n.SSR *= l, n.UR *= l, n.LEGENDARY *= l, n.NORMAL *= d, n.RARE *= d, n.SR *= d;
  }
  return n;
}, ka = (e, t, n) => {
  const r = et.filter((i) => !n || Tn(i, n));
  return t.weighted(r, (i) => e[i]);
}, Ca = (e, t, n, r) => {
  const i = e.pool.filter((u) => fe[u.speciesId]?.rarity === t), s = i.length > 0 ? i : e.pool.filter((u) => Tn(fe[u.speciesId]?.rarity ?? "NORMAL", t));
  if (s.length === 0) throw new Error(`Banner ${e.id} has no species for ${t}`);
  const o = s.filter((u) => u.pickup), a = n && o.length > 0 ? o : s, l = r.weighted(a, (u) => u.weight * (u.pickup ? 1.5 : 1)), d = fe[l.speciesId];
  if (!d) throw new Error(`Unknown gacha species ${l.speciesId}`);
  return { species: d, featured: !!l.pickup };
}, xa = (e, t, n, r, i = de) => {
  const s = hs[t];
  if (!s) throw new Error(`Unknown gacha banner: ${t}`);
  if (n !== 1 && n !== 10) throw new Error("Gacha supports only one or ten pulls");
  if (Object.keys(e.stones).length + n > e.inventory.capacity)
    throw new Error("Stone capacity is full");
  jt(e, Na(s.singleCost, n));
  const o = e.gacha.pityByBanner[t] ?? {
    pullsSinceSsr: 0,
    lifetimePulls: 0,
    featuredGuaranteed: !1
  }, a = [], l = [];
  let d = !1;
  for (let h = 0; h < n; h += 1) {
    const w = o.pullsSinceSsr, E = o.pullsSinceSsr + 1 >= s.pity.hard, m = n === 10 && h === 9 && !d, A = _a(s, o), S = ka(A, r, m ? s.tenPullGuarantee : void 0);
    Tn(S, s.tenPullGuarantee) && (d = !0);
    const k = Tn(S, "SSR"), T = Ca(s, S, k && o.featuredGuaranteed, r), p = { accountId: e.account.accountId, username: e.account.username }, f = Ct({ species: T.species, rarity: S, origin: "GACHA", owner: p, rng: r, clock: i });
    if (e.stones[f.instanceId]) throw new Error("Stone ID collision");
    e.stones[f.instanceId] = f, hn(e, f), o.lifetimePulls += 1, k ? (o.pullsSinceSsr = 0, s.pity.featuredGuaranteeAfterLoss && (o.featuredGuaranteed = !T.featured)) : o.pullsSinceSsr += 1;
    const y = i.now(), b = {
      id: tt("pull", r, y.getTime() + h),
      bannerId: t,
      stoneId: f.instanceId,
      rarity: S,
      pullNumber: o.lifetimePulls,
      pityBefore: w,
      guaranteed: E || m,
      createdAt: y.toISOString()
    };
    a.push(f), l.push(b), e.gacha.rarityCounts[S] = (e.gacha.rarityCounts[S] ?? 0) + 1;
  }
  e.gacha.pityByBanner[t] = o, e.gacha.history.unshift(...[...l].reverse()), e.gacha.history.length > 1e3 && (e.gacha.history.length = 1e3), Vt(e, 8 * n), Xt(e, i);
  const u = a.reduce((h, w) => ot[w.rarity] > ot[h] ? w.rarity : h, "NORMAL");
  return { stones: a, history: l, highestRarity: u, pityAfter: { ...o } };
}, jn = (e, t) => {
  const n = /* @__PURE__ */ new Map();
  for (const r of e) n.set(r, (n.get(r) ?? 0) + 1);
  for (const r of t) {
    const i = n.get(r) ?? 0;
    if (i <= 0) return !1;
    n.set(r, i - 1);
  }
  return !0;
}, Oa = (e, t, n = []) => {
  if (t.length !== e.parentCount || (e.type === "FIXED" || (e.requiredSpecies?.length ?? 0) > 0) && !jn(t.map((r) => r.speciesId), e.requiredSpecies ?? []))
    return !1;
  if (e.requiredFamilies?.length) {
    const r = t.map((i) => fe[i.speciesId]?.family ?? "unknown");
    if (!jn(r, e.requiredFamilies)) return !1;
  }
  if (e.requiredElements?.length) {
    const r = t.flatMap((i) => [i.primaryElement, ...i.secondaryElement ? [i.secondaryElement] : []]);
    if (!jn(r, e.requiredElements)) return !1;
  }
  return e.hidden && ar.some((i) => i.unlockRecipeId === e.id) ? n.some((i) => ei[i]?.unlockRecipeId === e.id) : !0;
}, La = (e, t, n = []) => ds.filter((r) => r.minimumLabLevel <= t && Oa(r, e, n)).sort((r, i) => {
  const s = { SPECIAL: 5, HIDDEN: 4, FIXED: 3, ELEMENT: 2, FAMILY: 1 };
  return s[i.type] - s[r.type];
}), Da = (e, t) => t.map((n) => {
  const r = ei[n];
  if (!r) throw new Error(`Unknown catalyst: ${n}`);
  if (e.facilities.fusionLab < r.requiredLabLevel) throw new Error(`Fusion lab level ${r.requiredLabLevel} required`);
  if ((e.inventory.items[n] ?? 0) < 1) throw new Error(`Missing catalyst: ${n}`);
  return r;
}), $a = (e, t, n, r) => {
  const s = (t?.resultSpeciesIds ?? [...new Set(e.map((a) => a.speciesId))]).map((a) => fe[a]).filter((a) => !!a);
  if (s.length === 0) throw new Error("Fusion has no valid result species");
  const o = n.find((a) => a.elementBias)?.elementBias;
  return r.weighted(s, (a) => {
    const l = Math.max(0.01, t?.weight ?? a.gachaWeight ?? 1);
    return o && (a.primaryElement === o || a.possibleSecondaryElements.includes(o)) ? l * 4 : l;
  });
}, Pa = (e, t, n) => Object.fromEntries(je.map((r) => {
  const i = e.map((l) => l.individualValues[r]);
  if (t.includes(r)) return [r, Math.max(...i)];
  const s = n.chance(0.72) ? n.pick(i) : n.int(0, 31), o = n.chance(0.08) ? -n.int(1, 3) : 0, a = n.chance(0.1) ? n.int(1, 2) : 0;
  return [r, Math.max(0, Math.min(31, s + o + a))];
})), Fa = (e, t, n, r, i) => {
  const s = [...new Set(e.flatMap((d) => d.traitIds))], o = [...new Set(e.flatMap((d) => d.parents).flatMap((d) => [
    ...d.traitIds ?? [],
    ...d.mutation === "ANCIENT" ? ["trait_ancient_oath"] : [],
    ...d.mutation === "PRISMATIC" ? ["trait_prism_reflex"] : []
  ]))], a = [...new Set(n.filter((d) => s.includes(d)))];
  for (const d of r.shuffle(s)) {
    if (a.length >= i) break;
    !a.includes(d) && r.chance(0.52) && a.push(d);
  }
  let l = !1;
  if (a.length < i && o.length > 0 && r.chance(0.09)) {
    const d = r.pick(o);
    a.includes(d) || (a.push(d), l = !0);
  }
  if (a.length < i && r.chance(0.22)) {
    const d = t.traitPool.filter((u) => !a.includes(u));
    d.length > 0 && a.push(r.pick(d));
  }
  return a.length < i && !a.includes("trait_gene_weaver") && r.chance(0.05) && a.push("trait_gene_weaver"), { traits: a.filter((d) => !!Yt[d]).slice(0, i), grandparentInherited: l };
}, Ba = (e, t, n) => {
  const r = /* @__PURE__ */ new Set([...t.skillPool.map((o) => o.skillId), ...e.flatMap((o) => o.skills.map((a) => a.skillId))]), i = n.shuffle(e.flatMap((o) => o.skills.map((a) => a.skillId))).filter((o, a, l) => l.indexOf(o) === a && r.has(o) && n.chance(0.38)).slice(0, 3), s = t.skillPool[0]?.skillId;
  return s && !i.includes(s) && i.unshift(s), i.slice(0, 6);
}, qa = (e, t, n) => {
  const r = t.reduce((s, o) => s * (o.mutationMultiplier ?? 1), 1), i = e.some((s) => s.mutation !== "NONE") ? 1.7 : 1;
  return n.chance(Math.min(0.25, 0.012 * r * i)) ? n.weighted(["PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], (s) => ({
    NONE: 0,
    PRISMATIC: 55,
    ANCIENT: 27,
    CORRUPTED: 15,
    PERFECT: 3
  })[s]) : "NONE";
}, Ga = (e, t, n, r, i = de) => {
  if (t.length < 2 || t.length > 4 || new Set(t).size !== t.length) throw new Error("Fusion requires 2-4 distinct parents");
  const s = t.map((F) => e.stones[F]).filter((F) => !!F);
  if (s.length !== t.length) throw new Error("One or more parent stones do not exist");
  const o = n.consumeParents ?? !1;
  if (o && s.some((F) => F.locked || F.favorite)) throw new Error("Locked or favorite stones cannot be consumed");
  const a = o ? s.flatMap((F) => Object.values(F.equipment).filter((z) => !!z)) : [], l = /* @__PURE__ */ new Set();
  for (const F of a) {
    if (l.has(F.instanceId) || e.inventory.equipment[F.instanceId] || e.endlessMine.equipment.items.some((z) => z.id === F.instanceId))
      throw new Error("Parent equipment cannot be returned safely because its inventory ID already exists");
    l.add(F.instanceId);
  }
  if (e.endlessMine.equipment.items.length + a.length > e.endlessMine.equipment.capacity)
    throw new Error("Make room in Equipment Storage before consuming an equipped parent");
  if (Object.keys(e.stones).length + 1 - (o ? s.length : 0) > e.inventory.capacity) throw new Error("Stone capacity is full");
  const u = [...new Set(n.catalystIds ?? [])], h = Da(e, u), E = La(s, e.facilities.fusionLab, u)[0] ?? null;
  if (s.length > 2 && !E) throw new Error("A valid recipe is required for multi-stone fusion");
  const m = $a(s, E, h, r), A = h.reduce((F, z) => F + (z.traitLockSlots ?? 0), 0), S = Math.min(Math.max(0, e.facilities.fusionLab >= 3 ? 1 + A : A), 3), k = [...new Set(n.lockedTraitIds ?? [])];
  if (k.length > S) throw new Error("Too many locked traits for the current laboratory");
  const T = new Set(s.flatMap((F) => F.traitIds));
  if (k.some((F) => !T.has(F))) throw new Error("A locked trait is not present on a parent");
  const p = h.flatMap((F) => F.ivLockStats ?? []), f = e.facilities.fusionLab >= 4 ? 2 : 0, y = [.../* @__PURE__ */ new Set([...n.lockedIvStats ?? [], ...p])].slice(0, f);
  if ((n.lockedIvStats?.length ?? 0) > f) throw new Error("IV locking is not unlocked");
  E ? jt(e, E.cost) : jt(e, { currencies: { credits: 750, upgradeDust: 60 } });
  for (const F of u) e.inventory.items[F] = Math.max(0, (e.inventory.items[F] ?? 0) - 1);
  const b = Pa(s, y, r), M = Fa(s, m, k, r, Math.min(4, 1 + Math.floor(e.facilities.fusionLab / 2))), N = Ba(s, m, r), L = qa(s, h, r), G = { accountId: e.account.accountId, username: e.account.username }, H = Ct({
    species: m,
    origin: "FUSION",
    owner: G,
    rng: r,
    clock: i,
    mutation: L,
    forcedIvs: b,
    forcedTraits: M.traits,
    forcedSkills: N,
    personalityId: r.chance(0.78) ? r.pick(s).personalityId : void 0,
    parents: s.map(ys),
    grandparents: s.flatMap((F) => F.parents).slice(0, 8),
    generation: Math.max(...s.map((F) => F.generation)) + 1
  }), q = h.reduce((F, z) => F * (z.shinyMultiplier ?? 1), 1);
  if (H.colorVariant === "STANDARD" && r.chance(Math.min(0.15, 0.012 * q)) && (H.colorVariant = "SHINY"), H.stats = Ke(H), e.stones[H.instanceId]) throw new Error("Stone ID collision");
  if (e.stones[H.instanceId] = H, o) {
    const F = new Set(s.map((z) => z.instanceId));
    for (const z of a)
      if (!rn(e.endlessMine.equipment, Qn(z), { autoSalvage: !1 }).accepted) throw new Error("Parent equipment could not be returned to Equipment Storage");
    for (const z of s) delete e.stones[z.instanceId];
    for (const z of e.parties) z.slots = z.slots.filter((se) => !F.has(se.stoneId));
    e.profile.showcaseStoneIds = e.profile.showcaseStoneIds.filter((z) => !F.has(z)), e.profile.favoriteStoneIds = e.profile.favoriteStoneIds.filter((z) => !F.has(z)), e.profile.totalAffinity = Object.values(e.stones).reduce((z, se) => Math.min(Number.MAX_SAFE_INTEGER, z + se.affinity.points), 0);
  }
  const K = i.now(), ue = {
    id: tt("fusion", r, K.getTime()),
    parentIds: [...t],
    childId: H.instanceId,
    recipeId: E?.id ?? null,
    catalystIds: u,
    inheritedTraits: [...M.traits],
    inheritedSkills: [...N],
    mutation: L,
    consumeParents: o,
    createdAt: K.toISOString()
  };
  return e.fusionHistory.unshift(ue), e.statistics.fusionCount += 1, L !== "NONE" && (e.statistics.mutationCount += 1), hn(e, H), Vt(e, 90 + H.generation * 10), Xt(e, i), { child: H, history: ue, recipe: E, inheritedTraitIds: M.traits, inheritedSkillIds: N, grandparentInherited: M.grandparentInherited };
}, Hr = {
  FIRE: ["EARTH"],
  EARTH: ["WIND"],
  WIND: ["WATER"],
  WATER: ["FIRE"],
  LIGHT: ["DARK"],
  DARK: ["LIGHT"],
  METAL: ["CRYSTAL"],
  CRYSTAL: ["ANCIENT"],
  ANCIENT: ["METAL"]
}, Ua = (e, t) => e === "NEUTRAL" || t === "NEUTRAL" ? 1 : Hr[e]?.includes(t) ? 1.25 : Hr[t]?.includes(e) ? 0.8 : 1, Ha = (e, t) => ({
  currencies: Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(e.currencies ?? {}), ...Object.keys(t.currencies ?? {})])].map((n) => [n, (e.currencies?.[n] ?? 0) + (t.currencies?.[n] ?? 0)])),
  items: Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(e.items ?? {}), ...Object.keys(t.items ?? {})])].map((n) => [n, (e.items?.[n] ?? 0) + (t.items?.[n] ?? 0)])),
  accountXp: (e.accountXp ?? 0) + (t.accountXp ?? 0),
  miningXp: (e.miningXp ?? 0) + (t.miningXp ?? 0),
  stoneXp: (e.stoneXp ?? 0) + (t.stoneXp ?? 0)
}), ja = (e, t) => ({
  unitId: `${t.toLowerCase()}_${e.instanceId}`,
  stoneId: e.instanceId,
  team: t,
  speciesId: e.speciesId,
  name: e.nickname || e.name,
  element: e.primaryElement,
  role: fe[e.speciesId]?.role ?? "ATTACK",
  level: e.level,
  stats: { ...e.stats },
  currentHp: e.stats.maxHp,
  shield: 0,
  ultimate: 0,
  cooldowns: {},
  statuses: [],
  modifiers: [],
  skillIds: e.skills.map((n) => n.skillId),
  traitIds: [...e.traitIds],
  alive: !0
}), Ya = (e, t, n) => {
  const r = e.enemies[t];
  if (!r) throw new Error("Enemy definition missing");
  const i = fe[r.speciesId];
  if (!i) throw new Error(`Unknown enemy species ${r.speciesId}`);
  const s = {
    speciesId: i.id,
    level: r.level,
    individualValues: { hardness: 15, purity: 15, power: 15, defense: 15, speed: 15, resonance: 15 },
    personalityId: "personality_stalwart",
    potential: 45,
    awakeningStage: 0,
    reincarnationCount: 0,
    limitBreak: 0,
    mutation: "NONE",
    traitIds: r.traitIds,
    learnedSkillNodes: []
  }, o = Ke(s), a = Object.fromEntries(Object.entries(o).map(([l, d]) => [l, Math.max(1, Math.round(d * r.statMultiplier))]));
  return {
    unitId: `enemy_${r.id}_${n.int(1e3, 9999)}`,
    stoneId: r.id,
    team: "ENEMY",
    speciesId: i.id,
    name: i.name,
    element: i.primaryElement,
    role: i.role,
    level: r.level,
    stats: a,
    currentHp: a.maxHp,
    shield: 0,
    ultimate: 0,
    cooldowns: {},
    statuses: [],
    modifiers: [],
    skillIds: r.skillIds,
    traitIds: r.traitIds,
    alive: !0
  };
}, ht = (e, t) => {
  let n = e.modifiers.filter((r) => r.stat === t).reduce((r, i) => r * i.multiplier, 1);
  return t === "defense" && e.statuses.some((r) => r.id === "FRACTURE") && (n *= 1 - Math.max(...e.statuses.filter((r) => r.id === "FRACTURE").map((r) => r.potency))), t === "defense" && e.currentHp / e.stats.maxHp <= 0.3 && e.traitIds.includes("trait_last_bastion") && (n *= 1.35), Math.max(1, e.stats[t] * n);
}, Va = (e) => {
  for (const t of e.traitIds)
    for (const n of Yt[t]?.effects ?? [])
      n.trigger !== "BATTLE_START" || !n.stat || n.value === void 0 || e.modifiers.push({ stat: n.stat, multiplier: 1 + n.value, turns: 1, sourceId: t });
}, Xa = (e, t, n, r, i = de) => {
  if (e.activeBattle && e.activeBattle.winner === null) throw new Error("A battle is already active");
  const s = fs[t];
  if (!s) throw new Error(`Unknown dungeon ${t}`);
  if (e.accountProgress.level < s.minAccountLevel) throw new Error("Account level is too low for this dungeon");
  const o = s.stages.find((T) => T.id === n);
  if (!o) throw new Error(`Unknown dungeon stage ${n}`);
  const l = (e.parties.find((T) => T.id === e.activePartyId)?.slots ?? []).map((T) => e.stones[T.stoneId]).filter((T) => !!T).slice(0, 3);
  if (l.length === 0) throw new Error("The active party is empty");
  if (new Set(l.map((T) => T.instanceId)).size !== l.length) throw new Error("Party contains duplicate stones");
  const d = l.map((T) => ja(T, "PLAYER")), u = o.enemies.map((T, p) => Ya(o, p, r));
  for (const T of [...d, ...u]) Va(T);
  const w = !e.dungeonClears[`${t}:${n}`] ? Ha(o.reward, o.firstClearReward) : { ...o.reward }, E = i.now(), m = Object.freeze({
    ...bi(l),
    ...Object.fromEntries(o.enemies.flatMap((T) => T.skillIds).map((T) => Et[T]).filter((T) => !!T).map((T) => [T.id, Mi(T)]))
  }), A = l.map((T, p) => ({
    ...Ri(T),
    id: d[p].unitId
  })), S = u.map((T, p) => ({
    id: T.unitId,
    name: T.name,
    side: "ENEMY",
    role: T.role === "TANK" ? "GUARDIAN" : T.role === "CONTROL" ? "CONTROLLER" : T.role === "SUPPORT" ? "SUPPORT" : "STRIKER",
    family: fe[T.speciesId]?.family,
    element: T.element,
    level: T.level,
    stats: {
      maxHp: T.stats.maxHp,
      attack: T.stats.power,
      defense: T.stats.defense + T.stats.hardness * 0.2,
      speed: T.stats.speed,
      accuracy: 92 + T.stats.purity * 0.1,
      resistance: 82 + T.stats.hardness * 0.12,
      critChance: Math.min(0.5, 0.05 + T.stats.purity / 1200),
      critDamage: 1.5,
      breakPower: 15 + T.stats.resonance * 0.2
    },
    skillIds: T.skillIds,
    initialUltimate: o.enemies.length === 1 ? 35 : 0,
    boss: o.enemies.length === 1 && p === 0 ? {
      weakPoint: s.element,
      weakPointMultiplier: 1.6,
      breakThreshold: 120 + T.level * 2,
      enrageTurn: 14,
      enrageMultiplier: 1.5,
      phases: [
        { id: "resonance-fracture", hpRatio: 0.6, attackMultiplier: 1.12, ultimateGain: 30 },
        { id: "last-stand", hpRatio: 0.28, defenseMultiplier: 1.18, speedMultiplier: 1.1, ultimateGain: 45 }
      ]
    } : void 0
  })), k = {
    battleId: tt("battle", r, E.getTime()),
    mode: "DUNGEON",
    dungeonId: t,
    stageId: n,
    turn: 0,
    units: [...d, ...u],
    actionLog: [],
    winner: null,
    reward: w,
    startedAt: E.toISOString(),
    finishedAt: null,
    advanced: mr({ units: [...A, ...S], skills: m, maxTurns: 100 }),
    controlMode: "MANUAL",
    speed: 1
  };
  return qn(k), k;
}, Pi = (e, t) => e.units.filter((n) => n.team === t.team && n.alive), Wa = (e, t) => e.units.filter((n) => n.team !== t.team && n.alive), Ka = (e, t, n, r) => {
  const i = Pi(e, t), s = Wa(e, t);
  switch (n.target) {
    case "SELF":
      return [t];
    case "ALLY":
      return [i.reduce((o, a) => a.currentHp / a.stats.maxHp < o.currentHp / o.stats.maxHp ? a : o, t)];
    case "ALL_ALLIES":
      return i;
    case "ALL_ENEMIES":
      return s;
    case "ENEMY": {
      const o = s.filter((a) => a.statuses.some((l) => l.id === "TAUNT"));
      return [r.pick(o.length > 0 ? o : s)];
    }
  }
}, za = (e, t, n) => {
  const i = t.skillIds.map((o) => Et[o]).filter((o) => !!o).filter((o) => (t.cooldowns[o.id] ?? 0) <= 0 && (o.ultimateCost <= 0 || t.ultimate >= o.ultimateCost));
  if (i.length === 0) return Et.skill_stone_strike;
  const s = Pi(e, t);
  return n.weighted(i, (o) => {
    const l = s.some((h) => h.currentHp / h.stats.maxHp < 0.55) && o.effects.some((h) => h.type === "HEAL" || h.type === "SHIELD") ? 8 : 1, d = o.ultimateCost > 0 ? 12 : 1, u = t.role === "SUPPORT" && o.tags.includes("support") || t.role === "TANK" && o.tags.includes("tank") ? 2 : 1;
    return Math.max(0.1, (o.priority + 1) * l * d * u);
  });
}, Qa = (e, t, n, r, i) => {
  const s = ht(e, "power"), o = ht(t, "defense"), a = ht(e, "resonance"), l = ht(e, "purity"), d = Math.min(0.42, 0.04 + l / (l + 260) * 0.28 + a / (a + 500) * 0.08), u = i.chance(d), h = 0.92 + i.next() * 0.16, w = Ua(n.element, t.element), E = Math.max(1, s * r * (1.25 + e.level * 6e-3) - o * 0.34);
  let m = Math.max(1, Math.round(E * w * h * (u ? 1.55 : 1)));
  if (t.shield > 0) {
    const A = Math.min(t.shield, m);
    t.shield -= A, m -= A;
  }
  return t.currentHp = Math.max(0, t.currentHp - m), t.ultimate = Math.min(100, t.ultimate + Math.max(6, Math.round(m / Math.max(1, t.stats.maxHp) * 28))), t.currentHp <= 0 && (t.alive = !1), { damage: m, critical: u, defeated: !t.alive };
}, Ja = (e, t, n, r, i, s, o) => {
  for (const a of n)
    if (!(!a.alive && i.type !== "DAMAGE"))
      switch (i.type) {
        case "DAMAGE": {
          const l = Qa(t, a, r, i.power ?? 1, s);
          o.damage += l.damage, o.damageByTarget && (o.damageByTarget[a.unitId] = (o.damageByTarget[a.unitId] ?? 0) + l.damage), o.critical ||= l.critical, l.defeated && o.defeatedIds.push(a.unitId);
          break;
        }
        case "HEAL": {
          const l = Math.min(a.stats.maxHp - a.currentHp, Math.max(1, Math.round(ht(t, "resonance") * (i.power ?? 1) + t.level * 1.5)));
          a.currentHp += l, o.healing += l, o.healingByTarget && (o.healingByTarget[a.unitId] = (o.healingByTarget[a.unitId] ?? 0) + l);
          break;
        }
        case "SHIELD":
          a.shield += Math.max(1, Math.round(ht(t, "resonance") * (i.power ?? 1)));
          break;
        case "BUFF":
        case "DEBUFF": {
          if (!i.stat || i.value === void 0) break;
          a.modifiers.push({ stat: i.stat, multiplier: Math.max(0.1, 1 + i.value), turns: i.duration ?? 1, sourceId: r.id });
          break;
        }
        case "STATUS": {
          if (!i.statusId || !s.chance(i.chance ?? 1)) break;
          a.statuses = a.statuses.filter((l) => l.id !== i.statusId), a.statuses.push({ id: i.statusId, turns: i.duration ?? 1, potency: i.value ?? 0, sourceId: t.unitId }), o.statusesApplied.push(i.statusId);
          break;
        }
        case "ULTIMATE_GAIN":
          a.ultimate = Math.min(100, a.ultimate + (i.value ?? 0));
          break;
      }
}, Za = (e) => {
  for (const t of e.statuses)
    (t.id === "BURN" || t.id === "POISON") && (e.currentHp = Math.max(0, e.currentHp - Math.max(1, Math.round(e.stats.maxHp * t.potency))), e.currentHp === 0 && (e.alive = !1)), t.id === "REGEN" && (e.currentHp = Math.min(e.stats.maxHp, e.currentHp + Math.max(1, Math.round(e.stats.maxHp * t.potency))));
  return e.statuses.some((t) => t.id === "STUN");
}, ec = (e) => {
  e.statuses = e.statuses.map((t) => ({ ...t, turns: t.turns - 1 })).filter((t) => t.turns > 0), e.modifiers = e.modifiers.map((t) => ({ ...t, turns: t.turns - 1 })).filter((t) => t.turns > 0);
}, Yn = (e) => {
  const t = e.units.some((r) => r.team === "PLAYER" && r.alive), n = e.units.some((r) => r.team === "ENEMY" && r.alive);
  return !t && !n ? "DRAW" : t ? n ? e.turn >= 100 ? "DRAW" : null : "PLAYER" : "ENEMY";
}, Fi = (e, t, n = de) => {
  if (e.winner) return [];
  e.turn += 1;
  const r = [], i = e.units.filter((s) => s.alive).sort((s, o) => {
    const a = ht(o, "speed") - ht(s, "speed");
    return Math.abs(a) > 1e-3 ? a : t.next() - 0.5;
  });
  for (const s of i) {
    if (!s.alive || e.winner) continue;
    for (const a of Object.keys(s.cooldowns)) s.cooldowns[a] = Math.max(0, (s.cooldowns[a] ?? 0) - 1);
    const o = Za(s);
    if (!s.alive) {
      e.winner = Yn(e);
      continue;
    }
    if (!o) {
      const a = za(e, s, t), l = Ka(e, s, a, t).filter(Boolean), d = { turn: e.turn, actorId: s.unitId, skillId: a.id, targetIds: l.map((u) => u.unitId), damage: 0, healing: 0, damageByTarget: {}, healingByTarget: {}, critical: !1, statusesApplied: [], defeatedIds: [] };
      a.ultimateCost > 0 ? s.ultimate = Math.max(0, s.ultimate - a.ultimateCost) : s.ultimate = Math.min(100, s.ultimate + 15), a.cooldown > 0 && (s.cooldowns[a.id] = a.cooldown + 1);
      for (const u of a.effects) Ja(e, s, l, a, u, t, d);
      r.push(d), e.actionLog.push(d);
    }
    ec(s), e.winner = Yn(e);
  }
  return e.winner = Yn(e), e.winner && (e.finishedAt = n.now().toISOString()), r;
}, er = (e) => {
  if (e === "BURN") return "BURN";
  if (e === "STUN") return "STUN";
  if (e === "CRACK" || e === "VULNERABLE") return "FRACTURE";
  if (e === "REGENERATION") return "REGEN";
  if (e === "TAUNT") return "TAUNT";
}, jr = (e) => ({
  maxHp: e.stats.maxHp,
  power: e.stats.attack,
  defense: e.stats.defense,
  speed: e.stats.speed,
  hardness: e.stats.resistance,
  purity: e.stats.accuracy,
  resonance: e.stats.breakPower
}), tc = (e, t) => {
  const n = e.units.find((o) => o.unitId === t.id), r = t.side === "PLAYER" ? t.id.replace(/^player_/, "") : t.id, i = n ?? {
    unitId: t.id,
    stoneId: r,
    team: t.side,
    speciesId: r,
    name: t.name,
    element: t.element ?? "NEUTRAL",
    role: t.role === "GUARDIAN" || t.role === "VANGUARD" || t.role === "TANK" ? "TANK" : t.role === "SUPPORT" ? "SUPPORT" : t.role === "CONTROLLER" || t.role === "BREAKER" ? "CONTROL" : "ATTACK",
    level: t.level,
    stats: jr(t),
    currentHp: t.hp,
    shield: t.shield,
    ultimate: t.ultimate,
    cooldowns: {},
    statuses: [],
    modifiers: [],
    skillIds: [...t.skillIds],
    traitIds: [],
    alive: t.alive
  };
  i.stats = jr(t), i.currentHp = t.hp, i.shield = t.shield, i.ultimate = t.ultimate, i.cooldowns = { ...t.cooldowns }, i.alive = t.alive, i.skillIds = [...t.skillIds];
  const s = [
    ...t.statuses.map((o) => ({ id: er(o.kind), turns: o.turns, potency: o.power, sourceId: o.sourceId })),
    ...t.controls.map((o) => ({ id: er(o.kind), turns: o.turns, potency: 1, sourceId: o.sourceId })),
    ...t.dots.map((o) => ({ id: "BURN", turns: o.turns, potency: o.power, sourceId: o.sourceId }))
  ].filter((o) => !!o.id);
  return i.statuses = s.map((o) => ({ ...o, turns: Math.max(1, Math.min(100, o.turns)) })), i.modifiers = t.modifiers.flatMap((o) => {
    const a = o.stat === "attack" ? "power" : o.stat === "resistance" ? "hardness" : o.stat === "accuracy" ? "purity" : o.stat === "breakPower" ? "resonance" : o.stat === "critChance" || o.stat === "critDamage" ? null : o.stat;
    return a ? [{ stat: a, multiplier: Math.max(0.01, 1 + o.value), turns: Math.max(1, Math.min(100, o.turns)), sourceId: o.sourceId }] : [];
  }), i;
}, nc = (e, t) => {
  const n = [...new Set(t.resolutions.map((o) => o.targetId))], r = {}, i = {}, s = /* @__PURE__ */ new Set();
  for (const o of t.resolutions) {
    (o.kind === "DAMAGE" || o.kind === "DOT") && (r[o.targetId] = (r[o.targetId] ?? 0) + o.amount), o.kind === "HEAL" && (i[o.targetId] = (i[o.targetId] ?? 0) + o.amount);
    const a = er(o.status ?? "");
    a && s.add(a);
  }
  return {
    turn: t.turn,
    actorId: t.actorId,
    skillId: t.skillId,
    targetIds: n,
    damage: Object.values(r).reduce((o, a) => o + a, 0),
    healing: Object.values(i).reduce((o, a) => o + a, 0),
    damageByTarget: r,
    healingByTarget: i,
    critical: t.resolutions.some((o) => o.critical),
    statusesApplied: [...s],
    defeatedIds: []
  };
}, qn = (e, t = [], n = de, r) => {
  if (!e.advanced) return;
  const i = e.actionLog.length;
  for (const s of e.advanced.units) {
    const o = tc(e, s), a = e.units.findIndex((l) => l.unitId === o.unitId);
    a >= 0 ? e.units[a] = o : e.units.push(o);
  }
  for (const s of t)
    e.actionLog.push(nc(e, s)), s.counter && e.actionLog.push({
      turn: s.turn,
      actorId: s.counter.actorId,
      skillId: "counter",
      targetIds: [s.counter.targetId],
      damage: s.counter.damage,
      healing: 0,
      damageByTarget: { [s.counter.targetId]: s.counter.damage },
      healingByTarget: {},
      critical: !1,
      statusesApplied: [],
      defeatedIds: []
    });
  for (const s of e.advanced.units.filter((o) => o.alive === !1 && r?.has(o.id))) {
    let o;
    for (let a = e.actionLog.length - 1; a >= i; a -= 1) {
      const l = e.actionLog[a];
      if ((l?.damageByTarget?.[s.id] ?? 0) > 0) {
        o = l;
        break;
      }
    }
    o && !o.defeatedIds.includes(s.id) && o.defeatedIds.push(s.id);
  }
  e.turn = e.advanced.turn, e.winner = e.advanced.outcome, e.winner && !e.finishedAt && (e.finishedAt = n.now().toISOString());
}, vr = (e = "BALANCED") => {
  const t = Gt(e), n = Gt("AGGRESSIVE");
  return (r, i, s) => r.units.find((o) => o.id === i)?.side === "PLAYER" ? t(r, i, s) : n(r, i, s);
}, rc = (e, t, n = de) => {
  if (!e.advanced) return Fi(e, t, n);
  const r = e.actionLog.length, i = e.advanced.log.length, s = new Set(e.advanced.units.filter((o) => o.alive).map((o) => o.id));
  return Dn(e.advanced, { commandProvider: vr() }, t), qn(e, e.advanced.log.slice(i), n, s), e.actionLog.slice(r);
}, ic = (e, t, n, r, i = de) => {
  if (!e.advanced || e.winner) throw new Error("No active advanced dungeon battle");
  const s = pr(e.advanced).find((d) => e.advanced.units.find((u) => u.id === d)?.side === "PLAYER");
  if (!s) throw new Error("No living player actor");
  if (!Ln(e.advanced, s).some((d) => d.id === t)) throw new Error("Selected skill is not usable");
  const o = e.actionLog.length, a = e.advanced.log.length, l = new Set(e.advanced.units.filter((d) => d.alive).map((d) => d.id));
  return Dn(e.advanced, {
    commands: { [s]: { actorId: s, skillId: t, targetIds: n } },
    commandProvider: vr()
  }, r), qn(e, e.advanced.log.slice(a), i, l), e.actionLog.slice(o);
}, sc = (e, t, n = de) => {
  if (e.advanced) {
    const r = e.advanced.log.length, i = new Set(e.advanced.units.filter((s) => s.alive).map((s) => s.id));
    fi(e.advanced, vr(), t), qn(e, e.advanced.log.slice(r), n, i);
  } else for (; !e.winner; ) Fi(e, t, n);
  return e;
}, oc = (e, t, n = de) => {
  if (!t.winner || !t.finishedAt) throw new Error("Battle has not finished");
  if (e.battleHistory.some((o) => o.battleId === t.battleId)) return;
  const r = t.winner === "PLAYER", i = t.winner === "ENEMY";
  r ? e.statistics.battleWins += 1 : i && (e.statistics.battleLosses += 1);
  const s = t.units.filter((o) => o.team === "PLAYER");
  for (const o of s) {
    const a = e.stones[o.stoneId];
    if (!a) continue;
    const l = t.actionLog.filter((u) => u.actorId === o.unitId), d = t.actionLog.filter((u) => u.targetIds.includes(o.unitId)).reduce((u, h) => h.damageByTarget ? u + (h.damageByTarget[o.unitId] ?? 0) : u + h.damage / Math.max(1, h.targetIds.length), 0);
    a.battleStatistics.battles += 1, r ? a.battleStatistics.wins += 1 : i && (a.battleStatistics.losses += 1), a.battleStatistics.damageDealt += l.reduce((u, h) => u + h.damage, 0), a.battleStatistics.damageTaken += d, a.battleStatistics.healingDone += l.reduce((u, h) => u + h.healing, 0), a.battleStatistics.criticalHits += l.filter((u) => u.critical).length, a.battleStatistics.enemiesDefeated += l.reduce((u, h) => u + h.defeatedIds.length, 0), a.battleStatistics.ultimatesUsed += l.filter((u) => (Et[u.skillId]?.ultimateCost ?? 0) > 0).length, si(a, r ? t.reward?.stoneXp ?? 45 : Math.round((t.reward?.stoneXp ?? 30) * 0.35)), xn(a, r ? 18 : 6);
  }
  if (r && t.reward && Di(e, { ...t.reward }), r && t.mode === "DUNGEON" && t.dungeonId && t.stageId) {
    const o = `${t.dungeonId}:${t.stageId}`, a = e.dungeonClears[o];
    e.dungeonClears[o] = a ? { ...a, bestTurns: Math.min(a.bestTurns, t.turn), clearCount: a.clearCount + 1 } : { bestTurns: t.turn, clearCount: 1, firstClearedAt: n.now().toISOString() };
  }
  Vt(e, r ? 25 : 8), e.profile.totalAffinity = Object.values(e.stones).reduce((o, a) => o + a.affinity.points, 0), e.battleHistory.unshift(t), e.battleHistory.length > 100 && (e.battleHistory.length = 100), Xt(e, n);
}, At = (e, t, n, r, i = de, s) => {
  const o = i.now(), a = s ?? tt("evt", r, o.getTime()), l = e.online.queue.find((u) => u.eventId === a);
  if (l) return l;
  if (e.online.processedReceipts.some((u) => u.eventId === a)) throw new Error("Online event was already acknowledged");
  e.online.sequence += 1;
  const d = {
    eventId: a,
    sessionId: e.online.sessionId,
    sequence: e.online.sequence,
    timestamp: o.toISOString(),
    accountId: e.account.accountId,
    kind: t,
    payload: n,
    attempts: 0,
    nextAttemptAt: o.toISOString()
  };
  return e.online.queue.push(d), d;
}, ac = (e, t = de, n = 100) => {
  const r = t.now().getTime();
  return e.online.queue.filter((i) => new Date(i.nextAttemptAt).getTime() <= r).slice(0, Math.max(1, n));
}, Yr = (e, t = de) => {
  e.attempts += 1;
  const n = Math.min(3e5, 1e3 * 2 ** Math.min(8, e.attempts));
  e.nextAttemptAt = new Date(t.now().getTime() + n).toISOString();
}, tr = 6e4, wt = 60 * tr, Mt = 720 * wt, cc = 2880, un = 64, Gn = 32, Bi = 100, qi = 1e9, nr = "::", rr = ":expedition-mutation:", lc = ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], dc = (e) => `${e.itemId}${nr}${e.rarity}${nr}${encodeURIComponent(e.seed)}`, Gi = (e) => {
  const [t, n, r, ...i] = e.split(nr);
  if (!t?.startsWith("equipment_") || !n || !r || i.length > 0 || !mn.includes(n)) return null;
  try {
    const s = decodeURIComponent(r);
    return s ? { itemId: t, rarity: n, seed: s } : null;
  } catch {
    return null;
  }
}, Ui = [
  { id: "duration_15m", label: "15 minutes", durationMs: 15 * tr, yieldMultiplier: 0.25, rareMultiplier: 0.52 },
  { id: "duration_30m", label: "30 minutes", durationMs: 30 * tr, yieldMultiplier: 0.5, rareMultiplier: 0.72 },
  { id: "duration_1h", label: "1 hour", durationMs: wt, yieldMultiplier: 1, rareMultiplier: 1 },
  { id: "duration_3h", label: "3 hours", durationMs: 3 * wt, yieldMultiplier: 2.9, rareMultiplier: 1.8 },
  { id: "duration_4h", label: "4 hours", durationMs: 4 * wt, yieldMultiplier: 3.8, rareMultiplier: 2.08 },
  { id: "duration_6h", label: "6 hours", durationMs: 6 * wt, yieldMultiplier: 5.6, rareMultiplier: 2.55 },
  { id: "duration_12h", label: "12 hours", durationMs: 12 * wt, yieldMultiplier: 10.8, rareMultiplier: 3.65 },
  { id: "duration_24h", label: "24 hours", durationMs: 24 * wt, yieldMultiplier: 20.5, rareMultiplier: 5.2 }
], Hi = [
  {
    id: "region_starter_quarry",
    name: "Starter Quarry",
    requiredGuildLevel: 1,
    enemyTags: ["pebble-swarm", "quarry-slime"],
    enemyPower: 160,
    favoredElements: ["EARTH", "NEUTRAL"],
    baseCreditsPerHour: 105,
    baseDustPerHour: 16,
    baseAccountXpPerHour: 25,
    baseStoneXpPerHour: 58,
    baseAffinityPerHour: 2,
    miningDifficulty: 120,
    materialDropIds: ["material_quarry_ore"],
    materialChance: 0.48,
    rareSpeciesIds: ["species_quartzling"],
    rareDiscoveryChance: 3e-3,
    mutationEncounterChance: 2e-3,
    equipmentDropId: "equipment_quarry_charm",
    equipmentDropChance: 0.012,
    eventChance: 0.05,
    bossChance: 0.01
  },
  {
    id: "region_crystal_cavern",
    name: "Crystal Cavern",
    requiredGuildLevel: 2,
    enemyTags: ["crystal-mite", "resonant-sentinel"],
    enemyPower: 520,
    favoredElements: ["CRYSTAL", "WATER"],
    baseCreditsPerHour: 175,
    baseDustPerHour: 29,
    baseAccountXpPerHour: 42,
    baseStoneXpPerHour: 82,
    baseAffinityPerHour: 3,
    miningDifficulty: 360,
    materialDropIds: ["material_resonant_shard", "material_clear_geode"],
    materialChance: 0.44,
    rareSpeciesIds: ["species_aquamarite", "species_prismara"],
    rareDiscoveryChance: 45e-4,
    mutationEncounterChance: 3e-3,
    equipmentDropId: "equipment_resonance_rune",
    equipmentDropChance: 0.016,
    eventChance: 0.065,
    bossChance: 0.014
  },
  {
    id: "region_volcanic_rift",
    name: "Volcanic Rift",
    requiredGuildLevel: 3,
    enemyTags: ["magma-wyrm", "rift-forged"],
    enemyPower: 900,
    favoredElements: ["FIRE", "EARTH"],
    baseCreditsPerHour: 245,
    baseDustPerHour: 44,
    baseAccountXpPerHour: 58,
    baseStoneXpPerHour: 112,
    baseAffinityPerHour: 4,
    miningDifficulty: 650,
    materialDropIds: ["material_magma_glass", "item_magma_heart"],
    materialChance: 0.4,
    rareSpeciesIds: ["species_emberite", "species_pyroclast"],
    rareDiscoveryChance: 55e-4,
    mutationEncounterChance: 4e-3,
    equipmentDropId: "equipment_caldera_core",
    equipmentDropChance: 0.019,
    eventChance: 0.075,
    bossChance: 0.022
  },
  {
    id: "region_ancient_stratum",
    name: "Ancient Stratum",
    requiredGuildLevel: 4,
    enemyTags: ["fossil-guardian", "first-age-echo"],
    enemyPower: 1420,
    favoredElements: ["ANCIENT", "METAL"],
    baseCreditsPerHour: 330,
    baseDustPerHour: 62,
    baseAccountXpPerHour: 80,
    baseStoneXpPerHour: 148,
    baseAffinityPerHour: 5,
    miningDifficulty: 980,
    materialDropIds: ["material_ancient_tablet", "item_primordial_core"],
    materialChance: 0.35,
    rareSpeciesIds: ["species_ironwarden", "species_worldheart"],
    rareDiscoveryChance: 6e-3,
    mutationEncounterChance: 8e-3,
    equipmentDropId: "equipment_ancestor_relic",
    equipmentDropChance: 0.022,
    eventChance: 0.085,
    bossChance: 0.03
  },
  {
    id: "region_meteor_crater",
    name: "Meteor Crater",
    requiredGuildLevel: 5,
    enemyTags: ["star-spawn", "meteor-colossus"],
    enemyPower: 2080,
    favoredElements: ["LIGHT", "METAL"],
    baseCreditsPerHour: 440,
    baseDustPerHour: 86,
    baseAccountXpPerHour: 108,
    baseStoneXpPerHour: 192,
    baseAffinityPerHour: 6,
    miningDifficulty: 1420,
    materialDropIds: ["material_meteor_alloy", "material_stardust"],
    materialChance: 0.32,
    rareSpeciesIds: ["species_ironwarden", "species_solaris"],
    rareDiscoveryChance: 7e-3,
    mutationEncounterChance: 9e-3,
    equipmentDropId: "equipment_meteor_relic",
    equipmentDropChance: 0.027,
    eventChance: 0.095,
    bossChance: 0.036
  },
  {
    id: "region_abyssal_mine",
    name: "Abyssal Mine",
    requiredGuildLevel: 6,
    enemyTags: ["void-stalker", "abyssal-overseer"],
    enemyPower: 3050,
    favoredElements: ["DARK", "CRYSTAL"],
    baseCreditsPerHour: 585,
    baseDustPerHour: 118,
    baseAccountXpPerHour: 145,
    baseStoneXpPerHour: 255,
    baseAffinityPerHour: 7,
    miningDifficulty: 2050,
    materialDropIds: ["material_void_crystal", "item_eclipse_shard"],
    materialChance: 0.29,
    rareSpeciesIds: ["species_eclipse_geode", "species_prismara"],
    rareDiscoveryChance: 85e-4,
    mutationEncounterChance: 0.014,
    equipmentDropId: "equipment_abyssal_rune",
    equipmentDropChance: 0.031,
    eventChance: 0.11,
    bossChance: 0.044
  },
  {
    id: "region_celestial_fault",
    name: "Celestial Fault",
    requiredGuildLevel: 7,
    enemyTags: ["solar-seraph", "fault-titan"],
    enemyPower: 4250,
    favoredElements: ["LIGHT", "ANCIENT"],
    baseCreditsPerHour: 780,
    baseDustPerHour: 158,
    baseAccountXpPerHour: 192,
    baseStoneXpPerHour: 330,
    baseAffinityPerHour: 9,
    miningDifficulty: 2900,
    materialDropIds: ["material_celestial_fragment", "material_first_light"],
    materialChance: 0.26,
    rareSpeciesIds: ["species_solaris", "species_worldheart"],
    rareDiscoveryChance: 0.011,
    mutationEncounterChance: 0.018,
    equipmentDropId: "equipment_celestial_core",
    equipmentDropChance: 0.038,
    eventChance: 0.13,
    bossChance: 0.055
  }
], Mr = Object.fromEntries(Ui.map((e) => [e.id, e])), Un = Object.fromEntries(Hi.map((e) => [e.id, e])), mn = ["NORMAL", "RARE", "SR", "SSR", "UR", "LEGENDARY"], ji = {
  BALANCED: { id: "BALANCED", battle: 1, mining: 1, xp: 1, material: 1, discovery: 1, reward: 1, winShift: 0, failureRetention: 0.62 },
  COMBAT: { id: "COMBAT", battle: 1.28, mining: 0.82, xp: 1.25, material: 0.82, discovery: 0.78, reward: 1.08, winShift: 0.08, failureRetention: 0.58 },
  MINING: { id: "MINING", battle: 0.9, mining: 1.52, xp: 0.86, material: 1.7, discovery: 1.05, reward: 1.08, winShift: -0.04, failureRetention: 0.68 },
  DISCOVERY: { id: "DISCOVERY", battle: 0.88, mining: 1.08, xp: 0.84, material: 0.92, discovery: 1.9, reward: 1.03, winShift: -0.05, failureRetention: 0.64 },
  SAFE: { id: "SAFE", battle: 1.08, mining: 0.92, xp: 0.88, material: 0.86, discovery: 0.72, reward: 0.76, winShift: 0.17, failureRetention: 0.92 },
  HIGH_RISK: { id: "HIGH_RISK", battle: 0.9, mining: 1.12, xp: 1.3, material: 1.36, discovery: 1.62, reward: 1.62, winShift: -0.16, failureRetention: 0.3 },
  EXPERIENCE: { id: "EXPERIENCE", battle: 1.08, mining: 0.82, xp: 1.55, material: 0.8, discovery: 0.82, reward: 1, winShift: 0, failureRetention: 0.6 },
  MATERIALS: { id: "MATERIALS", battle: 0.92, mining: 1.42, xp: 0.86, material: 1.7, discovery: 0.88, reward: 1.04, winShift: -0.03, failureRetention: 0.66 }
}, Yi = (e) => {
  const t = e.lastIndexOf(rr);
  if (t < 0) return null;
  const n = e.slice(t + rr.length);
  return lc.includes(n) ? n : null;
}, uc = (e, t) => `${e}${rr}${t}`, mc = (e, t, n, r, i = 1) => {
  const s = Un[t], o = Mr[n], a = ji[r];
  if (!s || !o || !a) throw new Error("Cannot roll a mutation for invalid expedition configuration");
  const l = Math.max(0.55, Math.min(2.5, i)), d = Math.min(0.35, 15e-4 + s.mutationEncounterChance * o.rareMultiplier * a.discovery * l), u = new Re(`${e}:mutation-roll:${s.id}:${o.id}:${a.id}`);
  return u.chance(d) ? u.weighted(["PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], (h) => ({
    NONE: 0,
    PRISMATIC: 54,
    ANCIENT: 27,
    CORRUPTED: 16,
    PERFECT: 3
  })[h]) : "NONE";
}, mt = () => ({
  credits: 0,
  upgradeDust: 0,
  researchCores: 0,
  accountXp: 0,
  stoneXpPerMember: 0,
  affinityPerMember: 0,
  items: {},
  rareDiscoveries: []
}), pc = () => ({
  battles: 0,
  wins: 0,
  miningYield: 0,
  rareDiscoveries: 0,
  equipmentDrops: 0,
  bestDropRarity: null
}), pt = (e, t = qi) => !Number.isFinite(e) || e <= 0 ? 0 : Math.min(t, Math.floor(e)), ve = (e, t, n = qi) => Math.min(n, pt(e, n) + pt(t, n)), fc = (e, t) => {
  if (e.rareDiscoveries.length + t.rareDiscoveries.length > Gn)
    throw new Error("Expedition rare-discovery storage capacity invariant exceeded");
  e.credits = ve(e.credits, t.credits), e.upgradeDust = ve(e.upgradeDust, t.upgradeDust), e.researchCores = ve(e.researchCores, t.researchCores), e.accountXp = ve(e.accountXp, t.accountXp), e.stoneXpPerMember = ve(e.stoneXpPerMember, t.stoneXpPerMember), e.affinityPerMember = ve(e.affinityPerMember, t.affinityPerMember);
  for (const [n, r] of Object.entries(t.items)) e.items[n] = ve(e.items[n] ?? 0, r);
  e.rareDiscoveries.push(...t.rareDiscoveries);
}, hc = (e) => ({
  ...e,
  items: { ...e.items },
  rareDiscoveries: e.rareDiscoveries.map((t) => ({ ...t }))
}), Ec = (e) => e.hardness + e.purity + e.power + e.defense + e.speed + e.resonance + e.maxHp / 8, gc = (e) => {
  const t = {}, n = /* @__PURE__ */ new Map();
  for (const r of Object.values(e.equipment)) {
    if (!r) continue;
    const i = r.setId ?? ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"].find((s) => r.definitionId.startsWith(`${s}_`));
    i && n.set(i, (n.get(i) ?? 0) + 1);
    for (const s of r.affixes) {
      const o = e.stats[s.stat], a = s.operation === "PERCENT" ? o * s.value : s.value;
      t[s.stat] = (t[s.stat] ?? 0) + a;
    }
  }
  return (n.get("BASTION") ?? 0) >= 2 && (t.defense = (t.defense ?? 0) + e.stats.defense * 0.12), (n.get("BASTION") ?? 0) >= 4 && (t.maxHp = (t.maxHp ?? 0) + e.stats.maxHp * 0.2), (n.get("RESONANCE") ?? 0) >= 4 && (t.speed = (t.speed ?? 0) + e.stats.speed * 0.15), (n.get("HUNTER") ?? 0) >= 2 && (t.power = (t.power ?? 0) + e.stats.power * 0.1), (n.get("ABYSSAL") ?? 0) >= 2 && (t.resonance = (t.resonance ?? 0) + e.stats.resonance * 0.15), (n.get("ABYSSAL") ?? 0) >= 4 && (t.power = (t.power ?? 0) + e.stats.power * 0.18), t;
}, Ic = (e, t) => {
  const n = e.parties.find((r) => r.id === t);
  if (!n || n.slots.length === 0) throw new Error("Expedition requires a non-empty party");
  return n.slots.map(({ stoneId: r }) => {
    const i = e.stones[r];
    if (!i) throw new Error(`Expedition party stone is missing: ${r}`);
    const s = Object.values(i.equipment).filter((o) => !!o);
    return {
      stoneId: r,
      speciesId: i.speciesId,
      level: i.level,
      rarity: i.rarity,
      primaryElement: i.primaryElement,
      secondaryElement: i.secondaryElement,
      stats: { ...i.stats },
      individualValues: { ...i.individualValues },
      skillIds: i.skills.map((o) => o.skillId),
      traitIds: [...i.traitIds],
      equipment: s.map((o) => ({ ...o, affixes: o.affixes.map((a) => ({ ...a })) })),
      equipmentBonuses: gc(i),
      mutation: i.mutation,
      generation: i.generation,
      lineage: [...i.parents, ...i.grandparents].slice(0, 8).map((o) => ({ ...o, traitIds: [...o.traitIds] })),
      power: Math.floor(Ec(i.stats)),
      affinityRank: i.affinity.rank
    };
  });
}, yc = (e) => Object.values(e.expeditions.runs).filter((t) => t.status !== "CLAIMED").length, Sc = (e, t) => {
  const n = e.expeditions.runs[t];
  if (!n) throw new Error("Expedition not found");
  if (n.status === "CLAIMED") throw new Error("Expedition is already claimed");
  return n.repeat = !1, n;
}, Ac = (e, t, n, r = de) => {
  const i = Un[t.regionId], s = Mr[t.durationId];
  if (!i) throw new Error(`Unknown expedition region: ${t.regionId}`);
  if (!s) throw new Error(`Unknown expedition duration: ${t.durationId}`);
  if (!$i.includes(t.strategy)) throw new Error("Unknown expedition strategy");
  if (e.facilities.expeditionGuild < i.requiredGuildLevel) throw new Error(`Expedition Guild level ${i.requiredGuildLevel} required`);
  const o = Math.min(4, 1 + Math.floor((e.facilities.expeditionGuild - 1) / 2));
  if (yc(e) >= o) throw new Error("All expedition slots are occupied");
  const a = t.partyId ?? e.activePartyId, l = Ic(e, a), d = /* @__PURE__ */ new Set([
    ...e.training.assignment ? [e.training.assignment.stoneId] : [],
    ...e.affinityGarden.assignment ? [e.affinityGarden.assignment.stoneId] : [],
    ...e.endlessMine.status === "RUNNING" || e.endlessMine.status === "PAUSED" ? e.endlessMine.partyStoneIds : [],
    ...e.activeBattle && !e.activeBattle.winner ? e.activeBattle.units.filter((S) => S.team === "PLAYER").map((S) => S.stoneId) : []
  ]);
  if (l.some((S) => d.has(S.stoneId))) throw new Error("A party stone is assigned to another background activity");
  const u = new Set(Object.values(e.expeditions.runs).filter((S) => S.status !== "CLAIMED").flatMap((S) => S.partySnapshot.map((k) => k.stoneId)));
  if (l.some((S) => u.has(S.stoneId))) throw new Error("A party stone is already on expedition");
  const h = r.now();
  if (!Number.isFinite(h.getTime())) throw new Error("Expedition clock returned an invalid date");
  const w = tt("expedition", n, h.getTime()), E = `${w}:${Math.floor(n.next() * 4294967296).toString(16)}`, m = {
    expeditionId: w,
    regionId: i.id,
    durationId: s.id,
    durationMs: s.durationMs,
    strategy: t.strategy,
    partyId: a,
    partySnapshot: l,
    seed: E,
    repeat: !!t.repeat,
    status: "ACTIVE",
    startedAt: h.toISOString(),
    lastSimulatedAt: h.toISOString(),
    nextCompletionAt: new Date(h.getTime() + s.durationMs).toISOString(),
    completedCycles: 0,
    claimedCycles: 0,
    claimCount: 0,
    expeditionStorage: mt(),
    reportEvents: [{
      reportId: `${w}:departure`,
      expeditionId: w,
      cycle: 0,
      completedAt: h.toISOString(),
      offsetMs: 0,
      kind: "DEPARTURE",
      title: `Departed for ${i.name}`,
      detail: `${l.length} stones began a ${s.label} expedition.`,
      successScore: 0,
      battleWon: null,
      miningYield: 0,
      equipmentDropId: null,
      equipmentDropSeed: null,
      bestDropRarity: null,
      rareDiscoveryCount: 0,
      reward: { credits: 0, upgradeDust: 0, researchCores: 0, accountXp: 0, stoneXpPerMember: 0, affinityPerMember: 0, items: {} }
    }],
    reportSummary: pc(),
    lastClaimedAt: null
  };
  e.expeditions.runs[w] = m, e.expeditions.order.unshift(w), e.expeditions.order = e.expeditions.order.slice(0, 100);
  const A = new Set(e.expeditions.order);
  for (const [S, k] of Object.entries(e.expeditions.runs)) !A.has(S) && k.status === "CLAIMED" && delete e.expeditions.runs[S];
  return m;
}, Nt = () => ({ combat: 0, mining: 0, exploration: 0, research: 0 }), ie = (e, t, n = 1) => {
  e.combat += t.combat * n, e.mining += t.mining * n, e.exploration += t.exploration * n, e.research += t.research * n;
}, Rr = {
  hardness: { combat: 0.18, mining: 1.35, exploration: 0.2, research: 0.08 },
  purity: { combat: 0.08, mining: 0.92, exploration: 0.84, research: 0.78 },
  power: { combat: 1.3, mining: 0.16, exploration: 0.1, research: 0.06 },
  defense: { combat: 1, mining: 0.32, exploration: 0.36, research: 0.05 },
  speed: { combat: 0.7, mining: 0.14, exploration: 0.78, research: 0.2 },
  resonance: { combat: 0.42, mining: 0.72, exploration: 1.08, research: 1.4 },
  maxHp: { combat: 0.14, mining: 0.018, exploration: 0.035, research: 0.01 }
}, Nn = {
  NEUTRAL: { combat: 3, mining: 3, exploration: 3, research: 3 },
  FIRE: { combat: 13, mining: 5, exploration: 2, research: 2 },
  WATER: { combat: 5, mining: 4, exploration: 11, research: 5 },
  EARTH: { combat: 7, mining: 14, exploration: 5, research: 2 },
  WIND: { combat: 6, mining: 2, exploration: 14, research: 4 },
  LIGHT: { combat: 7, mining: 2, exploration: 8, research: 10 },
  DARK: { combat: 12, mining: 4, exploration: 8, research: 5 },
  CRYSTAL: { combat: 5, mining: 8, exploration: 9, research: 14 },
  METAL: { combat: 9, mining: 13, exploration: 3, research: 4 },
  ANCIENT: { combat: 8, mining: 7, exploration: 8, research: 15 }
}, wc = {
  ATTACK: { combat: 15, mining: 3, exploration: 2, research: 1 },
  TANK: { combat: 11, mining: 9, exploration: 5, research: 1 },
  SUPPORT: { combat: 6, mining: 4, exploration: 9, research: 12 },
  CONTROL: { combat: 9, mining: 2, exploration: 12, research: 7 }
}, Vi = {
  NONE: Nt(),
  PRISMATIC: { combat: 9, mining: 4, exploration: 17, research: 15 },
  ANCIENT: { combat: 11, mining: 13, exploration: 8, research: 17 },
  CORRUPTED: { combat: 18, mining: 11, exploration: 5, research: 4 },
  PERFECT: { combat: 25, mining: 25, exploration: 25, research: 25 }
}, Xi = (e, t, n = 1) => {
  for (const r of t) {
    const i = {
      attack: { combat: 8, mining: 1, exploration: 1, research: 0.5 },
      basic: { combat: 3, mining: 2, exploration: 2, research: 1 },
      tank: { combat: 7, mining: 5, exploration: 4, research: 0.5 },
      support: { combat: 4, mining: 2, exploration: 7, research: 8 },
      control: { combat: 6, mining: 1, exploration: 9, research: 5 },
      speed: { combat: 3, mining: 1, exploration: 8, research: 2 },
      critical: { combat: 7, mining: 1, exploration: 4, research: 4 },
      element: { combat: 3, mining: 2, exploration: 4, research: 5 },
      fire: { combat: 6, mining: 3, exploration: 0.5, research: 0.5 },
      natural: { combat: 1, mining: 8, exploration: 7, research: 2 },
      fusion: { combat: 4, mining: 1, exploration: 2, research: 8 },
      ancient: { combat: 4, mining: 5, exploration: 4, research: 9 },
      mutation: { combat: 3, mining: 3, exploration: 8, research: 7 },
      rare: { combat: 2, mining: 1, exploration: 3, research: 5 },
      legendary: { combat: 5, mining: 3, exploration: 5, research: 8 },
      ultimate: { combat: 6, mining: 1, exploration: 2, research: 4 }
    }[r] ?? null;
    i && ie(e, i, n);
  }
}, vc = (e, t) => {
  const n = Nt(), r = Et[e];
  if (!r) return n;
  const i = r.target === "ALL_ENEMIES" || r.target === "ALL_ALLIES" ? 1.22 : r.target === "SELF" ? 0.88 : 1, s = r.ultimateCost > 0 ? 0.82 : 1 / (1 + r.cooldown * 0.08);
  for (const o of r.effects) {
    const a = Math.max(0, o.power ?? 0) * i * s;
    switch (o.type) {
      case "DAMAGE":
        ie(n, { combat: 29, mining: 2.5, exploration: 2, research: 0.8 }, a);
        break;
      case "HEAL":
        ie(n, { combat: 13, mining: 1, exploration: 18, research: 5 }, a);
        break;
      case "SHIELD":
        ie(n, { combat: 17, mining: 3, exploration: 15, research: 2 }, a);
        break;
      case "BUFF":
      case "DEBUFF": {
        const l = o.stat ? Rr[o.stat] : null;
        l && ie(n, l, Math.abs(o.value ?? 0) * 58 * i * s);
        break;
      }
      case "STATUS":
        ie(n, { combat: 8, mining: 0.5, exploration: 8, research: 4 }, (o.chance ?? 1) * i * s);
        break;
      case "ULTIMATE_GAIN":
        ie(n, { combat: 3, mining: 0.5, exploration: 2, research: 5 }, Math.max(0, o.value ?? 0) / 8);
        break;
    }
  }
  return Xi(n, r.tags, s), ie(n, Nn[r.element], t.favoredElements.includes(r.element) ? 1.35 : 0.72), n.research += Math.max(0, r.priority) * 0.8 + r.effects.length * 1.2, n;
}, Wi = (e, t, n) => {
  const r = Nt();
  for (const i of e) {
    const s = Yt[i];
    if (!s) continue;
    const o = s.tier === "COMMON" ? 1 : s.tier === "RARE" ? 1.2 : 1.38, a = { ALWAYS: 1, BATTLE_START: 0.88, LOW_HP: 0.48, ON_HIT: 0.74, ON_CRIT: 0.42, TURN_START: 0.82 };
    for (const l of s.effects) {
      if (!l.stat) continue;
      const d = Math.sqrt(Math.max(1, t[l.stat])), u = l.operation === "PERCENT" ? d * Math.abs(l.value ?? 0) * 6 : Math.log2(1 + Math.abs(l.value ?? 0)), h = l.element ? n.favoredElements.includes(l.element) ? 1.35 : 0.72 : 1;
      ie(r, Rr[l.stat], u * a[l.trigger] * h * o);
    }
    Xi(r, s.tags, o), r.research += s.effects.length * o;
  }
  return r;
}, Mc = (e) => {
  const t = Nt(), n = /* @__PURE__ */ new Map(), r = { NORMAL: 1, RARE: 1.25, SR: 1.55, SSR: 1.9, UR: 2.3, LEGENDARY: 2.8 }, i = {
    CORE: { combat: 7, mining: 3, exploration: 2, research: 5 },
    RUNE: { combat: 3, mining: 3, exploration: 6, research: 9 },
    RELIC: { combat: 4, mining: 8, exploration: 6, research: 4 },
    CHARM: { combat: 2, mining: 5, exploration: 9, research: 5 }
  };
  for (const o of e.equipment) {
    const a = o.setId ?? ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"].find((u) => o.definitionId.startsWith(`${u}_`)) ?? null;
    a && n.set(a, (n.get(a) ?? 0) + 1);
    const l = r[o.rarity] * (1 + Math.max(0, o.level - 1) * 0.025);
    ie(t, i[o.slot] ?? Nt(), l);
    for (const u of o.affixes) {
      const h = u.operation === "PERCENT" ? Math.abs(u.value) * 48 : Math.log2(1 + Math.abs(u.value)) * 0.8;
      ie(t, Rr[u.stat], h);
      const w = u.sourceStat;
      w === "accuracy" ? ie(t, { combat: 3, mining: 0, exploration: 7, research: 1 }, h) : w === "resistance" ? ie(t, { combat: 4, mining: 1, exploration: 6, research: 2 }, h) : w === "critChance" || w === "critDamage" ? ie(t, { combat: 8, mining: 0, exploration: 2, research: 1 }, h) : w === "breakPower" && ie(t, { combat: 5, mining: 8, exploration: 1, research: 0 }, h);
    }
    const d = o.definitionId.toLowerCase();
    d.includes("quarry") && ie(t, { combat: 0, mining: 7, exploration: 3, research: 1 }, l), (d.includes("resonance") || d.includes("rune")) && ie(t, { combat: 1, mining: 2, exploration: 4, research: 7 }, l), d.includes("caldera") && ie(t, { combat: 7, mining: 5, exploration: 1, research: 0 }, l), d.includes("ancestor") && ie(t, { combat: 2, mining: 4, exploration: 4, research: 8 }, l), d.includes("meteor") && ie(t, { combat: 3, mining: 6, exploration: 7, research: 2 }, l), d.includes("abyss") && ie(t, { combat: 6, mining: 2, exploration: 7, research: 4 }, l), d.includes("celestial") && ie(t, { combat: 4, mining: 2, exploration: 7, research: 8 }, l);
  }
  const s = {
    BASTION: { combat: 8, mining: 5, exploration: 4, research: 1 },
    RESONANCE: { combat: 3, mining: 4, exploration: 7, research: 10 },
    HUNTER: { combat: 10, mining: 6, exploration: 3, research: 1 },
    ABYSSAL: { combat: 9, mining: 3, exploration: 8, research: 6 }
  };
  for (const [o, a] of n) {
    const l = s[o];
    l && ie(t, l, a + (a >= 2 ? 1.5 : 0) + (a >= 4 ? 2.5 : 0));
  }
  return t;
}, Rc = (e, t, n) => {
  const r = Nt();
  return e.lineage.forEach((i, s) => {
    const o = fe[i.speciesId];
    if (!o) return;
    const a = 0.72 / (1 + s * 0.18);
    ie(r, wc[o.role], a), ie(r, Nn[o.primaryElement], a * (n.favoredElements.includes(o.primaryElement) ? 1.25 : 0.58)), ie(r, Wi(i.traitIds, t, n), a * 0.42), ie(r, Vi[i.mutation], a * 0.55);
  }), r;
}, bc = (e, t) => {
  const n = { combat: 0, mining: 0, exploration: 0, research: 0, elementMatches: 0 };
  for (const r of e) {
    const i = Object.fromEntries(Object.entries(r.stats).map(([d, u]) => [d, u + (r.equipmentBonuses[d] ?? 0)])), s = Object.values(r.individualValues).reduce((d, u) => d + u, 0) / 186, o = Math.min(8, r.lineage.length) * 0.015 + Math.min(10, r.generation) * 0.012, a = t.favoredElements.includes(r.primaryElement) || r.secondaryElement !== null && t.favoredElements.includes(r.secondaryElement);
    a && (n.elementMatches += 1), n.combat += i.power * 1.25 + i.defense + i.speed * 0.72 + i.maxHp * 0.14 + r.affinityRank * 12 + s * 80 + o * 100 + (a ? 72 : 0), n.mining += i.hardness * 1.2 + i.purity + i.resonance * 0.9 + r.level * 2.2 + s * 32, n.exploration += i.purity * 0.9 + i.resonance * 1.25 + i.speed * 0.4 + r.affinityRank * 15 + o * 75 + (a ? 28 : 0), n.research += i.resonance * 1.18 + i.purity * 0.76 + i.speed * 0.18 + r.level * 1.35 + r.affinityRank * 9 + s * 42 + o * 82;
    const l = Nt();
    for (const d of r.skillIds) ie(l, vc(d, t));
    ie(l, Wi(r.traitIds, i, t)), ie(l, Mc(r)), ie(l, Rc(r, i, t)), ie(l, Vi[r.mutation]), ie(l, Nn[r.primaryElement], a ? 1.4 : 0.52), r.secondaryElement && ie(l, Nn[r.secondaryElement], t.favoredElements.includes(r.secondaryElement) ? 0.8 : 0.32), n.combat += l.combat, n.mining += l.mining, n.exploration += l.exploration, n.research += l.research;
  }
  return {
    combat: Math.round(n.combat * 1e6) / 1e6,
    mining: Math.round(n.mining * 1e6) / 1e6,
    exploration: Math.round(n.exploration * 1e6) / 1e6,
    research: Math.round(n.research * 1e6) / 1e6,
    elementMatches: n.elementMatches
  };
}, Ki = (e, t) => e === null ? t : t === null ? e : mn.indexOf(t) > mn.indexOf(e) ? t : e, vt = (e) => ({
  credits: e.credits,
  upgradeDust: e.upgradeDust,
  researchCores: e.researchCores,
  accountXp: e.accountXp,
  stoneXpPerMember: e.stoneXpPerMember,
  affinityPerMember: e.affinityPerMember,
  items: { ...e.items }
}), Tc = (e, t, n, r = !1) => {
  const i = Un[e.regionId], s = Mr[e.durationId];
  if (!i || !s || e.durationMs !== s.durationMs) throw new Error("Expedition references invalid configuration");
  const o = new Re(`${e.seed}:cycle:${t}`), a = bc(e.partySnapshot, i), l = ji[e.strategy], d = a.combat * l.battle / Math.max(1, i.enemyPower), u = Math.max(0.3, Math.min(2.5, a.mining * l.mining / Math.max(1, i.miningDifficulty))), h = Math.max(0.3, Math.min(2.5, a.exploration / Math.max(100, i.miningDifficulty * 0.48))), w = Math.max(0.3, Math.min(2.5, a.research / Math.max(100, i.miningDifficulty * 0.42))), E = Math.max(0.08, Math.min(0.995, 0.42 + Math.log2(Math.max(0.25, d)) * 0.18 + a.elementMatches * 0.035 + l.winShift)), m = o.chance(Math.min(0.8, i.bossChance * s.rareMultiplier)), A = o.chance(Math.max(0.08, E - (m ? 0.16 : 0))), S = Math.max(0.22, Math.min(1.65, 0.72 + d * 0.2 + (A ? 0.24 : -0.12))) * (A ? 1 : l.failureRetention), k = 0.88 + o.next() * 0.24, T = s.yieldMultiplier * S * k * l.reward, p = pt(10 * s.yieldMultiplier * u * l.material, 1e6), f = mt();
  f.credits = pt(i.baseCreditsPerHour * T * (0.86 + h * 0.14)), f.upgradeDust = pt(i.baseDustPerHour * T * l.material * (0.78 + u * 0.22)), f.accountXp = pt(i.baseAccountXpPerHour * T * l.xp * (0.78 + w * 0.22)), f.stoneXpPerMember = pt(i.baseStoneXpPerHour * T * l.xp * (0.88 + (d + w) * 0.06)), f.affinityPerMember = pt(i.baseAffinityPerHour * s.yieldMultiplier * (e.strategy === "BALANCED" ? 1.15 : 1) * (0.82 + h * 0.1 + w * 0.08)), (r || o.chance(Math.min(0.72, (0.012 + i.requiredGuildLevel * 0.011) * s.rareMultiplier * (0.72 + w * 0.28)))) && (f.researchCores = 1);
  const y = Math.min(0.96, i.materialChance * s.rareMultiplier * l.material * (0.82 + u * 0.18));
  o.chance(y) && (f.items[o.pick(i.materialDropIds)] = Math.max(1, Math.floor(Math.sqrt(s.yieldMultiplier) * u)));
  const b = o.chance(Math.min(0.55, i.equipmentDropChance * s.rareMultiplier * l.material * (0.84 + h * 0.16))), M = b ? i.requiredGuildLevel >= 6 ? "UR" : i.requiredGuildLevel >= 4 ? "SSR" : "SR" : null, N = b ? `${e.seed}:equipment:${t}` : null;
  b && M && N && (f.items[dc({ itemId: i.equipmentDropId, rarity: M, seed: N })] = 1);
  let L = o.chance(Math.min(0.5, i.mutationEncounterChance * s.rareMultiplier * l.discovery * (0.8 + h * 0.2)));
  L && (f.items.material_mutation_trace = 1);
  const G = o.chance(Math.min(0.8, i.eventChance * s.rareMultiplier * (0.78 + h * 0.22)));
  G && (f.credits = ve(f.credits, Math.floor(i.baseCreditsPerHour * 0.35 * s.yieldMultiplier)));
  const H = Math.min(0.35, i.rareDiscoveryChance * s.rareMultiplier * l.discovery * h * (A ? 1 : 0.55));
  if (o.chance(H)) {
    const se = o.pick(i.rareSpeciesIds), _e = fe[se];
    if (_e) {
      const Ne = `${e.seed}:discovery:${t}`, Le = mc(Ne, i.id, s.id, e.strategy, h), I = uc(Ne, Le);
      Le !== "NONE" && (L = !0, f.items.material_mutation_trace = Math.max(1, f.items.material_mutation_trace ?? 0)), f.rareDiscoveries.push({
        discoveryId: `${e.expeditionId}:discovery:${t}`,
        seed: I,
        speciesId: se,
        veinId: `${i.id}:rare`,
        areaId: i.id,
        hintedRarity: _e.rarity,
        sourceEventId: `${e.expeditionId}:cycle:${t}`,
        discoveredAt: new Date(n).toISOString()
      });
    }
  }
  const q = new Date(n).toISOString(), K = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, n - Date.parse(e.startedAt))), ue = Math.round(E * 1e3) / 10, F = [{
    reportId: `${e.expeditionId}:${t}:${m ? "boss" : "battle"}`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: K,
    kind: m ? "BOSS" : "BATTLE",
    title: m ? `Boss encounter: ${i.enemyTags.at(-1)}` : `Battle in ${i.name}`,
    detail: A ? "The expedition party secured the route." : "The party withdrew safely and preserved part of the haul.",
    successScore: ue,
    battleWon: A,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: null,
    rareDiscoveryCount: 0,
    reward: vt(mt())
  }, {
    reportId: `${e.expeditionId}:${t}:mining`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: K,
    kind: "MINING",
    title: `Surveyed ${i.name}`,
    detail: `Recovered ${p} units from ${i.miningDifficulty} difficulty strata.`,
    successScore: ue,
    battleWon: null,
    miningYield: p,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: null,
    rareDiscoveryCount: 0,
    reward: vt(f)
  }];
  b && F.push({
    reportId: `${e.expeditionId}:${t}:equipment`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: K,
    kind: "EQUIPMENT",
    title: "Equipment cache recovered",
    detail: i.equipmentDropId,
    successScore: ue,
    battleWon: null,
    miningYield: 0,
    equipmentDropId: i.equipmentDropId,
    equipmentDropSeed: N,
    bestDropRarity: M,
    rareDiscoveryCount: 0,
    reward: vt(mt())
  });
  const z = Object.keys(f.items).filter((se) => !Gi(se) && se !== i.equipmentDropId && se !== "material_mutation_trace");
  return z.length > 0 && F.push({
    reportId: `${e.expeditionId}:${t}:material`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: K,
    kind: "MATERIAL",
    title: "Material cache secured",
    detail: z.join(", "),
    successScore: ue,
    battleWon: null,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: "RARE",
    rareDiscoveryCount: 0,
    reward: vt(mt())
  }), f.rareDiscoveries.length > 0 && F.push({
    reportId: `${e.expeditionId}:${t}:discovery`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: K,
    kind: "DISCOVERY",
    title: "Rare resonance detected",
    detail: f.rareDiscoveries.map((se) => se.speciesId).join(", "),
    successScore: ue,
    battleWon: null,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: f.rareDiscoveries[0]?.hintedRarity ?? null,
    rareDiscoveryCount: f.rareDiscoveries.length,
    reward: vt(mt())
  }), (G || L) && F.push({
    reportId: `${e.expeditionId}:${t}:event`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: K,
    kind: "EVENT",
    title: L ? "Mutation trace recorded" : "Field event resolved",
    detail: L ? "The team archived an unstable geological signature." : "A local anomaly yielded bonus resources.",
    successScore: ue,
    battleWon: null,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: L ? "SSR" : null,
    rareDiscoveryCount: 0,
    reward: vt(mt())
  }), {
    reward: f,
    events: F,
    summary: { battles: 1, wins: A ? 1 : 0, miningYield: p, rareDiscoveries: f.rareDiscoveries.length, equipmentDrops: b ? 1 : 0, bestDropRarity: Ki(M, f.rareDiscoveries[0]?.hintedRarity ?? null) }
  };
}, Vr = (e, t) => {
  e.reportEvents.push(...t), e.reportEvents.length > un && e.reportEvents.splice(0, e.reportEvents.length - un);
}, Nc = (e, t) => {
  const n = t.getTime();
  if (!Number.isFinite(n)) throw new Error("Expedition clock returned an invalid date");
  let r = 0, i = !1;
  const s = [];
  for (const o of e.expeditions.order) {
    const a = e.expeditions.runs[o];
    if (!a || a.status !== "ACTIVE") continue;
    const l = Date.parse(a.nextCompletionAt), d = Date.parse(a.lastSimulatedAt);
    if (!Number.isFinite(l) || !Number.isFinite(d)) throw new Error("Expedition contains an invalid timestamp");
    if (n < d || n < l) continue;
    const u = Math.floor((n - l) / a.durationMs) + 1, h = Math.max(1, Math.floor(Mt / a.durationMs)), w = Math.min(cc, h), E = a.repeat ? Math.min(u, w) : 1, m = Math.min(E, Number.MAX_SAFE_INTEGER - a.completedCycles), A = a.repeat && u > m;
    if (i ||= A, a.completedCycles >= Number.MAX_SAFE_INTEGER) {
      i = !0, a.lastSimulatedAt = t.toISOString(), a.nextCompletionAt = new Date(n + a.durationMs).toISOString();
      continue;
    }
    let S = 0, k = !1;
    e: for (let T = 0; T < m; T += 128) {
      const p = Math.min(m, T + 128);
      for (let f = T; f < p; f += 1) {
        const y = a.completedCycles + 1, b = l + f * a.durationMs, M = Un[a.regionId]?.requiredGuildLevel === 1 && e.inventory.currencies.researchCores === 0 && e.research.slot === null && e.research.completedProjectIds.length === 0 && !Object.values(e.expeditions.runs).some((L) => L.expeditionStorage.researchCores > 0), N = Tc(a, y, b, M);
        if (a.expeditionStorage.rareDiscoveries.length + N.reward.rareDiscoveries.length > Gn) {
          k = !0, i = !0;
          break e;
        }
        fc(a.expeditionStorage, N.reward), Vr(a, N.events), s.push(...N.events), s.length > un && s.splice(0, s.length - un), a.completedCycles = ve(a.completedCycles, 1, Number.MAX_SAFE_INTEGER), a.reportSummary.battles = ve(a.reportSummary.battles, N.summary.battles, Number.MAX_SAFE_INTEGER), a.reportSummary.wins = ve(a.reportSummary.wins, N.summary.wins, Number.MAX_SAFE_INTEGER), a.reportSummary.miningYield = ve(a.reportSummary.miningYield, N.summary.miningYield, Number.MAX_SAFE_INTEGER), a.reportSummary.rareDiscoveries = ve(a.reportSummary.rareDiscoveries, N.summary.rareDiscoveries, Number.MAX_SAFE_INTEGER), a.reportSummary.equipmentDrops = ve(a.reportSummary.equipmentDrops, N.summary.equipmentDrops, Number.MAX_SAFE_INTEGER), a.reportSummary.bestDropRarity = Ki(a.reportSummary.bestDropRarity, N.summary.bestDropRarity), e.expeditions.totalCycles = ve(e.expeditions.totalCycles, 1, Number.MAX_SAFE_INTEGER), r += 1, S += 1;
      }
    }
    if (k ? (S > 0 && (a.lastSimulatedAt = new Date(l + (S - 1) * a.durationMs).toISOString()), a.nextCompletionAt = new Date(l + S * a.durationMs).toISOString()) : a.lastSimulatedAt = t.toISOString(), a.repeat && !k) a.nextCompletionAt = new Date(A ? n + a.durationMs : l + m * a.durationMs).toISOString();
    else {
      if (k) continue;
      a.status = "READY", Vr(a, [{
        reportId: `${a.expeditionId}:return`,
        expeditionId: a.expeditionId,
        cycle: a.completedCycles,
        completedAt: new Date(l).toISOString(),
        offsetMs: Math.min(Number.MAX_SAFE_INTEGER, l - Date.parse(a.startedAt)),
        kind: "RETURN",
        title: "Expedition complete",
        detail: "The party returned with rewards ready to claim.",
        successScore: 100,
        battleWon: null,
        miningYield: 0,
        equipmentDropId: null,
        equipmentDropSeed: null,
        bestDropRarity: a.reportSummary.bestDropRarity,
        rareDiscoveryCount: a.reportSummary.rareDiscoveries,
        reward: vt(a.expeditionStorage)
      }]);
    }
  }
  return { cyclesProcessed: r, reports: s, capped: i };
}, ft = (e, t) => ve(e, t, Number.MAX_SAFE_INTEGER), zi = (e, t, n) => {
  e.stones[t.instanceId] = t, hn(e, t), mn.indexOf(t.rarity) >= mn.indexOf("SSR") && (e.statistics.rareDiscoveryCount = ft(e.statistics.rareDiscoveryCount, 1)), t.mutation !== "NONE" && (e.statistics.mutationCount = ft(e.statistics.mutationCount, 1)), On(t.individualValues) && t.mutation !== "PERFECT" && (e.statistics.mutationCount = ft(e.statistics.mutationCount, 1)), Xt(e, n);
}, _c = (e, t, n = de) => {
  const r = e.expeditions.runs[t];
  if (!r) throw new Error("Expedition not found");
  const i = r.completedCycles - r.claimedCycles;
  if (i <= 0) throw new Error("Expedition has no unclaimed completion");
  const s = hc(r.expeditionStorage), o = { accountId: e.account.accountId, username: e.account.username }, a = Math.max(0, e.inventory.capacity - Object.keys(e.stones).length), l = s.rareDiscoveries.slice(0, a), d = s.rareDiscoveries.slice(l.length), u = Math.max(0, Bi - e.expeditions.discoveryStorage.length);
  if (d.length > u) throw new Error("Temporary Discovery Storage is full; free a Stone/storage slot before claiming");
  const h = d.map((m) => ({ ...m })), w = l.map((m) => {
    const A = fe[m.speciesId];
    if (!A) throw new Error(`Unknown expedition species: ${m.speciesId}`);
    const S = { now: () => new Date(m.discoveredAt) }, k = Yi(m.seed);
    return Ct({
      species: A,
      origin: "EXPEDITION",
      owner: o,
      rng: new Re(m.seed),
      clock: S,
      appraised: !0,
      ...k === null ? {} : { mutation: k }
    });
  });
  if (new Set(w.map((m) => m.instanceId)).size !== w.length || w.some((m) => e.stones[m.instanceId]))
    throw new Error("Expedition discovery ID collision");
  e.inventory.currencies.credits = ft(e.inventory.currencies.credits, s.credits), e.inventory.currencies.upgradeDust = ft(e.inventory.currencies.upgradeDust, s.upgradeDust), e.inventory.currencies.researchCores = ft(e.inventory.currencies.researchCores, s.researchCores);
  for (const [m, A] of Object.entries(s.items)) e.inventory.items[m] = ft(e.inventory.items[m] ?? 0, A);
  Vt(e, Math.min(s.accountXp, Number.MAX_SAFE_INTEGER - e.accountProgress.xp));
  for (const m of r.partySnapshot) {
    const A = e.stones[m.stoneId];
    A && (wr(A, e.mastery, s.stoneXpPerMember), xn(A, s.affinityPerMember));
  }
  for (const m of w)
    zi(e, m, n);
  e.expeditions.discoveryStorage.push(...h), e.profile.totalAffinity = Object.values(e.stones).reduce((m, A) => ft(m, A.affinity.points), 0);
  const E = n.now();
  return r.claimedCycles = r.completedCycles, r.claimCount = ve(r.claimCount, 1, Number.MAX_SAFE_INTEGER), r.lastClaimedAt = E.toISOString(), r.expeditionStorage = mt(), r.status === "READY" && (r.status = "CLAIMED"), e.expeditions.totalClaims = ve(e.expeditions.totalClaims, 1, Number.MAX_SAFE_INTEGER), { expeditionId: t, cyclesClaimed: i, reward: s, discoveredStones: w, storedDiscoveries: h, reports: r.reportEvents.map((m) => ({ ...m, reward: { ...m.reward, items: { ...m.reward.items } } })) };
}, kc = (e, t, n = de) => {
  if (Object.keys(e.stones).length >= e.inventory.capacity) throw new Error("Stone capacity is full");
  const r = e.expeditions.discoveryStorage.findIndex((u) => u.discoveryId === t);
  if (r < 0) throw new Error("Stored expedition discovery not found");
  const i = e.expeditions.discoveryStorage[r], s = fe[i.speciesId];
  if (!s) throw new Error(`Unknown expedition species: ${i.speciesId}`);
  const o = { accountId: e.account.accountId, username: e.account.username }, a = { now: () => new Date(i.discoveredAt) }, l = Yi(i.seed), d = Ct({
    species: s,
    origin: "EXPEDITION",
    owner: o,
    rng: new Re(i.seed),
    clock: a,
    appraised: !0,
    ...l === null ? {} : { mutation: l }
  });
  if (e.stones[d.instanceId]) throw new Error("Expedition discovery ID collision");
  return zi(e, d, n), e.expeditions.discoveryStorage.splice(r, 1), d;
}, Ft = (e, t) => {
  if (!Number.isSafeInteger(e) || e < 0) throw new Error(`${t} must be a non-negative safe integer`);
}, Qi = (e, t) => {
  if (!Number.isSafeInteger(e) || e <= 0) throw new Error(`${t} must be a positive safe integer`);
}, Xr = (e) => {
  if (typeof e.id != "string" || e.id.length === 0) throw new Error("job.id must be a non-empty string");
  Ft(e.dueAtMs, "job.dueAtMs");
  const t = e.sequence ?? 0;
  if (Ft(t, "job.sequence"), e.repeatEveryMs !== void 0 && Qi(e.repeatEveryMs, "job.repeatEveryMs"), e.endAtMs !== void 0) {
    if (Ft(e.endAtMs, "job.endAtMs"), e.repeatEveryMs === void 0) throw new Error("job.endAtMs requires repeatEveryMs");
    if (e.endAtMs < e.dueAtMs) throw new Error("job.endAtMs cannot precede job.dueAtMs");
  }
  return { ...e, sequence: t };
}, Vn = (e) => [...e].sort((t, n) => t.dueAtMs - n.dueAtMs || t.id.localeCompare(n.id));
class Ji {
  jobs = /* @__PURE__ */ new Map();
  constructor(t) {
    if (t && t.version !== 1) throw new Error("Unsupported scheduler snapshot");
    for (const n of t?.jobs ?? []) this.schedule(n);
  }
  schedule(t) {
    const n = Xr(t);
    if (this.jobs.has(n.id)) throw new Error(`Duplicate background job: ${n.id}`);
    this.jobs.set(n.id, n);
  }
  upsert(t) {
    const n = Xr(t);
    this.jobs.set(n.id, n);
  }
  cancel(t) {
    return this.jobs.delete(t);
  }
  has(t) {
    return this.jobs.has(t);
  }
  size() {
    return this.jobs.size;
  }
  nextDueAtMs() {
    return Vn(this.jobs.values())[0]?.dueAtMs ?? null;
  }
  snapshot() {
    return { version: 1, jobs: Vn(this.jobs.values()).map((t) => ({ ...t })) };
  }
  drainDue(t, n, r = {}) {
    Ft(t, "nowMs");
    const i = r.maxCallbacks ?? 100, s = r.maxOccurrencesPerCallback ?? 96, o = r.maxCatchUpMs ?? oi.THIRTY_DAYS;
    Ft(i, "maxCallbacks"), Qi(s, "maxOccurrencesPerCallback"), Ft(o, "maxCatchUpMs");
    let a = 0, l = 0, d = 0;
    for (; a < i; ) {
      const h = Vn(this.jobs.values()).find((M) => M.dueAtMs <= t);
      if (!h) break;
      const w = h.repeatEveryMs;
      if (w === void 0) {
        const M = {
          jobId: h.id,
          payload: h.payload,
          firstDueAtMs: h.dueAtMs,
          lastDueAtMs: h.dueAtMs,
          occurrences: 1,
          firstSequence: h.sequence ?? 0,
          lastSequence: h.sequence ?? 0,
          delayedByMs: t - h.dueAtMs
        };
        n(M), this.jobs.delete(h.id), a += 1, l += 1;
        continue;
      }
      let E = h.dueAtMs, m = h.sequence ?? 0;
      const A = Math.max(0, t - o);
      if (E < A) {
        const M = Math.ceil((A - E) / w);
        E += M * w, m += M, d += M;
      }
      if (h.endAtMs !== void 0 && E > h.endAtMs) {
        this.jobs.delete(h.id);
        continue;
      }
      const S = Math.min(t, h.endAtMs ?? t);
      if (E > S) {
        this.jobs.set(h.id, { ...h, dueAtMs: E, sequence: m });
        continue;
      }
      const k = Math.floor((S - E) / w) + 1, T = Math.min(k, s), p = E + (T - 1) * w, f = {
        jobId: h.id,
        payload: h.payload,
        firstDueAtMs: E,
        lastDueAtMs: p,
        occurrences: T,
        firstSequence: m,
        lastSequence: m + T - 1,
        delayedByMs: t - p
      };
      n(f), a += 1, l += T;
      const y = p + w, b = m + T;
      h.endAtMs !== void 0 && y > h.endAtMs ? this.jobs.delete(h.id) : this.jobs.set(h.id, { ...h, dueAtMs: y, sequence: b });
    }
    const u = this.nextDueAtMs();
    return {
      callbacks: a,
      deliveredOccurrences: l,
      skippedOccurrences: d,
      hasMoreDue: u !== null && u <= t,
      nextDueAtMs: u
    };
  }
}
const sn = 3600 * 1e3, br = Mt, Cc = [
  {
    id: "GEOLOGY_SURVEY",
    name: "Geology Survey",
    durationMs: sn,
    requiredLabLevel: 1,
    prerequisiteProjectId: null,
    coreCost: 1,
    researchPoints: 45,
    rewardItems: { research_geology_notes: 1 },
    facilityLevelTargets: { fusionLab: 2, researchLab: 3, expeditionGuild: 3 }
  },
  {
    id: "GENETIC_ARCHIVE",
    name: "Genetic Archive",
    durationMs: 12 * sn,
    requiredLabLevel: 3,
    prerequisiteProjectId: "GEOLOGY_SURVEY",
    coreCost: 4,
    researchPoints: 240,
    rewardItems: { research_gene_record: 1 },
    facilityLevelTargets: { fusionLab: 4, researchLab: 5, expeditionGuild: 5 }
  },
  {
    id: "EXPEDITION_LOGISTICS",
    name: "Expedition Logistics",
    durationMs: 24 * sn,
    requiredLabLevel: 5,
    prerequisiteProjectId: "GENETIC_ARCHIVE",
    coreCost: 8,
    researchPoints: 520,
    rewardItems: { research_logistics_plan: 1 },
    facilityLevelTargets: { fusionLab: 6, researchLab: 7, expeditionGuild: 7 }
  }
], ir = Object.fromEntries(Cc.map((e) => [e.id, e])), xt = (e) => {
  const t = e.getTime();
  if (!Number.isSafeInteger(t) || t < 0) throw new Error("Background activity received an invalid timestamp");
  return t;
}, _t = (e, t) => Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(e)) + Math.max(0, Math.floor(t))), Zi = (e, t) => {
  const n = Date.parse(e), r = xt(t);
  return !Number.isFinite(n) || r <= n ? 0 : Math.min(br, r - n);
}, xc = (e, t) => Object.values(e.expeditions.runs).some((n) => n.status !== "CLAIMED" && n.partySnapshot.some((r) => r.stoneId === t)), Oc = (e, t) => (e.endlessMine.status === "RUNNING" || e.endlessMine.status === "PAUSED") && e.endlessMine.partyStoneIds.includes(t), Lc = (e, t) => !!(e.activeBattle && !e.activeBattle.winner && e.activeBattle.units.some((n) => n.team === "PLAYER" && n.stoneId === t)), es = (e, t, n) => {
  if (!e.stones[t]) throw new Error(`Stone not found: ${t}`);
  if (xc(e, t)) throw new Error("A stone on expedition cannot use a background facility");
  if (Oc(e, t)) throw new Error("A stone in Endless Mine cannot use a background facility");
  if (Lc(e, t)) throw new Error("A stone in an active battle cannot use a background facility");
  if (n !== "training" && e.training.assignment?.stoneId === t) throw new Error("Stone is already training");
  if (n !== "garden" && e.affinityGarden.assignment?.stoneId === t) throw new Error("Stone is already in the affinity garden");
}, _n = (e) => {
  const t = e.training.assignment;
  return t ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(t.bankedMs * t.xpPerHour / sn)) : 0;
}, kn = (e) => {
  const t = e.affinityGarden.assignment;
  return t ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(t.bankedMs * t.affinityPerHour / sn)) : 0;
}, Dc = (e, t, n) => {
  if (e.training.assignment) throw new Error("Training Chamber is occupied");
  es(e, t, "training");
  const r = new Date(xt(n)).toISOString();
  e.training.assignment = {
    stoneId: t,
    assignedAt: r,
    lastProcessedAt: r,
    xpPerHour: Math.min(1e4, 80 + e.facilities.researchLab * 40),
    bankedMs: 0,
    totalClaimedXp: 0
  };
}, ts = (e, t) => {
  const n = e.training.assignment;
  n && (n.bankedMs = Math.min(br, _t(n.bankedMs, Zi(n.lastProcessedAt, t))), xt(t) >= Date.parse(n.lastProcessedAt) && (n.lastProcessedAt = t.toISOString()));
}, $c = (e, t) => {
  ts(e, t);
  const n = e.training.assignment;
  if (!n) throw new Error("Training Chamber is empty");
  const r = _n(e);
  if (r <= 0) throw new Error("No Training Chamber XP is ready");
  const i = e.stones[n.stoneId];
  if (!i) throw new Error("Training stone is missing");
  return wr(i, e.mastery, r), n.bankedMs = 0, n.totalClaimedXp = _t(n.totalClaimedXp, r), r;
}, Pc = (e) => {
  if (e.training.assignment) {
    if (_n(e) > 0) throw new Error("Claim Training Chamber XP before removing the stone");
    e.training.assignment = null;
  }
}, Fc = (e, t, n) => {
  if (e.affinityGarden.assignment) throw new Error("Affinity Garden is occupied");
  es(e, t, "garden");
  const r = new Date(xt(n)).toISOString();
  e.affinityGarden.assignment = {
    stoneId: t,
    assignedAt: r,
    lastProcessedAt: r,
    affinityPerHour: Math.min(100, 1 + Math.floor(e.accountProgress.level / 10) + Math.floor(e.facilities.researchLab / 3)),
    bankedMs: 0,
    totalClaimedAffinity: 0
  };
}, ns = (e, t) => {
  const n = e.affinityGarden.assignment;
  n && (n.bankedMs = Math.min(br, _t(n.bankedMs, Zi(n.lastProcessedAt, t))), xt(t) >= Date.parse(n.lastProcessedAt) && (n.lastProcessedAt = t.toISOString()));
}, Bc = (e, t) => {
  ns(e, t);
  const n = e.affinityGarden.assignment;
  if (!n) throw new Error("Affinity Garden is empty");
  const r = kn(e);
  if (r <= 0) throw new Error("No Affinity Garden reward is ready");
  const i = e.stones[n.stoneId];
  if (!i) throw new Error("Affinity Garden stone is missing");
  return xn(i, r), n.bankedMs = 0, n.totalClaimedAffinity = _t(n.totalClaimedAffinity, r), e.profile.totalAffinity = Object.values(e.stones).reduce((s, o) => _t(s, o.affinity.points), 0), r;
}, qc = (e) => {
  if (e.affinityGarden.assignment) {
    if (kn(e) > 0) throw new Error("Claim Affinity Garden rewards before removing the stone");
    e.affinityGarden.assignment = null;
  }
}, Gc = (e, t, n, r = de) => {
  const i = ir[t];
  if (!i) throw new Error(`Unknown research project: ${t}`);
  if (e.research.slot && e.research.slot.status !== "CLAIMED") throw new Error("Research slot is occupied");
  if (e.research.completedProjectIds.includes(t)) throw new Error("Research project is already complete");
  if (i.prerequisiteProjectId && !e.research.completedProjectIds.includes(i.prerequisiteProjectId))
    throw new Error(`${ir[i.prerequisiteProjectId].name} must be completed first`);
  if (e.facilities.researchLab < i.requiredLabLevel) throw new Error(`Research Lab level ${i.requiredLabLevel} required`);
  jt(e, { currencies: { researchCores: i.coreCost } });
  const s = r.now(), o = xt(s), a = tt("research", n, o), l = {
    researchId: a,
    projectId: t,
    seed: `${a}:${Math.floor(n.next() * 4294967296).toString(16)}`,
    startedAt: s.toISOString(),
    completesAt: new Date(o + i.durationMs).toISOString(),
    status: "ACTIVE",
    claimedAt: null
  };
  return e.research.slot = l, l;
}, rs = (e, t) => {
  const n = e.research.slot;
  return !n || n.status !== "ACTIVE" || xt(t) < Date.parse(n.completesAt) ? !1 : (n.status = "READY", !0);
}, Uc = (e, t, n) => {
  if (e.research.claimLedger[t]) throw new Error("Research reward was already claimed");
  rs(e, n);
  const r = e.research.slot;
  if (!r || r.researchId !== t) throw new Error("Research slot not found");
  if (r.status !== "READY") throw new Error("Research is not complete");
  const i = ir[r.projectId];
  e.accountProgress.researchPoints = _t(e.accountProgress.researchPoints, i.researchPoints);
  for (const [s, o] of Object.entries(i.rewardItems)) e.inventory.items[s] = _t(e.inventory.items[s] ?? 0, o);
  for (const s of ["fusionLab", "researchLab", "expeditionGuild"])
    e.facilities[s] = Math.max(e.facilities[s], i.facilityLevelTargets[s]);
  return e.research.completedProjectIds.includes(i.id) || e.research.completedProjectIds.push(i.id), e.research.claimLedger[t] = !0, r.status = "CLAIMED", r.claimedAt = n.toISOString(), e.research.slot = null, { projectId: i.id, researchPoints: i.researchPoints, items: { ...i.rewardItems } };
}, Wr = 900 * 1e3, Hc = 64, jc = 16, Dt = (e, t) => {
  const n = Date.parse(e);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${t} is not a valid timestamp`);
  return n;
}, Yc = (e) => {
  const t = e.getTime();
  if (!Number.isSafeInteger(t) || t < 0) throw new Error("Idle anchor is invalid");
  return {
    timeCheckpoint: ai(t),
    scheduler: { version: 1, jobs: [] },
    lastProcessedAt: e.toISOString(),
    lastActiveAt: e.toISOString(),
    lastWelcomeBack: null
  };
}, Vc = (e) => {
  const t = [];
  for (const n of Object.values(e.expeditions.runs))
    n.status === "ACTIVE" && n.expeditionStorage.rareDiscoveries.length < Gn && t.push({
      id: `expedition:${n.expeditionId}`,
      dueAtMs: Dt(n.nextCompletionAt, "expedition.nextCompletionAt"),
      payload: { kind: "EXPEDITION", expeditionId: n.expeditionId }
    });
  return e.training.assignment && t.push({
    id: `training:${e.training.assignment.stoneId}`,
    dueAtMs: Dt(e.training.assignment.lastProcessedAt, "training.lastProcessedAt") + Wr,
    payload: { kind: "TRAINING", stoneId: e.training.assignment.stoneId }
  }), e.affinityGarden.assignment && t.push({
    id: `affinity-garden:${e.affinityGarden.assignment.stoneId}`,
    dueAtMs: Dt(e.affinityGarden.assignment.lastProcessedAt, "affinityGarden.lastProcessedAt") + Wr,
    payload: { kind: "AFFINITY_GARDEN", stoneId: e.affinityGarden.assignment.stoneId }
  }), e.research.slot?.status === "ACTIVE" && t.push({
    id: `research:${e.research.slot.researchId}`,
    dueAtMs: Dt(e.research.slot.completesAt, "research.completesAt"),
    payload: { kind: "RESEARCH", researchId: e.research.slot.researchId }
  }), e.endlessMine.status === "RUNNING" && e.endlessMine.runId && e.endlessMine.nextFloorAt && !e.endlessMine.manualMode && t.push({
    id: `endless-mine:${e.endlessMine.runId}`,
    dueAtMs: Dt(e.endlessMine.nextFloorAt, "endlessMine.nextFloorAt"),
    payload: { kind: "ENDLESS_MINE", runId: e.endlessMine.runId }
  }), t;
}, Ve = (e) => {
  const t = new Ji(e.idle.scheduler), n = /* @__PURE__ */ new Set();
  for (const i of Vc(e))
    n.add(i.id), t.upsert(i);
  for (const i of t.snapshot().jobs) n.has(i.id) || t.cancel(i.id);
  const r = t.snapshot();
  return e.idle.scheduler = { version: 1, jobs: r.jobs.map((i) => ({ ...i })) }, t.nextDueAtMs();
}, An = (e, t, n = {}) => {
  const r = n.mode ?? "OFFLINE", i = t.now().getTime(), s = Ls(e.idle.timeCheckpoint, i, { maxForwardAdvanceMs: Mt });
  e.idle.timeCheckpoint = { ...s.checkpoint };
  const o = new Date(s.nowMs), a = Dt(e.idle.lastProcessedAt, "idle.lastProcessedAt"), l = Math.max(0, Math.min(Mt, s.nowMs - a));
  Ve(e);
  const d = new Ji(e.idle.scheduler);
  let u = 0, h = 0, w = 0, E = 0, m = 0, A = 0;
  const S = _n(e), k = kn(e);
  let T = s.anomaly === "forward-capped";
  const p = d.drainDue(s.nowMs, (q) => {
    switch (q.payload.kind) {
      case "EXPEDITION": {
        const K = Nc(e, o);
        u += K.cyclesProcessed, A += K.reports.reduce((ue, F) => ue + F.rareDiscoveryCount, 0), T ||= K.capped;
        break;
      }
      case "TRAINING":
        ts(e, o);
        break;
      case "AFFINITY_GARDEN":
        ns(e, o);
        break;
      case "RESEARCH":
        rs(e, o);
        break;
      case "ENDLESS_MINE": {
        if (e.endlessMine.runId !== q.payload.runId || n.skipEndless) break;
        const K = Date.parse(e.endlessMine.nextFloorAt ?? ""), ue = Number.isFinite(K) && s.nowMs >= K ? Math.floor((s.nowMs - K) / qe) + 1 : 0, F = r === "ACTIVE" ? Ci(e.endlessMine, Math.min(jc, ue), o) : qo(e.endlessMine, o);
        h += F.clearedFloors, w += F.credits, E += F.equipmentAdded, m += F.equipmentSalvaged;
        break;
      }
    }
  }, { maxCallbacks: Hc, maxOccurrencesPerCallback: 128, maxCatchUpMs: Mt });
  if (T ||= p.hasMoreDue || p.skippedOccurrences > 0, e.idle.scheduler = { version: 1, jobs: d.snapshot().jobs.map((q) => ({ ...q })) }, e.idle.lastProcessedAt = o.toISOString(), e.idle.lastActiveAt = o.toISOString(), Ve(e), r === "ACTIVE") return null;
  const f = s.anomaly === "rollback" ? null : e.idle.lastWelcomeBack, y = Math.max(0, _n(e) - S), b = Math.max(0, kn(e) - k);
  if (!(l >= 6e4 || s.anomaly !== "none" || u > 0 || h > 0 || E > 0 || m > 0 || A > 0)) return null;
  const N = f?.from ?? new Date(a).toISOString(), L = o.toISOString(), G = (f?.elapsedMs ?? 0) + l, H = {
    summaryId: `welcome:${a}:${s.nowMs}:${e.idle.timeCheckpoint.reconciliationCount}`,
    from: N,
    to: L,
    elapsedMs: Math.min(Mt, G),
    capped: T || G > Mt || !!f?.capped,
    rollbackDetected: s.anomaly === "rollback" || !!f?.rollbackDetected,
    expeditionCycles: (f?.expeditionCycles ?? 0) + u,
    trainingXpReady: (f?.trainingXpReady ?? 0) + y,
    affinityReady: (f?.affinityReady ?? 0) + b,
    researchReady: e.research.slot?.status === "READY",
    endlessFloors: (f?.endlessFloors ?? 0) + h,
    endlessCredits: (f?.endlessCredits ?? 0) + w,
    equipmentAdded: (f?.equipmentAdded ?? 0) + E,
    equipmentSalvaged: (f?.equipmentSalvaged ?? 0) + m,
    rareDiscoveries: (f?.rareDiscoveries ?? 0) + A,
    createdAt: L
  };
  return e.idle.lastWelcomeBack = H, H;
}, $t = "stoneverse.save.v5", en = "stoneverse.save.v5.backup", tn = "stoneverse.save.v5.pending", Xc = ["stoneverse.save.v4", "stoneverse.save.v4.pending", "stoneverse.save.v4.backup", "stoneverse.save.v3"], Wc = () => {
  try {
    return typeof window < "u" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}, ce = (e) => !!e && typeof e == "object" && !Array.isArray(e), O = (e, t) => {
  throw new Error(`Invalid save at ${e}: ${t}`);
}, B = (e, t) => ce(e) ? e : O(t, "expected an object"), wn = (e, t, n) => {
  const r = new Set(t), i = Object.keys(e).find((s) => !r.has(s));
  i !== void 0 && O(`${n}.${i}`, "unexpected field");
}, $ = (e, t, n = {}) => {
  if (e === null && n.nullable) return null;
  if (typeof e != "string") return O(t, "expected a string");
  const r = n.min ?? 0, i = n.max ?? 1e4;
  return e.length < r || e.length > i ? O(t, `expected length ${r}-${i}`) : e;
}, Se = (e, t) => typeof e != "boolean" ? O(t, "expected a boolean") : e, C = (e, t, n = {}) => typeof e != "number" || !Number.isFinite(e) ? O(t, "expected a finite number") : n.integer && !Number.isSafeInteger(e) ? O(t, "expected a safe integer") : n.min !== void 0 && e < n.min ? O(t, `expected >= ${n.min}`) : n.max !== void 0 && e > n.max ? O(t, `expected <= ${n.max}`) : e, V = (e, t, n) => typeof e != "string" || !t.includes(e) ? O(n, `expected one of ${t.join(", ")}`) : e, me = (e, t, n = 1e5) => Array.isArray(e) ? e.length > n ? O(t, `array exceeds ${n} entries`) : e : O(t, "expected an array"), te = (e, t, n = !1) => {
  if (e === null && n) return null;
  const r = $(e, t, { min: 1, max: 64 });
  return (r === null || !Number.isFinite(Date.parse(r))) && O(t, "expected a valid timestamp"), r;
}, he = (e, t, n = {}) => {
  const r = me(e, t, n.max ?? 1e5).map((i, s) => $(i, `${t}[${s}]`, { min: 1, max: 256 }));
  return n.unique && new Set(r).size !== r.length && O(t, "duplicate entries are not allowed"), r;
}, Tr = (e, t, n = !1) => {
  const r = B(e, t);
  for (const i of [...je, "maxHp"]) C(r[i], `${t}.${i}`, { min: n ? 0 : 1, max: 1e9 });
}, kt = (e, t) => {
  const n = B(e, t);
  for (const [r, i] of Object.entries(n))
    (!r || r.length > 256) && O(t, "contains an invalid key"), C(i, `${t}.${r}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
}, sr = (e, t) => {
  const n = B(e, t);
  $(n.instanceId, `${t}.instanceId`, { min: 1, max: 256 }), $(n.definitionId, `${t}.definitionId`, { min: 1, max: 256 }), V(n.slot, ["CORE", "RUNE", "RELIC", "CHARM"], `${t}.slot`), C(n.level, `${t}.level`, { min: 1, max: 1e4, integer: !0 }), V(n.rarity, et, `${t}.rarity`), n.setId !== void 0 && n.setId !== null && V(n.setId, ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"], `${t}.setId`), Se(n.locked, `${t}.locked`), me(n.affixes, `${t}.affixes`, 32).forEach((r, i) => {
    const s = B(r, `${t}.affixes[${i}]`);
    V(s.stat, [...je, "maxHp"], `${t}.affixes[${i}].stat`), V(s.operation, ["FLAT", "PERCENT"], `${t}.affixes[${i}].operation`), C(s.value, `${t}.affixes[${i}].value`, { min: -1e6, max: 1e6 }), s.sourceStat !== void 0 && V(s.sourceStat, ["maxHp", "attack", "defense", "speed", "accuracy", "resistance", "critChance", "critDamage", "breakPower"], `${t}.affixes[${i}].sourceStat`);
  });
}, Xn = (e, t) => {
  const n = B(e, t);
  $(n.accountId, `${t}.accountId`, { min: 1, max: 128 }), $(n.username, `${t}.username`, { min: 1, max: 64 });
}, or = (e, t) => {
  const n = B(e, t);
  $(n.instanceId, `${t}.instanceId`, { min: 1, max: 256 }), $(n.speciesId, `${t}.speciesId`, { min: 1, max: 256 }), $(n.serialNumber, `${t}.serialNumber`, { min: 1, max: 256 }), $(n.nickname, `${t}.nickname`, { nullable: !0, max: 20 }), V(n.mutation, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `${t}.mutation`), V(n.colorVariant, ["STANDARD", "SHINY", "AURORA", "OBSIDIAN"], `${t}.colorVariant`), he(n.traitIds, `${t}.traitIds`, { max: 8, unique: !0 });
}, Kc = (e, t, n) => {
  const r = B(e, n);
  $(r.instanceId, `${n}.instanceId`, { min: 1, max: 256 }) !== t && O(n, "map key must equal instanceId"), $(r.serialNumber, `${n}.serialNumber`, { min: 1, max: 256 }), $(r.speciesId, `${n}.speciesId`, { min: 1, max: 256 }), $(r.name, `${n}.name`, { min: 1, max: 128 }), $(r.nickname, `${n}.nickname`, { nullable: !0, max: 20 }), V(r.rarity, et, `${n}.rarity`), V(r.origin, Ta, `${n}.origin`), C(r.level, `${n}.level`, { min: 1, max: 120, integer: !0 }), C(r.xp, `${n}.xp`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), C(r.potential, `${n}.potential`, { min: 0, max: 100, integer: !0 }), $(r.personalityId, `${n}.personalityId`, { min: 1, max: 256 }), V(r.primaryElement, dn, `${n}.primaryElement`), r.secondaryElement !== null && V(r.secondaryElement, dn, `${n}.secondaryElement`), Tr(r.stats, `${n}.stats`);
  const s = B(r.individualValues, `${n}.individualValues`);
  for (const h of je) C(s[h], `${n}.individualValues.${h}`, { min: 0, max: 31, integer: !0 });
  he(r.traitIds, `${n}.traitIds`, { max: 8, unique: !0 }), me(r.skills, `${n}.skills`, 6).forEach((h, w) => {
    const E = B(h, `${n}.skills[${w}]`);
    $(E.skillId, `${n}.skills[${w}].skillId`, { min: 1, max: 256 }), C(E.level, `${n}.skills[${w}].level`, { min: 1, max: 100, integer: !0 }), V(E.source, ["NATURAL", "LEVEL", "AWAKENING", "FUSION", "EQUIPMENT", "TREE"], `${n}.skills[${w}].source`);
  }), C(r.skillPoints, `${n}.skillPoints`, { min: 0, max: 1e6, integer: !0 }), he(r.learnedSkillNodes, `${n}.learnedSkillNodes`, { max: 1e3, unique: !0 });
  const o = B(r.equipment, `${n}.equipment`);
  for (const [h, w] of Object.entries(o))
    V(h, ["CORE", "RUNE", "RELIC", "CHARM"], `${n}.equipment slot`), sr(w, `${n}.equipment.${h}`), w.slot !== h && O(`${n}.equipment.${h}`, "equipment slot mismatch");
  const a = B(r.affinity, `${n}.affinity`);
  C(a.points, `${n}.affinity.points`, { min: 0, max: 9999, integer: !0 }), C(a.rank, `${n}.affinity.rank`, { min: 0, max: 7, integer: !0 }), me(a.claimedMilestones, `${n}.affinity.claimedMilestones`, 32).forEach((h, w) => C(h, `${n}.affinity.claimedMilestones[${w}]`, { min: 0, max: 100, integer: !0 })), C(r.awakeningStage, `${n}.awakeningStage`, { min: 0, max: 10, integer: !0 }), C(r.evolutionStage, `${n}.evolutionStage`, { min: 0, max: 100, integer: !0 }), C(r.reincarnationCount, `${n}.reincarnationCount`, { min: 0, max: 1e3, integer: !0 }), C(r.limitBreak, `${n}.limitBreak`, { min: 0, max: 5, integer: !0 }), V(r.mutation, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `${n}.mutation`), V(r.colorVariant, ["STANDARD", "SHINY", "AURORA", "OBSIDIAN"], `${n}.colorVariant`), me(r.parents, `${n}.parents`, 4).forEach((h, w) => or(h, `${n}.parents[${w}]`)), me(r.grandparents, `${n}.grandparents`, 8).forEach((h, w) => or(h, `${n}.grandparents[${w}]`)), C(r.generation, `${n}.generation`, { min: 0, max: 1e5, integer: !0 }), Xn(r.originalOwner, `${n}.originalOwner`), Xn(r.currentOwner, `${n}.currentOwner`), Xn(r.discoverer, `${n}.discoverer`), te(r.createdAt, `${n}.createdAt`), te(r.firstObtainedAt, `${n}.firstObtainedAt`), te(r.appraisedAt, `${n}.appraisedAt`, !0);
  const l = B(r.battleStatistics, `${n}.battleStatistics`);
  for (const h of ["battles", "wins", "losses", "damageDealt", "damageTaken", "healingDone", "criticalHits", "enemiesDefeated", "ultimatesUsed"])
    C(l[h], `${n}.battleStatistics.${h}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  Se(r.favorite, `${n}.favorite`), Se(r.locked, `${n}.locked`), he(r.tags, `${n}.tags`, { max: 100, unique: !0 });
  const d = r, u = ks(d);
  return u.length > 0 && O(n, u.join(", ")), d;
}, zc = (e, t) => {
  const n = B(e, t);
  n.currencies !== void 0 && kt(n.currencies, `${t}.currencies`), n.items !== void 0 && kt(n.items, `${t}.items`);
  for (const r of ["accountXp", "miningXp", "stoneXp"]) n[r] !== void 0 && C(n[r], `${t}.${r}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
}, Qc = (e, t) => {
  const n = B(e, t);
  for (const [r, i] of Object.entries(n))
    V(r, [...je, "maxHp"], `${t} key`), C(i, `${t}.${r}`, { min: -1e9, max: 1e9 });
}, is = (e, t) => {
  const n = B(e, t), r = $(n.discoveryId, `${t}.discoveryId`, { min: 1, max: 256 });
  $(n.seed, `${t}.seed`, { min: 1, max: 1024 });
  const i = $(n.speciesId, `${t}.speciesId`, { min: 1, max: 256 });
  return fe[i] || O(`${t}.speciesId`, "references an unknown species"), $(n.veinId, `${t}.veinId`, { min: 1, max: 256 }), $(n.areaId, `${t}.areaId`, { min: 1, max: 256 }), V(n.hintedRarity, et, `${t}.hintedRarity`), $(n.sourceEventId, `${t}.sourceEventId`, { min: 1, max: 256 }), te(n.discoveredAt, `${t}.discoveredAt`), r;
}, Jc = (e, t) => {
  const n = B(e, t);
  for (const i of ["credits", "upgradeDust", "researchCores", "accountXp", "stoneXpPerMember", "affinityPerMember"])
    C(n[i], `${t}.${i}`, { min: 0, max: 1e9, integer: !0 });
  kt(n.items, `${t}.items`);
  const r = /* @__PURE__ */ new Set();
  me(n.rareDiscoveries, `${t}.rareDiscoveries`, Gn).forEach((i, s) => {
    const o = is(i, `${t}.rareDiscoveries[${s}]`);
    r.has(o) && O(`${t}.rareDiscoveries[${s}].discoveryId`, "duplicate discovery ID"), r.add(o);
  });
}, Zc = (e, t, n) => {
  const r = B(e, t);
  $(r.reportId, `${t}.reportId`, { min: 1, max: 512 }), $(r.expeditionId, `${t}.expeditionId`, { min: 1, max: 256 }) !== n && O(`${t}.expeditionId`, "does not match its expedition"), C(r.cycle, `${t}.cycle`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), te(r.completedAt, `${t}.completedAt`), C(r.offsetMs, `${t}.offsetMs`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), V(r.kind, ["DEPARTURE", "BATTLE", "MINING", "MATERIAL", "EQUIPMENT", "DISCOVERY", "EVENT", "BOSS", "RETURN"], `${t}.kind`), $(r.title, `${t}.title`, { min: 1, max: 256 }), $(r.detail, `${t}.detail`, { max: 2048 }), C(r.successScore, `${t}.successScore`, { min: 0, max: 1e3 }), r.battleWon !== null && Se(r.battleWon, `${t}.battleWon`), C(r.miningYield, `${t}.miningYield`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), $(r.equipmentDropId, `${t}.equipmentDropId`, { nullable: !0, max: 256 }), $(r.equipmentDropSeed, `${t}.equipmentDropSeed`, { nullable: !0, max: 1024 }), r.bestDropRarity !== null && V(r.bestDropRarity, et, `${t}.bestDropRarity`), C(r.rareDiscoveryCount, `${t}.rareDiscoveryCount`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const i = B(r.reward, `${t}.reward`);
  for (const s of ["credits", "upgradeDust", "researchCores", "accountXp", "stoneXpPerMember", "affinityPerMember"]) C(i[s], `${t}.reward.${s}`, { min: 0, max: 1e9, integer: !0 });
  kt(i.items, `${t}.reward.items`);
}, Kr = (e, t, n, r) => {
  const i = B(e, t);
  $(i.battleId, `${t}.battleId`, { min: 1, max: 256 }), V(i.mode, ["DUNGEON", "INFINITE_MINE", "PVP", "RAID", "SIMULATION"], `${t}.mode`), i.dungeonId !== void 0 && $(i.dungeonId, `${t}.dungeonId`, { min: 1, max: 256 }), i.stageId !== void 0 && $(i.stageId, `${t}.stageId`, { min: 1, max: 256 });
  const s = C(i.turn, `${t}.turn`, { min: 0, max: 100, integer: !0 }), o = me(i.units, `${t}.units`, 32);
  o.length === 0 && O(`${t}.units`, "battle must contain units");
  const a = /* @__PURE__ */ new Set();
  let l = !1, d = !1, u = !1, h = !1;
  if (o.forEach((w, E) => {
    const m = `${t}.units[${E}]`, A = B(w, m), S = $(A.unitId, `${m}.unitId`, { min: 1, max: 256 });
    a.has(S) && O(`${m}.unitId`, "duplicate unitId"), a.add(S);
    const k = $(A.stoneId, `${m}.stoneId`, { min: 1, max: 256 }), T = V(A.team, ["PLAYER", "ENEMY"], `${m}.team`);
    l ||= T === "PLAYER", d ||= T === "ENEMY", r.active && T === "PLAYER" && !n.has(k) && O(`${m}.stoneId`, "active player unit references a missing stone"), $(A.speciesId, `${m}.speciesId`, { min: 1, max: 256 }), $(A.name, `${m}.name`, { min: 1, max: 128 }), V(A.element, dn, `${m}.element`), V(A.role, ["ATTACK", "TANK", "SUPPORT", "CONTROL"], `${m}.role`), C(A.level, `${m}.level`, { min: 1, max: 120, integer: !0 }), Tr(A.stats, `${m}.stats`);
    const p = C(A.stats.maxHp, `${m}.stats.maxHp`, { min: 1, max: 1e9 }), f = C(A.currentHp, `${m}.currentHp`, { min: 0, max: p });
    C(A.shield, `${m}.shield`, { min: 0, max: 1e9 }), C(A.ultimate, `${m}.ultimate`, { min: 0, max: 100 }), kt(A.cooldowns, `${m}.cooldowns`), he(A.skillIds, `${m}.skillIds`, { max: 6, unique: !0 }), he(A.traitIds, `${m}.traitIds`, { max: 8, unique: !0 });
    const y = Se(A.alive, `${m}.alive`);
    y !== f > 0 && O(`${m}.alive`, "must agree with currentHp"), u ||= T === "PLAYER" && y, h ||= T === "ENEMY" && y, me(A.statuses, `${m}.statuses`, 32).forEach((b, M) => {
      const N = B(b, `${m}.statuses[${M}]`);
      V(N.id, ["BURN", "POISON", "STUN", "FRACTURE", "REGEN", "TAUNT"], `${m}.statuses[${M}].id`), C(N.turns, `${m}.statuses[${M}].turns`, { min: 1, max: 100, integer: !0 }), C(N.potency, `${m}.statuses[${M}].potency`, { min: 0, max: 10 }), $(N.sourceId, `${m}.statuses[${M}].sourceId`, { min: 1, max: 256 });
    }), me(A.modifiers, `${m}.modifiers`, 64).forEach((b, M) => {
      const N = B(b, `${m}.modifiers[${M}]`);
      V(N.stat, [...je, "maxHp"], `${m}.modifiers[${M}].stat`), C(N.multiplier, `${m}.modifiers[${M}].multiplier`, { min: 0.01, max: 100 }), C(N.turns, `${m}.modifiers[${M}].turns`, { min: 1, max: 100, integer: !0 }), $(N.sourceId, `${m}.modifiers[${M}].sourceId`, { min: 1, max: 256 });
    });
  }), (!l || !d) && O(`${t}.units`, "battle requires both player and enemy teams"), me(i.actionLog, `${t}.actionLog`, 1e5).forEach((w, E) => {
    const m = `${t}.actionLog[${E}]`, A = B(w, m);
    C(A.turn, `${m}.turn`, { min: 1, max: 100, integer: !0 });
    const S = $(A.actorId, `${m}.actorId`, { min: 1, max: 256 });
    a.has(S) || O(`${m}.actorId`, "references an unknown unit"), $(A.skillId, `${m}.skillId`, { min: 1, max: 256 });
    for (const k of he(A.targetIds, `${m}.targetIds`, { max: 32 })) a.has(k) || O(`${m}.targetIds`, "references an unknown unit");
    C(A.damage, `${m}.damage`, { min: 0, max: Number.MAX_SAFE_INTEGER }), C(A.healing, `${m}.healing`, { min: 0, max: Number.MAX_SAFE_INTEGER }), Se(A.critical, `${m}.critical`), he(A.statusesApplied, `${m}.statusesApplied`, { max: 32 });
    for (const k of he(A.defeatedIds, `${m}.defeatedIds`, { max: 32 })) a.has(k) || O(`${m}.defeatedIds`, "references an unknown unit");
    for (const k of ["damageByTarget", "healingByTarget"]) {
      if (A[k] === void 0) continue;
      const T = B(A[k], `${m}.${k}`);
      for (const [p, f] of Object.entries(T))
        a.has(p) || O(`${m}.${k}`, "references an unknown unit"), C(f, `${m}.${k}.${p}`, { min: 0, max: Number.MAX_SAFE_INTEGER });
    }
  }), i.winner !== null && V(i.winner, ["PLAYER", "ENEMY", "DRAW"], `${t}.winner`), i.reward !== null && zc(i.reward, `${t}.reward`), i.advanced !== void 0) {
    const w = $s(i.advanced);
    w.turn !== s && O(`${t}.advanced.turn`, "must match projected battle turn"), w.outcome !== i.winner && O(`${t}.advanced.outcome`, "must match projected battle winner");
    for (const E of w.units) a.has(E.id) || O(`${t}.advanced.units`, "contains an unprojected combatant");
  }
  if (i.controlMode !== void 0 && V(i.controlMode, ["MANUAL", "AUTO"], `${t}.controlMode`), i.speed !== void 0) {
    const w = C(i.speed, `${t}.speed`, { integer: !0 });
    [1, 2, 4].includes(w) || O(`${t}.speed`, "expected one of 1, 2, 4");
  }
  return te(i.startedAt, `${t}.startedAt`), i.winner === null ? (i.finishedAt !== null && O(`${t}.finishedAt`, "unfinished battle must not have a finish timestamp"), (!u || !h) && O(`${t}.winner`, "unfinished battle must have living units on both teams")) : (te(i.finishedAt, `${t}.finishedAt`), i.winner === "PLAYER" && (!u || h) && O(`${t}.winner`, "PLAYER result disagrees with living teams"), i.winner === "ENEMY" && (!h || u) && O(`${t}.winner`, "ENEMY result disagrees with living teams"), i.winner === "DRAW" && u && h && s < 100 && O(`${t}.winner`, "living-team DRAW requires the turn limit")), !r.active && i.winner === null && O(`${t}.winner`, "battle history cannot contain an unfinished battle"), i;
}, el = (e) => {
  const t = ce(e.account) ? e.account : {}, n = Jn({
    username: typeof t.username == "string" ? t.username : void 0,
    accountId: typeof t.accountId == "string" ? t.accountId : void 0,
    withStarter: !1,
    seed: "migration-defaults"
  }), r = (s, o) => ({ ...s, ...ce(o) ? o : {} });
  return {
    ...n,
    ...e,
    account: r(n.account, e.account),
    accountProgress: r(n.accountProgress, e.accountProgress),
    mining: r(n.mining, e.mining),
    facilities: r(n.facilities, e.facilities),
    expeditions: r(n.expeditions, e.expeditions),
    training: r(n.training, e.training),
    affinityGarden: r(n.affinityGarden, e.affinityGarden),
    research: r(n.research, e.research),
    idle: {
      ...n.idle,
      ...ce(e.idle) ? e.idle : {},
      timeCheckpoint: r(n.idle.timeCheckpoint, ce(e.idle) ? e.idle.timeCheckpoint : void 0),
      scheduler: r(n.idle.scheduler, ce(e.idle) ? e.idle.scheduler : void 0)
    },
    endlessMine: e.endlessMine === void 0 ? n.endlessMine : e.endlessMine,
    mastery: e.mastery === void 0 ? n.mastery : e.mastery,
    inventory: {
      ...n.inventory,
      ...ce(e.inventory) ? e.inventory : {},
      currencies: r(n.inventory.currencies, ce(e.inventory) ? e.inventory.currencies : void 0),
      items: r(n.inventory.items, ce(e.inventory) ? e.inventory.items : void 0),
      equipment: r(n.inventory.equipment, ce(e.inventory) ? e.inventory.equipment : void 0)
    },
    collection: r(n.collection, e.collection),
    gacha: r(n.gacha, e.gacha),
    profile: r(n.profile, e.profile),
    statistics: r(n.statistics, e.statistics),
    online: r(n.online, e.online),
    settings: r(n.settings, e.settings)
  };
}, ss = (e) => {
  const t = B(e, "state");
  C(t.schemaVersion, "state.schemaVersion", { min: Ge, max: Ge, integer: !0 }), C(t.revision, "state.revision", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const n = B(t.account, "state.account"), r = $(n.accountId, "state.account.accountId", { min: 1, max: 128 });
  $(n.username, "state.account.username", { min: 1, max: 24 }), $(n.avatarId, "state.account.avatarId", { min: 1, max: 256 }), $(n.profileFrameId, "state.account.profileFrameId", { min: 1, max: 256 }), $(n.equippedTitleId, "state.account.equippedTitleId", { min: 1, max: 256 }), he(n.ownedTitleIds, "state.account.ownedTitleIds", { max: 1e4, unique: !0 }), he(n.ownedFrameIds, "state.account.ownedFrameIds", { max: 1e4, unique: !0 }), C(n.arenaRating, "state.account.arenaRating", { min: 0, max: 1e6, integer: !0 });
  const i = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "LEGEND"];
  V(n.arenaTier, i, "state.account.arenaTier"), V(n.highestArenaTier, i, "state.account.highestArenaTier");
  const s = B(n.raidStats, "state.account.raidStats");
  C(s.lifetimeDamage, "state.account.raidStats.lifetimeDamage", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), C(s.bossesDefeated, "state.account.raidStats.bossesDefeated", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), s.bestContributionRank !== null && C(s.bestContributionRank, "state.account.raidStats.bestContributionRank", { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }), te(n.createdAt, "state.account.createdAt"), te(n.lastOnlineAt, "state.account.lastOnlineAt");
  const o = B(t.accountProgress, "state.accountProgress");
  C(o.level, "state.accountProgress.level", { min: 1, max: 100, integer: !0 }), C(o.xp, "state.accountProgress.xp", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), C(o.researchPoints, "state.accountProgress.researchPoints", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), C(o.skillPoints, "state.accountProgress.skillPoints", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), he(o.selectedSkillNodes, "state.accountProgress.selectedSkillNodes", { max: 1e4, unique: !0 });
  const a = B(t.mining, "state.mining");
  C(a.level, "state.mining.level", { min: 1, max: 100, integer: !0 }), C(a.xp, "state.mining.xp", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  for (const R of ["totalMined", "dailyMined", "weeklyMined", "monthlyMined"]) C(a[R], `state.mining.${R}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  he(a.unlockedAreas, "state.mining.unlockedAreas", { max: 1e4, unique: !0 }), he(a.unlockedVeins, "state.mining.unlockedVeins", { max: 1e4, unique: !0 });
  const l = B(a.processedFarmEventIds, "state.mining.processedFarmEventIds");
  for (const [R, U] of Object.entries(l))
    (!R || R.length > 128 || U !== !0) && O(`state.mining.processedFarmEventIds.${R}`, "expected an exact event ID mapped to true");
  te(a.lastMinedAt, "state.mining.lastMinedAt", !0);
  const d = B(t.facilities, "state.facilities");
  for (const R of ["fusionLab", "researchLab", "expeditionGuild"]) C(d[R], `state.facilities.${R}`, { min: 1, max: 100, integer: !0 });
  const u = B(t.stones, "state.stones"), h = /* @__PURE__ */ new Set();
  for (const [R, U] of Object.entries(u))
    h.has(R) && O(`state.stones.${R}`, "duplicate stone ID"), h.add(R), Kc(U, R, `state.stones.${R}`);
  const w = Jo(t.endlessMine);
  for (const R of w.partyStoneIds) h.has(R) || O("state.endlessMine.partyStoneIds", "references a missing stone");
  const E = na(t.mastery);
  for (const R of Object.keys(E.stones)) h.has(R) || O("state.mastery.stones", "references a missing stone");
  const m = B(t.expeditions, "state.expeditions"), A = B(m.runs, "state.expeditions.runs");
  Object.keys(A).length > 100 && O("state.expeditions.runs", "exceeds 100 retained runs");
  const S = he(m.order, "state.expeditions.order", { max: 100, unique: !0 }), k = new Map(Ui.map((R) => [R.id, R])), T = new Set(Hi.map((R) => R.id)), p = /* @__PURE__ */ new Set();
  for (const [R, U] of Object.entries(A)) {
    const v = `state.expeditions.runs.${R}`, D = B(U, v);
    $(D.expeditionId, `${v}.expeditionId`, { min: 1, max: 256 }) !== R && O(`${v}.expeditionId`, "map key must equal expeditionId");
    const Ie = $(D.regionId, `${v}.regionId`, { min: 1, max: 256 });
    T.has(Ie) || O(`${v}.regionId`, "references an unknown region");
    const Ye = $(D.durationId, `${v}.durationId`, { min: 1, max: 256 }), it = k.get(Ye);
    it || O(`${v}.durationId`, "references an unknown duration"), C(D.durationMs, `${v}.durationMs`, { min: 1, max: 1440 * 60 * 1e3, integer: !0 }) !== it?.durationMs && O(`${v}.durationMs`, "does not match duration configuration"), V(D.strategy, $i, `${v}.strategy`), $(D.partyId, `${v}.partyId`, { min: 1, max: 256 });
    const ye = V(D.status, ["ACTIVE", "READY", "CLAIMED"], `${v}.status`), ke = me(D.partySnapshot, `${v}.partySnapshot`, 3);
    ke.length === 0 && O(`${v}.partySnapshot`, "must contain at least one stone");
    const Qt = /* @__PURE__ */ new Set();
    ke.forEach((Ce, c) => {
      const g = `${v}.partySnapshot[${c}]`, _ = B(Ce, g), P = $(_.stoneId, `${g}.stoneId`, { min: 1, max: 256 });
      Qt.has(P) && O(`${g}.stoneId`, "duplicate party snapshot stone"), Qt.add(P), ye !== "CLAIMED" && !h.has(P) && O(`${g}.stoneId`, "active expedition references a missing stone"), ye !== "CLAIMED" && (p.has(P) && O(`${g}.stoneId`, "stone is assigned to multiple expeditions"), p.add(P));
      const j = $(_.speciesId, `${g}.speciesId`, { min: 1, max: 256 });
      fe[j] || O(`${g}.speciesId`, "references an unknown species"), C(_.level, `${g}.level`, { min: 1, max: 120, integer: !0 }), V(_.rarity, et, `${g}.rarity`), V(_.primaryElement, dn, `${g}.primaryElement`), _.secondaryElement !== null && V(_.secondaryElement, dn, `${g}.secondaryElement`), Tr(_.stats, `${g}.stats`);
      const ee = B(_.individualValues, `${g}.individualValues`);
      for (const W of je) C(ee[W], `${g}.individualValues.${W}`, { min: 0, max: 31, integer: !0 });
      he(_.skillIds, `${g}.skillIds`, { max: 6, unique: !0 }), he(_.traitIds, `${g}.traitIds`, { max: 8, unique: !0 }), me(_.equipment, `${g}.equipment`, 4).forEach((W, ae) => sr(W, `${g}.equipment[${ae}]`)), Qc(_.equipmentBonuses, `${g}.equipmentBonuses`), V(_.mutation, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `${g}.mutation`), C(_.generation, `${g}.generation`, { min: 0, max: 1e5, integer: !0 }), me(_.lineage, `${g}.lineage`, 8).forEach((W, ae) => or(W, `${g}.lineage[${ae}]`)), C(_.power, `${g}.power`, { min: 1, max: 1e9, integer: !0 }), C(_.affinityRank, `${g}.affinityRank`, { min: 0, max: 7, integer: !0 });
    }), $(D.seed, `${v}.seed`, { min: 1, max: 1024 });
    const yt = Se(D.repeat, `${v}.repeat`);
    te(D.startedAt, `${v}.startedAt`), te(D.lastSimulatedAt, `${v}.lastSimulatedAt`), te(D.nextCompletionAt, `${v}.nextCompletionAt`);
    const at = C(D.completedCycles, `${v}.completedCycles`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), ct = C(D.claimedCycles, `${v}.claimedCycles`, { min: 0, max: at, integer: !0 });
    C(D.claimCount, `${v}.claimCount`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), ye === "READY" && (yt || at <= ct) && O(`${v}.status`, "READY requires an unclaimed non-repeating completion"), ye === "CLAIMED" && (yt || at !== ct) && O(`${v}.status`, "CLAIMED must be a fully claimed non-repeating expedition"), Jc(D.expeditionStorage, `${v}.expeditionStorage`);
    const Ot = /* @__PURE__ */ new Set();
    me(D.reportEvents, `${v}.reportEvents`, un).forEach((Ce, c) => {
      Zc(Ce, `${v}.reportEvents[${c}]`, R);
      const g = Ce.reportId;
      Ot.has(g) && O(`${v}.reportEvents[${c}].reportId`, "duplicate report ID"), Ot.add(g);
    });
    const lt = B(D.reportSummary, `${v}.reportSummary`);
    for (const Ce of ["battles", "wins", "miningYield", "rareDiscoveries", "equipmentDrops"]) C(lt[Ce], `${v}.reportSummary.${Ce}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
    lt.wins > lt.battles && O(`${v}.reportSummary.wins`, "cannot exceed battles"), lt.bestDropRarity !== null && V(lt.bestDropRarity, et, `${v}.reportSummary.bestDropRarity`), te(D.lastClaimedAt, `${v}.lastClaimedAt`, !0), ct > 0 && D.lastClaimedAt === null && O(`${v}.lastClaimedAt`, "claimed cycles require a claim timestamp");
  }
  for (const R of S) Object.prototype.hasOwnProperty.call(A, R) || O("state.expeditions.order", "references a missing expedition");
  const f = /* @__PURE__ */ new Set();
  me(m.discoveryStorage, "state.expeditions.discoveryStorage", Bi).forEach((R, U) => {
    const v = is(R, `state.expeditions.discoveryStorage[${U}]`);
    f.has(v) && O(`state.expeditions.discoveryStorage[${U}].discoveryId`, "duplicate stored discovery"), f.add(v);
  });
  for (const R of ["overflowDiscarded", "totalCycles", "totalClaims"]) C(m[R], `state.expeditions.${R}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const y = B(t.training, "state.training");
  if (y.assignment !== null) {
    const R = B(y.assignment, "state.training.assignment"), U = $(R.stoneId, "state.training.assignment.stoneId", { min: 1, max: 256 });
    h.has(U) || O("state.training.assignment.stoneId", "references a missing stone"), p.has(U) && O("state.training.assignment.stoneId", "stone is also assigned to an expedition"), te(R.assignedAt, "state.training.assignment.assignedAt"), te(R.lastProcessedAt, "state.training.assignment.lastProcessedAt"), C(R.xpPerHour, "state.training.assignment.xpPerHour", { min: 1, max: 1e4, integer: !0 }), C(R.bankedMs, "state.training.assignment.bankedMs", { min: 0, max: 720 * 60 * 60 * 1e3, integer: !0 }), C(R.totalClaimedXp, "state.training.assignment.totalClaimedXp", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  }
  const b = B(t.affinityGarden, "state.affinityGarden");
  if (b.assignment !== null) {
    const R = B(b.assignment, "state.affinityGarden.assignment"), U = $(R.stoneId, "state.affinityGarden.assignment.stoneId", { min: 1, max: 256 });
    h.has(U) || O("state.affinityGarden.assignment.stoneId", "references a missing stone"), (p.has(U) || y.assignment !== null && y.assignment.stoneId === U) && O("state.affinityGarden.assignment.stoneId", "stone has another background assignment"), te(R.assignedAt, "state.affinityGarden.assignment.assignedAt"), te(R.lastProcessedAt, "state.affinityGarden.assignment.lastProcessedAt"), C(R.affinityPerHour, "state.affinityGarden.assignment.affinityPerHour", { min: 1, max: 100, integer: !0 }), C(R.bankedMs, "state.affinityGarden.assignment.bankedMs", { min: 0, max: 720 * 60 * 60 * 1e3, integer: !0 }), C(R.totalClaimedAffinity, "state.affinityGarden.assignment.totalClaimedAffinity", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  }
  const M = B(t.research, "state.research"), N = ["GEOLOGY_SURVEY", "GENETIC_ARCHIVE", "EXPEDITION_LOGISTICS"];
  if (M.slot !== null) {
    const R = B(M.slot, "state.research.slot");
    $(R.researchId, "state.research.slot.researchId", { min: 1, max: 256 }), V(R.projectId, N, "state.research.slot.projectId"), $(R.seed, "state.research.slot.seed", { min: 1, max: 1024 }), te(R.startedAt, "state.research.slot.startedAt"), te(R.completesAt, "state.research.slot.completesAt");
    const U = V(R.status, ["ACTIVE", "READY", "CLAIMED"], "state.research.slot.status");
    te(R.claimedAt, "state.research.slot.claimedAt", !0), U === "CLAIMED" != (R.claimedAt !== null) && O("state.research.slot.claimedAt", "must agree with research status");
  }
  me(M.completedProjectIds, "state.research.completedProjectIds", N.length).forEach((R, U) => V(R, N, `state.research.completedProjectIds[${U}]`));
  const L = B(M.claimLedger, "state.research.claimLedger");
  for (const [R, U] of Object.entries(L)) (!R || R.length > 256 || U !== !0) && O(`state.research.claimLedger.${R}`, "expected an exact research ID mapped to true");
  const G = B(t.idle, "state.idle"), H = B(G.timeCheckpoint, "state.idle.timeCheckpoint");
  C(H.version, "state.idle.timeCheckpoint.version", { min: 1, max: 1, integer: !0 });
  const q = C(H.trustedNowMs, "state.idle.timeCheckpoint.trustedNowMs", { min: 0, max: 864e13, integer: !0 }), K = C(H.wallHighWaterMs, "state.idle.timeCheckpoint.wallHighWaterMs", { min: 0, max: 864e13, integer: !0 });
  q > K && O("state.idle.timeCheckpoint", "trusted time cannot exceed wall high-water"), C(H.reconciliationCount, "state.idle.timeCheckpoint.reconciliationCount", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const ue = B(G.scheduler, "state.idle.scheduler");
  C(ue.version, "state.idle.scheduler.version", { min: 1, max: 1, integer: !0 });
  const F = /* @__PURE__ */ new Set();
  if (me(ue.jobs, "state.idle.scheduler.jobs", 256).forEach((R, U) => {
    const v = `state.idle.scheduler.jobs[${U}]`, D = B(R, v), Ie = $(D.id, `${v}.id`, { min: 1, max: 512 });
    F.has(Ie) && O(`${v}.id`, "duplicate scheduler job"), F.add(Ie);
    const Ye = C(D.dueAtMs, `${v}.dueAtMs`, { min: 0, max: 864e13, integer: !0 }), it = D.repeatEveryMs === void 0 ? void 0 : C(D.repeatEveryMs, `${v}.repeatEveryMs`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }), De = D.endAtMs === void 0 ? void 0 : C(D.endAtMs, `${v}.endAtMs`, { min: 0, max: 864e13, integer: !0 });
    De !== void 0 && it === void 0 && O(`${v}.endAtMs`, "requires repeatEveryMs"), De !== void 0 && De < Ye && O(`${v}.endAtMs`, "cannot precede dueAtMs"), D.sequence !== void 0 && C(D.sequence, `${v}.sequence`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
    const ye = B(D.payload, `${v}.payload`), ke = V(ye.kind, ["EXPEDITION", "TRAINING", "AFFINITY_GARDEN", "RESEARCH", "ENDLESS_MINE"], `${v}.payload.kind`);
    ke === "EXPEDITION" ? (wn(ye, ["kind", "expeditionId"], `${v}.payload`), $(ye.expeditionId, `${v}.payload.expeditionId`, { min: 1, max: 256 })) : ke === "RESEARCH" ? (wn(ye, ["kind", "researchId"], `${v}.payload`), $(ye.researchId, `${v}.payload.researchId`, { min: 1, max: 256 })) : ke === "ENDLESS_MINE" ? (wn(ye, ["kind", "runId"], `${v}.payload`), $(ye.runId, `${v}.payload.runId`, { min: 1, max: 512 })) : (wn(ye, ["kind", "stoneId"], `${v}.payload`), $(ye.stoneId, `${v}.payload.stoneId`, { min: 1, max: 256 }));
  }), te(G.lastProcessedAt, "state.idle.lastProcessedAt"), te(G.lastActiveAt, "state.idle.lastActiveAt"), G.lastWelcomeBack !== null) {
    const R = B(G.lastWelcomeBack, "state.idle.lastWelcomeBack");
    $(R.summaryId, "state.idle.lastWelcomeBack.summaryId", { min: 1, max: 512 }), te(R.from, "state.idle.lastWelcomeBack.from"), te(R.to, "state.idle.lastWelcomeBack.to");
    for (const U of ["elapsedMs", "expeditionCycles", "trainingXpReady", "affinityReady", "endlessFloors", "endlessCredits", "equipmentAdded", "equipmentSalvaged", "rareDiscoveries"]) C(R[U], `state.idle.lastWelcomeBack.${U}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
    Se(R.capped, "state.idle.lastWelcomeBack.capped"), Se(R.rollbackDetected, "state.idle.lastWelcomeBack.rollbackDetected"), Se(R.researchReady, "state.idle.lastWelcomeBack.researchReady"), te(R.createdAt, "state.idle.lastWelcomeBack.createdAt");
  }
  const z = B(t.inventory, "state.inventory"), se = B(z.currencies, "state.inventory.currencies");
  for (const R of ["credits", "gachaTickets", "researchCores", "upgradeDust"]) C(se[R], `state.inventory.currencies.${R}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  for (const [R, U] of Object.entries(se)) C(U, `state.inventory.currencies.${R}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  kt(z.items, "state.inventory.items");
  const _e = B(z.equipment, "state.inventory.equipment");
  for (const [R, U] of Object.entries(_e))
    sr(U, `state.inventory.equipment.${R}`), U.instanceId !== R && O(`state.inventory.equipment.${R}`, "map key must equal instanceId");
  C(z.capacity, "state.inventory.capacity", { min: h.size, max: 1e6, integer: !0 });
  const Ne = me(t.unappraisedFinds, "state.unappraisedFinds", 1e5), Le = /* @__PURE__ */ new Set();
  Ne.forEach((R, U) => {
    const v = `state.unappraisedFinds[${U}]`, D = B(R, v), Ie = $(D.discoveryId, `${v}.discoveryId`, { min: 1, max: 256 });
    Le.has(Ie) && O(`${v}.discoveryId`, "duplicate discovery ID"), Le.add(Ie), $(D.seed, `${v}.seed`, { min: 1, max: 1024 }), $(D.veinId, `${v}.veinId`, { min: 1, max: 256 }), $(D.areaId, `${v}.areaId`, { min: 1, max: 256 }), te(D.discoveredAt, `${v}.discoveredAt`), V(D.hintedRarity, et, `${v}.hintedRarity`);
    const Ye = $(D.sourceEventId, `${v}.sourceEventId`, { min: 1, max: 128 });
    Object.prototype.hasOwnProperty.call(l, Ye) || O(`${v}.sourceEventId`, "does not exist in the Farm event ledger");
  });
  const I = B(t.collection, "state.collection");
  he(I.discoveredSpeciesIds, "state.collection.discoveredSpeciesIds", { max: 1e5, unique: !0 });
  const x = B(I.mutationSpecies, "state.collection.mutationSpecies");
  for (const [R, U] of Object.entries(x)) me(U, `state.collection.mutationSpecies.${R}`, 5).forEach((v, D) => V(v, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `state.collection.mutationSpecies.${R}[${D}]`));
  const X = B(I.variantSpecies, "state.collection.variantSpecies");
  for (const [R, U] of Object.entries(X)) me(U, `state.collection.variantSpecies.${R}`, 4).forEach((v, D) => V(v, ["STANDARD", "SHINY", "AURORA", "OBSIDIAN"], `state.collection.variantSpecies.${R}[${D}]`));
  kt(I.origins, "state.collection.origins"), me(t.fusionHistory, "state.fusionHistory", 1e5).forEach((R, U) => {
    const v = `state.fusionHistory[${U}]`, D = B(R, v);
    $(D.id, `${v}.id`, { min: 1, max: 256 }), he(D.parentIds, `${v}.parentIds`, { max: 4, unique: !0 }).length < 2 && O(`${v}.parentIds`, "fusion requires at least two parents"), $(D.childId, `${v}.childId`, { min: 1, max: 256 }), $(D.recipeId, `${v}.recipeId`, { nullable: !0, max: 256 }), he(D.catalystIds, `${v}.catalystIds`, { max: 16, unique: !0 }), he(D.inheritedTraits, `${v}.inheritedTraits`, { max: 8, unique: !0 }), he(D.inheritedSkills, `${v}.inheritedSkills`, { max: 6, unique: !0 }), V(D.mutation, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `${v}.mutation`), Se(D.consumeParents, `${v}.consumeParents`), te(D.createdAt, `${v}.createdAt`);
  });
  const Y = B(t.gacha, "state.gacha"), re = B(Y.pityByBanner, "state.gacha.pityByBanner");
  for (const [R, U] of Object.entries(re)) {
    const v = B(U, `state.gacha.pityByBanner.${R}`);
    C(v.pullsSinceSsr, `state.gacha.pityByBanner.${R}.pullsSinceSsr`, { min: 0, max: 1e6, integer: !0 }), C(v.lifetimePulls, `state.gacha.pityByBanner.${R}.lifetimePulls`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), Se(v.featuredGuaranteed, `state.gacha.pityByBanner.${R}.featuredGuaranteed`);
  }
  me(Y.history, "state.gacha.history", 1e3).forEach((R, U) => {
    const v = `state.gacha.history[${U}]`, D = B(R, v);
    $(D.id, `${v}.id`, { min: 1, max: 256 }), $(D.bannerId, `${v}.bannerId`, { min: 1, max: 256 }), $(D.stoneId, `${v}.stoneId`, { min: 1, max: 256 }), V(D.rarity, et, `${v}.rarity`), C(D.pullNumber, `${v}.pullNumber`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }), C(D.pityBefore, `${v}.pityBefore`, { min: 0, max: 1e6, integer: !0 }), Se(D.guaranteed, `${v}.guaranteed`), te(D.createdAt, `${v}.createdAt`);
  });
  const oe = B(Y.rarityCounts, "state.gacha.rarityCounts");
  for (const [R, U] of Object.entries(oe))
    V(R, et, `state.gacha.rarityCounts key ${R}`), C(U, `state.gacha.rarityCounts.${R}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const le = B(t.achievements, "state.achievements");
  for (const [R, U] of Object.entries(le)) {
    const v = B(U, `state.achievements.${R}`);
    C(v.value, `state.achievements.${R}.value`, { min: 0, max: Number.MAX_SAFE_INTEGER }), te(v.unlockedAt, `state.achievements.${R}.unlockedAt`, !0), te(v.claimedAt, `state.achievements.${R}.claimedAt`, !0), v.claimedAt !== null && v.unlockedAt === null && O(`state.achievements.${R}`, "claimed achievement must be unlocked");
  }
  const be = me(t.parties, "state.parties", 100);
  be.length === 0 && O("state.parties", "at least one party is required");
  const Ee = /* @__PURE__ */ new Set();
  be.forEach((R, U) => {
    const v = `state.parties[${U}]`, D = B(R, v), Ie = $(D.id, `${v}.id`, { min: 1, max: 256 });
    Ee.has(Ie) && O(`${v}.id`, "duplicate party ID"), Ee.add(Ie), $(D.name, `${v}.name`, { min: 1, max: 64 }), Se(D.defense, `${v}.defense`);
    const Ye = /* @__PURE__ */ new Set();
    me(D.slots, `${v}.slots`, 3).forEach((it, De) => {
      const ye = B(it, `${v}.slots[${De}]`), ke = $(ye.stoneId, `${v}.slots[${De}].stoneId`, { min: 1, max: 256 });
      h.has(ke) || O(`${v}.slots[${De}].stoneId`, "references a missing stone"), Ye.has(ke) && O(`${v}.slots`, "contains a duplicate stone"), Ye.add(ke), V(ye.position, ["FRONT", "BACK", "SUPPORT"], `${v}.slots[${De}].position`);
    });
  });
  const nt = $(t.activePartyId, "state.activePartyId", { min: 1, max: 256 });
  Ee.has(nt) || O("state.activePartyId", "references a missing party"), t.activeBattle === null || Kr(t.activeBattle, "state.activeBattle", h, { active: !0 });
  const Wt = /* @__PURE__ */ new Set();
  me(t.battleHistory, "state.battleHistory", 100).forEach((R, U) => {
    const v = Kr(R, `state.battleHistory[${U}]`, h, { active: !1 });
    Wt.has(v.battleId) && O(`state.battleHistory[${U}].battleId`, "duplicate battle ID"), Wt.add(v.battleId);
  });
  const En = B(t.dungeonClears, "state.dungeonClears");
  for (const [R, U] of Object.entries(En)) {
    const v = B(U, `state.dungeonClears.${R}`);
    C(v.bestTurns, `state.dungeonClears.${R}.bestTurns`, { min: 1, max: 100, integer: !0 }), C(v.clearCount, `state.dungeonClears.${R}.clearCount`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }), te(v.firstClearedAt, `state.dungeonClears.${R}.firstClearedAt`);
  }
  const It = B(t.profile, "state.profile");
  for (const R of he(It.showcaseStoneIds, "state.profile.showcaseStoneIds", { max: 6, unique: !0 })) h.has(R) || O("state.profile.showcaseStoneIds", "references a missing stone");
  for (const R of he(It.favoriteStoneIds, "state.profile.favoriteStoneIds", { max: 12, unique: !0 })) h.has(R) || O("state.profile.favoriteStoneIds", "references a missing stone");
  C(It.totalAffinity, "state.profile.totalAffinity", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), Se(It.public, "state.profile.public");
  const gn = B(t.statistics, "state.statistics");
  for (const R of ["fusionCount", "mutationCount", "rareDiscoveryCount", "battleWins", "battleLosses", "highestInfiniteFloor", "totalRaidDamage"]) C(gn[R], `state.statistics.${R}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const rt = B(t.online, "state.online");
  Se(rt.connected, "state.online.connected"), $(rt.sessionId, "state.online.sessionId", { min: 1, max: 256 });
  const Kt = C(rt.sequence, "state.online.sequence", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), Me = /* @__PURE__ */ new Set();
  me(rt.queue, "state.online.queue", 1e5).forEach((R, U) => {
    const v = `state.online.queue[${U}]`, D = B(R, v), Ie = $(D.eventId, `${v}.eventId`, { min: 1, max: 256 });
    Me.has(Ie) && O(`${v}.eventId`, "duplicate queued event"), Me.add(Ie), $(D.sessionId, `${v}.sessionId`, { min: 1, max: 256 }), C(D.sequence, `${v}.sequence`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }) > Kt && O(`${v}.sequence`, "exceeds online sequence"), te(D.timestamp, `${v}.timestamp`), $(D.accountId, `${v}.accountId`, { min: 1, max: 128 }) !== r && O(`${v}.accountId`, "does not match account"), V(D.kind, ["MINING_RECORDED", "STONE_CREATED", "STONE_EVOLVED", "STONE_FUSED", "BATTLE_FINISHED", "ACHIEVEMENT_UNLOCKED", "PROFILE_UPDATED", "RANK_REQUESTED"], `${v}.kind`), D.payload === void 0 && O(`${v}.payload`, "payload is required"), C(D.attempts, `${v}.attempts`, { min: 0, max: 1e3, integer: !0 }), te(D.nextAttemptAt, `${v}.nextAttemptAt`);
  });
  const zt = /* @__PURE__ */ new Set();
  me(rt.processedReceipts, "state.online.processedReceipts", 2e3).forEach((R, U) => {
    const v = `state.online.processedReceipts[${U}]`, D = B(R, v), Ie = $(D.eventId, `${v}.eventId`, { min: 1, max: 256 });
    zt.has(Ie) && O(`${v}.eventId`, "duplicate receipt"), Me.has(Ie) && O(`${v}.eventId`, "event cannot be both queued and acknowledged"), zt.add(Ie), te(D.processedAt, `${v}.processedAt`), $(D.checksum, `${v}.checksum`, { min: 1, max: 256 });
  }), te(rt.lastSyncedAt, "state.online.lastSyncedAt", !0);
  const Qe = B(t.settings, "state.settings");
  V(Qe.effectQuality, ["LOW", "MEDIUM", "HIGH", "ULTRA"], "state.settings.effectQuality"), Se(Qe.reduceMotion, "state.settings.reduceMotion"), Se(Qe.mute, "state.settings.mute"), C(Qe.masterVolume, "state.settings.masterVolume", { min: 0, max: 1 }), C(Qe.musicVolume, "state.settings.musicVolume", { min: 0, max: 1 }), C(Qe.effectsVolume, "state.settings.effectsVolume", { min: 0, max: 1 }), C(Qe.textScale, "state.settings.textScale", { min: 0.8, max: 1.5 }), Se(Qe.developerMode, "state.settings.developerMode"), te(t.createdAt, "state.createdAt"), te(t.updatedAt, "state.updatedAt");
  const Z = t;
  for (const R of Object.values(Z.stones)) R.stats = Ke(R);
  return Z;
}, zr = (e, t) => {
  if (!ce(e)) throw new Error("Save state must be an object");
  if (typeof e.schemaVersion != "number") throw new Error("Legacy raw saves require an explicit schemaVersion");
  const n = e.schemaVersion;
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Save schemaVersion must be a positive integer");
  if (n > Ge) throw new Error(`Save schema ${n} is newer than this client`);
  if (n === Ge && !t) throw new Error(`Raw schema ${Ge} saves are not accepted; a checksummed STONEVERSE_SAVE envelope is required`);
  if (n === 4 && !t) throw new Error("Raw schema 4 saves are not accepted; the checksummed v4 STONEVERSE_SAVE envelope is required");
  const r = { ...e };
  if (n < 2 && (r.facilities ??= { fusionLab: 1, researchLab: 1, expeditionGuild: 1 }, r.statistics ??= { fusionCount: 0, mutationCount: 0, rareDiscoveryCount: 0, battleWins: 0, battleLosses: 0, highestInfiniteFloor: 0, totalRaidDamage: 0 }, r.online ??= { connected: !0, sessionId: "migrated_session", sequence: 0, queue: [], processedReceipts: [], lastSyncedAt: null }), n < 3 && (r.activeBattle ??= null, r.dungeonClears ??= {}, r.unappraisedFinds ??= []), n < 4) {
    const l = ce(r.mining) ? { ...r.mining } : {}, d = ce(r.online) ? r.online : {}, u = Array.isArray(d.processedReceipts) ? d.processedReceipts : [], h = {};
    for (const w of u)
      !ce(w) || typeof w.eventId != "string" || w.eventId.startsWith("sync_") || Object.defineProperty(h, w.eventId, { value: !0, enumerable: !0, configurable: !0, writable: !0 });
    l.processedFarmEventIds = h, r.mining = l;
  }
  if (n < 5) {
    const d = [r.updatedAt, ce(r.account) ? r.account.lastOnlineAt : void 0, r.createdAt].find((h) => typeof h == "string" && Number.isFinite(Date.parse(h))), u = d ? new Date(d) : de.now();
    r.expeditions ??= { runs: {}, order: [], discoveryStorage: [], overflowDiscarded: 0, totalCycles: 0, totalClaims: 0 }, r.training ??= { assignment: null }, r.affinityGarden ??= { assignment: null }, r.research ??= { slot: null, completedProjectIds: [], claimLedger: {} }, r.idle ??= Yc(u);
  }
  const i = [r.updatedAt, r.createdAt].find((l) => typeof l == "string" && Number.isFinite(Date.parse(l))), s = i ? new Date(i) : de.now();
  r.endlessMine ??= Ni(s), r.mastery ??= Li(), ce(r.idle) && ce(r.idle.lastWelcomeBack) && (r.idle.lastWelcomeBack.endlessFloors ??= 0, r.idle.lastWelcomeBack.endlessCredits ??= 0, r.idle.lastWelcomeBack.equipmentAdded ??= 0, r.idle.lastWelcomeBack.equipmentSalvaged ??= 0, r.idle.lastWelcomeBack.rareDiscoveries ??= 0), r.schemaVersion = Ge;
  const o = n < Ge, a = o ? el(r) : r;
  if (a.schemaVersion = Ge, o) {
    a.stones = ce(r.stones) ? r.stones : a.stones, a.unappraisedFinds = Array.isArray(r.unappraisedFinds) ? r.unappraisedFinds : a.unappraisedFinds, a.fusionHistory = Array.isArray(r.fusionHistory) ? r.fusionHistory : a.fusionHistory, a.parties = Array.isArray(r.parties) ? r.parties : a.parties, a.battleHistory = Array.isArray(r.battleHistory) ? r.battleHistory : a.battleHistory, a.achievements = ce(r.achievements) ? r.achievements : a.achievements, a.dungeonClears = ce(r.dungeonClears) ? r.dungeonClears : a.dungeonClears, a.expeditions.runs = ce(a.expeditions.runs) ? a.expeditions.runs : {}, a.expeditions.order = Array.isArray(a.expeditions.order) ? a.expeditions.order : [], a.expeditions.discoveryStorage = Array.isArray(a.expeditions.discoveryStorage) ? a.expeditions.discoveryStorage : [], a.research.completedProjectIds = Array.isArray(a.research.completedProjectIds) ? a.research.completedProjectIds : [], a.research.claimLedger = ce(a.research.claimLedger) ? a.research.claimLedger : {}, a.idle.scheduler.jobs = Array.isArray(a.idle.scheduler.jobs) ? a.idle.scheduler.jobs : [], a.online.queue = Array.isArray(a.online.queue) ? a.online.queue : [], a.online.processedReceipts = Array.isArray(a.online.processedReceipts) ? a.online.processedReceipts : [], a.collection.discoveredSpeciesIds = Array.isArray(a.collection.discoveredSpeciesIds) ? [...new Set(a.collection.discoveredSpeciesIds)] : [], a.collection.mutationSpecies = ce(a.collection.mutationSpecies) ? a.collection.mutationSpecies : {}, a.collection.variantSpecies = ce(a.collection.variantSpecies) ? a.collection.variantSpecies : {}, a.collection.origins = ce(a.collection.origins) ? a.collection.origins : {};
    const l = Object.keys(a.stones).length;
    if (l > 1e6) throw new Error("Legacy save exceeds the maximum Stone capacity");
    Number.isSafeInteger(a.inventory.capacity) && a.inventory.capacity >= 0 && a.inventory.capacity <= 1e6 && (a.inventory.capacity = Math.max(a.inventory.capacity, l));
    const d = ce(a.mining.processedFarmEventIds) ? a.mining.processedFarmEventIds : {}, u = {};
    for (const h of Object.keys(d)) Object.defineProperty(u, h, { value: !0, enumerable: !0, configurable: !0, writable: !0 });
    for (const h of a.unappraisedFinds)
      ce(h) && typeof h.sourceEventId == "string" && Object.defineProperty(u, h.sourceEventId, { value: !0, enumerable: !0, configurable: !0, writable: !0 });
    a.mining.processedFarmEventIds = u;
    for (const h of Object.values(a.stones))
      if (ce(h)) {
        for (const w of ["parents", "grandparents"])
          if (Array.isArray(h[w]))
            for (const E of h[w]) ce(E) && !Array.isArray(E.traitIds) && (E.traitIds = []);
      }
  }
  return ss(a);
}, os = (e, t = de) => {
  let n;
  try {
    n = JSON.parse(JSON.stringify(e));
  } catch {
    throw new Error("Game state is not JSON serializable");
  }
  ss(n);
  const r = {
    format: "STONEVERSE_SAVE",
    schemaVersion: Ge,
    savedAt: t.now().toISOString(),
    checksum: Mn(n),
    state: n
  };
  return JSON.stringify(r, null, 2);
}, on = (e) => {
  if (e.length > 2e7) throw new Error("Save exceeds the 20 MB safety limit");
  let t;
  try {
    t = JSON.parse(e);
  } catch {
    throw new Error("Save is not valid JSON");
  }
  if (!ce(t)) throw new Error("Save envelope must be an object");
  if (t.format === "STONEVERSE_SAVE") {
    if (!ce(t.state)) throw new Error("Save envelope has no state");
    const r = C(t.schemaVersion, "envelope.schemaVersion", { min: 1, max: Ge, integer: !0 }), i = C(t.state.schemaVersion, "envelope.state.schemaVersion", { min: 1, max: Ge, integer: !0 });
    if (r !== i) throw new Error("Save envelope schemaVersion does not match its state");
    te(t.savedAt, "envelope.savedAt");
    const s = $(t.checksum, "envelope.checksum", { min: 8, max: 8 });
    if (!s || !/^[0-9a-f]{8}$/i.test(s)) throw new Error("Save envelope checksum is invalid");
    if (Mn(t.state) !== s) throw new Error("Save checksum mismatch");
    return zr(t.state, !0);
  }
  if (typeof t.schemaVersion != "number") throw new Error("Legacy raw saves require an explicit schemaVersion");
  const n = t.schemaVersion;
  if (n >= 4) throw new Error(`Raw schema ${n} saves require their original checksummed STONEVERSE_SAVE envelope`);
  return zr(t, !1);
}, tl = (e, t, n = de) => {
  const r = os(t, n), i = e.getItem($t), s = e.getItem(en);
  try {
    e.setItem(tn, r);
    const o = e.getItem(tn);
    if (!o) throw new Error("Storage did not retain pending save");
    if (on(o), i)
      try {
        on(i), e.setItem(en, i);
      } catch {
      }
    e.setItem($t, o);
    const a = e.getItem($t);
    if (!a) throw new Error("Storage did not retain committed save");
    on(a), e.removeItem(tn);
  } catch (o) {
    try {
      i === null ? e.removeItem($t) : e.setItem($t, i);
    } catch {
    }
    try {
      s === null ? e.removeItem(en) : e.setItem(en, s);
    } catch {
    }
    try {
      e.removeItem(tn);
    } catch {
    }
    throw o;
  }
}, as = (e) => {
  const t = [];
  let n = 0;
  for (const i of [$t, tn, en, ...Xc])
    try {
      const s = e.getItem(i);
      s && t.push(s);
    } catch {
      n += 1;
    }
  let r = 0;
  for (const i of t)
    try {
      return { state: on(i), invalidReadableCandidates: r, unreadableSlots: n };
    } catch {
      r += 1;
    }
  return { state: null, invalidReadableCandidates: r, unreadableSlots: n };
}, nl = (e) => as(e).state, rl = (e = {}) => (t, n) => {
  const r = e.clock ?? de, i = e.storage === void 0 ? Wc() : e.storage;
  let s = i !== null;
  const o = (p) => {
    if (!i)
      throw s = !1, new Error("Local persistence is unavailable; this session cannot be saved");
    try {
      tl(i, p, r), s = !0;
    } catch (f) {
      throw s = !1, f;
    }
  }, a = e.autoSave ?? !0, l = e.rng, d = () => e.rngFactory?.() ?? l ?? new lr(), u = i ? as(i) : { state: null, invalidReadableCandidates: 0 }, h = u.state;
  let w = !h && u.invalidReadableCandidates > 0;
  const E = e.initialState ?? h ?? Jn({ ...e.newGame, clock: r });
  let m = st(E), A = w ? "保存データを検証できません。破損スロットを保護するため、Importまたは明示的なResetまで書き込みを停止しました。" : null;
  try {
    An(m, r), h && a && i && o(m);
  } catch (p) {
    m = st(E), A = p instanceof Error ? p.message : String(p);
  }
  const S = (p, f = { mode: "ACTIVE" }) => {
    let y, b;
    if (t((M) => {
      try {
        const N = st(M.game), L = An(N, r, f), G = { now: () => new Date(N.idle.timeCheckpoint.trustedNowMs) };
        if (y = p(N, d(), G, L), Ve(N), ra(N, G), a && i) {
          if (w) throw new Error("Corrupt save recovery is write-protected; import a valid save or explicitly reset");
          o(N);
        }
        return { ...M, game: N, persistenceAvailable: s, lastError: null };
      } catch (N) {
        return b = N, { ...M, persistenceAvailable: s, lastError: N instanceof Error ? N.message : String(N) };
      }
    }), b) throw b;
    return y;
  }, k = (p, f) => {
    const y = p.stones[f];
    if (!y) throw new Error(`Stone not found: ${f}`);
    return y;
  }, T = (p, f, y) => {
    const b = p.battleHistory.some((M) => M.battleId === f.battleId);
    f.winner && (oc(p, f, r), b || At(p, "BATTLE_FINISHED", { battleId: f.battleId, mode: f.mode, winner: f.winner, turns: f.turn }, y, r, `sync_battle_${f.battleId}`));
  };
  return {
    game: m,
    route: "HOME",
    selectedStoneId: null,
    farmSessionActive: void 0,
    persistenceAvailable: s,
    lastError: A,
    mine: (p, f) => Zn(n().game, p, r, f).valid ? S((b, M) => {
      const N = Zn(b, p, r, f), L = Ma(b, p, M, r, f);
      return L.accepted && At(b, "MINING_RECORDED", {
        amount: N.amount,
        quality: N.quality,
        areaId: p.areaId ?? "area_greenbreak",
        veinId: p.veinId ?? null,
        source: {
          eventId: p.eventId,
          sessionId: p.sessionId ?? b.online.sessionId,
          timestamp: N.sourceTimestamp,
          metadata: N.metadata ?? {}
        }
      }, M, r, `sync_mining_${p.eventId}`), L;
    }) : { accepted: !1, duplicate: !1, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 },
    appraise: (p) => S((f, y) => {
      const b = ba(f, p, r);
      return At(f, "STONE_CREATED", { stoneId: b.stone.instanceId, speciesId: b.stone.speciesId, rarity: b.stone.rarity, origin: b.stone.origin }, y, r, `sync_stone_${b.stone.instanceId}`), b;
    }),
    pullGacha: (p, f) => S((y, b) => xa(y, p, f, b, r)),
    fuse: (p, f = {}) => S((y, b) => {
      if (f.consumeParents) {
        const N = /* @__PURE__ */ new Set([
          ...Object.values(y.expeditions.runs).filter((L) => L.status !== "CLAIMED").flatMap((L) => L.partySnapshot.map((G) => G.stoneId)),
          ...y.training.assignment ? [y.training.assignment.stoneId] : [],
          ...y.affinityGarden.assignment ? [y.affinityGarden.assignment.stoneId] : [],
          ...y.endlessMine.status === "RUNNING" || y.endlessMine.status === "PAUSED" ? y.endlessMine.partyStoneIds : [],
          ...y.activeBattle && !y.activeBattle.winner ? y.activeBattle.units.filter((L) => L.team === "PLAYER").map((L) => L.stoneId) : []
        ]);
        if (p.some((L) => N.has(L))) throw new Error("A stone assigned to a background activity cannot be consumed");
      }
      const M = Ga(y, p, f, b, r);
      return At(y, "STONE_FUSED", { fusionId: M.history.id, parentIds: M.history.parentIds, childId: M.child.instanceId, recipeId: M.history.recipeId }, b, r, `sync_fusion_${M.history.id}`), M;
    }),
    addStoneXp: (p, f) => S((y) => wr(k(y, p), y.mastery, f)),
    addAffinity: (p, f) => S((y) => {
      const b = xn(k(y, p), f);
      return y.profile.totalAffinity = Object.values(y.stones).reduce((M, N) => M + N.affinity.points, 0), b;
    }),
    evolve: (p, f, y) => S((b, M) => {
      const N = k(b, p), L = {
        items: b.inventory.items,
        areaId: y,
        achievementIds: Object.entries(b.achievements).filter(([, K]) => !!K.unlockedAt).map(([K]) => K),
        fusionCount: b.statistics.fusionCount,
        timestamp: r.now()
      }, G = Rs(N, L).find((K) => K.id === f);
      if (!G) throw new Error("Evolution conditions are not met");
      const H = Object.fromEntries(G.conditions.filter((K) => K.kind === "ITEM").map((K) => [String(K.value), K.amount ?? 1]));
      jt(b, { ...G.cost, items: { ...H, ...G.cost?.items ?? {} } });
      const q = bs(N, G);
      return At(b, "STONE_EVOLVED", { stoneId: p, previousSpeciesId: q.previousSpeciesId, speciesId: q.stone.speciesId, evolutionId: f }, M, r, `sync_evolution_${p}_${N.evolutionStage}`), q;
    }),
    awaken: (p) => S((f) => {
      const y = k(f, p);
      jt(f, { currencies: { upgradeDust: 100 * (y.awakeningStage + 1) } }), Ts(y);
    }),
    reincarnate: (p) => S((f) => Ns(k(f, p))),
    learnSkillNode: (p, f) => S((y) => _s(k(y, p), f)),
    toggleFavorite: (p) => S((f) => {
      const y = k(f, p);
      y.favorite = !y.favorite, f.profile.favoriteStoneIds = y.favorite ? [.../* @__PURE__ */ new Set([...f.profile.favoriteStoneIds, p])].slice(0, 12) : f.profile.favoriteStoneIds.filter((b) => b !== p);
    }),
    toggleLock: (p) => S((f) => {
      const y = k(f, p);
      y.locked = !y.locked;
    }),
    setNickname: (p, f) => S((y) => {
      const b = f?.trim() || null;
      if (b && b.length > 20) throw new Error("Nickname must be 20 characters or fewer");
      k(y, p).nickname = b;
    }),
    setParty: (p, f = n().game.activePartyId) => S((y) => {
      if (p.length < 1 || p.length > 3 || new Set(p).size !== p.length) throw new Error("A party requires 1-3 unique stones");
      for (const M of p) k(y, M);
      const b = y.parties.find((M) => M.id === f);
      if (!b) throw new Error("Party not found");
      b.slots = p.map((M, N) => ({ stoneId: M, position: N === 0 ? "FRONT" : "BACK" })), y.activePartyId = b.id;
    }),
    startDungeonBattle: (p, f) => S((y, b) => {
      const M = y.parties.find((G) => G.id === y.activePartyId), N = /* @__PURE__ */ new Set([
        ...Object.values(y.expeditions.runs).filter((G) => G.status !== "CLAIMED").flatMap((G) => G.partySnapshot.map((H) => H.stoneId)),
        ...y.training.assignment ? [y.training.assignment.stoneId] : [],
        ...y.affinityGarden.assignment ? [y.affinityGarden.assignment.stoneId] : [],
        ...y.endlessMine.status === "RUNNING" || y.endlessMine.status === "PAUSED" ? y.endlessMine.partyStoneIds : []
      ]);
      if (M?.slots.some((G) => N.has(G.stoneId))) throw new Error("A deployed Stone cannot enter a dungeon battle");
      const L = Xa(y, p, f, b, r);
      return y.activeBattle = L, L;
    }),
    advanceBattle: () => S((p, f) => {
      if (!p.activeBattle) throw new Error("No active battle");
      const y = rc(p.activeBattle, f, r);
      return T(p, p.activeBattle, f), y;
    }),
    issueBattleCommand: (p, f) => S((y, b, M) => {
      if (!y.activeBattle) throw new Error("No active battle");
      if (y.activeBattle.controlMode === "AUTO") throw new Error("Switch to MANUAL before issuing a command");
      const N = ic(y.activeBattle, p, f, b, M);
      return T(y, y.activeBattle, b), N;
    }),
    setBattleAuto: (p) => S((f) => {
      if (!f.activeBattle || f.activeBattle.winner) throw new Error("No active battle");
      f.activeBattle.controlMode = p ? "AUTO" : "MANUAL";
    }),
    setBattleSpeed: (p) => S((f) => {
      if (![1, 2, 4].includes(p)) throw new Error("Battle speed must be 1x, 2x, or 4x");
      if (!f.activeBattle) throw new Error("No active battle");
      f.activeBattle.speed = p;
    }),
    runActiveBattle: () => S((p, f) => {
      if (!p.activeBattle) throw new Error("No active battle");
      return sc(p.activeBattle, f, r), T(p, p.activeBattle, f), p.activeBattle;
    }),
    abandonBattle: () => S((p) => {
      p.activeBattle = null;
    }),
    claimAchievement: (p) => S((f) => ha(f, p, r)),
    processBackground: (p = "OFFLINE") => S((f, y, b, M) => M, { mode: p }),
    nextBackgroundDueAtMs: () => {
      const p = n().game.idle.scheduler.jobs.map((f) => f.dueAtMs).filter(Number.isSafeInteger);
      return p.length ? Math.min(...p) : null;
    },
    dismissWelcomeBack: (p) => S((f) => {
      f.idle.lastWelcomeBack?.summaryId === p && (f.idle.lastWelcomeBack = null);
    }),
    startExpedition: (p) => S((f, y, b) => {
      const M = Ac(f, p, y, b);
      return Ve(f), M;
    }),
    stopExpedition: (p) => S((f) => {
      const y = Sc(f, p);
      return Ve(f), y;
    }),
    claimExpedition: (p) => S((f, y, b) => {
      const M = f.expeditions.runs[p];
      if (!M) throw new Error("Expedition not found");
      const N = M.claimedCycles, L = _c(f, p, b), G = Object.entries(L.reward.items).filter(([F]) => F.startsWith("equipment_"));
      for (const [F, z] of G) {
        const se = Math.max(0, (f.inventory.items[F] ?? 0) - z);
        se === 0 ? delete f.inventory.items[F] : f.inventory.items[F] = se;
      }
      const H = { NORMAL: "COMMON", RARE: "UNCOMMON", SR: "RARE", SSR: "EPIC", UR: "LEGENDARY", LEGENDARY: "MYTHIC" }, q = (F) => F.endsWith("_charm") ? "CHARM" : F.endsWith("_rune") ? "RUNE" : F.endsWith("_relic") ? "RELIC" : "CORE", K = (F) => F.includes("abyssal") ? "ABYSSAL" : F.includes("meteor") ? "HUNTER" : F.includes("ancestor") ? "BASTION" : F.includes("resonance") || F.includes("celestial") ? "RESONANCE" : null;
      let ue = 0;
      for (const [F, z] of G) {
        const se = Gi(F);
        for (let _e = 0; _e < Math.min(1e4, z); _e += 1) {
          const Ne = se?.itemId ?? F, Le = se?.seed ?? `${M.seed}:equipment-claim:${N}:${ue}`;
          ue += 1;
          const I = Ai({
            level: Math.max(1, Math.max(...M.partySnapshot.map((x) => x.level))),
            source: `expedition-${M.regionId}`,
            ...se ? { rarity: H[se.rarity], slot: q(Ne), setId: K(Ne) } : {}
          }, new Re(Le));
          rn(f.endlessMine.equipment, I, f.endlessMine.lootFilter);
        }
      }
      return L;
    }),
    claimStoredExpeditionDiscovery: (p) => S((f, y, b) => kc(f, p, b)),
    startTraining: (p) => S((f, y, b) => {
      Dc(f, p, b.now()), Ve(f);
    }),
    claimTraining: () => S((p, f, y) => $c(p, y.now())),
    stopTraining: () => S((p) => {
      Pc(p), Ve(p);
    }),
    startAffinityGarden: (p) => S((f, y, b) => {
      Fc(f, p, b.now()), Ve(f);
    }),
    claimAffinityGarden: () => S((p, f, y) => Bc(p, y.now())),
    stopAffinityGarden: () => S((p) => {
      qc(p), Ve(p);
    }),
    startResearch: (p) => S((f, y, b) => {
      const M = Gc(f, p, y, b);
      return Ve(f), M;
    }),
    claimResearch: (p) => S((f, y, b) => Uc(f, p, b.now())),
    startEndlessMine: (p) => S((f, y, b) => {
      const M = f.parties.find((H) => H.id === f.activePartyId), N = [...p ?? M?.slots.map((H) => H.stoneId) ?? []], L = /* @__PURE__ */ new Set();
      for (const H of Object.values(f.expeditions.runs)) if (H.status !== "CLAIMED") for (const q of H.partySnapshot) L.add(q.stoneId);
      if (f.training.assignment && L.add(f.training.assignment.stoneId), f.affinityGarden.assignment && L.add(f.affinityGarden.assignment.stoneId), f.activeBattle && !f.activeBattle.winner)
        for (const H of f.activeBattle.units) H.team === "PLAYER" && L.add(H.stoneId);
      if (N.some((H) => L.has(H))) throw new Error("A deployed Stone cannot enter Endless Mine");
      const G = `endless:${f.account.accountId}:${b.now().getTime()}:${Math.floor(y.next() * 4294967296).toString(16)}`;
      Do(f.endlessMine, f.stones, N, b.now(), G), Ve(f);
    }),
    advanceEndlessMine: (p = 1) => S(
      (f, y, b) => Ci(f.endlessMine, p, b.now()),
      { mode: "ACTIVE", skipEndless: !0 }
    ),
    setEndlessManual: (p) => S((f) => $o(f.endlessMine, p)),
    setEndlessStrategy: (p) => S((f) => {
      if (!["BALANCED", "AGGRESSIVE", "DEFENSIVE", "BOSS_FOCUS", "RESOURCE_SAVE"].includes(p)) throw new Error("Unknown Endless AI strategy");
      f.endlessMine.strategy = p;
    }),
    setEndlessSpeed: (p) => S((f) => {
      if (![1, 2, 4].includes(p)) throw new Error("Unsupported battle speed");
      f.endlessMine.speed = p;
    }),
    issueEndlessCommand: (p, f) => S((y) => Fo(y.endlessMine, p, f)),
    pauseEndlessMine: () => S((p, f, y) => Go(p.endlessMine, y.now())),
    resumeEndlessMine: () => S((p, f, y) => Uo(p.endlessMine, y.now())),
    claimEndlessMine: () => S((p) => {
      const f = jo(p.endlessMine);
      return p.inventory.currencies.credits = Math.min(Number.MAX_SAFE_INTEGER, p.inventory.currencies.credits + f.credits), p.inventory.currencies.upgradeDust = Math.min(Number.MAX_SAFE_INTEGER, p.inventory.currencies.upgradeDust + f.upgradeDust), p.statistics.highestInfiniteFloor = Math.max(p.statistics.highestInfiniteFloor, f.highestFloor), f;
    }),
    updateEndlessLootFilter: (p) => S((f) => Ho(f.endlessMine, p)),
    salvageEndlessEquipment: (p) => S((f) => bo(f.endlessMine.equipment, p).materialsGained),
    equipEndlessEquipment: (p, f) => S((y) => {
      const b = k(y, f), M = y.endlessMine.equipment.items.findIndex((q) => q.id === p), N = y.endlessMine.equipment.items[M];
      if (!N) throw new Error("Endless equipment not found");
      const L = b.equipment[N.slot], G = { COMMON: "NORMAL", UNCOMMON: "RARE", RARE: "SR", EPIC: "SSR", LEGENDARY: "UR", MYTHIC: "LEGENDARY" }, H = { maxHp: "maxHp", attack: "power", defense: "defense", speed: "speed", accuracy: "purity", resistance: "hardness", critChance: "resonance", critDamage: "power", breakPower: "resonance", ultimateStart: "resonance" };
      if (b.equipment[N.slot] = {
        instanceId: N.id,
        definitionId: `${N.setId ?? "FIELD"}_${N.slot}`,
        slot: N.slot,
        level: N.level,
        rarity: G[N.rarity],
        setId: N.setId,
        locked: N.locked,
        affixes: N.affixes.map((q) => ({
          stat: H[q.stat],
          operation: ["maxHp", "attack", "defense"].includes(q.stat) ? "FLAT" : "PERCENT",
          value: q.value,
          sourceStat: q.stat
        }))
      }, y.endlessMine.equipment.items.splice(M, 1), L) {
        const q = Qn(L);
        rn(y.endlessMine.equipment, q, { autoSalvage: !1 }), delete y.inventory.equipment[L.instanceId];
      }
      b.stats = Ke(b);
    }),
    unequipEndlessEquipment: (p, f) => S((y) => {
      const b = k(y, f), M = Object.keys(b.equipment).find((L) => b.equipment[L]?.instanceId === p);
      if (!M) throw new Error("Equipped item was not found on this Stone");
      const N = b.equipment[M];
      if (!N) throw new Error("Equipped item was not found on this Stone");
      if (y.endlessMine.equipment.items.length >= y.endlessMine.equipment.capacity)
        throw new Error("Equipment storage is full; salvage an item before unequipping");
      rn(y.endlessMine.equipment, Qn(N), { autoSalvage: !1 }), delete b.equipment[M], delete y.inventory.equipment[N.instanceId], b.stats = Ke(b);
    }),
    setEndlessEquipmentLocked: (p, f) => S((y) => {
      const b = y.endlessMine.equipment.items.find((M) => M.id === p);
      if (b) {
        b.locked = f;
        return;
      }
      for (const M of Object.values(y.stones)) {
        const N = Object.values(M.equipment).find((L) => L?.instanceId === p);
        if (N) {
          N.locked = f;
          return;
        }
      }
      throw new Error("Equipment not found");
    }),
    setShowcase: (p) => S((f) => {
      if (p.length > 6 || new Set(p).size !== p.length) throw new Error("Showcase supports up to six unique stones");
      for (const y of p) k(f, y);
      f.profile.showcaseStoneIds = [...p];
    }),
    setRoute: (p, f = null) => t((y) => ({ ...y, route: p, selectedStoneId: f })),
    setFarmSessionActive: (p) => t((f) => ({ ...f, farmSessionActive: p })),
    updateSettings: (p) => S((f) => {
      f.settings = {
        ...f.settings,
        ...p,
        masterVolume: Math.max(0, Math.min(1, p.masterVolume ?? f.settings.masterVolume)),
        musicVolume: Math.max(0, Math.min(1, p.musicVolume ?? f.settings.musicVolume)),
        effectsVolume: Math.max(0, Math.min(1, p.effectsVolume ?? f.settings.effectsVolume)),
        textScale: Math.max(0.8, Math.min(1.5, p.textScale ?? f.settings.textScale))
      };
    }),
    addCurrency: (p, f) => S((y) => {
      if (!y.settings.developerMode) throw new Error("Developer mode is disabled");
      y.inventory.currencies[p] = Math.max(0, y.inventory.currencies[p] + Math.floor(f));
    }),
    createPerfectStone: (p) => S((f, y) => {
      if (!f.settings.developerMode) throw new Error("Developer mode is disabled");
      if (Object.keys(f.stones).length >= f.inventory.capacity) throw new Error("Stone storage is full");
      const b = fe[p];
      if (!b) throw new Error("Unknown species");
      const M = Ct({ species: b, origin: "EVENT", owner: { accountId: f.account.accountId, username: f.account.username }, rng: y, clock: r, mutation: "PERFECT" });
      return f.stones[M.instanceId] = M, hn(f, M), f.statistics.mutationCount += 1, At(f, "STONE_CREATED", { stoneId: M.instanceId, speciesId: M.speciesId, rarity: M.rarity, origin: M.origin }, y, r, `sync_stone_${M.instanceId}`), M.instanceId;
    }),
    queueOnlineEvent: (p, f, y) => S((b, M) => At(b, p, f, M, r, y)),
    syncOnline: async (p) => {
      const f = ac(n().game, r, 100);
      if (f.length === 0) return { sent: 0, accepted: 0, rejected: 0, remaining: n().game.online.queue.length, connected: n().game.online.connected };
      try {
        const y = await p.pushEvents(f);
        return S((b) => {
          const M = new Set(y.accepted.map((L) => L.eventId)), N = new Map(y.rejected.map((L) => [L.eventId, L]));
          for (const L of y.accepted)
            b.online.processedReceipts.some((G) => G.eventId === L.eventId) || b.online.processedReceipts.push(L);
          return b.online.queue = b.online.queue.filter((L) => {
            if (M.has(L.eventId)) return !1;
            const G = N.get(L.eventId);
            return G ? G.retryable ? (Yr(L, r), !0) : !1 : !0;
          }), b.online.connected = !0, b.online.lastSyncedAt = r.now().toISOString(), b.online.processedReceipts.length > 2e3 && b.online.processedReceipts.splice(0, b.online.processedReceipts.length - 2e3), { sent: f.length, accepted: y.accepted.length, rejected: y.rejected.length, remaining: b.online.queue.length, connected: !0 };
        });
      } catch {
        return S((y) => {
          const b = new Set(f.map((M) => M.eventId));
          for (const M of y.online.queue) b.has(M.eventId) && Yr(M, r);
          return y.online.connected = !1, { sent: f.length, accepted: 0, rejected: f.length, remaining: y.online.queue.length, connected: !1 };
        });
      }
    },
    setOnlineConnected: (p) => S((f) => {
      f.online.connected = p;
    }),
    exportSave: () => os(n().game, r),
    importSave: (p) => {
      const f = st(on(p));
      An(f, r), i && o(f), w = !1, t((y) => ({ ...y, game: f, persistenceAvailable: s, lastError: null }));
    },
    save: () => {
      try {
        if (w) throw new Error("Corrupt save recovery is write-protected; import a valid save or explicitly reset");
        o(n().game), t((p) => ({ ...p, persistenceAvailable: s, lastError: null }));
      } catch (p) {
        throw t((f) => ({ ...f, persistenceAvailable: s, lastError: p instanceof Error ? p.message : String(p) })), p;
      }
    },
    load: () => {
      if (!i) return !1;
      const p = nl(i);
      if (!p) return !1;
      const f = st(p);
      return An(f, r), a && o(f), t((y) => ({ ...y, game: f, persistenceAvailable: s, lastError: null })), !0;
    },
    resetGame: (p = {}) => {
      const f = Jn({ ...e.newGame, ...p, clock: r });
      i && o(f), w = !1, t((y) => ({ ...y, game: f, persistenceAvailable: s, route: "HOME", selectedStoneId: null, lastError: null }));
    },
    clearError: () => t((p) => ({ ...p, lastError: null }))
  };
}, il = ma(rl()), sl = il;
ar.map((e) => e.id);
const Qr = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "LEGEND"], ol = [
  "ENDLESS_FASTEST_CLEAR",
  "ENDLESS_FEWEST_DAMAGE"
], al = (e) => ol.includes(e), cl = (e) => typeof globalThis.structuredClone == "function" ? globalThis.structuredClone(e) : JSON.parse(JSON.stringify(e));
class ll {
  receipts = /* @__PURE__ */ new Map();
  authority = /* @__PURE__ */ new Map();
  profiles = /* @__PURE__ */ new Map();
  rng;
  leaderboardSeed;
  latencyMs;
  failureRate;
  now;
  constructor(t = {}) {
    const n = Math.max(0, Math.min(1e4, Math.floor(t.fakeUserCount ?? 1e3)));
    this.leaderboardSeed = t.seed ?? "stoneverse-mock-online", this.rng = new Re(this.leaderboardSeed), this.latencyMs = Math.max(0, t.latencyMs ?? 0), this.failureRate = Math.max(0, Math.min(1, t.failureRate ?? 0)), this.now = t.now ?? (() => /* @__PURE__ */ new Date()), this.seedProfiles(n);
  }
  seedProfiles(t) {
    const n = ["Obsidian", "Quartz", "Magma", "Echo", "Prism", "Granite", "Aurora", "Void", "Solar", "Tidal"], r = ["Keeper", "Smith", "Seeker", "Sage", "Rider", "Warden", "Miner", "Pulse", "Core", "Rune"];
    for (let i = 0; i < t; i += 1) {
      const s = `mock_${i.toString().padStart(5, "0")}`, o = this.rng.int(2, 100), a = Math.min(100, Math.max(1, o + this.rng.int(-12, 15))), l = Math.min(Qr.length - 1, Math.floor(o / 16)), d = Math.round(o ** 2.35 * (4 + this.rng.next() * 5)), u = Math.min(100, Math.round(o * (0.65 + this.rng.next() * 0.42))), h = Math.min(100, Math.round(o * (0.52 + this.rng.next() * 0.45))), w = {
        lifetimeDamage: Math.round(o ** 3 * (25 + this.rng.next() * 20)),
        bossesDefeated: Math.floor(o * this.rng.next()),
        bestContributionRank: this.rng.int(1, 500)
      }, E = Array.from({ length: this.rng.int(3, 6) }, (G, H) => `${s}_stone_${H}`), m = Math.max(1, Math.round(o ** 1.42 * (1.1 + this.rng.next()))), A = Math.min(m, Math.max(1, Math.round(m * (0.35 + this.rng.next() * 0.62)))), S = this.rng.int(0, 3), k = Math.round(o * (2 + this.rng.next() * 9)), T = w.bossesDefeated + Math.floor(m / 10), p = Math.round(o ** 1.55 * (1 + this.rng.next() * 2)), f = Math.round(o ** 2.12 * (18 + this.rng.next() * 12)), y = this.rng.int(0, Math.min(3, E.length)), b = this.rng.int(0, Math.max(0, Math.floor(o / 18))), M = this.rng.int(0, Math.max(1, Math.floor(o / 5))), N = Math.max(8, Math.round(245 - o * 1.65 + this.rng.next() * 42)), L = Math.max(0, Math.round((105 - o) * 82 + this.rng.next() * 1200));
      this.profiles.set(s, {
        accountId: s,
        username: `${this.rng.pick(n)}${this.rng.pick(r)}${i + 1}`,
        avatarId: `avatar_${this.rng.int(1, 12)}`,
        frameId: `frame_${l}`,
        titleId: `title_${this.rng.int(1, 20)}`,
        accountLevel: o,
        miningLevel: a,
        totalMined: d,
        collectionPercent: u,
        achievementPercent: h,
        arenaTier: Qr[l] ?? "BRONZE",
        arenaRating: 800 + l * 430 + this.rng.int(0, 420),
        raidStats: w,
        showcaseStoneIds: E,
        lastOnlineAt: new Date(this.now().getTime() - this.rng.int(0, 14 * 864e5)).toISOString(),
        highestEndlessFloor: m,
        weeklyHighestEndlessFloor: A,
        currentExpeditionCount: S,
        expeditionCount: k,
        expeditionScore: k * 100 + A * 25,
        bossKills: T,
        battleWins: p,
        battlePower: f,
        bestTeamStoneIds: [...E],
        favoriteStoneIds: E.slice(0, y),
        favoriteStoneCount: y,
        perfectStoneCount: b,
        mutationCollectionCount: M,
        fastestEndlessClearTurns: N,
        fewestEndlessDamage: L
      });
    }
  }
  async delay() {
    if (this.latencyMs > 0 && await new Promise((t) => setTimeout(t, this.latencyMs)), this.rng.chance(this.failureRate)) throw new Error("Mock network is unavailable");
  }
  rejectReason(t) {
    if (!t.eventId || !t.sessionId || !t.accountId) return { reason: "Malformed event identity", retryable: !1 };
    const n = new Date(t.timestamp).getTime(), r = n - this.now().getTime();
    if (!Number.isFinite(n) || r > 5 * 6e4 || r < -30 * 864e5) return { reason: "Timestamp outside authority window", retryable: !1 };
    const s = (this.authority.get(t.accountId) ?? { lastSequenceBySession: {} }).lastSequenceBySession[t.sessionId] ?? 0;
    if (t.sequence <= s) return { reason: "Non-monotonic session sequence", retryable: !1 };
    if (t.sequence > s + 1e4) return { reason: "Impossible session sequence jump", retryable: !1 };
    if (t.kind === "MINING_RECORDED") {
      const o = t.payload;
      if (typeof o.amount != "number" || o.amount < 1 || o.amount > 100) return { reason: "Impossible mining amount", retryable: !1 };
      if (typeof o.quality == "number" && (o.quality < 0 || o.quality > 1)) return { reason: "Impossible mining quality", retryable: !1 };
    }
    return null;
  }
  async pushEvents(t) {
    await this.delay();
    const n = [], r = [];
    for (const i of t) {
      const s = this.receipts.get(i.eventId);
      if (s) {
        n.push(s);
        continue;
      }
      const o = this.rejectReason(i);
      if (o) {
        r.push({ eventId: i.eventId, ...o });
        continue;
      }
      const a = this.authority.get(i.accountId) ?? { lastSequenceBySession: {}, totalMining: 0, battleWins: 0, fusionCount: 0 };
      a.lastSequenceBySession[i.sessionId] = i.sequence, i.kind === "MINING_RECORDED" && (a.totalMining += Number(i.payload.amount)), i.kind === "BATTLE_FINISHED" && i.payload.winner === "PLAYER" && (a.battleWins += 1), i.kind === "STONE_FUSED" && (a.fusionCount += 1), this.authority.set(i.accountId, a);
      const l = { eventId: i.eventId, processedAt: this.now().toISOString(), checksum: Mn(i) };
      this.receipts.set(i.eventId, l), n.push(l);
    }
    return { accepted: n, rejected: r };
  }
  async getPublicProfile(t) {
    await this.delay();
    const n = this.profiles.get(t);
    return n ? cl(n) : null;
  }
  async getLeaderboard(t, n = 100) {
    await this.delay();
    const r = (s) => {
      switch (t) {
        case "TOTAL_MINING":
          return s.totalMined;
        case "DAILY_MINING":
          return Math.round(s.totalMined / 300 + s.miningLevel * 3);
        case "WEEKLY_MINING":
          return Math.round(s.totalMined / 52 + s.miningLevel * 15);
        case "MONTHLY_MINING":
          return Math.round(s.totalMined / 12 + s.miningLevel * 50);
        case "COLLECTION":
          return s.collectionPercent;
        case "ACHIEVEMENTS":
          return s.achievementPercent;
        case "PVP":
          return s.arenaRating;
        case "RAID":
          return s.raidStats.lifetimeDamage;
        case "RARE_DISCOVERY":
          return Math.round(s.collectionPercent * s.miningLevel * 0.7);
        case "FUSION":
          return Math.round(s.accountLevel ** 1.8 * 0.8);
        case "ENDLESS_HIGHEST_FLOOR":
          return s.weeklyHighestEndlessFloor ?? s.highestEndlessFloor ?? 0;
        case "ENDLESS_FASTEST_CLEAR":
          return s.fastestEndlessClearTurns ?? Number.MAX_SAFE_INTEGER;
        case "ENDLESS_FEWEST_DAMAGE":
          return s.fewestEndlessDamage ?? Number.MAX_SAFE_INTEGER;
        case "EXPEDITION_SCORE":
          return s.expeditionScore ?? s.expeditionCount ?? 0;
        case "BOSS_CLEARS":
          return s.bossKills ?? s.raidStats.bossesDefeated;
        case "BATTLE_POWER":
          return s.battlePower ?? 0;
      }
    }, i = al(t) ? 1 : -1;
    return [...this.profiles.values()].sort((s, o) => (r(s) - r(o)) * i || s.accountId.localeCompare(o.accountId)).slice(0, Math.max(1, Math.min(1e3, n))).map((s, o) => {
      const a = Number.parseInt(Mn([this.leaderboardSeed, t, s.accountId]), 16) % 7 - 3;
      return {
        rank: o + 1,
        previousRank: Math.max(1, o + 1 + a),
        accountId: s.accountId,
        username: s.username,
        avatarId: s.avatarId,
        frameId: s.frameId,
        titleId: s.titleId,
        value: r(s)
      };
    });
  }
}
const dl = (e) => e == null || typeof e != "object" ? e : typeof globalThis.structuredClone == "function" ? globalThis.structuredClone(e) : JSON.parse(JSON.stringify(e));
class ul {
  listeners = /* @__PURE__ */ new Map();
  on(t, n) {
    const r = this.listeners.get(t) ?? /* @__PURE__ */ new Set();
    return r.add(n), this.listeners.set(t, r), () => this.off(t, n);
  }
  once(t, n) {
    const r = this.on(t, (i) => {
      r(), n(i);
    });
    return r;
  }
  off(t, n) {
    const r = this.listeners.get(t);
    r?.delete(n), r?.size === 0 && this.listeners.delete(t);
  }
  emit(t, n) {
    for (const r of [...this.listeners.get(t) ?? []])
      try {
        r(dl(n));
      } catch (i) {
        t !== "error" && this.emit("error", { operation: `event:${t}`, message: i instanceof Error ? i.message : String(i), cause: i });
      }
  }
  clear() {
    this.listeners.clear();
  }
}
const ml = (e) => {
  const t = Object.values(e.stones), r = (e.parties.find((d) => d.id === e.activePartyId) ?? e.parties[0])?.slots.map((d) => d.stoneId).filter((d) => !!e.stones[d]) ?? [], i = r.reduce((d, u) => {
    const h = e.stones[u];
    return h ? d + Math.round(h.stats.power * 1.9 + h.stats.defense * 1.45 + h.stats.speed * 1.15 + h.stats.resonance * 1.25 + h.stats.maxHp * 0.18) : d;
  }, 0), s = Object.values(e.collection.mutationSpecies).reduce((d, u) => d + u.filter((h) => h !== "NONE").length, 0), o = Object.values(e.expeditions.runs).filter((d) => d.status === "ACTIVE").length, a = Math.max(e.endlessMine.highestFloor, e.statistics.highestInfiniteFloor), l = e.account.raidStats.bossesDefeated + Math.floor(a / 10);
  return {
    accountId: e.account.accountId,
    username: e.account.username,
    avatarId: e.account.avatarId,
    frameId: e.account.profileFrameId,
    titleId: e.account.equippedTitleId,
    accountLevel: e.accountProgress.level,
    miningLevel: e.mining.level,
    totalMined: e.mining.totalMined,
    collectionPercent: Bt.length === 0 ? 0 : Math.round(e.collection.discoveredSpeciesIds.length / Bt.length * 100),
    achievementPercent: Object.values(e.achievements).length === 0 ? 0 : Math.round(Object.values(e.achievements).filter((d) => d.unlockedAt).length / Object.values(e.achievements).length * 100),
    arenaTier: e.account.arenaTier,
    arenaRating: e.account.arenaRating,
    raidStats: { ...e.account.raidStats },
    showcaseStoneIds: [...e.profile.showcaseStoneIds],
    lastOnlineAt: e.account.lastOnlineAt,
    highestEndlessFloor: a,
    weeklyHighestEndlessFloor: e.endlessMine.weeklyHighestFloor,
    currentExpeditionCount: o,
    expeditionCount: e.expeditions.totalCycles,
    expeditionScore: Math.min(Number.MAX_SAFE_INTEGER, e.expeditions.totalCycles * 100 + e.endlessMine.weeklyHighestFloor * 25),
    bossKills: l,
    battleWins: e.statistics.battleWins,
    battlePower: i,
    bestTeamStoneIds: r,
    favoriteStoneIds: [...e.profile.favoriteStoneIds],
    favoriteStoneCount: t.filter((d) => d.favorite).length,
    perfectStoneCount: t.filter((d) => On(d.individualValues)).length,
    mutationCollectionCount: s,
    // The current save schema does not retain authoritative weekly Endless
    // clear-turn and damage totals, so own profiles explicitly remain unmeasured.
    fastestEndlessClearTurns: null,
    fewestEndlessDamage: null
  };
}, Wn = (e) => e == null || typeof e != "object" ? e : typeof globalThis.structuredClone == "function" ? globalThis.structuredClone(e) : JSON.parse(JSON.stringify(e)), pl = (e = {}) => {
  const t = e.store ?? sl, n = e.online === void 0 ? new ll() : e.online, r = e.events ?? new ul(), i = (E, m) => {
    for (const [A, S] of Object.entries(m.achievements))
      S.unlockedAt && !E.achievements[A]?.unlockedAt && r.emit("achievement:unlocked", { achievementId: A });
  }, s = (E) => st(E).endlessMine, o = (E) => ({
    xp: E.xp,
    level: E.level,
    unlockedRewardIds: [...E.unlockedRewardIds]
  }), a = (E, m) => !E || E.xp !== m.xp || E.level !== m.level || E.unlockedRewardIds.length !== m.unlockedRewardIds.length || E.unlockedRewardIds.some((A, S) => A !== m.unlockedRewardIds[S]), l = (E, m) => E.minRarity === m.minRarity && E.minScore === m.minScore && E.autoSalvage === m.autoSalvage && (E.allowedSlots ?? []).join("|") === (m.allowedSlots ?? []).join("|") && (E.alwaysKeepSets ?? []).join("|") === (m.alwaysKeepSets ?? []).join("|"), d = (E, m, A) => {
    for (const [N, L] of Object.entries(A.expeditions.runs)) {
      const G = m.expeditions.runs[N];
      G && L.completedCycles > G.completedCycles && r.emit("expedition:completed", {
        expedition: L,
        previousCompletedCycles: G.completedCycles,
        cyclesCompleted: L.completedCycles - G.completedCycles
      });
      const H = new Set(G?.expeditionStorage.rareDiscoveries.map((q) => q.discoveryId) ?? []);
      for (const q of L.expeditionStorage.rareDiscoveries)
        H.has(q.discoveryId) || r.emit("expedition:rareDiscovered", { expeditionId: N, discovery: q });
    }
    const S = m.research.slot;
    if (S?.status === "ACTIVE") {
      const N = A.research.slot?.researchId === S.researchId ? A.research.slot : null;
      N?.status === "READY" ? r.emit("research:completed", N) : A.research.claimLedger[S.researchId] && r.emit("research:completed", { ...S, status: "READY", claimedAt: null });
    }
    const k = A.idle.lastWelcomeBack;
    k && k.summaryId !== m.idle.lastWelcomeBack?.summaryId && r.emit("idle:processed", k);
    const T = m.endlessMine, p = A.endlessMine, f = T.run, y = p.run, b = !!(y && p.runId && p.runId === T.runId);
    if (p.runId && p.runId !== T.runId && r.emit("endless:started", s(A)), b && y && f) {
      const N = Math.max(0, y.battles - f.battles), L = Math.max(0, y.highestClearedFloor - f.highestClearedFloor), G = Math.max(0, p.pendingCredits - T.pendingCredits), H = new Set(T.equipment.items.map((K) => K.id)), q = p.equipment.items.filter((K) => !H.has(K.id)).map((K) => K.id);
      if ((N > 0 || L > 0 || G > 0 || q.length > 0) && r.emit("endless:advanced", {
        runId: p.runId,
        previousFloor: f.currentFloor,
        floor: y.currentFloor,
        attemptedFloors: N,
        clearedFloors: L,
        creditsGained: G,
        bossesCleared: Math.max(0, y.clearedBosses - f.clearedBosses),
        equipmentAddedIds: q,
        state: s(A)
      }), T.status === "RUNNING" && p.status === "PAUSED" && r.emit("endless:paused", s(A)), (T.status === "PAUSED" || T.status === "ENDED") && p.status === "RUNNING" && r.emit("endless:resumed", s(A)), T.status !== "ENDED" && p.status === "ENDED") {
        const K = y.status === "DEFEATED" ? "DEFEATED" : y.status === "COMPLETE" ? "COMPLETE" : "CLAIMED";
        r.emit("endless:finished", { runId: p.runId, reason: K, state: s(A) });
      }
    }
    T.manualMode !== p.manualMode && r.emit("endless:manualChanged", { manual: p.manualMode, state: s(A) }), T.strategy !== p.strategy && r.emit("endless:strategyChanged", { strategy: p.strategy, state: s(A) }), T.speed !== p.speed && r.emit("endless:speedChanged", { speed: p.speed, state: s(A) }), l(T.lootFilter, p.lootFilter) || r.emit("endless:lootFilterChanged", { filter: { ...p.lootFilter }, state: s(A) });
    const M = Math.max(0, A.mastery.totalXp - m.mastery.totalXp);
    if (M > 0) {
      const N = (L, G) => Object.entries(L).filter(([H, q]) => a(G[H], q)).map(([H, q]) => ({
        id: H,
        previous: G[H] ? o(G[H]) : null,
        current: o(q)
      }));
      r.emit("mastery:gained", {
        operation: E,
        xpGained: M,
        totalXp: A.mastery.totalXp,
        stones: N(A.mastery.stones, m.mastery.stones),
        species: N(A.mastery.species, m.mastery.species)
      });
    }
  }, u = (E, m, A) => {
    const S = st(t.getState().game);
    try {
      const k = Wn(m()), T = st(t.getState().game);
      return i(S, T), d(E, S, T), A?.(k, S, T), k;
    } catch (k) {
      throw r.emit("error", { operation: E, message: k instanceof Error ? k.message : String(k), cause: k }), k;
    }
  }, h = (E, m = null) => {
    t.getState().setRoute(E, m), r.emit("route:changed", { route: E, selectedStoneId: m });
  }, w = {
    events: r,
    on: (E, m) => r.on(E, m),
    onStoneMined: (E) => u("onStoneMined", () => {
      const m = t.getState().game.mining.level, A = t.getState().mine(E, { farmSessionActive: t.getState().farmSessionActive });
      r.emit("stone:mined", A);
      const S = t.getState().game.mining.level;
      return S > m && r.emit("mining:levelUp", { previousLevel: m, level: S }), A;
    }),
    onFarmSessionStarted: () => {
      const E = t.getState().game;
      return t.getState().farmSessionActive !== !0 && (t.getState().setFarmSessionActive(!0), r.emit("session:started", { sessionId: E.online.sessionId, at: (/* @__PURE__ */ new Date()).toISOString() })), E.online.sessionId;
    },
    onFarmSessionEnded: () => {
      if (t.getState().farmSessionActive !== !0) return;
      const E = t.getState().game;
      t.getState().setFarmSessionActive(!1), r.emit("session:ended", { sessionId: E.online.sessionId, at: (/* @__PURE__ */ new Date()).toISOString() }), t.getState().save();
    },
    syncFarmStatistics: async () => {
      if (!n) return { sent: 0, accepted: 0, rejected: 0, remaining: t.getState().game.online.queue.length, connected: !1 };
      const E = w.getFarmStatistics();
      t.getState().queueOnlineEvent("PROFILE_UPDATED", E, `sync_profile_${E.revision}`);
      const m = await t.getState().syncOnline(n);
      return r.emit("sync:completed", { accepted: m.accepted, rejected: m.rejected, remaining: m.remaining }), m;
    },
    openStoneverse: () => h("HOME"),
    openProfile: () => h("PROFILE"),
    openGacha: () => h("GACHA"),
    openCollection: () => h("COLLECTION"),
    openRanking: () => h("RANKING"),
    openStoneDetail: (E) => {
      if (!t.getState().game.stones[E]) throw new Error("Stone not found");
      h("STONE_DETAIL", E);
    },
    getStoneverseState: () => st(t.getState().game),
    getFarmStatistics: () => {
      const E = t.getState().game;
      return {
        miningLevel: E.mining.level,
        miningXp: E.mining.xp,
        totalMined: E.mining.totalMined,
        dailyMined: E.mining.dailyMined,
        weeklyMined: E.mining.weeklyMined,
        monthlyMined: E.mining.monthlyMined,
        stoneCount: Object.keys(E.stones).length,
        collectionCount: E.collection.discoveredSpeciesIds.length,
        revision: E.revision
      };
    },
    exportStoneverseSave: () => t.getState().exportSave(),
    importStoneverseSave: (E) => u("importStoneverseSave", () => {
      t.getState().importSave(E), r.emit("save:imported", { schemaVersion: t.getState().game.schemaVersion });
    }),
    appraiseStone: (E) => u("appraiseStone", () => {
      const m = t.getState().appraise(E);
      return r.emit("stone:discovered", m), m;
    }),
    pullGacha: (E, m) => u("pullGacha", () => {
      const A = t.getState().pullGacha(E, m);
      return r.emit("gacha:result", A), A;
    }),
    fuseStones: (E, m) => u("fuseStones", () => {
      const A = t.getState().fuse(E, m);
      return r.emit("stone:fused", A), A;
    }),
    trainStone: (E, m) => u("trainStone", () => {
      const A = t.getState().addStoneXp(E, m);
      return A.levelsGained > 0 && r.emit("stone:levelUp", { stone: t.getState().game.stones[E], previousLevel: A.previousLevel, level: A.level }), A;
    }),
    evolveStone: (E, m, A) => u("evolveStone", () => {
      const S = t.getState().evolve(E, m, A);
      r.emit("stone:evolved", S);
    }),
    awakenStone: (E) => u("awakenStone", () => {
      t.getState().awaken(E);
      const m = t.getState().game.stones[E];
      r.emit("stone:awakened", { stone: m, stage: m.awakeningStage });
    }),
    startDungeonBattle: (E, m) => u("startDungeonBattle", () => {
      const A = t.getState().startDungeonBattle(E, m);
      return r.emit("battle:started", A), A;
    }),
    advanceBattle: () => u("advanceBattle", () => {
      const E = !!t.getState().game.activeBattle?.winner, m = t.getState().advanceBattle(), A = t.getState().game.activeBattle;
      return r.emit("battle:turn", { battle: A, actionCount: m.length }), !E && A.winner && r.emit("battle:finished", A), m;
    }),
    issueBattleCommand: (E, m) => u("issueBattleCommand", () => {
      const A = !!t.getState().game.activeBattle?.winner, S = t.getState().issueBattleCommand(E, m), k = t.getState().game.activeBattle;
      return r.emit("battle:turn", { battle: k, actionCount: S.length }), !A && k.winner && r.emit("battle:finished", k), S;
    }),
    setBattleAuto: (E) => u("setBattleAuto", () => (t.getState().setBattleAuto(E), t.getState().game.activeBattle)),
    setBattleSpeed: (E) => u("setBattleSpeed", () => (t.getState().setBattleSpeed(E), t.getState().game.activeBattle)),
    runBattle: () => u("runBattle", () => {
      const E = !!t.getState().game.activeBattle?.winner, m = t.getState().runActiveBattle();
      return !E && m.winner && r.emit("battle:finished", m), m;
    }),
    abandonBattle: () => u("abandonBattle", () => t.getState().abandonBattle()),
    processBackground: (E) => u("processBackground", () => t.getState().processBackground(E)),
    startExpedition: (E) => u(
      "startExpedition",
      () => t.getState().startExpedition(E),
      (m, A, S) => r.emit("expedition:started", S.expeditions.runs[m.expeditionId] ?? m)
    ),
    stopExpedition: (E) => u(
      "stopExpedition",
      () => t.getState().stopExpedition(E)
    ),
    claimExpedition: (E) => u(
      "claimExpedition",
      () => t.getState().claimExpedition(E),
      (m, A) => {
        const S = new Set(A.expeditions.runs[E]?.expeditionStorage.rareDiscoveries.map((k) => k.discoveryId) ?? []);
        for (const k of m.reward.rareDiscoveries)
          S.has(k.discoveryId) || r.emit("expedition:rareDiscovered", { expeditionId: E, discovery: k });
        r.emit("expedition:claimed", m);
      }
    ),
    claimStoredExpeditionDiscovery: (E) => u(
      "claimStoredExpeditionDiscovery",
      () => t.getState().claimStoredExpeditionDiscovery(E),
      (m, A, S) => r.emit("expedition:discoveryClaimed", {
        discoveryId: E,
        stone: S.stones[m.instanceId] ?? m
      })
    ),
    startTraining: (E) => u(
      "startTraining",
      () => t.getState().startTraining(E),
      (m, A, S) => {
        S.training.assignment && r.emit("training:started", S.training.assignment);
      }
    ),
    claimTraining: () => u(
      "claimTraining",
      () => t.getState().claimTraining(),
      (E, m, A) => {
        const S = A.training.assignment ?? m.training.assignment;
        S && r.emit("training:claimed", { stoneId: S.stoneId, xp: E, assignment: S });
      }
    ),
    stopTraining: () => u(
      "stopTraining",
      () => t.getState().stopTraining(),
      (E, m) => {
        m.training.assignment && r.emit("training:stopped", { stoneId: m.training.assignment.stoneId });
      }
    ),
    startAffinityGarden: (E) => u(
      "startAffinityGarden",
      () => t.getState().startAffinityGarden(E),
      (m, A, S) => {
        S.affinityGarden.assignment && r.emit("affinityGarden:started", S.affinityGarden.assignment);
      }
    ),
    claimAffinityGarden: () => u(
      "claimAffinityGarden",
      () => t.getState().claimAffinityGarden(),
      (E, m, A) => {
        const S = A.affinityGarden.assignment ?? m.affinityGarden.assignment;
        S && r.emit("affinityGarden:claimed", { stoneId: S.stoneId, affinity: E, assignment: S });
      }
    ),
    stopAffinityGarden: () => u(
      "stopAffinityGarden",
      () => t.getState().stopAffinityGarden(),
      (E, m) => {
        m.affinityGarden.assignment && r.emit("affinityGarden:stopped", { stoneId: m.affinityGarden.assignment.stoneId });
      }
    ),
    startResearch: (E) => u(
      "startResearch",
      () => t.getState().startResearch(E),
      (m, A, S) => r.emit("research:started", S.research.slot ?? m)
    ),
    claimResearch: (E) => u(
      "claimResearch",
      () => t.getState().claimResearch(E),
      (m) => r.emit("research:claimed", { researchId: E, ...m })
    ),
    startEndlessMine: (E) => u("startEndlessMine", () => (t.getState().startEndlessMine(E), s(t.getState().game))),
    advanceEndlessMine: (E) => u("advanceEndlessMine", () => t.getState().advanceEndlessMine(E)),
    setEndlessManual: (E) => u("setEndlessManual", () => (t.getState().setEndlessManual(E), s(t.getState().game))),
    setEndlessStrategy: (E) => u("setEndlessStrategy", () => (t.getState().setEndlessStrategy(E), s(t.getState().game))),
    setEndlessSpeed: (E) => u("setEndlessSpeed", () => (t.getState().setEndlessSpeed(E), s(t.getState().game))),
    issueEndlessCommand: (E, m) => u(
      "issueEndlessCommand",
      () => t.getState().issueEndlessCommand(E, m),
      (A, S, k) => r.emit("endless:command", {
        skillId: E,
        targetIds: [...m ?? []],
        settled: A,
        state: s(k)
      })
    ),
    pauseEndlessMine: () => u("pauseEndlessMine", () => (t.getState().pauseEndlessMine(), s(t.getState().game))),
    resumeEndlessMine: () => u("resumeEndlessMine", () => (t.getState().resumeEndlessMine(), s(t.getState().game))),
    claimEndlessMine: () => u(
      "claimEndlessMine",
      () => t.getState().claimEndlessMine(),
      (E) => r.emit("endless:claimed", E)
    ),
    updateEndlessLootFilter: (E) => u("updateEndlessLootFilter", () => (t.getState().updateEndlessLootFilter(E), s(t.getState().game))),
    salvageEndlessEquipment: (E) => u(
      "salvageEndlessEquipment",
      () => t.getState().salvageEndlessEquipment(E),
      (m) => r.emit("endless:equipmentSalvaged", { equipmentId: E, materialsGained: m })
    ),
    equipEndlessEquipment: (E, m) => u(
      "equipEndlessEquipment",
      () => t.getState().equipEndlessEquipment(E, m),
      (A, S, k) => {
        const T = S.endlessMine.equipment.items.find((f) => f.id === E), p = k.stones[m];
        T && p && r.emit("endless:equipmentEquipped", { equipment: T, stone: p });
      }
    ),
    unequipEndlessEquipment: (E, m) => u(
      "unequipEndlessEquipment",
      () => t.getState().unequipEndlessEquipment(E, m),
      () => r.emit("endless:equipmentUnequipped", { equipmentId: E, stoneId: m })
    ),
    setEndlessEquipmentLocked: (E, m) => u(
      "setEndlessEquipmentLocked",
      () => t.getState().setEndlessEquipmentLocked(E, m),
      () => r.emit("endless:equipmentLockChanged", { equipmentId: E, locked: m })
    ),
    getPublicProfile: async (E) => Wn(E === t.getState().game.account.accountId ? ml(t.getState().game) : await (n?.getPublicProfile(E) ?? null)),
    getLeaderboard: async (E, m) => Wn(await (n?.getLeaderboard(E, m) ?? []))
  };
  return w;
}, fl = pl(), Nr = 1, Jr = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/, hl = (e) => {
  if (!e || typeof e != "object" || Array.isArray(e)) return !1;
  const t = e;
  if (t.type !== "stoneverse.command" || t.protocol !== Nr || !Jr.test(t.requestId ?? "") || !Jr.test(t.id ?? "") || !["SESSION_BEGIN", "MINING_SUCCESS", "SESSION_END"].includes(t.command ?? "") || typeof t.timestamp != "string" || !Number.isFinite(Date.parse(t.timestamp))) return !1;
  if (t.command !== "MINING_SUCCESS") return !0;
  const n = t.amount ?? 1, r = t.quality ?? 0.5;
  return Number.isSafeInteger(n) && n >= 1 && n <= 100 && Number.isFinite(r) && r >= 0 && r <= 1 && (t.metadata === void 0 || !!t.metadata && typeof t.metadata == "object" && !Array.isArray(t.metadata) && JSON.stringify(t.metadata).length <= 4096);
}, El = (e) => {
  let t = null, n = null;
  return (r) => {
    if (!hl(r)) return null;
    const i = {
      type: "stoneverse.result",
      protocol: Nr,
      requestId: r.requestId,
      command: r.command,
      id: r.id
    };
    try {
      if (r.command === "SESSION_BEGIN") {
        if (t !== null && t !== r.id)
          return { ...i, ok: !1, accepted: !1, duplicate: !1, error: "SESSION_ALREADY_ACTIVE" };
        const o = t === r.id;
        return o || (t = r.id, n = e.onFarmSessionStarted()), { ...i, ok: !0, accepted: !o, duplicate: o };
      }
      if (r.command === "SESSION_END")
        return t === null ? { ...i, ok: !0, accepted: !1, duplicate: !0 } : t !== r.id ? { ...i, ok: !1, accepted: !1, duplicate: !1, error: "SESSION_MISMATCH" } : (e.onFarmSessionEnded(), t = null, n = null, { ...i, ok: !0, accepted: !0, duplicate: !1 });
      if (t === null || n === null)
        return { ...i, ok: !1, accepted: !1, duplicate: !1, error: "SESSION_NOT_ACTIVE" };
      const s = e.onStoneMined({
        eventId: r.id,
        sessionId: n,
        timestamp: r.timestamp,
        areaId: r.areaId,
        veinId: r.veinId,
        amount: r.amount ?? 1,
        quality: r.quality ?? 0.5,
        metadata: r.metadata
      });
      return {
        ...i,
        ok: s.accepted || s.duplicate,
        accepted: s.accepted,
        duplicate: s.duplicate,
        ...s.accepted || s.duplicate ? {} : { error: "MINING_REJECTED" }
      };
    } catch (s) {
      return {
        ...i,
        ok: !1,
        accepted: !1,
        duplicate: !1,
        error: s instanceof Error ? s.message.slice(0, 256) : "STONEVERSE_FAILED"
      };
    }
  };
}, Zr = () => {
  if (new URLSearchParams(window.location.search).get("host") !== "ai-miner" || document.getElementById("ai-miner-return")) return;
  const e = document.createElement("button");
  e.id = "ai-miner-return", e.type = "button", e.textContent = "‹ AI採掘機へ戻る", e.setAttribute("aria-label", "AI採掘機へ戻る"), Object.assign(e.style, {
    position: "fixed",
    left: "16px",
    top: "14px",
    zIndex: "2147483647",
    minHeight: "40px",
    padding: "0 16px",
    border: "1px solid rgba(255,255,255,.2)",
    borderRadius: "12px",
    color: "#fff",
    background: "rgba(7,11,24,.82)",
    backdropFilter: "blur(14px)",
    font: "600 14px system-ui",
    cursor: "pointer"
  }), e.addEventListener("click", () => window.location.assign("../index.html")), document.body.append(e);
}, gl = (e = fl) => {
  const t = globalThis, n = t.chrome?.webview;
  if (!n || t.__stoneverseFarmBridgeInstalled) return;
  t.__stoneverseFarmBridgeInstalled = !0;
  const r = El(e);
  n.addEventListener("message", (s) => {
    const o = r(s.data);
    o && n.postMessage(o);
  });
  const i = e.getStoneverseState();
  n.postMessage({
    type: "stoneverse.ready",
    protocol: Nr,
    accountId: i.account.accountId
  }), document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", Zr, { once: !0 }) : Zr();
};
gl();
