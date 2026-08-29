# Single-Run Drill — Design Revision

**Date:** 2026-08-21
**Status:** Implemented
**Repo:** `ultimate-elite-bartending`
**Revises:** `2026-08-19-bartender-speed-drill-design.md` §3.4, §8, §9, §14, §16

---

## 1. Why this changes

The original spec chose local named profiles and cross-session analytics on the
reasoning that a shared training device needs to separate history per person,
and that "review value is where the payoff is at a desk."

Practice says otherwise. The device is used by an unbounded number of people
who will not create profiles, nobody is comparing their times against anyone
else's, and a bartender finishing a drill cares about the run they just did —
not a trend across six weeks. Profiles and history are cost carrying no payoff:
a gate in front of the drill, a persisted index to keep consistent, and four
screens of analytics nobody opens.

This revision cuts both. What remains is the drill and the run you just did.

**Accepted consequence, stated plainly:** there is exactly one saved run per
device. If Sam drills and then Nathan drills, Sam's run is gone. That is the
intended behaviour, not a limitation to work around later — "only the most
recent run matters" is the whole premise of this revision.

---

## 2. What changes

| | Before | After |
|---|---|---|
| Who is drilling | Named profiles, selected before setup | Nobody. Anyone walks up and starts |
| Sessions kept | Every session, indexed per profile | One: the most recent |
| Analytics | Trend, pace, round bars, personal bests, across sessions | The run you just did |
| Screens | 7 | 4 |
| Correcting a bad round | — (none existed) | Start over. No per-round edit |

---

## 3. Screens

| Route | Purpose |
|---|---|
| `/` | Set up a session — rounds, difficulty, goal, categories → Start |
| `/play` | The run: `running`, `paused`, `resting`, `complete` |
| `/results` | How the last run went |
| `/drinks` | Manage the menu, export, import |

`/setup` moves to `/`: the profile screen currently at `app/page.tsx` is
replaced by the setup screen's content, and `app/setup/` is removed. There is
no profile gate in front of it, so opening the app puts you one tap from
drilling. `/history`, `/stats` and `/summary/[sessionId]` are removed.

Navigation is **Drill · Last run · Drinks**, suppressed on `/play` exactly as
now: leaving mid-round discards it, so a nav bar one stray tap away from that
stays a trap worth avoiding.

---

## 4. Storage

Five keys, all device-local, none of them about a person:

```text
ueddl:v1:drinks           the menu
ueddl:v1:theme            light / dark / system
ueddl:v1:prefs            last-used session config
ueddl:v1:active-session   crash recovery; cleared when the run ends
ueddl:v1:last-run         one slot, overwritten by the next completed run
```

`prefs` loses its profile segment and becomes device-level. The next person to
walk up inherits the previous person's setup, which is right for a bar that
drills one way.

Removed: `profiles`, `active-profile`, `profile:<id>:prefs`,
`profile:<id>:session-index`, `session:<id>`.

**No cross-device visibility, by construction.** There is no backend, so a run
written to `localStorage` is already invisible to every other browser and
device. Nothing needs building to guarantee it.

### The two-write problem disappears

`commitSession` wrote a session record and then a per-profile index entry, and
a failure between the two orphaned the record — fixed earlier by rolling the
record back. With one key there is no second write and no rollback to get
right. The fix and the failure mode both go away with the index.

---

## 5. Data model

`profileId` leaves both types. Nothing else about them changes:

```ts
export interface SessionRecord {
  readonly id: string;
  readonly startedAt: number;
  readonly completedAt: number | null;   // null = ended early
  readonly config: SessionConfig;
  readonly rounds: readonly RoundRecord[];
}
```

`RoundRecord`, `TicketLine`, `SessionConfig` and `DifficultyId` are unchanged.
`Profile` is deleted.

### Repository surface

Added to `lib/session/repository.ts`:

```ts
saveLastRun(record: SessionRecord): WriteOutcome
loadLastRun(): SessionRecord | null
clearLastRun(): void
```

Removed: `commitSession`, `loadHistory`, `loadSession`, `loadSessionIndex`.
`saveActiveSession`, `loadActiveSession`, `clearActiveSession`, `savePrefs` and
`loadPrefs` stay, with `savePrefs`/`loadPrefs` losing their `profileId`
argument.

---

## 6. Finishing, and stopping early

Three ways a session ends. They are not the same and must not be collapsed:

| | Trigger | Recorded | Where you land |
|---|---|---|---|
| **Complete** | Last round advanced | Cached as the last run | `/results` |
| **End early** | `Esc`, with a confirm | Cached, marked ended early | `/results` |
| **Start over** | Button, with a confirm | **Nothing** | `/` |

**Start over** is the answer to a bad round. A round is immutable once it is
recorded and there is no per-round edit, by decision: a screen where you retype
what you think a round should have been turns the record into an opinion, and
this app's whole thesis is that the only score is the clock. If you forgot to
pause, hit the wrong button, or walked away with the timer running, you scrap
the run and go again.

It is a button rather than a keyboard shortcut, and it confirms first. `Esc`
keeps its existing meaning — "I only had time for three of five, show me how
those went" — because that is a legitimate result, not a mistake.

The crash-safety rule from the existing code carries over unchanged: the
active-session backup is cleared only once the last-run write has actually
landed. If the write fails, the backup is the only copy of what you just did.

### Where `/play` sends you

On entering `complete` — by finishing the last round or by `Esc` — `/play`
writes the run and then **replaces** the route with `/results`. `replace`
rather than `push`, so Back does not return to a `/play` whose session has
already been cleared.

This deletes `/play`'s inline completion state entirely rather than leaving two
screens rendering the same summary. `/results` is the one place a finished run
is shown, whether you have just finished it or come back to it later.

`Start over` likewise replaces the route with `/`. It is offered while
`running`, `paused` and `resting` — every state in which there is a session to
scrap — and never on a screen where there is nothing to lose.

`/play` opened with no active session keeps its current behaviour: it says so
and offers a link to set one up.

---

## 7. The results screen

`/results` reads `last-run` and shows, for that one run:

- when it finished, its difficulty, and whether it ended early
- the average against the goal, with a pass/miss verdict
- total drinks made
- **round bars** — every round's time against the goal, coloured by verdict
- a per-round table: time, drinks, seconds per drink, result
- each round's ticket, in a `<details>` per round

With no run cached, it says so and offers to start one, rather than rendering
an empty frame.

`RoundBars` is kept and reused here. `TrendChart` and `GoalLine` are deleted —
they only ever plotted a series across sessions.

Seconds-per-drink stays on the per-round table. It was introduced as "the
honest cross-session comparison", and there are no cross-session comparisons
left, but it remains the one number that says whether a fast round was fast or
merely small.

---

## 8. What gets deleted

| Area | Files |
|---|---|
| Routes | `app/history/`, `app/stats/`, `app/summary/` |
| Profiles | `components/profile/`, `lib/profiles/` |
| Analytics | `lib/session/stats.ts` |
| Charts | `components/charts/TrendChart.tsx`, `GoalLine.tsx` |
| Tests | the above plus `e2e/history.spec.ts` |
| Baselines | the `history` and `stats` screenshots |

**1,308 lines** of source and test, and 16 of the 48 screenshot baselines —
the remaining 32 are regenerated, since the navigation changes on every screen.

`lib/charts/geometry.ts` stays — `RoundBars` uses `extentOf` and `yFor`.
`areaPoints` and `polylinePoints` go with `TrendChart`.

### One file cannot simply be deleted

`app/history/history.css` is imported by `/drinks` and by `app/profiles.css`,
not only by the screens being removed. It has to be split rather than dropped:

- `.lede`, `.empty`, `.stats`, `.stat`, `.stat__value` are shared surface
  styles used by `/drinks` and `/results` — these move to
  `src/styles/surfaces.css`, imported once from `global.css`.
- `.rounds` and `.ticket-detail` belong to the per-round breakdown — these move
  to the results screen's own stylesheet.
- `.sessions` and `.session` styled the history list and are deleted with it.

`app/profiles.css` is deleted outright along with the profile screen. Deleting
`history.css` without this split silently unstyles `/drinks`, which no test
would catch — the visual baselines for `/drinks` are regenerated in this same
change, so a broken layout would be baked into the new baseline as correct.

---

## 9. Compatibility

No migration is written. A device holding data from the previous version has:

- an **active session** carrying `profileId` — resumes normally. Zod object
  schemas strip unknown keys rather than rejecting on them, so the extra field
  is simply dropped on read. *(Corrected during planning: this section
  previously claimed the record would fail validation and be treated as
  absent. It does not, and resuming is the better outcome anyway — someone
  mid-drill when the app updates keeps their session.)*
- **orphaned keys** (`profiles`, `active-profile`, session records, per-profile
  prefs) — inert. Nothing reads them; they occupy a few KB until the browser is
  cleared. The old per-profile prefs key is not migrated, so the first session
  after the update starts from the defaults.

Writing a migration for a pre-release app with no users would be work spent
protecting nobody. This is a deliberate omission, recorded so it is not
mistaken for an oversight.

---

## 10. Testing

**Deleted:** profiles repository, `ProfileProvider`, `stats.ts`, `TrendChart`,
`GoalLine`, `e2e/history.spec.ts`.

**Reworked:** every e2e helper and spec that creates a profile before doing
anything — `drill`, `drinks`, `a11y`, `visual`, `budget`. The route lists in
the a11y and visual sweeps shrink to four screens.

**Kept unchanged:** generator, session machine, metrics, duration and date
formatting, drinks schema/repository/edits/transfer, `localStore`, `RoundBars`,
`DrinkRow`, `DrinkTable`, `TransferPanel`, `AppNav`, `ThemeToggle`, download.

**New:**

- `saveLastRun` / `loadLastRun` / `clearLastRun`, including a corrupt cached
  run reading as absent
- a completed run is cached, and an ended-early run is cached and marked
- **Start over records nothing** — the regression that matters most here, since
  the failure mode is a scrapped run silently becoming your saved result
- the active-session backup survives a failed last-run write
- `/results` with no run cached
- e2e: run a session → results survive a refresh → start a new session → the
  previous run is replaced

The 80% coverage floor is unchanged and is expected to rise, since the deleted
routes were the least-covered code in the repo.

---

## 11. What this does not change

Called out because the cut is large and the core is untouched:

- round generation, the two-tier freshness rule, and the banded quantities (§6)
- all timing, pause semantics, and `Date.now()`-delta derivation (§7)
- the keyboard shortcuts (§7) — `Space`, `P`, `Esc`
- the drink list, seed merge, excluding a drink, export and import (§3.1, §5)
- crash recovery restoring an interrupted session at rest
- the palette, typography, the docket, motion, and both themes (§10)
- error handling (§11), the accessibility contract (§12), the budget (§13)

---

## 12. Decision log for this revision

| Decision | Choice | Why |
|---|---|---|
| Profiles | Removed | An unbounded number of people use the device; none of them will make an account |
| History | One run, overwritten | The only run anyone asked about is the one they just did |
| Cross-session stats | Removed | Nobody is comparing their times to anybody else's, including their own from last month |
| Correcting a round | Start over only | Retyping a time makes the record an opinion; the clock is the only score |
| Ending early | Kept, distinct from Start over | Three of five rounds is a result; a mis-tap is not |
| Migration | None | A pre-release app with no users; old data reads as absent, which is already the corrupt-data path |
| Landing screen | Setup at `/` | With no profile gate, the first screen should be the thing you came to do |
| Trainer progress tracking | Given up deliberately | The one real loss. Weighed and declined: it was never the point |
