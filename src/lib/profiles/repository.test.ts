import { describe, expect, it } from 'vitest';
import {
  addProfile, loadActiveProfileId, loadProfiles, removeProfile,
  renameProfile, saveActiveProfileId, saveProfiles,
} from '@/lib/profiles/repository';
import type { Profile } from '@/lib/profiles/types';

const base: Profile[] = [
  { id: 'p1', name: 'Nathan', createdAt: 1000 },
  { id: 'p2', name: 'Sam', createdAt: 2000 },
];

describe('pure list operations', () => {
  it('appends a profile without mutating the input', () => {
    const next = addProfile(base, 'Alex', 'p3', 3000);
    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({ id: 'p3', name: 'Alex', createdAt: 3000 });
    expect(base).toHaveLength(2);
  });

  it('trims whitespace from a new name', () => {
    expect(addProfile([], '  Alex  ', 'p1', 1)[0].name).toBe('Alex');
  });

  it('renames by id and leaves others untouched', () => {
    const next = renameProfile(base, 'p1', 'Nate');
    expect(next[0].name).toBe('Nate');
    expect(next[1]).toEqual(base[1]);
    expect(base[0].name).toBe('Nathan');
  });

  it('ignores a rename for an unknown id', () => {
    expect(renameProfile(base, 'nope', 'X')).toEqual(base);
  });

  it('removes by id', () => {
    expect(removeProfile(base, 'p1')).toEqual([base[1]]);
  });
});

describe('persistence', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadProfiles()).toEqual([]);
  });

  it('round-trips profiles', () => {
    saveProfiles(base);
    expect(loadProfiles()).toEqual(base);
  });

  it('returns an empty list when stored data is corrupt', () => {
    window.localStorage.setItem('ueddl:v1:profiles', '[{"id":1}]');
    expect(loadProfiles()).toEqual([]);
  });

  it('round-trips the active profile id and clears it with null', () => {
    saveActiveProfileId('p1');
    expect(loadActiveProfileId()).toBe('p1');
    saveActiveProfileId(null);
    expect(loadActiveProfileId()).toBeNull();
  });
});
