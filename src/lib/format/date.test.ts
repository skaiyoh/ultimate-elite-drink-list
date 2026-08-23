import { describe, expect, it } from 'vitest';
import { formatDateTime } from '@/lib/format/date';

// Fixed instants, read back in UTC. The zone is passed in rather than pinned
// in the formatter: real users want their own zone, and a test that depended
// on the machine's would flake the moment it ran somewhere else.
const NOON_UTC = Date.UTC(2026, 2, 1, 12, 0);

describe('formatDateTime', () => {
  it('adds the time of day, for a single session', () => {
    expect(formatDateTime(NOON_UTC, 'UTC')).toBe('Mar 1, 2026, 12:00 PM');
  });
});
