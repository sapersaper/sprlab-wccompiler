/**
 * WCC React Plugin — Vite plugin that transforms idiomatic React JSX slot patterns
 * into WCC-compatible slot markup at build time.
 *
 * This is a standalone copy for the framework-testing app.
 * The canonical source is: integrations/react.js
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
const traverse = _traverse.default || _traverse
const generate = _generate.default || _generate

const JSX_TO_HTML_ATTRS = {
  className: 'class',
  htmlFor: 'for',
  tabIndex: 'tabindex',
  readOnly: 'readonly',
  maxLength: 'maxlength',
  autoFocus: 'autofocus',
  autoComplete: 'autocomplete'
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
])

function serializeJsxToHtml(node, paramNames, warnings) {
  if (!node) return ''
  switch (node.type) {
    case 'JSXElement': return serializeJsxElement(node, paramNames, warnings)
    case 'JSXFragment': return serializeJsxChildren(node.children, paramNames, warnings)
    case 'JSXText': return serializeJsxText(node)
    case 'JSXExpressionContainer': return serializeJsxExpression(node.expression, paramNames, warnings)
    case 'StringLiteral': return node.value
    default: return ''
  }
}

function serializeJsxElement(node, paramNames, warnings) {
  const opening = node.openingElement
  const tagName = opening.name.type === 'JSXIdentifier' ? opening.name.name : ''
  const attrs = serializeAttributes(opening.attributes, paramNames, warnings)
  const isVoid = VOID_ELEMENTS.has(tagName)
  if (isVoid) return `<${tagName}${attrs}>`
  const children = serializeJsxChildren(node.children, paramNames, warnings)
  return `<${tagName}${attrs}>${children}</${tagName}>`
}

function serializeAttributes(attributes, paramNames, warnings) {
  if (!attributes || attributes.length === 0) return ''
  const parts = []
  for (const attr of attributes) {
    if (attr.type === 'JSXSpreadAttribute') {
      if (warnings) warnings.push('Spread attribute cannot be statically serialized')
      continue
    }
    if (attr.type === 'JSXAttribute') {
      const rawName = attr.name.type === 'JSXNamespacedName'
        ? `${attr.name.namespace.name}:${attr.name.name.name}` : attr.name.name
      const htmlName = JSX_TO_HTML_ATTRS[rawName] || rawName
      if (attr.value === null || attr.value === undefined) {
        parts.push(htmlName)
      } else if (attr.value.type === 'StringLiteral') {
        parts.push(`${htmlName}="${attr.value.value}"`)
      } else if (attr.value.type === 'JSXExpressionContainer') {
        const v = serializeAttributeExpression(attr.value.expression, paramNames, warnings)
        if (v !== null) parts.push(`${htmlName}="${v}"`)
      }
    }
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : ''
}

function serializeAttributeExpression(expression, paramNames, warnings) {
  if (!expression) return null
  if (expression.type === 'StringLiteral') return expression.value
  if (expression.type === 'NumericLiteral') return String(expression.value)
  if (expression.type === 'BooleanLiteral') return String(expression.value)
  if (expression.type === 'Identifier') {
    if (paramNames && paramNames.includes(expression.name)) return `{%${expression.name}%}`
    if (warnings) warnings.push(`Dynamic expression "{${expression.name}}" cannot be statically serialized`)
    return null
  }
  if (warnings) warnings.push(`Expression of type "${expression.type}" cannot be statically serialized`)
  return null
}

function serializeJsxChildren(children, paramNames, warnings) {
  if (!children || children.length === 0) return ''
  return children.map(child => serializeJsxToHtml(child, paramNames, warnings)).join('')
}

function serializeJsxText(node) {
  const text = node.value
  if (/^\s+$/.test(text)) return ''
  let result = text.replace(/[ \t]*\n[ \t]*/g, '\n')
  const lines = result.split('\n')
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start++
  let end = lines.length - 1
  while (end >= start && lines[end].trim() === '') end--
  if (start > end) return ''
  return lines.slice(start, end + 1).map((line, i) => {
    if (i === 0 && start > 0) return line.trimStart()
    if (i === end - start && end < lines.length - 1) return line.trimEnd()
    return line
  }).join(' ')
}

function serializeJsxExpression(expression, paramNames, warnings) {
  if (!expression) return ''
  if (expression.type === 'JSXEmptyExpression') return ''
  if (expression.type === 'Identifier') {
    if (paramNames && paramNames.includes(expression.name)) return `{%${expression.name}%}`
    if (warnings) warnings.push(`Dynamic expression "{${expression.name}}" cannot be statically serialized`)
    return ''
  }
  if (expression.type === 'StringLiteral') return expression.value
  if (expression.type === 'NumericLiteral') return String(expression.value)
  if (warnings) warnings.push(`Expression of type "${expression.type}" cannot be statically serialized`)
  return ''
}

const RESERVED_PROPS = new Set([
  'children', 'key', 'ref', 'className', 'id', 'style', 'slot', 'is', 'dangerouslySetInnerHTML'
])

function classifyProp(propName, propValue, options = {}) {
  const { exclude = [], slotProps } = options
  if (RESERVED_PROPS.has(propName)) return { type: 'passthrough' }
  if (propName.length > 2 && propName[0] === 'o' && propName[1] === 'n' && propName[2] >= 'A' && propName[2] <= 'Z') return { type: 'passthrough' }
  if (propName.startsWith('data-') || propName.startsWith('aria-')) return { type: 'passthrough' }
  if (exclude.includes(propName)) return { type: 'passthrough' }
  if (/^render[A-Z]/.test(propName) && propValue && propValue.type === 'ArrowFunctionExpression') {
    const slotName = propName.slice(6)
    const derivedSlotName = slotName[0].toLowerCase() + slotName.slice(1)
    const params = (propValue.params || []).map(p => p.name || '')
    return { type: 'renderProp', slotName: derivedSlotName, params, body: propValue.body }
  }
  if (propValue) {
    const t = propValue.type
    if (t !== 'StringLiteral' && t !== 'JSXElement' && t !== 'JSXFragment') return { type: 'passthrough' }
  } else {
    return { type: 'passthrough' }
  }
  if (slotProps) {
    if (slotProps.includes(propName)) return { type: 'slot', name: propName, value: propValue }
    return { type: 'passthrough' }
  }
  return { type: 'slot', name: propName, value: propValue }
}

function generateNamedSlotElement(slotName, content) {
  const slotAttr = { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'slot' }, value: { type: 'StringLiteral', value: slotName } }
  const opening = { type: 'JSXOpeningElement', name: { type: 'JSXIdentifier', name: 'div' }, attributes: [slotAttr], selfClosing: false }
  const closing = { type: 'JSXClosingElement', name: { type: 'JSXIdentifier', name: 'div' } }
  let children
  if (content.type === 'JSXElement' || content.type === 'JSXFragment' || content.type === 'JSXText' || content.type === 'JSXExpressionContainer') {
    children = [content]
  } else {
    children = [{ type: 'JSXExpressionContainer', expression: content }]
  }
  return { type: 'JSXElement', openingElement: opening, closingElement: closing, children }
}

function generateStringSlotElement(slotName, text) {
  const slotAttr = { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'slot' }, value: { type: 'StringLiteral', value: slotName } }
  const opening = { type: 'JSXOpeningElement', name: { type: 'JSXIdentifier', name: 'span' }, attributes: [slotAttr], selfClosing: false }
  const closing = { type: 'JSXClosingElement', name: { type: 'JSXIdentifier', name: 'span' } }
  return { type: 'JSXElement', openingElement: opening, closingElement: closing, children: [{ type: 'JSXText', value: text }] }
}

function generateScopedSlotElement(slotName, params, body) {
  const htmlTemplate = serializeJsxToHtml(body, params)
  const slotAttr = { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'slot' }, value: { type: 'StringLiteral', value: slotName } }
  const slotPropsAttr = { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'slot-props' }, value: { type: 'StringLiteral', value: params.join(',') } }
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
          computed: false, shorthand: false
        }]
      }
    }
  }
  const opening = { type: 'JSXOpeningElement', name: { type: 'JSXIdentifier', name: 'div' }, attributes: [slotAttr, slotPropsAttr, dangerouslyAttr], selfClosing: false }
  const closing = { type: 'JSXClosingElement', name: { type: 'JSXIdentifier', name: 'div' } }
  return { type: 'JSXElement', openingElement: opening, closingElement: closing, children: [] }
}

export function wccReactPlugin(options = {}) {
  const { prefix, exclude = [], slotProps } = options
  return {
    name: 'vite-plugin-wcc-react-slots',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.[jt]sx$/.test(id)) return null
      let ast
      try {
        ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
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
          if (nameNode.type !== 'JSXIdentifier') return
          const tagName = nameNode.name
          if (!tagName.includes('-')) return
          if (prefix && !tagName.startsWith(prefix)) return
          const slotChildren = []
          const remainingAttributes = []
          for (const attr of openingElement.attributes) {
            if (attr.type !== 'JSXAttribute') { remainingAttributes.push(attr); continue }
            const propName = attr.name.type === 'JSXNamespacedName'
              ? `${attr.name.namespace.name}:${attr.name.name.name}` : attr.name.name
            let propValue = attr.value
            if (propValue && propValue.type === 'JSXExpressionContainer') propValue = propValue.expression
            if (/^render[A-Z]/.test(propName) && propValue && propValue.type !== 'ArrowFunctionExpression' && propValue.type !== 'StringLiteral') {
              pluginCtx.warn(`[wcc-react] ${id} — ${propName}: expected ArrowFunctionExpression, got ${propValue.type}`)
              remainingAttributes.push(attr); continue
            }
            const classification = classifyProp(propName, propValue, { exclude, slotProps })
            if (classification.type === 'slot') {
              if (classification.value.type === 'JSXElement' || classification.value.type === 'JSXFragment') {
                const w = []; serializeJsxToHtml(classification.value, [], w)
                if (w.length > 0) { pluginCtx.warn(`[wcc-react] ${id} — ${propName}: ${w[0]}`); remainingAttributes.push(attr); continue }
              }
              if (classification.value.type === 'StringLiteral') {
                slotChildren.push(generateStringSlotElement(classification.name, classification.value.value))
              } else {
                slotChildren.push(generateNamedSlotElement(classification.name, classification.value))
              }
              transformed = true
            } else if (classification.type === 'renderProp') {
              const w = []; serializeJsxToHtml(classification.body, classification.params, w)
              if (w.length > 0) { pluginCtx.warn(`[wcc-react] ${id} — ${propName}: ${w[0]}`); remainingAttributes.push(attr); continue }
              slotChildren.push(generateScopedSlotElement(classification.slotName, classification.params, classification.body))
              transformed = true
            } else {
              remainingAttributes.push(attr)
            }
          }
          if (slotChildren.length > 0) {
            openingElement.attributes = remainingAttributes
            // If element was self-closing, convert to open/close pair
            if (openingElement.selfClosing) {
              openingElement.selfClosing = false
              path.node.closingElement = { type: 'JSXClosingElement', name: { ...nameNode } }
            }
            path.node.children = [...path.node.children, ...slotChildren]
          }
        }
      })
      if (!transformed) return null
      const result = generate(ast, { sourceMaps: true, sourceFileName: id }, code)
      return { code: result.code, map: result.map }
    }
  }
}
