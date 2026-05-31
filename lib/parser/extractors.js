/**
 * Re-export shim for parser extraction functions.
 *
 * All functions have been split into focused sub-modules under
 * lib/parser/extractors/ for better maintainability.
 */

export { camelToKebab, escapeRegex } from '../utils.js';

/**
 * Convert a kebab-case tag name to PascalCase class name.
 * e.g. "wcc-counter" → "WccCounter"
 *
 * @param {string} tagName
 * @returns {string}
 */
export function toClassName(tagName) {
  return tagName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export { extractPropsGeneric, extractPropsArray, extractPropsDefaults, extractPropsObjectName } from './extractors/props.js';
export { extractEmitsFromCallSignatures, extractEmits, extractEmitsObjectName, extractEmitsObjectNameFromGeneric } from './extractors/emits.js';
export { extractSignals, extractSignalArgument, extractComputeds, extractEffects, extractWatchers, extractConstants } from './extractors/reactivity.js';
export { extractLifecycleHooks, extractFunctions, extractDefineComponent, stripMacroImport, REACTIVE_CALLS } from './extractors/lifecycle.js';
export { extractRefs, extractExpose, extractModels, detectBatchUsage } from './extractors/refs.js';
