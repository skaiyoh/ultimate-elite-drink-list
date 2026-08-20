import type { RoundRecord, TicketLine } from '@/lib/session/types';

export function totalUnits(ticket: readonly TicketLine[]): number {
  return ticket.reduce((sum, line) => sum + line.quantity, 0);
}

/** Null when there is nothing to average — the caller decides what to show. */
export function averageMs(rounds: readonly RoundRecord[]): number | null {
  if (rounds.length === 0) return null;
  return rounds.reduce((sum, r) => sum + r.durationMs, 0) / rounds.length;
}

/** A round passes at exactly the goal — the boundary is inclusive. */
export function verdict(durationMs: number, goalMs: number): 'pass' | 'miss' {
  return durationMs <= goalMs ? 'pass' : 'miss';
}

/** The honest cross-session comparison: bands make rounds similar, not identical. */
export function secondsPerUnit(round: RoundRecord): number {
  if (round.totalUnits <= 0) return 0;
  return round.durationMs / 1000 / round.totalUnits;
}
