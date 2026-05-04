import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    root: '.',
    exclude: ['dist/**', 'node_modules/**'],
  },
});
