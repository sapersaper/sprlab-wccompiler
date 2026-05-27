import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * WCC Vue pre-transform plugin (inline copy matching integrations/vue.js v0.11+).
 * Transforms:
 * 1. v-model:propName on custom elements → :prop + merged @wcc:model listener
 * 2. <template #name="{ props }">{{prop}}</template> → <div slot="name" slot-props="...">{%prop%}</div>
 * 3. <template #name>content</template> → <div slot="name">content</div>
 */
function wccPreTransform() {
  return {
    name: 'vite-plugin-wcc-pre-transform',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.vue')) return null

      let result = code
      let prev = ''

      // ── v-model:propName on custom elements → @wcc:model with prop filter ──
      // Multiple v-model:prop on the same element are merged into a single @wcc:model
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\bv-model:(\w+)((?:\.\w+)*)="([^"]+)"/,
          (_, pfx, prop, modifiersStr, expr) => {
            const modifiers = modifiersStr ? modifiersStr.slice(1).split('.') : []
            let value = '$event.detail.value'
            for (const mod of modifiers) {
              if (mod === 'trim') {
                value = `(typeof ${value} === 'string' ? (${value}).trim() : ${value})`
              } else if (mod === 'number') {
                value = `Number(${value})`
              }
            }
            const handler = `$event.detail.prop === '${prop}' && (${expr} = ${value})`
            if (pfx.includes('@wcc:model="')) {
              const merged = pfx.replace(
                /@wcc:model="([^"]*)"/,
                (_, existing) => `@wcc:model="${existing}; ${handler}"`
              )
              return `${merged}:${prop}="${expr}"`
            }
            return `${pfx}:${prop}="${expr}" @wcc:model="${handler}"`
          }
        )
      }

      // ── v-model (no arg) on custom elements ──
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\bv-model((?:\.\w+)*)="([^"]+)"/,
          (_, pfx, modifiersStr, expr) => {
            const modifiers = modifiersStr ? modifiersStr.slice(1).split('.') : []
            let value = '$event.detail.value'
            for (const mod of modifiers) {
              if (mod === 'trim') {
                value = `(typeof ${value} === 'string' ? (${value}).trim() : ${value})`
              } else if (mod === 'number') {
                value = `Number(${value})`
              }
            }
            const handler = `$event.detail.prop === 'modelValue' && (${expr} = ${value})`
            if (pfx.includes('@wcc:model="')) {
              const merged = pfx.replace(
                /@wcc:model="([^"]*)"/,
                (_, existing) => `@wcc:model="${existing}; ${handler}"`
              )
              return `${merged}:model-value="${expr}"`
            }
            return `${pfx}:model-value="${expr}" @wcc:model="${handler}"`
          }
        )
      }

      // Post-process: merge any duplicate @wcc:model attributes on the same element
      result = result.replace(
        /<([\w]+-[\w-]*)((?:\s[^>]*?)?)@wcc:model="([^"]*)"((?:\s[^>]*?)?)@wcc:model="([^"]*)"([^>]*?)>/g,
        (match, tag, before, handler1, middle, handler2, after) => {
          return `<${tag}${before}@wcc:model="${handler1}; ${handler2}"${middle}${after}>`
        }
      )

      // ── Helper: escape {{prop}} → {%prop%} for declared props only ──
      function escapeProps(content, propsExpr) {
        const props = propsExpr.split(',').map(p => p.trim()).filter(Boolean)
        let out = content
        for (const prop of props) {
          out = out.replace(
            new RegExp('\\{\\{(\\s*)' + prop + '(\\s*)\\}\\}', 'g'),
            (_, ws1, ws2) => `{%${ws1}${prop}${ws2}%}`
          )
        }
        return { out, props }
      }

      // ── Scoped slots: <template #name="{ prop1, prop2 }">...</template> ──
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /<template\s+#(\w+)="\{\s*([^}]*)\s*\}">([\s\S]*?)<\/template>/,
          (_, slotName, propsExpr, content) => {
            const { out, props } = escapeProps(content, propsExpr)
            return `<div slot="${slotName}" slot-props="${props.join(', ')}">${out}</div>`
          }
        )
      }

      // ── Scoped slots: <template v-slot:name="{ prop1, prop2 }">...</template> ──
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /<template\s+v-slot:(\w+)="\{\s*([^}]*)\s*\}">([\s\S]*?)<\/template>/,
          (_, slotName, propsExpr, content) => {
            const { out, props } = escapeProps(content, propsExpr)
            return `<div slot="${slotName}" slot-props="${props.join(', ')}">${out}</div>`
          }
        )
      }

      // ── Non-scoped: <template #name>...</template> ──
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /<template\s+#(\w+)>([\s\S]*?)<\/template>/,
          (_, slotName, content) => `<div slot="${slotName}">${content}</div>`
        )
      }

      // ── Non-scoped: <template v-slot:name>...</template> ──
      prev = ''
      while (prev !== result) {
        prev = result
        result = result.replace(
          /<template\s+v-slot:(\w+)>([\s\S]*?)<\/template>/,
          (_, slotName, content) => `<div slot="${slotName}">${content}</div>`
        )
      }

      if (result !== code) return result
      return null
    }
  }
}

export default defineConfig({
  plugins: [
    wccPreTransform(),
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('wcc-')
        }
      }
    })
  ],
  server: {
    port: 4001,
  },
})
