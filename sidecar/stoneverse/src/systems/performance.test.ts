import { describe, expect, it, vi } from 'vitest';
import {
  FrameBudgetMonitor,
  LruCache,
  VariableSizeVirtualizer,
  calculateVirtualWindow,
  materializeVirtualItems,
} from './performance';

describe('virtualization utilities', () => {
  it('clamps and overscans a fixed-size 10,000-row leaderboard', () => {
    const window = calculateVirtualWindow({
      itemCount: 10_000,
      itemSize: 64,
      viewportSize: 640,
      scrollOffset: 6_400,
      overscan: 2,
    });
    expect(window).toMatchObject({
      startIndex: 98,
      endIndexExclusive: 112,
      visibleStartIndex: 100,
      visibleEndIndexExclusive: 110,
      paddingBefore: 6_272,
      totalSize: 640_000,
    });
    expect(materializeVirtualItems(window, 64)).toHaveLength(14);
  });

  it('supports measured variable-height cards with logarithmic lookup', () => {
    const virtualizer = new VariableSizeVirtualizer([40, 80, 60, 100]);
    expect(virtualizer.window(40, 80, 0).visibleEndIndexExclusive).toBe(2);
    let window = virtualizer.window(45, 100, 0);
    expect(window.visibleStartIndex).toBe(1);
    expect(window.visibleEndIndexExclusive).toBe(3);
    virtualizer.updateSize(1, 100);
    window = virtualizer.window(45, 100, 0);
    expect(window.totalSize).toBe(300);
    expect(virtualizer.items(window)[0]).toEqual({ index: 1, offset: 40, size: 100 });
  });
});

describe('performance budgets', () => {
  it('recommends a lower quality tier after sustained slow frames', () => {
    const monitor = new FrameBudgetMonitor({ targetFps: 60 });
    for (let index = 0; index < 100; index += 1) monitor.record(38);
    expect(monitor.snapshot().recommendedQuality).toBe('LOW');
  });

  it('evicts least-recently-used entries deterministically', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, number>(2, onEvict);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(onEvict).toHaveBeenCalledWith(2, 'b');
  });
});
