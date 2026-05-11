import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'

let capturedOptions = null

vi.mock('@vitejs/plugin-vue', () => ({
  default: (opts) => {
    capturedOptions = opts
    return { name: 'vite:vue', ...opts }
  }
}))

const { wccVuePlugin } = await import('../integrations/vue.js')

describe('Vue Integration - wccVuePlugin', () => {
  beforeEach(() => {
    capturedOptions = null
  })

  it('exports wccVuePlugin as a named function', () => {
    expect(typeof wccVuePlugin).toBe('function')
  })

  it('returns an array of two plugins (pre-transform + vue)', () => {
    const plugins = wccVuePlugin()
    expect(Array.isArray(plugins)).toBe(true)
    expect(plugins).toHaveLength(2)
  })

  it('first plugin is the pre-transform with enforce: pre', () => {
    const plugins = wccVuePlugin()
    expect(plugins[0].name).toBe('vite-plugin-wcc-vmodel')
    expect(plugins[0].enforce).toBe('pre')
    expect(typeof plugins[0].transform).toBe('function')
  })

  it('second plugin is @vitejs/plugin-vue with isCustomElement', () => {
    const plugins = wccVuePlugin()
    expect(plugins[1].name).toBe('vite:vue')
    expect(capturedOptions).toHaveProperty('template.compilerOptions.isCustomElement')
  })

  it('uses default prefix "wcc-" when no options provided', () => {
    wccVuePlugin()
    const isCustomElement = capturedOptions.template.compilerOptions.isCustomElement
    expect(isCustomElement('wcc-counter')).toBe(true)
    expect(isCustomElement('wcc-button')).toBe(true)
    expect(isCustomElement('div')).toBe(false)
    expect(isCustomElement('my-component')).toBe(false)
  })

  it('uses custom prefix when provided', () => {
    wccVuePlugin({ prefix: 'my-' })
    const isCustomElement = capturedOptions.template.compilerOptions.isCustomElement
    expect(isCustomElement('my-counter')).toBe(true)
    expect(isCustomElement('my-button')).toBe(true)
    expect(isCustomElement('wcc-counter')).toBe(false)
  })

  it('falls back to default prefix when prefix is not a string', () => {
    wccVuePlugin({ prefix: 123 })
    const isCustomElement = capturedOptions.template.compilerOptions.isCustomElement
    expect(isCustomElement('wcc-counter')).toBe(true)
    expect(isCustomElement('123-counter')).toBe(false)
  })

  describe('Pre-transform: v-model rewriting', () => {
    let transform

    beforeEach(() => {
      const plugins = wccVuePlugin()
      transform = plugins[0].transform
    })

    it('transforms v-model:propName on custom elements to :prop + @wcc:model listener', () => {
      const input = '<template><wcc-input v-model:value="text"></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':value="text"')
      expect(result).toContain("@wcc:model=\"$event.detail.prop === 'value' && (text = $event.detail.value)\"")
      expect(result).not.toContain('v-model:value')
    })

    it('transforms v-model (without arg) to :model-value + @wcc:model listener', () => {
      const input = '<template><wcc-input v-model="text"></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':model-value="text"')
      expect(result).toContain("@wcc:model=\"$event.detail.prop === 'modelValue' && (text = $event.detail.value)\"")
      expect(result).not.toContain('v-model="text"')
    })

    it('does not transform v-model on non-custom elements (no hyphen)', () => {
      const input = '<template><input v-model="text"></template>'
      const result = transform(input, 'test.vue')

      // Returns null (no change) because input doesn't have a hyphen
      expect(result).toBeNull()
    })

    it('handles multiple v-model:propName on the same element', () => {
      const input = '<template><wcc-form v-model:count="countRef" v-model:title="titleRef"></wcc-form></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':count="countRef"')
      expect(result).toContain("@wcc:model=\"$event.detail.prop === 'count' && (countRef = $event.detail.value)\"")
      expect(result).toContain(':title="titleRef"')
      expect(result).toContain("@wcc:model=\"$event.detail.prop === 'title' && (titleRef = $event.detail.value)\"")
    })

    it('preserves other attributes alongside v-model', () => {
      const input = '<template><wcc-input class="active" v-model:value="text" placeholder="Type..."></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('class="active"')
      expect(result).toContain('placeholder="Type..."')
      expect(result).toContain(':value="text"')
      expect(result).toContain("@wcc:model=\"$event.detail.prop === 'value' && (text = $event.detail.value)\"")
    })

    it('only processes .vue files', () => {
      const input = '<wcc-input v-model:value="text"></wcc-input>'
      const result = transform(input, 'test.js')

      expect(result).toBeNull()
    })

    it('converts camelCase prop names correctly in wcc:model filter', () => {
      const input = '<template><wcc-input v-model:modelValue="text"></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':modelValue="text"')
      expect(result).toContain("@wcc:model=\"$event.detail.prop === 'modelValue' && (text = $event.detail.value)\"")
    })

    // ─── v-model modifiers ────────────────────────────────────────────────

    it('transforms v-model:prop.number with Number() wrapper', () => {
      const input = '<template><wcc-form v-model:count.number="countRef"></wcc-form></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':count="countRef"')
      expect(result).toContain("Number($event.detail.value)")
      expect(result).not.toContain('v-model')
    })

    it('transforms v-model:prop.trim with .trim() wrapper', () => {
      const input = '<template><wcc-input v-model:value.trim="text"></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':value="text"')
      expect(result).toContain('.trim()')
      expect(result).not.toContain('v-model')
    })

    it('transforms v-model.trim (without arg) with .trim() wrapper', () => {
      const input = '<template><wcc-input v-model.trim="text"></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':model-value="text"')
      expect(result).toContain('.trim()')
      expect(result).toContain('@wcc:model=')
      expect(result).not.toContain('v-model')
    })

    it('transforms v-model.number (without arg) with Number() wrapper', () => {
      const input = '<template><wcc-input v-model.number="val"></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':model-value="val"')
      expect(result).toContain('Number($event.detail.value)')
      expect(result).not.toContain('v-model')
    })

    it('transforms v-model:prop.lazy as no-op modifier (same event for CE)', () => {
      const input = '<template><wcc-input v-model:value.lazy="text"></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':value="text"')
      expect(result).toContain("@wcc:model=\"$event.detail.prop === 'value' && (text = $event.detail.value)\"")
      expect(result).not.toContain('v-model')
    })

    it('chains multiple modifiers: v-model:prop.trim.number', () => {
      const input = '<template><wcc-input v-model:value.trim.number="val"></wcc-input></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':value="val"')
      // .trim applied first, then Number()
      expect(result).toContain('Number(')
      expect(result).toContain('.trim()')
      expect(result).not.toContain('v-model')
    })

    it('handles v-model:prop.number alongside other v-model on same element', () => {
      const input = '<template><wcc-form v-model:count.number="countRef" v-model:title.trim="titleRef"></wcc-form></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain(':count="countRef"')
      expect(result).toContain('Number($event.detail.value)')
      expect(result).toContain(':title="titleRef"')
      expect(result).toContain('.trim()')
    })
  })

  describe('Property 1: isCustomElement prefix matching', () => {
    it('isCustomElement(tag) === tag.startsWith(prefix) for all prefix/tag combinations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          (prefix, tag) => {
            capturedOptions = null
            wccVuePlugin({ prefix })
            const isCustomElement = capturedOptions.template.compilerOptions.isCustomElement
            return isCustomElement(tag) === tag.startsWith(prefix)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Pre-transform: slot rewriting', () => {
    let transform

    beforeEach(() => {
      const plugins = wccVuePlugin()
      transform = plugins[0].transform
    })

    it('transforms <template #name> to <div slot="name">', () => {
      const input = '<template><wcc-card><template #header><h1>Title</h1></template></wcc-card></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('<div slot="header"><h1>Title</h1></div>')
      expect(result).not.toContain('<template #header>')
    })

    it('transforms <template v-slot:name> to <div slot="name">', () => {
      const input = '<template><wcc-card><template v-slot:footer>Footer</template></wcc-card></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('<div slot="footer">Footer</div>')
      expect(result).not.toContain('<template v-slot:footer>')
    })

    it('handles multiple named slots', () => {
      const input = '<template><wcc-card><template #header>H</template><p>Body</p><template #footer>F</template></wcc-card></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('<div slot="header">H</div>')
      expect(result).toContain('<div slot="footer">F</div>')
      expect(result).toContain('<p>Body</p>')
    })

    it('preserves content inside the slot template', () => {
      const input = '<template><wcc-card><template #header><h1 class="title">Hello <span>World</span></h1></template></wcc-card></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('<div slot="header"><h1 class="title">Hello <span>World</span></h1></div>')
    })

    it('does not transform template without slot syntax', () => {
      const input = '<template><wcc-card><template v-if="show">Conditional</template></wcc-card></template>'
      const result = transform(input, 'test.vue')

      // v-if template should NOT be transformed (no # or v-slot:)
      expect(result).toBeNull()
    })
  })

  describe('Pre-transform: scoped slot rewriting', () => {
    let transform

    beforeEach(() => {
      const plugins = wccVuePlugin()
      transform = plugins[0].transform
    })

    it('transforms scoped slot with single prop — #name="{ prop }" syntax', () => {
      const input = '<template><wcc-list><template #item="{ name }">Hello {{name}}</template></wcc-list></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('<div slot="item" slot-props="name" hidden>Hello {%name%}</div>')
      expect(result).not.toContain('<template #item')
    })

    it('transforms scoped slot with multiple props', () => {
      const input = '<template><wcc-list><template #row="{ name, age }">{{name}} is {{age}} years old</template></wcc-list></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('slot="row"')
      expect(result).toContain('slot-props="name, age"')
      expect(result).toContain('{%name%} is {%age%} years old')
      expect(result).not.toContain('{{name}}')
      expect(result).not.toContain('{{age}}')
    })

    it('only escapes declared prop interpolations — leaves other {{expr}} for Vue', () => {
      const input = '<template><wcc-list><template #item="{ name }">{{name}} and {{otherVueRef}}</template></wcc-list></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('{%name%}')
      expect(result).toContain('{{otherVueRef}}')
    })

    it('does NOT affect non-scoped <template #name> (no props)', () => {
      const input = '<template><wcc-card><template #header><h1>Title</h1></template></wcc-card></template>'
      const result = transform(input, 'test.vue')

      // Should use the existing named slot transform (no slot-props attribute)
      expect(result).toContain('<div slot="header"><h1>Title</h1></div>')
      expect(result).not.toContain('slot-props')
    })

    it('transforms <template v-slot:name="{ props }"> syntax', () => {
      const input = '<template><wcc-list><template v-slot:item="{ title }">{{title}}</template></wcc-list></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('<div slot="item" slot-props="title" hidden>{%title%}</div>')
      expect(result).not.toContain('<template v-slot:item')
    })

    it('preserves other content and attributes around the scoped slot', () => {
      const input = '<template><wcc-card class="fancy"><template #item="{ value }"><span class="bold">{{value}}</span></template></wcc-card></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('class="fancy"')
      expect(result).toContain('<span class="bold">{%value%}</span>')
      expect(result).toContain('slot="item"')
      expect(result).toContain('slot-props="value"')
    })

    it('handles whitespace in interpolation — {{ prop }} → {% prop %}', () => {
      const input = '<template><wcc-list><template #item="{ name }">Hello {{ name }}</template></wcc-list></template>'
      const result = transform(input, 'test.vue')

      expect(result).toContain('{% name %}')
      expect(result).not.toContain('{{ name }}')
    })
  })
})
