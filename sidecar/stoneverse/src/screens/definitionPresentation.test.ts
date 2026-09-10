import { describe, expect, it } from 'vitest';
import { DUNGEONS, FUSION_CATALYSTS, FUSION_RECIPES, GACHA_BANNERS, SPECIES_BY_ID } from '../data';
import { DEFAULT_FUSION_COST, findPresentationRecipe, formatCost, formatDrawProgress, formatReward, gachaRateRows } from './definitionPresentation';

describe('definition-backed screen presentation', () => {
  it('renders the configured Genesis rarity rates without UI-owned substitutes', () => {
    expect(gachaRateRows(GACHA_BANNERS[0]).map(({ rarity, label }) => [rarity, label])).toEqual([
      ['LEGENDARY', '0.1%'],
      ['UR', '1.1%'],
      ['SSR', '4.8%'],
      ['SR', '16%'],
      ['RARE', '30%'],
      ['NORMAL', '48%'],
    ]);
  });

  it('uses the domain fallback cost and resolves a configured fixed recipe by priority', () => {
    expect(formatCost(DEFAULT_FUSION_COST)).toEqual(['CREDIT 750', 'DUST 60']);
    const recipe = findPresentationRecipe([
      { speciesId: 'species_emberite', primaryElement: 'FIRE' },
      { speciesId: 'species_quartzling', primaryElement: 'CRYSTAL' },
    ], 2, FUSION_RECIPES, SPECIES_BY_ID);
    expect(recipe?.id).toBe('fusion_ember_quartz');
    expect(formatCost(recipe!.cost)).toEqual(['CREDIT 1,500', 'DUST 120']);
  });

  it('exposes the real mutagen gate/multipliers and stage rewards', () => {
    const mutagen = FUSION_CATALYSTS.find((item) => item.id === 'catalyst_mutagen');
    expect(mutagen).toMatchObject({ requiredLabLevel: 6, mutationMultiplier: 4, shinyMultiplier: 2 });
    expect(formatReward({ currencies: { credits: 180, upgradeDust: 20 }, accountXp: 35, stoneXp: 45 })).toEqual([
      'CREDIT 180', 'DUST 20', 'ACCOUNT XP 35', 'STONE XP 45',
    ]);
  });

  it('keeps the hidden Eclipse recipe secret until its matching key is selected', () => {
    const parents = [
      { speciesId: 'species_quartzling', primaryElement: 'CRYSTAL' },
      { speciesId: 'species_solaris', primaryElement: 'LIGHT' },
    ];
    const definitions = { catalysts: FUSION_CATALYSTS };

    expect(findPresentationRecipe(parents, 5, FUSION_RECIPES, SPECIES_BY_ID, definitions)).toBeNull();
    expect(findPresentationRecipe(parents, 5, FUSION_RECIPES, SPECIES_BY_ID, {
      ...definitions,
      catalystIds: ['catalyst_eclipse'],
    })?.id).toBe('fusion_eclipse');
  });

  it('predicts a hidden recipe with no unlock catalyst once its normal conditions are met', () => {
    const parents = [
      { speciesId: 'species_emberite', primaryElement: 'FIRE' },
      { speciesId: 'species_quartzling', primaryElement: 'CRYSTAL' },
      { speciesId: 'species_ironwarden', primaryElement: 'METAL' },
      { speciesId: 'species_solaris', primaryElement: 'LIGHT' },
    ];

    expect(findPresentationRecipe(parents, 8, FUSION_RECIPES, SPECIES_BY_ID, {
      catalysts: FUSION_CATALYSTS,
    })?.id).toBe('fusion_ancient_convergence');
  });

  it('describes draw progression separately from clear rewards', () => {
    expect(formatDrawProgress(DUNGEONS[0].stages[0].reward)).toBe(
      'クリア報酬なし。参加した各StoneにSTONE XP 16・好感度 +6、ACCOUNT XP 8を付与。',
    );
  });
});
