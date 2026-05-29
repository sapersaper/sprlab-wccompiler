/**
 * __invalidate method generation — the switch/case block that maps signal
 * changes to DOM updates / computed recalculations / re-renders.
 */

import { generateUpdateOp, topologicalSortComputeds, extractComputedDeps } from '../transform/dep-graph.js';
import { transformExpr, transformMethodBody } from '../transform/expr-transformer.js';

/**
 * @param {string[]} lines
 * @param {Map<string, any[]>} depGraph — dependency graph from buildDepGraph
 * @param {import('../types.js').ParseResult} parseResult
 * @param {object} state
 * @param {string[]} state.signalNames
 * @param {string[]} state.computedNames
 * @param {string[]} state.methodNames
 * @param {string[]} state.constantNames
 * @param {Set<string>} state.propNames
 * @param {string|null} state.propsObjectName
 * @param {string|null} state.emitsObjectName
 * @param {Map<string,string>} state.modelVarMap
 * @param {boolean} state.hasDepGraph
 * @param {boolean} state.hasStateEntries
 */
export function generateInvalidate(lines, depGraph, parseResult, state = {}) {
  const {
    signalNames = [],
    computedNames = [],
    methodNames = [],
    constantNames = [],
    propNames = new Set(),
    propsObjectName = null,
    emitsObjectName = null,
    modelVarMap = new Map(),
    hasDepGraph = true,
    hasStateEntries = true,
  } = state;

  const computeds = parseResult.computeds || [];
  const watchers = parseResult.watchers || [];
  const ifBlocks = parseResult.ifBlocks || [];
  const forBlocks = parseResult.forBlocks || [];
  const dynamicComponents = parseResult.dynamicComponents || [];

  if (depGraph && depGraph.size > 0) {
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
  } else if (hasStateEntries) {
    // Always generate minimal __invalidate for Proxy set trap compatibility
    lines.push('  __invalidate(key) {');
    lines.push('    // No reactive bindings — proxy set trap calls this as no-op');
    lines.push('  }');
    lines.push('');
  }
}
