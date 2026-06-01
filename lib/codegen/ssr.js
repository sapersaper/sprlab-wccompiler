/**
 * SSR code generator — generates a zero-dependency `renderToString` function
 * that renders a .wcc component to an HTML string on the server.
 *
 * SSR-1: Props, signals, text, CSS, :attr, :class, :style
 * SSR-2: if/else-if/else, each, show
 */

import { scopeCSS } from '../css-scoper.js';

/**
 * Generate SSR render function code for a component.
 *
 * @param {import('../types.js').ParseResult} parseResult
 * @returns {string} — JavaScript source for the .ssr.js file
 */
export function generateSSR(parseResult) {
  const {
    tagName,
    style,
    propDefs = [],
    signals = [],
    constantVars = [],
    bindings = [],
    attrBindings = [],
    ifBlocks = [],
    forBlocks = [],
    showBindings = [],
    template = '',
  } = parseResult;

  const lines = [];

  lines.push('export function renderToString(props = {}, state = {}) {');

  // ── Props ──
  for (const p of propDefs) {
    lines.push(`  const ${p.name} = props.${p.name} ?? ${p.default};`);
  }

  // ── Signals ──
  for (const s of signals) {
    lines.push(`  const ${s.name} = state.${s.name} ?? ${s.value};`);
  }

  // ── Constants ──
  for (const c of constantVars) {
    lines.push(`  const ${c.name} = ${c.value};`);
  }

  lines.push('');

  // ── CSS ──
  let css = '';
  if (style) {
    css = scopeCSS(style, tagName);
  }

  // ── Root attrs ──
  if (propDefs.length > 0) {
    lines.push('  var a = \'\';');
    for (const p of propDefs) {
      lines.push(`  if (${p.name}) { a += ' ${p.attrName}="' + __esc(String(${p.name})) + '"'; }`);
    }
    lines.push('  var __attrs = a;');
  } else {
    lines.push('  var __attrs = \'\';');
  }

  lines.push('');

  // ── Generate if blocks as JS variables ──
  for (let i = 0; i < ifBlocks.length; i++) {
    const block = ifBlocks[i];
    generateIfBlock(lines, block, i, propDefs, signals);
  }

  // ── Generate for blocks as JS variables ──
  for (let i = 0; i < forBlocks.length; i++) {
    const block = forBlocks[i];
    generateForBlock(lines, block, i, propDefs, signals);
  }

  // ── Process show bindings: add conditional style to matching elements ──
  let processedTemplate = template;
  for (const sb of showBindings) {
    const ssrExpr = toSSRExpr(sb.expression, 'signal', propDefs, signals);
    // Wrap the element with show binding in a conditional style template literal
    // The show attribute has been removed, we add style="display:none" inline
    processedTemplate = processedTemplate.replace(
      sb.varName,
      `\${${ssrExpr} ? '' : ' style="display:none"'}`
    );
  }

  // ── Process bindings and attrs in the main template ──
  let html = ssrProcessHTML(processedTemplate, bindings, attrBindings, propDefs, signals);

  // ── Replace if/each anchors with SSR variable references ──
  for (let i = 0; i < ifBlocks.length; i++) {
    html = html.replace(`<!-- if -->`, `\${__if_${i}}`);
  }
  for (let i = 0; i < forBlocks.length; i++) {
    html = html.replace(`<!-- each -->`, `\${__for_${i}}`);
  }

  // ── Build return ──
  lines.push('  var h = \'\';');
  lines.push(`  h += '<${tagName}';`);
  lines.push(`  if (__attrs) h += ' ' + __attrs;`);
  lines.push(`  h += '>';`);
  if (css) {
    lines.push(`  h += '<style>${css}</style>';`);
  }
  for (const hl of html.split('\n')) {
    lines.push(`  h += \`${hl}\`;`);
  }
  lines.push(`  h += '</${tagName}>';`);
  lines.push('  return h;');
  lines.push('}');

  // ── __esc helper ──
  lines.push('');
  lines.push(`function __esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}`);

  return lines.join('\n') + '\n';
}

/**
 * Generate SSR code for an if block.
 */
function generateIfBlock(lines, block, index, propDefs, signals) {
  const branches = block.branches || [];
  lines.push(`  var __if_${index} = '';`);

  for (let b = 0; b < branches.length; b++) {
    const branch = branches[b];
    let branchHtml = ssrProcessHTML(
      branch.templateHtml,
      branch.bindings || [],
      branch.attrBindings || [],
      propDefs,
      signals
    );
    branchHtml = branchHtml.replace(/\n/g, '\\n');

    if (branch.type === 'if') {
      const expr = toSSRExpr(branch.expression, 'signal', propDefs, signals);
      lines.push(`  if (${expr}) { __if_${index} += \`${branchHtml}\`; }`);
    } else if (branch.type === 'else-if') {
      const expr = toSSRExpr(branch.expression, 'signal', propDefs, signals);
      lines.push(`  else if (${expr}) { __if_${index} += \`${branchHtml}\`; }`);
    } else if (branch.type === 'else') {
      lines.push(`  else { __if_${index} += \`${branchHtml}\`; }`);
    }
  }
}

/**
 * Generate SSR code for a for block.
 */
function generateForBlock(lines, block, index, propDefs, signals) {
  const source = block.source;
  const itemVar = block.itemVar;
  const indexVar = block.indexVar;

  let itemHtml = ssrProcessHTML(
    block.templateHtml,
    block.bindings || [],
    block.attrBindings || [],
    propDefs,
    signals
  );
  itemHtml = itemHtml.replace(/\n/g, '\\n');

  lines.push(`  var __for_${index} = (${source} || []).map((${indexVar ? itemVar + ', ' + indexVar : itemVar}) => \`${itemHtml}\`).join('');`);
}

/**
 * Process an HTML string replacing {{expr}} and :attr bindings for SSR.
 */
function ssrProcessHTML(html, bindings, attrBindings, propDefs, signals) {
  let result = html;

  for (const b of bindings) {
    const ssrExpr = toSSRExpr(b.name, b.type, propDefs, signals);
    result = result.replaceAll(`{{${b.name}}}`, `\${__esc(String(${ssrExpr}))}`);
  }

  for (const a of attrBindings) {
    const ssrExpr = toSSRExpr(a.expression, 'signal', propDefs, signals);
    const attr = a.attr;
    switch (a.kind) {
      case 'attr':
        result = result.replaceAll(new RegExp(`:${attr}="[^"]*"`, 'g'),
          `\${${ssrExpr} ? \` ${attr}="\${__esc(String(${ssrExpr}))}"\` : ''}`);
        break;
      case 'bool':
        result = result.replaceAll(new RegExp(`:${attr}="[^"]*"`, 'g'),
          `\${${ssrExpr} ? \` ${attr}\` : ''}`);
        break;
      case 'class':
        result = result.replaceAll(new RegExp(`:${attr}="[^"]*"`, 'g'),
          ` class="\${${ssrExpr}}"`);
        break;
      case 'style':
        result = result.replaceAll(new RegExp(`:${attr}="[^"]*"`, 'g'),
          ` style="\${${ssrExpr}}"`);
        break;
    }
  }

  return result;
}

/**
 * Transform a template expression for SSR rendering.
 * Strips signal calls (show() → show), resolves props access,
 * and leaves other expressions as-is.
 */
function toSSRExpr(expr, type, propDefs, signals) {
  // Signal call: show() → show
  const signalMatch = expr.match(/^(\w+)\(\)$/);
  if (signalMatch && signals.some(s => s.name === signalMatch[1])) {
    return signalMatch[1];
  }
  // Prop access: props.name → name
  if (type === 'prop') {
    for (const p of propDefs) {
      if (expr === `props.${p.name}` || expr === `props.${p.attrName}` || expr === `props.${p.name}()` || expr === `props.${p.attrName}()`) {
        return p.name;
      }
    }
  }
  // Direct signal reference (no parens)
  if (signals.some(s => s.name === expr)) {
    return expr;
  }
  return expr;
}
