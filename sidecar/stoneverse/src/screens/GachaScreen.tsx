import { ArrowRight, ChevronRight, CircleHelp, History, Info, RotateCcw, Sparkles, Ticket, Volume2, VolumeX, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { GameModal } from '../components/GameModal';
import { StoneCard } from '../components/StoneCard';
import { StoneVisual } from '../components/StoneVisual';
import type { UiStone } from '../components/uiTypes';
import { GACHA_BANNER_BY_ID, SPECIES_BY_ID } from '../data';
import { gachaRateRows } from './definitionPresentation';

interface GachaScreenProps {
  tickets: number;
  pity: number;
  stones: UiStone[];
  recent: UiStone[];
  reducedMotion: boolean;
  muted: boolean;
  onPull: (count: 1 | 10) => Promise<UiStone[]>;
}

type GachaPhase = 'idle' | 'sealing' | 'reel' | 'impact' | 'reveal' | 'results';

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
const banner = GACHA_BANNER_BY_ID.banner_genesis;
const pickupSpecies = banner.pool.filter((entry) => entry.pickup).map((entry) => SPECIES_BY_ID[entry.speciesId]).filter(Boolean);
const featuredSpecies = pickupSpecies.find((species) => species.rarity === 'UR') ?? pickupSpecies[0];
const singleTicketCost = banner.singleCost.currencies?.gachaTickets ?? 0;

export function GachaScreen({ tickets, pity, stones, recent, reducedMotion, muted, onPull }: GachaScreenProps) {
  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [result, setResult] = useState<UiStone[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const running = useRef(false);
  const focus = result[Math.min(revealIndex, Math.max(0, result.length - 1))];

  const reelItems = useMemo(() => {
    const source = stones.length ? stones : result;
    if (!source.length) return [];
    const items = Array.from({ length: 26 }, (_, index) => source[index % source.length]);
    if (result[0]) items[20] = result[0];
    return items;
  }, [stones, result]);

  const pull = async (count: 1 | 10) => {
    if (running.current || tickets < singleTicketCost * count) return;
    running.current = true;
    setResult([]);
    setRevealIndex(0);
    setPhase('sealing');
    try {
      // The authoritative draw is completed before presentation begins.
      const confirmed = await onPull(count);
      setResult(confirmed);
      await wait(reducedMotion ? 80 : 540);
      setPhase('reel');
      await wait(reducedMotion ? 100 : 3600);
      setPhase('impact');
      await wait(reducedMotion ? 80 : 520);
      setPhase('reveal');
    } catch {
      setPhase('idle');
    } finally {
      running.current = false;
    }
  };

  const advanceReveal = () => {
    if (result.length > 1 && revealIndex < result.length - 1) setRevealIndex((index) => index + 1);
    else setPhase('results');
  };

  const reset = () => {
    setPhase('idle');
    setResult([]);
    setRevealIndex(0);
  };

  return (
    <div className={`gacha-screen gacha-phase-${phase} ${focus ? `gacha-rarity-${focus.rarity.toLowerCase()}` : ''}`}>
      <div className="gacha-sky"><i /><i /><i /></div>
      <section className="gacha-banner">
        <div className="gacha-banner__copy">
          <span className="banner-period">CELESTIAL ARCHIVE / {banner.id.toUpperCase()}</span>
          <h2>{banner.name}</h2>
          <p>{pickupSpecies.length ? `ピックアップ対象：${pickupSpecies.map((species) => species.name).join(' / ')}。` : ''}全レアリティは設定済み提供割合に基づいて抽選されます。</p>
          <div className="pickup-tags">{pickupSpecies.map((species) => <span key={species.id}>{species.rarity} PICKUP · {species.name}</span>)}<span>10連 {banner.tenPullGuarantee}以上確定</span></div>
        </div>
        <div className="gacha-banner__art"><span className="celestial-ring celestial-ring--a" /><span className="celestial-ring celestial-ring--b" />{featuredSpecies ? <StoneVisual rarity={featuredSpecies.rarity} element={featuredSpecies.primaryElement} size="hero" active /> : null}<div className="pickup-name"><small>{featuredSpecies?.primaryElement} / {featuredSpecies?.role}</small><strong>{featuredSpecies?.name ?? banner.name}</strong></div></div>
      </section>

      {phase === 'idle' ? (
        <section className="gacha-console panel">
          <div className="gacha-status">
            <span><small>SSR GUARANTEE</small><b>{Math.max(0, banner.pity.hard - pity)}</b><em>回以内</em></span>
            <div className="pity-track"><i style={{ width: `${Math.min(100, pity / banner.pity.hard * 100)}%` }} /></div>
            <span className="pity-count">{pity} / {banner.pity.hard}</span>
          </div>
          <div className="gacha-actions">
            <button className="summon-button summon-button--single" type="button" onClick={() => pull(1)} disabled={tickets < singleTicketCost}>
              <span><small>SINGLE RESONANCE</small><strong>1回召喚</strong></span><em><Ticket />{singleTicketCost}</em>
            </button>
            <button className="summon-button summon-button--ten" type="button" onClick={() => pull(10)} disabled={tickets < singleTicketCost * 10}>
              <span className="summon-button__shine" /><Sparkles /><span><small>MULTI RESONANCE</small><strong>10回召喚</strong></span><em><Ticket />{singleTicketCost * 10}</em>
            </button>
          </div>
          <div className="gacha-links"><button type="button" onClick={() => setRatesOpen(true)}><Info />提供割合</button><button type="button" onClick={() => setHistoryOpen(true)}><History />召喚履歴</button><span>{banner.activeUntil ? `開催期限 ${new Date(banner.activeUntil).toLocaleString('ja-JP')}` : '常設召喚'}</span></div>
        </section>
      ) : null}

      {phase === 'sealing' ? (
        <section className="summon-stage summon-stage--seal" aria-live="polite"><span className="summon-seal"><i /><i /><i /><Sparkles /></span><p>召喚結果を確定しました</p><strong>共鳴回路を接続中</strong></section>
      ) : null}

      {phase === 'reel' || phase === 'impact' ? (
        <section className={`case-stage ${phase === 'impact' ? 'is-impact' : ''}`}>
          <div className="case-stage__header"><span><CircleHelp /> RESONANCE CASE</span><span>{muted ? <VolumeX /> : <Volume2 />} AUTO REVEAL</span></div>
          <div className="case-reel">
            <span className="case-reel__needle case-reel__needle--top" /><span className="case-reel__needle case-reel__needle--bottom" />
            <div className="case-reel__track">
              {reelItems.map((stone, index) => (
                <div className={`case-item rarity-frame-${stone.rarity.toLowerCase()}`} key={`${stone.id}-${index}`}><StoneVisual rarity={stone.rarity} element={stone.element} mutation={stone.mutation} size="sm" /><span>{stone.rarity}</span></div>
              ))}
            </div>
          </div>
          <div className="reel-frequency"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <p>{phase === 'impact' ? 'SIGNAL LOCKED' : '共鳴周波数を走査しています'}</p>
        </section>
      ) : null}

      {phase === 'reveal' && focus ? (
        <section className="gacha-reveal" onClick={advanceReveal}>
          <div className="gacha-reveal__burst"><i /><i /><i /><i /><i /><i /></div>
          <span className="gacha-reveal__rarity">{focus.rarity}</span>
          <StoneVisual rarity={focus.rarity} element={focus.element} mutation={focus.mutation} variant={focus.colorVariant} size="hero" active />
          <div className="gacha-reveal__copy"><span>{focus.origin.toUpperCase()} / {focus.element.toUpperCase()}</span><h2>{focus.nickname || focus.name}</h2><p>{focus.name} · 個体値 {focus.potential}</p>{focus.mutation ? <strong><Sparkles /> MUTATION — {focus.mutation}</strong> : null}</div>
          <div className="gacha-reveal__continue"><span>{revealIndex + 1} / {result.length}</span><button type="button">{revealIndex < result.length - 1 ? '次の個体' : '結果一覧'}<ArrowRight /></button></div>
        </section>
      ) : null}

      {phase === 'results' ? (
        <section className="gacha-results panel">
          <header><div><span className="eyebrow">RESONANCE COMPLETE</span><h2>召喚結果</h2></div><button className="icon-button" type="button" onClick={reset}><X /></button></header>
          <div className="gacha-result-grid">{result.map((stone, index) => <StoneCard stone={stone} compact key={`${stone.id}-${index}`} />)}</div>
          <div className="gacha-result-actions"><button className="secondary-action" type="button" onClick={reset}>召喚画面へ戻る</button><button className="primary-action" type="button" onClick={() => { reset(); pull(result.length >= 10 ? 10 : 1); }}><RotateCcw />もう一度召喚</button></div>
        </section>
      ) : null}

      <GameModal open={ratesOpen} onClose={() => setRatesOpen(false)} title="提供割合" eyebrow="DROP RATE">
        <div className="rate-table">{gachaRateRows(banner).map(({ rarity, label }) => <div key={rarity}><span className={`rarity-label rarity-label--${rarity.toLowerCase()}`}>{rarity}</span><b>{label}</b></div>)}<p>抽選結果は召喚演出の開始前に確定し、{banner.pity.hard}回以内にSSR以上が保証されます。10連では{banner.tenPullGuarantee}以上を1体保証します。</p></div>
      </GameModal>
      <GameModal open={historyOpen} onClose={() => setHistoryOpen(false)} title="召喚履歴" eyebrow="RESONANCE LOG">
        <div className="gacha-history">{recent.length ? recent.slice(0, 12).map((stone, index) => <div key={`${stone.id}-${index}`}><StoneVisual rarity={stone.rarity} element={stone.element} size="sm" /><span><strong>{stone.nickname || stone.name}</strong><small>{stone.rarity} · {stone.origin}</small></span><ChevronRight /></div>) : <p>召喚履歴はまだありません。</p>}</div>
      </GameModal>
    </div>
  );
}
