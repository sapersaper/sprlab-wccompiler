/**
 * Compiler — orchestrates the full compilation pipeline for wcCompiler v2.
 *
 * Pipeline: parse → jsdom template → tree-walk → codegen
 *
 * Takes a .ts/.js source file path and produces a self-contained
 * JavaScript web component string.
 */

import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { parse } from './parser.js';
import { walkTree, processIfChains, processForBlocks, recomputeAnchorPath, detectRefs } from './tree-walker.js';
import { generateComponent } from './codegen.js';
/**
 * Resolve a child component's import path by searching for a source file
 * whose defineComponent({ tag }) matches the given tag name.
 *
 * @param {string} tag — Child component tag name (e.g., 'wcc-badge')
 * @param {string} sourceDir — Directory of the parent component source file
 * @param {object} [config] — Optional config with input/output dirs
 * @returns {string | null} Relative import path (e.g., './wcc-badge.js') or null if not found
 */
function resolveChildComponent(tag, sourceDir, config) {
  // Search in the same directory and subdirectories for a matching source file
  const searchDirs = [sourceDir];

  // Also search parent directory (common case: components in sibling folders)
  const parentDir = dirname(sourceDir);
  if (parentDir !== sourceDir) {
    searchDirs.push(parentDir);
  }

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = extname(entry.name);
        if (ext !== '.js' && ext !== '.ts') continue;
        if (entry.name.includes('.test.')) continue;
        if (entry.name.endsWith('.d.ts')) continue;

        const fullPath = resolve(dir, entry.parentPath ? relative(dir, entry.parentPath) : '', entry.name);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          // Quick check: does this file define the component with the matching tag?
          const tagMatch = content.match(/defineComponent\(\s*\{[^}]*tag\s*:\s*['"]([^'"]+)['"]/);
          if (tagMatch && tagMatch[1] === tag) {
            // Compute relative path from sourceDir to this file, with .js extension
            let relPath = relative(sourceDir, fullPath);
            // Ensure .js extension (replace .ts)
            relPath = relPath.replace(/\.ts$/, '.js');
            // Ensure starts with ./
            if (!relPath.startsWith('.')) relPath = './' + relPath;
            return relPath;
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Skip dirs that can't be listed
    }
  }

  return null;
}

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
  const { bindings, events, showBindings, modelBindings, attrBindings, slots, childComponents } = walkTree(rootEl, signalNames, computedNames, propNames);

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

  // 11. Resolve child component imports
  /** @type {import('./types.js').ChildComponentImport[]} */
  const childImports = [];
  if (childComponents.length > 0) {
    const uniqueTags = [...new Set(childComponents.map(c => c.tag))];
    const sourceDir = dirname(filePath);

    for (const tag of uniqueTags) {
      const resolved = resolveChildComponent(tag, sourceDir, config);
      if (resolved) {
        childImports.push({ tag, importPath: resolved });
      } else {
        console.warn(`Warning: child component <${tag}> used in template but source file not found`);
      }
    }
  }

  // 12. Merge results into ParseResult
  parseResult.bindings = bindings;
  parseResult.events = events;
  parseResult.showBindings = showBindings;
  parseResult.modelBindings = modelBindings;
  parseResult.attrBindings = attrBindings;
  parseResult.ifBlocks = ifBlocks;
  parseResult.forBlocks = forBlocks;
  parseResult.slots = slots;
  parseResult.refBindings = refBindings;
  parseResult.childComponents = childComponents;
  parseResult.childImports = childImports;
  // Recompute processedTemplate after all directive replacements (including ref removal)
  parseResult.processedTemplate = rootEl.innerHTML;

  // 12. Generate component
  return generateComponent(parseResult);
}
