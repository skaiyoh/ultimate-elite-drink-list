import { z } from 'zod';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import { DRINKS_SCHEMA_VERSION, drinkSchema } from '@/lib/drinks/schema';
import type { Drink, DrinkId, DrinkListState } from '@/lib/drinks/types';

/**
 * Export / import (spec §5). The only way a menu moves between devices or
 * survives a browser wipe, so every failure names what is wrong with the file
 * and writes nothing — a half-applied import is worse than a refused one.
 */

export const EXPORT_KIND = 'ueddl.drink-list';

export type ImportMode = 'replace' | 'merge';

export interface DrinkListFile {
  readonly kind: typeof EXPORT_KIND;
  readonly schemaVersion: number;
  readonly exportedAt: number;
  readonly drinks: readonly Drink[];
  /** Travels with the file so deletions survive the round trip. */
  readonly removedSeedIds: readonly DrinkId[];
}

export interface ImportDiff {
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
}

export type ImportParse =
  | { readonly ok: true; readonly file: DrinkListFile }
  | { readonly ok: false; readonly reason: string };

// Categories are code-owned and never exported, so the file has no say in them.
const fileSchema = z.object({
  kind: z.literal(EXPORT_KIND),
  schemaVersion: z.number().int(),
  exportedAt: z.number(),
  drinks: z.array(drinkSchema),
  removedSeedIds: z.array(z.string()),
});

export function buildExport(state: DrinkListState, exportedAt: number): DrinkListFile {
  return {
    kind: EXPORT_KIND,
    schemaVersion: DRINKS_SCHEMA_VERSION,
    exportedAt,
    drinks: state.drinks.map((drink) => ({ ...drink })),
    removedSeedIds: [...state.removedSeedIds],
  };
}

/** `en-CA` is the shortest route to YYYY-MM-DD that still honours a time zone. */
export function exportFilename(exportedAt: number, timeZone?: string): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone,
  }).format(exportedAt);
  return `ueddl-drinks-${day}.json`;
}

const KNOWN_CATEGORIES: ReadonlySet<string> = new Set(SEED_CATEGORIES.map((c) => c.id));

/** Names the offending category rather than reporting a generic shape error. */
function unknownCategory(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || !('drinks' in raw) || !Array.isArray(raw.drinks)) return null;

  for (const drink of raw.drinks) {
    const id: unknown = (drink as { categoryId?: unknown })?.categoryId;
    if (typeof id === 'string' && !KNOWN_CATEGORIES.has(id)) return id;
  }
  return null;
}

export function parseImportFile(text: string): ImportParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file is not valid JSON.' };
  }

  const kind = (raw as { kind?: unknown })?.kind;
  if (kind !== EXPORT_KIND) return { ok: false, reason: 'That is not a drink list export from this app.' };

  const version = (raw as { schemaVersion?: unknown })?.schemaVersion;
  if (version !== DRINKS_SCHEMA_VERSION) {
    return { ok: false, reason: `That file uses drink list format ${String(version)}; this app reads ${DRINKS_SCHEMA_VERSION}.` };
  }

  // Checked before the schema so the message can name the category, which a
  // Zod enum failure would only describe as an invalid value.
  const category = unknownCategory(raw);
  if (category !== null) return { ok: false, reason: `That file has a drink in an unknown category: ${category}.` };

  const result = fileSchema.safeParse(raw);
  if (!result.success) return { ok: false, reason: 'That file has a drink with missing or invalid fields.' };

  return { ok: true, file: result.data };
}

function sameDrink(a: Drink, b: Drink): boolean {
  return a.name === b.name && a.categoryId === b.categoryId && a.enabled === b.enabled;
}

export function diffImport(
  current: DrinkListState, file: DrinkListFile, mode: ImportMode,
): ImportDiff {
  const before = new Map(current.drinks.map((drink) => [drink.id, drink]));
  const after = new Map(file.drinks.map((drink) => [drink.id, drink]));

  let added = 0;
  let changed = 0;
  for (const [id, drink] of after) {
    const existing = before.get(id);
    if (existing === undefined) added += 1;
    else if (!sameDrink(existing, drink)) changed += 1;
  }

  // A merge is a union: it can add or overwrite, never drop.
  const removed = mode === 'merge' ? 0 : [...before.keys()].filter((id) => !after.has(id)).length;

  return { added, changed, removed };
}

export function applyImport(
  current: DrinkListState, file: DrinkListFile, mode: ImportMode,
): DrinkListState {
  if (mode === 'replace') {
    return {
      ...current,
      // seedVersion stays as it is: a restore must not look stale to mergeSeed
      // on the next read, which would re-add every seed drink the file dropped.
      drinks: file.drinks.map((drink) => ({ ...drink })),
      removedSeedIds: [...file.removedSeedIds],
    };
  }

  const incoming = new Map(file.drinks.map((drink) => [drink.id, drink]));
  const merged = current.drinks.map((drink) => incoming.get(drink.id) ?? drink);
  const known = new Set(current.drinks.map((drink) => drink.id));

  return {
    ...current,
    drinks: [...merged, ...file.drinks.filter((drink) => !known.has(drink.id))].map((drink) => ({ ...drink })),
    removedSeedIds: [...new Set([...current.removedSeedIds, ...file.removedSeedIds])],
  };
}
