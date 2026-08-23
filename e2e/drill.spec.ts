// e2e/drill.spec.ts
import { expect, test } from '@playwright/test';
import { abandonSession, seedLastRun } from './helpers';

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

test('the results screen says so when the device has no run', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Last run' }).click();
  await expect(page.getByRole('main')).toContainText('No run on this device yet');
});

test('starting over records nothing, and leaves the run before it alone', async ({ page }) => {
  await page.goto('/');
  // Seeded first, and that is the point. Started from an empty device this
  // passes whether Start over writes nothing or wipes the slot outright — and
  // wiping it means one mis-tap on round one destroys the run somebody
  // finished ten minutes ago, which is the worse of the two failures.
  await seedLastRun(page);

  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await page.getByRole('button', { name: 'Next round' }).click();
  await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start over' }).click();

  await expect(page.getByRole('heading', { name: 'Set up a session' })).toBeVisible();
  await page.getByRole('link', { name: 'Last run' }).click();

  // Neither wiped nor overwritten: the seeded five-round run is still the one
  // in the slot, rather than the empty state or the one round just scrapped.
  await expect(page.getByRole('main')).not.toContainText('No run on this device yet');
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(6);
  await expect(page.getByRole('main')).toContainText('Jan 5, 2026');
});

test('Back from the results screen does not return to the finished round', async ({ page }) => {
  // Spec §6 by name: /play replaces rather than pushes, so there is no history
  // entry for a session that has already been cleared to go back into.
  await page.goto('/');
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  for (let round = 1; round <= 3; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }
  await expect(page).toHaveURL(/\/results$/);

  await page.goBack();

  await expect(page).not.toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: 'Set up a session' })).toBeVisible();
});

test('a run whose save fails is still shown, and says it was not saved', async ({ page }) => {
  // The dead end this closes: /play replaces the route the moment the run
  // ends, so a failed write used to land you on a screen reading "No run on
  // this device yet" while the finished run sat unreachable in the backup.
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      // Only the run slot, so the rest of the app behaves and the assertions
      // below are about the dead end rather than about a bricked device.
      if (key === 'ueddl:v1:last-run') {
        const error = new Error('full');
        error.name = 'QuotaExceededError';
        throw error;
      }
      original.call(this, key, value);
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  for (let round = 1; round <= 3; round++) {
    await page.getByRole('button', { name: `Start round ${round}` }).click();
    await page.getByRole('button', { name: 'Next round' }).click();
  }

  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByRole('main')).not.toContainText('No run on this device yet');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be saved');
  // All three rounds — the last one is written through saveLastRun and
  // nowhere else, so a stale backup would render this run a round short.
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);
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

test('the next person to open the app inherits the last setup used', async ({ page }) => {
  // The landing screen tells the user this in copy. Every other test picks the
  // defaults, which would read identically whether prefs were stored and read
  // back or quietly ignored.
  await page.goto('/');
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: /^Rush/ }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByRole('button', { name: 'Start round 1' })).toBeVisible();

  await page.goto('/');

  await expect(page.getByRole('button', { name: '10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Rush/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'false');
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
