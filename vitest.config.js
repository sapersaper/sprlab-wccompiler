import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/frameworks-integrations/**', // Excluir proyectos de frameworks
      '**/e2e/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/lib.backup-phase4/**', // Phase 5 refactor backup
    ],
    testTimeout: 30000,
    // Configure fast-check for deterministic property-based tests
    // This prevents flaky tests by using a fixed seed
    setupFiles: ['./vitest.setup.js'],
  },
});
