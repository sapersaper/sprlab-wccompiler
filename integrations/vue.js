/**
 * Vue Vite plugin for WCC custom elements.
 * Configures isCustomElement to recognize WCC component tags.
 * Also re-exports the defineModel adapter for v-model support.
 *
 * @module @sprlab/wccompiler/integrations/vue
 */

import vue from '@vitejs/plugin-vue'

// Side-effect: registers document-level wcc:model → update:propName translation
// This enables v-model:propName on WCC components in Vue templates.
import '../adapters/vue.js'

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
