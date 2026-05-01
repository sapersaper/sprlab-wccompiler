/**
 * Code Generator for wcCompiler v2.
 *
 * Takes a complete ParseResult (with bindings, events populated by tree-walker)
 * and produces a self-contained JavaScript string with:
 * - Inline mini reactive runtime (zero imports)
 * - Scoped CSS injection
 * - HTMLElement class with signals, computeds, effects, events
 * - customElements.define registration
 *
 * This is a simplified version of v1's codegen, scoped to core features only:
 * signals, computeds, effects, text interpolation, event bindings, user methods.
 * No props, emits, slots, if, for, model, show, attr, refs, or lifecycle hooks.
 */

import { reactiveRuntime } from './reactive-runtime.js';
import { scopeCSS } from './css-scoper.js';

/** @import { ParseResult } from './types.js' */

/**
 * Convert a path array to a JS expression string.
 * e.g. pathExpr(['childNodes[0]', 'childNodes[1]'], '__root') => '__root.childNodes[0].childNodes[1]'
 *
 * @param {string[]} parts
 * @param {string} rootVar
 * @returns {string}
 */
export function pathExpr(parts, rootVar) {
  return parts.length === 0 ? rootVar : rootVar + '.' + parts.join('.');
}

/**
 * Escape special regex characters in a string.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the signal reference for a slot prop source expression.
 *
 * @param {string} source — Source variable name from :prop="source"
 * @param {string[]} signalNames — Signal variable names
 * @param {string[]} computedNames — Computed variable names
 * @param {Set<string>} propNames — Prop names from defineProps
 * @returns {string}
 */
function slotPropRef(source, signalNames, computedNames, propNames) {
  if (propNames.has(source)) return `this._s_${source}()`;
  if (computedNames.includes(source)) return `this._c_${source}()`;
  if (signalNames.includes(source)) return `this._${source}()`;
  return `'${source}'`;
}

/**
 * Transform an expression by rewriting signal/computed variable references
 * to use `this._x()` / `this._c_x()` syntax for auto-unwrapping.
 *
 * Also handles `propsObjectName.propName` → `this._s_propName()` transformation.
 * Also handles `emitsObjectName(` → `this._emit(` transformation.
 *
 * Uses word-boundary regex for each known signal/computed name.
 * Does NOT transform if the name is followed by `.set(` (that's a write,
 * handled by transformMethodBody).
 *
 * @param {string} expr — Expression to transform
 * @param {string[]} signalNames — Signal variable names
 * @param {string[]} computedNames — Computed variable names
 * @param {string|null} [propsObjectName] — Props object variable name
 * @param {Set<string>} [propNames] — Set of prop names
 * @param {string|null} [emitsObjectName] — Emits object variable name
 * @returns {string}
 */
export function transformExpr(expr, signalNames, computedNames, propsObjectName = null, propNames = new Set(), emitsObjectName = null, constantNames = []) {
  let result = expr;

  // Transform emit calls: emitsObjectName( → this._emit(
  if (emitsObjectName) {
    const emitsRe = new RegExp(`\\b${escapeRegex(emitsObjectName)}\\(`, 'g');
    result = result.replace(emitsRe, 'this._emit(');
  }

  // Transform props.x → this._s_x() BEFORE signal/computed transforms
  if (propsObjectName && propNames.size > 0) {
    const propsRe = new RegExp(`\\b${propsObjectName}\\.(\\w+)`, 'g');
    result = result.replace(propsRe, (match, propName) => {
      if (propNames.has(propName)) {
        return `this._s_${propName}()`;
      }
      return match; // leave unknown props unchanged
    });
  }

  // Transform bare prop names → this._s_x() (for template expressions like :style="{ color: myProp }")
  for (const propName of propNames) {
    if (propsObjectName && propName === propsObjectName) continue;
    if (emitsObjectName && propName === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b(${propName})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._s_${propName}()`);
  }

  // Transform computed names first (to avoid partial matches with signals)
  for (const name of computedNames) {
    // Skip propsObjectName and emitsObjectName
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    // First: transform name() calls → this._c_name() (replace the call, not just the name)
    const callRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(callRe, `this._c_${name}()`);
    // Then: transform bare name references (not followed by ( or .set() → this._c_name()
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._c_${name}()`);
  }

  // Transform signal names
  for (const name of signalNames) {
    // Skip propsObjectName and emitsObjectName
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    // First: transform name() calls → this._name() (replace the call, not just the name)
    const callRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(callRe, `this._${name}()`);
    // Then: transform bare name references (not followed by ( or .set() → this._name()
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._${name}()`);
  }

  // Transform constant names → this._const_name (no function call)
  for (const name of constantNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._const_${name}`);
  }

  return result;
}

/**
 * Transform a method/effect body by rewriting signal writes and reads.
 *
 * - `emitsObjectName(` → `this._emit(` (emit call)
 * - `props.x` → `this._s_x()` (prop access)
 * - `x.set(value)` → `this._x(value)` (signal write via setter)
 * - `x()` → `this._x()` (signal read)
 * - Computed `x()` → `this._c_x()` (computed read)
 *
 * @param {string} body — Function body to transform
 * @param {string[]} signalNames — Signal variable names
 * @param {string[]} computedNames — Computed variable names
 * @param {string|null} [propsObjectName] — Props object variable name
 * @param {Set<string>} [propNames] — Set of prop names
 * @param {string|null} [emitsObjectName] — Emits object variable name
 * @param {string[]} [refVarNames] — Ref variable names from templateRef declarations
 * @returns {string}
 */
export function transformMethodBody(body, signalNames, computedNames, propsObjectName = null, propNames = new Set(), emitsObjectName = null, refVarNames = [], constantNames = []) {
  let result = body;

  // 0a. Transform emit calls: emitsObjectName( → this._emit(
  if (emitsObjectName) {
    const emitsRe = new RegExp(`\\b${escapeRegex(emitsObjectName)}\\(`, 'g');
    result = result.replace(emitsRe, 'this._emit(');
  }

  // 0b. Transform props.x → this._s_x() BEFORE other transforms
  if (propsObjectName && propNames.size > 0) {
    const propsRe = new RegExp(`\\b${propsObjectName}\\.(\\w+)`, 'g');
    result = result.replace(propsRe, (match, propName) => {
      if (propNames.has(propName)) {
        return `this._s_${propName}()`;
      }
      return match;
    });
  }

  // 0c. Transform ref access: varName.value → this._varName.value
  for (const name of refVarNames) {
    const refRe = new RegExp(`\\b${name}\\.value\\b`, 'g');
    result = result.replace(refRe, `this._${name}.value`);
  }

  // 1. Transform signal writes: x.set(value) → this._x(value)
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const setRe = new RegExp(`\\b${name}\\.set\\(`, 'g');
    result = result.replace(setRe, `this._${name}(`);
  }

  // 2. Transform computed reads: x() → this._c_x()
  for (const name of computedNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(readRe, `this._c_${name}()`);
  }

  // 3. Transform signal reads: x() → this._x()
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(readRe, `this._${name}()`);
  }

  // 4. Transform constant reads: name → this._const_name
  for (const name of constantNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b${name}\\b(?!\\()`, 'g');
    result = result.replace(bareRe, `this._const_${name}`);
  }

  return result;
}

/**
 * Transform an expression within the scope of an each block.
 * - References to itemVar and indexVar are left UNTRANSFORMED
 * - References to component variables (props, reactive, computed) ARE transformed
 *
 * @param {string} expr - The expression to transform
 * @param {string} itemVar - Name of the iteration variable
 * @param {string | null} indexVar - Name of the index variable
 * @param {Set<string>} propsSet
 * @param {Set<string>} rootVarNames - Set of signal names
 * @param {Set<string>} computedNames
 * @returns {string}
 */
export function transformForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames) {
  let r = expr;
  const excludeSet = new Set([itemVar]);
  if (indexVar) excludeSet.add(indexVar);

  for (const p of propsSet) {
    if (excludeSet.has(p)) continue;
    r = r.replace(new RegExp(`\\b${p}\\b`, 'g'), `this._s_${p}()`);
  }
  for (const n of rootVarNames) {
    if (excludeSet.has(n)) continue;
    r = r.replace(new RegExp(`\\b${n}\\b`, 'g'), `this._${n}()`);
  }
  for (const n of computedNames) {
    if (excludeSet.has(n)) continue;
    r = r.replace(new RegExp(`\\b${n}\\b`, 'g'), `this._c_${n}()`);
  }
  return r;
}

/**
 * Check if a binding name is static within an each scope (references only item/index).
 * A binding is static if it starts with itemVar + "." or equals itemVar or indexVar.
 *
 * @param {string} name - The binding name (e.g. 'item.name', 'index', 'title')
 * @param {string} itemVar
 * @param {string | null} indexVar
 * @returns {boolean}
 */
export function isStaticForBinding(name, itemVar, indexVar) {
  if (name === itemVar || name.startsWith(itemVar + '.')) return true;
  if (indexVar && name === indexVar) return true;
  return false;
}

/**
 * Check if an expression is static within an each scope (references only item/index, no component vars).
 *
 * @param {string} expr
 * @param {string} itemVar
 * @param {string | null} indexVar
 * @param {Set<string>} propsSet
 * @param {Set<string>} rootVarNames
 * @param {Set<string>} computedNames
 * @returns {boolean}
 */
export function isStaticForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames) {
  const excludeSet = new Set([itemVar]);
  if (indexVar) excludeSet.add(indexVar);

  for (const p of propsSet) {
    if (excludeSet.has(p)) continue;
    if (new RegExp(`\\b${p}\\b`).test(expr)) return false;
  }
  for (const n of rootVarNames) {
    if (excludeSet.has(n)) continue;
    if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
  }
  for (const n of computedNames) {
    if (excludeSet.has(n)) continue;
    if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
  }
  return true;
}

/**
 * Generate per-item setup code for bindings, events, show, attr, model, and slots.
 * Used by both keyed and non-keyed each effects.
 *
 * @param {string[]} lines — Output lines array
 * @param {object} forBlock — ForBlock with bindings, events, etc.
 * @param {string} itemVar
 * @param {string|null} indexVar
 * @param {Set<string>} propNames
 * @param {Set<string>} signalNamesSet
 * @param {Set<string>} computedNamesSet
 */
function generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet) {
  const indent = '        ';

  // Bindings
  for (const b of forBlock.bindings) {
    const nodeRef = pathExpr(b.path, 'node');
    if (isStaticForBinding(b.name, itemVar, indexVar)) {
      lines.push(`${indent}  ${nodeRef}.textContent = ${b.name} ?? '';`);
    } else {
      const expr = transformForExpr(b.name, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
      lines.push(`${indent}  __effect(() => { ${nodeRef}.textContent = ${expr} ?? ''; });`);
    }
  }

  // Events
  for (const e of forBlock.events) {
    const nodeRef = pathExpr(e.path, 'node');
    lines.push(`${indent}  ${nodeRef}.addEventListener('${e.event}', this._${e.handler}.bind(this));`);
  }

  // Show
  for (const sb of forBlock.showBindings) {
    const nodeRef = pathExpr(sb.path, 'node');
    if (isStaticForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet)) {
      lines.push(`${indent}  ${nodeRef}.style.display = (${sb.expression}) ? '' : 'none';`);
    } else {
      const expr = transformForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
      lines.push(`${indent}  __effect(() => { ${nodeRef}.style.display = (${expr}) ? '' : 'none'; });`);
    }
  }

  // Attr bindings
  for (const ab of forBlock.attrBindings) {
    const nodeRef = pathExpr(ab.path, 'node');
    if (isStaticForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet)) {
      lines.push(`${indent}  const __val_${ab.varName} = ${ab.expression};`);
      lines.push(`${indent}  if (__val_${ab.varName} != null && __val_${ab.varName} !== false) { ${nodeRef}.setAttribute('${ab.attr}', __val_${ab.varName}); }`);
    } else {
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
      lines.push(`${indent}  __effect(() => {`);
      lines.push(`${indent}    const __val = ${expr};`);
      lines.push(`${indent}    if (__val == null || __val === false) { ${nodeRef}.removeAttribute('${ab.attr}'); }`);
      lines.push(`${indent}    else { ${nodeRef}.setAttribute('${ab.attr}', __val); }`);
      lines.push(`${indent}  });`);
    }
  }

  // Model bindings
  for (const mb of (forBlock.modelBindings || [])) {
    const nodeRef = pathExpr(mb.path, 'node');
    lines.push(`${indent}  __effect(() => {`);
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      lines.push(`${indent}    ${nodeRef}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
    } else if (mb.prop === 'checked') {
      lines.push(`${indent}    ${nodeRef}.checked = !!this._${mb.signal}();`);
    } else {
      lines.push(`${indent}    ${nodeRef}.value = this._${mb.signal}() ?? '';`);
    }
    lines.push(`${indent}  });`);
    if (mb.prop === 'checked' && mb.radioValue === null) {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
    } else if (mb.coerce) {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
    } else {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
    }
  }

  // Scoped slots
  for (const s of (forBlock.slots || [])) {
    if (s.slotProps.length > 0) {
      const slotNodeRef = pathExpr(s.path, 'node');
      const propsEntries = s.slotProps.map(sp => `'${sp.prop}': ${sp.source}`).join(', ');
      lines.push(`${indent}  { const __slotEl = ${slotNodeRef};`);
      lines.push(`${indent}    const __sp = { ${propsEntries} };`);
      lines.push(`${indent}    let __h = __slotEl.innerHTML;`);
      lines.push(`${indent}    for (const [k, v] of Object.entries(__sp)) {`);
      lines.push(`${indent}      __h = __h.replace(new RegExp('\\\\{\\\\{\\\\s*' + k + '\\\\s*\\\\}\\\\}', 'g'), v ?? '');`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    __slotEl.innerHTML = __h;`);
      lines.push(`${indent}  }`);
    }
  }
}

/**
 * Generate a fully self-contained JS component from a ParseResult.
 *
 * @param {ParseResult} parseResult — Complete IR with bindings/events
 * @returns {string} JavaScript source code
 */
export function generateComponent(parseResult) {
  const {
    tagName,
    className,
    style,
    signals,
    computeds,
    effects,
    methods,
    bindings,
    events,
    processedTemplate,
    propDefs = [],
    propsObjectName = null,
    emits = [],
    emitsObjectName = null,
    ifBlocks = [],
    showBindings = [],
    forBlocks = [],
    onMountHooks = [],
    onDestroyHooks = [],
    modelBindings = [],
    attrBindings = [],
    slots = [],
    constantVars = [],
    watchers = [],
    refs = [],
    refBindings = [],
    childComponents = [],
    childImports = [],
  } = parseResult;

  const signalNames = signals.map(s => s.name);
  const computedNames = computeds.map(c => c.name);
  const constantNames = constantVars.map(v => v.name);
  const refVarNames = refs.map(r => r.varName);
  const propNames = new Set(propDefs.map(p => p.name));

  const lines = [];

  // ── 1. Inline reactive runtime ──
  lines.push(reactiveRuntime.trim());
  lines.push('');

  // ── 1b. Child component imports ──
  for (const ci of childImports) {
    lines.push(`import '${ci.importPath}';`);
  }
  if (childImports.length > 0) {
    lines.push('');
  }

  // ── 2. CSS injection (scoped CSS into document.head, always) ──
  if (style) {
    const scoped = scopeCSS(style, tagName);
    lines.push(`const __css_${className} = document.createElement('style');`);
    lines.push(`__css_${className}.textContent = \`${scoped}\`;`);
    lines.push(`document.head.appendChild(__css_${className});`);
    lines.push('');
  }

  // ── 3. Template element ──
  lines.push(`const __t_${className} = document.createElement('template');`);
  lines.push(`__t_${className}.innerHTML = \`${processedTemplate || ''}\`;`);
  lines.push('');

  // ── 4. HTMLElement class ──
  lines.push(`class ${className} extends HTMLElement {`);

  // Static observedAttributes (if props exist)
  if (propDefs.length > 0) {
    const attrNames = propDefs.map(p => `'${p.attrName}'`).join(', ');
    lines.push(`  static get observedAttributes() { return [${attrNames}]; }`);
    lines.push('');
  }

  // Constructor
  lines.push('  constructor() {');
  lines.push('    super();');

  // Slot resolution: read childNodes BEFORE clearing innerHTML (when slots are present)
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

  // Clone template
  lines.push(`    const __root = __t_${className}.content.cloneNode(true);`);

  // Assign DOM refs for bindings
  for (const b of bindings) {
    lines.push(`    this.${b.varName} = ${pathExpr(b.path, '__root')};`);
  }

  // Assign DOM refs for events
  for (const e of events) {
    lines.push(`    this.${e.varName} = ${pathExpr(e.path, '__root')};`);
  }

  // Assign DOM refs for show bindings
  for (const sb of showBindings) {
    lines.push(`    this.${sb.varName} = ${pathExpr(sb.path, '__root')};`);
  }

  // Assign DOM refs for model bindings
  for (const mb of modelBindings) {
    lines.push(`    this.${mb.varName} = ${pathExpr(mb.path, '__root')};`);
  }

  // Assign DOM refs for slot placeholders
  for (const s of slots) {
    lines.push(`    this.${s.varName} = ${pathExpr(s.path, '__root')};`);
  }

  // Assign DOM refs for child component instances
  for (const cc of childComponents) {
    lines.push(`    this.${cc.varName} = ${pathExpr(cc.path, '__root')};`);
  }

  // Assign DOM refs for attr bindings (reuse ref when same path)
  const attrPathMap = new Map();
  for (const ab of attrBindings) {
    const pathKey = ab.path.join('.');
    if (attrPathMap.has(pathKey)) {
      lines.push(`    this.${ab.varName} = this.${attrPathMap.get(pathKey)};`);
    } else {
      lines.push(`    this.${ab.varName} = ${pathExpr(ab.path, '__root')};`);
      attrPathMap.set(pathKey, ab.varName);
    }
  }

  // Prop signal initialization (BEFORE user signals)
  for (const p of propDefs) {
    lines.push(`    this._s_${p.name} = __signal(${p.default});`);
  }

  // Signal initialization
  for (const s of signals) {
    lines.push(`    this._${s.name} = __signal(${s.value});`);
  }

  // Constant initialization
  for (const c of constantVars) {
    lines.push(`    this._const_${c.name} = ${c.value};`);
  }

  // Computed initialization
  for (const c of computeds) {
    const body = transformExpr(c.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
    lines.push(`    this._c_${c.name} = __computed(() => ${body});`);
  }

  // Watcher prev-value initialization
  for (const w of watchers) {
    lines.push(`    this.__prev_${w.target} = undefined;`);
  }

  // ── if: template creation, anchor reference, state init ──
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    // Template per branch
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      lines.push(`    this.${vn}_t${i} = document.createElement('template');`);
      lines.push(`    this.${vn}_t${i}.innerHTML = \`${branch.templateHtml}\`;`);
    }
    // Reference to anchor comment node (must be before appendChild moves nodes out of __root)
    lines.push(`    this.${vn}_anchor = ${pathExpr(ifBlock.anchorPath, '__root')};`);
    // Active branch state
    lines.push(`    this.${vn}_current = null;`);
    lines.push(`    this.${vn}_active = undefined;`);
  }

  // ── each: template creation, anchor reference, nodes array ──
  for (const forBlock of forBlocks) {
    const vn = forBlock.varName;
    lines.push(`    this.${vn}_tpl = document.createElement('template');`);
    lines.push(`    this.${vn}_tpl.innerHTML = \`${forBlock.templateHtml}\`;`);
    lines.push(`    this.${vn}_anchor = ${pathExpr(forBlock.anchorPath, '__root')};`);
    lines.push(`    this.${vn}_nodes = [];`);
  }

  // ── Ref DOM reference assignments (before appendChild moves nodes) ──
  for (const rb of refBindings) {
    lines.push(`    this._ref_${rb.refName} = ${pathExpr(rb.path, '__root')};`);
  }

  // Append DOM (always light DOM)
  lines.push("    this.innerHTML = '';");
  lines.push('    this.appendChild(__root);');

  // Static slot injection (after DOM is appended)
  for (const s of slots) {
    if (s.name && s.slotProps.length > 0) {
      // Scoped slot: store consumer template or fallback for reactive effect in connectedCallback
      lines.push(`    if (__slotMap['${s.name}']) { this.__slotTpl_${s.name} = __slotMap['${s.name}'].content; }`);
      if (s.defaultContent) {
        lines.push(`    else { this.__slotTpl_${s.name} = \`${s.defaultContent}\`; }`);
      }
    } else if (s.name) {
      // Named slot: inject content directly
      lines.push(`    if (__slotMap['${s.name}']) { this.${s.varName}.innerHTML = __slotMap['${s.name}'].content; }`);
    } else {
      // Default slot: inject collected child nodes
      lines.push(`    if (__defaultSlotNodes.length) { this.${s.varName}.textContent = ''; __defaultSlotNodes.forEach(n => this.${s.varName}.appendChild(n.cloneNode(true))); }`);
    }
  }

  lines.push('  }');
  lines.push('');

  // connectedCallback
  lines.push('  connectedCallback() {');

  // Binding effects — one __effect per binding
  for (const b of bindings) {
    if (b.type === 'prop') {
      lines.push('    __effect(() => {');
      lines.push(`      this.${b.varName}.textContent = this._s_${b.name}() ?? '';`);
      lines.push('    });');
    } else if (b.type === 'signal') {
      lines.push('    __effect(() => {');
      lines.push(`      this.${b.varName}.textContent = this._${b.name}() ?? '';`);
      lines.push('    });');
    } else if (b.type === 'computed') {
      lines.push('    __effect(() => {');
      lines.push(`      this.${b.varName}.textContent = this._c_${b.name}() ?? '';`);
      lines.push('    });');
    } else {
      // method type — call the method
      lines.push('    __effect(() => {');
      lines.push(`      this.${b.varName}.textContent = this._${b.name}() ?? '';`);
      lines.push('    });');
    }
  }

  // Scoped slot effects — reactive resolution of {{propName}} in consumer templates
  for (const s of slots) {
    if (s.name && s.slotProps.length > 0) {
      const propsObj = s.slotProps.map(sp => {
        const ref = slotPropRef(sp.source, signalNames, computedNames, propNames);
        return `${sp.prop}: ${ref}`;
      }).join(', ');
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

  // Child component reactive prop bindings
  for (const cc of childComponents) {
    for (const pb of cc.propBindings) {
      let ref;
      if (pb.type === 'prop') {
        ref = `this._s_${pb.expr}()`;
      } else if (pb.type === 'computed') {
        ref = `this._c_${pb.expr}()`;
      } else if (pb.type === 'signal') {
        ref = `this._${pb.expr}()`;
      } else if (pb.type === 'constant') {
        ref = `this._const_${pb.expr}`;
      } else {
        ref = `this._${pb.expr}()`;
      }
      lines.push('    __effect(() => {');
      lines.push(`      this.${cc.varName}.setAttribute('${pb.attr}', ${ref} ?? '');`);
      lines.push('    });');
    }
  }

  // User effects
  for (const eff of effects) {
    const body = transformMethodBody(eff.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
    lines.push('    __effect(() => {');
    // Indent each line of the body
    const bodyLines = body.split('\n');
    for (const line of bodyLines) {
      lines.push(`      ${line}`);
    }
    lines.push('    });');
  }

  // Watcher effects
  for (const w of watchers) {
    // Determine the signal reference for the watch target
    let watchRef;
    if (propNames.has(w.target)) {
      watchRef = `this._s_${w.target}()`;
    } else if (computedNames.includes(w.target)) {
      watchRef = `this._c_${w.target}()`;
    } else {
      watchRef = `this._${w.target}()`;
    }
    const body = transformMethodBody(w.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
    lines.push('    __effect(() => {');
    lines.push(`      const ${w.newParam} = ${watchRef};`);
    lines.push(`      if (this.__prev_${w.target} !== undefined) {`);
    lines.push(`        const ${w.oldParam} = this.__prev_${w.target};`);
    const bodyLines = body.split('\n');
    for (const line of bodyLines) {
      lines.push(`        ${line}`);
    }
    lines.push('      }');
    lines.push(`      this.__prev_${w.target} = ${w.newParam};`);
    lines.push('    });');
  }

  // Event listeners
  for (const e of events) {
    lines.push(`    this.${e.varName}.addEventListener('${e.event}', this._${e.handler}.bind(this));`);
  }

  // Show effects — one __effect per ShowBinding
  for (const sb of showBindings) {
    const expr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
    lines.push('    __effect(() => {');
    lines.push(`      this.${sb.varName}.style.display = (${expr}) ? '' : 'none';`);
    lines.push('    });');
  }

  // Model effects — signal → DOM (one __effect per ModelBinding)
  for (const mb of modelBindings) {
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      // Radio: compare signal value to radioValue
      lines.push('    __effect(() => {');
      lines.push(`      this.${mb.varName}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
      lines.push('    });');
    } else if (mb.prop === 'checked') {
      // Checkbox: coerce to boolean
      lines.push('    __effect(() => {');
      lines.push(`      this.${mb.varName}.checked = !!this._${mb.signal}();`);
      lines.push('    });');
    } else {
      // Value-based (text, number, textarea, select): nullish coalesce to ''
      lines.push('    __effect(() => {');
      lines.push(`      this.${mb.varName}.value = this._${mb.signal}() ?? '';`);
      lines.push('    });');
    }
  }

  // Model event listeners — DOM → signal (one addEventListener per ModelBinding)
  for (const mb of modelBindings) {
    if (mb.prop === 'checked' && mb.radioValue === null) {
      // Checkbox: read e.target.checked
      lines.push(`    this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
    } else if (mb.coerce) {
      // Number input: wrap in Number()
      lines.push(`    this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
    } else {
      // All others: read e.target.value
      lines.push(`    this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
    }
  }

  // Attr binding effects — one __effect per AttrBinding
  for (const ab of attrBindings) {
    const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
    if (ab.kind === 'attr') {
      lines.push('    __effect(() => {');
      lines.push(`      const __v = ${expr};`);
      lines.push(`      if (__v || __v === '') { this.${ab.varName}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`      else { this.${ab.varName}.removeAttribute('${ab.attr}'); }`);
      lines.push('    });');
    } else if (ab.kind === 'bool') {
      lines.push('    __effect(() => {');
      lines.push(`      this.${ab.varName}.${ab.attr} = !!(${expr});`);
      lines.push('    });');
    } else if (ab.kind === 'class') {
      if (ab.expression.trimStart().startsWith('{')) {
        // Object expression: iterate entries, classList.add/remove
        lines.push('    __effect(() => {');
        lines.push(`      const __obj = ${expr};`);
        lines.push('      for (const [__k, __val] of Object.entries(__obj)) {');
        lines.push(`        __val ? this.${ab.varName}.classList.add(__k) : this.${ab.varName}.classList.remove(__k);`);
        lines.push('      }');
        lines.push('    });');
      } else {
        // String expression: set className
        lines.push('    __effect(() => {');
        lines.push(`      this.${ab.varName}.className = ${expr};`);
        lines.push('    });');
      }
    } else if (ab.kind === 'style') {
      if (ab.expression.trimStart().startsWith('{')) {
        // Object expression: iterate entries, set style[key]
        lines.push('    __effect(() => {');
        lines.push(`      const __obj = ${expr};`);
        lines.push('      for (const [__k, __val] of Object.entries(__obj)) {');
        lines.push(`        this.${ab.varName}.style[__k] = __val;`);
        lines.push('      }');
        lines.push('    });');
      } else {
        // String expression: set cssText
        lines.push('    __effect(() => {');
        lines.push(`      this.${ab.varName}.style.cssText = ${expr};`);
        lines.push('    });');
      }
    }
  }

  // ── if effects ──
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    lines.push('    __effect(() => {');
    lines.push('      let __branch = null;');
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      if (branch.type === 'if') {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
        lines.push(`      if (${expr}) { __branch = ${i}; }`);
      } else if (branch.type === 'else-if') {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
        lines.push(`      else if (${expr}) { __branch = ${i}; }`);
      } else {
        // else
        lines.push(`      else { __branch = ${i}; }`);
      }
    }
    lines.push(`      if (__branch === this.${vn}_active) return;`);
    // Remove previous branch
    lines.push(`      if (this.${vn}_current) { this.${vn}_current.remove(); this.${vn}_current = null; }`);
    // Insert new branch
    lines.push('      if (__branch !== null) {');
    const tplArray = ifBlock.branches.map((_, i) => `this.${vn}_t${i}`).join(', ');
    lines.push(`        const tpl = [${tplArray}][__branch];`);
    lines.push('        const clone = tpl.content.cloneNode(true);');
    lines.push('        const node = clone.firstChild;');
    lines.push(`        this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
    lines.push(`        this.${vn}_current = node;`);
    // Setup bindings/events for active branch (only if any branch has bindings/events)
    const hasSetup = ifBlock.branches.some(b =>
      (b.bindings && b.bindings.length > 0) ||
      (b.events && b.events.length > 0) ||
      (b.showBindings && b.showBindings.length > 0) ||
      (b.attrBindings && b.attrBindings.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0)
    );
    if (hasSetup) {
      lines.push(`        this.${vn}_setup(node, __branch);`);
    }
    lines.push('      }');
    lines.push(`      this.${vn}_active = __branch;`);
    lines.push('    });');
  }

  // ── each effects ──
  for (const forBlock of forBlocks) {
    const vn = forBlock.varName;
    const { itemVar, indexVar, source, keyExpr } = forBlock;

    const signalNamesSet = new Set(signalNames);
    const computedNamesSet = new Set(computedNames);

    // Transform the source expression
    const sourceExpr = transformForExpr(source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);

    lines.push('    __effect(() => {');
    lines.push(`      const __source = ${sourceExpr};`);
    lines.push('');
    lines.push("      const __iter = typeof __source === 'number'");
    lines.push('        ? Array.from({ length: __source }, (_, i) => i + 1)');
    lines.push('        : (__source || []);');
    lines.push('');

    if (keyExpr) {
      // ── Keyed reconciliation ──
      lines.push(`      const __oldMap = this.${vn}_keyMap || new Map();`);
      lines.push('      const __newMap = new Map();');
      lines.push('      const __newNodes = [];');
      lines.push('');
      lines.push(`      __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`        const __key = ${keyExpr};`);
      lines.push('        if (__oldMap.has(__key)) {');
      lines.push('          const node = __oldMap.get(__key);');
      lines.push('          __newMap.set(__key, node);');
      lines.push('          __newNodes.push(node);');
      lines.push('          __oldMap.delete(__key);');
      lines.push('        } else {');
      lines.push(`          const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push('          const node = clone.firstChild;');

      // Setup bindings/events/show/attr/model/slots for NEW nodes only
      // (reused nodes keep their existing bindings)
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);

      lines.push('          __newMap.set(__key, node);');
      lines.push('          __newNodes.push(node);');
      lines.push('        }');
      lines.push('      });');
      lines.push('');
      lines.push('      // Remove nodes no longer in the list');
      lines.push('      for (const n of __oldMap.values()) n.remove();');
      lines.push('');
      lines.push('      // Reorder: insert all nodes in correct order before anchor');
      lines.push(`      for (const n of __newNodes) this.${vn}_anchor.parentNode.insertBefore(n, this.${vn}_anchor);`);
      lines.push('');
      lines.push(`      this.${vn}_nodes = __newNodes;`);
      lines.push(`      this.${vn}_keyMap = __newMap;`);
      lines.push('    });');
    } else {
      // ── Non-keyed: destroy all and recreate (original behavior) ──
      lines.push(`      for (const n of this.${vn}_nodes) n.remove();`);
      lines.push(`      this.${vn}_nodes = [];`);
      lines.push('');
      lines.push(`      __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`        const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push('        const node = clone.firstChild;');

      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);

      lines.push(`        this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
      lines.push(`        this.${vn}_nodes.push(node);`);
      lines.push('      });');
      lines.push('    });');
    }
  }

  // Lifecycle: onMount hooks (at the very end of connectedCallback)
  for (const hook of onMountHooks) {
    const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
    if (hook.async) {
      lines.push('    (async () => {');
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        lines.push(`      ${line}`);
      }
      lines.push('    })();');
    } else {
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        lines.push(`    ${line}`);
      }
    }
  }

  lines.push('  }');
  lines.push('');

  // disconnectedCallback (only when destroy hooks exist)
  if (onDestroyHooks.length > 0) {
    lines.push('  disconnectedCallback() {');
    for (const hook of onDestroyHooks) {
      const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
      if (hook.async) {
        lines.push('    (async () => {');
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          lines.push(`      ${line}`);
        }
        lines.push('    })();');
      } else {
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          lines.push(`    ${line}`);
        }
      }
    }
    lines.push('  }');
    lines.push('');
  }

  // attributeChangedCallback (if props exist)
  if (propDefs.length > 0) {
    lines.push('  attributeChangedCallback(name, oldVal, newVal) {');
    for (const p of propDefs) {
      const defaultVal = p.default;
      let updateExpr;

      if (defaultVal === 'true' || defaultVal === 'false') {
        // Boolean coercion: attribute presence = true
        updateExpr = `this._s_${p.name}(newVal != null)`;
      } else if (/^-?\d+(\.\d+)?$/.test(defaultVal)) {
        // Number coercion
        updateExpr = `this._s_${p.name}(newVal != null ? Number(newVal) : ${defaultVal})`;
      } else if (defaultVal === 'undefined') {
        // Undefined default — pass through
        updateExpr = `this._s_${p.name}(newVal)`;
      } else {
        // String default — use nullish coalescing
        updateExpr = `this._s_${p.name}(newVal ?? ${defaultVal})`;
      }

      lines.push(`    if (name === '${p.attrName}') ${updateExpr};`);
    }
    lines.push('  }');
    lines.push('');

    // Public getters and setters
    for (const p of propDefs) {
      lines.push(`  get ${p.name}() { return this._s_${p.name}(); }`);
      lines.push(`  set ${p.name}(val) { this._s_${p.name}(val); this.setAttribute('${p.attrName}', String(val)); }`);
      lines.push('');
    }
  }

  // _emit method (if emits declared)
  if (emits.length > 0) {
    lines.push('  _emit(name, detail) {');
    lines.push('    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));');
    lines.push('  }');
    lines.push('');
  }

  // User methods (prefixed with _)
  for (const m of methods) {
    const body = transformMethodBody(m.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
    lines.push(`  _${m.name}(${m.params}) {`);
    const bodyLines = body.split('\n');
    for (const line of bodyLines) {
      lines.push(`    ${line}`);
    }
    lines.push('  }');
    lines.push('');
  }

  // ── Ref getter properties ──
  for (const rd of refs) {
    // Find matching RefBinding
    const rb = refBindings.find(b => b.refName === rd.refName);
    if (rb) {
      lines.push(`  get _${rd.varName}() { return { value: this._ref_${rd.refName} }; }`);
      lines.push('');
    }
  }

  // ── if setup methods ──
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    const hasSetup = ifBlock.branches.some(b =>
      (b.bindings && b.bindings.length > 0) ||
      (b.events && b.events.length > 0) ||
      (b.showBindings && b.showBindings.length > 0) ||
      (b.attrBindings && b.attrBindings.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0)
    );
    if (!hasSetup) continue;

    lines.push(`  ${vn}_setup(node, branch) {`);
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      const hasBranchSetup =
        (branch.bindings && branch.bindings.length > 0) ||
        (branch.events && branch.events.length > 0) ||
        (branch.showBindings && branch.showBindings.length > 0) ||
        (branch.attrBindings && branch.attrBindings.length > 0) ||
        (branch.modelBindings && branch.modelBindings.length > 0);
      if (!hasBranchSetup) continue;

      const keyword = i === 0 ? 'if' : 'else if';
      lines.push(`    ${keyword} (branch === ${i}) {`);

      // Bindings: generate DOM refs and effects for text bindings
      for (const b of branch.bindings) {
        lines.push(`      const ${b.varName} = ${pathExpr(b.path, 'node')};`);
        if (b.type === 'prop') {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._s_${b.name}() ?? ''; });`);
        } else if (b.type === 'signal') {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._${b.name}() ?? ''; });`);
        } else if (b.type === 'computed') {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._c_${b.name}() ?? ''; });`);
        } else {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._${b.name}() ?? ''; });`);
        }
      }

      // Events: generate addEventListener
      for (const e of branch.events) {
        lines.push(`      const ${e.varName} = ${pathExpr(e.path, 'node')};`);
        lines.push(`      ${e.varName}.addEventListener('${e.event}', this._${e.handler}.bind(this));`);
      }

      // Show bindings: generate effects
      for (const sb of branch.showBindings) {
        const expr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
        lines.push(`      const ${sb.varName} = ${pathExpr(sb.path, 'node')};`);
        lines.push(`      __effect(() => { ${sb.varName}.style.display = (${expr}) ? '' : 'none'; });`);
      }

      // Attr bindings: generate effects
      for (const ab of branch.attrBindings) {
        const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
        lines.push(`      const ${ab.varName} = ${pathExpr(ab.path, 'node')};`);
        lines.push(`      __effect(() => {`);
        lines.push(`        const __val = ${expr};`);
        lines.push(`        if (__val == null || __val === false) { ${ab.varName}.removeAttribute('${ab.attr}'); }`);
        lines.push(`        else { ${ab.varName}.setAttribute('${ab.attr}', __val); }`);
        lines.push(`      });`);
      }

      // Model bindings: generate effects and listeners
      for (const mb of (branch.modelBindings || [])) {
        const nodeRef = pathExpr(mb.path, 'node');
        lines.push(`      const ${mb.varName} = ${nodeRef};`);
        // Effect (signal → DOM)
        lines.push(`      __effect(() => {`);
        if (mb.prop === 'checked' && mb.radioValue !== null) {
          lines.push(`        ${mb.varName}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
        } else if (mb.prop === 'checked') {
          lines.push(`        ${mb.varName}.checked = !!this._${mb.signal}();`);
        } else {
          lines.push(`        ${mb.varName}.value = this._${mb.signal}() ?? '';`);
        }
        lines.push(`      });`);
        // Listener (DOM → signal)
        if (mb.prop === 'checked' && mb.radioValue === null) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
        } else if (mb.coerce) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
        } else {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
        }
      }

      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  }

  lines.push('}');
  lines.push('');

  // ── 5. Custom element registration ──
  lines.push(`customElements.define('${tagName}', ${className});`);

  return lines.join('\n');
}
