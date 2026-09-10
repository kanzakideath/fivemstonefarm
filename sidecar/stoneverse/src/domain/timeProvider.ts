import type { Clock } from './types';

export const TIME_WINDOWS_MS = {
  FIFTEEN_MINUTES: 15 * 60 * 1_000,
  ONE_HOUR: 60 * 60 * 1_000,
  TWELVE_HOURS: 12 * 60 * 60 * 1_000,
  ONE_DAY: 24 * 60 * 60 * 1_000,
  SEVEN_DAYS: 7 * 24 * 60 * 60 * 1_000,
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1_000,
} as const;

export interface TrustedTimeCheckpoint {
  readonly version: 1;
  /** Last time exposed to game systems. Never decreases. */
  readonly trustedNowMs: number;
  /** Greatest wall-clock value observed, including rejected/capped jumps. */
  readonly wallHighWaterMs: number;
  readonly reconciliationCount: number;
}

export type TimeAnomaly = 'none' | 'rollback' | 'forward-capped';

export interface TrustedTimeSample {
  readonly nowMs: number;
  readonly advanceMs: number;
  readonly observedWallMs: number;
  readonly observedAdvanceMs: number;
  readonly anomaly: TimeAnomaly;
  readonly checkpoint: TrustedTimeCheckpoint;
}

export interface TrustedTimeOptions {
  /** Maximum game-time credited by one wall-clock observation. */
  readonly maxForwardAdvanceMs?: number;
}

export interface ElapsedWindow {
  readonly elapsedMs: number;
  readonly rawElapsedMs: number;
  readonly rolledBack: boolean;
  readonly capped: boolean;
}

const MAX_DATE_MS = 8_640_000_000_000_000;

const assertTimestamp = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DATE_MS) {
    throw new Error(`${label} must be a valid non-negative Date timestamp`);
  }
};

const maxForwardAdvance = (options: TrustedTimeOptions): number => {
  const value = options.maxForwardAdvanceMs ?? TIME_WINDOWS_MS.THIRTY_DAYS;
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('maxForwardAdvanceMs must be a positive safe integer');
  return value;
};

export const createTrustedTimeCheckpoint = (observedWallMs: number): TrustedTimeCheckpoint => {
  assertTimestamp(observedWallMs, 'observedWallMs');
  return { version: 1, trustedNowMs: observedWallMs, wallHighWaterMs: observedWallMs, reconciliationCount: 0 };
};

export const validateTrustedTimeCheckpoint = (value: TrustedTimeCheckpoint): TrustedTimeCheckpoint => {
  if (!value || value.version !== 1) throw new Error('Unsupported trusted-time checkpoint');
  assertTimestamp(value.trustedNowMs, 'checkpoint.trustedNowMs');
  assertTimestamp(value.wallHighWaterMs, 'checkpoint.wallHighWaterMs');
  assertTimestamp(value.reconciliationCount, 'checkpoint.reconciliationCount');
  return { ...value };
};

/**
 * Reconciles an untrusted wall clock with a persisted monotonic checkpoint.
 *
 * A rollback earns no elapsed time. A forward jump earns at most the configured
 * cap, but the complete wall value becomes the high-water mark. Persisting the
 * returned checkpoint therefore prevents repeated restarts at the same jumped
 * wall value from earning the cap repeatedly.
 */
export const reconcileTrustedTime = (
  previous: TrustedTimeCheckpoint,
  observedWallMs: number,
  options: TrustedTimeOptions = {},
): TrustedTimeSample => {
  const checkpoint = validateTrustedTimeCheckpoint(previous);
  assertTimestamp(observedWallMs, 'observedWallMs');
  const observedAdvanceMs = Math.max(0, observedWallMs - checkpoint.wallHighWaterMs);
  const advanceMs = Math.min(observedAdvanceMs, maxForwardAdvance(options));
  const anomaly: TimeAnomaly = observedWallMs < checkpoint.wallHighWaterMs
    ? 'rollback'
    : observedAdvanceMs > advanceMs ? 'forward-capped' : 'none';
  const next: TrustedTimeCheckpoint = {
    version: 1,
    trustedNowMs: checkpoint.trustedNowMs + advanceMs,
    wallHighWaterMs: Math.max(checkpoint.wallHighWaterMs, observedWallMs),
    reconciliationCount: checkpoint.reconciliationCount + 1,
  };
  assertTimestamp(next.trustedNowMs, 'next.trustedNowMs');
  assertTimestamp(next.reconciliationCount, 'next.reconciliationCount');
  return { nowMs: next.trustedNowMs, advanceMs, observedWallMs, observedAdvanceMs, anomaly, checkpoint: next };
};

/** Calculates elapsed time without ever returning a negative or unbounded value. */
export const boundedElapsed = (fromMs: number, toMs: number, capMs = TIME_WINDOWS_MS.THIRTY_DAYS): ElapsedWindow => {
  assertTimestamp(fromMs, 'fromMs');
  assertTimestamp(toMs, 'toMs');
  if (!Number.isSafeInteger(capMs) || capMs < 0) throw new Error('capMs must be a non-negative safe integer');
  const rawElapsedMs = toMs - fromMs;
  return {
    elapsedMs: Math.min(Math.max(rawElapsedMs, 0), capMs),
    rawElapsedMs,
    rolledBack: rawElapsedMs < 0,
    capped: rawElapsedMs > capMs,
  };
};

const readWallMs = (clock: Clock): number => {
  const value = clock.now().getTime();
  assertTimestamp(value, 'clock.now()');
  return value;
};

/** Stateful Clock adapter; call checkpoint() whenever the owning state is saved. */
export class ReconciledTimeProvider implements Clock {
  private state: TrustedTimeCheckpoint;
  private readonly wallClock: Clock;
  private readonly options: TrustedTimeOptions;
  private last: TrustedTimeSample;

  constructor(wallClock: Clock, restored?: TrustedTimeCheckpoint, options: TrustedTimeOptions = {}) {
    this.wallClock = wallClock;
    this.options = options;
    const observed = readWallMs(wallClock);
    if (restored) {
      this.last = reconcileTrustedTime(restored, observed, options);
      this.state = this.last.checkpoint;
    } else {
      this.state = createTrustedTimeCheckpoint(observed);
      this.last = {
        nowMs: observed,
        advanceMs: 0,
        observedWallMs: observed,
        observedAdvanceMs: 0,
        anomaly: 'none',
        checkpoint: this.state,
      };
    }
  }

  sample(): TrustedTimeSample {
    this.last = reconcileTrustedTime(this.state, readWallMs(this.wallClock), this.options);
    this.state = this.last.checkpoint;
    return this.last;
  }

  now(): Date {
    return new Date(this.sample().nowMs);
  }

  latestSample(): TrustedTimeSample {
    return { ...this.last, checkpoint: { ...this.last.checkpoint } };
  }

  checkpoint(): TrustedTimeCheckpoint {
    return { ...this.state };
  }
}
