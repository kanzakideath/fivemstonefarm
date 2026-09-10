import {
  ArrowUpRight,
  Award,
  BrainCircuit,
  ChevronRight,
  Clock3,
  FlaskConical,
  Gem,
  GraduationCap,
  Infinity as InfinityIcon,
  Map,
  Mountain,
  Radar,
  Sparkles,
  Swords,
  Target,
  Trophy,
} from 'lucide-react';
import { ProgressBar } from '../components/ProgressBar';
import { StoneVisual } from '../components/StoneVisual';
import type { ActiveExpeditionView, EndlessMineViewModel } from '../components/adventureTypes';
import type { UiMission, UiPlayer, UiRoute, UiStone } from '../components/uiTypes';
import type { DirectedGoal } from '../domain/goalDirector';
import type { FacilityAssignmentView, ResearchSlotView } from './FacilitiesScreen';

interface HomeScreenProps {
  player: UiPlayer;
  stones: UiStone[];
  party: UiStone[];
  missions: UiMission[];
  expedition?: ActiveExpeditionView;
  endless: EndlessMineViewModel;
  training?: FacilityAssignmentView;
  research?: ResearchSlotView;
  nextGoals: DirectedGoal[];
  onNavigate: (route: UiRoute) => void;
}

const endlessStatusLabel: Record<EndlessMineViewModel['status'], string> = {
  READY: '潜行待機中',
  RUNNING: '自動潜行中',
  PAUSED: '一時停止中',
  ENDED: '報酬確定待ち',
};

export function HomeScreen({ player, stones, party, missions, expedition, endless, training, research, nextGoals, onNavigate }: HomeScreenProps) {
  const featured = party[0] ?? stones[0];
  const completed = missions.filter((mission) => mission.complete).length;

  return (
    <div className="home-screen screen-grid">
      <section className="home-hero panel panel--aurora">
        <div className="home-hero__grid" />
        <div className="home-hero__copy">
          <span className="status-kicker"><Radar size={14} /> RESONANCE BASE / SECTOR 07</span>
          <h2>深層鉱脈が、<br /><em>あなたの共鳴</em>を待っている。</h2>
          <p>新たな結晶反応を検出。天然個体の発見確率が次のセッションで上昇します。</p>
          <div className="home-hero__actions">
            <button className="primary-action" type="button" onClick={() => onNavigate('mine')}><Mountain size={18} />採掘を開始<span><ArrowUpRight size={15} /></span></button>
            <button className="secondary-action" type="button" onClick={() => onNavigate('battle')}><Swords size={18} />遠征戦へ</button>
          </div>
          <div className="hero-signal"><i /><span>NEXT VEIN</span><b>黒曜断層・深度 1,240m</b></div>
        </div>
        <div className="home-hero__stone">
          {featured ? (
            <>
              <StoneVisual rarity={featured.rarity} element={featured.element} mutation={featured.mutation} variant={featured.colorVariant} size="hero" active />
              <div className="hero-stone__plate">
                <span>ACTIVE PARTNER</span><strong>{featured.nickname || featured.name}</strong><small>LV.{featured.level} · CP {featured.combatPower.toLocaleString()}</small>
              </div>
            </>
          ) : <div className="empty-stone"><Gem /><span>最初の石を発見しよう</span></div>}
        </div>
      </section>

      <section className="home-vitals panel">
        <header className="section-heading"><div><span className="eyebrow">PROGRESSION</span><h3>レゾナンス・ステータス</h3></div><button className="text-button" type="button" onClick={() => onNavigate('profile')}>詳細<ChevronRight /></button></header>
        <div className="vital-level">
          <span className="level-crest"><b>{player.accountLevel}</b><small>LEVEL</small></span>
          <div><strong>{player.username}</strong><span>{player.title}</span><ProgressBar value={player.accountXp} max={player.accountXpNext} label="ACCOUNT XP" tone="violet" /></div>
        </div>
        <div className="vital-mining">
          <div className="vital-mining__label"><Mountain /><span><small>MINING LEVEL</small><b>LV.{player.miningLevel}</b></span></div>
          <ProgressBar value={player.miningXp} max={player.miningXpNext} tone="gold" />
          <span>次の採掘区画まで {Math.max(0, player.miningXpNext - player.miningXp).toLocaleString()} XP</span>
        </div>
        <div className="stat-triplet">
          <div><span>採掘総数</span><b>{player.totalMined.toLocaleString()}</b></div>
          <div><span>図鑑完成</span><b>{player.collectionRate.toFixed(1)}%</b></div>
          <div><span>連続探索</span><b>{player.streak}<small> DAYS</small></b></div>
        </div>
      </section>

      <section className="facility-grid">
        <button className="facility-card facility-card--fusion" type="button" onClick={() => onNavigate('fusion')}>
          <span className="facility-card__icon"><FlaskConical /></span><span><small>FACILITY 04</small><strong>配合ラボ</strong><em>遺伝子スロット ×2 開放中</em></span><ChevronRight />
        </button>
        <button className="facility-card facility-card--gacha" type="button" onClick={() => onNavigate('gacha')}>
          <span className="facility-card__icon"><Sparkles /></span><span><small>CELESTIAL ARCHIVE</small><strong>共鳴召喚</strong><em>SSR保証まであと 12</em></span><ChevronRight />
        </button>
        <button className="facility-card facility-card--ranking" type="button" onClick={() => onNavigate('ranking')}>
          <span className="facility-card__icon"><Trophy /></span><span><small>SEASON 03</small><strong>ランキング</strong><em>{player.arenaRank} · オンライン集計</em></span><ChevronRight />
        </button>
      </section>

      <section className="home-activity-grid" aria-label="現在進行中の活動">
        <button type="button" onClick={() => onNavigate('expedition')} className={expedition?.status === 'COMPLETE' ? 'is-ready' : ''}>
          <span><Map /></span><div><small>EXPEDITION</small><strong>{expedition ? expedition.status === 'COMPLETE' ? '遠征報告が到着' : '遠征隊が探索中' : '遠征枠が空いています'}</strong><em>{expedition ? expedition.status === 'COMPLETE' ? '報酬を受取可能' : `帰還まで ${expedition.remainingLabel}` : '地域・作戦・時間を選択'}</em></div><ChevronRight />
        </button>
        <button type="button" onClick={() => onNavigate('endless')} className={endless.status === 'ENDED' ? 'is-ready' : ''}>
          <span><InfinityIcon /></span><div><small>ENDLESS MINE</small><strong>Floor {endless.floor.toLocaleString()}</strong><em>{endlessStatusLabel[endless.status]} · BEST {endless.bestFloor.toLocaleString()}</em></div><ChevronRight />
        </button>
        <button type="button" onClick={() => onNavigate('facilities')} className={training?.canClaim ? 'is-ready' : ''}>
          <span><GraduationCap /></span><div><small>TRAINING</small><strong>{training?.stoneName ?? '空きスロット'}</strong><em>{training ? `${training.bankedLabel}${training.canClaim ? ' · 受取可能' : ''}` : 'Stoneを配置して放置育成'}</em></div><ChevronRight />
        </button>
        <button type="button" onClick={() => onNavigate('facilities')} className={research?.ready ? 'is-ready' : ''}>
          <span><BrainCircuit /></span><div><small>RESEARCH</small><strong>{research?.name ?? '空きスロット'}</strong><em>{research ? research.ready ? '解析完了 · 成果を確定可能' : `残り ${research.remainingLabel}` : '恒久研究プロジェクトを選択'}</em></div><ChevronRight />
        </button>
      </section>

      <section className="next-goals-panel panel">
        <header className="section-heading"><div><span className="eyebrow">DIRECTED PROGRESSION</span><h3>次にやること</h3></div><span className="mission-count">{nextGoals.length}</span></header>
        <div className="next-goals-list">
          {nextGoals.map((goal) => (
            <button type="button" key={goal.id} onClick={() => onNavigate(goal.route)}>
              <span className={`next-goal-kind next-goal-kind--${goal.kind.toLowerCase()}`}>{goal.kind === 'EXPEDITION' ? <Map /> : goal.kind === 'ENDLESS' ? <InfinityIcon /> : goal.kind === 'TRAINING' ? <GraduationCap /> : goal.kind === 'RESEARCH' ? <BrainCircuit /> : <Target />}</span>
              <div><small>{goal.kind}</small><strong>{goal.label}</strong><em>{goal.detail}</em><ProgressBar value={goal.current} max={goal.target} compact /></div>
              <ChevronRight />
            </button>
          ))}
        </div>
      </section>

      <section className="mission-panel panel">
        <header className="section-heading"><div><span className="eyebrow">TODAY'S SIGNAL</span><h3>デイリーミッション</h3></div><span className="mission-count">{completed}/{missions.length}</span></header>
        <div className="mission-list">
          {missions.slice(0, 3).map((mission) => (
            <article className={`mission-row ${mission.complete ? 'is-complete' : ''}`} key={mission.id}>
              <span className="mission-row__icon">{mission.complete ? <Award /> : <Target />}</span>
              <div><strong>{mission.label}</strong><span>{mission.detail}</span><ProgressBar value={mission.current} max={mission.goal} compact /></div>
              <span className="mission-row__reward"><small>REWARD</small>{mission.reward}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="expedition-panel panel">
        <header className="section-heading"><div><span className="eyebrow">EXPEDITION</span><h3>遠征ビーコン</h3></div><button className="text-button" type="button" onClick={() => onNavigate('expedition')}>詳細<ChevronRight /></button></header>
        <div className="expedition-map">
          <span className="map-ring map-ring--one" /><span className="map-ring map-ring--two" />
          <i className="map-node map-node--home" /><i className="map-node map-node--active" /><i className="map-node map-node--locked" />
          <svg viewBox="0 0 340 150" aria-hidden="true"><path d="M45 102 C112 44 188 130 282 48" /></svg>
          <div className="expedition-map__status"><Clock3 /><span><small>{expedition ? expedition.status === 'COMPLETE' ? '帰還済み' : '探索中' : 'BEACON STANDBY'}</small><b>{expedition ? expedition.regionId.replaceAll('_', ' ').toUpperCase() : '遠征計画を作成'}</b><em>{expedition ? expedition.status === 'COMPLETE' ? 'REPORT READY' : expedition.remainingLabel : 'READY'}</em></span></div>
        </div>
      </section>
    </div>
  );
}
