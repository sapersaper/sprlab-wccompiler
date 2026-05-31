/**
 * Build the initial ParseResult object from extracted component data.
 *
 * This collects all the parsed metadata (signals, computeds, props, emits, etc.)
 * into a single ParseResult structure ready for template processing.
 *
 * @param {object} params
 * @param {string} params.tagName
 * @param {string} params.className
 * @param {string} params.template
 * @param {string | null} params.style
 * @param {import('../types.js').ReactiveVar[]} params.signals
 * @param {import('../types.js').ComputedDef[]} params.computeds
 * @param {import('../types.js').EffectDef[]} params.effects
 * @param {import('../types.js').ConstantVar[]} params.constantVars
 * @param {import('../types.js').WatcherDef[]} params.watchers
 * @param {import('../types.js').MethodDef[]} params.methods
 * @param {import('../types.js').PropDef[]} params.propDefs
 * @param {string | null} params.propsObjectName
 * @param {string[]} params.emits
 * @param {string | null} params.emitsObjectName
 * @param {import('../types.js').LifecycleHook[]} params.onMountHooks
 * @param {import('../types.js').LifecycleHook[]} params.onDestroyHooks
 * @param {import('../types.js').LifecycleHook[]} params.onAdoptHooks
 * @param {import('../types.js').RefDeclaration[]} params.refs
 * @param {string[]} params.exposeNames
 * @param {{ varName: string, name: string, default: string, required: boolean }[]} params.modelDefs
 * @param {boolean} params.usesBatch
 * @returns {import('../types.js').ParseResult}
 */
export function buildParseResult({ tagName, className, template, style, signals, computeds, effects, constantVars, watchers, methods, propDefs, propsObjectName, emits, emitsObjectName, onMountHooks, onDestroyHooks, onAdoptHooks, refs, exposeNames, modelDefs, usesBatch }) {
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
    emits,
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
    dynamicComponents: [],
    usesBatch,
  };
}
