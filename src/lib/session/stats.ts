import { DIFFICULTIES } from '@/lib/session/config';
import { averageMs, secondsPerUnit as roundSecondsPerUnit, verdict } from '@/lib/session/metrics';
import type { DifficultyId, RoundRecord, SessionRecord } from '@/lib/session/types';

export interface LifetimeTotals {
  readonly sessions: number;
  readonly rounds: number;
  readonly drinks: number;
}

/** One completed session, reduced to the numbers both the trend and pace charts plot. */
export interface SessionPoint {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly averageMs: number;
  readonly secondsPerUnit: number;
  readonly goalMs: number;
  readonly difficultyId: DifficultyId;
}

export interface RoundBar {
  readonly sessionId: string;
  readonly roundIndex: number;
  readonly durationMs: number;
  readonly goalMs: number;
  readonly verdict: 'pass' | 'miss';
}

export interface DifficultyBest {
  readonly difficultyId: DifficultyId;
  readonly sessionId: string;
  readonly averageMs: number;
}

export interface RoundBest {
  readonly sessionId: string;
  readonly roundIndex: number;
  readonly durationMs: number;
  readonly totalUnits: number;
  readonly secondsPerUnit: number;
}

export interface PersonalBests {
  readonly byDifficulty: readonly DifficultyBest[];
  readonly bestRound: RoundBest | null;
  readonly longestPassStreak: number;
}

/**
 * Abandoned sessions are excluded from averages, trends and bests (spec §9):
 * a session cut short says nothing about how fast the rounds it never ran were.
 */
function completed(history: readonly SessionRecord[]): SessionRecord[] {
  return history.filter((session) => session.completedAt !== null);
}

/** History arrives newest-first; charts read left to right, so oldest-first. */
function chronological(sessions: readonly SessionRecord[]): SessionRecord[] {
  return [...sessions].sort((a, b) => a.startedAt - b.startedAt);
}

function unitsIn(rounds: readonly RoundRecord[]): number {
  return rounds.reduce((sum, round) => sum + round.totalUnits, 0);
}

/**
 * Counts every session in history, abandoned ones included. Unlike an average,
 * a total is a record of work done — rounds inside an abandoned session were
 * still run, and those drinks were still made.
 */
export function lifetimeTotals(history: readonly SessionRecord[]): LifetimeTotals {
  return history.reduce<LifetimeTotals>(
    (totals, session) => ({
      sessions: totals.sessions + 1,
      rounds: totals.rounds + session.rounds.length,
      drinks: totals.drinks + unitsIn(session.rounds),
    }),
    { sessions: 0, rounds: 0, drinks: 0 },
  );
}

/**
 * One point per completed session that recorded at least one round, oldest first.
 *
 * `secondsPerUnit` is total time over total units rather than the mean of each
 * round's rate, so a short round cannot weigh as heavily as a long one.
 */
export function sessionSeries(history: readonly SessionRecord[]): SessionPoint[] {
  return chronological(completed(history))
    .map((session): SessionPoint | null => {
      const average = averageMs(session.rounds);
      if (average === null) return null;

      const units = unitsIn(session.rounds);
      const totalMs = session.rounds.reduce((sum, round) => sum + round.durationMs, 0);
      return {
        sessionId: session.id,
        startedAt: session.startedAt,
        averageMs: average,
        secondsPerUnit: units === 0 ? 0 : totalMs / 1000 / units,
        goalMs: session.config.goalMs,
        difficultyId: session.config.difficultyId,
      };
    })
    .filter((point): point is SessionPoint => point !== null);
}

/**
 * Every round of the most recent `limit` sessions, oldest first.
 *
 * Abandoned sessions are included here, unlike in the trend: a bar is one
 * observed round time, not an average, and the rounds they did run were real.
 */
export function roundBars(history: readonly SessionRecord[], limit: number): RoundBar[] {
  return chronological(history.slice(0, Math.max(0, limit))).flatMap((session) =>
    session.rounds.map((round) => ({
      sessionId: session.id,
      roundIndex: round.index,
      durationMs: round.durationMs,
      goalMs: session.config.goalMs,
      verdict: verdict(round.durationMs, session.config.goalMs),
    })),
  );
}

function bestByDifficulty(points: readonly SessionPoint[]): DifficultyBest[] {
  // Walked in difficulty order rather than in the order sessions happen to
  // appear, so the list reads warm-up → rush however the history is shuffled.
  return DIFFICULTIES.flatMap(({ id }) => {
    const forDifficulty = points.filter((point) => point.difficultyId === id);
    if (forDifficulty.length === 0) return [];

    const best = forDifficulty.reduce((lowest, point) => (point.averageMs < lowest.averageMs ? point : lowest));
    return [{ difficultyId: id, sessionId: best.sessionId, averageMs: best.averageMs }];
  });
}

function fastestRound(sessions: readonly SessionRecord[]): RoundBest | null {
  return sessions
    .flatMap((session) =>
      session.rounds.map((round) => ({
        sessionId: session.id,
        roundIndex: round.index,
        durationMs: round.durationMs,
        totalUnits: round.totalUnits,
        secondsPerUnit: roundSecondsPerUnit(round),
      })),
    )
    .reduce<RoundBest | null>(
      (best, candidate) => (best === null || candidate.secondsPerUnit < best.secondsPerUnit ? candidate : best),
      null,
    );
}

/** Consecutive rounds at or under goal, counted across session boundaries. */
function longestPassStreak(sessions: readonly SessionRecord[]): number {
  let longest = 0;
  let current = 0;

  for (const session of sessions) {
    for (const round of session.rounds) {
      current = verdict(round.durationMs, session.config.goalMs) === 'pass' ? current + 1 : 0;
      longest = Math.max(longest, current);
    }
  }

  return longest;
}

export function personalBests(history: readonly SessionRecord[]): PersonalBests {
  const sessions = chronological(completed(history));
  return {
    byDifficulty: bestByDifficulty(sessionSeries(history)),
    bestRound: fastestRound(sessions),
    longestPassStreak: longestPassStreak(sessions),
  };
}
