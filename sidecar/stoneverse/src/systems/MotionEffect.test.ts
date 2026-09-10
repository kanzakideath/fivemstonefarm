import { describe, expect, it, vi } from 'vitest';
import { EffectManager } from './EffectManager';
import { MotionManager } from './MotionManager';

describe('MotionManager', () => {
  it('resolves the full authored five-beat reveal at high quality', () => {
    const manager = new MotionManager({ quality: 'HIGH', reduceMotion: false });
    const plan = manager.plan('fusion.reveal');
    expect(plan.phases.map((phase) => phase.name)).toEqual([
      'anticipation', 'action', 'impact', 'recovery', 'reward',
    ]);
    expect(plan.reduced).toBe(false);
    expect(plan.totalDurationMs).toBeGreaterThan(2_000);
  });

  it('replaces movement-heavy sequences with a short reduced-motion plan', () => {
    const manager = new MotionManager({ quality: 'HIGH', reduceMotion: true });
    const plan = manager.plan('gacha.legendary');
    expect(plan.reduced).toBe(true);
    expect(plan.totalDurationMs).toBeLessThan(500);
    expect(plan.phases.every((phase) => !phase.effectIds?.includes('gacha.fracture'))).toBe(true);
  });

  it('allows skippable cinematics to resolve immediately', () => {
    const manager = new MotionManager();
    expect(manager.plan('awakening.reveal', { skip: true })).toMatchObject({
      skipped: true,
      totalDurationMs: 0,
      phases: [],
    });
  });
});

describe('EffectManager', () => {
  it('suppresses unsafe effects under reduced motion', () => {
    const manager = new EffectManager({ reduceMotion: true, quality: 'HIGH' });
    const listener = vi.fn();
    manager.subscribe(listener);
    const lease = manager.request('screen.shake.medium');
    expect(lease.status).toBe('suppressed');
    expect(lease.reason).toBe('reduced-motion');
    expect(listener).toHaveBeenCalledWith({
      type: 'suppressed', id: 'screen.shake.medium', reason: 'reduced-motion',
    });
  });

  it('scales particle counts to the selected quality budget and releases leases', () => {
    const manager = new EffectManager({ quality: 'MEDIUM' });
    const lease = manager.request('level.energy-rise', { seed: 7 });
    expect(lease.status).toBe('accepted');
    expect(lease.effect?.particleCount).toBe(45);
    expect(manager.settings().quality).toBe('MEDIUM');
    expect(lease.effect?.seed).toBe(7);
    lease.release();
    expect(manager.request('level.energy-rise').status).toBe('accepted');
    manager.dispose();
  });
});
