import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://lovie-p2p-gules.vercel.app';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // run sequentially so demo account state is predictable
  retries: 1,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'on',        // always record video (submission requirement)
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 20000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      // Mobile runs core user flows + responsive checks only.
      // Validation / security / authz (06-11) don't change behavior across
      // viewports; running them twice would double runtime without new coverage.
      testMatch: /(0[1-5]|12)-/,
    },
  ],
  outputDir: 'test-results',
});
