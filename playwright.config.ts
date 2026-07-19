import { defineConfig } from '@playwright/test';

// E2E config for the regression suite. Uses the installed system Chrome (channel) so no browser
// download is needed. Target via E2E_BASE_URL; the specs skip themselves when creds/DB env are
// absent (see e2e/regressions.spec.ts header for the variable list).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1, // flows share test accounts; serial keeps asserts deterministic
  reporter: [['list']],
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 1000 },
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
  },
});
