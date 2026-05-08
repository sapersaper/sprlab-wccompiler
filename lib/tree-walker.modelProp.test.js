/**
 * Unit tests for model:propName detection in tree-walker.
 *
 * Tests the detection of model:propName="signalName" attributes on custom elements,
 * validation that the target is a custom element, ModelPropBinding generation,
 * and attribute removal from the DOM.
 *
 * Requirements: 5.1, 5.2, 5.3, 9.4, 10.1, 10.3
 */

import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { walkTree } from './tree-walker.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  return document.getElementById('__root');
}

// ── model:propName detection ────────────────────────────────────────

describe('walkTree — model:propName detection', () => {
  it('detects model:propName on a custom element and produces ModelPropBinding', () => {
    const html = '<my-child model:value="searchText"></my-child>';
    const root = makeRoot(html);
    const { modelPropBindings } = walkTree(root, new Set(['searchText']), new Set());

    expect(modelPropBindings).toHaveLength(1);
    expect(modelPropBindings[0]).toMatchObject({
      varName: '__modelProp0',
      propName: 'value',
      signal: 'searchText',
      path: ['childNodes[0]'],
    });
  });

  it('generates sequential varNames for multiple model:propName bindings', () => {
    const html = `
      <my-input model:value="text"></my-input>
      <my-counter model:count="num"></my-counter>
    `;
    const root = makeRoot(html);
    const { modelPropBindings } = walkTree(root, new Set(['text', 'num']), new Set());

    expect(modelPropBindings).toHaveLength(2);
    expect(modelPropBindings[0].varName).toBe('__modelProp0');
    expect(modelPropBindings[1].varName).toBe('__modelProp1');
  });

  it('extracts propName correctly (part after the colon)', () => {
    const html = '<my-widget model:selectedItem="item"></my-widget>';
    const root = makeRoot(html);
    const { modelPropBindings } = walkTree(root, new Set(['item']), new Set());

    expect(modelPropBindings[0].propName).toBe('selectedItem');
  });

  it('extracts signal name from attribute value', () => {
    const html = '<my-comp model:title="pageTitle"></my-comp>';
    const root = makeRoot(html);
    const { modelPropBindings } = walkTree(root, new Set(['pageTitle']), new Set());

    expect(modelPropBindings[0].signal).toBe('pageTitle');
  });

  it('computes correct path for nested custom elements', () => {
    const html = '<div><section><my-child model:value="data"></my-child></section></div>';
    const root = makeRoot(html);
    const { modelPropBindings } = walkTree(root, new Set(['data']), new Set());

    expect(modelPropBindings).toHaveLength(1);
    expect(modelPropBindings[0].path).toEqual([
      'childNodes[0]', 'childNodes[0]', 'childNodes[0]',
    ]);
  });

  it('removes model:propName attribute from the DOM after detection', () => {
    const html = '<my-child model:value="text" class="active"></my-child>';
    const root = makeRoot(html);
    walkTree(root, new Set(['text']), new Set());

    const child = root.querySelector('my-child');
    expect(child.hasAttribute('model:value')).toBe(false);
    // Other attributes are preserved
    expect(child.getAttribute('class')).toBe('active');
  });

  it('handles multiple model:propName on the same element', () => {
    const html = '<my-form model:name="userName" model:email="userEmail"></my-form>';
    const root = makeRoot(html);
    const { modelPropBindings } = walkTree(root, new Set(['userName', 'userEmail']), new Set());

    expect(modelPropBindings).toHaveLength(2);
    const props = modelPropBindings.map(b => b.propName).sort();
    expect(props).toEqual(['email', 'name']);
  });

  // ── Validation: MODEL_PROP_INVALID_TARGET ───────────────────────────

  it('throws MODEL_PROP_INVALID_TARGET when model:propName is on a non-custom element', () => {
    const html = '<div model:value="text"></div>';
    const root = makeRoot(html);

    expect(() => walkTree(root, new Set(['text']), new Set())).toThrow();
    try {
      walkTree(makeRoot(html), new Set(['text']), new Set());
    } catch (err) {
      expect(err.code).toBe('MODEL_PROP_INVALID_TARGET');
      expect(err.message).toContain('model:propName is only valid on custom elements');
    }
  });

  it('throws MODEL_PROP_INVALID_TARGET for standard HTML elements like <span>', () => {
    const html = '<span model:value="text"></span>';
    const root = makeRoot(html);

    expect(() => walkTree(root, new Set(['text']), new Set())).toThrow();
    try {
      walkTree(makeRoot(html), new Set(['text']), new Set());
    } catch (err) {
      expect(err.code).toBe('MODEL_PROP_INVALID_TARGET');
    }
  });

  // ── Coexistence with model="signal" (Requirement 10.3) ─────────────

  it('does not interfere with model="signal" on form elements', () => {
    const html = `
      <input model="name">
      <my-child model:value="text"></my-child>
    `;
    const root = makeRoot(html);
    const { modelBindings, modelPropBindings } = walkTree(
      root, new Set(['name', 'text']), new Set()
    );

    // Form model binding
    expect(modelBindings).toHaveLength(1);
    expect(modelBindings[0].signal).toBe('name');

    // Component model:propName binding
    expect(modelPropBindings).toHaveLength(1);
    expect(modelPropBindings[0].propName).toBe('value');
    expect(modelPropBindings[0].signal).toBe('text');
  });

  it('handles model="signal" and model:propName in the same template without conflict', () => {
    const html = `
      <input type="text" model="searchQuery">
      <textarea model="description"></textarea>
      <my-search model:query="searchQuery"></my-search>
      <my-editor model:content="description"></my-editor>
    `;
    const root = makeRoot(html);
    const { modelBindings, modelPropBindings } = walkTree(
      root, new Set(['searchQuery', 'description']), new Set()
    );

    expect(modelBindings).toHaveLength(2);
    expect(modelPropBindings).toHaveLength(2);

    // Verify they are correctly categorized
    expect(modelBindings.every(b => b.varName.startsWith('__model'))).toBe(true);
    expect(modelPropBindings.every(b => b.varName.startsWith('__modelProp'))).toBe(true);
  });
});
