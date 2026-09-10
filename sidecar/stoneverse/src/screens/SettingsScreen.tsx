import { Accessibility, Activity, Bug, ChevronRight, Database, Eye, Gauge, MonitorCog, Music, RotateCcw, Save, SlidersHorizontal, Sparkles, Volume2, VolumeX, Wifi, Zap } from 'lucide-react';
import { useState } from 'react';
import type { UiSettings } from '../components/uiTypes';

interface SettingsScreenProps {
  settings: UiSettings;
  online: boolean;
  persistenceAvailable: boolean;
  queueCount: number;
  saveStatus: string;
  onChange: (patch: Partial<UiSettings>) => void;
  onSave: () => void;
  onLoad: () => void;
  onDebugAction: (action: string) => void;
}

export function SettingsScreen({ settings, online, persistenceAvailable, queueCount, saveStatus, onChange, onSave, onLoad, onDebugAction }: SettingsScreenProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  return (
    <div className="settings-screen">
      <section className="settings-column">
        <article className="panel settings-panel"><header className="section-heading"><div><span className="eyebrow">SOUND SYSTEM</span><h3>オーディオ</h3></div>{settings.muted ? <VolumeX /> : <Music />}</header>
          <SettingToggle label="すべての音をミュート" detail="BGM・効果音・環境音を停止" value={settings.muted} onChange={(value) => onChange({ muted: value })} />
          <RangeSetting label="マスター音量" value={settings.masterVolume} onChange={(value) => onChange({ masterVolume: value })} icon={<Volume2 />} />
          <RangeSetting label="BGM" value={settings.musicVolume} onChange={(value) => onChange({ musicVolume: value })} icon={<Music />} />
          <RangeSetting label="効果音" value={settings.effectsVolume} onChange={(value) => onChange({ effectsVolume: value })} icon={<Zap />} />
        </article>

        <article className="panel settings-panel"><header className="section-heading"><div><span className="eyebrow">ACCESSIBILITY</span><h3>アクセシビリティ</h3></div><Accessibility /></header>
          <SettingToggle label="モーションを軽減" detail="画面揺れ・粒子・長い演出を短縮" value={settings.reducedMotion} onChange={(value) => onChange({ reducedMotion: value })} />
          <SettingToggle label="ハイコントラスト" detail="重要な輪郭と文字の視認性を強化" value={settings.highContrast} onChange={(value) => onChange({ highContrast: value })} />
          <div className="setting-row"><div><Eye /><span><strong>テキストサイズ</strong><small>インターフェースの文字倍率</small></span></div><div className="segmented-control">{[0.9, 1, 1.1, 1.2].map((value) => <button type="button" key={value} className={settings.textScale === value ? 'is-active' : ''} onClick={() => onChange({ textScale: value })}>{Math.round(value * 100)}%</button>)}</div></div>
        </article>
      </section>

      <section className="settings-column">
        <article className="panel settings-panel"><header className="section-heading"><div><span className="eyebrow">RENDERING</span><h3>演出品質</h3></div><MonitorCog /></header><div className="quality-options">{(['LOW', 'MEDIUM', 'HIGH'] as const).map((quality) => <button type="button" key={quality} className={settings.effectQuality === quality ? 'is-active' : ''} onClick={() => onChange({ effectQuality: quality })}><span>{quality === 'LOW' ? <Gauge /> : quality === 'MEDIUM' ? <SlidersHorizontal /> : <Sparkles />}</span><strong>{quality}</strong><small>{quality === 'LOW' ? '省電力' : quality === 'MEDIUM' ? 'バランス' : '最高品質'}</small></button>)}</div><p className="settings-note">端末性能に応じてパーティクル数、光源、ブラー品質を調整します。</p></article>

        <article className="panel settings-panel save-panel"><header className="section-heading"><div><span className="eyebrow">SAVE & SYNC</span><h3>データ管理</h3></div><Database /></header><div className={`sync-card ${!persistenceAvailable ? 'has-error' : ''}`}><span className={online && persistenceAvailable ? 'is-online' : ''}><Wifi /></span><div><strong>{!persistenceAvailable ? '保存ストレージを利用できません' : online ? 'オンライン同期済み' : 'オフラインモード'}</strong><small>{!persistenceAvailable || online ? saveStatus : `${queueCount}件のイベントを安全に保存中`}</small></div></div><div className="save-actions"><button className="secondary-action" type="button" onClick={onLoad} disabled={!persistenceAvailable}><RotateCcw />ロード</button><button className="primary-action primary-action--small" type="button" onClick={onSave} disabled={!persistenceAvailable}><Save />今すぐ保存</button></div></article>

        <article className="panel settings-panel"><header className="section-heading"><div><span className="eyebrow">DEVELOPER</span><h3>開発者モード</h3></div><Bug /></header><SettingToggle label="デバッグ機能を有効化" detail="テスト用操作とVisual Debugを表示" value={settings.developerMode} onChange={(value) => { onChange({ developerMode: value }); if (!value) setDebugOpen(false); }} /><button className="debug-open" type="button" disabled={!settings.developerMode} onClick={() => setDebugOpen(true)}><Activity />デバッグコンソールを開く<ChevronRight /></button></article>
      </section>

      {debugOpen && settings.developerMode ? <div className="debug-drawer"><header><div><span>DEVELOPER MODE</span><h2>Resonance Console</h2></div><button className="icon-button" type="button" onClick={() => setDebugOpen(false)} aria-label="デバッグコンソールを閉じる">×</button></header><div className="debug-warning"><Bug /><span><strong>ローカル開発専用</strong><small>操作は現在のセーブデータへ即時反映されます。</small></span></div><section><h3>GAME STATE</h3>{[['mine', '採掘イベント +1'], ['stone', '検証個体を生成（Perfect）'], ['perfect', 'Perfect個体を生成'], ['currency', '採掘ポイント +10,000'], ['level', '選択個体 LV.MAX'], ['affinity', '好感度 MAX']].map(([action, label]) => <button type="button" key={action} onClick={() => onDebugAction(action)}><span>{label}</span><ChevronRight /></button>)}</section><section><h3>VISUAL DEBUG</h3>{[['legendary', 'Legendary演出を再生'], ['mutation', 'Mutation個体を生成'], ['win', '戦闘を自動完走'], ['lose', '敗北強制の可否を確認']].map(([action, label]) => <button type="button" key={action} onClick={() => onDebugAction(action)}><span>{label}</span><ChevronRight /></button>)}</section><footer><span><Activity /> SCHEMA / UI BRIDGE ACTIVE</span></footer></div> : null}
    </div>
  );
}

function SettingToggle({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="setting-toggle"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}

function RangeSetting({ label, value, onChange, icon }: { label: string; value: number; onChange: (value: number) => void; icon: React.ReactNode }) {
  return <label className="range-setting"><span>{icon}<strong>{label}</strong></span><input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ '--range': `${value}%` } as React.CSSProperties} /><b>{value}</b></label>;
}
