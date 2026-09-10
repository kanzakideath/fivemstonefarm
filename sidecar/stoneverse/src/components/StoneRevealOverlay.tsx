import { ArrowRight, ScanLine, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StoneVisual } from './StoneVisual';
import type { UiStone } from './uiTypes';

export function StoneRevealOverlay({ stone, kind = 'appraisal', reducedMotion, onClose }: { stone?: UiStone; kind?: 'appraisal' | 'mining' | 'level'; reducedMotion: boolean; onClose: () => void }) {
  const [revealed, setRevealed] = useState(reducedMotion);
  useEffect(() => {
    if (!stone) return;
    setRevealed(reducedMotion);
    const timer = window.setTimeout(() => setRevealed(true), reducedMotion ? 0 : 950);
    return () => window.clearTimeout(timer);
  }, [stone?.id, reducedMotion]);
  if (!stone) return null;
  return <div className={`stone-reveal-overlay ${revealed ? 'is-revealed' : ''} rarity-reveal-${stone.rarity.toLowerCase()}`}><div className="appraisal-grid"><i /><i /><i /><i /></div>{!revealed ? <div className="appraisal-scanner"><ScanLine /><span>RESONANCE APPRAISAL</span><strong>個体情報を復号しています</strong><div><i /></div></div> : <><div className="stone-reveal__flare"><i /><i /><i /><i /><i /></div><div className="stone-reveal__visual"><StoneVisual rarity={stone.rarity} element={stone.element} mutation={stone.mutation} variant={stone.colorVariant} size="hero" active /></div><div className="stone-reveal__copy"><span className={`rarity-label rarity-label--${stone.rarity.toLowerCase()}`}>{stone.rarity}</span><small>{kind === 'appraisal' ? 'APPRAISAL COMPLETE' : kind === 'mining' ? 'NATURAL DISCOVERY' : 'LEVEL UP'}</small><h2>{stone.nickname || stone.name}</h2><p>{stone.name} / {stone.element} / IV POTENTIAL {stone.potential}</p>{stone.mutation ? <strong><Sparkles /> MUTATION — {stone.mutation}</strong> : null}<div><span><small>ORIGIN</small><b>{stone.origin.toUpperCase()}</b></span><span><small>SERIAL</small><b>{stone.serial}</b></span><span><small>PERSONALITY</small><b>{stone.personality}</b></span></div><button className="primary-action" type="button" onClick={onClose}>コレクションへ登録<ArrowRight /></button></div></>}</div>;
}
