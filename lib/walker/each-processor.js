import { parseHTML } from "linkedom";
import { walkBranch } from "./tree-walker.js";

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
export function processForBlocks(parent, parentPath, signalNames, computedNames, propNames, knownTags = new Set()) {
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

        // Extract :key if present, or convert key="{{ expr }}" to :key
        let keyExpr = null;
        if (el.hasAttribute(':key')) {
          keyExpr = el.getAttribute(':key');
        } else if (el.hasAttribute('key')) {
          // Support Mustache-style key bindings: key="{{ item.id }}" or key={{ item.id }}
          const keyValue = el.getAttribute('key');
          
          // Case 1: key="{{ expr }}" (with quotes)
          const mustacheMatch = keyValue.match(/^\{\{(.+)\}\}$/);
          if (mustacheMatch) {
            keyExpr = mustacheMatch[1].trim();
            el.removeAttribute('key');
          }
          // Case 2: key="{{" (malformed - HTML parser split the attribute)
          // This happens when source has key={{ expr }} without quotes
          else if (keyValue === '{{' || keyValue.startsWith('{{')) {
            // Try to reconstruct the expression from sibling attributes
            // The parser may have created: key="{{" item.id="" }=""
            const allAttrs = Array.from(el.attributes);
            const keyAttrIndex = allAttrs.findIndex(a => a.name === 'key');
            
            // Look for pattern: key="{{", then expression parts, then }=""
            let exprParts = [];
            let foundClosing = false;
            
            for (let i = keyAttrIndex + 1; i < allAttrs.length; i++) {
              const attr = allAttrs[i];
              if (attr.name === '}') {
                foundClosing = true;
                break;
              }
              // Collect attribute names as part of expression (e.g., "item.id")
              if (attr.value === '') {
                exprParts.push(attr.name);
              }
            }
            
            if (foundClosing && exprParts.length > 0) {
              // Reconstruct expression: "item.id"
              keyExpr = exprParts.join('.');
              
              // Remove all the malformed attributes
              el.removeAttribute('key');
              exprParts.forEach(part => {
                // Remove each part of the split expression
                const attrsToRemove = Array.from(el.attributes).filter(a => 
                  part.split('.').includes(a.name) || a.name === '}'
                );
                attrsToRemove.forEach(a => el.removeAttribute(a.name));
              });
              el.removeAttribute('}');
            }
          }
        }

        // Transform $index shorthand to the actual index variable
        if (keyExpr === '$index') {
          keyExpr = indexVar || '__idx';
        }

        // Clone the element and remove each and :key from the clone
        const clone = /** @type {Element} */ (el.cloneNode(true));
        clone.removeAttribute('each');
        clone.removeAttribute(':key');
        const templateHtml = clone.outerHTML;

        // Process internal bindings/events via partial walk
        const { bindings, events, showBindings, attrBindings, modelBindings, slots, childComponents: forChildComponents, forBlocks: nestedForBlocks, ifBlocks: nestedIfBlocks, dynamicComponents: nestedDynamicComponents, processedHtml } = walkBranch(templateHtml, signalNames, computedNames, propNames, new Set(), knownTags);

        // Replace the original element with a comment node <!-- each -->
        const doc = node.ownerDocument;
        const comment = doc.createComment(' each ');
        node.replaceChild(comment, el);

        // Create ForBlock
        const currentForIdx = forIdx++;
        forBlocks.push({
          varName: `__for${currentForIdx}`,
          itemVar,
          indexVar,
          source,
          keyExpr,
          templateHtml: processedHtml,
          anchorType: 'each',
          anchorIndex: currentForIdx,
          _anchorNode: comment,
          bindings,
          events,
          showBindings,
          attrBindings,
          modelBindings,
          slots,
          childComponents: forChildComponents,
          forBlocks: nestedForBlocks,
          ifBlocks: nestedIfBlocks,
          dynamicComponents: nestedDynamicComponents,
        });
      } else {
        // Skip elements with if/else-if/else attributes — those will be processed
        // by processIfChains which calls walkBranch on their content, and walkBranch
        // will call processForBlocks to find any nested each inside them.
        // This prevents the inner each from being found at the wrong nesting level
        // with an anchor path relative to the wrong root.
        if (el.hasAttribute('if') || el.hasAttribute('else-if') || el.hasAttribute('else')) {
          continue;
        }
        // Recurse into non-each elements to find nested each
        const childPath = [...currentPath, `childNodes[${i}]`];
        findForElements(el, childPath);
      }
    }
  }

  findForElements(parent, parentPath);
  return forBlocks;
}

