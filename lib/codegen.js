/**
 * Code Generator for wcCompiler v2.
 *
 * Takes a complete ParseResult (with bindings, events populated by tree-walker)
 * and produces a self-contained JavaScript string with:
 * - Inline mini reactive runtime (zero imports)
 * - Scoped CSS injection
 * - HTMLElement class with signals, computeds, effects, events
 * - customElements.define registration
 *
 * This is a simplified version of v1's codegen, scoped to core features only:
 * signals, computeds, effects, text interpolation, event bindings, user methods.
 * No props, emits, slots, if, for, model, show, attr, refs, or lifecycle hooks.
 */

import { reactiveRuntime, buildInlineRuntime } from './reactive-runtime.js';
import { scopeCSS } from './css-scoper.js';
import { camelToKebab } from './parser-extractors.js';

/** @import { ParseResult } from './types.js' */

/**
 * Convert a path array to a JS expression string.
 * e.g. pathExpr(['childNodes[0]', 'childNodes[1]'], '__root') => '__root.childNodes[0].childNodes[1]'
 *
 * @param {string[]} parts
 * @param {string} rootVar
 * @returns {string}
 */
export function pathExpr(parts, rootVar) {
  return parts.length === 0 ? rootVar : rootVar + '.' + parts.join('.');
}

/**
 * Escape special regex characters in a string.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the signal reference for a slot prop source expression.
 *
 * @param {string} source — Source variable name from :prop="source"
 * @param {string[]} signalNames — Signal variable names
 * @param {string[]} computedNames — Computed variable names
 * @param {Set<string>} propNames — Prop names from defineProps
 * @returns {string}
 */
function slotPropRef(source, signalNames, computedNames, propNames) {
  if (propNames.has(source)) return `this._s_${source}()`;
  if (computedNames.includes(source)) return `this._c_${source}()`;
  if (signalNames.includes(source)) return `this._${source}()`;
  return `'${source}'`;
}

/**
 * Wrap an expression in parentheses if it contains operators that could have
 * precedence issues when combined with ?? (nullish coalescing).
 *
 * This prevents bugs like: this._count() || 'No items' ?? ''
 * which JavaScript interprets as: this._count() || ('No items' ?? '')
 *
 * Operators that need wrapping:
 * - Ternary: ? :
 * - Logical OR: ||
 * - Logical AND: &&
 * - Nullish coalescing: ?? (nested)
 *
 * @param {string} expr - Expression to potentially wrap
 * @returns {string} - Wrapped expression if it contains risky operators, otherwise unchanged
 */
function wrapTernaryExpr(expr) {
  const trimmed = expr.trim();
  
  // Check for operators that have lower precedence than ?? or can cause ambiguity
  // Ternary operator (? :)
  const hasTernary = trimmed.includes('?') && trimmed.includes(':');
  
  // Logical OR (||)
  const hasLogicalOr = trimmed.includes('||');
  
  // Logical AND (&&)
  const hasLogicalAnd = trimmed.includes('&&');
  
  // Nested nullish coalescing (??)
  // If expression contains ??, wrap it to avoid conflict with the trailing ?? ''
  const hasNullish = trimmed.includes('??');
  
  // Wrap if any risky operator is found
  if (hasTernary || hasLogicalOr || hasLogicalAnd || hasNullish) {
    return `(${trimmed})`;
  }
  
  return trimmed;
}

/**
 * Transform an expression by rewriting signal/computed variable references
 * to use `this._x()` / `this._c_x()` syntax for auto-unwrapping.
 *
 * Also handles `propsObjectName.propName` → `this._s_propName()` transformation.
 * Also handles `emitsObjectName(` → `this._emit(` transformation.
 *
 * Uses word-boundary regex for each known signal/computed name.
 * Does NOT transform if the name is followed by `.set(` (that's a write,
 * handled by transformMethodBody).
 *
 * @param {string} expr — Expression to transform
 * @param {string[]} signalNames — Signal variable names
 * @param {string[]} computedNames — Computed variable names
 * @param {string|null} [propsObjectName] — Props object variable name
 * @param {Set<string>} [propNames] — Set of prop names
 * @param {string|null} [emitsObjectName] — Emits object variable name
 * @returns {string}
 */
export function transformExpr(expr, signalNames, computedNames, propsObjectName = null, propNames = new Set(), emitsObjectName = null, constantNames = [], methodNames = [], modelVarMap = new Map()) {
  let result = expr;

  // BUG-0011 FIX: Protect string literals from transformation
  // Store original strings and replace with placeholders to prevent signal names inside strings from being transformed
  const stringPlaceholders = new Map();
  let stringPlaceholderIndex = 0;
  
  // Step 1: Match simple string literals only (single quotes and double quotes)
  result = result.replace(/(['"])(.*?)(?<!\\)\1/g, (match, quote, content) => {
    const placeholder = `__STRING_PLACEHOLDER_${stringPlaceholderIndex++}__`;
    stringPlaceholders.set(placeholder, match);
    return placeholder;
  });
  
  // Step 2: For template literals, protect the static parts (text between ${...})
  // We need to extract template literal static parts and protect them
  // Pattern: `static${expr}static${expr}static`
  // We'll protect each static part separately
  let templateLiteralIndex = 0;
  const templateLiteralParts = new Map();
  
  // Match template literals and protect their static parts
  result = result.replace(/`([^`]*)`/g, (match, content) => {
    // Split by ${...} expressions
    const parts = content.split(/\$\{[^}]*\}/);
    
    // Replace this template literal with a version where static parts are protected
    let result = '`';
    let exprIndex = 0;
    const exprs = content.match(/\$\{[^}]*\}/g) || [];
    
    for (let i = 0; i < parts.length; i++) {
      // Protect static part if it's not empty
      if (parts[i].length > 0) {
        const placeholder = `__TL_STATIC_${templateLiteralIndex++}__`;
        templateLiteralParts.set(placeholder, parts[i]);
        result += placeholder;
      }
      
      // Add back the expression
      if (exprIndex < exprs.length) {
        result += exprs[exprIndex++];
      }
    }
    
    result += '`';
    return result;
  });

  // BUG-0009 FIX: Protect object literal keys from transformation
  // Store original keys and replace with placeholders to prevent them from being transformed
  const keyPlaceholders = new Map();
  let placeholderIndex = 0;
  
  // Match ALL object literal keys (identifier or string before colon)
  // We need to loop because replace with /g only replaces non-overlapping matches
  let prevResult;
  do {
    prevResult = result;
    result = result.replace(/(\{|,|;)\s*(?:([a-zA-Z_$][\w$]*)|(['"])([^'"\\]*(?:\\.[^'"\\]*)*?)\3)\s*:/g, (match, prefix, identifierKey, quote, stringKey) => {
      const key = identifierKey || stringKey;
      if (key && !key.startsWith('__KEY_PLACEHOLDER_')) {
        const placeholder = `__KEY_PLACEHOLDER_${placeholderIndex++}__`;
        keyPlaceholders.set(placeholder, identifierKey ? key : `${quote}${key}${quote}`);
        return `${prefix} ${placeholder}:`;
      }
      return match;
    });
  } while (result !== prevResult);

  // Transform emit calls: emitsObjectName( → this._emit(
  if (emitsObjectName) {
    const emitsRe = new RegExp(`\\b${escapeRegex(emitsObjectName)}\\(`, 'g');
    result = result.replace(emitsRe, 'this._emit(');
  }

  // Transform method calls: methodName( → this._methodName(
  for (const name of methodNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const methodRe = new RegExp(`\\b${name}\\(`, 'g');
    result = result.replace(methodRe, `this._${name}(`);
  }

  // Transform props.x → this._s_x() BEFORE signal/computed transforms
  if (propsObjectName && propNames.size > 0) {
    const propsRe = new RegExp(`\\b${propsObjectName}\\.(\\w+)`, 'g');
    result = result.replace(propsRe, (match, propName) => {
      if (propNames.has(propName)) {
        return `this._s_${propName}()`;
      }
      return match; // leave unknown props unchanged
    });
  }

  // Transform bare prop names → this._s_x() (for template expressions like :style="{ color: myProp }")
  for (const propName of propNames) {
    if (propsObjectName && propName === propsObjectName) continue;
    if (emitsObjectName && propName === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b(${propName})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._s_${propName}()`);
  }

  // Transform model signal reads: varName() → this._m_{propName}() (BEFORE regular signals)
  for (const [varName, propNameVal] of modelVarMap) {
    if (propsObjectName && varName === propsObjectName) continue;
    if (emitsObjectName && varName === emitsObjectName) continue;
    // First: transform varName() calls → this._m_propName()
    const callRe = new RegExp(`\\b${varName}\\(\\)`, 'g');
    result = result.replace(callRe, `this._m_${propNameVal}()`);
    // Then: transform bare varName references (not followed by ( or .set()) → this._m_propName()
    const bareRe = new RegExp(`\\b(${varName})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._m_${propNameVal}()`);
  }

  // Transform computed names first (to avoid partial matches with signals)
  for (const name of computedNames) {
    // Skip propsObjectName and emitsObjectName
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    // First: transform name() calls → this._c_name() (replace the call, not just the name)
    const callRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(callRe, `this._c_${name}()`);
    // Then: transform bare name references (not followed by ( or .set() → this._c_name()
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._c_${name}()`);
  }

  // Transform signal names
  for (const name of signalNames) {
    // Skip propsObjectName and emitsObjectName
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    // First: transform name() calls → this._name() (replace the call, not just the name)
    const callRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(callRe, `this._${name}()`);
    // Then: transform bare name references (not followed by ( or .set() → this._name()
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._${name}()`);
  }

  // Transform constant names → this._const_name (no function call)
  for (const name of constantNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._const_${name}`);
  }
  
  // BUG-0009 FIX: Restore original object literal keys from placeholders
  for (const [placeholder, originalKey] of keyPlaceholders) {
    result = result.replace(placeholder, originalKey);
  }
  
  // BUG-0011 FIX: Restore original string literals from placeholders
  for (const [placeholder, originalString] of stringPlaceholders) {
    result = result.replace(placeholder, originalString);
  }
  
  // BUG-0011 FIX: Restore template literal static parts
  for (const [placeholder, originalPart] of templateLiteralParts) {
    result = result.replace(placeholder, originalPart);
  }
  
  return result;
}

/**
 * Transform a method/effect body by rewriting signal writes and reads.
 *
 * - `emitsObjectName(` → `this._emit(` (emit call)
 * - `props.x` → `this._s_x()` (prop access)
 * - `varName.set(value)` → `this._modelSet_{propName}(value)` (model signal write)
 * - `x.set(value)` → `this._x(value)` (signal write via setter)
 * - `varName()` → `this._m_{propName}()` (model signal read)
 * - `x()` → `this._x()` (signal read)
 * - Computed `x()` → `this._c_x()` (computed read)
 *
 * @param {string} body — Function body to transform
 * @param {string[]} signalNames — Signal variable names
 * @param {string[]} computedNames — Computed variable names
 * @param {string|null} [propsObjectName] — Props object variable name
 * @param {Set<string>} [propNames] — Set of prop names
 * @param {string|null} [emitsObjectName] — Emits object variable name
 * @param {string[]} [refVarNames] — Ref variable names from templateRef declarations
 * @param {string[]} [constantNames] — Constant variable names
 * @param {Map<string,string>} [modelVarMap] — Map from model varName → propName
 * @returns {string}
 */
/**
 * Transform the body of a component method to use instance references.
 * Handles signals, computed, props, emits, refs, constants, models, AND internal method calls.
 *
 * @param {string} body - The method body code
 * @param {string[]} signalNames - Array of signal names
 * @param {string[]} computedNames - Array of computed names
 * @param {string|null} propsObjectName - Name of the props object (e.g., 'props')
 * @param {Set<string>} propNames - Set of prop names
 * @param {string|null} emitsObjectName - Name of the emits object
 * @param {string[]} refVarNames - Array of ref variable names
 * @param {string[]} constantNames - Array of constant names
 * @param {Map<string,string>} modelVarMap - Map from model varName → propName
 * @param {string[]} methodNames - Array of component method names (BUG-0017 fix)
 * @returns {string} - Transformed method body
 */
export function transformMethodBody(body, signalNames, computedNames, propsObjectName = null, propNames = new Set(), emitsObjectName = null, refVarNames = [], constantNames = [], modelVarMap = new Map(), methodNames = []) {
  let result = body;

  // 0a. Transform emit calls: emitsObjectName( → this._emit(
  if (emitsObjectName) {
    const emitsRe = new RegExp(`\\b${escapeRegex(emitsObjectName)}\\(`, 'g');
    result = result.replace(emitsRe, 'this._emit(');
  }

  // 0b. Transform batch() calls: batch( → __batch(
  result = result.replace(/\bbatch\s*\(/g, '__batch(');

  // 0b. Transform props.x → this._s_x() BEFORE other transforms
  if (propsObjectName && propNames.size > 0) {
    const propsRe = new RegExp(`\\b${propsObjectName}\\.(\\w+)`, 'g');
    result = result.replace(propsRe, (match, propName) => {
      if (propNames.has(propName)) {
        return `this._s_${propName}()`;
      }
      return match;
    });
  }

  // 0c. Transform ref access: varName.value → this._varName.value
  for (const name of refVarNames) {
    const refRe = new RegExp(`\\b${name}\\.value\\b`, 'g');
    result = result.replace(refRe, `this._${name}.value`);
  }

  // 0d. Transform model signal writes: varName.set(expr) → this._modelSet_{propName}(expr)
  // Must run BEFORE regular signal .set() transforms
  for (const [varName, propNameVal] of modelVarMap) {
    if (propsObjectName && varName === propsObjectName) continue;
    if (emitsObjectName && varName === emitsObjectName) continue;
    const setRe = new RegExp(`\\b${varName}\\.set\\(`, 'g');
    result = result.replace(setRe, `this._modelSet_${propNameVal}(`);
  }

  // 1. Transform signal writes: x.set(value) → this._x(value)
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const setRe = new RegExp(`\\b${name}\\.set\\(`, 'g');
    result = result.replace(setRe, `this._${name}(`);
  }

  // 1b. Transform model signal reads: varName() → this._m_{propName}()
  // Must run BEFORE regular signal read transforms
  for (const [varName, propNameVal] of modelVarMap) {
    if (propsObjectName && varName === propsObjectName) continue;
    if (emitsObjectName && varName === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${varName}\\(\\)`, 'g');
    result = result.replace(readRe, `this._m_${propNameVal}()`);
  }

  // 2. Transform computed reads: x() → this._c_x()
  for (const name of computedNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(readRe, `this._c_${name}()`);
  }

  // 3. Transform signal reads: x() → this._x()
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(readRe, `this._${name}()`);
  }

  // 4. Transform constant reads: name → this._const_name
  for (const name of constantNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b${name}\\b(?!\\()`, 'g');
    result = result.replace(bareRe, `this._const_${name}`);
  }

  // 5. BUG-0017 FIX: Transform internal method calls: methodName(args) → this._methodName(args)
  for (const methodName of methodNames) {
    if (propsObjectName && methodName === propsObjectName) continue;
    if (emitsObjectName && methodName === emitsObjectName) continue;
    // Transform method calls with arguments: methodName( → this._methodName(
    const callRe = new RegExp(`\\b${methodName}\\(`, 'g');
    result = result.replace(callRe, `this._${methodName}(`);
  }

  return result;
}

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
export function transformForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames, methodNames = []) {
  let r = expr;
  const excludeSet = new Set([itemVar]);
  if (indexVar) excludeSet.add(indexVar);

  for (const p of propsSet) {
    if (excludeSet.has(p)) continue;
    // First: transform name() calls → this._s_name() (don't double-call)
    r = r.replace(new RegExp(`\\b${p}\\(\\)`, 'g'), `this._s_${p}()`);
    // Then: transform bare name references
    r = r.replace(new RegExp(`\\b${p}\\b(?!\\()`, 'g'), `this._s_${p}()`);
  }
  for (const n of rootVarNames) {
    if (excludeSet.has(n)) continue;
    // First: transform name() calls → this._name() (don't double-call)
    r = r.replace(new RegExp(`\\b${n}\\(\\)`, 'g'), `this._${n}()`);
    // Then: transform bare name references
    r = r.replace(new RegExp(`\\b${n}\\b(?!\\()`, 'g'), `this._${n}()`);
  }
  for (const n of computedNames) {
    if (excludeSet.has(n)) continue;
    // First: transform name() calls → this._c_name() (don't double-call)
    r = r.replace(new RegExp(`\\b${n}\\(\\)`, 'g'), `this._c_${n}()`);
    // Then: transform bare name references
    r = r.replace(new RegExp(`\\b${n}\\b(?!\\()`, 'g'), `this._c_${n}()`);
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
export function isStaticForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames) {
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
  return true;
}

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
    const transformedArgs = args ? transformForExpr(args, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames) : '';
    return `(e) => { this._${fnName}(${transformedArgs}); }`;
  } else {
    // Simple method name
    return `this._${handler}.bind(this)`;
  }
}

/**
 * Generate per-item setup code for bindings, events, show, attr, model, and slots.
 * Used by both keyed and non-keyed each effects.
 *
 * @param {string[]} lines — Output lines array
 * @param {object} forBlock — ForBlock with bindings, events, etc.
 * @param {string} itemVar
 * @param {string|null} indexVar
 * @param {Set<string>} propNames
 * @param {Set<string>} signalNamesSet
 * @param {Set<string>} computedNamesSet
 * @param {string[]} methodNames
 */
function generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames) {
  const indent = '        ';

  // Bindings
  for (const b of forBlock.bindings) {
    const nodeRef = pathExpr(b.path, 'node');
    if (isStaticForBinding(b.name, itemVar, indexVar)) {
      lines.push(`${indent}  ${nodeRef}.textContent = ${b.name} ?? '';`);
    } else {
      const expr = transformForExpr(b.name, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      lines.push(`${indent}  __effect(() => { ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? ''; });`);
    }
  }

  // Events
  for (const e of forBlock.events) {
    const nodeRef = pathExpr(e.path, 'node');
    const handlerExpr = generateForEventHandler(e.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
    lines.push(`${indent}  ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
  }

  // Show
  for (const sb of forBlock.showBindings) {
    const nodeRef = pathExpr(sb.path, 'node');
    if (isStaticForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet)) {
      lines.push(`${indent}  ${nodeRef}.style.display = (${sb.expression}) ? '' : 'none';`);
    } else {
      const expr = transformForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      lines.push(`${indent}  __effect(() => { ${nodeRef}.style.display = (${expr}) ? '' : 'none'; });`);
    }
  }

  // Attr bindings
  for (const ab of forBlock.attrBindings) {
    const nodeRef = pathExpr(ab.path, 'node');
    if (isStaticForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet)) {
      lines.push(`${indent}  const __val_${ab.varName} = ${ab.expression};`);
      lines.push(`${indent}  if (__val_${ab.varName} != null && __val_${ab.varName} !== false) { ${nodeRef}.setAttribute('${ab.attr}', __val_${ab.varName}); }`);
    } else {
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      lines.push(`${indent}  __effect(() => {`);
      lines.push(`${indent}    const __val = ${expr};`);
      lines.push(`${indent}    if (__val == null || __val === false) { ${nodeRef}.removeAttribute('${ab.attr}'); }`);
      lines.push(`${indent}    else { ${nodeRef}.setAttribute('${ab.attr}', __val); }`);
      lines.push(`${indent}  });`);
    }
  }

  // Model bindings
  for (const mb of (forBlock.modelBindings || [])) {
    const nodeRef = pathExpr(mb.path, 'node');
    lines.push(`${indent}  __effect(() => {`);
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      lines.push(`${indent}    ${nodeRef}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
    } else if (mb.prop === 'checked') {
      lines.push(`${indent}    ${nodeRef}.checked = !!this._${mb.signal}();`);
    } else {
      lines.push(`${indent}    ${nodeRef}.value = this._${mb.signal}() ?? '';`);
    }
    lines.push(`${indent}  });`);
    if (mb.prop === 'checked' && mb.radioValue === null) {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
    } else if (mb.coerce) {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
    } else {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
    }
  }

  // Scoped slots
  for (const s of (forBlock.slots || [])) {
    if (s.slotProps.length > 0) {
      const slotNodeRef = pathExpr(s.path, 'node');
      const propsEntries = s.slotProps.map(sp => `'${sp.prop}': ${sp.source}`).join(', ');
      lines.push(`${indent}  { const __slotEl = ${slotNodeRef};`);
      lines.push(`${indent}    const __sp = { ${propsEntries} };`);
      lines.push(`${indent}    let __h = __slotEl.innerHTML;`);
      lines.push(`${indent}    for (const [k, v] of Object.entries(__sp)) {`);
      lines.push(`${indent}      __h = __h.replace(new RegExp('\\\\{\\\\{\\\\s*' + k + '(\\\\(\\\\))?\\\\s*\\\\}\\\\}', 'g'), v ?? '');`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    __slotEl.innerHTML = __h;`);
      lines.push(`${indent}  }`);
    }
  }

  // Nested if/else-if/else chains (ifBlocks) - MUST come BEFORE forBlocks to maintain correct structure
  const processedForBlocks = new Set(); // Track which forBlocks are inside ifBlocks
  for (const ifBlock of (forBlock.ifBlocks || [])) {
    const vn = ifBlock.varName;
    const branches = ifBlock.branches;

    // 3.1: Create template elements for each branch
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      lines.push(`${indent}  const ${vn}_t${i} = document.createElement('template');`);
      lines.push(`${indent}  ${vn}_t${i}.innerHTML = \`${branch.templateHtml}\`;`);
    }

    // 3.1: Find anchor comment in the cloned node
    lines.push(`${indent}  const ${vn}_anchor = ${pathExpr(ifBlock.anchorPath, 'node')};`);

    // 3.2: Generate per-item conditional evaluation (static, not reactive)
    lines.push(`${indent}  let ${vn}_branch = null;`);
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      if (branch.type === 'if') {
        lines.push(`${indent}  if (${branch.expression}) { ${vn}_branch = ${i}; }`);
      } else if (branch.type === 'else-if') {
        lines.push(`${indent}  else if (${branch.expression}) { ${vn}_branch = ${i}; }`);
      } else {
        // else
        lines.push(`${indent}  else { ${vn}_branch = ${i}; }`);
      }
    }

    // 3.3: Insert only the matching branch node and apply branch bindings/events/show/attr/model
    lines.push(`${indent}  if (${vn}_branch !== null) {`);
    const tplArray = branches.map((_, i) => `${vn}_t${i}`).join(', ');
    lines.push(`${indent}    const ${vn}_tpl = [${tplArray}][${vn}_branch];`);
    lines.push(`${indent}    const ${vn}_clone = ${vn}_tpl.content.cloneNode(true);`);
    lines.push(`${indent}    const ${vn}_node = ${vn}_clone.firstChild;`);
    lines.push(`${indent}    ${vn}_anchor.parentNode.insertBefore(${vn}_node, ${vn}_anchor);`);

    // IMPORTANT: Generate nested forBlocks INSIDE the conditional block
    // This ensures inner loops only execute when conditional is true
    for (const innerFor of (forBlock.forBlocks || [])) {
      processedForBlocks.add(innerFor.varName); // Mark as processed
      const innerVn = innerFor.varName;
      const innerItemVar = innerFor.itemVar;
      const innerIndexVar = innerFor.indexVar;
      const innerSource = innerFor.source;
      const innerKeyExpr = innerFor.keyExpr;

      // Build excludeSet that includes BOTH outer and inner loop variables
      const outerExcludeVars = [itemVar];
      if (indexVar) outerExcludeVars.push(indexVar);
      const innerExcludeVars = [innerItemVar];
      if (innerIndexVar) innerExcludeVars.push(innerIndexVar);

      // Create inner template element
      lines.push(`${indent}    const ${innerVn}_tpl = document.createElement('template');`);
      lines.push(`${indent}    ${innerVn}_tpl.innerHTML = \`${innerFor.templateHtml}\`;`);

      // Find inner anchor INSIDE the conditional wrapper node
      lines.push(`${indent}    const ${innerVn}_anchor = ${pathExpr(innerFor.anchorPath, `${vn}_node`)};`);

      // Transform the inner source expression
      const innerSourceExpr = transformForExpr(innerSource, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      const innerSourceIsStatic = isStaticForExpr(innerSource, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);

      if (innerKeyExpr) {
        // ── Keyed reconciliation for nested each ──
        lines.push(`${indent}    const ${innerVn}_source = ${innerSourceIsStatic ? innerSource : innerSourceExpr};`);
        lines.push(`${indent}    const ${innerVn}_iter = typeof ${innerVn}_source === 'number'`);
        lines.push(`${indent}      ? Array.from({ length: ${innerVn}_source }, (_, i) => i + 1)`);
        lines.push(`${indent}      : (${innerVn}_source || []);`);
        lines.push(`${indent}    const ${innerVn}_newNodes = [];`);
        lines.push(`${indent}    ${innerVn}_iter.forEach((${innerItemVar}, ${innerIndexVar || '__idx'}) => {`);
        lines.push(`${indent}      const __key = ${innerKeyExpr};`);
        lines.push(`${indent}      const clone = ${innerVn}_tpl.content.cloneNode(true);`);
        lines.push(`${indent}      const innerNode = clone.firstChild;`);

        generateNestedItemSetup(lines, innerFor, itemVar, indexVar, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, indent + '      ');

        lines.push(`${indent}      ${innerVn}_newNodes.push(innerNode);`);
        lines.push(`${indent}    });`);
        lines.push(`${indent}    for (const n of ${innerVn}_newNodes) { ${innerVn}_anchor.parentNode.insertBefore(n, ${innerVn}_anchor); }`);
      } else {
        // ── Non-keyed nested each: iterate and clone ──
        lines.push(`${indent}    const ${innerVn}_source = ${innerSourceIsStatic ? innerSource : innerSourceExpr};`);
        lines.push(`${indent}    const ${innerVn}_iter = typeof ${innerVn}_source === 'number'`);
        lines.push(`${indent}      ? Array.from({ length: ${innerVn}_source }, (_, i) => i + 1)`);
        lines.push(`${indent}      : (${innerVn}_source || []);`);
        lines.push(`${indent}    ${innerVn}_iter.forEach((${innerItemVar}, ${innerIndexVar || '__idx'}) => {`);
        lines.push(`${indent}      const clone = ${innerVn}_tpl.content.cloneNode(true);`);
        lines.push(`${indent}      const innerNode = clone.firstChild;`);

        generateNestedItemSetup(lines, innerFor, itemVar, indexVar, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, indent + '      ');

        lines.push(`${indent}      ${innerVn}_anchor.parentNode.insertBefore(innerNode, ${innerVn}_anchor);`);
        lines.push(`${indent}    });`);
      }
    }

    // Apply branch bindings/events/show/attr/model using the outer loop's item variable
    const hasSetup = branches.some(b =>
      (b.bindings && b.bindings.length > 0) ||
      (b.events && b.events.length > 0) ||
      (b.showBindings && b.showBindings.length > 0) ||
      (b.attrBindings && b.attrBindings.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0)
    );
    if (hasSetup) {
      // Generate per-branch setup inline (static evaluation using item variable)
      for (let i = 0; i < branches.length; i++) {
        const branch = branches[i];
        const hasBranchSetup =
          (branch.bindings && branch.bindings.length > 0) ||
          (branch.events && branch.events.length > 0) ||
          (branch.showBindings && branch.showBindings.length > 0) ||
          (branch.attrBindings && branch.attrBindings.length > 0) ||
          (branch.modelBindings && branch.modelBindings.length > 0);
        if (!hasBranchSetup) continue;

        const keyword = i === 0 ? 'if' : 'else if';
        lines.push(`${indent}    ${keyword} (${vn}_branch === ${i}) {`);

        // Bindings (static: use item var directly)
        for (const b of branch.bindings) {
          const nodeRef = pathExpr(b.path, `${vn}_node`);
          if (isStaticForBinding(b.name, itemVar, indexVar)) {
            lines.push(`${indent}      ${nodeRef}.textContent = ${b.name} ?? '';`);
          } else {
            const expr = transformForExpr(b.name, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
            lines.push(`${indent}      __effect(() => { ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? ''; });`);
          }
        }

        // Events
        for (const e of branch.events) {
          const nodeRef = pathExpr(e.path, `${vn}_node`);
          const handlerExpr = generateForEventHandler(e.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
          lines.push(`${indent}      ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
        }

        // Show bindings
        for (const sb of (branch.showBindings || [])) {
          const nodeRef = pathExpr(sb.path, `${vn}_node`);
          if (isStaticForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet)) {
            lines.push(`${indent}      ${nodeRef}.style.display = (${sb.expression}) ? '' : 'none';`);
          } else {
            const expr = transformForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
            lines.push(`${indent}      __effect(() => { ${nodeRef}.style.display = (${expr}) ? '' : 'none'; });`);
          }
        }

        // Attr bindings
        for (const ab of (branch.attrBindings || [])) {
          const nodeRef = pathExpr(ab.path, `${vn}_node`);
          if (isStaticForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet)) {
            lines.push(`${indent}      const __val_${ab.varName} = ${ab.expression};`);
            lines.push(`${indent}      if (__val_${ab.varName} != null && __val_${ab.varName} !== false) { ${nodeRef}.setAttribute('${ab.attr}', __val_${ab.varName}); }`);
          } else {
            const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
            lines.push(`${indent}      __effect(() => {`);
            lines.push(`${indent}        const __val = ${expr};`);
            lines.push(`${indent}        if (__val == null || __val === false) { ${nodeRef}.removeAttribute('${ab.attr}'); }`);
            lines.push(`${indent}        else { ${nodeRef}.setAttribute('${ab.attr}', __val); }`);
            lines.push(`${indent}      });`);
          }
        }

        // Model bindings
        for (const mb of (branch.modelBindings || [])) {
          const nodeRef = pathExpr(mb.path, `${vn}_node`);
          lines.push(`${indent}      __effect(() => {`);
          if (mb.prop === 'checked' && mb.radioValue !== null) {
            lines.push(`${indent}        ${nodeRef}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
          } else if (mb.prop === 'checked') {
            lines.push(`${indent}        ${nodeRef}.checked = !!this._${mb.signal}();`);
          } else {
            lines.push(`${indent}        ${nodeRef}.value = this._${mb.signal}() ?? '';`);
          }
          lines.push(`${indent}      });`);
          if (mb.prop === 'checked' && mb.radioValue === null) {
            lines.push(`${indent}      ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
          } else if (mb.coerce) {
            lines.push(`${indent}      ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
          } else {
            lines.push(`${indent}      ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
          }
        }

        lines.push(`${indent}    }`);
      }
    }
    lines.push(`${indent}  }`);
  }

  // Nested each directives (forBlocks) - generate AFTER ifBlocks
  // NOTE: Skip forBlocks that were already generated inside ifBlocks
  for (const innerFor of (forBlock.forBlocks || [])) {
    // Skip if this forBlock was already processed inside an ifBlock
    if (processedForBlocks.has(innerFor.varName)) continue;
    
    const innerVn = innerFor.varName;
    const innerItemVar = innerFor.itemVar;
    const innerIndexVar = innerFor.indexVar;
    const innerSource = innerFor.source;
    const innerKeyExpr = innerFor.keyExpr;

    // Build excludeSet that includes BOTH outer and inner loop variables
    const outerExcludeVars = [itemVar];
    if (indexVar) outerExcludeVars.push(indexVar);
    const innerExcludeVars = [innerItemVar];
    if (innerIndexVar) innerExcludeVars.push(innerIndexVar);

    // Create inner template element
    lines.push(`${indent}  const ${innerVn}_tpl = document.createElement('template');`);
    lines.push(`${indent}  ${innerVn}_tpl.innerHTML = \`${innerFor.templateHtml}\`;`);

    // Find inner anchor comment in the cloned outer item node
    lines.push(`${indent}  const ${innerVn}_anchor = ${pathExpr(innerFor.anchorPath, 'node')};`);

    // Transform the inner source expression (may reference outer item var)
    const innerSourceExpr = transformForExpr(innerSource, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);

    // Determine if inner source is static (only references outer loop vars)
    const innerSourceIsStatic = isStaticForExpr(innerSource, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);

    if (innerKeyExpr) {
      // ── Keyed reconciliation for nested each ──
      lines.push(`${indent}  const ${innerVn}_source = ${innerSourceIsStatic ? innerSource : innerSourceExpr};`);
      lines.push(`${indent}  const ${innerVn}_iter = typeof ${innerVn}_source === 'number'`);
      lines.push(`${indent}    ? Array.from({ length: ${innerVn}_source }, (_, i) => i + 1)`);
      lines.push(`${indent}    : (${innerVn}_source || []);`);
      lines.push(`${indent}  const ${innerVn}_newNodes = [];`);
      lines.push(`${indent}  ${innerVn}_iter.forEach((${innerItemVar}, ${innerIndexVar || '__idx'}) => {`);
      lines.push(`${indent}    const __key = ${innerKeyExpr};`);
      lines.push(`${indent}    const clone = ${innerVn}_tpl.content.cloneNode(true);`);
      lines.push(`${indent}    const innerNode = clone.firstChild;`);

      // Generate inner item bindings with combined excludeSet
      generateNestedItemSetup(lines, innerFor, itemVar, indexVar, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, indent + '    ');

      lines.push(`${indent}    ${innerVn}_newNodes.push(innerNode);`);
      lines.push(`${indent}  });`);
      lines.push(`${indent}  for (const n of ${innerVn}_newNodes) { ${innerVn}_anchor.parentNode.insertBefore(n, ${innerVn}_anchor); }`);
    } else {
      // ── Non-keyed nested each: iterate and clone ──
      lines.push(`${indent}  const ${innerVn}_source = ${innerSourceIsStatic ? innerSource : innerSourceExpr};`);
      lines.push(`${indent}  const ${innerVn}_iter = typeof ${innerVn}_source === 'number'`);
      lines.push(`${indent}    ? Array.from({ length: ${innerVn}_source }, (_, i) => i + 1)`);
      lines.push(`${indent}    : (${innerVn}_source || []);`);
      lines.push(`${indent}  ${innerVn}_iter.forEach((${innerItemVar}, ${innerIndexVar || '__idx'}) => {`);
      lines.push(`${indent}    const clone = ${innerVn}_tpl.content.cloneNode(true);`);
      lines.push(`${indent}    const innerNode = clone.firstChild;`);

      // Generate inner item bindings with combined excludeSet
      generateNestedItemSetup(lines, innerFor, itemVar, indexVar, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, indent + '    ');

      lines.push(`${indent}    ${innerVn}_anchor.parentNode.insertBefore(innerNode, ${innerVn}_anchor);`);
      lines.push(`${indent}  });`);
    }
  }
}

/**
 * Generate inner item bindings/events/show/attr/model for a nested each directive.
 * Uses transformForExpr with an excludeSet that includes BOTH outer and inner loop variables.
 *
 * @param {string[]} lines - Output lines array
 * @param {ForBlock} innerFor - The nested ForBlock
 * @param {string} outerItemVar - Outer loop item variable
 * @param {string|null} outerIndexVar - Outer loop index variable
 * @param {string} innerItemVar - Inner loop item variable
 * @param {string|null} innerIndexVar - Inner loop index variable
 * @param {Set<string>} propNames - Prop names set
 * @param {Set<string>} signalNamesSet - Signal names set
 * @param {Set<string>} computedNamesSet - Computed names set
 * @param {string} indent - Current indentation
 */
function generateNestedItemSetup(lines, innerFor, outerItemVar, outerIndexVar, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, indent) {
  // Build combined exclude set with both outer and inner loop variables
  const combinedExcludeItemVar = innerItemVar;
  const combinedExcludeIndexVar = innerIndexVar;

  // For transformForExpr, we need to ensure both outer and inner vars are excluded.
  // We create a modified propNames/signalNamesSet/computedNamesSet that doesn't include
  // any of the loop variables. transformForExpr already excludes itemVar/indexVar,
  // but we also need to exclude the outer loop variables.
  // Strategy: filter out outer loop vars from the sets passed to transformForExpr
  const filteredSignalNames = new Set([...signalNamesSet].filter(n => n !== outerItemVar && n !== outerIndexVar));
  const filteredComputedNames = new Set([...computedNamesSet].filter(n => n !== outerItemVar && n !== outerIndexVar));
  const filteredPropNames = new Set([...propNames].filter(n => n !== outerItemVar && n !== outerIndexVar));

  // Helper: check if expression is static (only references inner/outer loop vars, no signals/computeds/props)
  function isNestedStatic(expr) {
    // If expression contains operators, it's not static - needs wrapping
    if (expr.includes('?') || expr.includes('||') || expr.includes('&&')) {
      return false;
    }
    
    // An expression is static if it only references the loop variables (outer + inner)
    const allExclude = new Set([innerItemVar, outerItemVar]);
    if (innerIndexVar) allExclude.add(innerIndexVar);
    if (outerIndexVar) allExclude.add(outerIndexVar);

    for (const p of propNames) {
      if (allExclude.has(p)) continue;
      if (new RegExp(`\\b${p}\\b`).test(expr)) return false;
    }
    for (const n of signalNamesSet) {
      if (allExclude.has(n)) continue;
      if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
    }
    for (const n of computedNamesSet) {
      if (allExclude.has(n)) continue;
      if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
    }
    return true;
  }

  // Helper: transform expression excluding both outer and inner loop vars
  function transformNested(expr) {
    return transformForExpr(expr, innerItemVar, innerIndexVar, filteredPropNames, filteredSignalNames, filteredComputedNames, methodNames);
  }

  // Bindings
  for (const b of innerFor.bindings) {
    const nodeRef = pathExpr(b.path, 'innerNode');
    if (isNestedStatic(b.name)) {
      lines.push(`${indent}${nodeRef}.textContent = ${b.name} ?? '';`);
    } else {
      const expr = transformNested(b.name);
      lines.push(`${indent}__effect(() => { ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? ''; });`);
    }
  }

  // Events
  for (const e of innerFor.events) {
    const nodeRef = pathExpr(e.path, 'innerNode');
    const handlerExpr = generateForEventHandler(e.handler, innerItemVar, innerIndexVar, filteredPropNames, filteredSignalNames, filteredComputedNames, methodNames);
    lines.push(`${indent}${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
  }

  // Show
  for (const sb of innerFor.showBindings) {
    const nodeRef = pathExpr(sb.path, 'innerNode');
    if (isNestedStatic(sb.expression)) {
      lines.push(`${indent}${nodeRef}.style.display = (${sb.expression}) ? '' : 'none';`);
    } else {
      const expr = transformNested(sb.expression);
      lines.push(`${indent}__effect(() => { ${nodeRef}.style.display = (${expr}) ? '' : 'none'; });`);
    }
  }

  // Attr bindings
  for (const ab of innerFor.attrBindings) {
    const nodeRef = pathExpr(ab.path, 'innerNode');
    if (isNestedStatic(ab.expression)) {
      lines.push(`${indent}const __val_${ab.varName} = ${ab.expression};`);
      lines.push(`${indent}if (__val_${ab.varName} != null && __val_${ab.varName} !== false) { ${nodeRef}.setAttribute('${ab.attr}', __val_${ab.varName}); }`);
    } else {
      const expr = transformNested(ab.expression);
      lines.push(`${indent}__effect(() => {`);
      lines.push(`${indent}  const __val = ${expr};`);
      lines.push(`${indent}  if (__val == null || __val === false) { ${nodeRef}.removeAttribute('${ab.attr}'); }`);
      lines.push(`${indent}  else { ${nodeRef}.setAttribute('${ab.attr}', __val); }`);
      lines.push(`${indent}});`);
    }
  }

  // Model bindings
  for (const mb of (innerFor.modelBindings || [])) {
    const nodeRef = pathExpr(mb.path, 'innerNode');
    lines.push(`${indent}__effect(() => {`);
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      lines.push(`${indent}  ${nodeRef}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
    } else if (mb.prop === 'checked') {
      lines.push(`${indent}  ${nodeRef}.checked = !!this._${mb.signal}();`);
    } else {
      lines.push(`${indent}  ${nodeRef}.value = this._${mb.signal}() ?? '';`);
    }
    lines.push(`${indent}});`);
    if (mb.prop === 'checked' && mb.radioValue === null) {
      lines.push(`${indent}${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
    } else if (mb.coerce) {
      lines.push(`${indent}${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
    } else {
      lines.push(`${indent}${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
    }
  }
}

/**
 * Generate a fully self-contained JS component from a ParseResult.
 *
 * @param {ParseResult} parseResult — Complete IR with bindings/events
 * @param {{ runtimeImportPath?: string }} [options] — Optional generation options
 * @returns {string} JavaScript source code
 */
export function generateComponent(parseResult, options = {}) {
  const {
    tagName,
    className,
    style,
    signals,
    computeds,
    effects,
    methods,
    bindings,
    events,
    processedTemplate,
    propDefs = [],
    propsObjectName = null,
    emits = [],
    emitsObjectName = null,
    ifBlocks = [],
    showBindings = [],
    forBlocks = [],
    onMountHooks = [],
    onDestroyHooks = [],
    onAdoptHooks = [],
    modelBindings = [],
    modelPropBindings = [],
    attrBindings = [],
    slots = [],
    constantVars = [],
    watchers = [],
    refs = [],
    refBindings = [],
    childComponents = [],
    childImports = [],
    exposeNames = [],
    modelDefs = [],
    dynamicComponents = [],
    usesBatch = false,
  } = parseResult;

  const signalNames = signals.map(s => s.name);
  const computedNames = computeds.map(c => c.name);
  const constantNames = constantVars.map(v => v.name);
  const methodNames = methods.map(m => m.name);
  const refVarNames = refs.map(r => r.varName);
  const propNames = new Set(propDefs.map(p => p.name));

  // Build model var name → prop name map for transform functions
  const modelVarMap = new Map();
  for (const md of modelDefs) {
    modelVarMap.set(md.varName, md.name);
  }

  const lines = [];
  const comment = options.comments ? (text) => lines.push(`    // --- ${text} ---`) : () => {};

  // ── 0. Source comment ──
  if (options.sourceFile) {
    lines.push(`// Generated from: ${options.sourceFile} (wcCompiler)`);
  }

  // ── 1. Reactive runtime (shared import or inline) ──
  if (options.comments) lines.push('// ── Runtime ──────────────────────────────────────────');
  // Determine which runtime functions this component needs
  const needsEffect = effects.length > 0 || bindings.length > 0 || showBindings.length > 0 || modelBindings.length > 0 || modelPropBindings.length > 0 || attrBindings.length > 0 || ifBlocks.length > 0 || forBlocks.length > 0 || watchers.length > 0 || childComponents.length > 0 || dynamicComponents.length > 0 || slots.some(s => s.slotProps.length > 0);
  const needsComputed = computeds.length > 0;
  const needsUntrack = watchers.length > 0;
  const needsBatch = usesBatch;

  if (options.runtimeImportPath) {
    // Tree-shake: only import what this component actually uses
    const usedRuntime = new Set(['__signal']); // always need __signal
    if (needsComputed) usedRuntime.add('__computed');
    if (needsEffect) usedRuntime.add('__effect');
    if (needsBatch) usedRuntime.add('__batch');
    if (needsUntrack) usedRuntime.add('__untrack');
    const imports = [...usedRuntime].join(', ');
    lines.push(`import { ${imports} } from '${options.runtimeImportPath}';`);
  } else {
    // Standalone: inline only the runtime functions this component needs
    lines.push(buildInlineRuntime({ needsComputed, needsEffect, needsBatch, needsUntrack }).trim());
  }
  lines.push('');

  // ── 1b. Child component imports ──
  for (const ci of childImports) {
    if (ci.sideEffect) {
      // Side-effect import: no identifier, child self-registers
      lines.push(`import '${ci.importPath}';`);
    } else {
      // Named import with guarded registration
      lines.push(`import ${ci.identifier} from '${ci.importPath}';`);
      lines.push(`if (!customElements.get(${ci.identifier}.__meta.tag)) customElements.define(${ci.identifier}.__meta.tag, ${ci.identifier});`);
    }
  }
  if (childImports.length > 0) {
    lines.push('');
  }

  // ── 2. CSS injection (scoped, deduplicated via id guard) ──
  if (style) {
    if (options.comments) lines.push('// ── Styles ───────────────────────────────────────────');
    const scoped = scopeCSS(style, tagName);
    const cssId = `__css_${className}`;
    lines.push(`if (!document.getElementById('${cssId}')) {`);
    lines.push(`  const ${cssId} = document.createElement('style');`);
    lines.push(`  ${cssId}.id = '${cssId}';`);
    lines.push(`  ${cssId}.textContent = \`${scoped}\`;`);
    lines.push(`  document.head.appendChild(${cssId});`);
    lines.push('}');
    lines.push('');
  }

  // ── 3. Template element ──
  if (options.comments) lines.push('// ── Template ─────────────────────────────────────────');
  lines.push(`const __t_${className} = document.createElement('template');`);
  lines.push(`__t_${className}.innerHTML = \`${processedTemplate || ''}\`;`);
  lines.push('');

  // ── 4. HTMLElement class ──
  if (options.comments) lines.push('// ── Component ────────────────────────────────────────');
  lines.push(`class ${className} extends HTMLElement {`);

  // Static observedAttributes (if props or model props exist)
  const modelAttrNames = modelDefs.map(md => camelToKebab(md.name));
  if (propDefs.length > 0 || modelDefs.length > 0) {
    const propAttrNames = propDefs.map(p => `'${p.attrName}'`);
    // For model props, observe BOTH kebab-case AND camelCase forms
    // Vue sets camelCase (modelValue), native HTML uses kebab-case (model-value)
    const modelAttrEntries = [];
    for (let i = 0; i < modelDefs.length; i++) {
      const kebab = modelAttrNames[i];
      const camel = modelDefs[i].name;
      modelAttrEntries.push(`'${kebab}'`);
      // Only add camelCase if it differs from kebab-case
      if (kebab !== camel) {
        modelAttrEntries.push(`'${camel}'`);
      }
    }
    const allAttrNames = [...propAttrNames, ...modelAttrEntries].join(', ');
    lines.push(`  static get observedAttributes() { return [${allAttrNames}]; }`);
    lines.push('');
  }

  // Static __scopedSlots array (lists slot names with reactive props)
  const scopedSlotNames = slots.filter(s => s.name && s.slotProps.length > 0).map(s => s.name);
  if (scopedSlotNames.length > 0) {
    const scopedArr = scopedSlotNames.map(n => `'${n}'`).join(', ');
    lines.push(`  static __scopedSlots = [${scopedArr}];`);
    lines.push('');
  }

  // Static __meta — component metadata for framework adapters (React wrappers, Angular events, etc.)
  {
    const metaProps = propDefs.map(p => `{ name: '${p.name}', default: ${p.default} }`).join(', ');
    const metaEvents = emits.map(e => `'${e}'`).join(', ');
    const metaModels = modelDefs.map(m => `'${m.name}'`).join(', ');
    const metaSlots = slots.filter(s => s.name).map(s => `'${s.name}'`).join(', ');
    lines.push(`  static __meta = { tag: '${tagName}', props: [${metaProps}], events: [${metaEvents}], models: [${metaModels}], slots: [${metaSlots}] };`);
    lines.push('');
  }

  // Constructor — reactive state only (no DOM manipulation per Custom Elements spec)
  lines.push('  constructor() {');
  lines.push('    super();');

  // Scoped slot storage initialization
  if (scopedSlotNames.length > 0) {
    lines.push('    this.__slotRenderers = {};');
    lines.push('    this.__slotProps = {};');
  }

  // Prop signal initialization (BEFORE user signals)
  for (const p of propDefs) {
    lines.push(`    this._s_${p.name} = __signal(${p.default});`);
  }

  // Signal initialization
  for (const s of signals) {
    if (s === signals[0]) comment('Signals');
    lines.push(`    this._${s.name} = __signal(${s.value});`);
  }

  // Model signal initialization
  for (const md of modelDefs) {
    lines.push(`    this._m_${md.name} = __signal(${md.default});`);
  }

  // Constant initialization
  for (const c of constantVars) {
    lines.push(`    this._const_${c.name} = ${c.value};`);
  }

  // Computed initialization
  for (const c of computeds) {
    if (c === computeds[0]) comment('Computed');
    const body = transformExpr(c.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
    lines.push(`    this._c_${c.name} = __computed(() => ${body});`);
  }

  // Watcher prev-value initialization
  for (let idx = 0; idx < watchers.length; idx++) {
    const w = watchers[idx];
    if (w.kind === 'signal') {
      // For signal watchers watching a prop, initialize with the prop's default value
      // so that attributeChangedCallback changes before connectedCallback are detected
      if (propNames.has(w.target)) {
        const propDef = propDefs.find(p => p.name === w.target);
        lines.push(`    this.__prev_${w.target} = ${propDef ? propDef.default : 'undefined'};`);
      } else {
        lines.push(`    this.__prev_${w.target} = undefined;`);
      }
    } else {
      // For getter watchers, check if the getter references a prop (e.g., props.value)
      // Initialize with the prop's default so pre-connection attribute changes are detected
      const propMatch = propsObjectName ? w.target.match(new RegExp(`^${propsObjectName}\\.(\\w+)$`)) : null;
      if (propMatch && propNames.has(propMatch[1])) {
        const propDef = propDefs.find(p => p.name === propMatch[1]);
        lines.push(`    this.__prev_watch${idx} = ${propDef ? propDef.default : 'undefined'};`);
      } else {
        lines.push(`    this.__prev_watch${idx} = undefined;`);
      }
    }
  }

  lines.push('  }');
  lines.push('');

  // connectedCallback (idempotent — safe for re-mount)
  lines.push('  connectedCallback() {');
  lines.push('    if (this.__connected) return;');
  lines.push('    this.__connected = true;');

  // ── DOM SETUP (moved from constructor for Custom Elements spec compliance) ──

  // Slot resolution: read childNodes BEFORE clearing innerHTML (when slots are present)
  if (slots.length > 0) {
    lines.push('    const __slotMap = {};');
    lines.push('    const __defaultSlotNodes = [];');
    lines.push('    const __templatesToRemove = [];');
    lines.push('    for (const child of Array.from(this.childNodes)) {');
    lines.push("      if (child.nodeName === 'TEMPLATE') {");
    lines.push('        let handled = false;');
    lines.push('        for (const attr of child.attributes) {');
    lines.push("          if (attr.name.startsWith('#')) {");
    lines.push('            const slotName = attr.name.slice(1);');
    lines.push('            __slotMap[slotName] = { content: child.innerHTML, propsExpr: attr.value };');
    lines.push('            handled = true;');
    lines.push('          } else if (attr.name === "slot") {');
    // NEW: <template slot="name"> syntax (Vue standard)
    lines.push('            const slotName = attr.value;');
    lines.push("            const propsExpr = child.getAttribute('slot-props') || '';");
    lines.push("            child.removeAttribute('slot-props');");
    lines.push('            __slotMap[slotName] = { content: child.innerHTML, propsExpr };');
    lines.push('            handled = true;');
    lines.push('          }');
    lines.push('        }');
    lines.push('        if (handled) __templatesToRemove.push(child);');
    lines.push("      } else if (child.nodeType === 1 && child.getAttribute('slot')) {");
    // NEW: regular element with slot="name" (cross-framework support)
    lines.push("        const slotName = child.getAttribute('slot');");
    lines.push("        const propsExpr = child.getAttribute('slot-props') || '';");
    lines.push("        child.removeAttribute('slot');");
    lines.push("        child.removeAttribute('slot-props');");
    lines.push("        __slotMap[slotName] = { content: propsExpr ? child.innerHTML : child.outerHTML, propsExpr };");
    lines.push("      } else if (child.nodeType === 1) {");
    lines.push("        __defaultSlotNodes.push(child);");
    lines.push("      } else if (child.nodeType === 3 && child.textContent.trim()) {");
    lines.push('        __defaultSlotNodes.push(child);');
    lines.push('      }');
    lines.push('    }');
    // Remove processed template elements to prevent them from appearing in default slot
    lines.push('    for (const tpl of __templatesToRemove) {');
    lines.push('      if (tpl.parentNode) tpl.parentNode.removeChild(tpl);');
    lines.push('    }');
  }

  // Clone template
  lines.push(`    const __root = __t_${className}.content.cloneNode(true);`);

  // Assign DOM refs for bindings
  for (const b of bindings) {
    lines.push(`    this.${b.varName} = ${pathExpr(b.path, '__root')};`);
  }

  // Assign DOM refs for events
  for (const e of events) {
    lines.push(`    this.${e.varName} = ${pathExpr(e.path, '__root')};`);
  }

  // Assign DOM refs for show bindings
  for (const sb of showBindings) {
    lines.push(`    this.${sb.varName} = ${pathExpr(sb.path, '__root')};`);
  }

  // Assign DOM refs for model bindings
  for (const mb of modelBindings) {
    lines.push(`    this.${mb.varName} = ${pathExpr(mb.path, '__root')};`);
  }

  // Assign DOM refs for model:propName bindings
  for (const mpb of modelPropBindings) {
    lines.push(`    this.${mpb.varName} = ${pathExpr(mpb.path, '__root')};`);
  }

  // Assign DOM refs for slot placeholders
  for (const s of slots) {
    lines.push(`    this.${s.varName} = ${pathExpr(s.path, '__root')};`);
  }

  // Assign DOM refs for child component instances (only if they have prop bindings)
  for (const cc of childComponents) {
    if (cc.propBindings.length > 0) {
      lines.push(`    this.${cc.varName} = ${pathExpr(cc.path, '__root')};`);
    }
  }

  // Assign DOM refs for attr bindings (reuse ref when same path)
  const attrPathMap = new Map();
  for (const ab of attrBindings) {
    const pathKey = ab.path.join('.');
    if (attrPathMap.has(pathKey)) {
      lines.push(`    this.${ab.varName} = this.${attrPathMap.get(pathKey)};`);
    } else {
      lines.push(`    this.${ab.varName} = ${pathExpr(ab.path, '__root')};`);
      attrPathMap.set(pathKey, ab.varName);
    }
  }

  // ── if: template creation, anchor reference, state init ──
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    // Template per branch
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      lines.push(`    this.${vn}_t${i} = document.createElement('template');`);
      lines.push(`    this.${vn}_t${i}.innerHTML = \`${branch.templateHtml}\`;`);
    }
    // Reference to anchor comment node (must be before appendChild moves nodes out of __root)
    lines.push(`    this.${vn}_anchor = ${pathExpr(ifBlock.anchorPath, '__root')};`);
    // Active branch state
    lines.push(`    this.${vn}_current = null;`);
    lines.push(`    this.${vn}_active = undefined;`);
  }

  // ── each: template creation, anchor reference, nodes array ──
  for (const forBlock of forBlocks) {
    const vn = forBlock.varName;
    lines.push(`    this.${vn}_tpl = document.createElement('template');`);
    lines.push(`    this.${vn}_tpl.innerHTML = \`${forBlock.templateHtml}\`;`);
    lines.push(`    this.${vn}_anchor = ${pathExpr(forBlock.anchorPath, '__root')};`);
    lines.push(`    this.${vn}_nodes = [];`);
  }

  // ── dynamic component: anchor reference, state init ──
  for (const dyn of dynamicComponents) {
    const vn = dyn.varName;
    lines.push(`    this.${vn}_anchor = ${pathExpr(dyn.anchorPath, '__root')};`);
    lines.push(`    this.${vn}_current = null;`);
    lines.push(`    this.${vn}_tag = null;`);
    lines.push(`    this.${vn}_propDisposers = [];`);
  }

  // ── Ref DOM reference assignments (before appendChild moves nodes) ──
  for (const rb of refBindings) {
    lines.push(`    this._ref_${rb.refName} = ${pathExpr(rb.path, '__root')};`);
  }

  // Append DOM (always light DOM)
  lines.push("    this.innerHTML = '';");
  lines.push('    this.appendChild(__root);');

  // Static slot injection (after DOM is appended)
  for (const s of slots) {
    if (s.name && s.slotProps.length > 0) {
      // Scoped slot: store consumer template or fallback for reactive effect in connectedCallback
      lines.push(`    if (__slotMap['${s.name}']) { this.__slotTpl_${s.name} = __slotMap['${s.name}'].content; }`);
      if (s.defaultContent) {
        lines.push(`    else { this.__slotTpl_${s.name} = \`${s.defaultContent}\`; }`);
      }
    } else if (s.name) {
      // Named slot: inject content directly
      lines.push(`    if (__slotMap['${s.name}']) { this.${s.varName}.innerHTML = __slotMap['${s.name}'].content; }`);
    } else {
      // Default slot: inject collected child nodes
      lines.push(`    if (__defaultSlotNodes.length) { this.${s.varName}.textContent = ''; __defaultSlotNodes.forEach(n => this.${s.varName}.appendChild(n.cloneNode(true))); }`);
    }
  }

  // ── Deferred slot re-check (Angular compatibility) ──
  // Angular connects custom elements to DOM BEFORE projecting children.
  // If no slot content was found on first pass, schedule a microtask retry.
  // We save a reference to the rendered root node so the microtask can filter it out
  // and only process children that were projected by the framework after connectedCallback.
  if (slots.length > 0) {
    lines.push('    if (Object.keys(__slotMap).length === 0 && __defaultSlotNodes.length === 0) {');
    lines.push('      const __renderedRoot = this.firstElementChild;');
    lines.push('      queueMicrotask(() => {');
    lines.push('        const __sm = {};');
    lines.push('        const __dn = [];');
    lines.push('        for (const child of Array.from(this.childNodes)) {');
    // Skip the rendered template root and any whitespace text nodes that were there before
    lines.push('          if (child === __renderedRoot) continue;');
    lines.push('          if (child.nodeType === 3 && !child.textContent.trim()) continue;');
    lines.push("          if (child.nodeName === 'TEMPLATE') {");
    lines.push('            for (const attr of child.attributes) {');
    lines.push("              if (attr.name.startsWith('#')) {");
    lines.push("                __sm[attr.name.slice(1)] = { content: child.innerHTML, propsExpr: attr.value };");
    lines.push('              }');
    lines.push('            }');
    lines.push("          } else if (child.nodeType === 1 && child.getAttribute('slot')) {");
    lines.push("            const sn = child.getAttribute('slot');");
    lines.push("            const pe = child.getAttribute('slot-props') || '';");
    lines.push("            child.removeAttribute('slot');");
    lines.push("            child.removeAttribute('slot-props');");
    lines.push("            __sm[sn] = { content: pe ? child.innerHTML : child.outerHTML, propsExpr: pe };");
    lines.push("            child.remove();");
    lines.push("          } else if (child.nodeType === 1) {");
    lines.push("            __dn.push(child);");
    lines.push("          } else if (child.nodeType === 3 && child.textContent.trim()) {",);
    lines.push("            __dn.push(child);");
    lines.push('          }');
    lines.push('        }');
    // Re-inject slots if we found content this time
    lines.push('        if (Object.keys(__sm).length > 0 || __dn.length > 0) {');
    for (const s of slots) {
      if (s.name && s.slotProps.length > 0) {
        lines.push(`          if (__sm['${s.name}']) {`);
        lines.push(`            this.__slotTpl_${s.name} = __sm['${s.name}'].content;`);
        if (s.slotProps.length > 0 && s.slotProps[0].source) {
          lines.push(`            this._${s.slotProps[0].source}.set(this._${s.slotProps[0].source}());`);
        }
        lines.push(`          }`);
      } else if (s.name) {
        lines.push(`          if (__sm['${s.name}']) { this.${s.varName}.innerHTML = __sm['${s.name}'].content; }`);
      } else {
        lines.push(`          if (__dn.length) { this.${s.varName}.textContent = ''; __dn.forEach(n => this.${s.varName}.appendChild(n.cloneNode(true))); }`);
      }
    }
    lines.push('        }');
    lines.push('      });');
    lines.push('    }');
  }

  // ── EFFECTS AND LISTENERS ──
  lines.push('    this.__ac = new AbortController();');
  lines.push('    this.__disposers = [];');
  lines.push('');

  // Binding effects — one __effect per binding
  if (bindings.length > 0) comment('Text bindings');
  for (const b of bindings) {
    if (b.type === 'prop') {
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${b.varName}.textContent = this._s_${b.name}() ?? '';`);
      lines.push('    }));');
    } else if (b.type === 'signal') {
      // Check if this is a model var (needs _m_ prefix instead of _)
      const modelPropName = modelVarMap.get(b.name);
      const signalRef = modelPropName ? `this._m_${modelPropName}()` : `this._${b.name}()`;
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${b.varName}.textContent = ${signalRef} ?? '';`);
      lines.push('    }));');
    } else if (b.type === 'computed') {
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${b.varName}.textContent = this._c_${b.name}() ?? '';`);
      lines.push('    }));');
    } else {
      // method/expression type — check if it's a props.x access or a complex expression
      let ref;
      if (propsObjectName && b.name.startsWith(propsObjectName + '.')) {
        const propName = b.name.slice(propsObjectName.length + 1);
        ref = `this._s_${propName}()`;
      } else {
        // For method calls, ensure we have parentheses before transforming
        // b.name might be 'getCount' (from {{getCount()}} where baseName stripped the ())
        // We need to add () back so transformExpr can match and transform it
        const exprWithParens = b.name.includes('(') ? b.name : `${b.name}()`;
        // Use transformExpr for complex expressions (e.g. items().length, ternary)
        ref = transformExpr(exprWithParens, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
      }
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${b.varName}.textContent = ${wrapTernaryExpr(ref)} ?? '';`);
      lines.push('    }));');
    }
  }

  // Scoped slot effects — reactive resolution of {{propName}} in consumer templates
  for (const s of slots) {
    if (s.name && s.slotProps.length > 0) {
      const propsObj = s.slotProps.map(sp => {
        const ref = slotPropRef(sp.source, signalNames, computedNames, propNames);
        return `${sp.prop}: ${ref}`;
      }).join(', ');
      // Scoped slot effect: always compute props and notify renderers
      // The effect runs regardless of whether a template was provided (Angular uses registerSlotRenderer)
      lines.push('      __effect(() => {');
      lines.push(`        const __props = { ${propsObj} };`);
      // Store current props for late-registering renderers
      lines.push(`        this.__slotProps['${s.name}'] = __props;`);
      // Emit wcc:slot-update event
      lines.push(`        this.dispatchEvent(new CustomEvent('wcc:slot-update', { detail: { slot: '${s.name}', props: __props }, bubbles: false }));`);
      // Check for registered renderer (Angular directive)
      lines.push(`        if (this.__slotRenderers && this.__slotRenderers['${s.name}']) {`);
      lines.push(`          this.__slotRenderers['${s.name}'](__props);`);
      lines.push(`        } else if (this.__slotTpl_${s.name}) {`);
      // Fallback: template-based token replacement (WCC-to-WCC, Vue, React)
      lines.push(`          let __html = this.__slotTpl_${s.name};`);
      lines.push("          for (const [k, v] of Object.entries(__props)) {");
      lines.push(`            __html = __html.replace(new RegExp('(?:\\\\{\\\\{|\\\\{%)\\\\s*' + k + '(\\\\(\\\\))?\\\\s*(?:\\\\}\\\\}|%\\\\})', 'g'), v ?? '');`);
      lines.push('          }');
      lines.push(`          this.${s.varName}.innerHTML = __html;`);
      lines.push('        }');
      lines.push('      });');
    }
  }

  // Child component reactive prop bindings
  for (const cc of childComponents) {
    for (const pb of cc.propBindings) {
      let ref;
      if (pb.type === 'prop') {
        ref = `this._s_${pb.expr}()`;
      } else if (pb.type === 'computed') {
        ref = `this._c_${pb.expr}()`;
      } else if (pb.type === 'signal') {
        const modelPropName = modelVarMap.get(pb.expr);
        ref = modelPropName ? `this._m_${modelPropName}()` : `this._${pb.expr}()`;
      } else if (pb.type === 'constant') {
        ref = `this._const_${pb.expr}`;
      } else {
        ref = `this._${pb.expr}()`;
      }
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${cc.varName}.setAttribute('${pb.attr}', ${ref} ?? '');`);
      lines.push('    }));');
    }
  }

  // User effects
  for (const eff of effects) {
    const body = transformMethodBody(eff.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
    lines.push('    this.__disposers.push(__effect(() => {');
    // Indent each line of the body
    const bodyLines = body.split('\n');
    for (const line of bodyLines) {
      lines.push(`      ${line}`);
    }
    lines.push('    }));');
  }

  // Watcher effects
  for (let idx = 0; idx < watchers.length; idx++) {
    const w = watchers[idx];
    const body = transformMethodBody(w.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);

    if (w.kind === 'signal') {
      // Determine the signal reference for the watch target
      let watchRef;
      if (propNames.has(w.target)) {
        watchRef = `this._s_${w.target}()`;
      } else if (computedNames.includes(w.target)) {
        watchRef = `this._c_${w.target}()`;
      } else {
        watchRef = `this._${w.target}()`;
      }
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      const ${w.newParam} = ${watchRef};`);
      lines.push(`      if (this.__prev_${w.target} !== undefined && this.__prev_${w.target} !== ${w.newParam}) {`);
      if (w.oldParam) {
        lines.push(`        const ${w.oldParam} = this.__prev_${w.target};`);
      }
      lines.push('        __untrack(() => {');
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        lines.push(`          ${line}`);
      }
      lines.push('        });');
      lines.push('      }');
      lines.push(`      this.__prev_${w.target} = ${w.newParam};`);
      lines.push('    }));');
    } else {
      // kind === 'getter' — transform the getter expression and use it directly
      const getterExpr = transformMethodBody(w.target, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
      const prevName = `__prev_watch${idx}`;
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      const ${w.newParam} = ${getterExpr};`);
      lines.push(`      if (this.${prevName} !== undefined && this.${prevName} !== ${w.newParam}) {`);
      if (w.oldParam) {
        lines.push(`        const ${w.oldParam} = this.${prevName};`);
      }
      lines.push('        __untrack(() => {');
      const bodyLines2 = body.split('\n');
      for (const line of bodyLines2) {
        lines.push(`          ${line}`);
      }
      lines.push('        });');
      lines.push('      }');
      lines.push(`      this.${prevName} = ${w.newParam};`);
      lines.push('    }));');
    }
  }

  // Event listeners (with AbortController signal for cleanup)
  if (events.length > 0) comment('Event listeners');
  for (const e of events) {
    const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
    lines.push(`    if (this.${e.varName}) this.${e.varName}.addEventListener('${e.event}', ${handlerExpr}, { signal: this.__ac.signal });`);
  }

  // Show effects — one __effect per ShowBinding
  if (showBindings.length > 0) comment('Show directives');
  for (const sb of showBindings) {
    const expr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
    lines.push('    this.__disposers.push(__effect(() => {');
    lines.push(`      this.${sb.varName}.style.display = (${expr}) ? '' : 'none';`);
    lines.push('    }));');
  }

  // Model effects — signal → DOM (one __effect per ModelBinding)
  if (modelBindings.length > 0) comment('Model bindings (signal → DOM)');
  for (const mb of modelBindings) {
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      // Radio: compare signal value to radioValue
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${mb.varName}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
      lines.push('    }));');
    } else if (mb.prop === 'checked') {
      // Checkbox: coerce to boolean
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${mb.varName}.checked = !!this._${mb.signal}();`);
      lines.push('    }));');
    } else {
      // Value-based (text, number, textarea, select): nullish coalesce to ''
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${mb.varName}.value = this._${mb.signal}() ?? '';`);
      lines.push('    }));');
    }
  }

  // Model event listeners — DOM → signal (with AbortController signal)
  for (const mb of modelBindings) {
    if (mb.prop === 'checked' && mb.radioValue === null) {
      // Checkbox: read e.target.checked
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); }, { signal: this.__ac.signal });`);
    } else if (mb.coerce) {
      // Number input: wrap in Number()
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); }, { signal: this.__ac.signal });`);
    } else {
      // All others: read e.target.value
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); }, { signal: this.__ac.signal });`);
    }
  }

  // model:propName effects and listeners — bidirectional WCC-to-WCC binding
  for (const mpb of modelPropBindings) {
    // Determine the signal read/write expressions
    // If the signal is a model var, use this._m_propName(); otherwise use this._signalName()
    const isModelVar = modelVarMap.has(mpb.signal);
    const readExpr = isModelVar
      ? `this._m_${modelVarMap.get(mpb.signal)}()`
      : `this._${mpb.signal}()`;
    const writeExpr = isModelVar
      ? `this._m_${modelVarMap.get(mpb.signal)}`
      : `this._${mpb.signal}`;

    // Reactive parent → child sync: set child's attribute from parent signal
    const attrName = camelToKebab(mpb.propName);
    lines.push('    this.__disposers.push(__effect(() => {');
    lines.push(`      this.${mpb.varName}.setAttribute('${attrName}', ${readExpr} ?? '');`);
    lines.push('    }));');

    // Child → parent sync: listen for wcc:model on child, update parent signal
    lines.push(`    this.${mpb.varName}.addEventListener('wcc:model', (e) => {`);
    lines.push(`      if (e.detail.prop === '${mpb.propName}') {`);
    lines.push(`        ${writeExpr}(e.detail.value);`);
    lines.push('      }');
    lines.push('    }, { signal: this.__ac.signal });');
  }

  // Attr binding effects — one __effect per AttrBinding
  for (const ab of attrBindings) {
    const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
    if (ab.kind === 'attr') {
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      const __v = ${expr};`);
      lines.push(`      if (__v || __v === '') { this.${ab.varName}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`      else { this.${ab.varName}.removeAttribute('${ab.attr}'); }`);
      lines.push('    }));');
    } else if (ab.kind === 'bool') {
      lines.push('    this.__disposers.push(__effect(() => {');
      lines.push(`      this.${ab.varName}.${ab.attr} = !!(${expr});`);
      lines.push('    }));');
    } else if (ab.kind === 'class') {
      if (ab.expression.trimStart().startsWith('{')) {
        // Object expression: iterate entries, classList.add/remove
        lines.push('    this.__disposers.push(__effect(() => {');
        lines.push(`      const __obj = ${expr};`);
        lines.push('      for (const [__k, __val] of Object.entries(__obj)) {');
        lines.push(`        __val ? this.${ab.varName}.classList.add(__k) : this.${ab.varName}.classList.remove(__k);`);
        lines.push('      }');
        lines.push('    }));');
      } else if (ab.expression.trimStart().startsWith('[')) {
        // Array expression: join with spaces
        lines.push('    this.__disposers.push(__effect(() => {');
        lines.push(`      this.${ab.varName}.className = (${expr}).join(' ');`);
        lines.push('    }));');
      } else {
        // String expression: set className
        // Wrap ternary/logical expressions to prevent precedence issues
        lines.push('    this.__disposers.push(__effect(() => {');
        lines.push(`      this.${ab.varName}.className = ${wrapTernaryExpr(expr)};`);
        lines.push('    }));');
      }
    } else if (ab.kind === 'style') {
      if (ab.expression.trimStart().startsWith('{')) {
        // Object expression: iterate entries, set style[key]
        lines.push('    this.__disposers.push(__effect(() => {');
        lines.push(`      const __obj = ${expr};`);
        lines.push('      for (const [__k, __val] of Object.entries(__obj)) {');
        lines.push(`        this.${ab.varName}.style[__k] = __val;`);
        lines.push('      }');
        lines.push('    }));');
      } else {
        // String expression: set cssText
        lines.push('    this.__disposers.push(__effect(() => {');
        lines.push(`      this.${ab.varName}.style.cssText = ${expr};`);
        lines.push('    }));');
      }
    }
  }

  // ── if effects ──
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    lines.push('    this.__disposers.push(__effect(() => {');
    lines.push('      let __branch = null;');
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      if (branch.type === 'if') {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`      if (${expr}) { __branch = ${i}; }`);
      } else if (branch.type === 'else-if') {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`      else if (${expr}) { __branch = ${i}; }`);
      } else {
        // else
        lines.push(`      else { __branch = ${i}; }`);
      }
    }
    lines.push(`      if (__branch === this.${vn}_active) return;`);
    // Remove previous branch
    lines.push(`      if (this.${vn}_current) { this.${vn}_current.remove(); this.${vn}_current = null; }`);
    // Insert new branch
    lines.push('      if (__branch !== null) {');
    const tplArray = ifBlock.branches.map((_, i) => `this.${vn}_t${i}`).join(', ');
    lines.push(`        const tpl = [${tplArray}][__branch];`);
    lines.push('        const clone = tpl.content.cloneNode(true);');
    lines.push('        const node = clone.firstChild;');
    lines.push(`        this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
    lines.push('        customElements.upgrade(node);');
    lines.push(`        this.${vn}_current = node;`);
    // Setup bindings/events for active branch (only if any branch has bindings/events)
    const hasSetup = ifBlock.branches.some(b =>
      (b.bindings && b.bindings.length > 0) ||
      (b.events && b.events.length > 0) ||
      (b.showBindings && b.showBindings.length > 0) ||
      (b.attrBindings && b.attrBindings.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0)
    );
    if (hasSetup) {
      lines.push(`        this.${vn}_setup(node, __branch);`);
    }
    lines.push('      }');
    lines.push(`      this.${vn}_active = __branch;`);
    lines.push('    }));');
  }

  // ── each effects ──
  for (const forBlock of forBlocks) {
    const vn = forBlock.varName;
    const { itemVar, indexVar, source, keyExpr } = forBlock;

    const signalNamesSet = new Set(signalNames);
    const computedNamesSet = new Set(computedNames);

    // Transform the source expression
    const sourceExpr = transformForExpr(source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);

    lines.push('    this.__disposers.push(__effect(() => {');
    lines.push(`      const __source = ${sourceExpr};`);
    lines.push('');
    lines.push("      const __iter = typeof __source === 'number'");
    lines.push('        ? Array.from({ length: __source }, (_, i) => i + 1)');
    lines.push('        : (__source || []);');
    lines.push('');

    if (keyExpr) {
      // ── Keyed reconciliation ──
      lines.push(`      const __oldMap = this.${vn}_keyMap || new Map();`);
      lines.push('      const __newMap = new Map();');
      lines.push('      const __newNodes = [];');
      lines.push('');
      lines.push(`      __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`        const __key = ${keyExpr};`);
      lines.push('        if (__oldMap.has(__key)) {');
      lines.push('          const oldNode = __oldMap.get(__key);');
      
      // BUG-0012 FIX: When reusing nodes, we must recreate them to get fresh effects
      // Old effects capture stale item references and fail on subsequent updates
      // Strategy: Remove old node, create fresh clone with new effects
      lines.push('          oldNode.remove();');
      lines.push(`          const node = this.${vn}_tpl.content.cloneNode(true).firstChild;`);
      
      // Setup bindings/events for the recreated node (uses 'node' variable)
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      
      lines.push('          __newMap.set(__key, node);');
      lines.push('          __newNodes.push(node);');
      lines.push('          __oldMap.delete(__key);');
      lines.push('        } else {');
      lines.push(`          const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push('          const node = clone.firstChild;');

      // Setup bindings/events/show/attr/model/slots for NEW nodes only
      // (reused nodes keep their existing bindings)
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);

      lines.push('          __newMap.set(__key, node);');
      lines.push('          __newNodes.push(node);');
      lines.push('        }');
      lines.push('      });');
      lines.push('');
      lines.push('      // Remove nodes no longer in the list');
      lines.push('      for (const n of __oldMap.values()) n.remove();');
      lines.push('');
      lines.push('      // Reorder: insert all nodes in correct order before anchor');
      lines.push(`      for (const n of __newNodes) { this.${vn}_anchor.parentNode.insertBefore(n, this.${vn}_anchor); customElements.upgrade(n); }`);
      lines.push('');
      lines.push(`      this.${vn}_nodes = __newNodes;`);
      lines.push(`      this.${vn}_keyMap = __newMap;`);
      lines.push('    }));');
    } else {
      // ── Non-keyed: destroy all and recreate (original behavior) ──
      lines.push(`      for (const n of this.${vn}_nodes) n.remove();`);
      lines.push(`      this.${vn}_nodes = [];`);
      lines.push('');
      lines.push(`      __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`        const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push('        const node = clone.firstChild;');

      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);

      lines.push(`        this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
      lines.push('        customElements.upgrade(node);');
      lines.push(`        this.${vn}_nodes.push(node);`);
      lines.push('      });');
      lines.push('    }));');
    }
  }

  // ── dynamic component effects ──
  for (const dyn of dynamicComponents) {
    const vn = dyn.varName;
    const isExpr = transformExpr(dyn.isExpression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
    lines.push('    this.__disposers.push(__effect(() => {');
    lines.push(`      const __tag = ${isExpr};`);
    lines.push(`      if (__tag === this.${vn}_tag) return;`);
    lines.push(`      if (this.${vn}_current) {`);
    lines.push(`        this.${vn}_propDisposers.forEach(d => d());`);
    lines.push(`        this.${vn}_propDisposers = [];`);
    lines.push(`        this.${vn}_current.remove();`);
    lines.push(`        this.${vn}_current = null;`);
    lines.push('      }');
    lines.push('      if (__tag) {');
    lines.push('        const el = document.createElement(__tag);');
    // Emit nested prop effects
    for (const prop of dyn.props) {
      const propExprTransformed = transformExpr(prop.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
      lines.push(`        this.${vn}_propDisposers.push(__effect(() => {`);
      lines.push(`          el.setAttribute('${prop.attr}', ${propExprTransformed});`);
      lines.push('        }));');
    }
    // Emit event listeners
    for (const evt of dyn.events) {
      const handlerExpr = generateEventHandler(evt.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
      lines.push(`        el.addEventListener('${evt.event}', ${handlerExpr});`);
    }
    lines.push(`        this.${vn}_anchor.parentNode.insertBefore(el, this.${vn}_anchor);`);
    lines.push('        customElements.upgrade(el);');
    lines.push(`        this.${vn}_current = el;`);
    lines.push('      }');
    lines.push(`      this.${vn}_tag = __tag;`);
    lines.push('    }));');
  }

  // Lifecycle: onMount hooks (at the very end of connectedCallback)
  for (const hook of onMountHooks) {
    const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
    if (hook.async) {
      lines.push('    ;(async () => {');
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        lines.push(`      ${line}`);
      }
      lines.push('    })();');
    } else {
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        const trimmed = line.trimEnd();
        const needsSemi = trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}');
        lines.push(`    ${trimmed}${needsSemi ? ';' : ''}`);
      }
    }
  }

  // Close connectedCallback
  lines.push('  }');
  lines.push('');

  // disconnectedCallback (cleanup: abort listeners + dispose effects + user hooks)
  lines.push('  disconnectedCallback() {');
  lines.push('    this.__connected = false;');
  lines.push('    this.__ac.abort();');
  lines.push('    this.__disposers.forEach(d => d());');
  if (onDestroyHooks.length > 0) {
    for (const hook of onDestroyHooks) {
      const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
      if (hook.async) {
        lines.push('    ;(async () => {');
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          lines.push(`      ${line}`);
        }
        lines.push('    })();');
      } else {
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          const trimmed = line.trimEnd();
          const needsSemi = trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}');
          lines.push(`    ${trimmed}${needsSemi ? ';' : ''}`);
        }
      }
    }
  }
  lines.push('  }');
  lines.push('');

  // adoptedCallback (if onAdopt hooks exist)
  if (onAdoptHooks.length > 0) {
    lines.push('  adoptedCallback() {');
    for (const hook of onAdoptHooks) {
      const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
      if (hook.async) {
        lines.push('    ;(async () => {');
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          lines.push(`      ${line}`);
        }
        lines.push('    })();');
      } else {
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          const trimmed = line.trimEnd();
          const needsSemi = trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}');
          lines.push(`    ${trimmed}${needsSemi ? ';' : ''}`);
        }
      }
    }
    lines.push('  }');
    lines.push('');
  }

  // attributeChangedCallback (if props or model props exist)
  if (propDefs.length > 0 || modelDefs.length > 0) {
    lines.push('  attributeChangedCallback(name, oldVal, newVal) {');
    for (const p of propDefs) {
      const defaultVal = p.default;
      let updateExpr;

      if (defaultVal === 'true' || defaultVal === 'false') {
        // Boolean coercion: attribute presence = true
        updateExpr = `this._s_${p.name}(newVal != null)`;
      } else if (/^-?\d+(\.\d+)?$/.test(defaultVal)) {
        // Number coercion
        updateExpr = `this._s_${p.name}(newVal != null ? Number(newVal) : ${defaultVal})`;
      } else if (defaultVal === 'undefined') {
        // Undefined default — pass through
        updateExpr = `this._s_${p.name}(newVal)`;
      } else {
        // String default — use nullish coalescing
        updateExpr = `this._s_${p.name}(newVal ?? ${defaultVal})`;
      }

      lines.push(`    if (name === '${p.attrName}') ${updateExpr};`);
    }

    // Model props — update signal directly (NO event emission)
    for (let i = 0; i < modelDefs.length; i++) {
      const md = modelDefs[i];
      const attrName = modelAttrNames[i];
      const camelName = md.name;
      const defaultVal = md.default;
      let updateExpr;

      if (defaultVal === 'true' || defaultVal === 'false') {
        // Boolean coercion: attribute presence = true
        updateExpr = `this._m_${md.name}(newVal != null)`;
      } else if (/^-?\d+(\.\d+)?$/.test(defaultVal)) {
        // Number coercion
        updateExpr = `this._m_${md.name}(newVal != null ? Number(newVal) : ${defaultVal})`;
      } else if (defaultVal === 'undefined') {
        // Undefined default — pass through
        updateExpr = `this._m_${md.name}(newVal)`;
      } else {
        // String default — use nullish coalescing
        updateExpr = `this._m_${md.name}(newVal ?? ${defaultVal})`;
      }

      // Handle both kebab-case (native HTML) and camelCase (Vue) attribute names
      if (attrName !== camelName) {
        lines.push(`    if (name === '${attrName}' || name === '${camelName}') ${updateExpr};`);
      } else {
        lines.push(`    if (name === '${attrName}') ${updateExpr};`);
      }
    }

    lines.push('  }');
    lines.push('');

    // Public getters and setters
    for (const p of propDefs) {
      lines.push(`  get ${p.name}() { return this._s_${p.name}(); }`);
      lines.push(`  set ${p.name}(val) { this._s_${p.name}(val); this.setAttribute('${p.attrName}', String(val)); }`);
      lines.push('');
    }

    // Public getters and setters for model props
    for (let i = 0; i < modelDefs.length; i++) {
      const md = modelDefs[i];
      const attrName = modelAttrNames[i];
      lines.push(`  get ${md.name}() { return this._m_${md.name}(); }`);
      lines.push(`  set ${md.name}(val) { this._m_${md.name}(val); this.setAttribute('${attrName}', String(val)); }`);
      lines.push('');
    }
  }

  // _emit method (if emits declared)
  // Emits the original event name + lowercase-no-hyphens for React 19 compatibility.
  // React 19 maps `oncountchanged` → addEventListener('countchanged').
  if (emits.length > 0) {
    lines.push('  _emit(name, detail) {');
    lines.push('    const evt = { detail, bubbles: true, composed: true };');
    lines.push('    this.dispatchEvent(new CustomEvent(name, evt));');
    lines.push("    const lower = name.replace(/-/g, '').toLowerCase();");
    lines.push('    if (lower !== name) this.dispatchEvent(new CustomEvent(lower, evt));');
    lines.push('  }');
    lines.push('');
  }

  // _modelSet methods (one per defineModel prop — emits events on internal write)
  // Emits:
  //   1. wcc:model — canonical event for vanilla JS, WCC-to-WCC, React adapter, Vue plugin
  //   2. propName-changed — kebab-case for Web Components standard and parent listeners
  for (const md of modelDefs) {
    // Convert camelCase to kebab-case for event name (e.g., userName → user-name-changed)
    const eventName = md.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '-changed';
    lines.push(`  _modelSet_${md.name}(newVal) {`);
    lines.push(`    const oldVal = this._m_${md.name}();`);
    lines.push(`    this._m_${md.name}(newVal);`);
    lines.push(`    this.dispatchEvent(new CustomEvent('wcc:model', {`);
    lines.push(`      detail: { prop: '${md.name}', value: newVal, oldValue: oldVal },`);
    lines.push(`      bubbles: true,`);
    lines.push(`      composed: true`);
    lines.push(`    }));`);
    lines.push(`    this.dispatchEvent(new CustomEvent('${eventName}', { detail: newVal, bubbles: true }));`);
    lines.push('  }');
    lines.push('');
  }

  // Wrapper methods for defineModel signals (dual getter/setter)
  // These act as the interface between template code and internal signals
  // - As getter (no args): returns signal value
  // - As setter (with arg): calls _modelSet_* to update and dispatch events
  if (modelDefs.length > 0) {
    lines.push('  // --- Model wrapper methods ---');
    for (const md of modelDefs) {
      lines.push(`  _${md.name}(val) {`);
      lines.push(`    if (arguments.length === 0) {`);
      lines.push(`      return this._m_${md.name}();`);
      lines.push(`    } else {`);
      lines.push(`      this._modelSet_${md.name}(val);`);
      lines.push(`    }`);
      lines.push(`  }`);
      lines.push('');
    }
  }

  // __scopedSlots instance getter and registerSlotRenderer (if scoped slots exist)
  if (scopedSlotNames.length > 0) {
    lines.push('  get __scopedSlots() { return this.constructor.__scopedSlots || []; }');
    lines.push('');
    lines.push('  registerSlotRenderer(slotName, callback) {');
    lines.push('    if (!this.__slotRenderers) this.__slotRenderers = {};');
    lines.push('    this.__slotRenderers[slotName] = callback;');
    lines.push('    if (this.__slotProps && this.__slotProps[slotName]) {');
    lines.push('      callback(this.__slotProps[slotName]);');
    lines.push('    }');
    lines.push('    return () => {');
    lines.push('      if (this.__slotRenderers) {');
    lines.push('        delete this.__slotRenderers[slotName];');
    lines.push('      }');
    lines.push('    };');
    lines.push('  }');
    lines.push('');
  }

  // User methods (prefixed with _)
  if (methods.length > 0 && options.comments) lines.push('');
  if (methods.length > 0 && options.comments) lines.push('  // --- Methods ---');
  for (const m of methods) {
    const body = transformMethodBody(m.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
    lines.push(`  _${m.name}(${m.params}) {`);
    const bodyLines = body.split('\n');
    for (const line of bodyLines) {
      lines.push(`    ${line}`);
    }
    lines.push('  }');
    lines.push('');
  }

  // ── Ref getter properties ──
  for (const rd of refs) {
    // Find matching RefBinding
    const rb = refBindings.find(b => b.refName === rd.refName);
    if (rb) {
      lines.push(`  get _${rd.varName}() { return { value: this._ref_${rd.refName} }; }`);
      lines.push('');
    }
  }

  // ── defineExpose: public getters/methods ──
  for (const name of exposeNames) {
    if (computedNames.includes(name)) {
      lines.push(`  get ${name}() { return this._c_${name}(); }`);
    } else if (signalNames.includes(name)) {
      lines.push(`  get ${name}() { return this._${name}(); }`);
    } else if (methodNames.includes(name)) {
      lines.push(`  ${name}(...args) { return this._${name}(...args); }`);
    } else if (constantNames.includes(name)) {
      lines.push(`  get ${name}() { return this._const_${name}; }`);
    }
  }
  if (exposeNames.length > 0) lines.push('');

  // ── if setup methods ──
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    const hasSetup = ifBlock.branches.some(b =>
      (b.bindings && b.bindings.length > 0) ||
      (b.events && b.events.length > 0) ||
      (b.showBindings && b.showBindings.length > 0) ||
      (b.attrBindings && b.attrBindings.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0)
    );
    if (!hasSetup) continue;

    lines.push(`  ${vn}_setup(node, branch) {`);
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      const hasBranchSetup =
        (branch.bindings && branch.bindings.length > 0) ||
        (branch.events && branch.events.length > 0) ||
        (branch.showBindings && branch.showBindings.length > 0) ||
        (branch.attrBindings && branch.attrBindings.length > 0) ||
        (branch.modelBindings && branch.modelBindings.length > 0);
      if (!hasBranchSetup) continue;

      const keyword = i === 0 ? 'if' : 'else if';
      lines.push(`    ${keyword} (branch === ${i}) {`);

      // Bindings: generate DOM refs and effects for text bindings
      for (const b of branch.bindings) {
        lines.push(`      const ${b.varName} = ${pathExpr(b.path, 'node')};`);
        if (b.type === 'prop') {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._s_${b.name}() ?? ''; });`);
        } else if (b.type === 'signal') {
          const modelPropName = modelVarMap.get(b.name);
          const signalRef = modelPropName ? `this._m_${modelPropName}()` : `this._${b.name}()`;
          lines.push(`      __effect(() => { ${b.varName}.textContent = ${signalRef} ?? ''; });`);
        } else if (b.type === 'computed') {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._c_${b.name}() ?? ''; });`);
        } else {
          // method/expression type — check for props.x pattern
          let ref;
          if (propsObjectName && b.name.startsWith(propsObjectName + '.')) {
            const propName = b.name.slice(propsObjectName.length + 1);
            ref = `this._s_${propName}()`;
          } else {
            ref = transformExpr(b.name, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
          }
          lines.push(`      __effect(() => { ${b.varName}.textContent = ${wrapTernaryExpr(ref)} ?? ''; });`);
        }
      }

      // Events: generate addEventListener
      for (const e of branch.events) {
        const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
        lines.push(`      const ${e.varName} = ${pathExpr(e.path, 'node')};`);
        lines.push(`      ${e.varName}.addEventListener('${e.event}', ${handlerExpr});`);
      }

      // Show bindings: generate effects
      for (const sb of branch.showBindings) {
        const expr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`      const ${sb.varName} = ${pathExpr(sb.path, 'node')};`);
        lines.push(`      __effect(() => { ${sb.varName}.style.display = (${expr}) ? '' : 'none'; });`);
      }

      // Attr bindings: generate effects
      for (const ab of branch.attrBindings) {
        const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`      const ${ab.varName} = ${pathExpr(ab.path, 'node')};`);
        lines.push(`      __effect(() => {`);
        lines.push(`        const __val = ${expr};`);
        lines.push(`        if (__val == null || __val === false) { ${ab.varName}.removeAttribute('${ab.attr}'); }`);
        lines.push(`        else { ${ab.varName}.setAttribute('${ab.attr}', __val); }`);
        lines.push(`      });`);
      }

      // Model bindings: generate effects and listeners
      for (const mb of (branch.modelBindings || [])) {
        const nodeRef = pathExpr(mb.path, 'node');
        lines.push(`      const ${mb.varName} = ${nodeRef};`);
        // Effect (signal → DOM)
        lines.push(`      __effect(() => {`);
        if (mb.prop === 'checked' && mb.radioValue !== null) {
          lines.push(`        ${mb.varName}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
        } else if (mb.prop === 'checked') {
          lines.push(`        ${mb.varName}.checked = !!this._${mb.signal}();`);
        } else {
          lines.push(`        ${mb.varName}.value = this._${mb.signal}() ?? '';`);
        }
        lines.push(`      });`);
        // Listener (DOM → signal)
        if (mb.prop === 'checked' && mb.radioValue === null) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
        } else if (mb.coerce) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
        } else {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
        }
      }

      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  }

  lines.push('}');
  lines.push('');

  // ── 5. Custom element registration ──
  lines.push(`if (!customElements.get('${tagName}')) customElements.define('${tagName}', ${className});`);
  lines.push('');

  // ── 6. Default export (enables named imports from parent components) ──
  lines.push(`export default ${className};`);

  return lines.join('\n');
}
