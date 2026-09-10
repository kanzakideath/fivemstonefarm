import type { StoneverseApi } from '../api/stoneverseApi';
import { stoneverseApi } from '../api/stoneverseApi';

export const FARM_HOST_PROTOCOL = 1 as const;

type FarmHostCommand = {
  type: 'stoneverse.command';
  protocol: 1;
  requestId: string;
  command: 'SESSION_BEGIN' | 'MINING_SUCCESS' | 'SESSION_END';
  id: string;
  timestamp: string;
  amount?: number;
  quality?: number;
  areaId?: string;
  veinId?: string;
  metadata?: Record<string, unknown>;
};

export type FarmHostResult = {
  type: 'stoneverse.result';
  protocol: 1;
  requestId: string;
  command: FarmHostCommand['command'];
  id: string;
  ok: boolean;
  accepted: boolean;
  duplicate: boolean;
  error?: string;
};

type HostWebView = {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
};

const safeId = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/;

const validCommand = (value: unknown): value is FarmHostCommand => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Partial<FarmHostCommand>;
  if (input.type !== 'stoneverse.command' || input.protocol !== FARM_HOST_PROTOCOL
    || !safeId.test(input.requestId ?? '') || !safeId.test(input.id ?? '')
    || !['SESSION_BEGIN', 'MINING_SUCCESS', 'SESSION_END'].includes(input.command ?? '')
    || typeof input.timestamp !== 'string' || !Number.isFinite(Date.parse(input.timestamp))) return false;
  if (input.command !== 'MINING_SUCCESS') return true;
  const amount = input.amount ?? 1;
  const quality = input.quality ?? 0.5;
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 100
    && Number.isFinite(quality) && quality >= 0 && quality <= 1
    && (input.metadata === undefined
      || (Boolean(input.metadata) && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        && JSON.stringify(input.metadata).length <= 4096));
};

export const createFarmHostDispatcher = (api: StoneverseApi) => {
  let farmSessionId: string | null = null;
  let stoneverseSessionId: string | null = null;

  return (input: unknown): FarmHostResult | null => {
    if (!validCommand(input)) return null;
    const base = {
      type: 'stoneverse.result' as const,
      protocol: FARM_HOST_PROTOCOL,
      requestId: input.requestId,
      command: input.command,
      id: input.id,
    };
    try {
      if (input.command === 'SESSION_BEGIN') {
        if (farmSessionId !== null && farmSessionId !== input.id) {
          return { ...base, ok: false, accepted: false, duplicate: false, error: 'SESSION_ALREADY_ACTIVE' };
        }
        const duplicate = farmSessionId === input.id;
        if (!duplicate) {
          farmSessionId = input.id;
          stoneverseSessionId = api.onFarmSessionStarted();
        }
        return { ...base, ok: true, accepted: !duplicate, duplicate };
      }

      if (input.command === 'SESSION_END') {
        if (farmSessionId === null) {
          return { ...base, ok: true, accepted: false, duplicate: true };
        }
        if (farmSessionId !== input.id) {
          return { ...base, ok: false, accepted: false, duplicate: false, error: 'SESSION_MISMATCH' };
        }
        api.onFarmSessionEnded();
        farmSessionId = null;
        stoneverseSessionId = null;
        return { ...base, ok: true, accepted: true, duplicate: false };
      }

      if (farmSessionId === null || stoneverseSessionId === null) {
        return { ...base, ok: false, accepted: false, duplicate: false, error: 'SESSION_NOT_ACTIVE' };
      }
      const result = api.onStoneMined({
        eventId: input.id,
        sessionId: stoneverseSessionId,
        timestamp: input.timestamp,
        areaId: input.areaId,
        veinId: input.veinId,
        amount: input.amount ?? 1,
        quality: input.quality ?? 0.5,
        metadata: input.metadata,
      });
      return {
        ...base,
        ok: result.accepted || result.duplicate,
        accepted: result.accepted,
        duplicate: result.duplicate,
        ...(!(result.accepted || result.duplicate) ? { error: 'MINING_REJECTED' } : {}),
      };
    } catch (error) {
      return {
        ...base,
        ok: false,
        accepted: false,
        duplicate: false,
        error: error instanceof Error ? error.message.slice(0, 256) : 'STONEVERSE_FAILED',
      };
    }
  };
};

const addReturnToFarmButton = (): void => {
  if (new URLSearchParams(window.location.search).get('host') !== 'ai-miner'
    || document.getElementById('ai-miner-return')) return;
  const button = document.createElement('button');
  button.id = 'ai-miner-return';
  button.type = 'button';
  button.textContent = '‹ AI採掘機へ戻る';
  button.setAttribute('aria-label', 'AI採掘機へ戻る');
  Object.assign(button.style, {
    position: 'fixed', left: '16px', top: '14px', zIndex: '2147483647',
    minHeight: '40px', padding: '0 16px', border: '1px solid rgba(255,255,255,.2)',
    borderRadius: '12px', color: '#fff', background: 'rgba(7,11,24,.82)',
    backdropFilter: 'blur(14px)', font: '600 14px system-ui', cursor: 'pointer',
  });
  button.addEventListener('click', () => window.location.assign('../index.html'));
  document.body.append(button);
};

export const installFarmHostBridge = (api: StoneverseApi = stoneverseApi): void => {
  const chromeHost = (globalThis as typeof globalThis & {
    chrome?: { webview?: HostWebView };
    __stoneverseFarmBridgeInstalled?: boolean;
  });
  const webview = chromeHost.chrome?.webview;
  if (!webview || chromeHost.__stoneverseFarmBridgeInstalled) return;
  chromeHost.__stoneverseFarmBridgeInstalled = true;
  const dispatch = createFarmHostDispatcher(api);
  webview.addEventListener('message', (event) => {
    const response = dispatch(event.data);
    if (response) webview.postMessage(response);
  });
  const state = api.getStoneverseState();
  webview.postMessage({
    type: 'stoneverse.ready', protocol: FARM_HOST_PROTOCOL,
    accountId: state.account.accountId,
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addReturnToFarmButton, { once: true });
  } else addReturnToFarmButton();
};
