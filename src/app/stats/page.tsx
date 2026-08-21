'use client';
import { useEffect, useMemo, useState } from 'react';
import { RoundBars } from '@/components/charts/RoundBars';
import { TrendChart } from '@/components/charts/TrendChart';
import { useProfiles } from '@/components/profile/ProfileProvider';
import { formatDate } from '@/lib/format/date';
import { formatDuration } from '@/lib/format/duration';
import { difficultyLabel } from '@/lib/session/config';
import { loadHistory } from '@/lib/session/repository';
import { lifetimeTotals, personalBests, roundBars, sessionSeries } from '@/lib/session/stats';
import type { SessionRecord } from '@/lib/session/types';
import '@/app/history/history.css';

/** Enough rounds to see a shape without turning the bars into hairlines. */
const RECENT_SESSIONS = 6;

const EMPTY = 'Run a session and this fills in.';

function Totals({ history }: { history: readonly SessionRecord[] }) {
  const totals = lifetimeTotals(history);
  return (
    <dl className="stats">
      <div className="stat">
        <dt>Sessions</dt>
        <dd className="stat__value" data-testid="total-sessions">{totals.sessions}</dd>
      </div>
      <div className="stat">
        <dt>Rounds</dt>
        <dd className="stat__value" data-testid="total-rounds">{totals.rounds}</dd>
      </div>
      <div className="stat">
        <dt>Drinks made</dt>
        <dd className="stat__value" data-testid="total-drinks">{totals.drinks}</dd>
      </div>
    </dl>
  );
}

function Bests({ history }: { history: readonly SessionRecord[] }) {
  const bests = personalBests(history);
  const hasAny = bests.byDifficulty.length > 0 || bests.bestRound !== null;

  if (!hasAny) return <p className="empty">{EMPTY}</p>;

  return (
    <dl className="stats">
      {bests.byDifficulty.map((best) => (
        <div className="stat" key={best.difficultyId}>
          <dt>Best {difficultyLabel(best.difficultyId)} average</dt>
          <dd className="stat__value">{formatDuration(best.averageMs)}</dd>
        </div>
      ))}
      {bests.bestRound && (
        <div className="stat">
          <dt>Fastest round, per drink</dt>
          <dd className="stat__value">{bests.bestRound.secondsPerUnit.toFixed(1)}s</dd>
        </div>
      )}
      <div className="stat">
        <dt>Longest run under goal</dt>
        <dd className="stat__value">{bests.longestPassStreak} rounds</dd>
      </div>
    </dl>
  );
}

export default function StatsPage() {
  const { hydrated, activeProfile } = useProfiles();
  const [history, setHistory] = useState<readonly SessionRecord[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(activeProfile === null ? [] : loadHistory(activeProfile.id));
  }, [activeProfile]);

  const series = useMemo(() => sessionSeries(history ?? []), [history]);
  const bars = useMemo(() => roundBars(history ?? [], RECENT_SESSIONS), [history]);

  if (!hydrated || history === null) return <main><p>Loading…</p></main>;
  if (!activeProfile) return <main><p>Pick a profile first.</p></main>;

  // The goal moves between sessions, so the reference rule is the goal of the
  // most recent one rather than an average of goals, which is not a goal.
  const latestGoalMs = series.length > 0 ? series[series.length - 1].goalMs : null;

  return (
    <main>
      <h1>Stats</h1>
      <p className="lede">{activeProfile.name}, all time on this device.</p>

      <Totals history={history} />

      <TrendChart
        caption="Session average"
        empty={EMPTY}
        points={series.map((point) => ({ label: formatDate(point.startedAt), value: point.averageMs }))}
        format={formatDuration}
        reference={latestGoalMs === null ? undefined : { value: latestGoalMs, label: `Goal ${formatDuration(latestGoalMs)}` }}
      />

      <RoundBars
        caption="Recent rounds"
        empty={EMPTY}
        bars={bars.map((bar) => ({
          key: `${bar.sessionId}-${bar.roundIndex}`,
          label: `Round ${bar.roundIndex + 1}`,
          durationMs: bar.durationMs,
          verdict: bar.verdict,
        }))}
      />

      <TrendChart
        caption="Pace"
        empty={EMPTY}
        points={series.map((point) => ({ label: formatDate(point.startedAt), value: point.secondsPerUnit }))}
        // Seconds per drink is the one number comparable across presets, so it
        // is shown at a finer precision than the m:ss clock everywhere else.
        format={(value) => `${value.toFixed(1)}s`}
      />

      <h2>Personal bests</h2>
      <Bests history={history} />
    </main>
  );
}
