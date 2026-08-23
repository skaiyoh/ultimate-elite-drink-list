import type { SessionState } from '@/lib/session/machine';
import { parseSessionConfig, parseSessionRecord, parseSessionState } from '@/lib/session/schema';
import type { SessionConfig, SessionRecord } from '@/lib/session/types';
import { STORAGE_KEYS, readValue, removeValue, writeValue, type WriteOutcome } from '@/lib/storage/localStore';

export function saveActiveSession(state: SessionState): WriteOutcome {
  return writeValue(STORAGE_KEYS.activeSession, state);
}

/**
 * Restores an interrupted session at rest. Time that passed while the app was
 * closed is unknowable, so an in-flight round is dropped rather than guessed at.
 */
export function loadActiveSession(): SessionState | null {
  const stored = readValue(STORAGE_KEYS.activeSession, parseSessionState);
  if (stored === null) return null;
  if (stored.status === 'running' || stored.status === 'paused') {
    return { ...stored, status: 'resting', current: null };
  }
  return stored;
}

export function clearActiveSession(): void {
  removeValue(STORAGE_KEYS.activeSession);
}

/** Device-level: the next person to walk up inherits the last setup used. */
export function savePrefs(config: SessionConfig): WriteOutcome {
  return writeValue(STORAGE_KEYS.prefs, config);
}

export function loadPrefs(): SessionConfig | null {
  return readValue(STORAGE_KEYS.prefs, parseSessionConfig);
}

/**
 * The one finished run this device keeps, overwritten by the next.
 *
 * Deliberately a single key rather than an index: "only the most recent run
 * matters" is the premise, so there is no second write to keep consistent and
 * no orphan to roll back.
 */
export function saveLastRun(record: SessionRecord): WriteOutcome {
  return writeValue(STORAGE_KEYS.lastRun, record);
}

/** Null for absent or unreadable — a corrupt run must not take down the screen. */
export function loadLastRun(): SessionRecord | null {
  return readValue(STORAGE_KEYS.lastRun, parseSessionRecord);
}

export function clearLastRun(): void {
  removeValue(STORAGE_KEYS.lastRun);
}
