import { describe, expect, it } from 'vitest';
import { addDrink, deleteDrink, recategorizeDrink, renameDrink, setDrinkEnabled } from '@/lib/drinks/edits';
import { DRINKS_SCHEMA_VERSION } from '@/lib/drinks/schema';
import type { DrinkListState } from '@/lib/drinks/types';

const state: DrinkListState = {
  schemaVersion: DRINKS_SCHEMA_VERSION,
  seedVersion: 1,
  drinks: [
    { id: 'seed:margarita', name: 'Margarita', categoryId: 'cocktail', enabled: true },
    { id: 'custom-1', name: 'House Punch', categoryId: 'well', enabled: true },
  ],
  removedSeedIds: [],
};

describe('addDrink', () => {
  it('appends a new drink', () => {
    const next = addDrink(state, 'custom-2', 'Paloma', 'cocktail');
    expect(next.drinks.at(-1)).toEqual({ id: 'custom-2', name: 'Paloma', categoryId: 'cocktail', enabled: true });
  });

  it('leaves the original untouched', () => {
    addDrink(state, 'custom-2', 'Paloma', 'cocktail');
    expect(state.drinks).toHaveLength(2);
  });

  it('trims surrounding whitespace off the name', () => {
    expect(addDrink(state, 'custom-2', '  Paloma  ', 'cocktail').drinks.at(-1)?.name).toBe('Paloma');
  });

  it('refuses a blank name rather than adding an unnameable line to a ticket', () => {
    expect(addDrink(state, 'custom-2', '   ', 'cocktail')).toBe(state);
  });
});

describe('renameDrink', () => {
  it('renames in place, keeping the id a stored run refers to', () => {
    const next = renameDrink(state, 'seed:margarita', 'Tommys Margarita');
    expect(next.drinks[0]).toEqual({
      id: 'seed:margarita', name: 'Tommys Margarita', categoryId: 'cocktail', enabled: true,
    });
  });

  it('ignores a blank name rather than erasing one', () => {
    expect(renameDrink(state, 'seed:margarita', '  ')).toBe(state);
  });

  it('ignores an unknown id', () => {
    expect(renameDrink(state, 'nope', 'X').drinks).toEqual(state.drinks);
  });
});

describe('recategorizeDrink', () => {
  it('moves a drink to another category', () => {
    expect(recategorizeDrink(state, 'custom-1', 'cocktail').drinks[1].categoryId).toBe('cocktail');
  });
});

describe('setDrinkEnabled', () => {
  it("86's a drink without removing it", () => {
    const next = setDrinkEnabled(state, 'custom-1', false);
    expect(next.drinks[1].enabled).toBe(false);
    expect(next.drinks).toHaveLength(2);
  });

  it('puts it back on', () => {
    const off = setDrinkEnabled(state, 'custom-1', false);
    expect(setDrinkEnabled(off, 'custom-1', true).drinks[1].enabled).toBe(true);
  });
});

describe('deleteDrink', () => {
  it('removes the drink', () => {
    expect(deleteDrink(state, 'custom-1').drinks.map((d) => d.id)).toEqual(['seed:margarita']);
  });

  it('remembers a deleted seed drink so a later seed update cannot resurrect it', () => {
    expect(deleteDrink(state, 'seed:margarita').removedSeedIds).toEqual(['seed:margarita']);
  });

  it('does not tombstone a user-added drink — nothing would ever re-add it', () => {
    expect(deleteDrink(state, 'custom-1').removedSeedIds).toEqual([]);
  });

  it('never lists the same seed id twice', () => {
    const once = deleteDrink(state, 'seed:margarita');
    expect(deleteDrink(once, 'seed:margarita').removedSeedIds).toEqual(['seed:margarita']);
  });
});
