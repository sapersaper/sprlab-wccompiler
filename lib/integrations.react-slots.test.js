import { describe, it, expect, vi } from 'vitest'
import fc from 'fast-check'

vi.mock('react', () => ({
  useRef: (initial) => ({ current: initial }),
  useEffect: () => {},
  useCallback: (fn) => fn
}))

const { classifyProp } = await import('../integrations/react.js')

describe('React Plugin Slots - classifyProp', () => {
  describe('Rule 1: Reserved props pass through', () => {
    const reservedProps = ['children', 'key', 'ref', 'className', 'id', 'style', 'slot', 'is', 'dangerouslySetInnerHTML']

    reservedProps.forEach(propName => {
      it(`passes through reserved prop "${propName}"`, () => {
        const result = classifyProp(propName, { type: 'JSXElement' }, {})
        expect(result).toEqual({ type: 'passthrough' })
      })
    })
  })

  describe('Rule 2: Event handlers pass through', () => {
    it('passes through onClick', () => {
      const result = classifyProp('onClick', { type: 'ArrowFunctionExpression', params: [] }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through onChange', () => {
      const result = classifyProp('onChange', { type: 'Identifier', name: 'handler' }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through onMouseEnter', () => {
      const result = classifyProp('onMouseEnter', { type: 'ArrowFunctionExpression', params: [] }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('does NOT treat "on" (no uppercase after) as event handler', () => {
      // "on" alone is only 2 chars, doesn't match on+uppercase pattern
      const result = classifyProp('on', { type: 'StringLiteral', value: 'test' }, {})
      expect(result).toEqual({ type: 'slot', name: 'on', value: { type: 'StringLiteral', value: 'test' } })
    })

    it('does NOT treat "once" as event handler (lowercase after "on")', () => {
      const result = classifyProp('once', { type: 'StringLiteral', value: 'test' }, {})
      expect(result).toEqual({ type: 'slot', name: 'once', value: { type: 'StringLiteral', value: 'test' } })
    })
  })

  describe('Rule 3: data-/aria- prefixed props pass through', () => {
    it('passes through data-testid', () => {
      const result = classifyProp('data-testid', { type: 'StringLiteral', value: 'card' }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through aria-label', () => {
      const result = classifyProp('aria-label', { type: 'StringLiteral', value: 'Close' }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through data-custom-attr', () => {
      const result = classifyProp('data-custom-attr', { type: 'StringLiteral', value: 'val' }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })
  })

  describe('Rule 4: Exclude list props pass through', () => {
    it('passes through props in exclude list', () => {
      const result = classifyProp('header', { type: 'JSXElement' }, { exclude: ['header', 'footer'] })
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('does not pass through props NOT in exclude list', () => {
      const result = classifyProp('sidebar', { type: 'JSXElement' }, { exclude: ['header', 'footer'] })
      expect(result).toEqual({ type: 'slot', name: 'sidebar', value: { type: 'JSXElement' } })
    })
  })

  describe('Rule 5: Render props classified as renderProp', () => {
    it('classifies renderStats with ArrowFunctionExpression as renderProp', () => {
      const propValue = {
        type: 'ArrowFunctionExpression',
        params: [{ type: 'Identifier', name: 'likes' }],
        body: { type: 'JSXElement', openingElement: { name: { name: 'span' } } }
      }
      const result = classifyProp('renderStats', propValue, {})
      expect(result).toEqual({
        type: 'renderProp',
        slotName: 'stats',
        params: ['likes'],
        body: propValue.body
      })
    })

    it('derives slot name correctly: renderItemRow → itemRow', () => {
      const propValue = {
        type: 'ArrowFunctionExpression',
        params: [{ type: 'Identifier', name: 'item' }, { type: 'Identifier', name: 'index' }],
        body: { type: 'JSXElement' }
      }
      const result = classifyProp('renderItemRow', propValue, {})
      expect(result.type).toBe('renderProp')
      expect(result.slotName).toBe('itemRow')
      expect(result.params).toEqual(['item', 'index'])
    })

    it('does NOT classify renderStats as renderProp if value is not ArrowFunctionExpression', () => {
      // If value is a string literal, it falls through to Rule 6/7
      const result = classifyProp('renderStats', { type: 'StringLiteral', value: 'test' }, {})
      expect(result).toEqual({ type: 'slot', name: 'renderStats', value: { type: 'StringLiteral', value: 'test' } })
    })

    it('does NOT classify "render" (no uppercase after) as renderProp', () => {
      const propValue = {
        type: 'ArrowFunctionExpression',
        params: [],
        body: { type: 'JSXElement' }
      }
      // "render" alone doesn't match /^render[A-Z]/ — falls through to Rule 6
      const result = classifyProp('render', propValue, {})
      // ArrowFunctionExpression is not JSXElement/JSXFragment/StringLiteral → passthrough
      expect(result).toEqual({ type: 'passthrough' })
    })
  })

  describe('Rule 6: Non-JSX/non-string values pass through', () => {
    it('passes through numeric literals', () => {
      const result = classifyProp('count', { type: 'NumericLiteral', value: 42 }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through boolean literals', () => {
      const result = classifyProp('disabled', { type: 'BooleanLiteral', value: true }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through identifiers (variable references)', () => {
      const result = classifyProp('items', { type: 'Identifier', name: 'myArray' }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through array expressions', () => {
      const result = classifyProp('items', { type: 'ArrayExpression', elements: [] }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through object expressions', () => {
      const result = classifyProp('config', { type: 'ObjectExpression', properties: [] }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through call expressions', () => {
      const result = classifyProp('value', { type: 'CallExpression' }, {})
      expect(result).toEqual({ type: 'passthrough' })
    })

    it('passes through null/undefined value (boolean shorthand)', () => {
      const result = classifyProp('disabled', null, {})
      expect(result).toEqual({ type: 'passthrough' })
    })
  })

  describe('Rule 7: Named slot props', () => {
    it('classifies JSXElement value as slot', () => {
      const propValue = { type: 'JSXElement' }
      const result = classifyProp('header', propValue, {})
      expect(result).toEqual({ type: 'slot', name: 'header', value: propValue })
    })

    it('classifies JSXFragment value as slot', () => {
      const propValue = { type: 'JSXFragment' }
      const result = classifyProp('footer', propValue, {})
      expect(result).toEqual({ type: 'slot', name: 'footer', value: propValue })
    })

    it('classifies StringLiteral value as slot', () => {
      const propValue = { type: 'StringLiteral', value: 'Hello' }
      const result = classifyProp('title', propValue, {})
      expect(result).toEqual({ type: 'slot', name: 'title', value: propValue })
    })

    it('respects slotProps option — only listed props become slots', () => {
      const propValue = { type: 'JSXElement' }
      const options = { slotProps: ['header', 'footer'] }

      const headerResult = classifyProp('header', propValue, options)
      expect(headerResult).toEqual({ type: 'slot', name: 'header', value: propValue })

      const sidebarResult = classifyProp('sidebar', propValue, options)
      expect(sidebarResult).toEqual({ type: 'passthrough' })
    })

    it('slotProps does not override reserved props', () => {
      const propValue = { type: 'JSXElement' }
      const options = { slotProps: ['className', 'header'] }

      // className is reserved, should still pass through even if in slotProps
      const result = classifyProp('className', propValue, options)
      expect(result).toEqual({ type: 'passthrough' })
    })
  })
})


describe('React Plugin Slots - Property-Based Tests for Prop Classification', () => {
  // Generator: event handler names (on + uppercase letter + arbitrary suffix)
  const eventHandlerNameArb = fc.tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.stringMatching(/^[a-zA-Z0-9]{0,20}$/)
  ).map(([upper, suffix]) => `on${upper}${suffix}`)

  // Generator: reserved prop names
  const reservedPropNameArb = fc.constantFrom(
    'children', 'key', 'ref', 'className', 'id', 'style', 'slot', 'is', 'dangerouslySetInnerHTML'
  )

  // Generator: data-/aria- prop names
  const dataAriaPropNameArb = fc.tuple(
    fc.constantFrom('data-', 'aria-'),
    fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,19}$/)
  ).map(([prefix, suffix]) => `${prefix}${suffix}`)

  // Generator: non-JSX value types (NumericLiteral, BooleanLiteral, Identifier, ArrayExpression, ObjectExpression, CallExpression)
  const nonJsxValueArb = fc.oneof(
    fc.double({ noNaN: true }).map(n => ({ type: 'NumericLiteral', value: n })),
    fc.boolean().map(b => ({ type: 'BooleanLiteral', value: b })),
    fc.stringMatching(/^[a-zA-Z_$][a-zA-Z0-9_$]{0,14}$/).map(name => ({ type: 'Identifier', name })),
    fc.constant({ type: 'ArrayExpression', elements: [] }),
    fc.constant({ type: 'ObjectExpression', properties: [] }),
    fc.constant({ type: 'CallExpression' })
  )

  // Generator: arbitrary prop names (valid JS identifiers, not matching reserved/event/data-/aria- patterns)
  const arbitraryPropNameArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,19}$/)
    .filter(name =>
      !['children', 'key', 'ref', 'className', 'id', 'style', 'slot', 'is', 'dangerouslySetInnerHTML'].includes(name) &&
      !/^on[A-Z]/.test(name) &&
      !name.startsWith('data-') &&
      !name.startsWith('aria-') &&
      !/^render[A-Z]/.test(name)
    )

  // Generator: any prop value type (for testing passthrough regardless of value)
  const anyPropValueArb = fc.oneof(
    fc.constant({ type: 'JSXElement' }),
    fc.constant({ type: 'JSXFragment' }),
    fc.constant({ type: 'StringLiteral', value: 'test' }),
    fc.double({ noNaN: true }).map(n => ({ type: 'NumericLiteral', value: n })),
    fc.boolean().map(b => ({ type: 'BooleanLiteral', value: b })),
    fc.constant({ type: 'Identifier', name: 'x' }),
    fc.constant({ type: 'ArrayExpression', elements: [] }),
    fc.constant({ type: 'ObjectExpression', properties: [] }),
    fc.constant({ type: 'CallExpression' }),
    fc.constant({ type: 'ArrowFunctionExpression', params: [], body: { type: 'JSXElement' } }),
    fc.constant(null)
  )

  describe('Feature: react-plugin-slots, Property 6: Event handler props pass through', () => {
    it('any prop matching /^on[A-Z]/ is classified as passthrough regardless of value', () => {
      /**
       * Validates: Requirements 5.4
       */
      fc.assert(
        fc.property(eventHandlerNameArb, anyPropValueArb, (propName, propValue) => {
          const result = classifyProp(propName, propValue, {})
          expect(result).toEqual({ type: 'passthrough' })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 7: Reserved props pass through', () => {
    it('any reserved prop name is classified as passthrough regardless of value', () => {
      /**
       * Validates: Requirements 5.3
       */
      fc.assert(
        fc.property(reservedPropNameArb, anyPropValueArb, (propName, propValue) => {
          const result = classifyProp(propName, propValue, {})
          expect(result).toEqual({ type: 'passthrough' })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 8: data-/aria- props pass through', () => {
    it('any prop starting with data- or aria- is classified as passthrough regardless of value', () => {
      /**
       * Validates: Requirements 5.5
       */
      fc.assert(
        fc.property(dataAriaPropNameArb, anyPropValueArb, (propName, propValue) => {
          const result = classifyProp(propName, propValue, {})
          expect(result).toEqual({ type: 'passthrough' })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 9: Non-JSX value props pass through', () => {
    it('any prop with a non-JSX/non-string/non-arrow value is classified as passthrough', () => {
      /**
       * Validates: Requirements 5.6
       */
      fc.assert(
        fc.property(arbitraryPropNameArb, nonJsxValueArb, (propName, propValue) => {
          const result = classifyProp(propName, propValue, {})
          expect(result).toEqual({ type: 'passthrough' })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 19: Exclude list', () => {
    it('any prop in the exclude list is classified as passthrough regardless of value', () => {
      /**
       * Validates: Requirements 7.3
       */
      // Generator: exclude list containing the prop name being tested
      const excludeTestArb = fc.tuple(
        arbitraryPropNameArb,
        fc.array(arbitraryPropNameArb, { minLength: 0, maxLength: 5 }),
        anyPropValueArb
      ).map(([propName, otherExcludes, propValue]) => ({
        propName,
        exclude: [propName, ...otherExcludes],
        propValue
      }))

      fc.assert(
        fc.property(excludeTestArb, ({ propName, exclude, propValue }) => {
          const result = classifyProp(propName, propValue, { exclude })
          expect(result).toEqual({ type: 'passthrough' })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 20: Explicit slotProps list', () => {
    it('when slotProps is set, only props in the list with JSX/string values become slots', () => {
      /**
       * Validates: Requirements 7.4
       */
      // Generator: a prop name that IS in the slotProps list, with a slot-eligible value
      const slotEligibleValueArb = fc.oneof(
        fc.constant({ type: 'JSXElement' }),
        fc.constant({ type: 'JSXFragment' }),
        fc.constant({ type: 'StringLiteral', value: 'hello' })
      )

      const inSlotPropsArb = fc.tuple(
        arbitraryPropNameArb,
        fc.array(arbitraryPropNameArb, { minLength: 0, maxLength: 5 }),
        slotEligibleValueArb
      ).map(([propName, otherSlotProps, propValue]) => ({
        propName,
        slotProps: [propName, ...otherSlotProps],
        propValue
      }))

      fc.assert(
        fc.property(inSlotPropsArb, ({ propName, slotProps, propValue }) => {
          const result = classifyProp(propName, propValue, { slotProps })
          expect(result).toEqual({ type: 'slot', name: propName, value: propValue })
        }),
        { numRuns: 100 }
      )
    })

    it('when slotProps is set, props NOT in the list are classified as passthrough', () => {
      /**
       * Validates: Requirements 7.4
       */
      const notInSlotPropsArb = fc.tuple(
        arbitraryPropNameArb,
        fc.array(arbitraryPropNameArb, { minLength: 1, maxLength: 5 }),
        fc.oneof(
          fc.constant({ type: 'JSXElement' }),
          fc.constant({ type: 'StringLiteral', value: 'test' })
        )
      ).filter(([propName, slotProps]) => !slotProps.includes(propName))
        .map(([propName, slotProps, propValue]) => ({
          propName,
          slotProps,
          propValue
        }))

      fc.assert(
        fc.property(notInSlotPropsArb, ({ propName, slotProps, propValue }) => {
          const result = classifyProp(propName, propValue, { slotProps })
          expect(result).toEqual({ type: 'passthrough' })
        }),
        { numRuns: 100 }
      )
    })
  })
})


const { serializeJsxToHtml } = await import('../integrations/react.js')

describe('React Plugin Slots - serializeJsxToHtml', () => {
  describe('JSX attribute name mapping', () => {
    it('converts className to class', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'div' },
          attributes: [{
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'className' },
            value: { type: 'StringLiteral', value: 'container' }
          }]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<div class="container"></div>')
    })

    it('converts htmlFor to for', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'label' },
          attributes: [{
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'htmlFor' },
            value: { type: 'StringLiteral', value: 'email' }
          }]
        },
        children: [{ type: 'JSXText', value: 'Email' }]
      }
      expect(serializeJsxToHtml(node)).toBe('<label for="email">Email</label>')
    })

    it('converts tabIndex to tabindex', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'div' },
          attributes: [{
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'tabIndex' },
            value: { type: 'JSXExpressionContainer', expression: { type: 'NumericLiteral', value: 0 } }
          }]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<div tabindex="0"></div>')
    })

    it('converts readOnly to readonly', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'input' },
          attributes: [{
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'readOnly' },
            value: null
          }]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<input readonly>')
    })

    it('converts maxLength to maxlength', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'input' },
          attributes: [{
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'maxLength' },
            value: { type: 'JSXExpressionContainer', expression: { type: 'NumericLiteral', value: 100 } }
          }]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<input maxlength="100">')
    })

    it('converts autoFocus to autofocus', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'input' },
          attributes: [{
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'autoFocus' },
            value: null
          }]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<input autofocus>')
    })

    it('converts autoComplete to autocomplete', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'input' },
          attributes: [{
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'autoComplete' },
            value: { type: 'StringLiteral', value: 'off' }
          }]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<input autocomplete="off">')
    })
  })

  describe('Void elements', () => {
    it('serializes <br /> without closing tag', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'br' },
          attributes: []
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<br>')
    })

    it('serializes <img> with attributes without closing tag', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'img' },
          attributes: [
            { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'src' }, value: { type: 'StringLiteral', value: 'photo.jpg' } },
            { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'alt' }, value: { type: 'StringLiteral', value: 'A photo' } }
          ]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<img src="photo.jpg" alt="A photo">')
    })

    it('serializes <input> without closing tag', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'input' },
          attributes: [
            { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'type' }, value: { type: 'StringLiteral', value: 'text' } }
          ]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<input type="text">')
    })

    it('serializes <hr> without closing tag', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'hr' },
          attributes: []
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<hr>')
    })
  })

  describe('Nested elements', () => {
    it('serializes nested elements recursively', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'div' },
          attributes: []
        },
        children: [{
          type: 'JSXElement',
          openingElement: {
            name: { type: 'JSXIdentifier', name: 'span' },
            attributes: [
              { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'className' }, value: { type: 'StringLiteral', value: 'inner' } }
            ]
          },
          children: [{ type: 'JSXText', value: 'Hello' }]
        }]
      }
      expect(serializeJsxToHtml(node)).toBe('<div><span class="inner">Hello</span></div>')
    })

    it('serializes deeply nested elements', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'div' },
          attributes: []
        },
        children: [{
          type: 'JSXElement',
          openingElement: {
            name: { type: 'JSXIdentifier', name: 'ul' },
            attributes: []
          },
          children: [{
            type: 'JSXElement',
            openingElement: {
              name: { type: 'JSXIdentifier', name: 'li' },
              attributes: []
            },
            children: [{ type: 'JSXText', value: 'Item 1' }]
          }]
        }]
      }
      expect(serializeJsxToHtml(node)).toBe('<div><ul><li>Item 1</li></ul></div>')
    })
  })

  describe('JSXFragment', () => {
    it('serializes fragment children without wrapper', () => {
      const node = {
        type: 'JSXFragment',
        children: [
          { type: 'JSXText', value: 'Hello ' },
          {
            type: 'JSXElement',
            openingElement: {
              name: { type: 'JSXIdentifier', name: 'strong' },
              attributes: []
            },
            children: [{ type: 'JSXText', value: 'world' }]
          }
        ]
      }
      expect(serializeJsxToHtml(node)).toBe('Hello <strong>world</strong>')
    })
  })

  describe('Parameter replacement (scoped slots)', () => {
    it('replaces {paramName} with {%paramName%} token in text content', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'span' },
          attributes: []
        },
        children: [{
          type: 'JSXExpressionContainer',
          expression: { type: 'Identifier', name: 'likes' }
        }, {
          type: 'JSXText',
          value: ' likes!'
        }]
      }
      expect(serializeJsxToHtml(node, ['likes'])).toBe('<span>{%likes%} likes!</span>')
    })

    it('replaces multiple parameters independently', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'span' },
          attributes: []
        },
        children: [
          { type: 'JSXExpressionContainer', expression: { type: 'Identifier', name: 'name' } },
          { type: 'JSXText', value: ': ' },
          { type: 'JSXExpressionContainer', expression: { type: 'Identifier', name: 'score' } }
        ]
      }
      expect(serializeJsxToHtml(node, ['name', 'score'])).toBe('<span>{%name%}: {%score%}</span>')
    })

    it('replaces parameter in attribute values', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'a' },
          attributes: [{
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'href' },
            value: { type: 'JSXExpressionContainer', expression: { type: 'Identifier', name: 'url' } }
          }]
        },
        children: [{ type: 'JSXText', value: 'Link' }]
      }
      expect(serializeJsxToHtml(node, ['url'])).toBe('<a href="{%url%}">Link</a>')
    })

    it('does NOT replace identifiers that are not in paramNames', () => {
      const warnings = []
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'span' },
          attributes: []
        },
        children: [{
          type: 'JSXExpressionContainer',
          expression: { type: 'Identifier', name: 'unknownVar' }
        }]
      }
      const result = serializeJsxToHtml(node, ['likes'], warnings)
      expect(result).toBe('<span></span>')
      expect(warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Warnings for dynamic expressions', () => {
    it('emits warning for dynamic identifier not in paramNames', () => {
      const warnings = []
      const node = {
        type: 'JSXExpressionContainer',
        expression: { type: 'Identifier', name: 'someVar' }
      }
      serializeJsxToHtml(node, [], warnings)
      expect(warnings).toContain('Dynamic expression "{someVar}" cannot be statically serialized')
    })

    it('emits warning for call expressions', () => {
      const warnings = []
      const node = {
        type: 'JSXExpressionContainer',
        expression: { type: 'CallExpression', callee: { type: 'Identifier', name: 'fn' } }
      }
      serializeJsxToHtml(node, [], warnings)
      expect(warnings).toContain('Expression of type "CallExpression" cannot be statically serialized')
    })

    it('emits warning for spread attributes', () => {
      const warnings = []
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'div' },
          attributes: [{
            type: 'JSXSpreadAttribute',
            argument: { type: 'Identifier', name: 'props' }
          }]
        },
        children: []
      }
      serializeJsxToHtml(node, [], warnings)
      expect(warnings).toContain('Spread attribute cannot be statically serialized')
    })
  })

  describe('Edge cases', () => {
    it('returns empty string for null node', () => {
      expect(serializeJsxToHtml(null)).toBe('')
    })

    it('returns empty string for undefined node', () => {
      expect(serializeJsxToHtml(undefined)).toBe('')
    })

    it('handles JSXText with only whitespace', () => {
      const node = { type: 'JSXText', value: '   \n   ' }
      expect(serializeJsxToHtml(node)).toBe('')
    })

    it('handles StringLiteral node directly', () => {
      const node = { type: 'StringLiteral', value: 'hello world' }
      expect(serializeJsxToHtml(node)).toBe('hello world')
    })

    it('handles JSXExpressionContainer with StringLiteral', () => {
      const node = {
        type: 'JSXExpressionContainer',
        expression: { type: 'StringLiteral', value: 'inline text' }
      }
      expect(serializeJsxToHtml(node)).toBe('inline text')
    })

    it('handles JSXEmptyExpression (comments)', () => {
      const node = {
        type: 'JSXExpressionContainer',
        expression: { type: 'JSXEmptyExpression' }
      }
      expect(serializeJsxToHtml(node)).toBe('')
    })

    it('handles boolean attributes (no value)', () => {
      const node = {
        type: 'JSXElement',
        openingElement: {
          name: { type: 'JSXIdentifier', name: 'input' },
          attributes: [
            { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'disabled' }, value: null },
            { type: 'JSXAttribute', name: { type: 'JSXIdentifier', name: 'type' }, value: { type: 'StringLiteral', value: 'text' } }
          ]
        },
        children: []
      }
      expect(serializeJsxToHtml(node)).toBe('<input disabled type="text">')
    })
  })
})


describe('React Plugin Slots - Property-Based Tests for JSX-to-HTML Serialization', () => {
  // --- Generators ---

  // JSX attribute name mapping pairs
  const jsxToHtmlAttrMappingArb = fc.constantFrom(
    { jsx: 'className', html: 'class' },
    { jsx: 'htmlFor', html: 'for' },
    { jsx: 'tabIndex', html: 'tabindex' },
    { jsx: 'readOnly', html: 'readonly' },
    { jsx: 'maxLength', html: 'maxlength' },
    { jsx: 'autoFocus', html: 'autofocus' },
    { jsx: 'autoComplete', html: 'autocomplete' }
  )

  // Void element names
  const voidElementNameArb = fc.constantFrom(
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  )

  // Non-void element names for nesting
  const nonVoidElementNameArb = fc.constantFrom(
    'div', 'span', 'p', 'section', 'article', 'main', 'header',
    'footer', 'nav', 'aside', 'ul', 'ol', 'li', 'h1', 'h2', 'h3',
    'strong', 'em', 'a', 'button', 'label', 'form', 'table'
  )

  // Simple string attribute value (safe for HTML attributes)
  const safeAttrValueArb = fc.stringMatching(/^[a-zA-Z0-9 _-]{1,20}$/)

  describe('Feature: react-plugin-slots, Property 22: JSX attribute name mapping', () => {
    it('for any JSX element with React-specific attribute names, the serialized HTML uses standard HTML attribute names', () => {
      /**
       * Validates: Requirements 6.1
       */
      fc.assert(
        fc.property(
          nonVoidElementNameArb,
          jsxToHtmlAttrMappingArb,
          safeAttrValueArb,
          (tagName, mapping, attrValue) => {
            const node = {
              type: 'JSXElement',
              openingElement: {
                name: { type: 'JSXIdentifier', name: tagName },
                attributes: [{
                  type: 'JSXAttribute',
                  name: { type: 'JSXIdentifier', name: mapping.jsx },
                  value: { type: 'StringLiteral', value: attrValue }
                }]
              },
              children: []
            }

            const result = serializeJsxToHtml(node)

            // The output should contain the HTML attribute name, not the JSX name
            expect(result).toContain(`${mapping.html}="${attrValue}"`)
            // The output should NOT contain the JSX attribute name as an attribute
            expect(result).not.toMatch(new RegExp(`\\b${mapping.jsx}=`))
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 23: Void elements serialized without closing tag', () => {
    it('for any void HTML element, the serialized HTML does not include a closing tag', () => {
      /**
       * Validates: Requirements 6.2
       */
      fc.assert(
        fc.property(
          voidElementNameArb,
          fc.array(
            fc.tuple(
              fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/),
              safeAttrValueArb
            ),
            { minLength: 0, maxLength: 3 }
          ),
          (tagName, attrs) => {
            const attributes = attrs.map(([name, value]) => ({
              type: 'JSXAttribute',
              name: { type: 'JSXIdentifier', name },
              value: { type: 'StringLiteral', value }
            }))

            const node = {
              type: 'JSXElement',
              openingElement: {
                name: { type: 'JSXIdentifier', name: tagName },
                attributes
              },
              children: []
            }

            const result = serializeJsxToHtml(node)

            // Should start with opening tag
            expect(result).toMatch(new RegExp(`^<${tagName}`))
            // Should end with > (not />)
            expect(result).toMatch(/>$/)
            // Should NOT contain a closing tag
            expect(result).not.toContain(`</${tagName}>`)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 24: Nested elements serialized recursively', () => {
    it('for any nested JSX structure, the serialized HTML preserves the complete nesting with proper open/close tags', () => {
      /**
       * Validates: Requirements 6.3
       */
      // Use distinct element names to allow unambiguous indexOf checks
      const distinctElementsArb = fc.tuple(
        fc.constantFrom('div', 'section', 'article', 'main', 'aside', 'nav', 'header'),
        fc.constantFrom('span', 'p', 'em', 'strong', 'label', 'button', 'li'),
        fc.constantFrom('h1', 'h2', 'h3', 'a', 'ul', 'ol', 'form')
      )

      // Text that won't be treated as whitespace-only
      const nonWhitespaceTextArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/)

      // Generator for a nested JSX structure (3 levels deep with distinct tags)
      const nestedJsxArb = fc.tuple(
        distinctElementsArb,
        nonWhitespaceTextArb
      ).map(([[outer, middle, inner], text]) => ({
        node: {
          type: 'JSXElement',
          openingElement: {
            name: { type: 'JSXIdentifier', name: outer },
            attributes: []
          },
          children: [{
            type: 'JSXElement',
            openingElement: {
              name: { type: 'JSXIdentifier', name: middle },
              attributes: []
            },
            children: [{
              type: 'JSXElement',
              openingElement: {
                name: { type: 'JSXIdentifier', name: inner },
                attributes: []
              },
              children: [{ type: 'JSXText', value: text }]
            }]
          }]
        },
        outer,
        middle,
        inner,
        text
      }))

      fc.assert(
        fc.property(nestedJsxArb, ({ node, outer, middle, inner, text }) => {
          const result = serializeJsxToHtml(node)

          // Outer element should be properly opened and closed
          expect(result).toMatch(new RegExp(`^<${outer}>`))
          expect(result).toMatch(new RegExp(`</${outer}>$`))

          // Middle element should be properly opened and closed within outer
          expect(result).toContain(`<${middle}>`)
          expect(result).toContain(`</${middle}>`)

          // Inner element should be properly opened and closed within middle
          expect(result).toContain(`<${inner}>`)
          expect(result).toContain(`</${inner}>`)

          // Text content should be present
          expect(result).toContain(text)

          // Verify nesting order: outer opens first, closes last
          const outerOpenIdx = result.indexOf(`<${outer}>`)
          const outerCloseIdx = result.indexOf(`</${outer}>`)
          const middleOpenIdx = result.indexOf(`<${middle}>`)
          const middleCloseIdx = result.indexOf(`</${middle}>`)
          const innerOpenIdx = result.indexOf(`<${inner}>`)
          const innerCloseIdx = result.indexOf(`</${inner}>`)

          expect(outerOpenIdx).toBeLessThan(middleOpenIdx)
          expect(middleOpenIdx).toBeLessThan(innerOpenIdx)
          expect(innerCloseIdx).toBeLessThan(middleCloseIdx)
          expect(middleCloseIdx).toBeLessThan(outerCloseIdx)
        }),
        { numRuns: 100 }
      )
    })
  })
})


const { generateNamedSlotElement, generateStringSlotElement, generateScopedSlotElement, deriveSlotName } = await import('../integrations/react.js')

describe('React Plugin Slots - Property-Based Tests for Slot Generation and Name Derivation', () => {
  // --- Generators ---

  // Valid slot names: camelCase identifiers (start with lowercase, alphanumeric)
  const slotNameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,14}$/)

  // Render prop names: "render" + uppercase letter + optional suffix
  const renderPropNameArb = fc.tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.stringMatching(/^[a-zA-Z0-9]{0,14}$/)
  ).map(([upper, suffix]) => `render${upper}${suffix}`)

  // Parameter name arrays: 1-3 valid JS identifiers
  const paramNameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,9}$/)
  const paramNamesArb = fc.array(paramNameArb, { minLength: 1, maxLength: 3 })
    .filter(arr => new Set(arr).size === arr.length) // ensure unique param names

  // Simple JSX element AST nodes for content/body
  const simpleJsxElementArb = fc.tuple(
    fc.constantFrom('span', 'div', 'p', 'strong', 'em', 'h1', 'h2', 'a', 'button'),
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,14}$/)
  ).map(([tag, text]) => ({
    type: 'JSXElement',
    openingElement: {
      name: { type: 'JSXIdentifier', name: tag },
      attributes: []
    },
    children: [{ type: 'JSXText', value: text }]
  }))

  // Simple string text (non-empty, no special chars that would break assertions)
  const simpleTextArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/)

  describe('Feature: react-plugin-slots, Property 3: Named slot prop produces div child', () => {
    it('for any slot name and JSX content, generateNamedSlotElement produces a JSXElement with tag name div, a slot attribute equal to the slot name, and the content as a child', () => {
      /**
       * Validates: Requirements 2.1
       */
      fc.assert(
        fc.property(slotNameArb, simpleJsxElementArb, (slotName, content) => {
          const result = generateNamedSlotElement(slotName, content)

          // Result is a JSXElement
          expect(result.type).toBe('JSXElement')

          // Tag name is 'div'
          expect(result.openingElement.name.name).toBe('div')

          // Has a slot attribute with the correct value
          const slotAttr = result.openingElement.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'slot'
          )
          expect(slotAttr).toBeDefined()
          expect(slotAttr.value.value).toBe(slotName)

          // Content is a child
          expect(result.children.length).toBeGreaterThanOrEqual(1)
          // The content should be present in children (either directly or wrapped)
          const hasContent = result.children.some(
            child => child === content || (child.type === 'JSXExpressionContainer' && child.expression === content)
          )
          expect(hasContent).toBe(true)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 4: String slot prop produces span child', () => {
    it('for any slot name and string text, generateStringSlotElement produces a JSXElement with tag name span, a slot attribute equal to the slot name, and a JSXText child with the text', () => {
      /**
       * Validates: Requirements 2.2
       */
      fc.assert(
        fc.property(slotNameArb, simpleTextArb, (slotName, text) => {
          const result = generateStringSlotElement(slotName, text)

          // Result is a JSXElement
          expect(result.type).toBe('JSXElement')

          // Tag name is 'span'
          expect(result.openingElement.name.name).toBe('span')

          // Has a slot attribute with the correct value
          const slotAttr = result.openingElement.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'slot'
          )
          expect(slotAttr).toBeDefined()
          expect(slotAttr.value.value).toBe(slotName)

          // Has a JSXText child with the text
          expect(result.children.length).toBe(1)
          expect(result.children[0].type).toBe('JSXText')
          expect(result.children[0].value).toBe(text)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 10: Render prop produces scoped slot element', () => {
    it('for any slot name, params array, and JSX body, generateScopedSlotElement produces a JSXElement with tag name div, slot attribute, slot-props attribute, and dangerouslySetInnerHTML attribute', () => {
      /**
       * Validates: Requirements 3.1, 3.5
       */
      fc.assert(
        fc.property(slotNameArb, paramNamesArb, simpleJsxElementArb, (slotName, params, body) => {
          const result = generateScopedSlotElement(slotName, params, body)

          // Result is a JSXElement
          expect(result.type).toBe('JSXElement')

          // Tag name is 'div'
          expect(result.openingElement.name.name).toBe('div')

          // Has a slot attribute with the correct value
          const slotAttr = result.openingElement.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'slot'
          )
          expect(slotAttr).toBeDefined()
          expect(slotAttr.value.value).toBe(slotName)

          // Has a slot-props attribute
          const slotPropsAttr = result.openingElement.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'slot-props'
          )
          expect(slotPropsAttr).toBeDefined()

          // Has a dangerouslySetInnerHTML attribute
          const dangerouslyAttr = result.openingElement.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'dangerouslySetInnerHTML'
          )
          expect(dangerouslyAttr).toBeDefined()

          // dangerouslySetInnerHTML value is a JSXExpressionContainer with ObjectExpression
          expect(dangerouslyAttr.value.type).toBe('JSXExpressionContainer')
          expect(dangerouslyAttr.value.expression.type).toBe('ObjectExpression')

          // The object has a __html property
          const htmlProp = dangerouslyAttr.value.expression.properties.find(
            p => p.key.name === '__html'
          )
          expect(htmlProp).toBeDefined()
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 11: Slot name derivation', () => {
    it('for any render prop name matching /^render[A-Z]/, deriveSlotName strips the render prefix and lowercases the first remaining character', () => {
      /**
       * Validates: Requirements 3.2
       */
      fc.assert(
        fc.property(renderPropNameArb, (renderPropName) => {
          const result = deriveSlotName(renderPropName)

          // The result should be the name without "render" prefix, with first char lowercased
          const withoutPrefix = renderPropName.slice(6) // strip "render"
          const expected = withoutPrefix[0].toLowerCase() + withoutPrefix.slice(1)

          expect(result).toBe(expected)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 12: Parameter extraction to slot-props', () => {
    it('for any render prop with N parameters (N >= 1), the generated slot-props attribute contains all N parameter names comma-separated', () => {
      /**
       * Validates: Requirements 3.3, 3.6
       */
      fc.assert(
        fc.property(slotNameArb, paramNamesArb, simpleJsxElementArb, (slotName, params, body) => {
          const result = generateScopedSlotElement(slotName, params, body)

          // Find the slot-props attribute
          const slotPropsAttr = result.openingElement.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'slot-props'
          )
          expect(slotPropsAttr).toBeDefined()

          // The value should be all params comma-separated
          expect(slotPropsAttr.value.value).toBe(params.join(','))

          // Verify all params are present
          const extractedParams = slotPropsAttr.value.value.split(',')
          expect(extractedParams.length).toBe(params.length)
          params.forEach((param, i) => {
            expect(extractedParams[i]).toBe(param)
          })
        }),
        { numRuns: 100 }
      )
    })
  })
})


const { wccReactPlugin } = await import('../integrations/react.js')

describe('React Plugin Slots - Property-Based Tests for Main Transform', () => {
  // Helper: create a mock context with this.warn()
  function createMockContext() {
    return { warn: vi.fn() }
  }

  // Helper: call the plugin's transform hook with a mock context
  function callTransform(plugin, code, id) {
    const ctx = createMockContext()
    const transformFn = plugin.transform
    return transformFn.call(ctx, code, id)
  }

  // --- Generators ---

  // File extensions that should NOT be processed
  const nonJsxExtensionArb = fc.constantFrom(
    '.js', '.ts', '.css', '.html', '.json', '.vue', '.svelte',
    '.mjs', '.cjs', '.mts', '.cts', '.md', '.txt', '.yaml'
  )

  // File extensions that SHOULD be processed
  const jsxExtensionArb = fc.constantFrom('.jsx', '.tsx')

  // Valid file path base (simple directory + filename)
  const filePathBaseArb = fc.stringMatching(/^[a-z][a-z0-9]{0,9}\/[a-z][a-zA-Z0-9]{0,9}$/)

  // Custom element tag names (word-word pattern)
  const customElementTagArb = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/)
  ).map(([a, b]) => `${a}-${b}`)

  // Non-custom element tag names (no hyphen)
  const standardTagArb = fc.constantFrom(
    'div', 'span', 'p', 'section', 'article', 'main', 'header',
    'footer', 'nav', 'aside', 'ul', 'ol', 'li', 'h1', 'h2', 'h3',
    'strong', 'em', 'a', 'button', 'label', 'form', 'table', 'input'
  )

  // Valid prop names for slot props (not reserved, not event handlers, not data-/aria-)
  const slotPropNameArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,9}$/)
    .filter(name =>
      !['children', 'key', 'ref', 'className', 'id', 'style', 'slot', 'is', 'dangerouslySetInnerHTML'].includes(name) &&
      !/^on[A-Z]/.test(name) &&
      !name.startsWith('data-') &&
      !name.startsWith('aria-') &&
      !/^render[A-Z]/.test(name)
    )

  // Passthrough prop names (event handlers)
  const eventHandlerPropArb = fc.tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.stringMatching(/^[a-zA-Z]{0,8}$/)
  ).map(([upper, suffix]) => `on${upper}${suffix}`)

  // Simple text content for children
  const childTextArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,14}$/)

  // Parameter names for render props
  const paramNameArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,7}$/)
    .filter(name => name !== 'div' && name !== 'span' && name !== 'slot')

  // Prefix strings for prefix filtering
  const prefixArb = fc.stringMatching(/^[a-z]{2,4}-$/)

  const plugin = wccReactPlugin()

  describe('Feature: react-plugin-slots, Property 1: File extension filtering', () => {
    it('for any file ID that does not end with .jsx or .tsx, the transform returns null', () => {
      /**
       * Validates: Requirements 1.4
       */
      fc.assert(
        fc.property(filePathBaseArb, nonJsxExtensionArb, (basePath, ext) => {
          const id = `${basePath}${ext}`
          const code = `import React from 'react';\nexport default function App() { return <wcc-card header={<h1>Hi</h1>}></wcc-card> }`
          const result = callTransform(plugin, code, id)
          expect(result).toBeNull()
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 2: No-op for files without custom elements', () => {
    it('for any valid JSX file with no hyphenated tag names, the transform returns null', () => {
      /**
       * Validates: Requirements 1.5
       */
      fc.assert(
        fc.property(standardTagArb, childTextArb, (tag, text) => {
          const code = `import React from 'react';\nexport default function App() { return <${tag}>${text}</${tag}> }`
          const result = callTransform(plugin, code, 'src/App.jsx')
          expect(result).toBeNull()
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 5: Children ordering invariant', () => {
    it('for any custom element with existing children and slot props, existing children appear before generated slot elements', () => {
      /**
       * Validates: Requirements 2.3, 2.4
       */
      fc.assert(
        fc.property(
          customElementTagArb,
          childTextArb,
          slotPropNameArb,
          childTextArb,
          (tag, existingChild, slotProp, slotValue) => {
            const code = `import React from 'react';\nexport default function App() { return <${tag} ${slotProp}="${slotValue}"><p>${existingChild}</p></${tag}> }`
            const result = callTransform(plugin, code, 'src/App.jsx')

            expect(result).not.toBeNull()
            const output = result.code

            // The existing child text should appear before the generated slot element
            const existingChildIdx = output.indexOf(existingChild)
            const slotAttrIdx = output.indexOf(`slot="${slotProp}"`)

            expect(existingChildIdx).toBeGreaterThan(-1)
            expect(slotAttrIdx).toBeGreaterThan(-1)
            expect(existingChildIdx).toBeLessThan(slotAttrIdx)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 13: Parameter reference replacement', () => {
    it('for any render prop with parameters, occurrences of {param} in text content are replaced with {%param%} tokens', () => {
      /**
       * Validates: Requirements 3.4, 3.7, 10.1, 10.2
       */
      fc.assert(
        fc.property(
          customElementTagArb,
          paramNameArb,
          (tag, param) => {
            const code = `import React from 'react';\nexport default function App() { return <${tag} renderInfo={(${param}) => <span>{${param}}</span>}></${tag}> }`
            const result = callTransform(plugin, code, 'src/App.jsx')

            expect(result).not.toBeNull()
            const output = result.code

            // The output should contain the {%param%} token
            expect(output).toContain(`{%${param}%}`)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 14: No replacement in tag/attribute names', () => {
    it('for any render prop where a parameter name appears as a tag name, it is NOT replaced with {%param%} tokens in the tag', () => {
      /**
       * Validates: Requirements 10.3
       */
      fc.assert(
        fc.property(
          customElementTagArb,
          paramNameArb,
          (tag, param) => {
            // Use the param name as an attribute name on a child element
            // The param reference in text content should be replaced, but the attribute name should not
            const code = `import React from 'react';\nexport default function App() { return <${tag} renderInfo={(${param}) => <span ${param}="test">{${param}}</span>}></${tag}> }`
            const result = callTransform(plugin, code, 'src/App.jsx')

            expect(result).not.toBeNull()
            const output = result.code

            // The output should contain the {%param%} token for the text content
            expect(output).toContain(`{%${param}%}`)

            // The output should still contain the attribute name as-is (not tokenized)
            // The attribute name in the serialized HTML should remain as the param name
            expect(output).toContain(`${param}=`)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 15: Non-slot props preserved on element', () => {
    it('for any custom element with a mix of slot props and event handler props, event handler props remain as attributes', () => {
      /**
       * Validates: Requirements 4.4, 9.3
       */
      fc.assert(
        fc.property(
          customElementTagArb,
          slotPropNameArb,
          eventHandlerPropArb,
          (tag, slotProp, eventProp) => {
            const code = `import React from 'react';\nexport default function App() { return <${tag} ${slotProp}="slot content" ${eventProp}={() => {}}></${tag}> }`
            const result = callTransform(plugin, code, 'src/App.jsx')

            expect(result).not.toBeNull()
            const output = result.code

            // The event handler prop should still be present as an attribute on the element
            expect(output).toContain(eventProp)

            // The slot prop should NOT be present as an attribute (it was transformed)
            // It should appear as slot="propName" on a child element instead
            expect(output).toContain(`slot="${slotProp}"`)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 16: Source map returned', () => {
    it('for any file that is transformed, the result includes both code and map', () => {
      /**
       * Validates: Requirements 4.6
       */
      fc.assert(
        fc.property(
          customElementTagArb,
          slotPropNameArb,
          childTextArb,
          (tag, slotProp, slotValue) => {
            const code = `import React from 'react';\nexport default function App() { return <${tag} ${slotProp}="${slotValue}"></${tag}> }`
            const result = callTransform(plugin, code, 'src/App.jsx')

            expect(result).not.toBeNull()
            expect(result).toHaveProperty('code')
            expect(result).toHaveProperty('map')
            expect(typeof result.code).toBe('string')
            expect(result.map).toBeTruthy()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 17: Default processes all hyphenated tags', () => {
    it('without prefix option, all custom elements with hyphenated tag names are processed', () => {
      /**
       * Validates: Requirements 4.2, 7.1
       */
      fc.assert(
        fc.property(
          customElementTagArb,
          slotPropNameArb,
          childTextArb,
          (tag, slotProp, slotValue) => {
            const defaultPlugin = wccReactPlugin()
            const code = `import React from 'react';\nexport default function App() { return <${tag} ${slotProp}="${slotValue}"></${tag}> }`
            const result = callTransform(defaultPlugin, code, 'src/App.jsx')

            expect(result).not.toBeNull()
            expect(result.code).toContain(`slot="${slotProp}"`)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Feature: react-plugin-slots, Property 18: Prefix filtering', () => {
    it('with prefix option, only elements starting with the prefix are processed', () => {
      /**
       * Validates: Requirements 7.2
       */
      fc.assert(
        fc.property(
          prefixArb,
          slotPropNameArb,
          childTextArb,
          (prefix, slotProp, slotValue) => {
            const prefixPlugin = wccReactPlugin({ prefix })

            // Element that matches the prefix — should be processed
            const matchingTag = `${prefix}card`
            const matchingCode = `import React from 'react';\nexport default function App() { return <${matchingTag} ${slotProp}="${slotValue}"></${matchingTag}> }`
            const matchingResult = callTransform(prefixPlugin, matchingCode, 'src/App.jsx')

            expect(matchingResult).not.toBeNull()
            expect(matchingResult.code).toContain(`slot="${slotProp}"`)

            // Element that does NOT match the prefix — should NOT be processed
            const nonMatchingTag = `other-element`
            const nonMatchingCode = `import React from 'react';\nexport default function App() { return <${nonMatchingTag} ${slotProp}="${slotValue}"></${nonMatchingTag}> }`
            const nonMatchingResult = callTransform(prefixPlugin, nonMatchingCode, 'src/App.jsx')

            expect(nonMatchingResult).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


describe('React Plugin Slots - Warning Behavior (Tasks 7.2, 7.3, 7.4)', () => {
  // Helper: create a mock context with this.warn()
  function createMockContext() {
    return { warn: vi.fn() }
  }

  // Helper: call the plugin's transform hook with a mock context
  function callTransformWithCtx(plugin, code, id) {
    const ctx = createMockContext()
    const transformFn = plugin.transform
    const result = transformFn.call(ctx, code, id)
    return { result, ctx }
  }

  const plugin = wccReactPlugin()

  describe('Task 7.2: Warn on invalid render prop values (non-arrow-function)', () => {
    it('emits a warning when render prop value is an Identifier', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={myFunc}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).toHaveBeenCalledTimes(1)
      expect(ctx.warn.mock.calls[0][0]).toContain('renderStats')
      expect(ctx.warn.mock.calls[0][0]).toContain('expected ArrowFunctionExpression')
      expect(ctx.warn.mock.calls[0][0]).toContain('Identifier')
      expect(ctx.warn.mock.calls[0][0]).toContain('src/App.jsx')
    })

    it('emits a warning when render prop value is a CallExpression', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={getRenderer()}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).toHaveBeenCalledTimes(1)
      expect(ctx.warn.mock.calls[0][0]).toContain('renderStats')
      expect(ctx.warn.mock.calls[0][0]).toContain('CallExpression')
    })

    it('leaves the prop unchanged on the element when render prop value is invalid', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={myFunc}></wcc-card> }`
      const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      // The prop should remain on the element (not transformed into a slot child)
      // Since no transformation happened, result should be null
      expect(result).toBeNull()
    })

    it('does NOT warn when render prop value is a valid ArrowFunctionExpression', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={(likes) => <span>{likes}</span>}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).not.toHaveBeenCalled()
      expect(result).not.toBeNull()
    })

    it('does NOT warn when render prop value is a StringLiteral (treated as slot)', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats="hello"></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      // StringLiteral render props are classified as slots by classifyProp (Rule 7)
      expect(ctx.warn).not.toHaveBeenCalled()
    })
  })

  describe('Task 7.3: Warn on unsupported expressions in render prop bodies', () => {
    it('emits a warning when render prop body contains a function call', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={(likes) => <span>{formatNumber(likes)}</span>}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).toHaveBeenCalledTimes(1)
      expect(ctx.warn.mock.calls[0][0]).toContain('renderStats')
      expect(ctx.warn.mock.calls[0][0]).toContain('src/App.jsx')
    })

    it('emits a warning when render prop body references a non-parameter variable', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={(likes) => <span>{someOtherVar}</span>}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).toHaveBeenCalledTimes(1)
      expect(ctx.warn.mock.calls[0][0]).toContain('renderStats')
    })

    it('leaves the prop unchanged when render prop body has unsupported expressions', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={(likes) => <span>{formatNumber(likes)}</span>}></wcc-card> }`
      const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      // No transformation should happen since the render prop was skipped
      expect(result).toBeNull()
    })

    it('does NOT warn when render prop body only references its parameters', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={(likes) => <span>{likes} likes!</span>}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).not.toHaveBeenCalled()
      expect(result).not.toBeNull()
    })
  })

  describe('Task 7.4: Warn on dynamic expressions in named slot props', () => {
    it('emits a warning when named slot JSX contains a dynamic variable reference', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card header={<span>{dynamicVar}</span>}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).toHaveBeenCalledTimes(1)
      expect(ctx.warn.mock.calls[0][0]).toContain('header')
      expect(ctx.warn.mock.calls[0][0]).toContain('src/App.jsx')
    })

    it('emits a warning when named slot JSX contains a function call', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card header={<span>{getText()}</span>}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).toHaveBeenCalledTimes(1)
      expect(ctx.warn.mock.calls[0][0]).toContain('header')
    })

    it('leaves the prop unchanged when named slot JSX has dynamic expressions', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card header={<span>{dynamicVar}</span>}></wcc-card> }`
      const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      // No transformation should happen since the slot prop was skipped
      expect(result).toBeNull()
    })

    it('does NOT warn when named slot JSX contains only static content', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card header={<strong>Static Title</strong>}></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).not.toHaveBeenCalled()
      expect(result).not.toBeNull()
    })

    it('does NOT warn for string literal slot props (always static)', () => {
      const code = `import React from 'react';\nexport default function App() { return <wcc-card header="Static text"></wcc-card> }`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(ctx.warn).not.toHaveBeenCalled()
      expect(result).not.toBeNull()
    })
  })

  describe('Task 7.1 & 7.5: Parse error pass-through and warning format', () => {
    it('returns null when the file contains invalid syntax', () => {
      const invalidCode = `import React from 'react';\nexport default function App() { return <wcc-card`
      const { result } = callTransformWithCtx(plugin, invalidCode, 'src/Broken.jsx')

      expect(result).toBeNull()
    })

    it('calls this.warn() with a message containing the file path on parse error', () => {
      const invalidCode = `import React from 'react';\nexport default function App() { return <wcc-card`
      const { ctx } = callTransformWithCtx(plugin, invalidCode, 'src/Broken.jsx')

      expect(ctx.warn).toHaveBeenCalledTimes(1)
      expect(ctx.warn.mock.calls[0][0]).toContain('src/Broken.jsx')
    })

    it('calls this.warn() with a message containing "failed to parse"', () => {
      const invalidCode = `import React from 'react';\nexport default function App() { return <wcc-card`
      const { ctx } = callTransformWithCtx(plugin, invalidCode, 'src/Broken.jsx')

      expect(ctx.warn).toHaveBeenCalledTimes(1)
      expect(ctx.warn.mock.calls[0][0]).toContain('failed to parse')
    })

    it('warning format includes file path for all warning types', () => {
      // Parse error warning includes file path
      const invalidCode = `import React from 'react';\nexport default function App() { return <wcc-card`
      const { ctx: parseCtx } = callTransformWithCtx(plugin, invalidCode, 'src/ParseError.tsx')
      expect(parseCtx.warn.mock.calls[0][0]).toContain('src/ParseError.tsx')

      // Invalid render prop warning includes file path
      const invalidRenderProp = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={myFunc}></wcc-card> }`
      const { ctx: renderCtx } = callTransformWithCtx(plugin, invalidRenderProp, 'src/RenderWarn.jsx')
      expect(renderCtx.warn.mock.calls[0][0]).toContain('src/RenderWarn.jsx')

      // Unsupported expression warning includes file path
      const unsupportedExpr = `import React from 'react';\nexport default function App() { return <wcc-card renderStats={(x) => <span>{formatNumber(x)}</span>}></wcc-card> }`
      const { ctx: exprCtx } = callTransformWithCtx(plugin, unsupportedExpr, 'src/ExprWarn.jsx')
      expect(exprCtx.warn.mock.calls[0][0]).toContain('src/ExprWarn.jsx')

      // Dynamic slot prop warning includes file path
      const dynamicSlot = `import React from 'react';\nexport default function App() { return <wcc-card header={<span>{dynamicVar}</span>}></wcc-card> }`
      const { ctx: slotCtx } = callTransformWithCtx(plugin, dynamicSlot, 'src/SlotWarn.jsx')
      expect(slotCtx.warn.mock.calls[0][0]).toContain('src/SlotWarn.jsx')
    })
  })
})


describe('React Plugin Slots - Integration: Hook Coexistence (Task 9.1)', () => {
  // Helper: create a mock context with this.warn()
  function createMockContext() {
    return { warn: vi.fn() }
  }

  // Helper: call the plugin's transform hook with a mock context
  function callTransformWithCtx(plugin, code, id) {
    const ctx = createMockContext()
    const transformFn = plugin.transform
    const result = transformFn.call(ctx, code, id)
    return { result, ctx }
  }

  const plugin = wccReactPlugin()

  describe('useWccEvent calls are not modified in transformed files', () => {
    it('preserves useWccEvent(ref, eventName, handler) call alongside slot props', () => {
      const code = `import React, { useRef } from 'react';
import { useWccEvent } from '@sprlab/wccompiler/integrations/react';

export default function App() {
  const ref = useRef(null);
  useWccEvent(ref, 'change', (e) => console.log(e.detail));
  return <wcc-card ref={ref} header={<h1>Title</h1>}></wcc-card>;
}`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(result).not.toBeNull()
      expect(result.code).toContain('useWccEvent(ref, \'change\'')
      expect(result.code).toContain('slot="header"')
      expect(ctx.warn).not.toHaveBeenCalled()
    })

    it('preserves useWccEvent(eventName, handler) form alongside slot props', () => {
      const code = `import React from 'react';
import { useWccEvent } from '@sprlab/wccompiler/integrations/react';

export default function App() {
  const ref = useWccEvent('submit', (e) => console.log(e.detail));
  return <wcc-form ref={ref} footer={<button>Submit</button>}></wcc-form>;
}`
      const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(result).not.toBeNull()
      expect(result.code).toContain('useWccEvent(\'submit\'')
      expect(result.code).toContain('slot="footer"')
    })
  })

  describe('useWccModel calls are not modified in transformed files', () => {
    it('preserves useWccModel(propName, value, setValue) call alongside slot props', () => {
      const code = `import React, { useState } from 'react';
import { useWccModel } from '@sprlab/wccompiler/integrations/react';

export default function App() {
  const [text, setText] = useState('');
  const ref = useWccModel('value', text, setText);
  return <wcc-input ref={ref} header={<label>Name</label>}></wcc-input>;
}`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(result).not.toBeNull()
      expect(result.code).toContain('useWccModel(\'value\', text, setText)')
      expect(result.code).toContain('slot="header"')
      expect(ctx.warn).not.toHaveBeenCalled()
    })
  })

  describe('ref prop is preserved when used alongside slot props', () => {
    it('keeps ref={myRef} on the element while transforming slot props', () => {
      const code = `import React, { useRef } from 'react';

export default function App() {
  const myRef = useRef(null);
  return <wcc-card ref={myRef} header={<h1>Title</h1>} footer={<p>Footer</p>}></wcc-card>;
}`
      const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(result).not.toBeNull()
      // ref should remain as an attribute on the element
      expect(result.code).toContain('ref={myRef}')
      // slot props should be transformed into children
      expect(result.code).toContain('slot="header"')
      expect(result.code).toContain('slot="footer"')
    })
  })

  describe('TypeScript annotations in .tsx files parse correctly', () => {
    it('handles React.FC type annotation', () => {
      const code = `import React from 'react';

const App: React.FC = () => {
  return <wcc-card header={<h1>Title</h1>}></wcc-card>;
};

export default App;`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.tsx')

      expect(result).not.toBeNull()
      expect(result.code).toContain('slot="header"')
      expect(ctx.warn).not.toHaveBeenCalled()
    })

    it('handles generic type parameters in TSX', () => {
      const code = `import React from 'react';

interface Props {
  title: string;
}

const App: React.FC<Props> = ({ title }) => {
  return <wcc-card header={<h1>{title}</h1>}></wcc-card>;
};

export default App;`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.tsx')

      // Should warn about dynamic expression {title} in slot content
      // but should still parse correctly
      expect(ctx.warn).toHaveBeenCalled()
      // The file should parse without error (no "failed to parse" warning)
      const parseWarnings = ctx.warn.mock.calls.filter(c => c[0].includes('failed to parse'))
      expect(parseWarnings.length).toBe(0)
    })

    it('handles type assertions and as expressions in TSX', () => {
      const code = `import React from 'react';

const App = () => {
  const el = document.querySelector('wcc-card') as HTMLElement;
  return <wcc-card header={<strong>Hello</strong>}></wcc-card>;
};

export default App;`
      const { result, ctx } = callTransformWithCtx(plugin, code, 'src/App.tsx')

      expect(result).not.toBeNull()
      expect(result.code).toContain('slot="header"')
      expect(ctx.warn).not.toHaveBeenCalled()
    })
  })

  describe('Nested custom elements in slot values are serialized without recursive transformation', () => {
    it('serializes nested wcc-badge inside a slot prop as HTML, not recursively transformed', () => {
      const code = `import React from 'react';

export default function App() {
  return <wcc-card header={<wcc-badge>Hi</wcc-badge>}></wcc-card>;
}`
      const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(result).not.toBeNull()
      const output = result.code

      // The outer wcc-card should be transformed (slot prop → child)
      expect(output).toContain('slot="header"')

      // The nested wcc-badge should appear as serialized content inside the slot div,
      // NOT as a separately transformed element with its own slot children
      // It should NOT have a second slot="..." attribute from recursive transformation
      const slotMatches = output.match(/slot="/g)
      expect(slotMatches.length).toBe(1) // Only one slot attribute (from header)
    })

    it('serializes nested custom element with attributes as HTML in slot content', () => {
      const code = `import React from 'react';

export default function App() {
  return <wcc-card header={<wcc-icon className="large">star</wcc-icon>}></wcc-card>;
}`
      const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

      expect(result).not.toBeNull()
      const output = result.code

      // Should have the slot child
      expect(output).toContain('slot="header"')

      // The nested wcc-icon should be serialized as HTML content, not recursively processed
      // Only one slot attribute should exist
      const slotMatches = output.match(/slot="/g)
      expect(slotMatches.length).toBe(1)
    })
  })
})


describe('Feature: react-plugin-slots, Property 21: Hook calls not modified', () => {
  // Helper: create a mock context with this.warn()
  function createMockContext() {
    return { warn: vi.fn() }
  }

  // Helper: call the plugin's transform hook with a mock context
  function callTransformWithCtx(plugin, code, id) {
    const ctx = createMockContext()
    const transformFn = plugin.transform
    const result = transformFn.call(ctx, code, id)
    return { result, ctx }
  }

  const plugin = wccReactPlugin()

  // Generator: event names for useWccEvent
  const eventNameArb = fc.constantFrom(
    'change', 'submit', 'click', 'input', 'focus', 'blur',
    'keydown', 'keyup', 'mouseenter', 'mouseleave', 'scroll',
    'resize', 'custom-event', 'wcc:model', 'toggle'
  )

  // Generator: model prop names for useWccModel
  const modelPropNameArb = fc.constantFrom(
    'value', 'count', 'checked', 'selected', 'text',
    'name', 'email', 'active', 'open', 'disabled'
  )

  // Generator: slot prop names (valid, non-reserved)
  const slotPropNameArb = fc.stringMatching(/^[a-z][a-zA-Z]{2,9}$/)
    .filter(name =>
      !['children', 'key', 'ref', 'className', 'id', 'style', 'slot', 'is', 'dangerouslySetInnerHTML'].includes(name) &&
      !/^on[A-Z]/.test(name) &&
      !name.startsWith('data-') &&
      !name.startsWith('aria-') &&
      !/^render[A-Z]/.test(name)
    )

  // Generator: custom element tag names
  const customElementTagArb = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/)
  ).map(([a, b]) => `${a}-${b}`)

  it('for any JSX file containing useWccEvent calls alongside custom elements with slot props, the hook calls appear unchanged in the output', () => {
    /**
     * Validates: Requirements 9.1, 9.2
     */
    fc.assert(
      fc.property(
        customElementTagArb,
        eventNameArb,
        slotPropNameArb,
        (tag, eventName, slotProp) => {
          const code = `import React, { useRef } from 'react';
import { useWccEvent } from '@sprlab/wccompiler/integrations/react';

export default function App() {
  const ref = useRef(null);
  useWccEvent(ref, '${eventName}', (e) => console.log(e.detail));
  return <${tag} ref={ref} ${slotProp}={<span>Content</span>}></${tag}>;
}`
          const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

          expect(result).not.toBeNull()
          // The useWccEvent call should appear unchanged
          expect(result.code).toContain(`useWccEvent(ref, '${eventName}'`)
          // The slot prop should be transformed
          expect(result.code).toContain(`slot="${slotProp}"`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('for any JSX file containing useWccModel calls alongside custom elements with slot props, the hook calls appear unchanged in the output', () => {
    /**
     * Validates: Requirements 9.1, 9.2
     */
    fc.assert(
      fc.property(
        customElementTagArb,
        modelPropNameArb,
        slotPropNameArb,
        (tag, modelProp, slotProp) => {
          const code = `import React, { useState } from 'react';
import { useWccModel } from '@sprlab/wccompiler/integrations/react';

export default function App() {
  const [val, setVal] = useState('');
  const ref = useWccModel('${modelProp}', val, setVal);
  return <${tag} ref={ref} ${slotProp}={<span>Content</span>}></${tag}>;
}`
          const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

          expect(result).not.toBeNull()
          // The useWccModel call should appear unchanged
          expect(result.code).toContain(`useWccModel('${modelProp}', val, setVal)`)
          // The slot prop should be transformed
          expect(result.code).toContain(`slot="${slotProp}"`)
        }
      ),
      { numRuns: 100 }
    )
  })
})


describe('Feature: react-plugin-slots, Property 25: Semantic equivalence of render prop output', () => {
  // Helper: create a mock context with this.warn()
  function createMockContext() {
    return { warn: vi.fn() }
  }

  // Helper: call the plugin's transform hook with a mock context
  function callTransformWithCtx(plugin, code, id) {
    const ctx = createMockContext()
    const transformFn = plugin.transform
    const result = transformFn.call(ctx, code, id)
    return { result, ctx }
  }

  const plugin = wccReactPlugin()

  // Generator: parameter names (valid JS identifiers, unique)
  const paramNameArb = fc.stringMatching(/^[a-z][a-zA-Z]{1,7}$/)
    .filter(name => name !== 'span' && name !== 'div' && name !== 'slot' && name !== 'class')

  // Generator: 1-3 unique parameter names
  const paramListArb = fc.array(paramNameArb, { minLength: 1, maxLength: 3 })
    .filter(arr => new Set(arr).size === arr.length)

  // Generator: custom element tag names
  const customElementTagArb = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/)
  ).map(([a, b]) => `${a}-${b}`)

  it('for any render prop with N parameters, the generated HTML template contains exactly N {%param%} tokens matching the parameter names', () => {
    /**
     * Validates: Requirements 10.4
     */
    fc.assert(
      fc.property(
        customElementTagArb,
        paramListArb,
        (tag, params) => {
          // Build a render prop that uses all parameters in text content
          const paramUsages = params.map(p => `{${p}}`).join(' ')
          const paramDecl = params.join(', ')
          const code = `import React from 'react';
export default function App() {
  return <${tag} renderInfo={(${paramDecl}) => <span>${paramUsages}</span>}></${tag}>;
}`
          const { result } = callTransformWithCtx(plugin, code, 'src/App.jsx')

          expect(result).not.toBeNull()
          const output = result.code

          // Each parameter should have a corresponding {%param%} token in the output
          for (const param of params) {
            expect(output).toContain(`{%${param}%}`)
          }

          // Extract the dangerouslySetInnerHTML template string from the output
          const templateMatch = output.match(/__html:\s*"([^"]*)"/) || output.match(/__html:\s*`([^`]*)`/)
          expect(templateMatch).not.toBeNull()
          const template = templateMatch[1]

          // Count {%...%} tokens in the template
          const tokenMatches = template.match(/\{%[a-zA-Z]+%\}/g) || []

          // Should have exactly N tokens (one per parameter)
          expect(tokenMatches.length).toBe(params.length)

          // Each token should match one of the parameter names
          for (const param of params) {
            expect(tokenMatches).toContain(`{%${param}%}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
