import { describe, it, expect, vi } from 'vitest'

const MOCK_CUSTOM_ELEMENTS_SCHEMA = Symbol('CUSTOM_ELEMENTS_SCHEMA')

vi.mock('@angular/core', () => ({
  CUSTOM_ELEMENTS_SCHEMA: MOCK_CUSTOM_ELEMENTS_SCHEMA
}))

const { WCC_SCHEMAS, WccModule } = await import('../integrations/angular.js')

describe('Angular Integration', () => {
  it('exports WCC_SCHEMAS as a named export', () => {
    expect(WCC_SCHEMAS).toBeDefined()
  })

  it('WCC_SCHEMAS contains CUSTOM_ELEMENTS_SCHEMA', () => {
    expect(WCC_SCHEMAS).toEqual([MOCK_CUSTOM_ELEMENTS_SCHEMA])
  })

  it('WCC_SCHEMAS is an array with exactly one element', () => {
    expect(Array.isArray(WCC_SCHEMAS)).toBe(true)
    expect(WCC_SCHEMAS).toHaveLength(1)
  })

  it('exports WccModule as a class', () => {
    expect(WccModule).toBeDefined()
    expect(typeof WccModule).toBe('function') // classes are functions
    const instance = new WccModule()
    expect(instance).toBeInstanceOf(WccModule)
  })

  it('WccModule has static schemas property equal to WCC_SCHEMAS', () => {
    expect(WccModule.schemas).toBe(WCC_SCHEMAS)
  })

  it('both WCC_SCHEMAS and WccModule are exported', async () => {
    const mod = await import('../integrations/angular.js')
    expect(mod).toHaveProperty('WCC_SCHEMAS')
    expect(mod).toHaveProperty('WccModule')
  })
})
