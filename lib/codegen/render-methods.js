/**
 * Render methods generation — __renderIf_N, __renderEach_N, __renderDynamic_N,
 * if-branch setup methods. Item setup is delegated to renderItemSetup in
 * item-renderer.js which uses RenderContext for recursive nesting.
 */

import { pathExpr, transformExpr, wrapTernaryExpr } from '../transform/expr-transformer.js';
import { transformForExpr } from '../transform/for-transformer.js';
import { generateEventHandler } from './event-generator.js';
import { RenderContext } from './render-context.js';
import { renderItemSetup } from './item-renderer.js';

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

    const forCtx = new RenderContext({
      signalNames: signalNamesSet,
      computedNames: computedNamesSet,
      propNames,
      methodNames,
      constantNames,
      modelVarMap,
      indent: '        ',
      loopStack: [{ itemVar, indexVar }],
    });

    lines.push(`  __renderEach_${idx}() {`);
    lines.push(`    const __source = ${sourceExpr};`);
    lines.push("    const __iter = typeof __source === 'number'");
    lines.push('      ? Array.from({ length: __source }, (_, i) => i + 1)');
    lines.push('      : (__source || []);');
    lines.push('');

    if (keyExpr) {
      // ── Keyed reconciliation (Vue-style: reuse matching keys, create new, remove old) ──
      const hasNodeEvents = (forBlock.events || []).length > 0;
      lines.push(`    const __oldMap = this.${vn}_keyMap || new Map();`);
      lines.push('    const __newMap = new Map();');
      lines.push('    const __newNodes = [];');
      lines.push('    const __newItems = [];');
      lines.push('');
      lines.push(`    __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`      const __key = ${keyExpr};`);
      if (hasNodeEvents) {
        // Nodes have event handlers → must recreate to avoid stale closures
        lines.push('      if (__oldMap.has(__key)) {');
        lines.push('        __oldMap.get(__key).remove();');
        lines.push('      }');
        lines.push(`      const clone = this.${vn}_tpl.content.cloneNode(true);`);
        lines.push('      const node = clone.firstChild;');
      } else {
        // No events → reuse existing node, only update bindings in-place
        lines.push('      let node;');
        lines.push('      if (__oldMap.has(__key)) {');
        lines.push('        node = __oldMap.get(__key);');
        lines.push('        __oldMap.delete(__key);');
        lines.push('      } else {');
        lines.push(`        const clone = this.${vn}_tpl.content.cloneNode(true);`);
        lines.push('        node = clone.firstChild;');
        lines.push('      }');
      }
      renderItemSetup(lines, forBlock, forCtx, 'node');
      lines.push(`      __newMap.set(__key, node);`);
      lines.push('      __newNodes.push(node);');
      lines.push(`      __newItems.push(${itemVar});`);
      lines.push('    });');
      lines.push('');
      lines.push('    for (const n of __oldMap.values()) n.remove();');
      lines.push('');
      if (hasNodeEvents) {
        lines.push(`    for (const n of __newNodes) { this.${vn}_anchor.parentNode.insertBefore(n, this.${vn}_anchor); customElements.upgrade(n); }`);
      } else {
        lines.push(`    for (const n of __newNodes) { if (!n.parentNode) this.${vn}_anchor.parentNode.insertBefore(n, this.${vn}_anchor); customElements.upgrade(n); }`);
      }
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
      renderItemSetup(lines, forBlock, forCtx, 'node');
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
            const transformed = transformExpr(b.name, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
            lines.push(`          ${nodeRef}.textContent = ${wrapTernaryExpr(transformed)} ?? '';`);
          }
          for (const e of innerFor.events) {
            const nodeRef = pathExpr(e.path, 'itemNode');
            const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
            lines.push(`          ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
          }
          for (const sb of (innerFor.showBindings || [])) {
            const nodeRef = pathExpr(sb.path, 'itemNode');
            const showExpr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
            lines.push(`          ${nodeRef}.style.display = (${showExpr}) ? '' : 'none';`);
          }
          for (const ab of (innerFor.attrBindings || [])) {
            const nodeRef = pathExpr(ab.path, 'itemNode');
            if (ab.kind === 'class') {
              if (ab.expression.trimStart().startsWith('{')) {
                const classExpr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
                lines.push(`          { const __obj = ${classExpr};`);
                lines.push(`            for (const [__k, __val] of Object.entries(__obj)) {`);
                lines.push(`              __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
                lines.push(`            } }`);
              } else {
                const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
                const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
                lines.push(`          ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(expr)};`);
              }
            } else {
              const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
              lines.push(`          { const __v = ${expr};`);
              lines.push(`            if (__v || __v === '') { ${nodeRef}.setAttribute('${ab.attr}', __v); }`);
              lines.push(`            else { ${nodeRef}.removeAttribute('${ab.attr}'); } }`);
            }
          }
          lines.push(`          __newMap.set(__key, itemNode);`);
          lines.push(`          __newNodes.push(itemNode);`);
          lines.push(`        });`);
          lines.push(`        for (const n of __oldMap.values()) n.remove();`);
          lines.push(`        for (const n of __newNodes) { ${innerVn}_anchor.parentNode.insertBefore(n, ${innerVn}_anchor); customElements.upgrade(n); }`);
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
            const transformed = transformExpr(b.name, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
            lines.push(`          ${nodeRef}.textContent = ${wrapTernaryExpr(transformed)} ?? '';`);
          }
          for (const e of innerFor.events) {
            const nodeRef = pathExpr(e.path, 'itemNode');
            const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
            lines.push(`          ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
          }
          for (const sb of (innerFor.showBindings || [])) {
            const nodeRef = pathExpr(sb.path, 'itemNode');
            const showExpr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
            lines.push(`          ${nodeRef}.style.display = (${showExpr}) ? '' : 'none';`);
          }
          for (const ab of (innerFor.attrBindings || [])) {
            const nodeRef = pathExpr(ab.path, 'itemNode');
            if (ab.kind === 'class') {
              if (ab.expression.trimStart().startsWith('{')) {
                const classExpr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
                lines.push(`          { const __obj = ${classExpr};`);
                lines.push(`            for (const [__k, __val] of Object.entries(__obj)) {`);
                lines.push(`              __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
                lines.push(`            } }`);
              } else {
                const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
                const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
                lines.push(`          ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(expr)};`);
              }
            } else {
              const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
              lines.push(`          { const __v = ${expr};`);
              lines.push(`            if (__v || __v === '') { ${nodeRef}.setAttribute('${ab.attr}', __v); }`);
              lines.push(`            else { ${nodeRef}.removeAttribute('${ab.attr}'); } }`);
            }
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

      // Nested if-blocks inside this branch
      for (const innerIf of (branch.ifBlocks || [])) {
        const innerIv = innerIf.varName;
        for (let j = 0; j < innerIf.branches.length; j++) {
          const innerBranch = innerIf.branches[j];
          lines.push(`      const ${innerIv}_t${j} = document.createElement('template');`);
          lines.push(`      ${innerIv}_t${j}.innerHTML = \`${innerBranch.templateHtml}\`;`);
        }
        lines.push(`      const ${innerIv}_anchor = findAnchor(node, '${innerIf.anchorType}', ${innerIf.anchorIndex});`);
        lines.push(`      let ${innerIv}_current = null;`);
        lines.push(`      let ${innerIv}_active = undefined;`);
        for (let j = 0; j < innerIf.branches.length; j++) {
          const innerBranch = innerIf.branches[j];
          const keyword = j === 0 ? 'if' : innerBranch.type === 'else-if' ? 'else if' : 'else';
          if (innerBranch.type !== 'else') {
            const condExpr = transformExpr(innerBranch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
            lines.push(`      ${keyword} (${condExpr}) {`);
          } else {
            lines.push(`      ${keyword} {`);
          }
          lines.push(`        const __clone = ${innerIv}_t${j}.content.cloneNode(true);`);
          lines.push(`        const __bnode = __clone.firstChild;`);
          lines.push(`        ${innerIv}_anchor.parentNode.insertBefore(__bnode, ${innerIv}_anchor);`);
          lines.push(`        ${innerIv}_current = __bnode;`);
          lines.push(`        ${innerIv}_active = ${j};`);
          // Render bindings/events inside nested if-branch
          for (const b of (innerBranch.bindings || [])) {
            const nodeRef = pathExpr(b.path, '__bnode');
            lines.push(`        ${nodeRef}.textContent = ${b.name} ?? '';`);
          }
          for (const e of (innerBranch.events || [])) {
            const nodeRef = pathExpr(e.path, '__bnode');
            const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
            lines.push(`        ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
          }
          for (const sb of (innerBranch.showBindings || [])) {
            const nodeRef = pathExpr(sb.path, '__bnode');
            const showExpr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
            lines.push(`        ${nodeRef}.style.display = (${showExpr}) ? '' : 'none';`);
          }
          for (const ab of (innerBranch.attrBindings || [])) {
            const nodeRef = pathExpr(ab.path, '__bnode');
            if (ab.kind === 'class') {
              const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
              const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
              lines.push(`        ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(expr)};`);
            } else {
              const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
              lines.push(`        { const __v = ${expr};`);
              lines.push(`          if (__v || __v === '') { ${nodeRef}.setAttribute('${ab.attr}', __v); }`);
              lines.push(`          else { ${nodeRef}.removeAttribute('${ab.attr}'); } }`);
            }
          }
          lines.push(`      }`);
        }
      }

      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  }
}
