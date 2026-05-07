import { describe, it, expect, vi } from 'vitest'

const MOCK_CUSTOM_ELEMENTS_SCHEMA = Symbol('CUSTOM_ELEMENTS_SCHEMA')

vi.mock('@angular/core', () => ({
  CUSTOM_ELEMENTS_SCHEMA: MOCK_CUSTOM_ELEMENTS_SCHEMA
}))

const { WCC_SCHEMAS, WccModule } = await import('../integrations/angular.js')

describe('Angular Integration', () => {
  /**
   * **Validates: Requirements 4.1, 4.3, 4.5**
   */

  it('WCC_SCHEMAS equals [CUSTOM_ELEMENTS_SCHEMA]', () => {
    expect(WCC_SCHEMAS).toEqual([MOCK_CUSTOM_ELEMENTS_SCHEMA])
  })

  it('WCC_SCHEMAS is an array with exactly one element', () => {
    expect(Array.isArray(WCC_SCHEMAS)).toBe(true)
    expect(WCC_SCHEMAS).toHaveLength(1)
  })

  it('WccModule is exported as a class', () => {
    expect(typeof WccModule).toBe('function')
    expect(WccModule.toString()).toMatch(/^class\s/)
  })

  it('WccModule has a static schemas property', () => {
    expect(WccModule.schemas).toBeDefined()
    expect(WccModule.schemas).toEqual(WCC_SCHEMAS)
  })

  it('exports both WCC_SCHEMAS and WccModule as named exports', () => {
    expect(WCC_SCHEMAS).toBeDefined()
    expect(WccModule).toBeDefined()
  })
})
