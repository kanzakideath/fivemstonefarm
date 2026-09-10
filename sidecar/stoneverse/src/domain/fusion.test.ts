import { describe, expect, it } from 'vitest';
import { FUSION_RECIPES } from '../data';
import { findFusionRecipes, fuseStones, recipeMatches } from './fusion';
import { SeededRng } from './rng';
import { createInitialGameState } from './state';
import { createSeedStone } from './stone';
import type { Clock } from './types';

const clock: Clock = { now: () => new Date('2026-09-10T03:00:00.000Z') };

describe('fusion genetics', () => {
  it('inherits locked genes, preserves parents by default and writes a family tree', () => {
    const state = createInitialGameState({ seed: 'fusion', clock });
    state.facilities.fusionLab = 4;
    const parents = Object.values(state.stones).slice(0, 2);
    const parentIds = parents.map((stone) => stone.instanceId);
    const lockedTrait = parents[0]!.traitIds[0]!;
    const expectedPower = Math.max(...parents.map((stone) => stone.individualValues.power));
    const result = fuseStones(state, parentIds, { lockedTraitIds: [lockedTrait], lockedIvStats: ['power'] }, new SeededRng('child'), clock);
    expect(result.child.parents.map((entry) => entry.instanceId)).toEqual(parentIds);
    expect(result.child.generation).toBe(1);
    expect(result.child.traitIds).toContain(lockedTrait);
    expect(result.child.individualValues.power).toBe(expectedPower);
    expect(parentIds.every((id) => Boolean(state.stones[id]))).toBe(true);
    expect(state.fusionHistory[0]!.childId).toBe(result.child.instanceId);
  });

  it('protects a favorite parent from destructive fusion', () => {
    const state = createInitialGameState({ seed: 'protected', clock });
    const parents = Object.values(state.stones).slice(0, 2);
    parents[0]!.favorite = true;
    expect(() => fuseStones(state, parents.map((stone) => stone.instanceId), { consumeParents: true }, new SeededRng('nope'), clock)).toThrow(/favorite/i);
  });

  it('rejects parent-preserving fusion at capacity but permits consuming fusion atomically', () => {
    const state = createInitialGameState({ seed: 'fusion-capacity', clock });
    const parents = Object.values(state.stones).slice(0, 2);
    const parentIds = parents.map((stone) => stone.instanceId);
    parents[0]!.affinity.points = 100;
    parents[1]!.affinity.points = 200;
    parents[0]!.equipment.CORE = {
      instanceId: 'returned-parent-core', definitionId: 'RESONANCE_CORE', slot: 'CORE', level: 7, rarity: 'SSR', setId: 'RESONANCE', locked: true,
      affixes: [{ stat: 'power', operation: 'PERCENT', value: 0.073 }],
    };
    state.profile.totalAffinity = Object.values(state.stones).reduce((sum, stone) => sum + stone.affinity.points, 0);
    const removedAffinity = parents.reduce((sum, stone) => sum + stone.affinity.points, 0);
    state.inventory.capacity = Object.keys(state.stones).length;
    const before = JSON.stringify(state);

    expect(() => fuseStones(state, parentIds, {}, new SeededRng('preserve-full'), clock)).toThrow(/capacity/i);
    expect(JSON.stringify(state)).toBe(before);

    const result = fuseStones(state, parentIds, { consumeParents: true }, new SeededRng('consume-full'), clock);
    expect(Object.keys(state.stones)).toHaveLength(2);
    expect(state.stones[result.child.instanceId]).toBe(result.child);
    expect(parentIds.every((id) => state.stones[id] === undefined)).toBe(true);
    expect(state.endlessMine.equipment.items.find((item) => item.id === 'returned-parent-core')).toMatchObject({ setId: 'RESONANCE', rarity: 'EPIC', locked: true });
    expect(state.profile.totalAffinity).toBe(Object.values(state.stones).reduce((sum, stone) => sum + stone.affinity.points, 0));
    expect(state.profile.totalAffinity).toBeGreaterThanOrEqual(0);
    expect(removedAffinity).toBe(300);
  });

  it('matches fixed recipes independent of parent order', () => {
    const state = createInitialGameState({ seed: 'recipe', clock });
    state.facilities.fusionLab = 3;
    const ember = Object.values(state.stones).find((stone) => stone.speciesId === 'species_emberite')!;
    const quartz = Object.values(state.stones).find((stone) => stone.speciesId === 'species_quartzling')!;
    expect(findFusionRecipes([quartz, ember], 3).some((recipe) => recipe.id === 'fusion_ember_quartz')).toBe(true);
  });

  it('requires the Eclipse Key to match, find, and execute the hidden eclipse recipe', () => {
    const prepareState = (seed: string) => {
      const state = createInitialGameState({ seed, clock });
      state.facilities.fusionLab = 5;
      state.inventory.currencies.credits = 20_000;
      state.inventory.currencies.upgradeDust = 2_000;
      state.inventory.items.item_eclipse_shard = 1;
      const solaris = createSeedStone(
        'species_solaris',
        { accountId: state.account.accountId, username: state.account.username },
        `${seed}:solaris`,
        clock,
      );
      state.stones[solaris.instanceId] = solaris;
      const quartz = Object.values(state.stones).find((stone) => stone.speciesId === 'species_quartzling')!;
      return { state, parents: [quartz, solaris] as const };
    };

    const eclipseRecipe = FUSION_RECIPES.find((recipe) => recipe.id === 'fusion_eclipse')!;
    const withoutKey = prepareState('eclipse-locked');
    expect(recipeMatches(eclipseRecipe, withoutKey.parents)).toBe(false);
    expect(recipeMatches(eclipseRecipe, withoutKey.parents, ['catalyst_ember'])).toBe(false);
    expect(recipeMatches(eclipseRecipe, withoutKey.parents, ['not-a-catalyst'])).toBe(false);
    expect(findFusionRecipes(withoutKey.parents, 5).some((recipe) => recipe.id === 'fusion_eclipse')).toBe(false);
    const lockedResult = fuseStones(
      withoutKey.state,
      withoutKey.parents.map((stone) => stone.instanceId),
      {},
      new SeededRng('eclipse-locked-result'),
      clock,
    );
    expect(lockedResult.recipe?.id).not.toBe('fusion_eclipse');
    expect(lockedResult.child.speciesId).not.toBe('species_eclipse_geode');

    const withKey = prepareState('eclipse-unlocked');
    withKey.state.inventory.items.catalyst_eclipse = 1;
    expect(recipeMatches(eclipseRecipe, withKey.parents, ['catalyst_eclipse'])).toBe(true);
    expect(findFusionRecipes(withKey.parents, 5, ['catalyst_eclipse']).some((recipe) => recipe.id === 'fusion_eclipse')).toBe(true);
    const unlockedResult = fuseStones(
      withKey.state,
      withKey.parents.map((stone) => stone.instanceId),
      { catalystIds: ['catalyst_eclipse'] },
      new SeededRng('eclipse-unlocked-result'),
      clock,
    );
    expect(unlockedResult.recipe?.id).toBe('fusion_eclipse');
    expect(unlockedResult.child.speciesId).toBe('species_eclipse_geode');
  });

  it('allows a hidden recipe with no unlock catalyst to match, find, and execute', () => {
    const state = createInitialGameState({ seed: 'ancient-convergence', clock });
    state.facilities.fusionLab = 8;
    state.inventory.currencies.credits = 60_000;
    state.inventory.currencies.researchCores = 25;
    state.inventory.currencies.upgradeDust = 3_000;
    state.inventory.items.item_primordial_core = 1;
    const owner = { accountId: state.account.accountId, username: state.account.username };
    const ironwarden = createSeedStone('species_ironwarden', owner, 'ancient-convergence:ironwarden', clock);
    const solaris = createSeedStone('species_solaris', owner, 'ancient-convergence:solaris', clock);
    state.stones[ironwarden.instanceId] = ironwarden;
    state.stones[solaris.instanceId] = solaris;
    const ember = Object.values(state.stones).find((stone) => stone.speciesId === 'species_emberite')!;
    const quartz = Object.values(state.stones).find((stone) => stone.speciesId === 'species_quartzling')!;
    const parents = [solaris, quartz, ironwarden, ember] as const;
    const recipe = FUSION_RECIPES.find((entry) => entry.id === 'fusion_ancient_convergence')!;

    expect(recipeMatches(recipe, parents)).toBe(true);
    expect(findFusionRecipes(parents, 8).some((entry) => entry.id === recipe.id)).toBe(true);
    const result = fuseStones(
      state,
      parents.map((stone) => stone.instanceId),
      {},
      new SeededRng('ancient-convergence-result'),
      clock,
    );
    expect(result.recipe?.id).toBe('fusion_ancient_convergence');
    expect(result.child.speciesId).toBe('species_worldheart');
  });
});
