import {
  AUDIO_CUES,
  BGM_REGISTRY,
  type AudioCategory,
  type AudioCueDefinition,
  type BgmDefinition,
  type BgmScene,
  type SynthTone,
} from '../assets/audioManifest';
import type { AssetRegistry } from './AssetRegistry';
import type { StructuredLogger } from './StructuredLogger';

export type AudioManagerState = 'locked' | 'ready' | 'suspended' | 'unavailable' | 'closed';

export interface AudioSettings {
  muted: boolean;
  masterVolume: number;
  categoryVolumes: Readonly<Record<AudioCategory, number>>;
}

export interface AudioPlayOptions {
  volume?: number;
  playbackRate?: number;
  pan?: number;
}

export interface AudioPlayback {
  status: 'playing' | 'suppressed' | 'unavailable';
  source?: 'asset' | 'synth';
  reason?: 'muted' | 'cooldown' | 'voice-limit' | 'audio-unavailable';
  stop(fadeOutMs?: number): void;
}

export interface BgmPlayback {
  status: 'playing' | 'unavailable';
  id?: string;
  source?: 'asset' | 'synth';
}

export type AudioManagerEvent =
  | { type: 'state'; state: AudioManagerState }
  | { type: 'cue'; id: string; source: 'asset' | 'synth' }
  | { type: 'bgm'; id: string; source: 'asset' | 'synth' }
  | { type: 'fallback'; id: string; reason: string };

export interface AudioManagerOptions {
  assetRegistry?: AssetRegistry;
  logger?: StructuredLogger;
  cueRegistry?: readonly AudioCueDefinition[];
  bgmRegistry?: readonly BgmDefinition[];
  contextFactory?: () => AudioContext;
  settings?: Partial<Omit<AudioSettings, 'categoryVolumes'>> & {
    categoryVolumes?: Partial<Record<AudioCategory, number>>;
  };
}

interface BgmVoice {
  definition: BgmDefinition;
  source: 'asset' | 'synth';
  bus: GainNode;
  filter: BiquadFilterNode;
  nodes: readonly AudioScheduledSourceNode[];
  stopTimer?: ReturnType<typeof setTimeout>;
}

const CATEGORIES: readonly AudioCategory[] = [
  'ui',
  'home',
  'gacha',
  'fusion',
  'battle',
  'result',
  'levelUp',
  'achievement',
  'affinity',
  'raid',
  'bgm',
  'ambience',
];

const DEFAULT_CATEGORY_VOLUMES: Readonly<Record<AudioCategory, number>> = {
  ui: 0.8,
  home: 0.75,
  gacha: 0.9,
  fusion: 0.9,
  battle: 0.9,
  result: 0.85,
  levelUp: 0.85,
  achievement: 0.85,
  affinity: 0.78,
  raid: 0.9,
  bgm: 0.58,
  ambience: 0.5,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function defaultContextFactory(): AudioContext {
  const audioGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Context = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
  if (!Context) throw new Error('Web Audio API is unavailable.');
  return new Context();
}

/**
 * Lazy WebAudio graph with registered synthesized fallbacks.
 * No AudioContext is created until `unlock`/play is called from user interaction.
 */
export class AudioManager {
  readonly #assets?: AssetRegistry;
  readonly #logger?: StructuredLogger;
  readonly #contextFactory: () => AudioContext;
  readonly #cues = new Map<string, AudioCueDefinition>();
  readonly #bgm = new Map<string, BgmDefinition>();
  readonly #listeners = new Set<(event: AudioManagerEvent) => void>();
  readonly #buffers = new Map<string, Promise<AudioBuffer | undefined>>();
  readonly #lastPlayedAt = new Map<string, number>();
  readonly #voiceCounts = new Map<string, number>();
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();
  #context?: AudioContext;
  #master?: GainNode;
  #categoryGains = new Map<AudioCategory, GainNode>();
  #state: AudioManagerState = 'locked';
  #settings: AudioSettings;
  #currentBgm?: BgmVoice;
  #bgmIntensity = 0.5;

  constructor(options: AudioManagerOptions = {}) {
    this.#assets = options.assetRegistry;
    this.#logger = options.logger;
    this.#contextFactory = options.contextFactory ?? defaultContextFactory;
    for (const cue of options.cueRegistry ?? AUDIO_CUES) {
      if (this.#cues.has(cue.id)) throw new Error(`Duplicate audio cue: ${cue.id}`);
      if (!cue.assetId && cue.synth.length === 0) throw new Error(`Audio cue has no asset or fallback: ${cue.id}`);
      this.#cues.set(cue.id, cue);
    }
    for (const bgm of options.bgmRegistry ?? BGM_REGISTRY) {
      if (this.#bgm.has(bgm.id)) throw new Error(`Duplicate BGM definition: ${bgm.id}`);
      if (!bgm.assetId && bgm.fallbackChordHz.length === 0) throw new Error(`BGM has no asset or fallback: ${bgm.id}`);
      this.#bgm.set(bgm.id, bgm);
    }
    this.#settings = {
      muted: options.settings?.muted ?? false,
      masterVolume: clamp01(options.settings?.masterVolume ?? 0.8),
      categoryVolumes: Object.freeze({
        ...DEFAULT_CATEGORY_VOLUMES,
        ...Object.fromEntries(
          Object.entries(options.settings?.categoryVolumes ?? {}).map(([key, value]) => [
            key,
            clamp01(value),
          ]),
        ),
      }) as Readonly<Record<AudioCategory, number>>,
    };
  }

  state(): AudioManagerState {
    return this.#state;
  }

  settings(): AudioSettings {
    return Object.freeze({
      ...this.#settings,
      categoryVolumes: Object.freeze({ ...this.#settings.categoryVolumes }),
    });
  }

  async unlock(): Promise<boolean> {
    if (this.#state === 'closed' || this.#state === 'unavailable') return false;
    try {
      if (!this.#context) this.#createGraph();
      if (this.#context?.state === 'suspended') await this.#context.resume();
      this.#setState(this.#context?.state === 'running' ? 'ready' : 'suspended');
      return this.#state === 'ready';
    } catch (error) {
      this.#setState('unavailable');
      this.#logger?.warn({
        domain: 'audio',
        event: 'audio.context.unavailable',
        error,
      });
      return false;
    }
  }

  configure(
    settings: Partial<Omit<AudioSettings, 'categoryVolumes'>> & {
      categoryVolumes?: Partial<Record<AudioCategory, number>>;
    },
  ): void {
    this.#settings = {
      muted: settings.muted ?? this.#settings.muted,
      masterVolume: clamp01(settings.masterVolume ?? this.#settings.masterVolume),
      categoryVolumes: Object.freeze({
        ...this.#settings.categoryVolumes,
        ...Object.fromEntries(
          Object.entries(settings.categoryVolumes ?? {}).map(([key, value]) => [
            key,
            clamp01(value),
          ]),
        ),
      }) as Readonly<Record<AudioCategory, number>>,
    };
    this.#applyVolumes();
  }

  async playCue(id: string, options: AudioPlayOptions = {}): Promise<AudioPlayback> {
    const definition = this.#cues.get(id);
    if (!definition) throw new Error(`Unknown audio cue: ${id}`);
    if (this.#settings.muted || this.#settings.masterVolume <= 0) {
      return this.#silentPlayback('suppressed', 'muted');
    }

    const now = Date.now();
    if (now - (this.#lastPlayedAt.get(id) ?? -Infinity) < (definition.cooldownMs ?? 0)) {
      return this.#silentPlayback('suppressed', 'cooldown');
    }
    if ((this.#voiceCounts.get(id) ?? 0) >= (definition.maxVoices ?? 6)) {
      return this.#silentPlayback('suppressed', 'voice-limit');
    }

    this.#lastPlayedAt.set(id, now);
    this.#voiceCounts.set(id, (this.#voiceCounts.get(id) ?? 0) + 1);
    let reservationReleased = false;
    const releaseReservation = () => {
      if (reservationReleased) return;
      reservationReleased = true;
      this.#voiceCounts.set(id, Math.max(0, (this.#voiceCounts.get(id) ?? 1) - 1));
    };

    if (!(await this.unlock()) || !this.#context) {
      releaseReservation();
      return this.#silentPlayback('unavailable', 'audio-unavailable');
    }

    let source: 'asset' | 'synth' = 'synth';
    let nodes: readonly AudioScheduledSourceNode[] = [];
    try {
      const buffer = definition.assetId ? await this.#loadBuffer(definition.assetId) : undefined;
      if (buffer) {
        source = 'asset';
        nodes = this.#playBuffer(buffer, definition.category, options);
      } else {
        nodes = this.#playSynth(definition.synth, definition.category, options);
      }
    } catch (error) {
      this.#emit({ type: 'fallback', id, reason: error instanceof Error ? error.message : String(error) });
      nodes = this.#playSynth(definition.synth, definition.category, options);
    }

    const maximumMs = Math.max(
      50,
      ...definition.synth.map((tone) => (tone.offsetMs ?? 0) + tone.durationMs),
    ) / Math.max(0.25, options.playbackRate ?? 1);
    const timer = setTimeout(() => {
      this.#timers.delete(timer);
      releaseReservation();
    }, maximumMs + 80);
    this.#timers.add(timer);
    this.#emit({ type: 'cue', id, source });
    this.#logger?.debug({ domain: 'audio', event: 'audio.cue.played', data: { id, source } });

    let stopped = false;
    return {
      status: 'playing',
      source,
      stop: (fadeOutMs = 0) => {
        if (stopped) return;
        stopped = true;
        const stopAt = this.#context!.currentTime + Math.max(0, fadeOutMs) / 1000;
        for (const node of nodes) {
          try {
            node.stop(stopAt);
          } catch {
            // Source may already have ended.
          }
        }
        clearTimeout(timer);
        this.#timers.delete(timer);
        releaseReservation();
      },
    };
  }

  async playBgm(
    sceneOrId: BgmScene | string,
    options: { crossfadeMs?: number; restart?: boolean } = {},
  ): Promise<BgmPlayback> {
    const definition =
      this.#bgm.get(sceneOrId) ?? [...this.#bgm.values()].find((candidate) => candidate.scene === sceneOrId);
    if (!definition) throw new Error(`Unknown BGM scene or id: ${sceneOrId}`);
    if (this.#currentBgm?.definition.id === definition.id && !options.restart) {
      return { status: 'playing', id: definition.id, source: this.#currentBgm.source };
    }
    if (!(await this.unlock()) || !this.#context || !this.#categoryGains.get('bgm')) {
      return { status: 'unavailable' };
    }

    const crossfadeMs = Math.max(0, options.crossfadeMs ?? definition.defaultCrossfadeMs);
    const previous = this.#currentBgm;
    const voice = await this.#createBgmVoice(definition);
    this.#currentBgm = voice;
    const now = this.#context.currentTime;
    const targetGain = this.#bgmTargetGain(definition);
    voice.bus.gain.cancelScheduledValues(now);
    voice.bus.gain.setValueAtTime(0, now);
    voice.bus.gain.linearRampToValueAtTime(targetGain, now + crossfadeMs / 1000);

    if (previous) this.#fadeAndStopBgm(previous, crossfadeMs);
    this.#emit({ type: 'bgm', id: definition.id, source: voice.source });
    this.#logger?.info({
      domain: 'audio',
      event: 'audio.bgm.changed',
      data: { id: definition.id, scene: definition.scene, source: voice.source, crossfadeMs },
    });
    return { status: 'playing', id: definition.id, source: voice.source };
  }

  stopBgm(fadeOutMs = 500): void {
    if (!this.#currentBgm) return;
    const voice = this.#currentBgm;
    this.#currentBgm = undefined;
    this.#fadeAndStopBgm(voice, fadeOutMs);
  }

  setBgmIntensity(intensity: number, rampMs = 250): void {
    this.#bgmIntensity = clamp01(intensity);
    if (!this.#currentBgm || !this.#context) return;
    const now = this.#context.currentTime;
    const voice = this.#currentBgm;
    voice.bus.gain.cancelScheduledValues(now);
    voice.bus.gain.setValueAtTime(voice.bus.gain.value, now);
    voice.bus.gain.linearRampToValueAtTime(this.#bgmTargetGain(voice.definition), now + Math.max(0, rampMs) / 1000);
    voice.filter.frequency.cancelScheduledValues(now);
    voice.filter.frequency.linearRampToValueAtTime(700 + 5000 * this.#bgmIntensity, now + Math.max(0, rampMs) / 1000);
  }

  duckBgm(amount = 0.7, holdMs = 180, recoveryMs = 450): void {
    if (!this.#currentBgm || !this.#context) return;
    const now = this.#context.currentTime;
    const gain = this.#currentBgm.bus.gain;
    const target = this.#bgmTargetGain(this.#currentBgm.definition);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(target * (1 - clamp01(amount)), now + 0.04);
    gain.setValueAtTime(target * (1 - clamp01(amount)), now + Math.max(0, holdMs) / 1000);
    gain.linearRampToValueAtTime(target, now + (Math.max(0, holdMs) + Math.max(0, recoveryMs)) / 1000);
  }

  subscribe(listener: (event: AudioManagerEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.stopBgm(0);
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
    this.#buffers.clear();
    this.#listeners.clear();
    if (this.#context && this.#context.state !== 'closed') await this.#context.close();
    this.#context = undefined;
    this.#master = undefined;
    this.#categoryGains.clear();
    this.#setState('closed');
  }

  #createGraph(): void {
    this.#context = this.#contextFactory();
    this.#master = this.#context.createGain();
    this.#master.connect(this.#context.destination);
    this.#categoryGains.clear();
    for (const category of CATEGORIES) {
      const gain = this.#context.createGain();
      gain.connect(this.#master);
      this.#categoryGains.set(category, gain);
    }
    this.#applyVolumes();
  }

  #applyVolumes(): void {
    if (!this.#context || !this.#master) return;
    const now = this.#context.currentTime;
    this.#master.gain.setTargetAtTime(
      this.#settings.muted ? 0 : this.#settings.masterVolume,
      now,
      0.015,
    );
    for (const [category, gain] of this.#categoryGains) {
      gain.gain.setTargetAtTime(this.#settings.categoryVolumes[category], now, 0.015);
    }
  }

  async #loadBuffer(assetId: string): Promise<AudioBuffer | undefined> {
    const existing = this.#buffers.get(assetId);
    if (existing) return existing;
    const operation = this.#decodeAsset(assetId);
    this.#buffers.set(assetId, operation);
    return operation;
  }

  async #decodeAsset(assetId: string): Promise<AudioBuffer | undefined> {
    if (!this.#assets || !this.#context) return undefined;
    const known = this.#assets.get(assetId);
    if (!known) {
      this.#emit({ type: 'fallback', id: assetId, reason: 'asset-not-registered' });
      return undefined;
    }
    const asset = known.status === 'ready' || known.status === 'placeholder'
      ? known
      : await this.#assets.load(assetId);
    if (asset.placeholderUsed || asset.status !== 'ready' || !asset.resolvedUrl) return undefined;
    try {
      const response = await fetch(asset.resolvedUrl, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Audio request failed (${response.status})`);
      return await this.#context.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      this.#logger?.warn({
        domain: 'audio',
        event: 'audio.asset.decode_failed',
        data: { assetId },
        error,
      });
      this.#emit({ type: 'fallback', id: assetId, reason: 'asset-decode-failed' });
      return undefined;
    }
  }

  #playBuffer(
    buffer: AudioBuffer,
    category: AudioCategory,
    options: AudioPlayOptions,
  ): readonly AudioScheduledSourceNode[] {
    const context = this.#context!;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.25, Math.min(4, options.playbackRate ?? 1));
    const gain = context.createGain();
    gain.gain.value = clamp01(options.volume ?? 1);
    source.connect(gain);
    this.#connectWithPan(gain, category, options.pan);
    source.start();
    return [source];
  }

  #playSynth(
    recipe: readonly SynthTone[],
    category: AudioCategory,
    options: AudioPlayOptions,
  ): readonly AudioScheduledSourceNode[] {
    const context = this.#context!;
    const output: AudioScheduledSourceNode[] = [];
    const rate = Math.max(0.25, Math.min(4, options.playbackRate ?? 1));
    for (const tone of recipe) {
      output.push(this.#createSynthTone(tone, category, clamp01(options.volume ?? 1), rate, options.pan));
    }
    return output;
  }

  #createSynthTone(
    tone: SynthTone,
    category: AudioCategory,
    volume: number,
    playbackRate: number,
    pan?: number,
  ): AudioScheduledSourceNode {
    const context = this.#context!;
    const startsAt = context.currentTime + (tone.offsetMs ?? 0) / 1000 / playbackRate;
    const duration = tone.durationMs / 1000 / playbackRate;
    const gain = context.createGain();
    const peak = Math.max(0.0001, tone.gain * volume);
    const attack = Math.min(duration * 0.45, (tone.attackMs ?? 8) / 1000 / playbackRate);
    const release = Math.min(duration * 0.7, (tone.releaseMs ?? Math.min(90, tone.durationMs * 0.35)) / 1000 / playbackRate);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(peak, startsAt + Math.max(0.002, attack));
    gain.gain.setValueAtTime(peak, Math.max(startsAt + attack, startsAt + duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    this.#connectWithPan(gain, category, pan);

    if (tone.wave === 'noise') {
      const frameCount = Math.max(1, Math.ceil(context.sampleRate * duration));
      const buffer = context.createBuffer(1, frameCount, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start(startsAt);
      source.stop(startsAt + duration);
      return source;
    }

    const oscillator = context.createOscillator();
    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.frequency, startsAt);
    if (tone.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency), startsAt + duration);
    }
    oscillator.connect(gain);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.01);
    return oscillator;
  }

  #connectWithPan(input: AudioNode, category: AudioCategory, pan?: number): void {
    const destination = this.#categoryGains.get(category)!;
    if (typeof this.#context!.createStereoPanner === 'function' && pan !== undefined) {
      const panner = this.#context!.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      input.connect(panner);
      panner.connect(destination);
    } else {
      input.connect(destination);
    }
  }

  async #createBgmVoice(definition: BgmDefinition): Promise<BgmVoice> {
    const context = this.#context!;
    const bus = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700 + 5000 * this.#bgmIntensity;
    bus.connect(filter);
    filter.connect(this.#categoryGains.get('bgm')!);

    const buffer = definition.assetId ? await this.#loadBuffer(definition.assetId) : undefined;
    if (buffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = Math.max(0, definition.loopStartSeconds);
      source.loopEnd = definition.loopEndSeconds ?? buffer.duration;
      source.connect(bus);
      source.start(0, Math.min(source.loopStart, Math.max(0, buffer.duration - 0.01)));
      return { definition, source: 'asset', bus, filter, nodes: [source] };
    }

    const nodes = definition.fallbackChordHz.map((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = definition.fallbackWave;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = (index - definition.fallbackChordHz.length / 2) * 3;
      const voiceGain = context.createGain();
      voiceGain.gain.value = 1 / Math.max(1, definition.fallbackChordHz.length);
      oscillator.connect(voiceGain);
      voiceGain.connect(bus);
      oscillator.start();
      return oscillator;
    });
    this.#emit({ type: 'fallback', id: definition.id, reason: 'using-synthesized-bgm' });
    return { definition, source: 'synth', bus, filter, nodes };
  }

  #fadeAndStopBgm(voice: BgmVoice, fadeOutMs: number): void {
    if (!this.#context) return;
    if (voice.stopTimer) clearTimeout(voice.stopTimer);
    const now = this.#context.currentTime;
    const duration = Math.max(0, fadeOutMs);
    voice.bus.gain.cancelScheduledValues(now);
    voice.bus.gain.setValueAtTime(voice.bus.gain.value, now);
    voice.bus.gain.linearRampToValueAtTime(0, now + duration / 1000);
    const timer = setTimeout(() => {
      this.#timers.delete(timer);
      for (const node of voice.nodes) {
        try {
          node.stop();
        } catch {
          // Source may already have ended.
        }
      }
      voice.bus.disconnect();
      voice.filter.disconnect();
    }, duration + 30);
    voice.stopTimer = timer;
    this.#timers.add(timer);
  }

  #bgmTargetGain(definition: BgmDefinition): number {
    return definition.baseGain * (0.55 + this.#bgmIntensity * 0.45);
  }

  #silentPlayback(
    status: 'suppressed' | 'unavailable',
    reason: Exclude<AudioPlayback['reason'], undefined>,
  ): AudioPlayback {
    return { status, reason, stop: () => undefined };
  }

  #setState(state: AudioManagerState): void {
    if (this.#state === state) return;
    this.#state = state;
    this.#emit({ type: 'state', state });
  }

  #emit(event: AudioManagerEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}
