import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioPlayback } from '../systems/AudioManager';
import { AudioSequenceController } from './useGameAudio';

const playing = (stop = vi.fn()): AudioPlayback => ({ status: 'playing', source: 'synth', stop });

describe('AudioSequenceController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels delayed and active cues before a sequence is rerun', async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const output = { playCue: vi.fn().mockResolvedValue(playing(stop)) };
    const controller = new AudioSequenceController(output);

    controller.start([
      { cueId: 'fusion.energy', delayMs: 0 },
      { cueId: 'fusion.reveal', delayMs: 2_900 },
    ]);
    await Promise.resolve();
    controller.start([{ cueId: 'battle.hit', delayMs: 100 }]);
    await vi.advanceTimersByTimeAsync(3_000);

    expect(stop).toHaveBeenCalledOnce();
    expect(output.playCue).toHaveBeenCalledTimes(2);
    expect(output.playCue).toHaveBeenNthCalledWith(1, 'fusion.energy', undefined);
    expect(output.playCue).toHaveBeenNthCalledWith(2, 'battle.hit', undefined);
    expect(controller.pendingCount()).toBe(0);
  });

  it('cancels the remaining sequence if cue playback fails', async () => {
    vi.useFakeTimers();
    const output = { playCue: vi.fn().mockRejectedValueOnce(new Error('audio device failed')) };
    const controller = new AudioSequenceController(output);

    controller.start([
      { cueId: 'fusion.energy', delayMs: 0 },
      { cueId: 'fusion.reveal', delayMs: 500 },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(output.playCue).toHaveBeenCalledOnce();
    expect(controller.pendingCount()).toBe(0);
  });
});
