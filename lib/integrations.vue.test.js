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
})
