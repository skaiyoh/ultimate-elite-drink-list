import { describe, expect, it } from 'vitest';
import type { Category, CategoryId, Drink } from '@/lib/drinks/types';
import { assignQuantities, dealRound, selectDrinks } from '@/lib/session/generator';
import { seededRng, shuffle } from '@/lib/session/rng';

const categories: ReadonlyMap<CategoryId, Category> = new Map([
  ['shot', { id: 'shot', label: 'Shots', maxQuantity: 8 }],
  ['martini', { id: 'martini', label: 'Martinis', maxQuantity: 2 }],
]);

const makePool = (count: number, categoryId: CategoryId): Drink[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `d${i}`, name: `Drink ${i}`, categoryId, enabled: true,
  }));

describe('shuffle', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seededRng(1));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic for a given seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(7))).toEqual(shuffle([1, 2, 3, 4, 5], seededRng(7)));
  });
});

describe('selectDrinks', () => {
  it('returns exactly 7 distinct drinks', () => {
    const out = selectDrinks(makePool(31, 'shot'), [], seededRng(1));
    expect(out).toHaveLength(7);
    expect(new Set(out.map((d) => d.id)).size).toBe(7);
  });

  it('avoids the previous round entirely when the pool is deep', () => {
    const pool = makePool(31, 'shot');
    const previous = pool.slice(0, 7).map((d) => d.id);
    const out = selectDrinks(pool, previous, seededRng(2));
    expect(out.some((d) => previous.includes(d.id))).toBe(false);
  });

  it('takes 6 fresh and 1 stale from a 13-drink pool', () => {
    const pool = makePool(13, 'martini');
    const previous = pool.slice(0, 7).map((d) => d.id);
    const out = selectDrinks(pool, previous, seededRng(3));
    expect(out).toHaveLength(7);
    expect(out.filter((d) => !previous.includes(d.id))).toHaveLength(6);
    expect(out.filter((d) => previous.includes(d.id))).toHaveLength(1);
  });

  it('takes the whole fresh tier when a 14-drink pool leaves exactly 7 fresh', () => {
    // Arithmetic, not policy: choosing 7 distinct drinks that avoid the
    // previous 7 out of a pool of 14 has exactly one solution. Documented so
    // nobody "fixes" it later. Quantities still re-roll every round.
    const pool = makePool(14, 'martini');
    const previous = pool.slice(0, 7).map((d) => d.id);
    const out = selectDrinks(pool, previous, seededRng(4)).map((d) => d.id).sort();
    expect(out).toEqual(pool.slice(7).map((d) => d.id).sort());
  });

  it('still deals when every drink was in the previous round', () => {
    const pool = makePool(7, 'martini');
    const previous = pool.map((d) => d.id);
    const out = selectDrinks(pool, previous, seededRng(6));
    expect(out).toHaveLength(7);
    expect(new Set(out.map((d) => d.id)).size).toBe(7);
  });

  it('throws when the pool is too small to deal a round', () => {
    expect(() => selectDrinks(makePool(6, 'shot'), [], seededRng(1))).toThrow(/needs 7/);
  });
});

describe('assignQuantities', () => {
  const totalOf = (lines: { quantity: number }[]) => lines.reduce((sum, l) => sum + l.quantity, 0);

  it('gives every line at least 1 and never exceeds its category cap', () => {
    const lines = assignQuantities(makePool(7, 'shot'), categories, [12, 16], seededRng(1));
    expect(lines).toHaveLength(7);
    expect(lines.every((l) => l.quantity >= 1 && l.quantity <= 8)).toBe(true);
  });

  it('lands inside the band when the band is reachable', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const total = totalOf(assignQuantities(makePool(7, 'shot'), categories, [12, 16], seededRng(seed)));
      expect(total).toBeGreaterThanOrEqual(12);
      expect(total).toBeLessThanOrEqual(16);
    }
  });

  it('clamps down to the ceiling when the band is unreachable', () => {
    // 7 martini lines cap at 2 each: 14 units is the hard ceiling, Rush wants 18-24.
    for (let seed = 1; seed <= 10; seed++) {
      expect(totalOf(assignQuantities(makePool(7, 'martini'), categories, [18, 24], seededRng(seed)))).toBe(14);
    }
  });

  it('clamps up to the floor when the band sits below 7 units', () => {
    expect(totalOf(assignQuantities(makePool(7, 'shot'), categories, [3, 5], seededRng(1)))).toBe(7);
  });

  it('carries the drink name and category onto each line', () => {
    const line = assignQuantities(makePool(7, 'shot'), categories, [7, 7], seededRng(1))[0];
    expect(line).toMatchObject({ drinkId: expect.any(String), name: expect.any(String), categoryId: 'shot' });
  });

  it('throws on a drink whose category is unknown', () => {
    const orphan: Drink[] = [{ id: 'x', name: 'X', categoryId: 'well', enabled: true }];
    expect(() => assignQuantities(orphan, categories, [7, 7], seededRng(1))).toThrow(/Unknown category/);
  });
});

describe('dealRound', () => {
  it('is deterministic for a given seed', () => {
    const pool = makePool(31, 'shot');
    expect(dealRound(pool, categories, [12, 16], [], seededRng(9)))
      .toEqual(dealRound(pool, categories, [12, 16], [], seededRng(9)));
  });

  it('produces 7 lines with distinct drinks', () => {
    const lines = dealRound(makePool(31, 'shot'), categories, [12, 16], [], seededRng(1));
    expect(lines).toHaveLength(7);
    expect(new Set(lines.map((l) => l.drinkId)).size).toBe(7);
  });
});
