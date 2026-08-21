// e2e/helpers.ts — shared journeys. Not a spec file: Playwright's default
// testMatch only picks up *.spec.ts / *.test.ts, so this is never run as one.
import { expect, type Page } from '@playwright/test';

export async function createProfile(page: Page, name = 'Nathan'): Promise<void> {
  await page.goto('/');
  await page.getByLabel('New profile').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/** Runs a session end to end and leaves the browser on the completion screen. */
export async function runSession(page: Page, rounds: 3 | 5 | 10 = 3): Promise<void> {
  await page.getByRole('link', { name: 'Drill' }).click();
  await page.getByRole('button', { name: String(rounds), exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();

  for (let round = 1; round <= rounds; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
}

/** Starts a session, runs one round, then ends it early with Escape. */
export async function abandonSession(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Drill' }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await page.getByRole('button', { name: 'Next round' }).click();

  await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Session ended early' })).toBeVisible();
}

/**
 * Writes a fixed history straight into storage.
 *
 * Screens that render a dealt round or aggregate one are otherwise different
 * on every run — the generator is random by design — which makes screenshot
 * baselines flake rather than catch anything. Seeding fixed numbers gives the
 * charts a real shape to be compared against, too.
 */
export async function seedHistory(page: Page): Promise<void> {
  await page.evaluate(() => {
    const profileId = JSON.parse(localStorage.getItem('ueddl:v1:active-profile') ?? 'null');
    if (profileId === null) throw new Error('seedHistory needs an active profile');

    const day = 86_400_000;
    const paces = [7.4, 7.0, 7.9, 6.6, 6.9, 6.1, 6.4, 5.8];
    const ids: string[] = [];

    paces.forEach((pace, s) => {
      const id = `seeded-${s}`;
      ids.unshift(id);
      const rounds = Array.from({ length: 5 }, (_, r) => {
        const units = 12 + ((s * 3 + r * 5) % 5);
        const wobble = 1 + (((s * 7 + r * 13) % 11) - 5) / 28;
        const durationMs = Math.round(pace * 1000 * units * wobble);
        return {
          index: r,
          ticket: [{ drinkId: 'seeded', name: 'Seeded', categoryId: 'shot', quantity: units }],
          totalUnits: units, startedAt: 0, endedAt: durationMs, pausedMs: 0, durationMs,
        };
      });

      // Fixed epoch instants, not offsets from now: a date that moves is one
      // more thing for a baseline to disagree with tomorrow.
      const startedAt = Date.UTC(2026, 0, 5) + s * day * 5;
      localStorage.setItem(`ueddl:v1:session:${id}`, JSON.stringify({
        id, profileId, startedAt, completedAt: startedAt + 1,
        config: {
          roundCount: 5,
          difficultyId: s % 3 === 0 ? 'rush' : 'standard',
          band: s % 3 === 0 ? [18, 24] : [12, 16],
          goalMs: 240_000,
          categoryIds: ['shot', 'well', 'cocktail', 'martini'],
        },
        rounds,
      }));
    });

    localStorage.setItem(`ueddl:v1:profile:${profileId}:session-index`, JSON.stringify(ids));
  });
}

/**
 * Cuts the pool down to exactly seven drinks.
 *
 * A round deals seven of whatever is enabled, so this fixes the dealt ticket.
 * The only thing left varying is the quantities, which ride on a fixed-width
 * rail and can be masked without moving anything around them.
 */
export async function seedSevenDrinks(page: Page): Promise<void> {
  await page.evaluate(() => {
    // All seven share a name on purpose. dealRound requires distinct ids, not
    // distinct names, and it shuffles the order — so seven different names
    // render in a different sequence every run. Seven identical ones render
    // the same pixels under any permutation, which keeps the ticket's real
    // typography inside the baseline instead of behind a mask.
    const names = Array.from({ length: 7 }, () => 'Fixed Drink');
    localStorage.setItem('ueddl:v1:drinks', JSON.stringify({
      schemaVersion: 1,
      // Matches the shipped SEED_VERSION so mergeSeed does not top the list
      // back up with every seed drink on the next read.
      seedVersion: 2,
      drinks: names.map((name, i) => ({
        id: `fixed-${i}`, name, categoryId: 'well', enabled: true,
      })),
      removedSeedIds: [],
    }));
  });
}
