import type {
  AffinityGardenAssignment,
  AppraisalResult,
  BattleState,
  ExpeditionClaimResult,
  ExpeditionRareDiscovery,
  ExpeditionRun,
  FusionResult,
  GachaPullResult,
  LeaderboardCategory,
  MiningResult,
  ResearchProjectId,
  ResearchSlot,
  StoneInstance,
  StoneverseRoute,
  TrainingAssignment,
  WelcomeBackSummary,
} from '../domain/types';
import type {
  EndlessCampaignState,
  EndlessClaimResult,
  PlayerAiStrategy,
} from '../domain/endlessCampaign';
import type { MasteryEntry } from '../domain/mastery';
import type { EquipmentItem, LootFilter } from '../domain/advanced';

export interface ExpeditionCompletedEvent {
  expedition: ExpeditionRun;
  previousCompletedCycles: number;
  cyclesCompleted: number;
}

export interface ExpeditionRareDiscoveredEvent {
  expeditionId: string;
  discovery: ExpeditionRareDiscovery;
}

export interface ResearchClaimReward {
  projectId: ResearchProjectId;
  researchPoints: number;
  items: Record<string, number>;
}

export interface EndlessAdvancedEvent {
  runId: string;
  previousFloor: number;
  floor: number;
  attemptedFloors: number;
  clearedFloors: number;
  creditsGained: number;
  bossesCleared: number;
  equipmentAddedIds: string[];
  state: EndlessCampaignState;
}

export interface EndlessCommandEvent {
  skillId: string;
  targetIds: string[];
  settled: import('../domain/endlessCampaign').EndlessAdvanceSummary | null;
  state: EndlessCampaignState;
}

export interface EndlessEquipmentEquippedEvent {
  equipment: EquipmentItem;
  stone: StoneInstance;
}

export interface MasteryEntryChange {
  id: string;
  previous: MasteryEntry | null;
  current: MasteryEntry;
}

/**
 * One aggregate notification per public API operation. A background tick may
 * progress several Stones/species, so aggregating prevents notification spam
 * while retaining every changed entry.
 */
export interface MasteryGainedEvent {
  operation: string;
  xpGained: number;
  totalXp: number;
  stones: MasteryEntryChange[];
  species: MasteryEntryChange[];
}

export interface StoneverseEventMap {
  'stone:mined': MiningResult;
  'stone:discovered': AppraisalResult;
  'mining:levelUp': { previousLevel: number; level: number };
  'stone:levelUp': { stone: StoneInstance; previousLevel: number; level: number };
  'stone:affinityUp': { stone: StoneInstance; previousRank: number; rank: number };
  'stone:awakened': { stone: StoneInstance; stage: number };
  'stone:evolved': { stone: StoneInstance; previousSpeciesId: string; evolutionId: string };
  'stone:fused': FusionResult;
  'achievement:unlocked': { achievementId: string };
  'gacha:result': GachaPullResult;
  'rank:changed': { category: LeaderboardCategory; previousRank: number | null; rank: number };
  'battle:started': BattleState;
  'battle:turn': { battle: BattleState; actionCount: number };
  'battle:finished': BattleState;
  'idle:processed': WelcomeBackSummary;
  'expedition:started': ExpeditionRun;
  'expedition:completed': ExpeditionCompletedEvent;
  'expedition:claimed': ExpeditionClaimResult;
  'expedition:rareDiscovered': ExpeditionRareDiscoveredEvent;
  'expedition:discoveryClaimed': { discoveryId: string; stone: StoneInstance };
  'training:started': TrainingAssignment;
  'training:claimed': { stoneId: string; xp: number; assignment: TrainingAssignment };
  'training:stopped': { stoneId: string };
  'affinityGarden:started': AffinityGardenAssignment;
  'affinityGarden:claimed': { stoneId: string; affinity: number; assignment: AffinityGardenAssignment };
  'affinityGarden:stopped': { stoneId: string };
  'research:started': ResearchSlot;
  'research:completed': ResearchSlot;
  'research:claimed': ResearchClaimReward & { researchId: string };
  'endless:started': EndlessCampaignState;
  'endless:advanced': EndlessAdvancedEvent;
  'endless:manualChanged': { manual: boolean; state: EndlessCampaignState };
  'endless:strategyChanged': { strategy: PlayerAiStrategy; state: EndlessCampaignState };
  'endless:speedChanged': { speed: 1 | 2 | 4; state: EndlessCampaignState };
  'endless:command': EndlessCommandEvent;
  'endless:paused': EndlessCampaignState;
  'endless:resumed': EndlessCampaignState;
  'endless:finished': { runId: string; reason: 'DEFEATED' | 'COMPLETE' | 'CLAIMED'; state: EndlessCampaignState };
  'endless:claimed': EndlessClaimResult;
  'endless:lootFilterChanged': { filter: LootFilter; state: EndlessCampaignState };
  'endless:equipmentSalvaged': { equipmentId: string; materialsGained: number };
  'endless:equipmentEquipped': EndlessEquipmentEquippedEvent;
  'endless:equipmentUnequipped': { equipmentId: string; stoneId: string };
  'endless:equipmentLockChanged': { equipmentId: string; locked: boolean };
  'mastery:gained': MasteryGainedEvent;
  'route:changed': { route: StoneverseRoute; selectedStoneId: string | null };
  'save:imported': { schemaVersion: number };
  'sync:completed': { accepted: number; rejected: number; remaining: number };
  'session:started': { sessionId: string; at: string };
  'session:ended': { sessionId: string; at: string };
  'error': { operation: string; message: string; cause?: unknown };
}

export type StoneverseEventName = keyof StoneverseEventMap;
export type EventUnsubscribe = () => void;

const cloneEventPayload = <T,>(payload: T): T => {
  if (payload === null || payload === undefined || typeof payload !== 'object') return payload;
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(payload);
  return JSON.parse(JSON.stringify(payload)) as T;
};

export class StoneverseEventBus {
  private readonly listeners = new Map<StoneverseEventName, Set<(payload: never) => void>>();

  on<K extends StoneverseEventName>(event: K, listener: (payload: StoneverseEventMap[K]) => void): EventUnsubscribe {
    const existing = this.listeners.get(event) ?? new Set();
    existing.add(listener as (payload: never) => void);
    this.listeners.set(event, existing);
    return () => this.off(event, listener);
  }

  once<K extends StoneverseEventName>(event: K, listener: (payload: StoneverseEventMap[K]) => void): EventUnsubscribe {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off<K extends StoneverseEventName>(event: K, listener: (payload: StoneverseEventMap[K]) => void): void {
    const entries = this.listeners.get(event);
    entries?.delete(listener as (payload: never) => void);
    if (entries?.size === 0) this.listeners.delete(event);
  }

  emit<K extends StoneverseEventName>(event: K, payload: StoneverseEventMap[K]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      try { listener(cloneEventPayload(payload) as never); } catch (cause) {
        if (event !== 'error') this.emit('error', { operation: `event:${event}`, message: cause instanceof Error ? cause.message : String(cause), cause });
      }
    }
  }

  clear(): void { this.listeners.clear(); }
}
