const PAGE_COPY = {
  home: ['STONE ACCOUNT', 'HOME'],
  farm: ['VERIFIED MINING', 'FARM'],
  affinity: ['RELATIONSHIP WITH STONE', 'AFFINITY'],
  gacha: ['ETERNAL COLLECTION', 'GACHA'],
  collection: ['STONE ARCHIVE', 'COLLECTION'],
  achievements: ['MINING RECORDS', 'ACHIEVEMENTS'],
  profile: ['STONE ACCOUNT', 'PROFILE'],
};

const RARITY_LABEL = {
  NORMAL: 'NORMAL', RARE: 'RARE', SUPER_RARE: 'SUPER RARE',
  SSR: 'SSR', UR: 'UR', LEGENDARY: 'LEGENDARY',
};

const RARITY_COLOR = {
  NORMAL: '#a8adb8', RARE: '#56a8ff', SUPER_RARE: '#9d72ff',
  SSR: '#ffbf3f', UR: '#ff66c8', LEGENDARY: '#fff2a8',
};

const RARITY_ORDER = ['NORMAL', 'RARE', 'SUPER_RARE', 'SSR', 'UR', 'LEGENDARY'];

export class StoneMetaGameUI {
  constructor(root, adapter, options = {}) {
    if (!(root instanceof HTMLElement)) throw new TypeError('A root HTMLElement is required.');
    if (!adapter || typeof adapter.bootstrap !== 'function' || typeof adapter.execute !== 'function') {
      throw new TypeError('A metagame adapter with bootstrap/execute is required.');
    }
    this.root = root;
    this.adapter = adapter;
    this.options = {
      templateUrl: './meta-game-template.html',
      onReturnToFarm: () => {},
      ...options,
    };
    this.catalog = null;
    this.state = null;
    this.developmentMode = false;
    this.route = 'home';
    this.drawBusy = false;
    this.modalFocus = null;
    this.cinematicResults = [];
    this.revealedTen = new Set();
    this.audio = new StoneAudioManager();
    this.profileEditor = null;
    this.unsubscribe = null;
    this.selectedBannerId = '';
    this.collectionTab = 'all';
    this.collectionCategory = 'all';
    this.collectionRarity = 'all';
    this.achievementTab = 'ALL';
    this.historyFilter = 'ALL';
    this.onboardingPage = 0;
    this.skipRequested = false;
    this.reelAnimation = null;
    this.eventQueue = [];
    this.presentingEvent = false;
    this.counterAnimations = new WeakMap();
  }

  async init() {
    if (!this.root.querySelector('[data-meta-app]')) {
      const response = await fetch(this.options.templateUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Metagame template could not be loaded (${response.status}).`);
      this.root.innerHTML = await response.text();
    }
    this.app = this.root.querySelector('[data-meta-app]');
    const bootstrap = normalize(await this.adapter.bootstrap());
    this.catalog = bootstrap.catalog;
    this.state = bootstrap.snapshot;
    this.developmentMode = Boolean(bootstrap.developmentMode);
    this.indexCatalog();
    this.selectedBannerId = this.activeBanners().find((banner) => banner.isDefault)?.id
      || this.activeBanners()[0]?.id || '';
    this.bindEvents();
    if (typeof this.adapter.subscribe === 'function') {
      this.unsubscribe = this.adapter.subscribe((message) => this.onAdapterMessage(message));
    }
    this.renderAll();
    this.navigate('home', false);
    this.app.querySelector('[data-debug-open]').hidden = !this.developmentMode;
    this.renderOnboarding();
    requestAnimationFrame(() => {
      this.app.classList.remove('is-booting');
      window.setTimeout(() => { const loading = this.q('[data-loading]'); if (loading) loading.hidden = true; }, 280);
    });
    return this;
  }

  destroy() {
    this.unsubscribe?.();
    this.audio.stopBed();
    this.root.replaceChildren();
  }

  indexCatalog() {
    this.items = this.catalog.items || [];
    this.itemsById = new Map(this.items.map((item) => [item.id, item]));
    this.achievements = this.catalog.achievements || [];
    this.achievementById = new Map(this.achievements.map((item) => [item.id, item]));
    this.rarities = this.catalog.gacha?.rarities || [];
    this.rarityById = new Map(this.rarities.map((rarity) => [rarity.id, rarity]));
    this.banners = this.catalog.banners || [];
    this.bannerById = new Map(this.banners.map((banner) => [banner.id, banner]));
    this.titles = this.catalog.titles || [];
    this.titleById = new Map(this.titles.map((title) => [title.id, title]));
    this.assets = this.catalog.assets || [];
    this.assetById = new Map(this.assets.map((asset) => [asset.id, asset]));
  }

  bindEvents() {
    this.app.addEventListener('click', (event) => this.onClick(event));
    this.app.addEventListener('pointerover', (event) => {
      if (event.target.closest('button') && !event.relatedTarget?.closest?.('button')) this.audio.hover();
    });
    this.app.addEventListener('input', (event) => this.onInput(event));
    this.app.addEventListener('change', (event) => this.onChange(event));
    this.app.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!this.q('[data-cinematic]').hidden) this.closeCinematic();
      else if (!this.q('[data-modal-layer]').hidden) this.closeModal();
      else if (!this.q('[data-debug-panel]').hidden) this.q('[data-debug-panel]').hidden = true;
    });
  }

  async onClick(event) {
    if (event.target.matches('.meta-scrim[data-close-modal]')) return this.closeModal();
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    this.audio.click();
    const route = button.dataset.route;
    if (route) return this.navigate(route);
    if (button.matches('[data-return-farm]')) return this.options.onReturnToFarm();
    if (button.matches('[data-open-rates]')) return this.openRates(button);
    if (button.matches('[data-open-history]')) return this.openHistory(button);
    if (button.matches('[data-open-rewards]')) return this.openRewards(button);
    if (button.matches('[data-open-settings]')) return this.openSettings(button);
    if (button.matches('[data-edit-profile]')) return this.openProfileEditor(button);
    if (button.matches('[data-open-collection-filter]')) return this.openCollectionFilter(button);
    if (button.matches('[data-item-detail]')) return this.openItemDetail(button.dataset.itemDetail, button);
    if (button.matches('[data-close-modal]')) return this.closeModal();
    if (button.matches('[data-banner-id]')) { this.selectedBannerId = button.dataset.bannerId; this.renderGacha(); return; }
    if (button.matches('[data-speed]')) return this.setAnimationSpeed(button.dataset.speed);
    if (button.matches('[data-collection-tab]')) { this.collectionTab = button.dataset.collectionTab; this.renderCollection(); return; }
    if (button.matches('[data-clear-filter]')) { if (button.dataset.clearFilter === 'category') this.collectionCategory = 'all'; else this.collectionRarity = 'all'; this.renderCollection(); return; }
    if (button.matches('[data-achievement-tab]')) { this.achievementTab = button.dataset.achievementTab; this.renderAchievements(); return; }
    if (button.matches('[data-history-filter]')) { this.historyFilter = button.dataset.historyFilter; this.openHistory(button); return; }
    if (button.matches('[data-draw]')) return this.requestDraw(Number(button.dataset.draw));
    if (button.matches('[data-cinematic-skip]')) return this.skipCinematic();
    if (button.matches('[data-result-close], [data-cinematic-close], [data-ten-close]')) return this.closeCinematic();
    if (button.matches('[data-ten-next]')) return this.revealNextTen();
    if (button.matches('[data-all-open]')) return this.revealAllTen();
    if (button.matches('.meta-ten-card')) return this.revealTenCard(Number(button.dataset.index));
    if (button.matches('[data-claim-all]')) return this.claimAllRewards(button);
    if (button.matches('[data-claim-reward]')) return this.claimReward(button.dataset.claimReward, button);
    if (button.matches('[data-toggle-favorite]')) return this.toggleFavorite(button.dataset.toggleFavorite, button);
    if (button.matches('[data-filter-apply]')) return this.applyCollectionFilter(button);
    if (button.matches('[data-onboarding-next]')) return this.advanceOnboarding(button);
    if (button.matches('[data-save-settings]')) return this.saveSettings(button);
    if (button.matches('[data-save-profile]')) return this.saveProfile(button);
    if (button.matches('[data-profile-editor-tab]')) return this.setProfileEditorTab(button.dataset.profileEditorTab, button);
    if (button.matches('[data-profile-title-id]')) return this.selectProfileTitle(button);
    if (button.matches('[data-appearance-icon]')) return this.selectAppearance(button, 'icon');
    if (button.matches('[data-appearance-frame]')) return this.selectAppearance(button, 'frame');
    if (button.matches('[data-debug-open]')) return this.q('[data-debug-panel]').hidden = false;
    if (button.matches('[data-debug-close]')) return this.q('[data-debug-panel]').hidden = true;
    if (button.matches('[data-debug]')) return this.runDebug(button.dataset.debug);
  }

  onInput(event) {
    if (event.target.matches('[data-collection-search]')) this.renderCollection();
    if (event.target.matches('[data-profile-name-input]')) this.renderProfileEditorPreview();
    if (event.target.matches('[data-crop-zoom], [data-crop-x], [data-crop-y]')) {
      if (!this.profileEditor) return;
      const kind = event.target.dataset.cropZoom !== undefined ? 'zoom'
        : event.target.dataset.cropX !== undefined ? 'x' : 'y';
      this.profileEditor[kind] = Number(event.target.value);
      this.drawCrop();
    }
    if (event.target.matches('[data-volume]')) {
      const output = event.target.closest('.meta-form-row')?.querySelector('output');
      if (output) output.textContent = `${Math.round(Number(event.target.value) * 100)}%`;
      this.audio.preview();
    }
  }

  onChange(event) {
    if (event.target.matches('[data-profile-file]')) this.loadProfileImage(event.target.files?.[0]);
  }

  q(selector) { return this.app.querySelector(selector); }
  qa(selector) { return [...this.app.querySelectorAll(selector)]; }

  renderNumber(element, value, formatter = number) {
    if (!element) return;
    const target = Number(value || 0);
    const previousText = element.dataset.numericValue;
    const previous = Number(previousText);
    element.dataset.numericValue = String(target);
    this.counterAnimations.get(element)?.();
    if (previousText === undefined || !Number.isFinite(previous) || previous === target || this.motionReduced) {
      element.textContent = formatter(target);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(fallback);
      element.textContent = formatter(target);
      this.counterAnimations.delete(element);
    };
    const tick = (now) => {
      if (finished) return;
      const elapsed = clamp((now - startedAt) / 460, 0, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      element.textContent = formatter(Math.round(previous + (target - previous) * eased));
      if (elapsed >= 1) finish(); else frame = requestAnimationFrame(tick);
    };
    // Hidden WebViews can pause animation frames; the visible value must still settle.
    const fallback = setTimeout(finish, 560);
    frame = requestAnimationFrame(tick);
    this.counterAnimations.set(element, finish);
  }

  navigate(route, announce = true) {
    if (!PAGE_COPY[route]) return;
    this.route = route;
    this.qa('[data-screen]').forEach((screen) => { screen.hidden = screen.dataset.screen !== route; });
    this.qa('[data-route]').forEach((button) => {
      const active = button.dataset.route === route;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    text(this.q('[data-page-title]'), PAGE_COPY[route][1]);
    this.q('.meta-content').focus({ preventScroll: true });
    if (route === 'collection') this.renderCollection();
    if (route === 'achievements') this.renderAchievements();
    if (route === 'affinity') this.renderAffinity();
    if (route === 'gacha') this.renderGacha();
    if (route === 'profile') this.renderProfile();
    if (announce) this.audio.navigate();
  }

  renderAll() {
    this.applySettings();
    this.renderCommon();
    this.renderHome();
    this.renderFarm();
    this.renderGacha();
    this.renderCollectionFilters();
    this.renderCollection();
    this.renderAchievements();
    this.renderProfile();
  }

  renderCommon() {
    const mining = this.state.mining;
    this.qa('[data-points]').forEach((el) => this.renderNumber(el, mining.availableMiningPoints));
    this.qa('[data-tickets]').forEach((el) => this.renderNumber(el, mining.gachaTickets));
    this.qa('[data-fragments]').forEach((el) => this.renderNumber(el, mining.stoneFragments));
    this.qa('[data-profile-name]').forEach((el) => { el.textContent = this.state.profile.name; });
    this.qa('[data-profile-title]').forEach((el) => { el.textContent = this.profileTitle(); });
    this.qa('[data-avatar]').forEach((el) => this.renderAvatar(el));
    const pending = Number(this.state.pendingRewardCount || 0);
    this.qa('[data-reward-count]').forEach((el) => { el.textContent = number(pending); el.hidden = pending <= 0; });
    const unseen = Number(this.state.unseenCollectionCount || 0);
    this.qa('[data-nav-collection-badge], [data-mobile-collection-badge]').forEach((el) => { el.hidden = unseen <= 0; });
    const claimable = (this.state.achievementViews || []).some((view) => view.unlocked && !view.rewardClaimed);
    this.qa('[data-nav-achievement-badge]').forEach((el) => { el.hidden = !claimable; });
  }

  renderHome() {
    const affinity = this.state.affinity;
    const stats = this.state.statistics;
    const level = this.state.levelProgress || {
      level: this.state.mining.miningLevel, totalXp: this.state.mining.miningXp,
      xpIntoLevel: 0, xpRequired: 1, progress: 0,
    };
    text(this.q('[data-home-name]'), this.state.profile.name);
    text(this.q('[data-home-profile-name]'), this.state.profile.name);
    text(this.q('[data-home-title]'), this.profileTitle());
    this.renderNumber(this.q('[data-home-level]'), level.level);
    this.renderNumber(this.q('[data-level-xp]'), level.xpIntoLevel);
    text(this.q('[data-level-next]'), number(level.xpRequired));
    this.q('[data-level-progress]').style.width = `${clamp(level.progress * 100, 0, 100)}%`;
    text(this.q('[data-next-level-reward]'), level.nextReward
      ? `${level.nextReward.name} · ${this.rewardListText(level.nextReward.rewards)}`
      : `次のレベルまで${number(Math.max(0, level.xpRequired - level.xpIntoLevel))} XP`);
    this.renderAvatar(this.q('[data-home-avatar]'));
    text(this.q('[data-affinity-name]'), affinity.name);
    text(this.q('[data-affinity-line]'), affinity.line);
    text(this.q('[data-affinity-badge]'), affinity.badge || '◇');
    this.q('[data-affinity-progress]').style.width = `${clamp(affinity.progress * 100, 0, 100)}%`;
    text(this.q('[data-affinity-current]'), affinity.isMaximum
      ? `${number(affinity.current)} / MAX`
      : `${number(affinity.current)} / ${number(affinity.nextAt)}`);
    text(this.q('[data-affinity-remaining]'), affinity.isMaximum
      ? '石と一心同体です' : `あと${number(affinity.remaining)}回`);
    this.renderNumber(this.q('[data-stat-today]'), stats.today);
    this.renderNumber(this.q('[data-stat-week]'), stats.week);
    this.renderNumber(this.q('[data-stat-month]'), stats.month);
    this.renderNumber(this.q('[data-stat-lifetime]'), stats.lifetime);
    const percent = this.state.collectionPercent || 0;
    text(this.q('[data-collection-percent]'), `${percent.toFixed(1)}%`);
    this.renderNumber(this.q('[data-collection-owned]'), this.state.collectionOwned);
    text(this.q('[data-collection-total]'), number(this.state.collectionTotal));
    this.q('[data-collection-ring]').style.setProperty('--complete', `${percent * 3.6}deg`);
    const goals = this.state.homeGoals || [];
    this.q('[data-home-goals]').innerHTML = goals.length ? goals.slice(0, 4).map((goal) => {
      const progress = clamp(Number(goal.progress || 0) * 100, 0, 100);
      const icon = goal.kind === 'reward' ? '!' : goal.kind === 'affinity' ? '◇' : goal.kind === 'level' ? 'LV' : '●';
      return `<button type="button" class="meta-goal-row" data-route="${this.goalRoute(goal.kind)}">
        <span class="meta-goal-icon">${escapeHtml(icon)}</span><span class="meta-goal-copy"><strong>${escapeHtml(goal.label)}</strong><small>${escapeHtml(goal.rewardLabel || '')}</small></span>
        <span class="meta-goal-progress"><span>${goal.remaining > 0 ? `あと${number(goal.remaining)}` : '達成'}</span><span class="meta-progress"><i style="width:${progress}%"></i></span></span></button>`;
    }).join('') : '<p class="meta-footnote">次の目標を計算しています。</p>';
    const recent = [...(this.state.gacha.history || [])].slice(-4).reverse();
    this.q('[data-home-recent]').innerHTML = recent.length ? recent.map((entry) => {
      const item = this.itemsById.get(entry.itemId);
      return `<div class="meta-recent-mini rarity-${entry.rarity}"><div class="meta-item-art">${stoneArt(item)}</div><span>${escapeHtml(item?.name || entry.itemId)}</span></div>`;
    }).join('') : '<p class="meta-footnote">石との出会いはまだありません。</p>';
  }

  renderFarm() {
    const mining = this.state.mining;
    this.renderNumber(this.q('[data-farm-total]'), mining.totalStoneMined);
    this.renderNumber(this.q('[data-farm-xp]'), mining.miningXp, (value) => `${number(value)} XP`);
    text(this.q('[data-farm-level]'), `LV.${number(mining.miningLevel)}`);
    text(this.q('[data-farm-fragments]'), number(mining.stoneFragments));
    text(this.q('[data-active-time]'), duration(mining.totalActiveSeconds));
    text(this.q('[data-longest-session]'), duration(mining.longestSessionSeconds));
    text(this.q('[data-last-mined]'), mining.lastMinedAtUtc ? dateTime(mining.lastMinedAtUtc) : '—');
  }

  renderAffinity() {
    const affinity = this.state.affinity;
    text(this.q('[data-affinity-page-badge]'), affinity.badge || '◇');
    text(this.q('[data-affinity-page-name]'), affinity.name);
    text(this.q('[data-affinity-page-line]'), affinity.line);
    text(this.q('[data-affinity-page-current]'), affinity.isMaximum
      ? `${number(affinity.current)} / MAX` : `${number(affinity.current)} / ${number(affinity.nextAt)}`);
    text(this.q('[data-affinity-page-remaining]'), affinity.isMaximum ? '最高ランク' : `あと${number(affinity.remaining)}回`);
    text(this.q('[data-affinity-days]'), `${number(affinity.daysTogether)}日間の付き合い`);
    this.q('[data-affinity-page-progress]').style.width = `${clamp(affinity.progress * 100, 0, 100)}%`;
    const rewards = affinity.nextRewards || [];
    this.q('[data-affinity-next-rewards]').innerHTML = rewards.length
      ? rewards.map((reward) => `<div class="affinity-reward"><span>${escapeHtml(this.rewardText(reward))}</span><small>関係ランク報酬</small></div>`).join('')
      : '<p class="meta-footnote">すべての関係報酬に到達しました。</p>';
    this.q('[data-affinity-timeline]').innerHTML = (this.catalog.affinityRanks || []).map((rank) => {
      const reached = this.state.mining.totalStoneMined >= rank.mined;
      return `<div class="affinity-timeline-row${reached ? ' is-reached' : ''}"><i>${escapeHtml(rank.badge || '◇')}</i><span><strong>${escapeHtml(rank.name)}</strong><small>${escapeHtml(rank.line)}</small></span><b>${number(rank.mined)}回</b></div>`;
    }).join('');
  }

  renderGacha() {
    const banners = this.activeBanners();
    if (!banners.some((banner) => banner.id === this.selectedBannerId)) this.selectedBannerId = banners[0]?.id || '';
    const banner = this.bannerById.get(this.selectedBannerId) || banners[0];
    if (!banner) return;
    this.q('[data-banner-tabs]').innerHTML = banners.map((entry) => `<button type="button" role="tab" data-banner-id="${escapeAttr(entry.id)}" class="${entry.id === banner.id ? 'is-active' : ''}" aria-selected="${entry.id === banner.id}">${escapeHtml(entry.name)}</button>`).join('');
    text(this.q('[data-banner-tag]'), banner.isDefault ? 'PERMANENT COLLECTION' : 'LIMITED PICKUP');
    text(this.q('[data-banner-name]'), banner.name);
    text(this.q('[data-banner-description]'), banner.description);
    this.q('[data-banner-art]').dataset.banner = banner.id;
    this.q('[data-banner-art]').dataset.asset = this.resolveAsset(banner.bannerAssetId, 'missing-stone');
    this.q('[data-pickups]').innerHTML = (banner.pickups || []).map((pickup) => {
      const id = pickup.itemId || pickup;
      return `<span>${escapeHtml(this.itemsById.get(id)?.name || id)}</span>`;
    }).join('');
    const progress = this.state.gacha.bannerProgress?.[banner.id]?.pityCounters || {};
    this.q('[data-pity-stack]').innerHTML = (banner.pityTracks || []).map((track) => {
      const current = Number(progress[track.id] || 0);
      const percent = clamp(current / track.threshold * 100, 0, 100);
      return `<div class="meta-pity-row"><div><span>${escapeHtml(track.label)}</span><strong>${number(current)} / ${number(track.threshold)}</strong></div><span class="meta-progress"><i style="width:${percent}%"></i></span></div>`;
    }).join('');
    const speed = this.state.settings.animationSpeed || 'normal';
    this.qa('[data-speed]').forEach((button) => button.classList.toggle('is-active', button.dataset.speed === speed));
    text(this.q('[data-single-cost]'), `${number(banner.cost)} MP / T ×1`);
    text(this.q('[data-ten-cost]'), `${number(banner.tenPullCost)} MP / T ×10`);
    this.qa('[data-draw]').forEach((button) => {
      const count = Number(button.dataset.draw);
      const affordable = this.state.mining.gachaTickets >= count
        || this.state.mining.availableMiningPoints >= (count === 10 ? banner.tenPullCost : banner.cost);
      button.disabled = this.drawBusy || !affordable;
    });
  }

  renderCollectionFilters() {
    this.qa('[data-collection-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.collectionTab === this.collectionTab));
  }

  renderCollection() {
    const collection = this.state.collection || {};
    const query = (this.q('[data-collection-search]')?.value || '').trim().toLocaleLowerCase('ja');
    const filtered = this.items.filter((item) => {
      const owned = collection[item.id];
      if (this.collectionCategory !== 'all' && item.collectionCategory !== this.collectionCategory) return false;
      if (this.collectionRarity !== 'all' && item.rarity !== this.collectionRarity) return false;
      if (this.collectionTab === 'favorite' && !owned?.favorite) return false;
      if (this.collectionTab === 'new' && (!owned || owned.seen)) return false;
      if (!query) return true;
      const searchable = owned ? `${item.name} ${item.description}` : item.isSecret ? '' : item.name;
      return searchable.toLocaleLowerCase('ja').includes(query);
    }).sort((a, b) => {
      const owned = Number(Boolean(collection[b.id])) - Number(Boolean(collection[a.id]));
      return owned || rarityOrder(b.rarity) - rarityOrder(a.rarity) || a.name.localeCompare(b.name, 'ja');
    });
    text(this.q('[data-catalog-owned]'), number(this.state.collectionOwned));
    text(this.q('[data-catalog-total]'), number(this.state.collectionTotal));
    const percent = Number(this.state.collectionPercent || 0);
    text(this.q('[data-collection-percent]'), `${percent.toFixed(1)}%`);
    this.q('[data-collection-ring]').style.setProperty('--complete', `${percent * 3.6}deg`);
    this.qa('[data-collection-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.collectionTab === this.collectionTab));
    const activeFilters = [];
    if (this.collectionCategory !== 'all') activeFilters.push(`<button type="button" data-clear-filter="category">${escapeHtml(this.collectionCategory)} ×</button>`);
    if (this.collectionRarity !== 'all') activeFilters.push(`<button type="button" data-clear-filter="rarity">${escapeHtml(this.collectionRarity)} ×</button>`);
    this.q('[data-active-filters]').innerHTML = activeFilters.join('');
    this.q('[data-collection-grid]').innerHTML = filtered.map((item) => {
      const owned = collection[item.id];
      const hidden = !owned && item.isSecret;
      return `<button type="button" class="meta-item-card rarity-${item.rarity}${owned ? '' : ' is-locked'}" data-rarity="${item.rarity}" data-item-detail="${escapeAttr(item.id)}">
        <div class="meta-item-art">${stoneArt(item)}${owned ? `<span class="meta-item-count">×${number(owned.count)}</span>${owned.seen ? '' : '<span class="meta-new-badge">NEW</span>'}${owned.favorite ? '<span class="meta-favorite-badge">★</span>' : ''}` : ''}</div>
        <span class="meta-item-rarity">${RARITY_LABEL[item.rarity]}</span>
        <h3>${escapeHtml(owned ? item.name : hidden ? '???' : item.name)}</h3>
        <p>${escapeHtml(owned ? item.description : hidden ? '未取得の隠しコレクション' : '未取得')}</p>
        ${owned ? `<small class="meta-item-date">初回 ${escapeHtml(dateOnly(owned.firstAcquiredAtUtc))}</small>` : ''}
      </button>`;
    }).join('');
    this.q('[data-collection-empty]').hidden = filtered.length !== 0;
  }

  renderAchievements() {
    const views = new Map((this.state.achievementViews || []).map((view) => [view.id, view]));
    const tabs = ['ALL', ...new Set(this.achievements.map((item) => item.category))];
    this.q('[data-achievement-tabs]').innerHTML = tabs.map((tab) => `<button type="button" data-achievement-tab="${escapeAttr(tab)}" class="${tab === this.achievementTab ? 'is-active' : ''}">${escapeHtml(tab === 'ALL' ? 'すべて' : tab)}</button>`).join('');
    text(this.q('[data-achievement-owned]'), number(this.state.achievementUnlocked));
    text(this.q('[data-achievement-total]'), number(this.state.achievementTotal));
    const pending = Number(this.state.pendingRewardCount || 0);
    const unlockedCount = Number(this.state.achievementUnlocked || 0);
    this.q('[data-achievement-summary]').innerHTML = `<div><span>達成</span><strong>${number(unlockedCount)}</strong></div><div><span>未達成</span><strong>${number(Math.max(0, this.state.achievementTotal - unlockedCount))}</strong></div><div><span>未受取報酬</span><strong>${number(pending)}</strong></div>`;
    const claimAll = this.q('[data-claim-all]');
    claimAll.disabled = pending <= 0;
    this.q('[data-achievement-grid]').innerHTML = this.achievements
      .filter((definition) => this.achievementTab === 'ALL' || definition.category === this.achievementTab)
      .map((definition) => {
        const view = views.get(definition.id) || { unlocked: Boolean(this.state.achievements?.[definition.id]), current: 0, target: definition.condition?.value || 1, progress: 0 };
        const secret = definition.hidden && !view.unlocked;
        const grant = (this.state.rewardGrantViews || []).find((entry) => entry.sourceType === 'achievement' && entry.sourceId === definition.id && !entry.claimed);
        return `<article class="meta-achievement tier-${definition.tier}${view.unlocked ? '' : ' is-locked'}">
          <div class="meta-achievement-icon"><svg><use href="#${view.unlocked ? this.assetSymbol(definition.icon) : 'sm-lock'}"></use></svg></div>
          <div><h3>${escapeHtml(secret ? 'SECRET' : definition.name)}</h3><p>${escapeHtml(secret ? (definition.hiddenDescription || '条件はまだ石の中です。') : definition.description)}</p><small>${escapeHtml(definition.tier)}</small>
          ${view.unlocked ? '' : `<div class="meta-achievement-progress"><span class="meta-progress"><i style="width:${clamp(view.progress * 100, 0, 100)}%"></i></span><span>${number(view.current)} / ${number(view.target)}</span></div>`}</div>
          ${grant ? `<button type="button" class="meta-claim-small" data-claim-reward="${escapeAttr(grant.grantId)}">受取</button>` : ''}
        </article>`;
      }).join('');
  }

  renderProfile() {
    const state = this.state;
    text(this.q('[data-profile-card-name]'), state.profile.name);
    text(this.q('[data-profile-card-title]'), this.profileTitle());
    text(this.q('[data-profile-detail-name]'), state.profile.name);
    text(this.q('[data-profile-detail-title]'), this.profileTitle());
    text(this.q('[data-profile-level]'), number(state.mining.miningLevel));
    text(this.q('[data-profile-mined]'), number(state.mining.totalStoneMined));
    text(this.q('[data-profile-affinity]'), state.affinity.name);
    text(this.q('[data-profile-achievements]'), `${state.achievementUnlocked} / ${state.achievementTotal}`);
    text(this.q('[data-profile-collection]'), `${state.collectionOwned} / ${state.collectionTotal}`);
    text(this.q('[data-profile-draws]'), `${number(state.gacha.totalDraws)}回`);
    text(this.q('[data-profile-high-rarity]'), `${number(state.gacha.rarityCounts?.SSR)} / ${number(state.gacha.rarityCounts?.UR)} / ${number(state.gacha.rarityCounts?.LEGENDARY)}`);
    text(this.q('[data-profile-worst-streak]'), `${number(state.gacha.worstSsrMissStreak)}回`);
    text(this.q('[data-profile-best-batch]'), `${number(state.gacha.bestHighRarityBatch)}枚`);
    text(this.q('[data-profile-playtime]'), duration(state.mining.totalActiveSeconds));
    text(this.q('[data-profile-longest]'), duration(state.mining.longestSessionSeconds));
    text(this.q('[data-profile-fragments]'), number(state.mining.stoneFragments));
    text(this.q('[data-profile-last-mined]'), state.mining.lastMinedAtUtc ? dateTime(state.mining.lastMinedAtUtc) : '—');
    text(this.q('[data-profile-created]'), `STARTED ${dateOnly(state.profile.createdAtUtc)}`);
    this.renderAvatar(this.q('[data-profile-avatar]'));
  }

  profileTitle() {
    const id = this.state.profile.titleId || 'rookie-miner';
    return this.titleById.get(id)?.name || this.state.ownedTitles?.[id] || '駆け出し石掘り';
  }

  rewardText(reward) {
    if (!reward) return '';
    const amount = number(reward.amount || 1);
    if (reward.type === 'points') return `${amount} Mining Point`;
    if (reward.type === 'tickets') return `ガチャチケット ×${amount}`;
    if (reward.type === 'fragments') return `石のかけら ×${amount}`;
    if (reward.type === 'title') return `称号「${this.titleById.get(reward.titleId)?.name || reward.titleId}」`;
    if (reward.type === 'profileIcon' || reward.type === 'profileFrame') return this.itemsById.get(reward.itemId)?.name || reward.itemId;
    return `${reward.type} ×${amount}`;
  }

  rewardListText(rewards) { return (rewards || []).map((reward) => this.rewardText(reward)).join('・') || '報酬なし'; }

  resolveAsset(id, fallbackId = 'missing-stone') {
    const fallback = this.assetById.get(fallbackId);
    const asset = this.assetById.get(id) || fallback;
    return asset?.uri || asset?.fallbackUri || fallback?.uri || 'procedural://stone/missing';
  }

  assetSymbol(id) {
    const token = this.resolveAsset(id).split('/').at(-1);
    return ({ pickaxe: 'sm-pick', case: 'sm-case', grid: 'sm-grid', heart: 'sm-heart',
      person: 'sm-person', secret: 'sm-lock', stone: 'sm-trophy' })[token] || 'sm-trophy';
  }

  goalRoute(kind) {
    if (kind === 'affinity') return 'affinity';
    if (kind === 'collection') return 'collection';
    if (kind === 'reward') return 'achievements';
    return 'farm';
  }

  activeBanners() {
    const now = Date.now();
    return this.banners.filter((banner) => {
      const start = banner.startAtUtc ? Date.parse(banner.startAtUtc) : -Infinity;
      const end = banner.endAtUtc ? Date.parse(banner.endAtUtc) : Infinity;
      return now >= start && now <= end;
    });
  }

  renderAvatar(element) {
    if (!element) return;
    const profile = this.state.profile;
    element.className = element.className.replace(/ frame-[\w-]+/g, '');
    RARITY_ORDER.forEach((rarity) => element.classList.remove(`rarity-${rarity}`));
    const frame = profile.frame?.startsWith('item:') ? profile.frame.slice(5) : 'default';
    element.classList.add(`frame-${cssToken(frame)}`);
    if (profile.icon === 'custom:image' && profile.customIconDataUri) {
      element.innerHTML = `<img alt="" src="${escapeAttr(profile.customIconDataUri)}">`;
    } else if (profile.icon?.startsWith('item:')) {
      const item = this.itemsById.get(profile.icon.slice(5));
      if (item) element.classList.add(`rarity-${item.rarity}`);
      element.innerHTML = stoneArt(item);
    } else {
      element.innerHTML = '<span class="meta-avatar-stone"></span>';
    }
  }

  async requestDraw(count, forceRarity = '') {
    if (this.drawBusy) return;
    this.drawBusy = true;
    this.renderGacha();
    const requestId = makeRequestId('draw');
    const action = forceRarity ? 'debug.forceDraw' : 'gacha.draw';
    const variants = this.catalog.gacha.presentation.highRarityVariants?.[forceRarity] || [];
    const payload = forceRarity ? {
      requestId, bannerId: this.selectedBannerId, count, rarity: forceRarity,
      fakeout: rarityOrder(forceRarity) >= rarityOrder('SUPER_RARE'),
      variant: variants[0] || '', preCue: rarityOrder(forceRarity) >= rarityOrder('SSR') ? 'stone-signal' : '',
    } : { requestId, bannerId: this.selectedBannerId, count, payment: 'auto' };
    try {
      const envelope = normalize(await this.adapter.execute(action, payload));
      const result = envelope.result || envelope;
      if (!result.ok) {
        this.toast(result.error === 'INSUFFICIENT_GACHA_CURRENCY'
          ? 'Mining Points またはチケットが足りません' : `ガチャを開始できません: ${result.error || 'unknown'}`);
        return;
      }
      this.state = result.snapshot;
      this.renderAll();
      this.cinematicResults = result.draw.results;
      this.pendingEvents = result.events || [];
      if (count === 1) await this.playSingle(result.draw.results[0]);
      else await this.playTen(result.draw.results);
    } catch (error) {
      this.toast(`通信エラー: ${error.message}`);
    } finally {
      this.drawBusy = false;
      this.renderGacha();
    }
  }

  async playSingle(result) {
    const item = this.itemsById.get(result.itemId);
    const cinematic = this.q('[data-cinematic]');
    const reel = this.q('[data-reel]');
    const stage = this.q('[data-case-stage]');
    this.skipRequested = false;
    this.q('[data-pre-cue-stage]').hidden = true;
    this.q('[data-variant-stage]').hidden = true;
    this.q('[data-ten-stage]').hidden = true;
    this.q('[data-result-stage]').hidden = true;
    const fakeError = this.q('[data-fake-error]');
    if (fakeError) fakeError.hidden = true;
    stage.hidden = true;
    cinematic.hidden = false;
    cinematic.dataset.variant = result.presentationVariant || 'standard';
    this.setResultTheme(result.rarity);
    this.audio.startBed(result.rarity);

    if (result.preCue) {
      text(this.q('[data-pre-cue-label]'), String(result.preCue).replace(/-/g, ' ').toUpperCase());
      this.q('[data-pre-cue-stage]').hidden = false;
      this.audio.rarity(result.rarity, true);
      await this.waitPresentation(700);
      this.q('[data-pre-cue-stage]').hidden = true;
    }

    const config = this.catalog.gacha.presentation;
    const plan = createCaseReelPlan(this.items, item, result.rarity, config);
    reel.className = 'meta-reel';
    reel.style.transform = 'translate3d(0,0,0)';
    reel.innerHTML = plan.items.map((selected) => this.reelCard(selected)).join('');
    stage.hidden = false;
    await frames(2);
    const card = reel.querySelector('.meta-reel-card');
    const gap = 12;
    const shift = plan.targetIndex * (card.offsetWidth + gap) + card.offsetWidth / 2
      - this.q('.reel-glass').clientWidth / 2;
    const baseDuration = { NORMAL: 4300, RARE: 4500, SUPER_RARE: 4750, SSR: 5100, UR: 5550, LEGENDARY: 6100 }[result.rarity];
    const repeatLegendary = result.rarity === 'LEGENDARY' && !result.isNew
      && this.state.settings.skipPreviouslySeenLegendary;
    const multiplier = repeatLegendary ? Math.min(.18, this.presentationMultiplier())
      : this.presentationMultiplier();
    const durationMs = this.motionReduced ? 90 : Math.max(160, Math.round(baseDuration * multiplier));
    this.reelAnimation?.cancel?.();
    this.reelAnimation = reel.animate([
      { transform: 'translate3d(0,0,0)', offset: 0, easing: 'cubic-bezier(.12,.75,.24,1)' },
      { transform: `translate3d(${-shift * .16}px,0,0)`, offset: .12, easing: 'linear' },
      { transform: `translate3d(${-shift * .76}px,0,0)`, offset: .7, easing: 'cubic-bezier(.15,.72,.2,1)' },
      { transform: `translate3d(${-shift * 1.006}px,0,0)`, offset: .955, easing: 'ease-out' },
      { transform: `translate3d(${-shift}px,0,0)`, offset: 1 },
    ], { duration: durationMs, fill: 'forwards' });
    this.trackReelTicks(reel, card.offsetWidth + gap, durationMs);
    reel.classList.add('is-rolling');
    await this.waitPresentation(durationMs + 80);
    if (this.skipRequested) this.reelAnimation?.finish?.();
    this.audio.stop(result.rarity);

    if (result.rarity === 'LEGENDARY' && result.presentationVariant === 'system-error' && fakeError && !this.motionReduced) {
      stage.hidden = true;
      fakeError.hidden = false;
      this.audio.errorFake();
      await this.waitPresentation(760);
      fakeError.hidden = true;
    }
    if (result.presentationVariant && rarityOrder(result.rarity) >= rarityOrder('SSR') && !this.skipRequested) {
      stage.hidden = true;
      text(this.q('[data-variant-label]'), String(result.presentationVariant).replace(/-/g, ' ').toUpperCase());
      text(this.q('[data-variant-copy]'), result.rarity === 'LEGENDARY' ? '通常の観測限界を超えました' : '石の反応が限界を超えました');
      this.q('[data-variant-stage]').hidden = false;
      await this.waitPresentation(result.rarity === 'LEGENDARY' ? 980 : 620);
      this.q('[data-variant-stage]').hidden = true;
    }
    await this.showSingleResult(result, Boolean(result.fakeout));
  }

  async showSingleResult(result, fakeout) {
    const item = this.itemsById.get(result.itemId);
    this.q('[data-case-stage]').hidden = true;
    const stage = this.q('[data-result-stage]');
    const presented = fakeout ? result.presentedFromRarity : result.rarity;
    this.setResultTheme(presented);
    text(this.q('[data-result-rarity]'), RARITY_LABEL[presented]);
    this.q('[data-result-card]').innerHTML = `<div class="meta-item-art">${stoneArt(item)}</div>`;
    text(this.q('[data-result-new]'), result.isNew ? 'NEW' : 'DUPLICATE');
    text(this.q('[data-result-name]'), item.name);
    text(this.q('[data-result-description]'), item.description);
    text(this.q('[data-result-message]'), this.resultMessage(result));
    text(this.q('[data-result-rate]'), `提供割合 ${(Number(result.nominalBasisPoints || this.rarityById.get(result.rarity)?.basisPoints || 0) / 100).toFixed(2)}%`);
    text(this.q('[data-result-count]'), `所持数 ×${number(result.ownedCount)}`);
    const fragment = this.q('[data-result-fragments]');
    fragment.hidden = Number(result.fragmentsGained || 0) <= 0;
    text(fragment, `石のかけら +${number(result.fragmentsGained)}`);
    this.makeParticles(presented);
    stage.hidden = false;
    if (fakeout) {
      stage.classList.add('is-fakeout');
      this.audio.crack();
      await this.waitPresentation(this.motionReduced ? 40 : 650);
      stage.classList.remove('is-fakeout');
      this.setResultTheme(result.rarity);
      text(this.q('[data-result-rarity]'), RARITY_LABEL[result.rarity]);
      this.makeParticles(result.rarity);
      this.audio.rarity(result.rarity);
    } else {
      this.audio.rarity(result.rarity);
    }
    if (result.isNew) this.audio.newItem();
  }

  async playTen(results) {
    const cinematic = this.q('[data-cinematic]');
    this.skipRequested = false;
    this.q('[data-pre-cue-stage]').hidden = true;
    this.q('[data-variant-stage]').hidden = true;
    this.q('[data-case-stage]').hidden = true;
    this.q('[data-result-stage]').hidden = true;
    const stage = this.q('[data-ten-stage]');
    stage.hidden = false;
    cinematic.hidden = false;
    cinematic.dataset.variant = 'ten-pull';
    this.revealedTen.clear();
    const revealPlan = createTenRevealPlan(results);
    this.cinematicResults = revealPlan.results;
    cinematic.dataset.tenReveal = revealPlan.mode;
    this.setResultTheme(highestRarity(results));
    const grid = this.q('[data-ten-grid]');
    grid.innerHTML = this.cinematicResults.map((result, index) => {
      const item = this.itemsById.get(result.itemId);
      const high = rarityOrder(result.rarity) >= rarityOrder('SSR');
      return `<button type="button" class="meta-ten-card rarity-${result.rarity}${high ? ' is-high' : ''}" data-index="${index}" data-rarity="${result.rarity}">
        <span class="meta-ten-card-inner"><span class="meta-ten-face meta-ten-back"></span><span class="meta-ten-face meta-ten-front"><span class="meta-item-art">${stoneArt(item)}</span><h3>${escapeHtml(item.name)}</h3><small>${RARITY_LABEL[result.rarity]}${result.isNew ? ' · NEW' : ''}</small></span></span>
      </button>`;
    }).join('');
    const revealCopy = revealPlan.mode === 'ascending' ? '低レアから順に開封'
      : revealPlan.mode === 'high-last' ? '最後の1枚に高レアを集約' : 'ランダム順で開封';
    text(this.q('[data-ten-message]'), `${this.batchMessage(results)} · ${revealCopy}`);
    this.q('[data-ten-next]').hidden = false;
    this.q('[data-all-open]').hidden = false;
    this.q('[data-ten-close]').hidden = true;
    this.audio.startBed(highestRarity(results));
    await this.waitPresentation(this.motionReduced ? 20 : 420);
    this.audio.tenReady(highestRarity(results));
  }

  revealTenCard(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.cinematicResults.length
      || this.revealedTen.has(index)) return;
    const result = this.cinematicResults[index];
    this.revealedTen.add(index);
    this.q(`.meta-ten-card[data-index="${index}"]`)?.classList.add('is-revealed');
    this.audio.rarity(result.rarity, true);
    if (this.revealedTen.size === this.cinematicResults.length) {
      this.q('[data-ten-next]').hidden = true;
      this.q('[data-all-open]').hidden = true;
      this.q('[data-ten-close]').hidden = false;
    }
  }

  revealNextTen() {
    const next = this.cinematicResults.findIndex((_, index) => !this.revealedTen.has(index));
    if (next >= 0) this.revealTenCard(next);
  }

  async revealAllTen() {
    for (let index = 0; index < this.cinematicResults.length; index += 1) {
      this.revealTenCard(index);
      await sleep(this.motionReduced || this.skipRequested ? 1 : 85);
    }
  }

  skipCinematic() {
    if (this.q('[data-cinematic]').hidden) return;
    this.skipRequested = true;
    if (!this.q('[data-ten-stage]').hidden) { this.revealAllTen(); return; }
    if (!this.q('[data-result-stage]').hidden) { this.closeCinematic(); return; }
    try { this.reelAnimation?.finish?.(); } catch { }
  }

  closeCinematic() {
    const cinematic = this.q('[data-cinematic]');
    if (cinematic.hidden) return;
    cinematic.hidden = true;
    delete cinematic.dataset.variant;
    this.skipRequested = false;
    this.reelAnimation?.cancel?.();
    this.reelAnimation = null;
    this.audio.stopBed();
    this.q('[data-reel]').classList.remove('is-rolling');
    const events = this.pendingEvents || [];
    this.pendingEvents = [];
    this.showEvents(events);
  }

  setResultTheme(rarity) {
    const cinematic = this.q('[data-cinematic]');
    cinematic.dataset.rarity = rarity;
    cinematic.style.setProperty('--result-color', RARITY_COLOR[rarity]);
    cinematic.style.setProperty('--result-soft', hexAlpha(RARITY_COLOR[rarity], .26));
  }

  trackReelTicks(reel, cellWidth, durationMs) {
    let lastCell = -1;
    const started = performance.now();
    const tick = () => {
      if (this.q('[data-cinematic]').hidden || performance.now() - started > durationMs + 100) return;
      const transform = getComputedStyle(reel).transform;
      const match = transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+)/);
      const x = match ? Math.abs(Number(match[1])) : 0;
      const cell = Math.floor(x / cellWidth);
      if (cell !== lastCell) { lastCell = cell; this.audio.tick(Math.min(1, (performance.now() - started) / durationMs)); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  reelCard(item) {
    return `<article class="meta-reel-card rarity-${item.rarity}" data-rarity="${item.rarity}"><div class="meta-item-art">${stoneArt(item)}</div><h3>${escapeHtml(item.name)}</h3><small>${RARITY_LABEL[item.rarity]}</small></article>`;
  }

  resultMessage(result) {
    const messages = this.catalog.messages || {};
    const source = result.rarity === 'LEGENDARY' ? messages.legendary
      : result.isNew ? messages.newItem
        : rarityOrder(result.rarity) <= rarityOrder('RARE') ? messages.badPull : messages.duplicate;
    if (!Array.isArray(source) || !source.length) return '';
    return source[Math.floor(hashUnit(`${result.itemId}:${result.ownedCount}:${result.rarity}`) * source.length)];
  }

  batchMessage(results) {
    const messages = this.catalog.messages || {};
    const highest = highestRarity(results);
    const source = highest === 'LEGENDARY' ? messages.legendary
      : results.some((result) => result.isNew) ? messages.newItem
        : rarityOrder(highest) <= rarityOrder('RARE') ? messages.badPull : messages.duplicate;
    if (!Array.isArray(source) || !source.length) return '';
    const key = results.map((result) => result.itemId).join(':');
    return source[Math.floor(hashUnit(key) * source.length)];
  }

  makeParticles(rarity) {
    let layer = this.q('[data-particles]');
    if (!layer) {
      layer = document.createElement('span');
      layer.className = 'cinematic-particles';
      layer.dataset.particles = '';
      this.q('[data-cinematic]').append(layer);
    }
    const quality = this.state.settings.effectQuality;
    const count = quality === 'low' ? 9 : quality === 'high' ? 42 : 23;
    layer.innerHTML = Array.from({ length: count }, (_, index) => {
      const angle = Math.round(hashUnit(`a:${index}:${rarity}`) * 360);
      const distance = 100 + Math.round(hashUnit(`d:${index}:${rarity}`) * 270);
      return `<span class="meta-particle" style="--angle:${angle}deg;--distance:${distance}px;--particle-duration:${1.7 + hashUnit(`t:${index}`) * 1.8}s;--particle-delay:${-hashUnit(`l:${index}`) * 2}s"></span>`;
    }).join('');
  }

  presentationMultiplier() {
    const speed = this.state.settings.animationSpeed || 'normal';
    return Number(this.catalog.gacha.presentation.speedMultipliers?.[speed] || 1);
  }

  async waitPresentation(milliseconds) {
    const until = performance.now() + Math.max(0, milliseconds);
    while (!this.skipRequested && performance.now() < until) {
      const remaining = until - performance.now();
      // Never schedule a fractional/zero-delay tail. Besides wasting a core, a virtual-time
      // browser can otherwise keep performance.now() fixed and strand the cinematic forever.
      await sleep(Math.max(1, Math.min(40, Math.ceil(remaining))));
    }
  }

  openRates(source) {
    const banner = this.bannerById.get(this.selectedBannerId) || this.activeBanners()[0];
    const rows = this.rarities.slice().sort((a, b) => a.order - b.order).map((rarity) => {
      const basisPoints = Number(banner?.rates?.[rarity.id] ?? rarity.basisPoints ?? 0);
      return `<div class="meta-rate-row rarity-${rarity.id}"><span>${escapeHtml(rarity.label)}</span><strong>${(basisPoints / 100).toFixed(basisPoints < 100 ? 2 : 1)}%</strong></div>`;
    }).join('');
    const pickups = (banner?.pickups || []).map((pickup) => {
      const item = this.itemsById.get(pickup.itemId);
      return `<div class="meta-rate-row rarity-${item?.rarity || 'NORMAL'}"><span>PICK UP · ${escapeHtml(item?.name || pickup.itemId)}</span><strong>同レア内 ${(pickup.shareBasisPoints / 100).toFixed(1)}%</strong></div>`;
    }).join('');
    const pities = (banner?.pityTracks || []).map((track) => `${track.label}: ${number(track.threshold)}回で${track.minimumRarity}以上`).join(' / ');
    this.openModal(source, '提供割合', `<div class="meta-rate-list">${rows}</div>${pickups ? `<h3 class="meta-modal-subtitle">PICK UP</h3><div class="meta-rate-list">${pickups}</div>` : ''}<p class="meta-footnote">10連は${escapeHtml(banner?.tenPullMinimumRarity || 'SUPER_RARE')}以上を1個保証。${escapeHtml(pities)}</p>`, 'DROP RATES');
  }

  openHistory(source) {
    const historyLimit = this.catalog.gacha.presentation.historyPreviewLimit || 80;
    const required = this.historyFilter;
    const history = [...(this.state.gacha.history || [])].reverse().filter((entry) => {
      if (required === 'SSR+') return rarityOrder(entry.rarity) >= rarityOrder('SSR');
      if (required === 'UR+') return rarityOrder(entry.rarity) >= rarityOrder('UR');
      if (required === 'LEGENDARY') return entry.rarity === 'LEGENDARY';
      if (required === 'NEW') return entry.wasNew;
      return true;
    }).slice(0, historyLimit);
    const rows = history.length ? history.map((entry) => {
      const item = this.itemsById.get(entry.itemId);
      return `<div class="meta-history-row rarity-${entry.rarity}"><div class="meta-item-art">${stoneArt(item)}</div><span><strong>${escapeHtml(item?.name || entry.itemId)}</strong><small>${escapeHtml(entry.bannerName || this.bannerById.get(entry.bannerId)?.name || 'STONE GACHA')} · ${entry.batchSize === 10 ? '10連' : '単発'} · ${RARITY_LABEL[entry.rarity]}${entry.wasNew ? ' · NEW' : ''}</small><small>${escapeHtml(dateTime(entry.drawnAtUtc))}${entry.pityTrackId ? ` · ${escapeHtml(entry.pityTrackId)} ${number(entry.pityCountBefore + 1)}回目` : ''}</small></span><small>#${number(entry.sequence)}</small></div>`;
    }).join('') : '<div class="meta-empty compact"><span class="empty-stone"></span><strong>石との出会いはまだありません</strong><p>別の条件を選ぶか、ガチャを引いてください。</p></div>';
    const filters = ['ALL', 'SSR+', 'UR+', 'LEGENDARY', 'NEW'].map((filter) => `<button type="button" data-history-filter="${filter}" class="${filter === required ? 'is-active' : ''}">${filter}</button>`).join('');
    const statistics = this.state.gachaStatistics || {};
    const banner = this.bannerById.get(this.selectedBannerId) || this.activeBanners()[0];
    const rates = this.rarities.map((rarity) => {
      const observed = Number(statistics.actualRates?.[rarity.id] || 0);
      const published = Number(banner?.rates?.[rarity.id] ?? rarity.basisPoints ?? 0) / 100;
      return `<div class="rarity-${rarity.id}"><span>${escapeHtml(rarity.label)}</span><dl><div><dt>実測</dt><dd>${observed.toFixed(2)}%</dd></div><div><dt>公称</dt><dd>${published.toFixed(2)}%</dd></div></dl></div>`;
    }).join('');
    const summary = [
      ['総抽選', statistics.totalDraws ?? this.state.gacha.totalDraws],
      ['単発', statistics.singleDraws ?? this.state.gacha.singleDraws],
      ['10連', statistics.tenPullBatches ?? this.state.gacha.tenPullBatches],
      ['最大SSR未満', `${number(statistics.worstSsrMissStreak)}回`],
      ['最大UR未満', `${number(statistics.worstUrMissStreak)}回`],
      ['10連最高SSR+', `${number(statistics.bestHighRarityBatch)}枚`],
    ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${typeof value === 'number' ? number(value) : escapeHtml(value)}</strong></div>`).join('');
    this.openModal(source, 'ガチャ履歴・統計', `<p class="meta-statistics-banner">${escapeHtml(banner?.name || 'STONE GACHA')} の公称値と、全履歴の実測値</p><div class="meta-history-summary">${summary}</div><div class="achievement-tabs meta-history-filters">${filters}</div><div class="meta-history-rates">${rates}</div><div class="meta-history-list">${rows}</div>`, 'GACHA HISTORY');
  }

  openRewards(source) {
    const grants = this.state.rewardGrantViews || [];
    const rows = grants.length ? grants.map((grant) => `<div class="meta-reward-row${grant.claimed ? ' is-claimed' : ''}"><div><strong>${escapeHtml(grant.title)}</strong><small>${escapeHtml(this.rewardListText(grant.rewards))} · ${escapeHtml(dateOnly(grant.unlockedAtUtc))}</small></div>${grant.claimed ? '<span>受取済み</span>' : `<button type="button" data-claim-reward="${escapeAttr(grant.grantId)}">受け取る</button>`}</div>`).join('') : '<div class="meta-empty compact"><span class="empty-stone"></span><strong>受け取り待ちの報酬はありません</strong><p>採掘、実績、好感度で新しい報酬が届きます。</p></div>';
    const pending = Number(this.state.pendingRewardCount || 0);
    this.openModal(source, '報酬センター', `<div class="meta-reward-list">${rows}</div>${pending ? '<button type="button" class="meta-sheet-action meta-reward-claim-all" data-claim-all>すべて受け取る</button>' : ''}`, 'REWARD CENTER');
  }

  async claimReward(grantId, button) {
    button.disabled = true;
    try {
      const envelope = normalize(await this.adapter.execute('reward.claim', { grantId }));
      const result = envelope.result || envelope;
      if (!result.ok) throw new Error(result.error);
      this.state = result.snapshot;
      this.renderAll();
      this.openRewards(this.modalFocus || this.q('[data-open-rewards]'));
      this.showEvents(result.events || []);
    } catch (error) { button.disabled = false; this.toast(`報酬を受け取れません: ${error.message}`); }
  }

  async claimAllRewards(button) {
    button.disabled = true;
    try {
      const envelope = normalize(await this.adapter.execute('reward.claimAll', {}));
      const result = envelope.result || envelope;
      if (!result.ok) throw new Error(result.error);
      this.state = result.snapshot;
      this.renderAll();
      if (!this.q('[data-modal-layer]').hidden) this.openRewards(this.modalFocus || button);
      this.showEvents(result.events || []);
      this.toast('受け取れる報酬をまとめて獲得しました');
    } catch (error) { button.disabled = false; this.toast(`報酬を受け取れません: ${error.message}`); }
  }

  openCollectionFilter(source) {
    const categories = [...new Set(this.items.map((item) => item.collectionCategory))].sort((a, b) => a.localeCompare(b, 'ja'));
    const categoryOptions = ['all', ...categories].map((value) => `<option value="${escapeAttr(value)}" ${value === this.collectionCategory ? 'selected' : ''}>${value === 'all' ? 'すべてのカテゴリー' : escapeHtml(value)}</option>`).join('');
    const rarityOptions = ['all', ...this.rarities.slice().sort((a, b) => a.order - b.order).map((rarity) => rarity.id)].map((value) => `<option value="${escapeAttr(value)}" ${value === this.collectionRarity ? 'selected' : ''}>${value === 'all' ? 'すべてのレアリティ' : escapeHtml(this.rarityById.get(value)?.label || value)}</option>`).join('');
    this.openModal(source, '図鑑を絞り込む', `<form class="meta-settings-form" data-filter-form><label class="meta-form-row"><span>カテゴリー</span><select name="category">${categoryOptions}</select></label><label class="meta-form-row"><span>レアリティ</span><select name="rarity">${rarityOptions}</select></label><button type="button" class="meta-sheet-action" data-filter-apply>適用</button></form>`, 'COLLECTION FILTER');
  }

  applyCollectionFilter(button) {
    const form = button.closest('form');
    this.collectionCategory = form.category.value;
    this.collectionRarity = form.rarity.value;
    this.closeModal();
    this.renderCollection();
  }

  openItemDetail(itemId, source) {
    const item = this.itemsById.get(itemId);
    if (!item) return;
    const owned = this.state.collection?.[itemId];
    const banner = this.bannerById.get(this.selectedBannerId) || this.activeBanners()[0];
    const rate = Number(banner?.rates?.[item.rarity] ?? this.rarityById.get(item.rarity)?.basisPoints ?? 0) / 100;
    const index = this.items.findIndex((entry) => entry.id === itemId) + 1;
    const body = `<div class="meta-item-detail rarity-${item.rarity}"><div class="meta-item-art">${stoneArt(item)}</div><span class="meta-item-rarity">${escapeHtml(RARITY_LABEL[item.rarity])}</span><h3>${escapeHtml(owned ? item.name : item.isSecret ? '???' : item.name)}</h3><p>${escapeHtml(owned ? item.description : item.isSecret ? '未取得の隠しコレクション' : 'まだ入手していません。')}</p><div class="meta-detail-grid"><div><span>図鑑番号</span><strong>No.${String(index).padStart(3, '0')}</strong></div><div><span>所属シリーズ</span><strong>${escapeHtml(item.series || item.collectionCategory)}</strong></div><div><span>所持数</span><strong>${number(owned?.count || 0)}</strong></div><div><span>レアリティ排出率</span><strong>${rate.toFixed(2)}%</strong></div><div><span>初回獲得</span><strong>${owned ? escapeHtml(dateTime(owned.firstAcquiredAtUtc)) : '—'}</strong></div><div><span>最新獲得</span><strong>${owned ? escapeHtml(dateTime(owned.lastAcquiredAtUtc)) : '—'}</strong></div></div>${owned ? `<div class="meta-detail-actions"><button type="button" data-toggle-favorite="${escapeAttr(item.id)}">${owned.favorite ? '★ お気に入り解除' : '☆ お気に入りに追加'}</button></div>` : ''}</div>`;
    this.openModal(source, owned ? item.name : '未取得の石', body, 'STONE DETAIL');
    if (owned && !owned.seen) this.acknowledgeItem(itemId);
  }

  async acknowledgeItem(itemId) {
    try {
      const envelope = normalize(await this.adapter.execute('collection.acknowledge', { itemId }));
      const result = envelope.result || envelope;
      if (result.ok) { this.state = result.snapshot; this.renderCommon(); }
    } catch { /* acknowledgement can safely retry on the next open */ }
  }

  async toggleFavorite(itemId, button) {
    const favorite = !Boolean(this.state.collection?.[itemId]?.favorite);
    button.disabled = true;
    try {
      const envelope = normalize(await this.adapter.execute('collection.favorite', { itemId, favorite }));
      const result = envelope.result || envelope;
      if (!result.ok) throw new Error(result.error);
      this.state = result.snapshot;
      this.renderAll();
      this.openItemDetail(itemId, this.modalFocus || button);
    } catch (error) { button.disabled = false; this.toast(`お気に入りを変更できません: ${error.message}`); }
  }

  openSettings(source) {
    const settings = this.state.settings;
    const body = `<form class="meta-settings-form" data-settings-form>
      ${volumeRow('Master Volume', 'masterVolume', settings.masterVolume)}
      ${volumeRow('BGM Volume', 'bgmVolume', settings.bgmVolume)}
      ${volumeRow('SFX Volume', 'sfxVolume', settings.sfxVolume)}
      <label class="meta-form-row meta-settings-inline"><span>Mute</span><span class="meta-toggle"><input type="checkbox" name="muted" ${settings.muted ? 'checked' : ''}><span></span></span></label>
      <fieldset class="meta-form-row meta-choice-field"><legend>Effect Quality</legend><div class="meta-choice-group">${choice('effectQuality', 'low', 'LOW', settings.effectQuality)}${choice('effectQuality', 'normal', 'MEDIUM', settings.effectQuality)}${choice('effectQuality', 'high', 'HIGH', settings.effectQuality)}</div></fieldset>
      <fieldset class="meta-form-row meta-choice-field"><legend>Animation Speed</legend><div class="meta-choice-group">${choice('animationSpeed', 'normal', 'NORMAL', settings.animationSpeed)}${choice('animationSpeed', 'fast', 'FAST', settings.animationSpeed)}${choice('animationSpeed', 'skip', 'SKIP', settings.animationSpeed)}</div></fieldset>
      <label class="meta-form-row meta-settings-inline"><span>Reduce Motion</span><span class="meta-toggle"><input type="checkbox" name="reduceMotion" ${settings.reduceMotion ? 'checked' : ''}><span></span></span></label>
      <label class="meta-form-row meta-settings-inline"><span>既出LEGENDARYを短縮</span><span class="meta-toggle"><input type="checkbox" name="skipPreviouslySeenLegendary" ${settings.skipPreviouslySeenLegendary ? 'checked' : ''}><span></span></span></label>
      <button class="meta-sheet-action" type="button" data-save-settings>設定を保存</button>
    </form>`;
    this.openModal(source, 'サウンドと演出', body, 'PRESENTATION');
  }

  async saveSettings(button) {
    const form = button.closest('form');
    const payload = {
      masterVolume: Number(form.masterVolume.value), bgmVolume: Number(form.bgmVolume.value),
      sfxVolume: Number(form.sfxVolume.value), muted: form.muted.checked,
      effectQuality: form.effectQuality.value, reduceMotion: form.reduceMotion.checked,
      animationSpeed: form.animationSpeed.value,
      skipPreviouslySeenLegendary: form.skipPreviouslySeenLegendary.checked,
    };
    await this.executeMutation('settings.update', payload, button, '設定を保存しました');
  }

  async setAnimationSpeed(speed) {
    if (!['normal', 'fast', 'skip'].includes(speed) || speed === this.state.settings.animationSpeed) return;
    const settings = { ...this.state.settings, animationSpeed: speed };
    try {
      const envelope = normalize(await this.adapter.execute('settings.update', settings));
      const result = envelope.result || envelope;
      if (!result.ok) throw new Error(result.error);
      this.state = result.snapshot;
      this.renderAll();
    } catch (error) { this.toast(`演出速度を保存できません: ${error.message}`); }
  }

  openProfileEditor(source) {
    const profile = this.state.profile;
    const icons = [
      { value: 'builtin:stone', label: 'デフォルト', item: null, owned: true },
      ...this.items.filter((item) => item.rewardType === 'profileIcon')
        .map((item) => ({ value: `item:${item.id}`, label: item.name, item, owned: Boolean(this.state.collection[item.id]) })),
    ];
    const frames = [
      { value: 'builtin:default', label: 'デフォルト', item: null, owned: true },
      ...this.items.filter((item) => item.rewardType === 'profileFrame')
        .map((item) => ({ value: `item:${item.id}`, label: item.name, item, owned: Boolean(this.state.collection[item.id]) })),
    ];
    this.profileEditor = { icon: profile.icon, frame: profile.frame, titleId: profile.titleId || 'rookie-miner', dataUri: profile.customIconDataUri || '', image: null, zoom: 1, x: 0, y: 0, tab: 'identity' };
    const ownedTitleIds = new Set(['rookie-miner', ...Object.keys(this.state.ownedTitles || {})]);
    const titleOptions = this.titles.map((title) => {
      const owned = ownedTitleIds.has(title.id);
      return `<button type="button" class="meta-title-option tier-${escapeAttr(title.tier)}${title.id === this.profileEditor.titleId ? ' is-selected' : ''}${owned ? '' : ' is-locked'}" data-profile-title-id="${escapeAttr(title.id)}" ${owned ? '' : 'disabled'}><span>${escapeHtml(title.name)}</span><small>${owned ? escapeHtml(title.tier) : '未獲得'}</small>${owned ? '' : '<svg aria-hidden="true"><use href="#sm-lock"></use></svg>'}</button>`;
    }).join('');
    const option = (entry, kind) => `<button type="button" class="meta-appearance-option${entry.item ? ` rarity-${entry.item.rarity}` : ''}${profile[kind] === entry.value ? ' is-selected' : ''}${entry.owned ? '' : ' is-locked'}" data-appearance-${kind}="${escapeAttr(entry.value)}" title="${escapeAttr(entry.owned ? entry.label : `${entry.label}（未獲得）`)}" ${entry.owned ? '' : 'disabled'}><span class="meta-item-art">${entry.item ? stoneArt(entry.item) : '<span class="meta-avatar-stone"></span>'}</span><small>${escapeHtml(entry.label)}</small>${entry.owned ? '' : '<svg aria-hidden="true"><use href="#sm-lock"></use></svg>'}</button>`;
    const body = `<form class="meta-profile-form" data-profile-form>
      <section class="meta-profile-live-preview"><span class="meta-avatar profile" data-profile-editor-avatar></span><div><span data-profile-editor-title>${escapeHtml(this.profileTitle())}</span><strong data-profile-editor-name>${escapeHtml(profile.name)}</strong><small>MINING LEVEL ${number(this.state.mining.miningLevel)}</small></div></section>
      <div class="meta-editor-tabs" role="tablist" aria-label="プロフィール編集項目">
        <button type="button" class="is-active" data-profile-editor-tab="identity">基本情報</button><button type="button" data-profile-editor-tab="icon">アイコン</button><button type="button" data-profile-editor-tab="custom">画像</button><button type="button" data-profile-editor-tab="frame">フレーム</button>
      </div>
      <section class="meta-editor-panel" data-profile-editor-panel="identity">
        <label class="meta-form-row"><span>ユーザー名</span><input type="text" name="profileName" maxlength="24" value="${escapeAttr(profile.name)}" data-profile-name-input></label>
        <div class="meta-form-row"><span>装備する称号</span><div class="meta-title-options">${titleOptions}</div></div>
      </section>
      <section class="meta-editor-panel" data-profile-editor-panel="icon" hidden><div class="meta-form-row"><span>所持アイコン・未獲得</span><div class="meta-appearance-grid">${icons.map((entry) => option(entry, 'icon')).join('')}</div></div></section>
      <section class="meta-editor-panel" data-profile-editor-panel="custom" hidden><div class="meta-avatar-editor"><div class="meta-crop-preview"><canvas width="512" height="512" data-crop-canvas></canvas></div><div>
          <label class="meta-form-row"><span>ローカル画像</span><input type="file" accept="image/png,image/jpeg,image/webp" data-profile-file></label>
          <label class="meta-form-row"><span>ズーム</span><input type="range" min="1" max="3" step=".01" value="1" data-crop-zoom></label>
          <label class="meta-form-row"><span>横位置</span><input type="range" min="-1" max="1" step=".01" value="0" data-crop-x></label>
          <label class="meta-form-row"><span>縦位置</span><input type="range" min="-1" max="1" step=".01" value="0" data-crop-y></label>
        </div></div><button type="button" class="meta-secondary-action${profile.icon === 'custom:image' ? ' is-selected' : ''}" data-appearance-icon="custom:image">この画像をアイコンにする</button></section>
      <section class="meta-editor-panel" data-profile-editor-panel="frame" hidden><div class="meta-form-row"><span>所持フレーム・未獲得</span><div class="meta-appearance-grid">${frames.map((entry) => option(entry, 'frame')).join('')}</div></div></section>
      <div class="meta-profile-actions"><button class="meta-secondary-action" type="button" data-close-modal>キャンセル</button><button class="meta-sheet-action" type="button" data-save-profile>保存</button></div>
    </form>`;
    this.openModal(source, 'プロフィール編集', body, 'STONE ACCOUNT');
    this.renderProfileEditorPreview();
    if (profile.customIconDataUri) this.loadImageSource(profile.customIconDataUri);
    else this.drawCropPlaceholder();
  }

  setProfileEditorTab(tab, button) {
    if (!this.profileEditor || !['identity', 'icon', 'custom', 'frame'].includes(tab)) return;
    this.profileEditor.tab = tab;
    this.qa('[data-profile-editor-tab]').forEach((entry) => {
      const active = entry === button;
      entry.classList.toggle('is-active', active);
      entry.setAttribute('aria-selected', String(active));
    });
    this.qa('[data-profile-editor-panel]').forEach((panel) => { panel.hidden = panel.dataset.profileEditorPanel !== tab; });
  }

  selectProfileTitle(button) {
    if (!this.profileEditor || button.disabled) return;
    this.profileEditor.titleId = button.dataset.profileTitleId;
    button.parentElement.querySelectorAll('[data-profile-title-id]').forEach((entry) => entry.classList.toggle('is-selected', entry === button));
    this.renderProfileEditorPreview();
  }

  selectAppearance(button, kind) {
    if (!this.profileEditor) return;
    this.profileEditor[kind] = button.dataset[kind === 'icon' ? 'appearanceIcon' : 'appearanceFrame'];
    button.parentElement.querySelectorAll('.meta-appearance-option').forEach((item) => item.classList.toggle('is-selected', item === button));
    this.renderProfileEditorPreview();
  }

  renderProfileEditorPreview() {
    const editor = this.profileEditor;
    const avatar = this.q('[data-profile-editor-avatar]');
    if (!editor || !avatar) return;
    avatar.className = 'meta-avatar profile';
    const frame = editor.frame?.startsWith('item:') ? editor.frame.slice(5) : 'default';
    avatar.classList.add(`frame-${cssToken(frame)}`);
    if (editor.icon === 'custom:image' && editor.dataUri) avatar.innerHTML = `<img alt="" src="${escapeAttr(editor.dataUri)}">`;
    else if (editor.icon?.startsWith('item:')) {
      const item = this.itemsById.get(editor.icon.slice(5));
      if (item) avatar.classList.add(`rarity-${item.rarity}`);
      avatar.innerHTML = stoneArt(item);
    } else avatar.innerHTML = '<span class="meta-avatar-stone"></span>';
    text(this.q('[data-profile-editor-name]'), this.q('[data-profile-name-input]')?.value || this.state.profile.name);
    text(this.q('[data-profile-editor-title]'), this.titleById.get(editor.titleId)?.name || '駆け出し石掘り');
  }

  loadProfileImage(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      this.toast('PNG / JPEG / WebP（5MB以下）を選んでください'); return;
    }
    const reader = new FileReader();
    reader.onload = () => this.loadImageSource(reader.result);
    reader.readAsDataURL(file);
  }

  loadImageSource(source) {
    const image = new Image();
    image.onload = () => {
      if (!this.profileEditor) return;
      this.profileEditor.image = image;
      this.profileEditor.icon = 'custom:image';
      this.q('[data-appearance-icon="custom:image"]')?.click();
      this.drawCrop();
    };
    image.onerror = () => this.toast('画像を読み込めませんでした');
    image.src = source;
  }

  drawCrop() {
    const canvas = this.q('[data-crop-canvas]');
    const editor = this.profileEditor;
    if (!canvas || !editor?.image) return this.drawCropPlaceholder();
    const context = canvas.getContext('2d');
    const image = editor.image;
    const base = Math.max(canvas.width / image.width, canvas.height / image.height);
    const scale = base * editor.zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    const overflowX = Math.max(0, width - canvas.width);
    const overflowY = Math.max(0, height - canvas.height);
    const x = (canvas.width - width) / 2 + editor.x * overflowX / 2;
    const y = (canvas.height - height) / 2 + editor.y * overflowY / 2;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, x, y, width, height);
    editor.dataUri = canvas.toDataURL('image/jpeg', .86);
    this.renderProfileEditorPreview();
  }

  drawCropPlaceholder() {
    const canvas = this.q('[data-crop-canvas]');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#596fda'); gradient.addColorStop(1, '#3d315c');
    context.fillStyle = gradient; context.fillRect(0, 0, 512, 512);
    context.fillStyle = '#d6d8dd'; context.beginPath();
    context.ellipse(256, 270, 115, 95, -.16, 0, Math.PI * 2); context.fill();
  }

  async saveProfile(button) {
    const form = button.closest('form');
    button.disabled = true;
    try {
      const editor = this.profileEditor;
      const response = normalize(await this.adapter.execute('profile.update', {
        name: form.profileName.value.trim(), titleId: editor.titleId,
        icon: editor.icon, frame: editor.frame,
        customIconDataUri: editor.icon === 'custom:image' ? editor.dataUri : '',
      }));
      const result = response.result || response;
      if (!result.ok) throw new Error(result.error);
      this.state = result.snapshot;
      this.renderAll(); this.closeModal(); this.showEvents(result.events || []); this.toast('プロフィールを保存しました');
    } catch (error) { this.toast(`保存できません: ${error.message}`); }
    finally { button.disabled = false; }
  }

  renderOnboarding() {
    const layer = this.q('[data-onboarding]');
    if (!layer) return;
    layer.hidden = Boolean(this.state.profile.onboardingComplete);
    this.qa('[data-onboarding-page]').forEach((page) => { page.hidden = Number(page.dataset.onboardingPage) !== this.onboardingPage; });
    this.qa('.onboarding-dots i').forEach((dot, index) => dot.classList.toggle('is-active', index === this.onboardingPage));
    const onboarding = this.catalog.messages?.onboarding || [];
    this.qa('[data-onboarding-copy]').forEach((copy) => {
      const value = onboarding[Number(copy.dataset.onboardingCopy)];
      if (value) text(copy, value);
    });
    const button = this.q('[data-onboarding-next]');
    text(button, this.onboardingPage >= 2 ? '石を掘り始める' : '次へ');
  }

  async advanceOnboarding(button) {
    if (this.onboardingPage < 2) { this.onboardingPage += 1; this.renderOnboarding(); return; }
    button.disabled = true;
    try {
      const envelope = normalize(await this.adapter.execute('onboarding.complete', {}));
      const result = envelope.result || envelope;
      if (!result.ok) throw new Error(result.error);
      this.state = result.snapshot;
      this.renderAll();
      this.renderOnboarding();
      this.toast('STONE META GAMEへようこそ');
    } catch (error) { button.disabled = false; this.toast(`開始できません: ${error.message}`); }
  }

  openModal(source, title, body, kicker) {
    const layer = this.q('[data-modal-layer]');
    if (layer.hidden) this.modalFocus = source;
    text(this.q('[data-sheet-title]'), title);
    text(this.q('[data-sheet-kicker]'), kicker);
    this.q('[data-sheet-body]').innerHTML = body;
    layer.hidden = false;
    requestAnimationFrame(() => this.q('[data-sheet] button, [data-sheet] input, [data-sheet] select')?.focus());
  }

  closeModal() {
    const layer = this.q('[data-modal-layer]');
    if (layer.hidden) return;
    layer.hidden = true;
    this.q('[data-sheet-body]').replaceChildren();
    this.profileEditor = null;
    this.modalFocus?.focus?.();
    this.modalFocus = null;
  }

  async executeMutation(action, payload, button, successMessage) {
    button.disabled = true;
    try {
      const envelope = normalize(await this.adapter.execute(action, payload));
      const result = envelope.result || envelope;
      if (!result.ok) throw new Error(result.error || 'unknown');
      this.state = result.snapshot; this.renderAll(); this.closeModal(); this.toast(successMessage);
      this.showEvents(result.events || []);
    } catch (error) { this.toast(`保存できません: ${error.message}`); }
    finally { button.disabled = false; }
  }

  async runDebug(command) {
    if (!this.developmentMode) return;
    const [kind, value] = command.split(':');
    try {
      if (kind === 'points') return this.applyDebug('debug.grantPoints', { amount: Number(value) });
      if (kind === 'xp') return this.applyDebug('debug.addXp', { amount: Number(value) });
      if (kind === 'mine') {
        const total = Number(value) === 100 ? this.state.mining.totalStoneMined + 100 : Number(value);
        return this.applyDebug('debug.setMined', { total });
      }
      if (kind === 'pity') {
        const banner = this.bannerById.get(this.selectedBannerId) || this.activeBanners()[0];
        const minimumRarity = value === 'legendary' ? 'LEGENDARY' : value.toUpperCase();
        const track = banner?.pityTracks?.find((entry) => entry.minimumRarity === minimumRarity);
        if (!track) throw new Error(`${minimumRarity} Pityがありません`);
        return this.applyDebug('debug.setPity', {
          bannerId: banner.id, trackId: track.id, value: track.threshold - 1,
        });
      }
      if (kind === 'affinity') return this.applyDebug('debug.advanceAffinity', {});
      if (kind === 'achievement') return this.applyDebug('debug.unlockAchievement', { id: value });
      if (kind === 'rarity') {
        await this.ensureDebugFunds(1); this.navigate('gacha'); return this.requestDraw(1, value);
      }
      if (kind === 'ten') {
        await this.ensureDebugFunds(10); this.navigate('gacha'); return this.requestDraw(10, value);
      }
    } catch (error) { this.toast(`Debug失敗: ${error.message}`); }
  }

  async ensureDebugFunds(count) {
    const banner = this.bannerById.get(this.selectedBannerId) || this.activeBanners()[0];
    const needed = count === 10 ? Number(banner?.tenPullCost || 0) : Number(banner?.cost || 0);
    if (this.state.mining.availableMiningPoints >= needed || this.state.mining.gachaTickets >= count) return;
    await this.applyDebug('debug.grantPoints', { amount: needed }, false);
  }

  async applyDebug(action, payload, showToast = true) {
    const envelope = normalize(await this.adapter.execute(action, payload));
    const result = envelope.result || envelope;
    if (!result.ok) throw new Error(result.error);
    this.state = result.snapshot; this.renderAll(); this.showEvents(result.events || []);
    if (showToast) this.toast('Debug状態を反映しました');
  }

  onAdapterMessage(message) {
    const value = normalize(message);
    const result = value.result || value;
    if (result.snapshot) { this.state = result.snapshot; this.renderAll(); }
    if (result.events?.length) this.showEvents(result.events);
  }

  showEvents(events) {
    this.eventQueue.push(...(events || []).filter(Boolean));
    this.drainEventQueue();
  }

  async drainEventQueue() {
    if (this.presentingEvent) return;
    this.presentingEvent = true;
    while (this.eventQueue.length) {
      const event = this.eventQueue.shift();
      if (event.type === 'affinity.levelUp' || event.type === 'mining.levelUp') await this.showProgressionEvent(event);
      else await this.showEventToast(event);
    }
    this.presentingEvent = false;
  }

  async showEventToast(event) {
    const layer = this.q('[data-event-layer]');
    const node = document.createElement('article');
    const rarity = eventRarity(event.rarity);
    node.className = `meta-event-toast rarity-${rarity}`;
    node.style.setProperty('--rarity', RARITY_COLOR[rarity] || RARITY_COLOR.NORMAL);
    const label = event.type === 'reward.claimed' ? 'REWARD ACQUIRED' : event.type === 'collection.new' ? 'NEW COLLECTION' : 'ACHIEVEMENT UNLOCKED';
    node.innerHTML = `<div class="meta-event-icon"><svg><use href="#${event.type === 'reward.claimed' ? 'sm-gift' : 'sm-trophy'}"></use></svg></div><div><small>${escapeHtml(label)} · ${escapeHtml(event.rarity || rarity)}</small><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.subtitle || this.rewardListText(event.rewards))}</p></div>`;
    layer.append(node);
    this.audio.achievement(rarity);
    await sleep(this.motionReduced ? 500 : rarityOrder(rarity) >= 3 ? 3500 : 2300);
    node.classList.add('is-leaving');
    await sleep(360);
    node.remove();
  }

  async showProgressionEvent(event) {
    const node = document.createElement('div');
    const rarity = eventRarity(event.rarity || 'RARE');
    node.className = `meta-progression-event rarity-${rarity}`;
    node.innerHTML = `<div class="meta-progression-stone">${stoneArt({ id: event.id, rarity })}</div><small>${escapeHtml(event.title)}</small><h2>${escapeHtml(event.previous || '')}<span>→</span>${escapeHtml(event.current || event.subtitle || '')}</h2><p>${escapeHtml(event.subtitle || '')}</p>`;
    this.app.append(node);
    if (event.type === 'affinity.levelUp') this.audio.affinity(); else this.audio.level();
    await frames(2);
    node.classList.add('is-visible');
    await sleep(this.motionReduced ? 700 : 2700);
    node.classList.remove('is-visible');
    await sleep(this.motionReduced ? 1 : 500);
    node.remove();
  }

  toast(message) {
    const layer = this.q('[data-toast-layer]');
    layer.replaceChildren();
    const node = document.createElement('div'); node.className = 'meta-toast'; node.textContent = message;
    layer.append(node); setTimeout(() => node.remove(), 2600);
  }

  applySettings() {
    const settings = this.state.settings = {
      masterVolume: .8, bgmVolume: .45, sfxVolume: .8, muted: false,
      effectQuality: 'normal', reduceMotion: false, animationSpeed: 'normal',
      skipPreviouslySeenLegendary: false, ...(this.state.settings || {}),
    };
    this.app.classList.toggle('meta-reduce-motion', Boolean(settings.reduceMotion));
    this.app.classList.remove('meta-quality-low', 'meta-quality-normal', 'meta-quality-high');
    this.app.classList.add(`meta-quality-${settings.effectQuality || 'normal'}`);
    this.audio.setSettings(settings);
  }

  get motionReduced() {
    return Boolean(this.state.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
}

class StoneAudioManager {
  constructor() { this.context = null; this.settings = { masterVolume: .8, bgmVolume: .45, sfxVolume: .8, muted: false }; this.bed = null; }
  setSettings(settings) { this.settings = { ...this.settings, ...settings }; if (this.settings.muted) this.stopBed(); }
  ensure() {
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    return this.context;
  }
  tone(frequency, durationMs, gain = .05, type = 'sine', delayMs = 0) {
    if (this.settings.muted || this.settings.masterVolume <= 0 || this.settings.sfxVolume <= 0) return;
    const context = this.ensure(); const oscillator = context.createOscillator(); const volume = context.createGain();
    const start = context.currentTime + delayMs / 1000; const end = start + durationMs / 1000;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(.0001, start); volume.gain.exponentialRampToValueAtTime(Math.max(.0001, gain * this.settings.masterVolume * this.settings.sfxVolume), start + .012); volume.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(volume).connect(context.destination); oscillator.start(start); oscillator.stop(end + .02);
  }
  hover() { this.tone(540, 35, .012, 'sine'); }
  click() { this.tone(330, 55, .025, 'triangle'); }
  navigate() { this.tone(450, 65, .018, 'sine'); this.tone(620, 80, .014, 'sine', 45); }
  preview() { this.tone(520, 80, .022, 'sine'); }
  tick(progress) { this.tone(650 + progress * 260, 28, .018 + progress * .009, 'square'); }
  stop(rarity) { this.tone(110, 170, .08, 'sine'); if (rarityOrder(rarity) >= 3) this.tone(440, 260, .05, 'triangle', 90); }
  crack() { this.tone(95, 110, .08, 'sawtooth'); this.tone(1250, 80, .025, 'square', 90); }
  errorFake() { this.tone(70, 600, .07, 'sawtooth'); }
  newItem() { this.tone(880, 130, .035, 'sine', 80); this.tone(1320, 190, .03, 'sine', 180); }
  rarity(rarity, short = false) {
    const order = rarityOrder(rarity); const base = [330, 420, 500, 600, 720, 840][order];
    this.tone(base, short ? 100 : 240, .04, 'triangle');
    if (order >= 2) this.tone(base * 1.25, short ? 120 : 330, .035, 'sine', 80);
    if (order >= 3) this.tone(base * 1.5, short ? 140 : 440, .04, 'sine', 170);
    if (order >= 4) this.tone(base * 2, short ? 160 : 650, .025, 'sine', 290);
  }
  achievement(rarity) { this.tone(392, 170, .035, 'triangle'); this.tone(523, 220, .035, 'triangle', 100); this.rarity(rarity, true); }
  affinity() { [392,523,659,784].forEach((f,i)=>this.tone(f,480,.035,'sine',i*110)); }
  level() { [330,440,554,660].forEach((f,i)=>this.tone(f,300,.032,'triangle',i*90)); }
  tenReady(rarity) { this.tone(100, 420, .06, 'sine'); this.rarity(rarity, true); }
  startBed(rarity) {
    this.stopBed(); if (this.settings.muted || this.settings.bgmVolume <= 0) return;
    const context = this.ensure(); const gain = context.createGain(); const now = context.currentTime;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, .008 * this.settings.masterVolume * this.settings.bgmVolume), now + .32);
    gain.connect(context.destination);
    const oscillators = [55, 82.5].map((frequency) => { const oscillator=context.createOscillator();oscillator.type=rarityOrder(rarity)>=4?'triangle':'sine';oscillator.frequency.value=frequency;oscillator.connect(gain);oscillator.start();return oscillator; });
    this.bed = { gain, oscillators };
  }
  stopBed() {
    const bed = this.bed;
    if (!bed || !this.context) return;
    this.bed = null;
    const now = this.context.currentTime;
    try {
      bed.gain.gain.cancelScheduledValues(now);
      bed.gain.gain.setValueAtTime(Math.max(.0001, bed.gain.gain.value), now);
      bed.gain.gain.exponentialRampToValueAtTime(.0001, now + .22);
      bed.oscillators.forEach((oscillator) => oscillator.stop(now + .24));
      setTimeout(() => { try { bed.oscillators.forEach((node) => node.disconnect()); bed.gain.disconnect(); } catch {} }, 300);
    } catch {}
  }
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  Object.entries(value).forEach(([key, item]) => {
    const normalizedKey = /^[A-Z][a-z]/.test(key) ? key[0].toLowerCase() + key.slice(1) : key;
    result[normalizedKey] = normalize(item);
  });
  return result;
}

export function createCaseReelPlan(items, resultItem, targetRarity, config) {
  if (!Array.isArray(items) || !items.length || !resultItem) throw new TypeError('Reel catalog and result are required.');
  const count = Number(config.singleReelCards);
  const targetIndex = Number(config.singleTargetIndex);
  if (!Number.isInteger(count) || !Number.isInteger(targetIndex) || count < 20
    || targetIndex < 10 || targetIndex >= count) throw new RangeError('Invalid reel configuration.');
  const cards = [];
  for (let index = 0; index < count; index += 1) {
    if (index === targetIndex) { cards.push(resultItem); continue; }
    const targetOrder = rarityOrder(targetRarity);
    let order = Math.floor(hashUnit(`${targetRarity}:${index}`) * Math.min(4, targetOrder + 3));
    if (index % 11 === 4) order = Math.min(5, targetOrder + 1);
    const pool = items.filter((item) => rarityOrder(item.rarity) === order);
    cards.push(pool[Math.floor(hashUnit(`item:${index}:${targetRarity}`) * pool.length)] || items[0]);
  }
  return { items: cards, targetIndex, resultItemId: resultItem.id };
}

export function createTenRevealPlan(results) {
  if (!Array.isArray(results) || !results.length) throw new TypeError('Ten-pull results are required.');
  const seed = results.map((result, index) => [index, result.itemId, result.rarity,
    result.ownedCount, result.pityTrackId].join(':')).join('|');
  const modes = ['ascending', 'high-last', 'random'];
  const mode = modes[Math.floor(hashUnit(`ten-mode:${seed}`) * modes.length)];
  const indexed = results.map((result, originalIndex) => ({ result, originalIndex,
    randomOrder: hashUnit(`ten-order:${seed}:${originalIndex}`) }));

  if (mode === 'ascending') {
    indexed.sort((a, b) => rarityOrder(a.result.rarity) - rarityOrder(b.result.rarity)
      || a.randomOrder - b.randomOrder || a.originalIndex - b.originalIndex);
  } else {
    indexed.sort((a, b) => a.randomOrder - b.randomOrder || a.originalIndex - b.originalIndex);
    if (mode === 'high-last' && indexed.length > 1) {
      const highest = Math.max(...indexed.map((entry) => rarityOrder(entry.result.rarity)));
      const targetIndex = indexed.findIndex((entry) => rarityOrder(entry.result.rarity) === highest);
      indexed.push(indexed.splice(targetIndex, 1)[0]);
    }
  }

  return { mode, results: indexed.map((entry) => entry.result) };
}

function text(element, value) { if (element) element.textContent = value ?? ''; }
function number(value) { return new Intl.NumberFormat('ja-JP').format(Number(value || 0)); }
function duration(seconds) { const minutes=Math.floor(Number(seconds||0)/60); if(minutes<60)return `${minutes}分`;const hours=Math.floor(minutes/60);return `${hours}時間 ${minutes%60}分`; }
function dateOnly(value) { if (!value) return '—'; const date=new Date(value); return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(date); }
function dateTime(value) { if (!value) return '—'; const date=new Date(value); return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date); }
function rarityOrder(value) { return Math.max(0, RARITY_ORDER.indexOf(value)); }
function eventRarity(value) { return ({ COMMON:'NORMAL', RARE:'RARE', EPIC:'SSR', LEGENDARY:'LEGENDARY', SECRET:'UR' })[value] || (RARITY_ORDER.includes(value) ? value : 'NORMAL'); }
function highestRarity(results) { return results.reduce((best,item)=>rarityOrder(item.rarity)>rarityOrder(best)?item.rarity:best,'NORMAL'); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function frames(count) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => { if (finished) return; finished = true; clearTimeout(fallback); resolve(); };
    const step = () => { if (finished) return; if (--count <= 0) finish(); else requestAnimationFrame(step); };
    // requestAnimationFrame may be paused by an occluded/minimized WebView or a headless
    // validation run. Layout reads below are synchronous, so a short timer is a safe fallback.
    const fallback = setTimeout(finish, 80);
    requestAnimationFrame(step);
  });
}
function escapeHtml(value) { return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g,'&#96;'); }
function cssToken(value) { return String(value||'default').replace(/[^A-Za-z0-9_-]/g,'-'); }
function hashUnit(value) { let hash=2166136261;for(let i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return (hash>>>0)/4294967296; }
function stoneArt(item = {}) {
  const seed = item.image || item.id || 'procedural://stone/default';
  const kind = /^procedural:\/\/(stone|frame|avatar)\//.exec(seed)?.[1] || 'stone';
  const rotation = Math.round(hashUnit(`${seed}:rotation`) * 24 - 12);
  const corner = 43 + Math.round(hashUnit(`${seed}:corner`) * 15);
  const opposite = 100 - corner;
  const scaleX = (.9 + hashUnit(`${seed}:width`) * .2).toFixed(3);
  const scaleY = (.9 + hashUnit(`${seed}:height`) * .2).toFixed(3);
  if (kind === 'frame') return `<span class="meta-procedural-frame" style="--stone-rotation:${rotation}deg" aria-hidden="true"><span></span></span>`;
  if (kind === 'avatar') return `<span class="meta-procedural-avatar" style="--stone-rotation:${rotation}deg" aria-hidden="true"><span></span></span>`;
  return `<span class="meta-procedural-stone" style="--stone-rotation:${rotation}deg;--stone-radius:${corner}% ${opposite}% ${opposite}% ${corner}%/${opposite}% ${corner}% ${corner}% ${opposite}%;--stone-scale-x:${scaleX};--stone-scale-y:${scaleY}" aria-hidden="true"></span>`;
}
function makeRequestId(prefix) { const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return `${prefix}:ui:${[...bytes].map((x)=>x.toString(16).padStart(2,'0')).join('')}`; }
function hexAlpha(hex, alpha) { const h=hex.replace('#','');const n=parseInt(h,16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${alpha})`; }
function volumeRow(label,name,value) { return `<label class="meta-form-row"><span>${label} <output>${Math.round(value*100)}%</output></span><input type="range" min="0" max="1" step=".01" value="${value}" name="${name}" data-volume></label>`; }
function choice(name,value,label,selected) { return `<label><input type="radio" name="${name}" value="${value}" ${selected===value?'checked':''}><span>${label}</span></label>`; }

if (typeof window !== 'undefined') window.StoneMetaGameUI = StoneMetaGameUI;
