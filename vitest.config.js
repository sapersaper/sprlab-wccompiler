import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/frameworks-integrations/**', // Excluir proyectos de frameworks
    ],
    testTimeout: 30000,
    exclude: ['**/e2e/**', '**/node_modules/**'],
    // Configure fast-check for deterministic property-based tests
    // This prevents flaky tests by using a fixed seed
    setupFiles: ['./vitest.setup.js'],
  },
});
