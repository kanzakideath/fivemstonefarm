import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IdleReportView, NotificationView } from './adventureTypes';
import { IdleReportOverlay } from './IdleReportOverlay';
import { NotificationCenter } from './NotificationCenter';

const idleReport: IdleReportView = {
  id: 'idle-01', awayLabel: '07:42:16', periodLabel: '2026.09.09 21:00 — 2026.09.10 04:42', capped: true,
  expeditionsCompleted: 2, floorsCleared: 14, miningCycles: 8,
  rewards: [
    { id: 'credits', label: 'Mining Credits', amount: 1280, kind: 'CURRENCY' },
    { id: 'dust', label: 'Upgrade Dust', amount: 96, kind: 'MATERIAL' },
  ],
  stoneProgress: [{ id: 'stone-a', name: 'Quartzling', levelBefore: 17, levelAfter: 18, xp: 740, affinity: 6 }],
  rareSignal: { id: 'signal-idle', hint: '通常と異なる遅延波形を検出。' },
};

const notifications: NotificationView[] = [
  { id: 'notice-a', kind: 'EXPEDITION', title: '遠征隊が帰還', detail: '結晶洞・北環の報告が到着しました。', timeLabel: '2分前', read: false, actionLabel: '報告を開く' },
  { id: 'notice-b', kind: 'SYSTEM', title: 'データ同期完了', detail: 'オンラインプロファイルを更新しました。', timeLabel: '1時間前', read: true },
];

describe('adventure overlays', () => {
  it('presents an accessible idle report and routes claim, signal, and keyboard close actions', () => {
    const onClose = vi.fn();
    const onClaim = vi.fn();
    const onInspectSignal = vi.fn();
    render(<IdleReportOverlay report={idleReport} reducedMotion onClose={onClose} onClaim={onClaim} onInspectSignal={onInspectSignal} />);

    expect(screen.getByRole('dialog', { name: /あなたの不在中/ })).toBeVisible();
    expect(screen.getByText('Upgrade Dust')).toBeVisible();
    expect(screen.getByText('Quartzling')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /UNKNOWN SIGNAL/ }));
    expect(onInspectSignal).toHaveBeenCalledWith('signal-idle');
    fireEvent.click(screen.getByRole('button', { name: /受取可能分を回収/ }));
    expect(onClaim).toHaveBeenCalledWith('idle-01');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('filters notifications and exposes read, action, read-all, and Escape controls', () => {
    const onClose = vi.fn();
    const onRead = vi.fn();
    const onReadAll = vi.fn();
    const onAction = vi.fn();
    render(<NotificationCenter open notifications={notifications} onClose={onClose} onRead={onRead} onReadAll={onReadAll} onAction={onAction} />);

    expect(screen.getByRole('dialog', { name: /通知センター/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '未読 1' }));
    expect(screen.getByText('遠征隊が帰還')).toBeVisible();
    expect(screen.queryByText('データ同期完了')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '遠征隊が帰還、未読' }));
    expect(onRead).toHaveBeenCalledWith('notice-a');
    fireEvent.click(screen.getByRole('button', { name: '報告を開く' }));
    expect(onAction).toHaveBeenCalledWith('notice-a');
    fireEvent.click(screen.getByRole('button', { name: /すべて既読/ }));
    expect(onReadAll).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
