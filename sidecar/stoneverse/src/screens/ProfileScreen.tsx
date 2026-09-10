import { Award, CalendarDays, ChevronRight, Crown, Gem, Medal, Mountain, Pencil, Radio, Shield, Sparkles, Swords, Trophy, UserRound } from 'lucide-react';
import { ProgressBar } from '../components/ProgressBar';
import { StoneVisual } from '../components/StoneVisual';
import type { UiPlayer, UiStone } from '../components/uiTypes';

interface ProfileScreenProps {
  player: UiPlayer;
  stones: UiStone[];
  showcaseIds: string[];
  onOpenStone: (id: string) => void;
}

export function ProfileScreen({ player, stones, showcaseIds, onOpenStone }: ProfileScreenProps) {
  const showcase = showcaseIds.map((id) => stones.find((stone) => stone.id === id)).filter((stone): stone is UiStone => Boolean(stone));
  const rarest = [...stones].sort((a, b) => ['NORMAL', 'RARE', 'SR', 'SSR', 'UR', 'LEGENDARY'].indexOf(b.rarity) - ['NORMAL', 'RARE', 'SR', 'SSR', 'UR', 'LEGENDARY'].indexOf(a.rarity))[0];

  return (
    <div className="profile-screen">
      <section className="profile-hero panel">
        <div className="profile-hero__mesh" />
        <div className="profile-avatar"><span><UserRound /></span><i><Radio /></i></div>
        <div className="profile-identity"><span className="profile-title"><Crown />{player.title}</span><h2>{player.username}</h2><p>ID: {player.id} · STONE ACCOUNT</p><div><span>ACCOUNT LV.{player.accountLevel}</span><ProgressBar value={player.accountXp} max={player.accountXpNext} tone="violet" compact /></div></div>
        <button className="profile-edit" type="button"><Pencil />プロフィール編集</button>
        <div className="profile-rank"><span className="rank-emblem"><Shield /><i /></span><div><small>ARENA SEASON 03</small><strong>{player.arenaRank}</strong><span>TOP 8.4%</span></div></div>
      </section>

      <section className="profile-metrics">
        <article className="panel"><Mountain /><span><small>TOTAL MINING</small><strong>{player.totalMined.toLocaleString()}</strong><em>WORLD TOP 12%</em></span></article>
        <article className="panel"><Gem /><span><small>COLLECTION</small><strong>{player.collectionRate.toFixed(1)}%</strong><em>{stones.length} INDIVIDUALS</em></span></article>
        <article className="panel"><Award /><span><small>ACHIEVEMENTS</small><strong>{player.achievementRate.toFixed(1)}%</strong><em>42 / 180 UNLOCKED</em></span></article>
        <article className="panel"><Swords /><span><small>RAID DAMAGE</small><strong>2.48M</strong><em>SEASON BEST</em></span></article>
      </section>

      <section className="showcase-panel panel">
        <header className="section-heading"><div><span className="eyebrow">PUBLIC SHOWCASE</span><h3>共鳴個体ショーケース</h3><p>公開プロフィールに展示される、あなたを象徴する個体です。</p></div><span className="visibility-badge"><Radio /> PUBLIC</span></header>
        <div className="showcase-stage">
          {showcase.slice(0, 3).map((stone, index) => <button type="button" key={stone.id} className={`showcase-stone showcase-stone--${index + 1} rarity-showcase-${stone.rarity.toLowerCase()}`} onClick={() => onOpenStone(stone.id)}><span className="showcase-stone__beam" /><StoneVisual rarity={stone.rarity} element={stone.element} mutation={stone.mutation} variant={stone.colorVariant} size={index === 0 ? 'hero' : 'lg'} active /><span className={`rarity-label rarity-label--${stone.rarity.toLowerCase()}`}>{stone.rarity}</span><strong>{stone.nickname || stone.name}</strong><small>LV.{stone.level} · {stone.origin.toUpperCase()}</small>{stone.mutation ? <em><Sparkles />{stone.mutation}</em> : null}</button>)}
          {!showcase.length && rarest ? <button type="button" className="showcase-empty" onClick={() => onOpenStone(rarest.id)}><Gem /><span>お気に入り個体をショーケースに設定</span></button> : null}
        </div>
      </section>

      <section className="profile-lower-grid">
        <article className="panel achievement-highlight"><header className="section-heading"><div><span className="eyebrow">RARE ACHIEVEMENTS</span><h3>称号記録</h3></div><button className="text-button" type="button">すべて見る<ChevronRight /></button></header><div className="achievement-medals"><span><i><Medal /></i><strong>深層を識る者</strong><small>LEGENDARY · 0.4%</small></span><span><i><Sparkles /></i><strong>完全なる共鳴</strong><small>SSR · 3.1%</small></span><span><i><Trophy /></i><strong>百戦錬磨</strong><small>SR · 12.8%</small></span></div></article>
        <article className="panel profile-history"><header className="section-heading"><div><span className="eyebrow">ACCOUNT RECORD</span><h3>活動記録</h3></div><CalendarDays /></header><dl><div><dt>採掘技師レベル</dt><dd>LV.{player.miningLevel}</dd></div><div><dt>最高アリーナランク</dt><dd>{player.arenaRank}</dd></div><div><dt>天然最高レア</dt><dd>{stones.filter((stone) => stone.origin === 'Natural').sort((a, b) => b.combatPower - a.combatPower)[0]?.rarity || '—'}</dd></div><div><dt>アカウント作成</dt><dd>2026.09.10</dd></div></dl></article>
      </section>
    </div>
  );
}
