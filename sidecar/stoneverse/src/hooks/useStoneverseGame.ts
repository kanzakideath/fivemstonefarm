import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DUNGEONS, PERSONALITY_BY_ID, RARITY_ORDER, SKILL_BY_ID, SPECIES, SPECIES_BY_ID, TRAIT_BY_ID, XP_CURVES } from '../data';
import { stoneverseApi } from '../api/stoneverseApi';
import { isLowerBetterLeaderboard } from '../api/online';
import { EXPEDITION_DURATIONS, EXPEDITION_REGIONS } from '../domain/expedition';
import { RESEARCH_PROJECTS, affinityReady, trainingXpReady } from '../domain/backgroundActivities';
import { generateEndlessFloor, getTurnOrder, getUsableSkills, type EquipmentRarity } from '../domain/advanced';
import { directNextGoals } from '../domain/goalDirector';
import type { BattleState, BattleUnit, ExpeditionStrategy as CoreExpeditionStrategy, GameSettings, LeaderboardCategory, MiningResult, ResearchProjectId, StoneInstance } from '../domain/types';
import type { StoneverseRoute } from '../domain/types';
import { useStoneverseStore } from '../store/stoneverseStore';
import type {
  ActiveExpeditionView,
  AdventureRewardView,
  AdventureStoneView,
  EndlessMineViewModel,
  ExpeditionDraftView,
  ExpeditionReportEventView,
  ExpeditionViewModel,
  IdleReportView,
  NotificationView,
} from '../components/adventureTypes';
import type { FacilityAssignmentView, ResearchProjectView, ResearchSlotView } from '../screens/FacilitiesScreen';
import type {
  UiBattleFighter,
  UiBattleFrame,
  UiBattleState,
  UiMiningResult,
  UiMission,
  UiPlayer,
  UiRankingEntry,
  UiRoute,
  UiSettings,
  UiStone,
} from '../components/uiTypes';

const titleNames: Record<string, string> = {
  title_new_resonance: 'はじまりの共鳴者',
  title_quarry_regular: '採掘場の常連',
  title_genealogist: '系譜を紡ぐ者',
  title_gene_anomaly: '不可能色の目撃者',
  title_stonekeeper: 'STONEKEEPER',
};

const arenaNames: Record<string, string> = {
  BRONZE: 'BRONZE III', SILVER: 'SILVER II', GOLD: 'GOLD I', PLATINUM: 'PLATINUM IV',
  DIAMOND: 'DIAMOND III', MASTER: 'MASTER', LEGEND: 'LEGEND',
};

const routeFromCore: Partial<Record<StoneverseRoute, UiRoute>> = {
  HOME: 'home', COLLECTION: 'collection', STONE_DETAIL: 'collection', FUSION: 'fusion', GACHA: 'gacha',
  PARTY: 'battle', BATTLE: 'battle', DUNGEON: 'battle', PROFILE: 'profile', RANKING: 'ranking',
  EXPEDITION: 'expedition', ENDLESS_MINE: 'endless', RESEARCH: 'facilities', FACILITIES: 'facilities',
};

const routeToCore: Partial<Record<UiRoute, StoneverseRoute>> = {
  home: 'HOME', collection: 'COLLECTION', fusion: 'FUSION', gacha: 'GACHA', battle: 'PARTY', profile: 'PROFILE', ranking: 'RANKING',
  expedition: 'EXPEDITION', endless: 'ENDLESS_MINE', facilities: 'FACILITIES',
};

const leaderboardCategories: Record<string, LeaderboardCategory> = {
  '総合採掘': 'TOTAL_MINING', '本日採掘': 'DAILY_MINING', '週間採掘': 'WEEKLY_MINING', '月間採掘': 'MONTHLY_MINING',
  '図鑑': 'COLLECTION', '実績': 'ACHIEVEMENTS', 'アリーナ': 'PVP', 'レイド': 'RAID', '希少発見': 'RARE_DISCOVERY', '配合発見': 'FUSION',
  'Endless最高階層': 'ENDLESS_HIGHEST_FLOOR', '最速踏破': 'ENDLESS_FASTEST_CLEAR', '最少被ダメ': 'ENDLESS_FEWEST_DAMAGE',
  '遠征スコア': 'EXPEDITION_SCORE', 'Boss撃破': 'BOSS_CLEARS', '戦闘力': 'BATTLE_POWER',
};

const leaderboardLabels: Partial<Record<LeaderboardCategory, string>> = {
  TOTAL_MINING: '総合採掘',
  DAILY_MINING: '本日採掘',
  WEEKLY_MINING: '週間採掘',
  MONTHLY_MINING: '月間採掘',
  COLLECTION: '図鑑',
  ACHIEVEMENTS: '実績',
  PVP: 'アリーナ',
  RAID: 'レイド',
  RARE_DISCOVERY: '希少発見',
  FUSION: '配合発見',
  ENDLESS_HIGHEST_FLOOR: 'Endless最高階層',
  ENDLESS_FASTEST_CLEAR: '最速踏破',
  ENDLESS_FEWEST_DAMAGE: '最少被ダメ',
  EXPEDITION_SCORE: '遠征スコア',
  BOSS_CLEARS: 'Boss撃破',
  BATTLE_POWER: '戦闘力',
};

const expeditionStrategyToUi: Record<CoreExpeditionStrategy, ExpeditionDraftView['strategy']> = {
  BALANCED: 'BALANCED', COMBAT: 'COMBAT', MINING: 'MINING', DISCOVERY: 'DISCOVERY', SAFE: 'SAFE', HIGH_RISK: 'HIGH_RISK',
  EXPERIENCE: 'COMBAT', MATERIALS: 'MINING',
};

export const toUiStone = (stone: StoneInstance): UiStone => ({
  id: stone.instanceId,
  speciesId: stone.speciesId,
  name: stone.name,
  nickname: stone.nickname ?? '',
  rarity: stone.rarity,
  origin: stone.origin,
  element: stone.primaryElement,
  secondaryElement: stone.secondaryElement ?? undefined,
  level: stone.level,
  xp: stone.xp,
  xpNext: XP_CURVES.stone(stone.level),
  combatPower: Math.round(stone.stats.power * 1.9 + stone.stats.defense * 1.45 + stone.stats.speed * 1.15 + stone.stats.resonance * 1.25 + stone.stats.maxHp * .18),
  potential: stone.potential,
  personality: PERSONALITY_BY_ID[stone.personalityId]?.name ?? stone.personalityId,
  affinity: stone.affinity.points,
  awakening: stone.awakeningStage,
  evolution: stone.evolutionStage,
  generation: stone.generation,
  mutation: stone.mutation === 'NONE' ? undefined : stone.mutation,
  colorVariant: stone.colorVariant === 'STANDARD' ? undefined : stone.colorVariant,
  favorite: stone.favorite,
  locked: stone.locked,
  serial: stone.serialNumber,
  obtainedAt: stone.firstObtainedAt,
  discoverer: stone.discoverer.username,
  originalOwner: stone.originalOwner.username,
  stats: {
    hp: stone.stats.maxHp,
    power: stone.stats.power,
    defense: stone.stats.defense,
    speed: stone.stats.speed,
    resonance: stone.stats.resonance,
  },
  ivs: {
    hp: stone.individualValues.hardness,
    power: stone.individualValues.power,
    defense: stone.individualValues.defense,
    speed: stone.individualValues.speed,
    resonance: stone.individualValues.resonance,
  },
  traits: stone.traitIds.map((id) => TRAIT_BY_ID[id]?.name ?? id),
  skills: stone.skills.map(({ skillId }) => SKILL_BY_ID[skillId]?.name ?? skillId),
  equipment: Object.values(stone.equipment).filter(Boolean).map((item) => item!.definitionId),
  parentIds: stone.parents.map((parent) => parent.instanceId),
  battleWins: stone.battleStatistics.wins,
  battleCount: stone.battleStatistics.battles,
});

const unitToFighter = (unit: BattleUnit, stones: Record<string, StoneInstance>): UiBattleFighter => {
  const owned = stones[unit.stoneId];
  const definition = SPECIES_BY_ID[unit.speciesId];
  const baseStone: UiStone = owned ? toUiStone(owned) : {
    id: unit.unitId, speciesId: unit.speciesId, name: unit.name || definition?.name || 'Unknown Core', nickname: '', rarity: definition?.rarity ?? 'NORMAL', origin: 'DUNGEON', element: unit.element,
    level: unit.level, xp: 0, xpNext: 1, combatPower: Math.round(unit.stats.power * 1.9 + unit.stats.defense * 1.45 + unit.stats.maxHp * .18), potential: 0, personality: '戦術型', affinity: 0, awakening: 0, evolution: 0, generation: 0,
    favorite: false, locked: false, serial: unit.unitId, obtainedAt: '', discoverer: '', originalOwner: '', mutation: undefined, colorVariant: undefined,
    stats: { hp: unit.stats.maxHp, power: unit.stats.power, defense: unit.stats.defense, speed: unit.stats.speed, resonance: unit.stats.resonance },
    ivs: { hp: 0, power: 0, defense: 0, speed: 0, resonance: 0 }, traits: [], skills: unit.skillIds.map((id) => SKILL_BY_ID[id]?.name ?? id), equipment: [], parentIds: [], battleWins: 0, battleCount: 0,
  };
  return { unitId: unit.unitId, stone: baseStone, hp: Math.max(0, unit.currentHp), maxHp: unit.stats.maxHp, ultimate: unit.ultimate, status: unit.statuses.map((status) => status.id) };
};

const battleToUi = (battle: BattleState | null | undefined, stones: Record<string, StoneInstance>): UiBattleState => {
  if (!battle) return { phase: 'idle', turn: 0, allies: [], enemies: [], log: [] };
  const advancedOrder = battle.advanced ? getTurnOrder(battle.advanced) : [];
  const commandActorId = battle.advanced
    ? advancedOrder.find((id) => battle.advanced!.units.find((unit) => unit.id === id)?.side === 'PLAYER')
    : undefined;
  const usableSkillIds = new Set(commandActorId && battle.advanced ? getUsableSkills(battle.advanced, commandActorId).map((skill) => skill.id) : []);
  const commandActor = battle.advanced?.units.find((unit) => unit.id === commandActorId);
  const lastAction = battle.actionLog.at(-1);
  const initialFighters = new Map(battle.units.map((unit) => [
    unit.unitId,
    unitToFighter({ ...unit, currentHp: unit.stats.maxHp, ultimate: 0, statuses: [], alive: true }, stones),
  ]));
  const snapshot = (turn: number, action?: BattleState['actionLog'][number]): UiBattleFrame => {
    const fighters = battle.units.map((unit) => ({
      ...initialFighters.get(unit.unitId)!,
      status: [...(initialFighters.get(unit.unitId)?.status ?? [])],
    }));
    return {
      turn,
      allies: fighters.filter((_, index) => battle.units[index]?.team === 'PLAYER'),
      enemies: fighters.filter((_, index) => battle.units[index]?.team === 'ENEMY'),
      activeId: action?.actorId,
      targetId: action?.targetIds[0],
      lastDamage: action?.targetIds[0] ? action.damageByTarget?.[action.targetIds[0]] ?? action.damage : undefined,
    };
  };
  const frames: UiBattleFrame[] = [snapshot(0)];
  for (const action of battle.actionLog) {
    for (const targetId of action.targetIds) {
      const target = initialFighters.get(targetId);
      if (!target) continue;
      const damage = action.damageByTarget?.[targetId] ?? action.damage / Math.max(1, action.targetIds.length);
      const healing = action.healingByTarget?.[targetId] ?? action.healing / Math.max(1, action.targetIds.length);
      target.hp = Math.max(0, Math.min(target.maxHp, Math.round(target.hp - damage + healing)));
      if (action.statusesApplied.length) target.status = [...new Set([...target.status, ...action.statusesApplied])];
    }
    for (const defeatedId of action.defeatedIds) {
      const defeated = initialFighters.get(defeatedId);
      if (defeated) defeated.hp = 0;
    }
    frames.push(snapshot(action.turn, action));
  }
  if (frames.length > 1) {
    const finalFrame = frames.at(-1)!;
    finalFrame.allies = battle.units.filter((unit) => unit.team === 'PLAYER').map((unit) => unitToFighter(unit, stones));
    finalFrame.enemies = battle.units.filter((unit) => unit.team === 'ENEMY').map((unit) => unitToFighter(unit, stones));
  }
  return {
    phase: battle.winner === 'PLAYER' ? 'victory' : battle.winner === 'ENEMY' ? 'defeat' : battle.winner === 'DRAW' ? 'draw' : 'running',
    turn: battle.turn,
    allies: battle.units.filter((unit) => unit.team === 'PLAYER').map((unit) => unitToFighter(unit, stones)),
    enemies: battle.units.filter((unit) => unit.team === 'ENEMY').map((unit) => unitToFighter(unit, stones)),
    log: battle.actionLog.map((action) => {
      const actor = battle.units.find((unit) => unit.unitId === action.actorId)?.name ?? '共鳴体';
      const skill = SKILL_BY_ID[action.skillId]?.name ?? action.skillId;
      const impact = action.healing > 0 ? `${action.healing.toLocaleString()}回復` : `${action.damage.toLocaleString()}ダメージ`;
      return `${actor}の「${skill}」 — ${impact}${action.critical ? ' / CRITICAL' : ''}`;
    }),
    activeId: lastAction?.actorId,
    targetId: lastAction?.targetIds[0],
    lastDamage: lastAction?.damage,
    reward: battle.winner === 'PLAYER' && battle.reward ? rewardLabel(battle.reward.currencies?.credits, battle.reward.stoneXp) : undefined,
    frames,
    commandActorId,
    commands: commandActor?.skillIds.map((skillId) => {
      const skill = battle.advanced!.skills[skillId];
      return {
        id: skillId,
        name: skill?.name ?? SKILL_BY_ID[skillId]?.name ?? skillId,
        cooldown: commandActor.cooldowns[skillId] ?? 0,
        ultimateCost: skill?.ultimateCost ?? 0,
        disabled: !usableSkillIds.has(skillId),
        target: skill?.target ?? 'ENEMY',
      };
    }) ?? [],
    turnOrder: advancedOrder.map((id, index) => {
      const unit = battle.advanced!.units.find((candidate) => candidate.id === id)!;
      return { id, name: unit.name, side: unit.side, speed: unit.stats.speed, active: index === 0 };
    }),
    manualMode: battle.controlMode !== 'AUTO',
    speed: battle.speed ?? 1,
  };
};

const rewardLabel = (credits?: number, stoneXp?: number) => [credits ? `採掘ポイント ${credits.toLocaleString()}` : '', stoneXp ? `Stone XP ${stoneXp}` : ''].filter(Boolean).join(' / ');

const formatElapsed = (milliseconds: number): string => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor(totalMinutes % 1_440 / 60);
  const minutes = totalMinutes % 60;
  return [days ? `${days}日` : '', hours ? `${hours}時間` : '', `${minutes}分`].filter(Boolean).join(' ');
};

const formatCountdown = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor(totalSeconds % 3_600 / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const expeditionReportType = (kind: string): ExpeditionReportEventView['type'] => {
  if (kind === 'DEPARTURE') return 'DEPARTURE';
  if (kind === 'BATTLE' || kind === 'BOSS') return 'BATTLE';
  if (kind === 'DISCOVERY') return 'RARE_SIGNAL';
  if (kind === 'RETURN') return 'RETURN';
  if (kind === 'MINING' || kind === 'MATERIAL' || kind === 'EQUIPMENT') return 'CACHE';
  return 'DISCOVERY';
};

const EQUIPMENT_RARITY_TO_UI: Record<EquipmentRarity, UiStone['rarity']> = {
  COMMON: 'NORMAL', UNCOMMON: 'RARE', RARE: 'SR', EPIC: 'SSR', LEGENDARY: 'UR', MYTHIC: 'LEGENDARY',
};
const equipmentRarityToUi = (rarity: EquipmentRarity): UiStone['rarity'] => EQUIPMENT_RARITY_TO_UI[rarity];

const UI_RARITY_TO_EQUIPMENT: Record<UiStone['rarity'], EquipmentRarity> = {
  NORMAL: 'COMMON', RARE: 'UNCOMMON', SR: 'RARE', SSR: 'EPIC', UR: 'LEGENDARY', LEGENDARY: 'MYTHIC',
};
const uiRarityToEquipment = (rarity: UiStone['rarity']): EquipmentRarity => UI_RARITY_TO_EQUIPMENT[rarity];

export function useStoneverseGame() {
  const store = useStoneverseStore();
  const [uiRoute, setUiRoute] = useState<UiRoute>(() => routeFromCore[store.route] ?? 'home');
  const [recentMining, setRecentMining] = useState<UiMiningResult[]>([]);
  const [lastReveal, setLastReveal] = useState<UiStone>();
  const [miningBusy, setMiningBusy] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [displayNow, setDisplayNow] = useState(() => store.game.idle.timeCheckpoint.trustedNowMs);
  const [dismissedIdleReportId, setDismissedIdleReportId] = useState<string>();
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
  const [expeditionDraft, setExpeditionDraft] = useState<ExpeditionDraftView>(() => ({
    partyIds: store.game.parties.find((party) => party.id === store.game.activePartyId)?.slots.map((slot) => slot.stoneId) ?? [],
    regionId: EXPEDITION_REGIONS[0]?.id ?? '',
    strategy: 'BALANCED',
    durationMinutes: 15,
    endless: false,
  }));
  const [rankingSnapshot, setRankingSnapshot] = useState<{
    category: LeaderboardCategory;
    label: string;
    entries: UiRankingEntry[];
  }>({ category: 'TOTAL_MINING', label: leaderboardLabels.TOTAL_MINING!, entries: [] });
  const loadedRankingCategory = useRef<LeaderboardCategory>('TOTAL_MINING');
  const rankingRequestSequence = useRef(0);
  useEffect(() => {
    const mapped = routeFromCore[store.route];
    if (mapped) setUiRoute(mapped);
  }, [store.route]);
  useEffect(() => {
    if (uiRoute !== 'expedition' && uiRoute !== 'endless' && uiRoute !== 'facilities' && uiRoute !== 'home') return;
    const trustedAnchor = store.game.idle.timeCheckpoint.trustedNowMs;
    const monotonicAnchor = globalThis.performance?.now() ?? 0;
    const update = () => setDisplayNow(Math.round(trustedAnchor + Math.max(0, (globalThis.performance?.now() ?? monotonicAnchor) - monotonicAnchor)));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [uiRoute, store.game.idle.timeCheckpoint.trustedNowMs]);
  const game = store.game;
  const stones = useMemo(() => Object.values(game.stones).map(toUiStone), [game.stones]);
  const activeParty = game.parties.find((party) => party.id === game.activePartyId) ?? game.parties[0];
  const partyIds = activeParty?.slots.map((slot) => slot.stoneId) ?? [];
  const player: UiPlayer = {
    id: game.account.accountId,
    username: game.account.username,
    title: titleNames[game.account.equippedTitleId] ?? game.account.equippedTitleId,
    accountLevel: game.accountProgress.level,
    accountXp: game.accountProgress.xp,
    accountXpNext: XP_CURVES.account(game.accountProgress.level),
    miningLevel: game.mining.level,
    miningXp: game.mining.xp,
    miningXpNext: XP_CURVES.mining(game.mining.level),
    totalMined: game.mining.totalMined,
    collectionRate: SPECIES.length ? game.collection.discoveredSpeciesIds.length / SPECIES.length * 100 : 0,
    achievementRate: Object.keys(game.achievements).length ? Object.values(game.achievements).filter((achievement) => achievement.unlockedAt).length / Object.keys(game.achievements).length * 100 : 0,
    arenaRank: arenaNames[game.account.arenaTier] ?? game.account.arenaTier,
    currency: game.inventory.currencies.credits,
    tickets: game.inventory.currencies.gachaTickets,
    research: game.inventory.currencies.researchCores,
    streak: Math.min(99, Math.max(1, Math.floor(game.mining.totalMined / 5) + 1)),
  };
  const settings: UiSettings = {
    masterVolume: Math.round(game.settings.masterVolume * 100), musicVolume: Math.round(game.settings.musicVolume * 100), effectsVolume: Math.round(game.settings.effectsVolume * 100),
    muted: game.settings.mute, reducedMotion: game.settings.reduceMotion, textScale: game.settings.textScale,
    effectQuality: game.settings.effectQuality === 'ULTRA' ? 'HIGH' : game.settings.effectQuality, highContrast, developerMode: game.settings.developerMode,
  };
  const missions: UiMission[] = [
    { id: 'mine-3', label: '鉱脈共鳴を3回記録', detail: '任意の鉱脈で採掘を行う', current: Math.min(3, game.mining.dailyMined), goal: 3, reward: 'DUST 80', complete: game.mining.dailyMined >= 3 },
    { id: 'appraise-1', label: '未知の個体を鑑定', detail: '未鑑定ストーンを1体解析', current: game.collection.discoveredSpeciesIds.length > 1 ? 1 : 0, goal: 1, reward: 'CORE 1', complete: game.collection.discoveredSpeciesIds.length > 1 },
    { id: 'battle-1', label: '遠征戦へ出撃', detail: '任意のステージを1回完了', current: Math.min(1, game.statistics.battleWins + game.statistics.battleLosses), goal: 1, reward: 'CREDIT 300', complete: game.statistics.battleWins + game.statistics.battleLosses > 0 },
  ];
  const pendingMining: UiMiningResult[] = game.unappraisedFinds.map((find) => ({ id: find.discoveryId, timestamp: Date.parse(find.discoveredAt), area: find.areaId, material: '共鳴鉱片', amount: 1, xp: 0, quality: find.hintedRarity === 'LEGENDARY' ? 'anomaly' : find.hintedRarity === 'SSR' || find.hintedRarity === 'UR' ? 'rare' : 'rich', appraised: false, unappraised: true }));
  const miningResults = [...pendingMining, ...recentMining.filter((entry) => !pendingMining.some((pending) => pending.id === entry.id))].sort((a, b) => b.timestamp - a.timestamp);
  const bannerPity = game.gacha.pityByBanner.banner_genesis?.pullsSinceSsr ?? 0;
  const recentGacha = game.gacha.history.slice(0, 20).map((entry) => game.stones[entry.stoneId]).filter((stone): stone is StoneInstance => Boolean(stone)).map(toUiStone);
  const activeBattle = battleToUi((game as typeof game & { activeBattle?: BattleState | null }).activeBattle ?? game.battleHistory.at(-1), game.stones);

  const occupiedStoneIds = new Map<string, AdventureStoneView['condition']>();
  for (const run of Object.values(game.expeditions.runs)) if (run.status !== 'CLAIMED') for (const member of run.partySnapshot) occupiedStoneIds.set(member.stoneId, 'DEPLOYED');
  if (game.endlessMine.status === 'RUNNING' || game.endlessMine.status === 'PAUSED') for (const id of game.endlessMine.partyStoneIds) occupiedStoneIds.set(id, 'DEPLOYED');
  if (game.training.assignment) occupiedStoneIds.set(game.training.assignment.stoneId, 'RESTING');
  if (game.affinityGarden.assignment) occupiedStoneIds.set(game.affinityGarden.assignment.stoneId, 'RESTING');
  const adventureStones: AdventureStoneView[] = stones.map((stone) => ({
    id: stone.id, name: stone.name, nickname: stone.nickname, rarity: stone.rarity, element: stone.element,
    level: stone.level, power: stone.combatPower, role: SPECIES_BY_ID[stone.speciesId]?.role ?? 'ATTACK', condition: occupiedStoneIds.get(stone.id) ?? 'READY',
  }));

  const expeditionRuns = game.expeditions.order
    .map((id) => game.expeditions.runs[id])
    .filter((run): run is NonNullable<typeof run> => Boolean(run));
  const occupiedExpeditionRuns = expeditionRuns.filter((run) => run.status !== 'CLAIMED');
  const expeditionViews = occupiedExpeditionRuns.map((run): ActiveExpeditionView => {
    const pendingCycles = run.completedCycles - run.claimedCycles;
    const rewards = run.expeditionStorage;
    const nextAt = Date.parse(run.nextCompletionAt);
    const currentCycleStartedAt = nextAt - run.durationMs;
    const progress = run.status === 'READY'
      ? 100
      : Math.max(0, Math.min(100, (displayNow - currentCycleStartedAt) / run.durationMs * 100));
    const report: ExpeditionReportEventView[] = run.reportEvents.map((event) => ({
      id: event.reportId,
      atLabel: event.offsetMs ? formatCountdown(event.offsetMs) : '00:00',
      title: event.title,
      description: event.detail,
      type: expeditionReportType(event.kind),
      reward: event.reward.credits || event.reward.upgradeDust ? `CREDIT ${event.reward.credits.toLocaleString()} / DUST ${event.reward.upgradeDust.toLocaleString()}` : undefined,
    }));
    const rewardViews = ([
      { id: `${run.expeditionId}-credit`, kind: 'CURRENCY', label: 'Mining Credits', amount: rewards.credits },
      { id: `${run.expeditionId}-dust`, kind: 'MATERIAL', label: 'Upgrade Dust', amount: rewards.upgradeDust },
      { id: `${run.expeditionId}-stone-xp`, kind: 'STONE_XP', label: 'Stone XP / member', amount: rewards.stoneXpPerMember },
      { id: `${run.expeditionId}-affinity`, kind: 'ITEM', label: 'Affinity / member', amount: rewards.affinityPerMember },
      { id: `${run.expeditionId}-account-xp`, kind: 'ACCOUNT_XP', label: 'Account XP', amount: rewards.accountXp },
      { id: `${run.expeditionId}-research-core`, kind: 'MATERIAL', label: 'Research Core', amount: rewards.researchCores },
      ...Object.entries(rewards.items).map(([id, amount]): AdventureRewardView => {
        const [logicalId, rarity] = id.split('::');
        return { id: `${run.expeditionId}-${id}`, kind: id.startsWith('equipment_') ? 'ITEM' : 'MATERIAL', label: `${logicalId!.replaceAll('_', ' ')}${rarity ? ` / ${rarity}` : ''}`, amount };
      }),
    ] satisfies AdventureRewardView[]).filter((reward) => (reward.amount ?? 0) > 0);
    const rare = rewards.rareDiscoveries[0];
    return {
      id: run.expeditionId,
      status: run.status === 'READY' ? 'COMPLETE' : 'ACTIVE',
      regionId: run.regionId,
      partyIds: run.partySnapshot.map((member) => member.stoneId),
      repeat: run.repeat,
      strategy: expeditionStrategyToUi[run.strategy],
      durationLabel: formatElapsed(run.durationMs),
      completedCycles: run.completedCycles,
      progress,
      remainingLabel: formatCountdown(nextAt - displayNow),
      elapsedLabel: formatElapsed(displayNow - Date.parse(run.startedAt)),
      returnAtLabel: new Date(nextAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      report,
      rewards: rewardViews,
      summary: { ...run.reportSummary },
      rareSignal: rare ? { id: rare.discoveryId, hint: `${rare.hintedRarity} resonance / ${rare.areaId}` } : undefined,
      canClaim: pendingCycles > 0,
      canStop: run.status === 'ACTIVE' && run.repeat,
    };
  });
  const activeExpedition = expeditionViews[0];
  const displayedExpedition = occupiedExpeditionRuns[0];

  const expeditionModel: ExpeditionViewModel = {
    party: adventureStones,
    regions: EXPEDITION_REGIONS.map((region) => ({
      id: region.id,
      name: region.name,
      sector: `GUILD ${region.requiredGuildLevel}`,
      summary: `${region.enemyTags.join(' / ')}。${region.favoredElements.join('・')}共鳴が有効。`,
      element: region.favoredElements.join(' + '),
      difficulty: Math.min(5, Math.max(1, Math.ceil(region.requiredGuildLevel / 1.4))),
      recommendedPower: region.enemyPower,
      durations: EXPEDITION_DURATIONS.map((duration) => duration.durationMs / 60_000),
      rareSignalRate: Math.round(region.rareDiscoveryChance * 10_000) / 100,
      rewardHints: [...region.materialDropIds.slice(0, 2), region.equipmentDropId],
      locked: game.facilities.expeditionGuild < region.requiredGuildLevel,
      lockReason: `Expedition Guild LV.${region.requiredGuildLevel}`,
    })),
    draft: expeditionDraft,
    runs: expeditionViews,
    storedDiscoveries: game.expeditions.discoveryStorage.map((discovery) => ({
      id: discovery.discoveryId,
      hint: `${discovery.hintedRarity} resonance / ${discovery.areaId}`,
      sourceLabel: EXPEDITION_REGIONS.find((region) => region.id === discovery.areaId)?.name ?? discovery.areaId.replaceAll('_', ' '),
      discoveredAtLabel: new Date(discovery.discoveredAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    })),
    active: activeExpedition,
    availableSlots: Math.min(4, 1 + Math.floor((game.facilities.expeditionGuild - 1) / 2)),
    usedSlots: occupiedExpeditionRuns.length,
  };

  const readyTrainingXp = trainingXpReady(game);
  const readyAffinity = affinityReady(game);
  const trainingView: FacilityAssignmentView | undefined = game.training.assignment ? {
    stoneId: game.training.assignment.stoneId,
    stoneName: game.stones[game.training.assignment.stoneId]?.nickname || game.stones[game.training.assignment.stoneId]?.name || 'Unknown Stone',
    rateLabel: `${game.training.assignment.xpPerHour.toLocaleString()} XP / H`,
    bankedLabel: `${readyTrainingXp.toLocaleString()} XP`,
    canClaim: readyTrainingXp > 0,
  } : undefined;
  const affinityView: FacilityAssignmentView | undefined = game.affinityGarden.assignment ? {
    stoneId: game.affinityGarden.assignment.stoneId,
    stoneName: game.stones[game.affinityGarden.assignment.stoneId]?.nickname || game.stones[game.affinityGarden.assignment.stoneId]?.name || 'Unknown Stone',
    rateLabel: `${game.affinityGarden.assignment.affinityPerHour} AFFINITY / H`,
    bankedLabel: `${readyAffinity.toLocaleString()} AFFINITY`,
    canClaim: readyAffinity > 0,
  } : undefined;
  const researchSlot = game.research.slot;
  const researchDefinition = researchSlot ? RESEARCH_PROJECTS.find((project) => project.id === researchSlot.projectId) : undefined;
  const researchView: ResearchSlotView | undefined = researchSlot && researchDefinition ? {
    id: researchSlot.researchId,
    projectId: researchSlot.projectId,
    name: researchDefinition.name,
    progress: researchSlot.status === 'READY' ? 100 : Math.max(0, Math.min(100, (displayNow - Date.parse(researchSlot.startedAt)) / researchDefinition.durationMs * 100)),
    remainingLabel: formatCountdown(Date.parse(researchSlot.completesAt) - displayNow),
    ready: researchSlot.status === 'READY',
  } : undefined;
  const researchProjects: ResearchProjectView[] = RESEARCH_PROJECTS.map((project) => ({
    id: project.id,
    name: project.name,
    detail: `${project.id === 'GEOLOGY_SURVEY' ? '採掘データから新たな鉱脈パターンを解析。' : project.id === 'GENETIC_ARCHIVE' ? 'Fusion lineageと継承Traitを恒久記録。' : '遠征枠と長距離補給手順を研究。'} 恒久効果: Research Lab Lv.${project.facilityLevelTargets.researchLab} / Expedition Guild Lv.${project.facilityLevelTargets.expeditionGuild} / Fusion Lab Lv.${project.facilityLevelTargets.fusionLab}`,
    durationLabel: formatElapsed(project.durationMs),
    cost: project.coreCost,
    unlocked: (!project.prerequisiteProjectId || game.research.completedProjectIds.includes(project.prerequisiteProjectId))
      && game.facilities.researchLab >= project.requiredLabLevel
      && game.inventory.currencies.researchCores >= project.coreCost,
    complete: game.research.completedProjectIds.includes(project.id),
  }));

  const endless = game.endlessMine;
  const endlessRun = endless.run;
  const endlessFloor = endless.activeFloor ?? generateEndlessFloor(endlessRun?.currentFloor ?? 1, endlessRun?.seed ?? endless.weeklySeed);
  const endlessBattle = endless.activeBattle;
  const endlessOrderIds = endlessBattle ? getTurnOrder(endlessBattle) : [...endless.partySnapshot, ...endlessFloor.enemies].sort((left, right) => right.stats.speed - left.stats.speed).map((unit) => unit.id);
  const endlessUnits = endlessBattle?.units ?? [...endless.partySnapshot, ...endlessFloor.enemies].map((unit) => ({ ...unit, hp: unit.stats.maxHp, alive: true }));
  const activePlayerActor = endlessBattle ? endlessOrderIds.find((id) => endlessBattle.units.find((unit) => unit.id === id)?.side === 'PLAYER' && endlessBattle.units.find((unit) => unit.id === id)?.alive) : undefined;
  const availableCommands = endlessBattle && activePlayerActor ? getUsableSkills(endlessBattle, activePlayerActor) : [];
  const enemyMaxHp = endlessBattle
    ? endlessBattle.units.filter((unit) => unit.side === 'ENEMY').reduce((sum, unit) => sum + unit.stats.maxHp, 0)
    : endlessFloor.enemies.reduce((sum, unit) => sum + unit.stats.maxHp, 0);
  const enemyHp = endlessBattle
    ? endlessBattle.units.filter((unit) => unit.side === 'ENEMY').reduce((sum, unit) => sum + unit.hp, 0)
    : enemyMaxHp;
  const timedFloorProgress = endless.nextFloorAt ? Math.max(0, Math.min(100, 100 - (Date.parse(endless.nextFloorAt) - displayNow) / (5 * 60_000) * 100)) : 0;
  const equippedEndlessItems = Object.values(game.stones).flatMap((stone) => Object.values(stone.equipment).flatMap((item) => item ? [{
    id: item.instanceId,
    name: item.definitionId.replaceAll('_', ' ').toLowerCase(),
    slot: item.slot,
    rarity: item.rarity === 'LEGENDARY' ? 'LEGENDARY' as const : item.rarity,
    level: item.level,
    effect: item.affixes.slice(0, 3).map((affix) => `${affix.stat} ${affix.operation === 'PERCENT' ? `+${(affix.value * 100).toFixed(1)}%` : `+${affix.value}`}`).join(' / '),
    setName: item.setId ?? undefined,
    equippedBy: stone.nickname || stone.name,
    equippedById: stone.instanceId,
    locked: item.locked,
  }] : []));
  const endlessModel: EndlessMineViewModel = {
    status: endless.status,
    canResumeFromCheckpoint: endless.status === 'ENDED'
      && endlessRun?.status === 'DEFEATED'
      && Boolean(endless.runId)
      && !endless.claimLedger[endless.runId!],
    floor: endlessRun?.currentFloor ?? 1,
    bestFloor: endless.highestFloor,
    floorProgress: endlessBattle && enemyMaxHp > 0 ? (1 - enemyHp / enemyMaxHp) * 100 : timedFloorProgress,
    winStreak: endless.winStreak,
    partyPower: endless.partySnapshot.reduce((sum, unit) => sum + Math.round(unit.stats.maxHp * .08 + unit.stats.attack * 4 + unit.stats.defense * 2 + unit.stats.speed), 0),
    enemyPower: endlessFloor.enemies.reduce((sum, unit) => sum + Math.round(unit.stats.maxHp * .08 + unit.stats.attack * 4 + unit.stats.defense * 2 + unit.stats.speed), 0),
    encounter: { type: endlessFloor.encounterType, label: endlessFloor.encounter.label, description: endlessFloor.encounter.description },
    resonanceIntegrity: endlessRun?.resonanceIntegrity ?? 100,
    modifiers: endlessFloor.rules.map((rule) => ({ id: rule.id, name: rule.label, description: `ATK ×${rule.attackMultiplier.toFixed(2)} / DEF ×${rule.defenseMultiplier.toFixed(2)} / BREAK ×${rule.breakMultiplier.toFixed(2)}`, tone: rule.id === 'BOSS_FLOOR' ? 'ANOMALY' : rule.attackMultiplier > 1.05 || rule.accuracyMultiplier < 1 ? 'HAZARD' : 'BOON' })),
    turnOrder: endlessOrderIds.slice(0, 9).map((id, index) => {
      const unit = endlessUnits.find((candidate) => candidate.id === id)!;
      return { id, name: unit?.name ?? id, side: unit?.side === 'ENEMY' ? 'ENEMY' : 'ALLY', initiative: Math.round(unit?.stats.speed ?? 0), element: endlessFloor.biome.replaceAll('_', ' '), active: index === 0, defeated: unit ? !unit.alive : false };
    }),
    strategy: endless.strategy,
    speed: endless.speed,
    manualMode: endless.manualMode,
    commands: availableCommands.map((skill, index) => ({ id: skill.id, label: skill.name, description: skill.effects.map((effect) => effect.status ?? effect.kind).join(' / '), keyHint: index < 4 ? String(index + 1) : 'space', costLabel: skill.ultimateCost ? `ULT ${skill.ultimateCost}` : undefined, cooldown: endlessBattle?.units.find((unit) => unit.id === activePlayerActor)?.cooldowns[skill.id] ?? 0 })),
    equipment: [
      ...equippedEndlessItems,
      ...endless.equipment.items.map((item) => ({ id: item.id, name: item.name, slot: item.slot, rarity: equipmentRarityToUi(item.rarity), level: item.level, score: item.score, setName: item.setId ?? undefined, effect: item.affixes.slice(0, 3).map((affix) => `${affix.stat} +${affix.value}`).join(' / '), locked: item.locked })),
    ],
    equipmentInventoryCount: endless.equipment.items.length,
    equipmentCapacity: endless.equipment.capacity,
    salvageMaterials: endless.equipment.salvageMaterials,
    equipmentTargets: Object.values(game.stones)
      .sort((left, right) => Number(right.favorite) - Number(left.favorite) || right.level - left.level || left.instanceId.localeCompare(right.instanceId))
      .map((stone) => ({ id: stone.instanceId, name: stone.nickname || stone.name, level: stone.level })),
    autoSalvage: {
      enabled: Boolean(endless.lootFilter.autoSalvage),
      threshold: equipmentRarityToUi(endless.lootFilter.minRarity ?? 'COMMON'),
      protectFavorites: (endless.lootFilter.alwaysKeepSets?.length ?? 0) > 0,
      queuedCount: 0,
    },
    battleLog: endless.recentLog,
    rewardPreview: [{ id: 'endless-credit', kind: 'CURRENCY', label: 'Depth Credit', amount: endless.pendingCredits }, { id: 'endless-equipment', kind: 'ITEM', label: 'Field Equipment', amount: endless.equipment.items.length }],
  };

  const welcome = game.idle.lastWelcomeBack;
  const pendingRareDiscovery = game.expeditions.discoveryStorage[0]
    ?? expeditionRuns.flatMap((run) => run.expeditionStorage.rareDiscoveries)[0];
  const showWelcome = welcome && welcome.summaryId !== dismissedIdleReportId && (welcome.rollbackDetected || welcome.elapsedMs >= 60_000 || welcome.expeditionCycles > 0 || welcome.endlessFloors > 0 || welcome.trainingXpReady > 0 || welcome.affinityReady > 0 || welcome.researchReady || welcome.rareDiscoveries > 0);
  const pendingExpeditionRewards = expeditionRuns.reduce((total, run) => ({
    credits: total.credits + run.expeditionStorage.credits,
    upgradeDust: total.upgradeDust + run.expeditionStorage.upgradeDust,
    researchCores: total.researchCores + run.expeditionStorage.researchCores,
    accountXp: total.accountXp + run.expeditionStorage.accountXp,
    stoneXp: total.stoneXp + run.expeditionStorage.stoneXpPerMember * run.partySnapshot.length,
    affinity: total.affinity + run.expeditionStorage.affinityPerMember * run.partySnapshot.length,
    items: total.items + Object.values(run.expeditionStorage.items).reduce((sum, amount) => sum + amount, 0),
  }), { credits: 0, upgradeDust: 0, researchCores: 0, accountXp: 0, stoneXp: 0, affinity: 0, items: 0 });
  const idleRewards: AdventureRewardView[] = welcome ? ([
    { id: 'idle-expedition-credit', kind: 'CURRENCY', label: 'Expedition Credits (未受取Storage)', amount: pendingExpeditionRewards.credits },
    { id: 'idle-expedition-dust', kind: 'MATERIAL', label: 'Expedition Upgrade Dust', amount: pendingExpeditionRewards.upgradeDust },
    { id: 'idle-expedition-cores', kind: 'ITEM', label: 'Expedition Research Core', amount: pendingExpeditionRewards.researchCores },
    { id: 'idle-expedition-account-xp', kind: 'ACCOUNT_XP', label: 'Expedition Account XP', amount: pendingExpeditionRewards.accountXp },
    { id: 'idle-expedition-stone-xp', kind: 'STONE_XP', label: 'Expedition Party XP', amount: pendingExpeditionRewards.stoneXp },
    { id: 'idle-expedition-affinity', kind: 'ITEM', label: 'Expedition Party Affinity', amount: pendingExpeditionRewards.affinity },
    { id: 'idle-expedition-items', kind: 'ITEM', label: 'Expedition Items / Equipment', amount: pendingExpeditionRewards.items },
    { id: 'idle-endless-credit', kind: 'CURRENCY', label: 'Endless Credit (Storage)', amount: welcome.endlessCredits },
    { id: 'idle-training', kind: 'STONE_XP', label: 'Training XP Ready', amount: welcome.trainingXpReady },
    { id: 'idle-affinity', kind: 'ITEM', label: 'Affinity Ready', amount: welcome.affinityReady },
    { id: 'idle-equipment', kind: 'ITEM', label: 'Equipment secured', amount: welcome.equipmentAdded },
    ...(welcome.researchReady ? [{ id: 'idle-research', kind: 'ACCOUNT_XP' as const, label: 'Research complete', amount: 1 }] : []),
  ] satisfies AdventureRewardView[]).filter((reward) => (reward.amount ?? 0) > 0) : [];
  const idleStoneProgress = welcome ? (() => {
    const progress = new Map<string, IdleReportView['stoneProgress'][number]>();
    const append = (stoneId: string, xp: number, affinity: number) => {
      const stone = game.stones[stoneId];
      if (!stone) return;
      const current = progress.get(stoneId);
      progress.set(stoneId, {
        id: stoneId,
        name: stone.nickname || stone.name,
        // The bank records exact gains, but not a historical level snapshot.
        // Showing the current level for both sides avoids fabricating a level-up.
        levelBefore: stone.level,
        levelAfter: stone.level,
        xp: (current?.xp ?? 0) + xp,
        affinity: (current?.affinity ?? 0) + affinity,
      });
    };
    if (game.training.assignment && welcome.trainingXpReady > 0) append(game.training.assignment.stoneId, welcome.trainingXpReady, 0);
    if (game.affinityGarden.assignment && welcome.affinityReady > 0) append(game.affinityGarden.assignment.stoneId, 0, welcome.affinityReady);
    return [...progress.values()];
  })() : [];
  const idleReport: IdleReportView | null = showWelcome && welcome ? {
    id: welcome.summaryId,
    awayLabel: formatElapsed(welcome.elapsedMs),
    periodLabel: `${new Date(welcome.from).toLocaleString('ja-JP')} → ${new Date(welcome.to).toLocaleString('ja-JP')}`,
    capped: welcome.capped,
    rollbackDetected: welcome.rollbackDetected,
    expeditionsCompleted: welcome.expeditionCycles,
    floorsCleared: welcome.endlessFloors,
    miningCycles: 0,
    rewards: idleRewards,
    stoneProgress: idleStoneProgress,
    rareSignal: pendingRareDiscovery ? { id: pendingRareDiscovery.discoveryId, hint: `${Math.max(1, welcome.rareDiscoveries)}件の未解析共鳴を検出` } : undefined,
  } : null;

  const notifications: NotificationView[] = [
    ...(expeditionRuns.reduce((sum, run) => sum + Math.max(0, run.completedCycles - run.claimedCycles), 0) > 0 ? [{ id: `expedition-ready:${game.expeditions.totalCycles}`, kind: 'EXPEDITION' as const, title: `Expedition ×${expeditionRuns.reduce((sum, run) => sum + Math.max(0, run.completedCycles - run.claimedCycles), 0)} completed`, detail: '報酬はExpedition Storageへ安全に格納されています。', timeLabel: '現在', actionLabel: '遠征報告' }] : []),
    ...(game.expeditions.discoveryStorage.length > 0 ? [{ id: `rare-storage:${game.expeditions.discoveryStorage.length}`, kind: 'DISCOVERY' as const, title: 'UNKNOWN SIGNAL', detail: `Temporary Discovery Storageに${game.expeditions.discoveryStorage.length}体`, timeLabel: '現在', actionLabel: '確認' }] : []),
    ...(researchSlot?.status === 'READY' ? [{ id: `research-ready:${researchSlot.researchId}`, kind: 'REWARD' as const, title: 'Research completed', detail: researchDefinition?.name ?? researchSlot.projectId, timeLabel: '現在', actionLabel: '受取' }] : []),
    ...(readyTrainingXp > 0 ? [{ id: `training-ready:${game.training.assignment?.stoneId}:${readyTrainingXp}`, kind: 'REWARD' as const, title: 'Training reward ready', detail: `${readyTrainingXp.toLocaleString()} XPを受取可能`, timeLabel: '現在', actionLabel: '育成区画' }] : []),
    ...(endless.status === 'ENDED' && endless.pendingCredits > 0 ? [{ id: `endless-ended:${endless.runId}`, kind: 'BATTLE' as const, title: 'Endless Mine run ended', detail: `Floor ${endlessRun?.currentFloor ?? 1} / CREDIT ${endless.pendingCredits.toLocaleString()}`, timeLabel: '現在', actionLabel: '無限鉱坑' }] : []),
  ].map((notification) => ({ ...notification, read: readNotificationIds.has(notification.id) }));

  const nextGoals = directNextGoals({
    expedition: displayedExpedition ? { active: true, remainingMinutes: Math.max(0, (Date.parse(displayedExpedition.nextCompletionAt) - displayNow) / 60_000), completedCycles: displayedExpedition.completedCycles } : undefined,
    endless: { floor: endlessRun?.currentFloor ?? 1, nextBossFloor: Math.ceil((endlessRun?.currentFloor ?? 1) / 10) * 10, running: endless.status === 'RUNNING' },
    training: { active: Boolean(game.training.assignment), readyXp: readyTrainingXp },
    research: { active: Boolean(researchSlot), ready: researchSlot?.status === 'READY', remainingMinutes: researchSlot ? Math.max(0, (Date.parse(researchSlot.completesAt) - displayNow) / 60_000) : 0 },
    collection: { discovered: game.collection.discoveredSpeciesIds.length, total: SPECIES.length },
    fusionCount: game.statistics.fusionCount,
    weeklyWins: game.statistics.battleWins % 3,
  });
  const playerBattlePower = partyIds.reduce((total, stoneId) => total + (stones.find((stone) => stone.id === stoneId)?.combatPower ?? 0), 0);

  const loadRankings = useCallback(async (label?: string) => {
    const category = label
      ? leaderboardCategories[label] ?? loadedRankingCategory.current
      : loadedRankingCategory.current;
    const requestSequence = ++rankingRequestSequence.current;
    // The standalone singleton defaults to MockOnline; an integrated runtime can
    // provide the same public API boundary without the screen owning an adapter.
    try {
      const entries = await stoneverseApi.getLeaderboard(category, 1_000);
      if (requestSequence !== rankingRequestSequence.current) return;
      const playerValue = (() : number | null => {
        switch (category) {
          case 'TOTAL_MINING': return game.mining.totalMined;
          case 'DAILY_MINING': return game.mining.dailyMined;
          case 'WEEKLY_MINING': return game.mining.weeklyMined;
          case 'MONTHLY_MINING': return game.mining.monthlyMined;
          case 'COLLECTION': return player.collectionRate;
          case 'ACHIEVEMENTS': return player.achievementRate;
          case 'PVP': return game.account.arenaRating;
          case 'RAID': return game.account.raidStats.lifetimeDamage;
          case 'RARE_DISCOVERY': return game.statistics.rareDiscoveryCount;
          case 'FUSION': return game.statistics.fusionCount;
          case 'ENDLESS_HIGHEST_FLOOR': return game.endlessMine.weeklyHighestFloor;
          // The save does not yet retain authoritative weekly values for these
          // two metrics. Omitting YOU is safer than fabricating a competitive score.
          case 'ENDLESS_FASTEST_CLEAR': return null;
          case 'ENDLESS_FEWEST_DAMAGE': return null;
          case 'EXPEDITION_SCORE': return Math.min(Number.MAX_SAFE_INTEGER, game.expeditions.totalCycles * 100 + game.endlessMine.weeklyHighestFloor * 25);
          case 'BOSS_CLEARS': return game.account.raidStats.bossesDefeated + Math.floor(game.endlessMine.highestFloor / 10);
          case 'BATTLE_POWER': return playerBattlePower;
        }
      })();
      const visible = entries.slice(0, 100).map((entry): UiRankingEntry => ({
        rank: entry.rank,
        id: entry.accountId,
        name: entry.username,
        title: titleNames[entry.titleId] ?? (entry.rank <= 3 ? '星環を越えた者' : '深層共鳴者'),
        score: entry.value,
        level: Math.max(3, 100 - Math.floor(entry.rank / 9)),
        stone: stones.length ? stones[(entry.rank - 1) % stones.length] : undefined,
        delta: entry.previousRank == null ? 0 : entry.previousRank - entry.rank,
      }));
      if (playerValue !== null) {
        const lowerIsBetter = isLowerBetterLeaderboard(category);
        const playerRank = entries.filter((entry) => lowerIsBetter ? entry.value < playerValue : entry.value > playerValue).length + 1;
        const own: UiRankingEntry = { rank: playerRank, id: player.id, name: player.username, title: player.title, score: playerValue, level: player.accountLevel, stone: stones[0], isPlayer: true, delta: 0 };
        const at = visible.findIndex((entry) => entry.rank === playerRank);
        if (at >= 0) visible[at] = own;
        else visible.push(own);
      }
      if (requestSequence === rankingRequestSequence.current) {
        loadedRankingCategory.current = category;
        setRankingSnapshot({ category, label: leaderboardLabels[category] ?? category, entries: visible });
      }
    } catch {
      // Keep the most recently rendered ranking when the online adapter is unavailable.
    }
  }, [game.account.arenaRating, game.account.raidStats.bossesDefeated, game.account.raidStats.lifetimeDamage, game.endlessMine.highestFloor, game.endlessMine.weeklyHighestFloor, game.expeditions.totalCycles, game.mining.dailyMined, game.mining.monthlyMined, game.mining.totalMined, game.mining.weeklyMined, game.statistics.fusionCount, game.statistics.rareDiscoveryCount, player.accountLevel, player.achievementRate, player.collectionRate, player.id, player.title, player.username, playerBattlePower, stones]);

  useEffect(() => {
    void loadRankings();
    return () => { rankingRequestSequence.current += 1; };
  }, [loadRankings]);

  const mine = async () => {
    setMiningBusy(true);
    try {
      const eventId = globalThis.crypto?.randomUUID?.() ?? `mine-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result: MiningResult = stoneverseApi.onStoneMined({ eventId, sessionId: game.online.sessionId, areaId: 'area_greenbreak', veinId: 'vein_crystal', amount: 1, quality: .72 });
      const rows: UiMiningResult[] = result.discoveries.length ? result.discoveries.map((find) => ({ id: find.discoveryId, timestamp: Date.parse(find.discoveredAt), area: find.areaId, material: '共鳴鉱片', amount: 1, xp: result.xpGranted, quality: find.hintedRarity === 'LEGENDARY' ? 'anomaly' : 'rare', appraised: false, unappraised: true })) : [{ id: eventId, timestamp: Date.now(), area: '水晶脈・深層', material: '結晶鉱片', amount: Math.max(1, result.creditsGranted), xp: result.xpGranted, quality: 'common', appraised: true }];
      setRecentMining((current) => [...rows, ...current].slice(0, 12));
      return result;
    } finally {
      window.setTimeout(() => setMiningBusy(false), game.settings.reduceMotion ? 50 : 620);
    }
  };

  const appraise = async (id: string) => {
    const result = stoneverseApi.appraiseStone(id);
    const stone = toUiStone(result.stone);
    setLastReveal(stone);
    setRecentMining((current) => current.map((entry) => entry.id === id ? { ...entry, appraised: true, stone } : entry));
    return stone;
  };

  const pullGacha = async (count: 1 | 10) => stoneverseApi.pullGacha('banner_genesis', count).stones.map(toUiStone);
  const fuse = async (parentIds: string[], catalyst?: string, consumeParents = false) => toUiStone(stoneverseApi.fuseStones(parentIds, {
    catalystIds: catalyst ? ['catalyst_mutagen'] : [],
    consumeParents,
  }).child);
  const setParty = (ids: string[]) => store.setParty(ids);
  const startBattle = async () => {
    const dungeon = DUNGEONS[0];
    const started = stoneverseApi.startDungeonBattle(dungeon.id, dungeon.stages[0].id);
    return battleToUi(started, stoneverseApi.getStoneverseState().stones);
  };
  const advanceBattle = () => stoneverseApi.advanceBattle();
  const issueBattleCommand = (skillId: string, targetIds?: readonly string[]) => stoneverseApi.issueBattleCommand(skillId, targetIds);
  const setBattleAuto = (auto: boolean) => stoneverseApi.setBattleAuto(auto);
  const setBattleSpeed = (speed: 1 | 2 | 4) => stoneverseApi.setBattleSpeed(speed);
  const abandonBattle = () => stoneverseApi.abandonBattle();
  const startExpeditionFromDraft = (draft: ExpeditionDraftView) => {
    const duration = EXPEDITION_DURATIONS.find((entry) => entry.durationMs / 60_000 === draft.durationMinutes);
    if (!duration) throw new Error('選択した遠征時間は利用できません');
    store.setParty(draft.partyIds);
    const run = stoneverseApi.startExpedition({ regionId: draft.regionId, durationId: duration.id, strategy: draft.strategy as CoreExpeditionStrategy, repeat: draft.endless });
    const latest = useStoneverseStore.getState().game;
    const busy = new Set(Object.values(latest.expeditions.runs)
      .filter((entry) => entry.status !== 'CLAIMED')
      .flatMap((entry) => entry.partySnapshot.map((member) => member.stoneId)));
    if (latest.training.assignment) busy.add(latest.training.assignment.stoneId);
    if (latest.affinityGarden.assignment) busy.add(latest.affinityGarden.assignment.stoneId);
    if (latest.endlessMine.status === 'RUNNING' || latest.endlessMine.status === 'PAUSED') {
      for (const stoneId of latest.endlessMine.partyStoneIds) busy.add(stoneId);
    }
    const nextFormation = Object.keys(latest.stones).filter((stoneId) => !busy.has(stoneId)).slice(0, 3);
    setExpeditionDraft((current) => ({ ...current, partyIds: nextFormation }));
    return run;
  };
  const inspectExpeditionSignal = (discoveryId: string) => {
    try {
      const latest = useStoneverseStore.getState().game;
      const stored = latest.expeditions.discoveryStorage.some((entry) => entry.discoveryId === discoveryId);
      if (stored) {
        const discovered = stoneverseApi.claimStoredExpeditionDiscovery(discoveryId);
        const revealed = toUiStone(discovered);
        setLastReveal(revealed);
        return revealed;
      }
      const sourceRun = Object.values(latest.expeditions.runs).find((run) =>
        run.completedCycles > run.claimedCycles
        && run.expeditionStorage.rareDiscoveries.some((entry) => entry.discoveryId === discoveryId));
      if (!sourceRun) return undefined;
      const result = stoneverseApi.claimExpedition(sourceRun.expeditionId);
      const rewardIndex = result.reward.rareDiscoveries.findIndex((entry) => entry.discoveryId === discoveryId);
      const discovered = rewardIndex >= 0 ? result.discoveredStones[rewardIndex] : undefined;
      if (!discovered) return undefined; // Safely retained in Temporary Discovery Storage.
      const revealed = toUiStone(discovered);
      setLastReveal(revealed);
      return revealed;
    } catch {
      // Store/API records the actionable error; keep UI event handlers rejection-free.
      return undefined;
    }
  };
  const startEndless = () => {
    let latest = useStoneverseStore.getState().game;
    const previousCampaign = latest.endlessMine;
    if (previousCampaign.status === 'ENDED' && previousCampaign.runId && !previousCampaign.claimLedger[previousCampaign.runId]) {
      stoneverseApi.claimEndlessMine();
      latest = useStoneverseStore.getState().game;
    }
    const busy = new Set(Object.values(latest.expeditions.runs).filter((run) => run.status !== 'CLAIMED').flatMap((run) => run.partySnapshot.map((member) => member.stoneId)));
    if (latest.training.assignment) busy.add(latest.training.assignment.stoneId);
    if (latest.affinityGarden.assignment) busy.add(latest.affinityGarden.assignment.stoneId);
    const selected = latest.parties.find((entry) => entry.id === latest.activePartyId)?.slots.map((slot) => slot.stoneId).filter((id) => !busy.has(id)) ?? [];
    const fallback = Object.keys(latest.stones).filter((id) => !busy.has(id)).slice(0, 3);
    stoneverseApi.startEndlessMine((selected.length ? selected : fallback).slice(0, 3));
  };
  const pauseOrResumeEndless = () => {
    const status = useStoneverseStore.getState().game.endlessMine.status;
    if (status === 'PAUSED' || status === 'ENDED') stoneverseApi.resumeEndlessMine();
    else stoneverseApi.pauseEndlessMine();
  };
  const retreatEndless = () => {
    const status = useStoneverseStore.getState().game.endlessMine.status;
    if (status === 'RUNNING') stoneverseApi.pauseEndlessMine();
    return stoneverseApi.claimEndlessMine();
  };
  const claimIdleReport = (summaryId: string) => {
    let latest = useStoneverseStore.getState().game;
    const discovered: StoneInstance[] = [];
    for (const run of Object.values(latest.expeditions.runs)) {
      if (run.completedCycles > run.claimedCycles) {
        discovered.push(...stoneverseApi.claimExpedition(run.expeditionId).discoveredStones);
        latest = useStoneverseStore.getState().game;
      }
    }
    if (trainingXpReady(latest) > 0) { stoneverseApi.claimTraining(); latest = useStoneverseStore.getState().game; }
    if (affinityReady(latest) > 0) { stoneverseApi.claimAffinityGarden(); latest = useStoneverseStore.getState().game; }
    if (latest.research.slot?.status === 'READY') stoneverseApi.claimResearch(latest.research.slot.researchId);
    const bestDiscovery = discovered.sort((left, right) => RARITY_ORDER[right.rarity] - RARITY_ORDER[left.rarity])[0];
    if (bestDiscovery) setLastReveal(toUiStone(bestDiscovery));
    store.dismissWelcomeBack(summaryId);
    setDismissedIdleReportId(summaryId);
  };
  const dismissIdleReport = () => {
    if (!idleReport) return;
    store.dismissWelcomeBack(idleReport.id);
    setDismissedIdleReportId(idleReport.id);
  };
  const notificationAction = (notificationId: string) => {
    setReadNotificationIds((current) => new Set(current).add(notificationId));
    if (notificationId.startsWith('expedition') || notificationId.startsWith('rare-storage')) setUiRoute('expedition');
    else if (notificationId.startsWith('research') || notificationId.startsWith('training')) setUiRoute('facilities');
    else if (notificationId.startsWith('endless')) setUiRoute('endless');
  };
  const updateSettings = (patch: Partial<UiSettings>) => {
    if (typeof patch.highContrast === 'boolean') setHighContrast(patch.highContrast);
    const corePatch: Partial<GameSettings> = {};
    if (patch.masterVolume !== undefined) corePatch.masterVolume = patch.masterVolume / 100;
    if (patch.musicVolume !== undefined) corePatch.musicVolume = patch.musicVolume / 100;
    if (patch.effectsVolume !== undefined) corePatch.effectsVolume = patch.effectsVolume / 100;
    if (patch.muted !== undefined) corePatch.mute = patch.muted;
    if (patch.reducedMotion !== undefined) corePatch.reduceMotion = patch.reducedMotion;
    if (patch.textScale !== undefined) corePatch.textScale = patch.textScale;
    if (patch.effectQuality !== undefined) corePatch.effectQuality = patch.effectQuality;
    if (patch.developerMode !== undefined) corePatch.developerMode = patch.developerMode;
    store.updateSettings(corePatch);
  };
  const debugAction = (action: string) => {
    if (action === 'mine') { void mine(); return '採掘イベントを実行しました'; }
    if (action === 'stone') { const id = store.createPerfectStone(SPECIES[0].id); return `検証個体を生成しました: ${id.slice(0, 16)}`; }
    if (action === 'perfect' || action === 'mutation') { const id = store.createPerfectStone(SPECIES[Math.min(3, SPECIES.length - 1)].id); return `PERFECT変異個体を生成しました: ${id.slice(0, 16)}`; }
    if (action === 'currency') { store.addCurrency('credits', 10_000); return '採掘ポイントを10,000付与しました'; }
    if (action === 'level' && stones[0]) { stoneverseApi.trainStone(stones[0].id, 100_000_000); return `${stones[0].nickname || stones[0].name}をLV.MAXまで育成しました`; }
    if (action === 'affinity' && stones[0]) { store.addAffinity(stones[0].id, 10_000); return `${stones[0].nickname || stones[0].name}の好感度を更新しました`; }
    if (action === 'win') { void startBattle(); return '実バトルシミュレーションを完走しました'; }
    if (action === 'legendary') return '演出強制はEffect Managerの検証ハーネスから実行してください';
    if (action === 'lose') return '敗北の強制は公平性保護のためコア契約に公開されていません';
    return 'この操作は現在のコア契約では利用できません';
  };

  return {
    game,
    route: uiRoute,
    selectedStoneId: store.selectedStoneId ?? undefined,
    player,
    stones,
    partyIds,
    missions,
    settings,
    miningResults,
    miningBusy,
    lastReveal,
    recentGacha,
    pity: bannerPity,
    battle: activeBattle,
    expeditionModel,
    endlessModel,
    trainingView,
    affinityView,
    researchView,
    researchProjects,
    idleReport,
    notifications,
    nextGoals,
    rankings: rankingSnapshot.entries,
    rankingCategory: rankingSnapshot.category,
    rankingCategoryLabel: rankingSnapshot.label,
    loadRankings,
    online: game.online.connected,
    persistenceAvailable: store.persistenceAvailable,
    queueCount: game.online.queue.length,
    facilityLevel: game.facilities.fusionLab,
    catalysts: game.inventory.items.catalyst_mutagen ?? 0,
    showcaseIds: game.profile.showcaseStoneIds,
    lastError: store.lastError,
    navigate: (route: UiRoute) => {
      setUiRoute(route);
      const coreRoute = routeToCore[route];
      if (!coreRoute) return;
      if (coreRoute === 'HOME') stoneverseApi.openStoneverse();
      else if (coreRoute === 'COLLECTION') stoneverseApi.openCollection();
      else if (coreRoute === 'GACHA') stoneverseApi.openGacha();
      else if (coreRoute === 'PROFILE') stoneverseApi.openProfile();
      else if (coreRoute === 'RANKING') stoneverseApi.openRanking();
      else store.setRoute(coreRoute);
    },
    selectStone: (id?: string) => {
      if (id) stoneverseApi.openStoneDetail(id);
      else stoneverseApi.openCollection();
    },
    mine,
    appraise,
    clearReveal: () => setLastReveal(undefined),
    pullGacha,
    fuse,
    setParty,
    startBattle,
    advanceBattle,
    issueBattleCommand,
    setBattleAuto,
    setBattleSpeed,
    abandonBattle,
    setExpeditionDraft,
    startExpedition: startExpeditionFromDraft,
    stopExpedition: (expeditionId: string) => stoneverseApi.stopExpedition(expeditionId),
    claimExpedition: (expeditionId: string) => {
      const result = stoneverseApi.claimExpedition(expeditionId);
      const bestDiscovery = [...result.discoveredStones].sort((left, right) => RARITY_ORDER[right.rarity] - RARITY_ORDER[left.rarity])[0];
      if (bestDiscovery) setLastReveal(toUiStone(bestDiscovery));
      return result;
    },
    inspectExpeditionSignal,
    startTraining: (stoneId: string) => stoneverseApi.startTraining(stoneId),
    claimTraining: () => stoneverseApi.claimTraining(),
    stopTraining: () => stoneverseApi.stopTraining(),
    startAffinity: (stoneId: string) => stoneverseApi.startAffinityGarden(stoneId),
    claimAffinity: () => stoneverseApi.claimAffinityGarden(),
    stopAffinity: () => stoneverseApi.stopAffinityGarden(),
    startResearch: (projectId: string) => stoneverseApi.startResearch(projectId as ResearchProjectId),
    claimResearch: (researchId: string) => stoneverseApi.claimResearch(researchId),
    startEndless,
    pauseOrResumeEndless,
    retreatEndless,
    setEndlessStrategy: stoneverseApi.setEndlessStrategy,
    setEndlessSpeed: stoneverseApi.setEndlessSpeed,
    setEndlessManual: stoneverseApi.setEndlessManual,
    issueEndlessCommand: (commandId: string) => stoneverseApi.issueEndlessCommand(commandId),
    equipEndlessEquipment: (equipmentId: string, stoneId: string) => stoneverseApi.equipEndlessEquipment(equipmentId, stoneId),
    unequipEndlessEquipment: (equipmentId: string, stoneId: string) => stoneverseApi.unequipEndlessEquipment(equipmentId, stoneId),
    salvageEndlessEquipment: (equipmentId: string) => stoneverseApi.salvageEndlessEquipment(equipmentId),
    setEndlessEquipmentLocked: (equipmentId: string, locked: boolean) => stoneverseApi.setEndlessEquipmentLocked(equipmentId, locked),
    updateEndlessAutoSalvage: (settings: EndlessMineViewModel['autoSalvage']) => stoneverseApi.updateEndlessLootFilter({
      ...useStoneverseStore.getState().game.endlessMine.lootFilter,
      autoSalvage: settings.enabled,
      minRarity: uiRarityToEquipment(settings.threshold),
      alwaysKeepSets: settings.protectFavorites ? ['BASTION', 'RESONANCE', 'HUNTER', 'ABYSSAL'] : [],
    }),
    processBackground: () => stoneverseApi.processBackground(),
    nextBackgroundDueAtMs: store.nextBackgroundDueAtMs,
    claimIdleReport,
    dismissIdleReport,
    inspectIdleSignal: inspectExpeditionSignal,
    readNotification: (notificationId: string) => setReadNotificationIds((current) => new Set(current).add(notificationId)),
    readAllNotifications: () => setReadNotificationIds(new Set(notifications.map((notification) => notification.id))),
    notificationAction,
    toggleFavorite: store.toggleFavorite,
    toggleLock: store.toggleLock,
    train: (id: string) => stoneverseApi.trainStone(id, 250),
    updateSettings,
    save: store.save,
    load: store.load,
    debugAction,
  };
}
