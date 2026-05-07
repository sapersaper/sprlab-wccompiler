/**
 * SFC Parser — extracts <script>, <template> and <style> blocks from .wcc files.
 *
 * Pure ESM module with no Node.js dependencies (usable in browser and server).
 *
 * Two-phase algorithm:
 *   Phase 1: Block extraction via regex
 *   Phase 2: Validation (required blocks, duplicates, unexpected content, defineComponent)
 */

/**
 * @typedef {Object} SFCDescriptor
 * @property {string} script   — Content of the <script> block
 * @property {string} template — Content of the <template> block
 * @property {string} style    — Content of the <style> block ('' if absent)
 * @property {string} lang     — 'ts' | 'js'
 * @property {string} tag      — Tag name extracted from defineComponent({ tag })
 */

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Create an Error with a `.code` property (project convention).
 * @param {string} code
 * @param {string} message
 * @returns {Error}
 */
function sfcError(code, message) {
  const error = new Error(message);
  /** @ts-expect-error — custom error code for programmatic handling */
  error.code = code;
  return error;
}

// ── Phase 1: Block extraction ───────────────────────────────────────

/**
 * @typedef {Object} BlockMatch
 * @property {string} content  — Inner content between open and close tags
 * @property {string} attrs    — Attributes string from the opening tag
 * @property {number} start    — Start index of the opening tag in source
 * @property {number} end      — End index (after closing tag) in source
 */

/**
 * Find all occurrences of a given block type in the source.
 *
 * @param {string} source
 * @param {string} blockName — 'script' | 'template' | 'style'
 * @returns {BlockMatch[]}
 */
function findBlocks(source, blockName) {
  const openRe = new RegExp(`<${blockName}(\\s[^>]*)?>`, 'g');
  const closeTag = `</${blockName}>`;
  /** @type {BlockMatch[]} */
  const matches = [];
  let m;

  while ((m = openRe.exec(source)) !== null) {
    const attrs = m[1] || '';

    // For template blocks: skip <template #name> (slot content, not SFC block)
    if (blockName === 'template' && /#/.test(attrs)) {
      continue;
    }

    const openEnd = m.index + m[0].length;

    // Use depth counting to find the matching close tag (handles nested <template #name>)
    if (blockName === 'template') {
      let depth = 1;
      let searchPos = openEnd;
      let closeIdx = -1;
      const openTagRe = /<template[\s>]/g;
      const closeTagStr = '</template>';

      while (depth > 0 && searchPos < source.length) {
        const nextClose = source.indexOf(closeTagStr, searchPos);
        if (nextClose === -1) break;

        // Check for any opening <template> between searchPos and nextClose
        openTagRe.lastIndex = searchPos;
        let openMatch;
        while ((openMatch = openTagRe.exec(source)) !== null && openMatch.index < nextClose) {
          depth++;
        }

        depth--; // for the </template> we found
        if (depth === 0) {
          closeIdx = nextClose;
          break;
        }
        searchPos = nextClose + closeTagStr.length;
      }

      if (closeIdx === -1) continue;
      matches.push({
        content: source.slice(openEnd, closeIdx),
        attrs,
        start: m.index,
        end: closeIdx + closeTag.length,
      });
    } else {
      const closeIdx = source.indexOf(closeTag, openEnd);
      if (closeIdx === -1) continue;
      matches.push({
        content: source.slice(openEnd, closeIdx),
        attrs,
        start: m.index,
        end: closeIdx + closeTag.length,
      });
    }
  }

  return matches;
}

/**
 * Extract the `lang` attribute value from an attributes string.
 * Returns 'ts' if lang="ts", otherwise 'js'.
 *
 * @param {string} attrs
 * @returns {'ts' | 'js'}
 */
function extractLang(attrs) {
  const langMatch = attrs.match(/lang\s*=\s*["']([^"']+)["']/);
  return langMatch && langMatch[1] === 'ts' ? 'ts' : 'js';
}

// ── Phase 2: Validation ─────────────────────────────────────────────

/**
 * Extract the tag name from a defineComponent({ tag: '...' }) call.
 *
 * @param {string} script
 * @param {string} fileName
 * @returns {string}
 */
function extractTagFromDefineComponent(script, fileName) {
  const dcMatch = script.match(/defineComponent\(\s*\{([^}]*)\}\s*\)/);
  if (!dcMatch) {
    throw sfcError(
      'MISSING_DEFINE_COMPONENT',
      `Error en '${fileName}': defineComponent() es obligatorio`
    );
  }

  const body = dcMatch[1];

  // Reject template/styles fields inside defineComponent in SFC mode
  if (/\btemplate\s*:/.test(body)) {
    throw sfcError(
      'SFC_INLINE_PATHS_FORBIDDEN',
      `SFC file '${fileName}': template/styles paths are not allowed in SFC mode (content is inline)`
    );
  }
  if (/\bstyles\s*:/.test(body)) {
    throw sfcError(
      'SFC_INLINE_PATHS_FORBIDDEN',
      `SFC file '${fileName}': template/styles paths are not allowed in SFC mode (content is inline)`
    );
  }

  const tagMatch = body.match(/tag\s*:\s*['"]([^'"]+)['"]/);
  if (!tagMatch) {
    throw sfcError(
      'MISSING_DEFINE_COMPONENT',
      `Error en '${fileName}': defineComponent() must include a tag field`
    );
  }

  return tagMatch[1];
}

/**
 * Check that no non-whitespace content exists outside the recognized blocks.
 *
 * @param {string} source
 * @param {Array<{start: number, end: number}>} blockRanges — sorted by start
 * @param {string} fileName
 */
function validateNoUnexpectedContent(source, blockRanges, fileName) {
  let cursor = 0;

  for (const range of blockRanges) {
    const outside = source.slice(cursor, range.start);
    if (outside.trim().length > 0) {
      throw sfcError(
        'SFC_UNEXPECTED_CONTENT',
        `SFC file '${fileName}' contains unexpected content outside blocks`
      );
    }
    cursor = range.end;
  }

  // Check trailing content after last block
  const trailing = source.slice(cursor);
  if (trailing.trim().length > 0) {
    throw sfcError(
      'SFC_UNEXPECTED_CONTENT',
      `SFC file '${fileName}' contains unexpected content outside blocks`
    );
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Parse an SFC source string and extract its blocks.
 *
 * @param {string} source — Full content of the .wcc file
 * @param {string} [fileName='<unknown>'] — File name for error messages
 * @returns {SFCDescriptor}
 * @throws {Error} with codes: SFC_MISSING_TEMPLATE, SFC_MISSING_SCRIPT,
 *                 SFC_DUPLICATE_BLOCK, SFC_UNEXPECTED_CONTENT,
 *                 SFC_INLINE_PATHS_FORBIDDEN, MISSING_DEFINE_COMPONENT
 */
export function parseSFC(source, fileName = '<unknown>') {
  // ── Phase 1: Extract blocks ─────────────────────────────────────

  const scriptBlocks = findBlocks(source, 'script');
  const templateBlocks = findBlocks(source, 'template');
  const styleBlocks = findBlocks(source, 'style');

  // Check for duplicates
  if (scriptBlocks.length > 1) {
    throw sfcError(
      'SFC_DUPLICATE_BLOCK',
      `SFC file '${fileName}' contains duplicate <script> blocks`
    );
  }
  if (templateBlocks.length > 1) {
    throw sfcError(
      'SFC_DUPLICATE_BLOCK',
      `SFC file '${fileName}' contains duplicate <template> blocks`
    );
  }
  if (styleBlocks.length > 1) {
    throw sfcError(
      'SFC_DUPLICATE_BLOCK',
      `SFC file '${fileName}' contains duplicate <style> blocks`
    );
  }

  // ── Phase 2: Validation ─────────────────────────────────────────

  // Required blocks
  if (templateBlocks.length === 0) {
    throw sfcError(
      'SFC_MISSING_TEMPLATE',
      `SFC file '${fileName}' is missing a <template> block`
    );
  }
  if (scriptBlocks.length === 0) {
    throw sfcError(
      'SFC_MISSING_SCRIPT',
      `SFC file '${fileName}' is missing a <script> block`
    );
  }

  // Collect all block ranges for unexpected-content check
  /** @type {Array<{start: number, end: number}>} */
  const allRanges = [
    ...scriptBlocks,
    ...templateBlocks,
    ...styleBlocks,
  ].sort((a, b) => a.start - b.start);

  validateNoUnexpectedContent(source, allRanges, fileName);

  // Extract block contents
  const scriptContent = scriptBlocks[0].content;
  const templateContent = templateBlocks[0].content;
  const styleContent = styleBlocks.length > 0 ? styleBlocks[0].content : '';
  const lang = extractLang(scriptBlocks[0].attrs);

  // Validate defineComponent and extract tag
  const tag = extractTagFromDefineComponent(scriptContent, fileName);

  return {
    script: scriptContent,
    template: templateContent,
    style: styleContent,
    lang,
    tag,
  };
}

/**
 * Pretty-printer: reconstruct an SFC string from a descriptor.
 *
 * @param {SFCDescriptor} descriptor
 * @returns {string}
 */
export function printSFC(descriptor) {
  const langAttr = descriptor.lang === 'ts' ? ' lang="ts"' : '';
  let result = `<script${langAttr}>${descriptor.script}</script>\n\n`;
  result += `<template>${descriptor.template}</template>`;

  if (descriptor.style && descriptor.style.length > 0) {
    result += `\n\n<style>${descriptor.style}</style>`;
  }

  return result;
}
