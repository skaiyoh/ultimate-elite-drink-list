import { formatDuration } from '@/lib/format/duration';
import './play.css';

interface RoundClockProps {
  readonly elapsedMs: number;
  readonly goalMs: number;
  readonly paused: boolean;
}

/**
 * Deliberately not a live region — announcing every tick would be hostile.
 * The static label tells assistive tech what the number means.
 */
export function RoundClock({ elapsedMs, goalMs, paused }: RoundClockProps) {
  return (
    <p className="clock" data-over={elapsedMs > goalMs} data-paused={paused}>
      <span className="clock__label">Time on this round</span>
      <span className="clock__value">{formatDuration(elapsedMs)}</span>
      <span className="clock__goal">goal {formatDuration(goalMs)}</span>
    </p>
  );
}
