import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const main = read('src/mining-auto.ahk');
const module = read('src/verified-storage-navigation.ahk');
const js = read('src/ui-web/src/app.js');
const protocol = read('src/ui-host/Protocol.cs');
const build = read('scripts/Build.ps1');
const body = (name) => {
  const start = main.indexOf(`\n${name}(`);
  assert.notEqual(start, -1, name);
  const next = main.slice(start + 1).search(/\n[A-Za-z][A-Za-z0-9_]*\([^]*?\{/);
  return next < 0 ? main.slice(start) : main.slice(start, start + 1 + next);
};
assert.match(main, /#Include verified-storage-navigation\.ahk/);
assert.match(build, /Copy-Item[^\n]+verified-storage-navigation\.ahk[^\n]+stageRoot/);
assert.match(body('BeginVehicleRegistration'), /BeginCompanionVehicleRegistration\(\)/);
const cycle = body('RunLocalVehicleStorageCycle');
assert.match(cycle, /if Config\.vehicleCompanionProtocol = 1[^]*?FindRegisteredStorageByCompanion/);
assert.ok(cycle.indexOf('FindRegisteredStorageByCompanion') < cycle.indexOf('TryRegisteredStorageViews'));
assert.match(cycle, /NAVIGATION_UNVERIFIED/);
assert.match(body('CompleteVerifiedStorageReturn'), /vehicleCompanionProtocol = 1\s*\? ReturnToWorkByCompanion/);
assert.doesNotMatch(body('FindRegisteredStorageNearby'), /movementSteps|PlayLocalRoute/);
assert.match(module, /ExecuteVerifiedNavigation\(adapter, "go-vehicle"/);
assert.match(module, /ExecuteVerifiedNavigation\(adapter, "return-work"/);
assert.match(module, /actualId = expectedId && code = expectedCode && netId > 0/);
assert.match(main, /testVerifiedNavigationOk := RunVerifiedNavigationSelfTest\(\)/);
assert.match(main, /!testVerifiedNavigationOk \? 175/);
assert.match(module, /ERROR COMPANION_MANUAL_OVERRIDE/);
assert.match(module, /cancelAfterMove/);
assert.match(body('RunWashCompletionRecoveryCycle'), /lastRawStoneCount = 0[^]*?ResumeAfterWashCompletionRecovery/);
assert.match(main, /EmitAutomationAlert\("wash_complete",\s*"石洗いが終わったよ"\)/);
assert.match(protocol, /case "vehicle\.register-local":/);
assert.match(js, /sendAction\('vehicle\.register-local'\)/);
assert.match(read('src/ui-web/src/index.html'), /id="vehicle-register-local"/);
const detailFunction = js.match(/function localVehicleDetail\(item\)\s*\{[^]*?\n  \}/)?.[0];
assert.ok(detailFunction);
const renderDetail = runInNewContext(`(${detailFunction})`, {textOf: (x) => x.text});
for (const text of [
  'サーバー管理者によるai_miner_companionの導入が必要です',
  '補助リソース未接続',
  'サーバー側との照合に失敗しました',
]) assert.equal(renderDetail({text}), text, 'Never hide a setup or ownership failure');
assert.match(renderDetail({text: ''}), /サーバー管理者/);
assert.match(read('fivem-resource/ai_miner_companion/client.lua'), /TaskFollowNavMeshToCoord/);
assert.match(read('fivem-resource/ai_miner_companion/config.server.lua'), /return false/);
console.log('Verified navigation wiring and UI prerequisite tests passed (source/JS checks, not live FiveM).');
