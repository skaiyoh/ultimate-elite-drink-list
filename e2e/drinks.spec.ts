// e2e/drinks.spec.ts
import { expect, test } from '@playwright/test';
import { createProfile } from './helpers';

async function openDrinks(page: import('@playwright/test').Page) {
  await createProfile(page);
  await page.getByRole('link', { name: 'Drinks' }).click();
  await expect(page.getByRole('heading', { name: 'Drinks', level: 1 })).toBeVisible();
}

test('adds a drink and keeps it across a reload', async ({ page }) => {
  await openDrinks(page);
  await page.getByLabel('Drink name').fill('House Punch');
  await page.getByLabel('Category', { exact: true }).selectOption('well');
  await page.getByRole('button', { name: 'Add drink' }).click();

  await expect(page.getByRole('table', { name: 'Well Drinks' })).toContainText('House Punch');
  await page.reload();
  await expect(page.getByRole('table', { name: 'Well Drinks' })).toContainText('House Punch');
});

test('renames a drink in place', async ({ page }) => {
  await openDrinks(page);
  const field = page.getByLabel('Rename Margarita');
  await field.fill('Tommys Margarita');
  await field.press('Enter');

  await page.reload();
  await expect(page.getByLabel('Rename Tommys Margarita')).toHaveValue('Tommys Margarita');
});

test("86's a drink so it stops being dealt", async ({ page }) => {
  await openDrinks(page);
  await page.getByRole('button', { name: '86 Margarita' }).click();
  await expect(page.getByRole('button', { name: 'Restore Margarita' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Restore Margarita' })).toBeVisible();
});

test('deletes a seed drink and does not resurrect it on reload', async ({ page }) => {
  await openDrinks(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Margarita' }).click();
  await expect(page.getByLabel('Rename Margarita')).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel('Rename Margarita')).toHaveCount(0);
});

test('exports the drink list as a file', async ({ page }) => {
  await openDrinks(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export drink list' }).click();

  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^ueddl-drinks-\d{4}-\d{2}-\d{2}\.json$/);
});

test('imports a file after previewing what it would change', async ({ page }) => {
  await openDrinks(page);

  const payload = JSON.stringify({
    kind: 'ueddl.drink-list',
    schemaVersion: 1,
    exportedAt: 0,
    drinks: [
      { id: 'seed:margarita', name: 'Margarita', categoryId: 'cocktail', enabled: true },
      { id: 'imported-1', name: 'Imported Punch', categoryId: 'well', enabled: true },
    ],
    removedSeedIds: [],
  });

  await page.getByLabel('Import a drink list').setInputFiles({
    name: 'drinks.json', mimeType: 'application/json', buffer: Buffer.from(payload),
  });

  // Replace is the default, so this file drops every other seed drink.
  await expect(page.getByText(/added · .* changed · .* removed/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply import' }).click();

  await expect(page.getByRole('table', { name: 'Well Drinks' })).toContainText('Imported Punch');
  await page.reload();
  await expect(page.getByRole('table', { name: 'Well Drinks' })).toContainText('Imported Punch');
  await expect(page.getByLabel('Rename Moscow Mule')).toHaveCount(0);
});

test('refuses a malformed file and writes nothing', async ({ page }) => {
  await openDrinks(page);
  await page.getByLabel('Import a drink list').setInputFiles({
    name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ not json'),
  });

  await expect(page.getByRole('main').getByRole('alert')).toContainText('not valid JSON');
  await expect(page.getByRole('button', { name: 'Apply import' })).toHaveCount(0);
  await expect(page.getByLabel('Rename Margarita')).toBeVisible();
});

test('an 86d drink is never dealt', async ({ page }) => {
  await openDrinks(page);
  const cocktails = page.getByRole('table', { name: 'Cocktails' });

  // Leave exactly seven cocktails on, so a cocktails-only round is forced to
  // deal precisely those and the assertion is not probabilistic.
  const total = (await cocktails.getByRole('row').count()) - 1;
  for (let i = total; i > 7; i--) {
    await cocktails.getByRole('button', { name: /^86 / }).first().click();
  }
  await expect(page.getByRole('heading', { name: /^Cocktails · 7 of / })).toBeVisible();

  const stillOn = (await cocktails.getByRole('button', { name: /^86 / }).allTextContents())
    .map((label) => label.replace(/^86 /, ''))
    .sort();
  expect(stillOn).toHaveLength(7);

  await page.getByRole('link', { name: 'Drill' }).click();
  await expect(page.getByRole('heading', { name: 'Set up a session' })).toBeVisible();
  for (const label of ['Shots', 'Well Drinks', 'Martinis']) {
    await page.getByLabel(label).uncheck();
  }
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();

  const dealt = await page.getByRole('list', { name: 'Round ticket' })
    .locator('.ticket__name').allTextContents();
  expect(dealt.sort()).toEqual(stillOn);
});
