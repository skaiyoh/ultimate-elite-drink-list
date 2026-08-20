import { DRINKS_PER_ROUND } from '@/lib/drinks/schema';
import type { Category, CategoryId, Drink, DrinkId } from '@/lib/drinks/types';
import { shuffle, type Rng } from '@/lib/session/rng';
import type { TicketLine } from '@/lib/session/types';

/**
 * Two-tier selection: prefer drinks not dealt last round, top up from the
 * stale tier only if the fresh tier runs short.
 *
 * Replaces a pool-size threshold, which had a cliff: below it freshness was
 * off entirely (the 13-drink martini pool got none), at or above it exclusion
 * was absolute. This has no constant and is maximally fresh at every pool size
 * from 7 up.
 */
export function selectDrinks(pool: readonly Drink[], previous: readonly DrinkId[], rng: Rng): Drink[] {
  if (pool.length < DRINKS_PER_ROUND) {
    throw new Error(`Pool has ${pool.length} drinks; a round needs ${DRINKS_PER_ROUND}`);
  }
  const dealt = new Set(previous);
  const fresh = shuffle(pool.filter((d) => !dealt.has(d.id)), rng);
  const stale = shuffle(pool.filter((d) => dealt.has(d.id)), rng);
  return [...fresh, ...stale].slice(0, DRINKS_PER_ROUND);
}

/**
 * Seeds every line at 1, then distributes the remaining units to random lines
 * that still have headroom. Surplus naturally lands on shots, because shots
 * are the lines with headroom left — realistic tickets without special-casing.
 */
export function assignQuantities(
  selected: readonly Drink[],
  categories: ReadonlyMap<CategoryId, Category>,
  band: readonly [number, number],
  rng: Rng,
): TicketLine[] {
  const caps = selected.map((drink) => {
    const category = categories.get(drink.categoryId);
    if (!category) throw new Error(`Unknown category: ${drink.categoryId}`);
    return category.maxQuantity;
  });

  const floor = selected.length;
  const ceiling = caps.reduce((sum, cap) => sum + cap, 0);

  // Draw uniformly from the band intersected with what is achievable. Drawing
  // from the band and clamping afterwards would pile probability on the endpoint.
  const low = Math.max(band[0], floor);
  const high = Math.min(band[1], ceiling);
  const target = low <= high
    ? low + Math.floor(rng() * (high - low + 1))
    : (band[0] > ceiling ? ceiling : floor);

  const quantities = selected.map(() => 1);
  let remaining = target - floor;
  while (remaining > 0) {
    const withHeadroom: number[] = [];
    for (let i = 0; i < quantities.length; i++) {
      if (quantities[i] < caps[i]) withHeadroom.push(i);
    }
    if (withHeadroom.length === 0) break;
    quantities[withHeadroom[Math.floor(rng() * withHeadroom.length)]] += 1;
    remaining -= 1;
  }

  return selected.map((drink, i) => ({
    drinkId: drink.id,
    name: drink.name,
    categoryId: drink.categoryId,
    quantity: quantities[i],
  }));
}

export function dealRound(
  pool: readonly Drink[],
  categories: ReadonlyMap<CategoryId, Category>,
  band: readonly [number, number],
  previous: readonly DrinkId[],
  rng: Rng,
): TicketLine[] {
  return assignQuantities(selectDrinks(pool, previous, rng), categories, band, rng);
}
