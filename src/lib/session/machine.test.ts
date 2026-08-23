import { describe, expect, it } from 'vitest';
import { defaultSessionConfig } from '@/lib/session/config';
import { createSession, elapsedMs, sessionReducer, toRecord } from '@/lib/session/machine';
import type { TicketLine } from '@/lib/session/types';

const ticket: TicketLine[] = [
  { drinkId: 'a', name: 'A', categoryId: 'shot', quantity: 4 },
  { drinkId: 'b', name: 'B', categoryId: 'martini', quantity: 2 },
];

const config = { ...defaultSessionConfig(), roundCount: 2 };
const fresh = () => createSession('s1', config, 1_000);

describe('createSession', () => {
  it('starts resting with no rounds', () => {
    const state = fresh();
    expect(state.status).toBe('resting');
    expect(state.current).toBeNull();
    expect(state.rounds).toEqual([]);
    expect(state.completedAt).toBeNull();
  });
});

describe('startRound', () => {
  it('opens round 0 and records the total units', () => {
    const state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 2_000 });
    expect(state.status).toBe('running');
    expect(state.current).toMatchObject({ index: 0, startedAt: 2_000, pausedMs: 0, pausedAt: null, totalUnits: 6 });
  });

  it('is ignored while a round is already running', () => {
    const running = sessionReducer(fresh(), { type: 'startRound', ticket, at: 2_000 });
    expect(sessionReducer(running, { type: 'startRound', ticket, at: 3_000 })).toBe(running);
  });
});

describe('pause and resume', () => {
  const running = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });

  it('freezes the clock while paused', () => {
    const paused = sessionReducer(running, { type: 'pause', at: 10_000 });
    expect(paused.status).toBe('paused');
    expect(elapsedMs(paused.current!, 99_000)).toBe(10_000);
  });

  it('excludes the paused span after resuming', () => {
    const paused = sessionReducer(running, { type: 'pause', at: 10_000 });
    const resumed = sessionReducer(paused, { type: 'resume', at: 40_000 });
    expect(resumed.status).toBe('running');
    expect(resumed.current!.pausedMs).toBe(30_000);
    expect(elapsedMs(resumed.current!, 50_000)).toBe(20_000);
  });

  it('ignores pause while resting and resume while running', () => {
    const resting = fresh();
    expect(sessionReducer(resting, { type: 'pause', at: 1 })).toBe(resting);
    expect(sessionReducer(running, { type: 'resume', at: 1 })).toBe(running);
  });
});

describe('advance', () => {
  it('records the round and returns to resting', () => {
    const running = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    const rested = sessionReducer(running, { type: 'advance', at: 200_000 });
    expect(rested.status).toBe('resting');
    expect(rested.current).toBeNull();
    expect(rested.rounds).toHaveLength(1);
    expect(rested.rounds[0]).toMatchObject({ index: 0, startedAt: 0, endedAt: 200_000, pausedMs: 0, durationMs: 200_000, totalUnits: 6 });
  });

  it('subtracts paused time from the recorded duration', () => {
    let state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'pause', at: 50_000 });
    state = sessionReducer(state, { type: 'resume', at: 80_000 });
    state = sessionReducer(state, { type: 'advance', at: 230_000 });
    expect(state.rounds[0].durationMs).toBe(200_000);
    expect(state.rounds[0].pausedMs).toBe(30_000);
  });

  it('settles an unresumed pause when advancing straight from paused', () => {
    let state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'pause', at: 60_000 });
    state = sessionReducer(state, { type: 'advance', at: 100_000 });
    expect(state.rounds[0].pausedMs).toBe(40_000);
    expect(state.rounds[0].durationMs).toBe(60_000);
  });

  it('completes the session after the configured round count', () => {
    let state = fresh();
    state = sessionReducer(state, { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 100_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 150_000 });
    state = sessionReducer(state, { type: 'advance', at: 350_000 });
    expect(state.status).toBe('complete');
    expect(state.completedAt).toBe(350_000);
    expect(state.rounds).toHaveLength(2);
  });

  it('is ignored while resting', () => {
    const resting = fresh();
    expect(sessionReducer(resting, { type: 'advance', at: 1 })).toBe(resting);
  });

  it('clamps durationMs to zero rather than negative when at precedes startedAt', () => {
    // A backwards wall-clock jump (NTP step, manual clock change) must not
    // silently produce a "negative" round. The clamp turns it into an
    // implausibly SHORT round instead — not correct, but at least intentional
    // and pinned by this test rather than an accident. See spec §7.
    const running = sessionReducer(fresh(), { type: 'startRound', ticket, at: 100_000 });
    const rested = sessionReducer(running, { type: 'advance', at: 50_000 });
    expect(rested.rounds[0].durationMs).toBe(0);
  });
});

describe('end', () => {
  it('abandons with a null completedAt and discards the in-flight round', () => {
    let state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 100_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 120_000 });
    const ended = sessionReducer(state, { type: 'end', at: 200_000 });
    expect(ended.status).toBe('complete');
    expect(ended.completedAt).toBeNull();
    expect(ended.rounds).toHaveLength(1);
    expect(ended.current).toBeNull();
  });

  it('never un-completes a finished session', () => {
    let state = fresh();
    state = sessionReducer(state, { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 100_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 150_000 });
    const done = sessionReducer(state, { type: 'advance', at: 350_000 });
    expect(sessionReducer(done, { type: 'end', at: 400_000 })).toBe(done);
  });
});

describe('toRecord', () => {
  it('drops runtime-only fields', () => {
    const state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    const record = toRecord(sessionReducer(state, { type: 'advance', at: 100_000 }));
    expect(record).toEqual({
      id: 's1', startedAt: 1_000, completedAt: null,
      config, rounds: expect.any(Array),
    });
    expect(record).not.toHaveProperty('current');
    expect(record).not.toHaveProperty('status');
  });
});
