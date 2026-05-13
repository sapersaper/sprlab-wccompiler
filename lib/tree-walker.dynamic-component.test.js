import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { processDynamicComponents } from './tree-walker.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  return document.getElementById('__root');
}

// ── Dynamic component detection ─────────────────────────────────────

describe('processDynamicComponents — basic detection', () => {
  it('detects <component :is="currentView()"> and produces a binding', () => {
    const root = makeRoot('<component :is="currentView()"></component>');
    const result = processDynamicComponents(root, []);

    expect(result).toHaveLength(1);
    expect(result[0].varName).toBe('__dyn0');
    expect(result[0].isExpression).toBe('currentView()');
    expect(result[0].props).toEqual([]);
    expect(result[0].events).toEqual([]);
  });

  it('replaces <component> with a <!-- dynamic --> comment node', () => {
    const root = makeRoot('<component :is="currentView()"></component>');
    processDynamicComponents(root, []);

    // The root should now contain a comment node instead of the <component> element
    const comment = root.childNodes[0];
    expect(comment.nodeType).toBe(8); // Comment node
    expect(comment.textContent.trim()).toBe('dynamic');
  });
});

// ── Extraction with multiple props and events ───────────────────────

describe('processDynamicComponents — props and events extraction', () => {
  it('extracts multiple :prop bindings (excluding :is)', () => {
    const root = makeRoot(
      '<component :is="routeComponent()" :title="pageTitle()" :data="items()"></component>'
    );
    const result = processDynamicComponents(root, []);

    expect(result).toHaveLength(1);
    expect(result[0].isExpression).toBe('routeComponent()');
    expect(result[0].props).toHaveLength(2);
    expect(result[0].props[0]).toEqual({ attr: 'title', expression: 'pageTitle()' });
    expect(result[0].props[1]).toEqual({ attr: 'data', expression: 'items()' });
  });

  it('extracts multiple @event bindings', () => {
    const root = makeRoot(
      '<component :is="view()" @navigate="onNavigate" @click="handleClick"></component>'
    );
    const result = processDynamicComponents(root, []);

    expect(result).toHaveLength(1);
    expect(result[0].events).toHaveLength(2);
    expect(result[0].events[0]).toEqual({ event: 'navigate', handler: 'onNavigate' });
    expect(result[0].events[1]).toEqual({ event: 'click', handler: 'handleClick' });
  });

  it('extracts both props and events together', () => {
    const root = makeRoot(
      '<component :is="tag()" :label="name()" @submit="onSubmit"></component>'
    );
    const result = processDynamicComponents(root, []);

    expect(result).toHaveLength(1);
    expect(result[0].isExpression).toBe('tag()');
    expect(result[0].props).toHaveLength(1);
    expect(result[0].props[0]).toEqual({ attr: 'label', expression: 'name()' });
    expect(result[0].events).toHaveLength(1);
    expect(result[0].events[0]).toEqual({ event: 'submit', handler: 'onSubmit' });
  });
});

// ── Error when :is is missing ───────────────────────────────────────

describe('processDynamicComponents — missing :is attribute', () => {
  it('throws an error with code MISSING_IS_ATTRIBUTE when :is is absent', () => {
    const root = makeRoot('<component></component>');

    expect(() => processDynamicComponents(root, [])).toThrow(
      ':is attribute is required on <component> elements'
    );

    try {
      processDynamicComponents(makeRoot('<component></component>'), []);
    } catch (e) {
      expect(e.code).toBe('MISSING_IS_ATTRIBUTE');
    }
  });

  it('throws even when other attributes are present but :is is missing', () => {
    const root = makeRoot('<component :title="t()" @click="handler"></component>');

    expect(() => processDynamicComponents(root, [])).toThrow();

    try {
      processDynamicComponents(root, []);
    } catch (e) {
      expect(e.code).toBe('MISSING_IS_ATTRIBUTE');
    }
  });
});

// ── Anchor path computation ─────────────────────────────────────────

describe('processDynamicComponents — anchor path computation', () => {
  it('computes correct anchorPath for a top-level <component>', () => {
    const root = makeRoot('<component :is="view()"></component>');
    const result = processDynamicComponents(root, []);

    // The comment replaces the component at childNodes[0]
    expect(result[0].anchorPath).toEqual(['childNodes[0]']);
  });

  it('computes correct anchorPath with a parentPath prefix', () => {
    const root = makeRoot('<component :is="view()"></component>');
    const result = processDynamicComponents(root, ['childNodes[2]']);

    expect(result[0].anchorPath).toEqual(['childNodes[2]', 'childNodes[0]']);
  });

  it('computes correct anchorPath when <component> is nested inside other elements', () => {
    const root = makeRoot('<div><component :is="view()"></component></div>');
    const result = processDynamicComponents(root, []);

    // The component is inside div (childNodes[0]) at position childNodes[0]
    expect(result[0].anchorPath).toEqual(['childNodes[0]', 'childNodes[0]']);
  });

  it('computes correct anchorPath when <component> has siblings before it', () => {
    const root = makeRoot('<p>hello</p><component :is="view()"></component>');
    const result = processDynamicComponents(root, []);

    // <p> is childNodes[0], comment (replacing <component>) is childNodes[1]
    expect(result[0].anchorPath).toEqual(['childNodes[1]']);
  });
});

// ── Multiple <component> elements produce sequential varNames ────────

describe('processDynamicComponents — sequential varNames', () => {
  it('produces __dyn0, __dyn1 for two <component> elements', () => {
    const root = makeRoot(
      '<component :is="viewA()"></component><component :is="viewB()"></component>'
    );
    const result = processDynamicComponents(root, []);

    expect(result).toHaveLength(2);
    expect(result[0].varName).toBe('__dyn0');
    expect(result[0].isExpression).toBe('viewA()');
    expect(result[1].varName).toBe('__dyn1');
    expect(result[1].isExpression).toBe('viewB()');
  });

  it('produces __dyn0, __dyn1, __dyn2 for three <component> elements', () => {
    const root = makeRoot(
      '<component :is="a()"></component>' +
      '<component :is="b()"></component>' +
      '<component :is="c()"></component>'
    );
    const result = processDynamicComponents(root, []);

    expect(result).toHaveLength(3);
    expect(result[0].varName).toBe('__dyn0');
    expect(result[1].varName).toBe('__dyn1');
    expect(result[2].varName).toBe('__dyn2');
  });

  it('assigns sequential varNames even when components are nested in different parents', () => {
    const root = makeRoot(
      '<div><component :is="a()"></component></div>' +
      '<span><component :is="b()"></component></span>'
    );
    const result = processDynamicComponents(root, []);

    expect(result).toHaveLength(2);
    expect(result[0].varName).toBe('__dyn0');
    expect(result[1].varName).toBe('__dyn1');
  });
});
