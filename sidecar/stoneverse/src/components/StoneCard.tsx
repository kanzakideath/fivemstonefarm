import { Heart, Lock, Sparkles } from 'lucide-react';
import { StoneVisual } from './StoneVisual';
import type { UiStone } from './uiTypes';

interface StoneCardProps {
  stone: UiStone;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function StoneCard({ stone, selected, compact, disabled, onClick }: StoneCardProps) {
  const body = (
    <>
      <span className="stone-card__foil" />
      <div className="stone-card__topline">
        <span className={`rarity-label rarity-label--${stone.rarity.toLowerCase()}`}>{stone.rarity}</span>
        <span className="stone-card__markers">
          {stone.mutation ? <Sparkles size={13} aria-label={stone.mutation} /> : null}
          {stone.favorite ? <Heart size={13} fill="currentColor" aria-label="お気に入り" /> : null}
          {stone.locked ? <Lock size={12} aria-label="ロック中" /> : null}
        </span>
      </div>
      <StoneVisual
        rarity={stone.rarity}
        element={stone.element}
        mutation={stone.mutation}
        variant={stone.colorVariant}
        size={compact ? 'sm' : 'md'}
        active={selected}
      />
      <div className="stone-card__copy">
        <span className="stone-card__level">LV.{stone.level}</span>
        <strong>{stone.nickname || stone.name}</strong>
        <span>{stone.name} · {stone.element}</span>
      </div>
      <div className="stone-card__power">
        <small>COMBAT</small>
        <b>{stone.combatPower.toLocaleString()}</b>
      </div>
    </>
  );

  return onClick ? (
    <button
      className={`stone-card rarity-frame-${stone.rarity.toLowerCase()} ${selected ? 'is-selected' : ''} ${compact ? 'stone-card--compact' : ''}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${stone.nickname || stone.name}、${stone.rarity}、レベル${stone.level}`}
    >
      {body}
    </button>
  ) : (
    <article className={`stone-card rarity-frame-${stone.rarity.toLowerCase()} ${compact ? 'stone-card--compact' : ''}`}>
      {body}
    </article>
  );
}
