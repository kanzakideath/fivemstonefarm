import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface GameModalProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function GameModal({ open, title, eyebrow, children, onClose, wide }: GameModalProps) {
  if (!open) return null;

  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`game-modal ${wide ? 'game-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="game-modal__header">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="閉じる"><X /></button>
        </header>
        <div className="game-modal__body">{children}</div>
      </section>
    </div>
  );
}
