const UI_ACTIONS = new Set([
  'gacha.draw',
  'profile.update',
  'profile.rename',
  'profile.appearance',
  'profile.title',
  'collection.favorite',
  'collection.acknowledge',
  'reward.claim',
  'reward.claimAll',
  'onboarding.complete',
  'settings.update',
]);

const DEBUG_ACTIONS = new Set([
  'debug.grantPoints',
  'debug.setMined',
  'debug.addXp',
  'debug.advanceAffinity',
  'debug.unlockAchievement',
  'debug.forceDraw',
  'debug.primePity',
  'debug.setPity',
]);

const PUSH_TYPES = new Set([
  'meta.miningRecorded',
  'meta.sessionStarted',
  'meta.sessionEnded',
]);

const DEFAULT_TIMEOUT_MS = 20_000;
const UNCERTAIN_DRAW_STORAGE_KEY = 'ai-miner.meta.uncertain-draw.v1';
const UNCERTAIN_DRAW_TTL_MS = 365 * 24 * 60 * 60 * 1000;
// A decided response includes the authoritative snapshot and exact draw receipt. It remains
// local integration state until the result UI is explicitly dismissed, so a process restart can
// present the same result without issuing another draw.
const MAX_UNCERTAIN_DRAW_BYTES = 2 * 1024 * 1024;

/** Integration-side presentation lifetime guard; it does not alter sidecar draw logic. */
export class MetaGamePresentationBoundary {
  constructor(metaGame, adapter, initiallyActive = false) {
    if (!isRecord(metaGame) || !isRecord(metaGame.audio)) {
      throw new TypeError('META_PRESENTATION_TARGET_INVALID');
    }
    this.metaGame = metaGame;
    this.adapter = adapter;
    this.active = initiallyActive === true;
    this.generation = 0;
    this.activeDrawGeneration = null;
    this.deferredLocalEvents = [];
    this.recoveryPromise = null;
    this.resumeAfterCurrent = false;

    const audio = metaGame.audio;
    const originalTone = audio.tone.bind(audio);
    const originalStartBed = audio.startBed.bind(audio);
    this.originalShowEvents = metaGame.showEvents.bind(metaGame);
    const originalRequestDraw = metaGame.requestDraw.bind(metaGame);
    const originalCloseCinematic = typeof metaGame.closeCinematic === 'function'
      ? metaGame.closeCinematic.bind(metaGame) : null;

    audio.tone = (...args) => {
      if (!this.active) return undefined;
      if (metaGame.drawBusy && this.activeDrawGeneration !== this.generation) return undefined;
      return originalTone(...args);
    };
    audio.startBed = (...args) => {
      if (!this.active || this.activeDrawGeneration !== this.generation) return undefined;
      return originalStartBed(...args);
    };
    metaGame.showEvents = (events) => {
      const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
      if (this.active) return this.originalShowEvents(safeEvents);
      if (typeof adapter?.deferPresentationEvents === 'function') {
        adapter.deferPresentationEvents(safeEvents);
      } else {
        this.deferredLocalEvents.push(...safeEvents);
        if (this.deferredLocalEvents.length > 200) {
          this.deferredLocalEvents.splice(0, this.deferredLocalEvents.length - 200);
        }
      }
      return undefined;
    };
    metaGame.requestDraw = async (...args) => {
      const drawGeneration = this.generation;
      this.activeDrawGeneration = drawGeneration;
      try {
        return await originalRequestDraw(...args);
      } finally {
        if (this.activeDrawGeneration === drawGeneration) this.activeDrawGeneration = null;
        if (drawGeneration !== this.generation) {
          this.resetInterruptedPresentation();
          this.queuePendingDrawResume();
        }
        if (this.resumeAfterCurrent && !this.recoveryPromise) {
          this.resumeAfterCurrent = false;
          this.queuePendingDrawResume();
        }
      }
    };
    if (originalCloseCinematic) {
      metaGame.closeCinematic = (...args) => {
        const presentationComplete = this.isDrawResultFullyPresented();
        const deliveryToken = adapter?.getDrawPresentationToken?.();
        if (this.active && !presentationComplete && deliveryToken != null) {
          // Escape may call closeCinematic while the reel or ten-card reveal is unfinished.
          // Treat that as an interrupted presentation, never as acknowledgement of the draw.
          // The durable decided result is replayed locally under a fresh presentation generation.
          this.generation += 1;
          metaGame.skipRequested = true;
          this.resetInterruptedPresentation();
          this.queuePendingDrawResume();
          return undefined;
        }
        const result = originalCloseCinematic(...args);
        if (this.active && presentationComplete && deliveryToken != null) {
          adapter?.commitDrawPresentation?.(deliveryToken);
        }
        return result;
      };
    }
    adapter?.setPresentationActive?.(this.active);
    adapter?.setDrawRecoveryHandler?.(() => this.queuePendingDrawResume());
  }

  setActive(active) {
    const next = active === true;
    if (!next && this.active) this.generation += 1;
    this.active = next;

    if (!next) {
      const { metaGame } = this;
      metaGame.skipRequested = true;
      this.adapter?.interruptDrawPresentation?.();
      metaGame.audio.stopBed?.();
      const context = metaGame.audio.context;
      metaGame.audio.bed = null;
      metaGame.audio.context = null;
      try { context?.close?.().catch?.(() => {}); } catch {}
      this.resetInterruptedPresentation();
    }

    this.adapter?.setPresentationActive?.(next);
    if (next && this.deferredLocalEvents.length) {
      this.originalShowEvents(this.deferredLocalEvents.splice(0));
    }
    if (next) this.queuePendingDrawResume();
  }

  async resumePendingDraw() {
    if (!this.active) return false;
    if (this.recoveryPromise || this.metaGame.drawBusy) {
      this.resumeAfterCurrent = true;
      return false;
    }
    if (!this.metaGame?.state || this.isCinematicVisible()) return false;
    const pending = this.adapter?.getPendingDrawPresentation?.();
    if (!pending || pending.payment !== 'auto' || pending.inFlight) return false;

    this.adapter?.beginDrawRecovery?.();
    this.metaGame.selectedBannerId = pending.bannerId;
    this.metaGame.navigate?.('gacha', false);
    const recovery = Promise.resolve().then(() => this.metaGame.requestDraw(pending.count));
    this.recoveryPromise = recovery;
    try {
      await recovery;
      return true;
    } finally {
      if (this.recoveryPromise === recovery) {
        this.recoveryPromise = null;
        if (this.resumeAfterCurrent) {
          this.resumeAfterCurrent = false;
          this.queuePendingDrawResume();
        }
      }
    }
  }

  queuePendingDrawResume() {
    Promise.resolve().then(() => this.resumePendingDraw()).catch(() => {});
  }

  isCinematicVisible() {
    const cinematic = this.metaGame?.q?.('[data-cinematic]');
    return Boolean(cinematic && !cinematic.hidden);
  }

  isDrawResultFullyPresented() {
    if (!this.isCinematicVisible()) return false;
    const single = this.metaGame?.q?.('[data-result-stage]');
    if (single && !single.hidden && !single.classList?.contains?.('is-fakeout')) return true;
    const ten = this.metaGame?.q?.('[data-ten-stage]');
    const close = this.metaGame?.q?.('[data-ten-close]');
    return Boolean(ten && !ten.hidden && close && !close.hidden);
  }

  resetInterruptedPresentation() {
    const cinematic = this.metaGame?.q?.('[data-cinematic]');
    if (cinematic) {
      cinematic.hidden = true;
      delete cinematic.dataset?.variant;
    }
    try { this.metaGame?.reelAnimation?.cancel?.(); } catch {}
    if (this.metaGame) {
      this.metaGame.reelAnimation = null;
      this.metaGame.pendingEvents = [];
      this.metaGame.cinematicResults = [];
      this.metaGame.revealedTen?.clear?.();
    }
  }
}

/**
 * Production-only bridge between the isolated metagame UI and the trusted UI host.
 * The adapter intentionally exposes no mining/progression mutation to Web content.
 */
export class WebViewMetaGameAdapter {
  constructor(options = {}) {
    this.webview = options.webview || globalThis.window?.chrome?.webview;
    if (!this.webview || typeof this.webview.postMessage !== 'function'
      || typeof this.webview.addEventListener !== 'function') {
      throw new Error('META_WEBVIEW_UNAVAILABLE');
    }

    const requestedTimeout = Number(options.timeoutMs);
    this.timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout >= 10
      ? requestedTimeout : DEFAULT_TIMEOUT_MS;
    this.pending = new Map();
    this.listeners = new Set();
    this.undeliveredPushes = [];
    this.deferredEvents = [];
    this.deferredGachaResponses = [];
    this.drawDeliverySequence = 0;
    this.lastDrawDelivery = null;
    this.drawRecoveryHandler = null;
    this.drawPresentationInterrupted = false;
    this.sequence = 0;
    this.developmentMode = false;
    this.bootstrapComplete = false;
    this.bootstrapPromise = null;
    this.latestSnapshot = null;
    this.presentationActive = false;
    this.uncertainDraw = readUncertainDraw();
    this.disposed = false;
    this.onWebMessage = (event) => this.handleMessage(event?.data ?? event);
    this.onPageHide = () => this.dispose('META_NAVIGATION_ABORTED');

    this.webview.addEventListener('message', this.onWebMessage);
    globalThis.window?.addEventListener?.('pagehide', this.onPageHide, { once: true });
  }

  bootstrap() {
    if (this.bootstrapPromise) return this.bootstrapPromise;
    this.bootstrapPromise = this.request({ type: 'meta.bootstrap' })
      .then((raw) => {
        const value = unwrap(raw);
        if (value?.ok === false) throw new Error(safeHostError(value.error));
        if (!isRecord(value?.catalog) || !isRecord(value?.snapshot)) {
          throw new Error('META_BOOTSTRAP_INVALID');
        }
        this.developmentMode = value.developmentMode === true;
        this.latestSnapshot = value.snapshot;
        this.bootstrapComplete = true;
        return {
          type: 'meta.bootstrap',
          catalog: value.catalog,
          snapshot: value.snapshot,
          developmentMode: this.developmentMode,
        };
      })
      .catch((error) => {
        this.bootstrapPromise = null;
        throw error;
      });
    return this.bootstrapPromise;
  }

  async execute(action, payload = {}) {
    if (!this.bootstrapComplete) throw new Error('META_NOT_BOOTSTRAPPED');
    if (!UI_ACTIONS.has(action) && !(this.developmentMode && DEBUG_ACTIONS.has(action))) {
      throw new Error('META_ACTION_NOT_ALLOWED');
    }
    if (!isRecord(payload)) throw new Error('META_PAYLOAD_INVALID');

    let requestPayload = payload;
    let drawKey = '';
    if (action === 'gacha.draw') {
      drawKey = semanticDrawKey(payload);
      if (!drawKey) throw new Error('META_DRAW_PAYLOAD_INVALID');
      if (this.uncertainDraw) {
        if (this.uncertainDraw.key !== drawKey) throw new Error('META_DRAW_OUTCOME_PENDING');
        // A timeout is an unknown commit outcome, not a failed draw. Query/replay the exact
        // sidecar idempotency key so the backend returns its saved receipt without charging again.
        requestPayload = { ...payload, requestId: this.uncertainDraw.requestId };
      } else if (!this.rememberUncertainDraw(drawKey, String(payload.requestId || ''))) {
        // Persist before postMessage. A Host/WebView crash after the message crosses the bridge
        // can otherwise commit the draw while losing the only idempotency key needed to recover it.
        throw new Error('META_DRAW_RECEIPT_PERSIST_FAILED');
      }
      if (!writeUncertainDraw(this.uncertainDraw)) {
        throw new Error('META_DRAW_RECEIPT_PERSIST_FAILED');
      }
    }

    const activeDrawId = action === 'gacha.draw' ? String(requestPayload.requestId || '') : '';
    try {
      let raw;
      if (action === 'gacha.draw' && this.uncertainDraw?.status === 'decided') {
        raw = await this.deliverStoredGachaResponse(this.uncertainDraw.result);
      } else {
        raw = await this.request({
          type: 'meta.execute',
          action,
          payload: requestPayload,
        }, action === 'gacha.draw' ? { drawKey, drawRequestId: activeDrawId } : {});
      }
      const result = unwrap(raw);
      const response = { type: 'meta.result', result };
      if (action === 'gacha.draw' && isSuccessfulDrawResult(result, drawKey, activeDrawId)) {
        this.lastDrawDelivery = {
          token: ++this.drawDeliverySequence,
          requestId: activeDrawId,
        };
      }
      return response;
    } catch (error) {
      // Every request error is an unknown commit outcome. Definitive domain failures arrive as
      // normal meta.result responses, so the durable draw receipt remains until one is delivered.
      throw error;
    }
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('META_LISTENER_INVALID');
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    if (this.undeliveredPushes.length) {
      const queued = this.undeliveredPushes.splice(0);
      for (const message of queued) this.notify(message);
    }
    this.flushDeferredEvents();
    return () => this.listeners.delete(listener);
  }

  setPresentationActive(active) {
    this.presentationActive = active === true;
    if (this.presentationActive) {
      this.flushDeferredGachaResponses();
      this.flushDeferredEvents();
    }
  }

  getPendingDrawPresentation() {
    if (!this.uncertainDraw) return null;
    const fields = parseSemanticDrawKey(this.uncertainDraw.key);
    if (!fields) return null;
    return {
      requestId: this.uncertainDraw.requestId,
      bannerId: fields[0],
      count: fields[1],
      payment: fields[2],
      decided: this.uncertainDraw.status === 'decided',
      inFlight: [...this.pending.values()].some((request) => request.action === 'gacha.draw'),
    };
  }

  setDrawRecoveryHandler(handler) {
    this.drawRecoveryHandler = typeof handler === 'function' ? handler : null;
  }

  beginDrawRecovery() {
    this.drawPresentationInterrupted = false;
  }

  interruptDrawPresentation() {
    this.drawPresentationInterrupted = true;
    for (const request of this.pending.values()) {
      if (request.action !== 'gacha.draw' || request.presentationCancelled) continue;
      request.presentationCancelled = true;
      request.reject(new Error('META_PRESENTATION_SUSPENDED'));
    }
    for (const entry of this.deferredGachaResponses) {
      entry.request.presentationCancelled = true;
      entry.request.reject(new Error('META_PRESENTATION_SUSPENDED'));
    }
    this.deferredGachaResponses.length = 0;
  }

  getDrawPresentationToken() {
    return this.lastDrawDelivery?.token ?? null;
  }

  commitDrawPresentation(token) {
    const delivery = this.lastDrawDelivery;
    if (!delivery || token !== delivery.token || this.uncertainDraw?.status !== 'decided'
      || this.uncertainDraw.requestId !== delivery.requestId) return false;
    if (!this.clearUncertainDraw(delivery.requestId)) return false;
    this.lastDrawDelivery = null;
    return true;
  }

  deferPresentationEvents(events) {
    if (!Array.isArray(events) || !events.length) return;
    this.deferredEvents.push(...events.filter(Boolean));
    if (this.deferredEvents.length > 200) {
      this.deferredEvents.splice(0, this.deferredEvents.length - 200);
    }
    this.flushDeferredEvents();
  }

  handleMessage(rawMessage) {
    const message = normalizeMessage(rawMessage);
    if (!message) return false;

    if (message.type === 'meta.response') {
      const requestId = typeof message.requestId === 'string' ? message.requestId : '';
      const request = this.pending.get(requestId);
      if (!request) return false;
      this.pending.delete(requestId);
      clearTimeout(request.timeout);
      if (!Object.prototype.hasOwnProperty.call(message, 'result')) {
        request.reject(new Error('META_RESPONSE_INVALID'));
      } else {
        this.rememberLatestSnapshot(message.result);
        if (request.action === 'gacha.draw'
          && !this.prepareDrawResponse(request, message.result)) {
          // prepareDrawResponse rejects the request while retaining its preflight receipt.
        } else if (request.action === 'gacha.draw' && request.presentationCancelled) {
          this.signalDrawRecoveryAvailable();
        } else if (request.action === 'gacha.draw' && !this.presentationActive) {
          // Keep the full decided receipt/results. Resolving with a quiet snapshot would discard
          // the exact single/ten-pull presentation that the sidecar already committed.
          this.deferredGachaResponses.push({ request, result: message.result });
        } else if (request.kind === 'meta.execute' && !this.presentationActive) {
          this.deliverSnapshotWithoutPresentation(message.result);
          request.reject(new Error('META_PRESENTATION_SUSPENDED'));
        } else {
          request.resolve(message.result);
        }
      }
      return true;
    }

    if (!PUSH_TYPES.has(message.type)) return false;
    this.deliverPush(message);
    return true;
  }

  deliverPush(message) {
    this.rememberLatestSnapshot(message.result || message.Result);
    if (this.presentationActive) {
      this.deliverOrQueue(message);
      return;
    }

    const resultKey = isRecord(message.result) ? 'result'
      : isRecord(message.Result) ? 'Result' : '';
    const result = resultKey ? message[resultKey] : null;
    const eventsKey = Array.isArray(result?.events) ? 'events'
      : Array.isArray(result?.Events) ? 'Events' : '';
    if (eventsKey) {
      this.deferPresentationEvents(result[eventsKey]);
    }

    if (!resultKey) return;
    const quietResult = { ...result };
    if (eventsKey) quietResult[eventsKey] = [];
    this.deliverOrQueue({ ...message, [resultKey]: quietResult });
  }

  deliverSnapshotWithoutPresentation(rawResult) {
    const result = unwrap(rawResult);
    if (!isRecord(result)) return;
    const snapshot = result.snapshot || result.Snapshot;
    const events = Array.isArray(result.events) ? result.events
      : Array.isArray(result.Events) ? result.Events : [];
    this.deferPresentationEvents(events);
    if (!isRecord(snapshot)) return;
    this.deliverOrQueue({
      type: 'meta.synchronized',
      result: { snapshot, events: [] },
    });
  }

  flushDeferredEvents() {
    if (!this.presentationActive || !this.listeners.size || !this.deferredEvents.length) return;
    const events = this.deferredEvents.splice(0);
    this.notify({ type: 'meta.deferredEvents', result: { events } });
  }

  flushDeferredGachaResponses() {
    if (!this.presentationActive || !this.deferredGachaResponses.length) return;
    const responses = this.deferredGachaResponses.splice(0);
    for (const { request, result } of responses) request.resolve(result);
  }

  deliverStoredGachaResponse(result) {
    const currentResult = withAuthoritativeSnapshot(result, this.latestSnapshot);
    if (this.presentationActive) return Promise.resolve(currentResult);
    return new Promise((resolve, reject) => {
      this.deferredGachaResponses.push({ request: { resolve, reject }, result: currentResult });
    });
  }

  rememberLatestSnapshot(rawResult) {
    const result = unwrap(rawResult);
    const snapshot = property(result, 'snapshot', 'Snapshot');
    if (isRecord(snapshot)) this.latestSnapshot = snapshot;
  }

  prepareDrawResponse(request, rawResult) {
    const result = unwrap(rawResult);
    const ok = property(result, 'ok', 'Ok');
    if (ok === false) {
      if (!this.clearUncertainDraw(request.drawRequestId)) {
        request.reject(new Error('META_DRAW_RECEIPT_CLEAR_FAILED'));
        return false;
      }
      return true;
    }
    if (ok !== true || !isSuccessfulDrawResult(result, request.drawKey,
      request.drawRequestId)) {
      request.reject(new Error('META_DRAW_RESULT_INVALID'));
      return false;
    }
    if (!this.rememberDecidedDraw(request.drawKey, request.drawRequestId, result)) {
      request.reject(new Error('META_DRAW_RESULT_PERSIST_FAILED'));
      return false;
    }
    return true;
  }

  signalDrawRecoveryAvailable() {
    if (!this.drawPresentationInterrupted || !this.presentationActive
      || !this.uncertainDraw || typeof this.drawRecoveryHandler !== 'function') return;
    try { this.drawRecoveryHandler(); } catch {}
  }

  deliverOrQueue(message) {
    if (!this.listeners.size) {
      this.undeliveredPushes.push(message);
      if (this.undeliveredPushes.length > 32) this.undeliveredPushes.shift();
      return;
    }
    this.notify(message);
  }

  notify(message) {
    for (const listener of [...this.listeners]) {
      try {
        listener(message);
      } catch {
        // A presentation listener must not block later trusted host events.
      }
    }
  }

  dispose(reason = 'META_ADAPTER_DISPOSED') {
    if (this.disposed) return;
    this.disposed = true;
    this.webview.removeEventListener?.('message', this.onWebMessage);
    globalThis.window?.removeEventListener?.('pagehide', this.onPageHide);
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error(reason));
    }
    for (const { request } of this.deferredGachaResponses) {
      request.reject(new Error(reason));
    }
    this.deferredGachaResponses.length = 0;
    this.pending.clear();
    this.listeners.clear();
    this.undeliveredPushes.length = 0;
    this.deferredEvents.length = 0;
    this.drawRecoveryHandler = null;
  }

  rememberUncertainDraw(key, requestId) {
    if (!key || !isSafeDrawRequestId(requestId)) return false;
    if (this.uncertainDraw?.requestId === requestId
      && this.uncertainDraw?.status === 'decided') return true;
    const priorCreatedAt = this.uncertainDraw?.requestId === requestId
      ? this.uncertainDraw.createdAt : 0;
    this.uncertainDraw = {
      schema: 2,
      key,
      requestId,
      createdAt: Number.isSafeInteger(priorCreatedAt) && priorCreatedAt > 0
        ? priorCreatedAt : Date.now(),
      status: 'pending',
    };
    if (writeUncertainDraw(this.uncertainDraw)) return true;
    this.uncertainDraw = null;
    return false;
  }

  rememberDecidedDraw(key, requestId, result) {
    if (!isSuccessfulDrawResult(result, key, requestId)) return false;
    const candidate = {
      schema: 2,
      key,
      requestId,
      createdAt: this.uncertainDraw?.requestId === requestId
        ? this.uncertainDraw.createdAt : Date.now(),
      status: 'decided',
      result,
    };
    if (!writeUncertainDraw(candidate)) return false;
    const verified = readUncertainDraw();
    if (verified?.status !== 'decided' || verified.requestId !== requestId
      || verified.key !== key) return false;
    this.uncertainDraw = verified;
    return true;
  }

  clearUncertainDraw(requestId) {
    if (!this.uncertainDraw || (requestId && this.uncertainDraw.requestId !== requestId)) return true;
    if (!writeUncertainDraw(null)) return false;
    this.uncertainDraw = null;
    return true;
  }

  request(envelope, metadata = {}) {
    if (this.disposed) return Promise.reject(new Error('META_ADAPTER_DISPOSED'));
    const requestId = createRequestId(++this.sequence);
    const message = { ...envelope, requestId };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.delete(requestId)) return;
        reject(new Error('META_REQUEST_TIMEOUT'));
        if (envelope.action === 'gacha.draw') this.signalDrawRecoveryAvailable();
      }, this.timeoutMs);
      this.pending.set(requestId, {
        resolve, reject, timeout, kind: envelope.type, action: envelope.action || '',
        drawKey: metadata.drawKey || '',
        drawRequestId: metadata.drawRequestId || '',
      });
      try {
        this.webview.postMessage(message);
      } catch {
        clearTimeout(timeout);
        this.pending.delete(requestId);
        reject(new Error('META_POST_FAILED'));
      }
    });
  }
}

function semanticDrawKey(payload) {
  const bannerId = typeof payload?.bannerId === 'string' ? payload.bannerId : '';
  const count = Number(payload?.count);
  const payment = typeof payload?.payment === 'string' ? payload.payment : '';
  if (!bannerId || (count !== 1 && count !== 10) || !payment
    || !isSafeDrawRequestId(payload?.requestId)) return '';
  return JSON.stringify([bannerId, count, payment]);
}

function isSafeDrawRequestId(value) {
  return typeof value === 'string' && /^draw:[A-Za-z0-9._:-]{3,123}$/.test(value);
}

function readUncertainDraw() {
  try {
    // This transport receipt deliberately lives outside metagame domain state. localStorage
    // survives a UI Host crash, allowing the next instance to replay the exact sidecar requestId.
    const raw = globalThis.window?.localStorage?.getItem(UNCERTAIN_DRAW_STORAGE_KEY);
    if (!raw) return null;
    if (raw.length > MAX_UNCERTAIN_DRAW_BYTES) {
      globalThis.window?.localStorage?.removeItem(UNCERTAIN_DRAW_STORAGE_KEY);
      return null;
    }
    const value = JSON.parse(raw);
    const now = Date.now();
    const legacyPending = value?.schema === 1;
    if ((!legacyPending && value?.schema !== 2) || !isSafeSemanticDrawKey(value?.key)
      || !isSafeDrawRequestId(value?.requestId)
      || !Number.isSafeInteger(value?.createdAt)
      || value.createdAt > now + 5 * 60 * 1000
      || value.createdAt < now - UNCERTAIN_DRAW_TTL_MS) {
      globalThis.window?.localStorage?.removeItem(UNCERTAIN_DRAW_STORAGE_KEY);
      return null;
    }
    const status = legacyPending ? 'pending' : value.status;
    if (status !== 'pending' && status !== 'decided') {
      globalThis.window?.localStorage?.removeItem(UNCERTAIN_DRAW_STORAGE_KEY);
      return null;
    }
    if (status === 'decided'
      && !isSuccessfulDrawResult(value.result, value.key, value.requestId)) {
      globalThis.window?.localStorage?.removeItem(UNCERTAIN_DRAW_STORAGE_KEY);
      return null;
    }
    const result = {
      schema: 2,
      key: value.key,
      requestId: value.requestId,
      createdAt: value.createdAt,
      status,
    };
    if (status === 'decided') result.result = value.result;
    return result;
  } catch {
    return null;
  }
}

function writeUncertainDraw(value) {
  try {
    const storage = globalThis.window?.localStorage;
    if (!storage) return false;
    if (value) {
      const encoded = JSON.stringify(value);
      if (encoded.length > MAX_UNCERTAIN_DRAW_BYTES) throw new Error('META_DRAW_RECEIPT_TOO_LARGE');
      storage.setItem(UNCERTAIN_DRAW_STORAGE_KEY, encoded);
      return storage.getItem(UNCERTAIN_DRAW_STORAGE_KEY) === encoded;
    }
    storage.removeItem(UNCERTAIN_DRAW_STORAGE_KEY);
    return storage.getItem(UNCERTAIN_DRAW_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

function isSafeSemanticDrawKey(value) {
  return Boolean(parseSemanticDrawKey(value));
}

function parseSemanticDrawKey(value) {
  if (typeof value !== 'string' || value.length > 160) return null;
  try {
    const fields = JSON.parse(value);
    return Array.isArray(fields) && fields.length === 3
      && typeof fields[0] === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(fields[0])
      && (fields[1] === 1 || fields[1] === 10)
      && (fields[2] === 'auto' || fields[2] === 'points' || fields[2] === 'tickets')
      ? fields : null;
  } catch {
    return null;
  }
}

function isSuccessfulDrawResult(result, semanticKey, requestId) {
  if (!isRecord(result) || property(result, 'ok', 'Ok') !== true) return false;
  const fields = parseSemanticDrawKey(semanticKey);
  const draw = property(result, 'draw', 'Draw');
  const snapshot = property(result, 'snapshot', 'Snapshot');
  const results = property(draw, 'results', 'Results');
  if (!fields || !isRecord(draw) || !isRecord(snapshot) || !Array.isArray(results)
    || results.length !== fields[1] || results.some((item) => !isRecord(item))) return false;
  const resultRequestId = property(draw, 'requestId', 'RequestId');
  return resultRequestId == null || resultRequestId === '' || resultRequestId === requestId;
}

function property(value, camelName, pascalName) {
  if (!isRecord(value)) return undefined;
  if (Object.prototype.hasOwnProperty.call(value, camelName)) return value[camelName];
  return value[pascalName];
}

function withAuthoritativeSnapshot(result, snapshot) {
  if (!isRecord(result) || !isRecord(snapshot)) return result;
  if (Object.prototype.hasOwnProperty.call(result, 'snapshot')) {
    return { ...result, snapshot };
  }
  if (Object.prototype.hasOwnProperty.call(result, 'Snapshot')) {
    return { ...result, Snapshot: snapshot };
  }
  return { ...result, snapshot };
}

function createRequestId(sequence) {
  const bytes = new Uint8Array(12);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    const seed = `${Date.now()}:${sequence}`;
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = seed.charCodeAt(index % seed.length) ^ (sequence + index * 37);
    }
  }
  const random = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `meta-ui-${Date.now().toString(36)}-${sequence.toString(36)}-${random}`;
}

function normalizeMessage(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return isRecord(value) ? value : null;
}

function unwrap(value) {
  const normalized = normalizeMessage(value) || value;
  if (isRecord(normalized) && normalized.type === 'meta.result'
    && Object.prototype.hasOwnProperty.call(normalized, 'result')) {
    return normalized.result;
  }
  return normalized;
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeHostError(value) {
  const error = String(value || 'META_BOOTSTRAP_FAILED');
  return /^[A-Z0-9_.:-]{1,80}$/.test(error) ? error : 'META_BOOTSTRAP_FAILED';
}

export const META_UI_ACTIONS = Object.freeze([...UI_ACTIONS]);
export const META_DEBUG_ACTIONS = Object.freeze([...DEBUG_ACTIONS]);
export const META_PUSH_TYPES = Object.freeze([...PUSH_TYPES]);
