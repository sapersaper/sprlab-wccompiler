/**
 * Tests for config loader after standalone removal.
 *
 * Feature: zero-runtime
 * Validates that standalone in config is a no-op (no validation, not in defaults).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../lib/config.js';

const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-config-nostandalone-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe('Config Loader — standalone is removed', () => {
  it('standalone: true in config is silently accepted (no validation)', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: true };\n`
    );

    const config = await loadConfig(dir);
    // standalone is no longer part of default config
    expect(config.standalone).toBe(true); // passed through since user specified it
  });

  it('standalone is not in defaults when no config exists', async () => {
    const dir = createTempDir();
    const config = await loadConfig(dir);
    expect(config.standalone).toBeUndefined();
  });

  it('standalone: false in config is silently accepted (no validation)', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: false };\n`
    );

    const config = await loadConfig(dir);
    expect(config.standalone).toBe(false);
  });

  it('standalone: "yes" in config does NOT throw (no validation)', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: 'yes' };\n`
    );

    const config = await loadConfig(dir);
    expect(config.standalone).toBe('yes');
  });

  it('standalone: null in config does NOT throw (no validation)', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { standalone: null };\n`
    );

    const config = await loadConfig(dir);
    expect(config.standalone).toBeNull();
  });
});
