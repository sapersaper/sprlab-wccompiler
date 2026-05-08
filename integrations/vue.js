/**
 * Vue Vite plugin for WCC custom elements.
 * Configures isCustomElement and enables v-model:propName on custom elements.
 *
 * @module @sprlab/wccompiler/integrations/vue
 *
 * IMPORTANT: This file is for vite.config.js (Node.js context).
 * For browser-side, use app.use(wccVue) from '@sprlab/wccompiler/adapters/vue'.
 *
 * @example vite.config.js
 * ```js
 * import { wccVuePlugin } from '@sprlab/wccompiler/integrations/vue'
 * export default { plugins: [wccVuePlugin()] }
 * ```
 *
 * @example main.js (optional — only needed if NOT using wccVuePlugin)
 * ```js
 * import { wccVue } from '@sprlab/wccompiler/adapters/vue'
 * app.use(wccVue)
 * ```
 *
 * With wccVuePlugin(), v-model:propName works natively on WCC custom elements:
 * ```vue
 * <wcc-input v-model="text"></wcc-input>
 * <wcc-form v-model:count="countRef" v-model:title="titleRef"></wcc-form>
 * ```
 *
 * How it works:
 * The plugin runs BEFORE @vitejs/plugin-vue and rewrites the template string:
 *   v-model:count="expr"  →  :count="expr" @count-changed="expr = $event.detail"
 *   v-model="expr"        →  :model-value="expr" @model-value-changed="expr = $event.detail"
 *
 * The WCC component emits `propName-changed` CustomEvent with detail=value on internal writes.
 * Vue compiles @propName-changed as a normal event listener (not filtered like update:*).
 */

import vue from '@vitejs/plugin-vue'

/**
 * @typedef {Object} WccVuePluginOptions
 * @property {string} [prefix='wcc-'] - Tag prefix for custom element detection
 */

/**
 * Vite plugin that pre-transforms v-model:propName on custom elements
 * before Vue's compiler processes the template.
 *
 * This is necessary because Vue's compiler filters out `onUpdate:*` event listeners
 * for custom elements (isModelListener check in patchProp). By rewriting to
 * `@propName-changed`, we use an event name that Vue registers normally.
 *
 * @param {WccVuePluginOptions} [options]
 * @returns {import('vite').Plugin[]}
 */
export function wccVuePlugin(options = {}) {
  const prefix = typeof options.prefix === 'string' ? options.prefix : 'wcc-'

  const preTransformPlugin = {
    name: 'vite-plugin-wcc-vmodel',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.vue')) return null

      let result = code

      // Transform v-model:propName="expr" on custom elements (tags with hyphens)
      // → :propName="expr" @propName-changed="expr = $event.detail"
      // Run in a loop to handle multiple v-model on the same element
      let prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\bv-model:(\w+)="([^"]+)"/,
          (match, prefix, prop, expr) => {
            return `${prefix}:${prop}="${expr}" @${prop}-changed="${expr} = $event.detail"`
          }
        )
      }

      // Transform v-model="expr" (without argument) on custom elements
      // → :model-value="expr" @model-value-changed="expr = $event.detail"
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\bv-model="([^"]+)"/,
          (match, prefix, expr) => {
            return `${prefix}:model-value="${expr}" @model-value-changed="${expr} = $event.detail"`
          }
        )
      }

      // ── Slot transforms ──
      // Transform <template #name>content</template> inside custom elements
      // → <div slot="name">content</div>
      // This prevents Vue from intercepting the slot syntax and erroring.
      // The WCC component's runtime slot parser detects slot="name" on regular elements.

      // Handle <template #name>...</template> (shorthand)
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /<template\s+#(\w+)>([\s\S]*?)<\/template>/,
          (match, slotName, content) => {
            return `<div slot="${slotName}">${content}</div>`
          }
        )
      }

      // Handle <template v-slot:name>...</template> (verbose)
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /<template\s+v-slot:(\w+)>([\s\S]*?)<\/template>/,
          (match, slotName, content) => {
            return `<div slot="${slotName}">${content}</div>`
          }
        )
      }

      if (result !== code) return result
      return null
    }
  }

  const vuePlugin = vue({
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith(prefix)
      }
    }
  })

  return [preTransformPlugin, vuePlugin]
}
