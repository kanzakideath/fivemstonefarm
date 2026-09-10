import { Activity, Aperture, ChevronRight, Crosshair, Gem, Layers3, Mountain, Pickaxe, ScanLine, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { StoneVisual } from '../components/StoneVisual';
import type { UiMiningResult, UiPlayer } from '../components/uiTypes';

interface MineScreenProps {
  player: UiPlayer;
  results: UiMiningResult[];
  busy: boolean;
  onMine: () => void;
  onAppraise: (id: string) => void;
}

export function MineScreen({ player, results, busy, onMine, onAppraise }: MineScreenProps) {
  const [impact, setImpact] = useState(false);
  const [selectedVein, setSelectedVein] = useState('crystal');
  const newest = results[0];
  const pending = results.filter((result) => result.unappraised && !result.appraised);

  useEffect(() => {
    if (!busy && newest) {
      setImpact(true);
      const timer = window.setTimeout(() => setImpact(false), 720);
      return () => window.clearTimeout(timer);
    }
  }, [busy, newest?.id]);

  const triggerMine = () => {
    if (!busy) onMine();
  };

  return (
    <div className={`mine-screen ${impact ? 'is-impact' : ''}`}>
      <section className="mine-chamber panel">
        <div className="mine-chamber__scanlines" />
        <div className="mine-chamber__hud mine-chamber__hud--left">
          <span><Crosshair /> DEPTH</span><strong>1,240<small>m</small></strong>
          <span><Activity /> SIGNAL</span><strong className="signal-value">87.4<small>%</small></strong>
        </div>
        <div className="mine-chamber__hud mine-chamber__hud--right">
          <span>VEIN TYPE</span><strong>CRYSTAL</strong><span>STABILITY</span><strong>NOMINAL</strong>
        </div>
        <div className="mine-chamber__core">
          <span className="mine-ring mine-ring--outer" /><span className="mine-ring mine-ring--mid" /><span className="mine-ring mine-ring--inner" />
          <div className={`mine-deposit ${busy ? 'is-mining' : ''}`}>
            <span className="mine-deposit__shard mine-deposit__shard--a" /><span className="mine-deposit__shard mine-deposit__shard--b" /><span className="mine-deposit__shard mine-deposit__shard--c" />
            <Gem />
          </div>
          {busy ? <div className="mine-laser"><i /></div> : null}
          <div className="mine-chamber__prompt">
            <span>{busy ? 'RESONANCE EXTRACTION' : 'TARGET LOCKED'}</span>
            <strong>{busy ? '共鳴波を収束中' : '結晶核へ採掘波を照射'}</strong>
          </div>
        </div>
        <button className={`mine-trigger ${busy ? 'is-busy' : ''}`} type="button" onClick={triggerMine} disabled={busy}>
          <span className="mine-trigger__ring"><Pickaxe /></span>
          <span><small>{busy ? 'EXTRACTING' : 'INITIATE'}</small><strong>{busy ? '採掘中' : '採掘する'}</strong></span>
        </button>
        {impact && newest ? (
          <div className={`mining-reward mining-reward--${newest.quality}`}>
            <Sparkles /><span><small>{newest.quality === 'anomaly' ? 'ANOMALY DETECTED' : 'EXTRACTION COMPLETE'}</small><b>{newest.unappraised ? '未鑑定の共鳴体を発見' : `${newest.material} × ${newest.amount}`}</b><em>+{newest.xp} MINING XP</em></span>
          </div>
        ) : null}
      </section>

      <aside className="mine-console">
        <section className="panel mine-level-card">
          <header><span className="level-crest level-crest--small"><b>{player.miningLevel}</b><small>MINE</small></span><div><span className="eyebrow">MINING MASTERY</span><h3>採掘技師ランク</h3></div></header>
          <ProgressBar value={player.miningXp} max={player.miningXpNext} label="NEXT AREA" tone="gold" />
          <p>LV.{player.miningLevel + 1} で「星骸層」の鉱脈解析を開放</p>
        </section>

        <section className="panel vein-selector">
          <header className="section-heading"><div><span className="eyebrow">ACTIVE VEIN</span><h3>鉱脈を選択</h3></div><Layers3 /></header>
          <div className="vein-list">
            {[
              ['crystal', '水晶脈・深層', 'CRYSTAL', '安定'],
              ['ember', '熔炎脈・裂溝', 'FIRE', '高熱'],
              ['void', '虚空脈・境界', 'VOID', 'LV.24'],
            ].map(([id, name, element, state], index) => (
              <button key={id} type="button" disabled={index === 2} className={selectedVein === id ? 'is-selected' : ''} onClick={() => setSelectedVein(id)}>
                <span className={`vein-swatch vein-swatch--${id}`}><Mountain /></span><span><strong>{name}</strong><small>{element} / {state}</small></span><ChevronRight />
              </button>
            ))}
          </div>
        </section>

        <section className="panel appraisal-queue">
          <header className="section-heading"><div><span className="eyebrow">ANALYSIS QUEUE</span><h3>未鑑定ストーン</h3></div><span className="queue-count">{pending.length}</span></header>
          {pending.length ? (
            <div className="appraisal-list">
              {pending.slice(0, 3).map((result) => (
                <button type="button" key={result.id} onClick={() => onAppraise(result.id)}>
                  <span className="unknown-stone"><Aperture /></span><span><strong>UNKNOWN SIGNAL</strong><small>{result.area} · {new Date(result.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</small></span><ScanLine />
                </button>
              ))}
            </div>
          ) : <div className="queue-empty"><ScanLine /><span>未鑑定の共鳴反応はありません</span></div>}
        </section>
      </aside>
    </div>
  );
}
