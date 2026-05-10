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
