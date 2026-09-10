import {
  ArrowRight,
  Check,
  ChevronRight,
  Compass,
  FastForward,
  Flag,
  Gem,
  Infinity as InfinityIcon,
  LockKeyhole,
  MapPinned,
  PackageCheck,
  Radar,
  Route,
  Shield,
  Sparkles,
  Swords,
  TimerReset,
  TriangleAlert,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ExpeditionDraftView, ExpeditionStrategy, ExpeditionViewModel } from '../components/adventureTypes';
import { ProgressBar } from '../components/ProgressBar';
import { StoneVisual } from '../components/StoneVisual';

export interface ExpeditionScreenProps {
  model: ExpeditionViewModel;
  reducedMotion: boolean;
  onDraftChange: (draft: ExpeditionDraftView) => void;
  onStart: (draft: ExpeditionDraftView) => void | Promise<void>;
  onClaim: (expeditionId: string) => void | Promise<void>;
  onStop: (expeditionId: string) => void | Promise<void>;
  onInspectSignal?: (signalId: string) => void;
}

const strategies: Array<{ id: ExpeditionStrategy; label: string; detail: string; icon: typeof Shield }> = [
  { id: 'BALANCED', label: '均衡', detail: '探索と戦闘を両立', icon: Compass },
  { id: 'COMBAT', label: '戦闘', detail: '遭遇戦・戦闘XPを優先', icon: Swords },
  { id: 'MINING', label: '採掘', detail: '素材ノードと装備を優先', icon: Gem },
  { id: 'DISCOVERY', label: '発見', detail: 'Rare Stone・変異信号を追跡', icon: Radar },
  { id: 'SAFE', label: '慎重', detail: '失敗時の報酬保持を優先', icon: Shield },
  { id: 'HIGH_RISK', label: '高リスク', detail: '成功率と引換えに報酬を増幅', icon: TriangleAlert },
];

const reportIcons = {
  DEPARTURE: Route,
  DISCOVERY: Compass,
  BATTLE: Swords,
  CACHE: PackageCheck,
  RETURN: Flag,
  RARE_SIGNAL: Radar,
} as const;

const formatDuration = (minutes: number) => minutes < 60 ? `${minutes} MIN` : `${minutes / 60} H`;

const rewardRevealRank = (reward: ExpeditionViewModel['runs'][number]['rewards'][number]): number => {
  if (/\b(SSR|UR|LEGENDARY|MYTHIC)\b/i.test(reward.label)) return 4;
  if (reward.kind === 'UNKNOWN') return 3;
  if (reward.kind === 'MATERIAL' && /(core|ancient|meteor|abyss|celestial|relic|prism|rare)/i.test(reward.label)) return 2;
  if (reward.kind === 'ITEM' && !/affinity/i.test(reward.label)) return 1;
  return 0;
};

export function ExpeditionScreen({ model, reducedMotion, onDraftChange, onStart, onClaim, onStop, onInspectSignal }: ExpeditionScreenProps) {
  const [starting, setStarting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState(() => model.active?.id ?? model.runs[0]?.id);
  const active = model.runs.find((run) => run.id === selectedRunId) ?? model.runs[0];
  const orderedRewards = useMemo(() => [...(active?.rewards ?? [])]
    .sort((left, right) => rewardRevealRank(left) - rewardRevealRank(right)), [active?.rewards]);
  const selectedRegion = model.regions.find((region) => region.id === model.draft.regionId) ?? model.regions[0];
  const activeRegion = model.regions.find((region) => region.id === active?.regionId);
  const focusRegion = activeRegion ?? selectedRegion;
  const selectedParty = model.draft.partyIds.map((id) => model.party.find((stone) => stone.id === id)).filter(Boolean);
  const heroParty = (active?.partyIds ?? model.draft.partyIds).map((id) => model.party.find((stone) => stone.id === id)).filter(Boolean);
  const teamPower = heroParty.reduce((sum, stone) => sum + (stone?.power ?? 0), 0);
  const slotsRemaining = Math.max(0, model.availableSlots - model.usedSlots);
  const totalRevealSteps = (active?.report.length ?? 0) + orderedRewards.length + (active?.rareSignal ? 1 : 0);
  const [revealStep, setRevealStep] = useState(active?.status === 'COMPLETE' && reducedMotion ? totalRevealSteps : 0);

  useEffect(() => {
    if (model.runs.some((run) => run.id === selectedRunId) || model.runs.length === 0) return;
    setSelectedRunId(model.runs[0]?.id);
  }, [model.runs, selectedRunId]);

  useEffect(() => {
    if (active?.status !== 'COMPLETE') return;
    setRevealStep(reducedMotion ? totalRevealSteps : 0);
  }, [active?.id, active?.status, reducedMotion, totalRevealSteps]);

  useEffect(() => {
    if (active?.status !== 'COMPLETE' || reducedMotion || revealStep >= totalRevealSteps) return;
    const timer = window.setTimeout(() => setRevealStep((step) => Math.min(totalRevealSteps, step + 1)), 520);
    return () => window.clearTimeout(timer);
  }, [active?.status, reducedMotion, revealStep, totalRevealSteps]);

  const updateDraft = (patch: Partial<ExpeditionDraftView>) => onDraftChange({ ...model.draft, ...patch });
  const changeRegion = (regionId: string) => {
    const region = model.regions.find((candidate) => candidate.id === regionId);
    if (!region || region.locked || slotsRemaining <= 0) return;
    updateDraft({ regionId, durationMinutes: region.durations.includes(model.draft.durationMinutes) ? model.draft.durationMinutes : region.durations[0] });
  };
  const toggleParty = (stoneId: string) => {
    const current = model.draft.partyIds;
    if (current.includes(stoneId)) updateDraft({ partyIds: current.filter((id) => id !== stoneId) });
    else if (slotsRemaining > 0 && current.length < 3 && model.party.find((stone) => stone.id === stoneId)?.condition === 'READY') updateDraft({ partyIds: [...current, stoneId] });
  };
  const canStart = slotsRemaining > 0
    && Boolean(selectedRegion)
    && !selectedRegion?.locked
    && selectedParty.length > 0
    && selectedParty.every((stone) => stone?.condition === 'READY');
  const start = async () => {
    if (!canStart || starting) return;
    setStarting(true);
    try { await onStart(model.draft); }
    finally { setStarting(false); }
  };
  const claim = async () => {
    if (!active?.canClaim || (active.status === 'COMPLETE' && revealStep < totalRevealSteps) || claiming) return;
    setClaiming(true);
    try { await onClaim(active.id); }
    finally { setClaiming(false); }
  };
  const stop = async () => {
    if (!active?.canStop || stopping) return;
    setStopping(true);
    try { await onStop(active.id); }
    finally { setStopping(false); }
  };
  const strategy = useMemo(() => strategies.find((item) => item.id === model.draft.strategy) ?? strategies[0], [model.draft.strategy]);
  const reportVisible = active?.status === 'ACTIVE' ? active.report.length : Math.min(active?.report.length ?? 0, revealStep);
  const visibleRewardCount = active?.status === 'ACTIVE'
    ? orderedRewards.length
    : Math.max(0, Math.min(orderedRewards.length, revealStep - (active?.report.length ?? 0)));
  const rareSignalVisible = active?.status === 'ACTIVE'
    || revealStep > (active?.report.length ?? 0) + orderedRewards.length;

  return (
    <div className={`expedition-screen ${reducedMotion ? 'is-reduced-motion' : ''}`}>
      <section className="expedition-hero panel">
        <div className="expedition-hero__veil" />
        <div className="expedition-hero__copy">
          <span className="status-kicker"><Radar /> FRONTIER BEACON / {focusRegion?.sector ?? 'NO SIGNAL'}</span>
          <h2>{active ? active.status === 'COMPLETE' ? '遠征隊が帰還しました。' : '地下回廊を進行中。' : '未踏の鉱脈へ、意志を送る。'}</h2>
          <p>{focusRegion?.summary ?? '遠征先を選択してください。'}</p>
          <div className="expedition-hero__metrics">
            <span><small>PARTY POWER</small><b>{teamPower.toLocaleString()}</b></span>
            <span><small>RECOMMENDED</small><b>{focusRegion?.recommendedPower.toLocaleString() ?? '—'}</b></span>
            <span><small>RARE SIGNAL</small><b>{focusRegion ? `${focusRegion.rareSignalRate}%` : '—'}</b></span>
          </div>
        </div>
        <div className="expedition-radar" aria-hidden="true"><i /><i /><i /><span><MapPinned /></span></div>
      </section>

      <section className="panel expedition-run-manager" aria-labelledby="expedition-runs-heading">
        <header className="section-heading">
          <div><span className="eyebrow">EXPEDITION CONTROL</span><h3 id="expedition-runs-heading">遠征スロット</h3></div>
          <div className="expedition-run-manager__capacity">
            <span><small>OCCUPIED</small><b>{model.usedSlots} / {model.availableSlots}</b></span>
            <span><small>AVAILABLE</small><b>{slotsRemaining}</b></span>
          </div>
        </header>
        {model.runs.length > 0 ? (
          <div className="expedition-run-list">
            {model.runs.map((run, index) => {
              const region = model.regions.find((candidate) => candidate.id === run.regionId);
              const selected = active?.id === run.id;
              const order = run.status === 'COMPLETE' ? 'RETURNED' : run.repeat ? 'REPEATING' : 'FINAL CYCLE';
              return (
                <button key={run.id} type="button" aria-pressed={selected} className={selected ? 'is-selected' : ''} onClick={() => setSelectedRunId(run.id)}>
                  <span><small>SLOT {index + 1}</small><strong>{region?.name ?? run.regionId}</strong></span>
                  <span><small>{order}</small><b>CYCLE {run.completedCycles}</b></span>
                  <em>{run.canClaim ? 'CLAIM READY' : run.remainingLabel}</em>
                  <ChevronRight />
                </button>
              );
            })}
          </div>
        ) : <p className="expedition-run-manager__empty">稼働中の遠征はありません。利用可能なスロットへ新しい遠征隊を派遣できます。</p>}
      </section>

      <div className="expedition-layout">
        <main className="expedition-planner">
          <section className="panel expedition-regions" aria-labelledby="expedition-region-heading">
            <header className="section-heading"><div><span className="eyebrow">DESTINATION</span><h3 id="expedition-region-heading">遠征リージョン</h3></div><span className="expedition-slot-count">AVAILABLE {slotsRemaining}</span></header>
            <div className="expedition-region-list">
              {model.regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  disabled={slotsRemaining <= 0 || region.locked}
                  aria-pressed={selectedRegion?.id === region.id}
                  className={selectedRegion?.id === region.id ? 'is-selected' : ''}
                  onClick={() => changeRegion(region.id)}
                >
                  <span className="region-index">{region.locked ? <LockKeyhole /> : <MapPinned />}</span>
                  <span className="region-copy"><small>{region.sector} / {region.element}</small><strong>{region.name}</strong><em>{region.locked ? region.lockReason : region.rewardHints.join(' · ')}</em></span>
                  <span className="region-threat"><small>THREAT</small><i>{Array.from({ length: 5 }, (_, index) => <b className={index < region.difficulty ? 'is-on' : ''} key={index} />)}</i></span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          </section>

          <section className="panel expedition-party" aria-labelledby="expedition-party-heading">
            <header className="section-heading"><div><span className="eyebrow">RESONANCE TEAM</span><h3 id="expedition-party-heading">遠征隊編成</h3></div><span>{selectedParty.length} / 3</span></header>
            <div className="expedition-party-grid">
              {model.party.map((stone) => {
                const selected = model.draft.partyIds.includes(stone.id);
                const unavailable = stone.condition !== undefined && stone.condition !== 'READY';
                return (
                  <button key={stone.id} type="button" disabled={slotsRemaining <= 0 || (unavailable && !selected)} aria-pressed={selected} className={selected ? 'is-selected' : ''} onClick={() => toggleParty(stone.id)}>
                    <StoneVisual rarity={stone.rarity} element={stone.element} size="sm" active={selected} />
                    <span><small>{stone.role} / {stone.element}</small><strong>{stone.nickname || stone.name}</strong><em>LV.{stone.level} · CP {stone.power.toLocaleString()}</em></span>
                    <i>{selected ? <Check /> : unavailable ? <LockKeyhole /> : <Users />}</i>
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="expedition-console">
          {active ? (
            <section className={`panel expedition-progress expedition-progress--${active.status.toLowerCase()}`}>
              <header><span><Route /> {active.status === 'COMPLETE' ? 'RETURN SIGNAL' : 'LIVE TELEMETRY'}</span><b>{active.status}</b></header>
              <div className="expedition-progress__dial" style={{ '--expedition-progress': `${Math.max(0, Math.min(100, active.progress))}%` } as React.CSSProperties}>
                <span><strong>{Math.round(active.progress)}%</strong><small>{active.status === 'COMPLETE' ? 'COMPLETE' : 'TRAVERSED'}</small></span>
              </div>
              <ProgressBar value={active.progress} max={100} tone="gold" />
              <dl><div><dt>経過</dt><dd>{active.elapsedLabel}</dd></div><div><dt>残り</dt><dd>{active.remainingLabel}</dd></div><div><dt>完了サイクル</dt><dd>{active.completedCycles}</dd></div><div><dt>帰還予定</dt><dd>{active.returnAtLabel}</dd></div></dl>
              {active.canStop ? <button className="expedition-stop-order" type="button" disabled={stopping} onClick={stop}><Flag />{stopping ? '帰還命令を送信中' : '現在のサイクル後に反復を停止'}</button> : active.status === 'ACTIVE' && !active.repeat ? <p className="expedition-final-order"><Flag />最終サイクル後に帰還します</p> : null}
            </section>
          ) : null}
          {slotsRemaining > 0 ? (
            <section className="panel expedition-config">
              <header className="section-heading"><div><span className="eyebrow">MISSION PARAMETERS</span><h3>遠征設定</h3></div><TimerReset /></header>
              <fieldset><legend>DURATION</legend><div className="expedition-duration">{selectedRegion?.durations.map((minutes) => <button type="button" key={minutes} aria-pressed={model.draft.durationMinutes === minutes} className={model.draft.durationMinutes === minutes ? 'is-selected' : ''} onClick={() => updateDraft({ durationMinutes: minutes })}>{formatDuration(minutes)}</button>)}</div></fieldset>
              <fieldset><legend>STRATEGY</legend><div className="expedition-strategies">{strategies.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} aria-pressed={model.draft.strategy === item.id} className={model.draft.strategy === item.id ? 'is-selected' : ''} onClick={() => updateDraft({ strategy: item.id })}><Icon /><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>; })}</div></fieldset>
              <button className="expedition-endless-toggle" type="button" role="switch" aria-checked={model.draft.endless} onClick={() => updateDraft({ endless: !model.draft.endless })}><InfinityIcon /><span><strong>ENDLESS ORDERS</strong><small>安全に帰還できる限り探索を継続</small></span><i /></button>
              <div className="expedition-launch-summary"><span><small>ACTIVE PLAN</small><b>{strategy.label} / {formatDuration(model.draft.durationMinutes)}</b></span><span><small>FORMATION</small><b>{selectedParty.length} STONES</b></span></div>
              <button className="primary-action expedition-launch" type="button" disabled={!canStart || starting} onClick={start}>{starting ? <TimerReset /> : <Zap />} {starting ? '遠征リンクを確立中' : '遠征を開始'}<ArrowRight /></button>
            </section>
          ) : null}
        </aside>
      </div>

      {active ? (
        <section className={`panel expedition-report ${active.status === 'COMPLETE' ? 'is-revealing' : ''}`} aria-live="polite">
          <header className="section-heading"><div><span className="eyebrow">CHRONICLE / {active.elapsedLabel}</span><h3>遠征レポート</h3></div>{active.status === 'COMPLETE' && revealStep < totalRevealSteps ? <button className="text-button" type="button" onClick={() => setRevealStep(totalRevealSteps)}><FastForward />演出をスキップ</button> : <span className="report-live"><i /> {active.status}</span>}</header>
          <div className="expedition-report-summary" aria-label="遠征集計">
            <span><small>DURATION</small><strong>{active.durationLabel}</strong></span>
            <span><small>STRATEGY</small><strong>{active.strategy}</strong></span>
            <span><small>BATTLES / WINS</small><strong>{active.summary.battles} / {active.summary.wins}</strong></span>
            <span><small>MINING YIELD</small><strong>{active.summary.miningYield.toLocaleString()}</strong></span>
            <span><small>RARE EVENTS</small><strong>{active.summary.rareDiscoveries}</strong></span>
            <span><small>EQUIPMENT</small><strong>{active.summary.equipmentDrops}</strong></span>
            <span><small>BEST DROP</small><strong>{active.summary.bestDropRarity ?? '—'}</strong></span>
            <span><small>PARTY</small><strong>{active.partyIds.length} STONES</strong></span>
          </div>
          <div className="expedition-timeline">
            {active.report.map((event, index) => {
              const Icon = reportIcons[event.type];
              const visible = index < reportVisible;
              return <article key={event.id} className={`${visible ? 'is-visible' : ''} ${event.type === 'RARE_SIGNAL' ? 'is-rare' : ''}`} aria-hidden={!visible}><time>{event.atLabel}</time><span className="report-node"><Icon /></span><div><small>{event.type.replace('_', ' ')}</small><strong>{event.type === 'RARE_SIGNAL' ? 'UNKNOWN SIGNAL' : event.title}</strong><p>{event.description}</p>{event.reward ? <em>{event.reward}</em> : null}</div></article>;
            })}
            {active.rareSignal ? <article className={`expedition-unknown ${rareSignalVisible ? 'is-visible' : ''}`} aria-hidden={!rareSignalVisible}><time>EXTRA</time><span className="report-node"><Sparkles /></span><div><small>RARE RESONANCE</small><strong>{active.rareSignal.appraised ? active.rareSignal.name : 'UNKNOWN SIGNAL'}</strong><p>{active.rareSignal.hint}</p>{onInspectSignal ? <button type="button" onClick={() => onInspectSignal(active.rareSignal!.id)}><Radar />信号を解析</button> : null}</div></article> : null}
          </div>
          {active.canClaim ? <footer className="expedition-claim"><div className="expedition-rewards" aria-label="段階開示される遠征報酬">{orderedRewards.slice(0, visibleRewardCount).map((reward) => <span key={reward.id} className={reward.kind === 'UNKNOWN' ? 'is-unknown' : ''}><Gem /><small>{reward.kind}</small><strong>{reward.label}{reward.amount ? ` ×${reward.amount.toLocaleString()}` : ''}</strong></span>)}</div><button className="primary-action" type="button" disabled={(active.status === 'COMPLETE' && revealStep < totalRevealSteps) || claiming} onClick={claim}><PackageCheck />{claiming ? '同期中' : active.status === 'COMPLETE' ? '帰還報酬を受け取る' : '保存報酬を受け取る'}<ArrowRight /></button></footer> : null}
        </section>
      ) : null}

      {model.storedDiscoveries.length > 0 ? (
        <section className="panel expedition-discovery-storage" aria-labelledby="expedition-storage-heading">
          <header className="section-heading"><div><span className="eyebrow">OVERFLOW PROTECTION</span><h3 id="expedition-storage-heading">Temporary Discovery Storage</h3></div><span>{model.storedDiscoveries.length} SIGNALS</span></header>
          <p>Stone所持枠が満杯でもRare Discoveryは消えません。空きを作った後、ここから個別に解析できます。</p>
          <div>{model.storedDiscoveries.map((discovery) => (
            <article key={discovery.id}>
              <span><Radar /></span>
              <div><small>{discovery.sourceLabel} / {discovery.discoveredAtLabel}</small><strong>UNKNOWN SIGNAL</strong><p>{discovery.hint}</p></div>
              <button type="button" disabled={!onInspectSignal} onClick={() => onInspectSignal?.(discovery.id)}><Sparkles />解析する</button>
            </article>
          ))}</div>
        </section>
      ) : null}
    </div>
  );
}
