/**
 * React hook for WCC custom element events.
 * Bridges CustomEvent to React's ref-based event system.
 *
 * @module @sprlab/wccompiler/integrations/react
 *
 * Usage:
 *   // Form 1: Pass an existing ref
 *   const ref = useRef(null)
 *   useWccEvent(ref, 'change', (e) => console.log(e.detail))
 *   <wcc-counter ref={ref}></wcc-counter>
 *
 *   // Form 2: Let the hook create the ref
 *   const ref = useWccEvent('change', (e) => console.log(e.detail))
 *   <wcc-counter ref={ref}></wcc-counter>
 *
 *   // Form 3: Two-way binding with defineModel
 *   const [value, setValue] = useState('')
 *   const ref = useWccModel('value', value, setValue)
 *   <wcc-input ref={ref}></wcc-input>
 */

import { useRef, useEffect, useCallback } from 'react'

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
  // Detect calling convention
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

  // Only return ref if we created it (Form 2)
  if (!isRefForm) return elementRef
}


/**
 * Hook for two-way binding with WCC defineModel props.
 *
 * Listens for `wcc:model` events on the element and calls the setter
 * when the matching prop changes internally. Also syncs the React state
 * to the element's attribute when the value changes externally.
 *
 * @param {string} propName - The model prop name (e.g., 'value', 'count')
 * @param {*} value - Current React state value
 * @param {(newValue: *) => void} setValue - React state setter
 * @param {import('react').RefObject<HTMLElement>} [existingRef] - Optional existing ref
 * @returns {import('react').RefObject<HTMLElement>} Ref to attach to the WCC element
 *
 * @example
 * ```jsx
 * function App() {
 *   const [text, setText] = useState('')
 *   const inputRef = useWccModel('value', text, setText)
 *   return <wcc-input ref={inputRef}></wcc-input>
 * }
 * ```
 */
export function useWccModel(propName, value, setValue, existingRef) {
  const internalRef = useRef(null)
  const elementRef = existingRef || internalRef

  const setValueRef = useRef(setValue)
  setValueRef.current = setValue

  // Listen for wcc:model events from the component (child → parent)
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

  // Sync React state to the element's attribute (parent → child)
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
