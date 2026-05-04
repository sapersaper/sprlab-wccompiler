import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WccCode } from './languagePlugin';
import type * as ts from 'typescript';

/**
 * Property-Based Tests for languagePlugin.ts
 *
 * Feature: volar-language-server, Property 1: Asignación correcta de languageId
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

/** Creates a ts.IScriptSnapshot from a string */
function createSnapshot(content: string): ts.IScriptSnapshot {
  return {
    getText: (start: number, end: number) => content.substring(start, end),
    getLength: () => content.length,
    getChangeRange: () => undefined,
  };
}

/**
 * Generator for block content that avoids closing tags within the content.
 */
function safeBlockContent(blockName: 'script' | 'template' | 'style'): fc.Arbitrary<string> {
  return fc.string({ minLength: 0, maxLength: 200 }).map((s) => {
    const closeTag = `</${blockName}>`;
    return s.replaceAll(closeTag, '');
  });
}

describe('Feature: volar-language-server, Property 1: Asignación correcta de languageId', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   *
   * For any .wcc file with random combinations of blocks and lang attributes:
   * - script with lang="ts" → embeddedCode with languageId "typescript"
   * - script without lang or with lang="js" → embeddedCode with languageId "javascript"
   * - template → embeddedCode with languageId "html"
   * - style → embeddedCode with languageId "css"
   * - Number of embeddedCodes matches number of included blocks
   */
  it('each embeddedCode has the correct languageId based on block type and lang attribute', () => {
    const arbScriptLang = fc.constantFrom('', ' lang="ts"', ' lang="js"');

    const arbWccConfig = fc.record({
      includeScript: fc.boolean(),
      scriptLang: arbScriptLang,
      includeTemplate: fc.boolean(),
      includeStyle: fc.boolean(),
      scriptContent: safeBlockContent('script'),
      templateContent: safeBlockContent('template'),
      styleContent: safeBlockContent('style'),
    });

    fc.assert(
      fc.property(arbWccConfig, (config) => {
        // Build the .wcc source string
        const parts: string[] = [];

        if (config.includeScript) {
          parts.push(`<script${config.scriptLang}>${config.scriptContent}</script>`);
        }
        if (config.includeTemplate) {
          parts.push(`<template>${config.templateContent}</template>`);
        }
        if (config.includeStyle) {
          parts.push(`<style>${config.styleContent}</style>`);
        }

        const source = parts.join('\n');

        // Create WccCode
        const wccCode = new WccCode(createSnapshot(source));

        // Count expected blocks
        let expectedCount = 0;
        if (config.includeScript) expectedCount++;
        if (config.includeTemplate) expectedCount++;
        if (config.includeStyle) expectedCount++;

        // Verify number of embeddedCodes matches number of included blocks
        expect(wccCode.embeddedCodes.length).toBe(expectedCount);

        // Verify languageId for script block
        if (config.includeScript) {
          const scriptCode = wccCode.embeddedCodes.find((c) => c.id === 'script_0');
          expect(scriptCode).toBeDefined();

          if (config.scriptLang === ' lang="ts"') {
            expect(scriptCode!.languageId).toBe('typescript');
          } else {
            // No lang or lang="js" → javascript
            expect(scriptCode!.languageId).toBe('javascript');
          }
        }

        // Verify languageId for template block
        if (config.includeTemplate) {
          const templateCode = wccCode.embeddedCodes.find((c) => c.id === 'template_0');
          expect(templateCode).toBeDefined();
          expect(templateCode!.languageId).toBe('html');
        }

        // Verify languageId for style block
        if (config.includeStyle) {
          const styleCode = wccCode.embeddedCodes.find((c) => c.id === 'style_0');
          expect(styleCode).toBeDefined();
          expect(styleCode!.languageId).toBe('css');
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: volar-language-server, Property 2: Round-trip de mapeo de posiciones', () => {
  /**
   * **Validates: Requirements 2.5, 7.1, 7.2, 7.3, 7.4**
   *
   * For any .wcc file and for any position (offset) within a block's content,
   * mapping that position from the source file to the virtual document and back
   * to the source file SHALL produce the original position.
   *
   * Each embeddedCode has a single mapping with:
   * - sourceOffsets[0] = block.startOffset in the .wcc file
   * - generatedOffsets[0] = 0 (start of virtual document)
   * - lengths[0] = block.content.length
   *
   * So for any offset `o` within [0, lengths[0]):
   * - Source position = sourceOffsets[0] + o
   * - Generated position = generatedOffsets[0] + o = o
   * - Round-trip: source → generated → source should give back the same position
   */
  it('round-trip mapping is consistent for any offset within a block', () => {
    const arbScriptLang = fc.constantFrom('', ' lang="ts"', ' lang="js"');

    const arbWccFile = fc.record({
      scriptLang: arbScriptLang,
      scriptContent: safeBlockContent('script').filter((s) => s.length > 0),
      templateContent: safeBlockContent('template').filter((s) => s.length > 0),
      styleContent: safeBlockContent('style').filter((s) => s.length > 0),
    });

    fc.assert(
      fc.property(arbWccFile, fc.nat(), fc.nat(), fc.nat(), (file, seedScript, seedTemplate, seedStyle) => {
        // Build .wcc source with all three blocks
        const source = [
          `<script${file.scriptLang}>${file.scriptContent}</script>`,
          `<template>${file.templateContent}</template>`,
          `<style>${file.styleContent}</style>`,
        ].join('\n');

        const wccCode = new WccCode(createSnapshot(source));

        // Verify round-trip for each embedded code
        for (const embedded of wccCode.embeddedCodes) {
          const mapping = embedded.mappings[0];
          expect(mapping).toBeDefined();

          const sourceOffset = mapping.sourceOffsets[0];
          const generatedOffset = mapping.generatedOffsets[0];
          const length = mapping.lengths[0];

          // generatedOffsets[0] should always be 0
          expect(generatedOffset).toBe(0);

          // Pick a random offset within the block content
          let randomOffset: number;
          if (embedded.id === 'script_0') {
            randomOffset = seedScript % length;
          } else if (embedded.id === 'template_0') {
            randomOffset = seedTemplate % length;
          } else {
            randomOffset = seedStyle % length;
          }

          // Round-trip: source → generated → source
          // Given a source position within the block:
          const sourcePos = sourceOffset + randomOffset;
          // Map to generated: generatedPos = sourcePos - sourceOffset + generatedOffset
          const generatedPos = sourcePos - sourceOffset + generatedOffset;
          // Map back to source: sourcePos2 = generatedPos - generatedOffset + sourceOffset
          const sourcePos2 = generatedPos - generatedOffset + sourceOffset;

          // Round-trip should produce the original position
          expect(sourcePos2).toBe(sourcePos);

          // Also verify the generated position equals the offset directly
          expect(generatedPos).toBe(randomOffset);

          // Verify that source text at the mapped position matches generated text
          const sourceText = source.charAt(sourcePos);
          const embeddedContent = embedded.snapshot.getText(0, embedded.snapshot.getLength());
          const generatedText = embeddedContent.charAt(generatedPos);
          expect(sourceText).toBe(generatedText);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('mapping covers the entire block content range', () => {
    const arbScriptLang = fc.constantFrom('', ' lang="ts"', ' lang="js"');

    const arbWccFile = fc.record({
      scriptLang: arbScriptLang,
      scriptContent: safeBlockContent('script').filter((s) => s.length > 0),
      templateContent: safeBlockContent('template').filter((s) => s.length > 0),
      styleContent: safeBlockContent('style').filter((s) => s.length > 0),
    });

    fc.assert(
      fc.property(arbWccFile, (file) => {
        const source = [
          `<script${file.scriptLang}>${file.scriptContent}</script>`,
          `<template>${file.templateContent}</template>`,
          `<style>${file.styleContent}</style>`,
        ].join('\n');

        const wccCode = new WccCode(createSnapshot(source));

        for (const embedded of wccCode.embeddedCodes) {
          const mapping = embedded.mappings[0];
          const sourceOffset = mapping.sourceOffsets[0];
          const length = mapping.lengths[0];
          const embeddedContent = embedded.snapshot.getText(0, embedded.snapshot.getLength());

          // The mapping length should equal the embedded content length
          expect(length).toBe(embeddedContent.length);

          // Verify every position in the range maps correctly (spot check first and last)
          // First position
          const firstSourcePos = sourceOffset + 0;
          expect(source.charAt(firstSourcePos)).toBe(embeddedContent.charAt(0));

          // Last position
          const lastOffset = length - 1;
          const lastSourcePos = sourceOffset + lastOffset;
          expect(source.charAt(lastSourcePos)).toBe(embeddedContent.charAt(lastOffset));

          // The source slice should exactly equal the embedded content
          expect(source.slice(sourceOffset, sourceOffset + length)).toBe(embeddedContent);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: volar-language-server, Property 4: Consistencia de actualización de contenido', () => {
  /**
   * **Validates: Requirement 2.7**
   *
   * For any .wcc file and for any modification of its content, after calling
   * update() with the new snapshot, the embeddedCodes SHALL reflect the updated
   * content — i.e., the content of each embedded VirtualCode SHALL match exactly
   * the content of the corresponding block in the new source file.
   */
  it('after update(), embeddedCodes reflect the modified content, not the initial content', () => {
    const arbScriptLang = fc.constantFrom('', ' lang="ts"', ' lang="js"');

    const arbWccPair = fc.record({
      scriptLang: arbScriptLang,
      initialScript: safeBlockContent('script'),
      initialTemplate: safeBlockContent('template'),
      initialStyle: safeBlockContent('style'),
      modifiedScript: safeBlockContent('script'),
      modifiedTemplate: safeBlockContent('template'),
      modifiedStyle: safeBlockContent('style'),
      includeScript: fc.boolean(),
      includeTemplate: fc.boolean(),
      includeStyle: fc.boolean(),
    });

    fc.assert(
      fc.property(arbWccPair, (config) => {
        // Build initial .wcc source
        const initialParts: string[] = [];
        if (config.includeScript) {
          initialParts.push(`<script${config.scriptLang}>${config.initialScript}</script>`);
        }
        if (config.includeTemplate) {
          initialParts.push(`<template>${config.initialTemplate}</template>`);
        }
        if (config.includeStyle) {
          initialParts.push(`<style>${config.initialStyle}</style>`);
        }
        const initialSource = initialParts.join('\n');

        // Build modified .wcc source (same structure, different content)
        const modifiedParts: string[] = [];
        if (config.includeScript) {
          modifiedParts.push(`<script${config.scriptLang}>${config.modifiedScript}</script>`);
        }
        if (config.includeTemplate) {
          modifiedParts.push(`<template>${config.modifiedTemplate}</template>`);
        }
        if (config.includeStyle) {
          modifiedParts.push(`<style>${config.modifiedStyle}</style>`);
        }
        const modifiedSource = modifiedParts.join('\n');

        // Create WccCode from initial source
        const wccCode = new WccCode(createSnapshot(initialSource));

        // Call update() with modified source
        wccCode.update(createSnapshot(modifiedSource));

        // Count expected blocks
        let expectedCount = 0;
        if (config.includeScript) expectedCount++;
        if (config.includeTemplate) expectedCount++;
        if (config.includeStyle) expectedCount++;

        // Verify number of embeddedCodes matches blocks in modified source
        expect(wccCode.embeddedCodes.length).toBe(expectedCount);

        // Verify each embeddedCode's snapshot contains the new block content
        if (config.includeScript) {
          const scriptCode = wccCode.embeddedCodes.find((c) => c.id === 'script_0');
          expect(scriptCode).toBeDefined();
          const content = scriptCode!.snapshot.getText(0, scriptCode!.snapshot.getLength());
          expect(content).toBe(config.modifiedScript);
        }

        if (config.includeTemplate) {
          const templateCode = wccCode.embeddedCodes.find((c) => c.id === 'template_0');
          expect(templateCode).toBeDefined();
          const content = templateCode!.snapshot.getText(0, templateCode!.snapshot.getLength());
          expect(content).toBe(config.modifiedTemplate);
        }

        if (config.includeStyle) {
          const styleCode = wccCode.embeddedCodes.find((c) => c.id === 'style_0');
          expect(styleCode).toBeDefined();
          const content = styleCode!.snapshot.getText(0, styleCode!.snapshot.getLength());
          expect(content).toBe(config.modifiedStyle);
        }

        // Verify mappings have correct offsets for the new source
        for (const embedded of wccCode.embeddedCodes) {
          const mapping = embedded.mappings[0];
          expect(mapping).toBeDefined();

          const sourceOffset = mapping.sourceOffsets[0];
          const generatedOffset = mapping.generatedOffsets[0];
          const length = mapping.lengths[0];

          // generatedOffsets[0] should always be 0
          expect(generatedOffset).toBe(0);

          // The mapping length should equal the embedded content length
          const embeddedContent = embedded.snapshot.getText(0, embedded.snapshot.getLength());
          expect(length).toBe(embeddedContent.length);

          // The source slice at the mapped offset should match the embedded content
          expect(modifiedSource.slice(sourceOffset, sourceOffset + length)).toBe(embeddedContent);
        }
      }),
      { numRuns: 100 }
    );
  });
});
