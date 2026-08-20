export { STORAGE_KEYS } from '@/lib/storage/keys';

export type WriteOutcome = 'ok' | 'quota' | 'unavailable' | 'invalid';

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
  // The validator is caller-supplied and may throw on an unexpected-but-valid
  // JSON shape rather than returning null. Treat a throw as a rejection — the
  // whole point of this function is that a corrupt key cannot take down a screen.
  try {
    return validate(parsed);
  } catch {
    return null;
  }
}

export function writeValue(key: string, value: unknown): WriteOutcome {
  // Serialization is its own failure mode — a circular reference or a BigInt
  // throws here, which has nothing to do with storage availability. Kept in a
  // separate try so the storage branches below can rely on `serialized`.
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return 'invalid';
  }

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
