/**
 * Vitest setup file for configuring property-based tests.
 * 
 * This ensures deterministic behavior for fast-check property tests
 * by setting a fixed seed, preventing flaky test failures.
 */

// Configure fast-check with a fixed seed for deterministic tests
const fc = require('fast-check');
fc.configureGlobal({ seed: 42 });
