/**
 * Constructor generation — reactive state initialisation, Proxy set trap,
 * constant init, computed initial values, watcher prev-value init.
 */

import { transformMethodBody, transformExpr } from '../transform/expr-transformer.js';
import { topologicalSortComputeds, extractComputedDeps } from '../transform/dep-graph.js';

/**
 * @param {string[]} lines
 * @param {import('../types.js').ParseResult} parseResult
 * @param {{ comments?: boolean }} [options]
 */
export function generateConstructor(lines, parseResult, options = {}) {
  const comment = options.comments ? (text) => lines.push(`    // --- ${text} ---`) : () => {};

  const {
    signals = [],
    computeds = [],
    methods = [],
    propDefs = [],
    propsObjectName = null,
    emitsObjectName = null,
    modelDefs = [],
    constantVars = [],
    watchers = [],
    slots = [],
    usesBatch = false,
    forBlocks = [],
  } = parseResult;

  const signalNames = signals.map(s => s.name);
  const computedNames = computeds.map(c => c.name);
  const constantNames = constantVars.map(v => v.name);
  const methodNames = methods.map(m => m.name);
  const propNames = new Set(propDefs.map(p => p.name));

  // Build model var name → prop name map
  const modelVarMap = new Map();
  for (const md of modelDefs) {
    modelVarMap.set(md.varName, md.name);
  }

  // Scoped slot names
  const scopedSlotNames = slots.filter(s => s.name && s.slotProps.length > 0).map(s => s.name);

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

  // Phase 5: Show element references for in-place updates inside forBlocks
  if (forBlocks.length > 0) {
    lines.push('    this.__show_elements = {};');
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
}
