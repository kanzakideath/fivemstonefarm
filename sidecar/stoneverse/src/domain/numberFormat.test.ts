import { describe, expect, it } from 'vitest';
import { formatProgressionNumber, safeProgressionAdd } from './numberFormat';

describe('long-running progression number safety', () => {
  it('formats exact and compact values predictably', () => {
    expect(formatProgressionNumber(999_999)).toBe('999,999');
    expect(formatProgressionNumber(1_250_000)).toBe('1.25M');
    expect(formatProgressionNumber(42_500_000_000)).toBe('42.5B');
    expect(formatProgressionNumber(Number.POSITIVE_INFINITY)).toBe('MAX');
    expect(formatProgressionNumber(Number.NaN)).toBe('0');
  });

  it('saturates instead of overflowing into unsafe progression', () => {
    expect(safeProgressionAdd(Number.MAX_SAFE_INTEGER - 5, 20)).toBe(Number.MAX_SAFE_INTEGER);
    expect(safeProgressionAdd(Number.POSITIVE_INFINITY, 20)).toBe(Number.MAX_SAFE_INTEGER);
    expect(safeProgressionAdd(-100, 10)).toBe(10);
  });
});
