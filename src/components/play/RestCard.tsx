import { formatDuration } from '@/lib/format/duration';
import { verdict } from '@/lib/session/metrics';
import type { RoundRecord } from '@/lib/session/types';
import './play.css';

interface RestCardProps {
  readonly round: RoundRecord;
  readonly goalMs: number;
  readonly averageMs: number | null;
}

export function RestCard({ round, goalMs, averageMs }: RestCardProps) {
  const outcome = verdict(round.durationMs, goalMs);
  return (
    <section className="rest" data-verdict={outcome} aria-live="polite">
      <h2>Round {round.index + 1} done</h2>
      <p className="rest__time">{formatDuration(round.durationMs)}</p>
      <p className="rest__verdict">
        {outcome === 'pass' ? `Under the ${formatDuration(goalMs)} goal` : `Over the ${formatDuration(goalMs)} goal`}
      </p>
      <p className="rest__average">
        Average so far {averageMs === null ? '—' : formatDuration(averageMs)}
      </p>
      <p className="rest__units">{round.totalUnits} drinks made</p>
    </section>
  );
}
