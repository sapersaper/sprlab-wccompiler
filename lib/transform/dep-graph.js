/**
 * Dependency graph builder for wcCompiler v2.
 *
 * Classifies each template binding as either eligible for __invalidate
 * (returned in depGraph) or remaining in __effect (returned in effectBindings).
 *
 * @module transform/dep-graph
 */

import { escapeRegex, transformExpr, transformMethodBody, pathExpr, wrapTernaryExpr } from './expr-transformer.js';
import { transformForExpr } from './for-transformer.js';
import { camelToKebab } from '../parser-extractors.js';

/**
 * Extract signal/prop/model dependencies from a raw expression text.
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
      const expr = transformForExpr(sb.expression, niv, nidx ?? null, propNames, new Set(signalNames), new Set(computedNames), methodNames);
      for (const dep of deps) {
        if (dep === niv || dep === nidx) continue;
        // In-place show update instead of full renderEach
        addDep(dep, { type: 'showEach', eachBlockIndex: parentIdx, expr, depKey: dep, itemVar: niv, indexVar: nidx ?? null });
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
export function generateUpdateOp(entry, lines, indent) {
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
    case 'showEach':
      if (entry.eachBlockIndex !== undefined) {
        lines.push(`${indent}for (const __el of (this.__show_elements && this.__show_elements['${entry.depKey}'] || [])) {`);
        lines.push(`${indent}  __el.style.display = (${entry.expr}) ? '' : 'none';`);
        lines.push(`${indent}}`);
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
