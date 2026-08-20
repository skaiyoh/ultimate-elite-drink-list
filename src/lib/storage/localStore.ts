export { STORAGE_KEYS } from '@/lib/storage/keys';

export type WriteOutcome = 'ok' | 'quota' | 'unavailable';

/** Used when localStorage throws on access — Safari private mode, blocked cookies. */
const memory = new Map<string, string>();
let persistent = true;

/** False once any localStorage access has thrown; the app then runs in memory. */
export function isPersistent(): boolean {
  return persistent;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    persistent = false;
    return memory.get(key) ?? null;
  }
}

/**
 * Reads and validates a stored value. Returns null for missing, unparseable,
 * or invalid data — never throws, so a corrupt key can't take down a screen.
 */
export function readValue<T>(key: string, validate: (raw: unknown) => T | null): T | null {
  const raw = readRaw(key);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return validate(parsed);
}

export function writeValue(key: string, value: unknown): WriteOutcome {
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, serialized);
    return 'ok';
  } catch (error) {
    if (error instanceof Error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      return 'quota';
    }
    persistent = false;
    memory.set(key, serialized);
    return 'unavailable';
  }
}

export function removeValue(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    persistent = false;
  }
}
