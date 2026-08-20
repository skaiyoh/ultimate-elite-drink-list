import { DRINKS_PER_ROUND } from '@/lib/drinks/schema';
import type { Category, CategoryId, Drink } from '@/lib/drinks/types';

export interface SetupIssue {
  readonly severity: 'blocking' | 'warning';
  readonly message: string;
}

/** The largest total a round could reach: the seven biggest caps in the pool. */
export function maxAchievableUnits(
  pool: readonly Drink[],
  categories: ReadonlyMap<CategoryId, Category>,
): number {
  return pool
    .map((drink) => categories.get(drink.categoryId)?.maxQuantity ?? 0)
    .sort((a, b) => b - a)
    .slice(0, DRINKS_PER_ROUND)
    .reduce((sum, cap) => sum + cap, 0);
}

export function setupIssues(
  pool: readonly Drink[],
  categories: ReadonlyMap<CategoryId, Category>,
  band: readonly [number, number],
): SetupIssue[] {
  if (pool.length < DRINKS_PER_ROUND) {
    return [{
      severity: 'blocking',
      message: `Only ${pool.length} drinks are enabled in the selected categories. A round needs ${DRINKS_PER_ROUND}.`,
    }];
  }

  const ceiling = maxAchievableUnits(pool, categories);
  if (band[0] > ceiling) {
    return [{
      severity: 'warning',
      message: `These categories top out at ${ceiling} drinks per round, below this difficulty's ${band[0]}. Rounds will be clamped to ${ceiling}.`,
    }];
  }

  return [];
}
