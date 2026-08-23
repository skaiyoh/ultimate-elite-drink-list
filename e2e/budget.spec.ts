// e2e/budget.spec.ts — spec §13, measured rather than asserted.
import { expect, test, type Browser } from '@playwright/test';
import { gzipSync } from 'node:zlib';

/** The heaviest route: the full drink list, its editor rows and the transfer panel. */
const HEAVIEST_ROUTE = '/drinks';

/**
 * Spec §13. /drinks measures at 202.7kb gz, against a 197.5kb framework floor —
 * a bare `'use client'` page containing nothing but an `<h1>` costs the same
 * 197.5kb, so almost all of this is Next and React rather than anything
 * written here.
 *
 * The ceiling governs the total while leaving ~12kb of headroom: a charting or
 * date library would blow straight through it, ordinary feature work will not.
 */
const TOTAL_JS_CEILING_KB = 215;

/**
 * A lower bound, because the failure most worth guarding against here is a
 * measurement that silently captured nothing. Waiting on `load` alone read
 * this route at 8.5kb on some runs; a page that appears to ship no framework
 * has not met its budget, it has failed to be measured.
 */
const TOTAL_JS_FLOOR_KB = 100;

/** Spec §13. Comfortably met, and worth keeping that way. */
const CSS_BUDGET_KB = 30;

async function transferred(browser: Browser, route: string, settled: string) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // A fresh context is not enough on its own — Chromium still served chunks
  // from a shared cache between measurements, which read the framework floor
  // ~63kb lighter than it is. This makes every run measure the wire.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  const sizes = new Map<string, { kind: string; size: number }>();
  page.on('response', async (res) => {
    const url = res.url();
    if (sizes.has(url) || !url.startsWith('http://localhost:3100')) return;
    const kind = /\.js(\?|$)/.test(url) ? 'js' : /\.css(\?|$)/.test(url) ? 'css' : 'other';
    if (kind === 'other') return;
    try {
      sizes.set(url, { kind, size: gzipSync(await res.body()).length });
    } catch {
      // Redirects have no retrievable body.
    }
  });

  await page.goto(route);
  // Waited on rendered content rather than on `load`: this text only appears
  // once the route has hydrated, which means every chunk it needs has arrived.
  await expect(page.getByText(settled).first()).toBeVisible();

  const total = (kind: string) =>
    [...sizes.values()].filter((v) => v.kind === kind).reduce((sum, v) => sum + v.size, 0) / 1024;

  const measured = { js: total('js'), css: total('css') };
  await context.close();
  return measured;
}

test('total javascript stays inside its ceiling', async ({ browser }) => {
  const { js } = await transferred(browser, HEAVIEST_ROUTE, 'Drinks');

  expect(js, `JS is ${js.toFixed(1)}kb gz — the measurement looks truncated`)
    .toBeGreaterThan(TOTAL_JS_FLOOR_KB);
  expect(js, `JS is ${js.toFixed(1)}kb gz`).toBeLessThan(TOTAL_JS_CEILING_KB);
});

test('css stays well inside its budget', async ({ browser }) => {
  const { css } = await transferred(browser, HEAVIEST_ROUTE, 'Drinks');
  expect(css, `css is ${css.toFixed(1)}kb gz`).toBeLessThan(CSS_BUDGET_KB);
});

test('no charting, animation or icon library has crept in', async () => {
  // §13's real defence, and the one a byte total is worst at: a library that
  // lands on a single route barely moves the number the other tests watch.
  const { dependencies } = await import('../package.json', { with: { type: 'json' } })
    .then((m) => m.default as { dependencies: Record<string, string> });

  expect(Object.keys(dependencies).sort()).toEqual(['next', 'react', 'react-dom', 'zod']);
});

/**
 * LCP and CLS from the browser's own observers rather than from Lighthouse.
 *
 * §13's targets are what matter, not the tool: Lighthouse would add a heavy
 * dependency to a project whose whole performance story is "ship no
 * libraries", and it reports these same two numbers. INP is left out on
 * purpose — it needs real interaction and is too noisy to assert on locally
 * without becoming a flaky test that gets ignored.
 */
const LCP_BUDGET_MS = 2500;
const CLS_BUDGET = 0.1;

for (const route of ['/', '/drinks']) {
  test(`${route} meets its core web vitals`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(route, { waitUntil: 'load' });
    const vitals = await page.evaluate(() => new Promise<{ lcp: number; cls: number }>((resolve) => {
      let lcp = 0;
      let cls = 0;

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          // Shifts within 500ms of an interaction are the user's doing, not the page's.
          if (!shift.hadRecentInput) cls += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });

      // Long enough for the font swap and the hydration render to land, which
      // are the two things that would move either number.
      setTimeout(() => resolve({ lcp, cls }), 1500);
    }));

    expect(vitals.lcp, `LCP ${vitals.lcp.toFixed(0)}ms`).toBeLessThan(LCP_BUDGET_MS);
    expect(vitals.cls, `CLS ${vitals.cls.toFixed(3)}`).toBeLessThan(CLS_BUDGET);
    await context.close();
  });
}
