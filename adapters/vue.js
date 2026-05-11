/**
 * Vue adapter for WCC defineModel (OPTIONAL — only needed without wccVuePlugin).
 *
 * If you use wccVuePlugin() in vite.config.js, you DON'T need this adapter.
 * The plugin handles v-model:propName transformation at build time.
 *
 * This adapter is for non-Vite setups (webpack, etc.) where you can't use
 * the Vite pre-transform plugin. It provides a Vue directive for two-way binding.
 *
 * Setup:
 *   import { createApp } from 'vue'
 *   import { wccVue } from '@sprlab/wccompiler/adapters/vue'
 *   app.use(wccVue)
 *
 * Usage:
 *   <wcc-input v-wcc-model:value="textRef"></wcc-input>
 *   <wcc-form v-wcc-model:count="countRef"></wcc-form>
 *
 * @module @sprlab/wccompiler/adapters/vue
 */

// ── Vue directive: v-wcc-model ──────────────────────────────────────
// Fallback for non-Vite setups. Listens for propName-changed events directly.

/**
 * Vue custom directive for two-way binding with WCC defineModel props.
 * Listens for `propName-changed` CustomEvent (emitted by WCC _modelSet).
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

    // Listen for propName-changed (WCC → Vue)
    const kebabName = propName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const handler = (e) => {
      // Try to update the Vue ref via setupState
      const instance = binding.instance;
      if (instance) {
        const setupState = instance.$.setupState;
        // Find the ref that matches the current binding value
        for (const key of Object.keys(setupState)) {
          const val = setupState[key];
          if (val === binding.value || val?.value === binding.value) {
            if (val?.value !== undefined) {
              val.value = e.detail;
            } else {
              setupState[key] = e.detail;
            }
            break;
          }
        }
      }
    };

    el.addEventListener(`${kebabName}-changed`, handler);
    el.__wccModelHandlers = el.__wccModelHandlers || {};
    el.__wccModelHandlers[propName] = { handler, eventName: `${kebabName}-changed` };
  },

  updated(el, binding) {
    const propName = binding.arg;
    if (!propName) return;

    if (binding.value != null) {
      el.setAttribute(propName, String(binding.value));
    } else {
      el.removeAttribute(propName);
    }
  },

  beforeUnmount(el, binding) {
    const propName = binding.arg;
    if (!propName) return;

    const entry = el.__wccModelHandlers?.[propName];
    if (entry) {
      el.removeEventListener(entry.eventName, entry.handler);
      delete el.__wccModelHandlers[propName];
    }
  }
};

// ── Vue Plugin ──────────────────────────────────────────────────────

/**
 * Vue plugin that registers v-wcc-model directive globally.
 * Only needed if NOT using wccVuePlugin() in vite.config.js.
 */
export const wccVue = {
  install(app) {
    app.directive('wcc-model', vWccModel);
  }
};
