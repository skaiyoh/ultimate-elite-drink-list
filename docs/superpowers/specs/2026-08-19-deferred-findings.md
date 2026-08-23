# Deferred findings

Findings that review judged not to block a merge and deliberately left. They
are inputs to later work, not a backlog of unknown quality.

**Two provenance caveats.** The MVP-era items below were extracted by grep from
the SDD ledger before its scratch workspace was deleted, and many are truncated
mid-sentence; git history is the fuller record. Items added after the MVP are
written out in full.

---

## Resolved since the MVP

- **`commitSession` performed two non-atomic writes.** A session record written
  without its index entry was unreachable from history forever, and the caller
  was told `'ok'`, so it cleared the crash-recovery backup holding the only
  other copy. The record is now rolled back when the index write fails, turning
  silent data loss into a reported failure. `session/repository.ts`. (Both the
  function and the index it guarded were later removed by the single-run
  revision; kept here as the record of what was fixed when.)
- **`useWakeLock` was effectively untested** at 27% line coverage — jsdom ships
  no Wake Lock API, so every path past the feature check was unreached. Now
  covered, including the race where a lock is granted after the round has ended,
  which would otherwise hold a user's screen awake indefinitely.
- **Sessions were written but never read back.** Plan 2 added `/history`,
  `/summary/[sessionId]` and `/stats`. (All three routes were later removed by
  the single-run revision; kept here as the record of what was fixed when.)
- **Two seed drinks named two builds in one ticket line** (spec §15 item 2).
  Split, and the invariant is now a test.
- **Font selection** (spec §15 item 4). Archivo Narrow + IBM Plex Sans.
- **Brass was unreadable as text.** `--color-accent` is tuned as a fill with
  dark text on it; used as text it measured 3.29:1 on the light ground and
  failed on the light docket in dark mode. Split into `--color-accent-ink` and
  `--color-accent-on-docket`.
- **Undersized tap targets.** Nav links and the theme switch were 18px tall
  against WCAG 2.2's 24px minimum.
- **`/summary/[sessionId]` was a dynamic route** (`ƒ`), not static — Next
  could not enumerate session ids at build time, against spec §2's
  "statically served on Vercel". The single-run revision deletes the route
  along with `/history` and `/stats`; every route is static again.
- **Deleting a profile orphaned its sessions.** The records and the profile's
  session index stayed in storage, unreachable, with nothing reclaiming the
  space. The single-run revision deletes profiles and the session index
  entirely, so there is nothing left to orphan.

---

## Still deferred

### Storage boundary

- `persistent` in `localStore` is a one-way latch with no recovery within a
  session — once any access throws, the app stays in memory mode until reload.
- Quota detection is an `error.name` string match against two known values;
  a browser reporting a third name degrades to `'unavailable'` rather than
  `'quota'`, which shows the wrong message.
- `localStore.test.ts` has no reset hook for the module-level `memory` map and
  `persistent` flag, so tests in that file are order-coupled.
- `StorageBanner` only re-evaluates `isPersistent()` on its own render, and the
  layout banner does not reactively update if storage starts failing mid-session.

### Drinks and the generator

- **(Highest priority of the MVP-era minors, and truncated in extraction.)**
  Task 4's finding about the "never overwrites a user…" path in `mergeSeed`.
  The behaviour is tested; the finding concerned a gap in how, not whether.
- `repository.test.ts:57` hardcodes `'ueddl:v1:drinks'` instead of importing
  `STORAGE_KEYS`.
- No test for `selectDrinks` with a pool of exactly 7 *and* an empty previous
  round — the boundary where two-tier freshness has nothing stale to draw on.
- `selectDrinks` still throws when the pool drops below 7, and `startRound`
  does not guard that documented throw. Unreachable through the UI because the
  setup guard blocks Start, but it is a throw with no catch behind it.
- Stray leading blank line in `rng.ts:1`.

### Session machine

- The reducer trusts caller-supplied timestamps. Flagged as a design
  refinement rather than a bug, and worth a decision rather than a patch.
- `session/schema.ts:7` keeps a redundant Zod-3-era tuple cast on
  `difficultyIds`; Zod 4 infers this without help, as `drinks/schema.ts`
  already does.

### Components

- `useHydrated` is not unused — `StorageBanner.tsx` imports and calls it. Two
  other sites hand-roll the identical load-once-after-mount idiom instead of
  reusing it, each with its own eslint-disable: `src/hooks/useSessionMachine.ts`
  and `src/app/page.tsx`.

---

## Added by Plans 2–4

- **Visual regression baselines are platform-specific**
  (`…-chromium-darwin.png`). Run on another OS they differ on font
  rasterisation alone. Regenerate rather than debug, and expect to do so if CI
  is ever added on Linux.
- **INP is not asserted.** LCP and CLS are measured per route from the
  browser's own observers; INP needs real interaction and was too noisy locally
  to be anything but a flaky test that gets ignored.
- **Difficulty bands are still uncalibrated** (spec §15 item 3). Only real
  drills can close it. `/results` now reports seconds-per-drink on its
  per-round table, which is the measurement to calibrate against.
- **The `/drinks` table has no search or filter.** Ninety-odd rows are grouped
  by category, which makes them navigable, but finding one drink by name means
  scanning. Deliberately not invented, since the spec does not ask for it.

---

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
