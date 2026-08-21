'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RoundBars } from '@/components/charts/RoundBars';
import { formatDateTime } from '@/lib/format/date';
import { formatDuration } from '@/lib/format/duration';
import { difficultyLabel } from '@/lib/session/config';
import { averageMs, secondsPerUnit, verdict } from '@/lib/session/metrics';
import { loadLastRun } from '@/lib/session/repository';
import type { SessionRecord } from '@/lib/session/types';
import './results.css';

/** `null` means "not looked yet"; a finished lookup that found nothing is `'none'`. */
type Lookup = SessionRecord | 'none' | null;

function Breakdown({ run }: { run: SessionRecord }) {
  const { config, rounds } = run;
  const average = averageMs(rounds);
  const drinks = rounds.reduce((sum, round) => sum + round.totalUnits, 0);

  return (
    <>
      <dl className="stats">
        <div className="stat">
          <dt>Average</dt>
          <dd className="stat__value" data-verdict={average === null ? undefined : verdict(average, config.goalMs)}>
            {average === null ? '—' : formatDuration(average)}
          </dd>
        </div>
        <div className="stat">
          <dt>Goal</dt>
          <dd className="stat__value">{formatDuration(config.goalMs)}</dd>
        </div>
        <div className="stat">
          <dt>Rounds</dt>
          <dd className="stat__value">{rounds.length} rounds</dd>
        </div>
        <div className="stat">
          <dt>Drinks made</dt>
          <dd className="stat__value">{drinks}</dd>
        </div>
      </dl>

      <RoundBars
        caption="Round times"
        empty="This run recorded no rounds."
        withDataTable={false}
        bars={rounds.map((round) => ({
          key: String(round.index),
          label: `Round ${round.index + 1}`,
          durationMs: round.durationMs,
          verdict: verdict(round.durationMs, config.goalMs),
        }))}
      />

      <table className="rounds" aria-label="Rounds">
        <thead>
          <tr>
            <th scope="col">Round</th>
            <th scope="col">Time</th>
            <th scope="col">Drinks</th>
            <th scope="col">Per drink</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => (
            <tr key={round.index}>
              <th scope="row">{round.index + 1}</th>
              <td>{formatDuration(round.durationMs)}</td>
              <td>{round.totalUnits}</td>
              <td>{secondsPerUnit(round).toFixed(1)}s</td>
              <td data-verdict={verdict(round.durationMs, config.goalMs)}>
                {verdict(round.durationMs, config.goalMs) === 'pass' ? 'Pass' : 'Miss'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rounds.map((round) => (
        <details key={round.index} className="ticket-detail">
          <summary>Round {round.index + 1} ticket</summary>
          <ul>
            {round.ticket.map((line) => (
              <li key={line.drinkId}>{line.quantity}× {line.name}</li>
            ))}
          </ul>
        </details>
      ))}
    </>
  );
}

export default function ResultsPage() {
  const [run, setRun] = useState<Lookup>(null);

  useEffect(() => {
    // The same one-time-after-mount load every screen reading storage uses:
    // localStorage is unavailable during SSR, so it cannot be read in render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(loadLastRun() ?? 'none');
  }, []);

  if (run === null) return <main><p>Loading…</p></main>;

  if (run === 'none') {
    return (
      <main>
        <h1>Last run</h1>
        <p className="empty">No run on this device yet. Finish a drill and it lands here.</p>
        <p className="results__actions"><Link className="is-primary" href="/setup">Set up a session</Link></p>
      </main>
    );
  }

  return (
    <main>
      <h1>Last run</h1>
      <p className="lede">
        {formatDateTime(run.startedAt)} · {difficultyLabel(run.config.difficultyId)}
        {run.completedAt === null && ' · Ended early'}
      </p>
      <Breakdown run={run} />
      <p className="results__actions"><Link className="is-primary" href="/setup">Run another</Link></p>
    </main>
  );
}
