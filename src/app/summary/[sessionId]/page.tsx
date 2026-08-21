'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { RoundBars } from '@/components/charts/RoundBars';
import { formatDateTime } from '@/lib/format/date';
import { formatDuration } from '@/lib/format/duration';
import { difficultyLabel } from '@/lib/session/config';
import { averageMs, secondsPerUnit, verdict } from '@/lib/session/metrics';
import { loadSession } from '@/lib/session/repository';
import type { SessionRecord } from '@/lib/session/types';
import '@/app/history/history.css';

/** `null` means "not looked yet"; a resolved lookup that found nothing is `'missing'`. */
type Lookup = SessionRecord | 'missing' | null;

function Breakdown({ session }: { session: SessionRecord }) {
  const { config, rounds } = session;
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
        empty="This session recorded no rounds."
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

export default function SummaryPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<Lookup>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(loadSession(sessionId) ?? 'missing');
  }, [sessionId]);

  if (session === null) return <main><p>Loading…</p></main>;

  if (session === 'missing') {
    return (
      <main>
        <h1>Session summary</h1>
        {/* Reachable by a stale link, a wiped browser, or a record that failed
            validation on read — all of which look identical from here. */}
        <p className="empty">That session is not on this device.</p>
        <Link href="/history">Back to history</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>Session summary</h1>
      <p className="lede">
        {formatDateTime(session.startedAt)} · {difficultyLabel(session.config.difficultyId)}
        {session.completedAt === null && ' · Ended early'}
      </p>
      <Breakdown session={session} />
      <Link href="/history">Back to history</Link>
    </main>
  );
}
