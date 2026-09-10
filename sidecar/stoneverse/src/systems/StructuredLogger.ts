export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type StoneverseLogDomain =
  | 'stone'
  | 'mining'
  | 'fusion'
  | 'evolution'
  | 'gacha'
  | 'save'
  | 'sync'
  | 'battle'
  | 'audio'
  | 'asset'
  | 'motion'
  | 'performance'
  | 'system';

export type LogValue =
  | string
  | number
  | boolean
  | null
  | readonly LogValue[]
  | { readonly [key: string]: LogValue };

export interface StructuredLogEvent {
  schemaVersion: 1;
  id: string;
  timestamp: string;
  level: LogLevel;
  domain: StoneverseLogDomain;
  event: string;
  sessionId?: string;
  correlationId?: string;
  context: Readonly<Record<string, LogValue>>;
  data: Readonly<Record<string, LogValue>>;
  error?: Readonly<{
    name: string;
    message: string;
    stack?: string;
  }>;
}

export interface LogSink {
  write(event: StructuredLogEvent): void | Promise<void>;
}

export interface StructuredLoggerOptions {
  minimumLevel?: LogLevel;
  sessionId?: string;
  capacity?: number;
  sinks?: readonly LogSink[];
  baseContext?: Readonly<Record<string, unknown>>;
  now?: () => Date;
  idFactory?: () => string;
  redactKeys?: RegExp;
}

export interface LogInput {
  domain: StoneverseLogDomain;
  event: string;
  data?: Readonly<Record<string, unknown>>;
  correlationId?: string;
  error?: unknown;
}

const LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const DEFAULT_REDACT_KEYS = /password|secret|token|authorization|cookie|email|ipAddress/i;

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function shouldRedact(key: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  const matches = pattern.test(key);
  pattern.lastIndex = 0;
  return matches;
}

function toLogValue(value: unknown, redactKeys: RegExp, seen = new WeakSet<object>()): LogValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'undefined') return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((item) => toLogValue(item, redactKeys, seen));
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const output: Record<string, LogValue> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = shouldRedact(key, redactKeys) ? '[REDACTED]' : toLogValue(child, redactKeys, seen);
    }
    seen.delete(value);
    return output;
  }
  return String(value);
}

function sanitizeRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  redactKeys: RegExp,
): Readonly<Record<string, LogValue>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record ?? {}).map(([key, value]) => [
        key,
        shouldRedact(key, redactKeys) ? '[REDACTED]' : toLogValue(value, redactKeys),
      ]),
    ),
  );
}

interface LoggerCore {
  entries: StructuredLogEvent[];
  sinks: readonly LogSink[];
  capacity: number;
  minimumLevel: LogLevel;
  sessionId?: string;
  now: () => Date;
  idFactory: () => string;
  redactKeys: RegExp;
}

/** Structured, bounded, redacted logging suitable for debug export and remote sinks. */
export class StructuredLogger {
  readonly #core: LoggerCore;
  readonly #baseContext: Readonly<Record<string, unknown>>;

  constructor(options: StructuredLoggerOptions = {}, core?: LoggerCore) {
    this.#core = core ?? {
      entries: [],
      sinks: options.sinks ?? [],
      capacity: Math.max(1, Math.floor(options.capacity ?? 500)),
      minimumLevel: options.minimumLevel ?? 'info',
      sessionId: options.sessionId,
      now: options.now ?? (() => new Date()),
      idFactory: options.idFactory ?? randomId,
      redactKeys: options.redactKeys ?? DEFAULT_REDACT_KEYS,
    };
    this.#baseContext = options.baseContext ?? {};
  }

  child(context: Readonly<Record<string, unknown>>): StructuredLogger {
    return new StructuredLogger(
      { baseContext: { ...this.#baseContext, ...context } },
      this.#core,
    );
  }

  debug(input: LogInput): StructuredLogEvent | undefined {
    return this.log('debug', input);
  }

  info(input: LogInput): StructuredLogEvent | undefined {
    return this.log('info', input);
  }

  warn(input: LogInput): StructuredLogEvent | undefined {
    return this.log('warn', input);
  }

  error(input: LogInput): StructuredLogEvent | undefined {
    return this.log('error', input);
  }

  fatal(input: LogInput): StructuredLogEvent | undefined {
    return this.log('fatal', input);
  }

  log(level: LogLevel, input: LogInput): StructuredLogEvent | undefined {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.#core.minimumLevel]) return undefined;
    if (!input.event.trim()) throw new Error('Structured log event name must not be blank.');

    const cause = input.error;
    const event: StructuredLogEvent = Object.freeze({
      schemaVersion: 1,
      id: this.#core.idFactory(),
      timestamp: this.#core.now().toISOString(),
      level,
      domain: input.domain,
      event: input.event,
      sessionId: this.#core.sessionId,
      correlationId: input.correlationId,
      context: sanitizeRecord(this.#baseContext, this.#core.redactKeys),
      data: sanitizeRecord(input.data, this.#core.redactKeys),
      ...(cause
        ? {
            error: Object.freeze({
              name: cause instanceof Error ? cause.name : 'UnknownError',
              message: cause instanceof Error ? cause.message : String(cause),
              ...(cause instanceof Error && cause.stack ? { stack: cause.stack } : {}),
            }),
          }
        : {}),
    });

    this.#core.entries.push(event);
    if (this.#core.entries.length > this.#core.capacity) {
      this.#core.entries.splice(0, this.#core.entries.length - this.#core.capacity);
    }
    for (const sink of this.#core.sinks) {
      try {
        const result = sink.write(event);
        if (result instanceof Promise) void result.catch(() => undefined);
      } catch {
        // Logging must never interrupt gameplay.
      }
    }
    return event;
  }

  entries(filter: Partial<Pick<StructuredLogEvent, 'level' | 'domain' | 'event'>> = {}): readonly StructuredLogEvent[] {
    return this.#core.entries.filter(
      (entry) =>
        (!filter.level || entry.level === filter.level) &&
        (!filter.domain || entry.domain === filter.domain) &&
        (!filter.event || entry.event === filter.event),
    );
  }

  exportJsonLines(): string {
    return this.#core.entries.map((entry) => JSON.stringify(entry)).join('\n');
  }

  clear(): void {
    this.#core.entries.length = 0;
  }
}

export class ConsoleLogSink implements LogSink {
  write(event: StructuredLogEvent): void {
    const method = event.level === 'debug' ? 'debug' : event.level === 'info' ? 'info' : event.level === 'warn' ? 'warn' : 'error';
    console[method](`[STONEVERSE:${event.domain}] ${event.event}`, event);
  }
}
