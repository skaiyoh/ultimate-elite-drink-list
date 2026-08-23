import { totalUnits } from '@/lib/session/metrics';
import type { RoundRecord, SessionConfig, SessionRecord, TicketLine } from '@/lib/session/types';

export type SessionStatus = 'resting' | 'running' | 'paused' | 'complete';

export interface ActiveRound {
  readonly index: number;
  readonly ticket: readonly TicketLine[];
  readonly totalUnits: number;
  readonly startedAt: number;
  readonly pausedMs: number;
  /** Non-null only while paused; the instant the pause began. */
  readonly pausedAt: number | null;
}

export interface SessionState {
  readonly id: string;
  readonly config: SessionConfig;
  readonly status: SessionStatus;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly current: ActiveRound | null;
  readonly rounds: readonly RoundRecord[];
}

export type SessionAction =
  | { readonly type: 'startRound'; readonly ticket: readonly TicketLine[]; readonly at: number }
  | { readonly type: 'pause'; readonly at: number }
  | { readonly type: 'resume'; readonly at: number }
  | { readonly type: 'advance'; readonly at: number }
  | { readonly type: 'end'; readonly at: number };

/** A session opens resting: "before round 1" and "between rounds" are one state. */
export function createSession(
  id: string, config: SessionConfig, startedAt: number,
): SessionState {
  return { id, config, status: 'resting', startedAt, completedAt: null, current: null, rounds: [] };
}

/** Live elapsed time, always derived from timestamps — never accumulated. */
export function elapsedMs(round: ActiveRound, now: number): number {
  const frozen = round.pausedAt === null ? 0 : now - round.pausedAt;
  return Math.max(0, now - round.startedAt - round.pausedMs - frozen);
}

function settlePausedMs(round: ActiveRound, at: number): number {
  return round.pausedMs + (round.pausedAt === null ? 0 : at - round.pausedAt);
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'startRound': {
      if (state.status !== 'resting') return state;
      return {
        ...state,
        status: 'running',
        current: {
          index: state.rounds.length,
          ticket: action.ticket,
          totalUnits: totalUnits(action.ticket),
          startedAt: action.at,
          pausedMs: 0,
          pausedAt: null,
        },
      };
    }

    case 'pause': {
      if (state.status !== 'running' || state.current === null) return state;
      return { ...state, status: 'paused', current: { ...state.current, pausedAt: action.at } };
    }

    case 'resume': {
      if (state.status !== 'paused' || state.current === null) return state;
      return {
        ...state,
        status: 'running',
        current: { ...state.current, pausedMs: settlePausedMs(state.current, action.at), pausedAt: null },
      };
    }

    case 'advance': {
      if ((state.status !== 'running' && state.status !== 'paused') || state.current === null) return state;
      const round = state.current;
      const pausedMs = settlePausedMs(round, action.at);
      const record: RoundRecord = {
        index: round.index,
        ticket: round.ticket,
        totalUnits: round.totalUnits,
        startedAt: round.startedAt,
        endedAt: action.at,
        pausedMs,
        durationMs: Math.max(0, action.at - round.startedAt - pausedMs),
      };
      const rounds = [...state.rounds, record];
      const finished = rounds.length >= state.config.roundCount;
      return {
        ...state,
        status: finished ? 'complete' : 'resting',
        completedAt: finished ? action.at : null,
        current: null,
        rounds,
      };
    }

    case 'end': {
      if (state.status === 'complete') return state;
      // An in-flight round is discarded: it was never finished, so it has no time.
      return { ...state, status: 'complete', completedAt: null, current: null };
    }
  }
}

export function toRecord(state: SessionState): SessionRecord {
  return {
    id: state.id,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    config: state.config,
    rounds: state.rounds,
  };
}
