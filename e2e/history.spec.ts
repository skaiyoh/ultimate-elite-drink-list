// e2e/history.spec.ts
import { expect, test } from '@playwright/test';
import { abandonSession, createProfile, runSession } from './helpers';

test('says history is empty before anything has been run', async ({ page }) => {
  await createProfile(page);
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('main')).toContainText('No sessions yet');
});

test('lists a finished session and opens its summary', async ({ page }) => {
  await createProfile(page);
  await runSession(page, 3);

  await page.getByRole('link', { name: 'History' }).click();
  const sessions = page.getByRole('list', { name: 'Past sessions' }).getByRole('listitem');
  await expect(sessions).toHaveCount(1);
  await expect(sessions.first()).toContainText('3 rounds');

  await sessions.first().getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Session summary' })).toBeVisible();
  // One header row plus one row per round.
  await expect(page.getByRole('table', { name: 'Rounds' }).getByRole('row')).toHaveCount(4);
});

test('opens the summary straight from the completion screen', async ({ page }) => {
  await createProfile(page);
  await runSession(page, 3);

  await page.getByRole('link', { name: 'View summary' }).click();
  await expect(page.getByRole('heading', { name: 'Session summary' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('3 rounds');
});

test('keeps an abandoned session in history and marks it as ended early', async ({ page }) => {
  await createProfile(page);
  await abandonSession(page);

  await page.getByRole('link', { name: 'History' }).click();
  const sessions = page.getByRole('list', { name: 'Past sessions' }).getByRole('listitem');
  await expect(sessions).toHaveCount(1);
  await expect(sessions.first()).toContainText('Ended early');
});

test('reports lifetime totals and plots the charts once a session exists', async ({ page }) => {
  await createProfile(page);
  await runSession(page, 3);

  // Off /play first: the nav is deliberately absent there.
  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await expect(page.getByRole('term').filter({ hasText: 'Sessions' })).toBeVisible();
  await expect(page.getByTestId('total-sessions')).toHaveText('1');
  await expect(page.getByTestId('total-rounds')).toHaveText('3');

  // Each chart stands in for its graphic with a real table of the same numbers.
  await expect(page.getByRole('table', { name: 'Session average' })).toBeAttached();
  await expect(page.getByRole('table', { name: 'Recent rounds' })).toBeAttached();
  await expect(page.getByRole('table', { name: 'Pace' })).toBeAttached();
});

test('tells you what to do when there is nothing to chart yet', async ({ page }) => {
  await createProfile(page);
  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('main')).toContainText('Run a session');
});

test('keeps one profile history out of another', async ({ page }) => {
  await createProfile(page, 'Nathan');
  await runSession(page, 3);

  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('link', { name: 'Profiles' }).click();
  await page.getByLabel('New profile').fill('Sam');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('main')).toContainText('No sessions yet');
});

test('hides the nav during a round so it cannot be left by accident', async ({ page }) => {
  await createProfile(page);
  await page.getByRole('link', { name: 'Drill' }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
});
