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

function parseIdList(raw: unknown): string[] | null {
  return Array.isArray(raw) && raw.every((v) => typeof v === 'string') ? (raw as string[]) : null;
}

export function loadSessionIndex(profileId: string): string[] {
  return readValue(STORAGE_KEYS.sessionIndex(profileId), parseIdList) ?? [];
}

/**
 * Sessions are append-only and immutable, so this is an O(1) write per session.
 *
 * The record and the index are two separate writes and localStorage has no
 * transaction. If the second one fails, the first is rolled back: a record the
 * index cannot reach is invisible in history forever, whereas a clean failure
 * is reported to the caller, which still holds the crash-recovery backup. The
 * rollback only ever removes a record this call just wrote or an equivalent
 * orphan — an already-indexed id returns before reaching the index write.
 */
export function commitSession(record: SessionRecord): WriteOutcome {
  const written = writeValue(STORAGE_KEYS.session(record.id), record);
  if (written !== 'ok') return written;

  const index = loadSessionIndex(record.profileId);
  if (index.includes(record.id)) return 'ok';

  const indexed = writeValue(STORAGE_KEYS.sessionIndex(record.profileId), [record.id, ...index]);
  if (indexed !== 'ok') removeValue(STORAGE_KEYS.session(record.id));
  return indexed;
}

export function loadSession(sessionId: string): SessionRecord | null {
  return readValue(STORAGE_KEYS.session(sessionId), parseSessionRecord);
}

export function savePrefs(profileId: string, config: SessionConfig): WriteOutcome {
  return writeValue(STORAGE_KEYS.prefs(profileId), config);
}

export function loadPrefs(profileId: string): SessionConfig | null {
  return readValue(STORAGE_KEYS.prefs(profileId), parseSessionConfig);
}
