/**
 * Expression transformer for wcCompiler v2.
 *
 * Transforms template expressions and method bodies by rewriting
 * signal/computed/prop references to use instance-based state access.
 *
 * @module transform/expr-transformer
 */

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
export function wrapTernaryExpr(expr) {
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
 * Escape special regex characters in a string.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  // 5b. Transform bare method references used as callbacks (e.g. setTimeout(method, 100))
  // Must run AFTER 5 so call-site references are already transformed
  // Uses .bind(this) to preserve context when passed as callback
  for (const methodName of methodNames) {
    if (propsObjectName && methodName === propsObjectName) continue;
    if (emitsObjectName && methodName === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b${methodName}\\b(?!\\()`, 'g');
    result = result.replace(bareRe, `this._${methodName}.bind(this)`);
  }

  return result;
}
