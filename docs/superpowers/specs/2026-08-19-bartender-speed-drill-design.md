# Bartender Speed Drill — Design Spec

**Date:** 2026-08-19
**Status:** Partly superseded — see below
**Repo:** `ultimate-elite-drink-list`

> **Superseded in part by
> [`2026-08-21-single-run-drill-design.md`](./2026-08-21-single-run-drill-design.md).**
>
> That revision removes profiles and cross-session history: the app keeps one
> run, the most recent, on the device. Read it alongside the following sections,
> which it overrides —
>
> - **§3.4 Profiles** — deleted entirely; there are no users
> - **§8 Screens** — `/history`, `/stats` and `/summary/[sessionId]` are gone,
>   `/setup` moves to `/`, and `/results` replaces them
> - **§9 Metrics** — the metrics still hold *within* a run; everything about
>   history, trends and personal bests does not
> - **§14 Build order** — phases 4 and 6 are withdrawn rather than completed
> - **§16 Decision log** — two rows reversed, marked inline below
>
> Everything else here still stands and still describes the code: the drill
> loop, generation, timing, the drink list and its transfer format, the visual
> direction, error handling, accessibility, and the performance budget.

> **Also changed since, and not part of that revision:** the on/off control on
> `/drinks` was relabelled from **86** to **Exclude / Include** (2026-08-23).
> Behaviour is unchanged — the drink stays on the list and is never dealt — and
> `Drink.enabled` is still the field behind it. The trade's word survives in the
> code comments, where it explains the domain rather than gatekeeping a toggle.

---

## 1. What this is

A service-speed training drill for bartenders. Each round deals a randomized
"ticket" of 7 drinks with quantities. The bartender makes them for real, then
advances. The app records how long each round took, shows every round's time,
and tracks the running average against a target (default 4:00).

**It is not a knowledge quiz.** Nothing is graded, no recipes are stored, no
answers are entered. The only score is the clock.

### Primary user & context

One or several bartenders sharing a device in a training room or at home —
laptop or tablet, controlled lighting, screen viewed up close. This drives a
dense, review-oriented layout with real charts and keyboard shortcuts, not a
billboard-type bar-top UI.

### Non-goals (v1)

- No accounts, no sign-in, no server, no database
- No cloud sync or shared leaderboard across devices
- No recipes, ingredients, or correctness grading
- No per-drink split times inside a round (round is the unit of measurement)
- No PWA install or offline service worker
- No bar-top / wet-hands mobile-first mode

---

## 2. Architecture

**Next.js (App Router) + TypeScript, statically served on Vercel. No backend,
no API routes, no database.** Every screen is a client component; all state
lives in the browser.

Rationale: zero-config Vercel deploy, routes map cleanly to screens, and if a
shared leaderboard is ever wanted it becomes an additive change rather than a
rewrite. A Vite SPA would ship a smaller bundle but trade away that path.

### Module layout

```text
src/
├── app/
│   ├── page.tsx                    # profile select
│   ├── setup/page.tsx
│   ├── play/page.tsx
│   ├── summary/[sessionId]/page.tsx
│   ├── history/page.tsx
│   ├── stats/page.tsx
│   └── drinks/page.tsx
├── components/
│   ├── play/          Ticket, RoundClock, RestCard, PauseOverlay
│   ├── setup/         RoundCountPicker, DifficultyPicker, GoalPicker, CategoryFilter
│   ├── drinks/        DrinkTable, DrinkEditorRow, ImportDialog
│   ├── charts/        TrendChart, RoundBars, GoalLine       # hand-rolled SVG
│   └── ui/            Button, Card, Stat, Dialog, TabularNumber
├── hooks/
│   ├── useSessionMachine.ts
│   ├── useElapsed.ts
│   ├── useWakeLock.ts
│   └── useReducedMotion.ts
├── lib/
│   ├── drinks/        types.ts, schema.ts, repository.ts, seedMerge.ts
│   ├── session/       machine.ts, generator.ts, metrics.ts, repository.ts
│   ├── profiles/      types.ts, repository.ts
│   ├── storage/       keys.ts, localStore.ts
│   └── format/        duration.ts
├── data/
│   └── seed-drinks.ts
└── styles/            tokens.css, typography.css, global.css
```

**Boundary rule:** `lib/storage/localStore.ts` is the only module that touches
the `localStorage` API. Repositories are the only consumers of `localStore`.
Components and hooks talk to repositories and never to storage. Swapping to
IndexedDB later is a change to `localStore` alone.

---

## 3. Data model

### 3.1 Drinks

The 8-vs-2 quantity cap belongs to the **category**, not the drink. A drink
carrying both `category` and `isShot` can hold contradictory state; hanging
`maxQuantity` off the category makes that unrepresentable, and the category
table is required by the filter feature anyway.

**Categories are code-owned; drinks are user-owned.** `CategoryId` is a closed
union, so a typo anywhere in the codebase is a compile error and the category
set cannot drift at runtime. The consequence: the Manage screen edits *drinks*
only — adding a category is a code change. With shot/well/cocktail/martini
covering the menu, that trade buys real type safety for a feature nobody asked
for. Categories are therefore **not persisted** and never appear in storage or
export files; they are read from `seed-drinks.ts` at every boot.

```ts
// src/lib/drinks/types.ts

export type CategoryId = 'shot' | 'well' | 'cocktail' | 'martini';
export type DrinkId = string;

export interface Category {
  readonly id: CategoryId;
  readonly label: string;
  /** Max quantity dealable for drinks in this category. Shots: 8. Everything else: 2. */
  readonly maxQuantity: number;
}

export interface Drink {
  readonly id: DrinkId;
  readonly name: string;
  readonly categoryId: CategoryId;
  /** Exclude a drink from drills without deleting it — seasonal, off-menu, not stocked. */
  readonly enabled: boolean;
}

export interface DrinkListState {
  readonly schemaVersion: number;
  readonly seedVersion: number;
  readonly drinks: readonly Drink[];
  /** Seed drinks the user deleted, so a later seed update never resurrects them. */
  readonly removedSeedIds: readonly DrinkId[];
}
```

Stored as an **array, not a keyed record** — display order is meaningful on the
Manage screen and the list is tens of items. An `id → Drink` `Map` is derived at
read time, never persisted.

**IDs:** seed drinks use stable slugs (`seed:green-tea-shot`) so a future deploy
can add defaults by id-diff without duplicating existing rows. User-added drinks
use `crypto.randomUUID()`.

> **Maintenance rule — once v1 ships, change a drink's `name`, never its `id`.**
> Seed merge and `removedSeedIds` both key on id. Renaming an id after release
> silently orphans that drink's `enabled` state and resurrects it as a brand-new
> seed on every existing device, even for users who deleted it. Renaming ids is
> free only while `SEED_VERSION` is 1 and nothing has been deployed.

### 3.2 The seed, in the repo

`src/data/seed-drinks.ts` is a TypeScript module rather than JSON, so a typo in
a `categoryId` fails the build instead of shipping:

```ts
export const SEED_VERSION = 1;

export const SEED_CATEGORIES = [
  { id: 'shot',     label: 'Shots',       maxQuantity: 8 },
  { id: 'well',     label: 'Well Drinks', maxQuantity: 2 },
  { id: 'cocktail', label: 'Cocktails',   maxQuantity: 2 },
  { id: 'martini',  label: 'Martinis',    maxQuantity: 2 },
] as const satisfies readonly Category[];

export const SEED_DRINKS = [
  { id: 'seed:green-tea-shot',   name: 'Green Tea Shot',   categoryId: 'shot',     enabled: true },
  { id: 'seed:vodka-soda',       name: 'Vodka Soda',       categoryId: 'well',     enabled: true },
  { id: 'seed:espresso-martini', name: 'Espresso Martini', categoryId: 'martini',  enabled: true },
] as const satisfies readonly Drink[];
```

One line per drink so it reads like a spreadsheet and a real list can be pasted
straight in.

**The v1 list is delivered — 91 drinks**, mechanically verified to have no
duplicate ids or names, no malformed ids, and no undeclared categories:

| Category | Drinks | Filtered-drill viability |
|---|---|---|
| Shots | 31 | Deep |
| Cocktails | 26 | Deep |
| Well Drinks | 21 | Deep |
| Martinis | 13 | Playable — thinnest pool, and the case that drives §6's freshness rule |

### 3.3 Sessions

```ts
export interface TicketLine {
  readonly drinkId: DrinkId;
  readonly name: string;        // snapshot at deal time
  readonly categoryId: CategoryId;
  readonly quantity: number;
}

export interface RoundRecord {
  readonly index: number;       // 0-based
  readonly ticket: readonly TicketLine[];
  readonly totalUnits: number;
  readonly startedAt: number;   // epoch ms
  readonly endedAt: number;     // epoch ms
  readonly pausedMs: number;
  readonly durationMs: number;  // endedAt − startedAt − pausedMs
}

export interface SessionConfig {
  readonly roundCount: number;
  readonly difficultyId: string;
  readonly band: readonly [number, number];
  readonly goalMs: number;
  readonly categoryIds: readonly CategoryId[];
}

export interface SessionRecord {
  readonly id: string;
  readonly profileId: string;
  readonly startedAt: number;
  readonly completedAt: number | null;   // null = abandoned
  readonly config: SessionConfig;
  readonly rounds: readonly RoundRecord[];
}
```

`TicketLine.name` is snapshotted so renaming or deleting a drink never rewrites
past sessions. `SessionConfig` is snapshotted so the stats screen compares like
with like instead of averaging a Rush session against a Warm-up.

### 3.4 Profiles

```ts
export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
}
```

Profiles exist to separate history on a shared device. They are **not** auth —
there is no password and no privacy boundary between them.

---

## 4. Storage

JSON strings under versioned, namespaced keys. **The drink list is
device-global; history is per-profile** — everyone behind one bar drills the
same menu.

| Key | Holds |
|---|---|
| `ueddl:v1:drinks` | `DrinkListState` (shared) |
| `ueddl:v1:profiles` | `Profile[]` (shared) |
| `ueddl:v1:profile:<pid>:prefs` | last-used `SessionConfig` |
| `ueddl:v1:profile:<pid>:session-index` | `SessionId[]`, newest first |
| `ueddl:v1:session:<sid>` | one completed `SessionRecord` |
| `ueddl:v1:active-session` | in-progress `SessionRecord`, for crash recovery |

**One key per session** rather than one array: sessions are append-only and
immutable once complete, so a finished session is an O(1) write regardless of
history depth, and one corrupt record cannot take the whole history with it.

### Payload shape

`ueddl:v1:drinks`, verbatim — note the absence of `categories`:

```json
{
  "schemaVersion": 1,
  "seedVersion": 1,
  "drinks": [
    { "id": "seed:green-tea", "name": "Green Tea", "categoryId": "shot", "enabled": true },
    { "id": "a3f9c1e2-...", "name": "House Pickleback", "categoryId": "shot", "enabled": false }
  ],
  "removedSeedIds": ["seed:blow-job"]
}
```

### Read path

```text
raw string → JSON.parse → Zod validate → seed-merge → derive id→Drink Map
```

Zod at the boundary means hand-edited, truncated, or foreign data cannot reach
the generator. On validation failure the store falls back to the seed (for
drinks) or an empty collection (for history) rather than throwing, and surfaces
a dismissible warning.

**Seed merge** runs when `stored.seedVersion < SEED_VERSION`: add every seed
drink whose id is absent from `drinks` and absent from `removedSeedIds`, then
bump `seedVersion`. User edits are never overwritten
and deleted seeds are never resurrected.

### Why localStorage

The 91-drink list is ~9KB; a 5-round session is ~1.5KB, so 500 sessions sits
under 1MB against a 5MB quota. The synchronous read at boot also avoids a flash
of empty state on every screen. Quota errors are caught and surfaced as "storage
full — export and prune history".

---

## 5. Export / import

The only way to move a menu between devices or survive a browser wipe.

**Export** (`/drinks` → Export): downloads `ueddl-drinks-YYYY-MM-DD.json` via a
Blob + `<a download>`:

```json
{
  "kind": "ueddl.drink-list",
  "schemaVersion": 1,
  "exportedAt": 1755600000000,
  "drinks": [ ... ],
  "removedSeedIds": [ ... ]
}
```

`removedSeedIds` travels with the file so deletions survive the round trip.

**Import** (`/drinks` → Import): file picker → parse → Zod validate → verify
`kind` and `schemaVersion` → **reject any drink whose `categoryId` falls outside
the compiled union** → show a diff preview (`N added · N changed · N removed`)
→ confirm. Two modes on the confirm dialog:

- **Replace** (default) — the file becomes the list. The backup-restore case.
- **Merge** — union by id; the file wins on conflicting ids.

Import touches the drink list only; profiles and session history are never
modified. A malformed file produces a specific inline error naming the problem
and writes nothing — no partial application.

---

## 6. Round generation

Pure function with an injected RNG so tests are deterministic:

```ts
dealRound(pool: Drink[], categories: Map<CategoryId, Category>,
          band: [number, number], previous: DrinkId[],
          rng: () => number): TicketLine[]
```

1. Select **7 distinct** drinks from the pool (enabled ∩ selected categories)
   via partial Fisher–Yates.
2. Compute the achievable total range: floor `7` (all at x1), ceiling
   `Σ maxQuantity` of those 7.
3. Pick target `T` uniformly from `band ∩ achievable`. If that intersection is
   empty, clamp `T` to the nearest achievable endpoint.
4. Seed every line at x1, then distribute the remaining `T − 7` units one at a
   time, each to a uniformly-random line that still has headroom
   (`quantity < maxQuantity`).

Step 4 has a useful emergent property: surplus units land on shots, because
shots are the lines with headroom left. Realistic-looking tickets fall out of
the algorithm rather than from special-casing.

**Repeat avoidance — two-tier, no threshold.** Partition the pool into *fresh*
(not dealt last round) and *stale* (dealt last round). Shuffle each; take up to
7 from fresh, then top up from stale only if fresh runs short.

The rule this replaces — "exclude the previous round when the pool has at least
N" — has a cliff at N. Below it freshness is off entirely; at or above it,
exclusion is absolute. The 13-drink martini pool falls below any sensible N and
would get no freshness at all. Two-tier has no constant to tune, applies at every
pool size from 7 upward, and is maximally fresh at all of them: martinis deal
6 fresh + 1 stale, shots draw 7 from 24 fresh.

**Known and accepted:** at a pool of exactly 14 the fresh tier is exactly 7, so
consecutive rounds alternate between two fixed drink sets (quantities still
re-roll each round). That is forced by arithmetic rather than by the rule —
choosing 7 distinct drinks that avoid the previous 7 out of 14 has exactly one
solution, and no repeat-avoidance policy can escape it. None of the seeded
categories sits at 14. A test documents the behavior so it is not mistaken for
a bug.

**Guards:**

- Pool under 7 drinks → Setup blocks the start with a specific message
  ("Shots only has 5 drinks enabled; a round needs 7").
- Band unreachable for the selected categories (non-shots cap at 14 total, so
  Rush 18–24 is impossible) → Setup warns at configure time, not mid-session.

### Difficulty presets

Bands are **raw drink units**, not effort-weighted.

| Preset | Band (units) |
|---|---|
| Warm-up | 8–11 |
| Standard (default) | 12–16 |
| Rush | 18–24 |

---

## 7. Session flow & timing

### State machine

```text
idle ──start──▶ running ──advance──▶ resting ──startNext──▶ running ──▶ … ──▶ complete
                  │  ▲                                                      ▲
               pause│  │resume                            (advance on last round)
                  ▼  │
                paused
```

`resting` is an **indefinite hold** — the clock is stopped and that gap counts
toward nothing. The next round begins only on an explicit tap.

**The next round's ticket stays hidden until Start is pressed.** Revealing it
during an untimed rest would let the bartender read ahead, and the timer would
stop measuring anything.

### Timing math

All recorded values derive from `Date.now()` timestamps.

**The real trade, stated honestly.** Wall-clock stamps are correct across
reloads and backgrounding — which crash recovery depends on, since it spans
reloads by design — and they are **not monotonic** under a clock adjustment. An
NTP step or manual change mid-round can move time backwards. That is accepted.
`performance.now()` is not the fix it appears to be: it is monotonic only within
one document, and its origin resets on every reload, so recovery would need both
clocks persisted and a rule for which measured what.

What is *not* accepted is doing it silently. `Math.max(0, …)` turns a backwards
jump into a plausible short round, the one outcome that corrupts data without
telling anyone. A round whose end precedes its start is marked suspect and
excluded from averages rather than clamped into looking fine.

**No accumulating interval counter is ever the source of truth** — a tick counter drifts and is
throttled or frozen when the tab is backgrounded, which would silently corrupt
the one number this app exists to measure. A 100ms interval exists solely to
trigger re-renders of the displayed clock.

```ts
// live elapsed while running
elapsed = Date.now() - startedAt - pausedMs - (isPaused ? Date.now() - pausedAt : 0)

// recorded on advance
durationMs = endedAt - startedAt - pausedMs
```

**Mid-round pause** exists in addition to the between-round hold: a real
interruption during practice would otherwise poison the round's data.

**Crash recovery:** the active session is written to `ueddl:v1:active-session`
on every state transition. On boot, an unfinished session offers
"Resume session in progress?" with the alternative to discard it. Resuming
re-enters `resting` (never mid-round) so no wall-clock time accrues while the
app was closed.

**Wake lock:** `navigator.wakeLock` is requested during `running` and released
on `resting`/`complete`. Feature-detected; failure is silent and non-blocking.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Advance round / start next round |
| `P` | Pause / resume |
| `Esc` | End session early (confirm dialog) — saves it with `completedAt: null`, so it appears in history but is excluded from averages and bests |

---

## 8. Screens

| Route | Purpose |
|---|---|
| `/` | Profile select / create / rename / delete |
| `/setup` | Round count, difficulty, goal time, category filter → Start |
| `/play` | The session: `running`, `paused`, `resting`, `complete` |
| `/summary/[sessionId]` | Full breakdown of one session |
| `/history` | Past sessions for the active profile |
| `/stats` | Cross-session analytics |
| `/drinks` | Manage drinks (add / rename / recategorize / exclude / delete), export, import — categories are fixed in code |

### Setup

- **Rounds** — quick picks 3 / 5 / 10, custom 1–20. Default **5**.
- **Difficulty** — Warm-up / Standard / Rush. Default **Standard**.
- **Goal per round** — default **4:00**, adjustable 1:00–15:00 in 15s steps.
- **Categories** — multi-select, all on by default.

Defaults come from the profile's last-used config. Guards from §6 render inline
and disable Start.

### Play

Running state shows: round `n / N`, the ticket (drink name left, quantity right,
tabular numerals), the clock, and one primary advance button. Total units for
the round are shown so the bartender knows the size of what they're looking at.

Resting state shows: that round's time, pass/miss against the goal, the running
average, and `Start round n+1`. The next ticket is not rendered.

Complete state shows the session summary inline and offers Save & view / Run
again with the same config.

### Stats

- Lifetime totals: sessions, rounds, drinks made.
- **Trend chart** — session average per session over time, with the goal as a
  reference line.
- **Round bars** — every round of the most recent N sessions, colored pass/miss.
- **Pace** — seconds-per-unit over time, the metric comparable across presets.
- **Personal bests** — best session average (per difficulty), best single round
  by seconds-per-unit, longest streak of consecutive rounds under goal.

Charts are **hand-rolled inline SVG** in `components/charts/`, not a charting
library. Only two chart forms are needed; a library would cost ~100KB gzipped
against a bundle budget, and hand-rolled SVG keeps the visualization inside the
design system with full control over both themes.

---

## 9. Metrics

**Display precision:** all times render as `m:ss`, never tenths — a tenths digit
on a four-minute clock is jitter, not information. Milliseconds are stored, so
finer formatting stays available without a data migration.

```ts
roundDurationMs   = endedAt - startedAt - pausedMs
roundVerdict      = roundDurationMs <= goalMs ? 'pass' : 'miss'
sessionAverageMs  = mean(rounds.map(r => r.durationMs))     // completed rounds only
sessionVerdict    = sessionAverageMs <= goalMs
secondsPerUnit    = roundDurationMs / 1000 / totalUnits
```

`secondsPerUnit` is the honest cross-session comparison: bands make rounds
similar, not identical, and presets make them deliberately different.

Abandoned sessions (`completedAt === null`) are kept and visible in history but
**excluded from averages, trends, and personal bests**.

---

## 10. Visual direction

Not a default template. The metaphor is a **bar ticket rail**: the round's
drinks sit on a paper docket against a dark back-bar ground, and the clock is
the hero element on the screen.

> **The bug this table originally shipped.** `--color-ink` was listed identically
> in both themes because it was conceived as ink *printed on the paper docket* —
> and the spec never defined a token for text on `--color-ground`. The
> implementation faithfully used `--color-ink` for `body`, putting
> `oklch(20%)` text on an `oklch(16%)` background: **1.07:1 contrast**, against a
> WCAG AA floor of 4.5:1. Every heading and the hero clock were invisible in dark
> mode until a round went over goal and the clock flipped to `--color-miss`.
> `--color-ink-on-ground` exists to keep those two jobs separate.

**Both themes are first-class and the metaphor holds in each** — dark reads as
the back bar at night, light as prep in daylight. The app follows the system
preference by default and exposes an explicit toggle that overrides it; the
choice persists per device. Neither theme is a dimmed copy of the other: each
gets its own token values tuned for contrast.

**Palette** (`styles/tokens.css`, oklch, tokens only — no hardcoded values):

```css
:root {
  color-scheme: light dark;

  --color-ground:  oklch(96% 0.008 85);
  --color-docket:  oklch(99% 0.004 85);
  /* Text ON the docket. Dark in BOTH themes — the paper stays light. */
  --color-ink:     oklch(20% 0.010 60);
  /* Text on the page ground. This is the one that must flip with the theme. */
  --color-ink-on-ground: oklch(20% 0.010 60);
  --color-accent:  oklch(62% 0.130 75);   /* brass */
  --color-pass:    oklch(52% 0.150 150);
  --color-miss:    oklch(52% 0.190 25);
}

/* dark values, defined once and applied in both directions */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --color-ground:  oklch(16% 0.010 60);
    --color-docket:  oklch(96% 0.012 85);
    --color-ink:     oklch(20% 0.010 60);
    --color-ink-on-ground: oklch(92% 0.008 85);
    --color-accent:  oklch(74% 0.130 75);
    --color-pass:    oklch(72% 0.160 150);
    --color-miss:    oklch(60% 0.190 25);
  }
}
:root[data-theme='dark'] {
  --color-ground:  oklch(16% 0.010 60);
  --color-docket:  oklch(96% 0.012 85);
  --color-ink:     oklch(20% 0.010 60);
  --color-ink-on-ground: oklch(92% 0.008 85);
  --color-accent:  oklch(74% 0.130 75);
  --color-pass:    oklch(72% 0.160 150);
  --color-miss:    oklch(60% 0.190 25);
}
```

`--color-ink-on-ground` must appear in **all three** blocks. Defining it only in
`:root` leaves it stuck at the light value under a dark theme, reproducing the
1.07:1 bug under a new name. Measured after the fix: **16.14:1 light, 15.33:1
dark**.

**Typography** — two families, no more:

1. A **condensed grotesk** for drink names and headings, echoing a printed menu
   board and letting long drink names hold one line.
2. A grotesk with **true tabular figures** (`font-variant-numeric: tabular-nums`)
   for the clock, quantities, and all body text. Non-tabular numerals make a
   running clock visibly jitter.

`font-display: swap`; only the single critical weight is preloaded.

**Motion** — `transform` / `opacity` / `clip-path` only. The docket slides in on
round start; the pass/miss verdict scales in on rest. Everything respects
`prefers-reduced-motion`, which drops to opacity-only.

**Hierarchy** — the clock is by far the largest element; drink names sit a full
step below it; quantities are accented in brass and right-aligned on a rail so
they scan as a column.

---

## 11. Error handling

| Failure | Behavior |
|---|---|
| Corrupt/foreign `drinks` blob | Fall back to seed, dismissible warning |
| Corrupt session record | Skip that session in history, others unaffected |
| localStorage quota exceeded | Inline error: export and prune history |
| localStorage unavailable (private mode) | App runs in-memory; persistent banner that nothing will be saved |
| Import file malformed | Named inline error, nothing written |
| Pool under 7 drinks | Start disabled with a specific reason |
| Band unreachable for categories | Warning at Setup, band clamped at deal time |
| Wake lock denied | Silent, non-blocking |

No error is silently swallowed. Every failure either surfaces to the user or
degrades to a stated, visible fallback.

---

## 12. Testing

TDD throughout; 80% coverage floor.

**Unit (Vitest)**
- `generator` with a seeded RNG: exactly 7 distinct lines; every quantity within
  its category cap; total inside the band when achievable; correct clamping when
  not; two-tier freshness at pool sizes 7, 13 (the martini case: 6 fresh +
  1 stale) and 31; no round is ever the forced complement of its predecessor;
  pools of exactly 7 and of 6.
- `metrics`: durations with and without pauses; average excludes abandoned;
  seconds-per-unit; verdict boundaries at exactly the goal (`<=` is a pass).
- `drinks/repository`: parse, validate, reject foreign shapes and unknown
  `categoryId`s, seed-merge adds new seeds, never overwrites edits, never
  resurrects `removedSeedIds`.
- `format/duration`: `m:ss` boundaries, zero, and over an hour.

**Integration (React Testing Library, fake timers)**
- A full 3-round session driven through the machine, asserting recorded
  durations against controlled clock advances.
- Pause mid-round excludes paused time from the recorded duration.
- Resting reveals no ticket; the next ticket appears only after Start.
- Setup guards disable Start for an undersized pool.
- Export → Import round-trip reproduces the list exactly (both modes).
- Crash recovery: seeded active-session offers resume and restores in `resting`.

**E2E (Playwright)**
- Create profile → configure → run a full session → summary → history → stats.
- Refresh mid-session and resume.
- Keyboard-only run using `Space` / `P` / `Esc`.
- Export downloads a file; import applies it.

**Visual regression** — screenshots at 320 / 768 / 1024 / 1440 for Setup, Play
(running), Play (resting), Stats, Drinks, in **both themes**.

**Accessibility** — axe on every route; full keyboard navigation; visible focus;
reduced-motion path; contrast verified against both palettes. The clock is **not**
a live region — announcing every tick would be hostile — and carries a static
label naming what it measures; the round verdict announces once on entry to
`resting` via `aria-live="polite"`.

---

## 13. Performance budget

**< 215KB JS gzipped total**, **< 30KB CSS**, LCP < 2.5s, CLS < 0.1,
INP < 200ms. LCP and CLS are asserted per route from the browser's own
`PerformanceObserver` rather than via Lighthouse, which would add a heavy
dependency to a project whose entire performance story is "ship no libraries"
to report the same two numbers. INP is not asserted: it needs real interaction
and is too noisy locally to be anything but a flaky test that gets ignored.

**Corrected a third time, and this correction changes what is being measured.**
A total-JS budget turned out to be a measurement of Next.js, not of this
codebase. On Next 16.3.1 / React 19.2.8, Next's own built-in 404 page — the
framework with no application code on it at all — transfers **197.5KB
gzipped**. The 175KB total was therefore unreachable before a single line of
this app was written, and hitting it was never within the project's control.

Measured on the finished application: **203.2KB** on the heaviest route
(`/stats`), against that **197.5KB** floor. **The whole application is 5.7KB
gzipped.** Every route lands between 198 and 204KB, because essentially all of
it is framework.

`e2e/budget.spec.ts` enforces a **215KB total ceiling** on the heaviest route —
about 12KB of headroom, enough that ordinary feature work passes and a charting
or date library does not — plus a **100KB floor**, because the failure most
worth catching in a byte measurement is one that silently captured nothing. It
also asserts the runtime dependency list is still exactly `next`, `react`,
`react-dom`, `zod`, which is the check that actually defends §13: a 40KB
library landing on one route barely moves a total.

Differencing the app against a measured framework floor was tried first and
abandoned. Inside the test runner that floor read anywhere from 8.5KB to
197.5KB depending on Chromium's cache and on whether `load` fired before the
chunks arrived, so the "app size" it produced was an artifact. Waiting on
rendered, hydrated content and disabling the network cache fixed the
measurement; differencing against a second route was simply not worth its
fragility once a total ceiling does the same job.

CSS measures **4.2–4.8KB gzipped** per route against the 30KB budget.

The stack lever from the original note still stands and is now the *only* lever
on the total: a Vite SPA baseline is roughly 45KB against Next's 197.5KB. That
is a Task 1-scoped change, and nothing about the application code — which is
5.7KB — would have to move.

**Corrected twice, and the second correction reverses the first.** The 300KB
app-page tier was set on evidence measured at an `<h1>`-only scaffold, where the
framework runtime alone consumed 87% of the original 150KB. That projection was
wrong: app code lands in per-route chunks, not the shared bundle. The finished
application measures **126.6KB gzipped** shared first-load — under the original
figure. A 300KB ceiling nothing will approach is not a budget, so it is set to
175KB, close enough that a real regression trips it.

The original reasoning, kept because the measurement was real even though the
projection from it was not: Measured at the Task 1 scaffold — a page containing nothing but
an `<h1>` — the Next.js App Router + React framework runtime already costs
**~130KB gzipped** across the chunks every route loads (excluding the polyfill
chunk, which modern browsers skip). The original 150KB figure left roughly 20KB
for every feature in the app, and Zod alone is ~13KB of that. The number was not
reachable with the stack this spec selected; it was aspirational, not a budget.

CSS is comfortable: the scaffold's production stylesheet is 939 bytes gzipped
against 30KB, so the token-based approach has ample room.

The disciplines that made the tight number plausible all still hold and are what
keep this from drifting toward 300KB: no charting library (§8), no animation
library, no icon package, and dynamic imports for anything heavy. If the smaller
budget matters more than the framework, the lever is swapping Next.js for a Vite
SPA — roughly 45KB baseline instead of 130KB — which is a Task 1-scoped change,
not a rewrite. No charting library, no animation library, no icon
package — inline SVG only. This is the main reason charts are hand-rolled.

---

## 14. Build order

Phased so each phase is independently verifiable:

1. **Foundation** — types, Zod schemas, `localStore`, the three repositories,
   seed + seed-merge, profiles. Fully unit-tested with no UI.
2. **Generator** — `dealRound` and its guards, against a seeded RNG.
3. **Drill loop** — session machine, `/setup` and `/play`, timing, pause,
   crash recovery. The app becomes usable at the end of this phase.
4. **History & summary** — `/summary/[sessionId]`, `/history`, metrics.
5. **Manage & transfer** — `/drinks`, export, import.
6. **Stats & charts** — `/stats`, hand-rolled SVG charts.
7. **Polish** — visual direction, both themes, motion, a11y pass, visual
   regression baselines, Lighthouse.

---

## 15. Risks & open items

**Risks**

- *Clearing browser data destroys everything.* Mitigated by export; the Manage
  screen nudges toward an export after any bulk edit. Accepted consequence of a
  no-backend design.
- *Backgrounded-tab timing.* Mitigated by timestamp arithmetic plus wake lock.
  Explicitly covered by tests.
- *Preset bands are guesses.* They are a single constants table, tunable after
  real drills without touching the generator.

**Open items**

1. **Category placement of the shaken sours** — Midori Sour, Amaretto Sour and
   Tom Collins sit under Well Drinks but are shaken/built rather than
   two-ingredient pours. Quantities are unaffected (both cap at 2); it only
   changes what a "Well Drinks" filtered drill feels like.
   **Resolved by feature, not by decision:** `/drinks` (Plan 3) recategorises
   any drink in two clicks and the change persists per device, so this is now a
   preference each bar sets rather than something the seed has to get right.
   Left where they are, because moving them would be one opinion imposed on
   everyone rather than the default that matches the list as supplied.
2. **`Vodka or Gin Gimlet`** names two different builds in a single ticket line,
   which is ambiguous mid-round.
   **Resolved.** Split into `Vodka Gimlet, Rocks` and `Gin Gimlet, Rocks`.
   Writing this as an invariant — no seed name may contain " or " — caught a
   second instance this list had missed, `Classic Martini (Gin or Vodka)`, now
   `Gin Martini` and `Vodka Martini`. `SEED_VERSION` went to 2; the cocktail and
   martini pools each gained a drink. Guarded by a test in
   `src/lib/drinks/schema.test.ts`, so it cannot come back.
3. **Exact band numbers** — Warm-up 8–11 / Standard 12–16 / Rush 18–24 are
   starting values to calibrate against actual round times.
   **Still open, and only real drills can close it.** Nothing in the codebase
   can supply the evidence; the numbers are a single constants table in
   `lib/session/config.ts` and `/stats` now reports seconds-per-drink, which is
   the measurement to calibrate them against.
4. **Font selection** — two specific families to be chosen at implementation
   against the condensed-display + tabular-figures requirement.
   **Resolved.** **Archivo Narrow** for drink names and headings: a condensed
   grotesque with enough weight to read as a printed docket, where Oswald reads
   as signage and Barlow Condensed as neutral. **IBM Plex Sans** for the clock,
   quantities and body: true tabular figures, and squared instrument-like
   terminals that suit a timer, without Inter's ubiquity. Loaded through
   `next/font/google`, self-hosted at build time, `display: swap`; only Plex is
   preloaded, since it sets every string a round is actually read from.

---

## 16. Decision log

| Decision | Choice | Why |
|---|---|---|
| Core loop | Physical speed drill, no grading | The score is the clock; no recipe data needed |
| Drink list | Seeded in code, edited on device | Customizable per bar without a redeploy |
| Users | ~~Local named profiles~~ → **none** | *Reversed 2026-08-21.* An unbounded number of people share the device and none of them will make an account |
| Quantities | Workload-banded, raw units | Uniform random swings ~8×, making the 4:00 goal meaningless |
| Band units | Raw drinks, not effort-weighted | Simpler; nothing to mis-tune |
| Between rounds | Indefinite untimed hold | User-specified |
| Configurable | Rounds, difficulty, goal, categories | All four requested |
| Environment | Desktop/tablet-first, dense | Training room, not bar top |
| Scope | ~~Drill + analytics~~ → **drill + the run you just did** | *Reversed 2026-08-21.* Nobody compares their times to anyone else's, or to their own from last month |
| Stack | Next.js static on Vercel, no backend | Vercel-native; leaves room for a future leaderboard |
| Timing | `Date.now()` deltas, never tick accumulation | Interval counters drift and freeze when backgrounded |
| Categories | Closed union, code-owned | Compile-time safety; runtime category creation is a feature nobody asked for |
| Repeat avoidance | Two-tier fresh/stale | A fixed threshold alternates between two fixed tickets at its boundary |
| Charts | Hand-rolled SVG | Two chart forms vs ~100KB and a foreign visual language |
