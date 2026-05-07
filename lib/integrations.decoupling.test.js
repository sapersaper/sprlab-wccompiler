import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

describe('Integration-core decoupling (Property 4)', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.4**
   *
   * For any file in integrations/, there shall be no import from lib/.
   * For any file in lib/, there shall be no import from integrations/.
   */

  const integrationsDir = join(process.cwd(), 'integrations')
  const integrationFiles = readdirSync(integrationsDir)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ name: f, content: readFileSync(join(integrationsDir, f), 'utf-8') }))

  it('integration files exist', () => {
    expect(integrationFiles.length).toBeGreaterThan(0)
  })

  it('no integration file imports from lib/', () => {
    for (const file of integrationFiles) {
      const importMatches = file.content.match(/(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g) || []
      for (const imp of importMatches) {
        expect(imp, `${file.name} should not import from lib/`).not.toMatch(/['"]\.\.\/lib\//)
        expect(imp, `${file.name} should not import from ./lib/`).not.toMatch(/['"]\.\/lib\//)
      }
    }
  })

  it('no integration file imports from relative lib paths', () => {
    for (const file of integrationFiles) {
      // Check for any form of lib/ import
      expect(file.content).not.toMatch(/from\s+['"]\.\.\/lib\//)
      expect(file.content).not.toMatch(/from\s+['"]\.\/lib\//)
      expect(file.content).not.toMatch(/require\(['"]\.\.\/lib\//)
      expect(file.content).not.toMatch(/require\(['"]\.\/lib\//)
    }
  })

  describe('package.json smoke tests', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))

    it('exports field contains all integration subpaths', () => {
      expect(pkg.exports).toBeDefined()
      expect(pkg.exports['.']).toBe('./lib/compiler.js')
      expect(pkg.exports['./integrations/vue']).toBe('./integrations/vue.js')
      expect(pkg.exports['./integrations/react']).toBe('./integrations/react.js')
      expect(pkg.exports['./integrations/angular']).toBe('./integrations/angular.js')
    })

    it('peerDependencies declares correct versions', () => {
      expect(pkg.peerDependencies).toBeDefined()
      expect(pkg.peerDependencies['@vitejs/plugin-vue']).toBe('>=4.0.0')
      expect(pkg.peerDependencies['vue']).toBe('>=3.0.0')
      expect(pkg.peerDependencies['react']).toBe('>=18.0.0')
      expect(pkg.peerDependencies['@angular/core']).toBe('>=14.0.0')
    })

    it('peerDependenciesMeta marks all as optional', () => {
      expect(pkg.peerDependenciesMeta).toBeDefined()
      expect(pkg.peerDependenciesMeta['@vitejs/plugin-vue']).toEqual({ optional: true })
      expect(pkg.peerDependenciesMeta['vue']).toEqual({ optional: true })
      expect(pkg.peerDependenciesMeta['react']).toEqual({ optional: true })
      expect(pkg.peerDependenciesMeta['@angular/core']).toEqual({ optional: true })
    })

    it('files field includes integrations/', () => {
      expect(pkg.files).toBeDefined()
      expect(pkg.files).toContain('integrations/')
    })
  })
})
