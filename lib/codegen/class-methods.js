/**
 * Class methods generation — disconnectedCallback, adoptedCallback,
 * attributeChangedCallback, public getters/setters, _emit, _modelSet,
 * model wrappers, __scopedSlots, __batch, user methods, ref getters, defineExpose.
 */

import { transformMethodBody } from '../transform/expr-transformer.js';
import { camelToKebab } from '../utils.js';

/**
 * @param {string[]} lines
 * @param {import('../types.js').ParseResult} parseResult
 * @param {object} state
 * @param {string[]} state.signalNames
 * @param {string[]} state.computedNames
 * @param {string[]} state.methodNames
 * @param {string[]} state.constantNames
 * @param {Set<string>} state.propNames
 * @param {string|null} state.propsObjectName
 * @param {string|null} state.emitsObjectName
 * @param {Map<string,string>} state.modelVarMap
 * @param {string[]} state.refVarNames
 * @param {{ comments?: boolean }} [options]
 */
export function generateClassMethods(lines, parseResult, state = {}, options = {}) {
  const {
    signalNames = [],
    computedNames = [],
    methodNames = [],
    constantNames = [],
    propNames = new Set(),
    propsObjectName = null,
    emitsObjectName = null,
    modelVarMap = new Map(),
    refVarNames = [],
  } = state;

  const {
    methods = [],
    propDefs = [],
    modelDefs = [],
    signals = [],
    emits = [],
    onDestroyHooks = [],
    onAdoptHooks = [],
    refs = [],
    refBindings = [],
    exposeNames = [],
    slots = [],
    forBlocks = [],
    usesBatch = false,
  } = parseResult;

  // disconnectedCallback (cleanup: abort listeners)
  lines.push('  disconnectedCallback() {');
  lines.push('    this.__connected = false;');
  lines.push('    this.__ac.abort();');
  // Lifecycle: onDestroy hooks
  for (const hook of onDestroyHooks) {
    const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
    if (hook.async) {
      lines.push('    ;(async () => {');
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        lines.push(`      ${line}`);
      }
      lines.push('    })();');
    } else {
      const bodyLines = body.split('\n');
      for (const line of bodyLines) {
        const trimmed = line.trimEnd();
        const needsSemi = trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}');
        lines.push(`    ${trimmed}${needsSemi ? ';' : ''}`);
      }
    }
  }
  lines.push('  }');
  lines.push('');

  // adoptedCallback (if onAdopt hooks exist)
  if (onAdoptHooks.length > 0) {
    lines.push('  adoptedCallback() {');
    for (const hook of onAdoptHooks) {
      const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
      if (hook.async) {
        lines.push('    ;(async () => {');
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          lines.push(`      ${line}`);
        }
        lines.push('    })();');
      } else {
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          const trimmed = line.trimEnd();
          const needsSemi = trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}');
          lines.push(`    ${trimmed}${needsSemi ? ';' : ''}`);
        }
      }
    }
    lines.push('  }');
    lines.push('');
  }

  // attributeChangedCallback (if props or model props exist)
  if (propDefs.length > 0 || modelDefs.length > 0) {
    const modelAttrNames = modelDefs.map(md => camelToKebab(md.name));

    lines.push('  attributeChangedCallback(name, oldVal, newVal) {');
    for (const p of propDefs) {
      const defaultVal = p.default;
      let updateExpr;

      if (defaultVal === 'true' || defaultVal === 'false') {
        // Boolean coercion: also handle "false" string from framework attribute bindings
        updateExpr = `this._state.${p.name} = newVal !== null && newVal !== 'false'`;
      } else if (/^-?\d+(\.\d+)?$/.test(defaultVal)) {
        // Number coercion
        updateExpr = `this._state.${p.name} = newVal != null ? Number(newVal) : ${defaultVal}`;
      } else if (defaultVal === 'undefined') {
        // Undefined default — pass through
        updateExpr = `this._state.${p.name} = newVal`;
      } else {
        // String default — use nullish coalescing
        updateExpr = `this._state.${p.name} = newVal ?? ${defaultVal}`;
      }

      lines.push(`    if (name === '${p.attrName}') {`);
      lines.push(`      ${updateExpr};`);

      // Sync signals that were initialized from this prop (e.g., count = signal(props.initialCount))
      if (propsObjectName) {
        for (const s of signals) {
          if (s.value === `${propsObjectName}.${p.name}`) {
            lines.push(`      this._state.${s.name} = this._state.${p.name};`);
          }
        }
      }
      lines.push('    }');
    }

    // Model props — update state directly (NO event emission)
    for (let i = 0; i < modelDefs.length; i++) {
      const md = modelDefs[i];
      const attrName = modelAttrNames[i];
      const camelName = md.name;
      const defaultVal = md.default;
      let updateExpr;

      if (defaultVal === 'true' || defaultVal === 'false') {
        // Boolean coercion: also handle "false" string from framework attribute bindings
        updateExpr = `this._state.${md.name} = newVal !== null && newVal !== 'false'`;
      } else if (/^-?\d+(\.\d+)?$/.test(defaultVal)) {
        // Number coercion
        updateExpr = `this._state.${md.name} = newVal != null ? Number(newVal) : ${defaultVal}`;
      } else if (defaultVal === 'undefined') {
        // Undefined default — pass through
        updateExpr = `this._state.${md.name} = newVal`;
      } else {
        // String default — use nullish coalescing
        updateExpr = `this._state.${md.name} = newVal ?? ${defaultVal}`;
      }

      // Handle both kebab-case (native HTML) and camelCase (Vue) attribute names
      if (attrName !== camelName) {
        lines.push(`    if (name === '${attrName}' || name === '${camelName}') ${updateExpr};`);
      } else {
        lines.push(`    if (name === '${attrName}') ${updateExpr};`);
      }
    }

    lines.push('  }');
    lines.push('');

    // Public getters and setters
    for (const p of propDefs) {
      lines.push(`  get ${p.name}() { return this._state.${p.name}; }`);
      lines.push(`  set ${p.name}(val) { this._state.${p.name} = val; this.setAttribute('${p.attrName}', String(val)); }`);
      lines.push('');
    }

    // Public getters and setters for model props
    for (let i = 0; i < modelDefs.length; i++) {
      const md = modelDefs[i];
      const attrName = modelAttrNames[i];
      lines.push(`  get ${md.name}() { return this._state.${md.name}; }`);
      lines.push(`  set ${md.name}(val) { this._state.${md.name} = val; this.setAttribute('${attrName}', String(val)); }`);
      lines.push('');
    }
  }

  // _emit method (if emits declared)
  // Emits only the kebab-case event name. Framework plugins handle any
  // name adaptation needed (React plugin → ref+addEventListener, Vue natively).
  if (emits.length > 0) {
    lines.push('  _emit(name, detail) {');
    lines.push('    const evt = { detail, bubbles: true, composed: true };');
    lines.push('    this.dispatchEvent(new CustomEvent(name, evt));');
    lines.push('  }');
    lines.push('');
  }

  // _modelSet methods (one per defineModel prop — emits events on internal write)
  // Emits:
  //   1. wcc:model — canonical event for vanilla JS, WCC-to-WCC, adapters
  //   2. propName-changed — kebab-case for Web Components standard
  for (const md of modelDefs) {
    const eventName = md.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '-changed';
    lines.push(`  _modelSet_${md.name}(newVal) {`);
    lines.push(`    const oldVal = this._state.${md.name};`);
    lines.push(`    this._state.${md.name} = newVal;`);
    lines.push(`    this.dispatchEvent(new CustomEvent('wcc:model', {`);
    lines.push(`      detail: { prop: '${md.name}', value: newVal, oldValue: oldVal },`);
    lines.push(`      bubbles: true,`);
    lines.push(`      composed: true`);
    lines.push(`    }));`);
    lines.push(`    this.dispatchEvent(new CustomEvent('${eventName}', { detail: newVal, bubbles: true }));`);
    lines.push('  }');
    lines.push('');
  }

  // Wrapper methods for defineModel signals (dual getter/setter)
  // These act as the interface between template code and internal signals
  // - As getter (no args): returns state value
  // - As setter (with arg): calls _modelSet_* to update and dispatch events
  if (modelDefs.length > 0) {
    lines.push('  // --- Model wrapper methods ---');
    for (const md of modelDefs) {
      lines.push(`  _${md.name}(val) {`);
      lines.push(`    if (arguments.length === 0) {`);
      lines.push(`      return this._state.${md.name};`);
      lines.push(`    } else {`);
      lines.push(`      this._modelSet_${md.name}(val);`);
      lines.push(`    }`);
      lines.push(`  }`);
      lines.push('');
    }
  }

  // __scopedSlots instance getter and registerSlotRenderer (if scoped slots exist)
  const scopedSlotNames = slots.filter(s => s.name && s.slotProps.length > 0).map(s => s.name);
  for (const fb of forBlocks) {
    for (const s of (fb.slots || [])) {
      if (s.name && s.slotProps.length > 0 && !scopedSlotNames.includes(s.name)) {
        scopedSlotNames.push(s.name);
      }
    }
  }
  if (scopedSlotNames.length > 0) {
    lines.push('  get __scopedSlots() { return this.constructor.__scopedSlots || []; }');
    lines.push('');
    lines.push('  registerSlotRenderer(slotName, callback) {');
    lines.push('    if (!this.__slotRenderers) this.__slotRenderers = {};');
    lines.push('    this.__slotRenderers[slotName] = callback;');
    lines.push('    if (this.__slotProps && this.__slotProps[slotName]) {');
    lines.push('      callback(this.__slotProps[slotName]);');
    lines.push('    }');
    lines.push('    return () => {');
    lines.push('      if (this.__slotRenderers) {');
    lines.push('        delete this.__slotRenderers[slotName];');
    lines.push('      }');
    lines.push('    };');
    lines.push('  }');
    lines.push('');
  }

  // Phase 4: Per-component batch method (replaces shared __batch runtime)
  if (usesBatch) {
    lines.push('  __batch(fn) {');
    lines.push('    this.__batching = true;');
    lines.push('    try { fn(); } finally {');
    lines.push('      this.__batching = false;');
    lines.push('      for (const key of this.__batchKeys) {');
    lines.push('        this.__invalidate(key);');
    lines.push('      }');
    lines.push('      this.__batchKeys.clear();');
    lines.push('    }');
    lines.push('  }');
    lines.push('');
  }

  // User methods (prefixed with _)
  if (methods.length > 0 && options.comments) lines.push('');
  if (methods.length > 0 && options.comments) lines.push('  // --- Methods ---');
  for (const m of methods) {
    const body = transformMethodBody(m.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames, modelVarMap, methodNames);
    const asyncPrefix = m.async ? 'async ' : '';
    lines.push(`  ${asyncPrefix}_${m.name}(${m.params}) {`);
    const bodyLines = body.split('\n');
    for (const line of bodyLines) {
      lines.push(`    ${line}`);
    }
    lines.push('  }');
    lines.push('');
  }

  // ── Ref getter properties ──
  for (const rd of refs) {
    // Find matching RefBinding
    const rb = refBindings.find(b => b.refName === rd.refName);
    if (rb) {
      lines.push(`  get _${rd.varName}() { return { value: this._ref_${rd.refName} }; }`);
      lines.push('');
    }
  }

  // ── defineExpose: public getters/methods ──
  for (const name of exposeNames) {
    if (computedNames.includes(name)) {
      lines.push(`  get ${name}() { return this._state.${name}; }`);
    } else if (signalNames.includes(name)) {
      lines.push(`  get ${name}() { return this._state.${name}; }`);
    } else if (methodNames.includes(name)) {
      lines.push(`  ${name}(...args) { return this._${name}(...args); }`);
    } else if (constantNames.includes(name)) {
      lines.push(`  get ${name}() { return this._const_${name}; }`);
    }
  }
  if (exposeNames.length > 0) lines.push('');
}
