/**
 * Code Generator for compiled web components.
 *
 * Takes a complete ParseResult (with bindings, events, slots populated by tree-walker)
 * and produces a self-contained JavaScript string with:
 * - Inline mini reactive runtime (zero imports)
 * - Scoped CSS injection
 * - HTMLElement class with signals, effects, slots, events
 */

import { reactiveRuntime } from './reactive-runtime.js';
import { scopeCSS } from './css-scoper.js';

/**
 * Convert a path array to a JS expression string.
 * Inlined here to avoid pulling in jsdom via tree-walker.js.
 * e.g. pathExpr(['childNodes[0]', 'childNodes[1]'], '__root') => '__root.childNodes[0].childNodes[1]'
 */
function pathExpr(parts, rootVar) {
  return parts.length === 0 ? rootVar : rootVar + '.' + parts.join('.');
}

/**
 * Generate a fully self-contained JS component from a ParseResult.
 *
 * @param {import('./parser.js').ParseResult} parseResult - Complete IR with bindings/events/slots
 * @returns {string} JavaScript source code
 */
export function generateComponent(parseResult) {
  const {
    tagName,
    className,
    style,
    props,
    reactiveVars,
    computeds,
    watchers,
    methods,
    bindings,
    events,
    slots,
    processedTemplate,
  } = parseResult;

  const propsSet = new Set(props);
  const computedNames = new Set(computeds.map(c => c.name));
  const rootVarNames = new Set(reactiveVars.map(v => v.name));

  const lines = [];

  // ── 1. Inline reactive runtime (task 6.1) ──
  lines.push(reactiveRuntime.trim());
  lines.push('');

  // ── 2. CSS injection (task 6.6) ──
  if (style) {
    const scoped = scopeCSS(style, tagName);
    lines.push(`const __css_${className} = document.createElement('style');`);
    lines.push(`__css_${className}.textContent = \`${scoped}\`;`);
    lines.push(`document.head.appendChild(__css_${className});`);
    lines.push('');
  }

  // ── 3. Template ──
  lines.push(`const __t_${className} = document.createElement('template');`);
  lines.push(`__t_${className}.innerHTML = \`${processedTemplate}\`;`);
  lines.push('');

  // ── 4. Class definition (task 6.1) ──
  lines.push(`class ${className} extends HTMLElement {`);

  // observedAttributes
  lines.push('  static get observedAttributes() {');
  lines.push(`    return [${props.map(p => `'${p}'`).join(', ')}];`);
  lines.push('  }');
  lines.push('');

  // constructor
  lines.push('  constructor() {');
  lines.push('    super();');

  // Slot resolution code (task 6.5) — must read childNodes BEFORE replacing innerHTML
  if (slots.length > 0) {
    lines.push('    const __slotMap = {};');
    lines.push('    const __defaultSlotNodes = [];');
    lines.push('    for (const child of Array.from(this.childNodes)) {');
    lines.push("      if (child.nodeName === 'TEMPLATE') {");
    lines.push('        for (const attr of child.attributes) {');
    lines.push("          if (attr.name.startsWith('#')) {");
    lines.push('            const slotName = attr.name.slice(1);');
    lines.push('            __slotMap[slotName] = { content: child.innerHTML, propsExpr: attr.value };');
    lines.push('          }');
    lines.push('        }');
    lines.push("      } else if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {");
    lines.push('        __defaultSlotNodes.push(child);');
    lines.push('      }');
    lines.push('    }');
  }

  // Clone template and assign DOM refs
  lines.push(`    const __root = __t_${className}.content.cloneNode(true);`);

  const allNodes = [...bindings, ...events, ...slots];
  for (const n of allNodes) {
    lines.push(`    this.${n.varName} = ${pathExpr(n.path, '__root')};`);
  }

  lines.push("    this.innerHTML = '';");
  lines.push('    this.appendChild(__root);');

  // Static slot injection (task 6.5)
  for (const s of slots) {
    if (s.name && s.slotProps.length > 0) {
      // Scoped slot: store template for reactive effect
      lines.push(`    if (__slotMap['${s.name}']) { this.__slotTpl_${s.name} = __slotMap['${s.name}'].content; }`);
    } else if (s.name) {
      // Named slot: inject content directly
      lines.push(`    if (__slotMap['${s.name}']) { this.${s.varName}.innerHTML = __slotMap['${s.name}'].content; }`);
    } else {
      // Default slot
      lines.push(`    if (__defaultSlotNodes.length) { this.${s.varName}.textContent = ''; __defaultSlotNodes.forEach(n => this.${s.varName}.appendChild(n.cloneNode(true))); }`);
    }
  }

  // Signal inits (task 6.2)
  for (const p of props) {
    lines.push(`    this._s_${p} = __signal(null);`);
  }
  for (const v of reactiveVars) {
    lines.push(`    this._${v.name} = __signal(${v.value});`);
  }

  // Computed inits (task 6.2)
  for (const c of computeds) {
    const body = transformExpr(c.body, propsSet, rootVarNames, computedNames);
    lines.push(`    this._c_${c.name} = __computed(() => ${body});`);
  }

  // Watcher prev inits (task 6.3)
  for (const w of watchers) {
    lines.push(`    this.__prev_${w.target} = undefined;`);
  }

  lines.push('  }');
  lines.push('');

  // connectedCallback
  lines.push('  connectedCallback() {');

  // Binding effects (task 6.2)
  if (bindings.length > 0) {
    lines.push('    __effect(() => {');
    for (const b of bindings) {
      lines.push(`      this.${b.varName}.textContent = ${bindingRef(b)} ?? '';`);
    }
    lines.push('    });');
  }

  // Reactive slot effects (task 6.5)
  for (const s of slots) {
    if (s.name && s.slotProps.length > 0) {
      const propsObj = s.slotProps.map(sp => `${sp.prop}: ${slotPropRef(sp.source, propsSet, computedNames, rootVarNames)}`).join(', ');
      lines.push(`    if (this.__slotTpl_${s.name}) {`);
      lines.push('      __effect(() => {');
      lines.push(`        const __props = { ${propsObj} };`);
      lines.push(`        let __html = this.__slotTpl_${s.name};`);
      lines.push("        for (const [k, v] of Object.entries(__props)) {");
      lines.push(`          __html = __html.replace(new RegExp('\\\\{\\\\{\\\\s*' + k + '\\\\s*\\\\}\\\\}', 'g'), v ?? '');`);
      lines.push('        }');
      lines.push(`        this.${s.varName}.innerHTML = __html;`);
      lines.push('      });');
      lines.push('    }');
    }
  }

  // Watcher effects (task 6.3)
  for (const w of watchers) {
    const watchRef = signalRef(w.target, propsSet, computedNames, rootVarNames);
    let body = transformExpr(w.body, propsSet, rootVarNames, computedNames);
    body = body.replace(/\bemit\(/g, 'this._emit(');
    lines.push('    __effect(() => {');
    lines.push(`      const ${w.newParam} = ${watchRef};`);
    lines.push(`      if (this.__prev_${w.target} !== undefined) {`);
    lines.push(`        const ${w.oldParam} = this.__prev_${w.target};`);
    lines.push(`        ${body}`);
    lines.push('      }');
    lines.push(`      this.__prev_${w.target} = ${w.newParam};`);
    lines.push('    });');
  }

  // Event listeners (task 6.4)
  for (const e of events) {
    lines.push(`    this.${e.varName}.addEventListener('${e.event}', this._${e.handler}.bind(this));`);
  }

  lines.push('  }');
  lines.push('');

  // attributeChangedCallback (task 6.1)
  lines.push('  attributeChangedCallback(name, oldValue, newValue) {');
  for (const p of props) {
    lines.push(`    if (name === '${p}') this._s_${p}(newValue);`);
  }
  lines.push('  }');
  lines.push('');

  // Public getters/setters (task 6.2)
  for (const p of props) {
    lines.push(`  get ${p}() { return this._s_${p}(); }`);
    lines.push(`  set ${p}(val) { this._s_${p}(val); }`);
    lines.push('');
  }

  // _emit method (task 6.4)
  if (events.length > 0 || hasEmitCall(methods)) {
    lines.push('  _emit(name, detail) {');
    lines.push('    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));');
    lines.push('  }');
    lines.push('');
  }

  // User methods (task 6.4 — transform emit, variable refs)
  for (const m of methods) {
    let body = transformMethodBody(m.body, propsSet, rootVarNames, computedNames);
    lines.push(`  _${m.name}(${m.params}) {`);
    lines.push(`    ${body}`);
    lines.push('  }');
    lines.push('');
  }

  lines.push('}');
  lines.push('');

  // customElements.define (task 6.1)
  lines.push(`customElements.define('${tagName}', ${className});`);
  lines.push('');

  return lines.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Transform an expression by replacing bare variable references with signal calls.
 * Props → this._s_name(), reactive vars → this._name(), computeds → this._c_name()
 */
function transformExpr(expr, propsSet, rootVarNames, computedNames) {
  let r = expr;
  for (const p of propsSet) {
    r = r.replace(new RegExp(`\\b${p}\\b`, 'g'), `this._s_${p}()`);
  }
  for (const n of rootVarNames) {
    r = r.replace(new RegExp(`\\b${n}\\b`, 'g'), `this._${n}()`);
  }
  for (const n of computedNames) {
    r = r.replace(new RegExp(`\\b${n}\\b`, 'g'), `this._c_${n}()`);
  }
  return r;
}

/**
 * Transform a method body: replace variable refs, assignments, and emit calls.
 */
function transformMethodBody(body, propsSet, rootVarNames, computedNames) {
  let r = body;

  // Replace assignments: `const varName = expr;` or `varName = expr;` → `this._varName(expr);`
  for (const n of rootVarNames) {
    r = r.replace(new RegExp(`(?:const|let|var)\\s+${n}\\s*=\\s*(.+?);?\\s*$`, 'gm'), `this._${n}($1);`);
    r = r.replace(new RegExp(`(?<!\\.)\\b${n}\\s*=\\s*(.+?);?\\s*$`, 'gm'), `this._${n}($1);`);
  }

  // Replace reads (not followed by = or preceded by this._)
  for (const n of rootVarNames) {
    r = r.replace(new RegExp(`(?<!this\\._)(?<!\\.)\\b${n}\\b(?!\\s*[=(])`, 'g'), `this._${n}()`);
  }
  for (const p of propsSet) {
    r = r.replace(new RegExp(`(?<!this\\._s_)(?<!\\.)\\b${p}\\b(?!\\s*[=(])`, 'g'), `this._s_${p}()`);
  }
  for (const n of computedNames) {
    r = r.replace(new RegExp(`(?<!this\\._c_)(?<!\\.)\\b${n}\\b`, 'g'), `this._c_${n}()`);
  }

  // Replace emit() → this._emit()
  r = r.replace(/\bemit\(/g, 'this._emit(');

  return r;
}

/**
 * Get the signal reference expression for a binding.
 */
function bindingRef(b) {
  if (b.type === 'prop') return `this._s_${b.name}()`;
  if (b.type === 'computed') return `this._c_${b.name}()`;
  return `this._${b.name}()`;
}

/**
 * Get the signal reference for a watcher target or slot prop source.
 */
function signalRef(name, propsSet, computedNames, rootVarNames) {
  if (propsSet.has(name)) return `this._s_${name}()`;
  if (computedNames.has(name)) return `this._c_${name}()`;
  if (rootVarNames.has(name)) return `this._${name}()`;
  return `this._${name}()`;
}

/**
 * Get the signal reference for a slot prop source.
 */
function slotPropRef(source, propsSet, computedNames, rootVarNames) {
  if (propsSet.has(source)) return `this._s_${source}()`;
  if (computedNames.has(source)) return `this._c_${source}()`;
  if (rootVarNames.has(source)) return `this._${source}()`;
  return `'${source}'`;
}

/**
 * Check if any method body contains an emit() call.
 */
function hasEmitCall(methods) {
  return methods.some(m => /\bemit\(/.test(m.body));
}
