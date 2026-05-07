/**
 * React hook for WCC custom element events.
 * Bridges CustomEvent to React's ref-based event system.
 *
 * @module @sprlab/wccompiler/integrations/react
 */

import { useRef, useEffect } from 'react'

/**
 * Hook that attaches a CustomEvent listener to a DOM element via ref.
 *
 * @param {string} eventName - The event name to listen for
 * @param {(event: CustomEvent) => void} handler - Event handler callback
 * @returns {import('react').RefObject<HTMLElement>}
 */
export function useWccEvent(eventName, handler) {
  const ref = useRef(null)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const listener = (e) => handlerRef.current(e)
    el.addEventListener(eventName, listener)
    return () => el.removeEventListener(eventName, listener)
  }, [eventName])

  return ref
}
