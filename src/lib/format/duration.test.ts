import { describe, expect, it } from 'vitest';
import { formatDuration } from '@/lib/format/duration';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [1000, '0:01'],
    [59_000, '0:59'],
    [60_000, '1:00'],
    [240_000, '4:00'],
    [3_723_000, '62:03'],
  ])('formats %ims as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it('never renders a negative time', () => {
    expect(formatDuration(-5000)).toBe('0:00');
  });
});
