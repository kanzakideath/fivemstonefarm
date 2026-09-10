import { describe, expect, it, vi } from 'vitest';
import { validateAudioRegistry } from '../assets';
import { AudioManager } from './AudioManager';

describe('AudioManager registry and fallback behavior', () => {
  it('guarantees every default cue and BGM has a valid fallback', () => {
    expect(validateAudioRegistry()).toEqual([]);
  });

  it('does not create an AudioContext while muted', async () => {
    const contextFactory = vi.fn(() => { throw new Error('must not run'); });
    const manager = new AudioManager({
      contextFactory,
      settings: { muted: true },
    });
    const playback = await manager.playCue('ui.click');
    expect(playback.status).toBe('suppressed');
    expect(playback.reason).toBe('muted');
    expect(contextFactory).not.toHaveBeenCalled();
  });

  it('fails closed without breaking callers when WebAudio is unavailable', async () => {
    const manager = new AudioManager({
      contextFactory: () => { throw new Error('no audio device'); },
    });
    const playback = await manager.playCue('ui.confirm');
    expect(playback.status).toBe('unavailable');
    expect(playback.reason).toBe('audio-unavailable');
    expect(manager.state()).toBe('unavailable');
  });
});
