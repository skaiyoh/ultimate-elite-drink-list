import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS, isPersistent, readValue, removeValue, writeValue } from '@/lib/storage/localStore';

const asNumber = (raw: unknown): number | null => (typeof raw === 'number' ? raw : null);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('STORAGE_KEYS', () => {
  it('namespaces every key under ueddl:v1', () => {
    expect(STORAGE_KEYS.drinks).toBe('ueddl:v1:drinks');
    expect(STORAGE_KEYS.prefs('p1')).toBe('ueddl:v1:profile:p1:prefs');
    expect(STORAGE_KEYS.sessionIndex('p1')).toBe('ueddl:v1:profile:p1:session-index');
    expect(STORAGE_KEYS.session('s1')).toBe('ueddl:v1:session:s1');
  });
});

describe('readValue', () => {
  it('returns null for a missing key', () => {
    expect(readValue('ueddl:v1:missing', asNumber)).toBeNull();
  });

  it('round-trips a written value', () => {
    writeValue('ueddl:v1:n', 42);
    expect(readValue('ueddl:v1:n', asNumber)).toBe(42);
  });

  it('returns null for unparseable JSON without throwing', () => {
    window.localStorage.setItem('ueddl:v1:bad', '{not json');
    expect(readValue('ueddl:v1:bad', asNumber)).toBeNull();
  });

  it('returns null when the validator rejects the value', () => {
    writeValue('ueddl:v1:n', 'a string');
    expect(readValue('ueddl:v1:n', asNumber)).toBeNull();
  });
});

describe('writeValue', () => {
  it('reports quota exhaustion instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; },
      removeItem: () => {},
    });
    expect(writeValue('ueddl:v1:n', 1)).toBe('quota');
  });

  it('falls back to memory when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    });
    expect(writeValue('ueddl:v1:n', 7)).toBe('unavailable');
    expect(readValue('ueddl:v1:n', asNumber)).toBe(7);
    expect(isPersistent()).toBe(false);
  });
});

describe('removeValue', () => {
  it('deletes a stored value', () => {
    writeValue('ueddl:v1:n', 1);
    removeValue('ueddl:v1:n');
    expect(readValue('ueddl:v1:n', asNumber)).toBeNull();
  });
});
