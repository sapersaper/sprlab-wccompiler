/**
 * Angular template transformer for WCC custom elements.
 * Transforms banana-box syntax [(prop)]="expr" in custom elements,
 * eliminating the need for the WccModel directive.
 *
 * @module @sprlab/wccompiler/integrations/angular-plugin
 *
 * This module provides:
 * 1. `transformBananaBox(content)` — pure function that transforms HTML strings
 * 2. `transformFile(filePath)` — transforms an HTML file in-place
 * 3. `transformDirectory(dir)` — transforms all .html files in a directory
 *
 * The transformation rewrites [(prop)]="expr" on custom elements to:
 *   [prop]="expr" (propChange)="expr = $any($event).detail"
 *
 * Usage as a pre-build step (recommended for Angular):
 * ```json
 * // package.json
 * {
 *   "scripts": {
 *     "prebuild": "node ./src/wcc-components/angular-plugin.mjs --transform src/app",
 *     "build": "ng build"
 *   }
 * }
 * ```
 *
 * Or use the expanded syntax directly in templates:
 *   [count]="modelCount" (countChange)="modelCount = $any($event).detail"
 *
 * NOTE: Angular's AOT compiler processes templates BEFORE esbuild plugins run,
 * so an esbuild plugin cannot intercept templateUrl-referenced HTML files.
 * Use the pre-build CLI approach or write the expanded syntax manually.
 *
 * The plugin coexists with the WccModel directive:
 * - If templates use the expanded syntax, WccModel is not needed.
 * - If the expanded syntax is NOT used, WccModel still works as a fallback.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Transforms banana-box syntax [(prop)]="expr" on custom elements (tags with hyphens)
 * into Angular property binding + event binding.
 *
 * @param {string} content - HTML template content
 * @returns {string} Transformed content
 */
export function transformBananaBox(content) {
  const bananaBoxRegex = /(<[\w]+-[\w-]*(?:\s[^>]*?)?)\[\((\w+)\)\]="([^"]+)"/g

  let result = content
  let previous

  // Loop until no more matches (handles multiple banana-box on same element)
  do {
    previous = result
    result = result.replace(bananaBoxRegex, (match, prefix, prop, expr) => {
      // Exclude [(ngModel)] explicitly
      if (prop === 'ngModel') return match
      return `${prefix}[${prop}]="${expr}" (${prop}Change)="${expr} = $any($event).detail"`
    })
  } while (result !== previous)

  return result
}

/**
 * Transforms a single HTML file in-place.
 * @param {string} filePath - Path to the HTML file
 * @returns {boolean} Whether the file was modified
 */
export function transformFileSync(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const transformed = transformBananaBox(content)
  if (transformed !== content) {
    writeFileSync(filePath, transformed, 'utf8')
    return true
  }
  return false
}

/**
 * Transforms all .html files in a directory recursively.
 * @param {string} dir - Directory path
 * @returns {string[]} List of modified file paths
 */
export function transformDirectorySync(dir) {
  const modified = []
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
      modified.push(...transformDirectorySync(fullPath))
    } else if (entry.endsWith('.html')) {
      if (transformFileSync(fullPath)) {
        modified.push(fullPath)
      }
    }
  }
  return modified
}

// CLI mode: node angular-plugin.mjs --transform <dir>
const args = process.argv.slice(2)
if (args[0] === '--transform' && args[1]) {
  const dir = resolve(args[1])
  const modified = transformDirectorySync(dir)
  if (modified.length > 0) {
    console.log(`[wcc-angular] Transformed ${modified.length} file(s):`)
    modified.forEach(f => console.log(`  ${f}`))
  } else {
    console.log('[wcc-angular] No banana-box bindings found in custom elements.')
  }
}
