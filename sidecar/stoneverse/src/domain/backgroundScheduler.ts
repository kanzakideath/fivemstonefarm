import { TIME_WINDOWS_MS } from './timeProvider';

export interface BackgroundJob<T> {
  readonly id: string;
  readonly dueAtMs: number;
  readonly payload: T;
  /** Omit for a one-shot event. */
  readonly repeatEveryMs?: number;
  /** Inclusive final occurrence time for a recurring event. */
  readonly endAtMs?: number;
  /** Number of occurrences already consumed or intentionally skipped. */
  readonly sequence?: number;
}

export interface BackgroundSchedulerSnapshot<T> {
  readonly version: 1;
  readonly jobs: readonly BackgroundJob<T>[];
}

export interface BackgroundDelivery<T> {
  readonly jobId: string;
  readonly payload: T;
  readonly firstDueAtMs: number;
  readonly lastDueAtMs: number;
  readonly occurrences: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly delayedByMs: number;
}

export interface DrainOptions {
  /** Hard upper bound on handler invocations in this drain. */
  readonly maxCallbacks?: number;
  /** Groups recurring occurrences into one bounded delivery. */
  readonly maxOccurrencesPerCallback?: number;
  /** Recurrences older than this horizon are skipped in O(1). */
  readonly maxCatchUpMs?: number;
}

export interface DrainResult {
  readonly callbacks: number;
  readonly deliveredOccurrences: number;
  readonly skippedOccurrences: number;
  readonly hasMoreDue: boolean;
  readonly nextDueAtMs: number | null;
}

const assertTime = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
};

const assertPositive = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer`);
};

const normalizedJob = <T>(job: BackgroundJob<T>): BackgroundJob<T> => {
  if (typeof job.id !== 'string' || job.id.length === 0) throw new Error('job.id must be a non-empty string');
  assertTime(job.dueAtMs, 'job.dueAtMs');
  const sequence = job.sequence ?? 0;
  assertTime(sequence, 'job.sequence');
  if (job.repeatEveryMs !== undefined) assertPositive(job.repeatEveryMs, 'job.repeatEveryMs');
  if (job.endAtMs !== undefined) {
    assertTime(job.endAtMs, 'job.endAtMs');
    if (job.repeatEveryMs === undefined) throw new Error('job.endAtMs requires repeatEveryMs');
    if (job.endAtMs < job.dueAtMs) throw new Error('job.endAtMs cannot precede job.dueAtMs');
  }
  return { ...job, sequence };
};

const sortedJobs = <T>(jobs: Iterable<BackgroundJob<T>>): BackgroundJob<T>[] =>
  [...jobs].sort((left, right) => left.dueAtMs - right.dueAtMs || left.id.localeCompare(right.id));

/**
 * Serializable, event-driven scheduler core. It creates no timer or polling
 * loop: hosts wake it at nextDueAtMs(), or call drainDue after resume/events.
 */
export class BackgroundScheduler<T> {
  private readonly jobs = new Map<string, BackgroundJob<T>>();

  constructor(snapshot?: BackgroundSchedulerSnapshot<T>) {
    if (snapshot && snapshot.version !== 1) throw new Error('Unsupported scheduler snapshot');
    for (const job of snapshot?.jobs ?? []) this.schedule(job);
  }

  schedule(job: BackgroundJob<T>): void {
    const normalized = normalizedJob(job);
    if (this.jobs.has(normalized.id)) throw new Error(`Duplicate background job: ${normalized.id}`);
    this.jobs.set(normalized.id, normalized);
  }

  upsert(job: BackgroundJob<T>): void {
    const normalized = normalizedJob(job);
    this.jobs.set(normalized.id, normalized);
  }

  cancel(id: string): boolean {
    return this.jobs.delete(id);
  }

  has(id: string): boolean {
    return this.jobs.has(id);
  }

  size(): number {
    return this.jobs.size;
  }

  nextDueAtMs(): number | null {
    return sortedJobs(this.jobs.values())[0]?.dueAtMs ?? null;
  }

  snapshot(): BackgroundSchedulerSnapshot<T> {
    return { version: 1, jobs: sortedJobs(this.jobs.values()).map((job) => ({ ...job })) };
  }

  drainDue(nowMs: number, handler: (delivery: BackgroundDelivery<T>) => void, options: DrainOptions = {}): DrainResult {
    assertTime(nowMs, 'nowMs');
    const maxCallbacks = options.maxCallbacks ?? 100;
    const maxOccurrences = options.maxOccurrencesPerCallback ?? 96;
    const maxCatchUpMs = options.maxCatchUpMs ?? TIME_WINDOWS_MS.THIRTY_DAYS;
    assertTime(maxCallbacks, 'maxCallbacks');
    assertPositive(maxOccurrences, 'maxOccurrencesPerCallback');
    assertTime(maxCatchUpMs, 'maxCatchUpMs');

    let callbacks = 0;
    let deliveredOccurrences = 0;
    let skippedOccurrences = 0;

    while (callbacks < maxCallbacks) {
      const current = sortedJobs(this.jobs.values()).find((job) => job.dueAtMs <= nowMs);
      if (!current) break;
      const repeat = current.repeatEveryMs;

      if (repeat === undefined) {
        const delivery: BackgroundDelivery<T> = {
          jobId: current.id,
          payload: current.payload,
          firstDueAtMs: current.dueAtMs,
          lastDueAtMs: current.dueAtMs,
          occurrences: 1,
          firstSequence: current.sequence ?? 0,
          lastSequence: current.sequence ?? 0,
          delayedByMs: nowMs - current.dueAtMs,
        };
        handler(delivery);
        this.jobs.delete(current.id);
        callbacks += 1;
        deliveredOccurrences += 1;
        continue;
      }

      let dueAtMs = current.dueAtMs;
      let sequence = current.sequence ?? 0;
      const earliestAllowed = Math.max(0, nowMs - maxCatchUpMs);
      if (dueAtMs < earliestAllowed) {
        const skipped = Math.ceil((earliestAllowed - dueAtMs) / repeat);
        dueAtMs += skipped * repeat;
        sequence += skipped;
        skippedOccurrences += skipped;
      }
      if (current.endAtMs !== undefined && dueAtMs > current.endAtMs) {
        this.jobs.delete(current.id);
        continue;
      }

      const finalDue = Math.min(nowMs, current.endAtMs ?? nowMs);
      // No occurrence falls inside a very small/zero catch-up window. Advance
      // the cursor without invoking user code, then let the host wake us later.
      if (dueAtMs > finalDue) {
        this.jobs.set(current.id, { ...current, dueAtMs, sequence });
        continue;
      }
      const totalDue = Math.floor((finalDue - dueAtMs) / repeat) + 1;
      const occurrences = Math.min(totalDue, maxOccurrences);
      const lastDueAtMs = dueAtMs + (occurrences - 1) * repeat;
      const delivery: BackgroundDelivery<T> = {
        jobId: current.id,
        payload: current.payload,
        firstDueAtMs: dueAtMs,
        lastDueAtMs,
        occurrences,
        firstSequence: sequence,
        lastSequence: sequence + occurrences - 1,
        delayedByMs: nowMs - lastDueAtMs,
      };
      // Commit only after success so the failed chunk can be retried exactly.
      handler(delivery);
      callbacks += 1;
      deliveredOccurrences += occurrences;
      const nextDue = lastDueAtMs + repeat;
      const nextSequence = sequence + occurrences;
      if (current.endAtMs !== undefined && nextDue > current.endAtMs) this.jobs.delete(current.id);
      else this.jobs.set(current.id, { ...current, dueAtMs: nextDue, sequence: nextSequence });
    }

    const nextDueAtMs = this.nextDueAtMs();
    return {
      callbacks,
      deliveredOccurrences,
      skippedOccurrences,
      hasMoreDue: nextDueAtMs !== null && nextDueAtMs <= nowMs,
      nextDueAtMs,
    };
  }
}
