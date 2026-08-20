import { SEED_CATEGORIES, SEED_DRINKS, SEED_VERSION } from '@/data/seed-drinks';
import { DRINKS_SCHEMA_VERSION, parseDrinkListState } from '@/lib/drinks/schema';
import type { Category, CategoryId, Drink, DrinkListState } from '@/lib/drinks/types';
import { STORAGE_KEYS, readValue, writeValue, type WriteOutcome } from '@/lib/storage/localStore';

export function initialDrinkList(): DrinkListState {
  return {
    schemaVersion: DRINKS_SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    drinks: SEED_DRINKS.map((d) => ({ ...d })),
    removedSeedIds: [],
  };
}

/**
 * Adds seed drinks the stored state has not seen, skipping any the user
 * deleted. Existing entries are left exactly as the user left them.
 */
export function mergeSeed(state: DrinkListState): DrinkListState {
  if (state.seedVersion >= SEED_VERSION) return state;

  const known = new Set(state.drinks.map((d) => d.id));
  const removed = new Set(state.removedSeedIds);
  const additions = SEED_DRINKS.filter((d) => !known.has(d.id) && !removed.has(d.id)).map((d) => ({ ...d }));

  return { ...state, seedVersion: SEED_VERSION, drinks: [...state.drinks, ...additions] };
}

export function loadDrinkList(): DrinkListState {
  const stored = readValue(STORAGE_KEYS.drinks, parseDrinkListState);
  return stored === null ? initialDrinkList() : mergeSeed(stored);
}

export function saveDrinkList(state: DrinkListState): WriteOutcome {
  return writeValue(STORAGE_KEYS.drinks, state);
}

const CATEGORY_MAP: ReadonlyMap<CategoryId, Category> = new Map(
  SEED_CATEGORIES.map((c) => [c.id, c] as const),
);

/** Categories are code-owned, so this never touches storage. */
export function categoryMap(): ReadonlyMap<CategoryId, Category> {
  return CATEGORY_MAP;
}

/** The drinks a round may be dealt from: enabled, and in a selected category. */
export function poolFor(state: DrinkListState, categoryIds: readonly CategoryId[]): Drink[] {
  const selected = new Set(categoryIds);
  return state.drinks.filter((d) => d.enabled && selected.has(d.categoryId));
}
