/**
 * Vue adapter for WCC defineModel — enables v-model and multi-model binding.
 *
 * Setup (ONE line in main.js):
 *   import { createApp } from 'vue'
 *   import { wccVue } from '@sprlab/wccompiler/adapters/vue'
 *
 *   const app = createApp(App)
 *   app.use(wccVue)  // registers adapter + v-wcc-model directive globally
 *   app.mount('#app')
 *
 * IMPORTANT: Also use wccVuePlugin() in vite.config.js to enable v-model:propName
 * on custom elements (via AST nodeTransform):
 *   import { wccVuePlugin } from '@sprlab/wccompiler/integrations/vue'
 *   export default { plugins: [wccVuePlugin()] }
 *
 * With both configured, you can use:
 *   <!-- Native v-model:propName (preferred, requires wccVuePlugin) -->
 *   <wcc-input v-model:value="text"></wcc-input>
 *   <wcc-form v-model:count="countRef" v-model:title="titleRef"></wcc-form>
 *
 *   <!-- v-model without argument (uses modelValue convention) -->
 *   <wcc-input v-model="text"></wcc-input>
 *
 *   <!-- Fallback directive (for non-Vite setups without nodeTransform) -->
 *   <wcc-input v-wcc-model:value="textRef"></wcc-input>
 *
 * @module @sprlab/wccompiler/adapters/vue
 */

// ── Document-level adapter: wcc:model → update:propName ─────────────
// This enables Vue's native v-model on WCC custom elements.
// Vue v-model on custom elements listens for `update:modelValue` by default.
// The nodeTransform in wccVuePlugin makes v-model:propName listen for `update:propName`.
//
// IMPORTANT: We listen in CAPTURE phase so the update:propName event is dispatched
// BEFORE Vue's own bubble-phase listeners process the element. This ensures Vue
// picks up the translated event synchronously.

if (typeof document !== 'undefined') {
  document.addEventListener('wcc:model', (e) => {
    const { prop, value } = e.detail;
    // Dispatch update:propName synchronously on the target element.
    // bubbles:false because Vue listens directly on the element via addEventListener.
    e.target.dispatchEvent(new CustomEvent(`update:${prop}`, {
      detail: value,
      bubbles: false
    }));
  }, true); // ← capture phase
}

// ── Vue directive: v-wcc-model ──────────────────────────────────────
// Fallback for non-Vite setups. If using wccVuePlugin(), prefer v-model:propName instead.
//
// Usage:
//   <wcc-input v-wcc-model:value="textRef"></wcc-input>
//
// The bound value MUST be a Vue ref (or reactive property).
// The directive writes directly to ref.value for WCC→Vue updates.

/**
 * Vue custom directive for two-way binding with WCC defineModel props.
 * This is a FALLBACK — prefer v-model:propName with wccVuePlugin() nodeTransform.
 *
 * @example
 * <wcc-counter v-wcc-model:count="myCountRef"></wcc-counter>
 */
export const vWccModel = {
  mounted(el, binding) {
    const propName = binding.arg;
    if (!propName) {
      console.warn('[v-wcc-model] Missing argument. Usage: v-wcc-model:propName="ref"');
      return;
    }

    // Set initial value (parent → child)
    // Vue sets camelCase attributes, so set both camelCase and kebab-case
    if (binding.value != null) {
      el.setAttribute(propName, String(binding.value));
    }

    // Listen for child → parent changes
    const wccHandler = (e) => {
      if (e.detail && e.detail.prop === propName) {
        const newValue = e.detail.value;

        // Try to update the Vue ref directly
        // In Vue 3, if the binding expression is a ref, binding.value is the ref's current value
        // We need to find the ref on the component instance and write to it
        const instance = binding.instance;
        if (instance) {
          // Access the setup state to find the ref
          const setupState = instance.$.setupState;
          // The binding expression is stored in the directive's internal data
          // In Vue 3, we can use the dir's exp to find the variable name
          // Fallback: emit a custom event that a parent @update handler can catch
          const refName = binding.dir?.__wccRefName?.[el]?.[propName];
          if (refName && setupState[refName] !== undefined) {
            // Direct ref write
            if (setupState[refName]?.value !== undefined) {
              setupState[refName].value = newValue;
            } else {
              setupState[refName] = newValue;
            }
          } else {
            // Fallback: try to find by matching current value
            for (const key of Object.keys(setupState)) {
              const val = setupState[key];
              if (val?.value === binding.value || val === binding.value) {
                if (val?.value !== undefined) {
                  val.value = newValue;
                } else {
                  setupState[key] = newValue;
                }
                break;
              }
            }
          }
        }
      }
    };

    el.addEventListener('wcc:model', wccHandler);
    el.__wccModelHandlers = el.__wccModelHandlers || {};
    el.__wccModelHandlers[propName] = wccHandler;
  },

  updated(el, binding) {
    const propName = binding.arg;
    if (!propName) return;

    // Sync parent → child on updates
    if (binding.value != null) {
      el.setAttribute(propName, String(binding.value));
    } else {
      el.removeAttribute(propName);
    }
  },

  beforeUnmount(el, binding) {
    const propName = binding.arg;
    if (!propName) return;

    const handler = el.__wccModelHandlers?.[propName];
    if (handler) {
      el.removeEventListener('wcc:model', handler);
      delete el.__wccModelHandlers[propName];
    }
  }
};

// ── Vue Plugin: app.use(wccVue) ─────────────────────────────────────

/**
 * Vue plugin that registers the v-wcc-model directive globally.
 * The document-level adapter is registered on import (side-effect above).
 *
 * @example
 * import { createApp } from 'vue'
 * import { wccVue } from '@sprlab/wccompiler/adapters/vue'
 *
 * const app = createApp(App)
 * app.use(wccVue)
 * app.mount('#app')
 */
export const wccVue = {
  install(app) {
    app.directive('wcc-model', vWccModel);
  }
};
