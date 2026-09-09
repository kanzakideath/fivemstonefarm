import assert from 'node:assert/strict';
import {
  META_DEBUG_ACTIONS,
  META_PUSH_TYPES,
  META_UI_ACTIONS,
  MetaGamePresentationBoundary,
  WebViewMetaGameAdapter,
} from './src/metagame/meta-game-adapter.js';

class FakeWebView {
  constructor() {
    this.messages = [];
    this.listeners = new Set();
  }

  postMessage(message) { this.messages.push(message); }
  addEventListener(type, listener) { if (type === 'message') this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === 'message') this.listeners.delete(listener); }
  deliver(data) { for (const listener of [...this.listeners]) listener({ data }); }
}

const pageListeners = new Map();
const sessionValues = new Map();
const previousWindow = globalThis.window;
globalThis.window = {
  addEventListener(type, listener) { pageListeners.set(type, listener); },
  removeEventListener(type, listener) {
    if (pageListeners.get(type) === listener) pageListeners.delete(type);
  },
  localStorage: {
    getItem(key) { return sessionValues.get(key) ?? null; },
    setItem(key, value) { sessionValues.set(key, String(value)); },
    removeItem(key) { sessionValues.delete(key); },
  },
};

try {
  assert.deepEqual(META_UI_ACTIONS, [
    'gacha.draw', 'profile.update', 'profile.rename', 'profile.appearance',
    'profile.title', 'collection.favorite', 'collection.acknowledge', 'reward.claim',
    'reward.claimAll', 'onboarding.complete', 'settings.update',
  ]);
  assert.equal(META_DEBUG_ACTIONS.every((action) => action.startsWith('debug.')), true);
  assert.deepEqual(META_PUSH_TYPES, [
    'meta.miningRecorded', 'meta.sessionStarted', 'meta.sessionEnded',
  ]);

  const webview = new FakeWebView();
  const adapter = new WebViewMetaGameAdapter({ webview, timeoutMs: 200 });
  const bootstrapPromise = adapter.bootstrap();
  assert.equal(webview.messages.length, 1);
  assert.deepEqual(Object.keys(webview.messages[0]).sort(), ['requestId', 'type']);
  assert.equal(webview.messages[0].type, 'meta.bootstrap');
  assert.match(webview.messages[0].requestId, /^meta-ui-[a-z0-9-]+$/);
  webview.deliver({
    type: 'meta.response',
    requestId: webview.messages[0].requestId,
    result: {
      type: 'meta.bootstrap',
      catalog: { items: [] },
      snapshot: { schemaVersion: 2 },
      developmentMode: false,
    },
  });
  const bootstrap = await bootstrapPromise;
  assert.equal(bootstrap.type, 'meta.bootstrap');
  assert.equal(bootstrap.developmentMode, false);
  adapter.setPresentationActive(true);

  const executePromise = adapter.execute('collection.favorite', {
    itemId: 'ordinary-stone', favorite: true,
  });
  const executeMessage = webview.messages.at(-1);
  assert.deepEqual(Object.keys(executeMessage).sort(), ['action', 'payload', 'requestId', 'type']);
  assert.equal(executeMessage.type, 'meta.execute');
  assert.equal(executeMessage.action, 'collection.favorite');
  webview.deliver({
    type: 'meta.response',
    requestId: executeMessage.requestId,
    result: { ok: true, snapshot: { schemaVersion: 2 }, events: [] },
  });
  assert.deepEqual(await executePromise, {
    type: 'meta.result',
    result: { ok: true, snapshot: { schemaVersion: 2 }, events: [] },
  });

  const beforeRejected = webview.messages.length;
  await assert.rejects(adapter.execute('debug.setMined', { total: 999 }), /META_ACTION_NOT_ALLOWED/);
  await assert.rejects(adapter.execute('mining.record', { total: 999 }), /META_ACTION_NOT_ALLOWED/);
  assert.equal(webview.messages.length, beforeRejected, 'rejected actions must never cross WebView');

  const pushes = [];
  const unsubscribe = adapter.subscribe((message) => pushes.push(message));
  adapter.setPresentationActive(false);
  webview.deliver({
    type: 'meta.miningRecorded',
    result: { snapshot: { schemaVersion: 2, mining: { totalStoneMined: 1 } }, events: [{ type: 'mining.levelUp' }] },
  });
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].result.events, [], 'hidden pages receive state without presentation events');
  adapter.setPresentationActive(true);
  assert.equal(pushes.length, 2);
  assert.deepEqual(pushes[1].result.events, [{ type: 'mining.levelUp' }],
    'deferred events are presented after returning to STONE');
  adapter.setPresentationActive(false);
  adapter.deferPresentationEvents([{ type: 'achievement.unlocked', id: 'deferred:manual' }]);
  adapter.setPresentationActive(true);
  assert.equal(pushes.at(-1).result.events[0].id, 'deferred:manual');

  adapter.setPresentationActive(false);
  const suspendedPromise = adapter.execute('collection.favorite', {
    itemId: 'ordinary-stone', favorite: false,
  });
  const suspendedMessage = webview.messages.at(-1);
  webview.deliver({
    type: 'meta.response', requestId: suspendedMessage.requestId,
    result: {
      ok: true,
      snapshot: { schemaVersion: 2, collection: {} },
      events: [{ type: 'collection.new', id: 'hidden-mutation-event' }],
    },
  });
  await assert.rejects(suspendedPromise, /META_PRESENTATION_SUSPENDED/);
  assert.equal(pushes.at(-1).type, 'meta.synchronized',
    'a hidden mutation must synchronize state without starting its presentation');
  adapter.setPresentationActive(true);
  assert.equal(pushes.at(-1).result.events[0].id, 'hidden-mutation-event',
    'a hidden mutation must defer its presentation events until STONE is visible');
  const beforeUnsubscribedPush = pushes.length;
  unsubscribe();
  webview.deliver({ type: 'meta.sessionEnded', result: { snapshot: { schemaVersion: 2 } } });
  assert.equal(pushes.length, beforeUnsubscribedPush);

  const navigationPromise = adapter.execute('onboarding.complete', {});
  pageListeners.get('pagehide')();
  await assert.rejects(navigationPromise, /META_NAVIGATION_ABORTED/);
  assert.equal(webview.listeners.size, 0, 'navigation must detach the WebView listener');

  const timeoutWebView = new FakeWebView();
  const timeoutAdapter = new WebViewMetaGameAdapter({ webview: timeoutWebView, timeoutMs: 10 });
  await assert.rejects(timeoutAdapter.bootstrap(), /META_REQUEST_TIMEOUT/);
  timeoutAdapter.dispose();

  const drawWebView = new FakeWebView();
  const drawAdapter = new WebViewMetaGameAdapter({ webview: drawWebView, timeoutMs: 200 });
  const drawBootstrap = drawAdapter.bootstrap();
  drawWebView.deliver({
    type: 'meta.response', requestId: drawWebView.messages[0].requestId,
    result: { catalog: { items: [] }, snapshot: { schemaVersion: 2 }, developmentMode: false },
  });
  await drawBootstrap;
  drawAdapter.setPresentationActive(true);
  const firstDraw = drawAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:first0001', bannerId: 'eternal-stone', count: 1, payment: 'auto',
  });
  const firstDrawMessage = drawWebView.messages.at(-1);
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), true,
    'the idempotency receipt must be durable before the draw message is posted');
  // Dispose immediately, before timeout/catch recovery can run, matching a Host-page crash.
  drawAdapter.dispose('META_NAVIGATION_ABORTED');
  await assert.rejects(firstDraw, /META_NAVIGATION_ABORTED/);

  // Simulate a complete Web adapter/Host-page restart. The transport receipt must remain
  // durable and force the exact sidecar request id to be queried again.
  const recoveredDrawAdapter = new WebViewMetaGameAdapter({ webview: drawWebView, timeoutMs: 50 });
  const recoveredBootstrap = recoveredDrawAdapter.bootstrap();
  const recoveredBootstrapMessage = drawWebView.messages.at(-1);
  drawWebView.deliver({
    type: 'meta.response', requestId: recoveredBootstrapMessage.requestId,
    result: { catalog: { items: [] }, snapshot: { schemaVersion: 2 }, developmentMode: false },
  });
  await recoveredBootstrap;
  recoveredDrawAdapter.setPresentationActive(true);
  await assert.rejects(recoveredDrawAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:different1', bannerId: 'eternal-stone', count: 10, payment: 'auto',
  }), /META_DRAW_OUTCOME_PENDING/, 'an unresolved draw must block a different draw');
  const retryDraw = recoveredDrawAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:new000001', bannerId: 'eternal-stone', count: 1, payment: 'auto',
  });
  const retryDrawMessage = drawWebView.messages.at(-1);
  assert.equal(retryDrawMessage.payload.requestId, firstDrawMessage.payload.requestId,
    'an uncertain draw must reuse the original sidecar idempotency key');
  const recoveredExactResult = {
    ok: true,
    duplicate: true,
    snapshot: { schemaVersion: 2, gacha: { totalDraws: 1 } },
    events: [{ type: 'collection.new', id: 'first-draw-exact' }],
    draw: {
      requestId: firstDrawMessage.payload.requestId,
      count: 1,
      results: [{ itemId: 'stone-001', rarity: 'SSR', isNew: true }],
    },
  };
  drawWebView.deliver({
    type: 'meta.response', requestId: retryDrawMessage.requestId,
    result: recoveredExactResult,
  });
  assert.deepEqual((await retryDraw).result, recoveredExactResult);
  const decidedRecord = JSON.parse(sessionValues.get('ai-miner.meta.uncertain-draw.v1'));
  assert.equal(decidedRecord.status, 'decided');
  assert.deepEqual(decidedRecord.result, recoveredExactResult,
    'the exact authoritative result must be durable before presentation starts');
  recoveredDrawAdapter.dispose('META_NAVIGATION_ABORTED');

  // Crash after the backend response but before the result is dismissed. A new adapter must use
  // the durable decided response without posting another draw or consuming currency again.
  const afterResultCrashWebView = new FakeWebView();
  const afterResultCrashAdapter = new WebViewMetaGameAdapter({
    webview: afterResultCrashWebView, timeoutMs: 50,
  });
  const afterResultBootstrap = afterResultCrashAdapter.bootstrap();
  const latestAfterMiningSnapshot = {
    schemaVersion: 2,
    mining: { totalStoneMined: 2, availableMiningPoints: 20 },
    gacha: { totalDraws: 1 },
  };
  afterResultCrashWebView.deliver({
    type: 'meta.response', requestId: afterResultCrashWebView.messages[0].requestId,
    result: {
      catalog: { items: [] }, snapshot: latestAfterMiningSnapshot, developmentMode: false,
    },
  });
  await afterResultBootstrap;
  assert.deepEqual(afterResultCrashAdapter.latestSnapshot, latestAfterMiningSnapshot);
  const latestTrustedPushSnapshot = {
    schemaVersion: 2,
    mining: { totalStoneMined: 3, availableMiningPoints: 30 },
    gacha: { totalDraws: 1 },
  };
  afterResultCrashWebView.deliver({
    type: 'meta.miningRecorded', result: { snapshot: latestTrustedPushSnapshot, events: [] },
  });
  afterResultCrashAdapter.setPresentationActive(true);
  const messagesBeforeExactReplay = afterResultCrashWebView.messages.length;
  const exactReplay = await afterResultCrashAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:aftercrash1', bannerId: 'eternal-stone', count: 1, payment: 'auto',
  });
  assert.equal(afterResultCrashWebView.messages.length, messagesBeforeExactReplay,
    'a decided durable draw must be replayed locally without a second backend mutation');
  assert.deepEqual(exactReplay.result.draw, recoveredExactResult.draw,
    'the exact decided draw results must survive restart');
  assert.deepEqual(exactReplay.result.events, recoveredExactResult.events,
    'the exact unpresented draw events must survive restart');
  assert.deepEqual(exactReplay.result.snapshot, latestTrustedPushSnapshot,
    'durable result replay must retain the newest authoritative bootstrap/push state');
  assert.deepEqual(JSON.parse(sessionValues.get('ai-miner.meta.uncertain-draw.v1')).result,
    recoveredExactResult, 'snapshot rebasing must not rewrite the durable decided receipt');
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), true,
    'handing a result to the UI is not presentation commit');
  const replayToken = afterResultCrashAdapter.getDrawPresentationToken();
  assert.equal(typeof replayToken, 'number');
  assert.equal(afterResultCrashAdapter.commitDrawPresentation(replayToken), true);
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), false,
    'only an explicit completed-presentation commit clears the durable result');

  const laterDraw = afterResultCrashAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:later0001', bannerId: 'eternal-stone', count: 1, payment: 'auto',
  });
  const laterDrawMessage = afterResultCrashWebView.messages.at(-1);
  assert.equal(laterDrawMessage.payload.requestId, 'draw:ui:later0001');
  afterResultCrashWebView.deliver({
    type: 'meta.response', requestId: laterDrawMessage.requestId,
    result: { ok: false, error: 'INSUFFICIENT_GACHA_CURRENCY' },
  });
  assert.equal((await laterDraw).result.ok, false);
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), false,
    'a definitive domain failure may clear its transport receipt without presentation');
  afterResultCrashAdapter.dispose();

  const hiddenDrawWebView = new FakeWebView();
  const hiddenDrawAdapter = new WebViewMetaGameAdapter({ webview: hiddenDrawWebView });
  const hiddenBootstrap = hiddenDrawAdapter.bootstrap();
  hiddenDrawWebView.deliver({
    type: 'meta.response', requestId: hiddenDrawWebView.messages[0].requestId,
    result: { catalog: {}, snapshot: {}, developmentMode: false },
  });
  await hiddenBootstrap;
  hiddenDrawAdapter.setPresentationActive(true);
  const hiddenDraw = hiddenDrawAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:hidden0001', bannerId: 'eternal-stone', count: 10, payment: 'auto',
  });
  const hiddenDrawMessage = hiddenDrawWebView.messages.at(-1);
  hiddenDrawAdapter.setPresentationActive(false);
  const exactDrawResult = {
    ok: true,
    snapshot: { schemaVersion: 2, gacha: { totalDraws: 10 } },
    events: [{ type: 'collection.new', id: 'draw-event-exact' }],
    draw: {
      requestId: 'draw:ui:hidden0001',
      count: 10,
      results: Array.from({ length: 10 }, (_, index) => ({ itemId: `stone-${index + 1}` })),
    },
  };
  let hiddenDrawSettled = false;
  hiddenDraw.then(() => { hiddenDrawSettled = true; }, () => { hiddenDrawSettled = true; });
  hiddenDrawWebView.deliver({
    type: 'meta.response', requestId: hiddenDrawMessage.requestId, result: exactDrawResult,
  });
  await Promise.resolve();
  assert.equal(hiddenDrawSettled, false,
    'a hidden gacha response must wait with its exact receipt/results intact');
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), true,
    'the durable draw receipt must remain until the full result is handed back');
  hiddenDrawAdapter.setPresentationActive(true);
  assert.deepEqual((await hiddenDraw).result, exactDrawResult);
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), true,
    'route resume must not commit a result before the user finishes its presentation');
  const hiddenDrawToken = hiddenDrawAdapter.getDrawPresentationToken();
  assert.equal(hiddenDrawAdapter.commitDrawPresentation(hiddenDrawToken), true);
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), false);
  hiddenDrawAdapter.dispose();

  const interruptedWebView = new FakeWebView();
  const interruptedAdapter = new WebViewMetaGameAdapter({ webview: interruptedWebView });
  const interruptedBootstrap = interruptedAdapter.bootstrap();
  interruptedWebView.deliver({
    type: 'meta.response', requestId: interruptedWebView.messages[0].requestId,
    result: { catalog: {}, snapshot: {}, developmentMode: false },
  });
  await interruptedBootstrap;
  interruptedAdapter.setPresentationActive(true);
  let recoverySignals = 0;
  interruptedAdapter.setDrawRecoveryHandler(() => { recoverySignals += 1; });
  const interruptedDraw = interruptedAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:route0001', bannerId: 'eternal-stone', count: 1, payment: 'auto',
  });
  const interruptedMessage = interruptedWebView.messages.at(-1);
  interruptedAdapter.interruptDrawPresentation();
  interruptedAdapter.setPresentationActive(false);
  await assert.rejects(interruptedDraw, /META_PRESENTATION_SUSPENDED/);
  interruptedAdapter.setPresentationActive(true);
  const interruptedResult = {
    ok: true,
    snapshot: { schemaVersion: 2, gacha: { totalDraws: 1 } },
    events: [{ type: 'collection.new', id: 'route-draw-event' }],
    draw: {
      requestId: 'draw:ui:route0001', count: 1,
      results: [{ itemId: 'stone-route', rarity: 'RARE' }],
    },
  };
  interruptedWebView.deliver({
    type: 'meta.response', requestId: interruptedMessage.requestId, result: interruptedResult,
  });
  assert.equal(recoverySignals, 1,
    'an interrupted transport completion must wake exact-result recovery after re-entry');
  const beforeInterruptedReplay = interruptedWebView.messages.length;
  const interruptedReplay = await interruptedAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:route-new1', bannerId: 'eternal-stone', count: 1, payment: 'auto',
  });
  assert.equal(interruptedWebView.messages.length, beforeInterruptedReplay,
    'route recovery must not issue another backend draw');
  assert.deepEqual(interruptedReplay.result, interruptedResult);
  assert.equal(interruptedAdapter.commitDrawPresentation(
    interruptedAdapter.getDrawPresentationToken()), true);
  interruptedAdapter.dispose();

  const uncertainKey = 'ai-miner.meta.uncertain-draw.v1';
  sessionValues.set(uncertainKey, JSON.stringify({
    schema: 1,
    key: JSON.stringify(['eternal-stone', 1, 'auto']),
    requestId: 'draw:ui:expired001',
    createdAt: Date.now() - 366 * 24 * 60 * 60 * 1000,
  }));
  const expiredAdapter = new WebViewMetaGameAdapter({ webview: new FakeWebView() });
  assert.equal(expiredAdapter.uncertainDraw, null, 'expired transport receipts must be rejected');
  assert.equal(sessionValues.has(uncertainKey), false);
  expiredAdapter.dispose();
  sessionValues.set(uncertainKey, 'x'.repeat(2 * 1024 * 1024 + 1));
  const oversizedAdapter = new WebViewMetaGameAdapter({ webview: new FakeWebView() });
  assert.equal(oversizedAdapter.uncertainDraw, null, 'oversized transport receipts must be rejected');
  assert.equal(sessionValues.has(uncertainKey), false);
  oversizedAdapter.dispose();

  const workingStorage = globalThis.window.localStorage;
  globalThis.window.localStorage = {
    getItem() { return null; },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  const noStorageWebView = new FakeWebView();
  const noStorageAdapter = new WebViewMetaGameAdapter({ webview: noStorageWebView });
  const noStorageBootstrap = noStorageAdapter.bootstrap();
  noStorageWebView.deliver({
    type: 'meta.response', requestId: noStorageWebView.messages[0].requestId,
    result: { catalog: {}, snapshot: {}, developmentMode: false },
  });
  await noStorageBootstrap;
  noStorageAdapter.setPresentationActive(true);
  const beforeUnsafeDraw = noStorageWebView.messages.length;
  await assert.rejects(noStorageAdapter.execute('gacha.draw', {
    requestId: 'draw:ui:no-storage', bannerId: 'eternal-stone', count: 1, payment: 'auto',
  }), /META_DRAW_RECEIPT_PERSIST_FAILED/);
  assert.equal(noStorageWebView.messages.length, beforeUnsafeDraw,
    'a draw must not cross WebView when its recovery receipt cannot be persisted');
  noStorageAdapter.dispose();
  globalThis.window.localStorage = workingStorage;

  let releaseStaleDraw;
  const audioCalls = { tone: 0, bed: 0, stopped: 0, closed: 0, cancelled: 0 };
  const shownEvents = [];
  const deferredEvents = [];
  const activeStates = [];
  const fakeMetaGame = {
    drawBusy: false,
    skipRequested: false,
    reelAnimation: { cancel() { audioCalls.cancelled += 1; } },
    audio: {
      context: { close() { audioCalls.closed += 1; return Promise.resolve(); } },
      bed: {},
      tone() { audioCalls.tone += 1; },
      startBed() { audioCalls.bed += 1; },
      stopBed() { audioCalls.stopped += 1; },
    },
    showEvents(events) { shownEvents.push(...events); },
    async requestDraw() {
      this.drawBusy = true;
      await new Promise((resolve) => { releaseStaleDraw = resolve; });
      this.audio.startBed('SSR');
      this.audio.tone(440, 50);
      this.drawBusy = false;
    },
  };
  const presentationAdapter = {
    setPresentationActive(active) { activeStates.push(active); },
    deferPresentationEvents(events) { deferredEvents.push(...events); },
  };
  const boundary = new MetaGamePresentationBoundary(fakeMetaGame, presentationAdapter, true);
  const staleDraw = fakeMetaGame.requestDraw();
  boundary.setActive(false);
  boundary.setActive(true);
  releaseStaleDraw();
  await staleDraw;
  assert.equal(audioCalls.tone, 0, 'a stale async draw must not resume SFX after re-entry');
  assert.equal(audioCalls.bed, 0, 'a stale async draw must not resume BGM after re-entry');
  assert.equal(audioCalls.closed, 1, 'leaving STONE must close the active AudioContext');
  assert.equal(audioCalls.cancelled, 1, 'leaving STONE must cancel the reel animation');
  fakeMetaGame.audio.tone(220, 10);
  assert.equal(audioCalls.tone, 1, 'non-stale audio may resume while STONE is visible');
  boundary.setActive(false);
  fakeMetaGame.showEvents([{ id: 'hidden-boundary-event' }]);
  assert.equal(deferredEvents[0].id, 'hidden-boundary-event');
  assert.deepEqual(activeStates, [true, false, true, false]);

  const cinematic = { hidden: true, dataset: {} };
  const singleStage = {
    hidden: true,
    classList: { contains() { return false; } },
  };
  const tenStage = { hidden: true };
  const tenClose = { hidden: true };
  let pendingPresentation = {
    requestId: 'draw:ui:boundary01', bannerId: 'eternal-stone', count: 1,
    payment: 'auto', decided: true,
  };
  let presentationToken = 40;
  const committedTokens = [];
  const recoveryCalls = [];
  const resultAdapter = {
    setPresentationActive() {},
    getPendingDrawPresentation() { return pendingPresentation; },
    getDrawPresentationToken() { return pendingPresentation ? presentationToken : null; },
    commitDrawPresentation(token) {
      committedTokens.push(token);
      pendingPresentation = null;
      return true;
    },
  };
  const resultMetaGame = {
    state: { settings: {} },
    route: 'home',
    drawBusy: false,
    selectedBannerId: '',
    skipRequested: false,
    reelAnimation: null,
    pendingEvents: [],
    cinematicResults: [],
    revealedTen: new Set(),
    audio: {
      context: null, bed: null, tone() {}, startBed() {}, stopBed() {},
    },
    showEvents() {},
    navigate(route) { this.route = route; },
    q(selector) {
      return new Map([
        ['[data-cinematic]', cinematic], ['[data-result-stage]', singleStage],
        ['[data-ten-stage]', tenStage], ['[data-ten-close]', tenClose],
      ]).get(selector) || null;
    },
    async requestDraw(count) {
      recoveryCalls.push({ count, bannerId: this.selectedBannerId });
      cinematic.hidden = false;
      singleStage.hidden = false;
    },
    closeCinematic() {
      cinematic.hidden = true;
      singleStage.hidden = true;
    },
  };
  const resultBoundary = new MetaGamePresentationBoundary(
    resultMetaGame, resultAdapter, true,
  );
  await resultMetaGame.requestDraw(1);
  assert.equal(committedTokens.length, 0,
    'rendering a decided result must not clear it before explicit dismissal');
  resultMetaGame.closeCinematic();
  assert.deepEqual(committedTokens, [40],
    'dismissing a fully presented result is the presentation commit boundary');

  pendingPresentation = {
    requestId: 'draw:ui:boundary02', bannerId: 'eternal-stone', count: 10,
    payment: 'auto', decided: true,
  };
  presentationToken = 41;
  cinematic.hidden = false;
  singleStage.hidden = false;
  resultBoundary.setActive(false);
  assert.deepEqual(committedTokens, [40], 'leaving STONE must not commit an open result');
  assert.equal(cinematic.hidden, true, 'an interrupted result must be removed before replay');
  resultBoundary.setActive(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(recoveryCalls.at(-1), { count: 10, bannerId: 'eternal-stone' });
  assert.equal(resultMetaGame.route, 'gacha',
    'returning to STONE must automatically reopen the pending GACHA result');

  const escapeWebView = new FakeWebView();
  const escapeAdapter = new WebViewMetaGameAdapter({ webview: escapeWebView });
  const escapeBootstrap = escapeAdapter.bootstrap();
  escapeWebView.deliver({
    type: 'meta.response', requestId: escapeWebView.messages[0].requestId,
    result: { catalog: {}, snapshot: { schemaVersion: 2 }, developmentMode: false },
  });
  await escapeBootstrap;
  const escapeCinematic = { hidden: true, dataset: {} };
  const escapeSingle = {
    hidden: true, classList: { contains() { return false; } },
  };
  const escapeTen = { hidden: true };
  const escapeTenClose = { hidden: true };
  let escapeDrawCalls = 0;
  let originalEscapeCloses = 0;
  const escapeMetaGame = {
    state: { settings: {} }, route: 'gacha', drawBusy: false,
    selectedBannerId: 'eternal-stone', skipRequested: false, reelAnimation: null,
    pendingEvents: [], cinematicResults: [], revealedTen: new Set(),
    audio: { context: null, bed: null, tone() {}, startBed() {}, stopBed() {} },
    showEvents() {},
    navigate(route) { this.route = route; },
    q(selector) {
      return new Map([
        ['[data-cinematic]', escapeCinematic], ['[data-result-stage]', escapeSingle],
        ['[data-ten-stage]', escapeTen], ['[data-ten-close]', escapeTenClose],
      ]).get(selector) || null;
    },
    async requestDraw(count) {
      this.drawBusy = true;
      escapeDrawCalls += 1;
      try {
        const response = await escapeAdapter.execute('gacha.draw', {
          requestId: `draw:ui:escape${escapeDrawCalls.toString().padStart(4, '0')}`,
          bannerId: this.selectedBannerId, count, payment: 'auto',
        });
        if (!response.result.ok) throw new Error(response.result.error);
        escapeCinematic.hidden = false;
        escapeSingle.hidden = true;
        escapeTen.hidden = false;
        escapeTenClose.hidden = true;
      } finally {
        this.drawBusy = false;
      }
    },
    closeCinematic() {
      originalEscapeCloses += 1;
      escapeCinematic.hidden = true;
      escapeTen.hidden = true;
    },
  };
  const escapeBoundary = new MetaGamePresentationBoundary(
    escapeMetaGame, escapeAdapter, true,
  );
  const firstEscapeDraw = escapeMetaGame.requestDraw(10);
  const firstEscapeMessage = escapeWebView.messages.at(-1);
  const escapeExactResult = {
    ok: true,
    snapshot: { schemaVersion: 2, gacha: { totalDraws: 10 } },
    events: [{ type: 'collection.new', id: 'escape-exact-event' }],
    draw: {
      requestId: firstEscapeMessage.payload.requestId,
      count: 10,
      results: Array.from({ length: 10 }, (_, index) => ({ itemId: `escape-${index}` })),
    },
  };
  escapeWebView.deliver({
    type: 'meta.response', requestId: firstEscapeMessage.requestId, result: escapeExactResult,
  });
  await firstEscapeDraw;
  const messagesBeforeEarlyEscape = escapeWebView.messages.length;
  escapeMetaGame.closeCinematic();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(originalEscapeCloses, 0,
    'Escape must not acknowledge or close an incompletely revealed draw');
  assert.equal(escapeDrawCalls, 2,
    'Escape during reveal must automatically re-present the exact pending draw');
  assert.equal(escapeWebView.messages.length, messagesBeforeEarlyEscape,
    'Escape recovery must use the durable result without a second backend mutation');
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), true);
  escapeTenClose.hidden = false;
  escapeMetaGame.closeCinematic();
  assert.equal(originalEscapeCloses, 1);
  assert.equal(sessionValues.has('ai-miner.meta.uncertain-draw.v1'), false,
    'the replayed result clears only after its full reveal is dismissed');
  escapeAdapter.dispose();

  const debugWebView = new FakeWebView();
  const debugAdapter = new WebViewMetaGameAdapter({ webview: debugWebView, timeoutMs: 200 });
  const debugBootstrapPromise = debugAdapter.bootstrap();
  debugWebView.deliver({
    type: 'meta.response',
    requestId: debugWebView.messages[0].requestId,
    result: {
      catalog: { items: [] }, snapshot: { schemaVersion: 2 }, developmentMode: true,
    },
  });
  await debugBootstrapPromise;
  debugAdapter.setPresentationActive(true);
  const debugExecutePromise = debugAdapter.execute('debug.addXp', { amount: 1 });
  const debugMessage = debugWebView.messages.at(-1);
  assert.equal(debugMessage.action, 'debug.addXp');
  debugWebView.deliver({
    type: 'meta.response', requestId: debugMessage.requestId,
    result: { ok: true, snapshot: { schemaVersion: 2 } },
  });
  assert.equal((await debugExecutePromise).result.ok, true);
  debugAdapter.dispose();

  console.log('Metagame WebView adapter contract checks passed');
} finally {
  globalThis.window = previousWindow;
}
