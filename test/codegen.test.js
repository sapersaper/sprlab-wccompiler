/**
 * Tests for wcCompiler v2 Code Generator.
 *
 * Includes:
 * - Unit tests for transformExpr, transformMethodBody, pathExpr
 * - Integration test for full component generation
 * - Property tests for structural completeness (Property 10),
 *   signal/computed initialization (Property 11),
 *   and connectedCallback setup (Property 12)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateComponent,
  transformExpr,
  transformMethodBody,
  pathExpr,
} from '../lib/codegen.js';

// ── Unit Tests ──────────────────────────────────────────────────────

describe('pathExpr', () => {
  it('returns rootVar when parts is empty', () => {
    expect(pathExpr([], '__root')).toBe('__root');
  });

  it('joins parts with dots after rootVar', () => {
    expect(pathExpr(['childNodes[0]', 'childNodes[1]'], '__root')).toBe(
      '__root.childNodes[0].childNodes[1]'
    );
  });

  it('handles a single part', () => {
    expect(pathExpr(['childNodes[2]'], '__root')).toBe(
      '__root.childNodes[2]'
    );
  });
});

describe('transformExpr', () => {
  it('transforms signal references to this._state.name', () => {
    const result = transformExpr('count + 1', ['count'], []);
    expect(result).toBe('this._state.count + 1');
  });

  it('transforms computed references to this._state.name', () => {
    const result = transformExpr('doubled * 2', [], ['doubled']);
    expect(result).toBe('this._state.doubled * 2');
  });

  it('transforms both signals and computeds in the same expression', () => {
    const result = transformExpr('count + doubled', ['count'], ['doubled']);
    expect(result).toBe('this._state.count + this._state.doubled');
  });

  it('does not transform names followed by .set(', () => {
    const result = transformExpr('count.set(5)', ['count'], []);
    expect(result).toBe('count.set(5)');
  });

  it('does not transform unrelated identifiers', () => {
    const result = transformExpr('x + y', ['count'], []);
    expect(result).toBe('x + y');
  });

  it('handles multiple occurrences of the same signal', () => {
    const result = transformExpr('count + count', ['count'], []);
    expect(result).toBe('this._state.count + this._state.count');
  });
});

describe('transformMethodBody', () => {
  it('transforms signal writes: x.set(value) → this._state.x = value', () => {
    const result = transformMethodBody('count.set(count() + 1)', ['count'], []);
    expect(result).toBe('this._state.count = this._state.count + 1');
  });

  it('transforms signal reads: x() → this._state.x', () => {
    const result = transformMethodBody('console.log(count())', ['count'], []);
    expect(result).toBe('console.log(this._state.count)');
  });

  it('transforms computed reads: x() → this._state.x', () => {
    const result = transformMethodBody('console.log(doubled())', [], ['doubled']);
    expect(result).toBe('console.log(this._state.doubled)');
  });

  it('transforms both signal writes and reads in the same body', () => {
    const result = transformMethodBody(
      'count.set(count() + doubled())',
      ['count'],
      ['doubled']
    );
    expect(result).toBe('this._state.count = this._state.count + this._state.doubled');
  });

  it('leaves unrelated code untouched', () => {
    const result = transformMethodBody('console.log("hello")', ['count'], []);
    expect(result).toBe('console.log("hello")');
  });

  it('transforms model signal writes: varName.set(expr) → this._modelSet_{propName}(expr)', () => {
    const modelVarMap = new Map([['value', 'value']]);
    const result = transformMethodBody('value.set(newVal)', [], [], null, new Set(), null, [], [], modelVarMap);
    expect(result).toBe('this._modelSet_value(newVal)');
  });

  it('transforms model signal reads: varName() → this._m_{propName}()', () => {
    const modelVarMap = new Map([['value', 'value']]);
    const result = transformMethodBody('console.log(value())', [], [], null, new Set(), null, [], [], modelVarMap);
    expect(result).toBe('console.log(this._state.value)');
  });

  it('transforms model signal with different varName and propName', () => {
    const modelVarMap = new Map([['myVar', 'title']]);
    const result = transformMethodBody('myVar.set(myVar() + "!")', [], [], null, new Set(), null, [], [], modelVarMap);
    expect(result).toBe('this._modelSet_title(this._state.title + "!")');
  });

  it('model transforms do not interfere with regular signal transforms', () => {
    const modelVarMap = new Map([['value', 'value']]);
    const result = transformMethodBody('count.set(value())', ['count'], [], null, new Set(), null, [], [], modelVarMap);
    expect(result).toBe('this._state.count = this._state.value');
  });
});

describe('transformExpr — model signals', () => {
  it('transforms model signal reads: varName() → this._m_{propName}()', () => {
    const modelVarMap = new Map([['value', 'value']]);
    const result = transformExpr('value() + 1', [], [], null, new Set(), null, [], [], modelVarMap);
    expect(result).toBe('this._state.value + 1');
  });

  it('transforms bare model var references to this._m_{propName}()', () => {
    const modelVarMap = new Map([['value', 'value']]);
    const result = transformExpr('value + 1', [], [], null, new Set(), null, [], [], modelVarMap);
    expect(result).toBe('this._state.value + 1');
  });

  it('transforms model signal with different varName and propName', () => {
    const modelVarMap = new Map([['myVar', 'title']]);
    const result = transformExpr('myVar()', [], [], null, new Set(), null, [], [], modelVarMap);
    expect(result).toBe('this._state.title');
  });

  it('model transforms do not interfere with regular signal transforms', () => {
    const modelVarMap = new Map([['value', 'value']]);
    const result = transformExpr('count() + value()', ['count'], [], null, new Set(), null, [], [], modelVarMap);
    expect(result).toBe('this._state.count + this._state.value');
  });
});

describe('generateComponent — integration', () => {
  it('generates a complete component with all sections', () => {
    /** @type {import('./types.js').ParseResult} */
    const ir = {
      tagName: 'wcc-counter',
      className: 'WccCounter',
      template: '<div>{{count}}</div>',
      style: '.counter { color: red; }',
      signals: [{ name: 'count', value: '0' }],
      computeds: [{ name: 'doubled', body: 'count() * 2' }],
      effects: [],
      methods: [{ name: 'increment', params: '', body: 'count.set(count() + 1)' }],
      bindings: [
        { varName: '__b0', name: 'count', type: 'signal', path: ['childNodes[0]'] },
      ],
      events: [
        { varName: '__e0', event: 'click', handler: 'increment', path: ['childNodes[0]', 'childNodes[1]'] },
      ],
      processedTemplate: '<div></div>',
    };

    const output = generateComponent(ir);

    // 1. Reactive runtime (Phase 4: no __signal, __computed, or __effect — all in __invalidate)
    expect(output).not.toContain('function __signal(initial)');
    expect(output).not.toContain('function __computed(fn)');
    expect(output).not.toContain('function __effect(fn)');

    // 2. CSS injection
    expect(output).toContain("document.createElement('style')");
    expect(output).toContain('document.head.appendChild');
    expect(output).toContain('wcc-counter .counter');

    // 3. Template
    expect(output).toContain("document.createElement('template')");
    expect(output).toContain('<div></div>');

    // 4. Class
    expect(output).toContain('class WccCounter extends HTMLElement');
    expect(output).toContain('constructor()');
    expect(output).toContain('connectedCallback()');

    // Proxy state init
    expect(output).toContain('this._state = new Proxy(');
    expect(output).toContain('count: 0');

    // Computed init (Phase 2: stored in _state, no __computed runtime)
    expect(output).toContain('this._state.doubled = ');

    // Binding handled by __invalidate
    expect(output).toContain('this.__b0.textContent = this._state.count');

    // Event listener (with AbortController signal)
    expect(output).toContain("this.__e0.addEventListener('click', this._increment.bind(this), { signal: this.__ac.signal })");

    // Method
    expect(output).toContain('_increment()');
    expect(output).toContain('this._state.count = this._state.count + 1');

    // 5. Registration
    expect(output).toContain("customElements.define('wcc-counter', WccCounter)");
  });

  it('generates async methods with async prefix', () => {
    /** @type {import('./types.js').ParseResult} */
    const ir = {
      tagName: 'wcc-async',
      className: 'WccAsync',
      template: '<div></div>',
      style: '',
      signals: [{ name: 'data', value: 'null' }],
      computeds: [],
      effects: [],
      methods: [
        { name: 'fetchData', params: '', body: 'const res = await fetch("/api")\ndata.set(res)', async: true },
        { name: 'syncMethod', params: '', body: 'data.set(null)', async: false },
      ],
      bindings: [],
      events: [],
      processedTemplate: '<div></div>',
    };

    const output = generateComponent(ir);

    // Async method should have async prefix
    expect(output).toContain('async _fetchData()');
    expect(output).toContain('await fetch("/api")');

    // Sync method should NOT have async prefix
    expect(output).toMatch(/\s+_syncMethod\(\)/);
    expect(output).not.toMatch(/async\s+_syncMethod/);
  });

  it('omits CSS injection when style is empty', () => {
    const ir = {
      tagName: 'wcc-hello',
      className: 'WccHello',
      template: '<p>{{msg}}</p>',
      style: '',
      signals: [{ name: 'msg', value: "'hello'" }],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [
        { varName: '__b0', name: 'msg', type: 'signal', path: ['childNodes[0]'] },
      ],
      events: [],
      processedTemplate: '<p></p>',
    };

    const output = generateComponent(ir);

    expect(output).not.toContain("document.createElement('style')");
    expect(output).not.toContain('document.head.appendChild');
    expect(output).toContain('class WccHello extends HTMLElement');
  });
});

// ── Property-Based Tests ────────────────────────────────────────────

// Generators for valid ParseResult IRs

/** Generate a valid kebab-case tag name like 'wcc-xxx' */
const arbTagName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.stringMatching(/^[a-z]{2,6}$/)
  )
  .map(([a, b]) => `${a}-${b}`);

/** Convert kebab-case to PascalCase */
function toClassName(tag) {
  return tag
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/** Generate a valid JS identifier */
const arbIdentifier = fc
  .stringMatching(/^[a-z][a-z]{1,7}$/)
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

/** Generate a signal */
const arbSignal = fc.record({
  name: arbIdentifier,
  value: fc.constantFrom('0', '1', "''", "'hello'", '[]', 'null', 'true', 'false'),
});

/** Generate a computed */
const arbComputed = fc.record({
  name: arbIdentifier,
  body: fc.constant('1 + 1'),
});

/** Generate an effect */
const arbEffect = fc.record({
  body: fc.constant("console.log('effect')"),
});

/** Generate a method */
const arbMethod = fc.record({
  name: arbIdentifier,
  params: fc.constant(''),
  body: fc.constant("console.log('method')"),
});

/** Generate a binding */
const arbBinding = fc.record({
  varName: fc.nat({ max: 99 }).map(n => `__b${n}`),
  name: arbIdentifier,
  type: fc.constantFrom('signal', 'computed', 'method'),
  path: fc.array(fc.nat({ max: 5 }).map(n => `childNodes[${n}]`), { minLength: 1, maxLength: 3 }),
});

/** Generate an event binding */
const arbEvent = fc.record({
  varName: fc.nat({ max: 99 }).map(n => `__e${n}`),
  event: fc.constantFrom('click', 'input', 'change', 'submit', 'keydown'),
  handler: arbIdentifier,
  path: fc.array(fc.nat({ max: 5 }).map(n => `childNodes[${n}]`), { minLength: 1, maxLength: 3 }),
});

/**
 * Generate a valid ParseResult IR.
 * Ensures unique signal/computed/method names to avoid collisions.
 */
const arbParseResult = fc
  .record({
    tagName: arbTagName,
    style: fc.constantFrom('', '.cls { color: red; }', 'p { margin: 0; }'),
    signals: fc.array(arbSignal, { minLength: 0, maxLength: 3 }),
    computeds: fc.array(arbComputed, { minLength: 0, maxLength: 2 }),
    effects: fc.constant([]),
    methods: fc.array(arbMethod, { minLength: 0, maxLength: 2 }),
    bindings: fc.array(arbBinding, { minLength: 0, maxLength: 3 }),
    events: fc.array(arbEvent, { minLength: 0, maxLength: 2 }),
  })
  .map(r => {
    // Deduplicate names
    const usedNames = new Set();
    const dedup = (arr, key) =>
      arr.filter(item => {
        if (usedNames.has(item[key])) return false;
        usedNames.add(item[key]);
        return true;
      });

    const signals = dedup(r.signals, 'name');
    const computeds = dedup(r.computeds, 'name');
    const methods = dedup(r.methods, 'name');

    return {
      tagName: r.tagName,
      className: toClassName(r.tagName),
      template: '<div>test</div>',
      style: r.style,
      signals,
      computeds,
      effects: [],
      methods,
      bindings: r.bindings,
      events: r.events,
      processedTemplate: '<div>test</div>',
    };
  });

describe('Property 10: Codegen Structural Completeness', () => {
  it('generated output contains reactive runtime, class, connectedCallback, and customElements.define', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);

        // Reactive runtime (Phase 4): no __signal, __computed, or __effect — all in __invalidate
        expect(output).not.toContain('function __signal(initial)');
        expect(output).not.toContain('function __computed(fn)');
        expect(output).not.toContain('function __effect(fn)');

        // Class definition
        expect(output).toContain(`class ${ir.className} extends HTMLElement`);

        // connectedCallback
        expect(output).toContain('connectedCallback()');

        // customElements.define
        expect(output).toContain(`customElements.define('${ir.tagName}', ${ir.className})`);

        // CSS injection when styles provided
        if (ir.style) {
          expect(output).toContain("document.createElement('style')");
          expect(output).toContain('document.head.appendChild');
        }
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });
});

describe('Property 11: Codegen Signal/Computed Initialization', () => {
  it('constructor contains Proxy state for each signal and _state assignment for each computed', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);

        // Each signal should have its name in the Proxy state object
        if (ir.signals.length > 0) {
          expect(output).toContain('this._state = new Proxy(');
          for (const s of ir.signals) {
            expect(output).toContain(`${s.name}: ${s.value}`);
          }
        }

        // Phase 2: Each computed is assigned directly to this._state.name (not __computed)
        for (const c of ir.computeds) {
          expect(output).toContain(`this._state.${c.name} = `);
        }
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });
});

describe('Property 12: Codegen ConnectedCallback Setup', () => {
  it('connectedCallback contains __invalidate or __effect for bindings and addEventListener for each event', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);

        // Extract connectedCallback section
        const ccStart = output.indexOf('connectedCallback()');
        expect(ccStart).toBeGreaterThan(-1);

        const afterCC = output.slice(ccStart);

        // Simple bindings are handled by __invalidate, not __effect
        // Only check if there are signals that match the binding names
        const hasReactiveBindings = ir.bindings.some(b => 
          b.type === 'signal' && ir.signals.some(s => s.name === b.name)
        );
        if (hasReactiveBindings) {
          const hasInvalidate = output.includes('__invalidate(');
          expect(hasInvalidate).toBe(true);
        }

        // Phase 4: User effects are no longer generated (removed)

        // Each event should produce an addEventListener
        for (const e of ir.events) {
          expect(afterCC).toContain(`addEventListener('${e.event}'`);
        }
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });
});

describe('Property 5: Guarded self-registration', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any compiled component, the output SHALL end with a guarded
   * `customElements.define` call using the component's own tag name string literal,
   * in the form: if (!customElements.get('tag-name')) customElements.define('tag-name', ClassName);
   */
  it('compiled output ends with guarded customElements.define using the component own tag name', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);
        const expectedDefine = `if (!customElements.get('${ir.tagName}')) customElements.define('${ir.tagName}', ${ir.className});`;
        const expectedExport = `export default ${ir.className};`;

        // The output must contain the guarded self-registration
        expect(output).toContain(expectedDefine);

        // The output must end with the export default (after the guarded define)
        const lines = output.split('\n').filter(l => l.trim() !== '');
        const lastLine = lines[lines.length - 1].trim();
        const secondToLastLine = lines[lines.length - 2].trim();
        expect(secondToLastLine).toBe(expectedDefine);
        expect(lastLine).toBe(expectedExport);
      }),
      { numRuns: 20 }
    );
  });
});

// ── Property 9: Unused imports preserved ────────────────────────────

/** Generate a valid PascalCase identifier for a child component */
const arbPascalIdent = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.stringMatching(/^[a-z][a-zA-Z]{2,8}$/)
  )
  .map(([first, rest]) => first + rest);

/** Generate a valid relative .js import path */
const arbImportPath = fc
  .tuple(
    fc.constantFrom('./', '../', './nested/', '../shared/'),
    fc.stringMatching(/^[a-z][a-z0-9-]{1,10}$/)
  )
  .map(([prefix, name]) => `${prefix}${name}.js`);

/** Generate a named (non-side-effect) child import */
const arbNamedChildImport = fc
  .tuple(arbPascalIdent, arbImportPath)
  .map(([identifier, importPath]) => ({
    identifier,
    importPath,
    sideEffect: false,
    tag: identifier.replace(/([A-Z])/g, (m, c, i) => (i === 0 ? c.toLowerCase() : '-' + c.toLowerCase())),
  }));

describe('Feature: explicit-component-imports, Property 9: Unused imports preserved', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any named .wcc import in the script block that is never referenced as a
   * PascalCase tag in the template, the compiled output SHALL still contain the
   * named import statement and guarded registration call.
   */
  it('named child imports appear in compiled output even when not referenced in template', () => {
    fc.assert(
      fc.property(
        arbParseResult,
        fc.array(arbNamedChildImport, { minLength: 1, maxLength: 3 }),
        (ir, childImports) => {
          // Deduplicate child imports by identifier
          const seen = new Set();
          const uniqueImports = childImports.filter(ci => {
            if (seen.has(ci.identifier)) return false;
            seen.add(ci.identifier);
            return true;
          });

          // Add childImports to the IR — template does NOT reference these components
          const irWithImports = {
            ...ir,
            childImports: uniqueImports,
            processedTemplate: '<div>no child components used here</div>',
          };

          const output = generateComponent(irWithImports);

          // Each named import must appear in the output
          for (const ci of uniqueImports) {
            expect(output).toContain(`import ${ci.identifier} from '${ci.importPath}';`);
            expect(output).toContain(
              `if (!customElements.get(${ci.identifier}.__meta.tag)) customElements.define(${ci.identifier}.__meta.tag, ${ci.identifier});`
            );
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});


// ── BUG-0008: Constant initialization transformation and reactive effects ───

describe('BUG-0008: transformMethodBody transforms constant arrow function bodies', () => {
  it('transforms signal references inside arrow function body', () => {
    const result = transformMethodBody(
      '() => items().filter(item => item.active).length',
      ['items'], []
    );
    expect(result).toBe('() => this._state.items.filter(item => item.active).length');
  });

  it('transforms signal references in simple arrow function', () => {
    const result = transformMethodBody(
      '() => items().length',
      ['items'], []
    );
    expect(result).toBe('() => this._state.items.length');
  });

  it('transforms multiple signal references in arrow function', () => {
    const result = transformMethodBody(
      '() => items().length + count()',
      ['items', 'count'], []
    );
    expect(result).toBe('() => this._state.items.length + this._state.count');
  });

  it('transforms computed references in arrow function', () => {
    const result = transformMethodBody(
      '() => doubled() * 2',
      [], ['doubled']
    );
    expect(result).toBe('() => this._state.doubled * 2');
  });

  it('does not transform the arrow function parameter names', () => {
    const result = transformMethodBody(
      '() => items().filter(item => item.active)',
      ['items'], []
    );
    // 'item' should NOT be transformed (it's a parameter, not a signal)
    expect(result).toContain('item => item.active');
    // 'items' should be transformed
    expect(result).toContain('this._state.items');
  });
});

describe('BUG-0008: generateComponent handles function constants with reactive effects', () => {
  it('generates constant initialization for function-type constants (Phase 4: no __effect)', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<p>{{totalItems}}</p>',
      style: '',
      signals: [{ name: 'items', value: '[]' }],
      computeds: [],
      effects: [],
      methods: [],
      constantVars: [{ name: 'totalItems', value: '() => items().length' }],
      bindings: [
        { varName: '__text_totalItems_0', name: 'totalItems', type: 'constant', path: ['childNodes[0]'] },
      ],
      events: [],
      processedTemplate: '<p></p>',
    };

    const output = generateComponent(ir);

    // Should contain the transformed constant initialization
    expect(output).toContain('this._const_totalItems = () => this._state.items.length');

    // Phase 4: Function-type constant bindings are no longer wrapped in __effect
    expect(output).not.toContain('__effect(() => {');
  });

  it('generates static assignment for value-type constants (no effect)', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<p>{{MAX_SIZE}}</p>',
      style: '',
      signals: [],
      computeds: [],
      effects: [],
      methods: [],
      constantVars: [{ name: 'MAX_SIZE', value: '100' }],
      bindings: [
        { varName: '__text_MAX_SIZE_0', name: 'MAX_SIZE', type: 'constant', path: ['childNodes[0]'] },
      ],
      events: [],
      processedTemplate: '<p></p>',
    };

    const output = generateComponent(ir);

    // Should contain the constant initialization (no transformation needed for literal)
    expect(output).toContain('this._const_MAX_SIZE = 100');

    // Should set textContent directly without __effect
    expect(output).toContain("this.__text_MAX_SIZE_0.textContent = this._const_MAX_SIZE ?? ''");

    // The static constant binding should NOT be inside an __effect
    // Find the line and check it's not preceded by __effect
    const lines = output.split('\n');
    const bindingLine = lines.findIndex(l => l.includes('__text_MAX_SIZE_0.textContent'));
    expect(bindingLine).toBeGreaterThan(-1);
    // The previous line should NOT be __effect
    expect(lines[bindingLine - 1]).not.toContain('__effect');
  });

  it('transforms constant body that references other constants', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<p>{{label}}</p>',
      style: '',
      signals: [{ name: 'count', value: '0' }],
      computeds: [],
      effects: [],
      methods: [],
      constantVars: [
        { name: 'prefix', value: "'Count: '" },
        { name: 'label', value: '() => prefix + count()' },
      ],
      bindings: [
        { varName: '__text_label_0', name: 'label', type: 'constant', path: ['childNodes[0]'] },
      ],
      events: [],
      processedTemplate: '<p></p>',
    };

    const output = generateComponent(ir);

    // prefix should be transformed to this._const_prefix
    expect(output).toContain("this._const_prefix = 'Count: '");
    // label should reference this._const_prefix and this._state.count
    expect(output).toContain('this._const_label = () => this._const_prefix + this._state.count');
  });
});

describe('BUG-0008: transformExpr handles constant names correctly', () => {
  it('transforms bare constant reference to this._const_name', () => {
    const result = transformExpr('totalItems', [], [], null, new Set(), null, ['totalItems']);
    expect(result).toBe('this._const_totalItems');
  });

  it('does not transform constant name followed by ()', () => {
    // When a constant is called as a function, the negative lookahead (?!\() prevents matching
    const result = transformExpr('totalItems()', [], [], null, new Set(), null, ['totalItems']);
    // The constant regex won't match because of (?!\(), so it stays as-is
    expect(result).toBe('totalItems()');
  });

  it('transforms constant in complex expression', () => {
    const result = transformExpr('MAX_SIZE + 1', [], [], null, new Set(), null, ['MAX_SIZE']);
    expect(result).toBe('this._const_MAX_SIZE + 1');
  });
});
