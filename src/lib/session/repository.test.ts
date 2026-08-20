import { describe, expect, it } from 'vitest';
import { defaultSessionConfig } from '@/lib/session/config';
import { createSession, sessionReducer, toRecord } from '@/lib/session/machine';
import {
  clearActiveSession, commitSession, loadActiveSession, loadPrefs,
  loadSession, loadSessionIndex, saveActiveSession, savePrefs,
} from '@/lib/session/repository';
import type { TicketLine } from '@/lib/session/types';

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
