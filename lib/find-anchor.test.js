/**
 * @vitest-environment jsdom
 *
 * Unit tests for findAnchor(root, type, index).
 */
import { describe, it, expect } from 'vitest';
import { findAnchor } from './find-anchor.js';

function createDOM(html) {
  const template = document.createElement('template');
  template.innerHTML = `<div>${html}</div>`;
  return template.content.firstChild;
}

describe('findAnchor', () => {
  it('finds the first <!-- each --> marker', () => {
    const root = createDOM('<p>Hello</p><!-- each --><p>World</p>');
    const result = findAnchor(root, 'each', 0);
    expect(result).not.toBeNull();
    expect(result.nodeType).toBe(8);
    expect(result.textContent).toBe(' each ');
  });

  it('finds the second <!-- each --> marker with index=1', () => {
    const root = createDOM('<div><!-- each --><span><!-- each --></span></div>');
    const first = findAnchor(root, 'each', 0);
    const second = findAnchor(root, 'each', 1);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
    expect(second.textContent).toBe(' each ');
  });

  it('returns null when index is out of range', () => {
    const root = createDOM('<!-- each --><p>text</p>');
    expect(findAnchor(root, 'each', 1)).toBeNull();
    expect(findAnchor(root, 'each', 5)).toBeNull();
  });

  it('returns null when no markers of the given type exist', () => {
    const root = createDOM('<p>No markers here</p><span>Just text</span>');
    expect(findAnchor(root, 'each', 0)).toBeNull();
    expect(findAnchor(root, 'if', 0)).toBeNull();
    expect(findAnchor(root, 'dynamic', 0)).toBeNull();
  });

  it('ignores non-matching comments', () => {
    const root = createDOM('<!-- hello --><!-- each --><!-- world -->');
    const result = findAnchor(root, 'each', 0);
    expect(result).not.toBeNull();
    expect(result.textContent).toBe(' each ');
  });

  it('distinguishes between different marker types', () => {
    const root = createDOM('<!-- if --><!-- each --><!-- dynamic -->');
    const ifAnchor = findAnchor(root, 'if', 0);
    const eachAnchor = findAnchor(root, 'each', 0);
    const dynAnchor = findAnchor(root, 'dynamic', 0);

    expect(ifAnchor).not.toBeNull();
    expect(eachAnchor).not.toBeNull();
    expect(dynAnchor).not.toBeNull();
    expect(ifAnchor.textContent).toBe(' if ');
    expect(eachAnchor.textContent).toBe(' each ');
    expect(dynAnchor.textContent).toBe(' dynamic ');
  });

  it('works on DocumentFragment (template.content)', () => {
    const template = document.createElement('template');
    template.innerHTML = '<div><!-- each --><span></span></div>';
    const fragment = template.content;
    const result = findAnchor(fragment, 'each', 0);
    expect(result).not.toBeNull();
    expect(result.textContent).toBe(' each ');
  });

  it('works on deeply nested structures', () => {
    const root = createDOM(`
      <div>
        <div>
          <div>
            <!-- each -->
          </div>
        </div>
      </div>
    `);
    const result = findAnchor(root, 'each', 0);
    expect(result).not.toBeNull();
    expect(result.textContent).toBe(' each ');
  });

  it('works with multiple markers of same type in nested siblings', () => {
    const root = createDOM(`
      <div><!-- each --></div>
      <div><!-- each --></div>
      <div><!-- each --></div>
    `);
    expect(findAnchor(root, 'each', 0)).not.toBeNull();
    expect(findAnchor(root, 'each', 1)).not.toBeNull();
    expect(findAnchor(root, 'each', 2)).not.toBeNull();
    expect(findAnchor(root, 'each', 3)).toBeNull();
  });

  it('only matches exact marker text with surrounding spaces', () => {
    const root = createDOM('<!--each--><!-- each --><!-- if -->');
    const result = findAnchor(root, 'each', 0);
    expect(result).not.toBeNull();
    expect(result.textContent).toBe(' each ');
    // <!--each--> no matchea porque no tiene espacios alrededor
    expect(findAnchor(root, 'each', 1)).toBeNull();
  });

  it('counts markers in depth-first order', () => {
    const root = createDOM(`
      <div>
        <!-- each -->
        <div>
          <!-- each -->
        </div>
      </div>
      <!-- each -->
    `);
    expect(findAnchor(root, 'each', 0)).not.toBeNull();
    expect(findAnchor(root, 'each', 1)).not.toBeNull();
    expect(findAnchor(root, 'each', 2)).not.toBeNull();
  });
});
