/**
 * Tests for wcCompiler v2 Code Generator — defineProps feature.
 *
 * Includes:
 * - Unit tests for observedAttributes, prop signals, attributeChangedCallback,
 *   getters/setters, props.x transformation, prop binding effects
 * - Property tests for observedAttributes consistency (Property 3),
 *   prop signal initialization (Property 4), and props access transformation (Property 5)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateComponent,
  transformExpr,
  transformMethodBody,
} from './codegen.js';
import { camelToKebab } from './parser.js';

// ── Helper: build a minimal ParseResult with props ──────────────────

function makeIR(overrides = {}) {
  return {
    tagName: 'my-comp',
    className: 'MyComp',
    template: '<div>hello</div>',
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div>hello</div>',
    propDefs: [],
    propsObjectName: null,
    ...overrides,
  };
}

// ── Unit Tests ──────────────────────────────────────────────────────

describe('generateComponent — observedAttributes', () => {
  it('generates static observedAttributes with correct attribute names', () => {
    const ir = makeIR({
      propDefs: [
        { name: 'label', default: "'Click'", attrName: 'label' },
        { name: 'itemCount', default: '0', attrName: 'item-count' },
      ],
      propsObjectName: 'props',
    });

    const output = generateComponent(ir);
    expect(output).toContain("static get observedAttributes() { return ['label', 'item-count']; }");
  });

  it('does not generate observedAttributes when no props', () => {
    const ir = makeIR();
    const output = generateComponent(ir);
    expect(output).not.toContain('observedAttributes');
  });
});

describe('generateComponent — prop signal initialization', () => {
  it('generates __signal for each prop with correct default', () => {
    const ir = makeIR({
      propDefs: [
        { name: 'label', default: "'Click'", attrName: 'label' },
        { name: 'count', default: '0', attrName: 'count' },
      ],
      propsObjectName: 'props',
    });

    const output = generateComponent(ir);
    expect(output).toContain("this._s_label = __signal('Click')");
    expect(output).toContain('this._s_count = __signal(0)');
  });

  it('generates __signal(undefined) for props without defaults', () => {
    const ir = makeIR({
      propDefs: [
        { name: 'label', default: 'undefined', attrName: 'label' },
      ],
      propsObjectName: 'props',
    });

    const output = generateComponent(ir);
    expect(output).toContain('this._s_label = __signal(undefined)');
  });

  it('places prop signals before user signals', () => {
    const ir = makeIR({
      propDefs: [{ name: 'label', default: "'hi'", attrName: 'label' }],
      propsObjectName: 'props',
      signals: [{ name: 'count', value: '0' }],
    });

    const output = generateComponent(ir);
    const propIdx = output.indexOf("this._s_label = __signal('hi')");
    const sigIdx = output.indexOf('this._count = __signal(0)');
    expect(propIdx).toBeLessThan(sigIdx);
  });
});

describe('generateComponent — attributeChangedCallback', () => {
  it('generates number coercion for numeric defaults', () => {
    const ir = makeIR({
      propDefs: [{ name: 'count', default: '0', attrName: 'count' }],
      propsObjectName: 'props',
    });

    const output = generateComponent(ir);
    expect(output).toContain("if (name === 'count') this._s_count(newVal != null ? Number(newVal) : 0)");
  });

  it('generates boolean coercion for boolean defaults', () => {
    const ir = makeIR({
      propDefs: [{ name: 'disabled', default: 'false', attrName: 'disabled' }],
      propsObjectName: 'props',
    });

    const output = generateComponent(ir);
    expect(output).toContain("if (name === 'disabled') this._s_disabled(newVal != null)");
  });

  it('generates string passthrough for string defaults', () => {
    const ir = makeIR({
      propDefs: [{ name: 'label', default: "'Click'", attrName: 'label' }],
      propsObjectName: 'props',
    });

    const output = generateComponent(ir);
    expect(output).toContain("if (name === 'label') this._s_label(newVal ?? 'Click')");
  });

  it('generates passthrough for undefined defaults', () => {
    const ir = makeIR({
      propDefs: [{ name: 'value', default: 'undefined', attrName: 'value' }],
      propsObjectName: 'props',
    });

    const output = generateComponent(ir);
    expect(output).toContain("if (name === 'value') this._s_value(newVal)");
  });

  it('does not generate attributeChangedCallback when no props', () => {
    const ir = makeIR();
    const output = generateComponent(ir);
    expect(output).not.toContain('attributeChangedCallback');
  });
});

describe('generateComponent — getters and setters', () => {
  it('generates getter and setter for each prop', () => {
    const ir = makeIR({
      propDefs: [
        { name: 'label', default: "'Click'", attrName: 'label' },
        { name: 'itemCount', default: '0', attrName: 'item-count' },
      ],
      propsObjectName: 'props',
    });

    const output = generateComponent(ir);
    expect(output).toContain('get label() { return this._s_label(); }');
    expect(output).toContain("set label(val) { this._s_label(val); this.setAttribute('label', String(val)); }");
    expect(output).toContain('get itemCount() { return this._s_itemCount(); }');
    expect(output).toContain("set itemCount(val) { this._s_itemCount(val); this.setAttribute('item-count', String(val)); }");
  });
});

describe('generateComponent — prop binding effects', () => {
  it('generates effect with _s_ prefix for prop bindings', () => {
    const ir = makeIR({
      propDefs: [{ name: 'label', default: "'Click'", attrName: 'label' }],
      propsObjectName: 'props',
      bindings: [
        { varName: '__b0', name: 'label', type: 'prop', path: ['childNodes[0]'] },
      ],
    });

    const output = generateComponent(ir);
    expect(output).toContain("this.__b0.textContent = this._s_label() ?? ''");
  });
});

describe('transformExpr — props.x transformation', () => {
  it('transforms props.propName to this._s_propName()', () => {
    const result = transformExpr('props.label + " world"', [], [], 'props', new Set(['label']));
    expect(result).toBe('this._s_label() + " world"');
  });

  it('does not transform props.unknownName', () => {
    const result = transformExpr('props.unknown', [], [], 'props', new Set(['label']));
    expect(result).toBe('props.unknown');
  });

  it('excludes propsObjectName from signal transforms', () => {
    const result = transformExpr('props + 1', ['props'], [], 'props', new Set());
    expect(result).toBe('props + 1');
  });
});

describe('transformMethodBody — props.x transformation', () => {
  it('transforms props.propName in method bodies', () => {
    const result = transformMethodBody(
      'console.log(props.label)',
      [],
      [],
      'props',
      new Set(['label'])
    );
    expect(result).toBe('console.log(this._s_label())');
  });

  it('excludes propsObjectName from signal transforms in method bodies', () => {
    const result = transformMethodBody(
      'props.set(1)',
      ['props'],
      [],
      'props',
      new Set()
    );
    // props should NOT be transformed to this._props(1)
    expect(result).toBe('props.set(1)');
  });
});

describe('generateComponent — props.x in method bodies', () => {
  it('transforms props.label to this._s_label() in generated methods', () => {
    const ir = makeIR({
      propDefs: [{ name: 'label', default: "'Click'", attrName: 'label' }],
      propsObjectName: 'props',
      methods: [{ name: 'greet', params: '', body: 'console.log(props.label)' }],
    });

    const output = generateComponent(ir);
    expect(output).toContain('console.log(this._s_label())');
  });
});

// ── Property-Based Tests ────────────────────────────────────────────

/** Generate a valid JS identifier for prop names */
const arbPropName = fc
  .stringMatching(/^[a-z][a-zA-Z]{1,8}$/)
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break', 'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch', 'export', 'import', 'default', 'signal', 'computed', 'effect', 'props'].includes(s));

/** Generate a default value */
const arbDefault = fc.constantFrom('0', '1', '42', "'hello'", "'world'", 'true', 'false', 'undefined');

/**
 * **Validates: Requirements 5.1**
 *
 * Property 3: Codegen observedAttributes Consistency
 *
 * For any ParseResult with N propDefs, the generated output SHALL contain
 * observedAttributes returning exactly N kebab-case attribute names.
 *
 * Feature: define-props, Property 3: Codegen observedAttributes Consistency
 */
describe('Feature: define-props, Property 3: Codegen observedAttributes Consistency', () => {
  it('observedAttributes contains exactly N kebab-case names matching propDefs', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbPropName, { minLength: 1, maxLength: 10 }).chain(names =>
          fc.tuple(
            fc.constant(names),
            fc.array(arbDefault, { minLength: names.length, maxLength: names.length })
          )
        ),
        ([propNames, defaults]) => {
          const propDefs = propNames.map((name, i) => ({
            name,
            default: defaults[i],
            attrName: camelToKebab(name),
          }));

          const ir = makeIR({ propDefs, propsObjectName: 'props' });
          const output = generateComponent(ir);

          // Extract the observedAttributes array from output
          const match = output.match(/static get observedAttributes\(\) \{ return \[([^\]]*)\]; \}/);
          expect(match).not.toBeNull();

          const attrStr = match[1];
          const attrs = attrStr.split(',').map(s => s.trim().replace(/'/g, ''));

          expect(attrs).toHaveLength(propNames.length);
          for (let i = 0; i < propNames.length; i++) {
            expect(attrs[i]).toBe(camelToKebab(propNames[i]));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 5.2**
 *
 * Property 4: Codegen Prop Signal Initialization
 *
 * For any ParseResult with propDefs, the constructor SHALL contain
 * __signal(default) for each prop.
 *
 * Feature: define-props, Property 4: Codegen Prop Signal Initialization
 */
describe('Feature: define-props, Property 4: Codegen Prop Signal Initialization', () => {
  it('constructor contains __signal(default) for each prop', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbPropName, { minLength: 1, maxLength: 10 }).chain(names =>
          fc.tuple(
            fc.constant(names),
            fc.array(arbDefault, { minLength: names.length, maxLength: names.length })
          )
        ),
        ([propNames, defaults]) => {
          const propDefs = propNames.map((name, i) => ({
            name,
            default: defaults[i],
            attrName: camelToKebab(name),
          }));

          const ir = makeIR({ propDefs, propsObjectName: 'props' });
          const output = generateComponent(ir);

          for (let i = 0; i < propNames.length; i++) {
            expect(output).toContain(`this._s_${propNames[i]} = __signal(${defaults[i]})`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 *
 * Property 5: Props Access Transformation Correctness
 *
 * For any method body containing props.propName references, the transformation
 * SHALL replace every props.propName with this._s_propName() and leave
 * non-prop references unchanged.
 *
 * Feature: define-props, Property 5: Props Access Transformation Correctness
 */
describe('Feature: define-props, Property 5: Props Access Transformation Correctness', () => {
  it('transforms props.propName to this._s_propName() and leaves non-props unchanged', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbPropName, { minLength: 1, maxLength: 5 }),
        (propNames) => {
          const propNameSet = new Set(propNames);

          // Build a method body with props.propName references
          const body = propNames.map(n => `props.${n}`).join(' + ');
          const result = transformMethodBody(body, [], [], 'props', propNameSet);

          // Every props.propName should be transformed
          for (const name of propNames) {
            expect(result).toContain(`this._s_${name}()`);
            expect(result).not.toContain(`props.${name}`);
          }

          // Test with an unknown prop name
          const bodyWithUnknown = 'props.unknownProp';
          const resultUnknown = transformMethodBody(bodyWithUnknown, [], [], 'props', propNameSet);
          expect(resultUnknown).toBe('props.unknownProp');
        }
      ),
      { numRuns: 100 }
    );
  });
});
