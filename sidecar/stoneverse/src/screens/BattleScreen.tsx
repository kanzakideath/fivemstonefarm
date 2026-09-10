import { Activity, ArrowRight, Bot, Crosshair, Gauge, HeartPulse, Play, RotateCcw, Shield, Sparkles, Swords, Target, Trophy, Users, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { StoneCard } from '../components/StoneCard';
import { StoneVisual } from '../components/StoneVisual';
import type { UiBattleState, UiStone } from '../components/uiTypes';
import { DUNGEONS, SPECIES_BY_ID } from '../data';
import { formatDrawProgress, formatReward } from './definitionPresentation';

interface BattleScreenProps {
  stones: UiStone[];
  partyIds: string[];
  battle: UiBattleState;
  reducedMotion: boolean;
  onSetParty: (ids: string[]) => void;
  onStartBattle: () => Promise<UiBattleState>;
  onAdvanceBattle: () => unknown;
  onCommand: (skillId: string, targetIds?: readonly string[]) => unknown;
  onAutoChange: (auto: boolean) => unknown;
  onSpeedChange: (speed: 1 | 2 | 4) => unknown;
  onAbandon: () => unknown;
}

const dungeon = DUNGEONS[0];
const stage = dungeon.stages[0];
const enemyLevels = stage.enemies.map((enemy) => enemy.level);
const enemyLevelLabel = `LV.${Math.min(...enemyLevels)}–${Math.max(...enemyLevels)}`;
const enemyNames = stage.enemies.map((enemy) => `${SPECIES_BY_ID[enemy.speciesId]?.name ?? enemy.speciesId} LV.${enemy.level}`);
const stageRewardLabel = formatReward(stage.reward).join(' / ');
const firstClearRewardLabel = formatReward(stage.firstClearReward).join(' / ');
const drawProgressLabel = formatDrawProgress(stage.reward);

export function BattleScreen({ stones, partyIds, battle, reducedMotion, onSetParty, onStartBattle, onAdvanceBattle, onCommand, onAutoChange, onSpeedChange, onAbandon }: BattleScreenProps) {
  const [mode, setMode] = useState<'formation' | 'battle'>(battle.phase === 'running' ? 'battle' : 'formation');
  const [starting, setStarting] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState(0);
  const [impact, setImpact] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>();
  const party = partyIds.map((id) => stones.find((stone) => stone.id === id)).filter((stone): stone is UiStone => Boolean(stone));
  const reserve = stones.filter((stone) => !partyIds.includes(stone.id));
  const teamPower = party.reduce((sum, stone) => sum + stone.combatPower, 0);
  const synergy = useMemo(() => new Set(party.map((stone) => stone.element)).size >= 3 ? '多属性共鳴' : party.length === 3 ? '同調共鳴' : '未完成', [party]);
  const speed = battle.speed ?? 1;

  useEffect(() => {
    if (mode !== 'battle' || visibleLogs >= battle.log.length) return;
    const timer = window.setTimeout(() => {
      setVisibleLogs((count) => count + 1);
      setImpact(true);
      window.setTimeout(() => setImpact(false), reducedMotion ? 0 : 240);
    }, reducedMotion ? 20 : 620 / speed);
    return () => window.clearTimeout(timer);
  }, [mode, visibleLogs, battle.log.length, reducedMotion, speed]);

  useEffect(() => {
    if (mode !== 'battle' || battle.phase !== 'running' || battle.manualMode !== false || visibleLogs < battle.log.length) return;
    const timer = window.setTimeout(() => { onAdvanceBattle(); }, reducedMotion ? 25 : 780 / speed);
    return () => window.clearTimeout(timer);
  }, [battle.log.length, battle.manualMode, battle.phase, battle.turn, mode, onAdvanceBattle, reducedMotion, speed, visibleLogs]);

  useEffect(() => {
    if (selectedTargetId && !battle.enemies.some((enemy) => enemy.unitId === selectedTargetId && enemy.hp > 0)) setSelectedTargetId(undefined);
  }, [battle.enemies, selectedTargetId]);

  const toggleParty = (id: string) => {
    if (partyIds.includes(id)) {
      if (partyIds.length > 1) onSetParty(partyIds.filter((item) => item !== id));
    }
    else if (partyIds.length < 3) onSetParty([...partyIds, id]);
    else onSetParty([partyIds[1], partyIds[2], id]);
  };

  const start = async () => {
    if (party.length !== 3 || starting) return;
    setStarting(true);
    setVisibleLogs(0);
    try {
      await onStartBattle();
      setMode('battle');
    } finally {
      setStarting(false);
    }
  };

  if (mode === 'battle') {
    const replayFrame = battle.frames?.[Math.min(visibleLogs, Math.max(0, battle.frames.length - 1))];
    const allies = replayFrame?.allies.length ? replayFrame.allies : battle.allies.length ? battle.allies : party.map((stone) => ({ unitId: stone.id, stone, hp: stone.stats.hp, maxHp: stone.stats.hp, ultimate: 0, status: [] }));
    const enemies = replayFrame?.enemies.length ? replayFrame.enemies : battle.enemies;
    const activeId = replayFrame?.activeId ?? battle.activeId;
    const targetId = replayFrame?.targetId ?? battle.targetId;
    const lastDamage = replayFrame?.lastDamage ?? battle.lastDamage;
    const logsDone = visibleLogs >= battle.log.length;
    return (
      <div className={`battle-scene ${impact ? 'is-impact' : ''} battle-scene--${battle.phase}`}>
        <div className="battle-backdrop"><span className="battle-moon" /><i /><i /><i /></div>
        <header className="battle-hud">
          <div><span>{dungeon.name.toUpperCase()} / {stage.name.toUpperCase()}</span><strong>WAVE 1 <em>/ 1</em></strong></div>
          <span className="turn-counter"><small>TURN</small><b>{Math.max(1, replayFrame?.turn ?? battle.turn)}</b></span>
          <div className="battle-speed" aria-label="戦闘速度">{([1, 2, 4] as const).map((value) => <button type="button" aria-pressed={speed === value} className={speed === value ? 'is-active' : ''} key={value} onClick={() => onSpeedChange(value)}>{value}x</button>)}</div>
          <button type="button" onClick={() => { if (battle.phase === 'running') onAbandon(); setMode('formation'); }}><RotateCcw />撤退</button>
        </header>
        <section className="battlefield">
          <div className="battle-team battle-team--enemy">
            {enemies.map((fighter, index) => <BattleUnit key={fighter.unitId ?? fighter.stone.id} fighter={fighter} side="enemy" index={index} active={activeId === (fighter.unitId ?? fighter.stone.id)} target={targetId === (fighter.unitId ?? fighter.stone.id)} damage={impact && targetId === (fighter.unitId ?? fighter.stone.id) ? lastDamage : undefined} />)}
          </div>
          <div className="battle-center"><span>RESONANCE<br />COMBAT</span><Swords /></div>
          <div className="battle-team battle-team--ally">
            {allies.map((fighter, index) => <BattleUnit key={fighter.unitId ?? fighter.stone.id} fighter={fighter} side="ally" index={index} active={activeId === (fighter.unitId ?? fighter.stone.id)} target={targetId === (fighter.unitId ?? fighter.stone.id)} damage={impact && targetId === (fighter.unitId ?? fighter.stone.id) ? lastDamage : undefined} />)}
          </div>
        </section>
        <section className="battle-command panel">
          <div className="battle-log"><header><Activity /> COMBAT LOG</header>{battle.log.slice(0, visibleLogs).slice(-4).map((line, index) => <p className={index === Math.min(3, visibleLogs - 1) ? 'is-new' : ''} key={`${line}-${index}`}><span>{String(Math.max(1, battle.turn - (visibleLogs - index - 1))).padStart(2, '0')}</span>{line}</p>)}</div>
          <div className="battle-tactics">
            <div className="turn-order" aria-label="速度順"><small>SPEED ORDER</small>{(battle.turnOrder ?? []).map((entry, index) => <span className={`${entry.side === 'PLAYER' ? 'is-player' : 'is-enemy'} ${entry.id === battle.commandActorId ? 'is-command' : ''}`} key={entry.id}><b>{index + 1}</b>{entry.name}<em>SPD {Math.round(entry.speed)}</em></span>)}</div>
            <button type="button" role="switch" aria-checked={battle.manualMode === false} className={`manual-switch ${battle.manualMode === false ? 'is-on' : ''}`} disabled={battle.phase !== 'running'} onClick={() => onAutoChange(battle.manualMode !== false)}><Bot /><span>{battle.manualMode === false ? 'AUTO' : 'MANUAL'}</span><i /></button>
          </div>
          <div className="battle-targets" aria-label="攻撃対象"><small>TARGET</small>{battle.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => <button type="button" aria-pressed={selectedTargetId === enemy.unitId} className={selectedTargetId === enemy.unitId ? 'is-active' : ''} key={enemy.unitId} onClick={() => setSelectedTargetId(enemy.unitId)}><Target />{enemy.stone.nickname || enemy.stone.name}</button>)}</div>
          <div className="skill-command">{(battle.commands ?? []).map((command, index) => {
            const Icon = [Crosshair, Shield, Sparkles][index % 3] ?? Crosshair;
            const blocked = battle.phase !== 'running' || battle.manualMode === false || command.disabled || visibleLogs < battle.log.length;
            const targetIds = (command.target === 'ENEMY' || command.target === 'BOSS') && selectedTargetId ? [selectedTargetId] : undefined;
            return <button type="button" className={command.ultimateCost > 0 ? 'ultimate-command' : ''} disabled={blocked} key={command.id} onClick={() => onCommand(command.id, targetIds)}><span><Icon /><small>SKILL {String(index + 1).padStart(2, '0')}</small></span><strong>{command.name}</strong><em>{command.cooldown > 0 ? `COOLDOWN ${command.cooldown}` : command.ultimateCost > 0 ? `ULT ${command.ultimateCost}` : command.target}</em></button>;
          })}</div>
        </section>
        {logsDone && (battle.phase === 'victory' || battle.phase === 'defeat' || battle.phase === 'draw') ? <div className={`battle-result battle-result--${battle.phase}`}><div>{battle.phase === 'victory' ? <Trophy /> : <Shield />}<span>{battle.phase === 'victory' ? 'DUNGEON COMPLETE' : battle.phase === 'draw' ? 'RESONANCE STALEMATE' : 'RESONANCE LOST'}</span><h2>{battle.phase === 'victory' ? 'VICTORY' : battle.phase === 'draw' ? 'DRAW' : 'DEFEAT'}</h2><p>{battle.phase === 'victory' ? stageRewardLabel : battle.phase === 'draw' ? drawProgressLabel : '編成と属性相性を見直してください'}</p><button className="primary-action" type="button" onClick={() => setMode('formation')}>編成画面へ<ArrowRight /></button></div></div> : null}
      </div>
    );
  }

  return (
    <div className="party-screen">
      <section className="party-overview panel">
        <div><span className="status-kicker"><Users /> PARTY FORMATION 01</span><h2>第零共鳴隊</h2><p>前衛・守護・支援の3体を選択。速度と属性相性が行動順を左右します。</p></div>
        <div className="party-power"><small>COMBAT POWER</small><strong>{teamPower.toLocaleString()}</strong><span><Zap /> {synergy}</span></div>
      </section>

      <section className="formation-field panel">
        <div className="formation-grid"><i /><i /><i /><i /><i /></div>
        {([0, 1, 2] as const).map((index) => {
          const stone = party[index];
          const roles = ['VANGUARD', 'GUARDIAN', 'RESONATOR'];
          const RoleIcon = index === 0 ? Swords : index === 1 ? Shield : HeartPulse;
          return <button type="button" key={index} className={`party-slot party-slot--${index + 1} ${stone ? 'is-filled' : ''}`} onClick={() => stone && toggleParty(stone.id)}>{stone ? <><span className="party-slot__role"><RoleIcon />{roles[index]}</span><StoneVisual rarity={stone.rarity} element={stone.element} mutation={stone.mutation} size="lg" active /><strong>{stone.nickname || stone.name}</strong><small>LV.{stone.level} · CP {stone.combatPower.toLocaleString()}</small><div className="party-slot__stats"><span>HP {stone.stats.hp}</span><span>SPD {stone.stats.speed}</span></div></> : <><span className="party-slot__empty"><Target /></span><strong>{roles[index]}</strong><small>個体を選択</small></>}</button>;
        })}
        <div className="formation-synergy"><Gauge /><span><small>TEAM RESONANCE</small><b>{party.length === 3 ? 'SYNCED' : `${party.length} / 3`}</b></span></div>
      </section>

      <section className="mission-select panel">
        <header className="section-heading"><div><span className="eyebrow">ACTIVE DUNGEON</span><h3>{dungeon.name} / {stage.name}</h3></div><span className="difficulty-tag">{enemyLevelLabel}</span></header>
        <div className="mission-boss"><div className="boss-sigil"><Users /></div><div><small>ENEMY SIGNAL ×{stage.enemies.length}</small><strong>{enemyNames.join(' / ')}</strong><span>{dungeon.element} AREA / STAMINA {stage.staminaCost}</span></div><div className="boss-power"><small>ENEMY LEVEL</small><b>{enemyLevelLabel}</b></div></div>
        <div className="compatibility-row"><span><Shield />クリア報酬<strong>{stageRewardLabel}</strong></span><span><Trophy />初回追加<strong>{firstClearRewardLabel || 'なし'}</strong></span></div>
        <button className="battle-start" type="button" disabled={party.length !== 3 || starting} onClick={start}><span><Play fill="currentColor" /></span><div><small>{starting ? 'SIMULATING' : 'READY'}</small><strong>{starting ? '戦闘を準備中' : '遠征戦を開始'}</strong></div><ArrowRight /></button>
      </section>

      <section className="party-roster panel">
        <header className="section-heading"><div><span className="eyebrow">STONE RESERVE</span><h3>待機個体</h3></div><span>{reserve.length} AVAILABLE</span></header>
        <div className="party-roster__grid">{reserve.map((stone) => <StoneCard stone={stone} compact key={stone.id} onClick={() => toggleParty(stone.id)} />)}</div>
      </section>
    </div>
  );
}

function BattleUnit({ fighter, side, index, active, target, damage }: { fighter: UiBattleState['allies'][number]; side: 'ally' | 'enemy'; index: number; active: boolean; target: boolean; damage?: number }) {
  const hpRatio = fighter.maxHp ? fighter.hp / fighter.maxHp : 0;
  return (
    <article className={`battle-unit battle-unit--${side} battle-unit--${index + 1} ${active ? 'is-active' : ''} ${target ? 'is-target' : ''} ${fighter.hp <= 0 ? 'is-defeated' : ''}`}>
      <div className="battle-unit__plate"><span><strong>{fighter.stone.nickname || fighter.stone.name}</strong><small>LV.{fighter.stone.level}</small></span><ProgressBar value={fighter.hp} max={fighter.maxHp} tone="health" compact /><em>{Math.max(0, fighter.hp).toLocaleString()} / {fighter.maxHp.toLocaleString()}</em></div>
      <StoneVisual rarity={fighter.stone.rarity} element={fighter.stone.element} mutation={fighter.stone.mutation} size="lg" active={active} />
      {fighter.status.length ? <div className="battle-unit__status">{fighter.status.map((status) => <i key={status}>{status.slice(0, 2)}</i>)}</div> : null}
      {target && damage ? <strong className="damage-number">-{damage.toLocaleString()}</strong> : null}
      {active ? <span className="active-marker"><Zap /> ACTIVE</span> : null}
    </article>
  );
}
