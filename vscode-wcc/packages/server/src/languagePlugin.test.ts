import { describe, it, expect } from 'vitest';
import { WccCode, wccLanguagePlugin } from './languagePlugin';

/** Creates a ts.IScriptSnapshot from a string */
function createSnapshot(content: string) {
  return {
    getText: (start: number, end: number) => content.substring(start, end),
    getLength: () => content.length,
    getChangeRange: () => undefined,
  };
}

/** Mock URI object for testing getLanguageId */
function mockUri(path: string) {
  return { path } as any;
}

describe('WccCode', () => {
  it('file with three blocks generates three embeddedCodes', () => {
    const source = `<script>const x = 1;</script>
<template><div>Hello</div></template>
<style>.foo { color: red; }</style>`;

    const code = new WccCode(createSnapshot(source));

    expect(code.embeddedCodes).toHaveLength(3);
    expect(code.embeddedCodes[0].id).toBe('script_0');
    expect(code.embeddedCodes[1].id).toBe('template_0');
    expect(code.embeddedCodes[2].id).toBe('style_0');
  });

  it('file without <style> generates two embeddedCodes', () => {
    const source = `<script>const x = 1;</script>
<template><div>Hello</div></template>`;

    const code = new WccCode(createSnapshot(source));

    expect(code.embeddedCodes).toHaveLength(2);
    expect(code.embeddedCodes[0].id).toBe('script_0');
    expect(code.embeddedCodes[1].id).toBe('template_0');
  });

  it('<script lang="ts"> produces languageId "typescript"', () => {
    const source = `<script lang="ts">const x: number = 1;</script>
<template><div></div></template>`;

    const code = new WccCode(createSnapshot(source));

    const scriptCode = code.embeddedCodes.find((c) => c.id === 'script_0');
    expect(scriptCode).toBeDefined();
    expect(scriptCode!.languageId).toBe('typescript');
  });

  it('<script> without lang produces languageId "javascript"', () => {
    const source = `<script>const x = 1;</script>
<template><div></div></template>`;

    const code = new WccCode(createSnapshot(source));

    const scriptCode = code.embeddedCodes.find((c) => c.id === 'script_0');
    expect(scriptCode).toBeDefined();
    expect(scriptCode!.languageId).toBe('javascript');
  });

  it('<script lang="js"> produces languageId "javascript"', () => {
    const source = `<script lang="js">const x = 1;</script>
<template><div></div></template>`;

    const code = new WccCode(createSnapshot(source));

    const scriptCode = code.embeddedCodes.find((c) => c.id === 'script_0');
    expect(scriptCode).toBeDefined();
    expect(scriptCode!.languageId).toBe('javascript');
  });

  it('empty file produces empty embeddedCodes', () => {
    const code = new WccCode(createSnapshot(''));

    expect(code.embeddedCodes).toHaveLength(0);
  });

  it('update() reflects changes in content', () => {
    const source1 = `<script>const x = 1;</script>
<template><div>Hello</div></template>`;

    const code = new WccCode(createSnapshot(source1));
    expect(code.embeddedCodes).toHaveLength(2);

    // Update with new content that adds a style block
    const source2 = `<script>const y = 2;</script>
<template><p>World</p></template>
<style>body { margin: 0; }</style>`;

    code.update(createSnapshot(source2));

    expect(code.embeddedCodes).toHaveLength(3);

    const scriptCode = code.embeddedCodes.find((c) => c.id === 'script_0')!;
    expect(scriptCode.snapshot.getText(0, scriptCode.snapshot.getLength())).toBe('const y = 2;');

    const templateCode = code.embeddedCodes.find((c) => c.id === 'template_0')!;
    expect(templateCode.snapshot.getText(0, templateCode.snapshot.getLength())).toBe('<p>World</p>');

    const styleCode = code.embeddedCodes.find((c) => c.id === 'style_0')!;
    expect(styleCode.snapshot.getText(0, styleCode.snapshot.getLength())).toBe('body { margin: 0; }');
  });

  it('mappings have correct offsets for a known file', () => {
    const source = `<script lang="ts">
const x: number = 42;
</script>
<template>
<div>Hello</div>
</template>
<style>
.foo { color: red; }
</style>`;

    const code = new WccCode(createSnapshot(source));

    expect(code.embeddedCodes).toHaveLength(3);

    // Script block: opening tag is `<script lang="ts">` (18 chars), content starts at offset 18
    const scriptCode = code.embeddedCodes[0];
    expect(scriptCode.id).toBe('script_0');
    expect(scriptCode.mappings).toHaveLength(1);
    const scriptMapping = scriptCode.mappings[0];
    expect(scriptMapping.sourceOffsets[0]).toBe(18);
    expect(scriptMapping.generatedOffsets[0]).toBe(0);
    const scriptContent = scriptCode.snapshot.getText(0, scriptCode.snapshot.getLength());
    expect(scriptMapping.lengths[0]).toBe(scriptContent.length);
    // Verify the source slice matches the virtual content
    expect(source.slice(scriptMapping.sourceOffsets[0], scriptMapping.sourceOffsets[0] + scriptMapping.lengths[0])).toBe(scriptContent);

    // Template block
    const templateCode = code.embeddedCodes[1];
    expect(templateCode.id).toBe('template_0');
    expect(templateCode.mappings).toHaveLength(1);
    const templateMapping = templateCode.mappings[0];
    const templateOpenTag = '<template>';
    const templateOpenIdx = source.indexOf(templateOpenTag);
    expect(templateMapping.sourceOffsets[0]).toBe(templateOpenIdx + templateOpenTag.length);
    expect(templateMapping.generatedOffsets[0]).toBe(0);
    const templateContent = templateCode.snapshot.getText(0, templateCode.snapshot.getLength());
    expect(templateMapping.lengths[0]).toBe(templateContent.length);
    expect(source.slice(templateMapping.sourceOffsets[0], templateMapping.sourceOffsets[0] + templateMapping.lengths[0])).toBe(templateContent);

    // Style block
    const styleCode = code.embeddedCodes[2];
    expect(styleCode.id).toBe('style_0');
    expect(styleCode.mappings).toHaveLength(1);
    const styleMapping = styleCode.mappings[0];
    const styleOpenTag = '<style>';
    const styleOpenIdx = source.indexOf(styleOpenTag);
    expect(styleMapping.sourceOffsets[0]).toBe(styleOpenIdx + styleOpenTag.length);
    expect(styleMapping.generatedOffsets[0]).toBe(0);
    const styleContent = styleCode.snapshot.getText(0, styleCode.snapshot.getLength());
    expect(styleMapping.lengths[0]).toBe(styleContent.length);
    expect(source.slice(styleMapping.sourceOffsets[0], styleMapping.sourceOffsets[0] + styleMapping.lengths[0])).toBe(styleContent);
  });
});

describe('wccLanguagePlugin', () => {
  it('getLanguageId returns "wcc" for .wcc URIs', () => {
    expect(wccLanguagePlugin.getLanguageId(mockUri('/path/to/file.wcc'))).toBe('wcc');
    expect(wccLanguagePlugin.getLanguageId(mockUri('/another/component.wcc'))).toBe('wcc');
  });

  it('getLanguageId returns undefined for non-.wcc URIs', () => {
    expect(wccLanguagePlugin.getLanguageId(mockUri('/path/to/file.ts'))).toBeUndefined();
    expect(wccLanguagePlugin.getLanguageId(mockUri('/path/to/file.html'))).toBeUndefined();
    expect(wccLanguagePlugin.getLanguageId(mockUri('/path/to/file.vue'))).toBeUndefined();
    expect(wccLanguagePlugin.getLanguageId(mockUri('/path/to/file.wcc.ts'))).toBeUndefined();
  });
});
