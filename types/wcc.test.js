import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dtsPath = resolve(__dirname, 'wcc.d.ts');

describe('type declarations (wcc.d.ts)', () => {
  it('file exists', () => {
    expect(existsSync(dtsPath)).toBe(true);
  });

  it('contains signal declaration', () => {
    const content = readFileSync(dtsPath, 'utf-8');
    expect(content).toContain('function signal<T>(value: T): Signal<T>');
  });

  it('contains computed declaration', () => {
    const content = readFileSync(dtsPath, 'utf-8');
    expect(content).toContain('function computed<T>(fn: () => T): () => T');
  });

  it('contains effect declaration', () => {
    const content = readFileSync(dtsPath, 'utf-8');
    expect(content).toContain('function effect(fn: () => void): void');
  });

  it('contains defineComponent declaration', () => {
    const content = readFileSync(dtsPath, 'utf-8');
    expect(content).toContain('function defineComponent');
    expect(content).toContain('tag: string');
    expect(content).not.toContain('template?: string');
    expect(content).not.toContain('styles?: string');
  });

  it('Signal<T> interface has call signature (): T', () => {
    const content = readFileSync(dtsPath, 'utf-8');
    expect(content).toContain('(): T');
  });

  it('Signal<T> interface has set(value: T): void', () => {
    const content = readFileSync(dtsPath, 'utf-8');
    expect(content).toContain('set(value: T): void');
  });
});
