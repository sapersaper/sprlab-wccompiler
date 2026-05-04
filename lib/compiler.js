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
import { resolve, relative, dirname, extname, basename } from 'node:path';
import { parse, stripTypes } from './parser.js';
import { walkTree, processIfChains, processForBlocks, recomputeAnchorPath, detectRefs } from './tree-walker.js';
import { generateComponent } from './codegen.js';
import { parseSFC } from './sfc-parser.js';
import {
  stripMacroImport,
  toClassName,
  camelToKebab,
  extractPropsGeneric,
  extractPropsArray,
  extractPropsDefaults,
  extractPropsObjectName,
  extractEmitsFromCallSignatures,
  extractEmits,
  extractEmitsObjectName,
  extractEmitsObjectNameFromGeneric,
  extractSignals,
  extractComputeds,
  extractEffects,
  extractWatchers,
  extractFunctions,
  extractLifecycleHooks,
  extractRefs,
  extractConstants,
  validatePropsAssignment,
  validateDuplicateProps,
  validatePropsConflicts,
  validateEmitsAssignment,
  validateDuplicateEmits,
  validateEmitsConflicts,
  validateUndeclaredEmits,
} from './parser-extractors.js';
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
  // Extensiones a buscar, en orden de prioridad
  const extensions = ['.wcc', '.js', '.ts'];

  // Search in the same directory and subdirectories for a matching source file
  const searchDirs = [sourceDir];

  // Also search parent directory (common case: components in sibling folders)
  const parentDir = dirname(sourceDir);
  if (parentDir !== sourceDir) {
    searchDirs.push(parentDir);
  }

  // Collect all matches so we can return the highest-priority one
  let bestMatch = null;
  let bestPriority = extensions.length; // lower index = higher priority

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = extname(entry.name);
        const priority = extensions.indexOf(ext);
        if (priority === -1) continue;
        if (entry.name.includes('.test.')) continue;
        if (entry.name.endsWith('.d.ts')) continue;
        // Skip if we already have a higher-priority match
        if (priority >= bestPriority) continue;

        const fullPath = resolve(dir, entry.parentPath ? relative(dir, entry.parentPath) : '', entry.name);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          // Quick check: does this file define the component with the matching tag?
          const tagMatch = content.match(/defineComponent\(\s*\{[^}]*tag\s*:\s*['"]([^'"]+)['"]/);
          if (tagMatch && tagMatch[1] === tag) {
            // Compute relative path from sourceDir to this file, with .js extension
            let relPath = relative(sourceDir, fullPath);
            // Ensure .js extension (replace .ts or .wcc)
            relPath = relPath.replace(/\.(ts|wcc)$/, '.js');
            // Ensure starts with ./
            if (!relPath.startsWith('.')) relPath = './' + relPath;
            bestMatch = relPath;
            bestPriority = priority;
            // If we found the highest-priority extension, no need to keep searching
            if (bestPriority === 0) return bestMatch;
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Skip dirs that can't be listed
    }
  }

  return bestMatch;
}

/**
 * Compile a single .wcc SFC file into a self-contained JS component.
 *
 * Reads the file, parses the SFC blocks, extracts reactive declarations
 * from the script block using parser-extractors.js, and processes template
 * and style through the existing pipeline (jsdom → tree-walker → codegen).
 *
 * @param {string} filePath — Absolute or relative path to the .wcc file
 * @param {object} [config] — Optional config (reserved for future options)
 * @returns {Promise<string>} The generated JavaScript component code
 */
async function compileSFC(filePath, config) {
  // 1. Read and parse the SFC file
  const rawSource = readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath);
  const descriptor = parseSFC(rawSource, fileName);

  // 2. Process script block — mirrors parser.js logic
  let source = stripMacroImport(descriptor.script);

  // 3. Extract props/emits from generic forms BEFORE type stripping
  const propsFromGeneric = extractPropsGeneric(source);
  const propsObjectNameFromGeneric = extractPropsObjectName(source);
  const emitsFromCallSignatures = extractEmitsFromCallSignatures(source);
  const emitsObjectNameFromGeneric = extractEmitsObjectNameFromGeneric(source);

  // 4. Validate props/emits assignment (before type strip)
  validatePropsAssignment(source, filePath);
  validateEmitsAssignment(source, filePath);

  // 5. Strip TypeScript types if lang === 'ts'
  if (descriptor.lang === 'ts') {
    source = await stripTypes(source);
  }

  // 6. Extract component metadata
  const tagName = descriptor.tag;
  const className = toClassName(tagName);
  const template = descriptor.template;
  const style = descriptor.style;

  // 7. Extract lifecycle hooks (before other extractions)
  const { onMountHooks, onDestroyHooks } = extractLifecycleHooks(source);

  // 7b. Strip lifecycle/watcher blocks from source for extraction
  let sourceForExtraction = source;
  const hookLinePattern = /\bonMount\s*\(|\bonDestroy\s*\(|\bwatch\s*\(/;
  const sourceLines = sourceForExtraction.split('\n');
  const filteredLines = [];
  let skipDepth = 0;
  let skipping = false;
  for (const line of sourceLines) {
    if (!skipping && hookLinePattern.test(line)) {
      skipping = true;
      skipDepth = 0;
      for (const ch of line) {
        if (ch === '{') skipDepth++;
        if (ch === '}') skipDepth--;
      }
      if (skipDepth <= 0) skipping = false;
      continue;
    }
    if (skipping) {
      for (const ch of line) {
        if (ch === '{') skipDepth++;
        if (ch === '}') skipDepth--;
      }
      if (skipDepth <= 0) skipping = false;
      continue;
    }
    filteredLines.push(line);
  }
  sourceForExtraction = filteredLines.join('\n');

  // 8. Extract reactive declarations and functions
  const signals = extractSignals(sourceForExtraction);
  const computeds = extractComputeds(sourceForExtraction);
  const effects = extractEffects(sourceForExtraction);
  const watchers = extractWatchers(source);
  const methods = extractFunctions(sourceForExtraction);
  const refs = extractRefs(sourceForExtraction);
  const constantVars = extractConstants(sourceForExtraction);

  // 9. Extract props (array form — after type strip, if generic didn't find any)
  const propsFromArray = propsFromGeneric.length > 0 ? [] : extractPropsArray(source);
  let propNames = propsFromGeneric.length > 0 ? propsFromGeneric : propsFromArray;

  // 10. Extract props defaults
  const propsDefaults = extractPropsDefaults(source);
  if (propNames.length === 0 && Object.keys(propsDefaults).length > 0) {
    propNames = Object.keys(propsDefaults);
  }

  // 11. Extract propsObjectName
  const propsObjectName = propsObjectNameFromGeneric ?? extractPropsObjectName(source);

  // 12. Validate props
  validateDuplicateProps(propNames, filePath);
  const signalNameSet = new Set(signals.map(s => s.name));
  const computedNameSet = new Set(computeds.map(c => c.name));
  const constantNameSet = new Set(constantVars.map(v => v.name));
  validatePropsConflicts(propsObjectName, signalNameSet, computedNameSet, constantNameSet, filePath);

  /** @type {import('./types.js').PropDef[]} */
  const propDefs = propNames.map(name => ({
    name,
    default: propsDefaults[name] ?? 'undefined',
    attrName: camelToKebab(name),
  }));

  // 13. Extract emits
  const emitsFromArray = emitsFromCallSignatures.length > 0 ? [] : extractEmits(source);
  const emitNames = emitsFromCallSignatures.length > 0 ? emitsFromCallSignatures : emitsFromArray;
  const emitsObjectName = emitsObjectNameFromGeneric ?? extractEmitsObjectName(source);

  // 14. Validate emits
  validateDuplicateEmits(emitNames, filePath);
  const propNameSet = new Set(propNames);
  validateEmitsConflicts(emitsObjectName, signalNameSet, computedNameSet, constantNameSet, propNameSet, propsObjectName, filePath);
  validateUndeclaredEmits(source, emitsObjectName, emitNames, filePath);

  // 15. Build initial ParseResult
  /** @type {import('./types.js').ParseResult} */
  const parseResult = {
    tagName,
    className,
    template,
    style,
    signals,
    computeds,
    effects,
    constantVars,
    watchers,
    methods,
    propDefs,
    propsObjectName: propsObjectName ?? null,
    emits: emitNames,
    emitsObjectName: emitsObjectName ?? null,
    bindings: [],
    events: [],
    processedTemplate: null,
    ifBlocks: [],
    showBindings: [],
    forBlocks: [],
    onMountHooks,
    onDestroyHooks,
    modelBindings: [],
    attrBindings: [],
    slots: [],
    refs,
    refBindings: [],
    childComponents: [],
    childImports: [],
  };

  // 16. Process template through jsdom → tree-walker → codegen (same as compile())
  const dom = new JSDOM(`<div id="__root">${template}</div>`);
  const rootEl = dom.window.document.getElementById('__root');

  const signalNames = new Set(signals.map(s => s.name));
  const computedNames = new Set(computeds.map(c => c.name));
  const propNamesSet = new Set(propDefs.map(p => p.name));

  const forBlocks = processForBlocks(rootEl, [], signalNames, computedNames, propNamesSet);
  const ifBlocks = processIfChains(rootEl, [], signalNames, computedNames, propNamesSet);

  rootEl.normalize();

  for (const fb of forBlocks) {
    fb.anchorPath = recomputeAnchorPath(rootEl, fb._anchorNode);
  }
  for (const ib of ifBlocks) {
    ib.anchorPath = recomputeAnchorPath(rootEl, ib._anchorNode);
  }

  const { bindings, events, showBindings, modelBindings, attrBindings, slots, childComponents } = walkTree(rootEl, signalNames, computedNames, propNamesSet);

  const refBindings = detectRefs(rootEl);

  // 17. Validate refs
  for (const decl of refs) {
    if (!refBindings.find(b => b.refName === decl.refName)) {
      const error = new Error(`templateRef('${decl.refName}') has no matching ref="${decl.refName}" in template`);
      /** @ts-expect-error — custom error code */
      error.code = 'REF_NOT_FOUND';
      throw error;
    }
  }
  for (const binding of refBindings) {
    if (!refs.find(d => d.refName === binding.refName)) {
      console.warn(`Warning: ref="${binding.refName}" in template has no matching templateRef('${binding.refName}') in script`);
    }
  }

  // 17b. Validate model bindings
  const constantNamesForModel = new Set(constantVars.map(v => v.name));
  for (const mb of modelBindings) {
    if (propNamesSet.has(mb.signal)) {
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
    if (constantNamesForModel.has(mb.signal)) {
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

  // 18. Resolve child component imports
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

  // 19. Merge tree-walker results into ParseResult
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
  parseResult.processedTemplate = rootEl.innerHTML;

  // 20. Generate component
  return generateComponent(parseResult);
}

/**
 * Compile a single .ts/.js source file into a self-contained JS component.
 *
 * @param {string} filePath — Absolute or relative path to the source file
 * @param {object} [config] — Optional config (reserved for future options)
 * @returns {Promise<string>} The generated JavaScript component code
 */
export async function compile(filePath, config) {
  const ext = extname(filePath);
  if (ext === '.wcc') {
    return compileSFC(filePath, config);
  }

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
