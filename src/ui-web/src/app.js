(() => {
  'use strict';

  const UI_SCHEMA = 1;
  const FRAMEWORK7_VERSION = '9.1.3';
  const VALID_PAGES = new Set(['overview', 'stone', 'vehicle', 'routes', 'settings', 'update']);
  const VALID_MODES = new Set(['mining', 'washing', 'gold']);
  const VALID_TONES = new Set([
    'neutral', 'muted', 'success', 'warning', 'error', 'danger', 'accent', 'progress',
  ]);
  const query = new URLSearchParams(window.location.search);
  const fixtureToken = query.get('fixture');
  const fixtureMode = fixtureToken === '1' || fixtureToken === 'host';
  const hostBackedMetaFixture = fixtureToken === 'host';
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const modeDetails = {
    mining: {
      label: '鉱石を採掘する',
      subtitle: '進捗完了と次の石の準備を検知して続けます',
      primaryMetric: '採掘回数',
      correctionMetric: '食事回数',
    },
    washing: {
      label: '石を洗う',
      subtitle: '進捗完了後に1度だけ補正し、次の対象の準備を検知します',
      primaryMetric: '石洗い回数',
      correctionMetric: '後退補正',
    },
    gold: {
      label: '砂金採りトレイ',
      subtitle: '進捗完了と次の対象の準備を検知して続けます',
      primaryMetric: '砂金採り回数',
      correctionMetric: '位置補正',
    },
  };

  const baseState = {
    type: 'state',
    revision: 0,
    version: '',
    page: 'overview',
    running: false,
    registrationActive: false,
    actionMode: 'mining',
    windowVisible: true,
    controls: {},
  };

  const fixtureState = {
    ...baseState,
    revision: 1,
    version: '9.1.10',
    controls: {
      overviewSubtitle: { text: modeDetails.gold.subtitle },
      runStatus: { text: '停止中', tone: 'neutral' },
      connection: { text: '接続済み', tone: 'success' },
      operationMode: { text: 'バックグラウンド' },
      runButton: { text: '自動操作を開始', enabled: true, tone: 'accent' },
      metricPrimaryLabel: { text: '砂金採り回数' },
      metricPrimaryValue: { text: '22回', value: 22 },
      metricCorrectionLabel: { text: '位置補正' },
      metricCorrectionValue: { text: '0回', value: 0 },
      metricStorageValue: { text: '0回', value: 0 },
      shortcut: { text: '開始 F8 · 停止 F9' },
      vehicleStatus: { text: '未登録', tone: 'neutral' },
      vehicleEnabled: { value: false, enabled: true },
      capacity: { text: '開始後に確認', value: 0 },
      capacityDetail: { text: '残り2,000g以下で自動収納します' },
      companionStatus: { text: '待機中', tone: 'neutral' },
      companionDetail: { text: '登録を押したあと、FiveMで目的の車両ストレージを一度開いてください。' },
      vehicleRegister: { text: '車両登録を開始', enabled: true },
      vehicleDelete: { text: '登録を削除', enabled: false },
      startHotkey: { value: 'F8', enabled: true },
      stopHotkey: { value: 'F9', enabled: true },
      backgroundMode: { value: true, enabled: true },
      hideWhileRunning: { value: true, enabled: true },
      correctionEnabled: { value: true, enabled: true },
      autoEat: { value: true, enabled: true },
      foodKey: { value: 1, enabled: true },
      autoCheckUpdates: { value: true, enabled: true },
      minimumFreeWeight: { value: 2000, enabled: true },
      storageTriggerPercent: { value: 92, enabled: true },
      estimatedRewardWeight: { value: 2000, enabled: true },
      minimumFreeSlots: { value: 1, enabled: true },
      storageMaxRetries: { value: 5, enabled: true },
      farmWatchdogMs: { value: 60000, enabled: true },
      targetLostRecoveryMs: { value: 15000, enabled: true },
      debugOverlay: { value: false, enabled: true },
      settingsSave: { text: '設定を保存', enabled: true },
      settingsFeedback: { text: '', tone: 'neutral' },
      updateStatus: { text: '最新です', tone: 'success' },
      updateIntegrity: { text: 'ECDSA署名とSHA-256を確認してから適用します。' },
      updateButton: { text: 'アップデートを確認', enabled: true },
      updateFeedback: { text: '', tone: 'neutral' },
      updateAvailable: { value: false },
    },
    actionMode: 'gold',
  };

  let state = fixtureMode ? clone(fixtureState) : clone(baseState);
  if (fixtureMode && VALID_PAGES.has(query.get('page'))) state.page = query.get('page');
  if (fixtureMode && query.get('running') === '1') {
    state.running = true;
    state.controls.runStatus = { text: '実行中', tone: 'success' };
    state.controls.runButton = { text: '自動操作を停止', enabled: true };
  }
  let currentPage = 'overview';
  let lastRevision = -1;
  let lastPickerFocus = null;
  let pickerKind = '';
  let runPendingRevision = null;
  let settingsPendingRevision = null;
  let updatePendingRevision = null;
  let vehiclePendingRevision = null;
  let pendingTimeouts = new Map();
  let settingsDirty = new Set();
  let lastFeedback = { settings: '', update: '' };
  const sentActions = [];
  let hostReady = fixtureMode;
  let resolveHostReady = null;
  const hostReadyPromise = fixtureMode ? Promise.resolve() : new Promise((resolve) => {
    resolveHostReady = resolve;
  });

  const app = new Framework7({
    el: '#app',
    name: 'AI採掘機',
    id: 'jp.ai-miner.desktop',
    theme: 'ios',
    darkMode: false,
    touch: {
      fastClicks: true,
    },
    dialog: {
      title: 'AI採掘機',
      buttonOk: 'OK',
      buttonCancel: 'キャンセル',
    },
  });

  const elements = Object.fromEntries([
    'app-version', 'overview-subtitle', 'run-status', 'connection-status', 'operation-mode',
    'action-picker-button', 'action-value', 'run-button', 'run-button-label', 'run-icon-use',
    'metric-primary-label', 'metric-primary-value', 'metric-correction-label',
    'metric-correction-value', 'metric-storage-value', 'shortcut-hint', 'vehicle-status',
    'vehicle-enabled', 'capacity-value', 'capacity-fill', 'capacity-detail',
    'companion-status', 'companion-detail', 'vehicle-register', 'vehicle-register-label',
    'vehicle-delete', 'vehicle-route', 'overview-route', 'overview-route-summary',
    'route-mode-hint', 'route-feedback', 'route-register', 'route-teach', 'route-trial', 'route-stationary',
    'route-enable', 'route-return-home', 'route-voice', 'start-hotkey', 'stop-hotkey', 'setting-background', 'setting-hide',
    'setting-correction', 'setting-auto-eat', 'food-key', 'setting-auto-update',
    'minimum-free-weight', 'storage-trigger-percent', 'estimated-reward-weight',
    'minimum-free-slots', 'storage-max-retries', 'farm-watchdog-seconds',
    'target-lost-recovery-seconds', 'setting-debug-overlay', 'settings-save',
    'settings-save-label', 'settings-feedback', 'current-version', 'update-status',
    'update-integrity', 'update-check', 'update-check-label', 'update-feedback',
    'update-badge', 'sidebar-connection', 'sidebar-connection-dot', 'stoneverse-launch', 'action-popover',
    'action-sheet', 'live-region', 'stone-return-button', 'stone-meta-root',
  ].map((id) => [toCamel(id), document.getElementById(id)]));

  const nav = [...document.querySelectorAll('.sidebar-item[data-page]')];
  const screens = new Map(
    [...document.querySelectorAll('.screen[data-page]')].map((screen) => [screen.dataset.page, screen]),
  );
  const indicator = document.querySelector('.sidebar-selection');
  const actionButton = elements.actionPickerButton;

  elements.stoneverseLaunch?.addEventListener('click', () => {
    window.location.assign('stoneverse/index.html?host=ai-miner');
  });

  const actionSheet = app.sheet.create({
    el: elements.actionSheet,
    backdrop: true,
    closeByBackdropClick: true,
    closeOnEscape: true,
    swipeToClose: true,
    swipeHandler: '.sheet-handle',
    on: {
      open: () => onPickerOpening('sheet'),
      opened: focusSelectedPickerOption,
      closed: onPickerClosed,
    },
  });

  const actionPopover = app.popover.create({
    el: elements.actionPopover,
    targetEl: actionButton,
    backdrop: true,
    closeByBackdropClick: true,
    closeByOutsideClick: true,
    closeOnEscape: true,
    on: {
      open: () => onPickerOpening('popover'),
      opened: focusSelectedPickerOption,
      closed: onPickerClosed,
    },
  });

  createPickerOptions();
  wireEvents();
  observeStoneLayers();
  applyState(state, { force: true, animate: false });
  requestAnimationFrame(() => {
    updateSelectionIndicator(false);
    sendAction('hello', {
      schema: UI_SCHEMA,
      framework: 'Framework7',
      frameworkVersion: FRAMEWORK7_VERSION,
      fixture: fixtureMode,
    });
    if (fixtureMode && query.get('picker') === '1') setTimeout(openActionPicker, 40);
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toCamel(id) {
    return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function normalizeMessage(value) {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value && typeof value === 'object' ? value : null;
  }

  function control(...keys) {
    for (const key of keys) {
      const value = state.controls?.[key];
      if (value && typeof value === 'object') return value;
    }
    return {};
  }

  function hasControl(key) {
    const value = state.controls?.[key];
    return Boolean(value && typeof value === 'object');
  }

  function textOf(item, fallback = '') {
    if (item.text !== undefined && item.text !== null) return String(item.text);
    if (item.value !== undefined && item.value !== null && typeof item.value !== 'boolean') {
      return String(item.value);
    }
    return fallback;
  }

  function enabledOf(item, fallback = true) {
    return typeof item.enabled === 'boolean' ? item.enabled : fallback;
  }

  function booleanOf(item, fallback = false) {
    if (typeof item.value === 'boolean') return item.value;
    if (item.value === 1 || item.value === '1' || item.value === 'true') return true;
    if (item.value === 0 || item.value === '0' || item.value === 'false') return false;
    return fallback;
  }

  function toneOf(item, fallback = 'neutral') {
    const tone = String(item.tone || fallback).toLowerCase();
    return VALID_TONES.has(tone) ? tone : fallback;
  }

  function effectiveTone(item, visibleText, fallback = 'neutral') {
    const explicit = String(item.tone || '').toLowerCase();
    if (VALID_TONES.has(explicit)) return explicit;
    const text = String(visibleText || '');
    if (/失敗|エラー|未接続|切断|見つかりません|できません|無効/.test(text)) return 'error';
    if (/接続済み|登録済み|実行中|完了|最新/.test(text)) return 'success';
    if (/新しいバージョン|不足|注意|警告/.test(text)) return 'warning';
    if (/確認中|応答待ち|取り込み|登録する車両|ダウンロード中|検証中|移動しています/.test(text)) {
      return 'progress';
    }
    return fallback;
  }

  function cleanLegacyText(value, prefixes = []) {
    let result = String(value ?? '').replace(/^\s*[●•]\s*/, '').trim();
    for (const prefix of prefixes) {
      result = result.replace(new RegExp(`^${prefix}[\\s　:：・·-]*`, 'i'), '').trim();
    }
    return result;
  }

  function splitLegacyMetric(item) {
    const parts = textOf(item).replace(/\r/g, '').split('\n');
    if (parts.length < 2) return { label: '', value: '' };
    return {
      label: parts.shift().trim(),
      value: parts.join(' ').trim(),
    };
  }

  function localVehicleDetail(item) {
    return textOf(item) || '荷台を登録後、「徒歩ルート・音声設定」で往復を教え、自動試走してください。サーバー導入は不要です。';
  }

  function setTone(element, tone) {
    if (!element) return;
    for (const validTone of VALID_TONES) element.classList.remove(`tone-${validTone}`);
    element.classList.add(`tone-${VALID_TONES.has(tone) ? tone : 'neutral'}`);
  }

  function setText(element, next, animate = true) {
    if (!element) return false;
    const text = next === undefined || next === null ? '' : String(next);
    if (element.textContent === text) return false;
    element.textContent = text;
    if (animate && state.windowVisible !== false && !reduceMotionQuery.matches && element.isConnected) {
      element.getAnimations().forEach((animation) => animation.cancel());
      element.animate(
        [
          { opacity: 0.42, transform: 'translateY(2px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 170, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    }
    return true;
  }

  function updateInput(element, item, dirtyKey) {
    if (!element || settingsDirty.has(dirtyKey)) return;
    const next = item.value ?? item.text;
    if (next !== undefined && next !== null && element.value !== String(next)) {
      element.value = String(next);
    }
    element.disabled = !enabledOf(item);
  }

  function updateSwitch(element, item, dirtyKey = '') {
    if (!element || (dirtyKey && settingsDirty.has(dirtyKey))) return;
    element.checked = booleanOf(item, element.checked);
    element.disabled = !enabledOf(item);
  }

  function updateDurationInput(element, item, dirtyKey) {
    if (!element || settingsDirty.has(dirtyKey)) return;
    const milliseconds = Number(item.value ?? item.text);
    if (Number.isFinite(milliseconds)) {
      const seconds = Math.round(milliseconds / 1000);
      if (element.value !== String(seconds)) element.value = String(seconds);
    }
    element.disabled = !enabledOf(item);
  }

  function applyState(nextState, options = {}) {
    const message = normalizeMessage(nextState);
    if (!message || message.type !== 'state') return false;

    const revision = Number.isFinite(Number(message.revision)) ? Number(message.revision) : 0;
    if (!options.force && revision < lastRevision) return false;
    if (!options.force && revision === lastRevision && message === state) return true;

    const previousRevision = lastRevision;
    lastRevision = Math.max(lastRevision, revision);
    state = {
      ...baseState,
      ...message,
      revision,
      controls: message.controls && typeof message.controls === 'object' ? message.controls : {},
      page: VALID_PAGES.has(message.page) ? message.page : currentPage,
      actionMode: VALID_MODES.has(message.actionMode) ? message.actionMode : 'mining',
    };

    if (settingsPendingRevision !== null && revision > settingsPendingRevision) {
      settingsPendingRevision = null;
      settingsDirty.clear();
      clearPending(elements.settingsSave, 'settings');
    }
    if (runPendingRevision !== null && revision > runPendingRevision) {
      runPendingRevision = null;
      clearPending(elements.runButton, 'run');
    }
    if (updatePendingRevision !== null && revision > updatePendingRevision) {
      updatePendingRevision = null;
      clearPending(elements.updateCheck, 'update');
    }
    if (vehiclePendingRevision !== null && revision > vehiclePendingRevision) {
      vehiclePendingRevision = null;
      clearPending(elements.vehicleRegister, 'vehicle');
    }

    document.body.classList.toggle('window-hidden', state.windowVisible === false);
    renderOverview(options.animate !== false && previousRevision >= 0);
    renderVehicle(options.animate !== false && previousRevision >= 0);
    renderRoutes();
    renderSettings(options.animate !== false && previousRevision >= 0);
    renderUpdate(options.animate !== false && previousRevision >= 0);
    updatePickerSelection();
    switchPage(state.page, { animate: options.animate !== false, send: false });
    return true;
  }

  function renderOverview(animate) {
    const details = modeDetails[state.actionMode];
    const subtitle = control('overviewSubtitle', 'tagline');
    const runStatus = control('runStatus', 'status', 'statusLabel');
    const connection = control('connection', 'connectionStatus', 'connectionLabel');
    const operationMode = control('operationMode', 'mode', 'modeLabel');
    const runButton = control('runButton', 'mainButton');
    const primaryLabel = control('metricPrimaryLabel');
    const primaryValue = control('metricPrimaryValue', 'successes');
    const correctionLabel = control('metricCorrectionLabel', 'correctionLabel');
    const correctionValue = control('metricCorrectionValue', 'nudges');
    const storageValue = control('metricStorageValue', 'storageTrips');
    const shortcut = control('shortcut', 'footer', 'footerLabel');
    const legacyPrimary = splitLegacyMetric(control('countLabel'));
    const legacyCorrection = splitLegacyMetric(control('mealLabel'));
    const legacyStorage = splitLegacyMetric(control('vehicleTripLabel'));
    const connectionText = cleanLegacyText(textOf(connection, '確認中'), ['FiveM']);
    const operationText = cleanLegacyText(textOf(operationMode, '確認中'), ['操作']);

    setText(elements.appVersion, state.version ? `v${state.version}` : '接続待機中', animate);
    setText(elements.overviewSubtitle, textOf(subtitle, details.subtitle), animate);
    setText(
      elements.runStatus,
      cleanLegacyText(textOf(
        runStatus,
        state.running ? '実行中' : state.registrationActive ? '車両登録中' : '停止中',
      )),
      animate,
    );
    setTone(
      elements.runStatus,
      effectiveTone(runStatus, elements.runStatus.textContent, state.running ? 'success' : 'neutral'),
    );
    setText(elements.connectionStatus, connectionText, animate);
    setTone(elements.connectionStatus, effectiveTone(connection, connectionText));
    setText(elements.sidebarConnection, connectionText, animate);
    setTone(elements.sidebarConnectionDot, effectiveTone(connection, connectionText));
    setText(elements.operationMode, operationText, animate);
    setText(elements.actionValue, details.label, animate);

    const runLabel = textOf(runButton, state.running ? '自動操作を停止' : '自動操作を開始');
    setText(elements.runButtonLabel, runLabel, animate);
    elements.runIconUse.setAttribute('href', state.running ? '#icon-stop' : '#icon-play');
    elements.runButton.classList.toggle('is-running', state.running);
    elements.runButton.disabled = !enabledOf(runButton);
    elements.runButton.setAttribute('aria-busy', elements.runButton.classList.contains('is-pending') ? 'true' : 'false');
    actionButton.disabled = !enabledOf(control('actionPicker', 'actionControl'), !state.running);

    setText(elements.metricPrimaryLabel, textOf(primaryLabel, legacyPrimary.label || details.primaryMetric), animate);
    setText(
      elements.metricPrimaryValue,
      formatCount(hasControl('metricPrimaryValue') || hasControl('successes')
        ? primaryValue : { text: legacyPrimary.value }),
      animate,
    );
    setText(
      elements.metricCorrectionLabel,
      textOf(correctionLabel, legacyCorrection.label || details.correctionMetric),
      animate,
    );
    setText(
      elements.metricCorrectionValue,
      formatCount(hasControl('metricCorrectionValue') || hasControl('nudges')
        ? correctionValue : { text: legacyCorrection.value }),
      animate,
    );
    setText(
      elements.metricStorageValue,
      formatCount(hasControl('metricStorageValue') || hasControl('storageTrips')
        ? storageValue : { text: legacyStorage.value }),
      animate,
    );
    setText(elements.shortcutHint, textOf(shortcut, '開始 F8 · 停止 F9'), animate);
  }

  function renderRoutes() {
    const route = state.routes || {};
    const phaseLabels = {
      departure: '収納先への移動／近接確認を開始。収納はまだ確認していません。',
      truck_arrived: '登録した荷台IDを確認。収納結果を確認中。',
      deposit_verified: '収納結果を確認済み。まだ帰還・作業再開は未確認。',
      refill_verified: '未洗浄石の補充を確認済み。帰還を確認中。',
      work_arrived: '帰還と作業対象を確認。次の実報酬を待っています。',
      resumed_verified: '収納・必要な補充・帰還・次の実報酬まで確認しました。',
      stopped: '途中で停止。収納サイクル完了とは扱いません。',
    };
    document.getElementById('route-wash-position').textContent = route.washFeedback
      || '未計測。FiveMを前面にして石洗いを開始してください。';
    const cycle = route.cycle;
    const evidenceText = cycle ? phaseLabels[cycle.phase] || '未確認の実行状態です。' : 'まだ実行記録はありません。試走では収納しません。';
    document.getElementById('route-cycle-status').textContent = evidenceText + (cycle?.reason ? ` 理由：${cycle.reason}` : '');
    const busy = Boolean(state.running || state.registrationActive || route.busy);
    const hasVehicle = route.hasVehicle === true;
    const recorded = route.recorded === true;
    const trial = route.trialSaved === true;
    const stationary = route.method === 'stationary';
    const enabled = booleanOf(control('vehicleEnabled', 'vehicleEnabledControl'));
    const statuses = [
      ['vehicle', hasVehicle, hasVehicle ? '荷台登録済み' : '未登録'],
      ['record', recorded, recorded ? (stationary ? '近接モード' : '往復記録あり') : '未設定'],
      ['trial', trial, trial ? (stationary ? '近接確認済み' : '前回の試走記録あり') : '未確認'],
      ['enable', enabled, enabled ? 'ON（開始時再確認）' : 'OFF'],
    ];
    for (const [name, done, text] of statuses) {
      document.getElementById(`route-step-${name}`).classList.toggle('is-done', done);
      document.getElementById(`route-${name === 'enable' ? 'enabled' : name}-badge`).textContent = text;
    }
    document.querySelectorAll('[data-route-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.routeMode === state.actionMode));
      button.disabled = busy;
    });
    setText(elements.routeModeHint, `現在の設定対象：${modeDetails[state.actionMode].label}。方式：${stationary ? '近接収納（歩かない）' : '徒歩ルート'}。作業ごとに別保存です。`, false);
    setText(elements.routeFeedback, route.feedback || (busy
      ? '作業または登録中です。中止はF9。終了後に設定を変更できます。'
      : '上から順番に設定してください。荷台の登録だけでは徒歩移動は有効になりません。'), false);
    setText(elements.overviewRouteSummary, trial ? (stationary ? '近接収納の確認済み · 移動せず毎回荷台を確認' : '往復の試走記録あり · 接続は開始時に再確認') : recorded ? '往復記録あり · 次は自動試走' : '未設定 · 車両登録 → 往復記録 → 自動試走', false);
    elements.routeRegister.disabled = busy;
    elements.routeTeach.disabled = busy || !hasVehicle;
    elements.routeStationary.disabled = busy || !hasVehicle;
    elements.routeTrial.textContent = stationary ? '近接状態を再確認（収納なし）' : '自動試走を開始（収納なし）';
    elements.routeTrial.disabled = busy || !recorded || !hasVehicle;
    elements.routeEnable.disabled = busy || (!enabled && (!trial || !hasVehicle));
    elements.routeEnable.textContent = enabled ? '自動収納・補充をOFF' : '自動収納・補充をON';
    elements.routeVoice.disabled = busy;
  }

  function renderVehicle(animate) {
    const vehicleStatus = control('vehicleStatus', 'vehicleStatusLabel');
    const vehicleEnabled = control('vehicleEnabled', 'vehicleEnabledControl');
    const capacity = control('capacity', 'capacityStatusLabel');
    const capacityProgress = control('capacityProgress', 'capacity');
    const capacityDetail = control('capacityDetail', 'capacityDetailLabel');
    const companionStatus = control('companionStatus', 'captureStatus', 'routeStatusLabel');
    const companionDetail = control('companionDetail', 'captureDetail', 'routeDetailLabel');
    const register = control('vehicleRegister', 'vehicleRegisterButton');
    const remove = control('vehicleDelete', 'vehicleDeleteButton');

    setText(elements.vehicleStatus, textOf(vehicleStatus, '未登録'), animate);
    setTone(elements.vehicleStatus, effectiveTone(vehicleStatus, elements.vehicleStatus.textContent));
    updateSwitch(elements.vehicleEnabled, vehicleEnabled);
    setText(
      elements.capacityValue,
      cleanLegacyText(textOf(capacity, '開始後に確認'), ['所持重量']),
      animate,
    );
    setText(elements.capacityDetail, textOf(capacityDetail, '重量を優先して安全に確認します'), animate);
    const capacityPercent = Math.max(0, Math.min(100, Number(capacityProgress.value) || 0));
    elements.capacityFill.style.width = `${capacityPercent}%`;
    setText(
      elements.companionStatus,
      cleanLegacyText(textOf(companionStatus, '待機中'), ['ゲーム内連携', 'ローカル取り込み']),
      animate,
    );
    setTone(
      elements.companionStatus,
      effectiveTone(companionStatus, elements.companionStatus.textContent),
    );
    setText(elements.companionDetail, localVehicleDetail(companionDetail), animate);
    setText(elements.vehicleRegisterLabel, textOf(register, '車両登録を開始'), animate);
    elements.vehicleRegister.disabled = !enabledOf(register);
    setText(elements.vehicleDelete, textOf(remove, '登録を削除'), animate);
    elements.vehicleDelete.disabled = !enabledOf(remove, false);
  }

  function renderSettings(animate) {
    updateInput(elements.startHotkey, control('startHotkey', 'startHotkeyControl'), 'startHotkey');
    updateInput(elements.stopHotkey, control('stopHotkey', 'stopHotkeyControl'), 'stopHotkey');
    updateSwitch(elements.settingBackground, control('backgroundMode', 'backgroundControl'), 'backgroundMode');
    updateSwitch(elements.settingHide, control('hideWhileRunning', 'hideControl'), 'hideWhileRunning');
    updateSwitch(
      elements.settingCorrection,
      control('correctionEnabled', 'washCorrectionControl'),
      'correctionEnabled',
    );
    updateSwitch(elements.settingAutoEat, control('autoEat', 'autoEatControl'), 'autoEat');
    updateInput(elements.foodKey, control('foodKey', 'foodKeyControl'), 'foodKey');
    updateSwitch(elements.settingAutoUpdate, control('autoCheckUpdates', 'autoUpdateControl'), 'autoCheckUpdates');
    updateInput(
      elements.minimumFreeWeight,
      control('minimumFreeWeight', 'minimumFreeWeightControl'),
      'minimumFreeWeight',
    );
    updateInput(elements.storageTriggerPercent, control('storageTriggerPercent'), 'storageTriggerPercent');
    updateInput(elements.estimatedRewardWeight, control('estimatedRewardWeight'), 'estimatedRewardWeight');
    updateInput(elements.minimumFreeSlots, control('minimumFreeSlots'), 'minimumFreeSlots');
    updateInput(elements.storageMaxRetries, control('storageMaxRetries'), 'storageMaxRetries');
    updateDurationInput(elements.farmWatchdogSeconds, control('farmWatchdogMs'), 'farmWatchdogMs');
    updateDurationInput(
      elements.targetLostRecoverySeconds,
      control('targetLostRecoveryMs'),
      'targetLostRecoveryMs',
    );
    updateSwitch(elements.settingDebugOverlay, control('debugOverlay'), 'debugOverlay');

    const save = control('settingsSave', 'settingsButton');
    const feedback = control('settingsFeedback', 'settingsErrorLabel');
    setText(elements.settingsSaveLabel, textOf(save, '設定を保存'), animate);
    elements.settingsSave.disabled = !enabledOf(save);
    setText(elements.settingsFeedback, textOf(feedback), animate);
    setTone(
      elements.settingsFeedback,
      effectiveTone(feedback, elements.settingsFeedback.textContent),
    );
    announceFeedback('settings', feedback);
  }

  function renderUpdate(animate) {
    const status = control('updateStatus', 'updatePageStatus');
    const integrity = control('updateIntegrity');
    const button = control('updateButton');
    const feedback = control('updateFeedback');
    const available = control('updateAvailable');
    const currentVersion = control('currentVersion', 'currentVersionLabel');
    const legacyNav = control('navUpdate');

    setText(
      elements.currentVersion,
      state.version ? `v${state.version}` : textOf(currentVersion, '—'),
      animate,
    );
    setText(elements.updateStatus, textOf(status, '未確認'), animate);
    setTone(elements.updateStatus, effectiveTone(status, elements.updateStatus.textContent));
    setText(elements.updateIntegrity, textOf(integrity, 'ECDSA署名とSHA-256を確認してから適用します。'), animate);
    setText(elements.updateCheckLabel, textOf(button, 'アップデートを確認'), animate);
    elements.updateCheck.disabled = !enabledOf(button);
    setText(elements.updateFeedback, textOf(feedback), animate);
    setTone(elements.updateFeedback, effectiveTone(feedback, elements.updateFeedback.textContent));
    elements.updateBadge.hidden = !(booleanOf(available) || /[•●]/.test(textOf(legacyNav)));
    announceFeedback('update', feedback);
  }

  function formatCount(item) {
    const text = textOf(item);
    if (text) return /回$/.test(text) ? text : `${text}回`;
    return '0回';
  }

  function announceFeedback(channel, feedback) {
    const text = textOf(feedback);
    if (!text || lastFeedback[channel] === text) return;
    lastFeedback[channel] = text;
    const tone = effectiveTone(feedback, text);
    setText(elements.liveRegion, text, false);
    if (tone === 'success') {
      app.toast.create({ text, closeTimeout: 2200, position: 'center' }).open();
    }
  }

  function showSettingsValidation(message, element) {
    setText(elements.settingsFeedback, message);
    setTone(elements.settingsFeedback, 'error');
    element?.focus();
  }

  function createPickerOptions() {
    const template = document.getElementById('action-option-template');
    document.querySelectorAll('[data-picker-list]').forEach((list) => {
      for (const [mode, details] of Object.entries(modeDetails)) {
        const option = template.content.firstElementChild.cloneNode(true);
        option.dataset.mode = mode;
        option.querySelector('.picker-option-label').textContent = details.label;
        option.addEventListener('click', () => chooseActionMode(mode));
        list.append(option);
      }
    });
  }

  function updatePickerSelection() {
    document.querySelectorAll('.picker-option').forEach((option) => {
      const selected = option.dataset.mode === state.actionMode;
      option.classList.toggle('is-selected', selected);
      option.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
  }

  function openActionPicker() {
    if (actionButton.disabled) return;
    lastPickerFocus = document.activeElement instanceof HTMLElement ? document.activeElement : actionButton;
    if (window.matchMedia('(max-width: 699px)').matches) {
      actionSheet.open();
    } else {
      actionPopover.open(actionButton);
    }
  }

  function closeActionPicker() {
    if (actionSheet.opened) actionSheet.close();
    if (actionPopover.opened) actionPopover.close();
  }

  function onPickerOpening(kind) {
    pickerKind = kind;
    actionButton.setAttribute('aria-expanded', 'true');
  }

  function focusSelectedPickerOption() {
    const container = pickerKind === 'sheet' ? elements.actionSheet : elements.actionPopover;
    const selected = container.querySelector('.picker-option.is-selected');
    (selected || container.querySelector('.picker-option'))?.focus({ preventScroll: true });
  }

  function onPickerClosed() {
    pickerKind = '';
    actionButton.setAttribute('aria-expanded', 'false');
    const target = lastPickerFocus;
    lastPickerFocus = null;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }

  function chooseActionMode(mode) {
    if (!VALID_MODES.has(mode)) return;
    sendAction('action.select', { mode });
    closeActionPicker();
  }

  function switchPage(page, options = {}) {
    if (!VALID_PAGES.has(page)) return false;
    const next = screens.get(page);
    const previous = screens.get(currentPage);
    const changed = currentPage !== page;
    currentPage = page;
    document.body.classList.toggle('stone-page-active', page === 'stone');

    nav.forEach((item) => {
      const selected = item.dataset.page === page;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.tabIndex = selected ? 0 : -1;
    });
    updateSelectionIndicator(options.animate !== false);

    if (!changed) {
      next.classList.add('is-active');
      next.removeAttribute('aria-hidden');
      return true;
    }

    for (const screen of screens.values()) {
      screen.getAnimations().forEach((animation) => animation.cancel());
      screen.classList.remove('is-transitioning');
      if (screen !== previous && screen !== next) {
        screen.classList.remove('is-active');
        screen.setAttribute('aria-hidden', 'true');
      }
    }

    previous.classList.remove('is-active');
    previous.classList.add('is-transitioning');
    previous.setAttribute('aria-hidden', 'true');
    next.classList.add('is-active');
    next.removeAttribute('aria-hidden');
    window.dispatchEvent(new CustomEvent('ai-miner:pagechange', {
      detail: { page, previousPage: previous.dataset.page },
    }));

    const shouldAnimate = options.animate !== false && !reduceMotionQuery.matches && state.windowVisible !== false;
    if (!shouldAnimate) {
      previous.classList.remove('is-transitioning');
    } else {
      const outgoing = previous.animate(
        [
          { opacity: 1, transform: 'translateX(0)' },
          { opacity: 0, transform: 'translateX(-5px)' },
        ],
        { duration: 170, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
      );
      next.animate(
        [
          { opacity: 0, transform: 'translateX(6px)' },
          { opacity: 1, transform: 'translateX(0)' },
        ],
        { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
      outgoing.addEventListener('finish', () => {
        if (currentPage !== previous.dataset.page) previous.classList.remove('is-transitioning');
      }, { once: true });
      outgoing.addEventListener('cancel', () => {
        if (currentPage !== previous.dataset.page) previous.classList.remove('is-transitioning');
      }, { once: true });
    }

    if (options.send) sendAction('nav', { page });
    return true;
  }

  function returnFromStone() {
    if (currentPage !== 'stone') return false;
    if (stoneTransientLayerIsOpen()) return false;
    const returned = switchPage('overview', { animate: true, send: true });
    requestAnimationFrame(() => {
      nav.find((item) => item.dataset.page === 'overview')?.focus({ preventScroll: true });
    });
    return returned;
  }

  function stoneTransientLayerIsOpen() {
    if (!elements.stoneMetaRoot) return false;
    return [
      '[data-cinematic]:not([hidden])',
      '[data-modal-layer]:not([hidden])',
      '[data-debug-panel]:not([hidden])',
      '[data-onboarding]:not([hidden])',
      '.meta-progression-event',
      '.meta-event-toast',
    ].some((selector) => Boolean(elements.stoneMetaRoot.querySelector(selector)));
  }

  function syncStoneReturnAvailability() {
    const blocked = stoneTransientLayerIsOpen();
    elements.stoneReturnButton.hidden = blocked;
    elements.stoneReturnButton.setAttribute('aria-hidden', blocked ? 'true' : 'false');
    elements.stoneReturnButton.tabIndex = blocked ? -1 : 0;
  }

  function observeStoneLayers() {
    syncStoneReturnAvailability();
    const observer = new MutationObserver(syncStoneReturnAvailability);
    observer.observe(elements.stoneMetaRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden', 'open'],
    });
  }

  function updateSelectionIndicator(animate = true) {
    const selected = nav.find((item) => item.dataset.page === currentPage);
    if (!selected || !indicator) return;
    const navRect = selected.parentElement.getBoundingClientRect();
    const itemRect = selected.getBoundingClientRect();
    if (!animate) indicator.style.transitionDuration = '0ms';
    indicator.style.width = `${itemRect.width}px`;
    indicator.style.height = `${itemRect.height}px`;
    indicator.style.transform = `translate3d(${itemRect.left - navRect.left + selected.parentElement.scrollLeft}px, ${itemRect.top - navRect.top}px, 0)`;
    indicator.classList.add('is-ready');
    if (!animate) requestAnimationFrame(() => indicator.style.removeProperty('transition-duration'));
  }

  function setPending(element, key, revision) {
    if (!element) return;
    clearTimeout(pendingTimeouts.get(key));
    element.classList.add('is-pending');
    element.setAttribute('aria-busy', 'true');
    pendingTimeouts.set(key, setTimeout(() => clearPending(element, key), 6000));
    if (key === 'run') runPendingRevision = revision;
    if (key === 'settings') settingsPendingRevision = revision;
    if (key === 'update') updatePendingRevision = revision;
    if (key === 'vehicle') vehiclePendingRevision = revision;
  }

  function clearPending(element, key) {
    clearTimeout(pendingTimeouts.get(key));
    pendingTimeouts.delete(key);
    element?.classList.remove('is-pending');
    element?.setAttribute('aria-busy', 'false');
  }

  function sendAction(action, payload = {}) {
    const message = { type: 'action', action, payload };
    sentActions.push(clone(message));
    if (sentActions.length > 100) sentActions.shift();

    // Fixture state is owned by the frontend, including when it is hosted in a
    // real WebView2 window. Posting the message as well keeps IPC observable.
    if (fixtureMode) handleFixtureAction(action, payload);
    if (window.chrome?.webview?.postMessage) {
      window.chrome.webview.postMessage(message);
    }
    return message;
  }

  function handleFixtureAction(action, payload) {
    if (action === 'hello' || action === 'smoke.result') return;
    const next = clone(state);
    next.revision += 1;
    if (action === 'nav' && VALID_PAGES.has(payload.page)) next.page = payload.page;
    if (action === 'action.select' && VALID_MODES.has(payload.mode)) {
      next.actionMode = payload.mode;
      next.controls.overviewSubtitle = { text: modeDetails[payload.mode].subtitle };
      next.controls.metricPrimaryLabel = { text: modeDetails[payload.mode].primaryMetric };
      next.controls.metricCorrectionLabel = { text: modeDetails[payload.mode].correctionMetric };
    }
    if (action === 'run.toggle') {
      next.running = !next.running;
      next.controls.runStatus = {
        text: next.running ? '実行中' : '停止中',
        tone: next.running ? 'success' : 'neutral',
      };
      next.controls.runButton = {
        text: next.running ? '自動操作を停止' : '自動操作を開始',
        enabled: true,
      };
    }
    if (action === 'vehicle.toggle') next.controls.vehicleEnabled.value = payload.enabled === true;
    if (action === 'vehicle.register') {
      next.registrationActive = true;
      next.controls.companionStatus = { text: '取り込み待機中', tone: 'progress' };
      next.controls.companionDetail = { text: 'FiveMで目的の車両ストレージを一度開いてください。' };
      next.controls.vehicleRegister = { text: 'ストレージを待っています', enabled: false };
    }
    if (action === 'route.teach' || action === 'route.trial' || action === 'route.stationary' || action === 'vehicle.route') {
      next.routes = { ...(next.routes || {}), feedback: '画面プレビューです。実際の記録・試走・別ウィンドウはWindows版EXEで行います。' };
    }
    if (action === 'vehicle.delete') {
      next.controls.vehicleStatus = { text: '未登録', tone: 'neutral' };
      next.controls.vehicleDelete = { text: '登録を削除', enabled: false };
    }
    if (action === 'settings.save') {
      Object.assign(next.controls, {
        startHotkey: { value: payload.startHotkey, enabled: true },
        stopHotkey: { value: payload.stopHotkey, enabled: true },
        backgroundMode: { value: payload.backgroundMode, enabled: true },
        hideWhileRunning: { value: payload.hideWhileRunning, enabled: true },
        correctionEnabled: { value: payload.correctionEnabled, enabled: true },
        autoEat: { value: payload.autoEat, enabled: true },
        foodKey: { value: payload.foodKey, enabled: true },
        autoCheckUpdates: { value: payload.autoCheckUpdates, enabled: true },
        minimumFreeWeight: { value: payload.minimumFreeWeight, enabled: true },
        storageTriggerPercent: { value: payload.storageTriggerPercent, enabled: true },
        estimatedRewardWeight: { value: payload.estimatedRewardWeight, enabled: true },
        minimumFreeSlots: { value: payload.minimumFreeSlots, enabled: true },
        storageMaxRetries: { value: payload.storageMaxRetries, enabled: true },
        farmWatchdogMs: { value: payload.farmWatchdogMs, enabled: true },
        targetLostRecoveryMs: { value: payload.targetLostRecoveryMs, enabled: true },
        debugOverlay: { value: payload.debugOverlay, enabled: true },
        settingsFeedback: { text: '設定を保存しました', tone: 'success' },
      });
    }
    if (action === 'update.check') {
      next.controls.updateStatus = { text: '最新です', tone: 'success' };
      next.controls.updateFeedback = { text: '最新バージョンを使用しています', tone: 'success' };
    }
    applyState(next);
  }

  function wireEvents() {
    nav.forEach((item) => {
      item.addEventListener('click', () => switchPage(item.dataset.page, { animate: true, send: true }));
      item.addEventListener('keydown', (event) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const delta = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
        const index = nav.indexOf(item);
        const target = nav[(index + delta + nav.length) % nav.length];
        target.focus();
        switchPage(target.dataset.page, { animate: true, send: true });
      });
    });

    actionButton.addEventListener('click', openActionPicker);
    elements.stoneReturnButton.addEventListener('click', returnFromStone);
    document.querySelector('[data-close-picker]').addEventListener('click', closeActionPicker);
    elements.runButton.addEventListener('click', () => {
      if (elements.runButton.classList.contains('is-pending')) return;
      setPending(elements.runButton, 'run', state.revision);
      sendAction('run.toggle');
    });
    elements.vehicleEnabled.addEventListener('change', () => {
      const previous = booleanOf(control('vehicleEnabled'));
      const desired = elements.vehicleEnabled.checked;
      elements.vehicleEnabled.checked = previous;
      elements.vehicleEnabled.disabled = true;
      sendAction('vehicle.toggle', { enabled: desired });
    });
    elements.vehicleRegister.addEventListener('click', () => {
      if (elements.vehicleRegister.classList.contains('is-pending')) return;
      setPending(elements.vehicleRegister, 'vehicle', state.revision);
      sendAction('vehicle.register');
    });
    const openRoutes = () => switchPage('routes', { animate: true, send: true });
    elements.vehicleRoute.addEventListener('click', openRoutes);
    elements.overviewRoute.addEventListener('click', openRoutes);
    elements.routeRegister.addEventListener('click', () => sendAction('vehicle.register'));
    elements.routeTeach.addEventListener('click', () => sendAction('route.teach', { mode: state.actionMode }));
    elements.routeStationary.addEventListener('click', () => sendAction('route.stationary', { mode: state.actionMode }));
    elements.routeTrial.addEventListener('click', () => sendAction('route.trial', { mode: state.actionMode }));
    elements.routeEnable.addEventListener('click', () => sendAction('vehicle.toggle', { enabled: !booleanOf(control('vehicleEnabled', 'vehicleEnabledControl')) }));
    elements.routeVoice.addEventListener('click', () => sendAction('vehicle.route'));
    elements.routeReturnHome.addEventListener('click', () => switchPage('overview', { animate: true, send: true }));
    document.querySelectorAll('[data-route-mode]').forEach((button) => {
      button.addEventListener('click', () => sendAction('action.select', { mode: button.dataset.routeMode }));
    });
    elements.vehicleDelete.addEventListener('click', () => {
      app.dialog.confirm(
        '登録情報だけを削除します。車両や荷台の中身は変更しません。',
        '車両登録を削除',
        () => sendAction('vehicle.delete'),
      );
    });

    const dirtyControls = new Map([
      [elements.startHotkey, 'startHotkey'],
      [elements.stopHotkey, 'stopHotkey'],
      [elements.settingBackground, 'backgroundMode'],
      [elements.settingHide, 'hideWhileRunning'],
      [elements.settingCorrection, 'correctionEnabled'],
      [elements.settingAutoEat, 'autoEat'],
      [elements.foodKey, 'foodKey'],
      [elements.settingAutoUpdate, 'autoCheckUpdates'],
      [elements.minimumFreeWeight, 'minimumFreeWeight'],
      [elements.storageTriggerPercent, 'storageTriggerPercent'],
      [elements.estimatedRewardWeight, 'estimatedRewardWeight'],
      [elements.minimumFreeSlots, 'minimumFreeSlots'],
      [elements.storageMaxRetries, 'storageMaxRetries'],
      [elements.farmWatchdogSeconds, 'farmWatchdogMs'],
      [elements.targetLostRecoverySeconds, 'targetLostRecoveryMs'],
      [elements.settingDebugOverlay, 'debugOverlay'],
    ]);
    dirtyControls.forEach((key, element) => {
      element.addEventListener(element.type === 'checkbox' ? 'change' : 'input', () => settingsDirty.add(key));
    });
    for (const input of [elements.startHotkey, elements.stopHotkey]) {
      input.addEventListener('blur', () => {
        input.value = input.value.trim().toUpperCase();
      });
    }
    elements.settingsSave.addEventListener('click', () => {
      if (elements.settingsSave.classList.contains('is-pending')) return;
      const minimumFreeWeight = Number(elements.minimumFreeWeight.value);
      const foodKey = Number(elements.foodKey.value);
      const storageTriggerPercent = Number(elements.storageTriggerPercent.value);
      const estimatedRewardWeight = Number(elements.estimatedRewardWeight.value);
      const minimumFreeSlots = Number(elements.minimumFreeSlots.value);
      const storageMaxRetries = Number(elements.storageMaxRetries.value);
      const farmWatchdogSeconds = Number(elements.farmWatchdogSeconds.value);
      const targetLostRecoverySeconds = Number(elements.targetLostRecoverySeconds.value);
      if (!Number.isInteger(foodKey) || foodKey < 1 || foodKey > 5) {
        setText(elements.settingsFeedback, '食料スロットは1〜5で指定してください');
        setTone(elements.settingsFeedback, 'error');
        elements.foodKey.focus();
        return;
      }
      if (!Number.isInteger(minimumFreeWeight) || minimumFreeWeight < 250 || minimumFreeWeight > 20000) {
        setText(elements.settingsFeedback, '残り重量は250〜20,000gで指定してください');
        setTone(elements.settingsFeedback, 'error');
        elements.minimumFreeWeight.focus();
        return;
      }
      if (!Number.isInteger(storageTriggerPercent) || storageTriggerPercent < 50 || storageTriggerPercent > 99) {
        showSettingsValidation('使用率のしきい値は50〜99%で指定してください', elements.storageTriggerPercent);
        return;
      }
      if (!Number.isInteger(estimatedRewardWeight) || estimatedRewardWeight < 250 || estimatedRewardWeight > 20000) {
        showSettingsValidation('1回分の予想重量は250〜20,000gで指定してください', elements.estimatedRewardWeight);
        return;
      }
      if (!Number.isInteger(minimumFreeSlots) || minimumFreeSlots < 0 || minimumFreeSlots > 10) {
        showSettingsValidation('空きスロットは0〜10枠で指定してください', elements.minimumFreeSlots);
        return;
      }
      if (!Number.isInteger(storageMaxRetries) || storageMaxRetries < 1 || storageMaxRetries > 8) {
        showSettingsValidation('収納の再試行は1〜8回で指定してください', elements.storageMaxRetries);
        return;
      }
      if (!Number.isInteger(farmWatchdogSeconds) || farmWatchdogSeconds < 15 || farmWatchdogSeconds > 180) {
        showSettingsValidation('成果なしの復旧時間は15〜180秒で指定してください', elements.farmWatchdogSeconds);
        return;
      }
      if (!Number.isInteger(targetLostRecoverySeconds)
        || targetLostRecoverySeconds < 5 || targetLostRecoverySeconds > 60) {
        showSettingsValidation('対象再探索の待機時間は5〜60秒で指定してください', elements.targetLostRecoverySeconds);
        return;
      }
      setPending(elements.settingsSave, 'settings', state.revision);
      sendAction('settings.save', {
        startHotkey: elements.startHotkey.value.trim().toUpperCase(),
        stopHotkey: elements.stopHotkey.value.trim().toUpperCase(),
        backgroundMode: elements.settingBackground.checked,
        hideWhileRunning: elements.settingHide.checked,
        correctionEnabled: elements.settingCorrection.checked,
        autoEat: elements.settingAutoEat.checked,
        foodKey,
        autoCheckUpdates: elements.settingAutoUpdate.checked,
        minimumFreeWeight,
        storageTriggerPercent,
        estimatedRewardWeight,
        minimumFreeSlots,
        storageMaxRetries,
        farmWatchdogMs: farmWatchdogSeconds * 1000,
        targetLostRecoveryMs: targetLostRecoverySeconds * 1000,
        debugOverlay: elements.settingDebugOverlay.checked,
      });
    });
    elements.updateCheck.addEventListener('click', () => {
      if (elements.updateCheck.classList.contains('is-pending')) return;
      setPending(elements.updateCheck, 'update', state.revision);
      sendAction('update.check');
    });

    document.addEventListener('keydown', (event) => {
      const escape = event.key === 'Escape';
      const altBack = event.key === 'ArrowLeft' && event.altKey
        && !event.ctrlKey && !event.shiftKey && !event.metaKey;
      const browserBack = event.key === 'BrowserBack';
      if (!escape && !altBack && !browserBack) return;
      if (escape && (actionSheet.opened || actionPopover.opened)) {
        event.preventDefault();
        closeActionPicker();
        return;
      }
      if (currentPage !== 'stone' || event.isComposing) return;
      if (escape && event.target instanceof HTMLElement
        && event.target.matches('input, textarea, [contenteditable="true"]')) return;
      if (stoneTransientLayerIsOpen()) {
        if (altBack || browserBack) event.preventDefault();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      returnFromStone();
    }, true);

    window.addEventListener('resize', () => updateSelectionIndicator(false));
    reduceMotionQuery.addEventListener?.('change', () => updateSelectionIndicator(false));

    if (window.chrome?.webview?.addEventListener) {
      window.chrome.webview.addEventListener('message', (event) => handleHostMessage(event.data));
    }
  }

  function handleHostMessage(rawMessage) {
    const message = normalizeMessage(rawMessage);
    if (!message) return;
    if (message.type === 'state') {
      markHostReady();
      applyState(message);
      return;
    }
    if (message.type === 'command' && message.command === 'SMOKE') {
      window.setTimeout(() => runSmokeTest(true), 100);
    }
  }

  function markHostReady() {
    if (hostReady) return;
    hostReady = true;
    resolveHostReady?.();
    resolveHostReady = null;
  }

  function runSmokeTest(reportToHost = false) {
    const stoneReturnRect = elements.stoneReturnButton.getBoundingClientRect();
    const stoneReturnBlocked = stoneTransientLayerIsOpen();
    const stoneReturnExpected = currentPage === 'stone' && !stoneReturnBlocked;
    const stoneReturnHit = stoneReturnExpected
      ? document.elementFromPoint(
        stoneReturnRect.left + stoneReturnRect.width / 2,
        stoneReturnRect.top + stoneReturnRect.height / 2,
      )
      : null;
    const checks = {
      schema: document.querySelector('meta[name="ai-miner-ui-schema"]')?.content === String(UI_SCHEMA),
      framework: typeof Framework7 === 'function' && app.theme === 'ios',
      lightTheme: app.params.darkMode === false,
      screens: [...VALID_PAGES].every((page) => screens.has(page)),
      noNativeSelect: !document.querySelector('select'),
      actionPicker: Boolean(actionSheet && actionPopover && actionButton),
      stoneReturnControl: Boolean(elements.stoneReturnButton
        && elements.stoneReturnButton.getAttribute('aria-controls') === 'screen-overview'),
      stoneReturnAvailability: currentPage !== 'stone'
        || (stoneReturnBlocked
          ? (elements.stoneReturnButton.hidden
            && elements.stoneReturnButton.getAttribute('aria-hidden') === 'true'
            && elements.stoneReturnButton.tabIndex === -1)
          : (!elements.stoneReturnButton.hidden
            && elements.stoneReturnButton.getAttribute('aria-hidden') === 'false'
            && elements.stoneReturnButton.tabIndex === 0)),
      stoneReturnVisible: !stoneReturnExpected
        || (elements.stoneReturnButton.getClientRects().length > 0
          && elements.stoneReturnButton.getBoundingClientRect().height >= 44),
      stoneReturnLayout: !stoneReturnExpected
        || (stoneReturnRect.width >= 44 && stoneReturnRect.width <= 160
          && (stoneReturnHit === elements.stoneReturnButton
            || elements.stoneReturnButton.contains(stoneReturnHit))),
      focusVisible: CSS.supports('selector(:focus-visible)'),
      offlineAssets: [...document.scripts, ...document.querySelectorAll('link[rel="stylesheet"]')]
        .every((node) => !/^(?:https?:)?\/\//i.test(
          node.getAttribute('src') || node.getAttribute('href') || '',
        )),
      activeScreen: screens.get(currentPage)?.classList.contains('is-active')
        && screens.get(currentPage)?.getAttribute('aria-hidden') !== 'true',
      fixturePage: !fixtureMode || !VALID_PAGES.has(query.get('page'))
        || currentPage === query.get('page'),
      fixturePicker: !fixtureMode || query.get('picker') !== '1'
        || Boolean(document.querySelector('.action-sheet.modal-in, .action-popover.modal-in')),
    };
    const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    const result = failures.length ? `ERROR:${failures.join(',')}` : 'OK';
    if (reportToHost) sendAction('smoke.result', { result });
    return { result, checks };
  }

  window.aiMinerUI = Object.freeze({
    navigate: (page) => switchPage(page, { animate: true, send: true }),
    returnFromStone,
    getPage: () => currentPage,
    whenHostReady: () => hostReadyPromise,
    reportVisualSmoke(result) {
      if (!fixtureMode || typeof result !== 'string'
        || !/^[A-Za-z0-9_.:=-]{1,180}$/.test(result)) return false;
      sendAction('smoke.result', { result });
      return true;
    },
    hostBackedMetaFixture,
  });

  window.aiMinerTest = Object.freeze({
    ready: true,
    fixture: fixtureMode,
    frameworkVersion: FRAMEWORK7_VERSION,
    getState: () => clone(state),
    getActions: () => clone(sentActions),
    setState: (patch) => {
      if (!fixtureMode || !patch || typeof patch !== 'object') return false;
      const next = {
        ...state,
        ...patch,
        revision: Number.isFinite(Number(patch.revision)) ? Number(patch.revision) : state.revision + 1,
        controls: patch.controls ? { ...state.controls, ...patch.controls } : state.controls,
      };
      return applyState(next);
    },
    navigate: (page) => switchPage(page, { animate: true, send: false }),
    openActionPicker,
    closeActionPicker,
    setRunning: (running) => {
      if (!fixtureMode) return false;
      return window.aiMinerTest.setState({
        running: Boolean(running),
        controls: {
          runStatus: { text: running ? '実行中' : '停止中', tone: running ? 'success' : 'neutral' },
          runButton: { text: running ? '自動操作を停止' : '自動操作を開始', enabled: true },
        },
      });
    },
    requestClose: () => sendAction('window.close'),
    smoke: () => runSmokeTest(false),
  });
})();
