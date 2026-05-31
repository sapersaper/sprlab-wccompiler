/**
 * Preamble generation — runtime imports, CSS injection, template element,
 * findAnchor helper.  Everything before the HTMLElement class declaration.
 */

import { scopeCSS } from '../css-scoper.js';

/**
 * @param {string[]} lines
 * @param {import('../types.js').ParseResult} parseResult
 * @param {{ sourceFile?: string, comments?: boolean }} [options]
 */
export function generatePreamble(lines, parseResult, options = {}) {
  const {
    tagName,
    className,
    style,
    processedTemplate,
    ifBlocks = [],
    forBlocks = [],
    dynamicComponents = [],
    childImports = [],
  } = parseResult;

  // ── 0. Source comment ──
  if (options.sourceFile) {
    lines.push(`// Generated from: ${options.sourceFile} (wcCompiler)`);
  }

  // ── 1b. Child component imports ──
  for (const ci of childImports) {
    if (ci.sideEffect) {
      // Side-effect import: no identifier, child self-registers
      lines.push(`import '${ci.importPath}';`);
    } else {
      // Named import with guarded registration
      lines.push(`import ${ci.identifier} from '${ci.importPath}';`);
      lines.push(`if (!customElements.get(${ci.identifier}.__meta.tag)) customElements.define(${ci.identifier}.__meta.tag, ${ci.identifier});`);
    }
  }
  if (childImports.length > 0) {
  lines.push('');
  }

  // ── 2. CSS injection (scoped, deduplicated via id guard) ──
  if (style) {
    if (options.comments) lines.push('// ── Styles ───────────────────────────────────────────');
    const scoped = scopeCSS(style, tagName);
    const cssId = `__css_${className}`;
    lines.push(`if (!document.getElementById('${cssId}')) {`);
    lines.push(`  const ${cssId} = document.createElement('style');`);
    lines.push(`  ${cssId}.id = '${cssId}';`);
    lines.push(`  ${cssId}.textContent = \`${scoped}\`;`);
    lines.push(`  document.head.appendChild(${cssId});`);
    lines.push('}');
    lines.push('');
  }

  // ── 3. Template element ──
  if (options.comments) lines.push('// ── Template ─────────────────────────────────────────');
  lines.push(`const __t_${className} = document.createElement('template');`);
  lines.push(`__t_${className}.innerHTML = \`${processedTemplate || ''}\`;`);
  lines.push('');

  // ── findAnchor helper (Phase 5: replaces childNodes[N] paths) ──
  if (ifBlocks.length > 0 || forBlocks.length > 0 || dynamicComponents.length > 0) {
    lines.push('function findAnchor(root, type, index) {');
    lines.push("  const needle = ' ' + type + ' ';");
    lines.push('  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);');
    lines.push('  let count = 0;');
    lines.push('  let node;');
    lines.push('  while ((node = walker.nextNode())) {');
    lines.push('    if (node.textContent === needle) {');
    lines.push('      if (count === index) return node;');
    lines.push('      count++;');
    lines.push('    }');
    lines.push('  }');
    lines.push('  return null;');
    lines.push('}');
    lines.push('');
  }
}
