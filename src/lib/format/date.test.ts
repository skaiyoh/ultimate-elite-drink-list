import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from '@/lib/format/date';

// Fixed instants, read back in UTC. The zone is passed in rather than pinned
// in the formatter: real users want their own zone, and a test that depended
// on the machine's would flake the moment it ran somewhere else.
const NOON_UTC = Date.UTC(2026, 2, 1, 12, 0);

describe('formatDate', () => {
  it('renders a short, unambiguous day', () => {
    expect(formatDate(NOON_UTC, 'UTC')).toBe('Mar 1, 2026');
  });

  it('keeps the year so old history is not mistaken for recent', () => {
    expect(formatDate(Date.UTC(2019, 11, 31, 12, 0), 'UTC')).toBe('Dec 31, 2019');
  });

  it('reads the instant in the zone it is given', () => {
    // 01:00 UTC is still the previous evening in New York.
    expect(formatDate(Date.UTC(2026, 2, 2, 1, 0), 'America/New_York')).toBe('Mar 1, 2026');
  });
});

describe('formatDateTime', () => {
  it('adds the time of day, for a single session', () => {
    expect(formatDateTime(NOON_UTC, 'UTC')).toBe('Mar 1, 2026, 12:00 PM');
  });
});
