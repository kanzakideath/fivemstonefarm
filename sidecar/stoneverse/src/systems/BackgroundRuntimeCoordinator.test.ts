import { describe, expect, it, vi } from 'vitest';
import { BackgroundRuntimeCoordinator, type BackgroundTimerDriver } from './BackgroundRuntimeCoordinator';

const fakeTimer = (now = 1_000) => {
  let callback: (() => void) | undefined;
  let delay = -1;
  const driver: BackgroundTimerDriver = {
    now: () => now,
    set: (next, wait) => { callback = next; delay = wait; return Symbol('timer'); },
    clear: () => { callback = undefined; },
  };
  return { driver, get callback() { return callback; }, get delay() { return delay; } };
};

describe('BackgroundRuntimeCoordinator', () => {
  it('processes once at runtime start and wakes exactly at the next domain event', async () => {
    const timer = fakeTimer();
    const process = vi.fn().mockResolvedValueOnce(6_000).mockResolvedValueOnce(null);
    const runtime = new BackgroundRuntimeCoordinator({ process, timer: timer.driver });

    runtime.start();
    await vi.waitFor(() => expect(process).toHaveBeenCalledWith('START'));
    expect(timer.delay).toBe(5_000);
    timer.callback?.();
    await vi.waitFor(() => expect(process).toHaveBeenCalledWith('DUE'));
    expect(process).toHaveBeenCalledTimes(2);
    runtime.stop();
  });

  it('coalesces wakes during an atomic processing pass and does not schedule after stop', async () => {
    let release!: (next: number | null) => void;
    const first = new Promise<number | null>((resolve) => { release = resolve; });
    const timer = fakeTimer();
    const process = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(null);
    const runtime = new BackgroundRuntimeCoordinator({ process, timer: timer.driver });

    runtime.start();
    const visible = runtime.wake('VISIBLE');
    const focus = runtime.wake('FOCUS');
    expect(process).toHaveBeenCalledTimes(1);
    release(10_000);
    await Promise.all([visible, focus]);
    expect(process).toHaveBeenCalledTimes(2);
    expect(process).toHaveBeenLastCalledWith('FOCUS');
    runtime.stop();
    expect(timer.callback).toBeUndefined();
  });

  it('contains processor failures and rejects invalid due timestamps', async () => {
    const onError = vi.fn();
    const timer = fakeTimer();
    const process = vi.fn().mockRejectedValueOnce(new Error('save unavailable')).mockResolvedValueOnce(Number.NaN);
    const runtime = new BackgroundRuntimeCoordinator({ process, timer: timer.driver, onError });

    runtime.start();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'save unavailable' })));
    expect(timer.delay).toBe(5_000);
    await runtime.wake('MANUAL');
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ message: expect.stringMatching(/next-due/i) }));
    runtime.stop();
  });

  it('schedules absolute jobs against trusted domain time after a capped wall-clock jump', async () => {
    const day = 24 * 60 * 60 * 1_000;
    const timer = fakeTimer(365 * day);
    const trustedNow = 30 * day;
    const runtime = new BackgroundRuntimeCoordinator({
      process: vi.fn().mockResolvedValue(trustedNow + 15 * 60_000),
      timer: timer.driver,
      scheduleNow: () => trustedNow,
    });

    runtime.start();
    await vi.waitFor(() => expect(timer.delay).toBe(15 * 60_000));
    runtime.stop();
  });
});
