import { describe, it, expect } from 'vitest';
import { parseWccBlocks } from './wccParser';

describe('wccParser - parseWccBlocks', () => {
  it('file with three blocks extracts correct content from each one', () => {
    const source = `<script>const x = 1;</script>
<template><div>Hello</div></template>
<style>.foo { color: red; }</style>`;

    const result = parseWccBlocks(source);

    expect(result.script).not.toBeNull();
    expect(result.script!.type).toBe('script');
    expect(result.script!.content).toBe('const x = 1;');

    expect(result.template).not.toBeNull();
    expect(result.template!.type).toBe('template');
    expect(result.template!.content).toBe('<div>Hello</div>');

    expect(result.style).not.toBeNull();
    expect(result.style!.type).toBe('style');
    expect(result.style!.content).toBe('.foo { color: red; }');
  });

  it('file without <style> returns style: null', () => {
    const source = `<script>const x = 1;</script>
<template><div>Hello</div></template>`;

    const result = parseWccBlocks(source);

    expect(result.script).not.toBeNull();
    expect(result.script!.content).toBe('const x = 1;');
    expect(result.template).not.toBeNull();
    expect(result.template!.content).toBe('<div>Hello</div>');
    expect(result.style).toBeNull();
  });

  it('empty file returns all fields null', () => {
    const result = parseWccBlocks('');

    expect(result.script).toBeNull();
    expect(result.template).toBeNull();
    expect(result.style).toBeNull();
  });

  it('<script lang="ts"> extracts attrs with ` lang="ts"`', () => {
    const source = `<script lang="ts">const x: number = 1;</script>`;

    const result = parseWccBlocks(source);

    expect(result.script).not.toBeNull();
    expect(result.script!.attrs).toBe(' lang="ts"');
    expect(result.script!.content).toBe('const x: number = 1;');
  });

  it('tag without closing is ignored (returns null for that block)', () => {
    const source = `<script>code`;

    const result = parseWccBlocks(source);

    expect(result.script).toBeNull();
  });

  it('calculated offsets are correct for a known file', () => {
    const source = `<script lang="ts">
const x = 1;
</script>
<template>
<div>Hello</div>
</template>
<style>
.foo { color: red; }
</style>`;

    const result = parseWccBlocks(source);

    // Script block: opening tag `<script lang="ts">` is 18 chars (index 0..17), content starts at 18
    expect(result.script).not.toBeNull();
    expect(result.script!.startOffset).toBe(18);
    expect(result.script!.content).toBe('\nconst x = 1;\n');
    expect(result.script!.endOffset).toBe(18 + '\nconst x = 1;\n'.length);
    // Verify slice matches content
    expect(source.slice(result.script!.startOffset, result.script!.endOffset)).toBe(result.script!.content);

    // Template block: find the opening tag position and verify
    expect(result.template).not.toBeNull();
    const templateOpenTag = '<template>';
    const templateOpenIdx = source.indexOf(templateOpenTag);
    const expectedTemplateStart = templateOpenIdx + templateOpenTag.length;
    expect(result.template!.startOffset).toBe(expectedTemplateStart);
    expect(result.template!.content).toBe('\n<div>Hello</div>\n');
    expect(result.template!.endOffset).toBe(expectedTemplateStart + '\n<div>Hello</div>\n'.length);
    expect(source.slice(result.template!.startOffset, result.template!.endOffset)).toBe(result.template!.content);

    // Style block: find the opening tag position and verify
    expect(result.style).not.toBeNull();
    const styleOpenTag = '<style>';
    const styleOpenIdx = source.indexOf(styleOpenTag);
    const expectedStyleStart = styleOpenIdx + styleOpenTag.length;
    expect(result.style!.startOffset).toBe(expectedStyleStart);
    expect(result.style!.content).toBe('\n.foo { color: red; }\n');
    expect(result.style!.endOffset).toBe(expectedStyleStart + '\n.foo { color: red; }\n'.length);
    expect(source.slice(result.style!.startOffset, result.style!.endOffset)).toBe(result.style!.content);
  });
});
