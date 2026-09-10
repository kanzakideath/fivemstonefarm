import {
  Activity,
  Bot,
  Box,
  Check,
  ChevronDown,
  CircleStop,
  FastForward,
  Gauge,
  Hammer,
  HeartPulse,
  Infinity as InfinityIcon,
  ListOrdered,
  Package,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EndlessAutoSalvageView, EndlessMineViewModel, EndlessSpeed, EndlessStrategy } from '../components/adventureTypes';
import type { UiRarity } from '../components/uiTypes';
import { ProgressBar } from '../components/ProgressBar';

export interface EndlessMineScreenProps {
  model: EndlessMineViewModel;
  reducedMotion: boolean;
  onStart: () => void | Promise<void>;
  onPauseToggle: () => void;
  onRetreat: () => void;
  onStrategyChange: (strategy: EndlessStrategy) => void;
  onSpeedChange: (speed: EndlessSpeed) => void;
  onManualModeChange: (enabled: boolean) => void;
  onCommand: (commandId: string) => void;
  /** @deprecated Retained for hosts compiled against the initial vertical slice. */
  onEquipmentAction: (equipmentId: string) => void;
  onEquipEquipment?: (equipmentId: string, stoneId: string) => void;
  onUnequipEquipment?: (equipmentId: string, stoneId: string) => void;
  onSalvageEquipment?: (equipmentId: string) => void;
  onEquipmentLockChange?: (equipmentId: string, locked: boolean) => void;
  onAutoSalvageChange: (settings: EndlessAutoSalvageView) => void;
}

const strategies: Array<{ id: EndlessStrategy; label: string; description: string; icon: typeof Shield }> = [
  { id: 'BALANCED', label: 'BALANCED', description: '攻守の判定を自動最適化', icon: Gauge },
  { id: 'AGGRESSIVE', label: 'AGGRESSIVE', description: '短期戦とUltimateを優先', icon: Swords },
  { id: 'DEFENSIVE', label: 'DEFENSIVE', description: 'シールドと回復行動を優先', icon: Shield },
  { id: 'BOSS_FOCUS', label: 'BOSS FOCUS', description: 'Boss・Break windowへ火力を集中', icon: Target },
  { id: 'RESOURCE_SAVE', label: 'RESOURCE SAVE', description: 'Ultimateと長Cooldownを温存', icon: HeartPulse },
];

const rarityThresholds: UiRarity[] = ['NORMAL', 'RARE', 'SR', 'SSR', 'UR'];

export function EndlessMineScreen({
  model,
  reducedMotion,
  onStart,
  onPauseToggle,
  onRetreat,
  onStrategyChange,
  onSpeedChange,
  onManualModeChange,
  onCommand,
  onEquipmentAction,
  onEquipEquipment,
  onUnequipEquipment,
  onSalvageEquipment,
  onEquipmentLockChange,
  onAutoSalvageChange,
}: EndlessMineScreenProps) {
  const isRunning = model.status === 'RUNNING';
  const isPaused = model.status === 'PAUSED';
  const canResumeCheckpoint = model.status === 'ENDED' && model.canResumeFromCheckpoint;
  const threatRatio = model.partyPower > 0 ? model.enemyPower / model.partyPower : 1;
  const EncounterIcon = model.encounter?.type === 'REST' ? HeartPulse : model.encounter?.type === 'MINING' ? Hammer : model.encounter?.type === 'TREASURE' ? Package : model.encounter?.type === 'RANDOM_EVENT' ? Zap : Swords;
  const [equipmentTargetId, setEquipmentTargetId] = useState(model.equipmentTargets?.[0]?.id ?? '');

  useEffect(() => {
    const targets = model.equipmentTargets ?? [];
    if (targets.length === 0) {
      if (equipmentTargetId) setEquipmentTargetId('');
      return;
    }
    if (!targets.some((target) => target.id === equipmentTargetId)) setEquipmentTargetId(targets[0]?.id ?? '');
  }, [equipmentTargetId, model.equipmentTargets]);

  useEffect(() => {
    if (!model.manualMode || !isRunning) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (target instanceof HTMLElement && (target.matches('button,input,select,textarea') || target.isContentEditable))) return;
      const pressed = event.code === 'Space' ? 'space' : event.key.toLowerCase();
      const command = model.commands.find((item) => item.keyHint.toLowerCase() === pressed);
      if (!command || command.disabled || (command.cooldown ?? 0) > 0) return;
      event.preventDefault();
      onCommand(command.id);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isRunning, model.commands, model.manualMode, onCommand]);

  const patchSalvage = (patch: Partial<EndlessAutoSalvageView>) => onAutoSalvageChange({ ...model.autoSalvage, ...patch });

  return (
    <div className={`endless-screen endless-screen--${model.status.toLowerCase()} ${reducedMotion ? 'is-reduced-motion' : ''}`} style={{ '--endless-cadence': `${4 / model.speed}s` } as React.CSSProperties}>
      <section className="endless-hero panel">
        <div className="endless-hero__depth" aria-hidden="true"><i /><i /><i /></div>
        <div className="endless-hero__heading"><span className="status-kicker"><InfinityIcon /> ENDLESS MINE / LIVE DESCENT</span><h2>THE BOTTOMLESS VEIN</h2><p>階層ごとに変質する鉱脈。帰還タイミングも戦術の一部です。</p></div>
        <div className="endless-floor-dial" style={{ '--floor-progress': `${Math.max(0, Math.min(100, model.floorProgress))}%` } as React.CSSProperties}><span><small>CURRENT FLOOR</small><strong>{String(model.floor).padStart(3, '0')}</strong><em>BEST {model.bestFloor}</em></span></div>
        <div className="endless-hero__telemetry"><span><small>WIN STREAK</small><b>{model.winStreak}</b></span><span><small>PARTY CP</small><b>{model.partyPower.toLocaleString()}</b></span><span className={threatRatio > 1.1 ? 'is-danger' : ''}><small>ENEMY CP</small><b>{model.enemyPower.toLocaleString()}</b></span></div>
      </section>

      <section className="endless-modifiers" aria-label="現在の階層モディファイア">
        {model.encounter ? <article className={`panel modifier-card modifier-card--${model.encounter.type === 'REST' ? 'boon' : model.encounter.type === 'BOSS' || model.encounter.type === 'RANDOM_EVENT' ? 'anomaly' : model.encounter.type === 'ELITE' ? 'hazard' : 'boon'}`}><span><EncounterIcon /></span><div><small>FLOOR ENCOUNTER / INTEGRITY {model.resonanceIntegrity ?? 100}%</small><strong>{model.encounter.label}</strong><p>{model.encounter.description}</p></div></article> : null}
        {model.modifiers.map((modifier) => <article className={`panel modifier-card modifier-card--${modifier.tone.toLowerCase()}`} key={modifier.id}><span>{modifier.tone === 'BOON' ? <Sparkles /> : modifier.tone === 'ANOMALY' ? <Zap /> : <TriangleAlert />}</span><div><small>{modifier.tone}{modifier.stacks ? ` / STACK ${modifier.stacks}` : ''}</small><strong>{modifier.name}</strong><p>{modifier.description}</p></div></article>)}
      </section>

      <div className="endless-layout">
        <main className="endless-combat-stack">
          <section className="panel endless-turn-order">
            <header className="section-heading"><div><span className="eyebrow">INITIATIVE MATRIX</span><h3><ListOrdered /> 行動順</h3></div><span>FLOOR {model.floor}</span></header>
            <div className="turn-order-track">
              {model.turnOrder.map((unit, index) => <article key={unit.id} className={`${unit.side === 'ENEMY' ? 'is-enemy' : 'is-ally'} ${unit.active ? 'is-active' : ''} ${unit.defeated ? 'is-defeated' : ''}`}><span className="turn-position">{String(index + 1).padStart(2, '0')}</span><i className="turn-signal">{unit.side === 'ALLY' ? <Shield /> : <Target />}</i><div><small>{unit.element} / SPD {unit.initiative}</small><strong>{unit.name}</strong></div>{unit.active ? <em>ACTIVE</em> : null}</article>)}
            </div>
          </section>

          <section className="panel endless-command-deck">
            <header className="section-heading"><div><span className="eyebrow">TACTICAL OVERRIDE</span><h3><Target /> マニュアルコマンド</h3></div><button type="button" role="switch" aria-checked={model.manualMode} className={`manual-switch ${model.manualMode ? 'is-on' : ''}`} onClick={() => onManualModeChange(!model.manualMode)}><Bot /><span>{model.manualMode ? 'MANUAL' : 'AI CONTROL'}</span><i /></button></header>
            <div className="command-grid">
              {model.commands.map((command) => {
                const unavailable = !model.manualMode || !isRunning || command.disabled || (command.cooldown ?? 0) > 0;
                return <button type="button" key={command.id} disabled={unavailable} aria-keyshortcuts={command.keyHint === 'space' ? 'Space' : command.keyHint} onClick={() => onCommand(command.id)}><kbd>{command.keyHint === 'space' ? 'SPACE' : command.keyHint}</kbd><span><small>{command.costLabel ?? 'NO COST'}</small><strong>{command.label}</strong><em>{command.cooldown ? `COOLDOWN ${command.cooldown}` : command.description}</em></span>{command.cooldown ? <RotateCcw /> : <Zap />}</button>;
              })}
            </div>
            {!model.manualMode ? <p className="command-hint"><Bot /> AI戦術が行動を管理中。マニュアルに切り替えると数字キーとSPACEが有効になります。</p> : <p className="command-hint is-manual"><Activity /> KEYBOARD LINK ACTIVE / 数字キー・SPACEで即時入力</p>}
          </section>

          <section className="panel endless-log">
            <header><span><Activity /> DESCENT LOG</span><i /> LIVE</header>
            <div>{model.battleLog.slice(-6).map((line, index) => <p key={`${line}-${index}`}><time>{String(Math.max(1, model.floor - model.battleLog.length + index + 1)).padStart(3, '0')}</time><span>{line}</span></p>)}</div>
          </section>
        </main>

        <aside className="endless-console">
          <section className="panel endless-ai">
            <header className="section-heading"><div><span className="eyebrow">AUTONOMOUS LOGIC</span><h3>AI戦術</h3></div><Bot /></header>
            <div className="strategy-stack">{strategies.map((strategy) => { const Icon = strategy.icon; return <button type="button" key={strategy.id} aria-pressed={model.strategy === strategy.id} className={model.strategy === strategy.id ? 'is-selected' : ''} onClick={() => onStrategyChange(strategy.id)}><Icon /><span><strong>{strategy.label}</strong><small>{strategy.description}</small></span></button>; })}</div>
            <div className="battle-speed"><span><FastForward /> BATTLE SPEED</span><div>{([1, 2, 4] as EndlessSpeed[]).map((speed) => <button type="button" key={speed} aria-pressed={model.speed === speed} className={model.speed === speed ? 'is-selected' : ''} onClick={() => onSpeedChange(speed)}>×{speed}</button>)}</div></div>
          </section>

          <section className="panel endless-equipment">
            <header className="section-heading"><div><span className="eyebrow">FIELD LOADOUT</span><h3><Hammer /> 装備管理</h3></div><span>{model.equipmentInventoryCount ?? model.equipment.length} / {model.equipmentCapacity ?? model.equipment.length}</span></header>
            <div className="endless-equipment__summary">
              <label htmlFor="endless-equipment-target"><span>装備先Stone</span><select id="endless-equipment-target" value={equipmentTargetId} disabled={(model.equipmentTargets?.length ?? 0) === 0} onChange={(event) => setEquipmentTargetId(event.target.value)}>{(model.equipmentTargets ?? []).map((target) => <option key={target.id} value={target.id}>{target.name} / Lv.{target.level}</option>)}</select></label>
              <span><Sparkles /> 分解素材 <strong>{(model.salvageMaterials ?? 0).toLocaleString()}</strong></span>
            </div>
            <div className="endless-equipment__inventory" data-testid="endless-equipment-inventory">
              {model.equipment.length === 0 ? <p className="empty-state">保管中・装着中の装備はありません。</p> : model.equipment.map((item) => (
                <article key={item.id} className={`endless-equipment__item rarity-border--${item.rarity.toLowerCase()}`}>
                  <span className="endless-equipment__icon"><Box /></span>
                  <div className="endless-equipment__copy"><small>{item.slot} / +{item.level}{item.score ? ` / SCORE ${item.score}` : ''}</small><strong>{item.name}</strong><em>{item.setName ? `${item.setName} SET / ` : ''}{item.effect}</em></div>
                  <span className="endless-equipment__state">{item.equippedBy ? `装着: ${item.equippedBy}` : 'INVENTORY'}</span>
                  <div className="endless-equipment__actions">
                    {item.equippedById
                      ? <button type="button" onClick={() => onUnequipEquipment?.(item.id, item.equippedById!)}>解除</button>
                      : <button type="button" disabled={!equipmentTargetId} onClick={() => onEquipEquipment ? onEquipEquipment(item.id, equipmentTargetId) : onEquipmentAction(item.id)}>装着</button>}
                    <button type="button" aria-label={`${item.name}を${item.locked ? 'ロック解除' : 'ロック'}`} aria-pressed={Boolean(item.locked)} onClick={() => onEquipmentLockChange?.(item.id, !item.locked)}>{item.locked ? <Shield /> : 'LOCK'}</button>
                    {!item.equippedById ? <button type="button" aria-label={`${item.name}を分解`} disabled={item.locked || !onSalvageEquipment} onClick={() => onSalvageEquipment?.(item.id)}><Trash2 /> 分解</button> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel endless-salvage">
            <header className="section-heading"><div><span className="eyebrow">LOOT FILTER</span><h3><Trash2 /> 自動分解</h3></div><button type="button" role="switch" aria-label="自動分解" aria-checked={model.autoSalvage.enabled} className={model.autoSalvage.enabled ? 'is-on' : ''} onClick={() => patchSalvage({ enabled: !model.autoSalvage.enabled })}><i /></button></header>
            <label><span>分解上限レアリティ</span><div><select value={model.autoSalvage.threshold} disabled={!model.autoSalvage.enabled} onChange={(event) => patchSalvage({ threshold: event.target.value as UiRarity })}>{rarityThresholds.map((rarity) => <option key={rarity}>{rarity}</option>)}</select><ChevronDown /></div></label>
            <button className="salvage-protect" type="button" role="checkbox" aria-checked={model.autoSalvage.protectFavorites} onClick={() => patchSalvage({ protectFavorites: !model.autoSalvage.protectFavorites })}><Shield /> <span><strong>セット装備を保護</strong><small>Set装備とLocked装備は分解対象外</small></span><i>{model.autoSalvage.protectFavorites ? <Check /> : null}</i></button>
            <p><Package /> 現在の分解待機: <strong>{model.autoSalvage.queuedCount}</strong></p>
          </section>

          <section className="panel endless-reward-preview">
            <header><span>FLOOR REWARD PREVIEW</span><Sparkles /></header>{model.rewardPreview.map((reward) => <div key={reward.id}><Package /><span><small>{reward.kind}</small><strong>{reward.label}</strong></span><b>{reward.amount ? `×${reward.amount.toLocaleString()}` : 'PENDING'}</b></div>)}
          </section>
        </aside>
      </div>

      <footer className="endless-controls" aria-label="無限坑道操作">
        <span><CircleStop /><small>STATUS</small><strong>{model.status}</strong></span>
        {model.status === 'READY' || (model.status === 'ENDED' && !canResumeCheckpoint)
          ? <button className="primary-action" type="button" onClick={onStart}><Play fill="currentColor" />潜行を開始</button>
          : canResumeCheckpoint
            ? <button className="primary-action" type="button" onClick={onPauseToggle}><RotateCcw />Checkpointから再開</button>
            : <button className="secondary-action" type="button" onClick={onPauseToggle}>{isPaused ? <Play /> : <Pause />}{isPaused ? '再開' : '一時停止'}</button>}
        {(isRunning || isPaused || canResumeCheckpoint) ? <button className="endless-retreat" type="button" onClick={onRetreat}><RotateCcw />{canResumeCheckpoint ? '報酬を確定して終了' : '報酬を確定して帰還'}</button> : null}
      </footer>
    </div>
  );
}
