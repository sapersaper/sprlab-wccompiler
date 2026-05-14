import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
});
