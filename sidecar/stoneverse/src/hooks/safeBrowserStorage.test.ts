import { describe, expect, it } from 'vitest';
import { safeReadStorage, safeWriteStorage } from './safeBrowserStorage';

describe('safe browser storage', () => {
  it('returns a safe fallback when resolving localStorage throws SecurityError', () => {
    const denied = () => { throw new DOMException('Access denied', 'SecurityError'); };

    expect(safeReadStorage('stoneverse:onboarded', denied)).toBeNull();
    expect(safeWriteStorage('stoneverse:onboarded', '1', denied)).toBe(false);
  });

  it('returns a safe fallback when a Storage operation throws', () => {
    const reader = { getItem: () => { throw new DOMException('Access denied', 'SecurityError'); } };
    const writer = { setItem: () => { throw new DOMException('Quota denied', 'QuotaExceededError'); } };

    expect(safeReadStorage('stoneverse:onboarded', () => reader)).toBeNull();
    expect(safeWriteStorage('stoneverse:onboarded', '1', () => writer)).toBe(false);
  });
});
