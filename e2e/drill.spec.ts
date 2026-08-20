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

  // Unlike a locator action, keyboard.press() targets whatever currently has
  // focus and does not auto-wait for the page to be ready. The click above
  // triggers a client-side route transition to /play; without this wait, the
  // key can be dispatched before that page has mounted and registered its
  // keydown listener, and is lost — this is a test-timing gap, not the app
  // missing the keystroke.
  await expect(page.getByRole('button', { name: 'Start round 1' })).toBeVisible();
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
  // Scoped to `main`: Next.js's App Router injects its own global
  // `[role="alert"]` route announcer (`#__next-route-announcer__`) outside
  // the page content for accessibility, so an unscoped getByRole('alert')
  // matches two elements. The setup guard's alert is the one inside `main`.
  await expect(page.getByRole('main').getByRole('alert')).toContainText('A round needs 7');
  await expect(page.getByRole('button', { name: 'Start session' })).toBeDisabled();
});
