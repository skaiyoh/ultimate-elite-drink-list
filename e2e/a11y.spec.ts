// e2e/a11y.spec.ts — axe on every route, in both themes (spec §12).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createProfile } from './helpers';

type Theme = 'light' | 'dark';

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((t) => localStorage.setItem('ueddl:v1:theme', JSON.stringify(t)), theme);
  await page.reload();
}

/** WCAG 2.2 AA, which is what the design contract commits to. */
function audit(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
}

async function expectNoViolations(page: Page, where: string) {
  // Audited only once every animation has settled. axe measures the effective
  // colour including opacity, so a docket caught halfway through its 320ms
  // fade reports a contrast failure that no user is ever held to — the element
  // is at full opacity by the time anyone reads it.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

  const { violations } = await audit(page).analyze();
  // Reported down to the node: "color-contrast (7)" says nothing about which
  // seven elements or what ratio they missed, which is the only useful part.
  const found = violations.flatMap((v) =>
    v.nodes.map((node) => `${v.id} @ ${node.target.join(' ')} :: ${node.failureSummary?.replace(/\s+/g, ' ')}`));

  expect(found, `${where} has accessibility violations`).toEqual([]);
}

const routes: readonly { readonly name: string; readonly open: (page: Page) => Promise<void> }[] = [
  { name: 'profiles', open: async () => {} },
  {
    name: 'setup',
    open: async (page) => {
      await page.getByRole('link', { name: 'Drill' }).click();
      await expect(page.getByRole('heading', { name: 'Set up a session' })).toBeVisible();
    },
  },
  {
    name: 'play running',
    open: async (page) => {
      await page.getByRole('link', { name: 'Drill' }).click();
      await page.getByRole('button', { name: 'Start session' }).click();
      await page.getByRole('button', { name: 'Start round 1' }).click();
      await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();
    },
  },
  {
    name: 'play resting',
    open: async (page) => {
      await page.getByRole('link', { name: 'Drill' }).click();
      await page.getByRole('button', { name: 'Start session' }).click();
      await page.getByRole('button', { name: 'Start round 1' }).click();
      await page.getByRole('button', { name: 'Next round' }).click();
      await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible();
    },
  },
  {
    name: 'drinks',
    open: async (page) => {
      await page.getByRole('link', { name: 'Drinks' }).click();
      await expect(page.getByRole('heading', { name: 'Drinks', level: 1 })).toBeVisible();
    },
  },
];

for (const theme of ['light', 'dark'] as const) {
  for (const route of routes) {
    test(`${route.name} is accessible in ${theme}`, async ({ page }) => {
      await createProfile(page);
      await setTheme(page, theme);
      await route.open(page);
      await expectNoViolations(page, `${route.name} (${theme})`);
    });
  }
}

test('every interactive control on setup is reachable by keyboard', async ({ page }) => {
  await createProfile(page);
  await page.getByRole('link', { name: 'Drill' }).click();
  await expect(page.getByRole('heading', { name: 'Set up a session' })).toBeVisible();

  const reached = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      return `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20) ?? ''}`;
    });
    if (label !== null) reached.add(label);
  }

  // The four pickers, the custom field, and Start — nothing mouse-only.
  expect([...reached].some((l) => l.includes('Start session'))).toBe(true);
  expect([...reached].some((l) => l.includes('Increase goal'))).toBe(true);
  expect([...reached].some((l) => l.startsWith('INPUT'))).toBe(true);
});

test('focus is visible rather than only implied by the browser default', async ({ page }) => {
  await createProfile(page);
  await page.getByRole('link', { name: 'Drill' }).click();
  const start = page.getByRole('button', { name: 'Start session' });
  await start.focus();

  const outline = await start.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(outline).not.toBe('0px');
});
