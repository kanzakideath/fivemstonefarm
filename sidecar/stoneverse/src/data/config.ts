import type {
  AchievementDefinition,
  DungeonDefinition,
  FusionCatalystDefinition,
  FusionRecipeDefinition,
  GachaBannerDefinition,
  Rarity,
} from '../domain/types';
import { SPECIES } from './species';

export const RARITY_ORDER: Readonly<Record<Rarity, number>> = {
  NORMAL: 0,
  RARE: 1,
  SR: 2,
  SSR: 3,
  UR: 4,
  LEGENDARY: 5,
};

export const RARITY_COLORS: Readonly<Record<Rarity, string>> = {
  NORMAL: '#8f9aa8', RARE: '#4eb9ff', SR: '#9b77ff', SSR: '#ffca5c', UR: '#ff5d86', LEGENDARY: '#fff2ad',
};

export const XP_CURVES = {
  stone: (level: number) => Math.floor(65 + 30 * level + 7.5 * level ** 1.72),
  mining: (level: number) => Math.floor(80 + 55 * level + 14 * level ** 1.55),
  account: (level: number) => Math.floor(120 + 75 * level + 22 * level ** 1.48),
} as const;

export const MINING_AREAS = [
  { id: 'area_greenbreak', name: 'Greenbreak Quarry', unlockLevel: 1, discoveryRate: 0.18, rarityBias: 1, veins: ['vein_common', 'vein_crystal'] },
  { id: 'area_emberdeep', name: 'Emberdeep Caldera', unlockLevel: 12, discoveryRate: 0.21, rarityBias: 1.12, veins: ['vein_volcanic', 'vein_rare'] },
  { id: 'area_skyfault', name: 'Skyfault Shelf', unlockLevel: 25, discoveryRate: 0.23, rarityBias: 1.28, veins: ['vein_aerial', 'vein_special'] },
  { id: 'area_void_rift', name: 'Nocturne Rift', unlockLevel: 45, discoveryRate: 0.25, rarityBias: 1.5, veins: ['vein_void', 'vein_ancient'] },
] as const;

export const FUSION_RECIPES: readonly FusionRecipeDefinition[] = [
  {
    id: 'fusion_ember_quartz', type: 'FIXED', requiredSpecies: ['species_emberite', 'species_quartzling'], parentCount: 2,
    resultSpeciesIds: ['species_prismara'], weight: 1, hidden: false, hint: 'Flame refracted through a clear heart.', minimumLabLevel: 2,
    cost: { currencies: { credits: 1_500, upgradeDust: 120 } },
  },
  {
    id: 'fusion_eclipse', type: 'HIDDEN', requiredSpecies: ['species_quartzling', 'species_solaris'], parentCount: 2,
    resultSpeciesIds: ['species_eclipse_geode'], weight: 1, hidden: true, hint: 'When the purest light meets a crystal in darkness...', minimumLabLevel: 5,
    cost: { currencies: { credits: 8_000, upgradeDust: 600 }, items: { item_eclipse_shard: 1 } },
  },
  {
    id: 'fusion_crystal_family', type: 'FAMILY', requiredFamilies: ['crystal', 'crystal'], parentCount: 2,
    resultSpeciesIds: ['species_quartzling', 'species_aquamarite', 'species_prismara'], weight: 1, hidden: false,
    hint: 'Crystal bloodlines amplify each other.', minimumLabLevel: 1, cost: { currencies: { credits: 900, upgradeDust: 80 } },
  },
  {
    id: 'fusion_fire_crystal', type: 'ELEMENT', requiredElements: ['FIRE', 'CRYSTAL'], parentCount: 2,
    resultSpeciesIds: ['species_emberite', 'species_prismara'], weight: 1, hidden: false,
    hint: 'Fire caught within a prism.', minimumLabLevel: 2, cost: { currencies: { credits: 1_250, upgradeDust: 100 } },
  },
  {
    id: 'fusion_ancient_convergence', type: 'SPECIAL', requiredFamilies: ['igneous', 'crystal', 'metal', 'celestial'], parentCount: 4,
    resultSpeciesIds: ['species_worldheart'], weight: 1, hidden: true, hint: 'Four pillars recall the first mountain.', minimumLabLevel: 8,
    cost: { currencies: { credits: 50_000, researchCores: 20, upgradeDust: 2_500 }, items: { item_primordial_core: 1 } },
  },
] as const;

export const FUSION_CATALYSTS: readonly FusionCatalystDefinition[] = [
  { id: 'catalyst_ember', name: 'Ember Catalyst', requiredLabLevel: 1, elementBias: 'FIRE' },
  { id: 'catalyst_gene_lock', name: 'Gene Seal', requiredLabLevel: 3, traitLockSlots: 1 },
  { id: 'catalyst_iv_lens', name: 'Precision Lens', requiredLabLevel: 4, ivLockStats: ['power', 'speed'] },
  { id: 'catalyst_mutagen', name: 'Prismatic Mutagen', requiredLabLevel: 6, mutationMultiplier: 4, shinyMultiplier: 2 },
  { id: 'catalyst_eclipse', name: 'Eclipse Key', requiredLabLevel: 5, unlockRecipeId: 'fusion_eclipse' },
] as const;

const gachaPool = SPECIES.filter((entry) => entry.gachaWeight > 0).map((entry) => ({
  speciesId: entry.id,
  weight: entry.gachaWeight,
  pickup: entry.id === 'species_solaris' || entry.id === 'species_prismara',
}));

export const GACHA_BANNERS: readonly GachaBannerDefinition[] = [
  {
    id: 'banner_genesis', name: 'Genesis Resonance', pool: gachaPool,
    rates: { NORMAL: 0.48, RARE: 0.3, SR: 0.16, SSR: 0.048, UR: 0.011, LEGENDARY: 0.001 },
    pity: { softStart: 60, hard: 80, featuredGuaranteeAfterLoss: true }, tenPullGuarantee: 'SR',
    singleCost: { currencies: { gachaTickets: 1 } },
  },
] as const;

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'ach_mine_1', name: 'First Resonance', description: 'Mine once.', category: 'MINING', metric: 'MINED', threshold: 1, secret: false, reward: { currencies: { credits: 500 }, accountXp: 40 } },
  { id: 'ach_mine_100', name: 'Quarry Regular', description: 'Mine 100 times.', category: 'MINING', metric: 'MINED', threshold: 100, secret: false, reward: { currencies: { gachaTickets: 3 }, titleId: 'title_quarry_regular', accountXp: 250 } },
  { id: 'ach_collection_5', name: 'Lithic Archivist', description: 'Discover five species.', category: 'COLLECTION', metric: 'SPECIES_OWNED', threshold: 5, secret: false, reward: { currencies: { researchCores: 5 }, accountXp: 180 } },
  { id: 'ach_fusion_1', name: 'Two Become One', description: 'Complete a fusion.', category: 'FUSION', metric: 'FUSIONS', threshold: 1, secret: false, reward: { currencies: { upgradeDust: 250 }, accountXp: 120 } },
  { id: 'ach_fusion_100', name: 'Master Genealogist', description: 'Complete 100 fusions.', category: 'FUSION', metric: 'FUSIONS', threshold: 100, secret: false, reward: { frameId: 'frame_genealogist', titleId: 'title_genealogist', accountXp: 1_000 } },
  { id: 'ach_battle_10', name: 'Unbroken Formation', description: 'Win ten battles.', category: 'BATTLE', metric: 'BATTLE_WINS', threshold: 10, secret: false, reward: { currencies: { credits: 2_000 }, accountXp: 200 } },
  { id: 'ach_gacha_50', name: 'Echo Chaser', description: 'Perform 50 summons.', category: 'GACHA', metric: 'GACHA_PULLS', threshold: 50, secret: false, reward: { currencies: { gachaTickets: 5 }, accountXp: 250 } },
  { id: 'ach_mutation_1', name: 'Impossible Color', description: 'Discover a mutation.', category: 'SECRET', metric: 'MUTATIONS', threshold: 1, secret: true, reward: { titleId: 'title_gene_anomaly', accountXp: 400 } },
  { id: 'ach_perfect_iv', name: 'Flawless Geometry', description: 'Obtain a perfect-IV stone.', category: 'SECRET', metric: 'PERFECT_IV', threshold: 1, secret: true, reward: { frameId: 'frame_perfect', accountXp: 800 } },
  { id: 'ach_level_25', name: 'Stonekeeper', description: 'Reach account level 25.', category: 'PROFILE', metric: 'ACCOUNT_LEVEL', threshold: 25, secret: false, reward: { titleId: 'title_stonekeeper', accountXp: 250 } },
] as const;

export const DUNGEONS: readonly DungeonDefinition[] = [
  {
    id: 'dungeon_echoing_depths', name: 'Echoing Depths', element: 'EARTH', minAccountLevel: 1,
    stages: [
      { id: 'echo_1', name: 'Rumbling Entrance', enemies: [{ id: 'enemy_pebble_a', speciesId: 'species_pebblit', level: 3, statMultiplier: 0.85, skillIds: ['skill_stone_strike'], traitIds: [] }, { id: 'enemy_pebble_b', speciesId: 'species_pebblit', level: 4, statMultiplier: 0.9, skillIds: ['skill_stone_strike'], traitIds: ['trait_dense_core'] }], reward: { currencies: { credits: 180, upgradeDust: 20 }, accountXp: 35, stoneXp: 45 }, firstClearReward: { currencies: { gachaTickets: 1 } }, staminaCost: 4 },
      { id: 'echo_2', name: 'Granite Sentinel', enemies: [{ id: 'enemy_granitus', speciesId: 'species_granitus', level: 10, statMultiplier: 1, skillIds: ['skill_stone_strike', 'skill_bastion'], traitIds: ['trait_dense_core'] }], reward: { currencies: { credits: 300, upgradeDust: 35 }, accountXp: 55, stoneXp: 70 }, firstClearReward: { items: { item_magma_heart: 1 } }, staminaCost: 6 },
    ],
  },
  {
    id: 'dungeon_prismatic_vault', name: 'Prismatic Vault', element: 'CRYSTAL', minAccountLevel: 12,
    stages: [
      { id: 'prism_1', name: 'Refracted Hall', enemies: [{ id: 'enemy_quartz', speciesId: 'species_quartzling', level: 18, statMultiplier: 1.15, skillIds: ['skill_stone_strike', 'skill_crystal_mend'], traitIds: ['trait_resonant'] }, { id: 'enemy_zephyr', speciesId: 'species_zephyrite', level: 17, statMultiplier: 1.1, skillIds: ['skill_gale_shard'], traitIds: ['trait_swift_fault'] }], reward: { currencies: { credits: 650, researchCores: 1, upgradeDust: 70 }, accountXp: 120, stoneXp: 150 }, firstClearReward: { items: { item_eclipse_shard: 1 } }, staminaCost: 10 },
    ],
  },
] as const;

export const DUNGEON_BY_ID = Object.freeze(Object.fromEntries(DUNGEONS.map((entry) => [entry.id, entry])));
export const GACHA_BANNER_BY_ID = Object.freeze(Object.fromEntries(GACHA_BANNERS.map((entry) => [entry.id, entry])));
export const CATALYST_BY_ID = Object.freeze(Object.fromEntries(FUSION_CATALYSTS.map((entry) => [entry.id, entry])));

