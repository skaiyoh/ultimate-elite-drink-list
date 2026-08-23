'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import { StorageWarning } from '@/components/play/StorageWarning';
import { categoryMap, loadDrinkList, poolFor } from '@/lib/drinks/repository';
import type { CategoryId, DrinkListState } from '@/lib/drinks/types';
import { formatDuration } from '@/lib/format/duration';
import {
  DIFFICULTIES, GOAL_STEP_MS, MAX_GOAL_MS, MAX_ROUND_COUNT, MIN_GOAL_MS,
  MIN_ROUND_COUNT, bandFor, defaultSessionConfig,
} from '@/lib/session/config';
import type { DifficultyId } from '@/lib/session/types';
import { createSession } from '@/lib/session/machine';
import { loadPrefs, saveActiveSession, savePrefs } from '@/lib/session/repository';
import { setupIssues } from '@/lib/session/setupGuards';
import type { WriteOutcome } from '@/lib/storage/localStore';
import './setup.css';

export default function SetupPage() {
  const router = useRouter();
  const [config, setConfig] = useState(defaultSessionConfig);
  const [drinks, setDrinks] = useState<DrinkListState | null>(null);
  const [startWarning, setStartWarning] = useState<Exclude<WriteOutcome, 'ok'> | null>(null);

  useEffect(() => {
    // A deliberate one-time-after-mount load from storage, not a subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrinks(loadDrinkList());
    setConfig(loadPrefs() ?? defaultSessionConfig());
  }, []);

  const pool = useMemo(
    () => (drinks === null ? [] : poolFor(drinks, config.categoryIds)),
    [config.categoryIds, drinks],
  );
  const issues = useMemo(() => setupIssues(pool, categoryMap(), config.band), [config.band, pool]);
  const blocked = issues.some((issue) => issue.severity === 'blocking');

  if (drinks === null) return <main><p>Loading…</p></main>;

  const setDifficulty = (difficultyId: DifficultyId) =>
    setConfig((c) => ({ ...c, difficultyId, band: bandFor(difficultyId) }));

  const toggleCategory = (id: CategoryId) =>
    setConfig((c) => ({
      ...c,
      categoryIds: c.categoryIds.includes(id)
        ? c.categoryIds.filter((existing) => existing !== id)
        : [...c.categoryIds, id],
    }));

  const start = () => {
    // savePrefs's outcome is deliberately discarded: losing remembered
    // defaults costs one re-selection next time, which is not worth blocking
    // Start over. saveActiveSession is different — without it /play finds no
    // session and dead-ends, so its outcome gates navigation.
    savePrefs(config);
    const outcome = saveActiveSession(createSession(crypto.randomUUID(), config, Date.now()));
    if (outcome !== 'ok') {
      setStartWarning(outcome);
      return;
    }
    router.push('/play');
  };

  return (
    <main>
      <StorageWarning warning={startWarning} />
      <h1>Set up a session</h1>
      <p className="lede">Defaults come from the last session run on this device.</p>

      <div className="docket setup">
      <fieldset className="setup__field">
        <legend>Rounds</legend>
        <div className="setup__options">
        {[3, 5, 10].map((count) => (
          <button key={count} onClick={() => setConfig((c) => ({ ...c, roundCount: count }))}
                  aria-pressed={config.roundCount === count}>{count}</button>
        ))}
        </div>
        <label className="setup__custom" htmlFor="round-count">Custom
        <input id="round-count" type="number" min={MIN_ROUND_COUNT} max={MAX_ROUND_COUNT}
               value={config.roundCount}
               onChange={(e) => setConfig((c) => ({
                 ...c,
                 roundCount: Math.min(MAX_ROUND_COUNT, Math.max(MIN_ROUND_COUNT, Number(e.target.value) || MIN_ROUND_COUNT)),
               }))} />
        </label>
      </fieldset>

      <fieldset className="setup__field">
        <legend>Difficulty</legend>
        <div className="setup__options">
        {DIFFICULTIES.map((difficulty) => (
          <button key={difficulty.id} onClick={() => setDifficulty(difficulty.id)}
                  aria-pressed={config.difficultyId === difficulty.id}>
            {difficulty.label} · {difficulty.band[0]}–{difficulty.band[1]} drinks
          </button>
        ))}
        </div>
      </fieldset>

      <fieldset className="setup__field">
        <legend>Goal per round</legend>
        <div className="setup__options setup__stepper">
        <button onClick={() => setConfig((c) => ({ ...c, goalMs: Math.max(MIN_GOAL_MS, c.goalMs - GOAL_STEP_MS) }))}
                aria-label="Decrease goal">−</button>
        <output>{formatDuration(config.goalMs)}</output>
        <button onClick={() => setConfig((c) => ({ ...c, goalMs: Math.min(MAX_GOAL_MS, c.goalMs + GOAL_STEP_MS) }))}
                aria-label="Increase goal">+</button>
        </div>
      </fieldset>

      <fieldset className="setup__field">
        <legend>Categories</legend>
        <div className="setup__options">
        {SEED_CATEGORIES.map((category) => (
          <label key={category.id} className="setup__check">
            <input type="checkbox" checked={config.categoryIds.includes(category.id)}
                   onChange={() => toggleCategory(category.id)} />
            {category.label}
          </label>
        ))}
        </div>
      </fieldset>
      </div>

      {issues.map((issue) => (
        <p key={issue.message} className={`setup__issue is-${issue.severity}`}
           role={issue.severity === 'blocking' ? 'alert' : 'status'}>{issue.message}</p>
      ))}

      <p className="setup__go">
        <button className="is-primary" onClick={start} disabled={blocked}>Start session</button>
      </p>
    </main>
  );
}
