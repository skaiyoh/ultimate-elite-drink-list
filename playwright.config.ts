import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  // Port 3100, not Next's default 3000. With `reuseExistingServer` set, a
  // foreign app already listening on 3000 would be silently adopted and the
  // whole suite would run against the wrong application — failing with
  // baffling selector errors, or worse, appearing to pass.
  // timezoneId pins what the seeded run's fixed instant renders as. /results
  // formats it in the reader's own zone, which is right for a device-local app
  // and wrong for a committed baseline: the same PNG reads 2:42 PM here, 7:42
  // PM in UTC, and Jan 6 east of UTC+5. Locale is already pinned in
  // lib/format/date.ts; this is the other half of the same problem.
  use: { baseURL: 'http://localhost:3100', timezoneId: 'UTC', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
