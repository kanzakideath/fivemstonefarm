import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(root, 'src', 'index.html'), 'utf8');
const css = await readFile(join(root, 'src', 'app.css'), 'utf8');
const js = await readFile(join(root, 'src', 'app.js'), 'utf8');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const metaRoot = join(root, 'src', 'metagame');
const metaJs = await readFile(join(metaRoot, 'meta-game.js'), 'utf8');
const metaCss = await readFile(join(metaRoot, 'meta-game.css'), 'utf8');
const metaTemplate = await readFile(join(metaRoot, 'meta-game-template.html'), 'utf8');
const metaAdapter = await readFile(join(metaRoot, 'meta-game-adapter.js'), 'utf8');
const metaEntry = await readFile(join(metaRoot, 'meta-game-entry.js'), 'utf8');

assert.equal(packageJson.dependencies.framework7, '9.1.3', 'Framework7 must remain exactly pinned');
assert.ok(
  js.includes(`version: '${packageJson.version}'`),
  'the deterministic UI fixture must display the packaged application version',
);
assert.match(html, /<meta name="ai-miner-ui-schema" content="1">/);
assert.match(js, /new Framework7\(\{/);
assert.match(js, /theme:\s*'ios'/);
assert.match(js, /darkMode:\s*false/);
assert.equal(
  [...`${js}\n${metaJs}\n${metaAdapter}\n${metaEntry}`.matchAll(/new Framework7\s*\(/g)].length,
  1,
  'the metagame must reuse the existing Framework7 instance',
);
assert.doesNotMatch(html, /<(?:script|link)\b[^>]+(?:src|href)="https?:/i, 'runtime assets must be local');
assert.doesNotMatch(html, /<select\b/i, 'the action picker must not fall back to a native select');
assert.match(css, /--am-sidebar-width:\s*224px/);
assert.match(css, /--am-content-max:\s*720px/);
assert.match(css, /--am-background:\s*#f2f2f7/i);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(html, /connect-src 'self'/);
assert.ok(
  html.indexOf('href="app.css"') < html.indexOf('href="metagame\/meta-game.css"'),
  'scoped metagame CSS must load after the main application CSS',
);
assert.match(html, /<script type="module" src="metagame\/meta-game-entry\.js"><\/script>/);
assert.match(html, /id="stoneverse-launch"/);
assert.match(html, /<script type="module" src="stoneverse-host\.js"><\/script>/);
assert.match(js, /stoneverse\/index\.html\?host=ai-miner/);
assert.match(html, /id="stone-return-button"[^>]+aria-controls="screen-overview"/);
assert.match(html, /aria-keyshortcuts="Escape Alt\+ArrowLeft"/);
assert.match(css, /\.stone-return-button\s*\{[\s\S]*?min-height:\s*44px/);
assert.match(css, /\.stone-return-button\s*\{[\s\S]*?width:\s*142px/);
assert.match(css, /\.stone-return-button\[hidden\]\s*\{[\s\S]*?display:\s*none/);
assert.match(css, /\.screen-stone \.stone-meta \.meta-topbar\s*\{[\s\S]*?padding-left:\s*166px/);
assert.match(js, /function returnFromStone\(\)/);
assert.match(js, /event\.key === 'ArrowLeft' && event\.altKey/);
assert.match(js, /stoneTransientLayerIsOpen\(\)/);
assert.match(js, /new MutationObserver\(syncStoneReturnAvailability\)/);
assert.match(js, /stoneReturnAvailability:/);
assert.match(js, /stoneReturnLayout:/);
assert.match(metaEntry, /onReturnToFarm:\s*returnToMain/);
assert.match(metaTemplate, /data-meta-app/);
assert.match(metaCss, /^\/\* STONE META GAME/m);
assert.doesNotMatch(`${metaTemplate}\n${metaCss}\n${metaJs}`, /https?:\/\//i, 'metagame assets must remain offline');
assert.match(metaAdapter, /type:\s*'meta\.bootstrap'/);
assert.match(metaAdapter, /type:\s*'meta\.execute'/);
assert.match(metaAdapter, /message\.type === 'meta\.response'/);
assert.match(metaAdapter, /META_NAVIGATION_ABORTED/);
assert.match(metaAdapter, /META_DRAW_OUTCOME_PENDING/);
assert.match(metaAdapter, /requestId:\s*this\.uncertainDraw\.requestId/);
assert.match(metaAdapter, /status:\s*'decided'/);
assert.match(metaAdapter, /commitDrawPresentation\(token\)/);
assert.doesNotMatch(metaAdapter, /scheduleUncertainDrawClear/,
  'a host response must not clear a draw before presentation commit');
assert.match(metaEntry, /if \(demoFixtureMode\)[\s\S]+import\('\.\/demo-adapter\.js'\)/);
assert.match(metaEntry, /hostFixtureMode[\s\S]+new WebViewMetaGameAdapter/);
assert.match(metaEntry, /META_HOST_OK:home:rendered:mined=1:debug=0:mutation=onboarding\.complete/);
assert.match(metaAdapter, /class MetaGamePresentationBoundary/);
assert.match(metaAdapter, /audio\.tone = \(\.\.\.args\)[\s\S]+!this\.active/);
assert.match(metaAdapter, /context\?\.close\?\.\(\)/);
assert.match(metaAdapter, /activeDrawGeneration !== this\.generation/);
assert.match(js, /fixtureToken === '1' \|\| fixtureToken === 'host'/);
assert.match(js, /reportVisualSmoke/);

for (const page of ['overview', 'stone', 'vehicle', 'settings', 'update']) {
  assert.match(html, new RegExp(`id="tab-${page}"[^>]+aria-controls="screen-${page}"`));
  assert.match(html, new RegExp(`id="screen-${page}"[^>]+aria-labelledby="tab-${page}"`));
}

for (const id of [
  'storage-trigger-percent', 'estimated-reward-weight', 'minimum-free-slots',
  'storage-max-retries', 'farm-watchdog-seconds', 'target-lost-recovery-seconds',
  'setting-debug-overlay',
]) {
  assert.match(html, new RegExp(`id="${id}"`), `missing closed-loop setting ${id}`);
}

const sidecarRoot = join(root, '..', '..', 'sidecar', 'stone-metagame');
for (const [source, integrated] of [
  [join(sidecarRoot, 'ui', 'meta-game.js'), join(metaRoot, 'meta-game.js')],
  [join(sidecarRoot, 'ui', 'meta-game.css'), join(metaRoot, 'meta-game.css')],
  [join(sidecarRoot, 'ui', 'meta-game-template.html'), join(metaRoot, 'meta-game-template.html')],
  [join(sidecarRoot, 'demo', 'demo-adapter.js'), join(metaRoot, 'demo-adapter.js')],
]) {
  assert.equal(await readFile(integrated, 'utf8'), await readFile(source, 'utf8'),
    `${integrated} must remain an exact sidecar copy`);
}

const catalogFiles = [
  'gacha.json', 'banners.json', 'items.json', 'affinity.json', 'achievements.json',
  'level-rewards.json', 'titles.json', 'assets.json', 'messages.json',
];
for (const name of catalogFiles) {
  assert.equal(
    await readFile(join(metaRoot, 'data', name), 'utf8'),
    await readFile(join(sidecarRoot, 'data', name), 'utf8'),
    `${name} must remain an exact sidecar copy`,
  );
}

for (const action of [
  'nav', 'action.select', 'run.toggle', 'vehicle.toggle', 'vehicle.register',
  'vehicle.delete', 'settings.save', 'update.check', 'smoke.result',
  'window.close',
]) {
  assert.ok(js.includes(`'${action}'`), `missing WebView action ${action}`);
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML ids must be unique');
const symbols = new Set([...html.matchAll(/<symbol\s+id="([^"]+)"/g)].map((match) => match[1]));
for (const match of html.matchAll(/<use(?:\s+id="[^"]+")?\s+href="#([^"]+)"/g)) {
  assert.ok(symbols.has(match[1]), `missing SVG symbol ${match[1]}`);
}

const output = join(root, 'www');
try {
  const buildInfo = JSON.parse(await readFile(join(output, 'build-info.json'), 'utf8'));
  assert.equal(buildInfo.schema, 1);
  assert.equal(buildInfo.version, packageJson.version);
  assert.equal(buildInfo.frameworkVersion, '9.1.3');
  assert.deepEqual(buildInfo.metagame, { schemaVersion: 2, catalogFiles: 9 });
  assert.deepEqual(buildInfo.stoneverse, { schemaVersion: 5, hostProtocol: 1 });
  for (const relativePath of [
    'index.html', 'app.css', 'app.js', 'stoneverse-host.js',
    join('stoneverse', 'index.html'),
    join('vendor', 'framework7-bundle.min.css'),
    join('vendor', 'framework7-bundle.min.js'),
    join('metagame', 'meta-game.js'),
    join('metagame', 'meta-game.css'),
    join('metagame', 'meta-game-template.html'),
    join('metagame', 'meta-game-adapter.js'),
    join('metagame', 'meta-game-entry.js'),
    join('metagame', 'demo-adapter.js'),
    ...catalogFiles.map((name) => join('metagame', 'data', name)),
  ]) {
    await access(join(output, relativePath));
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log('UI source and offline bundle contract checks passed');
