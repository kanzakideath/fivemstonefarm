import { useCallback, useEffect, useRef } from 'react';
import { AudioManager, type AudioPlayback, type AudioPlayOptions } from '../systems/AudioManager';
import type { UiRoute, UiSettings, UiStone } from '../components/uiTypes';

const audio = new AudioManager();
const bgmScene: Record<UiRoute, string> = {
  home: 'home', expedition: 'expedition', endless: 'endless', facilities: 'research', mine: 'home', collection: 'collection', gacha: 'gacha', fusion: 'fusion', battle: 'battle', profile: 'profile', ranking: 'profile', settings: 'profile',
};

const rarityOrder = ['NORMAL', 'RARE', 'SR', 'SSR', 'UR', 'LEGENDARY'] as const;

export interface AudioSequenceStep {
  cueId: string;
  delayMs: number;
  options?: AudioPlayOptions;
}

interface SequenceAudioOutput {
  playCue(id: string, options?: AudioPlayOptions): Promise<AudioPlayback>;
}

interface SequenceClock {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timer: number): void;
}

const browserClock: SequenceClock = {
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (timer) => window.clearTimeout(timer),
};

/** Owns every delayed cue and playback belonging to one UI sequence. */
export class AudioSequenceController {
  readonly #timers = new Set<number>();
  readonly #playbacks = new Set<AudioPlayback>();
  #generation = 0;

  constructor(
    private readonly output: SequenceAudioOutput,
    private readonly clock: SequenceClock = browserClock,
  ) {}

  start(steps: readonly AudioSequenceStep[]): void {
    this.cancel();
    const generation = this.#generation;
    for (const step of steps) {
      if (step.delayMs <= 0) {
        void this.#play(step, generation);
        continue;
      }
      const timer = this.clock.setTimeout(() => {
        this.#timers.delete(timer);
        void this.#play(step, generation);
      }, step.delayMs);
      this.#timers.add(timer);
    }
  }

  cancel(): void {
    this.#generation += 1;
    for (const timer of this.#timers) this.clock.clearTimeout(timer);
    this.#timers.clear();
    for (const playback of this.#playbacks) playback.stop(30);
    this.#playbacks.clear();
  }

  pendingCount(): number {
    return this.#timers.size;
  }

  async #play(step: AudioSequenceStep, generation: number): Promise<void> {
    if (generation !== this.#generation) return;
    try {
      const playback = await this.output.playCue(step.cueId, step.options);
      if (generation !== this.#generation) {
        playback.stop(30);
        return;
      }
      if (playback.status === 'playing') this.#playbacks.add(playback);
    } catch {
      if (generation === this.#generation) this.cancel();
    }
  }
}

export function useGameAudio(route: UiRoute, settings: UiSettings) {
  const sequenceRef = useRef<AudioSequenceController | null>(null);
  if (!sequenceRef.current) sequenceRef.current = new AudioSequenceController(audio);
  const sequences = sequenceRef.current;

  useEffect(() => {
    audio.configure({
      muted: settings.muted,
      masterVolume: settings.masterVolume / 100,
      categoryVolumes: { bgm: settings.musicVolume / 100, ambience: settings.musicVolume / 100, ui: settings.effectsVolume / 100, gacha: settings.effectsVolume / 100, fusion: settings.effectsVolume / 100, battle: settings.effectsVolume / 100 },
    });
    if (settings.muted) sequences.cancel();
  }, [sequences, settings.effectsVolume, settings.masterVolume, settings.musicVolume, settings.muted]);

  useEffect(() => {
    sequences.cancel();
    return () => sequences.cancel();
  }, [route, sequences]);

  useEffect(() => {
    if (settings.muted) return;
    const start = async () => {
      if (await audio.unlock()) await audio.playBgm(bgmScene[route], { crossfadeMs: 900 });
    };
    if (audio.state() === 'ready') void audio.playBgm(bgmScene[route], { crossfadeMs: 900 });
    else document.addEventListener('pointerdown', start, { once: true, passive: true });
    return () => document.removeEventListener('pointerdown', start);
  }, [route, settings.muted]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest('button:not(:disabled)')) void audio.playCue('ui.click', { volume: .7 });
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);

  const playCue = useCallback((id: string, options?: { volume?: number; playbackRate?: number }) => {
    void audio.playCue(id, options).catch(() => undefined);
  }, []);

  const playGachaSequence = useCallback((stones: UiStone[], reducedMotion: boolean) => {
    if (!stones.length) {
      sequences.cancel();
      return;
    }
    const highest = [...stones].sort((a, b) => rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity))[0];
    const speed = reducedMotion ? .05 : 1;
    const steps: AudioSequenceStep[] = [];
    if (rarityOrder.indexOf(highest.rarity) >= 3) steps.push({ cueId: 'gacha.rare-hint', delayMs: 180 * speed });
    const tickCount = reducedMotion ? 1 : 22;
    for (let index = 0; index < tickCount; index += 1) {
      steps.push({ cueId: 'gacha.tick', options: { volume: .55, playbackRate: .78 + index * .025 }, delayMs: (500 + index * 125) * speed });
    }
    steps.push({ cueId: 'gacha.impact', delayMs: reducedMotion ? 90 : 3440 });
    steps.push({ cueId: highest.rarity === 'LEGENDARY' ? 'gacha.reveal.legendary' : highest.rarity === 'UR' ? 'gacha.reveal.ur' : highest.rarity === 'SSR' ? 'gacha.reveal.ssr' : 'result.reward', delayMs: reducedMotion ? 130 : 3920 });
    sequences.start(steps);
  }, [sequences]);

  const playFusionSequence = useCallback((reducedMotion: boolean) => {
    sequences.start([
      { cueId: 'fusion.energy', delayMs: 0 },
      { cueId: 'fusion.reveal', delayMs: reducedMotion ? 120 : 2900 },
    ]);
  }, [sequences]);

  const playBattleSequence = useCallback(() => {
    sequences.start([520, 1120, 1750, 2440].map((delayMs, index) => ({ cueId: index === 3 ? 'battle.critical' : 'battle.hit', options: { playbackRate: .9 + index * .07 }, delayMs })));
  }, [sequences]);

  const cancelSequences = useCallback(() => sequences.cancel(), [sequences]);

  return { playCue, playGachaSequence, playFusionSequence, playBattleSequence, cancelSequences };
}
