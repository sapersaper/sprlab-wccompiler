/**
 * Validation functions for props, emits, and name collisions.
 *
 * These functions validate component declarations extracted by the parser
 * and throw descriptive errors with .code properties for programmatic handling.
 */

import { escapeRegex, extractEmitsObjectName, extractEmitsObjectNameFromGeneric } from './extractors.js';

// ── Props validation ────────────────────────────────────────────────

/**
 * Validate that defineProps is assigned to a variable (if props are accessed via object).
 * No longer throws — bare defineProps() calls are valid when props are only used in template.
 *
 * @param {string} _source
 * @param {string} _fileName
 */
export function validatePropsAssignment(_source, _fileName) {
  // No-op: bare defineProps() is valid in .wcc SFC format
  // Props are accessible in the template without needing a variable reference
}

/**
 * Validate that there are no duplicate prop names.
 *
 * @param {string[]} propNames
 * @param {string} fileName
 */
export function validateDuplicateProps(propNames, fileName) {
  const seen = new Set();
  const duplicates = new Set();
  for (const p of propNames) {
    if (seen.has(p)) duplicates.add(p);
    seen.add(p);
  }
  if (duplicates.size > 0) {
    const names = [...duplicates].join(', ');
    const error = new Error(
      `Error en '${fileName}': props duplicados: ${names}`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'DUPLICATE_PROPS';
    throw error;
  }
}

/**
 * Validate that the propsObjectName doesn't collide with signals, computeds, or constants.
 *
 * @param {string|null} propsObjectName
 * @param {Set<string>} signalNames
 * @param {Set<string>} computedNames
 * @param {Set<string>} constantNames
 * @param {string} fileName
 */
export function validatePropsConflicts(propsObjectName, signalNames, computedNames, constantNames, fileName) {
  if (!propsObjectName) return;

  if (signalNames.has(propsObjectName) || computedNames.has(propsObjectName) || constantNames.has(propsObjectName)) {
    const error = new Error(
      `Error en '${fileName}': '${propsObjectName}' colisiona con una declaración existente`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'PROPS_OBJECT_CONFLICT';
    throw error;
  }
}

// ── Emits validation ────────────────────────────────────────────────

/**
 * Validate that defineEmits is assigned to a variable.
 * Throws EMITS_ASSIGNMENT_REQUIRED if bare defineEmits() call detected.
 *
 * @param {string} source
 * @param {string} fileName
 */
export function validateEmitsAssignment(source, fileName) {
  // Check if defineEmits appears in source
  if (!/defineEmits\s*[<(]/.test(source)) return;

  // Check if it's assigned to a variable (either generic or non-generic form)
  if (extractEmitsObjectName(source) !== null) return;
  if (extractEmitsObjectNameFromGeneric(source) !== null) return;

  const error = new Error(
    `Error en '${fileName}': defineEmits() debe asignarse a una variable (const emit = defineEmits(...))`
  );
  /** @ts-expect-error — custom error code for programmatic handling */
  error.code = 'EMITS_ASSIGNMENT_REQUIRED';
  throw error;
}

/**
 * Validate that there are no duplicate event names.
 *
 * @param {string[]} emitNames
 * @param {string} fileName
 */
export function validateDuplicateEmits(emitNames, fileName) {
  const seen = new Set();
  const duplicates = new Set();
  for (const e of emitNames) {
    if (seen.has(e)) duplicates.add(e);
    seen.add(e);
  }
  if (duplicates.size > 0) {
    const names = [...duplicates].join(', ');
    const error = new Error(
      `Error en '${fileName}': emits duplicados: ${names}`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'DUPLICATE_EMITS';
    throw error;
  }
}

/**
 * Validate that the emitsObjectName doesn't collide with signals, computeds, constants, props, or propsObjectName.
 *
 * @param {string|null} emitsObjectName
 * @param {Set<string>} signalNames
 * @param {Set<string>} computedNames
 * @param {Set<string>} constantNames
 * @param {Set<string>} propNames
 * @param {string|null} propsObjectName
 * @param {string} fileName
 */
export function validateEmitsConflicts(emitsObjectName, signalNames, computedNames, constantNames, propNames, propsObjectName, fileName) {
  if (!emitsObjectName) return;

  if (
    signalNames.has(emitsObjectName) ||
    computedNames.has(emitsObjectName) ||
    constantNames.has(emitsObjectName) ||
    propNames.has(emitsObjectName) ||
    (propsObjectName && emitsObjectName === propsObjectName)
  ) {
    const error = new Error(
      `Error en '${fileName}': '${emitsObjectName}' colisiona con una declaración existente`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'EMITS_OBJECT_CONFLICT';
    throw error;
  }
}

/**
 * Validate that all emit calls use declared event names.
 *
 * @param {string} source
 * @param {string|null} emitsObjectName
 * @param {string[]} emits
 * @param {string} fileName
 */
export function validateUndeclaredEmits(source, emitsObjectName, emits, fileName) {
  if (!emitsObjectName || emits.length === 0) return;

  const emitsSet = new Set(emits);
  const re = RegExp(`\\b${escapeRegex(emitsObjectName)}\\(\\s*['"]([^'"]+)['"]`, 'g');
  let match;
  while ((match = re.exec(source)) !== null) {
    const eventName = match[1];
    if (!emitsSet.has(eventName)) {
      const error = new Error(
        `Error en '${fileName}': emit no declarado: '${eventName}'`
      );
      /** @ts-expect-error — custom error code for programmatic handling */
      error.code = 'UNDECLARED_EMIT';
      throw error;
    }
  }
}

// ── Name collision validation ────────────────────────────────────────

/**
 * Validate that there are no name collisions between signals, computeds, props, and methods.
 *
 * JavaScript does not allow duplicate identifiers in the same scope, so having a signal
 * and a function with the same name would cause a runtime error.
 *
 * @param {Set<string>} signalNames - Set of signal variable names
 * @param {Set<string>} computedNames - Set of computed variable names
 * @param {Set<string>} propNames - Set of prop names
 * @param {import('../types.js').MethodDef[]} methods - Array of method definitions
 * @param {string} fileName - File name for error messages
 */
export function validateNameCollisions(signalNames, computedNames, propNames, methods, fileName) {
  const allNames = new Map(); // name -> type

  // Register signals
  for (const name of signalNames) {
    if (allNames.has(name)) {
      const existingType = allNames.get(name);
      throw new Error(
        `Error en '${fileName}': Colisión de nombres - '${name}' está definido como ${existingType} y signal.\n` +
        `Solución: Usa nombres diferentes o convierte a computed().`
      );
    }
    allNames.set(name, 'signal');
  }

  // Register computeds
  for (const name of computedNames) {
    if (allNames.has(name)) {
      const existingType = allNames.get(name);
      throw new Error(
        `Error en '${fileName}': Colisión de nombres - '${name}' está definido como ${existingType} y computed.\n` +
        `Solución: Usa nombres diferentes.`
      );
    }
    allNames.set(name, 'computed');
  }

  // Register props
  for (const name of propNames) {
    if (allNames.has(name)) {
      const existingType = allNames.get(name);
      throw new Error(
        `Error en '${fileName}': Colisión de nombres - '${name}' está definido como ${existingType} y prop.\n` +
        `Solución: Usa nombres diferentes.`
      );
    }
    allNames.set(name, 'prop');
  }

  // Check methods against all other names
  for (const method of methods) {
    if (allNames.has(method.name)) {
      const existingType = allNames.get(method.name);
      throw new Error(
        `Error en '${fileName}': Colisión de nombres - '${method.name}' está definido como ${existingType} y function.\n` +
        `Solución: Usa un nombre diferente para la función (ej: get${method.name.charAt(0).toUpperCase()}${method.name.slice(1)}) o convierte el ${existingType} a una función.`
      );
    }
    // Also check for duplicate method names
    const methodCount = methods.filter(m => m.name === method.name).length;
    if (methodCount > 1) {
      throw new Error(
        `Error en '${fileName}': Función duplicada - '${method.name}' está definida múltiples veces.\n` +
        `Solución: Elimina la definición duplicada.`
      );
    }
  }
}
