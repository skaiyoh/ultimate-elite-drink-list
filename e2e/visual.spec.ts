// e2e/visual.spec.ts — spec §12: the three review-worthy screens at four
// breakpoints, in both themes. Playwright disables animations for screenshots,
// so the docket's arrival does not make these flake.
//
// Baselines are per-platform (…-chromium-darwin.png). Generated on another OS
// they will differ on font rasterisation alone, so regenerate rather than
// debug if this suite is ever run elsewhere.
import { expect, test, type Page } from '@playwright/test';
import { createProfile, seedLastRun, seedSevenDrinks } from './helpers';

const WIDTHS = [320, 768, 1024, 1440] as const;
const THEMES = ['light', 'dark'] as const;

async function open(page: Page, theme: string, go: (page: Page) => Promise<void>) {
  await createProfile(page);
  await page.evaluate((t) => localStorage.setItem('ueddl:v1:theme', JSON.stringify(t)), theme);
  await page.reload();
  await go(page);
}

const startRound = async (page: Page) => {
  await seedSevenDrinks(page);
  await page.getByRole('link', { name: 'Drill' }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await expect(page.getByRole('list', { name: 'Round ticket' })).toBeVisible();
};

interface Screen {
  readonly name: string;
  readonly go: (page: Page) => Promise<void>;
  /**
   * Off for a screen whose full height is mostly repetition. /drinks renders
   * ninety-odd identical rows; captured full-page it accounted for 4MB of a
   * 5.7MB baseline set and told us nothing the first screenful does not.
   */
  readonly fullPage?: boolean;
  /**
   * Regions that legitimately differ between runs. The round generator is
   * random by design, so a dealt ticket's names, quantities and the totals
   * derived from them cannot be baselined — but the docket around them, the
   * type, the rules and the spacing all can.
   */
  readonly volatile?: readonly string[];
}

const screens: readonly Screen[] = [
  {
    name: 'setup',
    go: async (page) => {
      await page.getByRole('link', { name: 'Drill' }).click();
      await expect(page.getByRole('heading', { name: 'Set up a session' })).toBeVisible();
    },
  },
  {
    name: 'play-running',
    go: startRound,
    volatile: ['.clock__value', '.ticket__qty', '.docket-head'],
  },
  {
    name: 'play-resting',
    go: async (page) => {
      await startRound(page);
      await page.getByRole('button', { name: 'Next round' }).click();
      await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible();
    },
    volatile: ['.rest__units'],
  },
  {
    name: 'results',
    go: async (page) => {
      await seedLastRun(page);
      await page.goto('/results');
      await expect(page.getByRole('heading', { name: 'Last run' })).toBeVisible();
    },
  },
  {
    name: 'drinks',
    fullPage: false,
    go: async (page) => {
      await page.getByRole('link', { name: 'Drinks' }).click();
      await expect(page.getByRole('heading', { name: 'Drinks', level: 1 })).toBeVisible();
    },
  },
];

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const screen of screens) {
      test(`${screen.name} at ${width} in ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page, theme, screen.go);

        await expect(page).toHaveScreenshot(`${screen.name}-${width}-${theme}.png`, {
          fullPage: screen.fullPage ?? true,
          mask: (screen.volatile ?? []).map((selector) => page.locator(selector)),
        });
      });
    }
  }
}

// Overflow is checked at more widths than the screenshots cover: a baseline
// only catches a change, while this catches the bug outright.
for (const width of [320, 375, 768, 1024, 1440, 1920]) {
  test(`no horizontal overflow at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'dark', async () => {});

    for (const path of ['/', '/setup', '/drinks']) {
      await page.goto(path);
      await expect(page.getByRole('heading').first()).toBeVisible();

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways at this width`).toBeLessThanOrEqual(0);
    }
  });
}
