import { describe, expect, it, vi } from 'vitest';
import { defaultSessionConfig } from '@/lib/session/config';
import { createSession, sessionReducer, toRecord } from '@/lib/session/machine';
import {
  clearActiveSession, commitSession, loadActiveSession, loadPrefs,
  loadSession, loadSessionIndex, saveActiveSession, savePrefs,
} from '@/lib/session/repository';
import type { TicketLine } from '@/lib/session/types';
import { STORAGE_KEYS } from '@/lib/storage/localStore';

const ticket: TicketLine[] = [{ drinkId: 'a', name: 'A', categoryId: 'shot', quantity: 4 }];
const config = defaultSessionConfig();

describe('active session', () => {
  it('is null when nothing is stored', () => {
    expect(loadActiveSession()).toBeNull();
  });

  it('round-trips a resting session unchanged', () => {
    const state = createSession('s1', 'p1', config, 1_000);
    saveActiveSession(state);
    expect(loadActiveSession()).toEqual(state);
  });

  it('resumes a running session at rest, discarding the in-flight round', () => {
    const running = sessionReducer(createSession('s1', 'p1', config, 0), { type: 'startRound', ticket, at: 5_000 });
    saveActiveSession(running);
    const restored = loadActiveSession();
    expect(restored?.status).toBe('resting');
    expect(restored?.current).toBeNull();
    expect(restored?.rounds).toEqual([]);
  });

  it('preserves rounds already completed before the interruption', () => {
    let state = createSession('s1', 'p1', config, 0);
    state = sessionReducer(state, { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 200_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 210_000 });
    saveActiveSession(state);
    expect(loadActiveSession()?.rounds).toHaveLength(1);
  });

  it('returns null for corrupt stored data', () => {
    window.localStorage.setItem('ueddl:v1:active-session', '{"status":"weird"}');
    expect(loadActiveSession()).toBeNull();
  });

  it('clears', () => {
    saveActiveSession(createSession('s1', 'p1', config, 0));
    clearActiveSession();
    expect(loadActiveSession()).toBeNull();
  });
});

describe('committed sessions', () => {
  const record = toRecord(createSession('s1', 'p1', config, 1_000));

  it('writes the session and indexes it under its profile', () => {
    commitSession(record);
    expect(loadSessionIndex('p1')).toEqual(['s1']);
    expect(loadSession('s1')).toEqual(record);
  });

  it('puts the newest session first', () => {
    commitSession(record);
    commitSession({ ...record, id: 's2', startedAt: 2_000 });
    expect(loadSessionIndex('p1')).toEqual(['s2', 's1']);
  });

  it('never indexes the same session twice', () => {
    commitSession(record);
    commitSession(record);
    expect(loadSessionIndex('p1')).toEqual(['s1']);
  });

  it('keeps each profile index separate', () => {
    commitSession(record);
    commitSession({ ...record, id: 's9', profileId: 'p2' });
    expect(loadSessionIndex('p1')).toEqual(['s1']);
    expect(loadSessionIndex('p2')).toEqual(['s9']);
  });

  it('returns null for an unknown session id', () => {
    expect(loadSession('nope')).toBeNull();
  });

  it('leaves no orphaned record behind when the index write fails', () => {
    // Spied on the prototype, not the instance: jsdom's Storage is proxy-backed,
    // so defining `setItem` on the instance is treated as storing an item under
    // that name and never shadows the method.
    const real = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === STORAGE_KEYS.sessionIndex('p1')) {
        const error = new Error('full');
        error.name = 'QuotaExceededError';
        throw error;
      }
      real.call(this, key, value);
    });

    const outcome = commitSession(record);
    spy.mockRestore();

    // A record the index cannot reach is invisible in history forever, which is
    // worse than a clean failure: the caller keeps its crash-recovery backup
    // only when it learns the commit failed.
    expect(outcome).toBe('quota');
    expect(loadSessionIndex('p1')).toEqual([]);
    expect(loadSession('s1')).toBeNull();
  });
});

describe('prefs', () => {
  it('round-trips a session config per profile', () => {
    const custom = { ...config, roundCount: 10, goalMs: 180_000 };
    savePrefs('p1', custom);
    expect(loadPrefs('p1')).toEqual(custom);
    expect(loadPrefs('p2')).toBeNull();
  });

  it('returns null for corrupt prefs', () => {
    window.localStorage.setItem('ueddl:v1:profile:p1:prefs', '{"roundCount":"five"}');
    expect(loadPrefs('p1')).toBeNull();
  });
});
