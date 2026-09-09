const STORAGE_KEY = 'ai-miner-stone-metagame-preview-v1';
const BACKUP_KEY = `${STORAGE_KEY}:backup`;
const RARITY_ORDER = ['NORMAL', 'RARE', 'SUPER_RARE', 'SSR', 'UR', 'LEGENDARY'];

export class DemoMetaGameAdapter {
  constructor(baseUrl = '../data/', options = {}) {
    this.baseUrl = baseUrl;
    this.options = options;
    this.listeners = new Set();
    this.catalog = null;
    this.state = null;
  }

  async bootstrap() {
    if (!this.catalog) {
      const [gacha, items, affinity, achievements, messages, banners, levelRewards, titles, assets] = await Promise.all(
        ['gacha.json', 'items.json', 'affinity.json', 'achievements.json', 'messages.json',
          'banners.json', 'level-rewards.json', 'titles.json', 'assets.json']
          .map(async (name) => {
            const response = await fetch(new URL(name, new URL(this.baseUrl, location.href)), { cache: 'no-store' });
            if (!response.ok) throw new Error(`${name}: ${response.status}`);
            return response.json();
          }),
      );
      this.catalog = {
        gacha, items: items.items, affinityRanks: affinity.ranks,
        achievements: achievements.achievements, messages,
        banners: banners.banners, levelRewards: levelRewards.rewards,
        titles: titles.titles, assets: assets.assets,
      };
      this.itemById = new Map(this.catalog.items.map((item) => [item.id, item]));
      this.rarityById = new Map(gacha.rarities.map((rarity) => [rarity.id, rarity]));
      this.state = this.load() || this.seedState();
      this.reconcileState();
      this.save();
    }
    return { type: 'meta.bootstrap', catalog: this.catalog, snapshot: this.snapshot(), developmentMode: true };
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async execute(action, payload) {
    let result;
    try {
      switch (action) {
        case 'gacha.draw': result = this.draw(payload.requestId, payload.bannerId, payload.count, payload.payment); break;
        case 'profile.rename': result = this.rename(payload.name); break;
        case 'profile.appearance': result = this.appearance(payload); break;
        case 'profile.title': result = this.title(payload.titleId); break;
        case 'profile.update': result = this.updateProfile(payload); break;
        case 'collection.favorite': result = this.favorite(payload.itemId, payload.favorite); break;
        case 'collection.acknowledge': result = this.acknowledge(payload.itemId); break;
        case 'reward.claim': result = this.claimReward(payload.grantId); break;
        case 'reward.claimAll': result = this.claimAllRewards(); break;
        case 'onboarding.complete': result = this.completeOnboarding(); break;
        case 'settings.update': result = this.settings(payload); break;
        case 'debug.grantPoints': result = this.grantPoints(payload.amount); break;
        case 'debug.setMined': result = this.setMined(payload.total); break;
        case 'debug.addXp': result = this.addXp(payload.amount); break;
        case 'debug.advanceAffinity': result = this.advanceAffinity(); break;
        case 'debug.unlockAchievement': result = this.unlockAchievement(payload.id); break;
        case 'debug.forceDraw': result = this.draw(payload.requestId, payload.bannerId, payload.count, 'auto', payload.rarity, payload); break;
        case 'debug.primePity': result = this.primePity(payload.kind); break;
        case 'debug.setPity': result = this.setPity(payload.bannerId, payload.trackId, payload.value); break;
        default: result = { ok: false, error: 'META_ACTION_NOT_ALLOWED', snapshot: this.snapshot() };
      }
    } catch (error) {
      result = { ok: false, error: error.message, snapshot: this.snapshot() };
    }
    await new Promise((resolve) => setTimeout(resolve, 45));
    return { type: 'meta.result', result };
  }

  seedState() {
    const now = new Date();
    const day = dayKey(now);
    const collection = {};
    this.catalog.items.slice(0, 14).forEach((item, index) => {
      collection[item.id] = { itemId: item.id, count: index + 1, firstAcquiredAtUtc: new Date(now - (index + 1) * 86400000).toISOString(), lastAcquiredAtUtc: now.toISOString(), favorite: index < 2, seen: index > 1 };
    });
    ['golden-frame', 'stone-avatar-royal'].forEach((id) => {
      collection[id] = { itemId: id, count: 1, firstAcquiredAtUtc: now.toISOString(), lastAcquiredAtUtc: now.toISOString(), favorite: false, seen: true };
    });
    const history = [
      ['ordinary-stone', 'NORMAL', false, false, 1],
      ['round-stone', 'NORMAL', false, false, 10],
      ['golden-frame', 'SSR', true, true, 10],
      ['origin-stone', 'UR', true, false, 1],
    ].map(([itemId, rarity, wasNew, wasFakeout, batchSize], index) => ({
      sequence: 19 + index, bannerId: 'eternal-stone', bannerName: 'ETERNAL STONE',
      drawnAtUtc: new Date(now - (4 - index) * 3600000).toISOString(),
      requestId: `draw:preview:history:${index + 1}`,
      batchSize,
      itemId,
      rarity, presentationVariant: '', nominalBasisPoints: this.catalog.gacha.rarities.find((entry) => entry.id === rarity)?.basisPoints || 0,
      pityCountBefore: index + 3, pityTrackId: '',
      wasNew,
      wasFakeout,
    }));
    return {
      schemaVersion: 2,
      profile: { name: 'Miner', icon: 'builtin:stone', frame: 'builtin:default', titleId: 'rookie-miner', onboardingComplete: !this.options.onboarding, customIconDataUri: '', createdAtUtc: new Date(now - 90 * 86400000).toISOString() },
      mining: { totalStoneMined: 8642, miningXp: 8642, miningLevel: this.levelForXp(8642), availableMiningPoints: 12483, totalMiningPointsEarned: 12483, gachaTickets: 12, stoneFragments: 184, totalStoneFragmentsEarned: 184, totalActiveSeconds: 25200, longestSessionSeconds: 4200, dailyTotals: { [day]: 184 }, lastMinedAtUtc: now.toISOString() },
      gacha: { totalDraws: 22, singleDraws: 12, tenPullBatches: 1, ssrMisses: 37, urMisses: 128, currentSsrMissStreak: 37, worstSsrMissStreak: 44, currentUrMissStreak: 128, worstUrMissStreak: 128, bestHighRarityBatch: 1, bestLegendaryBatch: 0, highestRarity: 'SSR', rarityCounts: { NORMAL: 15, RARE: 5, SUPER_RARE: 1, SSR: 1, UR: 0, LEGENDARY: 0 }, history, bannerProgress: { 'eternal-stone': { bannerId: 'eternal-stone', totalDraws: 22, pityCounters: { 'ssr-pity': 37, 'ur-pity': 128, 'legendary-spark': 22 } } } },
      achievements: {}, collection, rewardGrants: {}, ownedTitles: { 'rookie-miner': now.toISOString() },
      settings: { masterVolume: .8, bgmVolume: .45, sfxVolume: .8, muted: false, effectQuality: 'normal', reduceMotion: false, animationSpeed: 'normal', skipPreviouslySeenLegendary: false },
      receipts: [],
    };
  }

  reconcileState() {
    const state = this.state;
    const now = new Date().toISOString();
    state.achievements ||= {};
    state.collection ||= {};
    state.rewardGrants ||= {};
    state.ownedTitles ||= {};
    state.receipts ||= [];
    state.gacha ||= {};
    state.gacha.bannerProgress ||= {};
    state.gacha.rarityCounts ||= {};
    state.gacha.history ||= [];
    state.settings = {
      masterVolume: .8, bgmVolume: .45, sfxVolume: .8, muted: false,
      effectQuality: 'normal', reduceMotion: false, animationSpeed: 'normal',
      skipPreviouslySeenLegendary: false,
      ...(state.settings || {}),
    };
    state.profile ||= {};
    state.profile.titleId ||= 'rookie-miner';
    state.profile.onboardingComplete ??= true;
    state.ownedTitles['rookie-miner'] ||= state.profile.createdAtUtc || now;

    this.catalog.banners.forEach((banner) => this.bannerProgress(banner));

    // Preview saves can begin with believable lifetime statistics. Reconcile milestones as
    // historical claims so the UI never shows a completed progress bar as still locked and
    // never grants migration-time currency a second time.
    this.catalog.achievements.forEach((achievement) => {
      if (state.achievements[achievement.id] || !this.condition(achievement.condition, [])) return;
      state.achievements[achievement.id] = {
        achievementId: achievement.id,
        unlockedAtUtc: state.profile.createdAtUtc || now,
        rewardClaimed: true,
        rewardClaimedAtUtc: state.profile.createdAtUtc || now,
      };
    });
    if (state.mining.totalStoneMined > 0 && Object.keys(state.rewardGrants).length === 0) {
      const claimedAt = state.profile.createdAtUtc || now;
      this.catalog.levelRewards
        .filter((reward) => reward.level <= state.mining.miningLevel)
        .forEach((reward) => this.addHistoricalGrant('level', String(reward.level), claimedAt));
      this.catalog.affinityRanks
        .filter((rank) => rank.mined > 0 && rank.mined <= state.mining.totalStoneMined && rank.rewards?.length)
        .forEach((rank) => this.addHistoricalGrant('affinity', rank.id, claimedAt));
      Object.values(state.achievements)
        .filter((progress) => progress.rewardClaimed)
        .forEach((progress) => this.addHistoricalGrant('achievement', progress.achievementId, claimedAt));
    }
  }

  addHistoricalGrant(sourceType, sourceId, claimedAt) {
    const grantId = `${sourceType}:${sourceId}`;
    if (this.state.rewardGrants[grantId]) return;
    this.state.rewardGrants[grantId] = {
      grantId, sourceType, sourceId, unlockedAtUtc: claimedAt,
      claimed: true, claimedAtUtc: claimedAt,
    };
  }

  snapshot() {
    const affinity = this.affinityView();
    const daily = this.state.mining.dailyTotals || {};
    const today = new Date();
    const weekStart = new Date(today); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    let todayTotal = 0; let week = 0; let month = 0;
    Object.entries(daily).forEach(([key, count]) => {
      const date = new Date(`${key}T00:00:00`);
      if (key === dayKey(today)) todayTotal += count;
      if (date >= weekStart && date <= today) week += count;
      if (date >= monthStart && date <= today) month += count;
    });
    const achievementViews = this.catalog.achievements.map((definition) => {
      const unlocked = this.state.achievements[definition.id];
      const target = Number(definition.condition.value || 1);
      const current = Math.min(target, this.conditionCurrent(definition.condition));
      return { id: definition.id, unlocked: Boolean(unlocked), rewardClaimed: Boolean(unlocked?.rewardClaimed), current, target, progress: Math.min(1, current / target) };
    });
    const rewardGrantViews = Object.values(this.state.rewardGrants || {}).map((grant) => ({ ...grant, title: this.grantTitle(grant), rewards: this.grantRewards(grant) })).sort((a, b) => String(b.unlockedAtUtc).localeCompare(String(a.unlockedAtUtc)));
    const rarityCounts = Object.fromEntries(RARITY_ORDER.map((rarity) => [rarity, Number(this.state.gacha.rarityCounts[rarity] || 0)]));
    const totalDraws = Number(this.state.gacha.totalDraws || 0);
    const publishedRates = Object.fromEntries(this.catalog.gacha.rarities.map((rarity) => [rarity.id, rarity.basisPoints / 100]));
    const actualRates = Object.fromEntries(RARITY_ORDER.map((rarity) => [rarity, totalDraws ? rarityCounts[rarity] / totalDraws * 100 : 0]));
    const levelProgress = this.levelProgress(this.state.mining.miningXp);
    const pendingRewardCount = rewardGrantViews.filter((grant) => !grant.claimed).length;
    const collectionOwned = Object.keys(this.state.collection).length;
    const collectionPercent = collectionOwned / this.catalog.items.length * 100;
    const snapshot = {
      schemaVersion: 2, profile: this.state.profile, mining: this.state.mining,
      gacha: this.state.gacha, achievements: this.state.achievements,
      collection: this.state.collection, settings: this.state.settings, affinity,
      statistics: { today: todayTotal, week, month, lifetime: this.state.mining.totalStoneMined },
      collectionTotal: this.catalog.items.length,
      collectionOwned,
      collectionPercent,
      achievementTotal: this.catalog.achievements.length,
      achievementUnlocked: Object.keys(this.state.achievements).length,
      pendingRewardCount,
      unseenCollectionCount: Object.values(this.state.collection).filter((entry) => !entry.seen).length,
      levelProgress,
      gachaStatistics: { totalDraws, singleDraws: this.state.gacha.singleDraws, tenPullBatches: this.state.gacha.tenPullBatches, worstSsrMissStreak: this.state.gacha.worstSsrMissStreak, worstUrMissStreak: this.state.gacha.worstUrMissStreak, bestHighRarityBatch: this.state.gacha.bestHighRarityBatch, bestLegendaryBatch: this.state.gacha.bestLegendaryBatch, rarityCounts, actualRates, publishedRates },
      achievementViews, rewardGrantViews,
      ownedTitles: this.state.ownedTitles || {},
    };
    snapshot.homeGoals = this.homeGoals(snapshot);
    return clone(snapshot);
  }

  levelProgress(xp) {
    const progression = this.catalog.gacha.progression;
    let level = 1; let start = 0;
    while (level < progression.maximumLevel) {
      const required = Math.ceil(progression.levelBaseXp * level ** progression.levelExponent);
      if (xp < start + required) return { level, totalXp: xp, levelStartXp: start, nextLevelXp: start + required, xpIntoLevel: xp - start, xpRequired: required, progress: (xp - start) / required, nextReward: this.catalog.levelRewards.find((reward) => reward.level > level) || null };
      start += required; level += 1;
    }
    return { level, totalXp: xp, levelStartXp: start, nextLevelXp: start, xpIntoLevel: 0, xpRequired: 0, progress: 1, nextReward: null };
  }

  homeGoals(snapshot) {
    const goals = [];
    if (snapshot.pendingRewardCount) goals.push({ id: 'pending-rewards', kind: 'reward', label: '受け取れる報酬があります', rewardLabel: `${snapshot.pendingRewardCount}件`, current: snapshot.pendingRewardCount, target: snapshot.pendingRewardCount, remaining: 0, progress: 1 });
    const every = this.catalog.gacha.economy.ticketEveryMines;
    const nextTicket = (Math.floor(snapshot.mining.totalStoneMined / every) + 1) * every;
    goals.push({ id: 'ticket', kind: 'mining', label: '次のガチャチケット', rewardLabel: `チケット ×${this.catalog.gacha.economy.ticketsPerMilestone}`, current: snapshot.mining.totalStoneMined % every, target: every, remaining: nextTicket - snapshot.mining.totalStoneMined, progress: (snapshot.mining.totalStoneMined % every) / every });
    if (!snapshot.affinity.isMaximum) goals.push({ id: 'affinity', kind: 'affinity', label: `好感度「${this.catalog.affinityRanks.find((rank) => rank.mined === snapshot.affinity.nextAt)?.name || '次の関係'}」`, rewardLabel: '関係イベント', current: snapshot.affinity.current - snapshot.affinity.rankStart, target: snapshot.affinity.nextAt - snapshot.affinity.rankStart, remaining: snapshot.affinity.remaining, progress: snapshot.affinity.progress });
    if (snapshot.levelProgress.xpRequired) goals.push({ id: 'level', kind: 'level', label: `Mining LV.${snapshot.levelProgress.level + 1}`, rewardLabel: snapshot.levelProgress.nextReward?.name || 'レベルアップ', current: snapshot.levelProgress.xpIntoLevel, target: snapshot.levelProgress.xpRequired, remaining: snapshot.levelProgress.xpRequired - snapshot.levelProgress.xpIntoLevel, progress: snapshot.levelProgress.progress });
    const nextPercent = [25, 50, 75, 100].find((value) => snapshot.collectionPercent < value);
    if (nextPercent) { const target = Math.ceil(this.catalog.items.length * nextPercent / 100); goals.push({ id: 'collection', kind: 'collection', label: `COLLECTION ${nextPercent}%`, rewardLabel: '図鑑進捗', current: snapshot.collectionOwned, target, remaining: Math.max(0, target - snapshot.collectionOwned), progress: snapshot.collectionOwned / target }); }
    return goals.slice(0, 4);
  }

  draw(requestId, bannerId, count, payment = 'auto', forcedRarity = '', debug = {}) {
    if (![1, 10].includes(count) || !/^draw:[A-Za-z0-9:._-]{8,}$/.test(requestId)) return this.failure('INVALID_DRAW');
    const old = this.state.receipts.find((receipt) => receipt.requestId === requestId);
    if (old) return { ok: true, duplicate: true, draw: clone(old), events: [], snapshot: this.snapshot() };
    const banner = this.catalog.banners.find((entry) => entry.id === bannerId)
      || this.catalog.banners.find((entry) => entry.isDefault);
    if (!banner) return this.failure('INVALID_BANNER');
    const cost = count === 10 ? banner.tenPullCost : banner.cost;
    let selected = payment;
    if (payment === 'auto') selected = this.state.mining.gachaTickets >= count ? 'tickets' : 'points';
    if (selected === 'tickets' && this.state.mining.gachaTickets < count) return this.failure('INSUFFICIENT_GACHA_CURRENCY');
    if (selected === 'points' && this.state.mining.availableMiningPoints < cost) return this.failure('INSUFFICIENT_GACHA_CURRENCY');
    if (!['tickets', 'points'].includes(selected)) return this.failure('INVALID_PAYMENT');
    if (selected === 'tickets') this.state.mining.gachaTickets -= count; else this.state.mining.availableMiningPoints -= cost;

    const receipt = { requestId, drawnAtUtc: new Date().toISOString(), bannerId: banner.id, bannerName: banner.name, count, payment: selected, pointsSpent: selected === 'points' ? cost : 0, ticketsSpent: selected === 'tickets' ? count : 0, results: [] };
    const bannerProgress = this.bannerProgress(banner);
    const tenFloor = rarityOrder(banner.tenPullMinimumRarity);
    for (let index = 0; index < count; index += 1) {
      const triggered = banner.pityTracks.filter((track) => bannerProgress.pityCounters[track.id] + 1 >= track.threshold)
        .sort((a, b) => rarityOrder(b.minimumRarity) - rarityOrder(a.minimumRarity))[0];
      let floor = triggered ? rarityOrder(triggered.minimumRarity) : 0;
      if (count === 10 && index === 9 && !receipt.results.some((item) => rarityOrder(item.rarity) >= tenFloor)) floor = Math.max(floor, tenFloor);
      const rarity = forcedRarity || this.rollRarity(banner, floor);
      const item = this.rollItem(banner, rarity);
      const owned = this.state.collection[item.id]; const isNew = !owned;
      const entry = owned || { itemId: item.id, count: 0, firstAcquiredAtUtc: receipt.drawnAtUtc, favorite: false, seen: false };
      entry.count += 1; entry.lastAcquiredAtUtc = receipt.drawnAtUtc; if (isNew) entry.seen = false; this.state.collection[item.id] = entry;
      const fragmentsGained = isNew ? 0 : Number(this.catalog.gacha.economy.duplicateFragments[rarity] || 0);
      this.state.mining.stoneFragments += fragmentsGained;
      this.state.mining.totalStoneFragmentsEarned += fragmentsGained;
      const fakeChance = this.catalog.gacha.presentation.fakeoutBasisPoints[rarity] || 0;
      const fakeout = debug.fakeout ?? (secureInt(10000) < fakeChance);
      const order = rarityOrder(rarity);
      const variants = this.catalog.gacha.presentation.highRarityVariants[rarity] || [];
      const presentationVariant = debug.variant || (variants.length ? variants[secureInt(variants.length)] : '');
      const cueChance = this.catalog.gacha.presentation.preCueBasisPoints[rarity] || 0;
      const preCue = debug.preCue || (secureInt(10000) < cueChance ? 'stone-signal' : '');
      const pityBefore = triggered ? bannerProgress.pityCounters[triggered.id] : 0;
      const result = { itemId: item.id, rarity, isNew, ownedCount: entry.count, fakeout, presentedFromRarity: fakeout ? RARITY_ORDER[Math.max(0, order - (order >= 4 ? 1 : 2))] : rarity, pityTriggered: Boolean(triggered), pityTrackId: triggered?.id || '', pityCountBefore: pityBefore, nominalBasisPoints: Number(banner.rates[rarity] || 0), fragmentsGained, presentationVariant, preCue };
      receipt.results.push(result);
      this.state.gacha.totalDraws += 1;
      this.state.gacha.rarityCounts[rarity] = (this.state.gacha.rarityCounts[rarity] || 0) + 1;
      if (order >= rarityOrder('SSR')) { this.state.gacha.ssrMisses = 0; this.state.gacha.currentSsrMissStreak = 0; }
      else { this.state.gacha.ssrMisses += 1; this.state.gacha.currentSsrMissStreak += 1; this.state.gacha.worstSsrMissStreak = Math.max(this.state.gacha.worstSsrMissStreak, this.state.gacha.currentSsrMissStreak); }
      if (order >= rarityOrder('UR')) { this.state.gacha.urMisses = 0; this.state.gacha.currentUrMissStreak = 0; }
      else { this.state.gacha.urMisses += 1; this.state.gacha.currentUrMissStreak += 1; this.state.gacha.worstUrMissStreak = Math.max(this.state.gacha.worstUrMissStreak, this.state.gacha.currentUrMissStreak); }
      if (!this.state.gacha.highestRarity || order > rarityOrder(this.state.gacha.highestRarity)) this.state.gacha.highestRarity = rarity;
      banner.pityTracks.forEach((track) => { bannerProgress.pityCounters[track.id] = order >= rarityOrder(track.resetAtOrAbove) ? 0 : bannerProgress.pityCounters[track.id] + 1; });
      bannerProgress.totalDraws += 1;
      this.state.gacha.history.push({ sequence: this.state.gacha.totalDraws, drawnAtUtc: receipt.drawnAtUtc, requestId, bannerId: banner.id, bannerName: banner.name, batchSize: count, itemId: item.id, rarity, wasNew: isNew, wasFakeout: fakeout, presentationVariant, nominalBasisPoints: result.nominalBasisPoints, pityCountBefore: pityBefore, pityTrackId: result.pityTrackId });
    }
    if (count === 1) this.state.gacha.singleDraws += 1; else this.state.gacha.tenPullBatches += 1;
    const highCount = receipt.results.filter((result) => rarityOrder(result.rarity) >= rarityOrder('SSR')).length;
    const legendaryCount = receipt.results.filter((result) => result.rarity === 'LEGENDARY').length;
    this.state.gacha.bestHighRarityBatch = Math.max(this.state.gacha.bestHighRarityBatch, highCount);
    this.state.gacha.bestLegendaryBatch = Math.max(this.state.gacha.bestLegendaryBatch, legendaryCount);
    const defaultProgress = this.bannerProgress(this.catalog.banners.find((entry) => entry.isDefault));
    this.state.gacha.ssrMisses = defaultProgress.pityCounters['ssr-pity'] || 0;
    this.state.gacha.urMisses = defaultProgress.pityCounters['ur-pity'] || 0;
    this.state.gacha.history = this.state.gacha.history.slice(-this.catalog.gacha.economy.historyLimit);
    this.state.receipts.push(receipt); this.state.receipts = this.state.receipts.slice(-32);
    const events = this.unlockAchievements(receipt.results);
    this.save();
    return { ok: true, duplicate: false, draw: clone(receipt), events, snapshot: this.snapshot() };
  }

  rollRarity(banner, floor) {
    const allowed = this.catalog.gacha.rarities.filter((item) => item.order >= floor)
      .map((item) => ({ ...item, basisPoints: banner.rates[item.id] || 0 }));
    return weighted(allowed, 'basisPoints').id;
  }

  rollItem(banner, rarity) {
    let pool = this.catalog.items.filter((item) => item.rarity === rarity && (banner.pool.includeSecret || !item.isSecret));
    if (banner.pool.itemIds.length) pool = pool.filter((item) => banner.pool.itemIds.includes(item.id));
    if (banner.pool.categories.length) pool = pool.filter((item) => banner.pool.categories.includes(item.collectionCategory));
    const pickups = banner.pickups.filter((pickup) => pool.some((item) => item.id === pickup.itemId));
    const pickupShare = pickups.reduce((sum, pickup) => sum + pickup.shareBasisPoints, 0);
    if (pickups.length && secureInt(10000) < pickupShare) return this.itemById.get(weighted(pickups, 'shareBasisPoints').itemId);
    const pickupIds = new Set(pickups.map((pickup) => pickup.itemId));
    const regular = pool.filter((item) => !pickupIds.has(item.id));
    return weighted(regular.length ? regular : pool);
  }

  bannerProgress(banner) {
    if (!this.state.gacha.bannerProgress[banner.id]) this.state.gacha.bannerProgress[banner.id] = { bannerId: banner.id, totalDraws: 0, pityCounters: {} };
    const progress = this.state.gacha.bannerProgress[banner.id];
    banner.pityTracks.forEach((track) => { if (!Number.isInteger(progress.pityCounters[track.id])) progress.pityCounters[track.id] = 0; });
    return progress;
  }

  rename(name) {
    const clean = String(name || '').trim(); if (!clean || clean.length > 24) return this.failure('INVALID_PROFILE_NAME');
    this.state.profile.name = clean; this.save(); return this.success();
  }
  appearance(payload) {
    this.state.profile.icon = payload.icon; this.state.profile.frame = payload.frame;
    this.state.profile.customIconDataUri = payload.icon === 'custom:image' ? payload.customIconDataUri : '';
    const events = this.unlockAchievements([]); this.save(); return this.success(events);
  }
  title(titleId) {
    if (!this.catalog.titles.some((entry) => entry.id === titleId) || !this.state.ownedTitles[titleId]) return this.failure('PROFILE_TITLE_NOT_OWNED');
    this.state.profile.titleId = titleId; const events = this.unlockAchievements([]); this.save(); return this.success(events);
  }
  updateProfile(payload) {
    const clean = String(payload.name || '').trim();
    if (!clean || clean.length > 24 || /[\u0000-\u001f\u007f]/.test(clean)) return this.failure('INVALID_PROFILE_NAME');
    if (!this.canUseAppearance(payload.icon, 'profileIcon', payload.customIconDataUri)
      || !this.canUseAppearance(payload.frame, 'profileFrame', '')) return this.failure('PROFILE_APPEARANCE_NOT_OWNED');
    if (!this.catalog.titles.some((entry) => entry.id === payload.titleId)
      || !this.state.ownedTitles[payload.titleId]) return this.failure('PROFILE_TITLE_NOT_OWNED');
    this.state.profile.name = clean;
    this.state.profile.icon = payload.icon;
    this.state.profile.frame = payload.frame;
    this.state.profile.customIconDataUri = payload.icon === 'custom:image' ? payload.customIconDataUri : '';
    this.state.profile.titleId = payload.titleId;
    const events = this.unlockAchievements([]); this.save(); return this.success(events);
  }
  canUseAppearance(value, rewardType, custom) {
    if (rewardType === 'profileIcon' && (value === 'builtin:stone' || value === 'custom:image')) {
      return value !== 'custom:image' || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(custom || ''));
    }
    if (rewardType === 'profileFrame' && value === 'builtin:default') return true;
    if (!String(value || '').startsWith('item:')) return false;
    const item = this.itemById.get(value.slice(5));
    return item?.rewardType === rewardType && Boolean(this.state.collection[item.id]);
  }
  favorite(itemId, favorite) { const entry = this.state.collection[itemId]; if (!entry) return this.failure('COLLECTION_ITEM_NOT_OWNED'); entry.favorite = Boolean(favorite); const events = this.unlockAchievements([]); this.save(); return this.success(events); }
  acknowledge(itemId) { const entry = this.state.collection[itemId]; if (!entry) return this.failure('COLLECTION_ITEM_NOT_OWNED'); entry.seen = true; this.save(); return this.success(); }
  completeOnboarding() { this.state.profile.onboardingComplete = true; this.save(); return this.success(); }
  settings(payload) { this.state.settings = { ...this.state.settings, ...payload }; this.save(); return this.success(); }
  grantPoints(amount) { this.state.mining.availableMiningPoints += Number(amount); this.state.mining.totalMiningPointsEarned += Number(amount); this.save(); return this.success(); }
  addXp(amount) {
    const previousLevel = this.state.mining.miningLevel;
    this.state.mining.miningXp += Number(amount);
    this.state.mining.miningLevel = this.levelForXp(this.state.mining.miningXp);
    const events = [];
    this.appendLevelCrossings(previousLevel, this.state.mining.miningLevel, events);
    events.push(...this.unlockAchievements([]));
    this.save();
    return this.success(events);
  }
  setMined(total) {
    const previousTotal = this.state.mining.totalStoneMined;
    const previousLevel = this.state.mining.miningLevel;
    this.state.mining.totalStoneMined = Number(total); this.state.mining.miningXp = Number(total); this.state.mining.miningLevel = this.levelForXp(Number(total));
    this.state.mining.dailyTotals[dayKey(new Date())] = Number(total);
    const events = [];
    if (Number(total) > previousTotal) {
      this.appendAffinityCrossings(previousTotal, Number(total), events);
      this.appendLevelCrossings(previousLevel, this.state.mining.miningLevel, events);
    }
    events.push(...this.unlockAchievements([]));
    this.save(); return this.success(events);
  }

  appendLevelCrossings(previousLevel, currentLevel, events) {
    if (currentLevel <= previousLevel) return;
    const crossed = this.catalog.levelRewards
      .filter((reward) => reward.level > previousLevel && reward.level <= currentLevel);
    crossed.forEach((reward) => {
      const grantId = this.createGrant('level', String(reward.level));
      events.push({ type: 'reward.available', id: `level-${reward.level}`, title: reward.name,
        subtitle: `LV.${reward.level} 到達報酬`, rarity: reward.level >= 50 ? 'LEGENDARY' : 'RARE',
        rewards: reward.rewards || [], grantId });
    });
    events.unshift({ type: 'mining.levelUp', id: `level-${currentLevel}`, title: 'MINING LEVEL UP',
      subtitle: `LV.${previousLevel} → LV.${currentLevel}`, previous: String(previousLevel),
      current: String(currentLevel), rarity: currentLevel >= 100 ? 'LEGENDARY' : currentLevel >= 50 ? 'SSR' : 'SUPER_RARE',
      rewards: crossed.flatMap((reward) => reward.rewards || []) });
  }

  appendAffinityCrossings(previousTotal, currentTotal, events) {
    let previous = this.catalog.affinityRanks
      .filter((rank) => rank.mined <= previousTotal).at(-1) || this.catalog.affinityRanks[0];
    this.catalog.affinityRanks
      .filter((rank) => rank.mined > previousTotal && rank.mined <= currentTotal)
      .forEach((rank) => {
        const grantId = rank.rewards?.length ? this.createGrant('affinity', rank.id) : '';
        events.push({ type: 'affinity.levelUp', id: rank.id,
          title: rank.eventTitle || 'Relationship Level Up', subtitle: rank.line,
          previous: previous.name, current: rank.name,
          rarity: rank.mined >= 50_000 ? 'LEGENDARY' : rank.mined >= 5_000 ? 'SSR' : 'SUPER_RARE',
          rewards: rank.rewards || [], grantId });
        previous = rank;
      });
  }
  primePity(kind) {
    const banner = this.catalog.banners.find((entry) => entry.isDefault);
    const trackId = kind === 'ssr' ? 'ssr-pity' : 'ur-pity';
    const track = banner.pityTracks.find((entry) => entry.id === trackId);
    this.bannerProgress(banner).pityCounters[trackId] = track.threshold - 1;
    this.state.gacha[kind === 'ssr' ? 'ssrMisses' : 'urMisses'] = track.threshold - 1;
    this.save(); return this.success();
  }
  setPity(bannerId, trackId, value) {
    const banner = this.catalog.banners.find((entry) => entry.id === bannerId);
    const track = banner?.pityTracks.find((entry) => entry.id === trackId);
    if (!banner || !track) return this.failure('INVALID_PITY_TRACK');
    this.bannerProgress(banner).pityCounters[trackId] = Math.max(0, Math.min(track.threshold - 1, Number(value)));
    this.save(); return this.success();
  }
  advanceAffinity() {
    const next = this.catalog.affinityRanks.find((rank) => rank.mined > this.state.mining.totalStoneMined);
    return next ? this.setMined(next.mined) : this.failure('AFFINITY_ALREADY_MAXIMUM');
  }
  unlockAchievement(id) {
    const definition = this.catalog.achievements.find((achievement) => achievement.id === id);
    if (!definition) return this.failure('INVALID_DEBUG_ACHIEVEMENT');
    const now = new Date().toISOString();
    delete this.state.rewardGrants[`achievement:${id}`];
    this.state.achievements[id] = { achievementId: id, unlockedAtUtc: now, rewardClaimed: !definition.rewards?.length };
    if (definition.rewards?.length) this.createGrant('achievement', id, now);
    this.save();
    return this.success([{ type: 'achievement.unlocked', id, title: definition.name, subtitle: definition.description, rarity: definition.tier, rewards: definition.rewards || [] }]);
  }

  unlockAchievements(lastBatch) {
    const events = [];
    this.catalog.achievements.forEach((achievement) => {
      if (this.state.achievements[achievement.id] || !this.condition(achievement.condition, lastBatch)) return;
      const unlockedAtUtc = new Date().toISOString();
      this.state.achievements[achievement.id] = { achievementId: achievement.id, unlockedAtUtc, rewardClaimed: !achievement.rewards?.length };
      if (achievement.rewards?.length) this.createGrant('achievement', achievement.id, unlockedAtUtc);
      events.push({ type: 'achievement.unlocked', id: achievement.id, title: achievement.name, subtitle: achievement.description, rarity: achievement.tier, rewards: achievement.rewards || [] });
    });
    return events;
  }

  condition(condition, lastBatch) {
    const state = this.state;
    switch (condition.type) {
      case 'minedTotal': return state.mining.totalStoneMined >= condition.value;
      case 'minedDaily': return (state.mining.dailyTotals[dayKey(new Date())] || 0) >= condition.value;
      case 'minedAtLocalHour': return new Date().getHours() === condition.value;
      case 'longestSessionMinutes': return state.mining.longestSessionSeconds >= condition.value * 60;
      case 'activeMinutes': return state.mining.totalActiveSeconds >= condition.value * 60;
      case 'gachaTotal': return state.gacha.totalDraws >= condition.value;
      case 'rarityCountAtLeast': return Object.entries(state.gacha.rarityCounts).reduce((sum, [rarity, count]) => sum + (rarityOrder(rarity) >= rarityOrder(condition.rarity) ? count : 0), 0) >= condition.value;
      case 'maxDuplicateCount': return Object.values(state.collection).some((item) => item.count >= condition.value);
      case 'collectionPercent': return Object.keys(state.collection).length / this.catalog.items.length * 100 >= condition.value;
      case 'affinityMax': return this.affinityView().isMaximum;
      case 'ssrMissStreak': return state.gacha.currentSsrMissStreak >= condition.value;
      case 'rarityInLastBatchAtLeast': return lastBatch.filter((item) => rarityOrder(item.rarity) >= rarityOrder(condition.rarity)).length >= condition.value;
      case 'miningLevel': return state.mining.miningLevel >= condition.value;
      case 'favoriteCount': return Object.values(state.collection).filter((item) => item.favorite).length >= condition.value;
      case 'profileCustomIcon': return state.profile.icon === 'custom:image';
      case 'profileTitleEquipped': return state.profile.titleId !== 'rookie-miner';
      case 'fragmentTotal': return state.mining.totalStoneFragmentsEarned >= condition.value;
      case 'tenPullBatches': return state.gacha.tenPullBatches >= condition.value;
      default: return false;
    }
  }

  conditionCurrent(condition) {
    const state = this.state;
    switch (condition.type) {
      case 'minedTotal': return state.mining.totalStoneMined;
      case 'minedDaily': return state.mining.dailyTotals[dayKey(new Date())] || 0;
      case 'minedAtLocalHour': return new Date().getHours() === condition.value ? 1 : 0;
      case 'longestSessionMinutes': return Math.floor(state.mining.longestSessionSeconds / 60);
      case 'activeMinutes': return Math.floor(state.mining.totalActiveSeconds / 60);
      case 'gachaTotal': return state.gacha.totalDraws;
      case 'rarityCountAtLeast': return Object.entries(state.gacha.rarityCounts).reduce((sum, [rarity, count]) => sum + (rarityOrder(rarity) >= rarityOrder(condition.rarity) ? count : 0), 0);
      case 'maxDuplicateCount': return Math.max(0, ...Object.values(state.collection).map((item) => item.count));
      case 'collectionPercent': return Object.keys(state.collection).length / this.catalog.items.length * 100;
      case 'affinityMax': return this.affinityView().isMaximum ? 1 : 0;
      case 'ssrMissStreak': return state.gacha.currentSsrMissStreak;
      case 'rarityInLastBatchAtLeast': return 0;
      case 'miningLevel': return state.mining.miningLevel;
      case 'favoriteCount': return Object.values(state.collection).filter((item) => item.favorite).length;
      case 'profileCustomIcon': return state.profile.icon === 'custom:image' ? 1 : 0;
      case 'profileTitleEquipped': return state.profile.titleId !== 'rookie-miner' ? 1 : 0;
      case 'fragmentTotal': return state.mining.totalStoneFragmentsEarned;
      case 'tenPullBatches': return state.gacha.tenPullBatches;
      default: return 0;
    }
  }

  createGrant(sourceType, sourceId, unlockedAtUtc = new Date().toISOString()) {
    const grantId = `${sourceType}:${sourceId}`;
    if (!this.state.rewardGrants[grantId]) this.state.rewardGrants[grantId] = { grantId, sourceType, sourceId, unlockedAtUtc, claimed: false, claimedAtUtc: '' };
    return grantId;
  }

  grantRewards(grant) {
    if (grant.sourceType === 'achievement') return this.catalog.achievements.find((entry) => entry.id === grant.sourceId)?.rewards || [];
    if (grant.sourceType === 'affinity') return this.catalog.affinityRanks.find((entry) => entry.id === grant.sourceId)?.rewards || [];
    if (grant.sourceType === 'level') return this.catalog.levelRewards.find((entry) => String(entry.level) === String(grant.sourceId))?.rewards || [];
    return [];
  }

  grantTitle(grant) {
    if (grant.sourceType === 'achievement') return this.catalog.achievements.find((entry) => entry.id === grant.sourceId)?.name || 'Achievement Reward';
    if (grant.sourceType === 'affinity') return `${this.catalog.affinityRanks.find((entry) => entry.id === grant.sourceId)?.name || 'Relationship'} 記念報酬`;
    if (grant.sourceType === 'level') return this.catalog.levelRewards.find((entry) => String(entry.level) === String(grant.sourceId))?.name || 'Level Reward';
    return 'Reward';
  }

  claimReward(grantId) {
    const grant = this.state.rewardGrants[grantId];
    if (!grant) return this.failure('REWARD_GRANT_NOT_FOUND');
    if (grant.claimed) return { ...this.success(), duplicate: true };
    const rewards = this.grantRewards(grant);
    this.applyRewards(rewards);
    grant.claimed = true; grant.claimedAtUtc = new Date().toISOString();
    if (grant.sourceType === 'achievement' && this.state.achievements[grant.sourceId]) this.state.achievements[grant.sourceId].rewardClaimed = true;
    this.save();
    return this.success([{ type: 'reward.claimed', id: grantId, title: this.grantTitle(grant), subtitle: rewards.map((reward) => `${reward.type} ×${reward.amount}`).join(' / '), rarity: 'RARE', rewards, grantId }]);
  }

  claimAllRewards() {
    const events = [];
    Object.values(this.state.rewardGrants).filter((grant) => !grant.claimed).forEach((grant) => {
      const rewards = this.grantRewards(grant); this.applyRewards(rewards);
      grant.claimed = true; grant.claimedAtUtc = new Date().toISOString();
      if (grant.sourceType === 'achievement' && this.state.achievements[grant.sourceId]) this.state.achievements[grant.sourceId].rewardClaimed = true;
      events.push({ type: 'reward.claimed', id: grant.grantId, title: this.grantTitle(grant), subtitle: rewards.map((reward) => `${reward.type} ×${reward.amount}`).join(' / '), rarity: 'RARE', rewards, grantId: grant.grantId });
    });
    this.save(); return this.success(events);
  }

  applyRewards(rewards) {
    rewards.forEach((reward) => {
      if (reward.type === 'points') { this.state.mining.availableMiningPoints += reward.amount; this.state.mining.totalMiningPointsEarned += reward.amount; }
      else if (reward.type === 'tickets') this.state.mining.gachaTickets += reward.amount;
      else if (reward.type === 'fragments') { this.state.mining.stoneFragments += reward.amount; this.state.mining.totalStoneFragmentsEarned += reward.amount; }
      else if (reward.type === 'title') this.state.ownedTitles[reward.titleId] = new Date().toISOString();
      else if (reward.type === 'profileIcon' || reward.type === 'profileFrame') {
        const entry = this.state.collection[reward.itemId] || { itemId: reward.itemId, count: 0, firstAcquiredAtUtc: new Date().toISOString(), favorite: false, seen: false };
        entry.count += reward.amount; entry.lastAcquiredAtUtc = new Date().toISOString(); this.state.collection[reward.itemId] = entry;
      }
    });
  }

  affinityView() {
    const total = this.state.mining.totalStoneMined;
    const ranks = this.catalog.affinityRanks;
    let index = 0; ranks.forEach((rank, candidate) => { if (rank.mined <= total) index = candidate; });
    const rank = ranks[index]; const next = ranks[index + 1];
    return { id: rank.id, name: rank.name, line: rank.line, current: total, rankStart: rank.mined, nextAt: next?.mined ?? rank.mined, remaining: next ? next.mined - total : 0, progress: next ? (total - rank.mined) / (next.mined - rank.mined) : 1, isMaximum: !next, daysTogether: Math.max(0, Math.floor((Date.now() - Date.parse(this.state.profile.createdAtUtc)) / 86400000)), badge: rank.badge, nextRewards: next?.rewards || [] };
  }

  levelForXp(xp) { let used = 0; let level = 1; const cfg = this.catalog?.gacha?.progression || { levelBaseXp: 25, levelExponent: 1.65, maximumLevel: 999 }; while (level < (cfg.maximumLevel || 999)) { const cost = Math.ceil(cfg.levelBaseXp * level ** cfg.levelExponent); if (xp - used < cost) break; used += cost; level += 1; } return level; }
  success(events = []) { return { ok: true, duplicate: false, events, snapshot: this.snapshot() }; }
  failure(error) { return { ok: false, error, snapshot: this.snapshot() }; }

  save() {
    const payload = JSON.stringify(this.state);
    try { const existing = localStorage.getItem(STORAGE_KEY); if (existing) localStorage.setItem(BACKUP_KEY, existing); localStorage.setItem(STORAGE_KEY, payload); } catch { /* preview only */ }
  }
  load() {
    for (const key of [STORAGE_KEY, BACKUP_KEY]) {
      try { const value = JSON.parse(localStorage.getItem(key)); if (value?.schemaVersion === 2) return value; } catch { /* try backup */ }
    }
    return null;
  }
}

function weighted(items, field = 'weight') {
  const total = items.reduce((sum, item) => sum + Number(item[field] || 0), 0);
  let roll = secureInt(total);
  for (const item of items) { if (roll < item[field]) return item; roll -= item[field]; }
  return items.at(-1);
}
function secureInt(max) { if (max <= 1) return 0; const array = new Uint32Array(1); const limit = 0x100000000 - (0x100000000 % max); do { crypto.getRandomValues(array); } while (array[0] >= limit); return array[0] % max; }
function rarityOrder(value) { return Math.max(0, RARITY_ORDER.indexOf(value)); }
function dayKey(date) { const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,'0');const d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
