import { scopeCSS } from '../css-scoper.js';

export function generateSSR(parseResult) {
  const { tagName, style, propDefs = [], signals = [], computeds = [], constantVars = [], template = '' } = parseResult;
  const signalNames = signals.map(s => s.name);
  const propNames = propDefs.map(p => p.name);
  const computedNames = computeds.map(c => c.name);

  const lines = [];
  lines.push('export function renderToString(props = {}, state = {}) {');

  for (const p of propDefs) lines.push(`  const ${p.name} = props.${p.name} ?? ${p.default};`);
  for (const s of signals) lines.push(`  const ${s.name} = state.${s.name} ?? ${s.value};`);
  for (const c of computeds) {
    const body = stripCalls(c.body, signalNames, propNames, computedNames);
    lines.push(`  const ${c.name} = ${body};`);
  }
  for (const c of constantVars) lines.push(`  const ${c.name} = ${c.value};`);
  lines.push('');

  const css = style ? scopeCSS(style, tagName) : '';

  if (propDefs.length > 0) {
    lines.push('  var a = \'\';');
    for (const p of propDefs) lines.push(`  if (${p.name}) { a += ' ${p.attrName}="' + __esc(String(${p.name})) + '"'; }`);
    lines.push('  var __attrs = a;');
  } else {
    lines.push('  var __attrs = \'\';');
  }

  let html = template;

  // 1. Remove if/else-if/else directives
  html = html.replace(/\s+if="[^"]*"/g, '');
  html = html.replace(/\s+else-if="[^"]*"/g, '');
  html = html.replace(/\s+else(="[^"]*")?/g, '');

  // 2. Replace each directives with .map()
  html = html.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^>]*?)?)\s+each="([^"]+)"((?:\s[^>]*?)?)>([\s\S]*?)<\/\1>/g,
    (match, tag, before, eachExpr, after, inner) => {
      const parsed = parseEach(eachExpr);
      if (!parsed) return match;
      const { itemVar, indexVar, source } = parsed;
      const srcVal = stripCalls(source, signalNames, propNames, computedNames);
      const itemHtml = processBindings(inner, signalNames, propNames, computedNames);
      const attrs = (before + ' ' + after).trim();
      const tagOpen = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
      const tagClose = `</${tag}>`;
      return `\${(${srcVal} || []).map((${indexVar ? `${itemVar}, ${indexVar}` : itemVar}) => \`${tagOpen}${itemHtml}${tagClose}\`).join('')}`;
    }
  );

  // 3. Replace show with conditional display:none
  html = html.replace(/ show="([^"]+)"/g, (_, expr) => {
    return `\${${stripCalls(expr, signalNames, propNames, computedNames)} ? '' : ' style="display:none"'}`;
  });

  // 4. Replace {{expr}} with SSR interpolation
  html = html.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    return `\${__esc(String(${stripCalls(expr, signalNames, propNames, computedNames)}))}`;
  });

  // ── Build return ──
  lines.push('  var h = \'\';');
  lines.push(`  h += '<${tagName}';`);
  lines.push(`  if (__attrs) h += ' ' + __attrs;`);
  lines.push(`  h += '>';`);
  if (css) lines.push(`  h += \`<style>${css}</style>\`;`);
  for (const hl of html.split('\n')) lines.push(`  h += \`${hl}\`;`);
  lines.push(`  h += '</${tagName}>';`);
  lines.push('  return h;');
  lines.push('}');

  lines.push('');
  lines.push(`function __esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}`);

  return lines.join('\n') + '\n';
}

function stripCalls(expr, signalNames, propNames, computedNames = []) {
  for (const sn of signalNames)   expr = expr.replaceAll(`${sn}()`, sn);
  for (const pn of propNames)     expr = expr.replaceAll(`${pn}()`, pn);
  for (const pn of propNames)     expr = expr.replaceAll(`props.${pn}`, pn);
  for (const cn of computedNames) expr = expr.replaceAll(`${cn}()`, cn);
  return expr;
}

function parseEach(e) {
  let m = /^\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+(.+)\s*$/.exec(e);
  if (m) return { itemVar: m[1], indexVar: m[2], source: m[3].trim() };
  m = /^\s*(\w+)\s+in\s+(.+)\s*$/.exec(e);
  if (m) return { itemVar: m[1], indexVar: null, source: m[2].trim() };
  return null;
}

function processBindings(html, signalNames, propNames, computedNames = []) {
  return html.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    return `\${__esc(String(${stripCalls(expr, signalNames, propNames, computedNames)}))}`;
  });
}
