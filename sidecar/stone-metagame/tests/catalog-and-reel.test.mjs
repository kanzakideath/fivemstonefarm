import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createCaseReelPlan, createTenRevealPlan } from '../ui/meta-game.js';

async function json(relativePath) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  return JSON.parse(await readFile(path, 'utf8'));
}

const expectedRarities = ['NORMAL', 'RARE', 'SUPER_RARE', 'SSR', 'UR', 'LEGENDARY'];
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test('catalog is data-driven, complete, and internally consistent', async () => {
  const [gacha, itemFile, affinity, achievementFile, messages, bannerFile,
    levelRewardFile, titleFile, assetFile] = await Promise.all([
    json('../data/gacha.json'),
    json('../data/items.json'),
    json('../data/affinity.json'),
    json('../data/achievements.json'),
    json('../data/messages.json'),
    json('../data/banners.json'),
    json('../data/level-rewards.json'),
    json('../data/titles.json'),
    json('../data/assets.json'),
  ]);
  const items = itemFile.items;
  const achievements = achievementFile.achievements;

  assert.equal(gacha.schemaVersion, 2);
  assert.equal(itemFile.schemaVersion, 2);
  assert.equal(affinity.schemaVersion, 2);
  assert.equal(achievementFile.schemaVersion, 2);
  assert.equal(messages.schemaVersion, 2);
  assert.equal(bannerFile.schemaVersion, 1);
  assert.equal(levelRewardFile.schemaVersion, 1);
  assert.equal(titleFile.schemaVersion, 1);
  assert.equal(assetFile.schemaVersion, 1);
  assert.ok(items.length >= 100, `expected 100+ items, received ${items.length}`);

  const rarityIds = gacha.rarities.map((rarity) => rarity.id);
  assert.deepEqual(rarityIds, expectedRarities);
  assert.equal(new Set(gacha.rarities.map((rarity) => rarity.order)).size, expectedRarities.length);
  assert.equal(gacha.rarities.reduce((sum, rarity) => sum + rarity.basisPoints, 0), 10_000);

  const itemIds = new Set();
  const rarityCounts = new Map(expectedRarities.map((rarity) => [rarity, 0]));
  for (const item of items) {
    assert.match(item.id, safeId, `unsafe item id: ${item.id}`);
    assert.ok(!itemIds.has(item.id), `duplicate item id: ${item.id}`);
    itemIds.add(item.id);
    assert.ok(item.name.trim().length > 0, `missing item name: ${item.id}`);
    assert.ok(item.description.trim().length > 0, `missing item description: ${item.id}`);
    assert.ok(expectedRarities.includes(item.rarity), `unknown item rarity: ${item.id}`);
    assert.match(item.image, /^procedural:\/\/(?:stone|frame|avatar)\/[a-z0-9-]{1,80}$/, `invalid item image: ${item.id}`);
    assert.ok(Number.isInteger(item.weight) && item.weight > 0, `invalid item weight: ${item.id}`);
    assert.equal(typeof item.isSecret, 'boolean', `invalid secret flag: ${item.id}`);
    assert.ok(item.collectionCategory.trim().length > 0, `missing category: ${item.id}`);
    rarityCounts.set(item.rarity, rarityCounts.get(item.rarity) + 1);
  }
  for (const [rarity, count] of rarityCounts) assert.ok(count > 0, `${rarity} has no items`);
  assert.ok(bannerFile.banners.length >= 3, 'expected multiple data-driven banners');
  assert.equal(bannerFile.banners.filter((banner) => banner.isDefault).length, 1);
  for (const banner of bannerFile.banners) {
    assert.match(banner.id, safeId);
    assert.equal(Object.values(banner.rates).reduce((sum, rate) => sum + rate, 0), 10_000);
    assert.ok(banner.pityTracks.length >= 3);
    const eligible = items.filter((item) => (!banner.pool.itemIds.length || banner.pool.itemIds.includes(item.id))
      && (!banner.pool.categories.length || banner.pool.categories.includes(item.collectionCategory))
      && (banner.pool.includeSecret || !item.isSecret));
    for (const rarity of expectedRarities) {
      if (banner.rates[rarity] > 0) assert.ok(eligible.some((item) => item.rarity === rarity),
        `${banner.id} has no eligible ${rarity} item`);
    }
    for (const pickup of banner.pickups) {
      assert.ok(itemIds.has(pickup.itemId), `unknown pickup item: ${pickup.itemId}`);
      assert.ok(eligible.some((item) => item.id === pickup.itemId),
        `${pickup.itemId} is outside ${banner.id}'s pool`);
      assert.ok(pickup.shareBasisPoints > 0 && pickup.shareBasisPoints <= 10_000);
    }
  }

  assert.ok(levelRewardFile.rewards.length >= 5, 'level rewards must be data-driven');
  assert.ok(titleFile.titles.some((title) => title.id === 'rookie-miner'));
  assert.ok(assetFile.assets.some((asset) => asset.id === 'missing-stone'));

  assert.equal(affinity.ranks[0].mined, 0);
  assert.ok(affinity.ranks.length >= 10);
  affinity.ranks.forEach((rank, index) => {
    assert.match(rank.id, safeId);
    if (index) assert.ok(rank.mined > affinity.ranks[index - 1].mined, 'affinity ranks must be ascending');
  });

  const achievementIds = new Set();
  const achievementTiers = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'SECRET']);
  const achievementCategories = new Set(['MINING', 'GACHA', 'COLLECTION', 'RELATIONSHIP', 'PROFILE', 'SECRET']);
  const conditionTypes = new Set([
    'minedTotal', 'minedDaily', 'minedAtLocalHour', 'longestSessionMinutes',
    'activeMinutes', 'gachaTotal', 'rarityCountAtLeast', 'maxDuplicateCount',
    'collectionPercent', 'affinityMax', 'ssrMissStreak', 'rarityInLastBatchAtLeast',
    'miningLevel', 'favoriteCount', 'profileCustomIcon', 'profileTitleEquipped',
    'fragmentTotal', 'tenPullBatches',
  ]);
  for (const achievement of achievements) {
    assert.match(achievement.id, safeId);
    assert.ok(!achievementIds.has(achievement.id), `duplicate achievement id: ${achievement.id}`);
    achievementIds.add(achievement.id);
    assert.ok(achievementTiers.has(achievement.tier));
    assert.ok(achievementCategories.has(achievement.category));
    assert.ok(conditionTypes.has(achievement.condition.type), `unknown condition: ${achievement.condition.type}`);
    if (achievement.condition.rarity) assert.ok(expectedRarities.includes(achievement.condition.rarity));
  }

  assert.ok(messages.badPull.length >= 3);
  assert.ok(messages.legendary.length >= 3);
  assert.ok(messages.newItem.length >= 3);
  messages.milestones.forEach((milestone, index) => {
    if (index) assert.ok(milestone.mined > messages.milestones[index - 1].mined);
  });
});

test('single-draw reel always stops on the already-decided backend result', async () => {
  const [gacha, itemFile] = await Promise.all([
    json('../data/gacha.json'),
    json('../data/items.json'),
  ]);
  const result = itemFile.items.find((item) => item.id === 'origin-stone');
  assert.ok(result, 'fixture result item is missing');

  const plan = createCaseReelPlan(itemFile.items, result, result.rarity, gacha.presentation);
  assert.equal(plan.items.length, gacha.presentation.singleReelCards);
  assert.equal(plan.targetIndex, gacha.presentation.singleTargetIndex);
  assert.equal(plan.items[plan.targetIndex].id, result.id);
  assert.equal(plan.resultItemId, result.id);

  const second = createCaseReelPlan(itemFile.items, result, result.rarity, gacha.presentation);
  assert.deepEqual(second.items.map((item) => item.id), plan.items.map((item) => item.id));
});

test('reel rejects unsafe layouts instead of silently selecting a wrong target', async () => {
  const itemFile = await json('../data/items.json');
  const result = itemFile.items[0];
  assert.throws(
    () => createCaseReelPlan(itemFile.items, result, result.rarity,
      { singleReelCards: 10, singleTargetIndex: 9 }),
    /Invalid reel configuration/,
  );
  assert.throws(
    () => createCaseReelPlan([], result, result.rarity,
      { singleReelCards: 48, singleTargetIndex: 42 }),
    /Reel catalog and result are required/,
  );
});

test('ten-pull reveal plans preserve every decided result and support multiple layouts', () => {
  const modes = new Set();
  for (let attempt = 0; attempt < 200 && modes.size < 3; attempt += 1) {
    const results = Array.from({ length: 10 }, (_, index) => ({
      itemId: `stone-${attempt}-${index}`,
      rarity: ['NORMAL', 'RARE', 'SUPER_RARE', 'SSR', 'UR'][index % 5],
      ownedCount: attempt + index + 1,
      pityTrackId: index === 9 ? `track-${attempt}` : '',
    }));
    const plan = createTenRevealPlan(results);
    modes.add(plan.mode);
    assert.equal(plan.results.length, results.length);
    assert.deepEqual(new Set(plan.results), new Set(results));
    if (plan.mode === 'ascending') {
      const order = plan.results.map((entry) => expectedRarities.indexOf(entry.rarity));
      assert.deepEqual(order, order.slice().sort((a, b) => a - b));
    }
    if (plan.mode === 'high-last') assert.equal(plan.results.at(-1).rarity, 'UR');
  }
  assert.deepEqual(modes, new Set(['ascending', 'high-last', 'random']));
  assert.throws(() => createTenRevealPlan([]), /Ten-pull results are required/);
});

test('preview and production-facing UI contain no remote CDN dependency', async () => {
  const [template, demo, css] = await Promise.all([
    readFile(fileURLToPath(new URL('../ui/meta-game-template.html', import.meta.url)), 'utf8'),
    readFile(fileURLToPath(new URL('../demo/index.html', import.meta.url)), 'utf8'),
    readFile(fileURLToPath(new URL('../ui/meta-game.css', import.meta.url)), 'utf8'),
  ]);
  const combined = `${template}\n${demo}\n${css}`;
  assert.doesNotMatch(combined, /(?:src|href)=["']https?:\/\//i);

  for (const hook of [
    'data-meta-app', 'data-screen="home"', 'data-screen="affinity"', 'data-screen="gacha"',
    'data-screen="collection"', 'data-screen="achievements"',
    'data-screen="profile"', 'data-cinematic', 'data-modal-layer', 'data-result-message',
    'data-ten-grid', 'data-affinity-timeline', 'data-profile-playtime', 'data-onboarding-copy="0"',
  ]) assert.ok(template.includes(hook), `missing UI contract hook: ${hook}`);

  for (const component of [
    '.home-dashboard', '.gacha-layout', '.collection-grid', '.achievement-list',
    '.profile-layout', '.meta-choice-group', '.meta-cinematic[data-rarity="UR"]',
  ]) assert.ok(css.includes(component), `missing presentation component: ${component}`);
});
