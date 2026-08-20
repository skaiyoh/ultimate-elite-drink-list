# Deferred findings — carried out of the MVP drill loop

Every item below was found by review, judged not to block merge, and deliberately left.
They are inputs to Plans 2-4, not a backlog of unknown quality. Extracted from the SDD
ledger before its scratch workspace was deleted; the git history is the fuller record.

## Ruled on during execution

- `Ruling: vitest thresholds are global, not per-file — amended Task 9's stated expectation rather than adding perFile:true. Why: a per-file gate would fail on thin wrappers that later tasks cover, costing fix rounds on a non-problem. Cost if wrong: aggregate coverage could mask one badly-tested module; the final review still sees the whole diff.`
- `Ruling: Task 14's StorageBanner test switches from vi.spyOn to vi.mock+importOriginal. Why: spying on an ES module export fails to redefine in many setups, so the test would fail for a reason unrelated to the code. Cost if wrong: none — vi.mock is strictly more reliable here.`
- `Ruling: work proceeds on branch feat/mvp-drill-loop in place rather than a worktree. Why: user chose it explicitly when asked. Cost if wrong: none; main is untouched either way.`
- deviations (a) vitest.setup explicit beforeEach import, (b) eslint native subpath
- Important #2 (bundle budget) is a PLAN defect, not an implementation defect, so it does
- rename vitest.config.ts -> .mts, overriding the brief's literal filename. Why: the plan's
- the out-of-brief vitest.config.mts change is ACCEPTED. Why: without it no test in the
- this does NOT consume a fix round. Why: a round is one fix attempt plus one scoped
- WriteOutcome gains 'invalid' rather than folding serialization failure into 'unavailable'
for. Ruling: PARK. Cosmetic, and not worth a dispatch during a speedrun. Fix in the final wave.
- APPROVED extracting StorageWarning, which also resolves the reviewer's separate Minor about
- derive storageWarning as Exclude<WriteOutcome, 'ok'> | null rather than restate it. Not
pre-existing, and reported-not-fixed by the implementer as out of scope. Ruling: PARK for Plan 4,

## Parked findings

- Task 1: minor (deferred): benign Vite CJS/ESM config-loader deprecation notice on every
- Task 1: minor (deferred): none outstanding — the eslint-comment minor is riding along with the
- Task 1: minor (deferred): import.meta.dirname in vitest.config.mts:8 introduces an undocumented
- Task 1: minor (deferred) -> SUPERSEDED, being fixed in Task 2 fix round 1 (engines + .nvmrc).
- Task 3: minor (deferred): persistent is a one-way latch with no recovery within a session —
- Task 3: minor (deferred): quota detection is an error.name string match against two known values;
- Task 3: minor (deferred): localStore.test.ts has no reset hook for module-level memory/persistent,
- Task 4: minor (deferred) [HIGHEST PRIORITY OF THE PARKED MINORS]: the "never overwrites a user
- Task 4: minor (deferred): repository.test.ts:57 hardcodes 'ueddl:v1:drinks' instead of importing
- Task 5: minor (deferred): report claimed 8 exported functions; there are 7 (parseProfiles is not
- Task 5: minor (deferred) [latent data loss, worth a real decision at final review]: neither
- Task 6: minor (deferred): no test for selectDrinks with pool exactly 7 AND empty previous (the
- Task 6: minor (deferred): stray leading blank line in rng.ts:1, an artifact of the brief's own
- DEFERRED (real, worth attention at final review): commitSession performs TWO non-atomic
- DEFERRED (design refinement, NOT a bug — escalate to the user): the reducer trusts caller-supplied
- STILL DEFERRED (all recorded above with reasoning): Task 14, Task 15, per-task reviews for Tasks
- DEFERRED (pre-existing, flagged for visibility): selectDrinks still throws when the pool drops
- Task 7-13: minor (deferred): RoundClock/RestCard had no tests -> NOW FIXED in this round.
- Task 7-13: minor (deferred): useHydrated is unused; three sites hand-roll the identical idiom
- Task 7-13: minor (deferred): the completion screen does not distinguish a finished session from an
- Task 7-13: minor (deferred): startRound does not guard selectDrinks' documented throw. Unreachable
- Task 7-13: minor (deferred): session/schema.ts keeps the redundant Zod-3-era tuple cast.
- Task 14: minor (deferred): StorageBanner only re-evaluates isPersistent() on its own render, so a
- Task 14: minor (deferred): layout banner does not reactively update if storage first fails
- Task 14: minor (deferred): storageWarning union was hand-copied -> NOW FIXED in this round.
