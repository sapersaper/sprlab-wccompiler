import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseWccBlocks } from './wccParser';

/**
 * Property-Based Tests for wccParser.ts
 *
 * Feature: volar-language-server, Property 3: Tolerancia a bloques ausentes
 * Validates: Requirements 2.6
 */

/**
 * Generator for block content that avoids closing tags within the content.
 * This ensures the generated content won't confuse the parser.
 */
function safeBlockContent(blockName: 'script' | 'template' | 'style'): fc.Arbitrary<string> {
  return fc.string({ minLength: 0, maxLength: 200 }).map((s) => {
    // Remove any occurrence of the closing tag from generated content
    const closeTag = `</${blockName}>`;
    return s.replaceAll(closeTag, '');
  });
}

/**
 * Builds a .wcc file string from the given subset of blocks with their content.
 */
function buildWccFile(blocks: Array<{ name: 'script' | 'template' | 'style'; content: string }>): string {
  return blocks
    .map(({ name, content }) => `<${name}>${content}</${name}>`)
    .join('\n');
}

describe('Feature: volar-language-server, Property 3: Tolerancia a bloques ausentes', () => {
  /**
   * **Validates: Requirements 2.6**
   *
   * For any subset of blocks (script, template, style), parseWccBlocks:
   * - Returns null for absent blocks without throwing errors
   * - Returns correct results for present blocks
   */
  it('parseWccBlocks returns null for absent blocks and valid results for present blocks', () => {
    const blockNames: Array<'script' | 'template' | 'style'> = ['script', 'template', 'style'];

    const arbSubsetWithContent = fc
      .subarray(blockNames, { minLength: 0, maxLength: 3 })
      .chain((subset) => {
        // For each block in the subset, generate safe content
        const contentArbs = subset.map((name) =>
          safeBlockContent(name).map((content) => ({ name, content }))
        );
        return contentArbs.length === 0
          ? fc.constant({ subset, blocks: [] as Array<{ name: 'script' | 'template' | 'style'; content: string }> })
          : fc.tuple(...contentArbs).map((blocks) => ({ subset, blocks }));
      });

    fc.assert(
      fc.property(arbSubsetWithContent, ({ subset, blocks }) => {
        const source = buildWccFile(blocks);

        // Should never throw
        const result = parseWccBlocks(source);

        // Verify absent blocks are null
        for (const name of blockNames) {
          if (!subset.includes(name)) {
            expect(result[name]).toBeNull();
          }
        }

        // Verify present blocks are not null and have correct type
        for (const block of blocks) {
          const parsed = result[block.name];
          expect(parsed).not.toBeNull();
          expect(parsed!.type).toBe(block.name);
          expect(parsed!.content).toBe(block.content);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * parseWccBlocks never throws an error regardless of input,
   * and always returns an object with script, template, style fields.
   */
  it('parseWccBlocks never throws for any input string', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 500 }), (source) => {
        // Should never throw
        const result = parseWccBlocks(source);

        // Result always has the expected shape
        expect(result).toHaveProperty('script');
        expect(result).toHaveProperty('template');
        expect(result).toHaveProperty('style');

        // Each field is either null or a valid WccBlock
        for (const name of ['script', 'template', 'style'] as const) {
          const block = result[name];
          if (block !== null) {
            expect(block.type).toBe(name);
            expect(typeof block.content).toBe('string');
            expect(typeof block.startOffset).toBe('number');
            expect(typeof block.endOffset).toBe('number');
            expect(typeof block.attrs).toBe('string');
            expect(block.startOffset).toBeLessThanOrEqual(block.endOffset);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property-Based Tests for wccParser.ts
 *
 * Feature: volar-language-server, Property 5: Extracción correcta de contenido
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

describe('Feature: volar-language-server, Property 5: Extracción correcta de contenido', () => {
  /**
   * Generator for block content that avoids closing tags within the content.
   */
  function safeContent(blockName: 'script' | 'template' | 'style'): fc.Arbitrary<string> {
    return fc.string({ minLength: 1, maxLength: 300 }).map((s) => {
      const closeTag = `</${blockName}>`;
      return s.replaceAll(closeTag, '');
    });
  }

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
   *
   * For any .wcc file with all three blocks present and random content:
   * - block.content equals the original generated content for that block
   * - source.slice(block.startOffset, block.endOffset) === block.content
   * - block.startOffset and block.endOffset are within valid range
   */
  it('block.content matches the text between opening and closing tags, and offsets are consistent with source', () => {
    const arbWccFile = fc.record({
      scriptContent: safeContent('script'),
      templateContent: safeContent('template'),
      styleContent: safeContent('style'),
    });

    fc.assert(
      fc.property(arbWccFile, ({ scriptContent, templateContent, styleContent }) => {
        const source = `<script>${scriptContent}</script>\n<template>${templateContent}</template>\n<style>${styleContent}</style>`;

        const result = parseWccBlocks(source);

        // All blocks should be present
        expect(result.script).not.toBeNull();
        expect(result.template).not.toBeNull();
        expect(result.style).not.toBeNull();

        // Script block
        expect(result.script!.content).toBe(scriptContent);
        expect(source.slice(result.script!.startOffset, result.script!.endOffset)).toBe(result.script!.content);
        expect(result.script!.startOffset).toBeGreaterThanOrEqual(0);
        expect(result.script!.endOffset).toBeLessThanOrEqual(source.length);

        // Template block
        expect(result.template!.content).toBe(templateContent);
        expect(source.slice(result.template!.startOffset, result.template!.endOffset)).toBe(result.template!.content);
        expect(result.template!.startOffset).toBeGreaterThanOrEqual(0);
        expect(result.template!.endOffset).toBeLessThanOrEqual(source.length);

        // Style block
        expect(result.style!.content).toBe(styleContent);
        expect(source.slice(result.style!.startOffset, result.style!.endOffset)).toBe(result.style!.content);
        expect(result.style!.startOffset).toBeGreaterThanOrEqual(0);
        expect(result.style!.endOffset).toBeLessThanOrEqual(source.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
   *
   * Content extraction works correctly when script has lang attributes (lang="ts" or lang="js").
   * The content should still be exactly the text between the opening and closing tags.
   */
  it('content extraction works correctly with script lang attributes', () => {
    const arbLang = fc.constantFrom(' lang="ts"', ' lang="js"', '');

    const arbWccFileWithLang = fc.record({
      scriptContent: safeContent('script'),
      templateContent: safeContent('template'),
      styleContent: safeContent('style'),
      lang: arbLang,
    });

    fc.assert(
      fc.property(arbWccFileWithLang, ({ scriptContent, templateContent, styleContent, lang }) => {
        const source = `<script${lang}>${scriptContent}</script>\n<template>${templateContent}</template>\n<style>${styleContent}</style>`;

        const result = parseWccBlocks(source);

        // All blocks should be present
        expect(result.script).not.toBeNull();
        expect(result.template).not.toBeNull();
        expect(result.style).not.toBeNull();

        // Script block content is correct regardless of lang attribute
        expect(result.script!.content).toBe(scriptContent);
        expect(source.slice(result.script!.startOffset, result.script!.endOffset)).toBe(result.script!.content);
        expect(result.script!.startOffset).toBeGreaterThanOrEqual(0);
        expect(result.script!.endOffset).toBeLessThanOrEqual(source.length);

        // Template block
        expect(result.template!.content).toBe(templateContent);
        expect(source.slice(result.template!.startOffset, result.template!.endOffset)).toBe(result.template!.content);
        expect(result.template!.startOffset).toBeGreaterThanOrEqual(0);
        expect(result.template!.endOffset).toBeLessThanOrEqual(source.length);

        // Style block
        expect(result.style!.content).toBe(styleContent);
        expect(source.slice(result.style!.startOffset, result.style!.endOffset)).toBe(result.style!.content);
        expect(result.style!.startOffset).toBeGreaterThanOrEqual(0);
        expect(result.style!.endOffset).toBeLessThanOrEqual(source.length);
      }),
      { numRuns: 100 }
    );
  });
});
