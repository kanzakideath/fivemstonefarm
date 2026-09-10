export type AssetKind =
  | 'image'
  | 'audio'
  | 'video'
  | 'font'
  | 'json'
  | 'shader';

export type AssetPriority = 'critical' | 'high' | 'normal' | 'low';

export interface AssetDefinition {
  /** Stable logical key. UI and systems reference this rather than a file path. */
  id: string;
  kind: AssetKind;
  /** Omit until a real, reviewed asset exists. Missing URLs never trigger a request. */
  src?: string;
  priority: AssetPriority;
  preload?: boolean;
  placeholder: boolean;
  productionRequired: boolean;
  alt?: string;
  tags?: readonly string[];
  expectedFormat?: string;
  expectedDimensions?: Readonly<{ width: number; height: number }>;
  notes?: string;
}

/**
 * Shipping registry seed. Every unresolved visual is deliberately marked PLACEHOLDER.
 * Add real files by setting `src` and `placeholder: false`; consumers do not change.
 */
export const CORE_ASSET_MANIFEST: readonly AssetDefinition[] = [
  {
    id: 'background.home.observatory',
    kind: 'image',
    src: '/assets/backgrounds/sanctuary-home.png',
    priority: 'critical',
    preload: true,
    placeholder: false,
    productionRequired: true,
    alt: 'The Stoneverse observatory home base',
    tags: ['background', 'home'],
    expectedFormat: 'avif/webp',
    expectedDimensions: { width: 2560, height: 1440 },
  },
  {
    id: 'background.collection.archive',
    kind: 'image',
    priority: 'high',
    placeholder: true,
    productionRequired: true,
    alt: 'Stone archive collection chamber',
    tags: ['background', 'collection'],
    expectedFormat: 'avif/webp',
    expectedDimensions: { width: 2560, height: 1440 },
  },
  {
    id: 'background.gacha.deep-core',
    kind: 'image',
    priority: 'high',
    placeholder: true,
    productionRequired: true,
    alt: 'Deep Core gacha apparatus',
    tags: ['background', 'gacha'],
    expectedFormat: 'avif/webp',
    expectedDimensions: { width: 2560, height: 1440 },
  },
  {
    id: 'background.fusion.laboratory',
    kind: 'image',
    priority: 'high',
    placeholder: true,
    productionRequired: true,
    alt: 'Fusion laboratory',
    tags: ['background', 'fusion'],
    expectedFormat: 'avif/webp',
    expectedDimensions: { width: 2560, height: 1440 },
  },
  {
    id: 'background.battle.crystal-mine',
    kind: 'image',
    priority: 'high',
    placeholder: true,
    productionRequired: true,
    alt: 'Crystal mine battlefield',
    tags: ['background', 'battle'],
    expectedFormat: 'avif/webp',
    expectedDimensions: { width: 2560, height: 1440 },
  },
  {
    id: 'background.expedition.frontier',
    kind: 'image',
    src: '/assets/backgrounds/expedition-endless-frontier.png',
    priority: 'critical',
    preload: true,
    placeholder: false,
    productionRequired: true,
    alt: 'A crystalline expedition frontier descending into the Endless Mine',
    tags: ['background', 'expedition', 'endless-mine'],
    expectedFormat: 'avif/webp',
    expectedDimensions: { width: 2560, height: 1440 },
    notes: 'Generated concept master; ship responsive AVIF/WebP derivatives before production.',
  },
  ...([
    ['background.endless.weekly-fault', 'Weekly Endless Mine fault with procedural modifiers'],
    ['background.boss.worldheart', 'Worldheart multi-phase boss arena'],
    ['background.research.chamber', 'Passive Research chamber'],
    ['background.report.return-gate', 'Expedition return and idle report chamber'],
    ['ui.expedition.region-map', 'Layered expedition region map'],
    ['ui.endless.rule-emblems', 'Endless Mine procedural rule emblems'],
    ['overlay.report.unknown-signal', 'Unknown Signal rare discovery overlay'],
    ['vfx.battle.break', 'Boss break impact effect'],
    ['vfx.battle.ultimate', 'Stone ultimate resonance effect'],
    ['vfx.boss.phase-shift', 'Boss phase transition effect'],
  ] as const).map(([id, alt]): AssetDefinition => ({
    id,
    kind: 'image',
    priority: id.startsWith('background') ? 'high' : 'normal',
    placeholder: true,
    productionRequired: true,
    alt,
    tags: id.split('.'),
    expectedFormat: id.startsWith('background') ? 'avif/webp' : 'transparent webp/png',
    expectedDimensions: id.startsWith('background') ? { width: 2560, height: 1440 } : { width: 1024, height: 1024 },
  })),
  ...(['core', 'rune', 'relic', 'charm'] as const).map(
    (slot): AssetDefinition => ({
      id: `icon.equipment.${slot}`,
      kind: 'image',
      priority: 'normal',
      placeholder: true,
      productionRequired: true,
      alt: `${slot} equipment slot icon`,
      tags: ['icon', 'equipment', `slot:${slot}`],
      expectedFormat: 'svg',
      expectedDimensions: { width: 96, height: 96 },
    }),
  ),
  ...(['normal', 'rare', 'sr', 'ssr', 'ur', 'legendary'] as const).map(
    (rarity): AssetDefinition => ({
      id: `frame.equipment.${rarity}`,
      kind: 'image',
      priority: 'normal',
      placeholder: true,
      productionRequired: true,
      alt: `${rarity.toUpperCase()} equipment frame`,
      tags: ['frame', 'equipment', `rarity:${rarity}`],
      expectedFormat: 'transparent webp/png',
      expectedDimensions: { width: 768, height: 768 },
    }),
  ),
  ...(['normal', 'rare', 'sr', 'ssr', 'ur', 'legendary'] as const).map(
    (rarity): AssetDefinition => ({
      id: `frame.stone.${rarity}`,
      kind: 'image',
      priority: rarity === 'normal' ? 'high' : 'normal',
      preload: rarity === 'normal',
      placeholder: true,
      productionRequired: true,
      alt: `${rarity.toUpperCase()} stone card frame`,
      tags: ['frame', 'card', `rarity:${rarity}`],
      expectedFormat: 'transparent webp/png',
      expectedDimensions: { width: 768, height: 1080 },
    }),
  ),
  ...(['earth', 'fire', 'water', 'wind', 'crystal', 'light', 'dark', 'void'] as const).map(
    (element): AssetDefinition => ({
      id: `icon.element.${element}`,
      kind: 'image',
      priority: 'high',
      placeholder: true,
      productionRequired: true,
      alt: `${element} element`,
      tags: ['icon', `element:${element}`],
      expectedFormat: 'svg',
      expectedDimensions: { width: 96, height: 96 },
    }),
  ),
  ...(['prismatic', 'ancient', 'corrupted', 'perfect'] as const).map(
    (mutation): AssetDefinition => ({
      id: `overlay.mutation.${mutation}`,
      kind: 'image',
      priority: 'normal',
      placeholder: true,
      productionRequired: true,
      alt: `${mutation} mutation overlay`,
      tags: ['overlay', `mutation:${mutation}`],
      expectedFormat: 'transparent webp/png',
      expectedDimensions: { width: 1024, height: 1024 },
    }),
  ),
];

export function validateAssetManifest(
  manifest: readonly AssetDefinition[],
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const asset of manifest) {
    if (!asset.id.trim()) errors.push('Asset id must not be blank.');
    if (ids.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}`);
    ids.add(asset.id);
    if (asset.placeholder && asset.src) {
      errors.push(`Placeholder asset must not advertise a source: ${asset.id}`);
    }
    if (!asset.placeholder && !asset.src) {
      errors.push(`Production asset is missing its source: ${asset.id}`);
    }
    if (asset.kind === 'image' && !asset.alt?.trim()) {
      errors.push(`Image asset is missing alt text: ${asset.id}`);
    }
  }

  return errors;
}
