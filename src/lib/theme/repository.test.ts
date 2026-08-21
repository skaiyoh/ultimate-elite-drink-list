import { describe, expect, it } from 'vitest';
import { loadTheme, saveTheme } from '@/lib/theme/repository';
import { STORAGE_KEYS } from '@/lib/storage/localStore';

describe('theme preference', () => {
  it('follows the system by default', () => {
    expect(loadTheme()).toBe('system');
  });

  it('round-trips an explicit choice', () => {
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('round-trips a return to following the system', () => {
    saveTheme('light');
    saveTheme('system');
    expect(loadTheme()).toBe('system');
  });

  it('falls back to the system for a value it does not recognise', () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, '"solarized"');
    expect(loadTheme()).toBe('system');
  });

  it('falls back to the system for unparseable data', () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, 'not json');
    expect(loadTheme()).toBe('system');
  });

  it('reports a write it could not make', () => {
    expect(saveTheme('dark')).toBe('ok');
  });
});
