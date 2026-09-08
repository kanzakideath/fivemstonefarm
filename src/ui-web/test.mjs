import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(root, 'src', 'index.html'), 'utf8');
const css = await readFile(join(root, 'src', 'app.css'), 'utf8');
const js = await readFile(join(root, 'src', 'app.js'), 'utf8');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

assert.equal(packageJson.dependencies.framework7, '9.1.3', 'Framework7 must remain exactly pinned');
assert.match(html, /<meta name="ai-miner-ui-schema" content="1">/);
assert.match(js, /new Framework7\(\{/);
assert.match(js, /theme:\s*'ios'/);
assert.match(js, /darkMode:\s*false/);
assert.doesNotMatch(html, /<(?:script|link)\b[^>]+(?:src|href)="https?:/i, 'runtime assets must be local');
assert.doesNotMatch(html, /<select\b/i, 'the action picker must not fall back to a native select');
assert.match(css, /--am-sidebar-width:\s*224px/);
assert.match(css, /--am-content-max:\s*720px/);
assert.match(css, /--am-background:\s*#f2f2f7/i);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

for (const page of ['overview', 'vehicle', 'settings', 'update']) {
  assert.match(html, new RegExp(`id="tab-${page}"[^>]+aria-controls="screen-${page}"`));
  assert.match(html, new RegExp(`id="screen-${page}"[^>]+aria-labelledby="tab-${page}"`));
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
  for (const relativePath of [
    'index.html', 'app.css', 'app.js',
    join('vendor', 'framework7-bundle.min.css'),
    join('vendor', 'framework7-bundle.min.js'),
  ]) {
    await access(join(output, relativePath));
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log('UI source and offline bundle contract checks passed');
