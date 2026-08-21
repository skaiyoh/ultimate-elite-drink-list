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
