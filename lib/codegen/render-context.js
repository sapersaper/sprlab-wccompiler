/**
 * RenderContext — encapsulates rendering context for any nesting level.
 *
 * Instead of passing multiple parameters (signalNames, propNames, loop
 * variables, indent) to every rendering function, this class bundles them
 * into a single object that can be passed recursively.
 *
 * The key insight: `loopStack` tracks ALL active loop variables, enabling
 * `isStatic()` and `filtered*()` to work correctly at any depth without
 * duplicating logic.
 */

import { escapeRegex } from '../utils.js';

/**
 * @typedef {{ itemVar: string, indexVar: string | null }} LoopVar
 */

export class RenderContext {
  /**
   * @param {object} opts
   * @param {Set<string>} [opts.signalNames]
   * @param {Set<string>} [opts.computedNames]
   * @param {Set<string>} [opts.propNames]
   * @param {string[]} [opts.methodNames]
   * @param {string[]} [opts.constantNames]
   * @param {Map<string,string>} [opts.modelVarMap]
   * @param {string} [opts.indent]
   * @param {LoopVar[]} [opts.loopStack]
   */
  constructor(opts = {}) {
    this.signalNames   = opts.signalNames   ?? new Set()
    this.computedNames = opts.computedNames ?? new Set()
    this.propNames     = opts.propNames     ?? new Set()
    this.methodNames   = opts.methodNames   ?? []
    this.constantNames = opts.constantNames ?? []
    this.modelVarMap   = opts.modelVarMap   ?? new Map()
    this.indent        = opts.indent        ?? '    '
    this.loopStack     = opts.loopStack     ?? []
  }

  /**
   * Create a child context for one level deeper nesting.
   * The current loop variables are added to the stack.
   *
   * @param {string} itemVar
   * @param {string|null} indexVar
   * @param {string} [extraIndent]
   * @returns {RenderContext}
   */
  nested(itemVar, indexVar, extraIndent = '  ') {
    return new RenderContext({
      signalNames:   this.signalNames,
      computedNames: this.computedNames,
      propNames:     this.propNames,
      methodNames:   this.methodNames,
      constantNames: this.constantNames,
      modelVarMap:   this.modelVarMap,
      indent:        this.indent + extraIndent,
      loopStack:     [...this.loopStack, { itemVar, indexVar }],
    })
  }

  /**
   * The most recent loop in the stack, or null if not inside a loop.
   * @returns {LoopVar | null}
   */
  get currentLoop() {
    return this.loopStack[this.loopStack.length - 1] ?? null
  }

  /**
   * All loop variable names from all levels of the stack.
   * @returns {Set<string>}
   */
  _allLoopVars() {
    return new Set(
      this.loopStack.flatMap(({ itemVar, indexVar }) =>
        [itemVar, indexVar].filter(Boolean)
      )
    )
  }

  /**
   * Signal names excluding all active loop variables.
   * @returns {Set<string>}
   */
  filteredSignalNames() {
    const loopVars = this._allLoopVars()
    return new Set([...this.signalNames].filter(n => !loopVars.has(n)))
  }

  /**
   * Computed names excluding all active loop variables.
   * @returns {Set<string>}
   */
  filteredComputedNames() {
    const loopVars = this._allLoopVars()
    return new Set([...this.computedNames].filter(n => !loopVars.has(n)))
  }

  /**
   * Prop names excluding all active loop variables.
   * @returns {Set<string>}
   */
  filteredPropNames() {
    const loopVars = this._allLoopVars()
    return new Set([...this.propNames].filter(n => !loopVars.has(n)))
  }

  /**
   * Returns true if the expression only references loop variables
   * (item/index vars from any nesting level), without any signals,
   * props, or computeds.
   *
   * @param {string} expr
   * @returns {boolean}
   */
  isStatic(expr) {
    const loopVars = this._allLoopVars()

    for (const name of this.signalNames) {
      if (!loopVars.has(name) && new RegExp(`\\b${escapeRegex(name)}\\b`).test(expr)) return false
    }
    for (const name of this.propNames) {
      if (!loopVars.has(name) && new RegExp(`\\b${escapeRegex(name)}\\b`).test(expr)) return false
    }
    for (const name of this.computedNames) {
      if (!loopVars.has(name) && new RegExp(`\\b${escapeRegex(name)}\\b`).test(expr)) return false
    }
    return true
  }

  /**
   * Create a RenderContext from a ParseResult.
   *
   * @param {import('../types.js').ParseResult} parseResult
   * @returns {RenderContext}
   */
  static fromParseResult(parseResult) {
    const signalNames = new Set((parseResult.signals || []).map(s => s.name))
    for (const md of (parseResult.modelDefs || [])) {
      signalNames.add(md.varName)
    }

    return new RenderContext({
      signalNames,
      computedNames: new Set((parseResult.computeds || []).map(c => c.name)),
      propNames:     new Set((parseResult.propDefs || []).map(p => p.name)),
      methodNames:   (parseResult.methods || []).map(m => m.name),
      constantNames: (parseResult.constantVars || []).map(v => v.name),
      modelVarMap:   new Map((parseResult.modelDefs || []).map(md => [md.varName, md.name])),
    })
  }
}
