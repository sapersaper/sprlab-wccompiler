/**
 * Tests for extractFunctions() in parser-extractors.js
 *
 * Covers:
 * - Regular function declarations
 * - Async function declarations (BUG-0005 fix)
 * - Multi-line function bodies
 * - Single-line functions
 * - Functions with parameters
 */

import { describe, it, expect } from 'vitest';
import { extractFunctions } from '../../../../lib/parser-extractors.js';

describe('extractFunctions', () => {
  it('extracts a simple function declaration', () => {
    const source = `function increment() {
  count.set(count() + 1)
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('increment');
    expect(result[0].params).toBe('');
    expect(result[0].body).toBe('count.set(count() + 1)');
    expect(result[0].async).toBe(false);
  });

  it('extracts a function with parameters', () => {
    const source = `function add(a, b) {
  return a + b
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('add');
    expect(result[0].params).toBe('a, b');
    expect(result[0].async).toBe(false);
  });

  it('extracts an async function declaration', () => {
    const source = `async function fetchData() {
  const res = await fetch('/api')
  return res.json()
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('fetchData');
    expect(result[0].params).toBe('');
    expect(result[0].body).toContain('await fetch');
    expect(result[0].async).toBe(true);
  });

  it('extracts an async function with parameters', () => {
    const source = `async function submitForm(data, options) {
  await api.post(data, options)
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('submitForm');
    expect(result[0].params).toBe('data, options');
    expect(result[0].async).toBe(true);
  });

  it('extracts both sync and async functions from the same source', () => {
    const source = `function syncMethod() {
  count.set(1)
}

async function asyncMethod() {
  await delay(100)
  count.set(2)
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(2);

    expect(result[0].name).toBe('syncMethod');
    expect(result[0].async).toBe(false);

    expect(result[1].name).toBe('asyncMethod');
    expect(result[1].async).toBe(true);
  });

  it('handles async function with complex body (await + multiple statements)', () => {
    const source = `async function rapidSwap() {
  currentView.set('view-a')
  await new Promise(r => setTimeout(r, 10))
  currentView.set('view-b')
  await new Promise(r => setTimeout(r, 10))
  currentView.set('view-a')
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('rapidSwap');
    expect(result[0].async).toBe(true);
    expect(result[0].body).toContain('await new Promise');
    expect(result[0].body).toContain("currentView.set('view-b')");
  });

  it('handles single-line function', () => {
    const source = `function getName() { return 'test' }`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('getName');
    expect(result[0].body).toContain("return 'test'");
    expect(result[0].async).toBe(false);
  });

  it('handles single-line async function', () => {
    const source = `async function ping() { await fetch('/ping') }`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ping');
    expect(result[0].async).toBe(true);
  });
});
