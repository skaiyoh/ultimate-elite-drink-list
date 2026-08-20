import { z } from 'zod';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import type { DrinkListState } from '@/lib/drinks/types';

/** A round always deals this many distinct drinks. */
export const DRINKS_PER_ROUND = 7;

/** The version of the persisted shape. Bumping this requires a migration. */
export const DRINKS_SCHEMA_VERSION = 1;

// Zod 4's `z.enum` accepts a readonly string array directly and narrows the
// element type via its own inference — no `as [CategoryId, ...CategoryId[]]`
// tuple cast is needed (that was a Zod 3 requirement).
const categoryIds = SEED_CATEGORIES.map((c) => c.id);

export const categoryIdSchema = z.enum(categoryIds);

export const drinkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categoryId: categoryIdSchema,
  enabled: z.boolean(),
});

export const drinkListStateSchema = z.object({
  schemaVersion: z.literal(DRINKS_SCHEMA_VERSION),
  seedVersion: z.number().int().nonnegative(),
  drinks: z.array(drinkSchema),
  removedSeedIds: z.array(z.string()),
});

/**
 * Validates anything crossing the storage or import boundary.
 * Returns null rather than throwing — callers fall back to the seed.
 */
export function parseDrinkListState(raw: unknown): DrinkListState | null {
  const result = drinkListStateSchema.safeParse(raw);
  return result.success ? result.data : null;
}
