import { ArrowDown, ArrowUp, ChevronDown, Crown, Gem, Minus, Radio, Search, Shield, Sparkles, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StoneVisual } from '../components/StoneVisual';
import type { UiRankingEntry } from '../components/uiTypes';

interface RankingScreenProps {
  entries: UiRankingEntry[];
  category: string;
  season: string;
  onCategoryChange: (category: string) => void;
}

const categories = [
  '総合採掘',
  '本日採掘',
  '週間採掘',
  '月間採掘',
  '図鑑',
  '実績',
  'アリーナ',
  'レイド',
  '希少発見',
  '配合発見',
  'Endless最高階層',
  '最速踏破',
  '最少被ダメ',
  '遠征スコア',
  'Boss撃破',
  '戦闘力',
];

export function RankingScreen({ entries, category, season, onCategoryChange }: RankingScreenProps) {
  const [search, setSearch] = useState('');
  const player = entries.find((entry) => entry.isPlayer);
  const filtered = useMemo(() => entries.filter((entry) => !search || entry.name.toLowerCase().includes(search.toLowerCase())), [entries, search]);
  const podium = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  return (
    <div className="ranking-screen">
      <section className="ranking-hero panel">
        <div><span className="status-kicker"><Radio /> LIVE SEASON</span><h2>WORLD RESONANCE RANKING</h2><p>{season} · 次回集計まで 02日 14:32:09</p></div><div className="season-emblem"><Trophy /><span><small>SEASON</small><b>03</b></span></div>
      </section>
      <section className="ranking-toolbar panel"><div className="ranking-tabs">{categories.map((item) => <button type="button" key={item} className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => onCategoryChange(item)}>{item}</button>)}</div><label className="search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="プレイヤー検索" /></label><label className="select-field"><span>REGION</span><select><option>GLOBAL</option><option>JAPAN</option></select><ChevronDown /></label></section>

      <section className="podium" aria-label="上位3名">
        {[podium[1], podium[0], podium[2]].map((entry, visualIndex) => entry ? <article className={`podium-card podium-card--${entry.rank}`} key={entry.id}><span className="podium-card__crown">{entry.rank === 1 ? <Crown /> : <Shield />}</span><div className="podium-avatar"><span>{entry.name.slice(0, 1)}</span>{entry.stone ? <StoneVisual rarity={entry.stone.rarity} element={entry.stone.element} mutation={entry.stone.mutation} size="sm" /> : null}</div><span className="podium-rank">#{entry.rank}</span><strong>{entry.name}</strong><small>{entry.title}</small><b>{entry.score.toLocaleString()}</b><em>{category}</em><div className="podium-base"><i /><span>{entry.rank}</span></div></article> : <div key={visualIndex} />)}
      </section>

      <section className="ranking-list panel">
        <header><span>RANK</span><span>PLAYER</span><span>LEVEL</span><span>SCORE</span><span>TREND</span></header>
        <div className="ranking-scroll">
          {rest.map((entry) => <article className={entry.isPlayer ? 'is-player' : ''} key={entry.id}><b className="rank-number">#{entry.rank}</b><div className="rank-player"><span className="rank-avatar">{entry.name.slice(0, 1)}</span><span><strong>{entry.name}</strong><small>{entry.title}</small></span>{entry.isPlayer ? <em>YOU</em> : null}</div><span>LV.{entry.level}</span><b>{entry.score.toLocaleString()}</b><span className={entry.delta && entry.delta > 0 ? 'trend-up' : entry.delta && entry.delta < 0 ? 'trend-down' : ''}>{entry.delta && entry.delta > 0 ? <ArrowUp /> : entry.delta && entry.delta < 0 ? <ArrowDown /> : <Minus />}{entry.delta ? Math.abs(entry.delta) : ''}</span></article>)}
        </div>
      </section>
      {player ? <aside className="my-rank"><span className="my-rank__icon"><Gem /></span><span><small>YOUR CURRENT RANK</small><strong>#{player.rank}</strong></span><div><b>{player.name}</b><small>{category}</small></div><strong>{player.score.toLocaleString()}</strong>{player.delta && player.delta > 0 ? <em><Sparkles /> {player.delta} RANK UP</em> : null}</aside> : null}
    </div>
  );
}
