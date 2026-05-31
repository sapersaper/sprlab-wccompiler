import { parseHTML } from "linkedom";
import { walkBranch } from "./tree-walker.js";

// ── Dynamic component processing ────────────────────────────────────

/**
 * Process dynamic component elements (`<component :is="expr">`) in descendants of a parent element.
 * Recursively detects `<component>` elements, validates the `:is` attribute,
 * extracts prop/event bindings, and replaces them with comment anchors.
 *
 * @param {Element} parent - Root element to search
 * @param {string[]} parentPath - DOM path to parent from __root
 * @returns {DynamicComponentBinding[]}
 */
export function processDynamicComponents(parent, parentPath, signalNames = new Set(), computedNames = new Set(), propNames = new Set(), knownTags = new Set()) {
  /** @type {DynamicComponentBinding[]} */
  const dynamicComponents = [];
  let dynIdx = 0;

  /**
   * Recursively search for <component> elements in the subtree.
   * @param {Element} node
   * @param {string[]} currentPath
   */
  function findDynamicComponents(node, currentPath) {
    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType !== 1) continue;
      const el = /** @type {Element} */ (child);

      if (el.tagName === 'COMPONENT') {
        // Validate :is attribute is present
        const isExpr = el.getAttribute(':is');
        if (!isExpr) {
          const error = new Error(':is attribute is required on <component> elements');
          /** @ts-expect-error — custom error code */
          error.code = 'MISSING_IS_ATTRIBUTE';
          throw error;
        }

        // Collect prop bindings (:attr="expr", excluding :is)
        /** @type {DynPropBinding[]} */
        const props = [];
        // Collect event bindings (@event="handler")
        /** @type {DynEventBinding[]} */
        const events = [];

        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith(':') && attr.name !== ':is') {
            props.push({
              attr: attr.name.slice(1),
              expression: attr.value,
            });
          } else if (attr.name.startsWith('@')) {
            events.push({
              event: attr.name.slice(1),
              handler: attr.value,
            });
          }
        }

        // Save and process inner content BEFORE replacing the component.
        // This preserves slots, bindings, events, and nested directives (if/for).
        const innerHtml = el.innerHTML;

        // Replace <component> with a comment node <!-- dynamic -->
        const doc = node.ownerDocument;
        const comment = doc.createComment(' dynamic ');
        node.replaceChild(comment, el);

        // Process the saved inner content to extract slots and directives
        const innerResult = innerHtml ? walkBranch(innerHtml, signalNames, computedNames, propNames, new Set(), knownTags) : null;

        // Create DynamicComponentBinding
        const currentDynIdx = dynIdx++;
        dynamicComponents.push({
          varName: `__dyn${currentDynIdx}`,
          isExpression: isExpr,
          props,
          events,
          anchorType: 'dynamic',
          anchorIndex: currentDynIdx,
          _anchorNode: comment,
          innerHtml: innerHtml || '',
          innerProcessed: innerResult,
        });
      } else {
        // Recurse into non-component elements to find nested dynamic components
        const childPath = [...currentPath, `childNodes[${i}]`];
        findDynamicComponents(el, childPath);
      }
    }
  }

  findDynamicComponents(parent, parentPath);
  return dynamicComponents;
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