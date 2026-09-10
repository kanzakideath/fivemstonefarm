import { CATALYST_BY_ID, FUSION_CATALYSTS, FUSION_RECIPES, SPECIES_BY_ID, TRAIT_BY_ID } from '../data';
import type {
  Clock,
  FusionCatalystDefinition,
  FusionOptions,
  FusionRecipeDefinition,
  FusionResult,
  GameState,
  IndividualValues,
  Mutation,
  StatKey,
  StoneInstance,
  StoneSpeciesDefinition,
} from './types';
import type { RandomSource } from './rng';
import { makeId, systemClock } from './rng';
import { spendCost } from './economy';
import { calculateStoneStats, generateStone, lineRef, STAT_KEYS } from './stone';
import { addEquipment, equippedItemToAdvancedEquipment } from './advanced/equipment';
import { evaluateAchievements, gainAccountXp } from './economy';
import { registerStoneInCollection } from './mining';

const multisetContains = (actual: readonly string[], required: readonly string[]): boolean => {
  const counts = new Map<string, number>();
  for (const value of actual) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of required) {
    const count = counts.get(value) ?? 0;
    if (count <= 0) return false;
    counts.set(value, count - 1);
  }
  return true;
};

export const recipeMatches = (
  recipe: FusionRecipeDefinition,
  parents: readonly StoneInstance[],
  catalystIds: readonly string[] = [],
): boolean => {
  if (parents.length !== recipe.parentCount) return false;
  if (recipe.type === 'FIXED' || (recipe.requiredSpecies?.length ?? 0) > 0) {
    if (!multisetContains(parents.map((stone) => stone.speciesId), recipe.requiredSpecies ?? [])) return false;
  }
  if (recipe.requiredFamilies?.length) {
    const families = parents.map((stone) => SPECIES_BY_ID[stone.speciesId]?.family ?? 'unknown');
    if (!multisetContains(families, recipe.requiredFamilies)) return false;
  }
  if (recipe.requiredElements?.length) {
    const elements = parents.flatMap((stone) => [stone.primaryElement, ...(stone.secondaryElement ? [stone.secondaryElement] : [])]);
    if (!multisetContains(elements, recipe.requiredElements)) return false;
  }
  if (recipe.hidden) {
    const hasUnlockCatalyst = FUSION_CATALYSTS.some((catalyst) => catalyst.unlockRecipeId === recipe.id);
    if (hasUnlockCatalyst) return catalystIds.some((id) => CATALYST_BY_ID[id]?.unlockRecipeId === recipe.id);
  }
  return true;
};

export const findFusionRecipes = (
  parents: readonly StoneInstance[],
  laboratoryLevel: number,
  catalystIds: readonly string[] = [],
): FusionRecipeDefinition[] => FUSION_RECIPES
  .filter((recipe) => recipe.minimumLabLevel <= laboratoryLevel && recipeMatches(recipe, parents, catalystIds))
  .sort((a, b) => {
    const priority = { SPECIAL: 5, HIDDEN: 4, FIXED: 3, ELEMENT: 2, FAMILY: 1 };
    return priority[b.type] - priority[a.type];
  });

const validateCatalysts = (state: GameState, catalystIds: readonly string[]): FusionCatalystDefinition[] => catalystIds.map((id) => {
  const catalyst = CATALYST_BY_ID[id];
  if (!catalyst) throw new Error(`Unknown catalyst: ${id}`);
  if (state.facilities.fusionLab < catalyst.requiredLabLevel) throw new Error(`Fusion lab level ${catalyst.requiredLabLevel} required`);
  if ((state.inventory.items[id] ?? 0) < 1) throw new Error(`Missing catalyst: ${id}`);
  return catalyst;
});

const selectResultSpecies = (
  parents: readonly StoneInstance[],
  recipe: FusionRecipeDefinition | null,
  catalysts: readonly FusionCatalystDefinition[],
  rng: RandomSource,
): StoneSpeciesDefinition => {
  const resultIds = recipe?.resultSpeciesIds ?? [...new Set(parents.map((stone) => stone.speciesId))];
  const candidates = resultIds.map((id) => SPECIES_BY_ID[id]).filter((value): value is StoneSpeciesDefinition => Boolean(value));
  if (candidates.length === 0) throw new Error('Fusion has no valid result species');
  const elementBias = catalysts.find((entry) => entry.elementBias)?.elementBias;
  return rng.weighted(candidates, (species) => {
    const base = Math.max(0.01, recipe?.weight ?? species.gachaWeight ?? 1);
    return elementBias && (species.primaryElement === elementBias || species.possibleSecondaryElements.includes(elementBias)) ? base * 4 : base;
  });
};

const inheritIvs = (
  parents: readonly StoneInstance[],
  lockedStats: readonly StatKey[],
  rng: RandomSource,
): IndividualValues => Object.fromEntries(STAT_KEYS.map((key) => {
  const values = parents.map((parent) => parent.individualValues[key]);
  if (lockedStats.includes(key)) return [key, Math.max(...values)];
  const selected = rng.chance(0.72) ? rng.pick(values) : rng.int(0, 31);
  const regression = rng.chance(0.08) ? -rng.int(1, 3) : 0;
  const improvement = rng.chance(0.1) ? rng.int(1, 2) : 0;
  return [key, Math.max(0, Math.min(31, selected + regression + improvement))];
})) as unknown as IndividualValues;

const inheritTraits = (
  parents: readonly StoneInstance[],
  resultSpecies: StoneSpeciesDefinition,
  lockedTraitIds: readonly string[],
  rng: RandomSource,
  maxTraits: number,
): { traits: string[]; grandparentInherited: boolean } => {
  const direct = [...new Set(parents.flatMap((parent) => parent.traitIds))];
  const grandparentCandidates = [...new Set(parents.flatMap((parent) => parent.parents)
    .flatMap((ancestor) => [
      ...(ancestor.traitIds ?? []),
      ...(ancestor.mutation === 'ANCIENT' ? ['trait_ancient_oath'] : []),
      ...(ancestor.mutation === 'PRISMATIC' ? ['trait_prism_reflex'] : []),
    ]))];
  const inherited = [...new Set(lockedTraitIds.filter((id) => direct.includes(id)))];
  for (const traitId of rng.shuffle(direct)) {
    if (inherited.length >= maxTraits) break;
    if (!inherited.includes(traitId) && rng.chance(0.52)) inherited.push(traitId);
  }
  let grandparentInherited = false;
  if (inherited.length < maxTraits && grandparentCandidates.length > 0 && rng.chance(0.09)) {
    const atavistic = rng.pick(grandparentCandidates);
    if (!inherited.includes(atavistic)) {
      inherited.push(atavistic);
      grandparentInherited = true;
    }
  }
  if (inherited.length < maxTraits && rng.chance(0.22)) {
    const pool = resultSpecies.traitPool.filter((traitId) => !inherited.includes(traitId));
    if (pool.length > 0) inherited.push(rng.pick(pool));
  }
  if (inherited.length < maxTraits && !inherited.includes('trait_gene_weaver') && rng.chance(0.05)) inherited.push('trait_gene_weaver');
  return { traits: inherited.filter((id) => Boolean(TRAIT_BY_ID[id])).slice(0, maxTraits), grandparentInherited };
};

const inheritSkills = (parents: readonly StoneInstance[], resultSpecies: StoneSpeciesDefinition, rng: RandomSource): string[] => {
  const legal = new Set([...resultSpecies.skillPool.map((entry) => entry.skillId), ...parents.flatMap((parent) => parent.skills.map((skill) => skill.skillId))]);
  const inherited = rng.shuffle(parents.flatMap((parent) => parent.skills.map((skill) => skill.skillId)))
    .filter((id, index, all) => all.indexOf(id) === index && legal.has(id) && rng.chance(0.38))
    .slice(0, 3);
  const base = resultSpecies.skillPool[0]?.skillId;
  if (base && !inherited.includes(base)) inherited.unshift(base);
  return inherited.slice(0, 6);
};

export const rollFusionMutation = (
  parents: readonly StoneInstance[],
  catalysts: readonly FusionCatalystDefinition[],
  rng: RandomSource,
): Mutation => {
  const multiplier = catalysts.reduce((value, catalyst) => value * (catalyst.mutationMultiplier ?? 1), 1);
  const lineageBonus = parents.some((parent) => parent.mutation !== 'NONE') ? 1.7 : 1;
  if (!rng.chance(Math.min(0.25, 0.012 * multiplier * lineageBonus))) return 'NONE';
  return rng.weighted<Mutation>(['PRISMATIC', 'ANCIENT', 'CORRUPTED', 'PERFECT'], (mutation) => ({
    NONE: 0, PRISMATIC: 55, ANCIENT: 27, CORRUPTED: 15, PERFECT: 3,
  })[mutation]);
};

export const fuseStones = (
  state: GameState,
  parentIds: readonly string[],
  options: FusionOptions,
  rng: RandomSource,
  clock: Clock = systemClock,
): FusionResult => {
  if (parentIds.length < 2 || parentIds.length > 4 || new Set(parentIds).size !== parentIds.length) throw new Error('Fusion requires 2-4 distinct parents');
  const parents = parentIds.map((id) => state.stones[id]).filter((stone): stone is StoneInstance => Boolean(stone));
  if (parents.length !== parentIds.length) throw new Error('One or more parent stones do not exist');
  const consumeParents = options.consumeParents ?? false;
  if (consumeParents && parents.some((stone) => stone.locked || stone.favorite)) throw new Error('Locked or favorite stones cannot be consumed');
  const returnedEquipment = consumeParents
    ? parents.flatMap((stone) => Object.values(stone.equipment).filter((item): item is NonNullable<typeof item> => Boolean(item)))
    : [];
  const returnedEquipmentIds = new Set<string>();
  for (const equipment of returnedEquipment) {
    if (returnedEquipmentIds.has(equipment.instanceId)
      || state.inventory.equipment[equipment.instanceId]
      || state.endlessMine.equipment.items.some((item) => item.id === equipment.instanceId)) {
      throw new Error('Parent equipment cannot be returned safely because its inventory ID already exists');
    }
    returnedEquipmentIds.add(equipment.instanceId);
  }
  if (state.endlessMine.equipment.items.length + returnedEquipment.length > state.endlessMine.equipment.capacity) {
    throw new Error('Make room in Equipment Storage before consuming an equipped parent');
  }
  const projectedStoneCount = Object.keys(state.stones).length + 1 - (consumeParents ? parents.length : 0);
  if (projectedStoneCount > state.inventory.capacity) throw new Error('Stone capacity is full');
  const catalystIds = [...new Set(options.catalystIds ?? [])];
  const catalysts = validateCatalysts(state, catalystIds);
  const matches = findFusionRecipes(parents, state.facilities.fusionLab, catalystIds);
  const recipe = matches[0] ?? null;
  if (parents.length > 2 && !recipe) throw new Error('A valid recipe is required for multi-stone fusion');
  const resultSpecies = selectResultSpecies(parents, recipe, catalysts, rng);
  const catalystLocks = catalysts.reduce((sum, item) => sum + (item.traitLockSlots ?? 0), 0);
  const maxTraitLocks = Math.min(Math.max(0, state.facilities.fusionLab >= 3 ? 1 + catalystLocks : catalystLocks), 3);
  const lockedTraitIds = [...new Set(options.lockedTraitIds ?? [])];
  if (lockedTraitIds.length > maxTraitLocks) throw new Error('Too many locked traits for the current laboratory');
  const availableTraits = new Set(parents.flatMap((stone) => stone.traitIds));
  if (lockedTraitIds.some((id) => !availableTraits.has(id))) throw new Error('A locked trait is not present on a parent');
  const catalystIvStats = catalysts.flatMap((entry) => entry.ivLockStats ?? []);
  const maxIvLocks = state.facilities.fusionLab >= 4 ? 2 : 0;
  const lockedIvStats = [...new Set([...(options.lockedIvStats ?? []), ...catalystIvStats])].slice(0, maxIvLocks);
  if ((options.lockedIvStats?.length ?? 0) > maxIvLocks) throw new Error('IV locking is not unlocked');

  // Commit costs only after every user-controlled option has validated. Store transactions
  // already roll back, but this keeps the domain function safe for direct server use too.
  if (recipe) spendCost(state, recipe.cost);
  else spendCost(state, { currencies: { credits: 750, upgradeDust: 60 } });
  for (const id of catalystIds) state.inventory.items[id] = Math.max(0, (state.inventory.items[id] ?? 0) - 1);

  const ivs = inheritIvs(parents, lockedIvStats, rng);
  const traitResult = inheritTraits(parents, resultSpecies, lockedTraitIds, rng, Math.min(4, 1 + Math.floor(state.facilities.fusionLab / 2)));
  const skills = inheritSkills(parents, resultSpecies, rng);
  const mutation = rollFusionMutation(parents, catalysts, rng);
  const owner = { accountId: state.account.accountId, username: state.account.username };
  const child = generateStone({
    species: resultSpecies,
    origin: 'FUSION',
    owner,
    rng,
    clock,
    mutation,
    forcedIvs: ivs,
    forcedTraits: traitResult.traits,
    forcedSkills: skills,
    personalityId: rng.chance(0.78) ? rng.pick(parents).personalityId : undefined,
    parents: parents.map(lineRef),
    grandparents: parents.flatMap((parent) => parent.parents).slice(0, 8),
    generation: Math.max(...parents.map((parent) => parent.generation)) + 1,
  });
  const shinyMultiplier = catalysts.reduce((value, catalyst) => value * (catalyst.shinyMultiplier ?? 1), 1);
  if (child.colorVariant === 'STANDARD' && rng.chance(Math.min(0.15, 0.012 * shinyMultiplier))) child.colorVariant = 'SHINY';
  child.stats = calculateStoneStats(child);
  if (state.stones[child.instanceId]) throw new Error('Stone ID collision');
  state.stones[child.instanceId] = child;
  if (consumeParents) {
    const removed = new Set(parents.map((parent) => parent.instanceId));
    for (const equipment of returnedEquipment) {
      const returned = addEquipment(state.endlessMine.equipment, equippedItemToAdvancedEquipment(equipment), { autoSalvage: false });
      if (!returned.accepted) throw new Error('Parent equipment could not be returned to Equipment Storage');
    }
    for (const parent of parents) delete state.stones[parent.instanceId];
    for (const party of state.parties) party.slots = party.slots.filter((slot) => !removed.has(slot.stoneId));
    state.profile.showcaseStoneIds = state.profile.showcaseStoneIds.filter((id) => !removed.has(id));
    state.profile.favoriteStoneIds = state.profile.favoriteStoneIds.filter((id) => !removed.has(id));
    state.profile.totalAffinity = Object.values(state.stones).reduce((sum, stone) => Math.min(Number.MAX_SAFE_INTEGER, sum + stone.affinity.points), 0);
  }
  const now = clock.now();
  const history = {
    id: makeId('fusion', rng, now.getTime()),
    parentIds: [...parentIds],
    childId: child.instanceId,
    recipeId: recipe?.id ?? null,
    catalystIds,
    inheritedTraits: [...traitResult.traits],
    inheritedSkills: [...skills],
    mutation,
    consumeParents,
    createdAt: now.toISOString(),
  };
  state.fusionHistory.unshift(history);
  state.statistics.fusionCount += 1;
  if (mutation !== 'NONE') state.statistics.mutationCount += 1;
  registerStoneInCollection(state, child);
  gainAccountXp(state, 90 + child.generation * 10);
  evaluateAchievements(state, clock);
  return { child, history, recipe, inheritedTraitIds: traitResult.traits, inheritedSkillIds: skills, grandparentInherited: traitResult.grandparentInherited };
};
