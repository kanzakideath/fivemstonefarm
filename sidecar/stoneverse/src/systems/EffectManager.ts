import { normalizeEffectQuality, type EffectQuality, type EffectQualityInput } from './MotionManager';

export type EffectKind =
  | 'particles'
  | 'flash'
  | 'shake'
  | 'blur'
  | 'vignette'
  | 'glow'
  | 'noise'
  | 'chromatic'
  | 'overlay';

export interface EffectDefinition {
  id: string;
  kind: EffectKind;
  durationMs: number;
  minimumQuality: EffectQuality;
  particleCount?: number;
  intensity?: number;
  color?: string;
  blendMode?: string;
  unsafeForReducedMotion?: boolean;
}

export interface ResolvedEffect {
  token: string;
  id: string;
  kind: EffectKind;
  durationMs: number;
  particleCount: number;
  intensity: number;
  color?: string;
  blendMode?: string;
  anchor?: Readonly<{ x: number; y: number }>;
  seed: number;
}

export interface EffectLease {
  status: 'accepted' | 'suppressed';
  reason?: 'quality' | 'reduced-motion' | 'concurrency-budget' | 'particle-budget';
  effect?: ResolvedEffect;
  release(): void;
}

export interface EffectSettings {
  quality: EffectQuality;
  reduceMotion: boolean;
  particlesEnabled: boolean;
}

export interface EffectRequestOptions {
  anchor?: Readonly<{ x: number; y: number }>;
  intensity?: number;
  seed?: number;
}

export type EffectManagerEvent =
  | { type: 'accepted'; effect: ResolvedEffect }
  | { type: 'released'; effect: ResolvedEffect }
  | { type: 'suppressed'; id: string; reason: Exclude<EffectLease['reason'], undefined> };

const QUALITY_RANK: Readonly<Record<EffectQuality, number>> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  ULTRA: 3,
};

const BUDGET = {
  LOW: { maxConcurrent: 2, particles: 36, multiplier: 0.2 },
  MEDIUM: { maxConcurrent: 4, particles: 140, multiplier: 0.5 },
  HIGH: { maxConcurrent: 8, particles: 480, multiplier: 1 },
  ULTRA: { maxConcurrent: 12, particles: 960, multiplier: 1.6 },
} as const;

export const CORE_EFFECTS: readonly EffectDefinition[] = [
  { id: 'ui.press-ripple', kind: 'overlay', durationMs: 180, minimumQuality: 'LOW', intensity: 0.3 },
  { id: 'card.light-sweep', kind: 'glow', durationMs: 460, minimumQuality: 'MEDIUM', intensity: 0.45, blendMode: 'screen' },
  { id: 'level.energy-rise', kind: 'particles', durationMs: 720, minimumQuality: 'MEDIUM', particleCount: 90, color: '#8ee7ff' },
  { id: 'level.flash', kind: 'flash', durationMs: 140, minimumQuality: 'LOW', intensity: 0.42, color: '#eafcff', unsafeForReducedMotion: true },
  { id: 'level.stats-count', kind: 'glow', durationMs: 480, minimumQuality: 'LOW', intensity: 0.35, color: '#a9f4da' },
  { id: 'fusion.gene-orbits', kind: 'particles', durationMs: 1300, minimumQuality: 'MEDIUM', particleCount: 150, color: '#78d9ff' },
  { id: 'fusion.convergence', kind: 'particles', durationMs: 920, minimumQuality: 'MEDIUM', particleCount: 260, color: '#c093ff' },
  { id: 'fusion.whiteout', kind: 'flash', durationMs: 230, minimumQuality: 'MEDIUM', intensity: 0.9, color: '#ffffff', unsafeForReducedMotion: true },
  { id: 'fusion.silhouette', kind: 'overlay', durationMs: 640, minimumQuality: 'LOW', intensity: 0.8 },
  { id: 'fusion.inheritance', kind: 'glow', durationMs: 900, minimumQuality: 'MEDIUM', intensity: 0.65, color: '#edcc8c' },
  { id: 'awakening.silence', kind: 'vignette', durationMs: 850, minimumQuality: 'MEDIUM', intensity: 0.78 },
  { id: 'awakening.ascension', kind: 'particles', durationMs: 1200, minimumQuality: 'MEDIUM', particleCount: 380, color: '#fff1ae' },
  { id: 'awakening.burst', kind: 'flash', durationMs: 280, minimumQuality: 'HIGH', intensity: 1, color: '#fffced', unsafeForReducedMotion: true },
  { id: 'awakening.frame', kind: 'glow', durationMs: 1200, minimumQuality: 'MEDIUM', intensity: 0.85, color: '#ffe889' },
  { id: 'gacha.audio-duck', kind: 'vignette', durationMs: 1100, minimumQuality: 'MEDIUM', intensity: 0.7 },
  { id: 'gacha.void', kind: 'noise', durationMs: 1450, minimumQuality: 'HIGH', intensity: 0.34 },
  { id: 'gacha.fracture', kind: 'chromatic', durationMs: 1000, minimumQuality: 'HIGH', intensity: 0.65, unsafeForReducedMotion: true },
  { id: 'gacha.legendary-impact', kind: 'flash', durationMs: 330, minimumQuality: 'HIGH', intensity: 1, color: '#fff5c4', unsafeForReducedMotion: true },
  { id: 'gacha.reveal-aura', kind: 'particles', durationMs: 1300, minimumQuality: 'MEDIUM', particleCount: 460, color: '#ffd875' },
  { id: 'gacha.legendary-reward', kind: 'glow', durationMs: 1500, minimumQuality: 'MEDIUM', intensity: 0.9, color: '#ffd875' },
  { id: 'battle.hit', kind: 'particles', durationMs: 280, minimumQuality: 'MEDIUM', particleCount: 56, color: '#d9f6ff' },
  { id: 'battle.damage-number', kind: 'overlay', durationMs: 620, minimumQuality: 'LOW', intensity: 1 },
  { id: 'screen.shake.light', kind: 'shake', durationMs: 110, minimumQuality: 'MEDIUM', intensity: 0.24, unsafeForReducedMotion: true },
  { id: 'screen.shake.medium', kind: 'shake', durationMs: 180, minimumQuality: 'MEDIUM', intensity: 0.5, unsafeForReducedMotion: true },
];

/** Allocates effect descriptors within deterministic quality budgets; it never owns a renderer. */
export class EffectManager {
  readonly #definitions = new Map<string, EffectDefinition>();
  readonly #active = new Map<string, { effect: ResolvedEffect; timer?: ReturnType<typeof setTimeout> }>();
  readonly #listeners = new Set<(event: EffectManagerEvent) => void>();
  #settings: EffectSettings;
  #sequence = 0;
  #activeParticles = 0;

  constructor(
    settings: (Partial<Omit<EffectSettings, 'quality'>> & { quality?: EffectQualityInput }) = {},
    definitions: readonly EffectDefinition[] = CORE_EFFECTS,
  ) {
    this.#settings = {
      quality: normalizeEffectQuality(settings.quality ?? 'HIGH'),
      reduceMotion: settings.reduceMotion ?? false,
      particlesEnabled: settings.particlesEnabled ?? true,
    };
    for (const definition of definitions) this.register(definition);
  }

  register(definition: EffectDefinition): void {
    if (this.#definitions.has(definition.id)) throw new Error(`Effect already registered: ${definition.id}`);
    if (definition.durationMs < 0 || (definition.particleCount ?? 0) < 0) {
      throw new Error(`Effect budget values cannot be negative: ${definition.id}`);
    }
    this.#definitions.set(definition.id, definition);
  }

  configure(settings: Partial<Omit<EffectSettings, 'quality'>> & { quality?: EffectQualityInput }): void {
    this.#settings = {
      ...this.#settings,
      ...settings,
      quality: settings.quality ? normalizeEffectQuality(settings.quality) : this.#settings.quality,
    };
    if (this.#settings.reduceMotion) {
      for (const [token, active] of this.#active) {
        const definition = this.#definitions.get(active.effect.id);
        if (definition?.unsafeForReducedMotion) this.#release(token);
      }
    }
  }

  settings(): Readonly<EffectSettings> {
    return Object.freeze({ ...this.#settings });
  }

  request(id: string, options: EffectRequestOptions = {}): EffectLease {
    const definition = this.#definitions.get(id);
    if (!definition) throw new Error(`Unknown effect: ${id}`);
    if (QUALITY_RANK[this.#settings.quality] < QUALITY_RANK[definition.minimumQuality]) {
      return this.#suppressed(id, 'quality');
    }
    if (this.#settings.reduceMotion && definition.unsafeForReducedMotion) {
      return this.#suppressed(id, 'reduced-motion');
    }

    const budget = BUDGET[this.#settings.quality];
    if (this.#active.size >= budget.maxConcurrent) {
      return this.#suppressed(id, 'concurrency-budget');
    }

    const requestedParticles =
      definition.kind === 'particles' && this.#settings.particlesEnabled
        ? Math.max(1, Math.round((definition.particleCount ?? 0) * budget.multiplier))
        : 0;
    const availableParticles = budget.particles - this.#activeParticles;
    if (requestedParticles > 0 && availableParticles <= 0) {
      return this.#suppressed(id, 'particle-budget');
    }
    const particleCount = Math.min(requestedParticles, Math.max(0, availableParticles));
    const token = `fx_${++this.#sequence}`;
    const effect: ResolvedEffect = Object.freeze({
      token,
      id,
      kind: definition.kind,
      durationMs: this.#settings.reduceMotion ? Math.min(definition.durationMs, 160) : definition.durationMs,
      particleCount,
      intensity: Math.max(0, Math.min(1, (definition.intensity ?? 1) * (options.intensity ?? 1))),
      color: definition.color,
      blendMode: definition.blendMode,
      anchor: options.anchor,
      seed: options.seed ?? this.#sequence,
    });
    this.#activeParticles += particleCount;
    const timer = effect.durationMs > 0 ? setTimeout(() => this.#release(token), effect.durationMs) : undefined;
    this.#active.set(token, { effect, timer });
    this.#emit({ type: 'accepted', effect });
    return {
      status: 'accepted',
      effect,
      release: () => this.#release(token),
    };
  }

  active(): readonly ResolvedEffect[] {
    return [...this.#active.values()].map(({ effect }) => effect);
  }

  subscribe(listener: (event: EffectManagerEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    for (const token of [...this.#active.keys()]) this.#release(token);
    this.#listeners.clear();
  }

  #suppressed(id: string, reason: Exclude<EffectLease['reason'], undefined>): EffectLease {
    this.#emit({ type: 'suppressed', id, reason });
    return { status: 'suppressed', reason, release: () => undefined };
  }

  #release(token: string): void {
    const active = this.#active.get(token);
    if (!active) return;
    if (active.timer) clearTimeout(active.timer);
    this.#active.delete(token);
    this.#activeParticles = Math.max(0, this.#activeParticles - active.effect.particleCount);
    this.#emit({ type: 'released', effect: active.effect });
  }

  #emit(event: EffectManagerEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}
