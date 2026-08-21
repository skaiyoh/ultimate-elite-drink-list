// e2e/budget.spec.ts — spec §13, measured rather than asserted.
//
// The JS budget in §13 is expressed as a total, but a total is mostly a
// property of the framework, not of anything written here. These tests split
// it: the framework floor is recorded so it cannot drift unnoticed, and the
// app's own contribution — the only part this codebase controls — is the thing
// actually held to a limit.
import { expect, test, type Browser } from '@playwright/test';
import { gzipSync } from 'node:zlib';

/** Next's built-in 404: the framework runtime with no application code on it. */
const FLOOR_ROUTE = '/_not-found';
/** The heaviest route: charts, stats aggregation and the full session library. */
const HEAVIEST_ROUTE = '/stats';

/** Spec §13. Comfortably met, and worth keeping that way. */
const CSS_BUDGET_KB = 30;

/**
 * What this codebase may add on top of the framework, gzipped. Measured at
 * ~6KB across every route; the ceiling leaves room to grow without letting a
 * charting or date library slip in unnoticed, which is what §13 is defending.
 */
const APP_JS_BUDGET_KB = 40;

/**
 * Measured in its own context every time. Sharing one gives the second route a
 * warm HTTP cache, so its chunks never come back over the wire and it measures
 * as nearly nothing — which made this test pass or fail depending on order.
 */
async function transferred(browser: Browser, route: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const sizes = new Map<string, { kind: string; size: number }>();

  page.on('response', async (res) => {
    const url = res.url();
    if (sizes.has(url) || !url.startsWith('http://localhost:3100')) return;
    const kind = /\.js(\?|$)/.test(url) ? 'js' : /\.css(\?|$)/.test(url) ? 'css' : 'other';
    if (kind === 'other') return;
    try {
      sizes.set(url, { kind, size: gzipSync(await res.body()).length });
    } catch {
      // Redirects and cached responses have no retrievable body.
    }
  });

  // `load`, not `networkidle`: past load Next prefetches every linked route,
  // which is real bandwidth but not what this route needs in order to render.
  await page.goto(route, { waitUntil: 'load' });

  const total = (kind: string) =>
    [...sizes.values()].filter((v) => v.kind === kind).reduce((sum, v) => sum + v.size, 0) / 1024;

  const measured = { js: total('js'), css: total('css') };
  await context.close();

  // A route that appears to ship no JavaScript means the measurement failed,
  // not that the budget was met.
  expect(measured.js, `${route} reported no JS at all`).toBeGreaterThan(1);
  return measured;
}

test('the app adds little to the framework it sits on', async ({ browser }) => {
  const floor = await transferred(browser, FLOOR_ROUTE);
  const heaviest = await transferred(browser, HEAVIEST_ROUTE);

  const appJs = heaviest.js - floor.js;
  expect(
    appJs,
    `app JS is ${appJs.toFixed(1)}kb gz over a ${floor.js.toFixed(1)}kb framework floor`,
  ).toBeLessThan(APP_JS_BUDGET_KB);
});

test('css stays well inside its budget', async ({ browser }) => {
  const { css } = await transferred(browser, HEAVIEST_ROUTE);
  expect(css, `css is ${css.toFixed(1)}kb gz`).toBeLessThan(CSS_BUDGET_KB);
});

test('no charting, animation or icon library has crept in', async () => {
  // §13's real defence. A total-bytes check would not notice a 40KB library
  // arriving on one route; the dependency list cannot hide it.
  const { dependencies } = await import('../package.json', { with: { type: 'json' } })
    .then((m) => m.default as { dependencies: Record<string, string> });

  expect(Object.keys(dependencies).sort()).toEqual(['next', 'react', 'react-dom', 'zod']);
});
