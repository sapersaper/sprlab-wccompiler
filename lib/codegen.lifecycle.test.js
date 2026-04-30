/**
 * Tests for wcCompiler v2 Code Generator — Lifecycle Hooks
 *
 * Includes:
 * - Property 3: Codegen Mount Placement
 * - Property 4: Codegen Destroy Placement
 * - Property 5: Signal/Computed Transformation in Hook Bodies
 * - Unit tests for codegen edge cases
 *
 * Feature: lifecycle-hooks
 * Validates: Requirements 4.1–4.3, 5.1–5.4, 6.1–6.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateComponent } from './codegen.js';

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid kebab-case tag name */
const arbTagName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.stringMatching(/^[a-z]{2,6}$/)
  )
  .map(([a, b]) => `${a}-${b}`);

/** Convert kebab-case to PascalCase */
function toClassName(tag) {
  return tag.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/** Generate a valid JS identifier */
const arbIdentifier = fc
  .stringMatching(/^[a-z][a-z]{1,7}$/)
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'set'].includes(s));

/** Generate a simple hook body */
const arbHookBody = fc.constantFrom(
  "console.log('hook')",
  'const x = 1',
  "document.title = 'test'",
  'let a = 42',
);

/** Generate a lifecycle hook */
const arbLifecycleHook = arbHookBody.map(body => ({ body }));

/**
 * Generate a ParseResult IR with lifecycle hooks.
 * Ensures unique names across signals/computeds.
 */
const arbParseResultWithHooks = fc
  .record({
    tagName: arbTagName,
    signals: fc.array(
      fc.record({
        name: arbIdentifier,
        value: fc.constantFrom('0', '1', "'hello'", 'true'),
      }),
      { minLength: 0, maxLength: 3 }
    ),
    computeds: fc.array(
      fc.record({
        name: arbIdentifier,
        body: fc.constant('1 + 1'),
      }),
      { minLength: 0, maxLength: 2 }
    ),
    effects: fc.array(
      fc.record({ body: fc.constant("console.log('effect')") }),
      { minLength: 0, maxLength: 2 }
    ),
    events: fc.array(
      fc.record({
        varName: fc.nat({ max: 99 }).map(n => `__e${n}`),
        event: fc.constantFrom('click', 'input'),
        handler: arbIdentifier,
        path: fc.constant(['childNodes[0]']),
      }),
      { minLength: 0, maxLength: 2 }
    ),
    onMountHooks: fc.array(arbLifecycleHook, { minLength: 0, maxLength: 3 }),
    onDestroyHooks: fc.array(arbLifecycleHook, { minLength: 0, maxLength: 3 }),
  })
  .map(r => {
    const usedNames = new Set();
    const dedup = (arr, key) =>
      arr.filter(item => {
        if (usedNames.has(item[key])) return false;
        usedNames.add(item[key]);
        return true;
      });

    const signals = dedup(r.signals, 'name');
    const computeds = dedup(r.computeds, 'name');

    return {
      tagName: r.tagName,
      className: toClassName(r.tagName),
      template: '<div>test</div>',
      style: '',
      signals,
      computeds,
      effects: r.effects,
      methods: [],
      bindings: [],
      events: r.events,
      processedTemplate: '<div>test</div>',
      onMountHooks: r.onMountHooks,
      onDestroyHooks: r.onDestroyHooks,
    };
  });

// ── Property 3: Codegen Mount Placement ─────────────────────────────

describe('Feature: lifecycle-hooks, Property 3: Codegen Mount Placement', () => {
  it('mount hook bodies appear AFTER all __effect and addEventListener calls in connectedCallback', () => {
    /**
     * Validates: Requirements 4.1, 4.2, 4.3
     */
    fc.assert(
      fc.property(arbParseResultWithHooks, (ir) => {
        if (ir.onMountHooks.length === 0) return; // skip when no mount hooks

        const output = generateComponent(ir);

        // Find connectedCallback section
        const ccStart = output.indexOf('connectedCallback()');
        expect(ccStart).toBeGreaterThan(-1);

        // Find the end of connectedCallback (next method or closing brace at same indent)
        const afterCC = output.slice(ccStart);

        // Find last __effect( and last addEventListener( positions
        let lastEffectPos = -1;
        let lastAddEventPos = -1;
        let pos = 0;
        while (true) {
          const idx = afterCC.indexOf('__effect(', pos);
          if (idx === -1) break;
          lastEffectPos = idx;
          pos = idx + 1;
        }
        pos = 0;
        while (true) {
          const idx = afterCC.indexOf('addEventListener(', pos);
          if (idx === -1) break;
          lastAddEventPos = idx;
          pos = idx + 1;
        }

        // Find first mount hook body in output
        const firstHookBody = ir.onMountHooks[0].body;
        // The body gets transformed, but for simple bodies like "console.log('hook')"
        // it stays the same since there are no signal references
        const hookPos = afterCC.indexOf(firstHookBody);

        if (hookPos > -1) {
          // Mount hook should appear after all effects and event listeners
          if (lastEffectPos > -1) {
            expect(hookPos).toBeGreaterThan(lastEffectPos);
          }
          if (lastAddEventPos > -1) {
            expect(hookPos).toBeGreaterThan(lastAddEventPos);
          }
        }

        // All mount hooks should appear in order
        if (ir.onMountHooks.length > 1) {
          let prevPos = 0;
          for (const hook of ir.onMountHooks) {
            const p = afterCC.indexOf(hook.body, prevPos);
            expect(p).toBeGreaterThanOrEqual(prevPos);
            prevPos = p + 1;
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 4: Codegen Destroy Placement ───────────────────────────

describe('Feature: lifecycle-hooks, Property 4: Codegen Destroy Placement', () => {
  it('disconnectedCallback is present only when destroy hooks exist, with bodies in order', () => {
    /**
     * Validates: Requirements 5.1, 5.2, 5.3, 5.4
     */
    fc.assert(
      fc.property(arbParseResultWithHooks, (ir) => {
        const output = generateComponent(ir);

        if (ir.onDestroyHooks.length > 0) {
          // disconnectedCallback should be present
          expect(output).toContain('disconnectedCallback()');

          // Find disconnectedCallback section
          const dcStart = output.indexOf('disconnectedCallback()');
          const afterDC = output.slice(dcStart);

          // All destroy hook bodies should appear in order
          let prevPos = 0;
          for (const hook of ir.onDestroyHooks) {
            const p = afterDC.indexOf(hook.body, prevPos);
            expect(p).toBeGreaterThanOrEqual(0);
            prevPos = p + 1;
          }
        } else {
          // No disconnectedCallback when no destroy hooks
          expect(output).not.toContain('disconnectedCallback()');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 5: Signal/Computed Transformation in Hook Bodies ───────

describe('Feature: lifecycle-hooks, Property 5: Signal/Computed Transformation in Hook Bodies', () => {
  it('transforms signal reads, signal writes, computed reads, and prop reads in hook bodies', () => {
    /**
     * Validates: Requirements 6.1, 6.2, 6.3
     */
    fc.assert(
      fc.property(
        arbTagName,
        arbIdentifier.filter(n => n !== 'set'),
        arbIdentifier.filter(n => n !== 'set'),
        fc.constantFrom('onMount', 'onDestroy'),
        (tagName, signalName, computedName, hookType) => {
          // Ensure signal and computed names are different
          if (signalName === computedName) return;

          const hookBody = `console.log(${signalName}())\n${signalName}.set(${signalName}() + 1)\nconsole.log(${computedName}())`;

          const ir = {
            tagName,
            className: toClassName(tagName),
            template: '<div>test</div>',
            style: '',
            signals: [{ name: signalName, value: '0' }],
            computeds: [{ name: computedName, body: `${signalName}() * 2` }],
            effects: [],
            methods: [],
            bindings: [],
            events: [],
            processedTemplate: '<div>test</div>',
            onMountHooks: hookType === 'onMount' ? [{ body: hookBody }] : [],
            onDestroyHooks: hookType === 'onDestroy' ? [{ body: hookBody }] : [],
          };

          const output = generateComponent(ir);

          // Signal read: x() → this._x()
          expect(output).toContain(`this._${signalName}()`);
          // Signal write: x.set(value) → this._x(value)
          expect(output).toContain(`this._${signalName}(this._${signalName}() + 1)`);
          // Computed read: x() → this._c_x()
          expect(output).toContain(`this._c_${computedName}()`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests: Codegen Edge Cases ──────────────────────────────────

describe('Codegen lifecycle hooks — unit tests', () => {
  it('no disconnectedCallback when onDestroyHooks is empty (Req 5.4)', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<div>test</div>',
      style: '',
      signals: [],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      processedTemplate: '<div>test</div>',
      onMountHooks: [{ body: "console.log('mounted')" }],
      onDestroyHooks: [],
    };

    const output = generateComponent(ir);
    expect(output).not.toContain('disconnectedCallback');
  });

  it('mount hooks appear after if-effects and for-effects', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<div>test</div>',
      style: '',
      signals: [{ name: 'count', value: '0' }],
      computeds: [],
      effects: [{ body: "console.log('effect')" }],
      methods: [],
      bindings: [],
      events: [{ varName: '__e0', event: 'click', handler: 'inc', path: ['childNodes[0]'] }],
      processedTemplate: '<div>test</div>',
      ifBlocks: [],
      showBindings: [],
      forBlocks: [],
      onMountHooks: [{ body: "console.log('mounted')" }],
      onDestroyHooks: [],
    };

    const output = generateComponent(ir);
    const ccStart = output.indexOf('connectedCallback()');
    const afterCC = output.slice(ccStart);

    const effectPos = afterCC.indexOf('__effect(');
    const addEventPos = afterCC.indexOf('addEventListener(');
    const mountPos = afterCC.indexOf("console.log('mounted')");

    expect(mountPos).toBeGreaterThan(effectPos);
    expect(mountPos).toBeGreaterThan(addEventPos);
  });

  it('multiple mount hooks emitted in order', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<div>test</div>',
      style: '',
      signals: [],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      processedTemplate: '<div>test</div>',
      onMountHooks: [
        { body: "console.log('first')" },
        { body: "console.log('second')" },
      ],
      onDestroyHooks: [],
    };

    const output = generateComponent(ir);
    const firstPos = output.indexOf("console.log('first')");
    const secondPos = output.indexOf("console.log('second')");
    expect(firstPos).toBeGreaterThan(-1);
    expect(secondPos).toBeGreaterThan(firstPos);
  });

  it('multiple destroy hooks emitted in order', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<div>test</div>',
      style: '',
      signals: [],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      processedTemplate: '<div>test</div>',
      onMountHooks: [],
      onDestroyHooks: [
        { body: "console.log('cleanup1')" },
        { body: "console.log('cleanup2')" },
      ],
    };

    const output = generateComponent(ir);
    expect(output).toContain('disconnectedCallback()');
    const dcStart = output.indexOf('disconnectedCallback()');
    const afterDC = output.slice(dcStart);
    const firstPos = afterDC.indexOf("console.log('cleanup1')");
    const secondPos = afterDC.indexOf("console.log('cleanup2')");
    expect(firstPos).toBeGreaterThan(-1);
    expect(secondPos).toBeGreaterThan(firstPos);
  });

  it('transforms prop references in hook bodies', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<div>test</div>',
      style: '',
      signals: [],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      processedTemplate: '<div>test</div>',
      propDefs: [{ name: 'label', default: "'hello'", attrName: 'label' }],
      propsObjectName: 'props',
      onMountHooks: [{ body: 'console.log(props.label)' }],
      onDestroyHooks: [],
    };

    const output = generateComponent(ir);
    expect(output).toContain('this._s_label()');
  });
});
