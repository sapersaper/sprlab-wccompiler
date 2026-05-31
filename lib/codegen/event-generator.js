/**
 * Event handler code generation helpers.
 *
 * Extracted from codegen.js — generates JS expressions for template event
 * handlers (click, input, etc.) in both top-level and for-loop contexts.
 */

import { transformExpr, transformMethodBody } from '../transform/expr-transformer.js';
import { transformForExpr } from '../transform/for-transformer.js';

/**
 * Generate the JS expression for an event handler based on its type:
 * - Simple name (e.g. "removeItem") → this._removeItem.bind(this)
 * - Function call (e.g. "removeItem(item)") → (e) => { this._removeItem(item); }
 * - Arrow function (e.g. "() => removeItem(item)") → () => { removeItem(item); }
 *
 * @param {string} handler — The raw handler string from the template
 * @param {string[]} signalNames
 * @param {string[]} computedNames
 * @param {string|null} propsObjectName
 * @param {Set<string>} propNames
 * @param {string|null} emitsObjectName
 * @param {string[]} constantNames
 * @param {Map<string,string>} [modelVarMap] — Map from model varName → propName
 * @param {string[]} methodNames - Array of component method names (BUG-0017 fix)
 * @returns {string}
 */
export function generateEventHandler(handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap = new Map(), methodNames = []) {
  if (handler.includes('=>')) {
    // Arrow function expression: (e) => removeItem(item)
    const arrowIdx = handler.indexOf('=>');
    const params = handler.slice(0, arrowIdx).trim();
    let body = handler.slice(arrowIdx + 2).trim();
    body = transformMethodBody(body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, [], constantNames, modelVarMap, methodNames);
    return `${params} => { ${body}; }`;
  } else if (handler.includes('(')) {
    // Function call expression: removeItem(item)
    const parenIdx = handler.indexOf('(');
    const fnName = handler.slice(0, parenIdx).trim();
    const args = handler.slice(parenIdx + 1, handler.lastIndexOf(')')).trim();

    // Handle signal.set(value) → assign via transformMethodBody
    if (fnName.endsWith('.set')) {
      const body = transformMethodBody(handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, [], constantNames, modelVarMap, methodNames);
      return `(e) => { ${body}; }`;
    }

    const transformedArgs = args ? transformExpr(args, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap) : '';
    return `(e) => { this._${fnName}(${transformedArgs}); }`;
  } else {
    // Simple method name
    return `this._${handler}.bind(this)`;
  }
}

/**
 * Generate the JS expression for an event handler inside an each block.
 * Similar to generateEventHandler but uses transformForExpr for the each scope.
 *
 * @param {string} handler
 * @param {string} itemVar
 * @param {string|null} indexVar
 * @param {Set<string>} propNames
 * @param {Set<string>} signalNamesSet
 * @param {Set<string>} computedNamesSet
 * @param {string[]} methodNames
 * @returns {string}
 */
export function generateForEventHandler(handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames) {
  if (handler.includes('=>')) {
    // Arrow function expression
    const arrowIdx = handler.indexOf('=>');
    const params = handler.slice(0, arrowIdx).trim();
    let body = handler.slice(arrowIdx + 2).trim();
    body = transformForExpr(body, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
    return `${params} => { ${body}; }`;
  } else if (handler.includes('(')) {
    // Function call expression: removeItem(item)
    const parenIdx = handler.indexOf('(');
    const fnName = handler.slice(0, parenIdx).trim();
    const args = handler.slice(parenIdx + 1, handler.lastIndexOf(')')).trim();

    // Handle signal.set(value) — treat as signal write
    if (fnName.endsWith('.set')) {
      const body = transformForExpr(handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      return `(e) => { ${body}; }`;
    }

    const transformedArgs = args ? transformForExpr(args, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames) : '';
    return `(e) => { this._${fnName}(${transformedArgs}); }`;
  } else {
    // Simple method name
    return `this._${handler}.bind(this)`;
  }
}
