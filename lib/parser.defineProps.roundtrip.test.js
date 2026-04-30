/**
 * Property-based test: Props Parser Round-Trip (Property 1)
 *
 * For any valid component source containing defineProps with random prop names
 * and defaults, parsing → prettyPrint → parsing again should produce
 * equivalent propDefs and propsObjectName.
 *
 * Feature: define-props, Property 1: Props Parser Round-Trip
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3
 */

import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from './parser.js';
import { prettyPrint } from './printer.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-rt-props-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── Generators ──────────────────────────────────────────────────────

const reserved = new Set([
  'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
  'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
  'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch',
  'export', 'import', 'default', 'signal', 'computed', 'effect', 'props',
  'defineProps', 'defineComponent', 'false',
]);

const arbPropName = fc
  .stringMatching(/^[a-z][a-zA-Z]{1,6}$/)
  .filter(s => !reserved.has(s));

const arbDefault = fc.constantFrom('0', '1', '42', "'hello'", "'world'", 'undefined');

const arbPropsObjectName = fc.constantFrom('props', 'myProps', 'p');

// ── Property test ───────────────────────────────────────────────────

describe('Feature: define-props, Property 1: Props Parser Round-Trip', () => {
  it('parse → prettyPrint → parse produces equivalent propDefs and propsObjectName', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uniqueArray(arbPropName, { minLength: 1, maxLength: 5 }),
          arbPropsObjectName
        ).chain(([propNames, objName]) =>
          fc.tuple(
            fc.constant(propNames),
            fc.constant(objName),
            fc.array(arbDefault, { minLength: propNames.length, maxLength: propNames.length })
          )
        ),
        async ([propNames, objName, defaults]) => {
          const dir1 = createTempDir();
          const tagName = 'my-comp';

          // Build source with defineProps({ name: default, ... })
          const propEntries = propNames.map((n, i) => `${n}: ${defaults[i]}`).join(', ');
          const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: '${tagName}',
  template: './${tagName}.html',
})

const ${objName} = defineProps({ ${propEntries} })
`;

          writeFileSync(join(dir1, `${tagName}.html`), '<div>hello</div>');
          writeFileSync(join(dir1, 'comp.js'), source);

          // First parse
          const ir1 = await parse(join(dir1, 'comp.js'));

          // Pretty-print
          const printed = prettyPrint(ir1);

          // Second parse
          const dir2 = createTempDir();
          writeFileSync(join(dir2, `${tagName}.html`), '<div>hello</div>');
          writeFileSync(join(dir2, 'comp.js'), printed);

          const ir2 = await parse(join(dir2, 'comp.js'));

          // Compare propDefs
          expect(ir2.propDefs).toHaveLength(ir1.propDefs.length);
          for (let i = 0; i < ir1.propDefs.length; i++) {
            expect(ir2.propDefs[i].name).toBe(ir1.propDefs[i].name);
            expect(ir2.propDefs[i].default).toBe(ir1.propDefs[i].default);
            expect(ir2.propDefs[i].attrName).toBe(ir1.propDefs[i].attrName);
          }

          // Compare propsObjectName
          expect(ir2.propsObjectName).toBe(ir1.propsObjectName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
