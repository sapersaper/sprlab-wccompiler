/**
 * Tests for compiler ref validation.
 *
 * Includes:
 * - Property test for REF_NOT_FOUND error (Property 5)
 * - Unit tests for compiler validation edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-refs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/** Generate a valid ref name */
const refNameArb = fc.stringMatching(/^[a-z][a-z]{1,7}$/);

// ── Property Test: Ref Not Found Error (Property 5) ─────────────────

describe('Feature: template-refs, Property 5: Ref Not Found Error', () => {
  /**
   * **Validates: Requirements 5.1**
   */
  it('throws REF_NOT_FOUND when templateRef name has no matching ref in template', async () => {
    await fc.assert(
      fc.asyncProperty(
        refNameArb,
        async (refName) => {
          const dir = createTempDir();
          try {
            // Template with NO ref attributes
            writeFileSync(join(dir, 'comp.html'), '<div>hello</div>');
            writeFileSync(
              join(dir, 'comp.js'),
              `import { defineComponent, templateRef } from 'wcc'

export default defineComponent({
  tag: 'wcc-test',
  template: './comp.html',
})

const myRef = templateRef('${refName}')
`
            );

            try {
              await compile(join(dir, 'comp.js'));
              // Should not reach here
              return false;
            } catch (err) {
              return err.code === 'REF_NOT_FOUND';
            }
          } finally {
            cleanupDir(dir);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests: Compiler Validation Edge Cases ──────────────────────

describe('compile() — ref validation', () => {
  it('throws REF_NOT_FOUND when templateRef(\'missing\') has no ref="missing" in template', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'comp.html'), '<div>hello</div>');
      writeFileSync(
        join(dir, 'comp.js'),
        `import { defineComponent, templateRef } from 'wcc'

export default defineComponent({
  tag: 'wcc-test',
  template: './comp.html',
})

const missing = templateRef('missing')
`
      );

      await expect(compile(join(dir, 'comp.js'))).rejects.toThrow();
      try {
        await compile(join(dir, 'comp.js'));
      } catch (e) {
        expect(e.code).toBe('REF_NOT_FOUND');
      }
    } finally {
      cleanupDir(dir);
    }
  });

  it('emits warning for unused ref (ref="extra" with no templateRef("extra"))', async () => {
    const dir = createTempDir();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      writeFileSync(join(dir, 'comp.html'), '<div ref="extra">hello</div>');
      writeFileSync(
        join(dir, 'comp.js'),
        `import { defineComponent } from 'wcc'

export default defineComponent({
  tag: 'wcc-test',
  template: './comp.html',
})
`
      );

      // Should compile successfully (warning is non-fatal)
      const output = await compile(join(dir, 'comp.js'));
      expect(output).toBeDefined();

      // Verify warning was emitted
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ref="extra"')
      );
    } finally {
      warnSpy.mockRestore();
      cleanupDir(dir);
    }
  });

  it('compiles successfully when all refs are matched (no errors or warnings)', async () => {
    const dir = createTempDir();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      writeFileSync(join(dir, 'comp.html'), '<canvas ref="canvas"></canvas>');
      writeFileSync(
        join(dir, 'comp.js'),
        `import { defineComponent, templateRef } from 'wcc'

export default defineComponent({
  tag: 'wcc-test',
  template: './comp.html',
})

const canvas = templateRef('canvas')
`
      );

      const output = await compile(join(dir, 'comp.js'));
      expect(output).toContain('this._ref_canvas');
      expect(output).toContain('get _canvas()');
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      cleanupDir(dir);
    }
  });
});
