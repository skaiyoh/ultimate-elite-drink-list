import { describe, expect, it } from 'vitest';
import {
  applyImport, buildExport, diffImport, exportFilename, parseImportFile,
} from '@/lib/drinks/transfer';
import { DRINKS_SCHEMA_VERSION } from '@/lib/drinks/schema';
import type { DrinkListState } from '@/lib/drinks/types';

const EXPORTED_AT = Date.UTC(2026, 2, 1, 12, 0);

const state: DrinkListState = {
  schemaVersion: DRINKS_SCHEMA_VERSION,
  seedVersion: 3,
  drinks: [
    { id: 'seed:margarita', name: 'Margarita', categoryId: 'cocktail', enabled: true },
    { id: 'custom-1', name: 'House Punch', categoryId: 'well', enabled: false },
  ],
  removedSeedIds: ['seed:negroni'],
};

function fileOf(state: DrinkListState) {
  return buildExport(state, EXPORTED_AT);
}

/** The round trip a user actually performs: serialise, then read back. */
function roundTrip(state: DrinkListState) {
  const parsed = parseImportFile(JSON.stringify(buildExport(state, EXPORTED_AT)));
  if (!parsed.ok) throw new Error(`expected a valid file, got: ${parsed.reason}`);
  return parsed.file;
}

describe('buildExport', () => {
  it('stamps the file so an import can tell what it is looking at', () => {
    expect(fileOf(state)).toMatchObject({ kind: 'ueddl.drink-list', schemaVersion: DRINKS_SCHEMA_VERSION, exportedAt: EXPORTED_AT });
  });

  it('carries the drinks and the seed deletions', () => {
    expect(fileOf(state).drinks).toEqual(state.drinks);
    expect(fileOf(state).removedSeedIds).toEqual(['seed:negroni']);
  });

  it('leaves out categories, which are code-owned and never travel', () => {
    expect(fileOf(state)).not.toHaveProperty('categories');
  });
});

describe('exportFilename', () => {
  it('names the file by the day it was made', () => {
    expect(exportFilename(EXPORTED_AT, 'UTC')).toBe('ueddl-drinks-2026-03-01.json');
  });
});

describe('parseImportFile', () => {
  it('accepts a file this app wrote', () => {
    const result = parseImportFile(JSON.stringify(fileOf(state)));
    expect(result.ok).toBe(true);
  });

  it('names the problem when the text is not JSON at all', () => {
    const result = parseImportFile('not json {');
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('JSON') });
  });

  it('rejects a JSON file that is not a drink list', () => {
    const result = parseImportFile(JSON.stringify({ hello: 'world' }));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('drink list') });
  });

  it('rejects a file written by a future schema rather than guessing at it', () => {
    const result = parseImportFile(JSON.stringify({ ...fileOf(state), schemaVersion: 99 }));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('99') });
  });

  it('rejects a drink in a category this build does not have', () => {
    const file = { ...fileOf(state), drinks: [{ id: 'x', name: 'X', categoryId: 'tiki', enabled: true }] };
    const result = parseImportFile(JSON.stringify(file));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('tiki') });
  });

  it('rejects a drink missing a field', () => {
    const file = { ...fileOf(state), drinks: [{ id: 'x', name: 'X' }] };
    expect(parseImportFile(JSON.stringify(file)).ok).toBe(false);
  });
});

describe('diffImport', () => {
  const incoming = roundTrip({
    ...state,
    drinks: [
      { id: 'seed:margarita', name: 'Tommys Margarita', categoryId: 'cocktail', enabled: true }, // changed
      { id: 'custom-9', name: 'Paloma', categoryId: 'cocktail', enabled: true },                 // added
    ],
  });

  it('counts what replacing would do, deletions included', () => {
    expect(diffImport(state, incoming, 'replace')).toEqual({ added: 1, changed: 1, removed: 1 });
  });

  it('never reports removals for a merge, which only ever adds or overwrites', () => {
    expect(diffImport(state, incoming, 'merge')).toEqual({ added: 1, changed: 1, removed: 0 });
  });

  it('reports nothing for a file identical to the current list', () => {
    expect(diffImport(state, roundTrip(state), 'replace')).toEqual({ added: 0, changed: 0, removed: 0 });
  });

  it('counts an exclusion as a change, not as a removal', () => {
    const flipped = roundTrip({
      ...state,
      drinks: state.drinks.map((d) => (d.id === 'custom-1' ? { ...d, enabled: true } : d)),
    });
    expect(diffImport(state, flipped, 'replace')).toEqual({ added: 0, changed: 1, removed: 0 });
  });
});

describe('applyImport', () => {
  it('reproduces the list exactly on a replace round trip', () => {
    expect(applyImport(state, roundTrip(state), 'replace')).toEqual(state);
  });

  it('replaces wholesale, dropping drinks the file does not have', () => {
    const incoming = roundTrip({ ...state, drinks: [state.drinks[0]] });
    expect(applyImport(state, incoming, 'replace').drinks.map((d) => d.id)).toEqual(['seed:margarita']);
  });

  it('takes the seed deletions from the file on a replace', () => {
    const incoming = roundTrip({ ...state, removedSeedIds: ['seed:kamikaze'] });
    expect(applyImport(state, incoming, 'replace').removedSeedIds).toEqual(['seed:kamikaze']);
  });

  it('keeps drinks the file omits when merging', () => {
    const incoming = roundTrip({ ...state, drinks: [{ id: 'custom-9', name: 'Paloma', categoryId: 'cocktail', enabled: true }] });
    expect(applyImport(state, incoming, 'merge').drinks.map((d) => d.id))
      .toEqual(['seed:margarita', 'custom-1', 'custom-9']);
  });

  it('lets the file win on a conflicting id when merging', () => {
    const incoming = roundTrip({
      ...state,
      drinks: [{ id: 'custom-1', name: 'Renamed Punch', categoryId: 'martini', enabled: true }],
    });
    const merged = applyImport(state, incoming, 'merge');
    expect(merged.drinks.find((d) => d.id === 'custom-1'))
      .toEqual({ id: 'custom-1', name: 'Renamed Punch', categoryId: 'martini', enabled: true });
  });

  it('unions the seed deletions when merging, so neither side resurrects the other', () => {
    const incoming = roundTrip({ ...state, removedSeedIds: ['seed:kamikaze'] });
    expect(applyImport(state, incoming, 'merge').removedSeedIds).toEqual(['seed:negroni', 'seed:kamikaze']);
  });

  it('keeps the current seed version so a restore is not re-seeded on the next read', () => {
    expect(applyImport(state, roundTrip(state), 'replace').seedVersion).toBe(state.seedVersion);
  });

  it('leaves the current state untouched', () => {
    applyImport(state, roundTrip({ ...state, drinks: [] }), 'replace');
    expect(state.drinks).toHaveLength(2);
  });
});
