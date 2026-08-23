// e2e/helpers.ts — shared journeys. Not a spec file: Playwright's default
// testMatch only picks up *.spec.ts / *.test.ts, so this is never run as one.
import { expect, type Page } from '@playwright/test';

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
