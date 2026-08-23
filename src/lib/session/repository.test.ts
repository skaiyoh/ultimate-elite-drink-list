import { describe, expect, it } from 'vitest';
import { defaultSessionConfig } from '@/lib/session/config';
import { createSession, sessionReducer, toRecord } from '@/lib/session/machine';
import {
  clearActiveSession, clearLastRun, loadActiveSession, loadLastRun,
  loadPrefs, saveActiveSession, saveLastRun, savePrefs,
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
    const state = createSession('s1', config, 1_000);
    saveActiveSession(state);
    expect(loadActiveSession()).toEqual(state);
  });

  it('resumes a running session at rest, discarding the in-flight round', () => {
    const running = sessionReducer(createSession('s1', config, 0), { type: 'startRound', ticket, at: 5_000 });
    saveActiveSession(running);
    const restored = loadActiveSession();
    expect(restored?.status).toBe('resting');
    expect(restored?.current).toBeNull();
    expect(restored?.rounds).toEqual([]);
  });

  it('preserves rounds already completed before the interruption', () => {
    let state = createSession('s1', config, 0);
    state = sessionReducer(state, { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 200_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 210_000 });
    saveActiveSession(state);
    expect(loadActiveSession()?.rounds).toHaveLength(1);
  });

  it('resumes a session stored by the profile-era build, dropping its profileId', () => {
    // Spec §9 promises this rather than merely tolerating it: someone mid-drill
    // when the app updates keeps their session. The guarantee rests entirely on
    // Zod object schemas stripping unknown keys, so a later pass that tightened
    // these to `.strict()` would break a documented promise with nothing red to
    // show for it.
    const state = createSession('s1', config, 1_000);
    window.localStorage.setItem(
      STORAGE_KEYS.activeSession,
      JSON.stringify({ ...state, profileId: 'p1' }),
    );

    const restored = loadActiveSession();
    expect(restored).toEqual(state);
    expect(restored).not.toHaveProperty('profileId');
  });

  it('returns null for corrupt stored data', () => {
    window.localStorage.setItem('ueddl:v1:active-session', '{"status":"weird"}');
    expect(loadActiveSession()).toBeNull();
  });

  it('clears', () => {
    saveActiveSession(createSession('s1', config, 0));
    clearActiveSession();
    expect(loadActiveSession()).toBeNull();
  });
});

describe('prefs', () => {
  it('round-trips a session config for the device', () => {
    const custom = { ...config, roundCount: 10, goalMs: 180_000 };
    savePrefs(custom);
    expect(loadPrefs()).toEqual(custom);
  });

  it('returns null for corrupt prefs', () => {
    window.localStorage.setItem(STORAGE_KEYS.prefs, '{"roundCount":"five"}');
    expect(loadPrefs()).toBeNull();
  });
});

describe('last run', () => {
  const record = toRecord(createSession('s1', config, 1_000));

  it('is null before anything has been run', () => {
    expect(loadLastRun()).toBeNull();
  });

  it('round-trips a finished run', () => {
    saveLastRun(record);
    expect(loadLastRun()).toEqual(record);
  });

  it('keeps only the most recent run', () => {
    saveLastRun(record);
    saveLastRun({ ...record, id: 's2', startedAt: 2_000 });

    const loaded = loadLastRun();
    expect(loaded?.id).toBe('s2');
    expect(loaded?.startedAt).toBe(2_000);
  });

  it('reads a corrupt run as absent rather than throwing', () => {
    window.localStorage.setItem(STORAGE_KEYS.lastRun, '{"id":"s1","rounds":"lots"}');
    expect(loadLastRun()).toBeNull();
  });

  it('clears', () => {
    saveLastRun(record);
    clearLastRun();
    expect(loadLastRun()).toBeNull();
  });

  it('reports a successful write', () => {
    expect(saveLastRun(record)).toBe('ok');
  });
});
