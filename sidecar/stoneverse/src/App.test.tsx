import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stoneverseApi } from './api/stoneverseApi';
import { stoneverseStore } from './store/stoneverseStore';
import { App, backgroundProcessingMode } from './App';

describe('App public navigation bridge', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('stoneverse:onboarded', '1');
    stoneverseStore.getState().resetGame({ seed: 'app-public-route' });
    stoneverseStore.getState().updateSettings({ reduceMotion: true, mute: true });
  });

  afterEach(() => {
    cleanup();
    stoneverseApi.events.clear();
  });

  it('opens the actual collection detail dialog through openStoneDetail', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'レゾナンス・ベース', level: 1 });
    const stone = stoneverseApi.getStoneverseState().stones[Object.keys(stoneverseApi.getStoneverseState().stones)[0]];

    act(() => stoneverseApi.openStoneDetail(stone.instanceId));

    expect(await screen.findByRole('dialog', { name: stone.name })).toBeVisible();
    expect(stoneverseStore.getState().selectedStoneId).toBe(stone.instanceId);
  });

  it('accounts hidden scheduler wakes as offline work for the welcome-back report', () => {
    expect(backgroundProcessingMode('DUE', 'hidden')).toBe('OFFLINE');
    expect(backgroundProcessingMode('MANUAL', 'hidden')).toBe('OFFLINE');
    expect(backgroundProcessingMode('DUE', 'visible')).toBe('ACTIVE');
    expect(backgroundProcessingMode('FOCUS', 'visible')).toBe('OFFLINE');
  });
});
