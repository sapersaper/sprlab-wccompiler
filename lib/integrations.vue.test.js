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

  it('returns a plugin object with a name property', () => {
    const plugin = wccVuePlugin()
    expect(plugin).toHaveProperty('name')
  })

  it('configures isCustomElement in template.compilerOptions', () => {
    wccVuePlugin()
    expect(capturedOptions).toHaveProperty('template.compilerOptions.isCustomElement')
    expect(typeof capturedOptions.template.compilerOptions.isCustomElement).toBe('function')
  })

  it('configures nodeTransforms with wccVModelTransform', () => {
    wccVuePlugin()
    expect(capturedOptions).toHaveProperty('template.compilerOptions.nodeTransforms')
    expect(capturedOptions.template.compilerOptions.nodeTransforms).toHaveLength(1)
    expect(typeof capturedOptions.template.compilerOptions.nodeTransforms[0]).toBe('function')
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

  describe('Property 1: isCustomElement prefix matching', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**
     *
     * For any prefix string and for any tag string,
     * isCustomElement(tag) === tag.startsWith(prefix)
     */
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

  describe('nodeTransform: wccVModelTransform', () => {
    let transform

    beforeEach(() => {
      wccVuePlugin()
      transform = capturedOptions.template.compilerOptions.nodeTransforms[0]
    })

    it('transforms v-model:arg on custom elements into :prop + @update:prop', () => {
      const node = {
        type: 1, // ELEMENT
        tag: 'wcc-input',
        props: [{
          type: 7, // DIRECTIVE
          name: 'model',
          arg: { type: 4, content: 'value', isStatic: true, loc: {} },
          exp: { type: 4, content: 'text', isStatic: false, loc: {} },
          modifiers: [],
          loc: {}
        }]
      }

      transform(node, {})

      // Should have 2 props: :value and @update:value
      expect(node.props).toHaveLength(2)

      // First: bind directive (:value="text")
      expect(node.props[0].name).toBe('bind')
      expect(node.props[0].arg.content).toBe('value')
      expect(node.props[0].exp.content).toBe('text')

      // Second: on directive (@update:value="$event => { text = $event }")
      expect(node.props[1].name).toBe('on')
      expect(node.props[1].arg.content).toBe('update:value')
      expect(node.props[1].exp.content).toContain('text = $event')
    })

    it('does not transform v-model without argument (leaves it for Vue default handling)', () => {
      const node = {
        type: 1,
        tag: 'wcc-input',
        props: [{
          type: 7,
          name: 'model',
          arg: null, // no argument — plain v-model
          exp: { type: 4, content: 'text', isStatic: false, loc: {} },
          modifiers: [],
          loc: {}
        }]
      }

      transform(node, {})

      // Should remain unchanged (1 prop, still v-model)
      expect(node.props).toHaveLength(1)
      expect(node.props[0].name).toBe('model')
    })

    it('does not transform non-custom elements (no hyphen in tag)', () => {
      const node = {
        type: 1,
        tag: 'div',
        props: [{
          type: 7,
          name: 'model',
          arg: { type: 4, content: 'value', isStatic: true, loc: {} },
          exp: { type: 4, content: 'text', isStatic: false, loc: {} },
          modifiers: [],
          loc: {}
        }]
      }

      transform(node, {})

      // Should remain unchanged
      expect(node.props).toHaveLength(1)
      expect(node.props[0].name).toBe('model')
    })

    it('handles multiple v-model:arg on the same element', () => {
      const node = {
        type: 1,
        tag: 'wcc-form',
        props: [
          {
            type: 7,
            name: 'model',
            arg: { type: 4, content: 'title', isStatic: true, loc: {} },
            exp: { type: 4, content: 'titleRef', isStatic: false, loc: {} },
            modifiers: [],
            loc: {}
          },
          {
            type: 7,
            name: 'model',
            arg: { type: 4, content: 'count', isStatic: true, loc: {} },
            exp: { type: 4, content: 'countRef', isStatic: false, loc: {} },
            modifiers: [],
            loc: {}
          }
        ]
      }

      transform(node, {})

      // Should have 4 props: :title + @update:title + :count + @update:count
      expect(node.props).toHaveLength(4)
      expect(node.props[0].name).toBe('bind')
      expect(node.props[0].arg.content).toBe('title')
      expect(node.props[1].name).toBe('on')
      expect(node.props[1].arg.content).toBe('update:title')
      expect(node.props[2].name).toBe('bind')
      expect(node.props[2].arg.content).toBe('count')
      expect(node.props[3].name).toBe('on')
      expect(node.props[3].arg.content).toBe('update:count')
    })

    it('preserves non-model props alongside transformed v-model:arg', () => {
      const node = {
        type: 1,
        tag: 'wcc-input',
        props: [
          { type: 6, name: 'class', value: { content: 'active' } }, // static attr
          {
            type: 7,
            name: 'model',
            arg: { type: 4, content: 'value', isStatic: true, loc: {} },
            exp: { type: 4, content: 'text', isStatic: false, loc: {} },
            modifiers: [],
            loc: {}
          },
          { type: 6, name: 'placeholder', value: { content: 'Type...' } } // static attr
        ]
      }

      transform(node, {})

      // Should have 4 props: class + :value + @update:value + placeholder
      expect(node.props).toHaveLength(4)
      expect(node.props[0].name).toBe('class')
      expect(node.props[1].name).toBe('bind')
      expect(node.props[2].name).toBe('on')
      expect(node.props[3].name).toBe('placeholder')
    })
  })
})
