/**
 * Unit tests for slot-template-<name> attribute detection in generated code.
 *
 * The generated connectedCallback slot resolution loop detects `slot-template-<name>`
 * attributes on child elements and stores their values as scoped slot template strings.
 *
 * Priority: element-based (`slot="name"`) wins over attribute-based (`slot-template-name`).
 * Attributes are removed after reading (cleanup).
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 3.5
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
    processedTemplate: '<div><span data-slot="item"></span></div>',
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
    slots: [{
      varName: '__s0',
      name: 'item',
      path: ['childNodes[0]', 'childNodes[0]'],
      defaultContent: '',
      slotProps: [{ prop: 'item', source: 'currentItem' }],
    }],
    refs: [],
    refBindings: [],
    ...overrides,
  };
}

// ── Unit Tests: slot-template-<name> attribute detection ────────────

describe('codegen slot-template-<name> attribute detection', () => {

  describe('basic slot-template-<name> attribute detection (Req 6.1)', () => {
    it('generated code checks for slot-template- prefix on element attributes', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The generated code should iterate attributes and check for slot-template- prefix
      expect(output).toContain("attr.name.startsWith('slot-template-')");
    });

    it('generated code extracts slot name by slicing off the prefix', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The generated code should extract the slot name from the attribute name
      expect(output).toContain("attr.name.slice('slot-template-'.length)");
    });

    it('generated code stores attribute value as template content (Req 6.2)', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The generated code should store { content: attr.value, propsExpr: '' }
      expect(output).toContain('content: attr.value');
      expect(output).toContain("propsExpr: ''");
    });
  });

  describe('priority: slot="name" element wins over slot-template-name (Req 6.3, 6.5)', () => {
    it('generated code only stores slot-template if slot not already in __slotMap', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The generated code should check if (!__slotMap[slotName]) before storing
      expect(output).toContain('if (!__slotMap[slotName])');
    });

    it('slot="name" element is processed before slot-template-name check', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The slot="name" check should appear before the slot-template- check
      const slotAttrIndex = output.indexOf("child.getAttribute('slot')");
      const slotTemplateIndex = output.indexOf("attr.name.startsWith('slot-template-')");

      expect(slotAttrIndex).toBeGreaterThan(-1);
      expect(slotTemplateIndex).toBeGreaterThan(-1);
      expect(slotAttrIndex).toBeLessThan(slotTemplateIndex);
    });
  });

  describe('attribute removal after reading (Req 6.4)', () => {
    it('generated code removes the slot-template-* attribute after reading', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The generated code should call child.removeAttribute(attr.name)
      expect(output).toContain('child.removeAttribute(attr.name)');
    });

    it('attribute removal happens after storing the value', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // removeAttribute should come after the __slotMap assignment
      const storeIndex = output.indexOf("__slotMap[slotName] = { content: attr.value");
      const removeIndex = output.indexOf("child.removeAttribute(attr.name)");

      expect(storeIndex).toBeGreaterThan(-1);
      expect(removeIndex).toBeGreaterThan(-1);
      expect(storeIndex).toBeLessThan(removeIndex);
    });
  });

  describe('multiple slot-template-* on same element (Req 3.5)', () => {
    it('generated code iterates all attributes with Array.from(child.attributes)', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The generated code should iterate all attributes using Array.from
      expect(output).toContain('Array.from(child.attributes)');
    });

    it('generated code uses a for loop to handle multiple slot-template-* attributes', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The generated code should use a for...of loop over attributes
      expect(output).toContain('for (const attr of Array.from(child.attributes))');
    });

    it('each slot-template-* attribute is stored independently by name', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // The slot name is derived from each attribute independently
      // slotName = attr.name.slice('slot-template-'.length) — dynamic per attribute
      const sliceCount = (output.match(/attr\.name\.slice\('slot-template-'\.length\)/g) || []).length;
      expect(sliceCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('slot-template detection only runs when component has slots', () => {
    it('no slot-template detection code when component has no slots', () => {
      const pr = makeParseResult({
        slots: [],
      });

      const output = generateComponent(pr);

      // Without slots, the entire slot resolution loop is skipped
      expect(output).not.toContain("slot-template-");
    });

    it('slot-template detection code is present when component has scoped slots', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // With slots, the slot-template detection code should be present
      expect(output).toContain("slot-template-");
    });
  });

  describe('slot-template element is still pushed to __defaultSlotNodes', () => {
    it('element with slot-template-* is added to default slot nodes', () => {
      const pr = makeParseResult({
        signals: [{ name: 'currentItem', value: "'test'" }],
      });

      const output = generateComponent(pr);

      // After processing slot-template-* attributes, the element goes to __defaultSlotNodes
      // The __defaultSlotNodes.push(child) should be in the same branch as slot-template- check
      const slotTemplateBlock = output.indexOf("attr.name.startsWith('slot-template-')");
      const defaultPush = output.indexOf('__defaultSlotNodes.push(child)', slotTemplateBlock);

      expect(slotTemplateBlock).toBeGreaterThan(-1);
      expect(defaultPush).toBeGreaterThan(-1);
    });
  });
});
