import type { AssetDefinition, AssetPriority } from '../assets/assetManifest';

export type AssetLoadStatus = 'idle' | 'loading' | 'ready' | 'placeholder' | 'error';

export interface AssetSnapshot {
  definition: AssetDefinition;
  status: AssetLoadStatus;
  resolvedUrl?: string;
  placeholderUsed: boolean;
  attempts: number;
  error?: string;
}

export interface AssetProductionIssue {
  id: string;
  reason: 'placeholder' | 'load-error' | 'missing-source';
  detail?: string;
}

export interface AssetLoader {
  load(definition: AssetDefinition, signal?: AbortSignal): Promise<string>;
}

export interface AssetRegistryOptions {
  loader?: AssetLoader;
  placeholderFactory?: (definition: AssetDefinition) => string | undefined;
}

type Listener = (snapshot: AssetSnapshot) => void;

interface MutableRecord {
  definition: AssetDefinition;
  status: AssetLoadStatus;
  resolvedUrl?: string;
  attempts: number;
  error?: string;
}

const PRIORITY_WEIGHT: Readonly<Record<AssetPriority, number>> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

function defaultPlaceholderFactory(definition: AssetDefinition): string | undefined {
  if (definition.kind !== 'image') return undefined;

  const label = escapeXml(`PLACEHOLDER · ${definition.id}`);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">',
    '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">',
    '<stop stop-color="#101727"/><stop offset="1" stop-color="#222d43"/>',
    '</linearGradient></defs>',
    '<rect width="960" height="540" fill="url(#g)"/>',
    '<path d="M0 420L220 275l140 92 180-176 420 260v89H0z" fill="#34415b" opacity=".68"/>',
    '<circle cx="480" cy="236" r="88" fill="none" stroke="#8ea0bd" stroke-width="2" opacity=".42"/>',
    `<text x="480" y="495" text-anchor="middle" fill="#b9c4d7" font-family="system-ui,sans-serif" font-size="22" letter-spacing="2">${label}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

class BrowserAssetLoader implements AssetLoader {
  async load(definition: AssetDefinition, signal?: AbortSignal): Promise<string> {
    if (!definition.src) throw new Error(`Asset has no source: ${definition.id}`);

    if (definition.kind === 'image' && typeof Image !== 'undefined') {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        const abort = () => {
          image.src = '';
          reject(new DOMException('Asset load aborted', 'AbortError'));
        };
        image.onload = () => {
          signal?.removeEventListener('abort', abort);
          resolve();
        };
        image.onerror = () => {
          signal?.removeEventListener('abort', abort);
          reject(new Error(`Image failed to load: ${definition.id}`));
        };
        signal?.addEventListener('abort', abort, { once: true });
        image.decoding = 'async';
        image.src = definition.src!;
      });
      return definition.src;
    }

    if (typeof fetch === 'undefined') return definition.src;
    const response = await fetch(definition.src, { signal, cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Asset request failed (${response.status}): ${definition.id}`);
    }
    return definition.src;
  }
}

/**
 * Central lazy-loading boundary for every visual/audio file.
 * Placeholder entries never make a network request and remain visible in audit output.
 */
export class AssetRegistry {
  readonly #records = new Map<string, MutableRecord>();
  readonly #inFlight = new Map<string, Promise<AssetSnapshot>>();
  readonly #listeners = new Set<Listener>();
  readonly #loader: AssetLoader;
  readonly #placeholderFactory: (definition: AssetDefinition) => string | undefined;

  constructor(
    definitions: readonly AssetDefinition[] = [],
    options: AssetRegistryOptions = {},
  ) {
    this.#loader = options.loader ?? new BrowserAssetLoader();
    this.#placeholderFactory = options.placeholderFactory ?? defaultPlaceholderFactory;
    this.registerMany(definitions);
  }

  register(definition: AssetDefinition): void {
    if (!definition.id.trim()) throw new Error('Asset id must not be blank.');
    if (definition.placeholder && definition.src) {
      throw new Error(`Placeholder asset must not define src: ${definition.id}`);
    }
    if (!definition.placeholder && !definition.src) {
      throw new Error(`Production asset must define src: ${definition.id}`);
    }
    if (this.#records.has(definition.id)) {
      throw new Error(`Asset already registered: ${definition.id}`);
    }

    this.#records.set(definition.id, {
      definition: { ...definition },
      status: definition.placeholder ? 'placeholder' : 'idle',
      resolvedUrl: definition.placeholder
        ? this.#placeholderFactory(definition)
        : undefined,
      attempts: 0,
    });
  }

  registerMany(definitions: readonly AssetDefinition[]): void {
    for (const definition of definitions) this.register(definition);
  }

  /** Replace a placeholder without changing any consumer-facing logical id. */
  replace(definition: AssetDefinition): void {
    if (!this.#records.has(definition.id)) {
      this.register(definition);
      return;
    }
    if (definition.placeholder && definition.src) {
      throw new Error(`Placeholder asset must not define src: ${definition.id}`);
    }
    if (!definition.placeholder && !definition.src) {
      throw new Error(`Production asset must define src: ${definition.id}`);
    }
    this.#inFlight.delete(definition.id);
    const record: MutableRecord = {
      definition: { ...definition },
      status: definition.placeholder ? 'placeholder' : 'idle',
      resolvedUrl: definition.placeholder
        ? this.#placeholderFactory(definition)
        : undefined,
      attempts: 0,
    };
    this.#records.set(definition.id, record);
    this.#emit(record);
  }

  has(id: string): boolean {
    return this.#records.has(id);
  }

  get(id: string): AssetSnapshot | undefined {
    const record = this.#records.get(id);
    return record ? this.#snapshot(record) : undefined;
  }

  require(id: string): AssetSnapshot {
    const snapshot = this.get(id);
    if (!snapshot) throw new Error(`Unknown asset: ${id}`);
    return snapshot;
  }

  list(): readonly AssetSnapshot[] {
    return [...this.#records.values()].map((record) => this.#snapshot(record));
  }

  async load(id: string, signal?: AbortSignal): Promise<AssetSnapshot> {
    const record = this.#records.get(id);
    if (!record) throw new Error(`Unknown asset: ${id}`);
    if (record.status === 'placeholder' || record.status === 'ready') {
      return this.#snapshot(record);
    }

    const existing = this.#inFlight.get(id);
    if (existing) return existing;

    const operation = this.#loadRecord(record, signal).finally(() => {
      this.#inFlight.delete(id);
    });
    this.#inFlight.set(id, operation);
    return operation;
  }

  async preload(
    ids?: readonly string[],
    options: { concurrency?: number; signal?: AbortSignal } = {},
  ): Promise<readonly AssetSnapshot[]> {
    const concurrency = Math.max(1, Math.floor(options.concurrency ?? 4));
    const candidates = (ids
      ? ids.map((id) => this.require(id).definition)
      : [...this.#records.values()]
          .map((record) => record.definition)
          .filter((definition) => definition.preload)
    ).sort((left, right) => PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]);

    const results: AssetSnapshot[] = new Array(candidates.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < candidates.length) {
        if (options.signal?.aborted) throw new DOMException('Preload aborted', 'AbortError');
        const index = cursor++;
        results[index] = await this.load(candidates[index].id, options.signal);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()),
    );
    return results;
  }

  productionIssues(): readonly AssetProductionIssue[] {
    const issues: AssetProductionIssue[] = [];
    for (const record of this.#records.values()) {
      if (!record.definition.productionRequired) continue;
      if (record.definition.placeholder) {
        issues.push({ id: record.definition.id, reason: 'placeholder' });
      } else if (!record.definition.src) {
        issues.push({ id: record.definition.id, reason: 'missing-source' });
      } else if (record.status === 'error') {
        issues.push({
          id: record.definition.id,
          reason: 'load-error',
          detail: record.error,
        });
      }
    }
    return issues;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  clearRuntimeCache(): void {
    for (const record of this.#records.values()) {
      if (record.definition.placeholder) continue;
      record.status = 'idle';
      record.resolvedUrl = undefined;
      record.error = undefined;
      this.#emit(record);
    }
    this.#inFlight.clear();
  }

  async #loadRecord(record: MutableRecord, signal?: AbortSignal): Promise<AssetSnapshot> {
    record.status = 'loading';
    record.attempts += 1;
    record.error = undefined;
    this.#emit(record);
    try {
      record.resolvedUrl = await this.#loader.load(record.definition, signal);
      record.status = 'ready';
    } catch (error) {
      record.status = 'error';
      record.error = error instanceof Error ? error.message : String(error);
    }
    this.#emit(record);
    return this.#snapshot(record);
  }

  #snapshot(record: MutableRecord): AssetSnapshot {
    return Object.freeze({
      definition: Object.freeze({ ...record.definition }),
      status: record.status,
      resolvedUrl: record.resolvedUrl,
      placeholderUsed: record.definition.placeholder,
      attempts: record.attempts,
      error: record.error,
    });
  }

  #emit(record: MutableRecord): void {
    const snapshot = this.#snapshot(record);
    for (const listener of this.#listeners) listener(snapshot);
  }
}
