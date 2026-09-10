type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;
type StorageResolver<T> = () => T | null | undefined;

const ONBOARDING_KEY = 'stoneverse:onboarded';

const resolveLocalStorage = (): Storage => window.localStorage;

export function safeReadStorage(
  key: string,
  resolve: StorageResolver<StorageReader> = resolveLocalStorage,
): string | null {
  try {
    return resolve()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeWriteStorage(
  key: string,
  value: string,
  resolve: StorageResolver<StorageWriter> = resolveLocalStorage,
): boolean {
  try {
    const storage = resolve();
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const hasCompletedOnboarding = (): boolean => Boolean(safeReadStorage(ONBOARDING_KEY));

export const markOnboardingComplete = (): boolean => safeWriteStorage(ONBOARDING_KEY, '1');
