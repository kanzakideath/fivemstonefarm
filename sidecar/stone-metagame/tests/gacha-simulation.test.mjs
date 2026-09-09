import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [gacha, bannersDocument, itemsDocument] = await Promise.all([
  readJson('data/gacha.json'),
  readJson('data/banners.json'),
  readJson('data/items.json'),
]);
const banner = bannersDocument.banners.find((entry) => entry.isDefault);
const items = itemsDocument.items;
const order = new Map(gacha.rarities.map((entry) => [entry.id, entry.order]));

test('1,000,000 base rolls stay inside a six-sigma envelope', () => {
  const random = new DeterministicRandom(0x51f15e);
  const iterations = 1_000_000;
  const weightedRarities = gacha.rarities.map((rarity) => ({
    id: rarity.id,
    weight: banner.rates[rarity.id],
  }));
  const counts = Object.fromEntries(gacha.rarities.map((rarity) => [rarity.id, 0]));
  for (let index = 0; index < iterations; index += 1) {
    counts[pickWeighted(weightedRarities, random).id] += 1;
  }

  for (const rarity of gacha.rarities) {
    const expected = banner.rates[rarity.id] / 10_000;
    const actual = counts[rarity.id] / iterations;
    const sigma = Math.sqrt(expected * (1 - expected) / iterations);
    assert.ok(Math.abs(actual - expected) <= 6 * sigma + 1 / iterations,
      `${rarity.id}: ${(actual * 100).toFixed(4)}% deviates from ${(expected * 100).toFixed(4)}%`);
  }
});

test('100,000 integrated rolls combine guarantees, independent pity tracks, and pickup', () => {
  const random = new DeterministicRandom(0xc0ffee);
  const counters = Object.fromEntries(banner.pityTracks.map((track) => [track.id, 0]));
  const pityTriggers = Object.fromEntries(banner.pityTracks.map((track) => [track.id, 0]));
  const rarityCounts = Object.fromEntries(gacha.rarities.map((rarity) => [rarity.id, 0]));
  const pickupHits = Object.fromEntries(banner.pickups.map((pickup) => [pickup.itemId, 0]));
  const raritySelections = Object.fromEntries(gacha.rarities.map((rarity) => [rarity.id, 0]));
  const tenFloor = order.get(banner.tenPullMinimumRarity);
  const batches = 10_000;

  for (let batch = 0; batch < batches; batch += 1) {
    let hasGuaranteedRarity = false;
    for (let slot = 0; slot < 10; slot += 1) {
      const triggered = banner.pityTracks
        .filter((track) => counters[track.id] + 1 >= track.threshold)
        .sort((left, right) => order.get(right.minimumRarity) - order.get(left.minimumRarity))[0];
      let minimumOrder = triggered ? order.get(triggered.minimumRarity) : 0;
      if (slot === 9 && !hasGuaranteedRarity) minimumOrder = Math.max(minimumOrder, tenFloor);

      const rarity = rollRarity(minimumOrder, random);
      rarityCounts[rarity] += 1;
      raritySelections[rarity] += 1;
      if (order.get(rarity) >= tenFloor) hasGuaranteedRarity = true;
      if (triggered) pityTriggers[triggered.id] += 1;

      const item = rollItem(rarity, random);
      if (Object.hasOwn(pickupHits, item.id)) pickupHits[item.id] += 1;

      for (const track of banner.pityTracks) {
        counters[track.id] = order.get(rarity) >= order.get(track.resetAtOrAbove)
          ? 0 : counters[track.id] + 1;
        assert.ok(counters[track.id] < track.threshold,
          `${track.id} crossed its threshold without resolving`);
      }
    }
    assert.ok(hasGuaranteedRarity, `10-pull ${batch + 1} missed its configured floor`);
  }

  assert.equal(Object.values(rarityCounts).reduce((sum, value) => sum + value, 0), 100_000);
  for (const track of banner.pityTracks) {
    assert.ok(pityTriggers[track.id] > 0, `${track.id} never triggered in the integrated run`);
  }

  for (const pickup of banner.pickups) {
    const item = items.find((entry) => entry.id === pickup.itemId);
    const sampleSize = raritySelections[item.rarity];
    const expected = pickup.shareBasisPoints / 10_000;
    const actual = pickupHits[pickup.itemId] / sampleSize;
    const sigma = Math.sqrt(expected * (1 - expected) / sampleSize);
    assert.ok(Math.abs(actual - expected) <= 6 * sigma + .01,
      `${pickup.itemId}: pickup ${(actual * 100).toFixed(2)}% deviates from ${(expected * 100).toFixed(2)}%`);
  }
});

function rollRarity(minimumOrder, random) {
  const eligible = gacha.rarities
    .filter((rarity) => rarity.order >= minimumOrder)
    .map((rarity) => ({ id: rarity.id, weight: banner.rates[rarity.id] }));
  return pickWeighted(eligible, random).id;
}

function rollItem(rarity, random) {
  let pool = items.filter((item) => item.rarity === rarity
    && (banner.pool.includeSecret || !item.isSecret));
  if (banner.pool.itemIds.length) pool = pool.filter((item) => banner.pool.itemIds.includes(item.id));
  if (banner.pool.categories.length) pool = pool.filter((item) => banner.pool.categories.includes(item.collectionCategory));
  const pickups = banner.pickups.filter((pickup) => pool.some((item) => item.id === pickup.itemId));
  let pickupRoll = random.nextInt(10_000);
  for (const pickup of pickups) {
    if (pickupRoll < pickup.shareBasisPoints) return pool.find((item) => item.id === pickup.itemId);
    pickupRoll -= pickup.shareBasisPoints;
  }
  const pickupIds = new Set(pickups.map((pickup) => pickup.itemId));
  const regular = pool.filter((item) => !pickupIds.has(item.id));
  return pickWeighted((regular.length ? regular : pool).map((item) => ({ ...item, weight: item.weight })), random);
}

function pickWeighted(entries, random) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.weight), 0);
  let roll = random.nextInt(total);
  for (const entry of entries) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return entries.at(-1);
}

class DeterministicRandom {
  constructor(seed) { this.state = seed >>> 0 || 1; }
  nextInt(maximum) {
    assert.ok(Number.isInteger(maximum) && maximum > 0);
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return Math.floor(this.state / 0x1_0000_0000 * maximum);
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), 'utf8'));
}
