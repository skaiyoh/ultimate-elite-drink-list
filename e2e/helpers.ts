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
