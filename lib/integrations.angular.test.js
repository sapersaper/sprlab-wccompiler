import { describe, it, expect } from 'vitest'

const { WCC_ANGULAR_CONFIG } = await import('../integrations/angular.js')

describe('Angular Integration', () => {
  it('exports WCC_ANGULAR_CONFIG as a named export', () => {
    expect(WCC_ANGULAR_CONFIG).toBeDefined()
  })

  it('WCC_ANGULAR_CONFIG contains schema import instruction', () => {
    expect(WCC_ANGULAR_CONFIG.schema).toContain('CUSTOM_ELEMENTS_SCHEMA')
  })

  it('WCC_ANGULAR_CONFIG contains standalone component instruction', () => {
    expect(WCC_ANGULAR_CONFIG.standalone).toContain('schemas')
    expect(WCC_ANGULAR_CONFIG.standalone).toContain('CUSTOM_ELEMENTS_SCHEMA')
  })

  it('WCC_ANGULAR_CONFIG contains NgModule instruction', () => {
    expect(WCC_ANGULAR_CONFIG.ngModule).toContain('schemas')
    expect(WCC_ANGULAR_CONFIG.ngModule).toContain('CUSTOM_ELEMENTS_SCHEMA')
  })

  it('WCC_ANGULAR_CONFIG is a plain object (no framework dependency needed)', () => {
    expect(typeof WCC_ANGULAR_CONFIG).toBe('object')
    expect(WCC_ANGULAR_CONFIG).not.toBeNull()
  })
})
