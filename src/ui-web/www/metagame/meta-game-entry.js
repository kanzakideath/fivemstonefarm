import { StoneMetaGameUI } from './meta-game.js';
import { MetaGamePresentationBoundary, WebViewMetaGameAdapter } from './meta-game-adapter.js';

const root = document.getElementById('stone-meta-root');
const query = new URLSearchParams(window.location.search);
const fixtureToken = query.get('fixture');
const demoFixtureMode = fixtureToken === '1';
const hostFixtureMode = fixtureToken === 'host';
const visualFixtureMode = demoFixtureMode || hostFixtureMode;
const validRoutes = new Set([
  'home', 'farm', 'affinity', 'gacha', 'collection', 'achievements', 'profile',
]);

let adapter = null;
let metaGame = null;
let presentationBoundary = null;

if (root) initialize();

async function initialize() {
  root.setAttribute('aria-busy', 'true');
  try {
    if (demoFixtureMode) {
      // The sidecar's LocalStorage adapter is restricted to explicit visual-test fixtures.
      const { DemoMetaGameAdapter } = await import('./demo-adapter.js');
      adapter = new DemoMetaGameAdapter('./metagame/data/', {
        onboarding: query.get('onboarding') === '1',
      });
    } else {
      await window.aiMinerUI?.whenHostReady?.();
      adapter = new WebViewMetaGameAdapter();
    }

    metaGame = new StoneMetaGameUI(root, adapter, {
      templateUrl: './metagame/meta-game-template.html',
      onReturnToFarm: () => window.aiMinerUI?.navigate?.('overview'),
    });
    presentationBoundary = new MetaGamePresentationBoundary(
      metaGame, adapter, window.aiMinerUI?.getPage?.() === 'stone',
    );
    await metaGame.init();
    // A decided draw remains in the integration receipt until its result UI is dismissed.
    // Re-entering STONE or restarting the WebView resumes that exact receipt automatically.
    await presentationBoundary.resumePendingDraw();

    const initialRoute = query.get('metaRoute');
    if (visualFixtureMode && validRoutes.has(initialRoute)) metaGame.navigate(initialRoute, false);
    root.removeAttribute('aria-busy');
    window.dispatchEvent(new CustomEvent('ai-miner:metagame-ready'));
    if (hostFixtureMode) await verifyHostBackedFixture();
    else if (demoFixtureMode) await reportDemoFixtureReady();
  } catch (error) {
    adapter?.dispose?.();
    root.removeAttribute('aria-busy');
    renderFailure(error);
    if (visualFixtureMode) window.aiMinerUI?.reportVisualSmoke?.('META_ERROR:FAILED');
  }
}

function renderFailure(error) {
  const detail = document.createElement('p');
  detail.textContent = `STONE DATAを読み込めませんでした（${safeError(error)}）`;
  const button = document.createElement('button');
  button.className = 'meta-integration-return';
  button.type = 'button';
  button.textContent = '自動操作へ戻る';
  button.addEventListener('click', () => window.aiMinerUI?.navigate?.('overview'));

  const panel = document.createElement('section');
  panel.className = 'meta-integration-error';
  panel.setAttribute('role', 'alert');
  const heading = document.createElement('h1');
  heading.textContent = 'STONE META GAME';
  panel.append(heading, detail, button);
  root.replaceChildren(panel);
}

function safeError(error) {
  const message = error instanceof Error ? error.message : 'META_BOOTSTRAP_FAILED';
  return /^[A-Z0-9_.:-]{1,80}$/.test(message) ? message : 'META_BOOTSTRAP_FAILED';
}

window.addEventListener('ai-miner:pagechange', (event) => {
  presentationBoundary?.setActive(event.detail?.page === 'stone');
});

window.addEventListener('pagehide', () => {
  presentationBoundary?.setActive(false);
}, { once: true });

window.aiMinerMetaGame = Object.freeze({
  get ready() { return Boolean(metaGame?.state); },
  get route() { return metaGame?.route || ''; },
  navigate(route) {
    if (!visualFixtureMode || !validRoutes.has(route) || !metaGame) return false;
    metaGame.navigate(route, false);
    return true;
  },
});

async function reportDemoFixtureReady() {
  const route = validRoutes.has(query.get('metaRoute')) ? query.get('metaRoute') : 'home';
  await waitFor(() => isRouteRendered(route), 4_000);
  if (!window.aiMinerUI?.reportVisualSmoke?.(`META_OK:${route}:rendered`)) {
    throw new Error('META_SMOKE_REPORT_FAILED');
  }
}

async function verifyHostBackedFixture() {
  if (!(adapter instanceof WebViewMetaGameAdapter)) throw new Error('META_HOST_ADAPTER_REQUIRED');

  let unsubscribe = null;
  const verifiedMining = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe?.();
      reject(new Error('META_HOST_MINING_TIMEOUT'));
    }, 10_000);
    unsubscribe = adapter.subscribe((message) => {
      if (message?.type !== 'meta.miningRecorded') return;
      const snapshot = message?.result?.snapshot || message?.result?.Snapshot;
      if (readTotalMined(snapshot) !== 1) return;
      window.clearTimeout(timeout);
      unsubscribe?.();
      resolve(snapshot);
    });
  });

  const mutation = await adapter.execute('onboarding.complete', {});
  const mutationResult = mutation?.result || mutation;
  if ((mutationResult?.ok ?? mutationResult?.Ok) !== true) {
    unsubscribe?.();
    throw new Error('META_HOST_MUTATION_FAILED');
  }
  metaGame.onAdapterMessage(mutation);
  metaGame.renderOnboarding();
  await verifiedMining;
  await waitFor(() => {
    const lifetime = root.querySelector('[data-stat-lifetime]')?.textContent?.replace(/[^0-9]/g, '');
    return isRouteRendered('home')
      && readTotalMined(metaGame.state) === 1
      && lifetime === '1'
      && root.querySelector('[data-onboarding]')?.hidden === true
      && metaGame.developmentMode === false
      && root.querySelector('[data-debug-open]')?.hidden === true;
  }, 5_000);

  if (!window.aiMinerUI?.reportVisualSmoke?.(
    'META_HOST_OK:home:rendered:mined=1:debug=0:mutation=onboarding.complete')) {
    throw new Error('META_HOST_SMOKE_REPORT_FAILED');
  }
}

function isRouteRendered(route) {
  const screen = root.querySelector(`[data-screen="${route}"]`);
  return metaGame?.route === route
    && Boolean(root.querySelector('[data-meta-app]:not(.is-booting)'))
    && Boolean(screen && !screen.hidden && screen.getClientRects().length);
}

function readTotalMined(snapshot) {
  const mining = snapshot?.mining || snapshot?.Mining;
  return Number(mining?.totalStoneMined ?? mining?.TotalStoneMined ?? -1);
}

async function waitFor(predicate, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
  throw new Error('META_RENDER_TIMEOUT');
}
