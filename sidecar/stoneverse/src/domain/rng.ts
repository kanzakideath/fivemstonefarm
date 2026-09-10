import type { Clock } from './types';

export interface RandomSource {
  /** A number in [0, 1). */
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  chance(probability: number): boolean;
  pick<T>(values: readonly T[]): T;
  weighted<T>(values: readonly T[], weight: (value: T) => number): T;
  shuffle<T>(values: readonly T[]): T[];
  fork(label: string): RandomSource;
}

const hashSeed = (seed: string): number => {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
};

/** Small, deterministic PRNG. Seeded runs are reproducible in tests and server replays. */
export class SeededRng implements RandomSource {
  private state: number;
  private draws = 0;

  constructor(private readonly seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  next(): number {
    // mulberry32
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    this.draws += 1;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  int(minInclusive: number, maxInclusive: number): number {
    if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxInclusive) || maxInclusive < minInclusive) {
      throw new RangeError(`Invalid integer range ${minInclusive}..${maxInclusive}`);
    }
    return Math.floor(this.next() * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  chance(probability: number): boolean {
    if (!Number.isFinite(probability)) throw new TypeError('Probability must be finite');
    return this.next() < Math.max(0, Math.min(1, probability));
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new RangeError('Cannot pick from an empty collection');
    return values[this.int(0, values.length - 1)] as T;
  }

  weighted<T>(values: readonly T[], weight: (value: T) => number): T {
    if (values.length === 0) throw new RangeError('Cannot pick from an empty collection');
    const weights = values.map((entry) => Math.max(0, weight(entry)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) throw new RangeError('At least one weight must be positive');
    let cursor = this.next() * total;
    for (let index = 0; index < values.length; index += 1) {
      cursor -= weights[index] ?? 0;
      if (cursor < 0) return values[index] as T;
    }
    return values[values.length - 1] as T;
  }

  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = this.int(0, index);
      [result[index], result[other]] = [result[other] as T, result[index] as T];
    }
    return result;
  }

  fork(label: string): RandomSource {
    return new SeededRng(`${String(this.seed)}:${label}:${this.draws}:${this.state}`);
  }
}

export class CryptoRng implements RandomSource {
  next(): number {
    const buffer = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(buffer);
      return (buffer[0] as number) / 4_294_967_296;
    }
    return Math.random();
  }

  int(minInclusive: number, maxInclusive: number): number {
    if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxInclusive) || maxInclusive < minInclusive) {
      throw new RangeError(`Invalid integer range ${minInclusive}..${maxInclusive}`);
    }
    return Math.floor(this.next() * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  chance(probability: number): boolean {
    return this.next() < Math.max(0, Math.min(1, probability));
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new RangeError('Cannot pick from an empty collection');
    return values[this.int(0, values.length - 1)] as T;
  }

  weighted<T>(values: readonly T[], weight: (value: T) => number): T {
    if (values.length === 0) throw new RangeError('Cannot pick from an empty collection');
    const total = values.reduce((sum, value) => sum + Math.max(0, weight(value)), 0);
    if (!(total > 0)) throw new RangeError('At least one weight must be positive');
    let cursor = this.next() * total;
    for (const value of values) {
      cursor -= Math.max(0, weight(value));
      if (cursor < 0) return value;
    }
    return values[values.length - 1] as T;
  }

  shuffle<T>(values: readonly T[]): T[] {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = this.int(0, index);
      [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
    }
    return copy;
  }

  fork(): RandomSource {
    return new CryptoRng();
  }
}

export const makeId = (prefix: string, rng: RandomSource, timestamp: number): string => {
  const random = Array.from({ length: 4 }, () => rng.int(0, 0xffffffff).toString(16).padStart(8, '0')).join('');
  return `${prefix}_${timestamp.toString(36)}_${random}`;
};

export const stableChecksum = (value: unknown): string => {
  const canonical = JSON.stringify(value, (_, current: unknown) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return Object.fromEntries(Object.entries(current as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    }
    return current;
  });
  return hashSeed(canonical ?? '').toString(16).padStart(8, '0');
};

export const systemClock: Clock = { now: () => new Date() };
