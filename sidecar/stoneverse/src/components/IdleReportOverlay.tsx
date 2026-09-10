import { ArrowRight, Clock3, Gem, Gift, Heart, Layers3, Mountain, PackageCheck, Radar, Sparkles, TrendingUp, TriangleAlert, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdventureRewardView, IdleReportView } from './adventureTypes';

export interface IdleReportOverlayProps {
  report: IdleReportView | null;
  reducedMotion: boolean;
  onClose: () => void;
  onClaim: (reportId: string) => void | Promise<void>;
  onInspectSignal?: (signalId: string) => void;
}

const rewardIcons: Record<AdventureRewardView['kind'], typeof Gem> = {
  CURRENCY: Gem,
  MATERIAL: Mountain,
  ITEM: PackageCheck,
  STONE_XP: TrendingUp,
  ACCOUNT_XP: Trophy,
  UNKNOWN: Radar,
};

export function IdleReportOverlay({ report, reducedMotion, onClose, onClaim, onInspectSignal }: IdleReportOverlayProps) {
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!report) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, report]);

  if (!report) return null;

  const claim = async () => {
    if (claiming) return;
    setClaiming(true);
    try { await onClaim(report.id); }
    finally { setClaiming(false); }
  };

  return (
    <div className={`idle-report-layer ${reducedMotion ? 'is-reduced-motion' : ''}`}>
      <button className="idle-report-backdrop" type="button" aria-label="レポートを閉じる" onClick={onClose} />
      <section className="idle-report" role="dialog" aria-modal="true" aria-labelledby="idle-report-title">
        <button className="icon-button idle-report__close" type="button" aria-label="閉じる" onClick={onClose} autoFocus><X /></button>
        <header className="idle-report__hero">
          <span className="idle-report__signal"><i /><Radar /> RESONANCE LINK RESTORED</span>
          <p>WELCOME BACK, STONEKEEPER</p>
          <h2 id="idle-report-title">あなたの不在中も、<br />共鳴は続いていました。</h2>
          <div><Clock3 /><span><small>TIME AWAY</small><strong>{report.awayLabel}</strong><em>{report.periodLabel}</em></span></div>
          {report.capped || report.rollbackDetected ? <aside>{report.rollbackDetected ? <TriangleAlert /> : <Clock3 />}<span><strong>{report.rollbackDetected ? '端末時計の巻き戻しを検知' : '放置報酬が上限に到達'}</strong><small>{report.rollbackDetected ? '巻き戻した時間は進行に加算せず、直前のTrusted Timeを保持しました。' : '次回は上限前に回収すると探索効率を維持できます。'}{report.rollbackDetected && report.capped ? ' 長期放置分は安全上限まで計算済みです。' : ''}</small></span></aside> : null}
        </header>

        <div className="idle-report__body">
          <section className="idle-summary" aria-label="不在中の活動サマリー">
            <article><span><PackageCheck /></span><small>EXPEDITIONS</small><strong>{report.expeditionsCompleted}</strong><em>完了</em></article>
            <article><span><Layers3 /></span><small>ENDLESS FLOORS</small><strong>{report.floorsCleared}</strong><em>階層到達</em></article>
            <article><span><Mountain /></span><small>MINING CYCLES</small><strong>{report.miningCycles}</strong><em>採掘サイクル</em></article>
          </section>

          <section className="idle-rewards">
            <header><div><span className="eyebrow">ACCUMULATED CACHE</span><h3>獲得報酬</h3></div><Sparkles /></header>
            <div>{report.rewards.map((reward, index) => { const Icon = rewardIcons[reward.kind]; return <article className={reward.kind === 'UNKNOWN' ? 'is-unknown' : ''} style={{ '--reveal-index': index } as React.CSSProperties} key={reward.id}><span><Icon /></span><div><small>{reward.kind}</small><strong>{reward.label}</strong></div><b>{reward.amount === undefined ? 'DETECTED' : `×${reward.amount.toLocaleString()}`}</b></article>; })}</div>
          </section>

          <section className="idle-growth">
            <header><div><span className="eyebrow">STONE PROGRESSION</span><h3>個体成長レポート</h3></div><TrendingUp /></header>
            <div>{report.stoneProgress.map((stone, index) => <article style={{ '--reveal-index': index } as React.CSSProperties} key={stone.id}><span className="idle-growth__level"><small>LV.</small><strong>{stone.levelAfter}</strong></span><div><strong>{stone.name}</strong><small>{stone.levelAfter > stone.levelBefore ? `LEVEL UP ${stone.levelBefore} → ${stone.levelAfter}` : `LEVEL ${stone.levelAfter}`}</small><i><em style={{ width: `${Math.min(100, 28 + index * 17)}%` }} /></i></div><span className="idle-growth__gains"><b>+{stone.xp.toLocaleString()} XP</b><small><Heart /> +{stone.affinity}</small></span></article>)}</div>
          </section>

          {report.rareSignal ? <button className="idle-unknown-signal" type="button" onClick={() => onInspectSignal?.(report.rareSignal!.id)} disabled={!onInspectSignal}><span><Radar /></span><div><small>RARE FREQUENCY / UNAPPRAISED</small><strong>UNKNOWN SIGNAL</strong><p>{report.rareSignal.hint}</p></div><ArrowRight /></button> : null}
        </div>

        <footer className="idle-report__footer"><span><Gift /><small>UNCLAIMED RUN REWARDS STAY IN STORAGE</small></span><button className="primary-action" type="button" disabled={claiming} onClick={claim}>{claiming ? <Clock3 /> : <PackageCheck />}{claiming ? '同期中' : '受取可能分を回収'}<ArrowRight /></button></footer>
      </section>
    </div>
  );
}
