import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Recent Node builds ship a native `localStorage` global on by default.
// Without a configured --localstorage-file it resolves to a bare object
// with none of the Storage prototype methods. Vitest's jsdom environment
// only forwards jsdom's `window.localStorage` onto the test globals when
// the name isn't already present on the Node global (see `getWindowKeys`
// in vitest/dist/chunks/index.*.js), so that broken native stub silently
// shadows jsdom's real Storage — breaking `window.localStorage` (and
// vitest.setup.ts's `beforeEach` clear()) for every test.
// --no-experimental-webstorage removes the competing global.
//
// Guarded by feature detection, not a Node version: the flag is only
// passed to workers on builds that actually ship the global, which are
// exactly the builds that recognize the negation flag — so this
// self-adapts instead of hardcoding a version number that can drift out
// of sync. The vitest worker forks from this same process with no
// execPath override, so detecting here correctly predicts the worker.
const hasNativeWebStorage = 'localStorage' in globalThis;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    execArgv: hasNativeWebStorage ? ['--no-experimental-webstorage'] : [],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Route components are covered by the Playwright suite in Task 14, not
      // by Vitest. Including them here would fail the gate on untested lines
      // that are in fact tested, one layer out.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/app/**', 'src/data/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
