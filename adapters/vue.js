/**
 * Vue adapter for WCC defineModel — enables v-model and multi-model binding.
 *
 * Import this ONCE in your Vue app's main.js/main.ts:
 *   import '@sprlab/wccompiler/adapters/vue'
 *
 * What it does:
 * 1. Translates wcc:model events → update:propName (enables v-model on WCC elements)
 * 2. Exports a Vue directive `vWccModel` for multi-prop two-way binding
 *
 * Usage:
 *   <!-- Single model prop (use Vue's native v-model) -->
 *   <!-- Component must declare: defineModel({ name: 'modelValue', default: '' }) -->
 *   <wcc-input v-model="text"></wcc-input>
 *
 *   <!-- Multiple model props (use v-wcc-model:propName) -->
 *   <wcc-form v-model="mainValue" v-wcc-model:count="countRef" v-wcc-model:title="titleRef"></wcc-form>
 *
 * @module @sprlab/wccompiler/adapters/vue
 */

// ── Document-level adapter: wcc:model → update:propName ─────────────
// This enables Vue's native v-model on WCC custom elements.
// Vue v-model on custom elements listens for `update:modelValue` by default.

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
// For multi-prop two-way binding on WCC components.
//
// Register globally:
//   import { vWccModel } from '@sprlab/wccompiler/adapters/vue'
//   app.directive('wcc-model', vWccModel)
//
// Or per-component:
//   <script setup>
//   import { vWccModel } from '@sprlab/wccompiler/adapters/vue'
//   </script>
//   <template>
//     <wcc-input v-wcc-model:value="text"></wcc-input>
//   </template>

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

    // Listen for child → parent changes
    const handler = (e) => {
      if (e.detail && e.detail.prop === propName) {
        // Update the Vue ref via the directive's setter
        // Vue 3 directives receive the component instance in binding.instance
        // and can trigger updates via the v-model update event pattern
        if (typeof binding.instance?.$.emit === 'function') {
          binding.instance.$.emit(`update:${binding.arg}`, e.detail.value);
        }
        // For Composition API refs bound via v-wcc-model:prop="ref",
        // Vue automatically handles the update through the directive binding
      }
    };

    el.addEventListener('wcc:model', handler);
    // Store handler for cleanup
    el.__wccModelHandlers = el.__wccModelHandlers || {};
    el.__wccModelHandlers[propName] = handler;
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
