import { parseHTML } from "linkedom";
import { BOOLEAN_ATTRIBUTES } from "../types.js";
import { processForBlocks } from "./each-processor.js";
import { processIfChains } from "./if-processor.js";
import { processDynamicComponents } from "./dynamic-processor.js";

/** @import { Binding, EventBinding, IfBlock, IfBranch, ShowBinding, AttrBinding, ForBlock, ModelBinding, ModelPropBinding, SlotBinding, SlotProp, RefBinding, ChildComponentBinding, ChildPropBinding, DynamicComponentBinding, DynPropBinding, DynEventBinding } from "../types.js" */

// walkTree — see original source for full JSDoc

export function walkTree(rootEl, signalNames, computedNames, propNames = new Set(), constantNames = new Set(), knownTags = new Set()) {
  /** @type {Binding[]} */
  const bindings = [];
  /** @type {EventBinding[]} */
  const events = [];
  /** @type {ShowBinding[]} */
  const showBindings = [];
  /** @type {ModelBinding[]} */
  const modelBindings = [];
  /** @type {ModelPropBinding[]} */
  const modelPropBindings = [];
  /** @type {AttrBinding[]} */
  const attrBindings = [];
  /** @type {SlotBinding[]} */
  const slots = [];
  /** @type {ChildComponentBinding[]} */
  const childComponents = [];
  let bindIdx = 0;
  let eventIdx = 0;
  let showIdx = 0;
  let modelIdx = 0;
  let modelPropIdx = 0;
  let attrIdx = 0;
  let slotIdx = 0;
  let childIdx = 0;

  /**
   * Determine the binding type for a variable name.
   * Priority: prop → signal → computed → constant → method
   *
   * @param {string} name
   * @returns {'prop' | 'signal' | 'computed' | 'constant' | 'method'}
   */
  function bindingType(name) {
    if (propNames.has(name)) return 'prop';
    if (signalNames.has(name)) return 'signal';
    if (computedNames.has(name)) return 'computed';
    if (constantNames.has(name)) return 'constant';
    return 'method';
  }

  /**
   * Recursively walk a DOM node, collecting bindings and events.
   *
   * @param {Node} node — DOM node to walk
   * @param {string[]} pathParts — Current path segments from root
   */
  function walk(node, pathParts) {
    // --- Element node ---
    if (node.nodeType === 1) {
      const el = /** @type {Element} */ (node);

      // Skip <template #name> elements — they are slot content passed to child components
      // Their interpolations are resolved by the provider, not the consumer
      if (el.tagName === 'TEMPLATE') {
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith('#')) return;
        }
      }

      // Known custom element tags (e.g., self-referencing component) — treat as leaf
      if (knownTags.has(el.tagName.toLowerCase())) return;

      // Detect <slot> elements — replace with <span data-slot="..."> placeholder
      if (el.tagName === 'SLOT') {
        const slotName = el.getAttribute('name') || '';
        const safeName = slotName ? slotName.replace(/[^a-zA-Z0-9_]/g, '_') : 'default';
        const varName = `__slot_${safeName}_${slotIdx}`;
        slotIdx++;
        const defaultContent = el.innerHTML.trim();

        // Collect :prop="expr" attributes (slot props for scoped slots)
        /** @type {SlotProp[]} */
        const slotProps = [];
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith(':')) {
            slotProps.push({ prop: attr.name.slice(1), source: attr.value });
          }
        }

        slots.push({
          varName,
          name: slotName,
          path: [...pathParts],
          defaultContent,
          slotProps,
        });

        // Replace <slot> with <span data-slot="name">
        const doc = el.ownerDocument;
        const placeholder = doc.createElement('span');
        placeholder.setAttribute('data-slot', slotName || 'default');
        if (defaultContent) placeholder.innerHTML = defaultContent;
        el.parentNode.replaceChild(placeholder, el);
        return; // Don't recurse into the replaced element
      }

      // Detect child custom elements (tag name contains a hyphen, or in knownTags)
      const tagLower = el.tagName.toLowerCase();
      const isChildComponent = tagLower.includes('-') && tagLower !== rootEl.tagName?.toLowerCase();
      if (isChildComponent || knownTags.has(tagLower)) {
        /** @type {ChildPropBinding[]} */
        const propBindings = [];
        for (const attr of Array.from(el.attributes)) {
          // Skip directive attributes (@event, :bind, show, model, etc.)
          if (attr.name.startsWith('@') || attr.name.startsWith(':') || attr.name.startsWith('bind:') || attr.name.startsWith('model:')) continue;
          if (['show', 'model', 'if', 'else-if', 'else', 'each', 'ref'].includes(attr.name)) continue;

          // Check for {{interpolation}} in attribute value
          const interpMatch = attr.value.match(/^\{\{([\w.()]+)\}\}$/);
          if (interpMatch) {
            const rawExpr = interpMatch[1];
            const expr = rawExpr.endsWith('()') ? rawExpr.slice(0, -2) : rawExpr;
            propBindings.push({
              attr: attr.name,
              expr,
              type: propNames.has(expr) ? 'prop' : signalNames.has(expr) ? 'signal' : computedNames.has(expr) ? 'computed' : 'method',
            });
            // Clear the interpolation from the attribute — the effect sets it at runtime
            el.setAttribute(attr.name, '');
          }
        }

        // Always register child component for auto-import (even without prop bindings)
        childComponents.push({
          tag: tagLower,
          varName: `__child${childIdx++}`,
          path: [...pathParts],
          propBindings,
        });
      }

      // Check for @event attributes
      const attrsToRemove = [];
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('@')) {
          const eventName = attr.name.slice(1);
          const handlerName = attr.value.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);
          const varName = `__evt_${eventName.replace(/[^a-zA-Z0-9_]/g, '_')}_${handlerName}_${eventIdx}`;
          eventIdx++;
          events.push({
            varName,
            event: eventName,
            handler: attr.value,
            path: [...pathParts],
          });
          attrsToRemove.push(attr.name);
        } else if (attr.name.startsWith(':') || attr.name.startsWith('bind:')) {
          // Attribute binding: :attr="expr" or bind:attr="expr"
          const attrName = attr.name.startsWith(':') ? attr.name.slice(1) : attr.name.slice(5);
          const expression = attr.value;

          // Classify binding kind
          let kind;
          if (attrName === 'class') {
            kind = 'class';
          } else if (attrName === 'style') {
            kind = 'style';
          } else if (BOOLEAN_ATTRIBUTES.has(attrName)) {
            kind = 'bool';
          } else {
            kind = 'attr';
          }

          const varName = `__attr_${attrName.replace(/-/g, '_')}_${attrIdx}`;
          attrIdx++;
          const binding = {
            varName,
            attr: attrName,
            expression,
            kind,
            path: [...pathParts],
          };
          // Capture static class/style value if present alongside dynamic binding
          if ((kind === 'class' || kind === 'style') && el.hasAttribute(attrName)) {
            binding.staticValue = el.getAttribute(attrName);
          }
          attrBindings.push(binding);
          attrsToRemove.push(attr.name);
        }
      }
      attrsToRemove.forEach((a) => el.removeAttribute(a));

      // Detect show attribute
      if (el.hasAttribute('show')) {
        const varName = `__show_${showIdx}`;
        showIdx++;
        showBindings.push({
          varName,
          expression: el.getAttribute('show'),
          path: [...pathParts],
        });
        el.removeAttribute('show');
      }

      // Detect model attribute
      if (el.hasAttribute('model')) {
        const signalName = el.getAttribute('model');
        const tag = el.tagName.toLowerCase();

        // Validate element is a form element
        if (!['input', 'textarea', 'select'].includes(tag)) {
          const error = new Error(`model is only valid on <input>, <textarea>, or <select>, not on <${tag}>`);
          /** @ts-expect-error — custom error code */
          error.code = 'INVALID_MODEL_ELEMENT';
          throw error;
        }

        // Validate model value is a valid identifier
        if (!signalName || !/^[a-zA-Z_$][\w$]*$/.test(signalName)) {
          const error = new Error(`model requires a valid signal name, received: '${signalName || ''}'`);
          /** @ts-expect-error — custom error code */
          error.code = 'INVALID_MODEL_TARGET';
          throw error;
        }

        // Determine prop, event, coerce, radioValue based on tag and type
        const type = el.getAttribute('type') || 'text';
        let prop, event, coerce = false, radioValue = null;

        if (tag === 'select') {
          prop = 'value'; event = 'change';
        } else if (tag === 'textarea') {
          prop = 'value'; event = 'input';
        } else if (type === 'checkbox') {
          prop = 'checked'; event = 'change';
        } else if (type === 'radio') {
          prop = 'checked'; event = 'change';
          radioValue = el.getAttribute('value');
        } else if (type === 'number') {
          prop = 'value'; event = 'input'; coerce = true;
        } else {
          prop = 'value'; event = 'input';
        }

        const varName = `__model_${signalName}_${modelIdx}`;
        modelIdx++;
        modelBindings.push({ varName, signal: signalName, prop, event, coerce, radioValue, path: [...pathParts] });
        el.removeAttribute('model');
      }

      // Detect model:propName="signalName" attributes (for custom element binding)
      const modelPropAttrsToRemove = [];
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('model:')) {
          const propName = attr.name.slice(6); // after 'model:'
          const signal = attr.value;
          const tag = el.tagName.toLowerCase();

          // Validate the element is a custom element (tag contains a hyphen)
          if (!tag.includes('-')) {
            const error = new Error(`model:propName is only valid on custom elements (tag must contain a hyphen)`);
            /** @ts-expect-error — custom error code */
            error.code = 'MODEL_PROP_INVALID_TARGET';
            throw error;
          }

          const varName = `__modelProp_${propName}`;
          modelPropIdx++;
          modelPropBindings.push({ varName, propName, signal, path: [...pathParts] });
          modelPropAttrsToRemove.push(attr.name);
        }
      }
      modelPropAttrsToRemove.forEach((a) => el.removeAttribute(a));
    }

    // --- Text node with interpolations ---
    if (node.nodeType === 3 && /\{\{(?:[^}]|\}(?!\}))+\}\}/.test(node.textContent)) {
      const text = node.textContent;
      const trimmed = text.trim();
      const soleMatch = trimmed.match(/^\{\{((?:[^}]|\}(?!\}))+)\}\}$/);
      const parent = node.parentNode;

      // Strip trailing () from expression to get the base name for type lookup
      function baseName(expr) {
        const trimmed = expr.trim();
        return trimmed.endsWith('()') ? trimmed.slice(0, -2) : trimmed;
      }

      // Case 1: {{var}} is the sole content of the parent element and parent has only one child text node
      if (soleMatch && parent.childNodes.length === 1) {
        const name = baseName(soleMatch[1].trim());
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
        const varName = `__text_${safeName}_${bindIdx}`;
        bindIdx++;
        bindings.push({
          varName,
          name,
          type: bindingType(name),
          path: pathParts.slice(0, -1), // path to parent, not text node
        });
        parent.textContent = '';
        return;
      }

      // Case 2: Mixed text and interpolations — split into spans
      const doc = node.ownerDocument;
      const fragment = doc.createDocumentFragment();
      const parts = text.split(/(\{\{(?:[^}]|\}(?!\}))+\}\})/);
      const parentPath = pathParts.slice(0, -1);

      // Find the index of this text node among its siblings
      let baseIndex = 0;
      for (const child of parent.childNodes) {
        if (child === node) break;
        baseIndex++;
      }

      let offset = 0;
      for (const part of parts) {
        const bm = part.match(/^\{\{((?:[^}]|\}(?!\}))+)\}\}$/);
        if (bm) {
          fragment.appendChild(doc.createElement('span'));
          const name = baseName(bm[1].trim());
          const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
          const varName = `__text_${safeName}_${bindIdx}`;
          bindIdx++;
          bindings.push({
            varName,
            name,
            type: bindingType(name),
            path: [...parentPath, `childNodes[${baseIndex + offset}]`],
          });
          offset++;
        } else if (part) {
          fragment.appendChild(doc.createTextNode(part));
          offset++;
        }
      }
      parent.replaceChild(fragment, node);
      return;
    }

    // --- Recurse into children ---
    // We snapshot the children list but use the node's actual index in the
    // live DOM when computing paths, because Case 2 (mixed interpolations)
    // may replace a single text node with multiple nodes, shifting siblings.
    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      // Compute the real index of this child in the current (possibly modified) DOM
      const realIndex = Array.from(node.childNodes).indexOf(child);
      if (realIndex === -1) continue; // Node was removed/replaced by a previous iteration
      walk(child, [...pathParts, `childNodes[${realIndex}]`]);
    }
  }

  walk(rootEl, []);
  return { bindings, events, showBindings, modelBindings, modelPropBindings, attrBindings, slots, childComponents };
}

// ── Conditional chain processing (if / else-if / else) ──────────────

/**
 * Recompute the path from rootEl to a specific node after DOM normalization.
 * Walks up from the node to rootEl, building the path segments.
 *
 * @param {Element} rootEl - The root element
 * @param {Node} targetNode - The node to find the path to
 * @returns {string[]} Path segments from rootEl to targetNode
 */
export function recomputeAnchorPath(rootEl, targetNode) {
  const segments = [];
  let current = targetNode;
  while (current && current !== rootEl) {
    const parent = current.parentNode;
    if (!parent) break;
    const children = Array.from(parent.childNodes);
    const idx = children.indexOf(current);
    segments.unshift(`childNodes[${idx}]`);
    current = parent;
  }
  return segments;
}

/**
 * Check if an element is a valid predecessor in a conditional chain
 * (has `if` or `else-if` attribute).
 *
 * @param {Element} el
 * @returns {boolean}
 */
export function isChainPredecessor(el) {
  return el.hasAttribute('if') || el.hasAttribute('else-if');
}

/**
 * Process a branch's HTML to extract internal bindings and events.
 * Creates a temporary DOM and runs walkTree on it.
 *
 * @param {string} html - The branch HTML (outerHTML of the branch element)
 * @param {Set<string>} signalNames
 * @param {Set<string>} computedNames
 * @param {Set<string>} propNames
 * @param {Set<string>} [constantNames]
 * @returns {{ bindings: Binding[], events: EventBinding[], showBindings: ShowBinding[], attrBindings: AttrBinding[], modelBindings: ModelBinding[], modelPropBindings: ModelPropBinding[], slots: SlotBinding[], processedHtml: string }}
 */
export function walkBranch(html, signalNames, computedNames, propNames, constantNames = new Set(), knownTags = new Set()) {
  const { document } = parseHTML(`<div id="__branchRoot">${html}</div>`);
  const branchRoot = document.getElementById('__branchRoot');

  // Process nested structural directives FIRST (before walkTree modifies the DOM).
  // This is critical because walkTree clears textContent of elements with sole
  // {{interpolation}} children, which would destroy content needed by
  // processForBlocks/processIfChains when they clone nested elements for their
  // own walkBranch calls.
  const forBlocks = processForBlocks(branchRoot, [], signalNames, computedNames, propNames);
  const ifBlocks = processIfChains(branchRoot, [], signalNames, computedNames, propNames);
  // Process dynamic components (<component :is>) AFTER forBlocks/ifBlocks so that
  // nested <component> elements inside loops/conditionals are properly detected
  // and replaced with comment anchors.
  const dynamicComponents = processDynamicComponents(branchRoot, [], signalNames, computedNames, propNames);

  // Now run walkTree on the remaining DOM (nested directive elements have been
  // replaced with comment nodes, so walkTree won't process their contents).
  const result = walkTree(branchRoot, signalNames, computedNames, propNames, constantNames, knownTags);

  // Capture the processed HTML AFTER all processing
  const processedHtml = branchRoot.innerHTML;

  // Strip the first path segment from all paths since at runtime
  // `node = clone.firstChild` is the element itself, not the wrapper div.
  function stripFirstSegment(items) {
    for (const item of items) {
      if (item.path && item.path.length > 0 && item.path[0].startsWith('childNodes[')) {
        item.path = item.path.slice(1);
      }
    }
  }
  stripFirstSegment(result.bindings);
  stripFirstSegment(result.events);
  stripFirstSegment(result.showBindings);
  stripFirstSegment(result.attrBindings);
  stripFirstSegment(result.modelBindings);
  stripFirstSegment(result.modelPropBindings);
  stripFirstSegment(result.slots);
  stripFirstSegment(result.childComponents);

  return {
    bindings: result.bindings,
    events: result.events,
    showBindings: result.showBindings,
    attrBindings: result.attrBindings,
    modelBindings: result.modelBindings,
    modelPropBindings: result.modelPropBindings,
    slots: result.slots,
    childComponents: result.childComponents,
    forBlocks,
    ifBlocks,
    dynamicComponents,
    processedHtml,
  };
}