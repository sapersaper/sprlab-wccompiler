/**
 * Constructor Spec Compliance — Bug Condition & Preservation Tests
 *
 * Feature: constructor-spec-compliance (bugfix)
 *
 * Task 1: Bug Condition Exploration Test
 *   Validates: Requirements 1.1, 1.2, 2.1, 2.2
 *   Confirms that document.createElement on a compiled WCC component
 *   triggers a NotSupportedError (the bug) — test EXPECTED TO FAIL on unfixed code.
 *
 * Task 2: Preservation Property Tests
 *   Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9
 *   Verifies structural invariants of generated code that must hold
 *   on both unfixed and fixed code.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';
import { generateComponent } from './codegen.js';
import { JSDOM, VirtualConsole } from 'jsdom';

// ── Helpers ─────────────────────────────────────────────────────────

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-ctor-compliance-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Task 1: Bug Condition Exploration ───────────────────────────────

/**
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 *
 * Property 1: Bug Condition — Constructor Adds Children on createElement
 *
 * This test is EXPECTED TO FAIL on unfixed code because the constructor
 * performs DOM manipulation (appendChild), triggering a NotSupportedError
 * in jsdom's spec-compliant custom elements implementation.
 *
 * The test asserts the CORRECT behavior: createElement should complete
 * without any NotSupportedError. On unfixed code, jsdom reports the error
 * via VirtualConsole, confirming the bug.
 */
describe('Constructor spec compliance — Bug Condition', () => {
  it('document.createElement should produce an element without triggering NotSupportedError', async () => {
    const dir = createTempDir();
    try {
      // 1. Create a minimal .wcc component
      const sfcSource = [
        '<script>',
        "import { defineComponent, signal } from 'wcc'",
        '',
        "export default defineComponent({ tag: 'x-bugtest' })",
        '',
        'const count = signal(0)',
        '</script>',
        '',
        '<template><div>{{count()}}</div></template>',
      ].join('\n');

      writeFileSync(join(dir, 'x-bugtest.wcc'), sfcSource);

      // 2. Compile it
      const { code } = await compile(join(dir, 'x-bugtest.wcc'));

      // 3. Set up jsdom with VirtualConsole to capture errors
      const errors = [];
      const virtualConsole = new VirtualConsole();
      virtualConsole.on('jsdomError', (e) => {
        errors.push(e);
      });

      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously',
        virtualConsole,
      });

      // 4. Evaluate the compiled code in jsdom
      const scriptEl = dom.window.document.createElement('script');
      scriptEl.textContent = code;
      dom.window.document.head.appendChild(scriptEl);

      // 5. Call document.createElement(tagName)
      const element = dom.window.document.createElement('x-bugtest');

      // 6. Assert: no NotSupportedError should be triggered
      // On unfixed code, this FAILS because the constructor calls appendChild,
      // which triggers "NotSupportedError: Unexpected child nodes."
      const specViolations = errors.filter(e =>
        e.message && e.message.includes('NotSupportedError')
      );
      expect(specViolations).toHaveLength(0);

      // 7. Assert element has NO children (expected behavior per spec)
      expect(element.children.length).toBe(0);
      expect(element.innerHTML).toBe('');
    } finally {
      cleanupDir(dir);
    }
  });
});

// ── Task 2: Preservation Property Tests ─────────────────────────────

/**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9**
 *
 * Property 2: Preservation — Generated Code Structural Invariants
 *
 * These tests verify structural properties of the generated code that
 * must hold on BOTH unfixed and fixed code. They test what must be
 * preserved after the fix is applied.
 */

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid kebab-case tag name */
const arbTagName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,5}$/),
    fc.stringMatching(/^[a-z]{2,5}$/)
  )
  .map(([a, b]) => `${a}-${b}`);

/** Convert kebab-case to PascalCase */
function toClassName(tag) {
  return tag
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/** JS reserved words to avoid */
const RESERVED = new Set([
  'do', 'if', 'in', 'for', 'let', 'new', 'try', 'var', 'case',
  'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with',
  'break', 'catch', 'class', 'const', 'false', 'super', 'throw',
  'while', 'yield', 'delete', 'export', 'import', 'public',
  'return', 'static', 'switch', 'typeof',
]);

/** Generate a valid JS identifier (not a reserved word) */
const arbIdentifier = fc
  .stringMatching(/^[a-z][a-z]{1,6}$/)
  .filter(s => !RESERVED.has(s));

/** Generate a signal definition */
const arbSignal = fc.record({
  name: arbIdentifier,
  value: fc.constantFrom('0', '1', "''", "'hello'", '[]', 'null', 'true', 'false'),
});

/** Generate a computed definition */
const arbComputed = fc.record({
  name: arbIdentifier,
  body: fc.constant('1 + 1'),
});

/** Generate a prop definition */
const arbProp = fc.record({
  name: arbIdentifier,
  attrName: arbIdentifier.map(n => n.toLowerCase()),
  default: fc.constantFrom("''", '0', 'null', 'false'),
});

/** Generate a ParseResult with varying signals, computeds, and props */
const arbParseResult = fc
  .record({
    tagName: arbTagName,
    signals: fc.array(arbSignal, { minLength: 0, maxLength: 4 }),
    computeds: fc.array(arbComputed, { minLength: 0, maxLength: 3 }),
    propDefs: fc.array(arbProp, { minLength: 0, maxLength: 3 }),
  })
  .map(r => {
    // Deduplicate names across signals, computeds, and props
    const usedNames = new Set();
    const dedup = (arr, key) =>
      arr.filter(item => {
        if (usedNames.has(item[key])) return false;
        usedNames.add(item[key]);
        return true;
      });

    const signals = dedup(r.signals, 'name');
    const computeds = dedup(r.computeds, 'name');
    const propDefs = dedup(r.propDefs, 'name');

    // Ensure prop attrNames are unique
    const usedAttrs = new Set();
    const uniqueProps = propDefs.filter(p => {
      if (usedAttrs.has(p.attrName)) return false;
      usedAttrs.add(p.attrName);
      return true;
    });

    return {
      tagName: r.tagName,
      className: toClassName(r.tagName),
      style: '',
      signals,
      computeds,
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      processedTemplate: '<div>test</div>',
      propDefs: uniqueProps,
      ifBlocks: [],
      showBindings: [],
      forBlocks: [],
      onMountHooks: [],
      onDestroyHooks: [],
      modelBindings: [],
      attrBindings: [],
      slots: [],
      constantVars: [],
      watchers: [],
      refs: [],
      refBindings: [],
      childComponents: [],
      childImports: [],
      exposeNames: [],
    };
  });

describe('Constructor spec compliance — Preservation Properties', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9**
   *
   * For any compiled component, the generated code contains the expected
   * class structure, connectedCallback with idempotency guard, and
   * customElements.define registration.
   */
  it('generated code contains class extending HTMLElement', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);
        expect(output).toContain(`class ${ir.className} extends HTMLElement`);
      }),
      { numRuns: 100 }
    );
  });

  it('generated code contains connectedCallback with idempotency guard', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);
        expect(output).toContain('connectedCallback()');
        expect(output).toContain('if (this.__connected) return');
      }),
      { numRuns: 100 }
    );
  });

  it('generated code contains customElements.define(tagName, ClassName)', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);
        expect(output).toContain(`customElements.define('${ir.tagName}', ${ir.className})`);
      }),
      { numRuns: 100 }
    );
  });

  it('generated code contains signal initialization for each signal', () => {
    fc.assert(
      fc.property(
        arbParseResult.filter(ir => ir.signals.length > 0),
        (ir) => {
          const output = generateComponent(ir);
          for (const s of ir.signals) {
            expect(output).toContain(`this._${s.name} = __signal(${s.value})`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generated code contains prop signal initialization for each prop', () => {
    fc.assert(
      fc.property(
        arbParseResult.filter(ir => ir.propDefs.length > 0),
        (ir) => {
          const output = generateComponent(ir);
          for (const p of ir.propDefs) {
            expect(output).toContain(`this._s_${p.name} = __signal(${p.default})`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
