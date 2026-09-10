import { useCallback, useEffect, useMemo, useState } from 'react';
import { stoneverseApi } from './api/stoneverseApi';
import { BootSequence } from './components/BootSequence';
import { GameShell } from './components/GameShell';
import { IdleReportOverlay } from './components/IdleReportOverlay';
import { NotificationCenter } from './components/NotificationCenter';
import { StoneRevealOverlay } from './components/StoneRevealOverlay';
import { ToastStack, type GameToast } from './components/ToastStack';
import type { UiRoute } from './components/uiTypes';
import { useGameAudio } from './hooks/useGameAudio';
import { hasCompletedOnboarding, markOnboardingComplete } from './hooks/safeBrowserStorage';
import { useStoneverseGame } from './hooks/useStoneverseGame';
import { BattleScreen } from './screens/BattleScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { EndlessMineScreen } from './screens/EndlessMineScreen';
import { ExpeditionScreen } from './screens/ExpeditionScreen';
import { FacilitiesScreen } from './screens/FacilitiesScreen';
import { FusionScreen } from './screens/FusionScreen';
import { GachaScreen } from './screens/GachaScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MineScreen } from './screens/MineScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RankingScreen } from './screens/RankingScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { stoneverseStore } from './store/stoneverseStore';
import type { IdleProcessingMode } from './domain/idle';
import { BackgroundRuntimeCoordinator, type BackgroundWakeReason } from './systems/BackgroundRuntimeCoordinator';

export const backgroundProcessingMode = (
  reason: BackgroundWakeReason,
  visibilityState: DocumentVisibilityState,
): IdleProcessingMode => {
  // Timers can still fire in a throttled hidden tab. Treat every hidden wake as
  // offline so its delta is accumulated into the eventual WELCOME BACK report.
  if (visibilityState !== 'visible') return 'OFFLINE';
  return reason === 'START' || reason === 'VISIBLE' || reason === 'FOCUS' ? 'OFFLINE' : 'ACTIVE';
};

const routeMeta: Record<UiRoute, { title: string; subtitle?: string }> = {
  home: { title: 'レゾナンス・ベース', subtitle: '施設と探索状況を確認' },
  expedition: { title: '遠征ビーコン', subtitle: '編成・作戦・時間を選び、未踏領域を調査' },
  endless: { title: 'エンドレス・マイン', subtitle: '同じ戦闘エンジンで深層へ挑む' },
  facilities: { title: '共鳴育成区画', subtitle: '放置育成と研究スロットを管理' },
  mine: { title: '深層採掘区画', subtitle: '鉱脈の信号を捉えて未知の個体を発見' },
  collection: { title: '共鳴体アーカイブ', subtitle: '個体・変異・血統を記録' },
  gacha: { title: '天球共鳴召喚', subtitle: '結果は演出前に確定されます' },
  fusion: { title: '系譜配合ラボ', subtitle: '因子を継承し、新しい世代へ' },
  battle: { title: '遠征戦 / パーティ', subtitle: '3体の共鳴隊を編成' },
  profile: { title: 'Stone Account', subtitle: '戦績とコレクションを公開' },
  ranking: { title: '世界ランキング', subtitle: 'オンライン集計ステータス' },
  settings: { title: 'システム設定', subtitle: '演出・音響・データ管理' },
};

export function App() {
  const stoneverse = useStoneverseGame();
  const audio = useGameAudio(stoneverse.route, stoneverse.settings);
  const [booted, setBooted] = useState(false);
  const [toasts, setToasts] = useState<GameToast[]>([]);
  const [saveStatus, setSaveStatus] = useState(stoneverse.persistenceAvailable ? '自動保存が有効です' : 'ローカル保存を利用できません（終了時に進行が失われます）');
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const newPlayer = useMemo(() => !hasCompletedOnboarding(), []);

  const notify = useCallback((toast: Omit<GameToast, 'id'>) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}`;
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4400);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(stoneverse.settings.textScale));
    document.documentElement.classList.toggle('reduce-motion', stoneverse.settings.reducedMotion);
    document.documentElement.classList.toggle('high-contrast', stoneverse.settings.highContrast);
    document.documentElement.dataset.effectQuality = stoneverse.settings.effectQuality.toLowerCase();
  }, [stoneverse.settings]);

  useEffect(() => {
    if (stoneverse.lastError) notify({ title: '操作を完了できませんでした', detail: stoneverse.lastError, tone: 'error' });
  }, [stoneverse.lastError, notify]);

  useEffect(() => {
    setSaveStatus((current) => stoneverse.persistenceAvailable
      ? current.includes('利用できません') ? '自動保存が有効です' : current
      : 'ローカル保存を利用できません（終了時に進行が失われます）');
  }, [stoneverse.persistenceAvailable]);

  useEffect(() => {
    let processing = false;
    let scheduledDueAt = stoneverseStore.getState().nextBackgroundDueAtMs();
    const coordinator = new BackgroundRuntimeCoordinator({
      process: (reason) => {
        processing = true;
        try {
          // Lifecycle returns and hidden-tab timer wakes accumulate one bounded
          // WELCOME BACK report; foreground due work remains silent.
          const mode = backgroundProcessingMode(reason, document.visibilityState);
          stoneverseApi.processBackground(mode);
          scheduledDueAt = stoneverseStore.getState().nextBackgroundDueAtMs();
          return scheduledDueAt;
        } finally {
          processing = false;
        }
      },
      // Domain due times live on the persisted trusted timeline. Comparing them
      // with raw Date.now() after a capped clock jump would create a 0ms loop.
      scheduleNow: () => stoneverseStore.getState().game.idle.timeCheckpoint.trustedNowMs,
      onError: (error) => notify({
        title: 'バックグラウンド進行を更新できませんでした',
        detail: error instanceof Error ? error.message : '時間をおいて再試行します',
        tone: 'error',
      }),
    });
    const wakeWhenVisible = () => {
      if (document.visibilityState === 'visible') void coordinator.wake('VISIBLE');
    };
    const wakeOnFocus = () => void coordinator.wake('FOCUS');
    const unsubscribe = stoneverseStore.subscribe((state) => {
      const nextDueAt = state.nextBackgroundDueAtMs();
      if (nextDueAt === scheduledDueAt) return;
      scheduledDueAt = nextDueAt;
      if (!processing) void coordinator.wake('MANUAL');
    });
    coordinator.start();
    document.addEventListener('visibilitychange', wakeWhenVisible);
    window.addEventListener('focus', wakeOnFocus);
    window.addEventListener('pageshow', wakeOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', wakeWhenVisible);
      window.removeEventListener('focus', wakeOnFocus);
      window.removeEventListener('pageshow', wakeOnFocus);
      unsubscribe();
      coordinator.stop();
    };
  }, [notify]);

  const finishBoot = useCallback(() => {
    markOnboardingComplete();
    setBooted(true);
  }, []);

  const navigate = (route: UiRoute) => {
    stoneverse.navigate(route);
  };

  const appraise = async (id: string) => {
    const stone = await stoneverse.appraise(id);
    void audio.playCue('result.reward');
    notify({ title: `${stone.name}を鑑定しました`, detail: `${stone.rarity} / IV ${stone.potential}`, tone: stone.rarity === 'NORMAL' || stone.rarity === 'RARE' ? 'success' : 'rare' });
  };

  const train = (id: string) => {
    const before = stoneverse.stones.find((stone) => stone.id === id)?.level;
    stoneverse.train(id);
    void audio.playCue('level.up');
    const name = stoneverse.stones.find((stone) => stone.id === id)?.nickname || stoneverse.stones.find((stone) => stone.id === id)?.name || '個体';
    notify({ title: `${name}へ育成素材を使用`, detail: before ? `STONE XP +250 / LV.${before}` : 'STONE XP +250', tone: 'success' });
  };

  const save = () => {
    try {
      stoneverse.save();
      void audio.playCue('ui.confirm');
      const timestamp = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      setSaveStatus(`${timestamp} にローカル保存済み`);
      notify({ title: 'セーブが完了しました', detail: 'アトミック保存スロットへ記録しました', tone: 'success' });
    } catch {
      setSaveStatus('ローカル保存を利用できません（終了時に進行が失われます）');
    }
  };

  const load = () => {
    const loaded = stoneverse.load();
    notify(loaded ? { title: 'セーブデータを読み込みました', tone: 'info' } : { title: '読み込めるセーブがありません', detail: '現在の進行状況を維持します', tone: 'error' });
  };

  const debugAction = (action: string) => {
    void audio.playCue('ui.notification');
    notify({ title: 'Developer Action', detail: stoneverse.debugAction(action), tone: 'info' });
  };
  const mine = async () => {
    void audio.playCue('ui.confirm');
    const result = await stoneverse.mine();
    void audio.playCue('result.reward');
    return result;
  };
  const pullGacha = async (count: 1 | 10) => {
    audio.cancelSequences();
    try {
      const result = await stoneverse.pullGacha(count);
      audio.playGachaSequence(result, stoneverse.settings.reducedMotion);
      return result;
    } catch (error) {
      audio.cancelSequences();
      throw error;
    }
  };
  const fuse = async (parentIds: string[], catalyst?: string, consumeParents = false) => {
    audio.cancelSequences();
    try {
      const result = await stoneverse.fuse(parentIds, catalyst, consumeParents);
      audio.playFusionSequence(stoneverse.settings.reducedMotion);
      return result;
    } catch (error) {
      audio.cancelSequences();
      throw error;
    }
  };
  const startBattle = async () => {
    audio.cancelSequences();
    try {
      const result = await stoneverse.startBattle();
      audio.playBattleSequence();
      return result;
    } catch (error) {
      audio.cancelSequences();
      throw error;
    }
  };
  const inspectRareSignal = (signalId: string) => {
    void audio.playCue('expedition.rare-signal');
    const revealed = stoneverse.inspectExpeditionSignal(signalId);
    notify(revealed
      ? { title: 'UNKNOWN SIGNALを解析', detail: `${revealed.rarity} ${revealed.name}`, tone: 'rare' }
      : { title: 'Rare Discoveryを安全に保管', detail: '空き枠を用意するとTemporary Discovery Storageから解析できます', tone: 'info' });
  };
  const party = stoneverse.partyIds.map((id) => stoneverse.stones.find((stone) => stone.id === id)).filter((stone): stone is NonNullable<typeof stone> => Boolean(stone));

  if (!booted) return <BootSequence newPlayer={newPlayer} reducedMotion={stoneverse.settings.reducedMotion} onComplete={finishBoot} />;

  const screen = (() => {
    switch (stoneverse.route) {
      case 'expedition':
        return (
          <ExpeditionScreen
            model={stoneverse.expeditionModel}
            reducedMotion={stoneverse.settings.reducedMotion}
            onDraftChange={stoneverse.setExpeditionDraft}
            onStart={(draft) => {
              stoneverse.startExpedition(draft);
              void audio.playCue('expedition.start');
              notify({ title: '遠征隊を派遣しました', detail: '帰還後の報酬はExpedition Storageへ保管されます', tone: 'info' });
            }}
            onClaim={(expeditionId) => {
              stoneverse.claimExpedition(expeditionId);
              void audio.playCue('expedition.return');
              notify({ title: '遠征報酬を受け取りました', tone: 'success' });
            }}
            onStop={(expeditionId) => {
              stoneverse.stopExpedition(expeditionId);
              notify({ title: '帰還命令を送信しました', detail: '現在のサイクルを完了後、報酬を保持したまま帰還します', tone: 'info' });
            }}
            onInspectSignal={inspectRareSignal}
          />
        );
      case 'endless':
        return (
          <EndlessMineScreen
            model={stoneverse.endlessModel}
            reducedMotion={stoneverse.settings.reducedMotion}
            onStart={() => {
              stoneverse.startEndless();
              void audio.playCue('battle.start');
              notify({ title: 'Endless Mineへ潜行を開始', detail: '進行と戦利品はローカルセーブへ継続保存されます', tone: 'info' });
            }}
            onPauseToggle={stoneverse.pauseOrResumeEndless}
            onRetreat={() => {
              stoneverse.retreatEndless();
              void audio.playCue('endless.checkpoint');
              notify({ title: '潜行報酬を確定しました', tone: 'success' });
            }}
            onStrategyChange={stoneverse.setEndlessStrategy}
            onSpeedChange={stoneverse.setEndlessSpeed}
            onManualModeChange={stoneverse.setEndlessManual}
            onCommand={(commandId) => {
              stoneverse.issueEndlessCommand(commandId);
              void audio.playCue('battle.skill');
            }}
            onEquipmentAction={(equipmentId) => {
              const target = stoneverse.endlessModel.equipmentTargets?.[0];
              if (target) stoneverse.equipEndlessEquipment(equipmentId, target.id);
            }}
            onEquipEquipment={(equipmentId, stoneId) => {
              stoneverse.equipEndlessEquipment(equipmentId, stoneId);
              void audio.playCue('ui.confirm');
              notify({ title: '装備を更新しました', tone: 'success' });
            }}
            onUnequipEquipment={(equipmentId, stoneId) => {
              stoneverse.unequipEndlessEquipment(equipmentId, stoneId);
              notify({ title: '装備を保管庫へ戻しました', tone: 'info' });
            }}
            onSalvageEquipment={(equipmentId) => {
              const gained = stoneverse.salvageEndlessEquipment(equipmentId);
              void audio.playCue('ui.confirm');
              notify({ title: '装備を分解しました', detail: `Upgrade Material +${gained.toLocaleString()}`, tone: 'success' });
            }}
            onEquipmentLockChange={(equipmentId, locked) => {
              stoneverse.setEndlessEquipmentLocked(equipmentId, locked);
              notify({ title: locked ? '装備をロックしました' : '装備のロックを解除しました', tone: 'info' });
            }}
            onAutoSalvageChange={stoneverse.updateEndlessAutoSalvage}
          />
        );
      case 'facilities':
        return (
          <FacilitiesScreen
            stones={stoneverse.stones}
            training={stoneverse.trainingView}
            affinity={stoneverse.affinityView}
            research={stoneverse.researchView}
            researchProjects={stoneverse.researchProjects}
            onStartTraining={stoneverse.startTraining}
            onClaimTraining={() => {
              stoneverse.claimTraining();
              void audio.playCue('training.complete');
            }}
            onStopTraining={stoneverse.stopTraining}
            onStartAffinity={stoneverse.startAffinity}
            onClaimAffinity={stoneverse.claimAffinity}
            onStopAffinity={stoneverse.stopAffinity}
            onStartResearch={stoneverse.startResearch}
            onClaimResearch={(researchId) => {
              stoneverse.claimResearch(researchId);
              void audio.playCue('research.complete');
            }}
          />
        );
      case 'mine':
        return <MineScreen player={stoneverse.player} results={stoneverse.miningResults} busy={stoneverse.miningBusy} onMine={mine} onAppraise={appraise} />;
      case 'collection':
        return <CollectionScreen stones={stoneverse.stones} selectedId={stoneverse.selectedStoneId} onSelect={stoneverse.selectStone} onToggleFavorite={stoneverse.toggleFavorite} onToggleLock={stoneverse.toggleLock} onTrain={train} />;
      case 'gacha':
        return <GachaScreen tickets={stoneverse.player.tickets} pity={stoneverse.pity} stones={stoneverse.stones} recent={stoneverse.recentGacha} reducedMotion={stoneverse.settings.reducedMotion} muted={stoneverse.settings.muted} onPull={pullGacha} />;
      case 'fusion':
        return <FusionScreen stones={stoneverse.stones} facilityLevel={stoneverse.facilityLevel} catalysts={stoneverse.catalysts} reducedMotion={stoneverse.settings.reducedMotion} onFuse={fuse} />;
      case 'battle':
        return <BattleScreen stones={stoneverse.stones} partyIds={stoneverse.partyIds} battle={stoneverse.battle} reducedMotion={stoneverse.settings.reducedMotion} onSetParty={stoneverse.setParty} onStartBattle={startBattle} onAdvanceBattle={stoneverse.advanceBattle} onCommand={stoneverse.issueBattleCommand} onAutoChange={stoneverse.setBattleAuto} onSpeedChange={stoneverse.setBattleSpeed} onAbandon={stoneverse.abandonBattle} />;
      case 'profile':
        return <ProfileScreen player={stoneverse.player} stones={stoneverse.stones} showcaseIds={stoneverse.showcaseIds} onOpenStone={stoneverse.selectStone} />;
      case 'ranking':
        return <RankingScreen entries={stoneverse.rankings} category={stoneverse.rankingCategoryLabel} season="RESONANCE CYCLE 03" onCategoryChange={stoneverse.loadRankings} />;
      case 'settings':
        return <SettingsScreen settings={stoneverse.settings} online={stoneverse.online} persistenceAvailable={stoneverse.persistenceAvailable} queueCount={stoneverse.queueCount} saveStatus={saveStatus} onChange={stoneverse.updateSettings} onSave={save} onLoad={load} onDebugAction={debugAction} />;
      case 'home':
      default:
        return <HomeScreen player={stoneverse.player} stones={stoneverse.stones} party={party} missions={stoneverse.missions} expedition={stoneverse.expeditionModel.active} endless={stoneverse.endlessModel} training={stoneverse.trainingView} research={stoneverse.researchView} nextGoals={stoneverse.nextGoals} onNavigate={navigate} />;
    }
  })();

  const unreadNotifications = stoneverse.notifications.filter((notification) => !notification.read).length;

  return (
    <>
      <GameShell route={stoneverse.route} player={stoneverse.player} title={routeMeta[stoneverse.route]?.title ?? 'STONEVERSE'} subtitle={routeMeta[stoneverse.route]?.subtitle} onNavigate={navigate} online={stoneverse.online} syncCount={stoneverse.queueCount} notificationCount={unreadNotifications} onOpenNotifications={() => setNotificationCenterOpen(true)}>
        {screen}
      </GameShell>
      <IdleReportOverlay
        report={stoneverse.idleReport}
        reducedMotion={stoneverse.settings.reducedMotion}
        onClose={stoneverse.dismissIdleReport}
        onClaim={stoneverse.claimIdleReport}
        onInspectSignal={inspectRareSignal}
      />
      <NotificationCenter
        open={notificationCenterOpen}
        notifications={stoneverse.notifications}
        onClose={() => setNotificationCenterOpen(false)}
        onRead={stoneverse.readNotification}
        onReadAll={stoneverse.readAllNotifications}
        onAction={(notificationId) => {
          stoneverse.notificationAction(notificationId);
          setNotificationCenterOpen(false);
        }}
        onOpenSettings={() => {
          setNotificationCenterOpen(false);
          navigate('settings');
        }}
      />
      <StoneRevealOverlay stone={stoneverse.lastReveal} reducedMotion={stoneverse.settings.reducedMotion} onClose={() => { stoneverse.clearReveal(); navigate('collection'); }} />
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </>
  );
}
