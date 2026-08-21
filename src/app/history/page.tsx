'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProfiles } from '@/components/profile/ProfileProvider';
import { formatDateTime } from '@/lib/format/date';
import { formatDuration } from '@/lib/format/duration';
import { difficultyLabel } from '@/lib/session/config';
import { averageMs, verdict } from '@/lib/session/metrics';
import { loadHistory } from '@/lib/session/repository';
import type { SessionRecord } from '@/lib/session/types';
import './history.css';

function SessionRow({ session }: { session: SessionRecord }) {
  const average = averageMs(session.rounds);
  const abandoned = session.completedAt === null;
  const outcome = average === null ? null : verdict(average, session.config.goalMs);

  return (
    <li className="session" data-verdict={abandoned ? undefined : outcome ?? undefined}>
      <Link className="session__link" href={`/summary/${session.id}`}>
        {formatDateTime(session.startedAt)}
      </Link>
      <p className="session__meta">
        {difficultyLabel(session.config.difficultyId)} · {session.rounds.length} rounds
        {abandoned && ' · Ended early'}
      </p>
      <p className="session__average">
        {average === null ? '—' : formatDuration(average)}
        <span className="session__goal"> vs {formatDuration(session.config.goalMs)}</span>
      </p>
    </li>
  );
}

export default function HistoryPage() {
  const { hydrated, activeProfile } = useProfiles();
  const [sessions, setSessions] = useState<readonly SessionRecord[] | null>(null);

  useEffect(() => {
    // Same one-time-after-mount load as every other screen that reads storage:
    // localStorage is unavailable during SSR, so it cannot be read in render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessions(activeProfile === null ? [] : loadHistory(activeProfile.id));
  }, [activeProfile]);

  if (!hydrated || sessions === null) return <main><p>Loading…</p></main>;
  if (!activeProfile) return <main><p>Pick a profile first.</p></main>;

  return (
    <main>
      <h1>History</h1>
      <p className="lede">Every session {activeProfile.name} has run on this device.</p>

      {sessions.length === 0 ? (
        <p className="empty">No sessions yet. Finish a drill and it lands here.</p>
      ) : (
        <ul className="sessions" aria-label="Past sessions">
          {sessions.map((session) => <SessionRow key={session.id} session={session} />)}
        </ul>
      )}
    </main>
  );
}
