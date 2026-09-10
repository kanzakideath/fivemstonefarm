import { BackgroundScheduler } from './backgroundScheduler';
import {
  advanceAffinityGarden,
  advanceResearch,
  advanceTraining,
  affinityReady,
  trainingXpReady,
} from './backgroundActivities';
import { advanceExpeditions, MAX_EXPEDITION_OFFLINE_MS, MAX_PENDING_RARE_DISCOVERIES } from './expedition';
import { createTrustedTimeCheckpoint, reconcileTrustedTime } from './timeProvider';
import { advanceEndlessAuto, ENDLESS_FLOOR_INTERVAL_MS, processEndlessOffline } from './endlessCampaign';
import type { Clock, GameState, IdleJobPayload, IdleState, WelcomeBackSummary } from './types';

const FIFTEEN_MINUTES = 15 * 60 * 1_000;
const MAX_CALLBACKS = 64;
const MAX_ACTIVE_ENDLESS_FLOORS_PER_WAKE = 16;

export type IdleProcessingMode = 'ACTIVE' | 'OFFLINE';
export interface IdleProcessingOptions {
  mode?: IdleProcessingMode;
  /** Used by the explicit time-gated Endless action to avoid consuming its own job first. */
  skipEndless?: boolean;
}

const validTimestamp = (value: string, label: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} is not a valid timestamp`);
  return parsed;
};

export const createIdleState = (anchor: Date): IdleState => {
  const anchorMs = anchor.getTime();
  if (!Number.isSafeInteger(anchorMs) || anchorMs < 0) throw new Error('Idle anchor is invalid');
  return {
    timeCheckpoint: createTrustedTimeCheckpoint(anchorMs),
    scheduler: { version: 1, jobs: [] },
    lastProcessedAt: anchor.toISOString(),
    lastActiveAt: anchor.toISOString(),
    lastWelcomeBack: null,
  };
};

const desiredJobs = (state: GameState) => {
  const jobs: Array<{ id: string; dueAtMs: number; payload: IdleJobPayload }> = [];
  for (const run of Object.values(state.expeditions.runs)) {
    // A full discovery mailbox is an explicit backpressure state. It is woken
    // by the claim transaction, not a permanently overdue zero-delay timer.
    if (run.status === 'ACTIVE' && run.expeditionStorage.rareDiscoveries.length < MAX_PENDING_RARE_DISCOVERIES) jobs.push({
      id: `expedition:${run.expeditionId}`,
      dueAtMs: validTimestamp(run.nextCompletionAt, 'expedition.nextCompletionAt'),
      payload: { kind: 'EXPEDITION', expeditionId: run.expeditionId },
    });
  }
  if (state.training.assignment) jobs.push({
    id: `training:${state.training.assignment.stoneId}`,
    dueAtMs: validTimestamp(state.training.assignment.lastProcessedAt, 'training.lastProcessedAt') + FIFTEEN_MINUTES,
    payload: { kind: 'TRAINING', stoneId: state.training.assignment.stoneId },
  });
  if (state.affinityGarden.assignment) jobs.push({
    id: `affinity-garden:${state.affinityGarden.assignment.stoneId}`,
    dueAtMs: validTimestamp(state.affinityGarden.assignment.lastProcessedAt, 'affinityGarden.lastProcessedAt') + FIFTEEN_MINUTES,
    payload: { kind: 'AFFINITY_GARDEN', stoneId: state.affinityGarden.assignment.stoneId },
  });
  if (state.research.slot?.status === 'ACTIVE') jobs.push({
    id: `research:${state.research.slot.researchId}`,
    dueAtMs: validTimestamp(state.research.slot.completesAt, 'research.completesAt'),
    payload: { kind: 'RESEARCH', researchId: state.research.slot.researchId },
  });
  if (state.endlessMine.status === 'RUNNING' && state.endlessMine.runId && state.endlessMine.nextFloorAt && !state.endlessMine.manualMode) jobs.push({
    id: `endless-mine:${state.endlessMine.runId}`,
    dueAtMs: validTimestamp(state.endlessMine.nextFloorAt, 'endlessMine.nextFloorAt'),
    payload: { kind: 'ENDLESS_MINE', runId: state.endlessMine.runId },
  });
  return jobs;
};

/** Reconciles the persisted event queue with active domain jobs without polling. */
export const refreshBackgroundSchedule = (state: GameState): number | null => {
  const scheduler = new BackgroundScheduler<IdleJobPayload>(state.idle.scheduler);
  const expected = new Set<string>();
  for (const job of desiredJobs(state)) {
    expected.add(job.id);
    scheduler.upsert(job);
  }
  for (const job of scheduler.snapshot().jobs) if (!expected.has(job.id)) scheduler.cancel(job.id);
  const snapshot = scheduler.snapshot();
  state.idle.scheduler = { version: 1, jobs: snapshot.jobs.map((job) => ({ ...job })) };
  return scheduler.nextDueAtMs();
};

export const nextBackgroundDueAt = (state: GameState): string | null => {
  const dueAt = refreshBackgroundSchedule(state);
  return dueAt === null ? null : new Date(dueAt).toISOString();
};

/**
 * Processes work only when a persisted job is due. The supplied Clock is treated
 * as untrusted wall time and reconciled against the save's high-water checkpoint.
 */
export const processIdleState = (state: GameState, wallClock: Clock, options: IdleProcessingOptions = {}): WelcomeBackSummary | null => {
  const mode = options.mode ?? 'OFFLINE';
  const wallNow = wallClock.now().getTime();
  const sample = reconcileTrustedTime(state.idle.timeCheckpoint, wallNow, { maxForwardAdvanceMs: MAX_EXPEDITION_OFFLINE_MS });
  state.idle.timeCheckpoint = { ...sample.checkpoint };
  const trustedNow = new Date(sample.nowMs);
  const previousProcessedMs = validTimestamp(state.idle.lastProcessedAt, 'idle.lastProcessedAt');
  const elapsedMs = Math.max(0, Math.min(MAX_EXPEDITION_OFFLINE_MS, sample.nowMs - previousProcessedMs));
  refreshBackgroundSchedule(state);
  const scheduler = new BackgroundScheduler<IdleJobPayload>(state.idle.scheduler);
  let expeditionCycles = 0;
  let endlessFloors = 0;
  let endlessCredits = 0;
  let equipmentAdded = 0;
  let equipmentSalvaged = 0;
  let rareDiscoveries = 0;
  const trainingReadyBefore = trainingXpReady(state);
  const affinityReadyBefore = affinityReady(state);
  let processingCapped = sample.anomaly === 'forward-capped';
  const result = scheduler.drainDue(sample.nowMs, (delivery) => {
    switch (delivery.payload.kind) {
      case 'EXPEDITION': {
        const advanced = advanceExpeditions(state, trustedNow);
        expeditionCycles += advanced.cyclesProcessed;
        rareDiscoveries += advanced.reports.reduce((sum, report) => sum + report.rareDiscoveryCount, 0);
        processingCapped ||= advanced.capped;
        break;
      }
      case 'TRAINING': advanceTraining(state, trustedNow); break;
      case 'AFFINITY_GARDEN': advanceAffinityGarden(state, trustedNow); break;
      case 'RESEARCH': advanceResearch(state, trustedNow); break;
      case 'ENDLESS_MINE': {
        if (state.endlessMine.runId !== delivery.payload.runId) break;
        if (options.skipEndless) break;
        const nextDueMs = Date.parse(state.endlessMine.nextFloorAt ?? '');
        const dueFloors = Number.isFinite(nextDueMs) && sample.nowMs >= nextDueMs
          ? Math.floor((sample.nowMs - nextDueMs) / ENDLESS_FLOOR_INTERVAL_MS) + 1
          : 0;
        const advanced = mode === 'ACTIVE'
          ? advanceEndlessAuto(state.endlessMine, Math.min(MAX_ACTIVE_ENDLESS_FLOORS_PER_WAKE, dueFloors), trustedNow)
          : processEndlessOffline(state.endlessMine, trustedNow);
        endlessFloors += advanced.clearedFloors;
        endlessCredits += advanced.credits;
        equipmentAdded += advanced.equipmentAdded;
        equipmentSalvaged += advanced.equipmentSalvaged;
        break;
      }
    }
  }, { maxCallbacks: MAX_CALLBACKS, maxOccurrencesPerCallback: 128, maxCatchUpMs: MAX_EXPEDITION_OFFLINE_MS });
  processingCapped ||= result.hasMoreDue || result.skippedOccurrences > 0;
  // A missing/stale scheduler snapshot is repaired on every lifecycle event.
  state.idle.scheduler = { version: 1, jobs: scheduler.snapshot().jobs.map((job) => ({ ...job })) };
  state.idle.lastProcessedAt = trustedNow.toISOString();
  state.idle.lastActiveAt = trustedNow.toISOString();
  refreshBackgroundSchedule(state);
  // Active runtime ticks drive the simulation and typed notifications, but a
  // WELCOME BACK report belongs only to an actual offline reconciliation.
  if (mode === 'ACTIVE') return null;
  // A rollback warning describes only the rejected wall-clock sample. Folding an
  // older welcome report into it would make the warning look like fresh rewards
  // were granted even though trusted time did not move.
  const previousWelcome = sample.anomaly === 'rollback' ? null : state.idle.lastWelcomeBack;
  const trainingGained = Math.max(0, trainingXpReady(state) - trainingReadyBefore);
  const affinityGained = Math.max(0, affinityReady(state) - affinityReadyBefore);
  const meaningful = elapsedMs >= 60_000
    || sample.anomaly !== 'none'
    || expeditionCycles > 0
    || endlessFloors > 0
    || equipmentAdded > 0
    || equipmentSalvaged > 0
    || rareDiscoveries > 0;
  if (!meaningful) return null;
  const from = previousWelcome?.from ?? new Date(previousProcessedMs).toISOString();
  const to = trustedNow.toISOString();
  const combinedElapsedMs = (previousWelcome?.elapsedMs ?? 0) + elapsedMs;
  const summary: WelcomeBackSummary = {
    summaryId: `welcome:${previousProcessedMs}:${sample.nowMs}:${state.idle.timeCheckpoint.reconciliationCount}`,
    from,
    to,
    elapsedMs: Math.min(MAX_EXPEDITION_OFFLINE_MS, combinedElapsedMs),
    capped: processingCapped || combinedElapsedMs > MAX_EXPEDITION_OFFLINE_MS || Boolean(previousWelcome?.capped),
    rollbackDetected: sample.anomaly === 'rollback' || Boolean(previousWelcome?.rollbackDetected),
    expeditionCycles: (previousWelcome?.expeditionCycles ?? 0) + expeditionCycles,
    trainingXpReady: (previousWelcome?.trainingXpReady ?? 0) + trainingGained,
    affinityReady: (previousWelcome?.affinityReady ?? 0) + affinityGained,
    researchReady: state.research.slot?.status === 'READY',
    endlessFloors: (previousWelcome?.endlessFloors ?? 0) + endlessFloors,
    endlessCredits: (previousWelcome?.endlessCredits ?? 0) + endlessCredits,
    equipmentAdded: (previousWelcome?.equipmentAdded ?? 0) + equipmentAdded,
    equipmentSalvaged: (previousWelcome?.equipmentSalvaged ?? 0) + equipmentSalvaged,
    rareDiscoveries: (previousWelcome?.rareDiscoveries ?? 0) + rareDiscoveries,
    createdAt: to,
  };
  state.idle.lastWelcomeBack = summary;
  return summary;
};
