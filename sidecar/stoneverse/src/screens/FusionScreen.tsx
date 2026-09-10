import { Atom, ChevronRight, Dna, FlaskConical, Gem, Lock, Plus, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { StoneCard } from '../components/StoneCard';
import { StoneVisual } from '../components/StoneVisual';
import type { UiStone } from '../components/uiTypes';
import { FUSION_CATALYSTS, FUSION_RECIPES, SPECIES_BY_ID } from '../data';
import { DEFAULT_FUSION_COST, findPresentationRecipe, formatCost } from './definitionPresentation';

interface FusionScreenProps {
  stones: UiStone[];
  facilityLevel: number;
  catalysts: number;
  reducedMotion: boolean;
  onFuse: (parentIds: string[], catalyst?: string, consumeParents?: boolean) => Promise<UiStone>;
}

type FusionPhase = 'select' | 'genes' | 'fusion' | 'silhouette' | 'reveal';
const delay = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));

export function FusionScreen({ stones, facilityLevel, catalysts, reducedMotion, onFuse }: FusionScreenProps) {
  const [parents, setParents] = useState<string[]>([]);
  const [catalyst, setCatalyst] = useState<string>();
  const [phase, setPhase] = useState<FusionPhase>('select');
  const [result, setResult] = useState<UiStone>();
  const [consumeParents, setConsumeParents] = useState(false);
  const [sequenceParents, setSequenceParents] = useState<UiStone[]>([]);
  const [filter, setFilter] = useState('ALL');
  const eligible = stones.filter((stone) => !stone.locked);
  const selected = parents.map((id) => stones.find((stone) => stone.id === id)).filter((stone): stone is UiStone => Boolean(stone));
  const consumptionBlocked = selected.some((stone) => stone.locked || stone.favorite);
  const elements = Array.from(new Set(stones.map((stone) => stone.element)));
  const filtered = eligible.filter((stone) => filter === 'ALL' || stone.element === filter);
  const mutagen = FUSION_CATALYSTS.find((item) => item.id === 'catalyst_mutagen')!;
  const mutagenUnlocked = facilityLevel >= mutagen.requiredLabLevel;
  const mutagenUsable = mutagenUnlocked && catalysts > 0;
  const activeCatalyst = catalyst === mutagen.id && mutagenUsable ? catalyst : undefined;
  const recipe = useMemo(() => findPresentationRecipe(selected.map((stone) => ({
    speciesId: stone.speciesId,
    primaryElement: stone.element,
    secondaryElement: stone.secondaryElement,
  })), facilityLevel, FUSION_RECIPES, SPECIES_BY_ID, {
    catalystIds: activeCatalyst ? [activeCatalyst] : [],
    catalysts: FUSION_CATALYSTS,
  }), [selected, facilityLevel, activeCatalyst]);
  const fusionCost = formatCost(recipe?.cost ?? DEFAULT_FUSION_COST);
  const probability = useMemo(() => {
    if (selected.length < 2) return [];
    const average = Math.round(selected.reduce((sum, stone) => sum + stone.potential, 0) / selected.length);
    const resultNames = (recipe?.resultSpeciesIds ?? [...new Set(selected.map((stone) => stone.speciesId))]).map((id) => SPECIES_BY_ID[id]?.name ?? id);
    return [
      { label: 'RESULT POOL', value: resultNames.length === 1 ? resultNames[0] : `${resultNames.length} CANDIDATES`, progress: 100 },
      { label: 'RECIPE', value: recipe?.type ?? 'GENERAL', progress: recipe ? 100 : 50 },
      { label: 'MUTATION', value: activeCatalyst ? `×${mutagen.mutationMultiplier ?? 1}` : 'BASE ×1', progress: activeCatalyst ? 100 : 25 },
      { label: 'PARENT POTENTIAL', value: average.toString(), progress: Math.min(100, average) },
    ];
  }, [selected, recipe, activeCatalyst, mutagen.mutationMultiplier]);

  const toggleParent = (id: string) => {
    setParents((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 2 ? [...current, id] : [current[1], id]);
  };

  const beginFusion = async () => {
    if (parents.length < 2 || phase !== 'select' || (consumeParents && consumptionBlocked)) return;
    setSequenceParents(selected.map((stone) => ({ ...stone })));
    setPhase('genes');
    try {
      const confirmed = await onFuse(parents, activeCatalyst, consumeParents);
      setResult(confirmed);
      await delay(reducedMotion ? 100 : 900);
      setPhase('fusion');
      await delay(reducedMotion ? 100 : 1900);
      setPhase('silhouette');
      await delay(reducedMotion ? 100 : 900);
      setPhase('reveal');
    } catch {
      setPhase('select');
    }
  };

  const reset = () => {
    setPhase('select');
    setParents([]);
    setCatalyst(undefined);
    setConsumeParents(false);
    setSequenceParents([]);
    setResult(undefined);
  };

  if (phase !== 'select') {
    return (
      <div className={`fusion-sequence fusion-sequence--${phase} ${result ? `rarity-fusion-${result.rarity.toLowerCase()}` : ''}`}>
        <div className="fusion-sequence__chamber"><span className="fusion-helix fusion-helix--a" /><span className="fusion-helix fusion-helix--b" /><span className="fusion-energy"><i /><i /><i /><i /></span>
          {sequenceParents.map((stone, index) => <div className={`fusion-parent fusion-parent--${index + 1}`} key={stone.id}><StoneVisual rarity={stone.rarity} element={stone.element} mutation={stone.mutation} size="lg" active /><span>{stone.nickname || stone.name}</span></div>)}
          {phase === 'silhouette' || phase === 'reveal' ? <div className={`fusion-child ${phase === 'silhouette' ? 'is-silhouette' : ''}`}>{result ? <StoneVisual rarity={result.rarity} element={result.element} mutation={result.mutation} variant={result.colorVariant} size="hero" active /> : null}</div> : null}
        </div>
        {phase === 'genes' ? <div className="fusion-sequence__copy"><span>GENE TRACE</span><h2>継承因子を解析中</h2><div className="gene-ticker">{sequenceParents.flatMap((stone) => stone.traits.slice(0, 2)).map((trait, index) => <i key={`${trait}-${index}`}>{trait}</i>)}</div></div> : null}
        {phase === 'fusion' ? <div className="fusion-sequence__copy"><span>RESONANCE CRITICAL</span><h2>共鳴核を融合しています</h2><div className="fusion-wave"><i /><i /><i /></div></div> : null}
        {phase === 'silhouette' ? <div className="fusion-sequence__copy"><span>NEW SIGNAL DETECTED</span><h2>未知の個体反応</h2><p>画面をタップして共鳴を解放</p></div> : null}
        {phase === 'reveal' && result ? <div className="fusion-result-copy"><span className={`rarity-label rarity-label--${result.rarity.toLowerCase()}`}>{result.rarity}</span>{result.mutation ? <strong><Sparkles /> MUTATION / {result.mutation}</strong> : null}<h2>{result.nickname || result.name}</h2><p>{result.name} · 第{result.generation}世代</p><div className="inherited-grid"><span><small>INHERITED TRAIT</small><b>{result.traits[0] || '共鳴適応'}</b></span><span><small>POTENTIAL</small><b>{result.potential}</b></span><span><small>BEST IV</small><b>{Math.max(...Object.values(result.ivs))}</b></span></div><button className="primary-action" type="button" onClick={reset}>ラボへ戻る<ChevronRight /></button></div> : null}
      </div>
    );
  }

  return (
    <div className="fusion-screen">
      <section className="fusion-lab panel">
        <div className="fusion-lab__header"><div><span className="status-kicker"><FlaskConical /> LABORATORY LEVEL {facilityLevel}</span><h2>系譜共鳴炉</h2><p>2体の遺伝因子を重ね、新しいStone Instanceを生成します。通常は親を保持し、所持枠が必要な時だけ明示的に継承消費できます。</p></div><div className="lab-stability"><span>STABILITY</span><b>98.7%</b><i><em /></i></div></div>
        <div className="fusion-slots">
          {[0, 1].map((index) => {
            const stone = selected[index];
            return <button type="button" className={`fusion-slot ${stone ? 'is-filled' : ''}`} key={index} onClick={() => stone && toggleParent(stone.id)}>{stone ? <><StoneVisual rarity={stone.rarity} element={stone.element} mutation={stone.mutation} size="lg" active /><span className={`rarity-label rarity-label--${stone.rarity.toLowerCase()}`}>{stone.rarity}</span><strong>{stone.nickname || stone.name}</strong><small>IV {stone.potential} · {stone.personality}</small><X className="fusion-slot__remove" /></> : <><span className="fusion-slot__empty"><Plus /></span><strong>PARENT {index + 1}</strong><small>個体を選択してください</small></>}</button>;
          })}
          <div className={`fusion-reactor ${selected.length === 2 ? 'is-ready' : ''}`}><span><Atom /></span><i /><em>GENE<br />RESONATOR</em></div>
        </div>
        <div className="fusion-analysis">
          <header><span><Dna /> 継承予測</span><small>{selected.length < 2 ? '親個体を2体選択すると解析します' : recipe ? `${recipe.type} / ${recipe.id}` : 'GENERAL FUSION'}</small></header>
          {probability.length ? <div className="fusion-predictions">{probability.map((item) => <div key={item.label}><span>{item.label}</span><b>{item.value}</b><i><em style={{ width: `${item.progress}%` }} /></i></div>)}</div> : <div className="analysis-empty"><Dna /><span>遺伝子データ待機中</span></div>}
        </div>
      </section>

      <aside className="fusion-sidebar">
        <section className="panel catalyst-panel"><header className="section-heading"><div><span className="eyebrow">CATALYST</span><h3>融合触媒</h3></div><span>{catalysts}</span></header><button type="button" disabled={!mutagenUsable} className={activeCatalyst ? 'is-selected' : ''} onClick={() => setCatalyst(activeCatalyst ? undefined : mutagen.id)}><span className={`catalyst-gem ${!mutagenUsable ? 'catalyst-gem--locked' : ''}`}><Gem /></span><span><strong>{mutagen.name}</strong><small>{!mutagenUnlocked ? `LAB LV.${mutagen.requiredLabLevel} が必要（所持 ${catalysts}）` : catalysts < 1 ? `所持 0 / Mutation ×${mutagen.mutationMultiplier ?? 1}・Shiny ×${mutagen.shinyMultiplier ?? 1}` : `Mutation ×${mutagen.mutationMultiplier ?? 1}・Shiny ×${mutagen.shinyMultiplier ?? 1} / 所持 ${catalysts}`}</small></span>{activeCatalyst ? <ShieldCheck /> : mutagenUsable ? <Plus /> : <Lock />}</button></section>
        <section className="panel selected-genes"><header className="section-heading"><div><span className="eyebrow">LOCKED GENES</span><h3>継承候補</h3></div><Zap /></header>{selected.length ? selected.flatMap((stone) => stone.traits.slice(0, 2)).map((trait, index) => <div key={`${trait}-${index}`}><i>{index + 1}</i><span><strong>{trait}</strong><small>{selected[index % selected.length]?.nickname || selected[index % selected.length]?.name}</small></span></div>) : <p>親個体のTraitとSkillがここに表示されます。</p>}</section>
        <button className={`fusion-consume-toggle ${consumeParents ? 'is-selected' : ''}`} type="button" role="checkbox" aria-checked={consumeParents} disabled={consumptionBlocked} onClick={() => setConsumeParents((current) => !current)}><ShieldCheck /><span><strong>親個体を継承消費</strong><small>{consumptionBlocked ? 'お気に入り／Locked個体は消費できません' : consumeParents ? '配合成功時に選択した2体を消費します' : 'OFF：親個体を保持します'}</small></span><i>{consumeParents ? <Sparkles /> : null}</i></button>
        <button className="fusion-submit" type="button" disabled={parents.length < 2 || (consumeParents && consumptionBlocked)} onClick={beginFusion}><span><small>{recipe ? `${recipe.type} RECIPE COST` : 'GENERAL FUSION COST'}</small><b>{fusionCost.join(' + ')}</b></span><strong><Sparkles />配合を開始</strong></button>
      </aside>

      <section className="fusion-roster panel">
        <header className="section-heading"><div><span className="eyebrow">PARENT ARCHIVE</span><h3>親個体を選択</h3></div><div className="element-tabs"><button type="button" className={filter === 'ALL' ? 'is-active' : ''} onClick={() => setFilter('ALL')}>ALL</button>{elements.map((element) => <button type="button" className={filter === element ? 'is-active' : ''} key={element} onClick={() => setFilter(element)}>{element}</button>)}</div></header>
        <div className="fusion-roster__grid">{filtered.map((stone) => <StoneCard key={stone.id} stone={stone} compact selected={parents.includes(stone.id)} onClick={() => toggleParent(stone.id)} />)}</div>
      </section>
    </div>
  );
}
