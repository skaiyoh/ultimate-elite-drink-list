import { describe, expect, it } from 'vitest';
import { SEED_DRINKS, SEED_VERSION } from '@/data/seed-drinks';
import {
  categoryMap, initialDrinkList, loadDrinkList, mergeSeed, poolFor, saveDrinkList,
} from '@/lib/drinks/repository';
import type { DrinkListState } from '@/lib/drinks/types';

describe('initialDrinkList', () => {
  it('starts from the full seed with nothing removed', () => {
    const state = initialDrinkList();
    expect(state.drinks).toHaveLength(SEED_DRINKS.length);
    expect(state.removedSeedIds).toEqual([]);
    expect(state.seedVersion).toBe(SEED_VERSION);
  });
});

describe('mergeSeed', () => {
  const stale: DrinkListState = {
    schemaVersion: 1,
    seedVersion: 0,
    drinks: [{ id: 'seed:green-tea-shot', name: 'GT (house)', categoryId: 'shot', enabled: false }],
    removedSeedIds: ['seed:orgasm'],
  };

  it('adds seed drinks the stored state has never seen', () => {
    const merged = mergeSeed(stale);
    expect(merged.drinks.some((d) => d.id === 'seed:margarita')).toBe(true);
  });

  it('never overwrites a user edit to an existing drink', () => {
    const merged = mergeSeed(stale);
    const edited = merged.drinks.find((d) => d.id === 'seed:green-tea-shot');
    expect(edited).toEqual({ id: 'seed:green-tea-shot', name: 'GT (house)', categoryId: 'shot', enabled: false });
  });

  it('never resurrects a removed seed drink', () => {
    const merged = mergeSeed(stale);
    expect(merged.drinks.some((d) => d.id === 'seed:orgasm')).toBe(false);
  });

  it('bumps seedVersion so the merge runs once', () => {
    expect(mergeSeed(stale).seedVersion).toBe(SEED_VERSION);
  });

  it('is a no-op when seedVersion is already current', () => {
    const current = { ...stale, seedVersion: SEED_VERSION };
    expect(mergeSeed(current)).toBe(current);
  });
});

describe('loadDrinkList', () => {
  it('returns the seed when storage is empty', () => {
    expect(loadDrinkList().drinks).toHaveLength(SEED_DRINKS.length);
  });

  it('falls back to the seed when stored data is corrupt', () => {
    window.localStorage.setItem('ueddl:v1:drinks', '{"schemaVersion":"wrong"}');
    expect(loadDrinkList().drinks).toHaveLength(SEED_DRINKS.length);
  });

  it('round-trips a saved list', () => {
    const custom: DrinkListState = {
      schemaVersion: 1,
      seedVersion: SEED_VERSION,
      drinks: [{ id: 'uuid-1', name: 'House Pickleback', categoryId: 'shot', enabled: true }],
      removedSeedIds: [],
    };
    expect(saveDrinkList(custom)).toBe('ok');
    expect(loadDrinkList().drinks).toEqual(custom.drinks);
  });
});

describe('poolFor', () => {
  const state = initialDrinkList();

  it('returns only enabled drinks in the selected categories', () => {
    const pool = poolFor(state, ['martini']);
    expect(pool.length).toBeGreaterThanOrEqual(7);
    expect(pool.every((d) => d.categoryId === 'martini' && d.enabled)).toBe(true);
  });

  it('excludes disabled drinks', () => {
    const disabled: DrinkListState = {
      ...state,
      drinks: state.drinks.map((d) => (d.categoryId === 'martini' ? { ...d, enabled: false } : d)),
    };
    expect(poolFor(disabled, ['martini'])).toEqual([]);
  });

  it('returns an empty pool for no selected categories', () => {
    expect(poolFor(state, [])).toEqual([]);
  });
});

describe('categoryMap', () => {
  it('exposes the per-line quantity caps', () => {
    expect(categoryMap().get('shot')?.maxQuantity).toBe(8);
    expect(categoryMap().get('cocktail')?.maxQuantity).toBe(2);
  });
});
