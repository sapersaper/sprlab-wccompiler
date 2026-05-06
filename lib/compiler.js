/**
 * Compiler — orchestrates the full compilation pipeline for wcCompiler v2.
 *
 * Pipeline: parse SFC → jsdom template → tree-walk → codegen
 *
 * Takes a .wcc file path and produces a self-contained JavaScript web component string.
 */

import { parseHTML } from 'linkedom';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, extname, basename, resolve } from 'node:path';
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
  extractExpose,
  validatePropsAssignment,
  validateDuplicateProps,
  validatePropsConflicts,
  validateEmitsAssignment,
  validateDuplicateEmits,
  validateEmitsConflicts,
  validateUndeclaredEmits,
} from './parser-extractors.js';
import { stripTypes } from './parser.js';

/**
 * Resolve a child component's source file path by tag name.
 *
 * Searches for a file named after the tag in the source directory,
 * trying extensions in priority order: .wcc, .js, .ts
 *
 * @param {string} tag — The custom element tag name (e.g., 'wcc-child')
 * @param {string} sourceDir — Directory of the parent component
 * @param {object} [config] — Optional config (reserved for future use)
 * @returns {string | null} Relative import path (e.g., './wcc-child.js') or null if not found
 */
function resolveChildComponent(tag, sourceDir, config) {
  const extensions = ['.wcc', '.js', '.ts'];
  for (const ext of extensions) {
    const candidate = resolve(sourceDir, `${tag}${ext}`);
    if (existsSync(candidate)) {
      // Return as a relative .js import path (compiled output)
      return `./${tag}.js`;
    }
  }
  return null;
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
  const exposeNames = extractExpose(source);

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
    exposeNames,
  };

  // 16. Process template through linkedom → tree-walker → codegen
  const { document } = parseHTML(`<div id="__root">${template}</div>`);
  const rootEl = document.getElementById('__root');

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
  return generateComponent(parseResult, config);
}

/**
 * Compile a single .wcc SFC file into a self-contained JS component.
 *
 * @param {string} filePath — Absolute or relative path to the .wcc file
 * @param {object} [config] — Optional config (reserved for future options)
 * @returns {Promise<string>} The generated JavaScript component code
 */
export async function compile(filePath, config) {
  return compileSFC(filePath, config);
}
