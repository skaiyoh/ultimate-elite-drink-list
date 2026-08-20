import { describe, expect, it } from 'vitest';
import { averageMs, secondsPerUnit, totalUnits, verdict } from '@/lib/session/metrics';
import type { RoundRecord, TicketLine } from '@/lib/session/types';

const line = (quantity: number): TicketLine =>
  ({ drinkId: 'd', name: 'D', categoryId: 'shot', quantity });

const round = (durationMs: number, units = 14): RoundRecord => ({
  index: 0,
  ticket: [line(units)],
  totalUnits: units,
  startedAt: 0,
  endedAt: durationMs,
  pausedMs: 0,
  durationMs,
});

describe('totalUnits', () => {
  it('sums the quantities on a ticket', () => {
    expect(totalUnits([line(4), line(2), line(1)])).toBe(7);
  });

  it('is zero for an empty ticket', () => {
    expect(totalUnits([])).toBe(0);
  });
});

describe('averageMs', () => {
  it('averages the round durations', () => {
    expect(averageMs([round(200_000), round(280_000)])).toBe(240_000);
  });

  it('returns null when no rounds have been completed', () => {
    expect(averageMs([])).toBeNull();
  });
});

describe('verdict', () => {
  it('passes strictly under the goal', () => {
    expect(verdict(239_000, 240_000)).toBe('pass');
  });

  it('passes exactly at the goal', () => {
    expect(verdict(240_000, 240_000)).toBe('pass');
  });

  it('misses one millisecond over', () => {
    expect(verdict(240_001, 240_000)).toBe('miss');
  });
});

describe('secondsPerUnit', () => {
  it('normalizes a round against how much it asked for', () => {
    expect(secondsPerUnit(round(140_000, 14))).toBe(10);
  });

  it('returns 0 rather than Infinity for a unit-less round', () => {
    expect(secondsPerUnit(round(140_000, 0))).toBe(0);
  });
});
