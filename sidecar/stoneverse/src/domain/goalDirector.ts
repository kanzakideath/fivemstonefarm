export type GoalKind = 'EXPEDITION' | 'ENDLESS' | 'TRAINING' | 'RESEARCH' | 'COLLECTION' | 'EVOLUTION' | 'FUSION' | 'WEEKLY';

export interface DirectedGoal {
  id: string;
  kind: GoalKind;
  label: string;
  detail: string;
  current: number;
  target: number;
  priority: number;
  route: 'expedition' | 'endless' | 'facilities' | 'collection' | 'fusion' | 'battle';
}

export interface GoalDirectorInput {
  expedition?: { active: boolean; remainingMinutes: number; completedCycles: number };
  endless?: { floor: number; nextBossFloor: number; running: boolean };
  training?: { active: boolean; readyXp: number };
  research?: { active: boolean; ready: boolean; remainingMinutes: number };
  collection: { discovered: number; total: number };
  evolution?: { currentLevel: number; requiredLevel: number; stoneName: string };
  fusionCount: number;
  weeklyWins: number;
  weeklyWinTarget?: number;
}

/** Selects a diverse, actionable 3-5 item home agenda from live progression. */
export const directNextGoals = (input: GoalDirectorInput, limit = 5): DirectedGoal[] => {
  const goals: DirectedGoal[] = [];
  if (input.expedition?.active) goals.push({
    id: 'expedition-active', kind: 'EXPEDITION', label: input.expedition.remainingMinutes <= 0 ? '遠征報告を確認' : `遠征帰還まで約${Math.max(1, Math.ceil(input.expedition.remainingMinutes))}分`,
    detail: `${input.expedition.completedCycles}周の記録を蓄積`, current: input.expedition.remainingMinutes <= 0 ? 1 : 0, target: 1, priority: input.expedition.remainingMinutes <= 0 ? 100 : 82, route: 'expedition',
  });
  else goals.push({ id: 'expedition-start', kind: 'EXPEDITION', label: '遠征隊を派遣', detail: '地域・作戦・時間を選択', current: 0, target: 1, priority: 88, route: 'expedition' });

  if (input.endless) {
    const distance = Math.max(1, input.endless.nextBossFloor - input.endless.floor);
    goals.push({ id: 'endless-boss', kind: 'ENDLESS', label: `あと${distance} FloorでBoss`, detail: input.endless.running ? 'AUTO CLIMB進行中' : '無限鉱坑の潜行を再開', current: Math.max(0, 10 - distance), target: 10, priority: 84, route: 'endless' });
  }
  if (!input.training?.active) goals.push({ id: 'training-empty', kind: 'TRAINING', label: 'Training Chamberが空いています', detail: '育てたいStoneを1体配置', current: 0, target: 1, priority: 72, route: 'facilities' });
  else if (input.training.readyXp > 0) goals.push({ id: 'training-ready', kind: 'TRAINING', label: `育成XP +${Math.floor(input.training.readyXp).toLocaleString('ja-JP')}`, detail: '蓄積した訓練成果を受取可能', current: 1, target: 1, priority: 91, route: 'facilities' });

  if (input.research?.ready) goals.push({ id: 'research-ready', kind: 'RESEARCH', label: 'Research解析完了', detail: '成果を確定して次の研究を選択', current: 1, target: 1, priority: 96, route: 'facilities' });
  else if (!input.research?.active) goals.push({ id: 'research-empty', kind: 'RESEARCH', label: 'Research Slotが空いています', detail: '次の恒久研究を選択', current: 0, target: 1, priority: 68, route: 'facilities' });

  const missing = Math.max(0, input.collection.total - input.collection.discovered);
  if (missing > 0) goals.push({ id: 'collection-next', kind: 'COLLECTION', label: 'あと1体で図鑑を更新', detail: `未発見Species ${missing}体`, current: input.collection.discovered, target: Math.min(input.collection.total, input.collection.discovered + 1), priority: 60, route: 'collection' });
  if (input.evolution && input.evolution.currentLevel < input.evolution.requiredLevel) goals.push({ id: 'evolution-next', kind: 'EVOLUTION', label: `あと${input.evolution.requiredLevel - input.evolution.currentLevel} Levelで進化条件`, detail: input.evolution.stoneName, current: input.evolution.currentLevel, target: input.evolution.requiredLevel, priority: 64, route: 'collection' });

  const weeklyTarget = Math.max(1, input.weeklyWinTarget ?? 3);
  if (input.weeklyWins < weeklyTarget) goals.push({ id: 'weekly-wins', kind: 'WEEKLY', label: `あと${weeklyTarget - input.weeklyWins}勝でWeekly報酬`, detail: '期限は補助目標。常設進行は失われません', current: input.weeklyWins, target: weeklyTarget, priority: 48, route: 'battle' });
  goals.push({ id: 'fusion-build', kind: 'FUSION', label: '次世代のBuildを設計', detail: input.fusionCount ? `${input.fusionCount}系譜を比較` : '親個体のTrait・Skill・IVを比較', current: Math.min(1, input.fusionCount), target: 1, priority: 42, route: 'fusion' });

  const kindSeen = new Set<GoalKind>();
  return goals
    .filter((goal) => Number.isFinite(goal.current) && Number.isFinite(goal.target))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .filter((goal) => kindSeen.has(goal.kind) ? false : (kindSeen.add(goal.kind), true))
    .slice(0, Math.max(3, Math.min(5, Math.floor(limit))));
};
