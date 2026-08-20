import { describe, expect, it } from 'vitest';
import { defaultSessionConfig } from '@/lib/session/config';
import {
  lifetimeTotals, personalBests, roundBars, sessionSeries,
} from '@/lib/session/stats';
import type { DifficultyId, RoundRecord, SessionConfig, SessionRecord } from '@/lib/session/types';

const GOAL = 240_000;

function round(index: number, durationMs: number, totalUnits = 12): RoundRecord {
  return {
    index,
    ticket: [{ drinkId: 'a', name: 'A', categoryId: 'shot', quantity: totalUnits }],
    totalUnits,
    startedAt: index * 1_000_000,
    endedAt: index * 1_000_000 + durationMs,
    pausedMs: 0,
    durationMs,
  };
}

interface SessionOptions {
  readonly id: string;
  readonly startedAt: number;
  readonly durations: readonly number[];
  readonly completed?: boolean;
  readonly difficultyId?: DifficultyId;
  readonly goalMs?: number;
  readonly units?: number;
}

/** History is newest-first, the order `loadHistory` returns. */
function history(...sessions: readonly SessionOptions[]): SessionRecord[] {
  return sessions
    .map((options): SessionRecord => {
      const config: SessionConfig = {
        ...defaultSessionConfig(),
        difficultyId: options.difficultyId ?? 'standard',
        goalMs: options.goalMs ?? GOAL,
      };
      return {
        id: options.id,
        profileId: 'p1',
        startedAt: options.startedAt,
        completedAt: (options.completed ?? true) ? options.startedAt + 1 : null,
        config,
        rounds: options.durations.map((ms, i) => round(i, ms, options.units ?? 12)),
      };
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

describe('lifetimeTotals', () => {
  it('is all zeroes for an empty history', () => {
    expect(lifetimeTotals([])).toEqual({ sessions: 0, rounds: 0, drinks: 0 });
  });

  it('sums sessions, rounds, and drinks made', () => {
    const records = history(
      { id: 's1', startedAt: 1_000, durations: [100, 200], units: 10 },
      { id: 's2', startedAt: 2_000, durations: [300], units: 14 },
    );
    expect(lifetimeTotals(records)).toEqual({ sessions: 2, rounds: 3, drinks: 34 });
  });

  it('counts rounds from abandoned sessions — those drinks were still made', () => {
    const records = history({ id: 's1', startedAt: 1_000, durations: [100], units: 9, completed: false });
    expect(lifetimeTotals(records)).toEqual({ sessions: 1, rounds: 1, drinks: 9 });
  });
});

describe('sessionSeries', () => {
  it('is empty for an empty history', () => {
    expect(sessionSeries([])).toEqual([]);
  });

  it('runs oldest to newest so it reads left to right on a time axis', () => {
    const records = history(
      { id: 'old', startedAt: 1_000, durations: [100] },
      { id: 'new', startedAt: 9_000, durations: [200] },
    );
    expect(sessionSeries(records).map((p) => p.sessionId)).toEqual(['old', 'new']);
  });

  it('averages each session over its own rounds', () => {
    const records = history({ id: 's1', startedAt: 1_000, durations: [100_000, 200_000] });
    expect(sessionSeries(records)[0].averageMs).toBe(150_000);
  });

  it('excludes abandoned sessions from the trend', () => {
    const records = history(
      { id: 'kept', startedAt: 1_000, durations: [100] },
      { id: 'abandoned', startedAt: 2_000, durations: [100], completed: false },
    );
    expect(sessionSeries(records).map((p) => p.sessionId)).toEqual(['kept']);
  });

  it('excludes a completed session that recorded no rounds', () => {
    const records = history({ id: 'empty', startedAt: 1_000, durations: [] });
    expect(sessionSeries(records)).toEqual([]);
  });

  it('paces on total time over total units, not the mean of per-round rates', () => {
    // 60s over 12 units, then 120s over 12 units: 180s / 24 units = 7.5s per unit.
    const records = history({ id: 's1', startedAt: 1_000, durations: [60_000, 120_000], units: 12 });
    expect(sessionSeries(records)[0].secondsPerUnit).toBe(7.5);
  });

  it('carries the goal and difficulty each session was actually run at', () => {
    const records = history({ id: 's1', startedAt: 1_000, durations: [100], difficultyId: 'rush', goalMs: 300_000 });
    expect(sessionSeries(records)[0]).toMatchObject({ difficultyId: 'rush', goalMs: 300_000 });
  });
});

describe('roundBars', () => {
  it('returns every round of the most recent sessions, oldest first', () => {
    const records = history(
      { id: 'old', startedAt: 1_000, durations: [10, 20] },
      { id: 'new', startedAt: 2_000, durations: [30] },
    );
    expect(roundBars(records, 5).map((b) => [b.sessionId, b.roundIndex])).toEqual([
      ['old', 0], ['old', 1], ['new', 0],
    ]);
  });

  it('keeps only the most recent N sessions', () => {
    const records = history(
      { id: 's1', startedAt: 1_000, durations: [10] },
      { id: 's2', startedAt: 2_000, durations: [20] },
      { id: 's3', startedAt: 3_000, durations: [30] },
    );
    expect(roundBars(records, 2).map((b) => b.sessionId)).toEqual(['s2', 's3']);
  });

  it('marks each round against the goal of its own session', () => {
    const records = history(
      { id: 's1', startedAt: 1_000, durations: [GOAL, GOAL + 1] },
    );
    expect(roundBars(records, 5).map((b) => b.verdict)).toEqual(['pass', 'miss']);
  });

  it('includes rounds from abandoned sessions — they were run and timed', () => {
    const records = history({ id: 's1', startedAt: 1_000, durations: [10], completed: false });
    expect(roundBars(records, 5)).toHaveLength(1);
  });
});

describe('personalBests', () => {
  it('has nothing to report for an empty history', () => {
    expect(personalBests([])).toEqual({ byDifficulty: [], bestRound: null, longestPassStreak: 0 });
  });

  it('picks the lowest session average for each difficulty separately', () => {
    const records = history(
      { id: 'slow-standard', startedAt: 1_000, durations: [200_000] },
      { id: 'fast-standard', startedAt: 2_000, durations: [100_000] },
      { id: 'rush', startedAt: 3_000, durations: [400_000], difficultyId: 'rush' },
    );
    expect(personalBests(records).byDifficulty).toEqual([
      { difficultyId: 'standard', sessionId: 'fast-standard', averageMs: 100_000 },
      { difficultyId: 'rush', sessionId: 'rush', averageMs: 400_000 },
    ]);
  });

  it('ignores abandoned sessions when picking bests', () => {
    const records = history(
      { id: 'kept', startedAt: 1_000, durations: [200_000] },
      { id: 'abandoned', startedAt: 2_000, durations: [1_000], completed: false },
    );
    expect(personalBests(records).byDifficulty).toEqual([
      { difficultyId: 'standard', sessionId: 'kept', averageMs: 200_000 },
    ]);
  });

  it('finds the fastest single round by seconds per unit, not by raw time', () => {
    const records = history(
      { id: 'short-round', startedAt: 1_000, durations: [60_000], units: 6 },   // 10s per unit
      { id: 'long-round', startedAt: 2_000, durations: [120_000], units: 24 },  // 5s per unit
    );
    expect(personalBests(records).bestRound).toMatchObject({ sessionId: 'long-round', secondsPerUnit: 5 });
  });

  it('counts the longest run of consecutive rounds at or under goal', () => {
    const records = history({
      id: 's1',
      startedAt: 1_000,
      // An early run of 2, then a longer run of 4. Counting every pass would
      // give 6; keeping only the first run would give 2.
      durations: [GOAL, GOAL, GOAL + 1, GOAL, GOAL, GOAL, GOAL, GOAL + 1],
    });
    expect(personalBests(records).longestPassStreak).toBe(4);
  });

  it('carries a streak across session boundaries', () => {
    const records = history(
      { id: 'first', startedAt: 1_000, durations: [GOAL, GOAL] },
      { id: 'second', startedAt: 2_000, durations: [GOAL] },
    );
    expect(personalBests(records).longestPassStreak).toBe(3);
  });

  it('reports no streak when every round missed', () => {
    const records = history({ id: 's1', startedAt: 1_000, durations: [GOAL + 1, GOAL + 1] });
    expect(personalBests(records).longestPassStreak).toBe(0);
  });
});
