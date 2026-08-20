'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { RestCard } from '@/components/play/RestCard';
import { RoundClock } from '@/components/play/RoundClock';
import { Ticket } from '@/components/play/Ticket';
import { useSessionMachine } from '@/hooks/useSessionMachine';
import { formatDuration } from '@/lib/format/duration';

export default function PlayPage() {
  const machine = useSessionMachine();
  const { hydrated, state, elapsedMs, averageMs, lastRound } = machine;

  useEffect(() => {
    if (state === null || state.status === 'complete') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (state.status === 'resting') machine.startRound();
        else machine.advance();
      } else if (event.key.toLowerCase() === 'p') {
        if (state.status === 'running') machine.pause();
        else if (state.status === 'paused') machine.resume();
      } else if (event.key === 'Escape') {
        if (window.confirm('End this session early?')) machine.end();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [machine, state]);

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
        <h1>Session complete</h1>
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
