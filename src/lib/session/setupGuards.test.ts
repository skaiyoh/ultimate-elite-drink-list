import { describe, expect, it } from 'vitest';
import type { Category, CategoryId, Drink } from '@/lib/drinks/types';
import { maxAchievableUnits, setupIssues } from '@/lib/session/setupGuards';

const categories: ReadonlyMap<CategoryId, Category> = new Map([
  ['shot', { id: 'shot', label: 'Shots', maxQuantity: 8 }],
  ['martini', { id: 'martini', label: 'Martinis', maxQuantity: 2 }],
]);

const pool = (count: number, categoryId: CategoryId): Drink[] =>
  Array.from({ length: count }, (_, i) => ({ id: `d${i}`, name: `D${i}`, categoryId, enabled: true }));

describe('maxAchievableUnits', () => {
  it('sums the seven largest caps in the pool', () => {
    expect(maxAchievableUnits(pool(31, 'shot'), categories)).toBe(56);
    expect(maxAchievableUnits(pool(13, 'martini'), categories)).toBe(14);
  });

  it('prefers the highest caps when the pool is mixed', () => {
    expect(maxAchievableUnits([...pool(3, 'shot'), ...pool(9, 'martini')], categories)).toBe(3 * 8 + 4 * 2);
  });
});

describe('setupIssues', () => {
  it('is silent for a deep pool and a reachable band', () => {
    expect(setupIssues(pool(31, 'shot'), categories, [12, 16])).toEqual([]);
  });

  it('blocks when the pool cannot fill a round', () => {
    const issues = setupIssues(pool(6, 'shot'), categories, [12, 16]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('blocking');
    expect(issues[0].message).toMatch(/6 drinks/);
  });

  it('warns when the band cannot be reached', () => {
    const issues = setupIssues(pool(13, 'martini'), categories, [18, 24]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toMatch(/14/);
  });

  it('reports only the blocking issue when the pool is also too small', () => {
    const issues = setupIssues(pool(3, 'martini'), categories, [18, 24]);
    expect(issues.map((i) => i.severity)).toEqual(['blocking']);
  });
});
