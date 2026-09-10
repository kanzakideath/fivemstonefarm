/**
 * Formats progression values without ever rendering NaN/Infinity. Values below
 * one million remain exact; larger values use short, locale-independent suffixes.
 */
export const formatProgressionNumber = (input: number): string => {
  if (Number.isNaN(input)) return '0';
  if (input === Number.POSITIVE_INFINITY) return 'MAX';
  if (input === Number.NEGATIVE_INFINITY) return '-MAX';
  const sign = input < 0 ? '-' : '';
  const value = Math.min(Number.MAX_SAFE_INTEGER, Math.abs(input));
  if (value < 1_000_000) return `${sign}${Math.floor(value).toLocaleString('en-US')}`;
  const suffixes = [
    { value: 1e15, label: 'Q' },
    { value: 1e12, label: 'T' },
    { value: 1e9, label: 'B' },
    { value: 1e6, label: 'M' },
  ] as const;
  const suffix = suffixes.find((candidate) => value >= candidate.value)!;
  const scaled = value / suffix.value;
  const precision = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${sign}${scaled.toFixed(precision).replace(/\.0+$|(?<=\.[0-9])0$/, '')}${suffix.label}`;
};

/** Saturating integer addition used by long-running/offline progression. */
export const safeProgressionAdd = (left: number, right: number): number => {
  const safe = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : value > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return Math.min(Number.MAX_SAFE_INTEGER, safe(left) + safe(right));
};
