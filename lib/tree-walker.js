/**
 * Tree Walker for parsed templates.
 *
 * Walks a jsdom DOM tree to discover:
 * - Text bindings {{var}} with childNodes[n] paths
 * - Event bindings @event="handler"
 * - Slots <slot> (named, default, with slotProps)
 *
 * Produces { bindings, events, slots } arrays with path metadata.
 */

import { JSDOM } from 'jsdom';

/**
 * Convert a path array to a JS expression string.
 * e.g. pathExpr(['childNodes[0]', 'childNodes[1]'], '__root') => '__root.childNodes[0].childNodes[1]'
 *
 * @param {string[]} parts - Array of childNodes[n] path segments
 * @param {string} rootVar - Root variable name
 * @returns {string}
 */
export function pathExpr(parts, rootVar) {
  return parts.length === 0 ? rootVar : rootVar + '.' + parts.join('.');
}

/**
 * Walk a DOM tree rooted at rootEl, discovering bindings, events, and slots.
 *
 * @param {Element} rootEl - jsdom DOM element (the parsed template root)
 * @param {Set<string>} propsSet - Set of prop names
 * @param {Set<string>} computedNames - Set of computed property names
 * @param {Set<string>} rootVarNames - Set of root-level reactive variable names
 * @returns {{ bindings: Binding[], events: EventBinding[], slots: SlotDef[] }}
 */
export function walkTree(rootEl, propsSet, computedNames, rootVarNames) {
  const bindings = [];
  const events = [];
  const slots = [];
  let bindIdx = 0;
  let eventIdx = 0;
  let slotIdx = 0;

  function bindingType(name) {
    if (propsSet.has(name)) return 'prop';
    if (computedNames.has(name)) return 'computed';
    return 'internal';
  }

  function walk(node, pathParts) {
    // --- Element node ---
    if (node.nodeType === 1) {
      // Detect <slot> elements
      if (node.tagName === 'SLOT') {
        const slotName = node.getAttribute('name') || '';
        const varName = `__s${slotIdx++}`;
        const defaultContent = node.innerHTML.trim();

        // Collect slotProps (attributes starting with :)
        const slotProps = [];
        for (const attr of Array.from(node.attributes)) {
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
        const doc = node.ownerDocument;
        const placeholder = doc.createElement('span');
        placeholder.setAttribute('data-slot', slotName || 'default');
        if (defaultContent) placeholder.innerHTML = defaultContent;
        node.parentNode.replaceChild(placeholder, node);
        return;
      }

      // Check for @event attributes
      const attrsToRemove = [];
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.startsWith('@')) {
          const varName = `__e${eventIdx++}`;
          events.push({
            varName,
            event: attr.name.slice(1),
            handler: attr.value,
            path: [...pathParts],
          });
          attrsToRemove.push(attr.name);
        }
      }
      attrsToRemove.forEach((a) => node.removeAttribute(a));
    }

    // --- Text node with interpolations ---
    if (node.nodeType === 3 && /\{\{\w+\}\}/.test(node.textContent)) {
      const text = node.textContent;
      const trimmed = text.trim();
      const soleMatch = trimmed.match(/^\{\{(\w+)\}\}$/);
      const parent = node.parentNode;

      // Case 1: {{var}} is the sole content of the parent element
      if (soleMatch && parent.childNodes.length === 1) {
        const varName = `__b${bindIdx++}`;
        bindings.push({
          varName,
          name: soleMatch[1],
          type: bindingType(soleMatch[1]),
          path: pathParts.slice(0, -1),
        });
        node.textContent = '';
        return;
      }

      // Case 2: Mixed text and interpolations — split into spans
      const doc = node.ownerDocument;
      const fragment = doc.createDocumentFragment();
      const parts = text.split(/(\{\{\w+\}\})/);
      const parentPath = pathParts.slice(0, -1);

      // Find the index of this text node among its siblings
      let baseIndex = 0;
      for (const child of parent.childNodes) {
        if (child === node) break;
        baseIndex++;
      }

      let offset = 0;
      for (const part of parts) {
        const bm = part.match(/^\{\{(\w+)\}\}$/);
        if (bm) {
          fragment.appendChild(doc.createElement('span'));
          const varName = `__b${bindIdx++}`;
          bindings.push({
            varName,
            name: bm[1],
            type: bindingType(bm[1]),
            path: [...parentPath, `childNodes[${baseIndex + offset}]`],
          });
        } else if (part) {
          fragment.appendChild(doc.createTextNode(part));
        }
        offset++;
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
  return { bindings, events, slots };
}
