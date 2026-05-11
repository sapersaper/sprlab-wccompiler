/**
 * React browser-side hooks for WCC custom elements.
 * Bridges CustomEvent to React's ref-based event system.
 *
 * @module @sprlab/wccompiler/adapters/react
 *
 * IMPORTANT: Import hooks from THIS file (not from integrations/react).
 * The integrations/react file is for vite.config.js only (contains Babel).
 *
 * Usage:
 *   import { useWccEvent, useWccModel, createWccWrapper } from '@sprlab/wccompiler/adapters/react'
 *
 *   // Option A: Low-level hooks (full control)
 *   const ref = useWccEvent('change', (e) => console.log(e.detail))
 *   <wcc-counter ref={ref}></wcc-counter>
 *
 *   // Option B: Wrapper components (idiomatic React DX)
 *   const WccCounter = createWccWrapper('wcc-counter', {
 *     events: ['change'],
 *     models: ['count']
 *   })
 *   <WccCounter onChange={handler} count={count} onCountChanged={setCount} />
 */

import React, { useRef, useEffect } from 'react'

/**
 * Hook that attaches a CustomEvent listener to a DOM element via ref.
 *
 * Supports two calling conventions:
 * - useWccEvent(ref, eventName, handler) — uses an existing ref
 * - useWccEvent(eventName, handler) — creates and returns a new ref
 *
 * @param {import('react').RefObject<HTMLElement> | string} refOrEventName
 * @param {string | ((event: CustomEvent) => void)} eventNameOrHandler
 * @param {((event: CustomEvent) => void)} [handler]
 * @returns {import('react').RefObject<HTMLElement> | void}
 */
export function useWccEvent(refOrEventName, eventNameOrHandler, handler) {
  const isRefForm = typeof refOrEventName !== 'string'
  const elementRef = isRefForm ? refOrEventName : useRef(null)
  const eventName = isRefForm ? eventNameOrHandler : refOrEventName
  const callback = isRefForm ? handler : eventNameOrHandler

  const handlerRef = useRef(callback)
  handlerRef.current = callback

  useEffect(() => {
    const el = elementRef.current
    if (!el) return
    const listener = (e) => handlerRef.current(e)
    el.addEventListener(eventName, listener)
    return () => el.removeEventListener(eventName, listener)
  }, [eventName])

  if (!isRefForm) return elementRef
}

/**
 * Hook for two-way binding with WCC defineModel props.
 *
 * @param {string} propName - The model prop name (e.g., 'value', 'count')
 * @param {*} value - Current React state value
 * @param {(newValue: *) => void} setValue - React state setter
 * @param {import('react').RefObject<HTMLElement>} [existingRef] - Optional existing ref
 * @returns {import('react').RefObject<HTMLElement>} Ref to attach to the WCC element
 *
 * @example
 * const [text, setText] = useState('')
 * const inputRef = useWccModel('value', text, setText)
 * <wcc-input ref={inputRef}></wcc-input>
 */
export function useWccModel(propName, value, setValue, existingRef) {
  const internalRef = useRef(null)
  const elementRef = existingRef || internalRef

  const setValueRef = useRef(setValue)
  setValueRef.current = setValue

  useEffect(() => {
    const el = elementRef.current
    if (!el) return

    const listener = (e) => {
      if (e.detail && e.detail.prop === propName) {
        setValueRef.current(e.detail.value)
      }
    }

    el.addEventListener('wcc:model', listener)
    return () => el.removeEventListener('wcc:model', listener)
  }, [propName])

  useEffect(() => {
    const el = elementRef.current
    if (!el) return
    if (value != null) {
      el.setAttribute(propName, String(value))
    } else {
      el.removeAttribute(propName)
    }
  }, [propName, value])

  return elementRef
}


/**
 * Converts a kebab-case event name to a React-idiomatic prop name.
 *
 * Rules:
 * - 'change' → 'onChange'
 * - 'count-changed' → 'onCountChange' (strips trailing 'd' from past tense)
 * - 'value-updated' → 'onValueUpdate' (strips trailing 'd')
 * - 'reset' → 'onReset'
 * - 'item-click' → 'onItemClick'
 *
 * @param {string} eventName - kebab-case event name
 * @returns {string} React prop name (onCamelCase)
 */
function toReactEventProp(eventName) {
  const parts = eventName.split('-')
  const camel = parts.map(s => s[0].toUpperCase() + s.slice(1)).join('')
  // Strip trailing 'd' from past tense verbs (changed→Change, updated→Update)
  const normalized = camel.replace(/(Changed|Updated|Removed|Added|Closed|Opened|Submitted|Cancelled)$/, (m) => m.slice(0, -1))
  return 'on' + normalized
}

/**
 * Creates a React wrapper component for a WCC custom element.
 *
 * The wrapper provides idiomatic React DX:
 * - Event props: `onChange`, `onCountChange` → automatically wired via addEventListener
 *   Handlers receive the unwrapped value (event.detail), not the raw CustomEvent.
 * - Model props: two-way binding via attribute + event listener
 * - Regular props: passed as attributes on the custom element
 * - Children: passed through as-is (use `<div slot="name">` for named slots)
 * - Ref forwarding: supports React refs via forwardRef
 *
 * @param {string} tagName - The custom element tag name (e.g., 'wcc-card')
 * @param {Object} [config] - Configuration for the wrapper
 * @param {string[]} [config.events] - Custom event names to expose as onEventName props
 *   Event names are converted: 'count-changed' → onCountChange prop (React convention)
 * @param {string[]} [config.models] - Model prop names for two-way binding
 *   Each model 'name' creates: `name` prop (sets attribute) + `onNameChange` event
 * @param {string[]} [config.slots] - Named slot names for compound sub-components
 *   Each slot 'name' creates a `.Name` sub-component that renders `<div slot="name">`
 * @returns {import('react').ForwardRefExoticComponent} A React component with compound sub-components
 *
 * @example
 * const WccCounter = createWccWrapper('wcc-counter', {
 *   events: ['change'],
 *   models: ['count'],
 *   slots: ['header', 'footer']
 * })
 *
 * function App() {
 *   const [count, setCount] = useState(0)
 *   return (
 *     <WccCounter
 *       count={count}
 *       onCountChange={(value) => setCount(value)}
 *       onChange={(value) => console.log('changed', value)}
 *       label="Clicks"
 *     >
 *       <WccCounter.Header><strong>Title</strong></WccCounter.Header>
 *       <p>Body content</p>
 *       <WccCounter.Footer>Footer text</WccCounter.Footer>
 *     </WccCounter>
 *   )
 * }
 */
export function createWccWrapper(tagName, config = {}) {
  const { events = [], models = [], slots = [] } = config

  // Build a set of event prop names for quick lookup
  // Convention: kebab-case event → React onCamelCase (without trailing 'd' from 'changed')
  // 'count-changed' → 'onCountChange' (not 'onCountChanged')
  // 'change' → 'onChange'
  // 'value-updated' → 'onValueUpdate' (strips trailing 'd' from past tense)
  const eventPropMap = new Map()
  for (const eventName of events) {
    const propName = toReactEventProp(eventName)
    eventPropMap.set(propName, eventName)
  }

  // Model events: 'count' → 'count-changed' → 'onCountChange'
  const modelEventMap = new Map()
  for (const modelName of models) {
    const eventName = `${modelName}-changed`
    const propName = toReactEventProp(eventName)
    eventPropMap.set(propName, eventName)
    modelEventMap.set(modelName, eventName)
  }

  // Reserved prop names that should not be passed as attributes
  const SKIP_PROPS = new Set(['children', 'key', 'ref', 'style', 'className', 'dangerouslySetInnerHTML'])

  const WccWrapper = React.forwardRef(function WccWrapper(props, externalRef) {
    const internalRef = useRef(null)
    const ref = externalRef || internalRef

    // Store event handlers in a ref to avoid re-subscribing on every render
    const handlersRef = useRef({})

    // Collect event handlers and regular props
    const regularProps = {}
    const eventHandlers = {}

    for (const [key, value] of Object.entries(props)) {
      if (SKIP_PROPS.has(key)) continue

      if (eventPropMap.has(key)) {
        eventHandlers[eventPropMap.get(key)] = value
      } else if (key.startsWith('on') && key.length > 2 && key[2] >= 'A' && key[2] <= 'Z') {
        // Generic React event handler pattern: onClick, onFocus, etc.
        // Convert onSomething → 'something' (lowercase first char)
        const nativeEvent = key[2].toLowerCase() + key.slice(3)
        eventHandlers[nativeEvent] = value
      } else {
        regularProps[key] = value
      }
    }

    // Update handlers ref
    handlersRef.current = eventHandlers

    // Subscribe to custom events
    useEffect(() => {
      const el = typeof ref === 'function' ? null : ref?.current
      if (!el) return

      const listeners = []
      const allEvents = new Set([...eventPropMap.values(), ...Object.keys(eventHandlers)])

      for (const eventName of allEvents) {
        const listener = (e) => {
          const handler = handlersRef.current[eventName]
          if (handler) handler(e instanceof CustomEvent ? e.detail : e)
        }
        el.addEventListener(eventName, listener)
        listeners.push([eventName, listener])
      }

      return () => {
        for (const [name, listener] of listeners) {
          el.removeEventListener(name, listener)
        }
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Sync regular props as attributes
    useEffect(() => {
      const el = typeof ref === 'function' ? null : ref?.current
      if (!el) return

      for (const [key, value] of Object.entries(regularProps)) {
        if (value == null || value === false) {
          el.removeAttribute(key)
        } else if (value === true) {
          el.setAttribute(key, '')
        } else {
          el.setAttribute(key, String(value))
        }
      }
    })

    // Build the element props for React's createElement
    const elementProps = { ref }
    if (props.style) elementProps.style = props.style
    if (props.className) elementProps.className = props.className

    return React.createElement(tagName, elementProps, props.children)
  })

  WccWrapper.displayName = tagName.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')

  // Compound components: generate .SlotName sub-components for each named slot
  // This enables the pattern: <WccLayout.Header>content</WccLayout.Header>
  // which renders as: <div slot="header">content</div>
  for (const slotName of slots) {
    if (!slotName) continue // skip default slot
    const pascalSlot = slotName[0].toUpperCase() + slotName.slice(1)
    const SlotComponent = function WccSlot({ children, ...rest }) {
      const slotProps = { slot: slotName, style: { display: 'contents' } }
      // Pass through any extra props as attributes on the wrapper div
      for (const [key, value] of Object.entries(rest)) {
        slotProps[key] = value
      }
      return React.createElement('div', slotProps, children)
    }
    SlotComponent.displayName = `${WccWrapper.displayName}.${pascalSlot}`
    WccWrapper[pascalSlot] = SlotComponent
  }

  return WccWrapper
}



/**
 * Creates a React wrapper from a WCC component class that has `static __meta`.
 *
 * Unlike `createWccWrapper` which requires manual event/model configuration,
 * this function reads the metadata directly from the compiled component class.
 *
 * @param {Function} WccClass - The WCC custom element class (must have static __meta)
 * @returns {import('react').ForwardRefExoticComponent} A React component
 *
 * @example
 * import { wrapWccComponent } from '@sprlab/wccompiler/adapters/react'
 * import '../wcc-components/wcc-counter.js'  // registers the custom element
 *
 * // Read metadata directly from the registered class
 * const WccCounter = wrapWccComponent(customElements.get('wcc-counter'))
 *
 * // Use idiomatically — no manual config needed
 * // Handlers receive the value directly (not the event)
 * <WccCounter count={count} onCountChange={setCount} onChange={(val) => console.log(val)} />
 */
export function wrapWccComponent(WccClass) {
  const meta = WccClass?.__meta
  if (!meta) {
    throw new Error(`wrapWccComponent: class does not have static __meta. Is it a compiled WCC component?`)
  }

  return createWccWrapper(meta.tag, {
    events: meta.events || [],
    models: meta.models || [],
    slots: meta.slots || [],
  })
}

/**
 * Creates React wrappers for all registered WCC custom elements matching a prefix.
 *
 * Scans the custom elements registry for components with `static __meta` and
 * generates typed wrapper components for each one.
 *
 * @param {Object} [options]
 * @param {string} [options.prefix='wcc-'] - Tag prefix to filter components
 * @returns {Record<string, import('react').ForwardRefExoticComponent>} Map of PascalCase name → React component
 *
 * @example
 * // In your app entry point, after importing all WCC components:
 * import '../wcc-components/wcc-counter.js'
 * import '../wcc-components/wcc-card.js'
 * import { createWccWrappers } from '@sprlab/wccompiler/adapters/react'
 *
 * export const { WccCounter, WccCard } = createWccWrappers()
 *
 * // Then use anywhere:
 * <WccCounter count={count} onCountChange={setCount} />
 * <WccCard>
 *   <WccCard.Header><strong>Title</strong></WccCard.Header>
 *   <p>Body</p>
 *   <WccCard.Footer>Footer</WccCard.Footer>
 * </WccCard>
 */
export function createWccWrappers(options = {}) {
  const { prefix = 'wcc-' } = options
  const wrappers = {}

  // Note: customElements registry doesn't have a list API,
  // so we need the component files to be imported first (which registers them).
  // This function is meant to be called after all component imports.

  // We'll use a Proxy that lazily creates wrappers on first access
  return new Proxy(wrappers, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined
      if (prop in target) return target[prop]

      // Convert PascalCase to kebab-case: WccCounter → wcc-counter
      const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')

      // Check if it starts with the prefix
      if (!kebab.startsWith(prefix)) return undefined

      const ctor = customElements.get(kebab)
      if (!ctor || !(ctor).__meta) return undefined

      const wrapper = wrapWccComponent(ctor)
      target[prop] = wrapper
      return wrapper
    }
  })
}
