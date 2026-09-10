import { describe, expect, it } from 'vitest';
import type { Clock } from './types';
import {
  ReconciledTimeProvider,
  TIME_WINDOWS_MS,
  boundedElapsed,
  createTrustedTimeCheckpoint,
  reconcileTrustedTime,
} from './timeProvider';

class MutableClock implements Clock {
  constructor(public valueMs: number) {}
  now(): Date { return new Date(this.valueMs); }
}

describe('trusted time reconciliation', () => {
  it('never credits rollback time and only resumes past the wall high-water mark', () => {
    const start = 1_800_000_000_000;
    const first = reconcileTrustedTime(createTrustedTimeCheckpoint(start), start + TIME_WINDOWS_MS.ONE_HOUR);
    const rollback = reconcileTrustedTime(first.checkpoint, start - TIME_WINDOWS_MS.ONE_DAY);
    const stillBehind = reconcileTrustedTime(rollback.checkpoint, start + TIME_WINDOWS_MS.FIFTEEN_MINUTES);
    const beyondHighWater = reconcileTrustedTime(stillBehind.checkpoint, start + TIME_WINDOWS_MS.ONE_HOUR + 1_000);

    expect(rollback.anomaly).toBe('rollback');
    expect(rollback.advanceMs).toBe(0);
    expect(stillBehind.advanceMs).toBe(0);
    expect(beyondHighWater.advanceMs).toBe(1_000);
    expect(beyondHighWater.nowMs).toBe(start + TIME_WINDOWS_MS.ONE_HOUR + 1_000);
  });

  it('caps a forward jump and persisted restart spam cannot earn it repeatedly', () => {
    const start = 1_800_000_000_000;
    const jumpedWall = start + TIME_WINDOWS_MS.THIRTY_DAYS;
    const first = reconcileTrustedTime(createTrustedTimeCheckpoint(start), jumpedWall, {
      maxForwardAdvanceMs: TIME_WINDOWS_MS.ONE_DAY,
    });
    expect(first.anomaly).toBe('forward-capped');
    expect(first.advanceMs).toBe(TIME_WINDOWS_MS.ONE_DAY);

    let persisted = first.checkpoint;
    for (let restart = 0; restart < 50; restart += 1) {
      const repeated = reconcileTrustedTime(persisted, jumpedWall, { maxForwardAdvanceMs: TIME_WINDOWS_MS.ONE_DAY });
      expect(repeated.advanceMs).toBe(0);
      persisted = repeated.checkpoint;
    }
    expect(persisted.trustedNowMs).toBe(start + TIME_WINDOWS_MS.ONE_DAY);
  });

  it('restores a provider consistently and exposes a normal Clock contract', () => {
    const start = 1_800_000_000_000;
    const wall = new MutableClock(start);
    const provider = new ReconciledTimeProvider(wall);
    wall.valueMs += TIME_WINDOWS_MS.TWELVE_HOURS;
    expect(provider.now().getTime()).toBe(start + TIME_WINDOWS_MS.TWELVE_HOURS);

    const saved = provider.checkpoint();
    const restored = new ReconciledTimeProvider(wall, saved);
    expect(restored.checkpoint().trustedNowMs).toBe(saved.trustedNowMs);
    wall.valueMs += TIME_WINDOWS_MS.FIFTEEN_MINUTES;
    expect(restored.now().getTime()).toBe(saved.trustedNowMs + TIME_WINDOWS_MS.FIFTEEN_MINUTES);
  });
});

describe('bounded elapsed windows', () => {
  it.each([
    ['15m', TIME_WINDOWS_MS.FIFTEEN_MINUTES],
    ['1h', TIME_WINDOWS_MS.ONE_HOUR],
    ['12h', TIME_WINDOWS_MS.TWELVE_HOURS],
    ['24h', TIME_WINDOWS_MS.ONE_DAY],
    ['7d', TIME_WINDOWS_MS.SEVEN_DAYS],
    ['30d', TIME_WINDOWS_MS.THIRTY_DAYS],
  ])('preserves the %s boundary', (_label, duration) => {
    expect(boundedElapsed(10_000, 10_000 + duration).elapsedMs).toBe(duration);
  });

  it('reports rollback and caps oversized offline windows', () => {
    expect(boundedElapsed(2_000, 1_000, TIME_WINDOWS_MS.ONE_HOUR)).toMatchObject({
      elapsedMs: 0,
      rawElapsedMs: -1_000,
      rolledBack: true,
      capped: false,
    });
    expect(boundedElapsed(0, TIME_WINDOWS_MS.THIRTY_DAYS, TIME_WINDOWS_MS.SEVEN_DAYS)).toMatchObject({
      elapsedMs: TIME_WINDOWS_MS.SEVEN_DAYS,
      capped: true,
    });
  });
});
