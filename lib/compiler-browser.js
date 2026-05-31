/**
 * Browser Compiler — compiles web components from strings using native browser APIs.
 *
 * This is the browser-compatible entry point for wcCompiler.
 * Uses DOMParser instead of jsdom, accepts strings instead of file paths.
 * Reuses codegen and css-scoper directly. Reimplements the tree-walking
 * pipeline using browser-native DOM APIs.
 *
 * Usage:
 *   import { compileFromStrings } from '@sprlab/wccompiler/browser'
 *
 *   const js = await compileFromStrings({
 *     script: 'import { signal } from "wcc"\nconst count = signal(0)',
 *     template: '<div>{{count}}</div>',
 *     style: '.counter { display: flex; }',
 *     tag: 'wcc-counter',
 *     lang: 'ts',
 *     stripTypes: async (code) => esbuild.transform(code, { loader: 'ts' }).then(r => r.code)
 *   })
 */

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
} from './parser-extractors.js';

import { generateComponent } from './codegen.js';
import { parseSFC } from './sfc-parser.js';
import { walkTree, walkBranch, setParseHTML } from './walker/tree-walker.js';
import { processIfChains } from './walker/if-processor.js';
import { processForBlocks } from './walker/each-processor.js';
import { processDynamicComponents } from './walker/dynamic-processor.js';
import { detectRefs } from './walker/dynamic-processor.js';

// ── Browser-compatible DOM helpers ──────────────────────────────────

/**
 * Create a DOM root from HTML using the browser's DOMParser.
 * @param {string} html
 * @returns {Element}
 */
function createRoot(html) {
  const doc = new DOMParser().parseFromString(
    `<html><body><div id="__root">${html}</div></body></html>`,
    'text/html'
  );
  return doc.getElementById('__root');
}

setParseHTML((html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<html><body>${html}</body></html>`, 'text/html');
  return { document: doc };
});

// ── Main compile function ───────────────────────────────────────────

/**
 * @typedef {Object} CompileFromStringsOptions
 * @property {string} script
 * @property {string} template
 * @property {string} [style]
 * @property {string} tag
 * @property {'ts'|'js'} [lang]
 * @property {(code: string) => Promise<string>} [stripTypes]
 */

/**
 * Compile a web component from source strings.
 * Browser-compatible — uses DOMParser instead of jsdom.
 *
 * @param {CompileFromStringsOptions} options
 * @returns {Promise<string>} Compiled JavaScript
 */
export async function compileFromStrings({ script, template, style = '', tag, lang = 'js', stripTypes }) {
  const className = toClassName(tag);

  // 1. Strip macro imports
  let source = stripMacroImport(script);

  // 2. Extract from generic form BEFORE type stripping
  const propsFromGeneric = extractPropsGeneric(source);
  const propsObjectNameFromGeneric = extractPropsObjectName(source);
  const emitsFromCallSignatures = extractEmitsFromCallSignatures(source);
  const emitsObjectNameFromGeneric = extractEmitsObjectNameFromGeneric(source);

  // 3. Strip TypeScript types if needed
  if (lang === 'ts' && stripTypes) {
    source = await stripTypes(source);
  }

  // 4. Extract lifecycle hooks
  const { onMountHooks, onDestroyHooks } = extractLifecycleHooks(source);

  // 4b. Strip lifecycle + watch blocks
  const hookLinePattern = /\bonMount\s*\(|\bonDestroy\s*\(|\bwatch\s*\(/;
  const sourceLines = source.split('\n');
  const filteredLines = [];
  let skipDepth = 0, skipping = false;
  for (const line of sourceLines) {
    if (!skipping && hookLinePattern.test(line)) {
      skipping = true; skipDepth = 0;
      for (const ch of line) { if (ch === '{') skipDepth++; if (ch === '}') skipDepth--; }
      if (skipDepth <= 0) skipping = false;
      continue;
    }
    if (skipping) {
      for (const ch of line) { if (ch === '{') skipDepth++; if (ch === '}') skipDepth--; }
      if (skipDepth <= 0) skipping = false;
      continue;
    }
    filteredLines.push(line);
  }
  const src = filteredLines.join('\n');

  // 5. Extract declarations
  const signals = extractSignals(src);
  const computeds = extractComputeds(src);
  const effects = extractEffects(src);
  const watchers = extractWatchers(source);
  const methods = extractFunctions(src);
  const refs = extractRefs(src);
  const constantVars = extractConstants(src);

  // 6. Props
  const propsFromArray = propsFromGeneric.length > 0 ? [] : extractPropsArray(source);
  let propNames = propsFromGeneric.length > 0 ? propsFromGeneric : propsFromArray;
  const propsDefaults = extractPropsDefaults(source);
  if (propNames.length === 0 && Object.keys(propsDefaults).length > 0) propNames = Object.keys(propsDefaults);
  const propsObjectName = propsObjectNameFromGeneric ?? extractPropsObjectName(source);
  const propDefs = propNames.map(name => ({ name, default: propsDefaults[name] ?? 'undefined', attrName: camelToKebab(name) }));

  // 7. Emits
  const emitsFromArray = emitsFromCallSignatures.length > 0 ? [] : extractEmits(source);
  const emitNames = emitsFromCallSignatures.length > 0 ? emitsFromCallSignatures : emitsFromArray;
  const emitsObjectName = emitsObjectNameFromGeneric ?? extractEmitsObjectName(source);

  // 8. Parse template
  const rootEl = createRoot(template);

  // 9. Name sets
  const signalNameSet = new Set(signals.map(s => s.name));
  const computedNameSet = new Set(computeds.map(c => c.name));
  const propNameSet = new Set(propDefs.map(p => p.name));

  // 10. Process directives
  const forBlocks = processForBlocks(rootEl, [], signalNameSet, computedNameSet, propNameSet);
  const ifBlocks = processIfChains(rootEl, [], signalNameSet, computedNameSet, propNameSet);
  rootEl.normalize();

  // 11. Walk tree
  const { bindings, events, showBindings, modelBindings, modelPropBindings, attrBindings, slots, childComponents } = walkTree(rootEl, signalNameSet, computedNameSet, propNameSet);

  // 12. Detect refs
  const refBindings = detectRefs(rootEl);

  // 13. Generate
  return generateComponent({
    tagName: tag, className, template, style,
    signals, computeds, effects, constantVars, watchers, methods,
    propDefs, propsObjectName: propsObjectName ?? null,
    emits: emitNames, emitsObjectName: emitsObjectName ?? null,
    bindings, events, showBindings, modelBindings, attrBindings,
    ifBlocks, forBlocks, slots, onMountHooks, onDestroyHooks,
    refs, refBindings, childComponents, childImports: [],
    processedTemplate: rootEl.innerHTML,
  });
}

/**
 * Compile an SFC component from a source string (browser-compatible).
 * Parses the SFC to extract blocks, then delegates to compileFromStrings.
 *
 * @param {string} source — Full content of the .wcc file
 * @param {{ stripTypes?: (code: string) => Promise<string> }} [options]
 * @returns {Promise<string>} Compiled JavaScript
 */
export async function compileFromSFC(source, options) {
  const descriptor = parseSFC(source);
  return compileFromStrings({
    script: descriptor.script,
    template: descriptor.template,
    style: descriptor.style,
    tag: descriptor.tag,
    lang: descriptor.lang,
    stripTypes: options?.stripTypes,
  });
}

