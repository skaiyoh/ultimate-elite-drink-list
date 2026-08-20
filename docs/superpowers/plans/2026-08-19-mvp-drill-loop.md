# MVP Drill Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable bartender speed drill — pick a profile, configure a session, run timed rounds of 7 randomized drinks, and see each round's time against the running average.

**Architecture:** A static Next.js App Router site with no backend. All logic lives in pure, injectable functions (`lib/`) that are unit-tested without React; React components are thin shells over a pure session reducer. Persistence goes through one `localStore` module that every repository sits on top of, so the storage engine can be swapped in one place. Timing derives exclusively from `Date.now()` deltas.

**Tech Stack:** Next.js (App Router) · React · TypeScript (strict) · Zod · Vitest + Testing Library · Playwright

**Spec:** `docs/superpowers/specs/2026-08-19-bartender-speed-drill-design.md`

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec.

- **A round deals exactly 7 distinct drinks.** Never 6, never a repeat inside one round.
- **Per-line quantity cap comes from the category:** shots `8`, well/cocktail/martini `2`. It caps a *single line*, not the category across the ticket.
- **`CategoryId` is a closed union** (`'shot' | 'well' | 'cocktail' | 'martini'`). Categories are code-owned and are **never persisted** — not in localStorage, not in export files.
- **Seed drink ids are permanent.** Change a drink's `name`, never its `id`. Seed merge and `removedSeedIds` both key on id.
- **All recorded timing derives from `Date.now()` deltas.** No accumulating interval counter is ever the source of truth; intervals exist only to trigger re-renders.
- **Difficulty bands (raw drink units, not effort-weighted):** Warm-up `8–11`, Standard `12–16`, Rush `18–24`.
- **Defaults:** 5 rounds, Standard difficulty, 4:00 goal per round, all categories enabled.
- **Durations display as `m:ss`** — never tenths. Milliseconds are stored.
- **A round passes when `durationMs <= goalMs`** (inclusive at the boundary).
- **No backend.** No API routes, no database, no network calls at runtime.
- **Storage keys are namespaced `ueddl:v1:`.**
- **Budget:** < 300KB JS gzipped, < 30KB CSS. No charting library, no animation library, no icon package. (Corrected after Task 1 measured the Next.js + React framework runtime at ~130KB gzipped on a page containing only an `<h1>`; the original 150KB left ~20KB for the whole app, and Zod alone is ~13KB of it.)
- **Every screen that reads storage must render a hydration-safe placeholder first.** Reading `localStorage` during render breaks SSR.

---

## File Structure

**Pure logic — no React, no DOM (`src/lib/`)**

| File | Responsibility |
|---|---|
| `drinks/types.ts` | *(exists)* `CategoryId`, `DrinkId`, `Category`, `Drink`; gains `DrinkListState` |
| `drinks/schema.ts` | Zod schemas validating anything crossing the storage/import boundary |
| `drinks/repository.ts` | Load/save the drink list, seed merge, derive the id index and the deal pool |
| `storage/keys.ts` | Every storage key in one place, built by function |
| `storage/localStore.ts` | The **only** module that touches the `localStorage` API |
| `profiles/types.ts` | `Profile` |
| `profiles/repository.ts` | Profile CRUD as pure list operations + persistence |
| `session/types.ts` | `TicketLine`, `RoundRecord`, `SessionConfig`, `SessionRecord`, `SessionState`, `SessionAction` |
| `session/rng.ts` | `Rng` type, `systemRng`, `seededRng`, `shuffle` |
| `session/generator.ts` | `selectDrinks`, `assignQuantities`, `dealRound` |
| `session/difficulty.ts` | The three difficulty presets |
| `session/machine.ts` | Pure session reducer + `elapsedMs` |
| `session/metrics.ts` | `totalUnits`, `averageMs`, `verdict`, `secondsPerUnit` |
| `session/repository.ts` | Active-session persistence, committing finished sessions, prefs |
| `format/duration.ts` | `formatDuration` |

**React (`src/hooks/`, `src/components/`, `src/app/`)**

| File | Responsibility |
|---|---|
| `hooks/useHydrated.ts` | Returns `false` until after mount, so storage reads never run during SSR |
| `hooks/useElapsed.ts` | 100ms re-render tick; returns a `Date.now()`-derived value |
| `hooks/useWakeLock.ts` | Feature-detected screen wake lock, active only while a round runs |
| `hooks/useSessionMachine.ts` | Wires reducer + dealing + persistence into one API for the play screen |
| `components/profile/ProfileProvider.tsx` | Client context holding the active profile id |
| `components/setup/*` | Round count, difficulty, goal, category pickers |
| `components/play/*` | `Ticket`, `RoundClock`, `RestCard` |
| `components/ui/*` | `Button`, `Card`, `Stat` |
| `app/page.tsx` | Profile select |
| `app/setup/page.tsx` | Session configuration |
| `app/play/page.tsx` | The drill |

Files that change together live together: each `lib/` domain folder owns its types, its validation, and its persistence.

---

### Task 1: Project scaffold and test tooling

Nothing exists yet but `src/data/seed-drinks.ts` and `src/lib/drinks/types.ts`, which already import via the `@/*` alias. This task makes them compile and gives every later task a test command.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `vitest.setup.ts`, `playwright.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/styles/tokens.css`, `src/styles/global.css`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e`; the `@/*` → `src/*` path alias

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ultimate-elite-drink-list",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run each command and let npm write the resolved versions. Do not hand-write version numbers.

```bash
npm install next react react-dom zod
npm install -D typescript @types/node @types/react @types/react-dom \
  eslint eslint-config-next \
  vitest @vitejs/plugin-react @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event \
  @playwright/test
npx playwright install chromium
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "e2e"]
}
```

`strict: true` only — `noUncheckedIndexedAccess` is deliberately off so array access in the generator stays readable.

- [ ] **Step 4: Create `next.config.ts` and `eslint.config.mjs`**

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

```js
// eslint.config.mjs
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**'] },
];
```

If `@eslint/eslintrc` is not already present, run `npm install -D @eslint/eslintrc`.

- [ ] **Step 5: Create `vitest.config.mts` and `vitest.setup.ts`**

```ts
// vitest.config.mts
// .mts, not .ts: unambiguously ESM regardless of package.json's "type" field,
// which stops Vite's config loader printing a CJS/ESM warning on every test run.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Route components are covered by the Playwright suite in Task 14, not
      // by Vitest. Including them here would fail the gate on untested lines
      // that are in fact tested, one layer out.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/app/**', 'src/data/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';

// Every test starts from an empty device.
beforeEach(() => {
  window.localStorage.clear();
});
```

- [ ] **Step 6: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 7: Create the design tokens**

```css
/* src/styles/tokens.css */
:root {
  --color-ground:  oklch(96% 0.008 85);
  --color-docket:  oklch(99% 0.004 85);
  --color-ink:     oklch(20% 0.010 60);
  --color-muted:   oklch(48% 0.010 60);
  --color-accent:  oklch(62% 0.130 75);
  --color-pass:    oklch(52% 0.150 150);
  --color-miss:    oklch(52% 0.190 25);
  --color-line:    oklch(85% 0.010 85);

  --text-body:  clamp(0.95rem, 0.9rem + 0.2vw, 1.05rem);
  --text-drink: clamp(1.15rem, 1rem + 0.6vw, 1.6rem);
  --text-clock: clamp(3.5rem, 2rem + 8vw, 7rem);

  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2.5rem;

  --radius: 6px;
  --duration-fast: 150ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --color-ground: oklch(16% 0.010 60);
    --color-docket: oklch(96% 0.012 85);
    --color-ink:    oklch(20% 0.010 60);
    --color-muted:  oklch(62% 0.010 60);
    --color-accent: oklch(74% 0.130 75);
    --color-pass:   oklch(72% 0.160 150);
    --color-miss:   oklch(60% 0.190 25);
    --color-line:   oklch(30% 0.010 60);
  }
}

:root[data-theme='dark'] {
  --color-ground: oklch(16% 0.010 60);
  --color-docket: oklch(96% 0.012 85);
  --color-ink:    oklch(20% 0.010 60);
  --color-muted:  oklch(62% 0.010 60);
  --color-accent: oklch(74% 0.130 75);
  --color-pass:   oklch(72% 0.160 150);
  --color-miss:   oklch(60% 0.190 25);
  --color-line:   oklch(30% 0.010 60);
}
```

```css
/* src/styles/global.css */
@import './tokens.css';

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--color-ground);
  color: var(--color-ink);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: var(--text-body);
  font-variant-numeric: tabular-nums;
}

main { max-width: 60rem; margin: 0 auto; padding: var(--space-4) var(--space-2); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Dark-mode note: `--color-ink` stays dark in both themes on purpose — it is the text colour on the *docket*, which is light in both themes. The page background flips; the paper does not.

- [ ] **Step 8: Create the app shell**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'Ultimate Elite Drink List',
  description: 'Bartender service-speed drill.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx
export default function HomePage() {
  return (
    <main>
      <h1>Ultimate Elite Drink List</h1>
    </main>
  );
}
```

- [ ] **Step 9: Verify the toolchain**

```bash
npm run typecheck && npm run build && npm test
```

Expected: typecheck passes (proving `@/lib/drinks/types` resolves from `src/data/seed-drinks.ts`), build succeeds, and vitest reports "No test files found" — which is not a failure at this stage. If vitest exits non-zero on no tests, add `passWithNoTests: true` under `test:` in `vitest.config.mts`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js app with vitest and playwright"
```

---

### Task 2: Drink schemas and a seed integrity test

The seed list is data a human edits by hand. This task turns the manual checks already run against it into a permanent test, and builds the Zod boundary everything else validates through.

**Files:**
- Modify: `src/lib/drinks/types.ts` (append `DrinkListState`)
- Create: `src/lib/drinks/schema.ts`
- Test: `src/lib/drinks/schema.test.ts`
- Modify: `vitest.config.mts`, `package.json`, and add `.nvmrc` — **added during execution.** Node 25 ships a native `localStorage` global with no `Storage` methods, and Vitest 4's jsdom environment declines to forward jsdom's real `Storage` onto `window` when the name already exists on the Node global. Without opting out, `window.localStorage` is broken for every test in the project. Task 1 could not have caught this: no test files existed yet.

**Interfaces:**
- Consumes: `Category`, `Drink`, `CategoryId`, `DrinkId` from `@/lib/drinks/types`; `SEED_CATEGORIES`, `SEED_DRINKS`, `SEED_VERSION` from `@/data/seed-drinks`
- Produces:
  - `DrinkListState` — `{ schemaVersion: number; seedVersion: number; drinks: readonly Drink[]; removedSeedIds: readonly DrinkId[] }`
  - `drinkSchema`, `drinkListStateSchema` (Zod)
  - `parseDrinkListState(raw: unknown): DrinkListState | null`
  - `DRINKS_PER_ROUND = 7`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/drinks/schema.test.ts
import { describe, expect, it } from 'vitest';
import { SEED_CATEGORIES, SEED_DRINKS } from '@/data/seed-drinks';
import { DRINKS_PER_ROUND, parseDrinkListState } from '@/lib/drinks/schema';

describe('seed data integrity', () => {
  it('has no duplicate ids', () => {
    const ids = SEED_DRINKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate names, case-insensitively', () => {
    const names = SEED_DRINKS.map((d) => d.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only namespaced seed ids', () => {
    const malformed = SEED_DRINKS.filter((d) => !/^seed:[a-z0-9-]+$/.test(d.id));
    expect(malformed).toEqual([]);
  });

  it('gives every category enough drinks to deal a filtered round', () => {
    for (const category of SEED_CATEGORIES) {
      const count = SEED_DRINKS.filter((d) => d.categoryId === category.id).length;
      expect(count, `${category.id} has ${count} drinks`).toBeGreaterThanOrEqual(DRINKS_PER_ROUND);
    }
  });

  it('caps shots at 8 and everything else at 2', () => {
    for (const category of SEED_CATEGORIES) {
      expect(category.maxQuantity).toBe(category.id === 'shot' ? 8 : 2);
    }
  });
});

describe('parseDrinkListState', () => {
  const valid = {
    schemaVersion: 1,
    seedVersion: 1,
    drinks: [{ id: 'seed:green-tea-shot', name: 'Green Tea Shot', categoryId: 'shot', enabled: true }],
    removedSeedIds: ['seed:orgasm'],
  };

  it('accepts a well-formed state', () => {
    expect(parseDrinkListState(valid)).toEqual(valid);
  });

  it('rejects an unknown categoryId', () => {
    expect(parseDrinkListState({ ...valid, drinks: [{ ...valid.drinks[0], categoryId: 'beer' }] })).toBeNull();
  });

  it('rejects a wrong schemaVersion', () => {
    expect(parseDrinkListState({ ...valid, schemaVersion: 99 })).toBeNull();
  });

  it.each([null, undefined, 42, 'nope', [], {}])('rejects %p', (input) => {
    expect(parseDrinkListState(input)).toBeNull();
  });

  it('rejects a drink with an empty name', () => {
    expect(parseDrinkListState({ ...valid, drinks: [{ ...valid.drinks[0], name: '' }] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/drinks/schema.test.ts`
Expected: FAIL — cannot resolve `@/lib/drinks/schema`.

- [ ] **Step 3: Append `DrinkListState` to the types file**

Add to the end of `src/lib/drinks/types.ts`:

```ts
/** The persisted drink list. Categories are code-owned and deliberately absent. */
export interface DrinkListState {
  readonly schemaVersion: number;
  readonly seedVersion: number;
  readonly drinks: readonly Drink[];
  /** Seed drinks the user deleted, so a later seed update never resurrects them. */
  readonly removedSeedIds: readonly DrinkId[];
}
```

- [ ] **Step 4: Write the schema module**

```ts
// src/lib/drinks/schema.ts
import { z } from 'zod';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import type { CategoryId, DrinkListState } from '@/lib/drinks/types';

/** A round always deals this many distinct drinks. */
export const DRINKS_PER_ROUND = 7;

/** The version of the persisted shape. Bumping this requires a migration. */
export const DRINKS_SCHEMA_VERSION = 1;

const categoryIds = SEED_CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export const categoryIdSchema = z.enum(categoryIds);

export const drinkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categoryId: categoryIdSchema,
  enabled: z.boolean(),
});

export const drinkListStateSchema = z.object({
  schemaVersion: z.literal(DRINKS_SCHEMA_VERSION),
  seedVersion: z.number().int().nonnegative(),
  drinks: z.array(drinkSchema),
  removedSeedIds: z.array(z.string()),
});

/**
 * Validates anything crossing the storage or import boundary.
 * Returns null rather than throwing — callers fall back to the seed.
 */
export function parseDrinkListState(raw: unknown): DrinkListState | null {
  const result = drinkListStateSchema.safeParse(raw);
  return result.success ? result.data : null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/drinks/schema.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add src/lib/drinks/types.ts src/lib/drinks/schema.ts src/lib/drinks/schema.test.ts
git commit -m "feat: add drink list schema and seed integrity tests"
```

---

### Task 3: Storage keys and the localStore boundary

The single module allowed to touch the `localStorage` API. Everything above it deals in validated values and explicit failures.

**Files:**
- Create: `src/lib/storage/keys.ts`
- Create: `src/lib/storage/localStore.ts`
- Test: `src/lib/storage/localStore.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `STORAGE_KEYS` — `{ drinks, profiles, activeProfile, activeSession, prefs(pid), sessionIndex(pid), session(sid) }`
  - `readValue<T>(key: string, validate: (raw: unknown) => T | null): T | null`
  - `writeValue(key: string, value: unknown): WriteOutcome` where `WriteOutcome = 'ok' | 'quota' | 'unavailable' | 'invalid'`
  - `removeValue(key: string): void`
  - `isPersistent(): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/storage/localStore.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS, isPersistent, readValue, removeValue, writeValue } from '@/lib/storage/localStore';

const asNumber = (raw: unknown): number | null => (typeof raw === 'number' ? raw : null);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('STORAGE_KEYS', () => {
  it('namespaces every key under ueddl:v1', () => {
    expect(STORAGE_KEYS.drinks).toBe('ueddl:v1:drinks');
    expect(STORAGE_KEYS.prefs('p1')).toBe('ueddl:v1:profile:p1:prefs');
    expect(STORAGE_KEYS.sessionIndex('p1')).toBe('ueddl:v1:profile:p1:session-index');
    expect(STORAGE_KEYS.session('s1')).toBe('ueddl:v1:session:s1');
  });
});

describe('readValue', () => {
  it('returns null for a missing key', () => {
    expect(readValue('ueddl:v1:missing', asNumber)).toBeNull();
  });

  it('round-trips a written value', () => {
    writeValue('ueddl:v1:n', 42);
    expect(readValue('ueddl:v1:n', asNumber)).toBe(42);
  });

  it('returns null for unparseable JSON without throwing', () => {
    window.localStorage.setItem('ueddl:v1:bad', '{not json');
    expect(readValue('ueddl:v1:bad', asNumber)).toBeNull();
  });

  it('returns null when the validator rejects the value', () => {
    writeValue('ueddl:v1:n', 'a string');
    expect(readValue('ueddl:v1:n', asNumber)).toBeNull();
  });

  it('returns null when the validator throws instead of rejecting', () => {
    writeValue('ueddl:v1:n', { nothing: true });
    const throwingValidator = (raw: unknown): number | null => {
      // The shape a careless downstream validator assumes but never checks.
      return (raw as { items: number[] }).items.length;
    };
    expect(readValue('ueddl:v1:n', throwingValidator)).toBeNull();
  });
});

describe('writeValue', () => {
  it('reports a non-serializable value instead of throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeValue('ueddl:v1:bad', circular)).toBe('invalid');
  });

  it('reports quota exhaustion instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; },
      removeItem: () => {},
    });
    expect(writeValue('ueddl:v1:n', 1)).toBe('quota');
  });

  it('falls back to memory when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    });
    expect(writeValue('ueddl:v1:n', 7)).toBe('unavailable');
    expect(readValue('ueddl:v1:n', asNumber)).toBe(7);
    expect(isPersistent()).toBe(false);
  });
});

describe('removeValue', () => {
  it('deletes a stored value', () => {
    writeValue('ueddl:v1:n', 1);
    removeValue('ueddl:v1:n');
    expect(readValue('ueddl:v1:n', asNumber)).toBeNull();
  });

  it('does not throw when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    });
    expect(() => removeValue('ueddl:v1:n')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/storage/localStore.test.ts`
Expected: FAIL — cannot resolve `@/lib/storage/localStore`.

- [ ] **Step 3: Write the keys module**

```ts
// src/lib/storage/keys.ts
const PREFIX = 'ueddl:v1';

export const STORAGE_KEYS = {
  drinks: `${PREFIX}:drinks`,
  profiles: `${PREFIX}:profiles`,
  activeProfile: `${PREFIX}:active-profile`,
  activeSession: `${PREFIX}:active-session`,
  prefs: (profileId: string) => `${PREFIX}:profile:${profileId}:prefs`,
  sessionIndex: (profileId: string) => `${PREFIX}:profile:${profileId}:session-index`,
  session: (sessionId: string) => `${PREFIX}:session:${sessionId}`,
} as const;
```

- [ ] **Step 4: Write the localStore module**

```ts
// src/lib/storage/localStore.ts
export { STORAGE_KEYS } from '@/lib/storage/keys';

export type WriteOutcome = 'ok' | 'quota' | 'unavailable' | 'invalid';

/** Used when localStorage throws on access — Safari private mode, blocked cookies. */
const memory = new Map<string, string>();
let persistent = true;

/** False once any localStorage access has thrown; the app then runs in memory. */
export function isPersistent(): boolean {
  return persistent;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    persistent = false;
    return memory.get(key) ?? null;
  }
}

/**
 * Reads and validates a stored value. Returns null for missing, unparseable,
 * or invalid data — never throws, so a corrupt key can't take down a screen.
 */
export function readValue<T>(key: string, validate: (raw: unknown) => T | null): T | null {
  const raw = readRaw(key);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // The validator is caller-supplied and may throw on an unexpected-but-valid
  // JSON shape rather than returning null. Treat a throw as a rejection — the
  // whole point of this function is that a corrupt key cannot take down a screen.
  try {
    return validate(parsed);
  } catch {
    return null;
  }
}

export function writeValue(key: string, value: unknown): WriteOutcome {
  // Serialization is its own failure mode — a circular reference or a BigInt
  // throws here, which has nothing to do with storage availability. Kept in a
  // separate try so the storage branches below can rely on `serialized`.
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return 'invalid';
  }

  try {
    window.localStorage.setItem(key, serialized);
    return 'ok';
  } catch (error) {
    if (error instanceof Error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      return 'quota';
    }
    persistent = false;
    memory.set(key, serialized);
    return 'unavailable';
  }
}

export function removeValue(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    persistent = false;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/storage/localStore.test.ts`
Expected: PASS. If the memory-fallback test leaks `persistent = false` into later tests, that is expected — `isPersistent` is asserted only inside that test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage src/lib/storage/localStore.test.ts
git commit -m "feat: add namespaced storage keys and safe localStorage boundary"
```

---

### Task 4: Drinks repository and seed merge

Seed merge is the subtle part: it must add newly-shipped drinks without overwriting the user's edits and without resurrecting drinks the user deleted.

**Files:**
- Create: `src/lib/drinks/repository.ts`
- Test: `src/lib/drinks/repository.test.ts`

**Interfaces:**
- Consumes: `parseDrinkListState`, `DRINKS_SCHEMA_VERSION` from `@/lib/drinks/schema`; `readValue`, `writeValue`, `STORAGE_KEYS` from `@/lib/storage/localStore`; `SEED_DRINKS`, `SEED_CATEGORIES`, `SEED_VERSION` from `@/data/seed-drinks`
- Produces:
  - `initialDrinkList(): DrinkListState`
  - `mergeSeed(state: DrinkListState): DrinkListState` — pure
  - `loadDrinkList(): DrinkListState`
  - `saveDrinkList(state: DrinkListState): WriteOutcome`
  - `categoryMap(): ReadonlyMap<CategoryId, Category>`
  - `poolFor(state: DrinkListState, categoryIds: readonly CategoryId[]): Drink[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/drinks/repository.test.ts
import { describe, expect, it } from 'vitest';
import { SEED_DRINKS, SEED_VERSION } from '@/data/seed-drinks';
import { STORAGE_KEYS } from '@/lib/storage/localStore';
import {
  categoryMap, initialDrinkList, loadDrinkList, mergeSeed, poolFor, saveDrinkList,
} from '@/lib/drinks/repository';
import type { DrinkListState } from '@/lib/drinks/types';

describe('initialDrinkList', () => {
  it('starts from the full seed with nothing removed', () => {
    const state = initialDrinkList();
    expect(state.drinks).toHaveLength(SEED_DRINKS.length);
    expect(state.removedSeedIds).toEqual([]);
    expect(state.seedVersion).toBe(SEED_VERSION);
  });
});

describe('mergeSeed', () => {
  const stale: DrinkListState = {
    schemaVersion: 1,
    seedVersion: 0,
    drinks: [{ id: 'seed:green-tea-shot', name: 'GT (house)', categoryId: 'shot', enabled: false }],
    removedSeedIds: ['seed:orgasm'],
  };

  it('adds seed drinks the stored state has never seen', () => {
    const merged = mergeSeed(stale);
    expect(merged.drinks.some((d) => d.id === 'seed:margarita')).toBe(true);
  });

  it('never overwrites a user edit to an existing drink', () => {
    const merged = mergeSeed(stale);
    const edited = merged.drinks.find((d) => d.id === 'seed:green-tea-shot');
    expect(edited).toEqual({ id: 'seed:green-tea-shot', name: 'GT (house)', categoryId: 'shot', enabled: false });
  });

  it('never resurrects a removed seed drink', () => {
    const merged = mergeSeed(stale);
    expect(merged.drinks.some((d) => d.id === 'seed:orgasm')).toBe(false);
  });

  it('bumps seedVersion so the merge runs once', () => {
    expect(mergeSeed(stale).seedVersion).toBe(SEED_VERSION);
  });

  it('is a no-op when seedVersion is already current', () => {
    const current = { ...stale, seedVersion: SEED_VERSION };
    expect(mergeSeed(current)).toBe(current);
  });
});

describe('loadDrinkList', () => {
  it('returns the seed when storage is empty', () => {
    expect(loadDrinkList().drinks).toHaveLength(SEED_DRINKS.length);
  });

  it('falls back to the seed when stored data is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEYS.drinks, '{"schemaVersion":"wrong"}');
    expect(loadDrinkList().drinks).toHaveLength(SEED_DRINKS.length);
  });

  it('round-trips a saved list', () => {
    const custom: DrinkListState = {
      schemaVersion: 1,
      seedVersion: SEED_VERSION,
      drinks: [{ id: 'uuid-1', name: 'House Pickleback', categoryId: 'shot', enabled: true }],
      removedSeedIds: [],
    };
    expect(saveDrinkList(custom)).toBe('ok');
    expect(loadDrinkList().drinks).toEqual(custom.drinks);
  });
});

describe('poolFor', () => {
  const state = initialDrinkList();

  it('returns only enabled drinks in the selected categories', () => {
    const pool = poolFor(state, ['martini']);
    expect(pool.length).toBeGreaterThanOrEqual(7);
    expect(pool.every((d) => d.categoryId === 'martini' && d.enabled)).toBe(true);
  });

  it('excludes disabled drinks', () => {
    const disabled: DrinkListState = {
      ...state,
      drinks: state.drinks.map((d) => (d.categoryId === 'martini' ? { ...d, enabled: false } : d)),
    };
    expect(poolFor(disabled, ['martini'])).toEqual([]);
  });

  it('returns an empty pool for no selected categories', () => {
    expect(poolFor(state, [])).toEqual([]);
  });
});

describe('categoryMap', () => {
  it('exposes the per-line quantity caps', () => {
    expect(categoryMap().get('shot')?.maxQuantity).toBe(8);
    expect(categoryMap().get('cocktail')?.maxQuantity).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/drinks/repository.test.ts`
Expected: FAIL — cannot resolve `@/lib/drinks/repository`.

- [ ] **Step 3: Write the repository**

```ts
// src/lib/drinks/repository.ts
import { SEED_CATEGORIES, SEED_DRINKS, SEED_VERSION } from '@/data/seed-drinks';
import { DRINKS_SCHEMA_VERSION, parseDrinkListState } from '@/lib/drinks/schema';
import type { Category, CategoryId, Drink, DrinkListState } from '@/lib/drinks/types';
import { STORAGE_KEYS, readValue, writeValue, type WriteOutcome } from '@/lib/storage/localStore';

export function initialDrinkList(): DrinkListState {
  return {
    schemaVersion: DRINKS_SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    drinks: SEED_DRINKS.map((d) => ({ ...d })),
    removedSeedIds: [],
  };
}

/**
 * Adds seed drinks the stored state has not seen, skipping any the user
 * deleted. Existing entries are left exactly as the user left them.
 */
export function mergeSeed(state: DrinkListState): DrinkListState {
  if (state.seedVersion >= SEED_VERSION) return state;

  const known = new Set(state.drinks.map((d) => d.id));
  const removed = new Set(state.removedSeedIds);
  const additions = SEED_DRINKS.filter((d) => !known.has(d.id) && !removed.has(d.id)).map((d) => ({ ...d }));

  return { ...state, seedVersion: SEED_VERSION, drinks: [...state.drinks, ...additions] };
}

export function loadDrinkList(): DrinkListState {
  const stored = readValue(STORAGE_KEYS.drinks, parseDrinkListState);
  return stored === null ? initialDrinkList() : mergeSeed(stored);
}

export function saveDrinkList(state: DrinkListState): WriteOutcome {
  return writeValue(STORAGE_KEYS.drinks, state);
}

const CATEGORY_MAP: ReadonlyMap<CategoryId, Category> = new Map(
  SEED_CATEGORIES.map((c) => [c.id, c] as const),
);

/** Categories are code-owned, so this never touches storage. */
export function categoryMap(): ReadonlyMap<CategoryId, Category> {
  return CATEGORY_MAP;
}

/** The drinks a round may be dealt from: enabled, and in a selected category. */
export function poolFor(state: DrinkListState, categoryIds: readonly CategoryId[]): Drink[] {
  const selected = new Set(categoryIds);
  return state.drinks.filter((d) => d.enabled && selected.has(d.categoryId));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/drinks/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/drinks/repository.ts src/lib/drinks/repository.test.ts
git commit -m "feat: add drinks repository with seed merge"
```

---
### Task 5: Profiles repository

Profiles separate history on a shared device. They are not authentication — no password, no privacy boundary.

**Files:**
- Create: `src/lib/profiles/types.ts`
- Create: `src/lib/profiles/repository.ts`
- Test: `src/lib/profiles/repository.test.ts`

**Interfaces:**
- Consumes: `STORAGE_KEYS`, `readValue`, `writeValue` from `@/lib/storage/localStore`
- Produces:
  - `Profile` — `{ id: string; name: string; createdAt: number }`
  - `addProfile(list, name, id, createdAt): Profile[]` — pure
  - `renameProfile(list, id, name): Profile[]` — pure
  - `removeProfile(list, id): Profile[]` — pure
  - `loadProfiles(): Profile[]`, `saveProfiles(list): WriteOutcome`
  - `loadActiveProfileId(): string | null`, `saveActiveProfileId(id: string | null): WriteOutcome`

Ids and timestamps are parameters rather than generated inside, so every function is deterministic and testable.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/profiles/repository.test.ts
import { describe, expect, it } from 'vitest';
import {
  addProfile, loadActiveProfileId, loadProfiles, removeProfile,
  renameProfile, saveActiveProfileId, saveProfiles,
} from '@/lib/profiles/repository';
import type { Profile } from '@/lib/profiles/types';
import { STORAGE_KEYS } from '@/lib/storage/localStore';

const base: Profile[] = [
  { id: 'p1', name: 'Nathan', createdAt: 1000 },
  { id: 'p2', name: 'Sam', createdAt: 2000 },
];

describe('pure list operations', () => {
  it('appends a profile without mutating the input', () => {
    const next = addProfile(base, 'Alex', 'p3', 3000);
    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({ id: 'p3', name: 'Alex', createdAt: 3000 });
    expect(base).toHaveLength(2);
  });

  it('trims whitespace from a new name', () => {
    expect(addProfile([], '  Alex  ', 'p1', 1)[0].name).toBe('Alex');
  });

  it('renames by id and leaves others untouched', () => {
    const next = renameProfile(base, 'p1', 'Nate');
    expect(next[0].name).toBe('Nate');
    expect(next[1]).toEqual(base[1]);
    expect(base[0].name).toBe('Nathan');
  });

  it('ignores a rename for an unknown id', () => {
    expect(renameProfile(base, 'nope', 'X')).toEqual(base);
  });

  it('removes by id', () => {
    expect(removeProfile(base, 'p1')).toEqual([base[1]]);
  });
});

describe('persistence', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadProfiles()).toEqual([]);
  });

  it('round-trips profiles', () => {
    saveProfiles(base);
    expect(loadProfiles()).toEqual(base);
  });

  it('returns an empty list when stored data is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEYS.profiles, '[{"id":1}]');
    expect(loadProfiles()).toEqual([]);
  });

  it('round-trips the active profile id and clears it with null', () => {
    saveActiveProfileId('p1');
    expect(loadActiveProfileId()).toBe('p1');
    saveActiveProfileId(null);
    expect(loadActiveProfileId()).toBeNull();
    // Asserting the read value alone cannot tell `removeValue` apart from
    // writing the JSON string "null" — check the key is genuinely gone.
    expect(window.localStorage.getItem(STORAGE_KEYS.activeProfile)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/profiles/repository.test.ts`
Expected: FAIL — cannot resolve `@/lib/profiles/repository`.

- [ ] **Step 3: Write the types**

```ts
// src/lib/profiles/types.ts
export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
}
```

- [ ] **Step 4: Write the repository**

```ts
// src/lib/profiles/repository.ts
import { z } from 'zod';
import type { Profile } from '@/lib/profiles/types';
import { STORAGE_KEYS, readValue, removeValue, writeValue, type WriteOutcome } from '@/lib/storage/localStore';

const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

const profileListSchema = z.array(profileSchema);

function parseProfiles(raw: unknown): Profile[] | null {
  const result = profileListSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function addProfile(list: readonly Profile[], name: string, id: string, createdAt: number): Profile[] {
  return [...list, { id, name: name.trim(), createdAt }];
}

export function renameProfile(list: readonly Profile[], id: string, name: string): Profile[] {
  return list.map((p) => (p.id === id ? { ...p, name: name.trim() } : p));
}

export function removeProfile(list: readonly Profile[], id: string): Profile[] {
  return list.filter((p) => p.id !== id);
}

export function loadProfiles(): Profile[] {
  return readValue(STORAGE_KEYS.profiles, parseProfiles) ?? [];
}

export function saveProfiles(list: readonly Profile[]): WriteOutcome {
  return writeValue(STORAGE_KEYS.profiles, list);
}

export function loadActiveProfileId(): string | null {
  return readValue(STORAGE_KEYS.activeProfile, (raw) => (typeof raw === 'string' ? raw : null));
}

/**
 * Returns the outcome rather than swallowing it, matching `saveProfiles`.
 * Callers may ignore it — losing this pointer costs one tap, not data — but an
 * ignored return value is visible in a way that a discarded one is not.
 */
export function saveActiveProfileId(id: string | null): WriteOutcome {
  if (id === null) {
    removeValue(STORAGE_KEYS.activeProfile);
    return 'ok';
  }
  return writeValue(STORAGE_KEYS.activeProfile, id);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/profiles/repository.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/profiles
git commit -m "feat: add profiles repository"
```

---

### Task 6: Session config, RNG, and the round generator

The heart of the drill. Every function here is pure and takes its randomness as a parameter, so tests are fully deterministic.

**Files:**
- Create: `src/lib/session/types.ts`
- Create: `src/lib/session/config.ts`
- Create: `src/lib/session/rng.ts`
- Create: `src/lib/session/generator.ts`
- Test: `src/lib/session/generator.test.ts`
- Test: `src/lib/session/config.test.ts` — **added during execution.** The original test file never imported `config.ts`, leaving the three difficulty bands and the three defaults — values the plan's own Global Constraints fix literally — with zero coverage. A band tuple typo would change every round in the app and no test would notice.

**Interfaces:**
- Consumes: `Category`, `CategoryId`, `Drink`, `DrinkId` from `@/lib/drinks/types`; `DRINKS_PER_ROUND` from `@/lib/drinks/schema`
- Produces:
  - `TicketLine` — `{ drinkId: DrinkId; name: string; categoryId: CategoryId; quantity: number }`
  - `RoundRecord` — `{ index, ticket, totalUnits, startedAt, endedAt, pausedMs, durationMs }`
  - `SessionConfig` — `{ roundCount, difficultyId, band, goalMs, categoryIds }`
  - `SessionRecord` — `{ id, profileId, startedAt, completedAt, config, rounds }`
  - `DifficultyId` (declared in `types.ts` to avoid a cycle), `DIFFICULTIES`, `bandFor(id)`, `defaultSessionConfig()`, `DEFAULT_ROUND_COUNT`, `DEFAULT_GOAL_MS`
  - `Rng = () => number`, `systemRng`, `seededRng(seed)`, `shuffle(items, rng)`
  - `selectDrinks(pool, previous, rng): Drink[]`
  - `assignQuantities(selected, categories, band, rng): TicketLine[]`
  - `dealRound(pool, categories, band, previous, rng): TicketLine[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/session/generator.test.ts
import { describe, expect, it } from 'vitest';
import type { Category, CategoryId, Drink } from '@/lib/drinks/types';
import { assignQuantities, dealRound, selectDrinks } from '@/lib/session/generator';
import { seededRng, shuffle } from '@/lib/session/rng';

const categories: ReadonlyMap<CategoryId, Category> = new Map([
  ['shot', { id: 'shot', label: 'Shots', maxQuantity: 8 }],
  ['martini', { id: 'martini', label: 'Martinis', maxQuantity: 2 }],
]);

const makePool = (count: number, categoryId: CategoryId): Drink[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `d${i}`, name: `Drink ${i}`, categoryId, enabled: true,
  }));

describe('shuffle', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seededRng(1));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic for a given seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(7))).toEqual(shuffle([1, 2, 3, 4, 5], seededRng(7)));
  });
});

describe('selectDrinks', () => {
  it('returns exactly 7 distinct drinks', () => {
    const out = selectDrinks(makePool(31, 'shot'), [], seededRng(1));
    expect(out).toHaveLength(7);
    expect(new Set(out.map((d) => d.id)).size).toBe(7);
  });

  it('avoids the previous round entirely when the pool is deep', () => {
    const pool = makePool(31, 'shot');
    const previous = pool.slice(0, 7).map((d) => d.id);
    const out = selectDrinks(pool, previous, seededRng(2));
    expect(out.some((d) => previous.includes(d.id))).toBe(false);
  });

  it('takes 6 fresh and 1 stale from a 13-drink pool', () => {
    const pool = makePool(13, 'martini');
    const previous = pool.slice(0, 7).map((d) => d.id);
    const out = selectDrinks(pool, previous, seededRng(3));
    expect(out).toHaveLength(7);
    expect(out.filter((d) => !previous.includes(d.id))).toHaveLength(6);
    expect(out.filter((d) => previous.includes(d.id))).toHaveLength(1);
  });

  it('takes the whole fresh tier when a 14-drink pool leaves exactly 7 fresh', () => {
    // Arithmetic, not policy: choosing 7 distinct drinks that avoid the
    // previous 7 out of a pool of 14 has exactly one solution. Documented so
    // nobody "fixes" it later. Quantities still re-roll every round.
    const pool = makePool(14, 'martini');
    const previous = pool.slice(0, 7).map((d) => d.id);
    const out = selectDrinks(pool, previous, seededRng(4)).map((d) => d.id).sort();
    expect(out).toEqual(pool.slice(7).map((d) => d.id).sort());
  });

  it('still deals when every drink was in the previous round', () => {
    const pool = makePool(7, 'martini');
    const previous = pool.map((d) => d.id);
    const out = selectDrinks(pool, previous, seededRng(6));
    expect(out).toHaveLength(7);
    expect(new Set(out.map((d) => d.id)).size).toBe(7);
  });

  it('throws when the pool is too small to deal a round', () => {
    expect(() => selectDrinks(makePool(6, 'shot'), [], seededRng(1))).toThrow(/needs 7/);
  });
});

describe('assignQuantities', () => {
  const totalOf = (lines: { quantity: number }[]) => lines.reduce((sum, l) => sum + l.quantity, 0);

  it('gives every line at least 1 and never exceeds its category cap', () => {
    const lines = assignQuantities(makePool(7, 'shot'), categories, [12, 16], seededRng(1));
    expect(lines).toHaveLength(7);
    expect(lines.every((l) => l.quantity >= 1 && l.quantity <= 8)).toBe(true);
  });

  it('lands inside the band when the band is reachable', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const total = totalOf(assignQuantities(makePool(7, 'shot'), categories, [12, 16], seededRng(seed)));
      expect(total).toBeGreaterThanOrEqual(12);
      expect(total).toBeLessThanOrEqual(16);
    }
  });

  it('clamps down to the ceiling when the band is unreachable', () => {
    // 7 martini lines cap at 2 each: 14 units is the hard ceiling, Rush wants 18-24.
    for (let seed = 1; seed <= 10; seed++) {
      expect(totalOf(assignQuantities(makePool(7, 'martini'), categories, [18, 24], seededRng(seed)))).toBe(14);
    }
  });

  it('clamps up to the floor when the band sits below 7 units', () => {
    expect(totalOf(assignQuantities(makePool(7, 'shot'), categories, [3, 5], seededRng(1)))).toBe(7);
  });

  it('carries the drink name and category onto each line', () => {
    const line = assignQuantities(makePool(7, 'shot'), categories, [7, 7], seededRng(1))[0];
    expect(line).toMatchObject({ drinkId: expect.any(String), name: expect.any(String), categoryId: 'shot' });
  });

  it('throws on a drink whose category is unknown', () => {
    const orphan: Drink[] = [{ id: 'x', name: 'X', categoryId: 'well', enabled: true }];
    expect(() => assignQuantities(orphan, categories, [7, 7], seededRng(1))).toThrow(/Unknown category/);
  });
});

describe('dealRound', () => {
  it('is deterministic for a given seed', () => {
    const pool = makePool(31, 'shot');
    expect(dealRound(pool, categories, [12, 16], [], seededRng(9)))
      .toEqual(dealRound(pool, categories, [12, 16], [], seededRng(9)));
  });

  it('produces 7 lines with distinct drinks', () => {
    const lines = dealRound(makePool(31, 'shot'), categories, [12, 16], [], seededRng(1));
    expect(lines).toHaveLength(7);
    expect(new Set(lines.map((l) => l.drinkId)).size).toBe(7);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/session/generator.test.ts`
Expected: FAIL — cannot resolve `@/lib/session/generator`.

- [ ] **Step 3: Write the session types**

```ts
// src/lib/session/types.ts
import type { CategoryId, DrinkId } from '@/lib/drinks/types';

/** Lives here rather than in config.ts: SessionConfig needs it, and config.ts
 *  needs SessionConfig, which would otherwise be a circular import. */
export type DifficultyId = 'warmup' | 'standard' | 'rush';

/** One line on a dealt ticket. `name` is snapshotted so history survives renames. */
export interface TicketLine {
  readonly drinkId: DrinkId;
  readonly name: string;
  readonly categoryId: CategoryId;
  readonly quantity: number;
}

export interface RoundRecord {
  readonly index: number;
  readonly ticket: readonly TicketLine[];
  readonly totalUnits: number;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly pausedMs: number;
  /** endedAt - startedAt - pausedMs */
  readonly durationMs: number;
}

export interface SessionConfig {
  readonly roundCount: number;
  readonly difficultyId: DifficultyId;
  readonly band: readonly [number, number];
  readonly goalMs: number;
  readonly categoryIds: readonly CategoryId[];
}

export interface SessionRecord {
  readonly id: string;
  readonly profileId: string;
  readonly startedAt: number;
  /** null means abandoned — kept in history, excluded from averages. */
  readonly completedAt: number | null;
  readonly config: SessionConfig;
  readonly rounds: readonly RoundRecord[];
}
```

- [ ] **Step 4: Write the session config**

```ts
// src/lib/session/config.ts
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import type { CategoryId } from '@/lib/drinks/types';
import type { DifficultyId, SessionConfig } from '@/lib/session/types';

export interface Difficulty {
  readonly id: DifficultyId;
  readonly label: string;
  /** Target total drink units per round — raw drinks, not effort-weighted. */
  readonly band: readonly [number, number];
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'warmup', label: 'Warm-up', band: [8, 11] },
  { id: 'standard', label: 'Standard', band: [12, 16] },
  { id: 'rush', label: 'Rush', band: [18, 24] },
];

export const DEFAULT_DIFFICULTY_ID: DifficultyId = 'standard';
export const DEFAULT_ROUND_COUNT = 5;
export const DEFAULT_GOAL_MS = 4 * 60 * 1000;
export const MIN_GOAL_MS = 60 * 1000;
export const MAX_GOAL_MS = 15 * 60 * 1000;
export const GOAL_STEP_MS = 15 * 1000;
export const MIN_ROUND_COUNT = 1;
export const MAX_ROUND_COUNT = 20;

export function bandFor(id: DifficultyId): readonly [number, number] {
  const found = DIFFICULTIES.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown difficulty: ${id}`);
  return found.band;
}

export function defaultSessionConfig(): SessionConfig {
  return {
    roundCount: DEFAULT_ROUND_COUNT,
    difficultyId: DEFAULT_DIFFICULTY_ID,
    band: bandFor(DEFAULT_DIFFICULTY_ID),
    goalMs: DEFAULT_GOAL_MS,
    categoryIds: SEED_CATEGORIES.map((c) => c.id) as CategoryId[],
  };
}
```

- [ ] **Step 5: Write the RNG module**

```ts
// src/lib/session/rng.ts

/** Returns a float in [0, 1). Injected everywhere so tests are deterministic. */
export type Rng = () => number;

export const systemRng: Rng = () => Math.random();

/** Linear congruential generator — small, fast, and reproducible across runs. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Fisher-Yates over a fresh copy — the input array is never mutated. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}
```

- [ ] **Step 6: Write the generator**

```ts
// src/lib/session/generator.ts
import { DRINKS_PER_ROUND } from '@/lib/drinks/schema';
import type { Category, CategoryId, Drink, DrinkId } from '@/lib/drinks/types';
import { shuffle, type Rng } from '@/lib/session/rng';
import type { TicketLine } from '@/lib/session/types';

/**
 * Two-tier selection: prefer drinks not dealt last round, top up from the
 * stale tier only if the fresh tier runs short.
 *
 * Replaces a pool-size threshold, which had a cliff: below it freshness was
 * off entirely (the 13-drink martini pool got none), at or above it exclusion
 * was absolute. This has no constant and is maximally fresh at every pool size
 * from 7 up.
 */
export function selectDrinks(pool: readonly Drink[], previous: readonly DrinkId[], rng: Rng): Drink[] {
  if (pool.length < DRINKS_PER_ROUND) {
    throw new Error(`Pool has ${pool.length} drinks; a round needs ${DRINKS_PER_ROUND}`);
  }
  const dealt = new Set(previous);
  const fresh = shuffle(pool.filter((d) => !dealt.has(d.id)), rng);
  const stale = shuffle(pool.filter((d) => dealt.has(d.id)), rng);
  return [...fresh, ...stale].slice(0, DRINKS_PER_ROUND);
}

/**
 * Seeds every line at 1, then distributes the remaining units to random lines
 * that still have headroom. Surplus naturally lands on shots, because shots
 * are the lines with headroom left — realistic tickets without special-casing.
 */
export function assignQuantities(
  selected: readonly Drink[],
  categories: ReadonlyMap<CategoryId, Category>,
  band: readonly [number, number],
  rng: Rng,
): TicketLine[] {
  const caps = selected.map((drink) => {
    const category = categories.get(drink.categoryId);
    if (!category) throw new Error(`Unknown category: ${drink.categoryId}`);
    return category.maxQuantity;
  });

  const floor = selected.length;
  const ceiling = caps.reduce((sum, cap) => sum + cap, 0);

  // Draw uniformly from the band intersected with what is achievable. Drawing
  // from the band and clamping afterwards would pile probability on the endpoint.
  const low = Math.max(band[0], floor);
  const high = Math.min(band[1], ceiling);
  const target = low <= high
    ? low + Math.floor(rng() * (high - low + 1))
    : (band[0] > ceiling ? ceiling : floor);

  const quantities = selected.map(() => 1);
  let remaining = target - floor;
  while (remaining > 0) {
    const withHeadroom: number[] = [];
    for (let i = 0; i < quantities.length; i++) {
      if (quantities[i] < caps[i]) withHeadroom.push(i);
    }
    if (withHeadroom.length === 0) break;
    quantities[withHeadroom[Math.floor(rng() * withHeadroom.length)]] += 1;
    remaining -= 1;
  }

  return selected.map((drink, i) => ({
    drinkId: drink.id,
    name: drink.name,
    categoryId: drink.categoryId,
    quantity: quantities[i],
  }));
}

export function dealRound(
  pool: readonly Drink[],
  categories: ReadonlyMap<CategoryId, Category>,
  band: readonly [number, number],
  previous: readonly DrinkId[],
  rng: Rng,
): TicketLine[] {
  return assignQuantities(selectDrinks(pool, previous, rng), categories, band, rng);
}
```

- [ ] **Step 7: Cover the config module**

`generator.test.ts` never imports `config.ts`, so the difficulty bands and the
defaults ship untested. They are constants, which is exactly why a typo in one
would be silent: every round in the app would change and every test would stay
green.

```ts
// src/lib/session/config.test.ts
import { describe, expect, it } from 'vitest';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import {
  DEFAULT_DIFFICULTY_ID, DEFAULT_GOAL_MS, DEFAULT_ROUND_COUNT,
  DIFFICULTIES, bandFor, defaultSessionConfig,
} from '@/lib/session/config';
import type { DifficultyId } from '@/lib/session/types';

describe('difficulty presets', () => {
  it('carries the three bands the spec fixes', () => {
    expect(DIFFICULTIES.map((d) => [d.id, d.band])).toEqual([
      ['warmup', [8, 11]],
      ['standard', [12, 16]],
      ['rush', [18, 24]],
    ]);
  });

  it('never sets a band floor below the 7 units every round already deals', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(difficulty.band[0]).toBeGreaterThanOrEqual(7);
      expect(difficulty.band[0]).toBeLessThanOrEqual(difficulty.band[1]);
    }
  });

  it('resolves a band by id', () => {
    expect(bandFor('standard')).toEqual([12, 16]);
  });

  it('throws for an unknown difficulty id', () => {
    expect(() => bandFor('impossible' as DifficultyId)).toThrow(/Unknown difficulty/);
  });
});

describe('defaultSessionConfig', () => {
  it('matches the documented defaults', () => {
    expect(defaultSessionConfig()).toEqual({
      roundCount: 5,
      difficultyId: 'standard',
      band: [12, 16],
      goalMs: 240_000,
      categoryIds: ['shot', 'well', 'cocktail', 'martini'],
    });
  });

  it('enables every seeded category', () => {
    expect(defaultSessionConfig().categoryIds).toEqual(SEED_CATEGORIES.map((c) => c.id));
  });

  it('returns a fresh object per call, so callers cannot share mutable state', () => {
    expect(defaultSessionConfig()).not.toBe(defaultSessionConfig());
  });

  it('agrees with the exported default constants', () => {
    const config = defaultSessionConfig();
    expect(config.roundCount).toBe(DEFAULT_ROUND_COUNT);
    expect(config.difficultyId).toBe(DEFAULT_DIFFICULTY_ID);
    expect(config.goalMs).toBe(DEFAULT_GOAL_MS);
  });
});
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- src/lib/session/`
Expected: PASS, all cases.

- [ ] **Step 9: Commit**

```bash
git add src/lib/session/types.ts src/lib/session/config.ts src/lib/session/rng.ts src/lib/session/generator.ts src/lib/session/generator.test.ts src/lib/session/config.test.ts
git commit -m "feat: add round generator with two-tier freshness and banded quantities"
```

---

### Task 7: Duration formatting and metrics

**Files:**
- Create: `src/lib/format/duration.ts`
- Create: `src/lib/session/metrics.ts`
- Test: `src/lib/format/duration.test.ts`
- Test: `src/lib/session/metrics.test.ts`

**Interfaces:**
- Consumes: `RoundRecord`, `TicketLine` from `@/lib/session/types`
- Produces:
  - `formatDuration(ms: number): string` — always `m:ss`
  - `totalUnits(ticket: readonly TicketLine[]): number`
  - `averageMs(rounds: readonly RoundRecord[]): number | null`
  - `verdict(durationMs: number, goalMs: number): 'pass' | 'miss'`
  - `secondsPerUnit(round: RoundRecord): number`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/format/duration.test.ts
import { describe, expect, it } from 'vitest';
import { formatDuration } from '@/lib/format/duration';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [1000, '0:01'],
    [59_000, '0:59'],
    [60_000, '1:00'],
    [240_000, '4:00'],
    [3_723_000, '62:03'],
  ])('formats %ims as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it('never renders a negative time', () => {
    expect(formatDuration(-5000)).toBe('0:00');
  });
});
```

```ts
// src/lib/session/metrics.test.ts
import { describe, expect, it } from 'vitest';
import { averageMs, secondsPerUnit, totalUnits, verdict } from '@/lib/session/metrics';
import type { RoundRecord, TicketLine } from '@/lib/session/types';

const line = (quantity: number): TicketLine =>
  ({ drinkId: 'd', name: 'D', categoryId: 'shot', quantity });

const round = (durationMs: number, units = 14): RoundRecord => ({
  index: 0,
  ticket: [line(units)],
  totalUnits: units,
  startedAt: 0,
  endedAt: durationMs,
  pausedMs: 0,
  durationMs,
});

describe('totalUnits', () => {
  it('sums the quantities on a ticket', () => {
    expect(totalUnits([line(4), line(2), line(1)])).toBe(7);
  });

  it('is zero for an empty ticket', () => {
    expect(totalUnits([])).toBe(0);
  });
});

describe('averageMs', () => {
  it('averages the round durations', () => {
    expect(averageMs([round(200_000), round(280_000)])).toBe(240_000);
  });

  it('returns null when no rounds have been completed', () => {
    expect(averageMs([])).toBeNull();
  });
});

describe('verdict', () => {
  it('passes strictly under the goal', () => {
    expect(verdict(239_000, 240_000)).toBe('pass');
  });

  it('passes exactly at the goal', () => {
    expect(verdict(240_000, 240_000)).toBe('pass');
  });

  it('misses one millisecond over', () => {
    expect(verdict(240_001, 240_000)).toBe('miss');
  });
});

describe('secondsPerUnit', () => {
  it('normalizes a round against how much it asked for', () => {
    expect(secondsPerUnit(round(140_000, 14))).toBe(10);
  });

  it('returns 0 rather than Infinity for a unit-less round', () => {
    expect(secondsPerUnit(round(140_000, 0))).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/format/duration.test.ts src/lib/session/metrics.test.ts`
Expected: FAIL — neither module resolves.

- [ ] **Step 3: Write the modules**

```ts
// src/lib/format/duration.ts

/** Always `m:ss`. Tenths on a four-minute clock are jitter, not information. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```

```ts
// src/lib/session/metrics.ts
import type { RoundRecord, TicketLine } from '@/lib/session/types';

export function totalUnits(ticket: readonly TicketLine[]): number {
  return ticket.reduce((sum, line) => sum + line.quantity, 0);
}

/** Null when there is nothing to average — the caller decides what to show. */
export function averageMs(rounds: readonly RoundRecord[]): number | null {
  if (rounds.length === 0) return null;
  return rounds.reduce((sum, r) => sum + r.durationMs, 0) / rounds.length;
}

/** A round passes at exactly the goal — the boundary is inclusive. */
export function verdict(durationMs: number, goalMs: number): 'pass' | 'miss' {
  return durationMs <= goalMs ? 'pass' : 'miss';
}

/** The honest cross-session comparison: bands make rounds similar, not identical. */
export function secondsPerUnit(round: RoundRecord): number {
  if (round.totalUnits <= 0) return 0;
  return round.durationMs / 1000 / round.totalUnits;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/format/duration.test.ts src/lib/session/metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format src/lib/session/metrics.ts src/lib/session/metrics.test.ts
git commit -m "feat: add duration formatting and session metrics"
```

---
### Task 8: The session reducer

A pure state machine. It never reads a clock and never generates randomness — every timestamp and every dealt ticket arrives in the action, which is what makes the timing testable to the millisecond.

**Files:**
- Create: `src/lib/session/machine.ts`
- Test: `src/lib/session/machine.test.ts`

**Interfaces:**
- Consumes: `RoundRecord`, `SessionConfig`, `SessionRecord`, `TicketLine` from `@/lib/session/types`; `totalUnits` from `@/lib/session/metrics`
- Produces:
  - `SessionStatus = 'resting' | 'running' | 'paused' | 'complete'`
  - `ActiveRound` — `{ index, ticket, totalUnits, startedAt, pausedMs, pausedAt }`
  - `SessionState` — `{ id, profileId, config, status, startedAt, completedAt, current, rounds }`
  - `SessionAction` — `startRound | pause | resume | advance | end`
  - `createSession(id, profileId, config, startedAt): SessionState`
  - `sessionReducer(state, action): SessionState`
  - `elapsedMs(round: ActiveRound, now: number): number`
  - `toRecord(state: SessionState): SessionRecord`

A session begins in `resting`, so "before round 1" and "between rounds" are the same state — one indefinite hold, timed toward nothing.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/session/machine.test.ts
import { describe, expect, it } from 'vitest';
import { defaultSessionConfig } from '@/lib/session/config';
import { createSession, elapsedMs, sessionReducer, toRecord } from '@/lib/session/machine';
import type { TicketLine } from '@/lib/session/types';

const ticket: TicketLine[] = [
  { drinkId: 'a', name: 'A', categoryId: 'shot', quantity: 4 },
  { drinkId: 'b', name: 'B', categoryId: 'martini', quantity: 2 },
];

const config = { ...defaultSessionConfig(), roundCount: 2 };
const fresh = () => createSession('s1', 'p1', config, 1_000);

describe('createSession', () => {
  it('starts resting with no rounds', () => {
    const state = fresh();
    expect(state.status).toBe('resting');
    expect(state.current).toBeNull();
    expect(state.rounds).toEqual([]);
    expect(state.completedAt).toBeNull();
  });
});

describe('startRound', () => {
  it('opens round 0 and records the total units', () => {
    const state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 2_000 });
    expect(state.status).toBe('running');
    expect(state.current).toMatchObject({ index: 0, startedAt: 2_000, pausedMs: 0, pausedAt: null, totalUnits: 6 });
  });

  it('is ignored while a round is already running', () => {
    const running = sessionReducer(fresh(), { type: 'startRound', ticket, at: 2_000 });
    expect(sessionReducer(running, { type: 'startRound', ticket, at: 3_000 })).toBe(running);
  });
});

describe('pause and resume', () => {
  const running = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });

  it('freezes the clock while paused', () => {
    const paused = sessionReducer(running, { type: 'pause', at: 10_000 });
    expect(paused.status).toBe('paused');
    expect(elapsedMs(paused.current!, 99_000)).toBe(10_000);
  });

  it('excludes the paused span after resuming', () => {
    const paused = sessionReducer(running, { type: 'pause', at: 10_000 });
    const resumed = sessionReducer(paused, { type: 'resume', at: 40_000 });
    expect(resumed.status).toBe('running');
    expect(resumed.current!.pausedMs).toBe(30_000);
    expect(elapsedMs(resumed.current!, 50_000)).toBe(20_000);
  });

  it('ignores pause while resting and resume while running', () => {
    const resting = fresh();
    expect(sessionReducer(resting, { type: 'pause', at: 1 })).toBe(resting);
    expect(sessionReducer(running, { type: 'resume', at: 1 })).toBe(running);
  });
});

describe('advance', () => {
  it('records the round and returns to resting', () => {
    const running = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    const rested = sessionReducer(running, { type: 'advance', at: 200_000 });
    expect(rested.status).toBe('resting');
    expect(rested.current).toBeNull();
    expect(rested.rounds).toHaveLength(1);
    expect(rested.rounds[0]).toMatchObject({ index: 0, startedAt: 0, endedAt: 200_000, pausedMs: 0, durationMs: 200_000, totalUnits: 6 });
  });

  it('subtracts paused time from the recorded duration', () => {
    let state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'pause', at: 50_000 });
    state = sessionReducer(state, { type: 'resume', at: 80_000 });
    state = sessionReducer(state, { type: 'advance', at: 230_000 });
    expect(state.rounds[0].durationMs).toBe(200_000);
    expect(state.rounds[0].pausedMs).toBe(30_000);
  });

  it('settles an unresumed pause when advancing straight from paused', () => {
    let state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'pause', at: 60_000 });
    state = sessionReducer(state, { type: 'advance', at: 100_000 });
    expect(state.rounds[0].pausedMs).toBe(40_000);
    expect(state.rounds[0].durationMs).toBe(60_000);
  });

  it('completes the session after the configured round count', () => {
    let state = fresh();
    state = sessionReducer(state, { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 100_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 150_000 });
    state = sessionReducer(state, { type: 'advance', at: 350_000 });
    expect(state.status).toBe('complete');
    expect(state.completedAt).toBe(350_000);
    expect(state.rounds).toHaveLength(2);
  });

  it('is ignored while resting', () => {
    const resting = fresh();
    expect(sessionReducer(resting, { type: 'advance', at: 1 })).toBe(resting);
  });
});

describe('end', () => {
  it('abandons with a null completedAt and discards the in-flight round', () => {
    let state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 100_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 120_000 });
    const ended = sessionReducer(state, { type: 'end', at: 200_000 });
    expect(ended.status).toBe('complete');
    expect(ended.completedAt).toBeNull();
    expect(ended.rounds).toHaveLength(1);
    expect(ended.current).toBeNull();
  });

  it('never un-completes a finished session', () => {
    let state = fresh();
    state = sessionReducer(state, { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 100_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 150_000 });
    const done = sessionReducer(state, { type: 'advance', at: 350_000 });
    expect(sessionReducer(done, { type: 'end', at: 400_000 })).toBe(done);
  });
});

describe('toRecord', () => {
  it('drops runtime-only fields', () => {
    const state = sessionReducer(fresh(), { type: 'startRound', ticket, at: 0 });
    const record = toRecord(sessionReducer(state, { type: 'advance', at: 100_000 }));
    expect(record).toEqual({
      id: 's1', profileId: 'p1', startedAt: 1_000, completedAt: null,
      config, rounds: expect.any(Array),
    });
    expect(record).not.toHaveProperty('current');
    expect(record).not.toHaveProperty('status');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/session/machine.test.ts`
Expected: FAIL — cannot resolve `@/lib/session/machine`.

- [ ] **Step 3: Write the machine**

```ts
// src/lib/session/machine.ts
import { totalUnits } from '@/lib/session/metrics';
import type { RoundRecord, SessionConfig, SessionRecord, TicketLine } from '@/lib/session/types';

export type SessionStatus = 'resting' | 'running' | 'paused' | 'complete';

export interface ActiveRound {
  readonly index: number;
  readonly ticket: readonly TicketLine[];
  readonly totalUnits: number;
  readonly startedAt: number;
  readonly pausedMs: number;
  /** Non-null only while paused; the instant the pause began. */
  readonly pausedAt: number | null;
}

export interface SessionState {
  readonly id: string;
  readonly profileId: string;
  readonly config: SessionConfig;
  readonly status: SessionStatus;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly current: ActiveRound | null;
  readonly rounds: readonly RoundRecord[];
}

export type SessionAction =
  | { readonly type: 'startRound'; readonly ticket: readonly TicketLine[]; readonly at: number }
  | { readonly type: 'pause'; readonly at: number }
  | { readonly type: 'resume'; readonly at: number }
  | { readonly type: 'advance'; readonly at: number }
  | { readonly type: 'end'; readonly at: number };

/** A session opens resting: "before round 1" and "between rounds" are one state. */
export function createSession(
  id: string, profileId: string, config: SessionConfig, startedAt: number,
): SessionState {
  return { id, profileId, config, status: 'resting', startedAt, completedAt: null, current: null, rounds: [] };
}

/** Live elapsed time, always derived from timestamps — never accumulated. */
export function elapsedMs(round: ActiveRound, now: number): number {
  const frozen = round.pausedAt === null ? 0 : now - round.pausedAt;
  return Math.max(0, now - round.startedAt - round.pausedMs - frozen);
}

function settlePausedMs(round: ActiveRound, at: number): number {
  return round.pausedMs + (round.pausedAt === null ? 0 : at - round.pausedAt);
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'startRound': {
      if (state.status !== 'resting') return state;
      return {
        ...state,
        status: 'running',
        current: {
          index: state.rounds.length,
          ticket: action.ticket,
          totalUnits: totalUnits(action.ticket),
          startedAt: action.at,
          pausedMs: 0,
          pausedAt: null,
        },
      };
    }

    case 'pause': {
      if (state.status !== 'running' || state.current === null) return state;
      return { ...state, status: 'paused', current: { ...state.current, pausedAt: action.at } };
    }

    case 'resume': {
      if (state.status !== 'paused' || state.current === null) return state;
      return {
        ...state,
        status: 'running',
        current: { ...state.current, pausedMs: settlePausedMs(state.current, action.at), pausedAt: null },
      };
    }

    case 'advance': {
      if ((state.status !== 'running' && state.status !== 'paused') || state.current === null) return state;
      const round = state.current;
      const pausedMs = settlePausedMs(round, action.at);
      const record: RoundRecord = {
        index: round.index,
        ticket: round.ticket,
        totalUnits: round.totalUnits,
        startedAt: round.startedAt,
        endedAt: action.at,
        pausedMs,
        durationMs: Math.max(0, action.at - round.startedAt - pausedMs),
      };
      const rounds = [...state.rounds, record];
      const finished = rounds.length >= state.config.roundCount;
      return {
        ...state,
        status: finished ? 'complete' : 'resting',
        completedAt: finished ? action.at : null,
        current: null,
        rounds,
      };
    }

    case 'end': {
      if (state.status === 'complete') return state;
      // An in-flight round is discarded: it was never finished, so it has no time.
      return { ...state, status: 'complete', completedAt: null, current: null };
    }
  }
}

export function toRecord(state: SessionState): SessionRecord {
  return {
    id: state.id,
    profileId: state.profileId,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    config: state.config,
    rounds: state.rounds,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/session/machine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session/machine.ts src/lib/session/machine.test.ts
git commit -m "feat: add pure session reducer with pause-aware timing"
```

---

### Task 9: Session persistence and crash recovery

One key per finished session, plus a single active-session key that makes an accidental refresh survivable.

**Files:**
- Create: `src/lib/session/schema.ts`
- Create: `src/lib/session/repository.ts`
- Test: `src/lib/session/repository.test.ts`

**Interfaces:**
- Consumes: `categoryIdSchema` from `@/lib/drinks/schema`; `SessionState`, `toRecord` from `@/lib/session/machine`; `SessionConfig`, `SessionRecord` from `@/lib/session/types`; `STORAGE_KEYS`, `readValue`, `writeValue`, `removeValue` from `@/lib/storage/localStore`
- Produces:
  - `parseSessionState`, `parseSessionRecord`, `parseSessionConfig` (Zod-backed, return `| null`)
  - `saveActiveSession(state): WriteOutcome`
  - `loadActiveSession(): SessionState | null` — **normalizes a running/paused state back to `resting`**
  - `clearActiveSession(): void`
  - `commitSession(record): WriteOutcome`
  - `loadSessionIndex(profileId): string[]`
  - `loadSession(sessionId): SessionRecord | null`
  - `savePrefs(profileId, config): WriteOutcome`, `loadPrefs(profileId): SessionConfig | null`

Resume never restores mid-round. Wall-clock time passed while the app was closed is unknowable, so an interrupted round is dropped and the session resumes at the rest before it.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/session/repository.test.ts
import { describe, expect, it } from 'vitest';
import { defaultSessionConfig } from '@/lib/session/config';
import { createSession, sessionReducer, toRecord } from '@/lib/session/machine';
import {
  clearActiveSession, commitSession, loadActiveSession, loadPrefs,
  loadSession, loadSessionIndex, saveActiveSession, savePrefs,
} from '@/lib/session/repository';
import type { TicketLine } from '@/lib/session/types';

const ticket: TicketLine[] = [{ drinkId: 'a', name: 'A', categoryId: 'shot', quantity: 4 }];
const config = defaultSessionConfig();

describe('active session', () => {
  it('is null when nothing is stored', () => {
    expect(loadActiveSession()).toBeNull();
  });

  it('round-trips a resting session unchanged', () => {
    const state = createSession('s1', 'p1', config, 1_000);
    saveActiveSession(state);
    expect(loadActiveSession()).toEqual(state);
  });

  it('resumes a running session at rest, discarding the in-flight round', () => {
    const running = sessionReducer(createSession('s1', 'p1', config, 0), { type: 'startRound', ticket, at: 5_000 });
    saveActiveSession(running);
    const restored = loadActiveSession();
    expect(restored?.status).toBe('resting');
    expect(restored?.current).toBeNull();
    expect(restored?.rounds).toEqual([]);
  });

  it('preserves rounds already completed before the interruption', () => {
    let state = createSession('s1', 'p1', config, 0);
    state = sessionReducer(state, { type: 'startRound', ticket, at: 0 });
    state = sessionReducer(state, { type: 'advance', at: 200_000 });
    state = sessionReducer(state, { type: 'startRound', ticket, at: 210_000 });
    saveActiveSession(state);
    expect(loadActiveSession()?.rounds).toHaveLength(1);
  });

  it('returns null for corrupt stored data', () => {
    window.localStorage.setItem('ueddl:v1:active-session', '{"status":"weird"}');
    expect(loadActiveSession()).toBeNull();
  });

  it('clears', () => {
    saveActiveSession(createSession('s1', 'p1', config, 0));
    clearActiveSession();
    expect(loadActiveSession()).toBeNull();
  });
});

describe('committed sessions', () => {
  const record = toRecord(createSession('s1', 'p1', config, 1_000));

  it('writes the session and indexes it under its profile', () => {
    commitSession(record);
    expect(loadSessionIndex('p1')).toEqual(['s1']);
    expect(loadSession('s1')).toEqual(record);
  });

  it('puts the newest session first', () => {
    commitSession(record);
    commitSession({ ...record, id: 's2', startedAt: 2_000 });
    expect(loadSessionIndex('p1')).toEqual(['s2', 's1']);
  });

  it('never indexes the same session twice', () => {
    commitSession(record);
    commitSession(record);
    expect(loadSessionIndex('p1')).toEqual(['s1']);
  });

  it('keeps each profile index separate', () => {
    commitSession(record);
    commitSession({ ...record, id: 's9', profileId: 'p2' });
    expect(loadSessionIndex('p1')).toEqual(['s1']);
    expect(loadSessionIndex('p2')).toEqual(['s9']);
  });

  it('returns null for an unknown session id', () => {
    expect(loadSession('nope')).toBeNull();
  });
});

describe('prefs', () => {
  it('round-trips a session config per profile', () => {
    const custom = { ...config, roundCount: 10, goalMs: 180_000 };
    savePrefs('p1', custom);
    expect(loadPrefs('p1')).toEqual(custom);
    expect(loadPrefs('p2')).toBeNull();
  });

  it('returns null for corrupt prefs', () => {
    window.localStorage.setItem('ueddl:v1:profile:p1:prefs', '{"roundCount":"five"}');
    expect(loadPrefs('p1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/session/repository.test.ts`
Expected: FAIL — cannot resolve `@/lib/session/repository`.

- [ ] **Step 3: Write the session schemas**

```ts
// src/lib/session/schema.ts
import { z } from 'zod';
import { categoryIdSchema } from '@/lib/drinks/schema';
import { DIFFICULTIES } from '@/lib/session/config';
import type { SessionState } from '@/lib/session/machine';
import type { DifficultyId, SessionConfig, SessionRecord } from '@/lib/session/types';

const difficultyIds = DIFFICULTIES.map((d) => d.id) as [DifficultyId, ...DifficultyId[]];

const ticketLineSchema = z.object({
  drinkId: z.string().min(1),
  name: z.string().min(1),
  categoryId: categoryIdSchema,
  quantity: z.number().int().positive(),
});

const roundRecordSchema = z.object({
  index: z.number().int().nonnegative(),
  ticket: z.array(ticketLineSchema),
  totalUnits: z.number().int().nonnegative(),
  startedAt: z.number(),
  endedAt: z.number(),
  pausedMs: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
});

export const sessionConfigSchema = z.object({
  roundCount: z.number().int().positive(),
  difficultyId: z.enum(difficultyIds),
  band: z.tuple([z.number().int(), z.number().int()]),
  goalMs: z.number().int().positive(),
  categoryIds: z.array(categoryIdSchema),
});

const activeRoundSchema = z.object({
  index: z.number().int().nonnegative(),
  ticket: z.array(ticketLineSchema),
  totalUnits: z.number().int().nonnegative(),
  startedAt: z.number(),
  pausedMs: z.number().nonnegative(),
  pausedAt: z.number().nullable(),
});

export const sessionRecordSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  startedAt: z.number(),
  completedAt: z.number().nullable(),
  config: sessionConfigSchema,
  rounds: z.array(roundRecordSchema),
});

export const sessionStateSchema = sessionRecordSchema.extend({
  status: z.enum(['resting', 'running', 'paused', 'complete']),  // mirrors SessionStatus
  current: activeRoundSchema.nullable(),
});

export function parseSessionConfig(raw: unknown): SessionConfig | null {
  const result = sessionConfigSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseSessionRecord(raw: unknown): SessionRecord | null {
  const result = sessionRecordSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseSessionState(raw: unknown): SessionState | null {
  const result = sessionStateSchema.safeParse(raw);
  return result.success ? result.data : null;
}
```

- [ ] **Step 4: Write the repository**

```ts
// src/lib/session/repository.ts
import type { SessionState } from '@/lib/session/machine';
import { parseSessionConfig, parseSessionRecord, parseSessionState } from '@/lib/session/schema';
import type { SessionConfig, SessionRecord } from '@/lib/session/types';
import { STORAGE_KEYS, readValue, removeValue, writeValue, type WriteOutcome } from '@/lib/storage/localStore';

export function saveActiveSession(state: SessionState): WriteOutcome {
  return writeValue(STORAGE_KEYS.activeSession, state);
}

/**
 * Restores an interrupted session at rest. Time that passed while the app was
 * closed is unknowable, so an in-flight round is dropped rather than guessed at.
 */
export function loadActiveSession(): SessionState | null {
  const stored = readValue(STORAGE_KEYS.activeSession, parseSessionState);
  if (stored === null) return null;
  if (stored.status === 'running' || stored.status === 'paused') {
    return { ...stored, status: 'resting', current: null };
  }
  return stored;
}

export function clearActiveSession(): void {
  removeValue(STORAGE_KEYS.activeSession);
}

function parseIdList(raw: unknown): string[] | null {
  return Array.isArray(raw) && raw.every((v) => typeof v === 'string') ? (raw as string[]) : null;
}

export function loadSessionIndex(profileId: string): string[] {
  return readValue(STORAGE_KEYS.sessionIndex(profileId), parseIdList) ?? [];
}

/** Sessions are append-only and immutable, so this is an O(1) write per session. */
export function commitSession(record: SessionRecord): WriteOutcome {
  const written = writeValue(STORAGE_KEYS.session(record.id), record);
  if (written !== 'ok') return written;

  const index = loadSessionIndex(record.profileId);
  if (index.includes(record.id)) return 'ok';
  return writeValue(STORAGE_KEYS.sessionIndex(record.profileId), [record.id, ...index]);
}

export function loadSession(sessionId: string): SessionRecord | null {
  return readValue(STORAGE_KEYS.session(sessionId), parseSessionRecord);
}

export function savePrefs(profileId: string, config: SessionConfig): WriteOutcome {
  return writeValue(STORAGE_KEYS.prefs(profileId), config);
}

export function loadPrefs(profileId: string): SessionConfig | null {
  return readValue(STORAGE_KEYS.prefs(profileId), parseSessionConfig);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/session/repository.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the whole suite and check coverage**

```bash
npm run test:coverage
```

Expected: PASS. The thresholds in `vitest.config.mts` are **global, not per-file**
(`perFile` is not set), so the gate is aggregate coverage — do not chase 80% on
each individual file. A thin wrapper like `systemRng` staying uncovered until
Task 12 is expected. The lib layer is complete at this point and fully tested
with no React involved.

- [ ] **Step 7: Commit**

```bash
git add src/lib/session/schema.ts src/lib/session/repository.ts src/lib/session/repository.test.ts
git commit -m "feat: add session persistence with mid-round-safe crash recovery"
```

---
### Task 10: Hydration guard, profile context, and the profile screen

Reading `localStorage` during render desynchronizes server and client markup, so every storage-backed screen renders a placeholder until after mount.

**Files:**
- Create: `src/hooks/useHydrated.ts`
- Create: `src/components/profile/ProfileProvider.tsx`
- Modify: `src/app/layout.tsx` (wrap children in the provider)
- Modify: `src/app/page.tsx` (replace the placeholder heading)
- Test: `src/components/profile/ProfileProvider.test.tsx`

**Interfaces:**
- Consumes: everything from `@/lib/profiles/repository`
- Produces:
  - `useHydrated(): boolean`
  - `<ProfileProvider>` and `useProfiles(): ProfileContextValue`
  - `ProfileContextValue` — `{ hydrated, profiles, activeProfile, create(name), select(id), rename(id, name), remove(id) }`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/profile/ProfileProvider.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProfileProvider, useProfiles } from '@/components/profile/ProfileProvider';
import { loadActiveProfileId, loadProfiles } from '@/lib/profiles/repository';

function Harness() {
  const { hydrated, profiles, activeProfile, create, select, remove } = useProfiles();
  if (!hydrated) return <p>loading</p>;
  return (
    <div>
      <p data-testid="active">{activeProfile?.name ?? 'none'}</p>
      <ul>{profiles.map((p) => (
        <li key={p.id}>
          <button onClick={() => select(p.id)}>select {p.name}</button>
          <button onClick={() => remove(p.id)}>remove {p.name}</button>
        </li>
      ))}</ul>
      <button onClick={() => create('Nathan')}>add</button>
      <button onClick={() => create('   ')}>add blank</button>
    </div>
  );
}

const renderHarness = () => render(<ProfileProvider><Harness /></ProfileProvider>);

describe('ProfileProvider', () => {
  it('creates a profile, persists it, and makes it active', async () => {
    renderHarness();
    await userEvent.click(await screen.findByText('add'));
    expect(screen.getByTestId('active')).toHaveTextContent('Nathan');
    expect(loadProfiles()).toHaveLength(1);
    expect(loadActiveProfileId()).toBe(loadProfiles()[0].id);
  });

  it('refuses to create a blank profile', async () => {
    renderHarness();
    await userEvent.click(await screen.findByText('add blank'));
    expect(loadProfiles()).toEqual([]);
  });

  it('clears the active profile when it is removed', async () => {
    renderHarness();
    await userEvent.click(await screen.findByText('add'));
    await userEvent.click(screen.getByText('remove Nathan'));
    expect(screen.getByTestId('active')).toHaveTextContent('none');
    expect(loadActiveProfileId()).toBeNull();
  });

  it('restores profiles written by a previous visit', async () => {
    renderHarness();
    await userEvent.click(await screen.findByText('add'));
    const first = renderHarness();
    first.unmount();
    renderHarness();
    expect(await screen.findAllByText('select Nathan')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/profile/ProfileProvider.test.tsx`
Expected: FAIL — cannot resolve `@/components/profile/ProfileProvider`.

- [ ] **Step 3: Write the hydration hook**

```tsx
// src/hooks/useHydrated.ts
'use client';
import { useEffect, useState } from 'react';

/**
 * False on the server and during the first client render. Gate every read of
 * localStorage behind this so server and client markup never disagree.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
```

- [ ] **Step 4: Write the provider**

```tsx
// src/components/profile/ProfileProvider.tsx
'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addProfile, loadActiveProfileId, loadProfiles, removeProfile,
  renameProfile, saveActiveProfileId, saveProfiles,
} from '@/lib/profiles/repository';
import type { Profile } from '@/lib/profiles/types';

export interface ProfileContextValue {
  readonly hydrated: boolean;
  readonly profiles: readonly Profile[];
  readonly activeProfile: Profile | null;
  create(name: string): void;
  select(id: string | null): void;
  rename(id: string, name: string): void;
  remove(id: string): void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profiles, setProfiles] = useState<readonly Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setProfiles(loadProfiles());
    setActiveId(loadActiveProfileId());
    setHydrated(true);
  }, []);

  const select = useCallback((id: string | null) => {
    setActiveId(id);
    saveActiveProfileId(id);
  }, []);

  const commit = useCallback((next: Profile[]) => {
    setProfiles(next);
    saveProfiles(next);
  }, []);

  const create = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    const id = crypto.randomUUID();
    commit(addProfile(profiles, trimmed, id, Date.now()));
    select(id);
  }, [commit, profiles, select]);

  const rename = useCallback((id: string, name: string) => {
    if (name.trim() === '') return;
    commit(renameProfile(profiles, id, name));
  }, [commit, profiles]);

  const remove = useCallback((id: string) => {
    commit(removeProfile(profiles, id));
    if (activeId === id) select(null);
  }, [activeId, commit, profiles, select]);

  const value = useMemo<ProfileContextValue>(() => ({
    hydrated,
    profiles,
    activeProfile: profiles.find((p) => p.id === activeId) ?? null,
    create, select, rename, remove,
  }), [activeId, create, hydrated, profiles, remove, rename, select]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (value === null) throw new Error('useProfiles must be used inside a ProfileProvider');
  return value;
}
```

- [ ] **Step 5: Wrap the app and build the profile screen**

```tsx
// src/app/layout.tsx — replace the whole file
import type { Metadata } from 'next';
import { ProfileProvider } from '@/components/profile/ProfileProvider';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'Ultimate Elite Drink List',
  description: 'Bartender service-speed drill.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx — replace the whole file
'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useProfiles } from '@/components/profile/ProfileProvider';

export default function ProfilePage() {
  const { hydrated, profiles, activeProfile, create, select, remove } = useProfiles();
  const [name, setName] = useState('');

  if (!hydrated) return <main><p>Loading…</p></main>;

  return (
    <main>
      <h1>Who&apos;s drilling?</h1>

      <ul aria-label="Profiles">
        {profiles.map((profile) => (
          <li key={profile.id}>
            <button onClick={() => select(profile.id)} aria-pressed={profile.id === activeProfile?.id}>
              {profile.name}
            </button>
            <button onClick={() => remove(profile.id)} aria-label={`Delete ${profile.name}`}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={(event) => { event.preventDefault(); create(name); setName(''); }}>
        <label htmlFor="new-profile">New profile</label>
        <input id="new-profile" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
        <button type="submit">Add</button>
      </form>

      {activeProfile && <Link href="/setup">Start a session as {activeProfile.name}</Link>}
    </main>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/components/profile/ProfileProvider.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useHydrated.ts src/components/profile src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add profile context and profile select screen"
```

---

### Task 11: Setup guards and the setup screen

**Files:**
- Create: `src/lib/session/setupGuards.ts`
- Create: `src/app/setup/page.tsx`
- Test: `src/lib/session/setupGuards.test.ts`

**Interfaces:**
- Consumes: `DRINKS_PER_ROUND` from `@/lib/drinks/schema`; `poolFor`, `categoryMap`, `loadDrinkList` from `@/lib/drinks/repository`; `DIFFICULTIES`, `bandFor`, `defaultSessionConfig` and the min/max constants from `@/lib/session/config`; `createSession` from `@/lib/session/machine`; `saveActiveSession`, `savePrefs`, `loadPrefs` from `@/lib/session/repository`
- Produces:
  - `maxAchievableUnits(pool, categories): number`
  - `SetupIssue` — `{ severity: 'blocking' | 'warning'; message: string }`
  - `setupIssues(pool, categories, band): SetupIssue[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/session/setupGuards.test.ts
import { describe, expect, it } from 'vitest';
import type { Category, CategoryId, Drink } from '@/lib/drinks/types';
import { maxAchievableUnits, setupIssues } from '@/lib/session/setupGuards';

const categories: ReadonlyMap<CategoryId, Category> = new Map([
  ['shot', { id: 'shot', label: 'Shots', maxQuantity: 8 }],
  ['martini', { id: 'martini', label: 'Martinis', maxQuantity: 2 }],
]);

const pool = (count: number, categoryId: CategoryId): Drink[] =>
  Array.from({ length: count }, (_, i) => ({ id: `d${i}`, name: `D${i}`, categoryId, enabled: true }));

describe('maxAchievableUnits', () => {
  it('sums the seven largest caps in the pool', () => {
    expect(maxAchievableUnits(pool(31, 'shot'), categories)).toBe(56);
    expect(maxAchievableUnits(pool(13, 'martini'), categories)).toBe(14);
  });

  it('prefers the highest caps when the pool is mixed', () => {
    expect(maxAchievableUnits([...pool(3, 'shot'), ...pool(9, 'martini')], categories)).toBe(3 * 8 + 4 * 2);
  });
});

describe('setupIssues', () => {
  it('is silent for a deep pool and a reachable band', () => {
    expect(setupIssues(pool(31, 'shot'), categories, [12, 16])).toEqual([]);
  });

  it('blocks when the pool cannot fill a round', () => {
    const issues = setupIssues(pool(6, 'shot'), categories, [12, 16]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('blocking');
    expect(issues[0].message).toMatch(/6 drinks/);
  });

  it('warns when the band cannot be reached', () => {
    const issues = setupIssues(pool(13, 'martini'), categories, [18, 24]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toMatch(/14/);
  });

  it('reports only the blocking issue when the pool is also too small', () => {
    const issues = setupIssues(pool(3, 'martini'), categories, [18, 24]);
    expect(issues.map((i) => i.severity)).toEqual(['blocking']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/session/setupGuards.test.ts`
Expected: FAIL — cannot resolve `@/lib/session/setupGuards`.

- [ ] **Step 3: Write the guards**

```ts
// src/lib/session/setupGuards.ts
import { DRINKS_PER_ROUND } from '@/lib/drinks/schema';
import type { Category, CategoryId, Drink } from '@/lib/drinks/types';

export interface SetupIssue {
  readonly severity: 'blocking' | 'warning';
  readonly message: string;
}

/** The largest total a round could reach: the seven biggest caps in the pool. */
export function maxAchievableUnits(
  pool: readonly Drink[],
  categories: ReadonlyMap<CategoryId, Category>,
): number {
  return pool
    .map((drink) => categories.get(drink.categoryId)?.maxQuantity ?? 0)
    .sort((a, b) => b - a)
    .slice(0, DRINKS_PER_ROUND)
    .reduce((sum, cap) => sum + cap, 0);
}

export function setupIssues(
  pool: readonly Drink[],
  categories: ReadonlyMap<CategoryId, Category>,
  band: readonly [number, number],
): SetupIssue[] {
  if (pool.length < DRINKS_PER_ROUND) {
    return [{
      severity: 'blocking',
      message: `Only ${pool.length} drinks are enabled in the selected categories. A round needs ${DRINKS_PER_ROUND}.`,
    }];
  }

  const ceiling = maxAchievableUnits(pool, categories);
  if (band[0] > ceiling) {
    return [{
      severity: 'warning',
      message: `These categories top out at ${ceiling} drinks per round, below this difficulty's ${band[0]}. Rounds will be clamped to ${ceiling}.`,
    }];
  }

  return [];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/session/setupGuards.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the setup screen**

```tsx
// src/app/setup/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
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

export default function SetupPage() {
  const router = useRouter();
  const { hydrated, activeProfile } = useProfiles();
  const [config, setConfig] = useState(defaultSessionConfig);
  const [drinks, setDrinks] = useState<DrinkListState | null>(null);

  useEffect(() => {
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
    savePrefs(activeProfile.id, config);
    saveActiveSession(createSession(crypto.randomUUID(), activeProfile.id, config, Date.now()));
    router.push('/play');
  };

  return (
    <main>
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
```

- [ ] **Step 6: Verify the screen by hand against the production build**

```bash
npm run typecheck
npm run build
tmux new-session -d -s ueddl "npm run start"
```

Open `http://localhost:3000`, create a profile, continue to Setup. Two checks:
- Leave only Martinis checked and pick Rush — the "top out at 14" warning appears and Start stays enabled.
- Uncheck every category — the blocking message appears and Start is disabled.

Stop the server with `tmux kill-session -t ueddl`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/session/setupGuards.ts src/lib/session/setupGuards.test.ts src/app/setup
git commit -m "feat: add setup screen with pool and band guards"
```

---
### Task 12: The session hook

Wires the pure reducer to real clocks, real randomness, and persistence. This is the only place in the app that calls `Date.now()` for a *recorded* value.

**Files:**
- Create: `src/hooks/useNow.ts`
- Create: `src/hooks/useWakeLock.ts`
- Create: `src/hooks/useSessionMachine.ts`
- Test: `src/hooks/useSessionMachine.test.tsx`

**Interfaces:**
- Consumes: `loadDrinkList`, `poolFor`, `categoryMap` from `@/lib/drinks/repository`; `dealRound` from `@/lib/session/generator`; `systemRng` from `@/lib/session/rng`; `sessionReducer`, `elapsedMs`, `toRecord`, `SessionState`, `SessionAction` from `@/lib/session/machine`; `averageMs` from `@/lib/session/metrics`; `loadActiveSession`, `saveActiveSession`, `clearActiveSession`, `commitSession` from `@/lib/session/repository`
- Produces:
  - `useNow(active: boolean, intervalMs?: number): number`
  - `useWakeLock(active: boolean): void`
  - `useSessionMachine(): SessionMachine` — `{ hydrated, state, elapsedMs, averageMs, lastRound, startRound(), pause(), resume(), advance(), end() }`

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useSessionMachine.test.tsx
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionMachine } from '@/hooks/useSessionMachine';
import { defaultSessionConfig } from '@/lib/session/config';
import { createSession } from '@/lib/session/machine';
import { loadActiveSession, loadSession, loadSessionIndex, saveActiveSession } from '@/lib/session/repository';

const START = 1_800_000_000_000;

async function mountWithSession(roundCount: number) {
  const config = { ...defaultSessionConfig(), roundCount };
  saveActiveSession(createSession('s1', 'p1', config, START));
  const rendered = renderHook(() => useSessionMachine());
  await act(async () => {});
  return rendered;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSessionMachine', () => {
  it('hydrates the stored active session at rest', async () => {
    const { result } = await mountWithSession(2);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.state?.status).toBe('resting');
    expect(result.current.elapsedMs).toBe(0);
  });

  it('deals seven distinct drinks when a round starts', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });

    const ticket = result.current.state?.current?.ticket ?? [];
    expect(ticket).toHaveLength(7);
    expect(new Set(ticket.map((line) => line.drinkId)).size).toBe(7);
    expect(result.current.state?.status).toBe('running');
  });

  it('records the round duration from wall-clock timestamps', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });

    vi.setSystemTime(START + 200_000);
    await act(async () => { result.current.advance(); });

    expect(result.current.state?.rounds[0].durationMs).toBe(200_000);
    expect(result.current.state?.status).toBe('resting');
    expect(result.current.averageMs).toBe(200_000);
  });

  it('excludes paused time from the recorded duration', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });

    vi.setSystemTime(START + 50_000);
    await act(async () => { result.current.pause(); });
    vi.setSystemTime(START + 80_000);
    await act(async () => { result.current.resume(); });
    vi.setSystemTime(START + 230_000);
    await act(async () => { result.current.advance(); });

    expect(result.current.state?.rounds[0].durationMs).toBe(200_000);
    expect(result.current.state?.rounds[0].pausedMs).toBe(30_000);
  });

  it('persists progress after every round so a refresh can resume', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });
    vi.setSystemTime(START + 100_000);
    await act(async () => { result.current.advance(); });

    expect(loadActiveSession()?.rounds).toHaveLength(1);
  });

  it('commits the session and clears the active slot on the final round', async () => {
    const { result } = await mountWithSession(1);
    await act(async () => { result.current.startRound(); });
    vi.setSystemTime(START + 100_000);
    await act(async () => { result.current.advance(); });

    expect(result.current.state?.status).toBe('complete');
    expect(loadSessionIndex('p1')).toEqual(['s1']);
    expect(loadSession('s1')?.rounds).toHaveLength(1);
    expect(loadActiveSession()).toBeNull();
  });

  it('commits an abandoned session with a null completedAt', async () => {
    const { result } = await mountWithSession(5);
    await act(async () => { result.current.startRound(); });
    vi.setSystemTime(START + 30_000);
    await act(async () => { result.current.end(); });

    expect(loadSession('s1')?.completedAt).toBeNull();
    expect(loadSession('s1')?.rounds).toEqual([]);
  });

  it('advances the displayed elapsed time as the clock actually runs', async () => {
    // The interval in useNow is the only thing that makes the clock visibly
    // move. Every other test asserts state immediately after a discrete action,
    // which would still pass if the ticker were entirely broken.
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });
    expect(result.current.elapsedMs).toBe(0);

    await act(async () => {
      vi.setSystemTime(START + 1_500);
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(result.current.elapsedMs).toBe(1_500);
  });

  it('freezes the displayed time while paused even as the clock runs on', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });

    vi.setSystemTime(START + 10_000);
    await act(async () => { result.current.pause(); });
    const frozen = result.current.elapsedMs;
    expect(frozen).toBe(10_000);

    await act(async () => {
      vi.setSystemTime(START + 60_000);
      await vi.advanceTimersByTimeAsync(50_000);
    });
    expect(result.current.elapsedMs).toBe(frozen);
  });

  it('does nothing when there is no active session', async () => {
    const { result } = renderHook(() => useSessionMachine());
    await act(async () => {});
    expect(result.current.state).toBeNull();
    await act(async () => { result.current.startRound(); });
    expect(result.current.state).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/hooks/useSessionMachine.test.tsx`
Expected: FAIL — cannot resolve `@/hooks/useSessionMachine`.

- [ ] **Step 3: Write the clock hook**

```tsx
// src/hooks/useNow.ts
'use client';
import { useEffect, useState } from 'react';

/**
 * A clock reading that refreshes while `active`. Display only — every recorded
 * value comes from Date.now() at the instant of the action, never from here.
 */
export function useNow(active: boolean, intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return now;
}
```

- [ ] **Step 4: Write the wake lock hook**

```tsx
// src/hooks/useWakeLock.ts
'use client';
import { useEffect } from 'react';

/** Best-effort. Unsupported or denied is silent — the drill works without it. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: { release(): Promise<void> } | null = null;
    let cancelled = false;

    navigator.wakeLock
      .request('screen')
      .then((lock) => {
        if (cancelled) { void lock.release(); return; }
        sentinel = lock;
      })
      .catch(() => { /* denied */ });

    return () => {
      cancelled = true;
      void sentinel?.release();
    };
  }, [active]);
}
```

If TypeScript does not know `navigator.wakeLock`, add this to `src/types/wake-lock.d.ts`:

```ts
interface WakeLockSentinelLike { release(): Promise<void> }
interface Navigator { readonly wakeLock: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }
```

- [ ] **Step 5: Write the session hook**

```tsx
// src/hooks/useSessionMachine.ts
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { categoryMap, loadDrinkList, poolFor } from '@/lib/drinks/repository';
import type { DrinkListState } from '@/lib/drinks/types';
import { dealRound } from '@/lib/session/generator';
import {
  elapsedMs as computeElapsed, sessionReducer, toRecord,
  type SessionAction, type SessionState,
} from '@/lib/session/machine';
import { averageMs } from '@/lib/session/metrics';
import { systemRng } from '@/lib/session/rng';
import {
  clearActiveSession, commitSession, loadActiveSession, saveActiveSession,
} from '@/lib/session/repository';
import type { RoundRecord } from '@/lib/session/types';

export interface SessionMachine {
  readonly hydrated: boolean;
  readonly state: SessionState | null;
  readonly elapsedMs: number;
  readonly averageMs: number | null;
  readonly lastRound: RoundRecord | null;
  startRound(): void;
  pause(): void;
  resume(): void;
  advance(): void;
  end(): void;
}

export function useSessionMachine(): SessionMachine {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<SessionState | null>(null);
  const stateRef = useRef<SessionState | null>(null);
  const drinksRef = useRef<DrinkListState | null>(null);

  useEffect(() => {
    const restored = loadActiveSession();
    stateRef.current = restored;
    drinksRef.current = loadDrinkList();
    setState(restored);
    setHydrated(true);
  }, []);

  // Persistence happens here rather than inside a state updater: React may
  // invoke an updater twice in development, which would commit twice.
  const apply = useCallback((action: SessionAction) => {
    const previous = stateRef.current;
    if (previous === null) return;

    const next = sessionReducer(previous, action);
    if (next === previous) return;

    stateRef.current = next;
    if (next.status === 'complete') {
      commitSession(toRecord(next));
      clearActiveSession();
    } else {
      saveActiveSession(next);
    }
    setState(next);
  }, []);

  const startRound = useCallback(() => {
    const previous = stateRef.current;
    const drinks = drinksRef.current;
    if (previous === null || drinks === null) return;

    const pool = poolFor(drinks, previous.config.categoryIds);
    const last = previous.rounds[previous.rounds.length - 1];
    const dealtLastRound = last ? last.ticket.map((line) => line.drinkId) : [];
    const ticket = dealRound(pool, categoryMap(), previous.config.band, dealtLastRound, systemRng);

    apply({ type: 'startRound', ticket, at: Date.now() });
  }, [apply]);

  const pause = useCallback(() => apply({ type: 'pause', at: Date.now() }), [apply]);
  const resume = useCallback(() => apply({ type: 'resume', at: Date.now() }), [apply]);
  const advance = useCallback(() => apply({ type: 'advance', at: Date.now() }), [apply]);
  const end = useCallback(() => apply({ type: 'end', at: Date.now() }), [apply]);

  const running = state?.status === 'running';
  // The ticker stops while paused, and that is safe: elapsedMs cancels `now`
  // out entirely once pausedAt is set, so a stale reading still renders right.
  const now = useNow(running);
  useWakeLock(running);

  return {
    hydrated,
    state,
    elapsedMs: state?.current ? computeElapsed(state.current, now) : 0,
    averageMs: state ? averageMs(state.rounds) : null,
    lastRound: state && state.rounds.length > 0 ? state.rounds[state.rounds.length - 1] : null,
    startRound, pause, resume, advance, end,
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/hooks/useSessionMachine.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useNow.ts src/hooks/useWakeLock.ts src/hooks/useSessionMachine.ts src/hooks/useSessionMachine.test.tsx
git commit -m "feat: add session hook wiring reducer to clock and storage"
```

---

### Task 13: The play screen

**Files:**
- Create: `src/components/play/Ticket.tsx`
- Create: `src/components/play/RoundClock.tsx`
- Create: `src/components/play/RestCard.tsx`
- Create: `src/components/play/play.css`
- Create: `src/app/play/page.tsx`
- Test: `src/components/play/Ticket.test.tsx`

**Interfaces:**
- Consumes: `useSessionMachine` from `@/hooks/useSessionMachine`; `formatDuration` from `@/lib/format/duration`; `verdict` from `@/lib/session/metrics`; `TicketLine`, `RoundRecord` from `@/lib/session/types`
- Produces: `<Ticket>`, `<RoundClock>`, `<RestCard>`, and the `/play` route

The total-units count lives outside the ticket list, so the list contains exactly the seven drinks and nothing else.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/play/Ticket.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Ticket } from '@/components/play/Ticket';
import type { TicketLine } from '@/lib/session/types';

const lines: TicketLine[] = [
  { drinkId: 'a', name: 'Green Tea Shot', categoryId: 'shot', quantity: 4 },
  { drinkId: 'b', name: 'Espresso Martini', categoryId: 'martini', quantity: 1 },
];

describe('Ticket', () => {
  it('lists exactly the dealt drinks', () => {
    render(<Ticket lines={lines} />);
    expect(screen.getByRole('list', { name: 'Round ticket' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows each drink with its quantity', () => {
    render(<Ticket lines={lines} />);
    expect(screen.getByText('Green Tea Shot')).toBeInTheDocument();
    expect(screen.getByText('×4')).toBeInTheDocument();
    expect(screen.getByText('×1')).toBeInTheDocument();
  });

  it('announces quantities to screen readers without relying on the × glyph', () => {
    render(<Ticket lines={lines} />);
    expect(screen.getByLabelText('Green Tea Shot, 4')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/play/Ticket.test.tsx`
Expected: FAIL — cannot resolve `@/components/play/Ticket`.

- [ ] **Step 3: Write the play components**

```tsx
// src/components/play/Ticket.tsx
import type { TicketLine } from '@/lib/session/types';
import './play.css';

export function Ticket({ lines }: { lines: readonly TicketLine[] }) {
  return (
    <ol className="ticket" aria-label="Round ticket">
      {lines.map((line) => (
        <li key={line.drinkId} className="ticket__line" aria-label={`${line.name}, ${line.quantity}`}>
          <span className="ticket__name">{line.name}</span>
          <span className="ticket__qty" aria-hidden="true">×{line.quantity}</span>
        </li>
      ))}
    </ol>
  );
}
```

```tsx
// src/components/play/RoundClock.tsx
import { formatDuration } from '@/lib/format/duration';
import './play.css';

interface RoundClockProps {
  readonly elapsedMs: number;
  readonly goalMs: number;
  readonly paused: boolean;
}

/**
 * Deliberately not a live region — announcing every tick would be hostile.
 * The static label tells assistive tech what the number means.
 */
export function RoundClock({ elapsedMs, goalMs, paused }: RoundClockProps) {
  return (
    <p className="clock" data-over={elapsedMs > goalMs} data-paused={paused}>
      <span className="clock__label">Time on this round</span>
      <span className="clock__value">{formatDuration(elapsedMs)}</span>
      <span className="clock__goal">goal {formatDuration(goalMs)}</span>
    </p>
  );
}
```

```tsx
// src/components/play/RestCard.tsx
import { formatDuration } from '@/lib/format/duration';
import { verdict } from '@/lib/session/metrics';
import type { RoundRecord } from '@/lib/session/types';
import './play.css';

interface RestCardProps {
  readonly round: RoundRecord;
  readonly goalMs: number;
  readonly averageMs: number | null;
}

export function RestCard({ round, goalMs, averageMs }: RestCardProps) {
  const outcome = verdict(round.durationMs, goalMs);
  return (
    <section className="rest" data-verdict={outcome} aria-live="polite">
      <h2>Round {round.index + 1} done</h2>
      <p className="rest__time">{formatDuration(round.durationMs)}</p>
      <p className="rest__verdict">
        {outcome === 'pass' ? `Under the ${formatDuration(goalMs)} goal` : `Over the ${formatDuration(goalMs)} goal`}
      </p>
      <p className="rest__average">
        Average so far {averageMs === null ? '—' : formatDuration(averageMs)}
      </p>
      <p className="rest__units">{round.totalUnits} drinks made</p>
    </section>
  );
}
```

```css
/* src/components/play/play.css */
.ticket { list-style: none; margin: 0; padding: var(--space-2); background: var(--color-docket); color: var(--color-ink); border-radius: var(--radius); }
.ticket__line { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); padding: var(--space-1) 0; border-bottom: 1px solid var(--color-line); }
.ticket__line:last-child { border-bottom: 0; }
.ticket__name { font-size: var(--text-drink); }
.ticket__qty { font-size: var(--text-drink); color: var(--color-accent); font-weight: 700; }

.clock { display: grid; justify-items: center; margin: var(--space-3) 0; }
.clock__label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-muted); }
.clock__value { font-size: var(--text-clock); line-height: 1; font-variant-numeric: tabular-nums; }
.clock__goal { font-size: 0.9rem; color: var(--color-muted); }
.clock[data-over='true'] .clock__value { color: var(--color-miss); }
.clock[data-paused='true'] .clock__value { opacity: 0.5; }

.rest { display: grid; justify-items: center; gap: var(--space-1); padding: var(--space-3); border: 1px solid var(--color-line); border-radius: var(--radius); }
.rest__time { font-size: var(--text-clock); line-height: 1; margin: 0; }
.rest[data-verdict='pass'] .rest__time { color: var(--color-pass); }
.rest[data-verdict='miss'] .rest__time { color: var(--color-miss); }
.rest__average, .rest__units { color: var(--color-muted); margin: 0; }
```

- [ ] **Step 4: Write the play route**

```tsx
// src/app/play/page.tsx
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

  const { startRound, pause, resume, advance, end } = machine;
  const status = state?.status;

  // Depends on `status` and the action callbacks, never on `machine` or `state`
  // themselves. `elapsedMs` changes on every ~100ms tick, so the machine object
  // is a new reference each tick — depending on it would tear down and
  // re-register this listener roughly ten times a second for the whole round.
  // The callbacks are useCallback-stable, so this now re-registers only when the
  // status actually changes: a handful of times per session.
  useEffect(() => {
    if (status === undefined || status === 'complete') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (status === 'resting') startRound();
        else advance();
      } else if (event.key.toLowerCase() === 'p') {
        if (status === 'running') pause();
        else if (status === 'paused') resume();
      } else if (event.key === 'Escape') {
        if (window.confirm('End this session early?')) end();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, startRound, pause, resume, advance, end]);

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
```

- [ ] **Step 5: Cover the pass/miss display**

`data-over` and `data-verdict` are the literal signal a bartender reads. Nothing
locks them in.

```tsx
// src/components/play/RoundClock.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoundClock } from '@/components/play/RoundClock';

const GOAL = 240_000;

describe('RoundClock', () => {
  it('renders the elapsed time as m:ss', () => {
    render(<RoundClock elapsedMs={125_000} goalMs={GOAL} paused={false} />);
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('does not flag over-goal at exactly the goal — the boundary is inclusive', () => {
    const { container } = render(<RoundClock elapsedMs={GOAL} goalMs={GOAL} paused={false} />);
    expect(container.querySelector('.clock')).toHaveAttribute('data-over', 'false');
  });

  it('flags over-goal one millisecond past it', () => {
    const { container } = render(<RoundClock elapsedMs={GOAL + 1} goalMs={GOAL} paused={false} />);
    expect(container.querySelector('.clock')).toHaveAttribute('data-over', 'true');
  });

  it('marks the paused state', () => {
    const { container } = render(<RoundClock elapsedMs={1_000} goalMs={GOAL} paused />);
    expect(container.querySelector('.clock')).toHaveAttribute('data-paused', 'true');
  });

  it('is not a live region — announcing every tick would be hostile', () => {
    const { container } = render(<RoundClock elapsedMs={1_000} goalMs={GOAL} paused={false} />);
    expect(container.querySelector('[aria-live]')).toBeNull();
  });
});
```

```tsx
// src/components/play/RestCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RestCard } from '@/components/play/RestCard';
import type { RoundRecord } from '@/lib/session/types';

const GOAL = 240_000;

const round = (durationMs: number): RoundRecord => ({
  index: 1,
  ticket: [{ drinkId: 'a', name: 'A', categoryId: 'shot', quantity: 4 }],
  totalUnits: 4,
  startedAt: 0,
  endedAt: durationMs,
  pausedMs: 0,
  durationMs,
});

describe('RestCard', () => {
  it('marks a round under the goal as a pass', () => {
    const { container } = render(<RestCard round={round(200_000)} goalMs={GOAL} averageMs={200_000} />);
    expect(container.querySelector('.rest')).toHaveAttribute('data-verdict', 'pass');
  });

  it('passes at exactly the goal', () => {
    const { container } = render(<RestCard round={round(GOAL)} goalMs={GOAL} averageMs={GOAL} />);
    expect(container.querySelector('.rest')).toHaveAttribute('data-verdict', 'pass');
  });

  it('marks a round over the goal as a miss', () => {
    const { container } = render(<RestCard round={round(GOAL + 1)} goalMs={GOAL} averageMs={GOAL + 1} />);
    expect(container.querySelector('.rest')).toHaveAttribute('data-verdict', 'miss');
  });

  it('names the round by its human number, not its index', () => {
    render(<RestCard round={round(200_000)} goalMs={GOAL} averageMs={200_000} />);
    expect(screen.getByRole('heading', { name: 'Round 2 done' })).toBeInTheDocument();
  });

  it('shows a dash rather than a number when there is no average yet', () => {
    render(<RestCard round={round(200_000)} goalMs={GOAL} averageMs={null} />);
    expect(screen.getByText(/Average so far/)).toHaveTextContent('—');
  });
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/components/play/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/play src/app/play
git commit -m "feat: add play screen with ticket, clock, and rest card"
```

---

### Task 14: Surfacing storage failures

Spec §11 requires two failures to reach the user rather than being swallowed: localStorage being unavailable entirely (Safari private mode, blocked storage), and the quota running out mid-session. The lower layers already report both — nothing displays them yet.

**Files:**
- Create: `src/components/ui/StorageBanner.tsx`
- Create: `src/components/ui/ui.css`
- Modify: `src/app/layout.tsx` (render the banner above the app)
- Modify: `src/hooks/useSessionMachine.ts` (expose `storageWarning`)
- Modify: `src/app/play/page.tsx` (render the warning)
- Test: `src/components/ui/StorageBanner.test.tsx`

**Interfaces:**
- Consumes: `isPersistent` from `@/lib/storage/localStore`; `useHydrated` from `@/hooks/useHydrated`
- Produces:
  - `<StorageBanner />`
  - `SessionMachine.storageWarning: Exclude<WriteOutcome, 'ok'> | null` — **derived**, not hand-copied, so it cannot drift from `WriteOutcome`
  - `<StorageWarning warning={...} />` in `src/components/play/StorageWarning.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/StorageBanner.test.tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageBanner } from '@/components/ui/StorageBanner';
import { isPersistent } from '@/lib/storage/localStore';

// vi.mock rather than vi.spyOn: spying on a live ES module export is not
// reliably redefinable, and this test must fail for real reasons only.
vi.mock('@/lib/storage/localStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage/localStore')>()),
  isPersistent: vi.fn(() => true),
}));

describe('StorageBanner', () => {
  beforeEach(() => { vi.mocked(isPersistent).mockReturnValue(true); });

  it('says nothing while storage is working', () => {
    render(<StorageBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('warns that nothing will be saved when storage is unavailable', async () => {
    vi.mocked(isPersistent).mockReturnValue(false);
    render(<StorageBanner />);
    expect(await screen.findByRole('status')).toHaveTextContent(/won't be saved/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/ui/StorageBanner.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/StorageBanner`.

- [ ] **Step 3: Write the banner**

```tsx
// src/components/ui/StorageBanner.tsx
'use client';
import { useHydrated } from '@/hooks/useHydrated';
import { isPersistent } from '@/lib/storage/localStore';
import './ui.css';

/**
 * Shown when localStorage threw on access — private browsing, blocked storage.
 * The app keeps working from an in-memory fallback, but nothing survives a
 * reload, and the bartender deserves to know before drilling for twenty minutes.
 */
export function StorageBanner() {
  const hydrated = useHydrated();
  if (!hydrated || isPersistent()) return null;

  return (
    <p className="banner" role="status">
      This browser is blocking local storage, so sessions and profiles won&apos;t be saved.
    </p>
  );
}
```

```css
/* src/components/ui/ui.css */
.banner {
  margin: 0;
  padding: var(--space-1) var(--space-2);
  background: var(--color-miss);
  color: var(--color-docket);
  text-align: center;
}
```

- [ ] **Step 4: Render the banner in the layout**

```tsx
// src/app/layout.tsx — replace the whole file
import type { Metadata } from 'next';
import { ProfileProvider } from '@/components/profile/ProfileProvider';
import { StorageBanner } from '@/components/ui/StorageBanner';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'Ultimate Elite Drink List',
  description: 'Bartender service-speed drill.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StorageBanner />
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Expose the write outcome from the session hook**

In `src/hooks/useSessionMachine.ts`, add `storageWarning` to the interface:

```tsx
export interface SessionMachine {
  readonly hydrated: boolean;
  readonly state: SessionState | null;
  readonly elapsedMs: number;
  readonly averageMs: number | null;
  readonly lastRound: RoundRecord | null;
  /** Non-null when the last write failed. 'quota' means history needs pruning. */
  /**
   * Derived from WriteOutcome rather than restated, so it cannot drift from it.
   * Two separate stale-union bugs in this plan came from restating a type by hand.
   */
  readonly storageWarning: Exclude<WriteOutcome, 'ok'> | null;
  startRound(): void;
  pause(): void;
  resume(): void;
  advance(): void;
  end(): void;
}
```

Add the state, replace the body of `apply`, and add `storageWarning` to the returned object:

```tsx
  const [storageWarning, setStorageWarning] = useState<Exclude<WriteOutcome, 'ok'> | null>(null);

  const apply = useCallback((action: SessionAction) => {
    const previous = stateRef.current;
    if (previous === null) return;

    const next = sessionReducer(previous, action);
    if (next === previous) return;

    stateRef.current = next;
    let outcome;
    if (next.status === 'complete') {
      outcome = commitSession(toRecord(next));
      clearActiveSession();
    } else {
      outcome = saveActiveSession(next);
    }
    setStorageWarning(outcome === 'ok' ? null : outcome);
    setState(next);
  }, []);
```

```tsx
  return {
    hydrated,
    state,
    elapsedMs: state?.current ? computeElapsed(state.current, now) : 0,
    averageMs: state ? averageMs(state.rounds) : null,
    lastRound: state && state.rounds.length > 0 ? state.rounds[state.rounds.length - 1] : null,
    storageWarning,
    startRound, pause, resume, advance, end,
  };
```

- [ ] **Step 6: Render the warning on the play screen**

In `src/app/play/page.tsx`, destructure it:

```tsx
  const { hydrated, state, elapsedMs, averageMs, lastRound, storageWarning } = machine;
```

and add this immediately after the opening `<main>` tag of every branch that renders a session (`complete`, `resting`, and the running branch):

```tsx
      <StorageWarning warning={storageWarning} />
```

- [ ] **Step 7: Extract the warning and test its copy**

The same 27-line ternary appearing in three branches is both duplication and
untestable in place. Extract it — that makes the copy directly assertable, which
matters because `'invalid'` carries a semantic requirement no type can enforce:
it must never read as a storage problem.

```tsx
// src/components/play/StorageWarning.tsx
import type { WriteOutcome } from '@/lib/storage/localStore';

export function StorageWarning({ warning }: { warning: Exclude<WriteOutcome, 'ok'> | null }) {
  if (warning === null) return null;

  return (
    <p role="alert">
      {warning === 'quota'
        ? "This device's storage is full — recent rounds may not have been saved."
        : warning === 'invalid'
          ? 'Something went wrong saving this round. Your earlier rounds are safe.'
          : "Local storage is blocked, so this session won't be saved."}
    </p>
  );
}
```

```tsx
// src/components/play/StorageWarning.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorageWarning } from '@/components/play/StorageWarning';

describe('StorageWarning', () => {
  it('renders nothing when there is no warning', () => {
    const { container } = render(<StorageWarning warning={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the device is full for a quota failure', () => {
    render(<StorageWarning warning="quota" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full/i);
  });

  it('says the session will not be saved when storage is blocked', () => {
    render(<StorageWarning warning="unavailable" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/won't be saved/i);
  });

  it('never blames storage for a non-serializable value', () => {
    // 'invalid' is a data-shape bug, not a storage problem. Telling the user
    // their storage is full or blocked would send them to fix the wrong thing.
    render(<StorageWarning warning="invalid" />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).not.toMatch(/full|blocked|storage/i);
    expect(text).toMatch(/earlier rounds are safe/i);
  });
});
```

Add two tests to `src/hooks/useSessionMachine.test.tsx` so a non-`'ok'` write
outcome is actually reachable in a test — currently nothing drives `apply()`
down that path:

```tsx
  it('surfaces a quota failure from the most recent write', async () => {
    const { result } = await mountWithSession(2);
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; },
      removeItem: () => {},
    });
    await act(async () => { result.current.startRound(); });
    expect(result.current.storageWarning).toBe('quota');
    vi.unstubAllGlobals();
  });

  it('clears the warning once a write succeeds again', async () => {
    const { result } = await mountWithSession(2);
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; },
      removeItem: () => {},
    });
    await act(async () => { result.current.startRound(); });
    expect(result.current.storageWarning).toBe('quota');

    vi.unstubAllGlobals();
    vi.setSystemTime(START + 100_000);
    await act(async () => { result.current.advance(); });
    expect(result.current.storageWarning).toBeNull();
  });
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- src/components/ui/StorageBanner.test.tsx src/hooks/useSessionMachine.test.tsx`
Expected: PASS. The session-hook suite must still pass unchanged — `storageWarning` is additive.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui src/app/layout.tsx src/hooks/useSessionMachine.ts src/app/play/page.tsx
git commit -m "feat: surface storage unavailability and quota failures"
```

---

### Task 15: End-to-end coverage

**Files:**
- Create: `e2e/drill.spec.ts`

**Interfaces:**
- Consumes: the running application at `http://localhost:3000`
- Produces: nothing importable — this is the outermost safety net

- [ ] **Step 1: Write the specs**

```ts
// e2e/drill.spec.ts
import { expect, test } from '@playwright/test';

async function createProfileAndOpenSetup(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('New profile').fill('Nathan');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('link', { name: /Start a session/ }).click();
}

test('runs a full three-round session and reports the average', async ({ page }) => {
  await createProfileAndOpenSetup(page);
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();

  for (let round = 1; round <= 3; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await expect(page.getByRole('list', { name: 'Round ticket' }).getByRole('listitem')).toHaveCount(7);
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Round times' }).getByRole('listitem')).toHaveCount(3);
});

test('hides the next ticket until the round is started', async ({ page }) => {
  await createProfileAndOpenSetup(page);
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();
});

test('resumes an interrupted session at rest rather than mid-round', async ({ page }) => {
  await createProfileAndOpenSetup(page);
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'Start round 1' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toHaveCount(0);
});

test('drives a whole round from the keyboard', async ({ page }) => {
  await createProfileAndOpenSetup(page);
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();

  await page.keyboard.press('Space');
  await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();

  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible();
});

test('blocks starting a session with too small a pool', async ({ page }) => {
  await createProfileAndOpenSetup(page);
  for (const label of ['Shots', 'Well Drinks', 'Cocktails', 'Martinis']) {
    await page.getByLabel(label).uncheck();
  }
  await expect(page.getByRole('alert')).toContainText('A round needs 7');
  await expect(page.getByRole('button', { name: 'Start session' })).toBeDisabled();
});
```

- [ ] **Step 2: Run the E2E suite**

Run: `npm run e2e`
Expected: all five specs PASS. Playwright builds and serves the app itself via the `webServer` config, so no server needs to be running first.

Storage-failure paths are covered by the unit tests in Task 14 rather than here:
simulating a throwing `localStorage` across a real browser session is far more
fragile than asserting it at the component boundary.

- [ ] **Step 3: Run the whole gate**

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run e2e
```

Expected: all green, coverage at or above 80% on lines, functions, branches, and statements.

- [ ] **Step 4: Commit and push**

```bash
git add e2e playwright.config.ts
git commit -m "test: add end-to-end coverage for the drill loop"
git push
```

---

## What this plan deliberately leaves out

These are spec sections that belong to later plans, listed so nobody mistakes their absence for an oversight:

| Spec section | Plan |
|---|---|
| §5 Export / import | Plan 3 — Manage & transfer |
| §8 `/summary/[sessionId]`, `/history` | Plan 2 — History & stats |
| §8 `/stats`, hand-rolled SVG charts | Plan 2 — History & stats |
| §8 `/drinks` manage screen | Plan 3 — Manage & transfer |
| §10 Typography, motion, both-theme polish | Plan 4 — Polish |
| §12 Visual regression, axe sweeps | Plan 4 — Polish |
| §13 Lighthouse verification | Plan 4 — Polish |

The MVP ships with the token palette and semantic markup in place, so Plan 4 is a refinement pass rather than a rewrite.
