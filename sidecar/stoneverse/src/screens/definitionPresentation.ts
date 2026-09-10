import type {
  FusionCatalystDefinition,
  FusionRecipeDefinition,
  GachaBannerDefinition,
  InventoryCost,
  InventoryReward,
  Rarity,
  StoneSpeciesDefinition,
} from '../domain/types';

export const RARITY_DISPLAY_ORDER: readonly Rarity[] = ['LEGENDARY', 'UR', 'SSR', 'SR', 'RARE', 'NORMAL'];

export const DEFAULT_FUSION_COST: InventoryCost = {
  currencies: { credits: 750, upgradeDust: 60 },
};

export function gachaRateRows(banner: GachaBannerDefinition) {
  return RARITY_DISPLAY_ORDER.map((rarity) => ({
    rarity,
    rate: banner.rates[rarity],
    label: `${formatNumber(banner.rates[rarity] * 100)}%`,
  }));
}

function multisetContains(actual: readonly string[], required: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of actual) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of required) {
    const count = counts.get(value) ?? 0;
    if (count === 0) return false;
    counts.set(value, count - 1);
  }
  return true;
}

export interface FusionParentSummary {
  speciesId: string;
  primaryElement: string;
  secondaryElement?: string;
}

export interface FusionPresentationOptions {
  catalystIds?: readonly string[];
  catalysts?: readonly FusionCatalystDefinition[];
}

export function findPresentationRecipe(
  parents: readonly FusionParentSummary[],
  laboratoryLevel: number,
  recipes: readonly FusionRecipeDefinition[],
  speciesById: Readonly<Record<string, StoneSpeciesDefinition>>,
  options: FusionPresentationOptions = {},
) {
  const catalystById = new Map((options.catalysts ?? []).map((catalyst) => [catalyst.id, catalyst]));
  const priority: Record<FusionRecipeDefinition['type'], number> = { SPECIAL: 5, HIDDEN: 4, FIXED: 3, ELEMENT: 2, FAMILY: 1 };
  return recipes
    .filter((recipe) => {
      if (recipe.minimumLabLevel > laboratoryLevel || parents.length !== recipe.parentCount) return false;
      const unlockCatalysts = [...catalystById.values()].filter((catalyst) => catalyst.unlockRecipeId === recipe.id);
      if (recipe.hidden && unlockCatalysts.length > 0 && !options.catalystIds?.some((id) => catalystById.get(id)?.unlockRecipeId === recipe.id)) return false;
      if ((recipe.requiredSpecies?.length ?? 0) > 0 && !multisetContains(parents.map((parent) => parent.speciesId), recipe.requiredSpecies ?? [])) return false;
      if ((recipe.requiredFamilies?.length ?? 0) > 0 && !multisetContains(parents.map((parent) => speciesById[parent.speciesId]?.family ?? 'unknown'), recipe.requiredFamilies ?? [])) return false;
      const elements = parents.flatMap((parent) => [parent.primaryElement, ...(parent.secondaryElement ? [parent.secondaryElement] : [])]);
      return !recipe.requiredElements?.length || multisetContains(elements, recipe.requiredElements);
    })
    .sort((a, b) => priority[b.type] - priority[a.type])[0] ?? null;
}

export function formatCost(cost: InventoryCost) {
  const parts: string[] = [];
  const currencyLabels: Record<string, string> = {
    credits: 'CREDIT',
    gachaTickets: 'TICKET',
    researchCores: 'CORE',
    upgradeDust: 'DUST',
  };
  for (const [currency, amount] of Object.entries(cost.currencies ?? {})) {
    if (amount) parts.push(`${currencyLabels[currency] ?? currency.toUpperCase()} ${amount.toLocaleString()}`);
  }
  for (const [item, amount] of Object.entries(cost.items ?? {})) {
    if (amount) parts.push(`${item.replace(/^item_/, '').replaceAll('_', ' ').toUpperCase()} ×${amount}`);
  }
  return parts;
}

export function formatReward(reward: InventoryReward) {
  const parts = formatCost(reward);
  if (reward.accountXp) parts.push(`ACCOUNT XP ${reward.accountXp.toLocaleString()}`);
  if (reward.miningXp) parts.push(`MINING XP ${reward.miningXp.toLocaleString()}`);
  if (reward.stoneXp) parts.push(`STONE XP ${reward.stoneXp.toLocaleString()}`);
  return parts;
}

export function formatDrawProgress(reward: InventoryReward) {
  const stoneXp = Math.round((reward.stoneXp ?? 30) * 0.35);
  return `クリア報酬なし。参加した各StoneにSTONE XP ${stoneXp.toLocaleString()}・好感度 +6、ACCOUNT XP 8を付与。`;
}

function formatNumber(value: number) {
  return Number(value.toFixed(3)).toString();
}
