import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiRankingEntry } from '../components/uiTypes';
import { RankingScreen } from './RankingScreen';

const entry = (name: string): UiRankingEntry => ({
  rank: 1,
  id: `account-${name}`,
  name,
  title: '深層共鳴者',
  score: 999_999_999,
  level: 80,
});

describe('RankingScreen controlled category', () => {
  afterEach(cleanup);

  it('offers weekly Endless and broader activity ranking categories', () => {
    const onCategoryChange = vi.fn();
    render(
      <RankingScreen
        entries={[entry('EndlessLeader')]}
        category="Endless最高階層"
        season="TEST SEASON"
        onCategoryChange={onCategoryChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Endless最高階層' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '最速踏破' })).toBeVisible();
    expect(screen.getByRole('button', { name: '最少被ダメ' })).toBeVisible();
    expect(screen.getByRole('button', { name: '遠征スコア' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Boss撃破' })).toBeVisible();
    expect(screen.getByRole('button', { name: '戦闘力' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '最速踏破' }));
    expect(onCategoryChange).toHaveBeenCalledWith('最速踏破');
  });

  it('keeps the committed tab and rows together until its parent supplies a successful snapshot', () => {
    const onCategoryChange = vi.fn();
    const { rerender } = render(
      <RankingScreen
        entries={[entry('RaidLeader')]}
        category="レイド"
        season="TEST SEASON"
        onCategoryChange={onCategoryChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '図鑑' }));
    expect(onCategoryChange).toHaveBeenCalledOnce();
    expect(onCategoryChange).toHaveBeenCalledWith('図鑑');
    expect(screen.getByRole('button', { name: 'レイド' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '図鑑' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('RaidLeader')).toBeVisible();

    rerender(
      <RankingScreen
        entries={[entry('CollectionLeader')]}
        category="図鑑"
        season="TEST SEASON"
        onCategoryChange={onCategoryChange}
      />,
    );
    expect(screen.getByRole('button', { name: '図鑑' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'レイド' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('CollectionLeader')).toBeVisible();
    expect(screen.queryByText('RaidLeader')).not.toBeInTheDocument();
  });
});
