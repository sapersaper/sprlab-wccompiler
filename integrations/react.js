/**
 * React Vite plugin for WCC custom elements.
 * Transforms idiomatic React JSX slot patterns into WCC-compatible slot markup.
 *
 * @module @sprlab/wccompiler/integrations/react
 *
 * IMPORTANT: This file is for vite.config.js (Node.js context) ONLY.
 * For browser-side hooks, import from '@sprlab/wccompiler/adapters/react'.
 *
 * @example vite.config.js
 * ```js
 * import { wccReactPlugin } from '@sprlab/wccompiler/integrations/react'
 * export default { plugins: [wccReactPlugin()] }
 * ```
 *
 * @example Component (browser — import hooks from adapters)
 * ```jsx
 * import { useWccEvent, useWccModel } from '@sprlab/wccompiler/adapters/react'
 * ```
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
const traverse = _traverse.default || _traverse
const generate = _generate.default || _generate

/**
 * JSX attribute name to HTML attribute name mapping.
 * React uses camelCase for some attributes that HTML uses lowercase.
 * @type {Record<string, string>}
 */
const JSX_TO_HTML_ATTRS = {
  className: 'class',
  htmlFor: 'for',
  tabIndex: 'tabindex',
  readOnly: 'readonly',
  maxLength: 'maxlength',
  autoFocus: 'autofocus',
  autoComplete: 'autocomplete'
}

/**
 * HTML void elements that should not have a closing tag.
 * @type {Set<string>}
 */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
])

/**
 * Serializes a Babel JSX AST node into an HTML string.
 *
 * Converts JSX attribute names to HTML equivalents, handles void elements,
 * recursively serializes nested elements, and replaces parameter references
 * with {%paramName%} tokens for scoped slot templates.
 *
 * @param {object} node - A Babel AST node (JSXElement, JSXFragment, JSXText, JSXExpressionContainer, etc.)
 * @param {string[]} [paramNames] - Parameter names to replace with {%param%} tokens (for scoped slots)
 * @param {Array<string>} [warnings] - Array to collect warning messages about unsupported expressions
 * @returns {string} The serialized HTML string
 */
export function serializeJsxToHtml(node, paramNames, warnings) {
  if (!node) return ''

  switch (node.type) {
    case 'JSXElement':
      return serializeJsxElement(node, paramNames, warnings)

    case 'JSXFragment':
      return serializeJsxChildren(node.children, paramNames, warnings)

    case 'JSXText':
      return serializeJsxText(node)

    case 'JSXExpressionContainer':
      return serializeJsxExpression(node.expression, paramNames, warnings)

    case 'StringLiteral':
      return node.value

    default:
      return ''
  }
}

/**
 * Serializes a JSXElement node to HTML.
 * @param {object} node - JSXElement Babel AST node
 * @param {string[]} [paramNames]
 * @param {Array<string>} [warnings]
 * @returns {string}
 */
function serializeJsxElement(node, paramNames, warnings) {
  const opening = node.openingElement
  const tagName = getJsxElementName(opening.name)
  const attrs = serializeAttributes(opening.attributes, paramNames, warnings)
  const isVoid = VOID_ELEMENTS.has(tagName)

  if (isVoid) {
    return `<${tagName}${attrs}>`
  }

  const children = serializeJsxChildren(node.children, paramNames, warnings)
  return `<${tagName}${attrs}>${children}</${tagName}>`
}

/**
 * Gets the tag name string from a JSX element name node.
 * @param {object} nameNode - JSXIdentifier or JSXMemberExpression
 * @returns {string}
 */
function getJsxElementName(nameNode) {
  if (nameNode.type === 'JSXIdentifier') {
    return nameNode.name
  }
  if (nameNode.type === 'JSXMemberExpression') {
    return `${getJsxElementName(nameNode.object)}.${nameNode.property.name}`
  }
  if (nameNode.type === 'JSXNamespacedName') {
    return `${nameNode.namespace.name}:${nameNode.name.name}`
  }
  return ''
}

/**
 * Serializes JSX attributes to an HTML attribute string.
 * @param {Array<object>} attributes - Array of JSXAttribute or JSXSpreadAttribute nodes
 * @param {string[]} [paramNames]
 * @param {Array<string>} [warnings]
 * @returns {string} Attribute string with leading space, or empty string
 */
function serializeAttributes(attributes, paramNames, warnings) {
  if (!attributes || attributes.length === 0) return ''

  const parts = []
  for (const attr of attributes) {
    if (attr.type === 'JSXSpreadAttribute') {
      // Spread attributes can't be statically serialized
      if (warnings) {
        warnings.push(`Spread attribute cannot be statically serialized`)
      }
      continue
    }

    if (attr.type === 'JSXAttribute') {
      const rawName = attr.name.type === 'JSXNamespacedName'
        ? `${attr.name.namespace.name}:${attr.name.name.name}`
        : attr.name.name
      const htmlName = JSX_TO_HTML_ATTRS[rawName] || rawName

      if (attr.value === null || attr.value === undefined) {
        // Boolean attribute (e.g., `disabled`)
        parts.push(htmlName)
      } else if (attr.value.type === 'StringLiteral') {
        parts.push(`${htmlName}="${attr.value.value}"`)
      } else if (attr.value.type === 'JSXExpressionContainer') {
        const exprValue = serializeAttributeExpression(attr.value.expression, paramNames, warnings)
        if (exprValue !== null) {
          parts.push(`${htmlName}="${exprValue}"`)
        }
      }
    }
  }

  return parts.length > 0 ? ' ' + parts.join(' ') : ''
}

/**
 * Serializes an expression used as an attribute value.
 * @param {object} expression - Babel AST expression node
 * @param {string[]} [paramNames]
 * @param {Array<string>} [warnings]
 * @returns {string|null} The serialized value, or null if it can't be serialized
 */
function serializeAttributeExpression(expression, paramNames, warnings) {
  if (!expression) return null

  if (expression.type === 'StringLiteral') {
    return expression.value
  }

  if (expression.type === 'NumericLiteral') {
    return String(expression.value)
  }

  if (expression.type === 'BooleanLiteral') {
    return String(expression.value)
  }

  if (expression.type === 'Identifier') {
    if (paramNames && paramNames.includes(expression.name)) {
      return `{%${expression.name}%}`
    }
    // Dynamic expression that can't be statically serialized
    if (warnings) {
      warnings.push(`Dynamic expression "{${expression.name}}" cannot be statically serialized`)
    }
    return null
  }

  if (expression.type === 'TemplateLiteral') {
    return serializeTemplateLiteral(expression, paramNames, warnings)
  }

  // Other expressions can't be statically serialized
  if (warnings) {
    warnings.push(`Expression of type "${expression.type}" cannot be statically serialized`)
  }
  return null
}

/**
 * Serializes a template literal expression.
 * @param {object} node - TemplateLiteral AST node
 * @param {string[]} [paramNames]
 * @param {Array<string>} [warnings]
 * @returns {string|null}
 */
function serializeTemplateLiteral(node, paramNames, warnings) {
  let result = ''
  for (let i = 0; i < node.quasis.length; i++) {
    result += node.quasis[i].value.raw
    if (i < node.expressions.length) {
      const expr = node.expressions[i]
      if (expr.type === 'Identifier' && paramNames && paramNames.includes(expr.name)) {
        result += `{%${expr.name}%}`
      } else if (expr.type === 'StringLiteral') {
        result += expr.value
      } else if (expr.type === 'NumericLiteral') {
        result += String(expr.value)
      } else {
        if (warnings) {
          warnings.push(`Dynamic expression in template literal cannot be statically serialized`)
        }
        return null
      }
    }
  }
  return result
}

/**
 * Serializes an array of JSX children nodes.
 * @param {Array<object>} children
 * @param {string[]} [paramNames]
 * @param {Array<string>} [warnings]
 * @returns {string}
 */
function serializeJsxChildren(children, paramNames, warnings) {
  if (!children || children.length === 0) return ''
  return children.map(child => serializeJsxToHtml(child, paramNames, warnings)).join('')
}

/**
 * Serializes a JSXText node, handling whitespace similar to how React does.
 * - Whitespace-only text nodes (just newlines/spaces between elements) → empty
 * - Newlines with surrounding whitespace are collapsed to a single space
 * - Inline spaces are preserved (they are significant content)
 * @param {object} node - JSXText AST node
 * @returns {string}
 */
function serializeJsxText(node) {
  const text = node.value
  // If the text is only whitespace (newlines, spaces, tabs), return empty
  if (/^\s+$/.test(text)) return ''
  // Collapse newlines and their surrounding whitespace to a single space
  let result = text.replace(/[ \t]*\n[ \t]*/g, '\n')
  // Split by newlines to handle multi-line text
  const lines = result.split('\n')
  // Trim empty leading/trailing lines but preserve inline content
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start++
  let end = lines.length - 1
  while (end >= start && lines[end].trim() === '') end--
  if (start > end) return ''
  // Join remaining lines with a space (newlines become spaces in JSX)
  return lines.slice(start, end + 1).map((line, i) => {
    if (i === 0 && start > 0) return line.trimStart()
    if (i === end - start && end < lines.length - 1) return line.trimEnd()
    return line
  }).join(' ')
}

/**
 * Serializes a JSX expression container's expression.
 * @param {object} expression - The expression inside {  }
 * @param {string[]} [paramNames]
 * @param {Array<string>} [warnings]
 * @returns {string}
 */
function serializeJsxExpression(expression, paramNames, warnings) {
  if (!expression) return ''

  // JSXEmptyExpression (e.g., {/* comment */})
  if (expression.type === 'JSXEmptyExpression') return ''

  // Identifier — check if it's a param reference
  if (expression.type === 'Identifier') {
    if (paramNames && paramNames.includes(expression.name)) {
      return `{%${expression.name}%}`
    }
    // Dynamic expression
    if (warnings) {
      warnings.push(`Dynamic expression "{${expression.name}}" cannot be statically serialized`)
    }
    return ''
  }

  // String literal — inline the value
  if (expression.type === 'StringLiteral') {
    return expression.value
  }

  // Numeric literal — inline the value
  if (expression.type === 'NumericLiteral') {
    return String(expression.value)
  }

  // Template literal
  if (expression.type === 'TemplateLiteral') {
    const result = serializeTemplateLiteral(expression, paramNames, warnings)
    return result !== null ? result : ''
  }

  // Other expressions can't be statically serialized
  if (warnings) {
    warnings.push(`Expression of type "${expression.type}" cannot be statically serialized`)
  }
  return ''
}


/**
 * Reserved prop names that should always pass through without slot transformation.
 * @type {Set<string>}
 */
const RESERVED_PROPS = new Set([
  'children', 'key', 'ref', 'className', 'id', 'style', 'slot', 'is', 'dangerouslySetInnerHTML'
])

/**
 * Classifies a prop on a custom element to determine how it should be handled.
 *
 * Classification rules are applied in priority order:
 * 1. Reserved props → passthrough
 * 2. Event handlers (on + uppercase) → passthrough
 * 3. data-/aria- prefixed props → passthrough
 * 4. Props in user's exclude list → passthrough
 * 5. Render props (render + uppercase + ArrowFunctionExpression) → renderProp
 * 6. Non-JSX/non-string values → passthrough
 * 7. Named slot prop (respecting slotProps option) → slot
 *
 * @param {string} propName - The prop name
 * @param {object} propValue - The Babel AST node for the prop value
 * @param {object} options - Plugin options
 * @param {string[]} [options.exclude] - Prop names to never treat as slots
 * @param {string[]} [options.slotProps] - Explicit list of prop names to treat as named slots
 * @returns {{ type: 'slot', name: string, value: object } | { type: 'renderProp', slotName: string, params: string[], body: object } | { type: 'passthrough' }}
 */
export function classifyProp(propName, propValue, options = {}) {
  const { exclude = [], slotProps } = options

  // Rule 1: Reserved props always pass through
  if (RESERVED_PROPS.has(propName)) {
    return { type: 'passthrough' }
  }

  // Rule 2: Event handlers (on + uppercase letter) always pass through
  if (propName.length > 2 && propName[0] === 'o' && propName[1] === 'n' && propName[2] >= 'A' && propName[2] <= 'Z') {
    return { type: 'passthrough' }
  }

  // Rule 3: data- and aria- prefixed props always pass through
  if (propName.startsWith('data-') || propName.startsWith('aria-')) {
    return { type: 'passthrough' }
  }

  // Rule 4: Props in the user's exclude list always pass through
  if (exclude.includes(propName)) {
    return { type: 'passthrough' }
  }

  // Rule 5: Render props (render + uppercase AND ArrowFunctionExpression value)
  if (/^render[A-Z]/.test(propName) && propValue && propValue.type === 'ArrowFunctionExpression') {
    const slotName = propName.slice(6)
    const derivedSlotName = slotName[0].toLowerCase() + slotName.slice(1)
    const params = (propValue.params || []).map(p => p.name || (p.type === 'Identifier' ? p.name : ''))
    return {
      type: 'renderProp',
      slotName: derivedSlotName,
      params,
      body: propValue.body
    }
  }

  // Rule 6: Non-JSX/non-string values always pass through
  // We need to check the actual value type. In JSX, prop values come wrapped in
  // JSXExpressionContainer. The propValue here is the raw value node.
  if (propValue) {
    const valueType = propValue.type
    // String literals are slot-eligible
    if (valueType === 'StringLiteral') {
      // Fall through to Rule 7
    }
    // JSX expressions are slot-eligible
    else if (valueType === 'JSXElement' || valueType === 'JSXFragment') {
      // Fall through to Rule 7
    }
    // Everything else (NumericLiteral, BooleanLiteral, Identifier, ArrayExpression,
    // ObjectExpression, CallExpression, etc.) passes through
    else {
      return { type: 'passthrough' }
    }
  } else {
    // No value (boolean shorthand like `disabled`) passes through
    return { type: 'passthrough' }
  }

  // Rule 7: Named slot prop (respecting slotProps option if set)
  if (slotProps) {
    // When slotProps is set, only props in that list become slots
    if (slotProps.includes(propName)) {
      return { type: 'slot', name: propName, value: propValue }
    }
    // Not in the explicit list → passthrough
    return { type: 'passthrough' }
  }

  // Default heuristic: any remaining prop with JSX or string value is a slot
  return { type: 'slot', name: propName, value: propValue }
}


/**
 * Derives a slot name from a render prop name by stripping the `render` prefix
 * and lowercasing the first character of the remaining name.
 *
 * @param {string} renderPropName - The render prop name (e.g., 'renderStats', 'renderItemRow')
 * @returns {string} The derived slot name (e.g., 'stats', 'itemRow')
 *
 * @example
 * deriveSlotName('renderStats')   // → 'stats'
 * deriveSlotName('renderItemRow') // → 'itemRow'
 */
export function deriveSlotName(renderPropName) {
  const withoutPrefix = renderPropName.slice(6) // strip "render"
  return withoutPrefix[0].toLowerCase() + withoutPrefix.slice(1)
}


/**
 * Creates a Babel AST JSXElement node representing `<div slot="name">content</div>`.
 * Used for named slot props whose value is a JSX expression.
 *
 * @param {string} slotName - The slot name to use in the `slot` attribute
 * @param {object} content - A Babel JSX AST node (JSXElement, JSXFragment, etc.) to wrap as children
 * @returns {object} A Babel JSXElement AST node
 */
export function generateNamedSlotElement(slotName, content) {
  const slotAttr = {
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name: 'slot' },
    value: { type: 'StringLiteral', value: slotName }
  }

  const openingElement = {
    type: 'JSXOpeningElement',
    name: { type: 'JSXIdentifier', name: 'div' },
    attributes: [slotAttr],
    selfClosing: false
  }

  const closingElement = {
    type: 'JSXClosingElement',
    name: { type: 'JSXIdentifier', name: 'div' }
  }

  // Wrap content in a JSXExpressionContainer if it's not already a JSX child type
  let children
  if (content.type === 'JSXElement' || content.type === 'JSXFragment' || content.type === 'JSXText' || content.type === 'JSXExpressionContainer') {
    children = [content]
  } else {
    children = [{ type: 'JSXExpressionContainer', expression: content }]
  }

  return {
    type: 'JSXElement',
    openingElement,
    closingElement,
    children
  }
}


/**
 * Creates a Babel AST JSXElement node representing `<span slot="name">text</span>`.
 * Used for named slot props whose value is a string literal.
 *
 * @param {string} slotName - The slot name to use in the `slot` attribute
 * @param {string} text - The string text content
 * @returns {object} A Babel JSXElement AST node
 */
export function generateStringSlotElement(slotName, text) {
  const slotAttr = {
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name: 'slot' },
    value: { type: 'StringLiteral', value: slotName }
  }

  const openingElement = {
    type: 'JSXOpeningElement',
    name: { type: 'JSXIdentifier', name: 'span' },
    attributes: [slotAttr],
    selfClosing: false
  }

  const closingElement = {
    type: 'JSXClosingElement',
    name: { type: 'JSXIdentifier', name: 'span' }
  }

  return {
    type: 'JSXElement',
    openingElement,
    closingElement,
    children: [{ type: 'JSXText', value: text }]
  }
}


/**
 * Creates a Babel AST JSXElement node representing:
 * `<div slot="name" slot-props="param1,param2" dangerouslySetInnerHTML={{__html: `...`}}></div>`
 *
 * Used for render prop (scoped slot) transformation. The body JSX is serialized to an HTML
 * template string with {%param%} tokens using `serializeJsxToHtml`.
 *
 * @param {string} slotName - The derived slot name
 * @param {string[]} params - The arrow function parameter names
 * @param {object} body - The Babel JSX AST node for the arrow function body
 * @returns {object} A Babel JSXElement AST node
 */
export function generateScopedSlotElement(slotName, params, body) {
  // Serialize the body to an HTML template string with {%param%} tokens
  const htmlTemplate = serializeJsxToHtml(body, params)

  // slot="name" attribute
  const slotAttr = {
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name: 'slot' },
    value: { type: 'StringLiteral', value: slotName }
  }

  // slot-props="param1,param2" attribute
  const slotPropsAttr = {
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name: 'slot-props' },
    value: { type: 'StringLiteral', value: params.join(',') }
  }

  // dangerouslySetInnerHTML={{__html: `...`}} attribute
  const dangerouslyAttr = {
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name: 'dangerouslySetInnerHTML' },
    value: {
      type: 'JSXExpressionContainer',
      expression: {
        type: 'ObjectExpression',
        properties: [{
          type: 'ObjectProperty',
          key: { type: 'Identifier', name: '__html' },
          value: { type: 'TemplateLiteral', quasis: [{ type: 'TemplateElement', value: { raw: htmlTemplate, cooked: htmlTemplate } }], expressions: [] },
          computed: false,
          shorthand: false
        }]
      }
    }
  }

  const openingElement = {
    type: 'JSXOpeningElement',
    name: { type: 'JSXIdentifier', name: 'div' },
    attributes: [slotAttr, slotPropsAttr, dangerouslyAttr],
    selfClosing: false
  }

  const closingElement = {
    type: 'JSXClosingElement',
    name: { type: 'JSXIdentifier', name: 'div' }
  }

  return {
    type: 'JSXElement',
    openingElement,
    closingElement,
    children: []
  }
}


/**
 * Vite plugin that transforms idiomatic React JSX slot patterns into
 * WCC-compatible slot markup at build time.
 *
 * Runs with `enforce: 'pre'` so it processes JSX before @vitejs/plugin-react.
 *
 * @param {Object} [options]
 * @param {string} [options.prefix] - Tag prefix filter (e.g., 'wcc-'). If set, only elements starting with this prefix are processed.
 * @param {string[]} [options.exclude] - Prop names to never treat as slots.
 * @param {string[]} [options.slotProps] - Explicit list of prop names to treat as named slots (overrides default heuristic).
 * @returns {import('vite').Plugin}
 */
export function wccReactPlugin(options = {}) {
  const { prefix, exclude = [], slotProps } = options

  return {
    name: 'vite-plugin-wcc-react-slots',
    enforce: 'pre',
    transform(code, id) {
      // Only process .jsx and .tsx files
      if (!/\.[jt]sx$/.test(id)) {
        return null
      }

      let ast
      try {
        ast = parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript']
        })
      } catch (e) {
        this.warn(`[wcc-react] ${id} — failed to parse: ${e.message}`)
        return null
      }

      let transformed = false
      const pluginCtx = this

      traverse(ast, {
        JSXElement(path) {
          const openingElement = path.node.openingElement
          const nameNode = openingElement.name

          // ── Compound component transform ──
          // <WccCard.Header>children</WccCard.Header> → <div slot="header" style={{display:'contents'}}>children</div>
          // <WccCard.Stats>{(likes) => <span>{likes}</span>}</WccCard.Stats> → scoped slot div
          if (nameNode.type === 'JSXMemberExpression') {
            const objectName = nameNode.object?.name // e.g., 'WccCard'
            const propName = nameNode.property?.name // e.g., 'Header'
            if (!objectName || !propName) return

            // Convert PascalCase object to kebab-case and check if it's a custom element
            const kebab = objectName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
            if (!kebab.includes('-')) return
            if (prefix && !kebab.startsWith(prefix)) return

            // Derive slot name: Header → header, FooterNav → footerNav (lcfirst)
            const slotName = propName[0].toLowerCase() + propName.slice(1)

            // Check if children is a function (scoped slot / render prop pattern)
            const children = path.node.children
            const isScopedSlot = children.length === 1
              && children[0].type === 'JSXExpressionContainer'
              && children[0].expression.type === 'ArrowFunctionExpression'

            if (isScopedSlot) {
              // Scoped slot: <WccCard.Stats>{(likes) => <span>{likes}</span>}</WccCard.Stats>
              const arrowFn = children[0].expression
              const params = (arrowFn.params || []).map(p => p.name || '')
              const body = arrowFn.body

              // Warn on unsupported expressions
              const renderWarnings = []
              serializeJsxToHtml(body, params, renderWarnings)
              if (renderWarnings.length > 0) {
                pluginCtx.warn(`[wcc-react] ${id} — ${objectName}.${propName}: ${renderWarnings[0]}`)
                return
              }

              // Replace with scoped slot element
              const scopedEl = generateScopedSlotElement(slotName, params, body)
              path.replaceWith(scopedEl)
              transformed = true
            } else {
              // Named slot: <WccCard.Header><strong>Title</strong></WccCard.Header>
              // → <div slot="header" style={{display:'contents'}}>children</div>
              const slotAttr = {
                type: 'JSXAttribute',
                name: { type: 'JSXIdentifier', name: 'slot' },
                value: { type: 'StringLiteral', value: slotName }
              }
              const styleAttr = {
                type: 'JSXAttribute',
                name: { type: 'JSXIdentifier', name: 'style' },
                value: {
                  type: 'JSXExpressionContainer',
                  expression: {
                    type: 'ObjectExpression',
                    properties: [{
                      type: 'ObjectProperty',
                      key: { type: 'Identifier', name: 'display' },
                      value: { type: 'StringLiteral', value: 'contents' },
                      computed: false,
                      shorthand: false
                    }]
                  }
                }
              }

              openingElement.name = { type: 'JSXIdentifier', name: 'div' }
              openingElement.attributes = [...openingElement.attributes, slotAttr, styleAttr]
              if (path.node.closingElement) {
                path.node.closingElement.name = { type: 'JSXIdentifier', name: 'div' }
              }
              transformed = true
            }
            return
          }

          // ── PascalCase custom element transform ──
          // <WccCard> → <wcc-card> (only if it maps to a hyphenated tag)
          if (nameNode.type === 'JSXIdentifier' && /^[A-Z]/.test(nameNode.name)) {
            const kebab = nameNode.name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
            if (!kebab.includes('-')) return
            if (prefix && !kebab.startsWith(prefix)) return

            // Rewrite tag name to kebab-case
            openingElement.name = { type: 'JSXIdentifier', name: kebab }
            if (path.node.closingElement) {
              path.node.closingElement.name = { type: 'JSXIdentifier', name: kebab }
            }
            transformed = true
            // Fall through to process props on this element
          }

          // Only process elements with hyphenated tag names (custom elements)
          const currentName = openingElement.name
          if (currentName.type !== 'JSXIdentifier') return
          const tagName = currentName.name
          if (!tagName.includes('-')) return

          // Apply prefix filtering if set
          if (prefix && !tagName.startsWith(prefix)) return

          const slotChildren = []
          const remainingAttributes = []

          for (const attr of openingElement.attributes) {
            // Skip spread attributes — leave them unchanged
            if (attr.type !== 'JSXAttribute') {
              remainingAttributes.push(attr)
              continue
            }

            const propName = attr.name.type === 'JSXNamespacedName'
              ? `${attr.name.namespace.name}:${attr.name.name.name}`
              : attr.name.name

            // Get the prop value — unwrap JSXExpressionContainer
            let propValue = attr.value
            if (propValue && propValue.type === 'JSXExpressionContainer') {
              propValue = propValue.expression
            }

            // Task 7.2: Warn on invalid render prop values (non-arrow-function)
            if (/^render[A-Z]/.test(propName) && propValue && propValue.type !== 'ArrowFunctionExpression' && propValue.type !== 'StringLiteral') {
              pluginCtx.warn(`[wcc-react] ${id} — ${propName}: expected ArrowFunctionExpression, got ${propValue.type}`)
              remainingAttributes.push(attr)
              continue
            }

            const classification = classifyProp(propName, propValue, { exclude, slotProps })

            if (classification.type === 'slot') {
              // Task 7.4: Warn on dynamic expressions in named slot props — leave prop unchanged
              if (classification.value.type === 'JSXElement' || classification.value.type === 'JSXFragment') {
                const slotWarnings = []
                serializeJsxToHtml(classification.value, [], slotWarnings)
                if (slotWarnings.length > 0) {
                  pluginCtx.warn(`[wcc-react] ${id} — ${propName}: ${slotWarnings[0]}`)
                  remainingAttributes.push(attr)
                  continue
                }
              }
              // Generate slot child element
              if (classification.value.type === 'StringLiteral') {
                slotChildren.push(generateStringSlotElement(classification.name, classification.value.value))
              } else {
                slotChildren.push(generateNamedSlotElement(classification.name, classification.value))
              }
              transformed = true
            } else if (classification.type === 'renderProp') {
              // Task 7.3: Warn on unsupported expressions in render prop bodies — leave prop unchanged
              const renderWarnings = []
              serializeJsxToHtml(classification.body, classification.params, renderWarnings)
              if (renderWarnings.length > 0) {
                pluginCtx.warn(`[wcc-react] ${id} — ${propName}: ${renderWarnings[0]}`)
                remainingAttributes.push(attr)
                continue
              }
              // Generate scoped slot element
              slotChildren.push(generateScopedSlotElement(
                classification.slotName,
                classification.params,
                classification.body
              ))
              transformed = true
            } else {
              // passthrough — keep the attribute
              remainingAttributes.push(attr)
            }
          }

          if (slotChildren.length > 0) {
            // Remove transformed slot props from the element's attributes
            openingElement.attributes = remainingAttributes

            // If element was self-closing, convert to open/close pair
            if (openingElement.selfClosing) {
              openingElement.selfClosing = false
              path.node.closingElement = { type: 'JSXClosingElement', name: { ...nameNode } }
            }

            // Append generated slot elements after existing children
            path.node.children = [...path.node.children, ...slotChildren]
          }
        }
      })

      if (!transformed) {
        return null
      }

      const result = generate(ast, { sourceMaps: true, sourceFileName: id }, code)
      return { code: result.code, map: result.map }
    }
  }
}


/**
 * Vite plugin that generates a virtual module with component stubs for
 * PascalCase imports. These stubs satisfy the linter/IDE (component is "defined")
 * and the wccReactPlugin transforms them to native custom elements at build time.
 *
 * This enables the standard React import pattern:
 *   import { WccCounter, WccCard } from '@wcc/react'
 *
 * The stubs are zero-runtime — they're just tag name strings with slot name
 * properties. The wccReactPlugin handles the actual JSX transformation.
 *
 * @param {Object} [options]
 * @param {string} [options.moduleId='@wcc/react'] - Virtual module ID for imports
 * @param {string} [options.componentsDir='./dist'] - Directory containing compiled WCC .js files
 * @param {string} [options.prefix='wcc-'] - Tag prefix filter
 * @returns {import('vite').Plugin}
 *
 * @example vite.config.js
 * ```js
 * import { wccReactPlugin, wccReactComponents } from '@sprlab/wccompiler/integrations/react'
 * export default {
 *   plugins: [
 *     wccReactComponents({ componentsDir: './src/wcc' }),
 *     wccReactPlugin(),
 *     react()
 *   ]
 * }
 * ```
 *
 * @example Component.jsx
 * ```jsx
 * import { WccCard, WccList } from '@wcc/react'
 *
 * <WccCard>
 *   <WccCard.Header><strong>Title</strong></WccCard.Header>
 *   <p>Body</p>
 * </WccCard>
 *
 * <WccList>
 *   <WccList.Item>{(item) => <li>{item}</li>}</WccList.Item>
 * </WccList>
 * ```
 */
export function wccReactComponents(options = {}) {
  const {
    moduleId = '@wcc/react',
    componentsDir = './dist',
    prefix = 'wcc-'
  } = options

  const resolvedId = '\0' + moduleId

  return {
    name: 'vite-plugin-wcc-react-components',
    resolveId(id) {
      if (id === moduleId) return resolvedId
      return null
    },
    async load(id) {
      if (id !== resolvedId) return null

      // Scan componentsDir for .js files and extract __meta
      const fs = await import('fs')
      const path = await import('path')

      const dir = path.default.resolve(componentsDir)
      if (!fs.default.existsSync(dir)) {
        this.warn(`[wcc-react-components] Directory not found: ${dir}`)
        return 'export {}'
      }

      const files = fs.default.readdirSync(dir).filter(f => f.endsWith('.js'))
      const components = []

      for (const file of files) {
        const content = fs.default.readFileSync(path.default.join(dir, file), 'utf-8')
        const metaMatch = content.match(/static __meta\s*=\s*(\{[^}]+\})/)
        if (!metaMatch) continue

        try {
          const metaStr = metaMatch[1]
            .replace(/'/g, '"')
            .replace(/(\w+):/g, '"$1":')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
          const meta = JSON.parse(metaStr)

          if (!meta.tag || !meta.tag.startsWith(prefix)) continue

          const pascalName = meta.tag.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')
          components.push({ meta, pascalName, file })
        } catch (e) {
          // Skip files with unparseable meta
        }
      }

      if (components.length === 0) {
        return 'export {}'
      }

      // Generate lightweight stubs (zero runtime)
      // The wccReactPlugin transforms these at build time
      let code = '// Auto-generated WCC component stubs (transformed by wccReactPlugin at build time)\n'

      // Import each component file to ensure custom element registration
      for (const comp of components) {
        code += `import '${path.default.resolve(dir, comp.file)}';\n`
      }

      code += '\n'

      // Generate stub exports with compound slot properties
      // Use Object.assign to create an object that holds the tag name and slot sub-properties
      for (const comp of components) {
        const slots = comp.meta.slots || []
        code += `export const ${comp.pascalName} = Object.assign(() => '${comp.meta.tag}', { __tag: '${comp.meta.tag}'`
        for (const slot of slots) {
          if (!slot) continue
          const pascalSlot = slot[0].toUpperCase() + slot.slice(1)
          code += `, ${pascalSlot}: '${slot}'`
        }
        code += ` });\n`
      }

      return code
    }
  }
}
