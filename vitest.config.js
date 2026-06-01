import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/frameworks-integrations/**',
      '**/e2e/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/lib.backup-phase4/**',
    ],
    testTimeout: 30000,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['lib/**/*.js', 'integrations/**/*.js'],
      exclude: [
        '**/*.test.js',
        'lib/wcc-runtime.js',
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 88,
        lines: 85,
      },
    },
  },
});
