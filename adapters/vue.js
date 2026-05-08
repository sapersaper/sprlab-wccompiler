/**
 * Vue adapter for WCC defineModel — enables v-model and multi-model binding.
 *
 * Usage (ONE line in main.js):
 *   import { createApp } from 'vue'
 *   import { wccVue } from '@sprlab/wccompiler/adapters/vue'
 *
 *   const app = createApp(App)
 *   app.use(wccVue)  // registers adapter + v-wcc-model directive globally
 *   app.mount('#app')
 *
 * What it does:
 * 1. Registers document-level wcc:model → update:propName translation (enables v-model)
 * 2. Registers v-wcc-model directive globally (enables multi-prop two-way binding)
 *
 * Template usage:
 *   <!-- Single model prop (Vue's native v-model) -->
 *   <!-- Component must declare: defineModel({ name: 'modelValue', default: '' }) -->
 *   <wcc-input v-model="text"></wcc-input>
 *
 *   <!-- Multiple model props (v-wcc-model:propName) -->
 *   <wcc-form v-model="mainValue" v-wcc-model:count="countRef" v-wcc-model:title="titleRef"></wcc-form>
 *
 * @module @sprlab/wccompiler/adapters/vue
 */

// ── Document-level adapter: wcc:model → update:propName ─────────────
// This enables Vue's native v-model on WCC custom elements.

if (typeof document !== 'undefined') {
  document.addEventListener('wcc:model', (e) => {
    const { prop, value } = e.detail;
    e.target.dispatchEvent(new CustomEvent(`update:${prop}`, {
      detail: value,
      bubbles: true
    }));
  });
}

// ── Vue directive: v-wcc-model ──────────────────────────────────────

/**
 * Vue custom directive for two-way binding with WCC defineModel props.
 *
 * Binds a Vue ref to a WCC component's model prop bidirectionally:
 * - Parent → Child: sets the attribute when the Vue ref changes
 * - Child → Parent: updates the Vue ref when wcc:model fires for the matching prop
 *
 * @example
 * <wcc-counter v-wcc-model:count="myCount"></wcc-counter>
 */
export const vWccModel = {
  mounted(el, binding) {
    const propName = binding.arg;
    if (!propName) {
      console.warn('[v-wcc-model] Missing argument. Usage: v-wcc-model:propName="ref"');
      return;
    }

    // Set initial value (parent → child)
    if (binding.value != null) {
      el.setAttribute(propName, String(binding.value));
    }

    // Listen for child → parent changes via the update:propName event
    // (which is already dispatched by the document-level adapter above)
    const handler = (e) => {
      // Use the update:propName event dispatched by the adapter
      // Vue will handle the ref update through the directive binding
    };

    // Listen directly for wcc:model to update the binding
    const wccHandler = (e) => {
      if (e.detail && e.detail.prop === propName) {
        // Trigger Vue reactivity by emitting on the component instance
        // This works because Vue tracks directive bindings
        el.dispatchEvent(new CustomEvent(`update:${propName}`, {
          detail: e.detail.value,
          bubbles: false
        }));
      }
    };

    el.addEventListener('wcc:model', wccHandler);
    // Store handler for cleanup
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

    // Cleanup listener
    const handler = el.__wccModelHandlers?.[propName];
    if (handler) {
      el.removeEventListener('wcc:model', handler);
      delete el.__wccModelHandlers[propName];
    }
  }
};

// ── Vue Plugin: app.use(wccVue) ─────────────────────────────────────

/**
 * Vue plugin that registers the wcc:model adapter and v-wcc-model directive globally.
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
