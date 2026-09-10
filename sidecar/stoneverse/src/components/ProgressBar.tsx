interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  tone?: 'cyan' | 'gold' | 'violet' | 'health';
  compact?: boolean;
}

export function ProgressBar({ value, max, label, tone = 'cyan', compact = false }: ProgressBarProps) {
  const ratio = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`progress ${compact ? 'progress--compact' : ''}`}>
      {label ? (
        <div className="progress__meta">
          <span>{label}</span>
          <span>{Math.floor(value).toLocaleString()} / {Math.floor(max).toLocaleString()}</span>
        </div>
      ) : null}
      <div className="progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <span className={`progress__fill progress__fill--${tone}`} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}
