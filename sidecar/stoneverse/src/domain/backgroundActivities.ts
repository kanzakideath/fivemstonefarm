import { spendCost } from './economy';
import { makeId, systemClock, type RandomSource } from './rng';
import { gainAffinity } from './stone';
import { gainStoneXpWithMastery } from './mastery';
import { MAX_EXPEDITION_OFFLINE_MS } from './expedition';
import type { Clock, FacilityState, GameState, ResearchProjectId, ResearchSlot } from './types';

const HOUR = 60 * 60 * 1_000;
const MAX_BANKED_MS = MAX_EXPEDITION_OFFLINE_MS;

export interface ResearchProjectDefinition {
  id: ResearchProjectId;
  name: string;
  durationMs: number;
  requiredLabLevel: number;
  prerequisiteProjectId: ResearchProjectId | null;
  coreCost: number;
  researchPoints: number;
  rewardItems: Record<string, number>;
  facilityLevelTargets: FacilityState;
}

export const RESEARCH_PROJECTS: readonly ResearchProjectDefinition[] = [
  {
    id: 'GEOLOGY_SURVEY', name: 'Geology Survey', durationMs: HOUR, requiredLabLevel: 1, prerequisiteProjectId: null,
    coreCost: 1, researchPoints: 45, rewardItems: { research_geology_notes: 1 },
    facilityLevelTargets: { fusionLab: 2, researchLab: 3, expeditionGuild: 3 },
  },
  {
    id: 'GENETIC_ARCHIVE', name: 'Genetic Archive', durationMs: 12 * HOUR, requiredLabLevel: 3, prerequisiteProjectId: 'GEOLOGY_SURVEY',
    coreCost: 4, researchPoints: 240, rewardItems: { research_gene_record: 1 },
    facilityLevelTargets: { fusionLab: 4, researchLab: 5, expeditionGuild: 5 },
  },
  {
    id: 'EXPEDITION_LOGISTICS', name: 'Expedition Logistics', durationMs: 24 * HOUR, requiredLabLevel: 5, prerequisiteProjectId: 'GENETIC_ARCHIVE',
    coreCost: 8, researchPoints: 520, rewardItems: { research_logistics_plan: 1 },
    facilityLevelTargets: { fusionLab: 6, researchLab: 7, expeditionGuild: 7 },
  },
] as const;

const RESEARCH_BY_ID = Object.fromEntries(RESEARCH_PROJECTS.map((entry) => [entry.id, entry])) as Record<ResearchProjectId, ResearchProjectDefinition>;

const validDate = (date: Date): number => {
  const value = date.getTime();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Background activity received an invalid timestamp');
  return value;
};

const saturatingAdd = (left: number, right: number): number => Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(left)) + Math.max(0, Math.floor(right)));

const boundedAccrual = (lastProcessedAt: string, now: Date): number => {
  const previous = Date.parse(lastProcessedAt);
  const current = validDate(now);
  if (!Number.isFinite(previous) || current <= previous) return 0;
  return Math.min(MAX_BANKED_MS, current - previous);
};

const stoneOnExpedition = (state: GameState, stoneId: string): boolean => Object.values(state.expeditions.runs)
  .some((run) => run.status !== 'CLAIMED' && run.partySnapshot.some((member) => member.stoneId === stoneId));

const stoneInEndlessMine = (state: GameState, stoneId: string): boolean =>
  (state.endlessMine.status === 'RUNNING' || state.endlessMine.status === 'PAUSED')
  && state.endlessMine.partyStoneIds.includes(stoneId);

const stoneInActiveBattle = (state: GameState, stoneId: string): boolean =>
  Boolean(state.activeBattle && !state.activeBattle.winner && state.activeBattle.units.some((unit) => unit.team === 'PLAYER' && unit.stoneId === stoneId));

const requireAssignableStone = (state: GameState, stoneId: string, activity: 'training' | 'garden'): void => {
  if (!state.stones[stoneId]) throw new Error(`Stone not found: ${stoneId}`);
  if (stoneOnExpedition(state, stoneId)) throw new Error('A stone on expedition cannot use a background facility');
  if (stoneInEndlessMine(state, stoneId)) throw new Error('A stone in Endless Mine cannot use a background facility');
  if (stoneInActiveBattle(state, stoneId)) throw new Error('A stone in an active battle cannot use a background facility');
  if (activity !== 'training' && state.training.assignment?.stoneId === stoneId) throw new Error('Stone is already training');
  if (activity !== 'garden' && state.affinityGarden.assignment?.stoneId === stoneId) throw new Error('Stone is already in the affinity garden');
};

export const trainingXpReady = (state: GameState): number => {
  const assignment = state.training.assignment;
  return assignment ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(assignment.bankedMs * assignment.xpPerHour / HOUR)) : 0;
};

export const affinityReady = (state: GameState): number => {
  const assignment = state.affinityGarden.assignment;
  return assignment ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(assignment.bankedMs * assignment.affinityPerHour / HOUR)) : 0;
};

export const startTraining = (state: GameState, stoneId: string, now: Date): void => {
  if (state.training.assignment) throw new Error('Training Chamber is occupied');
  requireAssignableStone(state, stoneId, 'training');
  const timestamp = new Date(validDate(now)).toISOString();
  state.training.assignment = {
    stoneId,
    assignedAt: timestamp,
    lastProcessedAt: timestamp,
    xpPerHour: Math.min(10_000, 80 + state.facilities.researchLab * 40),
    bankedMs: 0,
    totalClaimedXp: 0,
  };
};

export const advanceTraining = (state: GameState, now: Date): void => {
  const assignment = state.training.assignment;
  if (!assignment) return;
  assignment.bankedMs = Math.min(MAX_BANKED_MS, saturatingAdd(assignment.bankedMs, boundedAccrual(assignment.lastProcessedAt, now)));
  if (validDate(now) >= Date.parse(assignment.lastProcessedAt)) assignment.lastProcessedAt = now.toISOString();
};

export const claimTraining = (state: GameState, now: Date): number => {
  advanceTraining(state, now);
  const assignment = state.training.assignment;
  if (!assignment) throw new Error('Training Chamber is empty');
  const xp = trainingXpReady(state);
  if (xp <= 0) throw new Error('No Training Chamber XP is ready');
  const stone = state.stones[assignment.stoneId];
  if (!stone) throw new Error('Training stone is missing');
  gainStoneXpWithMastery(stone, state.mastery, xp);
  assignment.bankedMs = 0;
  assignment.totalClaimedXp = saturatingAdd(assignment.totalClaimedXp, xp);
  return xp;
};

export const stopTraining = (state: GameState): void => {
  const assignment = state.training.assignment;
  if (!assignment) return;
  if (trainingXpReady(state) > 0) throw new Error('Claim Training Chamber XP before removing the stone');
  state.training.assignment = null;
};

export const startAffinityGarden = (state: GameState, stoneId: string, now: Date): void => {
  if (state.affinityGarden.assignment) throw new Error('Affinity Garden is occupied');
  requireAssignableStone(state, stoneId, 'garden');
  const timestamp = new Date(validDate(now)).toISOString();
  state.affinityGarden.assignment = {
    stoneId,
    assignedAt: timestamp,
    lastProcessedAt: timestamp,
    affinityPerHour: Math.min(100, 1 + Math.floor(state.accountProgress.level / 10) + Math.floor(state.facilities.researchLab / 3)),
    bankedMs: 0,
    totalClaimedAffinity: 0,
  };
};

export const advanceAffinityGarden = (state: GameState, now: Date): void => {
  const assignment = state.affinityGarden.assignment;
  if (!assignment) return;
  assignment.bankedMs = Math.min(MAX_BANKED_MS, saturatingAdd(assignment.bankedMs, boundedAccrual(assignment.lastProcessedAt, now)));
  if (validDate(now) >= Date.parse(assignment.lastProcessedAt)) assignment.lastProcessedAt = now.toISOString();
};

export const claimAffinityGarden = (state: GameState, now: Date): number => {
  advanceAffinityGarden(state, now);
  const assignment = state.affinityGarden.assignment;
  if (!assignment) throw new Error('Affinity Garden is empty');
  const points = affinityReady(state);
  if (points <= 0) throw new Error('No Affinity Garden reward is ready');
  const stone = state.stones[assignment.stoneId];
  if (!stone) throw new Error('Affinity Garden stone is missing');
  gainAffinity(stone, points);
  assignment.bankedMs = 0;
  assignment.totalClaimedAffinity = saturatingAdd(assignment.totalClaimedAffinity, points);
  state.profile.totalAffinity = Object.values(state.stones).reduce((sum, entry) => saturatingAdd(sum, entry.affinity.points), 0);
  return points;
};

export const stopAffinityGarden = (state: GameState): void => {
  const assignment = state.affinityGarden.assignment;
  if (!assignment) return;
  if (affinityReady(state) > 0) throw new Error('Claim Affinity Garden rewards before removing the stone');
  state.affinityGarden.assignment = null;
};

export const startResearch = (
  state: GameState,
  projectId: ResearchProjectId,
  rng: RandomSource,
  clock: Clock = systemClock,
): ResearchSlot => {
  const project = RESEARCH_BY_ID[projectId];
  if (!project) throw new Error(`Unknown research project: ${projectId}`);
  if (state.research.slot && state.research.slot.status !== 'CLAIMED') throw new Error('Research slot is occupied');
  if (state.research.completedProjectIds.includes(projectId)) throw new Error('Research project is already complete');
  if (project.prerequisiteProjectId && !state.research.completedProjectIds.includes(project.prerequisiteProjectId)) {
    throw new Error(`${RESEARCH_BY_ID[project.prerequisiteProjectId].name} must be completed first`);
  }
  if (state.facilities.researchLab < project.requiredLabLevel) throw new Error(`Research Lab level ${project.requiredLabLevel} required`);
  spendCost(state, { currencies: { researchCores: project.coreCost } });
  const now = clock.now();
  const nowMs = validDate(now);
  const researchId = makeId('research', rng, nowMs);
  const slot: ResearchSlot = {
    researchId,
    projectId,
    seed: `${researchId}:${Math.floor(rng.next() * 0x1_0000_0000).toString(16)}`,
    startedAt: now.toISOString(),
    completesAt: new Date(nowMs + project.durationMs).toISOString(),
    status: 'ACTIVE',
    claimedAt: null,
  };
  state.research.slot = slot;
  return slot;
};

export const advanceResearch = (state: GameState, now: Date): boolean => {
  const slot = state.research.slot;
  if (!slot || slot.status !== 'ACTIVE') return false;
  const nowMs = validDate(now);
  if (nowMs < Date.parse(slot.completesAt)) return false;
  slot.status = 'READY';
  return true;
};

export const claimResearch = (state: GameState, researchId: string, now: Date): { projectId: ResearchProjectId; researchPoints: number; items: Record<string, number> } => {
  if (state.research.claimLedger[researchId]) throw new Error('Research reward was already claimed');
  advanceResearch(state, now);
  const slot = state.research.slot;
  if (!slot || slot.researchId !== researchId) throw new Error('Research slot not found');
  if (slot.status !== 'READY') throw new Error('Research is not complete');
  const project = RESEARCH_BY_ID[slot.projectId];
  state.accountProgress.researchPoints = saturatingAdd(state.accountProgress.researchPoints, project.researchPoints);
  for (const [itemId, amount] of Object.entries(project.rewardItems)) state.inventory.items[itemId] = saturatingAdd(state.inventory.items[itemId] ?? 0, amount);
  for (const facility of ['fusionLab', 'researchLab', 'expeditionGuild'] as const) {
    state.facilities[facility] = Math.max(state.facilities[facility], project.facilityLevelTargets[facility]);
  }
  if (!state.research.completedProjectIds.includes(project.id)) state.research.completedProjectIds.push(project.id);
  state.research.claimLedger[researchId] = true;
  slot.status = 'CLAIMED';
  slot.claimedAt = now.toISOString();
  state.research.slot = null;
  return { projectId: project.id, researchPoints: project.researchPoints, items: { ...project.rewardItems } };
};
