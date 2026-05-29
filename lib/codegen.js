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
  if (propNames.has(source)) return `this._state.${source}`;
  if (computedNames.includes(source)) return `this._state.${source}`;
  if (signalNames.includes(source)) return `this._state.${source}`;
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

  // Transform props.x → this._state.x BEFORE signal/computed transforms
  if (propsObjectName && propNames.size > 0) {
    const propsRe = new RegExp(`\\b${propsObjectName}\\.(\\w+)`, 'g');
    result = result.replace(propsRe, (match, propName) => {
      if (propNames.has(propName)) {
        return `this._state.${propName}`;
      }
      return match; // leave unknown props unchanged
    });
  }

  // Transform bare prop names → this._state.x (for template expressions like :style="{ color: myProp }")
  for (const propName of propNames) {
    if (propsObjectName && propName === propsObjectName) continue;
    if (emitsObjectName && propName === emitsObjectName) continue;
    const bareRe = new RegExp(`(?<!_state\\.)\\b(${propName})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._state.${propName}`);
  }

  // Transform model signal reads: varName() → this._state.{propName} (BEFORE regular signals)
  for (const [varName, propNameVal] of modelVarMap) {
    if (propsObjectName && varName === propsObjectName) continue;
    if (emitsObjectName && varName === emitsObjectName) continue;
    // First: transform varName() calls → this._state.propName
    const callRe = new RegExp(`\\b${varName}\\(\\)`, 'g');
    result = result.replace(callRe, `this._state.${propNameVal}`);
    // Then: transform bare varName references (not followed by ( or .set(), not preceded by _state.)
    const bareRe = new RegExp(`(?<!_state\\.)\\b(${varName})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._state.${propNameVal}`);
  }

  // Transform computed names first (to avoid partial matches with signals)
  // Phase 2: Computed values are stored in _state, not _c_ getter functions
  for (const name of computedNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    // Phase 2: transform name() calls → this._state.name
    const callRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(callRe, `this._state.${name}`);
    // Transform bare name references not already preceded by `.`
    // (prevents double-transform: this._state.foo → this._state.this._state.foo)
    const bareRe = new RegExp(`(?<!\\.)\\b(${name})\\b(?!\\.set\\()(?!\\(|\\s*\\))`, 'g');
    result = result.replace(bareRe, `this._state.${name}`);
  }

  // Transform signal names
  for (const name of signalNames) {
    // Skip propsObjectName and emitsObjectName
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    // First: transform name() calls → this._state.name (replace the call, not just the name)
    const callRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(callRe, `this._state.${name}`);
    // Then: transform bare name references (not followed by ( or .set(), not preceded by _state.)
    const bareRe = new RegExp(`(?<!_state\\.)\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
    result = result.replace(bareRe, `this._state.${name}`);
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

  // 0b. Transform batch() calls: batch( → this.__batch(
  result = result.replace(/\bbatch\s*\(/g, 'this.__batch(');

  // 0b. Transform props.x → this._state.x BEFORE other transforms
  if (propsObjectName && propNames.size > 0) {
    const propsRe = new RegExp(`\\b${propsObjectName}\\.(\\w+)`, 'g');
    result = result.replace(propsRe, (match, propName) => {
      if (propNames.has(propName)) {
        return `this._state.${propName}`;
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

  // 1. Transform signal reads FIRST: x() → this._state.x
  // Must happen before writes so that count.set(count() + 1) becomes count.set(this._state.count + 1)
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(readRe, `this._state.${name}`);
  }

  // 1b. Transform model signal reads: varName() → this._state.{propName}
  for (const [varName, propNameVal] of modelVarMap) {
    if (propsObjectName && varName === propsObjectName) continue;
    if (emitsObjectName && varName === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${varName}\\(\\)`, 'g');
    result = result.replace(readRe, `this._state.${propNameVal}`);
  }

  // 1c. Transform signal writes: x.set(value) → this._state.x = value
  // Uses balanced parentheses matching to handle nested parens in the value
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const setPattern = new RegExp(`\\b${escapeRegex(name)}\\.set\\(`, 'g');
    let match;
    // Collect all match positions first, then replace from end to start
    const matches = [];
    while ((match = setPattern.exec(result)) !== null) {
      matches.push(match.index);
    }
    // Process from end to start to preserve indices
    for (let m = matches.length - 1; m >= 0; m--) {
      const matchIdx = matches[m];
      const start = matchIdx + `${name}.set(`.length;
      let depth = 1;
      let i = start;
      while (i < result.length && depth > 0) {
        if (result[i] === '(') depth++;
        else if (result[i] === ')') depth--;
        i++;
      }
      const value = result.slice(start, i - 1);
      result = result.slice(0, matchIdx) + `this._state.${name} = ${value}` + result.slice(i);
    }
  }

  // 2. Transform computed reads: x() → this._state.x (Phase 2: _state)
  for (const name of computedNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${name}\\(\\)`, 'g');
    result = result.replace(readRe, `this._state.${name}`);
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
 * @param {string[]} [constantNames]
 */
function generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames = [], modelVarMap = new Map(), indentOverride = null) {
  const indent = indentOverride || '        ';

  // Phase 3: All bindings in __renderEach_N are static assignments.
  // External signal reactivity is handled by __invalidate in-place updates.
  // Item-only bindings are set once and re-rendered on source change.

  // Bindings
  for (const b of forBlock.bindings) {
    const nodeRef = pathExpr(b.path, 'node');
    if (b.type === 'constant') {
      lines.push(`${indent}  ${nodeRef}.textContent = this._const_${b.name} ?? '';`);
    } else {
      const expr = transformForExpr(b.name, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}  ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? '';`);
    }
  }

  // Events
  for (const e of forBlock.events) {
    const nodeRef = pathExpr(e.path, 'node');
    const handlerExpr = generateForEventHandler(e.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
    lines.push(`${indent}  if (${nodeRef}) ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
  }

  // Show
  for (const sb of forBlock.showBindings) {
    const nodeRef = pathExpr(sb.path, 'node');
    const expr = transformForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
    lines.push(`${indent}  ${nodeRef}.style.display = (${expr}) ? '' : 'none';`);
  }

  // Attr bindings
  for (const ab of forBlock.attrBindings) {
    const nodeRef = pathExpr(ab.path, 'node');
    if (ab.kind === 'class') {
      if (ab.expression.trimStart().startsWith('{')) {
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  { const __obj = ${expr};`);
        lines.push(`${indent}    for (const [__k, __val] of Object.entries(__obj)) {`);
        lines.push(`${indent}      __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
        lines.push(`${indent}    } }`);
      } else if (ab.expression.trimStart().startsWith('[')) {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  ${nodeRef}.className = ${staticPrefix}(${expr}).join(' ');`);
      } else {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(expr)};`);
      }
    } else if (ab.kind === 'style') {
      if (ab.expression.trimStart().startsWith('{')) {
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  { const __obj = ${expr};`);
        lines.push(`${indent}    for (const [__k, __val] of Object.entries(__obj)) { ${nodeRef}.style[__k] = __val; } }`);
      } else {
        const staticPrefix = ab.staticValue ? `'${ab.staticValue}; ' + ` : '';
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  ${nodeRef}.style.cssText = ${staticPrefix}${expr};`);
      }
    } else if (ab.kind === 'attr') {
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}  { const __v = ${expr};`);
      lines.push(`${indent}    if (__v || __v === '') { ${nodeRef}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`${indent}    else { ${nodeRef}.removeAttribute('${ab.attr}'); } }`);
    } else if (ab.kind === 'bool') {
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}  ${nodeRef}.${ab.attr} = !!(${expr});`);
    } else {
      // Default: treat as regular attribute binding
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}  { const __v = ${expr};`);
      lines.push(`${indent}    if (__v || __v === '') { ${nodeRef}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`${indent}    else { ${nodeRef}.removeAttribute('${ab.attr}'); } }`);
    }
  }

  // Model bindings
  for (const mb of (forBlock.modelBindings || [])) {
    const nodeRef = pathExpr(mb.path, 'node');
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      lines.push(`${indent}  ${nodeRef}.checked = (this._state.${mb.signal} === '${mb.radioValue}');`);
    } else if (mb.prop === 'checked') {
      lines.push(`${indent}  ${nodeRef}.checked = !!this._state.${mb.signal};`);
    } else {
      lines.push(`${indent}  ${nodeRef}.value = this._state.${mb.signal} ?? '';`);
    }
    // Model event listener
    if (mb.prop === 'checked' && mb.radioValue === null) {
      lines.push(`${indent}  if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = e.target.checked; });`);
    } else if (mb.coerce) {
      lines.push(`${indent}  if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = Number(e.target.value); });`);
    } else {
      lines.push(`${indent}  if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { this._state.${mb.signal} = e.target.value; });`);
    }
  }

  // Nested if-blocks inside for item
  for (const ifBlock of (forBlock.ifBlocks || [])) {
    const ivn = ifBlock.varName;
    // Create template elements for each branch
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      lines.push(`${indent}  const ${ivn}_t${i} = document.createElement('template');`);
      lines.push(`${indent}  ${ivn}_t${i}.innerHTML = \`${branch.templateHtml}\`;`);
    }
    lines.push(`${indent}  const ${ivn}_anchor = ${pathExpr(ifBlock.anchorPath, 'node')};`);
    lines.push(`${indent}  let ${ivn}_current = null;`);
    lines.push(`${indent}  let ${ivn}_active = undefined;`);
    // Evaluate condition and render initial branch
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      const keyword = i === 0 ? 'if' : branch.type === 'else-if' ? 'else if' : 'else';
      if (branch.type !== 'else') {
        const expr = transformForExpr(branch.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}  ${keyword} (${expr}) {`);
      } else {
        lines.push(`${indent}  ${keyword} {`);
      }
      lines.push(`${indent}    const clone = ${ivn}_t${i}.content.cloneNode(true);`);
      lines.push(`${indent}    const bnode = clone.firstChild;`);
      lines.push(`${indent}    ${ivn}_anchor.parentNode.insertBefore(bnode, ${ivn}_anchor);`);
      lines.push(`${indent}    ${ivn}_current = bnode;`);
      lines.push(`${indent}    ${ivn}_active = ${i};`);
      // Render nested features inside this branch (bindings, events, forBlocks, etc.)
      for (const b of (branch.bindings || [])) {
        const nodeRef = pathExpr(b.path, 'bnode');
        if (b.type === 'constant') {
          lines.push(`${indent}    ${nodeRef}.textContent = this._const_${b.name} ?? '';`);
        } else {
          const expr = transformForExpr(b.name, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}    ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? '';`);
        }
      }
      for (const e of (branch.events || [])) {
        const nodeRef = pathExpr(e.path, 'bnode');
        const handlerExpr = generateForEventHandler(e.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
        lines.push(`${indent}    ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
      }
      // Nested each blocks inside if-branch
      for (const innerFor2 of (branch.forBlocks || [])) {
        const innerVn2 = innerFor2.varName;
        const innerItemVar2 = innerFor2.itemVar;
        const innerIndexVar2 = innerFor2.indexVar;
        const innerSource2 = transformForExpr(innerFor2.source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        const innerAnchor2 = pathExpr(innerFor2.anchorPath, 'bnode');
        const innerAnchorRef2 = `__anchor_${innerVn2}`;
        lines.push(`${indent}    const ${innerAnchorRef2} = ${innerAnchor2};`);
        lines.push(`${indent}    const ${innerVn2}_iter = (${innerSource2} || []);`);
        lines.push(`${indent}    ${innerVn2}_iter.forEach((${innerItemVar2}, ${innerIndexVar2 || '__i2'}) => {`);
        lines.push(`${indent}      const clone2 = document.createElement('template');`);
        lines.push(`${indent}      clone2.innerHTML = \`${innerFor2.templateHtml}\`;`);
        lines.push(`${indent}      const innerNode2 = clone2.content.firstChild;`);
        for (const b2 of (innerFor2.bindings || [])) {
          const nodeRef2 = pathExpr(b2.path, 'innerNode2');
          const expr2 = transformForExpr(b2.name, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}      ${nodeRef2}.textContent = ${wrapTernaryExpr(expr2)} ?? '';`);
        }
        for (const e2 of (innerFor2.events || [])) {
          const nodeRef2 = pathExpr(e2.path, 'innerNode2');
          const handlerExpr2 = generateForEventHandler(e2.handler, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames);
          lines.push(`${indent}      if (${nodeRef2}) ${nodeRef2}.addEventListener('${e2.event}', ${handlerExpr2});`);
        }
        // Show bindings inside if-branch forBlock
        for (const sb of (innerFor2.showBindings || [])) {
          const nodeRef2 = pathExpr(sb.path, 'innerNode2');
          const expr2 = transformForExpr(sb.expression, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}      ${nodeRef2}.style.display = (${expr2}) ? '' : 'none';`);
        }
        // Nested dynamic components inside if-branch forBlock
        for (const dyn of (innerFor2.dynamicComponents || [])) {
          const dvn = dyn.varName;
          const anchorRef = pathExpr(dyn.anchorPath, 'innerNode2');
          const isExprTransformed = transformForExpr(dyn.isExpression, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}      {`);
          lines.push(`${indent}        const ${dvn}_anchor = ${anchorRef};`);
          lines.push(`${indent}        let ${dvn}_current = null;`);
          lines.push(`${indent}        const __tag = ${isExprTransformed};`);
          lines.push(`${indent}        if (__tag) {`);
          lines.push(`${indent}          const el = document.createElement(__tag);`);
          for (const prop of dyn.props) {
            const propExpr = transformForExpr(prop.expression, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
            lines.push(`${indent}          el.setAttribute('${prop.attr}', ${propExpr});`);
          }
          for (const evt of dyn.events) {
            const handlerExpr = generateForEventHandler(evt.handler, innerItemVar2, innerIndexVar2, propNames, signalNamesSet, computedNamesSet, methodNames);
            lines.push(`${indent}          el.addEventListener('${evt.event}', ${handlerExpr});`);
          }
          lines.push(`${indent}          ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
          lines.push(`${indent}          customElements.upgrade(el);`);
          lines.push(`${indent}          ${dvn}_current = el;`);
          lines.push(`${indent}        }`);
          lines.push(`${indent}      }`);
        }
        lines.push(`${indent}      ${innerAnchorRef2}.parentNode.insertBefore(innerNode2, ${innerAnchorRef2});`);
        lines.push(`${indent}    });`);
      }
      // Nested dynamic components inside if-branch
      for (const dyn of (branch.dynamicComponents || [])) {
        const dvn = dyn.varName;
        const anchorRef = pathExpr(dyn.anchorPath, 'bnode');
        const isExprTransformed = transformForExpr(dyn.isExpression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}    {`);
        lines.push(`${indent}      const ${dvn}_anchor = ${anchorRef};`);
        lines.push(`${indent}      let ${dvn}_current = null;`);
        lines.push(`${indent}      const __tag = ${isExprTransformed};`);
        lines.push(`${indent}      if (__tag) {`);
        lines.push(`${indent}        const el = document.createElement(__tag);`);
        for (const prop of dyn.props) {
          const propExpr = transformForExpr(prop.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
          lines.push(`${indent}        el.setAttribute('${prop.attr}', ${propExpr});`);
        }
        for (const evt of dyn.events) {
          const handlerExpr = generateForEventHandler(evt.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
          lines.push(`${indent}        el.addEventListener('${evt.event}', ${handlerExpr});`);
        }
        lines.push(`${indent}        ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
        lines.push(`${indent}        customElements.upgrade(el);`);
        lines.push(`${indent}        ${dvn}_current = el;`);
        lines.push(`${indent}      }`);
        lines.push(`${indent}    }`);
      }
      lines.push(`${indent}  }`);
    }
  }

  // Nested for-blocks inside for item
  for (const innerFor of (forBlock.forBlocks || [])) {
    const innerVn = innerFor.varName;
    const innerItemVar = innerFor.itemVar;
    const innerIndexVar = innerFor.indexVar;
    const innerSource = transformForExpr(innerFor.source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
    const innerAnchor = pathExpr(innerFor.anchorPath, 'node');
    const innerAnchorVar = `__anchor_${innerVn}`;
    lines.push(`${indent}  const ${innerAnchorVar} = ${innerAnchor};`);
    lines.push(`${indent}  const ${innerVn}_iter = (${innerSource} || []);`);
    lines.push(`${indent}  ${innerVn}_iter.forEach((${innerItemVar}, ${innerIndexVar || '__i'}) => {`);
    lines.push(`${indent}    const clone = document.createElement('template');`);
    lines.push(`${indent}    clone.innerHTML = \`${innerFor.templateHtml}\`;`);
    lines.push(`${indent}    const innerNode = clone.content.firstChild;`);
    // Nested bindings
    for (const b of (innerFor.bindings || [])) {
      const nodeRef = pathExpr(b.path, 'innerNode');
      if (b.type === 'constant') {
        lines.push(`${indent}    ${nodeRef}.textContent = this._const_${b.name} ?? '';`);
      } else {
        const expr = transformForExpr(b.name, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}    ${nodeRef}.textContent = ${wrapTernaryExpr(expr)} ?? '';`);
      }
    }
    for (const e of (innerFor.events || [])) {
      const nodeRef = pathExpr(e.path, 'innerNode');
      const handlerExpr = generateForEventHandler(e.handler, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      lines.push(`${indent}    if (${nodeRef}) ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
    }
    // Show bindings
    for (const sb of (innerFor.showBindings || [])) {
      const nodeRef = pathExpr(sb.path, 'innerNode');
      const expr = transformForExpr(sb.expression, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}    ${nodeRef}.style.display = (${expr}) ? '' : 'none';`);
    }
    // Nested dynamic components
    for (const dyn of (innerFor.dynamicComponents || [])) {
      const dvn = dyn.varName;
      const anchorRef = pathExpr(dyn.anchorPath, 'innerNode');
      const isExprTransformed = transformForExpr(dyn.isExpression, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}    {`);
      lines.push(`${indent}      const ${dvn}_anchor = ${anchorRef};`);
      lines.push(`${indent}      let ${dvn}_current = null;`);
      lines.push(`${indent}      const __tag = ${isExprTransformed};`);
      lines.push(`${indent}      if (__tag) {`);
      lines.push(`${indent}        const el = document.createElement(__tag);`);
      for (const prop of dyn.props) {
        const propExpr = transformForExpr(prop.expression, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
        lines.push(`${indent}        el.setAttribute('${prop.attr}', ${propExpr});`);
      }
      for (const evt of dyn.events) {
        const handlerExpr = generateForEventHandler(evt.handler, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
        lines.push(`${indent}        el.addEventListener('${evt.event}', ${handlerExpr});`);
      }
      lines.push(`${indent}        ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
      lines.push(`${indent}        customElements.upgrade(el);`);
      lines.push(`${indent}        ${dvn}_current = el;`);
      lines.push(`${indent}      }`);
      lines.push(`${indent}    }`);
    }
    lines.push(`${indent}    ${innerAnchorVar}.parentNode.insertBefore(innerNode, ${innerAnchorVar});`);
    lines.push(`${indent}  });`);
  }

  // Dynamic components (<component :is>) inside each item
  for (const dyn of (forBlock.dynamicComponents || [])) {
    const dvn = dyn.varName;
    const anchorRef = pathExpr(dyn.anchorPath, 'node');
    const isExprTransformed = transformForExpr(dyn.isExpression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);

    lines.push(`${indent}  {`);
    lines.push(`${indent}    const ${dvn}_anchor = ${anchorRef};`);
    lines.push(`${indent}    let ${dvn}_current = null;`);
    lines.push(`${indent}    const __tag = ${isExprTransformed};`);
    lines.push(`${indent}    if (__tag) {`);
    lines.push(`${indent}      const el = document.createElement(__tag);`);

    for (const prop of dyn.props) {
      const propExpr = transformForExpr(prop.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames);
      lines.push(`${indent}      el.setAttribute('${prop.attr}', ${propExpr});`);
    }

    for (const evt of dyn.events) {
      const handlerExpr = generateForEventHandler(evt.handler, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);
      lines.push(`${indent}      el.addEventListener('${evt.event}', ${handlerExpr});`);
    }

    lines.push(`${indent}      ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
    lines.push(`${indent}      customElements.upgrade(el);`);
    lines.push(`${indent}      ${dvn}_current = el;`);
    lines.push(`${indent}    }`);
    lines.push(`${indent}  }`);
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
function generateNestedItemSetup(lines, innerFor, outerItemVar, outerIndexVar, innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet, methodNames, indent, modelVarMap = new Map()) {
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
    lines.push(`${indent}if (${nodeRef}) ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
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
    if (ab.kind === 'class') {
      // :class binding — handle object, array, and string expressions
      if (ab.expression.trimStart().startsWith('{')) {
        // Object expression: iterate entries, classList.add/remove
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}{`);
          lines.push(`${indent}  const __obj = ${ab.expression};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
          lines.push(`${indent}  }`);
          lines.push(`${indent}}`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => {`);
          lines.push(`${indent}  const __obj = ${expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
          lines.push(`${indent}  }`);
          lines.push(`${indent}});`);
        }
      } else if (ab.expression.trimStart().startsWith('[')) {
        // Array expression: join with spaces, preserve static classes
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}${nodeRef}.className = ${staticPrefix}(${ab.expression}).join(' ');`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => { ${nodeRef}.className = ${staticPrefix}(${expr}).join(' '); });`);
        }
      } else {
        // String expression: set className, preserve static classes
        const staticPrefix = ab.staticValue ? `'${ab.staticValue} ' + ` : '';
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}${nodeRef}.className = ${staticPrefix}${ab.expression};`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => { ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(expr)}; });`);
        }
      }
    } else if (ab.kind === 'style') {
      // :style binding — handle object and string expressions
      if (ab.expression.trimStart().startsWith('{')) {
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}{`);
          lines.push(`${indent}  const __obj = ${ab.expression};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) { ${nodeRef}.style[__k] = __val; }`);
          lines.push(`${indent}}`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => {`);
          lines.push(`${indent}  const __obj = ${expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) { ${nodeRef}.style[__k] = __val; }`);
          lines.push(`${indent}});`);
        }
      } else {
        // String expression: set cssText, preserve static styles
        const staticPrefix = ab.staticValue ? `'${ab.staticValue}; ' + ` : '';
        if (isNestedStatic(ab.expression)) {
          lines.push(`${indent}${nodeRef}.style.cssText = ${staticPrefix}${ab.expression};`);
        } else {
          const expr = transformNested(ab.expression);
          lines.push(`${indent}__effect(() => { ${nodeRef}.style.cssText = ${staticPrefix}${expr}; });`);
        }
      }
    } else {
      // Regular attr or bool binding
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
  }

  // Model bindings
  for (const mb of (innerFor.modelBindings || [])) {
    const nodeRef = pathExpr(mb.path, 'innerNode');
    lines.push(`${indent}__effect(() => {`);
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      lines.push(`${indent}  ${nodeRef}.checked = (this._state.${mb.signal} === '${mb.radioValue}');`);
    } else if (mb.prop === 'checked') {
      lines.push(`${indent}  ${nodeRef}.checked = !!this._state.${mb.signal};`);
    } else {
      lines.push(`${indent}  ${nodeRef}.value = this._state.${mb.signal} ?? '';`);
    }
    lines.push(`${indent}});`);
    const mbAssign = modelVarMap.has(mb.signal)
      ? `this._modelSet_${mb.signal}(`
      : `this._state.${mb.signal} = `;
    if (mb.prop === 'checked' && mb.radioValue === null) {
      lines.push(`${indent}if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { ${mbAssign}e.target.checked${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
    } else if (mb.coerce) {
      lines.push(`${indent}if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { ${mbAssign}Number(e.target.value)${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
    } else {
      lines.push(`${indent}if (${nodeRef}) ${nodeRef}.addEventListener('${mb.event}', (e) => { ${mbAssign}e.target.value${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
    }
  }

  // Nested dynamic components (<component :is>) inside nested each items
  for (const dyn of (innerFor.dynamicComponents || [])) {
    const dvn = dyn.varName;
    const anchorRef = pathExpr(dyn.anchorPath, 'innerNode');

    // Transform the :is expression using the nested loop context
    const isExprTransformed = isNestedStatic(dyn.isExpression)
      ? dyn.isExpression
      : transformNested(dyn.isExpression);

    lines.push(`${indent}{`);
    lines.push(`${indent}  const ${dvn}_anchor = ${anchorRef};`);
    lines.push(`${indent}  let ${dvn}_current = null;`);
    lines.push(`${indent}  const __tag = ${isExprTransformed};`);
    lines.push(`${indent}  if (__tag) {`);
    lines.push(`${indent}    const el = document.createElement(__tag);`);

    // Emit prop bindings
    for (const prop of dyn.props) {
      const propExpr = isNestedStatic(prop.expression)
        ? prop.expression
        : transformNested(prop.expression);
      lines.push(`${indent}    el.setAttribute('${prop.attr}', ${propExpr});`);
    }

    // Emit event listeners
    for (const evt of dyn.events) {
      const handlerExpr = generateForEventHandler(evt.handler, innerItemVar, innerIndexVar, filteredPropNames, filteredSignalNames, filteredComputedNames, methodNames);
      lines.push(`${indent}    el.addEventListener('${evt.event}', ${handlerExpr});`);
    }

    lines.push(`${indent}    ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
    lines.push(`${indent}    customElements.upgrade(el);`);
    lines.push(`${indent}    ${dvn}_current = el;`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}}`);
  }
}

// ── Zero-Runtime: Dependency Graph Utilities ─────────────────────────

/**
 * Extract signal/prop/model dependency names from a raw (untransformed) expression.
 * Scans the expression for known reactive variable names using word-boundary regex.
 *
 * @param {string} rawExpr — The raw expression as written in the template
 * @param {string[]} signalNames — Known signal names
 * @param {Set<string>} propNames — Known prop names
 * @param {Array<{name: string, varName: string}>} modelDefs — Model definitions
 * @returns {Set<string>} Set of dependency keys (signal/prop/model names)
 */
export function extractDeps(rawExpr, signalNames, propNames, modelDefs) {
  const deps = new Set();
  for (const name of signalNames) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`);
    if (re.test(rawExpr)) deps.add(name);
  }
  for (const name of propNames) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`);
    if (re.test(rawExpr)) deps.add(name);
  }
  for (const md of modelDefs) {
    const re = new RegExp(`\\b${escapeRegex(md.varName)}\\b`);
    if (re.test(rawExpr)) deps.add(md.name);
  }
  return deps;
}

/**
 * Check if a raw expression references any computed value or method call.
 * Expressions that reference computeds or methods cannot be statically resolved
 * and must remain in __effect.
 *
 * @param {string} rawExpr — The raw expression
 * @param {string[]} computedNames — Known computed names
 * @param {string[]} methodNames — Known method names
 * @returns {boolean} True if the expression references a computed or method
 */
export function refsComputedOrMethod(rawExpr, computedNames, methodNames) {
  for (const name of computedNames) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`);
    if (re.test(rawExpr)) return true;
  }
  for (const name of methodNames) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\s*\\(`);
    if (re.test(rawExpr)) return true;
  }
  return false;
}

/**
 * Extract signal/computed dependencies from a computed expression's raw body.
 * Scans the expression for known signal and computed variable names.
 *
 * @param {string} body — The raw computed expression body (without the `() =>` wrapper)
 * @param {string[]} signalNames — Known signal names
 * @param {string[]} computedNames — Known computed names
 * @returns {string[]} Array of dependency keys (signal/computed names)
 */
export function extractComputedDeps(body, signalNames, computedNames) {
  const deps = [];
  for (const name of signalNames) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`);
    if (re.test(body)) deps.push(name);
  }
  for (const name of computedNames) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`);
    if (re.test(body)) deps.push(name);
  }
  return deps;
}

/**
 * Compute topological order of computed values by dependency.
 * Uses Kahn's algorithm. Throws on circular dependencies.
 *
 * @param {Array<{name: string, deps: string[]}>} computeds — Computed configs with dependency arrays
 * @param {Set<string>} computedNamesSet — All computed names
 * @returns {string[]} Computed names in evaluation order (deps first)
 */
export function topologicalSortComputeds(computeds, computedNamesSet) {
  // Build adjacency: edge from dependency → dependent
  const inDegree = new Map();  // name → in-degree count
  const dependsOn = new Map(); // name → Set<names that depend on it>
  for (const c of computeds) {
    if (!inDegree.has(c.name)) inDegree.set(c.name, 0);
    if (!dependsOn.has(c.name)) dependsOn.set(c.name, new Set());
    for (const dep of c.deps) {
      // Only count computed-to-computed dependencies (signal deps are handled via Proxy)
      if (!computedNamesSet.has(dep)) continue;
      inDegree.set(c.name, (inDegree.get(c.name) || 0) + 1);
      if (!dependsOn.has(dep)) dependsOn.set(dep, new Set());
      dependsOn.get(dep).add(c.name);
    }
  }

  // Kahn's BFS
  const queue = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const result = [];
  while (queue.length > 0) {
    const name = queue.shift();
    result.push(name);
    const dependents = dependsOn.get(name) || new Set();
    for (const depName of dependents) {
      const newDegree = (inDegree.get(depName) || 0) - 1;
      inDegree.set(depName, newDegree);
      if (newDegree === 0) queue.push(depName);
    }
  }

  if (result.length !== computeds.length) {
    throw new Error('Circular dependency detected among computed values');
  }

  return result;
}

/**
 * @typedef {Object} DepEntry
 * @property {'text'|'show'|'attr'|'bool'|'class'|'style'|'computed'|'renderIf'|'watcher'} type
 * @property {string} varName — DOM node variable (e.g., '__b0', '__sb0', '__ab0')
 * @property {string} expr — Transformed expression to evaluate
 * @property {string} [attr] — Attribute name (for attr/bool bindings)
 * @property {string|null} [staticValue] — Static prefix (for class/style)
 * @property {'object'|'array'|'string'} [subKind] — For class/style bindings
 * @property {string} [computedName] — Name of computed value (for 'computed' type)
 * @property {number} [ifBlockIndex] — If-block index (for 'renderIf' type)
 * @property {'signal'|'getter'} [watcherKind] — Watcher kind (for 'watcher' type)
 * @property {number} [watcherIndex] — Watcher index (for 'watcher' type)
 * @property {string} [watcherTarget] — Watched signal name (for 'watcher' type)
 * @property {string} [prevName] — Old-value tracking variable name (for 'watcher' type)
 * @property {boolean} [initOnly] — True when the entry is only for 'case *' (old-value init, no callback)
 * @property {string} [ifPathExpr] — Path expression relative to if-block current node (for if-block internal bindings)
 * @property {string} [getterExpr] — Pre-transformed getter expression (for 'watcher' getter type)
 * @property {string} [newParam] — New value parameter name in watcher callback
 * @property {string} [oldParam] — Old value parameter name in watcher callback (nullable)
 * @property {number} [eachBlockIndex] — Each-block index (for 'renderEach' type and each internal bindings)
 * @property {string} [itemVar] — Item variable name for expression reconstruction in each-blocks
 * @property {string} [indexVar] — Index variable name for expression reconstruction in each-blocks
 * @property {string[]} [path] — Path from item root node to the binding node (for each-block item bindings)
 * @property {string} [signal] — Signal name for model/childProp/childSlot types
 * @property {string} [radioValue] — Radio button value (for 'modelRadio' type)
 * @property {boolean} [dynGuard] — Whether to guard with dynamic element existence check
 */

/**
 * Build the compile-time dependency graph from parsed bindings.
 * Classifies each binding as either eligible for __invalidate (returned in depGraph)
 * or remaining in __effect (returned in effectBindings).
 *
 * @param {object} parseResult — The full parse result
 * @param {object} transformContext — Context for expression transformation
 * @param {string[]} transformContext.signalNames
 * @param {string[]} transformContext.computedNames
 * @param {Set<string>} transformContext.propNames
 * @param {Array} transformContext.propDefs
 * @param {Array} transformContext.modelDefs
 * @param {Map} transformContext.modelVarMap
 * @param {string|null} transformContext.propsObjectName
 * @param {string|null} transformContext.emitsObjectName
 * @param {string[]} transformContext.constantNames
 * @param {string[]} transformContext.methodNames
 * @returns {{ depGraph: Map<string, DepEntry[]>, effectBindings: { text: Array, show: Array, attr: Array } }}
 */
export function buildDepGraph(parseResult, transformContext) {
  const { bindings = [], showBindings = [], attrBindings = [], constantVars = [] } = parseResult;
  const {
    signalNames, computedNames, propNames, modelDefs, modelVarMap,
    propsObjectName, emitsObjectName, constantNames, methodNames
  } = transformContext;

  // Extended data from parseResult (if-blocks, computeds, watchers, for-blocks)
  const ifBlocks = parseResult.ifBlocks || [];
  const computeds = parseResult.computeds || [];
  const watchers = parseResult.watchers || [];
  const forBlocks = parseResult.forBlocks || [];

  /** @type {Map<string, DepEntry[]>} */
  const depGraph = new Map();
  const effectBindings = { text: [], show: [], attr: [] };

  function addDep(key, entry) {
    if (!depGraph.has(key)) depGraph.set(key, []);
    depGraph.get(key).push(entry);
  }

  // ── Process text bindings ──
  for (const b of bindings) {
    // Computed bindings: Phase 2 — computed values are now stored in _state,
    // so computed-type text bindings can be handled in __invalidate too
    // UNLESS they reference methods in their body (keep in effect)
    if (b.type === 'computed') {
      // Check if the computed expression body references methods
      if (refsComputedOrMethod(b.name, [], methodNames)) {
        effectBindings.text.push(b);
        continue;
      }
      // Add as a text binding depending on the computed name
      addDep(b.name, { type: 'text', varName: b.varName, expr: `this._state.${b.name}` });
      continue;
    }
    // Constant function bindings: extract deps from function body and add to depGraph
    // These call signals internally, so we register them under the signals they depend on.
    if (b.type === 'constant') {
      const constDef = constantVars.find(c => c.name === b.name);
      if (constDef && /^\s*(\(|function\b)/.test(constDef.value)) {
        const transformedBody = transformMethodBody(constDef.value, signalNames, computedNames,
          propsObjectName, propNames, emitsObjectName, [], constantNames, modelVarMap, methodNames);
        const bodyDeps = extractDeps(transformedBody, signalNames, propNames, modelDefs);
        if (bodyDeps.size > 0) {
          const entry = { type: 'text', varName: b.varName, expr: `this._const_${b.name}()` };
          for (const dep of bodyDeps) {
            addDep(dep, entry);
          }
        }
        continue;
      }
      // Non-function constants are static — no invalidation needed, no effect needed
      continue;
    }

    // Determine raw expression to scan for deps
    let rawExpr;
    if (b.type === 'signal') rawExpr = b.name;
    else if (b.type === 'prop') rawExpr = b.name;
    else if (b.type === 'method') {
      // Phase 4: Method bindings go to depGraph.
      // Only actual method identifiers (in methodNames) need () appended;
      // complex expressions fall through as 'method' type and shouldn't get ().
      const isSimpleMethod = methodNames.includes(b.name);
      const rawForDeps = isSimpleMethod ? b.name + '()' : b.name;
      const deps = extractDeps(rawForDeps, signalNames, propNames, modelDefs);
      const expr = transformExpr(rawForDeps, signalNames, computedNames,
        propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
      if (deps.size === 0) {
        // No signal deps found — register under all signals (lazy approach)
        // At minimum, render in wildcard case
        for (const sn of signalNames) {
          addDep(sn, { type: 'text', varName: b.varName, expr });
        }
      } else {
        for (const dep of deps) {
          addDep(dep, { type: 'text', varName: b.varName, expr });
        }
      }
      continue;
    }
    else rawExpr = b.name; // expression type

    // Check for computed/method references → stay in __effect
    if (refsComputedOrMethod(rawExpr, computedNames, methodNames)) {
      effectBindings.text.push(b);
      continue;
    }

    // Extract signal dependencies
    const deps = extractDeps(rawExpr, signalNames, propNames, modelDefs);
    if (deps.size === 0) {
      // No reactive deps — static value, skip
      continue;
    }

    // Transform the expression for the generated code
    const expr = transformExpr(rawExpr, signalNames, computedNames,
      propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

    const entry = { type: 'text', varName: b.varName, expr };
    for (const dep of deps) {
      addDep(dep, entry);
    }
  }

  // ── Process show bindings ──
  for (const sb of showBindings) {
    if (refsComputedOrMethod(sb.expression, computedNames, methodNames)) {
      effectBindings.show.push(sb);
      continue;
    }
    const deps = extractDeps(sb.expression, signalNames, propNames, modelDefs);
    if (deps.size === 0) continue;

    const expr = transformExpr(sb.expression, signalNames, computedNames,
      propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

    const entry = { type: 'show', varName: sb.varName, expr };
    for (const dep of deps) {
      addDep(dep, entry);
    }
  }

  // ── Process attr bindings ──
  for (const ab of attrBindings) {
    if (refsComputedOrMethod(ab.expression, computedNames, methodNames)) {
      effectBindings.attr.push(ab);
      continue;
    }
    const deps = extractDeps(ab.expression, signalNames, propNames, modelDefs);
    if (deps.size === 0) continue;

    const expr = transformExpr(ab.expression, signalNames, computedNames,
      propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

    const entry = {
      type: ab.kind, // 'attr', 'bool', 'class', 'style'
      varName: ab.varName,
      expr,
      attr: ab.attr,
      staticValue: ab.staticValue || null,
      subKind: ab.expression.trimStart().startsWith('{') ? 'object'
             : ab.expression.trimStart().startsWith('[') ? 'array'
             : 'string'
    };
    for (const dep of deps) {
      addDep(dep, entry);
    }
  }

  // ── Phase 2: Process if-blocks ──
  for (let idx = 0; idx < ifBlocks.length; idx++) {
    const ifBlock = ifBlocks[idx];
    const vn = ifBlock.varName;

    // Register renderIf calls under condition signals
    for (const branch of ifBlock.branches) {
      if (!branch.expression) continue; // else branch has no condition
      const deps = extractDeps(branch.expression, signalNames, propNames, modelDefs);
      for (const dep of deps) {
        addDep(dep, { type: 'renderIf', ifBlockIndex: idx });
      }
    }

    // Register internal bindings under their dependency signals
    for (let bi = 0; bi < ifBlock.branches.length; bi++) {
      const branch = ifBlock.branches[bi];

      // Text bindings inside branch
      for (const b of (branch.bindings || [])) {
        let rawExpr;
        if (b.type === 'signal') rawExpr = b.name;
        else if (b.type === 'prop') rawExpr = b.name;
        else rawExpr = b.name;
        if (b.type === 'constant' || refsComputedOrMethod(rawExpr, computedNames, methodNames)) continue;
        const deps = extractDeps(rawExpr, signalNames, propNames, modelDefs);
        if (deps.size === 0) continue;
        const expr = transformExpr(rawExpr, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        const entry = {
          type: 'text',
          varName: b.varName,
          expr,
          ifBlockIndex: idx,
          ifPathExpr: pathExpr(b.path, `this.${vn}_current`),
        };
        for (const dep of deps) {
          addDep(dep, entry);
        }
      }

      // Show bindings inside branch
      for (const sb of (branch.showBindings || [])) {
        if (refsComputedOrMethod(sb.expression, computedNames, methodNames)) continue;
        const deps = extractDeps(sb.expression, signalNames, propNames, modelDefs);
        if (deps.size === 0) continue;
        const expr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        const entry = {
          type: 'show',
          varName: sb.varName,
          expr,
          ifBlockIndex: idx,
          ifPathExpr: pathExpr(sb.path, `this.${vn}_current`),
        };
        for (const dep of deps) {
          addDep(dep, entry);
        }
      }

      // Attr bindings inside branch
      for (const ab of (branch.attrBindings || [])) {
        if (refsComputedOrMethod(ab.expression, computedNames, methodNames)) continue;
        const deps = extractDeps(ab.expression, signalNames, propNames, modelDefs);
        if (deps.size === 0) continue;
        const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        const entry = {
          type: ab.kind,
          varName: ab.varName,
          expr,
          attr: ab.attr,
          staticValue: ab.staticValue || null,
          subKind: ab.expression.trimStart().startsWith('{') ? 'object'
                 : ab.expression.trimStart().startsWith('[') ? 'array'
                 : 'string',
          ifBlockIndex: idx,
          ifPathExpr: pathExpr(ab.path, `this.${vn}_current`),
        };
        for (const dep of deps) {
          addDep(dep, entry);
        }
      }
    }
  }

  // ── Phase 2: Process computed dependencies ──
  for (const c of computeds) {
    const deps = extractComputedDeps(c.body, signalNames, computedNames);
    const transformedExpr = transformExpr(c.body, signalNames, computedNames,
      propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
    for (const dep of deps) {
      addDep(dep, { type: 'computed', computedName: c.name, expr: transformedExpr });
    }
  }

  // ── Phase 2: Process watcher dependencies ──
  for (let idx = 0; idx < watchers.length; idx++) {
    const w = watchers[idx];
    if (w.kind === 'signal') {
      const target = w.target;
      const watchKey = target;
      const body = transformMethodBody(w.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, [], constantNames, modelVarMap, methodNames);
      addDep(watchKey, {
        type: 'watcher',
        watcherIndex: idx,
        watcherKind: 'signal',
        watcherTarget: target,
        prevName: `__prev_${target}`,
        expr: body,
        newParam: w.newParam,
        oldParam: w.oldParam,
      });
    } else {
      // Getter watcher: extract deps from the getter expression
      const deps = extractDeps(w.target, signalNames, propNames, modelDefs);
      const prevName = `__prev_watch${idx}`;
      const getterExpr = transformMethodBody(w.target, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, [], constantNames, modelVarMap, methodNames);
      const body2 = transformMethodBody(w.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, [], constantNames, modelVarMap, methodNames);
      for (const dep of deps) {
        addDep(dep, {
          type: 'watcher',
          watcherIndex: idx,
          watcherKind: 'getter',
          watcherTarget: w.target,
          prevName,
          getterExpr,
          expr: body2,
          newParam: w.newParam,
          oldParam: w.oldParam,
        });
      }
    }
  }

  // ── Phase 3: Process each-blocks (for-loops) ──
  for (let idx = 0; idx < forBlocks.length; idx++) {
    const forBlock = forBlocks[idx];
    const { source, itemVar, indexVar } = forBlock;

    // 1. Register renderEach entries under source signal keys
    const sourceDeps = extractDeps(source, signalNames, propNames, modelDefs);
    // Filter out item and index variables that might match signal names
    for (const dep of sourceDeps) {
      if (dep !== itemVar && dep !== indexVar) {
        addDep(dep, { type: 'renderEach', eachBlockIndex: idx });
      }
    }

    // 2. Process internal bindings — classify external signal deps
    for (const b of (forBlock.bindings || [])) {
      const rawExpr = b.name;
      if (b.type === 'constant' || refsComputedOrMethod(rawExpr, computedNames, methodNames)) continue;
      const bindingDeps = extractDeps(rawExpr, signalNames, propNames, modelDefs);
      for (const dep of bindingDeps) {
        // Skip item/index variables and source signals
        if (dep === itemVar || dep === indexVar) continue;
        // Check if this dep IS the source signal → already handled by renderEach
        if (sourceDeps.has(dep)) continue;
        // External signal: register in-place update
        const expr = transformForExpr(rawExpr, itemVar, indexVar, propNames, new Set(signalNames), new Set(computedNames), methodNames);
        addDep(dep, {
          type: 'text',
          eachBlockIndex: idx,
          expr,
          itemVar,
          indexVar,
        });
      }
    }

    // Show bindings
    for (const sb of (forBlock.showBindings || [])) {
      if (refsComputedOrMethod(sb.expression, computedNames, methodNames)) continue;
      const bindingDeps = extractDeps(sb.expression, signalNames, propNames, modelDefs);
      for (const dep of bindingDeps) {
        if (dep === itemVar || dep === indexVar) continue;
        if (sourceDeps.has(dep)) continue;
        const expr = transformForExpr(sb.expression, itemVar, indexVar, propNames, new Set(signalNames), new Set(computedNames), methodNames);
        addDep(dep, {
          type: 'show',
          eachBlockIndex: idx,
          expr,
          itemVar,
          indexVar,
        });
      }
    }

    // Attr bindings
    for (const ab of (forBlock.attrBindings || [])) {
      if (refsComputedOrMethod(ab.expression, computedNames, methodNames)) continue;
      const bindingDeps = extractDeps(ab.expression, signalNames, propNames, modelDefs);
      for (const dep of bindingDeps) {
        if (dep === itemVar || dep === indexVar) continue;
        if (sourceDeps.has(dep)) continue;
        const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, new Set(signalNames), new Set(computedNames), methodNames);
        addDep(dep, {
          type: ab.kind,
          eachBlockIndex: idx,
          expr,
          attr: ab.attr,
          staticValue: ab.staticValue || null,
          subKind: ab.expression.trimStart().startsWith('{') ? 'object'
                 : ab.expression.trimStart().startsWith('[') ? 'array'
                 : 'string',
          itemVar,
          indexVar,
        });
      }
    }

    // 3. Recursively process nested if-blocks (for any depth)
    processNestedForBlock(forBlock, idx, forBlock.itemVar, forBlock.indexVar);
  }

  // Helper: recursively process nested if-blocks inside forBlocks at any depth
  function processNestedForBlock(nestedFor, parentIdx, nestedItemVar, nestedIndexVar) {
    const niv = nestedItemVar || nestedFor.itemVar;
    const nidx = nestedIndexVar || nestedFor.indexVar;

    // Add renderEach for ALL external signal refs in nested forBlock bindings/show
    for (const b of (nestedFor.bindings || [])) {
      if (b.type === 'constant' || refsComputedOrMethod(b.name, computedNames, methodNames)) continue;
      const deps = extractDeps(b.name, signalNames, propNames, modelDefs);
      for (const dep of deps) {
        if (dep === niv || dep === nidx) continue;
        addDep(dep, { type: 'renderEach', eachBlockIndex: parentIdx });
      }
    }
    for (const sb of (nestedFor.showBindings || [])) {
      if (refsComputedOrMethod(sb.expression, computedNames, methodNames)) continue;
      const deps = extractDeps(sb.expression, signalNames, propNames, modelDefs);
      for (const dep of deps) {
        if (dep === niv || dep === nidx) continue;
        addDep(dep, { type: 'renderEach', eachBlockIndex: parentIdx });
      }
    }

    for (const ifBlock of (nestedFor.ifBlocks || [])) {
      for (const branch of ifBlock.branches) {
        if (!branch.expression) continue;
        const condDeps = extractDeps(branch.expression, signalNames, propNames, modelDefs);
        for (const dep of condDeps) {
          if (dep === niv || dep === nidx) continue;
          addDep(dep, { type: 'renderEach', eachBlockIndex: parentIdx });
        }
      }
      for (const branch of ifBlock.branches) {
        // Also add renderEach for any bindings inside nested if-blocks
        for (const b of (branch.bindings || [])) {
          if (b.type === 'constant' || refsComputedOrMethod(b.name, computedNames, methodNames)) continue;
          const deps = extractDeps(b.name, signalNames, propNames, modelDefs);
          for (const dep of deps) {
            if (dep === niv || dep === nidx) continue;
            addDep(dep, { type: 'renderEach', eachBlockIndex: parentIdx });
          }
        }
        for (const innerNested of (branch.forBlocks || [])) {
          processNestedForBlock(innerNested, parentIdx, innerNested.itemVar, innerNested.indexVar);
        }
      }
    }
    for (const innerNested of (nestedFor.forBlocks || [])) {
      processNestedForBlock(innerNested, parentIdx, innerNested.itemVar, innerNested.indexVar);
    }
  }

  // ── Phase 4: Process model bindings (signal → DOM) ──
  const modelBindings = parseResult.modelBindings || [];
  for (const mb of modelBindings) {
    if (mb.prop === 'checked' && mb.radioValue !== null) {
      addDep(mb.signal, { type: 'modelRadio', varName: mb.varName, signal: mb.signal, radioValue: mb.radioValue });
    } else if (mb.prop === 'checked') {
      addDep(mb.signal, { type: 'modelCheckbox', varName: mb.varName, signal: mb.signal });
    } else {
      addDep(mb.signal, { type: 'modelValue', varName: mb.varName, signal: mb.signal });
    }
  }

  // ── Phase 4: Process model prop bindings (parent → child) ──
  const modelPropBindings = parseResult.modelPropBindings || [];
  for (const mpb of modelPropBindings) {
    addDep(mpb.signal, { type: 'modelProp', varName: mpb.varName, signal: mpb.signal, attr: camelToKebab(mpb.propName) });
  }

  // ── Phase 4: Process child component prop bindings ──
  const childComponents = parseResult.childComponents || [];
  for (const cc of childComponents) {
    for (const pb of (cc.propBindings || [])) {
      let expr;
      if (pb.type === 'constant') {
        expr = `this._const_${pb.expr}`;
      } else {
        expr = transformExpr(pb.expr, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
      }
      if (pb.type === 'prop' || pb.type === 'computed' || pb.type === 'signal') {
        addDep(pb.expr, { type: 'childProp', varName: cc.varName, attr: pb.attr, expr });
      } else if (pb.type === 'constant') {
        // Constant deps need their own key — they're static, not tracked
        addDep(pb.expr, { type: 'childProp', varName: cc.varName, attr: pb.attr, expr });
      }
    }
  }

  // ── Phase 4: Process dynamic components ──
  const dynamicComponents = parseResult.dynamicComponents || [];
  for (let idx = 0; idx < dynamicComponents.length; idx++) {
    const dyn = dynamicComponents[idx];
    const tagDeps = extractDeps(dyn.isExpression, signalNames, propNames, modelDefs);
    for (const dep of tagDeps) {
      addDep(dep, { type: 'renderDynamic', dynIndex: idx });
    }
    // External prop signals: guarded updates
    for (const prop of dyn.props) {
      const propDeps = extractDeps(prop.expression, signalNames, propNames, modelDefs);
      for (const pd of propDeps) {
        if (tagDeps.has(pd)) continue; // Same as tag signal, renderDynamic handles it
        const expr = transformExpr(prop.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        addDep(pd, { type: 'childProp', varName: `__dyn${idx}_current`, attr: prop.attr, expr, dynGuard: true });
      }
    }
  }

  return { depGraph, effectBindings };
}

/**
 * Generate a DOM update operation for a DepEntry inside the __invalidate switch.
 *
 * @param {DepEntry} entry — The dependency entry
 * @param {string[]} lines — Output lines array
 * @param {string} indent — Indentation prefix
 */
function generateUpdateOp(entry, lines, indent) {
  // Helper: wrap operation in a for-loop if entry is for each-block items
  function eachForOpen() {
    if (entry.eachBlockIndex !== undefined) {
      lines.push(`${indent}for (let __i = 0; __i < this.__for${entry.eachBlockIndex}_nodes.length; __i++) {`);
    }
  }
  function eachForClose() {
    if (entry.eachBlockIndex !== undefined) {
      lines.push(`${indent}}`);
    }
  }
  // Build the node reference for each-block items
  const nodeRef = entry.eachBlockIndex !== undefined
    ? `this.__for${entry.eachBlockIndex}_nodes[__i]`
    : `this.${entry.varName}`;

  switch (entry.type) {
    case 'text':
      if (entry.ifPathExpr) {
        lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
        lines.push(`${indent}  ${entry.ifPathExpr}.textContent = ${wrapTernaryExpr(entry.expr)} ?? '';`);
        lines.push(`${indent}}`);
      } else if (entry.eachBlockIndex !== undefined) {
        eachForOpen();
        lines.push(`${indent}  ${nodeRef}.textContent = ${wrapTernaryExpr(entry.expr)} ?? '';`);
        eachForClose();
      } else {
        lines.push(`${indent}this.${entry.varName}.textContent = ${wrapTernaryExpr(entry.expr)} ?? '';`);
      }
      break;
    case 'show':
      if (entry.ifPathExpr) {
        lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
        lines.push(`${indent}  ${entry.ifPathExpr}.style.display = (${entry.expr}) ? '' : 'none';`);
        lines.push(`${indent}}`);
      } else if (entry.eachBlockIndex !== undefined) {
        eachForOpen();
        lines.push(`${indent}  ${nodeRef}.style.display = (${entry.expr}) ? '' : 'none';`);
        eachForClose();
      } else {
        lines.push(`${indent}this.${entry.varName}.style.display = (${entry.expr}) ? '' : 'none';`);
      }
      break;
    case 'attr':
      if (entry.ifPathExpr) {
        lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
        lines.push(`${indent}  const __v = ${entry.expr};`);
        lines.push(`${indent}  if (__v || __v === '') { ${entry.ifPathExpr}.setAttribute('${entry.attr}', __v); }`);
        lines.push(`${indent}  else { ${entry.ifPathExpr}.removeAttribute('${entry.attr}'); }`);
        lines.push(`${indent}}`);
      } else if (entry.eachBlockIndex !== undefined) {
        eachForOpen();
        lines.push(`${indent}  const __v = ${entry.expr};`);
        lines.push(`${indent}  if (__v || __v === '') { ${nodeRef}.setAttribute('${entry.attr}', __v); }`);
        lines.push(`${indent}  else { ${nodeRef}.removeAttribute('${entry.attr}'); }`);
        eachForClose();
      } else {
        lines.push(`${indent}{ const __v = ${entry.expr};`);
        lines.push(`${indent}  if (__v || __v === '') { this.${entry.varName}.setAttribute('${entry.attr}', __v); }`);
        lines.push(`${indent}  else { this.${entry.varName}.removeAttribute('${entry.attr}'); } }`);
      }
      break;
    case 'bool':
      if (entry.ifPathExpr) {
        lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
        lines.push(`${indent}  ${entry.ifPathExpr}.${entry.attr} = !!(${entry.expr});`);
        lines.push(`${indent}}`);
      } else if (entry.eachBlockIndex !== undefined) {
        eachForOpen();
        lines.push(`${indent}  ${nodeRef}.${entry.attr} = !!(${entry.expr});`);
        eachForClose();
      } else {
        lines.push(`${indent}this.${entry.varName}.${entry.attr} = !!(${entry.expr});`);
      }
      break;
    case 'class':
      if (entry.subKind === 'object') {
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? ${entry.ifPathExpr}.classList.add(__k) : ${entry.ifPathExpr}.classList.remove(__k);`);
          lines.push(`${indent}  }`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
          lines.push(`${indent}  }`);
          eachForClose();
        } else {
          lines.push(`${indent}{ const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? this.${entry.varName}.classList.add(__k) : this.${entry.varName}.classList.remove(__k);`);
          lines.push(`${indent}  } }`);
        }
      } else if (entry.subKind === 'array') {
        const staticPrefix = entry.staticValue ? `'${entry.staticValue} ' + ` : '';
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  ${entry.ifPathExpr}.className = ${staticPrefix}(${entry.expr}).join(' ');`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  ${nodeRef}.className = ${staticPrefix}(${entry.expr}).join(' ');`);
          eachForClose();
        } else {
          lines.push(`${indent}this.${entry.varName}.className = ${staticPrefix}(${entry.expr}).join(' ');`);
        }
      } else {
        const staticPrefix = entry.staticValue ? `'${entry.staticValue} ' + ` : '';
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  ${entry.ifPathExpr}.className = ${staticPrefix}${wrapTernaryExpr(entry.expr)};`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(entry.expr)};`);
          eachForClose();
        } else {
          lines.push(`${indent}this.${entry.varName}.className = ${staticPrefix}${wrapTernaryExpr(entry.expr)};`);
        }
      }
      break;
    case 'style':
      if (entry.subKind === 'object') {
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    ${entry.ifPathExpr}.style[__k] = __val;`);
          lines.push(`${indent}  }`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    ${nodeRef}.style[__k] = __val;`);
          lines.push(`${indent}  }`);
          eachForClose();
        } else {
          lines.push(`${indent}{ const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    this.${entry.varName}.style[__k] = __val;`);
          lines.push(`${indent}  } }`);
        }
      } else {
        const staticPrefix = entry.staticValue ? `'${entry.staticValue}; ' + ` : '';
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  ${entry.ifPathExpr}.style.cssText = ${staticPrefix}${entry.expr};`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  ${nodeRef}.style.cssText = ${staticPrefix}${entry.expr};`);
          eachForClose();
        } else {
          lines.push(`${indent}this.${entry.varName}.style.cssText = ${staticPrefix}${entry.expr};`);
        }
      }
      break;
    case 'computed':
      lines.push(`${indent}this._state.${entry.computedName} = ${entry.expr};`);
      break;
    case 'renderIf':
      lines.push(`${indent}this.__renderIf_${entry.ifBlockIndex}();`);
      break;
    case 'renderEach':
      lines.push(`${indent}this.__renderEach_${entry.eachBlockIndex}();`);
      break;
    case 'renderDynamic':
      lines.push(`${indent}this.__renderDynamic_${entry.dynIndex}();`);
      break;
    case 'modelValue':
      lines.push(`${indent}this.${entry.varName}.value = this._state.${entry.signal} ?? '';`);
      break;
    case 'modelCheckbox':
      lines.push(`${indent}this.${entry.varName}.checked = !!this._state.${entry.signal};`);
      break;
    case 'modelRadio':
      lines.push(`${indent}this.${entry.varName}.checked = (this._state.${entry.signal} === '${entry.radioValue}');`);
      break;
    case 'modelProp':
      lines.push(`${indent}if (this.${entry.varName}) this.${entry.varName}.setAttribute('${entry.attr}', this._state.${entry.signal} ?? '');`);
      break;
    case 'childProp':
      lines.push(`${indent}if (this.${entry.varName}) {`);
      lines.push(`${indent}  const __v = ${entry.expr};`);
      lines.push(`${indent}  if (__v || __v === '') { this.${entry.varName}.setAttribute('${entry.attr}', __v); }`);
      lines.push(`${indent}  else { this.${entry.varName}.removeAttribute('${entry.attr}'); }`);
      lines.push(`${indent}}`);
      break;
    case 'watcher':
      if (entry.initOnly) {
        // Initialize old value without calling callback (used only in case '*')
        if (entry.watcherKind === 'signal') {
          lines.push(`${indent}this.${entry.prevName} = this._state.${entry.watcherTarget};`);
        } else {
          lines.push(`${indent}this.${entry.prevName} = ${entry.getterExpr};`);
        }
      } else {
        // Runtime watcher invocation
        if (entry.watcherKind === 'signal') {
          lines.push(`${indent}if (this.${entry.prevName} !== undefined && this.${entry.prevName} !== this._state.${entry.watcherTarget}) {`);
          lines.push(`${indent}  const ${entry.newParam} = this._state.${entry.watcherTarget};`);
          if (entry.oldParam) {
            lines.push(`${indent}  const ${entry.oldParam} = this.${entry.prevName};`);
          }
          const bodyLines = entry.expr ? entry.expr.trim().split('\n') : [];
          for (const line of bodyLines) {
            lines.push(`${indent}  ${line}`);
          }
          lines.push(`${indent}}`);
          lines.push(`${indent}this.${entry.prevName} = this._state.${entry.watcherTarget};`);
        } else {
          // Getter watcher
          lines.push(`${indent}if (this.${entry.prevName} !== undefined) {`);
          lines.push(`${indent}  const ${entry.newParam} = ${entry.getterExpr};`);
          lines.push(`${indent}  if (this.${entry.prevName} !== ${entry.newParam}) {`);
          if (entry.oldParam) {
            lines.push(`${indent}    const ${entry.oldParam} = this.${entry.prevName};`);
          }
          const bodyLines = entry.expr ? entry.expr.trim().split('\n') : [];
          for (const line of bodyLines) {
            lines.push(`${indent}    ${line}`);
          }
          lines.push(`${indent}  }`);
          lines.push(`${indent}  this.${entry.prevName} = ${entry.newParam};`);
          lines.push(`${indent}}`);
        }
      }
      break;
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

  // Build the dependency graph to classify bindings BEFORE computing needsEffect
  const transformContext = {
    signalNames, computedNames, propNames, propDefs, modelDefs, modelVarMap,
    propsObjectName, emitsObjectName, constantNames, methodNames
  };
  const { depGraph, effectBindings: classifiedEffectBindings } = buildDepGraph(parseResult, transformContext);

  // Determine which runtime functions this component needs
  // Phase 4: ALL features migrated to __invalidate — no __effect needed
  const needsEffect = false;
  const needsComputed = false;  // Phase 2: computeds use inline recalculation
  const needsUntrack = false;   // Phase 2: watchers use direct comparison
  const needsBatch = false;     // Phase 4: batch is per-component method (no runtime needed)

  if (options.runtimeImportPath) {
    // Tree-shake: only import what this component actually uses
    const usedRuntime = new Set();
    if (needsComputed) usedRuntime.add('__computed');
    if (needsEffect) usedRuntime.add('__effect');
    if (needsBatch) usedRuntime.add('__batch');
    if (needsUntrack) usedRuntime.add('__untrack');
     // When the Proxy get trap is generated (needsEffect) or batch/computed needs globals
    if (needsEffect || needsComputed || needsBatch) {
      usedRuntime.add('__currentEffect');
      usedRuntime.add('__batchDepth');
      usedRuntime.add('__pendingEffects');
    }
    if (usedRuntime.size > 0) {
      const imports = [...usedRuntime].join(', ');
      lines.push(`import { ${imports} } from '${options.runtimeImportPath}';`);
    }
  } else {
    // Standalone: inline only the runtime functions this component needs
    lines.push(buildInlineRuntime({ needsSignal: false, needsComputed, needsEffect, needsBatch, needsUntrack }).trim());
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

  // Phase 4: Per-component batch state (replaces shared __batch runtime)
  if (usesBatch) {
    lines.push('    this.__batching = false;');
    lines.push('    this.__batchKeys = new Set();');
  }

  // ── Proxy state container ──
  // Collect initial state entries from props, signals, models, and computeds
  const stateEntries = [];
  for (const p of propDefs) {
    stateEntries.push(`${p.name}: ${p.default}`);
  }
  for (const s of signals) {
    stateEntries.push(`${s.name}: ${s.value}`);
  }
  for (const md of modelDefs) {
    stateEntries.push(`${md.name}: ${md.default}`);
  }
  // Phase 2: computed values stored in _state alongside signals
  for (const c of computeds) {
    stateEntries.push(`${c.name}: undefined`);
  }

  // Phase 4: All features migrated — only set trap needed (no effect subscribers)
  if (stateEntries.length > 0) {
    lines.push('    const self = this;');
    lines.push('    this._state = new Proxy(');
    lines.push(`      { ${stateEntries.join(', ')} },`);
    lines.push('      {');
    lines.push('        set(target, key, value) {');
    lines.push('          if (target[key] === value) return true;');
    lines.push('          target[key] = value;');
    if (usesBatch) {
      lines.push('          if (self.__batching) {');
      lines.push('            self.__batchKeys.add(key);');
      lines.push('          } else {');
      lines.push('            self.__invalidate(key);');
      lines.push('          }');
    } else {
      lines.push('          self.__invalidate(key);');
    }
    lines.push('          return true;');
    lines.push('        }');
    lines.push('      }');
    lines.push('    );');
  }

  // Constant initialization
  for (const c of constantVars) {
    // Transform the constant value to rewrite signal/computed/method references
    const transformedValue = transformMethodBody(c.value, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, [], constantNames, modelVarMap, methodNames);
    lines.push(`    this._const_${c.name} = ${transformedValue};`);
  }

  // Phase 2: Computed values stored in _state with inline recalculation
  if (computeds.length > 0) comment('Computed initial values (topological order)');
  {
    const computedNamesSet = new Set(computeds.map(c => c.name));
    const topoOrder = topologicalSortComputeds(
      computeds.map(c => ({ name: c.name, deps: extractComputedDeps(c.body, signalNames, computedNames) })),
      computedNamesSet
    );
    for (const cName of topoOrder) {
      const cDef = computeds.find(c => c.name === cName);
      if (cDef) {
        const body = transformExpr(cDef.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`    this._state.${cName} = ${body};`);
      }
    }
  }

  // Watcher prev-value initialization (use signal initial values)
  for (let idx = 0; idx < watchers.length; idx++) {
    const w = watchers[idx];
    if (w.kind === 'signal') {
      if (propNames.has(w.target)) {
        const propDef = propDefs.find(p => p.name === w.target);
        lines.push(`    this.__prev_${w.target} = ${propDef ? propDef.default : 'undefined'};`);
      } else if (signalNames.includes(w.target)) {
        const sigDef = signals.find(s => s.name === w.target);
        lines.push(`    this.__prev_${w.target} = ${sigDef ? sigDef.value : 'undefined'};`);
      } else {
        lines.push(`    this.__prev_${w.target} = undefined;`);
      }
    } else {
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

  // ── each: template creation, anchor reference, nodes array, items array ──
  for (const forBlock of forBlocks) {
    const vn = forBlock.varName;
    lines.push(`    this.${vn}_tpl = document.createElement('template');`);
    lines.push(`    this.${vn}_tpl.innerHTML = \`${forBlock.templateHtml}\`;`);
    lines.push(`    this.${vn}_anchor = ${pathExpr(forBlock.anchorPath, '__root')};`);
    lines.push(`    this.${vn}_nodes = [];`);
    lines.push(`    this.${vn}_items = [];`);
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

  // Phase 4: Zero runtime — no __effect, no __disposers, no get trap needed
  lines.push('    this.__ac = new AbortController();');
  lines.push('');

  // Phase 4: Static constant bindings (no __effect needed, __invalidate handles everything)
  for (const b of bindings) {
    if (b.type === 'constant') {
      const constDef = constantVars.find(c => c.name === b.name);
      const isFunction = constDef && /^\s*(\(|function\b)/.test(constDef.value);
      if (!isFunction) {
        lines.push(`    this.${b.varName}.textContent = this._const_${b.name} ?? '';`);
      }
    }
  }

  // Phase 4: Scoped slots handled by __invalidate. No __effect needed.
  // Scoped slot event listeners and token replacement are done in __invalidate cases.

  // Phase 4: Child component prop bindings handled by __invalidate

  // Phase 4: User effects removed — error emitted at compile time if effects.length > 0
  if (effects.length > 0) {
    throw new Error('effect() has been removed. Use watch() for reactive side effects.');
  }

  // Phase 2: Watchers are now handled by __invalidate. No __effect wrappers needed.
  // Old-value tracking is initialized in the constructor.
  // Watcher callbacks are invoked from __invalidate cases.

  // Event listeners (with AbortController signal for cleanup)
  if (events.length > 0) comment('Event listeners');
  for (const e of events) {
    const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
    lines.push(`    if (this.${e.varName}) this.${e.varName}.addEventListener('${e.event}', ${handlerExpr}, { signal: this.__ac.signal });`);
  }

  // Show effects — only for show bindings that remain in __effect
  if (classifiedEffectBindings.show.length > 0) comment('Show directives (effect)');
  for (const sb of classifiedEffectBindings.show) {
    const expr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
    lines.push('    this.__disposers.push(__effect(() => {');
    lines.push(`      this.${sb.varName}.style.display = (${expr}) ? '' : 'none';`);
    lines.push('    }));');
  }

  // Phase 4: Model bindings (signal → DOM) handled by __invalidate cases.
  // Only model event listeners (DOM → signal) stay in connectedCallback.

  // Model event listeners — DOM → signal (with AbortController signal)
  for (const mb of modelBindings) {
    const assign = modelVarMap.has(mb.signal)
      ? `this._modelSet_${mb.signal}(`
      : `this._state.${mb.signal} = `;
    if (mb.prop === 'checked' && mb.radioValue === null) {
      // Checkbox: read e.target.checked
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { ${assign}e.target.checked${modelVarMap.has(mb.signal) ? ')' : ';' } }, { signal: this.__ac.signal });`);
    } else if (mb.coerce) {
      // Number input: wrap in Number()
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { ${assign}Number(e.target.value)${modelVarMap.has(mb.signal) ? ')' : ';' } }, { signal: this.__ac.signal });`);
    } else {
      // All others: read e.target.value
      lines.push(`    if (this.${mb.varName}) this.${mb.varName}.addEventListener('${mb.event}', (e) => { ${assign}e.target.value${modelVarMap.has(mb.signal) ? ')' : ';' } }, { signal: this.__ac.signal });`);
    }
  }

  // Phase 4: model:propName effects handled by __invalidate.
  // Only child → parent wcc:model listener stays in connectedCallback.
  for (const mpb of modelPropBindings) {
    const attrName = camelToKebab(mpb.propName);

    // Child → parent sync: listen for wcc:model on child, update parent signal
    lines.push(`    this.${mpb.varName}.addEventListener('wcc:model', (e) => {`);
    lines.push(`      if (e.detail.prop === '${mpb.propName}') {`);
    const isModelVar = modelVarMap.has(mpb.signal);
    if (isModelVar) {
      lines.push(`        this._state.${modelVarMap.get(mpb.signal)} = e.detail.value;`);
    } else {
      lines.push(`        this._state.${mpb.signal} = e.detail.value;`);
    }
    lines.push('      }');
    lines.push('    }, { signal: this.__ac.signal });');
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

  // Initial render of all bindings via __invalidate
  if (depGraph.size > 0) {
    lines.push("    this.__invalidate('*');");
  }

  // Close connectedCallback
  lines.push('  }');
  lines.push('');

  // disconnectedCallback (cleanup: abort listeners)
  lines.push('  disconnectedCallback() {');
  lines.push('    this.__connected = false;');
  lines.push('    this.__ac.abort();');
  // Lifecycle: onDestroy hooks
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
        updateExpr = `this._state.${p.name} = newVal != null`;
      } else if (/^-?\d+(\.\d+)?$/.test(defaultVal)) {
        // Number coercion
        updateExpr = `this._state.${p.name} = newVal != null ? Number(newVal) : ${defaultVal}`;
      } else if (defaultVal === 'undefined') {
        // Undefined default — pass through
        updateExpr = `this._state.${p.name} = newVal`;
      } else {
        // String default — use nullish coalescing
        updateExpr = `this._state.${p.name} = newVal ?? ${defaultVal}`;
      }

      lines.push(`    if (name === '${p.attrName}') ${updateExpr};`);
    }

    // Model props — update state directly (NO event emission)
    for (let i = 0; i < modelDefs.length; i++) {
      const md = modelDefs[i];
      const attrName = modelAttrNames[i];
      const camelName = md.name;
      const defaultVal = md.default;
      let updateExpr;

      if (defaultVal === 'true' || defaultVal === 'false') {
        // Boolean coercion: attribute presence = true
        updateExpr = `this._state.${md.name} = newVal != null`;
      } else if (/^-?\d+(\.\d+)?$/.test(defaultVal)) {
        // Number coercion
        updateExpr = `this._state.${md.name} = newVal != null ? Number(newVal) : ${defaultVal}`;
      } else if (defaultVal === 'undefined') {
        // Undefined default — pass through
        updateExpr = `this._state.${md.name} = newVal`;
      } else {
        // String default — use nullish coalescing
        updateExpr = `this._state.${md.name} = newVal ?? ${defaultVal}`;
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
      lines.push(`  get ${p.name}() { return this._state.${p.name}; }`);
      lines.push(`  set ${p.name}(val) { this._state.${p.name} = val; this.setAttribute('${p.attrName}', String(val)); }`);
      lines.push('');
    }

    // Public getters and setters for model props
    for (let i = 0; i < modelDefs.length; i++) {
      const md = modelDefs[i];
      const attrName = modelAttrNames[i];
      lines.push(`  get ${md.name}() { return this._state.${md.name}; }`);
      lines.push(`  set ${md.name}(val) { this._state.${md.name} = val; this.setAttribute('${attrName}', String(val)); }`);
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
  //   3. propNameChange — camelCase for Angular [(prop)] two-way binding
  for (const md of modelDefs) {
    // Convert camelCase to kebab-case for event name (e.g., userName → user-name-changed)
    const eventName = md.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '-changed';
    // Angular [(prop)] expects propNameChange (e.g., countChange, labelChange)
    const angularEventName = md.name + 'Change';
    lines.push(`  _modelSet_${md.name}(newVal) {`);
    lines.push(`    const oldVal = this._state.${md.name};`);
    lines.push(`    this._state.${md.name} = newVal;`);
    lines.push(`    this.dispatchEvent(new CustomEvent('wcc:model', {`);
    lines.push(`      detail: { prop: '${md.name}', value: newVal, oldValue: oldVal },`);
    lines.push(`      bubbles: true,`);
    lines.push(`      composed: true`);
    lines.push(`    }));`);
    lines.push(`    this.dispatchEvent(new CustomEvent('${eventName}', { detail: newVal, bubbles: true }));`);
    lines.push(`    this.dispatchEvent(new CustomEvent('${angularEventName}', { detail: newVal, bubbles: true }));`);
    lines.push('  }');
    lines.push('');
  }

  // Wrapper methods for defineModel signals (dual getter/setter)
  // These act as the interface between template code and internal signals
  // - As getter (no args): returns state value
  // - As setter (with arg): calls _modelSet_* to update and dispatch events
  if (modelDefs.length > 0) {
    lines.push('  // --- Model wrapper methods ---');
    for (const md of modelDefs) {
      lines.push(`  _${md.name}(val) {`);
      lines.push(`    if (arguments.length === 0) {`);
      lines.push(`      return this._state.${md.name};`);
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

  // Phase 4: Per-component batch method (replaces shared __batch runtime)
  if (usesBatch) {
    lines.push('  __batch(fn) {');
    lines.push('    this.__batching = true;');
    lines.push('    try { fn(); } finally {');
    lines.push('      this.__batching = false;');
    lines.push('      for (const key of this.__batchKeys) {');
    lines.push('        this.__invalidate(key);');
    lines.push('      }');
    lines.push('      this.__batchKeys.clear();');
    lines.push('    }');
    lines.push('  }');
    lines.push('');
  }

  // User methods (prefixed with _)
  if (methods.length > 0 && options.comments) lines.push('');
  if (methods.length > 0 && options.comments) lines.push('  // --- Methods ---');
  for (const m of methods) {
    const body = transformMethodBody(m.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
    const asyncPrefix = m.async ? 'async ' : '';
    lines.push(`  ${asyncPrefix}_${m.name}(${m.params}) {`);
    const bodyLines = body.split('\n');
    for (const line of bodyLines) {
      lines.push(`    ${line}`);
    }
    lines.push('  }');
    lines.push('');
  }

  // ── __invalidate(key) method ──
  if (depGraph.size > 0) {
    // Phase 2 ordering constants for sorting entries within each case
    const typeOrder = { computed: 0, renderIf: 1, renderEach: 1, renderDynamic: 1, text: 2, show: 2, attr: 2, bool: 2, class: 2, style: 2, watcher: 3, modelValue: 2, modelCheckbox: 2, modelRadio: 2, modelProp: 2, childProp: 2 };

    lines.push('  __invalidate(key) {');
    // Watchers, computeds, and renderIf can fire before connected (for pre-connection attribute changes).
    // DOM bindings (text, show, attr, etc.) need guard since DOM refs don't exist yet.
    lines.push('    switch(key) {');

    for (const [signalKey, entries] of depGraph) {
      const sorted = [...entries].sort((a, b) => (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2));
      const hasRender = sorted.some(e => e.type === 'renderEach' || e.type === 'renderIf');
      const hasDomOps = sorted.some(e => e.type !== 'computed' && e.type !== 'renderIf' && e.type !== 'renderEach' && e.type !== 'renderDynamic' && e.type !== 'watcher');
      const hasNonDomOps = sorted.some(e => e.type === 'computed' || e.type === 'renderIf' || e.type === 'renderEach' || e.type === 'renderDynamic' || e.type === 'watcher');
      lines.push(`      case '${signalKey}':`);
      if (hasDomOps && hasNonDomOps) {
        // Mixed: guard DOM ops, always run non-DOM
        lines.push('        // Non-DOM ops (computeds, renderIf, watchers) always run');
        for (const entry of sorted) {
          if (entry.type === 'computed' || entry.type === 'renderIf' || entry.type === 'renderEach' || entry.type === 'renderDynamic' || entry.type === 'watcher') {
            generateUpdateOp(entry, lines, '        ');
          }
        }
        lines.push('        if (this.__connected) {');
        for (const entry of sorted) {
          if (entry.type !== 'computed' && entry.type !== 'renderIf' && entry.type !== 'renderEach' && entry.type !== 'renderDynamic' && entry.type !== 'watcher') {
            // Skip per-node eachBlockIndex updates when renderEach handles the full re-render
            if (hasRender && entry.eachBlockIndex !== undefined) continue;
            generateUpdateOp(entry, lines, '          ');
          }
        }
        lines.push('        }');
      } else if (hasDomOps) {
        // Only DOM ops: guard the whole block
        lines.push('        if (this.__connected) {');
        for (const entry of sorted) {
          generateUpdateOp(entry, lines, '          ');
        }
        lines.push('        }');
      } else {
        // Only non-DOM ops: no guard needed
        for (const entry of sorted) {
          generateUpdateOp(entry, lines, '        ');
        }
      }
      lines.push('        break;');
    }

    // Wildcard case: all unique operations, ordered and deduplicated
    lines.push("      case '*':");
    const seenOps = new Set();

    // Helper to add a deduplicated op
    const addSeenOp = (entry, extraKey = '') => {
      const opKey = `${entry.type}:${entry.varName || ''}:${entry.expr || ''}:${extraKey}`;
      if (!seenOps.has(opKey)) {
        seenOps.add(opKey);
        generateUpdateOp(entry, lines, '        ');
      }
    };

    // ── Phase 2: computed recalculations (topological order) ──
    if (computeds.length > 0) {
      const computedNamesSet = new Set(computeds.map(c => c.name));
      const topoOrder = topologicalSortComputeds(
        computeds.map(c => ({ name: c.name, deps: extractComputedDeps(c.body, signalNames, computedNames) })),
        computedNamesSet
      );
      for (const cName of topoOrder) {
        const cDef = computeds.find(c => c.name === cName);
        if (cDef) {
          const transformedExpr = transformExpr(cDef.body, signalNames, computedNames,
            propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
          addSeenOp({ type: 'computed', computedName: cName, expr: transformedExpr }, cName);
        }
      }
    }

    // ── renderIf calls (for all if-blocks) ──
    for (let idx = 0; idx < ifBlocks.length; idx++) {
      addSeenOp({ type: 'renderIf', ifBlockIndex: idx }, `if${idx}`);
    }

    // ── Phase 3: renderEach calls (for all each-blocks) ──
    for (let idx = 0; idx < forBlocks.length; idx++) {
      addSeenOp({ type: 'renderEach', eachBlockIndex: idx }, `for${idx}`);
    }

    // ── Phase 4: renderDynamic calls (for all dynamic components) ──
    for (let idx = 0; idx < dynamicComponents.length; idx++) {
      addSeenOp({ type: 'renderDynamic', dynIndex: idx }, `dyn${idx}`);
    }

    // ── Simple bindings (deduplicated from depGraph) ──
    // Check if any renderEach/rerenderIf entries exist to avoid destructive per-node updates
    const hasRerender = [...depGraph.values()].some(entries =>
      entries.some(e => e.type === 'renderEach' || e.type === 'renderIf')
    );
    for (const [, entries] of depGraph) {
      for (const entry of entries) {
        if (entry.type === 'computed' || entry.type === 'renderIf' || entry.type === 'renderEach' || entry.type === 'renderDynamic' || entry.type === 'watcher') continue;
        // Skip per-node eachBlockIndex updates when renderEach handles the full re-render
        if (hasRerender && entry.eachBlockIndex !== undefined) continue;
        const opKey = `${entry.type}:${entry.varName || ''}:${entry.expr || ''}`;
        if (!seenOps.has(opKey)) {
          seenOps.add(opKey);
          generateUpdateOp(entry, lines, '        ');
        }
      }
    }

    // ── Watcher old-value initialization (NO callbacks) ──
    for (let idx = 0; idx < watchers.length; idx++) {
      const w = watchers[idx];
      if (w.kind === 'signal') {
        addSeenOp({ type: 'watcher', watcherIndex: idx, watcherKind: 'signal', watcherTarget: w.target, prevName: `__prev_${w.target}`, initOnly: true }, `winit${idx}`);
      } else {
        const getterExpr = transformMethodBody(w.target, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, [], constantNames, modelVarMap, methodNames);
        addSeenOp({ type: 'watcher', watcherIndex: idx, watcherKind: 'getter', prevName: `__prev_watch${idx}`, getterExpr, initOnly: true }, `winit${idx}`);
      }
    }

    lines.push('        break;');

    lines.push('    }');
    lines.push('  }');
    lines.push('');
  } else if (stateEntries.length > 0) {
    // Always generate minimal __invalidate for Proxy set trap compatibility
    lines.push('  __invalidate(key) {');
    lines.push('    // No reactive bindings — proxy set trap calls this as no-op');
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
      lines.push(`  get ${name}() { return this._state.${name}; }`);
    } else if (signalNames.includes(name)) {
      lines.push(`  get ${name}() { return this._state.${name}; }`);
    } else if (methodNames.includes(name)) {
      lines.push(`  ${name}(...args) { return this._${name}(...args); }`);
    } else if (constantNames.includes(name)) {
      lines.push(`  get ${name}() { return this._const_${name}; }`);
    }
  }
  if (exposeNames.length > 0) lines.push('');

  // ── Phase 2: __renderIf_N methods ──
  for (let idx = 0; idx < ifBlocks.length; idx++) {
    const ifBlock = ifBlocks[idx];
    const vn = ifBlock.varName;
    lines.push(`  __renderIf_${idx}() {`);
    lines.push('    let __branch = null;');
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      if (branch.type === 'if') {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`    if (${expr}) { __branch = ${i}; }`);
      } else if (branch.type === 'else-if') {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`    else if (${expr}) { __branch = ${i}; }`);
      } else {
        lines.push(`    else { __branch = ${i}; }`);
      }
    }
    lines.push(`    if (__branch === this.${vn}_active) return;`);
    lines.push(`    if (this.${vn}_current) { this.${vn}_current.remove(); this.${vn}_current = null; }`);
    lines.push('    if (__branch !== null) {');
    const tplArray = ifBlock.branches.map((_, i) => `this.${vn}_t${i}`).join(', ');
    lines.push(`      const tpl = [${tplArray}][__branch];`);
    lines.push('      const clone = tpl.content.cloneNode(true);');
    lines.push('      const node = clone.firstChild;');
    lines.push(`      this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
    lines.push('      customElements.upgrade(node);');
    lines.push(`      this.${vn}_current = node;`);
    // Setup bindings/events for active branch
    const hasSetup = ifBlock.branches.some(b =>
      (b.events && b.events.length > 0) ||
      (b.forBlocks && b.forBlocks.length > 0) ||
      (b.dynamicComponents && b.dynamicComponents.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0)
    );
    if (hasSetup) {
      lines.push(`      this.${vn}_setup(node, __branch);`);
    }
    lines.push('    }');
    lines.push(`    this.${vn}_active = __branch;`);
    lines.push('  }');
    lines.push('');
  }

  // ── Phase 3: __renderEach_N methods ──
  for (let idx = 0; idx < forBlocks.length; idx++) {
    const forBlock = forBlocks[idx];
    const vn = forBlock.varName;
    const { itemVar, indexVar, source, keyExpr } = forBlock;

    const signalNamesSet = new Set(signalNames);
    const computedNamesSet = new Set(computedNames);
    const sourceExpr = transformForExpr(source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames);

    lines.push(`  __renderEach_${idx}() {`);
    lines.push(`    const __source = ${sourceExpr};`);
    lines.push('    const __iter = typeof __source === \'number\'');
    lines.push('      ? Array.from({ length: __source }, (_, i) => i + 1)');
    lines.push('      : (__source || []);');
    lines.push('');

    if (keyExpr) {
      // ── Keyed reconciliation ──
      lines.push(`    const __oldMap = this.${vn}_keyMap || new Map();`);
      lines.push('    const __newMap = new Map();');
      lines.push('    const __newNodes = [];');
      lines.push('    const __newItems = [];');
      lines.push('');
      lines.push(`    __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`      const __key = ${keyExpr};`);
      lines.push('      if (__oldMap.has(__key)) {');
      lines.push('        __oldMap.get(__key).remove();');
      lines.push('      }');
      lines.push(`      const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push('      const node = clone.firstChild;');
      // Internal bindings, events, attr, model, nested features
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames, modelVarMap);
      lines.push(`      __newMap.set(__key, node);`);
      lines.push('      __newNodes.push(node);');
      lines.push(`      __newItems.push(${itemVar});`);
      lines.push('    });');
      lines.push('');
      lines.push('    for (const n of __oldMap.values()) n.remove();');
      lines.push('');
      lines.push(`    for (const n of __newNodes) { this.${vn}_anchor.parentNode.insertBefore(n, this.${vn}_anchor); customElements.upgrade(n); }`);
      lines.push(`    this.${vn}_nodes = __newNodes;`);
      lines.push(`    this.${vn}_items = __newItems;`);
      lines.push(`    this.${vn}_keyMap = __newMap;`);
    } else {
      // ── Non-keyed: destroy and recreate ──
      lines.push(`    for (const n of this.${vn}_nodes) n.remove();`);
      lines.push(`    this.${vn}_nodes = [];`);
      lines.push(`    this.${vn}_items = [];`);
      lines.push('');
      lines.push(`    __iter.forEach((${itemVar}, ${indexVar || '__idx'}) => {`);
      lines.push(`      const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push('      const node = clone.firstChild;');
      // Internal bindings, events, attr, model, nested features
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet, methodNames, constantNames, modelVarMap);
      lines.push(`      this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
      lines.push('      customElements.upgrade(node);');
      lines.push(`      this.${vn}_nodes.push(node);`);
      lines.push(`      this.${vn}_items.push(${itemVar});`);
      lines.push('    });');
    }
    lines.push('  }');
    lines.push('');
  }

  // ── Phase 4: __renderDynamic_N methods ──
  for (let idx = 0; idx < dynamicComponents.length; idx++) {
    const dyn = dynamicComponents[idx];
    const vn = dyn.varName;
    const isExpr = transformExpr(dyn.isExpression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

    lines.push(`  __renderDynamic_${idx}() {`);
    lines.push(`    const __tag = ${isExpr};`);
    lines.push(`    if (__tag === this.${vn}_tag) return;`);
    lines.push(`    if (this.${vn}_current) {`);
    lines.push(`      this.${vn}_current.remove();`);
    lines.push(`      this.${vn}_current = null;`);
    lines.push('    }');
    lines.push('    if (__tag) {');
    lines.push('      const el = document.createElement(__tag);');
    for (const prop of dyn.props) {
      const propExpr = transformExpr(prop.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
      lines.push(`      el.setAttribute('${prop.attr}', ${propExpr} ?? '');`);
    }
    for (const evt of dyn.events) {
      const handlerExpr = generateEventHandler(evt.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
      lines.push(`      el.addEventListener('${evt.event}', ${handlerExpr});`);
    }
    lines.push(`      this.${vn}_anchor.parentNode.insertBefore(el, this.${vn}_anchor);`);
    lines.push('      customElements.upgrade(el);');
    lines.push(`      this.${vn}_current = el;`);
    lines.push('    }');
    lines.push(`    this.${vn}_tag = __tag;`);
    lines.push('  }');
    lines.push('');
  }

  // ── if setup methods (Phase 2: simplified — simple bindings via __invalidate) ──
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    const hasSetup = ifBlock.branches.some(b =>
      (b.events && b.events.length > 0) ||
      (b.modelBindings && b.modelBindings.length > 0) ||
      (b.forBlocks && b.forBlocks.length > 0) ||
      (b.dynamicComponents && b.dynamicComponents.length > 0)
    );
    if (!hasSetup) continue;

    lines.push(`  ${vn}_setup(node, branch) {`);
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      const hasBranchSetup =
        (branch.events && branch.events.length > 0) ||
        (branch.modelBindings && branch.modelBindings.length > 0) ||
        (branch.forBlocks && branch.forBlocks.length > 0) ||
        (branch.dynamicComponents && branch.dynamicComponents.length > 0);
      if (!hasBranchSetup) continue;

      const keyword = i === 0 ? 'if' : 'else if';
      lines.push(`    ${keyword} (branch === ${i}) {`);

      // Events: generate addEventListener
      for (const e of branch.events) {
        const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
        lines.push(`      const ${e.varName} = ${pathExpr(e.path, 'node')};`);
        lines.push(`      ${e.varName}.addEventListener('${e.event}', ${handlerExpr});`);
      }

      // Phase 2: Text, show, and attr bindings are handled by __invalidate with existence guards.
      // Only model bindings, for-loops, and dynamic components need setup here.

      // Model bindings: generate effects and listeners
      for (const mb of (branch.modelBindings || [])) {
        const nodeRef = pathExpr(mb.path, 'node');
        lines.push(`      const ${mb.varName} = ${nodeRef};`);
        // Effect (signal → DOM)
        lines.push(`      __effect(() => {`);
        if (mb.prop === 'checked' && mb.radioValue !== null) {
          lines.push(`        ${mb.varName}.checked = (this._state.${mb.signal} === '${mb.radioValue}');`);
        } else if (mb.prop === 'checked') {
          lines.push(`        ${mb.varName}.checked = !!this._state.${mb.signal};`);
        } else {
          lines.push(`        ${mb.varName}.value = this._state.${mb.signal} ?? '';`);
        }
        lines.push(`      });`);
        // Listener (DOM → signal)
        const mbAssign = modelVarMap.has(mb.signal)
          ? `this._modelSet_${mb.signal}(`
          : `this._state.${mb.signal} = `;
        if (mb.prop === 'checked' && mb.radioValue === null) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { ${mbAssign}e.target.checked${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
        } else if (mb.coerce) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { ${mbAssign}Number(e.target.value)${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
        } else {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { ${mbAssign}e.target.value${modelVarMap.has(mb.signal) ? ')' : ';' } });`);
        }
      }

      // Nested each loops inside this branch
      for (const innerFor of (branch.forBlocks || [])) {
        const innerVn = innerFor.varName;
        const { itemVar: innerItemVar, indexVar: innerIndexVar, source: innerSource, keyExpr: innerKeyExpr } = innerFor;

        // Create inner template element
        lines.push(`      const ${innerVn}_tpl = document.createElement('template');`);
        lines.push(`      ${innerVn}_tpl.innerHTML = \`${innerFor.templateHtml}\`;`);

        // Find inner anchor inside the branch node
        lines.push(`      const ${innerVn}_anchor = ${pathExpr(innerFor.anchorPath, 'node')};`);

        // Transform the source expression
        const innerSourceExpr = transformExpr(innerSource, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

        // Generate reactive each effect
        lines.push(`      this.__disposers.push(__effect(() => {`);
        lines.push(`        const __source = ${innerSourceExpr};`);
        lines.push(`        const __iter = typeof __source === 'number'`);
        lines.push(`          ? Array.from({ length: __source }, (_, i) => i + 1)`);
        lines.push(`          : (__source || []);`);

        if (innerKeyExpr) {
          // Keyed reconciliation
          lines.push(`        const __oldMap = this.${innerVn}_keyMap || new Map();`);
          lines.push(`        const __newMap = new Map();`);
          lines.push(`        const __newNodes = [];`);
          lines.push(`        __iter.forEach((${innerItemVar}, ${innerIndexVar || '__idx'}) => {`);
          lines.push(`          const __key = ${innerKeyExpr};`);
          lines.push(`          if (__oldMap.has(__key)) {`);
          lines.push(`            __oldMap.get(__key).remove();`);
          lines.push(`          }`);
          lines.push(`          const clone = ${innerVn}_tpl.content.cloneNode(true);`);
          lines.push(`          const itemNode = clone.firstChild;`);
          // Setup bindings for inner items
          for (const b of innerFor.bindings) {
            const nodeRef = pathExpr(b.path, 'itemNode');
            lines.push(`          ${nodeRef}.textContent = ${b.name} ?? '';`);
          }
          for (const e of innerFor.events) {
            const nodeRef = pathExpr(e.path, 'itemNode');
            const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
            lines.push(`          ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
          }
          lines.push(`          __newMap.set(__key, itemNode);`);
          lines.push(`          __newNodes.push(itemNode);`);
          lines.push(`        });`);
          lines.push(`        for (const n of __oldMap.values()) n.remove();`);
          lines.push(`        for (const n of __newNodes) { ${innerVn}_anchor.parentNode.insertBefore(n, ${innerVn}_anchor); }`);
          lines.push(`        this.${innerVn}_keyMap = __newMap;`);
        } else {
          // Non-keyed: destroy and recreate
          lines.push(`        if (!this.${innerVn}_nodes) this.${innerVn}_nodes = [];`);
          lines.push(`        for (const n of this.${innerVn}_nodes) n.remove();`);
          lines.push(`        this.${innerVn}_nodes = [];`);
          lines.push(`        __iter.forEach((${innerItemVar}, ${innerIndexVar || '__idx'}) => {`);
          lines.push(`          const clone = ${innerVn}_tpl.content.cloneNode(true);`);
          lines.push(`          const itemNode = clone.firstChild;`);
          // Setup bindings for inner items
          for (const b of innerFor.bindings) {
            const nodeRef = pathExpr(b.path, 'itemNode');
            lines.push(`          ${nodeRef}.textContent = ${b.name} ?? '';`);
          }
          for (const e of innerFor.events) {
            const nodeRef = pathExpr(e.path, 'itemNode');
            const handlerExpr = generateEventHandler(e.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
            lines.push(`          ${nodeRef}.addEventListener('${e.event}', ${handlerExpr});`);
          }
          lines.push(`          ${innerVn}_anchor.parentNode.insertBefore(itemNode, ${innerVn}_anchor);`);
          lines.push(`          this.${innerVn}_nodes.push(itemNode);`);
          lines.push(`        });`);
        }
        lines.push(`      }));`);
      }

      // Nested dynamic components inside this branch
      for (const dyn of (branch.dynamicComponents || [])) {
        const dvn = dyn.varName;
        const isExpr = transformExpr(dyn.isExpression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
        lines.push(`      {`);
        lines.push(`        const ${dvn}_anchor = ${pathExpr(dyn.anchorPath, 'node')};`);
        lines.push(`        let ${dvn}_current = null;`);
        lines.push(`        const __tag = ${isExpr};`);
        lines.push(`        if (__tag) {`);
        lines.push(`          const el = document.createElement(__tag);`);
        for (const prop of dyn.props) {
          const propExprTransformed = transformExpr(prop.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);
          lines.push(`          el.setAttribute('${prop.attr}', ${propExprTransformed});`);
        }
        for (const evt of dyn.events) {
          const handlerExpr = generateEventHandler(evt.handler, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, modelVarMap, methodNames);
          lines.push(`          el.addEventListener('${evt.event}', ${handlerExpr});`);
        }
        lines.push(`          ${dvn}_anchor.parentNode.insertBefore(el, ${dvn}_anchor);`);
        lines.push(`          customElements.upgrade(el);`);
        lines.push(`          ${dvn}_current = el;`);
        lines.push(`        }`);
        lines.push(`      }`);
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
