const Ae = (e, t, n, i, r, s, o) => ({ hardness: e, purity: t, power: n, defense: i, speed: r, resonance: s, maxHp: o }), we = (e, t) => ({
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
}), ve = (e, t) => [
  { id: `${e}_attack_1`, branch: "ATTACK", cost: 1, prerequisites: [], statBonus: { power: 4 } },
  { id: `${e}_attack_2`, branch: "ATTACK", cost: 2, prerequisites: [`${e}_attack_1`], statBonus: { power: 7 } },
  { id: `${e}_defense_1`, branch: "DEFENSE", cost: 1, prerequisites: [], statBonus: { defense: 4, maxHp: 25 } },
  { id: `${e}_support_1`, branch: "SUPPORT", cost: 1, prerequisites: [], statBonus: { resonance: 4 } },
  { id: `${e}_critical_1`, branch: "CRITICAL", cost: 2, prerequisites: [`${e}_attack_1`], statBonus: { purity: 6 } },
  { id: `${e}_element_1`, branch: "ELEMENT", cost: 3, prerequisites: [`${e}_support_1`], grantsSkillId: t }
], wt = [
  {
    id: "species_pebblit",
    name: "Pebblit",
    description: "A lively fieldstone whose humble core holds surprising promise.",
    rarity: "NORMAL",
    family: "terra",
    role: "ATTACK",
    primaryElement: "EARTH",
    possibleSecondaryElements: ["NEUTRAL", "METAL"],
    growth: we(Ae(12, 8, 11, 10, 10, 8, 105), 0.82),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_quake", level: 18 }],
    traitPool: ["trait_dense_core", "trait_keen_edge", "trait_swift_fault"],
    hiddenTraitPool: ["trait_wild_vein"],
    naturalWeight: 5e3,
    gachaWeight: 3800,
    minMiningLevel: 1,
    maxAwakening: 5,
    evolutions: [{ id: "evo_pebblit_granitus", targetSpeciesId: "species_granitus", conditions: [{ kind: "LEVEL", value: 24 }, { kind: "AFFINITY", value: 2 }], hidden: !1, hint: "Grow together until its core hardens." }],
    skillTree: ve("pebblit", "skill_quake")
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
    growth: we(Ae(22, 13, 17, 24, 10, 15, 175), 1.1),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_bastion", level: 1 }, { skillId: "skill_quake", level: 28 }],
    traitPool: ["trait_dense_core", "trait_last_bastion"],
    hiddenTraitPool: ["trait_wild_vein", "trait_ancient_oath"],
    naturalWeight: 720,
    gachaWeight: 1050,
    minMiningLevel: 8,
    maxAwakening: 5,
    evolutions: [],
    skillTree: ve("granitus", "skill_quake")
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
    growth: we(Ae(10, 22, 13, 12, 15, 23, 108), 0.98),
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
    skillTree: ve("quartzling", "skill_resonant_chorus")
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
    growth: we(Ae(17, 35, 24, 19, 25, 37, 164), 1.35),
    skillPool: [{ skillId: "skill_crystal_mend", level: 1 }, { skillId: "skill_resonant_chorus", level: 1 }, { skillId: "skill_prismatic_nova", level: 55 }],
    traitPool: ["trait_resonant", "trait_first_light"],
    hiddenTraitPool: ["trait_crystal_memory", "trait_prism_reflex"],
    naturalWeight: 20,
    gachaWeight: 120,
    minMiningLevel: 35,
    maxAwakening: 7,
    evolutions: [],
    skillTree: ve("prismara", "skill_prismatic_nova")
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
    growth: we(Ae(16, 13, 25, 14, 18, 17, 122), 1.12),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_ember_lance", level: 8 }, { skillId: "skill_magma_cataclysm", level: 42 }],
    traitPool: ["trait_keen_edge", "trait_flame_soul"],
    hiddenTraitPool: ["trait_wild_vein"],
    naturalWeight: 470,
    gachaWeight: 800,
    minMiningLevel: 12,
    maxAwakening: 6,
    evolutions: [{ id: "evo_ember_pyroclast", targetSpeciesId: "species_pyroclast", conditions: [{ kind: "LEVEL", value: 42 }, { kind: "BATTLE_COUNT", value: 40 }, { kind: "ITEM", value: "item_magma_heart", amount: 2 }], hidden: !1, hint: "Temper its flame through battle." }],
    skillTree: ve("emberite", "skill_magma_cataclysm")
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
    growth: we(Ae(27, 22, 42, 25, 28, 30, 205), 1.58),
    skillPool: [{ skillId: "skill_ember_lance", level: 1 }, { skillId: "skill_quake", level: 1 }, { skillId: "skill_magma_cataclysm", level: 1 }],
    traitPool: ["trait_flame_soul", "trait_keen_edge"],
    hiddenTraitPool: ["trait_ancient_oath"],
    naturalWeight: 2,
    gachaWeight: 18,
    minMiningLevel: 60,
    maxAwakening: 7,
    evolutions: [],
    skillTree: ve("pyroclast", "skill_magma_cataclysm")
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
    growth: we(Ae(13, 25, 16, 17, 21, 26, 132), 1.13),
    skillPool: [{ skillId: "skill_tidal_cut", level: 1 }, { skillId: "skill_crystal_mend", level: 12 }, { skillId: "skill_resonant_chorus", level: 35 }],
    traitPool: ["trait_resonant", "trait_swift_fault"],
    hiddenTraitPool: ["trait_crystal_memory"],
    naturalWeight: 520,
    gachaWeight: 820,
    minMiningLevel: 14,
    maxAwakening: 6,
    evolutions: [],
    skillTree: ve("aquamarite", "skill_crystal_mend")
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
    growth: we(Ae(10, 19, 20, 11, 31, 21, 112), 1.1),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_gale_shard", level: 7 }, { skillId: "skill_resonant_chorus", level: 34 }],
    traitPool: ["trait_swift_fault", "trait_first_light"],
    hiddenTraitPool: ["trait_crystal_memory"],
    naturalWeight: 430,
    gachaWeight: 790,
    minMiningLevel: 16,
    maxAwakening: 6,
    evolutions: [],
    skillTree: ve("zephyrite", "skill_gale_shard")
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
    growth: we(Ae(36, 15, 21, 40, 11, 18, 232), 1.42),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_bastion", level: 1 }, { skillId: "skill_iron_taunt", level: 20 }],
    traitPool: ["trait_dense_core", "trait_last_bastion"],
    hiddenTraitPool: ["trait_ancient_oath", "trait_wild_vein"],
    naturalWeight: 26,
    gachaWeight: 140,
    minMiningLevel: 33,
    maxAwakening: 7,
    evolutions: [],
    skillTree: ve("ironwarden", "skill_iron_taunt")
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
    growth: we(Ae(24, 34, 38, 26, 35, 40, 196), 1.62),
    skillPool: [{ skillId: "skill_void_grip", level: 1 }, { skillId: "skill_ancient_echo", level: 24 }, { skillId: "skill_prismatic_nova", level: 60 }],
    traitPool: ["trait_gene_weaver", "trait_first_light"],
    hiddenTraitPool: ["trait_crystal_memory", "trait_prism_reflex"],
    naturalWeight: 0,
    gachaWeight: 12,
    minMiningLevel: 70,
    maxAwakening: 7,
    evolutions: [],
    skillTree: ve("eclipse", "skill_prismatic_nova")
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
    growth: we(Ae(26, 40, 43, 24, 33, 39, 188), 1.64),
    skillPool: [{ skillId: "skill_stone_strike", level: 1 }, { skillId: "skill_resonant_chorus", level: 20 }, { skillId: "skill_solar_verdict", level: 48 }],
    traitPool: ["trait_keen_edge", "trait_first_light"],
    hiddenTraitPool: ["trait_crystal_memory"],
    naturalWeight: 3,
    gachaWeight: 24,
    minMiningLevel: 58,
    maxAwakening: 7,
    evolutions: [],
    skillTree: ve("solaris", "skill_solar_verdict")
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
    growth: we(Ae(52, 44, 46, 55, 27, 50, 315), 2.05),
    skillPool: [{ skillId: "skill_bastion", level: 1 }, { skillId: "skill_ancient_echo", level: 1 }, { skillId: "skill_moonlit_aegis", level: 1 }],
    traitPool: ["trait_last_bastion", "trait_resonant"],
    hiddenTraitPool: ["trait_ancient_oath", "trait_wild_vein"],
    naturalWeight: 0.08,
    gachaWeight: 1,
    minMiningLevel: 90,
    maxAwakening: 10,
    evolutions: [],
    skillTree: ve("worldheart", "skill_moonlit_aegis")
  }
], re = Object.freeze(
  Object.fromEntries(wt.map((e) => [e.id, e]))
), Ve = {
  NORMAL: 0,
  RARE: 1,
  SR: 2,
  SSR: 3,
  UR: 4,
  LEGENDARY: 5
}, vt = {
  stone: (e) => Math.floor(65 + 30 * e + 7.5 * e ** 1.72),
  mining: (e) => Math.floor(80 + 55 * e + 14 * e ** 1.55),
  account: (e) => Math.floor(120 + 75 * e + 22 * e ** 1.48)
}, Dn = [
  { id: "area_greenbreak", name: "Greenbreak Quarry", unlockLevel: 1, discoveryRate: 0.18, rarityBias: 1, veins: ["vein_common", "vein_crystal"] },
  { id: "area_emberdeep", name: "Emberdeep Caldera", unlockLevel: 12, discoveryRate: 0.21, rarityBias: 1.12, veins: ["vein_volcanic", "vein_rare"] },
  { id: "area_skyfault", name: "Skyfault Shelf", unlockLevel: 25, discoveryRate: 0.23, rarityBias: 1.28, veins: ["vein_aerial", "vein_special"] },
  { id: "area_void_rift", name: "Nocturne Rift", unlockLevel: 45, discoveryRate: 0.25, rarityBias: 1.5, veins: ["vein_void", "vein_ancient"] }
], is = [
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
], Vn = [
  { id: "catalyst_ember", name: "Ember Catalyst", requiredLabLevel: 1, elementBias: "FIRE" },
  { id: "catalyst_gene_lock", name: "Gene Seal", requiredLabLevel: 3, traitLockSlots: 1 },
  { id: "catalyst_iv_lens", name: "Precision Lens", requiredLabLevel: 4, ivLockStats: ["power", "speed"] },
  { id: "catalyst_mutagen", name: "Prismatic Mutagen", requiredLabLevel: 6, mutationMultiplier: 4, shinyMultiplier: 2 },
  { id: "catalyst_eclipse", name: "Eclipse Key", requiredLabLevel: 5, unlockRecipeId: "fusion_eclipse" }
], rs = wt.filter((e) => e.gachaWeight > 0).map((e) => ({
  speciesId: e.id,
  weight: e.gachaWeight,
  pickup: e.id === "species_solaris" || e.id === "species_prismara"
})), ss = [
  {
    id: "banner_genesis",
    name: "Genesis Resonance",
    pool: rs,
    rates: { NORMAL: 0.48, RARE: 0.3, SR: 0.16, SSR: 0.048, UR: 0.011, LEGENDARY: 1e-3 },
    pity: { softStart: 60, hard: 80, featuredGuaranteeAfterLoss: !0 },
    tenPullGuarantee: "SR",
    singleCost: { currencies: { gachaTickets: 1 } }
  }
], Xn = [
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
], os = [
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
], as = Object.freeze(Object.fromEntries(os.map((e) => [e.id, e]))), cs = Object.freeze(Object.fromEntries(ss.map((e) => [e.id, e]))), Yi = Object.freeze(Object.fromEntries(Vn.map((e) => [e.id, e]))), ji = [
  { id: "personality_bold", name: "Bold", description: "Hits hard and stands its ground.", statMultipliers: { power: 1.1, speed: 0.95 }, aiStyle: "AGGRESSIVE" },
  { id: "personality_calm", name: "Calm", description: "Channels resonance with patience.", statMultipliers: { resonance: 1.1, power: 0.96 }, aiStyle: "SUPPORTIVE" },
  { id: "personality_stalwart", name: "Stalwart", description: "Unusually difficult to crack.", statMultipliers: { defense: 1.1, speed: 0.94 }, aiStyle: "DEFENSIVE" },
  { id: "personality_hasty", name: "Hasty", description: "Acts before thinking, usually.", statMultipliers: { speed: 1.12, defense: 0.94 }, aiStyle: "AGGRESSIVE" },
  { id: "personality_precise", name: "Precise", description: "Polished focus with exceptional purity.", statMultipliers: { purity: 1.1, maxHp: 0.97 }, aiStyle: "TACTICAL" },
  { id: "personality_gentle", name: "Gentle", description: "Protects allies before itself.", statMultipliers: { resonance: 1.08, defense: 1.03, power: 0.94 }, aiStyle: "SUPPORTIVE" },
  { id: "personality_chaotic", name: "Chaotic", description: "No battle plan survives first contact.", statMultipliers: { power: 1.07, speed: 1.05, purity: 0.92 }, aiStyle: "CHAOTIC" },
  { id: "personality_sleepy", name: "Sleepy", description: "Eventually delivers a truly monumental hit.", statMultipliers: { power: 1.13, speed: 0.88, maxHp: 1.04 }, aiStyle: "DEFENSIVE" }
], Vi = Object.freeze(
  Object.fromEntries(ji.map((e) => [e.id, e]))
), ls = [
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
], Ze = Object.freeze(
  Object.fromEntries(ls.map((e) => [e.id, e]))
), ds = [
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
], Nt = Object.freeze(
  Object.fromEntries(ds.map((e) => [e.id, e]))
), Xi = (e) => {
  let t = 2166136261;
  for (let n = 0; n < e.length; n += 1)
    t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
  return t += t << 13, t ^= t >>> 7, t += t << 3, t ^= t >>> 17, t += t << 5, t >>> 0;
};
class Ee {
  constructor(t) {
    this.seed = t, this.state = typeof t == "number" ? t >>> 0 : Xi(t), this.state === 0 && (this.state = 1831565813);
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
    const i = t.map((o) => Math.max(0, n(o))), r = i.reduce((o, a) => o + a, 0);
    if (!(r > 0)) throw new RangeError("At least one weight must be positive");
    let s = this.next() * r;
    for (let o = 0; o < t.length; o += 1)
      if (s -= i[o] ?? 0, s < 0) return t[o];
    return t[t.length - 1];
  }
  shuffle(t) {
    const n = [...t];
    for (let i = n.length - 1; i > 0; i -= 1) {
      const r = this.int(0, i);
      [n[i], n[r]] = [n[r], n[i]];
    }
    return n;
  }
  fork(t) {
    return new Ee(`${String(this.seed)}:${t}:${this.draws}:${this.state}`);
  }
}
class Wn {
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
    const i = t.reduce((s, o) => s + Math.max(0, n(o)), 0);
    if (!(i > 0)) throw new RangeError("At least one weight must be positive");
    let r = this.next() * i;
    for (const s of t)
      if (r -= Math.max(0, n(s)), r < 0) return s;
    return t[t.length - 1];
  }
  shuffle(t) {
    const n = [...t];
    for (let i = n.length - 1; i > 0; i -= 1) {
      const r = this.int(0, i);
      [n[i], n[r]] = [n[r], n[i]];
    }
    return n;
  }
  fork() {
    return new Wn();
  }
}
const Ge = (e, t, n) => {
  const i = Array.from({ length: 4 }, () => t.int(0, 4294967295).toString(16).padStart(8, "0")).join("");
  return `${e}_${n.toString(36)}_${i}`;
}, nn = (e) => {
  const t = JSON.stringify(e, (n, i) => i && typeof i == "object" && !Array.isArray(i) ? Object.fromEntries(Object.entries(i).sort(([r], [s]) => r.localeCompare(s))) : i);
  return Xi(t ?? "").toString(16).padStart(8, "0");
}, Z = { now: () => /* @__PURE__ */ new Date() }, ke = ["hardness", "purity", "power", "defense", "speed", "resonance"], us = () => ({
  battles: 0,
  wins: 0,
  losses: 0,
  damageDealt: 0,
  damageTaken: 0,
  healingDone: 0,
  criticalHits: 0,
  enemiesDefeated: 0,
  ultimatesUsed: 0
}), Wi = (e) => ({
  NORMAL: 0.92,
  RARE: 1,
  SR: 1.08,
  SSR: 1.18,
  UR: 1.3,
  LEGENDARY: 1.47
})[e], dn = (e) => Math.min(120, 100 + e.limitBreak * 4), ms = (e) => ({
  instanceId: e.instanceId,
  speciesId: e.speciesId,
  serialNumber: e.serialNumber,
  nickname: e.nickname,
  mutation: e.mutation,
  colorVariant: e.colorVariant,
  traitIds: [...e.traitIds]
}), ps = (e, t) => {
  const n = { NORMAL: 0, RARE: 1, SR: 2, SSR: 4, UR: 6, LEGENDARY: 8 }, i = Math.floor((e.next() + e.next()) * 16);
  return Math.min(31, Math.max(n[t], i));
}, fs = (e, t, n = {}) => Object.fromEntries(
  ke.map((i) => [i, Math.max(0, Math.min(31, Math.round(n[i] ?? ps(e, t))))])
), Le = (e) => {
  const t = re[e.speciesId];
  if (!t) throw new Error(`Unknown species: ${e.speciesId}`);
  const n = Vi[e.personalityId];
  if (!n) throw new Error(`Unknown personality: ${e.personalityId}`);
  const i = {}, r = [...ke, "maxHp"], s = Wi(t.rarity), o = 1 + e.potential * 25e-4 + e.awakeningStage * 0.035 + e.reincarnationCount * 0.025 + e.limitBreak * 0.015, a = { NONE: 1, PRISMATIC: 1.035, ANCIENT: 1.04, CORRUPTED: 1.055, PERFECT: 1.075 };
  for (const c of r) {
    const l = c === "maxHp" ? Object.values(e.individualValues).reduce((u, I) => u + I, 0) / 6 : e.individualValues[c], d = t.growth.base[c] + t.growth.perLevel[c] * Math.max(0, e.level - 1), f = c === "maxHp" ? l * 1.35 : l * (0.18 + e.level * 4e-3), y = n.statMultipliers[c] ?? 1;
    let h = (d + f) * s * o * a[e.mutation] * y;
    for (const u of e.traitIds) {
      const I = Nt[u];
      for (const g of I?.effects ?? [])
        g.trigger !== "ALWAYS" || g.stat !== c || g.value === void 0 || (h = g.operation === "FLAT" ? h + g.value : h * (1 + g.value));
    }
    for (const u of t.skillTree)
      e.learnedSkillNodes.includes(u.id) && (h += u.statBonus?.[c] ?? 0);
    i[c] = Math.max(1, Math.round(h));
  }
  return i;
}, hs = (e, t) => {
  const n = t === "FUSION" ? 0.012 : t === "NATURAL" ? 3e-3 : 15e-4;
  return e.chance(n) ? e.weighted(["PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], (i) => ({
    NONE: 0,
    PRISMATIC: 54,
    ANCIENT: 27,
    CORRUPTED: 16,
    PERFECT: 3
  })[i]) : "NONE";
}, ft = (e) => {
  const n = (e.clock ?? Z).now(), i = n.getTime(), { species: r, rng: s } = e, o = e.rarity ?? r.rarity, a = e.origin, c = e.mutation ?? hs(s, a), l = e.personalityId ?? s.pick(ji).id, d = fs(s, o, e.forcedIvs);
  if (c === "PERFECT") for (const m of ke) d[m] = 31;
  const f = [...r.traitPool];
  a === "NATURAL" && f.push(...r.hiddenTraitPool.filter((m) => Nt[m]?.tier === "NATURAL_EXCLUSIVE")), a === "FUSION" && f.push("trait_gene_weaver"), c === "PRISMATIC" && f.push("trait_prism_reflex"), c === "ANCIENT" && f.push("trait_ancient_oath");
  const y = o === "LEGENDARY" ? 3 : o === "UR" || o === "SSR" ? 2 : 1, h = e.forcedTraits ? [...new Set(e.forcedTraits)].slice(0, 4) : s.shuffle([...new Set(f)]).slice(0, y), u = Math.max(1, Math.min(100, Math.floor(e.level ?? 1))), I = r.skillPool.filter((m) => m.level <= u).slice(0, 4).map((m) => m.skillId);
  I.length === 0 && r.skillPool[0] && I.push(r.skillPool[0].skillId);
  const g = [...new Set(e.forcedSkills ?? I)].slice(0, 6).map((m) => ({
    skillId: m,
    level: 1,
    source: a === "FUSION" ? "FUSION" : "NATURAL"
  })), b = Ge("stone", s, i), R = {
    instanceId: b,
    serialNumber: `${n.getUTCFullYear()}-${r.id.replace("species_", "").toUpperCase()}-${b.slice(-10).toUpperCase()}`,
    speciesId: r.id,
    name: r.name,
    nickname: null,
    rarity: o,
    origin: a,
    level: u,
    xp: 0,
    potential: Math.min(100, Math.round(35 + s.next() * 55 + Wi(o) * 5)),
    personalityId: l,
    primaryElement: r.primaryElement,
    secondaryElement: r.possibleSecondaryElements.length > 0 && s.chance(0.28) ? s.pick(r.possibleSecondaryElements) : null,
    stats: {},
    individualValues: d,
    traitIds: h,
    skills: g,
    skillPoints: Math.floor(u / 5),
    learnedSkillNodes: [],
    equipment: {},
    affinity: { points: 0, rank: 0, claimedMilestones: [] },
    awakeningStage: 0,
    evolutionStage: 0,
    reincarnationCount: 0,
    limitBreak: 0,
    mutation: c,
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
    battleStatistics: us(),
    favorite: !1,
    locked: !1,
    tags: []
  };
  return R.stats = Le(R), R;
}, Ki = (e, t) => {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("XP amount must be a non-negative finite number");
  const n = e.level, i = { ...e.stats };
  e.xp += Math.floor(t);
  const r = dn(e);
  for (; e.level < r; ) {
    const o = vt.stone(e.level);
    if (e.xp < o) break;
    e.xp -= o, e.level += 1, e.skillPoints += e.level % 5 === 0 ? 1 : 0;
    const a = re[e.speciesId];
    for (const c of a?.skillPool ?? [])
      c.level === e.level && !e.skills.some((l) => l.skillId === c.skillId) && e.skills.length < 6 && e.skills.push({ skillId: c.skillId, level: 1, source: "LEVEL" });
  }
  e.level >= r && (e.xp = Math.min(e.xp, vt.stone(r) - 1)), e.stats = Le(e);
  const s = Object.fromEntries(
    Object.entries(e.stats).map(([o, a]) => [o, a - i[o]])
  );
  return { previousLevel: n, level: e.level, xp: e.xp, levelsGained: e.level - n, statIncrease: s };
}, Es = (e) => {
  const t = [0, 100, 300, 700, 1400, 2500, 4e3, 6e3];
  let n = 0;
  for (; n + 1 < t.length && e >= (t[n + 1] ?? Number.POSITIVE_INFINITY); ) n += 1;
  return n;
}, un = (e, t) => {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("Affinity amount must be non-negative");
  const n = e.affinity.rank;
  return e.affinity.points = Math.min(9999, e.affinity.points + Math.floor(t)), e.affinity.rank = Es(e.affinity.points), { previousRank: n, rank: e.affinity.rank };
}, gs = (e, t, n) => {
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
      return e.skills.some((i) => i.skillId === String(t.value));
    case "FUSION_HISTORY":
      return n.fusionCount >= Number(t.value);
    case "ACHIEVEMENT":
      return n.achievementIds.includes(String(t.value));
    case "TIME": {
      const i = (n.timestamp ?? /* @__PURE__ */ new Date()).getHours();
      return t.value === "NIGHT" ? i >= 20 || i < 5 : t.value === "DAY" ? i >= 5 && i < 20 : !0;
    }
  }
}, Is = (e, t) => (re[e.speciesId]?.evolutions ?? []).filter((i) => i.conditions.every((r) => gs(e, r, t))), Ss = (e, t) => {
  const n = re[t.targetSpeciesId];
  if (!n) throw new Error(`Unknown evolution species: ${t.targetSpeciesId}`);
  const i = e.speciesId;
  e.speciesId = n.id, e.name = n.name, e.rarity = n.rarity, e.primaryElement = n.primaryElement, e.evolutionStage += 1, e.origin = "EVOLUTION";
  for (const r of n.skillPool.filter((s) => s.level <= e.level))
    !e.skills.some((s) => s.skillId === r.skillId) && e.skills.length < 6 && e.skills.push({ skillId: r.skillId, level: 1, source: "LEVEL" });
  return e.stats = Le(e), { previousSpeciesId: i, stone: e, evolutionId: t.id };
}, ys = (e) => {
  const t = re[e.speciesId];
  if (!t || e.awakeningStage >= t.maxAwakening) throw new Error("Stone is at maximum awakening");
  if (e.affinity.rank < Math.min(6, e.awakeningStage + 1)) throw new Error("Affinity is too low to awaken");
  e.awakeningStage += 1, e.stats = Le(e);
}, As = (e) => {
  if (e.level < dn(e)) throw new Error("Only a max-level stone may reincarnate");
  e.level = 1, e.xp = 0, e.reincarnationCount += 1, e.potential = Math.min(100, e.potential + 3), e.skillPoints += 2, e.stats = Le(e);
}, ws = (e, t) => {
  const i = re[e.speciesId]?.skillTree.find((r) => r.id === t);
  if (!i) throw new Error("Unknown skill node");
  if (e.learnedSkillNodes.includes(t)) throw new Error("Skill node already learned");
  if (!i.prerequisites.every((r) => e.learnedSkillNodes.includes(r))) throw new Error("Prerequisite not learned");
  if (e.skillPoints < i.cost) throw new Error("Not enough skill points");
  if (e.skillPoints -= i.cost, e.learnedSkillNodes.push(t), i.grantsSkillId && !e.skills.some((r) => r.skillId === i.grantsSkillId)) {
    if (e.skills.length >= 6) throw new Error("No open skill slot");
    e.skills.push({ skillId: i.grantsSkillId, level: 1, source: "TREE" });
  }
  e.stats = Le(e);
}, mn = (e) => ke.every((t) => e[t] === 31), vs = (e) => {
  const t = [];
  e.instanceId || t.push("instanceId is required"), re[e.speciesId] || t.push(`Unknown species ${e.speciesId}`), Vi[e.personalityId] || t.push(`Unknown personality ${e.personalityId}`), (e.level < 1 || e.level > dn(e)) && t.push("Level is out of range"), e.skills.length > 6 && t.push("Too many skills"), new Set(e.traitIds).size !== e.traitIds.length && t.push("Duplicate traits");
  for (const n of ke) (e.individualValues[n] < 0 || e.individualValues[n] > 31) && t.push(`IV ${n} is out of range`);
  return e.parents.some((n) => n.instanceId === e.instanceId) && t.push("Stone cannot be its own parent"), t;
}, bn = (e, t, n, i) => {
  const r = re[e];
  if (!r) throw new Error(`Unknown species ${e}`);
  return ft({ species: r, origin: "EVENT", owner: t, rng: new Ee(n), clock: i });
}, zi = {
  THIRTY_DAYS: 720 * 60 * 60 * 1e3
}, Ms = 864e13, ct = (e, t) => {
  if (!Number.isSafeInteger(e) || e < 0 || e > Ms)
    throw new Error(`${t} must be a valid non-negative Date timestamp`);
}, Rs = (e) => {
  const t = e.maxForwardAdvanceMs ?? zi.THIRTY_DAYS;
  if (!Number.isSafeInteger(t) || t <= 0) throw new Error("maxForwardAdvanceMs must be a positive safe integer");
  return t;
}, Ji = (e) => (ct(e, "observedWallMs"), { version: 1, trustedNowMs: e, wallHighWaterMs: e, reconciliationCount: 0 }), Ts = (e) => {
  if (!e || e.version !== 1) throw new Error("Unsupported trusted-time checkpoint");
  return ct(e.trustedNowMs, "checkpoint.trustedNowMs"), ct(e.wallHighWaterMs, "checkpoint.wallHighWaterMs"), ct(e.reconciliationCount, "checkpoint.reconciliationCount"), { ...e };
}, bs = (e, t, n = {}) => {
  const i = Ts(e);
  ct(t, "observedWallMs");
  const r = Math.max(0, t - i.wallHighWaterMs), s = Math.min(r, Rs(n)), o = t < i.wallHighWaterMs ? "rollback" : r > s ? "forward-capped" : "none", a = {
    version: 1,
    trustedNowMs: i.trustedNowMs + s,
    wallHighWaterMs: Math.max(i.wallHighWaterMs, t),
    reconciliationCount: i.reconciliationCount + 1
  };
  return ct(a.trustedNowMs, "next.trustedNowMs"), ct(a.reconciliationCount, "next.reconciliationCount"), { nowMs: a.trustedNowMs, advanceMs: s, observedWallMs: t, observedAdvanceMs: r, anomaly: o, checkpoint: a };
}, Vt = 1e12, j = (e, t = 0, n = Vt) => Number.isFinite(e) ? Math.max(t, Math.min(n, e)) : e > 0 ? n : t, yt = (e) => Math.round(j(e)), de = (e, t, n = 0, i = Vt) => {
  if (!Number.isFinite(e) || e < n || e > i)
    throw new RangeError(`${t} must be finite and within ${n}..${i}`);
  return e;
}, We = (e, t, n = 10) => de(e, t, 0, n), Ns = (e) => ({
  ...e,
  phases: e.phases?.map((t) => ({
    ...t,
    summons: t.summons?.map((n) => Kn(n))
  }))
}), Kn = (e) => ({
  ...e,
  stats: { ...e.stats },
  skillIds: [...e.skillIds],
  boss: e.boss ? Ns(e.boss) : void 0
}), Qi = (e) => {
  if (!e.id || !e.name || e.effects.length === 0) throw new TypeError("Skills require id, name and effects");
  de(e.cooldown ?? 0, `${e.id}.cooldown`, 0, 100), de(e.ultimateCost ?? 0, `${e.id}.ultimateCost`, 0, 100);
  for (const t of e.effects) {
    if (de(t.power ?? 0, `${e.id}.${t.kind}.power`, 0, 100), de(Math.abs(t.value ?? 0), `${e.id}.${t.kind}.value`, 0, Vt), de(t.duration ?? 0, `${e.id}.${t.kind}.duration`, 0, 1e3), de(t.chance ?? 1, `${e.id}.${t.kind}.chance`, 0, 1), (t.kind === "BUFF" || t.kind === "DEBUFF") && !t.stat)
      throw new TypeError(`${e.id}.${t.kind} requires a stat`);
    if (t.kind === "STATUS" && !t.status) throw new TypeError(`${e.id}.STATUS requires a status`);
  }
}, zn = (e, t) => {
  if (!e.id || !e.name || e.skillIds.length === 0) throw new TypeError("Combatants require id, name and skills");
  de(e.level, `${e.id}.level`, 1, 1e6);
  for (const [n, i] of Object.entries(e.stats)) de(i, `${e.id}.${n}`);
  We(e.stats.critChance, `${e.id}.critChance`, 1), We(e.stats.critDamage, `${e.id}.critDamage`, 10), de(e.initialUltimate ?? 0, `${e.id}.initialUltimate`, 0, 100);
  for (const n of e.skillIds)
    if (!t[n]) throw new RangeError(`Unknown skill ${n} on ${e.id}`);
  if (e.boss) {
    de(e.boss.enrageTurn ?? 0, `${e.id}.enrageTurn`, 0, 1e4), We(e.boss.enrageMultiplier ?? 1.5, `${e.id}.enrageMultiplier`), We(e.boss.weakPointMultiplier ?? 1.5, `${e.id}.weakPointMultiplier`), de(e.boss.breakThreshold ?? 100, `${e.id}.breakThreshold`, 1);
    for (const n of e.boss.phases ?? []) {
      if (We(n.hpRatio, `${e.id}.${n.id}.hpRatio`, 1), We(n.attackMultiplier ?? 1, `${e.id}.${n.id}.attackMultiplier`), We(n.defenseMultiplier ?? 1, `${e.id}.${n.id}.defenseMultiplier`), We(n.speedMultiplier ?? 1, `${e.id}.${n.id}.speedMultiplier`), (n.summons?.length ?? 0) > 20) throw new RangeError(`${e.id}.${n.id} has too many summons`);
      for (const i of n.summons ?? []) zn(i, t);
    }
  }
}, Zi = (e) => {
  const t = Kn(e);
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
    ultimate: j(t.initialUltimate ?? 0, 0, 100),
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
}, yi = (e) => {
  const t = new Set(e.map((a) => a.role)), n = /* @__PURE__ */ new Map();
  for (const a of e)
    a.family && n.set(a.family, (n.get(a.family) ?? 0) + 1);
  const i = [...n.values()].reduce((a, c) => a + Math.floor(c / 2), 0), r = t.has("TANK") || t.has("GUARDIAN"), s = t.has("STRIKER") || t.has("BREAKER"), o = r && s && t.has("SUPPORT");
  return {
    roleDiversity: t.size,
    lineagePairs: i,
    attackBonus: j((t.size - 1) * 0.025 + i * 0.03 + (o ? 0.05 : 0), 0, 0.5),
    defenseBonus: j((r ? 0.06 : 0) + i * 0.02, 0, 0.5),
    speedBonus: j((t.has("CONTROLLER") ? 0.04 : 0) + Math.max(0, t.size - 3) * 0.01, 0, 0.25),
    breakBonus: j((t.has("BREAKER") ? 0.12 : 0) + (t.has("VANGUARD") ? 0.03 : 0), 0, 0.35),
    ultimateStart: j((t.has("SUPPORT") ? 8 : 0) + i * 4, 0, 30)
  };
}, er = (e, t) => {
  e.modifiers.push(
    { stat: "attack", value: t.attackBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: "team-synergy" },
    { stat: "defense", value: t.defenseBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: "team-synergy" },
    { stat: "speed", value: t.speedBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: "team-synergy" },
    { stat: "breakPower", value: t.breakBonus, turns: Number.MAX_SAFE_INTEGER, sourceId: "team-synergy" }
  ), e.ultimate = j(e.ultimate + t.ultimateStart, 0, 100);
}, Jn = (e) => {
  const t = Object.fromEntries(
    Object.entries(e.skills).map(([s, o]) => [s, { ...o, effects: o.effects.map((a) => ({ ...a })), tags: o.tags ? [...o.tags] : void 0 }])
  );
  for (const [s, o] of Object.entries(t))
    if (Qi(o), s !== o.id) throw new RangeError(`Skill registry key ${s} does not match ${o.id}`);
  if (e.units.length < 2 || e.units.length > 50) throw new RangeError("A battle requires 2..50 starting combatants");
  const n = /* @__PURE__ */ new Set();
  for (const s of e.units) {
    if (zn(s, t), n.has(s.id)) throw new RangeError(`Duplicate combatant id ${s.id}`);
    n.add(s.id);
  }
  if (!e.units.some((s) => s.side === "PLAYER") || !e.units.some((s) => s.side === "ENEMY"))
    throw new RangeError("A battle requires both PLAYER and ENEMY combatants");
  const i = e.units.map(Zi), r = {
    PLAYER: yi(e.units.filter((s) => s.side === "PLAYER")),
    ENEMY: yi(e.units.filter((s) => s.side === "ENEMY"))
  };
  for (const s of i) er(s, r[s.side]);
  return {
    units: i,
    skills: t,
    turn: 0,
    maxTurns: Math.floor(de(e.maxTurns ?? 100, "maxTurns", 1, 1e4)),
    outcome: null,
    log: [],
    synergies: r
  };
}, ks = (e) => {
  if (!e || typeof e != "object") throw new TypeError("Advanced battle must be an object");
  const t = e;
  if (!Array.isArray(t.units) || t.units.length < 2 || t.units.length > 50) throw new RangeError("Advanced battle units are invalid");
  if (!t.skills || typeof t.skills != "object" || Array.isArray(t.skills)) throw new TypeError("Advanced battle skill book is invalid");
  for (const [i, r] of Object.entries(t.skills))
    if (Qi(r), i !== r.id) throw new RangeError(`Skill registry key ${i} does not match ${r.id}`);
  if (de(t.turn, "advanced.turn", 0, 1e4), de(t.maxTurns, "advanced.maxTurns", 1, 1e4), !Number.isInteger(t.turn) || !Number.isInteger(t.maxTurns) || t.turn > t.maxTurns) throw new RangeError("Advanced battle turn is invalid");
  if (t.outcome !== null && !["PLAYER", "ENEMY", "DRAW"].includes(t.outcome)) throw new TypeError("Advanced battle outcome is invalid");
  const n = /* @__PURE__ */ new Set();
  for (const i of t.units) {
    if (zn({ ...i, boss: i.bossState?.profile }, t.skills), n.has(i.id)) throw new RangeError(`Duplicate advanced combatant id ${i.id}`);
    if (n.add(i.id), de(i.hp, `${i.id}.hp`, 0, i.stats.maxHp), de(i.shield, `${i.id}.shield`), de(i.ultimate, `${i.id}.ultimate`, 0, 100), de(i.breakGauge, `${i.id}.breakGauge`), i.alive !== i.hp > 0) throw new RangeError(`${i.id}.alive disagrees with hp`);
    const s = [...[i.cooldowns, i.modifiers, i.dots, i.controls, i.statuses, i.counter]];
    for (; s.length; ) {
      const o = s.pop();
      if (typeof o == "number" && !Number.isFinite(o)) throw new RangeError(`${i.id} has a non-finite runtime value`);
      Array.isArray(o) ? s.push(...o) : o && typeof o == "object" && s.push(...Object.values(o));
    }
  }
  if (!t.units.some((i) => i.side === "PLAYER") || !t.units.some((i) => i.side === "ENEMY")) throw new RangeError("Advanced battle requires both sides");
  if (!Array.isArray(t.log) || t.log.length > 1e5) throw new RangeError("Advanced battle log is invalid");
  for (const i of t.log) {
    if (!n.has(i.actorId) || !t.skills[i.skillId]) throw new RangeError("Advanced battle log references an unknown actor or skill");
    if (!Array.isArray(i.resolutions) || i.resolutions.some((r) => !n.has(r.targetId) || !Number.isFinite(r.amount))) throw new RangeError("Advanced battle resolution is invalid");
  }
  return t;
}, ge = (e, t) => {
  const n = e.modifiers.filter((r) => r.stat === t && r.turns > 0).reduce((r, s) => j(r * (1 + s.value), 0, 100), 1), i = e.statuses.filter((r) => t === "defense" && r.kind === "CRACK" || t === "speed" && r.kind === "SLOW").reduce((r, s) => r * (1 - j(s.power, 0, 0.9)), 1);
  return j(e.stats[t] * n * i);
}, et = (e, t) => e.units.filter((n) => n.alive && (t === void 0 || n.side === t)), pn = (e, t) => {
  const n = e.units.find((r) => r.id === t);
  if (!n?.alive) return [];
  const i = n.controls.some((r) => r.kind === "SILENCE" && r.turns > 0);
  return n.skillIds.map((r) => e.skills[r]).filter((r) => !!r).filter((r) => (n.cooldowns[r.id] ?? 0) <= 0).filter((r) => (r.ultimateCost ?? 0) <= n.ultimate).filter((r) => !(i && (r.ultimateCost ?? 0) > 0));
}, Qn = (e) => et(e).sort((t, n) => ge(n, "speed") - ge(t, "speed") || t.id.localeCompare(n.id)).map((t) => t.id), _s = (e, t) => et(e, t.side === "PLAYER" ? "ENEMY" : "PLAYER"), Cs = (e, t) => et(e, t.side), Jt = (e, t) => {
  if (!t?.length) return e;
  const n = new Set(t);
  return e.filter((i) => n.has(i.id));
}, xs = (e, t, n, i) => {
  const r = Cs(e, t), s = _s(e, t);
  switch (n.target) {
    case "SELF":
      return i?.length && !i.includes(t.id) ? [] : [t];
    case "ALL_ALLIES":
      return r;
    case "ALLY_LOWEST": {
      const o = Jt(r, i)[0];
      return i?.length && !o ? [] : [o ?? [...r].sort((a, c) => a.hp / a.stats.maxHp - c.hp / c.stats.maxHp || a.id.localeCompare(c.id))[0]].filter(
        (a) => !!a
      );
    }
    case "ALL_ENEMIES":
      return s;
    case "BOSS": {
      const o = s.filter((c) => c.bossState), a = Jt(o, i)[0];
      return i?.length && !a ? [] : [a ?? o[0] ?? Jt(s, i)[0] ?? s[0]].filter(
        (c) => !!c
      );
    }
    case "ENEMY": {
      const o = s.find((c) => c.controls.some((l) => l.kind === "TAUNT" && l.turns > 0)), a = Jt(s, i)[0];
      return i?.length && !a ? [] : [o ?? a ?? s[0]].filter((c) => !!c);
    }
  }
}, Zn = (e, t) => e.side !== t.side, ei = (e, t, n = 1) => {
  const i = ge(e, "accuracy"), r = ge(t, "resistance");
  return j((0.82 + (i - r) / (i + r + 200)) * n, 0.05, 0.99);
}, tr = (e, t, n, i, r) => {
  if (!r.chance(ei(e, t, i.chance ?? 1))) return { targetId: t.id, kind: i.kind, hit: !1, amount: 0 };
  const s = r.chance(j(ge(e, "critChance"), 0, 0.95)), o = ge(e, "attack"), a = ge(t, "defense"), c = j(1 + (e.level - t.level) * 0.015, 0.25, 4), l = 100 / (100 + Math.sqrt(Math.max(0, a)) * 8);
  let d = j(o * (i.power ?? 1) * c * l);
  const f = n.element ?? e.element, y = {
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
  f && t.element && (y[f]?.includes(t.element) ? d = j(d * 1.2) : y[t.element]?.includes(f) && (d = j(d * 0.84))), s && (d = j(d * ge(e, "critDamage")));
  const h = t.bossState?.weakPoint;
  h && n.element === h && (d = j(d * (t.bossState?.profile.weakPointMultiplier ?? 1.5)));
  const u = t.statuses.filter((m) => m.kind === "VULNERABLE").reduce((m, p) => m * (1 + j(p.power, 0, 2)), 1);
  d = j(d * u), t.controls.some((m) => m.kind === "STUN" && m.sourceId === "break") && (d = j(d * 1.25));
  const I = Math.max(1, yt(d)), g = Math.min(t.shield, I);
  t.shield = j(t.shield - g);
  let b = g;
  for (const m of t.statuses.filter((p) => p.kind === "SHIELD")) {
    const p = Math.min(m.power, b);
    if (m.power -= p, b -= p, b <= 0) break;
  }
  const R = Math.min(t.hp, I - g);
  return t.hp = j(t.hp - R, 0, t.stats.maxHp), t.alive = t.hp > 0, t.ultimate = j(t.ultimate + Math.min(15, 5 + R / Math.max(1, t.stats.maxHp) * 20), 0, 100), { targetId: t.id, kind: i.kind, hit: !0, amount: R, absorbed: g, critical: s };
}, Ls = (e, t, n) => {
  const i = Math.max(1, yt(ge(e, "attack") * (n.power ?? 1))), r = Math.min(i, t.stats.maxHp - t.hp);
  return t.hp = j(t.hp + r, 0, t.stats.maxHp), t.hp > 0 && (t.alive = !0), { targetId: t.id, kind: n.kind, hit: !0, amount: r };
}, nr = (e, t, n) => {
  const i = Math.max(1, yt(ge(e, "attack") * (n.power ?? 1))), r = t.shield;
  return t.shield = j(t.shield + i, 0, t.stats.maxHp * 3), { targetId: t.id, kind: n.kind, hit: !0, amount: t.shield - r };
}, Ds = (e, t, n, i) => {
  if (n.kind === "DEBUFF" && Zn(e, t) && !i.chance(ei(e, t, n.chance ?? 1)))
    return { targetId: t.id, kind: n.kind, hit: !1, amount: 0 };
  const s = n.kind === "DEBUFF" ? -Math.abs(n.value ?? 0.15) : Math.abs(n.value ?? 0.15);
  return t.modifiers.push({ stat: n.stat, value: j(s, -0.9, 5), turns: Math.max(1, Math.floor(n.duration ?? 2)), sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: s, status: n.stat };
}, Os = (e, t, n, i) => {
  if (Zn(e, t) && !i.chance(ei(e, t, n.chance ?? 1)))
    return { targetId: t.id, kind: n.kind, hit: !1, amount: 0 };
  if (n.kind === "DOT")
    return t.dots.push({ id: `${e.id}:${t.dots.length}`, power: j(n.power ?? 0.04, 0, 1), turns: Math.max(1, Math.floor(n.duration ?? 2)), sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: n.power ?? 0.04, status: "DOT" };
  if (n.kind === "CONTROL") {
    const s = n.control ?? "STUN";
    return t.controls.push({ kind: s, turns: Math.max(1, Math.floor(n.duration ?? 1)), sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: 0, status: s };
  }
  if (n.kind === "BREAK") {
    const s = t.statuses.some((c) => c.kind === "CRACK"), o = j(((n.value ?? 20) + ge(e, "breakPower") * (n.power ?? 1)) * (s ? 1.3 : 1));
    t.breakGauge = j(t.breakGauge + o, 0, t.bossState?.profile.breakThreshold ?? 100);
    const a = t.bossState?.profile.breakThreshold ?? 100;
    return t.breakGauge >= a && (t.breakGauge = 0, t.controls.push({ kind: "STUN", turns: 1, sourceId: "break" })), { targetId: t.id, kind: n.kind, hit: !0, amount: o };
  }
  if (n.kind === "COUNTER")
    return t.counter = { power: j(n.power ?? 0.6, 0, 10), turns: Math.max(1, Math.floor(n.duration ?? 2)), sourceId: e.id }, { targetId: t.id, kind: n.kind, hit: !0, amount: n.power ?? 0.6, status: "COUNTER" };
  if (n.kind === "STATUS") {
    const s = n.status, o = Math.max(1, Math.floor(n.duration ?? 2));
    if (s === "STUN" || s === "SILENCE")
      return t.controls.push({ kind: s, turns: o, sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: 0, status: s };
    if (s === "SHIELD") {
      const l = nr(e, t, n);
      return t.statuses.push({ kind: s, power: l.amount, turns: o, sourceId: e.id }), { ...l, kind: n.kind, status: s };
    }
    const a = {
      BURN: 0.035,
      CRACK: 0.18,
      VULNERABLE: 0.16,
      SLOW: 0.18,
      REGENERATION: 0.08
    }, c = j(n.power ?? a[s] ?? 0, 0, s === "REGENERATION" || s === "BURN" ? 1 : 2);
    return t.statuses.push({ kind: s, power: c, turns: o, sourceId: e.id }), { targetId: t.id, kind: n.kind, hit: !0, amount: c, status: s };
  }
  const r = j(n.value ?? 10, 0, 100);
  return t.ultimate = j(t.ultimate + r, 0, 100), { targetId: t.id, kind: n.kind, hit: !0, amount: r };
}, ir = (e, t) => {
  if (!t.bossState) return;
  const n = t.hp / Math.max(1, t.stats.maxHp), i = [...t.bossState.profile.phases ?? []].sort((r, s) => s.hpRatio - r.hpRatio);
  for (const r of i)
    if (!(n > r.hpRatio || t.bossState.triggeredPhaseIds.includes(r.id))) {
      t.bossState.triggeredPhaseIds.push(r.id), r.attackMultiplier !== void 0 && t.modifiers.push({ stat: "attack", value: r.attackMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${r.id}` }), r.defenseMultiplier !== void 0 && t.modifiers.push({ stat: "defense", value: r.defenseMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${r.id}` }), r.speedMultiplier !== void 0 && t.modifiers.push({ stat: "speed", value: r.speedMultiplier - 1, turns: Number.MAX_SAFE_INTEGER, sourceId: `phase:${r.id}` }), r.weakPoint && (t.bossState.weakPoint = r.weakPoint), t.ultimate = j(t.ultimate + (r.ultimateGain ?? 0), 0, 100);
      for (const [s, o] of (r.summons ?? []).entries()) {
        const a = Kn(o);
        a.side = t.side, a.id = `${t.id}:${r.id}:${s}:${a.id}`;
        const c = Zi(a);
        er(c, e.synergies[t.side]), e.units.push(c);
      }
    }
}, Gt = (e) => {
  const t = e.units.some((i) => i.side === "PLAYER" && i.alive), n = e.units.some((i) => i.side === "ENEMY" && i.alive);
  !t && !n ? e.outcome = "DRAW" : n ? t ? e.turn >= e.maxTurns && (e.outcome = "DRAW") : e.outcome = "ENEMY" : e.outcome = "PLAYER";
}, $s = (e, t, n, i) => {
  if (!t.alive || !n.alive || !t.counter || t.counter.turns <= 0) return;
  const r = tr(
    t,
    n,
    {},
    { kind: "DAMAGE", power: t.counter.power, chance: 1 },
    i
  );
  return n.bossState && ir(e, n), { actorId: t.id, targetId: n.id, damage: r.amount };
}, Ps = (e, t, n) => {
  if (e.outcome) throw new RangeError("Battle has already ended");
  const i = e.units.find((l) => l.id === t.actorId);
  if (!i?.alive) throw new RangeError(`Actor ${t.actorId} is unavailable`);
  const r = e.skills[t.skillId];
  if (!r || !i.skillIds.includes(r.id)) throw new RangeError(`Skill ${t.skillId} is unavailable`);
  if (!pn(e, i.id).some((l) => l.id === r.id)) throw new RangeError(`Skill ${t.skillId} is not ready`);
  const s = xs(e, i, r, t.targetIds);
  if (s.length === 0) throw new RangeError(`Skill ${t.skillId} has no valid target`);
  i.ultimate = j(i.ultimate - (r.ultimateCost ?? 0), 0, 100), (r.cooldown ?? 0) > 0 && (i.cooldowns[r.id] = Math.floor(r.cooldown ?? 0) + 1);
  const o = [];
  let a;
  for (const l of r.effects) {
    for (const d of s.filter((f) => f.alive)) {
      let f;
      if (l.kind === "DAMAGE" ? f = tr(i, d, r, l, n) : l.kind === "HEAL" ? f = Ls(i, d, l) : l.kind === "SHIELD" ? f = nr(i, d, l) : l.kind === "BUFF" || l.kind === "DEBUFF" ? f = Ds(i, d, l, n) : f = Os(i, d, l, n), o.push(f), l.kind === "DAMAGE" && f.hit && d.bossState && ir(e, d), l.kind === "DAMAGE" && f.hit && (f.amount > 0 || (f.absorbed ?? 0) > 0) && Zn(i, d) && (a = $s(e, d, i, n) ?? a), Gt(e), e.outcome) break;
    }
    if (e.outcome) break;
  }
  (r.ultimateCost ?? 0) === 0 && (i.ultimate = j(i.ultimate + 12, 0, 100));
  const c = { turn: e.turn, actorId: i.id, skillId: r.id, resolutions: o, counter: a };
  return e.log.push(c), Gt(e), c;
}, Fs = (e, t) => {
  for (const n of t.dots) {
    const i = Math.max(1, yt(t.stats.maxHp * n.power));
    t.hp = j(t.hp - Math.min(t.hp, i), 0, t.stats.maxHp), n.turns -= 1;
  }
  t.dots = t.dots.filter((n) => n.turns > 0);
  for (const n of t.statuses)
    if (n.kind === "BURN") {
      const i = Math.max(1, yt(t.stats.maxHp * n.power));
      t.hp = j(t.hp - Math.min(t.hp, i), 0, t.stats.maxHp);
    } else if (n.kind === "REGENERATION" && t.hp > 0) {
      const i = Math.max(1, yt(t.stats.maxHp * n.power));
      t.hp = j(t.hp + i, 0, t.stats.maxHp);
    }
  return t.alive = t.hp > 0, Gt(e), t.controls.some((n) => n.kind === "STUN" && n.turns > 0);
}, Bs = (e) => {
  for (const n of Object.keys(e.cooldowns)) e.cooldowns[n] = Math.max(0, (e.cooldowns[n] ?? 0) - 1);
  for (const n of e.modifiers) n.turns < Number.MAX_SAFE_INTEGER && (n.turns -= 1);
  e.modifiers = e.modifiers.filter((n) => n.turns > 0);
  for (const n of e.controls) n.turns -= 1;
  e.controls = e.controls.filter((n) => n.turns > 0);
  for (const n of e.statuses) n.turns -= 1;
  const t = e.statuses.filter((n) => n.kind === "SHIELD" && n.turns <= 0).reduce((n, i) => n + i.power, 0);
  e.shield = j(e.shield - t, 0, e.stats.maxHp * 3), e.statuses = e.statuses.filter((n) => n.turns > 0 && (n.kind !== "SHIELD" || n.power > 0)), e.counter && (e.counter.turns -= 1, e.counter.turns <= 0 && (e.counter = null));
}, Gs = (e) => {
  for (const t of e.units) {
    const n = t.bossState;
    if (!t.alive || !n || n.enraged || !n.profile.enrageTurn || e.turn < n.profile.enrageTurn) continue;
    n.enraged = !0;
    const i = (n.profile.enrageMultiplier ?? 1.5) - 1;
    t.modifiers.push(
      { stat: "attack", value: i, turns: Number.MAX_SAFE_INTEGER, sourceId: "enrage" },
      { stat: "speed", value: i * 0.5, turns: Number.MAX_SAFE_INTEGER, sourceId: "enrage" }
    );
  }
}, fn = (e, t, n) => {
  if (e.outcome) return e;
  e.turn += 1, Gs(e);
  const i = Qn(e);
  for (const r of i) {
    if (e.outcome) break;
    const s = e.units.find((a) => a.id === r);
    if (!s?.alive) continue;
    const o = Fs(e, s);
    if (!e.outcome && !o) {
      const a = t.commands?.[r] ?? t.commandProvider?.(e, r, n) ?? null;
      a && Ps(e, a, n);
    }
    Bs(s);
  }
  return Gt(e), e;
}, rr = (e, t, n) => {
  for (; !e.outcome && e.turn < e.maxTurns; ) fn(e, { commandProvider: t }, n);
  return Gt(e), e;
}, qs = {
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
}, Us = ["BALANCED", "AGGRESSIVE", "DEFENSIVE", "BOSS_FOCUS", "RESOURCE_SAVE"], Hs = [...Us, "CONTROL", "BOSS_HUNTER"], ie = (e, t) => e.tags?.includes(t) ?? !1, ti = (e) => e.side === "PLAYER" ? "ENEMY" : "PLAYER", Ai = {
  FIRE: ["EARTH"],
  EARTH: ["WIND"],
  WIND: ["WATER"],
  WATER: ["FIRE"],
  LIGHT: ["DARK"],
  DARK: ["LIGHT"],
  METAL: ["CRYSTAL"],
  CRYSTAL: ["ANCIENT"],
  ANCIENT: ["METAL"]
}, le = (e, t) => {
  e.includes(t) || e.push(t);
}, sr = (e, t, n) => {
  if (!ie(t, "ATTACK") && !t.effects.some((r) => r.kind === "DAMAGE")) return { score: 0 };
  if (t.element && n.bossState?.weakPoint === t.element)
    return { score: 350, reason: "element-weak-point" };
  const i = t.element ?? e.element;
  return !i || !n.element || i === "NEUTRAL" || n.element === "NEUTRAL" ? { score: 0 } : Ai[i]?.includes(n.element) ? { score: 120, reason: "element-advantage" } : Ai[n.element]?.includes(i) ? { score: -170, reason: "element-resisted" } : { score: 0 };
}, ni = (e, t) => et(e, t.side).sort(
  (n, i) => n.hp / Math.max(1, n.stats.maxHp) - i.hp / Math.max(1, i.stats.maxHp) || n.id.localeCompare(i.id)
)[0], On = (e, t, n) => e.modifiers.some(
  (i) => i.turns > 0 && i.sourceId !== "team-synergy" && i.stat === t && (n ? i.value > 0 : i.value < 0)
), lt = (e, t) => e.controls.some((n) => n.turns > 0 && n.kind === t), tn = (e, t) => e.statuses.some((n) => n.turns > 0 && n.kind === t), Ys = (e, t) => e.effects.reduce((n, i) => {
  if (i.kind === "DEBUFF" && i.stat) return n + (On(t, i.stat, !1) ? -55 : 35);
  if (i.kind === "DOT") return n + (t.dots.some((r) => r.turns > 0) ? -55 : 35);
  if (i.kind === "CONTROL") return n + (lt(t, i.control ?? "STUN") ? -70 : 45);
  if (i.kind === "STATUS" && i.status) {
    if (i.status === "STUN" || i.status === "SILENCE")
      return n + (lt(t, i.status) ? -70 : 45);
    if (["BURN", "CRACK", "VULNERABLE", "SLOW"].includes(i.status))
      return n + (tn(t, i.status) ? -55 : 35);
  }
  return n;
}, 0), wi = (e, t, n, i) => {
  let r = Math.round((1 - t.hp / Math.max(1, t.stats.maxHp)) * 100);
  const s = sr(e, n, t);
  if (r += s.score, r += Ys(n, t), n.effects.some((o) => !["HEAL", "SHIELD", "BUFF", "COUNTER", "ULTIMATE_GAIN"].includes(o.kind))) {
    const o = ge(e, "accuracy"), a = ge(t, "resistance");
    r += Math.max(-120, Math.min(50, Math.round((o - a) / Math.max(200, o + a + 200) * 240)));
  }
  return t.bossState && (i === "BOSS_HUNTER" || i === "BOSS_FOCUS") && (r += 2e3), t.bossState && i === "CONTROL" && !lt(t, "STUN") && (r += 1200), r;
}, or = (e, t, n, i) => {
  const r = et(e, ti(t)), s = r.filter((a) => a.bossState);
  return [...i.target === "BOSS" && s.length > 0 ? s : r].sort(
    (a, c) => wi(t, c, i, n) - wi(t, a, i, n) || a.hp / Math.max(1, a.stats.maxHp) - c.hp / Math.max(1, c.stats.maxHp) || a.id.localeCompare(c.id)
  )[0];
}, js = (e, t) => {
  switch (e) {
    case "AGGRESSIVE":
      return (ie(t, "ATTACK") ? 180 : 0) + (ie(t, "ULTIMATE") ? 200 : 0);
    case "DEFENSIVE":
      return (ie(t, "HEAL") ? 220 : 0) + (ie(t, "DEFENSE") ? 180 : 0);
    case "CONTROL":
      return (ie(t, "CONTROL") ? 240 : 0) + (ie(t, "BREAK") ? 190 : 0);
    case "BOSS_HUNTER":
    case "BOSS_FOCUS":
      return (ie(t, "ATTACK") ? 100 : 0) + (ie(t, "BREAK") ? 210 : 0);
    case "RESOURCE_SAVE":
      return (t.ultimateCost ?? 0) > 0 ? -1050 : (t.cooldown ?? 0) > 1 ? -120 : 130;
    case "BALANCED":
      return ie(t, "ATTACK") ? 70 : 50;
  }
}, ar = (e, t, n, i) => {
  if (n.target === "ALL_ENEMIES") return et(e, ti(t));
  if (n.target === "ENEMY" || n.target === "BOSS") {
    const r = or(e, t, i, n);
    return r ? [r] : [];
  }
  return [];
}, Vs = (e, t, n) => {
  if (n.target === "SELF") return [t];
  if (n.target === "ALL_ALLIES") return et(e, t.side);
  if (n.target === "ALLY_LOWEST") {
    const i = ni(e, t);
    return i ? [i] : [];
  }
  return [];
}, Pe = (e, t, n = 180, i = 220) => {
  if (t === 0) return 0;
  const r = e / t;
  return Math.round(n * r - i * (1 - r));
}, Xs = (e, t, n, i, r) => {
  const s = ar(e, t, n, i), o = Vs(e, t, n);
  let a = 0;
  for (const c of n.effects)
    if (c.kind === "BUFF" && c.stat && o.length > 0) {
      const l = o.filter((d) => !On(d, c.stat, !0)).length;
      a += Pe(l, o.length), le(r, l > 0 ? "buff-coverage" : "buff-already-active");
    } else if (c.kind === "DEBUFF" && c.stat && s.length > 0) {
      const l = s.filter((d) => !On(d, c.stat, !1)).length;
      a += Pe(l, s.length), le(r, l > 0 ? "debuff-coverage" : "debuff-already-active");
    } else if (c.kind === "DOT" && s.length > 0) {
      const l = s.filter((d) => !d.dots.some((f) => f.turns > 0)).length;
      a += Pe(l, s.length, 160, 210), le(r, l > 0 ? "dot-window" : "dot-already-active");
    } else if (c.kind === "CONTROL" && s.length > 0) {
      const l = c.control ?? "STUN", d = s.filter((f) => !lt(f, l)).length;
      a += Pe(d, s.length, 190, 260), le(r, d > 0 ? "control-window" : "control-already-active");
    } else if (c.kind === "BREAK" && s.length > 0) {
      const l = s.filter((f) => !lt(f, "STUN")).length, d = Math.max(
        0,
        ...s.map((f) => f.breakGauge / Math.max(1, f.bossState?.profile.breakThreshold ?? 100))
      );
      a += Pe(l, s.length, 100 + Math.round(d * 160), 230), le(r, l > 0 ? "break-progress" : "break-already-controlled");
    } else if (c.kind === "SHIELD" && o.length > 0) {
      const l = o.filter((d) => d.shield < d.stats.maxHp * 0.25).length;
      a += Pe(l, o.length, 150, 230), le(r, l > 0 ? "shield-window" : "shield-already-active");
    } else if (c.kind === "STATUS" && c.status) {
      if ((c.status === "STUN" || c.status === "SILENCE") && s.length > 0) {
        const l = s.filter((d) => !lt(d, c.status)).length;
        a += Pe(l, s.length, 190, 260), le(r, l > 0 ? "control-window" : "control-already-active");
      } else if (["BURN", "CRACK", "VULNERABLE", "SLOW"].includes(c.status) && s.length > 0) {
        const l = s.filter((d) => !tn(d, c.status)).length;
        a += Pe(l, s.length, 150, 210), le(r, l > 0 ? c.status === "BURN" ? "dot-window" : "debuff-coverage" : c.status === "BURN" ? "dot-already-active" : "debuff-already-active");
      } else if (c.status === "REGENERATION" && o.length > 0) {
        const l = o.filter((d) => !tn(d, c.status) && d.hp < d.stats.maxHp).length;
        a += Pe(l, o.length, 130, 190), le(r, l > 0 ? "buff-coverage" : "buff-already-active");
      } else if (c.status === "SHIELD" && o.length > 0) {
        const l = o.filter((d) => !tn(d, c.status) && d.shield < d.stats.maxHp * 0.25).length;
        a += Pe(l, o.length, 150, 230), le(r, l > 0 ? "shield-window" : "shield-already-active");
      }
    }
  return a;
}, Ws = (e, t, n, i) => {
  const r = et(e, ti(t)), s = ni(e, t), o = s ? s.hp / Math.max(1, s.stats.maxHp) : 1, a = ar(e, t, n, i), c = a.find((y) => y.bossState);
  let l = n.priority ?? 0;
  const d = [];
  if (l += js(i, n), t.role === "BREAKER" && ie(n, "BREAK") && (l += 180), t.role === "GUARDIAN" && ie(n, "DEFENSE") && (l += 180), ie(n, "HEAL") && (l += Math.round((1 - o) * 500), o <= 0.42 ? (l += 1200, d.push("emergency-heal")) : o >= 0.98 && (l -= 600)), ie(n, "DEFENSE")) {
    const y = t.hp / Math.max(1, t.stats.maxHp);
    l += Math.round((1 - y) * 250), t.shield > t.stats.maxHp * 0.4 && (l -= 300);
  }
  if ((n.ultimateCost ?? 0) > 0 ? (l += 900, le(d, "ready-ultimate")) : i === "RESOURCE_SAVE" && le(d, "resource-conservation"), n.target === "ALL_ENEMIES" && (l += r.length * 90, r.length >= 3 ? (l += 320, le(d, "multi-target")) : r.length === 1 && (l -= 100)), c && (i === "BOSS_HUNTER" || i === "BOSS_FOCUS") && (n.target === "ENEMY" || n.target === "BOSS") && (l += 420, le(d, "boss-focus")), c && (ie(n, "BREAK") || ie(n, "CONTROL")) && !lt(c, "STUN") && (l += 260, le(d, "break-window")), l += Xs(e, t, n, i, d), a.length > 0) {
    const y = a.map((u) => sr(t, n, u));
    l += Math.round(y.reduce((u, I) => u + I.score, 0) / a.length);
    for (const u of y) u.reason && le(d, u.reason);
    if (n.effects.some((u) => !["HEAL", "SHIELD", "BUFF", "COUNTER", "ULTIMATE_GAIN"].includes(u.kind))) {
      const u = ge(t, "accuracy"), I = a.reduce((b, R) => b + ge(R, "resistance"), 0) / a.length, g = Math.round((u - I) / Math.max(200, u + I + 200) * 300);
      l += Math.max(-180, Math.min(60, g)), I > u && le(d, "target-resistance");
    }
  }
  const f = a.filter((y) => y.bossState);
  if (f.some((y) => (y.bossState?.triggeredPhaseIds.length ?? 0) > 0)) {
    const y = Math.max(...f.map((u) => u.bossState?.triggeredPhaseIds.length ?? 0)), h = (ie(n, "ATTACK") ? 70 : 0) + (ie(n, "BREAK") || ie(n, "CONTROL") ? 130 : 0) + (ie(n, "ULTIMATE") ? 100 : 0) + Math.min(90, y * 30);
    h > 0 && (l += h, le(d, "boss-phase-active"));
  }
  if (f.some((y) => y.bossState?.enraged)) {
    const y = (ie(n, "ATTACK") ? 100 : 0) + (ie(n, "BREAK") || ie(n, "CONTROL") ? 240 : 0) + (ie(n, "ULTIMATE") ? 420 : 0) + (ie(n, "HEAL") || ie(n, "DEFENSE") ? 120 : 0);
    y > 0 && (l += y, le(d, "boss-enraged"));
  }
  return { score: l, reasons: d };
}, Ks = (e, t, n, i) => {
  if (n.target === "ALLY_LOWEST") {
    const r = ni(e, t);
    return { actorId: t.id, skillId: n.id, targetIds: r ? [r.id] : void 0 };
  }
  if (n.target === "ENEMY" || n.target === "BOSS") {
    const r = or(e, t, n.target === "BOSS" ? "BOSS_HUNTER" : i, n);
    return { actorId: t.id, skillId: n.id, targetIds: r ? [r.id] : void 0 };
  }
  return { actorId: t.id, skillId: n.id };
}, zs = (e, t, n, i) => {
  if (!Hs.includes(n)) throw new RangeError(`Unknown AI strategy ${String(n)}`);
  const r = e.units.find((l) => l.id === t);
  if (!r?.alive || e.outcome) return { command: null, score: Number.NEGATIVE_INFINITY, reasons: ["actor-unavailable"] };
  const s = pn(e, t).map((l) => ({ skill: l, ...Ws(e, r, l, n) }));
  if (s.length === 0) return { command: null, score: Number.NEGATIVE_INFINITY, reasons: ["no-usable-skill"] };
  const o = Math.max(...s.map((l) => l.score)), c = s.filter((l) => l.score === o).sort((l, d) => l.skill.id.localeCompare(d.skill.id))[0];
  return c ? { command: Ks(e, r, c.skill, n), score: c.score, reasons: c.reasons } : { command: null, score: Number.NEGATIVE_INFINITY, reasons: ["no-usable-skill"] };
}, Js = (e, t, n, i) => zs(e, t, n).command, Mt = (e = "BALANCED") => (t, n, i) => {
  const r = t.units.find((s) => s.id === n);
  return r ? Js(t, n, typeof e == "function" ? e(r) : e) : null;
}, Fe = 1e6, rn = Number.MAX_SAFE_INTEGER, dt = 100, Qs = ["BATTLE", "MINING", "TREASURE", "ELITE", "REST", "RANDOM_EVENT", "BOSS"], Rt = {
  maxFloor: Fe,
  checkpointInterval: 10,
  efficiency: { ACTIVE: 1, AUTO: 0.94, OFFLINE: 0.78 }
}, vi = ["CRYSTAL_CAVERN", "MAGMA_VEIN", "FOSSIL_DEPTHS", "ASTRAL_RIFT"], Mi = ["FIRE", "WATER", "EARTH", "WIND", "LIGHT", "DARK", "METAL", "CRYSTAL"], Zs = {
  BATTLE: { label: "Shard Ambush", description: "通常戦闘。安定したDepth Creditを得る。", rewardMultiplier: 1, powerMultiplier: 1, equipmentChance: 0.18, recoveryRatio: 0, risk: 0.12 },
  MINING: { label: "Resonance Vein", description: "採掘力を試し、Creditと装備鉱石を回収する。", rewardMultiplier: 1.18, powerMultiplier: 0.62, equipmentChance: 0.34, recoveryRatio: 0, risk: 0.32 },
  TREASURE: { label: "Sealed Geode", description: "罠を見切れば高密度の報酬を得る。", rewardMultiplier: 1.72, powerMultiplier: 0.38, equipmentChance: 0.78, recoveryRatio: 0, risk: 0.58 },
  ELITE: { label: "Elite Formation", description: "強化個体との高リスク戦闘。", rewardMultiplier: 1.7, powerMultiplier: 1.12, equipmentChance: 0.58, recoveryRatio: 0, risk: 0.24 },
  REST: { label: "Quiet Stratum", description: "安全な地層で共鳴を30%回復する。", rewardMultiplier: 0.28, powerMultiplier: 0, equipmentChance: 0, recoveryRatio: 0.3, risk: 0 },
  RANDOM_EVENT: { label: "Unknown Signal", description: "Seedで固定された未知現象を突破する。", rewardMultiplier: 1.42, powerMultiplier: 0.82, equipmentChance: 0.42, recoveryRatio: 0.08, risk: 0.85 },
  BOSS: { label: "Depth Guardian", description: "10層ごとのGuardian戦。Checkpointを確保する。", rewardMultiplier: 4, powerMultiplier: 1.15, equipmentChance: 1, recoveryRatio: 0, risk: 0.3 }
}, eo = {
  LOW_GRAVITY: { id: "LOW_GRAVITY", label: "Low Gravity", attackMultiplier: 1, defenseMultiplier: 1, speedMultiplier: 1.12, accuracyMultiplier: 1, breakMultiplier: 1 },
  STONE_DUST: { id: "STONE_DUST", label: "Stone Dust", attackMultiplier: 1.06, defenseMultiplier: 1, speedMultiplier: 1, accuracyMultiplier: 0.9, breakMultiplier: 1 },
  FRACTURED_GROUND: { id: "FRACTURED_GROUND", label: "Fractured Ground", attackMultiplier: 1, defenseMultiplier: 0.93, speedMultiplier: 1, accuracyMultiplier: 1, breakMultiplier: 1.2 },
  RESONANT_AIR: { id: "RESONANT_AIR", label: "Resonant Air", attackMultiplier: 1.1, defenseMultiplier: 1.06, speedMultiplier: 1, accuracyMultiplier: 1.05, breakMultiplier: 1 }
}, to = {
  id: "BOSS_FLOOR",
  label: "Guardian Domain",
  attackMultiplier: 1.12,
  defenseMultiplier: 1.14,
  speedMultiplier: 1.04,
  accuracyMultiplier: 1.06,
  breakMultiplier: 1.1
}, no = [
  { id: "WEEKLY_OVERCHARGE", label: "Weekly: Overcharge", attackMultiplier: 1.08, defenseMultiplier: 1, speedMultiplier: 1.04, accuracyMultiplier: 1, breakMultiplier: 1 },
  { id: "WEEKLY_FORTUNE", label: "Weekly: Fortune Vein", attackMultiplier: 1, defenseMultiplier: 1.03, speedMultiplier: 1, accuracyMultiplier: 1.03, breakMultiplier: 1.04 },
  { id: "WEEKLY_FRACTURE", label: "Weekly: Deep Fracture", attackMultiplier: 1.04, defenseMultiplier: 0.96, speedMultiplier: 1, accuracyMultiplier: 1, breakMultiplier: 1.12 }
], Me = (e, t = rn) => Number.isFinite(e) ? Math.max(0, Math.min(t, e)) : e > 0 ? t : 0, io = (e, t = Fe) => {
  if (!Number.isSafeInteger(e) || e < 1 || e > t) throw new RangeError(`floor must be an integer within 1..${t}`);
  return e;
}, ro = (e) => Math.round((1 + e * 0.032 + Math.pow(e, 1.18) * 18e-4) * 1e5) / 1e5, Ri = (e, t, n, i, r, s) => {
  const o = i.reduce(
    (d, f) => ({
      attack: d.attack * f.attackMultiplier,
      defense: d.defense * f.defenseMultiplier,
      speed: d.speed * f.speedMultiplier,
      accuracy: d.accuracy * f.accuracyMultiplier,
      breakPower: d.breakPower * f.breakMultiplier
    }),
    { attack: 1, defense: 1, speed: 1, accuracy: 1, breakPower: 1 }
  ), a = r ? 2.25 : 1, c = Math.round(Me((390 + e * 22) * n * a, 1e9)), l = {
    id: "echo",
    name: "Guardian Echo",
    side: "ENEMY",
    role: "CONTROLLER",
    family: "mine-echo",
    level: e,
    stats: {
      maxHp: Math.round(c * 0.18),
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
    id: r ? `floor-${e}-guardian` : `floor-${e}-enemy-${t}`,
    name: r ? `Depth Guardian ${e / 10}` : `Depth Shard ${t + 1}`,
    side: "ENEMY",
    role: r ? "TANK" : t % 2 === 0 ? "STRIKER" : "CONTROLLER",
    family: r ? "depth-guardian" : `mine-${e % 4}`,
    level: e,
    stats: {
      maxHp: c,
      attack: Math.round(Me((42 + e * 1.7) * n * o.attack * (r ? 1.15 : 1), 1e8)),
      defense: Math.round(Me((30 + e * 1.4) * n * o.defense * (r ? 1.25 : 1), 1e8)),
      speed: Me((82 + Math.min(420, e * 0.14) + s.int(-3, 3)) * o.speed, 1e4),
      accuracy: Me((100 + Math.min(500, e * 0.24)) * o.accuracy, 1e4),
      resistance: Me(88 + Math.min(600, e * 0.26) + (r ? 40 : 0), 1e4),
      critChance: Math.min(0.45, 0.06 + e * 22e-5),
      critDamage: Math.min(3, 1.45 + e * 5e-4),
      breakPower: Me((18 + Math.min(300, e * 0.08)) * o.breakPower, 1e4)
    },
    skillIds: r ? ["strike", "sweep", "fracture", "eclipse", "nova"] : t % 2 === 0 ? ["strike", "fracture"] : ["strike", "stun", "eclipse"],
    initialUltimate: r ? 35 : 0,
    boss: r ? {
      weakPoint: s.pick(Mi),
      weakPointMultiplier: 1.65,
      breakThreshold: 140 + e * 0.2,
      enrageTurn: 14,
      enrageMultiplier: 1.55,
      phases: [
        { id: "fracture", hpRatio: 0.67, attackMultiplier: 1.12, speedMultiplier: 1.06, ultimateGain: 30 },
        { id: "echoes", hpRatio: 0.34, defenseMultiplier: 1.18, weakPoint: s.pick(Mi), summons: [l], ultimateGain: 45 }
      ]
    } : void 0
  };
}, so = ["BATTLE", "MINING", "TREASURE", "ELITE", "REST", "RANDOM_EVENT"], oo = { BATTLE: 44, MINING: 18, TREASURE: 9, ELITE: 12, REST: 9, RANDOM_EVENT: 8 }, cr = (e) => e.encounterType === "BATTLE" || e.encounterType === "ELITE" || e.encounterType === "BOSS", ii = (e, t = "stoneverse-endless") => {
  io(e);
  const n = new Ee(`${t}:floor:${e}`), i = e % 10 === 0, r = i ? "BOSS" : e === 1 ? "BATTLE" : n.weighted(so, (g) => oo[g]), s = ro(e), o = Object.values(eo), a = Math.min(2, Math.floor(e / 75) + (e >= 20 ? 1 : 0)), c = n.shuffle(o).slice(0, a).map((g) => ({ ...g })), l = new Ee(`${t}:weekly-rule`).pick(no);
  c.push({ ...l }), i && c.push({ ...to });
  const f = r === "BATTLE" || r === "ELITE" || r === "BOSS" ? i ? Math.min(2, 1 + Math.floor(e / 400)) : 1 + Math.floor((e - 1) / 25) % 3 + (r === "ELITE" ? 1 : 0) : 0, y = r === "ELITE" ? s * 1.2 : s, h = Array.from({ length: f }, (g, b) => Ri(e, b, y, c, !1, n));
  i && h.unshift(Ri(e, 0, s, c, !0, n));
  const u = Zs[r], I = { ...u, outcomeRoll: Math.round(n.next() * 1e6) / 1e6 };
  return {
    floor: e,
    biome: vi[Math.floor((e - 1) / 25) % vi.length],
    encounterType: r,
    isBossFloor: i,
    difficulty: s,
    rules: c,
    enemies: h,
    encounter: I,
    baseReward: Math.round(Me((40 + e * 13 + Math.pow(e, 1.25) * 1.8) * u.rewardMultiplier))
  };
}, ri = (e) => e.reduce((t, n) => Me(
  t + n.stats.maxHp * 0.08 + n.stats.attack * 4 + n.stats.defense * 2 + n.stats.speed + n.stats.breakPower * 2
), 0), ao = (e) => {
  if (e.encounterType === "REST") return 0;
  const t = e.enemies.length ? e.enemies.reduce((i, r) => Me(i + r.stats.maxHp * 0.08 + r.stats.attack * 4 + r.stats.defense * 2), 0) : Me((190 + e.floor * 11.5) * e.difficulty), n = 1 + e.encounter.risk * (e.encounter.outcomeRoll - 0.5);
  return Math.round(Me(t * e.encounter.powerMultiplier * n));
}, si = (e, t) => {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("Endless party power must be finite and non-negative");
  const n = e.encounterType === "REST" || t >= ao(e);
  return {
    outcome: n ? "PLAYER" : "ENEMY",
    turns: 0,
    encounterType: e.encounterType,
    recoveredRatio: n ? e.encounter.recoveryRatio : 0
  };
}, hn = (e) => {
  if (!Number.isSafeInteger(e) || e < 0 || e > dt) throw new RangeError("Endless resonance integrity is invalid");
  return 0.75 + e / dt * 0.25;
}, co = (e, t, n) => {
  const i = e.resonanceIntegrity;
  hn(i);
  const s = n ? Math.round({
    BATTLE: 3,
    MINING: 2,
    TREASURE: 3,
    ELITE: 7,
    REST: 0,
    RANDOM_EVENT: 5,
    BOSS: 10
  }[t.encounterType] * (0.75 + t.encounter.outcomeRoll * 0.5)) : Math.ceil(8 + t.encounter.risk * 12), o = Math.max(0, i - s), a = n ? Math.round(t.encounter.recoveryRatio * dt) : 0;
  return e.resonanceIntegrity = Math.min(dt, o + a), e.resonanceIntegrity - o;
}, lo = (e, t = "ACTIVE") => {
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
    resonanceIntegrity: dt
  };
}, sn = ["CORE", "RUNE", "RELIC", "CHARM"], Xt = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"], qt = {
  BASTION: { id: "BASTION", name: "Bastion", bonuses: [{ pieces: 2, stat: "defense", value: 0.12 }, { pieces: 4, stat: "maxHp", value: 0.2 }] },
  RESONANCE: { id: "RESONANCE", name: "Resonance", bonuses: [{ pieces: 2, stat: "ultimateStart", value: 12 }, { pieces: 4, stat: "speed", value: 0.15 }] },
  HUNTER: { id: "HUNTER", name: "Hunter", bonuses: [{ pieces: 2, stat: "critChance", value: 0.1 }, { pieces: 4, stat: "critDamage", value: 0.35 }] },
  ABYSSAL: { id: "ABYSSAL", name: "Abyssal", bonuses: [{ pieces: 2, stat: "breakPower", value: 0.15 }, { pieces: 4, stat: "attack", value: 0.18 }] }
}, $n = (e) => {
  const t = { NORMAL: "COMMON", RARE: "UNCOMMON", SR: "RARE", SSR: "EPIC", UR: "LEGENDARY", LEGENDARY: "MYTHIC" }, n = { maxHp: "maxHp", power: "attack", defense: "defense", speed: "speed", purity: "accuracy", hardness: "resistance", resonance: "breakPower" }, i = e.setId ?? ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"].find((s) => e.definitionId.startsWith(`${s}_`)) ?? null, r = ["NORMAL", "RARE", "SR", "SSR", "UR", "LEGENDARY"].indexOf(e.rarity) + 1;
  return {
    id: e.instanceId,
    name: e.definitionId.replaceAll("_", " ").toLowerCase(),
    slot: e.slot,
    rarity: t[e.rarity],
    level: e.level,
    setId: i,
    locked: e.locked,
    affixes: e.affixes.map((s, o) => ({
      id: `${s.sourceStat ?? s.stat}:${o}`,
      stat: s.sourceStat ?? n[s.stat],
      value: s.value,
      tier: Math.max(1, Math.min(10, r))
    })),
    score: Math.max(1, Math.round(e.level * 4 + r * 100 + e.affixes.reduce((s, o) => s + Math.abs(o.value) * (o.operation === "PERCENT" ? 1e3 : 1), 0)))
  };
}, lr = 1e4, $t = Number.MAX_SAFE_INTEGER, De = (e) => Xt.indexOf(e), uo = { COMMON: 1, UNCOMMON: 2, RARE: 3, EPIC: 4, LEGENDARY: 5, MYTHIC: 6 }, dr = ["maxHp", "attack", "defense", "speed", "accuracy", "resistance", "critChance", "critDamage", "breakPower"], mo = Object.keys(qt), be = (e, t, n = 0, i = Vt) => {
  if (!Number.isFinite(e) || e < n || e > i) throw new RangeError(`${t} must be finite and within ${n}..${i}`);
  return e;
}, Ut = (e, t = Vt) => Number.isFinite(e) ? Math.max(0, Math.min(t, e)) : e > 0 ? t : 0, po = (e, t) => (be(e, "salvageMaterials", 0, $t), be(t, "materialsGained", 0, $t), Math.min($t, e + t)), fo = (e, t) => {
  const n = Math.min(3, Math.log10(e + 1) * 0.45);
  return t.weighted(Xt, (i) => ([5e3, 2500, 900, 250, 55, 8][De(i)] ?? 1) * Math.pow(1 + n, De(i)));
}, ho = (e, t, n, i, r) => {
  const s = 0.85 + r.next() * 0.3, o = De(n) + 1;
  return e === "maxHp" ? Math.round(Ut((15 + t * 3.5) * o * i * s)) : e === "attack" || e === "defense" ? Math.round(Ut((3 + t * 0.55) * o * i * s)) : Math.round(Math.min(5, (e === "speed" ? 8e-3 : e === "critDamage" ? 0.025 : 0.012) * o * i * s) * 1e5) / 1e5;
}, Eo = (e, t, n) => {
  const i = e.reduce((r, s) => {
    const o = s.stat === "maxHp" ? s.value / 10 : s.stat === "attack" || s.stat === "defense" ? s.value : s.value * 1e3;
    return Ut(r + o * s.tier);
  }, 0);
  return Math.round(Ut(i + t * 4 + (De(n) + 1) * 100));
}, En = (e) => {
  if (!e.id || !e.name || !sn.includes(e.slot) || !Xt.includes(e.rarity))
    throw new TypeError("Invalid equipment identity");
  if (be(e.level, `${e.id}.level`, 1, 1e6), be(e.score, `${e.id}.score`), e.setId && !qt[e.setId]) throw new RangeError(`Unknown set ${e.setId}`);
  for (const t of e.affixes) {
    if (!t.id || !dr.includes(t.stat)) throw new TypeError(`Invalid affix on ${e.id}`);
    be(t.value, `${e.id}.${t.id}.value`), be(t.tier, `${e.id}.${t.id}.tier`, 1, 10);
  }
}, ur = (e, t) => {
  const n = Math.floor(be(e.level, "equipment.level", 1, 1e6)), i = e.slot ?? t.pick(sn), r = e.rarity ?? fo(n, t);
  if (!sn.includes(i) || !Xt.includes(r)) throw new RangeError("Unknown equipment slot or rarity");
  const s = e.setId === void 0 ? t.chance(Math.min(0.65, 0.12 + De(r) * 0.08)) ? t.pick(mo) : null : e.setId;
  if (s && !qt[s]) throw new RangeError(`Unknown equipment set ${s}`);
  const a = t.shuffle(dr).slice(0, uo[r]).map((f, y) => {
    const h = Math.min(10, 1 + De(r) + t.int(0, 2));
    return { id: `${f}:${y}`, stat: f, value: ho(f, n, r, h, t), tier: h };
  }), d = {
    id: `eq:${(e.source ?? "mine").replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "drop"}:${n}:${t.int(0, 2147483647).toString(36)}:${t.int(0, 2147483647).toString(36)}`,
    name: `${s ? qt[s].name : r.toLowerCase()} ${i.toLowerCase()}`,
    slot: i,
    rarity: r,
    level: n,
    setId: s,
    affixes: a,
    score: Eo(a, n, r),
    locked: !1
  };
  return En(d), d;
}, go = (e = 300, t = 0) => ({
  capacity: Math.floor(be(e, "inventory.capacity", 1, lr)),
  items: [],
  salvageMaterials: be(t, "inventory.salvageMaterials", 0, $t)
}), mr = (e, t = {}) => (En(e), e.locked || e.setId && t.alwaysKeepSets?.includes(e.setId) ? !0 : !(t.allowedSlots && !t.allowedSlots.includes(e.slot) || t.minRarity && De(e.rarity) < De(t.minRarity) || t.minScore !== void 0 && e.score < be(t.minScore, "lootFilter.minScore"))), Io = (e) => (En(e), Math.max(1, Math.floor(Ut((De(e.rarity) + 1) ** 2 * (10 + Math.sqrt(e.level) * 8))))), Lt = (e, t) => {
  const n = Io(t), i = e.salvageMaterials;
  return e.salvageMaterials = po(i, n), e.salvageMaterials - i;
}, So = (e, t) => {
  const n = e.items.findIndex((s) => s.id === t);
  if (n < 0) throw new RangeError(`Equipment ${t} is not in inventory`);
  const i = e.items[n];
  if (!i || i.locked) throw new RangeError(`Equipment ${t} cannot be salvaged`);
  e.items.splice(n, 1);
  const r = Lt(e, i);
  return { accepted: !1, salvagedIds: [i.id], materialsGained: r, reason: "SALVAGED" };
}, Pt = (e, t, n = {}) => {
  if (En(t), be(e.capacity, "inventory.capacity", 1, lr), !Number.isSafeInteger(e.capacity)) throw new RangeError("inventory.capacity must be a safe integer");
  if (be(e.salvageMaterials, "inventory.salvageMaterials", 0, $t), e.items.length > e.capacity) throw new RangeError("Inventory is already over capacity");
  if (e.items.some((o) => o.id === t.id)) throw new RangeError(`Duplicate equipment id ${t.id}`);
  if (!mr(t, n) && n.autoSalvage) {
    const o = Lt(e, t);
    return { accepted: !1, salvagedIds: [t.id], materialsGained: o, reason: "FILTERED" };
  }
  if (e.items.length < e.capacity)
    return e.items.push(t), { accepted: !0, salvagedIds: [], materialsGained: 0, reason: "ADDED" };
  if (!n.autoSalvage) {
    if (t.locked) throw new RangeError("Locked equipment cannot enter a full inventory");
    const o = Lt(e, t);
    return { accepted: !1, salvagedIds: [t.id], materialsGained: o, reason: "CAPACITY" };
  }
  const i = e.items.filter((o) => !o.locked && !(o.setId && n.alwaysKeepSets?.includes(o.setId))).sort((o, a) => o.score - a.score || De(o.rarity) - De(a.rarity) || o.id.localeCompare(a.id))[0];
  if (!i || i.score >= t.score) {
    const o = Lt(e, t);
    return { accepted: !1, salvagedIds: [t.id], materialsGained: o, reason: "CAPACITY" };
  }
  const r = e.items.findIndex((o) => o.id === i.id);
  e.items.splice(r, 1, t);
  const s = Lt(e, i);
  return { accepted: !0, salvagedIds: [i.id], materialsGained: s, reason: "REPLACED" };
}, Ce = (e, t) => {
  const n = (i) => Number.isFinite(i) ? Math.max(0, Math.floor(i)) : i > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return Math.min(Number.MAX_SAFE_INTEGER, n(e) + n(t));
}, pr = {
  maxHp: "maxHp",
  power: "attack",
  defense: "defense",
  hardness: "defense",
  purity: "resistance",
  speed: "speed",
  resonance: "breakPower"
}, yo = ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"], Ao = (e) => e.setId ?? yo.find((t) => e.definitionId.startsWith(`${t}_`)) ?? null, it = (e, t) => e * (1 + t), wo = (e) => {
  const t = e.skills.flatMap((i) => Ze[i.skillId]?.tags ?? []);
  if (t.includes("support")) return "SUPPORT";
  if (t.includes("control") && e.stats.speed >= e.stats.power) return "CONTROLLER";
  if (t.some((i) => i === "break") || e.traitIds.some((i) => /fract|break/i.test(i))) return "BREAKER";
  const n = re[e.speciesId]?.role;
  return n === "TANK" ? "GUARDIAN" : n === "SUPPORT" ? "SUPPORT" : n === "CONTROL" ? "CONTROLLER" : e.stats.defense > e.stats.power * 1.2 ? "VANGUARD" : "STRIKER";
}, vo = (e) => e.type, Mo = (e) => e === "BURN" ? { kind: "STATUS", status: "BURN" } : e === "FRACTURE" ? { kind: "STATUS", status: "CRACK" } : e === "STUN" ? { kind: "STATUS", status: "STUN" } : e === "REGEN" ? { kind: "STATUS", status: "REGENERATION" } : e === "TAUNT" ? { kind: "CONTROL", control: "TAUNT" } : { kind: "STATUS", status: "VULNERABLE" }, Ro = (e) => {
  const t = e.type === "STATUS" ? Mo(e.statusId) : void 0;
  return {
    kind: t?.kind ?? vo(e),
    power: e.power ?? (e.type === "STATUS" ? e.value : void 0),
    value: e.value === void 0 ? void 0 : Math.abs(e.value),
    duration: e.duration,
    chance: e.chance,
    stat: e.stat ? pr[e.stat] : void 0,
    control: t?.control,
    status: t?.status
  };
}, fr = (e) => ({
  id: e.id,
  name: e.name,
  target: e.target === "ALLY" ? "ALLY_LOWEST" : e.target,
  element: e.element,
  effects: e.effects.flatMap((t) => [
    Ro(t),
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
}), hr = (e, t = "PLAYER") => {
  const n = re[e.speciesId], i = e.mutation === "PERFECT" ? 1.08 : e.mutation === "ANCIENT" || e.mutation === "PRISMATIC" ? 1.04 : 1, r = 1 + Math.min(0.07, e.affinity.rank * 0.01), s = Object.values(e.equipment).filter((y) => !!y), a = e.skills.map((y) => Ze[y.skillId]).filter((y) => !!y).map((y) => y.id);
  a.length || a.push("strike");
  const c = e.parents[0]?.speciesId ? `lineage:${e.parents[0].speciesId}` : n?.family, l = {
    maxHp: Math.max(1, e.stats.maxHp * i * r),
    attack: Math.max(1, e.stats.power * i * r),
    defense: Math.max(1, (e.stats.defense + e.stats.hardness * 0.2) * i * r),
    speed: Math.max(1, e.stats.speed * (1 + e.individualValues.speed / 310)),
    accuracy: Math.max(1, 92 + e.individualValues.purity * 1.2 + e.stats.purity * 0.08),
    resistance: Math.max(1, 82 + e.individualValues.hardness + e.stats.hardness * 0.12),
    critChance: Math.min(0.65, 0.05 + e.potential / 1e3 + e.individualValues.power / 620),
    critDamage: Math.min(3, 1.45 + e.individualValues.power / 155),
    breakPower: Math.max(1, 15 + e.stats.resonance * 0.22 + e.individualValues.resonance * 0.7)
  };
  for (const y of e.traitIds)
    for (const h of Nt[y]?.effects ?? []) {
      if (h.trigger !== "ALWAYS" && h.trigger !== "BATTLE_START" || !h.stat || h.value === void 0) continue;
      const u = pr[h.stat];
      u && (u === "critChance" || u === "critDamage" || (l[u] = Math.max(1, h.operation === "PERCENT" ? it(l[u], h.value) : l[u] + h.value)));
    }
  let d = 0;
  for (const y of s)
    for (const h of y.affixes) {
      const u = h.sourceStat ?? (h.stat === "power" ? "attack" : h.stat === "purity" ? "accuracy" : h.stat === "hardness" ? "resistance" : h.stat === "resonance" ? "breakPower" : h.stat), I = h.operation === "PERCENT";
      u === "maxHp" || u === "attack" || u === "defense" || u === "speed" || u === "accuracy" || u === "resistance" || u === "breakPower" ? l[u] = Math.max(1, I ? it(l[u], h.value) : l[u] + h.value) : u === "critChance" ? l.critChance = Math.max(0, l.critChance + (I ? h.value : h.value / 100)) : l.critDamage = Math.max(1, l.critDamage + (I ? h.value : h.value / 100));
    }
  const f = /* @__PURE__ */ new Map();
  for (const y of s) {
    const h = Ao(y);
    h && f.set(h, (f.get(h) ?? 0) + 1);
  }
  return (f.get("BASTION") ?? 0) >= 2 && (l.defense = it(l.defense, 0.12)), (f.get("BASTION") ?? 0) >= 4 && (l.maxHp = it(l.maxHp, 0.2)), (f.get("RESONANCE") ?? 0) >= 2 && (d += 12), (f.get("RESONANCE") ?? 0) >= 4 && (l.speed = it(l.speed, 0.15)), (f.get("HUNTER") ?? 0) >= 2 && (l.critChance += 0.1), (f.get("HUNTER") ?? 0) >= 4 && (l.critDamage += 0.35), (f.get("ABYSSAL") ?? 0) >= 2 && (l.breakPower = it(l.breakPower, 0.15)), (f.get("ABYSSAL") ?? 0) >= 4 && (l.attack = it(l.attack, 0.18)), {
    id: e.instanceId,
    name: e.nickname || e.name,
    side: t,
    role: wo(e),
    family: c,
    element: e.primaryElement,
    level: e.level,
    stats: {
      maxHp: Math.round(l.maxHp),
      attack: Math.round(l.attack),
      defense: Math.round(l.defense),
      speed: Math.round(l.speed),
      accuracy: Math.round(l.accuracy),
      resistance: Math.round(l.resistance),
      critChance: Math.min(0.95, l.critChance),
      critDamage: Math.min(5, l.critDamage),
      breakPower: Math.round(l.breakPower)
    },
    skillIds: a,
    initialUltimate: Math.min(100, e.affinity.rank * 4 + e.awakeningStage * 3 + d)
  };
}, Er = (e) => {
  const t = e.flatMap((n) => n.skills).map((n) => Ze[n.skillId]).filter((n) => !!n);
  return Object.freeze({
    ...qs,
    ...Object.fromEntries(t.map((n) => [n.id, fr(n)]))
  });
}, Re = 300 * 1e3, Ti = 720 * 60 * 60 * 1e3, To = 1, gn = (e) => {
  const t = e.getTime();
  if (!Number.isSafeInteger(t) || t < 0) throw new RangeError("Invalid Endless Mine timestamp");
  return t;
}, gr = (e) => {
  const t = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())), n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const i = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)), r = Math.ceil(((t.getTime() - i.getTime()) / 864e5 + 1) / 7);
  return `weekly:${t.getUTCFullYear()}-${String(r).padStart(2, "0")}`;
}, Ir = (e = /* @__PURE__ */ new Date(0)) => ({
  version: To,
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
  weeklySeed: gr(e),
  weeklyHighestFloor: 0,
  winStreak: 0,
  pendingCredits: 0,
  equipment: go(300),
  lootFilter: { minRarity: "RARE", autoSalvage: !0, alwaysKeepSets: ["ABYSSAL"] },
  recentLog: [],
  claimLedger: {}
}), Ne = (e, t) => {
  e.recentLog = [...e.recentLog, t].slice(-80);
}, ye = (e) => {
  if (!e.run || !e.runId) throw new Error("No Endless Mine run exists");
  return e.run;
}, bo = (e, t) => {
  const n = ye(e);
  n.currentFloor = t, n.status = "COMPLETE", e.status = "ENDED", e.nextFloorAt = null, Ne(e, `最深部 Floor ${t} を踏破。Endless Mine complete。`);
}, No = (e, t, n, i, r) => {
  if (e.status === "RUNNING" || e.status === "PAUSED") throw new Error("Endless Mine is already active");
  if (e.runId && !e.claimLedger[e.runId]) throw new Error("Claim the previous Endless Mine run before starting another");
  if (n.length < 1 || n.length > 3 || new Set(n).size !== n.length) throw new Error("Endless Mine requires 1-3 unique Stones");
  const s = n.map((l) => t[l] ?? (() => {
    throw new Error(`Stone not found: ${l}`);
  })()), o = gn(i), a = `endless:${o}:${r}`, c = gr(i);
  return e.weeklySeed !== c && (e.weeklyHighestFloor = 0), e.weeklySeed = c, e.runId = a, e.run = lo(c, "AUTO"), e.status = "RUNNING", e.partyStoneIds = [...n], e.partySnapshot = s.map((l) => hr(l)), e.skillBook = Er(s), e.manualMode = !1, e.startedAt = i.toISOString(), e.lastProcessedAt = i.toISOString(), e.nextFloorAt = new Date(o + Re).toISOString(), e.activeFloor = null, e.activeBattle = null, e.winStreak = 0, e.pendingCredits = 0, Ne(e, "潜行を開始。Party buildを固定しました。"), e;
}, ko = (e, t) => {
  const n = ye(e);
  e.manualMode = t, n.mode = t ? "ACTIVE" : "AUTO", t && e.status === "RUNNING" && Sr(e);
}, Sr = (e) => {
  const t = ye(e);
  if (t.status !== "CLIMBING") throw new Error("Endless run is not climbing");
  if (e.activeBattle && !e.activeBattle.outcome) return e.activeBattle;
  for (let n = 0; n < 10 && e.status === "RUNNING"; n += 1) {
    const i = ii(t.currentFloor, t.seed);
    if (!cr(i)) {
      const r = si(i, ri(e.partySnapshot) * Rt.efficiency.ACTIVE * hn(t.resonanceIntegrity));
      Ne(e, `Floor ${i.floor}: ${i.encounter.label} / ${i.encounter.description}`), In(e, i, r.outcome, "ACTIVE");
      continue;
    }
    return e.activeFloor = i, e.activeBattle = Jn({ units: [...e.partySnapshot, ...i.enemies], skills: e.skillBook, maxTurns: 80 }), Ne(e, `Floor ${i.floor}: ${i.encounter.label}出現。`), e.activeBattle;
  }
  if (e.status === "RUNNING") throw new Error("Unable to prepare the next Endless battle");
  return null;
}, _o = (e, t) => {
  const n = new Ee(`${ye(e).seed}:equipment:${t.floor}`), i = Math.min(1, t.encounter.equipmentChance + (t.encounterType === "BATTLE" ? t.floor * 5e-4 : 0));
  if (!n.chance(i)) return { added: 0, salvaged: 0 };
  const r = t.isBossFloor && t.floor >= 100 ? "EPIC" : t.encounterType === "ELITE" && t.floor >= 50 ? "RARE" : void 0, s = ur({ level: t.floor, rarity: r, source: `endless-${t.floor}` }, n), o = Pt(e.equipment, s, e.lootFilter);
  return Ne(e, o.accepted ? `${s.rarity} ${s.name}を獲得。` : `${s.name}を容量保護${o.reason === "FILTERED" ? "・Loot Filter" : ""}分解（素材 +${o.materialsGained}）。`), { added: o.accepted ? 1 : 0, salvaged: o.salvagedIds.length };
}, In = (e, t, n, i) => {
  const r = ye(e), s = t.floor;
  r.battles = Ce(r.battles, 1);
  const o = co(r, t, n === "PLAYER");
  let a = 0, c = 0, l = 0, d = 0;
  if (n === "PLAYER") {
    const f = t.floor > r.highestClearedFloor;
    if (f && (a = Math.floor(t.baseReward * Rt.efficiency[i]), r.totalReward = Math.min(rn, Ce(r.totalReward, a)), e.pendingCredits = Ce(e.pendingCredits, a), r.highestClearedFloor = t.floor), e.highestFloor = Math.max(e.highestFloor, t.floor), e.weeklyHighestFloor = Math.max(e.weeklyHighestFloor, t.floor), e.winStreak = Ce(e.winStreak, 1), f && t.isBossFloor && (r.clearedBosses = Ce(r.clearedBosses, 1), d = 1), t.floor % 10 === 0 && (r.checkpointFloor = t.floor), f) {
      const h = _o(e, t);
      c = h.added, l = h.salvaged;
    }
    const y = o > 0 ? ` / 共鳴完全性 +${o} (${r.resonanceIntegrity}/100)` : ` / 共鳴完全性 ${r.resonanceIntegrity}/100`;
    Ne(e, `Floor ${t.floor} ${t.encounterType} clear / CREDIT +${a.toLocaleString("en-US")}${y}`), t.floor >= Rt.maxFloor ? bo(e, t.floor) : r.currentFloor = t.floor + 1;
  } else
    r.status = "DEFEATED", r.lastDefeatFloor = t.floor, e.status = "ENDED", e.nextFloorAt = null, e.winStreak = 0, Ne(e, `Floor ${t.floor} ${t.encounterType}で共鳴崩壊。Checkpoint ${r.checkpointFloor}へ帰還可能。`);
  return e.activeBattle = null, e.activeFloor = null, { attemptedFloors: 1, clearedFloors: n === "PLAYER" ? 1 : 0, fromFloor: s, toFloor: r.currentFloor, credits: a, equipmentAdded: c, equipmentSalvaged: l, bossClears: d, defeated: n !== "PLAYER" };
}, yr = (e) => {
  const t = e.activeBattle, n = e.activeFloor;
  return !t?.outcome || !n ? null : In(e, n, t.outcome, e.manualMode ? "ACTIVE" : "AUTO");
}, Co = (e, t, n) => {
  if (e.status !== "RUNNING" || !e.manualMode) throw new Error("Manual Endless battle is not active");
  const i = Sr(e);
  if (!i) throw new Error("The Endless encounter resolved without a manual battle");
  const r = Qn(i).find((d) => i.units.find((f) => f.id === d)?.side === "PLAYER");
  if (!r) throw new Error("No living player actor");
  if (!pn(i, r).some((d) => d.id === t)) throw new Error("Selected skill is not usable");
  const s = { actorId: r, skillId: t, targetIds: n }, o = Mt(e.strategy), a = Mt("AGGRESSIVE"), c = new Ee(`${ye(e).seed}:manual:${ye(e).currentFloor}:${i.turn}`);
  fn(i, {
    commands: { [r]: s },
    commandProvider: (d, f, y) => d.units.find((h) => h.id === f)?.side === "PLAYER" ? o(d, f, y) : a(d, f, y)
  }, c);
  const l = i.log.slice(-i.units.length).map((d) => `${d.actorId}: ${d.skillId}`);
  for (const d of l) Ne(e, d);
  return yr(e);
}, xo = (e) => {
  const t = ye(e), n = t.currentFloor, i = e.activeFloor?.floor === n ? e.activeFloor : ii(n, t.seed);
  if (!cr(i)) {
    if (e.activeBattle) throw new Error("Non-combat Endless floor cannot retain a battle");
    const a = si(i, ri(e.partySnapshot) * Rt.efficiency.AUTO * hn(t.resonanceIntegrity));
    return Ne(e, `Floor ${i.floor}: ${i.encounter.label} / ${i.encounter.description}`), In(e, i, a.outcome, "AUTO");
  }
  const r = e.activeBattle && e.activeFloor?.floor === n && !e.activeBattle.outcome ? e.activeBattle : Jn({ units: [...e.partySnapshot, ...i.enemies], skills: e.skillBook, maxTurns: 80 }), s = Mt(e.strategy), o = Mt(i.isBossFloor ? "BOSS_FOCUS" : "AGGRESSIVE");
  return rr(r, (a, c, l) => a.units.find((d) => d.id === c)?.side === "PLAYER" ? s(a, c, l) : o(a, c, l), new Ee(`${t.seed}:auto:${n}:${r.turn}`)), e.activeFloor = i, e.activeBattle = r, yr(e);
}, Ar = (e, t = 1, n = /* @__PURE__ */ new Date()) => {
  if (e.status !== "RUNNING" || e.manualMode) throw new Error("Auto Endless Mine is not running");
  if (!Number.isSafeInteger(t) || t < 0 || t > 1e4) throw new RangeError("Invalid floor batch size");
  const i = ye(e).currentFloor, r = { attemptedFloors: 0, clearedFloors: 0, fromFloor: i, toFloor: i, credits: 0, equipmentAdded: 0, equipmentSalvaged: 0, bossClears: 0, defeated: !1 };
  if (t === 0) return r;
  const s = gn(n), o = Date.parse(e.nextFloorAt ?? "");
  if (!Number.isFinite(o)) throw new Error("Auto Endless Mine has no valid next floor time");
  if (s < o) throw new Error("The next Endless Mine floor is not ready yet");
  const a = Math.min(1e4, Math.floor((s - o) / Re) + 1), c = Math.min(t, a);
  for (; r.attemptedFloors < c && e.status === "RUNNING"; ) {
    const d = xo(e);
    r.attemptedFloors += 1, r.clearedFloors += d.clearedFloors, r.credits = Ce(r.credits, d.credits), r.equipmentAdded += d.equipmentAdded, r.equipmentSalvaged += d.equipmentSalvaged, r.bossClears += d.bossClears, r.defeated ||= d.defeated;
  }
  r.toFloor = ye(e).currentFloor;
  const l = o + Math.max(0, r.attemptedFloors - 1) * Re;
  return e.lastProcessedAt = new Date(l).toISOString(), e.nextFloorAt = e.status === "RUNNING" ? new Date(o + r.attemptedFloors * Re).toISOString() : null, r;
}, Lo = (e, t) => {
  const n = ye(e), i = Date.parse(e.lastProcessedAt ?? e.startedAt ?? t.toISOString()), r = gn(t), s = n.currentFloor, o = { attemptedFloors: 0, clearedFloors: 0, fromFloor: s, toFloor: s, credits: 0, equipmentAdded: 0, equipmentSalvaged: 0, bossClears: 0, defeated: !1 };
  if (e.status !== "RUNNING" || e.manualMode || !Number.isFinite(i) || r <= i) return o;
  const a = Date.parse(e.nextFloorAt ?? new Date(i + Re).toISOString());
  if (!Number.isFinite(a) || r < a) return o;
  const c = Math.max(a, r - Ti + Re), l = Math.min(
    Math.floor(Ti / Re),
    Math.floor((r - c) / Re) + 1
  ), d = { ...o }, f = ri(e.partySnapshot) * Rt.efficiency.OFFLINE;
  for (; d.attemptedFloors < l && e.status === "RUNNING"; ) {
    const h = ii(n.currentFloor, n.seed), u = si(h, f * hn(n.resonanceIntegrity)), I = In(e, h, u.outcome, "OFFLINE");
    d.attemptedFloors += I.attemptedFloors, d.clearedFloors += I.clearedFloors, d.credits = Ce(d.credits, I.credits), d.equipmentAdded += I.equipmentAdded, d.equipmentSalvaged += I.equipmentSalvaged, d.bossClears += I.bossClears, d.defeated ||= I.defeated;
  }
  d.toFloor = n.currentFloor;
  const y = c + Math.max(0, d.attemptedFloors - 1) * Re;
  return e.lastProcessedAt = new Date(y).toISOString(), e.nextFloorAt = e.status === "RUNNING" ? new Date(c + d.attemptedFloors * Re).toISOString() : null, d.clearedFloors && Ne(e, `OFFLINE: Floor ${s} → ${n.currentFloor} / ${d.clearedFloors} clear。`), d;
}, Do = (e, t) => {
  if (e.status !== "RUNNING") throw new Error("Endless Mine is not running");
  e.status = "PAUSED", e.lastProcessedAt = t.toISOString(), e.nextFloorAt = null, Ne(e, "潜行を一時停止。");
}, Oo = (e, t) => {
  const n = ye(e);
  if (e.status !== "PAUSED" && !(e.status === "ENDED" && n.status === "DEFEATED")) throw new Error("Endless Mine cannot resume");
  const i = n.status === "DEFEATED";
  i && (n.currentFloor = Math.max(1, n.checkpointFloor + 1), n.resonanceIntegrity = Math.max(50, n.resonanceIntegrity), n.status = "CLIMBING", e.activeBattle = null, e.activeFloor = null), e.status = "RUNNING", e.lastProcessedAt = t.toISOString(), e.nextFloorAt = new Date(gn(t) + Re).toISOString(), Ne(e, i ? `Checkpoint ${n.checkpointFloor}から潜行再開。` : "中断した戦闘状態から潜行再開。");
}, $o = (e, t) => {
  vr(t), e.lootFilter = { ...t, allowedSlots: t.allowedSlots ? [...t.allowedSlots] : void 0, alwaysKeepSets: t.alwaysKeepSets ? [...t.alwaysKeepSets] : void 0 };
}, Po = (e) => {
  const t = ye(e), n = e.runId;
  if (e.claimLedger[n]) throw new Error("Endless Mine reward was already claimed");
  if (e.status === "RUNNING") throw new Error("Pause or retreat before claiming Endless rewards");
  const i = e.pendingCredits, r = e.equipment.salvageMaterials;
  return e.claimLedger[n] = !0, e.pendingCredits = 0, e.equipment.salvageMaterials = 0, e.status = "ENDED", e.nextFloorAt = null, e.activeBattle = null, e.activeFloor = null, { runId: n, credits: i, upgradeDust: r, highestFloor: t.highestClearedFloor, equipmentCount: e.equipment.items.length };
}, ae = (e) => !!e && typeof e == "object" && !Array.isArray(e), xe = (e, t = 0) => typeof e == "number" && Number.isSafeInteger(e) && e >= t, Fo = (e, t = !1) => e === null ? t : typeof e == "string" && Number.isFinite(Date.parse(e)), Tt = (e, t = 0, n = 1e12) => typeof e == "number" && Number.isFinite(e) && e >= t && e <= n, Se = (e, t = 256) => typeof e == "string" && e.length > 0 && e.length <= t, Bo = ["maxHp", "attack", "defense", "speed", "accuracy", "resistance", "critChance", "critDamage", "breakPower"], Go = ["VANGUARD", "TANK", "GUARDIAN", "STRIKER", "BREAKER", "SUPPORT", "CONTROLLER"], qo = ["SELF", "ALLY_LOWEST", "ALL_ALLIES", "ENEMY", "ALL_ENEMIES", "BOSS"], Uo = ["DAMAGE", "HEAL", "SHIELD", "BUFF", "DEBUFF", "DOT", "CONTROL", "BREAK", "COUNTER", "ULTIMATE_GAIN", "STATUS"], oi = (e, t = !1) => {
  if (!ae(e) || !Se(e.id) || !Se(e.name) || !["PLAYER", "ENEMY"].includes(String(e.side)) || !Go.includes(String(e.role))) throw new Error("Invalid Endless combatant identity");
  if (!xe(e.level, 1) || !ae(e.stats)) throw new Error("Invalid Endless combatant progression");
  for (const n of Bo) if (!Tt(e.stats[n])) throw new Error(`Invalid Endless combatant ${n}`);
  if (!Array.isArray(e.skillIds) || e.skillIds.length > 64 || e.skillIds.some((n) => !Se(n)) || new Set(e.skillIds).size !== e.skillIds.length) throw new Error("Invalid Endless combatant skills");
  if (t) {
    for (const n of ["hp", "shield", "ultimate", "breakGauge"]) if (!Tt(e[n])) throw new Error(`Invalid Endless battle unit ${n}`);
    if (typeof e.alive != "boolean" || !ae(e.cooldowns) || Object.values(e.cooldowns).some((n) => !xe(n))) throw new Error("Invalid Endless battle unit state");
    for (const n of ["modifiers", "dots", "controls", "statuses"]) if (!Array.isArray(e[n]) || e[n].length > 256) throw new Error(`Invalid Endless battle unit ${n}`);
    if (e.counter !== null && !ae(e.counter)) throw new Error("Invalid Endless battle counter");
    if (e.bossState !== null && !ae(e.bossState)) throw new Error("Invalid Endless battle boss state");
  }
}, wr = (e) => {
  if (!ae(e) || Object.keys(e).length > 256) throw new Error("Invalid Endless Mine skill book");
  for (const [t, n] of Object.entries(e)) {
    if (!ae(n) || n.id !== t || !Se(n.id) || !Se(n.name) || !qo.includes(String(n.target)) || !Array.isArray(n.effects) || n.effects.length > 32) throw new Error("Invalid Endless skill definition");
    for (const i of n.effects) {
      if (!ae(i) || !Uo.includes(String(i.kind))) throw new Error("Invalid Endless skill effect");
      for (const r of ["power", "value", "duration", "chance"]) if (i[r] !== void 0 && !Tt(i[r], -1e12)) throw new Error(`Invalid Endless skill effect ${r}`);
    }
  }
}, Ho = (e) => {
  if (!ae(e) || !xe(e.floor, 1) || e.floor > Fe || !["CRYSTAL_CAVERN", "MAGMA_VEIN", "FOSSIL_DEPTHS", "ASTRAL_RIFT"].includes(String(e.biome)) || typeof e.isBossFloor != "boolean" || !Tt(e.difficulty) || !xe(e.baseReward)) throw new Error("Invalid Endless active floor");
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
  if (!Qs.includes(e.encounterType)) throw new Error("Invalid Endless encounter type");
  if (e.encounterType === "BOSS" !== e.isBossFloor) throw new Error("Invalid Endless boss encounter");
  if (!ae(e.encounter) || !Se(e.encounter.label) || !Se(e.encounter.description)) throw new Error("Invalid Endless encounter definition");
  for (const n of ["rewardMultiplier", "powerMultiplier", "equipmentChance", "recoveryRatio", "risk", "outcomeRoll"])
    if (!Tt(e.encounter[n], 0, n === "rewardMultiplier" || n === "powerMultiplier" ? 10 : 1)) throw new Error(`Invalid Endless encounter ${n}`);
  if (!Array.isArray(e.rules) || e.rules.length > 8 || e.rules.some((n) => !ae(n) || !Se(n.id) || !Se(n.label))) throw new Error("Invalid Endless floor rules");
  const t = e.encounterType === "BATTLE" || e.encounterType === "ELITE" || e.encounterType === "BOSS";
  if (!Array.isArray(e.enemies) || e.enemies.length > 16 || (t ? e.enemies.length < 1 : e.enemies.length !== 0)) throw new Error("Invalid Endless floor enemies");
  for (const n of e.enemies) oi(n);
}, Yo = (e) => {
  if (!ae(e) || !Array.isArray(e.units) || e.units.length < 1 || e.units.length > 32 || !xe(e.turn) || !xe(e.maxTurns, 1) || e.maxTurns > 1e4 || ![null, "PLAYER", "ENEMY", "DRAW"].includes(e.outcome) || !Array.isArray(e.log) || e.log.length > 1e5 || !ae(e.synergies)) throw new Error("Invalid Endless active battle");
  for (const t of e.units) oi(t, !0);
  wr(e.skills);
}, vr = (e) => {
  if (!ae(e) || Object.keys(e).some((n) => !["minRarity", "minScore", "allowedSlots", "alwaysKeepSets", "autoSalvage"].includes(n))) throw new Error("Invalid Endless loot filter");
  if (e.minRarity !== void 0 && !Xt.includes(e.minRarity)) throw new Error("Invalid Endless loot rarity");
  if (e.minScore !== void 0 && !Tt(e.minScore)) throw new Error("Invalid Endless loot score");
  if (e.autoSalvage !== void 0 && typeof e.autoSalvage != "boolean") throw new Error("Invalid Endless auto salvage");
  if (e.allowedSlots !== void 0 && (!Array.isArray(e.allowedSlots) || e.allowedSlots.some((n) => !sn.includes(n)) || new Set(e.allowedSlots).size !== e.allowedSlots.length)) throw new Error("Invalid Endless allowed slots");
  const t = Object.keys(qt);
  if (e.alwaysKeepSets !== void 0 && (!Array.isArray(e.alwaysKeepSets) || e.alwaysKeepSets.some((n) => !t.includes(String(n))) || new Set(e.alwaysKeepSets).size !== e.alwaysKeepSets.length)) throw new Error("Invalid Endless kept sets");
}, jo = (e) => {
  if (!ae(e) || e.version !== 1) throw new Error("Invalid Endless Mine state version");
  if (!["READY", "RUNNING", "PAUSED", "ENDED"].includes(String(e.status))) throw new Error("Invalid Endless Mine status");
  if (!Array.isArray(e.partyStoneIds) || e.partyStoneIds.length > 3 || e.partyStoneIds.some((r) => typeof r != "string") || new Set(e.partyStoneIds).size !== e.partyStoneIds.length) throw new Error("Invalid Endless Mine party");
  if (!Array.isArray(e.partySnapshot) || e.partySnapshot.length > 3) throw new Error("Invalid Endless Mine snapshot");
  for (const r of e.partySnapshot) oi(r);
  if (wr(e.skillBook), !["BALANCED", "AGGRESSIVE", "DEFENSIVE", "BOSS_FOCUS", "RESOURCE_SAVE"].includes(String(e.strategy))) throw new Error("Invalid Endless Mine strategy");
  if (![1, 2, 4].includes(Number(e.speed)) || typeof e.manualMode != "boolean") throw new Error("Invalid Endless Mine controls");
  for (const r of ["startedAt", "lastProcessedAt", "nextFloorAt"]) if (!Fo(e[r], !0)) throw new Error(`Invalid Endless Mine ${r}`);
  for (const r of ["highestFloor", "weeklyHighestFloor", "winStreak", "pendingCredits"]) if (!xe(e[r])) throw new Error(`Invalid Endless Mine ${r}`);
  if (e.highestFloor > Fe || e.weeklyHighestFloor > Fe || e.pendingCredits > rn) throw new Error("Invalid Endless campaign bounds");
  if (typeof e.weeklySeed != "string" || e.weeklySeed.length > 128) throw new Error("Invalid weekly seed");
  if (!Array.isArray(e.recentLog) || e.recentLog.length > 80 || e.recentLog.some((r) => typeof r != "string" || r.length > 1e3)) throw new Error("Invalid Endless Mine log");
  if (!ae(e.claimLedger) || Object.keys(e.claimLedger).length > 1e5 || Object.keys(e.claimLedger).some((r) => !Se(r, 512)) || Object.values(e.claimLedger).some((r) => r !== !0)) throw new Error("Invalid Endless Mine claim ledger");
  const t = e.equipment;
  if (!ae(t) || !xe(t.capacity, 1) || t.capacity > 1e4 || !xe(t.salvageMaterials) || !Array.isArray(t.items) || t.items.length > t.capacity) throw new Error("Invalid Endless equipment inventory");
  const n = /* @__PURE__ */ new Set();
  for (const r of t.items) {
    if (!ae(r) || !Se(r.id, 512) || typeof r.locked != "boolean" || !Array.isArray(r.affixes)) throw new Error("Invalid Endless equipment item");
    if (n.has(r.id)) throw new Error(`Duplicate Endless equipment id ${r.id}`);
    n.add(r.id), mr(r);
  }
  if (vr(e.lootFilter), e.activeFloor === null != (e.activeBattle === null)) throw new Error("Incomplete Endless active battle");
  if (e.activeFloor !== null && Ho(e.activeFloor), e.activeBattle !== null && Yo(e.activeBattle), ae(e.activeFloor) && !["BATTLE", "ELITE", "BOSS"].includes(String(e.activeFloor.encounterType))) throw new Error("Non-combat Endless floor cannot retain a battle");
  if (e.runId !== null && !Se(e.runId, 512)) throw new Error("Invalid Endless run id");
  if (e.run !== null) {
    if (!ae(e.run) || !Se(e.run.seed) || !["ACTIVE", "AUTO", "OFFLINE"].includes(String(e.run.mode)) || !["CLIMBING", "DEFEATED", "COMPLETE"].includes(String(e.run.status))) throw new Error("Invalid Endless run");
    e.run.resonanceIntegrity === void 0 && (e.run.resonanceIntegrity = dt);
    for (const c of ["currentFloor", "highestClearedFloor", "checkpointFloor", "totalReward", "clearedBosses", "battles", "resonanceIntegrity"]) if (!xe(e.run[c])) throw new Error(`Invalid Endless run ${c}`);
    const r = e.run.currentFloor, s = e.run.highestClearedFloor, o = e.run.checkpointFloor, a = e.run.clearedBosses;
    if (r < 1 || r > Fe || s > Fe || o > s || o % Rt.checkpointInterval !== 0 || a > Math.floor(s / 10) || e.run.totalReward > rn || e.run.resonanceIntegrity > dt) throw new Error("Invalid Endless run floor bounds");
    if (e.run.lastDefeatFloor !== null && (!xe(e.run.lastDefeatFloor, 1) || e.run.lastDefeatFloor > Fe)) throw new Error("Invalid Endless defeat floor");
    if (e.run.status === "DEFEATED" && (e.run.lastDefeatFloor === null || r !== e.run.lastDefeatFloor)) throw new Error("Incoherent defeated Endless run");
    if (e.run.status === "COMPLETE" && (r !== Fe || s !== Fe)) throw new Error("Incoherent completed Endless run");
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
  if (ae(e.activeFloor) && e.run && e.activeFloor.floor !== e.run.currentFloor) throw new Error("Endless active floor does not match run");
  const i = [e.partySnapshot, e.skillBook, e.activeFloor, e.activeBattle];
  for (; i.length; ) {
    const r = i.pop();
    if (typeof r == "number" && !Number.isFinite(r)) throw new Error("Endless Mine contains a non-finite number");
    Array.isArray(r) ? i.push(...r) : ae(r) && i.push(...Object.values(r));
  }
  return e;
}, Mr = () => ({ version: 1, stones: {}, species: {}, totalXp: 0 }), Vo = (e) => Math.max(500, Math.floor(750 * Math.pow(e + 1, 1.24))), Xo = (e) => [
  ...e >= 2 ? ["lore-entry-1"] : [],
  ...e >= 5 ? ["profile-badge"] : [],
  ...e >= 10 ? ["resonance-aura"] : [],
  ...e >= 20 ? ["minor-passive"] : [],
  ...e >= 40 ? ["mastery-title"] : []
], bi = (e, t) => {
  for (e.xp = Ce(e.xp, t); e.level < 1e4; ) {
    const n = Vo(e.level);
    if (e.xp < n) break;
    e.xp -= n, e.level += 1;
  }
  e.unlockedRewardIds = Xo(e.level);
}, Ni = (e, t) => e[t] ??= { xp: 0, level: 0, unlockedRewardIds: [] }, Wo = (e, t, n, i) => {
  if (n === e) return Math.max(0, i - t);
  let r = Math.max(0, vt.stone(e) - t);
  for (let s = e + 1; s < n; s += 1) r = Ce(r, vt.stone(s));
  return Ce(r, i);
}, ai = (e, t, n) => {
  if (!Number.isFinite(n) || n < 0) throw new RangeError("XP amount must be finite and non-negative");
  const i = Math.floor(n), r = e.level, s = e.xp, o = e.level >= dn(e), a = Ki(e, i), c = o ? 0 : Math.min(i, Wo(r, s, e.level, e.xp)), l = Math.max(0, i - c), d = Ni(t.stones, e.instanceId), f = Ni(t.species, e.speciesId);
  return l > 0 && (bi(d, l), bi(f, Math.max(1, Math.floor(l * 0.35))), t.totalXp = Ce(t.totalXp, l)), { ...a, masteryXpGained: l, stoneMasteryLevel: d.level, speciesMasteryLevel: f.level };
}, Ko = (e) => {
  if (!e || typeof e != "object" || Array.isArray(e)) throw new Error("Invalid mastery state");
  const t = e;
  if (t.version !== 1 || !Number.isSafeInteger(t.totalXp) || t.totalXp < 0) throw new Error("Invalid mastery state header");
  for (const n of ["stones", "species"]) {
    const i = t[n];
    if (!i || typeof i != "object" || Array.isArray(i) || Object.keys(i).length > 1e5) throw new Error(`Invalid mastery ${n}`);
    for (const [r, s] of Object.entries(i)) {
      if (!r || !s || typeof s != "object" || Array.isArray(s)) throw new Error(`Invalid mastery entry ${r}`);
      const o = s;
      if (!Number.isSafeInteger(o.xp) || o.xp < 0 || !Number.isSafeInteger(o.level) || o.level < 0 || o.level > 1e4) throw new Error(`Invalid mastery progression ${r}`);
      if (!Array.isArray(o.unlockedRewardIds) || o.unlockedRewardIds.length > 16 || o.unlockedRewardIds.some((a) => typeof a != "string")) throw new Error(`Invalid mastery rewards ${r}`);
    }
  }
  return e;
}, Te = 5, Pn = (e = {}) => {
  const t = e.clock ?? Z, n = t.now(), i = e.rng ?? new Ee(e.seed ?? `${n.toISOString()}:new-game`), r = e.accountId ?? Ge("account", i, n.getTime()), s = (e.username?.trim() || "Stonekeeper").slice(0, 24), o = {
    accountId: r,
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
  }, a = { accountId: r, username: s }, c = e.withStarter === !1 ? [] : [
    bn("species_pebblit", a, `${e.seed ?? r}:starter:1`, t),
    bn("species_quartzling", a, `${e.seed ?? r}:starter:2`, t),
    bn("species_emberite", a, `${e.seed ?? r}:starter:3`, t)
  ], l = Object.fromEntries(c.map((f) => [f.instanceId, f])), d = Object.fromEntries(Xn.map((f) => [
    f.id,
    { value: 0, unlockedAt: null, claimedAt: null }
  ]));
  return {
    schemaVersion: Te,
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
      timeCheckpoint: Ji(n.getTime()),
      scheduler: { version: 1, jobs: [] },
      lastProcessedAt: n.toISOString(),
      lastActiveAt: n.toISOString(),
      lastWelcomeBack: null
    },
    endlessMine: Ir(n),
    mastery: Mr(),
    stones: l,
    unappraisedFinds: [],
    inventory: {
      currencies: { credits: 3e3, gachaTickets: 12, researchCores: 0, upgradeDust: 250 },
      items: { item_magma_heart: 0, item_eclipse_shard: 0, item_primordial_core: 0 },
      equipment: {},
      capacity: 500
    },
    collection: {
      discoveredSpeciesIds: c.map((f) => f.speciesId),
      mutationSpecies: Object.fromEntries(c.map((f) => [f.speciesId, [f.mutation]])),
      variantSpecies: Object.fromEntries(c.map((f) => [f.speciesId, [f.colorVariant]])),
      origins: c.length ? { EVENT: c.length } : {}
    },
    fusionHistory: [],
    gacha: { pityByBanner: {}, history: [], rarityCounts: {} },
    achievements: d,
    parties: [{ id: "party_primary", name: "Primary Formation", slots: c.map((f, y) => ({ stoneId: f.instanceId, position: y === 0 ? "FRONT" : "BACK" })), defense: !1 }],
    activePartyId: "party_primary",
    activeBattle: null,
    battleHistory: [],
    dungeonClears: {},
    profile: { showcaseStoneIds: c.map((f) => f.instanceId), favoriteStoneIds: [], totalAffinity: 0, public: !0 },
    statistics: { fusionCount: 0, mutationCount: 0, rareDiscoveryCount: 0, battleWins: 0, battleLosses: 0, highestInfiniteFloor: 0, totalRaidDamage: 0 },
    online: { connected: !0, sessionId: Ge("session", i, n.getTime()), sequence: 0, queue: [], processedReceipts: [], lastSyncedAt: null },
    settings: { effectQuality: "HIGH", reduceMotion: !1, mute: !1, masterVolume: 0.8, musicVolume: 0.55, effectsVolume: 0.8, textScale: 1, developerMode: !1 },
    createdAt: n.toISOString(),
    updatedAt: n.toISOString()
  };
}, je = (e) => typeof structuredClone == "function" ? structuredClone(e) : JSON.parse(JSON.stringify(e)), zo = (e, t = Z) => {
  e.revision += 1, e.updatedAt = t.now().toISOString();
}, ki = (e) => {
  let t;
  const n = /* @__PURE__ */ new Set(), i = (l, d) => {
    const f = typeof l == "function" ? l(t) : l;
    if (!Object.is(f, t)) {
      const y = t;
      t = d ?? (typeof f != "object" || f === null) ? f : Object.assign({}, t, f), n.forEach((h) => h(t, y));
    }
  }, r = () => t, a = { setState: i, getState: r, getInitialState: () => c, subscribe: (l) => (n.add(l), () => n.delete(l)) }, c = t = e(i, r, a);
  return a;
}, Jo = ((e) => e ? ki(e) : ki);
function Qo(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Nn = { exports: {} }, H = {};
var _i;
function Zo() {
  if (_i) return H;
  _i = 1;
  var e = /* @__PURE__ */ Symbol.for("react.transitional.element"), t = /* @__PURE__ */ Symbol.for("react.portal"), n = /* @__PURE__ */ Symbol.for("react.fragment"), i = /* @__PURE__ */ Symbol.for("react.strict_mode"), r = /* @__PURE__ */ Symbol.for("react.profiler"), s = /* @__PURE__ */ Symbol.for("react.consumer"), o = /* @__PURE__ */ Symbol.for("react.context"), a = /* @__PURE__ */ Symbol.for("react.forward_ref"), c = /* @__PURE__ */ Symbol.for("react.suspense"), l = /* @__PURE__ */ Symbol.for("react.memo"), d = /* @__PURE__ */ Symbol.for("react.lazy"), f = /* @__PURE__ */ Symbol.for("react.activity"), y = Symbol.iterator;
  function h(E) {
    return E === null || typeof E != "object" ? null : (E = y && E[y] || E["@@iterator"], typeof E == "function" ? E : null);
  }
  var u = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, I = Object.assign, g = {};
  function b(E, k, U) {
    this.props = E, this.context = k, this.refs = g, this.updater = U || u;
  }
  b.prototype.isReactComponent = {}, b.prototype.setState = function(E, k) {
    if (typeof E != "object" && typeof E != "function" && E != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, E, k, "setState");
  }, b.prototype.forceUpdate = function(E) {
    this.updater.enqueueForceUpdate(this, E, "forceUpdate");
  };
  function R() {
  }
  R.prototype = b.prototype;
  function m(E, k, U) {
    this.props = E, this.context = k, this.refs = g, this.updater = U || u;
  }
  var p = m.prototype = new R();
  p.constructor = m, I(p, b.prototype), p.isPureReactComponent = !0;
  var S = Array.isArray;
  function M() {
  }
  var w = { H: null, A: null, T: null, S: null }, T = Object.prototype.hasOwnProperty;
  function x(E, k, U) {
    var G = U.ref;
    return {
      $$typeof: e,
      type: E,
      key: k,
      ref: G !== void 0 ? G : null,
      props: U
    };
  }
  function $(E, k) {
    return x(E.type, k, E.props);
  }
  function F(E) {
    return typeof E == "object" && E !== null && E.$$typeof === e;
  }
  function q(E) {
    var k = { "=": "=0", ":": "=2" };
    return "$" + E.replace(/[=:]/g, function(U) {
      return k[U];
    });
  }
  var Y = /\/+/g;
  function oe(E, k) {
    return typeof E == "object" && E !== null && E.key != null ? q("" + E.key) : k.toString(36);
  }
  function O(E) {
    switch (E.status) {
      case "fulfilled":
        return E.value;
      case "rejected":
        throw E.reason;
      default:
        switch (typeof E.status == "string" ? E.then(M, M) : (E.status = "pending", E.then(
          function(k) {
            E.status === "pending" && (E.status = "fulfilled", E.value = k);
          },
          function(k) {
            E.status === "pending" && (E.status = "rejected", E.reason = k);
          }
        )), E.status) {
          case "fulfilled":
            return E.value;
          case "rejected":
            throw E.reason;
        }
    }
    throw E;
  }
  function V(E, k, U, G, K) {
    var J = typeof E;
    (J === "undefined" || J === "boolean") && (E = null);
    var ne = !1;
    if (E === null) ne = !0;
    else
      switch (J) {
        case "bigint":
        case "string":
        case "number":
          ne = !0;
          break;
        case "object":
          switch (E.$$typeof) {
            case e:
            case t:
              ne = !0;
              break;
            case d:
              return ne = E._init, V(
                ne(E._payload),
                k,
                U,
                G,
                K
              );
          }
      }
    if (ne)
      return K = K(E), ne = G === "" ? "." + oe(E, 0) : G, S(K) ? (U = "", ne != null && (U = ne.replace(Y, "$&/") + "/"), V(K, k, U, "", function(wn) {
        return wn;
      })) : K != null && (F(K) && (K = $(
        K,
        U + (K.key == null || E && E.key === K.key ? "" : ("" + K.key).replace(
          Y,
          "$&/"
        ) + "/") + ne
      )), k.push(K)), 1;
    ne = 0;
    var Ie = G === "" ? "." : G + ":";
    if (S(E))
      for (var ue = 0; ue < E.length; ue++)
        G = E[ue], J = Ie + oe(G, ue), ne += V(
          G,
          k,
          U,
          J,
          K
        );
    else if (ue = h(E), typeof ue == "function")
      for (E = ue.call(E), ue = 0; !(G = E.next()).done; )
        G = G.value, J = Ie + oe(G, ue++), ne += V(
          G,
          k,
          U,
          J,
          K
        );
    else if (J === "object") {
      if (typeof E.then == "function")
        return V(
          O(E),
          k,
          U,
          G,
          K
        );
      throw k = String(E), Error(
        "Objects are not valid as a React child (found: " + (k === "[object Object]" ? "object with keys {" + Object.keys(E).join(", ") + "}" : k) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return ne;
  }
  function Q(E, k, U) {
    if (E == null) return E;
    var G = [], K = 0;
    return V(E, G, "", "", function(J) {
      return k.call(U, J, K++);
    }), G;
  }
  function qe(E) {
    if (E._status === -1) {
      var k = E._result;
      k = k(), k.then(
        function(U) {
          (E._status === 0 || E._status === -1) && (E._status = 1, E._result = U);
        },
        function(U) {
          (E._status === 0 || E._status === -1) && (E._status = 2, E._result = U);
        }
      ), E._status === -1 && (E._status = 0, E._result = k);
    }
    if (E._status === 1) return E._result.default;
    throw E._result;
  }
  var Oe = typeof reportError == "function" ? reportError : function(E) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var k = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof E == "object" && E !== null && typeof E.message == "string" ? String(E.message) : String(E),
        error: E
      });
      if (!window.dispatchEvent(k)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", E);
      return;
    }
    console.error(E);
  }, Ue = {
    map: Q,
    forEach: function(E, k, U) {
      Q(
        E,
        function() {
          k.apply(this, arguments);
        },
        U
      );
    },
    count: function(E) {
      var k = 0;
      return Q(E, function() {
        k++;
      }), k;
    },
    toArray: function(E) {
      return Q(E, function(k) {
        return k;
      }) || [];
    },
    only: function(E) {
      if (!F(E))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return E;
    }
  };
  return H.Activity = f, H.Children = Ue, H.Component = b, H.Fragment = n, H.Profiler = r, H.PureComponent = m, H.StrictMode = i, H.Suspense = c, H.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = w, H.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(E) {
      return w.H.useMemoCache(E);
    }
  }, H.cache = function(E) {
    return function() {
      return E.apply(null, arguments);
    };
  }, H.cacheSignal = function() {
    return null;
  }, H.cloneElement = function(E, k, U) {
    if (E == null)
      throw Error(
        "The argument must be a React element, but you passed " + E + "."
      );
    var G = I({}, E.props), K = E.key;
    if (k != null)
      for (J in k.key !== void 0 && (K = "" + k.key), k)
        !T.call(k, J) || J === "key" || J === "__self" || J === "__source" || J === "ref" && k.ref === void 0 || (G[J] = k[J]);
    var J = arguments.length - 2;
    if (J === 1) G.children = U;
    else if (1 < J) {
      for (var ne = Array(J), Ie = 0; Ie < J; Ie++)
        ne[Ie] = arguments[Ie + 2];
      G.children = ne;
    }
    return x(E.type, K, G);
  }, H.createContext = function(E) {
    return E = {
      $$typeof: o,
      _currentValue: E,
      _currentValue2: E,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, E.Provider = E, E.Consumer = {
      $$typeof: s,
      _context: E
    }, E;
  }, H.createElement = function(E, k, U) {
    var G, K = {}, J = null;
    if (k != null)
      for (G in k.key !== void 0 && (J = "" + k.key), k)
        T.call(k, G) && G !== "key" && G !== "__self" && G !== "__source" && (K[G] = k[G]);
    var ne = arguments.length - 2;
    if (ne === 1) K.children = U;
    else if (1 < ne) {
      for (var Ie = Array(ne), ue = 0; ue < ne; ue++)
        Ie[ue] = arguments[ue + 2];
      K.children = Ie;
    }
    if (E && E.defaultProps)
      for (G in ne = E.defaultProps, ne)
        K[G] === void 0 && (K[G] = ne[G]);
    return x(E, J, K);
  }, H.createRef = function() {
    return { current: null };
  }, H.forwardRef = function(E) {
    return { $$typeof: a, render: E };
  }, H.isValidElement = F, H.lazy = function(E) {
    return {
      $$typeof: d,
      _payload: { _status: -1, _result: E },
      _init: qe
    };
  }, H.memo = function(E, k) {
    return {
      $$typeof: l,
      type: E,
      compare: k === void 0 ? null : k
    };
  }, H.startTransition = function(E) {
    var k = w.T, U = {};
    w.T = U;
    try {
      var G = E(), K = w.S;
      K !== null && K(U, G), typeof G == "object" && G !== null && typeof G.then == "function" && G.then(M, Oe);
    } catch (J) {
      Oe(J);
    } finally {
      k !== null && U.types !== null && (k.types = U.types), w.T = k;
    }
  }, H.unstable_useCacheRefresh = function() {
    return w.H.useCacheRefresh();
  }, H.use = function(E) {
    return w.H.use(E);
  }, H.useActionState = function(E, k, U) {
    return w.H.useActionState(E, k, U);
  }, H.useCallback = function(E, k) {
    return w.H.useCallback(E, k);
  }, H.useContext = function(E) {
    return w.H.useContext(E);
  }, H.useDebugValue = function() {
  }, H.useDeferredValue = function(E, k) {
    return w.H.useDeferredValue(E, k);
  }, H.useEffect = function(E, k) {
    return w.H.useEffect(E, k);
  }, H.useEffectEvent = function(E) {
    return w.H.useEffectEvent(E);
  }, H.useId = function() {
    return w.H.useId();
  }, H.useImperativeHandle = function(E, k, U) {
    return w.H.useImperativeHandle(E, k, U);
  }, H.useInsertionEffect = function(E, k) {
    return w.H.useInsertionEffect(E, k);
  }, H.useLayoutEffect = function(E, k) {
    return w.H.useLayoutEffect(E, k);
  }, H.useMemo = function(E, k) {
    return w.H.useMemo(E, k);
  }, H.useOptimistic = function(E, k) {
    return w.H.useOptimistic(E, k);
  }, H.useReducer = function(E, k, U) {
    return w.H.useReducer(E, k, U);
  }, H.useRef = function(E) {
    return w.H.useRef(E);
  }, H.useState = function(E) {
    return w.H.useState(E);
  }, H.useSyncExternalStore = function(E, k, U) {
    return w.H.useSyncExternalStore(
      E,
      k,
      U
    );
  }, H.useTransition = function() {
    return w.H.useTransition();
  }, H.version = "19.2.0", H;
}
var Ci;
function ea() {
  return Ci || (Ci = 1, Nn.exports = Zo()), Nn.exports;
}
var ta = ea();
const Qt = /* @__PURE__ */ Qo(ta), na = (e) => e;
function ia(e, t = na) {
  const n = Qt.useSyncExternalStore(
    e.subscribe,
    Qt.useCallback(() => t(e.getState()), [e, t]),
    Qt.useCallback(() => t(e.getInitialState()), [e, t])
  );
  return Qt.useDebugValue(n), n;
}
const xi = (e) => {
  const t = Jo(e), n = (i) => ia(t, i);
  return Object.assign(n, t), n;
}, ra = ((e) => e ? xi(e) : xi), sa = (e, t) => {
  for (const [n, i] of Object.entries(t.currencies ?? {}))
    if ((e.inventory.currencies[n] ?? 0) < (i ?? 0)) return !1;
  for (const [n, i] of Object.entries(t.items ?? {}))
    if ((e.inventory.items[n] ?? 0) < i) return !1;
  return !0;
}, bt = (e, t) => {
  if (!sa(e, t)) throw new Error("Insufficient resources");
  for (const [n, i] of Object.entries(t.currencies ?? {})) {
    const r = n;
    e.inventory.currencies[r] -= i ?? 0;
  }
  for (const [n, i] of Object.entries(t.items ?? {}))
    e.inventory.items[n] = Math.max(0, (e.inventory.items[n] ?? 0) - i);
}, kt = (e, t) => {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("Account XP must be non-negative");
  const n = e.accountProgress.level;
  for (e.accountProgress.xp += Math.floor(t); e.accountProgress.level < 100; ) {
    const i = vt.account(e.accountProgress.level);
    if (e.accountProgress.xp < i) break;
    e.accountProgress.xp -= i, e.accountProgress.level += 1, e.accountProgress.skillPoints += e.accountProgress.level % 3 === 0 ? 1 : 0;
  }
  return e.accountProgress.level - n;
}, Rr = (e, t) => {
  for (const [n, i] of Object.entries(t.currencies ?? {})) {
    const r = n;
    e.inventory.currencies[r] += i ?? 0;
  }
  for (const [n, i] of Object.entries(t.items ?? {}))
    e.inventory.items[n] = (e.inventory.items[n] ?? 0) + i;
  t.accountXp && kt(e, t.accountXp), t.miningXp && (e.mining.xp += t.miningXp);
}, oa = (e, t) => {
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
      return Object.values(e.gacha.pityByBanner).reduce((n, i) => n + i.lifetimePulls, 0);
    case "MAX_AFFINITY":
      return Math.max(0, ...Object.values(e.stones).map((n) => n.affinity.rank));
    case "MUTATIONS":
      return e.statistics.mutationCount;
    case "PERFECT_IV":
      return Object.values(e.stones).filter((n) => mn(n.individualValues)).length;
    case "ACCOUNT_LEVEL":
      return e.accountProgress.level;
  }
}, _t = (e, t = Z) => {
  const n = [];
  for (const i of Xn) {
    const r = e.achievements[i.id] ?? { value: 0, unlockedAt: null, claimedAt: null };
    r.value = oa(e, i.metric), r.unlockedAt === null && r.value >= i.threshold && (r.unlockedAt = t.now().toISOString(), n.push(i)), e.achievements[i.id] = r;
  }
  return n;
}, aa = (e, t, n = Z) => {
  const i = Xn.find((s) => s.id === t), r = e.achievements[t];
  if (!i || !r?.unlockedAt) throw new Error("Achievement is not unlocked");
  if (r.claimedAt) throw new Error("Achievement reward already claimed");
  Rr(e, i.reward), i.reward.titleId && !e.account.ownedTitleIds.includes(i.reward.titleId) && e.account.ownedTitleIds.push(i.reward.titleId), i.reward.frameId && !e.account.ownedFrameIds.includes(i.reward.frameId) && e.account.ownedFrameIds.push(i.reward.frameId), r.claimedAt = n.now().toISOString();
}, ca = 5 * 6e4, la = 720 * 60 * 6e4, da = 16384, ua = (e) => {
  if (e === void 0) return;
  if (!e || typeof e != "object" || Array.isArray(e)) throw new Error("Mining metadata must be an object");
  let t;
  try {
    t = JSON.stringify(e);
  } catch {
    throw new Error("Mining metadata must be JSON serializable");
  }
  if ((typeof TextEncoder == "function" ? new TextEncoder().encode(t).byteLength : ma(t)) > da) throw new Error("Mining metadata exceeds the 16 KB limit");
  const i = JSON.parse(t);
  if (!i || typeof i != "object" || Array.isArray(i)) throw new Error("Mining metadata must be a JSON object");
  return i;
}, ma = (e) => {
  let t = 0;
  for (let n = 0; n < e.length; n += 1) {
    const i = e.codePointAt(n);
    i > 65535 && (n += 1), t += i <= 127 ? 1 : i <= 2047 ? 2 : i <= 65535 ? 3 : 4;
  }
  return t;
}, Fn = (e, t, n = Z, i = {}) => {
  if (i.farmSessionActive === !1) return { valid: !1, reason: "Farm session is not active" };
  if (typeof t.eventId != "string" || !t.eventId.trim() || t.eventId.length > 128) return { valid: !1, reason: "Mining eventId must be 1-128 characters" };
  if (t.sessionId !== void 0 && (typeof t.sessionId != "string" || t.sessionId !== e.online.sessionId)) return { valid: !1, reason: "Mining sessionId does not match the active session" };
  if (t.amount !== void 0 && (typeof t.amount != "number" || !Number.isSafeInteger(t.amount))) return { valid: !1, reason: "Mining amount must be an integer" };
  const r = t.amount ?? 1;
  if (r < 1 || r > 100) return { valid: !1, reason: "Mining amount is outside the accepted range" };
  if (t.quality !== void 0 && (typeof t.quality != "number" || !Number.isFinite(t.quality))) return { valid: !1, reason: "Mining quality must be finite" };
  const s = t.quality ?? 0.5;
  if (s < 0 || s > 1) return { valid: !1, reason: "Mining quality must be between 0 and 1" };
  const o = n.now().getTime();
  let a = o;
  if (t.timestamp !== void 0) {
    if (typeof t.timestamp != "string") return { valid: !1, reason: "Mining timestamp must be a string" };
    if (a = Date.parse(t.timestamp), !Number.isFinite(a)) return { valid: !1, reason: "Mining timestamp is invalid" };
    if (a - o > ca) return { valid: !1, reason: "Mining timestamp is too far in the future" };
    if (o - a > la) return { valid: !1, reason: "Mining timestamp is too old" };
  }
  try {
    return { valid: !0, amount: r, quality: s, sourceTimestamp: new Date(a).toISOString(), metadata: ua(t.metadata) };
  } catch (c) {
    return { valid: !1, reason: c instanceof Error ? c.message : String(c) };
  }
}, pa = (e) => {
  for (const t of Dn)
    if (e.mining.level >= t.unlockLevel && !e.mining.unlockedAreas.includes(t.id) && e.mining.unlockedAreas.push(t.id), e.mining.level >= t.unlockLevel)
      for (const n of t.veins) e.mining.unlockedVeins.includes(n) || e.mining.unlockedVeins.push(n);
}, fa = (e, t) => {
  const n = e.mining.level;
  for (e.mining.xp += Math.max(0, Math.floor(t)); e.mining.level < 100; ) {
    const i = vt.mining(e.mining.level);
    if (e.mining.xp < i) break;
    e.mining.xp -= i, e.mining.level += 1;
  }
  return pa(e), e.mining.level - n;
}, ha = (e, t, n) => {
  Object.defineProperty(e.mining.processedFarmEventIds, t.eventId, {
    value: !0,
    enumerable: !0,
    configurable: !0,
    writable: !0
  });
}, Ea = (e, t, n, i = Z, r = {}) => {
  const s = Fn(e, t, i, r);
  if (!s.valid)
    return { accepted: !1, duplicate: !1, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 };
  if (Object.prototype.hasOwnProperty.call(e.mining.processedFarmEventIds, t.eventId))
    return { accepted: !1, duplicate: !0, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 };
  const o = s.amount, a = s.quality, c = Dn.find((g) => g.id === t.areaId), l = c && e.mining.unlockedAreas.includes(c.id) ? c : Dn[0];
  if (!l) throw new Error("Mining area configuration is missing");
  const d = [], f = Math.min(0.6, l.discoveryRate + a * 0.08 + e.mining.level * 7e-4), y = i.now();
  for (let g = 0; g < o; g += 1) {
    if (!n.chance(f)) continue;
    const b = n.fork(`${t.eventId}:${g}`), R = b.next() / (l.rarityBias + a * 0.25), m = R < 8e-5 ? "LEGENDARY" : R < 18e-4 ? "UR" : R < 0.013 ? "SSR" : R < 0.09 ? "SR" : R < 0.35 ? "RARE" : "NORMAL";
    d.push({
      discoveryId: Ge("discovery", b, y.getTime() + g),
      seed: `${t.eventId}:${e.account.accountId}:${g}:${Math.floor(b.next() * 1e12)}`,
      veinId: t.veinId && e.mining.unlockedVeins.includes(t.veinId) ? t.veinId : l.veins[0],
      areaId: l.id,
      discoveredAt: y.toISOString(),
      hintedRarity: m,
      sourceEventId: t.eventId
    });
  }
  const h = o * (10 + Math.round(a * 8)), u = o * (8 + Math.round(a * 7));
  e.mining.totalMined += o, e.mining.dailyMined += o, e.mining.weeklyMined += o, e.mining.monthlyMined += o, e.mining.lastMinedAt = y.toISOString(), e.unappraisedFinds.push(...d), e.inventory.currencies.credits += u;
  const I = fa(e, h);
  return kt(e, Math.ceil(h * 0.35)), ha(e, t), _t(e, i), { accepted: !0, duplicate: !1, xpGranted: h, creditsGranted: u, discoveries: d, miningLevelsGained: I };
}, ga = (e, t, n) => {
  const i = Ve[t.hintedRarity];
  let r = wt.filter((s) => s.naturalWeight > 0 && s.minMiningLevel <= e.mining.level);
  if (t.hintedRarity === "LEGENDARY") {
    const s = r.filter((o) => o.rarity === "LEGENDARY");
    s.length > 0 && (r = s);
  } else {
    const s = r.filter((o) => Ve[o.rarity] <= i + 1);
    s.length > 0 && (r = s);
  }
  return r.length === 0 && (r = wt.filter((s) => s.naturalWeight > 0 && s.minMiningLevel <= 1)), n.weighted(r, (s) => {
    const o = Math.abs(Ve[s.rarity] - i);
    return s.naturalWeight / (1 + o * o * 3);
  });
}, Wt = (e, t) => {
  const n = !e.collection.discoveredSpeciesIds.includes(t.speciesId);
  n && e.collection.discoveredSpeciesIds.push(t.speciesId);
  const i = e.collection.mutationSpecies[t.speciesId] ?? [];
  i.includes(t.mutation) || i.push(t.mutation), e.collection.mutationSpecies[t.speciesId] = i;
  const r = e.collection.variantSpecies[t.speciesId] ?? [];
  return r.includes(t.colorVariant) || r.push(t.colorVariant), e.collection.variantSpecies[t.speciesId] = r, e.collection.origins[t.origin] = (e.collection.origins[t.origin] ?? 0) + 1, n;
}, Ia = (e, t, n = Z) => {
  const i = e.unappraisedFinds.findIndex((f) => f.discoveryId === t);
  if (i < 0) throw new Error("Discovery not found or already appraised");
  if (Object.keys(e.stones).length >= e.inventory.capacity) throw new Error("Stone capacity is full");
  const r = e.unappraisedFinds[i], s = new Ee(r.seed), o = ga(e, r, s), a = { accountId: e.account.accountId, username: e.account.username }, c = ft({ species: o, origin: "NATURAL", owner: a, rng: s, clock: n, appraised: !0 });
  if (e.unappraisedFinds.splice(i, 1), e.stones[c.instanceId]) throw new Error("Stone ID collision");
  e.stones[c.instanceId] = c;
  const l = Wt(e, c), d = c.rarity === "LEGENDARY";
  return Ve[c.rarity] >= Ve.SSR && (e.statistics.rareDiscoveryCount += 1), c.mutation !== "NONE" && (e.statistics.mutationCount += 1), mn(c.individualValues) && (e.statistics.mutationCount += c.mutation === "PERFECT" ? 0 : 1), _t(e, n), { stone: c, isNewSpecies: l, isNaturalLegendary: d };
}, Be = ["NORMAL", "RARE", "SR", "SSR", "UR", "LEGENDARY"], Sa = [
  "NATURAL",
  "GACHA",
  "FUSION",
  "EVOLUTION",
  "RAID",
  "DUNGEON",
  "EXPEDITION",
  "EVENT"
], Ht = [
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
], Tr = ["BALANCED", "COMBAT", "MINING", "DISCOVERY", "SAFE", "HIGH_RISK", "EXPERIENCE", "MATERIALS"], ya = (e, t) => ({
  currencies: Object.fromEntries(Object.entries(e.currencies ?? {}).map(([n, i]) => [n, (i ?? 0) * t])),
  items: Object.fromEntries(Object.entries(e.items ?? {}).map(([n, i]) => [n, i * t]))
}), on = (e, t) => Ve[e] >= Ve[t], Aa = (e, t) => {
  const n = { ...e.rates }, i = t.pullsSinceSsr + 1;
  if (i >= e.pity.hard) {
    const r = n.SSR + n.UR + n.LEGENDARY;
    return n.NORMAL = 0, n.RARE = 0, n.SR = 0, n.SSR /= r, n.UR /= r, n.LEGENDARY /= r, n;
  }
  if (i > e.pity.softStart) {
    const r = i - e.pity.softStart, s = Math.min(0.75, r * 0.055), o = n.SSR + n.UR + n.LEGENDARY, a = Math.min(0.92, o + s), c = a / o, l = (1 - a) / (1 - o);
    n.SSR *= c, n.UR *= c, n.LEGENDARY *= c, n.NORMAL *= l, n.RARE *= l, n.SR *= l;
  }
  return n;
}, wa = (e, t, n) => {
  const i = Be.filter((r) => !n || on(r, n));
  return t.weighted(i, (r) => e[r]);
}, va = (e, t, n, i) => {
  const r = e.pool.filter((d) => re[d.speciesId]?.rarity === t), s = r.length > 0 ? r : e.pool.filter((d) => on(re[d.speciesId]?.rarity ?? "NORMAL", t));
  if (s.length === 0) throw new Error(`Banner ${e.id} has no species for ${t}`);
  const o = s.filter((d) => d.pickup), a = n && o.length > 0 ? o : s, c = i.weighted(a, (d) => d.weight * (d.pickup ? 1.5 : 1)), l = re[c.speciesId];
  if (!l) throw new Error(`Unknown gacha species ${c.speciesId}`);
  return { species: l, featured: !!c.pickup };
}, Ma = (e, t, n, i, r = Z) => {
  const s = cs[t];
  if (!s) throw new Error(`Unknown gacha banner: ${t}`);
  if (n !== 1 && n !== 10) throw new Error("Gacha supports only one or ten pulls");
  if (Object.keys(e.stones).length + n > e.inventory.capacity)
    throw new Error("Stone capacity is full");
  bt(e, ya(s.singleCost, n));
  const o = e.gacha.pityByBanner[t] ?? {
    pullsSinceSsr: 0,
    lifetimePulls: 0,
    featuredGuaranteed: !1
  }, a = [], c = [];
  let l = !1;
  for (let f = 0; f < n; f += 1) {
    const y = o.pullsSinceSsr, h = o.pullsSinceSsr + 1 >= s.pity.hard, u = n === 10 && f === 9 && !l, I = Aa(s, o), g = wa(I, i, u ? s.tenPullGuarantee : void 0);
    on(g, s.tenPullGuarantee) && (l = !0);
    const b = on(g, "SSR"), R = va(s, g, b && o.featuredGuaranteed, i), m = { accountId: e.account.accountId, username: e.account.username }, p = ft({ species: R.species, rarity: g, origin: "GACHA", owner: m, rng: i, clock: r });
    if (e.stones[p.instanceId]) throw new Error("Stone ID collision");
    e.stones[p.instanceId] = p, Wt(e, p), o.lifetimePulls += 1, b ? (o.pullsSinceSsr = 0, s.pity.featuredGuaranteeAfterLoss && (o.featuredGuaranteed = !R.featured)) : o.pullsSinceSsr += 1;
    const S = r.now(), M = {
      id: Ge("pull", i, S.getTime() + f),
      bannerId: t,
      stoneId: p.instanceId,
      rarity: g,
      pullNumber: o.lifetimePulls,
      pityBefore: y,
      guaranteed: h || u,
      createdAt: S.toISOString()
    };
    a.push(p), c.push(M), e.gacha.rarityCounts[g] = (e.gacha.rarityCounts[g] ?? 0) + 1;
  }
  e.gacha.pityByBanner[t] = o, e.gacha.history.unshift(...[...c].reverse()), e.gacha.history.length > 1e3 && (e.gacha.history.length = 1e3), kt(e, 8 * n), _t(e, r);
  const d = a.reduce((f, y) => Ve[y.rarity] > Ve[f] ? y.rarity : f, "NORMAL");
  return { stones: a, history: c, highestRarity: d, pityAfter: { ...o } };
}, kn = (e, t) => {
  const n = /* @__PURE__ */ new Map();
  for (const i of e) n.set(i, (n.get(i) ?? 0) + 1);
  for (const i of t) {
    const r = n.get(i) ?? 0;
    if (r <= 0) return !1;
    n.set(i, r - 1);
  }
  return !0;
}, Ra = (e, t, n = []) => {
  if (t.length !== e.parentCount || (e.type === "FIXED" || (e.requiredSpecies?.length ?? 0) > 0) && !kn(t.map((i) => i.speciesId), e.requiredSpecies ?? []))
    return !1;
  if (e.requiredFamilies?.length) {
    const i = t.map((r) => re[r.speciesId]?.family ?? "unknown");
    if (!kn(i, e.requiredFamilies)) return !1;
  }
  if (e.requiredElements?.length) {
    const i = t.flatMap((r) => [r.primaryElement, ...r.secondaryElement ? [r.secondaryElement] : []]);
    if (!kn(i, e.requiredElements)) return !1;
  }
  return e.hidden && Vn.some((r) => r.unlockRecipeId === e.id) ? n.some((r) => Yi[r]?.unlockRecipeId === e.id) : !0;
}, Ta = (e, t, n = []) => is.filter((i) => i.minimumLabLevel <= t && Ra(i, e, n)).sort((i, r) => {
  const s = { SPECIAL: 5, HIDDEN: 4, FIXED: 3, ELEMENT: 2, FAMILY: 1 };
  return s[r.type] - s[i.type];
}), ba = (e, t) => t.map((n) => {
  const i = Yi[n];
  if (!i) throw new Error(`Unknown catalyst: ${n}`);
  if (e.facilities.fusionLab < i.requiredLabLevel) throw new Error(`Fusion lab level ${i.requiredLabLevel} required`);
  if ((e.inventory.items[n] ?? 0) < 1) throw new Error(`Missing catalyst: ${n}`);
  return i;
}), Na = (e, t, n, i) => {
  const s = (t?.resultSpeciesIds ?? [...new Set(e.map((a) => a.speciesId))]).map((a) => re[a]).filter((a) => !!a);
  if (s.length === 0) throw new Error("Fusion has no valid result species");
  const o = n.find((a) => a.elementBias)?.elementBias;
  return i.weighted(s, (a) => {
    const c = Math.max(0.01, t?.weight ?? a.gachaWeight ?? 1);
    return o && (a.primaryElement === o || a.possibleSecondaryElements.includes(o)) ? c * 4 : c;
  });
}, ka = (e, t, n) => Object.fromEntries(ke.map((i) => {
  const r = e.map((c) => c.individualValues[i]);
  if (t.includes(i)) return [i, Math.max(...r)];
  const s = n.chance(0.72) ? n.pick(r) : n.int(0, 31), o = n.chance(0.08) ? -n.int(1, 3) : 0, a = n.chance(0.1) ? n.int(1, 2) : 0;
  return [i, Math.max(0, Math.min(31, s + o + a))];
})), _a = (e, t, n, i, r) => {
  const s = [...new Set(e.flatMap((l) => l.traitIds))], o = [...new Set(e.flatMap((l) => l.parents).flatMap((l) => [
    ...l.traitIds ?? [],
    ...l.mutation === "ANCIENT" ? ["trait_ancient_oath"] : [],
    ...l.mutation === "PRISMATIC" ? ["trait_prism_reflex"] : []
  ]))], a = [...new Set(n.filter((l) => s.includes(l)))];
  for (const l of i.shuffle(s)) {
    if (a.length >= r) break;
    !a.includes(l) && i.chance(0.52) && a.push(l);
  }
  let c = !1;
  if (a.length < r && o.length > 0 && i.chance(0.09)) {
    const l = i.pick(o);
    a.includes(l) || (a.push(l), c = !0);
  }
  if (a.length < r && i.chance(0.22)) {
    const l = t.traitPool.filter((d) => !a.includes(d));
    l.length > 0 && a.push(i.pick(l));
  }
  return a.length < r && !a.includes("trait_gene_weaver") && i.chance(0.05) && a.push("trait_gene_weaver"), { traits: a.filter((l) => !!Nt[l]).slice(0, r), grandparentInherited: c };
}, Ca = (e, t, n) => {
  const i = /* @__PURE__ */ new Set([...t.skillPool.map((o) => o.skillId), ...e.flatMap((o) => o.skills.map((a) => a.skillId))]), r = n.shuffle(e.flatMap((o) => o.skills.map((a) => a.skillId))).filter((o, a, c) => c.indexOf(o) === a && i.has(o) && n.chance(0.38)).slice(0, 3), s = t.skillPool[0]?.skillId;
  return s && !r.includes(s) && r.unshift(s), r.slice(0, 6);
}, xa = (e, t, n) => {
  const i = t.reduce((s, o) => s * (o.mutationMultiplier ?? 1), 1), r = e.some((s) => s.mutation !== "NONE") ? 1.7 : 1;
  return n.chance(Math.min(0.25, 0.012 * i * r)) ? n.weighted(["PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], (s) => ({
    NONE: 0,
    PRISMATIC: 55,
    ANCIENT: 27,
    CORRUPTED: 15,
    PERFECT: 3
  })[s]) : "NONE";
}, La = (e, t, n, i, r = Z) => {
  if (t.length < 2 || t.length > 4 || new Set(t).size !== t.length) throw new Error("Fusion requires 2-4 distinct parents");
  const s = t.map((O) => e.stones[O]).filter((O) => !!O);
  if (s.length !== t.length) throw new Error("One or more parent stones do not exist");
  const o = n.consumeParents ?? !1;
  if (o && s.some((O) => O.locked || O.favorite)) throw new Error("Locked or favorite stones cannot be consumed");
  const a = o ? s.flatMap((O) => Object.values(O.equipment).filter((V) => !!V)) : [], c = /* @__PURE__ */ new Set();
  for (const O of a) {
    if (c.has(O.instanceId) || e.inventory.equipment[O.instanceId] || e.endlessMine.equipment.items.some((V) => V.id === O.instanceId))
      throw new Error("Parent equipment cannot be returned safely because its inventory ID already exists");
    c.add(O.instanceId);
  }
  if (e.endlessMine.equipment.items.length + a.length > e.endlessMine.equipment.capacity)
    throw new Error("Make room in Equipment Storage before consuming an equipped parent");
  if (Object.keys(e.stones).length + 1 - (o ? s.length : 0) > e.inventory.capacity) throw new Error("Stone capacity is full");
  const d = [...new Set(n.catalystIds ?? [])], f = ba(e, d), h = Ta(s, e.facilities.fusionLab, d)[0] ?? null;
  if (s.length > 2 && !h) throw new Error("A valid recipe is required for multi-stone fusion");
  const u = Na(s, h, f, i), I = f.reduce((O, V) => O + (V.traitLockSlots ?? 0), 0), g = Math.min(Math.max(0, e.facilities.fusionLab >= 3 ? 1 + I : I), 3), b = [...new Set(n.lockedTraitIds ?? [])];
  if (b.length > g) throw new Error("Too many locked traits for the current laboratory");
  const R = new Set(s.flatMap((O) => O.traitIds));
  if (b.some((O) => !R.has(O))) throw new Error("A locked trait is not present on a parent");
  const m = f.flatMap((O) => O.ivLockStats ?? []), p = e.facilities.fusionLab >= 4 ? 2 : 0, S = [.../* @__PURE__ */ new Set([...n.lockedIvStats ?? [], ...m])].slice(0, p);
  if ((n.lockedIvStats?.length ?? 0) > p) throw new Error("IV locking is not unlocked");
  h ? bt(e, h.cost) : bt(e, { currencies: { credits: 750, upgradeDust: 60 } });
  for (const O of d) e.inventory.items[O] = Math.max(0, (e.inventory.items[O] ?? 0) - 1);
  const M = ka(s, S, i), w = _a(s, u, b, i, Math.min(4, 1 + Math.floor(e.facilities.fusionLab / 2))), T = Ca(s, u, i), x = xa(s, f, i), $ = { accountId: e.account.accountId, username: e.account.username }, F = ft({
    species: u,
    origin: "FUSION",
    owner: $,
    rng: i,
    clock: r,
    mutation: x,
    forcedIvs: M,
    forcedTraits: w.traits,
    forcedSkills: T,
    personalityId: i.chance(0.78) ? i.pick(s).personalityId : void 0,
    parents: s.map(ms),
    grandparents: s.flatMap((O) => O.parents).slice(0, 8),
    generation: Math.max(...s.map((O) => O.generation)) + 1
  }), q = f.reduce((O, V) => O * (V.shinyMultiplier ?? 1), 1);
  if (F.colorVariant === "STANDARD" && i.chance(Math.min(0.15, 0.012 * q)) && (F.colorVariant = "SHINY"), F.stats = Le(F), e.stones[F.instanceId]) throw new Error("Stone ID collision");
  if (e.stones[F.instanceId] = F, o) {
    const O = new Set(s.map((V) => V.instanceId));
    for (const V of a)
      if (!Pt(e.endlessMine.equipment, $n(V), { autoSalvage: !1 }).accepted) throw new Error("Parent equipment could not be returned to Equipment Storage");
    for (const V of s) delete e.stones[V.instanceId];
    for (const V of e.parties) V.slots = V.slots.filter((Q) => !O.has(Q.stoneId));
    e.profile.showcaseStoneIds = e.profile.showcaseStoneIds.filter((V) => !O.has(V)), e.profile.favoriteStoneIds = e.profile.favoriteStoneIds.filter((V) => !O.has(V)), e.profile.totalAffinity = Object.values(e.stones).reduce((V, Q) => Math.min(Number.MAX_SAFE_INTEGER, V + Q.affinity.points), 0);
  }
  const Y = r.now(), oe = {
    id: Ge("fusion", i, Y.getTime()),
    parentIds: [...t],
    childId: F.instanceId,
    recipeId: h?.id ?? null,
    catalystIds: d,
    inheritedTraits: [...w.traits],
    inheritedSkills: [...T],
    mutation: x,
    consumeParents: o,
    createdAt: Y.toISOString()
  };
  return e.fusionHistory.unshift(oe), e.statistics.fusionCount += 1, x !== "NONE" && (e.statistics.mutationCount += 1), Wt(e, F), kt(e, 90 + F.generation * 10), _t(e, r), { child: F, history: oe, recipe: h, inheritedTraitIds: w.traits, inheritedSkillIds: T, grandparentInherited: w.grandparentInherited };
}, Li = {
  FIRE: ["EARTH"],
  EARTH: ["WIND"],
  WIND: ["WATER"],
  WATER: ["FIRE"],
  LIGHT: ["DARK"],
  DARK: ["LIGHT"],
  METAL: ["CRYSTAL"],
  CRYSTAL: ["ANCIENT"],
  ANCIENT: ["METAL"]
}, Da = (e, t) => e === "NEUTRAL" || t === "NEUTRAL" ? 1 : Li[e]?.includes(t) ? 1.25 : Li[t]?.includes(e) ? 0.8 : 1, Oa = (e, t) => ({
  currencies: Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(e.currencies ?? {}), ...Object.keys(t.currencies ?? {})])].map((n) => [n, (e.currencies?.[n] ?? 0) + (t.currencies?.[n] ?? 0)])),
  items: Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(e.items ?? {}), ...Object.keys(t.items ?? {})])].map((n) => [n, (e.items?.[n] ?? 0) + (t.items?.[n] ?? 0)])),
  accountXp: (e.accountXp ?? 0) + (t.accountXp ?? 0),
  miningXp: (e.miningXp ?? 0) + (t.miningXp ?? 0),
  stoneXp: (e.stoneXp ?? 0) + (t.stoneXp ?? 0)
}), $a = (e, t) => ({
  unitId: `${t.toLowerCase()}_${e.instanceId}`,
  stoneId: e.instanceId,
  team: t,
  speciesId: e.speciesId,
  name: e.nickname || e.name,
  element: e.primaryElement,
  role: re[e.speciesId]?.role ?? "ATTACK",
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
}), Pa = (e, t, n) => {
  const i = e.enemies[t];
  if (!i) throw new Error("Enemy definition missing");
  const r = re[i.speciesId];
  if (!r) throw new Error(`Unknown enemy species ${i.speciesId}`);
  const s = {
    speciesId: r.id,
    level: i.level,
    individualValues: { hardness: 15, purity: 15, power: 15, defense: 15, speed: 15, resonance: 15 },
    personalityId: "personality_stalwart",
    potential: 45,
    awakeningStage: 0,
    reincarnationCount: 0,
    limitBreak: 0,
    mutation: "NONE",
    traitIds: i.traitIds,
    learnedSkillNodes: []
  }, o = Le(s), a = Object.fromEntries(Object.entries(o).map(([c, l]) => [c, Math.max(1, Math.round(l * i.statMultiplier))]));
  return {
    unitId: `enemy_${i.id}_${n.int(1e3, 9999)}`,
    stoneId: i.id,
    team: "ENEMY",
    speciesId: r.id,
    name: r.name,
    element: r.primaryElement,
    role: r.role,
    level: i.level,
    stats: a,
    currentHp: a.maxHp,
    shield: 0,
    ultimate: 0,
    cooldowns: {},
    statuses: [],
    modifiers: [],
    skillIds: i.skillIds,
    traitIds: i.traitIds,
    alive: !0
  };
}, Qe = (e, t) => {
  let n = e.modifiers.filter((i) => i.stat === t).reduce((i, r) => i * r.multiplier, 1);
  return t === "defense" && e.statuses.some((i) => i.id === "FRACTURE") && (n *= 1 - Math.max(...e.statuses.filter((i) => i.id === "FRACTURE").map((i) => i.potency))), t === "defense" && e.currentHp / e.stats.maxHp <= 0.3 && e.traitIds.includes("trait_last_bastion") && (n *= 1.35), Math.max(1, e.stats[t] * n);
}, Fa = (e) => {
  for (const t of e.traitIds)
    for (const n of Nt[t]?.effects ?? [])
      n.trigger !== "BATTLE_START" || !n.stat || n.value === void 0 || e.modifiers.push({ stat: n.stat, multiplier: 1 + n.value, turns: 1, sourceId: t });
}, Ba = (e, t, n, i, r = Z) => {
  if (e.activeBattle && e.activeBattle.winner === null) throw new Error("A battle is already active");
  const s = as[t];
  if (!s) throw new Error(`Unknown dungeon ${t}`);
  if (e.accountProgress.level < s.minAccountLevel) throw new Error("Account level is too low for this dungeon");
  const o = s.stages.find((R) => R.id === n);
  if (!o) throw new Error(`Unknown dungeon stage ${n}`);
  const c = (e.parties.find((R) => R.id === e.activePartyId)?.slots ?? []).map((R) => e.stones[R.stoneId]).filter((R) => !!R).slice(0, 3);
  if (c.length === 0) throw new Error("The active party is empty");
  if (new Set(c.map((R) => R.instanceId)).size !== c.length) throw new Error("Party contains duplicate stones");
  const l = c.map((R) => $a(R, "PLAYER")), d = o.enemies.map((R, m) => Pa(o, m, i));
  for (const R of [...l, ...d]) Fa(R);
  const y = !e.dungeonClears[`${t}:${n}`] ? Oa(o.reward, o.firstClearReward) : { ...o.reward }, h = r.now(), u = Object.freeze({
    ...Er(c),
    ...Object.fromEntries(o.enemies.flatMap((R) => R.skillIds).map((R) => Ze[R]).filter((R) => !!R).map((R) => [R.id, fr(R)]))
  }), I = c.map((R, m) => ({
    ...hr(R),
    id: l[m].unitId
  })), g = d.map((R, m) => ({
    id: R.unitId,
    name: R.name,
    side: "ENEMY",
    role: R.role === "TANK" ? "GUARDIAN" : R.role === "CONTROL" ? "CONTROLLER" : R.role === "SUPPORT" ? "SUPPORT" : "STRIKER",
    family: re[R.speciesId]?.family,
    element: R.element,
    level: R.level,
    stats: {
      maxHp: R.stats.maxHp,
      attack: R.stats.power,
      defense: R.stats.defense + R.stats.hardness * 0.2,
      speed: R.stats.speed,
      accuracy: 92 + R.stats.purity * 0.1,
      resistance: 82 + R.stats.hardness * 0.12,
      critChance: Math.min(0.5, 0.05 + R.stats.purity / 1200),
      critDamage: 1.5,
      breakPower: 15 + R.stats.resonance * 0.2
    },
    skillIds: R.skillIds,
    initialUltimate: o.enemies.length === 1 ? 35 : 0,
    boss: o.enemies.length === 1 && m === 0 ? {
      weakPoint: s.element,
      weakPointMultiplier: 1.6,
      breakThreshold: 120 + R.level * 2,
      enrageTurn: 14,
      enrageMultiplier: 1.5,
      phases: [
        { id: "resonance-fracture", hpRatio: 0.6, attackMultiplier: 1.12, ultimateGain: 30 },
        { id: "last-stand", hpRatio: 0.28, defenseMultiplier: 1.18, speedMultiplier: 1.1, ultimateGain: 45 }
      ]
    } : void 0
  })), b = {
    battleId: Ge("battle", i, h.getTime()),
    mode: "DUNGEON",
    dungeonId: t,
    stageId: n,
    turn: 0,
    units: [...l, ...d],
    actionLog: [],
    winner: null,
    reward: y,
    startedAt: h.toISOString(),
    finishedAt: null,
    advanced: Jn({ units: [...I, ...g], skills: u, maxTurns: 100 }),
    controlMode: "MANUAL",
    speed: 1
  };
  return Sn(b), b;
}, br = (e, t) => e.units.filter((n) => n.team === t.team && n.alive), Ga = (e, t) => e.units.filter((n) => n.team !== t.team && n.alive), qa = (e, t, n, i) => {
  const r = br(e, t), s = Ga(e, t);
  switch (n.target) {
    case "SELF":
      return [t];
    case "ALLY":
      return [r.reduce((o, a) => a.currentHp / a.stats.maxHp < o.currentHp / o.stats.maxHp ? a : o, t)];
    case "ALL_ALLIES":
      return r;
    case "ALL_ENEMIES":
      return s;
    case "ENEMY": {
      const o = s.filter((a) => a.statuses.some((c) => c.id === "TAUNT"));
      return [i.pick(o.length > 0 ? o : s)];
    }
  }
}, Ua = (e, t, n) => {
  const r = t.skillIds.map((o) => Ze[o]).filter((o) => !!o).filter((o) => (t.cooldowns[o.id] ?? 0) <= 0 && (o.ultimateCost <= 0 || t.ultimate >= o.ultimateCost));
  if (r.length === 0) return Ze.skill_stone_strike;
  const s = br(e, t);
  return n.weighted(r, (o) => {
    const c = s.some((f) => f.currentHp / f.stats.maxHp < 0.55) && o.effects.some((f) => f.type === "HEAL" || f.type === "SHIELD") ? 8 : 1, l = o.ultimateCost > 0 ? 12 : 1, d = t.role === "SUPPORT" && o.tags.includes("support") || t.role === "TANK" && o.tags.includes("tank") ? 2 : 1;
    return Math.max(0.1, (o.priority + 1) * c * l * d);
  });
}, Ha = (e, t, n, i, r) => {
  const s = Qe(e, "power"), o = Qe(t, "defense"), a = Qe(e, "resonance"), c = Qe(e, "purity"), l = Math.min(0.42, 0.04 + c / (c + 260) * 0.28 + a / (a + 500) * 0.08), d = r.chance(l), f = 0.92 + r.next() * 0.16, y = Da(n.element, t.element), h = Math.max(1, s * i * (1.25 + e.level * 6e-3) - o * 0.34);
  let u = Math.max(1, Math.round(h * y * f * (d ? 1.55 : 1)));
  if (t.shield > 0) {
    const I = Math.min(t.shield, u);
    t.shield -= I, u -= I;
  }
  return t.currentHp = Math.max(0, t.currentHp - u), t.ultimate = Math.min(100, t.ultimate + Math.max(6, Math.round(u / Math.max(1, t.stats.maxHp) * 28))), t.currentHp <= 0 && (t.alive = !1), { damage: u, critical: d, defeated: !t.alive };
}, Ya = (e, t, n, i, r, s, o) => {
  for (const a of n)
    if (!(!a.alive && r.type !== "DAMAGE"))
      switch (r.type) {
        case "DAMAGE": {
          const c = Ha(t, a, i, r.power ?? 1, s);
          o.damage += c.damage, o.damageByTarget && (o.damageByTarget[a.unitId] = (o.damageByTarget[a.unitId] ?? 0) + c.damage), o.critical ||= c.critical, c.defeated && o.defeatedIds.push(a.unitId);
          break;
        }
        case "HEAL": {
          const c = Math.min(a.stats.maxHp - a.currentHp, Math.max(1, Math.round(Qe(t, "resonance") * (r.power ?? 1) + t.level * 1.5)));
          a.currentHp += c, o.healing += c, o.healingByTarget && (o.healingByTarget[a.unitId] = (o.healingByTarget[a.unitId] ?? 0) + c);
          break;
        }
        case "SHIELD":
          a.shield += Math.max(1, Math.round(Qe(t, "resonance") * (r.power ?? 1)));
          break;
        case "BUFF":
        case "DEBUFF": {
          if (!r.stat || r.value === void 0) break;
          a.modifiers.push({ stat: r.stat, multiplier: Math.max(0.1, 1 + r.value), turns: r.duration ?? 1, sourceId: i.id });
          break;
        }
        case "STATUS": {
          if (!r.statusId || !s.chance(r.chance ?? 1)) break;
          a.statuses = a.statuses.filter((c) => c.id !== r.statusId), a.statuses.push({ id: r.statusId, turns: r.duration ?? 1, potency: r.value ?? 0, sourceId: t.unitId }), o.statusesApplied.push(r.statusId);
          break;
        }
        case "ULTIMATE_GAIN":
          a.ultimate = Math.min(100, a.ultimate + (r.value ?? 0));
          break;
      }
}, ja = (e) => {
  for (const t of e.statuses)
    (t.id === "BURN" || t.id === "POISON") && (e.currentHp = Math.max(0, e.currentHp - Math.max(1, Math.round(e.stats.maxHp * t.potency))), e.currentHp === 0 && (e.alive = !1)), t.id === "REGEN" && (e.currentHp = Math.min(e.stats.maxHp, e.currentHp + Math.max(1, Math.round(e.stats.maxHp * t.potency))));
  return e.statuses.some((t) => t.id === "STUN");
}, Va = (e) => {
  e.statuses = e.statuses.map((t) => ({ ...t, turns: t.turns - 1 })).filter((t) => t.turns > 0), e.modifiers = e.modifiers.map((t) => ({ ...t, turns: t.turns - 1 })).filter((t) => t.turns > 0);
}, _n = (e) => {
  const t = e.units.some((i) => i.team === "PLAYER" && i.alive), n = e.units.some((i) => i.team === "ENEMY" && i.alive);
  return !t && !n ? "DRAW" : t ? n ? e.turn >= 100 ? "DRAW" : null : "PLAYER" : "ENEMY";
}, Nr = (e, t, n = Z) => {
  if (e.winner) return [];
  e.turn += 1;
  const i = [], r = e.units.filter((s) => s.alive).sort((s, o) => {
    const a = Qe(o, "speed") - Qe(s, "speed");
    return Math.abs(a) > 1e-3 ? a : t.next() - 0.5;
  });
  for (const s of r) {
    if (!s.alive || e.winner) continue;
    for (const a of Object.keys(s.cooldowns)) s.cooldowns[a] = Math.max(0, (s.cooldowns[a] ?? 0) - 1);
    const o = ja(s);
    if (!s.alive) {
      e.winner = _n(e);
      continue;
    }
    if (!o) {
      const a = Ua(e, s, t), c = qa(e, s, a, t).filter(Boolean), l = { turn: e.turn, actorId: s.unitId, skillId: a.id, targetIds: c.map((d) => d.unitId), damage: 0, healing: 0, damageByTarget: {}, healingByTarget: {}, critical: !1, statusesApplied: [], defeatedIds: [] };
      a.ultimateCost > 0 ? s.ultimate = Math.max(0, s.ultimate - a.ultimateCost) : s.ultimate = Math.min(100, s.ultimate + 15), a.cooldown > 0 && (s.cooldowns[a.id] = a.cooldown + 1);
      for (const d of a.effects) Ya(e, s, c, a, d, t, l);
      i.push(l), e.actionLog.push(l);
    }
    Va(s), e.winner = _n(e);
  }
  return e.winner = _n(e), e.winner && (e.finishedAt = n.now().toISOString()), i;
}, Bn = (e) => {
  if (e === "BURN") return "BURN";
  if (e === "STUN") return "STUN";
  if (e === "CRACK" || e === "VULNERABLE") return "FRACTURE";
  if (e === "REGENERATION") return "REGEN";
  if (e === "TAUNT") return "TAUNT";
}, Di = (e) => ({
  maxHp: e.stats.maxHp,
  power: e.stats.attack,
  defense: e.stats.defense,
  speed: e.stats.speed,
  hardness: e.stats.resistance,
  purity: e.stats.accuracy,
  resonance: e.stats.breakPower
}), Xa = (e, t) => {
  const n = e.units.find((o) => o.unitId === t.id), i = t.side === "PLAYER" ? t.id.replace(/^player_/, "") : t.id, r = n ?? {
    unitId: t.id,
    stoneId: i,
    team: t.side,
    speciesId: i,
    name: t.name,
    element: t.element ?? "NEUTRAL",
    role: t.role === "GUARDIAN" || t.role === "VANGUARD" || t.role === "TANK" ? "TANK" : t.role === "SUPPORT" ? "SUPPORT" : t.role === "CONTROLLER" || t.role === "BREAKER" ? "CONTROL" : "ATTACK",
    level: t.level,
    stats: Di(t),
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
  r.stats = Di(t), r.currentHp = t.hp, r.shield = t.shield, r.ultimate = t.ultimate, r.cooldowns = { ...t.cooldowns }, r.alive = t.alive, r.skillIds = [...t.skillIds];
  const s = [
    ...t.statuses.map((o) => ({ id: Bn(o.kind), turns: o.turns, potency: o.power, sourceId: o.sourceId })),
    ...t.controls.map((o) => ({ id: Bn(o.kind), turns: o.turns, potency: 1, sourceId: o.sourceId })),
    ...t.dots.map((o) => ({ id: "BURN", turns: o.turns, potency: o.power, sourceId: o.sourceId }))
  ].filter((o) => !!o.id);
  return r.statuses = s.map((o) => ({ ...o, turns: Math.max(1, Math.min(100, o.turns)) })), r.modifiers = t.modifiers.flatMap((o) => {
    const a = o.stat === "attack" ? "power" : o.stat === "resistance" ? "hardness" : o.stat === "accuracy" ? "purity" : o.stat === "breakPower" ? "resonance" : o.stat === "critChance" || o.stat === "critDamage" ? null : o.stat;
    return a ? [{ stat: a, multiplier: Math.max(0.01, 1 + o.value), turns: Math.max(1, Math.min(100, o.turns)), sourceId: o.sourceId }] : [];
  }), r;
}, Wa = (e, t) => {
  const n = [...new Set(t.resolutions.map((o) => o.targetId))], i = {}, r = {}, s = /* @__PURE__ */ new Set();
  for (const o of t.resolutions) {
    (o.kind === "DAMAGE" || o.kind === "DOT") && (i[o.targetId] = (i[o.targetId] ?? 0) + o.amount), o.kind === "HEAL" && (r[o.targetId] = (r[o.targetId] ?? 0) + o.amount);
    const a = Bn(o.status ?? "");
    a && s.add(a);
  }
  return {
    turn: t.turn,
    actorId: t.actorId,
    skillId: t.skillId,
    targetIds: n,
    damage: Object.values(i).reduce((o, a) => o + a, 0),
    healing: Object.values(r).reduce((o, a) => o + a, 0),
    damageByTarget: i,
    healingByTarget: r,
    critical: t.resolutions.some((o) => o.critical),
    statusesApplied: [...s],
    defeatedIds: []
  };
}, Sn = (e, t = [], n = Z, i) => {
  if (!e.advanced) return;
  const r = e.actionLog.length;
  for (const s of e.advanced.units) {
    const o = Xa(e, s), a = e.units.findIndex((c) => c.unitId === o.unitId);
    a >= 0 ? e.units[a] = o : e.units.push(o);
  }
  for (const s of t)
    e.actionLog.push(Wa(e, s)), s.counter && e.actionLog.push({
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
  for (const s of e.advanced.units.filter((o) => o.alive === !1 && i?.has(o.id))) {
    let o;
    for (let a = e.actionLog.length - 1; a >= r; a -= 1) {
      const c = e.actionLog[a];
      if ((c?.damageByTarget?.[s.id] ?? 0) > 0) {
        o = c;
        break;
      }
    }
    o && !o.defeatedIds.includes(s.id) && o.defeatedIds.push(s.id);
  }
  e.turn = e.advanced.turn, e.winner = e.advanced.outcome, e.winner && !e.finishedAt && (e.finishedAt = n.now().toISOString());
}, ci = (e = "BALANCED") => {
  const t = Mt(e), n = Mt("AGGRESSIVE");
  return (i, r, s) => i.units.find((o) => o.id === r)?.side === "PLAYER" ? t(i, r, s) : n(i, r, s);
}, Ka = (e, t, n = Z) => {
  if (!e.advanced) return Nr(e, t, n);
  const i = e.actionLog.length, r = e.advanced.log.length, s = new Set(e.advanced.units.filter((o) => o.alive).map((o) => o.id));
  return fn(e.advanced, { commandProvider: ci() }, t), Sn(e, e.advanced.log.slice(r), n, s), e.actionLog.slice(i);
}, za = (e, t, n, i, r = Z) => {
  if (!e.advanced || e.winner) throw new Error("No active advanced dungeon battle");
  const s = Qn(e.advanced).find((l) => e.advanced.units.find((d) => d.id === l)?.side === "PLAYER");
  if (!s) throw new Error("No living player actor");
  if (!pn(e.advanced, s).some((l) => l.id === t)) throw new Error("Selected skill is not usable");
  const o = e.actionLog.length, a = e.advanced.log.length, c = new Set(e.advanced.units.filter((l) => l.alive).map((l) => l.id));
  return fn(e.advanced, {
    commands: { [s]: { actorId: s, skillId: t, targetIds: n } },
    commandProvider: ci()
  }, i), Sn(e, e.advanced.log.slice(a), r, c), e.actionLog.slice(o);
}, Ja = (e, t, n = Z) => {
  if (e.advanced) {
    const i = e.advanced.log.length, r = new Set(e.advanced.units.filter((s) => s.alive).map((s) => s.id));
    rr(e.advanced, ci(), t), Sn(e, e.advanced.log.slice(i), n, r);
  } else for (; !e.winner; ) Nr(e, t, n);
  return e;
}, Qa = (e, t, n = Z) => {
  if (!t.winner || !t.finishedAt) throw new Error("Battle has not finished");
  if (e.battleHistory.some((o) => o.battleId === t.battleId)) return;
  const i = t.winner === "PLAYER", r = t.winner === "ENEMY";
  i ? e.statistics.battleWins += 1 : r && (e.statistics.battleLosses += 1);
  const s = t.units.filter((o) => o.team === "PLAYER");
  for (const o of s) {
    const a = e.stones[o.stoneId];
    if (!a) continue;
    const c = t.actionLog.filter((d) => d.actorId === o.unitId), l = t.actionLog.filter((d) => d.targetIds.includes(o.unitId)).reduce((d, f) => f.damageByTarget ? d + (f.damageByTarget[o.unitId] ?? 0) : d + f.damage / Math.max(1, f.targetIds.length), 0);
    a.battleStatistics.battles += 1, i ? a.battleStatistics.wins += 1 : r && (a.battleStatistics.losses += 1), a.battleStatistics.damageDealt += c.reduce((d, f) => d + f.damage, 0), a.battleStatistics.damageTaken += l, a.battleStatistics.healingDone += c.reduce((d, f) => d + f.healing, 0), a.battleStatistics.criticalHits += c.filter((d) => d.critical).length, a.battleStatistics.enemiesDefeated += c.reduce((d, f) => d + f.defeatedIds.length, 0), a.battleStatistics.ultimatesUsed += c.filter((d) => (Ze[d.skillId]?.ultimateCost ?? 0) > 0).length, Ki(a, i ? t.reward?.stoneXp ?? 45 : Math.round((t.reward?.stoneXp ?? 30) * 0.35)), un(a, i ? 18 : 6);
  }
  if (i && t.reward && Rr(e, { ...t.reward }), i && t.mode === "DUNGEON" && t.dungeonId && t.stageId) {
    const o = `${t.dungeonId}:${t.stageId}`, a = e.dungeonClears[o];
    e.dungeonClears[o] = a ? { ...a, bestTurns: Math.min(a.bestTurns, t.turn), clearCount: a.clearCount + 1 } : { bestTurns: t.turn, clearCount: 1, firstClearedAt: n.now().toISOString() };
  }
  kt(e, i ? 25 : 8), e.profile.totalAffinity = Object.values(e.stones).reduce((o, a) => o + a.affinity.points, 0), e.battleHistory.unshift(t), e.battleHistory.length > 100 && (e.battleHistory.length = 100), _t(e, n);
}, rt = (e, t, n, i, r = Z, s) => {
  const o = r.now(), a = s ?? Ge("evt", i, o.getTime()), c = e.online.queue.find((d) => d.eventId === a);
  if (c) return c;
  if (e.online.processedReceipts.some((d) => d.eventId === a)) throw new Error("Online event was already acknowledged");
  e.online.sequence += 1;
  const l = {
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
  return e.online.queue.push(l), l;
}, Za = (e, t = Z, n = 100) => {
  const i = t.now().getTime();
  return e.online.queue.filter((r) => new Date(r.nextAttemptAt).getTime() <= i).slice(0, Math.max(1, n));
}, Oi = (e, t = Z) => {
  e.attempts += 1;
  const n = Math.min(3e5, 1e3 * 2 ** Math.min(8, e.attempts));
  e.nextAttemptAt = new Date(t.now().getTime() + n).toISOString();
}, Gn = 6e4, st = 60 * Gn, at = 720 * st, ec = 2880, Yt = 64, yn = 32, kr = 100, _r = 1e9, qn = "::", Un = ":expedition-mutation:", tc = ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], nc = (e) => `${e.itemId}${qn}${e.rarity}${qn}${encodeURIComponent(e.seed)}`, Cr = (e) => {
  const [t, n, i, ...r] = e.split(qn);
  if (!t?.startsWith("equipment_") || !n || !i || r.length > 0 || !jt.includes(n)) return null;
  try {
    const s = decodeURIComponent(i);
    return s ? { itemId: t, rarity: n, seed: s } : null;
  } catch {
    return null;
  }
}, xr = [
  { id: "duration_15m", label: "15 minutes", durationMs: 15 * Gn, yieldMultiplier: 0.25, rareMultiplier: 0.52 },
  { id: "duration_30m", label: "30 minutes", durationMs: 30 * Gn, yieldMultiplier: 0.5, rareMultiplier: 0.72 },
  { id: "duration_1h", label: "1 hour", durationMs: st, yieldMultiplier: 1, rareMultiplier: 1 },
  { id: "duration_3h", label: "3 hours", durationMs: 3 * st, yieldMultiplier: 2.9, rareMultiplier: 1.8 },
  { id: "duration_4h", label: "4 hours", durationMs: 4 * st, yieldMultiplier: 3.8, rareMultiplier: 2.08 },
  { id: "duration_6h", label: "6 hours", durationMs: 6 * st, yieldMultiplier: 5.6, rareMultiplier: 2.55 },
  { id: "duration_12h", label: "12 hours", durationMs: 12 * st, yieldMultiplier: 10.8, rareMultiplier: 3.65 },
  { id: "duration_24h", label: "24 hours", durationMs: 24 * st, yieldMultiplier: 20.5, rareMultiplier: 5.2 }
], Lr = [
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
], li = Object.fromEntries(xr.map((e) => [e.id, e])), An = Object.fromEntries(Lr.map((e) => [e.id, e])), jt = ["NORMAL", "RARE", "SR", "SSR", "UR", "LEGENDARY"], Dr = {
  BALANCED: { id: "BALANCED", battle: 1, mining: 1, xp: 1, material: 1, discovery: 1, reward: 1, winShift: 0, failureRetention: 0.62 },
  COMBAT: { id: "COMBAT", battle: 1.28, mining: 0.82, xp: 1.25, material: 0.82, discovery: 0.78, reward: 1.08, winShift: 0.08, failureRetention: 0.58 },
  MINING: { id: "MINING", battle: 0.9, mining: 1.52, xp: 0.86, material: 1.7, discovery: 1.05, reward: 1.08, winShift: -0.04, failureRetention: 0.68 },
  DISCOVERY: { id: "DISCOVERY", battle: 0.88, mining: 1.08, xp: 0.84, material: 0.92, discovery: 1.9, reward: 1.03, winShift: -0.05, failureRetention: 0.64 },
  SAFE: { id: "SAFE", battle: 1.08, mining: 0.92, xp: 0.88, material: 0.86, discovery: 0.72, reward: 0.76, winShift: 0.17, failureRetention: 0.92 },
  HIGH_RISK: { id: "HIGH_RISK", battle: 0.9, mining: 1.12, xp: 1.3, material: 1.36, discovery: 1.62, reward: 1.62, winShift: -0.16, failureRetention: 0.3 },
  EXPERIENCE: { id: "EXPERIENCE", battle: 1.08, mining: 0.82, xp: 1.55, material: 0.8, discovery: 0.82, reward: 1, winShift: 0, failureRetention: 0.6 },
  MATERIALS: { id: "MATERIALS", battle: 0.92, mining: 1.42, xp: 0.86, material: 1.7, discovery: 0.88, reward: 1.04, winShift: -0.03, failureRetention: 0.66 }
}, Or = (e) => {
  const t = e.lastIndexOf(Un);
  if (t < 0) return null;
  const n = e.slice(t + Un.length);
  return tc.includes(n) ? n : null;
}, ic = (e, t) => `${e}${Un}${t}`, rc = (e, t, n, i, r = 1) => {
  const s = An[t], o = li[n], a = Dr[i];
  if (!s || !o || !a) throw new Error("Cannot roll a mutation for invalid expedition configuration");
  const c = Math.max(0.55, Math.min(2.5, r)), l = Math.min(0.35, 15e-4 + s.mutationEncounterChance * o.rareMultiplier * a.discovery * c), d = new Ee(`${e}:mutation-roll:${s.id}:${o.id}:${a.id}`);
  return d.chance(l) ? d.weighted(["PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], (f) => ({
    NONE: 0,
    PRISMATIC: 54,
    ANCIENT: 27,
    CORRUPTED: 16,
    PERFECT: 3
  })[f]) : "NONE";
}, Ke = () => ({
  credits: 0,
  upgradeDust: 0,
  researchCores: 0,
  accountXp: 0,
  stoneXpPerMember: 0,
  affinityPerMember: 0,
  items: {},
  rareDiscoveries: []
}), sc = () => ({
  battles: 0,
  wins: 0,
  miningYield: 0,
  rareDiscoveries: 0,
  equipmentDrops: 0,
  bestDropRarity: null
}), ze = (e, t = _r) => !Number.isFinite(e) || e <= 0 ? 0 : Math.min(t, Math.floor(e)), fe = (e, t, n = _r) => Math.min(n, ze(e, n) + ze(t, n)), oc = (e, t) => {
  if (e.rareDiscoveries.length + t.rareDiscoveries.length > yn)
    throw new Error("Expedition rare-discovery storage capacity invariant exceeded");
  e.credits = fe(e.credits, t.credits), e.upgradeDust = fe(e.upgradeDust, t.upgradeDust), e.researchCores = fe(e.researchCores, t.researchCores), e.accountXp = fe(e.accountXp, t.accountXp), e.stoneXpPerMember = fe(e.stoneXpPerMember, t.stoneXpPerMember), e.affinityPerMember = fe(e.affinityPerMember, t.affinityPerMember);
  for (const [n, i] of Object.entries(t.items)) e.items[n] = fe(e.items[n] ?? 0, i);
  e.rareDiscoveries.push(...t.rareDiscoveries);
}, ac = (e) => ({
  ...e,
  items: { ...e.items },
  rareDiscoveries: e.rareDiscoveries.map((t) => ({ ...t }))
}), cc = (e) => e.hardness + e.purity + e.power + e.defense + e.speed + e.resonance + e.maxHp / 8, lc = (e) => {
  const t = {}, n = /* @__PURE__ */ new Map();
  for (const i of Object.values(e.equipment)) {
    if (!i) continue;
    const r = i.setId ?? ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"].find((s) => i.definitionId.startsWith(`${s}_`));
    r && n.set(r, (n.get(r) ?? 0) + 1);
    for (const s of i.affixes) {
      const o = e.stats[s.stat], a = s.operation === "PERCENT" ? o * s.value : s.value;
      t[s.stat] = (t[s.stat] ?? 0) + a;
    }
  }
  return (n.get("BASTION") ?? 0) >= 2 && (t.defense = (t.defense ?? 0) + e.stats.defense * 0.12), (n.get("BASTION") ?? 0) >= 4 && (t.maxHp = (t.maxHp ?? 0) + e.stats.maxHp * 0.2), (n.get("RESONANCE") ?? 0) >= 4 && (t.speed = (t.speed ?? 0) + e.stats.speed * 0.15), (n.get("HUNTER") ?? 0) >= 2 && (t.power = (t.power ?? 0) + e.stats.power * 0.1), (n.get("ABYSSAL") ?? 0) >= 2 && (t.resonance = (t.resonance ?? 0) + e.stats.resonance * 0.15), (n.get("ABYSSAL") ?? 0) >= 4 && (t.power = (t.power ?? 0) + e.stats.power * 0.18), t;
}, dc = (e, t) => {
  const n = e.parties.find((i) => i.id === t);
  if (!n || n.slots.length === 0) throw new Error("Expedition requires a non-empty party");
  return n.slots.map(({ stoneId: i }) => {
    const r = e.stones[i];
    if (!r) throw new Error(`Expedition party stone is missing: ${i}`);
    const s = Object.values(r.equipment).filter((o) => !!o);
    return {
      stoneId: i,
      speciesId: r.speciesId,
      level: r.level,
      rarity: r.rarity,
      primaryElement: r.primaryElement,
      secondaryElement: r.secondaryElement,
      stats: { ...r.stats },
      individualValues: { ...r.individualValues },
      skillIds: r.skills.map((o) => o.skillId),
      traitIds: [...r.traitIds],
      equipment: s.map((o) => ({ ...o, affixes: o.affixes.map((a) => ({ ...a })) })),
      equipmentBonuses: lc(r),
      mutation: r.mutation,
      generation: r.generation,
      lineage: [...r.parents, ...r.grandparents].slice(0, 8).map((o) => ({ ...o, traitIds: [...o.traitIds] })),
      power: Math.floor(cc(r.stats)),
      affinityRank: r.affinity.rank
    };
  });
}, uc = (e) => Object.values(e.expeditions.runs).filter((t) => t.status !== "CLAIMED").length, mc = (e, t) => {
  const n = e.expeditions.runs[t];
  if (!n) throw new Error("Expedition not found");
  if (n.status === "CLAIMED") throw new Error("Expedition is already claimed");
  return n.repeat = !1, n;
}, pc = (e, t, n, i = Z) => {
  const r = An[t.regionId], s = li[t.durationId];
  if (!r) throw new Error(`Unknown expedition region: ${t.regionId}`);
  if (!s) throw new Error(`Unknown expedition duration: ${t.durationId}`);
  if (!Tr.includes(t.strategy)) throw new Error("Unknown expedition strategy");
  if (e.facilities.expeditionGuild < r.requiredGuildLevel) throw new Error(`Expedition Guild level ${r.requiredGuildLevel} required`);
  const o = Math.min(4, 1 + Math.floor((e.facilities.expeditionGuild - 1) / 2));
  if (uc(e) >= o) throw new Error("All expedition slots are occupied");
  const a = t.partyId ?? e.activePartyId, c = dc(e, a), l = /* @__PURE__ */ new Set([
    ...e.training.assignment ? [e.training.assignment.stoneId] : [],
    ...e.affinityGarden.assignment ? [e.affinityGarden.assignment.stoneId] : [],
    ...e.endlessMine.status === "RUNNING" || e.endlessMine.status === "PAUSED" ? e.endlessMine.partyStoneIds : [],
    ...e.activeBattle && !e.activeBattle.winner ? e.activeBattle.units.filter((g) => g.team === "PLAYER").map((g) => g.stoneId) : []
  ]);
  if (c.some((g) => l.has(g.stoneId))) throw new Error("A party stone is assigned to another background activity");
  const d = new Set(Object.values(e.expeditions.runs).filter((g) => g.status !== "CLAIMED").flatMap((g) => g.partySnapshot.map((b) => b.stoneId)));
  if (c.some((g) => d.has(g.stoneId))) throw new Error("A party stone is already on expedition");
  const f = i.now();
  if (!Number.isFinite(f.getTime())) throw new Error("Expedition clock returned an invalid date");
  const y = Ge("expedition", n, f.getTime()), h = `${y}:${Math.floor(n.next() * 4294967296).toString(16)}`, u = {
    expeditionId: y,
    regionId: r.id,
    durationId: s.id,
    durationMs: s.durationMs,
    strategy: t.strategy,
    partyId: a,
    partySnapshot: c,
    seed: h,
    repeat: !!t.repeat,
    status: "ACTIVE",
    startedAt: f.toISOString(),
    lastSimulatedAt: f.toISOString(),
    nextCompletionAt: new Date(f.getTime() + s.durationMs).toISOString(),
    completedCycles: 0,
    claimedCycles: 0,
    claimCount: 0,
    expeditionStorage: Ke(),
    reportEvents: [{
      reportId: `${y}:departure`,
      expeditionId: y,
      cycle: 0,
      completedAt: f.toISOString(),
      offsetMs: 0,
      kind: "DEPARTURE",
      title: `Departed for ${r.name}`,
      detail: `${c.length} stones began a ${s.label} expedition.`,
      successScore: 0,
      battleWon: null,
      miningYield: 0,
      equipmentDropId: null,
      equipmentDropSeed: null,
      bestDropRarity: null,
      rareDiscoveryCount: 0,
      reward: { credits: 0, upgradeDust: 0, researchCores: 0, accountXp: 0, stoneXpPerMember: 0, affinityPerMember: 0, items: {} }
    }],
    reportSummary: sc(),
    lastClaimedAt: null
  };
  e.expeditions.runs[y] = u, e.expeditions.order.unshift(y), e.expeditions.order = e.expeditions.order.slice(0, 100);
  const I = new Set(e.expeditions.order);
  for (const [g, b] of Object.entries(e.expeditions.runs)) !I.has(g) && b.status === "CLAIMED" && delete e.expeditions.runs[g];
  return u;
}, ut = () => ({ combat: 0, mining: 0, exploration: 0, research: 0 }), W = (e, t, n = 1) => {
  e.combat += t.combat * n, e.mining += t.mining * n, e.exploration += t.exploration * n, e.research += t.research * n;
}, di = {
  hardness: { combat: 0.18, mining: 1.35, exploration: 0.2, research: 0.08 },
  purity: { combat: 0.08, mining: 0.92, exploration: 0.84, research: 0.78 },
  power: { combat: 1.3, mining: 0.16, exploration: 0.1, research: 0.06 },
  defense: { combat: 1, mining: 0.32, exploration: 0.36, research: 0.05 },
  speed: { combat: 0.7, mining: 0.14, exploration: 0.78, research: 0.2 },
  resonance: { combat: 0.42, mining: 0.72, exploration: 1.08, research: 1.4 },
  maxHp: { combat: 0.14, mining: 0.018, exploration: 0.035, research: 0.01 }
}, an = {
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
}, fc = {
  ATTACK: { combat: 15, mining: 3, exploration: 2, research: 1 },
  TANK: { combat: 11, mining: 9, exploration: 5, research: 1 },
  SUPPORT: { combat: 6, mining: 4, exploration: 9, research: 12 },
  CONTROL: { combat: 9, mining: 2, exploration: 12, research: 7 }
}, $r = {
  NONE: ut(),
  PRISMATIC: { combat: 9, mining: 4, exploration: 17, research: 15 },
  ANCIENT: { combat: 11, mining: 13, exploration: 8, research: 17 },
  CORRUPTED: { combat: 18, mining: 11, exploration: 5, research: 4 },
  PERFECT: { combat: 25, mining: 25, exploration: 25, research: 25 }
}, Pr = (e, t, n = 1) => {
  for (const i of t) {
    const r = {
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
    }[i] ?? null;
    r && W(e, r, n);
  }
}, hc = (e, t) => {
  const n = ut(), i = Ze[e];
  if (!i) return n;
  const r = i.target === "ALL_ENEMIES" || i.target === "ALL_ALLIES" ? 1.22 : i.target === "SELF" ? 0.88 : 1, s = i.ultimateCost > 0 ? 0.82 : 1 / (1 + i.cooldown * 0.08);
  for (const o of i.effects) {
    const a = Math.max(0, o.power ?? 0) * r * s;
    switch (o.type) {
      case "DAMAGE":
        W(n, { combat: 29, mining: 2.5, exploration: 2, research: 0.8 }, a);
        break;
      case "HEAL":
        W(n, { combat: 13, mining: 1, exploration: 18, research: 5 }, a);
        break;
      case "SHIELD":
        W(n, { combat: 17, mining: 3, exploration: 15, research: 2 }, a);
        break;
      case "BUFF":
      case "DEBUFF": {
        const c = o.stat ? di[o.stat] : null;
        c && W(n, c, Math.abs(o.value ?? 0) * 58 * r * s);
        break;
      }
      case "STATUS":
        W(n, { combat: 8, mining: 0.5, exploration: 8, research: 4 }, (o.chance ?? 1) * r * s);
        break;
      case "ULTIMATE_GAIN":
        W(n, { combat: 3, mining: 0.5, exploration: 2, research: 5 }, Math.max(0, o.value ?? 0) / 8);
        break;
    }
  }
  return Pr(n, i.tags, s), W(n, an[i.element], t.favoredElements.includes(i.element) ? 1.35 : 0.72), n.research += Math.max(0, i.priority) * 0.8 + i.effects.length * 1.2, n;
}, Fr = (e, t, n) => {
  const i = ut();
  for (const r of e) {
    const s = Nt[r];
    if (!s) continue;
    const o = s.tier === "COMMON" ? 1 : s.tier === "RARE" ? 1.2 : 1.38, a = { ALWAYS: 1, BATTLE_START: 0.88, LOW_HP: 0.48, ON_HIT: 0.74, ON_CRIT: 0.42, TURN_START: 0.82 };
    for (const c of s.effects) {
      if (!c.stat) continue;
      const l = Math.sqrt(Math.max(1, t[c.stat])), d = c.operation === "PERCENT" ? l * Math.abs(c.value ?? 0) * 6 : Math.log2(1 + Math.abs(c.value ?? 0)), f = c.element ? n.favoredElements.includes(c.element) ? 1.35 : 0.72 : 1;
      W(i, di[c.stat], d * a[c.trigger] * f * o);
    }
    Pr(i, s.tags, o), i.research += s.effects.length * o;
  }
  return i;
}, Ec = (e) => {
  const t = ut(), n = /* @__PURE__ */ new Map(), i = { NORMAL: 1, RARE: 1.25, SR: 1.55, SSR: 1.9, UR: 2.3, LEGENDARY: 2.8 }, r = {
    CORE: { combat: 7, mining: 3, exploration: 2, research: 5 },
    RUNE: { combat: 3, mining: 3, exploration: 6, research: 9 },
    RELIC: { combat: 4, mining: 8, exploration: 6, research: 4 },
    CHARM: { combat: 2, mining: 5, exploration: 9, research: 5 }
  };
  for (const o of e.equipment) {
    const a = o.setId ?? ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"].find((d) => o.definitionId.startsWith(`${d}_`)) ?? null;
    a && n.set(a, (n.get(a) ?? 0) + 1);
    const c = i[o.rarity] * (1 + Math.max(0, o.level - 1) * 0.025);
    W(t, r[o.slot] ?? ut(), c);
    for (const d of o.affixes) {
      const f = d.operation === "PERCENT" ? Math.abs(d.value) * 48 : Math.log2(1 + Math.abs(d.value)) * 0.8;
      W(t, di[d.stat], f);
      const y = d.sourceStat;
      y === "accuracy" ? W(t, { combat: 3, mining: 0, exploration: 7, research: 1 }, f) : y === "resistance" ? W(t, { combat: 4, mining: 1, exploration: 6, research: 2 }, f) : y === "critChance" || y === "critDamage" ? W(t, { combat: 8, mining: 0, exploration: 2, research: 1 }, f) : y === "breakPower" && W(t, { combat: 5, mining: 8, exploration: 1, research: 0 }, f);
    }
    const l = o.definitionId.toLowerCase();
    l.includes("quarry") && W(t, { combat: 0, mining: 7, exploration: 3, research: 1 }, c), (l.includes("resonance") || l.includes("rune")) && W(t, { combat: 1, mining: 2, exploration: 4, research: 7 }, c), l.includes("caldera") && W(t, { combat: 7, mining: 5, exploration: 1, research: 0 }, c), l.includes("ancestor") && W(t, { combat: 2, mining: 4, exploration: 4, research: 8 }, c), l.includes("meteor") && W(t, { combat: 3, mining: 6, exploration: 7, research: 2 }, c), l.includes("abyss") && W(t, { combat: 6, mining: 2, exploration: 7, research: 4 }, c), l.includes("celestial") && W(t, { combat: 4, mining: 2, exploration: 7, research: 8 }, c);
  }
  const s = {
    BASTION: { combat: 8, mining: 5, exploration: 4, research: 1 },
    RESONANCE: { combat: 3, mining: 4, exploration: 7, research: 10 },
    HUNTER: { combat: 10, mining: 6, exploration: 3, research: 1 },
    ABYSSAL: { combat: 9, mining: 3, exploration: 8, research: 6 }
  };
  for (const [o, a] of n) {
    const c = s[o];
    c && W(t, c, a + (a >= 2 ? 1.5 : 0) + (a >= 4 ? 2.5 : 0));
  }
  return t;
}, gc = (e, t, n) => {
  const i = ut();
  return e.lineage.forEach((r, s) => {
    const o = re[r.speciesId];
    if (!o) return;
    const a = 0.72 / (1 + s * 0.18);
    W(i, fc[o.role], a), W(i, an[o.primaryElement], a * (n.favoredElements.includes(o.primaryElement) ? 1.25 : 0.58)), W(i, Fr(r.traitIds, t, n), a * 0.42), W(i, $r[r.mutation], a * 0.55);
  }), i;
}, Ic = (e, t) => {
  const n = { combat: 0, mining: 0, exploration: 0, research: 0, elementMatches: 0 };
  for (const i of e) {
    const r = Object.fromEntries(Object.entries(i.stats).map(([l, d]) => [l, d + (i.equipmentBonuses[l] ?? 0)])), s = Object.values(i.individualValues).reduce((l, d) => l + d, 0) / 186, o = Math.min(8, i.lineage.length) * 0.015 + Math.min(10, i.generation) * 0.012, a = t.favoredElements.includes(i.primaryElement) || i.secondaryElement !== null && t.favoredElements.includes(i.secondaryElement);
    a && (n.elementMatches += 1), n.combat += r.power * 1.25 + r.defense + r.speed * 0.72 + r.maxHp * 0.14 + i.affinityRank * 12 + s * 80 + o * 100 + (a ? 72 : 0), n.mining += r.hardness * 1.2 + r.purity + r.resonance * 0.9 + i.level * 2.2 + s * 32, n.exploration += r.purity * 0.9 + r.resonance * 1.25 + r.speed * 0.4 + i.affinityRank * 15 + o * 75 + (a ? 28 : 0), n.research += r.resonance * 1.18 + r.purity * 0.76 + r.speed * 0.18 + i.level * 1.35 + i.affinityRank * 9 + s * 42 + o * 82;
    const c = ut();
    for (const l of i.skillIds) W(c, hc(l, t));
    W(c, Fr(i.traitIds, r, t)), W(c, Ec(i)), W(c, gc(i, r, t)), W(c, $r[i.mutation]), W(c, an[i.primaryElement], a ? 1.4 : 0.52), i.secondaryElement && W(c, an[i.secondaryElement], t.favoredElements.includes(i.secondaryElement) ? 0.8 : 0.32), n.combat += c.combat, n.mining += c.mining, n.exploration += c.exploration, n.research += c.research;
  }
  return {
    combat: Math.round(n.combat * 1e6) / 1e6,
    mining: Math.round(n.mining * 1e6) / 1e6,
    exploration: Math.round(n.exploration * 1e6) / 1e6,
    research: Math.round(n.research * 1e6) / 1e6,
    elementMatches: n.elementMatches
  };
}, Br = (e, t) => e === null ? t : t === null ? e : jt.indexOf(t) > jt.indexOf(e) ? t : e, ot = (e) => ({
  credits: e.credits,
  upgradeDust: e.upgradeDust,
  researchCores: e.researchCores,
  accountXp: e.accountXp,
  stoneXpPerMember: e.stoneXpPerMember,
  affinityPerMember: e.affinityPerMember,
  items: { ...e.items }
}), Sc = (e, t, n, i = !1) => {
  const r = An[e.regionId], s = li[e.durationId];
  if (!r || !s || e.durationMs !== s.durationMs) throw new Error("Expedition references invalid configuration");
  const o = new Ee(`${e.seed}:cycle:${t}`), a = Ic(e.partySnapshot, r), c = Dr[e.strategy], l = a.combat * c.battle / Math.max(1, r.enemyPower), d = Math.max(0.3, Math.min(2.5, a.mining * c.mining / Math.max(1, r.miningDifficulty))), f = Math.max(0.3, Math.min(2.5, a.exploration / Math.max(100, r.miningDifficulty * 0.48))), y = Math.max(0.3, Math.min(2.5, a.research / Math.max(100, r.miningDifficulty * 0.42))), h = Math.max(0.08, Math.min(0.995, 0.42 + Math.log2(Math.max(0.25, l)) * 0.18 + a.elementMatches * 0.035 + c.winShift)), u = o.chance(Math.min(0.8, r.bossChance * s.rareMultiplier)), I = o.chance(Math.max(0.08, h - (u ? 0.16 : 0))), g = Math.max(0.22, Math.min(1.65, 0.72 + l * 0.2 + (I ? 0.24 : -0.12))) * (I ? 1 : c.failureRetention), b = 0.88 + o.next() * 0.24, R = s.yieldMultiplier * g * b * c.reward, m = ze(10 * s.yieldMultiplier * d * c.material, 1e6), p = Ke();
  p.credits = ze(r.baseCreditsPerHour * R * (0.86 + f * 0.14)), p.upgradeDust = ze(r.baseDustPerHour * R * c.material * (0.78 + d * 0.22)), p.accountXp = ze(r.baseAccountXpPerHour * R * c.xp * (0.78 + y * 0.22)), p.stoneXpPerMember = ze(r.baseStoneXpPerHour * R * c.xp * (0.88 + (l + y) * 0.06)), p.affinityPerMember = ze(r.baseAffinityPerHour * s.yieldMultiplier * (e.strategy === "BALANCED" ? 1.15 : 1) * (0.82 + f * 0.1 + y * 0.08)), (i || o.chance(Math.min(0.72, (0.012 + r.requiredGuildLevel * 0.011) * s.rareMultiplier * (0.72 + y * 0.28)))) && (p.researchCores = 1);
  const S = Math.min(0.96, r.materialChance * s.rareMultiplier * c.material * (0.82 + d * 0.18));
  o.chance(S) && (p.items[o.pick(r.materialDropIds)] = Math.max(1, Math.floor(Math.sqrt(s.yieldMultiplier) * d)));
  const M = o.chance(Math.min(0.55, r.equipmentDropChance * s.rareMultiplier * c.material * (0.84 + f * 0.16))), w = M ? r.requiredGuildLevel >= 6 ? "UR" : r.requiredGuildLevel >= 4 ? "SSR" : "SR" : null, T = M ? `${e.seed}:equipment:${t}` : null;
  M && w && T && (p.items[nc({ itemId: r.equipmentDropId, rarity: w, seed: T })] = 1);
  let x = o.chance(Math.min(0.5, r.mutationEncounterChance * s.rareMultiplier * c.discovery * (0.8 + f * 0.2)));
  x && (p.items.material_mutation_trace = 1);
  const $ = o.chance(Math.min(0.8, r.eventChance * s.rareMultiplier * (0.78 + f * 0.22)));
  $ && (p.credits = fe(p.credits, Math.floor(r.baseCreditsPerHour * 0.35 * s.yieldMultiplier)));
  const F = Math.min(0.35, r.rareDiscoveryChance * s.rareMultiplier * c.discovery * f * (I ? 1 : 0.55));
  if (o.chance(F)) {
    const Q = o.pick(r.rareSpeciesIds), qe = re[Q];
    if (qe) {
      const Oe = `${e.seed}:discovery:${t}`, Ue = rc(Oe, r.id, s.id, e.strategy, f), E = ic(Oe, Ue);
      Ue !== "NONE" && (x = !0, p.items.material_mutation_trace = Math.max(1, p.items.material_mutation_trace ?? 0)), p.rareDiscoveries.push({
        discoveryId: `${e.expeditionId}:discovery:${t}`,
        seed: E,
        speciesId: Q,
        veinId: `${r.id}:rare`,
        areaId: r.id,
        hintedRarity: qe.rarity,
        sourceEventId: `${e.expeditionId}:cycle:${t}`,
        discoveredAt: new Date(n).toISOString()
      });
    }
  }
  const q = new Date(n).toISOString(), Y = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, n - Date.parse(e.startedAt))), oe = Math.round(h * 1e3) / 10, O = [{
    reportId: `${e.expeditionId}:${t}:${u ? "boss" : "battle"}`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: Y,
    kind: u ? "BOSS" : "BATTLE",
    title: u ? `Boss encounter: ${r.enemyTags.at(-1)}` : `Battle in ${r.name}`,
    detail: I ? "The expedition party secured the route." : "The party withdrew safely and preserved part of the haul.",
    successScore: oe,
    battleWon: I,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: null,
    rareDiscoveryCount: 0,
    reward: ot(Ke())
  }, {
    reportId: `${e.expeditionId}:${t}:mining`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: Y,
    kind: "MINING",
    title: `Surveyed ${r.name}`,
    detail: `Recovered ${m} units from ${r.miningDifficulty} difficulty strata.`,
    successScore: oe,
    battleWon: null,
    miningYield: m,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: null,
    rareDiscoveryCount: 0,
    reward: ot(p)
  }];
  M && O.push({
    reportId: `${e.expeditionId}:${t}:equipment`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: Y,
    kind: "EQUIPMENT",
    title: "Equipment cache recovered",
    detail: r.equipmentDropId,
    successScore: oe,
    battleWon: null,
    miningYield: 0,
    equipmentDropId: r.equipmentDropId,
    equipmentDropSeed: T,
    bestDropRarity: w,
    rareDiscoveryCount: 0,
    reward: ot(Ke())
  });
  const V = Object.keys(p.items).filter((Q) => !Cr(Q) && Q !== r.equipmentDropId && Q !== "material_mutation_trace");
  return V.length > 0 && O.push({
    reportId: `${e.expeditionId}:${t}:material`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: Y,
    kind: "MATERIAL",
    title: "Material cache secured",
    detail: V.join(", "),
    successScore: oe,
    battleWon: null,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: "RARE",
    rareDiscoveryCount: 0,
    reward: ot(Ke())
  }), p.rareDiscoveries.length > 0 && O.push({
    reportId: `${e.expeditionId}:${t}:discovery`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: Y,
    kind: "DISCOVERY",
    title: "Rare resonance detected",
    detail: p.rareDiscoveries.map((Q) => Q.speciesId).join(", "),
    successScore: oe,
    battleWon: null,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: p.rareDiscoveries[0]?.hintedRarity ?? null,
    rareDiscoveryCount: p.rareDiscoveries.length,
    reward: ot(Ke())
  }), ($ || x) && O.push({
    reportId: `${e.expeditionId}:${t}:event`,
    expeditionId: e.expeditionId,
    cycle: t,
    completedAt: q,
    offsetMs: Y,
    kind: "EVENT",
    title: x ? "Mutation trace recorded" : "Field event resolved",
    detail: x ? "The team archived an unstable geological signature." : "A local anomaly yielded bonus resources.",
    successScore: oe,
    battleWon: null,
    miningYield: 0,
    equipmentDropId: null,
    equipmentDropSeed: null,
    bestDropRarity: x ? "SSR" : null,
    rareDiscoveryCount: 0,
    reward: ot(Ke())
  }), {
    reward: p,
    events: O,
    summary: { battles: 1, wins: I ? 1 : 0, miningYield: m, rareDiscoveries: p.rareDiscoveries.length, equipmentDrops: M ? 1 : 0, bestDropRarity: Br(w, p.rareDiscoveries[0]?.hintedRarity ?? null) }
  };
}, $i = (e, t) => {
  e.reportEvents.push(...t), e.reportEvents.length > Yt && e.reportEvents.splice(0, e.reportEvents.length - Yt);
}, yc = (e, t) => {
  const n = t.getTime();
  if (!Number.isFinite(n)) throw new Error("Expedition clock returned an invalid date");
  let i = 0, r = !1;
  const s = [];
  for (const o of e.expeditions.order) {
    const a = e.expeditions.runs[o];
    if (!a || a.status !== "ACTIVE") continue;
    const c = Date.parse(a.nextCompletionAt), l = Date.parse(a.lastSimulatedAt);
    if (!Number.isFinite(c) || !Number.isFinite(l)) throw new Error("Expedition contains an invalid timestamp");
    if (n < l || n < c) continue;
    const d = Math.floor((n - c) / a.durationMs) + 1, f = Math.max(1, Math.floor(at / a.durationMs)), y = Math.min(ec, f), h = a.repeat ? Math.min(d, y) : 1, u = Math.min(h, Number.MAX_SAFE_INTEGER - a.completedCycles), I = a.repeat && d > u;
    if (r ||= I, a.completedCycles >= Number.MAX_SAFE_INTEGER) {
      r = !0, a.lastSimulatedAt = t.toISOString(), a.nextCompletionAt = new Date(n + a.durationMs).toISOString();
      continue;
    }
    let g = 0, b = !1;
    e: for (let R = 0; R < u; R += 128) {
      const m = Math.min(u, R + 128);
      for (let p = R; p < m; p += 1) {
        const S = a.completedCycles + 1, M = c + p * a.durationMs, w = An[a.regionId]?.requiredGuildLevel === 1 && e.inventory.currencies.researchCores === 0 && e.research.slot === null && e.research.completedProjectIds.length === 0 && !Object.values(e.expeditions.runs).some((x) => x.expeditionStorage.researchCores > 0), T = Sc(a, S, M, w);
        if (a.expeditionStorage.rareDiscoveries.length + T.reward.rareDiscoveries.length > yn) {
          b = !0, r = !0;
          break e;
        }
        oc(a.expeditionStorage, T.reward), $i(a, T.events), s.push(...T.events), s.length > Yt && s.splice(0, s.length - Yt), a.completedCycles = fe(a.completedCycles, 1, Number.MAX_SAFE_INTEGER), a.reportSummary.battles = fe(a.reportSummary.battles, T.summary.battles, Number.MAX_SAFE_INTEGER), a.reportSummary.wins = fe(a.reportSummary.wins, T.summary.wins, Number.MAX_SAFE_INTEGER), a.reportSummary.miningYield = fe(a.reportSummary.miningYield, T.summary.miningYield, Number.MAX_SAFE_INTEGER), a.reportSummary.rareDiscoveries = fe(a.reportSummary.rareDiscoveries, T.summary.rareDiscoveries, Number.MAX_SAFE_INTEGER), a.reportSummary.equipmentDrops = fe(a.reportSummary.equipmentDrops, T.summary.equipmentDrops, Number.MAX_SAFE_INTEGER), a.reportSummary.bestDropRarity = Br(a.reportSummary.bestDropRarity, T.summary.bestDropRarity), e.expeditions.totalCycles = fe(e.expeditions.totalCycles, 1, Number.MAX_SAFE_INTEGER), i += 1, g += 1;
      }
    }
    if (b ? (g > 0 && (a.lastSimulatedAt = new Date(c + (g - 1) * a.durationMs).toISOString()), a.nextCompletionAt = new Date(c + g * a.durationMs).toISOString()) : a.lastSimulatedAt = t.toISOString(), a.repeat && !b) a.nextCompletionAt = new Date(I ? n + a.durationMs : c + u * a.durationMs).toISOString();
    else {
      if (b) continue;
      a.status = "READY", $i(a, [{
        reportId: `${a.expeditionId}:return`,
        expeditionId: a.expeditionId,
        cycle: a.completedCycles,
        completedAt: new Date(c).toISOString(),
        offsetMs: Math.min(Number.MAX_SAFE_INTEGER, c - Date.parse(a.startedAt)),
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
        reward: ot(a.expeditionStorage)
      }]);
    }
  }
  return { cyclesProcessed: i, reports: s, capped: r };
}, Je = (e, t) => fe(e, t, Number.MAX_SAFE_INTEGER), Gr = (e, t, n) => {
  e.stones[t.instanceId] = t, Wt(e, t), jt.indexOf(t.rarity) >= jt.indexOf("SSR") && (e.statistics.rareDiscoveryCount = Je(e.statistics.rareDiscoveryCount, 1)), t.mutation !== "NONE" && (e.statistics.mutationCount = Je(e.statistics.mutationCount, 1)), mn(t.individualValues) && t.mutation !== "PERFECT" && (e.statistics.mutationCount = Je(e.statistics.mutationCount, 1)), _t(e, n);
}, Ac = (e, t, n = Z) => {
  const i = e.expeditions.runs[t];
  if (!i) throw new Error("Expedition not found");
  const r = i.completedCycles - i.claimedCycles;
  if (r <= 0) throw new Error("Expedition has no unclaimed completion");
  const s = ac(i.expeditionStorage), o = { accountId: e.account.accountId, username: e.account.username }, a = Math.max(0, e.inventory.capacity - Object.keys(e.stones).length), c = s.rareDiscoveries.slice(0, a), l = s.rareDiscoveries.slice(c.length), d = Math.max(0, kr - e.expeditions.discoveryStorage.length);
  if (l.length > d) throw new Error("Temporary Discovery Storage is full; free a Stone/storage slot before claiming");
  const f = l.map((u) => ({ ...u })), y = c.map((u) => {
    const I = re[u.speciesId];
    if (!I) throw new Error(`Unknown expedition species: ${u.speciesId}`);
    const g = { now: () => new Date(u.discoveredAt) }, b = Or(u.seed);
    return ft({
      species: I,
      origin: "EXPEDITION",
      owner: o,
      rng: new Ee(u.seed),
      clock: g,
      appraised: !0,
      ...b === null ? {} : { mutation: b }
    });
  });
  if (new Set(y.map((u) => u.instanceId)).size !== y.length || y.some((u) => e.stones[u.instanceId]))
    throw new Error("Expedition discovery ID collision");
  e.inventory.currencies.credits = Je(e.inventory.currencies.credits, s.credits), e.inventory.currencies.upgradeDust = Je(e.inventory.currencies.upgradeDust, s.upgradeDust), e.inventory.currencies.researchCores = Je(e.inventory.currencies.researchCores, s.researchCores);
  for (const [u, I] of Object.entries(s.items)) e.inventory.items[u] = Je(e.inventory.items[u] ?? 0, I);
  kt(e, Math.min(s.accountXp, Number.MAX_SAFE_INTEGER - e.accountProgress.xp));
  for (const u of i.partySnapshot) {
    const I = e.stones[u.stoneId];
    I && (ai(I, e.mastery, s.stoneXpPerMember), un(I, s.affinityPerMember));
  }
  for (const u of y)
    Gr(e, u, n);
  e.expeditions.discoveryStorage.push(...f), e.profile.totalAffinity = Object.values(e.stones).reduce((u, I) => Je(u, I.affinity.points), 0);
  const h = n.now();
  return i.claimedCycles = i.completedCycles, i.claimCount = fe(i.claimCount, 1, Number.MAX_SAFE_INTEGER), i.lastClaimedAt = h.toISOString(), i.expeditionStorage = Ke(), i.status === "READY" && (i.status = "CLAIMED"), e.expeditions.totalClaims = fe(e.expeditions.totalClaims, 1, Number.MAX_SAFE_INTEGER), { expeditionId: t, cyclesClaimed: r, reward: s, discoveredStones: y, storedDiscoveries: f, reports: i.reportEvents.map((u) => ({ ...u, reward: { ...u.reward, items: { ...u.reward.items } } })) };
}, wc = (e, t, n = Z) => {
  if (Object.keys(e.stones).length >= e.inventory.capacity) throw new Error("Stone capacity is full");
  const i = e.expeditions.discoveryStorage.findIndex((d) => d.discoveryId === t);
  if (i < 0) throw new Error("Stored expedition discovery not found");
  const r = e.expeditions.discoveryStorage[i], s = re[r.speciesId];
  if (!s) throw new Error(`Unknown expedition species: ${r.speciesId}`);
  const o = { accountId: e.account.accountId, username: e.account.username }, a = { now: () => new Date(r.discoveredAt) }, c = Or(r.seed), l = ft({
    species: s,
    origin: "EXPEDITION",
    owner: o,
    rng: new Ee(r.seed),
    clock: a,
    appraised: !0,
    ...c === null ? {} : { mutation: c }
  });
  if (e.stones[l.instanceId]) throw new Error("Expedition discovery ID collision");
  return Gr(e, l, n), e.expeditions.discoveryStorage.splice(i, 1), l;
}, At = (e, t) => {
  if (!Number.isSafeInteger(e) || e < 0) throw new Error(`${t} must be a non-negative safe integer`);
}, qr = (e, t) => {
  if (!Number.isSafeInteger(e) || e <= 0) throw new Error(`${t} must be a positive safe integer`);
}, Pi = (e) => {
  if (typeof e.id != "string" || e.id.length === 0) throw new Error("job.id must be a non-empty string");
  At(e.dueAtMs, "job.dueAtMs");
  const t = e.sequence ?? 0;
  if (At(t, "job.sequence"), e.repeatEveryMs !== void 0 && qr(e.repeatEveryMs, "job.repeatEveryMs"), e.endAtMs !== void 0) {
    if (At(e.endAtMs, "job.endAtMs"), e.repeatEveryMs === void 0) throw new Error("job.endAtMs requires repeatEveryMs");
    if (e.endAtMs < e.dueAtMs) throw new Error("job.endAtMs cannot precede job.dueAtMs");
  }
  return { ...e, sequence: t };
}, Cn = (e) => [...e].sort((t, n) => t.dueAtMs - n.dueAtMs || t.id.localeCompare(n.id));
class Ur {
  jobs = /* @__PURE__ */ new Map();
  constructor(t) {
    if (t && t.version !== 1) throw new Error("Unsupported scheduler snapshot");
    for (const n of t?.jobs ?? []) this.schedule(n);
  }
  schedule(t) {
    const n = Pi(t);
    if (this.jobs.has(n.id)) throw new Error(`Duplicate background job: ${n.id}`);
    this.jobs.set(n.id, n);
  }
  upsert(t) {
    const n = Pi(t);
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
    return Cn(this.jobs.values())[0]?.dueAtMs ?? null;
  }
  snapshot() {
    return { version: 1, jobs: Cn(this.jobs.values()).map((t) => ({ ...t })) };
  }
  drainDue(t, n, i = {}) {
    At(t, "nowMs");
    const r = i.maxCallbacks ?? 100, s = i.maxOccurrencesPerCallback ?? 96, o = i.maxCatchUpMs ?? zi.THIRTY_DAYS;
    At(r, "maxCallbacks"), qr(s, "maxOccurrencesPerCallback"), At(o, "maxCatchUpMs");
    let a = 0, c = 0, l = 0;
    for (; a < r; ) {
      const f = Cn(this.jobs.values()).find((w) => w.dueAtMs <= t);
      if (!f) break;
      const y = f.repeatEveryMs;
      if (y === void 0) {
        const w = {
          jobId: f.id,
          payload: f.payload,
          firstDueAtMs: f.dueAtMs,
          lastDueAtMs: f.dueAtMs,
          occurrences: 1,
          firstSequence: f.sequence ?? 0,
          lastSequence: f.sequence ?? 0,
          delayedByMs: t - f.dueAtMs
        };
        n(w), this.jobs.delete(f.id), a += 1, c += 1;
        continue;
      }
      let h = f.dueAtMs, u = f.sequence ?? 0;
      const I = Math.max(0, t - o);
      if (h < I) {
        const w = Math.ceil((I - h) / y);
        h += w * y, u += w, l += w;
      }
      if (f.endAtMs !== void 0 && h > f.endAtMs) {
        this.jobs.delete(f.id);
        continue;
      }
      const g = Math.min(t, f.endAtMs ?? t);
      if (h > g) {
        this.jobs.set(f.id, { ...f, dueAtMs: h, sequence: u });
        continue;
      }
      const b = Math.floor((g - h) / y) + 1, R = Math.min(b, s), m = h + (R - 1) * y, p = {
        jobId: f.id,
        payload: f.payload,
        firstDueAtMs: h,
        lastDueAtMs: m,
        occurrences: R,
        firstSequence: u,
        lastSequence: u + R - 1,
        delayedByMs: t - m
      };
      n(p), a += 1, c += R;
      const S = m + y, M = u + R;
      f.endAtMs !== void 0 && S > f.endAtMs ? this.jobs.delete(f.id) : this.jobs.set(f.id, { ...f, dueAtMs: S, sequence: M });
    }
    const d = this.nextDueAtMs();
    return {
      callbacks: a,
      deliveredOccurrences: c,
      skippedOccurrences: l,
      hasMoreDue: d !== null && d <= t,
      nextDueAtMs: d
    };
  }
}
const Ft = 3600 * 1e3, ui = at, vc = [
  {
    id: "GEOLOGY_SURVEY",
    name: "Geology Survey",
    durationMs: Ft,
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
    durationMs: 12 * Ft,
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
    durationMs: 24 * Ft,
    requiredLabLevel: 5,
    prerequisiteProjectId: "GENETIC_ARCHIVE",
    coreCost: 8,
    researchPoints: 520,
    rewardItems: { research_logistics_plan: 1 },
    facilityLevelTargets: { fusionLab: 6, researchLab: 7, expeditionGuild: 7 }
  }
], Hn = Object.fromEntries(vc.map((e) => [e.id, e])), ht = (e) => {
  const t = e.getTime();
  if (!Number.isSafeInteger(t) || t < 0) throw new Error("Background activity received an invalid timestamp");
  return t;
}, mt = (e, t) => Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(e)) + Math.max(0, Math.floor(t))), Hr = (e, t) => {
  const n = Date.parse(e), i = ht(t);
  return !Number.isFinite(n) || i <= n ? 0 : Math.min(ui, i - n);
}, Mc = (e, t) => Object.values(e.expeditions.runs).some((n) => n.status !== "CLAIMED" && n.partySnapshot.some((i) => i.stoneId === t)), Rc = (e, t) => (e.endlessMine.status === "RUNNING" || e.endlessMine.status === "PAUSED") && e.endlessMine.partyStoneIds.includes(t), Tc = (e, t) => !!(e.activeBattle && !e.activeBattle.winner && e.activeBattle.units.some((n) => n.team === "PLAYER" && n.stoneId === t)), Yr = (e, t, n) => {
  if (!e.stones[t]) throw new Error(`Stone not found: ${t}`);
  if (Mc(e, t)) throw new Error("A stone on expedition cannot use a background facility");
  if (Rc(e, t)) throw new Error("A stone in Endless Mine cannot use a background facility");
  if (Tc(e, t)) throw new Error("A stone in an active battle cannot use a background facility");
  if (n !== "training" && e.training.assignment?.stoneId === t) throw new Error("Stone is already training");
  if (n !== "garden" && e.affinityGarden.assignment?.stoneId === t) throw new Error("Stone is already in the affinity garden");
}, cn = (e) => {
  const t = e.training.assignment;
  return t ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(t.bankedMs * t.xpPerHour / Ft)) : 0;
}, ln = (e) => {
  const t = e.affinityGarden.assignment;
  return t ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(t.bankedMs * t.affinityPerHour / Ft)) : 0;
}, bc = (e, t, n) => {
  if (e.training.assignment) throw new Error("Training Chamber is occupied");
  Yr(e, t, "training");
  const i = new Date(ht(n)).toISOString();
  e.training.assignment = {
    stoneId: t,
    assignedAt: i,
    lastProcessedAt: i,
    xpPerHour: Math.min(1e4, 80 + e.facilities.researchLab * 40),
    bankedMs: 0,
    totalClaimedXp: 0
  };
}, jr = (e, t) => {
  const n = e.training.assignment;
  n && (n.bankedMs = Math.min(ui, mt(n.bankedMs, Hr(n.lastProcessedAt, t))), ht(t) >= Date.parse(n.lastProcessedAt) && (n.lastProcessedAt = t.toISOString()));
}, Nc = (e, t) => {
  jr(e, t);
  const n = e.training.assignment;
  if (!n) throw new Error("Training Chamber is empty");
  const i = cn(e);
  if (i <= 0) throw new Error("No Training Chamber XP is ready");
  const r = e.stones[n.stoneId];
  if (!r) throw new Error("Training stone is missing");
  return ai(r, e.mastery, i), n.bankedMs = 0, n.totalClaimedXp = mt(n.totalClaimedXp, i), i;
}, kc = (e) => {
  if (e.training.assignment) {
    if (cn(e) > 0) throw new Error("Claim Training Chamber XP before removing the stone");
    e.training.assignment = null;
  }
}, _c = (e, t, n) => {
  if (e.affinityGarden.assignment) throw new Error("Affinity Garden is occupied");
  Yr(e, t, "garden");
  const i = new Date(ht(n)).toISOString();
  e.affinityGarden.assignment = {
    stoneId: t,
    assignedAt: i,
    lastProcessedAt: i,
    affinityPerHour: Math.min(100, 1 + Math.floor(e.accountProgress.level / 10) + Math.floor(e.facilities.researchLab / 3)),
    bankedMs: 0,
    totalClaimedAffinity: 0
  };
}, Vr = (e, t) => {
  const n = e.affinityGarden.assignment;
  n && (n.bankedMs = Math.min(ui, mt(n.bankedMs, Hr(n.lastProcessedAt, t))), ht(t) >= Date.parse(n.lastProcessedAt) && (n.lastProcessedAt = t.toISOString()));
}, Cc = (e, t) => {
  Vr(e, t);
  const n = e.affinityGarden.assignment;
  if (!n) throw new Error("Affinity Garden is empty");
  const i = ln(e);
  if (i <= 0) throw new Error("No Affinity Garden reward is ready");
  const r = e.stones[n.stoneId];
  if (!r) throw new Error("Affinity Garden stone is missing");
  return un(r, i), n.bankedMs = 0, n.totalClaimedAffinity = mt(n.totalClaimedAffinity, i), e.profile.totalAffinity = Object.values(e.stones).reduce((s, o) => mt(s, o.affinity.points), 0), i;
}, xc = (e) => {
  if (e.affinityGarden.assignment) {
    if (ln(e) > 0) throw new Error("Claim Affinity Garden rewards before removing the stone");
    e.affinityGarden.assignment = null;
  }
}, Lc = (e, t, n, i = Z) => {
  const r = Hn[t];
  if (!r) throw new Error(`Unknown research project: ${t}`);
  if (e.research.slot && e.research.slot.status !== "CLAIMED") throw new Error("Research slot is occupied");
  if (e.research.completedProjectIds.includes(t)) throw new Error("Research project is already complete");
  if (r.prerequisiteProjectId && !e.research.completedProjectIds.includes(r.prerequisiteProjectId))
    throw new Error(`${Hn[r.prerequisiteProjectId].name} must be completed first`);
  if (e.facilities.researchLab < r.requiredLabLevel) throw new Error(`Research Lab level ${r.requiredLabLevel} required`);
  bt(e, { currencies: { researchCores: r.coreCost } });
  const s = i.now(), o = ht(s), a = Ge("research", n, o), c = {
    researchId: a,
    projectId: t,
    seed: `${a}:${Math.floor(n.next() * 4294967296).toString(16)}`,
    startedAt: s.toISOString(),
    completesAt: new Date(o + r.durationMs).toISOString(),
    status: "ACTIVE",
    claimedAt: null
  };
  return e.research.slot = c, c;
}, Xr = (e, t) => {
  const n = e.research.slot;
  return !n || n.status !== "ACTIVE" || ht(t) < Date.parse(n.completesAt) ? !1 : (n.status = "READY", !0);
}, Dc = (e, t, n) => {
  if (e.research.claimLedger[t]) throw new Error("Research reward was already claimed");
  Xr(e, n);
  const i = e.research.slot;
  if (!i || i.researchId !== t) throw new Error("Research slot not found");
  if (i.status !== "READY") throw new Error("Research is not complete");
  const r = Hn[i.projectId];
  e.accountProgress.researchPoints = mt(e.accountProgress.researchPoints, r.researchPoints);
  for (const [s, o] of Object.entries(r.rewardItems)) e.inventory.items[s] = mt(e.inventory.items[s] ?? 0, o);
  for (const s of ["fusionLab", "researchLab", "expeditionGuild"])
    e.facilities[s] = Math.max(e.facilities[s], r.facilityLevelTargets[s]);
  return e.research.completedProjectIds.includes(r.id) || e.research.completedProjectIds.push(r.id), e.research.claimLedger[t] = !0, i.status = "CLAIMED", i.claimedAt = n.toISOString(), e.research.slot = null, { projectId: r.id, researchPoints: r.researchPoints, items: { ...r.rewardItems } };
}, Fi = 900 * 1e3, Oc = 64, $c = 16, It = (e, t) => {
  const n = Date.parse(e);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${t} is not a valid timestamp`);
  return n;
}, Pc = (e) => {
  const t = e.getTime();
  if (!Number.isSafeInteger(t) || t < 0) throw new Error("Idle anchor is invalid");
  return {
    timeCheckpoint: Ji(t),
    scheduler: { version: 1, jobs: [] },
    lastProcessedAt: e.toISOString(),
    lastActiveAt: e.toISOString(),
    lastWelcomeBack: null
  };
}, Fc = (e) => {
  const t = [];
  for (const n of Object.values(e.expeditions.runs))
    n.status === "ACTIVE" && n.expeditionStorage.rareDiscoveries.length < yn && t.push({
      id: `expedition:${n.expeditionId}`,
      dueAtMs: It(n.nextCompletionAt, "expedition.nextCompletionAt"),
      payload: { kind: "EXPEDITION", expeditionId: n.expeditionId }
    });
  return e.training.assignment && t.push({
    id: `training:${e.training.assignment.stoneId}`,
    dueAtMs: It(e.training.assignment.lastProcessedAt, "training.lastProcessedAt") + Fi,
    payload: { kind: "TRAINING", stoneId: e.training.assignment.stoneId }
  }), e.affinityGarden.assignment && t.push({
    id: `affinity-garden:${e.affinityGarden.assignment.stoneId}`,
    dueAtMs: It(e.affinityGarden.assignment.lastProcessedAt, "affinityGarden.lastProcessedAt") + Fi,
    payload: { kind: "AFFINITY_GARDEN", stoneId: e.affinityGarden.assignment.stoneId }
  }), e.research.slot?.status === "ACTIVE" && t.push({
    id: `research:${e.research.slot.researchId}`,
    dueAtMs: It(e.research.slot.completesAt, "research.completesAt"),
    payload: { kind: "RESEARCH", researchId: e.research.slot.researchId }
  }), e.endlessMine.status === "RUNNING" && e.endlessMine.runId && e.endlessMine.nextFloorAt && !e.endlessMine.manualMode && t.push({
    id: `endless-mine:${e.endlessMine.runId}`,
    dueAtMs: It(e.endlessMine.nextFloorAt, "endlessMine.nextFloorAt"),
    payload: { kind: "ENDLESS_MINE", runId: e.endlessMine.runId }
  }), t;
}, _e = (e) => {
  const t = new Ur(e.idle.scheduler), n = /* @__PURE__ */ new Set();
  for (const r of Fc(e))
    n.add(r.id), t.upsert(r);
  for (const r of t.snapshot().jobs) n.has(r.id) || t.cancel(r.id);
  const i = t.snapshot();
  return e.idle.scheduler = { version: 1, jobs: i.jobs.map((r) => ({ ...r })) }, t.nextDueAtMs();
}, Zt = (e, t, n = {}) => {
  const i = n.mode ?? "OFFLINE", r = t.now().getTime(), s = bs(e.idle.timeCheckpoint, r, { maxForwardAdvanceMs: at });
  e.idle.timeCheckpoint = { ...s.checkpoint };
  const o = new Date(s.nowMs), a = It(e.idle.lastProcessedAt, "idle.lastProcessedAt"), c = Math.max(0, Math.min(at, s.nowMs - a));
  _e(e);
  const l = new Ur(e.idle.scheduler);
  let d = 0, f = 0, y = 0, h = 0, u = 0, I = 0;
  const g = cn(e), b = ln(e);
  let R = s.anomaly === "forward-capped";
  const m = l.drainDue(s.nowMs, (q) => {
    switch (q.payload.kind) {
      case "EXPEDITION": {
        const Y = yc(e, o);
        d += Y.cyclesProcessed, I += Y.reports.reduce((oe, O) => oe + O.rareDiscoveryCount, 0), R ||= Y.capped;
        break;
      }
      case "TRAINING":
        jr(e, o);
        break;
      case "AFFINITY_GARDEN":
        Vr(e, o);
        break;
      case "RESEARCH":
        Xr(e, o);
        break;
      case "ENDLESS_MINE": {
        if (e.endlessMine.runId !== q.payload.runId || n.skipEndless) break;
        const Y = Date.parse(e.endlessMine.nextFloorAt ?? ""), oe = Number.isFinite(Y) && s.nowMs >= Y ? Math.floor((s.nowMs - Y) / Re) + 1 : 0, O = i === "ACTIVE" ? Ar(e.endlessMine, Math.min($c, oe), o) : Lo(e.endlessMine, o);
        f += O.clearedFloors, y += O.credits, h += O.equipmentAdded, u += O.equipmentSalvaged;
        break;
      }
    }
  }, { maxCallbacks: Oc, maxOccurrencesPerCallback: 128, maxCatchUpMs: at });
  if (R ||= m.hasMoreDue || m.skippedOccurrences > 0, e.idle.scheduler = { version: 1, jobs: l.snapshot().jobs.map((q) => ({ ...q })) }, e.idle.lastProcessedAt = o.toISOString(), e.idle.lastActiveAt = o.toISOString(), _e(e), i === "ACTIVE") return null;
  const p = s.anomaly === "rollback" ? null : e.idle.lastWelcomeBack, S = Math.max(0, cn(e) - g), M = Math.max(0, ln(e) - b);
  if (!(c >= 6e4 || s.anomaly !== "none" || d > 0 || f > 0 || h > 0 || u > 0 || I > 0)) return null;
  const T = p?.from ?? new Date(a).toISOString(), x = o.toISOString(), $ = (p?.elapsedMs ?? 0) + c, F = {
    summaryId: `welcome:${a}:${s.nowMs}:${e.idle.timeCheckpoint.reconciliationCount}`,
    from: T,
    to: x,
    elapsedMs: Math.min(at, $),
    capped: R || $ > at || !!p?.capped,
    rollbackDetected: s.anomaly === "rollback" || !!p?.rollbackDetected,
    expeditionCycles: (p?.expeditionCycles ?? 0) + d,
    trainingXpReady: (p?.trainingXpReady ?? 0) + S,
    affinityReady: (p?.affinityReady ?? 0) + M,
    researchReady: e.research.slot?.status === "READY",
    endlessFloors: (p?.endlessFloors ?? 0) + f,
    endlessCredits: (p?.endlessCredits ?? 0) + y,
    equipmentAdded: (p?.equipmentAdded ?? 0) + h,
    equipmentSalvaged: (p?.equipmentSalvaged ?? 0) + u,
    rareDiscoveries: (p?.rareDiscoveries ?? 0) + I,
    createdAt: x
  };
  return e.idle.lastWelcomeBack = F, F;
}, St = "stoneverse.save.v5", Dt = "stoneverse.save.v5.backup", Ot = "stoneverse.save.v5.pending", Bc = ["stoneverse.save.v4", "stoneverse.save.v4.pending", "stoneverse.save.v4.backup", "stoneverse.save.v3"], Gc = () => {
  try {
    return typeof window < "u" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}, z = (e) => !!e && typeof e == "object" && !Array.isArray(e), _ = (e, t) => {
  throw new Error(`Invalid save at ${e}: ${t}`);
}, D = (e, t) => z(e) ? e : _(t, "expected an object"), en = (e, t, n) => {
  const i = new Set(t), r = Object.keys(e).find((s) => !i.has(s));
  r !== void 0 && _(`${n}.${r}`, "unexpected field");
}, C = (e, t, n = {}) => {
  if (e === null && n.nullable) return null;
  if (typeof e != "string") return _(t, "expected a string");
  const i = n.min ?? 0, r = n.max ?? 1e4;
  return e.length < i || e.length > r ? _(t, `expected length ${i}-${r}`) : e;
}, ce = (e, t) => typeof e != "boolean" ? _(t, "expected a boolean") : e, N = (e, t, n = {}) => typeof e != "number" || !Number.isFinite(e) ? _(t, "expected a finite number") : n.integer && !Number.isSafeInteger(e) ? _(t, "expected a safe integer") : n.min !== void 0 && e < n.min ? _(t, `expected >= ${n.min}`) : n.max !== void 0 && e > n.max ? _(t, `expected <= ${n.max}`) : e, B = (e, t, n) => typeof e != "string" || !t.includes(e) ? _(n, `expected one of ${t.join(", ")}`) : e, te = (e, t, n = 1e5) => Array.isArray(e) ? e.length > n ? _(t, `array exceeds ${n} entries`) : e : _(t, "expected an array"), X = (e, t, n = !1) => {
  if (e === null && n) return null;
  const i = C(e, t, { min: 1, max: 64 });
  return (i === null || !Number.isFinite(Date.parse(i))) && _(t, "expected a valid timestamp"), i;
}, se = (e, t, n = {}) => {
  const i = te(e, t, n.max ?? 1e5).map((r, s) => C(r, `${t}[${s}]`, { min: 1, max: 256 }));
  return n.unique && new Set(i).size !== i.length && _(t, "duplicate entries are not allowed"), i;
}, mi = (e, t, n = !1) => {
  const i = D(e, t);
  for (const r of [...ke, "maxHp"]) N(i[r], `${t}.${r}`, { min: n ? 0 : 1, max: 1e9 });
}, pt = (e, t) => {
  const n = D(e, t);
  for (const [i, r] of Object.entries(n))
    (!i || i.length > 256) && _(t, "contains an invalid key"), N(r, `${t}.${i}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
}, Yn = (e, t) => {
  const n = D(e, t);
  C(n.instanceId, `${t}.instanceId`, { min: 1, max: 256 }), C(n.definitionId, `${t}.definitionId`, { min: 1, max: 256 }), B(n.slot, ["CORE", "RUNE", "RELIC", "CHARM"], `${t}.slot`), N(n.level, `${t}.level`, { min: 1, max: 1e4, integer: !0 }), B(n.rarity, Be, `${t}.rarity`), n.setId !== void 0 && n.setId !== null && B(n.setId, ["BASTION", "RESONANCE", "HUNTER", "ABYSSAL"], `${t}.setId`), ce(n.locked, `${t}.locked`), te(n.affixes, `${t}.affixes`, 32).forEach((i, r) => {
    const s = D(i, `${t}.affixes[${r}]`);
    B(s.stat, [...ke, "maxHp"], `${t}.affixes[${r}].stat`), B(s.operation, ["FLAT", "PERCENT"], `${t}.affixes[${r}].operation`), N(s.value, `${t}.affixes[${r}].value`, { min: -1e6, max: 1e6 }), s.sourceStat !== void 0 && B(s.sourceStat, ["maxHp", "attack", "defense", "speed", "accuracy", "resistance", "critChance", "critDamage", "breakPower"], `${t}.affixes[${r}].sourceStat`);
  });
}, xn = (e, t) => {
  const n = D(e, t);
  C(n.accountId, `${t}.accountId`, { min: 1, max: 128 }), C(n.username, `${t}.username`, { min: 1, max: 64 });
}, jn = (e, t) => {
  const n = D(e, t);
  C(n.instanceId, `${t}.instanceId`, { min: 1, max: 256 }), C(n.speciesId, `${t}.speciesId`, { min: 1, max: 256 }), C(n.serialNumber, `${t}.serialNumber`, { min: 1, max: 256 }), C(n.nickname, `${t}.nickname`, { nullable: !0, max: 20 }), B(n.mutation, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `${t}.mutation`), B(n.colorVariant, ["STANDARD", "SHINY", "AURORA", "OBSIDIAN"], `${t}.colorVariant`), se(n.traitIds, `${t}.traitIds`, { max: 8, unique: !0 });
}, qc = (e, t, n) => {
  const i = D(e, n);
  C(i.instanceId, `${n}.instanceId`, { min: 1, max: 256 }) !== t && _(n, "map key must equal instanceId"), C(i.serialNumber, `${n}.serialNumber`, { min: 1, max: 256 }), C(i.speciesId, `${n}.speciesId`, { min: 1, max: 256 }), C(i.name, `${n}.name`, { min: 1, max: 128 }), C(i.nickname, `${n}.nickname`, { nullable: !0, max: 20 }), B(i.rarity, Be, `${n}.rarity`), B(i.origin, Sa, `${n}.origin`), N(i.level, `${n}.level`, { min: 1, max: 120, integer: !0 }), N(i.xp, `${n}.xp`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), N(i.potential, `${n}.potential`, { min: 0, max: 100, integer: !0 }), C(i.personalityId, `${n}.personalityId`, { min: 1, max: 256 }), B(i.primaryElement, Ht, `${n}.primaryElement`), i.secondaryElement !== null && B(i.secondaryElement, Ht, `${n}.secondaryElement`), mi(i.stats, `${n}.stats`);
  const s = D(i.individualValues, `${n}.individualValues`);
  for (const f of ke) N(s[f], `${n}.individualValues.${f}`, { min: 0, max: 31, integer: !0 });
  se(i.traitIds, `${n}.traitIds`, { max: 8, unique: !0 }), te(i.skills, `${n}.skills`, 6).forEach((f, y) => {
    const h = D(f, `${n}.skills[${y}]`);
    C(h.skillId, `${n}.skills[${y}].skillId`, { min: 1, max: 256 }), N(h.level, `${n}.skills[${y}].level`, { min: 1, max: 100, integer: !0 }), B(h.source, ["NATURAL", "LEVEL", "AWAKENING", "FUSION", "EQUIPMENT", "TREE"], `${n}.skills[${y}].source`);
  }), N(i.skillPoints, `${n}.skillPoints`, { min: 0, max: 1e6, integer: !0 }), se(i.learnedSkillNodes, `${n}.learnedSkillNodes`, { max: 1e3, unique: !0 });
  const o = D(i.equipment, `${n}.equipment`);
  for (const [f, y] of Object.entries(o))
    B(f, ["CORE", "RUNE", "RELIC", "CHARM"], `${n}.equipment slot`), Yn(y, `${n}.equipment.${f}`), y.slot !== f && _(`${n}.equipment.${f}`, "equipment slot mismatch");
  const a = D(i.affinity, `${n}.affinity`);
  N(a.points, `${n}.affinity.points`, { min: 0, max: 9999, integer: !0 }), N(a.rank, `${n}.affinity.rank`, { min: 0, max: 7, integer: !0 }), te(a.claimedMilestones, `${n}.affinity.claimedMilestones`, 32).forEach((f, y) => N(f, `${n}.affinity.claimedMilestones[${y}]`, { min: 0, max: 100, integer: !0 })), N(i.awakeningStage, `${n}.awakeningStage`, { min: 0, max: 10, integer: !0 }), N(i.evolutionStage, `${n}.evolutionStage`, { min: 0, max: 100, integer: !0 }), N(i.reincarnationCount, `${n}.reincarnationCount`, { min: 0, max: 1e3, integer: !0 }), N(i.limitBreak, `${n}.limitBreak`, { min: 0, max: 5, integer: !0 }), B(i.mutation, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `${n}.mutation`), B(i.colorVariant, ["STANDARD", "SHINY", "AURORA", "OBSIDIAN"], `${n}.colorVariant`), te(i.parents, `${n}.parents`, 4).forEach((f, y) => jn(f, `${n}.parents[${y}]`)), te(i.grandparents, `${n}.grandparents`, 8).forEach((f, y) => jn(f, `${n}.grandparents[${y}]`)), N(i.generation, `${n}.generation`, { min: 0, max: 1e5, integer: !0 }), xn(i.originalOwner, `${n}.originalOwner`), xn(i.currentOwner, `${n}.currentOwner`), xn(i.discoverer, `${n}.discoverer`), X(i.createdAt, `${n}.createdAt`), X(i.firstObtainedAt, `${n}.firstObtainedAt`), X(i.appraisedAt, `${n}.appraisedAt`, !0);
  const c = D(i.battleStatistics, `${n}.battleStatistics`);
  for (const f of ["battles", "wins", "losses", "damageDealt", "damageTaken", "healingDone", "criticalHits", "enemiesDefeated", "ultimatesUsed"])
    N(c[f], `${n}.battleStatistics.${f}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  ce(i.favorite, `${n}.favorite`), ce(i.locked, `${n}.locked`), se(i.tags, `${n}.tags`, { max: 100, unique: !0 });
  const l = i, d = vs(l);
  return d.length > 0 && _(n, d.join(", ")), l;
}, Uc = (e, t) => {
  const n = D(e, t);
  n.currencies !== void 0 && pt(n.currencies, `${t}.currencies`), n.items !== void 0 && pt(n.items, `${t}.items`);
  for (const i of ["accountXp", "miningXp", "stoneXp"]) n[i] !== void 0 && N(n[i], `${t}.${i}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
}, Hc = (e, t) => {
  const n = D(e, t);
  for (const [i, r] of Object.entries(n))
    B(i, [...ke, "maxHp"], `${t} key`), N(r, `${t}.${i}`, { min: -1e9, max: 1e9 });
}, Wr = (e, t) => {
  const n = D(e, t), i = C(n.discoveryId, `${t}.discoveryId`, { min: 1, max: 256 });
  C(n.seed, `${t}.seed`, { min: 1, max: 1024 });
  const r = C(n.speciesId, `${t}.speciesId`, { min: 1, max: 256 });
  return re[r] || _(`${t}.speciesId`, "references an unknown species"), C(n.veinId, `${t}.veinId`, { min: 1, max: 256 }), C(n.areaId, `${t}.areaId`, { min: 1, max: 256 }), B(n.hintedRarity, Be, `${t}.hintedRarity`), C(n.sourceEventId, `${t}.sourceEventId`, { min: 1, max: 256 }), X(n.discoveredAt, `${t}.discoveredAt`), i;
}, Yc = (e, t) => {
  const n = D(e, t);
  for (const r of ["credits", "upgradeDust", "researchCores", "accountXp", "stoneXpPerMember", "affinityPerMember"])
    N(n[r], `${t}.${r}`, { min: 0, max: 1e9, integer: !0 });
  pt(n.items, `${t}.items`);
  const i = /* @__PURE__ */ new Set();
  te(n.rareDiscoveries, `${t}.rareDiscoveries`, yn).forEach((r, s) => {
    const o = Wr(r, `${t}.rareDiscoveries[${s}]`);
    i.has(o) && _(`${t}.rareDiscoveries[${s}].discoveryId`, "duplicate discovery ID"), i.add(o);
  });
}, jc = (e, t, n) => {
  const i = D(e, t);
  C(i.reportId, `${t}.reportId`, { min: 1, max: 512 }), C(i.expeditionId, `${t}.expeditionId`, { min: 1, max: 256 }) !== n && _(`${t}.expeditionId`, "does not match its expedition"), N(i.cycle, `${t}.cycle`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), X(i.completedAt, `${t}.completedAt`), N(i.offsetMs, `${t}.offsetMs`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), B(i.kind, ["DEPARTURE", "BATTLE", "MINING", "MATERIAL", "EQUIPMENT", "DISCOVERY", "EVENT", "BOSS", "RETURN"], `${t}.kind`), C(i.title, `${t}.title`, { min: 1, max: 256 }), C(i.detail, `${t}.detail`, { max: 2048 }), N(i.successScore, `${t}.successScore`, { min: 0, max: 1e3 }), i.battleWon !== null && ce(i.battleWon, `${t}.battleWon`), N(i.miningYield, `${t}.miningYield`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), C(i.equipmentDropId, `${t}.equipmentDropId`, { nullable: !0, max: 256 }), C(i.equipmentDropSeed, `${t}.equipmentDropSeed`, { nullable: !0, max: 1024 }), i.bestDropRarity !== null && B(i.bestDropRarity, Be, `${t}.bestDropRarity`), N(i.rareDiscoveryCount, `${t}.rareDiscoveryCount`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const r = D(i.reward, `${t}.reward`);
  for (const s of ["credits", "upgradeDust", "researchCores", "accountXp", "stoneXpPerMember", "affinityPerMember"]) N(r[s], `${t}.reward.${s}`, { min: 0, max: 1e9, integer: !0 });
  pt(r.items, `${t}.reward.items`);
}, Bi = (e, t, n, i) => {
  const r = D(e, t);
  C(r.battleId, `${t}.battleId`, { min: 1, max: 256 }), B(r.mode, ["DUNGEON", "INFINITE_MINE", "PVP", "RAID", "SIMULATION"], `${t}.mode`), r.dungeonId !== void 0 && C(r.dungeonId, `${t}.dungeonId`, { min: 1, max: 256 }), r.stageId !== void 0 && C(r.stageId, `${t}.stageId`, { min: 1, max: 256 });
  const s = N(r.turn, `${t}.turn`, { min: 0, max: 100, integer: !0 }), o = te(r.units, `${t}.units`, 32);
  o.length === 0 && _(`${t}.units`, "battle must contain units");
  const a = /* @__PURE__ */ new Set();
  let c = !1, l = !1, d = !1, f = !1;
  if (o.forEach((y, h) => {
    const u = `${t}.units[${h}]`, I = D(y, u), g = C(I.unitId, `${u}.unitId`, { min: 1, max: 256 });
    a.has(g) && _(`${u}.unitId`, "duplicate unitId"), a.add(g);
    const b = C(I.stoneId, `${u}.stoneId`, { min: 1, max: 256 }), R = B(I.team, ["PLAYER", "ENEMY"], `${u}.team`);
    c ||= R === "PLAYER", l ||= R === "ENEMY", i.active && R === "PLAYER" && !n.has(b) && _(`${u}.stoneId`, "active player unit references a missing stone"), C(I.speciesId, `${u}.speciesId`, { min: 1, max: 256 }), C(I.name, `${u}.name`, { min: 1, max: 128 }), B(I.element, Ht, `${u}.element`), B(I.role, ["ATTACK", "TANK", "SUPPORT", "CONTROL"], `${u}.role`), N(I.level, `${u}.level`, { min: 1, max: 120, integer: !0 }), mi(I.stats, `${u}.stats`);
    const m = N(I.stats.maxHp, `${u}.stats.maxHp`, { min: 1, max: 1e9 }), p = N(I.currentHp, `${u}.currentHp`, { min: 0, max: m });
    N(I.shield, `${u}.shield`, { min: 0, max: 1e9 }), N(I.ultimate, `${u}.ultimate`, { min: 0, max: 100 }), pt(I.cooldowns, `${u}.cooldowns`), se(I.skillIds, `${u}.skillIds`, { max: 6, unique: !0 }), se(I.traitIds, `${u}.traitIds`, { max: 8, unique: !0 });
    const S = ce(I.alive, `${u}.alive`);
    S !== p > 0 && _(`${u}.alive`, "must agree with currentHp"), d ||= R === "PLAYER" && S, f ||= R === "ENEMY" && S, te(I.statuses, `${u}.statuses`, 32).forEach((M, w) => {
      const T = D(M, `${u}.statuses[${w}]`);
      B(T.id, ["BURN", "POISON", "STUN", "FRACTURE", "REGEN", "TAUNT"], `${u}.statuses[${w}].id`), N(T.turns, `${u}.statuses[${w}].turns`, { min: 1, max: 100, integer: !0 }), N(T.potency, `${u}.statuses[${w}].potency`, { min: 0, max: 10 }), C(T.sourceId, `${u}.statuses[${w}].sourceId`, { min: 1, max: 256 });
    }), te(I.modifiers, `${u}.modifiers`, 64).forEach((M, w) => {
      const T = D(M, `${u}.modifiers[${w}]`);
      B(T.stat, [...ke, "maxHp"], `${u}.modifiers[${w}].stat`), N(T.multiplier, `${u}.modifiers[${w}].multiplier`, { min: 0.01, max: 100 }), N(T.turns, `${u}.modifiers[${w}].turns`, { min: 1, max: 100, integer: !0 }), C(T.sourceId, `${u}.modifiers[${w}].sourceId`, { min: 1, max: 256 });
    });
  }), (!c || !l) && _(`${t}.units`, "battle requires both player and enemy teams"), te(r.actionLog, `${t}.actionLog`, 1e5).forEach((y, h) => {
    const u = `${t}.actionLog[${h}]`, I = D(y, u);
    N(I.turn, `${u}.turn`, { min: 1, max: 100, integer: !0 });
    const g = C(I.actorId, `${u}.actorId`, { min: 1, max: 256 });
    a.has(g) || _(`${u}.actorId`, "references an unknown unit"), C(I.skillId, `${u}.skillId`, { min: 1, max: 256 });
    for (const b of se(I.targetIds, `${u}.targetIds`, { max: 32 })) a.has(b) || _(`${u}.targetIds`, "references an unknown unit");
    N(I.damage, `${u}.damage`, { min: 0, max: Number.MAX_SAFE_INTEGER }), N(I.healing, `${u}.healing`, { min: 0, max: Number.MAX_SAFE_INTEGER }), ce(I.critical, `${u}.critical`), se(I.statusesApplied, `${u}.statusesApplied`, { max: 32 });
    for (const b of se(I.defeatedIds, `${u}.defeatedIds`, { max: 32 })) a.has(b) || _(`${u}.defeatedIds`, "references an unknown unit");
    for (const b of ["damageByTarget", "healingByTarget"]) {
      if (I[b] === void 0) continue;
      const R = D(I[b], `${u}.${b}`);
      for (const [m, p] of Object.entries(R))
        a.has(m) || _(`${u}.${b}`, "references an unknown unit"), N(p, `${u}.${b}.${m}`, { min: 0, max: Number.MAX_SAFE_INTEGER });
    }
  }), r.winner !== null && B(r.winner, ["PLAYER", "ENEMY", "DRAW"], `${t}.winner`), r.reward !== null && Uc(r.reward, `${t}.reward`), r.advanced !== void 0) {
    const y = ks(r.advanced);
    y.turn !== s && _(`${t}.advanced.turn`, "must match projected battle turn"), y.outcome !== r.winner && _(`${t}.advanced.outcome`, "must match projected battle winner");
    for (const h of y.units) a.has(h.id) || _(`${t}.advanced.units`, "contains an unprojected combatant");
  }
  if (r.controlMode !== void 0 && B(r.controlMode, ["MANUAL", "AUTO"], `${t}.controlMode`), r.speed !== void 0) {
    const y = N(r.speed, `${t}.speed`, { integer: !0 });
    [1, 2, 4].includes(y) || _(`${t}.speed`, "expected one of 1, 2, 4");
  }
  return X(r.startedAt, `${t}.startedAt`), r.winner === null ? (r.finishedAt !== null && _(`${t}.finishedAt`, "unfinished battle must not have a finish timestamp"), (!d || !f) && _(`${t}.winner`, "unfinished battle must have living units on both teams")) : (X(r.finishedAt, `${t}.finishedAt`), r.winner === "PLAYER" && (!d || f) && _(`${t}.winner`, "PLAYER result disagrees with living teams"), r.winner === "ENEMY" && (!f || d) && _(`${t}.winner`, "ENEMY result disagrees with living teams"), r.winner === "DRAW" && d && f && s < 100 && _(`${t}.winner`, "living-team DRAW requires the turn limit")), !i.active && r.winner === null && _(`${t}.winner`, "battle history cannot contain an unfinished battle"), r;
}, Vc = (e) => {
  const t = z(e.account) ? e.account : {}, n = Pn({
    username: typeof t.username == "string" ? t.username : void 0,
    accountId: typeof t.accountId == "string" ? t.accountId : void 0,
    withStarter: !1,
    seed: "migration-defaults"
  }), i = (s, o) => ({ ...s, ...z(o) ? o : {} });
  return {
    ...n,
    ...e,
    account: i(n.account, e.account),
    accountProgress: i(n.accountProgress, e.accountProgress),
    mining: i(n.mining, e.mining),
    facilities: i(n.facilities, e.facilities),
    expeditions: i(n.expeditions, e.expeditions),
    training: i(n.training, e.training),
    affinityGarden: i(n.affinityGarden, e.affinityGarden),
    research: i(n.research, e.research),
    idle: {
      ...n.idle,
      ...z(e.idle) ? e.idle : {},
      timeCheckpoint: i(n.idle.timeCheckpoint, z(e.idle) ? e.idle.timeCheckpoint : void 0),
      scheduler: i(n.idle.scheduler, z(e.idle) ? e.idle.scheduler : void 0)
    },
    endlessMine: e.endlessMine === void 0 ? n.endlessMine : e.endlessMine,
    mastery: e.mastery === void 0 ? n.mastery : e.mastery,
    inventory: {
      ...n.inventory,
      ...z(e.inventory) ? e.inventory : {},
      currencies: i(n.inventory.currencies, z(e.inventory) ? e.inventory.currencies : void 0),
      items: i(n.inventory.items, z(e.inventory) ? e.inventory.items : void 0),
      equipment: i(n.inventory.equipment, z(e.inventory) ? e.inventory.equipment : void 0)
    },
    collection: i(n.collection, e.collection),
    gacha: i(n.gacha, e.gacha),
    profile: i(n.profile, e.profile),
    statistics: i(n.statistics, e.statistics),
    online: i(n.online, e.online),
    settings: i(n.settings, e.settings)
  };
}, Kr = (e) => {
  const t = D(e, "state");
  N(t.schemaVersion, "state.schemaVersion", { min: Te, max: Te, integer: !0 }), N(t.revision, "state.revision", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const n = D(t.account, "state.account"), i = C(n.accountId, "state.account.accountId", { min: 1, max: 128 });
  C(n.username, "state.account.username", { min: 1, max: 24 }), C(n.avatarId, "state.account.avatarId", { min: 1, max: 256 }), C(n.profileFrameId, "state.account.profileFrameId", { min: 1, max: 256 }), C(n.equippedTitleId, "state.account.equippedTitleId", { min: 1, max: 256 }), se(n.ownedTitleIds, "state.account.ownedTitleIds", { max: 1e4, unique: !0 }), se(n.ownedFrameIds, "state.account.ownedFrameIds", { max: 1e4, unique: !0 }), N(n.arenaRating, "state.account.arenaRating", { min: 0, max: 1e6, integer: !0 });
  const r = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "LEGEND"];
  B(n.arenaTier, r, "state.account.arenaTier"), B(n.highestArenaTier, r, "state.account.highestArenaTier");
  const s = D(n.raidStats, "state.account.raidStats");
  N(s.lifetimeDamage, "state.account.raidStats.lifetimeDamage", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), N(s.bossesDefeated, "state.account.raidStats.bossesDefeated", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), s.bestContributionRank !== null && N(s.bestContributionRank, "state.account.raidStats.bestContributionRank", { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }), X(n.createdAt, "state.account.createdAt"), X(n.lastOnlineAt, "state.account.lastOnlineAt");
  const o = D(t.accountProgress, "state.accountProgress");
  N(o.level, "state.accountProgress.level", { min: 1, max: 100, integer: !0 }), N(o.xp, "state.accountProgress.xp", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), N(o.researchPoints, "state.accountProgress.researchPoints", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), N(o.skillPoints, "state.accountProgress.skillPoints", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), se(o.selectedSkillNodes, "state.accountProgress.selectedSkillNodes", { max: 1e4, unique: !0 });
  const a = D(t.mining, "state.mining");
  N(a.level, "state.mining.level", { min: 1, max: 100, integer: !0 }), N(a.xp, "state.mining.xp", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  for (const v of ["totalMined", "dailyMined", "weeklyMined", "monthlyMined"]) N(a[v], `state.mining.${v}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  se(a.unlockedAreas, "state.mining.unlockedAreas", { max: 1e4, unique: !0 }), se(a.unlockedVeins, "state.mining.unlockedVeins", { max: 1e4, unique: !0 });
  const c = D(a.processedFarmEventIds, "state.mining.processedFarmEventIds");
  for (const [v, P] of Object.entries(c))
    (!v || v.length > 128 || P !== !0) && _(`state.mining.processedFarmEventIds.${v}`, "expected an exact event ID mapped to true");
  X(a.lastMinedAt, "state.mining.lastMinedAt", !0);
  const l = D(t.facilities, "state.facilities");
  for (const v of ["fusionLab", "researchLab", "expeditionGuild"]) N(l[v], `state.facilities.${v}`, { min: 1, max: 100, integer: !0 });
  const d = D(t.stones, "state.stones"), f = /* @__PURE__ */ new Set();
  for (const [v, P] of Object.entries(d))
    f.has(v) && _(`state.stones.${v}`, "duplicate stone ID"), f.add(v), qc(P, v, `state.stones.${v}`);
  const y = jo(t.endlessMine);
  for (const v of y.partyStoneIds) f.has(v) || _("state.endlessMine.partyStoneIds", "references a missing stone");
  const h = Ko(t.mastery);
  for (const v of Object.keys(h.stones)) f.has(v) || _("state.mastery.stones", "references a missing stone");
  const u = D(t.expeditions, "state.expeditions"), I = D(u.runs, "state.expeditions.runs");
  Object.keys(I).length > 100 && _("state.expeditions.runs", "exceeds 100 retained runs");
  const g = se(u.order, "state.expeditions.order", { max: 100, unique: !0 }), b = new Map(xr.map((v) => [v.id, v])), R = new Set(Lr.map((v) => v.id)), m = /* @__PURE__ */ new Set();
  for (const [v, P] of Object.entries(I)) {
    const A = `state.expeditions.runs.${v}`, L = D(P, A);
    C(L.expeditionId, `${A}.expeditionId`, { min: 1, max: 256 }) !== v && _(`${A}.expeditionId`, "map key must equal expeditionId");
    const me = C(L.regionId, `${A}.regionId`, { min: 1, max: 256 });
    R.has(me) || _(`${A}.regionId`, "references an unknown region");
    const He = C(L.durationId, `${A}.durationId`, { min: 1, max: 256 }), tt = b.get(He);
    tt || _(`${A}.durationId`, "references an unknown duration"), N(L.durationMs, `${A}.durationMs`, { min: 1, max: 1440 * 60 * 1e3, integer: !0 }) !== tt?.durationMs && _(`${A}.durationMs`, "does not match duration configuration"), B(L.strategy, Tr, `${A}.strategy`), C(L.partyId, `${A}.partyId`, { min: 1, max: 256 });
    const he = B(L.status, ["ACTIVE", "READY", "CLAIMED"], `${A}.status`), $e = te(L.partySnapshot, `${A}.partySnapshot`, 3);
    $e.length === 0 && _(`${A}.partySnapshot`, "must contain at least one stone");
    const gi = /* @__PURE__ */ new Set();
    $e.forEach((nt, zt) => {
      const ee = `${A}.partySnapshot[${zt}]`, pe = D(nt, ee), xt = C(pe.stoneId, `${ee}.stoneId`, { min: 1, max: 256 });
      gi.has(xt) && _(`${ee}.stoneId`, "duplicate party snapshot stone"), gi.add(xt), he !== "CLAIMED" && !f.has(xt) && _(`${ee}.stoneId`, "active expedition references a missing stone"), he !== "CLAIMED" && (m.has(xt) && _(`${ee}.stoneId`, "stone is assigned to multiple expeditions"), m.add(xt));
      const ts = C(pe.speciesId, `${ee}.speciesId`, { min: 1, max: 256 });
      re[ts] || _(`${ee}.speciesId`, "references an unknown species"), N(pe.level, `${ee}.level`, { min: 1, max: 120, integer: !0 }), B(pe.rarity, Be, `${ee}.rarity`), B(pe.primaryElement, Ht, `${ee}.primaryElement`), pe.secondaryElement !== null && B(pe.secondaryElement, Ht, `${ee}.secondaryElement`), mi(pe.stats, `${ee}.stats`);
      const ns = D(pe.individualValues, `${ee}.individualValues`);
      for (const gt of ke) N(ns[gt], `${ee}.individualValues.${gt}`, { min: 0, max: 31, integer: !0 });
      se(pe.skillIds, `${ee}.skillIds`, { max: 6, unique: !0 }), se(pe.traitIds, `${ee}.traitIds`, { max: 8, unique: !0 }), te(pe.equipment, `${ee}.equipment`, 4).forEach((gt, Tn) => Yn(gt, `${ee}.equipment[${Tn}]`)), Hc(pe.equipmentBonuses, `${ee}.equipmentBonuses`), B(pe.mutation, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `${ee}.mutation`), N(pe.generation, `${ee}.generation`, { min: 0, max: 1e5, integer: !0 }), te(pe.lineage, `${ee}.lineage`, 8).forEach((gt, Tn) => jn(gt, `${ee}.lineage[${Tn}]`)), N(pe.power, `${ee}.power`, { min: 1, max: 1e9, integer: !0 }), N(pe.affinityRank, `${ee}.affinityRank`, { min: 0, max: 7, integer: !0 });
    }), C(L.seed, `${A}.seed`, { min: 1, max: 1024 });
    const Ii = ce(L.repeat, `${A}.repeat`);
    X(L.startedAt, `${A}.startedAt`), X(L.lastSimulatedAt, `${A}.lastSimulatedAt`), X(L.nextCompletionAt, `${A}.nextCompletionAt`);
    const Mn = N(L.completedCycles, `${A}.completedCycles`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), Rn = N(L.claimedCycles, `${A}.claimedCycles`, { min: 0, max: Mn, integer: !0 });
    N(L.claimCount, `${A}.claimCount`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), he === "READY" && (Ii || Mn <= Rn) && _(`${A}.status`, "READY requires an unclaimed non-repeating completion"), he === "CLAIMED" && (Ii || Mn !== Rn) && _(`${A}.status`, "CLAIMED must be a fully claimed non-repeating expedition"), Yc(L.expeditionStorage, `${A}.expeditionStorage`);
    const Si = /* @__PURE__ */ new Set();
    te(L.reportEvents, `${A}.reportEvents`, Yt).forEach((nt, zt) => {
      jc(nt, `${A}.reportEvents[${zt}]`, v);
      const ee = nt.reportId;
      Si.has(ee) && _(`${A}.reportEvents[${zt}].reportId`, "duplicate report ID"), Si.add(ee);
    });
    const Ct = D(L.reportSummary, `${A}.reportSummary`);
    for (const nt of ["battles", "wins", "miningYield", "rareDiscoveries", "equipmentDrops"]) N(Ct[nt], `${A}.reportSummary.${nt}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
    Ct.wins > Ct.battles && _(`${A}.reportSummary.wins`, "cannot exceed battles"), Ct.bestDropRarity !== null && B(Ct.bestDropRarity, Be, `${A}.reportSummary.bestDropRarity`), X(L.lastClaimedAt, `${A}.lastClaimedAt`, !0), Rn > 0 && L.lastClaimedAt === null && _(`${A}.lastClaimedAt`, "claimed cycles require a claim timestamp");
  }
  for (const v of g) Object.prototype.hasOwnProperty.call(I, v) || _("state.expeditions.order", "references a missing expedition");
  const p = /* @__PURE__ */ new Set();
  te(u.discoveryStorage, "state.expeditions.discoveryStorage", kr).forEach((v, P) => {
    const A = Wr(v, `state.expeditions.discoveryStorage[${P}]`);
    p.has(A) && _(`state.expeditions.discoveryStorage[${P}].discoveryId`, "duplicate stored discovery"), p.add(A);
  });
  for (const v of ["overflowDiscarded", "totalCycles", "totalClaims"]) N(u[v], `state.expeditions.${v}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const S = D(t.training, "state.training");
  if (S.assignment !== null) {
    const v = D(S.assignment, "state.training.assignment"), P = C(v.stoneId, "state.training.assignment.stoneId", { min: 1, max: 256 });
    f.has(P) || _("state.training.assignment.stoneId", "references a missing stone"), m.has(P) && _("state.training.assignment.stoneId", "stone is also assigned to an expedition"), X(v.assignedAt, "state.training.assignment.assignedAt"), X(v.lastProcessedAt, "state.training.assignment.lastProcessedAt"), N(v.xpPerHour, "state.training.assignment.xpPerHour", { min: 1, max: 1e4, integer: !0 }), N(v.bankedMs, "state.training.assignment.bankedMs", { min: 0, max: 720 * 60 * 60 * 1e3, integer: !0 }), N(v.totalClaimedXp, "state.training.assignment.totalClaimedXp", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  }
  const M = D(t.affinityGarden, "state.affinityGarden");
  if (M.assignment !== null) {
    const v = D(M.assignment, "state.affinityGarden.assignment"), P = C(v.stoneId, "state.affinityGarden.assignment.stoneId", { min: 1, max: 256 });
    f.has(P) || _("state.affinityGarden.assignment.stoneId", "references a missing stone"), (m.has(P) || S.assignment !== null && S.assignment.stoneId === P) && _("state.affinityGarden.assignment.stoneId", "stone has another background assignment"), X(v.assignedAt, "state.affinityGarden.assignment.assignedAt"), X(v.lastProcessedAt, "state.affinityGarden.assignment.lastProcessedAt"), N(v.affinityPerHour, "state.affinityGarden.assignment.affinityPerHour", { min: 1, max: 100, integer: !0 }), N(v.bankedMs, "state.affinityGarden.assignment.bankedMs", { min: 0, max: 720 * 60 * 60 * 1e3, integer: !0 }), N(v.totalClaimedAffinity, "state.affinityGarden.assignment.totalClaimedAffinity", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  }
  const w = D(t.research, "state.research"), T = ["GEOLOGY_SURVEY", "GENETIC_ARCHIVE", "EXPEDITION_LOGISTICS"];
  if (w.slot !== null) {
    const v = D(w.slot, "state.research.slot");
    C(v.researchId, "state.research.slot.researchId", { min: 1, max: 256 }), B(v.projectId, T, "state.research.slot.projectId"), C(v.seed, "state.research.slot.seed", { min: 1, max: 1024 }), X(v.startedAt, "state.research.slot.startedAt"), X(v.completesAt, "state.research.slot.completesAt");
    const P = B(v.status, ["ACTIVE", "READY", "CLAIMED"], "state.research.slot.status");
    X(v.claimedAt, "state.research.slot.claimedAt", !0), P === "CLAIMED" != (v.claimedAt !== null) && _("state.research.slot.claimedAt", "must agree with research status");
  }
  te(w.completedProjectIds, "state.research.completedProjectIds", T.length).forEach((v, P) => B(v, T, `state.research.completedProjectIds[${P}]`));
  const x = D(w.claimLedger, "state.research.claimLedger");
  for (const [v, P] of Object.entries(x)) (!v || v.length > 256 || P !== !0) && _(`state.research.claimLedger.${v}`, "expected an exact research ID mapped to true");
  const $ = D(t.idle, "state.idle"), F = D($.timeCheckpoint, "state.idle.timeCheckpoint");
  N(F.version, "state.idle.timeCheckpoint.version", { min: 1, max: 1, integer: !0 });
  const q = N(F.trustedNowMs, "state.idle.timeCheckpoint.trustedNowMs", { min: 0, max: 864e13, integer: !0 }), Y = N(F.wallHighWaterMs, "state.idle.timeCheckpoint.wallHighWaterMs", { min: 0, max: 864e13, integer: !0 });
  q > Y && _("state.idle.timeCheckpoint", "trusted time cannot exceed wall high-water"), N(F.reconciliationCount, "state.idle.timeCheckpoint.reconciliationCount", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const oe = D($.scheduler, "state.idle.scheduler");
  N(oe.version, "state.idle.scheduler.version", { min: 1, max: 1, integer: !0 });
  const O = /* @__PURE__ */ new Set();
  if (te(oe.jobs, "state.idle.scheduler.jobs", 256).forEach((v, P) => {
    const A = `state.idle.scheduler.jobs[${P}]`, L = D(v, A), me = C(L.id, `${A}.id`, { min: 1, max: 512 });
    O.has(me) && _(`${A}.id`, "duplicate scheduler job"), O.add(me);
    const He = N(L.dueAtMs, `${A}.dueAtMs`, { min: 0, max: 864e13, integer: !0 }), tt = L.repeatEveryMs === void 0 ? void 0 : N(L.repeatEveryMs, `${A}.repeatEveryMs`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }), Ye = L.endAtMs === void 0 ? void 0 : N(L.endAtMs, `${A}.endAtMs`, { min: 0, max: 864e13, integer: !0 });
    Ye !== void 0 && tt === void 0 && _(`${A}.endAtMs`, "requires repeatEveryMs"), Ye !== void 0 && Ye < He && _(`${A}.endAtMs`, "cannot precede dueAtMs"), L.sequence !== void 0 && N(L.sequence, `${A}.sequence`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
    const he = D(L.payload, `${A}.payload`), $e = B(he.kind, ["EXPEDITION", "TRAINING", "AFFINITY_GARDEN", "RESEARCH", "ENDLESS_MINE"], `${A}.payload.kind`);
    $e === "EXPEDITION" ? (en(he, ["kind", "expeditionId"], `${A}.payload`), C(he.expeditionId, `${A}.payload.expeditionId`, { min: 1, max: 256 })) : $e === "RESEARCH" ? (en(he, ["kind", "researchId"], `${A}.payload`), C(he.researchId, `${A}.payload.researchId`, { min: 1, max: 256 })) : $e === "ENDLESS_MINE" ? (en(he, ["kind", "runId"], `${A}.payload`), C(he.runId, `${A}.payload.runId`, { min: 1, max: 512 })) : (en(he, ["kind", "stoneId"], `${A}.payload`), C(he.stoneId, `${A}.payload.stoneId`, { min: 1, max: 256 }));
  }), X($.lastProcessedAt, "state.idle.lastProcessedAt"), X($.lastActiveAt, "state.idle.lastActiveAt"), $.lastWelcomeBack !== null) {
    const v = D($.lastWelcomeBack, "state.idle.lastWelcomeBack");
    C(v.summaryId, "state.idle.lastWelcomeBack.summaryId", { min: 1, max: 512 }), X(v.from, "state.idle.lastWelcomeBack.from"), X(v.to, "state.idle.lastWelcomeBack.to");
    for (const P of ["elapsedMs", "expeditionCycles", "trainingXpReady", "affinityReady", "endlessFloors", "endlessCredits", "equipmentAdded", "equipmentSalvaged", "rareDiscoveries"]) N(v[P], `state.idle.lastWelcomeBack.${P}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
    ce(v.capped, "state.idle.lastWelcomeBack.capped"), ce(v.rollbackDetected, "state.idle.lastWelcomeBack.rollbackDetected"), ce(v.researchReady, "state.idle.lastWelcomeBack.researchReady"), X(v.createdAt, "state.idle.lastWelcomeBack.createdAt");
  }
  const V = D(t.inventory, "state.inventory"), Q = D(V.currencies, "state.inventory.currencies");
  for (const v of ["credits", "gachaTickets", "researchCores", "upgradeDust"]) N(Q[v], `state.inventory.currencies.${v}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  for (const [v, P] of Object.entries(Q)) N(P, `state.inventory.currencies.${v}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  pt(V.items, "state.inventory.items");
  const qe = D(V.equipment, "state.inventory.equipment");
  for (const [v, P] of Object.entries(qe))
    Yn(P, `state.inventory.equipment.${v}`), P.instanceId !== v && _(`state.inventory.equipment.${v}`, "map key must equal instanceId");
  N(V.capacity, "state.inventory.capacity", { min: f.size, max: 1e6, integer: !0 });
  const Oe = te(t.unappraisedFinds, "state.unappraisedFinds", 1e5), Ue = /* @__PURE__ */ new Set();
  Oe.forEach((v, P) => {
    const A = `state.unappraisedFinds[${P}]`, L = D(v, A), me = C(L.discoveryId, `${A}.discoveryId`, { min: 1, max: 256 });
    Ue.has(me) && _(`${A}.discoveryId`, "duplicate discovery ID"), Ue.add(me), C(L.seed, `${A}.seed`, { min: 1, max: 1024 }), C(L.veinId, `${A}.veinId`, { min: 1, max: 256 }), C(L.areaId, `${A}.areaId`, { min: 1, max: 256 }), X(L.discoveredAt, `${A}.discoveredAt`), B(L.hintedRarity, Be, `${A}.hintedRarity`);
    const He = C(L.sourceEventId, `${A}.sourceEventId`, { min: 1, max: 128 });
    Object.prototype.hasOwnProperty.call(c, He) || _(`${A}.sourceEventId`, "does not exist in the Farm event ledger");
  });
  const E = D(t.collection, "state.collection");
  se(E.discoveredSpeciesIds, "state.collection.discoveredSpeciesIds", { max: 1e5, unique: !0 });
  const k = D(E.mutationSpecies, "state.collection.mutationSpecies");
  for (const [v, P] of Object.entries(k)) te(P, `state.collection.mutationSpecies.${v}`, 5).forEach((A, L) => B(A, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `state.collection.mutationSpecies.${v}[${L}]`));
  const U = D(E.variantSpecies, "state.collection.variantSpecies");
  for (const [v, P] of Object.entries(U)) te(P, `state.collection.variantSpecies.${v}`, 4).forEach((A, L) => B(A, ["STANDARD", "SHINY", "AURORA", "OBSIDIAN"], `state.collection.variantSpecies.${v}[${L}]`));
  pt(E.origins, "state.collection.origins"), te(t.fusionHistory, "state.fusionHistory", 1e5).forEach((v, P) => {
    const A = `state.fusionHistory[${P}]`, L = D(v, A);
    C(L.id, `${A}.id`, { min: 1, max: 256 }), se(L.parentIds, `${A}.parentIds`, { max: 4, unique: !0 }).length < 2 && _(`${A}.parentIds`, "fusion requires at least two parents"), C(L.childId, `${A}.childId`, { min: 1, max: 256 }), C(L.recipeId, `${A}.recipeId`, { nullable: !0, max: 256 }), se(L.catalystIds, `${A}.catalystIds`, { max: 16, unique: !0 }), se(L.inheritedTraits, `${A}.inheritedTraits`, { max: 8, unique: !0 }), se(L.inheritedSkills, `${A}.inheritedSkills`, { max: 6, unique: !0 }), B(L.mutation, ["NONE", "PRISMATIC", "ANCIENT", "CORRUPTED", "PERFECT"], `${A}.mutation`), ce(L.consumeParents, `${A}.consumeParents`), X(L.createdAt, `${A}.createdAt`);
  });
  const G = D(t.gacha, "state.gacha"), K = D(G.pityByBanner, "state.gacha.pityByBanner");
  for (const [v, P] of Object.entries(K)) {
    const A = D(P, `state.gacha.pityByBanner.${v}`);
    N(A.pullsSinceSsr, `state.gacha.pityByBanner.${v}.pullsSinceSsr`, { min: 0, max: 1e6, integer: !0 }), N(A.lifetimePulls, `state.gacha.pityByBanner.${v}.lifetimePulls`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), ce(A.featuredGuaranteed, `state.gacha.pityByBanner.${v}.featuredGuaranteed`);
  }
  te(G.history, "state.gacha.history", 1e3).forEach((v, P) => {
    const A = `state.gacha.history[${P}]`, L = D(v, A);
    C(L.id, `${A}.id`, { min: 1, max: 256 }), C(L.bannerId, `${A}.bannerId`, { min: 1, max: 256 }), C(L.stoneId, `${A}.stoneId`, { min: 1, max: 256 }), B(L.rarity, Be, `${A}.rarity`), N(L.pullNumber, `${A}.pullNumber`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }), N(L.pityBefore, `${A}.pityBefore`, { min: 0, max: 1e6, integer: !0 }), ce(L.guaranteed, `${A}.guaranteed`), X(L.createdAt, `${A}.createdAt`);
  });
  const J = D(G.rarityCounts, "state.gacha.rarityCounts");
  for (const [v, P] of Object.entries(J))
    B(v, Be, `state.gacha.rarityCounts key ${v}`), N(P, `state.gacha.rarityCounts.${v}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const ne = D(t.achievements, "state.achievements");
  for (const [v, P] of Object.entries(ne)) {
    const A = D(P, `state.achievements.${v}`);
    N(A.value, `state.achievements.${v}.value`, { min: 0, max: Number.MAX_SAFE_INTEGER }), X(A.unlockedAt, `state.achievements.${v}.unlockedAt`, !0), X(A.claimedAt, `state.achievements.${v}.claimedAt`, !0), A.claimedAt !== null && A.unlockedAt === null && _(`state.achievements.${v}`, "claimed achievement must be unlocked");
  }
  const Ie = te(t.parties, "state.parties", 100);
  Ie.length === 0 && _("state.parties", "at least one party is required");
  const ue = /* @__PURE__ */ new Set();
  Ie.forEach((v, P) => {
    const A = `state.parties[${P}]`, L = D(v, A), me = C(L.id, `${A}.id`, { min: 1, max: 256 });
    ue.has(me) && _(`${A}.id`, "duplicate party ID"), ue.add(me), C(L.name, `${A}.name`, { min: 1, max: 64 }), ce(L.defense, `${A}.defense`);
    const He = /* @__PURE__ */ new Set();
    te(L.slots, `${A}.slots`, 3).forEach((tt, Ye) => {
      const he = D(tt, `${A}.slots[${Ye}]`), $e = C(he.stoneId, `${A}.slots[${Ye}].stoneId`, { min: 1, max: 256 });
      f.has($e) || _(`${A}.slots[${Ye}].stoneId`, "references a missing stone"), He.has($e) && _(`${A}.slots`, "contains a duplicate stone"), He.add($e), B(he.position, ["FRONT", "BACK", "SUPPORT"], `${A}.slots[${Ye}].position`);
    });
  });
  const wn = C(t.activePartyId, "state.activePartyId", { min: 1, max: 256 });
  ue.has(wn) || _("state.activePartyId", "references a missing party"), t.activeBattle === null || Bi(t.activeBattle, "state.activeBattle", f, { active: !0 });
  const fi = /* @__PURE__ */ new Set();
  te(t.battleHistory, "state.battleHistory", 100).forEach((v, P) => {
    const A = Bi(v, `state.battleHistory[${P}]`, f, { active: !1 });
    fi.has(A.battleId) && _(`state.battleHistory[${P}].battleId`, "duplicate battle ID"), fi.add(A.battleId);
  });
  const Qr = D(t.dungeonClears, "state.dungeonClears");
  for (const [v, P] of Object.entries(Qr)) {
    const A = D(P, `state.dungeonClears.${v}`);
    N(A.bestTurns, `state.dungeonClears.${v}.bestTurns`, { min: 1, max: 100, integer: !0 }), N(A.clearCount, `state.dungeonClears.${v}.clearCount`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }), X(A.firstClearedAt, `state.dungeonClears.${v}.firstClearedAt`);
  }
  const Kt = D(t.profile, "state.profile");
  for (const v of se(Kt.showcaseStoneIds, "state.profile.showcaseStoneIds", { max: 6, unique: !0 })) f.has(v) || _("state.profile.showcaseStoneIds", "references a missing stone");
  for (const v of se(Kt.favoriteStoneIds, "state.profile.favoriteStoneIds", { max: 12, unique: !0 })) f.has(v) || _("state.profile.favoriteStoneIds", "references a missing stone");
  N(Kt.totalAffinity, "state.profile.totalAffinity", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), ce(Kt.public, "state.profile.public");
  const Zr = D(t.statistics, "state.statistics");
  for (const v of ["fusionCount", "mutationCount", "rareDiscoveryCount", "battleWins", "battleLosses", "highestInfiniteFloor", "totalRaidDamage"]) N(Zr[v], `state.statistics.${v}`, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 });
  const Et = D(t.online, "state.online");
  ce(Et.connected, "state.online.connected"), C(Et.sessionId, "state.online.sessionId", { min: 1, max: 256 });
  const es = N(Et.sequence, "state.online.sequence", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: !0 }), vn = /* @__PURE__ */ new Set();
  te(Et.queue, "state.online.queue", 1e5).forEach((v, P) => {
    const A = `state.online.queue[${P}]`, L = D(v, A), me = C(L.eventId, `${A}.eventId`, { min: 1, max: 256 });
    vn.has(me) && _(`${A}.eventId`, "duplicate queued event"), vn.add(me), C(L.sessionId, `${A}.sessionId`, { min: 1, max: 256 }), N(L.sequence, `${A}.sequence`, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: !0 }) > es && _(`${A}.sequence`, "exceeds online sequence"), X(L.timestamp, `${A}.timestamp`), C(L.accountId, `${A}.accountId`, { min: 1, max: 128 }) !== i && _(`${A}.accountId`, "does not match account"), B(L.kind, ["MINING_RECORDED", "STONE_CREATED", "STONE_EVOLVED", "STONE_FUSED", "BATTLE_FINISHED", "ACHIEVEMENT_UNLOCKED", "PROFILE_UPDATED", "RANK_REQUESTED"], `${A}.kind`), L.payload === void 0 && _(`${A}.payload`, "payload is required"), N(L.attempts, `${A}.attempts`, { min: 0, max: 1e3, integer: !0 }), X(L.nextAttemptAt, `${A}.nextAttemptAt`);
  });
  const hi = /* @__PURE__ */ new Set();
  te(Et.processedReceipts, "state.online.processedReceipts", 2e3).forEach((v, P) => {
    const A = `state.online.processedReceipts[${P}]`, L = D(v, A), me = C(L.eventId, `${A}.eventId`, { min: 1, max: 256 });
    hi.has(me) && _(`${A}.eventId`, "duplicate receipt"), vn.has(me) && _(`${A}.eventId`, "event cannot be both queued and acknowledged"), hi.add(me), X(L.processedAt, `${A}.processedAt`), C(L.checksum, `${A}.checksum`, { min: 1, max: 256 });
  }), X(Et.lastSyncedAt, "state.online.lastSyncedAt", !0);
  const Xe = D(t.settings, "state.settings");
  B(Xe.effectQuality, ["LOW", "MEDIUM", "HIGH", "ULTRA"], "state.settings.effectQuality"), ce(Xe.reduceMotion, "state.settings.reduceMotion"), ce(Xe.mute, "state.settings.mute"), N(Xe.masterVolume, "state.settings.masterVolume", { min: 0, max: 1 }), N(Xe.musicVolume, "state.settings.musicVolume", { min: 0, max: 1 }), N(Xe.effectsVolume, "state.settings.effectsVolume", { min: 0, max: 1 }), N(Xe.textScale, "state.settings.textScale", { min: 0.8, max: 1.5 }), ce(Xe.developerMode, "state.settings.developerMode"), X(t.createdAt, "state.createdAt"), X(t.updatedAt, "state.updatedAt");
  const Ei = t;
  for (const v of Object.values(Ei.stones)) v.stats = Le(v);
  return Ei;
}, Gi = (e, t) => {
  if (!z(e)) throw new Error("Save state must be an object");
  if (typeof e.schemaVersion != "number") throw new Error("Legacy raw saves require an explicit schemaVersion");
  const n = e.schemaVersion;
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Save schemaVersion must be a positive integer");
  if (n > Te) throw new Error(`Save schema ${n} is newer than this client`);
  if (n === Te && !t) throw new Error(`Raw schema ${Te} saves are not accepted; a checksummed STONEVERSE_SAVE envelope is required`);
  if (n === 4 && !t) throw new Error("Raw schema 4 saves are not accepted; the checksummed v4 STONEVERSE_SAVE envelope is required");
  const i = { ...e };
  if (n < 2 && (i.facilities ??= { fusionLab: 1, researchLab: 1, expeditionGuild: 1 }, i.statistics ??= { fusionCount: 0, mutationCount: 0, rareDiscoveryCount: 0, battleWins: 0, battleLosses: 0, highestInfiniteFloor: 0, totalRaidDamage: 0 }, i.online ??= { connected: !0, sessionId: "migrated_session", sequence: 0, queue: [], processedReceipts: [], lastSyncedAt: null }), n < 3 && (i.activeBattle ??= null, i.dungeonClears ??= {}, i.unappraisedFinds ??= []), n < 4) {
    const c = z(i.mining) ? { ...i.mining } : {}, l = z(i.online) ? i.online : {}, d = Array.isArray(l.processedReceipts) ? l.processedReceipts : [], f = {};
    for (const y of d)
      !z(y) || typeof y.eventId != "string" || y.eventId.startsWith("sync_") || Object.defineProperty(f, y.eventId, { value: !0, enumerable: !0, configurable: !0, writable: !0 });
    c.processedFarmEventIds = f, i.mining = c;
  }
  if (n < 5) {
    const l = [i.updatedAt, z(i.account) ? i.account.lastOnlineAt : void 0, i.createdAt].find((f) => typeof f == "string" && Number.isFinite(Date.parse(f))), d = l ? new Date(l) : Z.now();
    i.expeditions ??= { runs: {}, order: [], discoveryStorage: [], overflowDiscarded: 0, totalCycles: 0, totalClaims: 0 }, i.training ??= { assignment: null }, i.affinityGarden ??= { assignment: null }, i.research ??= { slot: null, completedProjectIds: [], claimLedger: {} }, i.idle ??= Pc(d);
  }
  const r = [i.updatedAt, i.createdAt].find((c) => typeof c == "string" && Number.isFinite(Date.parse(c))), s = r ? new Date(r) : Z.now();
  i.endlessMine ??= Ir(s), i.mastery ??= Mr(), z(i.idle) && z(i.idle.lastWelcomeBack) && (i.idle.lastWelcomeBack.endlessFloors ??= 0, i.idle.lastWelcomeBack.endlessCredits ??= 0, i.idle.lastWelcomeBack.equipmentAdded ??= 0, i.idle.lastWelcomeBack.equipmentSalvaged ??= 0, i.idle.lastWelcomeBack.rareDiscoveries ??= 0), i.schemaVersion = Te;
  const o = n < Te, a = o ? Vc(i) : i;
  if (a.schemaVersion = Te, o) {
    a.stones = z(i.stones) ? i.stones : a.stones, a.unappraisedFinds = Array.isArray(i.unappraisedFinds) ? i.unappraisedFinds : a.unappraisedFinds, a.fusionHistory = Array.isArray(i.fusionHistory) ? i.fusionHistory : a.fusionHistory, a.parties = Array.isArray(i.parties) ? i.parties : a.parties, a.battleHistory = Array.isArray(i.battleHistory) ? i.battleHistory : a.battleHistory, a.achievements = z(i.achievements) ? i.achievements : a.achievements, a.dungeonClears = z(i.dungeonClears) ? i.dungeonClears : a.dungeonClears, a.expeditions.runs = z(a.expeditions.runs) ? a.expeditions.runs : {}, a.expeditions.order = Array.isArray(a.expeditions.order) ? a.expeditions.order : [], a.expeditions.discoveryStorage = Array.isArray(a.expeditions.discoveryStorage) ? a.expeditions.discoveryStorage : [], a.research.completedProjectIds = Array.isArray(a.research.completedProjectIds) ? a.research.completedProjectIds : [], a.research.claimLedger = z(a.research.claimLedger) ? a.research.claimLedger : {}, a.idle.scheduler.jobs = Array.isArray(a.idle.scheduler.jobs) ? a.idle.scheduler.jobs : [], a.online.queue = Array.isArray(a.online.queue) ? a.online.queue : [], a.online.processedReceipts = Array.isArray(a.online.processedReceipts) ? a.online.processedReceipts : [], a.collection.discoveredSpeciesIds = Array.isArray(a.collection.discoveredSpeciesIds) ? [...new Set(a.collection.discoveredSpeciesIds)] : [], a.collection.mutationSpecies = z(a.collection.mutationSpecies) ? a.collection.mutationSpecies : {}, a.collection.variantSpecies = z(a.collection.variantSpecies) ? a.collection.variantSpecies : {}, a.collection.origins = z(a.collection.origins) ? a.collection.origins : {};
    const c = Object.keys(a.stones).length;
    if (c > 1e6) throw new Error("Legacy save exceeds the maximum Stone capacity");
    Number.isSafeInteger(a.inventory.capacity) && a.inventory.capacity >= 0 && a.inventory.capacity <= 1e6 && (a.inventory.capacity = Math.max(a.inventory.capacity, c));
    const l = z(a.mining.processedFarmEventIds) ? a.mining.processedFarmEventIds : {}, d = {};
    for (const f of Object.keys(l)) Object.defineProperty(d, f, { value: !0, enumerable: !0, configurable: !0, writable: !0 });
    for (const f of a.unappraisedFinds)
      z(f) && typeof f.sourceEventId == "string" && Object.defineProperty(d, f.sourceEventId, { value: !0, enumerable: !0, configurable: !0, writable: !0 });
    a.mining.processedFarmEventIds = d;
    for (const f of Object.values(a.stones))
      if (z(f)) {
        for (const y of ["parents", "grandparents"])
          if (Array.isArray(f[y]))
            for (const h of f[y]) z(h) && !Array.isArray(h.traitIds) && (h.traitIds = []);
      }
  }
  return Kr(a);
}, zr = (e, t = Z) => {
  let n;
  try {
    n = JSON.parse(JSON.stringify(e));
  } catch {
    throw new Error("Game state is not JSON serializable");
  }
  Kr(n);
  const i = {
    format: "STONEVERSE_SAVE",
    schemaVersion: Te,
    savedAt: t.now().toISOString(),
    checksum: nn(n),
    state: n
  };
  return JSON.stringify(i, null, 2);
}, Bt = (e) => {
  if (e.length > 2e7) throw new Error("Save exceeds the 20 MB safety limit");
  let t;
  try {
    t = JSON.parse(e);
  } catch {
    throw new Error("Save is not valid JSON");
  }
  if (!z(t)) throw new Error("Save envelope must be an object");
  if (t.format === "STONEVERSE_SAVE") {
    if (!z(t.state)) throw new Error("Save envelope has no state");
    const i = N(t.schemaVersion, "envelope.schemaVersion", { min: 1, max: Te, integer: !0 }), r = N(t.state.schemaVersion, "envelope.state.schemaVersion", { min: 1, max: Te, integer: !0 });
    if (i !== r) throw new Error("Save envelope schemaVersion does not match its state");
    X(t.savedAt, "envelope.savedAt");
    const s = C(t.checksum, "envelope.checksum", { min: 8, max: 8 });
    if (!s || !/^[0-9a-f]{8}$/i.test(s)) throw new Error("Save envelope checksum is invalid");
    if (nn(t.state) !== s) throw new Error("Save checksum mismatch");
    return Gi(t.state, !0);
  }
  if (typeof t.schemaVersion != "number") throw new Error("Legacy raw saves require an explicit schemaVersion");
  const n = t.schemaVersion;
  if (n >= 4) throw new Error(`Raw schema ${n} saves require their original checksummed STONEVERSE_SAVE envelope`);
  return Gi(t, !1);
}, Xc = (e, t, n = Z) => {
  const i = zr(t, n), r = e.getItem(St), s = e.getItem(Dt);
  try {
    e.setItem(Ot, i);
    const o = e.getItem(Ot);
    if (!o) throw new Error("Storage did not retain pending save");
    if (Bt(o), r)
      try {
        Bt(r), e.setItem(Dt, r);
      } catch {
      }
    e.setItem(St, o);
    const a = e.getItem(St);
    if (!a) throw new Error("Storage did not retain committed save");
    Bt(a), e.removeItem(Ot);
  } catch (o) {
    try {
      r === null ? e.removeItem(St) : e.setItem(St, r);
    } catch {
    }
    try {
      s === null ? e.removeItem(Dt) : e.setItem(Dt, s);
    } catch {
    }
    try {
      e.removeItem(Ot);
    } catch {
    }
    throw o;
  }
}, Jr = (e) => {
  const t = [];
  let n = 0;
  for (const r of [St, Ot, Dt, ...Bc])
    try {
      const s = e.getItem(r);
      s && t.push(s);
    } catch {
      n += 1;
    }
  let i = 0;
  for (const r of t)
    try {
      return { state: Bt(r), invalidReadableCandidates: i, unreadableSlots: n };
    } catch {
      i += 1;
    }
  return { state: null, invalidReadableCandidates: i, unreadableSlots: n };
}, Wc = (e) => Jr(e).state, Kc = (e = {}) => (t, n) => {
  const i = e.clock ?? Z, r = e.storage === void 0 ? Gc() : e.storage;
  let s = r !== null;
  const o = (m) => {
    if (!r)
      throw s = !1, new Error("Local persistence is unavailable; this session cannot be saved");
    try {
      Xc(r, m, i), s = !0;
    } catch (p) {
      throw s = !1, p;
    }
  }, a = e.autoSave ?? !0, c = e.rng, l = () => e.rngFactory?.() ?? c ?? new Wn(), d = r ? Jr(r) : { state: null, invalidReadableCandidates: 0 }, f = d.state;
  let y = !f && d.invalidReadableCandidates > 0;
  const h = e.initialState ?? f ?? Pn({ ...e.newGame, clock: i });
  let u = je(h), I = y ? "保存データを検証できません。破損スロットを保護するため、Importまたは明示的なResetまで書き込みを停止しました。" : null;
  try {
    Zt(u, i), f && a && r && o(u);
  } catch (m) {
    u = je(h), I = m instanceof Error ? m.message : String(m);
  }
  const g = (m, p = { mode: "ACTIVE" }) => {
    let S, M;
    if (t((w) => {
      try {
        const T = je(w.game), x = Zt(T, i, p), $ = { now: () => new Date(T.idle.timeCheckpoint.trustedNowMs) };
        if (S = m(T, l(), $, x), _e(T), zo(T, $), a && r) {
          if (y) throw new Error("Corrupt save recovery is write-protected; import a valid save or explicitly reset");
          o(T);
        }
        return { ...w, game: T, persistenceAvailable: s, lastError: null };
      } catch (T) {
        return M = T, { ...w, persistenceAvailable: s, lastError: T instanceof Error ? T.message : String(T) };
      }
    }), M) throw M;
    return S;
  }, b = (m, p) => {
    const S = m.stones[p];
    if (!S) throw new Error(`Stone not found: ${p}`);
    return S;
  }, R = (m, p, S) => {
    const M = m.battleHistory.some((w) => w.battleId === p.battleId);
    p.winner && (Qa(m, p, i), M || rt(m, "BATTLE_FINISHED", { battleId: p.battleId, mode: p.mode, winner: p.winner, turns: p.turn }, S, i, `sync_battle_${p.battleId}`));
  };
  return {
    game: u,
    route: "HOME",
    selectedStoneId: null,
    farmSessionActive: void 0,
    persistenceAvailable: s,
    lastError: I,
    mine: (m, p) => Fn(n().game, m, i, p).valid ? g((M, w) => {
      const T = Fn(M, m, i, p), x = Ea(M, m, w, i, p);
      return x.accepted && rt(M, "MINING_RECORDED", {
        amount: T.amount,
        quality: T.quality,
        areaId: m.areaId ?? "area_greenbreak",
        veinId: m.veinId ?? null,
        source: {
          eventId: m.eventId,
          sessionId: m.sessionId ?? M.online.sessionId,
          timestamp: T.sourceTimestamp,
          metadata: T.metadata ?? {}
        }
      }, w, i, `sync_mining_${m.eventId}`), x;
    }) : { accepted: !1, duplicate: !1, xpGranted: 0, creditsGranted: 0, discoveries: [], miningLevelsGained: 0 },
    appraise: (m) => g((p, S) => {
      const M = Ia(p, m, i);
      return rt(p, "STONE_CREATED", { stoneId: M.stone.instanceId, speciesId: M.stone.speciesId, rarity: M.stone.rarity, origin: M.stone.origin }, S, i, `sync_stone_${M.stone.instanceId}`), M;
    }),
    pullGacha: (m, p) => g((S, M) => Ma(S, m, p, M, i)),
    fuse: (m, p = {}) => g((S, M) => {
      if (p.consumeParents) {
        const T = /* @__PURE__ */ new Set([
          ...Object.values(S.expeditions.runs).filter((x) => x.status !== "CLAIMED").flatMap((x) => x.partySnapshot.map(($) => $.stoneId)),
          ...S.training.assignment ? [S.training.assignment.stoneId] : [],
          ...S.affinityGarden.assignment ? [S.affinityGarden.assignment.stoneId] : [],
          ...S.endlessMine.status === "RUNNING" || S.endlessMine.status === "PAUSED" ? S.endlessMine.partyStoneIds : [],
          ...S.activeBattle && !S.activeBattle.winner ? S.activeBattle.units.filter((x) => x.team === "PLAYER").map((x) => x.stoneId) : []
        ]);
        if (m.some((x) => T.has(x))) throw new Error("A stone assigned to a background activity cannot be consumed");
      }
      const w = La(S, m, p, M, i);
      return rt(S, "STONE_FUSED", { fusionId: w.history.id, parentIds: w.history.parentIds, childId: w.child.instanceId, recipeId: w.history.recipeId }, M, i, `sync_fusion_${w.history.id}`), w;
    }),
    addStoneXp: (m, p) => g((S) => ai(b(S, m), S.mastery, p)),
    addAffinity: (m, p) => g((S) => {
      const M = un(b(S, m), p);
      return S.profile.totalAffinity = Object.values(S.stones).reduce((w, T) => w + T.affinity.points, 0), M;
    }),
    evolve: (m, p, S) => g((M, w) => {
      const T = b(M, m), x = {
        items: M.inventory.items,
        areaId: S,
        achievementIds: Object.entries(M.achievements).filter(([, Y]) => !!Y.unlockedAt).map(([Y]) => Y),
        fusionCount: M.statistics.fusionCount,
        timestamp: i.now()
      }, $ = Is(T, x).find((Y) => Y.id === p);
      if (!$) throw new Error("Evolution conditions are not met");
      const F = Object.fromEntries($.conditions.filter((Y) => Y.kind === "ITEM").map((Y) => [String(Y.value), Y.amount ?? 1]));
      bt(M, { ...$.cost, items: { ...F, ...$.cost?.items ?? {} } });
      const q = Ss(T, $);
      return rt(M, "STONE_EVOLVED", { stoneId: m, previousSpeciesId: q.previousSpeciesId, speciesId: q.stone.speciesId, evolutionId: p }, w, i, `sync_evolution_${m}_${T.evolutionStage}`), q;
    }),
    awaken: (m) => g((p) => {
      const S = b(p, m);
      bt(p, { currencies: { upgradeDust: 100 * (S.awakeningStage + 1) } }), ys(S);
    }),
    reincarnate: (m) => g((p) => As(b(p, m))),
    learnSkillNode: (m, p) => g((S) => ws(b(S, m), p)),
    toggleFavorite: (m) => g((p) => {
      const S = b(p, m);
      S.favorite = !S.favorite, p.profile.favoriteStoneIds = S.favorite ? [.../* @__PURE__ */ new Set([...p.profile.favoriteStoneIds, m])].slice(0, 12) : p.profile.favoriteStoneIds.filter((M) => M !== m);
    }),
    toggleLock: (m) => g((p) => {
      const S = b(p, m);
      S.locked = !S.locked;
    }),
    setNickname: (m, p) => g((S) => {
      const M = p?.trim() || null;
      if (M && M.length > 20) throw new Error("Nickname must be 20 characters or fewer");
      b(S, m).nickname = M;
    }),
    setParty: (m, p = n().game.activePartyId) => g((S) => {
      if (m.length < 1 || m.length > 3 || new Set(m).size !== m.length) throw new Error("A party requires 1-3 unique stones");
      for (const w of m) b(S, w);
      const M = S.parties.find((w) => w.id === p);
      if (!M) throw new Error("Party not found");
      M.slots = m.map((w, T) => ({ stoneId: w, position: T === 0 ? "FRONT" : "BACK" })), S.activePartyId = M.id;
    }),
    startDungeonBattle: (m, p) => g((S, M) => {
      const w = S.parties.find(($) => $.id === S.activePartyId), T = /* @__PURE__ */ new Set([
        ...Object.values(S.expeditions.runs).filter(($) => $.status !== "CLAIMED").flatMap(($) => $.partySnapshot.map((F) => F.stoneId)),
        ...S.training.assignment ? [S.training.assignment.stoneId] : [],
        ...S.affinityGarden.assignment ? [S.affinityGarden.assignment.stoneId] : [],
        ...S.endlessMine.status === "RUNNING" || S.endlessMine.status === "PAUSED" ? S.endlessMine.partyStoneIds : []
      ]);
      if (w?.slots.some(($) => T.has($.stoneId))) throw new Error("A deployed Stone cannot enter a dungeon battle");
      const x = Ba(S, m, p, M, i);
      return S.activeBattle = x, x;
    }),
    advanceBattle: () => g((m, p) => {
      if (!m.activeBattle) throw new Error("No active battle");
      const S = Ka(m.activeBattle, p, i);
      return R(m, m.activeBattle, p), S;
    }),
    issueBattleCommand: (m, p) => g((S, M, w) => {
      if (!S.activeBattle) throw new Error("No active battle");
      if (S.activeBattle.controlMode === "AUTO") throw new Error("Switch to MANUAL before issuing a command");
      const T = za(S.activeBattle, m, p, M, w);
      return R(S, S.activeBattle, M), T;
    }),
    setBattleAuto: (m) => g((p) => {
      if (!p.activeBattle || p.activeBattle.winner) throw new Error("No active battle");
      p.activeBattle.controlMode = m ? "AUTO" : "MANUAL";
    }),
    setBattleSpeed: (m) => g((p) => {
      if (![1, 2, 4].includes(m)) throw new Error("Battle speed must be 1x, 2x, or 4x");
      if (!p.activeBattle) throw new Error("No active battle");
      p.activeBattle.speed = m;
    }),
    runActiveBattle: () => g((m, p) => {
      if (!m.activeBattle) throw new Error("No active battle");
      return Ja(m.activeBattle, p, i), R(m, m.activeBattle, p), m.activeBattle;
    }),
    abandonBattle: () => g((m) => {
      m.activeBattle = null;
    }),
    claimAchievement: (m) => g((p) => aa(p, m, i)),
    processBackground: (m = "OFFLINE") => g((p, S, M, w) => w, { mode: m }),
    nextBackgroundDueAtMs: () => {
      const m = n().game.idle.scheduler.jobs.map((p) => p.dueAtMs).filter(Number.isSafeInteger);
      return m.length ? Math.min(...m) : null;
    },
    dismissWelcomeBack: (m) => g((p) => {
      p.idle.lastWelcomeBack?.summaryId === m && (p.idle.lastWelcomeBack = null);
    }),
    startExpedition: (m) => g((p, S, M) => {
      const w = pc(p, m, S, M);
      return _e(p), w;
    }),
    stopExpedition: (m) => g((p) => {
      const S = mc(p, m);
      return _e(p), S;
    }),
    claimExpedition: (m) => g((p, S, M) => {
      const w = p.expeditions.runs[m];
      if (!w) throw new Error("Expedition not found");
      const T = w.claimedCycles, x = Ac(p, m, M), $ = Object.entries(x.reward.items).filter(([O]) => O.startsWith("equipment_"));
      for (const [O, V] of $) {
        const Q = Math.max(0, (p.inventory.items[O] ?? 0) - V);
        Q === 0 ? delete p.inventory.items[O] : p.inventory.items[O] = Q;
      }
      const F = { NORMAL: "COMMON", RARE: "UNCOMMON", SR: "RARE", SSR: "EPIC", UR: "LEGENDARY", LEGENDARY: "MYTHIC" }, q = (O) => O.endsWith("_charm") ? "CHARM" : O.endsWith("_rune") ? "RUNE" : O.endsWith("_relic") ? "RELIC" : "CORE", Y = (O) => O.includes("abyssal") ? "ABYSSAL" : O.includes("meteor") ? "HUNTER" : O.includes("ancestor") ? "BASTION" : O.includes("resonance") || O.includes("celestial") ? "RESONANCE" : null;
      let oe = 0;
      for (const [O, V] of $) {
        const Q = Cr(O);
        for (let qe = 0; qe < Math.min(1e4, V); qe += 1) {
          const Oe = Q?.itemId ?? O, Ue = Q?.seed ?? `${w.seed}:equipment-claim:${T}:${oe}`;
          oe += 1;
          const E = ur({
            level: Math.max(1, Math.max(...w.partySnapshot.map((k) => k.level))),
            source: `expedition-${w.regionId}`,
            ...Q ? { rarity: F[Q.rarity], slot: q(Oe), setId: Y(Oe) } : {}
          }, new Ee(Ue));
          Pt(p.endlessMine.equipment, E, p.endlessMine.lootFilter);
        }
      }
      return x;
    }),
    claimStoredExpeditionDiscovery: (m) => g((p, S, M) => wc(p, m, M)),
    startTraining: (m) => g((p, S, M) => {
      bc(p, m, M.now()), _e(p);
    }),
    claimTraining: () => g((m, p, S) => Nc(m, S.now())),
    stopTraining: () => g((m) => {
      kc(m), _e(m);
    }),
    startAffinityGarden: (m) => g((p, S, M) => {
      _c(p, m, M.now()), _e(p);
    }),
    claimAffinityGarden: () => g((m, p, S) => Cc(m, S.now())),
    stopAffinityGarden: () => g((m) => {
      xc(m), _e(m);
    }),
    startResearch: (m) => g((p, S, M) => {
      const w = Lc(p, m, S, M);
      return _e(p), w;
    }),
    claimResearch: (m) => g((p, S, M) => Dc(p, m, M.now())),
    startEndlessMine: (m) => g((p, S, M) => {
      const w = p.parties.find((F) => F.id === p.activePartyId), T = [...m ?? w?.slots.map((F) => F.stoneId) ?? []], x = /* @__PURE__ */ new Set();
      for (const F of Object.values(p.expeditions.runs)) if (F.status !== "CLAIMED") for (const q of F.partySnapshot) x.add(q.stoneId);
      if (p.training.assignment && x.add(p.training.assignment.stoneId), p.affinityGarden.assignment && x.add(p.affinityGarden.assignment.stoneId), p.activeBattle && !p.activeBattle.winner)
        for (const F of p.activeBattle.units) F.team === "PLAYER" && x.add(F.stoneId);
      if (T.some((F) => x.has(F))) throw new Error("A deployed Stone cannot enter Endless Mine");
      const $ = `endless:${p.account.accountId}:${M.now().getTime()}:${Math.floor(S.next() * 4294967296).toString(16)}`;
      No(p.endlessMine, p.stones, T, M.now(), $), _e(p);
    }),
    advanceEndlessMine: (m = 1) => g(
      (p, S, M) => Ar(p.endlessMine, m, M.now()),
      { mode: "ACTIVE", skipEndless: !0 }
    ),
    setEndlessManual: (m) => g((p) => ko(p.endlessMine, m)),
    setEndlessStrategy: (m) => g((p) => {
      if (!["BALANCED", "AGGRESSIVE", "DEFENSIVE", "BOSS_FOCUS", "RESOURCE_SAVE"].includes(m)) throw new Error("Unknown Endless AI strategy");
      p.endlessMine.strategy = m;
    }),
    setEndlessSpeed: (m) => g((p) => {
      if (![1, 2, 4].includes(m)) throw new Error("Unsupported battle speed");
      p.endlessMine.speed = m;
    }),
    issueEndlessCommand: (m, p) => g((S) => Co(S.endlessMine, m, p)),
    pauseEndlessMine: () => g((m, p, S) => Do(m.endlessMine, S.now())),
    resumeEndlessMine: () => g((m, p, S) => Oo(m.endlessMine, S.now())),
    claimEndlessMine: () => g((m) => {
      const p = Po(m.endlessMine);
      return m.inventory.currencies.credits = Math.min(Number.MAX_SAFE_INTEGER, m.inventory.currencies.credits + p.credits), m.inventory.currencies.upgradeDust = Math.min(Number.MAX_SAFE_INTEGER, m.inventory.currencies.upgradeDust + p.upgradeDust), m.statistics.highestInfiniteFloor = Math.max(m.statistics.highestInfiniteFloor, p.highestFloor), p;
    }),
    updateEndlessLootFilter: (m) => g((p) => $o(p.endlessMine, m)),
    salvageEndlessEquipment: (m) => g((p) => So(p.endlessMine.equipment, m).materialsGained),
    equipEndlessEquipment: (m, p) => g((S) => {
      const M = b(S, p), w = S.endlessMine.equipment.items.findIndex((q) => q.id === m), T = S.endlessMine.equipment.items[w];
      if (!T) throw new Error("Endless equipment not found");
      const x = M.equipment[T.slot], $ = { COMMON: "NORMAL", UNCOMMON: "RARE", RARE: "SR", EPIC: "SSR", LEGENDARY: "UR", MYTHIC: "LEGENDARY" }, F = { maxHp: "maxHp", attack: "power", defense: "defense", speed: "speed", accuracy: "purity", resistance: "hardness", critChance: "resonance", critDamage: "power", breakPower: "resonance", ultimateStart: "resonance" };
      if (M.equipment[T.slot] = {
        instanceId: T.id,
        definitionId: `${T.setId ?? "FIELD"}_${T.slot}`,
        slot: T.slot,
        level: T.level,
        rarity: $[T.rarity],
        setId: T.setId,
        locked: T.locked,
        affixes: T.affixes.map((q) => ({
          stat: F[q.stat],
          operation: ["maxHp", "attack", "defense"].includes(q.stat) ? "FLAT" : "PERCENT",
          value: q.value,
          sourceStat: q.stat
        }))
      }, S.endlessMine.equipment.items.splice(w, 1), x) {
        const q = $n(x);
        Pt(S.endlessMine.equipment, q, { autoSalvage: !1 }), delete S.inventory.equipment[x.instanceId];
      }
      M.stats = Le(M);
    }),
    unequipEndlessEquipment: (m, p) => g((S) => {
      const M = b(S, p), w = Object.keys(M.equipment).find((x) => M.equipment[x]?.instanceId === m);
      if (!w) throw new Error("Equipped item was not found on this Stone");
      const T = M.equipment[w];
      if (!T) throw new Error("Equipped item was not found on this Stone");
      if (S.endlessMine.equipment.items.length >= S.endlessMine.equipment.capacity)
        throw new Error("Equipment storage is full; salvage an item before unequipping");
      Pt(S.endlessMine.equipment, $n(T), { autoSalvage: !1 }), delete M.equipment[w], delete S.inventory.equipment[T.instanceId], M.stats = Le(M);
    }),
    setEndlessEquipmentLocked: (m, p) => g((S) => {
      const M = S.endlessMine.equipment.items.find((w) => w.id === m);
      if (M) {
        M.locked = p;
        return;
      }
      for (const w of Object.values(S.stones)) {
        const T = Object.values(w.equipment).find((x) => x?.instanceId === m);
        if (T) {
          T.locked = p;
          return;
        }
      }
      throw new Error("Equipment not found");
    }),
    setShowcase: (m) => g((p) => {
      if (m.length > 6 || new Set(m).size !== m.length) throw new Error("Showcase supports up to six unique stones");
      for (const S of m) b(p, S);
      p.profile.showcaseStoneIds = [...m];
    }),
    setRoute: (m, p = null) => t((S) => ({ ...S, route: m, selectedStoneId: p })),
    setFarmSessionActive: (m) => t((p) => ({ ...p, farmSessionActive: m })),
    updateSettings: (m) => g((p) => {
      p.settings = {
        ...p.settings,
        ...m,
        masterVolume: Math.max(0, Math.min(1, m.masterVolume ?? p.settings.masterVolume)),
        musicVolume: Math.max(0, Math.min(1, m.musicVolume ?? p.settings.musicVolume)),
        effectsVolume: Math.max(0, Math.min(1, m.effectsVolume ?? p.settings.effectsVolume)),
        textScale: Math.max(0.8, Math.min(1.5, m.textScale ?? p.settings.textScale))
      };
    }),
    addCurrency: (m, p) => g((S) => {
      if (!S.settings.developerMode) throw new Error("Developer mode is disabled");
      S.inventory.currencies[m] = Math.max(0, S.inventory.currencies[m] + Math.floor(p));
    }),
    createPerfectStone: (m) => g((p, S) => {
      if (!p.settings.developerMode) throw new Error("Developer mode is disabled");
      if (Object.keys(p.stones).length >= p.inventory.capacity) throw new Error("Stone storage is full");
      const M = re[m];
      if (!M) throw new Error("Unknown species");
      const w = ft({ species: M, origin: "EVENT", owner: { accountId: p.account.accountId, username: p.account.username }, rng: S, clock: i, mutation: "PERFECT" });
      return p.stones[w.instanceId] = w, Wt(p, w), p.statistics.mutationCount += 1, rt(p, "STONE_CREATED", { stoneId: w.instanceId, speciesId: w.speciesId, rarity: w.rarity, origin: w.origin }, S, i, `sync_stone_${w.instanceId}`), w.instanceId;
    }),
    queueOnlineEvent: (m, p, S) => g((M, w) => rt(M, m, p, w, i, S)),
    syncOnline: async (m) => {
      const p = Za(n().game, i, 100);
      if (p.length === 0) return { sent: 0, accepted: 0, rejected: 0, remaining: n().game.online.queue.length, connected: n().game.online.connected };
      try {
        const S = await m.pushEvents(p);
        return g((M) => {
          const w = new Set(S.accepted.map((x) => x.eventId)), T = new Map(S.rejected.map((x) => [x.eventId, x]));
          for (const x of S.accepted)
            M.online.processedReceipts.some(($) => $.eventId === x.eventId) || M.online.processedReceipts.push(x);
          return M.online.queue = M.online.queue.filter((x) => {
            if (w.has(x.eventId)) return !1;
            const $ = T.get(x.eventId);
            return $ ? $.retryable ? (Oi(x, i), !0) : !1 : !0;
          }), M.online.connected = !0, M.online.lastSyncedAt = i.now().toISOString(), M.online.processedReceipts.length > 2e3 && M.online.processedReceipts.splice(0, M.online.processedReceipts.length - 2e3), { sent: p.length, accepted: S.accepted.length, rejected: S.rejected.length, remaining: M.online.queue.length, connected: !0 };
        });
      } catch {
        return g((S) => {
          const M = new Set(p.map((w) => w.eventId));
          for (const w of S.online.queue) M.has(w.eventId) && Oi(w, i);
          return S.online.connected = !1, { sent: p.length, accepted: 0, rejected: p.length, remaining: S.online.queue.length, connected: !1 };
        });
      }
    },
    setOnlineConnected: (m) => g((p) => {
      p.online.connected = m;
    }),
    exportSave: () => zr(n().game, i),
    importSave: (m) => {
      const p = je(Bt(m));
      Zt(p, i), r && o(p), y = !1, t((S) => ({ ...S, game: p, persistenceAvailable: s, lastError: null }));
    },
    save: () => {
      try {
        if (y) throw new Error("Corrupt save recovery is write-protected; import a valid save or explicitly reset");
        o(n().game), t((m) => ({ ...m, persistenceAvailable: s, lastError: null }));
      } catch (m) {
        throw t((p) => ({ ...p, persistenceAvailable: s, lastError: m instanceof Error ? m.message : String(m) })), m;
      }
    },
    load: () => {
      if (!r) return !1;
      const m = Wc(r);
      if (!m) return !1;
      const p = je(m);
      return Zt(p, i), a && o(p), t((S) => ({ ...S, game: p, persistenceAvailable: s, lastError: null })), !0;
    },
    resetGame: (m = {}) => {
      const p = Pn({ ...e.newGame, ...m, clock: i });
      r && o(p), y = !1, t((S) => ({ ...S, game: p, persistenceAvailable: s, route: "HOME", selectedStoneId: null, lastError: null }));
    },
    clearError: () => t((m) => ({ ...m, lastError: null }))
  };
}, zc = ra(Kc()), Jc = zc;
Vn.map((e) => e.id);
const qi = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "LEGEND"], Qc = [
  "ENDLESS_FASTEST_CLEAR",
  "ENDLESS_FEWEST_DAMAGE"
], Zc = (e) => Qc.includes(e), el = (e) => typeof globalThis.structuredClone == "function" ? globalThis.structuredClone(e) : JSON.parse(JSON.stringify(e));
class tl {
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
    this.leaderboardSeed = t.seed ?? "stoneverse-mock-online", this.rng = new Ee(this.leaderboardSeed), this.latencyMs = Math.max(0, t.latencyMs ?? 0), this.failureRate = Math.max(0, Math.min(1, t.failureRate ?? 0)), this.now = t.now ?? (() => /* @__PURE__ */ new Date()), this.seedProfiles(n);
  }
  seedProfiles(t) {
    const n = ["Obsidian", "Quartz", "Magma", "Echo", "Prism", "Granite", "Aurora", "Void", "Solar", "Tidal"], i = ["Keeper", "Smith", "Seeker", "Sage", "Rider", "Warden", "Miner", "Pulse", "Core", "Rune"];
    for (let r = 0; r < t; r += 1) {
      const s = `mock_${r.toString().padStart(5, "0")}`, o = this.rng.int(2, 100), a = Math.min(100, Math.max(1, o + this.rng.int(-12, 15))), c = Math.min(qi.length - 1, Math.floor(o / 16)), l = Math.round(o ** 2.35 * (4 + this.rng.next() * 5)), d = Math.min(100, Math.round(o * (0.65 + this.rng.next() * 0.42))), f = Math.min(100, Math.round(o * (0.52 + this.rng.next() * 0.45))), y = {
        lifetimeDamage: Math.round(o ** 3 * (25 + this.rng.next() * 20)),
        bossesDefeated: Math.floor(o * this.rng.next()),
        bestContributionRank: this.rng.int(1, 500)
      }, h = Array.from({ length: this.rng.int(3, 6) }, ($, F) => `${s}_stone_${F}`), u = Math.max(1, Math.round(o ** 1.42 * (1.1 + this.rng.next()))), I = Math.min(u, Math.max(1, Math.round(u * (0.35 + this.rng.next() * 0.62)))), g = this.rng.int(0, 3), b = Math.round(o * (2 + this.rng.next() * 9)), R = y.bossesDefeated + Math.floor(u / 10), m = Math.round(o ** 1.55 * (1 + this.rng.next() * 2)), p = Math.round(o ** 2.12 * (18 + this.rng.next() * 12)), S = this.rng.int(0, Math.min(3, h.length)), M = this.rng.int(0, Math.max(0, Math.floor(o / 18))), w = this.rng.int(0, Math.max(1, Math.floor(o / 5))), T = Math.max(8, Math.round(245 - o * 1.65 + this.rng.next() * 42)), x = Math.max(0, Math.round((105 - o) * 82 + this.rng.next() * 1200));
      this.profiles.set(s, {
        accountId: s,
        username: `${this.rng.pick(n)}${this.rng.pick(i)}${r + 1}`,
        avatarId: `avatar_${this.rng.int(1, 12)}`,
        frameId: `frame_${c}`,
        titleId: `title_${this.rng.int(1, 20)}`,
        accountLevel: o,
        miningLevel: a,
        totalMined: l,
        collectionPercent: d,
        achievementPercent: f,
        arenaTier: qi[c] ?? "BRONZE",
        arenaRating: 800 + c * 430 + this.rng.int(0, 420),
        raidStats: y,
        showcaseStoneIds: h,
        lastOnlineAt: new Date(this.now().getTime() - this.rng.int(0, 14 * 864e5)).toISOString(),
        highestEndlessFloor: u,
        weeklyHighestEndlessFloor: I,
        currentExpeditionCount: g,
        expeditionCount: b,
        expeditionScore: b * 100 + I * 25,
        bossKills: R,
        battleWins: m,
        battlePower: p,
        bestTeamStoneIds: [...h],
        favoriteStoneIds: h.slice(0, S),
        favoriteStoneCount: S,
        perfectStoneCount: M,
        mutationCollectionCount: w,
        fastestEndlessClearTurns: T,
        fewestEndlessDamage: x
      });
    }
  }
  async delay() {
    if (this.latencyMs > 0 && await new Promise((t) => setTimeout(t, this.latencyMs)), this.rng.chance(this.failureRate)) throw new Error("Mock network is unavailable");
  }
  rejectReason(t) {
    if (!t.eventId || !t.sessionId || !t.accountId) return { reason: "Malformed event identity", retryable: !1 };
    const n = new Date(t.timestamp).getTime(), i = n - this.now().getTime();
    if (!Number.isFinite(n) || i > 5 * 6e4 || i < -30 * 864e5) return { reason: "Timestamp outside authority window", retryable: !1 };
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
    const n = [], i = [];
    for (const r of t) {
      const s = this.receipts.get(r.eventId);
      if (s) {
        n.push(s);
        continue;
      }
      const o = this.rejectReason(r);
      if (o) {
        i.push({ eventId: r.eventId, ...o });
        continue;
      }
      const a = this.authority.get(r.accountId) ?? { lastSequenceBySession: {}, totalMining: 0, battleWins: 0, fusionCount: 0 };
      a.lastSequenceBySession[r.sessionId] = r.sequence, r.kind === "MINING_RECORDED" && (a.totalMining += Number(r.payload.amount)), r.kind === "BATTLE_FINISHED" && r.payload.winner === "PLAYER" && (a.battleWins += 1), r.kind === "STONE_FUSED" && (a.fusionCount += 1), this.authority.set(r.accountId, a);
      const c = { eventId: r.eventId, processedAt: this.now().toISOString(), checksum: nn(r) };
      this.receipts.set(r.eventId, c), n.push(c);
    }
    return { accepted: n, rejected: i };
  }
  async getPublicProfile(t) {
    await this.delay();
    const n = this.profiles.get(t);
    return n ? el(n) : null;
  }
  async getLeaderboard(t, n = 100) {
    await this.delay();
    const i = (s) => {
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
    }, r = Zc(t) ? 1 : -1;
    return [...this.profiles.values()].sort((s, o) => (i(s) - i(o)) * r || s.accountId.localeCompare(o.accountId)).slice(0, Math.max(1, Math.min(1e3, n))).map((s, o) => {
      const a = Number.parseInt(nn([this.leaderboardSeed, t, s.accountId]), 16) % 7 - 3;
      return {
        rank: o + 1,
        previousRank: Math.max(1, o + 1 + a),
        accountId: s.accountId,
        username: s.username,
        avatarId: s.avatarId,
        frameId: s.frameId,
        titleId: s.titleId,
        value: i(s)
      };
    });
  }
}
const nl = (e) => e == null || typeof e != "object" ? e : typeof globalThis.structuredClone == "function" ? globalThis.structuredClone(e) : JSON.parse(JSON.stringify(e));
class il {
  listeners = /* @__PURE__ */ new Map();
  on(t, n) {
    const i = this.listeners.get(t) ?? /* @__PURE__ */ new Set();
    return i.add(n), this.listeners.set(t, i), () => this.off(t, n);
  }
  once(t, n) {
    const i = this.on(t, (r) => {
      i(), n(r);
    });
    return i;
  }
  off(t, n) {
    const i = this.listeners.get(t);
    i?.delete(n), i?.size === 0 && this.listeners.delete(t);
  }
  emit(t, n) {
    for (const i of [...this.listeners.get(t) ?? []])
      try {
        i(nl(n));
      } catch (r) {
        t !== "error" && this.emit("error", { operation: `event:${t}`, message: r instanceof Error ? r.message : String(r), cause: r });
      }
  }
  clear() {
    this.listeners.clear();
  }
}
const rl = (e) => {
  const t = Object.values(e.stones), i = (e.parties.find((l) => l.id === e.activePartyId) ?? e.parties[0])?.slots.map((l) => l.stoneId).filter((l) => !!e.stones[l]) ?? [], r = i.reduce((l, d) => {
    const f = e.stones[d];
    return f ? l + Math.round(f.stats.power * 1.9 + f.stats.defense * 1.45 + f.stats.speed * 1.15 + f.stats.resonance * 1.25 + f.stats.maxHp * 0.18) : l;
  }, 0), s = Object.values(e.collection.mutationSpecies).reduce((l, d) => l + d.filter((f) => f !== "NONE").length, 0), o = Object.values(e.expeditions.runs).filter((l) => l.status === "ACTIVE").length, a = Math.max(e.endlessMine.highestFloor, e.statistics.highestInfiniteFloor), c = e.account.raidStats.bossesDefeated + Math.floor(a / 10);
  return {
    accountId: e.account.accountId,
    username: e.account.username,
    avatarId: e.account.avatarId,
    frameId: e.account.profileFrameId,
    titleId: e.account.equippedTitleId,
    accountLevel: e.accountProgress.level,
    miningLevel: e.mining.level,
    totalMined: e.mining.totalMined,
    collectionPercent: wt.length === 0 ? 0 : Math.round(e.collection.discoveredSpeciesIds.length / wt.length * 100),
    achievementPercent: Object.values(e.achievements).length === 0 ? 0 : Math.round(Object.values(e.achievements).filter((l) => l.unlockedAt).length / Object.values(e.achievements).length * 100),
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
    bossKills: c,
    battleWins: e.statistics.battleWins,
    battlePower: r,
    bestTeamStoneIds: i,
    favoriteStoneIds: [...e.profile.favoriteStoneIds],
    favoriteStoneCount: t.filter((l) => l.favorite).length,
    perfectStoneCount: t.filter((l) => mn(l.individualValues)).length,
    mutationCollectionCount: s,
    // The current save schema does not retain authoritative weekly Endless
    // clear-turn and damage totals, so own profiles explicitly remain unmeasured.
    fastestEndlessClearTurns: null,
    fewestEndlessDamage: null
  };
}, Ln = (e) => e == null || typeof e != "object" ? e : typeof globalThis.structuredClone == "function" ? globalThis.structuredClone(e) : JSON.parse(JSON.stringify(e)), sl = (e = {}) => {
  const t = e.store ?? Jc, n = e.online === void 0 ? new tl() : e.online, i = e.events ?? new il(), r = (h, u) => {
    for (const [I, g] of Object.entries(u.achievements))
      g.unlockedAt && !h.achievements[I]?.unlockedAt && i.emit("achievement:unlocked", { achievementId: I });
  }, s = (h) => je(h).endlessMine, o = (h) => ({
    xp: h.xp,
    level: h.level,
    unlockedRewardIds: [...h.unlockedRewardIds]
  }), a = (h, u) => !h || h.xp !== u.xp || h.level !== u.level || h.unlockedRewardIds.length !== u.unlockedRewardIds.length || h.unlockedRewardIds.some((I, g) => I !== u.unlockedRewardIds[g]), c = (h, u) => h.minRarity === u.minRarity && h.minScore === u.minScore && h.autoSalvage === u.autoSalvage && (h.allowedSlots ?? []).join("|") === (u.allowedSlots ?? []).join("|") && (h.alwaysKeepSets ?? []).join("|") === (u.alwaysKeepSets ?? []).join("|"), l = (h, u, I) => {
    for (const [T, x] of Object.entries(I.expeditions.runs)) {
      const $ = u.expeditions.runs[T];
      $ && x.completedCycles > $.completedCycles && i.emit("expedition:completed", {
        expedition: x,
        previousCompletedCycles: $.completedCycles,
        cyclesCompleted: x.completedCycles - $.completedCycles
      });
      const F = new Set($?.expeditionStorage.rareDiscoveries.map((q) => q.discoveryId) ?? []);
      for (const q of x.expeditionStorage.rareDiscoveries)
        F.has(q.discoveryId) || i.emit("expedition:rareDiscovered", { expeditionId: T, discovery: q });
    }
    const g = u.research.slot;
    if (g?.status === "ACTIVE") {
      const T = I.research.slot?.researchId === g.researchId ? I.research.slot : null;
      T?.status === "READY" ? i.emit("research:completed", T) : I.research.claimLedger[g.researchId] && i.emit("research:completed", { ...g, status: "READY", claimedAt: null });
    }
    const b = I.idle.lastWelcomeBack;
    b && b.summaryId !== u.idle.lastWelcomeBack?.summaryId && i.emit("idle:processed", b);
    const R = u.endlessMine, m = I.endlessMine, p = R.run, S = m.run, M = !!(S && m.runId && m.runId === R.runId);
    if (m.runId && m.runId !== R.runId && i.emit("endless:started", s(I)), M && S && p) {
      const T = Math.max(0, S.battles - p.battles), x = Math.max(0, S.highestClearedFloor - p.highestClearedFloor), $ = Math.max(0, m.pendingCredits - R.pendingCredits), F = new Set(R.equipment.items.map((Y) => Y.id)), q = m.equipment.items.filter((Y) => !F.has(Y.id)).map((Y) => Y.id);
      if ((T > 0 || x > 0 || $ > 0 || q.length > 0) && i.emit("endless:advanced", {
        runId: m.runId,
        previousFloor: p.currentFloor,
        floor: S.currentFloor,
        attemptedFloors: T,
        clearedFloors: x,
        creditsGained: $,
        bossesCleared: Math.max(0, S.clearedBosses - p.clearedBosses),
        equipmentAddedIds: q,
        state: s(I)
      }), R.status === "RUNNING" && m.status === "PAUSED" && i.emit("endless:paused", s(I)), (R.status === "PAUSED" || R.status === "ENDED") && m.status === "RUNNING" && i.emit("endless:resumed", s(I)), R.status !== "ENDED" && m.status === "ENDED") {
        const Y = S.status === "DEFEATED" ? "DEFEATED" : S.status === "COMPLETE" ? "COMPLETE" : "CLAIMED";
        i.emit("endless:finished", { runId: m.runId, reason: Y, state: s(I) });
      }
    }
    R.manualMode !== m.manualMode && i.emit("endless:manualChanged", { manual: m.manualMode, state: s(I) }), R.strategy !== m.strategy && i.emit("endless:strategyChanged", { strategy: m.strategy, state: s(I) }), R.speed !== m.speed && i.emit("endless:speedChanged", { speed: m.speed, state: s(I) }), c(R.lootFilter, m.lootFilter) || i.emit("endless:lootFilterChanged", { filter: { ...m.lootFilter }, state: s(I) });
    const w = Math.max(0, I.mastery.totalXp - u.mastery.totalXp);
    if (w > 0) {
      const T = (x, $) => Object.entries(x).filter(([F, q]) => a($[F], q)).map(([F, q]) => ({
        id: F,
        previous: $[F] ? o($[F]) : null,
        current: o(q)
      }));
      i.emit("mastery:gained", {
        operation: h,
        xpGained: w,
        totalXp: I.mastery.totalXp,
        stones: T(I.mastery.stones, u.mastery.stones),
        species: T(I.mastery.species, u.mastery.species)
      });
    }
  }, d = (h, u, I) => {
    const g = je(t.getState().game);
    try {
      const b = Ln(u()), R = je(t.getState().game);
      return r(g, R), l(h, g, R), I?.(b, g, R), b;
    } catch (b) {
      throw i.emit("error", { operation: h, message: b instanceof Error ? b.message : String(b), cause: b }), b;
    }
  }, f = (h, u = null) => {
    t.getState().setRoute(h, u), i.emit("route:changed", { route: h, selectedStoneId: u });
  }, y = {
    events: i,
    on: (h, u) => i.on(h, u),
    onStoneMined: (h) => d("onStoneMined", () => {
      const u = t.getState().game.mining.level, I = t.getState().mine(h, { farmSessionActive: t.getState().farmSessionActive });
      i.emit("stone:mined", I);
      const g = t.getState().game.mining.level;
      return g > u && i.emit("mining:levelUp", { previousLevel: u, level: g }), I;
    }),
    onFarmSessionStarted: () => {
      const h = t.getState().game;
      return t.getState().farmSessionActive !== !0 && (t.getState().setFarmSessionActive(!0), i.emit("session:started", { sessionId: h.online.sessionId, at: (/* @__PURE__ */ new Date()).toISOString() })), h.online.sessionId;
    },
    onFarmSessionEnded: () => {
      if (t.getState().farmSessionActive !== !0) return;
      const h = t.getState().game;
      t.getState().setFarmSessionActive(!1), i.emit("session:ended", { sessionId: h.online.sessionId, at: (/* @__PURE__ */ new Date()).toISOString() }), t.getState().save();
    },
    syncFarmStatistics: async () => {
      if (!n) return { sent: 0, accepted: 0, rejected: 0, remaining: t.getState().game.online.queue.length, connected: !1 };
      const h = y.getFarmStatistics();
      t.getState().queueOnlineEvent("PROFILE_UPDATED", h, `sync_profile_${h.revision}`);
      const u = await t.getState().syncOnline(n);
      return i.emit("sync:completed", { accepted: u.accepted, rejected: u.rejected, remaining: u.remaining }), u;
    },
    openStoneverse: () => f("HOME"),
    openProfile: () => f("PROFILE"),
    openGacha: () => f("GACHA"),
    openCollection: () => f("COLLECTION"),
    openRanking: () => f("RANKING"),
    openStoneDetail: (h) => {
      if (!t.getState().game.stones[h]) throw new Error("Stone not found");
      f("STONE_DETAIL", h);
    },
    getStoneverseState: () => je(t.getState().game),
    getFarmStatistics: () => {
      const h = t.getState().game;
      return {
        miningLevel: h.mining.level,
        miningXp: h.mining.xp,
        totalMined: h.mining.totalMined,
        dailyMined: h.mining.dailyMined,
        weeklyMined: h.mining.weeklyMined,
        monthlyMined: h.mining.monthlyMined,
        stoneCount: Object.keys(h.stones).length,
        collectionCount: h.collection.discoveredSpeciesIds.length,
        revision: h.revision
      };
    },
    exportStoneverseSave: () => t.getState().exportSave(),
    importStoneverseSave: (h) => d("importStoneverseSave", () => {
      t.getState().importSave(h), i.emit("save:imported", { schemaVersion: t.getState().game.schemaVersion });
    }),
    appraiseStone: (h) => d("appraiseStone", () => {
      const u = t.getState().appraise(h);
      return i.emit("stone:discovered", u), u;
    }),
    pullGacha: (h, u) => d("pullGacha", () => {
      const I = t.getState().pullGacha(h, u);
      return i.emit("gacha:result", I), I;
    }),
    fuseStones: (h, u) => d("fuseStones", () => {
      const I = t.getState().fuse(h, u);
      return i.emit("stone:fused", I), I;
    }),
    trainStone: (h, u) => d("trainStone", () => {
      const I = t.getState().addStoneXp(h, u);
      return I.levelsGained > 0 && i.emit("stone:levelUp", { stone: t.getState().game.stones[h], previousLevel: I.previousLevel, level: I.level }), I;
    }),
    evolveStone: (h, u, I) => d("evolveStone", () => {
      const g = t.getState().evolve(h, u, I);
      i.emit("stone:evolved", g);
    }),
    awakenStone: (h) => d("awakenStone", () => {
      t.getState().awaken(h);
      const u = t.getState().game.stones[h];
      i.emit("stone:awakened", { stone: u, stage: u.awakeningStage });
    }),
    startDungeonBattle: (h, u) => d("startDungeonBattle", () => {
      const I = t.getState().startDungeonBattle(h, u);
      return i.emit("battle:started", I), I;
    }),
    advanceBattle: () => d("advanceBattle", () => {
      const h = !!t.getState().game.activeBattle?.winner, u = t.getState().advanceBattle(), I = t.getState().game.activeBattle;
      return i.emit("battle:turn", { battle: I, actionCount: u.length }), !h && I.winner && i.emit("battle:finished", I), u;
    }),
    issueBattleCommand: (h, u) => d("issueBattleCommand", () => {
      const I = !!t.getState().game.activeBattle?.winner, g = t.getState().issueBattleCommand(h, u), b = t.getState().game.activeBattle;
      return i.emit("battle:turn", { battle: b, actionCount: g.length }), !I && b.winner && i.emit("battle:finished", b), g;
    }),
    setBattleAuto: (h) => d("setBattleAuto", () => (t.getState().setBattleAuto(h), t.getState().game.activeBattle)),
    setBattleSpeed: (h) => d("setBattleSpeed", () => (t.getState().setBattleSpeed(h), t.getState().game.activeBattle)),
    runBattle: () => d("runBattle", () => {
      const h = !!t.getState().game.activeBattle?.winner, u = t.getState().runActiveBattle();
      return !h && u.winner && i.emit("battle:finished", u), u;
    }),
    abandonBattle: () => d("abandonBattle", () => t.getState().abandonBattle()),
    processBackground: (h) => d("processBackground", () => t.getState().processBackground(h)),
    startExpedition: (h) => d(
      "startExpedition",
      () => t.getState().startExpedition(h),
      (u, I, g) => i.emit("expedition:started", g.expeditions.runs[u.expeditionId] ?? u)
    ),
    stopExpedition: (h) => d(
      "stopExpedition",
      () => t.getState().stopExpedition(h)
    ),
    claimExpedition: (h) => d(
      "claimExpedition",
      () => t.getState().claimExpedition(h),
      (u, I) => {
        const g = new Set(I.expeditions.runs[h]?.expeditionStorage.rareDiscoveries.map((b) => b.discoveryId) ?? []);
        for (const b of u.reward.rareDiscoveries)
          g.has(b.discoveryId) || i.emit("expedition:rareDiscovered", { expeditionId: h, discovery: b });
        i.emit("expedition:claimed", u);
      }
    ),
    claimStoredExpeditionDiscovery: (h) => d(
      "claimStoredExpeditionDiscovery",
      () => t.getState().claimStoredExpeditionDiscovery(h),
      (u, I, g) => i.emit("expedition:discoveryClaimed", {
        discoveryId: h,
        stone: g.stones[u.instanceId] ?? u
      })
    ),
    startTraining: (h) => d(
      "startTraining",
      () => t.getState().startTraining(h),
      (u, I, g) => {
        g.training.assignment && i.emit("training:started", g.training.assignment);
      }
    ),
    claimTraining: () => d(
      "claimTraining",
      () => t.getState().claimTraining(),
      (h, u, I) => {
        const g = I.training.assignment ?? u.training.assignment;
        g && i.emit("training:claimed", { stoneId: g.stoneId, xp: h, assignment: g });
      }
    ),
    stopTraining: () => d(
      "stopTraining",
      () => t.getState().stopTraining(),
      (h, u) => {
        u.training.assignment && i.emit("training:stopped", { stoneId: u.training.assignment.stoneId });
      }
    ),
    startAffinityGarden: (h) => d(
      "startAffinityGarden",
      () => t.getState().startAffinityGarden(h),
      (u, I, g) => {
        g.affinityGarden.assignment && i.emit("affinityGarden:started", g.affinityGarden.assignment);
      }
    ),
    claimAffinityGarden: () => d(
      "claimAffinityGarden",
      () => t.getState().claimAffinityGarden(),
      (h, u, I) => {
        const g = I.affinityGarden.assignment ?? u.affinityGarden.assignment;
        g && i.emit("affinityGarden:claimed", { stoneId: g.stoneId, affinity: h, assignment: g });
      }
    ),
    stopAffinityGarden: () => d(
      "stopAffinityGarden",
      () => t.getState().stopAffinityGarden(),
      (h, u) => {
        u.affinityGarden.assignment && i.emit("affinityGarden:stopped", { stoneId: u.affinityGarden.assignment.stoneId });
      }
    ),
    startResearch: (h) => d(
      "startResearch",
      () => t.getState().startResearch(h),
      (u, I, g) => i.emit("research:started", g.research.slot ?? u)
    ),
    claimResearch: (h) => d(
      "claimResearch",
      () => t.getState().claimResearch(h),
      (u) => i.emit("research:claimed", { researchId: h, ...u })
    ),
    startEndlessMine: (h) => d("startEndlessMine", () => (t.getState().startEndlessMine(h), s(t.getState().game))),
    advanceEndlessMine: (h) => d("advanceEndlessMine", () => t.getState().advanceEndlessMine(h)),
    setEndlessManual: (h) => d("setEndlessManual", () => (t.getState().setEndlessManual(h), s(t.getState().game))),
    setEndlessStrategy: (h) => d("setEndlessStrategy", () => (t.getState().setEndlessStrategy(h), s(t.getState().game))),
    setEndlessSpeed: (h) => d("setEndlessSpeed", () => (t.getState().setEndlessSpeed(h), s(t.getState().game))),
    issueEndlessCommand: (h, u) => d(
      "issueEndlessCommand",
      () => t.getState().issueEndlessCommand(h, u),
      (I, g, b) => i.emit("endless:command", {
        skillId: h,
        targetIds: [...u ?? []],
        settled: I,
        state: s(b)
      })
    ),
    pauseEndlessMine: () => d("pauseEndlessMine", () => (t.getState().pauseEndlessMine(), s(t.getState().game))),
    resumeEndlessMine: () => d("resumeEndlessMine", () => (t.getState().resumeEndlessMine(), s(t.getState().game))),
    claimEndlessMine: () => d(
      "claimEndlessMine",
      () => t.getState().claimEndlessMine(),
      (h) => i.emit("endless:claimed", h)
    ),
    updateEndlessLootFilter: (h) => d("updateEndlessLootFilter", () => (t.getState().updateEndlessLootFilter(h), s(t.getState().game))),
    salvageEndlessEquipment: (h) => d(
      "salvageEndlessEquipment",
      () => t.getState().salvageEndlessEquipment(h),
      (u) => i.emit("endless:equipmentSalvaged", { equipmentId: h, materialsGained: u })
    ),
    equipEndlessEquipment: (h, u) => d(
      "equipEndlessEquipment",
      () => t.getState().equipEndlessEquipment(h, u),
      (I, g, b) => {
        const R = g.endlessMine.equipment.items.find((p) => p.id === h), m = b.stones[u];
        R && m && i.emit("endless:equipmentEquipped", { equipment: R, stone: m });
      }
    ),
    unequipEndlessEquipment: (h, u) => d(
      "unequipEndlessEquipment",
      () => t.getState().unequipEndlessEquipment(h, u),
      () => i.emit("endless:equipmentUnequipped", { equipmentId: h, stoneId: u })
    ),
    setEndlessEquipmentLocked: (h, u) => d(
      "setEndlessEquipmentLocked",
      () => t.getState().setEndlessEquipmentLocked(h, u),
      () => i.emit("endless:equipmentLockChanged", { equipmentId: h, locked: u })
    ),
    getPublicProfile: async (h) => Ln(h === t.getState().game.account.accountId ? rl(t.getState().game) : await (n?.getPublicProfile(h) ?? null)),
    getLeaderboard: async (h, u) => Ln(await (n?.getLeaderboard(h, u) ?? []))
  };
  return y;
}, ol = sl(), pi = 1, Ui = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/, al = (e) => {
  if (!e || typeof e != "object" || Array.isArray(e)) return !1;
  const t = e;
  if (t.type !== "stoneverse.command" || t.protocol !== pi || !Ui.test(t.requestId ?? "") || !Ui.test(t.id ?? "") || !["SESSION_BEGIN", "MINING_SUCCESS", "SESSION_END"].includes(t.command ?? "") || typeof t.timestamp != "string" || !Number.isFinite(Date.parse(t.timestamp))) return !1;
  if (t.command !== "MINING_SUCCESS") return !0;
  const n = t.amount ?? 1, i = t.quality ?? 0.5;
  return Number.isSafeInteger(n) && n >= 1 && n <= 100 && Number.isFinite(i) && i >= 0 && i <= 1 && (t.metadata === void 0 || !!t.metadata && typeof t.metadata == "object" && !Array.isArray(t.metadata) && JSON.stringify(t.metadata).length <= 4096);
}, cl = (e) => {
  let t = null, n = null;
  return (i) => {
    if (!al(i)) return null;
    const r = {
      type: "stoneverse.result",
      protocol: pi,
      requestId: i.requestId,
      command: i.command,
      id: i.id
    };
    try {
      if (i.command === "SESSION_BEGIN") {
        if (t !== null && t !== i.id)
          return { ...r, ok: !1, accepted: !1, duplicate: !1, error: "SESSION_ALREADY_ACTIVE" };
        const o = t === i.id;
        return o || (t = i.id, n = e.onFarmSessionStarted()), { ...r, ok: !0, accepted: !o, duplicate: o };
      }
      if (i.command === "SESSION_END")
        return t === null ? { ...r, ok: !0, accepted: !1, duplicate: !0 } : t !== i.id ? { ...r, ok: !1, accepted: !1, duplicate: !1, error: "SESSION_MISMATCH" } : (e.onFarmSessionEnded(), t = null, n = null, { ...r, ok: !0, accepted: !0, duplicate: !1 });
      if (t === null || n === null)
        return { ...r, ok: !1, accepted: !1, duplicate: !1, error: "SESSION_NOT_ACTIVE" };
      const s = e.onStoneMined({
        eventId: i.id,
        sessionId: n,
        timestamp: i.timestamp,
        areaId: i.areaId,
        veinId: i.veinId,
        amount: i.amount ?? 1,
        quality: i.quality ?? 0.5,
        metadata: i.metadata
      });
      return {
        ...r,
        ok: s.accepted || s.duplicate,
        accepted: s.accepted,
        duplicate: s.duplicate,
        ...s.accepted || s.duplicate ? {} : { error: "MINING_REJECTED" }
      };
    } catch (s) {
      return {
        ...r,
        ok: !1,
        accepted: !1,
        duplicate: !1,
        error: s instanceof Error ? s.message.slice(0, 256) : "STONEVERSE_FAILED"
      };
    }
  };
}, Hi = () => {
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
}, ll = (e = ol) => {
  const t = globalThis, n = t.chrome?.webview;
  if (!n || t.__stoneverseFarmBridgeInstalled) return;
  t.__stoneverseFarmBridgeInstalled = !0;
  const i = cl(e);
  n.addEventListener("message", (s) => {
    const o = i(s.data);
    o && n.postMessage(o);
  });
  const r = e.getStoneverseState();
  n.postMessage({
    type: "stoneverse.ready",
    protocol: pi,
    accountId: r.account.accountId
  }), document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", Hi, { once: !0 }) : Hi();
};
ll();
