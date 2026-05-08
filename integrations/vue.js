/**
 * Vue Vite plugin for WCC custom elements.
 * Configures isCustomElement to recognize WCC component tags.
 *
 * @module @sprlab/wccompiler/integrations/vue
 *
 * IMPORTANT: This file is for vite.config.js (Node.js context).
 * For browser-side model adapter, import '@sprlab/wccompiler/adapters/vue' in your main.js.
 *
 * @example vite.config.js
 * ```js
 * import { wccVuePlugin } from '@sprlab/wccompiler/integrations/vue'
 * export default { plugins: [wccVuePlugin()] }
 * ```
 *
 * @example main.js (browser — enables v-model on WCC components)
 * ```js
 * import '@sprlab/wccompiler/adapters/vue'
 * ```
 */

import vue from '@vitejs/plugin-vue'

/**
 * @typedef {Object} WccVuePluginOptions
 * @property {string} [prefix='wcc-'] - Tag prefix for custom element detection
 */

/**
 * Creates a Vite plugin that configures Vue's template compiler
 * to recognize custom elements with the given prefix.
 *
 * @param {WccVuePluginOptions} [options]
 * @returns {import('vite').Plugin}
 */
export function wccVuePlugin(options = {}) {
  const prefix = typeof options.prefix === 'string' ? options.prefix : 'wcc-'
  return vue({
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith(prefix)
      }
    }
  })
}
