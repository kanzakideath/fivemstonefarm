import type { UiRarity } from './uiTypes';

export interface AdventureStoneView {
  id: string;
  name: string;
  nickname?: string;
  rarity: UiRarity;
  element: string;
  level: number;
  power: number;
  role: string;
  condition?: 'READY' | 'DEPLOYED' | 'RESTING' | 'INJURED';
  hpPercent?: number;
}

export interface AdventureRewardView {
  id: string;
  label: string;
  amount?: number;
  rarity?: UiRarity;
  kind: 'CURRENCY' | 'MATERIAL' | 'ITEM' | 'STONE_XP' | 'ACCOUNT_XP' | 'UNKNOWN';
}

export type ExpeditionStrategy = 'BALANCED' | 'COMBAT' | 'MINING' | 'DISCOVERY' | 'SAFE' | 'HIGH_RISK';

export interface ExpeditionRegionView {
  id: string;
  name: string;
  sector: string;
  summary: string;
  element: string;
  difficulty: number;
  recommendedPower: number;
  durations: number[];
  rareSignalRate: number;
  rewardHints: string[];
  locked?: boolean;
  lockReason?: string;
}

export interface ExpeditionDraftView {
  partyIds: string[];
  regionId: string;
  strategy: ExpeditionStrategy;
  durationMinutes: number;
  endless: boolean;
}

export interface ExpeditionReportEventView {
  id: string;
  atLabel: string;
  title: string;
  description: string;
  type: 'DEPARTURE' | 'DISCOVERY' | 'BATTLE' | 'CACHE' | 'RETURN' | 'RARE_SIGNAL';
  reward?: string;
}

export interface ActiveExpeditionView {
  id: string;
  status: 'ACTIVE' | 'COMPLETE';
  regionId: string;
  partyIds: string[];
  repeat: boolean;
  strategy: ExpeditionStrategy;
  durationLabel: string;
  completedCycles: number;
  progress: number;
  remainingLabel: string;
  elapsedLabel: string;
  returnAtLabel: string;
  report: ExpeditionReportEventView[];
  rewards: AdventureRewardView[];
  summary: {
    battles: number;
    wins: number;
    miningYield: number;
    rareDiscoveries: number;
    equipmentDrops: number;
    bestDropRarity: UiRarity | null;
  };
  rareSignal?: {
    id: string;
    hint: string;
    appraised?: boolean;
    name?: string;
  };
  canClaim: boolean;
  canStop: boolean;
}

export interface ExpeditionViewModel {
  party: AdventureStoneView[];
  regions: ExpeditionRegionView[];
  draft: ExpeditionDraftView;
  runs: ActiveExpeditionView[];
  storedDiscoveries: Array<{
    id: string;
    hint: string;
    sourceLabel: string;
    discoveredAtLabel: string;
  }>;
  /** First occupied slot, retained for compact Home-screen presentation. */
  active?: ActiveExpeditionView;
  availableSlots: number;
  usedSlots: number;
}

export type EndlessStrategy = 'BALANCED' | 'AGGRESSIVE' | 'DEFENSIVE' | 'BOSS_FOCUS' | 'RESOURCE_SAVE';
export type EndlessSpeed = 1 | 2 | 4;

export interface EndlessModifierView {
  id: string;
  name: string;
  description: string;
  tone: 'BOON' | 'HAZARD' | 'ANOMALY';
  stacks?: number;
}

export interface EndlessTurnUnitView {
  id: string;
  name: string;
  side: 'ALLY' | 'ENEMY';
  initiative: number;
  element: string;
  active?: boolean;
  defeated?: boolean;
}

export interface EndlessCommandView {
  id: string;
  label: string;
  description: string;
  keyHint: string;
  costLabel?: string;
  cooldown?: number;
  disabled?: boolean;
}

export interface EndlessEquipmentView {
  id: string;
  name: string;
  slot: string;
  rarity: UiRarity;
  level: number;
  effect: string;
  score?: number;
  setName?: string;
  equippedBy?: string;
  equippedById?: string;
  locked?: boolean;
}

export interface EndlessEquipmentTargetView {
  id: string;
  name: string;
  level: number;
}

export interface EndlessAutoSalvageView {
  enabled: boolean;
  threshold: UiRarity;
  protectFavorites: boolean;
  queuedCount: number;
}

export interface EndlessMineViewModel {
  status: 'READY' | 'RUNNING' | 'PAUSED' | 'ENDED';
  /** A defeated, unclaimed run can continue from its last earned checkpoint. */
  canResumeFromCheckpoint: boolean;
  floor: number;
  bestFloor: number;
  floorProgress: number;
  winStreak: number;
  partyPower: number;
  enemyPower: number;
  encounter?: {
    type: 'BATTLE' | 'MINING' | 'TREASURE' | 'ELITE' | 'REST' | 'RANDOM_EVENT' | 'BOSS';
    label: string;
    description: string;
  };
  resonanceIntegrity?: number;
  modifiers: EndlessModifierView[];
  turnOrder: EndlessTurnUnitView[];
  strategy: EndlessStrategy;
  speed: EndlessSpeed;
  manualMode: boolean;
  commands: EndlessCommandView[];
  equipment: EndlessEquipmentView[];
  /** Inventory occupancy excludes pieces currently equipped by Stones. */
  equipmentInventoryCount?: number;
  equipmentCapacity?: number;
  salvageMaterials?: number;
  equipmentTargets?: EndlessEquipmentTargetView[];
  autoSalvage: EndlessAutoSalvageView;
  battleLog: string[];
  rewardPreview: AdventureRewardView[];
}

export interface IdleReportView {
  id: string;
  awayLabel: string;
  periodLabel: string;
  capped?: boolean;
  rollbackDetected?: boolean;
  expeditionsCompleted: number;
  floorsCleared: number;
  miningCycles: number;
  rewards: AdventureRewardView[];
  stoneProgress: Array<{
    id: string;
    name: string;
    levelBefore: number;
    levelAfter: number;
    xp: number;
    affinity: number;
  }>;
  rareSignal?: {
    id: string;
    hint: string;
  };
}

export type NotificationKind = 'EXPEDITION' | 'DISCOVERY' | 'BATTLE' | 'SYSTEM' | 'REWARD';

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  timeLabel: string;
  read: boolean;
  actionLabel?: string;
}
