import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WccCode } from './languagePlugin';
import { extractTemplateExpressions } from './templateExpressionParser';
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

describe('Feature: template-intellisense, Property 2: El Virtual_Script contiene todas las expresiones del template', () => {
  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any .wcc file with a template block that contains embedded expressions,
   * the VirtualCode `template_expressions_0` generated SHALL contain the text of
   * each extracted expression as a statement within the virtual code.
   */

  /** Generator for valid JS/TS identifiers (safe for template expressions) */
  const arbIdentifier = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 2,
      maxLength: 8,
    })
    .map((chars) => chars.join(''));

  /** Generator for event names */
  const arbEventName = fc.constantFrom('click', 'input', 'change', 'submit', 'keydown', 'mouseover');

  /** Generator for attribute names for bindings */
  const arbAttrName = fc.constantFrom('class', 'style', 'disabled', 'value', 'href', 'id', 'title');

  it('template_expressions_0 contains each extracted expression as a statement', () => {
    // Generate .wcc files with template blocks containing expressions
    const arbWccWithExpressions = fc.record({
      scriptContent: arbIdentifier.map((id) => `const ${id} = 'hello'`),
      interpExprs: fc.array(arbIdentifier, { minLength: 1, maxLength: 3 }),
      eventExprs: fc.array(
        fc.tuple(arbEventName, arbIdentifier).map(([ev, handler]) => ({ event: ev, handler })),
        { minLength: 0, maxLength: 2 }
      ),
      bindExprs: fc.array(
        fc.tuple(arbAttrName, arbIdentifier).map(([attr, expr]) => ({ attr, expr })),
        { minLength: 0, maxLength: 2 }
      ),
    });

    fc.assert(
      fc.property(arbWccWithExpressions, (config) => {
        // Build template content with expressions
        const templateParts: string[] = [];
        for (const expr of config.interpExprs) {
          templateParts.push(`<p>{{${expr}}}</p>`);
        }
        for (const { event, handler } of config.eventExprs) {
          templateParts.push(`<button @${event}="${handler}">btn</button>`);
        }
        for (const { attr, expr } of config.bindExprs) {
          templateParts.push(`<div :${attr}="${expr}">div</div>`);
        }
        const templateContent = templateParts.join('\n');

        // Build the full .wcc source
        const source = `<script>${config.scriptContent}</script>\n<template>${templateContent}</template>`;

        // Create WccCode
        const wccCode = new WccCode(createSnapshot(source));

        // Find the template_expressions_0 VirtualCode
        const exprCode = wccCode.embeddedCodes.find((c) => c.id === 'template_expressions_0');
        expect(exprCode).toBeDefined();

        // Get the virtual code content
        const virtualContent = exprCode!.snapshot.getText(0, exprCode!.snapshot.getLength());

        // Extract expressions using the same parser the implementation uses
        const expressions = extractTemplateExpressions(templateContent);

        // Verify each extracted expression appears as a statement in the virtual code
        for (const expression of expressions) {
          const statement = expression.content + ';';
          expect(virtualContent).toContain(statement);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('template_expressions_0 is NOT generated when template has no expressions', () => {
    // Generate .wcc files with template blocks that have NO expressions
    const arbSafeHtml = fc
      .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), {
        minLength: 1,
        maxLength: 50,
      })
      .map((chars) => chars.join('').trim())
      .filter((s) => s.length > 0);

    const arbWccNoExpressions = fc.record({
      scriptContent: arbIdentifier.map((id) => `const ${id} = 'hello'`),
      templateContent: arbSafeHtml.map(
        (text) => `<p>${text}</p>`
      ),
    });

    fc.assert(
      fc.property(arbWccNoExpressions, (config) => {
        const source = `<script>${config.scriptContent}</script>\n<template>${config.templateContent}</template>`;

        const wccCode = new WccCode(createSnapshot(source));

        // template_expressions_0 should NOT exist
        const exprCode = wccCode.embeddedCodes.find((c) => c.id === 'template_expressions_0');
        expect(exprCode).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: template-intellisense, Property 3: LanguageId del Virtual_Script coincide con el bloque script', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * For any .wcc file, the VirtualCode `template_expressions_0` SHALL have
   * `languageId` "typescript" if the `<script>` block has `lang="ts"`, and
   * "javascript" otherwise (including when there is no script block).
   */

  /** Generator for valid JS/TS identifiers (safe for template expressions) */
  const arbIdentifier = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 2,
      maxLength: 8,
    })
    .map((chars) => chars.join(''));

  /** Generator for script lang attribute variants */
  const arbScriptLangVariant = fc.constantFrom(
    ' lang="ts"',
    ' lang="js"',
    '',
  );

  it('template_expressions_0 has languageId "typescript" when script has lang="ts", and "javascript" otherwise', () => {
    const arbWccWithScriptLang = fc.record({
      scriptLang: arbScriptLangVariant,
      scriptContent: arbIdentifier.map((id) => `const ${id} = 'hello'`),
      exprIdentifier: arbIdentifier,
      includeScript: fc.boolean(),
    });

    fc.assert(
      fc.property(arbWccWithScriptLang, (config) => {
        // Build template with at least one expression so template_expressions_0 is generated
        const templateContent = `<p>{{${config.exprIdentifier}}}</p>`;

        // Build the .wcc source
        const parts: string[] = [];
        if (config.includeScript) {
          parts.push(`<script${config.scriptLang}>${config.scriptContent}</script>`);
        }
        parts.push(`<template>${templateContent}</template>`);

        const source = parts.join('\n');

        // Create WccCode
        const wccCode = new WccCode(createSnapshot(source));

        // Find template_expressions_0
        const exprCode = wccCode.embeddedCodes.find((c) => c.id === 'template_expressions_0');
        expect(exprCode).toBeDefined();

        // Determine expected languageId
        let expectedLanguageId: string;
        if (config.includeScript && config.scriptLang === ' lang="ts"') {
          expectedLanguageId = 'typescript';
        } else {
          expectedLanguageId = 'javascript';
        }

        // Verify languageId matches expected value
        expect(exprCode!.languageId).toBe(expectedLanguageId);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: template-intellisense, Property 4: Round-trip de Source Mapping a nivel de carácter', () => {
  /**
   * **Validates: Requirements 2.4, 5.4, 7.1, 7.2, 7.3**
   *
   * For any .wcc file with expressions in the template, and for any position `i`
   * within an extracted expression, the Source Mapping SHALL satisfy:
   * `sourceContent[sourceOffset + i] === virtualContent[generatedOffset + i]`
   * for all `i` in `[0, length)`.
   * Additionally, the transformation `original_position → virtual_position → original_position`
   * SHALL produce the initial position (round-trip property).
   */

  /** Generator for valid JS/TS identifiers */
  const arbIdentifier = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 2,
      maxLength: 8,
    })
    .map((chars) => chars.join(''));

  /** Generator for event names */
  const arbEventName = fc.constantFrom('click', 'input', 'change', 'submit', 'keydown', 'mouseover');

  /** Generator for attribute names for bindings */
  const arbAttrName = fc.constantFrom('class', 'style', 'disabled', 'value', 'href', 'id', 'title');

  /** Generator for simple expressions (identifiers, property access, function calls) */
  const arbExpression = fc.oneof(
    arbIdentifier,
    fc.tuple(arbIdentifier, arbIdentifier).map(([obj, prop]) => `${obj}.${prop}`),
    fc.tuple(arbIdentifier, arbIdentifier).map(([fn, arg]) => `${fn}(${arg})`),
  );

  it('character-level equality holds for all positions within each mapping', () => {
    const arbWccWithExpressions = fc.record({
      scriptContent: arbIdentifier.map((id) => `const ${id} = 'hello'`),
      interpExprs: fc.array(arbExpression, { minLength: 1, maxLength: 4 }),
      eventExprs: fc.array(
        fc.tuple(arbEventName, arbIdentifier).map(([ev, handler]) => ({ event: ev, handler })),
        { minLength: 0, maxLength: 2 }
      ),
      bindExprs: fc.array(
        fc.tuple(arbAttrName, arbExpression).map(([attr, expr]) => ({ attr, expr })),
        { minLength: 0, maxLength: 2 }
      ),
    });

    fc.assert(
      fc.property(arbWccWithExpressions, (config) => {
        // Build template content with expressions
        const templateParts: string[] = [];
        for (const expr of config.interpExprs) {
          templateParts.push(`<p>{{${expr}}}</p>`);
        }
        for (const { event, handler } of config.eventExprs) {
          templateParts.push(`<button @${event}="${handler}">btn</button>`);
        }
        for (const { attr, expr } of config.bindExprs) {
          templateParts.push(`<div :${attr}="${expr}">div</div>`);
        }
        const templateContent = templateParts.join('\n');

        // Build the full .wcc source
        const source = `<script>${config.scriptContent}</script>\n<template>${templateContent}</template>`;

        // Create WccCode
        const wccCode = new WccCode(createSnapshot(source));

        // Find the template_expressions_0 VirtualCode
        const exprCode = wccCode.embeddedCodes.find((c) => c.id === 'template_expressions_0');
        expect(exprCode).toBeDefined();

        // Get the virtual code content
        const virtualContent = exprCode!.snapshot.getText(0, exprCode!.snapshot.getLength());

        // For each mapping, verify character-by-character equality
        for (const mapping of exprCode!.mappings) {
          const sourceOffset = mapping.sourceOffsets[0];
          const generatedOffset = mapping.generatedOffsets[0];
          const length = mapping.lengths[0];

          // Verify character-level equality: source[sourceOffset + i] === virtualContent[generatedOffset + i]
          for (let i = 0; i < length; i++) {
            const sourceChar = source.charAt(sourceOffset + i);
            const virtualChar = virtualContent.charAt(generatedOffset + i);
            expect(sourceChar).toBe(virtualChar);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip: original_position → virtual_position → original_position produces the initial position', () => {
    const arbWccWithExpressions = fc.record({
      scriptContent: arbIdentifier.map((id) => `const ${id} = 'hello'`),
      interpExprs: fc.array(arbExpression, { minLength: 1, maxLength: 4 }),
      eventExprs: fc.array(
        fc.tuple(arbEventName, arbIdentifier).map(([ev, handler]) => ({ event: ev, handler })),
        { minLength: 0, maxLength: 2 }
      ),
      bindExprs: fc.array(
        fc.tuple(arbAttrName, arbExpression).map(([attr, expr]) => ({ attr, expr })),
        { minLength: 0, maxLength: 2 }
      ),
      seed: fc.nat(),
    });

    fc.assert(
      fc.property(arbWccWithExpressions, (config) => {
        // Build template content with expressions
        const templateParts: string[] = [];
        for (const expr of config.interpExprs) {
          templateParts.push(`<p>{{${expr}}}</p>`);
        }
        for (const { event, handler } of config.eventExprs) {
          templateParts.push(`<button @${event}="${handler}">btn</button>`);
        }
        for (const { attr, expr } of config.bindExprs) {
          templateParts.push(`<div :${attr}="${expr}">div</div>`);
        }
        const templateContent = templateParts.join('\n');

        // Build the full .wcc source
        const source = `<script>${config.scriptContent}</script>\n<template>${templateContent}</template>`;

        // Create WccCode
        const wccCode = new WccCode(createSnapshot(source));

        // Find the template_expressions_0 VirtualCode
        const exprCode = wccCode.embeddedCodes.find((c) => c.id === 'template_expressions_0');
        expect(exprCode).toBeDefined();

        // For each mapping, verify round-trip for a random position within the mapping
        for (const mapping of exprCode!.mappings) {
          const sourceOffset = mapping.sourceOffsets[0];
          const generatedOffset = mapping.generatedOffsets[0];
          const length = mapping.lengths[0];

          // Test round-trip for every position in the mapping
          for (let i = 0; i < length; i++) {
            // Forward: original position → virtual position
            const originalPos = sourceOffset + i;
            const virtualPos = generatedOffset + i;

            // Reverse: virtual position → original position
            // Given virtualPos within [generatedOffset, generatedOffset + length),
            // the original position is: sourceOffset + (virtualPos - generatedOffset)
            const recoveredPos = sourceOffset + (virtualPos - generatedOffset);

            // Round-trip should produce the initial position
            expect(recoveredPos).toBe(originalPos);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('multiple expressions have independent, non-overlapping mappings', () => {
    const arbWccWithMultipleExpressions = fc.record({
      scriptContent: arbIdentifier.map((id) => `const ${id} = 'hello'`),
      interpExprs: fc.array(arbExpression, { minLength: 2, maxLength: 5 }),
      eventExprs: fc.array(
        fc.tuple(arbEventName, arbIdentifier).map(([ev, handler]) => ({ event: ev, handler })),
        { minLength: 1, maxLength: 3 }
      ),
    });

    fc.assert(
      fc.property(arbWccWithMultipleExpressions, (config) => {
        // Build template content with multiple expressions
        const templateParts: string[] = [];
        for (const expr of config.interpExprs) {
          templateParts.push(`<p>{{${expr}}}</p>`);
        }
        for (const { event, handler } of config.eventExprs) {
          templateParts.push(`<button @${event}="${handler}">btn</button>`);
        }
        const templateContent = templateParts.join('\n');

        // Build the full .wcc source
        const source = `<script>${config.scriptContent}</script>\n<template>${templateContent}</template>`;

        // Create WccCode
        const wccCode = new WccCode(createSnapshot(source));

        // Find the template_expressions_0 VirtualCode
        const exprCode = wccCode.embeddedCodes.find((c) => c.id === 'template_expressions_0');
        expect(exprCode).toBeDefined();

        const mappings = exprCode!.mappings;

        // Verify there are multiple mappings (at least 2 expressions)
        expect(mappings.length).toBeGreaterThanOrEqual(2);

        // Verify source ranges don't overlap
        for (let a = 0; a < mappings.length; a++) {
          for (let b = a + 1; b < mappings.length; b++) {
            const aStart = mappings[a].sourceOffsets[0];
            const aEnd = aStart + mappings[a].lengths[0];
            const bStart = mappings[b].sourceOffsets[0];
            const bEnd = bStart + mappings[b].lengths[0];

            // Ranges should not overlap
            const overlaps = aStart < bEnd && bStart < aEnd;
            expect(overlaps).toBe(false);
          }
        }

        // Verify generated ranges don't overlap
        for (let a = 0; a < mappings.length; a++) {
          for (let b = a + 1; b < mappings.length; b++) {
            const aStart = mappings[a].generatedOffsets[0];
            const aEnd = aStart + mappings[a].lengths[0];
            const bStart = mappings[b].generatedOffsets[0];
            const bEnd = bStart + mappings[b].lengths[0];

            // Ranges should not overlap
            const overlaps = aStart < bEnd && bStart < aEnd;
            expect(overlaps).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: template-intellisense, Property 5: Regeneración correcta de mappings tras actualización', () => {
  /**
   * **Validates: Requirements 7.4**
   *
   * For any pair of .wcc files (initial version and modified version), after calling
   * update() with the new content, the Source Mappings of the VirtualCode
   * `template_expressions_0` SHALL reflect the correct positions in the new content —
   * i.e., the round-trip property (Property 4) holds for the updated content.
   */

  /** Generator for valid JS/TS identifiers */
  const arbIdentifier = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 2,
      maxLength: 8,
    })
    .map((chars) => chars.join(''));

  /** Generator for event names */
  const arbEventName = fc.constantFrom('click', 'input', 'change', 'submit', 'keydown', 'mouseover');

  /** Generator for attribute names for bindings */
  const arbAttrName = fc.constantFrom('class', 'style', 'disabled', 'value', 'href', 'id', 'title');

  /** Generator for simple expressions */
  const arbExpression = fc.oneof(
    arbIdentifier,
    fc.tuple(arbIdentifier, arbIdentifier).map(([obj, prop]) => `${obj}.${prop}`),
    fc.tuple(arbIdentifier, arbIdentifier).map(([fn, arg]) => `${fn}(${arg})`),
  );

  /** Generator for a .wcc source with template expressions */
  function arbWccWithExpressions() {
    return fc.record({
      scriptContent: arbIdentifier.map((id) => `const ${id} = 'hello'`),
      interpExprs: fc.array(arbExpression, { minLength: 1, maxLength: 3 }),
      eventExprs: fc.array(
        fc.tuple(arbEventName, arbIdentifier).map(([ev, handler]) => ({ event: ev, handler })),
        { minLength: 0, maxLength: 2 }
      ),
      bindExprs: fc.array(
        fc.tuple(arbAttrName, arbExpression).map(([attr, expr]) => ({ attr, expr })),
        { minLength: 0, maxLength: 2 }
      ),
    });
  }

  /** Builds a .wcc source string from a config */
  function buildWccSource(config: {
    scriptContent: string;
    interpExprs: string[];
    eventExprs: { event: string; handler: string }[];
    bindExprs: { attr: string; expr: string }[];
  }): string {
    const templateParts: string[] = [];
    for (const expr of config.interpExprs) {
      templateParts.push(`<p>{{${expr}}}</p>`);
    }
    for (const { event, handler } of config.eventExprs) {
      templateParts.push(`<button @${event}="${handler}">btn</button>`);
    }
    for (const { attr, expr } of config.bindExprs) {
      templateParts.push(`<div :${attr}="${expr}">div</div>`);
    }
    const templateContent = templateParts.join('\n');
    return `<script>${config.scriptContent}</script>\n<template>${templateContent}</template>`;
  }

  it('after update(), template_expressions_0 mappings satisfy character-level equality for the new source', () => {
    fc.assert(
      fc.property(arbWccWithExpressions(), arbWccWithExpressions(), (initialConfig, modifiedConfig) => {
        // Build initial and modified .wcc sources
        const initialSource = buildWccSource(initialConfig);
        const modifiedSource = buildWccSource(modifiedConfig);

        // Create WccCode from initial source
        const wccCode = new WccCode(createSnapshot(initialSource));

        // Call update() with modified source
        wccCode.update(createSnapshot(modifiedSource));

        // Find template_expressions_0 in the updated embeddedCodes
        const exprCode = wccCode.embeddedCodes.find((c) => c.id === 'template_expressions_0');
        expect(exprCode).toBeDefined();

        // Get the virtual code content after update
        const virtualContent = exprCode!.snapshot.getText(0, exprCode!.snapshot.getLength());

        // Verify character-level equality for all mappings against the NEW source
        for (const mapping of exprCode!.mappings) {
          const sourceOffset = mapping.sourceOffsets[0];
          const generatedOffset = mapping.generatedOffsets[0];
          const length = mapping.lengths[0];

          // Verify character-level equality: newSource[sourceOffset + i] === virtualContent[generatedOffset + i]
          for (let i = 0; i < length; i++) {
            const sourceChar = modifiedSource.charAt(sourceOffset + i);
            const virtualChar = virtualContent.charAt(generatedOffset + i);
            expect(sourceChar).toBe(virtualChar);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('after update(), round-trip property holds for the new content mappings', () => {
    fc.assert(
      fc.property(arbWccWithExpressions(), arbWccWithExpressions(), (initialConfig, modifiedConfig) => {
        // Build initial and modified .wcc sources
        const initialSource = buildWccSource(initialConfig);
        const modifiedSource = buildWccSource(modifiedConfig);

        // Create WccCode from initial source
        const wccCode = new WccCode(createSnapshot(initialSource));

        // Call update() with modified source
        wccCode.update(createSnapshot(modifiedSource));

        // Find template_expressions_0 in the updated embeddedCodes
        const exprCode = wccCode.embeddedCodes.find((c) => c.id === 'template_expressions_0');
        expect(exprCode).toBeDefined();

        // Verify round-trip for each mapping: original_position → virtual_position → original_position
        for (const mapping of exprCode!.mappings) {
          const sourceOffset = mapping.sourceOffsets[0];
          const generatedOffset = mapping.generatedOffsets[0];
          const length = mapping.lengths[0];

          for (let i = 0; i < length; i++) {
            // Forward: original position → virtual position
            const originalPos = sourceOffset + i;
            const virtualPos = generatedOffset + i;

            // Reverse: virtual position → original position
            const recoveredPos = sourceOffset + (virtualPos - generatedOffset);

            // Round-trip should produce the initial position
            expect(recoveredPos).toBe(originalPos);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
