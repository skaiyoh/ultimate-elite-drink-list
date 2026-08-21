import { STORAGE_KEYS, readValue, writeValue, type WriteOutcome } from '@/lib/storage/localStore';

/**
 * `system` is the absence of a choice, not a third palette: the page follows
 * prefers-color-scheme until someone overrides it (spec §10).
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

function parseTheme(raw: unknown): ThemeChoice | null {
  return typeof raw === 'string' && (THEME_CHOICES as readonly string[]).includes(raw)
    ? (raw as ThemeChoice)
    : null;
}

/** Anything unreadable reads as `system` — the safe answer is the default. */
export function loadTheme(): ThemeChoice {
  return readValue(STORAGE_KEYS.theme, parseTheme) ?? 'system';
}

export function saveTheme(choice: ThemeChoice): WriteOutcome {
  return writeValue(STORAGE_KEYS.theme, choice);
}
