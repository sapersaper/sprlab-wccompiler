/**
 * SSR code generator — generates a zero-dependency `renderToString` function
 * that renders a .wcc component to an HTML string on the server.
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

  // ── Props → destructure from props param with defaults ──
  for (const p of propDefs) {
    lines.push(`  const ${p.name} = props.${p.name} ?? ${p.default};`);
  }

  // ── Signals → destructure from state param with defaults ──
  for (const s of signals) {
    lines.push(`  const ${s.name} = state.${s.name} ?? ${s.value};`);
  }

  // ── Constants ──
  for (const c of constantVars) {
    lines.push(`  const ${c.name} = ${c.value};`);
  }

  lines.push('');

  // ── Build HTML template literal from the raw template ──
  let html = template;

  // Replace text bindings: {{expr}} → ${__esc(String(expr))}
  // The expression in the template might be `count()`, `props.active`, etc.
  // For SSR, we map signal calls like `count()` → just `count` (the destructured var)
  for (const b of bindings) {
    const ssrExpr = toSSRExpr(b.name, b.type, propDefs, signals);
    // Replace ALL {{...}} patterns that involve this binding name
    // We match the full {{...}} pattern and check if it contains our expr
    const bindingExpr = `${b.name}`;
    html = html.replaceAll(`{{${bindingExpr}}}`, `\${__esc(String(${ssrExpr}))}`);
  }

  // ── Handle attr bindings ──
  for (const a of attrBindings) {
    const ssrExpr = toSSRExpr(a.expression, 'signal', propDefs, signals);
    const attr = a.attr;

    switch (a.kind) {
      case 'attr':
        // Replace :href="url()" → ${url ? ` href="${__esc(url)}"` : ''}
        html = html.replaceAll(new RegExp(`:${attr}="[^"]*"`, 'g'),
          `\${${ssrExpr} ? \` ${attr}="\${__esc(String(${ssrExpr}))}"\` : ''}`);
        break;
      case 'bool':
        html = html.replaceAll(new RegExp(`:${attr}="[^"]*"`, 'g'),
          `\${${ssrExpr} ? \` ${attr}\` : ''}`);
        break;
      case 'class':
        // :class="{ active: isActive }" → use the expression directly
        html = html.replaceAll(new RegExp(`:${attr}="[^"]*"`, 'g'),
          ` class="\${${ssrExpr}}"`);
        break;
      case 'style':
        html = html.replaceAll(new RegExp(`:${attr}="[^"]*"`, 'g'),
          ` style="\${${ssrExpr}}"`);
        break;
    }
  }

  // ── CSS ──
  let css = '';
  if (style) {
    css = scopeCSS(style, tagName);
  }

  // ── Build attribute string using concat ──
  if (propDefs.length > 0) {
    const attrBlocks = propDefs.map(p =>
      `if (${p.name}) { a += ' ${p.attrName}="' + __esc(String(${p.name})) + '"'; }`
    );
    lines.push('  var a = \'\';');
    for (const block of attrBlocks) {
      lines.push('  ' + block);
    }
    lines.push('  var __attrs = a;');
  } else {
    lines.push('  var __attrs = \'\';');
  }

  lines.push('');

  // ── Return HTML string ──
  lines.push('  var h = \'\';');
  lines.push(`  h += '<' + '${tagName}';`);
  lines.push(`  if (__attrs) h += ' ' + __attrs;`);
  lines.push(`  h += '>';`);
  if (css) {
    lines.push(`  h += '<style>${css}</style>';`);
  }
  // Append HTML content
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

  // ── Export ──
  const code = lines.join('\n');
  return `${code}\n`;
}

/**
 * Transform a template expression for SSR rendering.
 * Signal calls: `count()` → `count` (the plain destructured variable)
 * Prop access: `props.active` → `active` (destructured)
 */
function toSSRExpr(expr, type, propDefs, signals) {
  if (type === 'prop') {
    for (const p of propDefs) {
      if (expr === `props.${p.name}` || expr === `props.${p.attrName}`) {
        return p.name;
      }
    }
  }
  // If it's a signal name used directly (not called), use it as-is
  if (signals.some(s => s.name === expr)) {
    return expr;
  }
  return expr;
}
