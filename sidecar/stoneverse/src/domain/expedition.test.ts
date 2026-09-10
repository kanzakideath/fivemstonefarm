import { describe, expect, it } from 'vitest';
import { SeededRng } from './rng';
import { createInitialGameState } from './state';
import {
  advanceExpeditions,
  claimExpedition,
  claimStoredExpeditionDiscovery,
  evaluateExpeditionPartyBuild,
  EXPEDITION_DURATIONS,
  EXPEDITION_REGIONS,
  EXPEDITION_STRATEGY_CONFIGS,
  MAX_EXPEDITION_DISCOVERY_STORAGE,
  MAX_EXPEDITION_CYCLES_PER_ADVANCE,
  MAX_PENDING_RARE_DISCOVERIES,
  MAX_EXPEDITION_REPORT_EVENTS,
  parseExpeditionDiscoveryMutation,
  parseExpeditionEquipmentReward,
  rollExpeditionDiscoveryMutation,
  startExpedition,
  stopExpedition,
} from './expedition';
import type { Clock, ExpeditionPartyMemberSnapshot, ExpeditionRareDiscovery, LineageRef } from './types';

const startMs = Date.parse('2026-09-10T00:00:00.000Z');
const clockAt = (milliseconds: number): Clock => ({ now: () => new Date(milliseconds) });

describe('expedition engine', () => {
  it('exposes every required duration, region and strategy configuration', () => {
    expect(EXPEDITION_DURATIONS.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'duration_15m', 'duration_30m', 'duration_1h', 'duration_3h', 'duration_6h', 'duration_12h', 'duration_24h',
    ]));
    expect(EXPEDITION_REGIONS.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      'Starter Quarry', 'Crystal Cavern', 'Volcanic Rift', 'Ancient Stratum', 'Meteor Crater', 'Abyssal Mine', 'Celestial Fault',
    ]));
    expect(Object.keys(EXPEDITION_STRATEGY_CONFIGS)).toEqual(expect.arrayContaining([
      'BALANCED', 'COMBAT', 'MINING', 'DISCOVERY', 'SAFE', 'HIGH_RISK',
    ]));
    expect(EXPEDITION_STRATEGY_CONFIGS.SAFE.failureRetention).toBeGreaterThan(EXPEDITION_STRATEGY_CONFIGS.HIGH_RISK.failureRetention);
    expect(EXPEDITION_STRATEGY_CONFIGS.HIGH_RISK.reward).toBeGreaterThan(EXPEDITION_STRATEGY_CONFIGS.SAFE.reward);
    for (const region of EXPEDITION_REGIONS) {
      expect(region.enemyTags.length).toBeGreaterThan(0);
      expect(region.favoredElements.length).toBeGreaterThan(0);
      expect(region.materialDropIds.length).toBeGreaterThan(0);
      expect(region.rareSpeciesIds.length).toBeGreaterThan(0);
      expect(region.equipmentDropId).toBeTruthy();
      expect(region.bossChance).toBeGreaterThan(0);
    }
  });

  it('guarantees the first Starter Quarry cycle can bootstrap Research Core progression', () => {
    const state = createInitialGameState({ seed: 'starter-core', clock: clockAt(startMs) });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'SAFE', repeat: false,
    }, new SeededRng('starter-core-run'), clockAt(startMs));

    advanceExpeditions(state, new Date(startMs + 15 * 60 * 1_000));

    expect(run.expeditionStorage.researchCores).toBeGreaterThanOrEqual(1);
  });

  it('does not grant the bootstrap Research Core again for every new Starter run', () => {
    const state = createInitialGameState({ seed: 'starter-core-once', clock: clockAt(startMs) });
    const first = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'SAFE', repeat: false,
    }, new SeededRng('starter-core-once-first'), clockAt(startMs));
    const firstReturn = startMs + 15 * 60 * 1_000;
    advanceExpeditions(state, new Date(firstReturn));
    claimExpedition(state, first.expeditionId, clockAt(firstReturn));
    expect(state.inventory.currencies.researchCores).toBeGreaterThanOrEqual(1);

    const second = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'SAFE', repeat: false,
    }, new SeededRng('starter-core-once-second'), clockAt(firstReturn + 1));
    advanceExpeditions(state, new Date(firstReturn + 1 + 15 * 60 * 1_000));

    expect(second.expeditionStorage.researchCores).toBe(0);
  });

  it('persists the exact generated equipment descriptor independently of compact report retention', () => {
    const state = createInitialGameState({ seed: 'equipment-descriptor', clock: clockAt(startMs) });
    let descriptor: ReturnType<typeof parseExpeditionEquipmentReward> = null;
    for (let candidate = 0; candidate < 2_000 && !descriptor; candidate += 1) {
      const run = startExpedition(structuredClone(state), {
        regionId: 'region_starter_quarry', durationId: 'duration_24h', strategy: 'MATERIALS', repeat: false,
      }, new SeededRng(`equipment-descriptor-${candidate}`), clockAt(startMs));
      const isolated = createInitialGameState({ seed: `equipment-state-${candidate}`, clock: clockAt(startMs) });
      isolated.expeditions.runs = { [run.expeditionId]: run };
      isolated.expeditions.order = [run.expeditionId];
      advanceExpeditions(isolated, new Date(startMs + 24 * 60 * 60 * 1_000));
      descriptor = Object.keys(run.expeditionStorage.items).map(parseExpeditionEquipmentReward).find(Boolean) ?? null;
    }

    expect(descriptor).toMatchObject({ itemId: 'equipment_quarry_charm', rarity: 'SR' });
    expect(descriptor!.seed).toContain(':equipment:1');
  });

  it('freezes a complete party snapshot and deterministically simulates a completion', () => {
    const state = createInitialGameState({ seed: 'snapshot', clock: clockAt(startMs) });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_1h', strategy: 'COMBAT', repeat: false,
    }, new SeededRng('snapshot-run'), clockAt(startMs));
    const firstStone = state.stones[run.partySnapshot[0]!.stoneId]!;
    const snapPower = run.partySnapshot[0]!.stats.power;
    firstStone.stats.power += 9_999;
    firstStone.traitIds.push('later-trait');
    expect(run.partySnapshot[0]!.stats.power).toBe(snapPower);
    expect(run.partySnapshot[0]!.traitIds).not.toContain('later-trait');
    expect(run.partySnapshot[0]!.skillIds.length).toBeGreaterThan(0);
    expect(run.partySnapshot[0]!.individualValues.power).toBeGreaterThanOrEqual(0);

    const advanced = advanceExpeditions(state, new Date(startMs + 60 * 60 * 1_000));
    expect(advanced.cyclesProcessed).toBe(1);
    expect(run.status).toBe('READY');
    expect(run.reportSummary.battles).toBe(1);
    expect(run.reportSummary.miningYield).toBeGreaterThan(0);
    expect(run.reportEvents.some((entry) => entry.kind === 'BATTLE' || entry.kind === 'BOSS')).toBe(true);
    expect(run.reportEvents.some((entry) => entry.kind === 'MINING')).toBe(true);
  });

  it('scores actual skill, trait, equipment set and lineage identities instead of collection counts', () => {
    const state = createInitialGameState({ seed: 'build-fidelity', clock: clockAt(startMs) });
    state.facilities.expeditionGuild = 2;
    const run = startExpedition(state, {
      regionId: 'region_crystal_cavern', durationId: 'duration_1h', strategy: 'BALANCED', repeat: false,
    }, new SeededRng('build-fidelity-run'), clockAt(startMs));
    const base = structuredClone(run.partySnapshot);
    const variant = (
      apply: (member: ExpeditionPartyMemberSnapshot) => void,
    ): ReturnType<typeof evaluateExpeditionPartyBuild> => {
      const party = structuredClone(base);
      const member = party[0]!;
      member.skillIds = [];
      member.traitIds = [];
      member.equipment = [];
      member.equipmentBonuses = {};
      member.lineage = [];
      member.generation = 0;
      member.mutation = 'NONE';
      apply(member);
      return evaluateExpeditionPartyBuild(party, 'region_crystal_cavern');
    };
    const vector = (metrics: ReturnType<typeof evaluateExpeditionPartyBuild>): number[] => [
      metrics.combat, metrics.mining, metrics.exploration, metrics.research,
    ];

    const attackSkill = variant((member) => { member.skillIds = ['skill_magma_cataclysm']; });
    const supportSkill = variant((member) => { member.skillIds = ['skill_crystal_mend']; });
    expect(vector(attackSkill)).not.toEqual(vector(supportSkill));
    expect(attackSkill.combat).toBeGreaterThan(supportSkill.combat);
    expect(supportSkill.exploration).toBeGreaterThan(attackSkill.exploration);

    const denseTrait = variant((member) => { member.traitIds = ['trait_dense_core']; });
    const resonantTrait = variant((member) => { member.traitIds = ['trait_resonant']; });
    expect(vector(denseTrait)).not.toEqual(vector(resonantTrait));
    expect(resonantTrait.research).toBeGreaterThan(denseTrait.research);

    const hunterEquipment = variant((member) => {
      member.equipment = [{
        instanceId: 'hunter-core', definitionId: 'equipment_caldera_core', slot: 'CORE', level: 12, rarity: 'SSR', setId: 'HUNTER',
        affixes: [{ stat: 'power', operation: 'PERCENT', value: 0.2, sourceStat: 'critDamage' }], locked: false,
      }];
    });
    const resonanceEquipment = variant((member) => {
      member.equipment = [{
        instanceId: 'resonance-rune', definitionId: 'equipment_resonance_rune', slot: 'RUNE', level: 12, rarity: 'SSR', setId: 'RESONANCE',
        affixes: [{ stat: 'resonance', operation: 'PERCENT', value: 0.2, sourceStat: 'resistance' }], locked: false,
      }];
    });
    expect(vector(hunterEquipment)).not.toEqual(vector(resonanceEquipment));
    expect(hunterEquipment.combat).toBeGreaterThan(resonanceEquipment.combat);
    expect(resonanceEquipment.research).toBeGreaterThan(hunterEquipment.research);

    const ancestor = (speciesId: string, mutation: LineageRef['mutation'], traitIds: string[]): LineageRef => ({
      instanceId: `ancestor-${speciesId}`, speciesId, serialNumber: `SV-${speciesId}`, nickname: null,
      mutation, colorVariant: 'STANDARD', traitIds,
    });
    const martialLineage = variant((member) => { member.lineage = [ancestor('species_pyroclast', 'CORRUPTED', ['trait_flame_soul'])]; });
    const scholarlyLineage = variant((member) => { member.lineage = [ancestor('species_prismara', 'PRISMATIC', ['trait_resonant'])]; });
    expect(vector(martialLineage)).not.toEqual(vector(scholarlyLineage));
    expect(martialLineage.combat).toBeGreaterThan(scholarlyLineage.combat);
    expect(scholarlyLineage.research).toBeGreaterThan(martialLineage.research);
  });

  it('turns the four build aptitudes into deterministic combat, mining, exploration and research rewards', () => {
    const original = createInitialGameState({ seed: 'build-outcomes', clock: clockAt(startMs) });
    original.facilities.expeditionGuild = 2;
    original.inventory.currencies.researchCores = 1;
    const run = startExpedition(original, {
      regionId: 'region_crystal_cavern', durationId: 'duration_24h', strategy: 'BALANCED', repeat: false,
    }, new SeededRng('build-outcomes-run'), clockAt(startMs));
    const combatState = structuredClone(original);
    const researchState = structuredClone(original);
    for (const member of combatState.expeditions.runs[run.expeditionId]!.partySnapshot) {
      member.skillIds = ['skill_magma_cataclysm'];
      member.traitIds = ['trait_keen_edge'];
    }
    for (const member of researchState.expeditions.runs[run.expeditionId]!.partySnapshot) {
      member.skillIds = ['skill_crystal_mend'];
      member.traitIds = ['trait_resonant'];
    }

    advanceExpeditions(combatState, new Date(startMs + 24 * 60 * 60 * 1_000));
    advanceExpeditions(researchState, new Date(startMs + 24 * 60 * 60 * 1_000));
    const combatRun = combatState.expeditions.runs[run.expeditionId]!;
    const researchRun = researchState.expeditions.runs[run.expeditionId]!;
    const combatReport = combatRun.reportEvents.find((entry) => entry.kind === 'BATTLE' || entry.kind === 'BOSS')!;
    const researchReport = researchRun.reportEvents.find((entry) => entry.kind === 'BATTLE' || entry.kind === 'BOSS')!;

    expect(combatReport.successScore).not.toBe(researchReport.successScore);
    expect(combatRun.reportSummary.miningYield).not.toBe(researchRun.reportSummary.miningYield);
    expect(combatRun.expeditionStorage.credits).not.toBe(researchRun.expeditionStorage.credits);
    expect(combatRun.expeditionStorage.accountXp).not.toBe(researchRun.expeditionStorage.accountXp);
  });

  it('uses the region anomaly bonus for a deterministic discovery mutation roll', () => {
    let witness: { seed: string; mutation: Exclude<ReturnType<typeof rollExpeditionDiscoveryMutation>, 'NONE'> } | null = null;
    for (let index = 0; index < 10_000 && witness === null; index += 1) {
      const seed = `regional-mutation-${index}`;
      const quarry = rollExpeditionDiscoveryMutation(seed, 'region_starter_quarry', 'duration_24h', 'DISCOVERY', 2.5);
      const celestial = rollExpeditionDiscoveryMutation(seed, 'region_celestial_fault', 'duration_24h', 'DISCOVERY', 2.5);
      if (quarry === 'NONE' && celestial !== 'NONE') witness = { seed, mutation: celestial };
    }

    expect(witness).not.toBeNull();
    expect(rollExpeditionDiscoveryMutation(witness!.seed, 'region_celestial_fault', 'duration_24h', 'DISCOVERY', 2.5)).toBe(witness!.mutation);
    expect(rollExpeditionDiscoveryMutation(witness!.seed, 'region_starter_quarry', 'duration_24h', 'DISCOVERY', 2.5)).toBe('NONE');
  });

  it('writes the regional mutation roll into generated discovery descriptors before appraisal', () => {
    let witness: { state: ReturnType<typeof createInitialGameState>; expeditionId: string; discovery: ExpeditionRareDiscovery } | null = null;
    for (let candidate = 0; candidate < 200 && witness === null; candidate += 1) {
      const state = createInitialGameState({ seed: `regional-descriptor-${candidate}`, clock: clockAt(startMs) });
      state.facilities.expeditionGuild = 7;
      const run = startExpedition(state, {
        regionId: 'region_celestial_fault', durationId: 'duration_24h', strategy: 'DISCOVERY', repeat: false,
      }, new SeededRng(`regional-descriptor-run-${candidate}`), clockAt(startMs));
      for (const member of run.partySnapshot) {
        member.stats.purity = 10_000;
        member.stats.resonance = 10_000;
        member.stats.speed = 10_000;
      }
      advanceExpeditions(state, new Date(startMs + 24 * 60 * 60 * 1_000));
      const discovery = run.expeditionStorage.rareDiscoveries.find((entry) => {
        const mutation = parseExpeditionDiscoveryMutation(entry.seed);
        return mutation !== null && mutation !== 'NONE';
      });
      if (discovery) witness = { state, expeditionId: run.expeditionId, discovery };
    }

    expect(witness).not.toBeNull();
    const mutation = parseExpeditionDiscoveryMutation(witness!.discovery.seed)!;
    const baseSeed = witness!.discovery.seed.slice(0, witness!.discovery.seed.lastIndexOf(':expedition-mutation:'));
    expect(mutation).toBe(rollExpeditionDiscoveryMutation(baseSeed, 'region_celestial_fault', 'duration_24h', 'DISCOVERY', 2.5));
    expect(witness!.state.expeditions.runs[witness!.expeditionId]!.expeditionStorage.items.material_mutation_trace).toBeGreaterThanOrEqual(1);
    const claimed = claimExpedition(witness!.state, witness!.expeditionId, clockAt(startMs + 24 * 60 * 60 * 1_000));
    expect(claimed.discoveredStones[0]?.mutation).toBe(mutation);
  });

  it('persists the exact discovery mutation across direct, stored and reloaded appraisal paths', () => {
    const state = createInitialGameState({ seed: 'mutation-descriptor', clock: clockAt(startMs) });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'DISCOVERY', repeat: false,
    }, new SeededRng('mutation-descriptor-run'), clockAt(startMs));
    run.completedCycles = 1;
    run.status = 'READY';
    const discovery: ExpeditionRareDiscovery = {
      discoveryId: `${run.expeditionId}:mutation`,
      seed: 'fixed-discovery:expedition-mutation:ANCIENT',
      speciesId: 'species_quartzling',
      veinId: 'region_starter_quarry:rare',
      areaId: 'region_starter_quarry',
      hintedRarity: 'RARE',
      sourceEventId: `${run.expeditionId}:cycle:1`,
      discoveredAt: new Date(startMs + 15 * 60 * 1_000).toISOString(),
    };
    run.expeditionStorage.rareDiscoveries = [discovery];
    expect(parseExpeditionDiscoveryMutation(discovery.seed)).toBe('ANCIENT');

    const direct = structuredClone(state);
    const directStone = claimExpedition(direct, run.expeditionId, clockAt(startMs + 15 * 60 * 1_000)).discoveredStones[0]!;
    expect(directStone.mutation).toBe('ANCIENT');

    const stored = structuredClone(state);
    stored.inventory.capacity = Object.keys(stored.stones).length;
    claimExpedition(stored, run.expeditionId, clockAt(startMs + 15 * 60 * 1_000));
    const reloaded = JSON.parse(JSON.stringify(stored)) as typeof stored;
    reloaded.inventory.capacity += 1;
    const storedStone = claimStoredExpeditionDiscovery(reloaded, discovery.discoveryId, clockAt(startMs + 15 * 60 * 1_000));
    expect(storedStone).toEqual(directStone);
  });

  it('produces identical snapshots and rewards when cycles are advanced offline or around JSON reloads', () => {
    const offline = createInitialGameState({ seed: 'offline-build-determinism', clock: clockAt(startMs) });
    offline.facilities.expeditionGuild = 7;
    const run = startExpedition(offline, {
      regionId: 'region_celestial_fault', durationId: 'duration_15m', strategy: 'DISCOVERY', repeat: true,
    }, new SeededRng('offline-build-determinism-run'), clockAt(startMs));
    let foreground = JSON.parse(JSON.stringify(offline)) as typeof offline;

    advanceExpeditions(offline, new Date(startMs + 8 * 15 * 60 * 1_000));
    for (let cycle = 1; cycle <= 8; cycle += 1) {
      advanceExpeditions(foreground, new Date(startMs + cycle * 15 * 60 * 1_000));
      foreground = JSON.parse(JSON.stringify(foreground)) as typeof foreground;
    }

    const offlineRun = offline.expeditions.runs[run.expeditionId]!;
    const foregroundRun = foreground.expeditions.runs[run.expeditionId]!;
    expect(foregroundRun.partySnapshot).toEqual(offlineRun.partySnapshot);
    expect(foregroundRun.expeditionStorage).toEqual(offlineRun.expeditionStorage);
    expect(foregroundRun.reportSummary).toEqual(offlineRun.reportSummary);
    expect(foregroundRun.reportEvents).toEqual(offlineRun.reportEvents);
  });

  it('claims a non-repeating completion once even across 100 replay attempts', () => {
    const state = createInitialGameState({ seed: 'claim-once', clock: clockAt(startMs) });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: false,
    }, new SeededRng('claim-once-run'), clockAt(startMs));
    advanceExpeditions(state, new Date(startMs + 15 * 60 * 1_000));
    const creditsBefore = state.inventory.currencies.credits;
    const claim = claimExpedition(state, run.expeditionId, clockAt(startMs + 15 * 60 * 1_000));
    expect(claim.cyclesClaimed).toBe(1);
    expect(state.inventory.currencies.credits).toBe(creditsBefore + claim.reward.credits);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      expect(() => claimExpedition(state, run.expeditionId, clockAt(startMs + 15 * 60 * 1_000 + attempt))).toThrow(/unclaimed/i);
    }
    expect(state.inventory.currencies.credits).toBe(creditsBefore + claim.reward.credits);
    expect(state.expeditions.totalClaims).toBe(1);
  });

  it('aggregates a 30-day endless repeat in bounded chunks and retains a compact report', () => {
    const state = createInitialGameState({ seed: 'endless', clock: clockAt(startMs) });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'HIGH_RISK', repeat: true,
    }, new SeededRng('endless-run'), clockAt(startMs));
    const started = performance.now();
    const result = advanceExpeditions(state, new Date(startMs + 30 * 24 * 60 * 60 * 1_000));
    const wallMs = Math.round((performance.now() - started) * 1_000) / 1_000;
    expect(result.cyclesProcessed).toBe(MAX_EXPEDITION_CYCLES_PER_ADVANCE);
    expect(run.completedCycles).toBe(MAX_EXPEDITION_CYCLES_PER_ADVANCE);
    expect(run.status).toBe('ACTIVE');
    expect(run.reportEvents.length).toBeLessThanOrEqual(MAX_EXPEDITION_REPORT_EVENTS);
    expect(run.expeditionStorage.credits).toBeGreaterThan(0);
    for (const value of [run.expeditionStorage.credits, run.expeditionStorage.upgradeDust, run.reportSummary.miningYield]) {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    }
    const next = advanceExpeditions(state, new Date(startMs + 365 * 24 * 60 * 60 * 1_000));
    expect(next.cyclesProcessed).toBe(MAX_EXPEDITION_CYCLES_PER_ADVANCE);
    expect(next.capped).toBe(true);
    console.info(`[expedition-repeat-30d] ${JSON.stringify({ cycles: result.cyclesProcessed, reportEvents: run.reportEvents.length, wallMs })}`);
  });

  it('finishes a stopped repeat after its in-flight cycle without losing banked rewards', () => {
    const state = createInitialGameState({ seed: 'repeat-stop', clock: clockAt(startMs) });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'BALANCED', repeat: true,
    }, new SeededRng('repeat-stop-run'), clockAt(startMs));
    advanceExpeditions(state, new Date(startMs + 15 * 60 * 1_000));
    const firstBankedCredits = run.expeditionStorage.credits;

    const stopped = stopExpedition(state, run.expeditionId);
    expect(stopped).toBe(run);
    expect(run).toMatchObject({ repeat: false, status: 'ACTIVE', completedCycles: 1 });
    expect(run.nextCompletionAt).toBe(new Date(startMs + 30 * 60 * 1_000).toISOString());
    expect(run.expeditionStorage.credits).toBe(firstBankedCredits);

    const firstClaim = claimExpedition(state, run.expeditionId, clockAt(startMs + 20 * 60 * 1_000));
    expect(firstClaim.cyclesClaimed).toBe(1);
    expect(run.status).toBe('ACTIVE');
    expect(run.expeditionStorage.credits).toBe(0);

    expect(advanceExpeditions(state, new Date(startMs + 30 * 60 * 1_000)).cyclesProcessed).toBe(1);
    expect(run).toMatchObject({ repeat: false, status: 'READY', completedCycles: 2, claimedCycles: 1 });
    const finalClaim = claimExpedition(state, run.expeditionId, clockAt(startMs + 30 * 60 * 1_000));
    expect(finalClaim.cyclesClaimed).toBe(1);
    expect(run.status).toBe('CLAIMED');
    expect(firstClaim.reward.credits + finalClaim.reward.credits).toBeGreaterThan(firstBankedCredits);
  });

  it('stores rare discoveries when Stone capacity is full and claims them later', () => {
    const state = createInitialGameState({ seed: 'overflow', clock: clockAt(startMs) });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'DISCOVERY', repeat: false,
    }, new SeededRng('overflow-run'), clockAt(startMs));
    run.completedCycles = 1;
    run.status = 'READY';
    const discovery: ExpeditionRareDiscovery = {
      discoveryId: `${run.expeditionId}:forced-discovery`, seed: 'forced-discovery-seed', speciesId: 'species_prismara',
      veinId: 'region_starter_quarry:rare', areaId: 'region_starter_quarry', hintedRarity: 'SSR',
      sourceEventId: `${run.expeditionId}:cycle:1`, discoveredAt: new Date(startMs + 15 * 60 * 1_000).toISOString(),
    };
    run.expeditionStorage.rareDiscoveries.push(discovery);
    state.inventory.capacity = Object.keys(state.stones).length;
    const claim = claimExpedition(state, run.expeditionId, clockAt(startMs + 15 * 60 * 1_000));
    expect(claim.discoveredStones).toHaveLength(0);
    expect(claim.storedDiscoveries.map((entry) => entry.discoveryId)).toContain(discovery.discoveryId);
    expect(state.expeditions.discoveryStorage).toHaveLength(1);
    state.inventory.capacity += 1;
    const stone = claimStoredExpeditionDiscovery(state, discovery.discoveryId);
    expect(stone.origin).toBe('EXPEDITION');
    expect(state.statistics.rareDiscoveryCount).toBe(1);
    expect(state.expeditions.discoveryStorage).toHaveLength(0);
  });

  it('keeps every reward unclaimed when temporary discovery storage is full', () => {
    const state = createInitialGameState({ seed: 'full-discovery-box', clock: clockAt(startMs) });
    const run = startExpedition(state, {
      regionId: 'region_starter_quarry', durationId: 'duration_15m', strategy: 'DISCOVERY', repeat: false,
    }, new SeededRng('full-discovery-box-run'), clockAt(startMs));
    const discovery = (index: number): ExpeditionRareDiscovery => ({
      discoveryId: `${run.expeditionId}:stored:${index}`, seed: `stored-${index}`, speciesId: 'species_quartzling',
      veinId: 'region_starter_quarry:rare', areaId: 'region_starter_quarry', hintedRarity: 'RARE',
      sourceEventId: `${run.expeditionId}:cycle:${index}`, discoveredAt: new Date(startMs).toISOString(),
    });
    state.inventory.capacity = Object.keys(state.stones).length;
    state.expeditions.discoveryStorage = Array.from({ length: MAX_EXPEDITION_DISCOVERY_STORAGE }, (_, index) => discovery(index));
    run.completedCycles = 1;
    run.status = 'READY';
    run.expeditionStorage.credits = 777;
    run.expeditionStorage.rareDiscoveries = [discovery(10_001)];
    const creditsBefore = state.inventory.currencies.credits;

    expect(() => claimExpedition(state, run.expeditionId, clockAt(startMs + 15 * 60 * 1_000))).toThrow(/Storage is full/);
    expect(state.inventory.currencies.credits).toBe(creditsBefore);
    expect(run.claimedCycles).toBe(0);
    expect(run.expeditionStorage.credits).toBe(777);
    expect(run.expeditionStorage.rareDiscoveries).toHaveLength(1);
  });

  it('stops at the exact cycle before pending Rare Discovery storage would overflow', () => {
    const template = createInitialGameState({ seed: 'pending-rare-cap', clock: clockAt(startMs) });
    template.facilities.expeditionGuild = 7;
    let blockedRun: ReturnType<typeof startExpedition> | undefined;
    let blockedState: typeof template | undefined;
    for (let candidate = 0; candidate < 2_000 && !blockedRun; candidate += 1) {
      const state = structuredClone(template);
      const run = startExpedition(state, {
        regionId: 'region_celestial_fault', durationId: 'duration_15m', strategy: 'DISCOVERY', repeat: true,
      }, new SeededRng(`pending-cap-${candidate}`), clockAt(startMs));
      const sample: ExpeditionRareDiscovery = {
        discoveryId: `${run.expeditionId}:preexisting`, seed: 'preexisting', speciesId: 'species_quartzling',
        veinId: 'region_celestial_fault:rare', areaId: 'region_celestial_fault', hintedRarity: 'RARE',
        sourceEventId: `${run.expeditionId}:preexisting`, discoveredAt: new Date(startMs).toISOString(),
      };
      run.expeditionStorage.rareDiscoveries = Array.from({ length: MAX_PENDING_RARE_DISCOVERIES }, (_, index) => ({ ...sample, discoveryId: `${sample.discoveryId}:${index}` }));
      const result = advanceExpeditions(state, new Date(startMs + 15 * 60 * 1_000));
      if (result.cyclesProcessed === 0) { blockedRun = run; blockedState = state; }
    }

    expect(blockedRun).toBeDefined();
    expect(blockedState).toBeDefined();
    expect(blockedRun!.completedCycles).toBe(0);
    expect(blockedRun!.nextCompletionAt).toBe(new Date(startMs + 15 * 60 * 1_000).toISOString());
    expect(blockedRun!.expeditionStorage.rareDiscoveries).toHaveLength(MAX_PENDING_RARE_DISCOVERIES);
    expect(blockedState!.expeditions.overflowDiscarded).toBe(0);
  });
});
