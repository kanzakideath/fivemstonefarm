import { BrainCircuit, CheckCircle2, Clock3, Flower2, GraduationCap, LockKeyhole, PackageCheck, Sparkles, X } from 'lucide-react';
import type { UiStone } from '../components/uiTypes';

export interface FacilityAssignmentView {
  stoneId: string;
  stoneName: string;
  rateLabel: string;
  bankedLabel: string;
  canClaim: boolean;
}

export interface ResearchProjectView {
  id: string;
  name: string;
  detail: string;
  durationLabel: string;
  cost: number;
  unlocked: boolean;
  complete: boolean;
}

export interface ResearchSlotView {
  id: string;
  projectId: string;
  name: string;
  progress: number;
  remainingLabel: string;
  ready: boolean;
}

interface FacilitiesScreenProps {
  stones: UiStone[];
  training?: FacilityAssignmentView;
  affinity?: FacilityAssignmentView;
  research?: ResearchSlotView;
  researchProjects: ResearchProjectView[];
  onStartTraining: (stoneId: string) => void;
  onClaimTraining: () => void;
  onStopTraining: () => void;
  onStartAffinity: (stoneId: string) => void;
  onClaimAffinity: () => void;
  onStopAffinity: () => void;
  onStartResearch: (projectId: string) => void;
  onClaimResearch: (researchId: string) => void;
}

const StonePicker = ({ stones, label, onPick }: { stones: UiStone[]; label: string; onPick: (id: string) => void }) => (
  <div className="facility-stone-picker" aria-label={label}>
    {stones.slice(0, 8).map((stone) => (
      <button key={stone.id} type="button" onClick={() => onPick(stone.id)}>
        <span className={`rarity-dot rarity-${stone.rarity.toLowerCase()}`} />
        <span><strong>{stone.nickname || stone.name}</strong><small>LV.{stone.level} · {stone.element}</small></span>
      </button>
    ))}
  </div>
);

const Assignment = ({ assignment, onClaim, onStop }: { assignment: FacilityAssignmentView; onClaim: () => void; onStop: () => void }) => (
  <div className="facility-assignment">
    <div><small>ASSIGNED STONE</small><strong>{assignment.stoneName}</strong><span>{assignment.rateLabel}</span></div>
    <div><small>BANKED</small><strong>{assignment.bankedLabel}</strong></div>
    <div className="facility-actions">
      <button type="button" className="primary-action" disabled={!assignment.canClaim} onClick={onClaim}><PackageCheck />受け取る</button>
      <button type="button" className="text-button" disabled={assignment.canClaim} onClick={onStop}><X />配置解除</button>
    </div>
  </div>
);

export function FacilitiesScreen(props: FacilitiesScreenProps) {
  return (
    <div className="facilities-screen">
      <section className="panel facilities-hero">
        <div><span className="status-kicker"><BrainCircuit /> PASSIVE RESONANCE NETWORK</span><h2>離れている時間を、Stoneの記憶へ。</h2><p>同じ個体を複数施設へ置けません。能動戦闘より穏やかな効率で、最大30日分を安全に蓄積します。</p></div>
        <div className="facilities-hero__signal" aria-hidden="true"><i /><i /><BrainCircuit /></div>
      </section>

      <div className="facility-grid">
        <section className="panel facility-card" data-testid="training-chamber">
          <header><span><GraduationCap /> TRAINING CHAMBER</span><b>STONE XP</b></header>
          <p>1時間ごとに個体XPを獲得。LV.MAX後の余剰はResonance Masteryへ引き継げる保存形式です。</p>
          {props.training ? <Assignment assignment={props.training} onClaim={props.onClaimTraining} onStop={props.onStopTraining} /> : <><span className="facility-empty"><Clock3 /> 空きスロット</span><StonePicker stones={props.stones} label="Training Chamberへ配置" onPick={props.onStartTraining} /></>}
        </section>

        <section className="panel facility-card" data-testid="affinity-garden">
          <header><span><Flower2 /> AFFINITY GARDEN</span><b>AFFINITY</b></header>
          <p>お気に入りの個体と静かな時間を共有します。実戦やFarm同行を置き換えない補助成長です。</p>
          {props.affinity ? <Assignment assignment={props.affinity} onClaim={props.onClaimAffinity} onStop={props.onStopAffinity} /> : <><span className="facility-empty"><Sparkles /> 空きスロット</span><StonePicker stones={props.stones} label="Affinity Gardenへ配置" onPick={props.onStartAffinity} /></>}
        </section>
      </div>

      <section className="panel research-console" data-testid="research-console">
        <header className="section-heading"><div><span className="eyebrow">ONE ACTIVE SLOT</span><h3>Research Chamber</h3></div><BrainCircuit /></header>
        {props.research ? (
          <div className="research-active">
            <div><small>ACTIVE PROJECT</small><strong>{props.research.name}</strong><span>{props.research.ready ? '解析完了' : `残り ${props.research.remainingLabel}`}</span></div>
            <div className="research-progress"><i style={{ width: `${Math.max(0, Math.min(100, props.research.progress))}%` }} /><b>{Math.round(props.research.progress)}%</b></div>
            <button type="button" className="primary-action" disabled={!props.research.ready} onClick={() => props.onClaimResearch(props.research!.id)}><CheckCircle2 />研究成果を確定</button>
          </div>
        ) : (
          <div className="research-project-grid">
            {props.researchProjects.map((project) => (
              <article key={project.id} className={project.complete ? 'is-complete' : !project.unlocked ? 'is-locked' : ''}>
                <span>{project.complete ? <CheckCircle2 /> : project.unlocked ? <BrainCircuit /> : <LockKeyhole />}</span>
                <div><small>{project.durationLabel} / CORE {project.cost}</small><strong>{project.name}</strong><p>{project.detail}</p></div>
                <button type="button" disabled={!project.unlocked || project.complete} onClick={() => props.onStartResearch(project.id)}>{project.complete ? '完了済み' : project.unlocked ? '研究開始' : '未解放'}</button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
