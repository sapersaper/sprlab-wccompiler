/**
 * Component code generation orchestrator.
 *
 * Orchestrates the modular code generation pipeline by calling
 * each focused module in order.
 */

import { buildDepGraph } from '../transform/dep-graph.js';
import { camelToKebab } from '../utils.js';
import { generatePreamble } from './preamble.js';
import { generateConstructor } from './constructor.js';
import { generateConnectedCallback } from './connected-callback.js';
import { generateInvalidate } from './invalidate.js';
import { generateRenderMethods } from './render-methods.js';
import { generateClassMethods } from './class-methods.js';

/**
 * @param {import('../types.js').ParseResult} parseResult
 * @param {{ sourceFile?: string, comments?: boolean, ssr?: boolean }} [options]
 * @returns {string}
 */
export function generateComponent(parseResult, options = {}) {
  const {
    tagName,
    className,
    signals = [],
    computeds = [],
    methods = [],
    propDefs = [],
    propsObjectName = null,
    emits = [],
    emitsObjectName = null,
    modelDefs = [],
    constantVars = [],
    refs = [],
    slots = [],
    usesBatch = false,
  } = parseResult;

  const signalNames = signals.map(s => s.name);
  const computedNames = computeds.map(c => c.name);
  const constantNames = constantVars.map(v => v.name);
  const methodNames = methods.map(m => m.name);
  const refVarNames = refs.map(r => r.varName);
  const propNames = new Set(propDefs.map(p => p.name));

  const modelVarMap = new Map();
  for (const md of modelDefs) {
    modelVarMap.set(md.varName, md.name);
  }

  const lines = [];

  // Flatten all forBlocks (top-level + nested in if-blocks) and assign _renderIndex
  const ifBlocks = parseResult.ifBlocks || [];
  const forBlocks = parseResult.forBlocks || [];
  const allForBlocks = [...forBlocks];
  for (const ifBlock of ifBlocks) {
    for (const branch of ifBlock.branches) {
      for (const nestedFor of (branch.forBlocks || [])) {
        allForBlocks.push(nestedFor);
      }
    }
  }
  for (let i = 0; i < allForBlocks.length; i++) {
    allForBlocks[i]._renderIndex = i;
    allForBlocks[i].varName = `__for${i}`;
  }

  // Build the dependency graph
  const transformContext = {
    signalNames, computedNames, propNames, propDefs, modelDefs, modelVarMap,
    propsObjectName, emitsObjectName, constantNames, methodNames
  };
  const { depGraph, effectBindings: classifiedEffectBindings } = buildDepGraph(parseResult, transformContext);

  // Shared state object passed to modules
  const state = {
    signalNames,
    computedNames,
    methodNames,
    constantNames,
    propNames,
    propsObjectName,
    emitsObjectName,
    modelVarMap,
    refVarNames,
  };

  // ── Preamble ───────────────────────────────────────────────────────────
  generatePreamble(lines, parseResult, options);

  // ── HTMLElement class declaration ──────────────────────────────────────
  if (options.comments) lines.push('// ── Component ────────────────────────────────────────');
  lines.push(`class ${className} extends HTMLElement {`);

  // Static observedAttributes (if props or model props exist)
  const modelAttrNames = modelDefs.map(md => camelToKebab(md.name));
  if (propDefs.length > 0 || modelDefs.length > 0) {
    const propAttrNames = propDefs.map(p => `'${p.attrName}'`);
    // For model props, observe BOTH kebab-case AND camelCase forms
    const modelAttrEntries = [];
    for (let i = 0; i < modelDefs.length; i++) {
      const kebab = modelAttrNames[i];
      const camel = modelDefs[i].name;
      modelAttrEntries.push(`'${kebab}'`);
      if (kebab !== camel) {
        modelAttrEntries.push(`'${camel}'`);
      }
    }
    const allAttrNames = [...propAttrNames, ...modelAttrEntries].join(', ');
    lines.push(`  static get observedAttributes() { return [${allAttrNames}]; }`);
    lines.push('');
  }

  // Static __scopedSlots array (top-level + forBlock scoped slots)
  const scopedSlotNames = slots.filter(s => s.name && s.slotProps.length > 0).map(s => s.name);
  for (const fb of forBlocks) {
    for (const s of (fb.slots || [])) {
      if (s.name && s.slotProps.length > 0 && !scopedSlotNames.includes(s.name)) {
        scopedSlotNames.push(s.name);
      }
    }
  }
  if (scopedSlotNames.length > 0) {
    const scopedArr = scopedSlotNames.map(n => `'${n}'`).join(', ');
    lines.push(`  static __scopedSlots = [${scopedArr}];`);
    lines.push('');
  }

  // Static __meta
  {
    const metaProps = propDefs.map(p => `{ name: '${p.name}', default: ${p.default} }`).join(', ');
    const metaEvents = emits.map(e => `'${e}'`).join(', ');
    const metaModels = modelDefs.map(m => `'${m.name}'`).join(', ');
    const metaSlots = slots.filter(s => s.name).map(s => `'${s.name}'`).join(', ');
    lines.push(`  static __meta = { tag: '${tagName}', props: [${metaProps}], events: [${metaEvents}], models: [${metaModels}], slots: [${metaSlots}] };`);
    lines.push('');
  }

  // ── Constructor ────────────────────────────────────────────────────────
  generateConstructor(lines, parseResult, options);

  // ── connectedCallback ──────────────────────────────────────────────────
  const hasDepGraph = depGraph && depGraph.size > 0;
  generateConnectedCallback(lines, parseResult, {
    comments: options.comments,
    classifiedEffectBindings,
    hasDepGraph,
    refVarNames,
    ssr: options.ssr,
  });

  // ── Render methods ─────────────────────────────────────────────────────
  generateRenderMethods(lines, parseResult, state);

  // ── __invalidate ───────────────────────────────────────────────────────
  // Compute whether there are state entries (used by invalidate fallback)
  const stateEntries = [];
  for (const p of propDefs) stateEntries.push(`${p.name}: ${p.default}`);
  for (const s of signals) stateEntries.push(`${s.name}: ${s.value}`);
  for (const md of modelDefs) stateEntries.push(`${md.name}: ${md.default}`);
  for (const c of computeds) stateEntries.push(`${c.name}: undefined`);
  const hasStateEntries = stateEntries.length > 0;

  generateInvalidate(lines, depGraph, parseResult, {
    ...state,
    hasDepGraph,
    hasStateEntries,
  });

  // ── Class methods ──────────────────────────────────────────────────────
  generateClassMethods(lines, parseResult, state, options);

  // ── Close class ────────────────────────────────────────────────────────
  lines.push('}');
  lines.push('');

  // ── Registration ──────────────────────────────────────────────────────
  lines.push(`if (!customElements.get('${tagName}')) customElements.define('${tagName}', ${className});`);
  lines.push('');

  // ── Default export ────────────────────────────────────────────────────
  lines.push(`export default ${className};`);

  return lines.join('\n');
}
