'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import { StorageWarning } from '@/components/play/StorageWarning';
import { useProfiles } from '@/components/profile/ProfileProvider';
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

export default function SetupPage() {
  const router = useRouter();
  const { hydrated, activeProfile } = useProfiles();
  const [config, setConfig] = useState(defaultSessionConfig);
  const [drinks, setDrinks] = useState<DrinkListState | null>(null);
  const [startWarning, setStartWarning] = useState<Exclude<WriteOutcome, 'ok'> | null>(null);

  useEffect(() => {
    // Same hydration-guard idiom as useHydrated/ProfileProvider (Task 10): a
    // deliberate one-time-after-mount load from storage, not a subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrinks(loadDrinkList());
    if (activeProfile) setConfig(loadPrefs(activeProfile.id) ?? defaultSessionConfig());
  }, [activeProfile]);

  const pool = useMemo(
    () => (drinks === null ? [] : poolFor(drinks, config.categoryIds)),
    [config.categoryIds, drinks],
  );
  const issues = useMemo(() => setupIssues(pool, categoryMap(), config.band), [config.band, pool]);
  const blocked = issues.some((issue) => issue.severity === 'blocking');

  if (!hydrated || drinks === null) return <main><p>Loading…</p></main>;
  if (!activeProfile) return <main><p>Pick a profile first.</p></main>;

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
    // defaults costs the user one re-selection next time, which isn't worth
    // blocking Start over. saveActiveSession is different — without it /play
    // finds no session and dead-ends, so its outcome gates navigation.
    savePrefs(activeProfile.id, config);
    const outcome = saveActiveSession(createSession(crypto.randomUUID(), activeProfile.id, config, Date.now()));
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

      <fieldset>
        <legend>Rounds</legend>
        {[3, 5, 10].map((count) => (
          <button key={count} onClick={() => setConfig((c) => ({ ...c, roundCount: count }))}
                  aria-pressed={config.roundCount === count}>{count}</button>
        ))}
        <label htmlFor="round-count">Custom</label>
        <input id="round-count" type="number" min={MIN_ROUND_COUNT} max={MAX_ROUND_COUNT}
               value={config.roundCount}
               onChange={(e) => setConfig((c) => ({
                 ...c,
                 roundCount: Math.min(MAX_ROUND_COUNT, Math.max(MIN_ROUND_COUNT, Number(e.target.value) || MIN_ROUND_COUNT)),
               }))} />
      </fieldset>

      <fieldset>
        <legend>Difficulty</legend>
        {DIFFICULTIES.map((difficulty) => (
          <button key={difficulty.id} onClick={() => setDifficulty(difficulty.id)}
                  aria-pressed={config.difficultyId === difficulty.id}>
            {difficulty.label} · {difficulty.band[0]}–{difficulty.band[1]} drinks
          </button>
        ))}
      </fieldset>

      <fieldset>
        <legend>Goal per round</legend>
        <button onClick={() => setConfig((c) => ({ ...c, goalMs: Math.max(MIN_GOAL_MS, c.goalMs - GOAL_STEP_MS) }))}
                aria-label="Decrease goal">−</button>
        <output>{formatDuration(config.goalMs)}</output>
        <button onClick={() => setConfig((c) => ({ ...c, goalMs: Math.min(MAX_GOAL_MS, c.goalMs + GOAL_STEP_MS) }))}
                aria-label="Increase goal">+</button>
      </fieldset>

      <fieldset>
        <legend>Categories</legend>
        {SEED_CATEGORIES.map((category) => (
          <label key={category.id}>
            <input type="checkbox" checked={config.categoryIds.includes(category.id)}
                   onChange={() => toggleCategory(category.id)} />
            {category.label}
          </label>
        ))}
      </fieldset>

      {issues.map((issue) => (
        <p key={issue.message} role={issue.severity === 'blocking' ? 'alert' : 'status'}>{issue.message}</p>
      ))}

      <button onClick={start} disabled={blocked}>Start session</button>
    </main>
  );
}
