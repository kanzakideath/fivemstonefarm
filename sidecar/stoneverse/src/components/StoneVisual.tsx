import { Gem } from 'lucide-react';
import type { UiRarity } from './uiTypes';

interface StoneVisualProps {
  rarity: UiRarity;
  element: string;
  mutation?: string;
  variant?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  active?: boolean;
  className?: string;
}

function normalize(value: string | undefined) {
  return (value ?? 'none').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function StoneVisual({ rarity, element, mutation, variant, size = 'md', active, className = '' }: StoneVisualProps) {
  return (
    <div
      className={`stone-visual stone-visual--${size} rarity-${rarity.toLowerCase()} element-${normalize(element)} ${mutation ? `mutation-${normalize(mutation)}` : ''} ${variant ? 'stone-visual--variant' : ''} ${active ? 'is-active' : ''} ${className}`}
      aria-hidden="true"
    >
      <span className="stone-visual__orbit stone-visual__orbit--one" />
      <span className="stone-visual__orbit stone-visual__orbit--two" />
      <span className="stone-visual__particle stone-visual__particle--one" />
      <span className="stone-visual__particle stone-visual__particle--two" />
      <span className="stone-visual__particle stone-visual__particle--three" />
      <span className="stone-visual__aura" />
      <span className="stone-visual__shadow" />
      <span className="stone-visual__gem">
        <span className="stone-visual__facet stone-visual__facet--a" />
        <span className="stone-visual__facet stone-visual__facet--b" />
        <span className="stone-visual__facet stone-visual__facet--c" />
        <span className="stone-visual__shine" />
        <Gem className="stone-visual__fallback" strokeWidth={1.2} />
      </span>
    </div>
  );
}
