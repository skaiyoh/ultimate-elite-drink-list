'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { RestCard } from '@/components/play/RestCard';
import { RoundClock } from '@/components/play/RoundClock';
import { StorageWarning } from '@/components/play/StorageWarning';
import { Ticket } from '@/components/play/Ticket';
import { useSessionMachine } from '@/hooks/useSessionMachine';
import { formatDuration } from '@/lib/format/duration';

export default function PlayPage() {
  const machine = useSessionMachine();
  const { hydrated, state, elapsedMs, averageMs, lastRound, storageWarning } = machine;

  const { startRound, pause, resume, advance, end } = machine;
  // Named `currentStatus`, not `status`: the render branches below already
  // declare their own `status` via `const { config, rounds, status } = state`
  // in this same function scope. Reusing `status` here would be a duplicate
  // `const` declaration in that scope (a compile error), not a shadow — the
  // `if (state === null) return …` between them doesn't open a new block.
  const currentStatus = state?.status;

  // Depends on `currentStatus` and the action callbacks, never on `machine` or
  // `state` themselves. `elapsedMs` changes on every ~100ms tick, so the
  // machine object is a new reference each tick — depending on it would tear
  // down and re-register this listener roughly ten times a second for the
  // whole round. The callbacks are useCallback-stable, so this now
  // re-registers only when the status actually changes: a handful of times
  // per session.
  useEffect(() => {
    if (currentStatus === undefined || currentStatus === 'complete') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (currentStatus === 'resting') startRound();
        else advance();
      } else if (event.key.toLowerCase() === 'p') {
        if (currentStatus === 'running') pause();
        else if (currentStatus === 'paused') resume();
      } else if (event.key === 'Escape') {
        if (window.confirm('End this session early?')) end();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentStatus, startRound, pause, resume, advance, end]);

  if (!hydrated) return <main><p>Loading…</p></main>;

  if (state === null) {
    return (
      <main>
        <h1>No session in progress</h1>
        <Link href="/setup">Set one up</Link>
      </main>
    );
  }

  const { config, rounds, status } = state;

  if (status === 'complete') {
    return (
      <main>
        <StorageWarning warning={storageWarning} />
        <h1>{state.completedAt === null ? 'Session ended early' : 'Session complete'}</h1>
        <p>Average {averageMs === null ? '—' : formatDuration(averageMs)} against a {formatDuration(config.goalMs)} goal</p>
        <ol aria-label="Round times">
          {rounds.map((round) => (
            <li key={round.index}>Round {round.index + 1}: {formatDuration(round.durationMs)}</li>
          ))}
        </ol>
        <Link href="/setup">Run another</Link>
      </main>
    );
  }

  if (status === 'resting') {
    return (
      <main>
        <StorageWarning warning={storageWarning} />
        <h1>Round {rounds.length + 1} of {config.roundCount}</h1>
        {lastRound && <RestCard round={lastRound} goalMs={config.goalMs} averageMs={averageMs} />}
        <button onClick={machine.startRound}>Start round {rounds.length + 1}</button>
        <p>Space starts the round. The clock is stopped until you do.</p>
      </main>
    );
  }

  const current = state.current;
  if (current === null) return <main><p>Loading…</p></main>;

  return (
    <main>
      <StorageWarning warning={storageWarning} />
      <h1>Round {current.index + 1} of {config.roundCount}</h1>
      <RoundClock elapsedMs={elapsedMs} goalMs={config.goalMs} paused={status === 'paused'} />
      <Ticket lines={current.ticket} />
      <p>{current.totalUnits} drinks</p>
      <button onClick={machine.advance}>Next round</button>
      <button onClick={status === 'paused' ? machine.resume : machine.pause}>
        {status === 'paused' ? 'Resume' : 'Pause'}
      </button>
    </main>
  );
}
