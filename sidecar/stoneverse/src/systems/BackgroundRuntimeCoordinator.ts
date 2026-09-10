export type BackgroundWakeReason = 'START' | 'DUE' | 'VISIBLE' | 'FOCUS' | 'MANUAL';

export interface BackgroundTimerDriver {
  now(): number;
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

export interface BackgroundRuntimeOptions {
  /** Processes every due game system atomically and returns the next domain due time. */
  process(reason: BackgroundWakeReason): number | null | Promise<number | null>;
  timer?: BackgroundTimerDriver;
  /** Domain-clock anchor used to turn an absolute due time into a timer delay. */
  scheduleNow?: () => number;
  retryBaseDelayMs?: number;
  onError?: (error: unknown) => void;
}

const browserTimer: BackgroundTimerDriver = {
  now: () => Date.now(),
  set: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * One coordinator owns background progression for the whole runtime. Domain jobs
 * expose their next due timestamp; screens never own reward-bearing intervals.
 */
export class BackgroundRuntimeCoordinator {
  readonly #process: BackgroundRuntimeOptions['process'];
  readonly #timer: BackgroundTimerDriver;
  readonly #scheduleNow: () => number;
  readonly #retryBaseDelayMs: number;
  readonly #onError: (error: unknown) => void;
  #running = false;
  #handle: unknown;
  #inFlight: Promise<void> | null = null;
  #queuedReason: BackgroundWakeReason | null = null;
  #generation = 0;
  #retryAttempt = 0;

  constructor(options: BackgroundRuntimeOptions) {
    this.#process = options.process;
    this.#timer = options.timer ?? browserTimer;
    this.#scheduleNow = options.scheduleNow ?? this.#timer.now;
    this.#retryBaseDelayMs = Math.max(250, Math.min(60_000, Math.floor(options.retryBaseDelayMs ?? 5_000)));
    this.#onError = options.onError ?? (() => undefined);
  }

  get running(): boolean { return this.#running; }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#generation += 1;
    void this.wake('START');
  }

  stop(): void {
    this.#running = false;
    this.#generation += 1;
    this.#queuedReason = null;
    this.#cancelTimer();
  }

  async wake(reason: BackgroundWakeReason = 'MANUAL'): Promise<void> {
    if (!this.#running) return;
    this.#cancelTimer();
    if (this.#inFlight) {
      this.#queuedReason = reason;
      return this.#inFlight;
    }
    const generation = this.#generation;
    const run = (async () => {
      try {
        const nextDueAtMs = await this.#process(reason);
        this.#retryAttempt = 0;
        if (this.#running && generation === this.#generation) this.#schedule(nextDueAtMs);
      } catch (error) {
        this.#onError(error);
        if (this.#running && generation === this.#generation) this.#scheduleRetry();
      }
    })();
    this.#inFlight = run;
    await run;
    this.#inFlight = null;
    if (this.#running && this.#queuedReason) {
      const queued = this.#queuedReason;
      this.#queuedReason = null;
      await this.wake(queued);
    }
  }

  #schedule(nextDueAtMs: number | null): void {
    if (nextDueAtMs === null) return;
    if (!Number.isSafeInteger(nextDueAtMs) || nextDueAtMs < 0) {
      this.#onError(new Error('Background next-due time must be a non-negative safe integer'));
      return;
    }
    // setTimeout is signed 32-bit on browsers. Very distant work is revisited in
    // bounded hops, without polling each game subsystem.
    const anchor = this.#scheduleNow();
    if (!Number.isSafeInteger(anchor) || anchor < 0) {
      this.#onError(new Error('Background schedule clock must be a non-negative safe integer'));
      this.#scheduleRetry();
      return;
    }
    const delayMs = Math.min(2_147_000_000, Math.max(0, nextDueAtMs - anchor));
    this.#handle = this.#timer.set(() => {
      this.#handle = undefined;
      void this.wake('DUE');
    }, delayMs);
  }

  #scheduleRetry(): void {
    this.#cancelTimer();
    const delayMs = Math.min(60_000, this.#retryBaseDelayMs * (2 ** Math.min(6, this.#retryAttempt)));
    this.#retryAttempt += 1;
    this.#handle = this.#timer.set(() => {
      this.#handle = undefined;
      void this.wake('DUE');
    }, delayMs);
  }

  #cancelTimer(): void {
    if (this.#handle === undefined) return;
    this.#timer.clear(this.#handle);
    this.#handle = undefined;
  }
}
