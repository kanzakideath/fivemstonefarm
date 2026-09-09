import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, 'src');
const output = join(root, 'www');
const vendor = join(output, 'vendor');

await rm(output, { recursive: true, force: true });
await mkdir(vendor, { recursive: true });

for (const file of ['index.html', 'app.css', 'app.js']) {
  await copyFile(join(source, file), join(output, file));
}

await cp(join(source, 'metagame'), join(output, 'metagame'), { recursive: true });

for (const file of ['framework7-bundle.min.css', 'framework7-bundle.min.js']) {
  await copyFile(join(root, 'node_modules', 'framework7', file), join(vendor, file));
}

const frameworkPackage = JSON.parse(
  await readFile(join(root, 'node_modules', 'framework7', 'package.json'), 'utf8'),
);
const appPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (frameworkPackage.version !== '9.1.3') {
  throw new Error(`Framework7 version mismatch: ${frameworkPackage.version}`);
}

const buildInfo = {
  schema: 1,
  version: appPackage.version,
  framework: 'Framework7',
  frameworkVersion: frameworkPackage.version,
  offline: true,
  metagame: {
    schemaVersion: 2,
    catalogFiles: 9,
  },
};
await writeFile(join(output, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);

console.log(`Built offline UI in ${output}`);
