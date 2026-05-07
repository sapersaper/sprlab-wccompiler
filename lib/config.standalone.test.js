/**
 * Unit tests and property-based tests for standalone option in Config Loader.
 *
 * Feature: standalone-mode
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fc from 'fast-check';
import { loadConfig } from './config.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-config-standalone-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tempDirs.length = 0;
});

// ── Unit Tests (2.4) ────────────────────────────────────────────────

describe('Config Loader — standalone option', () => {
  it('standalone: true is parsed correctly', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: true };\n`
    );

    const config = await loadConfig(dir);
    expect(config.standalone).toBe(true);
  });

  it('standalone: false is parsed correctly', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: false };\n`
    );

    const config = await loadConfig(dir);
    expect(config.standalone).toBe(false);
  });

  it('standalone defaults to false when not specified in config', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { port: 3000 };\n`
    );

    const config = await loadConfig(dir);
    expect(config.standalone).toBe(false);
  });

  it('standalone defaults to false when no config file exists', async () => {
    const dir = createTempDir();
    // No wcc.config.js created

    const config = await loadConfig(dir);
    expect(config.standalone).toBe(false);
  });

  it('throws INVALID_CONFIG when standalone is a string', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: 'yes' };\n`
    );

    await expect(loadConfig(dir)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      message: expect.stringContaining('standalone debe ser un booleano'),
    });
  });

  it('throws INVALID_CONFIG when standalone is a number', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: 1 };\n`
    );

    await expect(loadConfig(dir)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      message: expect.stringContaining('standalone debe ser un booleano'),
    });
  });

  it('throws INVALID_CONFIG when standalone is null', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: null };\n`
    );

    await expect(loadConfig(dir)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      message: expect.stringContaining('standalone debe ser un booleano'),
    });
  });

  it('throws INVALID_CONFIG when standalone is an object', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: {} };\n`
    );

    await expect(loadConfig(dir)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      message: expect.stringContaining('standalone debe ser un booleano'),
    });
  });
});

// ── Property-Based Test (2.5) ───────────────────────────────────────

/**
 * **Validates: Requirements 2.4**
 *
 * Property 2 (config): For any non-boolean value of standalone in wcc.config.js,
 * the Config Loader SHALL throw an error with code INVALID_CONFIG.
 */
describe('Config Loader — Property 2: rejection of non-boolean standalone values', () => {
  it('rejects any non-boolean standalone value with INVALID_CONFIG', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything().filter(v => typeof v !== 'boolean' && v !== undefined),
        async (invalidValue) => {
          const dir = createTempDir();
          // Serialize the value safely for the config file
          const serialized = JSON.stringify(invalidValue);
          writeFileSync(
            join(dir, 'wcc.config.js'),
            `export default { standalone: ${serialized} };\n`
          );

          try {
            await loadConfig(dir);
            // Should not reach here
            return false;
          } catch (err) {
            return err.code === 'INVALID_CONFIG' &&
              err.message.includes('standalone debe ser un booleano');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
