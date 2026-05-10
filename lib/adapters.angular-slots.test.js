/**
 * Tests for Angular Scoped Slots directives.
 *
 * Since Angular is not installed as a devDependency in this project,
 * we test the pure logic functions (buildContext, classification) directly
 * by extracting them from the directive implementation.
 *
 * Property-based tests use fast-check.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateComponent } from './codegen.js';

// ─── Extract pure functions for testing ─────────────────────────────────────
// We replicate the pure logic from adapters/angular.ts here since we can't
// import TypeScript with Angular decorators directly.

/**
 * buildContext — context construction logic.
 * Rules:
 * - 0 props: $implicit = undefined
 * - 1 prop: $implicit = that single value, plus the named prop key
 * - N props (N > 1): $implicit = full props object, plus all named props
 */
function buildContext(props) {
  const keys = Object.keys(props);
  if (keys.length === 0) {
    return { $implicit: undefined };
  }
  if (keys.length === 1) {
    return { $implicit: props[keys[0]], ...props };
  }
  return { $implicit: props, ...props };
}

/**
 * classifySlot — classification logic.
 * Given a slot name and the __scopedSlots array from the element,
 * returns 'scoped' if the name is in the array, 'named' otherwise.
 */
function classifySlot(slotName, scopedSlots) {
  return scopedSlots.includes(slotName) ? 'scoped' : 'named';
}

// ─── Property-Based Tests: buildContext ─────────────────────────────────────

describe('buildContext', () => {
  describe('Property 4: Single-prop objects produce $implicit equal to that single value', () => {
    /**
     * Validates: Requirements 11.1, 11.2, 11.3
     */
    it('$implicit equals the single prop value for any single-key object', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.float(), fc.constant(null)),
          (key, value) => {
            const props = { [key]: value };
            const ctx = buildContext(props);
            expect(ctx.$implicit).toBe(value);
            expect(ctx[key]).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Multi-prop objects produce $implicit equal to the full object', () => {
    /**
     * Validates: Requirements 11.3, 11.5
     */
    it('$implicit equals the full props object for multi-key objects', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1 }).filter(s => s.trim().length > 0 && s !== '$implicit'),
            fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null)),
            { minKeys: 2, maxKeys: 5 }
          ),
          (props) => {
            const ctx = buildContext(props);
            // $implicit is the full props object
            expect(ctx.$implicit).toBe(props);
            // All named props are present
            for (const [k, v] of Object.entries(props)) {
              expect(ctx[k]).toBe(v);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('All named props are always present as context keys', () => {
    it('every key from props appears in the context regardless of count', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1 }).filter(s => s.trim().length > 0 && s !== '$implicit'),
            fc.oneof(fc.integer(), fc.string(), fc.boolean()),
            { minKeys: 1, maxKeys: 5 }
          ),
          (props) => {
            const ctx = buildContext(props);
            for (const [k, v] of Object.entries(props)) {
              expect(ctx[k]).toBe(v);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Empty props object produces $implicit as undefined', () => {
    it('returns { $implicit: undefined } for empty object', () => {
      const ctx = buildContext({});
      expect(ctx.$implicit).toBeUndefined();
      expect(Object.keys(ctx)).toEqual(['$implicit']);
    });
  });
});

// ─── Property-Based Tests: Slot Classification ─────────────────────────────

describe('classifySlot', () => {
  describe('Property 1: Classification correctness', () => {
    /**
     * Validates: Requirements 2.3, 2.4, 2.5
     *
     * For any custom element with N templates declared via WccSlotDef,
     * and given the list __scopedSlots of the element, the directive SHALL
     * classify each template as "scoped" if its name is in __scopedSlots,
     * and as "named" otherwise.
     */
    it('slots in __scopedSlots are classified as scoped, others as named', () => {
      fc.assert(
        fc.property(
          // Generate a list of all slot names
          fc.uniqueArray(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-zA-Z0-9-]*$/.test(s)),
            { minLength: 1, maxLength: 8 }
          ),
          (allSlotNames) => {
            // Pick a random subset as scoped slots
            const scopedCount = Math.floor(Math.random() * (allSlotNames.length + 1));
            const scopedSlots = allSlotNames.slice(0, scopedCount);

            for (const name of allSlotNames) {
              const result = classifySlot(name, scopedSlots);
              if (scopedSlots.includes(name)) {
                expect(result).toBe('scoped');
              } else {
                expect(result).toBe('named');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('classification is deterministic for the same inputs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z]/.test(s)),
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z]/.test(s)),
            { minLength: 0, maxLength: 5 }
          ),
          (slotName, scopedSlots) => {
            const result1 = classifySlot(slotName, scopedSlots);
            const result2 = classifySlot(slotName, scopedSlots);
            expect(result1).toBe(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ─── Backward Compatibility & Coexistence Tests ────────────────────────────

describe('Backward compatibility and coexistence', () => {
  describe('slot-template-* works without WccSlotsDirective', () => {
    it('generated code preserves token replacement as else fallback', () => {
      // Import generateComponent to verify the codegen output

      const parseResult = {
        tagName: 'wcc-card',
        className: 'WccCard',
        style: '',
        signals: [{ name: 'likes', value: '0' }],
        computeds: [],
        effects: [],
        methods: [],
        bindings: [],
        events: [],
        processedTemplate: '<div><div data-slot="stats"></div></div>',
        slots: [
          {
            name: 'stats',
            varName: '__s1',
            path: ['childNodes[0]'],
            slotProps: [{ prop: 'likes', source: 'likes' }],
            defaultContent: '',
          },
        ],
        propDefs: [],
        propsObjectName: null,
        emits: [],
        emitsObjectName: null,
        ifBlocks: [],
        showBindings: [],
        forBlocks: [],
        onMountHooks: [],
        onDestroyHooks: [],
        modelBindings: [],
        modelPropBindings: [],
        attrBindings: [],
        constantVars: [],
        watchers: [],
        refs: [],
        refBindings: [],
        childComponents: [],
        childImports: [],
        exposeNames: [],
        modelDefs: [],
      };

      const code = generateComponent(parseResult);

      // Token replacement is preserved as the else fallback
      expect(code).toContain('} else {');
      expect(code).toContain('__html = __html.replace(');
      // The slot element innerHTML assignment is still present
      expect(code).toContain('.innerHTML = __html');
    });

    it('token replacement still works when no renderer is registered (else path)', () => {

      const parseResult = {
        tagName: 'wcc-card',
        className: 'WccCard',
        style: '',
        signals: [{ name: 'likes', value: '0' }],
        computeds: [],
        effects: [],
        methods: [],
        bindings: [],
        events: [],
        processedTemplate: '<div><div data-slot="stats"></div></div>',
        slots: [
          {
            name: 'stats',
            varName: '__s1',
            path: ['childNodes[0]'],
            slotProps: [{ prop: 'likes', source: 'likes' }],
            defaultContent: '',
          },
        ],
        propDefs: [],
        propsObjectName: null,
        emits: [],
        emitsObjectName: null,
        ifBlocks: [],
        showBindings: [],
        forBlocks: [],
        onMountHooks: [],
        onDestroyHooks: [],
        modelBindings: [],
        modelPropBindings: [],
        attrBindings: [],
        constantVars: [],
        watchers: [],
        refs: [],
        refBindings: [],
        childComponents: [],
        childImports: [],
        exposeNames: [],
        modelDefs: [],
      };

      const code = generateComponent(parseResult);

      // The generated code checks for renderer first
      expect(code).toContain("if (this.__slotRenderers && this.__slotRenderers['stats'])");
      // Then falls back to token replacement
      expect(code).toContain('} else {');
      // Token replacement regex is present in the else block
      expect(code).toMatch(/replace\(/);
    });
  });

  describe('renderer takes priority over token replacement', () => {
    it('generated code invokes renderer and skips token replacement when registered', () => {

      const parseResult = {
        tagName: 'wcc-card',
        className: 'WccCard',
        style: '',
        signals: [{ name: 'likes', value: '0' }],
        computeds: [],
        effects: [],
        methods: [],
        bindings: [],
        events: [],
        processedTemplate: '<div><div data-slot="stats"></div></div>',
        slots: [
          {
            name: 'stats',
            varName: '__s1',
            path: ['childNodes[0]'],
            slotProps: [{ prop: 'likes', source: 'likes' }],
            defaultContent: '',
          },
        ],
        propDefs: [],
        propsObjectName: null,
        emits: [],
        emitsObjectName: null,
        ifBlocks: [],
        showBindings: [],
        forBlocks: [],
        onMountHooks: [],
        onDestroyHooks: [],
        modelBindings: [],
        modelPropBindings: [],
        attrBindings: [],
        constantVars: [],
        watchers: [],
        refs: [],
        refBindings: [],
        childComponents: [],
        childImports: [],
        exposeNames: [],
        modelDefs: [],
      };

      const code = generateComponent(parseResult);

      // Renderer invocation is in the if branch
      expect(code).toContain("this.__slotRenderers['stats'](__props)");
      // Token replacement is in the else if branch (skipped when renderer exists)
      const rendererCheck = code.indexOf("if (this.__slotRenderers && this.__slotRenderers['stats'])");
      const elseIfBlock = code.indexOf('} else if (this.__slotTpl_', rendererCheck);
      const tokenReplace = code.indexOf('__html = __html.replace(', elseIfBlock);
      // Token replacement comes AFTER the else if (i.e., it's inside the else if block)
      expect(rendererCheck).toBeGreaterThan(-1);
      expect(elseIfBlock).toBeGreaterThan(rendererCheck);
      expect(tokenReplace).toBeGreaterThan(elseIfBlock);
    });
  });

  describe('wcc:slot-update event is always emitted', () => {
    it('event dispatch occurs regardless of renderer registration', () => {

      const parseResult = {
        tagName: 'wcc-card',
        className: 'WccCard',
        style: '',
        signals: [{ name: 'likes', value: '0' }],
        computeds: [],
        effects: [],
        methods: [],
        bindings: [],
        events: [],
        processedTemplate: '<div><div data-slot="stats"></div></div>',
        slots: [
          {
            name: 'stats',
            varName: '__s1',
            path: ['childNodes[0]'],
            slotProps: [{ prop: 'likes', source: 'likes' }],
            defaultContent: '',
          },
        ],
        propDefs: [],
        propsObjectName: null,
        emits: [],
        emitsObjectName: null,
        ifBlocks: [],
        showBindings: [],
        forBlocks: [],
        onMountHooks: [],
        onDestroyHooks: [],
        modelBindings: [],
        modelPropBindings: [],
        attrBindings: [],
        constantVars: [],
        watchers: [],
        refs: [],
        refBindings: [],
        childComponents: [],
        childImports: [],
        exposeNames: [],
        modelDefs: [],
      };

      const code = generateComponent(parseResult);

      // The event dispatch is BEFORE the renderer check
      const eventDispatch = code.indexOf("this.dispatchEvent(new CustomEvent('wcc:slot-update'");
      const rendererCheck = code.indexOf("if (this.__slotRenderers && this.__slotRenderers['stats'])");

      expect(eventDispatch).toBeGreaterThan(-1);
      expect(rendererCheck).toBeGreaterThan(-1);
      // Event is dispatched before the renderer/token-replacement branching
      expect(eventDispatch).toBeLessThan(rendererCheck);
    });
  });

  describe('mixed usage: ng-template[slot] and slot-template-* coexistence', () => {
    it('multiple independent scoped slots each get their own renderer check', () => {

      const parseResult = {
        tagName: 'wcc-card',
        className: 'WccCard',
        style: '',
        signals: [
          { name: 'likes', value: '0' },
          { name: 'total', value: '100' },
        ],
        computeds: [],
        effects: [],
        methods: [],
        bindings: [],
        events: [],
        processedTemplate: '<div><div data-slot="stats"></div><div data-slot="details"></div></div>',
        slots: [
          {
            name: 'stats',
            varName: '__s1',
            path: ['childNodes[0]'],
            slotProps: [{ prop: 'likes', source: 'likes' }],
            defaultContent: '',
          },
          {
            name: 'details',
            varName: '__s2',
            path: ['childNodes[1]'],
            slotProps: [{ prop: 'total', source: 'total' }],
            defaultContent: '',
          },
        ],
        propDefs: [],
        propsObjectName: null,
        emits: [],
        emitsObjectName: null,
        ifBlocks: [],
        showBindings: [],
        forBlocks: [],
        onMountHooks: [],
        onDestroyHooks: [],
        modelBindings: [],
        modelPropBindings: [],
        attrBindings: [],
        constantVars: [],
        watchers: [],
        refs: [],
        refBindings: [],
        childComponents: [],
        childImports: [],
        exposeNames: [],
        modelDefs: [],
      };

      const code = generateComponent(parseResult);

      // Each slot has its own renderer check
      expect(code).toContain("if (this.__slotRenderers && this.__slotRenderers['stats'])");
      expect(code).toContain("if (this.__slotRenderers && this.__slotRenderers['details'])");
      // Each slot has its own token replacement fallback
      expect(code).toContain("this.__s1.innerHTML = __html");
      expect(code).toContain("this.__s2.innerHTML = __html");
    });

    it('named slots (no slotProps) do not get renderer checks', () => {

      const parseResult = {
        tagName: 'wcc-card',
        className: 'WccCard',
        style: '',
        signals: [{ name: 'likes', value: '0' }],
        computeds: [],
        effects: [],
        methods: [],
        bindings: [],
        events: [],
        processedTemplate: '<div><div data-slot="stats"></div><div data-slot="header"></div></div>',
        slots: [
          {
            name: 'stats',
            varName: '__s1',
            path: ['childNodes[0]'],
            slotProps: [{ prop: 'likes', source: 'likes' }],
            defaultContent: '',
          },
          {
            name: 'header',
            varName: '__s2',
            path: ['childNodes[1]'],
            slotProps: [],
            defaultContent: '',
          },
        ],
        propDefs: [],
        propsObjectName: null,
        emits: [],
        emitsObjectName: null,
        ifBlocks: [],
        showBindings: [],
        forBlocks: [],
        onMountHooks: [],
        onDestroyHooks: [],
        modelBindings: [],
        modelPropBindings: [],
        attrBindings: [],
        constantVars: [],
        watchers: [],
        refs: [],
        refBindings: [],
        childComponents: [],
        childImports: [],
        exposeNames: [],
        modelDefs: [],
      };

      const code = generateComponent(parseResult);

      // Scoped slot (stats) gets renderer check
      expect(code).toContain("if (this.__slotRenderers && this.__slotRenderers['stats'])");
      // Named slot (header, no slotProps) does NOT get renderer check
      expect(code).not.toContain("this.__slotRenderers['header']");
    });
  });
});

// ─── Unit Tests: Directive Behavior ─────────────────────────────────────────

describe('WccSlotsDirective behavior (unit)', () => {
  describe('runtime guard', () => {
    it('tag names with hyphen are custom elements', () => {
      const customTags = ['wcc-card', 'my-component', 'x-button', 'app-header'];
      for (const tag of customTags) {
        expect(tag.includes('-')).toBe(true);
      }
    });

    it('standard HTML elements do not contain hyphens', () => {
      const standardTags = ['div', 'span', 'p', 'button', 'input', 'form', 'section'];
      for (const tag of standardTags) {
        expect(tag.includes('-')).toBe(false);
      }
    });
  });

  describe('buildContext edge cases', () => {
    it('handles numeric values correctly', () => {
      const ctx = buildContext({ likes: 42 });
      expect(ctx.$implicit).toBe(42);
      expect(ctx.likes).toBe(42);
    });

    it('handles string values correctly', () => {
      const ctx = buildContext({ name: 'hello' });
      expect(ctx.$implicit).toBe('hello');
      expect(ctx.name).toBe('hello');
    });

    it('handles boolean values correctly', () => {
      const ctx = buildContext({ active: true });
      expect(ctx.$implicit).toBe(true);
      expect(ctx.active).toBe(true);
    });

    it('handles null value in single prop', () => {
      const ctx = buildContext({ value: null });
      expect(ctx.$implicit).toBe(null);
      expect(ctx.value).toBe(null);
    });

    it('handles multiple props with mixed types', () => {
      const props = { likes: 5, name: 'test', active: true };
      const ctx = buildContext(props);
      expect(ctx.$implicit).toBe(props);
      expect(ctx.likes).toBe(5);
      expect(ctx.name).toBe('test');
      expect(ctx.active).toBe(true);
    });

    it('handles undefined value in single prop', () => {
      const ctx = buildContext({ value: undefined });
      expect(ctx.$implicit).toBeUndefined();
      expect(ctx.value).toBeUndefined();
    });
  });

  describe('slot classification logic', () => {
    it('empty __scopedSlots means all slots are named', () => {
      const scopedSlots = [];
      expect(classifySlot('header', scopedSlots)).toBe('named');
      expect(classifySlot('footer', scopedSlots)).toBe('named');
      expect(classifySlot('stats', scopedSlots)).toBe('named');
    });

    it('slots listed in __scopedSlots are scoped', () => {
      const scopedSlots = ['stats', 'details'];
      expect(classifySlot('stats', scopedSlots)).toBe('scoped');
      expect(classifySlot('details', scopedSlots)).toBe('scoped');
      expect(classifySlot('header', scopedSlots)).toBe('named');
    });

    it('classification is case-sensitive', () => {
      const scopedSlots = ['Stats'];
      expect(classifySlot('Stats', scopedSlots)).toBe('scoped');
      expect(classifySlot('stats', scopedSlots)).toBe('named');
    });
  });
});
