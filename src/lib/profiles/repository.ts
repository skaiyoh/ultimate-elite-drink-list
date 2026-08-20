import { z } from 'zod';
import type { Profile } from '@/lib/profiles/types';
import { STORAGE_KEYS, readValue, removeValue, writeValue, type WriteOutcome } from '@/lib/storage/localStore';

const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

const profileListSchema = z.array(profileSchema);

function parseProfiles(raw: unknown): Profile[] | null {
  const result = profileListSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function addProfile(list: readonly Profile[], name: string, id: string, createdAt: number): Profile[] {
  return [...list, { id, name: name.trim(), createdAt }];
}

export function renameProfile(list: readonly Profile[], id: string, name: string): Profile[] {
  return list.map((p) => (p.id === id ? { ...p, name: name.trim() } : p));
}

export function removeProfile(list: readonly Profile[], id: string): Profile[] {
  return list.filter((p) => p.id !== id);
}

export function loadProfiles(): Profile[] {
  return readValue(STORAGE_KEYS.profiles, parseProfiles) ?? [];
}

export function saveProfiles(list: readonly Profile[]): WriteOutcome {
  return writeValue(STORAGE_KEYS.profiles, list);
}

export function loadActiveProfileId(): string | null {
  return readValue(STORAGE_KEYS.activeProfile, (raw) => (typeof raw === 'string' ? raw : null));
}

/**
 * Returns the outcome rather than swallowing it, matching `saveProfiles`.
 * Callers may ignore it — losing this pointer costs one tap, not data — but an
 * ignored return value is visible in a way that a discarded one is not.
 */
export function saveActiveProfileId(id: string | null): WriteOutcome {
  if (id === null) {
    removeValue(STORAGE_KEYS.activeProfile);
    return 'ok';
  }
  return writeValue(STORAGE_KEYS.activeProfile, id);
}
