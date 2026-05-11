/**
 * Unit tests for the combined scoped slot interpolation regex.
 *
 * The generated regex matches both {{prop}} and {%prop%} syntaxes:
 *   /(?:\{\{|\{%)\s*propName(\(\))?\s*(?:\}\}|%\})/g
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 1.7
 */

import { describe, it, expect } from 'vitest';
import { generateComponent } from './codegen.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeParseResult(overrides = {}) {
  return {
    tagName: 'wcc-test',
    className: 'WccTest',
    template: '<div>Hello</div>',
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div>Hello</div>',
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
    attrBindings: [],
    slots: [],
    refs: [],
    refBindings: [],
    ...overrides,
  };
}

/**
 * Build the same regex the generated code uses for a given prop name.
 * This mirrors the pattern emitted by codegen.js:
 *   new RegExp('(?:\\{\\{|\\{%)\\s*' + k + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g')
 */
function buildSlotPropRegex(propName) {
  return new RegExp('(?:\\{\\{|\\{%)\\s*' + propName + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g');
}

/**
 * Simulate the runtime replacement loop for a template string with given props.
 */
function replaceSlotProps(template, props) {
  let html = template;
  for (const [k, v] of Object.entries(props)) {
    html = html.replace(buildSlotPropRegex(k), v ?? '');
  }
  return html;
}

// ── Unit Tests: Combined Regex Behavior ─────────────────────────────

describe('codegen scoped slot regex — combined {{prop}} and {%prop%} syntax', () => {

  describe('backward compatibility — {{prop}} syntax', () => {
    it('replaces {{prop}} with the prop value', () => {
      const result = replaceSlotProps('<span>{{name}}</span>', { name: 'Alice' });
      expect(result).toBe('<span>Alice</span>');
    });

    it('replaces {{ prop }} with whitespace inside delimiters', () => {
      const result = replaceSlotProps('<span>{{ name }}</span>', { name: 'Bob' });
      expect(result).toBe('<span>Bob</span>');
    });

    it('replaces {{prop()}} with parentheses', () => {
      const result = replaceSlotProps('<span>{{name()}}</span>', { name: 'Charlie' });
      expect(result).toBe('<span>Charlie</span>');
    });

    it('replaces multiple occurrences of {{prop}}', () => {
      const result = replaceSlotProps('<p>{{item}} and {{item}}</p>', { item: 'X' });
      expect(result).toBe('<p>X and X</p>');
    });
  });

  describe('escape syntax — {%prop%} syntax', () => {
    it('replaces {%prop%} with the prop value', () => {
      const result = replaceSlotProps('<span>{%name%}</span>', { name: 'Alice' });
      expect(result).toBe('<span>Alice</span>');
    });

    it('replaces {% prop %} with whitespace inside delimiters', () => {
      const result = replaceSlotProps('<span>{% name %}</span>', { name: 'Bob' });
      expect(result).toBe('<span>Bob</span>');
    });

    it('replaces {%prop()%} with parentheses', () => {
      const result = replaceSlotProps('<span>{%name()%}</span>', { name: 'Charlie' });
      expect(result).toBe('<span>Charlie</span>');
    });

    it('replaces multiple occurrences of {%prop%}', () => {
      const result = replaceSlotProps('<p>{%item%} and {%item%}</p>', { item: 'Y' });
      expect(result).toBe('<p>Y and Y</p>');
    });
  });

  describe('mixed syntax — {{prop1}} and {%prop2%} in same template', () => {
    it('replaces both {{prop1}} and {%prop2%} in the same template', () => {
      const result = replaceSlotProps(
        '<div>{{name}} is {%age%} years old</div>',
        { name: 'Alice', age: '30' }
      );
      expect(result).toBe('<div>Alice is 30 years old</div>');
    });

    it('replaces same prop in both syntaxes within one template', () => {
      const result = replaceSlotProps(
        '<p>{{item}} or {%item%}</p>',
        { item: 'value' }
      );
      expect(result).toBe('<p>value or value</p>');
    });

    it('handles multiple props with mixed syntaxes', () => {
      const result = replaceSlotProps(
        '<li>{{firstName}} {% lastName %} - {%age%}</li>',
        { firstName: 'John', lastName: 'Doe', age: '25' }
      );
      expect(result).toBe('<li>John Doe - 25</li>');
    });
  });

  describe('null/undefined values — replaced with empty string', () => {
    it('replaces {{prop}} with empty string when value is null', () => {
      const result = replaceSlotProps('<span>{{name}}</span>', { name: null });
      expect(result).toBe('<span></span>');
    });

    it('replaces {%prop%} with empty string when value is null', () => {
      const result = replaceSlotProps('<span>{%name%}</span>', { name: null });
      expect(result).toBe('<span></span>');
    });

    it('replaces {{prop}} with empty string when value is undefined', () => {
      const result = replaceSlotProps('<span>{{name}}</span>', { name: undefined });
      expect(result).toBe('<span></span>');
    });

    it('replaces {%prop%} with empty string when value is undefined', () => {
      const result = replaceSlotProps('<span>{%name%}</span>', { name: undefined });
      expect(result).toBe('<span></span>');
    });
  });

  describe('codegen output — regex appears in generated code', () => {
    it('generated code contains the combined regex pattern', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
        processedTemplate: '<div><span data-slot="data"></span></div>',
        slots: [{
          varName: '__s0',
          name: 'data',
          path: ['childNodes[0]', 'childNodes[0]'],
          defaultContent: '',
          slotProps: [{ prop: 'item', source: 'currentItem' }],
        }],
      });

      const output = generateComponent(pr);

      // The generated code should contain the combined regex with both {{}} and {%%} support
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");
      expect(output).toContain("(?:\\\\}\\\\}|%\\\\})");
    });

    it('generated code uses nullish coalescing for empty string fallback', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
        processedTemplate: '<div><span data-slot="data"></span></div>',
        slots: [{
          varName: '__s0',
          name: 'data',
          path: ['childNodes[0]', 'childNodes[0]'],
          defaultContent: '',
          slotProps: [{ prop: 'item', source: 'currentItem' }],
        }],
      });

      const output = generateComponent(pr);

      // v ?? '' ensures null/undefined become empty string
      expect(output).toContain("v ?? ''");
    });
  });
});
