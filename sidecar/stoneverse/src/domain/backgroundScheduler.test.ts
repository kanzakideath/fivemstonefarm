import { describe, expect, it, vi } from 'vitest';
import { BackgroundScheduler, type BackgroundDelivery } from './backgroundScheduler';
import { TIME_WINDOWS_MS } from './timeProvider';

describe('BackgroundScheduler', () => {
  it('delivers due one-shot events deterministically and exposes the next wake time', () => {
    const scheduler = new BackgroundScheduler<string>();
    scheduler.schedule({ id: 'later', dueAtMs: TIME_WINDOWS_MS.ONE_HOUR, payload: 'later' });
    scheduler.schedule({ id: 'same-b', dueAtMs: TIME_WINDOWS_MS.FIFTEEN_MINUTES, payload: 'b' });
    scheduler.schedule({ id: 'same-a', dueAtMs: TIME_WINDOWS_MS.FIFTEEN_MINUTES, payload: 'a' });
    expect(scheduler.nextDueAtMs()).toBe(TIME_WINDOWS_MS.FIFTEEN_MINUTES);

    const received: string[] = [];
    const result = scheduler.drainDue(TIME_WINDOWS_MS.FIFTEEN_MINUTES, (event) => received.push(event.payload));
    expect(received).toEqual(['a', 'b']);
    expect(result).toMatchObject({ callbacks: 2, deliveredOccurrences: 2, hasMoreDue: false });
    expect(result.nextDueAtMs).toBe(TIME_WINDOWS_MS.ONE_HOUR);
  });

  it('chunks 15-minute recurrences and obeys the callback budget', () => {
    const scheduler = new BackgroundScheduler<string>();
    scheduler.schedule({ id: 'income', dueAtMs: 0, repeatEveryMs: TIME_WINDOWS_MS.FIFTEEN_MINUTES, payload: 'ore' });
    const deliveries: BackgroundDelivery<string>[] = [];
    const result = scheduler.drainDue(TIME_WINDOWS_MS.ONE_HOUR, (event) => deliveries.push(event), {
      maxCallbacks: 2,
      maxOccurrencesPerCallback: 2,
    });

    expect(deliveries.map((event) => event.occurrences)).toEqual([2, 2]);
    expect(deliveries.map((event) => [event.firstSequence, event.lastSequence])).toEqual([[0, 1], [2, 3]]);
    expect(result).toMatchObject({ callbacks: 2, deliveredOccurrences: 4, hasMoreDue: true });
    expect(result.nextDueAtMs).toBe(TIME_WINDOWS_MS.ONE_HOUR);
  });

  it('restores pending work exactly after restart', () => {
    const original = new BackgroundScheduler<string>();
    original.schedule({ id: 'hourly', dueAtMs: 0, repeatEveryMs: TIME_WINDOWS_MS.ONE_HOUR, payload: 'tick' });
    original.drainDue(TIME_WINDOWS_MS.TWELVE_HOURS, () => undefined, {
      maxCallbacks: 1,
      maxOccurrencesPerCallback: 5,
    });

    const restored = new BackgroundScheduler(original.snapshot());
    const delivered: number[] = [];
    const result = restored.drainDue(TIME_WINDOWS_MS.TWELVE_HOURS, (event) => delivered.push(event.firstSequence), {
      maxCallbacks: 10,
      maxOccurrencesPerCallback: 5,
    });
    expect(delivered).toEqual([5, 10]);
    expect(result.deliveredOccurrences).toBe(8);
    expect(restored.nextDueAtMs()).toBe(13 * TIME_WINDOWS_MS.ONE_HOUR);
  });

  it('skips a 30-day backlog outside a 24-hour catch-up window in O(1)', () => {
    const scheduler = new BackgroundScheduler<string>();
    scheduler.schedule({ id: 'daily', dueAtMs: 0, repeatEveryMs: TIME_WINDOWS_MS.ONE_DAY, payload: 'daily' });
    const deliveries: BackgroundDelivery<string>[] = [];
    const result = scheduler.drainDue(TIME_WINDOWS_MS.THIRTY_DAYS, (event) => deliveries.push(event), {
      maxCatchUpMs: TIME_WINDOWS_MS.ONE_DAY,
    });

    expect(result.skippedOccurrences).toBe(29);
    expect(result.deliveredOccurrences).toBe(2);
    expect(deliveries[0]).toMatchObject({ firstSequence: 29, lastSequence: 30, occurrences: 2 });
    expect(result.nextDueAtMs).toBe(31 * TIME_WINDOWS_MS.ONE_DAY);
  });

  it('honors a seven-day end boundary and does not retain completed recurrence', () => {
    const scheduler = new BackgroundScheduler<string>();
    scheduler.schedule({
      id: 'limited',
      dueAtMs: 0,
      repeatEveryMs: TIME_WINDOWS_MS.TWELVE_HOURS,
      endAtMs: TIME_WINDOWS_MS.SEVEN_DAYS,
      payload: 'limited',
    });
    const result = scheduler.drainDue(TIME_WINDOWS_MS.THIRTY_DAYS, () => undefined, {
      maxCatchUpMs: TIME_WINDOWS_MS.THIRTY_DAYS,
    });
    expect(result.deliveredOccurrences).toBe(15);
    expect(scheduler.has('limited')).toBe(false);
  });

  it('does not commit a chunk whose handler throws', () => {
    const scheduler = new BackgroundScheduler<string>();
    scheduler.schedule({ id: 'retry', dueAtMs: 0, repeatEveryMs: TIME_WINDOWS_MS.ONE_HOUR, payload: 'retry' });
    const failed = vi.fn(() => { throw new Error('transient'); });
    expect(() => scheduler.drainDue(TIME_WINDOWS_MS.ONE_HOUR, failed)).toThrow('transient');
    expect(scheduler.snapshot().jobs[0]).toMatchObject({ dueAtMs: 0, sequence: 0 });

    const retried: BackgroundDelivery<string>[] = [];
    scheduler.drainDue(TIME_WINDOWS_MS.ONE_HOUR, (event) => retried.push(event));
    expect(retried[0]).toMatchObject({ firstSequence: 0, lastSequence: 1, occurrences: 2 });
  });
});
