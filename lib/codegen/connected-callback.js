/**
 * connectedCallback generation — DOM setup, slot resolution, template cloning,
 * block anchors, refs, event listeners, model listeners, lifecycle hooks.
 */

import { pathExpr, transformExpr, transformMethodBody } from '../transform/expr-transformer.js';
import { generateEventHandler } from './event-generator.js';
import { camelToKebab } from '../parser-extractors.js';

/**
 * @param {string[]} lines
 * @param {import('../types.js').ParseResult} parseResult
 * @param {object} opts
 * @param {boolean} [opts.comments]
 * @param {{ show: any[] }} [opts.classifiedEffectBindings]
 */
export function generateConnectedCallback(lines, parseResult, opts = {}) {
  const comment = opts.comments ? (text) => lines.push(`    // --- ${text} ---`) : () => {};

  const {
    className,
    signals = [],
    computeds = [],
    methods = [],
    bindings = [],
    events = [],
    processedTemplate,
    propDefs = [],
    propsObjectName = null,
    emits = [],
    emitsObjectName = null,
    ifBlocks = [],
    showBindings = [],
    forBlocks = [],
    onMountHooks = [],
    modelBindings = [],
    modelPropBindings = [],
    attrBindings = [],
    slots = [],
    constantVars = [],
    refBindings = [],
    childComponents = [],
    modelDefs = [],
    dynamicComponents = [],
    usesBatch = false,
  } = parseResult;

  const signalNames = signals.map(s => s.name);
  const computedNames = computeds.map(c => c.name);
  const constantNames = constantVars.map(v => v.name);
  const methodNames = methods.map(m => m.name);
  const refVarNames = opts.refVarNames || [];
  const propNames = new Set(propDefs.map(p => p.name));
  const signalNamesSet = new Set(signalNames);
  const computedNamesSet = new Set(computedNames);

  const modelVarMap = new Map();
  for (const md of modelDefs) {
    modelVarMap.set(md.varName, md.name);
  }

  const classifiedEffectBindings = opts.classifiedEffectBindings || { show: [] };

  // connectedCallback (idempotent — safe for re-mount)
  lines.push('  connectedCallback() {');
  lines.push('    if (this.__connected) return;');
  lines.push('    this.__connected = true;');

  // ── DOM SETUP (moved from constructor for Custom Elements spec compliance) ──

  // Slot resolution: read childNodes BEFORE clearing innerHTML (when slots are present)
  if (slots.length > 0) {
    lines.push('    const __slotMap = {};');
    lines.push('    const __defaultSlotNodes = [];');
    lines.push('    const __templatesToRemove = [];');
    lines.push('    for (const child of Array.from(this.childNodes)) {');
    lines.push("      if (child.nodeName === 'TEMPLATE') {");
    lines.push('        let handled = false;');
    lines.push('        for (const attr of child.attributes) {');
    lines.push("          if (attr.name.startsWith('#')) {");
    lines.push('            const slotName = attr.name.slice(1);');
    lines.push('            __slotMap[slotName] = { content: child.innerHTML, propsExpr: attr.value };');
    lines.push('            handled = true;');
    lines.push('          } else if (attr.name === "slot") {');
    // NEW: <template slot="name"> syntax (Vue standard)
    lines.push('            const slotName = attr.value;');
    lines.push("            const propsExpr = child.getAttribute('slot-props') || '';");
    lines.push("            child.removeAttribute('slot-props');");
    lines.push('            __slotMap[slotName] = { content: child.innerHTML, propsExpr };');
    lines.push('            handled = true;');
    lines.push('          }');
    lines.push('        }');
    lines.push('        if (handled) __templatesToRemove.push(child);');
    lines.push("      } else if (child.nodeType === 1 && child.getAttribute('slot')) {");
    // NEW: regular element with slot="name" (cross-framework support)
    lines.push("        const slotName = child.getAttribute('slot');");
    lines.push("        const propsExpr = child.getAttribute('slot-props') || '';");
    lines.push("        child.removeAttribute('slot');");
    lines.push("        child.removeAttribute('slot-props');");
    lines.push("        __slotMap[slotName] = { content: propsExpr ? child.innerHTML : child.outerHTML, propsExpr };");
    lines.push("      } else if (child.nodeType === 1) {");
    lines.push("        __defaultSlotNodes.push(child);");
    lines.push("      } else if (child.nodeType === 3 && child.textContent.trim()) {");
    lines.push('        __defaultSlotNodes.push(child);');
    lines.push('      }');
    lines.push('    }');
    // Remove processed template elements to prevent them from appearing in default slot
    lines.push('    for (const tpl of __templatesToRemove) {');
    lines.push('      if (tpl.parentNode) tpl.parentNode.removeChild(tpl);');
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

  // Assign DOM refs for model:propName bindings
  for (const mpb of modelPropBindings) {
    lines.push(`    this.${mpb.varName} = ${pathExpr(mpb.path, '__root')};`);
  }

  // Assign DOM refs for slot placeholders
  for (const s of slots) {
    lines.push(`    this.${s.varName} = ${pathExpr(s.path, '__root')};`);
  }

  // Assign DOM refs for child component instances (only if they have prop bindings)
  for (const cc of childComponents) {
    if (cc.propBindings.length > 0) {
      lines.push(`    this.${cc.varName} = ${pathExpr(cc.path, '__root')};`);
    }
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
    lines.push(`    this.${vn}_anchor = findAnchor(__root, '${ifBlock.anchorType}', ${ifBlock.anchorIndex});`);
    // Active branch state
    lines.push(`    this.${vn}_current = null;`);
    lines.push(`    this.${vn}_active = undefined;`);
  }

  // ── each: template creation, anchor reference, nodes array, items array ──
  for (const forBlock of forBlocks) {
    const vn = forBlock.varName;
    lines.push(`    this.${vn}_tpl = document.createElement('template');`);
    lines.push(`    this.${vn}_tpl.innerHTML = \`${forBlock.templateHtml}\`;`);
    lines.push(`    this.${vn}_anchor = findAnchor(__root, '${forBlock.anchorType}', ${forBlock.anchorIndex});`);
    lines.push(`    this.${vn}_nodes = [];`);
    lines.push(`    this.${vn}_items = [];`);
  }

  // ── dynamic component: anchor reference, state init ──
  for (const dyn of dynamicComponents) {
    const vn = dyn.varName;
    lines.push(`    this.${vn}_anchor = findAnchor(__root, '${dyn.anchorType}', ${dyn.anchorIndex});`);
    lines.push(`    this.${vn}_current = null;`);
    lines.push(`    this.${vn}_tag = null;`);
    lines.push(`    this.${vn}_propDisposers = [];`);
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

  // ── Deferred slot re-check (Angular compatibility) ──
  // Angular connects custom elements to DOM BEFORE projecting children.
  // If no slot content was found on first pass, schedule a microtask retry.
  // We save a reference to the rendered root node so the microtask can filter it out
  // and only process children that were projected by the framework after connectedCallback.
  if (slots.length > 0) {
    lines.push('    if (Object.keys(__slotMap).length === 0 && __defaultSlotNodes.length === 0) {');
    lines.push('      const __renderedRoot = this.firstElementChild;');
    lines.push('      queueMicrotask(() => {');
    lines.push('        const __sm = {};');
    lines.push('        const __dn = [];');
    lines.push('        for (const child of Array.from(this.childNodes)) {');
    // Skip the rendered template root and any whitespace text nodes that were there before
    lines.push('          if (child === __renderedRoot) continue;');
    lines.push('          if (child.nodeType === 3 && !child.textContent.trim()) continue;');
    lines.push("          if (child.nodeName === 'TEMPLATE') {");
    lines.push('            for (const attr of child.attributes) {');
    lines.push("              if (attr.name.startsWith('#')) {");
    lines.push("                __sm[attr.name.slice(1)] = { content: child.innerHTML, propsExpr: attr.value };");
    lines.push('              }');
    lines.push('            }');
    lines.push("          } else if (child.nodeType === 1 && child.getAttribute('slot')) {");
    lines.push("            const sn = child.getAttribute('slot');");
    lines.push("            const pe = child.getAttribute('slot-props') || '';");
    lines.push("            child.removeAttribute('slot');");
    lines.push("            child.removeAttribute('slot-props');");
    lines.push("            __sm[sn] = { content: pe ? child.innerHTML : child.outerHTML, propsExpr: pe };");
    lines.push("            child.remove();");
    lines.push("          } else if (child.nodeType === 1) {");
    lines.push("            __dn.push(child);");
    lines.push("          } else if (child.nodeType === 3 && child.textContent.trim()) {");
    lines.push("            __dn.push(child);");
    lines.push('          }');
    lines.push('        }');
    // Re-inject slots if we found content this time
    lines.push('        if (Object.keys(__sm).length > 0 || __dn.length > 0) {');
    for (const s of slots) {
      if (s.name && s.slotProps.length > 0) {
        lines.push(`          if (__sm['${s.name}']) {`);
        lines.push(`            this.__slotTpl_${s.name} = __sm['${s.name}'].content;`);
        if (s.slotProps.length > 0 && s.slotProps[0].source) {
          lines.push(`            this._${s.slotProps[0].source}.set(this._${s.slotProps[0].source}());`);
        }
        lines.push(`          }`);
      } else if (s.name) {
        lines.push(`          if (__sm['${s.name}']) { this.${s.varName}.innerHTML = __sm['${s.name}'].content; }`);
      } else {
        lines.push(`          if (__dn.length) { this.${s.varName}.textContent = ''; __dn.forEach(n => this.${s.varName}.appendChild(n.cloneNode(true))); }`);
      }
    }
    lines.push('        }');
    lines.push('      });');
    lines.push('    }');
  }

  // Phase 4: ALL features migrated to __invalidate — no __effect needed
  lines.push('    this.__ac = new AbortController();');
  lines.push('');

  // Phase 4: Static constant bindings (no __effect needed, __invalidate handles everything)
  for (const b of bindings) {
    if (b.type === 'constant') {
      const constDef = constantVars.find(c => c.name === b.name);
      const isFunction = constDef && /^\s*(\(|function\b)/.test(constDef.value);
      if (!isFunction) {
        lines.push(`    this.${b.varName}.textContent = this._const_${b.name} ?? '';`);
      }
    }
  }

  // Phase 4: Scoped slots handled by __invalidate. No __effect needed.
  // Scoped slot event listeners and token replacement are done in __invalidate cases.

  // Phase 4: Child component prop bindings handled by __invalidate

  // Phase 4: User effects removed — error emitted at compile time if effects.length > 0
  if (parseResult.effects && parseResult.effects.length > 0) {
    throw new Error('effect() has been removed. Use watch() for reactive side effects.');
  }

  // Phase 2: Watchers are now handled by __invalidate. No __effect wrappers needed.
  // Old-value tracking is initialized in the constructor.
  // Watcher callbacks are invoked from __invalidate cases.

  // Event listeners (with AbortController signal for cleanup)
  if (events.length > 0) comment('Event listeners');
  for (const e of events) {
    const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
    lines.push(`    if (this.${e.varName}) this.${e.varName}.addEventListener('${e.event}', ${handlerExpr}, { signal: this.__ac.signal });`);
  }

  // Phase 4: Model bindings (signal → DOM) handled by __invalidate cases.
  // Only model event listeners (DOM → signal) stay in connectedCallback.

  // Model event listeners — DOM → signal (with AbortController signal)
  for (const mb of modelBindings) {
    const assign = modelVarMap.has(mb.signal)
      ? `this._modelSet_${mb.signal}(`
      : `this._state.${mb.signal} = `;
    if (mb.prop === 'checked' && mb.radioValue === null) {
      // Checkbox: read e.target.checked
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { ${assign}e.target.checked${modelVarMap.has(mb.signal) ? ')' : ';' } }, { signal: this.__ac.signal });`);
    } else if (mb.coerce) {
      // Number input: wrap in Number()
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { ${assign}Number(e.target.value)${modelVarMap.has(mb.signal) ? ')' : ';' } }, { signal: this.__ac.signal });`);
    } else {
      // All others: read e.target.value
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { ${assign}e.target.value${modelVarMap.has(mb.signal) ? ')' : ';' } }, { signal: this.__ac.signal });`);
    }
  }

  // Phase 4: model:propName effects handled by __invalidate.
  // Only child → parent wcc:model listener stays in connectedCallback.
  for (const mpb of modelPropBindings) {
    const attrName = camelToKebab(mpb.propName);

    // Child → parent sync: listen for wcc:model on child, update parent signal
    lines.push(`    this.${mpb.varName}.addEventListener('wcc:model', (e) => {`);
    lines.push(`      if (e.detail.prop === '${mpb.propName}') {`);
    const isModelVar = modelVarMap.has(mpb.signal);
    if (isModelVar) {
      lines.push(`        this._state.${modelVarMap.get(mpb.signal)} = e.detail.value;`);
    } else {
      lines.push(`        this._state.${mpb.signal} = e.detail.value;`);
    }
    lines.push('      }');
    lines.push('    }, { signal: this.__ac.signal });');
  }

  // Lifecycle: onMount hooks (at the very end of connectedCallback)
  for (const hook of onMountHooks) {
    const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
    if (hook.async) {
      lines.push('    ;(async () => {');
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        lines.push(`      ${line}`);
      }
      lines.push('    })();');
    } else {
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        const trimmed = line.trimEnd();
        const needsSemi = trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}');
        lines.push(`    ${trimmed}${needsSemi ? ';' : ''}`);
      }
    }
  }

  // Initial render of all bindings via __invalidate
  if (opts.hasDepGraph) {
    lines.push("    this.__invalidate('*');");
  }

  // Close connectedCallback
  lines.push('  }');
  lines.push('');
}
