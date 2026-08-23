// e2e/drill.spec.ts
import { expect, test } from '@playwright/test';
import { abandonSession } from './helpers';

test('runs a full three-round session and reports the average', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();

  for (let round = 1; round <= 3; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await expect(page.getByRole('list', { name: 'Round ticket' }).getByRole('listitem')).toHaveCount(7);
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  // A finished run now lands on /results rather than rendering its own copy
  // of the summary inline — see the "finished run lands on the results
  // screen" test below for the redirect itself; this test's own concern is
  // that the session actually reports the average once it gets there.
  await expect(page.getByRole('heading', { name: 'Last run' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Average');
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);
});

test('hides the next ticket until the round is started', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();
});

test('resumes an interrupted session at rest rather than mid-round', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'Start round 1' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toHaveCount(0);
});

test('drives a whole round from the keyboard', async ({ page }) => {
  await page.goto('/');
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
  await page.goto('/');
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

test('a finished run lands on the results screen and survives a refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();

  for (let round = 1; round <= 3; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);

  await page.reload();
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);
});

test('starting over records nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await page.getByRole('button', { name: 'Next round' }).click();
  await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start over' }).click();

  await expect(page.getByRole('heading', { name: 'Set up a session' })).toBeVisible();
  await page.getByRole('link', { name: 'Last run' }).click();
  await expect(page.getByRole('main')).toContainText('No run on this device yet');
});

test('a second run replaces the first', async ({ page }) => {
  // The premise of the whole revision: one slot, overwritten. Covered at unit
  // level too, but this is the path a second person walking up actually takes.
  await page.goto('/');
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  for (let round = 1; round <= 3; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);

  await page.getByRole('link', { name: 'Run another' }).click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  for (let round = 1; round <= 5; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  // Five rows plus a header — the three-round run is gone, not appended to.
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(6);
});

test('a declined start over leaves the session running', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Start over' }).click();

  await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();
});

test('a run ended early is kept and marked as such', async ({ page }) => {
  await abandonSession(page);
});
