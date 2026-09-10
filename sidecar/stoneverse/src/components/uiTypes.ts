export type UiRarity = 'NORMAL' | 'RARE' | 'SR' | 'SSR' | 'UR' | 'LEGENDARY';

export type UiRoute =
  | 'home'
  | 'expedition'
  | 'endless'
  | 'facilities'
  | 'mine'
  | 'collection'
  | 'gacha'
  | 'fusion'
  | 'battle'
  | 'profile'
  | 'ranking'
  | 'settings';

export type UiStatKey = 'hp' | 'power' | 'defense' | 'speed' | 'resonance';

export interface UiStone {
  id: string;
  speciesId: string;
  name: string;
  nickname: string;
  rarity: UiRarity;
  origin: string;
  element: string;
  secondaryElement?: string;
  level: number;
  xp: number;
  xpNext: number;
  combatPower: number;
  potential: number;
  personality: string;
  affinity: number;
  awakening: number;
  evolution: number;
  generation: number;
  mutation?: string;
  colorVariant?: string;
  favorite: boolean;
  locked: boolean;
  serial: string;
  obtainedAt: string;
  discoverer: string;
  originalOwner: string;
  stats: Record<UiStatKey, number>;
  ivs: Record<UiStatKey, number>;
  traits: string[];
  skills: string[];
  equipment: string[];
  parentIds: string[];
  battleWins: number;
  battleCount: number;
}

export interface UiPlayer {
  id: string;
  username: string;
  title: string;
  accountLevel: number;
  accountXp: number;
  accountXpNext: number;
  miningLevel: number;
  miningXp: number;
  miningXpNext: number;
  totalMined: number;
  collectionRate: number;
  achievementRate: number;
  arenaRank: string;
  currency: number;
  tickets: number;
  research: number;
  streak: number;
}

export interface UiMission {
  id: string;
  label: string;
  detail: string;
  current: number;
  goal: number;
  reward: string;
  complete: boolean;
}

export interface UiMiningResult {
  id: string;
  timestamp: number;
  area: string;
  material: string;
  amount: number;
  xp: number;
  quality: 'common' | 'rich' | 'rare' | 'anomaly';
  unappraised?: boolean;
  stone?: UiStone;
  appraised: boolean;
}

export interface UiRankingEntry {
  rank: number;
  id: string;
  name: string;
  title: string;
  score: number;
  level: number;
  stone?: UiStone;
  isPlayer?: boolean;
  delta?: number;
}

export interface UiBattleFighter {
  unitId?: string;
  stone: UiStone;
  hp: number;
  maxHp: number;
  ultimate: number;
  status: string[];
}

export interface UiBattleFrame {
  turn: number;
  allies: UiBattleFighter[];
  enemies: UiBattleFighter[];
  activeId?: string;
  targetId?: string;
  lastDamage?: number;
}

export interface UiBattleCommand {
  id: string;
  name: string;
  cooldown: number;
  ultimateCost: number;
  disabled: boolean;
  target: string;
}

export interface UiBattleTurnEntry {
  id: string;
  name: string;
  side: 'PLAYER' | 'ENEMY';
  speed: number;
  active: boolean;
}

export interface UiBattleState {
  phase: 'idle' | 'running' | 'victory' | 'defeat' | 'draw';
  turn: number;
  allies: UiBattleFighter[];
  enemies: UiBattleFighter[];
  log: string[];
  activeId?: string;
  targetId?: string;
  lastDamage?: number;
  reward?: string;
  /** Initial state plus one snapshot per action for the presentation replay. */
  frames?: UiBattleFrame[];
  commandActorId?: string;
  commands?: UiBattleCommand[];
  turnOrder?: UiBattleTurnEntry[];
  manualMode?: boolean;
  speed?: 1 | 2 | 4;
}

export interface UiSettings {
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  textScale: number;
  effectQuality: 'LOW' | 'MEDIUM' | 'HIGH';
  highContrast: boolean;
  developerMode: boolean;
}
