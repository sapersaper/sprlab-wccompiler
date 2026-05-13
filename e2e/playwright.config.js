import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    // Capture trace on failure for debugging
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
