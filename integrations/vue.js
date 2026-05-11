/**
 * Vue Vite plugin for WCC custom elements.
 * Configures isCustomElement and provides enhanced DX for v-model modifiers and scoped slots.
 *
 * @module @sprlab/wccompiler/integrations/vue
 *
 * IMPORTANT: This plugin is OPTIONAL for basic usage.
 * WCC components work in Vue with zero WCC-specific config:
 *   - Props: <wcc-counter :count="val"></wcc-counter>
 *   - Events: <wcc-counter @count-changed="handler($event.detail)"></wcc-counter>
 *   - v-model: <wcc-counter v-model:count="val"></wcc-counter> (Vue 3.4+ CE support)
 *   - Named slots: <div slot="header">...</div>
 *
 * The only Vue-specific config needed (same as Lit, Shoelace, FAST):
 *   vue({ template: { compilerOptions: { isCustomElement: tag => tag.includes('-') } } })
 *
 * This plugin adds:
 *   1. isCustomElement config (so you don't need to write it manually)
 *   2. v-model modifier support (.trim, .number, .lazy)
 *   3. Scoped slot syntax: <template #item="{ name }">{{name}}</template>
 *
 * @example vite.config.js (with plugin — full DX)
 * ```js
 * import { wccVuePlugin } from '@sprlab/wccompiler/integrations/vue'
 * export default { plugins: [wccVuePlugin()] }
 * ```
 *
 * @example vite.config.js (without plugin — still works for basic usage)
 * ```js
 * import vue from '@vitejs/plugin-vue'
 * export default {
 *   plugins: [vue({
 *     template: { compilerOptions: { isCustomElement: tag => tag.includes('-') } }
 *   })]
 * }
 * ```
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

      // NOTE: The compiled WCC component emits only `wcc:model` as its single
      // canonical model change event. Framework-specific event formats are handled
      // by each framework's adapter/plugin.
      //
      // This plugin is needed for:
      //   1. v-model:propName (Vue can't unwrap CustomEvent.detail natively)
      //   2. v-model modifiers (.trim, .number)
      //   3. Scoped slot syntax transformation ({{prop}} → {%prop%})

      // Transform v-model:propName="expr" on custom elements (tags with hyphens)
      // Also handles modifiers: v-model:propName.trim.number="expr"
      // → :propName="expr" @wcc:model="$event.detail.prop === 'propName' && (expr = value)"
      //   with modifiers applied to the extracted value:
      //   .trim   → value.trim()  (for string values)
      //   .number → Number(value)
      //   .lazy   → no-op for custom elements
      // Run in a loop to handle multiple v-model on the same element
      let prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\bv-model:(\w+)((?:\.\w+)*)="([^"]+)"/,
          (match, prefix, prop, modifiersStr, expr) => {
            const modifiers = modifiersStr ? modifiersStr.slice(1).split('.') : []
            let value = '$event.detail.value'
            // Apply modifiers in order
            for (const mod of modifiers) {
              if (mod === 'trim') {
                value = `(typeof ${value} === 'string' ? (${value}).trim() : ${value})`
              } else if (mod === 'number') {
                value = `Number(${value})`
              }
              // .lazy is a no-op for custom elements (they already use change events)
            }
            return `${prefix}:${prop}="${expr}" @wcc:model="$event.detail.prop === '${prop}' && (${expr} = ${value})"`
          }
        )
      }

      // Transform v-model="expr" (without argument) on custom elements
      // Also handles modifiers: v-model.trim.lazy="expr"
      // → :model-value="expr" @wcc:model="$event.detail.prop === 'modelValue' && (expr = value)"
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\bv-model((?:\.\w+)*)="([^"]+)"/,
          (match, prefix, modifiersStr, expr) => {
            const modifiers = modifiersStr ? modifiersStr.slice(1).split('.') : []
            let value = '$event.detail.value'
            for (const mod of modifiers) {
              if (mod === 'trim') {
                value = `(typeof ${value} === 'string' ? (${value}).trim() : ${value})`
              } else if (mod === 'number') {
                value = `Number(${value})`
              }
            }
            return `${prefix}:model-value="${expr}" @wcc:model="$event.detail.prop === 'modelValue' && (${expr} = ${value})"`
          }
        )
      }

      // ── Slot transforms ──
      // Transform <template #name>content</template> inside custom elements
      // → <div slot="name">content</div>
      // This prevents Vue from intercepting the slot syntax and erroring.
      // The WCC component's runtime slot parser detects slot="name" on regular elements.
      //
      // IMPORTANT: Only transform templates inside custom elements (tags with hyphens).
      // This ensures we don't interfere with Vue's own slot/template handling on native elements.

      // Helper: transform scoped slot content — escape {{prop}} → {%prop%} for declared props only
      function transformScopedContent(content, propsExpr) {
        const props = propsExpr.split(',').map(p => p.trim()).filter(Boolean)
        let transformed = content
        for (const prop of props) {
          // Replace {{propName}} and {{ propName }} with {%propName%} / {% propName %}
          transformed = transformed.replace(
            new RegExp('\\{\\{(\\s*)' + prop + '(\\s*)\\}\\}', 'g'),
            (m, ws1, ws2) => `{%${ws1}${prop}${ws2}%}`
          )
        }
        return { transformed, props }
      }

      // Handle scoped slots: <template #name="{ prop1, prop2 }">...</template>
      // → <div slot="name" slot-props="prop1, prop2" hidden>content with {%prop%}</div>
      // The 'hidden' attribute prevents {%prop%} tokens from flashing before the WCC runtime processes them.
      // Only inside custom elements (tag names with hyphens)
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*[^>]*>)([\s\S]*?)<template\s+#(\w+)="\{\s*([^}]*)\s*\}">([\s\S]*?)<\/template>/,
          (match, openTag, before, slotName, propsExpr, content) => {
            const { transformed, props } = transformScopedContent(content, propsExpr)
            return `${openTag}${before}<div slot="${slotName}" slot-props="${props.join(', ')}" hidden>${transformed}</div>`
          }
        )
      }

      // Handle scoped slots: <template v-slot:name="{ prop1, prop2 }">...</template>
      // → <div slot="name" slot-props="prop1, prop2" hidden>content with {%prop%}</div>
      // Only inside custom elements (tag names with hyphens)
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*[^>]*>)([\s\S]*?)<template\s+v-slot:(\w+)="\{\s*([^}]*)\s*\}">([\s\S]*?)<\/template>/,
          (match, openTag, before, slotName, propsExpr, content) => {
            const { transformed, props } = transformScopedContent(content, propsExpr)
            return `${openTag}${before}<div slot="${slotName}" slot-props="${props.join(', ')}" hidden>${transformed}</div>`
          }
        )
      }

      // Handle non-scoped <template #name>...</template> (shorthand)
      // Only inside custom elements (tag names with hyphens)
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*[^>]*>)([\s\S]*?)<template\s+#(\w+)>([\s\S]*?)<\/template>/,
          (match, openTag, before, slotName, content) => {
            return `${openTag}${before}<div slot="${slotName}">${content}</div>`
          }
        )
      }

      // Handle non-scoped <template v-slot:name>...</template> (verbose)
      // Only inside custom elements (tag names with hyphens)
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*[^>]*>)([\s\S]*?)<template\s+v-slot:(\w+)>([\s\S]*?)<\/template>/,
          (match, openTag, before, slotName, content) => {
            return `${openTag}${before}<div slot="${slotName}">${content}</div>`
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
