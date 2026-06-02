/**
 * Per-item setup code generation for bindings, events, show, attr, model,
 * nested if-blocks, nested for-blocks, and dynamic components.
 * Uses RenderContext for recursive nesting at any depth.
 */

import { RenderContext } from './render-context.js';
import { transformForExpr } from '../transform/for-transformer.js';
import { generateForEventHandler } from './event-generator.js';
import { pathExpr, wrapTernaryExpr } from '../transform/expr-transformer.js';
import { extractDeps } from '../transform/dep-graph.js';

/**
 * Generate per-item setup code for bindings, events, show, attr, model,
 * nested if-blocks, nested for-blocks, and dynamic components.
 *
 * @param {string[]} lines — Output lines array (mutated in-place)
 * @param {object} forBlock — ForBlock with bindings, events, etc.
 * @param {RenderContext} ctx — Rendering context (includes current loop)
 * @param {string} [nodeRef] — Variable name for the root node
 */
export function renderItemSetup(lines, forBlock, ctx, nodeRef = 'node') {
  renderBindings(lines, forBlock, ctx, nodeRef);
  renderEvents(lines, forBlock, ctx, nodeRef);
  renderShowBindings(lines, forBlock, ctx, nodeRef);
  renderAttrBindings(lines, forBlock, ctx, nodeRef);
  renderModelBindings(lines, forBlock, ctx, nodeRef);
  renderScopedSlots(lines, forBlock, ctx, nodeRef);
  renderNestedIfBlocks(lines, forBlock, ctx, nodeRef);
  renderNestedForBlocks(lines, forBlock, ctx, nodeRef);
  renderDynamicComponents(lines, forBlock, ctx, nodeRef);
}

function renderBindings(lines, forBlock, ctx, nodeRef) {
  const loop = ctx.currentLoop || {};
  for (const b of forBlock.bindings) {
    const ref = pathExpr(b.path, nodeRef);
    if (b.type === 'constant') {
      lines.push(`${ctx.indent}  ${ref}.textContent = this._const_${b.name} ?? '';`);
    } else {
      const expr = transformForExpr(b.name, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
      lines.push(`${ctx.indent}  ${ref}.textContent = ${wrapTernaryExpr(expr)} ?? '';`);
    }
  }
}

function renderEvents(lines, forBlock, ctx, nodeRef) {
  const loop = ctx.currentLoop || {};
  for (const e of forBlock.events) {
    const ref = pathExpr(e.path, nodeRef);
    const handlerExpr = generateForEventHandler(e.handler, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames);
    lines.push(`${ctx.indent}  if (${ref}) ${ref}.addEventListener('${e.event}', ${handlerExpr});`);
  }
}

function renderShowBindings(lines, forBlock, ctx, nodeRef) {
  const loop = ctx.currentLoop || {};
  for (const sb of forBlock.showBindings) {
    const ref = pathExpr(sb.path, nodeRef);
    const expr = transformForExpr(sb.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
    lines.push(`${ctx.indent}  ${ref}.style.display = (${expr}) ? '' : 'none';`);

    // For show bindings inside forBlocks: store DOM reference for in-place updates.
    // This prevents __renderEach_N from destroying dynamic components on show toggle.
    if (ctx.currentLoop) {
      const deps = extractDeps(sb.expression, ctx.filteredSignalNames(), ctx.filteredPropNames(), []);
      for (const dep of deps) {
        if (dep === loop.itemVar || dep === loop.indexVar) continue;
        lines.push(`${ctx.indent}  if (!this.__show_elements) this.__show_elements = {};`);
        lines.push(`${ctx.indent}  if (!this.__show_elements['${dep}']) this.__show_elements['${dep}'] = [];`);
        lines.push(`${ctx.indent}  this.__show_elements['${dep}'].push(${ref});`);
      }
    }
  }
}

function renderAttrBindings(lines, forBlock, ctx, nodeRef) {
  const loop = ctx.currentLoop || {};
  for (const ab of forBlock.attrBindings) {
    const ref = pathExpr(ab.path, nodeRef);
    if (ab.kind === 'class') {
      if (ab.expression.trimStart().startsWith('{')) {
        const expr = transformForExpr(ab.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
        lines.push(`${ctx.indent}  { const __obj = ${expr};`);
        lines.push(`${ctx.indent}    for (const [__k, __val] of Object.entries(__obj)) {`);
        lines.push(`${ctx.indent}      __val ? ${ref}.classList.add(__k) : ${ref}.classList.remove(__k);`);
        lines.push(`${ctx.indent}    } }`);
      } else if (ab.expression.trimStart().startsWith('[')) {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        const expr = transformForExpr(ab.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
        lines.push(`${ctx.indent}  ${ref}.className = ${staticPrefix}(${expr}).join(' ');`);
      } else {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        const expr = transformForExpr(ab.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
        lines.push(`${ctx.indent}  ${ref}.className = ${staticPrefix}${wrapTernaryExpr(expr)};`);
      }
    } else if (ab.kind === 'style') {
      if (ab.expression.trimStart().startsWith('{')) {
        const expr = transformForExpr(ab.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
        lines.push(`${ctx.indent}  { const __obj = ${expr};`);
        lines.push(`${ctx.indent}    for (const [__k, __val] of Object.entries(__obj)) { ${ref}.style[__k] = __val; } }`);
      } else {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue}; ' + ` : '';
        const expr = transformForExpr(ab.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
        lines.push(`${ctx.indent}  ${ref}.style.cssText = ${staticPrefix}${expr};`);
      }
    } else if (ab.kind === 'attr') {
      const expr = transformForExpr(ab.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
      lines.push(`${ctx.indent}  { const __v = ${expr};`);
      lines.push(`${ctx.indent}    if (__v || __v === '') { ${ref}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`${ctx.indent}    else { ${ref}.removeAttribute('${ab.attr}'); } }`);
    } else if (ab.kind === 'bool') {
      const expr = transformForExpr(ab.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
      lines.push(`${ctx.indent}  ${ref}.${ab.attr} = !!(${expr});`);
    } else {
      const expr = transformForExpr(ab.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
      lines.push(`${ctx.indent}  { const __v = ${expr};`);
      lines.push(`${ctx.indent}    if (__v || __v === '') { ${ref}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`${ctx.indent}    else { ${ref}.removeAttribute('${ab.attr}'); } }`);
    }
  }
}

function renderModelBindings(lines, forBlock, ctx, nodeRef) {
  for (const mb of (forBlock.modelBindings || [])) {
    const ref = pathExpr(mb.path, nodeRef);
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      lines.push(`${ctx.indent}  ${ref}.checked = (this._state.${mb.signal} === '${mb.radioValue}');`);
    } else if (mb.prop === 'checked') {
      lines.push(`${ctx.indent}  ${ref}.checked = !!this._state.${mb.signal};`);
    } else {
      lines.push(`${ctx.indent}  ${ref}.value = this._state.${mb.signal} ?? '';`);
    }
    if (mb.prop === 'checked' && mb.radioValue === null) {
      lines.push(`${ctx.indent}  if (${ref}) ${ref}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = e.target.checked; });`);
    } else if (mb.coerce) {
      lines.push(`${ctx.indent}  if (${ref}) ${ref}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = Number(e.target.value); });`);
    } else {
      lines.push(`${ctx.indent}  if (${ref}) ${ref}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = e.target.value; });`);
    }
  }
}

/**
 * Generate scoped slot resolution code inside each loops.
 * If the consumer provided slot content (via __slotTpl_[name]),
 * replaces {%prop%} tokens with actual item values and swaps out
 * the default slot content element.
 */
function renderScopedSlots(lines, forBlock, ctx, nodeRef) {
  const loop = ctx.currentLoop || {};
  for (const slot of (forBlock.slots || [])) {
    if (!slot.name || slot.slotProps.length === 0) continue;

    const slotName = slot.name;
    const slotVar = `__slotTpl_${slotName}`;

    // Build the token replacements from slotProps
    const replacements = [];
    for (const sp of slot.slotProps) {
      const val = transformForExpr(sp.source, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
      const token = `{%${sp.prop}%}`;
      replacements.push({ token, val });
    }

    lines.push(`${ctx.indent}  if (this.${slotVar} || (this.__slotRenderers && this.__slotRenderers['${slotName}'])) {`);
    lines.push(`${ctx.indent}    let __slotHtml = this.${slotVar};`);
    lines.push(`${ctx.indent}    if (this.__slotRenderers && this.__slotRenderers['${slotName}']) {`);
    // Build the props object for the renderer
    const propsObj = slot.slotProps.map(sp => `"${sp.prop}": ${transformForExpr(sp.source, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames)}`).join(', ');
    lines.push(`${ctx.indent}      const __rendered = this.__slotRenderers['${slotName}']({${propsObj}});`);
    lines.push(`${ctx.indent}      if (__rendered) __slotHtml = __rendered;`);
    lines.push(`${ctx.indent}    }`);
    for (const sp of slot.slotProps) {
      const val = transformForExpr(sp.source, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
      lines.push(`${ctx.indent}    __slotHtml = __slotHtml.replace(/{%\\s*${sp.prop}\\s*%}/g, ${val});`);
    }
    lines.push(`${ctx.indent}    const __slotNode = ${nodeRef}.querySelector('[data-slot="${slotName}"]');`);
    lines.push(`${ctx.indent}    if (__slotNode) {`);
    lines.push(`${ctx.indent}      // Apply consumer element's attributes to the wrapper,`);
    lines.push(`${ctx.indent}      // and use consumer's inner content for the slot (avoiding nesting)`);
    lines.push(`${ctx.indent}      const __tmp = document.createElement('template');`);
    lines.push(`${ctx.indent}      __tmp.innerHTML = __slotHtml;`);
    lines.push(`${ctx.indent}      const __cel = __tmp.content.firstChild;`);
    lines.push(`${ctx.indent}      if (__cel && __cel.nodeType === 1 && __cel.tagName === ${nodeRef}.tagName) {`);
    lines.push(`${ctx.indent}        for (const __attr of __cel.attributes) {`);
    lines.push(`${ctx.indent}          ${nodeRef}.setAttribute(__attr.name, __attr.value);`);
    lines.push(`${ctx.indent}        }`);
    lines.push(`${ctx.indent}        __slotNode.innerHTML = __cel.innerHTML;`);
    lines.push(`${ctx.indent}      } else {`);
    lines.push(`${ctx.indent}        __slotNode.outerHTML = __slotHtml;`);
    lines.push(`${ctx.indent}      }`);
    lines.push(`${ctx.indent}    }`);
    lines.push(`${ctx.indent}  }`);
  }
}

function renderNestedIfBlocks(lines, forBlock, ctx, nodeRef) {
  const loop = ctx.currentLoop || {};
  for (const ifBlock of (forBlock.ifBlocks || [])) {
    const ivn = ifBlock.varName;

    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      lines.push(`${ctx.indent}  const ${ivn}_t${i} = document.createElement('template');`);
      lines.push(`${ctx.indent}  ${ivn}_t${i}.innerHTML = \`${branch.templateHtml}\`;`);
    }
    lines.push(`${ctx.indent}  const ${ivn}_anchor = findAnchor(${nodeRef}, '${ifBlock.anchorType}', ${ifBlock.anchorIndex});`);
    lines.push(`${ctx.indent}  let ${ivn}_current = null;`);
    lines.push(`${ctx.indent}  let ${ivn}_active = undefined;`);

    const branchCtx = branchContext(ctx);

    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      const keyword = i === 0 ? 'if' : branch.type === 'else-if' ? 'else if' : 'else';
      if (branch.type !== 'else') {
        const expr = transformForExpr(branch.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
        lines.push(`${ctx.indent}  ${keyword} (${expr}) {`);
      } else {
        lines.push(`${ctx.indent}  ${keyword} {`);
      }
      lines.push(`${branchCtx.indent}  const clone = ${ivn}_t${i}.content.cloneNode(true);`);
      lines.push(`${branchCtx.indent}  const bnode = clone.firstChild;`);
      lines.push(`${branchCtx.indent}  ${ivn}_anchor.parentNode.insertBefore(bnode, ${ivn}_anchor);`);
      lines.push(`${branchCtx.indent}  ${ivn}_current = bnode;`);
      lines.push(`${branchCtx.indent}  ${ivn}_active = ${i};`);

      const branchItem = {
        bindings: branch.bindings || [],
        events: branch.events || [],
        showBindings: branch.showBindings || [],
        attrBindings: branch.attrBindings || [],
        modelBindings: branch.modelBindings || [],
        forBlocks: branch.forBlocks || [],
        dynamicComponents: branch.dynamicComponents || [],
        ifBlocks: [],
      };
      renderItemSetup(lines, branchItem, branchCtx, 'bnode');

      lines.push(`${ctx.indent}  }`);
    }
  }
}

function renderNestedForBlocks(lines, forBlock, ctx, nodeRef) {
  const loop = ctx.currentLoop || {};
  for (const innerFor of (forBlock.forBlocks || [])) {
    const innerVn = innerFor.varName;
    const innerItemVar = innerFor.itemVar;
    const innerIndexVar = innerFor.indexVar;
    const sourceExpr = transformForExpr(innerFor.source, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
    const innerAnchor = `findAnchor(${nodeRef}, '${innerFor.anchorType}', ${innerFor.anchorIndex})`;
    // Include loopStack depth in anchor var name to prevent collisions
    // when renderNestedForBlocks is called recursively at different nesting levels
    const innerAnchorVar = `__anchor_${innerVn}_d${ctx.loopStack.length}`;

    lines.push(`${ctx.indent}  const ${innerAnchorVar} = ${innerAnchor};`);
    lines.push(`${ctx.indent}  const ${innerVn}_iter = (${sourceExpr} || []);`);
    lines.push(`${ctx.indent}  ${innerVn}_iter.forEach((${innerItemVar}, ${innerIndexVar || '__i'}) => {`);

    const innerCtx = ctx.nested(innerItemVar, innerIndexVar || '__i');

    lines.push(`${innerCtx.indent}  const clone = document.createElement('template');`);
    lines.push(`${innerCtx.indent}  clone.innerHTML = \`${innerFor.templateHtml}\`;`);
    lines.push(`${innerCtx.indent}  const innerNode = clone.content.firstChild;`);

    renderItemSetup(lines, innerFor, innerCtx, 'innerNode');

    lines.push(`${innerCtx.indent}  ${innerAnchorVar}.parentNode.insertBefore(innerNode, ${innerAnchorVar});`);
    lines.push(`${ctx.indent}  });`);
  }
}

function renderDynamicComponents(lines, forBlock, ctx, nodeRef) {
  const loop = ctx.currentLoop || {};
  for (const dyn of (forBlock.dynamicComponents || [])) {
    const dvn = dyn.varName;
    const anchorRef = `findAnchor(${nodeRef}, '${dyn.anchorType}', ${dyn.anchorIndex})`;
    const isExprTransformed = transformForExpr(dyn.isExpression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);

    lines.push(`${ctx.indent}  {`);
    lines.push(`${ctx.indent}    const ${dvn}_anchor = ${anchorRef};`);
    lines.push(`${ctx.indent}    let ${dvn}_current = null;`);
    lines.push(`${ctx.indent}    const __tag = ${isExprTransformed};`);
    lines.push(`${ctx.indent}    if (__tag) {`);
    lines.push(`${ctx.indent}      const el = document.createElement(__tag);`);

    for (const prop of dyn.props) {
      const propExpr = transformForExpr(prop.expression, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames, ctx.constantNames);
      lines.push(`${ctx.indent}      el.setAttribute('${prop.attr}', ${propExpr});`);
    }

    for (const evt of dyn.events) {
      const handlerExpr = generateForEventHandler(evt.handler, loop.itemVar ?? null, loop.indexVar ?? null, ctx.filteredPropNames(), ctx.filteredSignalNames(), ctx.filteredComputedNames(), ctx.methodNames);
      lines.push(`${ctx.indent}      el.addEventListener('${evt.event}', ${handlerExpr});`);
    }

    lines.push(`${ctx.indent}      ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
    lines.push(`${ctx.indent}      customElements.upgrade(el);`);
    lines.push(`${ctx.indent}      ${dvn}_current = el;`);
    lines.push(`${ctx.indent}    }`);
    lines.push(`${ctx.indent}  }`);
  }
}

/**
 * Create a child context with extra indentation but the same loop variables.
 * Used for if-block branch content.
 */
function branchContext(ctx) {
  return new RenderContext({
    signalNames: ctx.signalNames,
    computedNames: ctx.computedNames,
    propNames: ctx.propNames,
    methodNames: ctx.methodNames,
    constantNames: ctx.constantNames,
    modelVarMap: ctx.modelVarMap,
    indent: ctx.indent + '  ',
    loopStack: [...ctx.loopStack],
  });
}
