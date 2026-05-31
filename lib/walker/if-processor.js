import { walkBranch, isChainPredecessor } from './tree-walker.js';

export function buildIfBlock(chain, parent, parentPath, idx, signalNames, computedNames, propNames, knownTags = new Set()) {
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
    const { bindings, events, showBindings, attrBindings, modelBindings, slots, childComponents, forBlocks, ifBlocks, dynamicComponents, processedHtml } = walkBranch(templateHtml, signalNames, computedNames, propNames, new Set(), knownTags);

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
      childComponents,
      forBlocks,
      ifBlocks,
      dynamicComponents,
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

  return {
    varName: `__if${idx}`,
    anchorType: 'if',
    anchorIndex: idx,
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
export function processIfChains(parent, parentPath, signalNames, computedNames, propNames, knownTags = new Set()) {
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
          ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames, knownTags));
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
        ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames, knownTags));
        currentChain = null;
      } else {
        // Non-conditional element: close any open chain
        if (currentChain) {
          ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames, knownTags));
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
      ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames, knownTags));
      currentChain = null;
    }
  }

  findIfChains(parent, parentPath);

  // Normalize the DOM to merge adjacent text nodes created by element removal
  parent.normalize();

  return ifBlocks;
}
