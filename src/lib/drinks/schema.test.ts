import { describe, expect, it } from 'vitest';
import { SEED_CATEGORIES, SEED_DRINKS } from '@/data/seed-drinks';
import { DRINKS_PER_ROUND, parseDrinkListState } from '@/lib/drinks/schema';

describe('seed data integrity', () => {
  it('has no duplicate ids', () => {
    const ids = SEED_DRINKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate names, case-insensitively', () => {
    const names = SEED_DRINKS.map((d) => d.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('never names two builds in one line, which is ambiguous mid-round', () => {
    // A ticket line has to identify exactly one drink to make. "Vodka or Gin"
    // asks the bartender to make a choice while the clock is running.
    const ambiguous = SEED_DRINKS.filter((d) => / or /i.test(d.name));
    expect(ambiguous.map((d) => d.name)).toEqual([]);
  });

  it('uses only namespaced seed ids', () => {
    const malformed = SEED_DRINKS.filter((d) => !/^seed:[a-z0-9-]+$/.test(d.id));
    expect(malformed).toEqual([]);
  });

  it('gives every category enough drinks to deal a filtered round', () => {
    for (const category of SEED_CATEGORIES) {
      const count = SEED_DRINKS.filter((d) => d.categoryId === category.id).length;
      expect(count, `${category.id} has ${count} drinks`).toBeGreaterThanOrEqual(DRINKS_PER_ROUND);
    }
  });

  it('caps shots at 8 and everything else at 2', () => {
    for (const category of SEED_CATEGORIES) {
      expect(category.maxQuantity).toBe(category.id === 'shot' ? 8 : 2);
    }
  });
});

describe('parseDrinkListState', () => {
  const valid = {
    schemaVersion: 1,
    seedVersion: 1,
    drinks: [{ id: 'seed:green-tea-shot', name: 'Green Tea Shot', categoryId: 'shot', enabled: true }],
    removedSeedIds: ['seed:orgasm'],
  };

  it('accepts a well-formed state', () => {
    expect(parseDrinkListState(valid)).toEqual(valid);
  });

  it('rejects an unknown categoryId', () => {
    expect(parseDrinkListState({ ...valid, drinks: [{ ...valid.drinks[0], categoryId: 'beer' }] })).toBeNull();
  });

  it('rejects a wrong schemaVersion', () => {
    expect(parseDrinkListState({ ...valid, schemaVersion: 99 })).toBeNull();
  });

  it.each([null, undefined, 42, 'nope', [], {}])('rejects %p', (input) => {
    expect(parseDrinkListState(input)).toBeNull();
  });

  it('rejects a drink with an empty name', () => {
    expect(parseDrinkListState({ ...valid, drinks: [{ ...valid.drinks[0], name: '' }] })).toBeNull();
  });
});
