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
      // Also handles modifiers: v-model:propName.trim.number="expr"
      // → :propName="expr" @propName-changed="expr = $event.detail"
      //   with modifiers applied to the event handler value:
      //   .trim   → $event.detail.trim()  (for string values)
      //   .number → Number($event.detail)
      //   .lazy   → uses @propName-changed (same event, no difference for CE)
      // Run in a loop to handle multiple v-model on the same element
      let prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\bv-model:(\w+)((?:\.\w+)*)="([^"]+)"/,
          (match, prefix, prop, modifiersStr, expr) => {
            const modifiers = modifiersStr ? modifiersStr.slice(1).split('.') : []
            let value = '$event.detail'
            // Apply modifiers in order
            for (const mod of modifiers) {
              if (mod === 'trim') {
                value = `(typeof ${value} === 'string' ? (${value}).trim() : ${value})`
              } else if (mod === 'number') {
                value = `Number(${value})`
              }
              // .lazy is a no-op for custom elements (they already use change events)
            }
            return `${prefix}:${prop}="${expr}" @${prop}-changed="${expr} = ${value}"`
          }
        )
      }

      // Transform v-model="expr" (without argument) on custom elements
      // Also handles modifiers: v-model.trim.lazy="expr"
      // → :model-value="expr" @model-value-changed="expr = $event.detail"
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\bv-model((?:\.\w+)*)="([^"]+)"/,
          (match, prefix, modifiersStr, expr) => {
            const modifiers = modifiersStr ? modifiersStr.slice(1).split('.') : []
            let value = '$event.detail'
            for (const mod of modifiers) {
              if (mod === 'trim') {
                value = `(typeof ${value} === 'string' ? (${value}).trim() : ${value})`
              } else if (mod === 'number') {
                value = `Number(${value})`
              }
            }
            return `${prefix}:model-value="${expr}" @model-value-changed="${expr} = ${value}"`
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
