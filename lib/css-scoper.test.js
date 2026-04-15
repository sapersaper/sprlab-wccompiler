import { describe, it, expect } from 'vitest';
import { scopeCSS } from './css-scoper.js';

describe('scopeCSS', () => {
  // ── Basic selector prefixing ──────────────────────────────────────

  it('prefixes a simple class selector', () => {
    const css = '.counter { color: red; }';
    const result = scopeCSS(css, 'wcc-hi');
    expect(result).toContain('wcc-hi .counter');
    expect(result).toContain('color: red;');
  });

  it('prefixes an element selector', () => {
    const css = 'button { padding: 8px; }';
    const result = scopeCSS(css, 'my-comp');
    expect(result).toContain('my-comp button');
  });

  it('prefixes an id selector', () => {
    const css = '#main { display: flex; }';
    const result = scopeCSS(css, 'my-comp');
    expect(result).toContain('my-comp #main');
  });

  // ── Comma-separated selectors ─────────────────────────────────────

  it('prefixes each part of comma-separated selectors', () => {
    const css = '.foo, .bar { color: blue; }';
    const result = scopeCSS(css, 'x-tag');
    expect(result).toContain('x-tag .foo');
    expect(result).toContain('x-tag .bar');
  });

  // ── Multiple rules ────────────────────────────────────────────────

  it('handles multiple rules', () => {
    const css = `.a { color: red; }\n.b { color: blue; }`;
    const result = scopeCSS(css, 'x-tag');
    expect(result).toContain('x-tag .a');
    expect(result).toContain('x-tag .b');
  });

  // ── Empty / whitespace CSS ────────────────────────────────────────

  it('returns empty string for empty CSS', () => {
    expect(scopeCSS('', 'x-tag')).toBe('');
    expect(scopeCSS('   ', 'x-tag')).toBe('');
    expect(scopeCSS(null, 'x-tag')).toBe('');
    expect(scopeCSS(undefined, 'x-tag')).toBe('');
  });

  // ── @media at-rule ────────────────────────────────────────────────

  it('preserves @media rule but scopes selectors inside', () => {
    const css = `@media (max-width: 600px) {\n  .mobile { display: block; }\n}`;
    const result = scopeCSS(css, 'my-comp');
    // @media itself should NOT be prefixed
    expect(result).toContain('@media (max-width: 600px)');
    // Selectors inside @media SHOULD be prefixed
    expect(result).toContain('my-comp .mobile');
  });

  it('scopes multiple selectors inside @media', () => {
    const css = `@media screen {\n  .a { color: red; }\n  .b { color: blue; }\n}`;
    const result = scopeCSS(css, 'x-tag');
    expect(result).toContain('x-tag .a');
    expect(result).toContain('x-tag .b');
    expect(result).toContain('@media screen');
  });

  // ── @keyframes at-rule ────────────────────────────────────────────

  it('preserves @keyframes without prefixing keyframe stops', () => {
    const css = `@keyframes fadeIn {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}`;
    const result = scopeCSS(css, 'my-comp');
    expect(result).toContain('@keyframes fadeIn');
    // "from" and "to" should NOT be prefixed
    expect(result).not.toContain('my-comp from');
    expect(result).not.toContain('my-comp to');
    expect(result).toContain('from');
    expect(result).toContain('to');
  });

  it('preserves @keyframes with percentage stops', () => {
    const css = `@keyframes slide {\n  0% { left: 0; }\n  100% { left: 100px; }\n}`;
    const result = scopeCSS(css, 'x-tag');
    expect(result).not.toContain('x-tag 0%');
    expect(result).not.toContain('x-tag 100%');
  });

  // ── Mixed rules and at-rules ──────────────────────────────────────

  it('handles mix of regular rules and at-rules', () => {
    const css = `.counter { color: red; }\n@media (max-width: 600px) {\n  .counter { font-size: 12px; }\n}\n@keyframes spin {\n  from { transform: rotate(0); }\n  to { transform: rotate(360deg); }\n}\n.info { color: blue; }`;
    const result = scopeCSS(css, 'wcc-hi');

    // Regular selectors prefixed
    expect(result).toContain('wcc-hi .counter');
    expect(result).toContain('wcc-hi .info');

    // @media preserved, inner selectors prefixed
    expect(result).toContain('@media (max-width: 600px)');

    // @keyframes preserved, stops NOT prefixed
    expect(result).toContain('@keyframes spin');
    expect(result).not.toContain('wcc-hi from');
    expect(result).not.toContain('wcc-hi to');
  });

  // ── Nested compound selectors ─────────────────────────────────────

  it('prefixes compound selectors (descendant)', () => {
    const css = '.parent .child { color: red; }';
    const result = scopeCSS(css, 'x-tag');
    expect(result).toContain('x-tag .parent .child');
  });
});
