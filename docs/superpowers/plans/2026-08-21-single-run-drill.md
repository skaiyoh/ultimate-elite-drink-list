# Single-Run Drill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove profiles and cross-session history so the app keeps exactly one run — the most recent — on the device, and a bad round is fixed by starting over rather than by editing a time.

**Architecture:** This is mostly deletion. Seven screens become four (`/`, `/play`, `/results`, `/drinks`), the per-profile session index collapses to a single `last-run` key, and the profile system disappears entirely. The order below builds the replacement before removing what it replaces wherever one depends on the other, so every task ends with a green suite.

**Tech Stack:** Next.js (App Router) · React · TypeScript (strict) · Zod · Vitest + Testing Library · Playwright

**Spec:** `docs/superpowers/specs/2026-08-21-single-run-drill-design.md`
(revises `docs/superpowers/specs/2026-08-19-bartender-speed-drill-design.md`)

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the specs.

- **A round deals exactly 7 distinct drinks.** Never 6, never a repeat inside one round.
- **`CategoryId` is a closed union** (`'shot' | 'well' | 'cocktail' | 'martini'`). Categories are code-owned and **never persisted**.
- **Seed drink ids are permanent.** Change a drink's `name`, never its `id`.
- **All recorded timing derives from `Date.now()` deltas.** Intervals exist only to trigger re-renders.
- **Difficulty bands:** Warm-up `8–11`, Standard `12–16`, Rush `18–24`.
- **Defaults:** 5 rounds, Standard difficulty, 4:00 goal per round, all categories enabled.
- **Durations display as `m:ss`** — never tenths. Milliseconds are stored.
- **A round passes when `durationMs <= goalMs`** (inclusive at the boundary).
- **No backend.** No API routes, no database, no network calls at runtime.
- **Storage keys are namespaced `ueddl:v1:`.**
- **Budget:** < 215KB JS gzipped total, < 30KB CSS. No charting library, no animation library, no icon package.
- **Every screen that reads storage must render a hydration-safe placeholder first.** Reading `localStorage` during render breaks SSR.
- **A round is immutable once recorded.** There is no per-round edit and no way to retype a time. The only correction is Start over.
- **Coverage floor is 80%** (lines, functions, branches, statements), enforced by `vitest.config.mts`.

## Verification commands

Used throughout. Run from the repo root.

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .
npm test                 # vitest run
npm run test:coverage    # vitest run --coverage
npm run e2e              # playwright test (builds and starts its own server on :3100)
```

**Playwright serves its own build.** `playwright.config.ts` runs `npm run build && npm run start -- -p 3100` and reuses an existing server. If a stale `next start` is already on port 3100 it will serve an old manifest and produce baffling failures — `lsof -ti :3100 | xargs -r kill -9` before an e2e run if anything looks wrong.

## File structure

**Created**

| File | Responsibility |
|---|---|
| `src/styles/surfaces.css` | Shared page-surface styles (`.lede`, `.empty`, stat blocks) used by `/results` and `/drinks` |
| `src/app/results/page.tsx` | The last-run screen |
| `src/app/results/results.css` | Per-round table and ticket disclosure styles |

Route components carry no unit test: `vitest.config.mts` excludes `src/app/**`
from coverage because Playwright covers them one layer out.

**Modified**

| File | Change |
|---|---|
| `src/lib/storage/keys.ts` | Drop profile keys and the session index; add `lastRun`; `prefs` becomes a plain key |
| `src/lib/session/repository.ts` | Drop `commitSession`/`loadSession`/`loadSessionIndex`/`loadHistory`; add last-run functions; prefs lose `profileId` |
| `src/lib/session/types.ts` | `SessionRecord` loses `profileId` |
| `src/lib/session/schema.ts` | `sessionRecordSchema` loses `profileId` |
| `src/lib/session/machine.ts` | `createSession` loses `profileId` |
| `src/lib/charts/geometry.ts` | Drop `xFor`, `polylinePoints`, `areaPoints` |
| `src/lib/format/date.ts` | Drop `formatDate` |
| `src/hooks/useSessionMachine.ts` | Save the last run instead of committing; expose `startOver` |
| `src/components/ui/AppNav.tsx` | Three items; drop the `owns` mechanism |
| `src/app/layout.tsx` | Drop `ProfileProvider` |
| `src/app/page.tsx` | Becomes the setup screen |
| `src/app/play/page.tsx` | Redirect to `/results` on completion; add Start over; drop the inline completion state |
| `src/app/drinks/page.tsx` | Import `surfaces.css` instead of `history.css` |
| `e2e/helpers.ts` | Drop profiles and history seeding; add last-run seeding |
| `e2e/drill.spec.ts`, `e2e/drinks.spec.ts`, `e2e/a11y.spec.ts`, `e2e/visual.spec.ts`, `e2e/budget.spec.ts` | Four routes, no profile creation |

**Deleted**

`src/app/history/`, `src/app/stats/`, `src/app/summary/`, `src/app/setup/`, `src/app/profiles.css`, `src/components/profile/`, `src/lib/profiles/`, `src/lib/session/stats.ts`, `src/lib/session/stats.test.ts`, `src/components/charts/TrendChart.tsx`, `src/components/charts/TrendChart.test.tsx`, `src/components/charts/GoalLine.tsx`, `e2e/history.spec.ts`.

---

## Task 1: Split the shared stylesheet

`src/app/history/history.css` is imported by `/drinks` and by `app/profiles.css`, not only by the screens being removed. Deleting it wholesale would silently unstyle `/drinks`, and because this change regenerates the `/drinks` visual baselines, a broken layout would be baked in as correct. Split it first, while everything still works and the existing baselines still guard it.

**Files:**
- Create: `src/styles/surfaces.css`
- Modify: `src/styles/global.css`, `src/app/history/history.css`, `src/app/drinks/page.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `src/styles/surfaces.css`, imported once from `global.css`, providing `.lede`, `.empty`, `.stats`, `.stat`, `.stat__value`

- [ ] **Step 1: Create the shared surface stylesheet**

Create `src/styles/surfaces.css` with the rules moved verbatim out of `history.css`:

```css
/* src/styles/surfaces.css
 *
 * Page-surface styles shared by more than one screen: the lede under a
 * heading, the empty-state box, and the stat blocks. These lived in the
 * history screen's stylesheet and were imported from /drinks, which meant
 * deleting that screen would have quietly unstyled a screen that stays.
 */

.lede { color: var(--color-muted); margin: calc(var(--space-1) * -1) 0 var(--space-3); }

.empty {
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  border: 1px dashed var(--color-line);
  border-radius: var(--radius);
  color: var(--color-muted);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--space-2);
  margin: 0 0 var(--space-4);
}

.stat dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}

.stat__value {
  margin: 0;
  font-size: clamp(1.5rem, 1rem + 2vw, 2.25rem);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.stat__value[data-verdict='pass'] { color: var(--color-pass); }
.stat__value[data-verdict='miss'] { color: var(--color-miss); }
```

- [ ] **Step 2: Import it globally**

In `src/styles/global.css`, add the import after `controls.css`:

```css
@import './tokens.css';
@import './typography.css';
@import './controls.css';
@import './surfaces.css';
```

- [ ] **Step 3: Remove the moved rules from `history.css`**

Delete from `src/app/history/history.css` the `.lede`, `.empty`, `.stats`, `.stat dt`, `.stat__value` and both `.stat__value[data-verdict=…]` rules. Leave `.sessions`, `.session*`, `.rounds` and `.ticket-detail` exactly as they are.

- [ ] **Step 4: Stop `/drinks` importing the history stylesheet**

In `src/app/drinks/page.tsx`, replace:

```tsx
import '@/app/history/history.css';
import '@/components/drinks/drinks.css';
```

with:

```tsx
import '@/components/drinks/drinks.css';
```

`surfaces.css` is global now, so `/drinks` needs no stylesheet import for `.lede` or `.empty`.

- [ ] **Step 5: Verify nothing moved visually**

```bash
npm run lint && npm run typecheck && npm run e2e
```

Expected: PASS, **including the existing visual baselines unchanged**. The rules were moved verbatim, so any screenshot diff here means a rule was dropped or reordered — find it rather than regenerating.

- [ ] **Step 6: Commit**

```bash
git add src/styles/surfaces.css src/styles/global.css src/app/history/history.css src/app/drinks/page.tsx
git commit -m "refactor: lift shared surface styles out of the history stylesheet

/drinks imported the history screen's stylesheet for .lede and .empty. With
that screen about to be deleted, the shared rules move to a global stylesheet
first — deleting history.css with those imports live would have unstyled
/drinks silently, and this change regenerates its baselines, so the breakage
would have been recorded as correct."
```

---

## Task 2: Delete the analytics screens

Removes `/history`, `/stats`, `/summary/[sessionId]`, the cross-session aggregation, and the chart that only ever plotted a cross-session series. `commitSession` stays for now — Task 4 replaces it, and leaving it writing to a key nobody reads for one commit is harmless.

**Files:**
- Delete: `src/app/history/`, `src/app/stats/`, `src/app/summary/`, `src/app/profiles.css`, `src/lib/session/stats.ts`, `src/lib/session/stats.test.ts`, `src/components/charts/TrendChart.tsx`, `src/components/charts/TrendChart.test.tsx`, `src/components/charts/GoalLine.tsx`, `e2e/history.spec.ts`
- Modify: `src/app/page.tsx`, `src/app/play/page.tsx`, `src/components/ui/AppNav.tsx`, `src/components/ui/AppNav.test.tsx`, `src/lib/charts/geometry.ts`, `src/lib/charts/geometry.test.ts`, `src/lib/format/date.ts`, `src/lib/format/date.test.ts`, `e2e/helpers.ts`, `e2e/visual.spec.ts`, `e2e/a11y.spec.ts`, `e2e/budget.spec.ts`

**Interfaces:**
- Consumes: `surfaces.css` from Task 1
- Produces: an `AppNav` whose `ITEMS` are `/` (Profiles), `/setup` (Drill), `/drinks` (Drinks); a `geometry.ts` exporting only `Extent`, `extentOf`, `yFor`

- [ ] **Step 1: Update the nav test first**

Shortening the existing label list would not fail — it asserts that each label
is *present*, and `Profiles`, `Drill` and `Drinks` all still are. Assert the
absence instead, which is the behaviour actually changing.

In `src/components/ui/AppNav.test.tsx`, shorten the label list and add an
absence test beside it:

```tsx
  it('links to every top-level screen', () => {
    render(<AppNav />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    for (const label of ['Profiles', 'Drill', 'Drinks']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('offers no analytics screens', () => {
    render(<AppNav />);
    expect(screen.queryByRole('link', { name: 'History' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stats' })).not.toBeInTheDocument();
  });

  it('marks the screen you are on', () => {
    pathname = '/drinks';
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'Drinks' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Drill' })).not.toHaveAttribute('aria-current');
  });
```

Delete the test named `treats a session summary as part of History` entirely. Keep the `/play` test.

- [ ] **Step 2: Run it to watch it fail**

```bash
npx vitest run src/components/ui/AppNav.test.tsx
```

Expected: FAIL on `offers no analytics screens` — both links still render. If
every test passes, the edit did not save.

- [ ] **Step 3: Trim the nav**

In `src/components/ui/AppNav.tsx`, delete the `owns` field from `NavItem`, drop it from `isCurrent`, and reduce `ITEMS`:

```tsx
interface NavItem {
  readonly href: string;
  readonly label: string;
}

const ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Profiles' },
  { href: '/setup', label: 'Drill' },
  { href: '/drinks', label: 'Drinks' },
];

function isCurrent(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return pathname.startsWith(item.href);
}
```

- [ ] **Step 4: Run it to watch it pass**

```bash
npx vitest run src/components/ui/AppNav.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Delete the screens and their support**

```bash
git rm -r src/app/history src/app/stats "src/app/summary"
git rm src/app/profiles.css
git rm src/lib/session/stats.ts src/lib/session/stats.test.ts
git rm src/components/charts/TrendChart.tsx src/components/charts/TrendChart.test.tsx
git rm src/components/charts/GoalLine.tsx
git rm e2e/history.spec.ts
git rm e2e/visual.spec.ts-snapshots/history-*.png e2e/visual.spec.ts-snapshots/stats-*.png
```

- [ ] **Step 6: Remove the profile screen's stylesheet import**

`src/app/page.tsx` imports `./profiles.css`, which is gone. Replace that import with the global-only styling it now relies on — delete the line:

```tsx
import './profiles.css';
```

The profile screen loses its card grid for one task. That is fine: Task 7 deletes the screen. If it looks wrong in the meantime, it is not worth styling something scheduled for removal.

- [ ] **Step 7: Point the play screen's exits somewhere that exists**

In `src/app/play/page.tsx`, the completion state links to `/summary/…` and `/history`. Replace that paragraph with:

```tsx
        <p className="complete__links">
          {/* The nav is suppressed on /play, so every way off this screen has
              to be offered here or the session ends in a dead end. */}
          <Link href="/setup">Run another</Link>
        </p>
```

- [ ] **Step 8: Drop the now-unused geometry helpers**

`RoundBars` imports only `extentOf` and `yFor`. In `src/lib/charts/geometry.ts`, delete `xFor`, `polylinePoints` and `areaPoints`. In `src/lib/charts/geometry.test.ts`, delete the `describe('xFor')`, `describe('polylinePoints')` and `describe('areaPoints')` blocks and trim the import to:

```ts
import { extentOf, yFor } from '@/lib/charts/geometry';
```

- [ ] **Step 9: Drop the now-unused date formatter**

`formatDate` was only used by the stats screen. In `src/lib/format/date.ts` delete the `formatDate` function and the `DATE` constant's separate use, keeping:

```ts
/**
 * A finished run is read minutes or days later, so it carries the day as well
 * as the time, with a spelled month rather than a numeric form that reads
 * differently by region.
 *
 * `timeZone` exists for tests: left off, this uses the reader's own zone,
 * which is the only correct answer for a device-local app.
 */
const TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
};

export function formatDateTime(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { ...TIME, timeZone }).format(ms);
}
```

In `src/lib/format/date.test.ts`, delete the whole `describe('formatDate')` block and trim the import to `import { formatDateTime } from '@/lib/format/date';`.

- [ ] **Step 10: Strip history seeding and stats from the e2e suites**

In `e2e/helpers.ts`, delete the entire `seedHistory` function (it seeds a session index that no longer exists). Keep `createProfile`, `runSession`, `abandonSession` and `seedSevenDrinks`.

In `e2e/visual.spec.ts`, delete the `stats` and `history` entries from `screens`, and drop `seedHistory` from the import so it reads:

```ts
import { createProfile, seedSevenDrinks } from './helpers';
```

Also drop `/history` and `/stats` from the overflow loop's path list:

```ts
    for (const path of ['/', '/setup', '/drinks']) {
```

In `e2e/a11y.spec.ts`, delete the `history`, `summary` and `stats` entries from `routes`, and drop `runSession` from the import so it reads:

```ts
import { createProfile } from './helpers';
```

In `e2e/budget.spec.ts`, retarget the measured route — replace `const HEAVIEST_ROUTE = '/stats';` with:

```ts
/** The heaviest route: the full drink list, its editor rows and the transfer panel. */
const HEAVIEST_ROUTE = '/drinks';
```

and update both `transferred(browser, HEAVIEST_ROUTE, 'Stats')` calls to `transferred(browser, HEAVIEST_ROUTE, 'Drinks')`. In the core-web-vitals loop replace the route list with `['/', '/setup', '/drinks']`.

- [ ] **Step 11: Verify and regenerate the baselines**

```bash
npm run lint && npm run typecheck && npm test
npx playwright test e2e/visual.spec.ts --update-snapshots
npm run e2e
```

Expected: lint, types and unit tests PASS. Baselines are regenerated because every screen's nav changed. Then the full e2e run PASSES.

- [ ] **Step 12: Confirm the baselines are stable**

```bash
npm run e2e
```

Expected: PASS again. A visual suite that only passes on the run that generated it is not a regression test — if this fails, something on the screen is non-deterministic and must be masked or seeded before moving on.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat!: remove history, stats and the session summary

Cross-session analytics go: nobody compares their times to anyone else's,
and a bartender finishing a drill cares about the run they just did. That
takes /history, /stats, /summary/[sessionId], stats.ts and TrendChart with
it, along with the geometry helpers and date formatter that only those
screens used.

commitSession still runs for one more commit, writing to a key nothing
reads. Task 4 replaces it with the single last-run slot."
```

---

## Task 3: Add last-run storage

A pure addition: one key and three functions, fully tested, before anything depends on them.

**Files:**
- Modify: `src/lib/storage/keys.ts`, `src/lib/session/repository.ts`, `src/lib/session/repository.test.ts`

**Interfaces:**
- Consumes: `SessionRecord` from `@/lib/session/types`, `parseSessionRecord` from `@/lib/session/schema`
- Produces:
  ```ts
  saveLastRun(record: SessionRecord): WriteOutcome
  loadLastRun(): SessionRecord | null
  clearLastRun(): void
  STORAGE_KEYS.lastRun: string
  ```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/session/repository.test.ts`, inside the top-level scope (after the `committed sessions` describe block):

```ts
describe('last run', () => {
  const record = toRecord(createSession('s1', 'p1', config, 1_000));

  it('is null before anything has been run', () => {
    expect(loadLastRun()).toBeNull();
  });

  it('round-trips a finished run', () => {
    saveLastRun(record);
    expect(loadLastRun()).toEqual(record);
  });

  it('keeps only the most recent run', () => {
    saveLastRun(record);
    saveLastRun({ ...record, id: 's2', startedAt: 2_000 });

    const loaded = loadLastRun();
    expect(loaded?.id).toBe('s2');
    expect(loaded?.startedAt).toBe(2_000);
  });

  it('reads a corrupt run as absent rather than throwing', () => {
    window.localStorage.setItem(STORAGE_KEYS.lastRun, '{"id":"s1","rounds":"lots"}');
    expect(loadLastRun()).toBeNull();
  });

  it('clears', () => {
    saveLastRun(record);
    clearLastRun();
    expect(loadLastRun()).toBeNull();
  });

  it('reports a write it could not make', () => {
    expect(saveLastRun(record)).toBe('ok');
  });
});
```

Add the three functions to the existing import from `@/lib/session/repository` at the top of that file:

```ts
import {
  clearActiveSession, clearLastRun, commitSession, loadActiveSession, loadHistory,
  loadLastRun, loadPrefs, loadSession, loadSessionIndex, saveActiveSession,
  saveLastRun, savePrefs,
} from '@/lib/session/repository';
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npx vitest run src/lib/session/repository.test.ts
```

Expected: FAIL with `saveLastRun is not a function` (and `STORAGE_KEYS.lastRun` reading as `undefined`).

- [ ] **Step 3: Add the storage key**

In `src/lib/storage/keys.ts`, add `lastRun` alongside the others:

```ts
const PREFIX = 'ueddl:v1';

export const STORAGE_KEYS = {
  drinks: `${PREFIX}:drinks`,
  profiles: `${PREFIX}:profiles`,
  activeProfile: `${PREFIX}:active-profile`,
  theme: `${PREFIX}:theme`,
  activeSession: `${PREFIX}:active-session`,
  lastRun: `${PREFIX}:last-run`,
  prefs: (profileId: string) => `${PREFIX}:profile:${profileId}:prefs`,
  sessionIndex: (profileId: string) => `${PREFIX}:profile:${profileId}:session-index`,
  session: (sessionId: string) => `${PREFIX}:session:${sessionId}`,
} as const;
```

- [ ] **Step 4: Add the repository functions**

Append to `src/lib/session/repository.ts`:

```ts
/**
 * The one finished run this device keeps, overwritten by the next.
 *
 * Deliberately a single key rather than an index: "only the most recent run
 * matters" is the premise, so there is no second write to keep consistent and
 * no orphan to roll back.
 */
export function saveLastRun(record: SessionRecord): WriteOutcome {
  return writeValue(STORAGE_KEYS.lastRun, record);
}

/** Null for absent or unreadable — a corrupt run must not take down the screen. */
export function loadLastRun(): SessionRecord | null {
  return readValue(STORAGE_KEYS.lastRun, parseSessionRecord);
}

export function clearLastRun(): void {
  removeValue(STORAGE_KEYS.lastRun);
}
```

- [ ] **Step 5: Run them to verify they pass**

```bash
npx vitest run src/lib/session/repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/keys.ts src/lib/session/repository.ts src/lib/session/repository.test.ts
git commit -m "feat: add the last-run storage slot

One key holding one finished run, overwritten by the next. Unlike the
session index it replaces, there is no second write to keep consistent and
so no orphaned-record failure mode to guard against."
```

---

## Task 4: Save the finished run instead of committing to history

Switches the session hook over and deletes the history-writing path it replaces.

**Files:**
- Modify: `src/hooks/useSessionMachine.ts`, `src/hooks/useSessionMachine.test.tsx`, `src/lib/session/repository.ts`, `src/lib/session/repository.test.ts`, `src/lib/storage/keys.ts`

**Interfaces:**
- Consumes: `saveLastRun` from Task 3
- Produces: a `useSessionMachine` that writes `last-run` on completion; a repository with no `commitSession`, `loadSession`, `loadSessionIndex` or `loadHistory`

- [ ] **Step 1: Rewrite the hook's persistence tests**

In `src/hooks/useSessionMachine.test.tsx`, change the import from

```tsx
import { loadActiveSession, loadSession, loadSessionIndex, saveActiveSession } from '@/lib/session/repository';
```

to

```tsx
import { loadActiveSession, loadLastRun, saveActiveSession } from '@/lib/session/repository';
```

Replace the two assertions that read history. Where the test currently reads:

```tsx
    expect(loadSessionIndex('p1')).toEqual(['s1']);
    expect(loadSession('s1')?.rounds).toHaveLength(1);
```

use:

```tsx
    expect(loadLastRun()?.id).toBe('s1');
    expect(loadLastRun()?.rounds).toHaveLength(1);
```

Where it reads:

```tsx
    expect(loadSession('s1')?.completedAt).toBeNull();
    expect(loadSession('s1')?.rounds).toEqual([]);
```

use:

```tsx
    expect(loadLastRun()?.completedAt).toBeNull();
    expect(loadLastRun()?.rounds).toEqual([]);
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npx vitest run src/hooks/useSessionMachine.test.tsx
```

Expected: FAIL — `loadLastRun()` returns `null`, because the hook still writes through `commitSession`.

- [ ] **Step 3: Switch the hook over**

In `src/hooks/useSessionMachine.ts`, change the import:

```ts
import {
  clearActiveSession, loadActiveSession, saveActiveSession, saveLastRun,
} from '@/lib/session/repository';
```

and the completion branch of `apply`:

```ts
    stateRef.current = next;
    let outcome;
    if (next.status === 'complete') {
      outcome = saveLastRun(toRecord(next));
      // Only clear the crash-recovery backup once the write actually lands —
      // if it fails (e.g. quota), the backup is the only copy of every
      // completed round, and deleting it here would destroy the run React
      // still has rendered on screen.
      if (outcome === 'ok') clearActiveSession();
    } else {
      outcome = saveActiveSession(next);
    }
```

- [ ] **Step 4: Run them to verify they pass**

```bash
npx vitest run src/hooks/useSessionMachine.test.tsx
```

Expected: PASS, including the existing regression test that a failed write leaves the crash-recovery backup intact.

- [ ] **Step 5: Delete the history-writing path**

From `src/lib/session/repository.ts` delete `parseIdList`, `loadSessionIndex`, `commitSession`, `loadSession` and `loadHistory`. The import line is unchanged: `parseSessionRecord` is still used, by `loadLastRun`.

From `src/lib/storage/keys.ts` delete `sessionIndex` and `session`.

From `src/lib/session/repository.test.ts` delete the whole `describe('committed sessions')` and `describe('history')` blocks, and trim the import to:

```ts
import {
  clearActiveSession, clearLastRun, loadActiveSession, loadLastRun,
  loadPrefs, saveActiveSession, saveLastRun, savePrefs,
} from '@/lib/session/repository';
```

Remove the now-unused `vi` import if nothing else in the file uses it.

- [ ] **Step 6: Verify the whole suite**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: PASS. Coverage should rise, since the deleted code included the least-covered branches in the repository.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat!: save the finished run to one slot instead of to history

The session hook writes last-run where it used to commit to a per-profile
index. commitSession, loadSession, loadSessionIndex and loadHistory go with
it, and so does the two-write rollback they needed — with one key there is
no second write that can fail.

The crash-safety rule is unchanged: the active-session backup is cleared
only once the last-run write has actually landed."
```

---

## Task 5: The results screen

**Files:**
- Create: `src/app/results/page.tsx`, `src/app/results/results.css`
- Modify: `src/components/ui/AppNav.tsx`, `src/components/ui/AppNav.test.tsx`, `src/app/play/page.tsx`, `e2e/helpers.ts`, `e2e/visual.spec.ts`, `e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: `loadLastRun` from Task 3; `RoundBars` from `@/components/charts/RoundBars`; `formatDateTime`, `formatDuration`, `difficultyLabel`, `averageMs`, `secondsPerUnit`, `verdict`
- Produces: a `/results` route whose `<h1>` is `Last run`; a nav item `Last run` at `/results`; `seedLastRun(page)` in `e2e/helpers.ts`

- [ ] **Step 1: Add the nav entry, test first**

In `src/components/ui/AppNav.test.tsx`, extend the label list:

```tsx
    for (const label of ['Profiles', 'Drill', 'Last run', 'Drinks']) {
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/components/ui/AppNav.test.tsx
```

Expected: FAIL — `Unable to find an accessible element with the role "link" and name "Last run"`.

- [ ] **Step 3: Add the nav item**

In `src/components/ui/AppNav.tsx`:

```tsx
const ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Profiles' },
  { href: '/setup', label: 'Drill' },
  { href: '/results', label: 'Last run' },
  { href: '/drinks', label: 'Drinks' },
];
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run src/components/ui/AppNav.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Create the results stylesheet**

Create `src/app/results/results.css`. These are the per-round rules that lived in `src/app/history/history.css`, reproduced in full here because Task 2 deleted that file:

```css
/* src/app/results/results.css — the per-round breakdown of one finished run. */

.rounds {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 var(--space-3);
  font-variant-numeric: tabular-nums;
}

.rounds th, .rounds td { padding: var(--space-1); text-align: right; border-bottom: 1px solid var(--color-line); }
.rounds th[scope='col'] { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-muted); }
.rounds th[scope='row'] { text-align: left; }
.rounds td[data-verdict='pass'] { color: var(--color-pass); }
.rounds td[data-verdict='miss'] { color: var(--color-miss); }

.ticket-detail { border-bottom: 1px solid var(--color-line); padding: var(--space-1) 0; }
.ticket-detail summary { cursor: pointer; color: var(--color-muted); }
.ticket-detail ul { margin: var(--space-1) 0 0; padding-left: var(--space-3); }

.results__actions { display: flex; gap: var(--space-2); margin: var(--space-4) 0 0; flex-wrap: wrap; }
```

- [ ] **Step 6: Create the results screen**

Create `src/app/results/page.tsx`:

```tsx
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
```

- [ ] **Step 7: Link the completion screen to it**

In `src/app/play/page.tsx`, replace the completion state's links paragraph:

```tsx
        <p className="complete__links">
          {/* The nav is suppressed on /play, so every way off this screen has
              to be offered here or the session ends in a dead end. */}
          <Link href="/results">View last run</Link>
          <Link href="/setup">Run another</Link>
        </p>
```

- [ ] **Step 8: Add a deterministic last-run seed for the e2e suites**

Append to `e2e/helpers.ts`:

```ts
/**
 * Writes a fixed finished run straight to storage.
 *
 * The generator is random by design, so a screenshot of a real run differs
 * every time. Fixed numbers give the bars a real shape to be compared against
 * and make the baseline mean something.
 */
export async function seedLastRun(page: Page): Promise<void> {
  await page.evaluate(() => {
    const durations = [214_000, 238_000, 261_000, 226_000, 249_000];
    const rounds = durations.map((durationMs, index) => ({
      index,
      ticket: [{ drinkId: 'seeded', name: 'Seeded Drink', categoryId: 'shot', quantity: 13 }],
      totalUnits: 13,
      startedAt: 0,
      endedAt: durationMs,
      pausedMs: 0,
      durationMs,
    }));

    // A fixed epoch instant, not an offset from now: a date that moves is one
    // more thing for a baseline to disagree with tomorrow.
    const startedAt = Date.UTC(2026, 0, 5, 19, 42);
    localStorage.setItem('ueddl:v1:last-run', JSON.stringify({
      id: 'seeded-run',
      profileId: 'seeded-profile',
      startedAt,
      completedAt: startedAt + 1,
      config: {
        roundCount: 5, difficultyId: 'standard', band: [12, 16], goalMs: 240_000,
        categoryIds: ['shot', 'well', 'cocktail', 'martini'],
      },
      rounds,
    }));
  });
}
```

> `profileId` is still required by `sessionRecordSchema` until Task 7 removes it. Task 7's step list deletes this line.

- [ ] **Step 9: Add the screen to the visual and accessibility sweeps**

In `e2e/visual.spec.ts`, import `seedLastRun` and add a `results` entry to `screens`, before `drinks`:

```ts
  {
    name: 'results',
    go: async (page) => {
      await seedLastRun(page);
      await page.goto('/results');
      await expect(page.getByRole('heading', { name: 'Last run' })).toBeVisible();
    },
  },
```

In `e2e/a11y.spec.ts`, add a `results` entry to `routes`:

```ts
  {
    name: 'results',
    open: async (page) => {
      await page.getByRole('link', { name: 'Last run' }).click();
      await expect(page.getByRole('heading', { name: 'Last run' })).toBeVisible();
    },
  },
```

- [ ] **Step 10: Verify and regenerate**

```bash
npm run lint && npm run typecheck && npm test
npx playwright test e2e/visual.spec.ts --update-snapshots
npm run e2e && npm run e2e
```

Expected: all PASS, twice. The second run is the stability check — `/results` is fully seeded, so it must be pixel-identical between runs.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add the last-run screen

/results reads the single cached run and shows it round by round: the
average against the goal, the bars, per-round times with seconds-per-drink,
and each round's ticket. It survives a refresh and is linked from the nav,
so a mis-tap at the finish line no longer costs the run."
```

---

## Task 6: Finish into `/results`, and Start over

**Files:**
- Modify: `src/hooks/useSessionMachine.ts`, `src/hooks/useSessionMachine.test.tsx`, `src/app/play/page.tsx`, `src/components/play/play.css`, `e2e/helpers.ts`, `e2e/drill.spec.ts`

**Interfaces:**
- Consumes: `/results` from Task 5
- Produces: `SessionMachine.startOver(): void`; a `/play` with no completion state, which replaces the route with `/results` on completion and with `/` on Start over

- [ ] **Step 1: Write the failing test for `startOver`**

Append inside the existing top-level `describe` in `src/hooks/useSessionMachine.test.tsx`:

```tsx
  it('records nothing when a run is scrapped', async () => {
    saveActiveSession(createSession('s1', 'p1', config, 0));
    const { result } = renderHook(() => useSessionMachine());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => { result.current.startRound(); });
    act(() => { result.current.startOver(); });

    // The point of Start over: a scrapped run must not become the saved result.
    expect(loadLastRun()).toBeNull();
    expect(loadActiveSession()).toBeNull();
    expect(result.current.state).toBeNull();
  });
```

Match the imports and setup helpers already used by that file — it imports `renderHook`, `act` and `waitFor` from `@testing-library/react`, and `createSession` from `@/lib/session/machine`. Add `loadLastRun` to the repository import if Task 4 has not already.

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/hooks/useSessionMachine.test.tsx
```

Expected: FAIL with `result.current.startOver is not a function`.

- [ ] **Step 3: Add `startOver` to the hook**

In `src/hooks/useSessionMachine.ts`, add to the `SessionMachine` interface, after `end()`:

```ts
  /** Scraps the run: nothing is recorded, and the backup is discarded. */
  startOver(): void;
```

Add the callback next to the others:

```ts
  const startOver = useCallback(() => {
    // Deliberately not routed through `apply`: every other action persists
    // what it produces, and the whole point of this one is that nothing about
    // the scrapped run is written anywhere.
    clearActiveSession();
    stateRef.current = null;
    setStorageWarning(null);
    setState(null);
  }, []);
```

and include it in the returned object:

```ts
    startRound, pause, resume, advance, end, startOver,
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run src/hooks/useSessionMachine.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Redirect on completion and add the button**

In `src/app/play/page.tsx`:

Add `useRouter` to the imports:

```tsx
import { useRouter } from 'next/navigation';
```

Take the router and add the redirect effect, after the existing `currentStatus` declaration and before the keyboard effect:

```tsx
  const router = useRouter();

  // A finished run is shown on /results, not here — one screen renders a
  // finished run whether you have just finished it or come back to it later.
  // `replace`, not `push`: Back must not return to a /play whose session has
  // already been cleared.
  useEffect(() => {
    if (currentStatus === 'complete') router.replace('/results');
  }, [currentStatus, router]);
```

Delete the entire `if (status === 'complete') { … }` block. A completed session now renders nothing here for the one frame before the redirect lands; the `status === 'resting'` branch below is unaffected.

Add Start over to both action rows. In the resting branch:

```tsx
        <p className="play-actions">
          <button className="is-primary" onClick={machine.startRound}>Start round {rounds.length + 1}</button>
          <button className="is-quiet" onClick={confirmStartOver}>Start over</button>
        </p>
```

and in the running/paused branch:

```tsx
      <p className="play-actions">
        <button className="is-primary" onClick={machine.advance}>Next round</button>
        <button onClick={status === 'paused' ? machine.resume : machine.pause}>
          {status === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button className="is-quiet" onClick={confirmStartOver}>Start over</button>
      </p>
```

Define the handler above the `if (!hydrated)` guard, alongside the other destructured actions:

```tsx
  const confirmStartOver = () => {
    // One question, because there is no undo: the run is not written anywhere.
    if (!window.confirm('Start over? This run will not be saved.')) return;
    machine.startOver();
    router.replace('/');
  };
```

Named `confirmStartOver`, not `startOver`: this file already destructures the
machine's actions into locals at the top, and a second `startOver` in the same
scope would be a redeclaration rather than a shadow. Both buttons above call
`confirmStartOver`.

- [ ] **Step 6: Give the quiet button room**

Append to `src/components/play/play.css`:

```css
/* Start over sits beside the primary action but must never compete with it:
   the common case is finishing the round, not scrapping the run. */
.play-actions .is-quiet { margin-left: auto; }
```

- [ ] **Step 7: Update the e2e helpers for the new destination**

In `e2e/helpers.ts`, `runSession` and `abandonSession` both assert on headings that no longer exist. Change `runSession`'s final assertion to:

```ts
  await expect(page.getByRole('heading', { name: 'Last run' })).toBeVisible();
```

and `abandonSession`'s to:

```ts
  await expect(page.getByRole('heading', { name: 'Last run' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Ended early');
```

- [ ] **Step 8: Cover the new behaviour end to end**

Append to `e2e/drill.spec.ts`:

```ts
test('a finished run lands on the results screen and survives a refresh', async ({ page }) => {
  await createProfileAndOpenSetup(page);
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();

  for (let round = 1; round <= 3; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);

  await page.reload();
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);
});

test('starting over records nothing', async ({ page }) => {
  await createProfileAndOpenSetup(page);
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await page.getByRole('button', { name: 'Next round' }).click();
  await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start over' }).click();

  await expect(page.getByRole('heading', { name: 'Set up a session' })).toBeVisible();
  await page.getByRole('link', { name: 'Last run' }).click();
  await expect(page.getByRole('main')).toContainText('No run on this device yet');
});

test('a second run replaces the first', async ({ page }) => {
  // The premise of the whole revision: one slot, overwritten. Covered at unit
  // level too, but this is the path a second person walking up actually takes.
  await createProfileAndOpenSetup(page);
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  for (let round = 1; round <= 3; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);

  await page.getByRole('link', { name: 'Run another' }).click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  for (let round = 1; round <= 5; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  // Five rows plus a header — the three-round run is gone, not appended to.
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(6);
});

test('a declined start over leaves the session running', async ({ page }) => {
  await createProfileAndOpenSetup(page);
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Start over' }).click();

  await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();
});
```

- [ ] **Step 9: Verify and regenerate**

```bash
npm run lint && npm run typecheck && npm test
npx playwright test e2e/visual.spec.ts --update-snapshots
npm run e2e && npm run e2e
```

Expected: all PASS twice. The play-resting and play-running baselines change — Start over is a new button on both.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: finish into /results, and add Start over

A finished run is shown in one place. /play replaces the route with
/results on completion rather than rendering its own copy of the summary,
so Back cannot land on a session that has already been cleared.

Start over is the fix for a bad round: it scraps the run and records
nothing. It is deliberately not routed through the reducer's apply path,
because every other action persists what it produces and this one must not."
```

---

## Task 7: Delete profiles and move setup to `/`

The largest task, and the one that cannot be split: the setup screen reads the active profile to key its prefs, so removing profiles and moving the screen are the same edit.

**Files:**
- Delete: `src/components/profile/`, `src/lib/profiles/`, `src/app/setup/`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/lib/session/types.ts`, `src/lib/session/schema.ts`, `src/lib/session/machine.ts`, `src/lib/session/machine.test.ts`, `src/lib/session/repository.ts`, `src/lib/session/repository.test.ts`, `src/lib/storage/keys.ts`, `src/hooks/useSessionMachine.ts`, `src/hooks/useSessionMachine.test.tsx`, `src/components/ui/AppNav.tsx`, `src/components/ui/AppNav.test.tsx`, `src/app/play/page.tsx`, `e2e/helpers.ts`, all e2e specs

**Interfaces:**
- Consumes: everything from Tasks 3–6
- Produces:
  ```ts
  createSession(id: string, config: SessionConfig, startedAt: number): SessionState
  savePrefs(config: SessionConfig): WriteOutcome
  loadPrefs(): SessionConfig | null
  STORAGE_KEYS.prefs: string   // no longer a function
  ```
  and a `SessionRecord`/`SessionState` with no `profileId`

- [ ] **Step 1: Update the types and the schema**

In `src/lib/session/types.ts`, delete `profileId` from `SessionRecord`:

```ts
export interface SessionRecord {
  readonly id: string;
  readonly startedAt: number;
  /** null means ended early — kept and shown, marked as such. */
  readonly completedAt: number | null;
  readonly config: SessionConfig;
  readonly rounds: readonly RoundRecord[];
}
```

In `src/lib/session/schema.ts`, delete the `profileId` line from `sessionRecordSchema`:

```ts
export const sessionRecordSchema = z.object({
  id: z.string().min(1),
  startedAt: z.number(),
  completedAt: z.number().nullable(),
  config: sessionConfigSchema,
  rounds: z.array(roundRecordSchema),
});
```

> Zod object schemas strip unknown keys rather than rejecting on them, so a session stored by the previous version — which carries `profileId` — still parses and resumes. That is intended: someone mid-drill when the app updates keeps their session.

In `src/lib/session/machine.ts`, drop the parameter from `createSession` and from `toRecord`:

```ts
/** A session opens resting: "before round 1" and "between rounds" are one state. */
export function createSession(
  id: string, config: SessionConfig, startedAt: number,
): SessionState {
  return { id, config, status: 'resting', startedAt, completedAt: null, current: null, rounds: [] };
}
```

```ts
export function toRecord(state: SessionState): SessionRecord {
  return {
    id: state.id,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    config: state.config,
    rounds: state.rounds,
  };
}
```

Also delete `profileId` from the `SessionState` interface in that file.

- [ ] **Step 2: Make prefs device-level**

In `src/lib/storage/keys.ts`, reduce to five keys:

```ts
const PREFIX = 'ueddl:v1';

export const STORAGE_KEYS = {
  drinks: `${PREFIX}:drinks`,
  theme: `${PREFIX}:theme`,
  prefs: `${PREFIX}:prefs`,
  activeSession: `${PREFIX}:active-session`,
  lastRun: `${PREFIX}:last-run`,
} as const;
```

In `src/lib/session/repository.ts`:

```ts
/** Device-level: the next person to walk up inherits the last setup used. */
export function savePrefs(config: SessionConfig): WriteOutcome {
  return writeValue(STORAGE_KEYS.prefs, config);
}

export function loadPrefs(): SessionConfig | null {
  return readValue(STORAGE_KEYS.prefs, parseSessionConfig);
}
```

- [ ] **Step 3: Run the suite to see exactly what breaks**

```bash
npm run typecheck
```

Expected: FAIL, with errors in `machine.test.ts`, `repository.test.ts`, `useSessionMachine.test.tsx`, `src/app/setup/page.tsx` and `src/app/page.tsx`. This is the worklist for the next steps — read it rather than guessing.

- [ ] **Step 4: Fix the unit tests**

Across `src/lib/session/machine.test.ts`, `src/lib/session/repository.test.ts` and `src/hooks/useSessionMachine.test.tsx`, replace every `createSession('s1', 'p1', config, …)` with `createSession('s1', config, …)`, every `savePrefs('p1', cfg)` with `savePrefs(cfg)`, and every `loadPrefs('p1')` with `loadPrefs()`.

In `repository.test.ts` the prefs tests assert that one profile's prefs are invisible to another:

```ts
    expect(loadPrefs('p2')).toBeNull();
```

Delete that assertion — there is one prefs slot now — and rewrite that test as:

```ts
  it('round-trips a session config for the device', () => {
    const custom = { ...config, roundCount: 10, goalMs: 180_000 };
    savePrefs(custom);
    expect(loadPrefs()).toEqual(custom);
  });

  it('returns null for corrupt prefs', () => {
    window.localStorage.setItem(STORAGE_KEYS.prefs, '{"roundCount":"five"}');
    expect(loadPrefs()).toBeNull();
  });
```

- [ ] **Step 5: Move the setup screen to `/`**

Replace the whole contents of `src/app/page.tsx` with the current contents of `src/app/setup/page.tsx`, with these changes:

- delete `import { useProfiles } from '@/components/profile/ProfileProvider';`
- move the stylesheet with `git mv src/app/setup/setup.css src/app/setup.css`. The
  import line `import './setup.css';` is unchanged — it was relative to
  `src/app/setup/` and is now relative to `src/app/`, resolving either way.
- delete the `const { hydrated, activeProfile } = useProfiles();` line
- replace the effect with one that does not depend on a profile:

```tsx
  useEffect(() => {
    // A deliberate one-time-after-mount load from storage, not a subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrinks(loadDrinkList());
    setConfig(loadPrefs() ?? defaultSessionConfig());
  }, []);
```

- replace both guards with one:

```tsx
  if (drinks === null) return <main><p>Loading…</p></main>;
```

- replace the lede with a device-level line:

```tsx
      <p className="lede">Defaults come from the last session run on this device.</p>
```

- rewrite `start` without the profile:

```tsx
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
```

Then delete the old route:

```bash
git rm -r src/app/setup
```

- [ ] **Step 6: Delete the profile system**

```bash
git rm -r src/components/profile src/lib/profiles
```

In `src/app/layout.tsx`, delete the `ProfileProvider` import and unwrap the children:

```tsx
      <body>
        <StorageBanner />
        <header className="app-header">
          {/* AppNav removes itself during a round; the theme control stays,
              because changing the palette does not navigate away from one. */}
          <AppNav />
          <ThemeToggle />
        </header>
        {children}
      </body>
```

- [ ] **Step 7: Retarget every remaining `/setup` link**

In `src/components/ui/AppNav.tsx`:

```tsx
const ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Drill' },
  { href: '/results', label: 'Last run' },
  { href: '/drinks', label: 'Drinks' },
];
```

In `src/components/ui/AppNav.test.tsx`, update the label list to `['Drill', 'Last run', 'Drinks']` and change the `marks the screen you are on` test to use `/results`:

```tsx
  it('marks the screen you are on', () => {
    pathname = '/results';
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'Last run' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Drinks' })).not.toHaveAttribute('aria-current');
  });
```

In `src/app/play/page.tsx` and `src/app/results/page.tsx`, change every `href="/setup"` to `href="/"`.

- [ ] **Step 8: Rewrite the e2e helpers**

In `e2e/helpers.ts`, delete `createProfile` entirely and rewrite the journeys to start from `/`:

```ts
/** Runs a session end to end and leaves the browser on /results. */
export async function runSession(page: Page, rounds: 3 | 5 | 10 = 3): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: String(rounds), exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();

  for (let round = 1; round <= rounds; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  await expect(page.getByRole('heading', { name: 'Last run' })).toBeVisible();
}

/** Starts a session, runs one round, then ends it early with Escape. */
export async function abandonSession(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await page.getByRole('button', { name: 'Next round' }).click();

  await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Escape');

  await expect(page.getByRole('heading', { name: 'Last run' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Ended early');
}
```

Delete the `profileId: 'seeded-profile',` line from `seedLastRun` — the schema no longer accepts it as meaningful and leaving it is misleading.

- [ ] **Step 9: Rewrite the specs that created a profile**

Every spec begins by creating a profile. Replace those openings:

- `e2e/drill.spec.ts` — replace `createProfileAndOpenSetup(page)` with `await page.goto('/')`, and delete the helper's definition at the top of the file.
- `e2e/drinks.spec.ts` — replace `openDrinks`'s body:

```ts
async function openDrinks(page: import('@playwright/test').Page) {
  await page.goto('/drinks');
  await expect(page.getByRole('heading', { name: 'Drinks', level: 1 })).toBeVisible();
}
```

  and inside `an 86d drink is never dealt`, replace `page.getByRole('link', { name: 'Drill' }).click()` with `page.goto('/')`.
- `e2e/a11y.spec.ts` — delete `createProfile(page)` from the test body, replace it with `await page.goto('/')`, and change the `setup` route entry to open `/` directly. Rename that entry from `setup` to `drill`.
- `e2e/visual.spec.ts` — in `open`, replace `createProfile(page)` with `await page.goto('/')`; in `startRound`, replace the Drill link click with `await page.goto('/')`; rename the `setup` screen to `drill` and have it assert the heading at `/`.
- `e2e/budget.spec.ts` — no profile creation; only the route names need to be correct.

- [ ] **Step 10: Verify**

```bash
npm run lint && npm run typecheck && npm run test:coverage
```

Expected: PASS, with coverage at or above the 80% floor on every metric.

- [ ] **Step 11: Regenerate the baselines and confirm stability**

```bash
lsof -ti :3100 | xargs -r kill -9
rm -rf e2e/visual.spec.ts-snapshots
npx playwright test e2e/visual.spec.ts --update-snapshots
npm run e2e && npm run e2e
```

Expected: PASS twice. The whole baseline set is regenerated: the nav changed on every screen and the setup screen moved.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat!: remove profiles; setup becomes the landing screen

An unbounded number of people share the device and none of them will make
an account, so the profile gate in front of the drill goes. SessionRecord
loses profileId, prefs become device-level, and /setup moves to / so
opening the app puts you one tap from drilling.

No migration: a session stored by the previous version still parses, since
Zod strips unknown keys, so anyone mid-drill when the app updates keeps
their session. Old profile keys are inert."
```

---

## Task 8: Update the documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-08-21-single-run-drill-design.md`, `docs/superpowers/specs/2026-08-19-deferred-findings.md`

**Interfaces:**
- Consumes: the finished implementation
- Produces: docs that match the code

- [ ] **Step 1: Mark the revision as implemented**

In `docs/superpowers/specs/2026-08-21-single-run-drill-design.md`, change the status line:

```markdown
**Status:** Implemented
```

- [ ] **Step 2: Fold the resolved findings into the ledger**

In `docs/superpowers/specs/2026-08-19-deferred-findings.md`, move these into the "Resolved since the MVP" section, since the code carrying them is gone:

- the `/summary/[sessionId]` dynamic-route note — the route no longer exists, so every route is static again
- `StorageBanner` reactivity on the history screen, if the parked wording is scoped to it
- the "deleting a profile orphans its sessions" item — there are no profiles and no session index

Add to "Added by" a new section for this revision:

```markdown
## Added by the single-run revision

- **Only one run is kept per device.** Two people drilling back to back means
  the first person's run is gone. Intended, not a limitation — see
  `2026-08-21-single-run-drill-design.md` §1.
- **No migration was written.** Old profile keys, session records and
  per-profile prefs sit inert in `localStorage` until the browser is cleared.
  A one-line cleanup on boot would remove them; it protects nobody today.
- **A bad round cannot be corrected, only scrapped.** Deliberate: retyping a
  time makes the record an opinion. If real use shows people scrapping long
  Rush sessions over one mis-tap, the decision to revisit is per-round
  discard, not per-round editing.
```

- [ ] **Step 3: Verify the docs match the code**

```bash
grep -rn "profileId\|loadHistory\|commitSession\|/stats\|/history\|/summary" src e2e || echo "no stale references"
```

Expected: `no stale references`. Anything printed here is either a real leftover or a doc that still describes the old shape.

- [ ] **Step 4: Final full verification**

```bash
lsof -ti :3100 | xargs -r kill -9
rm -rf .next
npm run build && npm run lint && npm run typecheck && npm run test:coverage && npm run e2e
```

Expected: all PASS, and the build's route table shows exactly four routes plus `/_not-found`, **all static** — the dynamic `/summary/[sessionId]` is gone.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: bring the specs in line with the single-run implementation"
```

---

## What this plan deliberately leaves out

| Not doing | Why |
|---|---|
| Migrating or cleaning up old `localStorage` keys | Pre-release; they are inert and protect nobody |
| Per-round discard or edit | Explicitly decided against — the clock is the only score |
| Exporting a finished run | Nobody asked for it; the drink list already has export |
| Keeping more than one run | The premise of the revision is that only the most recent matters |
| A search or filter on `/drinks` | Not in the spec; grouping by category already makes 95 rows navigable |
| Restoring `useHydrated` | A pre-existing parked finding, unrelated to this change |
