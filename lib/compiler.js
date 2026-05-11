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
  extractModels,
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

  // 2b. Extract manual .wcc imports (e.g. import './child.wcc') and strip them from source
  const manualImports = [];
  const wccImportRe = /import\s+['"]([^'"]+\.wcc)['"]\s*;?/g;
  let wccImportMatch;
  while ((wccImportMatch = wccImportRe.exec(source)) !== null) {
    manualImports.push(wccImportMatch[1].replace(/\.wcc$/, '.js'));
  }
  source = source.replace(wccImportRe, '');

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
  const { onMountHooks, onDestroyHooks, onAdoptHooks } = extractLifecycleHooks(source);

  // 7b. Strip lifecycle/watcher blocks from source for extraction
  let sourceForExtraction = source;
  const hookLinePattern = /\bonMount\s*\(|\bonDestroy\s*\(|\bonAdopt\s*\(|\bwatch\s*\(/;
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
  const modelDefs = extractModels(sourceForExtraction);

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

  // 14b. Validate defineModel declarations
  // MODEL_NO_ASSIGNMENT: detect bare defineModel() calls not assigned to a variable
  const bareModelRe = /\bdefineModel\s*\(/g;
  const assignedModelRe = /(?:const|let|var)\s+\w+\s*=\s*defineModel\s*\(/g;
  const bareModelCount = (sourceForExtraction.match(bareModelRe) || []).length;
  const assignedModelCount = (sourceForExtraction.match(assignedModelRe) || []).length;
  if (bareModelCount > assignedModelCount) {
    const error = new Error(`defineModel() must be assigned to a variable`);
    /** @ts-expect-error — custom error code */
    error.code = 'MODEL_NO_ASSIGNMENT';
    throw error;
  }

  // MODEL_MISSING_NAME: check each extracted model has a name property
  for (const md of modelDefs) {
    if (!md.name) {
      const error = new Error(`defineModel() requires a 'name' property in the options object`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_MISSING_NAME';
      throw error;
    }
  }

  // MODEL_NAME_CONFLICT: check model prop names against signals, computeds, constants, and props
  for (const md of modelDefs) {
    if (!md.name) continue;
    if (signalNameSet.has(md.name)) {
      const error = new Error(`defineModel prop '${md.name}' conflicts with existing signal '${md.name}'`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_NAME_CONFLICT';
      throw error;
    }
    if (computedNameSet.has(md.name)) {
      const error = new Error(`defineModel prop '${md.name}' conflicts with existing computed '${md.name}'`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_NAME_CONFLICT';
      throw error;
    }
    if (constantNameSet.has(md.name)) {
      const error = new Error(`defineModel prop '${md.name}' conflicts with existing constant '${md.name}'`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_NAME_CONFLICT';
      throw error;
    }
    if (propNameSet.has(md.name)) {
      const error = new Error(`defineModel prop '${md.name}' conflicts with existing prop '${md.name}'`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_NAME_CONFLICT';
      throw error;
    }
  }

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
    onAdoptHooks,
    modelBindings: [],
    modelPropBindings: [],
    attrBindings: [],
    slots: [],
    refs,
    refBindings: [],
    childComponents: [],
    childImports: [],
    exposeNames,
    modelDefs,
  };

  // 16. Process template through linkedom → tree-walker → codegen
  const { document } = parseHTML(`<div id="__root">${template}</div>`);
  const rootEl = document.getElementById('__root');

  const signalNames = new Set(signals.map(s => s.name));
  // Add model var names so they are recognized as writable signals in tree-walker
  for (const md of modelDefs) {
    signalNames.add(md.varName);
  }
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

  const { bindings, events, showBindings, modelBindings, modelPropBindings, attrBindings, slots, childComponents } = walkTree(rootEl, signalNames, computedNames, propNamesSet);

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

  // 17c. Validate model:propName bindings
  for (const mpb of modelPropBindings) {
    const name = mpb.signal;
    // Check if the referenced variable exists at all
    const isKnown = signalNames.has(name) || computedNames.has(name) || propNamesSet.has(name) || constantNamesForModel.has(name);
    if (!isKnown) {
      const error = new Error(`model:propName references undeclared variable '${name}'`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_PROP_UNKNOWN_VAR';
      throw error;
    }
    // Check if the referenced variable is read-only
    if (propNamesSet.has(name)) {
      const error = new Error(`model:propName cannot bind to prop '${name}' (read-only)`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_PROP_READONLY';
      throw error;
    }
    if (computedNames.has(name)) {
      const error = new Error(`model:propName cannot bind to computed '${name}' (read-only)`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_PROP_READONLY';
      throw error;
    }
    if (constantNamesForModel.has(name)) {
      const error = new Error(`model:propName cannot bind to constant '${name}' (read-only)`);
      /** @ts-expect-error — custom error code */
      error.code = 'MODEL_PROP_READONLY';
      throw error;
    }
  }

  // 18. Resolve child component imports (from main template + if branches + each blocks)
  /** @type {import('./types.js').ChildComponentImport[]} */
  const childImports = [];
  const allChildTags = new Set(childComponents.map(c => c.tag));

  // Collect child tags from if branches
  for (const ifBlock of ifBlocks) {
    for (const branch of ifBlock.branches) {
      if (branch.childComponents) {
        for (const cc of branch.childComponents) allChildTags.add(cc.tag);
      }
    }
  }

  // Collect child tags from each blocks
  for (const forBlock of forBlocks) {
    if (forBlock.childComponents) {
      for (const cc of forBlock.childComponents) allChildTags.add(cc.tag);
    }
  }

  if (allChildTags.size > 0) {
    const sourceDir = dirname(filePath);

    for (const tag of allChildTags) {
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
  parseResult.modelPropBindings = modelPropBindings;
  parseResult.attrBindings = attrBindings;
  parseResult.ifBlocks = ifBlocks;
  parseResult.forBlocks = forBlocks;
  parseResult.slots = slots;
  parseResult.refBindings = refBindings;
  parseResult.childComponents = childComponents;

  // Add manual .wcc imports from script block
  for (const imp of manualImports) {
    if (!childImports.find(ci => ci.importPath === imp)) {
      childImports.push({ tag: '', importPath: imp });
    }
  }
  parseResult.childImports = childImports;
  parseResult.processedTemplate = rootEl.innerHTML;

  // 20. Resolve standalone and generate component
  const standaloneResolved = resolveStandalone(descriptor.standalone, config?.standalone ?? false);
  const genOptions = { ...config, sourceFile: fileName };

  if (standaloneResolved) {
    // Force inline runtime — ignore any runtimeImportPath
    genOptions.runtimeImportPath = undefined;
  }
  // If standaloneResolved is false, keep config.runtimeImportPath as-is (CLI provides it)

  const code = generateComponent(parseResult, genOptions);
  const usesSharedRuntime = !standaloneResolved && !!genOptions.runtimeImportPath;
  return { code, usesSharedRuntime };
}

/**
 * Resolve the final standalone value.
 * Component-level has priority over global.
 *
 * @param {boolean | undefined} componentValue — standalone from defineComponent (true, false, or undefined)
 * @param {boolean} globalValue — standalone from config (true or false)
 * @returns {boolean}
 */
export function resolveStandalone(componentValue, globalValue) {
  if (componentValue === true || componentValue === false) return componentValue;
  return globalValue;
}

/**
 * Compile a single .wcc SFC file into a self-contained JS component.
 *
 * @param {string} filePath — Absolute or relative path to the .wcc file
 * @param {object} [config] — Optional config (reserved for future options)
 * @returns {Promise<{code: string, usesSharedRuntime: boolean}>} The generated JavaScript component code and metadata
 */
export async function compile(filePath, config) {
  const result = await compileSFC(filePath, config);

  if (config?.minify) {
    const { transform } = await import('esbuild');
    try {
      const minified = await transform(result.code, {
        minify: true,
        loader: 'js',
        target: 'esnext',
      });
      result.code = minified.code;
    } catch {
      // If minification fails (e.g., edge-case syntax), return unminified code
      // This is a graceful fallback — the code still works at runtime
    }
  }

  return result;
}
