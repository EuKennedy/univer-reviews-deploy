import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config for the admin app.
 *
 * Specs hit a running dev server (default `BASE_URL=http://localhost:3000`).
 * In CI we boot Next.js via `pnpm exec next dev` from the github workflow
 * and pass `CI=1` so retries + workers behave conservatively. Local devs
 * can run against `pnpm dev` already running on :3000.
 *
 * Auth flows depend on Better Auth + Postgres being reachable. The spec
 * suite assumes a clean test DB (migrations applied, no leftover users).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: !process.env.CI, // serial in CI to avoid race on shared DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
