export type AudioCategory =
  | 'ui'
  | 'home'
  | 'gacha'
  | 'fusion'
  | 'battle'
  | 'result'
  | 'levelUp'
  | 'achievement'
  | 'affinity'
  | 'raid'
  | 'bgm'
  | 'ambience';

export type SynthWave = OscillatorType | 'noise';

export interface SynthTone {
  wave: SynthWave;
  frequency: number;
  endFrequency?: number;
  offsetMs?: number;
  durationMs: number;
  gain: number;
  attackMs?: number;
  releaseMs?: number;
}

export interface AudioCueDefinition {
  id: string;
  category: AudioCategory;
  /** Logical AssetRegistry id. Undefined cues always use their synthesis recipe. */
  assetId?: string;
  synth: readonly SynthTone[];
  cooldownMs?: number;
  maxVoices?: number;
  notes?: string;
}

export type BgmScene =
  | 'home'
  | 'collection'
  | 'gacha'
  | 'fusion'
  | 'battle'
  | 'boss'
  | 'raid'
  | 'profile'
  | 'expedition'
  | 'endless'
  | 'idle-report'
  | 'research';

export interface BgmDefinition {
  id: string;
  scene: BgmScene;
  assetId?: string;
  bpm: number;
  loopStartSeconds: number;
  loopEndSeconds?: number;
  defaultCrossfadeMs: number;
  /** Sustained fallback chord. It is intentionally modest, not presented as final music. */
  fallbackChordHz: readonly number[];
  fallbackWave: OscillatorType;
  baseGain: number;
}

const tone = (
  wave: SynthWave,
  frequency: number,
  durationMs: number,
  gain: number,
  extras: Partial<SynthTone> = {},
): SynthTone => ({ wave, frequency, durationMs, gain, ...extras });

export const AUDIO_CUES: readonly AudioCueDefinition[] = [
  { id: 'ui.hover', category: 'ui', cooldownMs: 35, maxVoices: 2, synth: [tone('sine', 740, 34, 0.025, { endFrequency: 820, releaseMs: 22 })] },
  { id: 'ui.click', category: 'ui', cooldownMs: 25, maxVoices: 3, synth: [tone('triangle', 420, 65, 0.07, { endFrequency: 560, attackMs: 4 })] },
  { id: 'ui.back', category: 'ui', synth: [tone('sine', 460, 90, 0.06, { endFrequency: 280 })] },
  { id: 'ui.confirm', category: 'ui', synth: [tone('sine', 520, 110, 0.07), tone('triangle', 780, 140, 0.045, { offsetMs: 55 })] },
  { id: 'ui.cancel', category: 'ui', synth: [tone('triangle', 260, 95, 0.055, { endFrequency: 175 })] },
  { id: 'ui.tab', category: 'ui', cooldownMs: 45, synth: [tone('sine', 610, 55, 0.05, { endFrequency: 690 })] },
  { id: 'ui.notification', category: 'ui', synth: [tone('sine', 880, 135, 0.055), tone('sine', 1174, 170, 0.04, { offsetMs: 75 })] },
  { id: 'result.reward', category: 'result', synth: [tone('triangle', 392, 180, 0.07), tone('triangle', 523, 200, 0.065, { offsetMs: 80 }), tone('sine', 784, 280, 0.055, { offsetMs: 170 })] },
  { id: 'level.up', category: 'levelUp', synth: [tone('square', 392, 100, 0.035), tone('triangle', 523, 150, 0.06, { offsetMs: 75 }), tone('sine', 784, 300, 0.065, { offsetMs: 165 })] },
  { id: 'achievement.unlock', category: 'achievement', synth: [tone('triangle', 330, 220, 0.05), tone('sine', 660, 460, 0.07, { offsetMs: 90 }), tone('noise', 1200, 210, 0.02, { offsetMs: 100 })] },
  { id: 'gacha.tick', category: 'gacha', cooldownMs: 20, maxVoices: 4, synth: [tone('square', 950, 22, 0.028, { endFrequency: 760 })] },
  { id: 'gacha.rare-hint', category: 'gacha', synth: [tone('sine', 220, 480, 0.055, { endFrequency: 660, attackMs: 80 })] },
  { id: 'gacha.impact', category: 'gacha', synth: [tone('noise', 90, 360, 0.085), tone('sine', 62, 440, 0.12, { endFrequency: 38 })] },
  { id: 'gacha.reveal.ssr', category: 'gacha', synth: [tone('triangle', 523, 400, 0.07), tone('sine', 1046, 750, 0.07, { offsetMs: 80 }), tone('noise', 1500, 300, 0.028)] },
  { id: 'gacha.reveal.ur', category: 'gacha', synth: [tone('sine', 392, 520, 0.07), tone('triangle', 784, 620, 0.075, { offsetMs: 90 }), tone('sine', 1174, 900, 0.06, { offsetMs: 180 })] },
  { id: 'gacha.reveal.legendary', category: 'gacha', maxVoices: 1, synth: [tone('noise', 60, 620, 0.09), tone('sine', 55, 900, 0.13, { endFrequency: 110 }), tone('triangle', 880, 1300, 0.075, { offsetMs: 420, attackMs: 160 })] },
  { id: 'fusion.energy', category: 'fusion', synth: [tone('sawtooth', 90, 950, 0.035, { endFrequency: 520, attackMs: 260 })] },
  { id: 'fusion.reveal', category: 'fusion', synth: [tone('noise', 600, 240, 0.045), tone('sine', 196, 500, 0.09, { endFrequency: 784 })] },
  { id: 'battle.hit', category: 'battle', cooldownMs: 30, maxVoices: 4, synth: [tone('noise', 140, 100, 0.06), tone('square', 85, 130, 0.055, { endFrequency: 48 })] },
  { id: 'battle.critical', category: 'battle', cooldownMs: 80, synth: [tone('noise', 160, 260, 0.09), tone('sawtooth', 160, 300, 0.07, { endFrequency: 52 })] },
  { id: 'battle.ultimate', category: 'battle', maxVoices: 1, synth: [tone('sine', 55, 900, 0.1, { endFrequency: 220, attackMs: 240 }), tone('noise', 800, 380, 0.055, { offsetMs: 500 })] },
  { id: 'affinity.rank-up', category: 'affinity', synth: [tone('sine', 440, 260, 0.055), tone('sine', 659, 380, 0.06, { offsetMs: 130 })] },
  { id: 'battle.start', category: 'battle', maxVoices: 1, synth: [tone('noise', 85, 320, 0.06), tone('triangle', 110, 420, 0.07, { endFrequency: 220 })] },
  { id: 'battle.turn', category: 'battle', cooldownMs: 90, synth: [tone('triangle', 510, 65, 0.045, { endFrequency: 640 })] },
  { id: 'battle.attack', category: 'battle', cooldownMs: 35, maxVoices: 4, synth: [tone('sawtooth', 190, 95, 0.045, { endFrequency: 90 })] },
  { id: 'battle.skill', category: 'battle', cooldownMs: 80, synth: [tone('sine', 330, 210, 0.055, { endFrequency: 720 }), tone('noise', 900, 90, 0.018, { offsetMs: 80 })] },
  { id: 'battle.buff', category: 'battle', synth: [tone('sine', 440, 190, 0.045), tone('sine', 660, 240, 0.04, { offsetMs: 75 })] },
  { id: 'battle.debuff', category: 'battle', synth: [tone('triangle', 310, 230, 0.05, { endFrequency: 155 })] },
  { id: 'battle.break', category: 'battle', maxVoices: 1, synth: [tone('noise', 100, 420, 0.095), tone('square', 72, 520, 0.08, { endFrequency: 36 })] },
  { id: 'battle.boss-phase', category: 'battle', maxVoices: 1, synth: [tone('sine', 48, 850, 0.11, { endFrequency: 96 }), tone('noise', 420, 500, 0.035, { offsetMs: 260 })] },
  { id: 'battle.victory', category: 'result', maxVoices: 1, synth: [tone('triangle', 392, 260, 0.06), tone('triangle', 523, 320, 0.06, { offsetMs: 100 }), tone('sine', 784, 620, 0.065, { offsetMs: 230 })] },
  { id: 'battle.defeat', category: 'result', maxVoices: 1, synth: [tone('triangle', 220, 360, 0.055, { endFrequency: 110 }), tone('sine', 82, 620, 0.055, { offsetMs: 120 })] },
  { id: 'expedition.start', category: 'result', synth: [tone('triangle', 294, 180, 0.05), tone('sine', 587, 360, 0.05, { offsetMs: 90 })] },
  { id: 'expedition.event', category: 'ui', cooldownMs: 120, synth: [tone('sine', 690, 95, 0.04), tone('triangle', 920, 110, 0.025, { offsetMs: 45 })] },
  { id: 'expedition.return', category: 'result', maxVoices: 1, synth: [tone('triangle', 262, 260, 0.055), tone('sine', 523, 480, 0.06, { offsetMs: 120 })] },
  { id: 'expedition.rare-signal', category: 'result', maxVoices: 1, synth: [tone('noise', 45, 500, 0.035), tone('sine', 130, 900, 0.085, { endFrequency: 1040, attackMs: 260 }), tone('triangle', 1318, 580, 0.045, { offsetMs: 620 })] },
  { id: 'idle.welcome', category: 'result', maxVoices: 1, synth: [tone('sine', 196, 320, 0.045), tone('triangle', 392, 420, 0.05, { offsetMs: 120 }), tone('sine', 659, 520, 0.045, { offsetMs: 250 })] },
  { id: 'training.complete', category: 'levelUp', synth: [tone('triangle', 440, 150, 0.045), tone('sine', 880, 300, 0.05, { offsetMs: 80 })] },
  { id: 'research.complete', category: 'achievement', synth: [tone('sine', 349, 240, 0.04), tone('sine', 698, 420, 0.055, { offsetMs: 110 })] },
  { id: 'endless.floor-clear', category: 'battle', cooldownMs: 160, synth: [tone('triangle', 370, 110, 0.045), tone('sine', 740, 190, 0.04, { offsetMs: 55 })] },
  { id: 'endless.checkpoint', category: 'result', maxVoices: 1, synth: [tone('square', 110, 260, 0.035), tone('triangle', 440, 440, 0.06, { offsetMs: 100 })] },
];

export const BGM_REGISTRY: readonly BgmDefinition[] = [
  { id: 'bgm.home.starlit-quarry', scene: 'home', bpm: 76, loopStartSeconds: 0, defaultCrossfadeMs: 1600, fallbackChordHz: [110, 164.81, 220], fallbackWave: 'sine', baseGain: 0.045 },
  { id: 'bgm.collection.memory-vault', scene: 'collection', bpm: 68, loopStartSeconds: 0, defaultCrossfadeMs: 1300, fallbackChordHz: [98, 146.83, 196], fallbackWave: 'triangle', baseGain: 0.035 },
  { id: 'bgm.gacha.core-pulse', scene: 'gacha', bpm: 118, loopStartSeconds: 0, defaultCrossfadeMs: 750, fallbackChordHz: [82.41, 123.47, 164.81], fallbackWave: 'sawtooth', baseGain: 0.025 },
  { id: 'bgm.fusion.alchemical-bonds', scene: 'fusion', bpm: 92, loopStartSeconds: 0, defaultCrossfadeMs: 900, fallbackChordHz: [73.42, 110, 146.83], fallbackWave: 'triangle', baseGain: 0.035 },
  { id: 'bgm.battle.fault-line', scene: 'battle', bpm: 132, loopStartSeconds: 0, defaultCrossfadeMs: 500, fallbackChordHz: [65.41, 98, 130.81], fallbackWave: 'sawtooth', baseGain: 0.022 },
  { id: 'bgm.boss.tectonic-crown', scene: 'boss', bpm: 146, loopStartSeconds: 0, defaultCrossfadeMs: 350, fallbackChordHz: [55, 82.41, 110], fallbackWave: 'square', baseGain: 0.018 },
  { id: 'bgm.raid.convergence', scene: 'raid', bpm: 126, loopStartSeconds: 0, defaultCrossfadeMs: 600, fallbackChordHz: [61.74, 92.5, 123.47], fallbackWave: 'sawtooth', baseGain: 0.022 },
  { id: 'bgm.profile.resonant-record', scene: 'profile', bpm: 72, loopStartSeconds: 0, defaultCrossfadeMs: 1200, fallbackChordHz: [123.47, 185, 246.94], fallbackWave: 'sine', baseGain: 0.035 },
  { id: 'bgm.expedition.signal-path', scene: 'expedition', bpm: 84, loopStartSeconds: 0, defaultCrossfadeMs: 900, fallbackChordHz: [87.31, 130.81, 174.61], fallbackWave: 'triangle', baseGain: 0.03 },
  { id: 'bgm.endless.below-the-fault', scene: 'endless', bpm: 124, loopStartSeconds: 0, defaultCrossfadeMs: 520, fallbackChordHz: [55, 73.42, 110], fallbackWave: 'sawtooth', baseGain: 0.02 },
  { id: 'bgm.idle.returning-light', scene: 'idle-report', bpm: 70, loopStartSeconds: 0, defaultCrossfadeMs: 800, fallbackChordHz: [130.81, 196, 261.63], fallbackWave: 'sine', baseGain: 0.035 },
  { id: 'bgm.research.quiet-machine', scene: 'research', bpm: 64, loopStartSeconds: 0, defaultCrossfadeMs: 1100, fallbackChordHz: [92.5, 138.59, 185], fallbackWave: 'triangle', baseGain: 0.028 },
];

export function validateAudioRegistry(): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of [...AUDIO_CUES, ...BGM_REGISTRY]) {
    if (ids.has(item.id)) errors.push(`Duplicate audio id: ${item.id}`);
    ids.add(item.id);
  }
  for (const cue of AUDIO_CUES) {
    if (!cue.assetId && cue.synth.length === 0) errors.push(`Cue has no source or fallback: ${cue.id}`);
  }
  for (const bgm of BGM_REGISTRY) {
    if (!bgm.assetId && bgm.fallbackChordHz.length === 0) errors.push(`BGM has no source or fallback: ${bgm.id}`);
    if (bgm.defaultCrossfadeMs < 0) errors.push(`BGM crossfade must be non-negative: ${bgm.id}`);
  }
  return errors;
}
