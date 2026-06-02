import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './fixtures',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
