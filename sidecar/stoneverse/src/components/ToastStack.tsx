import { AlertCircle, CheckCircle2, Info, Sparkles, X } from 'lucide-react';

export interface GameToast {
  id: string;
  title: string;
  detail?: string;
  tone?: 'info' | 'success' | 'rare' | 'error';
}

export function ToastStack({ toasts, onDismiss }: { toasts: GameToast[]; onDismiss: (id: string) => void }) {
  return <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <article className={`game-toast game-toast--${toast.tone || 'info'}`} key={toast.id}>{toast.tone === 'rare' ? <Sparkles /> : toast.tone === 'success' ? <CheckCircle2 /> : toast.tone === 'error' ? <AlertCircle /> : <Info />}<span><strong>{toast.title}</strong>{toast.detail ? <small>{toast.detail}</small> : null}</span><button type="button" onClick={() => onDismiss(toast.id)} aria-label="通知を閉じる"><X /></button></article>)}</div>;
}
