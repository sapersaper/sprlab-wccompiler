/**
 * Render methods generation — __renderIf_N, __renderEach_N, __renderDynamic_N,
 * if-branch setup methods, plus item setup helpers (generateItemSetup /
 * generateNestedItemSetup) used in for-loop rendering.
 */

import { pathExpr, wrapTernaryExpr, transformExpr } from '../transform/expr-transformer.js';
import { transformForExpr } from '../transform/for-transformer.js';
import { generateEventHandler, generateForEventHandler } from './event-generator.js';

/**
 * @param {string[]} lines
 * @param {import('../types.js').ParseResult} parseResult
 * @param {object} state
 * @param {string[]} state.signalNames
 * @param {string[]} state.computedNames
 * @param {string[]} state.methodNames
 * @param {string[]} state.constantNames
 * @param {Set<string>} state.propNames
 * @param {string|null} state.propsObjectName
 * @param {string|null} state.emitsObjectName
 * @param {Map<string,string>} state.modelVarMap
 */
export function generateRenderMethods(lines, parseResult, state = {}) {
  const {
    signalNames = [],
    computedNames = [],
    methodNames = [],
    constantNames = [],
    propNames = new Set(),
    propsObjectName = null,
    emitsObjectName = null,
    modelVarMap = new Map(),
  } = state;

  const ifBlocks = parseResult.ifBlocks || [];
  const forBlocks = parseResult.forBlocks || [];
  const dynamicComponents = parseResult.dynamicComponents || [];

  // ── Phase 2: __renderIf_N methods ──
  for (let idx = 0; idx < ifBlocks.length; idx++) {
    const ifBlock = ifBlocks[idx];
    const vn = ifBlock.varName;
    lines.push(`  __renderIf_${idx}() {`);
    lines.push('    let __branch = null;');
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      if (branch.type === 'if') {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`    if (${expr}) { __branch = ${i}; }`);
      } else if (branch.type === 'else-if') {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`    else if (${expr}) { __branch = ${i}; }`);
      } else {
        lines.push(`    else { __branch = ${i}; }`);
      }
    }
    lines.push(`    if (__branch === this.${vn}_active) return;`);
    lines.push(`    if (this.${vn}_current) { this.${vn}_current.remove(); this.${vn}_current = null; }`);
    lines.push('    if (__branch !== null) {');
    const tplArray = ifBlock.branches.map((_, i) => `this.${vn}_t${i}`).join(', ');
    lines.push(`      const tpl = [${tplArray}][__branch];`);
    lines.push('      const clone = tpl.content.cloneNode(true);');
    lines.push('      const node = clone.firstChild;');
    lines.push(`      this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
    lines.push('      customElements.upgrade(node);');
    lines.push(`      this.${vn}_current = node;`);
    // Setup bindings/events for active branch
    const hasSetup = ifBlock.branches.some(b =>
      (b.events && b.events.length > 0) ||
      (b.forBlocks && b.forBlocks.length > 0) ||
      (b.dynamicComponents && b.dynamicComponents.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0)
    );
    if (hasSetup) {
      lines.push(`      this.${vn}_setup(node, __branch);`);
    }
    lines.push('    }');
    lines.push(`    this.${vn}_active = __branch;`);
    lines.push('  }');
    lines.push('');
  }

  // ── Phase 3: __renderEach_N methods ──
  for (let idx = 0; idx < forBlocks.length; idx++) {
    const forBlock = forBlocks[idx];
    const vn = forBlock.varName;
    const { itemVar, indexVar, source, keyExpr } = forBlock;

    const signalNamesSet = new Set(signalNames);
    const computedNamesSet = new Set(computedNames);
    const sourceExpr = transformForExpr(source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);

    lines.push(`  __renderEach_${idx}() {`);
    lines.push(`    const __source = ${sourceExpr};`);
    lines.push("    const __iter = typeof __source === 'number'");
    lines.push('      ? Array.from({ length: __source }, (_, i) => i + 1)');
    lines.push('      : (__source || []);');
    lines.push('');

    if (keyExpr) {
      // ── Keyed reconciliation ──
      lines.push(`    const __oldMap = this.${vn}_keyMap || new Map();`);
      lines.push('    const __newMap = new Map();');
      lines.push('    const __newNodes = [];');
      lines.push('    const __newItems = [];');
      lines.push('');
      lines.push(`    __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`      const __key = ${keyExpr};`);
      lines.push('      if (__oldMap.has(__key)) {');
      lines.push('        __oldMap.get(__key).remove();');
      lines.push('      }');
      lines.push(`      const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push('      const node = clone.firstChild;');
      // Internal bindings, events, attr, model, nested features
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames, modelVarMap);
      lines.push(`      __newMap.set(__key, node);`);
      lines.push('      __newNodes.push(node);');
      lines.push(`      __newItems.push(${itemVar});`);
      lines.push('    });');
      lines.push('');
      lines.push('    for (const n of __oldMap.values()) n.remove();');
      lines.push('');
      lines.push(`    for (const n of __newNodes) { this.${vn}_anchor.parentNode.insertBefore(n, this.${vn}_anchor); customElements.upgrade(n); }`);
      lines.push(`    this.${vn}_nodes = __newNodes;`);
      lines.push(`    this.${vn}_items = __newItems;`);
      lines.push(`    this.${vn}_keyMap = __newMap;`);
    } else {
      // ── Non-keyed: destroy and recreate ──
      lines.push(`    for (const n of this.${vn}_nodes) n.remove();`);
      lines.push(`    this.${vn}_nodes = [];`);
      lines.push(`    this.${vn}_items = [];`);
      lines.push('');
      lines.push(`    __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`      const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push('      const node = clone.firstChild;');
      // Internal bindings, events, attr, model, nested features
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames, modelVarMap);
      lines.push(`      this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
      lines.push('      customElements.upgrade(node);');
      lines.push(`      this.${vn}_nodes.push(node);`);
      lines.push(`      this.${vn}_items.push(${itemVar});`);
      lines.push('    });');
    }
    lines.push('  }');
    lines.push('');
  }

  // ── Phase 4: __renderDynamic_N methods ──
  for (let idx = 0; idx < dynamicComponents.length; idx++) {
    const dyn = dynamicComponents[idx];
    const vn = dyn.varName;
    const isExpr = transformExpr(dyn.isExpression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

    lines.push(`  __renderDynamic_${idx}() {`);
    lines.push(`    const __tag = ${isExpr};`);
    lines.push(`    if (__tag === this.${vn}_tag) return;`);
    lines.push(`    if (this.${vn}_current) {`);
    lines.push(`      this.${vn}_current.remove();`);
    lines.push(`      this.${vn}_current = null;`);
    lines.push('    }');
    lines.push('    if (__tag) {');
    lines.push('      const el = document.createElement(__tag);');
    for (const prop of dyn.props) {
      const propExpr = transformExpr(prop.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
      lines.push(`      el.setAttribute('${prop.attr}', ${propExpr} ?? '');`);
    }
    for (const evt of dyn.events) {
      const handlerExpr = generateEventHandler(evt.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
      lines.push(`      el.addEventListener('${evt.event}', ${handlerExpr});`);
    }
    lines.push(`      this.${vn}_anchor.parentNode.insertBefore(el, this.${vn}_anchor);`);
    lines.push('      customElements.upgrade(el);');
    lines.push(`      this.${vn}_current = el;`);
    lines.push('    }');
    lines.push(`    this.${vn}_tag = __tag;`);
    lines.push('  }');
    lines.push('');
  }

  // ── if setup methods (Phase 2: simplified — simple bindings via __invalidate) ──
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    const hasSetup = ifBlock.branches.some(b =>
      (b.events && b.events.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0) ||
      (b.forBlocks && b.forBlocks.length > 0) ||
      (b.dynamicComponents && b.dynamicComponents.length > 0)
    );
    if (!hasSetup) continue;

    lines.push(`  ${vn}_setup(node, branch) {`);
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      const hasBranchSetup =
        (branch.events && branch.events.length > 0) ||
        (branch.modelBindings && branch.modelBindings.length > 0) ||
        (branch.forBlocks && branch.forBlocks.length > 0) ||
        (branch.dynamicComponents && branch.dynamicComponents.length > 0);
      if (!hasBranchSetup) continue;

      const keyword = i === 0 ? 'if' : 'else if';
      lines.push(`    ${keyword} (branch === ${i}) {`);

      // Events: generate addEventListener
      for (const e of branch.events) {
        const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
        lines.push(`      const ${e.varName} = ${pathExpr(e.path, 'node')};`);
        lines.push(`      ${e.varName}.addEventListener('${e.event}', ${handlerExpr});`);
      }

      // Phase 2: Text, show, and attr bindings are handled by __invalidate with existence guards.
      // Only model bindings, for-loops, and dynamic components need setup here.

      // Model bindings: generate effects and listeners
      for (const mb of (branch.modelBindings || [])) {
        const nodeRef = pathExpr(mb.path, 'node');
        lines.push(`      const ${mb.varName} = ${nodeRef};`);
        // Effect (signal → DOM)
        lines.push(`      __effect(() => {`);
        if (mb.prop === 'checked' && mb.radioValue !== null) {
          lines.push(`        ${mb.varName}.checked = (this._state.${mb.signal} === '${mb.radioValue}');`);
        } else if (mb.prop === 'checked') {
          lines.push(`        ${mb.varName}.checked = !!this._state.${mb.signal};`);
        } else {
          lines.push(`        ${mb.varName}.value = this._state.${mb.signal} ?? '';`);
        }
        lines.push(`      });`);
        // Listener (DOM → signal)
        const mbAssign = modelVarMap.has(mb.signal)
          ? `this._modelSet_${mb.signal}(`
          : `this._state.${mb.signal} = `;
        if (mb.prop === 'checked' && mb.radioValue === null) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { ${mbAssign}e.target.checked${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
        } else if (mb.coerce) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { ${mbAssign}Number(e.target.value)${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
        } else {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { ${mbAssign}e.target.value${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
        }
      }

      // Nested each loops inside this branch
      for (const innerFor of (branch.forBlocks || [])) {
        const innerVn = innerFor.varName;
        const { itemVar: innerItemVar, indexVar: innerIndexVar, source: innerSource, keyExpr: innerKeyExpr } = innerFor;

        // Create inner template element
        lines.push(`      const ${innerVn}_tpl = document.createElement('template');`);
        lines.push(`      ${innerVn}_tpl.innerHTML = \`${innerFor.templateHtml}\`;`);

        // Find inner anchor inside the branch node
        lines.push(`      const ${innerVn}_anchor = findAnchor(node, '${innerFor.anchorType}', ${innerFor.anchorIndex});`);

        // Transform the source expression
        const innerSourceExpr = transformExpr(innerSource, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

        // Generate reactive each effect
        lines.push(`      this.__disposers.push(__effect(() => {`);
        lines.push(`        const __source = ${innerSourceExpr};`);
        lines.push(`        const __iter = typeof __source === 'number'`);
        lines.push(`          ? Array.from({ length: __source }, (_, i) => i + 1)`);
        lines.push(`          : (__source || []);`);

        if (innerKeyExpr) {
          // Keyed reconciliation
          lines.push(`        const __oldMap = this.${innerVn}_keyMap || new Map();`);
          lines.push(`        const __newMap = new Map();`);
          lines.push(`        const __newNodes = [];`);
          lines.push(`        __iter.forEach((${innerItemVar}, ${innerIndexVar || '__idx'}) => {`);
          lines.push(`          const __key = ${innerKeyExpr};`);
          lines.push(`          if (__oldMap.has(__key)) {`);
          lines.push(`            __oldMap.get(__key).remove();`);
          lines.push(`          }`);
          lines.push(`          const clone = ${innerVn}_tpl.content.cloneNode(true);`);
          lines.push(`          const itemNode = clone.firstChild;`);
          // Setup bindings for inner items
          for (const b of innerFor.bindings) {
            const nodeRef = pathExpr(b.path, 'itemNode');
            lines.push(`          ${nodeRef}.textContent = ${b.name} ?? '';`);
          }
          for (const e of innerFor.events) {
            const nodeRef = pathExpr(e.path, 'itemNode');
            const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
            lines.push(`          ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
          }
          lines.push(`          __newMap.set(__key, itemNode);`);
          lines.push(`          __newNodes.push(itemNode);`);
          lines.push(`        });`);
          lines.push(`        for (const n of __oldMap.values()) n.remove();`);
          lines.push(`        for (const n of __newNodes) { ${innerVn}_anchor.parentNode.insertBefore(n, ${innerVn}_anchor); }`);
          lines.push(`        this.${innerVn}_keyMap = __newMap;`);
        } else {
          // Non-keyed: destroy and recreate
          lines.push(`        if (!this.${innerVn}_nodes) this.${innerVn}_nodes = [];`);
          lines.push(`        for (const n of this.${innerVn}_nodes) n.remove();`);
          lines.push(`        this.${innerVn}_nodes = [];`);
          lines.push(`        __iter.forEach((${innerItemVar}, ${innerIndexVar || '__idx'}) => {`);
          lines.push(`          const clone = ${innerVn}_tpl.content.cloneNode(true);`);
          lines.push(`          const itemNode = clone.firstChild;`);
          // Setup bindings for inner items
          for (const b of innerFor.bindings) {
            const nodeRef = pathExpr(b.path, 'itemNode');
            lines.push(`          ${nodeRef}.textContent = ${b.name} ?? '';`);
          }
          for (const e of innerFor.events) {
            const nodeRef = pathExpr(e.path, 'itemNode');
            const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
            lines.push(`          ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
          }
          lines.push(`          ${innerVn}_anchor.parentNode.insertBefore(itemNode, ${innerVn}_anchor);`);
          lines.push(`          this.${innerVn}_nodes.push(itemNode);`);
          lines.push(`        });`);
        }
        lines.push(`      }));`);
      }

      // Nested dynamic components inside this branch
      for (const dyn of (branch.dynamicComponents || [])) {
        const dvn = dyn.varName;
        const isExpr = transformExpr(dyn.isExpression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`      {`);
        lines.push(`        const ${dvn}_anchor = findAnchor(node, '${dyn.anchorType}', ${dyn.anchorIndex});`);
        lines.push(`        let ${dvn}_current = null;`);
        lines.push(`        const __tag = ${isExpr};`);
        lines.push(`        if (__tag) {`);
        lines.push(`          const el = document.createElement(__tag);`);
        for (const prop of dyn.props) {
          const propExprTransformed = transformExpr(prop.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
          lines.push(`          el.setAttribute('${prop.attr}', ${propExprTransformed});`);
        }
        for (const evt of dyn.events) {
          const handlerExpr = generateEventHandler(evt.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
          lines.push(`          el.addEventListener('${evt.event}', ${handlerExpr});`);
        }
        lines.push(`          ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
        lines.push(`          customElements.upgrade(el);`);
        lines.push(`          ${dvn}_current = el;`);
        lines.push(`        }`);
        lines.push(`      }`);
      }

      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Private helpers — not exported
// ────────────────────────────────────────────────────────────────────────────

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
 * @param {string[]} methodNames
 * @param {string[]} [constantNames]
 * @param {Map<string,string>} [modelVarMap]
 * @param {string|null} [indentOverride]
 */
function generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames = [], modelVarMap = new Map(), indentOverride = null) {
  const indent = indentOverride || '        ';

  // Phase 3: All bindings in __renderEach_N are static assignments.
  // External signal reactivity is handled by __invalidate in-place updates.
  // Item-only bindings are set once and re-rendered on source change.

  // Bindings
  for (const b of forBlock.bindings) {
    const nodeRef = pathExpr(b.path, 'node');
    if (b.type === 'constant') {
      lines.push(`${indent}  ${nodeRef}.textContent = this._const_${b.name} ?? '';`);
    } else {
      const expr = transformForExpr(b.name, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}  ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? '';`);
    }
  }

  // Events
  for (const e of forBlock.events) {
    const nodeRef = pathExpr(e.path, 'node');
    const handlerExpr = generateForEventHandler(e.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
    lines.push(`${indent}  if (${nodeRef}) ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
  }

  // Show
  for (const sb of forBlock.showBindings) {
    const nodeRef = pathExpr(sb.path, 'node');
    const expr = transformForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
    lines.push(`${indent}  ${nodeRef}.style.display = (${expr}) ? '' : 'none';`);
  }

  // Attr bindings
  for (const ab of forBlock.attrBindings) {
    const nodeRef = pathExpr(ab.path, 'node');
    if (ab.kind === 'class') {
      if (ab.expression.trimStart().startsWith('{')) {
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  { const __obj = ${expr};`);
        lines.push(`${indent}    for (const [__k, __val] of Object.entries(__obj)) {`);
        lines.push(`${indent}      __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
        lines.push(`${indent}    } }`);
      } else if (ab.expression.trimStart().startsWith('[')) {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  ${nodeRef}.className = ${staticPrefix}(${expr}).join(' ');`);
      } else {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(expr)};`);
      }
    } else if (ab.kind === 'style') {
      if (ab.expression.trimStart().startsWith('{')) {
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  { const __obj = ${expr};`);
        lines.push(`${indent}    for (const [__k, __val] of Object.entries(__obj)) { ${nodeRef}.style[__k] = __val; } }`);
      } else {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue}; ' + ` : '';
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  ${nodeRef}.style.cssText = ${staticPrefix}${expr};`);
      }
    } else if (ab.kind === 'attr') {
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}  { const __v = ${expr};`);
      lines.push(`${indent}    if (__v || __v === '') { ${nodeRef}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`${indent}    else { ${nodeRef}.removeAttribute('${ab.attr}'); } }`);
    } else if (ab.kind === 'bool') {
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}  ${nodeRef}.${ab.attr} = !!(${expr});`);
    } else {
      // Default: treat as regular attribute binding
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}  { const __v = ${expr};`);
      lines.push(`${indent}    if (__v || __v === '') { ${nodeRef}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`${indent}    else { ${nodeRef}.removeAttribute('${ab.attr}'); } }`);
    }
  }

  // Model bindings
  for (const mb of (forBlock.modelBindings || [])) {
    const nodeRef = pathExpr(mb.path, 'node');
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      lines.push(`${indent}  ${nodeRef}.checked = (this._state.${mb.signal} === '${mb.radioValue}');`);
    } else if (mb.prop === 'checked') {
      lines.push(`${indent}  ${nodeRef}.checked = !!this._state.${mb.signal};`);
    } else {
      lines.push(`${indent}  ${nodeRef}.value = this._state.${mb.signal} ?? '';`);
    }
    // Model event listener
    if (mb.prop === 'checked' && mb.radioValue === null) {
      lines.push(`${indent}  if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = e.target.checked; });`);
    } else if (mb.coerce) {
      lines.push(`${indent}  if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = Number(e.target.value); });`);
    } else {
      lines.push(`${indent}  if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = e.target.value; });`);
    }
  }

  // Nested if-blocks inside for item
  for (const ifBlock of (forBlock.ifBlocks || [])) {
    const ivn = ifBlock.varName;
    // Create template elements for each branch
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      lines.push(`${indent}  const ${ivn}_t${i} = document.createElement('template');`);
      lines.push(`${indent}  ${ivn}_t${i}.innerHTML = \`${branch.templateHtml}\`;`);
    }
    lines.push(`${indent}  const ${ivn}_anchor = findAnchor(node, '${ifBlock.anchorType}', ${ifBlock.anchorIndex});`);
    lines.push(`${indent}  let ${ivn}_current = null;`);
    lines.push(`${indent}  let ${ivn}_active = undefined;`);
    // Evaluate condition and render initial branch
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      const keyword = i === 0 ? 'if' : branch.type === 'else-if' ? 'else if' : 'else';
      if (branch.type !== 'else') {
        const expr = transformForExpr(branch.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  ${keyword} (${expr}) {`);
      } else {
        lines.push(`${indent}  ${keyword} {`);
      }
      lines.push(`${indent}    const clone = ${ivn}_t${i}.content.cloneNode(true);`);
      lines.push(`${indent}    const bnode = clone.firstChild;`);
      lines.push(`${indent}    ${ivn}_anchor.parentNode.insertBefore(bnode, ${ivn}_anchor);`);
      lines.push(`${indent}    ${ivn}_current = bnode;`);
      lines.push(`${indent}    ${ivn}_active = ${i};`);
      // Render nested features inside this branch (bindings, events, forBlocks, etc.)
      for (const b of (branch.bindings || [])) {
        const nodeRef = pathExpr(b.path, 'bnode');
        if (b.type === 'constant') {
          lines.push(`${indent}    ${nodeRef}.textContent = this._const_${b.name} ?? '';`);
        } else {
          const expr = transformForExpr(b.name, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}    ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? '';`);
        }
      }
      for (const e of (branch.events || [])) {
        const nodeRef = pathExpr(e.path, 'bnode');
        const handlerExpr = generateForEventHandler(e.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
        lines.push(`${indent}    ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
      }
      // Nested each blocks inside if-branch
      for (const innerFor2 of (branch.forBlocks || [])) {
        const innerVn2 = innerFor2.varName;
        const innerItemVar2 = innerFor2.itemVar;
        const innerIndexVar2 = innerFor2.indexVar;
        const innerSource2 = transformForExpr(innerFor2.source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        const innerAnchor2 = `findAnchor(bnode, '${innerFor2.anchorType}', ${innerFor2.anchorIndex})`;
        const innerAnchorRef2 = `__anchor_${innerVn2}`;
        lines.push(`${indent}    const ${innerAnchorRef2} = ${innerAnchor2};`);
        lines.push(`${indent}    const ${innerVn2}_iter = (${innerSource2} || []);`);
        lines.push(`${indent}    ${innerVn2}_iter.forEach((${innerItemVar2}, ${innerIndexVar2 || '__i2'}) => {`);
        lines.push(`${indent}      const clone2 = document.createElement('template');`);
        lines.push(`${indent}      clone2.innerHTML = \`${innerFor2.templateHtml}\`;`);
        lines.push(`${indent}      const innerNode2 = clone2.content.firstChild;`);
        for (const b2 of (innerFor2.bindings || [])) {
          const nodeRef2 = pathExpr(b2.path, 'innerNode2');
          const expr2 = transformForExpr(b2.name, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}      ${nodeRef2}.textContent = ${wrapTernaryExpr(expr2)} ?? '';`);
        }
        for (const e2 of (innerFor2.events || [])) {
          const nodeRef2 = pathExpr(e2.path, 'innerNode2');
          const handlerExpr2 = generateForEventHandler(e2.handler, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames);
          lines.push(`${indent}      if (${nodeRef2}) ${nodeRef2}.addEventListener('${e2.event}', ${handlerExpr2});`);
        }
        // Show bindings inside if-branch forBlock
        for (const sb of (innerFor2.showBindings || [])) {
          const nodeRef2 = pathExpr(sb.path, 'innerNode2');
          const expr2 = transformForExpr(sb.expression, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}      ${nodeRef2}.style.display = (${expr2}) ? '' : 'none';`);
        }
        // Nested dynamic components inside if-branch forBlock
        for (const dyn of (innerFor2.dynamicComponents || [])) {
          const dvn = dyn.varName;
          const anchorRef = `findAnchor(innerNode2, '${dyn.anchorType}', ${dyn.anchorIndex})`;
          const isExprTransformed = transformForExpr(dyn.isExpression, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}      {`);
          lines.push(`${indent}        const ${dvn}_anchor = ${anchorRef};`);
          lines.push(`${indent}        let ${dvn}_current = null;`);
          lines.push(`${indent}        const __tag = ${isExprTransformed};`);
          lines.push(`${indent}        if (__tag) {`);
          lines.push(`${indent}          const el = document.createElement(__tag);`);
          for (const prop of dyn.props) {
            const propExpr = transformForExpr(prop.expression, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
            lines.push(`${indent}          el.setAttribute('${prop.attr}', ${propExpr});`);
          }
          for (const evt of dyn.events) {
            const handlerExpr = generateForEventHandler(evt.handler, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames);
            lines.push(`${indent}          el.addEventListener('${evt.event}', ${handlerExpr});`);
          }
          lines.push(`${indent}          ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
          lines.push(`${indent}          customElements.upgrade(el);`);
          lines.push(`${indent}          ${dvn}_current = el;`);
          lines.push(`${indent}        }`);
          lines.push(`${indent}      }`);
        }
        lines.push(`${indent}      ${innerAnchorRef2}.parentNode.insertBefore(innerNode2, ${innerAnchorRef2});`);
        lines.push(`${indent}    });`);
      }
      // Nested dynamic components inside if-branch
      for (const dyn of (branch.dynamicComponents || [])) {
        const dvn = dyn.varName;
        const anchorRef = `findAnchor(bnode, '${dyn.anchorType}', ${dyn.anchorIndex})`;
        const isExprTransformed = transformForExpr(dyn.isExpression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}    {`);
        lines.push(`${indent}      const ${dvn}_anchor = ${anchorRef};`);
        lines.push(`${indent}      let ${dvn}_current = null;`);
        lines.push(`${indent}      const __tag = ${isExprTransformed};`);
        lines.push(`${indent}      if (__tag) {`);
        lines.push(`${indent}        const el = document.createElement(__tag);`);
        for (const prop of dyn.props) {
          const propExpr = transformForExpr(prop.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}        el.setAttribute('${prop.attr}', ${propExpr});`);
        }
        for (const evt of dyn.events) {
          const handlerExpr = generateForEventHandler(evt.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
          lines.push(`${indent}        el.addEventListener('${evt.event}', ${handlerExpr});`);
        }
        lines.push(`${indent}        ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
        lines.push(`${indent}        customElements.upgrade(el);`);
        lines.push(`${indent}        ${dvn}_current = el;`);
        lines.push(`${indent}      }`);
        lines.push(`${indent}    }`);
      }
      lines.push(`${indent}  }`);
    }
  }

  // Nested for-blocks inside for item
  for (const innerFor of (forBlock.forBlocks || [])) {
    const innerVn = innerFor.varName;
    const innerItemVar = innerFor.itemVar;
    const innerIndexVar = innerFor.indexVar;
    const innerSource = transformForExpr(innerFor.source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
    const innerAnchor = `findAnchor(node, '${innerFor.anchorType}', ${innerFor.anchorIndex})`;
    const innerAnchorVar = `__anchor_${innerVn}`;
    lines.push(`${indent}  const ${innerAnchorVar} = ${innerAnchor};`);
    lines.push(`${indent}  const ${innerVn}_iter = (${innerSource} || []);`);
    lines.push(`${indent}  ${innerVn}_iter.forEach((${innerItemVar}, ${innerIndexVar || '__i'}) => {`);
    lines.push(`${indent}    const clone = document.createElement('template');`);
    lines.push(`${indent}    clone.innerHTML = \`${innerFor.templateHtml}\`;`);
    lines.push(`${indent}    const innerNode = clone.content.firstChild;`);
    // Nested bindings
    for (const b of (innerFor.bindings || [])) {
      const nodeRef = pathExpr(b.path, 'innerNode');
      if (b.type === 'constant') {
        lines.push(`${indent}    ${nodeRef}.textContent = this._const_${b.name} ?? '';`);
      } else {
        const expr = transformForExpr(b.name, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}    ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? '';`);
      }
    }
    for (const e of (innerFor.events || [])) {
      const nodeRef = pathExpr(e.path, 'innerNode');
      const handlerExpr = generateForEventHandler(e.handler, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      lines.push(`${indent}    if (${nodeRef}) ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
    }
    // Show bindings
    for (const sb of (innerFor.showBindings || [])) {
      const nodeRef = pathExpr(sb.path, 'innerNode');
      const expr = transformForExpr(sb.expression, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}    ${nodeRef}.style.display = (${expr}) ? '' : 'none';`);
    }
    // Nested dynamic components
    for (const dyn of (innerFor.dynamicComponents || [])) {
      const dvn = dyn.varName;
      const anchorRef = `findAnchor(innerNode, '${dyn.anchorType}', ${dyn.anchorIndex})`;
      const isExprTransformed = transformForExpr(dyn.isExpression, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}    {`);
      lines.push(`${indent}      const ${dvn}_anchor = ${anchorRef};`);
      lines.push(`${indent}      let ${dvn}_current = null;`);
      lines.push(`${indent}      const __tag = ${isExprTransformed};`);
      lines.push(`${indent}      if (__tag) {`);
      lines.push(`${indent}        const el = document.createElement(__tag);`);
      for (const prop of dyn.props) {
        const propExpr = transformForExpr(prop.expression, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}        el.setAttribute('${prop.attr}', ${propExpr});`);
      }
      for (const evt of dyn.events) {
        const handlerExpr = generateForEventHandler(evt.handler, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
        lines.push(`${indent}        el.addEventListener('${evt.event}', ${handlerExpr});`);
      }
      lines.push(`${indent}        ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
      lines.push(`${indent}        customElements.upgrade(el);`);
      lines.push(`${indent}        ${dvn}_current = el;`);
      lines.push(`${indent}      }`);
      lines.push(`${indent}    }`);
    }
    lines.push(`${indent}    ${innerAnchorVar}.parentNode.insertBefore(innerNode, ${innerAnchorVar});`);
    lines.push(`${indent}  });`);
  }

  // Dynamic components (<component :is>) inside each item
  for (const dyn of (forBlock.dynamicComponents || [])) {
    const dvn = dyn.varName;
    const anchorRef = `findAnchor(node, '${dyn.anchorType}', ${dyn.anchorIndex})`;
    const isExprTransformed = transformForExpr(dyn.isExpression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);

    lines.push(`${indent}  {`);
    lines.push(`${indent}    const ${dvn}_anchor = ${anchorRef};`);
    lines.push(`${indent}    let ${dvn}_current = null;`);
    lines.push(`${indent}    const __tag = ${isExprTransformed};`);
    lines.push(`${indent}    if (__tag) {`);
    lines.push(`${indent}      const el = document.createElement(__tag);`);

    for (const prop of dyn.props) {
      const propExpr = transformForExpr(prop.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}      el.setAttribute('${prop.attr}', ${propExpr});`);
    }

    for (const evt of dyn.events) {
      const handlerExpr = generateForEventHandler(evt.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      lines.push(`${indent}      el.addEventListener('${evt.event}', ${handlerExpr});`);
    }

    lines.push(`${indent}      ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
    lines.push(`${indent}      customElements.upgrade(el);`);
    lines.push(`${indent}      ${dvn}_current = el;`);
    lines.push(`${indent}    }`);
    lines.push(`${indent}  }`);
  }
}

/**
 * Generate inner item bindings/events/show/attr/model for a nested each directive.
 * Uses transformForExpr with an excludeSet that includes BOTH outer and inner loop variables.
 *
 * @param {string[]} lines - Output lines array
 * @param {ForBlock} innerFor - The nested ForBlock
 * @param {string} outerItemVar - Outer loop item variable
 * @param {string|null} outerIndexVar - Outer loop index variable
 * @param {string} innerItemVar - Inner loop item variable
 * @param {string|null} innerIndexVar - Inner loop index variable
 * @param {Set<string>} propNames - Prop names set
 * @param {Set<string>} signalNamesSet - Signal names set
 * @param {Set<string>} computedNamesSet - Computed names set
 * @param {string[]} methodNames
 * @param {string} indent - Current indentation
 * @param {Map<string,string>} [modelVarMap]
 */
function generateNestedItemSetup(lines, innerFor, outerItemVar, outerIndexVar, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, indent, modelVarMap = new Map()) {
  // Build combined exclude set with both outer and inner loop variables
  const combinedExcludeItemVar = innerItemVar;
  const combinedExcludeIndexVar = innerIndexVar;

  // For transformForExpr, we need to ensure both outer and inner vars are excluded.
  // We create a modified propNames/signalNamesSet/computedNamesSet that doesn't include
  // any of the loop variables. transformForExpr already excludes itemVar/indexVar,
  // but we also need to exclude the outer loop variables.
  // Strategy: filter out outer loop vars from the sets passed to transformForExpr
  const filteredSignalNames = new Set([...signalNamesSet].filter(n => n !== outerItemVar && n !== outerIndexVar));
  const filteredComputedNames = new Set([...computedNamesSet].filter(n => n !== outerItemVar && n !== outerIndexVar));
  const filteredPropNames = new Set([...propNames].filter(n => n !== outerItemVar && n !== outerIndexVar));

  // Helper: check if expression is static (only references inner/outer loop vars, no signals/computeds/props)
  function isNestedStatic(expr) {
    // If expression contains operators, it's not static - needs wrapping
    if (expr.includes('?') || expr.includes('||') || expr.includes('&&')) {
      return false;
    }
    
    // An expression is static if it only references the loop variables (outer + inner)
    const allExclude = new Set([innerItemVar, outerItemVar]);
    if (innerIndexVar) allExclude.add(innerIndexVar);
    if (outerIndexVar) allExclude.add(outerIndexVar);

    for (const p of propNames) {
      if (allExclude.has(p)) continue;
      if (new RegExp(`\\b${p}\\b`).test(expr)) return false;
    }
    for (const n of signalNamesSet) {
      if (allExclude.has(n)) continue;
      if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
    }
    for (const n of computedNamesSet) {
      if (allExclude.has(n)) continue;
      if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
    }
    return true;
  }

  // Helper: transform expression excluding both outer and inner loop vars
  function transformNested(expr) {
    return transformForExpr(expr, innerItemVar, innerIndexVar, filteredPropNames, filteredSignalNames, filteredComputedNames, methodNames);
  }

  // Bindings
  for (const b of innerFor.bindings) {
    const nodeRef = pathExpr(b.path, 'innerNode');
    if (isNestedStatic(b.name)) {
      lines.push(`${indent}${nodeRef}.textContent = ${b.name} ?? '';`);
    } else {
      const expr = transformNested(b.name);
      lines.push(`${indent}__effect(() => { ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? ''; });`);
    }
  }

  // Events
  for (const e of innerFor.events) {
    const nodeRef = pathExpr(e.path, 'innerNode');
    const handlerExpr = generateForEventHandler(e.handler, innerItemVar, innerIndexVar, filteredPropNames, filteredSignalNames, filteredComputedNames, methodNames);
    lines.push(`${indent}if (${nodeRef}) ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
  }

  // Show
  for (const sb of innerFor.showBindings) {
    const nodeRef = pathExpr(sb.path, 'innerNode');
    if (isNestedStatic(sb.expression)) {
      lines.push(`${indent}${nodeRef}.style.display = (${sb.expression}) ? '' : 'none';`);
    } else {
      const expr = transformNested(sb.expression);
      lines.push(`${indent}__effect(() => { ${nodeRef}.style.display = (${expr}) ? '' : 'none'; });`);
    }
  }

  // Attr bindings
  for (const ab of innerFor.attrBindings) {
    const nodeRef = pathExpr(ab.path, 'innerNode');
    if (ab.kind === 'class') {
      // :class binding — handle object, array, and string expressions
      if (ab.expression.trimStart().startsWith('{')) {
        // Object expression: iterate entries, classList.add/remove
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}{`);
          lines.push(`${indent}  const __obj = ${ab.expression};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
          lines.push(`${indent}  }`);
          lines.push(`${indent}}`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => {`);
          lines.push(`${indent}  const __obj = ${expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
          lines.push(`${indent}  }`);
          lines.push(`${indent}});`);
        }
      } else if (ab.expression.trimStart().startsWith('[')) {
        // Array expression: join with spaces, preserve static classes
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}${nodeRef}.className = ${staticPrefix}(${ab.expression}).join(' ');`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => { ${nodeRef}.className = ${staticPrefix}(${expr}).join(' '); });`);
        }
      } else {
        // String expression: set className, preserve static classes
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}${nodeRef}.className = ${staticPrefix}${ab.expression};`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => { ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(expr)}; });`);
        }
      }
    } else if (ab.kind === 'style') {
      // :style binding — handle object and string expressions
      if (ab.expression.trimStart().startsWith('{')) {
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}{`);
          lines.push(`${indent}  const __obj = ${ab.expression};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) { ${nodeRef}.style[__k] = __val; }`);
          lines.push(`${indent}}`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => {`);
          lines.push(`${indent}  const __obj = ${expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) { ${nodeRef}.style[__k] = __val; }`);
          lines.push(`${indent}});`);
        }
      } else {
        // String expression: set cssText, preserve static styles
        const staticPrefix = ab.staticValue ? `'${ab.staticValue}; ' + ` : '';
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}${nodeRef}.style.cssText = ${staticPrefix}${ab.expression};`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => { ${nodeRef}.style.cssText = ${staticPrefix}${expr}; });`);
        }
      }
    } else {
      // Regular attr or bool binding
      if (isNestedStatic(ab.expression)) {
        lines.push(`${indent}const __val_${ab.varName} = ${ab.expression};`);
        lines.push(`${indent}if (__val_${ab.varName} != null && __val_${ab.varName} !== false) { ${nodeRef}.setAttribute('${ab.attr}', __val_${ab.varName}); }`);
      } else {
        const expr = transformNested(ab.expression);
        lines.push(`${indent}__effect(() => {`);
        lines.push(`${indent}  const __val = ${expr};`);
        lines.push(`${indent}  if (__val == null || __val === false) { ${nodeRef}.removeAttribute('${ab.attr}'); }`);
        lines.push(`${indent}  else { ${nodeRef}.setAttribute('${ab.attr}', __val); }`);
        lines.push(`${indent}});`);
      }
    }
  }

  // Model bindings
  for (const mb of (innerFor.modelBindings || [])) {
    const nodeRef = pathExpr(mb.path, 'innerNode');
    lines.push(`${indent}__effect(() => {`);
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      lines.push(`${indent}  ${nodeRef}.checked = (this._state.${mb.signal} === '${mb.radioValue}');`);
    } else if (mb.prop === 'checked') {
      lines.push(`${indent}  ${nodeRef}.checked = !!this._state.${mb.signal};`);
    } else {
      lines.push(`${indent}  ${nodeRef}.value = this._state.${mb.signal} ?? '';`);
    }
    lines.push(`${indent}});`);
    const mbAssign = modelVarMap.has(mb.signal)
      ? `this._modelSet_${mb.signal}(`
      : `this._state.${mb.signal} = `;
    if (mb.prop === 'checked' && mb.radioValue === null) {
      lines.push(`${indent}if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { ${mbAssign}e.target.checked${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
    } else if (mb.coerce) {
      lines.push(`${indent}if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { ${mbAssign}Number(e.target.value)${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
    } else {
      lines.push(`${indent}if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { ${mbAssign}e.target.value${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
    }
  }

  // Nested dynamic components (<component :is>) inside nested each items
  for (const dyn of (innerFor.dynamicComponents || [])) {
    const dvn = dyn.varName;
    const anchorRef = `findAnchor(innerNode, '${dyn.anchorType}', ${dyn.anchorIndex})`;

    // Transform the :is expression using the nested loop context
    const isExprTransformed = isNestedStatic(dyn.isExpression)
      ? dyn.isExpression
      : transformNested(dyn.isExpression);

    lines.push(`${indent}{`);
    lines.push(`${indent}  const ${dvn}_anchor = ${anchorRef};`);
    lines.push(`${indent}  let ${dvn}_current = null;`);
    lines.push(`${indent}  const __tag = ${isExprTransformed};`);
    lines.push(`${indent}  if (__tag) {`);
    lines.push(`${indent}    const el = document.createElement(__tag);`);

    // Emit prop bindings
    for (const prop of dyn.props) {
      const propExpr = isNestedStatic(prop.expression)
        ? prop.expression
        : transformNested(prop.expression);
      lines.push(`${indent}    el.setAttribute('${prop.attr}', ${propExpr});`);
    }

    // Emit event listeners
    for (const evt of dyn.events) {
      const handlerExpr = generateForEventHandler(evt.handler, innerItemVar, innerIndexVar, filteredPropNames, filteredSignalNames, filteredComputedNames, methodNames);
      lines.push(`${indent}    el.addEventListener('${evt.event}', ${handlerExpr});`);
    }

    lines.push(`${indent}    ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
    lines.push(`${indent}    customElements.upgrade(el);`);
    lines.push(`${indent}    ${dvn}_current = el;`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}}`);
  }
}
