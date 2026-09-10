import type { EffectQuality } from './MotionManager';

export interface VirtualWindow {
  startIndex: number;
  endIndexExclusive: number;
  visibleStartIndex: number;
  visibleEndIndexExclusive: number;
  paddingBefore: number;
  paddingAfter: number;
  totalSize: number;
}

export interface VirtualItem {
  index: number;
  offset: number;
  size: number;
}

/** Pure fixed-row virtual window calculation for ranking and collection lists. */
export function calculateVirtualWindow(input: {
  itemCount: number;
  itemSize: number;
  viewportSize: number;
  scrollOffset: number;
  overscan?: number;
}): VirtualWindow {
  const itemCount = Math.max(0, Math.floor(input.itemCount));
  if (!Number.isFinite(input.itemSize) || input.itemSize <= 0) {
    throw new Error('Virtual itemSize must be greater than zero.');
  }
  const viewportSize = Math.max(0, input.viewportSize);
  const totalSize = itemCount * input.itemSize;
  const maximumOffset = Math.max(0, totalSize - viewportSize);
  const scrollOffset = Math.max(0, Math.min(maximumOffset, input.scrollOffset));
  const overscan = Math.max(0, Math.floor(input.overscan ?? 3));

  if (itemCount === 0) {
    return {
      startIndex: 0,
      endIndexExclusive: 0,
      visibleStartIndex: 0,
      visibleEndIndexExclusive: 0,
      paddingBefore: 0,
      paddingAfter: 0,
      totalSize: 0,
    };
  }

  const visibleStartIndex = Math.min(itemCount - 1, Math.floor(scrollOffset / input.itemSize));
  const visibleEndIndexExclusive = Math.min(
    itemCount,
    Math.max(visibleStartIndex + 1, Math.ceil((scrollOffset + viewportSize) / input.itemSize)),
  );
  const startIndex = Math.max(0, visibleStartIndex - overscan);
  const endIndexExclusive = Math.min(itemCount, visibleEndIndexExclusive + overscan);
  return {
    startIndex,
    endIndexExclusive,
    visibleStartIndex,
    visibleEndIndexExclusive,
    paddingBefore: startIndex * input.itemSize,
    paddingAfter: Math.max(0, totalSize - endIndexExclusive * input.itemSize),
    totalSize,
  };
}

export function materializeVirtualItems(
  window: Pick<VirtualWindow, 'startIndex' | 'endIndexExclusive'>,
  itemSize: number,
): readonly VirtualItem[] {
  return Array.from(
    { length: Math.max(0, window.endIndexExclusive - window.startIndex) },
    (_, offset) => {
      const index = window.startIndex + offset;
      return { index, offset: index * itemSize, size: itemSize };
    },
  );
}

/** Variable-height virtualizer using prefix sums and O(log n) lookup. */
export class VariableSizeVirtualizer {
  #sizes: number[];
  #offsets: number[];

  constructor(sizes: readonly number[]) {
    this.#sizes = sizes.map((size) => {
      if (!Number.isFinite(size) || size <= 0) throw new Error('Virtual item sizes must be positive.');
      return size;
    });
    this.#offsets = this.#buildOffsets();
  }

  updateSize(index: number, size: number): void {
    if (index < 0 || index >= this.#sizes.length) throw new Error(`Virtual item index out of range: ${index}`);
    if (!Number.isFinite(size) || size <= 0) throw new Error('Virtual item size must be positive.');
    this.#sizes[index] = size;
    for (let cursor = index + 1; cursor < this.#offsets.length; cursor += 1) {
      this.#offsets[cursor] = this.#offsets[cursor - 1] + this.#sizes[cursor - 1];
    }
  }

  totalSize(): number {
    return this.#offsets[this.#offsets.length - 1] ?? 0;
  }

  window(scrollOffset: number, viewportSize: number, overscan = 3): VirtualWindow {
    const itemCount = this.#sizes.length;
    if (itemCount === 0) {
      return {
        startIndex: 0,
        endIndexExclusive: 0,
        visibleStartIndex: 0,
        visibleEndIndexExclusive: 0,
        paddingBefore: 0,
        paddingAfter: 0,
        totalSize: 0,
      };
    }
    const totalSize = this.totalSize();
    const offset = Math.max(0, Math.min(Math.max(0, totalSize - viewportSize), scrollOffset));
    const visibleStartIndex = this.#findIndex(offset);
    const visibleEndIndexExclusive = Math.min(
      itemCount,
      Math.max(visibleStartIndex + 1, this.#findEndExclusive(offset + Math.max(0, viewportSize))),
    );
    const startIndex = Math.max(0, visibleStartIndex - Math.max(0, Math.floor(overscan)));
    const endIndexExclusive = Math.min(itemCount, visibleEndIndexExclusive + Math.max(0, Math.floor(overscan)));
    return {
      startIndex,
      endIndexExclusive,
      visibleStartIndex,
      visibleEndIndexExclusive,
      paddingBefore: this.#offsets[startIndex],
      paddingAfter: Math.max(0, totalSize - this.#offsets[endIndexExclusive]),
      totalSize,
    };
  }

  items(window: Pick<VirtualWindow, 'startIndex' | 'endIndexExclusive'>): readonly VirtualItem[] {
    const output: VirtualItem[] = [];
    for (let index = window.startIndex; index < window.endIndexExclusive; index += 1) {
      output.push({ index, offset: this.#offsets[index], size: this.#sizes[index] });
    }
    return output;
  }

  #buildOffsets(): number[] {
    const offsets = new Array<number>(this.#sizes.length + 1);
    offsets[0] = 0;
    for (let index = 0; index < this.#sizes.length; index += 1) {
      offsets[index + 1] = offsets[index] + this.#sizes[index];
    }
    return offsets;
  }

  #findIndex(offset: number): number {
    let low = 0;
    let high = this.#sizes.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      if (this.#offsets[middle + 1] <= offset) low = middle + 1;
      else if (this.#offsets[middle] > offset) high = middle - 1;
      else return middle;
    }
    return Math.max(0, Math.min(this.#sizes.length - 1, low));
  }

  #findEndExclusive(offset: number): number {
    let low = 0;
    let high = this.#offsets.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.#offsets[middle] < offset) low = middle + 1;
      else high = middle;
    }
    return Math.max(0, Math.min(this.#sizes.length, low));
  }
}

export interface FrameBudgetSnapshot {
  samples: number;
  averageFrameMs: number;
  p95FrameMs: number;
  slowFrameRatio: number;
  recommendedQuality: EffectQuality;
}

/** Rolling frame telemetry. Recommendations are advisory and never mutate settings. */
export class FrameBudgetMonitor {
  readonly #samples: number[] = [];
  readonly #capacity: number;
  readonly #targetFrameMs: number;

  constructor(options: { capacity?: number; targetFps?: number } = {}) {
    this.#capacity = Math.max(30, Math.floor(options.capacity ?? 180));
    this.#targetFrameMs = 1000 / Math.max(15, options.targetFps ?? 60);
  }

  record(frameDurationMs: number): void {
    if (!Number.isFinite(frameDurationMs) || frameDurationMs < 0) return;
    this.#samples.push(frameDurationMs);
    if (this.#samples.length > this.#capacity) this.#samples.shift();
  }

  snapshot(): FrameBudgetSnapshot {
    if (this.#samples.length === 0) {
      return { samples: 0, averageFrameMs: 0, p95FrameMs: 0, slowFrameRatio: 0, recommendedQuality: 'HIGH' };
    }
    const sorted = [...this.#samples].sort((left, right) => left - right);
    const averageFrameMs = this.#samples.reduce((sum, value) => sum + value, 0) / this.#samples.length;
    const p95FrameMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const slowFrameRatio = this.#samples.filter((value) => value > this.#targetFrameMs * 1.5).length / this.#samples.length;
    const recommendedQuality: EffectQuality =
      slowFrameRatio > 0.3 || p95FrameMs > this.#targetFrameMs * 2.2
        ? 'LOW'
        : slowFrameRatio > 0.14 || p95FrameMs > this.#targetFrameMs * 1.6
          ? 'MEDIUM'
          : p95FrameMs < this.#targetFrameMs * 0.8
            ? 'ULTRA'
            : 'HIGH';
    return { samples: this.#samples.length, averageFrameMs, p95FrameMs, slowFrameRatio, recommendedQuality };
  }

  reset(): void {
    this.#samples.length = 0;
  }
}

/** Small bounded LRU for decoded metadata, thumbnails, and view-model projections. */
export class LruCache<Key, Value> {
  readonly #values = new Map<Key, Value>();
  readonly #capacity: number;
  readonly #onEvict?: (value: Value, key: Key) => void;

  constructor(capacity: number, onEvict?: (value: Value, key: Key) => void) {
    if (!Number.isFinite(capacity) || capacity < 1) throw new Error('LRU capacity must be at least one.');
    this.#capacity = Math.floor(capacity);
    this.#onEvict = onEvict;
  }

  get(key: Key): Value | undefined {
    if (!this.#values.has(key)) return undefined;
    const value = this.#values.get(key)!;
    this.#values.delete(key);
    this.#values.set(key, value);
    return value;
  }

  set(key: Key, value: Value): void {
    if (this.#values.has(key)) this.#values.delete(key);
    this.#values.set(key, value);
    while (this.#values.size > this.#capacity) {
      const oldest = this.#values.entries().next().value as [Key, Value] | undefined;
      if (!oldest) break;
      this.#values.delete(oldest[0]);
      this.#onEvict?.(oldest[1], oldest[0]);
    }
  }

  delete(key: Key): boolean {
    if (!this.#values.has(key)) return false;
    const value = this.#values.get(key)!;
    const deleted = this.#values.delete(key);
    if (deleted) this.#onEvict?.(value, key);
    return deleted;
  }

  clear(): void {
    for (const [key, value] of this.#values) this.#onEvict?.(value, key);
    this.#values.clear();
  }

  get size(): number {
    return this.#values.size;
  }
}

/** Coalesce repeated scroll/resize work to one callback per animation frame. */
export function animationFrameThrottle<Args extends readonly unknown[]>(
  callback: (...args: Args) => void,
): ((...args: Args) => void) & { cancel(): void } {
  let frame: number | undefined;
  let latest: Args | undefined;
  const request = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (handler: FrameRequestCallback) => setTimeout(() => handler(Date.now()), 16) as unknown as number;
  const cancel = typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame
    : (handle: number) => clearTimeout(handle);
  const throttled = ((...args: Args) => {
    latest = args;
    if (frame !== undefined) return;
    frame = request(() => {
      frame = undefined;
      const invocation = latest;
      latest = undefined;
      if (invocation) callback(...invocation);
    });
  }) as ((...args: Args) => void) & { cancel(): void };
  throttled.cancel = () => {
    if (frame !== undefined) cancel(frame);
    frame = undefined;
    latest = undefined;
  };
  return throttled;
}
