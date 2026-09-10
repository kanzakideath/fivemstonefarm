export type EffectQuality = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
export type EffectQualityInput = EffectQuality | Lowercase<EffectQuality>;

export function normalizeEffectQuality(quality: EffectQualityInput): EffectQuality {
  const normalized = quality.toUpperCase();
  if (normalized !== 'LOW' && normalized !== 'MEDIUM' && normalized !== 'HIGH' && normalized !== 'ULTRA') {
    throw new Error(`Unknown effect quality: ${quality}`);
  }
  return normalized;
}

export type MotionPhaseName =
  | 'anticipation'
  | 'action'
  | 'impact'
  | 'recovery'
  | 'reward';

export interface MotionPhase {
  name: MotionPhaseName;
  durationMs: number;
  easing: string;
  scale?: number;
  opacity?: number;
  translateY?: number;
  blurPx?: number;
  effectIds?: readonly string[];
  optional?: boolean;
}

export interface MotionRecipe {
  id: string;
  phases: readonly MotionPhase[];
  skippable: boolean;
  minimumQuality?: EffectQuality;
  reducedMotionFallback?: readonly MotionPhase[];
}

export interface ResolvedMotionPlan {
  id: string;
  phases: readonly MotionPhase[];
  totalDurationMs: number;
  reduced: boolean;
  skipped: boolean;
}

export interface MotionSettings {
  quality: EffectQuality;
  reduceMotion: boolean;
  animationSpeed: number;
}

export interface MotionPlaybackResult {
  status: 'completed' | 'cancelled' | 'skipped';
  elapsedMs: number;
}

export interface MotionPlaybackOptions {
  signal?: AbortSignal;
  skip?: boolean;
  onPhase?: (phase: MotionPhase, index: number) => void | Promise<void>;
}

type MotionListener = (settings: Readonly<MotionSettings>) => void;

const QUALITY_RANK: Readonly<Record<EffectQuality, number>> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  ULTRA: 3,
};

const QUALITY_DURATION_SCALE: Readonly<Record<EffectQuality, number>> = {
  LOW: 0.72,
  MEDIUM: 0.88,
  HIGH: 1,
  ULTRA: 1,
};

const reducedFade = (id: string, durationMs = 120): readonly MotionPhase[] => [
  { name: 'action', durationMs, easing: 'linear', opacity: 1 },
  { name: 'reward', durationMs: Math.round(durationMs * 0.6), easing: 'ease-out', opacity: 1 },
];

export const CORE_MOTION_RECIPES: readonly MotionRecipe[] = [
  {
    id: 'interaction.button',
    skippable: false,
    phases: [
      { name: 'anticipation', durationMs: 55, easing: 'ease-out', scale: 0.96 },
      { name: 'action', durationMs: 75, easing: 'cubic-bezier(.2,.8,.2,1)', scale: 1 },
      { name: 'impact', durationMs: 70, easing: 'ease-out', effectIds: ['ui.press-ripple'] },
      { name: 'recovery', durationMs: 90, easing: 'ease-out', scale: 1 },
    ],
    reducedMotionFallback: [{ name: 'action', durationMs: 65, easing: 'linear', opacity: 0.86 }],
  },
  {
    id: 'transition.route',
    skippable: true,
    phases: [
      { name: 'anticipation', durationMs: 90, easing: 'ease-in', opacity: 0.94 },
      { name: 'action', durationMs: 210, easing: 'cubic-bezier(.22,.8,.24,1)', opacity: 1, translateY: 12 },
      { name: 'recovery', durationMs: 140, easing: 'ease-out', translateY: 0 },
    ],
    reducedMotionFallback: reducedFade('transition.route'),
  },
  {
    id: 'card.select',
    skippable: false,
    phases: [
      { name: 'anticipation', durationMs: 70, easing: 'ease-out', scale: 0.985 },
      { name: 'action', durationMs: 120, easing: 'cubic-bezier(.18,.9,.3,1.15)', scale: 1.035 },
      { name: 'impact', durationMs: 140, easing: 'ease-out', effectIds: ['card.light-sweep'] },
      { name: 'recovery', durationMs: 180, easing: 'ease-out', scale: 1 },
    ],
    reducedMotionFallback: [{ name: 'action', durationMs: 90, easing: 'linear', opacity: 1 }],
  },
  {
    id: 'stone.level-up',
    skippable: true,
    phases: [
      { name: 'anticipation', durationMs: 180, easing: 'ease-in', scale: 0.98 },
      { name: 'action', durationMs: 260, easing: 'cubic-bezier(.2,.7,.2,1)', effectIds: ['level.energy-rise'] },
      { name: 'impact', durationMs: 110, easing: 'ease-out', effectIds: ['level.flash'] },
      { name: 'recovery', durationMs: 240, easing: 'ease-out' },
      { name: 'reward', durationMs: 420, easing: 'cubic-bezier(.18,.9,.24,1)', effectIds: ['level.stats-count'] },
    ],
    reducedMotionFallback: reducedFade('stone.level-up', 150),
  },
  {
    id: 'fusion.reveal',
    skippable: true,
    minimumQuality: 'MEDIUM',
    phases: [
      { name: 'anticipation', durationMs: 520, easing: 'ease-in', effectIds: ['fusion.gene-orbits'] },
      { name: 'action', durationMs: 760, easing: 'cubic-bezier(.55,0,.75,.35)', effectIds: ['fusion.convergence'] },
      { name: 'impact', durationMs: 130, easing: 'ease-out', effectIds: ['fusion.whiteout', 'screen.shake.medium'] },
      { name: 'recovery', durationMs: 440, easing: 'ease-out', effectIds: ['fusion.silhouette'] },
      { name: 'reward', durationMs: 680, easing: 'cubic-bezier(.17,.84,.3,1)', effectIds: ['fusion.inheritance'] },
    ],
    reducedMotionFallback: reducedFade('fusion.reveal', 180),
  },
  {
    id: 'awakening.reveal',
    skippable: true,
    minimumQuality: 'MEDIUM',
    phases: [
      { name: 'anticipation', durationMs: 650, easing: 'ease-in', effectIds: ['awakening.silence'] },
      { name: 'action', durationMs: 900, easing: 'cubic-bezier(.5,0,.8,.3)', effectIds: ['awakening.ascension'] },
      { name: 'impact', durationMs: 160, easing: 'ease-out', effectIds: ['awakening.burst'] },
      { name: 'recovery', durationMs: 480, easing: 'ease-out' },
      { name: 'reward', durationMs: 760, easing: 'cubic-bezier(.15,.8,.22,1)', effectIds: ['awakening.frame'] },
    ],
    reducedMotionFallback: reducedFade('awakening.reveal', 200),
  },
  {
    id: 'gacha.legendary',
    skippable: true,
    minimumQuality: 'HIGH',
    phases: [
      { name: 'anticipation', durationMs: 850, easing: 'ease-in', effectIds: ['gacha.audio-duck', 'gacha.void'] },
      { name: 'action', durationMs: 1050, easing: 'cubic-bezier(.55,0,.82,.25)', effectIds: ['gacha.fracture'] },
      { name: 'impact', durationMs: 170, easing: 'ease-out', effectIds: ['gacha.legendary-impact'] },
      { name: 'recovery', durationMs: 620, easing: 'ease-out', effectIds: ['gacha.reveal-aura'] },
      { name: 'reward', durationMs: 900, easing: 'cubic-bezier(.12,.85,.2,1)', effectIds: ['gacha.legendary-reward'] },
    ],
    reducedMotionFallback: reducedFade('gacha.legendary', 220),
  },
  {
    id: 'battle.skill-impact',
    skippable: true,
    phases: [
      { name: 'anticipation', durationMs: 140, easing: 'ease-in', scale: 0.985 },
      { name: 'action', durationMs: 190, easing: 'cubic-bezier(.4,0,.8,.3)', translateY: -5 },
      { name: 'impact', durationMs: 85, easing: 'ease-out', effectIds: ['battle.hit', 'screen.shake.light'] },
      { name: 'recovery', durationMs: 210, easing: 'ease-out', translateY: 0 },
      { name: 'reward', durationMs: 240, easing: 'ease-out', effectIds: ['battle.damage-number'] },
    ],
    reducedMotionFallback: reducedFade('battle.skill-impact', 100),
  },
];

/** Plans presentation beats; rendering remains owned by the UI/canvas adapter. */
export class MotionManager {
  readonly #recipes = new Map<string, MotionRecipe>();
  readonly #listeners = new Set<MotionListener>();
  #settings: MotionSettings;
  #systemPreferenceCleanup?: () => void;

  constructor(
    settings: (Partial<Omit<MotionSettings, 'quality'>> & { quality?: EffectQualityInput }) = {},
    recipes: readonly MotionRecipe[] = CORE_MOTION_RECIPES,
  ) {
    this.#settings = {
      quality: normalizeEffectQuality(settings.quality ?? 'HIGH'),
      reduceMotion: settings.reduceMotion ?? false,
      animationSpeed: Math.max(0.1, settings.animationSpeed ?? 1),
    };
    for (const recipe of recipes) this.register(recipe);
  }

  register(recipe: MotionRecipe): void {
    if (this.#recipes.has(recipe.id)) throw new Error(`Motion recipe already registered: ${recipe.id}`);
    if (recipe.phases.some((phase) => phase.durationMs < 0)) {
      throw new Error(`Motion phase duration cannot be negative: ${recipe.id}`);
    }
    this.#recipes.set(recipe.id, recipe);
  }

  replace(recipe: MotionRecipe): void {
    this.#recipes.set(recipe.id, recipe);
  }

  settings(): Readonly<MotionSettings> {
    return Object.freeze({ ...this.#settings });
  }

  configure(settings: Partial<Omit<MotionSettings, 'quality'>> & { quality?: EffectQualityInput }): void {
    this.#settings = {
      quality: settings.quality ? normalizeEffectQuality(settings.quality) : this.#settings.quality,
      reduceMotion: settings.reduceMotion ?? this.#settings.reduceMotion,
      animationSpeed: Math.max(0.1, settings.animationSpeed ?? this.#settings.animationSpeed),
    };
    const snapshot = this.settings();
    for (const listener of this.#listeners) listener(snapshot);
  }

  bindSystemReducedMotion(): () => void {
    this.#systemPreferenceCleanup?.();
    if (typeof matchMedia === 'undefined') return () => undefined;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => this.configure({ reduceMotion: query.matches });
    update();
    query.addEventListener?.('change', update);
    this.#systemPreferenceCleanup = () => query.removeEventListener?.('change', update);
    return this.#systemPreferenceCleanup;
  }

  subscribe(listener: MotionListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  plan(id: string, options: { skip?: boolean } = {}): ResolvedMotionPlan {
    const recipe = this.#recipes.get(id);
    if (!recipe) throw new Error(`Unknown motion recipe: ${id}`);
    if (options.skip && recipe.skippable) {
      return { id, phases: [], totalDurationMs: 0, reduced: this.#settings.reduceMotion, skipped: true };
    }

    const belowMinimum = recipe.minimumQuality
      ? QUALITY_RANK[this.#settings.quality] < QUALITY_RANK[recipe.minimumQuality]
      : false;
    const reduced = this.#settings.reduceMotion || belowMinimum;
    const source = reduced ? recipe.reducedMotionFallback ?? reducedFade(id) : recipe.phases;
    const scale = (reduced ? 1 : QUALITY_DURATION_SCALE[this.#settings.quality]) / this.#settings.animationSpeed;
    const phases = source
      .filter((phase) => !(this.#settings.quality === 'LOW' && phase.optional))
      .map((phase) => Object.freeze({ ...phase, durationMs: Math.max(0, Math.round(phase.durationMs * scale)) }));
    return Object.freeze({
      id,
      phases,
      totalDurationMs: phases.reduce((sum, phase) => sum + phase.durationMs, 0),
      reduced,
      skipped: false,
    });
  }

  async play(id: string, options: MotionPlaybackOptions = {}): Promise<MotionPlaybackResult> {
    const startedAt = Date.now();
    const plan = this.plan(id, { skip: options.skip });
    if (plan.skipped) return { status: 'skipped', elapsedMs: 0 };

    for (let index = 0; index < plan.phases.length; index += 1) {
      if (options.signal?.aborted) return { status: 'cancelled', elapsedMs: Date.now() - startedAt };
      const phase = plan.phases[index];
      await options.onPhase?.(phase, index);
      const completed = await wait(phase.durationMs, options.signal);
      if (!completed) return { status: 'cancelled', elapsedMs: Date.now() - startedAt };
    }
    return { status: 'completed', elapsedMs: Date.now() - startedAt };
  }

  dispose(): void {
    this.#systemPreferenceCleanup?.();
    this.#systemPreferenceCleanup = undefined;
    this.#listeners.clear();
  }
}

function wait(durationMs: number, signal?: AbortSignal): Promise<boolean> {
  if (durationMs <= 0) return Promise.resolve(!signal?.aborted);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve(true);
    }, durationMs);
    const abort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}
