/**
 * React browser-side hooks for WCC custom elements.
 * Bridges CustomEvent to React's ref-based event system.
 *
 * @module @sprlab/wccompiler/adapters/react
 *
 * NOTE: These hooks are optional utilities for React 18 or edge cases.
 * With React 19 + wccReactPlugin, WCC components work natively:
 *
 *   <WccCounter count={state} oncountchanged={(e) => setState(e.detail)} />
 *   <WccCard>
 *     <WccCard.Header><strong>Title</strong></WccCard.Header>
 *   </WccCard>
 *
 * The plugin handles PascalCase → kebab-case, compound components, and
 * scoped slots at build time. No runtime wrappers needed.
 *
 * These hooks are for cases where you need manual event bridging
 * (e.g., React 18, non-Vite builds, or dynamic event names):
 *
 *   import { useWccEvent, useWccModel } from '@sprlab/wccompiler/adapters/react'
 */

import { useRef, useEffect } from 'react'

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
 *
 * @example
 * // Form 1: Let the hook create the ref
 * const ref = useWccEvent('count-changed', (e) => setCount(e.detail))
 * <wcc-counter ref={ref}></wcc-counter>
 *
 * // Form 2: Pass an existing ref
 * const myRef = useRef(null)
 * useWccEvent(myRef, 'count-changed', (e) => setCount(e.detail))
 * <wcc-counter ref={myRef}></wcc-counter>
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
