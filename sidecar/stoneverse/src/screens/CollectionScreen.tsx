import {
  BarChart3,
  Boxes,
  ChevronDown,
  Dna,
  Heart,
  History,
  Lock,
  Search,
  Shield,
  Sparkles,
  Swords,
  Unlock,
  UsersRound,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { GameModal } from '../components/GameModal';
import { ProgressBar } from '../components/ProgressBar';
import { StoneCard } from '../components/StoneCard';
import { StoneVisual } from '../components/StoneVisual';
import type { UiRarity, UiStone } from '../components/uiTypes';

interface CollectionScreenProps {
  stones: UiStone[];
  selectedId?: string;
  onSelect: (id?: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleLock: (id: string) => void;
  onTrain: (id: string) => void;
}

const rarities: Array<'ALL' | UiRarity> = ['ALL', 'NORMAL', 'RARE', 'SR', 'SSR', 'UR', 'LEGENDARY'];

export function CollectionScreen({ stones, selectedId, onSelect, onToggleFavorite, onToggleLock, onTrain }: CollectionScreenProps) {
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<(typeof rarities)[number]>('ALL');
  const [origin, setOrigin] = useState('ALL');
  const [sort, setSort] = useState('power');
  const [detailTab, setDetailTab] = useState<'status' | 'skills' | 'lineage' | 'record'>('status');
  const selected = stones.find((stone) => stone.id === selectedId);
  const origins = Array.from(new Set(stones.map((stone) => stone.origin)));

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return stones
      .filter((stone) => rarity === 'ALL' || stone.rarity === rarity)
      .filter((stone) => origin === 'ALL' || stone.origin === origin)
      .filter((stone) => !normalized || `${stone.name} ${stone.nickname} ${stone.serial}`.toLowerCase().includes(normalized))
      .sort((a, b) => {
        if (sort === 'level') return b.level - a.level;
        if (sort === 'obtained') return b.obtainedAt.localeCompare(a.obtainedAt);
        if (sort === 'rarity') return rarities.indexOf(b.rarity) - rarities.indexOf(a.rarity);
        return b.combatPower - a.combatPower;
      });
  }, [stones, search, rarity, origin, sort]);

  const mutationCount = stones.filter((stone) => stone.mutation).length;
  const naturalCount = stones.filter((stone) => stone.origin.toUpperCase() === 'NATURAL').length;

  return (
    <div className="collection-screen">
      <section className="collection-summary panel">
        <div className="completion-orbit" style={{ '--completion': '68deg' } as React.CSSProperties}>
          <span><b>{stones.length}</b><small>INDIVIDUALS</small></span>
        </div>
        <div><span className="eyebrow">ARCHIVE COMPLETION</span><h2>共鳴体アーカイブ</h2><p>発見した全個体と、その血統・変異記録を保管しています。</p></div>
        <div className="completion-stats">
          <span><small>SPECIES</small><b>18<em>/ 64</em></b></span>
          <span><small>MUTATION</small><b>{mutationCount}<em>/ 12</em></b></span>
          <span><small>NATURAL</small><b>{naturalCount}</b></span>
        </div>
      </section>

      <section className="collection-toolbar panel">
        <label className="search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="名前・シリアルで検索" /><span>{filtered.length}</span></label>
        <div className="rarity-filters" role="group" aria-label="レアリティ絞り込み">
          {rarities.map((item) => <button type="button" key={item} className={rarity === item ? 'is-active' : ''} onClick={() => setRarity(item)}>{item}</button>)}
        </div>
        <label className="select-field"><span>ORIGIN</span><select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="ALL">すべて</option>{origins.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown /></label>
        <label className="select-field"><span>SORT</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="power">戦闘力</option><option value="rarity">レアリティ</option><option value="level">レベル</option><option value="obtained">入手順</option></select><ChevronDown /></label>
      </section>

      {filtered.length ? (
        <section className="stone-grid">
          {filtered.map((stone) => <StoneCard key={stone.id} stone={stone} onClick={() => onSelect(stone.id)} />)}
        </section>
      ) : (
        <section className="collection-empty panel"><Boxes /><h3>条件に一致する個体がいません</h3><p>検索語かフィルターを変更してください。</p><button className="secondary-action" type="button" onClick={() => { setSearch(''); setRarity('ALL'); setOrigin('ALL'); }}><X />条件をクリア</button></section>
      )}

      <GameModal open={Boolean(selected)} onClose={() => onSelect(undefined)} title={selected?.nickname || selected?.name || ''} eyebrow="INDIVIDUAL RECORD" wide>
        {selected ? (
          <div className={`stone-detail rarity-detail-${selected.rarity.toLowerCase()}`}>
            <section className="stone-detail__visual">
              <div className="stone-detail__badges"><span className={`rarity-label rarity-label--${selected.rarity.toLowerCase()}`}>{selected.rarity}</span><span className="origin-badge">{selected.origin.toUpperCase()}</span>{selected.mutation ? <span className="mutation-badge"><Sparkles />{selected.mutation}</span> : null}</div>
              <StoneVisual rarity={selected.rarity} element={selected.element} mutation={selected.mutation} variant={selected.colorVariant} size="hero" active />
              <div className="stone-detail__identity"><small>{selected.speciesId} · {selected.serial}</small><h3>{selected.nickname || selected.name}</h3><span>{selected.name} / {selected.element}{selected.secondaryElement ? ` × ${selected.secondaryElement}` : ''}</span></div>
              <div className="stone-detail__actions"><button type="button" className={selected.favorite ? 'is-active' : ''} onClick={() => onToggleFavorite(selected.id)}><Heart fill={selected.favorite ? 'currentColor' : 'none'} />お気に入り</button><button type="button" className={selected.locked ? 'is-active' : ''} onClick={() => onToggleLock(selected.id)}>{selected.locked ? <Lock /> : <Unlock />}{selected.locked ? '保護中' : '保護する'}</button></div>
            </section>
            <section className="stone-detail__data">
              <div className="detail-tabs" role="tablist">
                <button type="button" className={detailTab === 'status' ? 'is-active' : ''} onClick={() => setDetailTab('status')}><BarChart3 />能力</button>
                <button type="button" className={detailTab === 'skills' ? 'is-active' : ''} onClick={() => setDetailTab('skills')}><Swords />スキル</button>
                <button type="button" className={detailTab === 'lineage' ? 'is-active' : ''} onClick={() => setDetailTab('lineage')}><Dna />血統</button>
                <button type="button" className={detailTab === 'record' ? 'is-active' : ''} onClick={() => setDetailTab('record')}><History />記録</button>
              </div>

              {detailTab === 'status' ? (
                <div className="detail-pane">
                  <div className="level-readout"><span><small>LEVEL</small><b>{selected.level}<em>/100</em></b></span><div><ProgressBar value={selected.xp} max={selected.xpNext} label="STONE XP" /><button className="primary-action primary-action--small" type="button" onClick={() => onTrain(selected.id)}>育成素材を使う</button></div></div>
                  <div className="stone-stat-grid">
                    {(Object.keys(selected.stats) as Array<keyof typeof selected.stats>).map((key) => (
                      <div key={key}><span>{key.toUpperCase()}</span><b>{selected.stats[key].toLocaleString()}</b><em>IV {selected.ivs[key]}</em><i style={{ width: `${(selected.ivs[key] / 31) * 100}%` }} /></div>
                    ))}
                  </div>
                  <div className="detail-info-grid"><span><small>POTENTIAL</small><b>{selected.potential}</b></span><span><small>PERSONALITY</small><b>{selected.personality}</b></span><span><small>AFFINITY</small><b>{selected.affinity}</b></span><span><small>AWAKEN</small><b>STAGE {selected.awakening}</b></span></div>
                </div>
              ) : null}

              {detailTab === 'skills' ? (
                <div className="detail-pane"><div className="trait-block"><h4><Shield />TRAITS</h4>{selected.traits.map((trait, index) => <article key={`${trait}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{trait}</strong><p>共鳴条件を満たすと戦闘中に固有効果を発揮します。</p></div></article>)}</div><div className="skill-block"><h4><Swords />SKILL LOADOUT</h4>{selected.skills.map((skill, index) => <article key={`${skill}-${index}`}><span className="skill-cost">{index + 1}</span><div><strong>{skill}</strong><p>{selected.element}属性 / 威力 {78 + index * 23}</p></div></article>)}</div></div>
              ) : null}

              {detailTab === 'lineage' ? (
                <div className="detail-pane lineage-pane"><div className="family-tree"><div className="family-node family-node--child"><StoneVisual rarity={selected.rarity} element={selected.element} size="sm" /><strong>{selected.nickname || selected.name}</strong><small>GEN {selected.generation}</small></div>{selected.parentIds.length ? selected.parentIds.map((id, index) => { const parent = stones.find((stone) => stone.id === id); return <div className={`family-node family-node--parent family-node--parent-${index + 1}`} key={id}>{parent ? <StoneVisual rarity={parent.rarity} element={parent.element} size="sm" /> : <UsersRound />}<strong>{parent?.nickname || parent?.name || '記録不明'}</strong><small>{id.slice(0, 10)}</small></div>; }) : <div className="natural-lineage"><Sparkles /><strong>天然起源個体</strong><span>この個体に親系譜は存在しません</span></div>}</div></div>
              ) : null}

              {detailTab === 'record' ? (
                <div className="detail-pane record-pane"><div className="record-hero"><strong>{selected.battleWins}</strong><span>VICTORIES</span><small>{selected.battleCount} BATTLES / WIN RATE {selected.battleCount ? Math.round(selected.battleWins / selected.battleCount * 100) : 0}%</small></div><dl><div><dt>DISCOVERER</dt><dd>{selected.discoverer}</dd></div><div><dt>ORIGINAL OWNER</dt><dd>{selected.originalOwner}</dd></div><div><dt>FIRST OBTAINED</dt><dd>{new Date(selected.obtainedAt).toLocaleString('ja-JP')}</dd></div><div><dt>REINCARNATION</dt><dd>0</dd></div></dl></div>
              ) : null}
            </section>
          </div>
        ) : null}
      </GameModal>
    </div>
  );
}
