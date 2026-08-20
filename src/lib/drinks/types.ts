/** Single source of truth for category ids — a typo anywhere else is a compile error. */
export type CategoryId = 'shot' | 'well' | 'cocktail' | 'martini';

/** Stable drink identifier: `seed:<slug>` for shipped drinks, uuid for user-added. */
export type DrinkId = string;

export interface Category {
  readonly id: CategoryId;
  /** Human-facing name, e.g. "Well Drinks". */
  readonly label: string;
  /**
   * Cap for a SINGLE LINE on a ticket: one drink in this category may be dealt
   * up to this many times. Not a cap on the category across the whole ticket —
   * a round may hold several shot lines, each independently up to 8.
   */
  readonly maxQuantity: number;
}

export interface Drink {
  /** Stable, namespaced id: `seed:<slug>` for anything shipped in seed-drinks.ts. */
  readonly id: DrinkId;
  readonly name: string;
  readonly categoryId: CategoryId;
  /** Off means it stays in the data but is hidden from ordering (86'd). */
  readonly enabled: boolean;
}

/** The persisted drink list. Categories are code-owned and deliberately absent. */
export interface DrinkListState {
  readonly schemaVersion: number;
  readonly seedVersion: number;
  readonly drinks: readonly Drink[];
  /** Seed drinks the user deleted, so a later seed update never resurrects them. */
  readonly removedSeedIds: readonly DrinkId[];
}
