import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

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
    // This Node build (v25.4.0) ships a native `localStorage` global on by
    // default (--webstorage). Without a configured --localstorage-file, it
    // resolves to a bare object with none of the Storage prototype methods.
    // Vitest's jsdom environment only forwards a jsdom window property onto
    // the test globals when the name isn't already present on the Node
    // global, so that broken native stub silently shadows jsdom's real,
    // working Storage — breaking `window.localStorage` (and
    // vitest.setup.ts's `beforeEach` clear()) for every test. Disabling the
    // feature in the worker process restores jsdom's Storage as the one
    // tests see.
    execArgv: ['--no-experimental-webstorage'],
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
