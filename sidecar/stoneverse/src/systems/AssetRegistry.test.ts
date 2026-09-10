import { describe, expect, it, vi } from 'vitest';
import { CORE_ASSET_MANIFEST, validateAssetManifest, type AssetDefinition } from '../assets';
import { AssetRegistry, type AssetLoader } from './AssetRegistry';

const productionAsset = (id: string, priority: AssetDefinition['priority'] = 'normal'): AssetDefinition => ({
  id,
  kind: 'image',
  src: `/assets/${id}.webp`,
  priority,
  placeholder: false,
  productionRequired: true,
  alt: id,
});

describe('AssetRegistry', () => {
  it('keeps the checked-in manifest internally valid', () => {
    expect(validateAssetManifest(CORE_ASSET_MANIFEST)).toEqual([]);
    const issues = new AssetRegistry(CORE_ASSET_MANIFEST).productionIssues();
    expect(issues).toHaveLength(42);
    expect(issues.every((issue) => issue.reason === 'placeholder')).toBe(true);
    expect(issues.some((issue) => issue.id === 'background.home.observatory')).toBe(false);
    expect(issues.some((issue) => issue.id === 'background.expedition.frontier')).toBe(false);
  });

  it('resolves a placeholder without attempting a network load', async () => {
    const loader: AssetLoader = { load: vi.fn(async () => 'unexpected') };
    const registry = new AssetRegistry([
      {
        id: 'stone.missing',
        kind: 'image',
        priority: 'normal',
        placeholder: true,
        productionRequired: true,
        alt: 'Missing stone',
      },
    ], { loader });

    const result = await registry.load('stone.missing');
    expect(result.status).toBe('placeholder');
    expect(result.placeholderUsed).toBe(true);
    expect(result.resolvedUrl).toMatch(/^data:image\/svg\+xml/);
    expect(loader.load).not.toHaveBeenCalled();
    expect(registry.productionIssues()).toEqual([
      { id: 'stone.missing', reason: 'placeholder' },
    ]);
  });

  it('deduplicates concurrent loads and caches the ready URL', async () => {
    const load = vi.fn(async (definition: AssetDefinition) => definition.src!);
    const registry = new AssetRegistry([productionAsset('frame.rare')], { loader: { load } });

    const [first, second] = await Promise.all([
      registry.load('frame.rare'),
      registry.load('frame.rare'),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(first.status).toBe('ready');
    expect(second.resolvedUrl).toBe('/assets/frame.rare.webp');
    expect(registry.productionIssues()).toEqual([]);
  });

  it('records load failures as production issues instead of throwing through UI', async () => {
    const registry = new AssetRegistry([productionAsset('broken')], {
      loader: { load: async () => { throw new Error('offline'); } },
    });
    const snapshot = await registry.load('broken');
    expect(snapshot.status).toBe('error');
    expect(snapshot.error).toBe('offline');
    expect(registry.productionIssues()).toEqual([
      { id: 'broken', reason: 'load-error', detail: 'offline' },
    ]);
  });
});
