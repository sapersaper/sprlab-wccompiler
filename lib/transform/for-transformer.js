/**
 * For-loop expression transformer for wcCompiler v2.
 *
 * Transforms expressions within the scope of each-blocks,
 * and checks whether bindings/expressions are static (item/index only).
 *
 * @module transform/for-transformer
 */

import { transformExpr } from './expr-transformer.js';

/**
 * Transform an expression within the scope of an each block.
 * - References to itemVar and indexVar are left UNTRANSFORMED
 * - References to component variables (props, reactive, computed) ARE transformed
 *
 * @param {string} expr - The expression to transform
 * @param {string} itemVar - Name of the iteration variable
 * @param {string | null} indexVar - Name of the index variable
 * @param {Set<string>} propsSet
 * @param {Set<string>} rootVarNames - Set of signal names
 * @param {Set<string>} computedNames
 * @param {string[]} methodNames
 * @returns {string}
 */
export function transformForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames, methodNames = [], constantNames = []) {
  let r = expr;
  const excludeSet = new Set([itemVar]);
  if (indexVar) excludeSet.add(indexVar);

  for (const p of propsSet) {
    if (excludeSet.has(p)) continue;
    // First: transform name() calls → this._state.name (don't double-call)
    r = r.replace(new RegExp(`\\b${p}\\(\\)`, 'g'), `this._state.${p}`);
    // Then: transform bare name references (not already transformed)
    r = r.replace(new RegExp(`(?<!_state\\.)\\b${p}\\b(?!\\()`, 'g'), `this._state.${p}`);
  }
  for (const n of rootVarNames) {
    if (excludeSet.has(n)) continue;
    // First: transform name() calls → this._state.name (don't double-call)
    r = r.replace(new RegExp(`\\b${n}\\(\\)`, 'g'), `this._state.${n}`);
    // Then: transform bare name references (not already transformed)
    r = r.replace(new RegExp(`(?<!_state\\.)\\b${n}\\b(?!\\()`, 'g'), `this._state.${n}`);
  }
  for (const n of computedNames) {
    if (excludeSet.has(n)) continue;
    // Phase 2: computed reads → this._state.n (prevent double-transform with (?<!\.))
    r = r.replace(new RegExp(`\\b${n}\\(\\)`, 'g'), `this._state.${n}`);
    r = r.replace(new RegExp(`(?<!\\.)\\b${n}\\b(?!\\()`, 'g'), `this._state.${n}`);
  }
  // Transform constant references: name → this._const_name (no function call)
  for (const n of constantNames) {
    if (excludeSet.has(n)) continue;
    r = r.replace(new RegExp(`\\b${n}\\b(?!\\()`, 'g'), `this._const_${n}`);
  }
  // Transform method calls: methodName(args) → this._methodName(args)
  for (const m of methodNames) {
    if (excludeSet.has(m)) continue;
    // Transform method calls with arguments
    r = r.replace(new RegExp(`\\b${m}\\(`, 'g'), `this._${m}(`);
  }
  // Transform bare method references (not followed by parentheses)
  for (const m of methodNames) {
    if (excludeSet.has(m)) continue;
    r = r.replace(new RegExp(`\\b${m}\\b(?!\\()`, 'g'), `this._${m}`);
  }
  return r;
}

/**
 * Check if a binding name is static within an each scope (references only item/index).
 * A binding is static if it starts with itemVar + "." or equals itemVar or indexVar.
 *
 * @param {string} name - The binding name (e.g. 'item.name', 'index', 'title')
 * @param {string} itemVar
 * @param {string | null} indexVar
 * @returns {boolean}
 */
export function isStaticForBinding(name, itemVar, indexVar) {
  // Check if it's a simple reference to item or item.property (no operators)
  if (name === itemVar || name.startsWith(itemVar + '.')) {
    // But if it contains operators, it's not static - needs wrapping
    if (name.includes('?') || name.includes('||') || name.includes('&&')) {
      return false;
    }
    return true;
  }
  if (indexVar && name === indexVar) return true;
  return false;
}

/**
 * Check if an expression is static within an each scope (references only item/index, no component vars).
 *
 * @param {string} expr
 * @param {string} itemVar
 * @param {string | null} indexVar
 * @param {Set<string>} propsSet
 * @param {Set<string>} rootVarNames
 * @param {Set<string>} computedNames
 * @returns {boolean}
 */
export function isStaticForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames, constantNames = []) {
  const excludeSet = new Set([itemVar]);
  if (indexVar) excludeSet.add(indexVar);

  for (const p of propsSet) {
    if (excludeSet.has(p)) continue;
    if (new RegExp(`\\b${p}\\b`).test(expr)) return false;
  }
  for (const n of rootVarNames) {
    if (excludeSet.has(n)) continue;
    if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
  }
  for (const n of computedNames) {
    if (excludeSet.has(n)) continue;
    if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
  }
  for (const n of constantNames) {
    if (excludeSet.has(n)) continue;
    if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
  }
  return true;
}
