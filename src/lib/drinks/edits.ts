import type { CategoryId, Drink, DrinkId, DrinkListState } from '@/lib/drinks/types';

/**
 * Every edit the /drinks screen can make, as pure transforms on the list.
 * Each returns a new state; an edit with nothing to do returns the state it
 * was given, so a caller can skip a write by identity.
 */

/** Seed ids are permanent, so this is how a deletion is told apart from a rename. */
function isSeed(id: DrinkId): boolean {
  return id.startsWith('seed:');
}

function mapDrink(
  state: DrinkListState, id: DrinkId, change: (drink: Drink) => Drink,
): DrinkListState {
  return { ...state, drinks: state.drinks.map((drink) => (drink.id === id ? change(drink) : drink)) };
}

export function addDrink(
  state: DrinkListState, id: DrinkId, name: string, categoryId: CategoryId,
): DrinkListState {
  const trimmed = name.trim();
  if (trimmed === '') return state;

  return { ...state, drinks: [...state.drinks, { id, name: trimmed, categoryId, enabled: true }] };
}

/** The id never changes: past sessions and `removedSeedIds` both key on it. */
export function renameDrink(state: DrinkListState, id: DrinkId, name: string): DrinkListState {
  const trimmed = name.trim();
  if (trimmed === '') return state;

  return mapDrink(state, id, (drink) => ({ ...drink, name: trimmed }));
}

export function recategorizeDrink(
  state: DrinkListState, id: DrinkId, categoryId: CategoryId,
): DrinkListState {
  return mapDrink(state, id, (drink) => ({ ...drink, categoryId }));
}

/** Off is excluded: kept in the data, hidden from every deal. The control on
 *  /drinks reads Exclude / Include; the trade's word for it is 86. */
export function setDrinkEnabled(state: DrinkListState, id: DrinkId, enabled: boolean): DrinkListState {
  return mapDrink(state, id, (drink) => ({ ...drink, enabled }));
}

export function deleteDrink(state: DrinkListState, id: DrinkId): DrinkListState {
  const tombstone = isSeed(id) && !state.removedSeedIds.includes(id);

  return {
    ...state,
    drinks: state.drinks.filter((drink) => drink.id !== id),
    // Only seed ids need remembering: nothing re-adds a user's own drink, so a
    // tombstone for one would grow the file forever and protect against nothing.
    removedSeedIds: tombstone ? [...state.removedSeedIds, id] : state.removedSeedIds,
  };
}
