/**
 * Compiler — orchestrates the full compilation pipeline for wcCompiler v2.
 *
 * Pipeline: parse → jsdom template → tree-walk → codegen
 *
 * Takes a .ts/.js source file path and produces a self-contained
 * JavaScript web component string.
 */

import { JSDOM } from 'jsdom';
import { parse } from './parser.js';
import { walkTree, processIfChains, processForBlocks, recomputeAnchorPath, detectRefs } from './tree-walker.js';
import { generateComponent } from './codegen.js';
/**
 * Compile a single .ts/.js source file into a self-contained JS component.
 *
 * @param {string} filePath — Absolute or relative path to the source file
 * @param {object} [config] — Optional config (reserved for future options)
 * @returns {Promise<string>} The generated JavaScript component code
 */
export async function compile(filePath, config) {
  // 1. Parse the source file
  const parseResult = await parse(filePath);

  // 2. Parse template HTML into jsdom DOM
  const dom = new JSDOM(`<div id="__root">${parseResult.template}</div>`);
  const rootEl = dom.window.document.getElementById('__root');

  // 3. Build name sets
  const signalNames = new Set(parseResult.signals.map(s => s.name));
  const computedNames = new Set(parseResult.computeds.map(c => c.name));
  const propNames = new Set((parseResult.propDefs || []).map(p => p.name));

  // 4. Process each blocks BEFORE if chains (replaces each elements with comment anchors)
  const forBlocks = processForBlocks(rootEl, [], signalNames, computedNames, propNames);

  // 5. Process conditional chains BEFORE walkTree (if/else-if/else)
  // This replaces conditional elements with comment anchors so walkTree
  // doesn't discover bindings inside conditional branches at the top level.
  const ifBlocks = processIfChains(rootEl, [], signalNames, computedNames, propNames);

  // 6. Normalize DOM after all directive processing to merge adjacent text nodes
  rootEl.normalize();

  // 7. Recompute anchor paths after normalization since text node merging
  // may have changed childNode indices
  for (const fb of forBlocks) {
    fb.anchorPath = recomputeAnchorPath(rootEl, fb._anchorNode);
  }
  for (const ib of ifBlocks) {
    ib.anchorPath = recomputeAnchorPath(rootEl, ib._anchorNode);
  }

  // 8. Walk the tree (discovers bindings/events/showBindings/slots in non-conditional content)
  const { bindings, events, showBindings, modelBindings, attrBindings, slots } = walkTree(rootEl, signalNames, computedNames, propNames);

  // 9. Detect refs (after walkTree — ref attributes are compile-time directives)
  const refBindings = detectRefs(rootEl);

  // 10. Validate refs
  const refs = parseResult.refs || [];

  // REF_NOT_FOUND: templateRef('name') with no matching ref="name" in template
  for (const decl of refs) {
    if (!refBindings.find(b => b.refName === decl.refName)) {
      const error = new Error(`templateRef('${decl.refName}') has no matching ref="${decl.refName}" in template`);
      /** @ts-expect-error — custom error code */
      error.code = 'REF_NOT_FOUND';
      throw error;
    }
  }

  // Unused ref warning: ref="name" in template with no matching templateRef('name') in script
  for (const binding of refBindings) {
    if (!refs.find(d => d.refName === binding.refName)) {
      console.warn(`Warning: ref="${binding.refName}" in template has no matching templateRef('${binding.refName}') in script`);
    }
  }

  // 10b. Validate model bindings — target must be a signal (not prop, computed, or constant)
  const constantNames = new Set((parseResult.constantVars || []).map(v => v.name));
  for (const mb of modelBindings) {
    if (propNames.has(mb.signal)) {
      const error = new Error(`model cannot bind to prop '${mb.signal}' (read-only)`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_READONLY';
      throw error;
    }
    if (computedNames.has(mb.signal)) {
      const error = new Error(`model cannot bind to computed '${mb.signal}' (read-only)`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_READONLY';
      throw error;
    }
    if (constantNames.has(mb.signal)) {
      const error = new Error(`model cannot bind to constant '${mb.signal}' (read-only)`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_READONLY';
      throw error;
    }
    if (!signalNames.has(mb.signal)) {
      const error = new Error(`model references undeclared variable '${mb.signal}'`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_UNKNOWN_VAR';
      throw error;
    }
  }

  // 11. Merge results into ParseResult
  parseResult.bindings = bindings;
  parseResult.events = events;
  parseResult.showBindings = showBindings;
  parseResult.modelBindings = modelBindings;
  parseResult.attrBindings = attrBindings;
  parseResult.ifBlocks = ifBlocks;
  parseResult.forBlocks = forBlocks;
  parseResult.slots = slots;
  parseResult.refBindings = refBindings;
  // Recompute processedTemplate after all directive replacements (including ref removal)
  parseResult.processedTemplate = rootEl.innerHTML;

  // 12. Generate component
  return generateComponent(parseResult);
}
