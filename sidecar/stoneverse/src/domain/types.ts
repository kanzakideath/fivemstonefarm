/** Core, serialisable contracts for STONEVERSE. No UI or host application types live here. */
import type { EndlessCampaignState } from './endlessCampaign';
import type { MasteryState } from './mastery';
import type { AdvancedBattleState } from './advanced';
export const RARITIES = ['NORMAL', 'RARE', 'SR', 'SSR', 'UR', 'LEGENDARY'] as const;
export type Rarity = (typeof RARITIES)[number];

export const ORIGINS = [
  'NATURAL',
  'GACHA',
  'FUSION',
  'EVOLUTION',
  'RAID',
  'DUNGEON',
  'EXPEDITION',
  'EVENT',
] as const;
export type StoneOrigin = (typeof ORIGINS)[number];

export const ELEMENTS = [
  'NEUTRAL',
  'FIRE',
  'WATER',
  'EARTH',
  'WIND',
  'LIGHT',
  'DARK',
  'CRYSTAL',
  'METAL',
  'ANCIENT',
] as const;
export type Element = (typeof ELEMENTS)[number];

export type StoneRole = 'ATTACK' | 'TANK' | 'SUPPORT' | 'CONTROL';
export type Mutation = 'NONE' | 'PRISMATIC' | 'ANCIENT' | 'CORRUPTED' | 'PERFECT';
export type ColorVariant = 'STANDARD' | 'SHINY' | 'AURORA' | 'OBSIDIAN';
export type StatKey = 'hardness' | 'purity' | 'power' | 'defense' | 'speed' | 'resonance';
export type CombatStatKey = StatKey | 'maxHp';
export type Stats = Record<CombatStatKey, number>;
export type IndividualValues = Record<StatKey, number>;
export type EquipmentSlot = 'CORE' | 'RUNE' | 'RELIC' | 'CHARM';
export type EquipmentSetId = 'BASTION' | 'RESONANCE' | 'HUNTER' | 'ABYSSAL';
export type EquipmentSourceStat = 'maxHp' | 'attack' | 'defense' | 'speed' | 'accuracy' | 'resistance' | 'critChance' | 'critDamage' | 'breakPower';
export type AchievementCategory =
  | 'MINING'
  | 'COLLECTION'
  | 'FUSION'
  | 'BATTLE'
  | 'PVP'
  | 'RAID'
  | 'GACHA'
  | 'AFFINITY'
  | 'PROFILE'
  | 'SECRET';

export interface OwnerIdentity {
  accountId: string;
  username: string;
}

export interface BattleStatistics {
  battles: number;
  wins: number;
  losses: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  criticalHits: number;
  enemiesDefeated: number;
  ultimatesUsed: number;
}

export interface LearnedSkill {
  skillId: string;
  level: number;
  source: 'NATURAL' | 'LEVEL' | 'AWAKENING' | 'FUSION' | 'EQUIPMENT' | 'TREE';
}

export interface EquippedItem {
  instanceId: string;
  definitionId: string;
  slot: EquipmentSlot;
  level: number;
  rarity: Rarity;
  /** Native Endless set identity, retained when bridged into the core loadout. */
  setId?: EquipmentSetId | null;
  affixes: EquipmentAffix[];
  locked: boolean;
}

export interface EquipmentAffix {
  stat: CombatStatKey;
  operation: 'FLAT' | 'PERCENT';
  value: number;
  /** Exact advanced-combat stat before its serialisable core-stat projection. */
  sourceStat?: EquipmentSourceStat;
}

export interface AffinityState {
  points: number;
  rank: number;
  claimedMilestones: number[];
}

export interface LineageRef {
  instanceId: string;
  speciesId: string;
  serialNumber: string;
  nickname: string | null;
  mutation: Mutation;
  colorVariant: ColorVariant;
  traitIds: string[];
}

export interface StoneInstance {
  instanceId: string;
  serialNumber: string;
  speciesId: string;
  name: string;
  nickname: string | null;
  rarity: Rarity;
  origin: StoneOrigin;
  level: number;
  xp: number;
  potential: number;
  personalityId: string;
  primaryElement: Element;
  secondaryElement: Element | null;
  stats: Stats;
  individualValues: IndividualValues;
  traitIds: string[];
  skills: LearnedSkill[];
  skillPoints: number;
  learnedSkillNodes: string[];
  equipment: Partial<Record<EquipmentSlot, EquippedItem>>;
  affinity: AffinityState;
  awakeningStage: number;
  evolutionStage: number;
  reincarnationCount: number;
  limitBreak: number;
  mutation: Mutation;
  colorVariant: ColorVariant;
  parents: LineageRef[];
  grandparents: LineageRef[];
  generation: number;
  originalOwner: OwnerIdentity;
  currentOwner: OwnerIdentity;
  discoverer: OwnerIdentity;
  createdAt: string;
  firstObtainedAt: string;
  appraisedAt: string | null;
  battleStatistics: BattleStatistics;
  favorite: boolean;
  locked: boolean;
  tags: string[];
}

export interface UnappraisedFind {
  discoveryId: string;
  seed: string;
  veinId: string;
  areaId: string;
  discoveredAt: string;
  hintedRarity: Rarity;
  sourceEventId: string;
}

export interface BaseStatGrowth {
  base: Stats;
  perLevel: Stats;
}

export interface SkillLearnEntry {
  skillId: string;
  level: number;
  source?: LearnedSkill['source'];
}

export interface EvolutionCondition {
  kind:
    | 'LEVEL'
    | 'AFFINITY'
    | 'BATTLE_COUNT'
    | 'ITEM'
    | 'AREA'
    | 'SKILL'
    | 'FUSION_HISTORY'
    | 'TIME'
    | 'ACHIEVEMENT';
  value: string | number;
  amount?: number;
}

export interface EvolutionDefinition {
  id: string;
  targetSpeciesId: string;
  conditions: EvolutionCondition[];
  hidden: boolean;
  hint: string;
  cost?: InventoryCost;
}

export interface SkillTreeNode {
  id: string;
  branch: 'ATTACK' | 'DEFENSE' | 'SUPPORT' | 'CRITICAL' | 'ELEMENT';
  cost: number;
  prerequisites: string[];
  grantsSkillId?: string;
  statBonus?: Partial<Stats>;
}

export interface StoneSpeciesDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  family: string;
  role: StoneRole;
  primaryElement: Element;
  possibleSecondaryElements: Element[];
  growth: BaseStatGrowth;
  skillPool: SkillLearnEntry[];
  traitPool: string[];
  hiddenTraitPool: string[];
  naturalWeight: number;
  gachaWeight: number;
  minMiningLevel: number;
  evolutions: EvolutionDefinition[];
  skillTree: SkillTreeNode[];
  maxAwakening: number;
}

export interface PersonalityDefinition {
  id: string;
  name: string;
  description: string;
  statMultipliers: Partial<Record<CombatStatKey, number>>;
  aiStyle: 'AGGRESSIVE' | 'DEFENSIVE' | 'SUPPORTIVE' | 'TACTICAL' | 'CHAOTIC';
}

export interface TraitDefinition {
  id: string;
  name: string;
  description: string;
  tier: 'COMMON' | 'RARE' | 'HIDDEN' | 'FUSION_EXCLUSIVE' | 'NATURAL_EXCLUSIVE';
  tags: string[];
  effects: PassiveEffect[];
}

export interface PassiveEffect {
  trigger: 'ALWAYS' | 'BATTLE_START' | 'LOW_HP' | 'ON_HIT' | 'ON_CRIT' | 'TURN_START';
  stat?: CombatStatKey;
  operation?: 'FLAT' | 'PERCENT';
  value?: number;
  element?: Element;
  statusId?: string;
}

export type SkillTarget = 'SELF' | 'ALLY' | 'ALL_ALLIES' | 'ENEMY' | 'ALL_ENEMIES';

export interface SkillEffect {
  type: 'DAMAGE' | 'HEAL' | 'BUFF' | 'DEBUFF' | 'STATUS' | 'SHIELD' | 'ULTIMATE_GAIN';
  power?: number;
  stat?: CombatStatKey;
  value?: number;
  duration?: number;
  chance?: number;
  statusId?: StatusId;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  element: Element;
  target: SkillTarget;
  cooldown: number;
  ultimateCost: number;
  priority: number;
  effects: SkillEffect[];
  tags: string[];
}

export interface InventoryCost {
  currencies?: Partial<Currencies>;
  items?: Record<string, number>;
}

export interface InventoryReward extends InventoryCost {
  accountXp?: number;
  miningXp?: number;
  stoneXp?: number;
}

export interface FusionRecipeDefinition {
  id: string;
  type: 'FIXED' | 'FAMILY' | 'ELEMENT' | 'SPECIAL' | 'HIDDEN';
  requiredSpecies?: string[];
  requiredFamilies?: string[];
  requiredElements?: Element[];
  parentCount: number;
  resultSpeciesIds: string[];
  weight: number;
  hidden: boolean;
  hint: string;
  minimumLabLevel: number;
  cost: InventoryCost;
}

export interface FusionCatalystDefinition {
  id: string;
  name: string;
  requiredLabLevel: number;
  elementBias?: Element;
  traitLockSlots?: number;
  ivLockStats?: StatKey[];
  mutationMultiplier?: number;
  shinyMultiplier?: number;
  unlockRecipeId?: string;
}

export interface GachaPoolEntry {
  speciesId: string;
  weight: number;
  pickup?: boolean;
}

export interface GachaBannerDefinition {
  id: string;
  name: string;
  pool: GachaPoolEntry[];
  rates: Record<Rarity, number>;
  pity: { softStart: number; hard: number; featuredGuaranteeAfterLoss: boolean };
  tenPullGuarantee: Rarity;
  singleCost: InventoryCost;
  activeFrom?: string;
  activeUntil?: string;
}

export interface GachaHistoryEntry {
  id: string;
  bannerId: string;
  stoneId: string;
  rarity: Rarity;
  pullNumber: number;
  pityBefore: number;
  guaranteed: boolean;
  createdAt: string;
}

export interface PityState {
  pullsSinceSsr: number;
  lifetimePulls: number;
  featuredGuaranteed: boolean;
}

export interface GachaState {
  pityByBanner: Record<string, PityState>;
  history: GachaHistoryEntry[];
  rarityCounts: Partial<Record<Rarity, number>>;
}

export interface MiningProgress {
  level: number;
  xp: number;
  totalMined: number;
  dailyMined: number;
  weeklyMined: number;
  monthlyMined: number;
  unlockedAreas: string[];
  unlockedVeins: string[];
  /**
   * Exact, persisted host event IDs. This ledger is intentionally not truncated:
   * accepting a duplicate Farm reward is worse than eventually reaching storage quota,
   * at which point the atomic transaction fails without committing the reward.
   */
  processedFarmEventIds: Record<string, true>;
  lastMinedAt: string | null;
}

export interface AccountProgress {
  level: number;
  xp: number;
  researchPoints: number;
  skillPoints: number;
  selectedSkillNodes: string[];
}

export interface FacilityState {
  fusionLab: number;
  researchLab: number;
  expeditionGuild: number;
}

export const EXPEDITION_STRATEGIES = ['BALANCED', 'COMBAT', 'MINING', 'DISCOVERY', 'SAFE', 'HIGH_RISK', 'EXPERIENCE', 'MATERIALS'] as const;
export type ExpeditionStrategy = (typeof EXPEDITION_STRATEGIES)[number];
export type ExpeditionStatus = 'ACTIVE' | 'READY' | 'CLAIMED';

export interface ExpeditionPartyMemberSnapshot {
  stoneId: string;
  speciesId: string;
  level: number;
  rarity: Rarity;
  primaryElement: Element;
  secondaryElement: Element | null;
  stats: Stats;
  individualValues: IndividualValues;
  skillIds: string[];
  traitIds: string[];
  equipment: EquippedItem[];
  equipmentBonuses: Partial<Stats>;
  mutation: Mutation;
  generation: number;
  lineage: LineageRef[];
  power: number;
  affinityRank: number;
}

export interface ExpeditionRareDiscovery {
  discoveryId: string;
  seed: string;
  speciesId: string;
  veinId: string;
  areaId: string;
  hintedRarity: Rarity;
  sourceEventId: string;
  discoveredAt: string;
}

export interface ExpeditionRewardBundle {
  credits: number;
  upgradeDust: number;
  researchCores: number;
  accountXp: number;
  stoneXpPerMember: number;
  affinityPerMember: number;
  items: Record<string, number>;
  rareDiscoveries: ExpeditionRareDiscovery[];
}

export interface ExpeditionReportEvent {
  reportId: string;
  expeditionId: string;
  cycle: number;
  completedAt: string;
  offsetMs: number;
  kind: 'DEPARTURE' | 'BATTLE' | 'MINING' | 'MATERIAL' | 'EQUIPMENT' | 'DISCOVERY' | 'EVENT' | 'BOSS' | 'RETURN';
  title: string;
  detail: string;
  successScore: number;
  battleWon: boolean | null;
  miningYield: number;
  equipmentDropId: string | null;
  equipmentDropSeed: string | null;
  bestDropRarity: Rarity | null;
  rareDiscoveryCount: number;
  reward: Omit<ExpeditionRewardBundle, 'rareDiscoveries'>;
}

export interface ExpeditionReportSummary {
  battles: number;
  wins: number;
  miningYield: number;
  rareDiscoveries: number;
  equipmentDrops: number;
  bestDropRarity: Rarity | null;
}

export interface ExpeditionRun {
  expeditionId: string;
  regionId: string;
  durationId: string;
  durationMs: number;
  strategy: ExpeditionStrategy;
  partyId: string;
  partySnapshot: ExpeditionPartyMemberSnapshot[];
  seed: string;
  repeat: boolean;
  status: ExpeditionStatus;
  startedAt: string;
  lastSimulatedAt: string;
  nextCompletionAt: string;
  completedCycles: number;
  claimedCycles: number;
  claimCount: number;
  /** Unclaimed rewards accumulated across automatic repeat departures. */
  expeditionStorage: ExpeditionRewardBundle;
  reportEvents: ExpeditionReportEvent[];
  reportSummary: ExpeditionReportSummary;
  lastClaimedAt: string | null;
}

export interface ExpeditionState {
  runs: Record<string, ExpeditionRun>;
  order: string[];
  discoveryStorage: ExpeditionRareDiscovery[];
  overflowDiscarded: number;
  totalCycles: number;
  totalClaims: number;
}

export interface ExpeditionClaimResult {
  expeditionId: string;
  cyclesClaimed: number;
  reward: ExpeditionRewardBundle;
  discoveredStones: StoneInstance[];
  storedDiscoveries: ExpeditionRareDiscovery[];
  reports: ExpeditionReportEvent[];
}

export interface TrainingAssignment {
  stoneId: string;
  assignedAt: string;
  lastProcessedAt: string;
  xpPerHour: number;
  bankedMs: number;
  totalClaimedXp: number;
}

export interface TrainingChamberState {
  assignment: TrainingAssignment | null;
}

export interface AffinityGardenAssignment {
  stoneId: string;
  assignedAt: string;
  lastProcessedAt: string;
  affinityPerHour: number;
  bankedMs: number;
  totalClaimedAffinity: number;
}

export interface AffinityGardenState {
  assignment: AffinityGardenAssignment | null;
}

export type ResearchProjectId = 'GEOLOGY_SURVEY' | 'GENETIC_ARCHIVE' | 'EXPEDITION_LOGISTICS';
export type ResearchStatus = 'ACTIVE' | 'READY' | 'CLAIMED';

export interface ResearchSlot {
  researchId: string;
  projectId: ResearchProjectId;
  seed: string;
  startedAt: string;
  completesAt: string;
  status: ResearchStatus;
  claimedAt: string | null;
}

export interface ResearchState {
  slot: ResearchSlot | null;
  completedProjectIds: ResearchProjectId[];
  claimLedger: Record<string, true>;
}

export interface WelcomeBackSummary {
  summaryId: string;
  from: string;
  to: string;
  elapsedMs: number;
  capped: boolean;
  rollbackDetected: boolean;
  expeditionCycles: number;
  trainingXpReady: number;
  affinityReady: number;
  researchReady: boolean;
  endlessFloors: number;
  endlessCredits: number;
  equipmentAdded: number;
  equipmentSalvaged: number;
  rareDiscoveries: number;
  createdAt: string;
}

export interface TrustedTimeState {
  version: 1;
  trustedNowMs: number;
  wallHighWaterMs: number;
  reconciliationCount: number;
}

export type IdleJobPayload =
  | { kind: 'EXPEDITION'; expeditionId: string }
  | { kind: 'TRAINING'; stoneId: string }
  | { kind: 'AFFINITY_GARDEN'; stoneId: string }
  | { kind: 'RESEARCH'; researchId: string }
  | { kind: 'ENDLESS_MINE'; runId: string };

export interface IdleScheduledJob {
  id: string;
  dueAtMs: number;
  payload: IdleJobPayload;
  repeatEveryMs?: number;
  endAtMs?: number;
  sequence?: number;
}

export interface IdleSchedulerState {
  version: 1;
  jobs: IdleScheduledJob[];
}

export interface IdleState {
  timeCheckpoint: TrustedTimeState;
  scheduler: IdleSchedulerState;
  lastProcessedAt: string;
  lastActiveAt: string;
  lastWelcomeBack: WelcomeBackSummary | null;
}

export interface Currencies {
  credits: number;
  gachaTickets: number;
  researchCores: number;
  upgradeDust: number;
}

export interface InventoryState {
  currencies: Currencies;
  items: Record<string, number>;
  equipment: Record<string, EquippedItem>;
  capacity: number;
}

export interface FusionHistoryEntry {
  id: string;
  parentIds: string[];
  childId: string;
  recipeId: string | null;
  catalystIds: string[];
  inheritedTraits: string[];
  inheritedSkills: string[];
  mutation: Mutation;
  consumeParents: boolean;
  createdAt: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  threshold: number;
  secret: boolean;
  reward: InventoryReward & { titleId?: string; frameId?: string };
}

export type AchievementMetric =
  | 'MINED'
  | 'SPECIES_OWNED'
  | 'FUSIONS'
  | 'BATTLE_WINS'
  | 'GACHA_PULLS'
  | 'MAX_AFFINITY'
  | 'MUTATIONS'
  | 'PERFECT_IV'
  | 'ACCOUNT_LEVEL';

export interface AchievementProgress {
  value: number;
  unlockedAt: string | null;
  claimedAt: string | null;
}

export interface PartySlot {
  stoneId: string;
  position: 'FRONT' | 'BACK' | 'SUPPORT';
}

export interface Party {
  id: string;
  name: string;
  slots: PartySlot[];
  defense: boolean;
}

export type StatusId = 'BURN' | 'POISON' | 'STUN' | 'FRACTURE' | 'REGEN' | 'TAUNT';

export interface BattleStatus {
  id: StatusId;
  turns: number;
  potency: number;
  sourceId: string;
}

export interface BattleModifier {
  stat: CombatStatKey;
  multiplier: number;
  turns: number;
  sourceId: string;
}

export interface BattleUnit {
  unitId: string;
  stoneId: string;
  team: 'PLAYER' | 'ENEMY';
  speciesId: string;
  name: string;
  element: Element;
  role: StoneRole;
  level: number;
  stats: Stats;
  currentHp: number;
  shield: number;
  ultimate: number;
  cooldowns: Record<string, number>;
  statuses: BattleStatus[];
  modifiers: BattleModifier[];
  skillIds: string[];
  traitIds: string[];
  alive: boolean;
}

export interface BattleAction {
  turn: number;
  actorId: string;
  skillId: string;
  targetIds: string[];
  damage: number;
  healing: number;
  /** Per-target detail is present in current battles; optional for migrated battle logs. */
  damageByTarget?: Record<string, number>;
  healingByTarget?: Record<string, number>;
  critical: boolean;
  statusesApplied: StatusId[];
  defeatedIds: string[];
}

export interface BattleState {
  battleId: string;
  mode: 'DUNGEON' | 'INFINITE_MINE' | 'PVP' | 'RAID' | 'SIMULATION';
  dungeonId?: string;
  stageId?: string;
  turn: number;
  units: BattleUnit[];
  actionLog: BattleAction[];
  winner: 'PLAYER' | 'ENEMY' | 'DRAW' | null;
  reward: InventoryReward | null;
  startedAt: string;
  finishedAt: string | null;
  /** Authoritative combat state. Legacy fields above are a settlement/API projection. */
  advanced?: AdvancedBattleState;
  /** Persisted controls so reloads continue the exact same encounter. */
  controlMode?: 'MANUAL' | 'AUTO';
  speed?: 1 | 2 | 4;
}

export interface EnemyDefinition {
  id: string;
  speciesId: string;
  level: number;
  statMultiplier: number;
  skillIds: string[];
  traitIds: string[];
}

export interface DungeonStageDefinition {
  id: string;
  name: string;
  enemies: EnemyDefinition[];
  reward: InventoryReward;
  firstClearReward: InventoryReward;
  staminaCost: number;
}

export interface DungeonDefinition {
  id: string;
  name: string;
  element: Element;
  minAccountLevel: number;
  stages: DungeonStageDefinition[];
}

export type ArenaTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'MASTER' | 'LEGEND';

export type StoneverseRoute =
  | 'HOME'
  | 'COLLECTION'
  | 'STONE_DETAIL'
  | 'FUSION'
  | 'GACHA'
  | 'PARTY'
  | 'BATTLE'
  | 'DUNGEON'
  | 'PROFILE'
  | 'RANKING'
  | 'RESEARCH'
  | 'EXPEDITION'
  | 'ENDLESS_MINE'
  | 'FACILITIES';

export interface RaidStats {
  lifetimeDamage: number;
  bossesDefeated: number;
  bestContributionRank: number | null;
}

export interface StoneAccount {
  accountId: string;
  username: string;
  avatarId: string;
  profileFrameId: string;
  equippedTitleId: string;
  ownedTitleIds: string[];
  ownedFrameIds: string[];
  arenaRating: number;
  arenaTier: ArenaTier;
  highestArenaTier: ArenaTier;
  raidStats: RaidStats;
  createdAt: string;
  lastOnlineAt: string;
}

export interface PublicProfile {
  accountId: string;
  username: string;
  avatarId: string;
  frameId: string;
  titleId: string;
  accountLevel: number;
  miningLevel: number;
  totalMined: number;
  collectionPercent: number;
  achievementPercent: number;
  arenaTier: ArenaTier;
  arenaRating: number;
  raidStats: RaidStats;
  showcaseStoneIds: string[];
  lastOnlineAt: string;
  /** Optional forward-compatible activity fields for public/Mock Online profiles. */
  highestEndlessFloor?: number;
  weeklyHighestEndlessFloor?: number;
  currentExpeditionCount?: number;
  expeditionCount?: number;
  expeditionScore?: number;
  bossKills?: number;
  battleWins?: number;
  battlePower?: number;
  bestTeamStoneIds?: string[];
  favoriteStoneIds?: string[];
  favoriteStoneCount?: number;
  perfectStoneCount?: number;
  mutationCollectionCount?: number;
  /** Null means that this metric has not been measured by an authoritative run yet. */
  fastestEndlessClearTurns?: number | null;
  /** Null means that this metric has not been measured by an authoritative run yet. */
  fewestEndlessDamage?: number | null;
}

export interface ProfileState {
  showcaseStoneIds: string[];
  favoriteStoneIds: string[];
  totalAffinity: number;
  public: boolean;
}

export type LeaderboardCategory =
  | 'TOTAL_MINING'
  | 'DAILY_MINING'
  | 'WEEKLY_MINING'
  | 'MONTHLY_MINING'
  | 'COLLECTION'
  | 'ACHIEVEMENTS'
  | 'PVP'
  | 'RAID'
  | 'RARE_DISCOVERY'
  | 'FUSION'
  | 'ENDLESS_HIGHEST_FLOOR'
  | 'ENDLESS_FASTEST_CLEAR'
  | 'ENDLESS_FEWEST_DAMAGE'
  | 'EXPEDITION_SCORE'
  | 'BOSS_CLEARS'
  | 'BATTLE_POWER';

export interface LeaderboardEntry {
  rank: number;
  previousRank: number | null;
  accountId: string;
  username: string;
  avatarId: string;
  frameId: string;
  titleId: string;
  value: number;
}

export interface CollectionState {
  discoveredSpeciesIds: string[];
  mutationSpecies: Record<string, Mutation[]>;
  variantSpecies: Record<string, ColorVariant[]>;
  origins: Partial<Record<StoneOrigin, number>>;
}

export type OnlineEventKind =
  | 'MINING_RECORDED'
  | 'STONE_CREATED'
  | 'STONE_EVOLVED'
  | 'STONE_FUSED'
  | 'BATTLE_FINISHED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'PROFILE_UPDATED'
  | 'RANK_REQUESTED';

export interface OnlineEvent<T = unknown> {
  eventId: string;
  sessionId: string;
  sequence: number;
  timestamp: string;
  accountId: string;
  kind: OnlineEventKind;
  payload: T;
  attempts: number;
  nextAttemptAt: string;
}

export interface ProcessedEventReceipt {
  eventId: string;
  processedAt: string;
  checksum: string;
}

export interface OnlineState {
  connected: boolean;
  sessionId: string;
  sequence: number;
  queue: OnlineEvent[];
  processedReceipts: ProcessedEventReceipt[];
  lastSyncedAt: string | null;
}

export interface OnlinePushResponse {
  accepted: ProcessedEventReceipt[];
  rejected: Array<{ eventId: string; reason: string; retryable: boolean }>;
}

export interface OnlineTransport {
  pushEvents(events: readonly OnlineEvent[]): Promise<OnlinePushResponse>;
  getPublicProfile(accountId: string): Promise<PublicProfile | null>;
  getLeaderboard(category: LeaderboardCategory, limit?: number): Promise<LeaderboardEntry[]>;
}

export interface OnlineSyncResult {
  sent: number;
  accepted: number;
  rejected: number;
  remaining: number;
  connected: boolean;
}

export interface GameSettings {
  effectQuality: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  reduceMotion: boolean;
  mute: boolean;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  textScale: number;
  developerMode: boolean;
}

export interface GameStatistics {
  fusionCount: number;
  mutationCount: number;
  rareDiscoveryCount: number;
  battleWins: number;
  battleLosses: number;
  highestInfiniteFloor: number;
  totalRaidDamage: number;
}

export interface GameState {
  schemaVersion: number;
  revision: number;
  account: StoneAccount;
  accountProgress: AccountProgress;
  mining: MiningProgress;
  facilities: FacilityState;
  expeditions: ExpeditionState;
  training: TrainingChamberState;
  affinityGarden: AffinityGardenState;
  research: ResearchState;
  idle: IdleState;
  endlessMine: EndlessCampaignState;
  mastery: MasteryState;
  stones: Record<string, StoneInstance>;
  unappraisedFinds: UnappraisedFind[];
  inventory: InventoryState;
  collection: CollectionState;
  fusionHistory: FusionHistoryEntry[];
  gacha: GachaState;
  achievements: Record<string, AchievementProgress>;
  parties: Party[];
  activePartyId: string;
  activeBattle: BattleState | null;
  battleHistory: BattleState[];
  dungeonClears: Record<string, { bestTurns: number; clearCount: number; firstClearedAt: string }>;
  profile: ProfileState;
  statistics: GameStatistics;
  online: OnlineState;
  settings: GameSettings;
  createdAt: string;
  updatedAt: string;
}

export interface MiningPayload {
  eventId: string;
  sessionId?: string;
  timestamp?: string;
  areaId?: string;
  veinId?: string;
  amount?: number;
  quality?: number;
  metadata?: Record<string, unknown>;
}

export interface MiningResult {
  accepted: boolean;
  duplicate: boolean;
  xpGranted: number;
  creditsGranted: number;
  discoveries: UnappraisedFind[];
  miningLevelsGained: number;
}

export interface AppraisalResult {
  stone: StoneInstance;
  isNewSpecies: boolean;
  isNaturalLegendary: boolean;
}

export interface FusionOptions {
  catalystIds?: string[];
  consumeParents?: boolean;
  lockedTraitIds?: string[];
  lockedIvStats?: StatKey[];
}

export interface FusionResult {
  child: StoneInstance;
  history: FusionHistoryEntry;
  recipe: FusionRecipeDefinition | null;
  inheritedTraitIds: string[];
  inheritedSkillIds: string[];
  grandparentInherited: boolean;
}

export interface GachaPullResult {
  stones: StoneInstance[];
  history: GachaHistoryEntry[];
  highestRarity: Rarity;
  pityAfter: PityState;
}

export interface LevelGainResult {
  previousLevel: number;
  level: number;
  xp: number;
  levelsGained: number;
  statIncrease: Partial<Stats>;
}

export interface EvolutionResult {
  previousSpeciesId: string;
  stone: StoneInstance;
  evolutionId: string;
}

export interface Clock {
  now(): Date;
}
