/**
 * Property-based tests for the SFC parser (sfc-parser.js).
 *
 * Feature: single-file-components, Property 1: Round-trip del SFC
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSFC, printSFC } from './sfc-parser.js';

// ── Generators ──────────────────────────────────────────────────────

/**
 * Arbitrary string that does NOT contain any SFC block open/close tags.
 * This avoids breaking the block extraction regex.
 */
const arbSafeContent = fc
  .string({ minLength: 0, maxLength: 80 })
  .filter(
    (s) =>
      !s.includes('</script>') &&
      !s.includes('</template>') &&
      !s.includes('</style>') &&
      !s.includes('<script') &&
      !s.includes('<template') &&
      !s.includes('<style')
  );

/** Generate a valid kebab-case tag name like 'x-abc' */
const arbTagName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{1,6}$/),
    fc.stringMatching(/^[a-z]{1,6}$/)
  )
  .map(([a, b]) => `x-${a}${b}`);

/** Generate lang: 'ts' | 'js' */
const arbLang = fc.constantFrom('ts', 'js');

/**
 * Generate a valid script body that includes defineComponent({ tag: '...' }).
 * Wraps arbitrary safe content around the defineComponent call.
 */
const arbScriptBody = fc
  .tuple(arbSafeContent, arbTagName, arbSafeContent)
  .map(
    ([before, tag, after]) =>
      `${before}\ndefineComponent({ tag: '${tag}' })\n${after}`
  );

/** Generate arbitrary safe template content */
const arbTemplateContent = arbSafeContent;

/** Generate arbitrary safe style content (can be empty) */
const arbStyleContent = arbSafeContent;

/**
 * Assemble an SFC string from its parts.
 */
function assembleSFC(scriptBody, templateContent, styleContent, lang) {
  const langAttr = lang === 'ts' ? ' lang="ts"' : '';
  let sfc = `<script${langAttr}>${scriptBody}</script>\n\n`;
  sfc += `<template>${templateContent}</template>`;
  if (styleContent.length > 0) {
    sfc += `\n\n<style>${styleContent}</style>`;
  }
  return sfc;
}

// ── Property 1: Round-trip del SFC (parse → print → parse) ─────────

/**
 * Validates: Requirements 1.1, 1.2, 1.5, 1.6, 1.7, 10.1, 10.2, 10.3, 10.4
 */
describe('Property 1: Round-trip del SFC (parse → print → parse)', () => {
  it('parseSFC → printSFC → parseSFC produces equivalent descriptors', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbTemplateContent,
        arbStyleContent,
        arbLang,
        (scriptBody, templateContent, styleContent, lang) => {
          // Assemble a valid SFC
          const sfcSource = assembleSFC(
            scriptBody,
            templateContent,
            styleContent,
            lang
          );

          // First parse
          const descriptor1 = parseSFC(sfcSource, 'test.wcc');

          // Print
          const printed = printSFC(descriptor1);

          // Second parse
          const descriptor2 = parseSFC(printed, 'test.wcc');

          // Verify equivalence of all fields
          expect(descriptor2.script).toBe(descriptor1.script);
          expect(descriptor2.template).toBe(descriptor1.template);
          expect(descriptor2.style).toBe(descriptor1.style);
          expect(descriptor2.lang).toBe(descriptor1.lang);
          expect(descriptor2.tag).toBe(descriptor1.tag);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 2: Independencia del orden de bloques ──────────────────

/**
 * Feature: single-file-components, Property 2: Independencia del orden de bloques
 *
 * Validates: Requirement 1.3
 *
 * For all sets of contents (script, template, style) and for all permutations
 * of block order, parseSFC SHALL produce an SFCDescriptor with identical fields
 * regardless of order.
 */
describe('Property 2: Independencia del orden de bloques', () => {
  /**
   * Build a single SFC block string.
   * @param {'script'|'template'|'style'} type
   * @param {string} content
   * @param {string} lang — only used for script blocks
   * @returns {string}
   */
  function buildBlock(type, content, lang) {
    if (type === 'script') {
      const langAttr = lang === 'ts' ? ' lang="ts"' : '';
      return `<script${langAttr}>${content}</script>`;
    }
    if (type === 'template') {
      return `<template>${content}</template>`;
    }
    return `<style>${content}</style>`;
  }

  /**
   * All 6 permutations of three elements.
   */
  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(rest)) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }

  it('parseSFC produces identical descriptors for all 6 permutations of block order', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbTemplateContent,
        arbStyleContent,
        arbLang,
        (scriptBody, templateContent, styleContent, lang) => {
          // Build individual blocks
          const blocks = {
            script: buildBlock('script', scriptBody, lang),
            template: buildBlock('template', templateContent, lang),
            style: buildBlock('style', styleContent, lang),
          };

          const blockOrder = ['script', 'template', 'style'];
          const allPerms = permutations(blockOrder);

          // Parse the first permutation as reference
          const refSource = allPerms[0].map((b) => blocks[b]).join('\n\n');
          const refDescriptor = parseSFC(refSource, 'test.wcc');

          // Parse all remaining permutations and compare
          for (let i = 1; i < allPerms.length; i++) {
            const source = allPerms[i].map((b) => blocks[b]).join('\n\n');
            const descriptor = parseSFC(source, 'test.wcc');

            expect(descriptor.script).toBe(refDescriptor.script);
            expect(descriptor.template).toBe(refDescriptor.template);
            expect(descriptor.style).toBe(refDescriptor.style);
            expect(descriptor.lang).toBe(refDescriptor.lang);
            expect(descriptor.tag).toBe(refDescriptor.tag);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 3: Detección correcta de lenguaje ─────────────────────

/**
 * Feature: single-file-components, Property 3: Detección correcta de lenguaje
 *
 * Validates: Requirements 1.4, 1.5
 *
 * For all script blocks with attribute lang="ts", parseSFC SHALL return
 * lang: 'ts'; and for all script blocks without a lang attribute, parseSFC
 * SHALL return lang: 'js'.
 */
describe('Property 3: Detección correcta de lenguaje', () => {
  it('parseSFC returns lang "ts" when <script lang="ts"> is used', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbTemplateContent,
        arbStyleContent,
        (scriptBody, templateContent, styleContent) => {
          const sfcSource = assembleSFC(
            scriptBody,
            templateContent,
            styleContent,
            'ts'
          );

          const descriptor = parseSFC(sfcSource, 'test.wcc');

          expect(descriptor.lang).toBe('ts');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseSFC returns lang "js" when <script> has no lang attribute', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbTemplateContent,
        arbStyleContent,
        (scriptBody, templateContent, styleContent) => {
          const sfcSource = assembleSFC(
            scriptBody,
            templateContent,
            styleContent,
            'js'
          );

          const descriptor = parseSFC(sfcSource, 'test.wcc');

          expect(descriptor.lang).toBe('js');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 4: Error en bloques requeridos ausentes ────────────────

/**
 * Feature: single-file-components, Property 4: Error en bloques requeridos ausentes
 *
 * Validates: Requirements 2.1, 2.2
 *
 * For all SFC strings missing a <template> block, parseSFC SHALL throw an error
 * with code SFC_MISSING_TEMPLATE; and for all SFC strings missing a <script>
 * block, parseSFC SHALL throw an error with code SFC_MISSING_SCRIPT.
 */
describe('Property 4: Error en bloques requeridos ausentes', () => {
  it('parseSFC throws SFC_MISSING_TEMPLATE when <template> is absent', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbStyleContent,
        arbLang,
        (scriptBody, styleContent, lang) => {
          // Build SFC with only <script> (and optionally <style>), no <template>
          const langAttr = lang === 'ts' ? ' lang="ts"' : '';
          let sfc = `<script${langAttr}>${scriptBody}</script>`;
          if (styleContent.length > 0) {
            sfc += `\n\n<style>${styleContent}</style>`;
          }

          try {
            parseSFC(sfc, 'test.wcc');
            // Should not reach here
            return false;
          } catch (e) {
            return e.code === 'SFC_MISSING_TEMPLATE';
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseSFC throws SFC_MISSING_SCRIPT when <script> is absent', () => {
    fc.assert(
      fc.property(
        arbTemplateContent,
        arbStyleContent,
        (templateContent, styleContent) => {
          // Build SFC with only <template> (and optionally <style>), no <script>
          let sfc = `<template>${templateContent}</template>`;
          if (styleContent.length > 0) {
            sfc += `\n\n<style>${styleContent}</style>`;
          }

          try {
            parseSFC(sfc, 'test.wcc');
            return false;
          } catch (e) {
            return e.code === 'SFC_MISSING_SCRIPT';
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 5: Error en bloques duplicados ─────────────────────────

/**
 * Feature: single-file-components, Property 5: Error en bloques duplicados
 *
 * Validates: Requirements 2.3, 2.4, 2.5
 *
 * For all SFC strings containing more than one block of the same type
 * (script, template, or style), parseSFC SHALL throw an error with code
 * SFC_DUPLICATE_BLOCK.
 */
describe('Property 5: Error en bloques duplicados', () => {
  it('parseSFC throws SFC_DUPLICATE_BLOCK for duplicate <script> blocks', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbScriptBody,
        arbTemplateContent,
        arbLang,
        (scriptBody1, scriptBody2, templateContent, lang) => {
          const langAttr = lang === 'ts' ? ' lang="ts"' : '';
          const sfc = [
            `<script${langAttr}>${scriptBody1}</script>`,
            `<script${langAttr}>${scriptBody2}</script>`,
            `<template>${templateContent}</template>`,
          ].join('\n\n');

          try {
            parseSFC(sfc, 'test.wcc');
            return false;
          } catch (e) {
            return e.code === 'SFC_DUPLICATE_BLOCK';
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseSFC throws SFC_DUPLICATE_BLOCK for duplicate <template> blocks', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbTemplateContent,
        arbTemplateContent,
        arbLang,
        (scriptBody, templateContent1, templateContent2, lang) => {
          const langAttr = lang === 'ts' ? ' lang="ts"' : '';
          const sfc = [
            `<script${langAttr}>${scriptBody}</script>`,
            `<template>${templateContent1}</template>`,
            `<template>${templateContent2}</template>`,
          ].join('\n\n');

          try {
            parseSFC(sfc, 'test.wcc');
            return false;
          } catch (e) {
            return e.code === 'SFC_DUPLICATE_BLOCK';
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseSFC throws SFC_DUPLICATE_BLOCK for duplicate <style> blocks', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbTemplateContent,
        arbStyleContent,
        arbStyleContent,
        arbLang,
        (scriptBody, templateContent, styleContent1, styleContent2, lang) => {
          const langAttr = lang === 'ts' ? ' lang="ts"' : '';
          const sfc = [
            `<script${langAttr}>${scriptBody}</script>`,
            `<template>${templateContent}</template>`,
            `<style>${styleContent1}</style>`,
            `<style>${styleContent2}</style>`,
          ].join('\n\n');

          try {
            parseSFC(sfc, 'test.wcc');
            return false;
          } catch (e) {
            return e.code === 'SFC_DUPLICATE_BLOCK';
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 6: Error en contenido inesperado ───────────────────────

/**
 * Feature: single-file-components, Property 6: Error en contenido inesperado
 *
 * Validates: Requirement 2.6
 *
 * For all SFC strings that contain non-whitespace text outside of recognized
 * blocks (<script>, <template>, <style>), parseSFC SHALL throw an error with
 * code SFC_UNEXPECTED_CONTENT.
 */
describe('Property 6: Error en contenido inesperado', () => {
  /** Generate a non-empty, non-whitespace string that won't be mistaken for a block tag */
  const arbJunkContent = fc
    .stringMatching(/^[a-zA-Z0-9]{1,20}$/)
    .filter((s) => s.trim().length > 0);

  /** Position where junk content is inserted */
  const arbPosition = fc.constantFrom('before', 'between', 'after');

  it('parseSFC throws SFC_UNEXPECTED_CONTENT when non-whitespace text exists outside blocks', () => {
    fc.assert(
      fc.property(
        arbScriptBody,
        arbTemplateContent,
        arbStyleContent,
        arbLang,
        arbJunkContent,
        arbPosition,
        (scriptBody, templateContent, styleContent, lang, junk, position) => {
          const langAttr = lang === 'ts' ? ' lang="ts"' : '';
          const scriptBlock = `<script${langAttr}>${scriptBody}</script>`;
          const templateBlock = `<template>${templateContent}</template>`;
          const styleBlock =
            styleContent.length > 0
              ? `<style>${styleContent}</style>`
              : '';

          let sfc;
          if (position === 'before') {
            sfc = `${junk}\n${scriptBlock}\n\n${templateBlock}`;
            if (styleBlock) sfc += `\n\n${styleBlock}`;
          } else if (position === 'between') {
            sfc = `${scriptBlock}\n${junk}\n${templateBlock}`;
            if (styleBlock) sfc += `\n\n${styleBlock}`;
          } else {
            // after
            sfc = `${scriptBlock}\n\n${templateBlock}`;
            if (styleBlock) sfc += `\n\n${styleBlock}`;
            sfc += `\n${junk}`;
          }

          try {
            parseSFC(sfc, 'test.wcc');
            return false;
          } catch (e) {
            return e.code === 'SFC_UNEXPECTED_CONTENT';
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 7: Error en rutas inline en modo SFC ───────────────────

/**
 * Feature: single-file-components, Property 7: Error en rutas inline en modo SFC
 *
 * Validates: Requirement 3.2
 *
 * For all <script> blocks in an SFC that contain defineComponent() with a
 * `template` or `styles` field, parseSFC SHALL throw an error with code
 * SFC_INLINE_PATHS_FORBIDDEN.
 */
describe('Property 7: Error en rutas inline en modo SFC', () => {
  /** Generate a defineComponent body that includes a forbidden `template` field */
  const arbScriptWithTemplate = fc
    .tuple(arbTagName, arbSafeContent)
    .map(
      ([tag, extra]) =>
        `${extra}\ndefineComponent({ tag: '${tag}', template: './my.html' })\n`
    );

  /** Generate a defineComponent body that includes a forbidden `styles` field */
  const arbScriptWithStyles = fc
    .tuple(arbTagName, arbSafeContent)
    .map(
      ([tag, extra]) =>
        `${extra}\ndefineComponent({ tag: '${tag}', styles: ['./my.css'] })\n`
    );

  it('parseSFC throws SFC_INLINE_PATHS_FORBIDDEN when defineComponent has template field', () => {
    fc.assert(
      fc.property(
        arbScriptWithTemplate,
        arbTemplateContent,
        arbStyleContent,
        arbLang,
        (scriptBody, templateContent, styleContent, lang) => {
          const sfc = assembleSFC(scriptBody, templateContent, styleContent, lang);

          try {
            parseSFC(sfc, 'test.wcc');
            return false;
          } catch (e) {
            return e.code === 'SFC_INLINE_PATHS_FORBIDDEN';
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseSFC throws SFC_INLINE_PATHS_FORBIDDEN when defineComponent has styles field', () => {
    fc.assert(
      fc.property(
        arbScriptWithStyles,
        arbTemplateContent,
        arbStyleContent,
        arbLang,
        (scriptBody, templateContent, styleContent, lang) => {
          const sfc = assembleSFC(scriptBody, templateContent, styleContent, lang);

          try {
            parseSFC(sfc, 'test.wcc');
            return false;
          } catch (e) {
            return e.code === 'SFC_INLINE_PATHS_FORBIDDEN';
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for parseSFC and printSFC ────────────────────────────

/**
 * Concrete unit tests (not property-based) for parseSFC and printSFC.
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 3.1, 3.2, 3.3, 10.1, 10.2, 10.3
 */
describe('Unit tests: parseSFC', () => {
  it('parses a basic SFC with 3 blocks and extracts known content', () => {
    const source = [
      '<script>',
      "defineComponent({ tag: 'x-hello' })",
      'const msg = "hi"',
      '</script>',
      '',
      '<template>',
      '<div>{{msg}}</div>',
      '</template>',
      '',
      '<style>',
      'div { color: red; }',
      '</style>',
    ].join('\n');

    const descriptor = parseSFC(source, 'hello.wcc');

    expect(descriptor.script).toBe(
      "\ndefineComponent({ tag: 'x-hello' })\nconst msg = \"hi\"\n"
    );
    expect(descriptor.template).toBe('\n<div>{{msg}}</div>\n');
    expect(descriptor.style).toBe('\ndiv { color: red; }\n');
    expect(descriptor.lang).toBe('js');
    expect(descriptor.tag).toBe('x-hello');
  });

  it('returns empty style when SFC has no <style> block', () => {
    const source = [
      "<script>defineComponent({ tag: 'x-no-style' })</script>",
      '<template><p>hello</p></template>',
    ].join('\n\n');

    const descriptor = parseSFC(source, 'no-style.wcc');

    expect(descriptor.style).toBe('');
    expect(descriptor.script).toContain('defineComponent');
    expect(descriptor.template).toBe('<p>hello</p>');
  });

  it('accepts <style scoped> without error', () => {
    const source = [
      "<script>defineComponent({ tag: 'x-scoped' })</script>",
      '<template><span>scoped</span></template>',
      '<style scoped>.a { color: blue; }</style>',
    ].join('\n\n');

    const descriptor = parseSFC(source, 'scoped.wcc');

    expect(descriptor.style).toBe('.a { color: blue; }');
    expect(descriptor.tag).toBe('x-scoped');
  });

  it('accepts defineComponent with only { tag } in SFC mode', () => {
    const source = [
      "<script>defineComponent({ tag: 'x-minimal' })</script>",
      '<template><div></div></template>',
    ].join('\n\n');

    const descriptor = parseSFC(source, 'minimal.wcc');

    expect(descriptor.tag).toBe('x-minimal');
    expect(descriptor.lang).toBe('js');
  });

  it('throws MISSING_DEFINE_COMPONENT when defineComponent() is absent', () => {
    const source = [
      '<script>const x = 1;</script>',
      '<template><div></div></template>',
    ].join('\n\n');

    expect(() => parseSFC(source, 'no-dc.wcc')).toThrow();
    try {
      parseSFC(source, 'no-dc.wcc');
    } catch (e) {
      expect(e.code).toBe('MISSING_DEFINE_COMPONENT');
    }
  });

  it('throws SFC_INLINE_PATHS_FORBIDDEN when defineComponent has template field', () => {
    const source = [
      "<script>defineComponent({ tag: 'x-bad', template: './t.html' })</script>",
      '<template><div></div></template>',
    ].join('\n\n');

    expect(() => parseSFC(source, 'inline-template.wcc')).toThrow();
    try {
      parseSFC(source, 'inline-template.wcc');
    } catch (e) {
      expect(e.code).toBe('SFC_INLINE_PATHS_FORBIDDEN');
    }
  });

  it('throws SFC_INLINE_PATHS_FORBIDDEN when defineComponent has styles field', () => {
    const source = [
      "<script>defineComponent({ tag: 'x-bad', styles: ['./s.css'] })</script>",
      '<template><div></div></template>',
    ].join('\n\n');

    expect(() => parseSFC(source, 'inline-styles.wcc')).toThrow();
    try {
      parseSFC(source, 'inline-styles.wcc');
    } catch (e) {
      expect(e.code).toBe('SFC_INLINE_PATHS_FORBIDDEN');
    }
  });
});

describe('Unit tests: printSFC', () => {
  it('omits <style> block when style is empty', () => {
    const descriptor = {
      script: "defineComponent({ tag: 'x-empty' })",
      template: '<div>hello</div>',
      style: '',
      lang: 'js',
      tag: 'x-empty',
    };

    const output = printSFC(descriptor);

    expect(output).toContain('<script>');
    expect(output).toContain('<template>');
    expect(output).not.toContain('<style>');
  });

  it('includes lang="ts" in <script> tag when lang is ts', () => {
    const descriptor = {
      script: "defineComponent({ tag: 'x-ts' })",
      template: '<div>typed</div>',
      style: 'div { color: green; }',
      lang: 'ts',
      tag: 'x-ts',
    };

    const output = printSFC(descriptor);

    expect(output).toContain('<script lang="ts">');
    expect(output).toContain("defineComponent({ tag: 'x-ts' })");
    expect(output).toContain('<template><div>typed</div></template>');
    expect(output).toContain('<style>div { color: green; }</style>');
  });
});
