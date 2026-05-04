/**
 * WCC Block Parser — extracts <script>, <template> and <style> blocks
 * from .wcc files with their exact positions.
 *
 * This parser is intentionally more permissive than the compiler parser
 * (lib/sfc-parser.js) to work while the user is writing incomplete code.
 * It does not throw errors — absent blocks are represented as null.
 */

/** Block extracted from a .wcc file */
export interface WccBlock {
  /** Block type */
  type: 'script' | 'template' | 'style';
  /** Inner content of the block (without the tags) */
  content: string;
  /** Offset of the first character of the content in the source file */
  startOffset: number;
  /** Offset after the last character of the content */
  endOffset: number;
  /** Attributes of the opening tag (e.g., ' lang="ts"') */
  attrs: string;
}

/** Result of parsing a .wcc file */
export interface WccParseResult {
  script: WccBlock | null;
  template: WccBlock | null;
  style: WccBlock | null;
}

/**
 * Attempt to extract a single block of the given type from the source.
 * Returns null if the opening tag is not found or if there is no matching closing tag.
 */
function extractBlock(source: string, blockName: 'script' | 'template' | 'style'): WccBlock | null {
  const openRe = new RegExp(`<${blockName}([^>]*)>`);
  const openMatch = openRe.exec(source);

  if (!openMatch) {
    return null;
  }

  const closeTag = `</${blockName}>`;
  const startOffset = openMatch.index + openMatch[0].length;
  const closeIdx = source.indexOf(closeTag, startOffset);

  if (closeIdx === -1) {
    // Opening tag without closing tag — ignore this block
    return null;
  }

  const endOffset = closeIdx;
  const content = source.slice(startOffset, endOffset);
  const attrs = openMatch[1] || '';

  return {
    type: blockName,
    content,
    startOffset,
    endOffset,
    attrs,
  };
}

/**
 * Parses a .wcc file and extracts blocks with their positions.
 * Does not throw errors — absent blocks are represented as null.
 */
export function parseWccBlocks(source: string): WccParseResult {
  return {
    script: extractBlock(source, 'script'),
    template: extractBlock(source, 'template'),
    style: extractBlock(source, 'style'),
  };
}
