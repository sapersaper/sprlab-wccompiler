/**
 * Parser for .ts/.js component source files using defineComponent().
 *
 * Extracts:
 * - defineComponent({ tag, template, styles }) metadata
 * - signal() declarations
 * - computed() declarations
 * - effect() declarations
 * - Top-level function declarations
 *
 * Tree walking (bindings, events, processedTemplate) is NOT handled
 * here — that's the responsibility of tree-walker.js.
 */

/** @import { ParseResult, PropDef } from './types.js' */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { transform } from 'esbuild';

// Re-export all pure extraction functions so existing consumers are unaffected
export * from './parser-extractors.js';

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
  extractDefineComponent,
  validatePropsAssignment,
  validateDuplicateProps,
  validatePropsConflicts,
  validateEmitsAssignment,
  validateDuplicateEmits,
  validateEmitsConflicts,
  validateUndeclaredEmits,
} from './parser-extractors.js';

// ── Type stripping ──────────────────────────────────────────────────

/**
 * Strip TypeScript type annotations using esbuild, producing plain JavaScript.
 *
 * @param {string} tsCode - TypeScript source code
 * @returns {Promise<string>} - JavaScript without type annotations
 */
export async function stripTypes(tsCode) {
  try {
    const result = await transform(tsCode, {
      loader: 'ts',
      target: 'esnext',
      sourcemap: false,
    });
    return result.code;
  } catch (err) {
    const error = new Error(`TypeScript syntax error: ${err.message}`);
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'TS_SYNTAX_ERROR';
    throw error;
  }
}

// ── Main parse function ─────────────────────────────────────────────

/**
 * Parse a .ts/.js component source file into a ParseResult IR.
 *
 * @param {string} filePath — Absolute path to the source file
 * @returns {Promise<ParseResult>}
 * @throws {Error} with code MISSING_DEFINE_COMPONENT, TEMPLATE_NOT_FOUND, STYLES_NOT_FOUND, TS_SYNTAX_ERROR
 */
export async function parse(filePath) {
  // 1. Read the source file
  const rawSource = readFileSync(filePath, 'utf-8');

  // 2. Strip macro imports
  let source = stripMacroImport(rawSource);

  // 3. Extract props from generic form BEFORE type stripping (esbuild removes generics)
  const propsFromGeneric = extractPropsGeneric(source);
  const propsObjectNameFromGeneric = extractPropsObjectName(source);

  // 3b. Extract emits from call signatures form BEFORE type stripping
  const emitsFromCallSignatures = extractEmitsFromCallSignatures(source);
  const emitsObjectNameFromGeneric = extractEmitsObjectNameFromGeneric(source);

  // 4. Validate props assignment (before type strip, on original source)
  validatePropsAssignment(source, filePath);

  // 4b. Validate emits assignment (before type strip, on original source)
  validateEmitsAssignment(source, filePath);

  // 5. Strip TypeScript types if .ts file
  const ext = extname(filePath);
  if (ext === '.ts') {
    source = await stripTypes(source);
  }

  // 6. Extract defineComponent
  const componentDef = extractDefineComponent(source);
  if (!componentDef) {
    const error = new Error(
      `Error en '${filePath}': defineComponent() es obligatorio`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'MISSING_DEFINE_COMPONENT';
    throw error;
  }

  const { tag: tagName, template: templatePath, styles: stylesPath } = componentDef;
  const className = toClassName(tagName);
  const sourceDir = dirname(filePath);

  // 7. Resolve external files
  const resolvedTemplatePath = resolve(sourceDir, templatePath);
  if (!existsSync(resolvedTemplatePath)) {
    const error = new Error(
      `Error en '${filePath}': template no encontrado: '${templatePath}'`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'TEMPLATE_NOT_FOUND';
    throw error;
  }
  const template = readFileSync(resolvedTemplatePath, 'utf-8');

  let style = '';
  if (stylesPath) {
    const resolvedStylesPath = resolve(sourceDir, stylesPath);
    if (!existsSync(resolvedStylesPath)) {
      const error = new Error(
        `Error en '${filePath}': styles no encontrado: '${stylesPath}'`
      );
      /** @ts-expect-error — custom error code for programmatic handling */
      error.code = 'STYLES_NOT_FOUND';
      throw error;
    }
    style = readFileSync(resolvedStylesPath, 'utf-8');
  }

  // 8. Extract lifecycle hooks (before other extractions to avoid misidentification)
  const { onMountHooks, onDestroyHooks } = extractLifecycleHooks(source);

  // 8b. Strip lifecycle hook blocks from source to prevent signal/computed/effect/function
  // extractors from misidentifying code inside hook bodies
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

  // 9. Extract reactive declarations and functions (from filtered source)
  const signals = extractSignals(sourceForExtraction);
  const computeds = extractComputeds(sourceForExtraction);
  const effects = extractEffects(sourceForExtraction);
  const watchers = extractWatchers(source); // Extract from unfiltered source (like lifecycle hooks)
  const methods = extractFunctions(sourceForExtraction);
  const refs = extractRefs(sourceForExtraction);
  const constantVars = extractConstants(sourceForExtraction);

  // 9. Extract props (array form — after type strip, if generic didn't find any)
  const propsFromArray = propsFromGeneric.length > 0 ? [] : extractPropsArray(source);
  let propNames = propsFromGeneric.length > 0 ? propsFromGeneric : propsFromArray;

  // 10. Extract props defaults (after type strip)
  const propsDefaults = extractPropsDefaults(source);

  // If neither generic nor array form found props, but defaults were found,
  // use the defaults object keys as prop names (object-only form: defineProps({ key: val }))
  if (propNames.length === 0 && Object.keys(propsDefaults).length > 0) {
    propNames = Object.keys(propsDefaults);
  }

  // 11. Extract propsObjectName (use generic result if found, otherwise post-strip)
  const propsObjectName = propsObjectNameFromGeneric ?? extractPropsObjectName(source);

  // 12. Validate props
  validateDuplicateProps(propNames, filePath);

  const signalNameSet = new Set(signals.map(s => s.name));
  const computedNameSet = new Set(computeds.map(c => c.name));
  // No constant extraction in v2 core, but use an empty set for validation
  const constantNameSet = new Set(constantVars.map(v => v.name));
  validatePropsConflicts(propsObjectName, signalNameSet, computedNameSet, constantNameSet, filePath);

  // 13. Build PropDef[]
  /** @type {PropDef[]} */
  const propDefs = propNames.map(name => ({
    name,
    default: propsDefaults[name] ?? 'undefined',
    attrName: camelToKebab(name),
  }));

  // 14. Extract emits (array form — after type strip, if call signatures didn't find any)
  const emitsFromArray = emitsFromCallSignatures.length > 0 ? [] : extractEmits(source);
  const emitNames = emitsFromCallSignatures.length > 0 ? emitsFromCallSignatures : emitsFromArray;

  // 15. Extract emitsObjectName (use generic result if found, otherwise post-strip)
  const emitsObjectName = emitsObjectNameFromGeneric ?? extractEmitsObjectName(source);

  // 16. Validate emits
  validateDuplicateEmits(emitNames, filePath);

  const propNameSet = new Set(propNames);
  validateEmitsConflicts(emitsObjectName, signalNameSet, computedNameSet, constantNameSet, propNameSet, propsObjectName, filePath);
  validateUndeclaredEmits(source, emitsObjectName, emitNames, filePath);

  // 17. Return ParseResult
  return {
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
    onMountHooks,
    onDestroyHooks,
    refs,
  };
}
