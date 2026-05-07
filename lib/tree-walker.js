/**
 * Tree Walker for wcCompiler v2.
 *
 * Walks a jsdom DOM tree to discover:
 * - Text bindings {{var}} with childNodes[n] paths
 * - Event bindings @event="handler"
 * - Show bindings show="expression"
 * - Conditional chains (if / else-if / else)
 *
 * Produces { bindings, events, showBindings } arrays with path metadata.
 * processIfChains() detects conditional chains, validates them,
 * extracts branch templates, and replaces chains with comment anchors.
 */

import { parseHTML } from 'linkedom';
import { BOOLEAN_ATTRIBUTES } from './types.js';

/** @import { Binding, EventBinding, IfBlock, IfBranch, ShowBinding, AttrBinding, ForBlock, ModelBinding, SlotBinding, SlotProp, RefBinding, ChildComponentBinding, ChildPropBinding } from './types.js' */

/**
 * Walk a DOM tree rooted at rootEl, discovering bindings and events.
 *
 * @param {Element} rootEl — jsdom DOM element (parsed template root)
 * @param {Set<string>} signalNames — Set of signal variable names
 * @param {Set<string>} computedNames — Set of computed variable names
 * @param {Set<string>} [propNames] — Set of prop names from defineProps
 * @returns {{ bindings: Binding[], events: EventBinding[], showBindings: ShowBinding[], modelBindings: ModelBinding[], attrBindings: AttrBinding[], slots: SlotBinding[], childComponents: ChildComponentBinding[] }}
 */
export function walkTree(rootEl, signalNames, computedNames, propNames = new Set()) {
  /** @type {Binding[]} */
  const bindings = [];
  /** @type {EventBinding[]} */
  const events = [];
  /** @type {ShowBinding[]} */
  const showBindings = [];
  /** @type {ModelBinding[]} */
  const modelBindings = [];
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
  let attrIdx = 0;
  let slotIdx = 0;
  let childIdx = 0;

  /**
   * Determine the binding type for a variable name.
   * Priority: prop → signal → computed → method
   *
   * @param {string} name
   * @returns {'prop' | 'signal' | 'computed' | 'method'}
   */
  function bindingType(name) {
    if (propNames.has(name)) return 'prop';
    if (signalNames.has(name)) return 'signal';
    if (computedNames.has(name)) return 'computed';
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

      // Detect <slot> elements — replace with <span data-slot="..."> placeholder
      if (el.tagName === 'SLOT') {
        const slotName = el.getAttribute('name') || '';
        const varName = `__s${slotIdx++}`;
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

      // Detect child custom elements (tag name contains a hyphen)
      const tagLower = el.tagName.toLowerCase();
      if (tagLower.includes('-') && tagLower !== rootEl.tagName?.toLowerCase()) {
        /** @type {ChildPropBinding[]} */
        const propBindings = [];
        for (const attr of Array.from(el.attributes)) {
          // Skip directive attributes (@event, :bind, show, model, etc.)
          if (attr.name.startsWith('@') || attr.name.startsWith(':') || attr.name.startsWith('bind:')) continue;
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
          const varName = `__e${eventIdx++}`;
          events.push({
            varName,
            event: attr.name.slice(1),
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

          const varName = `__attr${attrIdx++}`;
          attrBindings.push({
            varName,
            attr: attrName,
            expression,
            kind,
            path: [...pathParts],
          });
          attrsToRemove.push(attr.name);
        }
      }
      attrsToRemove.forEach((a) => el.removeAttribute(a));

      // Detect show attribute
      if (el.hasAttribute('show')) {
        const varName = `__show${showIdx++}`;
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

        const varName = `__model${modelIdx++}`;
        modelBindings.push({ varName, signal: signalName, prop, event, coerce, radioValue, path: [...pathParts] });
        el.removeAttribute('model');
      }
    }

    // --- Text node with interpolations ---
    if (node.nodeType === 3 && /\{\{(?:[^}]|\}(?!\}))+\}\}/.test(node.textContent)) {
      const text = node.textContent;
      const trimmed = text.trim();
      const soleMatch = trimmed.match(/^\{\{((?:[^}]|\}(?!\}))+)\}\}$/);
      const parent = node.parentNode;

      // Strip trailing () from expression to get the base name for type lookup
      function baseName(expr) {
        return expr.endsWith('()') ? expr.slice(0, -2) : expr;
      }

      // Case 1: {{var}} is the sole content of the parent element and parent has only one child text node
      if (soleMatch && parent.childNodes.length === 1) {
        const varName = `__b${bindIdx++}`;
        const name = baseName(soleMatch[1]);
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
          const varName = `__b${bindIdx++}`;
          const name = baseName(bm[1]);
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
    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      walk(children[i], [...pathParts, `childNodes[${i}]`]);
    }
  }

  walk(rootEl, []);
  return { bindings, events, showBindings, modelBindings, attrBindings, slots, childComponents };
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
function isChainPredecessor(el) {
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
 * @returns {{ bindings: Binding[], events: EventBinding[], showBindings: ShowBinding[], attrBindings: AttrBinding[], modelBindings: ModelBinding[], slots: SlotBinding[], processedHtml: string }}
 */
export function walkBranch(html, signalNames, computedNames, propNames) {
  const { document } = parseHTML(`<div id="__branchRoot">${html}</div>`);
  const branchRoot = document.getElementById('__branchRoot');

  // Use walkTree on the branch root to discover bindings/events
  const result = walkTree(branchRoot, signalNames, computedNames, propNames);

  // Capture the processed HTML AFTER walkTree has modified the DOM
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
  stripFirstSegment(result.slots);
  stripFirstSegment(result.childComponents);

  return {
    bindings: result.bindings,
    events: result.events,
    showBindings: result.showBindings,
    attrBindings: result.attrBindings,
    modelBindings: result.modelBindings,
    slots: result.slots,
    childComponents: result.childComponents,
    processedHtml,
  };
}

/**
 * Build an IfBlock from a completed chain, replacing elements with a comment node.
 *
 * @param {{ elements: Element[], branches: { type: 'if' | 'else-if' | 'else', expression: string | null, element: Element }[] }} chain
 * @param {Element} parent
 * @param {string[]} parentPath
 * @param {number} idx
 * @param {Set<string>} signalNames
 * @param {Set<string>} computedNames
 * @param {Set<string>} propNames
 * @returns {IfBlock}
 */
function buildIfBlock(chain, parent, parentPath, idx, signalNames, computedNames, propNames) {
  const doc = parent.ownerDocument;

  // Extract HTML for each branch (without the directive attribute)
  /** @type {IfBranch[]} */
  const branches = chain.branches.map((branch) => {
    const el = branch.element;
    // Clone the element to extract HTML without modifying the original yet
    const clone = /** @type {Element} */ (el.cloneNode(true));
    // Remove the directive attribute from the clone
    clone.removeAttribute('if');
    clone.removeAttribute('else-if');
    clone.removeAttribute('else');
    const templateHtml = clone.outerHTML;

    // Process internal bindings/events via partial walk
    const { bindings, events, showBindings, attrBindings, modelBindings, slots, processedHtml } = walkBranch(templateHtml, signalNames, computedNames, propNames);

    return {
      type: branch.type,
      expression: branch.expression,
      templateHtml: processedHtml,
      bindings,
      events,
      showBindings,
      attrBindings,
      modelBindings,
      slots,
    };
  });

  // Replace all chain elements with a single comment node
  const comment = doc.createComment(' if ');
  const firstEl = chain.elements[0];
  parent.insertBefore(comment, firstEl);

  // Remove all chain elements from the DOM
  for (const el of chain.elements) {
    parent.removeChild(el);
  }

  // Calculate anchorPath: find the index of the comment node among parent's childNodes
  const childNodes = Array.from(parent.childNodes);
  const commentIndex = childNodes.indexOf(comment);
  const anchorPath = [...parentPath, `childNodes[${commentIndex}]`];

  return {
    varName: `__if${idx}`,
    anchorPath,
    _anchorNode: comment,
    branches,
  };
}

/**
 * Process conditional chains (if/else-if/else) in a DOM tree.
 * Recursively searches all descendants for chains.
 *
 * @param {Element} parent - Root element to search
 * @param {string[]} parentPath - DOM path to parent from __root
 * @param {Set<string>} signalNames
 * @param {Set<string>} computedNames
 * @param {Set<string>} propNames
 * @returns {IfBlock[]}
 */
export function processIfChains(parent, parentPath, signalNames, computedNames, propNames) {
  /** @type {IfBlock[]} */
  const ifBlocks = [];
  let ifIdx = 0;

  /**
   * Recursively search for if chains in the subtree.
   * @param {Element} node
   * @param {string[]} currentPath
   */
  function findIfChains(node, currentPath) {
    const children = Array.from(node.childNodes);

    // First pass: validate all element children for conflicting directives
    for (const child of children) {
      if (child.nodeType !== 1) continue;
      const el = /** @type {Element} */ (child);

      const hasIf = el.hasAttribute('if');
      const hasElseIf = el.hasAttribute('else-if');
      const hasElse = el.hasAttribute('else');
      const hasShow = el.hasAttribute('show');

      // CONFLICTING_DIRECTIVES: if + else or if + else-if on same element
      if (hasIf && (hasElse || hasElseIf)) {
        const error = new Error('Las directivas condicionales son mutuamente excluyentes en un mismo elemento');
        /** @ts-expect-error — custom error code */
        error.code = 'CONFLICTING_DIRECTIVES';
        throw error;
      }

      // CONFLICTING_DIRECTIVES: show + if on same element
      if (hasShow && hasIf) {
        const error = new Error('show y if no deben usarse en el mismo elemento');
        /** @ts-expect-error — custom error code */
        error.code = 'CONFLICTING_DIRECTIVES';
        throw error;
      }

      // INVALID_V_ELSE: else with a non-empty value
      if (hasElse && el.getAttribute('else') !== '') {
        const error = new Error('else no acepta expresión');
        /** @ts-expect-error — custom error code */
        error.code = 'INVALID_V_ELSE';
        throw error;
      }
    }

    // Second pass: detect chains by iterating element nodes in order
    /** @type {{ elements: Element[], branches: { type: 'if' | 'else-if' | 'else', expression: string | null, element: Element }[] } | null} */
    let currentChain = null;
    /** @type {Element | null} */
    let prevElement = null;

    for (const child of children) {
      if (child.nodeType !== 1) continue;
      const el = /** @type {Element} */ (child);

      const hasIf = el.hasAttribute('if');
      const hasElseIf = el.hasAttribute('else-if');
      const hasElse = el.hasAttribute('else');

      if (hasIf) {
        // Close any open chain
        if (currentChain) {
          ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
          currentChain = null;
        }
        // Start new chain
        currentChain = {
          elements: [el],
          branches: [{ type: 'if', expression: el.getAttribute('if'), element: el }],
        };
      } else if (hasElseIf) {
        // Validate: must follow an if or else-if
        if (!currentChain || !prevElement || !isChainPredecessor(prevElement)) {
          const error = new Error('else-if/else requiere un if previo en el mismo nivel');
          /** @ts-expect-error — custom error code */
          error.code = 'ORPHAN_ELSE';
          throw error;
        }
        currentChain.elements.push(el);
        currentChain.branches.push({ type: 'else-if', expression: el.getAttribute('else-if'), element: el });
      } else if (hasElse) {
        // Validate: must follow an if or else-if
        if (!currentChain || !prevElement || !isChainPredecessor(prevElement)) {
          const error = new Error('else-if/else requiere un if previo en el mismo nivel');
          /** @ts-expect-error — custom error code */
          error.code = 'ORPHAN_ELSE';
          throw error;
        }
        currentChain.elements.push(el);
        currentChain.branches.push({ type: 'else', expression: null, element: el });
        // Close chain
        ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
        currentChain = null;
      } else {
        // Non-conditional element: close any open chain
        if (currentChain) {
          ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
          currentChain = null;
        }
        // Recurse into non-conditional elements to find nested if chains
        const childIdx = Array.from(node.childNodes).indexOf(el);
        findIfChains(el, [...currentPath, `childNodes[${childIdx}]`]);
      }

      prevElement = el;
    }

    // Close any remaining open chain
    if (currentChain) {
      ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
      currentChain = null;
    }
  }

  findIfChains(parent, parentPath);

  // Normalize the DOM to merge adjacent text nodes created by element removal
  parent.normalize();

  // Recompute anchor paths after normalization since text node merging
  // may have changed childNode indices
  for (const ib of ifBlocks) {
    ib.anchorPath = recomputeAnchorPath(parent, ib._anchorNode);
  }

  return ifBlocks;
}

// ── each directive processing ───────────────────────────────────────

// Forma simple: "item in source"
const simpleRe = /^\s*(\w+)\s+in\s+(.+)\s*$/;
// Forma con índice: "(item, index) in source"
const destructuredRe = /^\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+(.+)\s*$/;

/**
 * Parse an each expression.
 * Supports:
 *   "item in source"
 *   "(item, index) in source"
 *
 * @param {string} expr - The each attribute value
 * @returns {{ itemVar: string, indexVar: string | null, source: string }}
 * @throws {Error} with code INVALID_V_FOR if syntax is invalid
 */
export function parseEachExpression(expr) {
  // Check if expression contains "in" keyword
  if (!/\bin\b/.test(expr)) {
    const error = new Error('each requiere la sintaxis \'item in source\' o \'(item, index) in source\'');
    /** @ts-expect-error — custom error code */
    error.code = 'INVALID_V_FOR';
    throw error;
  }

  // Try destructured form first (more specific)
  const destructuredMatch = destructuredRe.exec(expr);
  if (destructuredMatch) {
    const itemVar = destructuredMatch[1];
    const indexVar = destructuredMatch[2];
    const source = destructuredMatch[3].trim();

    if (!itemVar) {
      const error = new Error('each requiere una variable de iteración');
      /** @ts-expect-error — custom error code */
      error.code = 'INVALID_V_FOR';
      throw error;
    }
    if (!source) {
      const error = new Error('each requiere una expresión fuente');
      /** @ts-expect-error — custom error code */
      error.code = 'INVALID_V_FOR';
      throw error;
    }

    return { itemVar, indexVar, source };
  }

  // Try simple form
  const simpleMatch = simpleRe.exec(expr);
  if (simpleMatch) {
    const itemVar = simpleMatch[1];
    const source = simpleMatch[2].trim();

    if (!itemVar) {
      const error = new Error('each requiere una variable de iteración');
      /** @ts-expect-error — custom error code */
      error.code = 'INVALID_V_FOR';
      throw error;
    }
    if (!source) {
      const error = new Error('each requiere una expresión fuente');
      /** @ts-expect-error — custom error code */
      error.code = 'INVALID_V_FOR';
      throw error;
    }

    return { itemVar, indexVar: null, source };
  }

  // If neither regex matched, check for specific error conditions
  const inIndex = expr.indexOf(' in ');
  if (inIndex !== -1) {
    const left = expr.substring(0, inIndex).trim();
    const right = expr.substring(inIndex + 4).trim();

    if (!left) {
      const error = new Error('each requiere una variable de iteración');
      /** @ts-expect-error — custom error code */
      error.code = 'INVALID_V_FOR';
      throw error;
    }
    if (!right) {
      const error = new Error('each requiere una expresión fuente');
      /** @ts-expect-error — custom error code */
      error.code = 'INVALID_V_FOR';
      throw error;
    }
  }

  // Fallback: invalid syntax
  const error = new Error('each requiere la sintaxis \'item in source\' o \'(item, index) in source\'');
  /** @ts-expect-error — custom error code */
  error.code = 'INVALID_V_FOR';
  throw error;
}

/**
 * Process each directives in descendants of a parent element.
 * Recursively detects elements with `each` attribute, validates them,
 * extracts item templates, and replaces them with comment anchors.
 *
 * @param {Element} parent - Root element to search
 * @param {string[]} parentPath - DOM path to parent from __root
 * @param {Set<string>} signalNames
 * @param {Set<string>} computedNames
 * @param {Set<string>} propNames
 * @returns {ForBlock[]}
 */
export function processForBlocks(parent, parentPath, signalNames, computedNames, propNames) {
  /** @type {ForBlock[]} */
  const forBlocks = [];
  let forIdx = 0;

  /**
   * Recursively search for elements with each in the subtree.
   * @param {Element} node
   * @param {string[]} currentPath
   */
  function findForElements(node, currentPath) {
    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType !== 1) continue;
      const el = /** @type {Element} */ (child);

      if (el.hasAttribute('each')) {
        // Validate no conflicting if directive
        if (el.hasAttribute('if')) {
          const error = new Error('each y if no deben usarse en el mismo elemento');
          /** @ts-expect-error — custom error code */
          error.code = 'CONFLICTING_DIRECTIVES';
          throw error;
        }

        // Parse the each expression
        const expr = el.getAttribute('each');
        const { itemVar, indexVar, source } = parseEachExpression(expr);

        // Extract :key if present
        const keyExpr = el.hasAttribute(':key') ? el.getAttribute(':key') : null;

        // Clone the element and remove each and :key from the clone
        const clone = /** @type {Element} */ (el.cloneNode(true));
        clone.removeAttribute('each');
        clone.removeAttribute(':key');
        const templateHtml = clone.outerHTML;

        // Process internal bindings/events via partial walk
        const { bindings, events, showBindings, attrBindings, modelBindings, slots, processedHtml } = walkBranch(templateHtml, signalNames, computedNames, propNames);

        // Replace the original element with a comment node <!-- each -->
        const doc = node.ownerDocument;
        const comment = doc.createComment(' each ');
        node.replaceChild(comment, el);

        // Calculate anchorPath
        const updatedChildren = Array.from(node.childNodes);
        const commentIndex = updatedChildren.indexOf(comment);
        const anchorPath = [...currentPath, `childNodes[${commentIndex}]`];

        // Create ForBlock
        forBlocks.push({
          varName: `__for${forIdx++}`,
          itemVar,
          indexVar,
          source,
          keyExpr,
          templateHtml: processedHtml,
          anchorPath,
          _anchorNode: comment,
          bindings,
          events,
          showBindings,
          attrBindings,
          modelBindings,
          slots,
        });
      } else {
        // Recurse into non-each elements to find nested each
        const childPath = [...currentPath, `childNodes[${i}]`];
        findForElements(el, childPath);
      }
    }
  }

  findForElements(parent, parentPath);
  return forBlocks;
}


// ── Ref detection ───────────────────────────────────────────────────

/**
 * Detect ref="name" attributes on elements in the DOM tree.
 * Removes the ref attribute from each element after recording.
 *
 * @param {Element} rootEl — jsdom DOM element (parsed template root)
 * @returns {RefBinding[]}
 * @throws {Error} with code DUPLICATE_REF if same ref name appears on multiple elements
 */
export function detectRefs(rootEl) {
  /** @type {RefBinding[]} */
  const refBindings = [];
  /** @type {Set<string>} */
  const seen = new Set();

  const elements = rootEl.querySelectorAll('[ref]');

  for (const el of elements) {
    const refName = el.getAttribute('ref');

    // Check for duplicate ref names
    if (seen.has(refName)) {
      const error = new Error(`Duplicate ref name '${refName}' — each ref must be unique`);
      /** @ts-expect-error — custom error code */
      error.code = 'DUPLICATE_REF';
      throw error;
    }
    seen.add(refName);

    // Compute DOM path from rootEl to el
    const path = [];
    let current = el;
    while (current && current !== rootEl) {
      const parent = current.parentNode;
      if (!parent) break;
      const children = Array.from(parent.childNodes);
      const idx = children.indexOf(current);
      path.unshift(`childNodes[${idx}]`);
      current = parent;
    }

    // Remove the ref attribute
    el.removeAttribute('ref');

    refBindings.push({ refName, path });
  }

  return refBindings;
}
