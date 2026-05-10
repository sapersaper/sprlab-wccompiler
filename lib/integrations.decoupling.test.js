import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

describe('Integration-core decoupling (Property 4)', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.4, 1.1, 1.5, 7.1**
   *
   * For any file in integrations/ and for any file in lib/,
   * there shall be no import or require statement in either file
   * that references the other directory.
   */

  const integrationsDir = join(process.cwd(), 'integrations')
  const libDir = join(process.cwd(), 'lib')

  const integrationFiles = readdirSync(integrationsDir)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ name: f, path: join(integrationsDir, f), content: readFileSync(join(integrationsDir, f), 'utf-8') }))

  const libFiles = readdirSync(libDir)
    .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))
    .map(f => ({ name: f, path: join(libDir, f), content: readFileSync(join(libDir, f), 'utf-8') }))

  /**
   * Parses import/require statements from file content.
   * Handles both ESM (import ... from '...') and CJS (require('...')) patterns.
   */
  function parseImports(content) {
    const imports = []
    // ESM: import ... from '...' or import '...'
    const esmRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
    let match
    while ((match = esmRegex.exec(content)) !== null) {
      imports.push(match[1])
    }
    // CJS: require('...')
    const cjsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = cjsRegex.exec(content)) !== null) {
      imports.push(match[1])
    }
    return imports
  }

  /**
   * Checks if an import path references the lib/ directory (from integrations perspective).
   */
  function referencesLib(importPath) {
    return importPath.startsWith('../lib/') || importPath.startsWith('./lib/')
  }

  /**
   * Checks if an import path references the integrations/ directory (from lib perspective).
   */
  function referencesIntegrations(importPath) {
    return importPath.startsWith('../integrations/') || importPath.startsWith('./integrations/')
  }

  it('integration files exist', () => {
    expect(integrationFiles.length).toBeGreaterThan(0)
  })

  it('lib source files exist', () => {
    expect(libFiles.length).toBeGreaterThan(0)
  })

  describe('Property 4: no cross-directory imports', () => {
    it('no integration file imports from lib/', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...integrationFiles),
          (file) => {
            const imports = parseImports(file.content)
            const libImports = imports.filter(referencesLib)
            return libImports.length === 0
          }
        ),
        { numRuns: Math.max(100, integrationFiles.length * 30) }
      )
    })

    it('no lib file imports from integrations/', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...libFiles),
          (file) => {
            const imports = parseImports(file.content)
            const integrationImports = imports.filter(referencesIntegrations)
            return integrationImports.length === 0
          }
        ),
        { numRuns: Math.max(100, libFiles.length * 10) }
      )
    })
  })

  it('no integration file imports from lib/ (exhaustive)', () => {
    for (const file of integrationFiles) {
      const imports = parseImports(file.content)
      const libImports = imports.filter(referencesLib)
      expect(libImports, `${file.name} should not import from lib/, found: ${libImports.join(', ')}`).toHaveLength(0)
    }
  })

  it('no lib file imports from integrations/ (exhaustive)', () => {
    for (const file of libFiles) {
      const imports = parseImports(file.content)
      const integrationImports = imports.filter(referencesIntegrations)
      expect(integrationImports, `${file.name} should not import from integrations/, found: ${integrationImports.join(', ')}`).toHaveLength(0)
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

    it('peerDependencies declares framework packages', () => {
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
